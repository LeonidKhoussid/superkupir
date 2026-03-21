import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'
import { fetchSeasons, type CatalogSeason } from '../features/catalog/catalogApi'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  fetchAllPlaces,
  fetchPlaceRecommendations,
  getPrimaryDisplayPhotoUrl,
  orderPlacesByCatalogImagePriority,
  PlacesApiError,
  PLACES_CATALOG_FETCH_LIMIT,
  type PublicPlace,
  type PublicPlaceRecommendation,
} from '../features/places/placesApi'
import { useRouteCartStore } from '../features/routeCart/routeCartStore'
import { createRouteFromSelection, RoutesApiError } from '../features/routes/routesApi'

const CATALOG_LOGO_SRC =
  'https://storage.yandexcloud.net/hackathon-ss/logoPlace.svg'

type CatalogFetchResult =
  | { ok: true; places: PublicPlace[] }
  | { ok: false; message: string }

async function loadCatalogPlaces(): Promise<CatalogFetchResult> {
  try {
    const places = await fetchAllPlaces({ pageLimit: PLACES_CATALOG_FETCH_LIMIT })
    return { ok: true, places }
  } catch (e) {
    const message =
      e instanceof PlacesApiError ? e.message : 'Не удалось загрузить каталог мест.'
    return { ok: false, message }
  }
}

function normalizeSearch(s: string) {
  return s.trim().toLowerCase()
}

function placeCardExcerpt(place: PublicPlace): string {
  const d = place.description?.trim()
  if (d) {
    return d.length > 140 ? `${d.slice(0, 137)}…` : d
  }
  const loc = place.source_location?.trim() || place.address?.trim()
  if (loc) return loc
  return 'Подробнее на странице места.'
}

function filterPlacesByQuery(places: PublicPlace[], query: string): PublicPlace[] {
  const q = normalizeSearch(query)
  if (!q) return places
  return places.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true
    if (p.description?.toLowerCase().includes(q)) return true
    if (p.source_location?.toLowerCase().includes(q)) return true
    if (p.address?.toLowerCase().includes(q)) return true
    return false
  })
}

function formatDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null
  if (km < 1) return `${Math.round(km * 1000)} м от якоря`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} км от якоря`
}

function CatalogCardImage({ place }: { place: PublicPlace }) {
  const [broken, setBroken] = useState(false)
  const src = getPrimaryDisplayPhotoUrl(place)

  if (!src || broken) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-200/80 via-slate-100 to-sky-100 text-[13px] font-medium text-neutral-500"
        aria-hidden
      >
        Фото скоро
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

function RouteAddButton({
  inCart,
  onClick,
}: {
  inCart: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={inCart}
      title={inCart ? 'Уже в маршруте' : 'Добавить в маршрут'}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-full shadow-sm ring-1 transition ${
        inCart
          ? 'bg-kr-blue text-white ring-kr-blue/40'
          : 'bg-white/95 text-kr-blue ring-sky-100 hover:bg-white'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill={inCart ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20.5 4.9 13.9a4.96 4.96 0 0 1 0-7.07 4.87 4.87 0 0 1 6.98 0L12 7.94l.12-.11a4.87 4.87 0 0 1 6.98 0 4.96 4.96 0 0 1 0 7.07Z" />
      </svg>
    </button>
  )
}

function CatalogPlaceCard({
  place,
  inCart,
  onAddToRoute,
  distanceKm,
}: {
  place: PublicPlace
  inCart: boolean
  onAddToRoute: (place: PublicPlace) => void
  distanceKm?: number | null
}) {
  const excerpt = placeCardExcerpt(place)
  const badge =
    place.size?.trim() ||
    (place.source_location?.trim() ? place.source_location.trim().split(',')[0]?.trim() : '')
  const distLabel = formatDistanceKm(distanceKm)

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-md shadow-sky-900/10 ring-1 ring-sky-100/90 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link
          to={`/places/${place.id}`}
          className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kr-blue"
        >
          <div className="relative aspect-[3/4] w-full min-h-[220px] overflow-hidden bg-slate-100 sm:min-h-[260px] lg:min-h-[280px]">
            <CatalogCardImage place={place} />
            {badge ? (
              <span className="absolute left-3 top-3 max-w-[min(70%,200px)] truncate rounded-full bg-[#7cb342] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                {badge}
              </span>
            ) : null}
            {distLabel ? (
              <span className="absolute left-3 top-14 max-w-[min(85%,240px)] truncate rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                {distLabel}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-5 pt-16 text-left">
              <h2 className="font-display line-clamp-2 text-[16px] font-bold uppercase leading-snug tracking-wide text-white sm:text-[17px]">
                {place.name}
              </h2>
              <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-relaxed text-white/90 sm:text-[14px]">
                {excerpt}
              </p>
            </div>
          </div>
        </Link>
        <div className="pointer-events-none absolute right-3 top-3">
          <div className="pointer-events-auto">
            <RouteAddButton
              inCart={inCart}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onAddToRoute(place)
              }}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`sk-${i}`}
          className="overflow-hidden rounded-2xl bg-white shadow ring-1 ring-sky-100/80"
        >
          <div className="aspect-[3/4] min-h-[220px] animate-pulse bg-gradient-to-br from-slate-200 to-slate-100 sm:min-h-[260px] lg:min-h-[280px]" />
        </div>
      ))}
    </div>
  )
}

const navLinkClass =
  'rounded-md px-1 py-1 text-[14px] font-semibold tracking-wide text-kr-blue transition hover:opacity-80 lg:text-[15px]'
const navLinkActive = 'underline decoration-2 underline-offset-4'

export function PlacesCatalogPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [allPlaces, setAllPlaces] = useState<PublicPlace[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [seasons, setSeasons] = useState<CatalogSeason[]>([])
  const [seasonsError, setSeasonsError] = useState<string | null>(null)

  const selectedIds = useRouteCartStore((s) => s.selectedIds)
  const placesById = useRouteCartStore((s) => s.placesById)
  const anchorPlaceId = useRouteCartStore((s) => s.anchorPlaceId)
  const activeSeasonSlug = useRouteCartStore((s) => s.activeSeasonSlug)
  const builderStarted = useRouteCartStore((s) => s.builderStarted)
  const recommendationItems = useRouteCartStore((s) => s.recommendationItems)
  const recommendationsStatus = useRouteCartStore((s) => s.recommendationsStatus)
  const recommendationsError = useRouteCartStore((s) => s.recommendationsError)
  const routeCreateLoading = useRouteCartStore((s) => s.routeCreateLoading)
  const routeCreateError = useRouteCartStore((s) => s.routeCreateError)

  const addPlace = useRouteCartStore((s) => s.addPlace)
  const removePlace = useRouteCartStore((s) => s.removePlace)
  const resetBuilder = useRouteCartStore((s) => s.resetBuilder)
  const setRecommendationsLoading = useRouteCartStore((s) => s.setRecommendationsLoading)
  const setActiveSeasonId = useRouteCartStore((s) => s.setActiveSeasonId)
  const setRouteCreateLoading = useRouteCartStore((s) => s.setRouteCreateLoading)
  const setRouteCreateError = useRouteCartStore((s) => s.setRouteCreateError)

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const applyFetchResult = useCallback((r: CatalogFetchResult) => {
    if (r.ok) {
      setErrorMessage(null)
      if (r.places.length === 0) {
        setAllPlaces([])
        setPhase('empty')
      } else {
        setAllPlaces(r.places)
        setPhase('ok')
      }
    } else {
      setErrorMessage(r.message)
      setAllPlaces([])
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadCatalogPlaces().then((r) => {
      if (cancelled) return
      applyFetchResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [applyFetchResult])

  useEffect(() => {
    let cancelled = false
    void fetchSeasons()
      .then((items) => {
        if (cancelled) return
        setSeasons(items)
        setSeasonsError(null)
      })
      .catch(() => {
        if (cancelled) return
        setSeasons([])
        setSeasonsError('Не удалось загрузить сезоны — подбор по сезону может быть ограничен.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!builderStarted || seasons.length === 0) return
    const st = useRouteCartStore.getState()
    if (st.activeSeasonSlug) return
    useRouteCartStore.setState({ activeSeasonSlug: seasons[0]!.slug })
  }, [builderStarted, seasons])

  useEffect(() => {
    if (!activeSeasonSlug || seasons.length === 0) {
      setActiveSeasonId(null)
      return
    }
    const row = seasons.find((s) => s.slug === activeSeasonSlug)
    setActiveSeasonId(row?.id ?? null)
  }, [activeSeasonSlug, seasons, setActiveSeasonId])

  const recSignature = selectedIds.join(',')

  useEffect(() => {
    if (!builderStarted || !anchorPlaceId || !activeSeasonSlug) return

    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      setRecommendationsLoading()
      void fetchPlaceRecommendations(
        {
          season_slug: activeSeasonSlug,
          anchor_place_id: anchorPlaceId,
          exclude_place_ids: useRouteCartStore.getState().selectedIds,
          radius_km: 80,
          limit: 48,
        },
        { signal: ctrl.signal },
      )
        .then((res) => {
          const cart = new Set(useRouteCartStore.getState().selectedIds)
          const next = res.items.filter((p) => !cart.has(p.id))
          useRouteCartStore.getState().setRecommendationsResult(next)
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          const msg =
            e instanceof PlacesApiError ? e.message : 'Не удалось подобрать похожие места.'
          useRouteCartStore.getState().setRecommendationsError(msg)
        })
    }, 320)

    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [
    builderStarted,
    anchorPlaceId,
    activeSeasonSlug,
    recSignature,
    setRecommendationsLoading,
  ])

  const handleRetry = () => {
    setPhase('loading')
    setErrorMessage(null)
    void loadCatalogPlaces().then(applyFetchResult)
  }

  const handleAddToRoute = useCallback(
    (place: PublicPlace) => {
      const fallback = seasons[0]?.slug ?? null
      addPlace(place, { defaultSeasonSlug: fallback })
    },
    [addPlace, seasons],
  )

  const handleCreateRoute = useCallback(async () => {
    if (!token) {
      requestAuthModalOpen()
      return
    }
    const ids = useRouteCartStore.getState().selectedIds
    if (ids.length < 1) return

    setRouteCreateLoading(true)
    setRouteCreateError(null)
    try {
      const st = useRouteCartStore.getState()
      const first = st.placesById[String(ids[0])]
      const title =
        ids.length === 1
          ? `Маршрут: ${first?.name ?? 'подборка'}`
          : `Маршрут: ${first?.name ?? 'Подборка'} и ещё ${ids.length - 1}`

      const detail = await createRouteFromSelection(token, {
        title,
        place_ids: ids,
        season_id: st.activeSeasonId ?? undefined,
      })
      resetBuilder()
      navigate(`/routes/${detail.id}`)
    } catch (e) {
      setRouteCreateError(
        e instanceof RoutesApiError ? e.message : 'Не удалось создать маршрут.',
      )
    } finally {
      setRouteCreateLoading(false)
    }
  }, [navigate, resetBuilder, setRouteCreateError, setRouteCreateLoading, token])

  const filteredCatalog = useMemo(
    () => filterPlacesByQuery(allPlaces, query),
    [allPlaces, query],
  )

  const sortedCatalogOnly = useMemo(
    () => orderPlacesByCatalogImagePriority(filteredCatalog),
    [filteredCatalog],
  )

  const selectedPlacesOrdered = useMemo(
    () =>
      selectedIds
        .map((id) => placesById[String(id)])
        .filter((p): p is PublicPlace => Boolean(p)),
    [selectedIds, placesById],
  )

  const filteredRecommendations = useMemo(() => {
    const q = filterPlacesByQuery(recommendationItems, query)
    return q.filter((p) => !selectedIdSet.has(p.id))
  }, [recommendationItems, query, selectedIdSet])

  const sortedRecommendations = useMemo(
    () => orderPlacesByCatalogImagePriority(filteredRecommendations),
    [filteredRecommendations],
  )

  const recIdSet = useMemo(
    () => new Set(recommendationItems.map((p) => p.id)),
    [recommendationItems],
  )

  const catalogSupplement = useMemo(() => {
    return sortedCatalogOnly.filter((p) => !selectedIdSet.has(p.id) && !recIdSet.has(p.id))
  }, [sortedCatalogOnly, selectedIdSet, recIdSet])

  const anchorName =
    anchorPlaceId != null ? placesById[String(anchorPlaceId)]?.name ?? null : null

  const canCreateRoute = selectedIds.length >= 1 && !routeCreateLoading

  const showBuilderUi = builderStarted && phase === 'ok'

  return (
    <div className="min-h-dvh bg-[#e8f4fc] pb-36 text-neutral-900">
      <a
        href="#catalog-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-kr-blue"
      >
        К каталогу мест
      </a>

      <header className="sticky top-0 z-30 border-b border-sky-200/60 bg-white/90 shadow-sm shadow-sky-900/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-4 sm:px-8 lg:px-14">
          <div className="flex items-center justify-between gap-4">
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
                className="h-12 w-auto object-contain object-left sm:h-10 lg:h-11"
                decoding="async"
              />
            </Link>
            <nav
              className="flex flex-wrap justify-center ml-32 gap-x-5 gap-y-1 text-kr-blue sm:gap-x-8 lg:gap-x-14"
              aria-label="Основная навигация"
            >
              <NavLink
                to="/places"
                className={({ isActive }) =>
                  `${navLinkClass} ${isActive ? navLinkActive : ''}`
                }
                end
              >
                Места
              </NavLink>
              <a href="/#places" className={navLinkClass}>
                Впечатления
              </a>
              <a href="/#how" className={navLinkClass}>
                Как это работает
              </a>
            </nav>
            <LoginButton variant="on-catalog" />
          </div>
        </div>
      </header>

      <main id="catalog-main" className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-14 lg:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <h1 className="font-display text-left text-[clamp(1.5rem,4vw,2.35rem)] font-bold uppercase leading-tight tracking-[0.08em] text-kr-blue">
            Места Краснодарского края
          </h1>
          <div className="relative w-full shrink-0 lg:max-w-md">
            <label htmlFor="places-catalog-search" className="sr-only">
              Поиск по названию
            </label>
            <input
              id="places-catalog-search"
              type="search"
              autoComplete="off"
              placeholder="Поиск по названию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-sky-200/90 bg-white py-3 pl-5 pr-12 text-[15px] text-neutral-800 shadow-inner shadow-sky-900/5 outline-none ring-kr-blue/30 transition placeholder:text-neutral-400 focus:border-kr-blue focus:ring-2"
            />
            <span
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-kr-blue/70"
              aria-hidden
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
            </span>
          </div>
        </div>

        {seasonsError ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[13px] text-amber-900">
            {seasonsError}
          </p>
        ) : null}

        {showBuilderUi ? (
          <div className="mt-8 rounded-2xl border border-sky-200/90 bg-white/95 px-5 py-4 shadow-sm shadow-sky-900/5">
            <p className="font-display text-[13px] font-bold uppercase tracking-wider text-kr-blue">
              Конструктор маршрута
            </p>
            {!activeSeasonSlug ? (
              <p className="mt-2 text-[13px] font-medium text-amber-800">
                Сезон для подбора пока не определён (нет данных с сервера или у места нет сезона). Каталог
                ниже всё равно доступен — добавляйте точки вручную.
              </p>
            ) : null}
            <p className="mt-2 text-[14px] leading-relaxed text-neutral-700">
              Подобрали места рядом с якорем
              {anchorName ? (
                <>
                  {' '}
                  <span className="font-semibold text-neutral-900">«{anchorName}»</span>
                </>
              ) : null}
              {activeSeasonSlug ? (
                <>
                  {' '}
                  в сезоне <span className="font-semibold text-neutral-900">{activeSeasonSlug}</span>
                </>
              ) : null}
              . Добавляйте точки в маршрут и нажмите «Создать маршрут».
            </p>
            {recommendationsStatus === 'error' && recommendationsError ? (
              <p className="mt-3 text-[13px] text-red-700">{recommendationsError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 lg:mt-12">
          {phase === 'loading' ? <SkeletonGrid /> : null}

          {phase === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <p className="text-[15px] font-medium text-red-800">{errorMessage}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="font-display mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-kr-blue px-8 text-[14px] font-bold uppercase tracking-wide text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kr-blue"
              >
                Повторить
              </button>
            </div>
          ) : null}

          {phase === 'empty' ? (
            <p className="rounded-2xl border border-sky-200/80 bg-white/90 px-6 py-12 text-center text-[15px] text-neutral-600">
              В каталоге пока нет мест. Загляните позже.
            </p>
          ) : null}

          {phase === 'ok' && !showBuilderUi && sortedCatalogOnly.length === 0 ? (
            <p className="rounded-2xl border border-sky-200/80 bg-white/90 px-6 py-12 text-center text-[15px] text-neutral-600">
              Ничего не найдено. Попробуйте изменить запрос.
            </p>
          ) : null}

          {phase === 'ok' && showBuilderUi ? (
            <div className="flex flex-col gap-12">
              {selectedPlacesOrdered.length > 0 ? (
                <section aria-labelledby="route-selected-heading">
                  <h2
                    id="route-selected-heading"
                    className="font-display text-[15px] font-bold uppercase tracking-wide text-neutral-800"
                  >
                    В маршруте ({selectedPlacesOrdered.length})
                  </h2>
                  <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {selectedPlacesOrdered.map((place) => (
                      <li key={`sel-${place.id}`}>
                        <CatalogPlaceCard
                          place={place}
                          inCart
                          onAddToRoute={handleAddToRoute}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="route-rec-heading">
                <h2
                  id="route-rec-heading"
                  className="font-display text-[15px] font-bold uppercase tracking-wide text-neutral-800"
                >
                  Рекомендации для вашего маршрута
                </h2>
                {recommendationsStatus === 'loading' ? (
                  <div className="mt-5">
                    <SkeletonGrid />
                  </div>
                ) : null}
                {recommendationsStatus === 'error' ? (
                  <p className="mt-4 rounded-xl border border-sky-200 bg-white/90 px-4 py-3 text-[14px] text-neutral-600">
                    Показан полный каталог ниже — подбор временно недоступен.
                  </p>
                ) : null}
                {recommendationsStatus === 'empty' ? (
                  <p className="mt-4 text-[14px] text-neutral-600">
                    Рядом больше нет новых мест с учётом фильтров — загляните в каталог ниже.
                  </p>
                ) : null}
                {recommendationsStatus === 'ok' && sortedRecommendations.length === 0 ? (
                  <p className="mt-4 text-[14px] text-neutral-600">
                    Нет совпадений по поиску в рекомендациях.
                  </p>
                ) : null}
                {recommendationsStatus === 'ok' && sortedRecommendations.length > 0 ? (
                  <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {sortedRecommendations.map((place) => {
                      const dist = (place as PublicPlaceRecommendation).distance_km
                      return (
                        <li key={`rec-${place.id}`}>
                          <CatalogPlaceCard
                            place={place}
                            inCart={selectedIdSet.has(place.id)}
                            onAddToRoute={handleAddToRoute}
                            distanceKm={dist}
                          />
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </section>

              <section aria-labelledby="route-catalog-heading">
                <h2
                  id="route-catalog-heading"
                  className="font-display text-[15px] font-bold uppercase tracking-wide text-neutral-800"
                >
                  Ещё из каталога
                </h2>
                {catalogSupplement.length === 0 ? (
                  <p className="mt-4 text-[14px] text-neutral-600">
                    Все подходящие места уже в подборке или в блоке рекомендаций.
                  </p>
                ) : (
                  <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {catalogSupplement.map((place) => (
                      <li key={`cat-${place.id}`}>
                        <CatalogPlaceCard
                          place={place}
                          inCart={selectedIdSet.has(place.id)}
                          onAddToRoute={handleAddToRoute}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {phase === 'ok' && !showBuilderUi && sortedCatalogOnly.length > 0 ? (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedCatalogOnly.map((place) => (
                <li key={place.id}>
                  <CatalogPlaceCard
                    place={place}
                    inCart={selectedIdSet.has(place.id)}
                    onAddToRoute={handleAddToRoute}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>

      {phase === 'ok' && builderStarted ? (
        <aside
          className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-200/80 bg-white/95 px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-8"
          aria-label="Корзина маршрута"
        >
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[12px] font-bold uppercase tracking-wider text-kr-blue">
                Ваш маршрут · {selectedIds.length}{' '}
                {selectedIds.length === 1 ? 'место' : selectedIds.length < 5 ? 'места' : 'мест'}
              </p>
              {routeCreateError ? (
                <p className="mt-1 text-[12px] text-red-700">{routeCreateError}</p>
              ) : null}
              <div className="mt-2 flex max-h-[72px] flex-wrap gap-2 overflow-y-auto">
                {selectedPlacesOrdered.map((p) => (
                  <span
                    key={`chip-${p.id}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100/90 py-1 pl-3 pr-1 text-[12px] font-medium text-neutral-800"
                  >
                    <span className="truncate">{p.name}</span>
                    <button
                      type="button"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white/80 hover:text-red-700"
                      aria-label={`Убрать ${p.name} из маршрута`}
                      onClick={() => removePlace(p.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => resetBuilder()}
                className="font-display order-2 min-h-11 rounded-full border border-sky-300 px-5 text-[12px] font-bold uppercase tracking-wide text-neutral-600 transition hover:bg-sky-50 sm:order-1"
              >
                Сбросить
              </button>
              <button
                type="button"
                disabled={!canCreateRoute}
                onClick={() => void handleCreateRoute()}
                className="font-display order-1 inline-flex min-h-11 min-w-[200px] items-center justify-center rounded-full bg-kr-blue px-8 text-[13px] font-bold uppercase tracking-wide text-white shadow-md shadow-kr-blue/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:order-2"
              >
                {routeCreateLoading ? 'Создаём…' : 'Создать маршрут'}
              </button>
            </div>
          </div>
          {!token ? (
            <p className="mx-auto mt-2 max-w-[1440px] text-center text-[11px] text-neutral-500">
              Чтобы сохранить маршрут, войдите в аккаунт — откроется окно входа по кнопке выше.
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}
