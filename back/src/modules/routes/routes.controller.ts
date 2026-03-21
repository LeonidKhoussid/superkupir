import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { RoutesService } from "./routes.service";
import {
  addRoutePlaceSchema,
  createRouteFromQuizSchema,
  createRouteSchema,
  createShareLinkSchema,
  deleteRoutePlaceQuerySchema,
  deleteRouteQuerySchema,
  listRoutesQuerySchema,
  patchSharedRouteSchema,
  routeParamsSchema,
  routePlaceParamsSchema,
  routeShareTokenParamsSchema,
  updateRoutePlaceSchema,
  updateRouteSchema,
} from "./routes.schemas";

export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  list = asyncHandler(async (request: Request, response: Response) => {
    const query = listRoutesQuerySchema.parse(request.query);
    const result = await this.routesService.listRoutes(request.auth!.userId, query);

    response.status(200).json(result);
  });

  detail = asyncHandler(async (request: Request, response: Response) => {
    const params = routeParamsSchema.parse(request.params);
    const result = await this.routesService.getRoute(params.id, request.auth!.userId);

    response.status(200).json(result);
  });

  create = asyncHandler(async (request: Request, response: Response) => {
    const body = createRouteSchema.parse(request.body);
    const result = await this.routesService.createRoute(request.auth!.userId, {
      title: body.title,
      description: body.description,
      creationMode: body.creation_mode,
      seasonId: body.season_id,
      totalEstimatedCost: body.total_estimated_cost,
      totalEstimatedDurationMinutes: body.total_estimated_duration_minutes,
      placeIds: body.place_ids,
    });

    response.status(201).json(result);
  });

  createFromQuiz = asyncHandler(async (request: Request, response: Response) => {
    const body = createRouteFromQuizSchema.parse(request.body);
    const result = await this.routesService.createRouteFromQuiz(request.auth!.userId, {
      title: body.title,
      description: body.description,
      seasonId: body.season_id,
      seasonSlug: body.season_slug,
      desiredPlaceCount: body.desired_place_count,
      generatedPlaceIds: body.generated_place_ids,
    });

    response.status(201).json(result);
  });

  update = asyncHandler(async (request: Request, response: Response) => {
    const params = routeParamsSchema.parse(request.params);
    const body = updateRouteSchema.parse(request.body);
    const result = await this.routesService.updateRoute(params.id, request.auth!.userId, {
      revisionNumber: body.revision_number,
      title: body.title,
      description: body.description,
      seasonId: body.season_id,
      totalEstimatedCost: body.total_estimated_cost,
      totalEstimatedDurationMinutes: body.total_estimated_duration_minutes,
    });

    response.status(200).json(result);
  });

  remove = asyncHandler(async (request: Request, response: Response) => {
    const params = routeParamsSchema.parse(request.params);
    const query = deleteRouteQuerySchema.parse(request.query);
    await this.routesService.deleteRoute(params.id, request.auth!.userId, query.revision_number);

    response.status(204).send();
  });

  addPlace = asyncHandler(async (request: Request, response: Response) => {
    const params = routeParamsSchema.parse(request.params);
    const body = addRoutePlaceSchema.parse(request.body);
    const result = await this.routesService.addRoutePlace(params.id, request.auth!.userId, {
      ...body,
      revisionNumber: body.revision_number,
    });

    response.status(200).json(result);
  });

  updatePlace = asyncHandler(async (request: Request, response: Response) => {
    const params = routePlaceParamsSchema.parse(request.params);
    const body = updateRoutePlaceSchema.parse(request.body);
    const result = await this.routesService.updateRoutePlace(
      params.id,
      params.routePlaceId,
      request.auth!.userId,
      {
        revisionNumber: body.revision_number,
        sortOrder: body.sort_order,
        dayNumber: body.day_number,
        estimatedTravelMinutesFromPrevious: body.estimated_travel_minutes_from_previous,
        estimatedDistanceKmFromPrevious: body.estimated_distance_km_from_previous,
        stayDurationMinutes: body.stay_duration_minutes,
      },
    );

    response.status(200).json(result);
  });

  deletePlace = asyncHandler(async (request: Request, response: Response) => {
    const params = routePlaceParamsSchema.parse(request.params);
    const query = deleteRoutePlaceQuerySchema.parse(request.query);
    const result = await this.routesService.deleteRoutePlace(
      params.id,
      params.routePlaceId,
      request.auth!.userId,
      query.revision_number,
    );

    response.status(200).json(result);
  });

  createShareLink = asyncHandler(async (request: Request, response: Response) => {
    const params = routeParamsSchema.parse(request.params);
    const body = createShareLinkSchema.parse(request.body);
    const result = await this.routesService.createShareLink(params.id, request.auth!.userId, {
      canEdit: body.can_edit,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
    });

    response.status(201).json(result);
  });

  getSharedRoute = asyncHandler(async (request: Request, response: Response) => {
    const params = routeShareTokenParamsSchema.parse(request.params);
    const result = await this.routesService.getSharedRoute(params.token);

    response.status(200).json(result);
  });

  attachSharedRoute = asyncHandler(async (request: Request, response: Response) => {
    const params = routeShareTokenParamsSchema.parse(request.params);
    const result = await this.routesService.attachSharedRoute(params.token, request.auth!.userId);

    response.status(200).json(result);
  });

  patchSharedRoute = asyncHandler(async (request: Request, response: Response) => {
    const params = routeShareTokenParamsSchema.parse(request.params);
    const body = patchSharedRouteSchema.parse(request.body);
    const result = await this.routesService.patchSharedRoute(params.token, {
      revisionNumber: body.revision_number,
      title: body.title,
      description: body.description,
      seasonId: body.season_id,
      totalEstimatedCost: body.total_estimated_cost,
      totalEstimatedDurationMinutes: body.total_estimated_duration_minutes,
      places: body.places,
    });

    response.status(200).json(result);
  });
}
