const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const replacement = `  const handleZoomChangeAtPoint = useCallback((requestedScale: number, clientX: number, clientY: number) => {
    const nextScale = normalizeZoomScale(requestedScale);
    if (Math.abs(nextScale - zoomScaleRef.current) < 0.005) {
      return;
    }

    const commitZoomScale = (scaleToCommit: number) => {
      const requestId = zoomRenderRequestIdRef.current + 1;
      zoomRenderRequestIdRef.current = requestId;

      activeZoomRenderRequestRef.current = {
        requestId,
        requestedScale: scaleToCommit,
        startedAt: performance.now(),
        pdfReadyAt: null,
        annotationReadyAt: null,
      };

      if (import.meta.env.DEV) {
        console.info('[Mio Zoom Performance]', {
          phase: 'zoom-commit',
          requestId,
          requestedScale: scaleToCommit,
          time: performance.now(),
        });
      }

      zoomScaleRef.current = scaleToCommit;
      setZoomScale(scaleToCommit);
    };

    const viewport = scoreViewportRef.current;
    const pageSurface = getScorePageSurface();
    if (!viewport || !pageSurface) {
      commitZoomScale(nextScale);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const pageRect = pageSurface.getBoundingClientRect();
    
    if (pageRect.width <= 0 || pageRect.height <= 0) {
      commitZoomScale(nextScale);
      return;
    }

    const clampedClientX = Math.max(viewportRect.left, Math.min(viewportRect.right, clientX));
    const clampedClientY = Math.max(viewportRect.top, Math.min(viewportRect.bottom, clientY));
    const nextRequestId = zoomAnchorRequestIdRef.current + 1;
    zoomAnchorRequestIdRef.current = nextRequestId;

    pendingZoomAnchorRef.current = {
      pageXRatio: Math.max(0, Math.min(1, (clampedClientX - pageRect.left) / pageRect.width)),
      pageYRatio: Math.max(0, Math.min(1, (clampedClientY - pageRect.top) / pageRect.height)),
      viewportOffsetX: clientX - viewportRect.left,
      viewportOffsetY: clientY - viewportRect.top,
      requestedZoomScale: nextScale,
      requestId: nextRequestId,
    };

    commitZoomScale(nextScale);
  }, [getScorePageSurface]);`;

code = code.replace(/  const handleZoomChangeAtPoint = useCallback\(\(requestedScale: number, clientX: number, clientY: number\) => \{[\s\S]*?  \}, \[getScorePageSurface\]\);/m, replacement);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
