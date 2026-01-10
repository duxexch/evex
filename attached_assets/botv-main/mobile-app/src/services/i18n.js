/**
 * i18n Service - Multi-language support
 * Provides translation and localization for the mobile app
 */

import translations from './translations';

class I18nService {
  constructor() {
    this.currentLanguage = 'ar';
    this.supportedLanguages = {
      ar: { name: 'Arabic', native: 'العربية', rtl: true },
      en: { name: 'English', native: 'English', rtl: false },
    };
  }

  /**
   * Set current language
   */
  setLanguage(language) {
    if (this.supportedLanguages[language]) {
      this.currentLanguage = language;
    }
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Check if language is RTL
   */
  isRTL(language = null) {
    const lang = language || this.currentLanguage;
    return this.supportedLanguages[lang]?.rtl || false;
  }

  /**
   * Get text translation with nested key support
   * @param {string} key - Translation key (e.g., 'welcome' or 'balance.current')
   * @param {string} language - Language code (optional, uses current language if not provided)
   * @param {object} params - Parameters to interpolate in the text
   * @returns {string} Translated text
   */
  getText(key, language = null, params = {}) {
    const lang = language || this.currentLanguage;
    const langTranslations = translations[lang] || translations['ar'];

    // Navigate nested keys
    const keys = key.split('.');
    let value = langTranslations;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        // Fallback to key itself
        console.warn(`Translation key not found: ${key} for language: ${lang}`);
        return key;
      }
    }

    // Handle string not found
    if (typeof value !== 'string') {
      console.warn(`Translation value is not string: ${key}`);
      return key;
    }

    // Interpolate parameters
    if (Object.keys(params).length > 0) {
      let result = value;
      for (const [key, val] of Object.entries(params)) {
        result = result.replace(`{${key}}`, val);
      }
      return result;
    }

    return value;
  }

  /**
   * Format amount with currency
   * @param {number} amount - The amount to format
   * @param {string} currency - Currency code (SAR, USD, EUR, etc.)
   * @param {string} language - Language code (optional)
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency = 'SAR', language = null) {
    const lang = language || this.currentLanguage;

    // Format number with proper separators
    const formatter = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formattedNumber = formatter.format(amount);

    // Currency symbols
    const symbols = {
      SAR: { ar: 'ر.س', en: 'SAR' },
      USD: { ar: '$', en: '$' },
      EUR: { ar: '€', en: '€' },
      AED: { ar: 'د.إ', en: 'AED' },
      EGP: { ar: 'ج.م', en: 'EGP' },
      KWD: { ar: 'د.ك', en: 'KWD' },
      QAR: { ar: 'ر.ق', en: 'QAR' },
      BHD: { ar: 'د.ب', en: 'BHD' },
      OMR: { ar: 'ر.ع', en: 'OMR' },
      TRY: { ar: '₺', en: '₺' },
    };

    const symbol = symbols[currency]?.[lang] || currency;

    // Format based on language
    if (lang === 'ar') {
      return `${symbol} ${formattedNumber}`;
    } else {
      return `${formattedNumber} ${symbol}`;
    }
  }

  /**
   * Format date/time
   * @param {Date} date - Date to format
   * @param {string} language - Language code (optional)
   * @param {string} format - Format type: 'short', 'long', 'time'
   * @returns {string} Formatted date
   */
  formatDate(date, language = null, format = 'short') {
    const lang = language || this.currentLanguage;

    // Arabic month and day names
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ];

    const arabicDays = [
      'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
    ];

    const englishMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const englishMonthsShort = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const englishDays = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (lang === 'ar') {
      switch (format) {
        case 'short':
          return `${day} ${arabicMonths[month]} ${year}`;
        case 'long':
          return `${arabicDays[date.getDay()]} ${day} ${arabicMonths[month]} ${year}`;
        case 'time':
          return `${hours}:${minutes}`;
        case 'datetime':
          return `${day} ${arabicMonths[month]} ${year} ${hours}:${minutes}`;
        default:
          return `${day} ${arabicMonths[month]} ${year}`;
      }
    } else {
      switch (format) {
        case 'short':
          return `${englishMonthsShort[month]} ${day}, ${year}`;
        case 'long':
          return `${englishDays[date.getDay()]}, ${englishMonths[month]} ${day}, ${year}`;
        case 'time':
          return `${hours}:${minutes}`;
        case 'datetime':
          return `${englishMonthsShort[month]} ${day}, ${year} ${hours}:${minutes}`;
        default:
          return `${englishMonthsShort[month]} ${day}, ${year}`;
      }
    }
  }

  /**
   * Get language info
   */
  getLanguageInfo(language = null) {
    const lang = language || this.currentLanguage;
    return this.supportedLanguages[lang] || this.supportedLanguages['ar'];
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Pluralize text based on count
   */
  getPluralizedText(count, singularKey, pluralKey, language = null) {
    const lang = language || this.currentLanguage;
    return count === 1 ? this.getText(singularKey, lang) : this.getText(pluralKey, lang);
  }
}

// Export singleton instance
export const i18n = new I18nService();

export default i18n;
