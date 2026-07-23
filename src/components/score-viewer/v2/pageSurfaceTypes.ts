import { PdfRenderResultV2 } from './pdfRenderTypes';

export type PageSurfaceCanvasSlotV2 = 'first' | 'second';

export type PageSurfaceRenderStateV2 = 'idle' | 'rendering' | 'ready' | 'destroyed';

export interface PageSurfaceFrontInfoV2 {
  slot: PageSurfaceCanvasSlotV2;
  requestId: number;
  generation: number;
  pageNumber: number;
  cssScale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface PageSurfaceSwapInfoV2 {
  previousFront: PageSurfaceFrontInfoV2 | null;
  nextFront: PageSurfaceFrontInfoV2;
  renderDurationMs: number;
  swapTime: number;
}

export interface PageSurfaceRenderEventV2 {
  surfaceRequestId: number;
  result: PdfRenderResultV2;
}
