/** @jest-environment jsdom */

import { describe, expect, it } from '@jest/globals';
import { normalizeLocale } from '../src/client/i18n';

describe('i18n.normalizeLocale', () => {
  it('defaults to en for empty values', () => {
    expect(normalizeLocale(null)).toBe('en');
    expect(normalizeLocale(undefined)).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('maps ru locales to ru', () => {
    expect(normalizeLocale('ru')).toBe('ru');
    expect(normalizeLocale('ru-RU')).toBe('ru');
    expect(normalizeLocale(' RU ')).toBe('ru');
  });

  it('falls back to en for unknown locales', () => {
    expect(normalizeLocale('fr')).toBe('en');
    expect(normalizeLocale('zh-CN')).toBe('en');
  });
});
