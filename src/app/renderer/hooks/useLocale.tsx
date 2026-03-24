import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type Locale, type TranslationKey, translate } from '../i18n';

interface LocaleContextValue {
  locale:   Locale;
  toggle:   () => void;
  t:        (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'cortex-locale';

function loadLocaleSync(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'fr') return v;
  } catch { /* ignore */ }
  const lang = navigator.language.slice(0, 2).toLowerCase();
  return lang === 'fr' ? 'fr' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(loadLocaleSync);

  // Au montage : synchroniser avec AppSettings (source de vérité)
  useEffect(() => {
    window.api.getSettings().then(s => {
      if ((s.locale === 'en' || s.locale === 'fr') && s.locale !== locale) {
        setLocale(s.locale as Locale);
        try { localStorage.setItem(STORAGE_KEY, s.locale); } catch {}
      }
    }).catch(() => {});
  }, []);

  const toggle = useCallback(async () => {
    const next: Locale = locale === 'en' ? 'fr' : 'en';
    setLocale(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    try {
      const settings = await window.api.getSettings();
      await window.api.saveSettings({ ...settings, locale: next });
    } catch {}
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(key, locale, vars),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, toggle, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
