const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

// remove cancelScaleHandoffChain from wherever it is currently
const cancelFuncReg = /  const cancelScaleHandoffChain = useCallback\(\(reason: string\) => {[\s\S]*?\}, \[\]\);\n\n/;
content = content.replace(cancelFuncReg, "");

// insert it right after the refs and state definition
const insertTarget = `  const visualBaseScale = pendingHandoffRef.current ? pendingHandoffRef.current.baseCssScale : cssScale;`;
const cancelFunc = `
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
    console.log(\`[Mio V2 4B Hardening] chain cancelled: \${reason}\`);
  }, []);
`;
content = content.replace(insertTarget, insertTarget + cancelFunc);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
