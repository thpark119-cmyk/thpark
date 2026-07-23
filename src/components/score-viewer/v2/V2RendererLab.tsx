import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdminUser } from '../../../utils/admin';
import { PdfRenderEngineV2 } from './PdfRenderEngineV2';
import { PageSurfaceV2 } from './PageSurfaceV2';
import {
  PageSurfaceFrontInfoV2,
  PageSurfaceSwapInfoV2,
  PageSurfaceRenderEventV2,
} from './pageSurfaceTypes';

interface LabRenderEvent {
  timestamp: number;
  requestId: number;
  status: 'completed' | 'cancelled' | 'stale' | 'error';
  pageNumber: number;
  cssScale: number;
  outputScale: number;
  renderDurationMs: number;
  generation: number;
  errorMsg?: string;
}

export default function V2RendererLab() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  // Stats
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [staleCount, setStaleCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [swapCount, setSwapCount] = useState(0);

  // Document state
  const [isLoading, setIsLoading] = useState(false);
  const [docReady, setDocReady] = useState(false);
  const [docName, setDocName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [cssScale, setCssScale] = useState(1);
  const [outputScale, setOutputScale] = useState(1); // 1, 1.5, or 2
  const [errorMessage, setErrorMessage] = useState('');
  const [docInstanceId, setDocInstanceId] = useState(0);
  const [engineGeneration, setEngineGeneration] = useState(0);
  const [canvasInspectionVersion, setCanvasInspectionVersion] = useState(0);

  // Info
  const [frontInfo, setFrontInfo] = useState<PageSurfaceFrontInfoV2 | null>(null);
  const [recentEvents, setRecentEvents] = useState<LabRenderEvent[]>([]);

  // Engine instance
  const engineRef = useRef<PdfRenderEngineV2 | null>(null);
  const loadSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  // Stress test
  const [isStressTesting, setIsStressTesting] = useState(false);
  const stressRunIdRef = useRef(0);
  const stressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    engineRef.current = new PdfRenderEngineV2();

    return () => {
      mountedRef.current = false;
      if (stressTimerRef.current) {
        clearTimeout(stressTimerRef.current);
      }
      setIsStressTesting(false);
      loadSequenceRef.current++;
      
      const eng = engineRef.current;
      if (eng) {
        // Run destroy asynchronously, we shouldn't await in cleanup
        void eng.destroy();
        engineRef.current = null;
      }
      console.info('[Mio V2 Renderer Lab] lab-unmount');
    };
  }, []);

  const addEvent = useCallback((ev: PageSurfaceRenderEventV2) => {
    const labEv: LabRenderEvent = {
      timestamp: performance.now(),
      requestId: ev.surfaceRequestId,
      status: ev.result.status,
      pageNumber: ev.result.pageNumber,
      cssScale: ev.result.cssScale,
      outputScale: ev.result.outputScale,
      renderDurationMs: ev.result.renderDurationMs,
      generation: ev.result.generation,
    };
    setRecentEvents((prev) => [labEv, ...prev].slice(0, 30));
    if (ev.result.status === 'completed') setCompletedCount((p) => p + 1);
    if (ev.result.status === 'cancelled') setCancelledCount((p) => p + 1);
    if (ev.result.status === 'stale') setStaleCount((p) => p + 1);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (stressTimerRef.current) clearTimeout(stressTimerRef.current);
    setIsStressTesting(false);

    const seq = ++loadSequenceRef.current;
    setIsLoading(true);
    setErrorMessage('');
    setDocReady(false);

    try {
      console.info('[Mio V2 Renderer Lab] file-load-start');
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);

      if (seq !== loadSequenceRef.current || !mountedRef.current) {
        console.info('[Mio V2 Renderer Lab] file-load-stale');
        return; // Stale
      }

      if (engineRef.current) {
        const result = await engineRef.current.loadDocument(bytes);
        if (seq !== loadSequenceRef.current || !mountedRef.current) return;

        if (result.status === 'loaded') {
          console.info('[Mio V2 Renderer Lab] file-load-success');
          setDocName(file.name);
          setNumPages(result.numPages);
          setPageNumber(1);
          setCssScale(1);
          setOutputScale(Math.min(window.devicePixelRatio || 1, 2) >= 1.5 ? 1.5 : 1);
          setDocInstanceId((p) => p + 1);
          setEngineGeneration(engineRef.current.generation);
          setDocReady(true);
        } else {
          setErrorMessage('Load cancelled or stale');
        }
      }
    } catch (err: unknown) {
      console.error('[Mio V2 Renderer Lab] file-load-error', err);
      if (seq === loadSequenceRef.current && mountedRef.current) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (seq === loadSequenceRef.current && mountedRef.current) {
        setIsLoading(false);
      }
    }
    
    // Clear file input
    e.target.value = '';
  };

  const handleZoomOut = () => setCssScale((p) => Math.max(0.5, p - 0.25));
  const handleZoomIn = () => setCssScale((p) => Math.min(2.0, p + 0.25));
  const handleZoomReset = () => setCssScale(1);

  const handlePrevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));

  const handleOutputScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    if (val === 1 || val === 1.5 || val === 2) {
      setOutputScale(val);
    }
  };

  const runStressTestSequence = useCallback(() => {
    const sequence = [0.75, 1, 1.25, 1.5, 1.75, 2, 1.5, 1.25];
    let idx = 0;
    const runId = ++stressRunIdRef.current;
    
    setIsStressTesting(true);
    console.info('[Mio V2 Renderer Lab] stress-start');

    const nextStep = () => {
      if (runId !== stressRunIdRef.current || !mountedRef.current) return;
      if (idx >= sequence.length) {
        setIsStressTesting(false);
        console.info('[Mio V2 Renderer Lab] stress-complete');
        return;
      }
      setCssScale(sequence[idx]);
      idx++;
      stressTimerRef.current = window.setTimeout(nextStep, 80);
    };

    nextStep();
  }, []);

  const startStressTest = () => {
    if (stressTimerRef.current) clearTimeout(stressTimerRef.current);
    runStressTestSequence();
  };

  const stopStressTest = () => {
    if (stressTimerRef.current) clearTimeout(stressTimerRef.current);
    stressRunIdRef.current++; // Invalidate
    setIsStressTesting(false);
    console.info('[Mio V2 Renderer Lab] stress-stop');
  };

  const resetStats = () => {
    setCompletedCount(0);
    setCancelledCount(0);
    setStaleCount(0);
    setErrorCount(0);
    setSwapCount(0);
    setRecentEvents([]);
  };

  const handleRenderError = useCallback((err: unknown) => {
    setErrorCount((p) => p + 1);
    const msg = err instanceof Error ? err.message : String(err);
    setErrorMessage(`Render error: ${msg}`);
    const ev: LabRenderEvent = {
      timestamp: performance.now(),
      requestId: -1,
      status: 'error',
      pageNumber: -1,
      cssScale: -1,
      outputScale: -1,
      renderDurationMs: 0,
      generation: -1,
      errorMsg: msg,
    };
    setRecentEvents((prev) => [ev, ...prev].slice(0, 30));
  }, []);

  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    setSwapCount((p) => p + 1);
    setFrontInfo(info.nextFront);
  }, []);

  if (!isAdmin) {
    return <div className="p-10 text-stone-400">Admin access required</div>;
  }

  return (
    <div className="flex flex-col min-h-screen text-stone-200">
      <div className="p-4 bg-brand/10 border-b border-brand/20 mb-4">
         <h1 className="text-xl font-bold text-brand-light">V2 Renderer Lab</h1>
         <p className="text-xs text-brand-light/70 mt-1">
           * 내부 관리자 테스트 도구입니다. 일반 사용자에게는 노출되지 않습니다.
           필기 및 핀치 줌 기능은 포함되어 있지 않으며, 선택한 파일은 서버에 업로드되지 않습니다.
         </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 px-4 pb-10 flex-grow">
        {/* Left/Top Column: Controls and Surface */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="text-sm bg-stone-950 p-2 rounded border border-stone-800"
              />
              {isLoading && <span className="text-sm text-brand animate-pulse">Loading...</span>}
              {docReady && (
                <div className="text-xs text-stone-400">
                  <span className="font-bold text-stone-300">{docName}</span> ({numPages} pages) |
                  Gen: {engineGeneration}
                </div>
              )}
            </div>
            
            {errorMessage && (
              <div className="p-2 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded">
                {errorMessage}
              </div>
            )}

            {docReady && (
              <div className="flex flex-wrap gap-4 items-center bg-stone-950 p-3 rounded-lg border border-white/5">
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevPage} className="px-3 py-1 bg-stone-800 rounded hover:bg-stone-700 text-sm">Prev</button>
                  <span className="text-sm w-16 text-center">{pageNumber} / {numPages}</span>
                  <button onClick={handleNextPage} className="px-3 py-1 bg-stone-800 rounded hover:bg-stone-700 text-sm">Next</button>
                </div>
                
                <div className="h-4 w-px bg-stone-800"></div>
                
                <div className="flex items-center gap-2">
                  <button onClick={handleZoomOut} className="px-3 py-1 bg-stone-800 rounded hover:bg-stone-700 text-sm">-</button>
                  <span className="text-sm w-14 text-center">{Math.round(cssScale * 100)}%</span>
                  <button onClick={handleZoomIn} className="px-3 py-1 bg-stone-800 rounded hover:bg-stone-700 text-sm">+</button>
                  <button onClick={handleZoomReset} className="px-3 py-1 bg-stone-800 rounded hover:bg-stone-700 text-xs">100%</button>
                </div>

                <div className="h-4 w-px bg-stone-800"></div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-stone-400">OutputScale:</label>
                  <select 
                    value={outputScale} 
                    onChange={handleOutputScaleChange}
                    className="bg-stone-800 text-sm rounded p-1 border-none outline-none"
                  >
                    <option value="1">1x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>

                <div className="h-4 w-px bg-stone-800"></div>

                <div className="flex items-center gap-2">
                  {isStressTesting ? (
                    <button onClick={stopStressTest} className="px-3 py-1 bg-red-900/50 text-red-200 rounded hover:bg-red-800/60 text-sm font-bold border border-red-500/20">
                      테스트 중지
                    </button>
                  ) : (
                    <button onClick={startStressTest} className="px-3 py-1 bg-brand/20 text-brand-light rounded hover:bg-brand/30 text-sm border border-brand/20">
                      연속 확대 요청 테스트
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[500px] bg-stone-950 border border-white/5 rounded-xl overflow-auto p-4 flex items-center justify-center">
            {docReady && engineRef.current ? (
              <React.Fragment key={docInstanceId}>
                <PageSurfaceV2
                  engine={engineRef.current}
                  pageNumber={pageNumber}
                  cssScale={cssScale}
                  outputScale={outputScale}
                  ariaLabel={`Page ${pageNumber}`}
                  onRenderEvent={addEvent}
                  onSwap={handleSwap}
                  onRenderError={handleRenderError}
                />
              </React.Fragment>
            ) : (
              <div className="text-stone-600 text-sm">PDF를 선택해주세요</div>
            )}
          </div>
        </div>

        {/* Right/Bottom Column: Stats & Logs */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3" data-inspection-version={canvasInspectionVersion}>
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-stone-300">Front Canvas Info</h2>
               <button onClick={() => setCanvasInspectionVersion((v) => v + 1)} className="text-[10px] bg-stone-800 px-2 py-1 rounded hover:bg-stone-700">Canvas 상태 새로고침</button>
            </div>
            {frontInfo ? (
              <div className="text-xs text-stone-400 space-y-1 bg-stone-950 p-2 rounded">
                <p>Slot: <span className="text-stone-200">{frontInfo.slot}</span></p>
                <p>ReqId: {frontInfo.requestId} / Gen: {frontInfo.generation}</p>
                <p>Page: {frontInfo.pageNumber}</p>
                <p>Scale: {frontInfo.cssScale} (output: {frontInfo.outputScale})</p>
                <p>CSS: {Math.round(frontInfo.cssWidth)}x{Math.round(frontInfo.cssHeight)}</p>
                <p>Pixel: {Math.round(frontInfo.pixelWidth)}x{Math.round(frontInfo.pixelHeight)}</p>
              </div>
            ) : (
              <div className="text-xs text-stone-500 bg-stone-950 p-2 rounded">아직 표시된 Front canvas 없음</div>
            )}
          </div>

          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 flex flex-col flex-1 min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
               <h2 className="text-sm font-bold text-stone-300">Render Stats</h2>
               <button onClick={resetStats} className="text-[10px] bg-stone-800 px-2 py-1 rounded hover:bg-stone-700">통계 초기화</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-stone-950 p-2 rounded flex justify-between"><span>Completed</span> <span className="text-green-400 font-mono">{completedCount}</span></div>
              <div className="bg-stone-950 p-2 rounded flex justify-between"><span>Cancelled</span> <span className="text-stone-400 font-mono">{cancelledCount}</span></div>
              <div className="bg-stone-950 p-2 rounded flex justify-between"><span>Stale</span> <span className="text-yellow-500/80 font-mono">{staleCount}</span></div>
              <div className="bg-stone-950 p-2 rounded flex justify-between"><span>Errors</span> <span className="text-red-400 font-mono">{errorCount}</span></div>
              <div className="bg-stone-950 p-2 rounded flex justify-between col-span-2"><span>Swaps</span> <span className="text-brand-light font-mono">{swapCount}</span></div>
            </div>

            <h3 className="text-xs font-bold text-stone-400 mb-2">Recent Events</h3>
            <div className="flex-1 overflow-auto space-y-1 pr-1">
              {recentEvents.map((ev, i) => (
                <div key={i} className="text-[10px] bg-stone-950 p-1.5 rounded flex flex-col gap-0.5 border border-white/[0.02]">
                  <div className="flex justify-between">
                    <span className={`font-bold ${ev.status === 'completed' ? 'text-green-400' : ev.status === 'cancelled' ? 'text-stone-500' : ev.status === 'error' ? 'text-red-400' : 'text-yellow-500/80'}`}>
                      [{ev.status.toUpperCase()}]
                    </span>
                    <span className="text-stone-500">{new Date(ev.timestamp).toISOString().split('T')[1].replace('Z', '')}</span>
                  </div>
                  <div className="text-stone-400 flex justify-between">
                    <span>Req: {ev.requestId} (Gen {ev.generation})</span>
                    <span>{Math.round(ev.renderDurationMs)}ms</span>
                  </div>
                  <div className="text-stone-500">
                    Pg: {ev.pageNumber} | Scale: {ev.cssScale}x{ev.outputScale}
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && <div className="text-xs text-stone-600 italic">No events yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
