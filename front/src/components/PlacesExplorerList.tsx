import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  placeHasDisplayablePhoto,
  placeHasValidCoordinates,
  type PublicPlace,
} from '../features/places/placesApi'

function RowThumb({ place }: { place: PublicPlace }) {
  const [broken, setBroken] = useState(false)
  const src = place.photo_urls[0]?.trim()
  if (!src || broken || !placeHasDisplayablePhoto(place)) {
    return (
      <div
        className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br from-[#4385f5]/20 to-slate-200"
        aria-hidden
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="h-16 w-16 shrink-0 rounded-xl object-cover"
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

function ExplorerRow({
  place,
  selected,
  onSelectOnMap,
}: {
  place: PublicPlace
  selected: boolean
  onSelectOnMap: (id: number) => void
}) {
  const region =
    place.source_location?.trim() ||
    place.address?.trim() ||
    'Краснодарский край'
  const hasCoords = placeHasValidCoordinates(place)

  return (
    <li className="content-visibility-auto">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectOnMap(place.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectOnMap(place.id)
          }
        }}
        aria-pressed={selected}
        aria-label={`${place.name}, показать на карте`}
        className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5] ${
          selected
            ? 'border-[#4385f5] bg-[#4385f5]/5 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <RowThumb place={place} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-bold uppercase leading-tight tracking-wide text-neutral-900">
            {place.name}
          </h3>
          <p className="mt-1 text-[13px] font-medium text-[#4385f5]">{region}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasCoords ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                На карте
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Без координат
              </span>
            )}
            <Link
              to={`/places/${place.id}`}
              className="text-[13px] font-semibold text-[#4385f5] underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              Подробнее
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

type Props = {
  /** Корень вертикального скролла списка (панель секции); IO догрузки привязан к этому viewport, не к окну. */
  scrollRoot: HTMLElement | null
  places: PublicPlace[]
  total: number
  loadingMore: boolean
  loadMoreError: string | null
  onLoadMore: () => void
  selectedPlaceId: number | null
  onSelectOnMap: (id: number) => void
}

export function PlacesExplorerList({
  scrollRoot,
  places,
  total,
  loadingMore,
  loadMoreError,
  onLoadMore,
  selectedPlaceId,
  onSelectOnMap,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  const hasMore = places.length < total

  const tryLoad = useCallback(() => {
    if (!hasMore || loadingMore) return
    onLoadMoreRef.current()
  }, [hasMore, loadingMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !scrollRoot) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) tryLoad()
      },
      { root: scrollRoot, rootMargin: '120px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [tryLoad, places.length, hasMore, scrollRoot])

  return (
    <div className="min-w-0">
      <ul className="flex flex-col gap-3" role="list">
        {places.map((place) => (
          <ExplorerRow
            key={place.id}
            place={place}
            selected={selectedPlaceId === place.id}
            onSelectOnMap={onSelectOnMap}
          />
        ))}
      </ul>

      {loadMoreError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          {loadMoreError}
          <button
            type="button"
            onClick={() => tryLoad()}
            className="ml-3 font-semibold text-[#4385f5] underline"
          >
            Повторить
          </button>
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />

      {loadingMore ? (
        <p className="mt-2 text-center text-[13px] text-neutral-500" aria-live="polite">
          Загружаем ещё…
        </p>
      ) : null}

      {!hasMore && places.length > 0 ? (
        <p className="mt-4 text-center text-[13px] text-neutral-400">Все места загружены</p>
      ) : null}
    </div>
  )
}
