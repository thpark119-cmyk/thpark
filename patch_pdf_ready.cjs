const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newPdfReady = `  const handlePdfRenderReady = useCallback((requestId: number, renderedScale: number) => {
    const request = activeZoomRenderRequestRef.current;

    if (!request) return;
    if (request.requestId !== requestId) return;

    if (Math.abs(request.requestedScale - renderedScale) >= 0.005) {
      return;
    }

    if (request.pdfReadyAt === null) {
      request.pdfReadyAt = performance.now();

      if (import.meta.env.DEV) {
        console.info('[Mio Zoom Performance]', {
          phase: 'pdf-ready',
          requestId,
          duration: request.pdfReadyAt - request.startedAt,
        });
      }

      if (request.usesPinchPreview) {
        tryScheduleZoomPreviewHandoff(requestId);
      }
    }
  }, [tryScheduleZoomPreviewHandoff]);`;

code = code.replace(/  const handlePdfRenderReady = useCallback\(\(requestId: number, renderedScale: number\) => \{[\s\S]*?  \}, \[\]\);\n/m, newPdfReady + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
