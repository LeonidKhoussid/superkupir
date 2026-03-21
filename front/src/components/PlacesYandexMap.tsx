import { type RefObject, useEffect, useRef, useState } from 'react'
import { getPlaceLatLon, type PublicPlace } from '../features/places/placesApi'

/** Центр Краснодара по умолчанию [широта, долгота] для Yandex Maps 2.1 */
const DEFAULT_CENTER: [number, number] = [45.0355, 38.9753]
const DEFAULT_ZOOM = 8

/** Runtime Yandex Maps 2.1 (подключается скриптом с CDN, типов в проекте нет). */
type YMapsRuntime = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => YMapInstance
  Placemark: new (
    coords: number[],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => YPlacemarkInstance
}

type YMapInstance = {
  destroy: () => void
  container?: { fitToViewport?: () => void }
  geoObjects: {
    removeAll: () => void
    add: (o: unknown) => void
    getBounds: () => number[][] | null
  }
  setCenter: (c: number[], z?: number, opts?: Record<string, unknown>) => void
  setBounds: (b: number[][], opts?: Record<string, unknown>) => void
}

type YPlacemarkInstance = {
  events: { add: (ev: string, fn: () => void) => void }
}

function getYMaps(): YMapsRuntime | undefined {
  return (window as unknown as { ymaps?: YMapsRuntime }).ymaps
}

function escapeHtml(text: string): string {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

function loadYandexMaps2(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ww = () =>
      window as Window & {
        ymaps?: { ready: (cb: () => void) => void }
      }

    if (ww().ymaps?.ready) {
      ww().ymaps!.ready(() => resolve())
      return
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="api-maps.yandex.ru/2.1"]',
    )
    if (existing) {
      const done = () => {
        if (ww().ymaps?.ready) ww().ymaps!.ready(() => resolve())
        else reject(new Error('ymaps'))
      }
      if ((existing as HTMLScriptElement & { complete?: boolean }).complete) {
        done()
      } else {
        existing.addEventListener('load', done)
        existing.addEventListener('error', () => reject(new Error('script')))
      }
      return
    }

    const s = document.createElement('script')
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
    s.async = true
    s.onload = () => {
      if (ww().ymaps?.ready) ww().ymaps!.ready(() => resolve())
      else reject(new Error('ymaps'))
    }
    s.onerror = () => reject(new Error('load'))
    document.head.appendChild(s)
  })
}

type Props = {
  places: PublicPlace[]
  selectedPlaceId: number | null
  deferUntilVisible: boolean
  visibilityAnchorRef: RefObject<HTMLElement | null>
  apiKey: string | undefined
  onMarkerPlaceClick?: (id: number) => void
}

/**
 * Yandex Maps 2.1 без npm-пакета: скрипт с CDN, маркеры только у мест с валидными lat/lon.
 */
export function PlacesYandexMap({
  places,
  selectedPlaceId,
  deferUntilVisible,
  visibilityAnchorRef,
  apiKey,
  onMarkerPlaceClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<YMapInstance | null>(null)

  const [ioVisible, setIoVisible] = useState(!deferUntilVisible)
  const visible = !deferUntilVisible || ioVisible
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!deferUntilVisible) return
    const el = visibilityAnchorRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setIoVisible(true)
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.04 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [deferUntilVisible, visibilityAnchorRef])

  useEffect(() => {
    if (!visible || !apiKey || !containerRef.current) return

    let cancelled = false

    void loadYandexMaps2(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return
        const ymapsGlobal = getYMaps()
        if (!ymapsGlobal) {
          setMapError('Карта временно недоступна.')
          return
        }
        setMapError(null)

        const map = new ymapsGlobal.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          controls: ['zoomControl'],
        })
        mapRef.current = map
        setMapReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapError('Карта временно недоступна.')
      })

    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
      setMapReady(false)
    }
  }, [visible, apiKey])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const ymapsGlobal = getYMaps()
    if (!ymapsGlobal) return

    const map = mapRef.current
    map.geoObjects.removeAll()

    for (const p of places) {
      const ll = getPlaceLatLon(p)
      if (!ll) continue
      const placemark = new ymapsGlobal.Placemark(
        ll,
        {
          balloonContent: `<div style="padding:4px 2px;font:14px system-ui">${escapeHtml(p.name)}</div>`,
          hintContent: p.name,
        },
        { preset: 'islands#blueIcon' },
      )
      if (onMarkerPlaceClick) {
        placemark.events.add('click', () => onMarkerPlaceClick(p.id))
      }
      map.geoObjects.add(placemark)
    }

    const withCoords = places.filter((p) => getPlaceLatLon(p))
    if (withCoords.length > 0) {
      const bounds = map.geoObjects.getBounds()
      if (bounds) {
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 28 })
      }
    } else {
      map.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM)
    }
  }, [places, mapReady, onMarkerPlaceClick])

  useEffect(() => {
    if (!mapReady || !mapRef.current || selectedPlaceId == null) return
    const p = places.find((x) => x.id === selectedPlaceId)
    const ll = p ? getPlaceLatLon(p) : null
    if (!ll) return
    try {
      mapRef.current.setCenter(ll, 14, { duration: 350 })
    } catch {
      mapRef.current.setCenter(ll, 14)
    }
  }, [selectedPlaceId, places, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !containerRef.current) return
    const map = mapRef.current
    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      try {
        map.container?.fitToViewport?.()
      } catch {
        /* ignore */
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [mapReady])

  if (!apiKey) {
    return (
      <div
        className="flex h-full min-h-[min(42vh,360px)] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center lg:min-h-0"
        role="region"
        aria-label="Карта недоступна"
      >
        <p className="text-[15px] font-semibold text-neutral-800">Карта Яндекса</p>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-600">
          Задайте переменную окружения{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            VITE_YANDEX_MAPS_API_KEY
          </code>{' '}
          — ключ JavaScript API Карт (бесплатный квотированный режим в кабинете разработчика Яндекса).
        </p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div
        className="flex h-full min-h-[min(42vh,360px)] w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center lg:min-h-0"
        role="region"
        aria-label="Ошибка карты"
      >
        <p className="text-[15px] font-semibold text-neutral-800">{mapError}</p>
        <p className="mt-2 text-[14px] text-neutral-600">
          Список мест слева работает как обычно.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-[min(42vh,360px)] min-w-0 flex-col lg:min-h-0">
      {!mapReady ? (
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center rounded-2xl bg-slate-100 text-[14px] text-neutral-500"
          aria-busy
        >
          Загрузка карты…
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="h-full min-h-[min(42vh,360px)] w-full flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner lg:min-h-0"
        role="application"
        aria-label="Карта с метками мест"
      />
    </div>
  )
}
