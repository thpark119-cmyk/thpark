export type ScoreAnnotationTool =
  | 'pen'
  | 'highlighter'
  | 'eraser';

export type ScoreAnnotationPoint = {
  x: number;
  y: number;
  pressure?: number;
};

export type ScoreAnnotationStroke = {
  id: string;
  tool: ScoreAnnotationTool;
  color: string;
  width: number;
  opacity: number;
  points: ScoreAnnotationPoint[];
  createdAt: string;
};

export type ScorePageAnnotation = {
  pageNumber: number;
  strokes: ScoreAnnotationStroke[];
};

export type ScoreAnnotationDocument = {
  schemaVersion: 1;
  repertoireId: string;
  fileId: string;
  sourceStoragePath: string;
  pages: Record<string, ScorePageAnnotation>;
  createdAt: string;
  updatedAt: string;
};
