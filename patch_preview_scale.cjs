const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const oldScales = `  const minPreviewScale = 0.5 / visualBaseScale;
  const maxPreviewScale = 3 / visualBaseScale;`;
const newScales = `  const minPreviewScale = MIN_COMMITTED_CSS_SCALE_V2 / visualBaseScale;
  const maxPreviewScale = MAX_COMMITTED_CSS_SCALE_V2 / visualBaseScale;`;

content = content.replace(oldScales, newScales);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
