import { useEffect, useRef, useState } from 'react'
import { getPlaceLatLon, type PublicPlace } from '../features/places/placesApi'
import {
  escapeHtmlForYandexBalloon,
  getYMaps,
  loadYandexMaps2,
  YANDEX_DEFAULT_CENTER,
  YANDEX_DEFAULT_ZOOM,
  type YMapInstance,
  type YMapsRuntime,
} from '../lib/yandexMapsLoader'

type Props = {
  orderedPlaces: PublicPlace[]
  apiKey: string | undefined
}

function addPolylineFallback(
  ymaps: YMapsRuntime,
  map: YMapInstance,
  points: [number, number][],
) {
  if (points.length < 2) return
  try {
    const line = new ymaps.Polyline(
      points,
      {},
      {
        strokeColor: '#4385F5',
        strokeWidth: 5,
        strokeOpacity: 0.9,
      },
    )
    map.geoObjects.add(line)
  } catch {
    /* ignore */
  }
}

/**
 * Карта маршрута: маркеры по порядку остановок + маршрут по дорогам (MultiRouter) или ломаная при сбое.
 */
export function RouteYandexMap({ orderedPlaces, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<YMapInstance | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey || !containerRef.current) return

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
          center: YANDEX_DEFAULT_CENTER,
          zoom: YANDEX_DEFAULT_ZOOM,
          controls: ['zoomControl', 'fullscreenControl'],
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
  }, [apiKey])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const ymapsGlobal = getYMaps()
    if (!ymapsGlobal) return

    const map = mapRef.current
    map.geoObjects.removeAll()

    const withMeta: { place: PublicPlace; ll: [number, number] }[] = []
    for (const p of orderedPlaces) {
      const ll = getPlaceLatLon(p)
      if (ll) withMeta.push({ place: p, ll })
    }

    withMeta.forEach(({ place, ll }, idx) => {
      const n = idx + 1
      const placemark = new ymapsGlobal.Placemark(
        ll,
        {
          balloonContent: `<div style="padding:6px 4px;font:14px system-ui;max-width:240px">${escapeHtmlForYandexBalloon(place.name)}</div>`,
          hintContent: `${n}. ${place.name}`,
          iconContent: String(n),
        },
        { preset: 'islands#blueStretchyIcon' },
      )
      map.geoObjects.add(placemark)
    })

    const pts = withMeta.map((x) => x.ll)

    if (pts.length >= 2) {
      const MultiRoute = ymapsGlobal.multiRouter?.MultiRoute
      if (MultiRoute) {
        const multiRoute = new MultiRoute(
          {
            referencePoints: pts,
            params: {
              routingMode: 'auto',
              results: 1,
            },
          },
          {
            boundsAutoApply: true,
            wayPointVisible: false,
            routeActiveStrokeColor: '#4385F5',
            routeActiveStrokeWidth: 5,
            routeStrokeWidth: 0,
          },
        )
        map.geoObjects.add(multiRoute)

        let fallbackAdded = false
        const tryFallback = () => {
          if (fallbackAdded) return
          fallbackAdded = true
          try {
            map.geoObjects.remove(multiRoute)
          } catch {
            /* ignore */
          }
          addPolylineFallback(ymapsGlobal, map, pts)
          const b = map.geoObjects.getBounds()
          if (b) map.setBounds(b, { checkZoomRange: true, zoomMargin: 40 })
        }

        multiRoute.model.events.add('requestfail', tryFallback)
      } else {
        addPolylineFallback(ymapsGlobal, map, pts)
        const b = map.geoObjects.getBounds()
        if (b) map.setBounds(b, { checkZoomRange: true, zoomMargin: 40 })
      }
    } else if (pts.length === 1) {
      try {
        map.setCenter(pts[0], 11, { duration: 0 })
      } catch {
        map.setCenter(pts[0], 11)
      }
    } else {
      map.setCenter(YANDEX_DEFAULT_CENTER, YANDEX_DEFAULT_ZOOM)
    }
  }, [orderedPlaces, mapReady])

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
        className="flex h-full min-h-[min(52vh,420px)] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center lg:min-h-0"
        role="region"
        aria-label="Карта недоступна"
      >
        <p className="text-[15px] font-semibold text-neutral-800">Карта Яндекса</p>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-600">
          Задайте{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">
            VITE_YANDEX_MAPS_API_KEY
          </code>{' '}
          для маршрута по дорогам и меток.
        </p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div
        className="flex h-full min-h-[min(52vh,420px)] w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center lg:min-h-0"
        role="region"
        aria-label="Ошибка карты"
      >
        <p className="text-[15px] font-semibold text-neutral-800">{mapError}</p>
        <p className="mt-2 text-[14px] text-neutral-600">Список остановок справа остаётся доступным.</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-[min(52vh,420px)] min-w-0 flex-col lg:min-h-0">
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
        className="h-full min-h-[min(52vh,420px)] w-full flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner lg:min-h-0"
        role="application"
        aria-label="Карта маршрута"
      />
    </div>
  )
}
