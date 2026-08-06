const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const regexLoad = /const handleLoadPersistenceFromStorage = async \(\) => {([\s\S]*?)  };\n\n\n  const handleRestoreLoadedSnapshot = async \(\) => {/m;

const match = code.match(regexLoad);
if (!match) {
  console.log('regexLoad match failed');
  process.exit(1);
}

let body = match[1];

body = body.replace(
  "    const currentUid = user.uid;",
  `    const currentUid = user.uid;

    if (origin === 'automatic') {
      setAutomaticSnapshotLookupDiagnostic({
        ...createIdleAutomaticSnapshotLookupDiagnosticV2(),
        status: 'looking-up',
        documentInstanceId: currentInstanceId
      });
    }`
);

body = body.replace(
  "        setLoadedAnnotationSnapshot({",
  `        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'found',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: null,
            errorMessage: null
          });
        }

        setLoadedAnnotationSnapshot({`
);

body = body.replace(
  "        setPersistenceStorageLoadDiagnostic({\n          ...createIdlePersistenceStorageLoadDiagnosticV2(),\n          status: 'not-found',",
  `        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'not-found',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: null,
            errorMessage: null
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'not-found',`
);

body = body.replace(
  "        setPersistenceStorageLoadDiagnostic({\n          ...createIdlePersistenceStorageLoadDiagnosticV2(),\n          status: 'invalid',",
  `        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'invalid',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: result.code,
            errorMessage: result.message
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'invalid',`
);

body = body.replace(
  "        setPersistenceStorageLoadDiagnostic({\n          ...createIdlePersistenceStorageLoadDiagnosticV2(),\n          status: 'error',",
  `        if (origin === 'automatic') {
          setAutomaticSnapshotLookupDiagnostic({
            status: 'error',
            documentInstanceId: currentInstanceId,
            storagePath: result.storagePath,
            errorCode: result.code,
            errorMessage: result.message
          });
        }
        setPersistenceStorageLoadDiagnostic({
          ...createIdlePersistenceStorageLoadDiagnosticV2(),
          status: 'error',`
);

body = body.replace(
  "      setPersistenceStorageLoadDiagnostic({\n        ...createIdlePersistenceStorageLoadDiagnosticV2(),\n        status: 'error',\n        errorCode: 'unexpected-exception',",
  `      if (origin === 'automatic') {
        setAutomaticSnapshotLookupDiagnostic({
          ...createIdleAutomaticSnapshotLookupDiagnosticV2(),
          status: 'error',
          errorCode: 'unexpected-exception',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
      setPersistenceStorageLoadDiagnostic({
        ...createIdlePersistenceStorageLoadDiagnosticV2(),
        status: 'error',
        errorCode: 'unexpected-exception',`
);

const newLoad = `const handleLoadPersistenceFromStorage = useCallback(async (origin: PersistenceStorageLoadOriginV2) => {${body}  }, [
    user,
    docReady,
    persistenceStorageIdentity,
    isLoading,
    inputStatus.phase,
    inputStatus.activePointerId,
    transformInfo?.activePointerCount,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    annotationHistory.completedStrokes
  ]);

  useEffect(() => {
    if (
      !user?.uid ||
      !docReady ||
      isLoading ||
      !persistenceStorageIdentity ||
      persistenceStorageSaveDiagnostic.status === 'saving' ||
      persistenceStorageLoadDiagnostic.status === 'loading' ||
      annotationRestoreDiagnostic.status === 'restoring'
    ) {
      return;
    }

    const lookupKey = JSON.stringify([
      user.uid,
      documentInstanceIdRef.current,
      persistenceStorageIdentity.repertoireId,
      persistenceStorageIdentity.fileId,
      persistenceStorageIdentity.sourceStoragePath
    ]);

    if (automaticSnapshotLookupAttemptKeyRef.current === lookupKey) {
      return;
    }

    automaticSnapshotLookupAttemptKeyRef.current = lookupKey;
    void handleLoadPersistenceFromStorage('automatic');
  }, [
    user?.uid,
    docReady,
    isLoading,
    persistenceStorageIdentity,
    persistenceStorageSaveDiagnostic.status,
    persistenceStorageLoadDiagnostic.status,
    annotationRestoreDiagnostic.status,
    handleLoadPersistenceFromStorage
  ]);\n\n\n  const handleRestoreLoadedSnapshot = async () => {`;

code = code.replace(regexLoad, newLoad);

// add useCallback if not imported, wait V2GestureBaselineLab imports useCallback
if (!code.includes('useCallback')) {
  code = code.replace(/import React, {([^}]*)} from 'react';/, "import React, { useCallback, $1 } from 'react';");
}


// Replace button onClick
code = code.replace(
  "onClick={handleLoadPersistenceFromStorage}",
  "onClick={() => { void handleLoadPersistenceFromStorage('manual'); }}"
);

fs.writeFileSync(file, code);
