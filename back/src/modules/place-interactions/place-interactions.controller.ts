import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { PlaceInteractionsService } from "./place-interactions.service";
import {
  commentBodySchema,
  listCommentsQuerySchema,
  placeInteractionParamsSchema,
} from "./place-interactions.schemas";

export class PlaceInteractionsController {
  constructor(private readonly placeInteractionsService: PlaceInteractionsService) {}

  like = asyncHandler(async (request: Request, response: Response) => {
    const params = placeInteractionParamsSchema.parse(request.params);
    const result = await this.placeInteractionsService.likePlace(params.id, request.auth!.userId);

    response.status(200).json(result);
  });

  unlike = asyncHandler(async (request: Request, response: Response) => {
    const params = placeInteractionParamsSchema.parse(request.params);
    const result = await this.placeInteractionsService.unlikePlace(params.id, request.auth!.userId);

    response.status(200).json(result);
  });

  likesSummary = asyncHandler(async (request: Request, response: Response) => {
    const params = placeInteractionParamsSchema.parse(request.params);
    const result = await this.placeInteractionsService.getLikeSummary(params.id, request.auth?.userId);

    response.status(200).json(result);
  });

  listComments = asyncHandler(async (request: Request, response: Response) => {
    const params = placeInteractionParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);
    const result = await this.placeInteractionsService.listComments(params.id, query);

    response.status(200).json(result);
  });

  createComment = asyncHandler(async (request: Request, response: Response) => {
    const params = placeInteractionParamsSchema.parse(request.params);
    const body = commentBodySchema.parse(request.body);
    const result = await this.placeInteractionsService.createComment(
      params.id,
      request.auth!.userId,
      body.content,
    );

    response.status(201).json(result);
  });
}
