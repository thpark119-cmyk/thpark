import { AnnotationCompletedStrokeV2, AnnotationNormalizedPointV2, AnnotationPageSpaceV2 } from './annotationTypesV2';

export const ANNOTATION_ERASER_RADIUS_LOGICAL_V2 = 12;

function distSq(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function distToSegmentSq(
  p: { x: number, y: number },
  v: { x: number, y: number },
  w: { x: number, y: number }
): number {
  const l2 = distSq(v, w);
  if (l2 === 0) return distSq(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distSq(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  });
}

function normalizeToLogical(
  pt: AnnotationNormalizedPointV2,
  space: AnnotationPageSpaceV2
): { x: number, y: number } {
  return {
    x: pt.x * space.logicalWidth,
    y: pt.y * space.logicalHeight
  };
}

export function hitTestStrokesV2(
  strokes: AnnotationCompletedStrokeV2[],
  normalizedPoint: AnnotationNormalizedPointV2,
  space: AnnotationPageSpaceV2,
  radius: number = ANNOTATION_ERASER_RADIUS_LOGICAL_V2
): string[] {
  if (!space || space.logicalWidth <= 0 || space.logicalHeight <= 0) {
    return [];
  }

  const validRadius = (typeof radius === 'number' && isFinite(radius) && radius > 0) 
    ? radius 
    : ANNOTATION_ERASER_RADIUS_LOGICAL_V2;
    
  const radiusSq = validRadius * validRadius;
  const targetPt = normalizeToLogical(normalizedPoint, space);
  const hitIds: string[] = [];

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    
    if (stroke.documentInstanceId !== space.documentInstanceId || stroke.pageNumber !== space.pageNumber) {
      continue;
    }
    
    if (!stroke.points || stroke.points.length === 0) {
      continue;
    }

    let isHit = false;

    if (stroke.points.length === 1) {
      const p = normalizeToLogical(stroke.points[0], space);
      if (distSq(targetPt, p) <= radiusSq) {
        isHit = true;
      }
    } else {
      for (let j = 0; j < stroke.points.length - 1; j++) {
        const p1 = normalizeToLogical(stroke.points[j], space);
        const p2 = normalizeToLogical(stroke.points[j + 1], space);
        if (distToSegmentSq(targetPt, p1, p2) <= radiusSq) {
          isHit = true;
          break;
        }
      }
    }

    if (isHit) {
      hitIds.push(stroke.id);
    }
  }

  return hitIds;
}
