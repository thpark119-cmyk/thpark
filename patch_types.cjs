const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const typesToAdd = `
type PersistenceStorageLoadOriginV2 = 'manual' | 'automatic';

type AutomaticSnapshotLookupStatusV2 =
  | 'idle'
  | 'looking-up'
  | 'found'
  | 'not-found'
  | 'invalid'
  | 'error';

interface AutomaticSnapshotLookupDiagnosticV2 {
  status: AutomaticSnapshotLookupStatusV2;
  documentInstanceId: number | null;
  storagePath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function createIdleAutomaticSnapshotLookupDiagnosticV2(): AutomaticSnapshotLookupDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    storagePath: null,
    errorCode: null,
    errorMessage: null
  };
}

interface PersistenceStorageLoadDiagnosticV2 {`;

code = code.replace("interface PersistenceStorageLoadDiagnosticV2 {", typesToAdd);

fs.writeFileSync(file, code);
