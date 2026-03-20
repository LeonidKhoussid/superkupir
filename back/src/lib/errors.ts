import type { NextFunction, Request, Response } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const asyncHandler =
  <TRequest extends Request = Request>(
    handler: (
      request: TRequest,
      response: Response,
      next: NextFunction,
    ) => Promise<unknown>,
  ) =>
  (request: TRequest, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };

export const notFoundHandler = (_request: Request, _response: Response, next: NextFunction) => {
  next(new AppError(404, "Route not found"));
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
    response.status(401).json({
      error: "Invalid or expired token",
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  console.error("Unhandled backend error", error);

  response.status(500).json({
    error: "Internal server error",
  });
};
