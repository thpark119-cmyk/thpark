import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Share, ChevronLeft, ChevronRight, Pen, Highlighter, Eraser, Undo, Redo, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react';
import { CloudScoreFile } from '../../types/cloudFiles';
import { ScoreAnnotationTool, ScoreAnnotationDocument, ScoreAnnotationStroke } from './annotationTypes';
import { loadScoreAnnotations, saveScoreAnnotations } from '../../utils/scoreAnnotationStorage';
import { createAnnotatedPdf } from '../../utils/annotatedPdfExport';
import { uploadFileToStorage } from '../../utils/cloudStorage';
import { buildScoreFileStoragePath } from '../../utils/storagePaths';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import PdfPageCanvas from './PdfPageCanvas';

interface ScoreViewerProps {
  file: CloudScoreFile;
  repertoireId: string;
  onClose: () => void;
  onAnnotatedPdfSaved?: (newFile: CloudScoreFile) => void;
}

export default function ScoreViewer({ file, repertoireId, onClose, onAnnotatedPdfSaved }: ScoreViewerProps) {
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
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newStrokes);
    
    // Limit history size to 50
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(newHistory.length - 1);
    }
    
    setHistory(newHistory);
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
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      updateDocumentStrokes(history[newIndex]);
      setIsDirty(true);
    } else if (historyIndex === 0) {
      // Undo to initial state (empty or loaded state)
      setHistoryIndex(-1);
      // For simplicity, just empty it if we undo all the way.
      // Ideally we should record the initial state in history[0].
      updateDocumentStrokes([]);
      setIsDirty(true);
    }
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
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
        <div className="h-14 bg-stone-800 border-b border-white/10 flex items-center px-4 shrink-0 safe-top">
          <button onClick={handleClose} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X size={24} />
          </button>
          <span className="text-white font-medium ml-2">오류</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-stone-400">
          <p>PDF 파일 경로를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col overflow-hidden h-[100dvh]">
      {/* Top Bar */}
      <div className="h-14 bg-stone-800 border-b border-white/10 flex items-center justify-between px-4 shrink-0 safe-top">
        <div className="flex items-center gap-4">
          <button onClick={handleClose} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X size={24} />
          </button>
          <span className="text-white font-medium truncate max-w-[200px] md:max-w-md">{file.fileName}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {saveMessage && <span className="text-emerald-400 text-sm hidden md:inline">{saveMessage}</span>}
          {user && (
            <>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                <span className="hidden md:inline">{isSaving ? '저장 중' : '필기 저장'}</span>
              </button>
              
              <button 
                onClick={handleCreateAnnotatedPdf} 
                disabled={isCreatingPdf}
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                <FilePdfIcon />
                <span className="hidden md:inline">필기본 저장</span>
              </button>

              <button 
                onClick={handleShare} 
                disabled={isCreatingPdf}
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                <Share size={16} />
                <span className="hidden md:inline">공유</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 min-w-0 overflow-auto relative bg-stone-900 flex justify-center py-4">
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
      <div className="bg-stone-800 border-t border-white/10 p-2 md:p-4 shrink-0 safe-bottom">
        <div className="flex flex-wrap items-center justify-between gap-4 max-w-4xl mx-auto">
          
          {/* Page Navigation */}
          <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1">
            <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className="p-2 text-stone-400 hover:text-white disabled:opacity-30">
              <ChevronLeft size={20} />
            </button>
            <span className="text-stone-300 text-sm min-w-[3rem] text-center">{currentPage} / {pageCount}</span>
            <button onClick={() => changePage(1)} disabled={currentPage >= pageCount} className="p-2 text-stone-400 hover:text-white disabled:opacity-30">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Drawing Tools */}
          <div className="flex items-center gap-2">
            <ToolButton active={currentTool === 'none'} onClick={() => setCurrentTool('none')} icon={<MousePointer2 size={20} />} title="보기" />
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <ToolButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<Pen size={20} />} title="펜" />
            <ToolButton active={currentTool === 'highlighter'} onClick={() => setCurrentTool('highlighter')} icon={<Highlighter size={20} />} title="형광펜" />
            <ToolButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={20} />} title="지우개" />
            
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={handleUndo} disabled={historyIndex < 0} className="p-2 text-stone-400 hover:text-white disabled:opacity-30" title="실행 취소"><Undo size={20} /></button>
            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 text-stone-400 hover:text-white disabled:opacity-30" title="다시 실행"><Redo size={20} /></button>
          </div>

          {/* Properties */}
          {currentTool !== 'none' && currentTool !== 'eraser' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1">
                {['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#000000', '#ffffff'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setStrokeColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${strokeColor === c ? 'border-brand' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              
              <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1">
                {[1, 2, 3].map(w => (
                  <button
                    key={w}
                    onClick={() => setStrokeWidth(w)}
                    className={`w-8 h-8 flex items-center justify-center rounded ${strokeWidth === w ? 'bg-stone-700 text-brand' : 'text-stone-400 hover:text-white'}`}
                  >
                    <div className="bg-current rounded-full" style={{ width: w * 2 + 2, height: w * 2 + 2 }} />
                  </button>
                ))}
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
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-brand/20 text-brand' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
    >
      {icon}
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
