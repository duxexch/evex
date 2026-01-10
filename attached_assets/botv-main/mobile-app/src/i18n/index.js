import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import translations from './translations';

const i18n = new I18n(translations);

// Set the locale once at the beginning of your app
i18n.locale = Localization.locale;

// Allow RTL
i18n.enableFallback = true;
i18n.defaultLocale = 'ar';

export default i18n;

export const isRTL = () => {
  return i18n.locale.startsWith('ar');
};

export const setLanguage = (lang) => {
  i18n.locale = lang;
};
