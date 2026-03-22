import type { PublicPlace } from '../places/placesApi'
import type { RoutePlaceRow } from './routesApi'
import { isHospitalityTypeSlug } from './routeReviewHelpers'

export function placeHasPanoramaCoordinates(place: PublicPlace): boolean {
  if (place.lat == null || place.lon == null) return false
  const lat = Number(place.lat)
  const lon = Number(place.lon)
  return Number.isFinite(lat) && Number.isFinite(lon)
}

/**
 * Порядок остановок и выбор точки по умолчанию для `/routes/:id/panorama` (Яндекс Panorama / карта).
 */
export function getDefaultPanoramaStopIndex(ordered: RoutePlaceRow[]): number {
  const mainIdx = ordered.findIndex(
    (row) =>
      !isHospitalityTypeSlug(row.place.type_slug) && placeHasPanoramaCoordinates(row.place),
  )
  if (mainIdx >= 0) return mainIdx
  const anyIdx = ordered.findIndex((row) => placeHasPanoramaCoordinates(row.place))
  return anyIdx >= 0 ? anyIdx : -1
}

export function orderedRoutePlaceRows(route: { places: RoutePlaceRow[] }): RoutePlaceRow[] {
  return route.places.slice().sort((a, b) => a.sort_order - b.sort_order)
}
