import { z } from "zod";

const stringQuerySchema = z.string().trim().min(1).max(255);

export const listPlacesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).default(0),
    q: stringQuerySchema.optional(),
    name: stringQuerySchema.optional(),
    location: stringQuerySchema.optional(),
    source_location: stringQuerySchema.optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    offset: value.offset,
    q: value.q,
    name: value.name,
    sourceLocation: value.source_location ?? value.location,
  }));

export const placeParamsSchema = z.object({
  id: z.coerce.number().int().positive("Place id must be a positive integer"),
});
