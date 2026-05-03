import { afterEach, describe, expect, it } from '@jest/globals';
import { getGithubAppSetup } from '../../wasp-app/src/server/operations/github/getGithubAppSetup';

describe('getGithubAppSetup', () => {
  const originalEnv = {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET,
    WASP_WEB_CLIENT_URL: process.env.WASP_WEB_CLIENT_URL,
    WASP_SERVER_URL: process.env.WASP_SERVER_URL,
  };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('returns install and webhook setup details when GitHub App is configured', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_SLUG = 'vibescan-app';
    process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'secret';
    process.env.WASP_WEB_CLIENT_URL = 'https://app.vibescan.example';
    process.env.WASP_SERVER_URL = 'https://api.vibescan.example';

    const result = await getGithubAppSetup();

    expect(result).toEqual({
      configured: true,
      app_id: '12345',
      app_slug: 'vibescan-app',
      install_url: 'https://github.com/apps/vibescan-app/installations/new',
      callback_url: 'https://app.vibescan.example/settings',
      webhook_url: 'https://api.vibescan.example/github/webhook',
      manual_linking_required: true,
    });
  });

  it('returns null install details when GitHub App is not configured', async () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_SLUG;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;

    const result = await getGithubAppSetup();

    expect(result.configured).toBe(false);
    expect(result.app_id).toBeNull();
    expect(result.install_url).toBeNull();
  });
});
