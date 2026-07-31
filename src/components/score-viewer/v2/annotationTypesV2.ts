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

export type AnnotationInteractionModeV2 = 'navigate' | 'pen' | 'eraser';
export type AnnotationDrawingPointerTypeV2 = 'mouse' | 'pen' | 'touch';

export type AnnotationStrokeToolV2 = 'pen' | 'highlighter';

export interface AnnotationStrokeStyleV2 {
  color: string;
  width: number;
  opacity: number;
}

export const ANNOTATION_DEFAULT_PEN_STYLE_V2: AnnotationStrokeStyleV2 = {
  color: '#ef4444',
  width: 3,
  opacity: 1
};

export interface AnnotationStrokeDraftV2 {
  documentInstanceId: number;
  pageNumber: number;
  tool: AnnotationStrokeToolV2;
  style: AnnotationStrokeStyleV2;
  pointerType: AnnotationDrawingPointerTypeV2;
  points: AnnotationNormalizedPointV2[];
}

export interface AnnotationCompletedStrokeV2 {
  id: string;
  documentInstanceId: number;
  pageNumber: number;
  tool: AnnotationStrokeToolV2;
  style: AnnotationStrokeStyleV2;
  pointerType: AnnotationDrawingPointerTypeV2;
  points: AnnotationNormalizedPointV2[];
}

export interface AnnotationEraseRequestV2 {
  documentInstanceId: number;
  pageNumber: number;
  pointerType: AnnotationDrawingPointerTypeV2;
  strokeIds: string[];
}

export interface AnnotationInputStatusV2 {
  phase: 'idle' | 'drawing' | 'erasing';
  activePointerId: number | null;
  activePointerType: AnnotationDrawingPointerTypeV2 | null;
  currentPointCount: number;
  touchSuppressedUntilRelease: boolean;
}
