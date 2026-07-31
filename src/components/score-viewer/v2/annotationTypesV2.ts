export interface AnnotationNormalizedPointV2 {
  x: number;
  y: number;
}

export interface AnnotationLogicalPointV2 {
  x: number;
  y: number;
}

export interface AnnotationPageSpaceV2 {
  documentInstanceId: number;
  pageNumber: number;
  logicalWidth: number;
  logicalHeight: number;
}

export interface AnnotationClientRectV2 {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type AnnotationInteractionModeV2 = 'navigate' | 'pen';
export type AnnotationDrawingPointerTypeV2 = 'mouse' | 'pen';

export interface AnnotationStrokeDraftV2 {
  documentInstanceId: number;
  pageNumber: number;
  pointerType: AnnotationDrawingPointerTypeV2;
  points: AnnotationNormalizedPointV2[];
}

export interface AnnotationCompletedStrokeV2 {
  id: string;
  documentInstanceId: number;
  pageNumber: number;
  tool: 'pen';
  pointerType: AnnotationDrawingPointerTypeV2;
  points: AnnotationNormalizedPointV2[];
}

export interface AnnotationInputStatusV2 {
  phase: 'idle' | 'drawing';
  activePointerId: number | null;
  activePointerType: string | null;
  currentPointCount: number;
}
