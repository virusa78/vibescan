/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from './testGlobals';

type ScanData = {
  id: string;
  status: 'pending' | 'scanning' | 'done' | 'error';
  planAtSubmission: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  inputType: string;
  inputRef: string;
};

const queryScenario: {
  initialData: ScanData | null;
  nextData: ScanData | null;
  queryError: Error | null;
} = {
  initialData: null,
  nextData: null,
  queryError: null,
};

jest.mock('wasp/client/operations', () => {
  const React = require('react');
  const getScanById = jest.fn();
  const useQuery = jest.fn();

  useQuery.mockImplementation(() => {
      const [data, setData] = React.useState(queryScenario.initialData);
      const [error, setError] = React.useState(queryScenario.queryError);

      const refetch = jest.fn(() => {
        if (queryScenario.queryError) {
          setError(queryScenario.queryError);
          return;
        }

        if (queryScenario.nextData) {
          setData(queryScenario.nextData);
        }
      });

      return {
        data,
        isLoading: false,
        error,
        refetch,
      };
  });

  return { getScanById, useQuery };
});

import { getScanById, useQuery } from 'wasp/client/operations';
import { useScanPolling } from '../src/client/hooks/useScanPolling';

const mockedGetScanById = getScanById as jest.MockedFunction<typeof getScanById>;
const mockedUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

function makeScan(status: ScanData['status'], errorMessage: string | null = null): ScanData {
  return {
    id: 'scan-123',
    planAtSubmission: 'pro',
    createdAt: '2026-04-23T10:00:00.000Z',
    completedAt: status === 'done' || status === 'error' ? '2026-04-23T10:05:00.000Z' : null,
    errorMessage,
    inputType: 'sbom_upload',
    inputRef: 'package.json',
    status,
  };
}

describe('useScanPolling', () => {
  beforeEach(() => {
    queryScenario.initialData = null;
    queryScenario.nextData = null;
    queryScenario.queryError = null;
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
    queryScenario.initialData = makeScan('scanning');

    const { result } = renderHook(() => useScanPolling('scan-123'));

    expect(mockedUseQuery).toHaveBeenCalledWith(
      mockedGetScanById,
      { scanId: 'scan-123' },
      expect.objectContaining({ enabled: true }),
    );
    expect(result.current.isPolling).toBe(true);
    expect(result.current.status).toBe('running');
    expect(result.current.progress).toBe(50);
  });

  test('stops polling when scan is completed', async () => {
    queryScenario.initialData = makeScan('scanning');
    queryScenario.nextData = makeScan('done');

    const { result } = renderHook(() => useScanPolling('scan-123'));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.progress).toBe(100);
    });
  });

  test('handles failed scans', async () => {
    queryScenario.initialData = makeScan('error', 'Scanner timeout');

    const { result } = renderHook(() => useScanPolling('scan-123'));

    expect(result.current.status).toBe('failed');
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBe('Scanner timeout');
  });

  test('handles query errors gracefully', async () => {
    queryScenario.queryError = new Error('Network error');

    const { result } = renderHook(() => useScanPolling('scan-123'));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Network error');
    expect(result.current.isPolling).toBe(false);
  });

  test('cleans up on unmount', () => {
    queryScenario.initialData = makeScan('scanning');

    const { unmount } = renderHook(() => useScanPolling('scan-123'));

    expect(() => {
      unmount();
    }).not.toThrow();
  });

  test('calculates progress based on status', async () => {
    queryScenario.initialData = makeScan('scanning');
    queryScenario.nextData = makeScan('done');

    const { result } = renderHook(() => useScanPolling('scan-123'));

    expect(result.current.progress).toBe(50);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.progress).toBe(100);
    });
  });
});
