const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const statesToAdd = `  const [annotationCleanBaseline, setAnnotationCleanBaseline] = useState<AnnotationCleanBaselineV2 | null>(null);

  const [automaticSnapshotLookupDiagnostic, setAutomaticSnapshotLookupDiagnostic] = useState<AutomaticSnapshotLookupDiagnosticV2>(createIdleAutomaticSnapshotLookupDiagnosticV2());
  const automaticSnapshotLookupAttemptKeyRef = useRef<string | null>(null);`;

code = code.replace("  const [annotationCleanBaseline, setAnnotationCleanBaseline] = useState<AnnotationCleanBaselineV2 | null>(null);", statesToAdd);

fs.writeFileSync(file, code);
