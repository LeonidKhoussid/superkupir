import { z } from "zod";

const nullableTitleSchema = z.string().trim().min(1).max(200).nullable().optional();

export const postParamsSchema = z.object({
  id: z.coerce.number().int().positive("Post id must be a positive integer"),
});

export const listPostsQuerySchema = z.object({
  guide: z.coerce.boolean().optional(),
  mine: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createPostSchema = z.object({
  title: nullableTitleSchema,
  content: z.string().trim().min(1).max(4000),
  image_urls: z.array(z.string().trim().url()).max(20).default([]),
});

export const updatePostSchema = z
  .object({
    title: nullableTitleSchema,
    content: z.string().trim().min(1).max(4000).optional(),
    image_urls: z.array(z.string().trim().url()).max(20).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.content !== undefined ||
      value.image_urls !== undefined,
    {
      message: "At least one post field must be provided",
    },
  );
