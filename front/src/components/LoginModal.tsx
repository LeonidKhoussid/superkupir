import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
}

type Panel = 'login' | 'register'

const inputClassName =
  'min-h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-[15px] text-neutral-900 outline-none ring-[#4385f5]/30 transition placeholder:text-neutral-400 focus:border-[#4385f5] focus:ring-2'

const labelClassName = 'text-[14px] font-semibold text-neutral-900'

export function LoginModal({ open, onClose }: Props) {
  const titleId = useId()
  const loginEmailRef = useRef<HTMLInputElement>(null)
  const registerNameRef = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<Panel>('login')

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
            {panel === 'login' ? 'Вход' : 'Регистрация'}
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

        {panel === 'login' ? (
          <>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
              noValidate
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
                />
              </div>
              <button
                type="submit"
                className="font-display min-h-[52px] w-full rounded-full bg-neutral-900 text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Войти
              </button>
            </form>

            <div
              className="mt-4 flex flex-col gap-3"
              role="group"
              aria-label="Вход через соцсети"
            >
              <button
                type="button"
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#0077ff] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077ff]"
              >
                Войти через ВК
              </button>
              <button
                type="button"
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#fc3f1e] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc3f1e]"
              >
                Войти через Яндекс
              </button>
              <button
                type="button"
                className="font-display flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#ee8208] px-4 text-[15px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ee8208]"
              >
                Войти через Одноклассники
              </button>
            </div>

            <p className="mt-5 text-center text-[14px] text-neutral-600">
              <button
                type="button"
                onClick={() => setPanel('register')}
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
              onSubmit={(e) => e.preventDefault()}
              noValidate
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
                />
              </div>
              <button
                type="submit"
                className="font-display min-h-[52px] w-full rounded-full bg-[#4385f5] text-[15px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                Зарегистрироваться
              </button>
            </form>

            <p className="mt-5 text-center text-[14px] text-neutral-600">
              <button
                type="button"
                onClick={() => setPanel('login')}
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
