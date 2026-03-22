import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { getPrimaryDisplayPhotoUrl, type PublicPlace } from '../features/places/placesApi'

const SWIPE_THRESHOLD_PX = 100
const ROTATE_PER_PX = 0.06

/** Высота колоды: запас под шапку, поиск, тост и нижнюю панель маршрута */
const DECK_HEIGHT_CLASS = 'h-[min(calc(100dvh-12.5rem),78dvh)] min-h-[280px]'

function SwipeCardBack({ place }: { place: PublicPlace }) {
  const src = getPrimaryDisplayPhotoUrl(place)

  return (
    <div
      className="pointer-events-none absolute inset-x-3 top-5 z-0 mx-auto h-[calc(100%-0.5rem)] max-h-[400px] w-[calc(100%-1.5rem)] max-w-md scale-[0.94] rounded-3xl bg-slate-200 shadow-md ring-1 ring-sky-100/80"
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="size-full rounded-3xl object-cover opacity-55" />
      ) : (
        <div className="flex size-full items-center justify-center rounded-3xl bg-gradient-to-br from-sky-200/80 to-slate-100 text-[12px] text-neutral-500">
          Фото скоро
        </div>
      )}
    </div>
  )
}

type SwipeCardProps = {
  place: PublicPlace
  onSkip: () => void
  onLike: () => void
  reducedMotion: boolean
}

function SwipeCard({ place, onSkip, onLike, reducedMotion }: SwipeCardProps) {
  const primaryUrl = useMemo(() => getPrimaryDisplayPhotoUrl(place), [place])
  const [dx, setDx] = useState(0)
  const draggingRef = useRef(false)
  const startClientXRef = useRef(0)
  const originDxRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const [imgBroken, setImgBroken] = useState(false)

  const [dragging, setDragging] = useState(false)

  const finishDrag = useCallback(
    (clientX: number) => {
      const delta = clientX - startClientXRef.current
      const total = originDxRef.current + delta
      if (total > SWIPE_THRESHOLD_PX) {
        onLike()
        setDx(0)
        return
      }
      if (total < -SWIPE_THRESHOLD_PX) {
        onSkip()
        setDx(0)
        return
      }
      setDx(0)
    },
    [onLike, onSkip],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('[data-swipe-no-drag]')) return
    draggingRef.current = true
    setDragging(true)
    startClientXRef.current = e.clientX
    originDxRef.current = dx
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    setDx(originDxRef.current + (e.clientX - startClientXRef.current))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    finishDrag(e.clientX)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    setDx(0)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const rotateDeg = reducedMotion ? 0 : dx * ROTATE_PER_PX
  const likeOpacity = Math.min(1, Math.max(0, (dx - 40) / 120))
  const skipOpacity = Math.min(1, Math.max(0, (-dx - 40) / 120))

  const region =
    place.source_location?.trim() || place.address?.trim() || 'Краснодарский край'
  const excerpt = place.description?.trim()
    ? place.description.trim().length > 120
      ? `${place.description.trim().slice(0, 117)}…`
      : place.description.trim()
    : null

  return (
    <div
      ref={cardRef}
      className="relative z-10 flex h-full min-h-0 w-full max-h-[400px] max-w-md touch-none select-none flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-sky-900/20 ring-1 ring-sky-100/90"
      style={{
        transform: `translateX(${dx}px) rotate(${rotateDeg}deg)`,
        transition: dragging ? 'none' : 'transform 0.22s ease-out',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="group"
      aria-label={`Карточка места ${place.name}`}
    >
      <div className="relative min-h-0 max-h-[350px] flex-1 overflow-hidden">
        {primaryUrl && !imgBroken ? (
          <img
            key={place.id}
            src={primaryUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            draggable={false}
            decoding="async"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-200/90 via-slate-100 to-sky-100 text-[14px] font-medium text-neutral-500"
            aria-hidden
          >
            Фото скоро
          </div>
        )}

        <div
          className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#7cb342] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md"
          aria-hidden
        >
          {region.length > 28 ? `${region.slice(0, 25)}…` : region}
        </div>

        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-black uppercase tracking-widest text-emerald-400 opacity-0 drop-shadow-lg"
          style={{ opacity: likeOpacity }}
          aria-hidden
        >
          В маршрут
        </div>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-black uppercase tracking-widest text-rose-400 opacity-0 drop-shadow-lg"
          style={{ opacity: skipOpacity }}
          aria-hidden
        >
          Пропуск
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/45 to-transparent px-4 pb-3 pt-16 text-left">
          <h2 className="font-display text-[clamp(1rem,4vw,1.25rem)] font-bold uppercase leading-tight tracking-wide text-white">
            {place.name}
          </h2>
          {excerpt ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/88">{excerpt}</p>
          ) : null}
        </div>
      </div>

      <div
        className="shrink-0 space-y-2 border-t border-sky-100/90 bg-white px-3 py-2"
        data-swipe-no-drag
      >
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="font-display min-h-11 min-w-[108px] rounded-full border-2 border-rose-300 bg-white text-[11px] font-bold uppercase tracking-wide text-rose-600 shadow-sm"
          >
            Пропуск
          </button>
          <button
            type="button"
            onClick={onLike}
            className="font-display min-h-11 min-w-[108px] rounded-full bg-kr-blue text-[11px] font-bold uppercase tracking-wide text-white shadow-md shadow-kr-blue/30"
          >
            В маршрут
          </button>
        </div>
        <Link
          to={`/places/${place.id}`}
          className="block pb-0.5 text-center text-[12px] font-semibold text-kr-blue underline-offset-2 hover:underline"
        >
          Подробнее о месте
        </Link>
      </div>
    </div>
  )
}

export type PlacesSwipeDeckProps = {
  deck: PublicPlace[]
  recommendationsLoading: boolean
  onSkip: (place: PublicPlace) => void
  onLike: (place: PublicPlace) => void
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function PlacesSwipeDeck({
  deck,
  recommendationsLoading,
  onSkip,
  onLike,
}: PlacesSwipeDeckProps) {
  const top = deck[0]
  const second = deck[1]
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  )

  const deckAreaClass = `relative mx-auto flex w-full max-w-md flex-col ${DECK_HEIGHT_CLASS}`

  if (!top && recommendationsLoading) {
    return (
      <section className="flex min-h-0 flex-1 flex-col justify-center" aria-label="Свайп-каталог мест">
        <div
          className={`mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white/80 px-6 py-8 shadow-inner ${DECK_HEIGHT_CLASS}`}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-10 animate-spin rounded-full border-2 border-kr-blue border-t-transparent" />
            <p className="text-[14px] text-neutral-600">Подбираем места рядом…</p>
          </div>
        </div>
      </section>
    )
  }

  if (!top) {
    return (
      <section className="flex min-h-0 flex-1 flex-col justify-center px-2" aria-label="Свайп-каталог мест">
        <div className="mx-auto max-w-md rounded-2xl border border-sky-200 bg-white/95 px-5 py-8 text-center shadow-sm">
          <p className="font-display text-[15px] font-bold text-kr-blue">Пока всё просмотрено</p>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
            Измените поиск, сбросьте конструктор или зайдите позже — новые карточки появятся после обновления
            подборки.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Свайп-каталог мест">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-1 pt-0">
        <div className={deckAreaClass}>
          {second ? <SwipeCardBack place={second} /> : null}
          <SwipeCard
            key={top.id}
            place={top}
            reducedMotion={reducedMotion}
            onSkip={() => onSkip(top)}
            onLike={() => onLike(top)}
          />
        </div>
      </div>
    </section>
  )
}
