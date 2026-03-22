import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  fetchAllUserRoutes,
  RoutesApiError,
  type UserRouteSummary,
} from '../features/routes/routesApi'

const CATALOG_LOGO_SRC = 'https://storage.yandexcloud.net/hackathon-ss/logoPlace.svg'

const navLinkClass =
  'rounded-md px-1 py-1 text-[14px] font-semibold tracking-wide text-kr-blue transition hover:opacity-80 lg:text-[15px]'
const navLinkActive = 'underline decoration-2 underline-offset-4'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

function creationModeLabel(mode: string): string {
  const map: Record<string, string> = {
    quiz: 'По квизу',
    selection_builder: 'Из подборки',
    manual: 'Вручную',
    shared_copy: 'Копия',
  }

  return map[mode] ?? mode
}

function seasonLabel(slug: string | null): string | null {
  if (!slug) return null

  const map: Record<string, string> = {
    spring: 'Весна',
    summer: 'Лето',
    autumn: 'Осень',
    winter: 'Зима',
  }

  return map[slug] ?? slug
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins} мин`
  if (mins === 0) return `${hours} ч`
  return `${hours} ч ${mins} мин`
}

function formatCost(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return rubFormatter.format(value)
}

function routeExcerpt(route: UserRouteSummary): string {
  const description = route.description?.trim()
  if (description) {
    return description.length > 180 ? `${description.slice(0, 177)}…` : description
  }

  return 'Маршрут появится здесь после сохранения и будет доступен для просмотра по карточке.'
}

function accessTypeBadge(accessType: string): { label: string; className: string } | null {
  if (accessType === 'owner') return null
  if (accessType === 'collaborator') {
    return {
      label: 'Совместное редактирование',
      className: 'border-amber-200 bg-amber-50 text-amber-950',
    }
  }
  if (accessType === 'viewer') {
    return {
      label: 'Только просмотр',
      className: 'border-slate-200 bg-slate-100 text-slate-800',
    }
  }
  if (accessType === 'shared') {
    return {
      label: 'По доступу',
      className: 'border-sky-200 bg-sky-50 text-sky-900',
    }
  }
  return null
}

function RouteCard({ route }: { route: UserRouteSummary }) {
  const seasonName = seasonLabel(route.season_slug)
  const durationLabel = formatDuration(route.total_estimated_duration_minutes)
  const costLabel = formatCost(route.total_estimated_cost)
  const createdLabel = dateFormatter.format(new Date(route.created_at))
  const accessBadge = accessTypeBadge(route.access_type)

  return (
    <Link
      to={`/routes/${route.id}`}
      className="group flex h-full flex-col rounded-[28px] border border-sky-200/80 bg-white p-5 shadow-sm shadow-sky-900/5 transition hover:-translate-y-0.5 hover:border-kr-blue/50 hover:shadow-lg hover:shadow-sky-900/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-kr-blue/80">
            {creationModeLabel(route.creation_mode)}
          </p>
          <h2 className="font-display mt-2 text-[1.05rem] font-bold uppercase leading-tight tracking-[0.08em] text-neutral-900 transition group-hover:text-kr-blue">
            {route.title}
          </h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {accessBadge ? (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${accessBadge.className}`}>
              {accessBadge.label}
            </span>
          ) : null}
          <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-kr-blue">
            {route.place_count} {route.place_count === 1 ? 'точка' : route.place_count < 5 ? 'точки' : 'точек'}
          </span>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-[14px] leading-relaxed text-neutral-600">
        {routeExcerpt(route)}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {seasonName ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] font-medium text-neutral-700">
            Сезон: {seasonName}
          </span>
        ) : null}
        {durationLabel ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] font-medium text-neutral-700">
            Длительность: {durationLabel}
          </span>
        ) : null}
        {costLabel ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] font-medium text-neutral-700">
            Бюджет: {costLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-5 text-[12px] text-neutral-500">
        Создан {createdLabel}
      </div>
    </Link>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`route-skeleton-${index}`}
          className="rounded-[28px] border border-sky-200/70 bg-white p-5 shadow-sm shadow-sky-900/5"
        >
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-6 w-3/4 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-6 space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-[88%] animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-[72%] animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-6 flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-10 h-3 w-32 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function MyRoutesPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [routes, setRoutes] = useState<UserRouteSummary[]>([])
  const [phase, setPhase] = useState<'auth' | 'loading' | 'empty' | 'ready' | 'error'>(
    token ? 'loading' : 'auth',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return

      setPhase('loading')
      setErrorMessage(null)

      try {
        const items = await fetchAllUserRoutes(token, { scope: 'accessible', pageLimit: 50 })

        if (cancelled) return
        setRoutes(items)
        setPhase(items.length === 0 ? 'empty' : 'ready')
      } catch (error: unknown) {
        if (cancelled) return

        if (error instanceof RoutesApiError && error.status === 401) {
          setRoutes([])
          setPhase('auth')
          setErrorMessage(null)
          return
        }

        setRoutes([])
        setPhase('error')
        setErrorMessage(
          error instanceof RoutesApiError
            ? error.message
            : 'Не удалось загрузить ваши маршруты.',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  return (
    <div className="min-h-dvh bg-[#e8f4fc] text-neutral-900">
      <a
        href="#my-routes-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-kr-blue"
      >
        К списку моих маршрутов
      </a>

      <header className="sticky top-0 z-30 border-b border-sky-200/60 bg-white/90 shadow-sm shadow-sky-900/5 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-3 py-2 sm:px-6 sm:py-3 lg:px-12 lg:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link
              to="/"
              className="flex shrink-0 items-center"
              aria-label="Край Тур — на главную"
            >
              <img
                src={CATALOG_LOGO_SRC}
                alt="Край Тур"
                width={174}
                height={81}
                className="h-9 w-auto object-contain object-left sm:h-10 lg:h-11"
                decoding="async"
              />
            </Link>
            <nav
              className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-1 text-kr-blue sm:flex lg:gap-x-10"
              aria-label="Основная навигация"
            >
              <NavLink
                to="/places"
                className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
                end
              >
                Места
              </NavLink>
              <a href="/#places" className={navLinkClass}>
                Впечатления
              </a>
              <NavLink
                to="/myroutes"
                className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
                end
              >
                Мои Туры
              </NavLink>
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Открыть меню"
                aria-expanded={mobileNavOpen}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-sky-200/90 bg-white text-kr-blue shadow-sm sm:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </button>
              <LoginButton
                variant="on-catalog"
                className="!min-w-0 px-4 text-[13px] sm:!min-w-[120px] sm:px-8 sm:text-[15px]"
              />
            </div>
          </div>
        </div>
      </header>

      {mobileNavOpen
        ? createPortal(
            <div className="fixed inset-0 z-[95] sm:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/45"
                aria-label="Закрыть меню"
                onClick={() => setMobileNavOpen(false)}
              />
              <nav
                className="absolute right-0 top-0 flex h-full w-[min(88vw,280px)] flex-col gap-1 border-l border-sky-200 bg-white py-4 pl-4 pr-3 shadow-xl"
                aria-label="Меню навигации"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Закрыть"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 hover:bg-neutral-100"
                  >
                    ×
                  </button>
                </div>
                <NavLink
                  to="/places"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? `bg-sky-50 ${navLinkActive}` : ''}`
                  }
                >
                  Места
                </NavLink>
                <a
                  href="/#places"
                  className="block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Впечатления
                </a>
                <NavLink
                  to="/myroutes"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? `bg-sky-50 ${navLinkActive}` : ''}`
                  }
                >
                  Мои Туры
                </NavLink>
              </nav>
            </div>,
            document.body,
          )
        : null}

      <main
        id="my-routes-main"
        className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-14 lg:py-12"
      >
        <section className="max-w-3xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-kr-blue/80">
            Личный кабинет
          </p>
          <h1 className="font-display mt-3 text-[clamp(1.6rem,4vw,2.6rem)] font-bold uppercase tracking-[0.08em] text-neutral-900">
            Мои Туры
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
            Собственные маршруты и те, к которым вам открыли доступ по ссылке (совместное редактирование или
            просмотр). Один и тот же маршрут на сервере — правки не в реальном времени, при конфликте версий
            приложение попросит загрузить актуальные данные.
          </p>
          {user ? (
            <p className="mt-4 text-[13px] text-neutral-500">
              Вы вошли как <span className="font-semibold text-neutral-700">{user.email}</span>
            </p>
          ) : null}
        </section>

        <section className="mt-8">
          {!token ? (
            <div className="rounded-[28px] border border-sky-200/80 bg-white px-6 py-10 text-center shadow-sm shadow-sky-900/5 sm:px-10">
              <h2 className="font-display text-[1.2rem] font-bold uppercase tracking-[0.08em] text-neutral-900">
                Войдите, чтобы увидеть свои маршруты
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                После входа здесь отображаются ваши маршруты и маршруты с совместным доступом (если вы
                приняли приглашение по ссылке).
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => requestAuthModalOpen()}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-kr-blue px-6 text-[14px] font-bold text-white shadow-sm hover:brightness-110"
                >
                  Войти
                </button>
                <Link
                  to="/places"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-kr-blue bg-white px-6 text-[14px] font-bold text-kr-blue"
                >
                  Перейти к местам
                </Link>
              </div>
            </div>
          ) : phase === 'loading' ? (
            <LoadingGrid />
          ) : phase === 'error' ? (
            <div className="rounded-[28px] border border-rose-200/80 bg-white px-6 py-10 text-center shadow-sm shadow-rose-900/5 sm:px-10">
              <h2 className="font-display text-[1.15rem] font-bold uppercase tracking-[0.08em] text-neutral-900">
                Не удалось загрузить маршруты
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                {errorMessage ?? 'Попробуйте обновить список чуть позже.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-kr-blue px-6 text-[14px] font-bold text-white shadow-sm hover:brightness-110"
                >
                  Повторить
                </button>
                <Link
                  to="/places"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-kr-blue bg-white px-6 text-[14px] font-bold text-kr-blue"
                >
                  К местам
                </Link>
              </div>
            </div>
          ) : phase === 'empty' ? (
            <div className="rounded-[28px] border border-sky-200/80 bg-white px-6 py-10 text-center shadow-sm shadow-sky-900/5 sm:px-10">
              <h2 className="font-display text-[1.2rem] font-bold uppercase tracking-[0.08em] text-neutral-900">
                Пока нет сохранённых туров
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                Маршруты появятся здесь после того, как вы соберёте их из каталога мест.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/places"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-kr-blue px-6 text-[14px] font-bold text-white shadow-sm hover:brightness-110"
                >
                  Собрать маршрут
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
