const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const zoomLogic = `
  const handleZoomChangeAtPoint = useCallback((requestedScale: number, clientX: number, clientY: number) => {
    const nextScale = normalizeZoomScale(requestedScale);
    if (Math.abs(nextScale - zoomScaleRef.current) < 0.005) {
      return;
    }

    const viewport = scoreViewportRef.current;
    if (!viewport) {
      zoomScaleRef.current = nextScale;
      setZoomScale(nextScale);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportOffsetX = Math.max(0, Math.min(viewport.clientWidth, clientX - viewportRect.left));
    const viewportOffsetY = Math.max(0, Math.min(viewport.clientHeight, clientY - viewportRect.top));

    pendingZoomAnchorRef.current = {
      xRatio: (viewport.scrollLeft + viewportOffsetX) / Math.max(1, viewport.scrollWidth),
      yRatio: (viewport.scrollTop + viewportOffsetY) / Math.max(1, viewport.scrollHeight),
      viewportOffsetX,
      viewportOffsetY,
    };

    zoomScaleRef.current = nextScale;
    setZoomScale(nextScale);
  }, []);

  const handleZoomChange = useCallback((requestedScale: number) => {
    const viewport = scoreViewportRef.current;
    if (!viewport) {
      handleZoomChangeAtPoint(requestedScale, 0, 0);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    handleZoomChangeAtPoint(requestedScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [handleZoomChangeAtPoint]);

  useEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) {
      return;
    }

    let secondFrameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const viewport = scoreViewportRef.current;
        if (viewport) {
          viewport.scrollLeft = Math.max(0, anchor.xRatio * viewport.scrollWidth - anchor.viewportOffsetX);
          viewport.scrollTop = Math.max(0, anchor.yRatio * viewport.scrollHeight - anchor.viewportOffsetY);
          pendingZoomAnchorRef.current = null;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [zoomScale]);

  const schedulePinchZoom = useCallback(({ zoomScale: requestedScale, midpointX, midpointY }: { zoomScale: number; midpointX: number; midpointY: number; }) => {
    pendingPinchUpdateRef.current = { zoomScale: requestedScale, midpointX, midpointY };
    if (pinchFrameRef.current !== null) {
      return;
    }
    pinchFrameRef.current = window.requestAnimationFrame(() => {
      pinchFrameRef.current = null;
      const update = pendingPinchUpdateRef.current;
      pendingPinchUpdateRef.current = null;
      if (!update) {
        return;
      }
      if (Math.abs(update.zoomScale - zoomScaleRef.current) < 0.02) {
        return;
      }
      handleZoomChangeAtPoint(update.zoomScale, update.midpointX, update.midpointY);
    });
  }, [handleZoomChangeAtPoint]);
`;

// regex replace from `const handleZoomChange = useCallback(` to `}, [zoomScale]);\n`
const startStr = '  const handleZoomChange = useCallback(';
const endStr = '  }, [zoomScale]);\n';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex) + endStr.length;

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + zoomLogic + content.substring(endIndex);
  fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
  console.log('Patch 3 done');
} else {
  console.log('Failed to find replace block');
}
