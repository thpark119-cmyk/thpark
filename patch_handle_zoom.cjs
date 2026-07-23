const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newZoom = `  const handleZoomChangeAtPoint = useCallback((
    requestedScale: number,
    clientX: number,
    clientY: number,
    options?: { preservePinchPreviewUntilReady?: boolean }
  ): number | null => {
    const nextScale = normalizeZoomScale(requestedScale);
    if (Math.abs(nextScale - zoomScaleRef.current) < 0.005) {
      return null;
    }

    let createdRequestId: number | null = null;

    const commitZoomScale = (scaleToCommit: number) => {
      const requestId = zoomRenderRequestIdRef.current + 1;
      zoomRenderRequestIdRef.current = requestId;
      createdRequestId = requestId;

      activeZoomRenderRequestRef.current = {
        requestId,
        requestedScale: scaleToCommit,
        startedAt: performance.now(),
        pdfReadyAt: null,
        annotationReadyAt: null,
        usesPinchPreview: options?.preservePinchPreviewUntilReady ?? false,
        anchorRequestId: pendingZoomAnchorRef.current?.requestId ?? null,
        geometryReadyAt: null,
        handoffScheduled: false,
        previewClearedAt: null,
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
      return createdRequestId;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const pageRect = pageSurface.getBoundingClientRect();
    
    if (pageRect.width <= 0 || pageRect.height <= 0) {
      commitZoomScale(nextScale);
      return createdRequestId;
    }

    const clampedClientX = Math.max(viewportRect.left, Math.min(viewportRect.right, clientX));
    const clampedClientY = Math.max(viewportRect.top, Math.min(viewportRect.bottom, clientY));
    const nextAnchorRequestId = zoomAnchorRequestIdRef.current + 1;
    zoomAnchorRequestIdRef.current = nextAnchorRequestId;

    pendingZoomAnchorRef.current = {
      pageXRatio: Math.max(0, Math.min(1, (clampedClientX - pageRect.left) / pageRect.width)),
      pageYRatio: Math.max(0, Math.min(1, (clampedClientY - pageRect.top) / pageRect.height)),
      viewportOffsetX: clientX - viewportRect.left,
      viewportOffsetY: clientY - viewportRect.top,
      requestedZoomScale: nextScale,
      requestId: nextAnchorRequestId,
    };

    commitZoomScale(nextScale);
    return createdRequestId;
  }, [getScorePageSurface]);`;

code = code.replace(/  const handleZoomChangeAtPoint = useCallback\(\(requestedScale: number, clientX: number, clientY: number\) => \{[\s\S]*?    commitZoomScale\(nextScale\);\n  \}, \[getScorePageSurface\]\);\n/m, newZoom + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
