import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PublicPlace } from '../places/placesApi'

const STORAGE_KEY = 'kray-tour-route-cart-v1'

export type RecommendationsStatus = 'idle' | 'loading' | 'ok' | 'error' | 'empty'

type PlacesById = Record<string, PublicPlace>

export type RouteCartState = {
  selectedIds: number[]
  placesById: PlacesById
  /** Места, отклонённые свайпом влево на мобильной колоде `/places` — не в корзине, исключаются из рекомендаций и колоды. */
  swipeRejectedIds: number[]
  anchorPlaceId: number | null
  activeSeasonSlug: string | null
  activeSeasonId: number | null
  builderStarted: boolean
  recommendationItems: PublicPlace[]
  /** Сервер расширил выдачу без якорной близости (см. recommendation_broad_fallback). */
  recommendationsBroadFallback: boolean
  recommendationsStatus: RecommendationsStatus
  recommendationsError: string | null
  routeCreateLoading: boolean
  routeCreateError: string | null
}

type RouteCartActions = {
  addPlace: (place: PublicPlace, opts?: { defaultSeasonSlug?: string | null }) => void
  removePlace: (id: number) => void
  rejectSwipePlace: (id: number) => void
  resetBuilder: () => void
  setRecommendationsLoading: () => void
  setRecommendationsResult: (items: PublicPlace[], broadFallback?: boolean) => void
  setRouteAnchor: (placeId: number) => void
  setRecommendationsError: (message: string) => void
  setActiveSeasonId: (id: number | null) => void
  setRouteCreateLoading: (v: boolean) => void
  setRouteCreateError: (message: string | null) => void
}

const initialVolatile = (): Pick<
  RouteCartState,
  | 'recommendationItems'
  | 'recommendationsBroadFallback'
  | 'recommendationsStatus'
  | 'recommendationsError'
  | 'routeCreateLoading'
  | 'routeCreateError'
> => ({
  recommendationItems: [],
  recommendationsBroadFallback: false,
  recommendationsStatus: 'idle',
  recommendationsError: null,
  routeCreateLoading: false,
  routeCreateError: null,
})

export const useRouteCartStore = create<RouteCartState & RouteCartActions>()(
  persist(
    (set) => ({
      selectedIds: [],
      placesById: {},
      swipeRejectedIds: [],
      anchorPlaceId: null,
      activeSeasonSlug: null,
      activeSeasonId: null,
      builderStarted: false,
      ...initialVolatile(),

      addPlace: (place, opts) => {
        const slugFromPlace =
          Array.isArray(place.season_slugs) && place.season_slugs.length > 0
            ? place.season_slugs[0] ?? null
            : null
        const nextSlug = slugFromPlace ?? opts?.defaultSeasonSlug ?? null

        set((s) => {
          if (s.selectedIds.includes(place.id)) {
            return {
              anchorPlaceId: place.id,
              activeSeasonSlug: nextSlug ?? s.activeSeasonSlug,
              builderStarted: true,
            }
          }
          const key = String(place.id)
          return {
            selectedIds: [...s.selectedIds, place.id],
            placesById: { ...s.placesById, [key]: place },
            anchorPlaceId: place.id,
            activeSeasonSlug: nextSlug ?? s.activeSeasonSlug,
            builderStarted: true,
          }
        })
      },

      rejectSwipePlace: (id) => {
        set((s) => {
          if (s.swipeRejectedIds.includes(id)) return s
          return { swipeRejectedIds: [...s.swipeRejectedIds, id] }
        })
      },

      removePlace: (id) => {
        set((s) => {
          const key = String(id)
          const rest = { ...s.placesById }
          delete rest[key]
          const selectedIds = s.selectedIds.filter((x) => x !== id)
          if (selectedIds.length === 0) {
            return {
              selectedIds: [],
              placesById: {},
              swipeRejectedIds: [],
              anchorPlaceId: null,
              activeSeasonSlug: null,
              activeSeasonId: null,
              builderStarted: false,
              ...initialVolatile(),
            }
          }
          const anchorPlaceId =
            s.anchorPlaceId === id ? selectedIds[selectedIds.length - 1]! : s.anchorPlaceId
          const anchorKey = String(anchorPlaceId)
          const anchorPlace = rest[anchorKey]
          const slugFromAnchor =
            anchorPlace &&
            Array.isArray(anchorPlace.season_slugs) &&
            anchorPlace.season_slugs.length > 0
              ? anchorPlace.season_slugs[0] ?? null
              : null
          const nextSlug = slugFromAnchor ?? s.activeSeasonSlug

          return {
            selectedIds,
            placesById: rest,
            anchorPlaceId,
            activeSeasonSlug: nextSlug,
            activeSeasonId: nextSlug === s.activeSeasonSlug ? s.activeSeasonId : null,
            recommendationItems: [],
            recommendationsBroadFallback: false,
            recommendationsStatus: 'idle',
            recommendationsError: null,
          }
        })
      },

      resetBuilder: () => {
        set({
          selectedIds: [],
          placesById: {},
          swipeRejectedIds: [],
          anchorPlaceId: null,
          activeSeasonSlug: null,
          activeSeasonId: null,
          builderStarted: false,
          ...initialVolatile(),
        })
      },

      setRecommendationsLoading: () =>
        set({
          recommendationsStatus: 'loading',
          recommendationsError: null,
          recommendationsBroadFallback: false,
        }),

      setRecommendationsResult: (items, broadFallback) =>
        set({
          recommendationItems: items,
          recommendationsBroadFallback: Boolean(broadFallback),
          recommendationsStatus: items.length === 0 ? 'empty' : 'ok',
          recommendationsError: null,
        }),

      setRouteAnchor: (placeId) =>
        set((s) => {
          if (!s.selectedIds.includes(placeId)) return s
          const key = String(placeId)
          const anchorPlace = s.placesById[key]
          const slugFromAnchor =
            anchorPlace &&
            Array.isArray(anchorPlace.season_slugs) &&
            anchorPlace.season_slugs.length > 0
              ? anchorPlace.season_slugs[0] ?? null
              : null
          const nextSlug = slugFromAnchor ?? s.activeSeasonSlug
          return {
            anchorPlaceId: placeId,
            activeSeasonSlug: nextSlug,
            activeSeasonId: nextSlug === s.activeSeasonSlug ? s.activeSeasonId : null,
          }
        }),

      setRecommendationsError: (message) =>
        set({
          recommendationItems: [],
          recommendationsBroadFallback: false,
          recommendationsStatus: 'error',
          recommendationsError: message,
        }),

      setActiveSeasonId: (id) => set({ activeSeasonId: id }),

      setRouteCreateLoading: (v) => set({ routeCreateLoading: v }),

      setRouteCreateError: (message) => set({ routeCreateError: message }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        selectedIds: s.selectedIds,
        placesById: s.placesById,
        swipeRejectedIds: s.swipeRejectedIds,
        anchorPlaceId: s.anchorPlaceId,
        activeSeasonSlug: s.activeSeasonSlug,
        activeSeasonId: s.activeSeasonId,
        builderStarted: s.builderStarted,
      }),
      onRehydrateStorage: () => () => {
        useRouteCartStore.setState({
          recommendationItems: [],
          recommendationsBroadFallback: false,
          recommendationsStatus: 'idle',
          recommendationsError: null,
          routeCreateLoading: false,
          routeCreateError: null,
        })
      },
    },
  ),
)
