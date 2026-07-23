const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

const newEnd = `    if (currentStroke) {
      drawStroke(currentStroke);
    }

    if (zoomRenderRequestId !== undefined && zoomRenderRequestId !== null && document.body.contains(canvas)) {
      onAnnotationRenderReady?.(zoomRenderRequestId, renderedZoomScale);
    }
  }, [width, height, strokes, currentStroke, eraserPreviewStrokes, zoomRenderRequestId, renderedZoomScale, onAnnotationRenderReady]);`;

code = code.replace(/    if \(currentStroke\) \{\n      drawStroke\(currentStroke\);\n    \}\n  \}, \[width, height, strokes, currentStroke, eraserPreviewStrokes\]\);\n/m, newEnd + '\n');

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
