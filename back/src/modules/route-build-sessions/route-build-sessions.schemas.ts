import { z } from "zod";

export const routeBuildSessionParamsSchema = z.object({
  id: z.coerce.number().int().positive("Session id must be a positive integer"),
});

export const createRouteBuildSessionSchema = z.object({
  season_id: z.coerce.number().int().positive(),
  source_mode: z.enum(["mobile_swipe", "desktop_board"]),
  anchor_place_id: z.union([z.null(), z.coerce.number().int().positive()]).optional(),
});

export const routeBuildActionSchema = z.object({
  place_id: z.coerce.number().int().positive(),
  action_type: z.enum(["accepted", "rejected", "saved"]),
});

export const routeBuildRecommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  radius_km: z.coerce.number().positive().max(500).default(50),
});

export const finalizeRouteBuildSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000).nullable().optional(),
});
