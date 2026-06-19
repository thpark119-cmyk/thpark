import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Loader2, Sparkles, RefreshCw, Copy, Check, Settings2, X, Save } from 'lucide-react';
import { ChatMessage, MusicTutorProfile } from '../types';
import { getTutorResponse } from '../services/gemini';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const PROFILE_KEY = 'musicianlog_ai_tutor_profile';

export default function AITutor() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<MusicTutorProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showProfile, setShowProfile] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: t('tutor.greeting') }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSaveProfile = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setShowProfile(false);
  };

  const handleResetProfile = () => {
    setProfile({});
    localStorage.removeItem(PROFILE_KEY);
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!user) {
      setMessages(prev => [...prev, { role: 'model', content: t('tutor.loginRequired') }]);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await user.getIdToken();
      const response = await getTutorResponse([...messages, userMessage], language, token, profile);
      
      if (response.error) {
        let errorMsg = t('tutor.error');
        if (response.error === 'auth_error') errorMsg = "사용자 인증에 실패했습니다. 다시 로그인해주세요.";
        if (response.error === 'quota_error') errorMsg = "현재 AI 튜터의 무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.";
        if (response.error === 'length_error') errorMsg = "질문이 너무 깁니다. 4,000자 이내로 줄여주세요.";
        if (response.error === 'admin_error') errorMsg = "사용자 인증 서버 설정이 완료되지 않았습니다.";
        if (response.error === 'gemini_error') errorMsg = "AI 튜터 서버 설정이 완료되지 않았습니다.";
        setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: response.answer,
          grounded: response.grounded,
          sources: response.sources,
          warning: response.warning
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: "AI 튜터에 일시적인 문제가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setMessages([{ role: 'model', content: t('tutor.greeting') }]);
    setInput('');
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-280px)] md:h-[600px] bg-bg-card border border-white/5 rounded-[40px] overflow-hidden relative"
    >
      <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Cello Sensei</h2>
            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">AI Consultant</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${
              showProfile ? 'bg-brand/20 border-brand/30 text-brand' : 'text-stone-400 hover:text-white bg-stone-800/50 hover:bg-stone-800 border-white/5'
            }`}
          >
            <Settings2 size={14} />
            {t('tutor.profileSettings')}
          </button>
          <button 
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 text-stone-400 hover:text-white bg-stone-800/50 hover:bg-stone-800 px-3 py-1.5 rounded-lg border border-white/5 transition-colors text-xs font-medium"
          >
            <RefreshCw size={14} />
            {t('tutor.newConversation')}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/5 bg-stone-900/50 overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">{t('tutor.profileSettings')}</h3>
                <button onClick={() => setShowProfile(false)} className="text-stone-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input 
                  placeholder={t('tutor.instrument')}
                  value={profile.instrument || ''}
                  onChange={e => setProfile({...profile, instrument: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.major')}
                  value={profile.major || ''}
                  onChange={e => setProfile({...profile, major: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.level')}
                  value={profile.level || ''}
                  onChange={e => setProfile({...profile, level: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.composer')}
                  value={profile.composer || ''}
                  onChange={e => setProfile({...profile, composer: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.work')}
                  value={profile.work || ''}
                  onChange={e => setProfile({...profile, work: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.era')}
                  value={profile.era || ''}
                  onChange={e => setProfile({...profile, era: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                />
                <input 
                  placeholder={t('tutor.currentIssue')}
                  value={profile.currentIssue || ''}
                  onChange={e => setProfile({...profile, currentIssue: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40 col-span-2"
                />
                <input 
                  placeholder={t('tutor.goal')}
                  value={profile.goal || ''}
                  onChange={e => setProfile({...profile, goal: e.target.value})}
                  className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40 col-span-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={handleResetProfile}
                  className="px-4 py-2 rounded-xl border border-white/5 text-xs text-stone-400 hover:text-white hover:bg-stone-800 font-medium transition-colors"
                >
                  {t('tutor.resetProfile')}
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
                >
                  <Save size={14} />
                  {t('tutor.saveProfile')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        <div className="flex justify-center mb-6">
           <span className="text-[10px] text-stone-500 bg-stone-800/50 px-3 py-1 rounded-full border border-white/5 tracking-wider">
             {t('tutor.generalAnswerNotice')}
           </span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              m.role === 'user' 
                ? 'bg-stone-800 border-white/5 text-stone-500' 
                : 'bg-brand/10 border-brand/20 text-brand'
            }`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' 
                  ? 'bg-stone-800 text-stone-200 rounded-tr-none' 
                  : 'bg-stone-900/80 text-stone-300 rounded-tl-none border border-white/5'
              }`}>
                {m.content}
                
                {m.role === 'model' && i > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={12} className={m.grounded ? "text-brand" : "text-stone-500"} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${m.grounded ? "text-brand" : "text-stone-500"}`}>
                        {m.grounded ? t('tutor.groundedBadge') : t('tutor.generalBadge')}
                      </span>
                    </div>
                    {m.grounded && m.sources && m.sources.length > 0 && (
                      <div className="bg-stone-900 rounded-xl p-3 border border-white/5">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">
                          {t('tutor.references')}
                        </div>
                        <ul className="space-y-2">
                          {m.sources.map((src, idx) => (
                            <li key={idx} className="text-xs">
                              <span className="text-stone-200 font-medium">[{idx + 1}] {src.title}</span>
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                {[src.author, src.organization, src.year].filter(Boolean).join(' · ')}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {src.pageNumber && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">
                                    {t('tutor.page')} {src.pageNumber}
                                  </span>
                                )}
                                {src.url && (
                                  <a 
                                    href={src.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-brand hover:underline"
                                  >
                                    {t('tutor.viewSource')}
                                  </a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!m.grounded && (
                       <p className="text-[10px] text-stone-500 italic">
                         {m.warning === 'fallback' ? t('tutor.fallbackNotice') : t('tutor.noSourcePlaceholder')}
                       </p>
                    )}
                  </div>
                )}
              </div>
              {m.role === 'model' && (
                <button 
                  onClick={() => handleCopy(m.content, i)}
                  className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-300 transition-colors uppercase font-bold tracking-widest pl-2"
                >
                  {copiedIndex === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedIndex === i ? t('tutor.copied') : t('tutor.copyAnswer')}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
               <Loader2 size={14} className="animate-spin" />
             </div>
             <div className="bg-stone-900/80 p-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
               <span className="text-[10px] italic text-stone-500 font-serif font-bold uppercase tracking-widest">{t('tutor.thinking')}</span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-stone-900/50">
        {!user && (
          <div className="mb-2 text-center">
            <span className="text-xs text-brand font-medium tracking-wide">
              {t('tutor.loginRequired')}
            </span>
          </div>
        )}
        {user && messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {[t('tutor.quickQ1'), t('tutor.quickQ2'), t('tutor.quickQ3'), t('tutor.quickQ4')].map((q, i) => (
              <button
                key={i}
                onClick={() => handleQuickQuestion(q)}
                className="px-3 py-1.5 rounded-full bg-stone-800 border border-white/5 text-[10px] text-stone-300 hover:text-white hover:border-brand/40 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm outline-none focus:border-brand/40 transition-colors resize-none placeholder:text-stone-600 disabled:opacity-50"
            placeholder={user ? t('tutor.placeholder') : t('tutor.loginRequired')}
            value={input}
            rows={2}
            disabled={!user || isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !user}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 disabled:opacity-30 transition-all active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-[10px] text-stone-600 mt-2">
          Shift + Enter for new line • Enter to send
        </p>
      </div>
    </motion.div>
  );
}
