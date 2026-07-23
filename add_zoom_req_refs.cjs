const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const refsStr = `
  const zoomRenderRequestIdRef = useRef(0);
  const activeZoomRenderRequestRef = useRef<ZoomRenderRequest | null>(null);
`;

code = code.replace(/  const pendingZoomAnchorRef = useRef<PendingZoomAnchor \| null>\(null\);/, refsStr + '\n  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null);');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
