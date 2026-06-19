import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { PlusCircle, ListTodo, Search, MessageSquare, Clock } from 'lucide-react';
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
    { id: 'mylessons', label: t('dashboard.quickActionMyLessons'), desc: t('dashboard.quickActionMyLessonsDesc'), color: 'bg-brand', icon: PlusCircle },
    { id: 'studio', label: t('dashboard.quickActionStudio'), desc: t('dashboard.quickActionStudioDesc'), color: 'bg-stone-800', icon: ListTodo },
    { id: 'repertoire', label: t('dashboard.quickActionRepertoire'), desc: t('dashboard.quickActionRepertoireDesc'), color: 'bg-stone-800', icon: Search },
    { id: 'tutor', label: t('dashboard.quickActionTutor'), desc: t('dashboard.quickActionTutorDesc'), color: 'bg-stone-800', icon: MessageSquare },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
      id="mobile-hub"
    >
      <div className="space-y-2">
        <h2 className="text-4xl font-serif italic text-white tracking-tight">{t('dashboard.todayRecords')}</h2>
        <p className="text-stone-500 font-medium">{t('dashboard.whatToRecord')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {quickActions.map((action, idx) => (
          <button
            key={action.id}
            onClick={() => setActiveTab(action.id)}
            className={`flex items-center gap-5 p-6 rounded-[28px] border border-white/5 text-left transition-all active:scale-[0.98] ${
              idx === 0 ? 'bg-brand/10 border-brand/20' : 'bg-bg-card'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl ${action.color} flex items-center justify-center text-white shadow-xl shadow-black/20`}>
              <action.icon size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-none mb-1">{action.label}</h3>
              <p className="text-sm text-stone-500 font-medium">{action.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <section className="bg-stone-900/30 rounded-[32px] p-8 border border-white/5 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-600">{t('dashboard.recentLessons')}</h3>
          <Clock size={14} className="text-stone-600" />
        </div>
        
        <div className="space-y-4">
          {recentLessons.length > 0 ? (
            recentLessons.map((lesson) => (
              <div key={lesson.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div className="flex-1">
                  <span className="text-sm font-serif italic text-stone-200 block truncate">{lesson.topic}</span>
                  <span className="text-[10px] text-stone-600 uppercase font-bold tracking-widest">{lesson.teacher}</span>
                </div>
                <span className="text-[10px] font-mono text-stone-500 ml-4">{lesson.date.split('-').slice(1).join('.')}</span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white/[0.01] rounded-2xl border border-dashed border-stone-800">
              <p className="text-xs text-stone-600 font-bold uppercase tracking-wider">{t('dashboard.noRecentLessons')}</p>
              <button 
                onClick={() => setActiveTab('mylessons')}
                className="mt-4 text-[10px] text-brand font-bold uppercase tracking-widest hover:underline"
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

