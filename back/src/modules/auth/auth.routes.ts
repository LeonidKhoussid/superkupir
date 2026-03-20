import { Router } from "express";

import type { AuthController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";

export const createAuthRouter = (authController: AuthController) => {
  const router = Router();

  router.post("/register", authController.register);
  router.post("/login", authController.login);
  router.get("/me", requireAuth, authController.me);

  return router;
};
