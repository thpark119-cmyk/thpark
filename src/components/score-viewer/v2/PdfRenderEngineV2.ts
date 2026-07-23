import {
  PdfDocumentInfoV2,
  PdfRenderRequestV2,
  PdfRenderResultV2,
  PdfRenderEngineStateV2,
  PdfRenderEngineErrorV2
} from './pdfRenderTypes';
import {
  getDocument,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask
} from './pdfJsV2';

export class PdfRenderEngineV2 {
  private _state: PdfRenderEngineStateV2 = 'idle';
  private _generation: number = 0;
  private _loadingTask: PDFDocumentLoadingTask | null = null;
  private _documentProxy: PDFDocumentProxy | null = null;
  private _pageCache: Map<number, PDFPageProxy> = new Map();
  private _activeRenderTask: RenderTask | null = null;
  private _activeRenderRequestId: number | null = null;
  private _isDestroyed: boolean = false;

  public get state(): PdfRenderEngineStateV2 {
    return this._state;
  }

  public get generation(): number {
    return this._generation;
  }

  public get numPages(): number {
    return this._documentProxy?.numPages ?? 0;
  }

  public get hasDocument(): boolean {
    return this._documentProxy !== null;
  }

  public get activeRenderRequestId(): number | null {
    return this._activeRenderRequestId;
  }

  public async loadDocument(bytes: Uint8Array): Promise<PdfDocumentInfoV2> {
    if (this._isDestroyed) {
      throw new PdfRenderEngineErrorV2('Engine is destroyed', 'ENGINE_DESTROYED');
    }
    if (!(bytes instanceof Uint8Array)) {
      throw new PdfRenderEngineErrorV2('Bytes must be a Uint8Array', 'INVALID_PDF_BYTES');
    }
    if (bytes.length === 0) {
      throw new PdfRenderEngineErrorV2('Bytes length is 0', 'INVALID_PDF_BYTES');
    }

    this.cancelActiveRender();

    if (this._loadingTask) {
      try {
        this._loadingTask.destroy();
      } catch (e) {
        console.warn('[Mio PdfRenderEngineV2] Error destroying previous loading task:', e);
      }
      this._loadingTask = null;
    }

    if (this._documentProxy) {
      try {
        this._documentProxy.destroy();
      } catch (e) {
        console.warn('[Mio PdfRenderEngineV2] Error destroying previous document proxy:', e);
      }
      this._documentProxy = null;
    }

    this._pageCache.clear();
    this._generation += 1;
    const currentGeneration = this._generation;

    this._state = 'loading';
    console.debug('[Mio PdfRenderEngineV2] document-load-start (gen: ' + currentGeneration + ')');

    try {
      const dataCopy = new Uint8Array(bytes);
      this._loadingTask = getDocument({ data: dataCopy });
      
      const documentProxy = await this._loadingTask.promise;
      
      if (this._isDestroyed) {
        try {
          documentProxy.destroy();
        } catch (e) {}
        console.debug('[Mio PdfRenderEngineV2] document-load-stale: engine destroyed (gen: ' + currentGeneration + ')');
        return { generation: currentGeneration, numPages: 0, fingerprint: null };
      }

      if (this._generation !== currentGeneration) {
        try {
          documentProxy.destroy();
        } catch (e) {}
        console.debug('[Mio PdfRenderEngineV2] document-load-stale: generation changed (gen: ' + currentGeneration + ')');
        return { generation: currentGeneration, numPages: 0, fingerprint: null };
      }

      this._documentProxy = documentProxy;
      this._state = 'ready';
      
      const fingerprints = documentProxy.fingerprints || [];
      const fingerprint = fingerprints[0] || null;
      
      console.debug('[Mio PdfRenderEngineV2] document-load-success (gen: ' + currentGeneration + ', pages: ' + documentProxy.numPages + ')');

      return {
        generation: currentGeneration,
        numPages: documentProxy.numPages,
        fingerprint: typeof fingerprint === 'string' ? fingerprint : null
      };
    } catch (e: any) {
      this._state = 'idle';
      console.error('[Mio PdfRenderEngineV2] document-load-error (gen: ' + currentGeneration + '):', e);
      throw new PdfRenderEngineErrorV2('Failed to load document', 'DOCUMENT_LOAD_FAILED', e);
    }
  }

  private async getPage(pageNumber: number, expectedGeneration: number): Promise<PDFPageProxy> {
    if (this._isDestroyed) {
      throw new PdfRenderEngineErrorV2('Engine is destroyed', 'ENGINE_DESTROYED');
    }
    if (!this._documentProxy) {
      throw new PdfRenderEngineErrorV2('No document loaded', 'DOCUMENT_NOT_LOADED');
    }
    if (this._generation !== expectedGeneration) {
      throw new PdfRenderEngineErrorV2('Generation mismatch', 'PAGE_LOAD_FAILED');
    }
    if (pageNumber < 1 || pageNumber > this.numPages) {
      throw new PdfRenderEngineErrorV2('Invalid page number: ' + pageNumber, 'INVALID_PAGE_NUMBER');
    }

    if (this._pageCache.has(pageNumber)) {
      console.debug('[Mio PdfRenderEngineV2] page-cache-hit (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
      return this._pageCache.get(pageNumber)!;
    }

    console.debug('[Mio PdfRenderEngineV2] page-load-start (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
    try {
      const page = await this._documentProxy.getPage(pageNumber);
      
      if (this._generation !== expectedGeneration) {
        console.debug('[Mio PdfRenderEngineV2] page-load-stale (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
        throw new PdfRenderEngineErrorV2('Generation mismatch after page load', 'PAGE_LOAD_FAILED');
      }

      this._pageCache.set(pageNumber, page);
      console.debug('[Mio PdfRenderEngineV2] page-load-success (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
      return page;
    } catch (e: any) {
      if (e instanceof PdfRenderEngineErrorV2) {
        throw e;
      }
      throw new PdfRenderEngineErrorV2('Failed to load page', 'PAGE_LOAD_FAILED', e);
    }
  }

  public async renderPage(request: PdfRenderRequestV2): Promise<PdfRenderResultV2> {
    const startTime = performance.now();
    const { requestId, pageNumber, cssScale, outputScale, canvas } = request;

    if (this._isDestroyed) {
      throw new PdfRenderEngineErrorV2('Engine is destroyed', 'ENGINE_DESTROYED');
    }
    if (!this._documentProxy) {
      throw new PdfRenderEngineErrorV2('No document loaded', 'DOCUMENT_NOT_LOADED');
    }
    if (!Number.isFinite(requestId)) {
      throw new PdfRenderEngineErrorV2('requestId must be a finite number', 'PAGE_RENDER_FAILED');
    }
    if (pageNumber < 1 || pageNumber > this.numPages) {
      throw new PdfRenderEngineErrorV2('Invalid page number: ' + pageNumber, 'INVALID_PAGE_NUMBER');
    }
    if (!Number.isFinite(cssScale) || cssScale <= 0) {
      throw new PdfRenderEngineErrorV2('Invalid cssScale: ' + cssScale, 'INVALID_SCALE');
    }
    if (!Number.isFinite(outputScale) || outputScale <= 0) {
      throw new PdfRenderEngineErrorV2('Invalid outputScale: ' + outputScale, 'INVALID_SCALE');
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new PdfRenderEngineErrorV2('canvas must be an HTMLCanvasElement', 'PAGE_RENDER_FAILED');
    }

    this.cancelActiveRender();

    const expectedGeneration = this._generation;
    this._activeRenderRequestId = requestId;

    console.debug('[Mio PdfRenderEngineV2] render-start (gen: ' + expectedGeneration + ', req: ' + requestId + ', page: ' + pageNumber + ')');

    let page: PDFPageProxy;
    try {
      page = await this.getPage(pageNumber, expectedGeneration);
    } catch (e: any) {
      if (this._generation !== expectedGeneration || this._isDestroyed) {
        return {
          status: 'stale',
          generation: expectedGeneration,
          requestId,
          pageNumber,
          cssScale,
          outputScale,
          cssWidth: 0,
          cssHeight: 0,
          pixelWidth: 0,
          pixelHeight: 0,
          renderDurationMs: performance.now() - startTime
        };
      }
      throw e;
    }

    const viewport = page.getViewport({ scale: cssScale });
    const cssWidth = viewport.width;
    const cssHeight = viewport.height;
    
    const pixelWidth = Math.max(1, Math.floor(cssWidth * outputScale));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * outputScale));

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new PdfRenderEngineErrorV2('Failed to get 2d context from canvas', 'CANVAS_CONTEXT_UNAVAILABLE');
    }

    const transform = outputScale !== 1 
      ? [outputScale, 0, 0, outputScale, 0, 0] 
      : null;

    const renderTask = page.render({
      canvasContext: ctx,
      canvas: canvas,
      viewport: viewport,
      transform: transform as any
    });

    this._activeRenderTask = renderTask;

    try {
      await renderTask.promise;

      if (
        this._isDestroyed || 
        this._generation !== expectedGeneration || 
        this._activeRenderRequestId !== requestId ||
        this._activeRenderTask !== renderTask
      ) {
        console.debug('[Mio PdfRenderEngineV2] render-stale (gen: ' + expectedGeneration + ', req: ' + requestId + ')');
        return {
          status: 'stale',
          generation: expectedGeneration,
          requestId,
          pageNumber,
          cssScale,
          outputScale,
          cssWidth,
          cssHeight,
          pixelWidth,
          pixelHeight,
          renderDurationMs: performance.now() - startTime
        };
      }

      console.debug('[Mio PdfRenderEngineV2] render-complete (gen: ' + expectedGeneration + ', req: ' + requestId + ', duration: ' + (performance.now() - startTime) + 'ms)');
      return {
        status: 'completed',
        generation: expectedGeneration,
        requestId,
        pageNumber,
        cssScale,
        outputScale,
        cssWidth,
        cssHeight,
        pixelWidth,
        pixelHeight,
        renderDurationMs: performance.now() - startTime
      };
    } catch (e: any) {
      if (e?.name === 'RenderingCancelledException' || e?.message?.includes('cancelled')) {
        console.debug('[Mio PdfRenderEngineV2] render-cancelled (gen: ' + expectedGeneration + ', req: ' + requestId + ')');
        return {
          status: 'cancelled',
          generation: expectedGeneration,
          requestId,
          pageNumber,
          cssScale,
          outputScale,
          cssWidth,
          cssHeight,
          pixelWidth,
          pixelHeight,
          renderDurationMs: performance.now() - startTime
        };
      }
      console.error('[Mio PdfRenderEngineV2] render-error (gen: ' + expectedGeneration + ', req: ' + requestId + '):', e);
      throw new PdfRenderEngineErrorV2('Failed to render page', 'PAGE_RENDER_FAILED', e);
    }
  }

  public cancelActiveRender(): void {
    if (this._activeRenderTask) {
      try {
        this._activeRenderTask.cancel();
      } catch (e) {
      }
      this._activeRenderTask = null;
    }
    this._activeRenderRequestId = null;
  }

  public clearPageCache(): void {
    this._pageCache.clear();
  }

  public async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }
    
    this._isDestroyed = true;
    this._generation += 1;
    this._state = 'destroyed';
    
    console.debug('[Mio PdfRenderEngineV2] engine-destroy');

    this.cancelActiveRender();
    this.clearPageCache();

    if (this._loadingTask) {
      try {
        await this._loadingTask.destroy();
      } catch (e) {}
      this._loadingTask = null;
    }

    if (this._documentProxy) {
      try {
        await this._documentProxy.destroy();
      } catch (e) {}
      this._documentProxy = null;
    }
  }
}
