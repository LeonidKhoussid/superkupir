/**
 * Посты: GET /posts (публично), POST /posts (JWT) — см. back/modules/posts, createPostSchema.
 */

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export class PostsApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'PostsApiError'
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

export interface PublicPostAuthor {
  id: string
  email: string
  is_guide: boolean
}

export interface PublicPostItem {
  id: number
  author: PublicPostAuthor
  title: string | null
  content: string
  image_urls: string[]
  created_at: string
  updated_at: string
}

export interface PostsListResult {
  items: PublicPostItem[]
  total: number
  limit: number
  offset: number
}

const parsePostId = (value: unknown): number | null => {
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

const parseAuthor = (value: unknown): PublicPostAuthor | null => {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' ? value.id : null
  const email = typeof value.email === 'string' ? value.email : null
  if (!id || !email) return null
  return {
    id,
    email,
    is_guide: value.is_guide === true,
  }
}

export const parsePublicPostItem = (value: unknown): PublicPostItem | null => {
  if (!isRecord(value)) return null
  const id = parsePostId(value.id)
  const author = parseAuthor(value.author)
  const content = typeof value.content === 'string' ? value.content : null
  if (id === null || !author || content === null) return null

  const rawImages = value.image_urls
  const image_urls: string[] = []
  if (Array.isArray(rawImages)) {
    for (const u of rawImages) {
      if (typeof u === 'string' && u.trim().length > 0) image_urls.push(u.trim())
    }
  }

  const title =
    value.title === null || value.title === undefined
      ? null
      : typeof value.title === 'string'
        ? value.title
        : null

  const created_at =
    typeof value.created_at === 'string'
      ? value.created_at
      : value.created_at instanceof Date
        ? value.created_at.toISOString()
        : ''
  const updated_at =
    typeof value.updated_at === 'string'
      ? value.updated_at
      : value.updated_at instanceof Date
        ? value.updated_at.toISOString()
        : ''

  return {
    id,
    author,
    title,
    content,
    image_urls,
    created_at,
    updated_at,
  }
}

const parsePostsListResult = (value: unknown): PostsListResult | null => {
  if (!isRecord(value)) return null
  const rawItems = value.items
  if (!Array.isArray(rawItems)) return null
  const items: PublicPostItem[] = []
  for (const row of rawItems) {
    const p = parsePublicPostItem(row)
    if (p) items.push(p)
  }
  const total =
    typeof value.total === 'number' && Number.isFinite(value.total)
      ? Math.max(0, Math.floor(value.total))
      : items.length
  const limit =
    typeof value.limit === 'number' && Number.isFinite(value.limit)
      ? Math.max(1, Math.floor(value.limit))
      : 20
  const offset =
    typeof value.offset === 'number' && Number.isFinite(value.offset)
      ? Math.max(0, Math.floor(value.offset))
      : 0
  return { items, total, limit, offset }
}

export type CreatePostInput = {
  /** Опционально; пустая строка на бэке не проходит — передаём `null` или не включаем поле. */
  title?: string | null
  content: string
  image_urls?: string[]
}

/**
 * Создание поста текущим пользователем: `POST /posts` (Bearer).
 * Тело: `content`, опционально `title`, `image_urls` (до 20 валидных URL).
 */
export async function createPost(token: string, input: CreatePostInput): Promise<PublicPostItem> {
  const trimmed = input.content.trim()
  if (trimmed.length < 1) {
    throw new PostsApiError('Текст поста не может быть пустым.')
  }

  const rawUrls = input.image_urls ?? []
  const image_urls: string[] = []
  const seen = new Set<string>()
  for (const u of rawUrls) {
    if (typeof u !== 'string') continue
    const t = u.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    image_urls.push(t)
    if (image_urls.length >= 20) break
  }

  const body: Record<string, unknown> = {
    content: trimmed,
    image_urls,
  }

  if (input.title !== undefined) {
    if (input.title === null) {
      body.title = null
    } else {
      const tt = input.title.trim()
      body.title = tt.length > 0 ? tt : null
    }
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new PostsApiError('Не удалось связаться с сервером.')
  }

  if (!response.ok) {
    throw new PostsApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new PostsApiError('Сервис вернул некорректный ответ.')
  }

  const parsed = parsePublicPostItem(payload)
  if (!parsed) {
    throw new PostsApiError('Сервис вернул некорректный ответ.')
  }
  return parsed
}

export type FetchPostsParams = {
  guide?: boolean
  mine?: boolean
  limit?: number
  offset?: number
  token?: string | null
}

export async function fetchPostsList(params: FetchPostsParams = {}): Promise<PostsListResult> {
  const qs = new URLSearchParams()
  if (params.guide === true) qs.set('guide', 'true')
  if (params.guide === false) qs.set('guide', 'false')
  if (params.mine === true) qs.set('mine', 'true')
  qs.set('limit', String(Math.min(100, Math.max(1, params.limit ?? 30))))
  qs.set('offset', String(Math.max(0, params.offset ?? 0)))

  const headers: Record<string, string> = {}
  if (params.token) {
    headers.Authorization = `Bearer ${params.token}`
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/posts?${qs.toString()}`, { headers })
  } catch {
    throw new PostsApiError('Не удалось связаться с сервером.')
  }

  if (!response.ok) {
    throw new PostsApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new PostsApiError('Сервис вернул некорректный ответ.')
  }

  const parsed = parsePostsListResult(payload)
  if (!parsed) {
    throw new PostsApiError('Сервис вернул некорректный ответ.')
  }
  return parsed
}
