import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type { ListPlacesInput, PlaceRecord } from "./places.types";

interface PlaceRow extends QueryResultRow {
  id: number;
  external_id: string;
  name: string;
  source_location: string | null;
  card_url: string | null;
  logo_url: string | null;
  size: string | null;
  description: string | null;
  photo_urls: unknown;
  lat: number | null;
  lon: number | null;
  coordinates_raw: string | null;
  address: string | null;
}

interface TotalRow extends QueryResultRow {
  total: number;
}

const normalizePhotoUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
  photoUrls: normalizePhotoUrls(row.photo_urls),
  lat: row.lat,
  lon: row.lon,
  coordinatesRaw: row.coordinates_raw,
  address: row.address,
});

const selectColumns = `
  SELECT
    id,
    external_id,
    name,
    source_location,
    card_url,
    logo_url,
    size,
    description,
    photo_urls,
    lat,
    lon,
    coordinates_raw,
    address
  FROM wineries
`;

export class PlacesRepository {
  async findMany(filters: ListPlacesInput): Promise<{ items: PlaceRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.q) {
      values.push(`%${filters.q}%`);
      const index = values.length;

      conditions.push(
        `(name ILIKE $${index} OR COALESCE(description, '') ILIKE $${index} OR COALESCE(source_location, '') ILIKE $${index})`,
      );
    }

    if (filters.name) {
      values.push(`%${filters.name}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    if (filters.sourceLocation) {
      values.push(`%${filters.sourceLocation}%`);
      conditions.push(`COALESCE(source_location, '') ILIKE $${values.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const totalResult = await pool.query<TotalRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM wineries
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
        ${selectColumns}
        ${whereSql}
        ORDER BY id ASC
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
        ${selectColumns}
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapPlace(result.rows[0]) : null;
  }
}
