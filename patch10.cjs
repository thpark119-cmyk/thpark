const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

content = content.replace(
  '  strokeWidth: number; // 1, 2, 3 representing thin, normal, thick\n  eraserRadius: number;',
  '  strokeWidth: number; // 1, 2, 3 representing thin, normal, thick\n  eraserRadius: number;\n  isTwoFingerGestureActive?: boolean;\n  touchGestureSessionId?: number;'
);

content = content.replace(
  '  strokeWidth,\n  eraserRadius,\n}: AnnotationLayerProps) {',
  '  strokeWidth,\n  eraserRadius,\n  isTwoFingerGestureActive = false,\n  touchGestureSessionId = 0,\n}: AnnotationLayerProps) {\n\n  const cancelActiveAnnotationSession = useCallback(() => {\n    activeAnnotationPointerIdRef.current = null;\n    setCurrentStroke(null);\n    eraserSessionStrokesRef.current = null;\n    lastEraserPointRef.current = null;\n    eraserHasChangesRef.current = false;\n    setEraserPreviewStrokes(null);\n    setEraserCursor(null);\n  }, []);\n\n  useEffect(() => {\n    if (touchGestureSessionId <= 0) {\n      return;\n    }\n    cancelActiveAnnotationSession();\n  }, [touchGestureSessionId, cancelActiveAnnotationSession]);'
);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', content, 'utf8');
console.log('Patch 10 done');
