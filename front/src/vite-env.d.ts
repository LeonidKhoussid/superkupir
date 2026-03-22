/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ JavaScript API Яндекс.Карт (https://developer.tech.yandex.ru/) */
  readonly VITE_YANDEX_MAPS_API_KEY?: string
  /** Публичный origin frontend-приложения для генерации share/deeplink URL */
  readonly VITE_PUBLIC_APP_URL?: string
}
