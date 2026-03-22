import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  /** Полный URL `POST …/v1/quiz/route` (ML). Пустая строка = отключено (только rule-based). */
  ML_QUIZ_ROUTE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  ML_QUIZ_ROUTE_TIMEOUT_MS: z.coerce.number().int().min(3000).max(120_000).default(20_000),
});

export const env = envSchema.parse(process.env);
