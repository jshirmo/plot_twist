// This is deliberately public: it is the URL of the shared API, never a secret.
// Leave it blank when the frontend and Express API are deployed together.
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = configuredApiBase ? configuredApiBase.replace(/\/$/, '') : '';

export function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}
