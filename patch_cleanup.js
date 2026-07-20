import fs from 'fs';

let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const touchReleaseTimerRefStr = `
  const touchReleaseTimerRef = useRef<number | null>(null);
  const clearTouchReleaseTimer = useCallback(() => {
    if (touchReleaseTimerRef.current === null) {
      return;
    }
    window.clearTimeout(touchReleaseTimerRef.current);
    touchReleaseTimerRef.current = null;
  }, []);
`;

content = content.replace(
  '  const pendingPinchUpdateRef = useRef<{ zoomScale: number; midpointX: number; midpointY: number; } | null>(null);',
  `  const pendingPinchUpdateRef = useRef<{ zoomScale: number; midpointX: number; midpointY: number; } | null>(null);${touchReleaseTimerRefStr}`
);

const finishTwoFingerGestureStr = `
  const finishTwoFingerGesture = useCallback(() => {
    const session = pinchSessionRef.current;
    const finalZoom = session
      ? {
          scale: session.latestZoomScale,
          x: session.lastMidpointX,
          y: session.lastMidpointY,
        }
      : null;

    const viewport = scoreViewportRef.current;
    if (viewport) {
      for (const pointerId of touchPointersRef.current.keys()) {
        try {
          if (viewport.hasPointerCapture(pointerId)) {
            viewport.releasePointerCapture(pointerId);
          }
        } catch {
          // 종료된 pointer 또는 pointer capture 미지원은 무시
        }
      }
    }

    touchPointersRef.current.clear();
    singleTouchPanRef.current = null;
    pinchSessionRef.current = null;
    pendingPinchUpdateRef.current = null;
    isTwoFingerGestureActiveRef.current = false;
    setIsTwoFingerGestureActive(false);

    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }

    clearTouchReleaseTimer();

    suppressTouchUntilReleaseRef.current = true;
    touchReleaseTimerRef.current = window.setTimeout(() => {
      suppressTouchUntilReleaseRef.current = false;
      touchReleaseTimerRef.current = null;
    }, 160);

    if (finalZoom) {
      handleZoomChangeAtPoint(finalZoom.scale, finalZoom.x, finalZoom.y);
    }
  }, [clearTouchReleaseTimer, handleZoomChangeAtPoint]);
`;

content = content.replace(
  '  const schedulePinchZoom = useCallback(({ zoomScale: requestedScale, midpointX, midpointY }: { zoomScale: number; midpointX: number; midpointY: number; }) => {',
  `${finishTwoFingerGestureStr}\n  const schedulePinchZoom = useCallback(({ zoomScale: requestedScale, midpointX, midpointY }: { zoomScale: number; midpointX: number; midpointY: number; }) => {`
);

content = content.replace(
  `  const resetTouchGestureState = useCallback(() => {
    touchPointersRef.current.clear();
    singleTouchPanRef.current = null;
    pinchSessionRef.current = null;
    suppressTouchUntilReleaseRef.current = false;
    pendingPinchUpdateRef.current = null;
    isTwoFingerGestureActiveRef.current = false;
    setIsTwoFingerGestureActive(false);
    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
  }, []);`,
  `  const resetTouchGestureState = useCallback(() => {
    touchPointersRef.current.clear();
    singleTouchPanRef.current = null;
    pinchSessionRef.current = null;
    pendingPinchUpdateRef.current = null;
    suppressTouchUntilReleaseRef.current = false;
    isTwoFingerGestureActiveRef.current = false;
    setIsTwoFingerGestureActive(false);
    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
    clearTouchReleaseTimer();
  }, [clearTouchReleaseTimer]);`
);

content = content.replace(
  `  const handleScorePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });`,
  `  const handleScorePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    if (suppressTouchUntilReleaseRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });`
);

content = content.replace(
  `  const handleScorePointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    if (touchPointersRef.current.has(event.pointerId)) {`,
  `  const handleScorePointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    if (suppressTouchUntilReleaseRef.current && !isTwoFingerGestureActiveRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    if (touchPointersRef.current.has(event.pointerId)) {`
);

content = content.replace(
  `  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current;
    
    touchPointersRef.current.delete(event.pointerId);
    
    if (wasTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (touchPointersRef.current.size < 2) {
      const session = pinchSessionRef.current;
      if (session) {
        handleZoomChangeAtPoint(session.latestZoomScale, session.lastMidpointX, session.lastMidpointY);
      }
      pinchSessionRef.current = null;
      isTwoFingerGestureActiveRef.current = false;
      setIsTwoFingerGestureActive(false);
    }
    
    if (touchPointersRef.current.size === 0) {
      suppressTouchUntilReleaseRef.current = false;
      singleTouchPanRef.current = null;
    }
    
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {}
  };`,
  `  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current || pinchSessionRef.current !== null;
    
    touchPointersRef.current.delete(event.pointerId);
    
    if (wasTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
      finishTwoFingerGesture();
      return;
    }
    
    if (suppressTouchUntilReleaseRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressTouchUntilReleaseRef.current = false;
      clearTouchReleaseTimer();
      touchPointersRef.current.clear();
      singleTouchPanRef.current = null;
      return;
    }
    
    if (touchPointersRef.current.size === 0) {
      singleTouchPanRef.current = null;
    }
    
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {}
  };`
);

content = content.replace(
  `  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    handleScorePointerUpCapture(event);
  };`,
  `  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current || pinchSessionRef.current !== null;

    touchPointersRef.current.delete(event.pointerId);

    if (wasTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
      finishTwoFingerGesture();
      return;
    }

    if (touchPointersRef.current.size === 0) {
      singleTouchPanRef.current = null;
      suppressTouchUntilReleaseRef.current = false;
      clearTouchReleaseTimer();
    }
  };`
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('patched successfully');
