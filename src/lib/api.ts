export function apiUrl(path: string): string {
  // The AI Studio preview and Express API share the same origin. Keeping this
  // relative avoids a client-side environment setting and works on every device.
  return path.startsWith('/') ? path : `/${path}`;
}
