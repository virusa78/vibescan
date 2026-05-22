import { describe, expect, it } from '@jest/globals';
import { snykProvider } from '../../wasp-app/src/server/lib/scanners/snykProvider';

describe('snykProvider', () => {
  it('treats resolved user-secret credentials as healthy', async () => {
    const health = await snykProvider.getHealth({
      scanId: 'scan-1',
      userId: 'user-1',
      inputType: 'github_app',
      inputRef: 'https://github.com/revokslab/ShipFree',
      resolvedCredentials: {
        source: 'user-secret',
        userId: 'user-1',
        values: {
          token: 'secret-token',
        },
      },
    });

    expect(health.configured).toBe(true);
    expect(health.healthy).toBe(true);
  });
});

