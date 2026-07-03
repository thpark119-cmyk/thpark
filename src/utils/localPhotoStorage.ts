export type LocalLessonPhoto = {
  id: string;
  userId?: string;
  studentId: string;
  lessonId?: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  blob: Blob;
};

const DB_NAME = 'musicianlog_local_photos';
const STORE_NAME = 'lesson_photos';
const DB_VERSION = 1;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveLessonPhoto(photo: LocalLessonPhoto): Promise<void> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(photo);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getLessonPhoto(photoId: string): Promise<LocalLessonPhoto | undefined> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(photoId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteLessonPhoto(photoId: string): Promise<void> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(photoId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteLessonPhotos(photoIds: string[]): Promise<void> {
  if (!photoIds || photoIds.length === 0) return;
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let count = 0;
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    
    for (const id of photoIds) {
      store.delete(id);
    }
  });
}

export async function deleteAllPhotosForStudent(studentId: string): Promise<void> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.value.studentId === studentId) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
}

export async function getAllLocalPhotos(): Promise<LocalLessonPhoto[]> {
  if (!isIndexedDBAvailable()) return [];
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const photos: LocalLessonPhoto[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        photos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(photos);
      }
    };
  });
}
