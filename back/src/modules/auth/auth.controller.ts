import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/errors";
import type { AuthService } from "./auth.service";
import { loginSchema, registerSchema } from "./auth.schemas";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = asyncHandler(async (request: Request, response: Response) => {
    const payload = registerSchema.parse(request.body);
    const result = await this.authService.registerWithCredentials(payload);

    response.status(201).json(result);
  });

  login = asyncHandler(async (request: Request, response: Response) => {
    const payload = loginSchema.parse(request.body);
    const result = await this.authService.loginWithCredentials(payload);

    response.status(200).json(result);
  });

  me = asyncHandler(async (request: Request, response: Response) => {
    const userId = request.auth?.userId;
    const user = await this.authService.getCurrentUser(userId!);

    response.status(200).json({ user });
  });
}
