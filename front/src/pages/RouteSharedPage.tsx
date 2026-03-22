import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import brandLogo from '../assets/brand-logo.svg'
import { LoginButton } from '../components/LoginButton'
import { RouteYandexMap, type RouteMapMetrics } from '../components/RouteYandexMap'
import { useAuthStore } from '../features/auth/authStore'
import { getPrimaryDisplayPhotoUrl, type PublicPlace } from '../features/places/placesApi'
import {
  deriveBudgetFallback,
  deriveRouteDurationDays,
  deriveSeasonLabelFromPlaces,
  formatSeasonSlugLabel,
  partitionRoutePlacesForReview,
} from '../features/routes/routeReviewHelpers'
import {
  attachSharedRouteToUser,
  fetchSharedRouteByToken,
  RoutesApiError,
  type RoutePlaceRow,
  type SharedRouteDetail,
} from '../features/routes/routesApi'
import { useQuizStore } from '../features/quiz/quizStore'

const yandexKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined

function typeSlugLabel(slug: string | null): string {
  if (!slug) return ''
  const map: Record<string, string> = {
    hotel: 'Гостиница',
    guest_house: 'Гостевой дом',
    recreation_base: 'База отдыха',
    restaurant: 'Ресторан',
    gastro: 'Гастрономия',
    cheese: 'Сыроварня',
    winery: 'Винодельня',
    park: 'Парк',
    museum: 'Музей',
    farm: 'Ферма',
    mountain: 'Горы',
    event: 'Событие',
  }
  return map[slug] ?? slug.replace(/_/g, ' ')
}

function creationModeLabel(mode: string): string {
  switch (mode) {
    case 'quiz':
      return 'Квиз'
    case 'selection_builder':
      return 'Подбор мест'
    case 'shared_copy':
      return 'Общая копия'
    case 'manual':
      return 'Ручной'
    default:
      return mode
  }
}

function accessTypeLabel(accessType: string): string {
  switch (accessType) {
    case 'owner':
      return 'Владелец'
    case 'collaborator':
      return 'Совместное редактирование'
    case 'viewer':
      return 'Только просмотр'
    case 'shared':
      return 'Открыт по ссылке'
    default:
      return accessType
  }
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`
}

function formatDistance(
  distanceKm: number | null,
  source: RouteMapMetrics['source'],
): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return '—'
  }
  const rounded =
    distanceKm >= 100 ? Math.round(distanceKm) : Number(distanceKm.toFixed(1))
  const prefix = source === 'polyline-fallback' ? '≈ ' : ''
  return `${prefix}${rounded.toLocaleString('ru-RU')} км`
}

function formatDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(parsed))
}

function formatDayCountLabel(days: number): string {
  const mod10 = days % 10
  const mod100 = days % 100
  if (mod10 === 1 && mod100 !== 11) {
    return `${days} день`
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${days} дня`
  }
  return `${days} дней`
}

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent'
}) {
  return (
    <div
      className={
        tone === 'accent'
          ? 'rounded-2xl border border-kr-blue/20 bg-kr-blue/10 p-4'
          : 'rounded-2xl border border-sky-200/80 bg-white/75 p-4'
      }>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 font-display text-[18px] font-bold uppercase leading-tight text-neutral-900">
        {value}
      </p>
    </div>
  )
}

function SharedPointCard({ row, orderIndex }: { row: RoutePlaceRow; orderIndex: number }) {
  const photo = getPrimaryDisplayPhotoUrl(row.place)
  const description =
    row.place.short_description ?? row.place.description ?? row.place.source_location

  return (
    <li className="rounded-[24px] border border-sky-200/80 bg-white p-4 shadow-sm shadow-sky-900/5">
      <div className="flex gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kr-blue text-[15px] font-bold text-white"
          aria-hidden>
          {orderIndex}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                to={`/places/${row.place.id}`}
                className="font-display text-[16px] font-bold uppercase leading-tight tracking-wide text-neutral-900 underline-offset-2 hover:text-kr-blue hover:underline">
                {row.place.name}
              </Link>
              {row.place.type_slug ? (
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-kr-blue/80">
                  {typeSlugLabel(row.place.type_slug)}
                </p>
              ) : null}
            </div>
            {photo ? (
              <img
                src={photo}
                alt=""
                className="size-20 shrink-0 rounded-2xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                Без фото
              </span>
            )}
          </div>
          {description ? (
            <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-neutral-600">{description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-500">
            {row.place.source_location ? (
              <span className="rounded-full bg-sky-50 px-3 py-1">{row.place.source_location}</span>
            ) : null}
            {row.place.address ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">{row.place.address}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-sky-100 pt-4">
        <Link
          to={`/places/${row.place.id}`}
          className="inline-flex min-h-10 items-center rounded-full border border-neutral-300 bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50">
          Открыть место
        </Link>
      </div>
    </li>
  )
}

function BadTokenView() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">Некорректная ссылка</p>
      <p className="mt-2 text-[14px] text-neutral-600">В адресе отсутствует ключ доступа к маршруту.</p>
      <Link
        to="/places"
        className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white">
        К каталогу мест
      </Link>
    </div>
  )
}

function RouteSharedContent({ shareToken }: { shareToken: string }) {
  const navigate = useNavigate()
  const authToken = useAuthStore((s) => s.token)
  const authUser = useAuthStore((s) => s.user)
  const peopleCount = useQuizStore((s) => s.peopleCount)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [route, setRoute] = useState<SharedRouteDetail | null>(null)
  const [message, setMessage] = useState('')
  const [mapMetrics, setMapMetrics] = useState<RouteMapMetrics>({
    distanceKm: null,
    durationMinutes: null,
    source: 'insufficient-points',
  })
  const [attachPhase, setAttachPhase] = useState<'idle' | 'attaching' | 'error'>('idle')
  const [attachMessage, setAttachMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void fetchSharedRouteByToken(shareToken)
      .then((data) => {
        if (cancelled) return
        setRoute(data)
        setPhase('ok')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRoute(null)
        setPhase('error')
        setMessage(
          error instanceof RoutesApiError
            ? error.message
            : 'Не удалось загрузить маршрут по ссылке.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [shareToken])

  const sortedRows = useMemo(() => {
    if (!route) return []
    return [...route.places].sort((a, b) => a.sort_order - b.sort_order)
  }, [route])

  const orderIndexByRoutePlaceId = useMemo(() => {
    const map = new Map<number, number>()
    sortedRows.forEach((row, i) => {
      map.set(row.route_place_id, i + 1)
    })
    return map
  }, [sortedRows])

  const { mainPoints, hospitalityPoints } = useMemo(
    () => partitionRoutePlacesForReview(sortedRows),
    [sortedRows],
  )

  const orderedPlaces: PublicPlace[] = useMemo(
    () => sortedRows.map((row) => row.place),
    [sortedRows],
  )

  const derivedDurationDays = useMemo(() => deriveRouteDurationDays(orderedPlaces), [orderedPlaces])
  const derivedBudget = useMemo(() => deriveBudgetFallback(orderedPlaces), [orderedPlaces])
  const seasonText = route?.season_slug
    ? formatSeasonSlugLabel(route.season_slug)
    : (deriveSeasonLabelFromPlaces(orderedPlaces) ?? '—')

  const handleAttach = useCallback(async () => {
    if (!authToken || !shareToken) return
    setAttachPhase('attaching')
    setAttachMessage(null)
    try {
      const attached = await attachSharedRouteToUser(authToken, shareToken)
      navigate(`/routes/${attached.id}`, { replace: true })
    } catch (error) {
      setAttachPhase('error')
      setAttachMessage(
        error instanceof RoutesApiError
          ? error.message
          : 'Не удалось добавить маршрут в «Мои туры».',
      )
    }
  }, [authToken, navigate, shareToken])

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)]">
            <div className="h-72 rounded-3xl bg-slate-200 lg:h-[min(78vh,720px)]" />
            <div className="space-y-4">
              <div className="h-52 rounded-3xl bg-slate-200" />
              <div className="h-64 rounded-3xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error' || !route) {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-red-800">Не удалось открыть маршрут</p>
        <p className="mt-2 text-[14px] text-neutral-600">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-6 font-bold text-neutral-800 hover:bg-neutral-50"
            onClick={() => {
              setPhase('loading')
              setMessage('')
              void fetchSharedRouteByToken(shareToken).then(
                (data) => {
                  setRoute(data)
                  setPhase('ok')
                },
                (error: unknown) => {
                  setRoute(null)
                  setPhase('error')
                  setMessage(
                    error instanceof RoutesApiError
                      ? error.message
                      : 'Не удалось загрузить маршрут по ссылке.',
                  )
                },
              )
            }}>
            Повторить
          </button>
          <Link
            to="/places"
            className="inline-flex min-h-11 items-center rounded-full bg-kr-blue px-6 font-bold text-white">
            К каталогу мест
          </Link>
        </div>
      </div>
    )
  }

  const summaryDescription =
    route.description?.trim() ||
    'Маршрут открыт по ссылке. Вы можете просмотреть точки на карте и перейти к карточкам мест.'

  const isOwnerViewer = Boolean(authUser?.id && authUser.id === route.owner.id)

  return (
    <div className="min-h-dvh bg-[#e8f4fc] text-neutral-900 lg:flex lg:h-dvh lg:flex-col">
      <header className="shrink-0 border-b border-sky-200/70 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
            <Link
              to="/places"
              className="shrink-0 text-[13px] font-semibold text-kr-blue underline-offset-2 hover:underline">
              ← Каталог мест
            </Link>
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2"
              aria-label="Край Тур — на главную">
              <img src={brandLogo} alt="" className="h-8 w-auto object-contain sm:h-9" />
              <span className="font-display hidden text-[14px] font-bold uppercase tracking-wide text-kr-blue sm:inline">
                Край Тур
              </span>
            </Link>
          </div>
          <LoginButton variant="on-catalog" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1480px] flex-1 min-h-0 flex-col gap-6 px-4 py-4 sm:px-8 lg:grid lg:h-full lg:min-h-0 lg:max-h-full lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,450px)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:overflow-hidden lg:px-10 lg:py-6">
        <section className="min-w-0 w-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="flex flex-col overflow-hidden rounded-[32px] border border-sky-200/70 bg-white/85 p-3 shadow-[0_30px_80px_-40px_rgba(3,105,161,0.5)] backdrop-blur-sm">
            <div className="shrink-0 rounded-[26px] bg-white p-3">
              <div className="h-[clamp(220px,60vh,720px)] w-full">
                <RouteYandexMap
                  compact
                  orderedPlaces={orderedPlaces}
                  apiKey={yandexKey}
                  onMetricsChange={setMapMetrics}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-sky-100/90 px-3 py-4 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kr-blue">Доступ по ссылке</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                {route.share_can_edit
                  ? 'Это один маршрут на сервере для всех по ссылке. Войдите и подключите его к «Мои туры» — дальше редактирование на странице маршрута; сохранения проверяют версию, при расхождении с другим участником нужно загрузить актуальные данные (без live-синхронизации).'
                  : 'Ссылка только для просмотра: после входа вы сможете добавить маршрут к себе, но не менять точки.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {authToken && isOwnerViewer ? (
                  <Link
                    to={`/routes/${route.id}`}
                    className="inline-flex min-h-12 items-center rounded-full bg-kr-blue px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:brightness-105 sm:px-6 sm:text-[13px]">
                    Открыть экран маршрута (владелец)
                  </Link>
                ) : null}
                {authToken && !isOwnerViewer ? (
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center rounded-full bg-kr-blue px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 sm:px-6 sm:text-[13px]"
                    disabled={attachPhase === 'attaching'}
                    onClick={() => void handleAttach()}>
                    {attachPhase === 'attaching'
                      ? 'Подключаем…'
                      : route.share_can_edit
                        ? 'Добавить в «Мои туры» и редактировать'
                        : 'Добавить в «Мои туры» (просмотр)'}
                  </button>
                ) : null}
                {!authToken ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-600">
                    <LoginButton variant="on-catalog" />
                    <span>Затем обновите страницу и снова нажмите кнопку подключения.</span>
                  </div>
                ) : null}
              </div>
              {attachMessage ? (
                <p className="mt-3 text-[13px] text-red-700">{attachMessage}</p>
              ) : null}
              {mapMetrics.source === 'polyline-fallback' && orderedPlaces.length >= 2 ? (
                <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
                  Яндекс-маршрут сейчас не отдал дорожную длину, поэтому в сводке показана приблизительная дистанция между
                  точками.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 w-full min-w-0 flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.5)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">
              {creationModeLabel(route.creation_mode)}
            </p>
            <h1 className="font-display mt-2 text-[clamp(1.4rem,4vw,2.05rem)] font-bold uppercase leading-tight text-neutral-900">
              {route.title}
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">{summaryDescription}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-neutral-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">Создан {formatDate(route.created_at)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Доступ по ссылке: {accessTypeLabel(route.access_type)}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {route.creation_mode === 'quiz' ? (
                <SummaryMetric
                  label="Группа"
                  value={peopleCount != null ? `${peopleCount} чел.` : '—'}
                />
              ) : null}
              <SummaryMetric
                label="Длительность"
                value={formatDayCountLabel(derivedDurationDays)}
                tone="accent"
              />
              <SummaryMetric
                label="Бюджет"
                value={formatMoney(route.total_estimated_cost ?? derivedBudget)}
              />
              <SummaryMetric label="Сезон" value={seasonText} />
              <SummaryMetric
                label="Маршрут"
                value={
                  orderedPlaces.length >= 2 && mapMetrics.distanceKm == null
                    ? 'Считаем…'
                    : formatDistance(mapMetrics.distanceKm, mapMetrics.source)
                }
              />
            </div>
          </section>

          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">Основные точки</p>
                <h2 className="font-display mt-2 text-[20px] font-bold uppercase text-neutral-900">Маршрут дня</h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-800">
                {mainPoints.length}
              </span>
            </div>
            {mainPoints.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-6 text-[14px] text-neutral-600">
                Нет основных точек в этом маршруте.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {mainPoints.map((row) => (
                  <SharedPointCard
                    key={row.route_place_id}
                    row={row}
                    orderIndex={orderIndexByRoutePlaceId.get(row.route_place_id) ?? 0}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="shrink-0 rounded-[32px] border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">Отдых и еда</p>
                <h2 className="font-display mt-2 text-[20px] font-bold uppercase text-neutral-900">
                  Гостиницы и рестораны
                </h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-800">
                {hospitalityPoints.length}
              </span>
            </div>
            {hospitalityPoints.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-6 text-[14px] text-neutral-600">
                Отдельных точек для ночёвки и еды в маршруте нет.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {hospitalityPoints.map((row) => (
                  <SharedPointCard
                    key={row.route_place_id}
                    row={row}
                    orderIndex={orderIndexByRoutePlaceId.get(row.route_place_id) ?? 0}
                  />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}

export function RouteSharedPage() {
  const { token: shareTokenParam } = useParams()
  const shareToken = shareTokenParam?.trim() ?? ''

  if (!shareToken) {
    return <BadTokenView />
  }

  return <RouteSharedContent key={shareToken} shareToken={shareToken} />
}
