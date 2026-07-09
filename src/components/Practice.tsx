import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Calendar, Clock, BookOpen, Music, Trash2, Edit2, 
  AlertTriangle, Smile, Meh, Frown, Save, X, Activity, 
  Trophy, BookOpen as BookIcon, ChevronRight, Star, ListTodo
} from 'lucide-react';
import { PracticeEntry, PracticeRoutine, PracticeRoutineItem, PracticeSubjectType } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePracticeTimer } from '../context/PracticeTimerContext';
import PracticeRoutineModal from './PracticeRoutineModal';
import { isAdminUser } from '../utils/admin';

// Helper to get local YYYY-MM-DD date string safely without timezone offsets
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Practice() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  
  const timer = usePracticeTimer();

  // Modals / Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PracticeEntry | null>(null);
  
  // Routine states
  const [routines, setRoutines] = useState<PracticeRoutine[]>([]);
  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<PracticeRoutine | null>(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Form fields
  const [date, setDate] = useState(getLocalDateString());
  const [practiceTime, setPracticeTime] = useState<number>(30);
  const [practiceSubjectType, setPracticeSubjectType] = useState<PracticeSubjectType>('piece');
  const [pieceTitle, setPieceTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [goal, setGoal] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [problem, setProblem] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [memo, setMemo] = useState('');
  const [mood, setMood] = useState<'good' | 'normal' | 'hard'>('normal');

  // Share fields
  const [shareVisibility, setShareVisibility] = useState<'private' | 'shareCard' | 'groupReady'>('private');
  const [publicMemo, setPublicMemo] = useState('');
  const [shareIncludePiece, setShareIncludePiece] = useState(true);
  const [shareIncludeGoal, setShareIncludeGoal] = useState(true);
  const [shareIncludeFocusArea, setShareIncludeFocusArea] = useState(true);
  const [shareIncludeNextAction, setShareIncludeNextAction] = useState(true);
  const [shareIncludeMood, setShareIncludeMood] = useState(true);
  const [shareIncludeRoutine, setShareIncludeRoutine] = useState(true);
  const [shareIncludeTimer, setShareIncludeTimer] = useState(true);

  // Hidden source tracking fields
  const [sourceType, setSourceType] = useState<'manual' | 'routine' | 'timer'>('manual');
  const [routineTitle, setRoutineTitle] = useState('');
  const [measuredByTimer, setMeasuredByTimer] = useState(false);
  const [adminAdjustedTimer, setAdminAdjustedTimer] = useState<boolean | undefined>(undefined);
  const [adminAdjustedBy, setAdminAdjustedBy] = useState<string | undefined>(undefined);
  const [routineGoalReached, setRoutineGoalReached] = useState<boolean | undefined>(undefined);
  const [targetMinutes, setTargetMinutes] = useState<number | undefined>(undefined);

  // UI States
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showShareSettings, setShowShareSettings] = useState(false);
  const [sharingEntry, setSharingEntry] = useState<PracticeEntry | null>(null);

  // Filter states
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [filterDate, setFilterDate] = useState<string>(getLocalDateString());

  // Lock scroll when modal is open
  useBodyScrollLock(isAdding || !!editingEntry || isAddingRoutine || !!editingRoutine || !!sharingEntry);

  // Subscribe to practice entries
  useEffect(() => {
    const unsubscribe = subscribeToCollection<PracticeEntry>('practice_entries', (data) => {
      // Sort by date descending, then by createdAt descending
      const sorted = [...data].sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setEntries(sorted);
    }, user);
    return unsubscribe;
  }, [user]);

  // Subscribe to practice routines
  useEffect(() => {
    const unsubscribe = subscribeToCollection<PracticeRoutine>('practice_routines', (data) => {
      // Sort by isFavorite descending, then by updatedAt descending, then by createdAt descending
      const sorted = [...data].sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      setRoutines(sorted);
    }, user);
    return unsubscribe;
  }, [user]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setDate(getLocalDateString());
    setPracticeTime(30);
    setPracticeSubjectType('piece');
    setPieceTitle('');
    setComposer('');
    setGoal('');
    setFocusArea('');
    setWhatWentWell('');
    setProblem('');
    setNextAction('');
    setMemo('');
    setMood('normal');
    
    // Share fields
    setShareVisibility('private');
    setPublicMemo('');
    setShareIncludePiece(true);
    setShareIncludeGoal(true);
    setShareIncludeFocusArea(true);
    setShareIncludeNextAction(true);
    setShareIncludeMood(true);
    setShareIncludeRoutine(true);
    setShareIncludeTimer(true);
    setSourceType('manual');
    setRoutineTitle('');
    setMeasuredByTimer(false);
    setAdminAdjustedTimer(undefined);
    setAdminAdjustedBy(undefined);

    setErrorMsg('');
    setIsAdding(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (entry: PracticeEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setPracticeTime(entry.practiceTime);
    setPracticeSubjectType(entry.practiceSubjectType || 'piece');
    setPieceTitle(entry.pieceTitle);
    setComposer(entry.composer || '');
    setGoal(entry.goal || '');
    setFocusArea(entry.focusArea || '');
    setWhatWentWell(entry.whatWentWell || '');
    setProblem(entry.problem || '');
    setNextAction(entry.nextAction || '');
    setMemo(entry.memo || '');
    setMood(entry.mood || 'normal');
    
    // Share fields
    setShareVisibility(entry.shareVisibility || 'private');
    setPublicMemo(entry.publicMemo || '');
    setShareIncludePiece(entry.shareIncludePiece ?? true);
    setShareIncludeGoal(entry.shareIncludeGoal ?? true);
    setShareIncludeFocusArea(entry.shareIncludeFocusArea ?? true);
    setShareIncludeNextAction(entry.shareIncludeNextAction ?? true);
    setShareIncludeMood(entry.shareIncludeMood ?? true);
    setShareIncludeRoutine(entry.shareIncludeRoutine ?? true);
    setShareIncludeTimer(entry.shareIncludeTimer ?? true);
    setSourceType(entry.sourceType || 'manual');
    setRoutineTitle(entry.routineTitle || '');
    setMeasuredByTimer(entry.measuredByTimer || false);
    setAdminAdjustedTimer(entry.adminAdjustedTimer);
    setAdminAdjustedBy(entry.adminAdjustedBy);
    setRoutineGoalReached(entry.routineGoalReached);
    setTargetMinutes(entry.targetMinutes);

    setErrorMsg('');
  };

  const forceCloseModal = () => {
    setIsAdding(false);
    setEditingEntry(null);
    setErrorMsg('');
    setShowCancelConfirm(false);
  };

  const handleCloseModal = () => {
    if (isAdding || editingEntry) {
      setShowCancelConfirm(true);
    } else {
      forceCloseModal();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pieceTitle.trim()) {
      setErrorMsg(t('practiceLog.pieceTitle') + ' ' + (t('common.saveError') || '필수 항목입니다.'));
      return;
    }
    if (practiceTime <= 0) {
      setErrorMsg(t('practiceLog.practiceTime') + ' ' + (t('common.saveError') || '0보다 커야 합니다.'));
      return;
    }

    if (!window.confirm(t('practiceLog.confirmSave') || '연습 기록을 저장하시겠습니까?')) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const recordId = editingEntry ? editingEntry.id : crypto.randomUUID();
      const isAdmin = isAdminUser(user);
      const isEditing = Boolean(editingEntry);
      
      const finalPracticeTime = isEditing && !isAdmin
        ? (editingEntry!.practiceTime || Number(practiceTime))
        : Number(practiceTime);

      const record: PracticeEntry = {
        id: recordId,
        userId: user?.uid || 'local',
        date,
        practiceTime: finalPracticeTime,
        practiceSubjectType,
        pieceTitle: pieceTitle.trim(),
        mood,
        shareVisibility,
        shareIncludePiece,
        shareIncludeGoal,
        shareIncludeFocusArea,
        shareIncludeNextAction,
        shareIncludeMood,
        shareIncludeRoutine,
        shareIncludeTimer,
        sourceType,
        measuredByTimer,
        adminAdjustedTimer,
        adminAdjustedBy,
        routineGoalReached,
        targetMinutes,
        createdAt: editingEntry?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (goal.trim()) record.goal = goal.trim();
      if (focusArea.trim()) record.focusArea = focusArea.trim();
      if (whatWentWell.trim()) record.whatWentWell = whatWentWell.trim();
      if (problem.trim()) record.problem = problem.trim();
      if (nextAction.trim()) record.nextAction = nextAction.trim();
      if (memo.trim()) record.memo = memo.trim();
      if (publicMemo.trim()) record.publicMemo = publicMemo.trim();
      if (routineTitle.trim()) record.routineTitle = routineTitle.trim();

      // Clean undefined values for Firestore
      Object.keys(record).forEach(key => {
        if ((record as any)[key] === undefined) {
          delete (record as any)[key];
        }
      });

      if (editingEntry) {
        await updateRecord('practice_entries', record.id, record, user);
      } else {
        await addRecord('practice_entries', record, user);
      }

      forceCloseModal();
    } catch (err) {
      console.error('Error saving practice log:', err);
      setErrorMsg(t('practiceLog.saveFailed') || '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!window.confirm(t('practiceLog.confirmDelete') || '이 연습 기록을 삭제할까요?')) {
      return;
    }
    try {
      await deleteRecord('practice_entries', entryId, user);
      forceCloseModal();
    } catch (err) {
      console.error('Error deleting practice log:', err);
      alert(t('practiceLog.deleteFailed') || '삭제에 실패했습니다.');
    }
  };

  // --- Routine Helper Actions ---

  const handleToggleFavoriteRoutine = async (routine: PracticeRoutine, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = {
        ...routine,
        isFavorite: !routine.isFavorite,
        updatedAt: Date.now()
      };
      await updateRecord('practice_routines', routine.id, updated, user);
    } catch (err) {
      console.error('Error toggling favorite routine:', err);
    }
  };

  const handleDeleteRoutine = async (routineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('practiceLog.confirmDeleteRoutine') || '이 루틴을 삭제할까요?')) {
      return;
    }
    try {
      await deleteRecord('practice_routines', routineId, user);
    } catch (err) {
      console.error('Error deleting routine:', err);
      alert(t('practiceLog.deleteRoutineFailed') || '루틴 삭제에 실패했습니다.');
    }
  };

  const handleOpenEditRoutine = (routine: PracticeRoutine, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoutine(routine);
  };

  const handleStartTimerFromRoutine = (routine: PracticeRoutine) => {
    timer.startSession({
      routineId: routine.id,
      routineTitle: routine.title,
      routineItemsText: routine.items.map(i => `${i.label} (${i.minutes}m)`).join(' | '),
      targetMinutes: routine.totalMinutes,
      pieceTitle: routine.title
    });
    // Scroll to top to see timer
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartFreeTimer = () => {
    timer.startSession({
      pieceTitle: t('practiceLog.freePractice') || '자유 연습'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (timer.session?.status === 'finished') {
      const finalSeconds = timer.getFinalSeconds();
      
      if (finalSeconds < 30) {
        alert(t('practiceLog.lessThan30Sec') || '30초 미만의 연습은 기록으로 저장하기 어렵습니다.');
        timer.clearSession();
        return;
      }

      const finalMinutes = Math.max(1, Math.round(finalSeconds / 60));
      const session = timer.session;
      
      setDate(getLocalDateString());
      setPracticeTime(finalMinutes);
      setPieceTitle(session?.pieceTitle || '');
      setComposer(session?.composer || '');
      setGoal(session?.goal || session?.routineItemsText || '');
      setFocusArea(session?.focusArea || '');
      setWhatWentWell('');
      setProblem('');
      setNextAction('');
      setMemo('');
      setMood('normal');
      
      // Share & tracking defaults for timer
      setShareVisibility('private');
      setPublicMemo('');
      setShareIncludePiece(true);
      setShareIncludeGoal(true);
      setShareIncludeFocusArea(true);
      setShareIncludeNextAction(true);
      setShareIncludeMood(true);
      setShareIncludeRoutine(true);
      setShareIncludeTimer(true);
      setSourceType('timer');
      setRoutineTitle(session?.routineTitle || '');
      setMeasuredByTimer(true);
      setAdminAdjustedTimer(session.adminAdjustedTimer);
      setAdminAdjustedBy(session.adminAdjustedBy);
      setRoutineGoalReached(session.routineGoalReached);
      setTargetMinutes(session.targetMinutes);
      
      timer.clearSession();
      setIsAdding(true);
    }
  }, [timer.session, timer, t]);

  const handleFinishTimer = () => {
    if (!window.confirm(t('practiceLog.confirmFinish') || '연습을 종료하고 기록으로 저장할까요?')) {
      return;
    }
    timer.finishSession();
  };

  const handleCancelTimer = () => {
    if (window.confirm(t('practiceLog.exitWithoutSaving') || '저장하지 않고 종료할까요?')) {
      timer.clearSession();
    }
  };

  // --- Sharing Logic ---
  const generateShareText = (entry: PracticeEntry) => {
    const lines = [];
    lines.push(`🎻 ${t('app.name')} - ${t('practiceLog.todaysPractice') || '오늘의 연습'}`);
    lines.push('');
    lines.push(`${t('practiceLog.date')}: ${entry.date}`);
    lines.push(`${t('practiceLog.totalPracticeTime') || '총 연습 시간'}: ${formatDuration(entry.practiceTime)}`);
    
    if (entry.shareIncludeTimer !== false && entry.measuredByTimer) {
      lines.push(`${t('practiceLog.measureMethod') || '측정 방식'}: ${t('practiceLog.focusPracticeTimer') || '집중 연습 타이머'}`);
    }
    if (entry.shareIncludePiece !== false && entry.pieceTitle) {
      const typeText = entry.practiceSubjectType && entry.practiceSubjectType !== 'piece' 
        ? `[${t(`practiceLog.subjectType${entry.practiceSubjectType.charAt(0).toUpperCase() + entry.practiceSubjectType.slice(1)}` as any) || entry.practiceSubjectType}] `
        : '';
      lines.push(`${t('practiceLog.practiceSubjectName') || '연습 대상'}: ${typeText}${entry.pieceTitle}${entry.composer ? ` (${entry.composer})` : ''}`);
    }
    if (entry.shareIncludeRoutine !== false && entry.routineTitle) {
      lines.push(`${t('practiceLog.routineName')}: ${entry.routineTitle}`);
    }
    if (entry.shareIncludeGoal !== false && entry.goal) {
      lines.push(`${t('practiceLog.goal')}: ${entry.goal}`);
    }
    if (entry.shareIncludeFocusArea !== false && entry.focusArea) {
      lines.push(`${t('practiceLog.focusArea')}: ${entry.focusArea}`);
    }
    if (entry.shareIncludeNextAction !== false && entry.nextAction) {
      lines.push(`${t('practiceLog.nextAction')}: ${entry.nextAction}`);
    }
    if (entry.shareIncludeMood !== false && entry.mood) {
      const moodStr = entry.mood === 'good' ? t('practiceLog.moodGood') : entry.mood === 'hard' ? t('practiceLog.moodHard') : t('practiceLog.moodNormal');
      lines.push(`${t('practiceLog.mood')}: ${moodStr}`);
    }
    if (entry.publicMemo) {
      lines.push(`${t('practiceLog.publicMemo') || '공개 메모'}: ${entry.publicMemo}`);
    }
    return lines.join('\n');
  };

  const handleShare = async (entry: PracticeEntry) => {
    const text = generateShareText(entry);
    const title = `${t('app.name')} - ${t('practiceLog.todaysPractice') || '오늘의 연습'}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          // Fallback to copy
        } else {
          return; // User cancelled
        }
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(text);
      alert(t('practiceLog.copySuccess') || '복사되었습니다.');
    } catch (err) {
      console.error('Error copying text:', err);
      alert(t('practiceLog.copyFail') || '복사에 실패했습니다.');
    }
  };

  const handleCopyText = async (entry: PracticeEntry) => {
    const text = generateShareText(entry);
    try {
      await navigator.clipboard.writeText(text);
      alert(t('practiceLog.copySuccess') || '복사되었습니다.');
    } catch (err) {
      console.error('Error copying text:', err);
      alert(t('practiceLog.copyFail') || '복사에 실패했습니다.');
    }
  };

  // --- Statistics Calculation ---
  // Current week boundaries: Monday to Sunday
  const getWeekRange = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, ...
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const { monday, sunday } = getWeekRange();
  const mondayStr = getLocalDateString(monday);
  const sundayStr = getLocalDateString(sunday);

  // Filter entries in the current week (YYYY-MM-DD strings are lexicographically comparable)
  const currentWeekEntries = entries.filter(
    (entry) => entry.date >= mondayStr && entry.date <= sundayStr
  );

  const weeklyTotalMinutes = currentWeekEntries.reduce((sum, e) => sum + e.practiceTime, 0);
  const weeklyRecordCount = currentWeekEntries.length;

  // Today's total minutes
  const todayStr = getLocalDateString();
  const todayEntries = entries.filter((entry) => entry.date === todayStr);
  const todayTotalMinutes = todayEntries.reduce((sum, e) => sum + e.practiceTime, 0);

  // Helper to format minutes into beautiful hours and minutes
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  // Format date nicely for rendering (e.g. 7월 5일 (토))
  const formatEntryDate = (dateStr: string) => {
    try {
      if (dateStr === todayStr) return t('practiceLog.today') || '오늘';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateStr === getLocalDateString(yesterday)) return t('practiceLog.yesterday') || '어제';

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const locale = t('app.shortAppName') === 'Mio' ? 'ko-KR' : 'en-US';
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric', 
        weekday: 'short' 
      };
      return d.toLocaleDateString(locale, options);
    } catch {
      return dateStr;
    }
  };

  const getEntryDateSafely = (entry: PracticeEntry) => {
    if (entry.date) return entry.date;
    if (entry.createdAt) return getLocalDateString(new Date(entry.createdAt));
    return getLocalDateString();
  };

  // Safe entries with guaranteed date
  const safeEntries = entries.map(entry => ({
    ...entry,
    date: getEntryDateSafely(entry)
  }));

  // Apply filters
  const filteredEntries = safeEntries.filter(entry => {
    if (filterMode === 'today') return entry.date === todayStr;
    if (filterMode === 'week') return entry.date >= mondayStr && entry.date <= sundayStr;
    if (filterMode === 'custom') return entry.date === filterDate;
    return true; // 'all'
  });

  // Calculate summary for currently filtered entries
  const filteredTotalMinutes = filteredEntries.reduce((sum, e) => sum + e.practiceTime, 0);
  const filteredRecordCount = filteredEntries.length;
  const filteredRoutineSuccess = filteredEntries.filter(e => e.routineGoalReached).length;
  
  // Calculate most frequent practice subject
  const subjectCounts = filteredEntries.reduce((acc, e) => {
    const type = e.practiceSubjectType || 'free';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  let topSubjectType = '';
  let maxCount = 0;
  for (const [type, count] of Object.entries(subjectCounts) as [string, number][]) {
    if (count > maxCount) {
      maxCount = count;
      topSubjectType = type;
    }
  }

  // Group filtered entries by date
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, PracticeEntry[]>);
  
  // Sort dates descending
  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 md:space-y-8 px-1 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif italic text-white tracking-tight flex items-center gap-3">
            <Activity className="text-brand shrink-0 animate-pulse" size={26} />
            <span>{t('practiceLog.title')}</span>
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-1">
            {monday.getMonth() + 1}월 {monday.getDate()}일 ~ {sunday.getMonth() + 1}월 {sunday.getDate()}일
          </p>
        </div>
      </div>

      {/* Focus Timer Section */}
      <div className="bg-stone-900 border border-white/[0.05] rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        {timer.session ? (
          <div className="flex flex-col items-center py-4 space-y-6">
            <div className="space-y-1 text-center">
              <span className="text-xs text-brand font-bold uppercase tracking-[0.2em]">{t('practiceLog.focusPractice')}</span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {timer.session.pieceTitle || timer.session.routineTitle || t('practiceLog.freePractice')}
              </h3>
              {timer.session.targetMinutes && (
                <p className="text-xs text-stone-400 font-sans">
                  {t('practiceLog.targetTime')}: {timer.session.targetMinutes} {t('practiceLog.minutes')}
                </p>
              )}
            </div>

            <div className="text-6xl md:text-7xl font-mono font-bold text-white tracking-tighter drop-shadow-lg">
              {String(Math.floor(timer.currentSeconds / 3600)).padStart(2, '0')}:
              {String(Math.floor((timer.currentSeconds % 3600) / 60)).padStart(2, '0')}:
              {String(timer.currentSeconds % 60).padStart(2, '0')}
            </div>

            {timer.session.status === 'paused' && timer.session.pauseReason && (
              <div className="text-xs font-bold text-amber-400 bg-amber-400/10 px-4 py-2 rounded-xl flex items-center gap-2 max-w-sm text-center">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {timer.session.pauseReason === 'app-hidden' || timer.session.pauseReason === 'window-blur'
                    ? t('practiceLog.pausedByAppLeave')
                    : timer.session.pauseReason === 'pagehide'
                    ? t('practiceLog.pausedByRefresh')
                    : t('practiceLog.pause')}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md pt-2">
              {timer.session.status === 'running' ? (
                <button
                  onClick={() => timer.pauseSession()}
                  className="flex-1 min-w-[120px] py-4 rounded-2xl font-bold text-sm border border-white/10 text-stone-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  {t('practiceLog.pause')}
                </button>
              ) : (
                <button
                  onClick={() => timer.resumeSession()}
                  className="flex-1 min-w-[120px] py-4 rounded-2xl font-bold text-sm bg-brand text-stone-950 shadow-lg shadow-brand/20 active:scale-95 transition-all"
                >
                  {t('practiceLog.resume')}
                </button>
              )}
              
              <button
                onClick={handleFinishTimer}
                className="flex-1 min-w-[120px] py-4 rounded-2xl font-bold text-sm bg-stone-100 text-stone-900 shadow-lg active:scale-95 transition-all"
              >
                {t('practiceLog.finish')}
              </button>

              <button
                onClick={handleCancelTimer}
                className="w-12 h-12 rounded-2xl border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-all shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-[10px] text-stone-500 text-center leading-tight">
              {t('practiceLog.timerNavNotice') || '앱 안에서 악보함, 메트로놈, 튜너를 사용하는 동안에는 시간이 계속 기록됩니다.'}<br/>
              {t('practiceLog.timerBackgroundNotice') || '앱을 벗어나면 연습 시간이 자동으로 일시정지됩니다.'}
            </p>

            {isAdminUser(user) && (
              <div className="w-full max-w-md mt-4 p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Activity size={16} />
                  <span className="text-xs font-bold tracking-wide">{t('admin.testTool') || '관리자 테스트 도구'}</span>
                  <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded-full ml-auto">{t('admin.timerAdjust') || '타이머 시간 조정'}</span>
                </div>
                <p className="text-[10px] text-indigo-300/70 leading-tight">
                  {t('admin.qaNotice') || 'QA용 기능입니다. 일반 사용자에게는 표시되지 않습니다.'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => timer.adminAdjustTimerSeconds(-60, user.email || 'admin')} className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-stone-300 transition-all">-1m</button>
                  <button onClick={() => timer.adminAdjustTimerSeconds(-30, user.email || 'admin')} className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-stone-300 transition-all">-30s</button>
                  <button onClick={() => timer.adminAdjustTimerSeconds(30, user.email || 'admin')} className="py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300 transition-all">+30s</button>
                  <button onClick={() => timer.adminAdjustTimerSeconds(60, user.email || 'admin')} className="py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300 transition-all">+1m</button>
                  <button onClick={() => timer.adminAdjustTimerSeconds(300, user.email || 'admin')} className="py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300 transition-all col-span-2">+5m</button>
                  <button onClick={() => timer.adminAdjustTimerSeconds(600, user.email || 'admin')} className="py-2 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300 transition-all col-span-2">+10m</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="admin-timer-input"
                    placeholder="초 (sec)"
                    className="flex-1 bg-stone-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const val = (document.getElementById('admin-timer-input') as HTMLInputElement)?.value;
                      if (val && !isNaN(Number(val))) {
                        timer.adminSetTimerSeconds(Number(val), user.email || 'admin');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {t('admin.set') || '설정'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left flex-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                <Clock className="text-brand" size={20} />
                <span>{t('practiceLog.focusPractice')}</span>
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed max-w-md mx-auto sm:mx-0">
                {t('practiceLog.onlyActiveTimeRecorded')}
              </p>
            </div>
            <button
              onClick={handleStartFreeTimer}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-brand hover:bg-brand-light text-stone-950 font-bold text-sm rounded-2xl shadow-lg shadow-brand/20 active:scale-95 transition-all"
            >
              <Activity size={18} strokeWidth={2.5} />
              <span>{t('practiceLog.freePractice')} {t('practiceLog.startPractice')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Weekly Practice Time Card */}
        <div className="bg-stone-900/40 border border-white/[0.03] rounded-3xl p-5 md:p-6 flex items-center justify-between shadow-xl relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-brand/5 blur-2xl rounded-full group-hover:scale-150 transition-all duration-700"></div>
          <div className="space-y-1.5 z-10">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
              {t('practiceLog.weeklyPracticeTime')}
            </span>
            <div className="text-2xl md:text-3xl font-bold font-sans text-brand tracking-tight">
              {formatDuration(weeklyTotalMinutes)}
            </div>
          </div>
          <div className="bg-brand/10 text-brand p-3 rounded-2xl z-10">
            <Clock size={20} />
          </div>
        </div>

        {/* Weekly Logs Count Card */}
        <div className="bg-stone-900/40 border border-white/[0.03] rounded-3xl p-5 md:p-6 flex items-center justify-between shadow-xl relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-brand/5 blur-2xl rounded-full group-hover:scale-150 transition-all duration-700"></div>
          <div className="space-y-1.5 z-10">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
              {t('practiceLog.weeklyRecordCount')}
            </span>
            <div className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight">
              {weeklyRecordCount} {t('admin.fileUnit')}
            </div>
          </div>
          <div className="bg-white/[0.03] text-stone-400 p-3 rounded-2xl z-10">
            <Trophy size={20} />
          </div>
        </div>

        {/* Today's Practice Time Card */}
        <div className="bg-stone-900/40 border border-white/[0.03] rounded-3xl p-5 md:p-6 flex items-center justify-between shadow-xl relative overflow-hidden group">
          <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-brand/5 blur-2xl rounded-full group-hover:scale-150 transition-all duration-700"></div>
          <div className="space-y-1.5 z-10">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
              {t('practiceLog.todayPracticeTime')}
            </span>
            <div className="text-2xl md:text-3xl font-bold font-sans text-emerald-400 tracking-tight">
              {formatDuration(todayTotalMinutes)}
            </div>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl z-10">
            <Smile size={20} />
          </div>
        </div>
      </div>

      {/* Practice Routines Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-semibold text-stone-400 tracking-wider uppercase font-sans">
            {t('practiceLog.myRoutines')}
          </h3>
          <button
            onClick={() => setIsAddingRoutine(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] text-stone-300 hover:text-white text-xs font-bold rounded-xl transition-all active:scale-95 border border-white/[0.05]"
          >
            <Plus size={14} />
            <span>{t('practiceLog.addRoutine')}</span>
          </button>
        </div>

        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 bg-stone-900/10 border border-white/[0.02] rounded-3xl text-center space-y-2">
            <div className="text-stone-600">
              <ListTodo size={24} />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-stone-400 font-medium">{t('practiceLog.routineEmpty')}</p>
              <p className="text-[11px] text-stone-600">{t('practiceLog.routineEmptySub')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {routines.map((routine) => {
              const isExpanded = expandedRoutineId === routine.id;
              return (
                <div
                  key={routine.id}
                  onClick={() => setExpandedRoutineId(isExpanded ? null : routine.id)}
                  className="bg-stone-900/30 hover:bg-stone-900/40 border border-white/[0.03] hover:border-white/[0.06] rounded-3xl p-5 transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                >
                  <div>
                    {/* Routine Header */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-stone-200 tracking-tight group-hover:text-white transition-colors line-clamp-1">
                            {routine.title}
                          </h4>
                          {routine.isFavorite && (
                            <Star size={12} className="fill-brand text-brand shrink-0" />
                          )}
                        </div>
                        {routine.description && (
                          <p className="text-xs text-stone-500 font-sans line-clamp-1">
                            {routine.description}
                          </p>
                        )}
                      </div>

                      {/* Expected Time Badge */}
                      <span className="flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2.5 py-0.5 rounded-full font-sans font-bold shrink-0">
                        <Clock size={11} />
                        <span>{routine.totalMinutes} {t('practiceLog.minutes')}</span>
                      </span>
                    </div>

                    {/* Routine Items List (Collapsible) */}
                    <AnimatePresence>
                      {isExpanded ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden mt-4 pt-3 border-t border-white/[0.03] space-y-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {routine.items.map((item, idx) => (
                            <div key={item.id} className="flex items-start gap-2.5 text-xs">
                              <span className="w-5 h-5 rounded-full bg-stone-950 border border-white/[0.03] flex items-center justify-center text-[10px] text-stone-500 shrink-0 font-bold mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-stone-300 font-medium truncate">{item.label}</span>
                                  <span className="text-stone-500 font-mono shrink-0">{item.minutes}m</span>
                                </div>
                                {item.memo && (
                                  <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1 italic font-sans">{item.memo}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      ) : (
                        /* Preview of items (1 line comma separated) */
                        <p className="text-xs text-stone-500 truncate mt-2 font-sans">
                          {routine.items.map(item => item.label).join(', ')}
                        </p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Routine Actions */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/[0.02] text-[10px] text-stone-600">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTimerFromRoutine(routine);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-brand text-stone-950 hover:bg-brand-light font-bold rounded-xl transition-all active:scale-95"
                      >
                        <Activity size={11} strokeWidth={3} />
                        <span>{t('practiceLog.startPractice')}</span>
                      </button>
                    </div>

                    <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleToggleFavoriteRoutine(routine, e)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-stone-400 hover:text-brand transition-colors"
                      >
                        <Star size={12} className={routine.isFavorite ? "fill-brand text-brand" : ""} />
                      </button>
                      <button
                        onClick={(e) => handleOpenEditRoutine(routine, e)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-stone-400 hover:text-white transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteRoutine(routine.id, e)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-stone-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practice Log List */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-stone-400 tracking-wider uppercase font-sans">
            {t('practiceLog.dateViewTitle') || '날짜별 연습 기록'}
          </h3>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'all' 
                  ? 'bg-brand text-stone-900' 
                  : 'bg-stone-900 border border-white/5 text-stone-400 hover:text-stone-200'
              }`}
            >
              {t('practiceLog.filterAll') || '전체'}
            </button>
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'today' 
                  ? 'bg-brand text-stone-900' 
                  : 'bg-stone-900 border border-white/5 text-stone-400 hover:text-stone-200'
              }`}
            >
              {t('practiceLog.filterToday') || '오늘'}
            </button>
            <button
              onClick={() => setFilterMode('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'week' 
                  ? 'bg-brand text-stone-900' 
                  : 'bg-stone-900 border border-white/5 text-stone-400 hover:text-stone-200'
              }`}
            >
              {t('practiceLog.filterWeek') || '이번 주'}
            </button>
            
            <div className="relative flex items-center">
              <input
                type="date"
                value={filterMode === 'custom' ? filterDate : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFilterDate(e.target.value);
                    setFilterMode('custom');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none bg-stone-900 border border-white/5 ${
                  filterMode === 'custom' ? 'text-brand border-brand/30' : 'text-stone-400 hover:text-stone-200'
                }`}
                title={t('practiceLog.filterDateSelect') || '날짜 선택'}
              />
            </div>
          </div>
        </div>

        {/* Summary Card */}
        {entries.length > 0 && filterMode !== 'all' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand/5 border border-brand/10 rounded-3xl p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1 font-sans">
                {filterMode === 'today' ? (t('practiceLog.summaryToday') || '오늘의 연습') : 
                 filterMode === 'week' ? (t('practiceLog.summaryWeek') || '이번 주 연습') : 
                 (t('practiceLog.summarySelected') || '선택한 기간')}
              </p>
              <p className="text-xl font-bold text-white tracking-tight">{formatDuration(filteredTotalMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1 font-sans">{t('practiceLog.summaryCount') || '기록 수'}</p>
              <p className="text-xl font-bold text-white tracking-tight">{filteredRecordCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1 font-sans">{t('practiceLog.summaryRoutineSuccess') || '루틴 성공'}</p>
              <p className="text-xl font-bold text-brand tracking-tight">{filteredRoutineSuccess}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1 font-sans line-clamp-1">{t('practiceLog.summaryTopType') || '가장 많이 한 연습 유형'}</p>
              <p className="text-sm font-bold text-stone-300 tracking-tight line-clamp-1 mt-1">
                {topSubjectType ? (t(`practiceLog.subjectType${topSubjectType.charAt(0).toUpperCase() + topSubjectType.slice(1)}` as any) || topSubjectType) : '-'}
              </p>
            </div>
          </motion.div>
        )}

        {filteredEntries.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-4 bg-stone-900/20 border border-white/[0.02] rounded-3xl text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-stone-500">
              <Calendar size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-stone-400 font-medium">{t('practiceLog.emptyDate') || '이 날짜에는 아직 연습 기록이 없습니다.'}</p>
              <p className="text-xs text-stone-600">{t('practiceLog.emptyDateSub') || '연습 시작을 눌러 오늘의 연습을 기록해보세요.'}</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map((dateKey) => {
              const dayEntries = groupedEntries[dateKey];
              const dayTotalMinutes = dayEntries.reduce((sum, e) => sum + e.practiceTime, 0);
              const dayRoutineSuccess = dayEntries.filter(e => e.routineGoalReached).length;
              
              return (
                <div key={dateKey} className="space-y-4">
                  <div className="flex items-end justify-between border-b border-white/[0.05] pb-2 px-1">
                    <h4 className="text-lg font-bold text-stone-200 flex items-center gap-2">
                      <Calendar size={16} className="text-stone-500" />
                      {formatEntryDate(dateKey)}
                    </h4>
                    <div className="flex items-center gap-3 text-xs font-sans">
                      <span className="text-stone-400 font-medium">총 {formatDuration(dayTotalMinutes)}</span>
                      <span className="text-stone-600">•</span>
                      <span className="text-stone-400 font-medium">기록 {dayEntries.length}개</span>
                      {dayRoutineSuccess > 0 && (
                        <>
                          <span className="text-stone-600">•</span>
                          <span className="text-brand font-bold">루틴 성공 {dayRoutineSuccess}개</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dayEntries.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.3) }}
                        onClick={() => handleOpenEdit(entry)}
                        className="bg-stone-900/30 hover:bg-stone-900/50 border border-white/[0.03] hover:border-white/[0.08] rounded-3xl p-5 md:p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div className="space-y-4 z-10">
                          {/* Top line with duration and mood */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {entry.mood === 'good' && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-sans font-bold">
                                  <Smile size={11} />
                                  <span>{t('practiceLog.moodGood')}</span>
                                </span>
                              )}
                              {entry.mood === 'normal' && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-sans font-bold">
                                  <Meh size={11} />
                                  <span>{t('practiceLog.moodNormal')}</span>
                                </span>
                              )}
                              {entry.mood === 'hard' && (
                                <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-sans font-bold">
                                  <Frown size={11} />
                                  <span>{t('practiceLog.moodHard')}</span>
                                </span>
                              )}
                              {entry.measuredByTimer && (
                                <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-sans font-bold">
                                  <Activity size={11} />
                                  <span>타이머 측정됨</span>
                                </span>
                              )}
                              {entry.routineGoalReached && (
                                <span className="flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-full font-sans font-bold">
                                  <Star size={11} />
                                  <span>루틴 성공</span>
                                </span>
                              )}
                            </div>
        
                            <span className="flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2.5 py-0.5 rounded-full font-sans font-bold">
                              <Clock size={11} />
                              <span>{entry.practiceTime} {t('practiceLog.minutes')}</span>
                            </span>
                          </div>
        
                          {/* Title */}
                          <div className="space-y-1">
                            <h4 className="text-base font-bold text-stone-200 group-hover:text-white transition-colors tracking-tight line-clamp-1 flex items-center gap-2">
                              {entry.practiceSubjectType && entry.practiceSubjectType !== 'piece' && (
                                <span className="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-sans shrink-0">
                                  {t(`practiceLog.subjectType${entry.practiceSubjectType.charAt(0).toUpperCase() + entry.practiceSubjectType.slice(1)}` as any) || entry.practiceSubjectType}
                                </span>
                              )}
                              <span>{entry.pieceTitle}</span>
                            </h4>
                          </div>
        
                          {/* Goal and Focus area snippet */}
                          {(entry.goal || entry.focusArea) && (
                            <div className="bg-white/[0.01] border border-white/[0.03] rounded-2xl p-3 space-y-1.5 text-xs text-stone-400 font-sans">
                              {entry.goal && (
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-[10px] uppercase tracking-wider text-brand font-bold shrink-0 mt-0.5">G</span>
                                  <span className="line-clamp-1 leading-relaxed">{entry.goal}</span>
                                </div>
                              )}
                              {entry.focusArea && (
                                <div className="flex gap-1.5 items-start">
                                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold shrink-0 mt-0.5">F</span>
                                  <span className="line-clamp-1 leading-relaxed">{entry.focusArea}</span>
                                </div>
                              )}
                            </div>
                          )}
        
                          {/* Memo snippet */}
                          {entry.memo && (
                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed italic font-sans border-l-2 border-stone-800 pl-2">
                              {entry.memo}
                            </p>
                          )}
                        </div>
        
                        <div className="flex justify-between mt-4 pt-3 border-t border-white/[0.02] items-center">
                          <div className="flex items-center">
                            {(entry.shareVisibility === 'shareCard' || entry.shareVisibility === 'groupReady') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSharingEntry(entry);
                                }}
                                className="px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                              >
                                <Activity size={12} />
                                <span>{t('practiceLog.share') || '공유'}</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-stone-600 group-hover:text-stone-400 font-medium transition-colors">
                            <span>{t('common.edit')}</span>
                            <ChevronRight size={10} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Overlay Modal */}
      <AnimatePresence>
        {(isAdding || !!editingEntry) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#12100E] border border-white/[0.08] w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl relative z-10 max-h-[90vh] flex flex-col"
            >
              {/* Cancel Confirm Overlay */}
              <AnimatePresence>
                {showCancelConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-[#12100E]/95 backdrop-blur-md flex items-center justify-center p-8"
                  >
                    <div className="text-center space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold text-stone-200">
                          {t('practiceLog.saveConfirmDesc') || '저장하지 않고 닫을까요?'}
                        </h3>
                        <p className="text-sm text-stone-400 leading-relaxed font-sans whitespace-pre-line">
                          {t('practiceLog.saveConfirmSub') || '아직 저장되지 않은 연습 기록입니다.\n취소하면 이 연습 기록은 저장되지 않습니다.'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={forceCloseModal}
                          className="px-6 py-3.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 font-bold text-sm rounded-2xl transition-all"
                        >
                          {t('practiceLog.saveConfirmYes') || '저장하지 않고 닫기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-stone-300 font-bold text-sm rounded-2xl transition-all"
                        >
                          {t('practiceLog.saveConfirmNo') || '계속 작성'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-white/[0.05] shrink-0">
                <h3 className="text-lg font-bold text-white tracking-tight font-sans">
                  {editingEntry ? t('practiceLog.editRecord') : t('practiceLog.addRecord')}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSubmit} className="overflow-y-auto flex-grow p-6 space-y-5 custom-scrollbar">
                {errorMsg && (
                  <div className="bg-red-950/20 border border-red-800/30 rounded-2xl p-4 flex gap-2.5 items-start text-red-400 text-xs font-sans">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Date & Practice Time Rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.date')} *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans"
                    />
                  </div>

                  {/* Practice Time Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans flex justify-between">
                      <span>{t('practiceLog.practiceTime')} *</span>
                      <span className="text-brand lowercase">({practiceTime}m)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        required
                        min="1"
                        max="1440"
                        value={practiceTime}
                        onChange={(e) => setPracticeTime(Math.max(1, Number(e.target.value)))}
                        disabled={!isAdminUser(user)}
                        className={`w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm focus:outline-none transition-all font-sans ${
                          !isAdminUser(user) 
                            ? 'opacity-50 cursor-not-allowed bg-stone-900/50' 
                            : 'focus:ring-2 focus:ring-brand/30'
                        }`}
                      />
                      {/* Increments buttons for touch/mobile visual flair */}
                      {isAdminUser(user) && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPracticeTime(prev => Math.max(5, prev - 10))}
                            className="px-2.5 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-xl text-stone-400 hover:text-white text-xs transition-colors font-bold font-sans shrink-0"
                          >
                            -10
                          </button>
                          <button
                            type="button"
                            onClick={() => setPracticeTime(prev => prev + 10)}
                            className="px-2.5 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-xl text-stone-400 hover:text-white text-xs transition-colors font-bold font-sans shrink-0"
                          >
                            +10
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Trust Notices */}
                    <div className="pt-1 space-y-1">
                      {!isAdminUser(user) && (
                        <p className="text-xs text-amber-500/80 font-medium font-sans flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          {t('practiceLog.timeEditLocked') || '연습 시간은 기록 신뢰도를 위해 수정할 수 없습니다.'}
                        </p>
                      )}
                      {Boolean(editingEntry) && isAdminUser(user) && (
                        <p className="text-xs text-brand font-medium font-sans flex items-center gap-1.5">
                          <Activity size={12} />
                          {t('admin.timeEditAllowed') || '관리자 QA용 시간 수정'}
                        </p>
                      )}
                      {measuredByTimer ? (
                        <p className="text-[11px] text-emerald-400/70 font-sans flex items-center gap-1">
                          <Clock size={10} />
                          {t('practiceLog.measuredByTimer') || '집중 연습 타이머로 측정된 시간입니다.'}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-500 font-sans flex items-center gap-1">
                          <Edit2 size={10} />
                          {t('practiceLog.manualRecord') || '수동으로 작성한 기록입니다.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Practice Subject Area */}
                <div className="space-y-4 bg-white/[0.01] border border-white/[0.02] p-4 rounded-3xl">
                  {/* Subject Type */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.practiceSubjectType') || '연습 유형'} *
                    </label>
                    <div className="relative">
                      <select
                        value={practiceSubjectType}
                        onChange={(e) => setPracticeSubjectType(e.target.value as PracticeSubjectType)}
                        className="w-full bg-stone-950 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans appearance-none"
                      >
                        {!['piece', 'fundamentalsTechnique', 'ensembleOrchestra', 'free'].includes(practiceSubjectType) && (
                          <option value={practiceSubjectType}>
                            {t(`practiceLog.subjectType${practiceSubjectType.charAt(0).toUpperCase() + practiceSubjectType.slice(1)}` as any) || practiceSubjectType}
                          </option>
                        )}
                        <option value="piece">{t('practiceLog.subjectTypePiece') || '곡 연습'}</option>
                        <option value="fundamentalsTechnique">{t('practiceLog.subjectTypeFundamentalsTechnique') || '기본기 / 테크닉'}</option>
                        <option value="ensembleOrchestra">{t('practiceLog.subjectTypeEnsembleOrchestra') || '합주 / 오케스트라'}</option>
                        <option value="free">{t('practiceLog.subjectTypeFree') || '자유 연습'}</option>
                      </select>
                      <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none rotate-90" />
                    </div>
                  </div>

                  {/* Piece Title (Subject Name) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.practiceSubjectName') || '연습 대상 이름'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('practiceLog.practiceSubjectPlaceholder') || '예: Dvořák Cello Concerto 3악장, C major scale'}
                      value={pieceTitle}
                      onChange={(e) => setPieceTitle(e.target.value)}
                      className="w-full bg-stone-950 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Mood/Condition selection with smiley buttons */}
                <div className="space-y-2">
                  <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                    {t('practiceLog.mood')}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setMood('good')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${
                        mood === 'good'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                          : 'bg-stone-900/60 border-white/5 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      <Smile size={16} />
                      <span className="text-xs">{t('practiceLog.moodGood')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMood('normal')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${
                        mood === 'normal'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold'
                          : 'bg-stone-900/60 border-white/5 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      <Meh size={16} />
                      <span className="text-xs">{t('practiceLog.moodNormal')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMood('hard')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${
                        mood === 'hard'
                          ? 'bg-red-500/10 border-red-500/40 text-red-400 font-bold'
                          : 'bg-stone-900/60 border-white/5 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      <Frown size={16} />
                      <span className="text-xs">{t('practiceLog.moodHard')}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-4 bg-stone-900 border border-white/5 rounded-2xl text-sm font-bold text-stone-300 hover:text-white transition-colors"
                >
                  <span>상세 기록 (선택)</span>
                  <span className="text-stone-500 text-xs">{showAdvanced ? '접기' : '열기'}</span>
                </button>

                {showAdvanced && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Goal / Focus Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Today Goal */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.goal')} (선택)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 템포 80까지 올리기"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all resize-none font-sans"
                    />
                  </div>

                  {/* Focus Area */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.focusArea')} (선택)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 활 쓰기 밀착도 및 셋잇단음표"
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all resize-none font-sans"
                    />
                  </div>
                </div>

                {/* Positives / Negatives */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* What went well */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.whatWentWell')} (선택)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 레가토 연결이 한결 부드러워짐"
                      value={whatWentWell}
                      onChange={(e) => setWhatWentWell(e.target.value)}
                      className="w-full bg-stone-900 border border-emerald-500/10 focus:border-emerald-500/30 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none font-sans"
                    />
                  </div>

                  {/* Problem / Hard block */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-red-400 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.problem')} (선택)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 16분음표 도약 부분 음정이 불안정함"
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      className="w-full bg-stone-900 border border-red-500/10 focus:border-red-500/30 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all resize-none font-sans"
                    />
                  </div>
                </div>

                {/* Next Action */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                    {t('practiceLog.nextAction')} (선택)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 내일은 도약 마디 5번 반복 후 메트로놈 연습"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans"
                  />
                </div>

                {/* Memo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                    {t('practiceLog.memo')} (선택)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. 다른 아이디어나 생각들 자유롭게 기재..."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all resize-none font-sans"
                  />
                </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowShareSettings(!showShareSettings)}
                  className="w-full flex items-center justify-between p-4 bg-stone-900 border border-white/5 rounded-2xl text-sm font-bold text-stone-300 hover:text-white transition-colors"
                >
                  <span>{t('practiceLog.shareSettings') || '공유 설정'}</span>
                  <span className="text-stone-500 text-xs">{showShareSettings ? '접기' : '열기'}</span>
                </button>

                {showShareSettings && (
                  <div className="space-y-4 pt-4 border-t border-white/[0.05] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.shareSettings') || '공유 설정'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setShareVisibility('private')}
                        className={`p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 ${
                          shareVisibility === 'private'
                            ? 'bg-brand/10 border-brand/40 text-brand'
                            : 'bg-stone-900 border-white/5 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <span className="font-bold text-xs">{t('practiceLog.visibilityPrivate') || '비공개'}</span>
                        <span className="text-[10px] opacity-80 leading-tight font-sans">{t('practiceLog.visibilityDescPrivate') || '나만 보는 기록입니다.'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareVisibility('shareCard')}
                        className={`p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 ${
                          shareVisibility === 'shareCard'
                            ? 'bg-brand/10 border-brand/40 text-brand'
                            : 'bg-stone-900 border-white/5 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <span className="font-bold text-xs">{t('practiceLog.visibilityShareCard') || '공유 카드'}</span>
                        <span className="text-[10px] opacity-80 leading-tight font-sans">{t('practiceLog.visibilityDescShareCard') || '이 기록을 공유용 요약 카드로 만들 수 있습니다.'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareVisibility('groupReady')}
                        className={`p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 ${
                          shareVisibility === 'groupReady'
                            ? 'bg-brand/10 border-brand/40 text-brand'
                            : 'bg-stone-900 border-white/5 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <span className="font-bold text-xs">{t('practiceLog.visibilityGroupReady') || '그룹 공유 준비'}</span>
                        <span className="text-[10px] opacity-80 leading-tight font-sans">{t('practiceLog.visibilityDescGroupReady') || '나중에 연습방 기능이 추가되면 그룹에 공유할 수 있도록 준비합니다.'}</span>
                      </button>
                    </div>
                  </div>

                  {shareVisibility !== 'private' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      className="space-y-4 bg-stone-900/50 p-4 rounded-3xl border border-white/5"
                    >
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                          {t('practiceLog.publicMemo') || '공개 메모'} (선택)
                        </label>
                        <textarea
                          rows={2}
                          value={publicMemo}
                          onChange={(e) => setPublicMemo(e.target.value)}
                          placeholder="공유 카드에 노출될 메모입니다. 개인 메모와 분리해서 작성하세요."
                          className="w-full bg-stone-950 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all resize-none font-sans"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                          {t('practiceLog.shareItems') || '공유 항목'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { state: shareIncludePiece, setter: setShareIncludePiece, label: t('practiceLog.shareIncludeSubject') || '연습 대상 포함' },
                            { state: shareIncludeGoal, setter: setShareIncludeGoal, label: t('practiceLog.includeGoal') || '오늘 목표 포함' },
                            { state: shareIncludeFocusArea, setter: setShareIncludeFocusArea, label: t('practiceLog.includeFocusArea') || '집중한 부분 포함' },
                            { state: shareIncludeNextAction, setter: setShareIncludeNextAction, label: t('practiceLog.includeNextAction') || '다음에 할 것 포함' },
                            { state: shareIncludeMood, setter: setShareIncludeMood, label: t('practiceLog.includeMood') || '컨디션 포함' },
                            { state: shareIncludeRoutine, setter: setShareIncludeRoutine, label: t('practiceLog.includeRoutine') || '루틴 이름 포함' },
                            { state: shareIncludeTimer, setter: setShareIncludeTimer, label: t('practiceLog.includeTimer') || '타이머 측정 표시 포함' },
                          ].map((item, idx) => (
                            <label key={idx} className="flex items-center gap-1.5 bg-stone-950 px-3 py-2 rounded-lg border border-white/[0.03] cursor-pointer hover:bg-white/[0.02]">
                              <input
                                type="checkbox"
                                checked={item.state}
                                onChange={(e) => item.setter(e.target.checked)}
                                className="accent-brand"
                              />
                              <span className="text-[10px] text-stone-400 font-bold">{item.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-stone-600 font-sans mt-2">
                          * {t('practiceLog.shareNotice') || '공유 카드에는 선택한 항목만 표시됩니다. 개인 메모는 포함되지 않습니다.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                  </div>
                )}
              </form>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/[0.05] bg-stone-950 flex flex-col-reverse sm:flex-row justify-between gap-3 shrink-0">
                {/* Delete button if editing */}
                {editingEntry ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEntry.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-red-950/20 hover:bg-red-950/40 border border-red-900/35 text-red-400 font-bold text-xs rounded-2xl active:scale-95 transition-all"
                  >
                    <Trash2 size={14} />
                    <span>{t('practiceLog.delete')}</span>
                  </button>
                ) : (
                  <div className="hidden sm:block" />
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-stone-300 font-semibold text-xs rounded-2xl active:scale-95 transition-all"
                  >
                    {t('practiceLog.cancel')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1.5 px-6 py-3 bg-brand hover:bg-brand-light text-stone-950 font-bold text-xs rounded-2xl active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? (
                      <span className="w-4.5 h-4.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin shrink-0"></span>
                    ) : (
                      <Save size={14} strokeWidth={2.5} />
                    )}
                    <span>{t('practiceLog.save')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Routine Add/Edit Modal */}
      <PracticeRoutineModal
        isOpen={isAddingRoutine || !!editingRoutine}
        onClose={() => {
          setIsAddingRoutine(false);
          setEditingRoutine(null);
        }}
        user={user}
        editingRoutine={editingRoutine}
      />

      {/* Share Preview Modal */}
      <AnimatePresence>
        {sharingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingEntry(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#12100E] border border-white/[0.08] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-white/[0.05] shrink-0">
                <h3 className="text-lg font-bold text-white tracking-tight font-sans">
                  {t('practiceLog.sharePreview') || '공유 미리보기'}
                </h3>
                <button
                  onClick={() => setSharingEntry(null)}
                  className="p-1.5 rounded-xl hover:bg-white/5 text-stone-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 bg-stone-900 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-300 border border-white/5 p-4 rounded-2xl bg-stone-950/50">
                  {generateShareText(sharingEntry)}
                </pre>
                
                <p className="text-[10px] text-stone-500 mt-4 leading-tight">
                  {t('practiceLog.shareNotice') || '공유 카드에는 선택한 항목만 표시됩니다. 개인 메모는 포함되지 않습니다.'}
                </p>
              </div>
              
              <div className="p-6 border-t border-white/[0.05] flex flex-col gap-3 shrink-0">
                <button
                  onClick={() => {
                    handleShare(sharingEntry);
                    setSharingEntry(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand text-stone-950 font-bold rounded-2xl hover:bg-brand-light transition-all active:scale-95"
                >
                  <Activity size={16} strokeWidth={2.5} />
                  <span>{t('practiceLog.doShare') || '공유하기'}</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyText(sharingEntry);
                    setSharingEntry(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/[0.05] text-stone-300 font-bold rounded-2xl hover:bg-white/[0.08] transition-all active:scale-95 border border-white/[0.02]"
                >
                  <span>{t('practiceLog.copyText') || '텍스트 복사'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
