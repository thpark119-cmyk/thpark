import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, FileText, Search, MoreHorizontal, X, Music, Upload, File as FileIcon, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { RepertoireItem } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { validateScoreUploadFile, getSafeFileExtension } from '../utils/fileValidation';
import { uploadFileToStorage, deleteFileFromStorage } from '../utils/cloudStorage';
import { buildScoreFileStoragePath } from '../utils/storagePaths';
import { CloudScoreFile } from '../types/cloudFiles';
import CloudScoreFileView from './CloudScoreFileView';

const MAX_SCORE_FILES_PER_ITEM = 5;

export default function Repertoire() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [items, setItems] = useState<RepertoireItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [imslpQuery, setImslpQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPiece, setNewPiece] = useState({ 
    title: '', 
    composer: '', 
    notes: '', 
    status: 'Learning' as const, 
    date: new Date().toISOString().split('T')[0],
    files: [] as File[] 
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [editingItem, setEditingItem] = useState<RepertoireItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    composer: '',
    status: 'Learning' as 'Learning' | 'Polishing' | 'Completed',
    notes: '',
    date: '',
    newFiles: [] as File[]
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCollection<RepertoireItem>('repertoire', (data) => {
      setItems(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiece.title || !newPiece.composer) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      const cloudFiles: CloudScoreFile[] = [];
      const repertoireId = crypto.randomUUID();

      if (user && newPiece.files.length > 0) {
        for (const file of newPiece.files) {
          const fileId = crypto.randomUUID();
          const ext = getSafeFileExtension(file);
          const storagePath = buildScoreFileStoragePath({
            uid: user.uid,
            repertoireId,
            fileId,
            ext: ext || 'pdf'
          });

          await uploadFileToStorage({
            file,
            storagePath,
            contentType: file.type
          });

          cloudFiles.push({
            id: fileId,
            storagePath,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
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
      
      setIsAdding(false);
      setNewPiece({ 
        title: '', 
        composer: '', 
        notes: '', 
        status: 'Learning', 
        date: new Date().toISOString().split('T')[0],
        files: [] 
      });
    } catch (err) {
      console.error(err);
      setUploadError(t('repertoire.uploadFailed') || 'Failed to upload files. Please check your network connection.');
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
      date: item.date || '',
      newFiles: []
    });
    setUploadError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.title || !editForm.composer) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      const cloudFiles = [...(editingItem.files || [])];

      if (user && editForm.newFiles.length > 0) {
        for (const file of editForm.newFiles) {
          const fileId = crypto.randomUUID();
          const ext = getSafeFileExtension(file);
          const storagePath = buildScoreFileStoragePath({
            uid: user.uid,
            repertoireId: editingItem.id,
            fileId,
            ext: ext || 'pdf'
          });

          await uploadFileToStorage({
            file,
            storagePath,
            contentType: file.type
          });

          cloudFiles.push({
            id: fileId,
            storagePath,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
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
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      setUploadError(t('repertoire.uploadFailed') || 'Failed to upload files. Please check your network connection.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete') || 'Are you sure you want to delete this?')) return;
    
    const itemToDelete = items.find(i => i.id === id);
    if (itemToDelete?.files && itemToDelete.files.length > 0) {
      for (const file of itemToDelete.files) {
        try {
          await deleteFileFromStorage(file.storagePath);
        } catch (e) {
          console.warn('Failed to delete file from storage', e);
        }
      }
    }
    
    // Legacy file delete
    if (itemToDelete?.storagePath) {
       try {
         await deleteFileFromStorage(itemToDelete.storagePath);
       } catch (e) {
         console.warn('Failed to delete legacy file from storage', e);
       }
    }
    
    await deleteRecord('repertoire', id, user);
  };

  const handleDeleteExistingFile = async (fileToDelete: CloudScoreFile) => {
    if (!editingItem) return;
    if (!window.confirm(t('common.confirmDelete') || 'Are you sure you want to delete this file?')) return;
    
    try {
      await deleteFileFromStorage(fileToDelete.storagePath);
      const updatedFiles = (editingItem.files || []).filter(f => f.id !== fileToDelete.id);
      
      await updateRecord('repertoire', editingItem.id, { files: updatedFiles }, user);
      
      setEditingItem({
        ...editingItem,
        files: updatedFiles
      });
    } catch (e) {
      console.error('Failed to delete file', e);
      alert(t('repertoire.deleteFileFailed') || 'Failed to delete file. Please check your network connection and try again.');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    let currentCount = 0;
    if (isEdit && editingItem) {
      currentCount = (editingItem.files?.length || 0) + editForm.newFiles.length;
    } else {
      currentCount = newPiece.files.length;
    }

    if (currentCount + files.length > MAX_SCORE_FILES_PER_ITEM) {
      alert((t('repertoire.fileLimitReached') || 'You can attach up to 5 files per repertoire.') + ` (${MAX_SCORE_FILES_PER_ITEM})`);
      e.target.value = '';
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      const validation = validateScoreUploadFile(file);
      if (!validation.ok) {
        alert(`${file.name}: ${validation.reason}`);
        continue;
      }
      validFiles.push(file);
    }

    if (isEdit) {
      setEditForm({ ...editForm, newFiles: [...editForm.newFiles, ...validFiles] });
    } else {
      setNewPiece({ ...newPiece, files: [...newPiece.files, ...validFiles] });
    }
    e.target.value = '';
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
                  <CloudScoreFileView key={file.id} file={file} readOnly />
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
              onClick={() => setIsAdding(false)}
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
                <button onClick={() => setIsAdding(false)} className="text-stone-600 hover:text-white transition-colors"><X size={24} /></button>
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
                    <span className="text-[10px] text-stone-500 font-bold">{newPiece.files.length}/{MAX_SCORE_FILES_PER_ITEM}</span>
                  </div>
                  
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
                      {t('repertoire.loginRequiredForFile') || 'Score file upload is available after signing in with Google. Signed-in files are linked to your account and can be accessed across devices.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div 
                        onClick={() => {
                          if (newPiece.files.length < MAX_SCORE_FILES_PER_ITEM) fileInputRef.current?.click();
                        }}
                        className={`w-full border-dashed rounded-2xl py-4 px-5 flex flex-col items-center justify-center gap-2 transition-colors ${
                          newPiece.files.length >= MAX_SCORE_FILES_PER_ITEM 
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
                          disabled={newPiece.files.length >= MAX_SCORE_FILES_PER_ITEM}
                        />
                        <Upload size={20} className="text-stone-500"/>
                        <div className="text-center">
                          <span className="text-xs text-stone-400 font-medium block mb-1">{t('repertoire.chooseFile') || 'Attach PDF or Images'}</span>
                          <span className="text-[10px] text-stone-600">PDF (Max 15MB) / Image (Max 5MB)</span>
                        </div>
                      </div>
                      
                      {newPiece.files.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {newPiece.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-stone-800 rounded-xl border border-white/5">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileIcon size={16} className="text-brand shrink-0" />
                                <span className="text-xs text-stone-300 truncate">{file.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewPiece({ ...newPiece, files: newPiece.files.filter((_, i) => i !== idx) })}
                                className="text-stone-500 hover:text-red-400 p-1 rounded-md transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {uploadError && <p className="text-xs text-red-400 text-center">{uploadError}</p>}

                <button type="submit" disabled={isUploading} className="w-full mt-4 bg-brand h-14 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
                if (!isUploading) setEditingItem(null);
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
                <button onClick={() => !isUploading && setEditingItem(null)} className="text-stone-600 hover:text-white transition-colors" disabled={isUploading}><X size={24} /></button>
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
                      {(editingItem.files?.length || 0) + editForm.newFiles.length}/{MAX_SCORE_FILES_PER_ITEM}
                    </span>
                  </div>
                  
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
                      {t('repertoire.loginRequiredForFile') || 'Score file upload is available after signing in with Google. Signed-in files are linked to your account and can be accessed across devices.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div 
                        onClick={() => {
                          if ((editingItem.files?.length || 0) + editForm.newFiles.length < MAX_SCORE_FILES_PER_ITEM) {
                            editFileInputRef.current?.click();
                          }
                        }}
                        className={`w-full border-dashed rounded-2xl py-4 px-5 flex flex-col items-center justify-center gap-2 transition-colors ${
                          (editingItem.files?.length || 0) + editForm.newFiles.length >= MAX_SCORE_FILES_PER_ITEM 
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
                          disabled={(editingItem.files?.length || 0) + editForm.newFiles.length >= MAX_SCORE_FILES_PER_ITEM}
                        />
                        <Upload size={20} className="text-stone-500"/>
                        <div className="text-center">
                          <span className="text-xs text-stone-400 font-medium block mb-1">{t('repertoire.chooseFile') || 'Attach PDF or Images'}</span>
                          <span className="text-[10px] text-stone-600">PDF (Max 15MB) / Image (Max 5MB)</span>
                        </div>
                      </div>
                      
                      {((editingItem.files?.length || 0) > 0 || editForm.newFiles.length > 0 || editingItem.fileUrl) && (
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
                          {editingItem.files?.map(file => (
                            <CloudScoreFileView 
                              key={file.id} 
                              file={file} 
                              onDelete={() => handleDeleteExistingFile(file)} 
                            />
                          ))}
                          {editForm.newFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-stone-800 rounded-xl border border-brand/20">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileIcon size={16} className="text-brand shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs text-stone-200 font-medium truncate block">{file.name}</span>
                                  <span className="text-[10px] text-brand uppercase">{t('common.new') || 'New'}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, newFiles: editForm.newFiles.filter((_, i) => i !== idx) })}
                                className="text-stone-500 hover:text-red-400 p-1 rounded-md transition-colors"
                              >
                                <X size={14} />
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
                  <button type="button" disabled={isUploading} onClick={() => setEditingItem(null)} className="w-1/3 bg-stone-800 h-14 rounded-2xl text-stone-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isUploading} className="flex-1 bg-brand h-14 rounded-2xl text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isUploading ? <><Loader2 size={16} className="animate-spin" /> {t('common.uploading') || 'Uploading...'}</> : (t('common.save') || 'Save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
