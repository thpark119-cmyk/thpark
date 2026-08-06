const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const restoreLogic = `
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

    if (shouldConfirmAnnotationReplacement) {
      const confirmed = window.confirm(
        '현재 악보에 저장되지 않은 필기 변경이 있습니다.\\n' +
        '불러온 snapshot으로 복원하면 현재 변경이 사라집니다.\\n' +
        '계속하시겠습니까?'
      );

      if (!confirmed) {
        setAnnotationRestoreDiagnostic(prev => ({
          ...prev,
          status: 'cancelled'
        }));
        return;
      }
    }

    setAnnotationRestoreDiagnostic(prev => ({
      ...prev,
      status: 'restoring'
    }));
`;

const originalRestoreLogic = `
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
`;

code = code.replace(
  originalRestoreLogic.trim(),
  restoreLogic.trim()
);

fs.writeFileSync(file, code);
