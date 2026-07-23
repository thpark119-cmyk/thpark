const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/    pinchSnapshotGenerationRef\.current \+= 1;\n    if \(pinchSnapshotRemovalFrameRef\.current !== null\) \{\n      window\.cancelAnimationFrame\(pinchSnapshotRemovalFrameRef\.current\);\n      pinchSnapshotRemovalFrameRef\.current = null;\n    \}\n/g, '');

code = code.replace(/const PINCH_SNAPSHOT_MAX_PIXELS = 4_194_304;\nconst PINCH_SNAPSHOT_MIN_DPR = 0\.5;\nconst PINCH_SNAPSHOT_MAX_DPR = 1\.5;\nconst PINCH_SNAPSHOT_READY_TOLERANCE_PX = 3;\nconst PINCH_SNAPSHOT_STABLE_FRAMES = 2;\nconst PINCH_SNAPSHOT_MAX_READY_FRAMES = 30;\nconst PINCH_SNAPSHOT_Z_INDEX = 60;\n/g, '');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
