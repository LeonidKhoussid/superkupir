import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/errors";
import { verifyAccessToken } from "./token";

const applyAuthFromHeader = (request: Request) => {
  const authorizationHeader = request.header("authorization");

  if (!authorizationHeader) {
    return false;
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new AppError(401, "Authentication required");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError(401, "Authentication required");
  }

  const payload = verifyAccessToken(token);

  request.auth = {
    userId: payload.sub,
    provider: payload.provider,
  };

  return true;
};

export const requireAuth = (request: Request, _response: Response, next: NextFunction) => {
  try {
    const authenticated = applyAuthFromHeader(request);

    if (!authenticated) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (request: Request, _response: Response, next: NextFunction) => {
  try {
    applyAuthFromHeader(request);
    next();
  } catch (error) {
    next(error);
  }
};
