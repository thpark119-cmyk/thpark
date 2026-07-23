const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/touchGestureSessionId=\{touchGestureSessionId\}\n                    zoomRenderRequestId=\{zoomRenderRequestId\}/m, `touchGestureSessionId={touchGestureSessionId}
                    zoomRenderRequestId={annotationGeometryRequestId}`);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
