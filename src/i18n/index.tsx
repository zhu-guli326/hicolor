/**
 * HiColor i18n - 多语言支持系统
 * 支持：简体中文(zh)、繁體中文(zhTW)、English(en)、한국어(ko)、日本語(ja)
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import zh from './locales/zh.json';
import zhTW from './locales/zhTW.json';
import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

export type Locale = 'zh' | 'zhTW' | 'en' | 'ko' | 'ja';

type TranslationData = typeof zh;

const locales: Record<Locale, TranslationData> = {
  zh,
  zhTW,
  en,
  ko,
  ja,
};

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '简体中文',
  zhTW: '繁體中文',
  en: 'English',
  ko: '한국어',
  ja: '日本語',
};

function getNestedValue(obj: unknown, path: string): string {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown) as string ?? path;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeLabels: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
  localeLabels: LOCALE_LABELS,
});

const LOCALE_STORAGE_KEY = 'hicolor_locale';

/** 检测浏览器语言并返回匹配的 Locale */
function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  
  const lang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || 'zh';
  const langLower = lang.toLowerCase();
  
  // 精确匹配
  if (langLower.startsWith('zh-tw') || langLower.startsWith('zh-hk')) return 'zhTW';
  if (langLower.startsWith('zh')) return 'zh';
  if (langLower.startsWith('en')) return 'en';
  if (langLower.startsWith('ko')) return 'ko';
  if (langLower.startsWith('ja')) return 'ja';
  
  // 部分匹配
  if (langLower.includes('zh')) return 'zh';
  if (langLower.includes('en')) return 'en';
  if (langLower.includes('ko')) return 'ko';
  if (langLower.includes('ja')) return 'ja';
  
  return 'zh';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved && saved in locales) return saved as Locale;
    } catch {}
    // 首次访问：从浏览器语言检测
    return detectBrowserLocale();
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = getNestedValue(locales[locale], key);
    // 如果找不到翻译，在控制台显示警告并返回带方括号的 key
    if (text === undefined || text === key) {
      console.warn(`[i18n] Missing translation: [${locale}] "${key}"`);
      return `[${key}]`;
    }
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, localeLabels: LOCALE_LABELS }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
