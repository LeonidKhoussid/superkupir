export interface ListPlacesInput {
  limit?: number;
  offset: number;
  q?: string;
  name?: string;
  sourceLocation?: string;
  typeSlug?: string;
  seasonSlug?: string;
  isActive?: boolean;
}

export interface PlaceRecommendationInput {
  seasonId?: number;
  seasonSlug?: string;
  anchorPlaceId?: number;
  /** When set, only places with this `place_types.slug` are returned. */
  typeSlug?: string;
  excludePlaceIds: number[];
  radiusKm?: number;
  limit: number;
}

/** Детерминированный подбор мест для `POST /routes/from-quiz` (без ML). */
export interface QuizPlacesBuildInput {
  seasonSlug: string;
  perPersonBudgetMin: number;
  perPersonBudgetMax: number;
  typePreferenceOrder: string[];
  limit: number;
}

/** Квиз: основные точки в одном `radius_group` + отель и еда там же. */
export interface QuizClusteredBuildInput {
  seasonSlug: string;
  perPersonBudgetMin: number;
  perPersonBudgetMax: number;
  /** Типы достопримечательностей (без отелей/ресторанов). */
  mainTypePreferenceOrder: string[];
  mainLimit: number;
  maxHotels: number;
  maxRestaurants: number;
}

export interface QuizClusteredBuildResult {
  mainIds: number[];
  hotelIds: number[];
  restaurantIds: number[];
  /** Выбранный кластер (для отладки); пусто если без фильтра по району. */
  clusterRadiusGroup: string | null;
}

export interface PlaceRecord {
  id: number;
  name: string;
  sourceLocation: string | null;
  cardUrl: string | null;
  logoUrl: string | null;
  size: string | null;
  description: string | null;
  shortDescription: string | null;
  photoUrls: string[];
  lat: number | null;
  lon: number | null;
  coordinatesRaw: string | null;
  address: string | null;
  typeSlug: string | null;
  seasonSlugs: string[];
  estimatedCost: number | null;
  estimatedDurationMinutes: number | null;
  radiusGroup: string | null;
  isActive: boolean;
}

export interface PublicPlace {
  id: number;
  name: string;
  source_location: string | null;
  card_url: string | null;
  logo_url: string | null;
  size: string | null;
  description: string | null;
  short_description: string | null;
  photo_urls: string[];
  lat: number | null;
  lon: number | null;
  coordinates_raw: string | null;
  address: string | null;
  type_slug: string | null;
  season_slugs: string[];
  estimated_cost: number | null;
  estimated_duration_minutes: number | null;
  radius_group: string | null;
  is_active: boolean;
}

export interface PlaceRecommendation extends PublicPlace {
  distance_km: number | null;
}

export interface PlacesListResult {
  items: PublicPlace[];
  total: number;
  limit: number;
  offset: number;
}

export interface PlaceRecommendationsResult {
  items: PlaceRecommendation[];
  total: number;
  limit: number;
  /** True when anchor-based geo/radius filter returned no rows and a season+exclude-only fallback was used. */
  recommendation_broad_fallback?: boolean;
}

export const toPublicPlace = (place: PlaceRecord): PublicPlace => ({
  id: place.id,
  name: place.name,
  source_location: place.sourceLocation,
  card_url: place.cardUrl,
  logo_url: place.logoUrl,
  size: place.size,
  description: place.description,
  short_description: place.shortDescription,
  photo_urls: place.photoUrls,
  lat: place.lat,
  lon: place.lon,
  coordinates_raw: place.coordinatesRaw,
  address: place.address,
  type_slug: place.typeSlug,
  season_slugs: place.seasonSlugs,
  estimated_cost: place.estimatedCost,
  estimated_duration_minutes: place.estimatedDurationMinutes,
  radius_group: place.radiusGroup,
  is_active: place.isActive,
});
