const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiFetch(path, options) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBaseUrl}${normalizedPath}`, options);
}
