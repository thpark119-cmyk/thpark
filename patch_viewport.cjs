const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

const targetStr = `
      let unclampedPreviewScale = transformRef.current.scale / baseScaleRatio;
      let nextPreviewScale = clampPreviewScaleV2(unclampedPreviewScale, limitsRef.current.min, limitsRef.current.max);
`;

const replacementStr = `
      let unclampedPreviewScale = transformRef.current.scale / baseScaleRatio;
      let targetMinLimit = limitsRef.current.min / baseScaleRatio;
      let targetMaxLimit = limitsRef.current.max / baseScaleRatio;
      let nextPreviewScale = clampPreviewScaleV2(unclampedPreviewScale, targetMinLimit, targetMaxLimit);
`;

content = content.replace(targetStr.trim(), replacementStr.trim());

fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
