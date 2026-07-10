export function buildScoreAnnotationStoragePath(params: {
  uid: string;
  repertoireId: string;
  fileId: string;
}): string {
  const { uid, repertoireId, fileId } = params;
  if (!uid || !repertoireId || !fileId) {
    throw new Error('Missing required parameters for building score annotation storage path.');
  }
  return `users/${uid}/repertoire/${repertoireId}/annotations/${fileId}/current.json`;
}

export function buildLessonPhotoStoragePath(params: {
  uid: string;
  studentId: string;
  lessonId: string;
  photoId: string;
  ext?: string;
}): string {
  const { uid, studentId, lessonId, photoId, ext } = params;
  if (!uid || !studentId || !lessonId || !photoId) {
    throw new Error('Missing required parameters for building lesson photo storage path.');
  }
  const extension = ext ? `.${ext.replace(/^\./, '')}` : '';
  return `users/${uid}/students/${studentId}/lessons/${lessonId}/photos/${photoId}${extension}`;
}

export function buildScoreFileStoragePath(params: {
  uid: string;
  repertoireId: string;
  fileId: string;
  ext: string;
}): string {
  const { uid, repertoireId, fileId, ext } = params;
  if (!uid || !repertoireId || !fileId || !ext) {
    throw new Error('Missing required parameters for building score file storage path.');
  }
  const extension = ext ? `.${ext.replace(/^\./, '')}` : '';
  return `users/${uid}/repertoire/${repertoireId}/files/${fileId}${extension}`;
}

export function buildLessonJournalPhotoStoragePath(params: {
  uid: string;
  teacherId?: string;
  lessonId: string;
  photoId: string;
  ext?: string;
}): string {
  const { uid, teacherId, lessonId, photoId, ext } = params;
  if (!uid || !lessonId || !photoId) {
    throw new Error('Missing required parameters for building lesson journal photo storage path.');
  }
  const extension = ext ? `.${ext.replace(/^\./, '')}` : '';
  const finalTeacherId = teacherId && teacherId.trim() !== '' ? teacherId : 'uncategorized';
  return `users/${uid}/lesson-journal/teachers/${finalTeacherId}/lessons/${lessonId}/photos/${photoId}${extension}`;
}
