import { getApiBaseUrl } from '../../lib/apiBaseUrl'

export class PlaceInteractionsApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'PlaceInteractionsApiError'
    this.status = status
  }
}

export interface PlaceLikeSummary {
  place_id: number
  likes_count: number
  liked_by_current_user: boolean | null
}

export interface PlaceCommentAuthor {
  id: string
  email: string
}

export interface PlaceComment {
  id: number
  place_id: number
  user: PlaceCommentAuthor
  content: string
  created_at: string
  updated_at: string
}

export interface PlaceCommentsResponse {
  items: PlaceComment[]
  total: number
  limit: number
  offset: number
}

export interface PlaceLikeMutationResponse {
  liked: boolean
  likes_count: number
}

export interface PlaceInteractionSnapshot {
  placeId: number
  likesCount: number
  commentsCount: number
  likedByCurrentUser: boolean
}

type RequestOptions = {
  token?: string | null
}

const apiBaseUrl = getApiBaseUrl()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value)
    return normalized >= 0 ? normalized : null
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value)
  }

  return null
}

const mapBackendError = (status: number, rawMessage?: string) => {
  if (status === 401) return 'Войдите, чтобы ставить лайки и оставлять комментарии.'
  if (status === 404) return 'Место не найдено.'
  if (status === 400) return 'Проверьте корректность запроса.'
  if (status >= 500) return 'Сервис взаимодействий временно недоступен.'

  if (rawMessage === 'Route not found') {
    return 'Сервис взаимодействий недоступен.'
  }

  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

const extractErrorMessage = async (response: Response) => {
  try {
    const payload: unknown = await response.json()

    if (isRecord(payload) && typeof payload.error === 'string') {
      return mapBackendError(response.status, payload.error)
    }
  } catch {
    return mapBackendError(response.status)
  }

  return mapBackendError(response.status)
}

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
  options?: RequestOptions,
) => {
  const headers = new Headers(init.headers)

  if (init.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (options?.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    })
  } catch {
    throw new PlaceInteractionsApiError(
      'Не удалось связаться с сервером. Проверьте подключение.',
    )
  }

  if (!response.ok) {
    throw new PlaceInteractionsApiError(
      await extractErrorMessage(response),
      response.status,
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  return parse(payload)
}

const parsePlaceLikeSummary = (value: unknown): PlaceLikeSummary => {
  if (!isRecord(value)) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  const placeId = parsePositiveInt(value.place_id)
  const likesCount = parsePositiveInt(value.likes_count)
  const likedByCurrentUser = value.liked_by_current_user

  if (placeId === null || placeId < 1 || likesCount === null) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  if (
    likedByCurrentUser !== null &&
    typeof likedByCurrentUser !== 'boolean'
  ) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  return {
    place_id: placeId,
    likes_count: likesCount,
    liked_by_current_user: likedByCurrentUser,
  }
}

const parsePlaceLikeMutation = (value: unknown): PlaceLikeMutationResponse => {
  if (!isRecord(value)) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  const likesCount = parsePositiveInt(value.likes_count)

  if (typeof value.liked !== 'boolean' || likesCount === null) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  return {
    liked: value.liked,
    likes_count: likesCount,
  }
}

const parseCommentAuthor = (value: unknown): PlaceCommentAuthor | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.email !== 'string') {
    return null
  }

  return { id: value.id, email: value.email }
}

const parsePlaceComment = (value: unknown): PlaceComment | null => {
  if (!isRecord(value)) return null

  const id = parsePositiveInt(value.id)
  const placeId = parsePositiveInt(value.place_id)
  const author = parseCommentAuthor(value.user)

  if (id === null || id < 1 || placeId === null || placeId < 1 || !author) {
    return null
  }

  if (
    typeof value.content !== 'string' ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    return null
  }

  return {
    id,
    place_id: placeId,
    user: author,
    content: value.content,
    created_at: value.created_at,
    updated_at: value.updated_at,
  }
}

const parsePlaceCommentsResponse = (value: unknown): PlaceCommentsResponse => {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  const total = parsePositiveInt(value.total)
  const limit = parsePositiveInt(value.limit)
  const offset = parsePositiveInt(value.offset)

  if (total === null || limit === null || offset === null) {
    throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
  }

  return {
    items: value.items
      .map((item) => parsePlaceComment(item))
      .filter((item): item is PlaceComment => item !== null),
    total,
    limit,
    offset,
  }
}

export const fetchPlaceLikesSummary = (placeId: number, token?: string | null) =>
  requestJson(
    `/places/${encodeURIComponent(String(placeId))}/likes`,
    { method: 'GET' },
    parsePlaceLikeSummary,
    { token },
  )

export const likePlace = (placeId: number, token: string) =>
  requestJson(
    `/places/${encodeURIComponent(String(placeId))}/like`,
    { method: 'POST' },
    parsePlaceLikeMutation,
    { token },
  )

export const unlikePlace = (placeId: number, token: string) =>
  requestJson(
    `/places/${encodeURIComponent(String(placeId))}/like`,
    { method: 'DELETE' },
    parsePlaceLikeMutation,
    { token },
  )

export const fetchPlaceComments = (
  placeId: number,
  params: { limit?: number; offset?: number } = {},
) => {
  const qs = new URLSearchParams()
  qs.set('limit', String(params.limit ?? 20))
  qs.set('offset', String(params.offset ?? 0))

  return requestJson(
    `/places/${encodeURIComponent(String(placeId))}/comments?${qs.toString()}`,
    { method: 'GET' },
    parsePlaceCommentsResponse,
  )
}

export const createPlaceComment = (
  placeId: number,
  content: string,
  token: string,
) =>
  requestJson(
    `/places/${encodeURIComponent(String(placeId))}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
    (value: unknown) => {
      const comment = parsePlaceComment(value)

      if (!comment) {
        throw new PlaceInteractionsApiError('Сервис вернул некорректный ответ.')
      }

      return comment
    },
    { token },
  )

const createDefaultSnapshot = (placeId: number): PlaceInteractionSnapshot => ({
  placeId,
  likesCount: 0,
  commentsCount: 0,
  likedByCurrentUser: false,
})

const fetchPlaceInteractionSnapshot = async (
  placeId: number,
  token?: string | null,
): Promise<PlaceInteractionSnapshot> => {
  const [likes, comments] = await Promise.all([
    fetchPlaceLikesSummary(placeId, token),
    fetchPlaceComments(placeId, { limit: 1, offset: 0 }),
  ])

  return {
    placeId,
    likesCount: likes.likes_count,
    commentsCount: comments.total,
    likedByCurrentUser: likes.liked_by_current_user === true,
  }
}

export const hydratePlaceInteractions = async (
  placeIds: number[],
  token?: string | null,
  concurrency = 4,
) => {
  const uniqueIds = [...new Set(placeIds)]
  const snapshots: Record<number, PlaceInteractionSnapshot> = {}

  if (uniqueIds.length === 0) {
    return snapshots
  }

  let cursor = 0
  const workerCount = Math.max(1, Math.min(concurrency, uniqueIds.length))

  const worker = async () => {
    while (cursor < uniqueIds.length) {
      const currentIndex = cursor
      cursor += 1

      const placeId = uniqueIds[currentIndex]

      try {
        snapshots[placeId] = await fetchPlaceInteractionSnapshot(placeId, token)
      } catch {
        snapshots[placeId] = createDefaultSnapshot(placeId)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return snapshots
}
