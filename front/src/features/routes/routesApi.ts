/**
 * Авторизованные эндпоинты маршрутов: GET /routes, POST /routes, GET /routes/:id.
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

export type RouteListScope = 'accessible' | 'owned'

export interface UserRouteOwner {
  id: string
  email: string
  is_guide: boolean
}

export interface UserRouteSummary {
  id: number
  owner: UserRouteOwner
  title: string
  description: string | null
  creation_mode: string
  season_id: number | null
  season_slug: string | null
  total_estimated_cost: number | null
  total_estimated_duration_minutes: number | null
  revision_number: number
  access_type: string
  place_count: number
  created_at: string
  updated_at: string
}

export interface UserRouteListResult {
  items: UserRouteSummary[]
  limit: number
  offset: number
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
  owner: UserRouteOwner
  title: string
  description: string | null
  creation_mode: string
  season_id: number | null
  season_slug: string | null
  total_estimated_cost: number | null
  total_estimated_duration_minutes: number | null
  place_count: number
  revision_number: number
  access_type: string
  created_at: string
  updated_at: string
  places: RoutePlaceRow[]
}

export interface UserRouteShareLink {
  id: number
  route_id: number
  token: string
  can_edit: boolean
  expires_at: string | null
  created_at: string
}

/** Ответ `GET /routes/shared/:token`: детали маршрута + флаг редактирования по ссылке. */
export type SharedRouteDetail = UserRouteDetail & {
  share_can_edit: boolean
}

const parseIsoDateString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString()
  }

  return null
}

const parseRouteOwner = (value: unknown): UserRouteOwner | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.email !== 'string') return null
  if (typeof value.is_guide !== 'boolean') return null

  return {
    id: value.id,
    email: value.email,
    is_guide: value.is_guide,
  }
}

const parseNonNegativeInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    return n >= 0 ? n : null
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  return null
}

const parseNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const parseUserRouteSummary = (value: unknown): UserRouteSummary | null => {
  if (!isRecord(value)) return null
  const id = parseRouteId(value.id)
  const owner = parseRouteOwner(value.owner)
  const title = value.title
  const created_at = parseIsoDateString(value.created_at)
  const updated_at = parseIsoDateString(value.updated_at)

  if (id === null || !owner || typeof title !== 'string' || !created_at || !updated_at) {
    return null
  }

  const place_count = parseNonNegativeInt(value.place_count)
  const revision_number = parseSortOrder(value.revision_number) ?? 1

  return {
    id,
    owner,
    title,
    description: typeof value.description === 'string' ? value.description : null,
    creation_mode: typeof value.creation_mode === 'string' ? value.creation_mode : 'manual',
    season_id:
      value.season_id === null || value.season_id === undefined ? null : parseRouteId(value.season_id),
    season_slug: typeof value.season_slug === 'string' ? value.season_slug : null,
    total_estimated_cost: parseNullableNumber(value.total_estimated_cost),
    total_estimated_duration_minutes:
      value.total_estimated_duration_minutes === null || value.total_estimated_duration_minutes === undefined
        ? null
        : parseNonNegativeInt(value.total_estimated_duration_minutes),
    revision_number,
    access_type: typeof value.access_type === 'string' ? value.access_type : 'owner',
    place_count: place_count ?? 0,
    created_at,
    updated_at,
  }
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
  const summary = parseUserRouteSummary(value)
  if (!summary || !isRecord(value)) return null

  const rawPlaces = value.places
  if (!Array.isArray(rawPlaces)) return null
  const places: RoutePlaceRow[] = []
  for (const row of rawPlaces) {
    const p = parseRoutePlaceRow(row)
    if (p) places.push(p)
  }
  places.sort((a, b) => a.sort_order - b.sort_order)

  return {
    ...summary,
    place_count: summary.place_count || places.length,
    places,
  }
}

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

async function parseJsonPayload(response: Response) {
  try {
    return (await response.json()) as unknown
  } catch {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }
}

async function fetchRoutesResponse(
  token: string,
  pathWithQuery: string,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${pathWithQuery}`, {
      method: 'GET',
      headers: authHeaders(token),
    })
  } catch {
    throw new RoutesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new RoutesApiError(await extractErrorMessage(response), response.status)
  }

  return parseJsonPayload(response)
}

async function requestRoutesMutation(
  token: string,
  pathWithQuery: string,
  input: {
    method: 'POST' | 'PATCH' | 'DELETE'
    body?: Record<string, unknown>
  },
): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${pathWithQuery}`, {
      method: input.method,
      headers: authHeaders(token),
      body: input.body ? JSON.stringify(input.body) : undefined,
    })
  } catch {
    throw new RoutesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new RoutesApiError(await extractErrorMessage(response), response.status)
  }

  return parseJsonPayload(response)
}

const parseRouteDetailPayload = (payload: unknown): UserRouteDetail => {
  const parsed = parseUserRouteDetail(payload)
  if (!parsed) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }
  return parsed
}

const parseUserRouteShareLink = (value: unknown): UserRouteShareLink | null => {
  if (!isRecord(value)) return null

  const id = parseRouteId(value.id)
  const route_id = parseRouteId(value.route_id)
  const created_at = parseIsoDateString(value.created_at)
  const expires_at =
    value.expires_at === null || value.expires_at === undefined
      ? null
      : parseIsoDateString(value.expires_at)

  if (id === null || route_id === null || !created_at) {
    return null
  }

  if (typeof value.token !== 'string' || typeof value.can_edit !== 'boolean') {
    return null
  }

  return {
    id,
    route_id,
    token: value.token,
    can_edit: value.can_edit,
    expires_at,
    created_at,
  }
}

const parseSharedRouteDetailPayload = (value: unknown): SharedRouteDetail | null => {
  if (!isRecord(value) || typeof value.can_edit !== 'boolean') {
    return null
  }
  const detail = parseUserRouteDetail(value)
  if (!detail) return null
  return { ...detail, share_can_edit: value.can_edit }
}

export async function fetchUserRoutes(
  token: string,
  input: {
    scope?: RouteListScope
    limit?: number
    offset?: number
  } = {},
): Promise<UserRouteListResult> {
  const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 50)))
  const offset = Math.max(0, Math.trunc(input.offset ?? 0))
  const scope = input.scope ?? 'accessible'
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    scope,
  })
  const payload = await fetchRoutesResponse(token, `/routes?${params.toString()}`)

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }

  const items: UserRouteSummary[] = []
  for (const item of payload.items) {
    const parsed = parseUserRouteSummary(item)
    if (parsed) items.push(parsed)
  }

  return {
    items,
    limit:
      typeof payload.limit === 'number' && Number.isFinite(payload.limit)
        ? Math.max(1, Math.floor(payload.limit))
        : limit,
    offset:
      typeof payload.offset === 'number' && Number.isFinite(payload.offset)
        ? Math.max(0, Math.floor(payload.offset))
        : offset,
  }
}

export async function fetchAllUserRoutes(
  token: string,
  input: { scope?: RouteListScope; pageLimit?: number } = {},
): Promise<UserRouteSummary[]> {
  const pageLimit = Math.max(1, Math.min(100, Math.trunc(input.pageLimit ?? 50)))
  const scope = input.scope ?? 'accessible'
  const items: UserRouteSummary[] = []
  let offset = 0

  while (true) {
    const page = await fetchUserRoutes(token, {
      scope,
      limit: pageLimit,
      offset,
    })

    items.push(...page.items)

    if (page.items.length < page.limit) {
      break
    }

    offset += page.items.length
  }

  return items
}

/** Тело `POST /routes/from-quiz` (продуктовый квиз, rule-based на бэкенде). */
export type CreateRouteFromQuizInput = {
  people_count: number
  season: string
  budget_from: number
  budget_to: number
  excursion_type: string
  days_count: number
  title?: string
  description?: string | null
}

export async function createRouteFromQuiz(
  token: string,
  input: CreateRouteFromQuizInput,
): Promise<UserRouteDetail> {
  const payload = await requestRoutesMutation(token, '/routes/from-quiz', {
    method: 'POST',
    body: {
      people_count: input.people_count,
      season: input.season,
      budget_from: input.budget_from,
      budget_to: input.budget_to,
      excursion_type: input.excursion_type,
      days_count: input.days_count,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  })

  return parseRouteDetailPayload(payload)
}

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

  const payload = await requestRoutesMutation(token, '/routes', {
    method: 'POST',
    body,
  })

  return parseRouteDetailPayload(payload)
}

export async function fetchUserRouteById(token: string, id: number): Promise<UserRouteDetail> {
  const payload = await fetchRoutesResponse(token, `/routes/${encodeURIComponent(String(id))}`)

  return parseRouteDetailPayload(payload)
}

/**
 * Публичный просмотр маршрута по share-token (без JWT).
 * Бэкенд: `GET /routes/shared/:token`.
 */
export async function fetchSharedRouteByToken(shareToken: string): Promise<SharedRouteDetail> {
  const trimmed = shareToken.trim()
  if (!trimmed) {
    throw new RoutesApiError('В ссылке нет ключа доступа.')
  }

  let response: Response
  try {
    response = await fetch(
      `${apiBaseUrl}/routes/shared/${encodeURIComponent(trimmed)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    )
  } catch {
    throw new RoutesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  const payload = await parseJsonPayload(response)

  if (!response.ok) {
    const msg =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : response.status === 404
          ? 'Ссылка недействительна или срок действия истёк.'
          : 'Не удалось открыть маршрут по ссылке.'
    throw new RoutesApiError(msg, response.status)
  }

  const parsed = parseSharedRouteDetailPayload(payload)
  if (!parsed) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }

  return parsed
}

/**
 * Привязать маршрут по share-token к текущему пользователю (`POST /routes/shared/:token/access`).
 */
export async function attachSharedRouteToUser(
  authToken: string,
  shareToken: string,
): Promise<UserRouteDetail> {
  const trimmed = shareToken.trim()
  if (!trimmed) {
    throw new RoutesApiError('В ссылке нет ключа доступа.')
  }

  const payload = await requestRoutesMutation(
    authToken,
    `/routes/shared/${encodeURIComponent(trimmed)}/access`,
    { method: 'POST' },
  )

  return parseRouteDetailPayload(payload)
}

export async function addRoutePlace(
  token: string,
  routeId: number,
  input: {
    revision_number: number
    place_id: number
    sort_order: number
    day_number?: number | null
    estimated_travel_minutes_from_previous?: number | null
    estimated_distance_km_from_previous?: number | null
    stay_duration_minutes?: number | null
  },
): Promise<UserRouteDetail> {
  const payload = await requestRoutesMutation(token, `/routes/${encodeURIComponent(String(routeId))}/places`, {
    method: 'POST',
    body: input,
  })

  return parseRouteDetailPayload(payload)
}

export async function updateRoutePlace(
  token: string,
  routeId: number,
  routePlaceId: number,
  input: {
    revision_number: number
    sort_order?: number
    day_number?: number | null
    estimated_travel_minutes_from_previous?: number | null
    estimated_distance_km_from_previous?: number | null
    stay_duration_minutes?: number | null
  },
): Promise<UserRouteDetail> {
  const payload = await requestRoutesMutation(
    token,
    `/routes/${encodeURIComponent(String(routeId))}/places/${encodeURIComponent(String(routePlaceId))}`,
    {
      method: 'PATCH',
      body: input,
    },
  )

  return parseRouteDetailPayload(payload)
}

export async function deleteRoutePlace(
  token: string,
  routeId: number,
  routePlaceId: number,
  revisionNumber: number,
): Promise<UserRouteDetail> {
  const params = new URLSearchParams({
    revision_number: String(revisionNumber),
  })

  const payload = await requestRoutesMutation(
    token,
    `/routes/${encodeURIComponent(String(routeId))}/places/${encodeURIComponent(String(routePlaceId))}?${params.toString()}`,
    {
      method: 'DELETE',
    },
  )

  return parseRouteDetailPayload(payload)
}

export async function createRouteShareLink(
  token: string,
  routeId: number,
  input: {
    can_edit?: boolean
    expires_at?: string | null
  } = {},
): Promise<UserRouteShareLink> {
  const payload = await requestRoutesMutation(token, `/routes/${encodeURIComponent(String(routeId))}/share`, {
    method: 'POST',
    body: {
      can_edit: input.can_edit ?? true,
      expires_at: input.expires_at ?? null,
    },
  })

  const parsed = parseUserRouteShareLink(payload)

  if (!parsed) {
    throw new RoutesApiError('Сервис вернул некорректный ответ.')
  }

  return parsed
}
