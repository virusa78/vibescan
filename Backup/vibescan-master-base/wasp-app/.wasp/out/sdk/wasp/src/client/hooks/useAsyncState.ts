import { useCallback, useState } from 'react';

type AsyncRunOptions = {
  errorMessage?: string;
  setLoading?: boolean;
  resetError?: boolean;
  onError?: (error: unknown) => void;
};

type UseAsyncState = {
  isLoading: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  setIsLoading: (value: boolean) => void;
  run: <T>(task: () => Promise<T>, options?: AsyncRunOptions) => Promise<T | undefined>;
};

export function useAsyncState(initialLoading = false): UseAsyncState {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(task: () => Promise<T>, options: AsyncRunOptions = {}) => {
      const {
        errorMessage = 'Something went wrong.',
        setLoading = true,
        resetError = true,
        onError,
      } = options;

      if (setLoading) {
        setIsLoading(true);
      }
      if (resetError) {
        setError(null);
      }

      try {
        return await task();
      } catch (err) {
        const message = err instanceof Error ? err.message : errorMessage;
        setError(message);
        onError?.(err);
        return undefined;
      } finally {
        if (setLoading) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  return {
    isLoading,
    error,
    setError,
    setIsLoading,
    run,
  };
}
