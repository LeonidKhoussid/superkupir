import type { EditableRouteStop } from './editableRouteStops'
import {
  addRoutePlace,
  deleteRoutePlace,
  updateRoutePlace,
  type UserRouteDetail,
} from './routesApi'

/**
 * Синхронизирует порядок и состав остановок с сервером (как на `/routes/:id`).
 */
export async function syncRouteStopsToServer(
  token: string,
  currentRoute: UserRouteDetail,
  desiredStops: EditableRouteStop[],
): Promise<UserRouteDetail> {
  const desiredPlaceIds = desiredStops.map((stop) => stop.place.id)
  const desiredPlaceIdSet = new Set(desiredPlaceIds)
  let syncedRoute = currentRoute

  for (const routePlace of currentRoute.places) {
    if (!desiredPlaceIdSet.has(routePlace.place_id)) {
      syncedRoute = await deleteRoutePlace(
        token,
        syncedRoute.id,
        routePlace.route_place_id,
        syncedRoute.revision_number,
      )
    }
  }

  for (
    let targetIndex = 0;
    targetIndex < desiredPlaceIds.length;
    targetIndex += 1
  ) {
    const desiredPlaceId = desiredPlaceIds[targetIndex]
    const sortedPlaces = syncedRoute.places
      .slice()
      .sort((left, right) => left.sort_order - right.sort_order)
    const currentAtIndex = sortedPlaces[targetIndex]

    if (currentAtIndex?.place_id === desiredPlaceId) {
      continue
    }

    const existing = sortedPlaces.find((place) => place.place_id === desiredPlaceId)

    if (existing) {
      syncedRoute = await updateRoutePlace(token, syncedRoute.id, existing.route_place_id, {
        revision_number: syncedRoute.revision_number,
        sort_order: targetIndex + 1,
      })
      continue
    }

    syncedRoute = await addRoutePlace(token, syncedRoute.id, {
      revision_number: syncedRoute.revision_number,
      place_id: desiredPlaceId,
      sort_order: targetIndex + 1,
    })
  }

  return syncedRoute
}
