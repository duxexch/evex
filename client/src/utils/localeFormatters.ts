import { Language } from './i18n';

// Currency formatter with locale support
export const formatCurrency = (
  amount: number,
  language: Language,
  currency: string = 'USD'
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Number formatter with locale support
export const formatNumber = (
  num: number,
  language: Language,
  decimals: number = 2
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Date formatter with locale support
export const formatDate = (
  date: Date | string,
  language: Language,
  format: 'short' | 'long' | 'full' = 'short'
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  if (format === 'long') {
    formatOptions.month = 'long';
  } else if (format === 'full') {
    formatOptions.weekday = 'long';
    formatOptions.month = 'long';
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
};

// Relative time formatter
export const formatRelativeTime = (
  date: Date | string,
  language: Language
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 7) return rtf.format(-diffDays, 'day');
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return rtf.format(-diffWeeks, 'week');
  
  const diffMonths = Math.floor(diffDays / 30);
  return rtf.format(-diffMonths, 'month');
};

// Plural formatter with locale support
export const formatPlural = (
  count: number,
  singular: string,
  plural: string,
  language: Language
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const pf = new Intl.PluralRules(locale);
  const rule = pf.select(count);

  // For English, only 'one' and 'other' rules apply
  // For Arabic, more complex rules apply
  if (language === 'ar') {
    // Simplified Arabic plural logic
    return count === 1 ? singular : plural;
  }

  return rule === 'one' ? singular : plural;
};

// Time formatter (12/24 hour based on locale)
export const formatTime = (
  date: Date | string,
  language: Language
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: language === 'ar' ? false : true,
  }).format(dateObj);
};

// Percentage formatter
export const formatPercentage = (
  value: number,
  language: Language,
  decimals: number = 1
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);

  return formatted;
};

// Byte formatter (file size)
export const formatBytes = (
  bytes: number,
  language: Language,
  decimals: number = 2
): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = language === 'ar'
    ? ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedNumber = formatNumber(
    bytes / Math.pow(k, i),
    language,
    decimals
  );

  return `${formattedNumber} ${sizes[i]}`;
};

// Compare strings with locale-aware comparison
export const compareStrings = (
  a: string,
  b: string,
  language: Language,
  options?: Intl.CollatorOptions
): number => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const collator = new Intl.Collator(locale, options);
  return collator.compare(a, b);
};

// Sort array with locale-aware sorting
export const sortStrings = (
  strings: string[],
  language: Language,
  options?: Intl.CollatorOptions
): string[] => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const collator = new Intl.Collator(locale, options);
  return [...strings].sort((a, b) => collator.compare(a, b));
};

// List formatter (join with locale-aware separator)
export const formatList = (
  items: string[],
  language: Language,
  type: 'conjunction' | 'disjunction' = 'conjunction'
): string => {
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const listFormatter = new Intl.ListFormat(locale, { type });
  return listFormatter.format(items);
};
