import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Language, translations } from '../i18n/translations';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'musicianlog_language';

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY) as Language;
  if (stored && (stored === 'ko' || stored === 'en' || stored === 'de')) {
    return stored;
  }
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('en')) return 'en';
  return 'ko';
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let result: any = translations[language];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = undefined;
        break;
      }
    }

    if (result !== undefined) {
      return typeof result === 'string' ? result : key;
    }

    // Fallback to 'ko' if key is missing in the target language
    let fallback: any = translations['ko'];
    for (const k of keys) {
      if (fallback && typeof fallback === 'object' && k in fallback) {
        fallback = fallback[k];
      } else {
        return key; // return key itself if not found anywhere
      }
    }
    return typeof fallback === 'string' ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
