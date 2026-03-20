import express from "express";

import { errorHandler, notFoundHandler } from "./lib/errors";
import { authRouter } from "./modules/auth/auth.module";
import { healthRouter } from "./modules/health/health.routes";

export const createApp = () => {
  const app = express();

  app.use((request, response, next) => {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
