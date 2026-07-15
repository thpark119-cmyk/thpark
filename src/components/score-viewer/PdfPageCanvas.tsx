import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getFileBytesFromStorage } from '../../utils/cloudStorage';
import { ScoreAnnotationStroke, ScoreAnnotationTool } from './annotationTypes';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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

function PdfLoadingMessage({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-stone-400 gap-4 bg-stone-900/80 backdrop-blur-sm pointer-events-auto">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      <p>{text}</p>
    </div>
  );
}

function PdfErrorMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-12 text-red-400 gap-4 bg-stone-900/95 pointer-events-auto">
      <p>{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-stone-800 rounded-lg hover:bg-stone-700 text-stone-200 transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

export default function PdfPageCanvas(props: PdfPageCanvasProps) {
  const { storagePath, pageNumber, onPageCountChange } = props;

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isDownloading, setIsDownloading] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    let disposed = false;

    const loadBytes = async () => {
      setIsDownloading(true);
      setPdfBytes(null);
      setDownloadError(null);
      setDocumentError(null);
      setPageError(null);

      try {
        if (!storagePath || storagePath.trim().length === 0) {
          throw new Error('PDF_STORAGE_PATH_MISSING');
        }

        const bytes = await getFileBytesFromStorage(storagePath);

        if (disposed) {
          return;
        }

        if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
          throw new Error('PDF_BYTES_EMPTY');
        }

        setPdfBytes(new Uint8Array(bytes));
      } catch (error: any) {
        if (disposed) {
          return;
        }
        
        console.error('[Mio PDF Viewer]', { event: 'download-error', error });
        const errorCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : String(error);
        
        if (errorCode.includes('storage/unauthenticated')) {
          setDownloadError('로그인이 필요합니다.');
        } else if (errorCode.includes('storage/unauthorized')) {
          setDownloadError('이 악보를 볼 수 있는 권한이 없습니다.');
        } else if (errorCode.includes('storage/object-not-found')) {
          setDownloadError('악보 파일을 찾을 수 없습니다.');
        } else if (errorCode.includes('PDF_STORAGE_PATH_MISSING')) {
          setDownloadError('악보 경로가 잘못되었습니다.');
        } else if (errorCode.includes('PDF_BYTES_EMPTY')) {
          setDownloadError('악보 파일이 비어있습니다.');
        } else {
          setDownloadError('악보를 다운로드하지 못했습니다.');
        }
      } finally {
        if (!disposed) {
          setIsDownloading(false);
        }
      }
    };

    void loadBytes();

    return () => {
      disposed = true;
    };
  }, [storagePath, retryToken]);

  const documentFile = useMemo(() => {
    if (!pdfBytes) {
      return null;
    }
    return { data: pdfBytes };
  }, [pdfBytes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let timerId: number | undefined;

    const updateWidth = () => {
      const nextWidth = Math.floor(element.clientWidth);
      if (nextWidth < 40) return;

      setContainerWidth((previous) =>
        Math.abs(previous - nextWidth) >= 8 ? nextWidth : previous
      );
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(updateWidth, 100);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const handleRetry = () => {
    setDownloadError(null);
    setDocumentError(null);
    setPageError(null);
    setPdfBytes(null);
    setRetryToken((value) => value + 1);
  };

  const hasError = downloadError || documentError || pageError;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0 min-h-[300px] flex justify-center items-start"
      data-pdf-viewer-engine="react-pdf-10.4.1"
    >
      <style>{`
        .react-pdf__Page__canvas {
          display: block;
          max-width: 100%;
          height: auto !important;
        }
      `}</style>
      
      {isDownloading && !hasError && (
        <PdfLoadingMessage text="PDF 악보를 다운로드하는 중입니다..." />
      )}
      
      {hasError && (
        <PdfErrorMessage 
          text={downloadError || documentError || pageError || '오류가 발생했습니다.'} 
          onRetry={handleRetry} 
        />
      )}

      {documentFile && !downloadError && (
        <div className="relative max-w-full shadow-xl bg-white">
          <Document
            key={`${storagePath}:${retryToken}`}
            file={documentFile}
            onLoadSuccess={(pdf) => {
              setDocumentError(null);
              onPageCountChange(pdf.numPages);
              console.info('[Mio PDF Viewer]', {
                engine: 'react-pdf',
                reactPdfVersion: '10.4.1',
                pdfjsVersion: pdfjs.version,
                event: 'document-load-success',
                numPages: pdf.numPages,
              });
            }}
            onLoadError={(error) => {
              console.error('[Mio PDF Viewer]', {
                engine: 'react-pdf',
                event: 'document-load-error',
                errorName: error.name,
                errorMessage: error.message,
              });
              setDocumentError('PDF 문서를 열지 못했습니다.');
            }}
            loading={<PdfLoadingMessage text="PDF 문서를 불러오는 중입니다..." />}
            error={null}
          >
            {containerWidth >= 40 && (
              <Page
                pageNumber={pageNumber}
                width={containerWidth}
                devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
                renderMode="canvas"
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadError={(error) => {
                  console.error('[Mio PDF Viewer]', {
                    engine: 'react-pdf',
                    event: 'page-load-error',
                    pageNumber,
                    errorName: error.name,
                    errorMessage: error.message,
                  });
                  setPageError('PDF 페이지를 불러오지 못했습니다.');
                }}
                onRenderError={(error) => {
                  console.error('[Mio PDF Viewer]', {
                    engine: 'react-pdf',
                    event: 'page-render-error',
                    pageNumber,
                    errorName: error.name,
                    errorMessage: error.message,
                  });
                  setPageError('PDF 페이지를 화면에 표시하지 못했습니다.');
                }}
                onRenderSuccess={() => {
                  setPageError(null);
                  console.info('[Mio PDF Viewer]', {
                    engine: 'react-pdf',
                    event: 'page-render-success',
                    pageNumber,
                    containerWidth,
                    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                  });
                }}
                loading={<PdfLoadingMessage text="PDF 페이지를 표시하는 중입니다..." />}
                error={null}
              />
            )}
          </Document>
        </div>
      )}
    </div>
  );
}
