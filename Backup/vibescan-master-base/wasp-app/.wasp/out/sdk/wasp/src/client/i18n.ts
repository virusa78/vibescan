export type AppLocale = 'en' | 'ru';

const STORAGE_KEY = 'vibescan.locale';

export function normalizeLocale(value?: string | null): AppLocale {
  if (!value) return 'en';
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

export function resolveAppLocale(preferred?: string | null): AppLocale {
  if (typeof window === 'undefined') {
    return normalizeLocale(preferred);
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return normalizeLocale(preferred ?? stored ?? window.navigator.language);
}

export function applyAppLocale(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dir = 'ltr';

  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Best-effort only: locale persistence must never block app rendering.
  }
}
