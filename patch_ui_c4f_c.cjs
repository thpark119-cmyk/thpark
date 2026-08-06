const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const titleOld = `<h1 className="text-xl font-bold text-brand-light">[4E-C4F-B Dirty-State Replacement Guards]</h1>
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
          Spatial eraser active`;

const titleNew = `<h1 className="text-xl font-bold text-brand-light">[4E-C4F-C Browser Exit Dirty Guard]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Pen and highlighter drawing active<br/>
          In-memory codec diagnostic active<br/>
          Content-based dirty state active<br/>
          Dirty PDF and snapshot replacement guards active<br/>
          Browser beforeunload dirty guard active<br/>
          Manual Firebase save/load/restore active<br/>
          Automatic persistence disabled<br/>
          Spatial eraser active`;

code = code.replace(titleOld, titleNew);

code = code.replace(
  "<div>Annotation Stage: 4E-C4F-B</div>",
  "<div>Annotation Stage: 4E-C4F-C</div>"
);

const diagnosticOld = `<div className="text-stone-300">PDF Replacement Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Snapshot Restore Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Guard Policy: DIRTY OR UNAVAILABLE WITH WORK</div>
                <div className="text-stone-400">Browser Exit Guard: DISABLED</div>`;

const diagnosticNew = `<div className="text-stone-300">PDF Replacement Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Snapshot Restore Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Browser Exit Guard: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                <div className="text-stone-300">Browser Exit Listener: <span className={browserExitGuardArmed ? "text-yellow-400 font-bold" : "text-emerald-400 font-bold"}>{browserExitGuardArmed ? 'ARMED' : 'DISARMED'}</span></div>
                <div className="text-stone-300">Browser Exit Policy: DIRTY OR UNAVAILABLE WITH WORK</div>
                <div className="text-stone-400">Custom Exit Message: BROWSER CONTROLLED</div>`;

code = code.replace(diagnosticOld, diagnosticNew);

fs.writeFileSync(file, code);
