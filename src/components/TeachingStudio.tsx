import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Users, Edit, ChevronLeft, Calendar, FileText, Trash2 } from 'lucide-react';
import { Student, StudentLessonEntry } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function TeachingStudio() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newStudent, setNewStudent] = useState({ name: '', level: 'Beginner', instrument: '', memo: '' });
  
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({ name: '', level: 'Beginner', instrument: '', memo: '' });

  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<StudentLessonEntry | null>(null);
  const [lessonForm, setLessonForm] = useState({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '' });

  useEffect(() => {
    const unsubscribe = subscribeToCollection<Student>('students', (data) => {
      setStudents(data);
      if (activeStudent) {
        const updatedActive = data.find(s => s.id === activeStudent.id);
        if (updatedActive) {
          setActiveStudent(updatedActive);
        } else {
          setActiveStudent(null);
        }
      }
    }, user);
    return unsubscribe;
  }, [user, activeStudent?.id]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name) return;
    
    await addRecord('students', newStudent, user);
    setIsAdding(false);
    setNewStudent({ name: '', level: 'Beginner', instrument: '', memo: '' });
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !editStudentForm.name) return;
    await updateRecord('students', activeStudent.id, editStudentForm, user);
    setIsEditingStudent(false);
  };

  const handleDeleteStudent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('students.confirmDeleteStudent') || 'Delete this student?')) return;
    await deleteRecord('students', id, user);
    if (activeStudent?.id === id) setActiveStudent(null);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !lessonForm.date || !lessonForm.content) return;

    const lessons = activeStudent.lessons ? [...activeStudent.lessons] : [];

    if (editingLesson) {
      const index = lessons.findIndex(l => l.id === editingLesson.id);
      if (index >= 0) {
        lessons[index] = { ...lessons[index], ...lessonForm, updatedAt: Date.now() };
      } else if (editingLesson.id === 'legacy-lesson') {
        // Saving an edited legacy lesson adds it to the real lessons array
        lessons.push({
          id: crypto.randomUUID(),
          ...lessonForm,
          createdAt: activeStudent.createdAt || Date.now(),
          updatedAt: Date.now()
        });
        // Optionally clear legacy fields but array is fine, we just ignore legacy if lessons array exists
      }
    } else {
      lessons.push({
        id: crypto.randomUUID(),
        ...lessonForm,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await updateRecord('students', activeStudent.id, { lessons }, user);
    setIsAddingLesson(false);
    setEditingLesson(null);
    setLessonForm({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '' });
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!activeStudent || !window.confirm(t('students.confirmDeleteLesson') || 'Delete this lesson record?')) return;
    const lessons = (activeStudent.lessons || []).filter(l => l.id !== lessonId);
    await updateRecord('students', activeStudent.id, { lessons }, user);
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

  if (activeStudent) {
    // Detail View
    let lessons = activeStudent.lessons ? [...activeStudent.lessons] : [];
    
    // Fallback: If legacy lessonDate/currentPiece exists but no lessons array, add it as the first lesson
    if (lessons.length === 0 && activeStudent.lessonDate && activeStudent.currentPiece) {
      lessons.push({
        id: 'legacy-lesson',
        date: activeStudent.lessonDate,
        content: activeStudent.currentPiece,
        createdAt: activeStudent.createdAt || Date.now(),
        updatedAt: activeStudent.updatedAt || Date.now()
      });
    }

    lessons = lessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative">
        <div className="flex items-center gap-4 px-1">
          <button 
            onClick={() => setActiveStudent(null)}
            className="bg-stone-800 w-10 h-10 rounded-xl flex items-center justify-center text-stone-400 active:scale-95 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-3xl font-serif italic text-white leading-none truncate flex-1">{t('students.studentDetail') || 'Student Detail'}</h2>
        </div>

        {/* Student Info Card */}
        <div className="bg-bg-card border border-white/5 p-6 rounded-[32px] space-y-6 shadow-xl shadow-black/10 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[24px] bg-stone-900 border border-white/5 flex items-center justify-center text-brand font-serif text-3xl shadow-inner italic shrink-0">
                {activeStudent.name[0]}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeStudent.name}</p>
                <div className="flex gap-2 items-center mt-1">
                  <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">{mapLevel(activeStudent.level || '')}</p>
                  {activeStudent.instrument && (
                    <p className="text-[10px] font-mono text-stone-400 font-bold bg-white/5 px-2 py-0.5 rounded-full">{activeStudent.instrument}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setEditStudentForm({
                    name: activeStudent.name,
                    level: activeStudent.level || 'Beginner',
                    instrument: activeStudent.instrument || '',
                    memo: activeStudent.memo || ''
                  });
                  setIsEditingStudent(true);
                }}
                className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400 hover:text-white transition-colors"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={(e) => handleDeleteStudent(activeStudent.id, e)}
                className="w-10 h-10 rounded-xl bg-red-950/30 flex items-center justify-center text-red-500 hover:text-red-400 transition-colors border border-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          {activeStudent.memo && (
            <div className="pt-4 border-t border-white/5">
              <p className="text-sm text-stone-400 whitespace-pre-wrap">{activeStudent.memo}</p>
            </div>
          )}
        </div>

        {/* Lesson Records */}
        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xl font-bold text-white">{t('students.lessonHistoryByDate') || 'Lesson History'}</h3>
            <button 
              onClick={() => {
                setLessonForm({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '' });
                setEditingLesson(null);
                setIsAddingLesson(true);
              }}
              className="bg-brand w-10 h-10 rounded-xl flex items-center justify-center text-black active:scale-95 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {lessons.map(lesson => (
              <div key={lesson.id} className="bg-stone-900/50 border border-white/5 p-6 rounded-[24px] space-y-4">
                <div className="flex justify-between items-start">
                  <p className="text-brand font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <Calendar size={14} />
                    {formatDate(lesson.date)}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setLessonForm({
                        date: lesson.date,
                        content: lesson.content || '',
                        homework: lesson.homework || '',
                        nextGoal: lesson.nextGoal || '',
                        memo: lesson.memo || ''
                      });
                      setEditingLesson(lesson);
                      setIsAddingLesson(true);
                    }} className="text-stone-500 hover:text-white p-1">
                      <Edit size={14} />
                    </button>
                    {lesson.id !== 'legacy-lesson' && (
                      <button onClick={() => handleDeleteLesson(lesson.id)} className="text-stone-500 hover:text-red-400 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {lesson.content && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-500 uppercase">{t('students.lessonContent') || 'Lesson Content'}</p>
                      <p className="text-sm text-stone-200 whitespace-pre-wrap leading-relaxed">{lesson.content}</p>
                    </div>
                  )}
                  {lesson.homework && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-500 uppercase">{t('students.homework') || 'Homework'}</p>
                      <p className="text-sm text-stone-300 whitespace-pre-wrap">{lesson.homework}</p>
                    </div>
                  )}
                  {lesson.nextGoal && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-500 uppercase">{t('students.nextGoal') || 'Next Goal'}</p>
                      <p className="text-sm text-stone-300 whitespace-pre-wrap">{lesson.nextGoal}</p>
                    </div>
                  )}
                  {lesson.memo && (
                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <p className="text-[10px] font-bold text-stone-600 uppercase">{t('students.memo') || 'Memo'}</p>
                      <p className="text-xs text-stone-500 whitespace-pre-wrap">{lesson.memo}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {lessons.length === 0 && (
              <div className="py-12 text-center space-y-4 opacity-40">
                <FileText size={32} className="mx-auto text-stone-700" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-700">{t('students.noLessonRecords') || 'No records'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Student Modal */}
        <AnimatePresence>
          {isEditingStudent && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditingStudent(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-serif italic text-white leading-none">{t('students.editStudent')}</h3>
                  <button onClick={() => setIsEditingStudent(false)} className="text-stone-600"><X size={24} /></button>
                </div>
                <form onSubmit={handleUpdateStudent} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.name')}</label>
                    <input required className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={editStudentForm.name} onChange={e => setEditStudentForm({...editStudentForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.instrument') || 'Instrument'}</label>
                    <input className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={editStudentForm.instrument} onChange={e => setEditStudentForm({...editStudentForm, instrument: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.level')}</label>
                    <select className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none appearance-none text-sm [&>option]:bg-stone-900 [&>option]:text-white" style={{ colorScheme: 'dark' }} value={editStudentForm.level} onChange={e => setEditStudentForm({...editStudentForm, level: e.target.value})}>
                      <option value="Beginner">{t('levels.beginner')}</option>
                      <option value="Intermediate">{t('levels.intermediate')}</option>
                      <option value="Advanced">{t('levels.advanced')}</option>
                      <option value="Professional">{t('levels.professional')}</option>
                      <option value="Other">{t('levels.other')}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.memo') || 'Memo'}</label>
                    <textarea rows={3} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm resize-none" value={editStudentForm.memo} onChange={e => setEditStudentForm({...editStudentForm, memo: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-stone-200 mt-2 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.save')}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add/Edit Lesson Modal */}
        <AnimatePresence>
          {isAddingLesson && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingLesson(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-serif italic text-white leading-none">{editingLesson ? (t('students.editLessonRecord') || 'Edit') : (t('students.addLessonRecord') || 'Add')}</h3>
                  <button onClick={() => setIsAddingLesson(false)} className="text-stone-600"><X size={24} /></button>
                </div>
                <form onSubmit={handleSaveLesson} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.lessonDate') || 'Date'}</label>
                    <input type="date" required className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm color-scheme-dark" value={lessonForm.date} onChange={e => setLessonForm({...lessonForm, date: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.lessonContent') || 'Content'}</label>
                    <textarea required rows={4} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm resize-none" value={lessonForm.content} onChange={e => setLessonForm({...lessonForm, content: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.homework') || 'Homework'}</label>
                    <textarea rows={2} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm resize-none" value={lessonForm.homework} onChange={e => setLessonForm({...lessonForm, homework: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.nextGoal') || 'Next Goal'}</label>
                    <input className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={lessonForm.nextGoal} onChange={e => setLessonForm({...lessonForm, nextGoal: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.memo') || 'Memo'}</label>
                    <textarea rows={2} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm resize-none" value={lessonForm.memo} onChange={e => setLessonForm({...lessonForm, memo: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-stone-200 mt-2 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.save')}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // List View
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
          <div 
            key={student.id} 
            onClick={() => setActiveStudent(student)}
            className="bg-bg-card border border-white/5 p-6 rounded-[32px] flex flex-col items-center justify-center text-center space-y-3 shadow-xl shadow-black/10 transition-all hover:bg-stone-800/50 cursor-pointer group relative"
          >
            <div className="w-14 h-14 rounded-[20px] bg-stone-900 border border-white/5 flex items-center justify-center text-brand font-serif text-2xl shadow-inner italic shrink-0 group-hover:bg-brand/10 group-hover:border-brand/30 transition-colors">
              {student.name[0]}
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white leading-tight">{student.name}</p>
              <div className="flex gap-2 items-center justify-center mt-1">
                <p className="text-[10px] text-stone-600 uppercase tracking-widest font-bold">{mapLevel(student.level || '')}</p>
              </div>
            </div>
            {student.lessons && student.lessons.length > 0 && (
               <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-900 px-2 py-1 rounded-full border border-white/5">
                 <FileText size={10} />
                 {student.lessons.length}
               </div>
            )}
            {/* Fallback indicator for legacy lessons */}
            {(!student.lessons || student.lessons.length === 0) && student.lessonDate && student.currentPiece && (
               <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-900 px-2 py-1 rounded-full border border-white/5">
                 <FileText size={10} />
                 1
               </div>
            )}
          </div>
        ))}

        {students.length === 0 && (
          <div className="col-span-2 py-12 text-center space-y-4 opacity-40">
            <Users size={32} className="mx-auto text-stone-700" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-700">{t('students.empty')}</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-serif italic text-white leading-none">{t('students.addStudent')}</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.name')}</label>
                  <input required className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.instrument') || 'Instrument'}</label>
                  <input className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm" value={newStudent.instrument} onChange={e => setNewStudent({...newStudent, instrument: e.target.value})} />
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
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">{t('students.memo') || 'Memo'}</label>
                  <textarea rows={2} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl py-3.5 px-5 text-white outline-none focus:border-brand/40 text-sm resize-none" value={newStudent.memo} onChange={e => setNewStudent({...newStudent, memo: e.target.value})} />
                </div>
                
                <button type="submit" className="w-full bg-stone-200 mt-2 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                  {t('common.save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
