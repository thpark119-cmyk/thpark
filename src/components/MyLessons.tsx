import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Bookmark, X, Calendar, User, Edit, Trash2, Camera, Loader2, ChevronLeft, Image as ImageIcon, Users } from 'lucide-react';
import { ReceivedLesson, LessonTeacher } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { compressImageFile, compressImageForUpload } from '../utils/imageCompression';
import { saveLessonPhoto, deleteLessonPhotos, isIndexedDBAvailable } from '../utils/localPhotoStorage';
import LocalPhotoView from './LocalPhotoView';
import CloudPhotoView from './CloudPhotoView';
import { uploadFileToStorage, deleteFileFromStorage } from '../utils/cloudStorage';
import { validateLessonPhotoFile, getSafeFileExtension } from '../utils/fileValidation';
import { buildLessonJournalPhotoStoragePath } from '../utils/storagePaths';
import { CloudLessonPhoto } from '../types/cloudFiles';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PendingPhotoUpload {
  id: string;
  file: File;
  blob: Blob;
  previewUrl: string;
  fileName: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  extension: 'jpg' | 'webp';
}

interface PendingPhotoDelete {
  id: string;
  source: 'firebase-storage' | 'indexeddb';
  storagePath?: string;
}

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
  const [uploadStage, setUploadStage] = useState<'idle' | 'compressing' | 'uploading' | 'success'>('idle');
  const [photoError, setPhotoError] = useState<string | null>(null);
  
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoUpload[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<PendingPhotoDelete[]>([]);
  
  // Teacher management
  const [isManagingTeacher, setIsManagingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<LessonTeacher | null>(null);
  const [teacherForm, setTeacherForm] = useState({ name: '', instrument: '', memo: '' });

  // Lock body scroll when any overlay or modal is active
  useBodyScrollLock(isAdding || isManagingTeacher || !!viewingPhotoId || !!viewingCloudPhoto);

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
    setPendingPhotos([]);
    setPendingDeletes([]);
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
    setPendingPhotos([]);
    setPendingDeletes([]);
    setIsAdding(true);
  };

  const handleCancel = () => {
    const hasTextChanges = editingLog 
      ? (form.teacher !== (editingLog.teacher || '') ||
         form.teacherId !== (editingLog.teacherId || '') ||
         form.topic !== (editingLog.topic || '') ||
         form.date !== (editingLog.date || '') ||
         form.feedback !== (editingLog.feedback || '') ||
         form.nextExercises !== (editingLog.nextExercises || ''))
      : (form.teacher !== '' || form.topic !== '' || form.feedback !== '' || form.nextExercises !== '');

    const hasChanges = hasTextChanges || pendingPhotos.length > 0 || pendingDeletes.length > 0;

    if (hasChanges) {
      if (!window.confirm(t('common.unsavedChangesWarning'))) {
        return;
      }
    }

    // Revoke all preview URLs
    for (const pending of pendingPhotos) {
      URL.revokeObjectURL(pending.previewUrl);
    }
    setPendingPhotos([]);
    setPendingDeletes([]);
    setIsAdding(false);
    setEditingLog(null);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic) return;

    setIsUploadingPhoto(true);
    setUploadStage('uploading');

    const uploadedCloudPhotos: CloudLessonPhoto[] = [];
    const savedLocalIds: string[] = [];

    try {
      const targetLessonId = editingLog?.id || crypto.randomUUID();

      if (user) {
        // 1. Upload new pending photos to Storage
        for (const pending of pendingPhotos) {
          const storagePath = buildLessonJournalPhotoStoragePath({
            uid: user.uid,
            teacherId: form.teacherId || 'uncategorized',
            lessonId: targetLessonId,
            photoId: pending.id,
            ext: pending.extension
          });

          const uploadResult = await uploadFileToStorage({
            file: pending.blob,
            storagePath,
            contentType: pending.contentType
          });

          const cloudPhoto: CloudLessonPhoto = {
            id: pending.id,
            storagePath: uploadResult.storagePath,
            fileName: pending.fileName,
            contentType: uploadResult.contentType,
            size: pending.size,
            width: pending.width,
            height: pending.height,
            createdAt: new Date().toISOString(),
            uploadedAt: new Date().toISOString(),
            source: 'firebase-storage'
          };
          uploadedCloudPhotos.push(cloudPhoto);
        }
      } else {
        // Save new pending photos to IndexedDB
        if (pendingPhotos.length > 0 && !canUseIndexedDB) {
          throw new Error("IndexedDB not available");
        }

        for (const pending of pendingPhotos) {
          const localPhoto = {
            id: pending.id,
            studentId: 'lesson-journal',
            lessonId: targetLessonId,
            fileName: pending.fileName,
            contentType: pending.contentType,
            size: pending.size,
            createdAt: Date.now(),
            blob: pending.blob,
            width: pending.width,
            height: pending.height
          };

          await saveLessonPhoto(localPhoto);
          savedLocalIds.push(pending.id);
        }
      }

      // 2. Prepare final photos lists for Firestore/localStorage
      const finalCloudPhotos = form.photos
        .filter(p => !pendingDeletes.some(d => d.id === p.id))
        .concat(uploadedCloudPhotos);

      const finalLocalIds = form.photoIds
        .filter(id => !pendingDeletes.some(d => d.id === id))
        .concat(savedLocalIds);

      // 3. Save lesson log record
      const selectedTeacher = teachers.find(t => t.id === form.teacherId);
      const lessonData: any = {
        teacher: selectedTeacher ? selectedTeacher.name : form.teacher,
        teacherName: selectedTeacher ? selectedTeacher.name : form.teacher,
        teacherId: form.teacherId || '',
        topic: form.topic,
        date: form.date,
        feedback: form.feedback,
        nextExercises: form.nextExercises,
        photoIds: finalLocalIds,
        photos: finalCloudPhotos
      };

      if (editingLog) {
        await updateRecord('received_lessons', editingLog.id, lessonData, user);
      } else {
        const newRecord = {
          id: targetLessonId,
          ...lessonData
        };
        await addRecord('received_lessons', newRecord, user);
      }

      // 4. Actually delete the photos marked for deletion
      let deleteFailed = false;
      for (const del of pendingDeletes) {
        if (del.source === 'firebase-storage' && del.storagePath) {
          try {
            console.log('[Mio Storage Delete]', {
              action: 'delete_received_lesson_photo_on_commit',
              storagePath: del.storagePath,
            });
            await deleteFileFromStorage(del.storagePath);
          } catch (err) {
            console.error('Failed to delete cloud photo during commit', del.storagePath, err);
            deleteFailed = true;
          }
        } else if (del.source === 'indexeddb') {
          try {
            await deleteLessonPhotos([del.id]);
          } catch (err) {
            console.warn('Failed to delete local photo during commit', del.id, err);
          }
        }
      }

      if (deleteFailed) {
        alert(t('common.partialDeleteError') || 'Some photos could not be deleted from the cloud.');
      }

      // Cleanup object URLs
      for (const pending of pendingPhotos) {
        URL.revokeObjectURL(pending.previewUrl);
      }

      setPendingPhotos([]);
      setPendingDeletes([]);
      setIsAdding(false);
      setEditingLog(null);

    } catch (err: any) {
      console.error('Failed to save lesson with photos', err);
      // ROLLBACK
      if (user) {
        for (const uploaded of uploadedCloudPhotos) {
          try {
            await deleteFileFromStorage(uploaded.storagePath);
          } catch (rErr) {
            console.error('Rollback failed for storage path', uploaded.storagePath, rErr);
          }
        }
      } else {
        for (const savedId of savedLocalIds) {
          try {
            await deleteLessonPhotos([savedId]);
          } catch (rErr) {
            console.error('Rollback failed for local photo id', savedId, rErr);
          }
        }
      }

      alert(t('common.saveError') || 'Failed to save. Please check your network connection.');
    } finally {
      setIsUploadingPhoto(false);
      setUploadStage('idle');
    }
  };

  const handleDeleteLesson = async (log: ReceivedLesson) => {
    if (!window.confirm(t('common.confirmDelete') || 'Delete?')) return;
    
    let storageDeleteFailed = false;
    
    // Delete cloud photos
    if (log.photos && log.photos.length > 0) {
      for (const photo of log.photos) {
        try {
          console.log('[Mio Storage Delete]', {
            action: 'delete_received_lesson_photo_with_lesson',
            storagePath: photo.storagePath,
          });
          await deleteFileFromStorage(photo.storagePath);
        } catch (err) {
          console.error('Failed to delete cloud photo', photo.storagePath, err);
          storageDeleteFailed = true;
        }
      }
    }
    
    if (storageDeleteFailed) {
      alert(t('common.partialDeleteError') || 'Some photos could not be deleted from the cloud.');
      return;
    }

    // Delete local photos
    if (log.photoIds && log.photoIds.length > 0) {
      try {
        await deleteLessonPhotos(log.photoIds);
      } catch (err) {
        console.warn('Failed to delete local photos', err);
      }
    }
    
    try {
      await deleteRecord('received_lessons', log.id, user);
    } catch (err) {
      console.error('Failed to delete lesson log record', err);
      alert(t('common.deleteFailed') || 'Failed to delete record.');
    }
  };

  // ----------------------------------------------------
  // Photo Actions
  // ----------------------------------------------------
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1단계: 원본 파일 형식 및 20MB 이하 검증
    const validation = validateLessonPhotoFile(file);
    if (!validation.ok) {
      if (validation.reason === 'unsupportedFormat') {
        setPhotoError(t('common.photoUnsupportedFormat'));
      } else if (validation.reason === 'tooLarge') {
        setPhotoError(t('common.photoTooLarge'));
      } else {
        setPhotoError(validation.reason || 'Invalid file');
      }
      return;
    }

    setPhotoError(null);
    setIsUploadingPhoto(true);
    setUploadStage('compressing');

    try {
      // 2단계: 자동 압축
      const compressedResult = await compressImageForUpload(file);
      const photoId = crypto.randomUUID();

      // 3단계: 압축 결과 검증 (950KB 이하)
      const compressedFileMock = new File([compressedResult.blob], file.name, { type: compressedResult.contentType });
      const compressedValidation = validateLessonPhotoFile(compressedFileMock, { isCompressed: true });
      if (!compressedValidation.ok) {
        setPhotoError(t('common.photoCompressFailed'));
        setIsUploadingPhoto(false);
        setUploadStage('idle');
        return;
      }

      const previewUrl = URL.createObjectURL(compressedResult.blob);
      const newPendingPhoto: PendingPhotoUpload = {
        id: photoId,
        file,
        blob: compressedResult.blob,
        previewUrl,
        fileName: file.name,
        contentType: compressedResult.contentType,
        size: compressedResult.compressedSize,
        width: compressedResult.width,
        height: compressedResult.height,
        extension: compressedResult.extension
      };

      setPendingPhotos(prev => [...prev, newPendingPhoto]);
      setUploadStage('success');
    } catch (err: any) {
      console.error('Failed to process photo', err);
      setPhotoError(t('common.photoUploadFailed'));
    } finally {
      setIsUploadingPhoto(false);
      setUploadStage('idle');
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPendingDeletes(prev => [...prev, { id: photoId, source: 'indexeddb' }]);
  };

  const handleRemoveCloudPhoto = (photo: CloudLessonPhoto) => {
    setPendingDeletes(prev => [...prev, { id: photo.id, source: 'firebase-storage', storagePath: photo.storagePath }]);
  };

  const handleRemovePendingPhoto = (photoId: string) => {
    const photo = pendingPhotos.find(p => p.id === photoId);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleUndoDeletePhoto = (photoId: string) => {
    setPendingDeletes(prev => prev.filter(d => d.id !== photoId));
  };

  const displayedLocalIds = form.photoIds.filter(id => !pendingDeletes.some(d => d.id === id));
  const displayedCloudPhotos = form.photos.filter(p => !pendingDeletes.some(d => d.id === p.id));
  const totalPhotos = displayedLocalIds.length + displayedCloudPhotos.length + pendingPhotos.length;

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
            <div className="fixed inset-0 z-[100] bg-bg-deep/95 backdrop-blur-md flex flex-col items-center justify-center p-6 overscroll-contain">
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
          <div className="fixed inset-0 h-[100dvh] z-[100] bg-bg-deep flex flex-col p-6 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
            <div className="flex justify-between items-center mb-10 max-w-lg mx-auto w-full">
              <h3 className="text-3xl font-serif italic text-white leading-none">{editingLog ? t('lessons.editRecord') : t('lessons.addRecord')}</h3>
              <button onClick={handleCancel} className="bg-stone-900 w-12 h-12 rounded-full flex items-center justify-center text-stone-500"><X size={24} /></button>
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
                    {isUploadingPhoto 
                      ? (uploadStage === 'compressing' ? t('common.photoCompressing') : t('common.photoUploading')) 
                      : t('lessons.addPhoto')}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={(!canUseIndexedDB && !user) || isUploadingPhoto || totalPhotos >= 3} />
                  </label>
                </div>
                {!user && (
                  <p className="text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded-lg">
                    {t('lessons.localOnlyNotice')}
                  </p>
                )}
                {photoError && <p className="text-red-400 text-xs px-2">{photoError}</p>}
                
                {(form.photoIds.length > 0 || form.photos.length > 0 || pendingPhotos.length > 0) && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {/* Existing local photos */}
                    {form.photoIds.map((photoId) => {
                      const isDeleted = pendingDeletes.some(d => d.id === photoId);
                      return (
                        <div key={photoId} className={`relative group w-20 h-20 rounded-xl overflow-hidden border bg-stone-800 transition-all ${isDeleted ? 'border-red-500/50 opacity-40 scale-95' : 'border-white/10 cursor-pointer hover:border-white/30'}`}>
                          <LocalPhotoView 
                            photoId={photoId} 
                            className="w-full h-full object-cover" 
                            onClick={() => !isDeleted && setViewingPhotoId(photoId)}
                          />
                          {isDeleted ? (
                            <div className="absolute inset-0 bg-red-950/40 flex flex-col items-center justify-center gap-1 p-1 z-10" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-1 py-0.5 rounded-md leading-none">{t('common.photoPendingDelete')}</span>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleUndoDeletePhoto(photoId);
                                }} 
                                className="text-[10px] text-stone-300 underline font-semibold hover:text-white"
                              >
                                {t('common.photoUndoDelete')}
                              </button>
                            </div>
                          ) : (
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemovePhoto(photoId);
                              }} 
                              className="absolute top-1 right-1 w-8 h-8 bg-red-600/90 active:scale-95 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-md z-10 transition-all"
                              title={t('common.delete') || 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Existing cloud photos */}
                    {form.photos.map((photo) => {
                      const isDeleted = pendingDeletes.some(d => d.id === photo.id);
                      return (
                        <div key={photo.id} className={`relative group w-20 h-20 rounded-xl overflow-hidden border bg-stone-800 transition-all ${isDeleted ? 'border-red-500/50 opacity-40 scale-95' : 'border-white/10 cursor-pointer hover:border-white/30'}`}>
                          <CloudPhotoView 
                            photo={photo} 
                            className="w-full h-full object-cover" 
                            onClick={() => !isDeleted && setViewingCloudPhoto(photo)}
                          />
                          {isDeleted ? (
                            <div className="absolute inset-0 bg-red-950/40 flex flex-col items-center justify-center gap-1 p-1 z-10" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-1 py-0.5 rounded-md leading-none">{t('common.photoPendingDelete')}</span>
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleUndoDeletePhoto(photo.id);
                                }} 
                                className="text-[10px] text-stone-300 underline font-semibold hover:text-white"
                              >
                                {t('common.photoUndoDelete')}
                              </button>
                            </div>
                          ) : (
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemoveCloudPhoto(photo);
                              }} 
                              className="absolute top-1 right-1 w-8 h-8 bg-red-600/90 active:scale-95 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-md z-10 transition-all"
                              title={t('common.delete') || 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* New pending photos */}
                    {pendingPhotos.map((photo) => (
                      <div key={photo.id} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/40 bg-stone-800 ring-2 ring-emerald-500/20 cursor-pointer">
                        <img 
                          src={photo.previewUrl} 
                          alt={photo.fileName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          onClick={() => setViewingPhotoId(photo.id)}
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-emerald-950/80 py-0.5 text-center pointer-events-none">
                          <p className="text-[8px] text-emerald-400 font-bold leading-none">{t('common.photoNewAdded')}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRemovePendingPhoto(photo.id);
                          }} 
                          className="absolute top-1 right-1 w-8 h-8 bg-red-600/90 active:scale-95 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-md z-10 transition-all"
                          title={t('common.delete') || 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(pendingPhotos.length > 0 || pendingDeletes.length > 0) && (
                  <p className="text-[10px] text-stone-500 mt-2 bg-stone-900/50 p-2.5 rounded-xl border border-white/5">
                    {pendingPhotos.length > 0 && <span className="block text-emerald-500/80">✓ {t('common.photoWillBeUploaded')}</span>}
                    {pendingDeletes.length > 0 && <span className="block text-red-500/80">✗ {t('common.photoWillBeDeleted')}</span>}
                    <span className="block mt-1 text-stone-500">{language === 'ko' ? '취소하면 새로 추가한 사진과 삭제 예정 상태가 모두 사라집니다.' : 'Cancelling will discard all newly added photos and pending deletions.'}</span>
                  </p>
                )}
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={handleCancel} className="w-1/3 bg-stone-900 h-16 rounded-[28px] text-stone-400 font-bold uppercase tracking-widest border border-white/5 active:scale-95 transition-all">
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
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overscroll-contain" style={{ touchAction: 'none' }}>
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
