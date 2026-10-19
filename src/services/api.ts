const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(`${apiBase}${path}`, {
    ...init,
    credentials: apiBase ? 'include' : init.credentials || 'same-origin',
  });
}
