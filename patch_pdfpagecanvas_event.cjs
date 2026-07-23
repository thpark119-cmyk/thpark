const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/  isTwoFingerGestureActive: boolean;\n/m, `  isTwoFingerGestureActive: boolean;
  touchGestureSessionId?: number;\n`);

code = code.replace(/  isTwoFingerGestureActive\n}: PdfPageCanvasProps\) => \{/m, `  isTwoFingerGestureActive,
  touchGestureSessionId
}: PdfPageCanvasProps) => {`);

code = code.replace(/        isTwoFingerGestureActive=\{isTwoFingerGestureActive\}\n/g, `        isTwoFingerGestureActive={isTwoFingerGestureActive}
        touchGestureSessionId={touchGestureSessionId}\n`);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
