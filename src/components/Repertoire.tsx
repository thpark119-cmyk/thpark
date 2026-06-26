import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, FileText, Search, MoreHorizontal, X, Music, Upload, File as FileIcon, ExternalLink, Trash2 } from 'lucide-react';
import { RepertoireItem } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const MAX_SCORE_FILE_SIZE = 10 * 1024 * 1024;

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
    file: null as File | null 
  });
  const [isUploading, setIsUploading] = useState(false);

  const [editingItem, setEditingItem] = useState<RepertoireItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    composer: '',
    status: 'Learning' as 'Learning' | 'Polishing' | 'Completed',
    notes: '',
    date: '',
    file: null as File | null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCollection<RepertoireItem>('repertoire', (data) => {
      setItems(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const uploadFile = async (file: File) => {
    if (!user || !storage) return null;
    const fileId = Date.now().toString() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '');
    const storagePath = `users/${user.uid}/scores/${fileId}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileUrl,
      storagePath,
      uploadedAt: Date.now()
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiece.title || !newPiece.composer) return;
    
    setIsUploading(true);
    try {
      let fileData = {};
      if (newPiece.file && user && storage) {
        const uploaded = await uploadFile(newPiece.file);
        if (uploaded) fileData = uploaded;
      }
      
      const record = {
        title: newPiece.title,
        composer: newPiece.composer,
        notes: newPiece.notes,
        status: newPiece.status,
        date: newPiece.date,
        sheetMusicUrl: '#',
        ...fileData
      };
      
      await addRecord('repertoire', record, user);
      
      setIsAdding(false);
      setNewPiece({ 
        title: '', 
        composer: '', 
        notes: '', 
        status: 'Learning', 
        date: new Date().toISOString().split('T')[0],
        file: null 
      });
    } catch (err) {
      console.error(err);
      alert(t('tutor.error'));
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
      file: null
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.title || !editForm.composer) return;
    
    setIsUploading(true);
    try {
      let fileData = {};
      if (editForm.file && user && storage) {
        if (editingItem.storagePath) {
          try {
            const oldRef = ref(storage, editingItem.storagePath);
            await deleteObject(oldRef);
          } catch (e) {
            console.error('Failed to delete old file', e);
          }
        }
        
        const uploaded = await uploadFile(editForm.file);
        if (uploaded) fileData = uploaded;
      }
      
      const record = {
        title: editForm.title,
        composer: editForm.composer,
        status: editForm.status,
        notes: editForm.notes,
        date: editForm.date,
        ...fileData
      };

      await updateRecord('repertoire', editingItem.id, record, user);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      alert(t('tutor.error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    
    const itemToDelete = items.find(i => i.id === id);
    if (itemToDelete?.storagePath && storage) {
       try {
         const oldRef = ref(storage, itemToDelete.storagePath);
         await deleteObject(oldRef);
       } catch (e) {
         console.error('Failed to delete file', e);
       }
    }
    
    await deleteRecord('repertoire', id, user);
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
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SCORE_FILE_SIZE) {
      alert(t('repertoire.fileTooLarge'));
      e.target.value = '';
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert(t('repertoire.invalidFileType'));
      e.target.value = '';
      return;
    }

    if (isEdit) {
      setEditForm({ ...editForm, file });
    } else {
      setNewPiece({ ...newPiece, file });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">{t('repertoire.title')}</h2>
        <button 
          onClick={() => setIsAdding(true)}
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
          <div key={item.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px] flex items-center gap-4 transition-all group">
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
              <div className="flex items-center gap-1.5">
                {item.fileUrl && (
                  <button 
                    onClick={() => window.open(item.fileUrl, '_blank')}
                    className="text-[10px] font-bold text-brand hover:text-brand bg-brand/10 hover:bg-brand/20 px-2 py-1 rounded-lg border border-brand/20 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={10} />
                    {t('repertoire.openScore')}
                  </button>
                )}
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
              className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">{t('repertoire.addPiece')}</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.pieceTitle')}</label>
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
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.composer')}</label>
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

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.addFile')}</label>
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">{t('repertoire.loginRequiredForFile')}</p>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-stone-800/50 border border-white/5 hover:border-brand/40 border-dashed rounded-2xl py-4 px-5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => handleFileChange(e, false)}
                      />
                      {newPiece.file ? (
                        <span className="text-xs text-brand flex items-center justify-center w-full truncate"><FileIcon size={14} className="mr-1 shrink-0"/><span className="truncate">{newPiece.file.name}</span></span>
                      ) : (
                        <span className="text-xs text-stone-500"><Upload size={14} className="inline mr-1"/>{t('repertoire.chooseFile')}</span>
                      )}
                    </div>
                  )}
                </div>
                
                <button type="submit" disabled={isUploading} className="w-full mt-2 bg-brand h-12 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50">
                  {isUploading ? t('common.uploading') : t('common.save')}
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
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">{t('repertoire.editPiece')}</h3>
                <button onClick={() => setEditingItem(null)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.pieceTitle')}</label>
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
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.composer')}</label>
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

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.addFile')}</label>
                  {!user ? (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">{t('repertoire.loginRequiredForFile')}</p>
                  ) : (
                    <div 
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full bg-stone-800/50 border border-white/5 hover:border-brand/40 border-dashed rounded-2xl py-4 px-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <input 
                        type="file" 
                        ref={editFileInputRef} 
                        className="hidden" 
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => handleFileChange(e, true)}
                      />
                      {editForm.file ? (
                        <span className="text-xs text-brand flex items-center justify-center w-full truncate"><FileIcon size={14} className="mr-1 shrink-0"/><span className="truncate">{editForm.file.name}</span></span>
                      ) : editingItem.fileName ? (
                        <div className="text-center">
                          <span className="text-xs text-brand flex items-center justify-center w-full truncate mb-1"><FileIcon size={14} className="mr-1 shrink-0"/><span className="truncate">{editingItem.fileName}</span></span>
                          <span className="text-[10px] text-stone-500">({t('repertoire.chooseFile')})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500"><Upload size={14} className="inline mr-1"/>{t('repertoire.chooseFile')}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.status')}</label>
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
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('repertoire.notes')}</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm resize-none"
                    value={editForm.notes}
                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="w-1/3 bg-stone-800 h-12 rounded-2xl text-stone-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isUploading} className="flex-1 bg-brand h-12 rounded-2xl text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50">
                    {isUploading ? t('common.uploading') : t('common.save')}
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

