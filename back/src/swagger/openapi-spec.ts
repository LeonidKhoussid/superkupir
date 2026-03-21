import { env } from "../config/env";

/** OpenAPI 3.0 document for Superkiper backend (kept in sync with routes manually). */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Superkiper API",
    version: "0.1.0",
    description: "HTTP API для веб-клиента Superkiper: аутентификация, места, лайки и комментарии.",
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: "Текущий процесс (PORT из .env)" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Places" },
    { name: "Place interactions" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Токен из POST /auth/login или POST /auth/register",
      },
    },
    schemas: {
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
            },
          },
        },
      },
      PublicAuthUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
        },
        required: ["id", "email"],
      },
      AuthResult: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/PublicAuthUser" },
          token: { type: "string" },
        },
        required: ["user", "token"],
      },
      RegisterBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 320 },
          password: { type: "string", minLength: 8, maxLength: 72 },
        },
      },
      MeResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/PublicAuthUser" },
        },
        required: ["user"],
      },
      PublicPlace: {
        type: "object",
        properties: {
          id: { type: "integer" },
          external_id: { type: "string" },
          name: { type: "string" },
          source_location: { type: "string", nullable: true },
          card_url: { type: "string", nullable: true },
          logo_url: { type: "string", nullable: true },
          size: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          photo_urls: { type: "array", items: { type: "string" } },
          lat: { type: "number", nullable: true },
          lon: { type: "number", nullable: true },
          coordinates_raw: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
        },
        required: ["id", "external_id", "name", "photo_urls"],
      },
      PlacesListResult: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/PublicPlace" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
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
          id: { type: "string" },
          email: { type: "string", format: "email" },
        },
        required: ["id", "email"],
      },
      PublicPlaceComment: {
        type: "object",
        properties: {
          id: { type: "integer" },
          place_id: { type: "integer" },
          user: { $ref: "#/components/schemas/CommentAuthor" },
          content: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "place_id", "user", "content", "created_at", "updated_at"],
      },
      PlaceCommentsListResult: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/PublicPlaceComment" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
      },
      CreateCommentBody: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 1000 },
        },
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
      ErrorMessage: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: {},
        },
        required: ["error"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Проверка живости сервиса",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Регистрация по email и паролю",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } },
          },
        },
        responses: {
          "201": {
            description: "Пользователь создан",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } } },
          },
          "400": {
            description: "Ошибка валидации",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Вход",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } },
          },
        },
        responses: {
          "200": {
            description: "Успешный вход",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } } },
          },
          "400": {
            description: "Ошибка валидации",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Текущий пользователь",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MeResponse" } } },
          },
          "401": {
            description: "Нет или невалидный токен",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } },
          },
        },
      },
    },
    "/places": {
      get: {
        tags: ["Places"],
        summary: "Список мест",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          { name: "q", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "name", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "location", in: "query", schema: { type: "string", maxLength: 255 } },
          { name: "source_location", in: "query", schema: { type: "string", maxLength: 255 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlacesListResult" } } },
          },
          "400": {
            description: "Ошибка валидации query",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
        },
      },
    },
    "/places/{id}": {
      get: {
        tags: ["Places"],
        summary: "Карточка места",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicPlace" } } },
          },
          "400": {
            description: "Некорректный id",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "404": {
            description: "Место не найдено",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorMessage" } } },
          },
        },
      },
    },
    "/places/{id}/like": {
      post: {
        tags: ["Place interactions"],
        summary: "Поставить лайк",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LikeMutationResult" } } },
          },
          "401": { description: "Не авторизован" },
          "404": { description: "Место не найдено" },
        },
      },
      delete: {
        tags: ["Place interactions"],
        summary: "Убрать лайк",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LikeMutationResult" } } },
          },
          "401": { description: "Не авторизован" },
          "404": { description: "Место не найдено" },
        },
      },
    },
    "/places/{id}/likes": {
      get: {
        tags: ["Place interactions"],
        summary: "Сводка по лайкам (Bearer опционален — для liked_by_current_user)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LikeSummary" } } },
          },
          "404": { description: "Место не найдено" },
        },
      },
    },
    "/places/{id}/comments": {
      get: {
        tags: ["Place interactions"],
        summary: "Комментарии к месту",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PlaceCommentsListResult" } },
            },
          },
          "400": {
            description: "Ошибка валидации",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "404": { description: "Место не найдено" },
        },
      },
      post: {
        tags: ["Place interactions"],
        summary: "Добавить комментарий",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateCommentBody" } },
          },
        },
        responses: {
          "201": {
            description: "Создано",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicPlaceComment" } } },
          },
          "400": {
            description: "Ошибка валидации",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "401": { description: "Не авторизован" },
          "404": { description: "Место не найдено" },
        },
      },
    },
  },
} as const;
