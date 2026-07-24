const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/v2/gestureTypes.ts', 'utf8');

// 7. GestureEndEventV2 확장
content = content.replace(
  'export interface GestureEndEventV2 {',
  'export interface GestureEndEventV2 {\n  sessionId: number;\n  endEventId: number;'
);

// 32. Handoff 결과 타입
content = content.replace(
  'export interface GestureScaleHandoffResultV2 {',
  'export interface GestureScaleHandoffResultV2 {\n  wasScaleClamped: boolean;\n  unclampedPreviewScale: number;\n  clampedPreviewScale: number;'
);

fs.writeFileSync('src/components/score-viewer/v2/gestureTypes.ts', content);
