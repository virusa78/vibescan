import { describe, expect, it } from '@jest/globals';
import { normalizeStatusValue } from '../src/dashboard/urlState';

describe('normalizeStatusValue', () => {
  it('returns exact standard values', () => {
    expect(normalizeStatusValue('pending')).toBe('pending');
    expect(normalizeStatusValue('scanning')).toBe('scanning');
    expect(normalizeStatusValue('done')).toBe('done');
    expect(normalizeStatusValue('error')).toBe('error');
    expect(normalizeStatusValue('cancelled')).toBe('cancelled');
  });

  it('maps aliased values to standard values', () => {
    expect(normalizeStatusValue('completed')).toBe('done');
    expect(normalizeStatusValue('failed')).toBe('error');
    expect(normalizeStatusValue('running')).toBe('scanning');
    expect(normalizeStatusValue('queued')).toBe('scanning');
  });

  it('handles case insensitivity and whitespace', () => {
    expect(normalizeStatusValue('  pending  ')).toBe('pending');
    expect(normalizeStatusValue('\ncompleted\t')).toBe('done');
    expect(normalizeStatusValue('RUNNING')).toBe('scanning');
  });

  it('returns null for unrecognized values', () => {
    expect(normalizeStatusValue('unknown')).toBeNull();
    expect(normalizeStatusValue('')).toBeNull();
    expect(normalizeStatusValue(' ')).toBeNull();
  });
});
