import { ar } from "./ar";
import { en } from "./en";

export type TranslationMessages = typeof ar;

export const translations = {
  ar,
  en,
} as const;

export type Language = keyof typeof translations;

export const getTranslations = (language: Language): TranslationMessages => {
  return translations[language] || translations.en;
};
