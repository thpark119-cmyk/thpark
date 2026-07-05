import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAdminUser } from './admin';

export type AdminUserStorageSummary = {
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
  total: {
    count: number;
    totalBytes: number;
  };
};

export type AdminStorageSummary = {
  users: AdminUserStorageSummary[];
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
  };
  calculatedAt: string;
};

export async function getAdminStorageSummary(currentUser: any): Promise<AdminStorageSummary> {
  if (!db) {
    throw new Error('Database connection is not available.');
  }

  const isAdmin = isAdminUser(currentUser);
  if (!isAdmin) {
    throw new Error('Permission denied. Admin authorization is required.');
  }

  // Set of unique user IDs to calculate
  const uniqueUserIds = new Set<string>();
  const userProfilesMap = new Map<string, { email?: string; displayName?: string }>();

  let hasUsersCollectionPermission = true;

  // 1. Try to fetch from central users collection
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    usersSnap.forEach(docSnap => {
      const uid = docSnap.id;
      uniqueUserIds.add(uid);
      const data = docSnap.data();
      userProfilesMap.set(uid, {
        email: data.email,
        displayName: data.displayName
      });
    });
  } catch (error: any) {
    console.warn('Listing /users collection failed due to permission or rules. Trying legacy fallback...', error);
    hasUsersCollectionPermission = false;
  }

  // 2. Fallback: Query top-level legacy collections if we cannot list users collection
  // Since top level collections have "allow list: if isAdmin()" rules, this works perfectly for admins.
  if (!hasUsersCollectionPermission || uniqueUserIds.size === 0) {
    const legacyCollections = ['students', 'received_lessons', 'repertoire'];
    for (const colName of legacyCollections) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.userId) {
            uniqueUserIds.add(data.userId);
          }
        });
      } catch (err) {
        console.warn(`Failed to list legacy collection ${colName}:`, err);
      }
    }
  }

  // 3. Make sure we at least calculate the current administrator's storage if nothing else was found
  if (currentUser?.uid) {
    uniqueUserIds.add(currentUser.uid);
  }

  // 4. For each unique user, fetch user profiles if not already fetched
  for (const uid of uniqueUserIds) {
    if (!userProfilesMap.has(uid)) {
      try {
        const userDocSnap = await getDoc(doc(db, 'users', uid));
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          userProfilesMap.set(uid, {
            email: data.email,
            displayName: data.displayName
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch user profile for ${uid}:`, err);
      }
    }
  }

  const userSummaries: AdminUserStorageSummary[] = [];

  // 5. Query subcollections of each user to compute storage summary
  for (const uid of uniqueUserIds) {
    const userProfile = userProfilesMap.get(uid) || {};
    
    const userSummary: AdminUserStorageSummary = {
      uid,
      email: userProfile.email || '',
      displayName: userProfile.displayName || '',
      studentPhotos: { count: 0, totalBytes: 0 },
      lessonJournalPhotos: { count: 0, totalBytes: 0 },
      repertoireFiles: { count: 0, totalBytes: 0 },
      total: { count: 0, totalBytes: 0 }
    };

    // Calculate Student Photos
    try {
      const studentsRef = collection(db, `users/${uid}/students`);
      const studentsSnap = await getDocs(studentsRef);
      studentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.lessons && Array.isArray(data.lessons)) {
          data.lessons.forEach((lesson: any) => {
            if (lesson.photos && Array.isArray(lesson.photos)) {
              lesson.photos.forEach((photo: any) => {
                if (photo.storagePath) {
                  userSummary.studentPhotos.count += 1;
                  userSummary.studentPhotos.totalBytes += (photo.size || 0);
                }
              });
            }
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to calculate subcollection studentPhotos for user ${uid}`, e);
    }

    // Calculate Lesson Journal Photos
    try {
      const receivedLessonsRef = collection(db, `users/${uid}/received_lessons`);
      const receivedLessonsSnap = await getDocs(receivedLessonsRef);
      receivedLessonsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.photos && Array.isArray(data.photos)) {
          data.photos.forEach((photo: any) => {
            if (photo.storagePath) {
              userSummary.lessonJournalPhotos.count += 1;
              userSummary.lessonJournalPhotos.totalBytes += (photo.size || 0);
            }
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to calculate subcollection lessonJournalPhotos for user ${uid}`, e);
    }

    // Calculate Repertoire Files
    try {
      const repertoireRef = collection(db, `users/${uid}/repertoire`);
      const repertoireSnap = await getDocs(repertoireRef);
      repertoireSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.files && Array.isArray(data.files)) {
          data.files.forEach((file: any) => {
            if (file.storagePath) {
              userSummary.repertoireFiles.count += 1;
              userSummary.repertoireFiles.totalBytes += (file.size || 0);
            }
          });
        }
        // Legacy file in item
        if (data.storagePath) {
          userSummary.repertoireFiles.count += 1;
          userSummary.repertoireFiles.totalBytes += (data.fileSize || 0);
        }
      });
    } catch (e) {
      console.warn(`Failed to calculate subcollection repertoireFiles for user ${uid}`, e);
    }

    // Total of the user
    userSummary.total.count = 
      userSummary.studentPhotos.count + 
      userSummary.lessonJournalPhotos.count + 
      userSummary.repertoireFiles.count;
    
    userSummary.total.totalBytes = 
      userSummary.studentPhotos.totalBytes + 
      userSummary.lessonJournalPhotos.totalBytes + 
      userSummary.repertoireFiles.totalBytes;

    userSummaries.push(userSummary);
  }

  // 6. Aggregate totals
  const totals = {
    userCount: userSummaries.length,
    fileCount: 0,
    totalBytes: 0,
    studentPhotoCount: 0,
    studentPhotoBytes: 0,
    lessonJournalPhotoCount: 0,
    lessonJournalPhotoBytes: 0,
    repertoireFileCount: 0,
    repertoireFileBytes: 0
  };

  userSummaries.forEach(us => {
    totals.fileCount += us.total.count;
    totals.totalBytes += us.total.totalBytes;
    
    totals.studentPhotoCount += us.studentPhotos.count;
    totals.studentPhotoBytes += us.studentPhotos.totalBytes;
    
    totals.lessonJournalPhotoCount += us.lessonJournalPhotos.count;
    totals.lessonJournalPhotoBytes += us.lessonJournalPhotos.totalBytes;
    
    totals.repertoireFileCount += us.repertoireFiles.count;
    totals.repertoireFileBytes += us.repertoireFiles.totalBytes;
  });

  // If even our fallback couldn't get anything, throw a clean permission error
  if (!hasUsersCollectionPermission && uniqueUserIds.size <= 1 && totals.totalBytes === 0) {
    const errorDetails = {
      code: 'permission-denied',
      message: 'Firestore list users permission is missing in security rules.'
    };
    throw new Error(JSON.stringify(errorDetails));
  }

  return {
    users: userSummaries,
    totals,
    calculatedAt: new Date().toLocaleString()
  };
}
