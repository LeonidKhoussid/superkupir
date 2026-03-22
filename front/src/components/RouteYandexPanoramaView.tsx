import { Map, Panorama, Placemark, YMaps } from '@pbe/react-yandex-maps'

export type RouteYandexPanoramaViewProps = {
  apiKey: string
  lat: number
  lon: number
  viewMode: 'streetview' | 'map'
  placeName: string
  /** Уникальный ключ точки — пересоздаёт плеер при смене места. */
  pointKey: string
}

/**
 * Панорама улицы и спутниковая карта через Yandex Maps JS API 2.1 (`@pbe/react-yandex-maps`).
 * Нужен `VITE_YANDEX_MAPS_API_KEY`.
 */
export function RouteYandexPanoramaView({
  apiKey,
  lat,
  lon,
  viewMode,
  placeName,
  pointKey,
}: RouteYandexPanoramaViewProps) {
  const center: [number, number] = [lat, lon]

  return (
    <YMaps query={{ apikey: apiKey, lang: 'ru_RU' }} preload>
      <div className="relative size-full min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black">
        {viewMode === 'streetview' ? (
          <Panorama
            key={pointKey}
            point={center}
            defaultOptions={{ suppressMapOpenBlock: true }}
            className="absolute inset-0 size-full min-h-[280px]"
          />
        ) : (
          <Map
            key={`${pointKey}-map`}
            defaultState={{
              center,
              zoom: 17,
              type: 'yandex#satellite',
              controls: ['zoomControl', 'fullscreenControl', 'typeSelector'],
            }}
            className="absolute inset-0 size-full min-h-[280px]"
          >
            <Placemark
              geometry={center}
              properties={{ balloonContent: placeName, hintContent: placeName }}
              options={{ preset: 'islands#blueCircleDotIcon' }}
            />
          </Map>
        )}
      </div>
    </YMaps>
  )
}
