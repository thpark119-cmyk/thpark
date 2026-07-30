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
import type { AnnotationPageSpaceV2 } from './annotationTypesV2';
import {
  calculateRenderBudgetPreviewV2,
  V2_MAX_CANVAS_PIXELS,
  V2_MAX_CANVAS_EDGE
} from './renderBudgetV2';

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

  let qualityStatus = 'RENDERING';
  if (renderFailed) {
    qualityStatus = frontInfo ? 'FAILED_FRONT_PRESERVED' : 'FAILED';
  } else if (isQualityReady) {
    qualityStatus = 'READY';
  }

  return (
    <div className="flex flex-col min-h-screen text-stone-200">
      <div className="p-4 bg-brand/10 border-b border-brand/20 mb-4">
        <h1 className="text-xl font-bold text-brand-light">[4E-A Annotation V2 Coordinate Baseline]</h1>
        <div className="bg-emerald-900/50 text-emerald-200 p-2 rounded text-xs mt-2 border border-emerald-500/20">
          <strong>Interactive CSS Preview Mode</strong><br/>
          PDF render 및 mobile scroll guard 유지<br/>
          Annotation V2는 시각적 좌표 진단만 활성화<br/>
          필기 입력과 저장은 아직 비활성화
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
              <div>Mode: VISUAL DIAGNOSTIC ONLY</div>
              <div>Surface: {annotationPageSpace ? 'ACTIVE' : 'WAITING FOR CURRENT PAGE BASELINE'}</div>
              <div>Document Instance: {documentInstanceIdRef.current}</div>
              <div>Page: {pageNumber}</div>
              <div>Coordinate Space: NORMALIZED 0..1</div>
              <div>Logical CSS Size: {annotationPageSpace ? `${annotationPageSpace.logicalWidth.toFixed(1)} × ${annotationPageSpace.logicalHeight.toFixed(1)}` : '-'}</div>
              <div>Backing Scale: 1x DIAGNOSTIC</div>
              <div>Pointer Events: NONE</div>
              <div>Drawing Input: DISABLED</div>
              <div>Storage: DISABLED</div>
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
                    <AnnotationSurfaceV2 pageSpace={annotationPageSpace} />
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
