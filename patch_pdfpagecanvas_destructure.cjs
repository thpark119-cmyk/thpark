const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/    touchGestureSessionId = 0,\n    onPageGeometryReady,\n  \} = props;\n/m, `    touchGestureSessionId = 0,
    zoomRenderRequestId,
    onPdfRenderReady,
    onAnnotationRenderReady,
    onPageGeometryReady,
  } = props;\n`);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
