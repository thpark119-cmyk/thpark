const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const pdfLoad = `
      documentInstanceIdRef.current += 1;
      setNumPages(result.numPages);
      setPersistenceStorageIdentity(nextStorageIdentity);
      
      setAnnotationCleanBaseline({
        uid: user?.uid ?? null,
        identity: nextStorageIdentity,
        documentInstanceId: documentInstanceIdRef.current,
        source: 'initial-empty',
        strokes: []
      });

      setDocReady(true);
`;

code = code.replace(
  "      documentInstanceIdRef.current += 1;\n      setNumPages(result.numPages);\n      setPersistenceStorageIdentity(nextStorageIdentity);\n      setDocReady(true);",
  pdfLoad
);

fs.writeFileSync(file, code);
