const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const uiNew = `
          {/* Continuous Handoff Chain */}
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-2">
            <h2 className="text-sm font-bold text-stone-300">Continuous Handoff Chain</h2>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-stone-400">
              <div>Phase: <span className="text-stone-300 font-mono">{chainPhase}</span></div>
              <div>Chain ID: <span className="text-stone-300 font-mono">{chainInfo.chainId}</span></div>
              <div>Commit Idx: <span className="text-stone-300 font-mono">{chainInfo.commitIndex}</span></div>
              <div>Pending: {pendingHandoffRef.current ? <span className="text-yellow-400 font-mono">Yes (ID: {pendingHandoffRef.current.snapshot.snapshotId})</span> : <span className="text-stone-500">None</span>}</div>
              <div className="col-span-2">
                Deferred: {chainInfo.deferred ? 
                  <span className="text-purple-400 font-mono">Yes (ID: {chainInfo.deferred.deferredId}, Effective: {chainInfo.deferred.effectiveScaleAtEnd.toFixed(3)}, Replaced: {chainInfo.deferred.replacedCount})</span> : 
                  <span className="text-stone-500">None</span>}
              </div>
            </div>
            {chainPhase === 'deferred' && <div className="text-[10px] text-purple-400">현재 handoff 완료 후 최신 확대 의도를 이어서 적용합니다.</div>}
            {chainPhase === 'chaining' && <div className="text-[10px] text-blue-400">이전 Front swap 완료 후 다음 PDF 배율 handoff를 시작했습니다.</div>}
            {chainPhase === 'completed' && <div className="text-[10px] text-green-400">최신 사용자 배율까지 연속 handoff가 완료됐습니다.</div>}
            {chainPhase === 'cancelled' && <div className="text-[10px] text-red-400">Manual cancel에 의해 handoff chain이 초기화됐습니다.</div>}
          </div>
`;

content = content.replace("          {/* Handoff Log */}", uiNew + "\n          {/* Handoff Log */}");
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
