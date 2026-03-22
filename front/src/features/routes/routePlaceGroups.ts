import type { RoutePlaceRow } from './routesApi'

/** Гостиницы и базы по `type_slug` из каталога / импорта. */
const HOTEL_SLUGS = new Set(['hotel', 'guest_house', 'recreation_base'])

/** Еда / гастро по `type_slug`. */
const RESTAURANT_SLUGS = new Set(['restaurant', 'gastro'])

export function isRoutePlaceHotel(row: RoutePlaceRow): boolean {
  const s = row.place.type_slug
  return s != null && HOTEL_SLUGS.has(s)
}

export function isRoutePlaceRestaurant(row: RoutePlaceRow): boolean {
  const s = row.place.type_slug
  return s != null && RESTAURANT_SLUGS.has(s)
}

export function partitionRoutePlacesByHospitality(rows: RoutePlaceRow[]): {
  hotels: RoutePlaceRow[]
  restaurants: RoutePlaceRow[]
} {
  const hotels: RoutePlaceRow[] = []
  const restaurants: RoutePlaceRow[] = []
  for (const r of rows) {
    if (isRoutePlaceHotel(r)) hotels.push(r)
    else if (isRoutePlaceRestaurant(r)) restaurants.push(r)
  }
  return { hotels, restaurants }
}
