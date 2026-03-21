import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type {
  CommentListInput,
  LikeSummary,
  PlaceCommentRecord,
} from "./place-interactions.types";

interface PlaceExistsRow extends QueryResultRow {
  exists: boolean;
}

interface LikesSummaryRow extends QueryResultRow {
  likes_count: number;
  liked_by_current_user: boolean | null;
}

interface CommentRow extends QueryResultRow {
  id: number;
  place_id: number;
  user_id: string;
  email: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

interface TotalRow extends QueryResultRow {
  total: number;
}

const mapComment = (row: CommentRow): PlaceCommentRecord => ({
  id: row.id,
  placeId: row.place_id,
  user: {
    id: row.user_id,
    email: row.email,
  },
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PlaceInteractionsRepository {
  async placeExists(placeId: number): Promise<boolean> {
    const result = await pool.query<PlaceExistsRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM wineries
          WHERE id = $1
        ) AS exists
      `,
      [placeId],
    );

    return result.rows[0]?.exists ?? false;
  }

  async likePlace(placeId: number, userId: string): Promise<void> {
    await pool.query(
      `
        INSERT INTO place_likes (place_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (place_id, user_id) DO NOTHING
      `,
      [placeId, userId],
    );
  }

  async unlikePlace(placeId: number, userId: string): Promise<void> {
    await pool.query(
      `
        DELETE FROM place_likes
        WHERE place_id = $1
          AND user_id = $2
      `,
      [placeId, userId],
    );
  }

  async getLikeSummary(placeId: number, userId?: string): Promise<LikeSummary> {
    if (userId) {
      const result = await pool.query<LikesSummaryRow>(
        `
          SELECT
            COUNT(*)::int AS likes_count,
            COALESCE(BOOL_OR(user_id = $2), FALSE) AS liked_by_current_user
          FROM place_likes
          WHERE place_id = $1
        `,
        [placeId, userId],
      );

      const row = result.rows[0];

      return {
        place_id: placeId,
        likes_count: row?.likes_count ?? 0,
        liked_by_current_user: row?.liked_by_current_user ?? false,
      };
    }

    const result = await pool.query<LikesSummaryRow>(
      `
        SELECT
          COUNT(*)::int AS likes_count,
          NULL::boolean AS liked_by_current_user
        FROM place_likes
        WHERE place_id = $1
      `,
      [placeId],
    );

    const row = result.rows[0];

    return {
      place_id: placeId,
      likes_count: row?.likes_count ?? 0,
      liked_by_current_user: null,
    };
  }

  async createComment(placeId: number, userId: string, content: string): Promise<PlaceCommentRecord> {
    const result = await pool.query<CommentRow>(
      `
        WITH inserted_comment AS (
          INSERT INTO place_comments (place_id, user_id, content)
          VALUES ($1, $2, $3)
          RETURNING id, place_id, user_id, content, created_at, updated_at
        )
        SELECT
          inserted_comment.id,
          inserted_comment.place_id,
          inserted_comment.user_id,
          auth_users.email,
          inserted_comment.content,
          inserted_comment.created_at,
          inserted_comment.updated_at
        FROM inserted_comment
        INNER JOIN auth_users
          ON auth_users.id = inserted_comment.user_id
      `,
      [placeId, userId, content],
    );

    return mapComment(result.rows[0]);
  }

  async listComments(
    placeId: number,
    pagination: CommentListInput,
  ): Promise<{ items: PlaceCommentRecord[]; total: number }> {
    const totalResult = await pool.query<TotalRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM place_comments
        WHERE place_id = $1
      `,
      [placeId],
    );

    const result = await pool.query<CommentRow>(
      `
        SELECT
          place_comments.id,
          place_comments.place_id,
          place_comments.user_id,
          auth_users.email,
          place_comments.content,
          place_comments.created_at,
          place_comments.updated_at
        FROM place_comments
        INNER JOIN auth_users
          ON auth_users.id = place_comments.user_id
        WHERE place_comments.place_id = $1
        ORDER BY place_comments.created_at DESC, place_comments.id DESC
        LIMIT $2
        OFFSET $3
      `,
      [placeId, pagination.limit, pagination.offset],
    );

    return {
      items: result.rows.map(mapComment),
      total: totalResult.rows[0]?.total ?? 0,
    };
  }
}
