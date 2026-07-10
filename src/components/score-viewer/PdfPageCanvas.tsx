import React, { useRef, useEffect, useState } from 'react';
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
  
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  const [containerWidth, setContainerWidth] = useState(0);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [retryToken, setRetryToken] = useState(0);

  const isLoadingPdf = isLoadingDocument || isRenderingPage;

  // 1. ResizeObserver for containerWidth
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let frameId = 0;

    const updateWidth = () => {
      const nextWidth = Math.floor(element.clientWidth);
      if (nextWidth < 40) return;

      setContainerWidth(previous => Math.abs(previous - nextWidth) >= 2 ? nextWidth : previous);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateWidth);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  // 2. Load Document Effect
  useEffect(() => {
    let disposed = false;
    let localTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let localDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      setIsLoadingDocument(true);
      setIsPageReady(false);
      setPdfError(null);
      setDebugError(null);

      try {
        if (!storagePath || storagePath.trim().length === 0) {
          throw new Error('PDF_STORAGE_PATH_MISSING');
        }

        console.info('[Mio PDF Viewer]', { event: 'document-load-start', storagePath });
        
        const bytes = await getFileBytesFromStorage(storagePath);

        if (!hasPdfHeader(bytes)) {
          throw new Error('INVALID_PDF_HEADER');
        }

        localTask = pdfjsLib.getDocument({ data: bytes });
        loadingTaskRef.current = localTask;

        localDoc = await localTask.promise;

        if (disposed) return;

        pdfDocRef.current = localDoc;
        onPageCountChange(localDoc.numPages);
        
        console.info('[Mio PDF Viewer]', { event: 'document-load-complete', pages: localDoc.numPages });
        setDocumentRevision(value => value + 1);
      } catch (error: any) {
        if (!disposed) {
          console.error('[Mio PDF Viewer] Document Load Error:', error);
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
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
            userMessage = 'PDF 파일을 다운로드하지 못했습니다. 네트워크 또는 저장소 설정을 확인해 주세요.';
          }

          setPdfError(userMessage);
          setDebugError(`Load Error: ${errorCode || errorName || errorMessage}`);
        }
      } finally {
        if (!disposed) {
          setIsLoadingDocument(false);
        }
      }
    };

    void loadDocument();

    return () => {
      disposed = true;

      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;

      if (loadingTaskRef.current === localTask) loadingTaskRef.current = null;
      if (pdfDocRef.current === localDoc) pdfDocRef.current = null;

      void localTask?.destroy().catch(() => undefined);
      try {
        if (localDoc && typeof (localDoc as any).cleanup === 'function') {
          (localDoc as any).cleanup();
        }
      } catch (e) {
        // ignore cleanup error
      }
    };
  }, [storagePath, retryToken, onPageCountChange]);

  // 3. Render Page Effect
  useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    const canvas = canvasRef.current;

    if (!pdfDoc || !canvas || containerWidth < 40 || documentRevision === 0) {
      return;
    }

    let disposed = false;
    let localRenderTask: pdfjsLib.RenderTask | null = null;

    const renderCurrentPage = async () => {
      setIsRenderingPage(true);
      setIsPageReady(false);
      setPdfError(null);
      setDebugError(null);

      try {
        console.info('[Mio PDF Viewer]', { event: 'page-render-start', pageNumber });
        const page = await pdfDoc.getPage(pageNumber);
        
        if (disposed) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const pageScale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: pageScale });

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('PDF_CANVAS_CONTEXT_MISSING');
        }

        const cssWidth = Math.max(1, Math.floor(viewport.width));
        const cssHeight = Math.max(1, Math.floor(viewport.height));

        const rawDpr = window.devicePixelRatio || 1;
        const preferredDpr = Math.min(rawDpr, 2);
        const MAX_CANVAS_DIMENSION = 4096;
        
        const safeDpr = Math.min(
          preferredDpr,
          MAX_CANVAS_DIMENSION / cssWidth,
          MAX_CANVAS_DIMENSION / cssHeight
        );
        
        const outputScale = Math.max(1, safeDpr);

        canvas.width = Math.floor(cssWidth * outputScale);
        canvas.height = Math.floor(cssHeight * outputScale);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport,
          transform,
        };

        // Clear canvas with white background before rendering
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        localRenderTask = page.render(renderContext);
        renderTaskRef.current = localRenderTask;

        await localRenderTask.promise;

        if (disposed) return;

        console.info('[Mio PDF Viewer]', { event: 'page-render-complete', pageNumber });
        setRenderSize({ width: cssWidth, height: cssHeight });
        setIsPageReady(true);
      } catch (error: any) {
        if (error instanceof Error && error.name === 'RenderingCancelledException') {
          return;
        }

        if (!disposed) {
          console.error('[Mio PDF Viewer] Render Error:', error);
          const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          let userMessage = 'PDF 페이지를 화면에 표시하지 못했습니다.';
          if (errorCode === 'PDF_CANVAS_SIZE_UNSUPPORTED') {
            userMessage = '이 기기에서 PDF 페이지를 표시할 수 있는 크기를 초과했습니다.';
          } else if (errorMessage === 'PDF_CANVAS_CONTEXT_MISSING') {
            userMessage = '캔버스 컨텍스트를 가져오지 못했습니다.';
          }
          
          setPdfError(userMessage);
          setDebugError(`Render Error: ${errorCode || errorMessage}`);
        }
      } finally {
        if (!disposed) {
          setIsRenderingPage(false);
        }
        if (renderTaskRef.current === localRenderTask) {
          renderTaskRef.current = null;
        }
      }
    };

    void renderCurrentPage();

    return () => {
      disposed = true;
      localRenderTask?.cancel();
      if (renderTaskRef.current === localRenderTask) {
        renderTaskRef.current = null;
      }
    };
  }, [documentRevision, pageNumber, containerWidth]);

  const handleRetry = () => {
    setRetryToken(v => v + 1);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col items-center w-full max-w-full overflow-hidden min-h-[300px]">
      <div className="relative shadow-xl">
        <canvas ref={canvasRef} className="block bg-white" style={{ zIndex: 0 }} />
        {isPageReady && renderSize.width > 0 && renderSize.height > 0 && !pdfError && (
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
