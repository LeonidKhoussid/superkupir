import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type { PostRecord } from "./posts.types";

interface PostRow extends QueryResultRow {
  id: number;
  author_id: string;
  author_email: string;
  author_is_guide: boolean;
  title: string | null;
  content: string;
  image_urls: unknown;
  created_at: Date;
  updated_at: Date;
}

interface TotalRow extends QueryResultRow {
  total: number;
}

const normalizeImageUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const mapPost = (row: PostRow): PostRecord => ({
  id: row.id,
  author: {
    id: row.author_id,
    email: row.author_email,
    isGuide: row.author_is_guide,
  },
  title: row.title,
  content: row.content,
  imageUrls: normalizeImageUrls(row.image_urls),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const baseSelect = `
  SELECT
    posts.id,
    auth_users.id AS author_id,
    auth_users.email AS author_email,
    auth_users.is_guide AS author_is_guide,
    posts.title,
    posts.content,
    posts.image_urls,
    posts.created_at,
    posts.updated_at
  FROM posts
  INNER JOIN auth_users ON auth_users.id = posts.user_id
`;

export class PostsRepository {
  async list(input: {
    guide?: boolean;
    mine?: boolean;
    userId?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: PostRecord[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (typeof input.guide === "boolean") {
      values.push(input.guide);
      conditions.push(`auth_users.is_guide = $${values.length}`);
    }

    if (input.mine) {
      values.push(input.userId);
      conditions.push(`posts.user_id = $${values.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const totalResult = await pool.query<TotalRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM posts
        INNER JOIN auth_users ON auth_users.id = posts.user_id
        ${whereSql}
      `,
      values,
    );

    values.push(input.limit);
    values.push(input.offset);

    const result = await pool.query<PostRow>(
      `
        ${baseSelect}
        ${whereSql}
        ORDER BY posts.created_at DESC, posts.id DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
      values,
    );

    return {
      items: result.rows.map(mapPost),
      total: totalResult.rows[0]?.total ?? 0,
    };
  }

  async findById(id: number): Promise<PostRecord | null> {
    const result = await pool.query<PostRow>(
      `
        ${baseSelect}
        WHERE posts.id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  async create(input: {
    userId: string;
    title: string | null;
    content: string;
    imageUrls: string[];
  }): Promise<PostRecord> {
    const result = await pool.query<PostRow>(
      `
        WITH inserted_post AS (
          INSERT INTO posts (user_id, title, content, image_urls)
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING id, user_id, title, content, image_urls, created_at, updated_at
        )
        SELECT
          inserted_post.id,
          auth_users.id AS author_id,
          auth_users.email AS author_email,
          auth_users.is_guide AS author_is_guide,
          inserted_post.title,
          inserted_post.content,
          inserted_post.image_urls,
          inserted_post.created_at,
          inserted_post.updated_at
        FROM inserted_post
        INNER JOIN auth_users ON auth_users.id = inserted_post.user_id
      `,
      [input.userId, input.title, input.content, JSON.stringify(input.imageUrls)],
    );

    return mapPost(result.rows[0]);
  }

  async update(
    id: number,
    input: { title?: string | null; content?: string; imageUrls?: string[] },
  ): Promise<void> {
    const values: unknown[] = [id];
    const assignments: string[] = [];

    if (input.title !== undefined) {
      values.push(input.title);
      assignments.push(`title = $${values.length}`);
    }

    if (input.content !== undefined) {
      values.push(input.content);
      assignments.push(`content = $${values.length}`);
    }

    if (input.imageUrls !== undefined) {
      values.push(JSON.stringify(input.imageUrls));
      assignments.push(`image_urls = $${values.length}::jsonb`);
    }

    assignments.push("updated_at = NOW()");

    await pool.query(
      `
        UPDATE posts
        SET ${assignments.join(", ")}
        WHERE id = $1
      `,
      values,
    );
  }

  async delete(id: number): Promise<void> {
    await pool.query(
      `
        DELETE FROM posts
        WHERE id = $1
      `,
      [id],
    );
  }
}
