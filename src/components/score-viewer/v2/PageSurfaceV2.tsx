import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { PdfRenderEngineV2 } from './PdfRenderEngineV2';
import {
  PageSurfaceCanvasSlotV2,
  PageSurfaceRenderStateV2,
  PageSurfaceFrontInfoV2,
  PageSurfaceSwapInfoV2,
  PageSurfaceRenderEventV2
} from './pageSurfaceTypes';

export interface PageSurfaceV2Props {
  engine: PdfRenderEngineV2;
  pageNumber: number;
  cssScale: number;
  outputScale: number;
  className?: string;
  ariaLabel?: string;
  onRenderEvent?: (event: PageSurfaceRenderEventV2) => void;
  onSwap?: (info: PageSurfaceSwapInfoV2) => void;
  onRenderError?: (error: unknown) => void;
}

export function PageSurfaceV2({
  engine,
  pageNumber,
  cssScale,
  outputScale,
  className,
  ariaLabel,
  onRenderEvent,
  onSwap,
  onRenderError
}: PageSurfaceV2Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firstCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const secondCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const frontSlotRef = useRef<PageSurfaceCanvasSlotV2 | null>(null);
  const frontInfoRef = useRef<PageSurfaceFrontInfoV2 | null>(null);
  const surfaceRequestCounterRef = useRef<number>(0);
  const surfaceSequenceRef = useRef<number>(0);
  const activeRenderPromiseRef = useRef<Promise<void> | null>(null);
  const activeRequestIdRef = useRef<number | null>(null);
  const swapFrameRef = useRef<number | null>(null);
  const mountRef = useRef<boolean>(true);
  const surfaceStateRef = useRef<PageSurfaceRenderStateV2>('idle');

  const callbacksRef = useRef({ onRenderEvent, onSwap, onRenderError });
  useEffect(() => {
    callbacksRef.current = { onRenderEvent, onSwap, onRenderError };
  }, [onRenderEvent, onSwap, onRenderError]);

  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.style.width = '0px';
      rootRef.current.style.height = '0px';
    }
    if (firstCanvasRef.current) {
      firstCanvasRef.current.style.visibility = 'hidden';
      firstCanvasRef.current.style.opacity = '0';
      firstCanvasRef.current.style.zIndex = '0';
    }
    if (secondCanvasRef.current) {
      secondCanvasRef.current.style.visibility = 'hidden';
      secondCanvasRef.current.style.opacity = '0';
      secondCanvasRef.current.style.zIndex = '0';
    }
  }, []);

  useEffect(() => {
    mountRef.current = true;
    return () => {
      mountRef.current = false;
      surfaceSequenceRef.current += 1;
      
      if (swapFrameRef.current !== null) {
        cancelAnimationFrame(swapFrameRef.current);
        swapFrameRef.current = null;
      }
      
      if (activeRequestIdRef.current !== null && engine.activeRenderRequestId === activeRequestIdRef.current) {
        engine.cancelActiveRender();
      }
      
      if (firstCanvasRef.current) {
        firstCanvasRef.current.width = 0;
        firstCanvasRef.current.height = 0;
      }
      if (secondCanvasRef.current) {
        secondCanvasRef.current.width = 0;
        secondCanvasRef.current.height = 0;
      }
      
      frontInfoRef.current = null;
      activeRequestIdRef.current = null;
      surfaceStateRef.current = 'destroyed';
      
      if (import.meta.env.DEV) {
        console.debug(`[Mio PageSurfaceV2] surface-unmount`);
      }
    };
  }, [engine]);

  useEffect(() => {
    if (!mountRef.current) return;
    
    surfaceSequenceRef.current += 1;
    const seq = surfaceSequenceRef.current;
    
    surfaceRequestCounterRef.current += 1;
    const reqId = surfaceRequestCounterRef.current;
    
    let active = true;

    const runRender = async () => {
      if (activeRenderPromiseRef.current) {
        if (import.meta.env.DEV) {
          console.debug(`[Mio PageSurfaceV2] waiting-previous-render`, { surfaceRequestId: reqId });
        }
        if (engine.activeRenderRequestId === activeRequestIdRef.current) {
          engine.cancelActiveRender();
        }
        try {
          await activeRenderPromiseRef.current;
        } catch (e: unknown) {
          // ignore
        }
      }

      if (!active || !mountRef.current || surfaceSequenceRef.current !== seq) return;

      const backSlot: PageSurfaceCanvasSlotV2 = frontSlotRef.current === 'first' ? 'second' : 'first';
      const backCanvas = backSlot === 'first' ? firstCanvasRef.current : secondCanvasRef.current;

      if (
        engine.state !== 'ready' ||
        !engine.hasDocument ||
        pageNumber < 1 ||
        pageNumber > engine.numPages ||
        !Number.isFinite(cssScale) ||
        cssScale <= 0 ||
        !Number.isFinite(outputScale) ||
        outputScale <= 0 ||
        !backCanvas
      ) {
        try {
          callbacksRef.current.onRenderError?.(new Error('Invalid render parameters or state'));
        } catch (e: unknown) {
          // ignore
        }
        return;
      }

      backCanvas.style.visibility = 'hidden';
      backCanvas.style.opacity = '0';
      backCanvas.style.zIndex = '0';

      activeRequestIdRef.current = reqId;
      surfaceStateRef.current = 'rendering';

      if (import.meta.env.DEV) {
        console.debug(`[Mio PageSurfaceV2] render-request`, {
          surfaceRequestId: reqId,
          pageNumber,
          cssScale,
          outputScale,
          backSlot
        });
      }

      const renderPromise = engine.renderPage({
        requestId: reqId,
        pageNumber,
        cssScale,
        outputScale,
        canvas: backCanvas
      });

      const localPromise = renderPromise.then(() => {}).catch(() => {});
      activeRenderPromiseRef.current = localPromise;

      try {
        const result = await renderPromise;
        
        if (!active || !mountRef.current || surfaceSequenceRef.current !== seq) return;

        try {
          callbacksRef.current.onRenderEvent?.({ surfaceRequestId: reqId, result });
        } catch (e: unknown) {
          // ignore
        }

        if (result.status === 'completed') {
          if (import.meta.env.DEV) {
            console.debug(`[Mio PageSurfaceV2] render-completed`, {
              surfaceRequestId: reqId,
              generation: result.generation,
              duration: result.renderDurationMs
            });
          }

          if (
            result.requestId === reqId &&
            result.generation === engine.generation &&
            engine.state === 'ready' &&
            backSlot === (frontSlotRef.current === 'first' ? 'second' : 'first') &&
            pageNumber === result.pageNumber &&
            cssScale === result.cssScale &&
            outputScale === result.outputScale
          ) {
            if (swapFrameRef.current !== null) {
              cancelAnimationFrame(swapFrameRef.current);
            }

            if (import.meta.env.DEV) {
              console.debug(`[Mio PageSurfaceV2] swap-scheduled`, { surfaceRequestId: reqId });
            }

            swapFrameRef.current = requestAnimationFrame(() => {
              if (
                !mountRef.current ||
                surfaceSequenceRef.current !== seq ||
                activeRequestIdRef.current !== reqId ||
                engine.generation !== result.generation ||
                engine.state !== 'ready' ||
                backSlot !== (frontSlotRef.current === 'first' ? 'second' : 'first')
              ) {
                if (import.meta.env.DEV) {
                  console.debug(`[Mio PageSurfaceV2] swap-skipped`, { surfaceRequestId: reqId });
                }
                return;
              }

              if (rootRef.current) {
                rootRef.current.style.width = `${result.cssWidth}px`;
                rootRef.current.style.height = `${result.cssHeight}px`;
              }

              const widthMatches = backCanvas.style.width === `${result.cssWidth}px`;
              const heightMatches = backCanvas.style.height === `${result.cssHeight}px`;
              if (!widthMatches || !heightMatches) {
                if (import.meta.env.DEV) {
                  console.warn(`[Mio PageSurfaceV2] canvas size mismatch`, {
                    expected: `${result.cssWidth}x${result.cssHeight}`,
                    actual: `${backCanvas.style.width}x${backCanvas.style.height}`
                  });
                }
              }

              backCanvas.style.visibility = 'visible';
              backCanvas.style.opacity = '1';
              backCanvas.style.zIndex = '10';

              const prevSlot = frontSlotRef.current;
              const prevCanvas = prevSlot === 'first' ? firstCanvasRef.current : (prevSlot === 'second' ? secondCanvasRef.current : null);
              
              if (prevCanvas) {
                prevCanvas.style.visibility = 'hidden';
                prevCanvas.style.opacity = '0';
                prevCanvas.style.zIndex = '0';
              }

              const previousFront = frontInfoRef.current;
              const nextFront: PageSurfaceFrontInfoV2 = {
                slot: backSlot,
                requestId: reqId,
                generation: result.generation,
                pageNumber: result.pageNumber,
                cssScale: result.cssScale,
                outputScale: result.outputScale,
                cssWidth: result.cssWidth,
                cssHeight: result.cssHeight,
                pixelWidth: result.pixelWidth,
                pixelHeight: result.pixelHeight
              };

              frontSlotRef.current = backSlot;
              frontInfoRef.current = nextFront;
              surfaceStateRef.current = 'ready';
              swapFrameRef.current = null;

              if (import.meta.env.DEV) {
                console.debug(`[Mio PageSurfaceV2] swap-complete`, {
                  surfaceRequestId: reqId,
                  frontSlot: backSlot
                });
              }

              try {
                callbacksRef.current.onSwap?.({
                  previousFront,
                  nextFront,
                  renderDurationMs: result.renderDurationMs,
                  swapTime: performance.now()
                });
              } catch (e: unknown) {
                // ignore
              }
            });
          }
        } else if (result.status === 'cancelled') {
          if (import.meta.env.DEV) {
            console.debug(`[Mio PageSurfaceV2] render-cancelled`, { surfaceRequestId: reqId });
          }
        } else if (result.status === 'stale') {
          if (import.meta.env.DEV) {
            console.debug(`[Mio PageSurfaceV2] render-stale`, { surfaceRequestId: reqId });
          }
        }
      } catch (e: unknown) {
        if (!active || !mountRef.current || surfaceSequenceRef.current !== seq) return;
        
        if (import.meta.env.DEV) {
          console.debug(`[Mio PageSurfaceV2] render-error`, { surfaceRequestId: reqId, error: e });
        }
        try {
          callbacksRef.current.onRenderError?.(e);
        } catch (err: unknown) {
          // ignore
        }
      } finally {
        if (activeRenderPromiseRef.current === localPromise) {
          activeRenderPromiseRef.current = null;
        }
      }
    };

    runRender();

    return () => {
      active = false;
      surfaceSequenceRef.current += 1;
      
      if (swapFrameRef.current !== null) {
        cancelAnimationFrame(swapFrameRef.current);
        swapFrameRef.current = null;
      }
      
      if (engine.activeRenderRequestId === reqId) {
        engine.cancelActiveRender();
      }
    };
  }, [engine, pageNumber, cssScale, outputScale]);

  return (
    <div
      ref={rootRef}
      data-mio-page-surface-v2="true"
      className={className}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        contain: 'layout paint style'
      }}
    >
      <canvas
        ref={firstCanvasRef}
        data-mio-pdf-canvas-v2="first"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          pointerEvents: 'none',
          transform: 'none',
          transformOrigin: '0 0'
        }}
      />
      <canvas
        ref={secondCanvasRef}
        data-mio-pdf-canvas-v2="second"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          pointerEvents: 'none',
          transform: 'none',
          transformOrigin: '0 0'
        }}
      />
    </div>
  );
}
