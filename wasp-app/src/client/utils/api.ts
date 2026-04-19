const API_BASE_URL = (import.meta.env.REACT_APP_API_URL || "http://192.168.1.17:3555").replace(
  /\/$/,
  "",
);

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    credentials: "include",
    ...init,
  });
}
