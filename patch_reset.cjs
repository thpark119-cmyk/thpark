const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/    suppressTouchUntilReleaseRef\.current = false;\n/, '    endingTouchPointerIdsRef.current.clear();\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
