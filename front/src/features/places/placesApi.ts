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
  name: string
  source_location: string | null
  card_url: string | null
  logo_url: string | null
  size: string | null
  description: string | null
  /** Доп. поля публичного контракта backend (toPublicPlace) — для сезонов и рекомендаций. */
  short_description: string | null
  photo_urls: string[]
  lat: number | null
  lon: number | null
  coordinates_raw: string | null
  address: string | null
  type_slug: string | null
  season_slugs: string[]
  estimated_cost: number | null
  estimated_duration_minutes: number | null
  radius_group: string | null
  is_active: boolean
}

/** Ответ POST /places/recommendations: место + расстояние до якоря (км), если есть. */
export interface PublicPlaceRecommendation extends PublicPlace {
  distance_km: number | null
}

/** Подпись для UI: не показываем 0 / NaN / отрицательные значения. */
export function formatRecommendationDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km <= 0) return null
  if (km < 1) return `${Math.round(km * 1000)} м от точки`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} км от точки`
}

export interface PlacesListResponse {
  items: PublicPlace[]
  total: number
  limit: number
  offset: number
}

/**
 * Первый элемент `photo_urls` — непустая строка после trim (как в контракте backend: массив URL).
 * Та же логика, что у карточки каталога для выбора картинки.
 */
export function getPrimaryDisplayPhotoUrl(place: PublicPlace): string | null {
  const raw = place.photo_urls[0]
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/**
 * Первый элемент `photo_urls` — непустая строка после trim (как в контракте backend: массив URL).
 * Пустой массив, пробелы или отсутствие первого URL считаются «без фото» для витрины.
 */
export function placeHasDisplayablePhoto(place: PublicPlace): boolean {
  return getPrimaryDisplayPhotoUrl(place) !== null
}

function partitionPlacesByCatalogImagePriority(places: PublicPlace[]): {
  unique: PublicPlace[]
  duplicate: PublicPlace[]
  noImage: PublicPlace[]
} {
  const counts = new Map<string, number>()
  for (const p of places) {
    const url = getPrimaryDisplayPhotoUrl(p)
    if (url) counts.set(url, (counts.get(url) ?? 0) + 1)
  }
  const unique: PublicPlace[] = []
  const duplicate: PublicPlace[] = []
  const noImage: PublicPlace[] = []
  for (const p of places) {
    const url = getPrimaryDisplayPhotoUrl(p)
    if (!url) noImage.push(p)
    else if ((counts.get(url) ?? 0) === 1) unique.push(p)
    else duplicate.push(p)
  }
  return { unique, duplicate, noImage }
}

/**
 * Порядок для каталога мест: уникальный primary URL → тот же URL у нескольких мест → без фото.
 * Primary = `getPrimaryDisplayPhotoUrl` (первый непустой `photo_urls[0]` после trim).
 * Внутри каждой группы сохраняется исходный порядок массива `places`.
 */
export function orderPlacesByCatalogImagePriority(places: PublicPlace[]): PublicPlace[] {
  const { unique, duplicate, noImage } = partitionPlacesByCatalogImagePriority(places)
  return [...unique, ...duplicate, ...noImage]
}

/**
 * Те же три группы по фото, что и {@link orderPlacesByCatalogImagePriority}, но порядок внутри
 * каждой группы перемешан (Fisher–Yates). `random01` должна вести себя как `Math.random`: [0, 1).
 */
export function orderPlacesByCatalogImagePriorityRandomized(
  places: PublicPlace[],
  random01: () => number,
): PublicPlace[] {
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random01() * (i + 1))
      const tmp = a[i]!
      a[i] = a[j]!
      a[j] = tmp
    }
    return a
  }
  const { unique, duplicate, noImage } = partitionPlacesByCatalogImagePriority(places)
  return [...shuffle(unique), ...shuffle(duplicate), ...shuffle(noImage)]
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

/** Максимальный `limit` для `GET /places` по контракту backend. */
export const PLACES_LIST_MAX_LIMIT = 100

/** Размер первой страницы каталога `/places` — нужен быстрый первый рендер, остальное догружается в фоне. */
export const PLACES_CATALOG_FETCH_LIMIT = 24

/** Размер фоновой догрузки каталога и модалки добавления остановок. */
export const PLACES_BACKGROUND_FETCH_LIMIT = 100

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

const parseOptionalFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const parseSeasonSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

export const parsePublicPlace = (value: unknown): PublicPlace | null => {
  if (!isRecord(value)) return null

  const id = parsePlaceId(value.id)
  const name = value.name

  if (id === null) return null
  if (typeof name !== 'string') return null

  return {
    id,
    name,
    source_location: typeof value.source_location === 'string' ? value.source_location : null,
    card_url: typeof value.card_url === 'string' ? value.card_url : null,
    logo_url: typeof value.logo_url === 'string' ? value.logo_url : null,
    size: typeof value.size === 'string' ? value.size : null,
    description: typeof value.description === 'string' ? value.description : null,
    short_description:
      typeof value.short_description === 'string' ? value.short_description : null,
    photo_urls: parseStringArray(value.photo_urls),
    lat: parseOptionalCoord(value.lat),
    lon: parseOptionalCoord(value.lon),
    coordinates_raw:
      typeof value.coordinates_raw === 'string' ? value.coordinates_raw : null,
    address: typeof value.address === 'string' ? value.address : null,
    type_slug: typeof value.type_slug === 'string' ? value.type_slug : null,
    season_slugs: parseSeasonSlugs(value.season_slugs),
    estimated_cost: parseOptionalFiniteNumber(value.estimated_cost),
    estimated_duration_minutes: parseOptionalFiniteNumber(value.estimated_duration_minutes),
    radius_group: typeof value.radius_group === 'string' ? value.radius_group : null,
    is_active: typeof value.is_active === 'boolean' ? value.is_active : true,
  }
}

export const parsePublicPlaceRecommendation = (value: unknown): PublicPlaceRecommendation | null => {
  const base = parsePublicPlace(value)
  if (!base) return null
  const dk = isRecord(value) ? value.distance_km : undefined
  let distance_km: number | null = null
  if (typeof dk === 'number' && Number.isFinite(dk)) {
    distance_km = dk
  } else if (typeof dk === 'string' && dk.trim() !== '') {
    const n = Number(dk)
    if (Number.isFinite(n)) distance_km = n
  }
  return { ...base, distance_km }
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

export type PlaceRecommendationsRequest = {
  season_slug?: string
  season_id?: number
  anchor_place_id?: number
  /** Ограничить выдачу типом места (`place_types.slug`), как у якоря. */
  type_slug?: string
  exclude_place_ids?: number[]
  radius_km?: number
  limit?: number
}

export interface PlaceRecommendationsResponse {
  items: PublicPlaceRecommendation[]
  total: number
  limit: number
  /** Сервер: якорный фильтр не дал строк — отдан более широкий сезонный срез. */
  recommendation_broad_fallback?: boolean
}

const parsePlaceRecommendationsResponse = (value: unknown): PlaceRecommendationsResponse => {
  if (!isRecord(value)) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }
  const rawItems = value.items
  if (!Array.isArray(rawItems)) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }
  const items: PublicPlaceRecommendation[] = []
  for (const row of rawItems) {
    const p = parsePublicPlaceRecommendation(row)
    if (p) items.push(p)
  }
  const total = parseEnvelopeInt(value.total)
  const limit = parseEnvelopeInt(value.limit)
  if (total === null || limit === null) {
    throw new PlacesApiError('Сервис вернул некорректный ответ.')
  }
  const recommendation_broad_fallback =
    value.recommendation_broad_fallback === true ? true : undefined
  return { items, total, limit, recommendation_broad_fallback }
}

/**
 * POST /places/recommendations — публичный эндпоинт; требуется `season_id` или `season_slug` (контракт backend).
 */
export async function fetchPlaceRecommendations(
  input: PlaceRecommendationsRequest,
  init?: { signal?: AbortSignal },
): Promise<PlaceRecommendationsResponse> {
  const body: Record<string, unknown> = {
    exclude_place_ids: input.exclude_place_ids ?? [],
    radius_km: input.radius_km ?? 75,
    limit: input.limit ?? 40,
  }
  if (input.season_slug !== undefined) {
    body.season_slug = input.season_slug
  }
  if (input.season_id !== undefined) {
    body.season_id = input.season_id
  }
  if (input.anchor_place_id !== undefined) {
    body.anchor_place_id = input.anchor_place_id
  }
  if (input.type_slug !== undefined && input.type_slug.trim() !== '') {
    body.type_slug = input.type_slug.trim()
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/places/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: init?.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e
    }
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

  return parsePlaceRecommendationsResponse(payload)
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

export function appendUniquePlaces(
  current: PublicPlace[],
  incoming: PublicPlace[],
): PublicPlace[] {
  if (incoming.length === 0) return current

  const seen = new Set(current.map((place) => place.id))
  const uniqueIncoming = incoming.filter((place) => !seen.has(place.id))

  return uniqueIncoming.length > 0 ? [...current, ...uniqueIncoming] : current
}

export type FetchAllPlacesOptions = {
  /** Параметр `limit` для каждого запроса; по умолчанию `PLACES_LIST_MAX_LIMIT`. Не больше backend-максимума. */
  pageLimit?: number
}

/**
 * Последовательно запрашивает страницы `GET /places`, пока не собраны все записи по `total`
 * (дедуп по `id` на случай пересечений). Используется только там, где действительно нужна полная коллекция.
 */
export async function fetchAllPlaces(options?: FetchAllPlacesOptions): Promise<PublicPlace[]> {
  const requested = options?.pageLimit ?? PLACES_LIST_MAX_LIMIT
  const limit = Math.min(PLACES_LIST_MAX_LIMIT, Math.max(1, Math.floor(requested)))
  const byId = new Map<number, PublicPlace>()
  let offset = 0
  let total: number | null = null

  for (let guard = 0; guard < 500; guard += 1) {
    const res = await fetchPlacesList({ limit, offset })
    total = res.total
    for (const p of res.items) {
      byId.set(p.id, p)
    }
    if (res.items.length === 0) break
    if (byId.size >= res.total) break
    offset += res.items.length
    if (offset >= res.total) break
  }

  const list = Array.from(byId.values())
  if (total !== null && list.length !== total) {
    /* возможны пропуски id в выборке API — оставляем собранное */
  }
  return list
}

/**
 * GET /places/:id — внутренний числовой id из БД.
 */
export const fetchPlaceById = (id: number) =>
  requestJson(`/places/${encodeURIComponent(String(id))}`, (value: unknown) => {
    const place = parsePublicPlace(value)
    if (!place) {
      throw new PlacesApiError('Сервис вернул некорректный ответ.')
    }
    return place
  })
