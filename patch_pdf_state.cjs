const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

code = code.replace(/  const \[pageDisplaySize, setPageDisplaySize\] = useState<PageDisplaySize>\(\{ width: 0, height: 0 \}\);\n/m, `  const [pageDisplaySize, setPageDisplaySize] = useState<PageDisplaySize>({ width: 0, height: 0 });
  const [annotationGeometryRequestId, setAnnotationGeometryRequestId] = useState<number | null>(null);

  useEffect(() => {
    setAnnotationGeometryRequestId(null);
  }, [zoomRenderRequestId, pageNumber, storagePath]);\n`);

const newMeasure = `  const measureRenderedPage = useCallback(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const pdfCanvas = wrapper.querySelector<HTMLCanvasElement>('.react-pdf__Page__canvas');
    if (!pdfCanvas) {
      return;
    }
    const rect = pdfCanvas.getBoundingClientRect();
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (nextWidth < 40 || nextHeight < 40) {
      return;
    }
    
    // Notify ScoreViewer that the page has rendered and its real geometry is available
    onPageGeometryReady?.(zoomScale);

    if (zoomRenderRequestId !== undefined && zoomRenderRequestId !== null) {
      setAnnotationGeometryRequestId(zoomRenderRequestId);
    }

    setPageDisplaySize(previous =>
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : { width: nextWidth, height: nextHeight }
    );
  }, [onPageGeometryReady, zoomScale, zoomRenderRequestId]);`;

code = code.replace(/  const measureRenderedPage = useCallback\(\(\) => \{[\s\S]*?        : \{ width: nextWidth, height: nextHeight \}\n    \);\n  \}, \[onPageGeometryReady, zoomScale\]\);\n/m, newMeasure + '\n');

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', code);
