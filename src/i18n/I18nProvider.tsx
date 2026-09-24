import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS, type Strings } from './strings';
import type { L, Lang } from './types';
import { readPref, writePref } from '../lib/prefs';

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Strings;
  /** Выбрать строку текущего языка из локализованного значения */
  l: (value: L) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (readPref('lang') === 'be' ? 'be' : 'ru'));

  useEffect(() => {
    writePref('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: STRINGS[lang], l: (v) => v[lang] }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
