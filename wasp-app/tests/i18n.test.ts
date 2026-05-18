import { normalizeLocale } from '../src/client/i18n';

describe('i18n', () => {
  describe('normalizeLocale', () => {
    test('returns "en" for null, undefined, or empty string', () => {
      expect(normalizeLocale(null)).toBe('en');
      expect(normalizeLocale(undefined)).toBe('en');
      expect(normalizeLocale('')).toBe('en');
      expect(normalizeLocale('   ')).toBe('en');
    });

    test('returns "ru" for various Russian locale strings', () => {
      expect(normalizeLocale('ru')).toBe('ru');
      expect(normalizeLocale('RU')).toBe('ru');
      expect(normalizeLocale(' ru ')).toBe('ru');
      expect(normalizeLocale('ru-RU')).toBe('ru');
      expect(normalizeLocale('ru-KZ')).toBe('ru');
    });

    test('returns "en" for various English locale strings', () => {
      expect(normalizeLocale('en')).toBe('en');
      expect(normalizeLocale('EN')).toBe('en');
      expect(normalizeLocale(' en ')).toBe('en');
      expect(normalizeLocale('en-US')).toBe('en');
      expect(normalizeLocale('en-GB')).toBe('en');
    });

    test('returns "en" as fallback for unrecognized locales', () => {
      expect(normalizeLocale('fr')).toBe('en');
      expect(normalizeLocale('es-ES')).toBe('en');
      expect(normalizeLocale('de')).toBe('en');
      expect(normalizeLocale('zh-CN')).toBe('en');
    });
  });
});
