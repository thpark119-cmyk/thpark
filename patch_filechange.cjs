const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const replaceWith = "    if (!file || !engineRef.current) return;\n\n    automaticSnapshotLookupAttemptKeyRef.current = null;\n    setAutomaticSnapshotLookupDiagnostic(createIdleAutomaticSnapshotLookupDiagnosticV2());\n";

code = code.replace("    if (!file || !engineRef.current) return;\n", replaceWith);
fs.writeFileSync(file, code);
