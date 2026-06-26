import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User, Target, X, Users, Edit } from 'lucide-react';
import { Student } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function TeachingStudio() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', level: 'Beginner', currentPiece: '', lessonDate: new Date().toISOString().split('T')[0] });

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: '', level: 'Beginner', currentPiece: '', lessonDate: '' });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<Student>('students', (data) => {
      setStudents(data);
    }, user);
    return unsubscribe;
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name) return;
    
    await addRecord('students', newStudent, user);
    setIsAdding(false);
    setNewStudent({ name: '', level: 'Beginner', currentPiece: '', lessonDate: new Date().toISOString().split('T')[0] });
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      level: student.level || 'Beginner',
      currentPiece: student.currentPiece || '',
      lessonDate: student.lessonDate || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editForm.name) return;

    await updateRecord('students', editingStudent.id, editForm, user);
    setEditingStudent(null);
  };

  const handleDeleteClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('common.confirmDelete'))) return;
    await deleteRecord('students', id, user);
  };

  const mapLevel = (levelInput: string) => {
    const lv = levelInput.toLowerCase();
    if (lv === 'beginner') return t('levels.beginner');
    if (lv === 'intermediate') return t('levels.intermediate');
    if (lv === 'advanced') return t('levels.advanced');
    if (lv === 'professional') return t('levels.professional');
    if (lv === 'other') return t('levels.other');
    return levelInput;
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">{t('students.title')}</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-stone-800 w-12 h-12 rounded-2xl flex items-center justify-center text-stone-400 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {students.map(student => (
          <div key={student.id} className="bg-bg-card border border-white/5 p-6 rounded-[32px] flex flex-col items-center justify-center text-center space-y-3 shadow-xl shadow-black/10 transition-all group relative">
            <div className="w-14 h-14 rounded-[20px] bg-stone-900 border border-white/5 flex items-center justify-center text-brand font-serif text-2xl shadow-inner italic shrink-0">
              {student.name[0]}
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white leading-tight">{student.name}</p>
              <p className="text-[10px] text-stone-600 uppercase tracking-widest font-bold mt-1">{mapLevel(student.level || '')}</p>
              {student.lessonDate && (
                <p className="text-[10px] font-mono text-stone-500 font-bold bg-white/5 px-2 py-0.5 rounded-full inline-block mt-1">{formatDate(student.lessonDate)}</p>
              )}
              {student.currentPiece && (
                <p className="text-xs text-stone-500 italic mt-1 font-serif truncate max-w-[150px]">
                  {student.currentPiece}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 pt-1">
              <button 
                onClick={() => handleEditClick(student)}
                className="text-[10px] font-bold text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-stone-800 px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
              >
                {t('common.edit')}
              </button>
              <button 
                onClick={(e) => handleDeleteClick(student.id, e)}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-500/10 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}

        {students.length === 0 && (
          <div className="col-span-2 py-12 text-center space-y-4 opacity-40">
            <Users size={32} className="mx-auto text-stone-700" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-700">{t('students.empty')}</p>
          </div>
        )}
      </div>

      {/* Add Modal & Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-serif italic text-white leading-none">{t('students.addStudent')}</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.name')}</label>
                    <input required className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('lessons.date')}</label>
                    <input type="date" className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm color-scheme-dark" value={newStudent.lessonDate} onChange={e => setNewStudent({...newStudent, lessonDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.level')}</label>
                  <select className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none appearance-none text-sm [&>option]:bg-stone-900 [&>option]:text-white" style={{ colorScheme: 'dark' }} value={newStudent.level} onChange={e => setNewStudent({...newStudent, level: e.target.value})}>
                    <option value="Beginner">{t('levels.beginner')}</option>
                    <option value="Intermediate">{t('levels.intermediate')}</option>
                    <option value="Advanced">{t('levels.advanced')}</option>
                    <option value="Professional">{t('levels.professional')}</option>
                    <option value="Other">{t('levels.other')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.currentPiece')}</label>
                  <input className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={newStudent.currentPiece} onChange={e => setNewStudent({...newStudent, currentPiece: e.target.value})} />
                </div>
                
                <button type="submit" className="w-full bg-stone-200 mt-2 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                  {t('common.save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {editingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setEditingStudent(null)} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif italic text-white leading-none">{t('students.editStudent')}</h3>
                <button onClick={() => setEditingStudent(null)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.name')}</label>
                    <input 
                      required 
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('lessons.date')}</label>
                    <input 
                      type="date"
                      className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm color-scheme-dark" 
                      value={editForm.lessonDate} 
                      onChange={e => setEditForm({...editForm, lessonDate: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.level')}</label>
                  <select 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none appearance-none text-sm [&>option]:bg-stone-900 [&>option]:text-white" 
                    style={{ colorScheme: 'dark' }}
                    value={editForm.level} 
                    onChange={e => setEditForm({...editForm, level: e.target.value})}
                  >
                    <option value="Beginner">{t('levels.beginner')}</option>
                    <option value="Intermediate">{t('levels.intermediate')}</option>
                    <option value="Advanced">{t('levels.advanced')}</option>
                    <option value="Professional">{t('levels.professional')}</option>
                    <option value="Other">{t('levels.other')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.currentPiece')}</label>
                  <input 
                    className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" 
                    value={editForm.currentPiece} 
                    onChange={e => setEditForm({...editForm, currentPiece: e.target.value})} 
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingStudent(null)} className="w-1/3 bg-stone-800 h-12 rounded-2xl text-stone-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="flex-1 bg-stone-200 h-12 rounded-2xl text-black font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.save')}
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

