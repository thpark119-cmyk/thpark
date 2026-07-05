import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Save, X, Clock, Star, ListTodo } from 'lucide-react';
import { PracticeRoutine, PracticeRoutineItem } from '../types';
import { addRecord, updateRecord } from '../lib/firestore';
import { useLanguage } from '../context/LanguageContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PracticeRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  editingRoutine: PracticeRoutine | null;
}

export default function PracticeRoutineModal({ isOpen, onClose, user, editingRoutine }: PracticeRoutineModalProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<PracticeRoutineItem[]>([
    { id: crypto.randomUUID(), label: '', minutes: 10, memo: '' }
  ]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      if (editingRoutine) {
        setTitle(editingRoutine.title);
        setDescription(editingRoutine.description || '');
        setItems(editingRoutine.items.length > 0 ? editingRoutine.items : [{ id: crypto.randomUUID(), label: '', minutes: 10, memo: '' }]);
        setIsFavorite(!!editingRoutine.isFavorite);
      } else {
        setTitle('');
        setDescription('');
        setItems([{ id: crypto.randomUUID(), label: '', minutes: 10, memo: '' }]);
        setIsFavorite(false);
      }
      setErrorMsg('');
    }
  }, [isOpen, editingRoutine]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), label: '', minutes: 10, memo: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setErrorMsg(t('practiceLog.routineEmptySub') || '적어도 하나의 항목이 필요합니다.');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, fields: Partial<PracticeRoutineItem>) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, ...fields };
      }
      return item;
    }));
  };

  const totalMinutes = items.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(t('practiceLog.routineName') + ' ' + (t('common.saveError') || '필수 항목입니다.'));
      return;
    }

    const invalidItem = items.some(item => !item.label.trim() || (Number(item.minutes) || 0) <= 0);
    if (invalidItem) {
      setErrorMsg(t('practiceLog.itemName') + ' 및 예상 시간을 올바르게 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const routineId = editingRoutine ? editingRoutine.id : crypto.randomUUID();
      const routine: PracticeRoutine = {
        id: routineId,
        userId: user?.uid || 'local',
        title: title.trim(),
        description: description.trim() || undefined,
        items: items.map(item => ({
          id: item.id,
          label: item.label.trim(),
          minutes: Number(item.minutes) || 0,
          memo: item.memo?.trim() || undefined
        })),
        totalMinutes,
        isFavorite,
        createdAt: editingRoutine?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (editingRoutine) {
        await updateRecord('practice_routines', routine.id, routine, user);
      } else {
        await addRecord('practice_routines', routine, user);
      }

      onClose();
    } catch (err) {
      console.error('Error saving routine:', err);
      setErrorMsg(t('practiceLog.saveRoutineFailed') || '루틴 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-stone-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                <ListTodo size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingRoutine ? t('practiceLog.editRoutine') : t('practiceLog.addRoutine')}
                </h3>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  {t('practiceLog.routineEmptySub')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-stone-400 hover:text-white flex items-center justify-center transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Area */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title & Desc */}
            <div className="space-y-4 bg-stone-950/20 p-4 rounded-2xl border border-white/[0.02]">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400 ml-0.5">{t('practiceLog.routineName')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 매일 30분 기본기 연습"
                  className="w-full px-4 py-3 bg-stone-950 border border-white/[0.05] rounded-2xl text-white text-sm focus:outline-none focus:border-brand/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400 ml-0.5">{t('practiceLog.routineDesc')} (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="루틴에 대한 짧은 설명을 남겨주세요."
                  rows={2}
                  className="w-full px-4 py-3 bg-stone-950 border border-white/[0.05] rounded-2xl text-white text-sm focus:outline-none focus:border-brand/50 transition-colors resize-none"
                />
              </div>

              {/* Favorite Toggle */}
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-950 rounded-xl border border-white/[0.05] active:scale-95 transition-all text-xs text-stone-300 font-bold"
              >
                <Star size={14} className={isFavorite ? "fill-brand text-brand" : "text-stone-500"} />
                <span>{t('practiceLog.favorite')}</span>
              </button>
            </div>

            {/* Routine Items Title */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold uppercase tracking-widest text-stone-500 flex items-center gap-2">
                <span>📋</span>
                <span>연습 항목 리스트 ({items.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-bold rounded-xl active:scale-95 transition-all"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>{t('practiceLog.addItem')}</span>
              </button>
            </div>

            {/* Routine Items List */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="relative bg-stone-950/40 p-4 rounded-2xl border border-white/[0.02] space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-stone-900 border border-white/[0.05] flex items-center justify-center text-[10px] font-bold text-stone-500 mt-1">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => handleUpdateItem(item.id, { label: e.target.value })}
                          placeholder="항목 이름 (예: 롱톤, 스케일)"
                          className="w-full px-3 py-2 bg-stone-950 border border-white/[0.05] rounded-xl text-white text-xs focus:outline-none focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1 relative">
                        <input
                          type="number"
                          value={item.minutes || ''}
                          onChange={(e) => handleUpdateItem(item.id, { minutes: Number(e.target.value) || 0 })}
                          placeholder="10"
                          className="w-full pl-3 pr-7 py-2 bg-stone-950 border border-white/[0.05] rounded-xl text-white text-xs focus:outline-none focus:border-brand/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-2 text-[10px] text-stone-500 font-bold">m</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all mt-0.5 active:scale-95 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="pl-8">
                    <input
                      type="text"
                      value={item.memo || ''}
                      onChange={(e) => handleUpdateItem(item.id, { memo: e.target.value })}
                      placeholder="세부 메모나 팁 (선택)"
                      className="w-full px-3 py-2 bg-stone-950 border border-white/[0.03] rounded-xl text-stone-400 text-[11px] focus:outline-none focus:border-brand/40 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-white/[0.05] bg-stone-900/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-stone-400 font-sans">
              <Clock size={14} className="text-brand" />
              <span>{t('practiceLog.totalExpectedTime')}: <strong className="text-brand font-bold text-sm">{totalMinutes}</strong>{t('practiceLog.minutes')}</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-all"
              >
                {t('practiceLog.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-brand hover:bg-brand-light text-stone-950 font-bold text-xs rounded-xl shadow-lg shadow-brand/15 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save size={14} strokeWidth={2.5} />
                <span>{isSubmitting ? t('common.loading') : t('practiceLog.save')}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
