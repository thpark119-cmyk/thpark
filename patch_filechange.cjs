const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const fileChange = `
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
    setAnnotationCleanBaseline(null);
    const nextStorageIdentity = createLabStorageIdentityV2(file);
`;

code = code.replace(
  "    setLoadedAnnotationSnapshot(null);\n    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());\n    const nextStorageIdentity = createLabStorageIdentityV2(file);",
  fileChange
);

fs.writeFileSync(file, code);
