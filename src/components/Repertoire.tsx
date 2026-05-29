import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, FileText, Search, MoreHorizontal, X, Music } from 'lucide-react';
import { RepertoireItem } from '../types';
import { subscribeToCollection, addRecord, deleteRecord } from '../lib/firestore';

export default function Repertoire() {
  const [items, setItems] = useState<RepertoireItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPiece, setNewPiece] = useState({ title: '', composer: '', notes: '', status: 'Learning' as const });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<RepertoireItem>('repertoire', (data) => {
      setItems(data);
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPiece.title || !newPiece.composer) return;
    
    await addRecord('repertoire', {
      ...newPiece,
      sheetMusicUrl: '#' // Simulated score
    });
    
    setIsAdding(false);
    setNewPiece({ title: '', composer: '', notes: '', status: 'Learning' });
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

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
        <input 
          type="text" 
          placeholder="곡명, 작곡가 검색..."
          className="w-full bg-stone-900/50 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-stone-200 placeholder:text-stone-700 outline-none focus:ring-1 focus:ring-brand/30 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px] flex items-center gap-4 transition-all active:bg-stone-900 group">
            <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest truncate">{item.composer}</p>
              <h3 className="text-lg font-serif italic text-stone-200 truncate leading-tight">{item.title}</h3>
            </div>
            <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter ${
              item.status === 'Learning' ? 'bg-amber-500/10 text-amber-500' :
              item.status === 'Polishing' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-800 text-stone-600'
            }`}>
              {item.status}
            </span>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Music size={40} className="mx-auto text-stone-800 opacity-50" />
            <p className="text-sm font-medium text-stone-600 uppercase tracking-widest">저장된 곡이 없습니다</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
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
      </AnimatePresence>
    </motion.div>
  );
}

