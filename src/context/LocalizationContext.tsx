import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getInitialLocale,
  getTranslationLocale,
  isRightToLeftLocale,
  Locale,
  MessageKey,
  translate,
} from '../i18n/localization';

const STORAGE_KEY = 'estudio_interface_locale_v1';

interface LocalizationContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  persistenceError: string;
  translationLocale: string;
  t: (key: MessageKey) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() =>
    getInitialLocale(readStoredLocale(), typeof navigator === 'undefined' ? 'en' : navigator.language)
  );
  const [persistenceError, setPersistenceError] = useState('');

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    setPersistenceError('');
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch (error) {
      setPersistenceError(`Language changed for this session but could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRightToLeftLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    persistenceError,
    translationLocale: getTranslationLocale(locale),
    t: (key: MessageKey) => translate(locale, key),
  }), [locale]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used inside LocalizationProvider.');
  return context;
}
