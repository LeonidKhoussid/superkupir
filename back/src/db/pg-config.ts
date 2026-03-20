import dotenv from "dotenv";
import type { ClientConfig } from "pg";

dotenv.config({ quiet: true });

export const createPgClientConfig = (): ClientConfig => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return { connectionString };
};
