import type {
  ScoreAnnotationDocument,
  ScoreAnnotationPoint,
  ScoreAnnotationStroke,
  ScorePageAnnotation
} from '../annotationTypes';

import type {
  AnnotationDrawingPointerTypeV2,
  AnnotationStrokeToolV2
} from './annotationTypesV2';

export const MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2 = 1 as const;

export interface AnnotationPersistenceIdentityV2 {
  repertoireId: string;
  fileId: string;
  sourceStoragePath: string;
}

export type PersistedAnnotationPointV2 = ScoreAnnotationPoint;

export type PersistedAnnotationStrokeV2 = Omit<ScoreAnnotationStroke, 'tool' | 'points'> & {
  tool: AnnotationStrokeToolV2;
  points: PersistedAnnotationPointV2[];
  pointerType?: AnnotationDrawingPointerTypeV2;
};

export type PersistedAnnotationPageV2 = Omit<ScorePageAnnotation, 'strokes'> & {
  strokes: PersistedAnnotationStrokeV2[];
};

export type AnnotationPersistenceDocumentV2 = Omit<ScoreAnnotationDocument, 'pages'> & {
  schemaVersion: typeof MIO_SCORE_ANNOTATION_WIRE_SCHEMA_VERSION_V2;
  pages: Record<string, PersistedAnnotationPageV2>;
};
