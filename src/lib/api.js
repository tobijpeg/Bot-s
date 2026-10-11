const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function apiFetch(path, options) {
  if (!apiBaseUrl) {
    throw new Error("Сервер платформы ещё не настроен. Подключение ботов станет доступно после запуска постоянного API-сервера.");
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBaseUrl}${normalizedPath}`, options);
}
