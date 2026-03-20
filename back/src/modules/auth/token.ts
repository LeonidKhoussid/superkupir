import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../../config/env";
import type { AuthTokenPayload, AuthUserRecord } from "./auth.types";

export const signAccessToken = (user: AuthUserRecord) =>
  jwt.sign(
    {
      email: user.email,
      provider: "credentials",
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
      subject: user.id,
    },
  );

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
