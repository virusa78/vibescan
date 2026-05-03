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

export class ApiError extends Error {
  response: Response;
  data: unknown;
  status: number;

  constructor(message: string, response: Response, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.response = response;
    this.data = data;
    this.status = response.status;
  }
}

function getApiBaseUrl(): string {
  const browserWindow = (globalThis as { window?: { location?: { origin?: string } } }).window;
  if (browserWindow?.location?.origin) {
    return browserWindow.location.origin.replace(/\/$/, "");
  }

  const fallbackUrl =
    process.env.REACT_APP_API_URL ||
    process.env.VITE_API_PROXY_TARGET ||
    process.env.WASP_WEB_CLIENT_URL ||
    "http://127.0.0.1:3000";

  return fallbackUrl.replace(/\/$/, "");
}

function buildApiUrl(path: string, params?: Record<string, ApiQueryValue>): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${getApiBaseUrl()}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseResponseData(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

async function requestJson<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  init: ApiRequestInit = {},
): Promise<ApiResponse<T>> {
  const { params, headers, ...rest } = init;
  const response = await fetch(buildApiUrl(path, params), {
    credentials: "include",
    method,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData || body instanceof Blob || typeof body === "string"
          ? body
          : JSON.stringify(body),
    ...rest,
  });

  const data = (await parseResponseData(response)) as T;

  if (!response.ok) {
    const message =
      (typeof data === "object" && data !== null && "message" in data && String((data as { message?: unknown }).message)) ||
      (typeof data === "object" && data !== null && "error" in data && String((data as { error?: unknown }).error)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response, data);
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
    response,
  };
}

export const api = {
  get<T = unknown>(path: string, init?: ApiRequestInit) {
    return requestJson<T>("GET", path, undefined, init);
  },
  post<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) {
    return requestJson<T>("POST", path, body, init);
  },
  put<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) {
    return requestJson<T>("PUT", path, body, init);
  },
  delete<T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) {
    return requestJson<T>("DELETE", path, body, init);
  },
};

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });
}
