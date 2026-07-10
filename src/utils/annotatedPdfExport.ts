import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';
import { ScoreAnnotationDocument, ScoreAnnotationStroke } from '../components/score-viewer/annotationTypes';
import { getFileDownloadUrl } from './cloudStorage';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h.charAt(0) + h.charAt(0), 16) / 255,
      parseInt(h.charAt(1) + h.charAt(1), 16) / 255,
      parseInt(h.charAt(2) + h.charAt(2), 16) / 255
    ];
  }
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255
  ];
}

export async function createAnnotatedPdf(
  sourceStoragePath: string,
  annotations: ScoreAnnotationDocument
): Promise<Blob> {
  // 1. Download the original PDF
  const downloadUrl = await getFileDownloadUrl(sourceStoragePath);
  const response = await fetch(downloadUrl);
  const pdfBytes = await response.arrayBuffer();

  // 2. Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // 3. Draw annotations on each page
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const { width, height } = page.getSize();
    
    // Check if there are annotations for this page (1-indexed)
    const pageAnnotations = annotations.pages[pageIndex + 1];
    if (!pageAnnotations || !pageAnnotations.strokes) continue;

    // Separate highlighter and pen strokes so highlighters go underneath
    const highlighters = pageAnnotations.strokes.filter(s => s.tool === 'highlighter');
    const pens = pageAnnotations.strokes.filter(s => s.tool === 'pen');

    const drawStroke = (stroke: ScoreAnnotationStroke) => {
      if (stroke.points.length < 2) return;
      
      const [r, g, b] = hexToRgb(stroke.color);
      const isHighlighter = stroke.tool === 'highlighter';
      // Highlighters are somewhat transparent in the UI, we try to emulate that
      // pdf-lib drawLine supports color and opacity
      const opacity = stroke.opacity;
      
      const color = rgb(r, g, b);
      
      // Calculate drawing width relative to the page
      // Width is typically stored relative to screen or base width. 
      // We will assume stroke.width is a reasonable pixel width and scale it to PDF width
      // Alternatively, stroke.width might be absolute or relative. Let's assume stroke.width is relative (e.g. 0.005) or we'll need to store it as relative.
      // If the UI stores width as actual screen pixels, we might need a reference width.
      // For now, let's assume it's relative if we can change our annotation logic, or we use a fixed multiplier.
      // We'll multiply by PDF page width.
      const lineWidth = stroke.width * width; 

      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        page.drawLine({
          start: { x: p1.x * width, y: height - p1.y * height },
          end: { x: p2.x * width, y: height - p2.y * height },
          thickness: lineWidth,
          color: color,
          opacity: opacity,
          lineCap: LineCapStyle.Round
        });
      }
    };

    highlighters.forEach(drawStroke);
    pens.forEach(drawStroke);
  }

  // 4. Save and return as Blob
  const modifiedPdfBytes = await pdfDoc.save();
  return new Blob([modifiedPdfBytes], { type: 'application/pdf' });
}
