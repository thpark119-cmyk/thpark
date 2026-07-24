const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/gestureTypes.ts', 'utf8');

const transformEvent = `
export interface GestureTransformEventV2 {
  phase: GesturePhaseV2;
  transform: GestureTransformV2;
  activePointerCount: number;
  pointerMoveCount: number;
  appliedFrameCount: number;
  maxFrameGapMs: number;
  sessionId: number | null;
  transformRevision: number;
}
`;
content = content.replace(/export interface GestureTransformEventV2 \{[\s\S]*?\}/, transformEvent.trim());

const activeRebase = `
export interface GestureActiveSessionRebaseV2 {
  phase: GesturePhaseV2;
  activePointerCount: number;
  panRebased: boolean;
  pinchRebased: boolean;
  rebaseRevision: number;
}
`;
content = content.replace("export interface GestureScaleHandoffResultV2 {", activeRebase + "\nexport interface GestureScaleHandoffResultV2 {");

const resultAdd = `
  nextOriginY: number;
  completedAt: number;
  activeSessionRebase: GestureActiveSessionRebaseV2;
`;
content = content.replace(/  nextOriginY: number;\n  completedAt: number;\n/, resultAdd);

fs.writeFileSync('src/components/score-viewer/v2/gestureTypes.ts', content);
