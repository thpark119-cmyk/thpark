import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  GesturePhaseV2,
  GesturePointerV2,
  GestureTransformEventV2,
  GestureTransformV2,
  GestureViewportV2Handle,
  GestureEndEventV2,
  GestureEndReasonV2,
  GestureScaleHandoffSnapshotV2,
  GestureScaleHandoffResultV2,
  GestureScaleHandoffStatusV2,
  GestureActiveSessionRebaseV2
} from './gestureTypes';

export interface GestureViewportV2Props {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  visualBaseScale: number;
  minEffectiveScale?: number;
  maxEffectiveScale?: number;
  onTransformChange?: (event: GestureTransformEventV2) => void;
  onGestureEnd?: (event: GestureEndEventV2) => void;
}

export const GestureViewportV2 = forwardRef<GestureViewportV2Handle, GestureViewportV2Props>(
  ({ children, className = '', ariaLabel, visualBaseScale, minEffectiveScale = 1, maxEffectiveScale = 3, onTransformChange, onGestureEnd }, ref) => {
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
    const sessionHadPinchRef = useRef(false);
    const snapshotIdCounterRef = useRef(0);
    const transformRevisionRef = useRef(0);
    const lastPinchAnchorRef = useRef<{
      viewportX: number;
      viewportY: number;
      sessionId: number;
      transformRevision: number;
    } | null>(null);

    // Hardening 4B
    const sessionIdRef = useRef(0);
    const endEventCounterRef = useRef(0);
    const lastEmittedSessionIdRef = useRef<number | null>(null);
    const limitsRef = useRef({ minEffective: minEffectiveScale, maxEffective: maxEffectiveScale, visualBase: visualBaseScale });
    limitsRef.current = { minEffective: minEffectiveScale, maxEffective: maxEffectiveScale, visualBase: visualBaseScale };

    const clampPreviewByEffectiveScaleV2 = useCallback((scale: number, visualBase: number, minEffective: number, maxEffective: number) => {
       if (!isFinite(scale) || scale <= 0) return 1;
       if (!isFinite(visualBase) || visualBase <= 0) return scale;
       
       let minE = minEffective;
       let maxE = maxEffective;
       if (!isFinite(minE) || minE <= 0) minE = 1;
       if (!isFinite(maxE) || maxE <= 0) maxE = 3;
       if (minE > maxE) { minE = 1; maxE = 3; }
       
       const minPreview = minE / visualBase;
       const maxPreview = maxE / visualBase;
       
       return Math.min(Math.max(scale, minPreview), maxPreview);
    }, []);

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
        sessionId: phaseRef.current !== 'idle' ? sessionIdRef.current : null,
        transformRevision: transformRevisionRef.current,
      });
    }, [onTransformChange]);

    const emitGestureEnd = useCallback((reason: GestureEndReasonV2, prevPhase: GesturePhaseV2) => {
      const currentSessionId = sessionIdRef.current;
      if (lastEmittedSessionIdRef.current === currentSessionId) {
        console.log(`[Mio V2 4B Hardening] duplicate-gesture-end-blocked for session ${currentSessionId}`);
        return;
      }
      lastEmittedSessionIdRef.current = currentSessionId;
      endEventCounterRef.current++;
      
      console.log(`[Mio V2 4B Hardening] gesture-end-emitted: session ${currentSessionId}, endEventId ${endEventCounterRef.current}, reason ${reason}`);
      
      let lastPinchViewportX = null;
      let lastPinchViewportY = null;
      
      if (sessionHadPinchRef.current && lastPinchAnchorRef.current && lastPinchAnchorRef.current.sessionId === currentSessionId) {
        lastPinchViewportX = lastPinchAnchorRef.current.viewportX;
        lastPinchViewportY = lastPinchAnchorRef.current.viewportY;
      }
      
      if (onGestureEnd) {
        onGestureEnd({
          sessionId: currentSessionId,
          endEventId: endEventCounterRef.current,
          reason,
          previousPhase: prevPhase,
          hadPinch: sessionHadPinchRef.current,
          lastPinchViewportX,
          lastPinchViewportY,
          transformRevision: transformRevisionRef.current,
          transform: { ...transformRef.current },
          activePointerCount: pointersRef.current.size,
          pointerMoveCount: pointerMoveCountRef.current,
          appliedFrameCount: appliedFrameCountRef.current,
          endedAt: Date.now()
        });
      }
      sessionHadPinchRef.current = false;
      pointerMoveCountRef.current = 0;
      appliedFrameCountRef.current = 0;
    }, [onGestureEnd]);

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
        transformRevisionRef.current++;
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

    const cancelActiveGesture = useCallback((reason: GestureEndReasonV2 = 'imperative-cancel') => {
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
      const prevPhase = phaseRef.current;
      if (phaseRef.current !== 'idle') {
        phaseRef.current = 'idle';
        emitEvent();
        emitGestureEnd(reason, prevPhase);
      }
    }, [flushPendingTransform, emitEvent, emitGestureEnd]);

    const resetTransform = useCallback(() => {
      cancelActiveGesture();
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      const safeScale = clampPreviewByEffectiveScaleV2(1, limitsRef.current.visualBase, limitsRef.current.minEffective, limitsRef.current.maxEffective);
      const t = { scale: safeScale, translateX: 0, translateY: 0 };
      transformRef.current = { ...t };
      pendingTransformRef.current = null;
      updateTransformStyle(t);
      transformRevisionRef.current++;
      emitEvent();
    }, [cancelActiveGesture, updateTransformStyle, emitEvent, clampPreviewByEffectiveScaleV2]);

    const prepareScaleHandoff = useCallback((sourceVisualBaseScale: number, anchorViewportX?: number, anchorViewportY?: number): GestureScaleHandoffSnapshotV2 | null => {
      flushPendingTransform();
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
      if (!viewportRect || !tLayerRect) return null;

      const layoutWidth = transformLayerRef.current.offsetWidth;
      const layoutHeight = transformLayerRef.current.offsetHeight;
      if (layoutWidth === 0 || layoutHeight === 0) return null;

      const visualRect = {
        left: tLayerRect.left - viewportRect.left,
        top: tLayerRect.top - viewportRect.top,
        width: tLayerRect.width,
        height: tLayerRect.height
      };

      const originX = tLayerRect.left - viewportRect.left - transformRef.current.translateX;
      const originY = tLayerRect.top - viewportRect.top - transformRef.current.translateY;

      let effectiveAnchorX = viewportRect.width / 2;
      let effectiveAnchorY = viewportRect.height / 2;
      if (anchorViewportX !== undefined && anchorViewportY !== undefined && isFinite(anchorViewportX) && isFinite(anchorViewportY)) {
        effectiveAnchorX = anchorViewportX;
        effectiveAnchorY = anchorViewportY;
      }

      const anchorLocalX = (effectiveAnchorX - originX - transformRef.current.translateX) / transformRef.current.scale;
      const anchorLocalY = (effectiveAnchorY - originY - transformRef.current.translateY) / transformRef.current.scale;

      if (!isFinite(anchorLocalX) || !isFinite(anchorLocalY)) return null;

      return {
        snapshotId: ++snapshotIdCounterRef.current,
        transformRevision: transformRevisionRef.current,
        originX,
        originY,
        anchorViewportX: effectiveAnchorX,
        anchorViewportY: effectiveAnchorY,
        anchorLocalX,
        anchorLocalY,
        visualRect,
        sourceLayoutWidth: layoutWidth,
        sourceLayoutHeight: layoutHeight,
        sourceVisualBaseScale,
        transform: { ...transformRef.current },
        capturedAt: Date.now()
      };
    }, [flushPendingTransform]);


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
          const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
          const centerX = (p1.clientX + p2.clientX) / 2;
          const centerY = (p1.clientY + p2.clientY) / 2;

          let newOriginX = pinchSessionRef.current.originX;
          let newOriginY = pinchSessionRef.current.originY;
          
          let focalX = 0;
          let focalY = 0;
          if (viewportRect && tLayerRect) {
            newOriginX = tLayerRect.left - viewportRect.left - newTransform.translateX;
            newOriginY = tLayerRect.top - viewportRect.top - newTransform.translateY;
            focalX = (centerX - viewportRect.left - newOriginX - newTransform.translateX) / newTransform.scale;
            focalY = (centerY - viewportRect.top - newOriginY - newTransform.translateY) / newTransform.scale;
          }

          pinchSessionRef.current = {
            pointerIds: [p1.pointerId, p2.pointerId],
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

    const completeScaleHandoff = useCallback((snapshot: GestureScaleHandoffSnapshotV2, sourceVisualBaseScale: number, targetVisualBaseScale: number): GestureScaleHandoffResultV2 => {
      const baseScaleRatio = targetVisualBaseScale / sourceVisualBaseScale;
      if (!isFinite(baseScaleRatio) || baseScaleRatio <= 0 || !isFinite(sourceVisualBaseScale) || sourceVisualBaseScale <= 0 || !isFinite(targetVisualBaseScale) || targetVisualBaseScale <= 0) {
        return {
          status: 'invalid',
          wasScaleClamped: false,
          unclampedPreviewScale: transformRef.current.scale,
          clampedPreviewScale: transformRef.current.scale,
          effectiveScaleAfter: targetVisualBaseScale * transformRef.current.scale,
          transform: { ...transformRef.current },
          baseScaleRatio,
          previousOriginX: snapshot.originX,
          previousOriginY: snapshot.originY,
          nextOriginX: snapshot.originX,
          nextOriginY: snapshot.originY,
          previousVisualRect: null,
          nextVisualRect: null,
          visualDeltaLeft: 0,
          visualDeltaTop: 0,
          visualDeltaWidth: 0,
          visualDeltaHeight: 0,
          completedAt: Date.now(),
          activeSessionRebase: null
        };
      }

      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      pendingTransformRef.current = null;

      const viewportRect = viewportRef.current?.getBoundingClientRect();
      const tLayerRect = transformLayerRef.current?.getBoundingClientRect();
      
      let nextOriginX = snapshot.originX;
      let nextOriginY = snapshot.originY;

      if (viewportRect && tLayerRect) {
        nextOriginX = tLayerRect.left - viewportRect.left - transformRef.current.translateX;
        nextOriginY = tLayerRect.top - viewportRect.top - transformRef.current.translateY;
      }

      const layoutWidth = transformLayerRef.current?.offsetWidth || 0;
      const layoutHeight = transformLayerRef.current?.offsetHeight || 0;

      if (layoutWidth === 0 || layoutHeight === 0 || snapshot.visualRect.width === 0 || snapshot.visualRect.height === 0) {
        return {
          status: 'invalid',
          wasScaleClamped: false,
          unclampedPreviewScale: transformRef.current.scale,
          clampedPreviewScale: transformRef.current.scale,
          effectiveScaleAfter: targetVisualBaseScale * transformRef.current.scale,
          transform: { ...transformRef.current },
          baseScaleRatio,
          previousOriginX: snapshot.originX,
          previousOriginY: snapshot.originY,
          nextOriginX,
          nextOriginY,
          previousVisualRect: null,
          nextVisualRect: null,
          visualDeltaLeft: 0,
          visualDeltaTop: 0,
          visualDeltaWidth: 0,
          visualDeltaHeight: 0,
          completedAt: Date.now(),
          activeSessionRebase: null
        };
      }

      const scaleFromWidth = snapshot.visualRect.width / layoutWidth;
      const scaleFromHeight = snapshot.visualRect.height / layoutHeight;
      let unclampedPreviewScale = scaleFromWidth;

      let nextPreviewScale = clampPreviewByEffectiveScaleV2(unclampedPreviewScale, targetVisualBaseScale, limitsRef.current.minEffective, limitsRef.current.maxEffective);
      
      // Hard floor reconciliation
      let effectiveScaleAfter = targetVisualBaseScale * nextPreviewScale;
      if (effectiveScaleAfter < 1 - 0.0005) {
         nextPreviewScale = clampPreviewByEffectiveScaleV2(1 / targetVisualBaseScale, targetVisualBaseScale, limitsRef.current.minEffective, limitsRef.current.maxEffective);
         effectiveScaleAfter = targetVisualBaseScale * nextPreviewScale;
      }

      let wasScaleClamped = unclampedPreviewScale !== nextPreviewScale;

      const nextTranslateX = snapshot.visualRect.left - nextOriginX;
      const nextTranslateY = snapshot.visualRect.top - nextOriginY;

      const newTransform = {
        scale: nextPreviewScale,
        translateX: nextTranslateX,
        translateY: nextTranslateY
      };

      transformRef.current = newTransform;
      updateTransformStyle(newTransform);
      transformRevisionRef.current++;
      const activeSessionRebase = rebaseActiveGestureSessionV2(transformRef.current);
      
      // Measure new visual rect
      const newTLayerRect = transformLayerRef.current?.getBoundingClientRect();
      const newVisualRect = newTLayerRect && viewportRect ? {
        left: newTLayerRect.left - viewportRect.left,
        top: newTLayerRect.top - viewportRect.top,
        width: newTLayerRect.width,
        height: newTLayerRect.height
      } : { ...snapshot.visualRect };
      
      const visualDeltaLeft = newVisualRect.left - snapshot.visualRect.left;
      const visualDeltaTop = newVisualRect.top - snapshot.visualRect.top;
      const visualDeltaWidth = newVisualRect.width - snapshot.visualRect.width;
      const visualDeltaHeight = newVisualRect.height - snapshot.visualRect.height;
      
      let status: GestureScaleHandoffStatusV2 = 'applied';
      if (Math.abs(visualDeltaLeft) > 1.5 || Math.abs(visualDeltaTop) > 1.5 || Math.abs(visualDeltaWidth) > 1.5 || Math.abs(visualDeltaHeight) > 1.5) {
         status = 'invalid';
      }

      emitEvent();

      return {
        status,
        wasScaleClamped,
        unclampedPreviewScale,
        clampedPreviewScale: nextPreviewScale,
        effectiveScaleAfter,
        transform: { ...transformRef.current },
        baseScaleRatio,
        previousOriginX: snapshot.originX,
        previousOriginY: snapshot.originY,
        nextOriginX,
        nextOriginY,
        previousVisualRect: snapshot.visualRect,
        nextVisualRect: newVisualRect,
        visualDeltaLeft,
        visualDeltaTop,
        visualDeltaWidth,
        visualDeltaHeight,
        completedAt: Date.now(),
        activeSessionRebase
      };
    }, [updateTransformStyle, emitEvent, clampPreviewByEffectiveScaleV2, rebaseActiveGestureSessionV2]);

    useImperativeHandle(ref, () => ({
      resetTransform,
      getTransform: () => ({ ...transformRef.current }),
      getPhase: () => phaseRef.current,
      cancelActiveGesture,
      prepareScaleHandoff,
      completeScaleHandoff
    }));

    useEffect(() => {
      limitsRef.current = { minEffective: minEffectiveScale, maxEffective: maxEffectiveScale, visualBase: visualBaseScale };
      const currentScale = transformRef.current.scale;
      const clamped = clampPreviewByEffectiveScaleV2(currentScale, visualBaseScale, minEffectiveScale, maxEffectiveScale);
      if (Math.abs(currentScale - clamped) > 0.0005) {
        scheduleTransform({
          ...transformRef.current,
          scale: clamped
        });
      }
    }, [visualBaseScale, minEffectiveScale, maxEffectiveScale, clampPreviewByEffectiveScaleV2, scheduleTransform]);

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
        if (document.visibilityState === 'hidden') {
           cancelActiveGesture('visibility-hidden');
        } else if (document.activeElement !== document.body) {
           cancelActiveGesture('window-blur');
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
      sessionHadPinchRef.current = true;

      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) return;

      const dx = ptr1.clientX - ptr2.clientX;
      const dy = ptr1.clientY - ptr2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) return; // ignore too small pinch

      const startCenterX = (ptr1.clientX + ptr2.clientX) / 2;
      const startCenterY = (ptr1.clientY + ptr2.clientY) / 2;
      
      const currentCenterX = startCenterX - viewportRect.left;
      const currentCenterY = startCenterY - viewportRect.top;
      
      lastPinchAnchorRef.current = {
        viewportX: currentCenterX,
        viewportY: currentCenterY,
        sessionId: sessionIdRef.current,
        transformRevision: transformRevisionRef.current
      };

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
          sessionIdRef.current++;
          prevFrameTimeRef.current = 0;
          maxFrameGapMsRef.current = 0;
          pointerMoveCountRef.current = 0;
          appliedFrameCountRef.current = 0;
          sessionHadPinchRef.current = false;
          console.log(`[Mio V2 4B Hardening] gesture-session-start: ${sessionIdRef.current}`);
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
          
          lastPinchAnchorRef.current = {
            viewportX: currentCenterX,
            viewportY: currentCenterY,
            sessionId: sessionIdRef.current,
            transformRevision: transformRevisionRef.current
          };

          let newScale = pinchSessionRef.current.startScale * dist / pinchSessionRef.current.startDistance;
          if (!isFinite(newScale) || newScale <= 0) return;
          newScale = clampPreviewByEffectiveScaleV2(newScale, limitsRef.current.visualBase, limitsRef.current.minEffective, limitsRef.current.maxEffective);

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
    }, [scheduleTransform, clampPreviewByEffectiveScaleV2]);

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

      const prevPhase = phaseRef.current;
      let ended = false;

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
          ended = true;
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
            ended = true;
          }
        }
      }

      if (ended) {
         let reason: GestureEndReasonV2 = 'pointer-up';
         if (e.type === 'pointercancel') reason = 'pointer-cancel';
         else if (e.type === 'lostpointercapture') reason = 'lost-pointer-capture';
         emitGestureEnd(reason, prevPhase);
      }
    }, [flushPendingTransform, startPanSession, emitEvent, emitGestureEnd]);

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
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '12px'
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
