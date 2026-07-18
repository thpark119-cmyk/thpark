const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

const pdOriginal = `  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (
      !canPointerDraw(event.pointerType)
    ) {
      return;
    }
    
    event.preventDefault();`;

const pdReplacement = `  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (!canPointerDraw(event.pointerType)) {
      return;
    }
    if (event.pointerType === 'touch' && isTwoFingerGestureActive) {
      return;
    }
    if (activeAnnotationPointerIdRef.current !== null) {
      return;
    }
    
    event.preventDefault();`;

content = content.replace(pdOriginal, pdReplacement);
fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 11 done');
