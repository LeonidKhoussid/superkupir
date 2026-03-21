import type { PlaceRecommendation } from "../places/places.types";
import type { PublicRouteDetail } from "../routes/routes.types";

export type RouteBuildSessionStatus = "active" | "completed" | "cancelled";
export type RouteBuildSourceMode = "mobile_swipe" | "desktop_board";
export type RouteBuildActionType = "accepted" | "rejected" | "saved";

export interface RouteBuildSessionRecord {
  id: number;
  userId: string | null;
  seasonId: number;
  seasonSlug: string;
  sourceMode: RouteBuildSourceMode;
  anchorPlaceId: number | null;
  status: RouteBuildSessionStatus;
  acceptedCount: number;
  rejectedCount: number;
  savedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRouteBuildSession {
  id: number;
  user_id: string | null;
  season_id: number;
  season_slug: string;
  source_mode: RouteBuildSourceMode;
  anchor_place_id: number | null;
  status: RouteBuildSessionStatus;
  accepted_count: number;
  rejected_count: number;
  saved_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface RouteBuildRecommendationsResult {
  session: PublicRouteBuildSession;
  recommendations: {
    items: PlaceRecommendation[];
    total: number;
    limit: number;
  };
}

export interface FinalizedRouteBuildResult {
  session: PublicRouteBuildSession;
  route: PublicRouteDetail;
}

export const toPublicRouteBuildSession = (
  session: RouteBuildSessionRecord,
): PublicRouteBuildSession => ({
  id: session.id,
  user_id: session.userId,
  season_id: session.seasonId,
  season_slug: session.seasonSlug,
  source_mode: session.sourceMode,
  anchor_place_id: session.anchorPlaceId,
  status: session.status,
  accepted_count: session.acceptedCount,
  rejected_count: session.rejectedCount,
  saved_count: session.savedCount,
  created_at: session.createdAt,
  updated_at: session.updatedAt,
});
