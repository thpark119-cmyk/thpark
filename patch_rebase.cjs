const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

const rebaseFunc = `
    const rebaseActiveGestureSessionV2 = useCallback((newTransform: GestureTransformV2): GestureActiveSessionRebaseV2 => {
      const result: GestureActiveSessionRebaseV2 = {
        phase: phaseRef.current,
        activePointerCount: pointersRef.current.size,
        panRebased: false,
        pinchRebased: false,
        rebaseRevision: transformRevisionRef.current
      };

      const currentPointers = Array.from<GesturePointerV2>(pointersRef.current.values()).filter(p => p.pointerType === 'touch' || p.pointerType === 'mouse');

      if (phaseRef.current === 'panning' && currentPointers.length === 1) {
        panSessionRef.current = {
          pointerId: currentPointers[0].pointerId,
          startX: currentPointers[0].clientX,
          startY: currentPointers[0].clientY,
          startTranslateX: newTransform.translateX,
          startTranslateY: newTransform.translateY
        };
        result.panRebased = true;
      } else if (phaseRef.current === 'pinching' && currentPointers.length >= 2) {
        const p1 = currentPointers[0];
        const p2 = currentPointers[1];
        const dx = p2.clientX - p1.clientX;
        const dy = p2.clientY - p1.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist >= 4) {
          const viewportRect = viewportRef.current?.getBoundingClientRect();
          const centerX = (p1.clientX + p2.clientX) / 2;
          const centerY = (p1.clientY + p2.clientY) / 2;

          let newOriginX = pinchSessionRef.current.originX;
          let newOriginY = pinchSessionRef.current.originY;
          
          let focalX = 0;
          let focalY = 0;
          if (viewportRect) {
            focalX = (centerX - viewportRect.left - newOriginX - newTransform.translateX) / newTransform.scale;
            focalY = (centerY - viewportRect.top - newOriginY - newTransform.translateY) / newTransform.scale;
          }

          pinchSessionRef.current = {
            pointerId1: p1.pointerId,
            pointerId2: p2.pointerId,
            startDistance: dist,
            startScale: newTransform.scale,
            startTranslateX: newTransform.translateX,
            startTranslateY: newTransform.translateY,
            originX: newOriginX,
            originY: newOriginY,
            focalX,
            focalY
          };
          result.pinchRebased = true;
        }
      }

      return result;
    }, []);
`;

const completeStart = `    const completeScaleHandoff = useCallback((snapshot: GestureScaleHandoffSnapshotV2, baseScaleRatio: number): GestureScaleHandoffResultV2 => {`;
content = content.replace(completeStart, rebaseFunc + "\n" + completeStart);


const completeApply = `      transformRef.current = { ...newTransform };
      updateTransformStyle(newTransform);
      emitEvent();

      return {
        status: 'applied',
        wasScaleClamped,
        unclampedPreviewScale,
        clampedPreviewScale: nextPreviewScale,
        transform: { ...newTransform },
        baseScaleRatio,
        previousOriginX: snapshot.originX,
        previousOriginY: snapshot.originY,
        nextOriginX,
        nextOriginY,
        completedAt: Date.now()
      };
    }, [updateTransformStyle, emitEvent, clampPreviewScaleV2]);`;

const completeApplyNew = `      if (isNaN(newTransform.translateX) || isNaN(newTransform.translateY) || isNaN(newTransform.scale) || !isFinite(newTransform.scale) || newTransform.scale <= 0) {
        // Fallback to old transform if error
      } else {
        transformRef.current = { ...newTransform };
        updateTransformStyle(newTransform);
      }
      transformRevisionRef.current++;
      const activeSessionRebase = rebaseActiveGestureSessionV2(transformRef.current);
      emitEvent();

      return {
        status: 'applied',
        wasScaleClamped,
        unclampedPreviewScale,
        clampedPreviewScale: nextPreviewScale,
        transform: { ...transformRef.current },
        baseScaleRatio,
        previousOriginX: snapshot.originX,
        previousOriginY: snapshot.originY,
        nextOriginX,
        nextOriginY,
        completedAt: Date.now(),
        activeSessionRebase
      };
    }, [updateTransformStyle, emitEvent, clampPreviewScaleV2, rebaseActiveGestureSessionV2]);`;

content = content.replace(completeApply, completeApplyNew);


// also fix invalid handoff return to include activeSessionRebase
const invalidReturn = `
        return {
          status: 'invalid',
          wasScaleClamped: false,
          unclampedPreviewScale: transformRef.current.scale,
          clampedPreviewScale: transformRef.current.scale,
          transform: { ...transformRef.current },
          baseScaleRatio,
          previousOriginX: snapshot.originX,
          previousOriginY: snapshot.originY,
          nextOriginX: snapshot.originX,
          nextOriginY: snapshot.originY,
          completedAt: Date.now()
        };
`;
const invalidReturnNew = `
        return {
          status: 'invalid',
          wasScaleClamped: false,
          unclampedPreviewScale: transformRef.current.scale,
          clampedPreviewScale: transformRef.current.scale,
          transform: { ...transformRef.current },
          baseScaleRatio,
          previousOriginX: snapshot.originX,
          previousOriginY: snapshot.originY,
          nextOriginX: snapshot.originX,
          nextOriginY: snapshot.originY,
          completedAt: Date.now(),
          activeSessionRebase: { phase: phaseRef.current, activePointerCount: pointersRef.current.size, panRebased: false, pinchRebased: false, rebaseRevision: transformRevisionRef.current }
        };
`;
content = content.replace(invalidReturn, invalidReturnNew);

// and update snapshot transformRevision
const prepareHandoff = `    const prepareScaleHandoff = useCallback((): GestureScaleHandoffSnapshotV2 | null => {
      flushPendingTransform();
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
      if (!viewportRect || !tLayerRect) return null;

      snapshotIdCounterRef.current++;
      return {
        snapshotId: snapshotIdCounterRef.current,
        transformRevision: 0,
        originX: tLayerRect.left - viewportRect.left - transformRef.current.translateX,
        originY: tLayerRect.top - viewportRect.top - transformRef.current.translateY,
        transform: { ...transformRef.current },
        capturedAt: Date.now()
      };
    }, [flushPendingTransform]);`;

const prepareHandoffNew = `    const prepareScaleHandoff = useCallback((): GestureScaleHandoffSnapshotV2 | null => {
      flushPendingTransform();
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
      if (!viewportRect || !tLayerRect) return null;

      snapshotIdCounterRef.current++;
      return {
        snapshotId: snapshotIdCounterRef.current,
        transformRevision: transformRevisionRef.current,
        originX: tLayerRect.left - viewportRect.left - transformRef.current.translateX,
        originY: tLayerRect.top - viewportRect.top - transformRef.current.translateY,
        transform: { ...transformRef.current },
        capturedAt: Date.now()
      };
    }, [flushPendingTransform]);`;
content = content.replace(prepareHandoff, prepareHandoffNew);

// in resetTransform
const resetTransform = `      const safeScale = clampPreviewScaleV2(1, limitsRef.current.min, limitsRef.current.max);
      const t = { scale: safeScale, translateX: 0, translateY: 0 };
      transformRef.current = { ...t };
      pendingTransformRef.current = null;
      updateTransformStyle(t);
      emitEvent();`;
const resetTransformNew = `      const safeScale = clampPreviewScaleV2(1, limitsRef.current.min, limitsRef.current.max);
      const t = { scale: safeScale, translateX: 0, translateY: 0 };
      transformRef.current = { ...t };
      pendingTransformRef.current = null;
      updateTransformStyle(t);
      transformRevisionRef.current++;
      emitEvent();`;
content = content.replace(resetTransform, resetTransformNew);

// scheduleTransform -> transformRevision doesn't need to bump for every RAF, wait, actually we are NOT bumping it on raf. Wait! We SHOULD bump it whenever the transform actually changes.
// No, the event emits the current revision. 
// "Lab이 최신 CSS transform revision을 추적할 수 있어야 한다."
// We only need to bump it when we programmatically set it (resetTransform, completeScaleHandoff). For user interactions, `transformRevision` doesn't change, we just emit the latest `transform`.

fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
