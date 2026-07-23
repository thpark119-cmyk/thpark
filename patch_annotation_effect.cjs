const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

const newEffectEnd = `    if (currentStroke) {
      drawStroke(currentStroke);
    }

    if (
      zoomRenderRequestId !== undefined &&
      zoomRenderRequestId !== null &&
      document.body.contains(canvas) &&
      width >= 1 &&
      height >= 1 &&
      canvas.width > 0 &&
      canvas.height > 0 &&
      canvas.style.width !== '' &&
      canvas.style.height !== ''
    ) {
      const lastReported = lastReportedAnnotationReadyRef.current;
      if (
        !lastReported ||
        lastReported.requestId !== zoomRenderRequestId ||
        lastReported.scale !== renderedZoomScale ||
        lastReported.width !== width ||
        lastReported.height !== height
      ) {
        lastReportedAnnotationReadyRef.current = {
          requestId: zoomRenderRequestId,
          scale: renderedZoomScale,
          width,
          height,
        };
        onAnnotationRenderReady?.(zoomRenderRequestId, renderedZoomScale);
      }
    }
  }, [width, height, strokes, currentStroke, eraserPreviewStrokes, zoomRenderRequestId, renderedZoomScale, onAnnotationRenderReady]);`;

code = code.replace(/    if \(currentStroke\) \{\n      drawStroke\(currentStroke\);\n    \}\n\n    if \(zoomRenderRequestId \!== undefined && zoomRenderRequestId \!== null && document\.body\.contains\(canvas\)\) \{\n      onAnnotationRenderReady\?.\(zoomRenderRequestId, renderedZoomScale\);\n    \}\n  \}, \[width, height, strokes, currentStroke, eraserPreviewStrokes, zoomRenderRequestId, renderedZoomScale, onAnnotationRenderReady\]\);\n/m, newEffectEnd + '\n');

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
