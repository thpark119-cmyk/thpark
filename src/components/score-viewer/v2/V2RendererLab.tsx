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
import { GestureViewportV2 } from './GestureViewportV2';
import { 
  GestureViewportV2Handle, 
  GestureTransformEventV2, 
  GestureScaleHandoffSnapshotV2, 
  GestureScaleHandoffResultV2, 
  GestureEndEventV2 
} from './gestureTypes';




export type ScaleHandoffChainPhaseV2 = 'idle' | 'rendering' | 'deferred' | 'applying' | 'chaining' | 'completed' | 'cancelled' | 'error';

export interface DeferredScaleCommitV2 {
  deferredId: number;
  gestureSessionId: number;
  endEventId: number;
  transformRevisionAtEnd: number;
  previewScaleAtEnd: number;
  effectiveScaleAtEnd: number;
  createdAt: number;
  replacedCount: number;
}

export interface ScaleHandoffInfoV2 {
  id: string;
  gestureSessionId: number;
  handoffId: number;
  sourceCssScale: number;
  previewScaleAtCommit: number;
  rawTargetCssScale: number;
  clampedTargetCssScale: number;
  wasScaleClamped: boolean;
  targetRenderCompleted: boolean;
  targetRenderRequestId: number | null;
  targetFrontSwapped: boolean;
  completedDelta: number;
  swapDelta: number;
  resultPreviewScale: number | null;
  resultTranslateX: number | null;
  resultTranslateY: number | null;
  durationMs: number | null;
  message: string;
  timestamp: number;
  status: 'COMMIT' | 'RENDERED' | 'APPLIED' | 'SKIPPED' | 'CANCELLED' | 'ERROR' | 'DEFERRED' | 'DEFERRED_REPLACED' | 'CHAINED_COMMIT' | 'ACTIVE_REBASED' | 'COALESCED' | 'CHAIN_COMPLETED';
}

interface PendingScaleHandoffV2 {
  snapshot: GestureScaleHandoffSnapshotV2;
  baseCssScale: number;
  gestureSessionId: number;
  rawTargetCssScale: number;
  clampedTargetCssScale: number;
  statsCompletedAtStart: number;
  statsSwapsAtStart: number;
  targetRenderCompleted: boolean;
  targetRenderRequestId: number | null;
  targetFrontSwapped: boolean;
  chainId: number;
  commitIndex: number;
  sourceTransformRevision: number;
}

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

type StressTestModeV2 = 'idle' | 'scale-cancellation' | 'page-scale-race';
type StressTestPhaseV2 = 'idle' | 'preparing' | 'issuing' | 'settling' | 'passed' | 'failed' | 'inconclusive' | 'stopped';

interface StressTargetV2 {
  pageNumber: number;
  cssScale: number;
  outputScale: number;
}

interface StressStatsSnapshotV2 {
  completed: number;
  cancelled: number;
  stale: number;
  errors: number;
  swaps: number;
}

interface StressTestResultV2 {
  mode: StressTestModeV2;
  phase: StressTestPhaseV2;
  requestedCount: number;
  intervalMs: number;
  expectedTarget: StressTargetV2 | null;
  actualFront: PageSurfaceFrontInfoV2 | null;
  completedDelta: number;
  cancelledDelta: number;
  staleDelta: number;
  errorDelta: number;
  swapDelta: number;
  startedAt: number | null;
  finishedAt: number | null;
  message: string;
  renderEventDelta: number;
  coalescedEstimate: number;
  swapSkippedEstimate: number;
  supersededEvidenceCount: number;
  finalTargetMatched: boolean;
  generationMatched: boolean;
  passReason: string | null;
}

const SCALE_CANCEL_INTERVAL_MS = 8;
const SCALE_CANCEL_COUNT = 48;
const SCALE_CANCEL_OUTPUT_SCALE = 2;
const SCALE_CANCEL_SEQ = [2, 0.5, 1.75, 0.75, 1.5, 1, 2, 1.25];
const SCALE_CANCEL_FINAL_TARGET = { cssScale: 1.25, outputScale: 2 };

const PAGE_RACE_INTERVAL_MS = 10;
const PAGE_RACE_COUNT = 40;
const PAGE_RACE_OUTPUT_SCALE = 2;
const PAGE_RACE_SEQ = [
  { pageOffset: 0, scale: 2 },
  { pageOffset: 1, scale: 0.75 },
  { pageOffset: 0, scale: 1.75 },
  { pageOffset: 1, scale: 1 },
  { pageOffset: 0, scale: 1.5 },
  { pageOffset: 1, scale: 2 },
  { pageOffset: 0, scale: 0.5 },
  { pageOffset: 1, scale: 1.25 }
];
const PAGE_RACE_FINAL_TARGET = { pageOffset: 1, cssScale: 1.5, outputScale: 2 };

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
  const [outputScale, setOutputScale] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [docInstanceId, setDocInstanceId] = useState(0);
  const [engineGeneration, setEngineGeneration] = useState(0);
  const [canvasInspectionVersion, setCanvasInspectionVersion] = useState(0);

  // Info
  const [frontInfo, setFrontInfo] = useState<PageSurfaceFrontInfoV2 | null>(null);
  const [recentEvents, setRecentEvents] = useState<LabRenderEvent[]>([]);
  const [gestureEvent, setGestureEvent] = useState<GestureTransformEventV2 | null>(null);

  const MIN_COMMITTED_CSS_SCALE_V2 = 0.5;
  const MAX_COMMITTED_CSS_SCALE_V2 = 3;
  const lastProcessedSessionIdRef = useRef<number | null>(null);

  // Handoff state
  const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);
  const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);
  
  const deferredIntentRef = useRef<DeferredScaleCommitV2 | null>(null);
  const deferredIdCounterRef = useRef(0);
  const chainIdCounterRef = useRef(0);
  const chainCommitIndexRef = useRef(0);
  const deferredReplacementCountRef = useRef(0);
  
  // UI state for continuous handoff chain
  const [chainPhase, setChainPhase] = useState<ScaleHandoffChainPhaseV2>('idle');
  const [chainInfo, setChainInfo] = useState<{ chainId: number; commitIndex: number; deferred: DeferredScaleCommitV2 | null }>({ chainId: 0, commitIndex: 0, deferred: null });


  const visualBaseScale = pendingHandoffRef.current ? pendingHandoffRef.current.baseCssScale : cssScale;
  const cancelScaleHandoffChain = useCallback((reason: string) => {
    chainIdCounterRef.current++; // invalidate current chain
    pendingHandoffRef.current = null;
    deferredIntentRef.current = null;
    setChainPhase('cancelled');
    setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: 0, deferred: null });
    if (gestureRef.current) {
      gestureRef.current.cancelActiveGesture();
      gestureRef.current.resetTransform();
    }
    console.log(`[Mio V2 4B Hardening] chain cancelled: ${reason}`);
  }, []);

  const minPreviewScale = 0.5 / visualBaseScale;
  const maxPreviewScale = 3 / visualBaseScale;

  // Refs

  const engineRef = useRef<PdfRenderEngineV2 | null>(null);
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const gestureRef = useRef<GestureViewportV2Handle | null>(null);

  // Stress Test Refs
  const stressTimerRef = useRef<number | null>(null);
  const prepTimerRef = useRef<number | null>(null);
  const deadlineTimerRef = useRef<number | null>(null);
  const stressRunIdRef = useRef(0);

  const expectedTargetRef = useRef<StressTargetV2 | null>(null);
  const testSnapshotRef = useRef<StressStatsSnapshotV2 | null>(null);
  const issuingCompleteRef = useRef(false);
  const testStartMsRef = useRef<number | null>(null);
  const requestsIssuedRef = useRef(0);
  const testModeRef = useRef<StressTestModeV2>('idle');

  const statsRef = useRef({
    completed: 0, cancelled: 0, stale: 0, errors: 0, swaps: 0,
    front: null as PageSurfaceFrontInfoV2 | null
  });

  const [testResult, setTestResult] = useState<StressTestResultV2 | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    if (isAdmin && !engineRef.current) {
      engineRef.current = new PdfRenderEngineV2();
    }
    return () => {
      mountedRef.current = false;
      stopStressTest('unmount');
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [isAdmin]);

  const updateStats = useCallback((key: keyof StressStatsSnapshotV2, delta: number) => {
    statsRef.current[key] += delta;
    if (key === 'completed') setCompletedCount(c => c + delta);
    if (key === 'cancelled') setCancelledCount(c => c + delta);
    if (key === 'stale') setStaleCount(c => c + delta);
    if (key === 'errors') setErrorCount(c => c + delta);
    if (key === 'swaps') setSwapCount(c => c + delta);
  }, []);

  const addEvent = useCallback((ev: PageSurfaceRenderEventV2) => {
    const labEv: LabRenderEvent = {
      timestamp: Date.now(),
      requestId: ev.surfaceRequestId,
      status: ev.result.status,
      pageNumber: ev.result.pageNumber,
      cssScale: ev.result.cssScale,
      outputScale: ev.result.outputScale,
      renderDurationMs: ev.result.renderDurationMs,
      generation: ev.result.generation,
    };
    setRecentEvents((prev) => [labEv, ...prev].slice(0, 30));
    if (ev.result.status === 'completed') {
      updateStats('completed', 1);
      if (pendingHandoffRef.current && !pendingHandoffRef.current.targetRenderCompleted) {
         const ph = pendingHandoffRef.current;
         if (ph.chainId !== chainIdCounterRef.current) {
           // ignored completed render from cancelled chain
         } else if (
           ev.result.pageNumber === pageNumber &&
           Math.abs(ev.result.cssScale - ph.clampedTargetCssScale) < 0.005 &&
           ev.result.outputScale === outputScale &&
           ev.result.generation === engineGeneration
         ) {
           ph.targetRenderCompleted = true;
           ph.targetRenderRequestId = ev.surfaceRequestId;
           console.log(`[Mio V2 4B Hardening] target-render-completed: req ${ev.surfaceRequestId}`);
           setHandoffResults(prev => prev.map(h => {
             if (h.gestureSessionId === ph.gestureSessionId && h.handoffId === ph.snapshot.snapshotId) {
               return {
                 ...h,
                 targetRenderCompleted: true,
                 targetRenderRequestId: ev.surfaceRequestId,
                 completedDelta: statsRef.current.completed - ph.statsCompletedAtStart,
                 message: '목표 PDF 렌더는 완료됐지만 아직 Front swap이 확인되지 않았습니다.',
                 status: 'RENDERED'
               };
             }
             return h;
           }));
         }
      }
    }
    if (ev.result.status === 'cancelled') updateStats('cancelled', 1);
    if (ev.result.status === 'stale') updateStats('stale', 1);
  }, [updateStats, pageNumber, outputScale, engineGeneration]);

  const checkTestSwap = useCallback((nextFront: PageSurfaceFrontInfoV2) => {
    if (!issuingCompleteRef.current || testModeRef.current === 'idle') return;
    const expected = expectedTargetRef.current;
    if (!expected) return;

    const pageMatch = nextFront.pageNumber === expected.pageNumber;
    const scaleMatch = Math.abs(nextFront.cssScale - expected.cssScale) < 0.005;
    const outputMatch = Math.abs(nextFront.outputScale - expected.outputScale) < 0.005;
    const genMatch = nextFront.generation === engineGeneration;

    if (pageMatch && scaleMatch && outputMatch && genMatch) {
      finalizeTestResult('swapped_expected', nextFront);
    }
  }, [engineGeneration]);

  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
    if (ev.reason !== 'pointer-up' && ev.reason !== 'imperative-cancel') return;
    
    if (lastProcessedSessionIdRef.current === ev.sessionId) {
      console.log(`[Mio V2 4B Hardening] duplicate-commit-blocked for session ${ev.sessionId}`);
      return;
    }
    lastProcessedSessionIdRef.current = ev.sessionId;

    if (!ev.hadPinch) return;
    
    if (Math.abs(ev.transform.scale - 1) < 0.005) {
      console.log(`[Mio V2 4B Hardening] commit-skipped (scale ~1) for session ${ev.sessionId}`);
      return;
    }

    const snapshot = gestureRef.current?.prepareScaleHandoff();
    if (!snapshot) return;

    const rawTargetCssScale = cssScale * ev.transform.scale;
    let clampedTargetCssScale = Math.min(Math.max(rawTargetCssScale, MIN_COMMITTED_CSS_SCALE_V2), MAX_COMMITTED_CSS_SCALE_V2);
    
    if (rawTargetCssScale > 3) {
       console.warn(`[Mio V2 4B Hardening] effective-scale-clamped: ${rawTargetCssScale} -> ${clampedTargetCssScale}`);
    }

    if (Math.abs(clampedTargetCssScale - cssScale) < 0.005) {
      if (cssScale <= MIN_COMMITTED_CSS_SCALE_V2 && rawTargetCssScale < cssScale) {
        console.log(`[Mio V2 4B Hardening] commit-skipped-at-min for session ${ev.sessionId}`);
      } else if (cssScale >= MAX_COMMITTED_CSS_SCALE_V2 && rawTargetCssScale > cssScale) {
        console.log(`[Mio V2 4B Hardening] commit-skipped-at-max for session ${ev.sessionId}`);
      }
      return;
    }

    console.log(`[Mio V2 4B Hardening] commit-start: cssScale=${cssScale} -> ${clampedTargetCssScale} (raw: ${rawTargetCssScale})`);

    pendingHandoffRef.current = {
      snapshot,
      baseCssScale: cssScale,
      gestureSessionId: ev.sessionId,
      rawTargetCssScale,
      clampedTargetCssScale,
      statsCompletedAtStart: statsRef.current.completed,
      statsSwapsAtStart: statsRef.current.swaps,
      targetRenderCompleted: false,
      targetRenderRequestId: null,
      targetFrontSwapped: false,
    };
    
    console.info(`[Mio V2 Renderer Lab] gesture-end handoff triggered: cssScale=${cssScale} -> ${clampedTargetCssScale}`);
        const newHandoff: ScaleHandoffInfoV2 = {
      id: `session-${ev.sessionId}-handoff-${snapshot.snapshotId}`,
      gestureSessionId: ev.sessionId,
      handoffId: snapshot.snapshotId,
      sourceCssScale: cssScale,
      previewScaleAtCommit: ev.transform.scale,
      rawTargetCssScale,
      clampedTargetCssScale,
      wasScaleClamped: rawTargetCssScale !== clampedTargetCssScale,
      targetRenderCompleted: false,
      targetRenderRequestId: null,
      targetFrontSwapped: false,
      completedDelta: 0,
      swapDelta: 0,
      resultPreviewScale: null,
      resultTranslateX: null,
      resultTranslateY: null,
      durationMs: null,
      message: 'Pending Target Render',
      timestamp: Date.now(),
      status: 'COMMIT'
    };
    setHandoffResults(prev => [newHandoff, ...prev].slice(0, 20));
    setCssScale(clampedTargetCssScale);
  }, [cssScale]);

  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    updateStats('swaps', 1);
    setFrontInfo(info.nextFront);
    statsRef.current.front = info.nextFront;
    
    if (pendingHandoffRef.current) {
      const ph = pendingHandoffRef.current;

      if (ph.chainId !== chainIdCounterRef.current) {
         console.log(`[Mio V2 4C Hardening] ignored swap from cancelled chain: ${ph.chainId}`);
      } else {
        const pageMatch = info.nextFront.pageNumber === pageNumber;
        const scaleMatch = Math.abs(info.nextFront.cssScale - ph.clampedTargetCssScale) < 0.005;
        const outputMatch = Math.abs(info.nextFront.outputScale - outputScale) < 0.005;
        const genMatch = info.nextFront.generation === engineGeneration;
        const reqMatch = info.nextFront.requestId === ph.targetRenderRequestId;

        if (pageMatch && scaleMatch && outputMatch && genMatch && reqMatch) {
          ph.targetFrontSwapped = true;
          console.log(`[Mio V2 4B Hardening] target-swap-confirmed`);
          
          const baseScaleRatio = ph.clampedTargetCssScale / ph.baseCssScale;
          
          if (gestureRef.current) {
            const result = gestureRef.current.completeScaleHandoff(ph.snapshot, baseScaleRatio);
            setHandoffResults(prev => prev.map(h => {
              if (h.gestureSessionId === ph.gestureSessionId && h.handoffId === ph.snapshot.snapshotId) {
                return {
                  ...h,
                  targetFrontSwapped: true,
                  swapDelta: statsRef.current.swaps - ph.statsSwapsAtStart,
                  resultPreviewScale: result.clampedPreviewScale,
                  resultTranslateX: result.transform.translateX,
                  resultTranslateY: result.transform.translateY,
                  durationMs: Date.now() - h.timestamp,
                  status: result.status === 'applied' ? 'APPLIED' : 'ERROR',
                  message: result.status === 'applied' ? 'Success' : 'Invalid Base Scale Ratio'
                };
              }
              return h;
            }));
            
            if (result.status === 'applied') {
                console.log(`[Mio V2 4B Hardening] handoff-applied: ratio=${baseScaleRatio}`);
                
                if (result.activeSessionRebase && (result.activeSessionRebase.panRebased || result.activeSessionRebase.pinchRebased)) {
                    const rebaseLog: ScaleHandoffInfoV2 = {
                      id: `chain-${chainIdCounterRef.current}-rebase-${Date.now()}`,
                      gestureSessionId: ph.gestureSessionId,
                      handoffId: ph.snapshot.snapshotId,
                      sourceCssScale: ph.clampedTargetCssScale,
                      previewScaleAtCommit: 1,
                      rawTargetCssScale: ph.clampedTargetCssScale,
                      clampedTargetCssScale: ph.clampedTargetCssScale,
                      wasScaleClamped: false,
                      targetRenderCompleted: false,
                      targetRenderRequestId: null,
                      targetFrontSwapped: false,
                      completedDelta: 0,
                      swapDelta: 0,
                      resultPreviewScale: null,
                      resultTranslateX: null,
                      resultTranslateY: null,
                      durationMs: null,
                      message: `Active Session Rebased: ${result.activeSessionRebase.panRebased ? 'Pan' : 'Pinch'}`,
                      timestamp: Date.now(),
                      status: 'ACTIVE_REBASED' as any
                    };
                    setHandoffResults(prev => [rebaseLog, ...prev].slice(0, 30));
                }
                
                const deferred = deferredIntentRef.current;
                
                // Clear pending early before generating a new one
                pendingHandoffRef.current = null;
                
                if (deferred) {
                  const currentTransform = gestureRef.current.getTransform();
                  const newSourceScale = ph.clampedTargetCssScale;
                  const newRawTarget = newSourceScale * currentTransform.scale;
                  let newClampedTarget = Math.min(Math.max(newRawTarget, MIN_COMMITTED_CSS_SCALE_V2), MAX_COMMITTED_CSS_SCALE_V2);

                  if (Math.abs(newClampedTarget - newSourceScale) < 0.005) {
                    console.log(`[Mio V2 4C Hardening] chained-commit-skipped (coalesced)`);
                    deferredIntentRef.current = null;
                    setChainPhase('completed');
                    setChainInfo(prev => ({ ...prev, deferred: null }));
                    const coalescedLog: ScaleHandoffInfoV2 = {
                      id: `chain-${chainIdCounterRef.current}-${chainCommitIndexRef.current}-coalesced`,
                      gestureSessionId: deferred.gestureSessionId,
                      handoffId: ph.snapshot.snapshotId,
                      sourceCssScale: newSourceScale,
                      previewScaleAtCommit: currentTransform.scale,
                      rawTargetCssScale: newRawTarget,
                      clampedTargetCssScale: newClampedTarget,
                      wasScaleClamped: false,
                      targetRenderCompleted: false,
                      targetRenderRequestId: null,
                      targetFrontSwapped: false,
                      completedDelta: 0,
                      swapDelta: 0,
                      resultPreviewScale: null,
                      resultTranslateX: null,
                      resultTranslateY: null,
                      durationMs: null,
                      message: 'Meaningless change, coalesced and completed',
                      timestamp: Date.now(),
                      status: 'COALESCED' as any
                    };
                    setHandoffResults(prev => [coalescedLog, ...prev].slice(0, 30));
                  } else {
                    const newSnapshot = gestureRef.current.prepareScaleHandoff();
                    if (newSnapshot) {
                      chainCommitIndexRef.current++;
                      
                      pendingHandoffRef.current = {
                        snapshot: newSnapshot,
                        baseCssScale: newSourceScale,
                        gestureSessionId: deferred.gestureSessionId,
                        rawTargetCssScale: newRawTarget,
                        clampedTargetCssScale: newClampedTarget,
                        statsCompletedAtStart: statsRef.current.completed,
                        statsSwapsAtStart: statsRef.current.swaps,
                        targetRenderCompleted: false,
                        targetRenderRequestId: null,
                        targetFrontSwapped: false,
                        chainId: chainIdCounterRef.current,
                        commitIndex: chainCommitIndexRef.current,
                        sourceTransformRevision: newSnapshot.transformRevision
                      };

                      const newHandoff: ScaleHandoffInfoV2 = {
                        id: `chain-${chainIdCounterRef.current}-${chainCommitIndexRef.current}-session-${deferred.gestureSessionId}-handoff-${newSnapshot.snapshotId}`,
                        gestureSessionId: deferred.gestureSessionId,
                        handoffId: newSnapshot.snapshotId,
                        sourceCssScale: newSourceScale,
                        previewScaleAtCommit: currentTransform.scale,
                        rawTargetCssScale: newRawTarget,
                        clampedTargetCssScale: newClampedTarget,
                        wasScaleClamped: newRawTarget !== newClampedTarget,
                        targetRenderCompleted: false,
                        targetRenderRequestId: null,
                        targetFrontSwapped: false,
                        completedDelta: 0,
                        swapDelta: 0,
                        resultPreviewScale: null,
                        resultTranslateX: null,
                        resultTranslateY: null,
                        durationMs: null,
                        message: 'Chained Target Render',
                        timestamp: Date.now(),
                        status: 'CHAINED_COMMIT' as any
                      };
                      setHandoffResults(prev => [newHandoff, ...prev].slice(0, 30));
                      
                      deferredIntentRef.current = null;
                      setChainPhase('chaining');
                      setChainInfo(prev => ({ ...prev, commitIndex: chainCommitIndexRef.current, deferred: null }));
                      // IMPORTANT: call setCssScale last to trigger engine update
                      setCssScale(newClampedTarget);
                    } else {
                      setChainPhase('completed');
                    }
                  }
                } else {
                  setChainPhase('completed');
                }
            } else {
                console.log(`[Mio V2 4B Hardening] handoff-invalid`);
                pendingHandoffRef.current = null;
                setChainPhase('error');
            }
          } else {
            pendingHandoffRef.current = null;
            setChainPhase('error');
          }
        } else if (!ph.targetRenderCompleted) {
            console.log(`[Mio V2 4B Hardening] completed-without-swap: waiting for match`);
        }
      }
    }
    
    checkTestSwap(info.nextFront);
  }, [updateStats, checkTestSwap, pageNumber, outputScale, engineGeneration]);

  const stopStressTest = useCallback((reason?: string) => {
    stressRunIdRef.current++;
    if (stressTimerRef.current !== null) {
      window.clearTimeout(stressTimerRef.current);
      stressTimerRef.current = null;
    }
    if (gestureRef.current) { gestureRef.current.resetTransform(); }
    pendingHandoffRef.current = null;
    setHandoffResults([]);
    if (prepTimerRef.current !== null) {
      window.clearTimeout(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    if (deadlineTimerRef.current !== null) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }

    issuingCompleteRef.current = false;
    
    if (testModeRef.current !== 'idle') {
      console.info(`[Mio V2 Renderer Lab] stress-stopped: ${reason || 'user'}`);
      setTestResult(prev => {
        if (!prev) return prev;
        if (prev.phase === 'issuing' || prev.phase === 'preparing' || prev.phase === 'settling') {
          return { ...prev, phase: 'stopped', message: `Stopped: ${reason || 'User interaction'}` };
        }
        return prev;
      });
      testModeRef.current = 'idle';
    }
  }, []);

  const finalizeTestResult = useCallback((reason: string, front: PageSurfaceFrontInfoV2 | null) => {
    if (deadlineTimerRef.current !== null) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    const snap = testSnapshotRef.current;
    const expected = expectedTargetRef.current;
    if (!snap || !expected) return;

    const cDelta = statsRef.current.completed - snap.completed;
    const cxDelta = statsRef.current.cancelled - snap.cancelled;
    const sDelta = statsRef.current.stale - snap.stale;
    const eDelta = statsRef.current.errors - snap.errors;
    const swapDelta = statsRef.current.swaps - snap.swaps;

    const requestedCount = requestsIssuedRef.current;
    const renderEventDelta = cDelta + cxDelta + sDelta + eDelta;
    const coalescedEstimate = Math.max(0, requestedCount - renderEventDelta);
    const swapSkippedEstimate = Math.max(0, cDelta - swapDelta);
    const supersededEvidenceCount = cxDelta + sDelta + coalescedEstimate + swapSkippedEstimate;

    let nextPhase: StressTestPhaseV2 = 'failed';
    let msg = 'Failed';
    let pMatch = false, sMatch = false, oMatch = false, genMatch = false;

    if (front && expected) {
      pMatch = front.pageNumber === expected.pageNumber;
      sMatch = Math.abs(front.cssScale - expected.cssScale) < 0.005;
      oMatch = Math.abs(front.outputScale - expected.outputScale) < 0.005;
      genMatch = front.generation === engineGeneration;
    }
    const finalTargetMatched = pMatch && sMatch && oMatch;

    if (reason === 'timeout') {
      msg = 'Failed: 최종 Front swap 시간 초과 (3000ms deadline).';
    } else if (eDelta > 0) {
      msg = 'Failed: 렌더 오류 발생';
    } else if (!front) {
      msg = 'Failed: No front canvas.';
    } else if (!finalTargetMatched) {
      if (!pMatch) msg = 'Failed: 최종 페이지 불일치';
      else if (!sMatch) msg = 'Failed: 최종 배율 불일치';
      else msg = 'Failed: 최종 outputScale 불일치';
    } else if (!genMatch) {
      msg = 'Failed: Generation 불일치';
    } else if (cDelta === 0) {
      msg = 'Failed: completed delta 0';
    } else if (swapDelta === 0) {
      msg = 'Failed: swap delta 0';
    } else if (supersededEvidenceCount === 0) {
      nextPhase = 'inconclusive';
      msg = '최종 화면은 정상이나 요청 병합, swap 차단, engine cancelled 또는 stale 결과가 확인되지 않아 경쟁 조건 검증이 충분하지 않습니다.';
      console.info('[Mio V2 Renderer Lab] stress-inconclusive');
    } else {
      nextPhase = 'passed';
      const reasons = [];
      if (cxDelta > 0) reasons.push('Engine cancellation 확인');
      if (sDelta > 0) reasons.push('Engine stale 결과 확인');
      if (coalescedEstimate > 0) reasons.push('렌더 시작 전 요청 병합 추정 확인');
      if (swapSkippedEstimate > 0) reasons.push('completed 결과의 swap 생략 추정 확인');
      msg = `경쟁 조건 검증 통과 (${reasons.join(', ')})`;
      console.info('[Mio V2 Renderer Lab] stress-passed');
    }

    const passReason = nextPhase === 'passed' ? msg : null;

    setTestResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        phase: nextPhase,
        message: msg,
        actualFront: front,
        completedDelta: cDelta,
        cancelledDelta: cxDelta,
        staleDelta: sDelta,
        errorDelta: eDelta,
        swapDelta: swapDelta,
        finishedAt: Date.now(),
        renderEventDelta,
        coalescedEstimate,
        swapSkippedEstimate,
        supersededEvidenceCount,
        finalTargetMatched,
        generationMatched: genMatch,
        passReason
      };
    });

    console.info(`[Mio V2 Renderer Lab] stress-ended: events=${renderEventDelta} coalesced=${coalescedEstimate} skipped=${swapSkippedEstimate} evidence=${supersededEvidenceCount} match=${finalTargetMatched} gen=${genMatch} passReason=${passReason}`);

    testModeRef.current = 'idle';
  }, [engineGeneration]);

  const initStressTest = useCallback((mode: StressTestModeV2, page: number, scale: number) => { cancelScaleHandoffChain('initStressTest');
    gestureRef.current?.resetTransform();
    stopStressTest('start_new');
    const runId = ++stressRunIdRef.current;
    
    testSnapshotRef.current = { ...statsRef.current };
    testStartMsRef.current = Date.now();
    requestsIssuedRef.current = 0;
    issuingCompleteRef.current = false;
    testModeRef.current = mode;

    setErrorMessage('');
    
    let intervalMs = 0;
    let reqCount = 0;
    if (mode === 'scale-cancellation') {
      intervalMs = SCALE_CANCEL_INTERVAL_MS;
      reqCount = SCALE_CANCEL_COUNT + 1;
      expectedTargetRef.current = { pageNumber: page, cssScale: SCALE_CANCEL_FINAL_TARGET.cssScale, outputScale: SCALE_CANCEL_OUTPUT_SCALE };
    } else {
      intervalMs = PAGE_RACE_INTERVAL_MS;
      reqCount = PAGE_RACE_COUNT + 1;
      expectedTargetRef.current = { pageNumber: page + PAGE_RACE_FINAL_TARGET.pageOffset, cssScale: PAGE_RACE_FINAL_TARGET.cssScale, outputScale: PAGE_RACE_OUTPUT_SCALE };
    }

    setTestResult({
      mode,
      phase: 'preparing',
      requestedCount: reqCount,
      intervalMs,
      expectedTarget: expectedTargetRef.current,
      actualFront: null,
      completedDelta: 0,
      cancelledDelta: 0,
      staleDelta: 0,
      errorDelta: 0,
      swapDelta: 0,
      startedAt: testStartMsRef.current,
      finishedAt: null,
      message: 'Preparing...',
      renderEventDelta: 0,
      coalescedEstimate: 0,
      swapSkippedEstimate: 0,
      supersededEvidenceCount: 0,
      finalTargetMatched: false,
      generationMatched: false,
      passReason: null
    });

    setOutputScale(mode === 'scale-cancellation' ? SCALE_CANCEL_OUTPUT_SCALE : PAGE_RACE_OUTPUT_SCALE);
    setPageNumber(page);
    setCssScale(scale);

    prepTimerRef.current = window.setTimeout(() => {
      if (runId !== stressRunIdRef.current || !mountedRef.current) return;
      setTestResult(prev => prev ? { ...prev, phase: 'issuing', message: 'Issuing requests...' } : null);
      
      if (mode === 'scale-cancellation') {
        console.info('[Mio V2 Renderer Lab] stress-scale-cancellation-start');
        runScaleCancellationLoop(runId);
      } else {
        console.info('[Mio V2 Renderer Lab] stress-page-scale-race-start');
        runPageScaleRaceLoop(runId, page);
      }
    }, 50);
  }, [stopStressTest]);

  const runScaleCancellationLoop = useCallback((runId: number) => {
    const nextStep = () => {
      if (runId !== stressRunIdRef.current || !mountedRef.current) return;
      
      const idx = requestsIssuedRef.current;
      if (idx >= SCALE_CANCEL_COUNT) {
        setCssScale(SCALE_CANCEL_FINAL_TARGET.cssScale);
        requestsIssuedRef.current++;
        issuingCompleteRef.current = true;
        console.info('[Mio V2 Renderer Lab] stress-issuing-complete');
        setTestResult(prev => prev ? { ...prev, phase: 'settling', message: 'Settling...' } : null);
        deadlineTimerRef.current = window.setTimeout(() => {
          if (runId !== stressRunIdRef.current || !mountedRef.current) return;
          finalizeTestResult('timeout', statsRef.current.front);
        }, 3000);
        return;
      }

      const seqIdx = idx % SCALE_CANCEL_SEQ.length;
      setCssScale(SCALE_CANCEL_SEQ[seqIdx]);
      requestsIssuedRef.current++;
      console.info(`[Mio V2 Renderer Lab] stress-request scale ${SCALE_CANCEL_SEQ[seqIdx]}`);
      
      stressTimerRef.current = window.setTimeout(nextStep, SCALE_CANCEL_INTERVAL_MS);
    };
    nextStep();
  }, [finalizeTestResult]);

  const runPageScaleRaceLoop = useCallback((runId: number, basePage: number) => {
    const nextStep = () => {
      if (runId !== stressRunIdRef.current || !mountedRef.current) return;
      
      const idx = requestsIssuedRef.current;
      if (idx >= PAGE_RACE_COUNT) {
        setPageNumber(basePage + PAGE_RACE_FINAL_TARGET.pageOffset);
        setCssScale(PAGE_RACE_FINAL_TARGET.cssScale);
        requestsIssuedRef.current++;
        issuingCompleteRef.current = true;
        console.info('[Mio V2 Renderer Lab] stress-issuing-complete');
        setTestResult(prev => prev ? { ...prev, phase: 'settling', message: 'Settling...' } : null);
        deadlineTimerRef.current = window.setTimeout(() => {
          if (runId !== stressRunIdRef.current || !mountedRef.current) return;
          finalizeTestResult('timeout', statsRef.current.front);
        }, 3000);
        return;
      }

      const seqObj = PAGE_RACE_SEQ[idx % PAGE_RACE_SEQ.length];
      setPageNumber(basePage + seqObj.pageOffset);
      setCssScale(seqObj.scale);
      requestsIssuedRef.current++;
      console.info(`[Mio V2 Renderer Lab] stress-request page ${basePage + seqObj.pageOffset} scale ${seqObj.scale}`);
      
      stressTimerRef.current = window.setTimeout(nextStep, PAGE_RACE_INTERVAL_MS);
    };
    nextStep();
  }, [finalizeTestResult]);

  const handleStartScaleCancelTest = () => {
    if (!docReady || !engineRef.current || numPages < 1) return;
    initStressTest('scale-cancellation', pageNumber, 1);
  };

  const handleStartPageRaceTest = () => {
    if (!docReady || !engineRef.current) return;
    if (numPages < 2) {
      setTestResult({
        mode: 'page-scale-race',
        phase: 'inconclusive',
        requestedCount: 0,
        intervalMs: 0,
        expectedTarget: null,
        actualFront: null,
        completedDelta: 0, cancelledDelta: 0, staleDelta: 0, errorDelta: 0, swapDelta: 0,
        startedAt: Date.now(), finishedAt: Date.now(),
        message: '페이지·배율 경쟁 테스트에는 2페이지 이상의 PDF가 필요합니다.',
        renderEventDelta: 0, coalescedEstimate: 0, swapSkippedEstimate: 0, supersededEvidenceCount: 0,
        finalTargetMatched: false, generationMatched: false, passReason: null
      });
      return;
    }
    const basePage = pageNumber + 1 <= numPages ? pageNumber : pageNumber - 1;
    initStressTest('page-scale-race', basePage, 1);
  };

  const manualIntervention = () => {
    if (testModeRef.current !== 'idle') {
      stopStressTest('manual-intervention');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    gestureRef.current?.resetTransform();
    stopStressTest('new-file');

    const seq = ++loadSequenceRef.current;
    setIsLoading(true);
    setErrorMessage('');
    setDocReady(false);
    setTestResult(null);

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
          setEngineGeneration(result.generation);
          setDocReady(true);
        } else if (result.status === 'error') {
          setErrorMessage('Load failed');
        } else {
          // stale
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
    
    e.target.value = '';
  };

  const handleZoomOut = () => { cancelScaleHandoffChain('handleZoomOut'); manualIntervention(); setCssScale((p) => Math.max(0.5, p - 0.25)); };
  const handleZoomIn = () => { cancelScaleHandoffChain('handleZoomIn'); manualIntervention(); setCssScale((p) => Math.min(2.0, p + 0.25)); };
  const handleZoomReset = () => { cancelScaleHandoffChain('handleZoomReset'); manualIntervention(); setCssScale(1); };

  const handlePrevPage = () => { cancelScaleHandoffChain('handlePrevPage'); manualIntervention(); setPageNumber((p) => Math.max(1, p - 1)); };
  const handleNextPage = () => { cancelScaleHandoffChain('handleNextPage'); manualIntervention(); setPageNumber((p) => Math.min(numPages, p + 1)); };

  const handleOutputScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => { cancelScaleHandoffChain('handleOutputScaleChange');
    gestureRef.current?.resetTransform();
    manualIntervention();
    const val = parseFloat(e.target.value);
    if (val === 1 || val === 1.5 || val === 2) {
      setOutputScale(val);
    }
  };

  const resetStats = () => { cancelScaleHandoffChain('resetStats');
    stopStressTest('reset-stats');
    setCompletedCount(0);
    setCancelledCount(0);
    setStaleCount(0);
    setErrorCount(0);
    setSwapCount(0);
    setRecentEvents([]);
    statsRef.current = { completed: 0, cancelled: 0, stale: 0, errors: 0, swaps: 0, front: statsRef.current.front };
  };

  const handleRenderError = useCallback((err: unknown) => {
    updateStats('errors', 1);
    const msg = err instanceof Error ? err.message : String(err);
    setErrorMessage(`Render error: ${msg}`);
    const ev: LabRenderEvent = {
      timestamp: Date.now(),
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
  }, [updateStats]);

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
              <div className="p-2 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded break-all max-h-24 overflow-auto">
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
                  {testResult && (testResult.phase === 'preparing' || testResult.phase === 'issuing' || testResult.phase === 'settling') ? (
                    <button onClick={() => stopStressTest()} className="px-3 py-1 bg-red-900/50 text-red-200 rounded hover:bg-red-800/60 text-sm font-bold border border-red-500/20">
                      테스트 중지
                    </button>
                  ) : (
                    <>
                      <button onClick={handleStartScaleCancelTest} className="px-3 py-1 bg-brand/20 text-brand-light rounded hover:bg-brand/30 text-sm border border-brand/20">
                        빠른 확대 취소 테스트
                      </button>
                      <button onClick={handleStartPageRaceTest} className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded hover:bg-purple-800/40 text-sm border border-purple-500/30">
                        페이지·배율 경쟁 테스트
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-h-[500px] bg-stone-950 border border-white/5 rounded-xl overflow-hidden flex items-center justify-center relative">
            {docReady && engineRef.current ? (
              <GestureViewportV2 
                ref={gestureRef}
                minPreviewScale={minPreviewScale}
                maxPreviewScale={maxPreviewScale}
                onTransformChange={setGestureEvent}
                onGestureEnd={handleGestureEnd}
                className="w-full h-full"
              >
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
              </GestureViewportV2>
            ) : (
              <div className="text-stone-600 text-sm">PDF를 선택해주세요</div>
            )}
          </div>
        </div>

        {/* Right/Bottom Column: Stats & Logs */}
        <div className="w-full md:w-80 flex flex-col gap-4">

          {/* Stress Test Result */}
          {testResult && (
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-2 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${
                testResult.phase === 'passed' ? 'bg-green-500' :
                testResult.phase === 'failed' ? 'bg-red-500' :
                testResult.phase === 'inconclusive' ? 'bg-yellow-500' :
                testResult.phase === 'stopped' ? 'bg-stone-500' : 'bg-brand'
              }`} />
              <div className="pl-2">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-sm font-bold text-stone-300">Stress Test Result</h2>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    testResult.phase === 'passed' ? 'bg-green-900/40 text-green-400' :
                    testResult.phase === 'failed' ? 'bg-red-900/40 text-red-400' :
                    testResult.phase === 'inconclusive' ? 'bg-yellow-900/40 text-yellow-400' :
                    testResult.phase === 'stopped' ? 'bg-stone-800 text-stone-400' : 'bg-brand/20 text-brand-light animate-pulse'
                  }`}>
                    {testResult.phase}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 space-y-1">
                  <p>Mode: <span className="text-stone-300 font-medium">{testResult.mode}</span></p>
                  <p>Interval: <span className="text-stone-300">{testResult.intervalMs}ms</span> | Req: <span className="text-stone-300">{testResult.requestedCount}</span></p>
                  
                  {testResult.expectedTarget && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-stone-500 mb-0.5">Expected Final Target:</p>
                      <p>Page: {testResult.expectedTarget.pageNumber} | Scale: {testResult.expectedTarget.cssScale} | Out: {testResult.expectedTarget.outputScale}</p>
                    </div>
                  )}

                  {testResult.phase !== 'preparing' && testResult.phase !== 'issuing' && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-stone-500 mb-1">Results:</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                        <div>Completed: <span className={testResult.completedDelta > 0 ? "text-green-400" : ""}>{testResult.completedDelta}</span></div>
                        <div>Swap: <span className={testResult.swapDelta > 0 ? "text-brand-light" : ""}>{testResult.swapDelta}</span></div>
                        <div>Engine Cancelled: <span className={testResult.cancelledDelta > 0 ? "text-yellow-400" : ""}>{testResult.cancelledDelta}</span></div>
                        <div>Engine Stale: <span className={testResult.staleDelta > 0 ? "text-yellow-400" : ""}>{testResult.staleDelta}</span></div>
                        <div>Render Events: <span>{testResult.renderEventDelta}</span></div>
                        <div>Errors: <span className={testResult.errorDelta > 0 ? "text-red-400" : ""}>{testResult.errorDelta}</span></div>
                      </div>
                      
                      <p className="text-stone-500 mt-2 mb-1">Estimates & Evidence:</p>
                      <div className="text-[10px] space-y-1">
                        <div className="flex flex-col">
                          <div className="flex justify-between">
                            <span>Coalesced Estimate:</span>
                            <span className={testResult.coalescedEstimate > 0 ? "text-blue-400 font-bold" : ""}>{testResult.coalescedEstimate}</span>
                          </div>
                          <span className="text-[8px] text-stone-600 leading-tight">Lab에서 발행했지만 실제 render event로 이어지지 않은 요청의 추정치</span>
                        </div>
                        <div className="flex flex-col mt-1">
                          <div className="flex justify-between">
                            <span>Swap Skipped Estimate:</span>
                            <span className={testResult.swapSkippedEstimate > 0 ? "text-purple-400 font-bold" : ""}>{testResult.swapSkippedEstimate}</span>
                          </div>
                          <span className="text-[8px] text-stone-600 leading-tight">Completed됐지만 최신 Front로 교체되지 않은 결과의 추정치</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-white/5 pt-1 mt-1">
                          <span>Superseded Evidence:</span>
                          <span className={testResult.supersededEvidenceCount > 0 ? "text-green-400" : ""}>{testResult.supersededEvidenceCount}</span>
                        </div>
                      </div>

                      <p className="text-stone-500 mt-2 mb-1">Final Validation:</p>
                      <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                        <div>Target Match: <span className={testResult.finalTargetMatched ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{testResult.finalTargetMatched ? "Yes" : "No"}</span></div>
                        <div>Gen Match: <span className={testResult.generationMatched ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{testResult.generationMatched ? "Yes" : "No"}</span></div>
                      </div>
                      {testResult.passReason && (
                        <div className="mt-2 text-[10px] text-green-400 font-bold break-words whitespace-pre-wrap">
                          Pass Reason: {testResult.passReason}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {testResult.startedAt && testResult.finishedAt && (
                    <p className="mt-2 pt-2 border-t border-white/5 text-stone-500">
                      Duration: {testResult.finishedAt - testResult.startedAt}ms
                    </p>
                  )}

                  <div className="mt-2 text-[10px] leading-relaxed text-stone-300 p-1.5 bg-stone-950 rounded break-words">
                    {testResult.message}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gesture Preview */}
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-stone-300">Gesture Preview</h2>
               <button onClick={() => gestureRef.current?.resetTransform()} className="text-[10px] bg-stone-800 px-2 py-1 rounded hover:bg-stone-700">CSS 미리보기 초기화</button>
            </div>
            {gestureEvent ? (
              <div className="text-xs text-stone-400 space-y-1 bg-stone-950 p-2 rounded">
                <p>Phase: <span className="text-stone-200">{gestureEvent.phase}</span></p>
                <p>Active Pointers: {gestureEvent.activePointerCount}</p>
                <p>Preview Scale: {gestureEvent.transform.scale.toFixed(3)}</p>
                <p>Effective Scale: <span className="text-brand-light font-bold">{(cssScale * gestureEvent.transform.scale).toFixed(3)}</span></p>
                <p>Translate: {gestureEvent.transform.translateX.toFixed(1)}px, {gestureEvent.transform.translateY.toFixed(1)}px</p>
                <p>Pointer Moves: {gestureEvent.pointerMoveCount}</p>
                <p>Applied Frames: {gestureEvent.appliedFrameCount}</p>
                <p>Max Frame Gap: {gestureEvent.maxFrameGapMs.toFixed(1)}ms</p>
                <p className="text-[10px] text-yellow-500/80 mt-2 border-t border-white/5 pt-1">
                  * CSS 제스처 중에는 PDF Render Stats가 증가하지 않아야 합니다.
                </p>
              </div>
            ) : (
              <div className="text-xs text-stone-500 bg-stone-950 p-2 rounded">
                제스처 입력 없음
                <p className="text-[10px] text-yellow-500/80 mt-2 border-t border-white/5 pt-1">
                  * CSS 제스처 중에는 PDF Render Stats가 증가하지 않아야 합니다.
                </p>
              </div>
            )}
          </div>

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


          {/* Continuous Handoff Chain */}
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-2">
            <h2 className="text-sm font-bold text-stone-300">Continuous Handoff Chain</h2>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-stone-400">
              <div>Phase: <span className="text-stone-300 font-mono">{chainPhase}</span></div>
              <div>Chain ID: <span className="text-stone-300 font-mono">{chainInfo.chainId}</span></div>
              <div>Commit Idx: <span className="text-stone-300 font-mono">{chainInfo.commitIndex}</span></div>
              <div>Pending: {pendingHandoffRef.current ? <span className="text-yellow-400 font-mono">Yes (ID: {pendingHandoffRef.current.snapshot.snapshotId})</span> : <span className="text-stone-500">None</span>}</div>
              <div className="col-span-2">
                Deferred: {chainInfo.deferred ? 
                  <span className="text-purple-400 font-mono">Yes (ID: {chainInfo.deferred.deferredId}, Effective: {chainInfo.deferred.effectiveScaleAtEnd.toFixed(3)}, Replaced: {chainInfo.deferred.replacedCount})</span> : 
                  <span className="text-stone-500">None</span>}
              </div>
            </div>
            {chainPhase === 'deferred' && <div className="text-[10px] text-purple-400">현재 handoff 완료 후 최신 확대 의도를 이어서 적용합니다.</div>}
            {chainPhase === 'chaining' && <div className="text-[10px] text-blue-400">이전 Front swap 완료 후 다음 PDF 배율 handoff를 시작했습니다.</div>}
            {chainPhase === 'completed' && <div className="text-[10px] text-green-400">최신 사용자 배율까지 연속 handoff가 완료됐습니다.</div>}
            {chainPhase === 'cancelled' && <div className="text-[10px] text-red-400">Manual cancel에 의해 handoff chain이 초기화됐습니다.</div>}
          </div>

          {/* Handoff Log */}
          {handoffResults.length > 0 && (
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
              <h2 className="text-sm font-bold text-stone-300">Scale Handoff Log</h2>
              <div className="space-y-1">
                {handoffResults.map((r) => (
                  <div key={r.id} className="text-[10px] bg-stone-950 p-2 rounded border border-white/[0.02]">
                    <div className="flex justify-between mb-1">
                      <span className={
                        r.status === 'APPLIED' || r.status === 'CHAIN_COMPLETED' ? 'text-green-400 font-bold' :
                        r.status === 'RENDERED' || r.status === 'DEFERRED' ? 'text-yellow-400 font-bold' :
                        r.status === 'CHAINED_COMMIT' || r.status === 'ACTIVE_REBASED' ? 'text-blue-400 font-bold' :
                        r.status === 'DEFERRED_REPLACED' || r.status === 'COALESCED' ? 'text-purple-400 font-bold' :
                        r.status === 'ERROR' || r.status === 'CANCELLED' ? 'text-red-400 font-bold' : 'text-stone-400 font-bold'
                      }>
                        [{r.status}]
                      </span>
                      <span className="text-stone-500">{new Date(r.timestamp).toISOString().split('T')[1].replace('Z', '')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-stone-400">
                      <div>Session ID: {r.gestureSessionId}</div>
                      <div>Handoff ID: {r.handoffId}</div>
                      <div>Source: {r.sourceCssScale.toFixed(3)}</div>
                      <div>Preview: {r.previewScaleAtCommit.toFixed(3)}</div>
                      <div>Target (Raw): {r.rawTargetCssScale.toFixed(3)}</div>
                      <div>Target (Clamped): {r.clampedTargetCssScale.toFixed(3)} {r.wasScaleClamped && <span className="text-yellow-400">(Clamped)</span>}</div>
                      {r.targetRenderRequestId && <div>Req ID: {r.targetRenderRequestId}</div>}
                      {r.resultPreviewScale !== null && <div>Result Scale: {r.resultPreviewScale.toFixed(4)}</div>}
                      {r.resultTranslateX !== null && <div>Result Tx: {r.resultTranslateX.toFixed(1)}</div>}
                      {r.resultTranslateY !== null && <div>Result Ty: {r.resultTranslateY.toFixed(1)}</div>}
                      <div>Completed Δ: {r.completedDelta}</div>
                      <div>Swap Δ: {r.swapDelta}</div>
                    </div>
                    <div className="text-stone-500 mt-1">{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
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
