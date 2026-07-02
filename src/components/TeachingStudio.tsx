import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Users, Edit, ChevronLeft, Calendar, FileText, Trash2, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { Student, StudentLessonEntry } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { compressImageFile } from '../utils/imageCompression';
import { saveLessonPhoto, deleteLessonPhotos, deleteAllPhotosForStudent, LocalLessonPhoto, isIndexedDBAvailable } from '../utils/localPhotoStorage';
import LocalPhotoView from './LocalPhotoView';

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
  const [lessonForm, setLessonForm] = useState({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '', photoIds: [] as string[] });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);

  const canUseIndexedDB = isIndexedDBAvailable();

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
    try {
      await deleteAllPhotosForStudent(id);
    } catch (e) {
      console.warn('Failed to delete student photos from local storage', e);
    }
    if (activeStudent?.id === id) setActiveStudent(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeStudent) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      setPhotoError(t('students.photoInvalidType') || 'Only image files can be attached.');
      return;
    }
    
    if (lessonForm.photoIds.length >= 3) {
      setPhotoError(t('students.photoLimitReached') || 'You can attach up to 3 photos.');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setPhotoError('');
      const compressed = await compressImageFile(file);
      
      const photoId = crypto.randomUUID();
      const newPhoto: LocalLessonPhoto = {
        id: photoId,
        userId: user?.uid,
        studentId: activeStudent.id,
        lessonId: editingLesson?.id,
        fileName: file.name,
        contentType: compressed.contentType,
        size: compressed.size,
        width: compressed.width,
        height: compressed.height,
        createdAt: Date.now(),
        blob: compressed.blob
      };

      await saveLessonPhoto(newPhoto);
      setLessonForm(prev => ({ ...prev, photoIds: [...prev.photoIds, photoId] }));
    } catch (err) {
      console.error('Failed to compress/save photo', err);
      setPhotoError(t('students.photoSaveFailed') || 'Failed to save photo');
    } finally {
      setIsUploadingPhoto(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setLessonForm(prev => ({ ...prev, photoIds: prev.photoIds.filter(id => id !== photoId) }));
    try {
      await deleteLessonPhotos([photoId]);
    } catch (err) {
      console.warn('Failed to delete photo from local storage', err);
    }
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
    setLessonForm({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '', photoIds: [] });
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!activeStudent || !window.confirm(t('students.confirmDeleteLesson') || 'Delete this lesson record?')) return;
    const lessonToDelete = activeStudent.lessons?.find(l => l.id === lessonId);
    if (lessonToDelete?.photoIds && lessonToDelete.photoIds.length > 0) {
      try {
        await deleteLessonPhotos(lessonToDelete.photoIds);
      } catch (err) {
        console.warn('Failed to delete photos for lesson', err);
      }
    }
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
                setLessonForm({ date: new Date().toISOString().split('T')[0], content: '', homework: '', nextGoal: '', memo: '', photoIds: [] });
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
                        memo: lesson.memo || '',
                        photoIds: lesson.photoIds || []
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
                  {lesson.photoIds && lesson.photoIds.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex flex-wrap gap-2">
                        {lesson.photoIds.map(photoId => (
                          <div key={photoId} className="w-16 h-16 rounded-lg overflow-hidden bg-stone-800 border border-white/5 relative">
                            <LocalPhotoView 
                              photoId={photoId} 
                              className="w-full h-full object-cover"
                              onClick={() => setViewingPhotoId(photoId)}
                            />
                          </div>
                        ))}
                      </div>
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

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-2">
                        {t('students.photos') || 'Photos'} ({lessonForm.photoIds.length}/3)
                      </label>
                      <label className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${(!canUseIndexedDB || lessonForm.photoIds.length >= 3) ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                        {isUploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        {isUploadingPhoto ? (t('students.photoAttaching') || 'Attaching...') : (t('students.photoAdd') || 'Add Photo')}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={!canUseIndexedDB || isUploadingPhoto || lessonForm.photoIds.length >= 3} />
                      </label>
                    </div>
                    {!canUseIndexedDB && <p className="text-red-400 text-xs px-2">{t('students.photoNotSupported') || 'Local photo storage is not supported in this browser.'}</p>}
                    {photoError && <p className="text-red-400 text-xs px-2">{photoError}</p>}
                    {lessonForm.photoIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {lessonForm.photoIds.map((photoId) => (
                          <div key={photoId} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-stone-800">
                            <LocalPhotoView photoId={photoId} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photoId)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-stone-500 leading-relaxed px-2 bg-stone-800/30 py-2 rounded-xl mt-2 border border-stone-800">
                      {t('students.photoLocalWarning') || 'Photos are stored only on this device. They may not appear on other devices, and they can be lost if browser data is cleared.'}
                    </p>
                  </div>

                  <button type="submit" className="w-full bg-stone-200 mt-2 h-14 rounded-2xl text-black font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                    {t('common.save')}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Photo Viewer Modal */}
        <AnimatePresence>
          {viewingPhotoId && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingPhotoId(null)} className="absolute inset-0 bg-black/90 backdrop-blur-sm cursor-zoom-out" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center pointer-events-none">
                <button onClick={() => setViewingPhotoId(null)} className="absolute -top-12 right-0 text-white/50 hover:text-white pointer-events-auto transition-colors bg-stone-900/50 rounded-full p-2">
                  <X size={24} />
                </button>
                <div className="pointer-events-auto w-full h-full flex items-center justify-center">
                  <LocalPhotoView 
                    photoId={viewingPhotoId} 
                    className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" 
                  />
                </div>
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
