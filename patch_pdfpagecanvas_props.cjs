const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/  touchGestureSessionId\?: number;\n\}/m, `  touchGestureSessionId?: number;
  zoomRenderRequestId?: number | null;
  onPdfRenderReady?: (requestId: number, renderedZoomScale: number) => void;
  onAnnotationRenderReady?: (requestId: number, renderedZoomScale: number) => void;
}`);

code = code.replace(/  touchGestureSessionId\n\}: PdfPageCanvasProps\) => \{/m, `  touchGestureSessionId,
  zoomRenderRequestId,
  onPdfRenderReady,
  onAnnotationRenderReady
}: PdfPageCanvasProps) => {`);

const newRenderSuccess = `  const handlePageRenderSuccess = useCallback(() => {
    setIsPageRendered(true);
    setPageError(null);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measureRenderedPage);
    });
    console.info('[Mio PDF Viewer]', {
      engine: 'react-pdf',
      event: 'page-render-success',
      pageNumber,
      containerWidth,
    });
    if (zoomRenderRequestId !== undefined && zoomRenderRequestId !== null) {
      onPdfRenderReady?.(zoomRenderRequestId, zoomScale);
    }
  }, [pageNumber, containerWidth, measureRenderedPage, zoomRenderRequestId, zoomScale, onPdfRenderReady]);`;

code = code.replace(/  const handlePageRenderSuccess = useCallback\(\(\) => \{[\s\S]*?  \}, \[pageNumber, containerWidth, measureRenderedPage\]\);\n/m, newRenderSuccess + '\n');

code = code.replace(/                    touchGestureSessionId=\{touchGestureSessionId\}\n                  \/>\n/m, `                    touchGestureSessionId={touchGestureSessionId}
                    zoomRenderRequestId={zoomRenderRequestId}
                    onAnnotationRenderReady={onAnnotationRenderReady}
                    renderedZoomScale={zoomScale}
                  />\n`);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
