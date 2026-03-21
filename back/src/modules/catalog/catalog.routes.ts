import { Router } from "express";

import type { CatalogController } from "./catalog.controller";

export const createCatalogRouter = (catalogController: CatalogController) => {
  const router = Router();

  router.get("/place-types", catalogController.listPlaceTypes);
  router.get("/seasons", catalogController.listSeasons);

  return router;
};
