import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, FileText, Search, MoreHorizontal, X, Music, Upload, File as FileIcon, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { RepertoireItem } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { validateScoreUploadFile, getSafeFileExtension } from '../utils/fileValidation';
import { deleteFileFromStorage, uploadFileToStorage } from '../utils/cloudStorage';
import { deleteScoreAnnotations } from '../utils/scoreAnnotationStorage';
import { buildScoreFileStoragePath } from '../utils/storagePaths';
import { CloudScoreFile, PendingScoreFileUpload, PendingScoreFileDelete } from '../types/cloudFiles';
import { compressImageForUpload } from '../utils/imageCompression';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import CloudScoreFileView from './CloudScoreFileView';
import ScoreViewer from './score-viewer/ScoreViewer';

interface RepertoireProps {
  onScoreViewerOpenChange?: (isOpen: boolean) => void;
}

const MAX_SCORE_FILES_PER_ITEM = 5;

export default function Repertoire({ onScoreViewerOpenChange }: RepertoireProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [items, setItems] = useState<RepertoireItem[]>([]);
  const [activePdfFile, setActivePdfFile] = useState<{file: CloudScoreFile, repertoireId: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [imslpQuery, setImslpQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPiece, setNewPiece] = useState({ 
    title: '', 
    composer: '', 
    notes: '', 
    status: 'Learning' as const, 
    date: new Date().toISOString().split('T')[0]
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [editingItem, setEditingItem] = useState<RepertoireItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    composer: '',
    status: 'Learning' as 'Learning' | 'Polishing' | 'Completed',
    notes: '',
    date: ''
  });

  const [pendingFiles, setPendingFiles] = useState<PendingScoreFileUpload[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<PendingScoreFileDelete[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Lock scroll when any modal/overlay is open
  useBodyScrollLock(isAdding || !!editingItem);

  useEffect(() => {
    onScoreViewerOpenChange?.(activePdfFile !== null);
  }, [activePdfFile, onScoreViewerOpenChange]);

  useEffect(() => {
    return () => {
      onScoreViewerOpenChange?.(false);
    };
  }, [onScoreViewerOpenChange]);

  useEffect(() => {
    const unsubscribe = subscribeToCollection<RepertoireItem>('repertoire', (data) => {
      setItems(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const handleCancel = () => {
    pendingFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setPendingFiles([]);
    setPendingDeletes([]);
    setUploadError('');
    setIsAdding(false);
    setEditingItem(null);
    setNewPiece({ 
      title: '', 
      composer: '', 
      notes: '', 
      status: 'Learning', 
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiece.title || !newPiece.composer) return;
    
    setIsUploading(true);
    setUploadError('');
    const uploadedPaths: string[] = [];
    try {
      const cloudFiles: CloudScoreFile[] = [];
      const repertoireId = crypto.randomUUID();

      if (user && pendingFiles.length > 0) {
        for (const pFile of pendingFiles) {
          const storagePath = buildScoreFileStoragePath({
            uid: user.uid,
            repertoireId,
            fileId: pFile.id,
            ext: pFile.extension
          });

          await uploadFileToStorage({
            file: pFile.file,
            storagePath,
            contentType: pFile.contentType
          });
          uploadedPaths.push(storagePath);

          cloudFiles.push({
            id: pFile.id,
            storagePath,
            fileName: pFile.fileName,
            contentType: pFile.contentType,
            size: pFile.size,
            createdAt: new Date().toISOString(),
            uploadedAt: new Date().toISOString(),
            source: 'firebase-storage'
          });
        }
      }
      
      const record: RepertoireItem = {
        id: repertoireId,
        userId: user?.uid || 'local',
        title: newPiece.title,
        composer: newPiece.composer,
        notes: newPiece.notes,
        status: newPiece.status,
        date: newPiece.date,
        sheetMusicUrl: '#',
        files: cloudFiles
      };
      
      await addRecord('repertoire', record, user);
      
      pendingFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setPendingFiles([]);
      setIsAdding(false);
      setNewPiece({ 
        title: '', 
        composer: '', 
        notes: '', 
        status: 'Learning', 
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error(err);
      setUploadError(t('repertoire.uploadFailed') || 'Failed to upload files. Please check your network connection.');
      // Rollback uploaded files
      for (const path of uploadedPaths) {
        try {
          await deleteFileFromStorage(path);
        } catch (rollbackErr) {
          console.warn('Rollback delete failed for', path, rollbackErr);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditClick = (item: RepertoireItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      composer: item.composer,
      status: item.status || 'Learning',
      notes: item.notes || '',
      date: item.date || ''
    });
    setPendingFiles([]);
    setPendingDeletes([]);
    setUploadError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.title || !editForm.composer) return;
    
    setIsUploading(true);
    setUploadError('');
    const uploadedPaths: string[] = [];
    try {
      const cloudFiles = [...(editingItem.files || [])].filter(
        f => !pendingDeletes.some(d => d.id === f.id)
      );

      if (user && pendingFiles.length > 0) {
        for (const pFile of pendingFiles) {
          const storagePath = buildScoreFileStoragePath({
            uid: user.uid,
            repertoireId: editingItem.id,
            fileId: pFile.id,
            ext: pFile.extension
          });

          await uploadFileToStorage({
            file: pFile.file,
            storagePath,
            contentType: pFile.contentType
          });
          uploadedPaths.push(storagePath);

          cloudFiles.push({
            id: pFile.id,
            storagePath,
            fileName: pFile.fileName,
            contentType: pFile.contentType,
            size: pFile.size,
            createdAt: new Date().toISOString(),
            uploadedAt: new Date().toISOString(),
            source: 'firebase-storage'
          });
        }
      }
      
      const record = {
        title: editForm.title,
        composer: editForm.composer,
        status: editForm.status,
        notes: editForm.notes,
        date: editForm.date,
        files: cloudFiles
      };

      await updateRecord('repertoire', editingItem.id, record, user);

      // Perform actual storage deletion only after Firestore update succeeds
      let deleteFailed = false;
      for (const delFile of pendingDeletes) {
        try {
          console.log('[Mio Storage Delete]', {
            action: 'delete_score_file_after_update',
            repertoireId: editingItem.id,
            storagePath: delFile.storagePath
          });
          await deleteFileFromStorage(delFile.storagePath);
          await deleteScoreAnnotations(user!.uid, editingItem.id, delFile.id);
        } catch (delErr) {
          console.error('Failed to delete file from storage during update finalization:', delFile.storagePath, delErr);
          deleteFailed = true;
        }
      }
      if (deleteFailed) {
        alert(t('common.partialDeleteError') || 'Some files could not be deleted from the cloud.');
      }

      pendingFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setPendingFiles([]);
      setPendingDeletes([]);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      setUploadError(t('repertoire.uploadFailed') || 'Failed to upload files. Please check your network connection.');
      // Rollback newly uploaded files on failure
      for (const path of uploadedPaths) {
        try {
          await deleteFileFromStorage(path);
        } catch (rollbackErr) {
          console.warn('Rollback delete failed for', path, rollbackErr);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete') || 'Are you sure you want to delete this?')) return;
    
    const itemToDelete = items.find(i => i.id === id);
    let storageDeleteFailed = false;

    if (itemToDelete?.files && itemToDelete.files.length > 0) {
      for (const file of itemToDelete.files) {
        try {
          console.log('[Mio Storage Delete]', {
            action: 'delete_repertoire_record_file',
            recordId: id,
            storagePath: file.storagePath,
          });
          await deleteFileFromStorage(file.storagePath);
          await deleteScoreAnnotations(user!.uid, id, file.id);
        } catch (e: any) {
          console.error('Failed to delete file from storage', file.storagePath, e);
          storageDeleteFailed = true;
        }
      }
    }
    
    // Legacy file delete
    if (itemToDelete?.storagePath) {
       try {
          console.log('[Mio Storage Delete]', {
            action: 'delete_repertoire_record_legacy_file',
            recordId: id,
            storagePath: itemToDelete.storagePath,
          });
          await deleteFileFromStorage(itemToDelete.storagePath);
       } catch (e: any) {
          console.error('Failed to delete legacy file from storage', itemToDelete.storagePath, e);
          storageDeleteFailed = true;
       }
    }
    
    if (storageDeleteFailed) {
      alert(t('repertoire.deleteFileFailed') || 'Failed to delete file. Please check your network connection and try again.');
      return;
    }

    try {
      await deleteRecord('repertoire', id, user);
    } catch (e) {
      console.error('Failed to delete repertoire record', e);
      alert(t('common.deleteFailed') || 'Failed to delete record.');
    }
  };

  const handleImslpSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imslpQuery.trim()) {
      alert(t('repertoire.imslpEmptyQuery'));
      return;
    }
    const query = encodeURIComponent(imslpQuery.trim());
    const url = `https://imslp.org/index.php?title=Special:Search&search=${query}&fulltext=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImslpDirect = () => {
    window.open('https://imslp.org/', '_blank', 'noopener,noreferrer');
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.composer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapStatus = (statusInput: string) => {
    const s = statusInput.toLowerCase();
    if (s === 'learning') return t('status.learning');
    if (s === 'polishing') return t('status.polishing');
    if (s === 'completed') return t('status.completed');
    return statusInput;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const locales: Record<string, string> = { ko: 'ko-KR', en: 'en-US', de: 'de-DE' };
      return new Intl.DateTimeFormat(locales[language] || 'ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    } catch (e) {
      return dateStr.replace(/-/g, '.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;
    
    let currentActiveCount = 0;
    if (isEdit && editingItem) {
      const activeExistingCount = (editingItem.files || []).filter(
        f => !pendingDeletes.some(d => d.id === f.id)
      ).length;
      currentActiveCount = activeExistingCount + pendingFiles.length;
    } else {
      currentActiveCount = pendingFiles.length;
    }

    if (currentActiveCount + selectedFiles.length > MAX_SCORE_FILES_PER_ITEM) {
      alert((t('repertoire.fileLimitReached') || 'You can attach up to 5 files per repertoire.') + ` (${MAX_SCORE_FILES_PER_ITEM})`);
      e.target.value = '';
      return;
    }

    setIsCompressing(true);
    try {
      const newPending: PendingScoreFileUpload[] = [];

      for (const file of selectedFiles) {
        const isPdf = file.type === 'application/pdf';
        const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

        if (!isPdf && !isImage) {
          alert(`${file.name}: ${t('repertoire.invalidFileType') || 'Only PDF, JPG, PNG, and WebP are allowed.'}`);
          continue;
        }

        if (isPdf) {
          const validation = validateScoreUploadFile(file);
          if (!validation.ok) {
            alert(`${file.name}: ${validation.reason}`);
            continue;
          }

          newPending.push({
            id: crypto.randomUUID(),
            file,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
            extension: getSafeFileExtension(file) || 'pdf',
            isImage: false
          });
        } else if (isImage) {
          const validation = validateScoreUploadFile(file);
          if (!validation.ok) {
            alert(`${file.name}: ${validation.reason}`);
            continue;
          }

          try {
            const compressed = await compressImageForUpload(file, {
              maxLongEdge: 1600,
              targetBytes: 900 * 1024,
              maxBytes: 950 * 1024
            });

            const compFile = new File([compressed.blob], file.name, { type: compressed.contentType });
            const validationComp = validateScoreUploadFile(compFile, { isCompressed: true });
            if (!validationComp.ok) {
              alert(`${file.name}: ${validationComp.reason}`);
              continue;
            }

            const previewUrl = URL.createObjectURL(compressed.blob);
            newPending.push({
              id: crypto.randomUUID(),
              file: compFile,
              previewUrl,
              fileName: file.name,
              contentType: compressed.contentType,
              size: compressed.compressedSize,
              extension: compressed.extension,
              originalSize: compressed.originalSize,
              compressedSize: compressed.compressedSize,
              isImage: true
            });
          } catch (compErr) {
            console.error('Image compression error', compErr);
            alert(`${file.name}: ${t('repertoire.compressFailed') || 'Compression failed.'}`);
          }
        }
      }

      setPendingFiles(prev => [...prev, ...newPending]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">{t('repertoire.title')}</h2>
        <button 
          onClick={() => {
            setIsAdding(true);
            setUploadError('');
          }}
          className="bg-brand w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand/20 active:scale-90 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="bg-stone-900 border border-white/5 p-6 rounded-[28px] space-y-4 shadow-xl shadow-black/10">
        <div>
          <h3 className="text-lg font-serif italic text-white leading-tight">{t('repertoire.findImslp')}</h3>
          <p className="text-xs text-stone-500 mt-1">{t('repertoire.findImslpDesc')}</p>
        </div>
        
        <form onSubmit={handleImslpSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
            <input 
              type="text" 
              placeholder={t('repertoire.imslpPlaceholder')}
              className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-stone-200 placeholder:text-stone-600 outline-none focus:ring-1 focus:ring-brand/30 transition-all text-sm"
              value={imslpQuery}
              onChange={(e) => setImslpQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-stone-200 text-stone-900 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all">
              {t('repertoire.imslpSearch')}
            </button>
            <button type="button" onClick={handleImslpDirect} className="flex-1 bg-stone-800 text-stone-300 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all">
              {t('repertoire.imslpDirect')}
            </button>
          </div>
        </form>
        <p className="text-[10px] text-stone-600">{t('repertoire.imslpWarning')}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
        <input 
          type="text" 
          placeholder={t('repertoire.search')}
          className="w-full bg-stone-900/50 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-stone-200 placeholder:text-stone-700 outline-none focus:ring-1 focus:ring-brand/30 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px] flex flex-col gap-4 transition-all group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center text-brand group-hover:scale-105 transition-transform shrink-0">
                <FileText size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest truncate">{item.composer}</p>
                <h3 className="text-lg font-serif italic text-stone-200 truncate leading-tight">{item.title}</h3>
                {item.date && (
                  <p className="text-[10px] font-mono text-stone-500 font-bold bg-white/5 px-2 py-0.5 rounded-full inline-block mt-1">{formatDate(item.date)}</p>
                )}
                {item.notes && (
                  <p className="text-xs text-stone-500 mt-1 truncate max-w-sm">{item.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter ${
                  item.status === 'Learning' ? 'bg-amber-500/10 text-amber-500' :
                  item.status === 'Polishing' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-800 text-stone-400'
                }`}>
                  {mapStatus(item.status)}
                </span>
                <div className="flex items-center gap-1.5 mt-auto">
                  <button 
                    onClick={() => handleEditClick(item)}
                    className="text-[10px] font-bold text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-stone-800 px-2 py-1 rounded-lg border border-white/5 transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(item.id)}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 px-2 py-1 rounded-lg border border-red-500/10 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
            
            {((item.files && item.files.length > 0) || item.fileUrl) && (
              <div className="pt-3 border-t border-white/5 space-y-2">
                {item.fileUrl && (
                  <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <FileIcon size={16} className="text-stone-400" />
                      <div>
                        <p className="text-xs text-stone-300">{item.fileName || 'Legacy File'}</p>
                        <p className="text-[10px] text-stone-500">Legacy File</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => window.open(item.fileUrl, '_blank')}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-brand/20 text-stone-400 hover:text-brand flex items-center justify-center transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                )}
                {item.files?.map(file => (
                  <div key={file.id}>
                    <CloudScoreFileView 
                      file={file} 
                      readOnly 
                      onOpenPdf={(f) => setActivePdfFile({ file: f, repertoireId: item.id })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Music size={40} className="mx-auto text-stone-800 opacity-50" />
            <p className="text-sm font-medium text-stone-600 uppercase tracking-widest">{t('repertoire.empty')}</p>
          </div>
        )}
      </div>

      {/* Add Modal & Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden bg-stone-900 border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl custom-scrollbar"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">{t('repertoire.addPiece')}</h3>
                <button onClick={handleCancel} className="text-stone-600 hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.titleLabel')}</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                    value={newPiece.title}
                    onChange={e => setNewPiece({...newPiece, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.composerLabel')}</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                      value={newPiece.composer}
                      onChange={e => setNewPiece({...newPiece, composer: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.dateLabel')}</label>
                    <input 
                      type="date" 
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm color-scheme-dark" 
                      value={newPiece.date} 
                      onChange={e => setNewPiece({...newPiece, date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-2">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('repertoire.addFile') || 'Score Files'}</label>
                    <span className="text-[10px] text-stone-500 font-bold">{pendingFiles.length}/{MAX_SCORE_FILES_PER_ITEM}</span>
                  </div>
                  
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
                      {t('repertoire.loginRequiredForFile') || 'Score file upload is available after signing in with Google.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div 
                        onClick={() => {
                          if (pendingFiles.length < MAX_SCORE_FILES_PER_ITEM && !isCompressing) fileInputRef.current?.click();
                        }}
                        className={`w-full border-dashed rounded-2xl py-4 px-5 flex flex-col items-center justify-center gap-2 transition-colors ${
                          pendingFiles.length >= MAX_SCORE_FILES_PER_ITEM 
                            ? 'bg-stone-800/30 border-white/5 cursor-not-allowed opacity-50' 
                            : 'bg-stone-800/50 border-white/5 hover:border-brand/40 cursor-pointer'
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          multiple
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => handleFileChange(e, false)}
                          disabled={pendingFiles.length >= MAX_SCORE_FILES_PER_ITEM || isCompressing}
                        />
                        {isCompressing ? (
                          <Loader2 size={20} className="text-brand animate-spin" />
                        ) : (
                          <Upload size={20} className="text-stone-500"/>
                        )}
                        <div className="text-center">
                          <span className="text-xs text-stone-400 font-medium block mb-1">
                            {isCompressing ? t('repertoire.compressing') : (t('repertoire.chooseFile') || 'Attach PDF or Images')}
                          </span>
                          <span className="text-[10px] text-stone-600 block">PDF (Max 15MB) / Image (Max 20MB)</span>
                          <span className="text-[9px] text-stone-500 mt-1 block">
                            💡 {t('repertoire.autoCompressNotice')} {t('repertoire.pdfNoCompressNotice')}
                          </span>
                        </div>
                      </div>
                      
                      {pendingFiles.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {pendingFiles.map((pFile) => (
                            <div key={pFile.id} className="flex items-center justify-between p-3 bg-stone-800 rounded-xl border border-brand/20">
                              <div className="flex items-center gap-3 min-w-0">
                                {pFile.isImage && pFile.previewUrl ? (
                                  <img 
                                    src={pFile.previewUrl} 
                                    alt={pFile.fileName} 
                                    className="w-10 h-10 object-cover rounded-lg bg-stone-900 border border-white/10 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <FileIcon size={16} className="text-brand shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs text-stone-200 font-medium truncate block">{pFile.fileName}</span>
                                  <span className="text-[9px] text-stone-500 font-mono">
                                    {(pFile.size / 1024).toFixed(0)}KB 
                                    {pFile.originalSize && ` (compressed from ${(pFile.originalSize / 1024).toFixed(0)}KB)`}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingFiles(prev => {
                                    const target = prev.find(f => f.id === pFile.id);
                                    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                                    return prev.filter(f => f.id !== pFile.id);
                                  });
                                }}
                                className="text-stone-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                                title={t('repertoire.removeFile') || 'Remove file'}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {uploadError && <p className="text-xs text-red-400 text-center">{uploadError}</p>}

                <button type="submit" disabled={isUploading || isCompressing} className="w-full mt-4 bg-brand h-14 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUploading ? <><Loader2 size={16} className="animate-spin" /> {t('common.uploading') || 'Uploading...'}</> : (t('common.save') || 'Save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUploading) handleCancel();
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl custom-scrollbar"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">{t('repertoire.editPiece')}</h3>
                <button onClick={() => !isUploading && handleCancel()} className="text-stone-600 hover:text-white transition-colors" disabled={isUploading}><X size={24} /></button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.titleLabel')}</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.composerLabel')}</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                      value={editForm.composer}
                      onChange={e => setEditForm({...editForm, composer: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.dateLabel')}</label>
                    <input 
                      type="date" 
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm color-scheme-dark" 
                      value={editForm.date} 
                      onChange={e => setEditForm({...editForm, date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-2">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('repertoire.addFile') || 'Score Files'}</label>
                    <span className="text-[10px] text-stone-500 font-bold">
                      {((editingItem.files || []).filter(f => !pendingDeletes.some(d => d.id === f.id)).length + pendingFiles.length)}/{MAX_SCORE_FILES_PER_ITEM}
                    </span>
                  </div>
                  
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
                      {t('repertoire.loginRequiredForFile') || 'Score file upload is available after signing in with Google.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div 
                        onClick={() => {
                          const activeCount = (editingItem.files || []).filter(f => !pendingDeletes.some(d => d.id === f.id)).length + pendingFiles.length;
                          if (activeCount < MAX_SCORE_FILES_PER_ITEM && !isCompressing) {
                            editFileInputRef.current?.click();
                          }
                        }}
                        className={`w-full border-dashed rounded-2xl py-4 px-5 flex flex-col items-center justify-center gap-2 transition-colors ${
                          ((editingItem.files || []).filter(f => !pendingDeletes.some(d => d.id === f.id)).length + pendingFiles.length) >= MAX_SCORE_FILES_PER_ITEM 
                            ? 'bg-stone-800/30 border-white/5 cursor-not-allowed opacity-50' 
                            : 'bg-stone-800/50 border-white/5 hover:border-brand/40 cursor-pointer'
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={editFileInputRef} 
                          className="hidden" 
                          multiple
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => handleFileChange(e, true)}
                          disabled={((editingItem.files || []).filter(f => !pendingDeletes.some(d => d.id === f.id)).length + pendingFiles.length) >= MAX_SCORE_FILES_PER_ITEM || isCompressing}
                        />
                        {isCompressing ? (
                          <Loader2 size={20} className="text-brand animate-spin" />
                        ) : (
                          <Upload size={20} className="text-stone-500"/>
                        )}
                        <div className="text-center">
                          <span className="text-xs text-stone-400 font-medium block mb-1">
                            {isCompressing ? t('repertoire.compressing') : (t('repertoire.chooseFile') || 'Attach PDF or Images')}
                          </span>
                          <span className="text-[10px] text-stone-600 block">PDF (Max 15MB) / Image (Max 20MB)</span>
                          <span className="text-[9px] text-stone-500 mt-1 block">
                            💡 {t('repertoire.autoCompressNotice')} {t('repertoire.pdfNoCompressNotice')}
                          </span>
                        </div>
                      </div>
                      
                      {((editingItem.files?.length || 0) > 0 || pendingFiles.length > 0 || editingItem.fileUrl) && (
                        <div className="space-y-2 mt-3">
                          {editingItem.fileUrl && (
                            <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-xl border border-white/5">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileIcon size={16} className="text-stone-400 shrink-0" />
                                <span className="text-xs text-stone-300 truncate">{editingItem.fileName || 'Legacy File'}</span>
                              </div>
                              <span className="text-[10px] text-stone-500">Legacy</span>
                            </div>
                          )}

                          {editingItem.files?.map(file => {
                            const isMarkedDelete = pendingDeletes.some(d => d.id === file.id);
                            return (
                              <div 
                                key={file.id} 
                                className={`flex items-center justify-between p-3 bg-stone-800/80 rounded-xl border transition-all ${
                                  isMarkedDelete ? 'border-red-500/30 opacity-50 bg-red-950/10' : 'border-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileIcon size={16} className={isMarkedDelete ? "text-red-400 shrink-0" : "text-stone-400 shrink-0"} />
                                  <div className="min-w-0">
                                    <span className={`text-xs truncate block ${isMarkedDelete ? 'text-red-300 line-through' : 'text-stone-300'}`}>{file.fileName}</span>
                                    {isMarkedDelete && (
                                      <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">{t('repertoire.pendingDelete') || 'Pending Delete'}</span>
                                    )}
                                  </div>
                                </div>
                                
                                {isMarkedDelete ? (
                                  <button
                                    type="button"
                                    onClick={() => setPendingDeletes(prev => prev.filter(d => d.id !== file.id))}
                                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all active:scale-95 touch-manipulation"
                                  >
                                    {t('repertoire.undoDelete') || 'Undo'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPendingDeletes(prev => [...prev, { id: file.id, storagePath: file.storagePath, fileName: file.fileName }])}
                                    className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all active:scale-95 touch-manipulation"
                                  >
                                    {t('repertoire.deleteFile') || 'Delete'}
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {pendingFiles.map((pFile) => (
                            <div key={pFile.id} className="flex items-center justify-between p-3 bg-stone-800 rounded-xl border border-brand/20">
                              <div className="flex items-center gap-3 min-w-0">
                                {pFile.isImage && pFile.previewUrl ? (
                                  <img 
                                    src={pFile.previewUrl} 
                                    alt={pFile.fileName} 
                                    className="w-10 h-10 object-cover rounded-lg bg-stone-900 border border-white/10 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <FileIcon size={16} className="text-brand shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs text-stone-200 font-medium truncate block">{pFile.fileName}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-brand uppercase font-bold">{t('common.new') || 'New'}</span>
                                    <span className="text-[9px] text-stone-500 font-mono">
                                      {(pFile.size / 1024).toFixed(0)}KB 
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingFiles(prev => {
                                    const target = prev.find(f => f.id === pFile.id);
                                    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                                    return prev.filter(f => f.id !== pFile.id);
                                  });
                                }}
                                className="text-stone-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                                title={t('repertoire.removeFile') || 'Remove file'}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.statusLabel')}</label>
                  <select 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none appearance-none text-sm color-scheme-dark"
                    value={editForm.status} 
                    onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                  >
                    <option value="Learning">{t('status.learning')}</option>
                    <option value="Polishing">{t('status.polishing')}</option>
                    <option value="Completed">{t('status.completed')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.notesLabel')}</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm resize-none"
                    value={editForm.notes}
                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  />
                </div>
                
                {uploadError && <p className="text-xs text-red-400 text-center">{uploadError}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="button" disabled={isUploading || isCompressing} onClick={handleCancel} className="w-1/3 bg-stone-800 h-14 rounded-2xl text-stone-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isUploading || isCompressing} className="flex-1 bg-brand h-14 rounded-2xl text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isUploading ? <><Loader2 size={16} className="animate-spin" /> {t('common.uploading') || 'Uploading...'}</> : (t('common.save') || 'Save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activePdfFile && (
        <ScoreViewer
          file={activePdfFile.file}
          repertoireId={activePdfFile.repertoireId}
          onClose={() => setActivePdfFile(null)}
          onAnnotatedPdfSaved={(newFile) => {
            // Add the new file to the active piece
            setItems(prev => prev.map(i => {
              if (i.id === activePdfFile.repertoireId) {
                return {
                  ...i,
                  files: [...(i.files || []), newFile]
                };
              }
              return i;
            }));
            // Close the viewer or let it stay? Close it for now.
            // setActivePdfFile(null); // Or don't close, keep it open on original
          }}
        />
      )}
    </motion.div>
  );
}
