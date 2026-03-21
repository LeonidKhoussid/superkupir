/**
 * Клиент для публичных read-only эндпоинтов мест (см. back/memory_backend.md: GET /places, GET /places/:id).
 * База URL совпадает с auth: VITE_API_BASE_URL или http://localhost:3000
 */

export class PlacesApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'PlacesApiError'
    this.status = status
  }
}

export interface PublicPlace {
  id: number
  external_id: string
  name: string
  source_location: string | null
  card_url: string | null
  logo_url: string | null
  size: string | null
  description: string | null
  photo_urls: string[]
  lat: number | null
  lon: number | null
  coordinates_raw: string | null
  address: string | null
}

export interface PlacesListResponse {
  items: PublicPlace[]
  total: number
  limit: number
  offset: number
}

/**
 * Первый элемент `photo_urls` — непустая строка после trim (как в контракте backend: массив URL).
 * Пустой массив, пробелы или отсутствие первого URL считаются «без фото» для витрины.
 */
export function placeHasDisplayablePhoto(place: PublicPlace): boolean {
  const raw = place.photo_urls[0]
  return typeof raw === 'string' && raw.trim().length > 0
}

/**
 * Витрина карусели: сначала места с фото, затем без — внутри каждой группы сохраняется порядок из ответа API.
 */
export function prioritizePlacesWithPhotos(places: PublicPlace[]): PublicPlace[] {
  const withPhoto: PublicPlace[] = []
  const without: PublicPlace[] = []
  for (const p of places) {
    if (placeHasDisplayablePhoto(p)) withPhoto.push(p)
    else without.push(p)
  }
  return [...withPhoto, ...without]
}

/** Валидные координаты для карты: `lat`/`lon` из API (WGS84), диапазоны широта/долгота. */
export function placeHasValidCoordinates(place: PublicPlace): boolean {
  const { lat, lon } = place
  if (lat == null || lon == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  return true
}

/** Порядок координат для Yandex Maps API: [широта, долгота]. */
export function getPlaceLatLon(place: PublicPlace): [number, number] | null {
  if (!placeHasValidCoordinates(place)) return null
  return [place.lat as number, place.lon as number]
}

/** Размер страницы для бесконечной подгрузки (≤ 100 по контракту backend). */
export const PLACES_PAGE_SIZE_EXPLORER = 25

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

/** Backend может отдавать BIGINT / сериализацию как строку — нормализуем в finite number. */
const parsePlaceId = (value: unknown): number | null => {
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

const parseOptionalCoord = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const parseEnvelopeInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value)
  }
  return null
}

export const parsePublicPlace = (value: unknown): PublicPlace | null => {
  if (!isRecord(value)) return null

  const id = parsePlaceId(value.id)
  const external_id = value.external_id
  const name = value.name

  if (id === null) return null
  if (typeof external_id !== 'string') return null
  if (typeof name !== 'string') return null

  return {
    id,
    external_id,
    name,
    source_location: typeof value.source_location === 'string' ? value.source_location : null,
    card_url: typeof value.card_url === 'string' ? value.card_url : null,
    logo_url: typeof value.logo_url === 'string' ? value.logo_url : null,
    size: typeof value.size === 'string' ? value.size : null,
    description: typeof value.description === 'string' ? value.description : null,
    photo_urls: parseStringArray(value.photo_urls),
    lat: parseOptionalCoord(value.lat),
    lon: parseOptionalCoord(value.lon),
    coordinates_raw:
      typeof value.coordinates_raw === 'string' ? value.coordinates_raw : null,
    address: typeof value.address === 'string' ? value.address : null,
  }
}

const parsePlacesListResponse = (value: unknown): PlacesListResponse => {
  if (!isRecord(value)) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  const rawItems = value.items
  if (!Array.isArray(rawItems)) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  const items: PublicPlace[] = []
  for (const row of rawItems) {
    const place = parsePublicPlace(row)
    if (place) items.push(place)
  }

  const total = parseEnvelopeInt(value.total)
  const limit = parseEnvelopeInt(value.limit)
  const offset = parseEnvelopeInt(value.offset)

  if (total === null || limit === null || offset === null) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  return { items, total, limit, offset }
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

const requestJson = async <T>(path: string, parse: (value: unknown) => T): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { method: 'GET' })
  } catch {
    throw new PlacesApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new PlacesApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }

  return parse(payload)
}

export type FetchPlacesParams = {
  /** 1..100 по контракту backend */
  limit?: number
  offset?: number
}

/**
 * GET /places — первая страница для лендинга: limit по умолчанию 12, offset 0, порядок id ASC на стороне API.
 */
export const fetchPlacesList = (params: FetchPlacesParams = {}) => {
  const limit = params.limit ?? 12
  const offset = params.offset ?? 0
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  qs.set('offset', String(offset))
  return requestJson(`/places?${qs.toString()}`, parsePlacesListResponse)
}

/**
 * GET /places/:id — внутренний числовой id из БД (не external_id).
 */
export const fetchPlaceById = (id: number) =>
  requestJson(`/places/${encodeURIComponent(String(id))}`, (value: unknown) => {
    const place = parsePublicPlace(value)
    if (!place) {
      throw new PlacesApiError('Сервис вернул некорректный ответ.')
    }
    return place
  })
