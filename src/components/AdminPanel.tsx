import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, LogIn, AlertOctagon, Info, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { signInWithGoogle } from '../lib/firebase';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const isAdmin = user?.email === 'thpark119@gmail.com';

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] text-stone-600 uppercase font-bold tracking-widest">{t('common.loading')}</span>
      </div>
    );
  }

  // 1. Not Logged In State
  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto my-12 p-8 bg-stone-900/40 border border-white/5 rounded-[32px] text-center space-y-6"
      >
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertOctagon size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">{t('admin.loginRequired')}</h3>
          <p className="text-sm text-stone-400">
            {t('admin.adminOnly')}
          </p>
        </div>
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-stone-100 transition-all active:scale-[0.98]"
        >
          <LogIn size={16} />
          <span>{t('app.login')}</span>
        </button>
      </motion.div>
    );
  }

  // 2. Logged In but Not Admin State
  if (!isAdmin) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto my-12 p-8 bg-stone-900/40 border border-white/5 rounded-[32px] text-center space-y-6"
      >
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertOctagon size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">{t('admin.noPermission')}</h3>
          <p className="text-sm text-stone-400">
            {t('admin.adminOnly')}
          </p>
        </div>
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-left text-xs text-stone-500 space-y-1">
          <p>• {t('settings.signedInAs')}: <span className="text-stone-300 font-medium">{user.email}</span></p>
        </div>
      </motion.div>
    );
  }

  // 3. Admin Authorized State (Dashboard Skeleton)
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-8 pb-32 max-w-2xl mx-auto"
    >
      <div className="bg-brand/10 border border-brand/20 p-6 rounded-[32px] flex items-center gap-4">
        <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{t('admin.dashboard')}</h2>
          <p className="text-[10px] text-brand uppercase font-bold tracking-widest">{t('admin.adminOnly')}</p>
        </div>
      </div>

      <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] space-y-6">
        <div className="flex items-center gap-3 text-stone-200 border-b border-white/5 pb-4">
          <Database size={20} className="text-brand-light" />
          <h3 className="text-base font-bold text-white">전체 사용자 저장 현황</h3>
        </div>

        <div className="flex items-start gap-3 bg-brand/5 border border-brand/10 p-4 rounded-2xl text-stone-300">
          <Info size={18} className="text-brand shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            {t('admin.futureFeature')}
          </p>
        </div>

        {/* Beautiful skeleton elements to indicate incoming features */}
        <div className="space-y-3 opacity-60">
          <div className="p-4 bg-stone-950/40 rounded-xl border border-white/5 flex justify-between items-center">
            <span className="text-xs text-stone-400">전체 활성 사용자</span>
            <span className="w-16 h-4 bg-stone-800 rounded animate-pulse animate-duration-1000" />
          </div>
          <div className="p-4 bg-stone-950/40 rounded-xl border border-white/5 flex justify-between items-center">
            <span className="text-xs text-stone-400">전체 클라우드 파일 수</span>
            <span className="w-20 h-4 bg-stone-800 rounded animate-pulse animate-duration-1000" />
          </div>
          <div className="p-4 bg-stone-950/40 rounded-xl border border-white/5 flex justify-between items-center">
            <span className="text-xs text-stone-400">전체 저장 공간 사용량</span>
            <span className="w-24 h-4 bg-stone-800 rounded animate-pulse animate-duration-1000" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
