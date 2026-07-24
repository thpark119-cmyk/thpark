const fs = require('fs');
const content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');
const lines = content.split('\n');
for(let i = 180; i < 200; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
