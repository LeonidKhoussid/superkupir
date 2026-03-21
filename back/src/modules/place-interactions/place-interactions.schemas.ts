import { z } from "zod";

export const placeInteractionParamsSchema = z.object({
  id: z.coerce.number().int().positive("Place id must be a positive integer"),
});

export const commentBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment content is required")
    .max(1000, "Comment content must be 1000 characters or fewer"),
});

export const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
