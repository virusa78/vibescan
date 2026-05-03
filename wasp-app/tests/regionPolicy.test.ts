/**
 * Tests for region policy resolution.
 */

import {
  DEFAULT_GLOBAL_POLICY,
  normalizeRegionCode,
  resolveEffectivePolicy,
} from '../src/shared/regionPolicy';

describe('region policy resolution', () => {
  it('merges policy layers with user override taking precedence', () => {
    const policy = resolveEffectivePolicy({
      regionCode: 'pk',
      globalPolicy: {
        monthlyScanLimit: 50,
        monthlyRemediationPromptLimit: 15,
        maxPromptsPerFinding: 3,
      },
      regionPolicy: {
        monthlyScanLimit: 80,
        monthlyRemediationPromptLimit: 25,
        maxPromptsPerFinding: 4,
      },
      userOverride: {
        monthlyRemediationPromptLimit: 7,
      },
    });

    expect(policy).toEqual({
      regionCode: 'PK',
      source: 'user_override',
      monthlyScanLimit: 80,
      monthlyRemediationPromptLimit: 7,
      maxPromptsPerFinding: 4,
    });
  });

  it('normalizes unknown region codes to OTHER', () => {
    expect(normalizeRegionCode('unknown')).toBe('OTHER');
    expect(normalizeRegionCode('  in ')).toBe('IN');
    expect(normalizeRegionCode(null)).toBe('OTHER');
  });

  it('falls back to defaults when no policy rows exist', () => {
    const policy = resolveEffectivePolicy({
      regionCode: 'PK',
    });

    expect(policy).toEqual({
      regionCode: 'PK',
      source: 'global_default',
      ...DEFAULT_GLOBAL_POLICY,
    });
  });
});
