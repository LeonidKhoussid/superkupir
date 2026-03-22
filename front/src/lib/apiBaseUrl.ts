/**
 * Базовый URL API для fetch из браузера.
 * - VITE_API_BASE_URL — явный override (другой домен / прокси).
 * - npm run dev (`import.meta.env.DEV`): `http://127.0.0.1:PORT` — бэкенд на машине разработчика.
 * - npm run preview и production-бандл (`PROD`): `protocol//hostname:PORT` как у страницы.
 *   Иначе Chrome блокирует запросы с публичного origin на loopback (Private Network Access / CORS).
 * - VITE_API_PORT — порт бэка (по умолчанию 3000).
 *
 * Если нужен `vite dev --host` с телефона по IP, задайте VITE_API_BASE_URL на URL бэка.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  const port = import.meta.env.VITE_API_PORT?.trim() || '3000'
  const loopbackBase = `http://127.0.0.1:${port}`.replace(/\/$/, '')

  if (typeof window === 'undefined') {
    return loopbackBase
  }

  if (import.meta.env.DEV) {
    return loopbackBase
  }

  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}`.replace(/\/$/, '')
}
