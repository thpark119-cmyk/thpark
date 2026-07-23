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
  RenderTask,
  RenderingCancelledException
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

  private logDebug(event: string, ...details: unknown[]) {
    if (import.meta.env.DEV) {
      console.debug(`[Mio PdfRenderEngineV2] ${event}`, ...details);
    }
  }

  private logWarning(event: string, ...details: unknown[]) {
    if (import.meta.env.DEV) {
      console.warn(`[Mio PdfRenderEngineV2] ${event}`, ...details);
    }
  }

  private async disposeDocumentResources(): Promise<void> {
    const task = this._loadingTask;
    const proxy = this._documentProxy;
    
    this._loadingTask = null;
    this._documentProxy = null;
    this.clearPageCache();
    this.cancelActiveRender();

    if (task) {
      try {
        await task.destroy();
      } catch (e: unknown) {
        this.logWarning('Error destroying previous loading task:', e);
      }
    } else if (proxy) {
      try {
        await proxy.destroy();
      } catch (e: unknown) {
        this.logWarning('Error destroying previous document proxy:', e);
      }
    }
  }

  private releaseActiveRender(task: RenderTask, requestId: number): void {
    if (this._activeRenderTask === task && this._activeRenderRequestId === requestId) {
      this._activeRenderTask = null;
      this._activeRenderRequestId = null;
    }
  }

  public cancelActiveRender(): void {
    const task = this._activeRenderTask;
    this._activeRenderTask = null;
    this._activeRenderRequestId = null;
    
    if (task) {
      try {
        task.cancel();
      } catch (e: unknown) {
        // ignore
      }
    }
  }

  public clearPageCache(): void {
    this._pageCache.clear();
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

    this._generation += 1;
    const currentGeneration = this._generation;

    await this.disposeDocumentResources();

    if (this._generation !== currentGeneration || this._isDestroyed) {
      this.logDebug('document-load-stale: before task creation (gen: ' + currentGeneration + ')');
      return { status: 'stale', generation: currentGeneration, numPages: 0, fingerprint: null };
    }

    this._state = 'loading';
    this.logDebug('document-load-start (gen: ' + currentGeneration + ')');

    let loadingTask: PDFDocumentLoadingTask;
    try {
      const dataCopy = new Uint8Array(bytes);
      loadingTask = getDocument({ data: dataCopy });
      this._loadingTask = loadingTask;
    } catch (e: unknown) {
      this._state = 'idle';
      throw new PdfRenderEngineErrorV2('Failed to create loading task', 'DOCUMENT_LOAD_FAILED', e);
    }

    try {
      const documentProxy = await loadingTask.promise;
      
      if (
        this._isDestroyed || 
        this._generation !== currentGeneration || 
        this._loadingTask !== loadingTask
      ) {
        try {
          documentProxy.destroy();
        } catch (e: unknown) {
          // ignore
        }
        this.logDebug('document-load-stale: after load (gen: ' + currentGeneration + ')');
        return { status: 'stale', generation: currentGeneration, numPages: 0, fingerprint: null };
      }

      this._documentProxy = documentProxy;
      this._state = 'ready';
      
      const fingerprints = documentProxy.fingerprints || [];
      const fingerprint = fingerprints[0] || null;
      
      this.logDebug('document-load-success (gen: ' + currentGeneration + ', pages: ' + documentProxy.numPages + ')');

      return {
        status: 'loaded',
        generation: currentGeneration,
        numPages: documentProxy.numPages,
        fingerprint: typeof fingerprint === 'string' ? fingerprint : null
      };
    } catch (e: unknown) {
      if (this._loadingTask === loadingTask) {
        this._loadingTask = null;
        this._state = 'idle';
      }
      throw new PdfRenderEngineErrorV2('Failed to load document', 'DOCUMENT_LOAD_FAILED', e);
    }
  }

  private async getPage(pageNumber: number, expectedGeneration: number): Promise<PDFPageProxy> {
    if (this._isDestroyed) {
      throw new PdfRenderEngineErrorV2('Engine is destroyed', 'ENGINE_DESTROYED');
    }
    const proxy = this._documentProxy;
    if (!proxy) {
      throw new PdfRenderEngineErrorV2('No document loaded', 'DOCUMENT_NOT_LOADED');
    }
    if (this._generation !== expectedGeneration) {
      throw new PdfRenderEngineErrorV2('Generation mismatch', 'PAGE_LOAD_FAILED');
    }
    if (pageNumber < 1 || pageNumber > this.numPages) {
      throw new PdfRenderEngineErrorV2('Invalid page number: ' + pageNumber, 'INVALID_PAGE_NUMBER');
    }

    if (this._pageCache.has(pageNumber)) {
      this.logDebug('page-cache-hit (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
      return this._pageCache.get(pageNumber)!;
    }

    this.logDebug('page-load-start (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
    try {
      const page = await proxy.getPage(pageNumber);
      
      if (
        this._isDestroyed ||
        this._generation !== expectedGeneration ||
        this._documentProxy !== proxy
      ) {
        this.logDebug('page-load-stale (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
        throw new PdfRenderEngineErrorV2('Generation mismatch after page load', 'PAGE_LOAD_FAILED');
      }

      this._pageCache.set(pageNumber, page);
      this.logDebug('page-load-success (gen: ' + expectedGeneration + ', page: ' + pageNumber + ')');
      return page;
    } catch (e: unknown) {
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

    this.logDebug('render-start (gen: ' + expectedGeneration + ', req: ' + requestId + ', page: ' + pageNumber + ')');

    const makeStaleResult = (): PdfRenderResultV2 => ({
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
    });

    let page: PDFPageProxy;
    try {
      page = await this.getPage(pageNumber, expectedGeneration);
    } catch (e: unknown) {
      if (this._generation !== expectedGeneration || this._isDestroyed || this._activeRenderRequestId !== requestId) {
        return makeStaleResult();
      }
      throw e;
    }

    if (this._generation !== expectedGeneration || this._isDestroyed || this._activeRenderRequestId !== requestId) {
      return makeStaleResult();
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

    if (this._generation !== expectedGeneration || this._isDestroyed || this._activeRenderRequestId !== requestId) {
      return makeStaleResult();
    }

    const transform: [number, number, number, number, number, number] | undefined = 
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    const renderTask = page.render({
      canvasContext: ctx,
      canvas: canvas,
      viewport: viewport,
      transform: transform
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
        this.logDebug('render-stale (gen: ' + expectedGeneration + ', req: ' + requestId + ')');
        return { ...makeStaleResult(), cssWidth, cssHeight, pixelWidth, pixelHeight };
      }

      this.logDebug('render-complete (gen: ' + expectedGeneration + ', req: ' + requestId + ', duration: ' + (performance.now() - startTime) + 'ms)');
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
    } catch (e: unknown) {
      if (e instanceof RenderingCancelledException || (e instanceof Error && e.name === 'RenderingCancelledException')) {
        this.logDebug('render-cancelled (gen: ' + expectedGeneration + ', req: ' + requestId + ')');
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
      throw new PdfRenderEngineErrorV2('Failed to render page', 'PAGE_RENDER_FAILED', e);
    } finally {
      this.releaseActiveRender(renderTask, requestId);
    }
  }

  public async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }
    
    this._isDestroyed = true;
    this._generation += 1;
    this._state = 'destroyed';
    
    this.logDebug('engine-destroy');

    await this.disposeDocumentResources();
  }
}
