const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

// replace the declaration
code = code.replace(/  const suppressTouchUntilReleaseRef = useRef\(false\);\n/, '  const endingTouchPointerIdsRef = useRef<Set<number>>(new Set());\n');

// clear it in finishTwoFingerGesture
code = code.replace(/    suppressTouchUntilReleaseRef\.current = false;\n/, '');

// now in handleScorePointerDownCapture
code = code.replace(/    if \(suppressTouchUntilReleaseRef\.current\) \{\n      event\.preventDefault\(\);\n      event\.stopPropagation\(\);\n      return;\n    \}\n/m, '');

// in handleScorePointerDownCapture where we start pinch
code = code.replace(/      suppressTouchUntilReleaseRef\.current = true;\n/, '');
code = code.replace(/      if \(currentTool === 'none' && touchPointersRef\.current\.size === 1 && !suppressTouchUntilReleaseRef\.current\) \{/, "      if (currentTool === 'none' && touchPointersRef.current.size === 1 && endingTouchPointerIdsRef.current.size === 0) {");

// in handleScorePointerMoveCapture
code = code.replace(/    if \(suppressTouchUntilReleaseRef\.current && !isTwoFingerGestureActiveRef\.current\) \{\n      event\.preventDefault\(\);\n      event\.stopPropagation\(\);\n      return;\n    \}\n/m, '');

// in handleScorePointerUpCapture
code = code.replace(/    if \(suppressTouchUntilReleaseRef\.current\) \{\n      event\.preventDefault\(\);\n      event\.stopPropagation\(\);\n      if \(touchPointersRef\.current\.size === 0\) \{\n        suppressTouchUntilReleaseRef\.current = false;\n        clearTouchReleaseTimer\(\);\n        singleTouchPanRef\.current = null;\n      \}\n      return;\n    \}\n/m, `    if (endingTouchPointerIdsRef.current.has(pointerId)) {
      endingTouchPointerIdsRef.current.delete(pointerId);
      event.preventDefault();
      event.stopPropagation();
      if (touchPointersRef.current.size === 0) {
        clearTouchReleaseTimer();
        singleTouchPanRef.current = null;
      }
      return;
    }\n`);

// in handleScorePointerCancelCapture
code = code.replace(/      suppressTouchUntilReleaseRef\.current = false;\n/g, '');

// in finishTwoFingerGesture
code = code.replace(/    clearTouchReleaseTimer\(\);\n\n    if \(pinchFrameRef\.current !== null\) \{/, `    clearTouchReleaseTimer();

    for (const pointerId of touchPointersRef.current.keys()) {
      endingTouchPointerIdsRef.current.add(pointerId);
    }

    if (pinchFrameRef.current !== null) {`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
