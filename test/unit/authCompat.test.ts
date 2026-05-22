import { afterEach, describe, expect, it, beforeEach } from '@jest/globals';
import { resolveBackendBaseUrl } from '../../wasp-app/src/server/authCompat';

const originalEnv = { ...process.env };

describe('resolveBackendBaseUrl', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, WASP_SERVER_URL: 'http://127.0.0.1:3555' };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses the configured backend base url instead of request host headers', () => {
    const result = resolveBackendBaseUrl({
      headers: {
        host: 'attacker.example',
        'x-forwarded-proto': 'https',
      },
      protocol: 'https',
      get: () => 'attacker.example',
    } as any);

    expect(result).toBe('http://127.0.0.1:3555');
  });
});
