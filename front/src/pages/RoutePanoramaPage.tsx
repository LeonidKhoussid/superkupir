import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import brandLogo from '../assets/brand-logo.svg'
import { LoginButton } from '../components/LoginButton'
import { useAuthStore } from '../features/auth/authStore'
import { getPrimaryDisplayPhotoUrl, type PublicPlace } from '../features/places/placesApi'
import { stopsFromUserRoute } from '../features/routes/editableRouteStops'
import { RouteYandexPanoramaView } from '../components/RouteYandexPanoramaView'
import {
  getDefaultPanoramaStopIndex,
  orderedRoutePlaceRows,
  placeHasPanoramaCoordinates,
} from '../features/routes/routePanoramaHelpers'
import { isHospitalityTypeSlug } from '../features/routes/routeReviewHelpers'
import { syncRouteStopsToServer } from '../features/routes/syncRouteStopsToServer'
import {
  fetchUserRouteById,
  RoutesApiError,
  type RoutePlaceRow,
  type UserRouteDetail,
} from '../features/routes/routesApi'

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
  }
  return map[slug] ?? slug.replace(/_/g, ' ')
}

function placeSnippet(place: PublicPlace): string {
  const raw =
    place.short_description?.trim() ||
    place.description?.trim() ||
    place.source_location?.trim() ||
    place.address?.trim() ||
    ''
  if (!raw) return 'Нет описания'
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw
}

function BadIdView() {
  return (
    <div className="min-h-dvh bg-[#0a1628] px-5 py-16 text-center text-white">
      <p className="font-display text-lg font-bold">Некорректная ссылка</p>
      <Link to="/places" className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white">
        К каталогу мест
      </Link>
    </div>
  )
}

function AuthWall() {
  return (
    <div className="min-h-dvh bg-[#0a1628] px-5 py-16 text-center text-white">
      <p className="font-display text-lg font-bold">Войдите, чтобы открыть панораму маршрута.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <LoginButton variant="on-catalog" />
        <Link to="/myroutes" className="rounded-full border border-white/40 px-6 py-3 text-[14px] font-semibold text-white">
          Мои туры
        </Link>
      </div>
    </div>
  )
}

function RoutePanoramaLoaded({ routeId }: { routeId: number }) {
  const token = useAuthStore((s) => s.token)
  const [searchParams] = useSearchParams()

  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [route, setRoute] = useState<UserRouteDetail | null>(null)
  const [manualPlaceId, setManualPlaceId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'streetview' | 'map'>('streetview')
  const [savePhase, setSavePhase] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  >('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void fetchUserRouteById(token, routeId)
      .then((r) => {
        if (cancelled) return
        setRoute(r)
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
  }, [routeId, token])

  const ordered = useMemo(() => (route ? orderedRoutePlaceRows(route) : []), [route])

  const autoSelectedPlaceId = useMemo(() => {
    if (ordered.length === 0) return null
    const q = searchParams.get('place')
    const fromQuery = q != null ? Number(q) : NaN
    if (
      Number.isInteger(fromQuery) &&
      fromQuery >= 1 &&
      ordered.some((row) => row.place_id === fromQuery)
    ) {
      return fromQuery
    }
    const idx = getDefaultPanoramaStopIndex(ordered)
    return idx >= 0 ? ordered[idx]!.place_id : null
  }, [ordered, searchParams])

  const selectedPlaceId = manualPlaceId ?? autoSelectedPlaceId

  const selectedRow = useMemo(
    () => ordered.find((r) => r.place_id === selectedPlaceId) ?? null,
    [ordered, selectedPlaceId],
  )

  const yandexKey = (import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? '').trim()

  const selectedCoords = useMemo(() => {
    if (!selectedRow || !placeHasPanoramaCoordinates(selectedRow.place)) return null
    const lat = Number(selectedRow.place.lat)
    const lon = Number(selectedRow.place.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  }, [selectedRow])

  const canEditRoute = route != null && route.access_type !== 'viewer'

  const handleSave = useCallback(async () => {
    if (!token || !route) return
    if (!canEditRoute) {
      setSavePhase('error')
      setSaveMessage('Текущий доступ не позволяет сохранять маршрут.')
      return
    }
    setSavePhase('saving')
    setSaveMessage(null)
    try {
      const fresh = await fetchUserRouteById(token, route.id)
      const stops = stopsFromUserRoute(fresh)
      const next = await syncRouteStopsToServer(token, fresh, stops)
      setRoute(next)
      setSavePhase('saved')
      setSaveMessage('Состав маршрута совпадает с сервером.')
    } catch (e) {
      if (e instanceof RoutesApiError && e.status === 409) {
        setSavePhase('conflict')
        setSaveMessage(
          'Версия маршрута на сервере новее (кто-то уже сохранил). Загрузите актуальные данные.',
        )
        return
      }
      setSavePhase('error')
      setSaveMessage(
        e instanceof RoutesApiError ? e.message : 'Не удалось синхронизировать маршрут.',
      )
    }
  }, [canEditRoute, route, token])

  const handleReloadAfterConflict = useCallback(async () => {
    if (!token || !route) return
    setSavePhase('saving')
    setSaveMessage(null)
    try {
      const fresh = await fetchUserRouteById(token, route.id)
      setRoute(fresh)
      setSavePhase('idle')
      setSaveMessage('Загружен актуальный маршрут. Правки порядка — на странице маршрута.')
    } catch (e) {
      setSavePhase('error')
      setSaveMessage(
        e instanceof RoutesApiError ? e.message : 'Не удалось загрузить маршрут.',
      )
    }
  }, [route, token])

  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a1628] text-white">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="mt-4 text-[14px] text-sky-200">Загружаем маршрут…</p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-[#0a1628] px-6 py-16 text-center text-white">
        <p className="font-display text-lg font-bold text-red-200">Ошибка</p>
        <p className="mt-2 text-sky-200">{message}</p>
        <Link
          to={`/routes/${routeId}`}
          className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white">
          К маршруту
        </Link>
      </div>
    )
  }

  if (!route) return null

  const coordsCount = ordered.filter((r) => placeHasPanoramaCoordinates(r.place)).length

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a1628] text-white lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#4385F5] lg:h-dvh lg:max-w-[380px] lg:border-b-0 lg:border-r lg:border-white/15">
        <div className="shrink-0 border-b border-white/15 px-4 py-4 sm:px-5">
          <Link to="/" className="inline-flex items-center gap-2" aria-label="Край Тур — на главную">
            <img src={brandLogo} alt="" className="h-8 w-auto brightness-0 invert" />
            <span className="font-display text-[13px] font-bold uppercase tracking-wide text-white">Край Тур</span>
          </Link>
          <Link
            to={`/routes/${routeId}`}
            className="mt-4 flex w-full min-h-11 items-center justify-center rounded-full border border-white/40 bg-white/10 px-4 text-[12px] font-bold uppercase tracking-wide text-white backdrop-blur-sm hover:bg-white/20">
            ← К маршруту
          </Link>
        </div>

        <div className="shrink-0 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Локации</p>
          <h1 className="font-display mt-1 text-[18px] font-bold uppercase leading-tight text-white">
            Все локации ({ordered.length})
          </h1>
          {coordsCount === 0 ? (
            <p className="mt-2 text-[12px] leading-snug text-white/85">
              Ни у одной точки нет координат — панораму открыть нельзя. Вернитесь к маршруту или отредактируйте места в
              каталоге.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-white/85">
              Точек с координатами: {coordsCount}. Просмотр — Яндекс Панорамы и карта (API 2.1); нужен ключ{' '}
              <span className="font-mono text-[11px]">VITE_YANDEX_MAPS_API_KEY</span>. Если панорамы рядом нет — откройте
              режим «Карта».
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
          <ul className="space-y-2">
            {ordered.map((row, index) => (
              <PanoramaSidebarCard
                key={row.route_place_id}
                row={row}
                index={index}
                selected={row.place_id === selectedPlaceId}
                disabled={!placeHasPanoramaCoordinates(row.place)}
                onSelect={() => setManualPlaceId(row.place_id)}
              />
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-white/15 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canEditRoute || savePhase === 'saving'}
            className="flex w-full min-h-12 items-center justify-center rounded-full bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#4385F5] shadow-lg shadow-black/20 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
            {savePhase === 'saving' ? 'Сохраняем…' : 'Сохранить маршрут'}
          </button>
          {savePhase === 'conflict' ? (
            <div className="mt-3 rounded-xl border border-amber-300/80 bg-amber-950/40 px-3 py-3">
              <p className="text-center text-[11px] leading-snug text-amber-100">{saveMessage}</p>
              <button
                type="button"
                onClick={() => void handleReloadAfterConflict()}
                className="mt-3 flex w-full min-h-10 items-center justify-center rounded-full bg-amber-200 px-3 text-[11px] font-bold uppercase tracking-wide text-amber-950 hover:brightness-105">
                Загрузить с сервера
              </button>
            </div>
          ) : saveMessage ? (
            <p
              className={
                savePhase === 'error' ? 'mt-2 text-center text-[11px] text-amber-100' : 'mt-2 text-center text-[11px] text-white/90'
              }>
              {saveMessage}
            </p>
          ) : (
            <p className="mt-2 text-center text-[10px] leading-snug text-white/70">
              Сохраняет текущий состав на сервере (как на странице маршрута). Правки порядка — там же.
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col bg-neutral-950 lg:h-dvh">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Просмотр</p>
            <h2 className="font-display mt-1 truncate text-[clamp(1rem,2.5vw,1.35rem)] font-bold uppercase text-white">
              {selectedRow?.place.name ?? 'Точка маршрута'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode('streetview')}
              className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wide ${
                viewMode === 'streetview' ? 'bg-kr-blue text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
              }`}>
              Улица
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wide ${
                viewMode === 'map' ? 'bg-kr-blue text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
              }`}>
              Карта
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-black p-2 sm:p-4">
          {selectedCoords && selectedRow ? (
            yandexKey ? (
              <RouteYandexPanoramaView
                apiKey={yandexKey}
                lat={selectedCoords.lat}
                lon={selectedCoords.lon}
                viewMode={viewMode}
                placeName={selectedRow.place.name}
                pointKey={`${selectedRow.place_id}`}
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300/40 bg-black/60 p-6 text-center text-[14px] text-amber-100">
                <p>Задайте ключ Яндекс.Карт в окружении Vite:</p>
                <code className="rounded-lg bg-black/40 px-3 py-2 font-mono text-[12px] text-white">
                  VITE_YANDEX_MAPS_API_KEY
                </code>
                <p className="max-w-md text-[12px] text-white/70">
                  Тот же ключ, что для карт в каталоге. Без него панорама и карта API не загрузятся.
                </p>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/20 p-6 text-center text-[14px] text-white/75">
              Выберите точку с координатами в списке слева.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PanoramaSidebarCard({
  row,
  index,
  selected,
  disabled,
  onSelect,
}: {
  row: RoutePlaceRow
  index: number
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const p = row.place
  const thumb = getPrimaryDisplayPhotoUrl(p)
  const hospitality = isHospitalityTypeSlug(p.type_slug)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition ${
          disabled
            ? 'cursor-not-allowed border-white/15 bg-white/5 opacity-60'
            : selected
              ? 'border-white bg-white text-[#4385F5] shadow-md shadow-black/15'
              : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
        }`}>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
            selected ? 'bg-kr-blue text-white' : 'bg-white/20 text-white'
          }`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display truncate text-[14px] font-bold uppercase leading-tight">{p.name}</span>
            {hospitality ? (
              <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-current">
                Отдых / еда
              </span>
            ) : null}
          </div>
          {typeSlugLabel(p.type_slug) ? (
            <p className={`mt-0.5 text-[11px] ${selected ? 'text-[#4385F5]/80' : 'text-white/75'}`}>
              {typeSlugLabel(p.type_slug)}
            </p>
          ) : null}
          <p className={`mt-1 line-clamp-2 text-[12px] leading-snug ${selected ? 'text-neutral-700' : 'text-white/85'}`}>
            {placeSnippet(p)}
          </p>
          {disabled ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-200">Нет координат</p>
          ) : null}
        </div>
        {thumb && !disabled ? (
          <div className="relative hidden size-16 shrink-0 overflow-hidden rounded-xl bg-black/20 sm:block">
            <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
          </div>
        ) : null}
      </button>
    </li>
  )
}

export function RoutePanoramaPage() {
  const { id: raw } = useParams()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((s) => s.token)
  const id = Number(raw)

  if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
    return <BadIdView />
  }

  if (!token) {
    return <AuthWall />
  }

  return <RoutePanoramaLoaded key={`${id}-${searchParams.toString()}`} routeId={id} />
}
