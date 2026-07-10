import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ScoreAnnotationStroke, ScoreAnnotationTool } from './annotationTypes';
import { getFileBytesFromStorage } from '../../utils/cloudStorage';
import AnnotationLayer from './AnnotationLayer';

// Initialize PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfRuntimeStage =
  | 'download-bytes'
  | 'parse-document'
  | 'load-page'
  | 'render-page';

class PdfRuntimeTimeoutError extends Error {
  stage: PdfRuntimeStage;

  constructor(stage: PdfRuntimeStage, timeoutMs: number) {
    super(`PDF runtime timeout: ${stage} after ${timeoutMs}ms`);
    this.name = 'PdfRuntimeTimeoutError';
    this.stage = stage;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: PdfRuntimeStage,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      try {
        onTimeout?.();
      } finally {
        reject(new PdfRuntimeTimeoutError(stage, timeoutMs));
      }
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
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [retryToken, setRetryToken] = useState(0);

  const documentAttemptRef = useRef(0);
  const renderAttemptRef = useRef(0);

  const isLoadingPdf = isLoadingDocument || isRenderingPage;

  // 1. Measure Container Width
  useEffect(() => {
    let frameId1: number;
    let frameId2: number;

    frameId1 = requestAnimationFrame(() => {
      frameId2 = requestAnimationFrame(() => {
        const width = containerRef.current?.clientWidth ?? 0;
        setMeasuredWidth(width);
        
        if (width < 40) {
          setPdfError('오류: 화면의 너비를 측정할 수 없습니다.');
          setDebugError('PDF_VIEWER_WIDTH_INVALID');
        }
      });
    });

    return () => {
      cancelAnimationFrame(frameId1);
      cancelAnimationFrame(frameId2);
    };
  }, [documentRevision]);

  // 2. Load Document Effect
  useEffect(() => {
    let disposed = false;
    let localTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let localDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const documentAttempt = ++documentAttemptRef.current;
    
    const isCurrentDocumentAttempt = () =>
      !disposed && documentAttemptRef.current === documentAttempt;

    const loadDocument = async () => {
      setIsLoadingDocument(true);
      setIsPageReady(false);
      setPdfError(null);
      setDebugError(null);

      try {
        if (!storagePath || storagePath.trim().length === 0) {
          throw new Error('PDF_STORAGE_PATH_MISSING');
        }

        console.info('[Mio PDF Viewer]', { event: 'document-load-start', storagePath, documentAttempt });
        
        const bytes = await withTimeout(
          getFileBytesFromStorage(storagePath),
          20_000,
          'download-bytes'
        );

        if (!hasPdfHeader(bytes)) {
          throw new Error('INVALID_PDF_HEADER');
        }

        localTask = pdfjsLib.getDocument({ data: bytes });
        localDoc = await withTimeout(
          localTask.promise,
          20_000,
          'parse-document',
          () => {
            void localTask?.destroy().catch(() => undefined);
          }
        );

        if (!isCurrentDocumentAttempt()) {
          return;
        }

        pdfDocRef.current = localDoc;
        onPageCountChange(localDoc.numPages);
        
        console.info('[Mio PDF Viewer]', { event: 'document-load-complete', pages: localDoc.numPages, documentAttempt });
        setDocumentRevision(value => value + 1);
      } catch (error: any) {
        if (!disposed) {
          console.error('[Mio PDF Viewer] Document Load Error:', error);
          const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorName = error instanceof Error ? error.name : '';

          let userMessage = 'PDF 악보를 불러오지 못했습니다.';
          
          if (error instanceof PdfRuntimeTimeoutError) {
            if (error.stage === 'download-bytes') {
              userMessage = 'PDF 다운로드 시간이 초과되었습니다.';
            } else if (error.stage === 'parse-document') {
              userMessage = 'PDF 문서를 분석하는 시간이 초과되었습니다.';
            }
          } else if (errorCode === 'storage/object-not-found') {
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
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
            userMessage = 'PDF 파일을 다운로드하지 못했습니다. 네트워크 또는 저장소 설정을 확인해 주세요.';
          }

          setPdfError(userMessage);
          
          if (error instanceof PdfRuntimeTimeoutError) {
             console.info('[Mio PDF Viewer]', { event: 'document-load-timeout', storagePath, documentAttempt, stage: error.stage });
             setDebugError(`Load Timeout: ${error.stage}`);
          } else {
             console.info('[Mio PDF Viewer]', { event: 'document-load-error', storagePath, documentAttempt });
             setDebugError(`Load Error: ${errorCode || errorName || errorMessage}`);
          }
        }
      } finally {
        if (isCurrentDocumentAttempt()) {
          setIsLoadingDocument(false);
        }
      }
    };

    void loadDocument();

    return () => {
      disposed = true;
      if (documentAttemptRef.current === documentAttempt) {
        documentAttemptRef.current += 1;
      }
      renderAttemptRef.current += 1;
      
      if (pdfDocRef.current === localDoc) {
        pdfDocRef.current = null;
      }
      
      if (localTask) {
        void localTask.destroy().catch(() => undefined);
      } else if (localDoc) {
        void (localDoc as unknown as { destroy: () => Promise<void> }).destroy().catch(() => undefined);
      }
    };
  }, [storagePath, retryToken]);

  // 3. Render Page Effect
  useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    const displayCanvas = displayCanvasRef.current;

    if (!pdfDoc || !displayCanvas || measuredWidth < 40 || documentRevision === 0) {
      return;
    }

    let disposed = false;
    let localRenderTask: pdfjsLib.RenderTask | null = null;
    
    const renderAttempt = ++renderAttemptRef.current;
    const isCurrentRenderAttempt = () => 
      !disposed && renderAttemptRef.current === renderAttempt;

    const renderCurrentPage = async () => {
      setIsRenderingPage(true);
      setIsPageReady(false);
      setPdfError(null);
      setDebugError(null);

      const startTime = performance.now();

      try {
        console.info('[Mio PDF Viewer]', { event: 'page-render-start', pageNumber, renderAttempt });
        
        const page = await withTimeout<pdfjsLib.PDFPageProxy>(
          pdfDoc.getPage(pageNumber),
          10_000,
          'load-page'
        );
        
        if (disposed) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const pageScale = measuredWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: pageScale });

        const stagingCanvas = document.createElement('canvas');
        const stagingContext = stagingCanvas.getContext('2d', { alpha: false });
        if (!stagingContext) {
          throw new Error('PDF_CANVAS_CONTEXT_MISSING');
        }

        const cssWidth = Math.max(1, Math.floor(viewport.width));
        const cssHeight = Math.max(1, Math.floor(viewport.height));

        const rawDpr = window.devicePixelRatio || 1;
        const preferredDpr = Math.min(rawDpr, 2);
        const MAX_CANVAS_DIMENSION = 4096;
        const MAX_CANVAS_PIXELS = 12_000_000;
        
        const safeDpr = Math.min(
          preferredDpr,
          MAX_CANVAS_DIMENSION / cssWidth,
          MAX_CANVAS_DIMENSION / cssHeight,
          Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight))
        );
        
        const outputScale = safeDpr;
        
        if (!Number.isFinite(outputScale) || outputScale <= 0) {
          throw new Error('PDF_OUTPUT_SCALE_INVALID');
        }

        stagingCanvas.width = Math.max(1, Math.floor(cssWidth * outputScale));
        stagingCanvas.height = Math.max(1, Math.floor(cssHeight * outputScale));
        
        const transform: [number, number, number, number, number, number] | undefined = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: stagingContext,
          canvas: stagingCanvas,
          viewport,
          transform,
          background: 'rgb(255,255,255)',
        };

        localRenderTask = page.render(renderContext);
        
        await withTimeout(
          localRenderTask.promise,
          15_000,
          'render-page',
          () => {
            localRenderTask?.cancel();
          }
        );

        if (!isCurrentRenderAttempt()) return;
        
        const durationMs = Math.round(performance.now() - startTime);

        console.info('[Mio PDF Viewer]', { event: 'page-render-complete', pageNumber, renderAttempt, durationMs });
        
        const displayContext = displayCanvas.getContext('2d', { alpha: false });
        if (!displayContext) {
          throw new Error('PDF_DISPLAY_CONTEXT_MISSING');
        }
        
        if (!isCurrentRenderAttempt()) return;

        // Swap to display canvas
        displayCanvas.width = stagingCanvas.width;
        displayCanvas.height = stagingCanvas.height;
        displayCanvas.style.width = `${cssWidth}px`;
        displayCanvas.style.height = `${cssHeight}px`;

        displayContext.setTransform(1, 0, 0, 1, 0, 0);
        displayContext.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayContext.drawImage(stagingCanvas, 0, 0);

        setRenderSize({ width: cssWidth, height: cssHeight });
        setIsPageReady(true);
        
        console.info('[Mio PDF Viewer]', { 
          event: 'display-canvas-swap', 
          pageNumber, 
          renderAttempt,
          cssWidth,
          cssHeight,
          backingWidth: stagingCanvas.width,
          backingHeight: stagingCanvas.height,
          outputScale,
          durationMs
        });
      } catch (error: any) {
        if (error instanceof Error && error.name === 'RenderingCancelledException') {
          console.info('[Mio PDF Viewer]', { event: 'page-render-cancelled', pageNumber, renderAttempt });
          return;
        }

        if (!disposed) {
          console.error('[Mio PDF Viewer] Render Error:', error);
          const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          let userMessage = 'PDF 페이지를 화면에 표시하지 못했습니다.';
          if (error instanceof PdfRuntimeTimeoutError) {
            if (error.stage === 'load-page') {
              userMessage = 'PDF 페이지를 불러오는 시간이 초과되었습니다.';
            } else if (error.stage === 'render-page') {
              userMessage = 'PDF 페이지를 화면에 표시하는 시간이 초과되었습니다.';
            }
          } else if (errorCode === 'PDF_CANVAS_SIZE_UNSUPPORTED') {
            userMessage = '이 기기에서 PDF 페이지를 표시할 수 있는 크기를 초과했습니다.';
          } else if (errorMessage === 'PDF_CANVAS_CONTEXT_MISSING') {
            userMessage = '캔버스 컨텍스트를 가져오지 못했습니다.';
          } else if (errorMessage === 'PDF_DISPLAY_CONTEXT_MISSING') {
            userMessage = '화면 캔버스 컨텍스트를 가져오지 못했습니다.';
          }
          
          setPdfError(userMessage);
          if (error instanceof PdfRuntimeTimeoutError) {
             setDebugError(`Render Timeout: ${error.stage}`);
             console.info('[Mio PDF Viewer]', { event: 'page-render-timeout', pageNumber, renderAttempt, stage: error.stage });
          } else {
             setDebugError(`Render Error: ${errorCode || errorMessage}`);
             console.info('[Mio PDF Viewer]', { event: 'page-render-error', pageNumber, renderAttempt });
          }
        }
      } finally {
        if (isCurrentRenderAttempt()) {
          setIsRenderingPage(false);
        }
      }
    };

    void renderCurrentPage();

    return () => {
      disposed = true;
      localRenderTask?.cancel();
    };
  }, [documentRevision, pageNumber, measuredWidth]);

  const handleRetry = () => {
    documentAttemptRef.current += 1;
    renderAttemptRef.current += 1;

    setPdfError(null);
    setDebugError(null);
    setIsPageReady(false);

    setRetryToken(v => v + 1);
  };

  return (
    <div ref={containerRef} className="relative w-full min-h-[300px] flex flex-col items-center">
      <div className="relative shadow-xl">
        <canvas ref={displayCanvasRef} className="block bg-white" style={{ zIndex: 0 }} />
        {isPageReady && !pdfError && renderSize.width > 0 && renderSize.height > 0 && (
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

      {isLoadingPdf && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-stone-400 gap-4 bg-stone-900/80 backdrop-blur-sm pointer-events-auto">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          <p>PDF 악보를 불러오는 중입니다...</p>
        </div>
      )}

      {pdfError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-12 text-red-400 gap-4 bg-stone-900/95 pointer-events-auto">
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
      )}
    </div>
  );
}
