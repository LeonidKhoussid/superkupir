import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'
import { RouteAddStopModal } from '../components/RouteAddStopModal'
import brandLogo from '../assets/brand-logo.svg'
import { RouteYandexMap } from '../components/RouteYandexMap'
import { useAuthStore } from '../features/auth/authStore'
import { formatSeasonLabel, useQuizStore } from '../features/quiz/quizStore'
import { getPrimaryDisplayPhotoUrl, type PublicPlace } from '../features/places/placesApi'
import {
  editableStopsToRouteRows,
  newClientRouteStop,
  stopsFromUserRoute,
  type EditableRouteStop,
} from '../features/routes/editableRouteStops'
import { partitionRoutePlacesByHospitality } from '../features/routes/routePlaceGroups'
import {
  fetchUserRouteById,
  RoutesApiError,
  type RoutePlaceRow,
  type UserRouteDetail,
} from '../features/routes/routesApi'

const yandexKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined

function typeSlugLabel(slug: string | null): string {
  if (!slug) return ''
  const map: Record<string, string> = {
    hotel: 'Гостиница',
    guest_house: 'Гостевой дом',
    recreation_base: 'База отдыха',
    restaurant: 'Ресторан',
    gastro: 'Гастрономия',
    winery: 'Винодельня',
    park: 'Парк',
    museum: 'Музей',
    farm: 'Ферма',
    mountain: 'Горы',
    event: 'Событие',
  }
  return map[slug] ?? slug.replace(/_/g, ' ')
}

function placeIdsSignature(stops: EditableRouteStop[]): string {
  return JSON.stringify(stops.map((s) => s.place.id))
}

function BadIdView() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">Некорректная ссылка</p>
      <Link
        to="/places"
        className="mt-6 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white"
      >
        К каталогу мест
      </Link>
    </div>
  )
}

function AuthWall() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">
        Войдите, чтобы просмотреть маршрут.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <LoginButton variant="on-catalog" />
        <Link
          to="/places"
          className="inline-flex min-h-11 items-center rounded-full border border-kr-blue bg-white px-8 font-bold text-kr-blue"
        >
          К каталогу
        </Link>
      </div>
    </div>
  )
}

/** Строка только для просмотра (отели / рестораны). */
function StopRowReadonly({
  row,
  index,
}: {
  row: RoutePlaceRow
  index: number
}) {
  const photo = getPrimaryDisplayPhotoUrl(row.place)
  return (
    <li>
      <Link
        to={`/places/${row.place_id}`}
        className="flex gap-3 rounded-xl border border-sky-200/90 bg-white p-3 shadow-sm shadow-sky-900/5 transition hover:border-kr-blue/50"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kr-blue text-[14px] font-bold text-white"
          aria-hidden
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14px] font-bold uppercase leading-snug tracking-wide text-neutral-900">
            {row.place.name}
          </p>
          {row.place.source_location ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-500">{row.place.source_location}</p>
          ) : null}
          {row.place.type_slug ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-kr-blue/90">
              {typeSlugLabel(row.place.type_slug)}
            </p>
          ) : null}
        </div>
        {photo ? (
          <img
            src={photo}
            alt=""
            className="size-14 shrink-0 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </Link>
    </li>
  )
}

function EditableStopCard({
  stop,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  stop: EditableRouteStop
  index: number
  total: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const photo = getPrimaryDisplayPhotoUrl(stop.place)
  const n = index + 1
  return (
    <li className="rounded-xl border border-sky-200/90 bg-white p-3 shadow-sm shadow-sky-900/5">
      <div className="flex gap-2 sm:gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kr-blue text-[14px] font-bold text-white"
          aria-hidden
        >
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/places/${stop.place.id}`}
            className="font-display text-[14px] font-bold uppercase leading-snug tracking-wide text-neutral-900 underline-offset-2 hover:text-kr-blue hover:underline"
          >
            {stop.place.name}
          </Link>
          {stop.place.source_location ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-500">{stop.place.source_location}</p>
          ) : null}
          {stop.place.type_slug ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-kr-blue/90">
              {typeSlugLabel(stop.place.type_slug)}
            </p>
          ) : null}
          {stop.serverRoutePlaceId == null ? (
            <p className="mt-1 text-[11px] text-amber-800/90">Добавлено в этой сессии (ещё не на сервере)</p>
          ) : null}
        </div>
        {photo ? (
          <img
            src={photo}
            alt=""
            className="size-14 shrink-0 rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-sky-100 pt-3">
        <button
          type="button"
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Переместить выше"
        >
          ↑
        </button>
        <button
          type="button"
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35"
          onClick={onMoveDown}
          disabled={index >= total - 1}
          aria-label="Переместить ниже"
        >
          ↓
        </button>
        <button
          type="button"
          className="ml-auto inline-flex min-h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-[12px] font-bold uppercase tracking-wide text-red-800 hover:bg-red-100"
          onClick={onRemove}
        >
          Убрать
        </button>
      </div>
    </li>
  )
}

function HospitalityBlock({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: RoutePlaceRow[]
  emptyText: string
}) {
  return (
    <section className="rounded-2xl border border-sky-200/80 bg-white/95 p-4 shadow-sm shadow-sky-900/5 sm:p-5">
      <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-kr-blue">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((rp) => (
            <StopRowReadonly key={rp.route_place_id} row={rp} index={rp.sort_order} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RouteReviewLoaded({ id }: { id: number }) {
  const token = useAuthStore((s) => s.token)

  const peopleCount = useQuizStore((s) => s.peopleCount)
  const seasons = useQuizStore((s) => s.seasons)
  const budget = useQuizStore((s) => s.budget)
  const restType = useQuizStore((s) => s.restType)
  const daysCount = useQuizStore((s) => s.daysCount)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [route, setRoute] = useState<UserRouteDetail | null>(null)
  const [message, setMessage] = useState('')
  const [editorStops, setEditorStops] = useState<EditableRouteStop[]>([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [baselineSig, setBaselineSig] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    void fetchUserRouteById(token, id)
      .then((r) => {
        if (cancelled) return
        setRoute(r)
        const initial = stopsFromUserRoute(r)
        const sig = placeIdsSignature(initial)
        setEditorStops(initial)
        setBaselineSig(sig)
        setPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMessage(e instanceof RoutesApiError ? e.message : 'Не удалось загрузить маршрут.')
        setPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, token])

  const orderedPlaces = useMemo(() => editorStops.map((s) => s.place), [editorStops])

  const routeRowsForSideBlocks = useMemo(() => editableStopsToRouteRows(editorStops), [editorStops])

  const { hotels, restaurants } = useMemo(
    () => partitionRoutePlacesByHospitality(routeRowsForSideBlocks),
    [routeRowsForSideBlocks],
  )

  const existingPlaceIds = useMemo(
    () => new Set(editorStops.map((s) => s.place.id)),
    [editorStops],
  )

  const isDirty = useMemo(() => {
    if (baselineSig === null) return false
    return placeIdsSignature(editorStops) !== baselineSig
  }, [editorStops, baselineSig])

  const resetToLoaded = useCallback(() => {
    if (!route) return
    const initial = stopsFromUserRoute(route)
    const sig = placeIdsSignature(initial)
    setEditorStops(initial)
    setBaselineSig(sig)
  }, [route])

  const removeAt = useCallback((index: number) => {
    setEditorStops((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const moveStop = useCallback((from: number, to: number) => {
    setEditorStops((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const addStop = useCallback((place: PublicPlace) => {
    setEditorStops((prev) => {
      if (prev.some((s) => s.place.id === place.id)) return prev
      return [...prev, newClientRouteStop(place)]
    })
  }, [])

  const showQuizSummary =
    route?.creation_mode === 'quiz' &&
    peopleCount != null &&
    daysCount != null &&
    seasons.length >= 1 &&
    restType != null

  const seasonText =
    seasons.length > 0 ? seasons.map(formatSeasonLabel).join(', ') : '—'

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-72 rounded-2xl bg-slate-200 lg:h-[min(70vh,560px)]" />
            <div className="h-48 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-red-800">Ошибка</p>
        <p className="mt-2 text-neutral-600">{message}</p>
        <Link
          to="/places"
          className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white"
        >
          К каталогу мест
        </Link>
      </div>
    )
  }

  if (!route) return null

  return (
    <div className="min-h-dvh bg-[#e8f4fc] text-neutral-900">
      <RouteAddStopModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        existingPlaceIds={existingPlaceIds}
        onPick={addStop}
      />

      <a
        href="#route-review-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-kr-blue"
      >
        К обзору маршрута
      </a>

      <header className="sticky top-0 z-30 border-b border-sky-200/70 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
            <Link to="/places" className="shrink-0 text-[13px] font-semibold text-kr-blue underline-offset-2 hover:underline">
              ← Каталог
            </Link>
            <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Край Тур — на главную">
              <img src={brandLogo} alt="" className="h-8 w-auto object-contain sm:h-9" />
              <span className="font-display hidden text-[14px] font-bold uppercase tracking-wide text-kr-blue sm:inline">
                Край Тур
              </span>
            </Link>
          </div>
          <LoginButton variant="on-catalog" />
        </div>
      </header>

      <main
        id="route-review-main"
        className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:gap-8 lg:px-10 lg:py-8 xl:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div className="order-2 min-h-0 lg:order-1 lg:sticky lg:top-[4.25rem] lg:self-start lg:h-[min(calc(100dvh-5rem),640px)]">
          <RouteYandexMap orderedPlaces={orderedPlaces} apiKey={yandexKey} />
          <p className="mt-3 text-center text-[12px] text-neutral-500 lg:text-left">
            Карта и линия маршрута обновляются при каждом изменении списка остановок. Линия строится по дорогам
            Яндекса; при ошибке маршрутизации — прямая между точками.
          </p>
          <p className="mt-1 text-center text-[11px] text-neutral-400 lg:text-left">
            Редактирование только в этой вкладке: на сервер маршрут не отправляется (нет синхронизации с
            сохранённой копией).
          </p>
        </div>

        <aside className="order-1 mb-6 flex min-w-0 flex-col gap-5 lg:order-2 lg:mb-0 lg:max-h-[min(calc(100dvh-5rem),720px)] lg:overflow-y-auto lg:pr-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kr-blue">Маршрут</p>
            <h1 className="font-display mt-1 text-[clamp(1.2rem,3.2vw,1.65rem)] font-bold uppercase leading-tight tracking-wide text-neutral-900">
              {route.title}
            </h1>
            {route.description ? (
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{route.description}</p>
            ) : null}
            <p className="mt-2 text-[13px] text-neutral-500">
              Остановок: <span className="font-semibold text-neutral-800">{editorStops.length}</span>
              {route.creation_mode ? (
                <>
                  {' '}
                  · способ:{' '}
                  <span className="font-medium text-neutral-700">
                    {route.creation_mode === 'quiz'
                      ? 'квиз'
                      : route.creation_mode === 'selection_builder'
                        ? 'подбор в каталоге'
                        : route.creation_mode}
                  </span>
                </>
              ) : null}
              {isDirty ? (
                <span className="ml-1 font-medium text-amber-800"> · есть несохранённые правки</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-sky-200/80 bg-white/90 p-4 shadow-sm">
            <p className="text-[13px] leading-relaxed text-neutral-600">
              Добавляйте, убирайте и меняйте порядок остановок — список и карта обновляются сразу. Для массового
              подбора по-прежнему удобен{' '}
              <Link to="/places" className="font-semibold text-kr-blue underline-offset-2 hover:underline">
                каталог с конструктором
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-kr-blue px-5 text-[13px] font-bold uppercase tracking-wide text-white transition hover:brightness-105"
                onClick={() => setAddModalOpen(true)}
              >
                Добавить остановку
              </button>
              {isDirty ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-5 text-[13px] font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50"
                  onClick={resetToLoaded}
                >
                  Сбросить к загруженному
                </button>
              ) : null}
            </div>
          </div>

          {showQuizSummary ? (
            <section className="rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm sm:p-5">
              <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-violet-800">
                Параметры из квиза
              </h2>
              <p className="mt-1 text-[12px] text-violet-900/70">
                Локально в этом браузере (как на экране «Готово»). Редактирование остановок на это не влияет.
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px] text-neutral-800">
                <li>
                  <span className="font-semibold text-violet-900">Людей:</span> {peopleCount}
                </li>
                <li>
                  <span className="font-semibold text-violet-900">Сезон:</span> {seasonText}
                </li>
                <li>
                  <span className="font-semibold text-violet-900">Бюджет:</span>{' '}
                  {budget.from.toLocaleString('ru-RU')} – {budget.to.toLocaleString('ru-RU')} ₽
                </li>
                <li>
                  <span className="font-semibold text-violet-900">Вид отдыха:</span> {restType}
                </li>
                <li>
                  <span className="font-semibold text-violet-900">Дней:</span> {daysCount}
                </li>
              </ul>
            </section>
          ) : null}

          {route.creation_mode === 'quiz' && !showQuizSummary ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-[13px] text-amber-950">
              Маршрут создан из квиза. Чтобы снова увидеть сводку ответов, пройдите квиз до конца — данные
              хранятся только в этом браузере.{' '}
              <Link to="/quiz/1" className="font-semibold text-kr-blue underline-offset-2 hover:underline">
                К квизу
              </Link>
            </section>
          ) : null}

          <section className="rounded-2xl border border-sky-200/80 bg-white/95 p-4 shadow-sm shadow-sky-900/5 sm:p-5">
            <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-kr-blue">
              Ключевые точки маршрута
            </h2>
            {editorStops.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 px-4 py-8 text-center">
                <p className="text-[14px] font-medium text-neutral-700">Пока нет остановок</p>
                <p className="mt-2 text-[13px] text-neutral-500">
                  Добавьте места кнопкой выше или сбросьте к загруженному маршруту.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-kr-blue px-6 text-[13px] font-bold text-white"
                  onClick={() => setAddModalOpen(true)}
                >
                  Добавить остановку
                </button>
              </div>
            ) : (
              <ul className="mt-4 list-none space-y-3 p-0">
                {editorStops.map((stop, idx) => (
                  <EditableStopCard
                    key={stop.key}
                    stop={stop}
                    index={idx}
                    total={editorStops.length}
                    onRemove={() => removeAt(idx)}
                    onMoveUp={() => moveStop(idx, idx - 1)}
                    onMoveDown={() => moveStop(idx, idx + 1)}
                  />
                ))}
              </ul>
            )}
          </section>

          <HospitalityBlock
            title="Где остановиться"
            rows={hotels}
            emptyText="Среди текущих точек маршрута нет гостиниц и баз (типы «гостиница» / «гостевой дом» / «база отдыха»). Добавьте такие места через «Добавить остановку»."
          />

          <HospitalityBlock
            title="Поесть на маршруте"
            rows={restaurants}
            emptyText="Среди текущих точек нет ресторанов или гастро-объектов. Добавьте их через «Добавить остановку»."
          />
        </aside>
      </main>
    </div>
  )
}

export function RouteDetailPage() {
  const { id: idParam } = useParams()
  const token = useAuthStore((s) => s.token)
  const id = Number(idParam)

  if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
    return <BadIdView />
  }

  if (!token) {
    return <AuthWall />
  }

  return <RouteReviewLoaded key={id} id={id} />
}
