/** Центр Краснодарского края по умолчанию [широта, долгота] для Yandex Maps 2.1 */
export const YANDEX_DEFAULT_CENTER: [number, number] = [45.0355, 38.9753]
export const YANDEX_DEFAULT_ZOOM = 8

/** Runtime Yandex Maps 2.1 (скрипт с CDN, типов в проекте нет). */
export type YMapsRuntime = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => YMapInstance
  Placemark: new (
    coords: number[],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => YPlacemarkInstance
  Polyline: new (
    geometry: number[][],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => unknown
  multiRouter?: {
    MultiRoute: new (model: Record<string, unknown>, options?: Record<string, unknown>) => YMultiRouteInstance
  }
}

export type YMapInstance = {
  destroy: () => void
  container?: { fitToViewport?: () => void }
  geoObjects: {
    removeAll: () => void
    remove: (o: unknown) => void
    add: (o: unknown) => void
    getBounds: () => number[][] | null
  }
  setCenter: (c: number[], z?: number, opts?: Record<string, unknown>) => void
  setBounds: (b: number[][], opts?: Record<string, unknown>) => void
}

export type YPlacemarkInstance = {
  events: { add: (ev: string, fn: () => void) => void }
}

export type YMultiRouteInstance = {
  model: {
    events: { add: (ev: string, fn: () => void) => void }
  }
}

export function getYMaps(): YMapsRuntime | undefined {
  return (window as unknown as { ymaps?: YMapsRuntime }).ymaps
}

export function escapeHtmlForYandexBalloon(text: string): string {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

export function loadYandexMaps2(apiKey: string): Promise<void> {
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
