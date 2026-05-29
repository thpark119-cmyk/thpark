import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import { getTutorResponse } from '../services/gemini';

export default function AITutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: '안녕하세요! 당신의 첼로 튜터 Cello Sensei입니다. 활 쓰기(Bowing) 테크닉이나 악보 해석에 대해 자유롭게 물어보세요.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await getTutorResponse([...messages, userMessage]);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-280px)] md:h-[600px] bg-bg-card border border-white/5 rounded-[40px] overflow-hidden"
    >
      <header className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
          <Bot size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Cello Sensei</h2>
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">AI Consultant</p>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              m.role === 'user' 
                ? 'bg-stone-800 border-white/5 text-stone-500' 
                : 'bg-brand/10 border-brand/20 text-brand'
            }`}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-stone-900 text-stone-300 rounded-tr-none' 
                : 'bg-stone-800/20 text-stone-200 rounded-tl-none font-serif italic border border-white/5'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
               <Bot size={16} />
             </div>
             <div className="bg-stone-800/20 p-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
               <Loader2 size={14} className="animate-spin text-brand" />
               <span className="text-[10px] italic text-stone-500 font-serif font-bold uppercase tracking-widest">Sensei is thinking...</span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-stone-900/50">
        <div className="relative">
          <input
            className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm outline-none focus:border-brand/40 transition-colors"
            placeholder="조언이 필요한 내용을 입력하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 disabled:opacity-30 transition-all active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
