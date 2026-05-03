import { describe, expect, it, jest } from './testGlobals';
import { emailSignupCompatApi } from '../src/server/authCompat';

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  type: jest.Mock;
  send: jest.Mock;
};

type MockRequest = {
  body: string;
  headers: Record<string, string>;
  ip: string;
  protocol: string;
  get: jest.Mock;
};

describe('auth compat api', () => {
  it('returns validation errors for invalid json', async () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as MockResponse;

    const request = {
      body: '{not-json',
      headers: {},
      ip: '127.0.0.1',
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000'),
    } as MockRequest;

    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    try {
      await emailSignupCompatApi(request, response, {});
    } finally {
      global.fetch = originalFetch;
    }

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'validation_error',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
