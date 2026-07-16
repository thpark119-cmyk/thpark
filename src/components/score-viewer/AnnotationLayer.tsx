import React, { useRef, useEffect, useState } from 'react';
import { ScoreAnnotationStroke, ScoreAnnotationTool, ScoreAnnotationPoint } from './annotationTypes';
import { getScaledAnnotationLineWidth } from './annotationStrokeSizing';

interface AnnotationLayerProps {
  width: number;
  height: number;
  strokes: ScoreAnnotationStroke[];
  onStrokesChange: (strokes: ScoreAnnotationStroke[]) => void;
  currentTool: ScoreAnnotationTool | 'none';
  strokeColor: string;
  strokeWidth: number; // 1, 2, 3 representing thin, normal, thick
  eraserRadius: number;
  touchInputMode: 'pan' | 'draw';
}

function canPointerDraw({
  pointerType,
  touchInputMode,
}: {
  pointerType: string;
  touchInputMode: 'pan' | 'draw';
}): boolean {
  if (pointerType === 'pen' || pointerType === 'mouse') {
    return true;
  }
  if (pointerType === 'touch') {
    return touchInputMode === 'draw';
  }
  return false;
}

interface PixelPoint {
  x: number;
  y: number;
}

const ERASER_SAMPLE_STEP_PX = 4;
const GEOMETRY_EPSILON = 0.0001;

function distancePointToSegment(
  point: PixelPoint,
  segmentStart: PixelPoint,
  segmentEnd: PixelPoint,
): number {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * segmentX + (point.y - segmentStart.y) * segmentY) / segmentLengthSquared
    )
  );

  const closestX = segmentStart.x + projection * segmentX;
  const closestY = segmentStart.y + projection * segmentY;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

function orientation(a: PixelPoint, b: PixelPoint, c: PixelPoint): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function doSegmentsIntersect(
  p1: PixelPoint, q1: PixelPoint,
  p2: PixelPoint, q2: PixelPoint
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if ((o1 > GEOMETRY_EPSILON && o2 < -GEOMETRY_EPSILON || o1 < -GEOMETRY_EPSILON && o2 > GEOMETRY_EPSILON) &&
      (o3 > GEOMETRY_EPSILON && o4 < -GEOMETRY_EPSILON || o3 < -GEOMETRY_EPSILON && o4 > GEOMETRY_EPSILON)) {
    return true;
  }
  return false;
}

function isStrokeSegmentHitByEraser(
  strokeStart: PixelPoint,
  strokeEnd: PixelPoint,
  eraserStart: PixelPoint,
  eraserEnd: PixelPoint,
  radius: number,
): boolean {
  if (doSegmentsIntersect(strokeStart, strokeEnd, eraserStart, eraserEnd)) {
    return true;
  }
  if (distancePointToSegment(strokeStart, eraserStart, eraserEnd) <= radius) return true;
  if (distancePointToSegment(strokeEnd, eraserStart, eraserEnd) <= radius) return true;
  if (distancePointToSegment(eraserStart, strokeStart, strokeEnd) <= radius) return true;
  if (distancePointToSegment(eraserEnd, strokeStart, strokeEnd) <= radius) return true;

  return false;
}

function sampleStrokePoints(
  stroke: ScoreAnnotationStroke,
  width: number,
  height: number,
): ScoreAnnotationPoint[] {
  if (stroke.points.length <= 1) return stroke.points;

  const sampled: ScoreAnnotationPoint[] = [stroke.points[0]];

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const start = stroke.points[i];
    const end = stroke.points[i + 1];

    const startX = start.x * width;
    const startY = start.y * height;
    const endX = end.x * width;
    const endY = end.y * height;

    const distance = Math.hypot(endX - startX, endY - startY);
    const steps = Math.max(1, Math.ceil(distance / ERASER_SAMPLE_STEP_PX));

    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      let pressure = undefined;
      if (start.pressure !== undefined && end.pressure !== undefined) {
        pressure = start.pressure + (end.pressure - start.pressure) * t;
      } else if (start.pressure !== undefined) {
        pressure = start.pressure;
      }
      sampled.push({
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        pressure
      });
    }
  }

  return sampled;
}

function eraseStrokeBySweep(
  stroke: ScoreAnnotationStroke,
  eraserStart: PixelPoint,
  eraserEnd: PixelPoint,
  width: number,
  height: number,
  radius: number,
): {
  fragments: ScoreAnnotationStroke[];
  changed: boolean;
} {
  if (stroke.points.length === 0) {
    return { fragments: [], changed: true };
  }

  if (stroke.points.length === 1) {
    const pt: PixelPoint = { x: stroke.points[0].x * width, y: stroke.points[0].y * height };
    if (distancePointToSegment(pt, eraserStart, eraserEnd) <= radius) {
      return { fragments: [], changed: true };
    }
    return { fragments: [stroke], changed: false };
  }

  const sampledPoints = sampleStrokePoints(stroke, width, height);
  const fragments: ScoreAnnotationStroke[] = [];
  let currentFragmentPoints: ScoreAnnotationPoint[] = [];
  let changed = false;

  for (let i = 0; i < sampledPoints.length - 1; i++) {
    const start = sampledPoints[i];
    const end = sampledPoints[i + 1];
    
    const startPx: PixelPoint = { x: start.x * width, y: start.y * height };
    const endPx: PixelPoint = { x: end.x * width, y: end.y * height };

    if (isStrokeSegmentHitByEraser(startPx, endPx, eraserStart, eraserEnd, radius)) {
      changed = true;
      if (currentFragmentPoints.length > 0) {
        if (currentFragmentPoints.length >= 2) {
          fragments.push({
            ...stroke,
            id: crypto.randomUUID(),
            points: currentFragmentPoints,
          });
        }
        currentFragmentPoints = [];
      }
    } else {
      if (currentFragmentPoints.length === 0) {
        currentFragmentPoints.push(start);
      }
      currentFragmentPoints.push(end);
    }
  }

  if (currentFragmentPoints.length >= 2) {
    fragments.push({
      ...stroke,
      id: changed ? crypto.randomUUID() : stroke.id,
      points: currentFragmentPoints,
    });
  }

  if (!changed) {
    return { fragments: [stroke], changed: false };
  }

  return { fragments, changed: true };
}

function applyEraserSweep(
  sourceStrokes: ScoreAnnotationStroke[],
  eraserStartPt: ScoreAnnotationPoint,
  eraserEndPt: ScoreAnnotationPoint,
  width: number,
  height: number,
  radius: number,
): {
  strokes: ScoreAnnotationStroke[];
  changed: boolean;
} {
  const eraserStart: PixelPoint = { x: eraserStartPt.x * width, y: eraserStartPt.y * height };
  const eraserEnd: PixelPoint = { x: eraserEndPt.x * width, y: eraserEndPt.y * height };

  const resultStrokes: ScoreAnnotationStroke[] = [];
  let anyChanged = false;

  for (const stroke of sourceStrokes) {
    const { fragments, changed } = eraseStrokeBySweep(
      stroke,
      eraserStart,
      eraserEnd,
      width,
      height,
      radius
    );
    if (changed) {
      anyChanged = true;
    }
    resultStrokes.push(...fragments);
  }

  return {
    strokes: anyChanged ? resultStrokes : sourceStrokes,
    changed: anyChanged
  };
}

export default function AnnotationLayer({
  width,
  height,
  strokes,
  onStrokesChange,
  currentTool,
  strokeColor,
  strokeWidth,
  eraserRadius,
  touchInputMode,
}: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStroke, setCurrentStroke] = useState<ScoreAnnotationStroke | null>(null);
  const activeAnnotationPointerIdRef = useRef<number | null>(null);

  const [eraserPreviewStrokes, setEraserPreviewStrokes] = useState<ScoreAnnotationStroke[] | null>(null);
  const eraserSessionStrokesRef = useRef<ScoreAnnotationStroke[] | null>(null);
  const lastEraserPointRef = useRef<ScoreAnnotationPoint | null>(null);
  const eraserHasChangesRef = useRef(false);

  const effectiveEraserRadius = Math.max(6, Math.min(40, eraserRadius));

  interface EraserCursorState {
    x: number;
    y: number;
    visible: boolean;
    pointerType: string;
  }

  const [eraserCursor, setEraserCursor] = useState<EraserCursorState | null>(null);

  const updateEraserCursor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'eraser') {
      return;
    }

    if (
      !canPointerDraw({
        pointerType: event.pointerType,
        touchInputMode,
      })
    ) {
      setEraserCursor(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    setEraserCursor({
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      visible: true,
      pointerType: event.pointerType,
    });
  };

  useEffect(() => {
    if (currentTool !== 'eraser') {
      setEraserCursor(null);
    }
  }, [currentTool]);

  // Redraw all strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    
    const backingWidth = Math.max(1, Math.round(width * outputScale));
    const backingHeight = Math.max(1, Math.round(height * outputScale));

    if (canvas.width !== backingWidth) {
      canvas.width = backingWidth;
    }
    if (canvas.height !== backingHeight) {
      canvas.height = backingHeight;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (stroke: ScoreAnnotationStroke) => {
      const r = parseInt(stroke.color.slice(1, 3), 16);
      const g = parseInt(stroke.color.slice(3, 5), 16);
      const b = parseInt(stroke.color.slice(5, 7), 16);
      
      const strokeStyle = `rgba(${r}, ${g}, ${b}, ${stroke.opacity})`;

      const lineWidth = getScaledAnnotationLineWidth({
        widthLevel: stroke.width,
        tool: stroke.tool,
        pageWidth: width,
      });

      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        ctx.beginPath();
        ctx.arc(
          point.x * width,
          point.y * height,
          lineWidth / 2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = strokeStyle;
        ctx.fill();
        return;
      }

      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
      }
      
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    const visibleStrokes = eraserPreviewStrokes ?? strokes;

    // Draw saved strokes
    visibleStrokes.forEach(drawStroke);

    // Draw current stroke
    if (currentStroke) {
      drawStroke(currentStroke);
    }
  }, [width, height, strokes, currentStroke, eraserPreviewStrokes]);

  const toPixelPoint = (point: ScoreAnnotationPoint): PixelPoint => ({
    x: point.x * width,
    y: point.y * height,
  });

  const toNormalizedPoint = (point: PixelPoint, pressure?: number): ScoreAnnotationPoint => ({
    x: Math.max(0, Math.min(1, point.x / width)),
    y: Math.max(0, Math.min(1, point.y / height)),
    pressure,
  });

  const getNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return {
      x,
      y,
      pressure: event.pressure,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (
      !canPointerDraw({
        pointerType: event.pointerType,
        touchInputMode,
      })
    ) {
      return;
    }
    
    event.preventDefault();
    activeAnnotationPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getNormalizedPoint(event);
    if (!point) return;

    if (currentTool === 'eraser') {
      eraserSessionStrokesRef.current = strokes;
      lastEraserPointRef.current = point;
      eraserHasChangesRef.current = false;

      const result = applyEraserSweep(strokes, point, point, width, height, effectiveEraserRadius);
      if (result.changed) {
        eraserSessionStrokesRef.current = result.strokes;
        eraserHasChangesRef.current = true;
        setEraserPreviewStrokes(result.strokes);
      }
      return;
    }

    const newStroke: ScoreAnnotationStroke = {
      id: crypto.randomUUID(),
      tool: currentTool,
      color: strokeColor,
      width: strokeWidth,
      opacity: currentTool === 'highlighter' ? 0.3 : 1,
      points: [point],
      createdAt: new Date().toISOString()
    };

    setCurrentStroke(newStroke);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateEraserCursor(event);

    if (currentTool === 'none') return;
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    
    event.preventDefault();
    const point = getNormalizedPoint(event);
    if (!point) return;

    if (currentTool === 'eraser' && activeAnnotationPointerIdRef.current === event.pointerId) {
      const previousPoint = lastEraserPointRef.current;
      const sourceStrokes = eraserSessionStrokesRef.current;
      if (previousPoint && sourceStrokes) {
        const result = applyEraserSweep(sourceStrokes, previousPoint, point, width, height, effectiveEraserRadius);
        eraserSessionStrokesRef.current = result.strokes;
        lastEraserPointRef.current = point;
        if (result.changed) {
          eraserHasChangesRef.current = true;
          setEraserPreviewStrokes(result.strokes);
        }
      }
      return;
    }

    if (!currentStroke) return;

    // Minimum distance check
    const lastPoint = currentStroke.points[currentStroke.points.length - 1];
    const dx = (point.x - lastPoint.x) * width;
    const dy = (point.y - lastPoint.y) * height;
    if (dx * dx + dy * dy < 16) return; // 4px minimum distance

    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point]
    });
  };

  const finishEraserSession = () => {
    const finalStrokes = eraserSessionStrokesRef.current;
    const hasChanges = eraserHasChangesRef.current;

    eraserSessionStrokesRef.current = null;
    lastEraserPointRef.current = null;
    eraserHasChangesRef.current = false;

    if (hasChanges && finalStrokes) {
      onStrokesChange(finalStrokes);
    }
    setEraserPreviewStrokes(null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    activeAnnotationPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      setEraserCursor(null);
    }
    
    if (currentTool === 'eraser') {
      finishEraserSession();
      return;
    }
    
    if (currentTool === 'none') return;
    
    if (currentStroke) {
      onStrokesChange([...strokes, currentStroke]);
      setCurrentStroke(null);
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeAnnotationPointerIdRef.current !== event.pointerId) return;
    activeAnnotationPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      setEraserCursor(null);
    }
    
    if (currentTool === 'eraser') {
      finishEraserSession();
      return;
    }
    
    if (currentTool === 'none') return;
    
    if (currentStroke) {
      onStrokesChange([...strokes, currentStroke]);
      setCurrentStroke(null);
    }
  };

  if (width === 0 || height === 0) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        data-score-annotation-layer
        className="absolute inset-0 z-20 block select-none"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: currentTool === 'none' ? 'none' : 'auto',
          touchAction: currentTool === 'none' || touchInputMode === 'pan' ? 'pan-x pan-y' : 'none',
          cursor: currentTool === 'none' 
            ? 'default' 
            : currentTool === 'eraser' ? 'none' : 'crosshair'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerEnter={event => updateEraserCursor(event)}
        onPointerLeave={() => {
          if (activeAnnotationPointerIdRef.current === null) {
            setEraserCursor(null);
          }
        }}
      />
      {currentTool === 'eraser' && eraserCursor?.visible && (
        <div
          data-score-eraser-cursor
          aria-hidden="true"
          className="
            absolute
            z-30
            rounded-full
            border-2
            border-rose-400
            bg-rose-400/10
            shadow-sm
            pointer-events-none
          "
          style={{
            left: `${eraserCursor.x}px`,
            top: `${eraserCursor.y}px`,
            width: `${effectiveEraserRadius * 2}px`,
            height: `${effectiveEraserRadius * 2}px`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </>
  );
}
