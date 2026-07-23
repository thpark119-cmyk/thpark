const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/interface ZoomRenderRequest \{[\s\S]*?annotationReadyAt: number \| null;\n\}/m, `interface ZoomRenderRequest {
  requestId: number;
  requestedScale: number;
  startedAt: number;
  pdfReadyAt: number | null;
  annotationReadyAt: number | null;
  usesPinchPreview: boolean;
  anchorRequestId: number | null;
  geometryReadyAt: number | null;
  handoffScheduled: boolean;
  previewClearedAt: number | null;
}`);
fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
