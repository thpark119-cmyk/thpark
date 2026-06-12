import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, FileText, Search, MoreHorizontal, X, Music } from 'lucide-react';
import { RepertoireItem } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';

export default function Repertoire() {
  const { user } = useAuth();
  const [items, setItems] = useState<RepertoireItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [imslpQuery, setImslpQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPiece, setNewPiece] = useState({ title: '', composer: '', notes: '', status: 'Learning' as const });

  const [editingItem, setEditingItem] = useState<RepertoireItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    composer: '',
    status: 'Learning' as 'Learning' | 'Polishing' | 'Completed',
    notes: ''
  });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<RepertoireItem>('repertoire', (data) => {
      setItems(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiece.title || !newPiece.composer) return;
    
    await addRecord('repertoire', {
      ...newPiece,
      sheetMusicUrl: '#' // Simulated score
    }, user);
    
    setIsAdding(false);
    setNewPiece({ title: '', composer: '', notes: '', status: 'Learning' });
  };

  const handleEditClick = (item: RepertoireItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      composer: item.composer,
      status: item.status || 'Learning',
      notes: item.notes || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.title || !editForm.composer) return;

    await updateRecord('repertoire', editingItem.id, editForm, user);
    setEditingItem(null);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('정말 삭제할까요?')) return;
    await deleteRecord('repertoire', id, user);
  };

  const handleImslpSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imslpQuery.trim()) {
      alert('검색할 작곡가나 곡명을 입력해주세요.');
      return;
    }
    const query = encodeURIComponent(imslpQuery.trim());
    const url = `https://imslp.org/wiki/Special:Search?search=${query}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImslpDirect = () => {
    window.open('https://imslp.org/', '_blank', 'noopener,noreferrer');
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.composer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">악보함</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand/20 active:scale-90 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="bg-stone-900 border border-white/5 p-6 rounded-[28px] space-y-4 shadow-xl shadow-black/10">
        <div>
          <h3 className="text-lg font-serif italic text-white leading-tight">IMSLP에서 악보 찾기</h3>
          <p className="text-xs text-stone-500 mt-1">작곡가나 곡명을 입력하면 IMSLP에서 악보를 검색할 수 있습니다.</p>
        </div>
        
        <form onSubmit={handleImslpSearch} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
            <input 
              type="text" 
              placeholder="예: Bach Cello Suite, Beethoven Sonata"
              className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-stone-200 placeholder:text-stone-600 outline-none focus:ring-1 focus:ring-brand/30 transition-all text-sm"
              value={imslpQuery}
              onChange={(e) => setImslpQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-stone-200 text-stone-900 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all">
              IMSLP 검색
            </button>
            <button type="button" onClick={handleImslpDirect} className="flex-1 bg-stone-800 text-stone-300 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all">
              IMSLP 바로가기
            </button>
          </div>
        </form>
        <p className="text-[10px] text-stone-600">IMSLP의 악보는 국가별 저작권 상태가 다를 수 있으므로 사용 전 저작권 정보를 확인하세요.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
        <input 
          type="text" 
          placeholder="내 악보함 검색 (곡명, 작곡가)..."
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
              {item.notes && (
                <p className="text-xs text-stone-500 mt-1 truncate max-w-sm">{item.notes}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter ${
                item.status === 'Learning' ? 'bg-amber-500/10 text-amber-500' :
                item.status === 'Polishing' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-800 text-stone-400'
              }`}>
                {item.status}
              </span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleEditClick(item)}
                  className="text-[10px] font-bold text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-stone-800 px-2 py-1 rounded-lg border border-white/5 transition-colors"
                >
                  수정
                </button>
                <button 
                  onClick={() => handleDeleteClick(item.id)}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 px-2 py-1 rounded-lg border border-red-500/10 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Music size={40} className="mx-auto text-stone-800 opacity-50" />
            <p className="text-sm font-medium text-stone-600 uppercase tracking-widest">저장된 곡이 없습니다</p>
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
                <h3 className="text-2xl font-serif italic text-white leading-none">새 곡 추가</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">곡명</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-brand/40 transition-colors"
                    placeholder="예: 첼로 협주곡 제1번"
                    value={newPiece.title}
                    onChange={e => setNewPiece({...newPiece, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">작곡가</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-brand/40 transition-colors"
                    placeholder="예: 하이든"
                    value={newPiece.composer}
                    onChange={e => setNewPiece({...newPiece, composer: e.target.value})}
                  />
                </div>
                
                <button type="submit" className="w-full bg-brand h-14 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all">
                  저장하기
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
                <h3 className="text-2xl font-serif italic text-white leading-none">곡 정보 수정</h3>
                <button onClick={() => setEditingItem(null)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">곡명</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                    placeholder="예: 첼로 협주곡 제1번"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">작곡가</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                    placeholder="예: 하이든"
                    value={editForm.composer}
                    onChange={e => setEditForm({...editForm, composer: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">학습 상태</label>
                  <select 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none appearance-none text-sm color-scheme-dark"
                    value={editForm.status} 
                    onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                  >
                    <option value="Learning">Learning</option>
                    <option value="Polishing">Polishing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">메모 / 연습 방향</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3 px-5 text-white outline-none focus:border-brand/40 transition-colors text-sm resize-none"
                    placeholder="기억해야 할 연주 기법이나 주의점을 적어보세요."
                    value={editForm.notes}
                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="w-1/3 bg-stone-800 h-12 rounded-2xl text-stone-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                    취소
                  </button>
                  <button type="submit" className="flex-1 bg-brand h-12 rounded-2xl text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all">
                    저장하기
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

