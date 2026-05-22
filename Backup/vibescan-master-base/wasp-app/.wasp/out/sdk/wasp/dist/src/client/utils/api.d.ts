type ApiQueryValue = string | number | boolean | null | undefined;
type ApiRequestInit = RequestInit & {
    params?: Record<string, ApiQueryValue>;
};
type ApiResponse<T> = {
    data: T;
    status: number;
    headers: Headers;
    response: Response;
};
export declare class ApiError extends Error {
    response: Response;
    data: unknown;
    status: number;
    constructor(message: string, response: Response, data: unknown);
}
export declare const api: {
    get<T = unknown>(path: string, init?: ApiRequestInit): Promise<ApiResponse<T>>;
    post<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit): Promise<ApiResponse<T>>;
    put<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit): Promise<ApiResponse<T>>;
    delete<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit): Promise<ApiResponse<T>>;
};
export declare function apiFetch(path: string, init?: RequestInit): Promise<Response>;
export {};
//# sourceMappingURL=api.d.ts.map