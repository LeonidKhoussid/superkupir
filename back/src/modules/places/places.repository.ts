import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type {
  ListPlacesInput,
  PlaceRecommendationInput,
  PlaceRecord,
} from "./places.types";

interface PlaceRow extends QueryResultRow {
  id: number;
  external_id: string | null;
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
  distance_km?: string | number | null;
}

interface TotalRow extends QueryResultRow {
  total: number;
}

interface PlaceExistsRow extends QueryResultRow {
  exists: boolean;
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const normalizeNumeric = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mapPlace = (row: PlaceRow): PlaceRecord => ({
  id: row.id,
  externalId: row.external_id,
  name: row.name,
  sourceLocation: row.source_location,
  cardUrl: row.card_url,
  logoUrl: row.logo_url,
  size: row.size,
  description: row.description,
  shortDescription: row.short_description,
  photoUrls: normalizeStringArray(row.photo_urls),
  lat: row.latitude,
  lon: row.longitude,
  coordinatesRaw: row.coordinates_raw,
  address: row.address,
  typeSlug: row.type_slug,
  seasonSlugs: normalizeStringArray(row.season_slugs),
  estimatedCost: normalizeNumeric(row.estimated_cost),
  estimatedDurationMinutes: row.estimated_duration_minutes,
  radiusGroup: row.radius_group,
  isActive: row.is_active,
});

const recommendationDistanceSql = `
  CASE
    WHEN anchor.latitude IS NOT NULL
      AND anchor.longitude IS NOT NULL
      AND places.latitude IS NOT NULL
      AND places.longitude IS NOT NULL
    THEN SQRT(
      POWER((places.latitude - anchor.latitude) * 111.0, 2) +
      POWER((places.longitude - anchor.longitude) * 85.0, 2)
    )
    ELSE NULL
  END
`;

const baseSelect = `
  SELECT
    places.id,
    places.external_id,
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
  FROM places
  INNER JOIN place_types ON place_types.id = places.type_id
`;

const buildWhereClause = (filters: ListPlacesInput, values: unknown[]) => {
  const conditions: string[] = [];

  if (filters.q) {
    values.push(`%${filters.q}%`);
    const index = values.length;
    conditions.push(
      `(places.name ILIKE $${index} OR COALESCE(places.description, '') ILIKE $${index} OR COALESCE(places.source_location, '') ILIKE $${index})`,
    );
  }

  if (filters.name) {
    values.push(`%${filters.name}%`);
    conditions.push(`places.name ILIKE $${values.length}`);
  }

  if (filters.sourceLocation) {
    values.push(`%${filters.sourceLocation}%`);
    conditions.push(`COALESCE(places.source_location, '') ILIKE $${values.length}`);
  }

  if (filters.typeSlug) {
    values.push(filters.typeSlug);
    conditions.push(`place_types.slug = $${values.length}`);
  }

  if (filters.seasonSlug) {
    values.push(filters.seasonSlug);
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM place_seasons
        INNER JOIN seasons ON seasons.id = place_seasons.season_id
        WHERE place_seasons.place_id = places.id
          AND seasons.slug = $${values.length}
      )`,
    );
  }

  if (typeof filters.isActive === "boolean") {
    values.push(filters.isActive);
    conditions.push(`places.is_active = $${values.length}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

export class PlacesRepository {
  async findMany(filters: ListPlacesInput): Promise<{ items: PlaceRecord[]; total: number }> {
    const values: unknown[] = [];
    const whereSql = buildWhereClause(filters, values);

    const totalResult = await pool.query<TotalRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        ${whereSql}
      `,
      values,
    );

    const listValues = [...values];
    let paginationSql = "";

    if (typeof filters.limit === "number") {
      listValues.push(filters.limit);
      paginationSql += ` LIMIT $${listValues.length}`;
    }

    listValues.push(filters.offset);
    paginationSql += ` OFFSET $${listValues.length}`;

    const result = await pool.query<PlaceRow>(
      `
        ${baseSelect}
        ${whereSql}
        ORDER BY places.id ASC
        ${paginationSql}
      `,
      listValues,
    );

    return {
      items: result.rows.map(mapPlace),
      total: totalResult.rows[0]?.total ?? 0,
    };
  }

  async findById(id: number): Promise<PlaceRecord | null> {
    const result = await pool.query<PlaceRow>(
      `
        ${baseSelect}
        WHERE places.id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapPlace(result.rows[0]) : null;
  }

  async placeExists(id: number): Promise<boolean> {
    const result = await pool.query<PlaceExistsRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM places
          WHERE id = $1
        ) AS exists
      `,
      [id],
    );

    return result.rows[0]?.exists ?? false;
  }

  async findExistingIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) {
      return [];
    }

    const result = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM places
        WHERE id = ANY($1::bigint[])
      `,
      [ids],
    );

    return result.rows.map((row) => row.id);
  }

  async findManyByIds(ids: number[]): Promise<PlaceRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const result = await pool.query<PlaceRow>(
      `
        ${baseSelect}
        WHERE places.id = ANY($1::bigint[])
      `,
      [ids],
    );

    const placeById = new Map(result.rows.map((row) => [row.id, mapPlace(row)]));

    return ids
      .map((id) => placeById.get(id))
      .filter((place): place is PlaceRecord => place !== undefined);
  }

  async findRecommendations(
    input: PlaceRecommendationInput,
  ): Promise<{ items: Array<PlaceRecord & { distanceKm: number | null }>; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ["places.is_active = TRUE"];

    if (input.seasonId !== undefined) {
      values.push(input.seasonId);
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM place_seasons
          WHERE place_seasons.place_id = places.id
            AND place_seasons.season_id = $${values.length}
        )`,
      );
    } else if (input.seasonSlug) {
      values.push(input.seasonSlug);
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM place_seasons
          INNER JOIN seasons ON seasons.id = place_seasons.season_id
          WHERE place_seasons.place_id = places.id
            AND seasons.slug = $${values.length}
        )`,
      );
    }

    if (input.excludePlaceIds.length > 0) {
      values.push(input.excludePlaceIds);
      conditions.push(`places.id <> ALL($${values.length}::bigint[])`);
    }

    let anchorJoinSql = `
      CROSS JOIN (
        SELECT
          NULL::bigint AS id,
          NULL::double precision AS latitude,
          NULL::double precision AS longitude,
          NULL::text AS source_location,
          NULL::text AS radius_group
      ) AS anchor
    `;

    if (input.anchorPlaceId !== undefined) {
      values.push(input.anchorPlaceId);
      const anchorIndex = values.length;
      anchorJoinSql = `
        INNER JOIN (
          SELECT id, latitude, longitude, source_location, radius_group
          FROM places
          WHERE id = $${anchorIndex}
        ) AS anchor ON TRUE
      `;
      conditions.push(`places.id <> anchor.id`);

      values.push(input.radiusKm ?? 50);
      const radiusIndex = values.length;
      conditions.push(
        `(
          (anchor.radius_group IS NOT NULL AND places.radius_group = anchor.radius_group)
          OR (anchor.source_location IS NOT NULL AND places.source_location = anchor.source_location)
          OR (
            anchor.latitude IS NOT NULL
            AND anchor.longitude IS NOT NULL
            AND places.latitude IS NOT NULL
            AND places.longitude IS NOT NULL
            AND ${recommendationDistanceSql} <= $${radiusIndex}
          )
        )`,
      );
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;

    const totalResult = await pool.query<TotalRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        ${anchorJoinSql}
        ${whereSql}
      `,
      values,
    );

    values.push(input.limit);
    const limitIndex = values.length;

    const result = await pool.query<PlaceRow>(
      `
        SELECT
          places.id,
          places.external_id,
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
          places.is_active,
          ${recommendationDistanceSql} AS distance_km
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        ${anchorJoinSql}
        ${whereSql}
        ORDER BY
          ${recommendationDistanceSql} ASC NULLS LAST,
          places.id ASC
        LIMIT $${limitIndex}
      `,
      values,
    );

    return {
      items: result.rows.map((row) => ({
        ...mapPlace(row),
        distanceKm: normalizeNumeric(row.distance_km),
      })),
      total: totalResult.rows[0]?.total ?? 0,
    };
  }
}
