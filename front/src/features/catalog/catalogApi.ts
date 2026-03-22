/**
 * Публичный каталог таксономии: GET /seasons (см. back/memory_backend.md).
 */

import { getApiBaseUrl } from '../../lib/apiBaseUrl'
import { PlacesApiError } from '../places/placesApi'

const apiBaseUrl = getApiBaseUrl()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    return n >= 1 ? n : null
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value)
    return Number.isFinite(n) && n >= 1 ? n : null
  }
  return null
}

export interface CatalogSeason {
  id: number
  name: string
  slug: string
}

const parseSeason = (value: unknown): CatalogSeason | null => {
  if (!isRecord(value)) return null
  const id = parseId(value.id)
  const name = value.name
  const slug = value.slug
  if (id === null || typeof name !== 'string' || typeof slug !== 'string') return null
  return { id, name, slug }
}

export async function fetchSeasons(): Promise<CatalogSeason[]> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/seasons`)
  } catch {
    throw new PlacesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new PlacesApiError('Не удалось загрузить сезоны.', response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  const out: CatalogSeason[] = []
  for (const row of payload.items) {
    const s = parseSeason(row)
    if (s) out.push(s)
  }
  return out
}
