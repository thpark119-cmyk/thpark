import type {
  AnnotationNormalizedPointV2,
  AnnotationLogicalPointV2,
  AnnotationPageSpaceV2,
  AnnotationClientRectV2
} from './annotationTypesV2';

export function isValidAnnotationPageSpaceV2(
  pageSpace: AnnotationPageSpaceV2
): boolean {
  return (
    Number.isFinite(pageSpace.documentInstanceId) &&
    Number.isFinite(pageSpace.pageNumber) &&
    pageSpace.pageNumber >= 1 &&
    Number.isFinite(pageSpace.logicalWidth) &&
    pageSpace.logicalWidth > 0 &&
    Number.isFinite(pageSpace.logicalHeight) &&
    pageSpace.logicalHeight > 0
  );
}

export function clampAnnotationNormalizedPointV2(
  point: AnnotationNormalizedPointV2
): AnnotationNormalizedPointV2 {
  const x = Number.isFinite(point.x) ? Math.max(0, Math.min(1, point.x)) : 0;
  const y = Number.isFinite(point.y) ? Math.max(0, Math.min(1, point.y)) : 0;
  return { x, y };
}

export function annotationNormalizedToLogicalV2(
  point: AnnotationNormalizedPointV2,
  pageSpace: AnnotationPageSpaceV2
): AnnotationLogicalPointV2 | null {
  if (!isValidAnnotationPageSpaceV2(pageSpace)) {
    return null;
  }
  const clamped = clampAnnotationNormalizedPointV2(point);
  return {
    x: clamped.x * pageSpace.logicalWidth,
    y: clamped.y * pageSpace.logicalHeight
  };
}

export function annotationClientToNormalizedV2(
  clientPoint: AnnotationLogicalPointV2,
  rect: AnnotationClientRectV2
): AnnotationNormalizedPointV2 | null {
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }

  const rawX = (clientPoint.x - rect.left) / rect.width;
  const rawY = (clientPoint.y - rect.top) / rect.height;

  return clampAnnotationNormalizedPointV2({ x: rawX, y: rawY });
}
