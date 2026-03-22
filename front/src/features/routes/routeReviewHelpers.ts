/**
 * Хелперы для сводки маршрута и публичной ссылки — без UI.
 * Панорама: `routePanoramaHelpers.ts`, страница `/routes/:id/panorama` (Яндекс Панорамы + карта).
 */
import type { PublicPlace } from '../places/placesApi'
import type { RoutePlaceRow } from './routesApi'

const HOTEL_SLUGS = new Set(['hotel', 'guest_house', 'recreation_base'])
const FOOD_SLUGS = new Set(['restaurant', 'gastro'])
const DURATION_EXCLUDED_SLUGS = new Set([
  ...HOTEL_SLUGS,
  ...FOOD_SLUGS,
  'cheese',
])

const SEASON_LABELS: Record<string, string> = {
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  winter: 'Зима',
}

export function isHospitalityTypeSlug(typeSlug: string | null): boolean {
  if (!typeSlug) return false
  return HOTEL_SLUGS.has(typeSlug) || FOOD_SLUGS.has(typeSlug)
}

export function partitionRoutePlacesForReview(rows: RoutePlaceRow[]): {
  mainPoints: RoutePlaceRow[]
  hospitalityPoints: RoutePlaceRow[]
} {
  const mainPoints: RoutePlaceRow[] = []
  const hospitalityPoints: RoutePlaceRow[] = []

  for (const row of rows) {
    if (isHospitalityTypeSlug(row.place.type_slug)) {
      hospitalityPoints.push(row)
    } else {
      mainPoints.push(row)
    }
  }

  return { mainPoints, hospitalityPoints }
}

/**
 * Временное hackathon-правило: 1 день на каждую точку, кроме размещения и еды.
 * Позже это можно заменить на реальную оценку длительности маршрута.
 */
export function deriveRouteDurationDays(places: PublicPlace[]): number {
  const visitDays = places.filter((place) => !DURATION_EXCLUDED_SLUGS.has(place.type_slug ?? '')).length
  return Math.max(1, visitDays)
}

export function deriveBudgetFallback(places: PublicPlace[]): number | null {
  const costs = places
    .map((place) => place.estimated_cost)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)

  if (costs.length === 0) {
    return null
  }

  return costs.reduce((sum, value) => sum + value, 0)
}

export function deriveSeasonLabelFromPlaces(places: PublicPlace[]): string | null {
  const unique = new Set<string>()

  for (const place of places) {
    for (const slug of place.season_slugs) {
      if (slug in SEASON_LABELS) {
        unique.add(slug)
      }
    }
  }

  if (unique.size === 0) {
    return null
  }

  return [...unique]
    .sort((left, right) => left.localeCompare(right))
    .map((slug) => SEASON_LABELS[slug] ?? slug)
    .join(', ')
}

export function buildPublicRouteShareUrl(token: string): string {
  const configuredBase = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  const base =
    configuredBase && configuredBase.length > 0
      ? configuredBase
      : typeof window !== 'undefined'
        ? window.location.origin
        : ''

  return `${base.replace(/\/$/, '')}/routes/shared/${encodeURIComponent(token)}`
}

export function formatSeasonSlugLabel(seasonSlug: string | null | undefined): string {
  if (!seasonSlug) {
    return '—'
  }

  return SEASON_LABELS[seasonSlug] ?? seasonSlug
}
