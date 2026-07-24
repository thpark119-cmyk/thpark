const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const addEventSearch = `      if (pendingHandoffRef.current && !pendingHandoffRef.current.targetRenderCompleted) {
         const ph = pendingHandoffRef.current;
         if (
           ev.result.pageNumber === pageNumber &&
           Math.abs(ev.result.cssScale - ph.clampedTargetCssScale) < 0.005 &&
           ev.result.outputScale === outputScale &&
           ev.result.generation === engineGeneration
         ) {`;

const addEventReplace = `      if (pendingHandoffRef.current && !pendingHandoffRef.current.targetRenderCompleted) {
         const ph = pendingHandoffRef.current;
         if (ph.chainId !== chainIdCounterRef.current) {
           // ignored completed render from cancelled chain
         } else if (
           ev.result.pageNumber === pageNumber &&
           Math.abs(ev.result.cssScale - ph.clampedTargetCssScale) < 0.005 &&
           ev.result.outputScale === outputScale &&
           ev.result.generation === engineGeneration
         ) {`;

content = content.replace(addEventSearch, addEventReplace);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
