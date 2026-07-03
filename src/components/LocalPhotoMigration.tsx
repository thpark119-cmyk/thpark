import React, { useState } from 'react';
import { Cloud, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getAllLocalPhotos } from '../utils/localPhotoStorage';
import { uploadFileToStorage } from '../utils/cloudStorage';
import { buildLessonPhotoStoragePath } from '../utils/storagePaths';
import { updateRecord } from '../lib/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CloudLessonPhoto } from '../types/cloudFiles';

export default function LocalPhotoMigration() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'migrating' | 'done'>('idle');
  const [scanResult, setScanResult] = useState<{ total: number; migratable: number; unlinked: number; alreadyMigrated: number } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: number; skipped: number; failed: number } | null>(null);
  const [migratablePhotos, setMigratablePhotos] = useState<{ photo: any; studentId: string; lessonId: string; lessonRecordId: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!user) return;
    setStatus('scanning');
    setError(null);
    try {
      const localPhotos = await getAllLocalPhotos();
      const snapshot = await getDocs(collection(db, `users/${user.uid}/students`));
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      let migratable = [];
      let unlinked = 0;
      let alreadyMigrated = 0;

      for (const photo of localPhotos) {
        // Find if this photo is linked to any student/lesson
        let linkedStudent = null;
        let linkedLesson = null;
        let isAlreadyMigrated = false;

        for (const student of students) {
          if (student.lessons) {
            for (const lesson of student.lessons) {
              // Check if photo is in local photoIds
              if (lesson.photoIds && lesson.photoIds.includes(photo.id)) {
                linkedStudent = student;
                linkedLesson = lesson;
              }
              // Check if it's already in cloud photos
              if (lesson.photos && lesson.photos.some((p: any) => p.originalLocalPhotoId === photo.id)) {
                isAlreadyMigrated = true;
              }
            }
          }
        }

        if (isAlreadyMigrated) {
          alreadyMigrated++;
        } else if (linkedStudent && linkedLesson) {
          migratable.push({
            photo,
            studentId: linkedStudent.id,
            lessonId: linkedLesson.id,
            lessonRecordId: linkedStudent.id // In our DB structure, students collection document has lessons array
          });
        } else {
          unlinked++;
        }
      }

      setScanResult({
        total: localPhotos.length,
        migratable: migratable.length,
        unlinked,
        alreadyMigrated
      });
      setMigratablePhotos(migratable);
      setStatus('ready');
    } catch (err: any) {
      console.error('Failed to scan local photos', err);
      setError(err.message || 'Scan failed');
      setStatus('idle');
    }
  };

  const handleMigrate = async () => {
    if (!user || migratablePhotos.length === 0) return;
    setStatus('migrating');
    setError(null);
    
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Group photos by student to minimize firestore updates
    // Actually, it's safer to update lesson by lesson or photo by photo to avoid race conditions if students doc is updated.
    // For simplicity, we can fetch latest student record, update, and save.

    for (const item of migratablePhotos) {
      try {
        // 1. Upload to storage
        const storagePath = buildLessonPhotoStoragePath({
          uid: user.uid,
          studentId: item.studentId,
          lessonId: item.lessonId,
          photoId: item.photo.id,
          ext: item.photo.contentType.split('/')[1] || 'jpeg'
        });

        const uploadResult = await uploadFileToStorage({
          file: item.photo.blob,
          storagePath,
          contentType: item.photo.contentType
        });

        const cloudPhoto: CloudLessonPhoto = {
          id: item.photo.id, // Keep same ID or generate new? Let's use same ID or append _cloud
          storagePath: uploadResult.storagePath,
          fileName: item.photo.fileName || `photo_${item.photo.id}.jpg`,
          contentType: uploadResult.contentType,
          size: uploadResult.size,
          width: item.photo.width,
          height: item.photo.height,
          createdAt: new Date(item.photo.createdAt).toISOString(),
          uploadedAt: new Date().toISOString(),
          source: 'firebase-storage',
          originalLocalPhotoId: item.photo.id,
          migratedFrom: 'indexeddb'
        };

        // 2. Update firestore
        // Fetch fresh student record
        const snapshot = await getDocs(collection(db, `users/${user.uid}/students`));
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const student = students.find(s => s.id === item.studentId);
        
        if (student && student.lessons) {
          const lessonIndex = student.lessons.findIndex((l: any) => l.id === item.lessonId);
          if (lessonIndex !== -1) {
            const lesson = student.lessons[lessonIndex];
            
            // Check if somehow it was already migrated concurrently
            if (lesson.photos && lesson.photos.some((p: any) => p.originalLocalPhotoId === item.photo.id)) {
              skippedCount++;
              continue;
            }

            const updatedPhotos = [...(lesson.photos || []), cloudPhoto];
            // We keep the original local photoIds intact so we don't break existing displays if offline or pending
            
            const updatedLessons = [...student.lessons];
            updatedLessons[lessonIndex] = {
              ...lesson,
              photos: updatedPhotos
            };

            try {
              await updateRecord('students', item.studentId, { lessons: updatedLessons }, user);
              successCount++;
            } catch (fsErr) {
              console.error('Failed to update firestore', fsErr);
              // Rollback delete
              import('../utils/cloudStorage').then(({ deleteFileFromStorage }) => {
                deleteFileFromStorage(storagePath).catch(delErr => console.error('Failed to rollback storage', delErr));
              });
              failedCount++;
            }
          } else {
            failedCount++; // Lesson not found
          }
        } else {
          failedCount++; // Student not found
        }

      } catch (err) {
        console.error(`Failed to migrate photo ${item.photo.id}`, err);
        failedCount++;
      }
    }

    setMigrationResult({ success: successCount, skipped: skippedCount, failed: failedCount });
    if (failedCount > 0) {
      setError(t('settings.localPhotoMigrationFailedInfo') || 'Failed to migrate some photos.');
    }
    setStatus('done');
  };

  return (
    <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
      <div className="flex items-center gap-2 text-stone-300">
        <Cloud size={16} className="text-brand" />
        <h4 className="text-sm font-bold">{t('settings.localPhotoMigrationTitle') || 'Migrate Local Photos'}</h4>
      </div>
      
      <p className="text-xs text-stone-400 leading-relaxed">
        {t('settings.localPhotoMigrationDesc') || 'Migrate local photos to Cloud...'}
      </p>

      {!user ? (
        <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
          {t('settings.localPhotoMigrationLoginRequired') || 'Login required.'}
        </p>
      ) : (
        <div className="space-y-3">
          {status === 'idle' && (
            <button 
              onClick={handleScan}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
            >
              {t('settings.localPhotoMigrationCheck') || 'Check Photos'}
            </button>
          )}

          {status === 'scanning' && (
            <div className="flex items-center gap-2 text-xs text-stone-400 p-3 bg-stone-800/50 rounded-xl">
              <Loader2 size={14} className="animate-spin" />
              Scanning...
            </div>
          )}

          {status === 'ready' && scanResult && (
            <div className="p-4 bg-stone-800/50 border border-brand/20 rounded-xl space-y-4">
              <p className="text-xs text-stone-300 leading-relaxed">
                {(t('settings.localPhotoMigrationScanResult') || '').replace('{count}', scanResult.migratable.toString())}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={handleMigrate}
                  disabled={scanResult.migratable === 0}
                  className="px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Cloud size={14} />
                  {t('settings.localPhotoMigrationStart') || 'Migrate to Cloud'}
                </button>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {status === 'migrating' && (
            <div className="flex items-center gap-2 text-xs text-brand p-4 bg-brand/10 border border-brand/20 rounded-xl">
              <Loader2 size={14} className="animate-spin" />
              {t('settings.localPhotoMigrationInProgress') || 'Migrating...'}
            </div>
          )}

          {status === 'done' && migrationResult && (
            <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                <Check size={16} />
                {t('settings.localPhotoMigrationDone') || 'Done'}
              </div>
              <p className="text-xs text-stone-300 whitespace-pre-line leading-relaxed">
                {(t('settings.localPhotoMigrationSummary') || '')
                  .replace('{successCount}', migrationResult.success.toString())
                  .replace('{skippedCount}', migrationResult.skipped.toString())
                  .replace('{failedCount}', migrationResult.failed.toString())}
              </p>
              {error && (
                <p className="text-xs text-red-400 mt-2 flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  {error}
                </p>
              )}
              <button 
                onClick={() => setStatus('idle')}
                className="mt-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-medium transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
