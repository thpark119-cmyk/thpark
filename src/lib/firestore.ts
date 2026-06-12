import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  serverTimestamp,
  FirestoreError
} from 'firebase/firestore';
import { db, auth } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Memory registry to trigger snapshot-like updates for LocalStorage fallback
const listenersRegistry = new Map<string, Set<(data: any[]) => void>>();

function triggerLocalListeners(collectionName: string) {
  const listeners = listenersRegistry.get(collectionName);
  if (listeners) {
    const dataStr = localStorage.getItem(`local_${collectionName}`) || '[]';
    try {
      const data = JSON.parse(dataStr);
      const sorted = [...data].sort((a: any, b: any) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          const dateVal = val.createdAt;
          if (!dateVal) return 0;
          return new Date(dateVal).getTime() || 0;
        };
        return getTime(b) - getTime(a);
      });
      listeners.forEach(cb => cb(sorted));
    } catch (e) {
      console.error("Local Storage parse error during trigger:", e);
    }
  }
}

// Reusable hook-like listeners
export function subscribeToCollection<T>(
  collectionName: string, 
  callback: (data: T[]) => void,
  user?: any
) {
  const targetUser = user || null;

  // If user is not logged in, gracefully fallback to LocalStorage mock database
  if (!targetUser) {
    if (!listenersRegistry.has(collectionName)) {
      listenersRegistry.set(collectionName, new Set());
    }
    listenersRegistry.get(collectionName)!.add(callback);

    // Initial broadcast
    const dataStr = localStorage.getItem(`local_${collectionName}`) || '[]';
    try {
      const data = JSON.parse(dataStr);
      const sorted = [...data].sort((a: any, b: any) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          const dateVal = val.createdAt;
          if (!dateVal) return 0;
          return new Date(dateVal).getTime() || 0;
        };
        return getTime(b) - getTime(a);
      });
      callback(sorted as T[]);
    } catch (_) {
      callback([] as T[]);
    }

    return () => {
      const listeners = listenersRegistry.get(collectionName);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          listenersRegistry.delete(collectionName);
        }
      }
    };
  }

  // Use subcollection: users/{uid}/{collectionName}
  const collPath = `users/${targetUser.uid}/${collectionName}`;
  const q = query(collection(db, collPath));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    
    // Sort on client side to avoid missing index errors (403 Forbidden)
    const sortedData = [...data].sort((a: any, b: any) => {
      const getTime = (val: any) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val === 'number') return val;
        return new Date(val).getTime() || 0;
      };
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
    
    callback(sortedData);
  }, (error) => {
    // Only handle if it's not a cancelled listener
    if (error.code !== ('cancelled' as any)) {
      handleFirestoreError(error, OperationType.GET, collPath);
    }
  });
}

export async function addRecord(collectionName: string, data: any, user?: any) {
  const targetUser = user || null;

  if (!targetUser) {
    const key = `local_${collectionName}`;
    const existingStr = localStorage.getItem(key) || '[]';
    let items = [];
    try {
      items = JSON.parse(existingStr);
    } catch (_) {}

    const newItem = {
      ...data,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };

    items.push(newItem);
    localStorage.setItem(key, JSON.stringify(items));
    triggerLocalListeners(collectionName);
    return newItem.id;
  }

  const collPath = `users/${targetUser.uid}/${collectionName}`;
  try {
    const docRef = await addDoc(collection(db, collPath), {
      ...data,
      userId: targetUser.uid,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collPath);
  }
}

export async function updateRecord(collectionName: string, id: string, data: any, user?: any) {
  const targetUser = user || null;

  if (!targetUser || id.startsWith('local_')) {
    const key = `local_${collectionName}`;
    const existingStr = localStorage.getItem(key) || '[]';
    let items: any[] = [];
    try {
      items = JSON.parse(existingStr);
    } catch (_) {}

    const idx = items.findIndex(item => item.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(items));
      triggerLocalListeners(collectionName);
    }
    return;
  }

  const collPath = `users/${targetUser.uid}/${collectionName}`;
  try {
    const docRef = doc(db, collPath, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collPath}/${id}`);
  }
}

export async function deleteRecord(collectionName: string, id: string, user?: any) {
  const targetUser = user || null;

  if (!targetUser || id.startsWith('local_')) {
    const key = `local_${collectionName}`;
    const existingStr = localStorage.getItem(key) || '[]';
    let items: any[] = [];
    try {
      items = JSON.parse(existingStr);
    } catch (_) {}

    const filtered = items.filter(item => item.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    triggerLocalListeners(collectionName);
    return;
  }

  const collPath = `users/${targetUser.uid}/${collectionName}`;
  try {
    const docRef = doc(db, collPath, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collPath}/${id}`);
  }
}
