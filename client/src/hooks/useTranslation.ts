import { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  formatTime,
  formatPercentage,
  formatBytes,
  formatList,
  formatPlural,
  sortStrings,
} from '../utils/localeFormatters';

export const useTranslation = () => {
  const { language, t } = useLanguage();

  // Memoized formatters
  const formatCurrencyMemo = useCallback(
    (amount: number, currency?: string) =>
      formatCurrency(amount, language, currency),
    [language]
  );

  const formatNumberMemo = useCallback(
    (num: number, decimals?: number) =>
      formatNumber(num, language, decimals),
    [language]
  );

  const formatDateMemo = useCallback(
    (date: Date | string, format?: 'short' | 'long' | 'full') =>
      formatDate(date, language, format),
    [language]
  );

  const formatRelativeTimeMemo = useCallback(
    (date: Date | string) => formatRelativeTime(date, language),
    [language]
  );

  const formatTimeMemo = useCallback(
    (date: Date | string) => formatTime(date, language),
    [language]
  );

  const formatPercentageMemo = useCallback(
    (value: number, decimals?: number) =>
      formatPercentage(value, language, decimals),
    [language]
  );

  const formatBytesMemo = useCallback(
    (bytes: number, decimals?: number) =>
      formatBytes(bytes, language, decimals),
    [language]
  );

  const formatListMemo = useCallback(
    (items: string[], type?: 'conjunction' | 'disjunction') =>
      formatList(items, language, type),
    [language]
  );

  const formatPluralMemo = useCallback(
    (count: number, singular: string, plural: string) =>
      formatPlural(count, singular, plural, language),
    [language]
  );

  const sortStringsMemo = useCallback(
    (strings: string[], options?: Intl.CollatorOptions) =>
      sortStrings(strings, language, options),
    [language]
  );

  return {
    // Translation function
    t,

    // Locale formatters
    formatCurrency: formatCurrencyMemo,
    formatNumber: formatNumberMemo,
    formatDate: formatDateMemo,
    formatRelativeTime: formatRelativeTimeMemo,
    formatTime: formatTimeMemo,
    formatPercentage: formatPercentageMemo,
    formatBytes: formatBytesMemo,
    formatList: formatListMemo,
    formatPlural: formatPluralMemo,
    sortStrings: sortStringsMemo,

    // Current language
    language,
  };
};

// Simplified hook for just translation
export const useTrans = () => {
  const { t } = useLanguage();
  return t;
};
