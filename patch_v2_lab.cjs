const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

// Update limits
content = content.replace('const MIN_COMMITTED_CSS_SCALE_V2 = 0.5;', 'const MIN_COMMITTED_CSS_SCALE_V2 = 1;');

// In V2RendererLab.tsx, we need to find lastProcessedSessionIdRef and add new refs.
const refsOld = `  const lastProcessedSessionIdRef = useRef<number | null>(null);`;
const refsNew = `  const lastProcessedSessionIdRef = useRef<number | null>(null);
  const lastAppliedGestureSessionIdRef = useRef<number | null>(null);
  const lastAppliedTransformRevisionRef = useRef<number>(0);`;
content = content.replace(refsOld, refsNew);

// Update handleGestureEnd
const handleGestureEndSearch = `  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
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
    const snapshot = gestureRef.current?.prepareScaleHandoff();`;

const handleGestureEndReplace = `  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
    if (ev.reason !== 'pointer-up' && ev.reason !== 'imperative-cancel') return;
    
    if (lastProcessedSessionIdRef.current === ev.sessionId) {
      console.log(\`[Mio V2 4B Hardening] duplicate-commit-blocked for session \${ev.sessionId}\`);
      return;
    }
    lastProcessedSessionIdRef.current = ev.sessionId;

    if (lastAppliedGestureSessionIdRef.current === ev.sessionId) {
       if (ev.transformRevision <= lastAppliedTransformRevisionRef.current) {
         console.log(\`[Mio V2 4C1 Anchor] release-without-post-rebase-move-skipped for session \${ev.sessionId}\`);
         
         const skipLog: ScaleHandoffInfoV2 = {
            id: \`chain-\${chainIdCounterRef.current}-skip-\${Date.now()}\`,
            gestureSessionId: ev.sessionId,
            handoffId: 0,
            sourceCssScale: cssScale,
            previewScaleAtCommit: 1,
            rawTargetCssScale: cssScale,
            clampedTargetCssScale: cssScale,
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
            message: 'Release without post-rebase movement skipped',
            timestamp: Date.now(),
            status: 'SKIPPED'
         };
         setHandoffResults(prev => [skipLog, ...prev].slice(0, 30));
         return;
       } else {
         console.log(\`[Mio V2 4C1 Anchor] post-rebase-move-commit for session \${ev.sessionId}\`);
       }
    }

    if (!ev.hadPinch) return;
    
    if (Math.abs(ev.transform.scale - 1) < 0.005) {
      console.log(\`[Mio V2 4B Hardening] commit-skipped (scale ~1) for session \${ev.sessionId}\`);
      return;
    }
    
    const snapshot = ev.lastPinchViewportX !== null && ev.lastPinchViewportY !== null
       ? gestureRef.current?.prepareScaleHandoff(ev.lastPinchViewportX, ev.lastPinchViewportY)
       : gestureRef.current?.prepareScaleHandoff();
       
    if (!snapshot) {
       console.log(\`[Mio V2 4C1 Anchor] invalid-anchor or snapshot failed\`);
       return;
    }
    console.log(\`[Mio V2 4C1 Anchor] handoff-anchor-captured: viewport(\${snapshot.anchorViewportX?.toFixed(1)}, \${snapshot.anchorViewportY?.toFixed(1)}) local(\${snapshot.anchorLocalX?.toFixed(1)}, \${snapshot.anchorLocalY?.toFixed(1)})\`);
    `;
content = content.replace(handleGestureEndSearch, handleGestureEndReplace);

// Update rebase logging in handleSwap
const rebaseSearch = `                if (result.activeSessionRebase && (result.activeSessionRebase.panRebased || result.activeSessionRebase.pinchRebased)) {
                    const rebaseLog: ScaleHandoffInfoV2 = {`;
const rebaseReplace = `                if (result.activeSessionRebase && (result.activeSessionRebase.panRebased || result.activeSessionRebase.pinchRebased)) {
                    lastAppliedGestureSessionIdRef.current = ph.gestureSessionId;
                    lastAppliedTransformRevisionRef.current = result.activeSessionRebase.rebaseRevision;
                    console.log(\`[Mio V2 4C1 Anchor] \${result.activeSessionRebase.panRebased ? 'active-pan-rebased' : 'active-pinch-rebased'} (revision \${result.activeSessionRebase.rebaseRevision})\`);
                    
                    const rebaseLog: ScaleHandoffInfoV2 = {`;
content = content.replace(rebaseSearch, rebaseReplace);

// Update minPreviewScale and maxPreviewScale calculation
// GestureViewportV2 usage
const vpSearch = `<GestureViewportV2
            ref={gestureRef}
            className="w-full h-full"
            ariaLabel="Score gesture viewport"
            minPreviewScale={0.5}
            maxPreviewScale={4}
            onTransformChange={handleTransformChange}
            onGestureEnd={handleGestureEnd}
          >`;
const vpReplace = `<GestureViewportV2
            ref={gestureRef}
            className="w-full h-full"
            ariaLabel="Score gesture viewport"
            minPreviewScale={MIN_COMMITTED_CSS_SCALE_V2 / visualBaseScale}
            maxPreviewScale={MAX_COMMITTED_CSS_SCALE_V2 / visualBaseScale}
            onTransformChange={handleTransformChange}
            onGestureEnd={handleGestureEnd}
          >`;
content = content.replace(vpSearch, vpReplace);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
