const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const oldZoom = `  const handleZoomOut = () => { cancelScaleHandoffChain('handleZoomOut'); manualIntervention(); setCssScale((p) => Math.max(0.5, p - 0.25)); };
  const handleZoomIn = () => { cancelScaleHandoffChain('handleZoomIn'); manualIntervention(); setCssScale((p) => Math.min(2.0, p + 0.25)); };`;
const newZoom = `  const handleZoomOut = () => { cancelScaleHandoffChain('handleZoomOut'); manualIntervention(); setCssScale((p) => Math.max(MIN_COMMITTED_CSS_SCALE_V2, p - 0.25)); };
  const handleZoomIn = () => { cancelScaleHandoffChain('handleZoomIn'); manualIntervention(); setCssScale((p) => Math.min(MAX_COMMITTED_CSS_SCALE_V2, p + 0.25)); };`;

content = content.replace(oldZoom, newZoom);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
