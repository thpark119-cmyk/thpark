import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ScoreAnnotationStroke, ScoreAnnotationTool } from './annotationTypes';
import { getFileDownloadUrl } from '../../utils/cloudStorage';
import AnnotationLayer from './AnnotationLayer';

// Initialize PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPageCanvasProps {
  storagePath: string;
  pageNumber: number;
  onPageCountChange: (count: number) => void;
  strokes: ScoreAnnotationStroke[];
  onStrokesChange: (strokes: ScoreAnnotationStroke[]) => void;
  currentTool: ScoreAnnotationTool | 'none';
  strokeColor: string;
  strokeWidth: number;
  onDirtyChange: (dirty: boolean) => void;
}

export default function PdfPageCanvas({
  storagePath,
  pageNumber,
  onPageCountChange,
  strokes,
  onStrokesChange,
  currentTool,
  strokeColor,
  strokeWidth,
  onDirtyChange
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [renderTask, setRenderTask] = useState<pdfjsLib.RenderTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1); // logical scale

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        const url = await getFileDownloadUrl(storagePath);
        const loadingTask = pdfjsLib.getDocument(url);
        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          onPageCountChange(doc.numPages);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load PDF');
        }
      }
    };
    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [storagePath, onPageCountChange]);

  // Render Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    let isMounted = true;
    let currentRenderTask: pdfjsLib.RenderTask | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        // Fit to container width (or just device width)
        const containerWidth = window.innerWidth;
        const pageScale = containerWidth / viewport.width;
        setScale(pageScale);
        
        const scaledViewport = page.getViewport({ scale: pageScale });
        
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(scaledViewport.width * outputScale);
        canvas.height = Math.floor(scaledViewport.height * outputScale);
        
        // CSS dimensions
        canvas.style.width = Math.floor(scaledViewport.width) + "px";
        canvas.style.height = Math.floor(scaledViewport.height) + "px";

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport: scaledViewport
        };

        if (renderTask) {
          await renderTask.cancel();
        }

        currentRenderTask = page.render(renderContext);
        setRenderTask(currentRenderTask);
        await currentRenderTask.promise;
        
        if (isMounted) {
          setRenderTask(null);
        }
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          // Ignore cancelled
        } else {
          console.error('Error rendering page', err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber]); // Remove renderTask from deps

  if (error) {
    return <div className="flex items-center justify-center p-8 text-red-400">{error}</div>;
  }

  return (
    <div className="relative flex flex-col items-center max-w-full overflow-hidden">
      <div className="relative shadow-xl">
        <canvas ref={canvasRef} className="block bg-white" />
        <AnnotationLayer
          width={canvasRef.current ? parseInt(canvasRef.current.style.width) : 0}
          height={canvasRef.current ? parseInt(canvasRef.current.style.height) : 0}
          strokes={strokes}
          onStrokesChange={(newStrokes) => {
            onStrokesChange(newStrokes);
            onDirtyChange(true);
          }}
          currentTool={currentTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />
      </div>
    </div>
  );
}
