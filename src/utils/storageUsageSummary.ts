import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAllLocalPhotos } from './localPhotoStorage';

export type StorageUsageSummary = {
  cloud: {
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
  local: {
    indexedDbPhotos: {
      count: number;
    };
    localStorageRecords: {
      receivedLessons: number;
      students: number;
      repertoire: number;
    };
  };
};

export async function getStorageUsageSummary(user: any): Promise<StorageUsageSummary> {
  const summary: StorageUsageSummary = {
    cloud: {
      studentPhotos: { count: 0, totalBytes: 0 },
      lessonJournalPhotos: { count: 0, totalBytes: 0 },
      repertoireFiles: { count: 0, totalBytes: 0 },
      total: { count: 0, totalBytes: 0 }
    },
    local: {
      indexedDbPhotos: { count: 0 },
      localStorageRecords: {
        receivedLessons: 0,
        students: 0,
        repertoire: 0
      }
    }
  };

  // 1. Local Storage fallback data
  try {
    const localLessonsStr = localStorage.getItem('local_received_lessons') || '[]';
    summary.local.localStorageRecords.receivedLessons = JSON.parse(localLessonsStr).length;
  } catch (_) {}

  try {
    const localStudentsStr = localStorage.getItem('local_students') || '[]';
    summary.local.localStorageRecords.students = JSON.parse(localStudentsStr).length;
  } catch (_) {}

  try {
    const localRepertoireStr = localStorage.getItem('local_repertoire') || '[]';
    summary.local.localStorageRecords.repertoire = JSON.parse(localRepertoireStr).length;
  } catch (_) {}

  // 2. IndexedDB local photos
  try {
    const localPhotos = await getAllLocalPhotos();
    summary.local.indexedDbPhotos.count = localPhotos.length;
  } catch (_) {}

  // 3. Cloud Storage metadata calculation (if user logged in & db is available)
  if (user && db) {
    const uid = user.uid;

    // Student Photos
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
                  summary.cloud.studentPhotos.count += 1;
                  summary.cloud.studentPhotos.totalBytes += (photo.size || 0);
                }
              });
            }
          });
        }
      });
    } catch (e) {
      console.error('Failed to calculate cloud studentPhotos storage usage', e);
      throw e;
    }

    // Lesson Journal Photos
    try {
      const receivedLessonsRef = collection(db, `users/${uid}/received_lessons`);
      const receivedLessonsSnap = await getDocs(receivedLessonsRef);
      receivedLessonsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.photos && Array.isArray(data.photos)) {
          data.photos.forEach((photo: any) => {
            if (photo.storagePath) {
              summary.cloud.lessonJournalPhotos.count += 1;
              summary.cloud.lessonJournalPhotos.totalBytes += (photo.size || 0);
            }
          });
        }
      });
    } catch (e) {
      console.error('Failed to calculate cloud lessonJournalPhotos storage usage', e);
      throw e;
    }

    // Repertoire Files (including legacy size)
    try {
      const repertoireRef = collection(db, `users/${uid}/repertoire`);
      const repertoireSnap = await getDocs(repertoireRef);
      repertoireSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.files && Array.isArray(data.files)) {
          data.files.forEach((file: any) => {
            if (file.storagePath) {
              summary.cloud.repertoireFiles.count += 1;
              summary.cloud.repertoireFiles.totalBytes += (file.size || 0);
            }
          });
        }
        // Legacy single file in item
        if (data.storagePath) {
          summary.cloud.repertoireFiles.count += 1;
          summary.cloud.repertoireFiles.totalBytes += (data.fileSize || 0);
        }
      });
    } catch (e) {
      console.error('Failed to calculate cloud repertoireFiles storage usage', e);
      throw e;
    }

    // Sum cloud totals
    summary.cloud.total.count = 
      summary.cloud.studentPhotos.count + 
      summary.cloud.lessonJournalPhotos.count + 
      summary.cloud.repertoireFiles.count;
    
    summary.cloud.total.totalBytes = 
      summary.cloud.studentPhotos.totalBytes + 
      summary.cloud.lessonJournalPhotos.totalBytes + 
      summary.cloud.repertoireFiles.totalBytes;
  }

  return summary;
}
