import { describe, expect, it, jest } from '@jest/globals';
import { validateWebhookTargetUrl } from '../../wasp-app/src/shared/webhookTarget';

describe('validateWebhookTargetUrl', () => {
  it('rejects non-https urls by default', async () => {
    await expect(validateWebhookTargetUrl('http://example.com')).rejects.toThrow(
      'Webhook URLs must use https'
    );
  });

  it('allows local http when explicitly enabled', async () => {
    const url = await validateWebhookTargetUrl('http://localhost:8080', {
      allowLocalHttp: true,
    });

    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('localhost');
  });

  it('rejects hosts resolving to private IPs', async () => {
    const lookup = jest.fn() as jest.MockedFunction<
      (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>
    >;
    lookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);

    await expect(
      validateWebhookTargetUrl('https://example.com', { lookup })
    ).rejects.toThrow('Webhook host resolves to a private address');
  });

  it('accepts public IP resolutions', async () => {
    const lookup = jest.fn() as jest.MockedFunction<
      (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>
    >;
    lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);

    const url = await validateWebhookTargetUrl('https://example.com', { lookup });

    expect(url.hostname).toBe('example.com');
  });
});
