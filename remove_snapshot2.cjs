const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

// I will use regex or simple string replacements to remove those parts
code = code.replace(/  const disposePinchSnapshot = useCallback\([\s\S]*?^  \}, \[\]\);\n/m, '');
code = code.replace(/  const removePinchSnapshot = useCallback\([\s\S]*?^  \}, \[disposePinchSnapshot\]\);\n/m, '');
code = code.replace(/  const createPinchSnapshot = useCallback\([\s\S]*?^  \}, \[[a-zA-Z0-9_,?\. ]*\]\);\n/m, '');
code = code.replace(/  const isPinchSnapshotReplacementReady = useCallback\([\s\S]*?^  \}, \[[a-zA-Z0-9_,?\. ]*\]\);\n/m, '');
code = code.replace(/  const schedulePinchSnapshotRemoval = useCallback\([\s\S]*?^  \}, \[[a-zA-Z0-9_,?\. ]*\]\);\n/m, '');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
