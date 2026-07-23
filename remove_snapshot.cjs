const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

// Remove snapshot type
code = code.replace(/interface ActivePinchSnapshot \{[\s\S]*?\n\}\n/, '');

// Remove snapshot refs
code = code.replace(/  const activePinchSnapshotRef = useRef<ActivePinchSnapshot \| null>\(null\);\n/, '');
code = code.replace(/  const pinchSnapshotGenerationRef = useRef<number>\(0\);\n/, '');
code = code.replace(/  const pinchSnapshotRemovalFrameRef = useRef<number \| null>\(null\);\n/, '');

// Remove snapshot functions
code = code.replace(/  const disposePinchSnapshot = useCallback\(\(snapshot: ActivePinchSnapshot\): void => \{[\s\S]*?  \}, \[\]\);\n\n/, '');
code = code.replace(/  const removePinchSnapshot = useCallback\(\(expectedGeneration\?: number\): boolean => \{[\s\S]*?  \}, \[disposePinchSnapshot\]\);\n\n/, '');
code = code.replace(/  const createPinchSnapshot = useCallback\(\(\): ActivePinchSnapshot \| null => \{[\s\S]*?  \}, \[currentPageRef, file, getScorePageSurface\]\);\n\n/, '');
code = code.replace(/  const isPinchSnapshotReplacementReady = useCallback\(\(snapshot: ActivePinchSnapshot\): boolean => \{[\s\S]*?  \}, \[file\?.id, file\?.storagePath, getScorePageSurface, isCanvasVisiblyReady\]\);\n\n/, '');
code = code.replace(/  const schedulePinchSnapshotRemoval = useCallback\(\(snapshot: ActivePinchSnapshot\) => \{[\s\S]*?  \}, \[file\?.id, file\?.storagePath, isPinchSnapshotReplacementReady, removePinchSnapshot\]\);\n\n/, '');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
