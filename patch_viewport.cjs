const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

// 1. Add transformRevisionRef
const refTarget = "const snapshotIdCounterRef = useRef(0);";
const refNew = "const snapshotIdCounterRef = useRef(0);\n    const transformRevisionRef = useRef(0);";
content = content.replace(refTarget, refNew);

// 2. emitEvent update
const emitTarget = `
    const emitEvent = useCallback(() => {
      if (!onTransformChange) return;
      onTransformChange({
        phase: phaseRef.current,
        transform: { ...transformRef.current },
        activePointerCount: pointersRef.current.size,
        pointerMoveCount: pointerMoveCountRef.current,
        appliedFrameCount: appliedFrameCountRef.current,
        maxFrameGapMs: maxFrameGapMsRef.current,
      });
    }, [onTransformChange]);
`;
const emitNew = `
    const emitEvent = useCallback(() => {
      if (!onTransformChange) return;
      onTransformChange({
        phase: phaseRef.current,
        transform: { ...transformRef.current },
        activePointerCount: pointersRef.current.size,
        pointerMoveCount: pointerMoveCountRef.current,
        appliedFrameCount: appliedFrameCountRef.current,
        maxFrameGapMs: maxFrameGapMsRef.current,
        sessionId: phaseRef.current !== 'idle' ? sessionIdRef.current : null,
        transformRevision: transformRevisionRef.current,
      });
    }, [onTransformChange]);
`;
content = content.replace(emitTarget.trim(), emitNew.trim());

fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
