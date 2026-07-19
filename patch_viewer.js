import fs from 'fs';

let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

// 1. Add isTwoFingerGestureActiveRef
content = content.replace(
  '  const [isTwoFingerGestureActive, setIsTwoFingerGestureActive] = useState(false);',
  '  const isTwoFingerGestureActiveRef = useRef(false);\n  const [isTwoFingerGestureActive, setIsTwoFingerGestureActive] = useState(false);'
);

// 2. resetTouchGestureState
content = content.replace(
  '    setIsTwoFingerGestureActive(false);\n    if (pinchFrameRef.current !== null) {',
  '    isTwoFingerGestureActiveRef.current = false;\n    setIsTwoFingerGestureActive(false);\n    if (pinchFrameRef.current !== null) {'
);

// 3. handleScorePointerDownCapture
content = content.replace(
  '      singleTouchPanRef.current = null;\n      suppressTouchUntilReleaseRef.current = true;\n      setIsTwoFingerGestureActive(true);',
  '      singleTouchPanRef.current = null;\n      suppressTouchUntilReleaseRef.current = true;\n      isTwoFingerGestureActiveRef.current = true;\n      setIsTwoFingerGestureActive(true);'
);

// 4. handleScorePointerUpCapture
content = content.replace(
  "    touchPointersRef.current.delete(event.pointerId);\n    \n    if (isTwoFingerGestureActive) {\n      event.preventDefault();\n      event.stopPropagation();\n    }",
  "    const wasTwoFingerGestureActive = isTwoFingerGestureActiveRef.current;\n    \n    touchPointersRef.current.delete(event.pointerId);\n    \n    if (wasTwoFingerGestureActive) {\n      event.preventDefault();\n      event.stopPropagation();\n    }"
);

// 5. handleScorePointerUpCapture - size < 2
content = content.replace(
  '      pinchSessionRef.current = null;\n      setIsTwoFingerGestureActive(false);\n    }',
  '      pinchSessionRef.current = null;\n      isTwoFingerGestureActiveRef.current = false;\n      setIsTwoFingerGestureActive(false);\n    }'
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('Patch complete.');
