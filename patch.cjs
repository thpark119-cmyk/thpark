const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(`  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
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
  };`, `  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    const pointerId = event.pointerId;
    touchPointersRef.current.delete(pointerId);
    if (event.currentTarget.hasPointerCapture(pointerId)) {
      try { event.currentTarget.releasePointerCapture(pointerId); } catch {}
    }

    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current || pinchSessionRef.current !== null;
    
    if (wasTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
      finishTwoFingerGesture();
      return;
    }
    
    if (suppressTouchUntilReleaseRef.current) {
      event.preventDefault();
      event.stopPropagation();
      if (touchPointersRef.current.size === 0) {
        suppressTouchUntilReleaseRef.current = false;
        clearTouchReleaseTimer();
        singleTouchPanRef.current = null;
      }
      return;
    }
    
    if (touchPointersRef.current.size === 0) {
      singleTouchPanRef.current = null;
    }
  };`);

code = code.replace(`  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
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
  };`, `  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    const pointerId = event.pointerId;
    touchPointersRef.current.delete(pointerId);
    if (event.currentTarget.hasPointerCapture(pointerId)) {
      try { event.currentTarget.releasePointerCapture(pointerId); } catch {}
    }

    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current || pinchSessionRef.current !== null;

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
  };`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
