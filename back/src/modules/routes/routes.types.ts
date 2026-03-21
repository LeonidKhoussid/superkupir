import type { PublicPlace } from "../places/places.types";

export type RouteAccessType = "owner" | "shared" | "collaborator" | "viewer";
export type RouteCreationMode = "quiz" | "selection_builder" | "manual" | "shared_copy";

export interface RouteOwnerRecord {
  id: string;
  email: string;
  isGuide: boolean;
}

export interface RouteSummaryRecord {
  id: number;
  owner: RouteOwnerRecord;
  title: string;
  description: string | null;
  creationMode: RouteCreationMode;
  seasonId: number | null;
  seasonSlug: string | null;
  totalEstimatedCost: number | null;
  totalEstimatedDurationMinutes: number | null;
  revisionNumber: number;
  accessType: RouteAccessType;
  placeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutePlaceRecord {
  id: number;
  routeId: number;
  placeId: number;
  sortOrder: number;
  dayNumber: number | null;
  estimatedTravelMinutesFromPrevious: number | null;
  estimatedDistanceKmFromPrevious: number | null;
  stayDurationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  place: PublicPlace;
}

export interface RouteDetailRecord extends RouteSummaryRecord {
  places: RoutePlaceRecord[];
}

export interface RouteShareLinkRecord {
  id: number;
  routeId: number;
  token: string;
  canEdit: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface PublicRouteOwner {
  id: string;
  email: string;
  is_guide: boolean;
}

export interface PublicRouteSummary {
  id: number;
  owner: PublicRouteOwner;
  title: string;
  description: string | null;
  creation_mode: RouteCreationMode;
  season_id: number | null;
  season_slug: string | null;
  total_estimated_cost: number | null;
  total_estimated_duration_minutes: number | null;
  revision_number: number;
  access_type: RouteAccessType;
  place_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PublicRoutePlace {
  route_place_id: number;
  route_id: number;
  place_id: number;
  sort_order: number;
  day_number: number | null;
  estimated_travel_minutes_from_previous: number | null;
  estimated_distance_km_from_previous: number | null;
  stay_duration_minutes: number | null;
  created_at: Date;
  updated_at: Date;
  place: PublicPlace;
}

export interface PublicRouteDetail extends PublicRouteSummary {
  places: PublicRoutePlace[];
}

export interface PublicRouteShareLink {
  id: number;
  route_id: number;
  token: string;
  can_edit: boolean;
  expires_at: Date | null;
  created_at: Date;
}

export const toPublicRouteOwner = (owner: RouteOwnerRecord): PublicRouteOwner => ({
  id: owner.id,
  email: owner.email,
  is_guide: owner.isGuide,
});

export const toPublicRouteSummary = (route: RouteSummaryRecord): PublicRouteSummary => ({
  id: route.id,
  owner: toPublicRouteOwner(route.owner),
  title: route.title,
  description: route.description,
  creation_mode: route.creationMode,
  season_id: route.seasonId,
  season_slug: route.seasonSlug,
  total_estimated_cost: route.totalEstimatedCost,
  total_estimated_duration_minutes: route.totalEstimatedDurationMinutes,
  revision_number: route.revisionNumber,
  access_type: route.accessType,
  place_count: route.placeCount,
  created_at: route.createdAt,
  updated_at: route.updatedAt,
});

export const toPublicRouteDetail = (route: RouteDetailRecord): PublicRouteDetail => ({
  ...toPublicRouteSummary(route),
  places: route.places.map((place) => ({
    route_place_id: place.id,
    route_id: place.routeId,
    place_id: place.placeId,
    sort_order: place.sortOrder,
    day_number: place.dayNumber,
    estimated_travel_minutes_from_previous: place.estimatedTravelMinutesFromPrevious,
    estimated_distance_km_from_previous: place.estimatedDistanceKmFromPrevious,
    stay_duration_minutes: place.stayDurationMinutes,
    created_at: place.createdAt,
    updated_at: place.updatedAt,
    place: place.place,
  })),
});

export const toPublicRouteShareLink = (link: RouteShareLinkRecord): PublicRouteShareLink => ({
  id: link.id,
  route_id: link.routeId,
  token: link.token,
  can_edit: link.canEdit,
  expires_at: link.expiresAt,
  created_at: link.createdAt,
});
