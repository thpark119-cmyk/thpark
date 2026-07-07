import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, Activity, ChevronRight, X } from 'lucide-react';
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
}

export function MiniTimer({ onNavigateToPractice }: MiniTimerProps) {
  const { session, currentSeconds, pauseSession, resumeSession, finishSession, clearSession } = usePracticeTimer();
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!session || session.status === 'finished') {
    return null;
  }

  const isRunning = session.status === 'running';
  const label = session.routineTitle || (session.sourceType === 'routine' ? (t('practiceLog.routinePractice') || '루틴 연습') : (t('practiceLog.freePractice') || '자유 연습'));

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

  return (
    <div className="fixed bottom-[80px] md:bottom-auto md:top-24 right-4 md:right-8 z-50 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="pointer-events-auto bg-[#1a1816] border border-brand/20 shadow-2xl shadow-brand/10 p-3 rounded-2xl flex items-center gap-4 w-[calc(100vw-32px)] md:w-auto max-w-sm"
          onClick={onNavigateToPractice}
        >
          {showConfirm ? (
            <div className="flex flex-col gap-2 w-full">
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
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isRunning ? 'bg-stone-800 text-brand hover:bg-stone-700' : 'bg-brand text-stone-950 hover:bg-brand-light pl-0.5'
                  }`}
                >
                  {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>
                
                <button
                  onClick={handleStop}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-stone-800 text-red-400 hover:bg-stone-700 hover:text-red-300 transition-all"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
