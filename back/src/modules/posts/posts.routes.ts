import { Router } from "express";

import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import type { PostsController } from "./posts.controller";

export const createPostsRouter = (postsController: PostsController) => {
  const router = Router();

  router.get("/", optionalAuth, postsController.list);
  router.get("/:id", postsController.detail);
  router.post("/", requireAuth, postsController.create);
  router.patch("/:id", requireAuth, postsController.update);
  router.delete("/:id", requireAuth, postsController.remove);

  return router;
};
