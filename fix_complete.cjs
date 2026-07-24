const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

const completeEndTarget = `      transformRef.current = { ...newTransform };
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

const completeEndNew = `      if (isNaN(newTransform.translateX) || isNaN(newTransform.translateY) || isNaN(newTransform.scale) || !isFinite(newTransform.scale) || newTransform.scale <= 0) {
        // Error, fallback to current
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

content = content.replace(completeEndTarget, completeEndNew);
fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
