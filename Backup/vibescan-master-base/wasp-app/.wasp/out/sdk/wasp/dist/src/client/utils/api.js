export class ApiError extends Error {
    response;
    data;
    status;
    constructor(message, response, data) {
        super(message);
        this.name = "ApiError";
        this.response = response;
        this.data = data;
        this.status = response.status;
    }
}
function getApiBaseUrl() {
    const browserWindow = globalThis.window;
    if (browserWindow?.location?.origin) {
        return browserWindow.location.origin.replace(/\/$/, "");
    }
    const fallbackUrl = process.env.REACT_APP_API_URL ||
        process.env.VITE_API_PROXY_TARGET ||
        process.env.WASP_WEB_CLIENT_URL ||
        "http://127.0.0.1:3000";
    return fallbackUrl.replace(/\/$/, "");
}
function buildApiUrl(path, params) {
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
async function parseResponseData(response) {
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
async function requestJson(method, path, body, init = {}) {
    const { params, headers, ...rest } = init;
    const response = await fetch(buildApiUrl(path, params), {
        credentials: "include",
        method,
        headers: {
            ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: body === undefined
            ? undefined
            : body instanceof FormData || body instanceof Blob || typeof body === "string"
                ? body
                : JSON.stringify(body),
        ...rest,
    });
    const data = (await parseResponseData(response));
    if (!response.ok) {
        const message = (typeof data === "object" && data !== null && "message" in data && String(data.message)) ||
            (typeof data === "object" && data !== null && "error" in data && String(data.error)) ||
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
    get(path, init) {
        return requestJson("GET", path, undefined, init);
    },
    post(path, body, init) {
        return requestJson("POST", path, body, init);
    },
    put(path, body, init) {
        return requestJson("PUT", path, body, init);
    },
    delete(path, body, init) {
        return requestJson("DELETE", path, body, init);
    },
};
export function apiFetch(path, init) {
    return fetch(buildApiUrl(path), {
        credentials: "include",
        ...init,
    });
}
//# sourceMappingURL=api.js.map