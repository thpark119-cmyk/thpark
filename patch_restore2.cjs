const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const restoreSuccess = `
    setAnnotationRestoreDiagnostic({
      status: 'restored',
      storagePath: loadedAnnotationSnapshot.storagePath,
      loadedStrokeCount: loadedStrokeCount,
      loadedPointCount: loadedPointCount,
      beforeStrokeCount: annotationHistory.completedStrokes.length,
      restoredStrokeCount: loadedStrokeCount,
      restoredPointCount: loadedPointCount,
      currentDocumentInstanceId: currentInstanceId,
      undoDepthAfterRestore: 0,
      redoDepthAfterRestore: 0,
      nextStrokeIdCounter: nextCounter,
      errorCode: null,
      errorMessage: null
    });
    
    setAnnotationCleanBaseline({
      uid: user.uid,
      identity: persistenceStorageIdentity,
      documentInstanceId: currentInstanceId,
      source: 'restored',
      strokes: [...restoredStrokes]
    });
    
    setLoadedAnnotationSnapshot(null);
`;

code = code.replace(
  `    setAnnotationRestoreDiagnostic({
      status: 'restored',
      storagePath: loadedAnnotationSnapshot.storagePath,
      loadedStrokeCount: loadedStrokeCount,
      loadedPointCount: loadedPointCount,
      beforeStrokeCount: annotationHistory.completedStrokes.length,
      restoredStrokeCount: loadedStrokeCount,
      restoredPointCount: loadedPointCount,
      currentDocumentInstanceId: currentInstanceId,
      undoDepthAfterRestore: 0,
      redoDepthAfterRestore: 0,
      nextStrokeIdCounter: nextCounter,
      errorCode: null,
      errorMessage: null
    });
    
    setLoadedAnnotationSnapshot(null);`,
  restoreSuccess
);

fs.writeFileSync(file, code);
