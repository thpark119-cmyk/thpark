import { uploadFileToStorage, getFileDownloadUrl, deleteFileFromStorage } from './cloudStorage';
import { buildScoreAnnotationStoragePath } from './storagePaths';
import { ScoreAnnotationDocument } from '../components/score-viewer/annotationTypes';

export async function loadScoreAnnotations(
  uid: string,
  repertoireId: string,
  fileId: string
): Promise<ScoreAnnotationDocument | null> {
  try {
    const storagePath = buildScoreAnnotationStoragePath({ uid, repertoireId, fileId });
    const downloadUrl = await getFileDownloadUrl(storagePath);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch annotations: ${response.statusText}`);
    }
    const data = await response.json();
    return data as ScoreAnnotationDocument;
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found' || error?.message?.includes('object-not-found')) {
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
