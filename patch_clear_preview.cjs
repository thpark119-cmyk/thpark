const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newClear = `  const clearPinchPreviewStyle = useCallback(() => {
    if (import.meta.env.DEV) {
      const request = activeZoomRenderRequestRef.current;
      console.info('[Mio Zoom Performance]', {
        phase: 'preview-clear',
        requestId: request?.requestId ?? null,
        totalDuration: request ? performance.now() - request.startedAt : null,
        pdfReady: request?.pdfReadyAt !== null,
        annotationReady: request?.annotationReadyAt !== null,
      });
    }

    const pageSurface = getScorePageSurface();
    if (!pageSurface) return;
    pageSurface.style.transform = '';
    pageSurface.style.transformOrigin = '';
    pageSurface.style.willChange = '';
  }, [getScorePageSurface]);`;

code = code.replace(/  const clearPinchPreviewStyle = useCallback\(\(\) => \{[\s\S]*?  \}, \[getScorePageSurface\]\);\n/m, newClear + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
