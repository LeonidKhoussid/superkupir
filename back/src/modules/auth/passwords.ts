import bcrypt from "bcryptjs";

import { env } from "../../config/env";

export const hashPassword = async (password: string) =>
  bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = async (password: string, passwordHash: string) =>
  bcrypt.compare(password, passwordHash);
