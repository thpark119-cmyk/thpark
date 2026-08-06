const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const uiToAdd = `            </div>

            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Automatic Snapshot Lookup</span>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className="text-stone-300">Automatic Lookup: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Lookup Trigger: PDF READY + IDENTITY READY</div>
                <div className="text-stone-300">Lookup Policy: ONCE PER UID / IDENTITY / DOCUMENT INSTANCE</div>
                <div className={\`font-bold \${
                  automaticSnapshotLookupDiagnostic.status === 'found' ? 'text-emerald-400' :
                  automaticSnapshotLookupDiagnostic.status === 'looking-up' ? 'text-yellow-400' :
                  (automaticSnapshotLookupDiagnostic.status === 'invalid' || automaticSnapshotLookupDiagnostic.status === 'error') ? 'text-red-400' :
                  'text-stone-400'
                }\`}>
                  Status: {automaticSnapshotLookupDiagnostic.status.toUpperCase()}
                </div>
                <div className="text-stone-300">Document Instance: {automaticSnapshotLookupDiagnostic.documentInstanceId ?? 'NONE'}</div>
                <div className="text-stone-300">Storage Path: {automaticSnapshotLookupDiagnostic.storagePath ?? 'NONE'}</div>
                {(automaticSnapshotLookupDiagnostic.status === 'invalid' || automaticSnapshotLookupDiagnostic.status === 'error') && (
                  <>
                    <div className="text-red-400">Error Code: {automaticSnapshotLookupDiagnostic.errorCode ?? 'NONE'}</div>
                    <div className="text-red-400">Error Message: {automaticSnapshotLookupDiagnostic.errorMessage ?? 'NONE'}</div>
                  </>
                )}
                <div className="text-stone-400">Automatic Restore: DISABLED</div>
              </div>
            </div>`;

code = code.replace(
  /                <div className="text-stone-400">Custom Exit Message: BROWSER CONTROLLED<\/div>\n              <\/div>\n            <\/div>/m,
  `                <div className="text-stone-400">Custom Exit Message: BROWSER CONTROLLED</div>\n              </div>\n            </div>\n${uiToAdd}`
);

fs.writeFileSync(file, code);
