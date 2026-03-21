import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlaceCommentsModal } from './PlaceCommentsModal'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  hydratePlaceInteractions,
  likePlace,
  PlaceInteractionsApiError,
  unlikePlace,
} from '../features/places/placeInteractionsApi'
import {
  fetchPlacesList,
  placeHasDisplayablePhoto,
  PlacesApiError,
  type PlacesListResponse,
  type PublicPlace,
} from '../features/places/placesApi'

const AUTO_ADVANCE_MS = 5200
const USER_PAUSE_MS = 10_000
const AUTO_SCROLL_GUARD_MS = 900

type InteractionNotice = {
  kind: 'info' | 'error'
  message: string
}

type PlaceInteractionState = {
  likesCount: number
  commentsCount: number
  likedByCurrentUser: boolean
  loaded: boolean
}

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

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5 4.9 13.9a4.96 4.96 0 0 1 0-7.07 4.87 4.87 0 0 1 6.98 0L12 7.94l.12-.11a4.87 4.87 0 0 1 6.98 0 4.96 4.96 0 0 1 0 7.07Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 18.5 3.5 21V6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5V16A2.5 2.5 0 0 1 18 18.5Z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  )
}

function PlaceCard({
  place,
  interaction,
  likePending,
  onToggleLike,
  onOpenComments,
}: {
  place: PublicPlace
  interaction: PlaceInteractionState
  likePending: boolean
  onToggleLike: (place: PublicPlace) => void
  onOpenComments: (place: PublicPlace) => void
}) {
  const region =
    place.source_location?.trim() ||
    place.address?.trim() ||
    'Краснодарский край'
  const desc = place.description?.trim()

  return (
    <article
      data-place-card
      className="snap-center snap-always flex w-[min(85vw,300px)] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-xl sm:w-[min(72vw,320px)] lg:w-80"
    >
      <Link
        to={`/places/${place.id}`}
        className="flex flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
      >
        <PlaceCardImage urls={place.photo_urls} />
        <div className="flex min-h-[164px] flex-1 flex-col gap-2 p-4 text-left">
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

      <div className="flex min-h-[58px] items-center justify-between border-t border-slate-100 bg-slate-50/75 px-4 py-3">
        <button
          type="button"
          onClick={() => onToggleLike(place)}
          disabled={likePending}
          aria-pressed={interaction.likedByCurrentUser}
          aria-label={
            interaction.likedByCurrentUser
              ? `Убрать лайк у ${place.name}`
              : `Поставить лайк ${place.name}`
          }
          className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5] ${
            interaction.likedByCurrentUser
              ? 'bg-rose-50 text-[#d44356]'
              : 'bg-white text-neutral-600 hover:text-[#d44356]'
          } ${likePending ? 'cursor-wait opacity-70' : ''}`}
        >
          <HeartIcon active={interaction.likedByCurrentUser} />
          <span>{interaction.loaded ? interaction.likesCount : '…'}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenComments(place)}
          aria-label={`Открыть комментарии к ${place.name}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold text-neutral-600 transition hover:text-[#4385f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
        >
          <CommentIcon />
          <span>{interaction.loaded ? interaction.commentsCount : '…'}</span>
        </button>
      </div>
    </article>
  )
}

export function LandingPlacesCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pauseUntilRef = useRef(0)
  const hoveringRef = useRef(false)
  const autoScrollingRef = useRef(false)

  const reducedMotion = usePrefersReducedMotion()
  const token = useAuthStore((state) => state.token)
  const [phase, setPhase] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [items, setItems] = useState<PublicPlace[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [interactionNotice, setInteractionNotice] = useState<InteractionNotice | null>(null)
  const [interactionsByPlaceId, setInteractionsByPlaceId] = useState<Record<number, PlaceInteractionState>>({})
  const [pendingLikeByPlaceId, setPendingLikeByPlaceId] = useState<Record<number, boolean>>({})
  const [commentsPlace, setCommentsPlace] = useState<PublicPlace | null>(null)

  const bumpUserPause = useCallback(() => {
    pauseUntilRef.current = Date.now() + USER_PAUSE_MS
  }, [])

  const applyListResponse = useCallback((res: PlacesListResponse) => {
    setInteractionNotice(null)
    if (res.items.length === 0) {
      setItems([])
      setInteractionsByPlaceId({})
      setPhase('empty')
    } else {
      setItems(res.items)
      setPhase('ok')
    }
  }, [])

  const applyListError = useCallback((e: unknown) => {
    const msg =
      e instanceof PlacesApiError
        ? e.message
        : 'Не удалось загрузить места.'
    setInteractionNotice(null)
    setErrorMessage(msg)
    setItems([])
    setInteractionsByPlaceId({})
    setPhase('error')
  }, [])

  const retry = useCallback(() => {
    setPhase('loading')
    setErrorMessage(null)
    setInteractionNotice(null)
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

  useEffect(() => {
    if (phase !== 'ok' || items.length === 0) return

    let cancelled = false
    const placeIds = items.map((item) => item.id)

    void hydratePlaceInteractions(placeIds, token)
      .then((snapshots) => {
        if (cancelled) return

        setInteractionsByPlaceId((current) => {
          const next = { ...current }

          for (const place of items) {
            const snapshot = snapshots[place.id]

            next[place.id] = snapshot
              ? {
                  likesCount: snapshot.likesCount,
                  commentsCount: snapshot.commentsCount,
                  likedByCurrentUser: snapshot.likedByCurrentUser,
                  loaded: true,
                }
              : {
                  likesCount: 0,
                  commentsCount: 0,
                  likedByCurrentUser: false,
                  loaded: true,
                }
          }

          return next
        })
      })
      .catch(() => {
        if (cancelled) return

        setInteractionsByPlaceId((current) => {
          const next = { ...current }

          for (const place of items) {
            next[place.id] = {
              likesCount: current[place.id]?.likesCount ?? 0,
              commentsCount: current[place.id]?.commentsCount ?? 0,
              likedByCurrentUser: current[place.id]?.likedByCurrentUser ?? false,
              loaded: true,
            }
          }

          return next
        })
      })

    return () => {
      cancelled = true
    }
  }, [items, phase, token])

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

  const originalOrderById = new Map(items.map((item, index) => [item.id, index]))

  const orderedItems = [...items].sort((a, b) => {
    const aState = interactionsByPlaceId[a.id]
    const bState = interactionsByPlaceId[b.id]
    const likesDelta = (bState?.likesCount ?? 0) - (aState?.likesCount ?? 0)

    if (likesDelta !== 0) {
      return likesDelta
    }

    const photoDelta =
      Number(placeHasDisplayablePhoto(b)) - Number(placeHasDisplayablePhoto(a))

    if (photoDelta !== 0) {
      return photoDelta
    }

    return (originalOrderById.get(a.id) ?? 0) - (originalOrderById.get(b.id) ?? 0)
  })

  const handleToggleLike = (place: PublicPlace) => {
    const currentInteraction = interactionsByPlaceId[place.id] ?? {
      likesCount: 0,
      commentsCount: 0,
      likedByCurrentUser: false,
      loaded: false,
    }

    if (pendingLikeByPlaceId[place.id]) {
      return
    }

    if (!token) {
      requestAuthModalOpen()
      setInteractionNotice({
        kind: 'info',
        message: 'Войдите, чтобы добавлять места в рекомендации.',
      })
      return
    }

    const nextLiked = !currentInteraction.likedByCurrentUser
    const optimisticLikesCount = Math.max(
      0,
      currentInteraction.likesCount + (nextLiked ? 1 : -1),
    )

    setInteractionNotice(null)
    setPendingLikeByPlaceId((current) => ({ ...current, [place.id]: true }))
    setInteractionsByPlaceId((current) => ({
      ...current,
      [place.id]: {
        likesCount: optimisticLikesCount,
        commentsCount: currentInteraction.commentsCount,
        likedByCurrentUser: nextLiked,
        loaded: true,
      },
    }))

    const request = nextLiked ? likePlace(place.id, token) : unlikePlace(place.id, token)

    void request
      .then((result) => {
        setInteractionsByPlaceId((current) => ({
          ...current,
          [place.id]: {
            likesCount: result.likes_count,
            commentsCount: current[place.id]?.commentsCount ?? currentInteraction.commentsCount,
            likedByCurrentUser: result.liked,
            loaded: true,
          },
        }))
      })
      .catch((error: unknown) => {
        setInteractionsByPlaceId((current) => ({
          ...current,
          [place.id]: {
            likesCount: currentInteraction.likesCount,
            commentsCount: current[place.id]?.commentsCount ?? currentInteraction.commentsCount,
            likedByCurrentUser: currentInteraction.likedByCurrentUser,
            loaded: true,
          },
        }))

        const message =
          error instanceof PlaceInteractionsApiError
            ? error.message
            : 'Не удалось обновить лайк. Попробуйте ещё раз.'

        setInteractionNotice({
          kind: 'error',
          message,
        })

        if (error instanceof PlaceInteractionsApiError && error.status === 401) {
          requestAuthModalOpen()
        }
      })
      .finally(() => {
        setPendingLikeByPlaceId((current) => ({ ...current, [place.id]: false }))
      })
  }

  const handleOpenComments = useCallback(
    (place: PublicPlace) => {
      bumpUserPause()
      setCommentsPlace(place)
    },
    [bumpUserPause],
  )

  const handleCommentsCountChange = useCallback((placeId: number, nextCount: number) => {
    setInteractionsByPlaceId((current) => ({
      ...current,
      [placeId]: {
        likesCount: current[placeId]?.likesCount ?? 0,
        commentsCount: nextCount,
        likedByCurrentUser: current[placeId]?.likedByCurrentUser ?? false,
        loaded: true,
      },
    }))
  }, [])

  return (
    <>
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
                className="font-display text-left text-[20px] font-bold uppercase tracking-[0.1em] text-[#4385f5]"
              >
                Популярные маршруты
              </h2>
              {interactionNotice ? (
                <p
                  role={interactionNotice.kind === 'error' ? 'alert' : 'status'}
                  className={`mt-3 inline-flex rounded-full px-4 py-2 text-[13px] font-medium ${
                    interactionNotice.kind === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-[#4385f5]/10 text-[#275fcc]'
                  }`}
                >
                  {interactionNotice.message}
                </p>
              ) : null}
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

          <div className="relative mt-8 min-h-[388px] sm:min-h-[412px]">
            {phase === 'loading' ? (
              <div
                className="flex snap-x snap-mandatory gap-4 overflow-hidden pb-2 sm:gap-5"
                aria-busy
                aria-live="polite"
              >
                {[0, 1, 2].map((k) => (
                  <div
                    key={k}
                    className="h-[396px] w-[min(85vw,300px)] shrink-0 animate-pulse rounded-2xl bg-slate-200/90 sm:w-[min(72vw,320px)] lg:w-80"
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
                  {orderedItems.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      interaction={
                        interactionsByPlaceId[place.id] ?? {
                          likesCount: 0,
                          commentsCount: 0,
                          likedByCurrentUser: false,
                          loaded: false,
                        }
                      }
                      likePending={pendingLikeByPlaceId[place.id] === true}
                      onToggleLike={handleToggleLike}
                      onOpenComments={handleOpenComments}
                    />
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

      <PlaceCommentsModal
        open={commentsPlace !== null}
        place={commentsPlace}
        onClose={() => setCommentsPlace(null)}
        onCommentsCountChange={handleCommentsCountChange}
      />
    </>
  )
}
