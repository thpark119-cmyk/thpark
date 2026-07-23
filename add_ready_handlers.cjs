const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const handlers = `
  const handlePdfRenderReady = useCallback((requestId: number, renderedScale: number) => {
    const request = activeZoomRenderRequestRef.current;

    if (!request) return;
    if (request.requestId !== requestId) return;

    if (Math.abs(request.requestedScale - renderedScale) >= 0.005) {
      return;
    }

    request.pdfReadyAt = performance.now();

    if (import.meta.env.DEV) {
      console.info('[Mio Zoom Performance]', {
        phase: 'pdf-ready',
        requestId,
        duration: request.pdfReadyAt - request.startedAt,
      });
    }
  }, []);

  const handleAnnotationRenderReady = useCallback((requestId: number, renderedScale: number) => {
    const request = activeZoomRenderRequestRef.current;

    if (!request) return;
    if (request.requestId !== requestId) return;

    if (Math.abs(request.requestedScale - renderedScale) >= 0.005) {
      return;
    }

    request.annotationReadyAt = performance.now();

    if (import.meta.env.DEV) {
      console.info('[Mio Zoom Performance]', {
        phase: 'annotation-ready',
        requestId,
        duration: request.annotationReadyAt - request.startedAt,
      });
    }
  }, []);
`;

// Insert handlers before flushPendingTwoFingerPan
code = code.replace(/  const flushPendingTwoFingerPan = useCallback\(\(\) => \{/m, handlers + '\n  const flushPendingTwoFingerPan = useCallback(() => {');

// Pass props to PdfPageCanvas
code = code.replace(/<PdfPageCanvas\n/g, `<PdfPageCanvas
                    zoomRenderRequestId={zoomRenderRequestIdRef.current}
                    onPdfRenderReady={handlePdfRenderReady}
                    onAnnotationRenderReady={handleAnnotationRenderReady}
`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
