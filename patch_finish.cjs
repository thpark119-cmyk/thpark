const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newFinish = `  const finishTwoFingerGesture = useCallback(() => {
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
      pendingFinalPinchScaleRef.current = finalScale;
    }

    pinchSessionRef.current = null;
    singleTouchPanRef.current = null;
    isTwoFingerGestureActiveRef.current = false;
    setIsTwoFingerGestureActive(false);
    clearTouchReleaseTimer();

    for (const pointerId of touchPointersRef.current.keys()) {
      endingTouchPointerIdsRef.current.add(pointerId);
    }

    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
    pendingPinchPreviewRef.current = null;

    flushPendingTwoFingerPan();

    if (finalScale !== null) {
      const createdRequestId = handleZoomChangeAtPoint(finalScale, lastMidpointX, lastMidpointY, { preservePinchPreviewUntilReady: true });
      if (createdRequestId === null) {
        clearPinchPreviewStyle();
      }
    } else {
      clearPinchPreviewStyle();
    }
  }, [
    clearTouchReleaseTimer,
    handleZoomChangeAtPoint,
    flushPendingTwoFingerPan,
    clearPinchPreviewStyle
  ]);`;

code = code.replace(/  const finishTwoFingerGesture = useCallback\(\(\) => \{[\s\S]*?    clearPinchPreviewStyle\n  \}\]\);\n/m, newFinish + '\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
