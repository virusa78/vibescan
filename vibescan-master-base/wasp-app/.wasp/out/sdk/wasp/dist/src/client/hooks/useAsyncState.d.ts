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
export declare function useAsyncState(initialLoading?: boolean): UseAsyncState;
export {};
//# sourceMappingURL=useAsyncState.d.ts.map