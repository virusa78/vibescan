import { describe, expect, it } from '@jest/globals';
import { validateWebhookTargetUrl } from '../src/shared/webhookTarget';

describe('Webhook target validation', () => {
  it('allows public https endpoints', async () => {
    const result = await validateWebhookTargetUrl('https://example.com/webhook', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });

    expect(result.hostname).toBe('example.com');
  });

  it('rejects localhost over http outside local dev allowance', async () => {
    await expect(
      validateWebhookTargetUrl('http://localhost:3000/webhook', {
        lookup: async () => [{ address: '127.0.0.1', family: 4 }],
        allowLocalHttp: false,
      }),
    ).rejects.toThrow('Webhook URLs must use https');
  });

  it('rejects private address resolution even for https urls', async () => {
    await expect(
      validateWebhookTargetUrl('https://webhook.internal.example/path', {
        lookup: async () => [{ address: '10.0.0.12', family: 4 }],
      }),
    ).rejects.toThrow('Webhook host resolves to a private address');
  });

  it('allows localhost http in local development mode', async () => {
    const result = await validateWebhookTargetUrl('http://localhost:3000/webhook', {
      allowLocalHttp: true,
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    });

    expect(result.hostname).toBe('localhost');
  });
});
