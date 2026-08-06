const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import {",
  "import {\n  saveAnnotationPersistenceDocumentV2\n} from './annotationPersistenceStorageV2';\nimport {"
);

const typeDefs = `
function createLabStorageIdentityV2(
  file: File
): AnnotationPersistenceIdentityV2 {
  const encodedFileName = encodeURIComponent(file.name);
  return {
    repertoireId: 'v2-renderer-lab',
    fileId: \`local-\${encodedFileName}-\${file.size}-\${file.lastModified}\`,
    sourceStoragePath: \`local-lab://\${encodedFileName}?size=\${file.size}&lastModified=\${file.lastModified}\`
  };
}

type PersistenceStorageSaveStatusV2 =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'invalid'
  | 'error';

interface PersistenceStorageSaveDiagnosticV2 {
  status: PersistenceStorageSaveStatusV2;
  documentInstanceId: number | null;
  storagePath: string | null;
  sourceStrokeCount: number;
  sourcePointCount: number;
  jsonByteLength: number;
  errorCode: string | null;
  errorPath: string | null;
  errorMessage: string | null;
}

function createIdlePersistenceStorageSaveDiagnosticV2(): PersistenceStorageSaveDiagnosticV2 {
  return {
    status: 'idle',
    documentInstanceId: null,
    storagePath: null,
    sourceStrokeCount: 0,
    sourcePointCount: 0,
    jsonByteLength: 0,
    errorCode: null,
    errorPath: null,
    errorMessage: null
  };
}

function arePersistenceRoundTripStrokesEqualV2(`;

code = code.replace("function arePersistenceRoundTripStrokesEqualV2(", typeDefs);

const stateVars = `
  const [persistenceStorageIdentity, setPersistenceStorageIdentity] = useState<AnnotationPersistenceIdentityV2 | null>(null);
  const [persistenceStorageSaveDiagnostic, setPersistenceStorageSaveDiagnostic] = useState<PersistenceStorageSaveDiagnosticV2>(createIdlePersistenceStorageSaveDiagnosticV2());
  const storageSaveSequenceRef = useRef(0);

  const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;`;

code = code.replace(
  "const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;",
  stateVars
);

const handleFileChangeTop = `
    if (viewportRef.current) {
      viewportRef.current.resetTransform();
    }

    storageSaveSequenceRef.current += 1;
    setPersistenceStorageIdentity(null);
    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
    const nextStorageIdentity = createLabStorageIdentityV2(file);

    setDocReady(false);`;

code = code.replace(
  "    if (viewportRef.current) {\n      viewportRef.current.resetTransform();\n    }\n\n    setDocReady(false);",
  handleFileChangeTop
);

const handleFileChangeBot = `
      documentInstanceIdRef.current += 1;
      setNumPages(result.numPages);
      setPersistenceStorageIdentity(nextStorageIdentity);
      setDocReady(true);`;

code = code.replace(
  "      documentInstanceIdRef.current += 1;\n      setNumPages(result.numPages);\n      setDocReady(true);",
  handleFileChangeBot
);

const cleanupHook = `
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
      storageSaveSequenceRef.current += 1;
      if (engineRef.current) {`;

code = code.replace(
  "    return () => {\n      mountedRef.current = false;\n      loadSequenceRef.current += 1;\n      if (engineRef.current) {",
  cleanupHook
);

const historyEffectAndHandler = `
  useEffect(() => {
    storageSaveSequenceRef.current += 1;
    setPersistenceStorageSaveDiagnostic(createIdlePersistenceStorageSaveDiagnosticV2());
  }, [annotationHistory.completedStrokes]);

  const handleSavePersistenceToStorage = async () => {
    if (!user || !user.uid) return;
    if (!docReady || !currentBaseline || !persistenceStorageIdentity) return;
    if (isLoading || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null) return;
    if (isGestureActive || (transformInfo?.activePointerCount ?? 0) > 0) return;
    if (persistenceStorageSaveDiagnostic.status === 'saving') return;
    
    const sourceStrokes = annotationHistory.completedStrokes.filter(
      stroke => stroke.documentInstanceId === documentInstanceIdRef.current
    );
    if (sourceStrokes.length === 0) return;

    const currentSaveSeq = ++storageSaveSequenceRef.current;
    const currentInstanceId = documentInstanceIdRef.current;
    const currentIdentity = persistenceStorageIdentity;
    const now = new Date().toISOString();

    const document = createAnnotationPersistenceDocumentV2({
      identity: currentIdentity,
      documentInstanceId: currentInstanceId,
      strokes: sourceStrokes,
      createdAt: now,
      updatedAt: now
    });

    let sourcePointCount = 0;
    for (const s of sourceStrokes) {
      sourcePointCount += s.points.length;
    }

    setPersistenceStorageSaveDiagnostic({
      status: 'saving',
      documentInstanceId: currentInstanceId,
      storagePath: null,
      sourceStrokeCount: sourceStrokes.length,
      sourcePointCount,
      jsonByteLength: 0,
      errorCode: null,
      errorPath: null,
      errorMessage: null
    });

    try {
      const result = await saveAnnotationPersistenceDocumentV2({
        uid: user.uid,
        identity: currentIdentity,
        document
      });

      if (!mountedRef.current) return;
      if (storageSaveSequenceRef.current !== currentSaveSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

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
      } else if (result.status === 'invalid') {
        setPersistenceStorageSaveDiagnostic({
          status: 'invalid',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: 0,
          errorCode: result.code,
          errorPath: result.path,
          errorMessage: result.message
        });
      } else if (result.status === 'error') {
        setPersistenceStorageSaveDiagnostic({
          status: 'error',
          documentInstanceId: currentInstanceId,
          storagePath: result.storagePath,
          sourceStrokeCount: sourceStrokes.length,
          sourcePointCount,
          jsonByteLength: 0,
          errorCode: result.code,
          errorPath: null,
          errorMessage: result.message
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (storageSaveSequenceRef.current !== currentSaveSeq) return;
      if (documentInstanceIdRef.current !== currentInstanceId) return;
      if (!persistenceStorageIdentity) return;
      if (
        persistenceStorageIdentity.repertoireId !== currentIdentity.repertoireId ||
        persistenceStorageIdentity.fileId !== currentIdentity.fileId ||
        persistenceStorageIdentity.sourceStoragePath !== currentIdentity.sourceStoragePath
      ) {
        return;
      }

      setPersistenceStorageSaveDiagnostic({
        status: 'error',
        documentInstanceId: currentInstanceId,
        storagePath: null,
        sourceStrokeCount: sourceStrokes.length,
        sourcePointCount,
        jsonByteLength: 0,
        errorCode: 'unexpected-exception',
        errorPath: null,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {`;

code = code.replace(
  "  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {",
  historyEffectAndHandler
);

// UI adjustments

code = code.replace(
  "        <h1 className=\"text-xl font-bold text-brand-light\">[4E-C4C In-Memory Persistence Round-Trip Diagnostic]</h1>",
  "        <h1 className=\"text-xl font-bold text-brand-light\">[4E-C4E-A Manual Firebase Storage Save Diagnostic]</h1>"
);

code = code.replace(
  "          Per-stroke style and memory history active<br/>\n          Persistence codec round-trip diagnostic connected<br/>\n          Firebase storage disabled<br/>\n          Persistent save/load disabled<br/>\n          Spatial eraser active",
  "          In-memory codec diagnostic active<br/>\n          Manual Firebase Storage save diagnostic active<br/>\n          Persistent load disabled<br/>\n          Automatic persistence disabled<br/>\n          History replacement disabled<br/>\n          Spatial eraser active"
);

code = code.replace(
  "              <div>Annotation Stage: 4E-C4C</div>",
  "              <div>Annotation Stage: 4E-C4E-A</div>"
);

code = code.replace(
  "              <div>Persistence Diagnostic: IN-MEMORY ONLY</div>\n              <div>Persistent Save/Load: DISABLED</div>\n              <div>Firebase Storage: DISABLED</div>",
  "              <div>In-Memory Diagnostic: CONNECTED</div>\n              <div>Firebase Storage Adapter: CONNECTED</div>\n              <div>Persistent Save: MANUAL DIAGNOSTIC ONLY</div>\n              <div>Persistent Load: DISABLED</div>\n              <div>Automatic Save: DISABLED</div>\n              <div>History Replacement: DISABLED</div>"
);

code = code.replace(
  "                <div>Firebase Storage: DISABLED</div>",
  "                <div>Firebase Storage: NOT USED BY THIS TEST</div>"
);

const newDiagnosticUI = `
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Firebase Storage Save Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: MANUAL SAVE ONLY</div>
                <div>Firebase Storage: ADAPTER CONNECTED</div>
                <div>Automatic Save: DISABLED</div>
                <div>Persistent Load: DISABLED</div>
                <div>History Replacement: DISABLED</div>
              </div>
              
              <button
                type="button"
                onClick={handleSavePersistenceToStorage}
                disabled={!user || !user.uid || !docReady || !currentBaseline || !persistenceStorageIdentity || isLoading || annotationHistory.completedStrokes.filter(s => s.documentInstanceId === documentInstanceIdRef.current).length === 0 || isGestureActive || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || persistenceStorageSaveDiagnostic.status === 'saving'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                {persistenceStorageSaveDiagnostic.status === 'saving' ? 'Saving...' : 'Save Current Annotation Snapshot'}
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={\`font-bold \${persistenceStorageSaveDiagnostic.status === 'saved' ? 'text-emerald-400' : (persistenceStorageSaveDiagnostic.status === 'invalid' || persistenceStorageSaveDiagnostic.status === 'error') ? 'text-red-400' : persistenceStorageSaveDiagnostic.status === 'saving' ? 'text-yellow-400' : 'text-stone-400'}\`}>
                  Status: {persistenceStorageSaveDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Document Instance: {persistenceStorageSaveDiagnostic.documentInstanceId !== null ? persistenceStorageSaveDiagnostic.documentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Storage Path: {persistenceStorageSaveDiagnostic.storagePath !== null ? persistenceStorageSaveDiagnostic.storagePath : 'NOT RUN'}</div>
                <div className="text-stone-300">Source Strokes: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.sourceStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Source Points: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.sourcePointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">JSON Bytes: {persistenceStorageSaveDiagnostic.status !== 'idle' ? persistenceStorageSaveDiagnostic.jsonByteLength : 'NOT RUN'}</div>

                {(persistenceStorageSaveDiagnostic.errorCode) && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Error Code: {persistenceStorageSaveDiagnostic.errorCode}</div>
                    {persistenceStorageSaveDiagnostic.errorPath && <div>Error Path: {persistenceStorageSaveDiagnostic.errorPath}</div>}
                    <div>Error Message: {persistenceStorageSaveDiagnostic.errorMessage}</div>
                  </div>
                )}
                {!persistenceStorageSaveDiagnostic.errorCode && persistenceStorageSaveDiagnostic.status !== 'idle' && persistenceStorageSaveDiagnostic.status !== 'saving' && (
                  <div className="mt-2 text-emerald-400 border-t border-emerald-500/20 pt-2">
                    Error: NONE
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 items-center mt-4">`;

code = code.replace(
  "            <div className=\"flex gap-2 items-center mt-4\">",
  newDiagnosticUI
);

fs.writeFileSync(file, code);
