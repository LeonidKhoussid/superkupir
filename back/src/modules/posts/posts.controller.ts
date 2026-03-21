import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { PostsService } from "./posts.service";
import {
  createPostSchema,
  listPostsQuerySchema,
  postParamsSchema,
  updatePostSchema,
} from "./posts.schemas";

export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  list = asyncHandler(async (request: Request, response: Response) => {
    const query = listPostsQuerySchema.parse(request.query);
    const result = await this.postsService.listPosts({
      guide: query.guide,
      mine: query.mine,
      userId: request.auth?.userId,
      limit: query.limit,
      offset: query.offset,
    });

    response.status(200).json(result);
  });

  detail = asyncHandler(async (request: Request, response: Response) => {
    const params = postParamsSchema.parse(request.params);
    const result = await this.postsService.getPostById(params.id);

    response.status(200).json(result);
  });

  create = asyncHandler(async (request: Request, response: Response) => {
    const body = createPostSchema.parse(request.body);
    const result = await this.postsService.createPost(request.auth!.userId, {
      title: body.title,
      content: body.content,
      imageUrls: body.image_urls,
    });

    response.status(201).json(result);
  });

  update = asyncHandler(async (request: Request, response: Response) => {
    const params = postParamsSchema.parse(request.params);
    const body = updatePostSchema.parse(request.body);
    const result = await this.postsService.updatePost(params.id, request.auth!.userId, {
      title: body.title,
      content: body.content,
      imageUrls: body.image_urls,
    });

    response.status(200).json(result);
  });

  remove = asyncHandler(async (request: Request, response: Response) => {
    const params = postParamsSchema.parse(request.params);
    await this.postsService.deletePost(params.id, request.auth!.userId);

    response.status(204).send();
  });
}
