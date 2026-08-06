const fs = require('fs');
const code = fs.readFileSync('src/components/score-viewer/v2/V2GestureBaselineLab.tsx', 'utf8');

let openDivs = (code.match(/<div(\s|>)/g) || []).length;
let closeDivs = (code.match(/<\/div>/g) || []).length;
console.log('Open:', openDivs, 'Close:', closeDivs);
