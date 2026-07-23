const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

code = code.replace(/  isTwoFingerGestureActive = false,\n\}: AnnotationLayerProps\) \{/m, `  isTwoFingerGestureActive = false,
  touchGestureSessionId,
}: AnnotationLayerProps) {`);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
