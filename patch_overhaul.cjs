const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

// First, find and replace finishTwoFingerGesture completely.
code = code.replace(/  const finishTwoFingerGesture = useCallback\(\(\) => \{[\s\S]*?^  \}, \[[\s\S]*?\]\);\n/m, `  const finishTwoFingerGesture = useCallback(() => {
    if (!pinchSessionRef.current) {
      return;
    }
    const session = pinchSessionRef.current;

    let finalScale: number | null = null;
    let lastMidpointX = 0;
    let lastMidpointY = 0;

    if (session.gestureMode === 'zoom' && session.latestZoomScale !== session.startZoomScale) {
      finalScale = normalizeZoomScale(session.latestZoomScale);
      lastMidpointX = session.lastMidpointX;
      lastMidpointY = session.lastMidpointY;
    }

    pinchSessionRef.current = null;
    singleTouchPanRef.current = null;
    isTwoFingerGestureActiveRef.current = false;
    setIsTwoFingerGestureActive(false);
    suppressTouchUntilReleaseRef.current = false;
    clearTouchReleaseTimer();

    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
    pendingPinchPreviewRef.current = null;

    flushPendingTwoFingerPan();
    clearPinchPreviewStyle();

    if (finalScale !== null) {
      handleZoomChangeAtPoint(finalScale, lastMidpointX, lastMidpointY);
    }
  }, [
    clearTouchReleaseTimer,
    handleZoomChangeAtPoint,
    flushPendingTwoFingerPan,
    clearPinchPreviewStyle
  ]);\n`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
