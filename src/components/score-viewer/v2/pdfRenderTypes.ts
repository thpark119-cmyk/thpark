export type PdfDocumentLoadStatusV2 = 'loaded' | 'stale';

export interface PdfDocumentInfoV2 {
  status: PdfDocumentLoadStatusV2;
  generation: number;
  numPages: number;
  fingerprint: string | null;
}

export interface PdfRenderRequestV2 {
  requestId: number;
  pageNumber: number;
  cssScale: number;
  outputScale: number;
  canvas: HTMLCanvasElement;
}

export type PdfRenderStatusV2 = 'completed' | 'cancelled' | 'stale';

export interface PdfRenderResultV2 {
  status: PdfRenderStatusV2;
  generation: number;
  requestId: number;
  pageNumber: number;
  cssScale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  renderDurationMs: number;
}

export type PdfRenderEngineStateV2 = 'idle' | 'loading' | 'ready' | 'destroyed';

export type PdfRenderEngineErrorCodeV2 =
  | 'ENGINE_DESTROYED'
  | 'DOCUMENT_NOT_LOADED'
  | 'INVALID_PDF_BYTES'
  | 'INVALID_PAGE_NUMBER'
  | 'INVALID_SCALE'
  | 'CANVAS_CONTEXT_UNAVAILABLE'
  | 'DOCUMENT_LOAD_FAILED'
  | 'PAGE_LOAD_FAILED'
  | 'PAGE_RENDER_FAILED';

export class PdfRenderEngineErrorV2 extends Error {
  code: PdfRenderEngineErrorCodeV2;
  cause?: unknown;

  constructor(message: string, code: PdfRenderEngineErrorCodeV2, cause?: unknown) {
    super(message);
    this.name = 'PdfRenderEngineErrorV2';
    this.code = code;
    this.cause = cause;
  }
}
