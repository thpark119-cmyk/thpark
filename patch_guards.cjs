const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const derivedBooleans = `
  const annotationDirtyStatus: AnnotationPersistenceDirtyStatusV2 = useMemo(() => {
    if (!annotationCleanBaseline) return 'unavailable';
    
    // Check UID match (if user uid is undefined/null, baseline uid must be null)
    const currentUid = user?.uid ?? null;
    if (currentUid !== annotationCleanBaseline.uid) return 'unavailable';

    // Check identity match
    if (
      !persistenceStorageIdentity ||
      persistenceStorageIdentity.repertoireId !== annotationCleanBaseline.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== annotationCleanBaseline.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== annotationCleanBaseline.identity.sourceStoragePath
    ) {
      return 'unavailable';
    }

    // Check document instance match
    if (documentInstanceIdRef.current !== annotationCleanBaseline.documentInstanceId) {
      return 'unavailable';
    }

    return arePersistenceRoundTripStrokesEqualV2(
      currentDocumentStrokes,
      annotationCleanBaseline.strokes
    ) ? 'clean' : 'dirty';
  }, [annotationCleanBaseline, currentDocumentStrokes, user, persistenceStorageIdentity]);

  const hasCurrentAnnotationWork = 
    currentDocumentStrokes.length > 0 ||
    annotationHistory.undoStack.length > 0 ||
    annotationHistory.redoStack.length > 0;

  const shouldConfirmAnnotationReplacement = 
    annotationDirtyStatus === 'dirty' ||
    (annotationDirtyStatus === 'unavailable' && hasCurrentAnnotationWork);
`;

code = code.replace(
  /  const annotationDirtyStatus: AnnotationPersistenceDirtyStatusV2 = useMemo\(\(\) => \{[\s\S]*?\}\, \[annotationCleanBaseline\, currentDocumentStrokes\, user\, persistenceStorageIdentity\]\)\;/m,
  derivedBooleans
);

const handleFileChangeBody = `
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    
    if (!file || !engineRef.current) return;

    if (shouldConfirmAnnotationReplacement) {
      const confirmed = window.confirm(
        '현재 악보에 저장되지 않은 필기 변경이 있습니다.\\n' +
        'PDF를 다시 열거나 다른 PDF를 열면 현재 변경이 사라집니다.\\n' +
        '계속하시겠습니까?'
      );

      if (!confirmed) {
        return;
      }
    }
`;

code = code.replace(
  /  const handleFileChange = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{\n    const file = e\.target\.files\?\.\[0\];\n    e\.target\.value = '';\n    \n    if \(\!file \|\| \!engineRef\.current\) return;/m,
  handleFileChangeBody
);

fs.writeFileSync(file, code);
