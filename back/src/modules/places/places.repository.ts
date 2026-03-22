import type { QueryResultRow } from "pg";

import { pool } from "../../db/pool";
import type {
  ListPlacesInput,
  PlaceRecommendationInput,
  PlaceRecord,
  QuizClusteredBuildInput,
  QuizClusteredBuildResult,
  QuizPlacesBuildInput,
} from "./places.types";

interface PlaceRow extends QueryResultRow {
  id: number;
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

/** Фильтр квиза по городу: подстрока в `source_location` или `address` (без ILIKE-спецсимволов). */
function pushQuizCityClause(values: unknown[], city: string | null | undefined): string {
  const t = (city ?? "").trim();
  if (t === "") return "";
  values.push(t.toLowerCase());
  const n = values.length;
  return `AND (strpos(lower(COALESCE(places.source_location, '')), $${n}) > 0 OR strpos(lower(COALESCE(places.address, '')), $${n}) > 0)`;
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

/** `coordinates_raw` вида "lat,lon" — подставляем, если `latitude`/`longitude` в БД пустые. */
const COORD_RAW_TILDE_PATTERN =
  "^[[:space:]]*-?[0-9]+(\\.[0-9]+)?[[:space:]]*,[[:space:]]*-?[0-9]+(\\.[0-9]+)?[[:space:]]*$";

const effectiveLatExpr = (alias: string): string => `
COALESCE(
  ${alias}.latitude,
  CASE
    WHEN ${alias}.coordinates_raw IS NOT NULL
      AND ${alias}.coordinates_raw ~ '${COORD_RAW_TILDE_PATTERN}'
    THEN NULLIF(TRIM(SPLIT_PART(${alias}.coordinates_raw, ',', 1)), '')::double precision
    ELSE NULL
  END
)`;

const effectiveLonExpr = (alias: string): string => `
COALESCE(
  ${alias}.longitude,
  CASE
    WHEN ${alias}.coordinates_raw IS NOT NULL
      AND ${alias}.coordinates_raw ~ '${COORD_RAW_TILDE_PATTERN}'
    THEN NULLIF(TRIM(SPLIT_PART(${alias}.coordinates_raw, ',', 2)), '')::double precision
    ELSE NULL
  END
)`;

/** Расстояние до якоря (км), если у якоря и кандидата есть эффективные координаты. */
const buildRecommendationDistanceSql = (): string => {
  const plat = effectiveLatExpr("places");
  const plon = effectiveLonExpr("places");
  return `
CASE
  WHEN anchor.eff_lat IS NOT NULL
    AND anchor.eff_lon IS NOT NULL
    AND (${plat}) IS NOT NULL
    AND (${plon}) IS NOT NULL
  THEN SQRT(
    POWER(((${plat}) - anchor.eff_lat) * 111.0, 2) +
    POWER(((${plon}) - anchor.eff_lon) * 85.0, 2)
  )
  ELSE NULL
END
`;
};

const nullAnchorJoinSql = `
  CROSS JOIN (
    SELECT
      NULL::bigint AS id,
      NULL::double precision AS eff_lat,
      NULL::double precision AS eff_lon,
      NULL::text AS source_location,
      NULL::text AS radius_group
  ) AS anchor
`;

const baseSelect = `
  SELECT
    places.id,
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

const pageSelect = `
  SELECT places.id
  FROM places
  INNER JOIN place_types ON place_types.id = places.type_id
`;

const placeDetailsByIdsSelect = `
  WITH season_map AS (
    SELECT
      place_seasons.place_id,
      ARRAY_AGG(seasons.slug ORDER BY seasons.slug) AS season_slugs
    FROM place_seasons
    INNER JOIN seasons ON seasons.id = place_seasons.season_id
    WHERE place_seasons.place_id = ANY($1::bigint[])
    GROUP BY place_seasons.place_id
  )
  SELECT
    places.id,
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
    COALESCE(season_map.season_slugs, ARRAY[]::text[]) AS season_slugs,
    places.estimated_cost,
    places.estimated_duration_minutes,
    places.radius_group,
    places.is_active
  FROM places
  INNER JOIN place_types ON place_types.id = places.type_id
  LEFT JOIN season_map ON season_map.place_id = places.id
  WHERE places.id = ANY($1::bigint[])
  ORDER BY places.id ASC
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

    const pageIdResult = await pool.query<{ id: number }>(
      `
        ${pageSelect}
        ${whereSql}
        ORDER BY places.id ASC
        ${paginationSql}
      `,
      listValues,
    );

    const pageIds = pageIdResult.rows.map((row) => row.id);

    if (pageIds.length === 0) {
      return {
        items: [],
        total: totalResult.rows[0]?.total ?? 0,
      };
    }

    const result = await pool.query<PlaceRow>(placeDetailsByIdsSelect, [pageIds]);

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

    const result = await pool.query<PlaceRow>(placeDetailsByIdsSelect, [ids]);

    const placeById = new Map(result.rows.map((row) => [row.id, mapPlace(row)]));

    return ids
      .map((id) => placeById.get(id))
      .filter((place): place is PlaceRecord => place !== undefined);
  }

  async findRecommendations(
    input: PlaceRecommendationInput,
  ): Promise<{
    items: Array<PlaceRecord & { distanceKm: number | null }>;
    total: number;
    broadFallback: boolean;
  }> {
    const distanceSql = buildRecommendationDistanceSql();

    const buildSeasonExcludeSql = (
      nextParamIndex: number,
    ): { sqlParts: string[]; values: unknown[]; nextIndex: number } => {
      const parts: string[] = [];
      const vals: unknown[] = [];
      let i = nextParamIndex;

      if (input.seasonId !== undefined) {
        vals.push(input.seasonId);
        parts.push(
          `EXISTS (
          SELECT 1
          FROM place_seasons
          WHERE place_seasons.place_id = places.id
            AND place_seasons.season_id = $${i}
        )`,
        );
        i += 1;
      } else if (input.seasonSlug) {
        vals.push(input.seasonSlug);
        parts.push(
          `EXISTS (
          SELECT 1
          FROM place_seasons
          INNER JOIN seasons ON seasons.id = place_seasons.season_id
          WHERE place_seasons.place_id = places.id
            AND seasons.slug = $${i}
        )`,
        );
        i += 1;
      }

      if (input.excludePlaceIds.length > 0) {
        vals.push(input.excludePlaceIds);
        parts.push(`places.id <> ALL($${i}::bigint[])`);
        i += 1;
      }

      return { sqlParts: parts, values: vals, nextIndex: i };
    };

    const appendTypeSlugFilter = (whereParts: string[], values: unknown[]): void => {
      const slug = input.typeSlug?.trim();
      if (!slug) {
        return;
      }
      values.push(slug);
      whereParts.push(`place_types.slug = $${values.length}`);
    };

    const runAnchoredQuery = async (): Promise<{ rows: PlaceRow[]; total: number }> => {
      const anchorId = input.anchorPlaceId as number;
      const radiusKm = input.radiusKm ?? 50;

      const values: unknown[] = [anchorId];
      const seasonBlock = buildSeasonExcludeSql(2);
      values.push(...seasonBlock.values);
      values.push(radiusKm);
      const radiusParam = seasonBlock.nextIndex;

      const whereParts = [
        "places.is_active = TRUE",
        ...seasonBlock.sqlParts,
        "places.id <> anchor.id",
        `(
          (anchor.radius_group IS NOT NULL AND places.radius_group = anchor.radius_group)
          OR (anchor.source_location IS NOT NULL AND places.source_location = anchor.source_location)
          OR (
            anchor.eff_lat IS NOT NULL
            AND anchor.eff_lon IS NOT NULL
            AND (${effectiveLatExpr("places")}) IS NOT NULL
            AND (${effectiveLonExpr("places")}) IS NOT NULL
            AND (${distanceSql}) <= $${radiusParam}
          )
        )`,
      ];
      appendTypeSlugFilter(whereParts, values);
      const whereSql = `WHERE ${whereParts.join(" AND ")}`;

      const fromSql = `
        WITH anchor AS (
          SELECT
            p.id,
            p.source_location,
            p.radius_group,
            (${effectiveLatExpr("p")}) AS eff_lat,
            (${effectiveLonExpr("p")}) AS eff_lon
          FROM places p
          WHERE p.id = $1
        )
        SELECT
          places.id,
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
          ${distanceSql} AS distance_km
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        CROSS JOIN anchor
      `;

      const totalResult = await pool.query<TotalRow>(
        `
        WITH anchor AS (
          SELECT
            p.id,
            p.source_location,
            p.radius_group,
            (${effectiveLatExpr("p")}) AS eff_lat,
            (${effectiveLonExpr("p")}) AS eff_lon
          FROM places p
          WHERE p.id = $1
        )
        SELECT COUNT(*)::int AS total
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        CROSS JOIN anchor
        ${whereSql}
      `,
        values,
      );

      values.push(input.limit);
      const limitIndex = values.length;

      const result = await pool.query<PlaceRow>(
        `
        ${fromSql}
        ${whereSql}
        ORDER BY
          ${distanceSql} ASC NULLS LAST,
          (places.radius_group IS NOT DISTINCT FROM anchor.radius_group) DESC,
          places.id ASC
        LIMIT $${limitIndex}
      `,
        values,
      );

      return { rows: result.rows, total: totalResult.rows[0]?.total ?? 0 };
    };

    const runSeasonOnlyQuery = async (): Promise<{ rows: PlaceRow[]; total: number }> => {
      const values: unknown[] = [];
      const seasonBlock = buildSeasonExcludeSql(1);
      values.push(...seasonBlock.values);

      const whereParts = ["places.is_active = TRUE", ...seasonBlock.sqlParts];
      appendTypeSlugFilter(whereParts, values);
      const whereSql = `WHERE ${whereParts.join(" AND ")}`;

      const totalResult = await pool.query<TotalRow>(
        `
        SELECT COUNT(*)::int AS total
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        ${nullAnchorJoinSql}
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
          ${distanceSql} AS distance_km
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        ${nullAnchorJoinSql}
        ${whereSql}
        ORDER BY
          ${distanceSql} ASC NULLS LAST,
          (places.radius_group IS NOT DISTINCT FROM anchor.radius_group) DESC,
          places.id ASC
        LIMIT $${limitIndex}
      `,
        values,
      );

      return { rows: result.rows, total: totalResult.rows[0]?.total ?? 0 };
    };

    if (input.anchorPlaceId === undefined) {
      const { rows, total } = await runSeasonOnlyQuery();
      return {
        items: rows.map((row) => ({
          ...mapPlace(row),
          distanceKm: normalizeNumeric(row.distance_km),
        })),
        total,
        broadFallback: false,
      };
    }

    let { rows, total } = await runAnchoredQuery();
    let broadFallback = false;

    if (rows.length === 0) {
      broadFallback = true;
      const fb = await runSeasonOnlyQuery();
      rows = fb.rows;
      total = fb.total;
    }

    return {
      items: rows.map((row) => ({
        ...mapPlace(row),
        distanceKm: normalizeNumeric(row.distance_km),
      })),
      total,
      broadFallback,
    };
  }

  /**
   * Кандидаты для квиз-маршрута: сезон, бюджет «на человека», приоритет типов мест.
   * Сортировка: сначала типы из `typePreferenceOrder` (порядок в массиве), затем `places.id`.
   */
  async findPlacesForQuizBuild(input: QuizPlacesBuildInput): Promise<number[]> {
    const lim = Math.min(Math.max(input.limit, 1), 50);
    const min = Number.isFinite(input.perPersonBudgetMin) ? input.perPersonBudgetMin : 0;
    const maxRaw = Number.isFinite(input.perPersonBudgetMax) ? input.perPersonBudgetMax : min;
    const max = maxRaw >= min ? maxRaw : min;
    const prefs = [...new Set(input.typePreferenceOrder.filter((s) => typeof s === "string" && s.trim() !== ""))];

    const values: unknown[] = [input.seasonSlug, min, max, prefs];
    const citySql = pushQuizCityClause(values, input.city);
    values.push(lim);

    const result = await pool.query<{ id: number }>(
      `
        SELECT places.id
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        WHERE places.is_active = TRUE
          AND EXISTS (
            SELECT 1
            FROM place_seasons
            INNER JOIN seasons ON seasons.id = place_seasons.season_id
            WHERE place_seasons.place_id = places.id
              AND seasons.slug = $1
          )
          AND (
            places.estimated_cost IS NULL
            OR (places.estimated_cost >= $2 AND places.estimated_cost <= $3)
          )
          ${citySql}
        ORDER BY
          COALESCE(array_position($4::text[], place_types.slug), 1000),
          places.id ASC
        LIMIT $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => row.id);
  }

  /**
   * Квиз-маршрут: самый частый `radius_group` среди мест сезона+бюджета → основные точки
   * (без отелей/ресторанов) + отель + гастро/ресторан в том же районе.
   */
  async findPlacesForQuizClustered(input: QuizClusteredBuildInput): Promise<QuizClusteredBuildResult> {
    const min = Number.isFinite(input.perPersonBudgetMin) ? input.perPersonBudgetMin : 0;
    const maxRaw = Number.isFinite(input.perPersonBudgetMax) ? input.perPersonBudgetMax : min;
    const max = maxRaw >= min ? maxRaw : min;
    const mainLim = Math.min(Math.max(input.mainLimit, 1), 40);
    const prefs = [
      ...new Set(input.mainTypePreferenceOrder.filter((s) => typeof s === "string" && s.trim() !== "")),
    ];
    const maxHotels = Math.min(Math.max(input.maxHotels, 0), 3);
    const maxRestaurants = Math.min(Math.max(input.maxRestaurants, 0), 4);

    const seasonExistsSql = `
      EXISTS (
        SELECT 1
        FROM place_seasons
        INNER JOIN seasons ON seasons.id = place_seasons.season_id
        WHERE place_seasons.place_id = places.id
          AND seasons.slug = $1
      )`;

    const budgetSql = `
      (
        places.estimated_cost IS NULL
        OR (places.estimated_cost >= $2 AND places.estimated_cost <= $3)
      )`;

    const notHospitalitySql = `
      place_types.slug NOT IN ('hotel', 'guest_house', 'recreation_base', 'restaurant', 'gastro')`;

    const dominantValues: unknown[] = [input.seasonSlug, min, max];
    const dominantCitySql = pushQuizCityClause(dominantValues, input.city);

    const dominantResult = await pool.query<{ rg: string }>(
      `
        SELECT places.radius_group AS rg
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        WHERE places.is_active = TRUE
          AND ${seasonExistsSql}
          AND ${budgetSql}
          AND ${notHospitalitySql}
          ${dominantCitySql}
          AND places.radius_group IS NOT NULL
          AND TRIM(places.radius_group) <> ''
        GROUP BY places.radius_group
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
      dominantValues,
    );

    const clusterRg = dominantResult.rows[0]?.rg?.trim() ?? null;

    const runMain = async (radiusFilter: string | null): Promise<number[]> => {
      const values: unknown[] = [input.seasonSlug, min, max, prefs];
      const mainCitySql = pushQuizCityClause(values, input.city);
      let rgClause = "";
      if (radiusFilter != null && radiusFilter !== "") {
        values.push(radiusFilter);
        rgClause = `AND places.radius_group = $${values.length}`;
      }
      values.push(mainLim);
      const limitIdx = values.length;

      const res = await pool.query<{ id: number }>(
        `
          SELECT places.id
          FROM places
          INNER JOIN place_types ON place_types.id = places.type_id
          WHERE places.is_active = TRUE
            AND ${seasonExistsSql}
            AND ${budgetSql}
            AND ${notHospitalitySql}
            ${mainCitySql}
            ${rgClause}
          ORDER BY
            COALESCE(array_position($4::text[], place_types.slug), 1000),
            places.id ASC
          LIMIT $${limitIdx}
        `,
        values,
      );
      return res.rows.map((r) => r.id);
    };

    let mainIds = await runMain(clusterRg);
    if (mainIds.length < 2 && clusterRg != null) {
      mainIds = await runMain(null);
    }

    /** Отель/ночёвка редко попадает в «бюджет на человека за день» как винодельня — не режем по per-person диапазону. */
    const hospBudgetSql = `
      (
        places.estimated_cost IS NULL
        OR (places.estimated_cost >= $2 AND places.estimated_cost <= $3)
      )`;
    const hospBudgetParams: [string, number, number] = [input.seasonSlug, 0, 999_999_999];

    const pickHotels = async (radiusFilter: string | null, exclude: number[]): Promise<number[]> => {
      if (maxHotels === 0) {
        return [];
      }
      const values: unknown[] = [...hospBudgetParams];
      const hotelCitySql = pushQuizCityClause(values, input.city);
      let sql = `
        SELECT places.id
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        WHERE places.is_active = TRUE
          AND ${seasonExistsSql}
          AND ${hospBudgetSql}
          ${hotelCitySql}
          AND place_types.slug IN ('hotel', 'guest_house', 'recreation_base')`;
      if (radiusFilter != null && radiusFilter !== "") {
        values.push(radiusFilter);
        sql += `\n          AND places.radius_group = $${values.length}`;
      }
      if (exclude.length > 0) {
        values.push(exclude);
        sql += `\n          AND places.id <> ALL($${values.length}::bigint[])`;
      }
      values.push(maxHotels);
      sql += `\n        ORDER BY places.id ASC\n        LIMIT $${values.length}`;
      const res = await pool.query<{ id: number }>(sql, values);
      return res.rows.map((r) => r.id);
    };

    const pickRestaurants = async (radiusFilter: string | null, exclude: number[]): Promise<number[]> => {
      if (maxRestaurants === 0) {
        return [];
      }
      const values: unknown[] = [...hospBudgetParams];
      const restCitySql = pushQuizCityClause(values, input.city);
      let sql = `
        SELECT places.id
        FROM places
        INNER JOIN place_types ON place_types.id = places.type_id
        WHERE places.is_active = TRUE
          AND ${seasonExistsSql}
          AND ${hospBudgetSql}
          ${restCitySql}
          AND place_types.slug IN ('restaurant', 'gastro')`;
      if (radiusFilter != null && radiusFilter !== "") {
        values.push(radiusFilter);
        sql += `\n          AND places.radius_group = $${values.length}`;
      }
      if (exclude.length > 0) {
        values.push(exclude);
        sql += `\n          AND places.id <> ALL($${values.length}::bigint[])`;
      }
      values.push(maxRestaurants);
      sql += `\n        ORDER BY places.id ASC\n        LIMIT $${values.length}`;
      const res = await pool.query<{ id: number }>(sql, values);
      return res.rows.map((r) => r.id);
    };

    let hotelIds = await pickHotels(clusterRg, mainIds);
    if (hotelIds.length === 0 && clusterRg != null) {
      hotelIds = await pickHotels(null, mainIds);
    }

    const excludeForFood = [...mainIds, ...hotelIds];
    let restaurantIds = await pickRestaurants(clusterRg, excludeForFood);
    if (restaurantIds.length === 0 && clusterRg != null) {
      restaurantIds = await pickRestaurants(null, excludeForFood);
    }

    return {
      mainIds,
      hotelIds,
      restaurantIds,
      clusterRadiusGroup: clusterRg,
    };
  }
}
