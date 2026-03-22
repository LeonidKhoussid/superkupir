import { z } from "zod";

const trimmedString = z.string().trim().min(1).max(255);
const nullableTrimmedString = z.string().trim().min(1).max(4000).nullable().optional();
const nullableInt = z.union([z.null(), z.coerce.number().int().positive()]).optional();
const nullableNumber = z.union([z.null(), z.coerce.number().positive()]).optional();

export const routeParamsSchema = z.object({
  id: z.coerce.number().int().positive("Route id must be a positive integer"),
});

export const routePlaceParamsSchema = z.object({
  id: z.coerce.number().int().positive("Route id must be a positive integer"),
  routePlaceId: z.coerce.number().int().positive("Route place id must be a positive integer"),
});

export const routeShareTokenParamsSchema = z.object({
  token: z.string().trim().min(10).max(255),
});

export const listRoutesQuerySchema = z.object({
  scope: z.enum(["accessible", "owned"]).default("accessible"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const baseRouteMutationSchema = z.object({
  title: trimmedString.max(200).optional(),
  description: nullableTrimmedString,
  season_id: nullableInt,
  total_estimated_cost: nullableNumber,
  total_estimated_duration_minutes: nullableInt,
});

const routePlaceInputSchema = z.object({
  place_id: z.coerce.number().int().positive(),
  sort_order: z.coerce.number().int().positive(),
  day_number: nullableInt,
  estimated_travel_minutes_from_previous: nullableInt,
  estimated_distance_km_from_previous: nullableNumber,
  stay_duration_minutes: nullableInt,
});

export const createRouteSchema = baseRouteMutationSchema.extend({
  title: trimmedString.max(200),
  creation_mode: z
    .enum(["quiz", "selection_builder", "manual", "shared_copy"])
    .default("manual"),
  place_ids: z.array(z.coerce.number().int().positive()).max(100).default([]),
});

export const updateRouteSchema = baseRouteMutationSchema
  .extend({
    revision_number: z.coerce.number().int().positive(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.season_id !== undefined ||
      value.total_estimated_cost !== undefined ||
      value.total_estimated_duration_minutes !== undefined,
    {
      message: "At least one route field must be provided",
    },
  );

export const deleteRouteQuerySchema = z.object({
  revision_number: z.coerce.number().int().positive(),
});

export const addRoutePlaceSchema = routePlaceInputSchema.extend({
  revision_number: z.coerce.number().int().positive(),
});

export const updateRoutePlaceSchema = z
  .object({
    revision_number: z.coerce.number().int().positive(),
    sort_order: z.coerce.number().int().positive().optional(),
    day_number: nullableInt,
    estimated_travel_minutes_from_previous: nullableInt,
    estimated_distance_km_from_previous: nullableNumber,
    stay_duration_minutes: nullableInt,
  })
  .refine(
    (value) =>
      value.sort_order !== undefined ||
      value.day_number !== undefined ||
      value.estimated_travel_minutes_from_previous !== undefined ||
      value.estimated_distance_km_from_previous !== undefined ||
      value.stay_duration_minutes !== undefined,
    {
      message: "At least one route place field must be provided",
    },
  );

export const deleteRoutePlaceQuerySchema = z.object({
  revision_number: z.coerce.number().int().positive(),
});

export const createShareLinkSchema = z.object({
  can_edit: z.coerce.boolean().default(true),
  expires_at: z.string().datetime().nullable().optional(),
});

export const patchSharedRouteSchema = z
  .object({
    revision_number: z.coerce.number().int().positive(),
    title: trimmedString.max(200).optional(),
    description: nullableTrimmedString,
    season_id: nullableInt,
    total_estimated_cost: nullableNumber,
    total_estimated_duration_minutes: nullableInt,
    places: z.array(routePlaceInputSchema).max(100).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.season_id !== undefined ||
      value.total_estimated_cost !== undefined ||
      value.total_estimated_duration_minutes !== undefined ||
      value.places !== undefined,
    {
      message: "At least one shared route field must be provided",
    },
  );

const quizAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
]);

const quizSeasonValues = ["spring", "summer", "autumn", "winter", "fall"] as const;
const quizExcursionValues = ["активный", "умеренный", "спокойный"] as const;

export const createRouteFromQuizSchema = z
  .object({
    /** Продуктовый контракт квиза (хакатон, rule-based генерация). */
    people_count: z.coerce.number().int().min(1).max(50).optional(),
    season: z.string().trim().min(1).max(80).optional(),
    budget_from: z.coerce.number().min(0).max(50_000_000).optional(),
    budget_to: z.coerce.number().min(0).max(50_000_000).optional(),
    excursion_type: z.string().trim().min(1).max(40).optional(),
    days_count: z.coerce.number().int().min(1).max(30).optional(),
    title: trimmedString.max(200).optional(),
    description: nullableTrimmedString,
    season_id: nullableInt,
    season_slug: z.string().trim().min(1).max(80).optional(),
    desired_place_count: z.coerce.number().int().min(1).max(20).default(5),
    /** Legacy: пустой объект допустим; для v2 не обязателен. */
    quiz_answers: z.record(z.string(), quizAnswerValueSchema).optional(),
    generated_place_ids: z.array(z.coerce.number().int().positive()).max(50).optional(),
  })
  .superRefine((val, ctx) => {
    const isV2 =
      val.people_count !== undefined &&
      val.season !== undefined &&
      val.season.trim() !== "" &&
      val.budget_from !== undefined &&
      val.budget_to !== undefined &&
      val.excursion_type !== undefined &&
      val.excursion_type.trim() !== "" &&
      val.days_count !== undefined;

    if (isV2) {
      const budgetFrom = val.budget_from as number;
      const budgetTo = val.budget_to as number;
      if (budgetFrom > budgetTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "budget_to must be greater than or equal to budget_from",
          path: ["budget_to"],
        });
      }
      const se = (val.season as string).trim().toLowerCase();
      if (!quizSeasonValues.includes(se as (typeof quizSeasonValues)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "season must be spring, summer, autumn, winter, or fall",
          path: ["season"],
        });
      }
      const ex = (val.excursion_type as string).trim().toLowerCase();
      if (!quizExcursionValues.includes(ex as (typeof quizExcursionValues)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "excursion_type must be активный, умеренный, or спокойный",
          path: ["excursion_type"],
        });
      }
    } else if (val.quiz_answers === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide people_count, season, budget_from, budget_to, excursion_type, days_count, or legacy quiz_answers",
        path: ["quiz_answers"],
      });
    }
  });

export type CreateRouteFromQuizBody = z.infer<typeof createRouteFromQuizSchema>;

export type RoutePlaceInput = z.infer<typeof routePlaceInputSchema>;
