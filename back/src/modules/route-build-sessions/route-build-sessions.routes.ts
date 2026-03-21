import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import type { RouteBuildSessionsController } from "./route-build-sessions.controller";

export const createRouteBuildSessionsRouter = (
  routeBuildSessionsController: RouteBuildSessionsController,
) => {
  const router = Router();

  router.post("/", requireAuth, routeBuildSessionsController.create);
  router.post("/:id/actions", requireAuth, routeBuildSessionsController.appendAction);
  router.get("/:id/recommendations", requireAuth, routeBuildSessionsController.recommendations);
  router.post("/:id/finalize", requireAuth, routeBuildSessionsController.finalize);

  return router;
};
