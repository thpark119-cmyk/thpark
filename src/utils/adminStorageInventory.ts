import { ref, list, getMetadata, StorageReference } from 'firebase/storage';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { isAdminUser } from './admin';

export type AdminStorageInventoryItem = {
  storagePath: string;
  uid: string;
  category: 'studentPhoto' | 'lessonJournalPhoto' | 'repertoireFile' | 'unknown';
  size: number;
  contentType?: string;
  updatedAt?: string;
};

export type AdminUserStorageInventorySummary = {
  uid: string;
  email?: string;
  displayName?: string;
  studentPhotos: {
    count: number;
    totalBytes: number;
  };
  lessonJournalPhotos: {
    count: number;
    totalBytes: number;
  };
  repertoireFiles: {
    count: number;
    totalBytes: number;
  };
  unknownFiles: {
    count: number;
    totalBytes: number;
  };
  total: {
    count: number;
    totalBytes: number;
  };
};

export type AdminStorageInventorySummary = {
  users: AdminUserStorageInventorySummary[];
  totals: {
    userCount: number;
    fileCount: number;
    totalBytes: number;
    studentPhotoCount: number;
    studentPhotoBytes: number;
    lessonJournalPhotoCount: number;
    lessonJournalPhotoBytes: number;
    repertoireFileCount: number;
    repertoireFileBytes: number;
    unknownFileCount: number;
    unknownFileBytes: number;
  };
  scannedAt: string;
};

// Storage 경로를 분석하여 uid 및 카테고리를 추정하는 함수
export function parseStoragePath(path: string): { 
  uid: string; 
  category: 'studentPhoto' | 'lessonJournalPhoto' | 'repertoireFile' | 'unknown' 
} {
  const parts = path.split('/');
  
  if (parts[0] !== 'users' || parts.length < 2) {
    return { uid: 'unknown', category: 'unknown' };
  }

  const uid = parts[1];

  if (path.includes('/students/')) {
    return { uid, category: 'studentPhoto' };
  } else if (path.includes('/lesson-journal/')) {
    return { uid, category: 'lessonJournalPhoto' };
  } else if (path.includes('/repertoire/')) {
    return { uid, category: 'repertoireFile' };
  } else {
    return { uid, category: 'unknown' };
  }
}

// Storage에서 users/ 경로 아래의 모든 파일을 재귀적으로 탐색하는 함수
export async function listStorageFilesRecursively(
  prefix: string,
  onProgress?: (scannedCount: number) => void
): Promise<StorageReference[]> {
  if (!storage) return [];
  const files: StorageReference[] = [];
  const queue: string[] = [prefix];
  let scannedCount = 0;

  while (queue.length > 0) {
    const currentPrefix = queue.shift()!;
    const currentRef = ref(storage, currentPrefix);
    let pageToken: string | undefined = undefined;

    try {
      do {
        const options: { maxResults: number; pageToken?: string } = { maxResults: 100 };
        if (pageToken) {
          options.pageToken = pageToken;
        }
        
        const listResult = await list(currentRef, options);
        
        // 파일들 추가
        files.push(...listResult.items);
        scannedCount += listResult.items.length;
        if (onProgress) {
          onProgress(scannedCount);
        }

        // 서브디렉토리들을 탐색 큐에 추가
        for (const prefRef of listResult.prefixes) {
          queue.push(prefRef.fullPath);
        }

        pageToken = listResult.nextPageToken;
      } while (pageToken);
    } catch (err) {
      console.warn(`Listing directory failed at path: ${currentPrefix}. Skipping directory.`, err);
    }
  }

  return files;
}

// 수집된 파일 레퍼런스들의 메타데이터를 동시성 제한을 두고 순차 조회하는 함수
export async function fetchMetadataForRefs(
  refs: StorageReference[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: AdminStorageInventoryItem[]; failed: string[] }> {
  const success: AdminStorageInventoryItem[] = [];
  const failed: string[] = [];
  const concurrency = 6; // 한 번에 최대 6개 병렬 처리로 제한
  let completed = 0;

  const tasks = refs.map((itemRef) => async () => {
    try {
      const meta = await getMetadata(itemRef);
      const storagePath = itemRef.fullPath;
      const parsed = parseStoragePath(storagePath);

      success.push({
        storagePath,
        uid: parsed.uid,
        category: parsed.category,
        size: meta.size || 0,
        contentType: meta.contentType || '',
        updatedAt: meta.updated || meta.timeCreated || ''
      });
    } catch (err: any) {
      console.warn(`Failed to fetch metadata for: ${itemRef.fullPath}`, err);
      failed.push(itemRef.fullPath);
    } finally {
      completed++;
      if (onProgress) {
        onProgress(completed, refs.length);
      }
    }
  });

  for (let i = 0; i < tasks.length; i += concurrency) {
    const chunk = tasks.slice(i, i + concurrency);
    await Promise.all(chunk.map(t => t()));
  }

  return { success, failed };
}

// 전체 스캔을 수행하고 요약 정보를 구성하는 메인 함수
export async function performStorageInventoryScan(
  currentUser: any,
  onProgress?: (status: { stage: 'listing' | 'metadata' | 'users' | 'saving'; count: number; total?: number }) => void
): Promise<AdminStorageInventorySummary> {
  if (!db || !storage) {
    throw new Error('Firebase connection is not available.');
  }

  const isAdmin = isAdminUser(currentUser);
  if (!isAdmin) {
    throw new Error('Permission denied. Admin authorization is required.');
  }

  // 1. Storage 탐색 (users/)
  if (onProgress) onProgress({ stage: 'listing', count: 0 });
  const allRefs = await listStorageFilesRecursively('users', (count) => {
    if (onProgress) onProgress({ stage: 'listing', count });
  });

  // 2. 파일 메타데이터 조회
  if (onProgress) onProgress({ stage: 'metadata', count: 0, total: allRefs.length });
  const { success: items } = await fetchMetadataForRefs(allRefs, (completed, total) => {
    if (onProgress) onProgress({ stage: 'metadata', count: completed, total });
  });

  // 3. 사용자 정보 맵핑 구성
  if (onProgress) onProgress({ stage: 'users', count: 0 });
  const userProfilesMap = new Map<string, { email?: string; displayName?: string }>();
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      userProfilesMap.set(docSnap.id, {
        email: data.email,
        displayName: data.displayName
      });
    });
  } catch (err) {
    console.warn('Failed to load user profiles collection. Fallback mapping will be used.');
  }

  // 4. 요약 구성
  const userSummariesMap = new Map<string, AdminUserStorageInventorySummary>();

  // 전체 요약 변수
  let totalBytes = 0;
  let studentPhotoCount = 0;
  let studentPhotoBytes = 0;
  let lessonJournalPhotoCount = 0;
  let lessonJournalPhotoBytes = 0;
  let repertoireFileCount = 0;
  let repertoireFileBytes = 0;
  let unknownFileCount = 0;
  let unknownFileBytes = 0;

  for (const item of items) {
    const { uid, category, size } = item;
    
    if (!userSummariesMap.has(uid)) {
      const profile = userProfilesMap.get(uid);
      userSummariesMap.set(uid, {
        uid,
        email: profile?.email,
        displayName: profile?.displayName,
        studentPhotos: { count: 0, totalBytes: 0 },
        lessonJournalPhotos: { count: 0, totalBytes: 0 },
        repertoireFiles: { count: 0, totalBytes: 0 },
        unknownFiles: { count: 0, totalBytes: 0 },
        total: { count: 0, totalBytes: 0 }
      });
    }

    const uSum = userSummariesMap.get(uid)!;
    
    // 개별 카테고리 누적
    if (category === 'studentPhoto') {
      uSum.studentPhotos.count += 1;
      uSum.studentPhotos.totalBytes += size;
      studentPhotoCount += 1;
      studentPhotoBytes += size;
    } else if (category === 'lessonJournalPhoto') {
      uSum.lessonJournalPhotos.count += 1;
      uSum.lessonJournalPhotos.totalBytes += size;
      lessonJournalPhotoCount += 1;
      lessonJournalPhotoBytes += size;
    } else if (category === 'repertoireFile') {
      uSum.repertoireFiles.count += 1;
      uSum.repertoireFiles.totalBytes += size;
      repertoireFileCount += 1;
      repertoireFileBytes += size;
    } else {
      uSum.unknownFiles.count += 1;
      uSum.unknownFiles.totalBytes += size;
      unknownFileCount += 1;
      unknownFileBytes += size;
    }

    uSum.total.count += 1;
    uSum.total.totalBytes += size;
    totalBytes += size;
  }

  const usersList = Array.from(userSummariesMap.values()).sort(
    (a, b) => b.total.totalBytes - a.total.totalBytes
  );

  const summary: AdminStorageInventorySummary = {
    users: usersList,
    totals: {
      userCount: usersList.length,
      fileCount: items.length,
      totalBytes,
      studentPhotoCount,
      studentPhotoBytes,
      lessonJournalPhotoCount,
      lessonJournalPhotoBytes,
      repertoireFileCount,
      repertoireFileBytes,
      unknownFileCount,
      unknownFileBytes
    },
    scannedAt: new Date().toLocaleString()
  };

  // 5. 캐시에 스캔 결과 저장 (선택 사항이지만 완전성 확보)
  if (onProgress) onProgress({ stage: 'saving', count: 0 });
  try {
    await saveInventoryCache(items);
  } catch (err) {
    console.warn('Failed to save inventory cache:', err);
  }

  return summary;
}

// 인벤토리 스캔 항목들을 Firestore 캐시 컬렉션에 업서트하는 함수
export async function saveInventoryCache(items: AdminStorageInventoryItem[]): Promise<void> {
  if (!db) return;
  
  // Firestore 배치를 사용해서 청크 단위로 분할 저장
  const chunkSize = 150;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    
    chunk.forEach(item => {
      const safeId = item.storagePath.replace(/\//g, '_');
      const cacheRef = doc(db, 'adminStorageInventoryCache', safeId);
      
      // 이메일, 이름, 원본파일명은 저장하지 않고, 필수 항목만 기록
      batch.set(cacheRef, {
        storagePath: item.storagePath,
        uid: item.uid,
        category: item.category,
        size: item.size,
        contentType: item.contentType || '',
        updatedAt: item.updatedAt || '',
        scannedAt: new Date().toLocaleString()
      }, { merge: true });
    });

    await batch.commit();
  }
}

// 캐시된 인벤토리에서 전체 요약을 다시 구성해오는 함수 (스캔을 매번 오래 기다리기 힘든 경우 사용)
export async function loadCachedInventorySummary(): Promise<AdminStorageInventorySummary | null> {
  if (!db) return null;
  try {
    const querySnap = await getDocs(collection(db, 'adminStorageInventoryCache'));
    if (querySnap.empty) return null;

    const items: AdminStorageInventoryItem[] = [];
    let scannedAtStr = '';

    querySnap.forEach(docSnap => {
      const data = docSnap.data();
      items.push({
        storagePath: data.storagePath,
        uid: data.uid,
        category: data.category,
        size: data.size,
        contentType: data.contentType,
        updatedAt: data.updatedAt
      });
      if (data.scannedAt) {
        scannedAtStr = data.scannedAt;
      }
    });

    // 사용자 정보 불러오기
    const userProfilesMap = new Map<string, { email?: string; displayName?: string }>();
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        userProfilesMap.set(docSnap.id, {
          email: data.email,
          displayName: data.displayName
        });
      });
    } catch (err) {}

    const userSummariesMap = new Map<string, AdminUserStorageInventorySummary>();

    let totalBytes = 0;
    let studentPhotoCount = 0;
    let studentPhotoBytes = 0;
    let lessonJournalPhotoCount = 0;
    let lessonJournalPhotoBytes = 0;
    let repertoireFileCount = 0;
    let repertoireFileBytes = 0;
    let unknownFileCount = 0;
    let unknownFileBytes = 0;

    for (const item of items) {
      const { uid, category, size } = item;
      
      if (!userSummariesMap.has(uid)) {
        const profile = userProfilesMap.get(uid);
        userSummariesMap.set(uid, {
          uid,
          email: profile?.email,
          displayName: profile?.displayName,
          studentPhotos: { count: 0, totalBytes: 0 },
          lessonJournalPhotos: { count: 0, totalBytes: 0 },
          repertoireFiles: { count: 0, totalBytes: 0 },
          unknownFiles: { count: 0, totalBytes: 0 },
          total: { count: 0, totalBytes: 0 }
        });
      }

      const uSum = userSummariesMap.get(uid)!;
      
      if (category === 'studentPhoto') {
        uSum.studentPhotos.count += 1;
        uSum.studentPhotos.totalBytes += size;
        studentPhotoCount += 1;
        studentPhotoBytes += size;
      } else if (category === 'lessonJournalPhoto') {
        uSum.lessonJournalPhotos.count += 1;
        uSum.lessonJournalPhotos.totalBytes += size;
        lessonJournalPhotoCount += 1;
        lessonJournalPhotoBytes += size;
      } else if (category === 'repertoireFile') {
        uSum.repertoireFiles.count += 1;
        uSum.repertoireFiles.totalBytes += size;
        repertoireFileCount += 1;
        repertoireFileBytes += size;
      } else {
        uSum.unknownFiles.count += 1;
        uSum.unknownFiles.totalBytes += size;
        unknownFileCount += 1;
        unknownFileBytes += size;
      }

      uSum.total.count += 1;
      uSum.total.totalBytes += size;
      totalBytes += size;
    }

    const usersList = Array.from(userSummariesMap.values()).sort(
      (a, b) => b.total.totalBytes - a.total.totalBytes
    );

    return {
      users: usersList,
      totals: {
        userCount: usersList.length,
        fileCount: items.length,
        totalBytes,
        studentPhotoCount,
        studentPhotoBytes,
        lessonJournalPhotoCount,
        lessonJournalPhotoBytes,
        repertoireFileCount,
        repertoireFileBytes,
        unknownFileCount,
        unknownFileBytes
      },
      scannedAt: scannedAtStr || new Date().toLocaleString()
    };
  } catch (err) {
    console.warn('Failed to reconstruct cached inventory summary:', err);
    return null;
  }
}
