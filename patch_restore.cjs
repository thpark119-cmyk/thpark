const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const restoreHandler = `
  const handleRestoreLoadedSnapshot = async () => {
    if (!user || !user.uid) return;
    if (!docReady || !persistenceStorageIdentity || !loadedAnnotationSnapshot) return;
    if (isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if (isGestureActive || (transformInfo?.activePointerCount ?? 0) > 0) return;
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;

    if (
      user.uid !== loadedAnnotationSnapshot.uid ||
      persistenceStorageIdentity.repertoireId !== loadedAnnotationSnapshot.identity.repertoireId ||
      persistenceStorageIdentity.fileId !== loadedAnnotationSnapshot.identity.fileId ||
      persistenceStorageIdentity.sourceStoragePath !== loadedAnnotationSnapshot.identity.sourceStoragePath
    ) {
      setAnnotationRestoreDiagnostic(prev => ({
        ...prev,
        status: 'blocked',
        errorCode: 'identity-mismatch',
        errorMessage: 'The loaded snapshot identity does not match current document'
      }));
      return;
    }
    
    setAnnotationRestoreDiagnostic(prev => ({
      ...prev,
      status: 'restoring'
    }));
    
    if (annotationHistory.completedStrokes.length > 0 || annotationHistory.undoStack.length > 0 || annotationHistory.redoStack.length > 0) {
      const confirmed = window.confirm("현재 화면의 필기와 Undo/Redo 기록이 불러온 snapshot으로 교체됩니다.\\n저장하지 않은 변경은 사라질 수 있습니다.\\n계속하시겠습니까?");
      if (!confirmed) {
        setAnnotationRestoreDiagnostic(prev => ({
          ...prev,
          status: 'cancelled'
        }));
        return;
      }
    }

    const currentInstanceId = documentInstanceIdRef.current;
    
    let nextCounter = strokeIdCounterRef.current;
    const prefix = 'stroke-';
    
    const restoredStrokes = restoreAnnotationCompletedStrokesV2(
      loadedAnnotationSnapshot.document,
      currentInstanceId
    );
    
    let loadedStrokeCount = 0;
    let loadedPointCount = 0;
    
    for (const stroke of restoredStrokes) {
      loadedStrokeCount++;
      loadedPointCount += stroke.points.length;
      
      if (!Number.isInteger(stroke.pageNumber) || stroke.pageNumber < 1 || stroke.pageNumber > numPages) {
        setAnnotationRestoreDiagnostic(prev => ({
          ...prev,
          status: 'blocked',
          errorCode: 'page-out-of-range',
          errorMessage: \`Stroke has invalid page number: \${stroke.pageNumber}\`
        }));
        return;
      }
      
      if (stroke.id.startsWith(prefix)) {
        const numericId = Number(stroke.id.slice(prefix.length));
        if (Number.isSafeInteger(numericId) && numericId >= nextCounter) {
          nextCounter = numericId + 1;
        }
      }
    }
    
    if (loadedStrokeCount === 0) {
      setAnnotationRestoreDiagnostic(prev => ({
        ...prev,
        status: 'blocked',
        errorCode: 'empty-loaded-snapshot',
        errorMessage: 'Cannot restore an empty snapshot'
      }));
      return;
    }
    
    const emptyHistory = createEmptyHistoryV2();
    setAnnotationHistory({
      ...emptyHistory,
      completedStrokes: restoredStrokes
    });
    
    strokeIdCounterRef.current = nextCounter;
    
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
    
    setLoadedAnnotationSnapshot(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {`;

code = code.replace(
  "  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {",
  restoreHandler
);

fs.writeFileSync(file, code);
