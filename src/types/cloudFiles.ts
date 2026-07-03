export type CloudFileSource = 'firebase-storage';

export type CloudLessonPhoto = {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
  uploadedAt: string;
  source: CloudFileSource;
  originalLocalPhotoId?: string;
  migratedFrom?: 'indexeddb';
};

export type CloudScoreFile = {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  uploadedAt: string;
  source: CloudFileSource;
};
