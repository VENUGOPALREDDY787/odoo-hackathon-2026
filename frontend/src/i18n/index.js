import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import hiTranslations from './locales/hi.json';

const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('dealflow_language') : null;
const defaultLanguage = savedLanguage || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      hi: { translation: hiTranslations }
    },
    lng: defaultLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dealflow_language', lng);
    document.documentElement.lang = lng;
  }
});

if (typeof window !== 'undefined') {
  document.documentElement.lang = defaultLanguage;
}

export default i18n;
