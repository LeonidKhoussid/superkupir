import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type {
  RouteBuildActionType,
  RouteBuildSessionRecord,
  RouteBuildSourceMode,
} from "./route-build-sessions.types";

interface RouteBuildSessionRow extends QueryResultRow {
  id: number;
  user_id: string | null;
  season_id: number;
  season_slug: string;
  source_mode: RouteBuildSourceMode;
  anchor_place_id: number | null;
  status: "active" | "completed" | "cancelled";
  accepted_count: number;
  rejected_count: number;
  saved_count: number;
  created_at: Date;
  updated_at: Date;
}

const sessionSummarySelect = `
  SELECT
    route_build_sessions.id,
    route_build_sessions.user_id,
    route_build_sessions.season_id,
    seasons.slug AS season_slug,
    route_build_sessions.source_mode,
    route_build_sessions.anchor_place_id,
    route_build_sessions.status,
    COUNT(*) FILTER (WHERE route_build_session_places.action_type = 'accepted')::int AS accepted_count,
    COUNT(*) FILTER (WHERE route_build_session_places.action_type = 'rejected')::int AS rejected_count,
    COUNT(*) FILTER (WHERE route_build_session_places.action_type = 'saved')::int AS saved_count,
    route_build_sessions.created_at,
    route_build_sessions.updated_at
  FROM route_build_sessions
  INNER JOIN seasons ON seasons.id = route_build_sessions.season_id
  LEFT JOIN route_build_session_places
    ON route_build_session_places.session_id = route_build_sessions.id
`;

const mapSession = (row: RouteBuildSessionRow): RouteBuildSessionRecord => ({
  id: row.id,
  userId: row.user_id,
  seasonId: row.season_id,
  seasonSlug: row.season_slug,
  sourceMode: row.source_mode,
  anchorPlaceId: row.anchor_place_id,
  status: row.status,
  acceptedCount: row.accepted_count,
  rejectedCount: row.rejected_count,
  savedCount: row.saved_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class RouteBuildSessionsRepository {
  async createSession(input: {
    userId: string;
    seasonId: number;
    sourceMode: RouteBuildSourceMode;
    anchorPlaceId: number | null;
  }): Promise<RouteBuildSessionRecord> {
    const result = await pool.query<RouteBuildSessionRow>(
      `
        WITH inserted_session AS (
          INSERT INTO route_build_sessions (user_id, season_id, source_mode, anchor_place_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        )
        ${sessionSummarySelect}
        INNER JOIN inserted_session
          ON inserted_session.id = route_build_sessions.id
        GROUP BY route_build_sessions.id, seasons.id
      `,
      [input.userId, input.seasonId, input.sourceMode, input.anchorPlaceId],
    );

    return mapSession(result.rows[0]);
  }

  async findOwnedSession(sessionId: number, userId: string): Promise<RouteBuildSessionRecord | null> {
    const result = await pool.query<RouteBuildSessionRow>(
      `
        ${sessionSummarySelect}
        WHERE route_build_sessions.id = $1
          AND route_build_sessions.user_id = $2
        GROUP BY route_build_sessions.id, seasons.id
      `,
      [sessionId, userId],
    );

    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async appendAction(
    sessionId: number,
    action: { placeId: number; actionType: RouteBuildActionType },
  ): Promise<void> {
    await pool.query(
      `
        INSERT INTO route_build_session_places (session_id, place_id, action_type)
        VALUES ($1, $2, $3)
      `,
      [sessionId, action.placeId, action.actionType],
    );

    if (action.actionType === "accepted" || action.actionType === "saved") {
      await pool.query(
        `
          UPDATE route_build_sessions
          SET anchor_place_id = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [sessionId, action.placeId],
      );
    }
  }

  async listSeenPlaceIds(sessionId: number): Promise<number[]> {
    const result = await pool.query<{ place_id: number }>(
      `
        SELECT DISTINCT place_id
        FROM route_build_session_places
        WHERE session_id = $1
      `,
      [sessionId],
    );

    return result.rows.map((row) => row.place_id);
  }

  async listSelectedPlaceIds(sessionId: number): Promise<number[]> {
    const result = await pool.query<{ place_id: number }>(
      `
        SELECT place_id
        FROM route_build_session_places
        WHERE session_id = $1
          AND action_type IN ('accepted', 'saved')
        ORDER BY created_at ASC, id ASC
      `,
      [sessionId],
    );

    return result.rows.map((row) => row.place_id);
  }

  async markCompleted(sessionId: number): Promise<void> {
    await pool.query(
      `
        UPDATE route_build_sessions
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );
  }
}
