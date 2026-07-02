import React, { useState, lazy, Suspense } from 'react';
import { Music, LayoutGrid, BookOpen, Users, FileMusic, Sparkles, LogIn, LogOut, Loader2, ShieldCheck, AlertTriangle, Clock, Mic, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { signInWithGoogle, logout } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './components/BrandLogo';

// Lazy load components for performance optimization
const Dashboard = lazy(() => import('./components/Dashboard'));
const MyLessons = lazy(() => import('./components/MyLessons'));
const TeachingStudio = lazy(() => import('./components/TeachingStudio'));
const Repertoire = lazy(() => import('./components/Repertoire'));
const Metronome = lazy(() => import('./components/Metronome'));
const Tuner = lazy(() => import('./components/Tuner'));
const AITutor = lazy(() => import('./components/AITutor'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Settings = lazy(() => import('./components/Settings'));

// Reusable Loading Spinner for Suspense
const LoadingView = () => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="text-brand animate-spin" size={32} />
      <span className="text-[10px] text-stone-600 uppercase font-bold tracking-widest">{t('common.loading')}</span>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { user, loading, error } = useAuth();
  const { t } = useLanguage();

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login failed error:", err);
      let errorMsg = err?.message || String(err);
      if (err?.code === 'auth/popup-closed-by-user') {
        errorMsg = '구글 로그인 창이 사용자에 의해 닫혔습니다. 로그인을 완료하려면 로그인 창에서 계정을 선택해 주세요.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        errorMsg = '이 도메인은 Firebase 승인 도메인(Authorized Domains)에 지정되지 않았습니다. Firebase 콘솔 -> Authentication -> Settings에서 이 프리뷰 및 배포용 도메인을 Authorized Domains에 추가해 주셔야 합니다.';
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Firebase 프로젝트에서 Google 로그인 공급업체(Provider)가 활성화되어 있지 않습니다. Firebase 콘솔 -> Authentication -> Sign-in Method에서 Google 로그인을 사용 설정(Enable)해 주세요.';
      } else if (err?.code === 'auth/popup-blocked') {
        errorMsg = '브라우저 팝업 차단 기능에 의해 로그인 창이 열리지 않았습니다. 브라우저 주소창 우측에서 팝업을 허용해 주시고 다시 시도해 주세요.';
      } else {
        errorMsg = 'Google 로그인에 실패했습니다. 다시 시도해주세요.';
      }
      setLoginError(errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isAdmin = user?.email === 'thpark119@gmail.com';

  const navItems = [
    { id: 'dashboard', label: t('navigation.dashboard'), icon: LayoutGrid },
    { id: 'mylessons', label: t('navigation.receivedLessons'), icon: BookOpen },
    { id: 'repertoire', label: t('navigation.repertoire'), icon: FileMusic },
    { id: 'studio', label: t('navigation.teachingStudio'), icon: Users },
    { id: 'metronome', label: t('navigation.metronome'), icon: Clock },
    { id: 'tuner', label: t('navigation.tuner'), icon: Mic },
    { id: 'settings', label: t('navigation.settings'), icon: SettingsIcon }
  ];

  if (isAdmin) {
    navItems.push({ id: 'tutor', label: t('navigation.tutor'), icon: Sparkles });
    navItems.push({ id: 'admin', label: t('app.developer'), icon: ShieldCheck });
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[32px] flex items-center justify-center">
          <AlertTriangle size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-serif italic text-white">서버 연결이 원활하지 않습니다</h3>
          <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
            네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요. <span className="block text-[10px] text-stone-700 mt-2">Error: {error.message || String(error)}</span>
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-8 py-4 bg-white text-black font-bold rounded-2xl active:scale-95 transition-all shadow-xl"
        >
          페이지 새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0D0C] text-stone-200 font-sans selection:bg-brand/30 pb-24 md:pb-16">
      {/* Background ambient glows optimized for wide desktop layout */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        {/* Desktop PC Nav Header Layout */}
        <header className="flex flex-row justify-between items-center gap-4 border-b border-white/[0.05] pb-4 md:pb-6 mb-6 md:mb-10 sticky top-0 py-2 md:py-4 bg-bg-deep/90 backdrop-blur-md z-40 rounded-b-3xl px-2">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer select-none" onClick={() => setActiveTab('dashboard')}>
             <div className="bg-brand h-8 w-8 md:h-10 md:w-10 rounded-xl md:rounded-2xl text-white shadow-xl shadow-brand/20 flex items-center justify-center shrink-0">
               <Music size={18} className="md:w-5 md:h-5" />
             </div>
             
             {/* Desktop Full Logo */}
             <h1 className="text-xl md:text-2xl font-bold tracking-tight serif text-white hidden md:block">
               <BrandLogo />
             </h1>
             
             {/* Mobile Compact Logo */}
             <h1 className="text-lg font-bold tracking-tight serif text-white md:hidden">
               <BrandLogo compact />
             </h1>
          </div>
          
          {/* Top Integrated Desktop Navbar */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-900/60 p-1.5 rounded-2xl border border-white/[0.03] shadow-lg shadow-black/40">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all relative text-xs font-semibold ${
                    isActive ? 'text-brand' : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="desktop-nav-pill"
                      className="absolute inset-0 bg-brand/5 rounded-xl border border-brand/10 -z-10"
                      transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                    />
                  )}
                  <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Auth State Panel */}
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSelector />
            {loading ? (
              <div className="flex items-center gap-2 text-stone-500 font-mono text-[10px] bg-white/[0.01] border border-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl">
                <Loader2 size={12} className="animate-spin text-brand" />
                <span className="hidden sm:inline">{t('app.syncing')}</span>
              </div>
            ) : user ? (
              <div className="flex items-center gap-2 md:gap-3 bg-white/[0.02] border border-white/5 py-1.5 pl-2 pr-1 md:pl-3 md:pr-2.5 rounded-xl md:rounded-2xl shadow-xl shadow-black/10">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-stone-200">{user.displayName || '뮤지션'}</p>
                  <p className="text-[9px] text-stone-500 font-mono truncate max-w-[110px]">{user.email}</p>
                </div>
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl overflow-hidden border border-white/10 ring-2 ring-white/5 bg-stone-900 shrink-0">
                   <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <button 
                  onClick={logout}
                  className="p-1.5 md:p-2 text-stone-500 hover:text-red-400 transition-colors"
                  title={t('app.logout')}
                >
                  <LogOut size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="bg-white text-stone-950 px-3 md:px-5 h-9 md:h-11 text-[11px] md:text-xs font-bold rounded-xl md:rounded-2xl flex items-center gap-1.5 md:gap-2 shadow-xl shadow-white/5 hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
              >
                {isLoggingIn ? (
                  <Loader2 size={14} className="animate-spin text-stone-600" />
                ) : (
                  <LogIn size={14} />
                )}
                <span className="hidden sm:inline">{isLoggingIn ? t('app.loggingIn') : t('app.login')}</span>
                <span className="sm:hidden">{t('app.login')}</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Login Error Help Banner */}
        {loginError && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-5 bg-red-950/20 border border-red-800/45 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start text-stone-200"
          >
            <div className="space-y-2 flex-grow">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle size={16} />
                <span>{t('error.loginError')}</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans">{loginError}</p>
            </div>
            <button 
              onClick={() => setLoginError(null)}
              className="px-4 py-2 text-xs bg-white/10 hover:bg-white/20 text-stone-300 rounded-xl transition-colors font-medium shrink-0 self-end md:self-start"
            >
              {t('error.confirm')}
            </button>
          </motion.div>
        )}

        {/* Global guest state banner advising that data is saved locally to browser */}
        {!loading && !user && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-brand/5 border border-brand/10 rounded-2xl flex items-center gap-3 text-stone-300"
          >
            <Sparkles size={16} className="text-brand shrink-0 animate-pulse" />
            <span className="text-xs leading-relaxed">
              {t('app.guestMode')}
            </span>
          </motion.div>
        )}

        {/* Main Content Area */}
        <main className="transition-all duration-300 min-h-[60vh]">
          <Suspense fallback={<LoadingView />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} setTargetLessonId={setTargetLessonId} user={user} />}
                {activeTab === 'mylessons' && <MyLessons targetLessonId={targetLessonId} setTargetLessonId={setTargetLessonId} />}
                {activeTab === 'repertoire' && <Repertoire />}
                {activeTab === 'studio' && <TeachingStudio />}
                {activeTab === 'metronome' && <Metronome />}
                {activeTab === 'tuner' && <Tuner />}
                {activeTab === 'settings' && <Settings />}
                {activeTab === 'tutor' && (isAdmin ? <AITutor /> : <Dashboard setActiveTab={setActiveTab} setTargetLessonId={setTargetLessonId} user={user} />)}
                {activeTab === 'admin' && isAdmin && <AdminPanel />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-stone-950/90 backdrop-blur-xl border-t border-white/5 z-50 overflow-x-auto no-scrollbar"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-start sm:justify-around px-2 py-2 min-w-max">
          {navItems.filter(item => item.id !== 'admin').map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 ${
                  isActive ? 'text-brand' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-brand/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[9px] font-bold tracking-tight line-clamp-1 truncate w-full text-center">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
