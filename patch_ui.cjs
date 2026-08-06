const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const titleChange = `
        <h1 className="text-xl font-bold text-brand-light">[4E-C4E-C Manual Loaded Snapshot Restore Baseline]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Pen and highlighter drawing active<br/>
          In-memory codec diagnostic active<br/>
          Manual Firebase Storage save active<br/>
          Manual Firebase Storage load and verification active<br/>
          Explicit loaded snapshot restore active<br/>
          Restore replaces current memory after confirmation<br/>
          Restored snapshot becomes a clean history baseline<br/>
          Automatic load/save disabled<br/>
          Spatial eraser active
`;
code = code.replace(
  `        <h1 className="text-xl font-bold text-brand-light">[4E-C4E-B Manual Firebase Storage Load and Verify Diagnostic]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Pen and highlighter drawing active<br/>
          In-memory codec diagnostic active<br/>
          Manual Firebase Storage save diagnostic active<br/>
          Manual Firebase Storage load and verify diagnostic active<br/>
          Automatic persistence disabled<br/>
          History replacement disabled<br/>
          Canvas restore disabled<br/>
          Spatial eraser active`,
  titleChange
);

const infoPanel = `
              <div>Annotation Stage: 4E-C4E-C</div>
              <div>Persistence Schema: CONNECTED</div>
              <div>Persistence Codec: CONNECTED</div>
              <div>Firebase Storage Adapter: CONNECTED</div>
              <div>Persistent Save: MANUAL DIAGNOSTIC ONLY</div>
              <div>Persistent Load: MANUAL VERIFY ONLY</div>
              <div>Automatic Save: DISABLED</div>
              <div>Automatic Load: DISABLED</div>
`;
code = code.replace(
  `              <div>Annotation Stage: 4E-C4E-B</div>
              <div>Persistence Schema: CONNECTED</div>
              <div>Persistence Codec: CONNECTED</div>
              <div>Firebase Storage Adapter: CONNECTED</div>
              <div>Persistent Save: MANUAL DIAGNOSTIC ONLY</div>
              <div>Persistent Load: MANUAL VERIFY ONLY</div>
              <div>Automatic Save: DISABLED</div>
              <div>Automatic Load: DISABLED</div>
              <div>History Replacement: DISABLED</div>
              <div>Canvas Restore: DISABLED</div>`,
  infoPanel
);

const restoreDiagnosticUI = `
            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Firebase Storage Restore Diagnostic</span>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <div>Mode: EXPLICIT MANUAL RESTORE</div>
                <div>Replace current memory after confirmation</div>
              </div>
              
              <button
                type="button"
                onClick={handleRestoreLoadedSnapshot}
                disabled={!user || !user.uid || !docReady || !persistenceStorageIdentity || !loadedAnnotationSnapshot || isLoading || isGestureActive || inputStatus.phase !== 'idle' || inputStatus.activePointerId !== null || persistenceStorageSaveDiagnostic.status === 'saving' || persistenceStorageLoadDiagnostic.status === 'loading' || annotationRestoreDiagnostic.status === 'restoring'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-brand-light text-brand-dark hover:bg-brand-light/90 disabled:opacity-50 disabled:bg-stone-800 disabled:text-stone-400"
              >
                {annotationRestoreDiagnostic.status === 'restoring' ? 'Restoring...' : 'Restore Loaded Snapshot to Canvas'}
              </button>

              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={\`font-bold \${annotationRestoreDiagnostic.status === 'restored' ? 'text-emerald-400' : (annotationRestoreDiagnostic.status === 'error' || annotationRestoreDiagnostic.status === 'blocked') ? 'text-red-400' : (annotationRestoreDiagnostic.status === 'restoring') ? 'text-yellow-400' : 'text-stone-400'}\`}>
                  Restore Status: {annotationRestoreDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Restore Source Path: {annotationRestoreDiagnostic.storagePath !== null ? annotationRestoreDiagnostic.storagePath : 'NONE'}</div>
                <div className="text-stone-300">Loaded Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.loadedStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Loaded Points: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.loadedPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Before Restore Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.beforeStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Strokes: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.restoredStrokeCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Restored Points: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.restoredPointCount : 'NOT RUN'}</div>
                <div className="text-stone-300">Current Document Instance: {annotationRestoreDiagnostic.currentDocumentInstanceId !== null ? annotationRestoreDiagnostic.currentDocumentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Undo Depth After Restore: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.undoDepthAfterRestore : 'NOT RUN'}</div>
                <div className="text-stone-300">Redo Depth After Restore: {annotationRestoreDiagnostic.status === 'restored' ? annotationRestoreDiagnostic.redoDepthAfterRestore : 'NOT RUN'}</div>
                <div className="text-stone-300">Next Stroke ID Counter: {annotationRestoreDiagnostic.nextStrokeIdCounter !== null ? annotationRestoreDiagnostic.nextStrokeIdCounter : 'NOT RUN'}</div>

                {(annotationRestoreDiagnostic.errorCode) && (
                  <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
                    <div>Restore Error Code: {annotationRestoreDiagnostic.errorCode}</div>
                    <div>Restore Error Message: {annotationRestoreDiagnostic.errorMessage}</div>
                  </div>
                )}
                {annotationRestoreDiagnostic.status === 'restored' && (
                  <div className="mt-2 text-emerald-400 border-t border-emerald-500/20 pt-2">
                    Restore Error: NONE
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 items-center mt-4">
`;

code = code.replace(
  "            </div>\n            \n            <div className=\"flex gap-2 items-center mt-4\">",
  restoreDiagnosticUI
);

fs.writeFileSync(file, code);
