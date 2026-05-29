import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, BookOpen, FileMusic, ShieldCheck, Search, ArrowRight } from 'lucide-react';
import { subscribeToCollection } from '../lib/firestore';
import { ReceivedLesson, Student, RepertoireItem } from '../types';

export default function AdminPanel() {
  const [lessons, setLessons] = useState<ReceivedLesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([]);
  const [activeView, setActiveView] = useState<'lessons' | 'students' | 'repertoire'>('lessons');

  useEffect(() => {
    // Admins can subscribe to collections without the userId filter
    const unsubLessons = subscribeToCollection<ReceivedLesson>('received_lessons', setLessons, false);
    const unsubStudents = subscribeToCollection<Student>('students', setStudents, false);
    const unsubRepertoire = subscribeToCollection<RepertoireItem>('repertoire', setRepertoire, false);

    return () => {
      unsubLessons();
      unsubStudents();
      unsubRepertoire();
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-32">
      <div className="bg-brand/10 border border-brand/20 p-6 rounded-[32px] flex items-center gap-4">
        <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">관리자 패널</h2>
          <p className="text-[10px] text-brand uppercase font-bold tracking-widest">전체 데이터 실시간 모니터링</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {[
          { id: 'lessons', label: '레슨 기록', icon: BookOpen, count: lessons.length },
          { id: 'students', label: '학생 관리', icon: Users, count: students.length },
          { id: 'repertoire', label: '악보함', icon: FileMusic, count: repertoire.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all whitespace-nowrap ${
              activeView === tab.id 
                ? 'bg-white text-black border-white' 
                : 'bg-stone-900/50 text-stone-500 border-white/5'
            }`}
          >
            <tab.icon size={16} />
            <span className="text-sm font-bold uppercase tracking-tight">{tab.label}</span>
            <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeView === 'lessons' && lessons.map(lesson => (
          <div key={lesson.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px] space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] text-stone-600 font-bold uppercase tracking-widest mb-1">User ID: {lesson.userId}</p>
                <h4 className="text-lg font-serif italic text-white">{lesson.topic}</h4>
              </div>
              <span className="text-[10px] font-mono text-stone-500">{lesson.date}</span>
            </div>
            <p className="text-xs text-stone-400">Teacher: {lesson.teacher}</p>
          </div>
        ))}

        {activeView === 'students' && students.map(student => (
          <div key={student.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-brand font-serif italic">
                {student.name[0]}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{student.name}</h4>
                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest">Level: {student.level}</p>
              </div>
            </div>
            <span className="text-[9px] text-stone-700">UID: {student.userId.slice(0, 8)}...</span>
          </div>
        ))}

        {activeView === 'repertoire' && repertoire.map(item => (
          <div key={item.id} className="bg-bg-card border border-white/5 p-5 rounded-[28px]">
            <h4 className="text-lg font-serif italic text-white truncate">{item.title}</h4>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-stone-500">{item.composer}</p>
              <span className="text-[10px] bg-stone-800 px-2 py-1 rounded-full text-stone-400 uppercase font-bold tracking-tighter">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
