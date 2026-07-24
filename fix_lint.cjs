const fs = require('fs');

// 1. GestureViewportV2.tsx import
let gv = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');
const importSearch = `  GestureEndReasonV2,
  GestureScaleHandoffSnapshotV2,
  GestureScaleHandoffResultV2
} from './gestureTypes';`;
const importReplace = `  GestureEndReasonV2,
  GestureScaleHandoffSnapshotV2,
  GestureScaleHandoffResultV2,
  GestureActiveSessionRebaseV2
} from './gestureTypes';`;
gv = gv.replace(importSearch, importReplace);
fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', gv);

// 2. V2RendererLab.tsx move cancelScaleHandoffChain down
let lab = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');
// remove it from where it is
const cancelFunc = `  const cancelScaleHandoffChain = useCallback((reason: string) => {
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
  }, []);\n\n`;

lab = lab.replace(cancelFunc, "");

// find a good place to insert it (e.g. after the refs are defined, maybe just before stopStressTest)
const insertTarget = `  const stopStressTest = useCallback((reason?: string) => {`;
lab = lab.replace(insertTarget, cancelFunc + insertTarget);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', lab);
