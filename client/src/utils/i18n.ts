// i18n configuration and utilities
// Supports Arabic and English with RTL/LTR switching

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

export interface LanguageConfig {
  code: Language;
  name: string;
  direction: Direction;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Record<Language, LanguageConfig> = {
  ar: {
    code: 'ar',
    name: 'العربية',
    direction: 'rtl',
    flag: '🇸🇦',
  },
  en: {
    code: 'en',
    name: 'English',
    direction: 'ltr',
    flag: '🇬🇧',
  },
};

export const DEFAULT_LANGUAGE: Language = 'ar';

// Get language from localStorage or system
export function detectLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // Check localStorage
  const stored = localStorage.getItem('app-language');
  if (stored && (stored === 'ar' || stored === 'en')) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'ar') return 'ar';
  if (browserLang === 'en') return 'en';

  return DEFAULT_LANGUAGE;
}

// Set language globally
export function setLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('app-language', lang);
  
  // Set HTML direction
  const html = document.documentElement;
  const config = SUPPORTED_LANGUAGES[lang];
  html.lang = lang;
  html.dir = config.direction;
  
  // Set RTL/LTR CSS class
  html.classList.remove('rtl', 'ltr');
  html.classList.add(config.direction);
  
  // Dispatch custom event for listeners
  window.dispatchEvent(
    new CustomEvent('languagechange', { detail: { lang, direction: config.direction } })
  );
}

// Format date based on language
export function formatDate(date: Date | string, lang: Language): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', options).format(d);
}

// Format number based on language
export function formatNumber(num: number, lang: Language, decimals: number = 2): string {
  const locales = lang === 'ar' ? 'ar-SA' : 'en-US';
  return new Intl.NumberFormat(locales, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

// Format currency based on language
export function formatCurrency(amount: number, lang: Language, currency: string = 'USD'): string {
  const locales = lang === 'ar' ? 'ar-SA' : 'en-US';
  return new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
