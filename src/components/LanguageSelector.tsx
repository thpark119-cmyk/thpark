import React, { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../i18n/translations';

const LANGUAGE_LABELS: Record<Language, string> = {
  ko: '한국어',
  en: 'English',
  de: 'Deutsch',
};

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const ariaLabels: Record<Language, string> = {
    ko: '언어 선택',
    en: 'Select language',
    de: 'Sprache auswählen'
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-stone-400 hover:text-stone-200 transition-colors rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 flex items-center justify-center"
        aria-label={ariaLabels[language] || 'Select language'}
        title={ariaLabels[language]}
      >
        <Globe size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-stone-900 border border-white/10 rounded-2xl shadow-xl shadow-black/50 overflow-hidden z-50">
          {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => {
                setLanguage(code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2
                ${language === code ? 'text-brand bg-brand/5 font-semibold' : 'text-stone-300 hover:bg-white/5'}`}
            >
              <span className="w-4 flex justify-center">
                {language === code && '✓'}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
