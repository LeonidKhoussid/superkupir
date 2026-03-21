import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../features/auth/authStore'

type Panel = 'login' | 'register' | 'account'

type Props = {
  open: boolean
  onClose: () => void
  /** Стартовая вкладка при монтировании (новый `key` из `LoginButton` при каждом открытии). */
  initialPanel?: Panel
}
type LoginFormState = {
  email: string
  password: string
}
type RegisterFormState = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const inputClassName =
  'min-h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-[15px] text-neutral-900 outline-none ring-[#4385f5]/30 transition placeholder:text-neutral-400 focus:border-[#4385f5] focus:ring-2'

const labelClassName = 'text-[14px] font-semibold text-neutral-900'
const errorTextClassName = 'mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginModal({ open, onClose, initialPanel = 'login' }: Props) {
  const titleId = useId()
  const loginEmailRef = useRef<HTMLInputElement>(null)
  const registerNameRef = useRef<HTMLInputElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const user = useAuthStore((state) => state.user)
  const [panel, setPanel] = useState<Panel>(initialPanel)
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: '',
    password: '',
  })
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [localError, setLocalError] = useState<string | null>(null)
  const authError = useAuthStore((state) => state.error)
  const authStatus = useAuthStore((state) => state.status)
  const clearError = useAuthStore((state) => state.clearError)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const logout = useAuthStore((state) => state.logout)
  const isSubmitting = authStatus === 'loading'
  const visibleError = localError ?? authError

  const setLoginField = (field: keyof LoginFormState, value: string) => {
    setLocalError(null)
    clearError()
    setLoginForm((current) => ({ ...current, [field]: value }))
  }

  const setRegisterField = (field: keyof RegisterFormState, value: string) => {
    setLocalError(null)
    clearError()
    setRegisterForm((current) => ({ ...current, [field]: value }))
  }

  const validateCredentials = (email: string, password: string) => {
    if (!email || !password) {
      return 'Введите email и пароль.'
    }

    if (!emailPattern.test(email)) {
      return 'Введите корректный email.'
    }

    return null
  }

  const handlePanelChange = (nextPanel: Panel) => {
    setLocalError(null)
    clearError()
    setPanel(nextPanel)
  }

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = loginForm.email.trim().toLowerCase()
    const password = loginForm.password
    const validationError = validateCredentials(email, password)

    if (validationError) {
      setLocalError(validationError)
      return
    }

    const isSuccessful = await login({ email, password })

    if (isSuccessful) {
      onClose()
    }
  }

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = registerForm.email.trim().toLowerCase()
    const password = registerForm.password
    const validationError = validateCredentials(email, password)

    if (validationError) {
      setLocalError(validationError)
      return
    }

    if (password !== registerForm.confirmPassword) {
      setLocalError('Пароли должны совпадать.')
      return
    }

    const isSuccessful = await register({ email, password })

    if (isSuccessful) {
      onClose()
    }
  }

  const handleUnavailableProviderClick = () => {
    setLocalError('Социальный вход пока недоступен.')
  }

  const handleLogoutClick = () => {
    logout()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => {
      if (panel === 'login') loginEmailRef.current?.focus()
      else if (panel === 'account') accountButtonRef.current?.focus()
      else registerNameRef.current?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, panel])

  if (!open) return null

  const uid = titleId

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 pb-8 sm:items-center sm:pb-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="font-display text-[1.25rem] font-bold uppercase tracking-wide text-[#4385f5] sm:text-[1.35rem]"
          >
            {panel === 'login' ? 'Вход' : panel === 'register' ? 'Регистрация' : 'Аккаунт'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
          >
            ×
          </button>
        </div>

        {panel === 'account' && user ? (
          <>
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Вы вошли как
              </p>
              <p className="mt-2 break-all text-[16px] font-semibold text-neutral-900">
                {user.email}
              </p>
            </div>

            <button
              ref={accountButtonRef}
              type="button"
              onClick={handleLogoutClick}
              className="font-display mt-6 min-h-[52px] w-full rounded-full bg-neutral-900 text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              Выйти
            </button>
          </>
        ) : panel === 'login' ? (
          <>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={handleLoginSubmit}
              noValidate
              aria-busy={isSubmitting}
            >
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor={`${uid}-email`} className={labelClassName}>
                  Email
                </label>
                <input
                  id={`${uid}-email`}
                  ref={loginEmailRef}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClassName}
                  value={loginForm.email}
                  onChange={(event) => setLoginField('email', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor={`${uid}-password`} className={labelClassName}>
                  Пароль
                </label>
                <input
                  id={`${uid}-password`}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputClassName}
                  value={loginForm.password}
                  onChange={(event) => setLoginField('password', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="font-display min-h-[52px] w-full rounded-full bg-neutral-900 text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                {isSubmitting ? 'Входим...' : 'Войти'}
              </button>
            </form>

            {visibleError ? (
              <p role="alert" className={errorTextClassName}>
                {visibleError}
              </p>
            ) : null}

            <div
              className="mt-4 flex flex-col gap-3"
              role="group"
              aria-label="Вход через соцсети"
            >
              <button
                type="button"
                onClick={handleUnavailableProviderClick}
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#0077ff] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077ff]"
              >
                Войти через ВК
              </button>
              <button
                type="button"
                onClick={handleUnavailableProviderClick}
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#fc3f1e] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc3f1e]"
              >
                Войти через Яндекс
              </button>
              <button
                type="button"
                onClick={handleUnavailableProviderClick}
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#ee8208] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ee8208]"
              >
                Войти через Одноклассники
              </button>
            </div>

            <p className="mt-5 text-center text-[14px] text-neutral-600">
              <button
                type="button"
                onClick={() => handlePanelChange('register')}
                className="font-semibold text-[#4385f5] underline decoration-[#4385f5]/40 underline-offset-2 transition hover:decoration-[#4385f5] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                Зарегистрироваться
              </button>
            </p>
          </>
        ) : (
          <>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={handleRegisterSubmit}
              noValidate
              aria-busy={isSubmitting}
            >
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor={`${uid}-reg-name`} className={labelClassName}>
                  Имя
                </label>
                <input
                  id={`${uid}-reg-name`}
                  ref={registerNameRef}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                  className={inputClassName}
                  value={registerForm.name}
                  onChange={(event) => setRegisterField('name', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor={`${uid}-reg-email`} className={labelClassName}>
                  Email
                </label>
                <input
                  id={`${uid}-reg-email`}
                  type="email"
                  name="reg-email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClassName}
                  value={registerForm.email}
                  onChange={(event) => setRegisterField('email', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor={`${uid}-reg-password`} className={labelClassName}>
                  Пароль
                </label>
                <input
                  id={`${uid}-reg-password`}
                  type="password"
                  name="reg-password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputClassName}
                  value={registerForm.password}
                  onChange={(event) => setRegisterField('password', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label
                  htmlFor={`${uid}-reg-password2`}
                  className={labelClassName}
                >
                  Подтвердите пароль
                </label>
                <input
                  id={`${uid}-reg-password2`}
                  type="password"
                  name="reg-password2"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputClassName}
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterField('confirmPassword', event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="font-display min-h-[52px] w-full rounded-full bg-[#4385f5] text-[15px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                {isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
              </button>
            </form>

            {visibleError ? (
              <p role="alert" className={errorTextClassName}>
                {visibleError}
              </p>
            ) : null}

            <p className="mt-5 text-center text-[14px] text-neutral-600">
              <button
                type="button"
                onClick={() => handlePanelChange('login')}
                className="font-semibold text-[#4385f5] underline decoration-[#4385f5]/40 underline-offset-2 transition hover:decoration-[#4385f5] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                Уже есть аккаунт? Войти
              </button>
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
