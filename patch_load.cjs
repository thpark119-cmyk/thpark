const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const handleSaveTop = `
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;
    
    storageLoadSequenceRef.current += 1;
    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
`;

code = code.replace(
  "    if (persistenceStorageSaveDiagnostic.status === 'saving') return;\n    if (persistenceStorageLoadDiagnostic.status === 'loading') return;\n    \n    storageLoadSequenceRef.current += 1;\n    setPersistenceStorageLoadDiagnostic(createIdlePersistenceStorageLoadDiagnosticV2());",
  handleSaveTop
);

const handleLoadTop = `
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    if (persistenceStorageLoadDiagnostic.status === 'loading') return;
    if (annotationRestoreDiagnostic.status === 'restoring') return;

    const currentLoadStorageSeq = ++storageLoadSequenceRef.current;
    const currentInstanceId = documentInstanceIdRef.current;
    const currentIdentity = persistenceStorageIdentity;
    const currentUid = user.uid;

    setPersistenceStorageLoadDiagnostic({
      ...createIdlePersistenceStorageLoadDiagnosticV2(),
      status: 'loading'
    });
    setLoadedAnnotationSnapshot(null);
    setAnnotationRestoreDiagnostic(createIdleAnnotationRestoreDiagnosticV2());
`;

code = code.replace(
  "    if (persistenceStorageSaveDiagnostic.status === 'saving') return;\n    if (persistenceStorageLoadDiagnostic.status === 'loading') return;\n\n    const currentLoadStorageSeq = ++storageLoadSequenceRef.current;\n    const currentInstanceId = documentInstanceIdRef.current;\n    const currentIdentity = persistenceStorageIdentity;\n    const currentUid = user.uid;\n\n    setPersistenceStorageLoadDiagnostic({\n      ...createIdlePersistenceStorageLoadDiagnosticV2(),\n      status: 'loading'\n    });",
  handleLoadTop
);

const handleLoadSuccess = `
        setPersistenceStorageLoadDiagnostic({
          status: 'loaded',
          currentDocumentInstanceId: currentInstanceId,
          persistedDocumentInstanceId: null,
          storagePath: result.storagePath,
          loadedPageCount,
          loadedStrokeCount,
          loadedPointCount,
          loadedPenStrokeCount,
          loadedHighlighterStrokeCount,
          jsonByteLength: result.jsonByteLength,
          codecValidationPassed: true,
          identityValidationPassed: true,
          currentMemoryFidelityStatus,
          errorCode: null,
          errorPath: null,
          errorMessage: null
        });

        setLoadedAnnotationSnapshot({
          uid: currentUid,
          identity: currentIdentity,
          storagePath: result.storagePath,
          document: doc,
          jsonByteLength: result.jsonByteLength
        });
        
        setAnnotationRestoreDiagnostic({
          ...createIdleAnnotationRestoreDiagnosticV2(),
          status: 'ready'
        });
`;

code = code.replace(
  "        setPersistenceStorageLoadDiagnostic({\n          status: 'loaded',\n          currentDocumentInstanceId: currentInstanceId,\n          persistedDocumentInstanceId: null,\n          storagePath: result.storagePath,\n          loadedPageCount,\n          loadedStrokeCount,\n          loadedPointCount,\n          loadedPenStrokeCount,\n          loadedHighlighterStrokeCount,\n          jsonByteLength: result.jsonByteLength,\n          codecValidationPassed: true,\n          identityValidationPassed: true,\n          currentMemoryFidelityStatus,\n          errorCode: null,\n          errorPath: null,\n          errorMessage: null\n        });",
  handleLoadSuccess
);

fs.writeFileSync(file, code);
