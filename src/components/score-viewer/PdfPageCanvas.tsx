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

  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [retryCount, setRetryCount] = useState(0);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    
    // Cleanup previous tasks
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy();
      loadingTaskRef.current = null;
    }
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    const loadPdf = async () => {
      let currentStage = 'validate-storage-path';
      
      if (!storagePath || storagePath.trim().length === 0) {
        if (isMounted) {
          setError('PDF 파일 경로를 찾을 수 없습니다.');
          setIsLoadingPdf(false);
        }
        return;
      }

      setIsLoadingPdf(true);
      setError(null);

      try {
        currentStage = 'download-storage-bytes';
        const pdfBytes = await getFileBytesFromStorage(storagePath);
        
        currentStage = 'validate-pdf-bytes';
        if (!hasPdfHeader(pdfBytes)) {
          throw new Error('INVALID_PDF_HEADER');
        }

        currentStage = 'create-pdf-loading-task';
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        loadingTaskRef.current = loadingTask;
        
        currentStage = 'load-pdf-document';
        const doc = await loadingTask.promise;
        pdfDocRef.current = doc;

        if (isMounted) {
          onPageCountChange(pdfDocRef.current.numPages);
          setIsLoadingPdf(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[Mio PDF Viewer]', {
            stage: currentStage,
            storagePath,
            errorName: err instanceof Error ? err.name : 'UnknownError',
            errorMessage: err instanceof Error ? err.message : String(err),
            errorCode: typeof err === 'object' && err && 'code' in err ? String(err.code) : undefined,
          });

          // Determine user message
          let userMessage = 'PDF 악보를 불러오지 못했습니다.';
          const errorCode = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
          
          if (errorCode === 'storage/object-not-found') {
            userMessage = '저장된 PDF 파일을 찾을 수 없습니다.';
          } else if (errorCode === 'storage/unauthorized') {
            userMessage = '이 PDF 파일을 불러올 권한이 없습니다.';
          } else if (errorCode === 'storage/download-size-exceeded') {
            userMessage = '이 PDF 파일은 앱에서 열기에는 너무 큽니다.';
          } else if (err.message === 'INVALID_PDF_HEADER') {
            userMessage = '이 파일은 올바른 PDF 형식이 아닙니다.';
          } else if (err.name === 'InvalidPDFException') {
            userMessage = 'PDF 파일이 손상되었거나 지원되지 않는 형식입니다.';
          }

          setError(userMessage);
          setIsLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [storagePath, retryCount, onPageCountChange]);

  const renderPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current) return;
    
    try {
      const page = await pdfDocRef.current.getPage(pageNumber);
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
        transform: transform || undefined,
        viewport: scaledViewport
      };

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
      
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException') {
        // Ignore cancelled
      } else {
        console.error('Error rendering page', err);
      }
    }
  }, [pageNumber]);

  // Render on page change or loading finish
  useEffect(() => {
    if (!isLoadingPdf && !error && pdfDocRef.current) {
      renderPage();
    }
  }, [pageNumber, isLoadingPdf, error, renderPage]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!isLoadingPdf && !error && pdfDocRef.current) {
        renderPage();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoadingPdf, error, renderPage]);

  if (isLoadingPdf) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-400 gap-4 h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p>PDF 악보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400 gap-4 h-full">
        <p>{error}</p>
        <button 
          onClick={() => setRetryCount(c => c + 1)}
          className="px-4 py-2 bg-stone-800 rounded-lg hover:bg-stone-700 text-stone-200 transition-colors"
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
        {renderSize.width > 0 && renderSize.height > 0 && !!pdfDocRef.current && (
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
