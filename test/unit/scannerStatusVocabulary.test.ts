import { describe, expect, it } from '@jest/globals';
import {
  getScannerAvailabilityLabel,
  getScannerHealthLabel,
  getScannerResultLabel,
  getScannerSelectionLabel,
} from '../../wasp-app/src/client/utils/scannerStatusVocabulary';

describe('scannerStatusVocabulary', () => {
  it('uses product language for availability states', () => {
    expect(getScannerAvailabilityLabel('available')).toBe('Available');
    expect(getScannerAvailabilityLabel('cooling_down')).toBe('Cooling down');
    expect(getScannerAvailabilityLabel('unavailable')).toBe('Unavailable');
  });

  it('keeps selection language aligned with availability language', () => {
    expect(getScannerSelectionLabel({ selected: true, status: 'available' })).toBe('Selected');
    expect(getScannerSelectionLabel({ selected: false, status: 'cooling_down' })).toBe('Cooling down');
    expect(getScannerSelectionLabel({ selected: false, status: 'available' })).toBe('Available');
  });

  it('keeps result language compact and distinct', () => {
    expect(getScannerResultLabel('completed')).toBe('Done');
    expect(getScannerResultLabel('failed')).toBe('Failed');
    expect(getScannerResultLabel('missing')).toBe('Not run');
    expect(getScannerResultLabel('planned')).toBe('Queued');
  });

  it('renders health checks with plain language', () => {
    expect(getScannerHealthLabel(true)).toBe('Healthy');
    expect(getScannerHealthLabel(false)).toBe('Unhealthy');
    expect(getScannerHealthLabel(null)).toBe('Unknown');
  });
});
