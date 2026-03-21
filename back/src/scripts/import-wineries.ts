import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { Client } from "pg";

import { createPgClientConfig } from "../db/pg-config";

const DEFAULT_CSV_PATH = "/Users/leo/Downloads/scrapping.csv";
const DEFAULT_SQL_PATH = "sql/create_wineries_table.sql";

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

type WineryRecord = {
  externalId: string;
  name: string;
  sourceLocation: string | null;
  cardUrl: string | null;
  logoUrl: string | null;
  size: string | null;
  description: string | null;
  photoUrls: string[] | null;
  lat: number | null;
  lon: number | null;
  coordinatesRaw: string | null;
  address: string | null;
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

const parsePhotoUrls = (value: string | undefined): string[] | null => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const urls = normalized
    .split(";")
    .map((url) => url.trim())
    .filter(Boolean);

  return urls.length > 0 ? urls : null;
};

const mapRow = (row: CsvRow, rowNumber: number): WineryRecord => {
  const externalId = normalizeText(row.wines_id);
  const name = normalizeText(row.name);

  if (!externalId) {
    throw new Error(`CSV row ${rowNumber} is missing wines_id`);
  }

  if (!name) {
    throw new Error(`CSV row ${rowNumber} is missing name`);
  }

  return {
    externalId,
    name,
    sourceLocation: normalizeText(row.source_location),
    cardUrl: normalizeText(row.card_url),
    logoUrl: normalizeText(row.logo_url),
    size: normalizeText(row.size),
    description: normalizeText(row.description),
    photoUrls: parsePhotoUrls(row.photo_urls),
    lat: parseCoordinate(row.lat),
    lon: parseCoordinate(row.lon),
    coordinatesRaw: normalizeText(row.coordinates_raw),
    address: normalizeText(row.address),
  };
};

const insertSql = `
  INSERT INTO wineries (
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
  ) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8::jsonb,
    $9,
    $10,
    $11,
    $12
  )
  ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    source_location = EXCLUDED.source_location,
    card_url = EXCLUDED.card_url,
    logo_url = EXCLUDED.logo_url,
    size = EXCLUDED.size,
    description = EXCLUDED.description,
    photo_urls = EXCLUDED.photo_urls,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    coordinates_raw = EXCLUDED.coordinates_raw,
    address = EXCLUDED.address,
    updated_at = NOW()
`;

const main = async () => {
  const { dryRun, csvPathArg } = parseArgs();
  const csvPath = path.resolve(process.cwd(), csvPathArg ?? DEFAULT_CSV_PATH);
  const sqlPath = path.resolve(process.cwd(), DEFAULT_SQL_PATH);
  const [csvContent, createTableSql] = await Promise.all([
    fs.readFile(csvPath, "utf8"),
    fs.readFile(sqlPath, "utf8"),
  ]);

  const parsedRows = parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as CsvRow[];

  const wineriesByExternalId = new Map<string, WineryRecord>();
  let duplicateRowsInCsv = 0;

  parsedRows.forEach((row, index) => {
    const winery = mapRow(row, index + 2);

    if (wineriesByExternalId.has(winery.externalId)) {
      duplicateRowsInCsv += 1;
    }

    wineriesByExternalId.set(winery.externalId, winery);
  });

  const wineries = [...wineriesByExternalId.values()];
  const withPhotosCount = wineries.filter((winery) => winery.photoUrls?.length).length;

  if (dryRun) {
    console.log(
      [
        `Dry run OK: parsed ${parsedRows.length} CSV rows from ${csvPath}`,
        `Unique wineries: ${wineries.length}`,
        `Duplicate external_id rows in CSV: ${duplicateRowsInCsv}`,
        `Rows with photo URL arrays: ${withPhotosCount}`,
        `Create-table SQL: ${sqlPath}`,
      ].join("\n"),
    );
    return;
  }

  const client = new Client(createPgClientConfig());

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(createTableSql);

    const existingIds = new Set<string>();

    if (wineries.length > 0) {
      const existingRows = await client.query<{ external_id: string }>(
        "SELECT external_id FROM wineries WHERE external_id = ANY($1::text[])",
        [wineries.map((winery) => winery.externalId)],
      );

      existingRows.rows.forEach((row) => {
        existingIds.add(row.external_id);
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const winery of wineries) {
      if (existingIds.has(winery.externalId)) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }

      await client.query(insertSql, [
        winery.externalId,
        winery.name,
        winery.sourceLocation,
        winery.cardUrl,
        winery.logoUrl,
        winery.size,
        winery.description,
        winery.photoUrls ? JSON.stringify(winery.photoUrls) : null,
        winery.lat,
        winery.lon,
        winery.coordinatesRaw,
        winery.address,
      ]);
    }

    await client.query("COMMIT");

    console.log(
      [
        `Imported wineries from ${csvPath}`,
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
  console.error(`Failed to import wineries CSV: ${message}`);
  process.exitCode = 1;
});
