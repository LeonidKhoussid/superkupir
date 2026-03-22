import { useCallback, useDeferredValue, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  appendUniquePlaces,
  fetchPlacesList,
  getPrimaryDisplayPhotoUrl,
  orderPlacesByCatalogImagePriority,
  PLACES_BACKGROUND_FETCH_LIMIT,
  PLACES_CATALOG_FETCH_LIMIT,
  type PublicPlace,
} from '../features/places/placesApi'

type Props = {
  open: boolean
  onClose: () => void
  existingPlaceIds: ReadonlySet<number>
  onPick: (place: PublicPlace) => void
}

function filterPlaces(list: PublicPlace[], query: string): PublicPlace[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter((p) => {
    const hay = [
      p.name,
      p.description ?? '',
      p.short_description ?? '',
      p.source_location ?? '',
      p.address ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function RouteAddStopModal({ open, onClose, existingPlaceIds, onPick }: Props) {
  const titleId = useId()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const fetchSeqRef = useRef(0)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<PublicPlace[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogHydrating, setCatalogHydrating] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const fetchAttemptedForOpenRef = useRef(false)
  const deferredSearch = useDeferredValue(search)

  const fetchCatalog = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    let hasVisibleCatalog = false

    setPhase('loading')
    setLoadError(null)
    setCatalogHydrating(false)

    try {
      const firstPage = await fetchPlacesList({
        limit: PLACES_CATALOG_FETCH_LIMIT,
        offset: 0,
      })

      if (seq !== fetchSeqRef.current) return

      const firstCatalog = orderPlacesByCatalogImagePriority(firstPage.items)
      setCatalog(firstCatalog)
      setCatalogTotal(firstPage.total)
      setPhase('ok')

      if (firstPage.items.length === 0) {
        return
      }

      hasVisibleCatalog = true

      if (firstPage.total <= firstPage.items.length) {
        return
      }

      setCatalogHydrating(true)
      let offset = firstPage.items.length

      while (offset < firstPage.total) {
        const nextPage = await fetchPlacesList({
          limit: PLACES_BACKGROUND_FETCH_LIMIT,
          offset,
        })

        if (seq !== fetchSeqRef.current) return
        if (nextPage.items.length === 0) break

        setCatalog((current) =>
          orderPlacesByCatalogImagePriority(appendUniquePlaces(current, nextPage.items)),
        )
        setCatalogTotal(nextPage.total)
        offset += nextPage.items.length
      }

      if (seq !== fetchSeqRef.current) return
      setCatalogHydrating(false)
    } catch {
      if (seq !== fetchSeqRef.current) return
      if (hasVisibleCatalog || catalog.length > 0) {
        setLoadError('Часть каталога не догрузилась. Уже загруженные места доступны.')
        setCatalogHydrating(false)
        return
      }
      setLoadError('Не удалось загрузить каталог мест.')
      setPhase('error')
      setCatalogHydrating(false)
    }
  }, [catalog.length])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setSearch(''))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      fetchAttemptedForOpenRef.current = false
      fetchSeqRef.current += 1
      return
    }
    if (catalogTotal > 0 && catalog.length >= catalogTotal) return
    if (fetchAttemptedForOpenRef.current) return
    fetchAttemptedForOpenRef.current = true
    queueMicrotask(() => {
      void fetchCatalog()
    })
  }, [open, catalog.length, catalogTotal, fetchCatalog])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => closeBtnRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const available = catalog.filter((p) => !existingPlaceIds.has(p.id))
  const visible = filterPlaces(available, deferredSearch)

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="font-display text-[16px] font-bold uppercase tracking-wide text-neutral-900">
              Добавить остановку
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500">Места уже в маршруте скрыты.</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-[22px] leading-none text-neutral-500 hover:bg-neutral-100"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
          <label htmlFor="route-add-stop-search" className="sr-only">
            Поиск места
          </label>
          <input
            id="route-add-stop-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию и описанию…"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[15px] text-neutral-900 outline-none focus:border-kr-blue focus:ring-2 focus:ring-kr-blue/25"
            autoComplete="off"
          />
          {phase === 'ok' ? (
            <p className="mt-2 text-[12px] text-neutral-500">
              {catalogHydrating
                ? `Подгружаем весь каталог: ${catalog.length} из ${catalogTotal || catalog.length}.`
                : `В каталоге доступно ${catalog.length} мест.`}
            </p>
          ) : null}
          {phase === 'ok' && loadError ? (
            <p className="mt-2 text-[12px] text-amber-700">{loadError}</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
          {phase === 'loading' ? (
            <p className="px-2 py-8 text-center text-[14px] text-neutral-500">Загрузка каталога…</p>
          ) : null}
          {phase === 'error' ? (
            <div className="px-2 py-6 text-center">
              <p className="text-[14px] text-red-700">{loadError}</p>
              <button
                type="button"
                className="mt-4 rounded-full bg-kr-blue px-6 py-2 text-[13px] font-bold text-white"
                onClick={() => void fetchCatalog()}
              >
                Повторить
              </button>
            </div>
          ) : null}
          {phase === 'ok' && visible.length === 0 ? (
            <p className="px-2 py-8 text-center text-[14px] text-neutral-500">
              {available.length === 0
                ? 'Все доступные места уже в маршруте.'
                : 'Ничего не найдено — измените запрос.'}
            </p>
          ) : null}
          {phase === 'ok' && visible.length > 0 ? (
            <ul className="space-y-1 pb-2">
              {visible.map((p) => {
                const photo = getPrimaryDisplayPhotoUrl(p)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full min-h-[52px] items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-sky-50"
                      onClick={() => {
                        onPick(p)
                        onClose()
                      }}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="size-12 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[11px] text-sky-700">
                          нет фото
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[14px] font-bold uppercase leading-tight text-neutral-900">
                          {p.name}
                        </span>
                        {p.source_location ? (
                          <span className="mt-0.5 block line-clamp-1 text-[12px] text-neutral-500">
                            {p.source_location}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-kr-blue">Добавить</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
