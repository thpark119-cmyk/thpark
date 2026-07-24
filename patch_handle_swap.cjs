const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const targetSwap = `  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
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
  }, [updateStats, checkTestSwap, pageNumber, outputScale, engineGeneration]);`;

const newSwap = `  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    updateStats('swaps', 1);
    setFrontInfo(info.nextFront);
    statsRef.current.front = info.nextFront;
    
    if (pendingHandoffRef.current) {
      const ph = pendingHandoffRef.current;

      if (ph.chainId !== chainIdCounterRef.current) {
         console.log(\`[Mio V2 4C Hardening] ignored swap from cancelled chain: \${ph.chainId}\`);
      } else {
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
                console.log(\`[Mio V2 4B Hardening] handoff-applied: ratio=\${baseScaleRatio}\`);
                const deferred = deferredIntentRef.current;
                
                // Clear pending early before generating a new one
                pendingHandoffRef.current = null;
                
                if (deferred) {
                  const currentTransform = gestureRef.current.getTransform();
                  const newSourceScale = ph.clampedTargetCssScale;
                  const newRawTarget = newSourceScale * currentTransform.scale;
                  let newClampedTarget = Math.min(Math.max(newRawTarget, MIN_COMMITTED_CSS_SCALE_V2), MAX_COMMITTED_CSS_SCALE_V2);

                  if (Math.abs(newClampedTarget - newSourceScale) < 0.005) {
                    console.log(\`[Mio V2 4C Hardening] chained-commit-skipped (coalesced)\`);
                    deferredIntentRef.current = null;
                    setChainPhase('completed');
                    setChainInfo(prev => ({ ...prev, deferred: null }));
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
                        id: \`chain-\${chainIdCounterRef.current}-\${chainCommitIndexRef.current}-session-\${deferred.gestureSessionId}-handoff-\${newSnapshot.snapshotId}\`,
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
                        status: 'COMMIT'
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
                console.log(\`[Mio V2 4B Hardening] handoff-invalid\`);
                pendingHandoffRef.current = null;
                setChainPhase('error');
            }
          } else {
            pendingHandoffRef.current = null;
            setChainPhase('error');
          }
        } else if (!ph.targetRenderCompleted) {
            console.log(\`[Mio V2 4B Hardening] completed-without-swap: waiting for match\`);
        }
      }
    }
    
    checkTestSwap(info.nextFront);
  }, [updateStats, checkTestSwap, pageNumber, outputScale, engineGeneration]);`;

content = content.replace(targetSwap, newSwap);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
