import { uploadFileToStorage, deleteFileFromStorage } from './cloudStorage';
import { buildScoreAnnotationStoragePath } from './storagePaths';
import { ScoreAnnotationDocument } from '../components/score-viewer/annotationTypes';
import { getBytes, ref } from 'firebase/storage';
import { storage } from '../lib/firebase';

export async function loadScoreAnnotations(
  uid: string,
  repertoireId: string,
  fileId: string
): Promise<ScoreAnnotationDocument | null> {
  const storagePath = buildScoreAnnotationStoragePath({ uid, repertoireId, fileId });

  try {
    if (!storage) {
      throw new Error('Firebase Storage is not initialized.');
    }

    const storageRef = ref(storage, storagePath);
    const arrayBuffer = await getBytes(storageRef);
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.byteLength === 0) {
      return null;
    }

    const jsonText = new TextDecoder('utf-8').decode(bytes);
    if (!jsonText.trim()) {
      return null;
    }

    const parsed = JSON.parse(jsonText);
    return parsed as ScoreAnnotationDocument;
  } catch (error: any) {
    const errorCode = String(error?.code || error?.message || '');

    if (errorCode.includes('storage/object-not-found')) {
      return null;
    }

    throw error;
  }
}

export async function saveScoreAnnotations(
  uid: string,
  repertoireId: string,
  fileId: string,
  document: ScoreAnnotationDocument
): Promise<void> {
  const storagePath = buildScoreAnnotationStoragePath({ uid, repertoireId, fileId });
  const blob = new Blob([JSON.stringify(document)], { type: 'application/json' });
  
  await uploadFileToStorage({
    file: blob,
    storagePath,
    contentType: 'application/json'
  });
}

export async function deleteScoreAnnotations(
  uid: string,
  repertoireId: string,
  fileId: string
): Promise<void> {
  const storagePath = buildScoreAnnotationStoragePath({ uid, repertoireId, fileId });
  try {
    await deleteFileFromStorage(storagePath);
  } catch (error) {
    console.error('Failed to delete score annotations', error);
  }
}
