import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { Play, Pause, Square, Activity, ChevronRight, Minimize2, GripVertical } from 'lucide-react';
import { usePracticeTimer } from '../context/PracticeTimerContext';
import { useLanguage } from '../context/LanguageContext';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface MiniTimerProps {
  onNavigateToPractice: () => void;
  isPracticeTab?: boolean;
}

export function MiniTimer({ onNavigateToPractice, isPracticeTab }: MiniTimerProps) {
  const { session, currentSeconds, pauseSession, resumeSession, finishSession } = usePracticeTimer();
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [visibility, setVisibility] = useState<'expanded' | 'collapsed'>(() => {
    return (localStorage.getItem('local_mini_practice_timer_visibility') as 'expanded' | 'collapsed') || 'expanded';
  });

  useEffect(() => {
    localStorage.setItem('local_mini_practice_timer_visibility', visibility);
  }, [visibility]);

  if (!session || session.status === 'finished') {
    return null;
  }

  // Do not show anything if we are on the practice tab
  if (isPracticeTab) {
    return null;
  }

  const isRunning = session.status === 'running';
  
  const label = session.sourceType === 'routine'
    ? (session.routineTitle || t('practiceLog.routinePracticeing') || '루틴 연습 중')
    : ((session.pieceTitle && session.pieceTitle !== t('practiceLog.freePractice') && session.pieceTitle !== '자유 연습')
        ? session.pieceTitle
        : (t('practiceLog.practicing') || '연습 중'));

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const confirmStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    finishSession();
    setShowConfirm(false);
    onNavigateToPractice();
  };

  const cancelStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 80 || info.offset.y > 80 || info.offset.x < -80 || info.offset.y < -80) {
      setVisibility('collapsed');
    }
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibility(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
  };

  return (
    <div className="fixed bottom-[80px] md:bottom-auto md:top-24 right-4 md:right-8 z-50 pointer-events-none flex flex-col items-end">
      <AnimatePresence mode="wait">
        {visibility === 'collapsed' ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVisibility}
            title={t('practiceLog.showTimer') || '타이머 다시 보기'}
            className="pointer-events-auto bg-[#1a1816] border border-brand/20 shadow-2xl shadow-brand/10 px-4 py-3 rounded-full flex items-center gap-2 cursor-pointer"
          >
            <Activity size={14} className={isRunning ? 'text-brand animate-pulse' : 'text-stone-500'} />
            <span className="text-sm font-mono font-bold text-white tracking-tight">
              {formatDuration(currentSeconds)}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto bg-[#1a1816] border border-brand/20 shadow-2xl shadow-brand/10 p-3 rounded-2xl flex items-center gap-2 w-[calc(100vw-32px)] md:w-auto max-w-sm relative overflow-hidden"
            onClick={onNavigateToPractice}
          >
            {/* Drag Handle Area */}
            <div 
              className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/40 transition-colors p-1"
              title={t('practiceLog.dragToHide') || '드래그해서 숨기기'}
            >
               <GripVertical size={16} />
            </div>

            <div className="flex items-center gap-4 w-full flex-grow">
              {showConfirm ? (
                <div className="flex flex-col gap-2 w-full py-1">
                  <span className="text-[11px] font-bold text-stone-300 font-sans text-center">
                    {t('practiceLog.confirmStopTimer') || '연습을 종료하고 기록으로 저장할까요?'}
                  </span>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={cancelStop}
                      className="flex-1 py-1.5 bg-stone-800 text-stone-300 rounded-lg text-[10px] font-bold hover:bg-stone-700 transition-colors"
                    >
                      {t('common.cancel') || '취소'}
                    </button>
                    <button
                      onClick={confirmStop}
                      className="flex-1 py-1.5 bg-brand text-stone-950 rounded-lg text-[10px] font-bold hover:bg-brand-light transition-colors"
                    >
                      {t('common.confirm') || '종료하기'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col shrink-0">
                    <div className="flex items-center gap-1.5 text-brand mb-1">
                      <Activity size={12} className={isRunning ? 'animate-pulse' : ''} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t('practiceLog.focusPracticeOn') || '집중 연습 중'}</span>
                    </div>
                    <div className="text-xl font-mono text-white font-medium tracking-tight">
                      {formatDuration(currentSeconds)}
                    </div>
                  </div>
                  
                  <div className="flex-grow flex flex-col justify-center min-w-0 pr-2 border-r border-white/5">
                    <span className="text-xs font-bold text-stone-200 truncate">{label}</span>
                    {session.routineGoalReached ? (
                      <span className="text-[10px] text-emerald-400 font-bold font-sans truncate flex items-center gap-1 mt-0.5">
                        루틴 목표 달성! 🎉
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-500 font-sans truncate flex items-center gap-1 mt-0.5 group cursor-pointer hover:text-stone-300 transition-colors">
                        {t('practiceLog.moveToPractice') || '연습 탭으로 이동'}
                        <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        isRunning ? pauseSession('manual') : resumeSession();
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isRunning ? 'bg-stone-800 text-brand hover:bg-stone-700' : 'bg-brand text-stone-950 hover:bg-brand-light pl-0.5'
                      }`}
                    >
                      {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                    
                    <button
                      onClick={handleStop}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-stone-800 text-red-400 hover:bg-stone-700 hover:text-red-300 transition-all"
                    >
                      <Square size={12} fill="currentColor" />
                    </button>

                    <button
                      onClick={toggleVisibility}
                      className="w-7 h-7 ml-1 rounded-full flex items-center justify-center text-stone-500 hover:bg-white/5 hover:text-stone-300 transition-all"
                      title={t('practiceLog.hideTimer') || '타이머 숨기기'}
                    >
                      <Minimize2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
