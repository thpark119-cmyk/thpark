const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/  const activeZoomRenderRequestRef = useRef<ZoomRenderRequest \| null>\(null\);\n/m, `  const activeZoomRenderRequestRef = useRef<ZoomRenderRequest | null>(null);
  const zoomHandoffFirstFrameRef = useRef<number | null>(null);
  const zoomHandoffSecondFrameRef = useRef<number | null>(null);\n`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
