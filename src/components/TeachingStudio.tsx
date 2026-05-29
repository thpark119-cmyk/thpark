import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User, Target, X, Users } from 'lucide-react';
import { Student } from '../types';
import { subscribeToCollection, addRecord } from '../lib/firestore';

export default function TeachingStudio() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', level: 'Beginner', currentPiece: '' });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<Student>('students', (data) => {
      setStudents(data);
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name) return;
    
    await addRecord('students', newStudent);
    setIsAdding(false);
    setNewStudent({ name: '', level: 'Beginner', currentPiece: '' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">지도 학생</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-stone-800 w-12 h-12 rounded-2xl flex items-center justify-center text-stone-400 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {students.map(student => (
          <button key={student.id} className="bg-bg-card border border-white/5 p-6 rounded-[32px] text-left flex flex-col items-center justify-center text-center space-y-3 active:scale-95 transition-all shadow-xl shadow-black/10">
            <div className="w-16 h-16 rounded-[24px] bg-stone-900 border border-white/5 flex items-center justify-center text-brand font-serif text-2xl shadow-inner italic">
              {student.name[0]}
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-tight">{student.name}</p>
              <p className="text-[10px] text-stone-600 uppercase tracking-widest font-bold mt-1">{student.level}</p>
            </div>
          </button>
        ))}

        {students.length === 0 && (
          <div className="col-span-2 py-12 text-center space-y-4 opacity-40">
            <Users size={32} className="mx-auto text-stone-700" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-700">등록된 학생이 없습니다</p>
          </div>
        )}
      </div>

      <div className="bg-stone-900/30 rounded-[32px] p-8 border border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Target size={18} className="text-brand" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-600">지도 가이드</h3>
        </div>
        <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
          <p className="text-sm font-serif italic text-stone-400 leading-relaxed">
            학생을 등록하고 레슨 시마다 학생별 맞춤 일지를 작성하여 성장을 체계적으로 관리하세요.
          </p>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">학생 등록</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">이름</label>
                  <input required className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none focus:border-brand/40" placeholder="학생 성함" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">레벨</label>
                  <select className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-4 px-5 text-white outline-none appearance-none" value={newStudent.level} onChange={e => setNewStudent({...newStudent, level: e.target.value})}>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                
                <button type="submit" className="w-full bg-stone-200 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                  등록 완료
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

