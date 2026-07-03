import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';

export async function uploadFileToStorage(params: {
  file: Blob | File;
  storagePath: string;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{
  storagePath: string;
  size: number;
  contentType: string;
}> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }

  const storageRef = ref(storage, params.storagePath);
  
  const uploadMetadata = {
    contentType: params.contentType,
    customMetadata: params.metadata,
  };

  await uploadBytes(storageRef, params.file, uploadMetadata);
  
  return {
    storagePath: params.storagePath,
    size: params.file.size,
    contentType: params.contentType,
  };
}

export async function getFileDownloadUrl(storagePath: string): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }

  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
}

export async function deleteFileFromStorage(storagePath: string): Promise<void> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error(`Failed to delete file at ${storagePath}`, error);
    // Ignore error if file doesn't exist to prevent app from breaking
  }
}
