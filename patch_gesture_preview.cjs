const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const previewOld = `          {/* Gesture Preview */}
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-stone-300">Gesture Preview</h2>
               <button onClick={() => gestureRef.current?.resetTransform()} className="text-[10px] bg-stone-800 px-2 py-1 rounded hover:bg-stone-700">CSS 미리보기 초기화</button>
            </div>
            {gestureEvent ? (
              <div className="text-xs text-stone-400 space-y-1 bg-stone-950 p-2 rounded">
                <p>Phase: <span className="text-stone-200">{gestureEvent.phase}</span></p>
                <p>Active Pointers: {gestureEvent.activePointerCount}</p>
                <p>Preview Scale: {gestureEvent.transform.scale.toFixed(3)}</p>
                <p>Effective Scale: <span className="text-brand-light font-bold">{(cssScale * gestureEvent.transform.scale).toFixed(3)}</span></p>
                <p>Translate: {gestureEvent.transform.translateX.toFixed(1)}px, {gestureEvent.transform.translateY.toFixed(1)}px</p>
                <p>Pointer Moves: {gestureEvent.pointerMoveCount}</p>
                <p>Applied Frames: {gestureEvent.appliedFrameCount}</p>
                <p>Max Frame Gap: {gestureEvent.maxFrameGapMs.toFixed(1)}ms</p>
                <p className="text-[10px] text-yellow-500/80 mt-2 border-t border-white/5 pt-1">
                  * CSS 제스처 중에는 PDF Render Stats가 증가하지 않아야 합니다.
                </p>
              </div>
            ) : (
              <div className="text-xs text-stone-500 bg-stone-950 p-2 rounded">
                제스처 입력 없음
                <p className="text-[10px] text-yellow-500/80 mt-2 border-t border-white/5 pt-1">
                  * 화면에 두 손가락을 대고 확대/축소해 보세요.
                </p>
              </div>
            )}`;

const previewNew = `          {/* Gesture Preview */}
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-stone-300">Gesture Preview</h2>
               <button onClick={() => gestureRef.current?.resetTransform()} className="text-[10px] bg-stone-800 px-2 py-1 rounded hover:bg-stone-700">CSS 미리보기 초기화</button>
            </div>
            {gestureEvent ? (
              <div className="text-xs text-stone-400 space-y-1 bg-stone-950 p-2 rounded">
                <p>Phase: <span className="text-stone-200">{gestureEvent.phase}</span></p>
                <p>Active Pointers: {gestureEvent.activePointerCount}</p>
                <p>PDF Scale: {cssScale.toFixed(3)}</p>
                <p>Preview Scale: {gestureEvent.transform.scale.toFixed(3)}</p>
                <p>Effective Scale: <span className="text-brand-light font-bold">{(cssScale * gestureEvent.transform.scale).toFixed(3)}</span></p>
                <p>허용 범위: <span className="text-stone-300">100%~300%</span></p>
                <p>Transform Revision: {gestureEvent.transformRevision}</p>
                <p>마지막 Pinch Anchor: {(lastGestureEndEventRef && lastGestureEndEventRef.current && lastGestureEndEventRef.current.lastPinchViewportX !== null) ? \`X: \${lastGestureEndEventRef.current.lastPinchViewportX.toFixed(1)}, Y: \${lastGestureEndEventRef.current.lastPinchViewportY.toFixed(1)}\` : 'N/A'}</p>
                <p>Translate: {gestureEvent.transform.translateX.toFixed(1)}px, {gestureEvent.transform.translateY.toFixed(1)}px</p>
              </div>
            ) : (
              <div className="text-xs text-stone-500 bg-stone-950 p-2 rounded">
                제스처 입력 없음
                <p className="mt-1">PDF Scale: {cssScale.toFixed(3)}</p>
                <p>허용 범위: <span className="text-stone-300">100%~300%</span></p>
                <p className="text-[10px] text-yellow-500/80 mt-2 border-t border-white/5 pt-1">
                  * 화면에 두 손가락을 대고 확대/축소해 보세요.
                </p>
              </div>
            )}`;

content = content.replace(previewOld, previewNew);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
