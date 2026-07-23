const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/        touchGestureSessionId=\{touchGestureSessionId\}\n                    touchGestureSessionId=\{touchGestureSessionId\}\n/g, '                    touchGestureSessionId={touchGestureSessionId}\n');

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
