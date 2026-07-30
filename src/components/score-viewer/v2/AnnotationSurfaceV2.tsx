import React, { useRef, useLayoutEffect } from 'react';
import type { AnnotationPageSpaceV2 } from './annotationTypesV2';
import {
  isValidAnnotationPageSpaceV2,
  annotationNormalizedToLogicalV2
} from './annotationCoordinatesV2';

interface AnnotationSurfaceV2Props {
  pageSpace: AnnotationPageSpaceV2;
}

export function AnnotationSurfaceV2({ pageSpace }: AnnotationSurfaceV2Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isValidAnnotationPageSpaceV2(pageSpace)) return;

    const backingWidth = Math.max(1, Math.round(pageSpace.logicalWidth));
    const backingHeight = Math.max(1, Math.round(pageSpace.logicalHeight));

    ctx.clearRect(0, 0, backingWidth, backingHeight);

    const scaleX = backingWidth / pageSpace.logicalWidth;
    const scaleY = backingHeight / pageSpace.logicalHeight;

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // Draw bounds, center, corners
    ctx.lineWidth = 2; // Fixed line width for diagnostic
    
    // 1. Page bounds
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; // cyan
    ctx.strokeRect(1, 1, pageSpace.logicalWidth - 2, pageSpace.logicalHeight - 2);

    // 2. Center cross
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)'; // magenta
    const centerPoint = annotationNormalizedToLogicalV2({ x: 0.5, y: 0.5 }, pageSpace);
    if (centerPoint) {
      ctx.beginPath();
      ctx.moveTo(centerPoint.x - 20, centerPoint.y);
      ctx.lineTo(centerPoint.x + 20, centerPoint.y);
      ctx.moveTo(centerPoint.x, centerPoint.y - 20);
      ctx.lineTo(centerPoint.x, centerPoint.y + 20);
      ctx.stroke();
    }

    // 3. Corners
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'; // yellow
    const cornerSize = 20;
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(1, 1 + cornerSize);
    ctx.lineTo(1, 1);
    ctx.lineTo(1 + cornerSize, 1);
    // Top-Right
    ctx.moveTo(pageSpace.logicalWidth - 1 - cornerSize, 1);
    ctx.lineTo(pageSpace.logicalWidth - 1, 1);
    ctx.lineTo(pageSpace.logicalWidth - 1, 1 + cornerSize);
    // Bottom-Right
    ctx.moveTo(pageSpace.logicalWidth - 1, pageSpace.logicalHeight - 1 - cornerSize);
    ctx.lineTo(pageSpace.logicalWidth - 1, pageSpace.logicalHeight - 1);
    ctx.lineTo(pageSpace.logicalWidth - 1 - cornerSize, pageSpace.logicalHeight - 1);
    // Bottom-Left
    ctx.moveTo(1 + cornerSize, pageSpace.logicalHeight - 1);
    ctx.lineTo(1, pageSpace.logicalHeight - 1);
    ctx.lineTo(1, pageSpace.logicalHeight - 1 - cornerSize);
    ctx.stroke();

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

  }, [pageSpace]);

  if (!isValidAnnotationPageSpaceV2(pageSpace)) {
    return null;
  }

  const backingWidth = Math.max(1, Math.round(pageSpace.logicalWidth));
  const backingHeight = Math.max(1, Math.round(pageSpace.logicalHeight));

  return (
    <canvas
      ref={canvasRef}
      width={backingWidth}
      height={backingHeight}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        display: 'block',
        pointerEvents: 'none',
        touchAction: 'none',
        zIndex: 20,
        width: `${pageSpace.logicalWidth}px`,
        height: `${pageSpace.logicalHeight}px`
      }}
      data-mio-annotation-surface-v2="true"
      aria-hidden="true"
    />
  );
}
