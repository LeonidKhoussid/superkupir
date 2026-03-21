import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { RouteBuildSessionsService } from "./route-build-sessions.service";
import {
  createRouteBuildSessionSchema,
  finalizeRouteBuildSessionSchema,
  routeBuildActionSchema,
  routeBuildRecommendationsQuerySchema,
  routeBuildSessionParamsSchema,
} from "./route-build-sessions.schemas";

export class RouteBuildSessionsController {
  constructor(private readonly routeBuildSessionsService: RouteBuildSessionsService) {}

  create = asyncHandler(async (request: Request, response: Response) => {
    const body = createRouteBuildSessionSchema.parse(request.body);
    const result = await this.routeBuildSessionsService.createSession(request.auth!.userId, {
      seasonId: body.season_id,
      sourceMode: body.source_mode,
      anchorPlaceId: body.anchor_place_id ?? null,
    });

    response.status(201).json(result);
  });

  appendAction = asyncHandler(async (request: Request, response: Response) => {
    const params = routeBuildSessionParamsSchema.parse(request.params);
    const body = routeBuildActionSchema.parse(request.body);
    const result = await this.routeBuildSessionsService.appendAction(params.id, request.auth!.userId, {
      placeId: body.place_id,
      actionType: body.action_type,
    });

    response.status(200).json(result);
  });

  recommendations = asyncHandler(async (request: Request, response: Response) => {
    const params = routeBuildSessionParamsSchema.parse(request.params);
    const query = routeBuildRecommendationsQuerySchema.parse(request.query);
    const result = await this.routeBuildSessionsService.getRecommendations(params.id, request.auth!.userId, {
      limit: query.limit,
      radiusKm: query.radius_km,
    });

    response.status(200).json(result);
  });

  finalize = asyncHandler(async (request: Request, response: Response) => {
    const params = routeBuildSessionParamsSchema.parse(request.params);
    const body = finalizeRouteBuildSessionSchema.parse(request.body);
    const result = await this.routeBuildSessionsService.finalizeSession(params.id, request.auth!.userId, {
      title: body.title,
      description: body.description,
    });

    response.status(200).json(result);
  });
}
