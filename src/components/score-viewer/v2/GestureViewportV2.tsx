import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  GesturePhaseV2,
  GesturePointerV2,
  GestureTransformEventV2,
  GestureTransformV2,
  GestureViewportV2Handle
} from './gestureTypes';

export interface GestureViewportV2Props {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  minPreviewScale?: number;
  maxPreviewScale?: number;
  onTransformChange?: (event: GestureTransformEventV2) => void;
}

export const GestureViewportV2 = forwardRef<GestureViewportV2Handle, GestureViewportV2Props>(
  ({ children, className = '', ariaLabel, minPreviewScale = 0.5, maxPreviewScale = 4, onTransformChange }, ref) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const transformLayerRef = useRef<HTMLDivElement>(null);

    const transformRef = useRef<GestureTransformV2>({ scale: 1, translateX: 0, translateY: 0 });
    const pendingTransformRef = useRef<GestureTransformV2 | null>(null);
    const phaseRef = useRef<GesturePhaseV2>('idle');
    const pointersRef = useRef<Map<number, GesturePointerV2>>(new Map());
    
    // Sessions
    const panSessionRef = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      startTranslateX: number;
      startTranslateY: number;
    } | null>(null);
    
    const pinchSessionRef = useRef<{
      pointerIds: [number, number];
      startDistance: number;
      startScale: number;
      startTranslateX: number;
      startTranslateY: number;
      originX: number;
      originY: number;
      focalX: number;
      focalY: number;
    } | null>(null);

    // RAF state
    const pendingRafRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    
    // Stats
    const pointerMoveCountRef = useRef(0);
    const appliedFrameCountRef = useRef(0);
    const prevFrameTimeRef = useRef<number>(0);
    const maxFrameGapMsRef = useRef(0);

    const updateTransformStyle = useCallback((t: GestureTransformV2) => {
      if (!transformLayerRef.current) return;
      transformLayerRef.current.style.transform = `translate3d(${t.translateX}px, ${t.translateY}px, 0) scale(${t.scale})`;
    }, []);

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

    const flushPendingTransform = useCallback(() => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      if (pendingTransformRef.current) {
        const now = performance.now();
        if (prevFrameTimeRef.current > 0) {
          const gap = now - prevFrameTimeRef.current;
          if (gap > maxFrameGapMsRef.current) {
            maxFrameGapMsRef.current = gap;
          }
        }
        prevFrameTimeRef.current = now;
        
        transformRef.current = { ...pendingTransformRef.current };
        pendingTransformRef.current = null;
        updateTransformStyle(transformRef.current);
        appliedFrameCountRef.current++;
        emitEvent();
      }
    }, [updateTransformStyle, emitEvent]);

    const scheduleTransform = useCallback((t: GestureTransformV2) => {
      pendingTransformRef.current = { ...t };
      if (pendingRafRef.current === null) {
        pendingRafRef.current = requestAnimationFrame(() => {
          pendingRafRef.current = null;
          flushPendingTransform();
        });
      }
    }, [flushPendingTransform]);

    const cancelActiveGesture = useCallback(() => {
      flushPendingTransform();
      pointersRef.current.forEach((ptr, id) => {
        try {
          if (viewportRef.current?.hasPointerCapture(id)) {
            viewportRef.current.releasePointerCapture(id);
          }
        } catch (e) {
          // ignore
        }
      });
      pointersRef.current.clear();
      panSessionRef.current = null;
      pinchSessionRef.current = null;
      if (phaseRef.current !== 'idle') {
        phaseRef.current = 'idle';
        emitEvent();
      }
    }, [flushPendingTransform, emitEvent]);

    const resetTransform = useCallback(() => {
      cancelActiveGesture();
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      const t = { scale: 1, translateX: 0, translateY: 0 };
      transformRef.current = { ...t };
      pendingTransformRef.current = null;
      updateTransformStyle(t);
      emitEvent();
    }, [cancelActiveGesture, updateTransformStyle, emitEvent]);

    useImperativeHandle(ref, () => ({
      resetTransform,
      getTransform: () => ({ ...transformRef.current }),
      getPhase: () => phaseRef.current,
      cancelActiveGesture,
    }));

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current);
        }
        pendingTransformRef.current = null;
        pointersRef.current.clear();
        panSessionRef.current = null;
        pinchSessionRef.current = null;
      };
    }, []);

    useEffect(() => {
      const handleBlurOrHidden = () => {
        if (document.visibilityState === 'hidden' || document.activeElement !== document.body) {
           cancelActiveGesture();
        }
      };
      window.addEventListener('blur', handleBlurOrHidden);
      document.addEventListener('visibilitychange', handleBlurOrHidden);
      return () => {
        window.removeEventListener('blur', handleBlurOrHidden);
        document.removeEventListener('visibilitychange', handleBlurOrHidden);
      };
    }, [cancelActiveGesture]);

    const startPanSession = useCallback((ptr: GesturePointerV2) => {
      panSessionRef.current = {
        pointerId: ptr.pointerId,
        startX: ptr.clientX,
        startY: ptr.clientY,
        startTranslateX: transformRef.current.translateX,
        startTranslateY: transformRef.current.translateY
      };
      phaseRef.current = 'panning';
      emitEvent();
    }, [emitEvent]);

    const startPinchSession = useCallback((ptr1: GesturePointerV2, ptr2: GesturePointerV2) => {
      flushPendingTransform();
      panSessionRef.current = null;

      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) return;

      const dx = ptr1.clientX - ptr2.clientX;
      const dy = ptr1.clientY - ptr2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) return; // ignore too small pinch

      const startCenterX = (ptr1.clientX + ptr2.clientX) / 2;
      const startCenterY = (ptr1.clientY + ptr2.clientY) / 2;

      const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
      if (!tLayerRect) return;

      const originX = tLayerRect.left - viewportRect.left - transformRef.current.translateX;
      const originY = tLayerRect.top - viewportRect.top - transformRef.current.translateY;

      const focalX = (startCenterX - viewportRect.left - originX - transformRef.current.translateX) / transformRef.current.scale;
      const focalY = (startCenterY - viewportRect.top - originY - transformRef.current.translateY) / transformRef.current.scale;

      pinchSessionRef.current = {
        pointerIds: [ptr1.pointerId, ptr2.pointerId],
        startDistance: dist,
        startScale: transformRef.current.scale,
        startTranslateX: transformRef.current.translateX,
        startTranslateY: transformRef.current.translateY,
        originX,
        originY,
        focalX,
        focalY
      };

      phaseRef.current = 'pinching';
      emitEvent();
    }, [flushPendingTransform, emitEvent]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'pen') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      pointersRef.current.set(e.pointerId, {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY
      });

      try {
        if (viewportRef.current) {
          viewportRef.current.setPointerCapture(e.pointerId);
        }
      } catch (err) {
        // ignore
      }

      if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
        const currentPointers = Array.from<GesturePointerV2>(pointersRef.current.values()).filter(p => p.pointerType === 'touch' || p.pointerType === 'mouse');

        if (currentPointers.length === 1 && phaseRef.current === 'idle') {
          startPanSession(currentPointers[0]);
        } else if (currentPointers.length === 2 && phaseRef.current !== 'pinching') {
          startPinchSession(currentPointers[0], currentPointers[1]);
        }
      }
    }, [startPanSession, startPinchSession]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'pen') return;
      if (!pointersRef.current.has(e.pointerId)) return;

      if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
        e.preventDefault();
      }

      pointersRef.current.set(e.pointerId, {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY
      });

      pointerMoveCountRef.current++;

      if (phaseRef.current === 'panning' && panSessionRef.current && panSessionRef.current.pointerId === e.pointerId) {
        const ptr = pointersRef.current.get(e.pointerId)!;
        const dx = ptr.clientX - panSessionRef.current.startX;
        const dy = ptr.clientY - panSessionRef.current.startY;
        
        scheduleTransform({
          scale: transformRef.current.scale,
          translateX: panSessionRef.current.startTranslateX + dx,
          translateY: panSessionRef.current.startTranslateY + dy
        });
      } else if (phaseRef.current === 'pinching' && pinchSessionRef.current) {
        const [id1, id2] = pinchSessionRef.current.pointerIds;
        const ptr1 = pointersRef.current.get(id1);
        const ptr2 = pointersRef.current.get(id2);
        
        if (ptr1 && ptr2) {
          const viewportRect = viewportRef.current?.getBoundingClientRect();
          if (!viewportRect) return;

          const dx = ptr1.clientX - ptr2.clientX;
          const dy = ptr1.clientY - ptr2.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const currentCenterX = (ptr1.clientX + ptr2.clientX) / 2 - viewportRect.left;
          const currentCenterY = (ptr1.clientY + ptr2.clientY) / 2 - viewportRect.top;

          let newScale = pinchSessionRef.current.startScale * dist / pinchSessionRef.current.startDistance;
          if (!isFinite(newScale) || newScale <= 0) return;
          newScale = Math.min(Math.max(newScale, minPreviewScale), maxPreviewScale);

          const newTranslateX = currentCenterX - pinchSessionRef.current.originX - pinchSessionRef.current.focalX * newScale;
          const newTranslateY = currentCenterY - pinchSessionRef.current.originY - pinchSessionRef.current.focalY * newScale;

          if (isFinite(newTranslateX) && isFinite(newTranslateY)) {
            scheduleTransform({
              scale: newScale,
              translateX: newTranslateX,
              translateY: newTranslateY
            });
          }
        }
      }
    }, [scheduleTransform, minPreviewScale, maxPreviewScale]);

    const handlePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'pen') return;
      if (!pointersRef.current.has(e.pointerId)) return;

      pointersRef.current.delete(e.pointerId);

      try {
        if (viewportRef.current?.hasPointerCapture(e.pointerId)) {
          viewportRef.current.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        // ignore
      }

      const currentPointers = Array.from<GesturePointerV2>(pointersRef.current.values()).filter(p => p.pointerType === 'touch' || p.pointerType === 'mouse');

      if (phaseRef.current === 'pinching') {
        if (currentPointers.length === 1) {
          flushPendingTransform();
          pinchSessionRef.current = null;
          startPanSession(currentPointers[0]);
        } else if (currentPointers.length === 0) {
          flushPendingTransform();
          pinchSessionRef.current = null;
          panSessionRef.current = null;
          phaseRef.current = 'idle';
          emitEvent();
        }
      } else if (phaseRef.current === 'panning') {
        if (panSessionRef.current?.pointerId === e.pointerId) {
          flushPendingTransform();
          panSessionRef.current = null;
          if (currentPointers.length === 1) {
             startPanSession(currentPointers[0]);
          } else if (currentPointers.length === 0) {
            phaseRef.current = 'idle';
            emitEvent();
          }
        }
      }
    }, [flushPendingTransform, startPanSession, emitEvent]);

    return (
      <div
        ref={viewportRef}
        data-mio-gesture-viewport-v2="true"
        className={className}
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          touchAction: 'none',
          userSelect: 'none',
          overscrollBehavior: 'contain'
        }}
      >
        <div
          data-mio-gesture-centering-v2="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            ref={transformLayerRef}
            data-mio-gesture-transform-v2="true"
            style={{
              display: 'inline-block',
              position: 'relative',
              transformOrigin: '0 0',
              willChange: 'transform',
              transform: 'translate3d(0px, 0px, 0) scale(1)'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
);
