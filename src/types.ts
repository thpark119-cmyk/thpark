export interface ReceivedLesson {
  id: string;
  userId: string;
  date: string;
  teacher: string;
  topic: string;
  feedback: string;
  nextExercises: string;
  createdAt?: number;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  level: string;
  currentPiece: string;
  createdAt?: number;
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
  createdAt?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
