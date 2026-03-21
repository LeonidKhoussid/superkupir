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
    type: stringQuerySchema.optional(),
    season: stringQuerySchema.optional(),
    is_active: z.coerce.boolean().optional(),
  })
  .transform((value) => ({
    limit: value.limit,
    offset: value.offset,
    q: value.q,
    name: value.name,
    sourceLocation: value.source_location ?? value.location,
    typeSlug: value.type,
    seasonSlug: value.season,
    isActive: value.is_active,
  }));

export const placeParamsSchema = z.object({
  id: z.coerce.number().int().positive("Place id must be a positive integer"),
});

export const placeRecommendationsBodySchema = z
  .object({
    season_id: z.coerce.number().int().positive().optional(),
    season_slug: stringQuerySchema.optional(),
    anchor_place_id: z.coerce.number().int().positive().optional(),
    exclude_place_ids: z.array(z.coerce.number().int().positive()).default([]),
    radius_km: z.coerce.number().positive().max(500).default(50),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine((value) => value.season_id !== undefined || value.season_slug !== undefined, {
    message: "season_id or season_slug is required",
    path: ["season_id"],
  })
  .transform((value) => ({
    seasonId: value.season_id,
    seasonSlug: value.season_slug,
    anchorPlaceId: value.anchor_place_id,
    excludePlaceIds: value.exclude_place_ids,
    radiusKm: value.radius_km,
    limit: value.limit,
  }));
