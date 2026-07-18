const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

const cancelOriginal = `  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    activeAnnotationPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      setEraserCursor(null);
    }
    
    if (currentTool === 'eraser') {
      finishEraserSession();
      return;
    }
    
    if (currentTool === 'none') return;
    
    if (currentStroke) {
      onStrokesChange([...strokes, currentStroke]);
      setCurrentStroke(null);
    }
  };`;

const cancelReplacement = `  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    activeAnnotationPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setEraserCursor(null);
    setCurrentStroke(null);
    eraserSessionStrokesRef.current = null;
    lastEraserPointRef.current = null;
    eraserHasChangesRef.current = false;
    setEraserPreviewStrokes(null);
  };`;

content = content.replace(cancelOriginal, cancelReplacement);
fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 13 done');
