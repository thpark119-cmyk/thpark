const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const gestureLogic = `
  const resetTouchGestureState = useCallback(() => {
    touchPointersRef.current.clear();
    singleTouchPanRef.current = null;
    pinchSessionRef.current = null;
    suppressTouchUntilReleaseRef.current = false;
    pendingPinchUpdateRef.current = null;
    setIsTwoFingerGestureActive(false);

    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('blur', resetTouchGestureState);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resetTouchGestureState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', resetTouchGestureState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resetTouchGestureState(); // also reset on unmount
    };
  }, [resetTouchGestureState]);

  const handleScorePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
    if (firstTwo) {
      const [first, second] = firstTwo;
      const distance = getTouchDistance(first, second);
      if (distance < 10) {
        return;
      }
      const midpoint = getTouchMidpoint(first, second);
      pinchSessionRef.current = {
        startDistance: distance,
        startZoomScale: zoomScaleRef.current,
        lastMidpointX: midpoint.x,
        lastMidpointY: midpoint.y,
        latestZoomScale: zoomScaleRef.current,
      };
      
      singleTouchPanRef.current = null;
      suppressTouchUntilReleaseRef.current = true;
      setIsTwoFingerGestureActive(true);
      setTouchGestureSessionId(prev => prev + 1);

      event.preventDefault();
      event.stopPropagation();
      
      for (const pointerId of touchPointersRef.current.keys()) {
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch {}
      }
    } else {
      if (currentTool === 'none' && touchPointersRef.current.size === 1 && !suppressTouchUntilReleaseRef.current) {
        singleTouchPanRef.current = {
          pointerId: event.pointerId,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
      }
    }
  };

  const handleScorePointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    if (touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    }
    
    if (touchPointersRef.current.size >= 2 && pinchSessionRef.current) {
      event.preventDefault();
      event.stopPropagation();
      
      const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
      if (firstTwo) {
        const [first, second] = firstTwo;
        const currentDistance = getTouchDistance(first, second);
        const midpoint = getTouchMidpoint(first, second);
        const session = pinchSessionRef.current;
        
        const nextZoomScale = normalizeZoomScale(session.startZoomScale * (currentDistance / session.startDistance));
        
        const midpointDeltaX = midpoint.x - session.lastMidpointX;
        const midpointDeltaY = midpoint.y - session.lastMidpointY;
        
        const viewport = scoreViewportRef.current;
        if (viewport) {
          viewport.scrollLeft -= midpointDeltaX;
          viewport.scrollTop -= midpointDeltaY;
        }
        
        session.lastMidpointX = midpoint.x;
        session.lastMidpointY = midpoint.y;
        session.latestZoomScale = nextZoomScale;
        
        schedulePinchZoom({ zoomScale: nextZoomScale, midpointX: midpoint.x, midpointY: midpoint.y });
      }
    } else if (currentTool === 'none' && singleTouchPanRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      const pan = singleTouchPanRef.current;
      const deltaX = event.clientX - pan.lastClientX;
      const deltaY = event.clientY - pan.lastClientY;
      
      const viewport = scoreViewportRef.current;
      if (viewport) {
        viewport.scrollLeft -= deltaX;
        viewport.scrollTop -= deltaY;
      }
      
      pan.lastClientX = event.clientX;
      pan.lastClientY = event.clientY;
    }
  };

  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    touchPointersRef.current.delete(event.pointerId);
    
    if (isTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (touchPointersRef.current.size < 2) {
      const session = pinchSessionRef.current;
      if (session) {
        handleZoomChangeAtPoint(session.latestZoomScale, session.lastMidpointX, session.lastMidpointY);
      }
      pinchSessionRef.current = null;
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
  };

  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    handleScorePointerUpCapture(event);
  };
`;

const insertStr = '  const [document, setDocument] = useState<ScoreAnnotationDocument>({';
const insertIndex = content.indexOf(insertStr);

if (insertIndex > -1) {
  content = content.substring(0, insertIndex) + gestureLogic + '\n' + content.substring(insertIndex);
  fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
  console.log('Patch 4 done');
} else {
  console.log('Failed to find insert location');
}
