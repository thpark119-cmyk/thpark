const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

content = content.replace(
  "          touchAction: currentTool === 'none' ? 'pan-x pan-y' : 'none',",
  "          touchAction: 'none',"
);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 14 done');
