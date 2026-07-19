import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Share, ChevronLeft, ChevronRight, Pen, Highlighter, Eraser, Undo, Redo, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react';
import { CloudScoreFile } from '../../types/cloudFiles';
import { ScoreAnnotationTool, ScoreAnnotationDocument, ScoreAnnotationStroke } from './annotationTypes';
import { loadScoreAnnotations, saveScoreAnnotations } from '../../utils/scoreAnnotationStorage';
import { createAnnotatedPdf } from '../../utils/annotatedPdfExport';
import { getFileDownloadUrl } from '../../utils/cloudStorage';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import PdfPageCanvas from './PdfPageCanvas';

interface ScoreViewerProps {
  file: CloudScoreFile;
  repertoireId: string;
  onClose: () => void;
}

type AnnotationLoadState =
  | 'loading'
  | 'ready'
  | 'error';

type AutoSaveState =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error';

type ScoreShareVariant =
  | 'original'
  | 'annotated';


interface ViewerViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ERASER_RADIUS_OPTIONS = [
  { label: '작게', value: 10, previewSize: 8 },
  { label: '보통', value: 18, previewSize: 14 },
  { label: '크게', value: 30, previewSize: 20 },
] as const;

function downloadScoreBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

async function shareOrDownloadScore({
  blob,
  fileName,
  contentType,
}: {
  blob: Blob;
  fileName: string;
  contentType: string;
}): Promise<void> {
  const shareFile = new File([blob], fileName, {
    type: contentType || blob.type || 'application/pdf',
  });

  if (
    navigator.canShare &&
    navigator.canShare({
      files: [shareFile],
    })
  ) {
    try {
      await navigator.share({
        files: [shareFile],
        title: fileName,
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw error;
    }
  }

  downloadScoreBlob(blob, fileName);
}

async function loadOriginalScoreBlob(storagePath: string): Promise<Blob> {
  const downloadUrl = await getFileDownloadUrl(storagePath);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`ORIGINAL_SCORE_FETCH_FAILED:${response.status}`);
  }
  return response.blob();
}

const MIN_ZOOM_SCALE = 1;
const MAX_ZOOM_SCALE = 2;
const ZOOM_SCALE_STEP = 0.25;

function clampZoomScale(value: number): number {
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));
}

interface ScoreTouchPoint {
  clientX: number;
  clientY: number;
}

interface ScoreSingleTouchPan {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
}

interface ScorePinchSession {
  startDistance: number;
  startZoomScale: number;
  lastMidpointX: number;
  lastMidpointY: number;
  latestZoomScale: number;
}

interface PendingZoomAnchor {
  xRatio: number;
  yRatio: number;
  viewportOffsetX: number;
  viewportOffsetY: number;
}

function getTouchDistance(first: ScoreTouchPoint, second: ScoreTouchPoint): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function getTouchMidpoint(first: ScoreTouchPoint, second: ScoreTouchPoint): { x: number; y: number } {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

function getFirstTwoTouchPoints(pointers: Map<number, ScoreTouchPoint>): [ScoreTouchPoint, ScoreTouchPoint] | null {
  const points = Array.from(pointers.values());
  if (points.length < 2) {
    return null;
  }
  return [points[0], points[1]];
}

function normalizeZoomScale(value: number): number {
  const clamped = clampZoomScale(value);
  if (Math.abs(clamped - MIN_ZOOM_SCALE) < 0.015) {
    return MIN_ZOOM_SCALE;
  }
  if (Math.abs(clamped - MAX_ZOOM_SCALE) < 0.015) {
    return MAX_ZOOM_SCALE;
  }
  return Math.round(clamped * 100) / 100;
}


export default function ScoreViewer({ file, repertoireId, onClose }: ScoreViewerProps) {
  useBodyScrollLock(true);
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM_SCALE);
  const scoreViewportRef = useRef<HTMLDivElement>(null);
  const viewerViewportRef = useRef<HTMLDivElement>(null);


  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null);

  const touchPointersRef = useRef<Map<number, ScoreTouchPoint>>(new Map());
  const singleTouchPanRef = useRef<ScoreSingleTouchPan | null>(null);
  const pinchSessionRef = useRef<ScorePinchSession | null>(null);
  const suppressTouchUntilReleaseRef = useRef(false);
  const pinchFrameRef = useRef<number | null>(null);
  const pendingPinchUpdateRef = useRef<{ zoomScale: number; midpointX: number; midpointY: number; } | null>(null);
  
  const zoomScaleRef = useRef(zoomScale);
  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  const [isTwoFingerGestureActive, setIsTwoFingerGestureActive] = useState(false);
  const [touchGestureSessionId, setTouchGestureSessionId] = useState(0);



  const handleZoomChangeAtPoint = useCallback((requestedScale: number, clientX: number, clientY: number) => {
    const nextScale = normalizeZoomScale(requestedScale);
    if (Math.abs(nextScale - zoomScaleRef.current) < 0.005) {
      return;
    }

    const viewport = scoreViewportRef.current;
    if (!viewport) {
      zoomScaleRef.current = nextScale;
      setZoomScale(nextScale);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportOffsetX = Math.max(0, Math.min(viewport.clientWidth, clientX - viewportRect.left));
    const viewportOffsetY = Math.max(0, Math.min(viewport.clientHeight, clientY - viewportRect.top));

    pendingZoomAnchorRef.current = {
      xRatio: (viewport.scrollLeft + viewportOffsetX) / Math.max(1, viewport.scrollWidth),
      yRatio: (viewport.scrollTop + viewportOffsetY) / Math.max(1, viewport.scrollHeight),
      viewportOffsetX,
      viewportOffsetY,
    };

    zoomScaleRef.current = nextScale;
    setZoomScale(nextScale);
  }, []);

  const handleZoomChange = useCallback((requestedScale: number) => {
    const viewport = scoreViewportRef.current;
    if (!viewport) {
      handleZoomChangeAtPoint(requestedScale, 0, 0);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    handleZoomChangeAtPoint(requestedScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [handleZoomChangeAtPoint]);

  useEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) {
      return;
    }

    let secondFrameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        const viewport = scoreViewportRef.current;
        if (viewport) {
          viewport.scrollLeft = Math.max(0, anchor.xRatio * viewport.scrollWidth - anchor.viewportOffsetX);
          viewport.scrollTop = Math.max(0, anchor.yRatio * viewport.scrollHeight - anchor.viewportOffsetY);
          pendingZoomAnchorRef.current = null;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [zoomScale]);

  const schedulePinchZoom = useCallback(({ zoomScale: requestedScale, midpointX, midpointY }: { zoomScale: number; midpointX: number; midpointY: number; }) => {
    pendingPinchUpdateRef.current = { zoomScale: requestedScale, midpointX, midpointY };
    if (pinchFrameRef.current !== null) {
      return;
    }
    pinchFrameRef.current = window.requestAnimationFrame(() => {
      pinchFrameRef.current = null;
      const update = pendingPinchUpdateRef.current;
      pendingPinchUpdateRef.current = null;
      if (!update) {
        return;
      }
      if (Math.abs(update.zoomScale - zoomScaleRef.current) < 0.02) {
        return;
      }
      handleZoomChangeAtPoint(update.zoomScale, update.midpointX, update.midpointY);
    });
  }, [handleZoomChangeAtPoint]);
  

  const resetTouchGestureState = useCallback(() => {
    touchPointersRef.current.clear();
    singleTouchPanRef.current = null;
    pinchSessionRef.current = null;
    suppressTouchUntilReleaseRef.current = false;
    pendingPinchUpdateRef.current = null;
    setIsTwoFingerGestureActive(false);

    if (pinchFrameRef.current !== null) {
      window.cancelAnimationFrame(pinchFrameRef.current);
      pinchFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('blur', resetTouchGestureState);
    const handleVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') {
        resetTouchGestureState();
      }
    };
    window.document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', resetTouchGestureState);
      window.document.removeEventListener('visibilitychange', handleVisibilityChange);
      resetTouchGestureState(); // also reset on unmount
    };
  }, [resetTouchGestureState]);

  const handleScorePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
    if (firstTwo) {
      const [first, second] = firstTwo;
      const distance = getTouchDistance(first, second);
      if (distance < 10) {
        return;
      }
      const midpoint = getTouchMidpoint(first, second);
      pinchSessionRef.current = {
        startDistance: distance,
        startZoomScale: zoomScaleRef.current,
        lastMidpointX: midpoint.x,
        lastMidpointY: midpoint.y,
        latestZoomScale: zoomScaleRef.current,
      };
      
      singleTouchPanRef.current = null;
      suppressTouchUntilReleaseRef.current = true;
      setIsTwoFingerGestureActive(true);
      setTouchGestureSessionId(prev => prev + 1);

      event.preventDefault();
      event.stopPropagation();
      
      for (const pointerId of touchPointersRef.current.keys()) {
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch {}
      }
    } else {
      if (currentTool === 'none' && touchPointersRef.current.size === 1 && !suppressTouchUntilReleaseRef.current) {
        singleTouchPanRef.current = {
          pointerId: event.pointerId,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
      }
    }
  };

  const handleScorePointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    if (touchPointersRef.current.has(event.pointerId)) {
      touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    }
    
    if (touchPointersRef.current.size >= 2 && pinchSessionRef.current) {
      event.preventDefault();
      event.stopPropagation();
      
      const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
      if (firstTwo) {
        const [first, second] = firstTwo;
        const currentDistance = getTouchDistance(first, second);
        const midpoint = getTouchMidpoint(first, second);
        const session = pinchSessionRef.current;
        
        const nextZoomScale = normalizeZoomScale(session.startZoomScale * (currentDistance / session.startDistance));
        
        const midpointDeltaX = midpoint.x - session.lastMidpointX;
        const midpointDeltaY = midpoint.y - session.lastMidpointY;
        
        const viewport = scoreViewportRef.current;
        if (viewport) {
          viewport.scrollLeft -= midpointDeltaX;
          viewport.scrollTop -= midpointDeltaY;
        }
        
        session.lastMidpointX = midpoint.x;
        session.lastMidpointY = midpoint.y;
        session.latestZoomScale = nextZoomScale;
        
        schedulePinchZoom({ zoomScale: nextZoomScale, midpointX: midpoint.x, midpointY: midpoint.y });
      }
    } else if (currentTool === 'none' && singleTouchPanRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      const pan = singleTouchPanRef.current;
      const deltaX = event.clientX - pan.lastClientX;
      const deltaY = event.clientY - pan.lastClientY;
      
      const viewport = scoreViewportRef.current;
      if (viewport) {
        viewport.scrollLeft -= deltaX;
        viewport.scrollTop -= deltaY;
      }
      
      pan.lastClientX = event.clientX;
      pan.lastClientY = event.clientY;
    }
  };

  const handleScorePointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }
    
    touchPointersRef.current.delete(event.pointerId);
    
    if (isTwoFingerGestureActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (touchPointersRef.current.size < 2) {
      const session = pinchSessionRef.current;
      if (session) {
        handleZoomChangeAtPoint(session.latestZoomScale, session.lastMidpointX, session.lastMidpointY);
      }
      pinchSessionRef.current = null;
      setIsTwoFingerGestureActive(false);
    }
    
    if (touchPointersRef.current.size === 0) {
      suppressTouchUntilReleaseRef.current = false;
      singleTouchPanRef.current = null;
    }
    
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {}
  };

  const handleScorePointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    handleScorePointerUpCapture(event);
  };

  const [document, setDocument] = useState<ScoreAnnotationDocument>({
    schemaVersion: 1,
    repertoireId,
    fileId: file?.id || '',
    sourceStoragePath: file?.storagePath || '',
    pages: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const viewport = scoreViewportRef.current;
      if (!viewport) {
        return;
      }
      viewport.scrollTop = 0;
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentPage]);
  
  const [currentTool, setCurrentTool] = useState<ScoreAnnotationTool | 'none'>('none');
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(2); // 1, 2, 3
  const [eraserRadius, setEraserRadius] = useState(18);
  
  const [history, setHistory] = useState<ScoreAnnotationStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const [annotationLoadState, setAnnotationLoadState] = useState<AnnotationLoadState>('loading');
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle');
  const [isClosing, setIsClosing] = useState(false);
  const [annotationRetryToken, setAnnotationRetryToken] = useState(0);

  const isAnnotationReady = annotationLoadState === 'ready';

  const documentRef = useRef<ScoreAnnotationDocument>(document);
  const isDirtyRef = useRef(false);
  const editRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const autoSaveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastQueuedRevisionRef = useRef<number | null>(null);
  const lastQueuedPromiseRef = useRef<Promise<boolean> | null>(null);

  const updateDirtyState = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  const [viewerViewportRect, setViewerViewportRect] = useState<ViewerViewportRect>(() => ({
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  const bottomToolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number | null = null;

    const updateViewportRect = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;

        const nextRect: ViewerViewportRect = viewport
          ? {
              top: viewport.offsetTop,
              left: viewport.offsetLeft,
              width: viewport.width,
              height: viewport.height,
            }
          : {
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            };

        if (nextRect.width < 200 || nextRect.height < 200) {
          frameId = null;
          return;
        }

        setViewerViewportRect(previous => {
          const changed =
            Math.abs(previous.top - nextRect.top) >= 1 ||
            Math.abs(previous.left - nextRect.left) >= 1 ||
            Math.abs(previous.width - nextRect.width) >= 1 ||
            Math.abs(previous.height - nextRect.height) >= 1;

          return changed ? nextRect : previous;
        });

        frameId = null;
      });
    };

    updateViewportRect();

    const visualViewport = window.visualViewport;

    visualViewport?.addEventListener('resize', updateViewportRect);
    visualViewport?.addEventListener('scroll', updateViewportRect);
    window.addEventListener('resize', updateViewportRect);
    window.addEventListener('scroll', updateViewportRect, { passive: true });
    window.addEventListener('orientationchange', updateViewportRect);
    window.addEventListener('pageshow', updateViewportRect);

    return () => {
      visualViewport?.removeEventListener('resize', updateViewportRect);
      visualViewport?.removeEventListener('scroll', updateViewportRect);
      window.removeEventListener('resize', updateViewportRect);
      window.removeEventListener('scroll', updateViewportRect);
      window.removeEventListener('orientationchange', updateViewportRect);
      window.removeEventListener('pageshow', updateViewportRect);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    if (viewerViewportRect.width === 0 || viewerViewportRect.height === 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const toolbar = bottomToolbarRef.current;

      if (!toolbar) {
        return;
      }

      const rect = toolbar.getBoundingClientRect();

      const visibleTop = viewerViewportRect.top;
      const visibleBottom = viewerViewportRect.top + viewerViewportRect.height;

      const isVisible =
        rect.top >= visibleTop - 2 &&
        rect.bottom <= visibleBottom + 2 &&
        rect.height > 0;

      console.info('[Mio Score Viewer Layout]', {
        event: 'bottom-toolbar-visibility',
        viewportTop: Math.round(viewerViewportRect.top),
        viewportBottom: Math.round(visibleBottom),
        viewportHeight: Math.round(viewerViewportRect.height),
        toolbarTop: Math.round(rect.top),
        toolbarBottom: Math.round(rect.bottom),
        toolbarHeight: Math.round(rect.height),
        isVisible,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [viewerViewportRect, currentTool]);

  // Load annotations
  useEffect(() => {
    if (!user || !file?.id) {
      return;
    }

    let cancelled = false;

    const loadAnnotations = async () => {
      setAnnotationLoadState('loading');
      setAutoSaveState('idle');

      try {
        const loadedDocument = await loadScoreAnnotations(
          user.uid,
          repertoireId,
          file.id,
        );

        if (cancelled) {
          return;
        }

        const now = new Date().toISOString();
        const nextDocument: ScoreAnnotationDocument = loadedDocument ?? {
          schemaVersion: 1,
          repertoireId,
          fileId: file.id,
          sourceStoragePath: file.storagePath,
          pages: {},
          createdAt: now,
          updatedAt: now,
        };

        documentRef.current = nextDocument;
        setDocument(nextDocument);
        editRevisionRef.current = 0;
        savedRevisionRef.current = 0;
        updateDirtyState(false);
        setAnnotationLoadState('ready');
        setAutoSaveState('idle');
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('[Mio Annotation Load]', {
          event: 'load-failed',
          error,
        });

        setCurrentTool('none');
        setAnnotationLoadState('error');
        setAutoSaveState('error');
      }
    };

    void loadAnnotations();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    repertoireId,
    file?.id,
    file?.storagePath,
    annotationRetryToken,
    updateDirtyState,
  ]);

  const currentPageStrokes = document.pages[currentPage]?.strokes || [];

  const updateDocumentStrokes = useCallback((strokes: ScoreAnnotationStroke[]) => {
    const now = new Date().toISOString();
    const nextDocument: ScoreAnnotationDocument = {
      ...documentRef.current,
      updatedAt: now,
      pages: {
        ...documentRef.current.pages,
        [currentPage]: {
          pageNumber: currentPage,
          strokes,
        },
      },
    };

    documentRef.current = nextDocument;
    setDocument(nextDocument);
    editRevisionRef.current += 1;
    updateDirtyState(true);
    setAutoSaveState('pending');
  }, [currentPage, updateDirtyState]);

  // Update history when strokes change from user input (not from undo/redo)
  const handleStrokesChange = (newStrokes: ScoreAnnotationStroke[]) => {
    const historyBeforeChange =
      history.length === 0
        ? [currentPageStrokes]
        : history.slice(0, historyIndex + 1);

    const newHistory = [...historyBeforeChange, newStrokes];

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    updateDocumentStrokes(newStrokes);
  };

  const handleToolToggle = (tool: ScoreAnnotationTool) => {
    setCurrentTool(previous => (previous === tool ? 'none' : tool));
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    updateDocumentStrokes(history[newIndex]);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateDocumentStrokes(history[newIndex]);
    }
  };

  // When changing pages, reset history for simplicity, 
  // or we could maintain a history per page. We'll reset for simplicity.
  const changePage = (delta: number) => {
    const newPage = Math.max(1, Math.min(pageCount, currentPage + delta));
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      setHistory([]);
      setHistoryIndex(-1);
    }
  };

  const queueAnnotationSave = useCallback(
    (
      snapshot: ScoreAnnotationDocument,
      revision: number,
      reason: string,
    ): Promise<boolean> => {
      if (!user || annotationLoadState !== 'ready') {
        return Promise.resolve(false);
      }

      if (savedRevisionRef.current >= revision) {
        return Promise.resolve(true);
      }

      if (lastQueuedRevisionRef.current === revision && lastQueuedPromiseRef.current) {
        return lastQueuedPromiseRef.current;
      }

      setAutoSaveState('saving');

      const saveTask = saveQueueRef.current
        .catch(() => {
          return;
        })
        .then(async () => {
          await saveScoreAnnotations(
            user.uid,
            repertoireId,
            file.id,
            snapshot,
          );

          savedRevisionRef.current = Math.max(
            savedRevisionRef.current,
            revision,
          );

          if (editRevisionRef.current === revision) {
            updateDirtyState(false);
            setAutoSaveState('saved');
          } else {
            setAutoSaveState('pending');
          }

          console.info('[Mio Annotation Save]', {
            event: 'save-success',
            reason,
            revision,
          });

          return true;
        })
        .catch(error => {
          console.error('[Mio Annotation Save]', {
            event: 'save-failed',
            reason,
            revision,
            error,
          });

          if (editRevisionRef.current === revision) {
            updateDirtyState(true);
            setAutoSaveState('error');
          }

          return false;
        });

      saveQueueRef.current = saveTask.then(() => {
        return;
      });

      lastQueuedRevisionRef.current = revision;
      lastQueuedPromiseRef.current = saveTask;

      void saveTask.then(() => {
        if (lastQueuedPromiseRef.current === saveTask) {
          lastQueuedPromiseRef.current = null;
          lastQueuedRevisionRef.current = null;
        }
      });

      return saveTask;
    },
    [user, annotationLoadState, repertoireId, file.id, updateDirtyState],
  );

  useEffect(() => {
    if (annotationLoadState !== 'ready' || !user || !isDirty) {
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void queueAnnotationSave(
        documentRef.current,
        editRevisionRef.current,
        'debounce',
      );
    }, 800);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [document, isDirty, user, annotationLoadState, queueAnnotationSave]);

  const flushLatestAnnotations = useCallback(
    async (reason: string): Promise<boolean> => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      if (!isDirtyRef.current) {
        return true;
      }

      return queueAnnotationSave(
        documentRef.current,
        editRevisionRef.current,
        reason,
      );
    },
    [queueAnnotationSave],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') {
        void flushLatestAnnotations('visibility-hidden');
      }
    };

    const handlePageHide = () => {
      void flushLatestAnnotations('pagehide');
    };

    const handleOnline = () => {
      if (isDirtyRef.current) {
        void flushLatestAnnotations('network-online');
      }
    };

    window.document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleOnline);

    return () => {
      window.document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('online', handleOnline);
    };
  }, [flushLatestAnnotations]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleShareVariant = async (variant: ScoreShareVariant) => {
    if (!user || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      if (variant === 'original') {
        const originalBlob = await loadOriginalScoreBlob(file.storagePath);
        await shareOrDownloadScore({
          blob: originalBlob,
          fileName: file.fileName || '악보.pdf',
          contentType: file.contentType || originalBlob.type || 'application/pdf',
        });
      } else {
        const annotatedBlob = await createAnnotatedPdf(file.storagePath, documentRef.current);
        const annotatedFileName = `${(file.fileName || '악보.pdf').replace(/\.pdf$/i, '')} - 필기 포함.pdf`;

        await shareOrDownloadScore({
          blob: annotatedBlob,
          fileName: annotatedFileName,
          contentType: 'application/pdf',
        });
      }

      setIsShareMenuOpen(false);
    } catch (error) {
      console.error('[Mio Score Share]', {
        event: 'score-share-failed',
        variant,
        repertoireId,
        fileId: file.id,
        error,
      });

      alert(
        variant === 'original'
          ? '원본 악보를 공유하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
          : '필기 포함 악보를 공유하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = useCallback(async () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);

    const saved = await flushLatestAnnotations('viewer-close');

    if (!saved && isDirtyRef.current) {
      const closeAnyway = window.confirm(
        '필기를 자동 저장하지 못했습니다.\n저장하지 않고 악보 뷰어를 닫으시겠습니까?',
      );

      if (!closeAnyway) {
        setIsClosing(false);
        return;
      }
    }

    onClose();
  }, [isClosing, flushLatestAnnotations, onClose]);

  if (!file || !file.storagePath) {
    return (
      <div 
        className="fixed z-50 isolate overflow-hidden bg-stone-900 grid grid-rows-[auto_minmax(0,1fr)_auto]"
        style={{
          top: `${viewerViewportRect.top}px`,
          left: `${viewerViewportRect.left}px`,
          width: `${viewerViewportRect.width}px`,
          height: `${viewerViewportRect.height}px`,
          maxWidth: `${viewerViewportRect.width}px`,
          maxHeight: `${viewerViewportRect.height}px`,
        }}
      >
        <div className="relative z-40 h-14 bg-stone-800 border-b border-white/10 flex items-center px-4 shrink-0 safe-top">
          <button onClick={handleClose} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X size={24} />
          </button>
          <span className="text-white font-medium ml-2">오류</span>
        </div>
        <div className="relative z-0 flex items-center justify-center p-8 text-stone-400">
          <p>PDF 파일 경로를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }


  return (
    <div
      ref={viewerViewportRef}
      data-score-viewer-container
      className="fixed inset-0 z-50 flex flex-col bg-stone-900 pointer-events-auto select-none"

      style={{
        top: `${viewerViewportRect.top}px`,
        left: `${viewerViewportRect.left}px`,
        width: `${viewerViewportRect.width}px`,
        height: `${viewerViewportRect.height}px`,
        maxWidth: `${viewerViewportRect.width}px`,
        maxHeight: `${viewerViewportRect.height}px`,
      }}
    >
      {/* Top Bar */}
      <div className="relative z-40 h-12 md:h-14 bg-stone-800 border-b border-white/10 flex items-center justify-between px-2 md:px-4 shrink-0 min-w-0 safe-top pointer-events-auto">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button type="button" data-score-viewer-close onClick={handleClose} disabled={isClosing} className="p-1.5 md:p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0 disabled:opacity-30">
            <X size={24} />
          </button>
          <span className="text-white font-medium truncate min-w-0">{file.fileName}</span>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <div
            aria-live="polite"
            className="
              min-w-0
              shrink
              text-[11px]
              md:text-xs
              text-stone-400
              truncate
            "
          >
            {isClosing && '저장 후 닫는 중…'}
            {!isClosing && annotationLoadState === 'loading' && '필기 불러오는 중…'}
            {!isClosing && annotationLoadState === 'error' && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate">필기를 불러오지 못했습니다.</span>
                <button
                  type="button"
                  onClick={() => {
                    setAnnotationRetryToken(previous => previous + 1);
                  }}
                  className="shrink-0 text-brand hover:text-brand-light underline"
                >
                  다시 시도
                </button>
              </div>
            )}
            {!isClosing && isAnnotationReady && autoSaveState === 'pending' && '자동 저장 대기 중…'}
            {!isClosing && isAnnotationReady && autoSaveState === 'saving' && '자동 저장 중…'}
            {!isClosing && isAnnotationReady && autoSaveState === 'saved' && '자동 저장됨'}
            {!isClosing && isAnnotationReady && autoSaveState === 'error' && '자동 저장 실패'}
          </div>
          {user && (
            <>
              <button 
                type="button"
                onClick={() => {
                  if (isSharing) {
                    return;
                  }
                  setIsShareMenuOpen(true);
                }}
                disabled={isSharing || isClosing || !isAnnotationReady}
                title="공유"
                aria-label="공유"
                className="flex items-center gap-1 p-2 md:px-3 md:py-1.5 bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                <Share size={18} className="md:w-4 md:h-4" />
                <span className="hidden md:inline">{isSharing ? '공유 준비 중…' : '공유'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        ref={scoreViewportRef}
        data-score-viewer-viewport
        onPointerDownCapture={handleScorePointerDownCapture}
        onPointerMoveCapture={handleScorePointerMoveCapture}
        onPointerUpCapture={handleScorePointerUpCapture}
        onPointerCancelCapture={handleScorePointerCancelCapture}
        className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch] pointer-events-auto select-none"
        style={{
          touchAction: 'none',
        }}
      >
        <PdfPageCanvas
          storagePath={file.storagePath}
          pageNumber={currentPage}
          onPageCountChange={setPageCount}
          strokes={currentPageStrokes}
          onStrokesChange={handleStrokesChange}
          currentTool={isAnnotationReady ? currentTool : 'none'}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          eraserRadius={eraserRadius}
          onDirtyChange={updateDirtyState}
          onPreviousPage={() => {
            changePage(-1);
          }}
          onNextPage={() => {
            changePage(1);
          }}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < pageCount}
          zoomScale={zoomScale}
        />
      </div>

      {/* Bottom Toolbar */}
      <div 
        ref={bottomToolbarRef}
        data-score-viewer-bottom-toolbar
        className="relative z-40 shrink-0 min-w-0 w-full max-w-full min-h-[3.5rem] max-h-[45svh] overflow-x-hidden overflow-y-auto overscroll-contain bg-stone-800 border-t border-white/10 pt-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-auto md:p-4 md:max-h-none md:overflow-visible"
      >
        <div className="w-full max-w-4xl mx-auto min-w-0 flex flex-col gap-2 md:gap-4">
          
          {/* First Line: Basic Controls */}
          <div 
            data-score-viewer-primary-toolbar
            className="relative z-10 shrink-0 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar w-full bg-stone-800 pb-1 md:pb-0"
          >
            
            {/* Page Navigation & Zoom */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-stone-900 rounded-lg p-1">
                <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="이전 페이지" aria-label="이전 페이지">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-stone-300 text-sm min-w-[3rem] whitespace-nowrap text-center">{currentPage} / {pageCount}</span>
                <button onClick={() => changePage(1)} disabled={currentPage >= pageCount} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="다음 페이지" aria-label="다음 페이지">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 p-1">
                <button
                  type="button"
                  onClick={() => {
                    handleZoomChange(zoomScale - ZOOM_SCALE_STEP);
                  }}
                  disabled={zoomScale <= MIN_ZOOM_SCALE}
                  title="축소"
                  aria-label="악보 축소"
                  className="flex h-8 w-8 items-center justify-center rounded text-stone-300 hover:bg-stone-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <ZoomOut size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleZoomChange(MIN_ZOOM_SCALE);
                  }}
                  title="100%로 초기화"
                  aria-label={`현재 확대율 ${Math.round(zoomScale * 100)}%. 100%로 초기화`}
                  className="min-w-[52px] rounded px-1.5 py-1 text-center text-xs font-medium text-stone-200 hover:bg-stone-700"
                >
                  {Math.round(zoomScale * 100)}%
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleZoomChange(zoomScale + ZOOM_SCALE_STEP);
                  }}
                  disabled={zoomScale >= MAX_ZOOM_SCALE}
                  title="확대"
                  aria-label="악보 확대"
                  className="flex h-8 w-8 items-center justify-center rounded text-stone-300 hover:bg-stone-700 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <ZoomIn size={17} />
                </button>
              </div>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center justify-center gap-1 shrink-0">
              <ToolButton active={currentTool === 'pen'} disabled={!isAnnotationReady} onClick={() => handleToolToggle('pen')} icon={<Pen size={20} />} title={currentTool === 'pen' ? '펜 취소' : '펜'} />
              <ToolButton active={currentTool === 'highlighter'} disabled={!isAnnotationReady} onClick={() => handleToolToggle('highlighter')} icon={<Highlighter size={20} />} title={currentTool === 'highlighter' ? '형광펜 취소' : '형광펜'} />
              <ToolButton active={currentTool === 'eraser'} disabled={!isAnnotationReady} onClick={() => handleToolToggle('eraser')} icon={<Eraser size={20} />} title={currentTool === 'eraser' ? '지우개 취소' : '지우개'} />

            </div>
          </div>

          {/* Second Line: Properties */}
          {currentTool !== 'none' && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 w-full min-w-0 pb-1">
              <div className="min-w-0 overflow-x-auto overscroll-x-contain no-scrollbar">
                <div className="flex items-center gap-3 w-max justify-start">
                  {currentTool !== 'eraser' && (
                    <>
                      <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">
                        {['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#000000', '#ffffff'].map(color => {
                          const isSelected = strokeColor === color;
                          return (
                            <button 
                              key={color}
                              type="button"
                              onClick={() => setStrokeColor(color)}
                              aria-pressed={isSelected}
                              title={isSelected ? '현재 선택된 색상' : '색상 변경'}
                              aria-label={isSelected ? `현재 선택된 색상 ${color}` : `색상 ${color}`}
                              className={`relative w-7 h-7 md:w-6 md:h-6 shrink-0 rounded-full border-2 box-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-stone-900 ${
                                isSelected
                                  ? 'border-white ring-2 ring-white/90 ring-offset-1 ring-offset-stone-900'
                                  : 'border-stone-600 hover:border-stone-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          );
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">
                        {[1, 2, 3].map(w => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setStrokeWidth(w)}
                            className={`w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded ${strokeWidth === w ? 'bg-stone-700 text-brand' : 'text-stone-400 hover:text-white'}`}
                            title={`굵기 ${w}`}
                            aria-label={`굵기 ${w}`}
                          >
                            <div className="bg-current rounded-full" style={{ width: w * 2 + 2, height: w * 2 + 2 }} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {currentTool === 'eraser' && (
                    <div className="flex items-center gap-2 shrink-0" role="group" aria-label="지우개 크기">
                      <span className="shrink-0 text-xs text-stone-400 px-1">지우개 크기</span>
                      {ERASER_RADIUS_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          title={`지우개 ${option.label}`}
                          aria-label={`지우개 크기 ${option.label}`}
                          aria-pressed={eraserRadius === option.value}
                          onClick={() => setEraserRadius(option.value)}
                          className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${eraserRadius === option.value ? 'bg-brand/20 text-brand ring-1 ring-brand/50' : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-700'}`}
                        >
                          <span className="block rounded-full border-2 border-current bg-current/10" style={{ width: `${option.previewSize}px`, height: `${option.previewSize}px` }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-stone-900 p-1">
                <button type="button" onClick={handleUndo} disabled={!isAnnotationReady || historyIndex <= 0} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none" title="실행 취소" aria-label="실행 취소"><Undo size={20} /></button>
                <button type="button" onClick={handleRedo} disabled={!isAnnotationReady || historyIndex >= history.length - 1} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none" title="다시 실행" aria-label="다시 실행"><Redo size={20} /></button>
                <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>
                <button
                  type="button"
                  onClick={() => setCurrentTool('none')}
                  title="필기 도구 닫기"
                  aria-label="현재 필기 도구를 취소하고 보기 상태로 전환"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-stone-300 hover:bg-stone-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>


      {isShareMenuOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-share-dialog-title"
          onClick={() => {
            if (!isSharing) {
              setIsShareMenuOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-5 shadow-2xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2 id="score-share-dialog-title" className="text-lg font-medium text-white mb-1">
              악보 공유
            </h2>
            <p className="text-sm text-stone-400 mb-6">공유할 악보 종류를 선택하세요.</p>
            
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={isSharing}
                onClick={() => handleShareVariant('original')}
                className="w-full text-left p-3 rounded-lg border border-stone-700 hover:border-brand/50 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="font-medium text-white mb-0.5">원본 악보</div>
                <div className="text-xs text-stone-400">필기가 포함되지 않은 원본 파일</div>
              </button>
              
              <button
                type="button"
                disabled={isSharing}
                onClick={() => handleShareVariant('annotated')}
                className="w-full text-left p-3 rounded-lg border border-brand/30 hover:border-brand/70 bg-brand/10 hover:bg-brand/20 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="font-medium text-brand-light mb-0.5">필기 포함 악보</div>
                <div className="text-xs text-brand-light/70">현재 작성한 필기가 포함된 PDF</div>
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={isSharing}
                onClick={() => setIsShareMenuOpen(false)}
                className="px-4 py-2 text-sm font-medium text-stone-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, icon, title, disabled }: { active: boolean, onClick: () => void, icon: React.ReactNode, title: string, disabled?: boolean }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={title}
      aria-label={title}
      className={`p-1.5 md:p-2 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${active ? 'bg-brand/20 text-brand' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
    >
      <div className="w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
    </button>
  );
}
