import fs from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { createPgClientConfig } from "../db/pg-config";

const parseArgs = () => {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes("--dry-run"),
    sqlPathArg: args.find((arg) => !arg.startsWith("--")),
  };
};

const main = async () => {
  const { dryRun, sqlPathArg } = parseArgs();
  const sqlPath = path.resolve(process.cwd(), sqlPathArg ?? "sql/create_auth_tables.sql");
  const sql = await fs.readFile(sqlPath, "utf8");

  if (dryRun) {
    console.log(`Dry run OK: loaded ${sqlPath} (${Buffer.byteLength(sql)} bytes)`);
    return;
  }

  const client = new Client(createPgClientConfig());

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Applied SQL from ${sqlPath}`);
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to apply SQL: ${message}`);
  process.exitCode = 1;
});
