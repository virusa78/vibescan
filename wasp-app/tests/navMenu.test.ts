import { describe, expect, test } from '@jest/globals';
import {
  appNavigationLabels,
  userMenuLabels,
} from '../src/client/components/NavBar/navigationConfig';

describe('navigation split', () => {
  test('keeps product nav separate from user menu', () => {
    expect(appNavigationLabels).toEqual([
      'Dashboard',
      'Scans',
      'Findings',
      'Billing',
      'API Keys',
      'Settings',
    ]);

    expect(userMenuLabels).toEqual(['User Settings', 'Admin Console']);
  });
});
