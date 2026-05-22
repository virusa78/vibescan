import { useCallback, useState } from 'react';
export function useAsyncState(initialLoading = false) {
    const [isLoading, setIsLoading] = useState(initialLoading);
    const [error, setError] = useState(null);
    const run = useCallback(async (task, options = {}) => {
        const { errorMessage = 'Something went wrong.', setLoading = true, resetError = true, onError, } = options;
        if (setLoading) {
            setIsLoading(true);
        }
        if (resetError) {
            setError(null);
        }
        try {
            return await task();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : errorMessage;
            setError(message);
            onError?.(err);
            return undefined;
        }
        finally {
            if (setLoading) {
                setIsLoading(false);
            }
        }
    }, []);
    return {
        isLoading,
        error,
        setError,
        setIsLoading,
        run,
    };
}
//# sourceMappingURL=useAsyncState.js.map