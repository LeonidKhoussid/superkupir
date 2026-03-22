/**
 * Уникальный id для клиентских ключей React. `crypto.randomUUID` в части окружений
 * недоступен (HTTP не localhost, старые браузеры).
 */
export function randomClientId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID()
    } catch {
      /* fall through */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
