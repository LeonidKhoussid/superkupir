import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/errors";
import { verifyAccessToken } from "./token";

export const requireAuth = (request: Request, _response: Response, next: NextFunction) => {
  const authorizationHeader = request.header("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  const payload = verifyAccessToken(token);

  request.auth = {
    userId: payload.sub,
    provider: payload.provider,
  };

  next();
};
