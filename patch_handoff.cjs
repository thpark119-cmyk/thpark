const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newHandoff = `  const tryScheduleZoomPreviewHandoff = useCallback((requestId: number) => {
    const request = activeZoomRenderRequestRef.current;
    if (!request || request.requestId !== requestId) return;
    if (!request.usesPinchPreview) return;
    if (request.pdfReadyAt === null || request.annotationReadyAt === null || request.geometryReadyAt === null) return;
    if (request.handoffScheduled) return;

    const pendingFinalScale = pendingFinalPinchScaleRef.current;
    if (pendingFinalScale === null || Math.abs(request.requestedScale - pendingFinalScale) >= 0.005) return;

    const anchor = pendingZoomAnchorRef.current;
    if (!anchor || anchor.requestId !== request.anchorRequestId) return;

    request.handoffScheduled = true;

    if (zoomHandoffFirstFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomHandoffFirstFrameRef.current);
    }
    if (zoomHandoffSecondFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomHandoffSecondFrameRef.current);
    }

    zoomHandoffFirstFrameRef.current = window.requestAnimationFrame(() => {
      zoomHandoffFirstFrameRef.current = null;
      
      const req1 = activeZoomRenderRequestRef.current;
      if (!req1 || req1.requestId !== requestId) return;
      if (req1.pdfReadyAt === null || req1.annotationReadyAt === null || req1.geometryReadyAt === null) return;
      
      const finalScale1 = pendingFinalPinchScaleRef.current;
      if (finalScale1 === null || Math.abs(req1.requestedScale - finalScale1) >= 0.005) return;

      const anchor1 = pendingZoomAnchorRef.current;
      if (!anchor1 || anchor1.requestId !== req1.anchorRequestId) return;

      zoomHandoffSecondFrameRef.current = window.requestAnimationFrame(() => {
        zoomHandoffSecondFrameRef.current = null;

        const req2 = activeZoomRenderRequestRef.current;
        if (!req2 || req2.requestId !== requestId) return;
        if (!req2.usesPinchPreview) return;
        if (req2.pdfReadyAt === null || req2.annotationReadyAt === null || req2.geometryReadyAt === null) return;

        const finalScale2 = pendingFinalPinchScaleRef.current;
        if (finalScale2 === null || Math.abs(req2.requestedScale - finalScale2) >= 0.005) return;

        const latestAnchor = pendingZoomAnchorRef.current;
        if (!latestAnchor || latestAnchor.requestId !== req2.anchorRequestId) return;

        const viewport = scoreViewportRef.current;
        const pageSurface = getScorePageSurface();
        if (!viewport || !pageSurface) return;

        // Same callback sequence:
        // 1. clearPinchPreviewStyle
        clearPinchPreviewStyle();

        // 2. measure actual page rect after preview is cleared
        const viewportRect = viewport.getBoundingClientRect();
        const pageRect = pageSurface.getBoundingClientRect();

        if (pageRect.width > 0 && pageRect.height > 0) {
          // 3. scroll adjustment
          const targetClientX = viewportRect.left + latestAnchor.viewportOffsetX;
          const targetClientY = viewportRect.top + latestAnchor.viewportOffsetY;
          
          const renderedAnchorClientX = pageRect.left + pageRect.width * latestAnchor.pageXRatio;
          const renderedAnchorClientY = pageRect.top + pageRect.height * latestAnchor.pageYRatio;
          
          viewport.scrollLeft += renderedAnchorClientX - targetClientX;
          viewport.scrollTop += renderedAnchorClientY - targetClientY;
        }

        // 4. clear pending anchor
        pendingZoomAnchorRef.current = null;
        // 5. clear pending final scale
        pendingFinalPinchScaleRef.current = null;
        // 6. record preview cleared time
        req2.previewClearedAt = performance.now();

        // 7. print dev log
        if (import.meta.env.DEV) {
          console.info('[Mio Zoom Performance]', {
            phase: 'handoff-complete',
            requestId: req2.requestId,
            requestedScale: req2.requestedScale,
            pdfDuration: req2.pdfReadyAt - req2.startedAt,
            annotationDuration: req2.annotationReadyAt - req2.startedAt,
            geometryDuration: req2.geometryReadyAt - req2.startedAt,
            totalDuration: req2.previewClearedAt - req2.startedAt,
            readyGap: Math.abs(req2.pdfReadyAt - req2.annotationReadyAt),
            usedPinchPreview: true,
          });
        }

        // 8. clear active request
        activeZoomRenderRequestRef.current = null;
      });
    });
  }, [getScorePageSurface, clearPinchPreviewStyle]);

  const handlePageGeometryReady = useCallback((renderedZoomScale: number) => {
    const anchor = pendingZoomAnchorRef.current;
    const pendingFinalScale = pendingFinalPinchScaleRef.current;
    
    if (!anchor) {
      return;
    }

    if (Math.abs(renderedZoomScale - anchor.requestedZoomScale) >= 0.005) {
      return;
    }

    const expectedRequestId = anchor.requestId;
    const expectedRequestedScale = anchor.requestedZoomScale;

    const request = activeZoomRenderRequestRef.current;
    if (request && request.usesPinchPreview) {
      if (Math.abs(request.requestedScale - renderedZoomScale) < 0.005 && request.anchorRequestId === expectedRequestId) {
        if (request.geometryReadyAt === null) {
          request.geometryReadyAt = performance.now();
          if (import.meta.env.DEV) {
            console.info('[Mio Zoom Performance]', {
              phase: 'geometry-ready',
              requestId: request.requestId,
              duration: request.geometryReadyAt - request.startedAt,
            });
          }
          tryScheduleZoomPreviewHandoff(request.requestId);
        }
        return;
      }
    }

    const shouldClearPinchPreview = pendingFinalScale !== null && Math.abs(renderedZoomScale - pendingFinalScale) < 0.005;

    if (zoomAnchorFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomAnchorFrameRef.current);
    }

    zoomAnchorFrameRef.current = window.requestAnimationFrame(() => {
      try {
        const latestAnchor = pendingZoomAnchorRef.current;
        if (!latestAnchor || latestAnchor.requestId !== expectedRequestId || latestAnchor.requestedZoomScale !== expectedRequestedScale) {
          return;
        }
        
        if (shouldClearPinchPreview) {
          const currentFinalScale = pendingFinalPinchScaleRef.current;
          if (currentFinalScale === null || Math.abs(renderedZoomScale - currentFinalScale) >= 0.005) {
            return;
          }
        }

        const viewport = scoreViewportRef.current;
        const pageSurface = getScorePageSurface();

        if (!viewport || !pageSurface) {
          return;
        }

        if (shouldClearPinchPreview) {
          clearPinchPreviewStyle();
        }

        const viewportRect = viewport.getBoundingClientRect();
        const pageRect = pageSurface.getBoundingClientRect();

        if (pageRect.width <= 0 || pageRect.height <= 0) {
          return;
        }

        const targetClientX = viewportRect.left + latestAnchor.viewportOffsetX;
        const targetClientY = viewportRect.top + latestAnchor.viewportOffsetY;

        const renderedAnchorClientX = pageRect.left + pageRect.width * latestAnchor.pageXRatio;
        const renderedAnchorClientY = pageRect.top + pageRect.height * latestAnchor.pageYRatio;

        viewport.scrollLeft += renderedAnchorClientX - targetClientX;
        viewport.scrollTop += renderedAnchorClientY - targetClientY;

        pendingZoomAnchorRef.current = null;
        if (shouldClearPinchPreview) {
          pendingFinalPinchScaleRef.current = null;
        }

      } finally {
        zoomAnchorFrameRef.current = null;
      }
    });
  }, [getScorePageSurface, clearPinchPreviewStyle, tryScheduleZoomPreviewHandoff]);`;

code = code.replace(/  const handlePageGeometryReady = useCallback\(\(renderedZoomScale: number\) => \{[\s\S]*?  \}, \[getScorePageSurface, clearPinchPreviewStyle\]\);\n/m, newHandoff + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
