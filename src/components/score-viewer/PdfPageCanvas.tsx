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

  // Core loading function
  useEffect(() => {
    const attemptId = ++loadAttemptIdRef.current;
    
    let localLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let localPdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let disposed = false;
    
    const isCurrentAttempt = () => !disposed && loadAttemptIdRef.current === attemptId;

    const load = async () => {
      if (!isCurrentAttempt()) return;
      
      setIsLoadingPdf(true);
      setPdfError(null);
      setDebugError(null);
      setLoadStage('validate-input');

      let currentStage: PdfLoadStage = 'validate-input' as PdfLoadStage;
      let currentStageStartTime = Date.now();

      const logStageStart = (stage: PdfLoadStage) => {
        currentStage = stage;
        currentStageStartTime = Date.now();
        if (isCurrentAttempt()) setLoadStage(stage);
        console.info('[Mio PDF Viewer]', {
          event: 'stage-start',
          stage,
          storagePath,
          attemptId,
        });
      };

      const logStageComplete = (extra?: any) => {
        console.info('[Mio PDF Viewer]', {
          event: 'stage-complete',
          stage: currentStage,
          attemptId,
          durationMs: Date.now() - currentStageStartTime,
          ...extra,
        });
      };

      try {
        if (!storagePath || storagePath.trim().length === 0) {
          throw new Error('PDF_STORAGE_PATH_MISSING');
        }

        // 1. Download Bytes
        logStageStart('download-bytes');
        const pdfBytes = await withTimeout(
          getFileBytesFromStorage(storagePath),
          20000,
          'download-bytes'
        );
        logStageComplete({ byteLength: pdfBytes.byteLength });

        // 2. Validate Bytes
        logStageStart('validate-bytes');
        const isPdf = hasPdfHeader(pdfBytes);
        logStageComplete({ hasPdfHeader: isPdf });
        
        if (!isPdf) {
          throw new Error('INVALID_PDF_HEADER');
        }

        // 3. Initialize PDF.js
        logStageStart('initialize-pdfjs');
        localLoadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        loadingTaskRef.current = localLoadingTask;
        logStageComplete();

        // 4. Parse Document
        logStageStart('parse-document');
        localPdfDoc = await withTimeout(
          localLoadingTask.promise,
          20000,
          'parse-document'
        );
        pdfDocRef.current = localPdfDoc;
        logStageComplete({ pageCount: localPdfDoc.numPages });

        if (isCurrentAttempt()) {
          onPageCountChange(localPdfDoc.numPages);
          // Wait for page change & resize observer to trigger render.
          // The actual 'ready' stage will be set by renderPage.
          setLoadStage('ready');
          setIsLoadingPdf(false);
        }
      } catch (error: any) {
        if (!isCurrentAttempt()) return;
        
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
        } else if (errorName === 'PdfStageTimeoutError' && (currentStage as PdfLoadStage) === 'download-bytes') {
          userMessage = 'PDF 다운로드 시간이 초과되었습니다.';
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
          userMessage = 'PDF 파일을 다운로드하지 못했습니다. 네트워크 또는 저장소 설정을 확인해 주세요.';
        }

        setPdfError(userMessage);
        setDebugError(`오류 단계: ${currentStage} | 오류 코드: ${errorCode || errorName || errorMessage}`);
        setLoadStage('error');
      } finally {
        if (isCurrentAttempt()) {
          setIsLoadingPdf(false);
        }
      }
    };

    void load();

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
  }, [storagePath, retryToken, onPageCountChange]);

  const renderPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current) return;
    
    // We create a local reference to ensure we can check cancellation
    const localDoc = pdfDocRef.current;
    
    try {
      console.info('[Mio PDF Viewer]', { event: 'stage-start', stage: 'load-page', pageNumber });
      const page = await withTimeout<pdfjsLib.PDFPageProxy>(localDoc.getPage(pageNumber), 10000, 'load-page');
      console.info('[Mio PDF Viewer]', { event: 'stage-complete', stage: 'load-page', pageNumber });

      const viewport = page.getViewport({ scale: 1 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const containerWidth = containerRef.current.clientWidth || window.innerWidth;
      const availableWidth = Math.max(1, containerWidth);
      const pageScale = availableWidth / viewport.width;
      
      const scaledViewport = page.getViewport({ scale: pageScale });
      
      const outputScale = window.devicePixelRatio || 1;
      const renderWidth = Math.floor(scaledViewport.width);
      const renderHeight = Math.floor(scaledViewport.height);

      canvas.width = Math.floor(renderWidth * outputScale);
      canvas.height = Math.floor(renderHeight * outputScale);
      
      canvas.style.width = renderWidth + "px";
      canvas.style.height = renderHeight + "px";

      setRenderSize({ width: renderWidth, height: renderHeight });

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderContext = {
        canvasContext: context,
        canvas: canvas,
        transform: transform || undefined,
        viewport: scaledViewport
      };

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      console.info('[Mio PDF Viewer]', { event: 'stage-start', stage: 'render-page', pageNumber });
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await withTimeout<void>(renderTask.promise, 15000, 'render-page');
      
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
        console.info('[Mio PDF Viewer]', { event: 'stage-complete', stage: 'render-page', pageNumber });
      }
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException') {
        // Ignore cancelled
      } else {
        console.error('[Mio PDF Viewer]', {
          event: 'stage-error',
          stage: 'render-page',
          pageNumber,
          errorName: err instanceof Error ? err.name : 'UnknownError',
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }, [pageNumber]);

  // Render on page change or document ready
  useEffect(() => {
    if (loadStage === 'ready' && !pdfError && pdfDocRef.current) {
      void renderPage();
    }
  }, [pageNumber, loadStage, pdfError, renderPage]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    let resizeTimer: number;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (loadStage === 'ready' && !pdfError && pdfDocRef.current) {
          void renderPage();
        }
      }, 100);
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, [loadStage, pdfError, renderPage]);

  const handleRetry = () => {
    setPdfError(null);
    setDebugError(null);
    setLoadStage('idle');
    setIsLoadingPdf(true);
    setRetryToken(v => v + 1);
  };

  if (isLoadingPdf) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-400 gap-4 h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p>PDF 악보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400 gap-4 h-full">
        <p>{pdfError}</p>
        {debugError && (
          <p className="text-xs text-stone-500 font-mono mt-2">{debugError}</p>
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
    <div ref={containerRef} className="relative flex flex-col items-center w-full max-w-full overflow-hidden">
      <div className="relative shadow-xl">
        <canvas ref={canvasRef} className="block bg-white" />
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
