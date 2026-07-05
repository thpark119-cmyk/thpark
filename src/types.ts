import { CloudLessonPhoto, CloudScoreFile } from './types/cloudFiles';

export interface LessonTeacher {
  id: string;
  userId: string;
  name: string;
  instrument?: string;
  memo?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ReceivedLesson {
  id: string;
  userId: string;
  date: string;
  teacher: string;
  teacherId?: string;
  teacherName?: string;
  topic: string;
  feedback: string;
  nextExercises: string;
  photos?: CloudLessonPhoto[];
  photoIds?: string[];
  createdAt?: number;
}

export interface StudentLessonEntry {
  id: string;
  date: string;
  content: string;
  homework?: string;
  nextGoal?: string;
  memo?: string;
  photoIds?: string[];
  photos?: CloudLessonPhoto[];
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  level: string;
  currentPiece: string;
  lessonDate?: string;
  instrument?: string;
  memo?: string;
  lessons?: StudentLessonEntry[];
  createdAt?: number;
  updatedAt?: number;
}

export interface TeachingLog {
  id: string;
  userId: string;
  studentId: string;
  date: string;
  topic: string;
  studentFeedback: string;
  homework: string;
  createdAt?: number;
}

export interface RepertoireItem {
  id: string;
  userId: string;
  composer: string;
  title: string;
  status: 'Learning' | 'Polishing' | 'Completed';
  sheetMusicUrl?: string;
  notes: string;
  files?: CloudScoreFile[];
  createdAt?: number;
  date?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  storagePath?: string;
  uploadedAt?: number;
}

export interface PracticeEntry {
  id: string;
  userId: string;
  date: string;
  practiceTime: number; // in minutes
  pieceTitle: string;
  composer?: string;
  goal?: string;
  focusArea?: string;
  whatWentWell?: string;
  problem?: string;
  nextAction?: string;
  memo?: string;
  mood?: 'good' | 'normal' | 'hard';
  createdAt?: number;
  updatedAt?: number;
}

export interface PracticeRoutineItem {
  id: string;
  label: string;
  minutes: number;
  memo?: string;
}

export interface PracticeRoutine {
  id: string;
  userId: string;
  title: string;
  description?: string;
  items: PracticeRoutineItem[];
  totalMinutes: number;
  tags?: string[];
  isFavorite?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  grounded?: boolean;
  sources?: AITutorSource[];
  warning?: string;
  webSearchUsed?: boolean;
}

export type MajorCategory =
  | 'strings'
  | 'winds'
  | 'voice'
  | 'keyboard'
  | 'percussion'
  | 'conducting'
  | 'composition-theory'
  | 'korean-traditional'
  | 'other';

export type MusicTutorProfile = {
  major: MajorCategory | '';
  specialty: string;
};

export type AITutorSource = {
  id: string;
  title: string;
  author?: string;
  expert?: string;
  organization?: string;
  year?: number;
  sourceType?: string;
  url?: string;
  pageNumber?: number;
  timestamp?: string;
  license?: string;
  provider?: 'file-search' | 'google-search';
};

export type UsageLimits = {
  dailyUsed: number;
  dailyLimit: number;
  remaining: number;
};
