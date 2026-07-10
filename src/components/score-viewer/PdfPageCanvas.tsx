import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ScoreAnnotationStroke, ScoreAnnotationTool } from './annotationTypes';
import { getFileBytesFromStorage } from '../../utils/cloudStorage';
import AnnotationLayer from './AnnotationLayer';

// Initialize PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPageCanvasProps {
  storagePath: string;
  pageNumber: number;
  onPageCountChange: (count: number) => void;
  strokes: ScoreAnnotationStroke[];
  onStrokesChange: (strokes: ScoreAnnotationStroke[]) => void;
  currentTool: ScoreAnnotationTool | 'none';
  strokeColor: string;
  strokeWidth: number;
  onDirtyChange: (dirty: boolean) => void;
}

type PdfLoadStage =
  | 'idle'
  | 'validate-input'
  | 'download-bytes'
  | 'validate-bytes'
  | 'initialize-pdfjs'
  | 'parse-document'
  | 'measure-container'
  | 'load-page'
  | 'render-page'
  | 'ready'
  | 'error';

class PdfStageTimeoutError extends Error {
  stage: PdfLoadStage;
  constructor(stage: PdfLoadStage, timeoutMs: number) {
    super(`PDF stage timed out: ${stage} after ${timeoutMs}ms`);
    this.name = 'PdfStageTimeoutError';
    this.stage = stage;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: PdfLoadStage,
): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new PdfStageTimeoutError(stage, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function hasPdfHeader(data: Uint8Array): boolean {
  if (data.length < 5) return false;
  return (
    data[0] === 0x25 && // %
    data[1] === 0x50 && // P
    data[2] === 0x44 && // D
    data[3] === 0x46 && // F
    data[4] === 0x2d    // -
  );
}

export default function PdfPageCanvas({
  storagePath,
  pageNumber,
  onPageCountChange,
  strokes,
  onStrokesChange,
  currentTool,
  strokeColor,
  strokeWidth,
  onDirtyChange
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const loadAttemptIdRef = useRef(0);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [loadStage, setLoadStage] = useState<PdfLoadStage>('idle');
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [retryToken, setRetryToken] = useState(0);

  const lastRenderedWidthRef = useRef(0);
  const isRenderingRef = useRef(false);
  const pendingRenderRef = useRef(false);
  const renderRequestIdRef = useRef(0);

  const logStageStart = useCallback((stage: PdfLoadStage, attemptId: number) => {
    console.info('[Mio PDF Viewer]', {
      event: 'stage-start',
      stage,
      storagePath,
      attemptId,
    });
  }, [storagePath]);

  const logStageComplete = useCallback((stage: PdfLoadStage, attemptId: number, durationMs: number, extra?: any) => {
    console.info('[Mio PDF Viewer]', {
      event: 'stage-complete',
      stage,
      attemptId,
      durationMs,
      ...extra,
    });
  }, []);

  const handleError = useCallback((error: any, currentStage: PdfLoadStage, attemptId: number) => {
    console.error('[Mio PDF Viewer]', {
      event: 'stage-error',
      stage: currentStage,
      attemptId,
      storagePath,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    });

    const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    let userMessage = 'PDF 악보를 불러오지 못했습니다.';
    
    if (errorCode === 'storage/object-not-found') {
      userMessage = '저장된 PDF 파일을 찾을 수 없습니다.';
    } else if (errorCode === 'storage/unauthorized') {
      userMessage = '이 PDF 파일을 불러올 권한이 없습니다.';
    } else if (errorCode === 'storage/download-size-exceeded' || errorMessage === 'PDF_FILE_TOO_LARGE') {
      userMessage = '이 PDF 파일은 앱에서 열기에는 너무 큽니다.';
    } else if (errorCode === 'storage/unauthenticated') {
      userMessage = '로그인 후 다시 시도해 주세요.';
    } else if (errorMessage === 'INVALID_PDF_HEADER' || errorName === 'InvalidPDFException') {
      userMessage = 'PDF 파일이 손상되었거나 지원되지 않는 형식입니다.';
    } else if (errorMessage === 'PDF_STORAGE_PATH_MISSING') {
      userMessage = 'PDF 파일 경로를 찾을 수 없습니다.';
    } else if (errorName === 'PdfStageTimeoutError') {
      if (currentStage === 'download-bytes') {
        userMessage = 'PDF 다운로드 시간이 초과되었습니다.';
      } else if (currentStage === 'render-page') {
        userMessage = 'PDF 페이지 표시 시간이 초과되었습니다.';
      }
    } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      userMessage = 'PDF 파일을 다운로드하지 못했습니다. 네트워크 또는 저장소 설정을 확인해 주세요.';
    } else if (errorCode === 'PDF_PAGE_RENDER_FAILED') {
      userMessage = 'PDF 페이지를 화면에 표시하지 못했습니다.';
    } else if (errorCode === 'PDF_CANVAS_SIZE_UNSUPPORTED') {
      userMessage = '이 기기에서 PDF 페이지를 표시할 수 있는 크기를 초과했습니다.';
    }

    setPdfError(userMessage);
    setDebugError(`오류 단계: ${currentStage} | 오류 코드: ${errorCode || errorName || errorMessage}`);
    setLoadStage('error');
    setIsLoadingPdf(false);
  }, [storagePath]);


  // 1. Core Document Loading
  useEffect(() => {
    const attemptId = ++loadAttemptIdRef.current;
    
    let localLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let localPdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let disposed = false;
    
    const isCurrentAttempt = () => !disposed && loadAttemptIdRef.current === attemptId;

    const loadDoc = async () => {
      if (!isCurrentAttempt()) return;
      
      setIsLoadingPdf(true);
      setPdfError(null);
      setDebugError(null);
      setLoadStage('validate-input');

      let currentStage: PdfLoadStage = 'validate-input';
      let currentStageStartTime = Date.now();

      const switchStage = (stage: PdfLoadStage) => {
        if (!isCurrentAttempt()) return;
        currentStage = stage;
        currentStageStartTime = Date.now();
        setLoadStage(stage);
        logStageStart(stage, attemptId);
      };

      try {
        if (!storagePath || storagePath.trim().length === 0) {
          throw new Error('PDF_STORAGE_PATH_MISSING');
        }

        // 1. Download Bytes
        switchStage('download-bytes');
        const pdfBytes = await withTimeout(
          getFileBytesFromStorage(storagePath),
          20000,
          'download-bytes'
        );
        logStageComplete('download-bytes', attemptId, Date.now() - currentStageStartTime, { byteLength: pdfBytes.byteLength });

        // 2. Validate Bytes
        switchStage('validate-bytes');
        const isPdf = hasPdfHeader(pdfBytes);
        logStageComplete('validate-bytes', attemptId, Date.now() - currentStageStartTime, { hasPdfHeader: isPdf });
        
        if (!isPdf) {
          throw new Error('INVALID_PDF_HEADER');
        }

        // 3. Initialize PDF.js
        switchStage('initialize-pdfjs');
        localLoadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        loadingTaskRef.current = localLoadingTask;
        logStageComplete('initialize-pdfjs', attemptId, Date.now() - currentStageStartTime);

        // 4. Parse Document
        switchStage('parse-document');
        localPdfDoc = await withTimeout(
          localLoadingTask.promise,
          20000,
          'parse-document'
        );
        pdfDocRef.current = localPdfDoc;
        logStageComplete('parse-document', attemptId, Date.now() - currentStageStartTime, { pageCount: localPdfDoc.numPages });

        if (isCurrentAttempt()) {
          onPageCountChange(localPdfDoc.numPages);
          // Do not set 'ready' here. Wait for page render.
          setLoadStage('measure-container');
        }
      } catch (error: any) {
        if (!isCurrentAttempt()) return;
        handleError(error, currentStage, attemptId);
      }
    };

    void loadDoc();

    return () => {
      disposed = true;

      if (loadAttemptIdRef.current === attemptId) {
        loadAttemptIdRef.current += 1;
      }

      if (loadingTaskRef.current === localLoadingTask) {
        loadingTaskRef.current = null;
      }
      if (pdfDocRef.current === localPdfDoc) {
        pdfDocRef.current = null;
      }

      void localLoadingTask?.destroy().catch(() => undefined);
      void localPdfDoc?.cleanup();
    };
  }, [storagePath, retryToken, onPageCountChange, handleError, logStageStart, logStageComplete]);


  // 2. Render Page
  const executeRender = useCallback(async (attemptId: number, useFallback: boolean = false) => {
    if (loadAttemptIdRef.current !== attemptId) return;
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current) return;
    
    isRenderingRef.current = true;
    const localDoc = pdfDocRef.current;
    let currentStage: PdfLoadStage = 'measure-container';
    let currentStageStartTime = Date.now();

    const switchStage = (stage: PdfLoadStage) => {
      if (loadAttemptIdRef.current !== attemptId) return;
      currentStage = stage;
      currentStageStartTime = Date.now();
      setLoadStage(stage);
      logStageStart(stage, attemptId);
    };

    try {
      // Wait for container to have width
      let containerWidth = containerRef.current.clientWidth;
      let tries = 0;
      while (containerWidth < 40 && tries < 10) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (!containerRef.current || loadAttemptIdRef.current !== attemptId) return;
        containerWidth = containerRef.current.clientWidth;
        tries++;
      }
      
      if (containerWidth < 40) {
        // Fallback to window innerWidth if still 0
        containerWidth = window.innerWidth;
      }

      switchStage('load-page');
      const page = await withTimeout<pdfjsLib.PDFPageProxy>(localDoc.getPage(pageNumber), 10000, 'load-page');
      logStageComplete('load-page', attemptId, Date.now() - currentStageStartTime, { pageNumber });

      if (loadAttemptIdRef.current !== attemptId) return;

      const viewport = page.getViewport({ scale: 1 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) throw new Error("Failed to get 2d context");

      const availableWidth = Math.max(1, containerWidth);
      const pageScale = availableWidth / viewport.width;
      
      const scaledViewport = page.getViewport({ scale: pageScale });
      
      const cssWidth = Math.floor(scaledViewport.width);
      const cssHeight = Math.floor(scaledViewport.height);

      let outputScale = 1;
      
      if (!useFallback) {
        const rawDpr = window.devicePixelRatio || 1;
        const preferredDpr = Math.min(rawDpr, 2);
        const MAX_CANVAS_DIMENSION = 4096;
        const maxScaleByWidth = MAX_CANVAS_DIMENSION / Math.max(1, cssWidth);
        const maxScaleByHeight = MAX_CANVAS_DIMENSION / Math.max(1, cssHeight);
        
        outputScale = Math.max(1, Math.min(preferredDpr, maxScaleByWidth, maxScaleByHeight));
      }

      console.info('[Mio PDF Viewer]', {
        event: 'render-info',
        containerWidth,
        cssWidth,
        cssHeight,
        rawDpr: window.devicePixelRatio,
        outputScale,
        useFallback
      });

      const renderWidth = Math.floor(cssWidth * outputScale);
      const renderHeight = Math.floor(cssHeight * outputScale);

      // Protect against overly large canvas
      if (renderWidth > 4096 || renderHeight > 4096) {
        const err = new Error('Canvas size too large');
        (err as any).code = 'PDF_CANVAS_SIZE_UNSUPPORTED';
        throw err;
      }

      canvas.width = Math.max(1, renderWidth);
      canvas.height = Math.max(1, renderHeight);
      
      canvas.style.width = cssWidth + "px";
      canvas.style.height = cssHeight + "px";

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext = {
        canvasContext: context,
        canvas: canvas,
        transform: transform,
        viewport: scaledViewport,
        intent: 'display' as const,
        background: 'rgb(255,255,255)'
      };

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      switchStage('render-page');
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await withTimeout<void>(renderTask.promise, 15000, 'render-page');
      
      if (loadAttemptIdRef.current !== attemptId) return;

      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
        logStageComplete('render-page', attemptId, Date.now() - currentStageStartTime, { pageNumber });
        
        // Blank canvas check
        if (!useFallback) {
          try {
            const operatorList = await page.getOperatorList();
            if (operatorList.fnArray.length > 0) {
              const imgData = context.getImageData(0, 0, canvas.width, canvas.height).data;
              let isBlank = true;
              
              // Check a few spots (center, corners)
              const points = [
                { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
                { x: Math.floor(canvas.width * 0.25), y: Math.floor(canvas.height * 0.25) },
                { x: Math.floor(canvas.width * 0.75), y: Math.floor(canvas.height * 0.25) },
                { x: Math.floor(canvas.width * 0.25), y: Math.floor(canvas.height * 0.75) },
                { x: Math.floor(canvas.width * 0.75), y: Math.floor(canvas.height * 0.75) }
              ];
              
              for (const p of points) {
                const idx = (p.y * canvas.width + p.x) * 4;
                if (idx >= 0 && idx < imgData.length) {
                  const r = imgData[idx];
                  const g = imgData[idx + 1];
                  const b = imgData[idx + 2];
                  if (r !== 255 || g !== 255 || b !== 255) {
                    isBlank = false;
                    break;
                  }
                }
              }

              if (isBlank) {
                console.error('[Mio PDF Viewer]', {
                  event: 'stage-error',
                  stage: 'render-page',
                  attemptId,
                  errorName: 'BLANK_CANVAS_AFTER_RENDER',
                  errorMessage: 'Canvas is blank after render, falling back'
                });
                console.warn('[Mio PDF Viewer] Render failed (blank canvas), trying fallback to outputScale 1');
                isRenderingRef.current = false;
                void executeRender(attemptId, true);
                return;
              }
            }
          } catch (e) {
            console.warn('[Mio PDF Viewer] Failed to check canvas blank state', e);
          }
        }

        lastRenderedWidthRef.current = containerWidth;
        setRenderSize({ width: cssWidth, height: cssHeight });
        setLoadStage('ready');
        setIsLoadingPdf(false);
      }
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException') {
        // Ignore cancelled
      } else {
        if (loadAttemptIdRef.current !== attemptId) return;
        
        if (!useFallback && err.code !== 'PDF_CANVAS_SIZE_UNSUPPORTED') {
          console.warn('[Mio PDF Viewer] Render failed, trying fallback to outputScale 1', err);
          isRenderingRef.current = false; // Reset before fallback
          void executeRender(attemptId, true); // Try with fallback
          return;
        }

        (err as any).code = (err as any).code || 'PDF_PAGE_RENDER_FAILED';
        handleError(err, currentStage, attemptId);
      }
    } finally {
      isRenderingRef.current = false;
      if (pendingRenderRef.current && loadAttemptIdRef.current === attemptId) {
        pendingRenderRef.current = false;
        void executeRender(attemptId);
      }
    }
  }, [pageNumber, handleError, logStageStart, logStageComplete]);


  // Trigger Render
  const triggerRender = useCallback(() => {
    if (loadStage === 'error' || loadStage === 'idle' || loadStage === 'validate-input' || loadStage === 'download-bytes' || loadStage === 'validate-bytes' || loadStage === 'initialize-pdfjs' || loadStage === 'parse-document') {
       return;
    }
    
    if (!pdfDocRef.current) return;
    
    const reqId = ++renderRequestIdRef.current;
    const currentAttemptId = loadAttemptIdRef.current;

    if (isRenderingRef.current) {
      pendingRenderRef.current = true;
    } else {
      void executeRender(currentAttemptId);
    }
  }, [loadStage, executeRender]);

  // Effect to handle page number change or document ready
  useEffect(() => {
    triggerRender();
  }, [pageNumber, loadStage === 'measure-container', triggerRender]);


  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    let resizeTimer: number;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (loadStage === 'ready' || loadStage === 'measure-container') {
           const newWidth = containerRef.current?.clientWidth || 0;
           if (Math.abs(newWidth - lastRenderedWidthRef.current) >= 2) {
             triggerRender();
           }
        }
      }, 150);
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, [loadStage, triggerRender]);

  const handleRetry = () => {
    setPdfError(null);
    setDebugError(null);
    setLoadStage('idle');
    setIsLoadingPdf(true);
    setRetryToken(v => v + 1);
  };

  if (isLoadingPdf) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-400 gap-4 h-full min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p>PDF 악보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400 gap-4 h-full min-h-[300px]">
        <p>{pdfError}</p>
        {debugError && (
          <p className="text-xs text-stone-500 font-mono mt-2 text-center max-w-sm break-all">{debugError}</p>
        )}
        <button 
          onClick={handleRetry}
          className="mt-4 px-4 py-2 bg-stone-800 rounded-lg hover:bg-stone-700 text-stone-200 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-center w-full max-w-full overflow-hidden min-h-0">
      <div className="relative shadow-xl">
        <canvas ref={canvasRef} className="block bg-white" style={{ zIndex: 0 }} />
        {renderSize.width > 0 && renderSize.height > 0 && !!pdfDocRef.current && loadStage === 'ready' && (
          <AnnotationLayer
            width={renderSize.width}
            height={renderSize.height}
            strokes={strokes}
            onStrokesChange={(newStrokes) => {
              onStrokesChange(newStrokes);
              onDirtyChange(true);
            }}
            currentTool={currentTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
          />
        )}
      </div>
    </div>
  );
}
