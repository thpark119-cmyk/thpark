const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

const endMatch = `      updateTransformStyle(newTransform);
      transformRevisionRef.current++;
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

const endReplace = `      updateTransformStyle(newTransform);
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

content = content.replace(endMatch, endReplace);
fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
