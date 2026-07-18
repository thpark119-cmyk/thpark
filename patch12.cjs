const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

const moveOriginal = `  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    
    event.preventDefault();`;

const moveReplacement = `  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (event.pointerType === 'touch' && isTwoFingerGestureActive) return;
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    
    event.preventDefault();`;

content = content.replace(moveOriginal, moveReplacement);
fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 12 done');
