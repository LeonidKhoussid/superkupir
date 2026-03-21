import { Router } from "express";

import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import type { PlaceInteractionsController } from "./place-interactions.controller";

export const createPlaceInteractionsRouter = (
  placeInteractionsController: PlaceInteractionsController,
) => {
  const router = Router();

  router.post("/:id/like", requireAuth, placeInteractionsController.like);
  router.delete("/:id/like", requireAuth, placeInteractionsController.unlike);
  router.get("/:id/likes", optionalAuth, placeInteractionsController.likesSummary);
  router.get("/:id/comments", placeInteractionsController.listComments);
  router.post("/:id/comments", requireAuth, placeInteractionsController.createComment);

  return router;
};
