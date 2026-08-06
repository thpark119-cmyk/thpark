import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdminUser } from '../../../utils/admin';
import { PdfRenderEngineV2 } from './PdfRenderEngineV2';
import { PageSurfaceV2 } from './PageSurfaceV2';
import { PageSurfaceSwapInfoV2, PageSurfaceFrontInfoV2, PageSurfaceRenderEventV2 } from './pageSurfaceTypes';
import { StableGestureViewportV2 } from './StableGestureViewportV2';
import { StablePageBaselineV2, StableGestureTransformEventV2, StableGestureViewportV2Handle } from './stableGestureTypes';
import type { RenderBudgetPreviewV2 } from './renderBudgetV2';
import { PdfRenderEngineErrorV2 } from './pdfRenderTypes';
import { AnnotationSurfaceV2 } from './AnnotationSurfaceV2';
import type { 
  AnnotationPageSpaceV2, 
  AnnotationInteractionModeV2, 
  AnnotationCompletedStrokeV2, 
  AnnotationStrokeDraftV2, 
  AnnotationInputStatusV2, 
  AnnotationEraseRequestV2,
  AnnotationStrokeToolV2,
  AnnotationStrokeStyleV2
} from './annotationTypesV2';
import { ANNOTATION_DEFAULT_PEN_STYLE_V2 } from './annotationTypesV2';
import {
  calculateRenderBudgetPreviewV2,
  V2_MAX_CANVAS_PIXELS,
  V2_MAX_CANVAS_EDGE
} from './renderBudgetV2';
import {
  AnnotationHistoryStateV2,
  createEmptyHistoryV2,
  addStrokeToHistoryV2,
  eraseStrokeFromHistoryV2,
  undoPageHistoryV2,
  redoPageHistoryV2,
  getPageHistoryDepthV2
} from './annotationHistoryV2';

interface RenderErrorDiagnosticV2 {
  code: string;
  message: string;
}

const PDF_CSS_SCALE = 1;
const DEFAULT_OUTPUT_SCALE = 2;
const DETAIL_OUTPUT_SCALE = 3;
const DETAIL_PREVIEW_SCALE_THRESHOLD = 1.5;

function formatMiB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function resolveOutputScaleForPreviewScale(previewScale: number): number {
  return previewScale >= DETAIL_PREVIEW_SCALE_THRESHOLD
    ? DETAIL_OUTPUT_SCALE
    : DEFAULT_OUTPUT_SCALE;
}

interface PenColorPresetV2 {
  label: string;
  color: string;
}

const PEN_COLOR_PRESETS_V2: readonly PenColorPresetV2[] = [
  { label: '검정', color: '#111827' },
  { label: '빨강', color: '#ef4444' },
  { label: '파랑', color: '#2563eb' },
  { label: '초록', color: '#16a34a' }
];

interface PenWidthPresetV2 {
  label: string;
  width: number;
}

const PEN_WIDTH_PRESETS_V2: readonly PenWidthPresetV2[] = [
  { label: '얇게', width: 2 },
  { label: '보통', width: 3 },
  { label: '굵게', width: 5 }
];

const ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2: AnnotationStrokeStyleV2 = {
  color: '#fde047',
  width: 14,
  opacity: 0.35
};

interface HighlighterColorPresetV2 {
  label: string;
  color: string;
}

const HIGHLIGHTER_COLOR_PRESETS_V2: readonly HighlighterColorPresetV2[] = [
  { label: '노랑', color: '#fde047' },
  { label: '초록', color: '#4ade80' },
  { label: '분홍', color: '#f472b6' },
  { label: '파랑', color: '#60a5fa' }
];

interface HighlighterWidthPresetV2 {
  label: string;
  width: number;
}

const HIGHLIGHTER_WIDTH_PRESETS_V2: readonly HighlighterWidthPresetV2[] = [
  { label: '얇게', width: 10 },
  { label: '보통', width: 14 },
  { label: '굵게', width: 18 }
];

export default function V2GestureBaselineLab() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const engineRef = useRef<PdfRenderEngineV2 | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [docName, setDocName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const documentInstanceIdRef = useRef(0);
  
  const [stats, setStats] = useState({
    completed: 0,
    swaps: 0,
    errors: 0,
    cancelled: 0,
    stale: 0
  });

  const [lastRenderResult, setLastRenderResult] = useState<PageSurfaceRenderEventV2['result'] | null>(null);
  const [lastRenderError, setLastRenderError] = useState<RenderErrorDiagnosticV2 | null>(null);

  const [frontInfo, setFrontInfo] = useState<PageSurfaceFrontInfoV2 | null>(null);
  const baselineMapRef = useRef(new Map<string, StablePageBaselineV2>());
  const [currentBaseline, setCurrentBaseline] = useState<StablePageBaselineV2 | null>(null);
  
  const [pageNumber, setPageNumber] = useState(1);
  const targetPageRef = useRef(1);
  
  const [targetOutputScale, setTargetOutputScale] = useState(DEFAULT_OUTPUT_SCALE);
  const [renderFailed, setRenderFailed] = useState(false);
  
  const viewportRef = useRef<StableGestureViewportV2Handle>(null);
  const [transformInfo, setTransformInfo] = useState<StableGestureTransformEventV2 | null>(null);

  const [interactionMode, setInteractionMode] = useState<AnnotationInteractionModeV2>('navigate');
  const [activeDrawingTool, setActiveDrawingTool] = useState<AnnotationStrokeToolV2>('pen');
  const [activePenStyle, setActivePenStyle] = useState<AnnotationStrokeStyleV2>(() => ({
    color: ANNOTATION_DEFAULT_PEN_STYLE_V2.color,
    width: ANNOTATION_DEFAULT_PEN_STYLE_V2.width,
    opacity: ANNOTATION_DEFAULT_PEN_STYLE_V2.opacity
  }));
  const [activeHighlighterStyle, setActiveHighlighterStyle] = useState<AnnotationStrokeStyleV2>(() => ({
    color: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.color,
    width: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.width,
    opacity: ANNOTATION_DEFAULT_HIGHLIGHTER_STYLE_V2.opacity
  }));
  const [annotationHistory, setAnnotationHistory] = useState<AnnotationHistoryStateV2>(createEmptyHistoryV2);
  const strokeIdCounterRef = useRef(1);
  const [inputStatus, setInputStatus] = useState<AnnotationInputStatusV2>({
    phase: 'idle',
    activePointerId: null,
    activePointerType: null,
    currentPointCount: 0,
    touchSuppressedUntilRelease: false
  });
  
  const activeDrawingStyle = activeDrawingTool === 'highlighter' ? activeHighlighterStyle : activePenStyle;

  useEffect(() => {
    mountedRef.current = true;
    if (isAdmin) {
      engineRef.current = new PdfRenderEngineV2();
    }
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
      if (engineRef.current) {
        engineRef.current.destroy().catch(console.error);
        engineRef.current = null;
      }
    };
  }, [isAdmin]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    
    if (!file || !engineRef.current) return;

    if (viewportRef.current) {
      viewportRef.current.resetTransform();
    }

    setDocReady(false);
    setErrorMessage('');
    setDocName(file.name);
    setPageNumber(1);
    targetPageRef.current = 1;
    setTargetOutputScale(DEFAULT_OUTPUT_SCALE);
    setRenderFailed(false);
    baselineMapRef.current.clear();
    setFrontInfo(null);
    setCurrentBaseline(null);
    setTransformInfo(null);
    setInteractionMode('navigate');
    setAnnotationHistory(createEmptyHistoryV2());
    strokeIdCounterRef.current = 1;
    setInputStatus({ phase: 'idle', activePointerId: null, activePointerType: null, currentPointCount: 0, touchSuppressedUntilRelease: false });
    setStats({ completed: 0, swaps: 0, errors: 0, cancelled: 0, stale: 0 });
    setLastRenderResult(null);
    setLastRenderError(null);
    setIsLoading(true);

    const currentLoadSeq = ++loadSequenceRef.current;

    try {
      const buffer = await file.arrayBuffer();
      if (!mountedRef.current || currentLoadSeq !== loadSequenceRef.current) return;
      
      const bytes = new Uint8Array(buffer);
      const engine = engineRef.current;
      const result = await engine.loadDocument(bytes);
      
      if (!mountedRef.current || currentLoadSeq !== loadSequenceRef.current) return;
      if (result.status !== 'loaded') return;
      
      documentInstanceIdRef.current += 1;
      setNumPages(result.numPages);
      setDocReady(true);
    } catch (err) {
      if (mountedRef.current && currentLoadSeq === loadSequenceRef.current) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current && currentLoadSeq === loadSequenceRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    setStats(prev => ({ ...prev, swaps: prev.swaps + 1 }));
    setFrontInfo(info.nextFront);
    setRenderFailed(false);
    
    if (
      info.nextFront.cssScale === 1 &&
      info.nextFront.pageNumber === targetPageRef.current &&
      info.nextFront.cssWidth > 0 &&
      info.nextFront.cssHeight > 0
    ) {
      const key = `${documentInstanceIdRef.current}:${info.nextFront.pageNumber}`;
      if (!baselineMapRef.current.has(key)) {
        baselineMapRef.current.set(key, {
          documentInstanceId: documentInstanceIdRef.current,
          pageNumber: info.nextFront.pageNumber,
          logicalWidth: info.nextFront.cssWidth,
          logicalHeight: info.nextFront.cssHeight
        });
      }
      setCurrentBaseline(baselineMapRef.current.get(key) || null);
    }
  }, []);

  const handleRenderEvent = useCallback((ev: PageSurfaceRenderEventV2) => {
    setLastRenderResult(ev.result);
    if (ev.result.status === 'completed') {
      setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
    } else if (ev.result.status === 'cancelled') {
      setStats(prev => ({ ...prev, cancelled: prev.cancelled + 1 }));
    } else if (ev.result.status === 'stale') {
      setStats(prev => ({ ...prev, stale: prev.stale + 1 }));
    }
  }, []);

  const handleRenderError = useCallback((err: unknown) => {
    if (err instanceof PdfRenderEngineErrorV2) {
      setLastRenderError({ code: err.code, message: err.message });
    } else if (err instanceof Error) {
      setLastRenderError({ code: 'UNKNOWN_ERROR', message: err.message });
    } else {
      setLastRenderError({ code: 'UNKNOWN_ERROR', message: String(err) });
    }
    setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    setRenderFailed(true);
    
    if (
      frontInfo &&
      engineRef.current &&
      frontInfo.generation === engineRef.current.generation &&
      frontInfo.pageNumber === targetPageRef.current &&
      frontInfo.cssScale === PDF_CSS_SCALE &&
      (frontInfo.outputScale === DEFAULT_OUTPUT_SCALE || frontInfo.outputScale === DETAIL_OUTPUT_SCALE)
    ) {
      setTargetOutputScale(frontInfo.outputScale);
    }
  }, [frontInfo]);

  const handleTransformChange = useCallback((ev: StableGestureTransformEventV2) => {
    setTransformInfo(ev);
  }, []);

  const handleStrokeComplete = useCallback((draft: AnnotationStrokeDraftV2) => {
    if (draft.documentInstanceId !== documentInstanceIdRef.current || draft.pageNumber !== targetPageRef.current) {
      return;
    }
    if (draft.points.length === 0) return;

    const strokeId = `stroke-${strokeIdCounterRef.current++}`;
    setAnnotationHistory(prev => addStrokeToHistoryV2(prev, {
      id: strokeId,
      documentInstanceId: draft.documentInstanceId,
      pageNumber: draft.pageNumber,
      tool: draft.tool,
      style: {
        color: draft.style.color,
        width: draft.style.width,
        opacity: draft.style.opacity
      },
      pointerType: draft.pointerType,
      points: draft.points
    }));
  }, []);

  const handleEraseRequest = useCallback((request: AnnotationEraseRequestV2) => {
    if (request.documentInstanceId !== documentInstanceIdRef.current || request.pageNumber !== targetPageRef.current) {
      return;
    }
    if (request.strokeIds.length === 0) return;

    setAnnotationHistory(prev => {
      let next = prev;
      for (const id of request.strokeIds) {
        next = eraseStrokeFromHistoryV2(next, id);
      }
      return next;
    });
  }, []);

  const handleInputStatusChange = useCallback((status: AnnotationInputStatusV2) => {
    setInputStatus(status);
  }, []);

  const handleUndo = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;
    
    setAnnotationHistory(prev => 
      undoPageHistoryV2(prev, documentInstanceIdRef.current, pageNumber)
    );
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const handleRedo = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;
    
    setAnnotationHistory(prev => 
      redoPageHistoryV2(prev, documentInstanceIdRef.current, pageNumber)
    );
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const handleEraseLatest = useCallback(() => {
    const activeGesture = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
    if (!docReady || !currentBaseline || activeGesture || inputStatus.phase !== 'idle') return;

    setAnnotationHistory(prev => {
      const pageStrokes = prev.completedStrokes.filter(s => s.documentInstanceId === documentInstanceIdRef.current && s.pageNumber === pageNumber);
      if (pageStrokes.length === 0) return prev;
      const lastStroke = pageStrokes[pageStrokes.length - 1];
      return eraseStrokeFromHistoryV2(prev, lastStroke.id);
    });
  }, [docReady, currentBaseline, transformInfo, inputStatus.phase, pageNumber]);

  const setNavigateMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setInteractionMode('navigate');
  };

  const setPenMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setActiveDrawingTool('pen');
    setInteractionMode('pen');
  };

  const setHighlighterMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setActiveDrawingTool('highlighter');
    setInteractionMode('pen');
  };

  const setEraserMode = () => {
    if (viewportRef.current) viewportRef.current.cancelActiveGesture();
    setInteractionMode('eraser');
  };

  const applyResolutionIntent = useCallback((previewScale: number) => {
    const nextOutputScale = resolveOutputScaleForPreviewScale(previewScale);
    if (nextOutputScale === targetOutputScale) {
      return;
    }
    setRenderFailed(false);
    setTargetOutputScale(nextOutputScale);
  }, [targetOutputScale]);

  const handleGestureEnd = useCallback(
    (ev: StableGestureTransformEventV2) => {
      applyResolutionIntent(ev.transform.scale);
    },
    [applyResolutionIntent]
  );

  const handleZoomIn = () => {
    if (!viewportRef.current) return;
    const current = viewportRef.current.getTransform().scale;
    viewportRef.current.setScale(current + 0.25);
    const finalScale = viewportRef.current.getTransform().scale;
    applyResolutionIntent(finalScale);
  };

  const handleZoomOut = () => {
    if (!viewportRef.current) return;
    const current = viewportRef.current.getTransform().scale;
    viewportRef.current.setScale(current - 0.25);
    const finalScale = viewportRef.current.getTransform().scale;
    applyResolutionIntent(finalScale);
  };

  const handleZoomReset = () => {
    if (!viewportRef.current) return;
    viewportRef.current.resetTransform();
    applyResolutionIntent(1);
  };

  const handlePrevPage = () => {
    if (pageNumber > 1) {
      const next = pageNumber - 1;
      targetPageRef.current = next;
      if (viewportRef.current) viewportRef.current.resetTransform();
      applyResolutionIntent(1);
      setRenderFailed(false);
      setPageNumber(next);
    }
  };

  const handleNextPage = () => {
    if (pageNumber < numPages) {
      const next = pageNumber + 1;
      targetPageRef.current = next;
      if (viewportRef.current) viewportRef.current.resetTransform();
      applyResolutionIntent(1);
      setRenderFailed(false);
      setPageNumber(next);
    }
  };

  if (!isAdmin) {
    return <div className="p-10 text-stone-400">Admin access required</div>;
  }

  const currentScale = transformInfo?.transform.scale ?? 1;
  const isMinScale = currentScale - 1 <= 0.0005;
  const isMaxScale = 3 - currentScale <= 0.0005;

  let budgetPreview: RenderBudgetPreviewV2 | null = null;
  if (
    currentBaseline &&
    currentBaseline.documentInstanceId === documentInstanceIdRef.current &&
    currentBaseline.pageNumber === pageNumber &&
    currentBaseline.logicalWidth > 0 &&
    currentBaseline.logicalHeight > 0
  ) {
    budgetPreview = calculateRenderBudgetPreviewV2({
      cssWidth: currentBaseline.logicalWidth,
      cssHeight: currentBaseline.logicalHeight,
      requestedOutputScale: targetOutputScale
    });
  }

  const effectiveOutputScale = budgetPreview?.effectiveOutputScale ?? DEFAULT_OUTPUT_SCALE;
  const isOutputScaleLimited = budgetPreview !== null && budgetPreview.effectiveOutputScale < budgetPreview.requestedOutputScale - 0.0005;

  const annotationPageSpace: AnnotationPageSpaceV2 | null =
    currentBaseline &&
    currentBaseline.documentInstanceId === documentInstanceIdRef.current &&
    currentBaseline.pageNumber === pageNumber &&
    currentBaseline.logicalWidth > 0 &&
    currentBaseline.logicalHeight > 0
      ? {
          documentInstanceId: currentBaseline.documentInstanceId,
          pageNumber: currentBaseline.pageNumber,
          logicalWidth: currentBaseline.logicalWidth,
          logicalHeight: currentBaseline.logicalHeight
        }
      : null;

  const isQualityReady = frontInfo && frontInfo.pageNumber === pageNumber && frontInfo.outputScale === effectiveOutputScale;

  const isGestureActive = (transformInfo?.activePointerCount ?? 0) > 0 || (transformInfo?.phase && transformInfo.phase !== 'idle');
  
  const currentPageStrokes = React.useMemo(() => {
    return annotationHistory.completedStrokes.filter(s => s.documentInstanceId === documentInstanceIdRef.current && s.pageNumber === pageNumber);
  }, [annotationHistory.completedStrokes, pageNumber]);

  const { undoDepth, redoDepth } = getPageHistoryDepthV2(annotationHistory, documentInstanceIdRef.current, pageNumber);

  const totalPoints = currentPageStrokes.reduce((acc, s) => acc + s.points.length, 0);

  let qualityStatus = 'RENDERING';
  if (renderFailed) {
    qualityStatus = frontInfo ? 'FAILED_FRONT_PRESERVED' : 'FAILED';
  } else if (isQualityReady) {
    qualityStatus = 'READY';
  }

  const modeControlsDisabled = !docReady || !annotationPageSpace || Boolean(isGestureActive) || inputStatus.phase !== 'idle';
  const penStyleControlsDisabled = modeControlsDisabled || activeDrawingTool !== 'pen';
  const highlighterStyleControlsDisabled = modeControlsDisabled || activeDrawingTool !== 'highlighter';

  return (
    <div className="flex flex-col min-h-screen text-stone-200">
      <div className="p-4 bg-brand/10 border-b border-brand/20 mb-4">
        <h1 className="text-xl font-bold text-brand-light">[4E-C3D Highlighter Style Controls]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          Annotation V2 memory drawing + add/erase action history active<br/>
          Typed per-stroke pen and highlighter tools active<br/>
          Independent pen and highlighter style states active<br/>
          Preset pen color and width controls active<br/>
          Preset highlighter color and width controls active<br/>
          Highlighter opacity fixed at 0.35<br/>
          Verified shared drawing pointer lifecycle preserved<br/>
          Spatial eraser active<br/>
          Persistent storage disabled
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 px-4 pb-10 flex-grow">
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4">
            <div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-brand-light hover:file:bg-brand-dark"
              />
            </div>
            {isLoading && <div className="text-stone-400 text-sm">Loading...</div>}
            {errorMessage && <div className="text-red-400 text-sm">{errorMessage}</div>}
            
            {docReady && (
              <div className="text-sm">
                <div>Document: {docName}</div>
                <div>Pages: {numPages}</div>
                <div>PDF Scale: 100%</div>
                <div>Requested Output Scale: {targetOutputScale.toFixed(2)}x</div>
                <div>Effective Output Scale: {effectiveOutputScale.toFixed(2)}x</div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-950 p-2 rounded">Completed: {stats.completed}</div>
              <div className="bg-stone-950 p-2 rounded">Swaps: {stats.swaps}</div>
              <div className="bg-stone-950 p-2 rounded">Cancelled: {stats.cancelled}</div>
              <div className="bg-stone-950 p-2 rounded">Stale: {stats.stale}</div>
              <div className="bg-stone-950 p-2 rounded">Errors: {stats.errors}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Pages</div>
              <div>Target Page: {pageNumber}</div>
              <div>Front Page: {frontInfo?.pageNumber ?? '-'}</div>
              <div>Baseline Page: {currentBaseline?.pageNumber ?? '-'}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Render Quality</div>
              <div>Mode: AUTOMATIC + PIXEL BUDGET</div>
              <div>Rule: &lt; 1.50x → 2x</div>
              <div>Rule: &gt;= 1.50x → 3x</div>
              <div>Requested Output Scale: {targetOutputScale.toFixed(2)}x</div>
              <div>Effective Output Scale: {effectiveOutputScale.toFixed(2)}x</div>
              <div>Front Output Scale: {frontInfo?.outputScale ?? '-'}x</div>
              <div>Quality Status: {qualityStatus}</div>
              <div>Render Failed: {renderFailed ? 'YES' : 'NO'}</div>
            </div>
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Render Race Diagnostics</div>
              <div>Target Page: {pageNumber}</div>
              <div>Front Page: {frontInfo?.pageNumber ?? '-'}</div>
              <div>Engine Generation: {engineRef.current?.generation ?? '-'}</div>
              <div>Front Generation: {frontInfo?.generation ?? '-'}</div>
              <div>Requested Quality Scale: {targetOutputScale.toFixed(2)}x</div>
              <div>Calculated Effective Scale: {effectiveOutputScale.toFixed(2)}x</div>
              <div>Front Effective Scale: {frontInfo?.outputScale ?? '-'}x</div>
              <div>Quality Status: {qualityStatus}</div>
              <div>Render Failed: {renderFailed ? 'YES' : 'NO'}</div>

              <div className="mt-2 pt-2 border-t border-white/5">
                {lastRenderResult ? (
                  <div className="space-y-1">
                    <div>Last Status: {lastRenderResult.status}</div>
                    <div>Last Request ID: {lastRenderResult.requestId}</div>
                    <div>Last Generation: {lastRenderResult.generation}</div>
                    <div>Last Page: {lastRenderResult.pageNumber}</div>
                    <div>Last Requested Scale: {lastRenderResult.requestedOutputScale.toFixed(2)}x</div>
                    <div>Last Effective Scale: {lastRenderResult.outputScale.toFixed(2)}x</div>
                    <div>Last CSS Size: {lastRenderResult.cssWidth.toFixed(1)} × {lastRenderResult.cssHeight.toFixed(1)}</div>
                    <div>Last Pixel Size: {lastRenderResult.pixelWidth} × {lastRenderResult.pixelHeight}</div>
                    <div>Last Pixel Count: {(lastRenderResult.pixelWidth * lastRenderResult.pixelHeight).toLocaleString()}</div>
                    <div>Last Duration: {lastRenderResult.renderDurationMs.toFixed(1)}ms</div>
                  </div>
                ) : (
                  <div>Last Render Result: NONE</div>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-white/5">
                {lastRenderError ? (
                  <div className="space-y-1">
                    <div>Error Code: {lastRenderError.code}</div>
                    <div className="break-words">Error Message: {lastRenderError.message}</div>
                  </div>
                ) : (
                  <div>Last Render Error: NONE</div>
                )}
              </div>
            </div>

            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Mobile Pixel Budget Preview</div>
              <div>Mode: ENGINE PREFLIGHT + CURRENT BASELINE</div>
              <div>Budget Enforcement: ACTIVE</div>
              <div>First Unseen Page Preflight: ACTIVE</div>
              <div>Scale Limited: {isOutputScaleLimited ? 'YES' : 'NO'}</div>
              <div>Max Pixels: {V2_MAX_CANVAS_PIXELS.toLocaleString()}</div>
              <div>Max Edge: {V2_MAX_CANVAS_EDGE}px</div>
              {budgetPreview && (
                <div className="mt-2 space-y-1 pt-2 border-t border-white/5">
                  <div>CSS Size: {budgetPreview.cssWidth.toFixed(1)} × {budgetPreview.cssHeight.toFixed(1)}</div>
                  <div>Requested Output Scale: {budgetPreview.requestedOutputScale.toFixed(2)}x</div>
                  <div>Applied Effective Scale: {budgetPreview.effectiveOutputScale.toFixed(2)}x</div>
                  <div>Requested Pixel Size: {budgetPreview.requestedPixelWidth} × {budgetPreview.requestedPixelHeight}</div>
                  <div>Requested Pixel Count: {budgetPreview.requestedPixelCount.toLocaleString()}</div>
                  <div>Budget Pixel Size: {budgetPreview.effectivePixelWidth} × {budgetPreview.effectivePixelHeight}</div>
                  <div>Budget Pixel Count: {budgetPreview.effectivePixelCount.toLocaleString()}</div>
                  <div>Estimated RGBA / Canvas: {formatMiB(budgetPreview.estimatedBytesPerCanvas)} MiB</div>
                  <div>Estimated Front + Back: {formatMiB(budgetPreview.estimatedDoubleBufferBytes)} MiB</div>
                  <div>Limited By: {budgetPreview.limitReason}</div>
                  <div>Budget Satisfied: {budgetPreview.budgetSatisfied ? 'YES' : 'NO'}</div>
                </div>
              )}
            </div>

            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Annotation V2 Baseline</div>
              <div>Annotation Stage: 4E-C3D</div>
              <div>Stroke Tool Model: TYPED</div>
              <div>Stroke Style Storage: PER STROKE</div>
              <div>Active Tool: {activeDrawingTool.toUpperCase()}</div>
              <div>Active Color: {activeDrawingStyle.color}</div>
              <div>Active Width: {activeDrawingStyle.width} LOGICAL PX</div>
              <div>Active Opacity: {activeDrawingStyle.opacity}</div>
              <div>Selected Highlighter Color: {activeHighlighterStyle.color}</div>
              <div>Selected Highlighter Width: {activeHighlighterStyle.width} LOGICAL PX</div>
              <div>Selected Highlighter Opacity: {activeHighlighterStyle.opacity}</div>
              <div>Pen Style Controls: CONNECTED</div>
              <div>Highlighter Input: CONNECTED</div>
              <div>Highlighter Style Controls: CONNECTED</div>
              <div>Highlighter Opacity Control: NOT ENABLED</div>
              <div>Highlighter Blend: SOURCE-OVER</div>
              <div>Style Persistence: MEMORY ONLY</div>
              <div>Interaction Mode: {interactionMode.toUpperCase()}</div>
              <div>Surface: {annotationPageSpace ? 'ACTIVE' : 'WAITING FOR CURRENT PAGE BASELINE'}</div>
              <div>Coordinate Space: NORMALIZED 0..1</div>
              <div>Input Phase: {inputStatus.phase.toUpperCase()}</div>
              <div>Active Pointer ID: {inputStatus.activePointerId !== null ? inputStatus.activePointerId : 'NONE'}</div>
              <div>Active Pointer Type: {inputStatus.activePointerType ? inputStatus.activePointerType.toUpperCase() : 'NONE'}</div>
              <div>Active Point Count: {inputStatus.currentPointCount}</div>
              <div>Current Page Stroke Count: {currentPageStrokes.length}</div>
              <div>Current Page Total Point Count: {totalPoints}</div>
              <div>History Mode: MEMORY ONLY</div>
              <div>History Actions: ADD + ERASE</div>
              <div>Eraser Input: CONNECTED</div>
              <div>Erase Latest Available: {currentPageStrokes.length > 0 && docReady && annotationPageSpace && !isGestureActive && inputStatus.phase === 'idle' ? 'YES' : 'NO'}</div>
              <div>History Scope: CURRENT PAGE</div>
              <div>Undo Depth: {undoDepth}</div>
              <div>Redo Depth: {redoDepth}</div>
              <div>History Action Blocked: {(!docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle') ? 'YES' : 'NO'}</div>
              <div>Mouse Drawing: {interactionMode === 'pen' ? 'ENABLED' : 'DISABLED'}</div>
              <div>Stylus Pen Drawing: {interactionMode === 'pen' ? 'ENABLED' : 'DISABLED'}</div>
              <div>Touch Eraser: ENABLED</div>
              <div>Erase Model: WHOLE STROKE</div>
              <div>Erase Commit: POINTERUP ONLY</div>
              <div>First Touch in Eraser: PENDING ERASE + VIEWPORT DEFER</div>
              <div>Second Touch: DISCARD PENDING ERASE + PINCH HANDOFF</div>
              <div>Touch Suppressed Until Release: {inputStatus.touchSuppressedUntilRelease ? 'YES' : 'NO'}</div>
              <div>First Touch Capture Owner: ANNOTATION</div>
              <div>Pinch Capture Owner: VIEWPORT</div>
              <div>After Pinch One Touch: PAN ONLY</div>
              <div>New Touch Erase After Pointers 0: ENABLED</div>
              <div>Eraser Radius: 12 LOGICAL PX</div>
              <div>Storage: MEMORY ONLY</div>
              <div>V1 Data Connection: NONE</div>
            </div>

            {frontInfo && (
              <div className="bg-stone-950 p-3 rounded text-xs space-y-1 font-mono text-stone-400 border border-white/5">
                <div>Req ID: {frontInfo.requestId}</div>
                <div>CSS Size: {frontInfo.cssWidth.toFixed(1)} x {frontInfo.cssHeight.toFixed(1)}</div>
                <div>Front Pixel Size: {frontInfo.pixelWidth} x {frontInfo.pixelHeight}</div>
                <div>Front Pixel Count: {(frontInfo.pixelWidth * frontInfo.pixelHeight).toLocaleString()}</div>
                <div>Front RGBA Estimate: {formatMiB(frontInfo.pixelWidth * frontInfo.pixelHeight * 4)} MiB</div>
              </div>
            )}
            
            <div className="bg-stone-950 p-3 rounded text-xs space-y-2 font-mono text-stone-400 border border-white/5">
              <div className="font-semibold text-stone-300">Gesture State</div>
              <div>Viewer Touch Scroll Guard: ACTIVE</div>
              <div>Phase: {transformInfo?.phase || 'idle'}</div>
              <div>Pointers: {transformInfo?.activePointerCount || 0}</div>
              <div>Scale: {transformInfo?.transform.scale.toFixed(2) || '1.00'}x</div>
              <div>Translate: {transformInfo?.transform.translateX.toFixed(1) || '0.0'}, {transformInfo?.transform.translateY.toFixed(1) || '0.0'}</div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
              <button 
                onClick={setNavigateMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'navigate' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'navigate'}
              >
                이동
              </button>
              <button 
                onClick={setPenMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'pen' && activeDrawingTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'pen' && activeDrawingTool === 'pen'}
              >
                펜
              </button>
              <button 
                onClick={setHighlighterMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'pen' && activeDrawingTool === 'highlighter' ? 'bg-yellow-600 text-stone-900 border-yellow-500' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'pen' && activeDrawingTool === 'highlighter'}
              >
                형광펜
              </button>
              <button 
                onClick={setEraserMode} 
                disabled={modeControlsDisabled}
                className={`px-3 py-2 rounded text-sm font-semibold border border-white/10 disabled:opacity-50 ${interactionMode === 'eraser' ? 'bg-blue-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-300'}`}
                aria-pressed={interactionMode === 'eraser'}
              >
                지우개
              </button>
            </div>
            
            <div className={`bg-stone-950 p-3 rounded border border-white/5 space-y-3 ${activeDrawingTool !== 'pen' ? 'opacity-50' : ''}`}>
              <div className="text-xs font-semibold text-stone-400">Pen Style &mdash; 펜 전용</div>
              <div className="flex gap-2">
                {PEN_COLOR_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-label={preset.label}
                    aria-pressed={activePenStyle.color === preset.color}
                    disabled={penStyleControlsDisabled}
                    onClick={() => setActivePenStyle(prev => ({ ...prev, color: preset.color }))}
                    className={`w-8 h-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-blue-500 disabled:opacity-50 ${activePenStyle.color === preset.color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {PEN_WIDTH_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={activePenStyle.width === preset.width}
                    disabled={penStyleControlsDisabled}
                    onClick={() => setActivePenStyle(prev => ({ ...prev, width: preset.width }))}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium border ${activePenStyle.width === preset.width ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700'} disabled:opacity-50`}
                  >
                    {preset.label} {preset.width}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={`bg-stone-950 p-3 rounded border border-white/5 space-y-3 ${activeDrawingTool !== 'highlighter' ? 'opacity-50' : ''}`}>
              <div className="text-xs font-semibold text-stone-400">Highlighter Style &mdash; 형광펜 전용</div>
              <div className="flex gap-2">
                {HIGHLIGHTER_COLOR_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-label={`${preset.label} 형광펜`}
                    aria-pressed={activeHighlighterStyle.color === preset.color}
                    disabled={highlighterStyleControlsDisabled}
                    onClick={() => setActiveHighlighterStyle(prev => ({ ...prev, color: preset.color }))}
                    className={`w-8 h-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 focus:ring-blue-500 disabled:opacity-50 ${activeHighlighterStyle.color === preset.color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {HIGHLIGHTER_WIDTH_PRESETS_V2.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={activeHighlighterStyle.width === preset.width}
                    disabled={highlighterStyleControlsDisabled}
                    onClick={() => setActiveHighlighterStyle(prev => ({ ...prev, width: preset.width }))}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium border ${activeHighlighterStyle.width === preset.width ? 'bg-yellow-600 border-yellow-500 text-stone-900' : 'bg-stone-800 border-white/10 text-stone-300 hover:bg-stone-700'} disabled:opacity-50`}
                  >
                    {preset.label} {preset.width}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-stone-500">Opacity: 0.35 fixed | Blend: source-over</div>
            </div>
            
            <div className="flex gap-2 items-center mt-2">
              <button 
                onClick={handleUndo}
                disabled={undoDepth === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Undo
              </button>
              <button 
                onClick={handleRedo}
                disabled={redoDepth === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="flex-1 px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Redo
              </button>
            </div>
            
            <div className="flex gap-2 items-center mt-2">
              <button 
                onClick={handleEraseLatest}
                disabled={currentPageStrokes.length === 0 || !docReady || !annotationPageSpace || isGestureActive || inputStatus.phase !== 'idle'}
                className="w-full px-3 py-2 rounded text-sm font-semibold border border-white/10 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
              >
                Erase Latest
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <button 
                onClick={handlePrevPage} 
                disabled={!docReady || isLoading || pageNumber <= 1}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10"
              >
                이전
              </button>
              <div className="px-2 text-sm font-semibold text-center w-24">
                {docReady ? `${pageNumber} / ${numPages}` : '- / -'}
              </div>
              <button 
                onClick={handleNextPage} 
                disabled={!docReady || isLoading || pageNumber >= numPages}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10"
              >
                다음
              </button>
            </div>
            
            <div className="flex gap-2 items-center">
              <button onClick={handleZoomOut} disabled={isMinScale} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10">-</button>
              <div className="px-2 text-sm font-semibold text-center w-16">{Math.round(currentScale * 100)}%</div>
              <button onClick={handleZoomIn} disabled={isMaxScale} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800 rounded text-sm font-semibold border border-white/10">+</button>
              <button onClick={handleZoomReset} className="px-3 py-1 bg-stone-800 hover:bg-stone-700 rounded text-sm font-semibold border border-white/10 ml-auto">100%</button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center">
          <div 
            className="bg-stone-950 border border-white/5 rounded-xl flex flex-col"
            style={{
               position: 'relative',
               overflow: 'hidden',
               flex: 'none',
               width: '100%',
               ...(currentBaseline ? {
                 maxWidth: `${currentBaseline.logicalWidth + 24}px`,
                 height: `min(${currentBaseline.logicalHeight + 24}px, calc(100dvh - 230px))`,
                 minHeight: '320px'
               } : {
                 height: 'calc(100dvh - 230px)',
                 minHeight: '320px',
                 maxWidth: '800px'
               })
            }}
          >
            {docReady && engineRef.current && (
              <StableGestureViewportV2 
                key={documentInstanceIdRef.current} 
                ref={viewportRef}
                onTransformChange={handleTransformChange}
                onGestureEnd={handleGestureEnd}
                minScale={1}
                maxScale={3}
                deferSingleTouchPan={interactionMode === 'pen' || interactionMode === 'eraser'}
              >
                <>
                  <PageSurfaceV2
                    engine={engineRef.current}
                    pageNumber={pageNumber}
                    cssScale={PDF_CSS_SCALE}
                    outputScale={effectiveOutputScale}
                    onRenderEvent={handleRenderEvent}
                    onSwap={handleSwap}
                    onRenderError={handleRenderError}
                  />
                  {annotationPageSpace && (
                    <AnnotationSurfaceV2 
                      pageSpace={annotationPageSpace} 
                      interactionMode={interactionMode}
                      completedStrokes={currentPageStrokes}
                      activeTool={activeDrawingTool}
                      activeStyle={activeDrawingStyle}
                      onStrokeComplete={handleStrokeComplete}
                      onEraseRequest={handleEraseRequest}
                      onInputStatusChange={handleInputStatusChange}
                      isGestureActive={isGestureActive}
                    />
                  )}
                </>
              </StableGestureViewportV2>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
