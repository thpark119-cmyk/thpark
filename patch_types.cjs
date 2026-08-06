const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const typeDefs = `
interface LoadedAnnotationSnapshotV2 {
  uid: string;
  identity: AnnotationPersistenceIdentityV2;
  storagePath: string;
  document: AnnotationPersistenceDocumentV2;
  jsonByteLength: number;
}

type AnnotationRestoreStatusV2 =
  | 'idle'
  | 'ready'
  | 'restoring'
  | 'restored'
  | 'cancelled'
  | 'blocked'
  | 'error';

interface AnnotationRestoreDiagnosticV2 {
  status: AnnotationRestoreStatusV2;
  storagePath: string | null;
  loadedStrokeCount: number;
  loadedPointCount: number;
  beforeStrokeCount: number;
  restoredStrokeCount: number;
  restoredPointCount: number;
  currentDocumentInstanceId: number | null;
  undoDepthAfterRestore: number;
  redoDepthAfterRestore: number;
  nextStrokeIdCounter: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function createIdleAnnotationRestoreDiagnosticV2(): AnnotationRestoreDiagnosticV2 {
  return {
    status: 'idle',
    storagePath: null,
    loadedStrokeCount: 0,
    loadedPointCount: 0,
    beforeStrokeCount: 0,
    restoredStrokeCount: 0,
    restoredPointCount: 0,
    currentDocumentInstanceId: null,
    undoDepthAfterRestore: 0,
    redoDepthAfterRestore: 0,
    nextStrokeIdCounter: null,
    errorCode: null,
    errorMessage: null
  };
}

function arePersistenceRoundTripStrokesEqualV2(`;

code = code.replace("function arePersistenceRoundTripStrokesEqualV2(", typeDefs);

const stateVars = `
  const [persistenceStorageIdentity, setPersistenceStorageIdentity] = useState<AnnotationPersistenceIdentityV2 | null>(null);
  const [persistenceStorageSaveDiagnostic, setPersistenceStorageSaveDiagnostic] = useState<PersistenceStorageSaveDiagnosticV2>(createIdlePersistenceStorageSaveDiagnosticV2());
  const [persistenceStorageLoadDiagnostic, setPersistenceStorageLoadDiagnostic] = useState<PersistenceStorageLoadDiagnosticV2>(createIdlePersistenceStorageLoadDiagnosticV2());
  const [loadedAnnotationSnapshot, setLoadedAnnotationSnapshot] = useState<LoadedAnnotationSnapshotV2 | null>(null);
  const [annotationRestoreDiagnostic, setAnnotationRestoreDiagnostic] = useState<AnnotationRestoreDiagnosticV2>(createIdleAnnotationRestoreDiagnosticV2());
  const storageSaveSequenceRef = useRef(0);
  const storageLoadSequenceRef = useRef(0);
`;

code = code.replace(
  "  const [persistenceStorageIdentity, setPersistenceStorageIdentity] = useState<AnnotationPersistenceIdentityV2 | null>(null);\n  const [persistenceStorageSaveDiagnostic, setPersistenceStorageSaveDiagnostic] = useState<PersistenceStorageSaveDiagnosticV2>(createIdlePersistenceStorageSaveDiagnosticV2());\n  const [persistenceStorageLoadDiagnostic, setPersistenceStorageLoadDiagnostic] = useState<PersistenceStorageLoadDiagnosticV2>(createIdlePersistenceStorageLoadDiagnosticV2());\n  const storageSaveSequenceRef = useRef(0);\n  const storageLoadSequenceRef = useRef(0);",
  stateVars
);

const handleFileChangeBot = `
    storageSaveSequenceRef.current += 1;
    storageLoadSequenceRef.current += 1;
    setPersistenceStorageIdentity(null);
    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
    const nextStorageIdentity = createLabStorageIdentityV2(file);
`;

code = code.replace(
  "    storageSaveSequenceRef.current += 1;\n    storageLoadSequenceRef.current += 1;\n    setPersistenceStorageIdentity(null);\n    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());\n    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());\n    const nextStorageIdentity = createLabStorageIdentityV2(file);",
  handleFileChangeBot
);

const historyEffectAndHandler = `
  useEffect(() => {
    storageSaveSequenceRef.current += 1;
    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
  }, [annotationHistory.completedStrokes]);
`;

code = code.replace(
  "  useEffect(() => {\n    storageSaveSequenceRef.current += 1;\n    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());\n  }, [annotationHistory.completedStrokes]);",
  historyEffectAndHandler
);

fs.writeFileSync(file, code);
