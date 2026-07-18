const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const additionalTypes = `
interface ScoreTouchPoint {
  clientX: number;
  clientY: number;
}

interface ScoreSingleTouchPan {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
}

interface ScorePinchSession {
  startDistance: number;
  startZoomScale: number;
  lastMidpointX: number;
  lastMidpointY: number;
  latestZoomScale: number;
}

interface PendingZoomAnchor {
  xRatio: number;
  yRatio: number;
  viewportOffsetX: number;
  viewportOffsetY: number;
}

function getTouchDistance(first: ScoreTouchPoint, second: ScoreTouchPoint): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function getTouchMidpoint(first: ScoreTouchPoint, second: ScoreTouchPoint): { x: number; y: number } {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

function getFirstTwoTouchPoints(pointers: Map<number, ScoreTouchPoint>): [ScoreTouchPoint, ScoreTouchPoint] | null {
  const points = Array.from(pointers.values());
  if (points.length < 2) {
    return null;
  }
  return [points[0], points[1]];
}

function normalizeZoomScale(value: number): number {
  const clamped = clampZoomScale(value);
  if (Math.abs(clamped - MIN_ZOOM_SCALE) < 0.015) {
    return MIN_ZOOM_SCALE;
  }
  if (Math.abs(clamped - MAX_ZOOM_SCALE) < 0.015) {
    return MAX_ZOOM_SCALE;
  }
  return Math.round(clamped * 100) / 100;
}
`;

content = content.replace(
  'function clampZoomScale(value: number): number {\n  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));\n}',
  'function clampZoomScale(value: number): number {\n  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));\n}\n' + additionalTypes
);

// Remove the inline PendingZoomAnchor
content = content.replace(
  '  interface PendingZoomAnchor {\n\n    xRatio: number;\n    yRatio: number;\n  }',
  ''
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('Patch 1 done');
