const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(
  `interface ActivePinchSnapshot {
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  requestId: number | null;
  requestedScale: number | null;
}`,
  `interface ActivePinchSnapshot {
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  requestId: number | null;
  requestedScale: number | null;
  generation: number;
  pageNumber: number;
  fileId: string;
  storagePath: string;
}`
);

code = code.replace(
  `const PINCH_SNAPSHOT_MAX_DPR = 1.5;`,
  `const PINCH_SNAPSHOT_MAX_DPR = 1.5;
const PINCH_SNAPSHOT_READY_TOLERANCE_PX = 3;
const PINCH_SNAPSHOT_STABLE_FRAMES = 2;
const PINCH_SNAPSHOT_MAX_READY_FRAMES = 30;`
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
