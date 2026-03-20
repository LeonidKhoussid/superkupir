import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type { AuthUserRecord } from "./auth.types";

interface AuthUserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

const mapAuthUser = (row: AuthUserRow): AuthUserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class AuthRepository {
  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const result = await pool.query<AuthUserRow>(
      `
        SELECT id, email, password_hash, created_at, updated_at
        FROM auth_users
        WHERE email = $1
      `,
      [email],
    );

    return result.rows[0] ? mapAuthUser(result.rows[0]) : null;
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const result = await pool.query<AuthUserRow>(
      `
        SELECT id, email, password_hash, created_at, updated_at
        FROM auth_users
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapAuthUser(result.rows[0]) : null;
  }

  async createCredentialsUser(email: string, passwordHash: string): Promise<AuthUserRecord> {
    const result = await pool.query<AuthUserRow>(
      `
        INSERT INTO auth_users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, password_hash, created_at, updated_at
      `,
      [email, passwordHash],
    );

    return mapAuthUser(result.rows[0]);
  }
}
