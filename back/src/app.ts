import express from "express";
import swaggerUi from "swagger-ui-express";

import { errorHandler, notFoundHandler } from "./lib/errors";
import { authRouter } from "./modules/auth/auth.module";
import { healthRouter } from "./modules/health/health.routes";
import { placeInteractionsRouter } from "./modules/place-interactions/place-interactions.module";
import { placesRouter } from "./modules/places/places.module";
import { openApiSpec } from "./swagger/openapi-spec";

export const createApp = () => {
  const app = express();

  app.use((request, response, next) => {
    const requestedHeaders = request.header("Access-Control-Request-Headers");

    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    response.header(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Content-Type, Authorization",
    );
    response.header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json());
  app.get("/openapi.json", (_request, response) => {
    response.status(200).json(openApiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/places", placesRouter);
  app.use("/places", placeInteractionsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
