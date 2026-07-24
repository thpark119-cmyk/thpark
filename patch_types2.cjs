const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/gestureTypes.ts', 'utf8');

const endEventOld = `  lastPinchViewportY: number | null;
  transform: GestureTransformV2;`;
const endEventNew = `  lastPinchViewportY: number | null;
  transformRevision: number;
  transform: GestureTransformV2;`;

content = content.replace(endEventOld, endEventNew);
fs.writeFileSync('src/components/score-viewer/v2/gestureTypes.ts', content);
