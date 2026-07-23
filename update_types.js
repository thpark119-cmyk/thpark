const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/v2/pdfRenderTypes.ts', 'utf8');
code = `export type PdfDocumentLoadStatusV2 = 'loaded' | 'stale';\n\n` + code;
code = code.replace(/export interface PdfDocumentInfoV2 \{\n/, "export interface PdfDocumentInfoV2 {\n  status: PdfDocumentLoadStatusV2;\n");
fs.writeFileSync('src/components/score-viewer/v2/pdfRenderTypes.ts', code);
