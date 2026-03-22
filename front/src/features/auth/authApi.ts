import { getApiBaseUrl } from '../../lib/apiBaseUrl'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser
  token: string
}

export interface CredentialsPayload {
  email: string
  password: string
}

export class AuthApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

const apiBaseUrl = getApiBaseUrl()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseAuthUser = (value: unknown): AuthUser | null => {
  if (!isRecord(value)) return null

  const { id, email } = value

  if (typeof id !== 'string' || typeof email !== 'string') {
    return null
  }

  return { id, email }
}

const parseAuthSession = (value: unknown): AuthSession => {
  if (!isRecord(value)) {
    throw new AuthApiError('Сервис вернул некорректный ответ.')
  }

  const user = parseAuthUser(value.user)
  const { token } = value

  if (!user || typeof token !== 'string' || token.length === 0) {
    throw new AuthApiError('Сервис вернул некорректный ответ.')
  }

  return { user, token }
}

const parseCurrentUser = (value: unknown): AuthUser => {
  if (!isRecord(value)) {
    throw new AuthApiError('Сервис вернул некорректный ответ.')
  }

  const user = parseAuthUser(value.user)

  if (!user) {
    throw new AuthApiError('Сервис вернул некорректный ответ.')
  }

  return user
}

const mapBackendError = (status: number, rawMessage?: string) => {
  if (status === 401) return 'Неверный email или пароль.'
  if (status === 409) return 'Пользователь с таким email уже существует.'
  if (status === 400) return 'Проверьте корректность введённых данных.'
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'

  if (rawMessage === 'Route not found') {
    return 'Сервис авторизации недоступен.'
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
) => {
  const headers = new Headers(init.headers)

  if (init.body) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    })
  } catch {
    throw new AuthApiError('Не удалось связаться с сервером. Проверьте подключение.')
  }

  if (!response.ok) {
    throw new AuthApiError(await extractErrorMessage(response), response.status)
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new AuthApiError('Сервис вернул некорректный ответ.')
  }

  return parse(payload)
}

export const loginWithCredentials = (payload: CredentialsPayload) =>
  requestJson('/auth/login', { method: 'POST', body: JSON.stringify(payload) }, parseAuthSession)

export const registerWithCredentials = (payload: CredentialsPayload) =>
  requestJson('/auth/register', { method: 'POST', body: JSON.stringify(payload) }, parseAuthSession)

export const fetchCurrentUser = (token: string) =>
  requestJson(
    '/auth/me',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    parseCurrentUser,
  )
