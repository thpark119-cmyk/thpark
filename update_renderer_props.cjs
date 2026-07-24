const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const calcStr = `
  const visualBaseScale = pendingHandoffRef.current ? pendingHandoffRef.current.baseCssScale : cssScale;
  const minPreviewScale = 0.5 / visualBaseScale;
  const maxPreviewScale = 3 / visualBaseScale;

  // Refs
`;

content = content.replace("  // Refs", calcStr);

content = content.replace(
  "<GestureViewportV2 \n                ref={gestureRef}",
  "<GestureViewportV2 \n                ref={gestureRef}\n                minPreviewScale={minPreviewScale}\n                maxPreviewScale={maxPreviewScale}"
);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
