import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getFileBytesFromStorage } from '../../utils/cloudStorage';
import { ScoreAnnotationStroke, ScoreAnnotationTool } from './annotationTypes';
import AnnotationLayer from './AnnotationLayer';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString();


interface ViewTapCandidate {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startedAt: number;
  moved: boolean;
}

const VIEW_TAP_MOVE_THRESHOLD_PX = 12;
const VIEW_TAP_MAX_DURATION_MS = 500;
const PAGE_TURN_EDGE_RATIO = 0.35;

interface PdfPageCanvasProps {
  storagePath: string;
  pageNumber: number;
  onPageCountChange: (count: number) => void;
  strokes: ScoreAnnotationStroke[];
  onStrokesChange: (strokes: ScoreAnnotationStroke[]) => void;
  currentTool: ScoreAnnotationTool | 'none';
  strokeColor: string;
  strokeWidth: number;
  eraserRadius: number;
  onDirtyChange: (dirty: boolean) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  zoomScale: number;
}

interface PageDisplaySize {
  width: number;
  height: number;
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
  const { 
    storagePath, 
    pageNumber, 
    onPageCountChange,
    strokes,
    onStrokesChange,
    currentTool,
    strokeColor,
    strokeWidth,
    eraserRadius,
    onDirtyChange,
    onPreviousPage,
    onNextPage,
    canGoPrevious,
    canGoNext,
    zoomScale,
  } = props;


  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isDownloading, setIsDownloading] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [isPageRendered, setIsPageRendered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const renderedPageWidth = useMemo(
    () => Math.max(40, Math.round(containerWidth * zoomScale)),
    [containerWidth, zoomScale]
  );

  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const [pageDisplaySize, setPageDisplaySize] = useState<PageDisplaySize>({ width: 0, height: 0 });

  const viewTapCandidateRef = useRef<ViewTapCandidate | null>(null);

  const handleViewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      currentTool !== 'none' ||
      zoomScale !== 1 ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      viewTapCandidateRef.current = null;
      return;
    }

    viewTapCandidateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startedAt: window.performance.now(),
      moved: false,
    };
  };

  const handleViewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const candidate = viewTapCandidateRef.current;
    if (!candidate || candidate.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - candidate.startClientX;
    const deltaY = event.clientY - candidate.startClientY;

    if (Math.hypot(deltaX, deltaY) >= VIEW_TAP_MOVE_THRESHOLD_PX) {
      candidate.moved = true;
    }
  };

  const handleViewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const candidate = viewTapCandidateRef.current;
    viewTapCandidateRef.current = null;

    if (!candidate || candidate.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - candidate.startClientX;
    const deltaY = event.clientY - candidate.startClientY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = window.performance.now() - candidate.startedAt;

    if (
      candidate.moved ||
      distance >= VIEW_TAP_MOVE_THRESHOLD_PX ||
      duration > VIEW_TAP_MAX_DURATION_MS ||
      currentTool !== 'none' ||
      zoomScale !== 1
    ) {
      return;
    }

    const wrapper = pageWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const relativeX = event.clientX - rect.left;
    const horizontalRatio = relativeX / rect.width;

    if (horizontalRatio <= PAGE_TURN_EDGE_RATIO) {
      if (canGoPrevious) {
        onPreviousPage();
      }
      return;
    }

    if (horizontalRatio >= 1 - PAGE_TURN_EDGE_RATIO) {
      if (canGoNext) {
        onNextPage();
      }
    }
  };

  const clearViewTapCandidate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (viewTapCandidateRef.current?.pointerId === event.pointerId) {
      viewTapCandidateRef.current = null;
    }
  };


  const measureRenderedPage = useCallback(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const pdfCanvas = wrapper.querySelector<HTMLCanvasElement>('.react-pdf__Page__canvas');
    if (!pdfCanvas) {
      return;
    }
    const rect = pdfCanvas.getBoundingClientRect();
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (nextWidth < 40 || nextHeight < 40) {
      return;
    }
    setPageDisplaySize(previous =>
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : {
            width: nextWidth,
            height: nextHeight,
          }
    );
  }, []);

  useEffect(() => {
    const promiseCompatibility = (
      window as Window & {
        __MIO_PROMISE_WITH_RESOLVERS__?: string;
      }
    ).__MIO_PROMISE_WITH_RESOLVERS__;

    console.info('[Mio Compatibility]', {
      promiseWithResolvers: typeof (Promise as any).withResolvers,
      source: promiseCompatibility || 'unknown',
      pdfjsVersion: pdfjs.version,
      workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    });
  }, []);

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
    setPageDisplaySize({ width: 0, height: 0 });
    setIsPageRendered(false);
    setPageError(null);
  }, [pageNumber, documentFile, renderedPageWidth]);

  useEffect(() => {
    if (!isPageRendered) {
      return;
    }

    const wrapper = pageWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const pdfCanvas = wrapper.querySelector<HTMLCanvasElement>('.react-pdf__Page__canvas');
    if (!pdfCanvas) {
      return;
    }

    let frameId: number | null = null;

    const updateSize = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        measureRenderedPage();
        frameId = null;
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(pdfCanvas);

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isPageRendered, pageNumber, containerWidth, measureRenderedPage]);

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
      className="relative w-full min-w-0 min-h-[300px] flex items-start"
      data-pdf-viewer-engine="react-pdf-10.4.1"
    >
      <style>{`
        .react-pdf__Page__canvas {
          display: block;
          max-width: none !important;
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
              <div 
                ref={pageWrapperRef}
                className="relative max-w-none mx-auto shadow-xl bg-white"
                onPointerDown={handleViewPointerDown}
                onPointerMove={handleViewPointerMove}
                onPointerUp={handleViewPointerUp}
                onPointerCancel={clearViewTapCandidate}
                onLostPointerCapture={clearViewTapCandidate}
                style={{
                  width: renderedPageWidth >= 40 ? `${renderedPageWidth}px` : undefined,
                  touchAction: currentTool === 'none' ? 'pan-x pan-y' : undefined,
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  width={renderedPageWidth}
                  devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
                  renderMode="canvas"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadError={(error) => {
                    setIsPageRendered(false);
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
                    setIsPageRendered(false);
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
                    setIsPageRendered(true);
                    setPageError(null);
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(measureRenderedPage);
                    });
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
                


                {isPageRendered && !downloadError && !documentError && !pageError && pageDisplaySize.width > 0 && pageDisplaySize.height > 0 && (
                  <AnnotationLayer
                    width={pageDisplaySize.width}
                    height={pageDisplaySize.height}
                    strokes={strokes}
                    onStrokesChange={(newStrokes) => {
                      onStrokesChange(newStrokes);
                      onDirtyChange(true);
                    }}
                    currentTool={currentTool}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    eraserRadius={eraserRadius}
                  />
                )}

              </div>
            )}

          </Document>
        </div>
      )}
    </div>
  );
}
