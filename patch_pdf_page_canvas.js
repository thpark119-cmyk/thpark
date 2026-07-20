import fs from 'fs';

let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

// Add onPageGeometryReady to props
content = content.replace(
  'isTwoFingerGestureActive?: boolean;',
  'isTwoFingerGestureActive?: boolean;\n  onPageGeometryReady?: (renderedZoomScale: number) => void;'
);

content = content.replace(
  '  touchGestureSessionId?: number;\n}',
  '  touchGestureSessionId?: number;\n}'
);

content = content.replace(
  'export default function PdfPageCanvas({\n  storagePath,\n  pageNumber,\n  onPageCountChange,\n  strokes,\n  onStrokesChange,\n  currentTool,\n  strokeColor,\n  strokeWidth,\n  eraserRadius,\n  onDirtyChange,\n  onPreviousPage,\n  onNextPage,\n  canGoPrevious,\n  canGoNext,\n  zoomScale,\n  isTwoFingerGestureActive = false,\n  touchGestureSessionId,\n}: PdfPageCanvasProps) {',
  'export default function PdfPageCanvas({\n  storagePath,\n  pageNumber,\n  onPageCountChange,\n  strokes,\n  onStrokesChange,\n  currentTool,\n  strokeColor,\n  strokeWidth,\n  eraserRadius,\n  onDirtyChange,\n  onPreviousPage,\n  onNextPage,\n  canGoPrevious,\n  canGoNext,\n  zoomScale,\n  isTwoFingerGestureActive = false,\n  touchGestureSessionId,\n  onPageGeometryReady,\n}: PdfPageCanvasProps) {'
);

// Add onPageGeometryReady?.(zoomScale) to measureRenderedPage
const targetMeasure = `    const nextHeight = Math.round(rect.height);
    if (nextWidth < 40 || nextHeight < 40) {
      return;
    }
    setPageDisplaySize(previous =>`;

const replacementMeasure = `    const nextHeight = Math.round(rect.height);
    if (nextWidth < 40 || nextHeight < 40) {
      return;
    }
    
    // Notify ScoreViewer that the page has rendered and its real geometry is available
    onPageGeometryReady?.(zoomScale);

    setPageDisplaySize(previous =>`;

if (content.includes(targetMeasure)) {
    content = content.replace(targetMeasure, replacementMeasure);
    fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
    console.log('PdfPageCanvas.tsx patched.');
} else {
    console.log('PdfPageCanvas.tsx measureRenderedPage target not found.');
}
