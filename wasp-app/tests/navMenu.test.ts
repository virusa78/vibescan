import {
  appNavigationLabels,
  userMenuLabels,
} from '../src/client/components/NavBar/navigationConfig';

describe('navigation split', () => {
  test('keeps product nav separate from user menu', () => {
    expect(appNavigationLabels).toEqual([
      'Dashboard',
      'New Scan',
      'Settings',
    ]);

    expect(userMenuLabels).toEqual(['User Settings']);
  });
});
