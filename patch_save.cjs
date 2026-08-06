const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const saveSuccess = `
      if (result.status === 'saved') {
        setPersistenceStorageSaveDiagnostic({
          status: 'saved',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: result.jsonByteLength,
          errorCode: null,
          errorPath: null,
          errorMessage: null
        });

        setAnnotationCleanBaseline({
          uid: currentUid,
          identity: currentIdentity,
          documentInstanceId: currentInstanceId,
          source: 'saved',
          strokes: [...sourceStrokes]
        });
      } else if (result.status === 'invalid') {`;

code = code.replace(
  `      if (result.status === 'saved') {
        setPersistenceStorageSaveDiagnostic({
          status: 'saved',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: result.jsonByteLength,
          errorCode: null,
          errorPath: null,
          errorMessage: null
        });
      } else if (result.status === 'invalid') {`,
  saveSuccess
);

fs.writeFileSync(file, code);
