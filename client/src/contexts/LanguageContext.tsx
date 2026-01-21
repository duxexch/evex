import React, { createContext, useState, useContext, useEffect } from "react";
import { Language, DEFAULT_LANGUAGE, detectLanguage, setLanguage as setLanguageGlobal } from "../utils/i18n";
import { getTranslations, TranslationMessages } from "./translations";

type MessageKey = keyof TranslationMessages;

interface LanguageContextType {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  t: (key: MessageKey, defaultValue?: string) => string;
  messages: Record<string, any>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLanguage,
}) => {
  const [language, setLanguageState] = useState<Language>(
    initialLanguage || DEFAULT_LANGUAGE
  );

  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const messages = getTranslations(language);

  // Initialize language on mount
  useEffect(() => {
    const detected = detectLanguage();
    if (detected !== language) {
      setLanguageState(detected);
    }
    setLanguageGlobal(detected);
  }, []);

  // Apply language changes to DOM
  useEffect(() => {
    setLanguageGlobal(language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: MessageKey, defaultValue?: string): string => {
    const value = messages[key];
    if (typeof value === 'string') {
      return value;
    }
    return defaultValue || key;
  };

  const value: LanguageContextType = {
    language,
    direction,
    setLanguage,
    t,
    messages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
