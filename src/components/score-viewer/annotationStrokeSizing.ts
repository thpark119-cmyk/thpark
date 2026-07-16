import type { ScoreAnnotationTool } from './annotationTypes';

export const ANNOTATION_REFERENCE_PAGE_WIDTH = 1000;

function clampWidthLevel(widthLevel: number): number {
  if (!Number.isFinite(widthLevel)) {
    return 1;
  }
  return Math.min(3, Math.max(1, widthLevel));
}

function getBaseLineWidth(widthLevel: number, tool: ScoreAnnotationTool): number {
  const safeWidthLevel = clampWidthLevel(widthLevel);

  if (tool === 'highlighter') {
    return safeWidthLevel * 8 + 12;
  }
  return safeWidthLevel * 2 + 1;
}

export function getScaledAnnotationLineWidth({
  widthLevel,
  tool,
  pageWidth,
}: {
  widthLevel: number;
  tool: ScoreAnnotationTool;
  pageWidth: number;
}): number {
  const safePageWidth =
    Number.isFinite(pageWidth) && pageWidth > 0
      ? pageWidth
      : ANNOTATION_REFERENCE_PAGE_WIDTH;

  const baseLineWidth = getBaseLineWidth(widthLevel, tool);

  return baseLineWidth * (safePageWidth / ANNOTATION_REFERENCE_PAGE_WIDTH);
}
