const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const typeDefs = `
type AnnotationPersistenceDirtyStatusV2 =
  | 'unavailable'
  | 'clean'
  | 'dirty';

type AnnotationCleanBaselineSourceV2 =
  | 'initial-empty'
  | 'saved'
  | 'restored';

interface AnnotationCleanBaselineV2 {
  uid: string | null;
  identity: AnnotationPersistenceIdentityV2;
  documentInstanceId: number;
  source: AnnotationCleanBaselineSourceV2;
  strokes: readonly AnnotationCompletedStrokeV2[];
}

function arePersistenceRoundTripStrokesEqualV2(`;

code = code.replace("function arePersistenceRoundTripStrokesEqualV2(", typeDefs);

const stateVars = `
  const [loadedAnnotationSnapshot, setLoadedAnnotationSnapshot] = useState<LoadedAnnotationSnapshotV2 | null>(null);
  const [annotationRestoreDiagnostic, setAnnotationRestoreDiagnostic] = useState<AnnotationRestoreDiagnosticV2>(createIdleAnnotationRestoreDiagnosticV2());
  const [annotationCleanBaseline, setAnnotationCleanBaseline] = useState<AnnotationCleanBaselineV2 | null>(null);
`;

code = code.replace(
  "  const [loadedAnnotationSnapshot, setLoadedAnnotationSnapshot] = useState<LoadedAnnotationSnapshotV2 | null>(null);\n  const [annotationRestoreDiagnostic, setAnnotationRestoreDiagnostic] = useState<AnnotationRestoreDiagnosticV2>(createIdleAnnotationRestoreDiagnosticV2());",
  stateVars
);

fs.writeFileSync(file, code);
