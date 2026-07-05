import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  LogIn, 
  AlertOctagon, 
  Info, 
  Database, 
  RefreshCw, 
  Users, 
  HardDrive, 
  FileText, 
  Image,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { signInWithGoogle } from '../lib/firebase';
import { getAdminStorageSummary, type AdminStorageSummary, type AdminUserStorageSummary } from '../utils/adminStorageSummary';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [summary, setSummary] = useState<AdminStorageSummary | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.email === 'thpark119@gmail.com';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const calculateStorage = async () => {
    if (!user) return;
    setCalculating(true);
    setError(null);
    try {
      const result = await getAdminStorageSummary(user);
      setSummary(result);
    } catch (err: any) {
      console.error('Failed to calculate admin storage summary:', err);
      setError(err?.message || 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      calculateStorage();
    }
  }, [user, isAdmin]);

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

  // Helper to parse if the error is due to missing list users permission
  const isPermissionError = error?.includes('permission-denied') || error?.includes('Permission');

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-8 pb-32 max-w-4xl mx-auto"
    >
      {/* Admin Title Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-brand/10 border border-brand/20 p-6 rounded-[32px]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20 shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{t('admin.dashboard')}</h2>
            <p className="text-[10px] text-brand uppercase font-bold tracking-widest">{t('admin.adminOnly')}</p>
          </div>
        </div>

        <button
          onClick={calculateStorage}
          disabled={calculating}
          className="w-full md:w-auto px-5 py-3 bg-white/10 hover:bg-white/15 disabled:bg-white/5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-white/5 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={calculating ? 'animate-spin' : ''} />
          <span>{calculating ? t('admin.calculating') : t('admin.recalculate')}</span>
        </button>
      </div>

      {/* 3. Error Case */}
      {error && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[28px] space-y-4">
          <div className="flex items-start gap-3 text-amber-500">
            <AlertOctagon size={24} className="shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-amber-200">{t('admin.failedToLoad')}</h3>
              <p className="text-xs text-amber-400/90 mt-1">
                {t('admin.noPermissionOrRules')}
              </p>
            </div>
          </div>
          {isPermissionError && (
            <div className="bg-stone-950/40 border border-white/5 p-4 rounded-xl text-[11px] text-stone-400 space-y-2 font-mono leading-relaxed">
              <p className="font-sans text-stone-300 font-bold">💡 보안 규칙 권한 해결 가이드:</p>
              <p>관리자 계정(`thpark119@gmail.com`)이라도, Firestore 규칙(`firestore.rules`)에 `/users` 컬렉션에 대한 `list` 권한이 선언되어 있어야 전체 사용자 정보 조회가 정상 실행됩니다.</p>
              <p>현재 규칙에서 `/users/{"{userId}"}`는 개별 조회(`get`)만 지원하며 목록 조회(`list`)를 지원하지 않습니다.</p>
              <p className="text-brand-light font-bold">권장 조치: `firestore.rules` 파일에 다음 규칙을 추가하고 배포해야 전체 요약 조회가 기능합니다:</p>
              <pre className="p-2 bg-stone-900 rounded overflow-x-auto text-[10px] text-brand-light">
{`match /users/{userId} {
  allow list: if isAdmin(); // 이 규칙이 누락되어 조회가 실패함
}`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Calculating indicator */}
      {calculating && !summary && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-stone-900/10 border border-white/5 rounded-[32px]">
          <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-stone-400 font-bold tracking-widest">{t('admin.calculating')}</span>
        </div>
      )}

      {/* Summary Content */}
      {summary && !calculating && (
        <div className="space-y-8">
          {/* Top Bento Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Total Users */}
            <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-stone-500 font-semibold">{t('admin.totalUsers')}</span>
                <p className="text-3xl font-black text-white">{summary.totals.userCount}<span className="text-sm font-normal text-stone-400 ml-1">명</span></p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center">
                <Users size={22} />
              </div>
            </div>

            {/* 2. Total Cloud Files */}
            <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-stone-500 font-semibold">{t('admin.totalCloudFiles')}</span>
                <p className="text-3xl font-black text-white">{summary.totals.fileCount}<span className="text-sm font-normal text-stone-400 ml-1">개</span></p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center">
                <FolderOpen size={22} />
              </div>
            </div>

            {/* 3. Total Storage Capacity */}
            <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-stone-500 font-semibold">{t('admin.totalStorage')}</span>
                <p className="text-3xl font-black text-white">{formatBytes(summary.totals.totalBytes)}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center">
                <HardDrive size={22} />
              </div>
            </div>
          </div>

          {/* Detailed Category Subtotals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-stone-900/10 border border-white/5 p-6 rounded-[28px]">
            {/* Student Photos */}
            <div className="space-y-1 p-2">
              <div className="flex items-center gap-1.5 text-stone-400 text-xs font-semibold mb-2">
                <Image size={14} className="text-brand-light" />
                <span>{t('admin.studentPhotos')}</span>
              </div>
              <p className="text-lg font-bold text-stone-100">{summary.totals.studentPhotoCount}장</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.studentPhotoBytes)}</p>
            </div>

            {/* Lesson Journal Photos */}
            <div className="space-y-1 p-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-6">
              <div className="flex items-center gap-1.5 text-stone-400 text-xs font-semibold mb-2">
                <Image size={14} className="text-brand-light" />
                <span>{t('admin.lessonPhotos')}</span>
              </div>
              <p className="text-lg font-bold text-stone-100">{summary.totals.lessonJournalPhotoCount}장</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.lessonJournalPhotoBytes)}</p>
            </div>

            {/* Repertoire Files */}
            <div className="space-y-1 p-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-6">
              <div className="flex items-center gap-1.5 text-stone-400 text-xs font-semibold mb-2">
                <FileText size={14} className="text-brand-light" />
                <span>{t('admin.repertoireFiles')}</span>
              </div>
              <p className="text-lg font-bold text-stone-100">{summary.totals.repertoireFileCount}개</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.repertoireFileBytes)}</p>
            </div>
          </div>

          {/* User List Table / Cards */}
          <div className="bg-stone-900/30 border border-white/5 rounded-[28px] overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-200">
                <Database size={18} className="text-brand" />
                <h3 className="text-base font-bold text-white">{t('admin.userStorageSummary')}</h3>
              </div>
              <span className="text-[10px] text-stone-500 font-bold bg-white/5 px-2.5 py-1 rounded-full uppercase">
                {summary.users.length} Users
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {summary.users.length === 0 ? (
                <div className="p-12 text-center text-sm text-stone-500">
                  데이터가 등록된 사용자가 존재하지 않습니다.
                </div>
              ) : (
                summary.users.map((us) => {
                  const safeUid = us.uid.substring(0, 8) + '...';
                  const userDisplayName = us.displayName || `사용자 (${safeUid})`;
                  return (
                    <div key={us.uid} className="p-6 space-y-4 hover:bg-white/[0.01] transition-all">
                      {/* User Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5">
                        <div>
                          <p className="text-sm font-bold text-white leading-snug">{userDisplayName}</p>
                          {us.email && <p className="text-[10px] text-stone-500 font-mono">{us.email}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-brand-light">
                            {t('admin.totalCapacity')}: {formatBytes(us.total.totalBytes)}
                          </span>
                          <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                            {t('admin.totalFiles')}: {us.total.count}개
                          </p>
                        </div>
                      </div>

                      {/* Metrics Breakdown Grid */}
                      <div className="grid grid-cols-3 gap-2.5 bg-stone-950/40 p-3 rounded-xl border border-white/5 text-center">
                        <div>
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.studentPhotos')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.studentPhotos.count}장</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatBytes(us.studentPhotos.totalBytes)}</p>
                        </div>
                        <div className="border-l border-white/5">
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.lessonPhotos')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.lessonJournalPhotos.count}장</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatBytes(us.lessonJournalPhotos.totalBytes)}</p>
                        </div>
                        <div className="border-l border-white/5">
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.repertoireFiles')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.repertoireFiles.count}개</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatBytes(us.repertoireFiles.totalBytes)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Guide Notices */}
          <div className="bg-stone-900/10 border border-white/5 p-6 rounded-[28px] space-y-3.5">
            <div className="flex items-center gap-2 text-stone-400">
              <Info size={16} className="text-brand shrink-0" />
              <h4 className="text-xs font-bold text-stone-300">알림 및 안내 사항</h4>
            </div>

            <ul className="space-y-2 text-xs text-stone-500 leading-relaxed list-disc list-inside">
              <li>{t('admin.appRecordsNotice')}</li>
              <li>{t('admin.billingNotice')}</li>
              <li>{t('admin.legacyNotice')}</li>
            </ul>

            {summary.calculatedAt && (
              <div className="pt-2 border-t border-white/5 flex justify-between text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                <span>{t('admin.lastCalculated')}</span>
                <span>{summary.calculatedAt}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

