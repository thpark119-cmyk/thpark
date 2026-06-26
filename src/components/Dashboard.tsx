import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { PlusCircle, ListTodo, Search, MessageSquare, Clock, Activity, Settings2 } from 'lucide-react';
import { subscribeToCollection } from '../lib/firestore';
import { ReceivedLesson } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const [recentLessons, setRecentLessons] = useState<ReceivedLesson[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = subscribeToCollection<ReceivedLesson>('received_lessons', (data) => {
      setRecentLessons(data.slice(0, 3));
    });
    return unsubscribe;
  }, []);

  const quickActions = [
    { id: 'mylessons', label: t('dashboard.quickActionMyLessons'), desc: t('dashboard.quickActionMyLessonsDesc'), color: 'bg-brand/10 text-brand border-brand/20', icon: PlusCircle },
    { id: 'repertoire', label: t('dashboard.quickActionRepertoire'), desc: t('dashboard.quickActionRepertoireDesc'), color: 'bg-stone-800/50 text-stone-200 border-white/5', icon: Search },
    { id: 'studio', label: t('dashboard.quickActionStudio'), desc: t('dashboard.quickActionStudioDesc'), color: 'bg-stone-800/50 text-stone-200 border-white/5', icon: ListTodo },
    { id: 'tutor', label: t('dashboard.quickActionTutor'), desc: t('dashboard.quickActionTutorDesc'), color: 'bg-stone-800/50 text-stone-200 border-white/5', icon: MessageSquare },
  ];

  const tools = [
    { id: 'metronome', label: 'Metronome', color: 'bg-stone-900', icon: Activity },
    { id: 'tuner', label: 'Tuner', color: 'bg-stone-900', icon: Settings2 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-8"
      id="mobile-hub"
    >
      <div className="space-y-1">
        <h2 className="text-3xl md:text-4xl font-serif italic text-white tracking-tight">{t('dashboard.todayRecords')}</h2>
        <p className="text-sm text-stone-500 font-medium">{t('dashboard.whatToRecord')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => setActiveTab(action.id)}
            className={`flex flex-col items-start gap-3 p-5 rounded-[24px] border text-left transition-all active:scale-[0.98] ${action.color}`}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shadow-lg">
              <action.icon size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight mb-0.5">{action.label}</h3>
              <p className="text-[11px] text-stone-400 font-medium line-clamp-1">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 ml-1">Practice Tools</h3>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              disabled
              className="flex items-center gap-3 p-4 rounded-2xl border border-white/5 bg-stone-900/50 opacity-60 text-left relative overflow-hidden"
            >
              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-stone-400">
                <tool.icon size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-300">{tool.label}</h3>
                <p className="text-[9px] text-brand font-bold uppercase tracking-widest">Coming Soon</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <section className="bg-stone-900/30 rounded-[24px] p-6 border border-white/5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">{t('dashboard.recentLessons')}</h3>
          <Clock size={14} className="text-stone-600" />
        </div>
        
        <div className="space-y-3">
          {recentLessons.length > 0 ? (
            recentLessons.map((lesson) => (
              <div key={lesson.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-[16px] border border-white/5">
                <div className="flex-1 mr-4 overflow-hidden">
                  <span className="text-sm font-serif italic text-stone-200 block truncate">{lesson.topic}</span>
                  <span className="text-[10px] text-stone-500 uppercase font-bold tracking-widest block truncate mt-0.5">{lesson.teacher}</span>
                </div>
                <span className="text-[10px] font-mono text-stone-600 shrink-0">{lesson.date.split('-').slice(1).join('.')}</span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center bg-white/[0.01] rounded-[16px] border border-dashed border-stone-800">
              <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">{t('dashboard.noRecentLessons')}</p>
              <button 
                onClick={() => setActiveTab('mylessons')}
                className="mt-3 text-[10px] text-brand font-bold uppercase tracking-widest hover:underline"
              >
                {t('dashboard.firstLesson')}
              </button>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

