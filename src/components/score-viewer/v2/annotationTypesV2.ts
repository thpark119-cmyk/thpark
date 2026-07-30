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
