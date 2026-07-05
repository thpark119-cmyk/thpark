import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LocalPhotoMigration from './LocalPhotoMigration';
import { 
  User, Globe, Database, ShieldAlert, Mail, Info, 
  LogOut, Trash2, AlertTriangle, Check, X, ShieldCheck, ExternalLink,
  RefreshCw, Cloud, HardDrive
} from 'lucide-react';
import { signInWithGoogle, logout } from '../lib/firebase';
import { clearLocalData, deleteUserAccountData } from '../lib/firestore';
import { BrandLogo } from './BrandLogo';
import packageJson from '../../package.json';
import { getStorageUsageSummary, type StorageUsageSummary } from '../utils/storageUsageSummary';
import { isAdminUser } from '../utils/admin';

const VERSION = packageJson.version || '0.1.0';
const CONTACT_EMAIL = 'thpark119@gmail.com';

interface SettingsProps {
  setActiveTab?: (tab: string) => void;
}

export default function Settings({ setActiveTab }: SettingsProps) {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  const [showClearLocal, setShowClearLocal] = useState(false);

  const [storageSummary, setStorageSummary] = useState<StorageUsageSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const summary = await getStorageUsageSummary(user);
      setStorageSummary(summary);
    } catch (err: any) {
      console.error('Failed to load storage summary:', err);
      setSummaryError(err.message || String(err));
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [user]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleSection = (section: string) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteUserAccountData(user);
      if (result && result.hasStorageFailures) {
        alert(t('settings.deleteAccountPartialSuccess'));
      } else {
        alert(t('settings.deleteAccountSuccess'));
      }
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/requires-recent-login') {
        setDeleteError(t('settings.requiresRecentLogin'));
      } else {
        setDeleteError(e.message || String(e));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearLocal = () => {
    clearLocalData();
    alert(t('settings.clearLocalDataSuccess'));
    setShowClearLocal(false);
  };

  const renderSectionHeader = (id: string, icon: React.ReactNode, title: string) => (
    <button 
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 bg-stone-900/60 hover:bg-stone-800/80 rounded-2xl border border-white/5 transition-colors text-left"
    >
      <div className="flex items-center gap-3 text-stone-200 font-bold">
        <div className="text-stone-400">{icon}</div>
        <span>{title}</span>
      </div>
      <div className={`transition-transform duration-300 ${activeSection === id ? 'rotate-180' : ''} text-stone-500`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto pb-10 space-y-3">
      {/* Admin Dashboard Option for Admins */}
      {isAdminUser(user) && setActiveTab && (
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('admin')}
            className="w-full flex items-center justify-between p-4 bg-brand/10 hover:bg-brand/20 border border-brand/20 rounded-2xl transition-all text-left"
          >
            <div className="flex items-center gap-3 text-brand-light font-bold">
              <div className="text-brand"><ShieldCheck size={18} /></div>
              <span>{t('admin.dashboard')}</span>
            </div>
            <div className="text-brand">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Profile */}
      <div className="space-y-2">
        {renderSectionHeader('profile', <User size={18} />, t('settings.profile'))}
        <AnimatePresence>
          {activeSection === 'profile' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5 space-y-4">
                {user ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-stone-500 mb-1">{t('settings.signedInAs')}</p>
                      <p className="font-bold text-stone-200">{user.displayName || 'User'}</p>
                      <p className="text-sm text-stone-400">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => logout()} 
                      className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors text-sm font-medium"
                    >
                      <LogOut size={16} />
                      {t('app.logout')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-stone-400 whitespace-pre-line leading-relaxed">{t('settings.notSignedIn')}</p>
                    <button 
                      onClick={signInWithGoogle} 
                      className="flex items-center gap-2 px-4 py-2 bg-brand/20 hover:bg-brand/30 text-brand-light rounded-xl transition-colors text-sm font-bold"
                    >
                      <User size={16} />
                      {t('app.login')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Language */}
      <div className="space-y-2">
        {renderSectionHeader('language', <Globe size={18} />, t('settings.language'))}
        <AnimatePresence>
          {activeSection === 'language' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5 flex flex-col gap-2">
                <button onClick={() => setLanguage('ko')} className={`px-4 py-3 rounded-xl text-left font-medium transition-colors ${language === 'ko' ? 'bg-brand/20 text-brand-light border border-brand/20' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>한국어</button>
                <button onClick={() => setLanguage('en')} className={`px-4 py-3 rounded-xl text-left font-medium transition-colors ${language === 'en' ? 'bg-brand/20 text-brand-light border border-brand/20' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>English</button>
                <button onClick={() => setLanguage('de')} className={`px-4 py-3 rounded-xl text-left font-medium transition-colors ${language === 'de' ? 'bg-brand/20 text-brand-light border border-brand/20' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>Deutsch</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Data Management */}
      <div className="space-y-2">
        {renderSectionHeader('data', <Database size={18} />, t('settings.dataManagement'))}
        <AnimatePresence>
          {activeSection === 'data' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5 space-y-4">
                <p className="text-sm text-stone-400 whitespace-pre-line leading-relaxed">
                  {user ? t('settings.dataManagementDescSigned') : t('settings.dataManagementDescUnsigned')}
                </p>

                {/* Storage Status Sub-panel */}
                <div className="mt-4 p-4 bg-stone-950/40 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
                      <Database size={16} className="text-brand-light" />
                      {t('settings.storageStatusTitle')}
                    </h4>
                    <button
                      onClick={fetchSummary}
                      disabled={isLoadingSummary}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 hover:text-white rounded-lg transition-colors text-xs font-medium"
                    >
                      <RefreshCw size={12} className={isLoadingSummary ? 'animate-spin' : ''} />
                      {isLoadingSummary ? t('settings.recalculating') : t('settings.recalculate')}
                    </button>
                  </div>

                  <p className="text-xs text-stone-400 whitespace-pre-line leading-relaxed">
                    {user ? t('settings.storageDescSigned') : t('settings.storageDescUnsigned')}
                  </p>

                  {summaryError && (
                    <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded-lg">
                      {t('settings.failedToFetchStorageStatus')}: {summaryError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cloud Storage */}
                    <div className="space-y-3 p-3 bg-stone-900/40 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                        <Cloud size={14} className="text-blue-400" />
                        {t('settings.cloudStorageTitle')}
                      </div>

                      {!user ? (
                        <p className="text-xs text-stone-500 italic py-4 pl-1">
                          {t('settings.storageDescUnsigned').split('\n')[1] || 'Please sign in to view cloud data.'}
                        </p>
                      ) : isLoadingSummary && !storageSummary ? (
                        <p className="text-xs text-stone-500 animate-pulse py-4 pl-1">{t('common.loading')}</p>
                      ) : storageSummary ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center text-stone-400 pl-1">
                            <span>{t('settings.studentPhotos')}</span>
                            <span className="font-mono text-stone-300">
                              {storageSummary.cloud.studentPhotos.count}{t('settings.photoUnit')} / {formatBytes(storageSummary.cloud.studentPhotos.totalBytes)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-stone-400 pl-1">
                            <span>{t('settings.lessonJournalPhotos')}</span>
                            <span className="font-mono text-stone-300">
                              {storageSummary.cloud.lessonJournalPhotos.count}{t('settings.photoUnit')} / {formatBytes(storageSummary.cloud.lessonJournalPhotos.totalBytes)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-stone-400 pl-1">
                            <span>{t('settings.repertoireFiles')}</span>
                            <span className="font-mono text-stone-300">
                              {storageSummary.cloud.repertoireFiles.count}{t('settings.fileUnit')} / {formatBytes(storageSummary.cloud.repertoireFiles.totalBytes)}
                            </span>
                          </div>
                          <div className="border-t border-white/5 my-1.5 pt-1.5 flex justify-between items-center font-bold text-stone-300 pl-1">
                            <span className="text-brand-light">{t('settings.totalCloudFiles')}</span>
                            <span className="font-mono text-brand-light">
                              {storageSummary.cloud.total.count}{t('settings.fileUnit')} / {formatBytes(storageSummary.cloud.total.totalBytes)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Local Storage */}
                    <div className="space-y-3 p-3 bg-stone-900/40 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                        <HardDrive size={14} className="text-amber-500" />
                        {t('settings.localStorageTitle')}
                      </div>

                      {isLoadingSummary && !storageSummary ? (
                        <p className="text-xs text-stone-500 animate-pulse py-4 pl-1">{t('common.loading')}</p>
                      ) : storageSummary ? (
                        <div className="space-y-2 text-xs text-stone-400 pl-1">
                          <div className="flex justify-between items-center">
                            <span>{t('settings.localIndexedDbPhotos')}</span>
                            <span className="font-mono text-stone-300">{storageSummary.local.indexedDbPhotos.count}{t('settings.photoUnit')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>{t('settings.localLessons')}</span>
                            <span className="font-mono text-stone-300">{storageSummary.local.localStorageRecords.receivedLessons}{t('settings.fileUnit')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>{t('settings.localStudents')}</span>
                            <span className="font-mono text-stone-300">{storageSummary.local.localStorageRecords.students}{t('settings.fileUnit')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>{t('settings.localRepertoire')}</span>
                            <span className="font-mono text-stone-300">{storageSummary.local.localStorageRecords.repertoire}{t('settings.fileUnit')}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {user && storageSummary && (
                    <div className="space-y-1 bg-stone-900/20 p-2.5 rounded-lg border border-white/5 text-[10px] leading-relaxed text-stone-500">
                      <div className="flex items-start gap-1">
                        <span className="text-amber-500/80 font-bold shrink-0">※</span>
                        <span>{t('settings.legacySizeWarning')}</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-stone-500 shrink-0">※</span>
                        <span className="whitespace-pre-line">{t('settings.orphanFilesNotice')}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t border-white/5">
                  <button 
                    onClick={() => setShowClearLocal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors text-sm font-medium"
                  >
                    <Trash2 size={16} />
                    {t('settings.clearLocalData')}
                  </button>
                  
                  {showClearLocal && (
                    <div className="mt-4 p-4 bg-red-950/20 border border-red-900/30 rounded-xl space-y-3">
                      <p className="text-xs text-red-400/80 font-bold whitespace-pre-line leading-relaxed">
                        {t('settings.clearLocalDataWarning')}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={handleClearLocal} className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors">
                          {t('common.delete')}
                        </button>
                        <button onClick={() => setShowClearLocal(false)} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-medium transition-colors">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <LocalPhotoMigration />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Account Management (Only for signed-in users) */}
      {user && (
        <div className="space-y-2">
          {renderSectionHeader('account', <ShieldAlert size={18} />, t('settings.accountManagement'))}
          <AnimatePresence>
            {activeSection === 'account' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5 space-y-4">
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 rounded-xl border border-red-900/30 transition-colors text-sm font-bold"
                  >
                    <Trash2 size={16} />
                    {t('settings.deleteAccount')}
                  </button>
                  
                  {showDeleteConfirm && (
                    <div className="mt-4 p-4 bg-red-950/20 border border-red-900/50 rounded-xl space-y-4">
                      <div className="flex items-start gap-2 text-red-400">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <p className="text-sm font-bold whitespace-pre-line leading-relaxed">
                          {t('settings.deleteAccountWarning')}
                        </p>
                      </div>
                      
                      <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${deleteChecked ? 'bg-red-600 border-red-600' : 'bg-stone-800 border-stone-600'}`}>
                          {deleteChecked && <Check size={14} className="text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={deleteChecked} onChange={(e) => setDeleteChecked(e.target.checked)} />
                        {t('settings.deleteAccountConfirm')}
                      </label>
                      
                      {deleteError && (
                        <p className="text-xs text-red-400/80 mt-2">{deleteError}</p>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <button 
                          disabled={!deleteChecked || isDeleting}
                          onClick={handleDeleteAccount} 
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        >
                          {isDeleting ? t('common.loading') : t('common.delete')}
                        </button>
                        <button onClick={() => { setShowDeleteConfirm(false); setDeleteChecked(false); setDeleteError(null); }} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-sm font-medium transition-colors">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5 mt-4">
                    <a href="/account-deletion.html" target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                      {t('settings.openPublicAccountDeletion')} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Privacy Policy */}
      <div className="space-y-2">
        {renderSectionHeader('privacy', <ShieldCheck size={18} />, t('settings.privacyPolicy'))}
        <AnimatePresence>
          {activeSection === 'privacy' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5">
                <div className="prose prose-invert prose-sm max-w-none text-stone-400 font-sans leading-relaxed whitespace-pre-line text-xs mb-4">
{`개인정보처리방침

Music In One(Mio)은 음악가의 레슨 기록, 학생 관리, 악보 메모, 튜너 및 메트로놈 사용을 돕기 위한 앱입니다.

1. 수집하는 정보
- Google 로그인 시 이름, 이메일 주소, Firebase 사용자 ID가 사용될 수 있습니다.
- 사용자가 직접 입력한 레슨일지, 학생관리 기록, 악보/레퍼토리 기록이 저장될 수 있습니다.
- 튜너 기능 사용 시 마이크 권한을 요청할 수 있습니다.
- 로그인한 사용자가 학생관리에서 추가한 사진 및 악보함에 추가한 PDF/이미지 파일은 사용자 계정에 연결되어 Firebase Storage에 저장될 수 있습니다. 비로그인 상태에서는 악보 파일 업로드를 사용할 수 없으며, 학생관리 사진은 현재 기기의 로컬 저장소에만 저장됩니다. 계정 삭제 시 악보함에 업로드한 Storage 파일도 삭제 대상에 포함됩니다.

2. 정보 사용 목적
- 사용자별 데이터 저장 및 불러오기
- 레슨일지, 학생관리, 악보함 기능 제공
- 튜너 기능에서 음정 분석 제공
- 앱 기능 유지 및 개선

3. 마이크 사용
튜너 기능은 악기 또는 목소리의 음정을 분석하기 위해 마이크를 사용합니다.
마이크 오디오는 서버로 업로드되지 않으며, 실시간 분석에만 사용됩니다.

4. 사진 저장
로그인한 사용자가 학생관리에서 추가한 사진 및 악보함에 추가한 PDF/이미지 파일은 사용자 계정에 연결되어 Firebase Storage에 저장될 수 있습니다. 비로그인 상태에서는 악보 파일 업로드를 사용할 수 없으며, 학생관리 사진은 현재 기기의 로컬 저장소에만 저장됩니다. 계정 삭제 시 악보함에 업로드한 Storage 파일도 삭제 대상에 포함됩니다.
다른 기기에서는 보이지 않을 수 있으며, 브라우저 데이터 또는 앱 데이터를 삭제하면 사진도 사라질 수 있습니다.

5. 데이터 저장 위치
로그인한 사용자의 레슨일지, 학생관리, 악보함 기록은 Firebase Firestore에 사용자별로 저장될 수 있습니다.
비로그인 상태에서는 일부 데이터가 브라우저 로컬 저장소에 저장될 수 있습니다.

6. 제3자 제공
Music In One은 사용자의 개인 정보를 광고 목적으로 판매하지 않습니다.
Google 로그인 및 Firebase 기능 제공을 위해 Google/Firebase 서비스가 사용될 수 있습니다.

7. 계정 및 데이터 삭제
사용자는 앱 안의 설정 > 계정 관리에서 계정 삭제를 요청하거나 실행할 수 있습니다.
계정 삭제 시 Firebase Authentication 계정과 저장된 사용자 데이터가 삭제될 수 있습니다.

8. 문의
개인정보 관련 문의는 아래 이메일로 연락할 수 있습니다.
${CONTACT_EMAIL}

마지막 업데이트: 2026년 7월`}
                </div>
                <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                    {t('settings.openPublicPrivacyPolicy')} <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contact */}
      <div className="space-y-2">
        {renderSectionHeader('contact', <Mail size={18} />, t('settings.contact'))}
        <AnimatePresence>
          {activeSection === 'contact' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 mx-2 bg-stone-900/30 rounded-xl border border-white/5 space-y-4">
                <p className="text-sm text-stone-400 whitespace-pre-line leading-relaxed">{t('settings.contactDesc')}</p>
                <a 
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors text-sm font-medium"
                >
                  <Mail size={16} />
                  {t('settings.contactByEmail')}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* App Info */}
      <div className="space-y-2">
        {renderSectionHeader('info', <Info size={18} />, t('settings.appInfo'))}
        <AnimatePresence>
          {activeSection === 'info' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 mx-2 bg-stone-900/30 rounded-xl border border-white/5 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-black/40 border border-brand/20">
                  <BrandLogo compact className="text-2xl" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-serif tracking-tight text-stone-200">
                    <BrandLogo />
                  </h3>
                  <p className="text-xs text-brand font-bold uppercase tracking-widest">{t('settings.launchPreparation')}</p>
                </div>
                <p className="text-sm text-stone-400 max-w-xs mx-auto leading-relaxed mt-2">{t('settings.appDescription')}</p>
                <div className="pt-4 border-t border-white/5 w-full flex flex-col gap-1 text-xs text-stone-500 font-mono mt-4">
                  <p>Version {VERSION}</p>
                  <p>Contact: {CONTACT_EMAIL}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
