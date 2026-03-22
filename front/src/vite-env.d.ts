/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ JavaScript API Яндекс.Карт (https://developer.tech.yandex.ru/) */
  readonly VITE_YANDEX_MAPS_API_KEY?: string
  /** Публичный origin frontend-приложения для генерации share/deeplink URL */
  readonly VITE_PUBLIC_APP_URL?: string
  /** Полный origin бэкенда, если не совпадает с хостом страницы (например отдельный API-домен) */
  readonly VITE_API_BASE_URL?: string
  /** Порт бэкенда при авто-сборке URL с хостом страницы (по умолчанию 3000) */
  readonly VITE_API_PORT?: string
}
