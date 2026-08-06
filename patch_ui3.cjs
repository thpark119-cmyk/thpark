const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const titleChange = `
        <h1 className="text-xl font-bold text-brand-light">[4E-C4F-B Dirty-State Replacement Guards]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Pen and highlighter drawing active<br/>
          In-memory codec diagnostic active<br/>
          Content-based dirty state active<br/>
          Dirty PDF replacement guard active<br/>
          Dirty snapshot restore guard active<br/>
          Manual Firebase save/load/restore active<br/>
          Browser exit guard disabled<br/>
          Automatic persistence disabled<br/>
          Spatial eraser active
`;
code = code.replace(
  /        <h1 className="text-xl font-bold text-brand-light">\[4E-C4F-A Annotation Persistence Dirty-State Foundation\]<\/h1>\n        <div className="bg-emerald-900\/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500\/20">\n          <strong>Interactive CSS Preview Mode<\/strong><br\/>\n          Pen and highlighter drawing active<br\/>\n          In-memory codec diagnostic active<br\/>\n          Manual Firebase save\/load\/restore active<br\/>\n          Clean baseline tracking active<br\/>\n          Content-based dirty state active<br\/>\n          Automatic persistence disabled<br\/>\n          Unsaved-change guards disabled<br\/>\n          Spatial eraser active/m,
  titleChange.trim()
);

const infoPanel = `
              <div>Annotation Stage: 4E-C4F-B</div>
              <div>Persistence Schema: CONNECTED</div>
`;
code = code.replace(
  /              <div>Annotation Stage: 4E-C4F-A<\/div>\n              <div>Persistence Schema: CONNECTED<\/div>/m,
  infoPanel.trim()
);

const diagnosticUI = `
            </div>
            
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <span className="font-semibold text-stone-200">Annotation Dirty State</span>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className={\`font-bold \${annotationDirtyStatus === 'clean' ? 'text-emerald-400' : annotationDirtyStatus === 'dirty' ? 'text-yellow-400' : 'text-stone-400'}\`}>
                  Dirty Status: {annotationDirtyStatus.toUpperCase()}
                </div>
                <div className="text-stone-300">Unsaved Changes: {annotationDirtyStatus === 'dirty' ? 'YES' : annotationDirtyStatus === 'clean' ? 'NO' : 'UNKNOWN'}</div>
                <div className="text-stone-300">Baseline Source: {annotationCleanBaseline ? annotationCleanBaseline.source.toUpperCase() : 'NONE'}</div>
                <div className="text-stone-300">Baseline Strokes: {annotationCleanBaseline ? annotationCleanBaseline.strokes.length : 'NOT RUN'}</div>
                <div className="text-stone-300">Current Strokes: {annotationDirtyStatus !== 'unavailable' ? currentDocumentStrokes.length : 'NOT RUN'}</div>
                <div className="text-stone-300">Baseline Document Instance: {annotationCleanBaseline ? annotationCleanBaseline.documentInstanceId : 'NONE'}</div>
                <div className="text-stone-300">Current Document Instance: {documentInstanceIdRef.current}</div>
                <div className={\`text-stone-300 \${annotationDirtyStatus !== 'unavailable' ? 'text-emerald-400' : 'text-red-400'}\`}>Baseline Identity Match: {annotationDirtyStatus !== 'unavailable' ? 'YES' : 'NO'}</div>
              </div>
              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white/5">
                <div className="text-stone-300">PDF Replacement Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Snapshot Restore Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Guard Policy: DIRTY OR UNAVAILABLE WITH WORK</div>
                <div className="text-stone-400">Browser Exit Guard: DISABLED</div>
              </div>
            </div>
`;

code = code.replace(
  /            <\/div>\n            \n            <div className="bg-stone-900\/60 p-4 rounded-xl border border-white\/5 space-y-4 mt-4">\n              <div className="flex justify-between items-center mb-2 border-b border-white\/10 pb-2">\n                <span className="font-semibold text-stone-200">Annotation Dirty State<\/span>\n              <\/div>\n              <div className="text-xs space-y-1 font-mono mt-2 p-2 bg-stone-950 rounded border border-white\/5">\n                <div className=\{`font-bold \$\{annotationDirtyStatus === 'clean' \? 'text-emerald-400' : annotationDirtyStatus === 'dirty' \? 'text-yellow-400' : 'text-stone-400'\}`\}>\n                  Dirty Status: \{annotationDirtyStatus\.toUpperCase\(\)\}\n                <\/div>\n                <div className="text-stone-300">Unsaved Changes: \{annotationDirtyStatus === 'dirty' \? 'YES' : annotationDirtyStatus === 'clean' \? 'NO' : 'UNKNOWN'\}<\/div>\n                <div className="text-stone-300">Baseline Source: \{annotationCleanBaseline \? annotationCleanBaseline\.source\.toUpperCase\(\) : 'NONE'\}<\/div>\n                <div className="text-stone-300">Baseline Strokes: \{annotationCleanBaseline \? annotationCleanBaseline\.strokes\.length : 'NOT RUN'\}<\/div>\n                <div className="text-stone-300">Current Strokes: \{annotationDirtyStatus \!\=\= 'unavailable' \? currentDocumentStrokes\.length : 'NOT RUN'\}<\/div>\n                <div className="text-stone-300">Baseline Document Instance: \{annotationCleanBaseline \? annotationCleanBaseline\.documentInstanceId : 'NONE'\}<\/div>\n                <div className="text-stone-300">Current Document Instance: \{documentInstanceIdRef\.current\}<\/div>\n                <div className=\{`text-stone-300 \$\{annotationDirtyStatus \!\=\= 'unavailable' \? 'text-emerald-400' : 'text-red-400'\}`\}>Baseline Identity Match: \{annotationDirtyStatus \!\=\= 'unavailable' \? 'YES' : 'NO'\}<\/div>\n              <\/div>\n            <\/div>/m,
  diagnosticUI.trim()
);

fs.writeFileSync(file, code);
