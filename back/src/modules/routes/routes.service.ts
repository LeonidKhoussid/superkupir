import { AppError } from "../../lib/errors";
import type { CatalogRepository } from "../catalog/catalog.repository";
import type { PlacesRepository } from "../places/places.repository";
import type { PlaceRecord } from "../places/places.types";
import type { CreateRouteFromQuizBody, RoutePlaceInput } from "./routes.schemas";
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

const canonicalSeasonSlugFromQuiz = (raw: string): string => {
  const s = raw.trim().toLowerCase();
  return s === "fall" ? "autumn" : s;
};

const normalizeExcursionRu = (raw: string): "активный" | "умеренный" | "спокойный" => {
  const s = raw.trim().toLowerCase();
  if (s === "активный") return "активный";
  if (s === "умеренный") return "умеренный";
  return "спокойный";
};

const HOSPITALITY_TYPE_SLUGS = new Set([
  "hotel",
  "guest_house",
  "recreation_base",
  "restaurant",
  "gastro",
]);

/** Полный порядок предпочтений (включая отель/еду для справки; для SQL «основных» точек еду/отели отрезаем). */
const excursionPreferenceTypes = (
  excursion: "активный" | "умеренный" | "спокойный",
): string[] => {
  switch (excursion) {
    case "активный":
      return [
        "park",
        "mountain",
        "event",
        "farm",
        "workshop",
        "museum",
        "winery",
        "gastro",
        "restaurant",
      ];
    case "умеренный":
      return [
        "museum",
        "park",
        "farm",
        "mountain",
        "event",
        "workshop",
        "winery",
        "gastro",
        "restaurant",
        "hotel",
      ];
    default:
      return [
        "museum",
        "park",
        "farm",
        "mountain",
        "event",
        "workshop",
        "winery",
        "gastro",
        "restaurant",
        "hotel",
        "guest_house",
        "recreation_base",
      ];
  }
};

const mainAttractionTypePreferences = (
  excursion: "активный" | "умеренный" | "спокойный",
): string[] =>
  [...new Set(excursionPreferenceTypes(excursion).filter((s) => !HOSPITALITY_TYPE_SLUGS.has(s)))];

const seasonLabelRu = (canonical: string): string => {
  switch (canonical) {
    case "spring":
      return "весна";
    case "summer":
      return "лето";
    case "autumn":
      return "осень";
    case "winter":
      return "зима";
    default:
      return canonical;
  }
};

/** Как в places.repository: lat/lon из колонок или `coordinates_raw` вида "lat,lon". */
const effectiveLatLon = (place: PlaceRecord): { lat: number; lon: number } | null => {
  if (place.lat != null && place.lon != null && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return { lat: place.lat, lon: place.lon };
  }
  const raw = place.coordinatesRaw?.trim();
  if (!raw) {
    return null;
  }
  const parts = raw.split(",");
  if (parts.length < 2) {
    return null;
  }
  const lat = Number(parts[0]!.trim());
  const lon = Number(parts[1]!.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { lat, lon };
};

/** Грубое расстояние в км (согласовано с рекомендациями мест). */
const distanceKmRough = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number =>
  Math.sqrt(Math.pow((a.lat - b.lat) * 111, 2) + Math.pow((a.lon - b.lon) * 85, 2));

/**
 * Упорядочить остановки квиза по карте: старт с западной точки (min lon), далее жадный nearest-neighbor.
 * Точки без координат остаются в конце в исходном относительном порядке.
 */
const orderQuizPlaceIdsGeographically = (placeIds: number[], placeById: Map<number, PlaceRecord>): number[] => {
  if (placeIds.length <= 2) {
    return placeIds;
  }

  const withCoords: number[] = [];
  const withoutCoords: number[] = [];

  for (const id of placeIds) {
    const p = placeById.get(id);
    if (!p || effectiveLatLon(p) == null) {
      withoutCoords.push(id);
    } else {
      withCoords.push(id);
    }
  }

  if (withCoords.length <= 1) {
    return [...withCoords, ...withoutCoords];
  }

  const remaining = new Set(withCoords);
  const start = [...remaining].sort((a, b) => {
    const la = effectiveLatLon(placeById.get(a)!)!.lon;
    const lb = effectiveLatLon(placeById.get(b)!)!.lon;
    if (la !== lb) {
      return la - lb;
    }
    return a - b;
  })[0]!;

  const ordered: number[] = [start];
  remaining.delete(start);
  let current = start;

  while (remaining.size > 0) {
    const curCoord = effectiveLatLon(placeById.get(current)!);
    let bestId: number | null = null;
    let bestD = Infinity;

    for (const id of remaining) {
      const coord = effectiveLatLon(placeById.get(id)!);
      const d = distanceKmRough(curCoord!, coord!);
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && id < (bestId ?? Infinity))) {
        bestD = d;
        bestId = id;
      }
    }

    if (bestId == null) {
      break;
    }
    ordered.push(bestId);
    remaining.delete(bestId);
    current = bestId;
  }

  for (const id of remaining) {
    ordered.push(id);
  }

  return [...ordered, ...withoutCoords];
};

/** Убираем «хвосты» далеко от центра массы основных точек, чтобы маршрут не тянулся через пол-региона. */
const COMPACT_MAIN_MAX_SPREAD_KM = 95;

const compactMainPlaceIdsByCentroid = (
  ids: number[],
  placeById: Map<number, PlaceRecord>,
  maxSpreadKm: number,
): number[] => {
  if (ids.length <= 2) {
    return ids;
  }

  let current = [...ids];

  while (current.length > 2) {
    type Row = { id: number; c: { lat: number; lon: number } };
    const coords: Row[] = [];
    for (const id of current) {
      const p = placeById.get(id);
      const c = p ? effectiveLatLon(p) : null;
      if (c) {
        coords.push({ id, c });
      }
    }

    if (coords.length < 2) {
      return current;
    }

    const cLat = coords.reduce((s, x) => s + x.c.lat, 0) / coords.length;
    const cLon = coords.reduce((s, x) => s + x.c.lon, 0) / coords.length;
    const centroid = { lat: cLat, lon: cLon };

    let farthest: number | null = null;
    let farthestD = 0;
    for (const { id, c } of coords) {
      const d = distanceKmRough(centroid, c);
      if (d > farthestD) {
        farthestD = d;
        farthest = id;
      }
    }

    if (farthestD <= maxSpreadKm || farthest == null) {
      break;
    }

    current = current.filter((id) => id !== farthest);
  }

  return current;
};

const pickClosestPlaceIds = (
  candidates: number[],
  anchorIds: number[],
  placeById: Map<number, PlaceRecord>,
  take: number,
): number[] => {
  if (candidates.length === 0 || take <= 0) {
    return [];
  }
  if (anchorIds.length === 0) {
    return candidates.slice(0, take);
  }

  const anchorCoords: { lat: number; lon: number }[] = [];
  for (const id of anchorIds) {
    const p = placeById.get(id);
    const c = p ? effectiveLatLon(p) : null;
    if (c) {
      anchorCoords.push(c);
    }
  }

  if (anchorCoords.length === 0) {
    return candidates.slice(0, take);
  }

  const cLat = anchorCoords.reduce((s, c) => s + c.lat, 0) / anchorCoords.length;
  const cLon = anchorCoords.reduce((s, c) => s + c.lon, 0) / anchorCoords.length;
  const centroid = { lat: cLat, lon: cLon };

  return [...candidates]
    .map((id) => {
      const p = placeById.get(id);
      const e = p ? effectiveLatLon(p) : null;
      const d = e ? distanceKmRough(centroid, e) : Number.POSITIVE_INFINITY;
      return { id, d };
    })
    .sort((a, b) => (a.d !== b.d ? a.d - b.d : a.id - b.id))
    .slice(0, take)
    .map((x) => x.id);
};

/** Основные точки по карте; 1–2 ресторана (в середине/конце дня); отель в конце. */
const mergeQuizRouteStops = (
  mainGeoOrdered: number[],
  restaurantIds: number[],
  hotelIds: number[],
): number[] => {
  const seen = new Set<number>();
  const out: number[] = [];

  const pushU = (id: number) => {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };

  const r1 = restaurantIds[0];
  const r2 = restaurantIds[1];
  const hotel = hotelIds[0];

  if (mainGeoOrdered.length >= 2 && r1 != null) {
    const mid = Math.floor(mainGeoOrdered.length / 2);
    for (let i = 0; i < mid; i++) {
      pushU(mainGeoOrdered[i]!);
    }
    pushU(r1);
    for (let i = mid; i < mainGeoOrdered.length; i++) {
      pushU(mainGeoOrdered[i]!);
    }
    if (r2 != null) {
      pushU(r2);
    }
  } else {
    for (const id of mainGeoOrdered) {
      pushU(id);
    }
    if (r1 != null) {
      pushU(r1);
    }
    if (r2 != null) {
      pushU(r2);
    }
  }

  if (hotel != null) {
    pushU(hotel);
  }

  return out;
};

export class RoutesService {
  constructor(
    private readonly routesRepository: RoutesRepository,
    private readonly placesRepository: PlacesRepository,
    private readonly catalogRepository: CatalogRepository,
  ) {}

  async listRoutes(
    userId: string,
    pagination: { scope: "accessible" | "owned"; limit: number; offset: number },
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

  async createRouteFromQuiz(userId: string, body: CreateRouteFromQuizBody): Promise<PublicRouteDetail> {
    const isV2 =
      body.people_count !== undefined &&
      body.season !== undefined &&
      body.season.trim() !== "" &&
      body.budget_from !== undefined &&
      body.budget_to !== undefined &&
      body.excursion_type !== undefined &&
      body.excursion_type.trim() !== "" &&
      body.days_count !== undefined;

    if (!isV2) {
      return this.createRouteFromQuizLegacy(userId, {
        title: body.title,
        description: body.description,
        seasonId: body.season_id,
        seasonSlug: body.season_slug,
        desiredPlaceCount: body.desired_place_count,
        generatedPlaceIds: body.generated_place_ids,
      });
    }

    const peopleCount = body.people_count!;
    const budgetFrom = body.budget_from!;
    const budgetTo = body.budget_to!;
    const daysCount = body.days_count!;
    const seasonRaw = body.season!;
    const excursionRaw = body.excursion_type!;

    const seasonSlugCanonical = canonicalSeasonSlugFromQuiz(seasonRaw);
    const excursion = normalizeExcursionRu(excursionRaw);
    const perMin = budgetFrom / peopleCount;
    const perMax = budgetTo / peopleCount;
    const targetCount = Math.min(Math.max(daysCount + 2, 4), 15);
    const mainTypeOrder = mainAttractionTypePreferences(excursion);
    const mainLimit = Math.max(2, Math.min(targetCount - 3, 12));
    const maxRestaurants = Math.min(2, Math.max(1, Math.ceil(targetCount / 4)));

    let clustered = await this.placesRepository.findPlacesForQuizClustered({
      seasonSlug: seasonSlugCanonical,
      perPersonBudgetMin: perMin,
      perPersonBudgetMax: perMax,
      mainTypePreferenceOrder: mainTypeOrder,
      mainLimit,
      maxHotels: 1,
      maxRestaurants,
    });

    let mainIds = clustered.mainIds;
    let hotelIds = [...clustered.hotelIds];
    let restaurantIds = [...clustered.restaurantIds];

    if (mainIds.length < 2) {
      mainIds = await this.placesRepository.findPlacesForQuizBuild({
        seasonSlug: seasonSlugCanonical,
        perPersonBudgetMin: perMin,
        perPersonBudgetMax: perMax,
        typePreferenceOrder: mainTypeOrder,
        limit: mainLimit,
      });
    }

    if (mainIds.length < 2) {
      mainIds = await this.placesRepository.findPlacesForQuizBuild({
        seasonSlug: seasonSlugCanonical,
        perPersonBudgetMin: 0,
        perPersonBudgetMax: 1_000_000_000,
        typePreferenceOrder: mainTypeOrder,
        limit: mainLimit,
      });
    }

    if (mainIds.length < 2) {
      const rec = await this.placesRepository.findRecommendations({
        seasonSlug: seasonSlugCanonical,
        excludePlaceIds: [],
        limit: Math.max(mainLimit, 8),
      });
      mainIds = rec.items
        .filter((item) => item.typeSlug == null || !HOSPITALITY_TYPE_SLUGS.has(item.typeSlug))
        .map((item) => item.id);
    }

    if (mainIds.length === 0) {
      throw new AppError(400, "Quiz route could not be built from the current place catalog");
    }

    const loadPlaceMap = async (ids: number[]): Promise<Map<number, PlaceRecord>> => {
      const rows = await this.placesRepository.findManyByIds(ids);
      return new Map(rows.map((p) => [p.id, p]));
    };

    let placeById = await loadPlaceMap(mainIds);
    const compactedMain = compactMainPlaceIdsByCentroid(mainIds, placeById, COMPACT_MAIN_MAX_SPREAD_KM);
    if (compactedMain.length >= 2) {
      mainIds = compactedMain;
    }

    placeById = await loadPlaceMap([...new Set([...mainIds, ...hotelIds, ...restaurantIds])]);

    if (hotelIds.length === 0) {
      const cand = await this.placesRepository.findPlacesForQuizBuild({
        seasonSlug: seasonSlugCanonical,
        perPersonBudgetMin: 0,
        perPersonBudgetMax: 1_000_000_000,
        typePreferenceOrder: ["hotel", "guest_house", "recreation_base"],
        limit: 16,
      });
      placeById = await loadPlaceMap([...new Set([...placeById.keys(), ...cand, ...mainIds])]);
      hotelIds = pickClosestPlaceIds(cand, mainIds, placeById, 1);
    }

    if (restaurantIds.length === 0 && maxRestaurants > 0) {
      const cand = await this.placesRepository.findPlacesForQuizBuild({
        seasonSlug: seasonSlugCanonical,
        perPersonBudgetMin: 0,
        perPersonBudgetMax: 1_000_000_000,
        typePreferenceOrder: ["restaurant", "gastro"],
        limit: 16,
      });
      const avoid = new Set([...mainIds, ...hotelIds]);
      const filtered = cand.filter((id) => !avoid.has(id));
      placeById = await loadPlaceMap([...new Set([...placeById.keys(), ...cand, ...mainIds])]);
      restaurantIds = pickClosestPlaceIds(
        filtered.length > 0 ? filtered : cand,
        mainIds,
        placeById,
        maxRestaurants,
      );
    }

    const orderedMain = orderQuizPlaceIdsGeographically(mainIds, placeById);
    let placeIds = mergeQuizRouteStops(orderedMain, restaurantIds, hotelIds);

    if (placeIds.length === 0) {
      throw new AppError(400, "Quiz route could not be built from the current place catalog");
    }

    const seasonIdResolved = await this.resolveSeasonId(undefined, seasonSlugCanonical);
    const records = await this.placesRepository.findManyByIds(placeIds);
    placeById = new Map(records.map((p) => [p.id, p]));
    const costById = new Map(records.map((p) => [p.id, p.estimatedCost]));

    let totalCost = 0;
    let withNumericCost = 0;
    for (const pid of placeIds) {
      const c = costById.get(pid);
      if (c != null && Number.isFinite(c)) {
        totalCost += c;
        withNumericCost += 1;
      }
    }

    const totalEstimatedCost = withNumericCost > 0 ? totalCost : null;
    const totalEstimatedDurationMinutes = daysCount * 8 * 60;

    const autoTitle = `Маршрут: ${seasonLabelRu(seasonSlugCanonical)}, ${daysCount} дн.`;
    const title = body.title?.trim() ? body.title.trim() : autoTitle;

    const autoDescription = `${peopleCount} чел., ${excursionRaw.trim()}, бюджет ${Math.round(budgetFrom)}–${Math.round(budgetTo)} ₽`;
    const description =
      body.description != null && String(body.description).trim() !== ""
        ? String(body.description).trim()
        : autoDescription;

    const routeId = await this.routesRepository.createRoute({
      ownerUserId: userId,
      title,
      description,
      creationMode: "quiz",
      seasonId: seasonIdResolved,
      totalEstimatedCost,
      totalEstimatedDurationMinutes,
      places: await this.buildSequentialRoutePlaces(placeIds),
    });

    return this.getRoute(routeId, userId);
  }

  private async createRouteFromQuizLegacy(
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

    const legacyRecords = await this.placesRepository.findManyByIds(placeIds);
    placeIds = orderQuizPlaceIdsGeographically(placeIds, new Map(legacyRecords.map((p) => [p.id, p])));

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
