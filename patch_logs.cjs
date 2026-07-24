const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

// handleGestureEnd deferred logic
const defStart = `
      setChainPhase('deferred');
      setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: chainCommitIndexRef.current, deferred: deferredIntentRef.current });
      console.log(\`[Mio V2 4C Hardening] deferred-intent-saved: effective \${clampedEffective}\`);
      return;
`;
const defReplace = `
      setChainPhase('deferred');
      setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: chainCommitIndexRef.current, deferred: deferredIntentRef.current });
      console.log(\`[Mio V2 4C Hardening] deferred-intent-saved: effective \${clampedEffective}\`);
      
      const defLog: ScaleHandoffInfoV2 = {
        id: \`chain-\${chainIdCounterRef.current}-def-\${deferredIdCounterRef.current}\`,
        gestureSessionId: ev.sessionId,
        handoffId: pendingHandoffRef.current.snapshot.snapshotId,
        sourceCssScale: visualBase,
        previewScaleAtCommit: ev.transform.scale,
        rawTargetCssScale: effectiveScale,
        clampedTargetCssScale: clampedEffective,
        wasScaleClamped: effectiveScale !== clampedEffective,
        targetRenderCompleted: false,
        targetRenderRequestId: null,
        targetFrontSwapped: false,
        completedDelta: 0,
        swapDelta: 0,
        resultPreviewScale: null,
        resultTranslateX: null,
        resultTranslateY: null,
        durationMs: null,
        message: deferredReplacementCountRef.current > 0 ? 'Deferred intent replaced with newer one' : 'Deferred intent saved for next commit',
        timestamp: Date.now(),
        status: deferredReplacementCountRef.current > 0 ? 'DEFERRED_REPLACED' as any : 'DEFERRED' as any
      };
      setHandoffResults(prev => [defLog, ...prev].slice(0, 30));
      return;
`;
content = content.replace(defStart, defReplace);

// handleSwap logic
const swapLogStart = `
                  if (Math.abs(newClampedTarget - newSourceScale) < 0.005) {
                    console.log(\`[Mio V2 4C Hardening] chained-commit-skipped (coalesced)\`);
                    deferredIntentRef.current = null;
                    setChainPhase('completed');
                    setChainInfo(prev => ({ ...prev, deferred: null }));
                  } else {
`;
const swapLogReplace = `
                  if (Math.abs(newClampedTarget - newSourceScale) < 0.005) {
                    console.log(\`[Mio V2 4C Hardening] chained-commit-skipped (coalesced)\`);
                    deferredIntentRef.current = null;
                    setChainPhase('completed');
                    setChainInfo(prev => ({ ...prev, deferred: null }));
                    const coalescedLog: ScaleHandoffInfoV2 = {
                      id: \`chain-\${chainIdCounterRef.current}-\${chainCommitIndexRef.current}-coalesced\`,
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
`;
content = content.replace(swapLogStart, swapLogReplace);

// Chained commit log
const chainedLogStart = `                        message: 'Chained Target Render',
                        timestamp: Date.now(),
                        status: 'COMMIT'
                      };
                      setHandoffResults(prev => [newHandoff, ...prev].slice(0, 30));`;
const chainedLogReplace = `                        message: 'Chained Target Render',
                        timestamp: Date.now(),
                        status: 'CHAINED_COMMIT' as any
                      };
                      setHandoffResults(prev => [newHandoff, ...prev].slice(0, 30));`;
content = content.replace(chainedLogStart, chainedLogReplace);

// Active Rebased Log in handleSwap
const rebaseStart = `            if (result.status === 'applied') {
                console.log(\`[Mio V2 4B Hardening] handoff-applied: ratio=\${baseScaleRatio}\`);
                const deferred = deferredIntentRef.current;
                
                // Clear pending early before generating a new one
                pendingHandoffRef.current = null;`;
const rebaseReplace = `            if (result.status === 'applied') {
                console.log(\`[Mio V2 4B Hardening] handoff-applied: ratio=\${baseScaleRatio}\`);
                
                if (result.activeSessionRebase && (result.activeSessionRebase.panRebased || result.activeSessionRebase.pinchRebased)) {
                    const rebaseLog: ScaleHandoffInfoV2 = {
                      id: \`chain-\${chainIdCounterRef.current}-rebase-\${Date.now()}\`,
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
                      message: \`Active Session Rebased: \${result.activeSessionRebase.panRebased ? 'Pan' : 'Pinch'}\`,
                      timestamp: Date.now(),
                      status: 'ACTIVE_REBASED' as any
                    };
                    setHandoffResults(prev => [rebaseLog, ...prev].slice(0, 30));
                }
                
                const deferred = deferredIntentRef.current;
                
                // Clear pending early before generating a new one
                pendingHandoffRef.current = null;`;
content = content.replace(rebaseStart, rebaseReplace);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
