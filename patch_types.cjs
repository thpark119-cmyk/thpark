const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/gestureTypes.ts', 'utf8');

const endEventOld = `  reason: GestureEndReasonV2;
  previousPhase: GesturePhaseV2;
  hadPinch: boolean;
  transform: GestureTransformV2;`;
const endEventNew = `  reason: GestureEndReasonV2;
  previousPhase: GesturePhaseV2;
  hadPinch: boolean;
  lastPinchViewportX: number | null;
  lastPinchViewportY: number | null;
  transform: GestureTransformV2;`;

const snapshotOld = `  transformRevision: number;
  originX: number;
  originY: number;
  transform: GestureTransformV2;`;
const snapshotNew = `  transformRevision: number;
  originX: number;
  originY: number;
  anchorViewportX: number;
  anchorViewportY: number;
  anchorLocalX: number;
  anchorLocalY: number;
  transform: GestureTransformV2;`;

const prepareOld = `  prepareScaleHandoff(): GestureScaleHandoffSnapshotV2 | null;`;
const prepareNew = `  prepareScaleHandoff(anchorViewportX?: number, anchorViewportY?: number): GestureScaleHandoffSnapshotV2 | null;`;

content = content.replace(endEventOld, endEventNew);
content = content.replace(snapshotOld, snapshotNew);
content = content.replace(prepareOld, prepareNew);

fs.writeFileSync('src/components/score-viewer/v2/gestureTypes.ts', content);
