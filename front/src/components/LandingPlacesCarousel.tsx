import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchPlacesList,
  PlacesApiError,
  prioritizePlacesWithPhotos,
  type PlacesListResponse,
  type PublicPlace,
} from '../features/places/placesApi'

const AUTO_ADVANCE_MS = 5200
const USER_PAUSE_MS = 10_000
const AUTO_SCROLL_GUARD_MS = 900

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return reduced
}

function getCarouselStepPx(el: HTMLElement): number {
  const card = el.querySelector<HTMLElement>('[data-place-card]')
  if (!card) return 320
  const g = getComputedStyle(el).columnGap || getComputedStyle(el).gap
  const gap = Number.parseFloat(g) || 16
  return card.getBoundingClientRect().width + gap
}

function PlaceCardImage({ urls }: { urls: string[] }) {
  const [broken, setBroken] = useState(false)
  const src = urls[0]

  if (!src || broken) {
    return (
      <div
        className="flex h-44 w-full shrink-0 items-center justify-center bg-gradient-to-br from-[#4385f5]/25 via-slate-100 to-slate-200 text-[13px] font-medium text-neutral-500"
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
      className="h-44 w-full shrink-0 object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

function PlaceCard({ place }: { place: PublicPlace }) {
  const region =
    place.source_location?.trim() ||
    place.address?.trim() ||
    'Краснодарский край'
  const desc = place.description?.trim()

  return (
    <Link
      data-place-card
      to={`/places/${place.id}`}
      className="snap-center snap-always flex w-[min(85vw,300px)] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5] sm:w-[min(72vw,320px)] lg:w-80"
    >
      <PlaceCardImage urls={place.photo_urls} />
      <div className="flex min-h-[140px] flex-1 flex-col gap-2 p-4 text-left">
        <h3 className="font-display line-clamp-2 text-[17px] font-bold uppercase leading-tight tracking-wide text-neutral-900">
          {place.name}
        </h3>
        <p className="text-[13px] font-semibold text-[#4385f5]">{region}</p>
        {place.size ? (
          <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-400">
            {place.size}
          </p>
        ) : null}
        {desc ? (
          <p className="line-clamp-3 text-[14px] leading-relaxed text-neutral-600">
            {desc}
          </p>
        ) : (
          <p className="text-[14px] leading-relaxed text-neutral-400">
            Подробнее о локации — на странице места.
          </p>
        )}
      </div>
    </Link>
  )
}

export function LandingPlacesCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pauseUntilRef = useRef(0)
  const hoveringRef = useRef(false)
  const autoScrollingRef = useRef(false)

  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [items, setItems] = useState<PublicPlace[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const bumpUserPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + USER_PAUSE_MS
  }, [])

  const applyListResponse = useCallback((res: PlacesListResponse) => {
    if (res.items.length === 0) {
      setItems([])
      setPhase('empty')
    } else {
      setItems(prioritizePlacesWithPhotos(res.items))
      setPhase('ok')
    }
  }, [])

  const applyListError = useCallback((e: unknown) => {
    const msg =
      e instanceof PlacesApiError
        ? e.message
        : 'Не удалось загрузить места.'
    setErrorMessage(msg)
    setItems([])
    setPhase('error')
  }, [])

  const retry = useCallback(() => {
    setPhase('loading')
    setErrorMessage(null)
    void fetchPlacesList({ limit: 12, offset: 0 })
      .then(applyListResponse)
      .catch(applyListError)
  }, [applyListError, applyListResponse])

  useEffect(() => {
    let cancelled = false
    void fetchPlacesList({ limit: 12, offset: 0 })
      .then((res) => {
        if (cancelled) return
        applyListResponse(res)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        applyListError(e)
      })
    return () => {
      cancelled = true
    }
  }, [applyListError, applyListResponse])

  const advanceCarousel = useCallback(() => {
    if (reducedMotion) return
    const el = scrollerRef.current
    if (!el) return
    if (Date.now() < pauseUntilRef.current) return
    if (hoveringRef.current) return

    const maxLeft = el.scrollWidth - el.clientWidth
    if (maxLeft <= 4) return

    const step = getCarouselStepPx(el)
    autoScrollingRef.current = true
    const next = el.scrollLeft + step
    if (next >= maxLeft - 2) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: step, behavior: 'smooth' })
    }
    window.setTimeout(() => {
      autoScrollingRef.current = false
    }, AUTO_SCROLL_GUARD_MS)
  }, [reducedMotion])

  useEffect(() => {
    if (phase !== 'ok' || items.length < 2 || reducedMotion) return
    const id = window.setInterval(advanceCarousel, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [advanceCarousel, items.length, phase, reducedMotion])

  useEffect(() => {
    if (phase !== 'ok') return
    const el = scrollerRef.current
    if (!el) return

    const onScroll = () => {
      if (autoScrollingRef.current) return
      pauseUntilRef.current = Date.now() + USER_PAUSE_MS
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [phase, items])

  const scrollByDir = (dir: -1 | 1) => {
    bumpUserPause()
    const el = scrollerRef.current
    if (!el) return
    const step = getCarouselStepPx(el)
    autoScrollingRef.current = true
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
    window.setTimeout(() => {
      autoScrollingRef.current = false
    }, AUTO_SCROLL_GUARD_MS)
  }

  return (
    <section
      id="places"
      aria-labelledby="places-heading"
      className="border-t border-slate-200/80 bg-gradient-to-b from-slate-100 via-neutral-50 to-white py-12 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <h2
              id="places-heading"
              className="font-display text-left text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.1em] text-[#4385f5]"
            >
              Откройте для себя
            </h2>
            <p className="mt-2 max-w-xl text-left text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
              Винодельни и локации Кубани — подборка листается сама; наведите курсор
              или прокрутите вручную, чтобы сделать паузу.
            </p>
          </div>
          {phase === 'ok' ? (
            <div className="hidden shrink-0 gap-2 lg:flex">
              <button
                type="button"
                aria-label="Прокрутить влево"
                onClick={() => scrollByDir(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-neutral-700 shadow-sm transition hover:border-[#4385f5]/40 hover:text-[#4385f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Прокрутить вправо"
                onClick={() => scrollByDir(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-neutral-700 shadow-sm transition hover:border-[#4385f5]/40 hover:text-[#4385f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative mt-8 min-h-[360px] sm:min-h-[380px]">
          {phase === 'loading' ? (
            <div
              className="flex snap-x snap-mandatory gap-4 overflow-hidden pb-2 sm:gap-5"
              aria-busy
              aria-live="polite"
            >
              {[0, 1, 2].map((k) => (
                <div
                  key={k}
                  className="h-[360px] w-[min(85vw,300px)] shrink-0 animate-pulse rounded-2xl bg-slate-200/90 sm:w-[min(72vw,320px)] lg:w-80"
                />
              ))}
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="flex min-h-[280px] flex-col items-start justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 sm:px-10">
              <p className="text-[15px] font-semibold text-neutral-800">
                Не удалось загрузить каталог мест
              </p>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-neutral-600">
                {errorMessage} Проверьте, что backend запущен и доступен по{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
                  VITE_API_BASE_URL
                </code>
                .
              </p>
              <button
                type="button"
                onClick={() => void retry()}
                className="font-display mt-6 min-h-11 rounded-full bg-[#4385f5] px-8 text-[14px] font-bold uppercase tracking-wide text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
              >
                Повторить
              </button>
            </div>
          ) : null}

          {phase === 'empty' ? (
            <div className="flex min-h-[240px] flex-col items-start justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-10">
              <p className="text-[15px] font-semibold text-neutral-800">
                Пока нет мест в каталоге
              </p>
              <p className="mt-2 max-w-lg text-[14px] text-neutral-600">
                Когда в базе появятся записи, они отобразятся здесь автоматически.
              </p>
            </div>
          ) : null}

          {phase === 'ok' ? (
            <div
              className="relative -mx-1"
              onMouseEnter={() => {
                hoveringRef.current = true
              }}
              onMouseLeave={() => {
                hoveringRef.current = false
              }}
              onTouchStart={bumpUserPause}
              onWheel={bumpUserPause}
            >
              <div
                ref={scrollerRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 pt-1 [scrollbar-gutter:stable] sm:gap-5"
                tabIndex={0}
                role="region"
                aria-roledescription="карусель"
                aria-label="Каталог мест"
              >
                {items.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </div>
              <p className="mt-1 text-center text-[12px] text-neutral-500 lg:hidden">
                Листайте горизонтально — прокрутка ненадолго останавливает автоплей
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
