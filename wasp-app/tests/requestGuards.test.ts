import { describe, expect, it, jest } from './testGlobals';
import { parseJsonBodyWithLimit } from '../src/server/http/requestGuards';
import { sendOperationError } from '../src/server/http/httpErrors';

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

describe('request guards', () => {
  it('rejects oversized json bodies', () => {
    expect(() => parseJsonBodyWithLimit('{"a":"' + 'x'.repeat(70_000) + '"}')).toThrow('request_too_large');
  });

  it('formats unexpected errors without leaking internals', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as MockResponse;

    sendOperationError('test-operation', new Error('sensitive detail'), response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'internal_error',
        message: 'An unexpected error occurred',
        requestId: expect.any(String),
      }),
    );
  });

  it('preserves http errors', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as MockResponse;

    sendOperationError('test-operation', { statusCode: 429, message: 'quota_exceeded' }, response);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'quota_exceeded',
        message: 'quota_exceeded',
      }),
    );
  });
});
