/**
 * Test suite for useScanPolling hook
 * Tests polling interval, rate limiting, cleanup, and error handling
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useScanPolling } from '../../../wasp-app/src/client/hooks/useScanPolling';

// Mock fetch
global.fetch = jest.fn();

describe('useScanPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should start polling on mount', async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'scanning',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'scanning',
      }),
    });

    const { result } = renderHook(() => useScanPolling('scan-123'));

    // Initial state should show loading
    expect(result.current.isPolling).toBe(true);
    expect(result.current.status).toBe('idle');

    // Wait for first poll
    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/scans/scan-123',
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  it('should stop polling when scan is completed', async () => {
    const mockFetch = global.fetch as jest.Mock;
    
    // First poll: scanning
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'scanning',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'scanning',
      }),
    });

    // Second poll: done
    const completedAt = new Date().toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'done',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: completedAt,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'done',
      }),
    });

    const { result } = renderHook(() => useScanPolling('scan-123'));

    // Start polling
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });

    // Advance to next poll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.progress).toBe(100);
    });

    // Verify polling stopped (fetch should only be called twice)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle rate limiting with exponential backoff', async () => {
    const mockFetch = global.fetch as jest.Mock;

    // First poll: rate limited
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    // After backoff: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'scanning',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'scanning',
      }),
    });

    const { result } = renderHook(() => useScanPolling('scan-123'));

    // First poll - rate limited
    act(() => {
      jest.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Rate limited - retrying...');
    });

    // After backoff period (5 seconds)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle failed scans', async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'error',
          planAtSubmission: 'starter',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: 'Scanner timeout',
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'error',
      }),
    });

    const { result } = renderHook(() => useScanPolling('scan-123'));

    act(() => {
      jest.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.isPolling).toBe(false);
      expect(result.current.error).toBe('Scanner timeout');
    });
  });

  it('should cleanup on unmount', () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'scanning',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'scanning',
      }),
    });

    const { unmount } = renderHook(() => useScanPolling('scan-123'));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Unmount - should cleanup
    unmount();

    // Verify no more polls after unmount
    const callCountBeforeUnmount = mockFetch.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockFetch.mock.calls.length).toBe(callCountBeforeUnmount);
  });

  it('should calculate progress correctly based on status', async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'scanning',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'scanning',
      }),
    });

    const { result } = renderHook(() => useScanPolling('scan-123'));

    act(() => {
      jest.advanceTimersByTime(0);
    });

    await waitFor(() => {
      // Running status shows 50% progress
      expect(result.current.progress).toBe(50);
    });

    // Update to completed
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        scan: {
          id: 'scan-123',
          status: 'done',
          planAtSubmission: 'pro',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: null,
          inputType: 'sbom_upload',
          inputRef: 'package.json',
        },
        status: 'done',
      }),
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      // Completed status shows 100% progress
      expect(result.current.progress).toBe(100);
    });
  });

  it('should handle network errors gracefully', async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useScanPolling('scan-123'));

    act(() => {
      jest.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
      expect(result.current.isPolling).toBe(false);
    });
  });

  it('should not throw on AbortError during unmount', () => {
    const mockFetch = global.fetch as jest.Mock;
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { unmount } = renderHook(() => useScanPolling('scan-123'));

    act(() => {
      jest.advanceTimersByTime(0);
    });

    // Should not throw
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
