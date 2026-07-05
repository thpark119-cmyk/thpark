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
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { signInWithGoogle } from '../lib/firebase';
import { getAdminStorageSummary, type AdminStorageSummary, type AdminUserStorageSummary } from '../utils/adminStorageSummary';
import { isAdminUser } from '../utils/admin';
import { 
  scanMetadataCandidates, 
  checkStorageMetadata, 
  saveMetadataCacheEntries,
  fetchMetadataCache,
  type BackfillScanCandidate, 
  type BackfillScanResult,
  type AdminMetadataCacheEntry
} from '../utils/adminMetadataBackfill';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [summary, setSummary] = useState<AdminStorageSummary | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backfill scanning states
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<BackfillScanCandidate[] | null>(null);
  const [scanResults, setScanResults] = useState<BackfillScanResult[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Phase 2 Metadata Cache states
  const [savingCache, setSavingCache] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'failed'>('idle');
  const [cacheEntries, setCacheEntries] = useState<AdminMetadataCacheEntry[]>([]);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const isAdmin = isAdminUser(user);

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

  const handleScanLegacyFiles = async () => {
    if (!user || !isAdmin) return;
    setScanning(true);
    setScanError(null);
    setCandidates(null);
    setScanResults(null);
    try {
      const scanCandidates = await scanMetadataCandidates();
      setCandidates(scanCandidates);

      const results: BackfillScanResult[] = [];
      const batchSize = 8;
      for (let i = 0; i < scanCandidates.length; i += batchSize) {
        const batch = scanCandidates.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (cand) => {
            return await checkStorageMetadata(cand);
          })
        );
        results.push(...batchResults);
      }
      setScanResults(results);
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err?.message || '스캔 실행 중 에러가 발생했습니다.');
    } finally {
      setScanning(false);
    }
  };

  const loadCacheEntries = async () => {
    if (!user || !isAdmin) return;
    try {
      const entries = await fetchMetadataCache();
      setCacheEntries(entries);
    } catch (err: any) {
      console.warn('Failed to load cache entries:', err);
      setCacheError(err?.message || 'Cache loading error');
    }
  };

  const handleSaveCorrigibleFiles = async () => {
    if (!user || !isAdmin || !scanResults || scanResults.length === 0) return;
    setSavingCache(true);
    setSaveStatus('saving');
    try {
      const { savedCount, failedCount } = await saveMetadataCacheEntries(scanResults);
      if (savedCount > 0) {
        setSaveStatus('success');
        // Refresh cache entries & re-calculate storage totals with cache applied
        await loadCacheEntries();
        await calculateStorage();
      } else {
        setSaveStatus('failed');
      }
    } catch (err: any) {
      console.error('Save cache error:', err);
      setSaveStatus('failed');
    } finally {
      setSavingCache(false);
    }
  };

  const calculateStorage = async () => {
    if (!user || !isAdmin) return;
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
      loadCacheEntries();
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
              <p className="font-sans text-stone-300 font-bold">💡 {t('admin.securityRulesGuide')}:</p>
              <p>{t('admin.securityRulesGuideDesc')}</p>
              <p>{t('admin.currentRulesDesc')}</p>
              <p className="text-brand-light font-bold">{t('admin.recommendedAction')}</p>
              <pre className="p-2 bg-stone-900 rounded overflow-x-auto text-[10px] text-brand-light">
{`match /users/{userId} {
  allow list: if isAdmin(); // ${t('admin.ruleMissingCause')}
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
          {/* Info banner about Auth subscriber vs Firestore document calculation */}
          <div className="bg-brand/5 border border-brand/10 p-4 rounded-2xl flex items-start gap-3 text-stone-300">
            <Info size={18} className="text-brand shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {t('admin.authDiffNotice')}
            </p>
          </div>

          {/* Top Bento Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Total Users */}
            <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-stone-500 font-semibold">{t('admin.totalUsers')}</span>
                <p className="text-3xl font-black text-white">{summary.totals.userCount}<span className="text-sm font-normal text-stone-400 ml-1">{t('admin.userUnit')}</span></p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center">
                <Users size={22} />
              </div>
            </div>

            {/* 2. Total Cloud Files */}
            <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-stone-500 font-semibold">{t('admin.totalCloudFiles')}</span>
                <p className="text-3xl font-black text-white">{summary.totals.fileCount}<span className="text-sm font-normal text-stone-400 ml-1">{t('admin.fileUnit')}</span></p>
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
              <p className="text-lg font-bold text-stone-100">{summary.totals.studentPhotoCount}{t('admin.photoUnit')}</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.studentPhotoBytes)}</p>
            </div>

            {/* Lesson Journal Photos */}
            <div className="space-y-1 p-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-6">
              <div className="flex items-center gap-1.5 text-stone-400 text-xs font-semibold mb-2">
                <Image size={14} className="text-brand-light" />
                <span>{t('admin.lessonPhotos')}</span>
              </div>
              <p className="text-lg font-bold text-stone-100">{summary.totals.lessonJournalPhotoCount}{t('admin.photoUnit')}</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.lessonJournalPhotoBytes)}</p>
            </div>

            {/* Repertoire Files */}
            <div className="space-y-1 p-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-6">
              <div className="flex items-center gap-1.5 text-stone-400 text-xs font-semibold mb-2">
                <FileText size={14} className="text-brand-light" />
                <span>{t('admin.repertoireFiles')}</span>
              </div>
              <p className="text-lg font-bold text-stone-100">{summary.totals.repertoireFileCount}{t('admin.fileUnit')}</p>
              <p className="text-xs text-stone-500">{formatBytes(summary.totals.repertoireFileBytes)}</p>
            </div>
          </div>

          {/* Legacy Files Metadata Scanning Section */}
          <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[28px] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Search size={20} className="text-brand" />
                <div>
                  <h3 className="text-base font-bold text-white">{t('admin.backfillTitle')}</h3>
                  <p className="text-xs text-stone-500 mt-1">{t('admin.backfillNotice1')}</p>
                </div>
              </div>

              <button
                onClick={handleScanLegacyFiles}
                disabled={scanning}
                className="px-5 py-3 bg-brand hover:bg-brand-light disabled:bg-brand/40 text-stone-950 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
                <span>{scanning ? t('admin.backfillScanning') : t('admin.backfillScanBtn')}</span>
              </button>
            </div>

            {/* Stage Info Notice */}
            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex items-start gap-3 text-stone-400">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5 leading-relaxed">
                <p>{t('admin.backfillNotice2')}</p>
                <p>{t('admin.backfillNotice3')}</p>
              </div>
            </div>

            {/* Current Cache Status Grid */}
            <div className="bg-stone-950/20 border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-emerald-400" />
                <p className="text-xs font-bold text-stone-300 uppercase tracking-wider">현재 관리자 보정 캐시 현황 (Firestore Cache)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-stone-900/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-stone-500 font-semibold">{t('admin.backfillCachedCount')}</p>
                    <p className="text-lg font-black text-white mt-1">{cacheEntries.length} {t('admin.fileUnit')}</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="bg-stone-900/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-stone-500 font-semibold">{t('admin.backfillCachedBytes')}</p>
                    <p className="text-lg font-black text-white mt-1">
                      {formatBytes(cacheEntries.reduce((sum, entry) => sum + (entry.size || 0), 0))}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
                    <HardDrive size={18} />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-stone-500 leading-relaxed italic">
                * {t('admin.backfillNoticeSummary')}
              </p>
            </div>

            {/* Scan Error */}
            {scanError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex gap-2">
                <AlertOctagon size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{t('admin.failedToLoad')}</p>
                  <p className="mt-1 font-mono">{scanError}</p>
                  <p className="mt-2 text-stone-500 leading-relaxed">
                    💡 Firebase Storage Rules에 관리자 계정의 읽기 권한이 필요합니다. 자세한 안내는 `docs/storage-rules-admin-read-draft.md`를 참고하십시오.
                  </p>
                </div>
              </div>
            )}

            {/* Scan Results statistics */}
            {scanResults && (
              <div className="space-y-6">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t('admin.backfillScanResult')}</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-stone-950/40 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-stone-500 text-[10px] font-semibold">{t('admin.backfillCandidateCount')}</p>
                    <p className="text-lg font-black text-white mt-1">{scanResults.length}</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl text-center">
                    <p className="text-emerald-400/80 text-[10px] font-semibold">{t('admin.backfillSuccessCount')}</p>
                    <p className="text-lg font-black text-emerald-400 mt-1">
                      {scanResults.filter(r => r.status === 'metadata-found').length}
                    </p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl text-center">
                    <p className="text-red-400/80 text-[10px] font-semibold">{t('admin.backfillNoPermissionCount')}</p>
                    <p className="text-lg font-black text-red-400 mt-1">
                      {scanResults.filter(r => r.status === 'permission-denied').length}
                    </p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl text-center">
                    <p className="text-amber-400/80 text-[10px] font-semibold">{t('admin.backfillNotFoundCount')}</p>
                    <p className="text-lg font-black text-amber-400 mt-1">
                      {scanResults.filter(r => r.status === 'not-found').length}
                    </p>
                  </div>
                  <div className="bg-stone-900/40 border border-white/5 p-4 rounded-2xl text-center col-span-2 md:col-span-1">
                    <p className="text-stone-500 text-[10px] font-semibold">{t('admin.backfillNoPathCount')}</p>
                    <p className="text-lg font-black text-white mt-1">
                      {scanResults.filter(r => r.status === 'missing-storage-path').length}
                    </p>
                  </div>
                </div>

                {/* Categories break-down */}
                <div className="bg-stone-950/20 border border-white/5 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3">{t('admin.backfillCategorySuccess')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex justify-between items-center bg-stone-950/30 px-3 py-2.5 rounded-xl border border-white/5">
                      <span className="text-stone-400">{t('admin.backfillStudentPhotos')}</span>
                      <span className="font-bold text-white">
                        {scanResults.filter(r => r.candidate.category === 'studentPhoto' && r.status === 'metadata-found').length} / {scanResults.filter(r => r.candidate.category === 'studentPhoto').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-stone-950/30 px-3 py-2.5 rounded-xl border border-white/5">
                      <span className="text-stone-400">{t('admin.backfillLessonPhotos')}</span>
                      <span className="font-bold text-white">
                        {scanResults.filter(r => r.candidate.category === 'lessonJournalPhoto' && r.status === 'metadata-found').length} / {scanResults.filter(r => r.candidate.category === 'lessonJournalPhoto').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-stone-950/30 px-3 py-2.5 rounded-xl border border-white/5">
                      <span className="text-stone-400">{t('admin.backfillRepertoireFiles')}</span>
                      <span className="font-bold text-white">
                        {scanResults.filter(r => r.candidate.category === 'repertoireFile' && r.status === 'metadata-found').length} / {scanResults.filter(r => r.candidate.category === 'repertoireFile').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save Corrigible Action Banner */}
                {scanResults.some(r => r.status === 'metadata-found') && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-emerald-200">보정 실행 준비 완료</h4>
                        <p className="text-xs text-emerald-400/90 mt-1">
                          스캔 결과 중 실제 파일 정보가 확보된 <span className="font-bold underline">{scanResults.filter(r => r.status === 'metadata-found').length}개</span>의 파일 크기와 콘텐츠 타입을 관리자 cache에 저장할 수 있습니다.
                        </p>
                        <div className="mt-3 flex flex-col gap-1.5 text-[10px] text-stone-400">
                          <p>• {t('admin.backfillNoticeNoPermission')}</p>
                          <p>• {t('admin.backfillNoticeNotFound')}</p>
                          <p>• {t('admin.backfillNoticeNoUserDocEdit')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      <button
                        onClick={handleSaveCorrigibleFiles}
                        disabled={savingCache || saveStatus === 'saving'}
                        className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950/40 text-stone-950 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      >
                        {savingCache ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>
                          {saveStatus === 'saving'
                            ? t('admin.backfillSaving')
                            : saveStatus === 'success'
                            ? t('admin.backfillSaveSuccess')
                            : saveStatus === 'failed'
                            ? t('admin.backfillSaveFailed')
                            : t('admin.backfillSaveBtn')}
                        </span>
                      </button>

                      {saveStatus === 'success' && (
                        <span className="text-xs text-emerald-400 font-medium animate-pulse">
                          🎉 보정이 성공적으로 저장되었으며 대시보드 용량 계산에 즉시 반영되었습니다!
                        </span>
                      )}
                      {saveStatus === 'failed' && (
                        <span className="text-xs text-red-400 font-medium">
                          ❌ 보정 저장 중 오류가 발생했습니다. Firestore Rules 규칙을 확인하십시오.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Candidate list preview */}
                <div className="bg-stone-950/40 border border-white/5 rounded-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-white/5">
                  {scanResults.map((result, idx) => {
                    const cand = result.candidate;
                    let statusLabel = '';
                    let statusClass = '';
                    if (result.status === 'metadata-found') {
                      statusLabel = t('admin.backfillStatusEligible');
                      statusClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    } else if (result.status === 'permission-denied') {
                      statusLabel = t('admin.backfillStatusNoPermission');
                      statusClass = 'text-red-400 bg-red-500/10 border-red-500/20';
                    } else if (result.status === 'not-found') {
                      statusLabel = t('admin.backfillStatusNotFound');
                      statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                    } else {
                      statusLabel = t('admin.backfillStatusError');
                      statusClass = 'text-stone-400 bg-stone-500/10 border-stone-500/20';
                    }

                    let categoryLabel = '';
                    if (cand.category === 'studentPhoto') categoryLabel = t('admin.backfillStudentPhotos');
                    else if (cand.category === 'lessonJournalPhoto') categoryLabel = t('admin.backfillLessonPhotos');
                    else categoryLabel = t('admin.backfillRepertoireFiles');

                    return (
                      <div key={cand.id || idx} className="p-4 text-xs space-y-2 hover:bg-white/[0.01]">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-brand-light bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                                {categoryLabel}
                              </span>
                              <span className="font-mono text-stone-500 text-[10px] truncate max-w-xs break-all">
                                {cand.sourceDocPath}
                              </span>
                            </div>
                            <p className="font-mono text-stone-400 text-[10px] break-all">{cand.storagePath}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[10px] text-stone-500">
                          <div>
                            <span>기존 DB 정보: </span>
                            <span className="text-stone-400">
                              {cand.existingSize ? formatBytes(cand.existingSize) : '0 B'} 
                              {cand.existingContentType ? ` (${cand.existingContentType})` : ''}
                            </span>
                          </div>
                          {result.status === 'metadata-found' && (
                            <div className="text-right">
                              <span>실제 Storage 정보: </span>
                              <span className="text-emerald-400 font-bold">
                                {result.storageSize ? formatBytes(result.storageSize) : '0 B'}
                                {result.storageContentType ? ` (${result.storageContentType})` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User List Table / Cards */}
          <div className="bg-stone-900/30 border border-white/5 rounded-[28px] overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-200">
                <Database size={18} className="text-brand" />
                <h3 className="text-base font-bold text-white">{t('admin.userStorageSummary')}</h3>
              </div>
              <span className="text-[10px] text-stone-500 font-bold bg-white/5 px-2.5 py-1 rounded-full uppercase">
                {summary.users.length} {t('admin.user')}
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {summary.users.length === 0 ? (
                <div className="p-12 text-center text-sm text-stone-500">
                  {t('admin.noUsersWithData')}
                </div>
              ) : (
                summary.users.map((us) => {
                  const safeUid = us.uid ? (us.uid.substring(0, 8) + '***' + us.uid.substring(us.uid.length - 4)) : '';
                  const userDisplayName = us.displayName || `${t('admin.user')} (${safeUid})`;
                  return (
                    <div key={us.uid} className="p-6 space-y-4 hover:bg-white/[0.01] transition-all">
                      {/* User Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white leading-snug truncate break-all">{userDisplayName}</p>
                          {us.email && <p className="text-[10px] text-stone-500 font-mono truncate break-all">{us.email}</p>}
                        </div>
                        <div className="text-left md:text-right shrink-0">
                          <span className="text-xs font-black text-brand-light block">
                            {t('admin.totalCapacity')}: {formatBytes(us.total.totalBytes)}
                          </span>
                          <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                            {t('admin.totalFiles')}: {us.total.count}{t('admin.fileUnit')}
                          </p>
                        </div>
                      </div>

                      {/* Metrics Breakdown Grid */}
                      <div className="grid grid-cols-3 gap-2.5 bg-stone-950/40 p-3 rounded-xl border border-white/5 text-center">
                        <div>
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.studentPhotos')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.studentPhotos.count}{t('admin.photoUnit')}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatBytes(us.studentPhotos.totalBytes)}</p>
                        </div>
                        <div className="border-l border-white/5">
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.lessonPhotos')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.lessonJournalPhotos.count}{t('admin.photoUnit')}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{formatBytes(us.lessonJournalPhotos.totalBytes)}</p>
                        </div>
                        <div className="border-l border-white/5">
                          <p className="text-[10px] text-stone-500 font-semibold truncate">{t('admin.repertoireFiles')}</p>
                          <p className="text-xs font-bold text-stone-300 mt-1">{us.repertoireFiles.count}{t('admin.fileUnit')}</p>
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
              <h4 className="text-xs font-bold text-stone-300">{t('admin.noticesAndGuides')}</h4>
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

