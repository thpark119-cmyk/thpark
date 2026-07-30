export const V2_MAX_CANVAS_PIXELS = 8_000_000;
export const V2_MAX_CANVAS_EDGE = 4096;
export const V2_MIN_OUTPUT_SCALE = 1;

const SCALE_EPSILON = 0.0005;

export interface RenderBudgetInputV2 {
  cssWidth: number;
  cssHeight: number;
  requestedOutputScale: number;
}

export type RenderBudgetLimitReasonV2 =
  | 'none'
  | 'pixel-count'
  | 'canvas-edge'
  | 'pixel-count-and-edge'
  | 'minimum-scale-exceeds-budget';

export interface RenderBudgetPreviewV2 {
  cssWidth: number;
  cssHeight: number;

  requestedOutputScale: number;
  effectiveOutputScale: number;

  requestedPixelWidth: number;
  requestedPixelHeight: number;
  requestedPixelCount: number;

  effectivePixelWidth: number;
  effectivePixelHeight: number;
  effectivePixelCount: number;

  estimatedBytesPerCanvas: number;
  estimatedDoubleBufferBytes: number;

  limitedByPixelCount: boolean;
  limitedByCanvasEdge: boolean;
  budgetSatisfied: boolean;
  limitReason: RenderBudgetLimitReasonV2;
}

export function calculateRenderBudgetPreviewV2(
  input: RenderBudgetInputV2
): RenderBudgetPreviewV2 | null {
  const { cssWidth, cssHeight, requestedOutputScale } = input;

  if (
    !Number.isFinite(cssWidth) || cssWidth <= 0 ||
    !Number.isFinite(cssHeight) || cssHeight <= 0 ||
    !Number.isFinite(requestedOutputScale) || requestedOutputScale <= 0
  ) {
    return null;
  }

  const areaScaleLimit = Math.sqrt(V2_MAX_CANVAS_PIXELS / (cssWidth * cssHeight));
  const edgeScaleLimit = Math.min(
    V2_MAX_CANVAS_EDGE / cssWidth,
    V2_MAX_CANVAS_EDGE / cssHeight
  );

  const rawEffectiveOutputScale = Math.min(
    requestedOutputScale,
    areaScaleLimit,
    edgeScaleLimit
  );

  const roundedDownOutputScale = Math.floor(rawEffectiveOutputScale * 100) / 100;
  
  const effectiveOutputScale = Math.min(
    requestedOutputScale,
    Math.max(V2_MIN_OUTPUT_SCALE, roundedDownOutputScale)
  );

  const requestedPixelWidth = Math.floor(cssWidth * requestedOutputScale);
  const requestedPixelHeight = Math.floor(cssHeight * requestedOutputScale);
  const requestedPixelCount = requestedPixelWidth * requestedPixelHeight;

  const effectivePixelWidth = Math.max(1, Math.floor(cssWidth * effectiveOutputScale));
  const effectivePixelHeight = Math.max(1, Math.floor(cssHeight * effectiveOutputScale));
  const effectivePixelCount = effectivePixelWidth * effectivePixelHeight;

  const estimatedBytesPerCanvas = effectivePixelCount * 4;
  const estimatedDoubleBufferBytes = estimatedBytesPerCanvas * 2;

  const limitedByPixelCount = areaScaleLimit < requestedOutputScale - SCALE_EPSILON;
  const limitedByCanvasEdge = edgeScaleLimit < requestedOutputScale - SCALE_EPSILON;

  const budgetSatisfied = 
    effectivePixelCount <= V2_MAX_CANVAS_PIXELS &&
    effectivePixelWidth <= V2_MAX_CANVAS_EDGE &&
    effectivePixelHeight <= V2_MAX_CANVAS_EDGE;

  let limitReason: RenderBudgetLimitReasonV2 = 'none';

  if (!budgetSatisfied) {
    limitReason = 'minimum-scale-exceeds-budget';
  } else if (limitedByPixelCount && limitedByCanvasEdge) {
    limitReason = 'pixel-count-and-edge';
  } else if (limitedByPixelCount) {
    limitReason = 'pixel-count';
  } else if (limitedByCanvasEdge) {
    limitReason = 'canvas-edge';
  }

  return {
    cssWidth,
    cssHeight,
    requestedOutputScale,
    effectiveOutputScale,
    requestedPixelWidth,
    requestedPixelHeight,
    requestedPixelCount,
    effectivePixelWidth,
    effectivePixelHeight,
    effectivePixelCount,
    estimatedBytesPerCanvas,
    estimatedDoubleBufferBytes,
    limitedByPixelCount,
    limitedByCanvasEdge,
    budgetSatisfied,
    limitReason
  };
}
