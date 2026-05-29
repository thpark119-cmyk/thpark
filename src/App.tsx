import React, { useState, lazy, Suspense } from 'react';
import { Music, LayoutGrid, BookOpen, Users, FileMusic, Sparkles, LogIn, LogOut, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { signInWithGoogle, logout } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load components for performance optimization
const Dashboard = lazy(() => import('./components/Dashboard'));
const MyLessons = lazy(() => import('./components/MyLessons'));
const TeachingStudio = lazy(() => import('./components/TeachingStudio'));
const Repertoire = lazy(() => import('./components/Repertoire'));
const AITutor = lazy(() => import('./components/AITutor'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// Reusable Loading Spinner for Suspense
const LoadingView = () => (
  <div className="flex flex-col items-center justify-center p-12 space-y-4">
    <Loader2 className="text-brand animate-spin" size={32} />
    <span className="text-[10px] text-stone-600 uppercase font-bold tracking-widest">데이터 불러오는 중...</span>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, loading, error } = useAuth();

  const isAdmin = user?.email === 'thpark119@gmail.com';

  const navItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutGrid },
    { id: 'mylessons', label: '학습 일지', icon: BookOpen },
    { id: 'repertoire', label: '악보함', icon: FileMusic },
    { id: 'studio', label: '학생 관리', icon: Users },
    { id: 'tutor', label: 'AI 튜터', icon: Sparkles }
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: '관리자', icon: ShieldCheck });
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
    <div className="min-h-screen bg-[#0F0D0C] text-stone-200 font-sans selection:bg-brand/30 pb-16">
      {/* Background ambient glows optimized for wide desktop layout */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        {/* Desktop PC Nav Header Layout */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/[0.05] pb-6 mb-10 sticky top-0 py-4 bg-bg-deep/90 backdrop-blur-md z-40 rounded-b-3xl px-2">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setActiveTab('dashboard')}>
             <div className="bg-brand h-10 w-10 rounded-2xl text-white shadow-xl shadow-brand/20 flex items-center justify-center">
               <Music size={20} />
             </div>
             <h1 className="text-2xl font-bold tracking-tight serif italic text-white">MusicianLog</h1>
          </div>
          
          {/* Top Integrated Desktop Navbar */}
          <nav className="flex items-center gap-1 bg-stone-900/60 p-1.5 rounded-2xl border border-white/[0.03] shadow-lg shadow-black/40">
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
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="flex items-center gap-2 text-stone-500 font-mono text-[10px] bg-white/[0.01] border border-white/5 px-4 py-2 rounded-xl">
                <Loader2 size={12} className="animate-spin text-brand" />
                <span>데이터 동기화...</span>
              </div>
            ) : user ? (
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 py-1.5 pl-3 pr-2.5 rounded-2xl shadow-xl shadow-black/10">
                <div className="text-right">
                  <p className="text-xs font-bold text-stone-200">{user.displayName || '뮤지션'}</p>
                  <p className="text-[9px] text-stone-500 font-mono truncate max-w-[110px]">{user.email}</p>
                </div>
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 ring-2 ring-white/5 bg-stone-900 shrink-0">
                   <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <button 
                  onClick={logout}
                  className="p-2 text-stone-500 hover:text-red-400 transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="bg-white text-stone-950 px-5 h-11 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-xl shadow-white/5 hover:bg-stone-100 active:scale-[0.98] transition-all"
              >
                <LogIn size={14} />
                Google로 로그인
              </button>
            )}
          </div>
        </header>

        {/* Global guest state banner advising that data is saved locally to browser */}
        {!loading && !user && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-brand/5 border border-brand/10 rounded-2xl flex items-center gap-3 text-stone-300"
          >
            <Sparkles size={16} className="text-brand shrink-0 animate-pulse" />
            <span className="text-xs leading-relaxed">
              <strong>게스트 모드:</strong> 로그인하지 않은 상태입니다. 작성하신 기록은 브라우저 쿠키/LocalStorage에 안전하게 저장되나, 브라우저가 변경되거나 캐시가 삭제되면 소실될 수 있습니다. 데이터를 클라우드와 안전하게 동기화하시려면 우측 상단에서 <strong>로그인</strong>을 진행해 주세요.
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
                {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
                {activeTab === 'mylessons' && <MyLessons />}
                {activeTab === 'repertoire' && <Repertoire />}
                {activeTab === 'studio' && <TeachingStudio />}
                {activeTab === 'tutor' && <AITutor />}
                {activeTab === 'admin' && isAdmin && <AdminPanel />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
