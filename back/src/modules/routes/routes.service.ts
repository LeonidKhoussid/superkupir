import { AppError } from "../../lib/errors";
import type { CatalogRepository } from "../catalog/catalog.repository";
import type { PlacesRepository } from "../places/places.repository";
import type { RoutePlaceInput } from "./routes.schemas";
import type {
  PublicRouteDetail,
  PublicRouteShareLink,
  PublicRouteSummary,
  RouteAccessType,
} from "./routes.types";
import {
  toPublicRouteDetail,
  toPublicRouteShareLink,
  toPublicRouteSummary,
} from "./routes.types";
import type { RoutesRepository } from "./routes.repository";

const isEditableAccess = (accessType: RouteAccessType) =>
  accessType === "owner" || accessType === "shared" || accessType === "collaborator";

const mapRepositoryError = (error: unknown): never => {
  if (error instanceof Error) {
    if (error.message === "ROUTE_REVISION_CONFLICT") {
      throw new AppError(409, "Route revision conflict");
    }

    if (error.message === "ROUTE_PLACE_NOT_FOUND") {
      throw new AppError(404, "Route place not found");
    }

    if (error.message === "SHARE_LINK_NOT_FOUND") {
      throw new AppError(404, "Share link not found");
    }
  }

  throw error;
};

const ensureUniqueSortOrders = (places: RoutePlaceInput[]) => {
  const seen = new Set<number>();

  for (const place of places) {
    if (seen.has(place.sort_order)) {
      throw new AppError(400, "Route places must have unique sort_order values");
    }

    seen.add(place.sort_order);
  }
};

export class RoutesService {
  constructor(
    private readonly routesRepository: RoutesRepository,
    private readonly placesRepository: PlacesRepository,
    private readonly catalogRepository: CatalogRepository,
  ) {}

  async listRoutes(
    userId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ items: PublicRouteSummary[]; limit: number; offset: number }> {
    const items = await this.routesRepository.listAccessibleRoutes(userId, pagination);

    return {
      items: items.map(toPublicRouteSummary),
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async getRoute(routeId: number, userId: string): Promise<PublicRouteDetail> {
    const route = await this.routesRepository.findAccessibleRouteDetail(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    return toPublicRouteDetail(route);
  }

  async createRoute(
    userId: string,
    input: {
      title: string;
      description?: string | null;
      creationMode: "quiz" | "selection_builder" | "manual" | "shared_copy";
      seasonId?: number | null;
      totalEstimatedCost?: number | null;
      totalEstimatedDurationMinutes?: number | null;
      placeIds: number[];
    },
  ): Promise<PublicRouteDetail> {
    const seasonId = await this.resolveSeasonId(input.seasonId);
    const places = await this.buildSequentialRoutePlaces(input.placeIds);
    const routeId = await this.routesRepository.createRoute({
      ownerUserId: userId,
      title: input.title,
      description: input.description ?? null,
      creationMode: input.creationMode,
      seasonId,
      totalEstimatedCost: input.totalEstimatedCost ?? null,
      totalEstimatedDurationMinutes: input.totalEstimatedDurationMinutes ?? null,
      places,
    });

    return this.getRoute(routeId, userId);
  }

  async createRouteFromQuiz(
    userId: string,
    input: {
      title?: string;
      description?: string | null;
      seasonId?: number | null;
      seasonSlug?: string;
      desiredPlaceCount: number;
      generatedPlaceIds?: number[];
    },
  ): Promise<PublicRouteDetail> {
    const seasonId = await this.resolveSeasonId(input.seasonId, input.seasonSlug);

    let placeIds = input.generatedPlaceIds ?? [];

    if (placeIds.length === 0) {
      const recommendations = await this.placesRepository.findRecommendations({
        seasonId: seasonId ?? undefined,
        seasonSlug: input.seasonSlug,
        excludePlaceIds: [],
        limit: input.desiredPlaceCount,
      });

      placeIds = recommendations.items.map((item) => item.id);
    }

    if (placeIds.length === 0) {
      throw new AppError(400, "Quiz route could not be built from the current place catalog");
    }

    const routeId = await this.routesRepository.createRoute({
      ownerUserId: userId,
      title: input.title ?? "Маршрут по квизу",
      description: input.description ?? null,
      creationMode: "quiz",
      seasonId,
      totalEstimatedCost: null,
      totalEstimatedDurationMinutes: null,
      places: await this.buildSequentialRoutePlaces(placeIds),
    });

    return this.getRoute(routeId, userId);
  }

  async updateRoute(
    routeId: number,
    userId: string,
    input: {
      revisionNumber: number;
      title?: string;
      description?: string | null;
      seasonId?: number | null;
      totalEstimatedCost?: number | null;
      totalEstimatedDurationMinutes?: number | null;
    },
  ): Promise<PublicRouteDetail> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (!isEditableAccess(route.accessType)) {
      throw new AppError(403, "Route edit access is required");
    }

    const seasonId =
      input.seasonId === undefined
        ? undefined
        : await this.resolveSeasonId(input.seasonId);

    try {
      await this.routesRepository.updateRoute(routeId, input.revisionNumber, {
        title: input.title,
        description: input.description,
        seasonId,
        totalEstimatedCost: input.totalEstimatedCost,
        totalEstimatedDurationMinutes: input.totalEstimatedDurationMinutes,
      });
    } catch (error) {
      mapRepositoryError(error);
    }

    return this.getRoute(routeId, userId);
  }

  async deleteRoute(routeId: number, userId: string, revisionNumber: number): Promise<void> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (route.accessType !== "owner") {
      throw new AppError(403, "Only the route owner can delete this route");
    }

    try {
      await this.routesRepository.deleteRoute(routeId, revisionNumber);
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async addRoutePlace(
    routeId: number,
    userId: string,
    input: RoutePlaceInput & { revisionNumber: number },
  ): Promise<PublicRouteDetail> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (!isEditableAccess(route.accessType)) {
      throw new AppError(403, "Route edit access is required");
    }

    await this.ensurePlaceIdsExist([input.place_id]);

    try {
      await this.routesRepository.addRoutePlace(routeId, input.revisionNumber, input);
    } catch (error) {
      mapRepositoryError(error);
    }

    return this.getRoute(routeId, userId);
  }

  async updateRoutePlace(
    routeId: number,
    routePlaceId: number,
    userId: string,
    input: {
      revisionNumber: number;
      sortOrder?: number;
      dayNumber?: number | null;
      estimatedTravelMinutesFromPrevious?: number | null;
      estimatedDistanceKmFromPrevious?: number | null;
      stayDurationMinutes?: number | null;
    },
  ): Promise<PublicRouteDetail> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (!isEditableAccess(route.accessType)) {
      throw new AppError(403, "Route edit access is required");
    }

    try {
      await this.routesRepository.updateRoutePlace(routeId, routePlaceId, input.revisionNumber, input);
    } catch (error) {
      mapRepositoryError(error);
    }

    return this.getRoute(routeId, userId);
  }

  async deleteRoutePlace(
    routeId: number,
    routePlaceId: number,
    userId: string,
    revisionNumber: number,
  ): Promise<PublicRouteDetail> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (!isEditableAccess(route.accessType)) {
      throw new AppError(403, "Route edit access is required");
    }

    try {
      await this.routesRepository.deleteRoutePlace(routeId, routePlaceId, revisionNumber);
    } catch (error) {
      mapRepositoryError(error);
    }

    return this.getRoute(routeId, userId);
  }

  async createShareLink(
    routeId: number,
    userId: string,
    input: { canEdit: boolean; expiresAt: Date | null },
  ): Promise<PublicRouteShareLink> {
    const route = await this.routesRepository.findAccessibleRouteSummary(routeId, userId);

    if (!route) {
      throw new AppError(404, "Route not found");
    }

    if (!isEditableAccess(route.accessType)) {
      throw new AppError(403, "Route share access requires edit permissions");
    }

    const shareLink = await this.routesRepository.insertShareLink(routeId, userId, input);
    return toPublicRouteShareLink(shareLink);
  }

  async getSharedRoute(token: string): Promise<PublicRouteDetail & { can_edit: boolean }> {
    const route = await this.routesRepository.findSharedRouteDetail(token);

    if (!route) {
      throw new AppError(404, "Share link not found");
    }

    return {
      ...toPublicRouteDetail(route),
      can_edit: route.canEdit,
    };
  }

  async attachSharedRoute(token: string, userId: string): Promise<PublicRouteDetail> {
    const result = await this.routesRepository.attachRouteAccessFromShareToken(token, userId);

    if (!result) {
      throw new AppError(404, "Share link not found");
    }

    return this.getRoute(result.routeId, userId);
  }

  async patchSharedRoute(
    token: string,
    input: {
      revisionNumber: number;
      title?: string;
      description?: string | null;
      seasonId?: number | null;
      totalEstimatedCost?: number | null;
      totalEstimatedDurationMinutes?: number | null;
      places?: RoutePlaceInput[];
    },
  ): Promise<PublicRouteDetail & { can_edit: boolean }> {
    if (input.places) {
      ensureUniqueSortOrders(input.places);
      await this.ensurePlaceIdsExist(input.places.map((place) => place.place_id));
    }

    const seasonId =
      input.seasonId === undefined
        ? undefined
        : await this.resolveSeasonId(input.seasonId);

    try {
      await this.routesRepository.patchSharedRoute(token, input.revisionNumber, {
        title: input.title,
        description: input.description,
        seasonId,
        totalEstimatedCost: input.totalEstimatedCost,
        totalEstimatedDurationMinutes: input.totalEstimatedDurationMinutes,
        places: input.places,
      });
    } catch (error) {
      mapRepositoryError(error);
    }

    return this.getSharedRoute(token);
  }

  private async buildSequentialRoutePlaces(placeIds: number[]): Promise<RoutePlaceInput[]> {
    await this.ensurePlaceIdsExist(placeIds);

    return placeIds.map((placeId, index) => ({
      place_id: placeId,
      sort_order: index + 1,
      day_number: null,
      estimated_travel_minutes_from_previous: null,
      estimated_distance_km_from_previous: null,
      stay_duration_minutes: null,
    }));
  }

  private async ensurePlaceIdsExist(placeIds: number[]): Promise<void> {
    const uniqueIds = [...new Set(placeIds)];
    const existingIds = await this.placesRepository.findExistingIds(uniqueIds);

    if (existingIds.length !== uniqueIds.length) {
      throw new AppError(404, "One or more places were not found");
    }
  }

  private async resolveSeasonId(
    seasonId?: number | null,
    seasonSlug?: string,
  ): Promise<number | null> {
    if (seasonId === null) {
      return null;
    }

    if (seasonId !== undefined) {
      const season = await this.catalogRepository.findSeasonById(seasonId);

      if (!season) {
        throw new AppError(404, "Season not found");
      }

      return season.id;
    }

    if (seasonSlug) {
      const season = await this.catalogRepository.findSeasonBySlug(seasonSlug);

      if (!season) {
        throw new AppError(404, "Season not found");
      }

      return season.id;
    }

    return null;
  }
}
