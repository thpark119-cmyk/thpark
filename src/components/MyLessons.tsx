import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Bookmark, X, Calendar, User, Edit, Trash2, Camera, Loader2, ChevronLeft, Image as ImageIcon, Users } from 'lucide-react';
import { ReceivedLesson, LessonTeacher } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { compressImageFile } from '../utils/imageCompression';
import { saveLessonPhoto, deleteLessonPhotos, isIndexedDBAvailable } from '../utils/localPhotoStorage';
import LocalPhotoView from './LocalPhotoView';
import CloudPhotoView from './CloudPhotoView';
import { uploadFileToStorage, deleteFileFromStorage } from '../utils/cloudStorage';
import { validateLessonPhotoFile, getSafeFileExtension } from '../utils/fileValidation';
import { buildLessonJournalPhotoStoragePath } from '../utils/storagePaths';
import { CloudLessonPhoto } from '../types/cloudFiles';

interface MyLessonsProps {
  targetLessonId?: string | null;
  setTargetLessonId?: (id: string | null) => void;
}

export default function MyLessons({ targetLessonId, setTargetLessonId }: MyLessonsProps = {}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  
  const [logs, setLogs] = useState<ReceivedLesson[]>([]);
  const [teachers, setTeachers] = useState<LessonTeacher[]>([]);
  
  // 'all', 'uncategorized', or teacherId
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingLog, setEditingLog] = useState<ReceivedLesson | null>(null);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const [viewingCloudPhoto, setViewingCloudPhoto] = useState<CloudLessonPhoto | null>(null);
  
  const canUseIndexedDB = isIndexedDBAvailable();
  
  const [form, setForm] = useState({
    teacher: '', // fallback name
    teacherId: '',
    topic: '',
    date: new Date().toISOString().split('T')[0],
    feedback: '',
    nextExercises: '',
    photoIds: [] as string[],
    photos: [] as CloudLessonPhoto[]
  });
  
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  
  // Teacher management
  const [isManagingTeacher, setIsManagingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<LessonTeacher | null>(null);
  const [teacherForm, setTeacherForm] = useState({ name: '', instrument: '', memo: '' });

  useEffect(() => {
    const unsubscribeLogs = subscribeToCollection<ReceivedLesson>('received_lessons', (data) => {
      setLogs(data);
    }, user);
    
    const unsubscribeTeachers = subscribeToCollection<LessonTeacher>('lesson_teachers', (data) => {
      setTeachers(data);
    }, user);

    return () => {
      unsubscribeLogs();
      unsubscribeTeachers();
    };
  }, [user]);

  // Handle target lesson deep link
  useEffect(() => {
    if (targetLessonId && logs.length > 0) {
      const targetLog = logs.find(l => l.id === targetLessonId);
      if (targetLog) {
        setSelectedTeacherId(targetLog.teacherId || 'uncategorized');
        // Optional: Scroll to target log
      }
      if (setTargetLessonId) setTargetLessonId(null);
    }
  }, [targetLessonId, logs, setTargetLessonId]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : language === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(d);
  };

  const getFilteredLogs = () => {
    if (selectedTeacherId === 'all' || selectedTeacherId === null) return logs;
    if (selectedTeacherId === 'uncategorized') return logs.filter(l => !l.teacherId && !teachers.some(t => t.name === l.teacher));
    return logs.filter(l => l.teacherId === selectedTeacherId || (l.teacherId === undefined && l.teacher === teachers.find(t => t.id === selectedTeacherId)?.name));
  };

  const filteredLogs = getFilteredLogs();
  
  // Teacher stats
  const getTeacherStats = (teacherId: string | 'uncategorized') => {
    let teacherLogs = [];
    if (teacherId === 'uncategorized') {
      teacherLogs = logs.filter(l => !l.teacherId && !teachers.some(t => t.name === l.teacher));
    } else {
      teacherLogs = logs.filter(l => l.teacherId === teacherId || (l.teacherId === undefined && l.teacher === teachers.find(t => t.id === teacherId)?.name));
    }
    const count = teacherLogs.length;
    const latest = teacherLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date;
    return { count, latest };
  };

  // ----------------------------------------------------
  // Teacher Actions
  // ----------------------------------------------------
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherForm.name) return;
    
    if (editingTeacher) {
      await updateRecord('lesson_teachers', editingTeacher.id, teacherForm, user);
    } else {
      await addRecord('lesson_teachers', teacherForm, user);
    }
    setIsManagingTeacher(false);
    setEditingTeacher(null);
    setTeacherForm({ name: '', instrument: '', memo: '' });
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const stats = getTeacherStats(teacherId);
    if (stats.count > 0) {
      alert(language === 'ko' ? '이 선생님에게 연결된 레슨 기록이 있습니다. 먼저 기록을 다른 선생님으로 옮기거나 삭제해주세요.' : 'There are lesson records linked to this teacher. Please move or delete them first.');
      return;
    }
    if (!window.confirm(t('common.confirmDelete') || 'Delete?')) return;
    await deleteRecord('lesson_teachers', teacherId, user);
  };

  // ----------------------------------------------------
  // Lesson Actions
  // ----------------------------------------------------
  const handleAddLessonClick = () => {
    setForm({
      teacher: '',
      teacherId: selectedTeacherId && selectedTeacherId !== 'all' && selectedTeacherId !== 'uncategorized' ? selectedTeacherId : '',
      topic: '',
      date: new Date().toISOString().split('T')[0],
      feedback: '',
      nextExercises: '',
      photoIds: [],
      photos: []
    });
    setEditingLog(null);
    setIsAdding(true);
  };

  const handleEditLessonClick = (log: ReceivedLesson) => {
    setEditingLog(log);
    setForm({
      teacher: log.teacher || '',
      teacherId: log.teacherId || '',
      topic: log.topic || '',
      date: log.date || '',
      feedback: log.feedback || '',
      nextExercises: log.nextExercises || '',
      photoIds: log.photoIds || [],
      photos: log.photos || []
    });
    setIsAdding(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic) return;
    
    const selectedTeacher = teachers.find(t => t.id === form.teacherId);
    const lessonData: any = {
      ...form,
      teacher: selectedTeacher ? selectedTeacher.name : form.teacher,
      teacherName: selectedTeacher ? selectedTeacher.name : form.teacher
    };

    if (editingLog) {
      await updateRecord('received_lessons', editingLog.id, lessonData, user);
    } else {
      await addRecord('received_lessons', lessonData, user);
    }
    
    setIsAdding(false);
    setEditingLog(null);
  };

  const handleDeleteLesson = async (log: ReceivedLesson) => {
    if (!window.confirm(t('common.confirmDelete') || 'Delete?')) return;
    
    // Delete local photos
    if (log.photoIds && log.photoIds.length > 0) {
      try {
        await deleteLessonPhotos(log.photoIds);
      } catch (err) {
        console.warn('Failed to delete local photos', err);
      }
    }
    
    // Delete cloud photos
    if (log.photos && log.photos.length > 0) {
      for (const photo of log.photos) {
        try {
          await deleteFileFromStorage(photo.storagePath);
        } catch (err) {
          console.warn('Failed to delete cloud photo', err);
        }
      }
    }
    
    await deleteRecord('received_lessons', log.id, user);
  };

  // ----------------------------------------------------
  // Photo Actions
  // ----------------------------------------------------
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateLessonPhotoFile(file);
    if (!validation.ok) {
      setPhotoError(validation.reason || 'Invalid file');
      return;
    }

    setPhotoError(null);
    setIsUploadingPhoto(true);

    try {
      const compressedResult = await compressImageFile(file);
      const photoId = crypto.randomUUID();

      if (user) {
        // Cloud Upload
        const ext = getSafeFileExtension(file);
        // We use a temporary lessonId if creating new, but for storage path we need it.
        // If editingLog exists, use its id. If not, generate a new id for the lesson that we will use when saving.
        // Wait, addRecord generates ID after saving. So we might not have lessonId.
        // Let's generate an ID for the lesson preemptively or use a random one.
        const targetLessonId = editingLog?.id || crypto.randomUUID();
        
        const storagePath = buildLessonJournalPhotoStoragePath({
          uid: user.uid,
          teacherId: form.teacherId,
          lessonId: targetLessonId,
          photoId,
          ext
        });

        const uploadResult = await uploadFileToStorage({
          file: compressedResult.blob,
          storagePath,
          contentType: compressedResult.contentType
        });

        const cloudPhoto: CloudLessonPhoto = {
          id: photoId,
          storagePath: uploadResult.storagePath,
          fileName: file.name,
          contentType: uploadResult.contentType,
          size: uploadResult.size,
          width: compressedResult.width,
          height: compressedResult.height,
          createdAt: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          source: 'firebase-storage'
        };

        setForm(prev => ({ ...prev, photos: [...prev.photos, cloudPhoto] }));
      } else {
        // Local Upload
        if (!canUseIndexedDB) throw new Error("IndexedDB not available");
        
        const localPhoto = {
          id: photoId,
          studentId: 'lesson-journal', // mock studentId for local storage indexing if needed
          lessonId: editingLog?.id,
          fileName: file.name,
          contentType: compressedResult.contentType,
          size: compressedResult.size,
          createdAt: Date.now(),
          blob: compressedResult.blob,
          width: compressedResult.width,
          height: compressedResult.height
        };

        await saveLessonPhoto(localPhoto);
        setForm(prev => ({ ...prev, photoIds: [...prev.photoIds, photoId] }));
      }
    } catch (err: any) {
      console.error('Failed to process photo', err);
      setPhotoError(language === 'ko' ? '사진 업로드 실패. 네트워크를 확인해주세요.' : 'Photo upload failed. Check network.');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    try {
      await deleteLessonPhotos([photoId]);
      setForm(prev => ({ ...prev, photoIds: prev.photoIds.filter(id => id !== photoId) }));
    } catch (err) {
      console.error('Failed to delete local photo', err);
    }
  };

  const handleRemoveCloudPhoto = async (photo: CloudLessonPhoto) => {
    try {
      await deleteFileFromStorage(photo.storagePath);
      setForm(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== photo.id) }));
    } catch (err) {
      console.error('Failed to delete cloud photo', err);
      setPhotoError(language === 'ko' ? '사진 삭제 실패. 다시 시도해주세요.' : 'Failed to delete photo. Try again.');
    }
  };

  const totalPhotos = form.photoIds.length + form.photos.length;

  // ----------------------------------------------------
  // Render Helpers
  // ----------------------------------------------------
  if (selectedTeacherId === null) {
    // TEACHER LIST VIEW
    const allStats = { count: logs.length, latest: logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date };
    const uncategorizedStats = getTeacherStats('uncategorized');

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-3xl font-serif italic text-stone-200">
            {t('lessons.byTeacher')}
          </h2>
          <button 
            onClick={() => {
              setEditingTeacher(null);
              setTeacherForm({ name: '', instrument: '', memo: '' });
              setIsManagingTeacher(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 border border-white/10 rounded-xl text-stone-300 transition-colors text-sm font-bold"
          >
            <Plus size={16} />
            {t('lessons.addTeacher')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={() => setSelectedTeacherId('all')}
            className="bg-stone-900/50 hover:bg-stone-800/80 border border-white/5 p-6 rounded-[24px] text-left transition-all group flex flex-col h-full"
          >
            <div className="w-12 h-12 rounded-xl bg-brand/20 text-brand flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold text-stone-200 mb-2">{t('lessons.allLessons')}</h3>
            <div className="mt-auto pt-4 flex justify-between text-xs text-stone-500 font-bold uppercase tracking-widest">
              <span>{t('lessons.lessonCount')} {allStats.count}</span>
              {allStats.latest && <span>{formatDate(allStats.latest)}</span>}
            </div>
          </button>

          {teachers.map(teacher => {
            const stats = getTeacherStats(teacher.id);
            return (
              <button 
                key={teacher.id}
                onClick={() => setSelectedTeacherId(teacher.id)}
                className="bg-stone-900/50 hover:bg-stone-800/80 border border-white/5 p-6 rounded-[24px] text-left transition-all group flex flex-col h-full relative"
              >
                <div className="absolute top-4 right-4 flex gap-2">
                  <div 
                    onClick={(e) => { e.stopPropagation(); setEditingTeacher(teacher); setTeacherForm({ name: teacher.name, instrument: teacher.instrument || '', memo: teacher.memo || '' }); setIsManagingTeacher(true); }}
                    className="p-2 text-stone-600 hover:text-white transition-colors"
                  >
                    <Edit size={14} />
                  </div>
                  <div 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(teacher.id); }}
                    className="p-2 text-stone-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-stone-800 text-stone-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <User size={24} />
                </div>
                <h3 className="text-xl font-bold text-stone-200">{teacher.name}</h3>
                {teacher.instrument && <p className="text-sm text-stone-500 mt-1">{teacher.instrument}</p>}
                <div className="mt-auto pt-4 flex justify-between text-xs text-stone-500 font-bold uppercase tracking-widest">
                  <span>{t('lessons.lessonCount')} {stats.count}</span>
                  {stats.latest && <span>{formatDate(stats.latest)}</span>}
                </div>
              </button>
            );
          })}

          {uncategorizedStats.count > 0 && (
            <button 
              onClick={() => setSelectedTeacherId('uncategorized')}
              className="bg-stone-900/30 hover:bg-stone-800/60 border border-white/5 p-6 rounded-[24px] text-left transition-all group flex flex-col h-full"
            >
              <div className="w-12 h-12 rounded-xl bg-stone-800/50 text-stone-600 flex items-center justify-center mb-4">
                <Bookmark size={24} />
              </div>
              <h3 className="text-xl font-bold text-stone-400 mb-2">{t('lessons.uncategorized')}</h3>
              <div className="mt-auto pt-4 flex justify-between text-xs text-stone-600 font-bold uppercase tracking-widest">
                <span>{t('lessons.lessonCount')} {uncategorizedStats.count}</span>
                {uncategorizedStats.latest && <span>{formatDate(uncategorizedStats.latest)}</span>}
              </div>
            </button>
          )}
        </div>

        {/* Teacher Management Modal */}
        <AnimatePresence>
          {isManagingTeacher && (
            <div className="fixed inset-0 z-[100] bg-bg-deep/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full max-w-md bg-stone-900 border border-white/10 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-serif italic text-white">{editingTeacher ? t('lessons.editTeacher') : t('lessons.addTeacher')}</h3>
                  <button onClick={() => setIsManagingTeacher(false)} className="text-stone-500 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveTeacher} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-2">{t('lessons.teacherName')}</label>
                    <input required className="w-full bg-stone-800 border border-white/5 rounded-xl px-4 py-3 text-sm text-white" value={teacherForm.name} onChange={e => setTeacherForm({...teacherForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-2">{t('lessons.instrumentOpt')}</label>
                    <input className="w-full bg-stone-800 border border-white/5 rounded-xl px-4 py-3 text-sm text-white" value={teacherForm.instrument} onChange={e => setTeacherForm({...teacherForm, instrument: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-brand h-12 rounded-xl text-white font-bold mt-4">{t('common.save')}</button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // LESSON LIST VIEW
  const currentTeacherName = selectedTeacherId === 'all' 
    ? (language === 'ko' ? '전체 레슨' : 'All Lessons')
    : selectedTeacherId === 'uncategorized'
      ? (language === 'ko' ? '선생님 미지정' : 'Uncategorized')
      : teachers.find(t => t.id === selectedTeacherId)?.name || 'Unknown';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setSelectedTeacherId(null)}
          className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <h2 className="text-2xl font-serif italic">{currentTeacherName}</h2>
        </button>
        <button 
          onClick={handleAddLessonClick}
          className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {filteredLogs.map(log => (
          <div key={log.id} className="relative group pl-6 sm:pl-10">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/5 group-hover:bg-brand/30 transition-colors"></div>
            <div className="absolute left-[-4px] top-6 w-2 h-2 rounded-full bg-white/20 group-hover:bg-brand transition-colors"></div>
            
            <div className="bg-stone-900/30 hover:bg-stone-900/80 transition-colors border border-white/5 p-6 rounded-[32px] space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-600 font-bold uppercase tracking-[0.2em]">
                    {teachers.find(t => t.id === log.teacherId)?.name || log.teacherName || log.teacher || (language === 'ko' ? '선생님 미지정' : 'Uncategorized')}
                  </p>
                  <h3 className="text-2xl font-serif italic text-stone-200 leading-tight">{log.topic}</h3>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-stone-500 font-bold bg-white/5 px-3 py-1 rounded-full">{formatDate(log.date)}</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button onClick={() => handleEditLessonClick(log)} className="text-[10px] font-bold text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-stone-800 px-2.5 py-1 rounded-lg border border-white/5 transition-colors">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDeleteLesson(log)} className="text-[10px] font-bold text-stone-400 hover:text-red-400 bg-white/5 hover:bg-stone-800 px-2.5 py-1 rounded-lg border border-white/5 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 items-start bg-stone-900/50 p-4 rounded-2xl border border-white/5">
                  <Bookmark size={15} className="text-brand shrink-0 mt-1" />
                  <p className="text-sm text-stone-400 font-serif leading-relaxed italic whitespace-pre-wrap">"{log.feedback}"</p>
                </div>
                
                {log.nextExercises && (
                  <div className="pl-6 border-l border-brand/20">
                    <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">{t('lessons.nextHomework')}</p>
                    <p className="text-xs text-stone-500 font-medium whitespace-pre-wrap">{log.nextExercises}</p>
                  </div>
                )}
              </div>

              {((log.photoIds && log.photoIds.length > 0) || (log.photos && log.photos.length > 0)) && (
                <div className="pt-2 border-t border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {log.photoIds?.map(photoId => (
                      <div key={photoId} className="w-16 h-16 rounded-lg overflow-hidden bg-stone-800 border border-white/5 relative">
                        <LocalPhotoView 
                          photoId={photoId} 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setViewingPhotoId(photoId)}
                        />
                      </div>
                    ))}
                    {log.photos?.map(photo => (
                      <div key={photo.id} className="w-16 h-16 rounded-lg overflow-hidden bg-stone-800 border border-white/5 relative">
                        <CloudPhotoView 
                          photo={photo} 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setViewingCloudPhoto(photo)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-40">
            <Calendar size={40} className="mx-auto text-stone-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-stone-700">{t('lessons.empty')}</p>
          </div>
        )}
      </div>

      {/* Lesson Edit/Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] bg-bg-deep flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-10 max-w-lg mx-auto w-full">
              <h3 className="text-3xl font-serif italic text-white leading-none">{editingLog ? t('lessons.editRecord') : t('lessons.addRecord')}</h3>
              <button onClick={() => setIsAdding(false)} className="bg-stone-900 w-12 h-12 rounded-full flex items-center justify-center text-stone-500"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveLesson} className="space-y-8 max-w-lg mx-auto w-full pb-20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">{t('lessons.teacher')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-700" size={16} />
                    <select 
                      className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-sm appearance-none" 
                      value={form.teacherId} 
                      onChange={e => setForm({...form, teacherId: e.target.value, teacher: ''})}
                    >
                      <option value="">{t('lessons.manualEntry')}</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  {!form.teacherId && (
                    <input 
                      className="w-full bg-stone-900 border border-white/10 rounded-2xl py-3 px-5 text-sm mt-2" 
                      placeholder={t('lessons.teacherName')}
                      value={form.teacher} 
                      onChange={e => setForm({...form, teacher: e.target.value})} 
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">{t('lessons.date')}</label>
                  <input required type="date" className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm color-scheme-dark" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">{t('lessons.topic')}</label>
                <input required className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">{t('lessons.feedback')}</label>
                <textarea required rows={4} className="w-full bg-stone-900 border border-white/10 rounded-3xl py-4 px-5 text-sm resize-none" value={form.feedback} onChange={e => setForm({...form, feedback: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest pl-3 mb-1 block">{t('lessons.nextHomework')}</label>
                <input className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 px-5 text-sm" value={form.nextExercises} onChange={e => setForm({...form, nextExercises: e.target.value})} />
              </div>

              {/* Photos */}
              <div className="space-y-3 bg-stone-900/30 p-5 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon size={12} />
                    {t('lessons.photos')} ({totalPhotos}/3)
                  </label>
                  <label className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${((!canUseIndexedDB && !user) || totalPhotos >= 3) ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                    {isUploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {isUploadingPhoto ? t('lessons.uploadingPhoto') : t('lessons.addPhoto')}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={(!canUseIndexedDB && !user) || isUploadingPhoto || totalPhotos >= 3} />
                  </label>
                </div>
                {!user && (
                  <p className="text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded-lg">
                    {t('lessons.localOnlyNotice')}
                  </p>
                )}
                {photoError && <p className="text-red-400 text-xs px-2">{photoError}</p>}
                
                {(form.photoIds.length > 0 || form.photos.length > 0) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {form.photoIds.map((photoId) => (
                      <div key={photoId} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-stone-800">
                        <LocalPhotoView photoId={photoId} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemovePhoto(photoId)} className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {form.photos.map((photo) => (
                      <div key={photo.id} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-stone-800">
                        <CloudPhotoView photo={photo} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleRemoveCloudPhoto(photo)} className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="w-1/3 bg-stone-900 h-16 rounded-[28px] text-stone-400 font-bold uppercase tracking-widest border border-white/5 active:scale-95 transition-all">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="flex-1 bg-brand h-16 rounded-[28px] text-white font-bold uppercase tracking-widest shadow-2xl shadow-brand/20 active:scale-95 transition-all">
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Viewer Modals */}
      <AnimatePresence>
        {(viewingPhotoId || viewingCloudPhoto) && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center pointer-events-none">
              <button onClick={() => { setViewingPhotoId(null); setViewingCloudPhoto(null); }} className="absolute -top-12 right-0 text-white/50 hover:text-white pointer-events-auto transition-colors bg-stone-900/50 rounded-full p-2">
                <X size={24} />
              </button>
              <div className="pointer-events-auto w-full h-full flex items-center justify-center">
                {viewingPhotoId && <LocalPhotoView photoId={viewingPhotoId} className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />}
                {viewingCloudPhoto && <CloudPhotoView photo={viewingCloudPhoto} className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
