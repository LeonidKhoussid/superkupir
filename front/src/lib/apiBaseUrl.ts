/**
 * Базовый URL API для fetch из браузера.
 * - Если задан VITE_API_BASE_URL — используется он (отдельный домен/прокси).
 * - Иначе — тот же хост, что у открытой страницы, порт VITE_API_PORT или 3000.
 *   Так запросы не улетают на localhost клиента при доступе к сайту по IP/домену.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    const port = import.meta.env.VITE_API_PORT?.trim() || '3000'
    return `${protocol}//${hostname}:${port}`.replace(/\/$/, '')
  }

  return 'http://localhost:3000'
}
