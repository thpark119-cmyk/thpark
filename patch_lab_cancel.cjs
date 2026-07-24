const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const targetCancel = `  const stopStressTest = useCallback((reason?: string) => {`;
const newCancel = `  const cancelScaleHandoffChain = useCallback((reason: string) => {
    chainIdCounterRef.current++; // invalidate current chain
    pendingHandoffRef.current = null;
    deferredIntentRef.current = null;
    setChainPhase('cancelled');
    setChainInfo({ chainId: chainIdCounterRef.current, commitIndex: 0, deferred: null });
    if (gestureRef.current) {
      gestureRef.current.cancelActiveGesture();
      gestureRef.current.resetTransform();
    }
    console.log(\`[Mio V2 4B Hardening] chain cancelled: \${reason}\`);
  }, []);

  const stopStressTest = useCallback((reason?: string) => {`;
content = content.replace(targetCancel, newCancel);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
