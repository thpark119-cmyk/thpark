import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Calendar, Clock, BookOpen, Music, Trash2, Edit2, 
  AlertTriangle, Smile, Meh, Frown, Save, X, Activity, 
  Trophy, BookOpen as BookIcon, ChevronRight, Star, ListTodo
} from 'lucide-react';
import { PracticeEntry, PracticeRoutine, PracticeRoutineItem } from '../types';
import { subscribeToCollection, addRecord, updateRecord, deleteRecord } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePracticeTimer } from '../hooks/usePracticeTimer';
import PracticeRoutineModal from './PracticeRoutineModal';

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
  
  // Form fields
  const [date, setDate] = useState(getLocalDateString());
  const [practiceTime, setPracticeTime] = useState<number>(30);
  const [pieceTitle, setPieceTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [goal, setGoal] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [problem, setProblem] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [memo, setMemo] = useState('');
  const [mood, setMood] = useState<'good' | 'normal' | 'hard'>('normal');
  
  // UI States
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock scroll when modal is open
  useBodyScrollLock(isAdding || !!editingEntry || isAddingRoutine || !!editingRoutine);

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
    setPieceTitle('');
    setComposer('');
    setGoal('');
    setFocusArea('');
    setWhatWentWell('');
    setProblem('');
    setNextAction('');
    setMemo('');
    setMood('normal');
    setErrorMsg('');
    setIsAdding(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (entry: PracticeEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setPracticeTime(entry.practiceTime);
    setPieceTitle(entry.pieceTitle);
    setComposer(entry.composer || '');
    setGoal(entry.goal || '');
    setFocusArea(entry.focusArea || '');
    setWhatWentWell(entry.whatWentWell || '');
    setProblem(entry.problem || '');
    setNextAction(entry.nextAction || '');
    setMemo(entry.memo || '');
    setMood(entry.mood || 'normal');
    setErrorMsg('');
  };

  const handleCloseModal = () => {
    setIsAdding(false);
    setEditingEntry(null);
    setErrorMsg('');
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

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const recordId = editingEntry ? editingEntry.id : crypto.randomUUID();
      const record: PracticeEntry = {
        id: recordId,
        userId: user?.uid || 'local',
        date,
        practiceTime: Number(practiceTime),
        pieceTitle: pieceTitle.trim(),
        composer: composer.trim() || undefined,
        goal: goal.trim() || undefined,
        focusArea: focusArea.trim() || undefined,
        whatWentWell: whatWentWell.trim() || undefined,
        problem: problem.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        memo: memo.trim() || undefined,
        mood,
        createdAt: editingEntry?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (editingEntry) {
        await updateRecord('practice_entries', record.id, record, user);
      } else {
        await addRecord('practice_entries', record, user);
      }

      handleCloseModal();
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
      handleCloseModal();
    } catch (err) {
      console.error('Error deleting practice log:', err);
      alert(t('practiceLog.deleteFailed') || '삭제에 실패했습니다.');
    }
  };

  // --- Routine Helper Actions ---
  const handleStartFromRoutine = (routine: PracticeRoutine) => {
    setDate(getLocalDateString());
    setPracticeTime(routine.totalMinutes);
    setPieceTitle(routine.title);
    setComposer('');
    
    // Format goal with items
    const goalText = routine.items.map(item => `${item.label} (${item.minutes}m)`).join(' | ');
    setGoal(goalText);
    
    // Format memo with routine desc and item memos
    const memoParts = routine.items
      .filter(item => item.memo)
      .map(item => `- ${item.label}: ${item.memo}`)
      .join('\n');
    
    const initialMemo = routine.description 
      ? `${routine.description}${memoParts ? '\n\n' + memoParts : ''}`
      : memoParts;
    
    setMemo(initialMemo);
    setFocusArea('');
    setWhatWentWell('');
    setProblem('');
    setNextAction('');
    setMood('normal');
    setErrorMsg('');
    setIsAdding(true);
  };

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

  const handleFinishTimer = () => {
    if (!window.confirm(t('practiceLog.confirmFinish') || '연습을 종료하고 기록으로 저장할까요?')) {
      return;
    }
    
    const finalSeconds = timer.finishSession();
    
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
    
    timer.clearSession();
    setIsAdding(true);
  };

  const handleCancelTimer = () => {
    if (window.confirm(t('practiceLog.exitWithoutSaving') || '저장하지 않고 종료할까요?')) {
      timer.clearSession();
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
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-2xl shadow-lg active:scale-95 transition-all w-full sm:w-auto justify-center"
        >
          <Plus size={16} strokeWidth={3} />
          <span>{t('practiceLog.addRecord')}</span>
        </button>
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
            
            <p className="text-[10px] text-stone-500 text-center">
              {t('practiceLog.onlyActiveTimeRecorded')}
            </p>
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
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartFromRoutine(routine);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-800 text-stone-300 hover:bg-stone-700 font-bold rounded-xl transition-all active:scale-95"
                      >
                        <Plus size={11} strokeWidth={3} />
                        <span>{t('practiceLog.startFromRoutineToday')}</span>
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
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-stone-400 tracking-wider uppercase font-sans">
          {t('practiceLog.practiceLog')}
        </h3>

        {entries.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-4 bg-stone-900/20 border border-white/[0.02] rounded-3xl text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-stone-500">
              <Music size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-stone-400 font-medium">{t('practiceLog.empty')}</p>
              <p className="text-xs text-stone-600">{t('practiceLog.emptySub')}</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                onClick={() => handleOpenEdit(entry)}
                className="bg-stone-900/30 hover:bg-stone-900/50 border border-white/[0.03] hover:border-white/[0.08] rounded-3xl p-5 md:p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="space-y-4 z-10">
                  {/* Top line with date, duration and mood */}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                      <Calendar size={12} className="shrink-0" />
                      <span>{formatEntryDate(entry.date)}</span>
                    </span>

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

                      <span className="flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2.5 py-0.5 rounded-full font-sans font-bold">
                        <Clock size={11} />
                        <span>{entry.practiceTime} {t('practiceLog.minutes')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Title / Composer */}
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-stone-200 group-hover:text-white transition-colors tracking-tight line-clamp-1">
                      {entry.pieceTitle}
                    </h4>
                    {entry.composer && (
                      <p className="text-xs text-stone-500 font-sans line-clamp-1">
                        {entry.composer}
                      </p>
                    )}
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

                <div className="flex justify-end mt-4 pt-3 border-t border-white/[0.02] text-[10px] text-stone-600 group-hover:text-stone-400 font-medium transition-colors items-center gap-1">
                  <span>{t('common.edit')}</span>
                  <ChevronRight size={10} />
                </div>
              </motion.div>
            ))}
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
                        className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans"
                      />
                      {/* Increments buttons for touch/mobile visual flair */}
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
                    </div>
                  </div>
                </div>

                {/* Piece Title & Composer */}
                <div className="space-y-4 bg-white/[0.01] border border-white/[0.02] p-4 rounded-3xl">
                  {/* Piece Title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.pieceTitle')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 바흐 무반주 첼로 모음곡 1번 프렐류드"
                      value={pieceTitle}
                      onChange={(e) => setPieceTitle(e.target.value)}
                      className="w-full bg-stone-950 border border-white/5 rounded-xl px-4 py-3 text-stone-200 text-sm placeholder:text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-sans"
                    />
                  </div>

                  {/* Composer */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">
                      {t('practiceLog.composer')} (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. J.S. Bach"
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
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
    </div>
  );
}
