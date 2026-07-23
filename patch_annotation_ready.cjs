const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newAnnotationReady = `  const handleAnnotationRenderReady = useCallback((requestId: number, renderedScale: number) => {
    const request = activeZoomRenderRequestRef.current;

    if (!request) return;
    if (request.requestId !== requestId) return;

    if (Math.abs(request.requestedScale - renderedScale) >= 0.005) {
      return;
    }

    if (request.annotationReadyAt === null) {
      request.annotationReadyAt = performance.now();

      if (import.meta.env.DEV) {
        console.info('[Mio Zoom Performance]', {
          phase: 'annotation-ready',
          requestId,
          duration: request.annotationReadyAt - request.startedAt,
        });
      }

      if (request.usesPinchPreview) {
        tryScheduleZoomPreviewHandoff(requestId);
      }
    }
  }, [tryScheduleZoomPreviewHandoff]);`;

code = code.replace(/  const handleAnnotationRenderReady = useCallback\(\(requestId: number, renderedScale: number\) => \{[\s\S]*?  \}, \[\]\);\n/m, newAnnotationReady + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
