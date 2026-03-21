import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import type { RoutesController } from "./routes.controller";

export const createRoutesRouter = (routesController: RoutesController) => {
  const router = Router();

  router.post("/from-quiz", requireAuth, routesController.createFromQuiz);
  router.get("/", requireAuth, routesController.list);
  router.post("/", requireAuth, routesController.create);
  router.get("/shared/:token", routesController.getSharedRoute);
  router.post("/shared/:token/access", requireAuth, routesController.attachSharedRoute);
  router.patch("/shared/:token", routesController.patchSharedRoute);
  router.get("/:id", requireAuth, routesController.detail);
  router.patch("/:id", requireAuth, routesController.update);
  router.delete("/:id", requireAuth, routesController.remove);
  router.post("/:id/places", requireAuth, routesController.addPlace);
  router.patch("/:id/places/:routePlaceId", requireAuth, routesController.updatePlace);
  router.delete("/:id/places/:routePlaceId", requireAuth, routesController.deletePlace);
  router.post("/:id/share", requireAuth, routesController.createShareLink);

  return router;
};
