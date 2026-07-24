const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const interfaceStr = `
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
  status: 'COMMIT' | 'RENDERED' | 'APPLIED' | 'SKIPPED' | 'CANCELLED' | 'ERROR';
}
`;

content = content.replace("interface PendingScaleHandoffV2", interfaceStr + "\ninterface PendingScaleHandoffV2");

content = content.replace(
  "const [handoffResults, setHandoffResults] = useState<GestureScaleHandoffResultV2[]>([]);",
  "const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);"
);

// update handleGestureEnd
content = content.replace(
  "setCssScale(clampedTargetCssScale);\n  }, [cssScale]);",
  `    const newHandoff: ScaleHandoffInfoV2 = {
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
    setHandoffResults(prev => [newHandoff, ...prev].slice(0, 20));
    setCssScale(clampedTargetCssScale);
  }, [cssScale]);`
);

// update addEvent
content = content.replace(
  "console.log(`[Mio V2 4B Hardening] target-render-completed: req ${ev.surfaceRequestId}`);\n         }",
  `console.log(\`[Mio V2 4B Hardening] target-render-completed: req \${ev.surfaceRequestId}\`);
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
         }`
);

// update handleSwap
content = content.replace(
  "setHandoffResults(prev => [result, ...prev].slice(0, 20));",
  `setHandoffResults(prev => prev.map(h => {
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
           }));`
);


// update render block
const oldLog = `
          {/* Handoff Log */}
          {handoffResults.length > 0 && (
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
              <h2 className="text-sm font-bold text-stone-300">Scale Handoff Log</h2>
              <div className="space-y-1">
                {handoffResults.map((r, i) => (
                  <div key={r.completedAt + i} className="text-[10px] bg-stone-950 p-2 rounded border border-white/[0.02]">
                    <div className="flex justify-between">
                      <span className={r.status === 'applied' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        [{r.status.toUpperCase()}]
                      </span>
                      <span className="text-stone-500">{new Date(r.completedAt).toISOString().split('T')[1].replace('Z', '')}</span>
                    </div>
                    <div className="text-stone-400 mt-1">Ratio: {r.baseScaleRatio.toFixed(3)}</div>
                    <div className="text-stone-500">Norm Scale: {r.transform.scale.toFixed(3)}</div>
                    <div className="text-stone-500">
                      Norm Translate: {r.transform.translateX.toFixed(1)}, {r.transform.translateY.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
`;

const newLog = `
          {/* Handoff Log */}
          {handoffResults.length > 0 && (
            <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
              <h2 className="text-sm font-bold text-stone-300">Scale Handoff Log</h2>
              <div className="space-y-1">
                {handoffResults.map((r) => (
                  <div key={r.id} className="text-[10px] bg-stone-950 p-2 rounded border border-white/[0.02]">
                    <div className="flex justify-between mb-1">
                      <span className={r.status === 'APPLIED' ? 'text-green-400 font-bold' : r.status === 'RENDERED' ? 'text-yellow-400 font-bold' : r.status === 'ERROR' ? 'text-red-400 font-bold' : 'text-stone-400 font-bold'}>
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
                      <div>Completed \u0394: {r.completedDelta}</div>
                      <div>Swap \u0394: {r.swapDelta}</div>
                    </div>
                    <div className="text-stone-500 mt-1">{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
`;

content = content.replace(oldLog.trim(), newLog.trim());

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
