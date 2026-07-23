const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/    pinchSnapshotGenerationRef\.current \+= 1;\n    if \(pinchSnapshotRemovalFrameRef\.current !== null\) \{\n      window\.cancelAnimationFrame\(pinchSnapshotRemovalFrameRef\.current\);\n      pinchSnapshotRemovalFrameRef\.current = null;\n    \}\n/m, '');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
