import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { Client } from "pg";

import { createPgClientConfig } from "../db/pg-config";

const DEFAULT_CSV_PATH = "/Users/leo/Downloads/scrapping.csv";
const DEFAULT_SQL_PATH = "sql/create_product_schema.sql";

type CsvRow = {
  wines_id: string;
  name: string;
  source_location: string;
  card_url: string;
  logo_url: string;
  size: string;
  description: string;
  photo_urls: string;
  lat: string;
  lon: string;
  coordinates_raw: string;
  address: string;
};

type PlaceImportRecord = {
  externalId: string;
  name: string;
  sourceLocation: string | null;
  cardUrl: string | null;
  logoUrl: string | null;
  size: string | null;
  description: string | null;
  shortDescription: string | null;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  coordinatesRaw: string | null;
  address: string | null;
  radiusGroup: string;
};

const parseArgs = () => {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes("--dry-run"),
    csvPathArg: args.find((arg) => !arg.startsWith("--")),
  };
};

const normalizeText = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseCoordinate = (value: string | undefined): number | null => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePhotoUrls = (value: string | undefined): string[] => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(";")
    .map((url) => url.trim())
    .filter(Boolean);
};

const buildShortDescription = (description: string | null) => {
  if (!description) {
    return null;
  }

  return description.length <= 220 ? description : `${description.slice(0, 217)}...`;
};

const mapRow = (row: CsvRow, rowNumber: number): PlaceImportRecord => {
  const externalId = normalizeText(row.wines_id);
  const name = normalizeText(row.name);

  if (!externalId) {
    throw new Error(`CSV row ${rowNumber} is missing wines_id`);
  }

  if (!name) {
    throw new Error(`CSV row ${rowNumber} is missing name`);
  }

  const sourceLocation = normalizeText(row.source_location);
  const description = normalizeText(row.description);

  return {
    externalId,
    name,
    sourceLocation,
    cardUrl: normalizeText(row.card_url),
    logoUrl: normalizeText(row.logo_url),
    size: normalizeText(row.size),
    description,
    shortDescription: buildShortDescription(description),
    photoUrls: parsePhotoUrls(row.photo_urls),
    latitude: parseCoordinate(row.lat),
    longitude: parseCoordinate(row.lon),
    coordinatesRaw: normalizeText(row.coordinates_raw),
    address: normalizeText(row.address),
    radiusGroup: sourceLocation ?? "legacy-import",
  };
};

const upsertPlaceSql = `
  INSERT INTO places (
    external_id,
    type_id,
    name,
    description,
    short_description,
    address,
    latitude,
    longitude,
    source_location,
    card_url,
    logo_url,
    photo_urls,
    radius_group,
    size,
    coordinates_raw,
    is_active
  ) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12::jsonb,
    $13,
    $14,
    $15,
    TRUE
  )
  ON CONFLICT (external_id) DO UPDATE SET
    type_id = EXCLUDED.type_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    source_location = EXCLUDED.source_location,
    card_url = EXCLUDED.card_url,
    logo_url = EXCLUDED.logo_url,
    photo_urls = EXCLUDED.photo_urls,
    radius_group = EXCLUDED.radius_group,
    size = EXCLUDED.size,
    coordinates_raw = EXCLUDED.coordinates_raw,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id
`;

const attachSeasonsSql = `
  INSERT INTO place_seasons (place_id, season_id)
  SELECT $1, season_id
  FROM UNNEST($2::bigint[]) AS season_ids(season_id)
  ON CONFLICT (place_id, season_id) DO NOTHING
`;

const main = async () => {
  const { dryRun, csvPathArg } = parseArgs();
  const csvPath = path.resolve(process.cwd(), csvPathArg ?? DEFAULT_CSV_PATH);
  const sqlPath = path.resolve(process.cwd(), DEFAULT_SQL_PATH);
  const [csvContent, createSchemaSql] = await Promise.all([
    fs.readFile(csvPath, "utf8"),
    fs.readFile(sqlPath, "utf8"),
  ]);

  const parsedRows = parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as CsvRow[];

  const placesByExternalId = new Map<string, PlaceImportRecord>();
  let duplicateRowsInCsv = 0;

  parsedRows.forEach((row, index) => {
    const place = mapRow(row, index + 2);

    if (placesByExternalId.has(place.externalId)) {
      duplicateRowsInCsv += 1;
    }

    placesByExternalId.set(place.externalId, place);
  });

  const places = [...placesByExternalId.values()];
  const withPhotosCount = places.filter((place) => place.photoUrls.length > 0).length;

  if (dryRun) {
    console.log(
      [
        `Dry run OK: parsed ${parsedRows.length} CSV rows from ${csvPath}`,
        `Unique places: ${places.length}`,
        `Duplicate external_id rows in CSV: ${duplicateRowsInCsv}`,
        `Rows with photo URL arrays: ${withPhotosCount}`,
        `Create-schema SQL: ${sqlPath}`,
      ].join("\n"),
    );
    return;
  }

  const client = new Client(createPgClientConfig());

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(createSchemaSql);

    const wineryTypeResult = await client.query<{ id: number }>(
      "SELECT id FROM place_types WHERE slug = 'winery' LIMIT 1",
    );

    const wineryTypeId = wineryTypeResult.rows[0]?.id;

    if (!wineryTypeId) {
      throw new Error("place_types does not contain the seeded 'winery' type");
    }

    const seasonRows = await client.query<{ id: number }>(
      "SELECT id FROM seasons ORDER BY id ASC",
    );
    const seasonIds = seasonRows.rows.map((row) => row.id);

    if (seasonIds.length === 0) {
      throw new Error("seasons seed data is missing");
    }

    const existingIds = new Set<string>();

    if (places.length > 0) {
      const existingRows = await client.query<{ external_id: string }>(
        "SELECT external_id FROM places WHERE external_id = ANY($1::text[])",
        [places.map((place) => place.externalId)],
      );

      existingRows.rows.forEach((row) => {
        existingIds.add(row.external_id);
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const place of places) {
      if (existingIds.has(place.externalId)) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }

      const result = await client.query<{ id: number }>(upsertPlaceSql, [
        place.externalId,
        wineryTypeId,
        place.name,
        place.description,
        place.shortDescription,
        place.address,
        place.latitude,
        place.longitude,
        place.sourceLocation,
        place.cardUrl,
        place.logoUrl,
        JSON.stringify(place.photoUrls),
        place.radiusGroup,
        place.size,
        place.coordinatesRaw,
      ]);

      const placeId = result.rows[0]?.id;

      if (!placeId) {
        throw new Error(`Failed to upsert place ${place.externalId}`);
      }

      await client.query(attachSeasonsSql, [placeId, seasonIds]);
    }

    await client.query("COMMIT");

    console.log(
      [
        `Imported places into canonical schema from ${csvPath}`,
        `Inserted: ${insertedCount}`,
        `Updated: ${updatedCount}`,
        `CSV duplicate rows skipped: ${duplicateRowsInCsv}`,
      ].join("\n"),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to import canonical places CSV: ${message}`);
  process.exitCode = 1;
});
