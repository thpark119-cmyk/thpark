import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';
import { ScoreAnnotationDocument, ScoreAnnotationStroke } from '../components/score-viewer/annotationTypes';
import { getFileDownloadUrl } from './cloudStorage';
import { getScaledAnnotationLineWidth } from '../components/score-viewer/annotationStrokeSizing';

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

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type PdfPageQuarterRotation = 0 | 90 | 180 | 270;

function normalizePageRotation(angle: number): PdfPageQuarterRotation {
  const normalized = ((angle % 360) + 360) % 360;
  switch (normalized) {
    case 90:
    case 180:
    case 270:
      return normalized;
    default:
      return 0;
  }
}

function mapNormalizedScreenPointToPdfPoint(
  point: { x: number; y: number },
  cropBox: { x: number; y: number; width: number; height: number },
  rotation: PdfPageQuarterRotation
): { x: number; y: number } {
  const nx = clampUnit(point.x);
  const ny = clampUnit(point.y);
  
  const { x: cropX, y: cropY, width: cropWidth, height: cropHeight } = cropBox;
  
  switch (rotation) {
    case 90:
      return {
        x: cropX + ny * cropWidth,
        y: cropY + nx * cropHeight,
      };
    case 180:
      return {
        x: cropX + (1 - nx) * cropWidth,
        y: cropY + ny * cropHeight,
      };
    case 270:
      return {
        x: cropX + (1 - ny) * cropWidth,
        y: cropY + (1 - nx) * cropHeight,
      };
    default:
      return {
        x: cropX + nx * cropWidth,
        y: cropY + (1 - ny) * cropHeight,
      };
  }
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
    const cropBox = page.getCropBox();
    const rotation = normalizePageRotation(page.getRotation().angle);

    if (cropBox.width <= 0 || cropBox.height <= 0) {
      continue;
    }

    const displayedPageWidth = rotation === 90 || rotation === 270 ? cropBox.height : cropBox.width;
    
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
      
      const lineWidth = getScaledAnnotationLineWidth({
        widthLevel: stroke.width,
        tool: stroke.tool,
        pageWidth: displayedPageWidth,
      });

      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        const start = mapNormalizedScreenPointToPdfPoint(p1, cropBox, rotation);
        const end = mapNormalizedScreenPointToPdfPoint(p2, cropBox, rotation);

        page.drawLine({
          start,
          end,
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
