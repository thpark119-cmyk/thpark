import React, { useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import type { 
  AnnotationPageSpaceV2, 
  AnnotationInteractionModeV2,
  AnnotationCompletedStrokeV2,
  AnnotationStrokeDraftV2,
  AnnotationInputStatusV2,
  AnnotationNormalizedPointV2,
  AnnotationDrawingPointerTypeV2
} from './annotationTypesV2';
import {
  isValidAnnotationPageSpaceV2,
  annotationNormalizedToLogicalV2,
  annotationClientToNormalizedV2
} from './annotationCoordinatesV2';

interface AnnotationSurfaceV2Props {
  pageSpace: AnnotationPageSpaceV2;
  interactionMode: AnnotationInteractionModeV2;
  completedStrokes: AnnotationCompletedStrokeV2[];
  onStrokeComplete: (stroke: AnnotationStrokeDraftV2) => void;
  onInputStatusChange: (status: AnnotationInputStatusV2) => void;
  isGestureActive: boolean;
}

export function AnnotationSurfaceV2({ 
  pageSpace, 
  interactionMode, 
  completedStrokes, 
  onStrokeComplete, 
  onInputStatusChange, 
  isGestureActive 
}: AnnotationSurfaceV2Props) {
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

    // Draw completed strokes for current page
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ef4444'; // Red

    completedStrokes.forEach(stroke => {
      if (stroke.documentInstanceId !== pageSpace.documentInstanceId || stroke.pageNumber !== pageSpace.pageNumber) {
        return;
      }
      const points = stroke.points;
      if (points.length === 0) return;

      ctx.beginPath();
      const firstLogical = annotationNormalizedToLogicalV2(points[0], pageSpace);
      if (firstLogical) {
        ctx.moveTo(firstLogical.x, firstLogical.y);
        if (points.length === 1) {
          ctx.lineTo(firstLogical.x, firstLogical.y);
        } else {
          for (let i = 1; i < points.length; i++) {
            const logical = annotationNormalizedToLogicalV2(points[i], pageSpace);
            if (logical) {
              ctx.lineTo(logical.x, logical.y);
            }
          }
        }
        ctx.stroke();
      }
    });

    // Reset transform again just in case
    ctx.setTransform(1, 0, 0, 1, 0, 0);

  }, [pageSpace, completedStrokes]);

  const suppressTouchUntilReleaseRef = useRef(false);
  const expectedLostCaptureIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      expectedLostCaptureIdsRef.current.clear();
    };
  }, []);

  const safeReleaseCapture = useCallback((pointerId: number) => {
    if (canvasRef.current) {
      try {
        if (canvasRef.current.hasPointerCapture(pointerId)) {
          expectedLostCaptureIdsRef.current.add(pointerId);
          canvasRef.current.releasePointerCapture(pointerId);
        }
      } catch {
        expectedLostCaptureIdsRef.current.delete(pointerId);
      }
    }
  }, []);

  const activePointerRef = useRef<{
    pointerId: number;
    pointerType: AnnotationDrawingPointerTypeV2;
    documentInstanceId: number;
    pageNumber: number;
    points: AnnotationNormalizedPointV2[];
  } | null>(null);

  const cleanupPointer = useCallback(() => {
    const active = activePointerRef.current;
    if (!active) return;
    
    const draft: AnnotationStrokeDraftV2 = {
      documentInstanceId: active.documentInstanceId,
      pageNumber: active.pageNumber,
      pointerType: active.pointerType,
      points: [...active.points]
    };
    
    activePointerRef.current = null;
    safeReleaseCapture(active.pointerId);

    onInputStatusChange({
      phase: 'idle',
      activePointerId: null,
      activePointerType: null,
      currentPointCount: 0,
      touchSuppressedUntilRelease: suppressTouchUntilReleaseRef.current
    });
    
    onStrokeComplete(draft);
  }, [onInputStatusChange, onStrokeComplete, safeReleaseCapture]);

  const handoffToViewport = useCallback((pointerId: number) => {
    suppressTouchUntilReleaseRef.current = true;
    
    if (canvasRef.current) {
      expectedLostCaptureIdsRef.current.add(pointerId);
    }
    
    activePointerRef.current = null;
    
    onInputStatusChange({
      phase: 'idle',
      activePointerId: null,
      activePointerType: null,
      currentPointCount: 0,
      touchSuppressedUntilRelease: true
    });
  }, [onInputStatusChange]);

  const discardPointer = useCallback(() => {
    const active = activePointerRef.current;
    if (!active) return;
    
    activePointerRef.current = null;
    safeReleaseCapture(active.pointerId);

    onInputStatusChange({
      phase: 'idle',
      activePointerId: null,
      activePointerType: null,
      currentPointCount: 0,
      touchSuppressedUntilRelease: suppressTouchUntilReleaseRef.current
    });
  }, [onInputStatusChange, safeReleaseCapture]);

  useEffect(() => {
    return () => {
      const active = activePointerRef.current;
      if (active) {
        activePointerRef.current = null;
        if (canvasRef.current) {
          try {
            if (canvasRef.current.hasPointerCapture(active.pointerId)) {
              canvasRef.current.releasePointerCapture(active.pointerId);
            }
          } catch {
            // Pointer capture may already be released.
          }
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isGestureActive && suppressTouchUntilReleaseRef.current) {
      suppressTouchUntilReleaseRef.current = false;
      expectedLostCaptureIdsRef.current.clear();
      onInputStatusChange({
        phase: 'idle',
        activePointerId: null,
        activePointerType: null,
        currentPointCount: 0,
        touchSuppressedUntilRelease: false
      });
    }
  }, [isGestureActive, onInputStatusChange]);

  useEffect(() => {
    if (activePointerRef.current) {
       const active = activePointerRef.current;
       if (active.documentInstanceId !== pageSpace.documentInstanceId || 
           active.pageNumber !== pageSpace.pageNumber || 
           interactionMode !== 'pen') {
          suppressTouchUntilReleaseRef.current = false;
          expectedLostCaptureIdsRef.current.clear();
          discardPointer();
       }
    } else {
       if (interactionMode !== 'pen') {
          suppressTouchUntilReleaseRef.current = false;
          expectedLostCaptureIdsRef.current.clear();
       }
    }
  }, [pageSpace.documentInstanceId, pageSpace.pageNumber, interactionMode, discardPointer]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionMode !== 'pen') return;

    if (e.pointerType === 'touch') {
      if (suppressTouchUntilReleaseRef.current) {
        return;
      }
      
      const active = activePointerRef.current;
      if (active) {
        if (active.pointerType === 'touch') {
          handoffToViewport(active.pointerId);
        }
        return;
      }
      
      if (isGestureActive) return;
    } else {
      if (isGestureActive) return;
      if (activePointerRef.current) return;
    }

    let drawingPointerType: AnnotationDrawingPointerTypeV2;
    if (e.pointerType === 'mouse' && e.button === 0) {
      drawingPointerType = 'mouse';
    } else if (e.pointerType === 'pen' && e.button === 0) {
      drawingPointerType = 'pen';
    } else if (e.pointerType === 'touch') {
      drawingPointerType = 'touch';
    } else {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const normalized = annotationClientToNormalizedV2({ x: e.clientX, y: e.clientY }, rect);
    
    if (!normalized) return;

    if (e.pointerType !== 'touch') {
      e.stopPropagation();
    }
    
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        return;
      }
    } catch {
      return;
    }

    activePointerRef.current = {
      pointerId: e.pointerId,
      pointerType: drawingPointerType,
      documentInstanceId: pageSpace.documentInstanceId,
      pageNumber: pageSpace.pageNumber,
      points: [normalized]
    };

    onInputStatusChange({
      phase: 'drawing',
      activePointerId: e.pointerId,
      activePointerType: drawingPointerType,
      currentPointCount: 1,
      touchSuppressedUntilRelease: suppressTouchUntilReleaseRef.current
    });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const logical = annotationNormalizedToLogicalV2(normalized, pageSpace);
      if (logical) {
        const backingWidth = Math.max(1, Math.round(pageSpace.logicalWidth));
        const backingHeight = Math.max(1, Math.round(pageSpace.logicalHeight));
        const scaleX = backingWidth / pageSpace.logicalWidth;
        const scaleY = backingHeight / pageSpace.logicalHeight;
        
        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ef4444';
        
        ctx.beginPath();
        ctx.moveTo(logical.x, logical.y);
        ctx.lineTo(logical.x, logical.y);
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    if (e.pointerType !== 'touch') {
      e.stopPropagation();
    }

    if (active.documentInstanceId !== pageSpace.documentInstanceId || active.pageNumber !== pageSpace.pageNumber) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normalized = annotationClientToNormalizedV2({ x: e.clientX, y: e.clientY }, rect);
    if (!normalized) return;

    const prevNormalized = active.points[active.points.length - 1];
    active.points.push(normalized);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const prevLogical = annotationNormalizedToLogicalV2(prevNormalized, pageSpace);
      const currLogical = annotationNormalizedToLogicalV2(normalized, pageSpace);
      
      if (prevLogical && currLogical) {
        const backingWidth = Math.max(1, Math.round(pageSpace.logicalWidth));
        const backingHeight = Math.max(1, Math.round(pageSpace.logicalHeight));
        const scaleX = backingWidth / pageSpace.logicalWidth;
        const scaleY = backingHeight / pageSpace.logicalHeight;
        
        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ef4444';
        
        ctx.beginPath();
        ctx.moveTo(prevLogical.x, prevLogical.y);
        ctx.lineTo(currLogical.x, currLogical.y);
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    
    if (e.pointerType !== 'touch') {
      e.stopPropagation();
    }
    
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const normalized = annotationClientToNormalizedV2({ x: e.clientX, y: e.clientY }, rect);
      if (normalized) {
        active.points.push(normalized);
      }
    }
    
    cleanupPointer();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    
    if (e.pointerType !== 'touch') {
      e.stopPropagation();
    }
    
    discardPointer();
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (expectedLostCaptureIdsRef.current.has(e.pointerId)) {
      expectedLostCaptureIdsRef.current.delete(e.pointerId);
      e.stopPropagation();
      return;
    }
    
    const active = activePointerRef.current;
    if (active && active.pointerId === e.pointerId) {
      discardPointer();
    }
  };

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
        pointerEvents: interactionMode === 'pen' ? 'auto' : 'none',
        touchAction: 'none',
        zIndex: 20,
        width: `${pageSpace.logicalWidth}px`,
        height: `${pageSpace.logicalHeight}px`
      }}
      data-mio-annotation-surface-v2="true"
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
    />
  );
}
