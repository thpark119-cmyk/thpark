const fs = require('fs');
const file = 'src/components/score-viewer/v2/V2GestureBaselineLab.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /            <\/div>\n            <\/div>\n\n            <div className="bg-stone-900\/60 p-4 rounded-xl border border-white\/5 space-y-4 mt-4">\n              <div className="flex justify-between items-center mb-2 border-b border-white\/10 pb-2">\n                <span className="font-semibold text-stone-200">Automatic Snapshot Lookup<\/span>/,
  '            </div>\n\n            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4 mt-4">\n              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">\n                <span className="font-semibold text-stone-200">Automatic Snapshot Lookup</span>'
);

fs.writeFileSync(file, code);
