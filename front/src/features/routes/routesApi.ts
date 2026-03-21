/**
 * Авторизованные эндпоинты маршрутов: POST /routes, GET /routes/:id (см. back/memory_backend.md).
 */

import { parsePublicPlace, type PublicPlace } from '../places/placesApi'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export class RoutesApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'RoutesApiError'
    this.status = status
  }
}

const extractErrorMessage = async (response: Response) => {
  try {
    const payload: unknown = await response.json()
    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error
    }
  } catch {
    /* ignore */
  }
  return 'Запрос не выполнен.'
}

const parseRouteId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    return n >= 1 ? n : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) {
      const t = Math.trunc(n)
      return t >= 1 ? t : null
    }
  }
  return null
}

export interface RoutePlaceRow {
  route_place_id: number
  place_id: number
  sort_order: number
  place: PublicPlace
}

export interface UserRouteDetail {
  id: number
  title: string
  description: string | null
  creation_mode: string
  season_id: number | null
  place_count: number
  revision_number: number
  places: RoutePlaceRow[]
}

const parseSortOrder = (value: unknown): number | null => {
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

const parseRoutePlaceRow = (value: unknown): RoutePlaceRow | null => {
  if (!isRecord(value)) return null
  const route_place_id = parseRouteId(value.route_place_id)
  const place_id = parseRouteId(value.place_id)
  const sort_order = parseSortOrder(value.sort_order)
  const place = parsePublicPlace(value.place)
  if (route_place_id === null || place_id === null || sort_order === null || !place) return null
  return { route_place_id, place_id, sort_order, place }
}

export const parseUserRouteDetail = (value: unknown): UserRouteDetail | null => {
  if (!isRecord(value)) return null
  const id = parseRouteId(value.id)
  const title = value.title
  if (id === null || typeof title !== 'string') return null

  const rawPlaces = value.places
  if (!Array.isArray(rawPlaces)) return null
  const places: RoutePlaceRow[] = []
  for (const row of rawPlaces) {
    const p = parseRoutePlaceRow(row)
    if (p) places.push(p)
  }
  places.sort((a, b) => a.sort_order - b.sort_order)

  const place_count =
    typeof value.place_count === 'number' && Number.isFinite(value.place_count)
      ? Math.max(0, Math.floor(value.place_count))
      : places.length

  const revision_number = parseSortOrder(value.revision_number) ?? 1

  return {
    id,
    title,
    description: typeof value.description === 'string' ? value.description : null,
    creation_mode: typeof value.creation_mode === 'string' ? value.creation_mode : 'manual',
    season_id:
      value.season_id === null || value.season_id === undefined
        ? null
        : parseRouteId(value.season_id),
    place_count,
    revision_number,
    places,
  }
}

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

export async function createRouteFromSelection(
  token: string,
  input: {
    title: string
    place_ids: number[]
    season_id?: number | null
    description?: string | null
  },
): Promise<UserRouteDetail> {
  const body: Record<string, unknown> = {
    title: input.title,
    creation_mode: 'selection_builder',
    place_ids: input.place_ids,
  }
  if (input.description !== undefined) {
    body.description = input.description
  }
  if (input.season_id != null && Number.isFinite(input.season_id)) {
    body.season_id = input.season_id
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/routes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    })
  } catch {
    throw new RoutesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new RoutesApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }

  const parsed = parseUserRouteDetail(payload)
  if (!parsed) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }
  return parsed
}

export async function fetchUserRouteById(token: string, id: number): Promise<UserRouteDetail> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/routes/${encodeURIComponent(String(id))}`, {
      method: 'GET',
      headers: authHeaders(token),
    })
  } catch {
    throw new RoutesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new RoutesApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }

  const parsed = parseUserRouteDetail(payload)
  if (!parsed) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }
  return parsed
}
