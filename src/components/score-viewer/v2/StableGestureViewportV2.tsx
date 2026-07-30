import React, { ReactNode, useRef, useImperativeHandle, useEffect, useCallback } from 'react';
import {
  STABLE_IDENTITY_TRANSFORM_V2,
  StableGesturePhaseV2,
  StableGestureTransformV2,
  StableGestureTransformEventV2,
  StableGestureViewportV2Handle
} from './stableGestureTypes';

interface Props {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  minScale?: number;
  maxScale?: number;
  onTransformChange?: (ev: StableGestureTransformEventV2) => void;
  onGestureEnd?: (ev: StableGestureTransformEventV2) => void;
}

interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pointerType: 'touch' | 'mouse';
}

interface PanSession {
  pointerId: number;
  startX: number;
  startY: number;
  startTranslateX: number;
  startTranslateY: number;
}

interface PinchSession {
  pointerIds: [number, number];
  startDistance: number;
  startMidX: number;
  startMidY: number;
  startScale: number;
  startTranslateX: number;
  startTranslateY: number;
  baseOriginX: number;
  baseOriginY: number;
  localFocalX: number;
  localFocalY: number;
}

export const StableGestureViewportV2 = React.forwardRef<StableGestureViewportV2Handle, Props>(
  ({ children, className = '', ariaLabel, minScale = 1, maxScale = 3, onTransformChange, onGestureEnd }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const transformLayerRef = useRef<HTMLDivElement>(null);
    
    const mountedRef = useRef(true);
    
    const transformRef = useRef<StableGestureTransformV2>({ ...STABLE_IDENTITY_TRANSFORM_V2 });
    const pendingTransformRef = useRef<StableGestureTransformV2 | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const prevSizeRef = useRef({ width: 0, height: 0 });
    
    const activePointersRef = useRef<Map<number, PointerInfo>>(new Map());
    const phaseRef = useRef<StableGesturePhaseV2>('idle');
    const panSessionRef = useRef<PanSession | null>(null);
    const pinchSessionRef = useRef<PinchSession | null>(null);
    
    const applyTransform = useCallback((t: StableGestureTransformV2) => {
      if (!transformLayerRef.current) return;
      transformLayerRef.current.style.transform = `translate3d(${t.translateX}px, ${t.translateY}px, 0) scale(${t.scale})`;
    }, []);
    
    const constrainTransform = useCallback((t: StableGestureTransformV2): StableGestureTransformV2 => {
      if (!rootRef.current || !transformLayerRef.current) return t;
      
      let scale = Number.isFinite(t.scale) ? t.scale : 1;
      scale = Math.max(minScale, Math.min(maxScale, scale));
      
      if (Math.abs(scale - 1) <= 0.0005) {
        return { scale: 1, translateX: 0, translateY: 0 };
      }
      
      const rootRect = { width: rootRef.current.clientWidth, height: rootRef.current.clientHeight };
      const layerWidth = transformLayerRef.current.offsetWidth;
      const layerHeight = transformLayerRef.current.offsetHeight;
      
      const currentLayerRect = transformLayerRef.current.getBoundingClientRect();
      const currentRootRect = rootRef.current.getBoundingClientRect();
      
      const baseLeft = currentLayerRect.left - currentRootRect.left - transformRef.current.translateX;
      const baseTop = currentLayerRect.top - currentRootRect.top - transformRef.current.translateY;
      
      const visualWidth = layerWidth * scale;
      const visualHeight = layerHeight * scale;
      
      const candidateTranslateX = Number.isFinite(t.translateX) ? t.translateX : 0;
      const candidateTranslateY = Number.isFinite(t.translateY) ? t.translateY : 0;
      
      const candidateLeft = baseLeft + candidateTranslateX;
      const candidateTop = baseTop + candidateTranslateY;
      
      const availableWidth = rootRect.width - 24;
      let targetLeft = candidateLeft;
      
      if (visualWidth <= availableWidth) {
         targetLeft = 12 + (availableWidth - visualWidth) / 2;
      } else {
         const minimumLeft = rootRect.width - 12 - visualWidth;
         const maximumLeft = 12;
         targetLeft = Math.max(minimumLeft, Math.min(maximumLeft, candidateLeft));
      }
      
      const availableHeight = rootRect.height - 24;
      let targetTop = candidateTop;
      
      if (visualHeight <= availableHeight) {
         targetTop = 12;
      } else {
         const minimumTop = rootRect.height - 12 - visualHeight;
         const maximumTop = 12;
         targetTop = Math.max(minimumTop, Math.min(maximumTop, candidateTop));
      }
      
      return { 
        scale, 
        translateX: targetLeft - baseLeft, 
        translateY: targetTop - baseTop 
      };
    }, [minScale, maxScale]);

    const flushPendingTransform = useCallback(() => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (pendingTransformRef.current) {
        const raw = pendingTransformRef.current;
        pendingTransformRef.current = null;
        const constrained = constrainTransform(raw);
        transformRef.current = constrained;
        applyTransform(constrained);
      }
    }, [applyTransform, constrainTransform]);

    const notifyChange = useCallback(() => {
      if (!mountedRef.current || !onTransformChange) return;
      onTransformChange({
        phase: phaseRef.current,
        transform: { ...transformRef.current },
        activePointerCount: activePointersRef.current.size
      });
    }, [onTransformChange]);

    const cleanupActiveSessions = useCallback(() => {
      flushPendingTransform();
      
      const pointers = activePointersRef.current;
      const ptrIds = Array.from(pointers.keys());
      pointers.clear();
      panSessionRef.current = null;
      pinchSessionRef.current = null;
      phaseRef.current = 'idle';
      
      if (rootRef.current) {
        ptrIds.forEach(id => {
          try { 
            if (rootRef.current?.hasPointerCapture(id)) {
              rootRef.current.releasePointerCapture(id); 
            }
          } catch (e) {}
        });
      }
    }, [flushPendingTransform]);

    useEffect(() => {
      mountedRef.current = true;
      const handleBlur = () => {
        cleanupActiveSessions();
        notifyChange();
      };
      const handleVisibilityChange = () => {
        if (document.hidden) {
          cleanupActiveSessions();
          notifyChange();
        }
      };
      window.addEventListener('blur', handleBlur);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        mountedRef.current = false;
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        cleanupActiveSessions();
      };
    }, [cleanupActiveSessions, notifyChange]);

    const scheduleTransform = useCallback((t: StableGestureTransformV2) => {
      pendingTransformRef.current = t;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (pendingTransformRef.current) {
            const raw = pendingTransformRef.current;
            pendingTransformRef.current = null;
            const constrained = constrainTransform(raw);
            transformRef.current = constrained;
            applyTransform(constrained);
          }
        });
      }
    }, [constrainTransform, applyTransform]);

    useEffect(() => {
      if (!rootRef.current) return;
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          const { width: prevWidth, height: prevHeight } = prevSizeRef.current;
          
          if (Math.abs(width - prevWidth) > 0.5 || Math.abs(height - prevHeight) > 0.5) {
            prevSizeRef.current = { width, height };
            
            cleanupActiveSessions();
            
            const currentTx = transformRef.current.translateX;
            const currentTy = transformRef.current.translateY;
            const currentScale = transformRef.current.scale;
            
            scheduleTransform({
              scale: currentScale,
              translateX: currentTx,
              translateY: currentTy
            });
          }
        }
      });
      resizeObserver.observe(rootRef.current);
      return () => {
        resizeObserver.disconnect();
      };
    }, [cleanupActiveSessions, scheduleTransform]);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'pen') return;
      
      const pointerType = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      
      if (activePointersRef.current.size === 0 && phaseRef.current !== 'idle') {
        cleanupActiveSessions();
      }
      
      if (activePointersRef.current.size >= 2) return;
      
      if (activePointersRef.current.size === 1) {
        const firstPtr = Array.from<PointerInfo>(activePointersRef.current.values())[0];
        if (firstPtr.pointerType !== 'touch' || pointerType !== 'touch') {
          return;
        }
      }
      
      activePointersRef.current.set(e.pointerId, { id: e.pointerId, clientX: e.clientX, clientY: e.clientY, pointerType });
      
      if (rootRef.current) {
        try { rootRef.current.setPointerCapture(e.pointerId); } catch (err) {}
      }
      
      flushPendingTransform();
      
      if (activePointersRef.current.size === 1) {
        phaseRef.current = 'panning';
        panSessionRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startTranslateX: transformRef.current.translateX,
          startTranslateY: transformRef.current.translateY
        };
        notifyChange();
      } else if (activePointersRef.current.size === 2) {
        const pts = Array.from<PointerInfo>(activePointersRef.current.values());
        const dx = pts[1].clientX - pts[0].clientX;
        const dy = pts[1].clientY - pts[0].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 4) {
          activePointersRef.current.delete(e.pointerId);
          if (rootRef.current) {
            try { 
              if (rootRef.current.hasPointerCapture(e.pointerId)) {
                rootRef.current.releasePointerCapture(e.pointerId); 
              }
            } catch (err) {}
          }
          return;
        }
        
        panSessionRef.current = null;
        phaseRef.current = 'pinching';
        
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        
        let baseOriginX = 0;
        let baseOriginY = 0;
        let localFocalX = 0;
        let localFocalY = 0;
        
        if (transformLayerRef.current) {
           const rect = transformLayerRef.current.getBoundingClientRect();
           baseOriginX = rect.left - transformRef.current.translateX;
           baseOriginY = rect.top - transformRef.current.translateY;
           localFocalX = (midX - rect.left) / transformRef.current.scale;
           localFocalY = (midY - rect.top) / transformRef.current.scale;
        }
        
        pinchSessionRef.current = {
          pointerIds: [pts[0].id, pts[1].id],
          startDistance: dist,
          startMidX: midX,
          startMidY: midY,
          startScale: transformRef.current.scale,
          startTranslateX: transformRef.current.translateX,
          startTranslateY: transformRef.current.translateY,
          baseOriginX,
          baseOriginY,
          localFocalX,
          localFocalY
        };
        notifyChange();
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      const pointerType = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      activePointersRef.current.set(e.pointerId, { id: e.pointerId, clientX: e.clientX, clientY: e.clientY, pointerType });
      
      if (phaseRef.current === 'panning' && panSessionRef.current) {
        if (e.pointerId !== panSessionRef.current.pointerId) return;
        const sess = panSessionRef.current;
        const nextTx = sess.startTranslateX + (e.clientX - sess.startX);
        const nextTy = sess.startTranslateY + (e.clientY - sess.startY);
        scheduleTransform({ scale: transformRef.current.scale, translateX: nextTx, translateY: nextTy });
      } else if (phaseRef.current === 'pinching' && pinchSessionRef.current) {
        const sess = pinchSessionRef.current;
        const pts = Array.from<PointerInfo>(activePointersRef.current.values());
        if (pts.length < 2) return;
        
        const dx = pts[1].clientX - pts[0].clientX;
        const dy = pts[1].clientY - pts[0].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        
        let newScale = sess.startScale;
        if (sess.startDistance > 0) {
          newScale = sess.startScale * (dist / sess.startDistance);
        }
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        
        const newTranslateX = midX - sess.baseOriginX - sess.localFocalX * newScale;
        const newTranslateY = midY - sess.baseOriginY - sess.localFocalY * newScale;
        
        scheduleTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      
      flushPendingTransform();
      
      activePointersRef.current.delete(e.pointerId);
      
      if (phaseRef.current === 'pinching') {
        pinchSessionRef.current = null;
        if (activePointersRef.current.size === 1) {
          phaseRef.current = 'panning';
          const remainingPtr = Array.from<PointerInfo>(activePointersRef.current.values())[0];
          panSessionRef.current = {
            pointerId: remainingPtr.id,
            startX: remainingPtr.clientX,
            startY: remainingPtr.clientY,
            startTranslateX: transformRef.current.translateX,
            startTranslateY: transformRef.current.translateY
          };
        } else {
          phaseRef.current = 'idle';
          panSessionRef.current = null;
        }
      } else if (phaseRef.current === 'panning') {
        phaseRef.current = 'idle';
        panSessionRef.current = null;
      }
      
      if (rootRef.current) {
        try { 
          if (rootRef.current.hasPointerCapture(e.pointerId)) {
            rootRef.current.releasePointerCapture(e.pointerId); 
          }
        } catch (err) {}
      }
      
      notifyChange();

      if (onGestureEnd && phaseRef.current === 'idle' && activePointersRef.current.size === 0) {
        onGestureEnd({
          phase: 'idle',
          transform: { ...transformRef.current },
          activePointerCount: 0
        });
      }
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      cleanupActiveSessions();
      notifyChange();
    };

    const handleLostPointerCapture = (e: React.PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      cleanupActiveSessions();
      notifyChange();
    };

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const preventViewerTouchScroll = (event: TouchEvent) => {
        if (event.cancelable) {
          event.preventDefault();
        }
      };

      root.addEventListener('touchmove', preventViewerTouchScroll, {
        passive: false
      });

      return () => {
        root.removeEventListener(
          'touchmove',
          preventViewerTouchScroll
        );
      };
    }, []);

    useImperativeHandle(ref, () => ({
      getTransform: () => {
        flushPendingTransform();
        return { ...transformRef.current };
      },
      setScale: (newScale: number) => {
        flushPendingTransform();
        cleanupActiveSessions();
        
        let sc = Number.isFinite(newScale) ? newScale : 1;
        sc = Math.max(minScale, Math.min(maxScale, sc));
        
        if (Math.abs(sc - 1) <= 0.0005) {
          transformRef.current = { scale: 1, translateX: 0, translateY: 0 };
        } else {
          const viewportWidth = rootRef.current ? rootRef.current.clientWidth : 0;
          const viewportHeight = rootRef.current ? rootRef.current.clientHeight : 0;
          const midX = viewportWidth / 2;
          const midY = viewportHeight / 2;
          
          let baseOriginX = 0;
          let baseOriginY = 0;
          let localFocalX = 0;
          let localFocalY = 0;
          
          if (transformLayerRef.current && rootRef.current) {
            const rootRect = rootRef.current.getBoundingClientRect();
            const layerRect = transformLayerRef.current.getBoundingClientRect();
            
            const clientMidX = rootRect.left + midX;
            const clientMidY = rootRect.top + midY;
            
            baseOriginX = layerRect.left - transformRef.current.translateX;
            baseOriginY = layerRect.top - transformRef.current.translateY;
            
            localFocalX = (clientMidX - layerRect.left) / transformRef.current.scale;
            localFocalY = (clientMidY - layerRect.top) / transformRef.current.scale;
            
            const newTx = clientMidX - baseOriginX - localFocalX * sc;
            const newTy = clientMidY - baseOriginY - localFocalY * sc;
            
            transformRef.current = constrainTransform({ scale: sc, translateX: newTx, translateY: newTy });
          } else {
            transformRef.current = constrainTransform({ scale: sc, translateX: transformRef.current.translateX, translateY: transformRef.current.translateY });
          }
        }
        applyTransform(transformRef.current);
        notifyChange();
      },
      resetTransform: () => {
        cleanupActiveSessions();
        transformRef.current = { scale: 1, translateX: 0, translateY: 0 };
        applyTransform(transformRef.current);
        notifyChange();
      },
      cancelActiveGesture: () => {
        cleanupActiveSessions();
        notifyChange();
      }
    }));

    return (
      <div
        ref={rootRef}
        className={className}
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          overscrollBehavior: 'none'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '12px',
            boxSizing: 'border-box'
          }}
        >
          <div
            ref={transformLayerRef}
            style={{
              display: 'inline-block',
              position: 'relative',
              flex: 'none',
              willChange: 'transform',
              transformOrigin: '0 0',
              transform: `translate3d(${STABLE_IDENTITY_TRANSFORM_V2.translateX}px, ${STABLE_IDENTITY_TRANSFORM_V2.translateY}px, 0) scale(${STABLE_IDENTITY_TRANSFORM_V2.scale})`
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
);
StableGestureViewportV2.displayName = 'StableGestureViewportV2';
export default StableGestureViewportV2;
