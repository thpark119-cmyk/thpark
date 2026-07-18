const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

content = content.replace(
  '  zoomScale: number;',
  '  zoomScale: number;\n  isTwoFingerGestureActive?: boolean;\n  touchGestureSessionId?: number;'
);

content = content.replace(
  '    canGoNext,\n    zoomScale,\n  } = props;',
  '    canGoNext,\n    zoomScale,\n    isTwoFingerGestureActive = false,\n    touchGestureSessionId = 0,\n  } = props;'
);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
console.log('Patch 6 done');
