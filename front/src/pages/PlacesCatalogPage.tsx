import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'

const PlacesSwipeDeck = lazy(() =>
  import('../components/PlacesSwipeDeck').then((m) => ({ default: m.PlacesSwipeDeck })),
)
import { fetchSeasons, type CatalogSeason } from '../features/catalog/catalogApi'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  appendUniquePlaces,
  fetchPlacesList,
  fetchPlaceRecommendations,
  formatRecommendationDistanceKm,
  getPrimaryDisplayPhotoUrl,
  orderPlacesByCatalogImagePriority,
  orderPlacesByCatalogImagePriorityRandomized,
  PlacesApiError,
  PLACES_BACKGROUND_FETCH_LIMIT,
  PLACES_CATALOG_FETCH_LIMIT,
  type PublicPlace,
  type PublicPlaceRecommendation,
} from '../features/places/placesApi'
import { useRouteCartStore } from '../features/routeCart/routeCartStore'
import { createRouteFromSelection, RoutesApiError } from '../features/routes/routesApi'

const CATALOG_LOGO_SRC =
  'https://storage.yandexcloud.net/hackathon-ss/logoPlace.svg'

/** Запрос к API с запасом: после отсечения типов уже в маршруте список всё ещё достаточно длинный. */
const ROUTE_REC_FETCH_LIMIT = 32
/** Сколько карточек оставляем в блоке рекомендаций после диверсификации. */
const ROUTE_REC_DISPLAY_LIMIT = 24
/**
 * Если такой `type_slug` уже есть среди выбранных мест — в рекомендациях не больше стольких
 * дополнительных карточек этого типа (остальные слоты — другие категории, по близости к якорю).
 */
const ROUTE_REC_MAX_EXTRA_PER_SELECTED_TYPE = 3

function sortRecommendationsByDistance(
  items: PublicPlaceRecommendation[],
): PublicPlaceRecommendation[] {
  const list = [...items]
  list.sort((a, b) => {
    const da = a.distance_km
    const db = b.distance_km
    if (da != null && db != null && da !== db) return da - db
    if (da != null && db == null) return -1
    if (da == null && db != null) return 1
    return a.id - b.id
  })
  return list
}

/**
 * `items` — по возрастанию `distance_km`. Сужаем повторяющиеся категории, уже представленные в маршруте.
 */
function diversifyRecommendationsBySelectedTypes(
  items: PublicPlaceRecommendation[],
  selectedPlaces: PublicPlace[],
  maxExtraPerType: number,
  maxTotal: number,
): PublicPlaceRecommendation[] {
  const typesInCart = new Set<string>()
  for (const p of selectedPlaces) {
    const t = p.type_slug?.trim()
    if (t) typesInCart.add(t)
  }
  if (typesInCart.size === 0) {
    return items.slice(0, maxTotal)
  }
  const counts = new Map<string, number>()
  const out: PublicPlaceRecommendation[] = []
  for (const place of items) {
    if (out.length >= maxTotal) break
    const t = place.type_slug?.trim()
    if (!t || !typesInCart.has(t)) {
      out.push(place)
      continue
    }
    const c = counts.get(t) ?? 0
    if (c < maxExtraPerType) {
      out.push(place)
      counts.set(t, c + 1)
    }
  }
  return out
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

function AnchorToastThumb({ place }: { place: PublicPlace | null | undefined }) {
  const [broken, setBroken] = useState(false)
  const src = place ? getPrimaryDisplayPhotoUrl(place) : ''

  if (!place || !src || broken) {
    return (
      <div
        className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-200/80 to-sky-100 text-[11px] font-medium text-neutral-500"
        aria-hidden
      >
        Фото
      </div>
    )
  }

  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sky-100 ring-1 ring-sky-200/80">
      <img
        src={src}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </div>
  )
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
  const distLabel = formatRecommendationDistanceKm(distanceKm)

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

/** Монтирует тяжёлую карточку только при приближении к вьюпорту — меньше работы на длинных сетках. */
const CATALOG_CARD_IO_MARGIN = '280px 0px 400px 0px'

/** Совпадает по высоте с областью `PlacesSwipeDeck`, чтобы не прыгал layout при lazy-chunk. */
const MOBILE_DECK_FALLBACK_HEIGHT =
  'h-[min(calc(100dvh-12.5rem),78dvh)] min-h-[280px]'

function LazyMountCatalogCard({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (visible) return
    const el = hostRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            obs.disconnect()
            return
          }
        }
      },
      { root: null, rootMargin: CATALOG_CARD_IO_MARGIN, threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  if (visible) {
    return <>{children}</>
  }

  return (
    <div ref={hostRef} aria-busy="true">
      <div
        className="overflow-hidden rounded-2xl bg-white shadow-md shadow-sky-900/10 ring-1 ring-sky-100/90"
        aria-hidden
      >
        <div className="aspect-[3/4] w-full min-h-[220px] animate-pulse bg-gradient-to-br from-slate-200 to-slate-100 sm:min-h-[260px] lg:min-h-[280px]" />
      </div>
    </div>
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

const SESSION_SWIPE_HINT_KEY = 'kray-places-swipe-hint-seen'

const MOBILE_MAX_CSS = '(max-width: 639px)'

/** Стабильный PRNG на визит страницы: порядок каталога не «прыгает» при догрузке страниц. */
function createMulberry32(seed: number): () => number {
  let a = seed >>> 0
  if (a === 0) a = 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sortedPlaceIdsSignature(places: PublicPlace[]): string {
  if (places.length === 0) return ''
  const ids = places.map((p) => p.id)
  ids.sort((a, b) => a - b)
  return ids.join(',')
}

type CatalogVisualOrderCache = {
  loadSeq: number
  idsSignature: string
  order: number[]
}

export function PlacesCatalogPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const catalogLoadSeqRef = useRef(0)
  const catalogVisualOrderRef = useRef<CatalogVisualOrderCache | null>(null)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [allPlaces, setAllPlaces] = useState<PublicPlace[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogHydrating, setCatalogHydrating] = useState(false)
  const [catalogHydrationError, setCatalogHydrationError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [catalogShuffleSeed] = useState(() => 1 + Math.floor(Math.random() * 0x7ffffffe))
  const [seasons, setSeasons] = useState<CatalogSeason[]>([])
  const [seasonsError, setSeasonsError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  const swipeHintTitleId = useId()
  const routeReviewTitleId = useId()
  const builderToastTitleId = useId()
  const [swipeHintOpen, setSwipeHintOpen] = useState(false)
  const [builderToastDismissed, setBuilderToastDismissed] = useState(false)
  const [routeReviewOpen, setRouteReviewOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const selectedIds = useRouteCartStore((s) => s.selectedIds)
  const placesById = useRouteCartStore((s) => s.placesById)
  const anchorPlaceId = useRouteCartStore((s) => s.anchorPlaceId)
  const activeSeasonSlug = useRouteCartStore((s) => s.activeSeasonSlug)
  const builderStarted = useRouteCartStore((s) => s.builderStarted)
  const recommendationItems = useRouteCartStore((s) => s.recommendationItems)
  const recommendationsBroadFallback = useRouteCartStore((s) => s.recommendationsBroadFallback)
  const recommendationsStatus = useRouteCartStore((s) => s.recommendationsStatus)
  const recommendationsError = useRouteCartStore((s) => s.recommendationsError)
  const routeCreateLoading = useRouteCartStore((s) => s.routeCreateLoading)
  const routeCreateError = useRouteCartStore((s) => s.routeCreateError)

  const addPlace = useRouteCartStore((s) => s.addPlace)
  const removePlace = useRouteCartStore((s) => s.removePlace)
  const rejectSwipePlace = useRouteCartStore((s) => s.rejectSwipePlace)
  const swipeRejectedIds = useRouteCartStore((s) => s.swipeRejectedIds)
  const resetBuilder = useRouteCartStore((s) => s.resetBuilder)
  const setRecommendationsLoading = useRouteCartStore((s) => s.setRecommendationsLoading)
  const setRouteAnchor = useRouteCartStore((s) => s.setRouteAnchor)
  const setActiveSeasonId = useRouteCartStore((s) => s.setActiveSeasonId)
  const setRouteCreateLoading = useRouteCartStore((s) => s.setRouteCreateLoading)
  const setRouteCreateError = useRouteCartStore((s) => s.setRouteCreateError)

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const swipeRejectedSet = useMemo(() => new Set(swipeRejectedIds), [swipeRejectedIds])

  const runCatalogFetch = useCallback(() => {
    const seq = ++catalogLoadSeqRef.current

    setPhase('loading')
    setErrorMessage(null)
    setCatalogHydrationError(null)
    setAllPlaces([])
    setCatalogTotal(0)
    setCatalogHydrating(false)

    void (async () => {
      let hasVisibleCatalog = false

      try {
        const firstPage = await fetchPlacesList({
          limit: PLACES_CATALOG_FETCH_LIMIT,
          offset: 0,
        })

        if (seq !== catalogLoadSeqRef.current) return

        setCatalogTotal(firstPage.total)

        if (firstPage.items.length === 0) {
          setAllPlaces([])
          setPhase('empty')
          return
        }

        setAllPlaces(firstPage.items)
        setPhase('ok')
        hasVisibleCatalog = true

        if (firstPage.total <= firstPage.items.length) {
          setCatalogHydrating(false)
          return
        }

        setCatalogHydrating(true)

        let offset = firstPage.items.length

        while (offset < firstPage.total) {
          const nextPage = await fetchPlacesList({
            limit: PLACES_BACKGROUND_FETCH_LIMIT,
            offset,
          })

          if (seq !== catalogLoadSeqRef.current) return
          if (nextPage.items.length === 0) break

          setAllPlaces((current) => appendUniquePlaces(current, nextPage.items))
          setCatalogTotal(nextPage.total)
          offset += nextPage.items.length
        }

        if (seq !== catalogLoadSeqRef.current) return
        setCatalogHydrating(false)
      } catch (error) {
        if (seq !== catalogLoadSeqRef.current) return
        setCatalogHydrating(false)
        const message =
          error instanceof PlacesApiError ? error.message : 'Не удалось загрузить каталог мест.'

        if (hasVisibleCatalog) {
          setCatalogHydrationError(message)
          return
        }

        setAllPlaces([])
        setCatalogTotal(0)
        setErrorMessage(message)
        setPhase('error')
      }
    })()
  }, [])

  useEffect(() => {
    runCatalogFetch()
    return () => {
      catalogLoadSeqRef.current += 1
    }
  }, [runCatalogFetch])

  useEffect(() => {
    if (phase !== 'ok') return
    if (typeof window === 'undefined') return
    if (!window.matchMedia(MOBILE_MAX_CSS).matches) return
    if (sessionStorage.getItem(SESSION_SWIPE_HINT_KEY)) return
    setSwipeHintOpen(true)
  }, [phase])

  useEffect(() => {
    const anyOpen = swipeHintOpen || routeReviewOpen || mobileNavOpen
    if (!anyOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [swipeHintOpen, routeReviewOpen, mobileNavOpen])

  useEffect(() => {
    if (!swipeHintOpen && !routeReviewOpen && !mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (swipeHintOpen) {
        sessionStorage.setItem(SESSION_SWIPE_HINT_KEY, '1')
        setSwipeHintOpen(false)
        return
      }
      if (routeReviewOpen) {
        setRouteReviewOpen(false)
        return
      }
      setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [swipeHintOpen, routeReviewOpen, mobileNavOpen])

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

  useEffect(() => {
    if (!builderStarted) setBuilderToastDismissed(false)
  }, [builderStarted])

  const recSignature = useMemo(() => {
    const rej = [...swipeRejectedIds].sort((a, b) => a - b).join(',')
    return `${anchorPlaceId ?? ''}|${selectedIds.join(',')}|${rej}`
  }, [anchorPlaceId, selectedIds, swipeRejectedIds])

  useEffect(() => {
    if (!builderStarted || !anchorPlaceId || !activeSeasonSlug) return

    setRecommendationsLoading()
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      const st = useRouteCartStore.getState()
      const exclude_place_ids = [
        ...new Set([...st.selectedIds, ...st.swipeRejectedIds]),
      ]
      void fetchPlaceRecommendations(
        {
          season_slug: activeSeasonSlug,
          anchor_place_id: anchorPlaceId,
          exclude_place_ids,
          radius_km: 80,
          limit: ROUTE_REC_FETCH_LIMIT,
        },
        { signal: ctrl.signal },
      )
        .then((res) => {
          const latest = useRouteCartStore.getState()
          const hide = new Set([...latest.selectedIds, ...latest.swipeRejectedIds])
          const selectedPlaces = latest.selectedIds
            .map((id) => latest.placesById[String(id)])
            .filter((p): p is PublicPlace => Boolean(p))
          const raw = res.items.filter((p) => !hide.has(p.id))
          const sorted = sortRecommendationsByDistance(raw)
          const next =
            latest.selectedIds.length >= 1
              ? diversifyRecommendationsBySelectedTypes(
                  sorted,
                  selectedPlaces,
                  ROUTE_REC_MAX_EXTRA_PER_SELECTED_TYPE,
                  ROUTE_REC_DISPLAY_LIMIT,
                )
              : sorted.slice(0, ROUTE_REC_DISPLAY_LIMIT)
          latest.setRecommendationsResult(next, res.recommendation_broad_fallback === true)
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          const msg =
            e instanceof PlacesApiError ? e.message : 'Не удалось подобрать похожие места.'
          useRouteCartStore.getState().setRecommendationsError(msg)
        })
    }, 160)

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
    runCatalogFetch()
  }

  const handleAddToRoute = useCallback(
    (place: PublicPlace) => {
      const fallback = seasons[0]?.slug ?? null
      addPlace(place, { defaultSeasonSlug: fallback })
    },
    [addPlace, seasons],
  )

  const handleSwipeSkip = useCallback(
    (place: PublicPlace) => {
      rejectSwipePlace(place.id)
    },
    [rejectSwipePlace],
  )

  const dismissSwipeHint = useCallback(() => {
    sessionStorage.setItem(SESSION_SWIPE_HINT_KEY, '1')
    setSwipeHintOpen(false)
  }, [])

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
      setRouteReviewOpen(false)
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
    () => filterPlacesByQuery(allPlaces, deferredQuery),
    [allPlaces, deferredQuery],
  )

  const sortedCatalogOnly = useMemo(() => {
    if (normalizeSearch(deferredQuery)) {
      return orderPlacesByCatalogImagePriority(filteredCatalog)
    }
    if (filteredCatalog.length === 0) {
      return []
    }

    const loadSeq = catalogLoadSeqRef.current
    const sig = sortedPlaceIdsSignature(filteredCatalog)
    const cache = catalogVisualOrderRef.current
    let orderIds: number[]

    if (!cache || cache.loadSeq !== loadSeq) {
      const ordered = orderPlacesByCatalogImagePriorityRandomized(
        filteredCatalog,
        createMulberry32(catalogShuffleSeed),
      )
      orderIds = ordered.map((p) => p.id)
      catalogVisualOrderRef.current = { loadSeq, idsSignature: sig, order: orderIds }
    } else if (cache.idsSignature === sig) {
      orderIds = cache.order
    } else {
      const prevOrder = cache.order
      const prevSet = new Set(prevOrder)
      const kept = prevOrder.filter((id) => filteredCatalog.some((p) => p.id === id))
      const incomingPlaces = filteredCatalog.filter((p) => !prevSet.has(p.id))
      let nextOrder: number[]
      if (incomingPlaces.length === 0) {
        nextOrder = kept
      } else {
        const mixSeed = (catalogShuffleSeed ^ incomingPlaces[0]!.id) >>> 0
        nextOrder = [
          ...kept,
          ...orderPlacesByCatalogImagePriorityRandomized(
            incomingPlaces,
            createMulberry32(mixSeed),
          ).map((p) => p.id),
        ]
      }
      catalogVisualOrderRef.current = { loadSeq, idsSignature: sig, order: nextOrder }
      orderIds = nextOrder
    }

    const map = new Map(filteredCatalog.map((p) => [p.id, p]))
    return orderIds.map((id) => map.get(id)).filter((p): p is PublicPlace => Boolean(p))
  }, [filteredCatalog, deferredQuery, catalogShuffleSeed])

  const sortedCatalogVisible = useMemo(
    () => sortedCatalogOnly.filter((p) => !swipeRejectedSet.has(p.id)),
    [sortedCatalogOnly, swipeRejectedSet],
  )

  const selectedPlacesOrdered = useMemo(
    () =>
      selectedIds
        .map((id) => placesById[String(id)])
        .filter((p): p is PublicPlace => Boolean(p)),
    [selectedIds, placesById],
  )

  const sortedRecommendations = useMemo(() => {
    const q = filterPlacesByQuery(recommendationItems, deferredQuery)
    const filtered = q.filter((p) => !selectedIdSet.has(p.id) && !swipeRejectedSet.has(p.id))
    const list = [...filtered]
    list.sort((a, b) => {
      const da = (a as PublicPlaceRecommendation).distance_km
      const db = (b as PublicPlaceRecommendation).distance_km
      if (da != null && db != null && da !== db) return da - db
      if (da != null && db == null) return -1
      if (da == null && db != null) return 1
      return a.id - b.id
    })
    return list
  }, [recommendationItems, deferredQuery, selectedIdSet, swipeRejectedSet])

  const recIdSet = useMemo(
    () => new Set(recommendationItems.map((p) => p.id)),
    [recommendationItems],
  )

  const catalogSupplement = useMemo(() => {
    return sortedCatalogVisible.filter((p) => !selectedIdSet.has(p.id) && !recIdSet.has(p.id))
  }, [sortedCatalogVisible, selectedIdSet, recIdSet])

  const showBuilderUi = builderStarted && phase === 'ok'

  const mobileDeckPlaces = useMemo(() => {
    const seen = new Set<number>()
    const out: PublicPlace[] = []
    if (showBuilderUi) {
      for (const p of sortedRecommendations) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(p)
      }
      for (const p of catalogSupplement) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(p)
      }
      return out
    }
    for (const p of sortedCatalogVisible) {
      if (selectedIdSet.has(p.id)) continue
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push(p)
    }
    return out
  }, [showBuilderUi, sortedRecommendations, catalogSupplement, sortedCatalogVisible, selectedIdSet])

  const anchorName =
    anchorPlaceId != null ? placesById[String(anchorPlaceId)]?.name ?? null : null
  const anchorPlace =
    anchorPlaceId != null ? placesById[String(anchorPlaceId)] ?? null : null

  const showBuilderToast = showBuilderUi && !builderToastDismissed

  const canCreateRoute = selectedIds.length >= 1 && !routeCreateLoading

  return (
    <div
      className={`min-h-dvh bg-[#e8f4fc] text-neutral-900 ${
        phase === 'ok'
          ? 'max-sm:flex max-sm:h-dvh max-sm:flex-col max-sm:overflow-hidden max-sm:pb-0 sm:pb-36'
          : 'pb-36'
      }`}
    >
      <a
        href="#catalog-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-kr-blue"
      >
        К каталогу мест
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
              className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-1 text-kr-blue lg:gap-x-10 sm:flex"
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
              <NavLink
                to="/impressions"
                className={({ isActive }) =>
                  `${navLinkClass} ${isActive ? navLinkActive : ''}`
                }
                end
              >
                Впечатления
              </NavLink>
              <NavLink
                to="/myroutes"
                className={({ isActive }) =>
                  `${navLinkClass} ${isActive ? navLinkActive : ''}`
                }
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
              <LoginButton variant="on-catalog" className="!min-w-0 px-4 text-[13px] sm:!min-w-[120px] sm:px-8 sm:text-[15px]" />
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
                onMouseDown={(e) => e.stopPropagation()}
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
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? 'bg-sky-50 ' + navLinkActive : ''}`
                  }
                >
                  Места
                </NavLink>
                <NavLink
                  to="/impressions"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? 'bg-sky-50 ' + navLinkActive : ''}`
                  }
                >
                  Впечатления
                </NavLink>
                <NavLink
                  to="/myroutes"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? 'bg-sky-50 ' + navLinkActive : ''}`
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
        id="catalog-main"
        className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-14 lg:py-12 max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-hidden max-sm:px-3 max-sm:py-2"
      >
        <div className="flex shrink-0 flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <h1 className="sr-only font-display text-left text-[clamp(1.5rem,4vw,2.35rem)] font-bold uppercase leading-tight tracking-[0.08em] text-kr-blue sm:not-sr-only sm:block">
            Места Краснодарского края
          </h1>
          <div className="relative w-full shrink-0 lg:max-w-md ">
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
              className="w-full rounded-full border border-sky-200/90 bg-white py-2.5 pl-4 pr-11 text-[14px] text-neutral-800 shadow-inner shadow-sky-900/5 outline-none ring-kr-blue/30 transition placeholder:text-neutral-400 focus:border-kr-blue focus:ring-2 sm:py-3 sm:pl-5 sm:pr-12 sm:text-[15px]"
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

        {phase === 'ok' ? (
          <p className="mt-3 shrink-0 text-[12px] text-neutral-500 sm:text-[13px]">
            {catalogHydrating
              ? `Показываем первые места сразу, остальное догружается в фоне: ${allPlaces.length} из ${catalogTotal || allPlaces.length}.`
              : `Каталог загружен: ${allPlaces.length} мест.`}
          </p>
        ) : null}

        {seasonsError ? (
          <p className="mt-2 shrink-0 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-900 sm:mt-6 sm:rounded-xl sm:px-4 sm:py-3 sm:text-[13px]">
            {seasonsError}
          </p>
        ) : null}

        {phase === 'ok' && catalogHydrationError ? (
          <p className="mt-2 shrink-0 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-900 sm:rounded-xl sm:px-4 sm:py-3 sm:text-[13px]">
            {catalogHydrationError}
          </p>
        ) : null}

        {showBuilderUi &&
        builderToastDismissed &&
        recommendationsStatus === 'error' &&
        recommendationsError ? (
          <p className="mt-2 shrink-0 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-[12px] text-red-800 sm:mt-6 sm:rounded-xl sm:px-4 sm:py-3 sm:text-[13px]">
            {recommendationsError}
          </p>
        ) : null}

        <div className="mt-3 min-h-0 flex-1 flex flex-col sm:mt-10 lg:mt-12">
          {phase === 'loading' ? (
            <>
              <div className="py-16 text-center sm:hidden">
                <div className="mx-auto size-10 animate-spin rounded-full border-2 border-kr-blue border-t-transparent" />
                <p className="mt-4 text-[14px] text-neutral-600">Загружаем каталог…</p>
              </div>
              <div className="hidden sm:block">
                <SkeletonGrid />
              </div>
            </>
          ) : null}

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

          {phase === 'ok' && !showBuilderUi && sortedCatalogVisible.length === 0 ? (
            <p className="rounded-2xl border border-sky-200/80 bg-white/90 px-6 py-12 text-center text-[15px] text-neutral-600">
              Ничего не найдено. Попробуйте изменить запрос.
            </p>
          ) : null}

          {phase === 'ok' ? (
            <div className="flex min-h-0 flex-1 flex-col sm:hidden">
              <Suspense
                fallback={
                  <div
                    className={`flex flex-1 flex-col items-center justify-center ${MOBILE_DECK_FALLBACK_HEIGHT}`}
                  >
                    <div className="size-10 animate-spin rounded-full border-2 border-kr-blue border-t-transparent" />
                    <p className="mt-3 text-[13px] text-neutral-600">Готовим колоду…</p>
                  </div>
                }
              >
                <PlacesSwipeDeck
                  deck={mobileDeckPlaces}
                  recommendationsLoading={showBuilderUi && recommendationsStatus === 'loading'}
                  onSkip={handleSwipeSkip}
                  onLike={handleAddToRoute}
                />
              </Suspense>
            </div>
          ) : null}

          {phase === 'ok' && showBuilderUi ? (
            <div className="hidden sm:flex sm:flex-col sm:gap-12">
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
                        <LazyMountCatalogCard>
                          <CatalogPlaceCard
                            place={place}
                            inCart
                            onAddToRoute={handleAddToRoute}
                          />
                        </LazyMountCatalogCard>
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
                  Следующие точки маршрута
                </h2>
                {anchorName ? (
                  <p className="mt-2 max-w-3xl text-[13px] leading-snug text-neutral-600">
                    Рекомендуем рядом с{' '}
                    <span className="font-semibold text-neutral-800">«{anchorName}»</span>
                    {activeSeasonSlug ? (
                      <>
                        {' '}
                        в сезоне <span className="font-medium text-neutral-800">{activeSeasonSlug}</span>
                      </>
                    ) : null}
                    . Добавленные и пропущенные места не попадают в подборку повторно.
                    {selectedIds.length >= 1 ? (
                      <>
                        {' '}
                        Категории, которые уже есть в маршруте, показываем реже (до{' '}
                        {ROUTE_REC_MAX_EXTRA_PER_SELECTED_TYPE} новых карточек каждой); в приоритете —{' '}
                        <span className="font-medium text-neutral-800">другие типы мест</span>, начиная с
                        ближайших к якорю.
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-neutral-600">
                    Подборка обновляется при каждом изменении маршрута и якорной точки.
                  </p>
                )}
                {recommendationsBroadFallback && recommendationsStatus === 'ok' ? (
                  <p className="mt-3 max-w-3xl rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950">
                    Рядом с этой точкой новых локаций почти не осталось — показываем более широкий список в
                    выбранном сезоне. Расстояние до якоря может быть недоступно для части карточек.
                  </p>
                ) : null}
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
                    В этом сезоне не осталось новых мест с учётом фильтров — загляните в каталог ниже или
                    смените сезон у якорной точки.
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
                          <LazyMountCatalogCard>
                            <CatalogPlaceCard
                              place={place}
                              inCart={selectedIdSet.has(place.id)}
                              onAddToRoute={handleAddToRoute}
                              distanceKm={dist}
                            />
                          </LazyMountCatalogCard>
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
                        <LazyMountCatalogCard>
                          <CatalogPlaceCard
                            place={place}
                            inCart={selectedIdSet.has(place.id)}
                            onAddToRoute={handleAddToRoute}
                          />
                        </LazyMountCatalogCard>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {phase === 'ok' && !showBuilderUi && sortedCatalogVisible.length > 0 ? (
            <ul className="hidden gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedCatalogVisible.map((place) => (
                <li key={place.id}>
                  <LazyMountCatalogCard>
                    <CatalogPlaceCard
                      place={place}
                      inCart={selectedIdSet.has(place.id)}
                      onAddToRoute={handleAddToRoute}
                    />
                  </LazyMountCatalogCard>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>

      {phase === 'ok' && builderStarted ? (
        <aside
          className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md"
          aria-label="Корзина маршрута"
        >
          <div className="mx-auto max-w-[1440px] sm:hidden">
            <div className="flex flex-col gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-[11px] font-bold uppercase tracking-wider text-kr-blue">
                  В маршруте: {selectedIds.length}{' '}
                  {selectedIds.length === 1 ? 'место' : selectedIds.length < 5 ? 'места' : 'мест'}
                </p>
                <button
                  type="button"
                  onClick={() => setRouteReviewOpen(true)}
                  className="font-display inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-kr-blue px-4 text-[11px] font-bold uppercase tracking-wide text-white shadow-md shadow-kr-blue/25"
                >
                  к маршруту
                </button>
              </div>
              {routeCreateError ? (
                <p className="text-[11px] text-red-700">{routeCreateError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => resetBuilder()}
                className="font-display min-h-10 rounded-full border border-sky-300 px-4 text-[11px] font-bold uppercase tracking-wide text-neutral-600"
              >
                Сбросить конструктор
              </button>
              {!token ? (
                <p className="text-center text-[10px] leading-snug text-neutral-500">
                  Чтобы сохранить маршрут, войдите — кнопка «Войти» в шапке.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mx-auto hidden max-w-[1440px] flex-col gap-4 px-4 py-4 sm:flex lg:flex-row lg:items-center lg:justify-between lg:gap-6 sm:px-8">
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
                    className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-sky-100/90 py-1 pl-1 pr-1 text-[12px] font-medium text-neutral-800"
                  >
                    <button
                      type="button"
                      title="Сделать якорем для рекомендаций"
                      aria-pressed={anchorPlaceId === p.id}
                      onClick={() => setRouteAnchor(p.id)}
                      className={`min-h-9 min-w-0 max-w-[200px] truncate rounded-full px-2 text-left transition ${
                        anchorPlaceId === p.id
                          ? 'bg-white font-semibold text-kr-blue ring-1 ring-kr-blue/30'
                          : 'text-neutral-800 hover:bg-white/70'
                      }`}
                    >
                      {p.name}
                    </button>
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
            <p className="mx-auto hidden max-w-[1440px] pb-3 text-center text-[11px] text-neutral-500 sm:block">
              Чтобы сохранить маршрут, войдите в аккаунт — откроется окно входа по кнопке выше.
            </p>
          ) : null}
        </aside>
      ) : null}

      {showBuilderToast
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[45] flex justify-center px-3 sm:inset-x-auto sm:right-5 sm:top-24 sm:justify-end"
              role="region"
              aria-labelledby={builderToastTitleId}
            >
              <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-sky-200/90 bg-white/98 px-4 py-3 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:max-w-sm">
                <div className="flex gap-3">
                  <AnchorToastThumb place={anchorPlace} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        id={builderToastTitleId}
                        className="font-display text-[12px] font-bold uppercase tracking-wider text-kr-blue"
                      >
                        Конструктор маршрута
                      </p>
                      <button
                        type="button"
                        onClick={() => setBuilderToastDismissed(true)}
                        aria-label="Скрыть подсказку конструктора"
                        className="inline-flex min-h-9 min-w-9 shrink-0 -translate-y-1 items-center justify-center rounded-full text-[1.35rem] leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kr-blue"
                      >
                        ×
                      </button>
                    </div>
                    {!activeSeasonSlug ? (
                      <p className="mt-2 text-[12px] font-medium leading-snug text-amber-800">
                        Сезон для подбора пока не определён. Каталог доступен — добавляйте точки вручную.
                      </p>
                    ) : null}
                    <p className="mt-2 text-[13px] leading-snug text-neutral-700">
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
                          в сезоне{' '}
                          <span className="font-semibold text-neutral-900">{activeSeasonSlug}</span>
                        </>
                      ) : null}
                      .{' '}
                      <span className="sm:hidden">
                        Добавляйте точки свайпом вправо, затем нажмите «к маршруту» внизу — там список и
                        кнопка сохранения.
                      </span>
                      <span className="hidden sm:inline">
                        Добавляйте точки в маршрут и нажмите «Создать маршрут».
                      </span>
                    </p>
                    {recommendationsStatus === 'error' && recommendationsError ? (
                      <p className="mt-2 text-[12px] leading-snug text-red-700">{recommendationsError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {swipeHintOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 pb-8 sm:items-center sm:pb-4"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) dismissSwipeHint()
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={swipeHintTitleId}
                className="w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id={swipeHintTitleId}
                    className="font-display text-[1.1rem] font-bold uppercase leading-snug tracking-wide text-kr-blue sm:text-[1.2rem]"
                  >
                    Свайп по карточкам
                  </h2>
                  <button
                    type="button"
                    onClick={dismissSwipeHint}
                    aria-label="Закрыть подсказку"
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kr-blue"
                  >
                    ×
                  </button>
                </div>
                <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-neutral-700">
                  <li>
                    <span className="font-semibold text-neutral-900">Влево</span> — пропустить место (не в
                    маршрут).
                  </li>
                  <li>
                    <span className="font-semibold text-neutral-900">Вправо</span> — добавить в маршрут /
                    избранное подборки.
                  </li>
                </ul>
                <p className="mt-4 text-[13px] text-neutral-500">
                  На карточке показывается главное фото места.
                </p>
                <button
                  type="button"
                  onClick={dismissSwipeHint}
                  className="font-display mt-6 min-h-12 w-full rounded-full bg-kr-blue text-[14px] font-bold uppercase tracking-wide text-white shadow-md shadow-kr-blue/25"
                >
                  Понятно
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {routeReviewOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:p-4 sm:pb-8"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setRouteReviewOpen(false)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={routeReviewTitleId}
                className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sky-100 px-5 py-4">
                  <h2
                    id={routeReviewTitleId}
                    className="font-display pr-2 text-[1.05rem] font-bold uppercase leading-snug tracking-wide text-kr-blue"
                  >
                    Ваш маршрут
                  </h2>
                  <button
                    type="button"
                    onClick={() => setRouteReviewOpen(false)}
                    aria-label="Закрыть"
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 hover:bg-neutral-100"
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {selectedPlacesOrdered.length === 0 ? (
                    <p className="text-[15px] text-neutral-600">
                      Пока нет точек. Свайпните карточку <span className="font-semibold">вправо</span>, чтобы
                      добавить место в маршрут.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {selectedPlacesOrdered.map((p, idx) => (
                        <li
                          key={`rv-${p.id}`}
                          className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kr-blue/15 text-[13px] font-bold text-kr-blue">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-neutral-900">{p.name}</p>
                            {p.source_location ? (
                              <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-500">
                                {p.source_location}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePlace(p.id)}
                            className="shrink-0 rounded-full px-2 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
                            aria-label={`Убрать ${p.name}`}
                          >
                            Убрать
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {routeCreateError ? (
                    <p className="mt-4 text-[13px] text-red-700">{routeCreateError}</p>
                  ) : null}
                </div>
                <div className="shrink-0 space-y-3 border-t border-sky-100 px-5 py-4">
                  <button
                    type="button"
                    disabled={!canCreateRoute}
                    onClick={() => void handleCreateRoute()}
                    className="font-display flex min-h-12 w-full items-center justify-center rounded-full bg-kr-blue text-[14px] font-bold uppercase tracking-wide text-white shadow-md shadow-kr-blue/25 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {routeCreateLoading ? 'Создаём маршрут…' : 'Создать маршрут'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetBuilder()
                      setRouteReviewOpen(false)
                    }}
                    className="font-display w-full rounded-full border border-sky-300 py-3 text-[12px] font-bold uppercase tracking-wide text-neutral-600"
                  >
                    Сбросить конструктор
                  </button>
                  {!token ? (
                    <p className="text-center text-[11px] text-neutral-500">
                      Для сохранения войдите в аккаунт (кнопка в шапке).
                    </p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
