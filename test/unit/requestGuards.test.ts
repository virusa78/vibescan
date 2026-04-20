import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createClient } from 'redis';
import {
  enforceRateLimit,
  parseJsonBodyWithLimit,
} from '../../wasp-app/src/server/http/requestGuards';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as unknown as jest.Mock;

describe('requestGuards', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('rejects oversized JSON bodies with 413', () => {
    try {
      parseJsonBodyWithLimit('{"a":1}', 2);
      throw new Error('Expected error was not thrown');
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 413 });
    }
  });

  it('rejects invalid JSON with 400', () => {
    try {
      parseJsonBodyWithLimit('{invalid}', 1024);
      throw new Error('Expected error was not thrown');
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 400 });
    }
  });

  it('parses buffer payloads', () => {
    const payload = Buffer.from(JSON.stringify({ ok: true }));
    const parsed = parseJsonBodyWithLimit<{ ok: boolean }>(payload, 1024);
    expect(parsed).toEqual({ ok: true });
  });

  it('throws quota_exceeded when rate limit exceeded', async () => {
    const client = {
      connect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      quit: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      incr: jest.fn() as jest.MockedFunction<() => Promise<number>>,
      expire: jest.fn() as jest.MockedFunction<() => Promise<number>>,
    };
    client.connect.mockResolvedValue(undefined);
    client.quit.mockResolvedValue(undefined);
    client.incr.mockResolvedValue(3);
    client.expire.mockResolvedValue(1);
    createClientMock.mockReturnValue(client);

    await expect(
      enforceRateLimit({ key: 'rate_limit:test', limit: 2, windowSeconds: 60 })
    ).rejects.toMatchObject({
      statusCode: 429,
      data: { error: 'quota_exceeded' },
    });
  });

  it('fails open in test when redis errors', async () => {
    const client = {
      connect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      quit: jest.fn() as jest.MockedFunction<() => Promise<void>>,
      incr: jest.fn() as jest.MockedFunction<() => Promise<number>>,
      expire: jest.fn() as jest.MockedFunction<() => Promise<number>>,
    };
    client.connect.mockResolvedValue(undefined);
    client.quit.mockResolvedValue(undefined);
    client.incr.mockRejectedValue(new Error('redis_down'));
    createClientMock.mockReturnValue(client);

    await expect(
      enforceRateLimit({ key: 'rate_limit:test', limit: 2, windowSeconds: 60 })
    ).resolves.toBeUndefined();
  });
});
