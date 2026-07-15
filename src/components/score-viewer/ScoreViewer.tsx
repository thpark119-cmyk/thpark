import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Share, ChevronLeft, ChevronRight, Pen, Highlighter, Eraser, Undo, Redo, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react';
import { CloudScoreFile } from '../../types/cloudFiles';
import { ScoreAnnotationTool, ScoreAnnotationDocument, ScoreAnnotationStroke } from './annotationTypes';
import { loadScoreAnnotations, saveScoreAnnotations } from '../../utils/scoreAnnotationStorage';
import { createAnnotatedPdf } from '../../utils/annotatedPdfExport';
import { uploadFileToStorage } from '../../utils/cloudStorage';
import { buildScoreFileStoragePath } from '../../utils/storagePaths';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import PdfPageCanvas from './PdfPageCanvas';

interface ScoreViewerProps {
  file: CloudScoreFile;
  repertoireId: string;
  onClose: () => void;
  onAnnotatedPdfSaved?: (newFile: CloudScoreFile) => void;
}

interface ViewerViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function ScoreViewer({ file, repertoireId, onClose, onAnnotatedPdfSaved }: ScoreViewerProps) {
  useBodyScrollLock(true);
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [document, setDocument] = useState<ScoreAnnotationDocument>({
    schemaVersion: 1,
    repertoireId,
    fileId: file?.id || '',
    sourceStoragePath: file?.storagePath || '',
    pages: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  
  const [currentTool, setCurrentTool] = useState<ScoreAnnotationTool | 'none'>('none');
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(2); // 1, 2, 3
  
  const [history, setHistory] = useState<ScoreAnnotationStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [viewerViewportRect, setViewerViewportRect] = useState<ViewerViewportRect>(() => ({
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));
  const bottomToolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number | null = null;

    const updateViewportRect = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;

        const nextRect: ViewerViewportRect = viewport
          ? {
              top: viewport.offsetTop,
              left: viewport.offsetLeft,
              width: viewport.width,
              height: viewport.height,
            }
          : {
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            };

        if (nextRect.width < 200 || nextRect.height < 200) {
          frameId = null;
          return;
        }

        setViewerViewportRect(previous => {
          const changed =
            Math.abs(previous.top - nextRect.top) >= 1 ||
            Math.abs(previous.left - nextRect.left) >= 1 ||
            Math.abs(previous.width - nextRect.width) >= 1 ||
            Math.abs(previous.height - nextRect.height) >= 1;

          return changed ? nextRect : previous;
        });

        frameId = null;
      });
    };

    updateViewportRect();

    const visualViewport = window.visualViewport;

    visualViewport?.addEventListener('resize', updateViewportRect);
    visualViewport?.addEventListener('scroll', updateViewportRect);
    window.addEventListener('resize', updateViewportRect);
    window.addEventListener('scroll', updateViewportRect, { passive: true });
    window.addEventListener('orientationchange', updateViewportRect);
    window.addEventListener('pageshow', updateViewportRect);

    return () => {
      visualViewport?.removeEventListener('resize', updateViewportRect);
      visualViewport?.removeEventListener('scroll', updateViewportRect);
      window.removeEventListener('resize', updateViewportRect);
      window.removeEventListener('scroll', updateViewportRect);
      window.removeEventListener('orientationchange', updateViewportRect);
      window.removeEventListener('pageshow', updateViewportRect);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    if (viewerViewportRect.width === 0 || viewerViewportRect.height === 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const toolbar = bottomToolbarRef.current;

      if (!toolbar) {
        return;
      }

      const rect = toolbar.getBoundingClientRect();

      const visibleTop = viewerViewportRect.top;
      const visibleBottom = viewerViewportRect.top + viewerViewportRect.height;

      const isVisible =
        rect.top >= visibleTop - 2 &&
        rect.bottom <= visibleBottom + 2 &&
        rect.height > 0;

      console.info('[Mio Score Viewer Layout]', {
        event: 'bottom-toolbar-visibility',
        viewportTop: Math.round(viewerViewportRect.top),
        viewportBottom: Math.round(visibleBottom),
        viewportHeight: Math.round(viewerViewportRect.height),
        toolbarTop: Math.round(rect.top),
        toolbarBottom: Math.round(rect.bottom),
        toolbarHeight: Math.round(rect.height),
        isVisible,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [viewerViewportRect, currentTool]);

  // Load annotations
  useEffect(() => {
    if (!user || !file?.id) return;
    loadScoreAnnotations(user.uid, repertoireId, file.id).then(doc => {
      if (doc) {
        setDocument(doc);
      }
    }).catch(err => {
      console.error('Failed to load annotations', err);
      // We still allow viewing the PDF even if annotations fail to load
    });
  }, [user, repertoireId, file?.id]);

  const currentPageStrokes = document.pages[currentPage]?.strokes || [];

  // Update history when strokes change from user input (not from undo/redo)
  const handleStrokesChange = (newStrokes: ScoreAnnotationStroke[]) => {
    const historyBeforeChange =
      history.length === 0
        ? [currentPageStrokes]
        : history.slice(0, historyIndex + 1);

    const newHistory = [...historyBeforeChange, newStrokes];

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    updateDocumentStrokes(newStrokes);
    setIsDirty(true);
  };

  const updateDocumentStrokes = (strokes: ScoreAnnotationStroke[]) => {
    setDocument(prev => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      pages: {
        ...prev.pages,
        [currentPage]: {
          pageNumber: currentPage,
          strokes
        }
      }
    }));
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    updateDocumentStrokes(history[newIndex]);
    setIsDirty(true);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateDocumentStrokes(history[newIndex]);
      setIsDirty(true);
    }
  };

  // When changing pages, reset history for simplicity, 
  // or we could maintain a history per page. We'll reset for simplicity.
  const changePage = (delta: number) => {
    const newPage = Math.max(1, Math.min(pageCount, currentPage + delta));
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      setHistory([]);
      setHistoryIndex(-1);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await saveScoreAnnotations(user.uid, repertoireId, file.id, document);
      setIsDirty(false);
      setSaveMessage('필기가 저장되었습니다.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('필기를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAnnotatedPdf = async () => {
    if (!user) return;
    setIsCreatingPdf(true);
    try {
      const pdfBlob = await createAnnotatedPdf(file.storagePath, document);
      
      const newFileId = crypto.randomUUID();
      const storagePath = buildScoreFileStoragePath({
        uid: user.uid,
        repertoireId,
        fileId: newFileId,
        ext: 'pdf'
      });

      const newFileName = file.fileName.replace(/\.pdf$/i, '') + ' - 필기본.pdf';

      const uploadResult = await uploadFileToStorage({
        file: pdfBlob,
        storagePath,
        contentType: 'application/pdf'
      });

      const newFile: CloudScoreFile = {
        id: newFileId,
        fileName: newFileName,
        storagePath: uploadResult.storagePath,
        contentType: uploadResult.contentType,
        size: uploadResult.size,
        createdAt: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
        source: 'firebase-storage'
      };

      if (onAnnotatedPdfSaved) {
        onAnnotatedPdfSaved(newFile);
      }
      
      setSaveMessage('필기본 PDF가 저장되었습니다.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('필기본 PDF를 만들지 못했습니다.');
    } finally {
      setIsCreatingPdf(false);
    }
  };

  const handleShare = async () => {
    if (!user) return;
    setIsCreatingPdf(true);
    try {
      const pdfBlob = await createAnnotatedPdf(file.storagePath, document);
      const newFileName = file.fileName.replace(/\.pdf$/i, '') + ' - 필기본.pdf';
      const fileObj = new File([pdfBlob], newFileName, { type: 'application/pdf' });
      
      if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        try {
          await navigator.share({
            files: [fileObj],
            title: newFileName
          });
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            console.error('Share failed', shareErr);
          }
        }
      } else {
        // Fallback download
        const url = URL.createObjectURL(pdfBlob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = newFileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('공유하지 못했습니다.');
    } finally {
      setIsCreatingPdf(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      const confirm = window.confirm('저장되지 않은 필기가 있습니다.\n저장하지 않고 닫으면 작성한 필기가 사라집니다.');
      if (!confirm) return;
    }
    onClose();
  };

  if (!file || !file.storagePath) {
    return (
      <div 
        className="fixed z-50 isolate overflow-hidden bg-stone-900 grid grid-rows-[auto_minmax(0,1fr)_auto]"
        style={{
          top: `${viewerViewportRect.top}px`,
          left: `${viewerViewportRect.left}px`,
          width: `${viewerViewportRect.width}px`,
          height: `${viewerViewportRect.height}px`,
          maxWidth: `${viewerViewportRect.width}px`,
          maxHeight: `${viewerViewportRect.height}px`,
        }}
      >
        <div className="relative z-40 h-14 bg-stone-800 border-b border-white/10 flex items-center px-4 shrink-0 safe-top">
          <button onClick={handleClose} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X size={24} />
          </button>
          <span className="text-white font-medium ml-2">오류</span>
        </div>
        <div className="relative z-0 flex items-center justify-center p-8 text-stone-400">
          <p>PDF 파일 경로를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50 isolate overflow-hidden bg-stone-900 grid grid-rows-[auto_minmax(0,1fr)_auto]"
      style={{
        top: `${viewerViewportRect.top}px`,
        left: `${viewerViewportRect.left}px`,
        width: `${viewerViewportRect.width}px`,
        height: `${viewerViewportRect.height}px`,
        maxWidth: `${viewerViewportRect.width}px`,
        maxHeight: `${viewerViewportRect.height}px`,
      }}
    >
      {/* Top Bar */}
      <div className="relative z-40 h-12 md:h-14 bg-stone-800 border-b border-white/10 flex items-center justify-between px-2 md:px-4 shrink-0 min-w-0 safe-top">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button onClick={handleClose} className="p-1.5 md:p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0">
            <X size={24} />
          </button>
          <span className="text-white font-medium truncate min-w-0">{file.fileName}</span>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {saveMessage && <span className="text-emerald-400 text-sm hidden md:inline">{saveMessage}</span>}
          {user && (
            <>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                title="필기 저장"
                aria-label="필기 저장"
                className="flex items-center gap-1 p-2 md:px-3 md:py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                <Save size={18} className="md:w-4 md:h-4" />
                <span className="hidden md:inline">{isSaving ? '저장 중' : '필기 저장'}</span>
              </button>
              
              <button 
                onClick={handleCreateAnnotatedPdf} 
                disabled={isCreatingPdf}
                title="필기본 저장"
                aria-label="필기본 저장"
                className="flex items-center gap-1 p-2 md:px-3 md:py-1.5 bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                <div className="w-[18px] h-[18px] md:w-4 md:h-4 flex items-center justify-center">
                  <FilePdfIcon />
                </div>
                <span className="hidden md:inline">필기본 저장</span>
              </button>

              <button 
                onClick={handleShare} 
                disabled={isCreatingPdf}
                title="공유"
                aria-label="공유"
                className="flex items-center gap-1 p-2 md:px-3 md:py-1.5 bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                <Share size={18} className="md:w-4 md:h-4" />
                <span className="hidden md:inline">공유</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 flex justify-center px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch]">
        <PdfPageCanvas
          storagePath={file.storagePath}
          pageNumber={currentPage}
          onPageCountChange={setPageCount}
          strokes={currentPageStrokes}
          onStrokesChange={handleStrokesChange}
          currentTool={currentTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onDirtyChange={setIsDirty}
          onPreviousPage={() => {
            changePage(-1);
          }}
          onNextPage={() => {
            changePage(1);
          }}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < pageCount}
        />
      </div>

      {/* Bottom Toolbar */}
      <div 
        ref={bottomToolbarRef}
        data-score-viewer-bottom-toolbar
        className="relative z-40 shrink-0 min-w-0 w-full max-w-full min-h-[3.5rem] max-h-[45svh] overflow-x-hidden overflow-y-auto overscroll-contain bg-stone-800 border-t border-white/10 pt-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-auto md:p-4 md:max-h-none md:overflow-visible"
      >
        <div className="w-full max-w-4xl mx-auto min-w-0 flex flex-col gap-2 md:gap-4">
          
          {/* First Line: Basic Controls */}
          <div 
            data-score-viewer-primary-toolbar
            className="relative z-10 shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-1 w-full bg-stone-800"
          >
            
            {/* Page Navigation */}
            <div className="flex items-center gap-1 bg-stone-900 rounded-lg p-1">
              <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="이전 페이지" aria-label="이전 페이지">
                <ChevronLeft size={20} />
              </button>
              <span className="text-stone-300 text-sm min-w-[3rem] whitespace-nowrap text-center">{currentPage} / {pageCount}</span>
              <button onClick={() => changePage(1)} disabled={currentPage >= pageCount} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="다음 페이지" aria-label="다음 페이지">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center justify-center gap-1 min-w-0">
              <ToolButton active={currentTool === 'none'} onClick={() => setCurrentTool('none')} icon={<MousePointer2 size={20} />} title="보기" />
              <div className="w-px h-6 bg-white/10 mx-0.5 md:mx-1 hidden sm:block"></div>
              <ToolButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<Pen size={20} />} title="펜" />
              <ToolButton active={currentTool === 'highlighter'} onClick={() => setCurrentTool('highlighter')} icon={<Highlighter size={20} />} title="형광펜" />
              <ToolButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={20} />} title="지우개" />
            </div>
            
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 min-w-0">
              <div className="w-px h-6 bg-white/10 mx-0.5 md:mx-1 hidden sm:block"></div>
              <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="실행 취소" aria-label="실행 취소"><Undo size={20} /></button>
              <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30" title="다시 실행" aria-label="다시 실행"><Redo size={20} /></button>
            </div>
          </div>

          {/* Second Line: Properties */}
          {currentTool !== 'none' && currentTool !== 'eraser' && (
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1">
              <div className="flex items-center gap-3 w-max min-w-full justify-center md:justify-start mx-auto md:mx-0">
                <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">
                  {['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#000000', '#ffffff'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setStrokeColor(c)}
                      className={`w-7 h-7 md:w-6 md:h-6 rounded-full border-2 ${strokeColor === c ? 'border-brand' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      title="색상 변경"
                      aria-label={`색상 ${c}`}
                    />
                  ))}
                </div>
                
                <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">
                  {[1, 2, 3].map(w => (
                    <button
                      key={w}
                      onClick={() => setStrokeWidth(w)}
                      className={`w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded ${strokeWidth === w ? 'bg-stone-700 text-brand' : 'text-stone-400 hover:text-white'}`}
                      title={`굵기 ${w}`}
                      aria-label={`굵기 ${w}`}
                    >
                      <div className="bg-current rounded-full" style={{ width: w * 2 + 2, height: w * 2 + 2 }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, title }: { active: boolean, onClick: () => void, icon: React.ReactNode, title: string }) {
  return (
    <button 
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 md:p-2 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-brand/20 text-brand' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
    >
      <div className="w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
    </button>
  );
}

function FilePdfIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
