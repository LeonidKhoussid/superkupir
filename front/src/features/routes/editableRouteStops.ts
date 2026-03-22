import { randomClientId } from '../../lib/randomClientId'
import type { PublicPlace } from '../places/placesApi'
import type { RoutePlaceRow, UserRouteDetail } from './routesApi'

/** Одна остановка в редакторе маршрута на странице `/routes/:id`. */
export type EditableRouteStop = {
  /** Стабильный ключ для React (сервер: `s-{route_place_id}`, новое: `n-{uuid}`). */
  key: string
  /** `route_place_id` с сервера; `null` если точка добавлена только на клиенте. */
  serverRoutePlaceId: number | null
  place: PublicPlace
}

export function stopsFromUserRoute(route: UserRouteDetail): EditableRouteStop[] {
  return route.places
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rp) => ({
      key: `s-${rp.route_place_id}`,
      serverRoutePlaceId: rp.route_place_id,
      place: rp.place,
    }))
}

export function newClientRouteStop(place: PublicPlace): EditableRouteStop {
  return {
    key: `n-${randomClientId()}`,
    serverRoutePlaceId: null,
    place,
  }
}

/** Для блоков отелей/ресторанов и совместимости с `partitionRoutePlacesByHospitality`. */
export function editableStopsToRouteRows(stops: EditableRouteStop[]): RoutePlaceRow[] {
  return stops.map((s, i) => ({
    route_place_id: s.serverRoutePlaceId ?? -(i + 1),
    place_id: s.place.id,
    sort_order: i + 1,
    place: s.place,
  }))
}
