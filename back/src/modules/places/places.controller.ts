import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { PlacesService } from "./places.service";
import {
  listPlacesQuerySchema,
  placeParamsSchema,
  placeRecommendationsBodySchema,
} from "./places.schemas";

export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  list = asyncHandler(async (request: Request, response: Response) => {
    const query = listPlacesQuerySchema.parse(request.query);
    const result = await this.placesService.listPlaces(query);

    response.status(200).json(result);
  });

  recommend = asyncHandler(async (request: Request, response: Response) => {
    const body = placeRecommendationsBodySchema.parse(request.body);
    const result = await this.placesService.recommendPlaces(body);

    response.status(200).json(result);
  });

  detail = asyncHandler(async (request: Request, response: Response) => {
    const params = placeParamsSchema.parse(request.params);
    const result = await this.placesService.getPlaceById(params.id);

    response.status(200).json(result);
  });
}
