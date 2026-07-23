const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

code = code.replace(/  isTwoFingerGestureActive: boolean;\n/m, `  isTwoFingerGestureActive: boolean;
  touchGestureSessionId?: number;\n`);

code = code.replace(/  isTwoFingerGestureActive\n}: AnnotationLayerProps\) => \{/m, `  isTwoFingerGestureActive,
  touchGestureSessionId
}: AnnotationLayerProps) => {`);

code = code.replace(/  useEffect\(\(\) => \{\n    const handleTwoFingerGestureStart = \(\) => \{\n      cancelActiveAnnotationSession\(\);\n    \};\n\n    window\.addEventListener\(SCORE_TWO_FINGER_GESTURE_START_EVENT, handleTwoFingerGestureStart\);\n\n    return \(\) => \{\n      window\.removeEventListener\(SCORE_TWO_FINGER_GESTURE_START_EVENT, handleTwoFingerGestureStart\);\n    \};\n  \}, \[cancelActiveAnnotationSession\]\);\n/m, `  useEffect(() => {
    cancelActiveAnnotationSession();
  }, [touchGestureSessionId, cancelActiveAnnotationSession]);\n`);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
