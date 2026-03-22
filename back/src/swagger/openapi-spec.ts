import { env } from "../config/env";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schema: Record<string, unknown>) => ({
  "application/json": {
    schema,
  },
});

const jsonResponse = (description: string, schema: Record<string, unknown>) => ({
  description,
  content: jsonContent(schema),
});

const idPathParameter = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "integer", minimum: 1 },
});

const tokenPathParameter = {
  name: "token",
  in: "path",
  required: true,
  schema: { type: "string", minLength: 10, maxLength: 255 },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Superkiper API",
    version: "0.2.0",
    description:
      "HTTP API for Superkiper backend: auth, place catalog, place interactions, route building, collaborative routes, and inspiration posts.",
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: "Current local backend process",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Catalog" },
    { name: "Places" },
    { name: "Place interactions" },
    { name: "Route build sessions" },
    { name: "Routes" },
    { name: "Posts" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token returned by POST /auth/login or POST /auth/register.",
      },
    },
    schemas: {
      ErrorMessage: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: {},
        },
        required: ["error"],
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Validation failed" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                message: { type: "string" },
              },
              required: ["path", "message"],
            },
          },
        },
        required: ["error", "details"],
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          service: { type: "string", example: "backend" },
          timestamp: { type: "string", format: "date-time" },
        },
        required: ["status", "service", "timestamp"],
      },
      PublicAuthUser: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
        },
        required: ["id", "email"],
      },
      AuthResult: {
        type: "object",
        properties: {
          user: ref("PublicAuthUser"),
          token: { type: "string" },
        },
        required: ["user", "token"],
      },
      RegisterBody: {
        type: "object",
        properties: {
          email: { type: "string", format: "email", maxLength: 320 },
          password: { type: "string", minLength: 8, maxLength: 72 },
        },
        required: ["email", "password"],
      },
      MeResponse: {
        type: "object",
        properties: {
          user: ref("PublicAuthUser"),
        },
        required: ["user"],
      },
      CatalogItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          slug: { type: "string" },
        },
        required: ["id", "name", "slug"],
      },
      CatalogListResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("CatalogItem"),
          },
        },
        required: ["items"],
      },
      PublicPlace: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          source_location: { type: "string", nullable: true },
          card_url: { type: "string", nullable: true },
          logo_url: { type: "string", nullable: true },
          size: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          short_description: { type: "string", nullable: true },
          photo_urls: { type: "array", items: { type: "string" } },
          lat: { type: "number", nullable: true },
          lon: { type: "number", nullable: true },
          coordinates_raw: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
          type_slug: { type: "string", nullable: true },
          season_slugs: { type: "array", items: { type: "string" } },
          estimated_cost: { type: "number", nullable: true },
          estimated_duration_minutes: { type: "integer", nullable: true },
          radius_group: { type: "string", nullable: true },
          is_active: { type: "boolean" },
        },
        required: ["id", "name", "photo_urls", "season_slugs", "is_active"],
      },
      PlacesListResult: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("PublicPlace"),
          },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
      },
      PlaceRecommendation: {
        allOf: [
          ref("PublicPlace"),
          {
            type: "object",
            properties: {
              distance_km: { type: "number", nullable: true },
            },
            required: ["distance_km"],
          },
        ],
      },
      PlaceRecommendationsRequest: {
        type: "object",
        properties: {
          season_id: { type: "integer", minimum: 1, nullable: true },
          season_slug: { type: "string", minLength: 1, maxLength: 255, nullable: true },
          anchor_place_id: { type: "integer", minimum: 1, nullable: true },
          type_slug: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            nullable: true,
            description: "When set, restrict recommendations to this place type slug (place_types.slug).",
          },
          exclude_place_ids: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            default: [],
          },
          radius_km: { type: "number", minimum: 0.1, maximum: 500, default: 50 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
        description: "At least one of season_id or season_slug is required.",
      },
      PlaceRecommendationsResult: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("PlaceRecommendation"),
          },
          total: { type: "integer" },
          limit: { type: "integer" },
          recommendation_broad_fallback: {
            type: "boolean",
            description:
              "When true, anchor proximity filters matched no candidates and results are a broader season+exclude catalog slice (distance_km may be null).",
          },
        },
        required: ["items", "total", "limit"],
      },
      LikeSummary: {
        type: "object",
        properties: {
          place_id: { type: "integer" },
          likes_count: { type: "integer" },
          liked_by_current_user: { type: "boolean", nullable: true },
        },
        required: ["place_id", "likes_count", "liked_by_current_user"],
      },
      LikeMutationResult: {
        type: "object",
        properties: {
          liked: { type: "boolean" },
          likes_count: { type: "integer" },
        },
        required: ["liked", "likes_count"],
      },
      CommentAuthor: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
        },
        required: ["id", "email"],
      },
      PublicPlaceComment: {
        type: "object",
        properties: {
          id: { type: "integer" },
          place_id: { type: "integer" },
          user: ref("CommentAuthor"),
          content: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "place_id", "user", "content", "created_at", "updated_at"],
      },
      PlaceCommentsListResult: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("PublicPlaceComment"),
          },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
      },
      CreateCommentBody: {
        type: "object",
        properties: {
          content: { type: "string", minLength: 1, maxLength: 1000 },
        },
        required: ["content"],
      },
      RouteOwner: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          is_guide: { type: "boolean" },
        },
        required: ["id", "email", "is_guide"],
      },
      PublicRouteSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          owner: ref("RouteOwner"),
          title: { type: "string" },
          description: { type: "string", nullable: true },
          creation_mode: {
            type: "string",
            enum: ["quiz", "selection_builder", "manual", "shared_copy"],
          },
          season_id: { type: "integer", nullable: true },
          season_slug: { type: "string", nullable: true },
          total_estimated_cost: { type: "number", nullable: true },
          total_estimated_duration_minutes: { type: "integer", nullable: true },
          revision_number: { type: "integer" },
          access_type: {
            type: "string",
            enum: ["owner", "shared", "collaborator", "viewer"],
          },
          place_count: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "owner",
          "title",
          "description",
          "creation_mode",
          "season_id",
          "season_slug",
          "total_estimated_cost",
          "total_estimated_duration_minutes",
          "revision_number",
          "access_type",
          "place_count",
          "created_at",
          "updated_at",
        ],
      },
      RoutePlaceInput: {
        type: "object",
        properties: {
          place_id: { type: "integer", minimum: 1 },
          sort_order: { type: "integer", minimum: 1 },
          day_number: { type: "integer", minimum: 1, nullable: true },
          estimated_travel_minutes_from_previous: {
            type: "integer",
            minimum: 1,
            nullable: true,
          },
          estimated_distance_km_from_previous: {
            type: "number",
            minimum: 0.0001,
            nullable: true,
          },
          stay_duration_minutes: { type: "integer", minimum: 1, nullable: true },
        },
        required: ["place_id", "sort_order"],
      },
      PublicRoutePlace: {
        type: "object",
        properties: {
          route_place_id: { type: "integer" },
          route_id: { type: "integer" },
          place_id: { type: "integer" },
          sort_order: { type: "integer" },
          day_number: { type: "integer", nullable: true },
          estimated_travel_minutes_from_previous: { type: "integer", nullable: true },
          estimated_distance_km_from_previous: { type: "number", nullable: true },
          stay_duration_minutes: { type: "integer", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          place: ref("PublicPlace"),
        },
        required: [
          "route_place_id",
          "route_id",
          "place_id",
          "sort_order",
          "day_number",
          "estimated_travel_minutes_from_previous",
          "estimated_distance_km_from_previous",
          "stay_duration_minutes",
          "created_at",
          "updated_at",
          "place",
        ],
      },
      PublicRouteDetail: {
        allOf: [
          ref("PublicRouteSummary"),
          {
            type: "object",
            properties: {
              places: {
                type: "array",
                items: ref("PublicRoutePlace"),
              },
            },
            required: ["places"],
          },
        ],
      },
      RouteListResult: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: ref("PublicRouteSummary"),
          },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "limit", "offset"],
      },
      PublicRouteShareLink: {
        type: "object",
        properties: {
          id: { type: "integer" },
          route_id: { type: "integer" },
          token: { type: "string" },
          can_edit: { type: "boolean" },
          expires_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "route_id", "token", "can_edit", "expires_at", "created_at"],
      },
      SharedRouteDetail: {
        allOf: [
          ref("PublicRouteDetail"),
          {
            type: "object",
            properties: {
              can_edit: { type: "boolean" },
            },
            required: ["can_edit"],
          },
        ],
      },
      CreateRouteBody: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000, nullable: true },
          creation_mode: {
            type: "string",
            enum: ["quiz", "selection_builder", "manual", "shared_copy"],
            default: "manual",
          },
          season_id: { type: "integer", minimum: 1, nullable: true },
          total_estimated_cost: { type: "number", minimum: 0.0001, nullable: true },
          total_estimated_duration_minutes: { type: "integer", minimum: 1, nullable: true },
          place_ids: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            maxItems: 100,
            default: [],
          },
        },
        required: ["title"],
      },
      UpdateRouteBody: {
        type: "object",
        properties: {
          revision_number: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000, nullable: true },
          season_id: { type: "integer", minimum: 1, nullable: true },
          total_estimated_cost: { type: "number", minimum: 0.0001, nullable: true },
          total_estimated_duration_minutes: { type: "integer", minimum: 1, nullable: true },
        },
        required: ["revision_number"],
      },
      AddRoutePlaceBody: {
        allOf: [
          ref("RoutePlaceInput"),
          {
            type: "object",
            properties: {
              revision_number: { type: "integer", minimum: 1 },
            },
            required: ["revision_number"],
          },
        ],
      },
      UpdateRoutePlaceBody: {
        type: "object",
        properties: {
          revision_number: { type: "integer", minimum: 1 },
          sort_order: { type: "integer", minimum: 1 },
          day_number: { type: "integer", minimum: 1, nullable: true },
          estimated_travel_minutes_from_previous: { type: "integer", minimum: 1, nullable: true },
          estimated_distance_km_from_previous: { type: "number", minimum: 0.0001, nullable: true },
          stay_duration_minutes: { type: "integer", minimum: 1, nullable: true },
        },
        required: ["revision_number"],
      },
      CreateShareLinkBody: {
        type: "object",
        properties: {
          can_edit: { type: "boolean", default: true },
          expires_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      PatchSharedRouteBody: {
        type: "object",
        properties: {
          revision_number: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000, nullable: true },
          season_id: { type: "integer", minimum: 1, nullable: true },
          total_estimated_cost: { type: "number", minimum: 0.0001, nullable: true },
          total_estimated_duration_minutes: { type: "integer", minimum: 1, nullable: true },
          places: {
            type: "array",
            maxItems: 100,
            items: ref("RoutePlaceInput"),
          },
        },
        required: ["revision_number"],
      },
      CreateRouteFromQuizBody: {
        type: "object",
        description:
          "Создание маршрута из квиза. Основной контракт: people_count, season, budget_from, budget_to, excursion_type, days_count. Legacy: quiz_answers (и опционально season_slug / desired_place_count).",
        properties: {
          people_count: { type: "integer", minimum: 1, maximum: 50 },
          season: {
            type: "string",
            minLength: 1,
            maxLength: 80,
            description: "spring | summer | autumn | winter | fall (fall нормализуется в autumn)",
          },
          budget_from: { type: "number", minimum: 0 },
          budget_to: { type: "number", minimum: 0 },
          excursion_type: {
            type: "string",
            minLength: 1,
            maxLength: 40,
            description: "активный | умеренный | спокойный (регистр не важен)",
          },
          days_count: { type: "integer", minimum: 1, maximum: 30 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000, nullable: true },
          season_id: { type: "integer", minimum: 1, nullable: true },
          season_slug: { type: "string", minLength: 1, maxLength: 80 },
          desired_place_count: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          quiz_answers: {
            type: "object",
            additionalProperties: true,
            description: "Legacy-поле; для нового квиза не требуется",
          },
          generated_place_ids: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            maxItems: 50,
          },
        },
      },
      PublicRouteBuildSession: {
        type: "object",
        properties: {
          id: { type: "integer" },
          user_id: { type: "string", format: "uuid", nullable: true },
          season_id: { type: "integer" },
          season_slug: { type: "string" },
          source_mode: { type: "string", enum: ["mobile_swipe", "desktop_board"] },
          anchor_place_id: { type: "integer", nullable: true },
          status: { type: "string", enum: ["active", "completed", "cancelled"] },
          accepted_count: { type: "integer" },
          rejected_count: { type: "integer" },
          saved_count: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "user_id",
          "season_id",
          "season_slug",
          "source_mode",
          "anchor_place_id",
          "status",
          "accepted_count",
          "rejected_count",
          "saved_count",
          "created_at",
          "updated_at",
        ],
      },
      RouteBuildRecommendationsResult: {
        type: "object",
        properties: {
          session: ref("PublicRouteBuildSession"),
          recommendations: {
            type: "object",
            properties: {
              items: { type: "array", items: ref("PlaceRecommendation") },
              total: { type: "integer" },
              limit: { type: "integer" },
            },
            required: ["items", "total", "limit"],
          },
        },
        required: ["session", "recommendations"],
      },
      FinalizedRouteBuildResult: {
        type: "object",
        properties: {
          session: ref("PublicRouteBuildSession"),
          route: ref("PublicRouteDetail"),
        },
        required: ["session", "route"],
      },
      CreateRouteBuildSessionBody: {
        type: "object",
        properties: {
          season_id: { type: "integer", minimum: 1 },
          source_mode: { type: "string", enum: ["mobile_swipe", "desktop_board"] },
          anchor_place_id: { type: "integer", minimum: 1, nullable: true },
        },
        required: ["season_id", "source_mode"],
      },
      RouteBuildActionBody: {
        type: "object",
        properties: {
          place_id: { type: "integer", minimum: 1 },
          action_type: { type: "string", enum: ["accepted", "rejected", "saved"] },
        },
        required: ["place_id", "action_type"],
      },
      FinalizeRouteBuildSessionBody: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 4000, nullable: true },
        },
        required: ["title"],
      },
      PublicPostAuthor: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          is_guide: { type: "boolean" },
        },
        required: ["id", "email", "is_guide"],
      },
      PublicPost: {
        type: "object",
        properties: {
          id: { type: "integer" },
          author: ref("PublicPostAuthor"),
          title: { type: "string", nullable: true },
          content: { type: "string" },
          image_urls: { type: "array", items: { type: "string", format: "uri" } },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "author", "title", "content", "image_urls", "created_at", "updated_at"],
      },
      PostsListResult: {
        type: "object",
        properties: {
          items: { type: "array", items: ref("PublicPost") },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
      },
      CreatePostBody: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200, nullable: true },
          content: { type: "string", minLength: 1, maxLength: 4000 },
          image_urls: {
            type: "array",
            maxItems: 20,
            items: { type: "string", format: "uri" },
            default: [],
          },
        },
        required: ["content"],
      },
      UpdatePostBody: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200, nullable: true },
          content: { type: "string", minLength: 1, maxLength: 4000 },
          image_urls: {
            type: "array",
            maxItems: 20,
            items: { type: "string", format: "uri" },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": jsonResponse("Backend is healthy", ref("HealthResponse")),
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register with email and password",
        requestBody: {
          required: true,
          content: jsonContent(ref("RegisterBody")),
        },
        responses: {
          "201": jsonResponse("Registered successfully", ref("AuthResult")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: jsonContent(ref("RegisterBody")),
        },
        responses: {
          "200": jsonResponse("Logged in successfully", ref("AuthResult")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Invalid credentials", ref("ErrorMessage")),
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": jsonResponse("Current user", ref("MeResponse")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
        },
      },
    },
    "/place-types": {
      get: {
        tags: ["Catalog"],
        summary: "List place types",
        responses: {
          "200": jsonResponse("Place types", ref("CatalogListResponse")),
        },
      },
    },
    "/seasons": {
      get: {
        tags: ["Catalog"],
        summary: "List seasons",
        responses: {
          "200": jsonResponse("Seasons", ref("CatalogListResponse")),
        },
      },
    },
    "/places": {
      get: {
        tags: ["Places"],
        summary: "List places",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          { name: "q", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "name", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "location", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "source_location", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "type", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "season", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "is_active", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": jsonResponse("Places list", ref("PlacesListResult")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
        },
      },
    },
    "/places/recommendations": {
      post: {
        tags: ["Places"],
        summary: "Get season-aware and radius-aware place recommendations",
        requestBody: {
          required: true,
          content: jsonContent(ref("PlaceRecommendationsRequest")),
        },
        responses: {
          "200": jsonResponse("Recommendations", ref("PlaceRecommendationsResult")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "404": jsonResponse("Anchor place or season not found", ref("ErrorMessage")),
        },
      },
    },
    "/places/{id}": {
      get: {
        tags: ["Places"],
        summary: "Get place by internal numeric id",
        parameters: [idPathParameter("id", "Internal place id from places.id")],
        responses: {
          "200": jsonResponse("Place detail", ref("PublicPlace")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
    },
    "/places/{id}/like": {
      post: {
        tags: ["Place interactions"],
        summary: "Like a place",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Internal place id from places.id")],
        responses: {
          "200": jsonResponse("Like applied", ref("LikeMutationResult")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
      delete: {
        tags: ["Place interactions"],
        summary: "Remove current user's like from a place",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Internal place id from places.id")],
        responses: {
          "200": jsonResponse("Like removed", ref("LikeMutationResult")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
    },
    "/places/{id}/likes": {
      get: {
        tags: ["Place interactions"],
        summary: "Get likes summary for a place",
        security: [{ bearerAuth: [] }, {}],
        parameters: [idPathParameter("id", "Internal place id from places.id")],
        responses: {
          "200": jsonResponse("Likes summary", ref("LikeSummary")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
    },
    "/places/{id}/comments": {
      get: {
        tags: ["Place interactions"],
        summary: "List comments for a place",
        parameters: [
          idPathParameter("id", "Internal place id from places.id"),
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": jsonResponse("Comments list", ref("PlaceCommentsListResult")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
      post: {
        tags: ["Place interactions"],
        summary: "Create a comment for a place",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Internal place id from places.id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateCommentBody")),
        },
        responses: {
          "201": jsonResponse("Comment created", ref("PublicPlaceComment")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Place not found", ref("ErrorMessage")),
        },
      },
    },
    "/route-build-sessions": {
      post: {
        tags: ["Route build sessions"],
        summary: "Start a route build session",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateRouteBuildSessionBody")),
        },
        responses: {
          "201": jsonResponse("Route build session created", ref("PublicRouteBuildSession")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Season or anchor place not found", ref("ErrorMessage")),
        },
      },
    },
    "/route-build-sessions/{id}/actions": {
      post: {
        tags: ["Route build sessions"],
        summary: "Append an accept/reject/save action to a route build session",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route build session id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("RouteBuildActionBody")),
        },
        responses: {
          "200": jsonResponse("Session updated", ref("PublicRouteBuildSession")),
          "400": jsonResponse("Validation failed or session is not active", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Session or place not found", ref("ErrorMessage")),
        },
      },
    },
    "/route-build-sessions/{id}/recommendations": {
      get: {
        tags: ["Route build sessions"],
        summary: "Get next candidate places for a route build session",
        security: [{ bearerAuth: [] }],
        parameters: [
          idPathParameter("id", "Route build session id"),
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 30 } },
          { name: "radius_km", in: "query", schema: { type: "number", minimum: 0.1, maximum: 500 } },
        ],
        responses: {
          "200": jsonResponse("Recommendations for session", ref("RouteBuildRecommendationsResult")),
          "400": jsonResponse("Validation failed or session is not active", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Session not found", ref("ErrorMessage")),
        },
      },
    },
    "/route-build-sessions/{id}/finalize": {
      post: {
        tags: ["Route build sessions"],
        summary: "Finalize a route build session into a stored route",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route build session id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("FinalizeRouteBuildSessionBody")),
        },
        responses: {
          "200": jsonResponse("Session finalized", ref("FinalizedRouteBuildResult")),
          "400": jsonResponse("Validation failed or no selected places", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Session not found", ref("ErrorMessage")),
        },
      },
    },
    "/routes/from-quiz": {
      post: {
        tags: ["Routes"],
        summary: "Create and store a route from quiz answers",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateRouteFromQuizBody")),
        },
        responses: {
          "201": jsonResponse("Route created from quiz", ref("PublicRouteDetail")),
          "400": jsonResponse("Validation failed or route could not be built", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Season not found", ref("ErrorMessage")),
        },
      },
    },
    "/routes": {
      get: {
        tags: ["Routes"],
        summary: "List routes for the current user",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "scope",
            in: "query",
            description:
              "Use `owned` to return only routes created by the current user. Default `accessible` keeps owned + shared access behavior.",
            schema: {
              type: "string",
              enum: ["accessible", "owned"],
              default: "accessible",
            },
          },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": jsonResponse("Routes list", ref("RouteListResult")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
        },
      },
      post: {
        tags: ["Routes"],
        summary: "Create a route manually or from selected places",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateRouteBody")),
        },
        responses: {
          "201": jsonResponse("Route created", ref("PublicRouteDetail")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Season or place not found", ref("ErrorMessage")),
        },
      },
    },
    "/routes/shared/{token}": {
      get: {
        tags: ["Routes"],
        summary: "Open a shared route by token",
        parameters: [tokenPathParameter],
        responses: {
          "200": jsonResponse("Shared route", ref("SharedRouteDetail")),
          "404": jsonResponse("Share link not found", ref("ErrorMessage")),
        },
      },
      patch: {
        tags: ["Routes"],
        summary: "Edit a shared route through an editable share token",
        parameters: [tokenPathParameter],
        requestBody: {
          required: true,
          content: jsonContent(ref("PatchSharedRouteBody")),
        },
        responses: {
          "200": jsonResponse("Shared route updated", ref("SharedRouteDetail")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "404": jsonResponse("Share link not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
    },
    "/routes/shared/{token}/access": {
      post: {
        tags: ["Routes"],
        summary: "Attach a shared route to the authenticated user's route list",
        description:
          "Creates or updates `route_access` for the current user on the same `routes` row as the share link. When the share allows editing (`can_edit=true`), access is `collaborator` so the user can call `/routes/{id}` mutations with the same optimistic `revision_number` rules as the owner. View-only shares attach as `viewer`.",
        security: [{ bearerAuth: [] }],
        parameters: [tokenPathParameter],
        responses: {
          "200": jsonResponse("Shared route attached", ref("PublicRouteDetail")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Share link not found", ref("ErrorMessage")),
        },
      },
    },
    "/routes/{id}": {
      get: {
        tags: ["Routes"],
        summary: "Get route detail",
        description:
          "Returns route detail for the owner or any user present in `route_access` (collaborator/viewer). Collaborators may edit via PATCH and `/routes/{id}/places` endpoints; all writes use `revision_number` and return 409 on stale revisions.",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route id")],
        responses: {
          "200": jsonResponse("Route detail", ref("PublicRouteDetail")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "404": jsonResponse("Route not found", ref("ErrorMessage")),
        },
      },
      patch: {
        tags: ["Routes"],
        summary: "Update route metadata with optimistic concurrency control",
        description:
          "Allowed for route owner and users with collaborator (or legacy shared-edit) access. Not allowed for viewers. Requires current `revision_number`; responds with 409 when the route changed since load.",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("UpdateRouteBody")),
        },
        responses: {
          "200": jsonResponse("Route updated", ref("PublicRouteDetail")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Route edit access is required", ref("ErrorMessage")),
          "404": jsonResponse("Route not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
      delete: {
        tags: ["Routes"],
        summary: "Delete a route",
        security: [{ bearerAuth: [] }],
        parameters: [
          idPathParameter("id", "Route id"),
          { name: "revision_number", in: "query", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "204": { description: "Route deleted" },
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Only the owner can delete the route", ref("ErrorMessage")),
          "404": jsonResponse("Route not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
    },
    "/routes/{id}/places": {
      post: {
        tags: ["Routes"],
        summary: "Add a place to a route",
        description:
          "Same authorization as route metadata updates: owner or collaborator with edit access. Bumps route `revision_number` when successful; 409 on revision mismatch.",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("AddRoutePlaceBody")),
        },
        responses: {
          "200": jsonResponse("Route updated", ref("PublicRouteDetail")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Route edit access is required", ref("ErrorMessage")),
          "404": jsonResponse("Route or place not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
    },
    "/routes/{id}/places/{routePlaceId}": {
      patch: {
        tags: ["Routes"],
        summary: "Update a route place entry",
        security: [{ bearerAuth: [] }],
        parameters: [
          idPathParameter("id", "Route id"),
          idPathParameter("routePlaceId", "Route place id"),
        ],
        requestBody: {
          required: true,
          content: jsonContent(ref("UpdateRoutePlaceBody")),
        },
        responses: {
          "200": jsonResponse("Route updated", ref("PublicRouteDetail")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Route edit access is required", ref("ErrorMessage")),
          "404": jsonResponse("Route or route place not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
      delete: {
        tags: ["Routes"],
        summary: "Delete a place from a route",
        security: [{ bearerAuth: [] }],
        parameters: [
          idPathParameter("id", "Route id"),
          idPathParameter("routePlaceId", "Route place id"),
          { name: "revision_number", in: "query", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "200": jsonResponse("Route updated", ref("PublicRouteDetail")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Route edit access is required", ref("ErrorMessage")),
          "404": jsonResponse("Route or route place not found", ref("ErrorMessage")),
          "409": jsonResponse("Route revision conflict", ref("ErrorMessage")),
        },
      },
    },
    "/routes/{id}/share": {
      post: {
        tags: ["Routes"],
        summary: "Create an editable or read-only share link for a route",
        description:
          "Requires edit access on the route (owner or collaborator). `can_edit` on the link controls whether recipients get collaborator vs viewer access when they call `POST /routes/shared/{token}/access`. Response includes `token` for building a frontend URL `/routes/shared/{token}`.",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Route id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateShareLinkBody")),
        },
        responses: {
          "201": jsonResponse("Share link created", ref("PublicRouteShareLink")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Route share access requires edit permissions", ref("ErrorMessage")),
          "404": jsonResponse("Route not found", ref("ErrorMessage")),
        },
      },
    },
    "/posts": {
      get: {
        tags: ["Posts"],
        summary: "List inspiration posts",
        description:
          "Use guide=true for guide posts, guide=false for regular user posts, or mine=true for the authenticated user's posts.",
        parameters: [
          { name: "guide", in: "query", schema: { type: "boolean" } },
          { name: "mine", in: "query", schema: { type: "boolean" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": jsonResponse("Posts list", ref("PostsListResult")),
          "401": jsonResponse("Authentication required for mine=true", ref("ErrorMessage")),
        },
      },
      post: {
        tags: ["Posts"],
        summary: "Create a post",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(ref("CreatePostBody")),
        },
        responses: {
          "201": jsonResponse("Post created", ref("PublicPost")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
        },
      },
    },
    "/posts/{id}": {
      get: {
        tags: ["Posts"],
        summary: "Get post detail",
        parameters: [idPathParameter("id", "Post id")],
        responses: {
          "200": jsonResponse("Post detail", ref("PublicPost")),
          "404": jsonResponse("Post not found", ref("ErrorMessage")),
        },
      },
      patch: {
        tags: ["Posts"],
        summary: "Update your own post",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Post id")],
        requestBody: {
          required: true,
          content: jsonContent(ref("UpdatePostBody")),
        },
        responses: {
          "200": jsonResponse("Post updated", ref("PublicPost")),
          "400": jsonResponse("Validation failed", ref("ValidationError")),
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Only the post owner can edit this post", ref("ErrorMessage")),
          "404": jsonResponse("Post not found", ref("ErrorMessage")),
        },
      },
      delete: {
        tags: ["Posts"],
        summary: "Delete your own post",
        security: [{ bearerAuth: [] }],
        parameters: [idPathParameter("id", "Post id")],
        responses: {
          "204": { description: "Post deleted" },
          "401": jsonResponse("Authentication required", ref("ErrorMessage")),
          "403": jsonResponse("Only the post owner can delete this post", ref("ErrorMessage")),
          "404": jsonResponse("Post not found", ref("ErrorMessage")),
        },
      },
    },
  },
} as const;
