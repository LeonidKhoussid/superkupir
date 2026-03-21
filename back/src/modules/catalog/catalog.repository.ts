import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type { CatalogItemRecord } from "./catalog.types";

interface CatalogRow extends QueryResultRow {
  id: number;
  name: string;
  slug: string;
}

const mapCatalogItem = (row: CatalogRow): CatalogItemRecord => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
});

export class CatalogRepository {
  async listPlaceTypes(): Promise<CatalogItemRecord[]> {
    const result = await pool.query<CatalogRow>(
      `
        SELECT id, name, slug
        FROM place_types
        ORDER BY name ASC
      `,
    );

    return result.rows.map(mapCatalogItem);
  }

  async listSeasons(): Promise<CatalogItemRecord[]> {
    const result = await pool.query<CatalogRow>(
      `
        SELECT id, name, slug
        FROM seasons
        ORDER BY id ASC
      `,
    );

    return result.rows.map(mapCatalogItem);
  }

  async findSeasonById(id: number): Promise<CatalogItemRecord | null> {
    const result = await pool.query<CatalogRow>(
      `
        SELECT id, name, slug
        FROM seasons
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapCatalogItem(result.rows[0]) : null;
  }

  async findSeasonBySlug(slug: string): Promise<CatalogItemRecord | null> {
    const result = await pool.query<CatalogRow>(
      `
        SELECT id, name, slug
        FROM seasons
        WHERE slug = $1
      `,
      [slug],
    );

    return result.rows[0] ? mapCatalogItem(result.rows[0]) : null;
  }
}
