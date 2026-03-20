import { Pool } from "pg";

import { createPgClientConfig } from "./pg-config";

export const pool = new Pool(createPgClientConfig());

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
