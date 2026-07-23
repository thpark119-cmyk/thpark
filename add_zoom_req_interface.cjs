const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const interfaceStr = `
interface ZoomRenderRequest {
  requestId: number;
  requestedScale: number;
  startedAt: number;
  pdfReadyAt: number | null;
  annotationReadyAt: number | null;
}
`;

code = code.replace(/interface PendingZoomAnchor \{/, interfaceStr + '\ninterface PendingZoomAnchor {');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
