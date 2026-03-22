import crypto from "node:crypto";

import type { PoolClient, QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import { withTransaction } from "../../db/with-transaction";
import type { PublicPlace } from "../places/places.types";
import type { RoutePlaceInput } from "./routes.schemas";
import type {
  RouteAccessType,
  RouteDetailRecord,
  RouteOwnerRecord,
  RoutePlaceRecord,
  RouteShareLinkRecord,
  RouteSummaryRecord,
} from "./routes.types";

interface RouteSummaryRow extends QueryResultRow {
  id: number;
  owner_user_id: string;
  owner_email: string;
  owner_is_guide: boolean;
  title: string;
  description: string | null;
  creation_mode: RouteSummaryRecord["creationMode"];
  season_id: number | null;
  season_slug: string | null;
  total_estimated_cost: string | number | null;
  total_estimated_duration_minutes: number | null;
  revision_number: number;
  access_type: RouteAccessType;
  place_count: number;
  created_at: Date;
  updated_at: Date;
}

interface RoutePlaceRow extends QueryResultRow {
  route_place_id: number;
  route_id: number;
  place_id: number;
  sort_order: number;
  day_number: number | null;
  estimated_travel_minutes_from_previous: number | null;
  estimated_distance_km_from_previous: string | number | null;
  stay_duration_minutes: number | null;
  route_place_created_at: Date;
  route_place_updated_at: Date;
  name: string;
  source_location: string | null;
  card_url: string | null;
  logo_url: string | null;
  size: string | null;
  description: string | null;
  short_description: string | null;
  photo_urls: unknown;
  latitude: number | null;
  longitude: number | null;
  coordinates_raw: string | null;
  address: string | null;
  type_slug: string | null;
  season_slugs: unknown;
  estimated_cost: string | number | null;
  estimated_duration_minutes: number | null;
  radius_group: string | null;
  is_active: boolean;
}

interface RouteAccessRow extends QueryResultRow {
  route_id: number;
  owner_user_id: string;
  revision_number: number;
  access_type: RouteAccessType;
}

interface RoutePlaceOrderRow extends QueryResultRow {
  sort_order: number;
}

interface ShareLinkRow extends QueryResultRow {
  id: number;
  route_id: number;
  token: string;
  can_edit: boolean;
  expires_at: Date | null;
  created_at: Date;
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const normalizeNumber = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mapOwner = (row: RouteSummaryRow): RouteOwnerRecord => ({
  id: row.owner_user_id,
  email: row.owner_email,
  isGuide: row.owner_is_guide,
});

const mapRouteSummary = (row: RouteSummaryRow): RouteSummaryRecord => ({
  id: row.id,
  owner: mapOwner(row),
  title: row.title,
  description: row.description,
  creationMode: row.creation_mode,
  seasonId: row.season_id,
  seasonSlug: row.season_slug,
  totalEstimatedCost: normalizeNumber(row.total_estimated_cost),
  totalEstimatedDurationMinutes: row.total_estimated_duration_minutes,
  revisionNumber: row.revision_number,
  accessType: row.access_type,
  placeCount: row.place_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPublicPlace = (row: RoutePlaceRow): PublicPlace => ({
  id: row.place_id,
  name: row.name,
  source_location: row.source_location,
  card_url: row.card_url,
  logo_url: row.logo_url,
  size: row.size,
  description: row.description,
  short_description: row.short_description,
  photo_urls: normalizeStringArray(row.photo_urls),
  lat: row.latitude,
  lon: row.longitude,
  coordinates_raw: row.coordinates_raw,
  address: row.address,
  type_slug: row.type_slug,
  season_slugs: normalizeStringArray(row.season_slugs),
  estimated_cost: normalizeNumber(row.estimated_cost),
  estimated_duration_minutes: row.estimated_duration_minutes,
  radius_group: row.radius_group,
  is_active: row.is_active,
});

const mapRoutePlace = (row: RoutePlaceRow): RoutePlaceRecord => ({
  id: row.route_place_id,
  routeId: row.route_id,
  placeId: row.place_id,
  sortOrder: row.sort_order,
  dayNumber: row.day_number,
  estimatedTravelMinutesFromPrevious: row.estimated_travel_minutes_from_previous,
  estimatedDistanceKmFromPrevious: normalizeNumber(row.estimated_distance_km_from_previous),
  stayDurationMinutes: row.stay_duration_minutes,
  createdAt: row.route_place_created_at,
  updatedAt: row.route_place_updated_at,
  place: mapPublicPlace(row),
});

const mapShareLink = (row: ShareLinkRow): RouteShareLinkRecord => ({
  id: row.id,
  routeId: row.route_id,
  token: row.token,
  canEdit: row.can_edit,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

const buildRouteSummarySelect = (accessSql: string) => `
  SELECT
    routes.id,
    routes.owner_user_id,
    auth_users.email AS owner_email,
    auth_users.is_guide AS owner_is_guide,
    routes.title,
    routes.description,
    routes.creation_mode,
    routes.season_id,
    seasons.slug AS season_slug,
    routes.total_estimated_cost,
    routes.total_estimated_duration_minutes,
    routes.revision_number,
    ${accessSql} AS access_type,
    COUNT(route_places.id)::int AS place_count,
    routes.created_at,
    routes.updated_at
  FROM routes
  INNER JOIN auth_users ON auth_users.id = routes.owner_user_id
  LEFT JOIN seasons ON seasons.id = routes.season_id
  LEFT JOIN route_places ON route_places.route_id = routes.id
`;

const routePlacesSelect = `
  SELECT
    route_places.id AS route_place_id,
    route_places.route_id,
    route_places.place_id,
    route_places.sort_order,
    route_places.day_number,
    route_places.estimated_travel_minutes_from_previous,
    route_places.estimated_distance_km_from_previous,
    route_places.stay_duration_minutes,
    route_places.created_at AS route_place_created_at,
    route_places.updated_at AS route_place_updated_at,
    places.name,
    places.source_location,
    places.card_url,
    places.logo_url,
    places.size,
    places.description,
    places.short_description,
    places.photo_urls,
    places.latitude,
    places.longitude,
    places.coordinates_raw,
    places.address,
    place_types.slug AS type_slug,
    COALESCE(
      (
        SELECT ARRAY_AGG(seasons.slug ORDER BY seasons.slug)
        FROM place_seasons
        INNER JOIN seasons ON seasons.id = place_seasons.season_id
        WHERE place_seasons.place_id = places.id
      ),
      ARRAY[]::text[]
    ) AS season_slugs,
    places.estimated_cost,
    places.estimated_duration_minutes,
    places.radius_group,
    places.is_active
  FROM route_places
  INNER JOIN places ON places.id = route_places.place_id
  INNER JOIN place_types ON place_types.id = places.type_id
  WHERE route_places.route_id = $1
  ORDER BY route_places.sort_order ASC, route_places.id ASC
`;

type Queryable = Pick<PoolClient, "query"> | typeof pool;

export class RoutesRepository {
  async listAccessibleRoutes(
    userId: string,
    pagination: { scope: "accessible" | "owned"; limit: number; offset: number },
  ): Promise<RouteSummaryRecord[]> {
    const result =
      pagination.scope === "owned"
        ? await pool.query<RouteSummaryRow>(
            `
              ${buildRouteSummarySelect("'owner'")}
              WHERE routes.owner_user_id = $1
              GROUP BY routes.id, auth_users.id, seasons.id
              ORDER BY routes.updated_at DESC, routes.id DESC
              LIMIT $2
              OFFSET $3
            `,
            [userId, pagination.limit, pagination.offset],
          )
        : await pool.query<RouteSummaryRow>(
            `
              ${buildRouteSummarySelect(
                "CASE WHEN routes.owner_user_id = $1 THEN 'owner' ELSE route_access.access_type END",
              )}
              LEFT JOIN route_access
                ON route_access.route_id = routes.id
               AND route_access.user_id = $1
              WHERE routes.owner_user_id = $1
                 OR route_access.user_id = $1
              GROUP BY
                routes.id,
                auth_users.id,
                seasons.id,
                route_access.access_type
              ORDER BY routes.updated_at DESC, routes.id DESC
              LIMIT $2
              OFFSET $3
            `,
            [userId, pagination.limit, pagination.offset],
          );

    return result.rows.map(mapRouteSummary);
  }

  async findAccessibleRouteSummary(routeId: number, userId: string): Promise<RouteSummaryRecord | null> {
    const result = await pool.query<RouteSummaryRow>(
      `
        ${buildRouteSummarySelect(
          "CASE WHEN routes.owner_user_id = $2 THEN 'owner' ELSE route_access.access_type END",
        )}
        LEFT JOIN route_access
          ON route_access.route_id = routes.id
         AND route_access.user_id = $2
        WHERE routes.id = $1
          AND (routes.owner_user_id = $2 OR route_access.user_id = $2)
        GROUP BY
          routes.id,
          auth_users.id,
          seasons.id,
          route_access.access_type
      `,
      [routeId, userId],
    );

    return result.rows[0] ? mapRouteSummary(result.rows[0]) : null;
  }

  async findAccessibleRouteDetail(routeId: number, userId: string): Promise<RouteDetailRecord | null> {
    const summary = await this.findAccessibleRouteSummary(routeId, userId);

    if (!summary) {
      return null;
    }

    const routePlaces = await pool.query<RoutePlaceRow>(routePlacesSelect, [routeId]);

    return {
      ...summary,
      places: routePlaces.rows.map(mapRoutePlace),
    };
  }

  async findSharedRouteDetail(token: string): Promise<(RouteDetailRecord & { canEdit: boolean }) | null> {
    const shareLink = await this.findShareLink(pool, token);

    if (!shareLink) {
      return null;
    }

    const summaryResult = await pool.query<RouteSummaryRow>(
      `
        ${buildRouteSummarySelect(shareLink.can_edit ? "'collaborator'" : "'viewer'")}
        WHERE routes.id = $1
        GROUP BY routes.id, auth_users.id, seasons.id
      `,
      [shareLink.route_id],
    );

    const row = summaryResult.rows[0];

    if (!row) {
      return null;
    }

    const routePlaces = await pool.query<RoutePlaceRow>(routePlacesSelect, [row.id]);

    return {
      ...mapRouteSummary(row),
      places: routePlaces.rows.map(mapRoutePlace),
      canEdit: shareLink.can_edit,
    };
  }

  async insertShareLink(
    routeId: number,
    createdByUserId: string,
    input: { canEdit: boolean; expiresAt: Date | null },
  ): Promise<RouteShareLinkRecord> {
    const result = await pool.query<ShareLinkRow>(
      `
        INSERT INTO route_share_links (
          route_id,
          token,
          can_edit,
          created_by_user_id,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, route_id, token, can_edit, expires_at, created_at
      `,
      [routeId, crypto.randomBytes(24).toString("base64url"), input.canEdit, createdByUserId, input.expiresAt],
    );

    return mapShareLink(result.rows[0]);
  }

  async attachRouteAccessFromShareToken(
    token: string,
    userId: string,
  ): Promise<{ routeId: number; accessType: RouteAccessType } | null> {
    const shareLinkResult = await pool.query<ShareLinkRow>(
      `
        SELECT id, route_id, token, can_edit, expires_at, created_at
        FROM route_share_links
        WHERE token = $1
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [token],
    );

    const shareLink = shareLinkResult.rows[0];

    if (!shareLink) {
      return null;
    }

    const routeOwnerResult = await pool.query<{ owner_user_id: string }>(
      `
        SELECT owner_user_id
        FROM routes
        WHERE id = $1
      `,
      [shareLink.route_id],
    );

    const ownerUserId = routeOwnerResult.rows[0]?.owner_user_id;

    if (!ownerUserId) {
      return null;
    }

    if (ownerUserId === userId) {
      return {
        routeId: shareLink.route_id,
        accessType: "owner",
      };
    }

    const accessType: RouteAccessType = shareLink.can_edit ? "collaborator" : "viewer";

    await pool.query(
      `
        INSERT INTO route_access (route_id, user_id, access_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (route_id, user_id) DO UPDATE SET
          access_type = CASE
            WHEN route_access.access_type = 'collaborator' THEN route_access.access_type
            WHEN EXCLUDED.access_type = 'collaborator' THEN EXCLUDED.access_type
            ELSE route_access.access_type
          END
      `,
      [shareLink.route_id, userId, accessType],
    );

    return {
      routeId: shareLink.route_id,
      accessType,
    };
  }

  async createRoute(input: {
    ownerUserId: string;
    title: string;
    description: string | null;
    creationMode: RouteSummaryRecord["creationMode"];
    seasonId: number | null;
    totalEstimatedCost: number | null;
    totalEstimatedDurationMinutes: number | null;
    places: RoutePlaceInput[];
  }): Promise<number> {
    return withTransaction(async (client) => {
      const routeResult = await client.query<{ id: number }>(
        `
          INSERT INTO routes (
            owner_user_id,
            title,
            description,
            creation_mode,
            season_id,
            total_estimated_cost,
            total_estimated_duration_minutes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          input.ownerUserId,
          input.title,
          input.description,
          input.creationMode,
          input.seasonId,
          input.totalEstimatedCost,
          input.totalEstimatedDurationMinutes,
        ],
      );

      const routeId = routeResult.rows[0]?.id;

      if (!routeId) {
        throw new Error("Failed to create route");
      }

      await this.insertRoutePlaces(client, routeId, input.places);
      return routeId;
    });
  }

  async updateRoute(
    routeId: number,
    expectedRevisionNumber: number,
    patch: {
      title?: string;
      description?: string | null;
      seasonId?: number | null;
      totalEstimatedCost?: number | null;
      totalEstimatedDurationMinutes?: number | null;
    },
  ): Promise<void> {
    await withTransaction(async (client) => {
      const assignments: string[] = [];
      const values: unknown[] = [routeId, expectedRevisionNumber];

      if (patch.title !== undefined) {
        values.push(patch.title);
        assignments.push(`title = $${values.length}`);
      }

      if (patch.description !== undefined) {
        values.push(patch.description);
        assignments.push(`description = $${values.length}`);
      }

      if (patch.seasonId !== undefined) {
        values.push(patch.seasonId);
        assignments.push(`season_id = $${values.length}`);
      }

      if (patch.totalEstimatedCost !== undefined) {
        values.push(patch.totalEstimatedCost);
        assignments.push(`total_estimated_cost = $${values.length}`);
      }

      if (patch.totalEstimatedDurationMinutes !== undefined) {
        values.push(patch.totalEstimatedDurationMinutes);
        assignments.push(`total_estimated_duration_minutes = $${values.length}`);
      }

      assignments.push("revision_number = revision_number + 1");
      assignments.push("updated_at = NOW()");

      const result = await client.query(
        `
          UPDATE routes
          SET ${assignments.join(", ")}
          WHERE id = $1
            AND revision_number = $2
        `,
        values,
      );

      if (result.rowCount !== 1) {
        throw new Error("ROUTE_REVISION_CONFLICT");
      }
    });
  }

  async deleteRoute(routeId: number, expectedRevisionNumber: number): Promise<void> {
    await withTransaction(async (client) => {
      const result = await client.query(
        `
          DELETE FROM routes
          WHERE id = $1
            AND revision_number = $2
        `,
        [routeId, expectedRevisionNumber],
      );

      if (result.rowCount !== 1) {
        throw new Error("ROUTE_REVISION_CONFLICT");
      }
    });
  }

  async addRoutePlace(
    routeId: number,
    expectedRevisionNumber: number,
    input: RoutePlaceInput,
  ): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE route_places
          SET sort_order = sort_order + 1,
              updated_at = NOW()
          WHERE route_id = $1
            AND sort_order >= $2
        `,
        [routeId, input.sort_order],
      );

      await client.query(
        `
          INSERT INTO route_places (
            route_id,
            place_id,
            sort_order,
            day_number,
            estimated_travel_minutes_from_previous,
            estimated_distance_km_from_previous,
            stay_duration_minutes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          routeId,
          input.place_id,
          input.sort_order,
          input.day_number ?? null,
          input.estimated_travel_minutes_from_previous ?? null,
          input.estimated_distance_km_from_previous ?? null,
          input.stay_duration_minutes ?? null,
        ],
      );

      await this.bumpRouteRevision(client, routeId, expectedRevisionNumber);
    });
  }

  async updateRoutePlace(
    routeId: number,
    routePlaceId: number,
    expectedRevisionNumber: number,
    patch: {
      sortOrder?: number;
      dayNumber?: number | null;
      estimatedTravelMinutesFromPrevious?: number | null;
      estimatedDistanceKmFromPrevious?: number | null;
      stayDurationMinutes?: number | null;
    },
  ): Promise<void> {
    await withTransaction(async (client) => {
      const currentPlaceResult = await client.query<RoutePlaceOrderRow>(
        `
          SELECT sort_order
          FROM route_places
          WHERE id = $1
            AND route_id = $2
        `,
        [routePlaceId, routeId],
      );

      const currentSortOrder = currentPlaceResult.rows[0]?.sort_order;

      if (!currentSortOrder) {
        throw new Error("ROUTE_PLACE_NOT_FOUND");
      }

      if (patch.sortOrder !== undefined && patch.sortOrder !== currentSortOrder) {
        if (patch.sortOrder > currentSortOrder) {
          await client.query(
            `
              UPDATE route_places
              SET sort_order = sort_order - 1,
                  updated_at = NOW()
              WHERE route_id = $1
                AND sort_order > $2
                AND sort_order <= $3
            `,
            [routeId, currentSortOrder, patch.sortOrder],
          );
        } else {
          await client.query(
            `
              UPDATE route_places
              SET sort_order = sort_order + 1,
                  updated_at = NOW()
              WHERE route_id = $1
                AND sort_order >= $2
                AND sort_order < $3
            `,
            [routeId, patch.sortOrder, currentSortOrder],
          );
        }
      }

      const updateValues: unknown[] = [routePlaceId, routeId];
      const assignments: string[] = [];

      if (patch.sortOrder !== undefined) {
        updateValues.push(patch.sortOrder);
        assignments.push(`sort_order = $${updateValues.length}`);
      }

      if (patch.dayNumber !== undefined) {
        updateValues.push(patch.dayNumber);
        assignments.push(`day_number = $${updateValues.length}`);
      }

      if (patch.estimatedTravelMinutesFromPrevious !== undefined) {
        updateValues.push(patch.estimatedTravelMinutesFromPrevious);
        assignments.push(`estimated_travel_minutes_from_previous = $${updateValues.length}`);
      }

      if (patch.estimatedDistanceKmFromPrevious !== undefined) {
        updateValues.push(patch.estimatedDistanceKmFromPrevious);
        assignments.push(`estimated_distance_km_from_previous = $${updateValues.length}`);
      }

      if (patch.stayDurationMinutes !== undefined) {
        updateValues.push(patch.stayDurationMinutes);
        assignments.push(`stay_duration_minutes = $${updateValues.length}`);
      }

      assignments.push("updated_at = NOW()");

      await client.query(
        `
          UPDATE route_places
          SET ${assignments.join(", ")}
          WHERE id = $1
            AND route_id = $2
        `,
        updateValues,
      );

      await this.bumpRouteRevision(client, routeId, expectedRevisionNumber);
    });
  }

  async deleteRoutePlace(
    routeId: number,
    routePlaceId: number,
    expectedRevisionNumber: number,
  ): Promise<void> {
    await withTransaction(async (client) => {
      const currentPlaceResult = await client.query<RoutePlaceOrderRow>(
        `
          SELECT sort_order
          FROM route_places
          WHERE id = $1
            AND route_id = $2
        `,
        [routePlaceId, routeId],
      );

      const currentSortOrder = currentPlaceResult.rows[0]?.sort_order;

      if (!currentSortOrder) {
        throw new Error("ROUTE_PLACE_NOT_FOUND");
      }

      await client.query(
        `
          DELETE FROM route_places
          WHERE id = $1
            AND route_id = $2
        `,
        [routePlaceId, routeId],
      );

      await client.query(
        `
          UPDATE route_places
          SET sort_order = sort_order - 1,
              updated_at = NOW()
          WHERE route_id = $1
            AND sort_order > $2
        `,
        [routeId, currentSortOrder],
      );

      await this.bumpRouteRevision(client, routeId, expectedRevisionNumber);
    });
  }

  async patchSharedRoute(
    token: string,
    expectedRevisionNumber: number,
    patch: {
      title?: string;
      description?: string | null;
      seasonId?: number | null;
      totalEstimatedCost?: number | null;
      totalEstimatedDurationMinutes?: number | null;
      places?: RoutePlaceInput[];
    },
  ): Promise<number> {
    return withTransaction(async (client) => {
      const shareLink = await this.findShareLink(client, token);

      if (!shareLink || !shareLink.canEdit) {
        throw new Error("SHARE_LINK_NOT_FOUND");
      }

      if (patch.places !== undefined) {
        await client.query("DELETE FROM route_places WHERE route_id = $1", [shareLink.route_id]);
        await this.insertRoutePlaces(client, shareLink.route_id, patch.places);
      }

      const assignments: string[] = [];
      const values: unknown[] = [shareLink.route_id, expectedRevisionNumber];

      if (patch.title !== undefined) {
        values.push(patch.title);
        assignments.push(`title = $${values.length}`);
      }

      if (patch.description !== undefined) {
        values.push(patch.description);
        assignments.push(`description = $${values.length}`);
      }

      if (patch.seasonId !== undefined) {
        values.push(patch.seasonId);
        assignments.push(`season_id = $${values.length}`);
      }

      if (patch.totalEstimatedCost !== undefined) {
        values.push(patch.totalEstimatedCost);
        assignments.push(`total_estimated_cost = $${values.length}`);
      }

      if (patch.totalEstimatedDurationMinutes !== undefined) {
        values.push(patch.totalEstimatedDurationMinutes);
        assignments.push(`total_estimated_duration_minutes = $${values.length}`);
      }

      assignments.push("revision_number = revision_number + 1");
      assignments.push("updated_at = NOW()");

      const result = await client.query(
        `
          UPDATE routes
          SET ${assignments.join(", ")}
          WHERE id = $1
            AND revision_number = $2
        `,
        values,
      );

      if (result.rowCount !== 1) {
        throw new Error("ROUTE_REVISION_CONFLICT");
      }

      return shareLink.route_id;
    });
  }

  private async insertRoutePlaces(
    client: Queryable,
    routeId: number,
    places: RoutePlaceInput[],
  ): Promise<void> {
    for (const place of [...places].sort((a, b) => a.sort_order - b.sort_order)) {
      await client.query(
        `
          INSERT INTO route_places (
            route_id,
            place_id,
            sort_order,
            day_number,
            estimated_travel_minutes_from_previous,
            estimated_distance_km_from_previous,
            stay_duration_minutes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          routeId,
          place.place_id,
          place.sort_order,
          place.day_number ?? null,
          place.estimated_travel_minutes_from_previous ?? null,
          place.estimated_distance_km_from_previous ?? null,
          place.stay_duration_minutes ?? null,
        ],
      );
    }
  }

  private async bumpRouteRevision(
    client: Queryable,
    routeId: number,
    expectedRevisionNumber: number,
  ): Promise<void> {
    const result = await client.query(
      `
        UPDATE routes
        SET revision_number = revision_number + 1,
            updated_at = NOW()
        WHERE id = $1
          AND revision_number = $2
      `,
      [routeId, expectedRevisionNumber],
    );

    if (result.rowCount !== 1) {
      throw new Error("ROUTE_REVISION_CONFLICT");
    }
  }

  private async findShareLink(client: Queryable, token: string): Promise<ShareLinkRow | null> {
    const result = await client.query<ShareLinkRow>(
      `
        SELECT id, route_id, token, can_edit, expires_at, created_at
        FROM route_share_links
        WHERE token = $1
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }
}
