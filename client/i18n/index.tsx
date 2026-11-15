import { createContext, useContext, type ReactNode } from 'react';
import { ar, en, type Strings } from './strings';

export type Locale = 'en' | 'ar';
export type Localized<T> = Record<Locale, T>;

export const localeMeta: Record<Locale, { lang: string; dir: 'ltr' | 'rtl'; ogLocale: string; prefix: string }> = {
  en: { lang: 'en', dir: 'ltr', ogLocale: 'en_US', prefix: '' },
  ar: { lang: 'ar', dir: 'rtl', ogLocale: 'ar_AR', prefix: '/ar' },
};

const dictionaries: Record<Locale, Strings> = { en, ar };

/** '/services/' -> '/ar/services/' for Arabic. Paths are always written in their English form. */
export function localizePath(locale: Locale, path: string): string {
  return localeMeta[locale].prefix + path;
}

/** Splits '/ar/services/' into { locale: 'ar', path: '/services/' }. */
export function splitLocale(path: string): { locale: Locale; path: string } {
  if (path === '/ar/' || path.startsWith('/ar/')) return { locale: 'ar', path: path.slice(3) || '/' };
  return { locale: 'en', path };
}

type I18n = { locale: Locale; t: Strings; href: (path: string) => string; dir: 'ltr' | 'rtl' };

const I18nContext = createContext<I18n>({ locale: 'en', t: en, href: (p) => p, dir: 'ltr' });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: I18n = {
    locale,
    t: dictionaries[locale],
    href: (path) => localizePath(locale, path),
    dir: localeMeta[locale].dir,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);

export const stringsFor = (locale: Locale): Strings => dictionaries[locale];
