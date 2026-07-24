const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const interfaceStr = `
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
}
`;

content = content.replace(
  "interface LabRenderEvent {",
  interfaceStr + "\ninterface LabRenderEvent {"
);

content = content.replace(
  "const [gestureEvent, setGestureEvent] = useState<GestureTransformEventV2 | null>(null);",
  "const [gestureEvent, setGestureEvent] = useState<GestureTransformEventV2 | null>(null);\n\n  const MIN_COMMITTED_CSS_SCALE_V2 = 0.5;\n  const MAX_COMMITTED_CSS_SCALE_V2 = 3;\n  const lastProcessedSessionIdRef = useRef<number | null>(null);"
);

content = content.replace(
  "const pendingHandoffRef = useRef<{ snapshot: GestureScaleHandoffSnapshotV2; baseCssScale: number } | null>(null);",
  "const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);"
);

const newHandleGestureEnd = `
  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
    if (ev.reason !== 'pointer-up' && ev.reason !== 'imperative-cancel') return;
    
    if (lastProcessedSessionIdRef.current === ev.sessionId) {
      console.log(\`[Mio V2 4B Hardening] duplicate-commit-blocked for session \${ev.sessionId}\`);
      return;
    }
    lastProcessedSessionIdRef.current = ev.sessionId;

    if (!ev.hadPinch) return;
    
    if (Math.abs(ev.transform.scale - 1) < 0.005) {
      console.log(\`[Mio V2 4B Hardening] commit-skipped (scale ~1) for session \${ev.sessionId}\`);
      return;
    }

    const snapshot = gestureRef.current?.prepareScaleHandoff();
    if (!snapshot) return;

    const rawTargetCssScale = cssScale * ev.transform.scale;
    let clampedTargetCssScale = Math.min(Math.max(rawTargetCssScale, MIN_COMMITTED_CSS_SCALE_V2), MAX_COMMITTED_CSS_SCALE_V2);
    
    if (rawTargetCssScale > 3) {
       console.warn(\`[Mio V2 4B Hardening] effective-scale-clamped: \${rawTargetCssScale} -> \${clampedTargetCssScale}\`);
    }

    if (Math.abs(clampedTargetCssScale - cssScale) < 0.005) {
      if (cssScale <= MIN_COMMITTED_CSS_SCALE_V2 && rawTargetCssScale < cssScale) {
        console.log(\`[Mio V2 4B Hardening] commit-skipped-at-min for session \${ev.sessionId}\`);
      } else if (cssScale >= MAX_COMMITTED_CSS_SCALE_V2 && rawTargetCssScale > cssScale) {
        console.log(\`[Mio V2 4B Hardening] commit-skipped-at-max for session \${ev.sessionId}\`);
      }
      return;
    }

    console.log(\`[Mio V2 4B Hardening] commit-start: cssScale=\${cssScale} -> \${clampedTargetCssScale} (raw: \${rawTargetCssScale})\`);

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
    
    console.info(\`[Mio V2 Renderer Lab] gesture-end handoff triggered: cssScale=\${cssScale} -> \${clampedTargetCssScale}\`);
    setCssScale(clampedTargetCssScale);
  }, [cssScale]);
`;

content = content.replace(
  /const handleGestureEnd = useCallback\(\(ev: GestureEndEventV2\) => \{[\s\S]*?\}, \[cssScale\]\);/,
  newHandleGestureEnd.trim()
);

const newAddEvent = `
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
         if (
           ev.result.pageNumber === pageNumber &&
           Math.abs(ev.result.cssScale - ph.clampedTargetCssScale) < 0.005 &&
           ev.result.outputScale === outputScale &&
           ev.result.generation === engineGeneration
         ) {
           ph.targetRenderCompleted = true;
           ph.targetRenderRequestId = ev.surfaceRequestId;
           console.log(\`[Mio V2 4B Hardening] target-render-completed: req \${ev.surfaceRequestId}\`);
         }
      }
    }
    if (ev.result.status === 'cancelled') updateStats('cancelled', 1);
    if (ev.result.status === 'stale') updateStats('stale', 1);
  }, [updateStats, pageNumber, outputScale, engineGeneration]);
`;

content = content.replace(
  /const addEvent = useCallback\(\(ev: PageSurfaceRenderEventV2\) => \{[\s\S]*?\}, \[updateStats\]\);/,
  newAddEvent.trim()
);

const newHandleSwap = `
  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    updateStats('swaps', 1);
    setFrontInfo(info.nextFront);
    statsRef.current.front = info.nextFront;
    
    if (pendingHandoffRef.current) {
      const ph = pendingHandoffRef.current;
      
      const pageMatch = info.nextFront.pageNumber === pageNumber;
      const scaleMatch = Math.abs(info.nextFront.cssScale - ph.clampedTargetCssScale) < 0.005;
      const outputMatch = Math.abs(info.nextFront.outputScale - outputScale) < 0.005;
      const genMatch = info.nextFront.generation === engineGeneration;
      const reqMatch = info.nextFront.requestId === ph.targetRenderRequestId;

      if (pageMatch && scaleMatch && outputMatch && genMatch && reqMatch) {
         ph.targetFrontSwapped = true;
         console.log(\`[Mio V2 4B Hardening] target-swap-confirmed\`);
         
         const baseScaleRatio = ph.clampedTargetCssScale / ph.baseCssScale;
         
         if (gestureRef.current) {
           const result = gestureRef.current.completeScaleHandoff(ph.snapshot, baseScaleRatio);
           setHandoffResults(prev => [result, ...prev].slice(0, 20));
           
           if (result.status === 'applied') {
              console.log(\`[Mio V2 4B Hardening] handoff-applied: ratio=\${baseScaleRatio}\`);
           } else {
              console.log(\`[Mio V2 4B Hardening] handoff-invalid\`);
           }
         }
         
         pendingHandoffRef.current = null;
      } else if (!ph.targetRenderCompleted) {
          console.log(\`[Mio V2 4B Hardening] completed-without-swap: waiting for match\`);
      }
    }
    
    checkTestSwap(info.nextFront);
  }, [updateStats, checkTestSwap, pageNumber, outputScale, engineGeneration]);
`;

content = content.replace(
  /const handleSwap = useCallback\(\(info: PageSurfaceSwapInfoV2\) => \{[\s\S]*?\}, \[updateStats, checkTestSwap\]\);/,
  newHandleSwap.trim()
);

// Stop stress test should clear handoff properly
content = content.replace(
  "if (prepTimerRef.current !== null) {",
  "if (gestureRef.current) { gestureRef.current.resetTransform(); }\n    pendingHandoffRef.current = null;\n    setHandoffResults([]);\n    if (prepTimerRef.current !== null) {"
);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
