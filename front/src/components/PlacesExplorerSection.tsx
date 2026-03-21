import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchPlacesList,
  PlacesApiError,
  PLACES_PAGE_SIZE_EXPLORER,
  type PublicPlace,
} from '../features/places/placesApi'
import { PlacesExplorerList } from './PlacesExplorerList'
import { PlacesYandexMap } from './PlacesYandexMap'

/** Фиксированная высота split-блока на desktop: обе колонки совпадают, список скроллится внутри. */
const DISCOVER_SPLIT_HEIGHT_LG =
  'lg:h-[clamp(22rem,62vh,46rem)] lg:min-h-[22rem] lg:max-h-[46rem]'

export function PlacesExplorerSection() {
  const mapColumnRef = useRef<HTMLDivElement>(null)
  const [listScrollRoot, setListScrollRoot] = useState<HTMLDivElement | null>(null)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [places, setPlaces] = useState<PublicPlace[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)

  const nextOffsetRef = useRef(0)
  const fetchingMoreRef = useRef(false)
  const totalRef = useRef(0)
  const fetchGenRef = useRef(0)

  const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY

  useEffect(() => {
    totalRef.current = total
  }, [total])

  const runInitialFetch = useCallback(() => {
    const gen = ++fetchGenRef.current
    setPhase('loading')
    setLoadMoreError(null)
    setPlaces([])
    setTotal(0)
    nextOffsetRef.current = 0
    setSelectedPlaceId(null)

    void fetchPlacesList({ limit: PLACES_PAGE_SIZE_EXPLORER, offset: 0 })
      .then((res) => {
        if (gen !== fetchGenRef.current) return
        if (res.items.length === 0) {
          setPhase('empty')
          return
        }
        setPlaces(res.items)
        setTotal(res.total)
        nextOffsetRef.current = res.items.length
        setPhase('ok')
      })
      .catch(() => {
        if (gen !== fetchGenRef.current) return
        setPhase('error')
      })
  }, [])

  useEffect(() => {
    runInitialFetch()
  }, [runInitialFetch])

  const loadMore = useCallback(async () => {
    if (fetchingMoreRef.current) return
    const offset = nextOffsetRef.current
    if (offset >= totalRef.current && totalRef.current > 0) return

    fetchingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const res = await fetchPlacesList({
        limit: PLACES_PAGE_SIZE_EXPLORER,
        offset,
      })
      setTotal(res.total)
      totalRef.current = res.total

      if (res.items.length === 0) {
        return
      }

      setPlaces((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...res.items.filter((p) => !seen.has(p.id))]
      })
      nextOffsetRef.current = offset + res.items.length
    } catch (e) {
      setLoadMoreError(
        e instanceof PlacesApiError ? e.message : 'Не удалось подгрузить ещё места.',
      )
    } finally {
      fetchingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const onMarkerPlaceClick = useCallback((id: number) => {
    setSelectedPlaceId(id)
  }, [])

  const onSelectOnMap = useCallback((id: number) => {
    setSelectedPlaceId(id)
  }, [])

  return (
    <section
      id="discover"
      aria-labelledby="discover-heading"
      className="border-t border-slate-200 bg-white px-5 py-14 sm:px-8 sm:py-16 lg:px-14 lg:py-20"
    >
      <div className="mx-auto max-w-[1440px]">
        <h2
          id="discover-heading"
          className="font-display text-left text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.1em] text-[#4385f5]"
        >
          Каталог на карте
        </h2>
        <p className="mt-3 max-w-2xl text-left text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
          Листайте список — данные подгружаются порциями с сервера. На карте — метки у мест с
          координатами. Клик по строке центрирует карту; ссылка «Подробнее» открывает страницу места.
        </p>

        {phase === 'loading' ? (
          <div className="mt-10 space-y-3" aria-busy aria-live="polite">
            {[0, 1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-24 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : null}

        {phase === 'error' ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10">
            <p className="text-[15px] font-semibold text-neutral-800">
              Не удалось загрузить каталог
            </p>
            <button
              type="button"
              onClick={() => void runInitialFetch()}
              className="font-display mt-4 min-h-11 rounded-full bg-[#4385f5] px-8 text-[14px] font-bold uppercase tracking-wide text-white"
            >
              Повторить
            </button>
          </div>
        ) : null}

        {phase === 'empty' ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10">
            <p className="text-[15px] text-neutral-700">В каталоге пока нет мест.</p>
          </div>
        ) : null}

        {phase === 'ok' ? (
          <div
            className={`mt-10 flex min-h-0 flex-col gap-8 lg:grid lg:min-h-0 ${DISCOVER_SPLIT_HEIGHT_LG} lg:grid-cols-[minmax(0,32.5%)_minmax(0,62.5%)] lg:grid-rows-1 lg:items-stretch lg:gap-x-[5%] lg:gap-y-0`}
          >
            {/* Левая колонка 32.5%: список в ограниченной панели со скроллом */}
            <div className="flex min-h-0 flex-col lg:min-h-0 lg:overflow-hidden">
              <p className="mb-3 font-display text-[13px] font-bold uppercase tracking-wider text-neutral-500 lg:shrink-0">
                Список мест
              </p>
              <div
                ref={setListScrollRoot}
                tabIndex={0}
                role="region"
                aria-label="Список мест, прокрутка внутри блока"
                className="min-h-0 max-h-[min(56vh,520px)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 shadow-inner sm:p-4 lg:max-h-none lg:flex-1 lg:min-h-0"
              >
                <PlacesExplorerList
                  scrollRoot={listScrollRoot}
                  places={places}
                  total={total}
                  loadingMore={loadingMore}
                  loadMoreError={loadMoreError}
                  onLoadMore={loadMore}
                  selectedPlaceId={selectedPlaceId}
                  onSelectOnMap={onSelectOnMap}
                />
              </div>
            </div>

            {/* Правая колонка 62.5%: карта на всю высоту ряда */}
            <div
              ref={mapColumnRef}
              className="flex min-h-0 min-w-0 flex-col lg:min-h-0 lg:overflow-hidden"
            >
              <p className="mb-3 font-display text-[13px] font-bold uppercase tracking-wider text-neutral-500 lg:shrink-0">
                Карта
              </p>
              <div className="min-h-[min(42vh,360px)] min-w-0 flex-1 lg:min-h-0">
                <PlacesYandexMap
                  places={places}
                  selectedPlaceId={selectedPlaceId}
                  deferUntilVisible
                  visibilityAnchorRef={mapColumnRef}
                  apiKey={apiKey}
                  onMarkerPlaceClick={onMarkerPlaceClick}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
