const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

content = content.replace(
  '  useEffect(() => {\n    setPageDisplaySize({ width: 0, height: 0 });\n    setIsPageRendered(false);\n    setPageError(null);\n  }, [pageNumber, documentFile, renderedPageWidth]);',
  '  useEffect(() => {\n    setPageDisplaySize({ width: 0, height: 0 });\n    setIsPageRendered(false);\n    setPageError(null);\n  }, [pageNumber, documentFile]);'
);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
console.log('Patch 8 done');
