import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Bookmark, X, Calendar, User, MessageCircle, Edit } from 'lucide-react';
import { ReceivedLesson } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';

export default function MyLessons() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ReceivedLesson[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newLog, setNewLog] = useState({ 
    teacher: '', 
    topic: '', 
    date: new Date().toISOString().split('T')[0],
    feedback: '',
    nextExercises: '' 
  });

  const [editingLog, setEditingLog] = useState<ReceivedLesson | null>(null);
  const [editForm, setEditForm] = useState({
    teacher: '',
    topic: '',
    date: '',
    feedback: '',
    nextExercises: ''
  });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<ReceivedLesson>('received_lessons', (data) => {
      setLogs(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.teacher || !newLog.topic) return;
    
    await addRecord('received_lessons', newLog, user);
    setIsAdding(false);
    setNewLog({ 
      teacher: '', 
      topic: '', 
      date: new Date().toISOString().split('T')[0],
      feedback: '',
      nextExercises: '' 
    });
  };

  const handleEditClick = (log: ReceivedLesson) => {
    setEditingLog(log);
    setEditForm({
      teacher: log.teacher,
      topic: log.topic,
      date: log.date,
      feedback: log.feedback,
      nextExercises: log.nextExercises || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    if (!editForm.teacher || !editForm.topic) return;

    await updateRecord('received_lessons', editingLog.id, editForm, user);
    setEditingLog(null);
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('정말 삭제할까요?')) return;
    await deleteRecord('received_lessons', id, user);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">학습 일지</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand px-6 h-12 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-white shadow-xl shadow-brand/20 active:scale-95 transition-all"
        >
          기록 추가
        </button>
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="bg-bg-card border border-white/5 p-6 rounded-[32px] space-y-5 transition-colors">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-[0.2em]">{log.teacher}</p>
                <h3 className="text-2xl font-serif italic text-stone-200 leading-tight">{log.topic}</h3>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="font-mono text-[10px] text-stone-500 font-bold bg-white/5 px-3 py-1 rounded-full">{log.date.replace(/-/g, '.')}</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button 
                    onClick={() => handleEditClick(log)}
                    className="text-[10px] font-bold text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-stone-800 px-2.5 py-1 rounded-lg border border-white/5 transition-colors"
                  >
                    수정
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(log.id)}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-500/10 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-4 items-start bg-stone-900/50 p-4 rounded-2xl border border-white/5">
                <Bookmark size={15} className="text-brand shrink-0 mt-1" />
                <p className="text-sm text-stone-400 font-serif leading-relaxed italic">"{log.feedback}"</p>
              </div>
              
              {log.nextExercises && (
                <div className="pl-6 border-l border-brand/20">
                  <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">다음 연습 과제</p>
                  <p className="text-xs text-stone-500 font-medium">{log.nextExercises}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-40">
            <Calendar size={40} className="mx-auto text-stone-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-stone-700">작성된 레슨 일지가 없습니다</p>
          </div>
        )}
      </div>

      {/* Add Fullscreen Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] bg-bg-deep flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-10 max-w-lg mx-auto w-full">
              <h3 className="text-3xl font-serif italic text-white leading-none">레슨 기록</h3>
              <button onClick={() => setIsAdding(false)} className="bg-stone-900 w-12 h-12 rounded-full flex items-center justify-center text-stone-500"><X size={24} /></button>
            </div>

            <form onSubmit={handleAdd} className="space-y-8 max-w-lg mx-auto w-full pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">교수/선생님</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-700" size={16} />
                    <input required className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-sm" value={newLog.teacher} onChange={e => setNewLog({...newLog, teacher: e.target.value})} placeholder="성함" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">날짜</label>
                  <input required type="date" className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm color-scheme-dark" value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">레슨 주제</label>
                <input required className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={newLog.topic} onChange={e => setNewLog({...newLog, topic: e.target.value})} placeholder="예: 드보르작 협주곡 1악장" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">핵심 피드백</label>
                <textarea required rows={4} className="w-full bg-stone-900 border border-white/10 rounded-3xl py-4 px-5 text-sm resize-none" value={newLog.feedback} onChange={e => setNewLog({...newLog, feedback: e.target.value})} placeholder="선생님이 강조하신 내용을 적어주세요." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">다음 과제</label>
                <input className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={newLog.nextExercises} onChange={e => setNewLog({...newLog, nextExercises: e.target.value})} placeholder="연습해야 할 항목" />
              </div>
              
              <button type="submit" className="w-full bg-brand h-16 rounded-[28px] text-white font-bold uppercase tracking-widest shadow-2xl shadow-brand/20">
                기록 완료
              </button>
            </form>
          </div>
        )}

        {editingLog && (
          <div className="fixed inset-0 z-[100] bg-bg-deep flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-10 max-w-lg mx-auto w-full">
              <h3 className="text-3xl font-serif italic text-white leading-none">레슨 기록 수정</h3>
              <button onClick={() => setEditingLog(null)} className="bg-stone-900 w-12 h-12 rounded-full flex items-center justify-center text-stone-500"><X size={24} /></button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-8 max-w-lg mx-auto w-full pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">교수/선생님</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-700" size={16} />
                    <input required className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-sm" value={editForm.teacher} onChange={e => setEditForm({...editForm, teacher: e.target.value})} placeholder="성함" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">날짜</label>
                  <input required type="date" className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm color-scheme-dark" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">레슨 주제</label>
                <input required className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={editForm.topic} onChange={e => setEditForm({...editForm, topic: e.target.value})} placeholder="예: 드보르작 협주곡 1악장" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">핵심 피드백</label>
                <textarea required rows={4} className="w-full bg-stone-900 border border-white/10 rounded-3xl py-4 px-5 text-sm resize-none" value={editForm.feedback} onChange={e => setEditForm({...editForm, feedback: e.target.value})} placeholder="선생님이 강조하신 내용을 적어주세요." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">다음 과제</label>
                <input className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={editForm.nextExercises} onChange={e => setEditForm({...editForm, nextExercises: e.target.value})} placeholder="연습해야 할 항목" />
              </div>
              
              <div className="flex gap-4">
                <button type="button" onClick={() => setEditingLog(null)} className="w-1/3 bg-stone-900 h-16 rounded-[28px] text-stone-400 font-bold uppercase tracking-widest border border-white/5 active:scale-95 transition-all">
                  취소
                </button>
                <button type="submit" className="flex-1 bg-brand h-16 rounded-[28px] text-white font-bold uppercase tracking-widest shadow-2xl shadow-brand/20 active:scale-95 transition-all">
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

