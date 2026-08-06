const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

const regexHeader = /<h1 className="text-xl font-bold text-brand-light">\[4E-C4F-C Browser Exit Dirty Guard\]<\/h1>[\s\S]*?Spatial eraser active/m;

const newHeader = `<h1 className="text-xl font-bold text-brand-light">[4E-C4G-A Controlled Snapshot Lookup on PDF Ready]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Pen and highlighter drawing active<br/>
          In-memory codec diagnostic active<br/>
          Content-based dirty state active<br/>
          Dirty replacement and browser exit guards active<br/>
          Automatic snapshot lookup on PDF ready active<br/>
          Automatic canvas restore disabled<br/>
          Manual save/load/restore active<br/>
          Automatic save disabled<br/>
          Spatial eraser active`;

code = code.replace(regexHeader, newHeader);

const regexStage = /<div>Annotation Stage: 4E-C4F-C<\/div>/m;
const newStage = `<div>Annotation Stage: 4E-C4G-A</div>`;

code = code.replace(regexStage, newStage);

fs.writeFileSync(file, code);
