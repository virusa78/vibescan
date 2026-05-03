import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from '@jest/globals';
import { verifyGitHubWebhookSignature } from '../../wasp-app/src/server/services/githubAppService';

describe('verifyGitHubWebhookSignature', () => {
  const originalWebhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.GITHUB_APP_WEBHOOK_SECRET;
    } else {
      process.env.GITHUB_APP_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it('accepts a valid sha256 signature', () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'super-secret';
    const payload = JSON.stringify({ action: 'opened', repository: { full_name: 'acme/repo' } });
    const digest = crypto
      .createHmac('sha256', 'super-secret')
      .update(payload)
      .digest('hex');

    const result = verifyGitHubWebhookSignature(payload, `sha256=${digest}`);

    expect(result).toBe(true);
  });

  it('rejects an invalid signature', () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'super-secret';
    const payload = JSON.stringify({ action: 'opened' });

    const result = verifyGitHubWebhookSignature(payload, 'sha256=deadbeef');

    expect(result).toBe(false);
  });

  it('rejects a missing or malformed signature header', () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'super-secret';
    const payload = JSON.stringify({ action: 'opened' });

    expect(verifyGitHubWebhookSignature(payload, undefined)).toBe(false);
    expect(verifyGitHubWebhookSignature(payload, 'not-a-signature')).toBe(false);
  });
});
