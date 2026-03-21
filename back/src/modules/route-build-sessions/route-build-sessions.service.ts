import { AppError } from "../../lib/errors";
import type { CatalogRepository } from "../catalog/catalog.repository";
import { toPublicPlace } from "../places/places.types";
import type { PlacesRepository } from "../places/places.repository";
import type { RoutesService } from "../routes/routes.service";
import { toPublicRouteBuildSession } from "./route-build-sessions.types";
import type {
  FinalizedRouteBuildResult,
  RouteBuildActionType,
  RouteBuildRecommendationsResult,
  PublicRouteBuildSession,
  RouteBuildSourceMode,
} from "./route-build-sessions.types";
import type { RouteBuildSessionsRepository } from "./route-build-sessions.repository";

export class RouteBuildSessionsService {
  constructor(
    private readonly routeBuildSessionsRepository: RouteBuildSessionsRepository,
    private readonly placesRepository: PlacesRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly routesService: RoutesService,
  ) {}

  async createSession(
    userId: string,
    input: { seasonId: number; sourceMode: RouteBuildSourceMode; anchorPlaceId: number | null },
  ): Promise<PublicRouteBuildSession> {
    const season = await this.catalogRepository.findSeasonById(input.seasonId);

    if (!season) {
      throw new AppError(404, "Season not found");
    }

    if (input.anchorPlaceId !== null) {
      const exists = await this.placesRepository.placeExists(input.anchorPlaceId);

      if (!exists) {
        throw new AppError(404, "Anchor place not found");
      }
    }

    const session = await this.routeBuildSessionsRepository.createSession({
      userId,
      seasonId: input.seasonId,
      sourceMode: input.sourceMode,
      anchorPlaceId: input.anchorPlaceId,
    });

    return toPublicRouteBuildSession(session);
  }

  async appendAction(
    sessionId: number,
    userId: string,
    action: { placeId: number; actionType: RouteBuildActionType },
  ): Promise<PublicRouteBuildSession> {
    const session = await this.getActiveOwnedSession(sessionId, userId);
    const placeExists = await this.placesRepository.placeExists(action.placeId);

    if (!placeExists) {
      throw new AppError(404, "Place not found");
    }

    await this.routeBuildSessionsRepository.appendAction(sessionId, action);

    const updated = await this.routeBuildSessionsRepository.findOwnedSession(sessionId, userId);

    if (!updated) {
      throw new AppError(404, "Route build session not found");
    }

    return toPublicRouteBuildSession(updated);
  }

  async getRecommendations(
    sessionId: number,
    userId: string,
    input: { limit: number; radiusKm: number },
  ): Promise<RouteBuildRecommendationsResult> {
    const session = await this.getActiveOwnedSession(sessionId, userId);
    const seenPlaceIds = await this.routeBuildSessionsRepository.listSeenPlaceIds(sessionId);
    const recommendations = await this.placesRepository.findRecommendations({
      seasonId: session.seasonId,
      anchorPlaceId: session.anchorPlaceId ?? undefined,
      excludePlaceIds: seenPlaceIds,
      radiusKm: input.radiusKm,
      limit: input.limit,
    });

    return {
      session: toPublicRouteBuildSession(session),
      recommendations: {
        items: recommendations.items.map((item) => ({
          ...toPublicPlace(item),
          distance_km: item.distanceKm,
        })),
        total: recommendations.total,
        limit: input.limit,
      },
    };
  }

  async finalizeSession(
    sessionId: number,
    userId: string,
    input: { title: string; description?: string | null },
  ): Promise<FinalizedRouteBuildResult> {
    const session = await this.getActiveOwnedSession(sessionId, userId);
    const selectedPlaceIds = await this.routeBuildSessionsRepository.listSelectedPlaceIds(sessionId);

    if (selectedPlaceIds.length === 0) {
      throw new AppError(400, "At least one accepted or saved place is required to finalize");
    }

    const route = await this.routesService.createRoute(userId, {
      title: input.title,
      description: input.description ?? null,
      creationMode: "selection_builder",
      seasonId: session.seasonId,
      totalEstimatedCost: null,
      totalEstimatedDurationMinutes: null,
      placeIds: selectedPlaceIds,
    });

    await this.routeBuildSessionsRepository.markCompleted(sessionId);

    const completedSession = await this.routeBuildSessionsRepository.findOwnedSession(sessionId, userId);

    if (!completedSession) {
      throw new AppError(404, "Route build session not found");
    }

    return {
      session: toPublicRouteBuildSession(completedSession),
      route,
    };
  }

  private async getActiveOwnedSession(sessionId: number, userId: string) {
    const session = await this.routeBuildSessionsRepository.findOwnedSession(sessionId, userId);

    if (!session) {
      throw new AppError(404, "Route build session not found");
    }

    if (session.status !== "active") {
      throw new AppError(400, "Route build session is not active");
    }

    return session;
  }
}
