import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { ref, getMetadata } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export type BackfillScanCandidate = {
  id: string;
  uid: string;
  category: 'studentPhoto' | 'lessonJournalPhoto' | 'repertoireFile';
  sourceDocPath: string;
  storagePath: string;
  existingSize?: number;
  existingContentType?: string;
  reason: 'missing-size' | 'zero-size' | 'missing-content-type' | 'invalid-size';
};

export type BackfillScanResult = {
  candidate: BackfillScanCandidate;
  status: 'metadata-found' | 'not-found' | 'permission-denied' | 'missing-storage-path' | 'error';
  storageSize?: number;
  storageContentType?: string;
  storageUpdatedAt?: string;
  errorCode?: string;
};

// 스캔 대상 후보를 판단하는 헬퍼 함수
function isCandidate(size: any, contentType: any): { isTarget: boolean; reason?: BackfillScanCandidate['reason'] } {
  if (typeof size !== 'number') {
    return { isTarget: true, reason: 'invalid-size' };
  }
  if (!size) {
    return { isTarget: true, reason: 'missing-size' };
  }
  if (size === 0) {
    return { isTarget: true, reason: 'zero-size' };
  }
  if (!contentType || contentType.trim() === '') {
    return { isTarget: true, reason: 'missing-content-type' };
  }
  return { isTarget: false };
}

export async function scanMetadataCandidates(): Promise<BackfillScanCandidate[]> {
  if (!db) {
    throw new Error('Database connection is not available.');
  }

  const candidates: BackfillScanCandidate[] = [];

  // 1. 학생관리 사진 스캔 (users/{uid}/students)
  try {
    const studentsSnap = await getDocs(collectionGroup(db, 'students'));
    studentsSnap.forEach((docSnap) => {
      const userDocRef = docSnap.ref.parent?.parent;
      const uid = userDocRef?.id;
      if (!uid || userDocRef?.parent?.id !== 'users') return;

      const data = docSnap.data();
      if (data.lessons && Array.isArray(data.lessons)) {
        data.lessons.forEach((lesson: any, lessonIdx: number) => {
          if (lesson.photos && Array.isArray(lesson.photos)) {
            lesson.photos.forEach((photo: any, photoIdx: number) => {
              if (photo.storagePath) {
                const { isTarget, reason } = isCandidate(photo.size, photo.contentType);
                if (isTarget && reason) {
                  candidates.push({
                    id: photo.id || `student-${docSnap.id}-${lessonIdx}-${photoIdx}`,
                    uid,
                    category: 'studentPhoto',
                    sourceDocPath: `users/${uid}/students/${docSnap.id}`,
                    storagePath: photo.storagePath,
                    existingSize: photo.size,
                    existingContentType: photo.contentType,
                    reason
                  });
                }
              }
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn('Failed to query students for metadata candidates scan:', err);
  }

  // 2. 레슨일지 사진 스캔 (users/{uid}/received_lessons)
  try {
    const lessonsSnap = await getDocs(collectionGroup(db, 'received_lessons'));
    lessonsSnap.forEach((docSnap) => {
      const userDocRef = docSnap.ref.parent?.parent;
      const uid = userDocRef?.id;
      if (!uid || userDocRef?.parent?.id !== 'users') return;

      const data = docSnap.data();
      if (data.photos && Array.isArray(data.photos)) {
        data.photos.forEach((photo: any, photoIdx: number) => {
          if (photo.storagePath) {
            const { isTarget, reason } = isCandidate(photo.size, photo.contentType);
            if (isTarget && reason) {
              candidates.push({
                id: photo.id || `lesson-${docSnap.id}-${photoIdx}`,
                uid,
                category: 'lessonJournalPhoto',
                sourceDocPath: `users/${uid}/received_lessons/${docSnap.id}`,
                storagePath: photo.storagePath,
                existingSize: photo.size,
                existingContentType: photo.contentType,
                reason
              });
            }
          }
        });
      }
    });
  } catch (err) {
    console.warn('Failed to query received_lessons for metadata candidates scan:', err);
  }

  // 3. 악보함 파일 스캔 (users/{uid}/repertoire)
  try {
    const repertoireSnap = await getDocs(collectionGroup(db, 'repertoire'));
    repertoireSnap.forEach((docSnap) => {
      const userDocRef = docSnap.ref.parent?.parent;
      const uid = userDocRef?.id;
      if (!uid || userDocRef?.parent?.id !== 'users') return;

      const data = docSnap.data();
      // 다중 파일 구조
      if (data.files && Array.isArray(data.files)) {
        data.files.forEach((file: any, fileIdx: number) => {
          if (file.storagePath) {
            const { isTarget, reason } = isCandidate(file.size, file.contentType);
            if (isTarget && reason) {
              candidates.push({
                id: file.id || `repertoire-file-${docSnap.id}-${fileIdx}`,
                uid,
                category: 'repertoireFile',
                sourceDocPath: `users/${uid}/repertoire/${docSnap.id}`,
                storagePath: file.storagePath,
                existingSize: file.size,
                existingContentType: file.contentType,
                reason
              });
            }
          }
        });
      }
      // 레거시 단일 파일 구조
      if (data.storagePath) {
        const { isTarget, reason } = isCandidate(data.fileSize, data.contentType);
        if (isTarget && reason) {
          candidates.push({
            id: `repertoire-legacy-${docSnap.id}`,
            uid,
            category: 'repertoireFile',
            sourceDocPath: `users/${uid}/repertoire/${docSnap.id}`,
            storagePath: data.storagePath,
            existingSize: data.fileSize,
            existingContentType: data.contentType,
            reason
          });
        }
      }
    });
  } catch (err) {
    console.warn('Failed to query repertoire for metadata candidates scan:', err);
  }

  return candidates;
}

export async function checkStorageMetadata(candidate: BackfillScanCandidate): Promise<BackfillScanResult> {
  if (!storage) {
    return {
      candidate,
      status: 'error',
      errorCode: 'storage-unavailable'
    };
  }

  if (!candidate.storagePath) {
    return {
      candidate,
      status: 'missing-storage-path'
    };
  }

  try {
    const fileRef = ref(storage, candidate.storagePath);
    const metadata = await getMetadata(fileRef);
    return {
      candidate,
      status: 'metadata-found',
      storageSize: metadata.size,
      storageContentType: metadata.contentType,
      storageUpdatedAt: metadata.updated ? new Date(metadata.updated).toLocaleString() : undefined
    };
  } catch (err: any) {
    const errorCode = err?.code || '';
    if (errorCode === 'storage/object-not-found') {
      return {
        candidate,
        status: 'not-found',
        errorCode
      };
    } else if (errorCode === 'storage/unauthorized') {
      return {
        candidate,
        status: 'permission-denied',
        errorCode
      };
    } else {
      return {
        candidate,
        status: 'error',
        errorCode: errorCode || err?.message || 'unknown-error'
      };
    }
  }
}
