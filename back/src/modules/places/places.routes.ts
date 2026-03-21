import { Router } from "express";

import type { PlacesController } from "./places.controller";

export const createPlacesRouter = (placesController: PlacesController) => {
  const router = Router();

  router.get("/", placesController.list);
  router.post("/recommendations", placesController.recommend);
  router.get("/:id", placesController.detail);

  return router;
};
