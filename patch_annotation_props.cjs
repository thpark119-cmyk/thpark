const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

code = code.replace(/  touchGestureSessionId\?: number;\n\}/m, `  touchGestureSessionId?: number;
  zoomRenderRequestId?: number | null;
  onAnnotationRenderReady?: (requestId: number, renderedZoomScale: number) => void;
  renderedZoomScale?: number;
}`);

code = code.replace(/  touchGestureSessionId,\n\}: AnnotationLayerProps\) \{/m, `  touchGestureSessionId,
  zoomRenderRequestId,
  onAnnotationRenderReady,
  renderedZoomScale = 1,
}: AnnotationLayerProps) {`);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
