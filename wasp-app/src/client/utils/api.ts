const API_BASE_URL = (
  import.meta.env.REACT_APP_API_URL ||
  window.location.origin
).replace(/\/$/, "");

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    credentials: "include",
    ...init,
  });
}
