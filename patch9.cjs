const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

content = content.replace(
  "                  touchAction: currentTool === 'none' ? 'pan-x pan-y' : undefined,",
  "                  touchAction: 'none',"
);

const originalAnnotationLayer = `                  <AnnotationLayer
                    width={pageDisplaySize.width}
                    height={pageDisplaySize.height}
                    strokes={strokes}
                    onStrokesChange={(newStrokes) => {
                      onStrokesChange(newStrokes);
                      onDirtyChange(true);
                    }}
                    currentTool={currentTool}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    eraserRadius={eraserRadius}
                  />`;

const replacedAnnotationLayer = `                  <AnnotationLayer
                    width={pageDisplaySize.width}
                    height={pageDisplaySize.height}
                    strokes={strokes}
                    onStrokesChange={(newStrokes) => {
                      onStrokesChange(newStrokes);
                      onDirtyChange(true);
                    }}
                    currentTool={currentTool}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    eraserRadius={eraserRadius}
                    isTwoFingerGestureActive={isTwoFingerGestureActive}
                    touchGestureSessionId={touchGestureSessionId}
                  />`;

content = content.replace(originalAnnotationLayer, replacedAnnotationLayer);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
console.log('Patch 9 done');
