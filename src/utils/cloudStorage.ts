import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

export async function getFileBytesFromStorage(
  storagePath: string,
): Promise<Uint8Array> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }

  if (
    typeof storagePath !== 'string' ||
    storagePath.trim().length === 0
  ) {
    throw new Error('Storage path is missing.');
  }

  const storageRef = ref(storage, storagePath);

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await getBytes(storageRef);
  } catch (error: any) {
    throw error;
  }

  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.byteLength === 0) {
    throw new Error('PDF_FILE_EMPTY');
  }

  const MAX_SCORE_PDF_BYTES = 15 * 1024 * 1024;
  if (bytes.byteLength > MAX_SCORE_PDF_BYTES) {
    const err = new Error('PDF_FILE_TOO_LARGE');
    (err as any).code = 'storage/download-size-exceeded';
    throw err;
  }

  return bytes;
}

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
  } catch (error: any) {
    console.error(`Failed to delete file at ${storagePath}`, error);
    
    // Ignore error only if file doesn't exist to prevent app from breaking
    const isObjectNotFound = error && (
      error.code === 'storage/object-not-found' || 
      (error.message && error.message.includes('storage/object-not-found'))
    );
    
    if (!isObjectNotFound) {
      throw error;
    }
  }
}
