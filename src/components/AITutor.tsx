import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Loader2, Sparkles, RefreshCw, Copy, Check, Settings2, X, Save, Globe } from 'lucide-react';
import { ChatMessage, MusicTutorProfile, UsageLimits, MajorCategory, AITutorSource } from '../types';
import { getTutorResponse } from '../services/gemini';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const PROFILE_KEY = 'musicianlog_ai_tutor_profile';
const WEB_SEARCH_KEY = 'musicianlog_ai_web_search_enabled';

const majorCategories: Array<{ value: MajorCategory, labelKey: string }> = [
  { value: 'strings', labelKey: 'aiProfile.categories.strings' },
  { value: 'woodwinds', labelKey: 'aiProfile.categories.woodwinds' },
  { value: 'brass', labelKey: 'aiProfile.categories.brass' },
  { value: 'voice', labelKey: 'aiProfile.categories.voice' },
  { value: 'keyboard', labelKey: 'aiProfile.categories.keyboard' },
  { value: 'percussion', labelKey: 'aiProfile.categories.percussion' },
  { value: 'conducting', labelKey: 'aiProfile.categories.conducting' },
  { value: 'composition-theory', labelKey: 'aiProfile.categories.compositionTheory' },
  { value: 'korean-traditional', labelKey: 'aiProfile.categories.koreanTraditional' },
  { value: 'other', labelKey: 'aiProfile.categories.other' }
];

const specialtiesMap: Record<string, string[]> = {
  strings: ['violin', 'viola', 'cello', 'double-bass', 'harp', 'classical-guitar', 'other-strings'],
  woodwinds: ['flute', 'oboe', 'clarinet', 'bassoon', 'saxophone', 'recorder', 'other-woodwinds'],
  brass: ['horn', 'trumpet', 'trombone', 'tuba', 'euphonium', 'other-brass'],
  voice: ['soprano', 'mezzo-soprano', 'contralto', 'countertenor', 'tenor', 'baritone', 'bass-baritone', 'bass', 'voice-type-undecided', 'other-voice'],
  keyboard: ['piano', 'organ', 'harpsichord', 'accordion', 'accompaniment', 'other-keyboard'],
  percussion: ['orchestral-percussion', 'timpani', 'mallet', 'snare-drum', 'drum-set', 'other-percussion'],
  conducting: ['orchestra-conducting', 'choral-conducting', 'opera-conducting', 'wind-conducting', 'other-conducting'],
  'composition-theory': ['composition', 'electronic-music', 'harmony', 'counterpoint', 'form-analysis', 'orchestration', 'music-theory', 'musicology', 'music-education', 'other-composition-theory'],
  'korean-traditional': ['gayageum', 'geomungo', 'haegeum', 'ajaeng', 'daegeum', 'sogeum', 'piri', 'taepyeongso', 'korean-percussion', 'pansori', 'jeongga', 'korean-folk-song', 'korean-composition', 'other-korean-traditional'],
  other: ['jazz', 'applied-music', 'musical-theatre', 'audio-recording', 'other']
};

export default function AITutor() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<MusicTutorProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.category !== undefined) {
          return parsed;
        } else {
          // Migration logic
          const newProfile: MusicTutorProfile = { category: '', specialty: '' };
          const oldInst = String(parsed.instrument || '').toLowerCase();
          const oldMajor = String(parsed.major || '').toLowerCase();
          
          const checkMap = (val: string) => {
             for (const [cat, specs] of Object.entries(specialtiesMap)) {
               if (specs.includes(val)) return { category: cat, specialty: val };
             }
             return null;
          };
          
          let res = checkMap(oldInst) || checkMap(oldMajor);
          if (res) {
            newProfile.category = res.category as MajorCategory;
            newProfile.specialty = res.specialty;
          } else {
            // fallback heuristic mapping
            if (oldInst.includes('soprano')) { newProfile.category = 'voice'; newProfile.specialty = 'soprano'; }
            else if (oldInst.includes('tenor')) { newProfile.category = 'voice'; newProfile.specialty = 'tenor'; }
            else if (oldInst.includes('baritone')) { newProfile.category = 'voice'; newProfile.specialty = 'baritone'; }
            else if (oldInst.includes('flute')) { newProfile.category = 'woodwinds'; newProfile.specialty = 'flute'; }
            else if (oldInst.includes('cello')) { newProfile.category = 'strings'; newProfile.specialty = 'cello'; }
            else if (oldInst.includes('violin')) { newProfile.category = 'strings'; newProfile.specialty = 'violin'; }
            else if (oldInst.includes('piano')) { newProfile.category = 'keyboard'; newProfile.specialty = 'piano'; }
            else if (oldInst.includes('trumpet')) { newProfile.category = 'brass'; newProfile.specialty = 'trumpet'; }
          }
          
          return newProfile;
        }
      }
      return { category: '', specialty: '' };
    } catch {
      return { category: '', specialty: '' };
    }
  });
  const [showProfile, setShowProfile] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(() => {
    return localStorage.getItem(WEB_SEARCH_KEY) === 'true';
  });
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);

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

  const handleWebSearchToggle = () => {
    const newVal = !webSearchEnabled;
    setWebSearchEnabled(newVal);
    localStorage.setItem(WEB_SEARCH_KEY, String(newVal));
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
      // Generate a unique requestId for idempotency
      const requestId = crypto.randomUUID();
      const apiProfile = {
        majorCategory: profile.category,
        instrument: profile.specialty
      };
      const response = await getTutorResponse([...messages, userMessage], language, token, requestId, webSearchEnabled, apiProfile);
      
      if (response.usage) {
        setUsageLimits(response.usage);
      }

      if (response.error) {
        let errorMsg = t('tutor.error');
        if (response.errorCode === 'USER_DAILY_LIMIT') errorMsg = t('tutor.limitReached');
        else if (response.errorCode === 'GLOBAL_DAILY_LIMIT' || response.errorCode === 'GLOBAL_MONTHLY_LIMIT') errorMsg = t('tutor.globalLimitReached');
        else if (response.errorCode === 'COOLDOWN_ACTIVE' || response.errorCode === 'DUPLICATE_REQUEST') errorMsg = t('tutor.tooFast');
        else if (response.errorCode === 'TIMEOUT') errorMsg = response.error; // Already translated in node
        else if (response.error === 'auth_error') errorMsg = "사용자 인증에 실패했습니다. 다시 로그인해주세요.";
        else if (response.error === 'quota_error' || response.errorCode === 'QUOTA_EXCEEDED') errorMsg = "현재 AI 튜터의 무료 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.";
        else if (response.error === 'length_error') errorMsg = "질문이 너무 깁니다. 4,000자 이내로 줄여주세요.";
        else if (response.error === 'admin_error') errorMsg = "사용자 인증 서버 설정이 완료되지 않았습니다.";
        else if (response.error === 'gemini_error') errorMsg = "AI 튜터 서버 설정이 완료되지 않았습니다.";
        else if (response.errorCode === 'MAINTENANCE') errorMsg = response.error;
        
        setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: response.answer,
          grounded: response.grounded,
          sources: response.sources,
          warning: response.warning,
          webSearchUsed: response.webSearchUsed
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

  const renderSourceTypeBadge = (source: AITutorSource) => {
    if (source.provider === 'google-search') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-sm">
          <Globe size={10} /> WEB
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-brand/10 text-brand rounded-sm">
        <Bot size={10} /> DOC
      </span>
    );
  };

  const getProfileLabel = () => {
    if (!profile.category || !profile.specialty) return null;
    const catConf = majorCategories.find(c => c.value === profile.category);
    if (!catConf) return null;
    const catLabel = (t('aiProfile' as any) as any)?.categories?.[catConf.labelKey.split('.')[2]] || '';
    const specLabel = (t('aiProfile' as any) as any)?.specialties?.[profile.specialty] || '';
    return `${catLabel} > ${specLabel}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-280px)] md:h-[600px] bg-bg-card border border-white/5 rounded-[40px] overflow-hidden relative"
    >
      <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Cello Sensei</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                AI Consultant {getProfileLabel() ? `• ${t('tutor.currentProfile')}: ${getProfileLabel()}` : ''}
              </p>
              {usageLimits && (
                <span className="text-[10px] text-brand/80 font-bold tracking-widest bg-brand/5 px-2 py-0.5 rounded-full border border-brand/10">
                  {t('tutor.questionsRemaining')} : {usageLimits.remaining}
                </span>
              )}
            </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{t('tutor.major')}</label>
                  <select
                    value={profile.category}
                    onChange={(e) => {
                      setProfile({ category: e.target.value as MajorCategory, specialty: '' });
                    }}
                    className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40"
                  >
                    <option value="">{t('tutor.categoryPlaceholder')}</option>
                    {majorCategories.map((c) => {
                      const keys = c.labelKey.split('.');
                      const label = (t('aiProfile' as any) as any)?.categories?.[keys[2]] || '';
                      return (
                        <option key={c.value} value={c.value}>{label}</option>
                      );
                    })}
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                    {profile.category === 'voice' 
                      ? (language === 'ko' ? '성종' : language === 'de' ? 'Stimmfach' : 'Voice Type') 
                      : t('tutor.instrument')}
                  </label>
                  <select
                    value={profile.specialty}
                    disabled={!profile.category}
                    onChange={(e) => {
                      setProfile({ ...profile, specialty: e.target.value });
                    }}
                    className="bg-stone-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{t('tutor.specialtyPlaceholder')}</option>
                    {profile.category && specialtiesMap[profile.category]?.map((s) => {
                      const label = (t('aiProfile' as any) as any)?.specialties?.[s] || s;
                      return (
                        <option key={s} value={s}>{label}</option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Web Search Toggle */}
              <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-stone-200">{t('tutor.useWebSearch')}</span>
                  <span className="text-[10px] text-stone-500">{t('tutor.useWebSearchDesc')}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={webSearchEnabled}
                  onClick={handleWebSearchToggle}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    webSearchEnabled ? 'bg-brand' : 'bg-stone-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      webSearchEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
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
                  disabled={!!profile.category && !profile.specialty}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Sparkles size={12} className={m.grounded ? "text-brand" : "text-stone-500"} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${m.grounded ? "text-brand" : "text-stone-500"}`}>
                        {m.grounded ? t('tutor.groundedBadge') : t('tutor.generalBadge')}
                      </span>
                      {m.webSearchUsed && (
                        <>
                          <span className="text-stone-600 px-1">•</span>
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm uppercase tracking-widest">
                            {t('tutor.webSearchUsed')}
                          </span>
                        </>
                      )}
                    </div>
                    {m.grounded && m.sources && m.sources.length > 0 && (
                      <div className="bg-stone-900 rounded-xl p-3 border border-white/5">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1 flex justify-between">
                          {t('tutor.references')}
                        </div>
                        <ul className="space-y-3">
                          {m.sources.map((src, idx) => (
                            <li key={idx} className="text-xs">
                              <div className="flex items-start gap-1">
                                {renderSourceTypeBadge(src)}
                                <span className="text-stone-200 font-medium ml-1">[{idx + 1}] {src.title}</span>
                              </div>
                              <div className="text-[10px] text-stone-500 mt-1 pl-1">
                                {[src.author, src.organization, src.year].filter(Boolean).join(' · ')}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 pl-1">
                                {src.pageNumber && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-stone-800 rounded text-stone-400">
                                    {t('tutor.page')} {src.pageNumber}
                                  </span>
                                )}
                                {src.timestamp && (
                                  <span className="text-[9px] text-stone-500">
                                    {new Date(src.timestamp).toLocaleString()}
                                  </span>
                                )}
                                {src.url && (
                                  <a 
                                    href={src.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-brand hover:underline flex grid-flow-col items-center gap-1"
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
