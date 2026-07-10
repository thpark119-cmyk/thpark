import React, { useRef, useEffect, useState, PointerEvent } from 'react';
import { ScoreAnnotationStroke, ScoreAnnotationTool, ScoreAnnotationPoint } from './annotationTypes';

interface AnnotationLayerProps {
  width: number;
  height: number;
  strokes: ScoreAnnotationStroke[];
  onStrokesChange: (strokes: ScoreAnnotationStroke[]) => void;
  currentTool: ScoreAnnotationTool | 'none';
  strokeColor: string;
  strokeWidth: number; // 1, 2, 3 representing thin, normal, thick
}

function getActualLineWidth(widthLevel: number, tool: ScoreAnnotationTool) {
  if (tool === 'highlighter') {
    return widthLevel * 8 + 12; // 20, 28, 36
  }
  return widthLevel * 2 + 1; // 3, 5, 7
}

export default function AnnotationLayer({
  width,
  height,
  strokes,
  onStrokesChange,
  currentTool,
  strokeColor,
  strokeWidth
}: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStroke, setCurrentStroke] = useState<ScoreAnnotationStroke | null>(null);

  // Redraw all strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (stroke: ScoreAnnotationStroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
      }
      
      const r = parseInt(stroke.color.slice(1, 3), 16);
      const g = parseInt(stroke.color.slice(3, 5), 16);
      const b = parseInt(stroke.color.slice(5, 7), 16);
      
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${stroke.opacity})`;
      ctx.lineWidth = getActualLineWidth(stroke.width, stroke.tool);
      ctx.stroke();
    };

    // Draw saved strokes
    strokes.forEach(drawStroke);

    // Draw current stroke
    if (currentStroke) {
      drawStroke(currentStroke);
    }
  }, [width, height, strokes, currentStroke]);

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none') return;
    
    // Allow touch scrolling in none mode, but prevent in drawing modes
    // e.preventDefault(); // PointerEvent doesn't need preventDefault on down if touch-action is none

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / width;
    const y = (e.clientY - rect.top) / height;

    if (currentTool === 'eraser') {
      eraseAt(x, y);
      return;
    }

    const newStroke: ScoreAnnotationStroke = {
      id: crypto.randomUUID(),
      tool: currentTool,
      color: strokeColor,
      width: strokeWidth,
      opacity: currentTool === 'highlighter' ? 0.3 : 1.0,
      points: [{ x, y, pressure: e.pressure }],
      createdAt: new Date().toISOString()
    };

    setCurrentStroke(newStroke);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none') return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / width;
    const y = (e.clientY - rect.top) / height;

    if (currentTool === 'eraser' && e.buttons > 0) {
      eraseAt(x, y);
      return;
    }

    if (!currentStroke) return;

    // Minimum distance check
    const lastPoint = currentStroke.points[currentStroke.points.length - 1];
    const dx = (x - lastPoint.x) * width;
    const dy = (y - lastPoint.y) * height;
    if (dx * dx + dy * dy < 16) return; // 4px minimum distance

    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, { x, y, pressure: e.pressure }]
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (currentStroke) {
      onStrokesChange([...strokes, currentStroke]);
      setCurrentStroke(null);
    }
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const eraseAt = (x: number, y: number) => {
    // Simple eraser: check distance from pointer to any point in the stroke
    const hitRadius = 15 / width; // roughly 15px radius
    let hit = false;
    
    const newStrokes = strokes.filter(stroke => {
      for (const p of stroke.points) {
        const dx = p.x - x;
        const dy = (p.y - y) * (height / width); // Normalize dy relative to width
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          hit = true;
          return false; // Remove this stroke
        }
      }
      return true; // Keep this stroke
    });

    if (hit) {
      onStrokesChange(newStrokes);
    }
  };

  if (width === 0 || height === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute top-0 left-0 ${currentTool === 'none' ? 'pointer-events-none' : 'touch-none cursor-crosshair'}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
