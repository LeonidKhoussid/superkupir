import { create } from 'zustand'
import {
  AuthApiError,
  fetchCurrentUser,
  loginWithCredentials,
  registerWithCredentials,
  type AuthSession,
  type AuthUser,
  type CredentialsPayload,
} from './authApi'

type AuthStatus = 'idle' | 'loading' | 'authenticated'

type PersistedAuthState = {
  token: string | null
  user: AuthUser | null
}

type AuthState = PersistedAuthState & {
  status: AuthStatus
  error: string | null
  clearError: () => void
  login: (payload: CredentialsPayload) => Promise<boolean>
  register: (payload: CredentialsPayload) => Promise<boolean>
  hydrateSession: () => Promise<void>
  logout: () => void
}

const storageKey = 'kray-tour-auth'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parsePersistedState = (value: unknown): PersistedAuthState => {
  if (!isRecord(value)) {
    return { token: null, user: null }
  }

  const token = typeof value.token === 'string' ? value.token : null
  const user = isRecord(value.user) &&
    typeof value.user.id === 'string' &&
    typeof value.user.email === 'string'
    ? { id: value.user.id, email: value.user.email }
    : null

  return { token, user }
}

const readPersistedAuthState = (): PersistedAuthState => {
  if (typeof window === 'undefined') {
    return { token: null, user: null }
  }

  const rawValue = window.localStorage.getItem(storageKey)

  if (!rawValue) {
    return { token: null, user: null }
  }

  try {
    return parsePersistedState(JSON.parse(rawValue))
  } catch {
    return { token: null, user: null }
  }
}

const persistAuthState = (state: PersistedAuthState) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!state.token || !state.user) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

const persistedAuthState = readPersistedAuthState()

const saveSession = (session: AuthSession) => {
  persistAuthState(session)

  return {
    user: session.user,
    token: session.token,
    status: 'authenticated' as const,
    error: null,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...persistedAuthState,
  status: persistedAuthState.user && persistedAuthState.token ? 'authenticated' : 'idle',
  error: null,
  clearError: () => set({ error: null }),
  login: async (payload) => {
    set({ status: 'loading', error: null })

    try {
      const session = await loginWithCredentials(payload)

      set(saveSession(session))
      return true
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : 'Не удалось выполнить вход. Попробуйте позже.'

      const { token, user } = get()

      set({
        status: token && user ? 'authenticated' : 'idle',
        error: message,
      })

      return false
    }
  },
  register: async (payload) => {
    set({ status: 'loading', error: null })

    try {
      const session = await registerWithCredentials(payload)

      set(saveSession(session))
      return true
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : 'Не удалось создать аккаунт. Попробуйте позже.'

      set({
        status: 'idle',
        error: message,
      })

      return false
    }
  },
  hydrateSession: async () => {
    const { token, user } = get()

    if (!token) {
      set({ status: 'idle', error: null, user: null })
      return
    }

    try {
      const currentUser = await fetchCurrentUser(token)

      persistAuthState({ token, user: currentUser })
      set({
        token,
        user: currentUser,
        status: 'authenticated',
        error: null,
      })
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        persistAuthState({ token: null, user: null })
        set({
          token: null,
          user: null,
          status: 'idle',
          error: null,
        })
        return
      }

      set({
        status: user ? 'authenticated' : 'idle',
        error: null,
      })
    }
  },
  logout: () => {
    persistAuthState({ token: null, user: null })
    set({
      token: null,
      user: null,
      status: 'idle',
      error: null,
    })
  },
}))
