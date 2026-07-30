import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdminUser } from '../../../utils/admin';
import { PdfRenderEngineV2 } from './PdfRenderEngineV2';
import { PageSurfaceV2 } from './PageSurfaceV2';
import { PageSurfaceSwapInfoV2, PageSurfaceFrontInfoV2 } from './pageSurfaceTypes';
import { StableGestureViewportV2 } from './StableGestureViewportV2';
import { StablePageBaselineV2 } from './stableGestureTypes';

const PDF_CSS_SCALE = 1;
const PDF_OUTPUT_SCALE = 2;

export default function V2GestureBaselineLab() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const engineRef = useRef<PdfRenderEngineV2 | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [docName, setDocName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const documentInstanceIdRef = useRef(0);
  
  const [stats, setStats] = useState({
    completed: 0,
    swaps: 0,
    errors: 0
  });

  const [frontInfo, setFrontInfo] = useState<PageSurfaceFrontInfoV2 | null>(null);
  const [baseline, setBaseline] = useState<StablePageBaselineV2 | null>(null);
  
  useEffect(() => {
    if (isAdmin) {
      engineRef.current = new PdfRenderEngineV2();
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy().catch(console.error);
        engineRef.current = null;
      }
    };
  }, [isAdmin]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engineRef.current) return;

    setDocReady(false);
    setErrorMessage('');
    setDocName(file.name);
    setFrontInfo(null);
    setBaseline(null);
    setStats({ completed: 0, swaps: 0, errors: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await engineRef.current.loadDocument(bytes);
      documentInstanceIdRef.current += 1;
      setNumPages(engineRef.current.getPageCount());
      setDocReady(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
    
    e.target.value = '';
  };

  const handleSwap = useCallback((info: PageSurfaceSwapInfoV2) => {
    setStats(prev => ({ ...prev, swaps: prev.swaps + 1 }));
    setFrontInfo(info.nextFront);
    
    if (
      info.nextFront.cssScale === 1 &&
      info.nextFront.pageNumber === 1 &&
      info.nextFront.cssWidth > 0 &&
      info.nextFront.cssHeight > 0
    ) {
      setBaseline(prev => {
        if (prev && prev.documentInstanceId === documentInstanceIdRef.current) {
          return prev;
        }
        return {
          documentInstanceId: documentInstanceIdRef.current,
          pageNumber: 1,
          logicalWidth: info.nextFront.cssWidth,
          logicalHeight: info.nextFront.cssHeight
        };
      });
    }
  }, []);

  const handleRenderEvent = useCallback((ev: any) => {
    if (ev.status === 'completed') {
      setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
    } else if (ev.status === 'error') {
      setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    }
  }, []);

  const handleRenderError = useCallback((err: unknown) => {
    setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
  }, []);

  if (!isAdmin) {
    return <div className="p-10 text-stone-400">Admin access required</div>;
  }

  return (
    <div className="flex flex-col min-h-screen text-stone-200">
      <div className="p-4 bg-brand/10 border-b border-brand/20 mb-4">
        <h1 className="text-xl font-bold text-brand-light">[4C-R1A Clean Runtime]</h1>
        <div className="bg-yellow-900/50 text-yellow-200 p-2 rounded text-xs mt-2 border border-yellow-500/20">
          <strong>Stable CSS Preview Mode</strong><br/>
          제스처 및 확대/축소 버튼이 의도적으로 제거된 고정 렌더 격리 랩입니다.
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 px-4 pb-10 flex-grow">
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-stone-900/60 p-4 rounded-xl border border-white/5 space-y-4">
            <div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="text-sm text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-brand-light hover:file:bg-brand-dark"
              />
            </div>
            {errorMessage && <div className="text-red-400 text-sm">{errorMessage}</div>}
            
            {docReady && (
              <div className="text-sm">
                <div>Document: {docName}</div>
                <div>Pages: {numPages}</div>
                <div>PDF Scale: 100%</div>
                <div>Output Scale: {PDF_OUTPUT_SCALE}x</div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-950 p-2 rounded">Completed: {stats.completed}</div>
              <div className="bg-stone-950 p-2 rounded">Swaps: {stats.swaps}</div>
              <div className="bg-stone-950 p-2 rounded">Errors: {stats.errors}</div>
            </div>
            
            {frontInfo && (
              <div className="bg-stone-950 p-3 rounded text-xs space-y-1 font-mono text-stone-400 border border-white/5">
                <div>Req ID: {frontInfo.requestId}</div>
                <div>CSS Size: {frontInfo.cssWidth.toFixed(1)} x {frontInfo.cssHeight.toFixed(1)}</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center">
          <div 
            className="bg-stone-950 border border-white/5 rounded-xl flex flex-col"
            style={{
               position: 'relative',
               overflow: 'hidden',
               flex: 'none',
               width: '100%',
               ...(baseline ? {
                 maxWidth: `${baseline.logicalWidth + 24}px`,
                 height: `min(${baseline.logicalHeight + 24}px, calc(100dvh - 230px))`,
                 minHeight: '320px'
               } : {
                 height: 'calc(100dvh - 230px)',
                 minHeight: '320px',
                 maxWidth: '800px'
               })
            }}
          >
            {docReady && engineRef.current && (
              <StableGestureViewportV2 key={documentInstanceIdRef.current}>
                <PageSurfaceV2
                  engine={engineRef.current}
                  pageNumber={1}
                  cssScale={PDF_CSS_SCALE}
                  outputScale={PDF_OUTPUT_SCALE}
                  onRenderEvent={handleRenderEvent}
                  onSwap={handleSwap}
                  onRenderError={handleRenderError}
                />
              </StableGestureViewportV2>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
