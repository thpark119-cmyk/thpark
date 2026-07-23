const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/  const \[isTwoFingerGestureActive, setIsTwoFingerGestureActive\] = useState\(false\);\n/m, `  const [isTwoFingerGestureActive, setIsTwoFingerGestureActive] = useState(false);
  const [touchGestureSessionId, setTouchGestureSessionId] = useState(0);\n`);

code = code.replace(/      window\.dispatchEvent\(new Event\(SCORE_TWO_FINGER_GESTURE_START_EVENT\)\);\n/g, '      setTouchGestureSessionId(val => val + 1);\n');

code = code.replace(/<PdfPageCanvas\n/g, '<PdfPageCanvas\n                    touchGestureSessionId={touchGestureSessionId}\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
