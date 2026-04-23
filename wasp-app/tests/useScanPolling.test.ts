/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../src/client/utils/api';
import { useScanPolling } from '../src/client/hooks/useScanPolling';

jest.mock('../src/client/utils/api', () => {
  const actual = jest.requireActual('../src/client/utils/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      get: jest.fn(),
    },
  };
});

const mockedApiGet = api.get as jest.MockedFunction<typeof api.get>;

const baseScan = {
  id: 'scan-123',
  planAtSubmission: 'pro',
  created_at: '2026-04-23T10:00:00.000Z',
  completed_at: null as string | null,
  error_message: null as string | null,
  inputType: 'sbom_upload',
  inputRef: 'package.json',
};

function makePollResponse(status: 'scanning' | 'done' | 'error') {
  return {
    data: {
      scan: {
        ...baseScan,
        status,
        completed_at: status === 'done' || status === 'error' ? '2026-04-23T10:05:00.000Z' : null,
      },
      status,
    },
    status: 200,
  } as any;
}

function makeRateLimitError() {
  return {
    message: 'Rate limited',
    response: { status: 429 },
  };
}

describe('useScanPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('starts polling on mount', async () => {
    mockedApiGet.mockResolvedValueOnce(makePollResponse('scanning'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    expect(result.current.isPolling).toBe(true);

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        '/api/v1/scans/scan-123',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });
  });

  test('stops polling when scan is completed', async () => {
    mockedApiGet
      .mockResolvedValueOnce(makePollResponse('scanning'))
      .mockResolvedValueOnce(makePollResponse('done'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.progress).toBe(100);
    });

    expect(mockedApiGet).toHaveBeenCalledTimes(2);
  });

  test('handles rate limiting with exponential backoff', async () => {
    mockedApiGet
      .mockRejectedValueOnce(makeRateLimitError())
      .mockResolvedValueOnce(makePollResponse('scanning'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(result.current.error).toBe('Rate limited - retrying...');
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockedApiGet.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('handles failed scans', async () => {
    const failedResponse = makePollResponse('error');
    failedResponse.data.scan.error_message = 'Scanner timeout';
    mockedApiGet.mockResolvedValueOnce(failedResponse);

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.error).toBe('Scanner timeout');
    });
  });

  test('cleans up on unmount', async () => {
    mockedApiGet.mockResolvedValue(makePollResponse('scanning'));

    const { unmount } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledTimes(1);
    });

    unmount();
    const callCount = mockedApiGet.mock.calls.length;

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockedApiGet).toHaveBeenCalledTimes(callCount);
  });

  test('calculates progress based on status', async () => {
    mockedApiGet
      .mockResolvedValueOnce(makePollResponse('scanning'))
      .mockResolvedValueOnce(makePollResponse('done'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(result.current.progress).toBe(50);
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
    });
  });

  test('handles network errors gracefully', async () => {
    mockedApiGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
      expect(result.current.isPolling).toBe(false);
    });
  });

  test('does not throw on AbortError during unmount', () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockedApiGet.mockRejectedValueOnce(abortError);

    const { unmount } = renderHook(() => useScanPolling('scan-123'));

    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
