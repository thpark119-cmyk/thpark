import fs from 'fs';

let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

content = content.replace(
  '  isTwoFingerGestureActive = false,\n  touchGestureSessionId = 0,\n}: AnnotationLayerProps) {',
  '  touchGestureSessionId = 0,\n}: AnnotationLayerProps) {'
);

content = content.replace(
  `    if (!canPointerDraw(event.pointerType)) {
      return;
    }
    if (event.pointerType === 'touch' && isTwoFingerGestureActive) {
      return;
    }
    if (activeAnnotationPointerIdRef.current !== null) {
      return;
    }
    
    event.preventDefault();
    activeAnnotationPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getNormalizedPoint(event);
    if (!point) return;`,
  `    if (!canPointerDraw(event.pointerType)) {
      return;
    }
    if (activeAnnotationPointerIdRef.current !== null) {
      return;
    }
    
    event.preventDefault();
    activeAnnotationPointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture를 지원하지 않아도
      // 필기 자체는 계속 허용한다.
    }

    const point = getNormalizedPoint(event);
    if (!point) {
      activeAnnotationPointerIdRef.current = null;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // 정리 실패는 무시
      }
      return;
    }`
);

content = content.replace(
  `  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (event.pointerType === 'touch' && isTwoFingerGestureActive) return;
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    
    event.preventDefault();`,
  `  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    
    event.preventDefault();`
);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('patched successfully');
