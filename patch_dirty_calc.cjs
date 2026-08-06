const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const dirtyCalc = `
  const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;

  const currentDocumentStrokes = useMemo(() => {
    return annotationHistory.completedStrokes.filter(
      stroke => stroke.documentInstanceId === documentInstanceIdRef.current
    );
  }, [annotationHistory.completedStrokes]);

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
`;

code = code.replace(
  "  const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;",
  dirtyCalc
);

fs.writeFileSync(file, code);
