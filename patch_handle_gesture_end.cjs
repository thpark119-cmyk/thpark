const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const targetGestureEnd = `  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
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
      targetFrontSwapped: false
    };

    const newHandoff: ScaleHandoffInfoV2 = {
      id: \`session-\${ev.sessionId}-handoff-\${snapshot.snapshotId}\`,
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
    setHandoffResults(prev => [newHandoff, ...prev].slice(0, 30));
    setCssScale(clampedTargetCssScale);
  }, [cssScale]);`;

const replaceGestureEnd = `  const handleGestureEnd = useCallback((ev: GestureEndEventV2) => {
    if (ev.reason !== 'pointer-up') return;
    if (!ev.sessionId) return;
    
    if (lastProcessedSessionIdRef.current === ev.sessionId) {
      console.log(\`[Mio V2 4B Hardening] duplicate-commit-blocked for session \${ev.sessionId}\`);
      return;
    }
    lastProcessedSessionIdRef.current = ev.sessionId;

    if (!ev.hadPinch) return;

    if (pendingHandoffRef.current) {
      // Pending handoff exists -> save as deferred intent
      const visualBase = pendingHandoffRef.current.baseCssScale;
      let effectiveScale = visualBase * ev.transform.scale;
      const clampedEffective = Math.min(Math.max(effectiveScale, MIN_COMMITTED_CSS_SCALE_V2), MAX_COMMITTED_CSS_SCALE_V2);
      
      deferredIdCounterRef.current++;
      
      if (deferredIntentRef.current) {
        deferredReplacementCountRef.current++;
      } else {
        deferredReplacementCountRef.current = 0;
      }

      deferredIntentRef.current = {
        deferredId: deferredIdCounterRef.current,
        gestureSessionId: ev.sessionId,
        endEventId: ev.sessionId, // just use sessionId for now
        transformRevisionAtEnd: 0, // not strictly needed for logic
        previewScaleAtEnd: ev.transform.scale,
        effectiveScaleAtEnd: clampedEffective,
        createdAt: Date.now(),
        replacedCount: deferredReplacementCountRef.current
      };

      setChainPhase('deferred');
      setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: chainCommitIndexRef.current, deferred: deferredIntentRef.current });
      console.log(\`[Mio V2 4C Hardening] deferred-intent-saved: effective \${clampedEffective}\`);
      return;
    }

    if (Math.abs(ev.transform.scale - 1) < 0.005) {
      console.log(\`[Mio V2 4B Hardening] commit-skipped (scale ~1) for session \${ev.sessionId}\`);
      return;
    }

    chainIdCounterRef.current++;
    chainCommitIndexRef.current = 1;

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
      chainId: chainIdCounterRef.current,
      commitIndex: chainCommitIndexRef.current,
      sourceTransformRevision: snapshot.transformRevision
    };

    const newHandoff: ScaleHandoffInfoV2 = {
      id: \`chain-\${chainIdCounterRef.current}-\${chainCommitIndexRef.current}-session-\${ev.sessionId}-handoff-\${snapshot.snapshotId}\`,
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
    setHandoffResults(prev => [newHandoff, ...prev].slice(0, 30));
    setChainPhase('rendering');
    setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: chainCommitIndexRef.current, deferred: null });
    setCssScale(clampedTargetCssScale);
  }, [cssScale]);`;

content = content.replace(targetGestureEnd, replaceGestureEnd);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
