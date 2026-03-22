import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { Client } from "pg";

import { createPgClientConfig } from "../db/pg-config";

const DEFAULT_CSV_PATH =
  "/Users/leo/Documents/superkiper/back/places_with_images_all_in_one_repriced_image_urls_updated.csv";
const DEFAULT_SQL_PATH = "sql/create_product_schema.sql";
const SHORT_DESCRIPTION_LIMIT = 200;
const LOW_CONFIDENCE_CITY_DISTANCE_KM = 100;

const CANONICAL_SEASONS = [
  { name: "Spring", slug: "spring" },
  { name: "Summer", slug: "summer" },
  { name: "Autumn", slug: "autumn" },
  { name: "Winter", slug: "winter" },
] as const;

const SEASON_SLUG_ALIASES: Record<string, string> = {
  fall: "autumn",
};

const TYPE_NAMES: Record<string, string> = {
  cheese: "Cheese",
  farm: "Farm",
  glamping: "Glamping",
  guest_house: "Guest House",
  hotel: "Hotel",
  museum: "Museum",
  recreation_base: "Recreation Base",
  restaurant: "Restaurant",
  winery: "Winery",
  workshop: "Workshop",
};

const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
  Абинск: { lat: 44.867965, lon: 38.161815 },
  Анапа: { lat: 44.894965, lon: 37.31675 },
  Геленджик: { lat: 44.563057, lon: 38.079121 },
  "Горячий Ключ": { lat: 44.634287, lon: 39.135818 },
  Ейск: { lat: 46.711524, lon: 38.276657 },
  Краснодар: { lat: 45.03547, lon: 38.975313 },
  Новороссийск: { lat: 44.723771, lon: 37.768813 },
  Сочи: { lat: 43.585472, lon: 39.723098 },
  Темрюк: { lat: 45.270141, lon: 37.387165 },
  Туапсе: { lat: 44.100731, lon: 39.082393 },
};

type CsvRow = {
  external_source: string;
  external_id: string;
  query_used: string;
  city_used: string;
  name: string;
  type_name: string;
  address: string;
  latitude: string;
  longitude: string;
  source_location: string;
  website_url: string;
  phone: string;
  description: string;
  season_slugs: string;
  photo_urls: string;
  estimated_cost: string;
  estimated_duration: string;
  is_active: string;
  image_query_used: string;
  primary_image_local_path: string;
  primary_image_url: string;
  image_status: string;
  image_source: string;
  image_content_type: string;
  s3_key: string;
};

type DedupeStrategy = "external_id" | "name_city_type" | "name_coordinates";
type DropReason = "missing_name" | "invalid_latitude" | "invalid_longitude" | "missing_type";
type ImportConfidence = "high" | "low";

type PlaceImportCandidate = {
  rowNumber: number;
  rawExternalSource: string;
  rawExternalId: string | null;
  cityUsed: string | null;
  name: string;
  typeSlug: string;
  typeName: string;
  address: string | null;
  latitude: number;
  longitude: number;
  sourceLocation: string | null;
  cardUrl: string | null;
  description: string | null;
  shortDescription: string | null;
  seasonSlugs: string[];
  photoUrls: string[];
  estimatedCost: number | null;
  estimatedDurationMinutes: number | null;
  isActive: boolean;
  radiusGroup: string | null;
  size: string | null;
  coordinatesRaw: string;
  dedupeKey: string;
  dedupeStrategy: DedupeStrategy;
  syntheticExternalId: string;
  distanceToCityKm: number | null;
  importConfidence: ImportConfidence;
  imageQualityRank: number;
};

type DroppedRow = {
  rowNumber: number;
  reason: DropReason;
  message: string;
  name: string | null;
  city: string | null;
  type: string | null;
};

type PlaceImportPlan = {
  places: PlaceImportCandidate[];
  validCandidatesCount: number;
  droppedRows: DroppedRow[];
  duplicateRowsRemoved: number;
  dedupeStrategyCounts: Record<DedupeStrategy, number>;
  derivedTypeSlugs: string[];
  placeSeasonLinks: number;
  lowConfidencePlacesCount: number;
};

type ParsedArgs = {
  dryRun: boolean;
  csvPathArg?: string;
};

const parseArgs = (): ParsedArgs => {
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

const normalizeKeyPart = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");

const normalizeSlug = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseCoordinate = (value: string | undefined): number | null => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoolean = (value: string | undefined) => {
  const normalized = normalizeText(value)?.toLowerCase();

  if (!normalized) {
    return true;
  }

  return ["true", "1", "yes", "y"].includes(normalized);
};

const parseNumber = (value: string | undefined): number | null => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePhotoUrls = (row: CsvRow): string[] => {
  const candidates: string[] = [];
  const rawPhotoUrls = normalizeText(row.photo_urls);
  const primaryImageUrl = normalizeText(row.primary_image_url);

  if (primaryImageUrl) {
    candidates.push(primaryImageUrl);
  }

  if (rawPhotoUrls) {
    if (rawPhotoUrls.startsWith("[") && rawPhotoUrls.endsWith("]")) {
      try {
        const parsed = JSON.parse(rawPhotoUrls);

        if (Array.isArray(parsed)) {
          for (const value of parsed) {
            if (typeof value === "string") {
              candidates.push(value);
            }
          }
        }
      } catch {
        // Fall through to delimiter-based parsing.
      }
    }

    if (candidates.length === (primaryImageUrl ? 1 : 0)) {
      for (const part of rawPhotoUrls.split(/[;\n|]+/)) {
        candidates.push(part);
      }
    }
  }

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.trim();

    if (!normalized) {
      continue;
    }

    try {
      const url = new URL(normalized);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }

      if (!seen.has(url.toString())) {
        seen.add(url.toString());
        urls.push(url.toString());
      }
    } catch {
      continue;
    }
  }

  return urls;
};

const parseSeasonSlugs = (value: string | undefined): string[] => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return CANONICAL_SEASONS.map((season) => season.slug);
  }

  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const rawPart of normalized.split(/[;,|/]+/)) {
    const rawSlug = normalizeSlug(rawPart);

    if (!rawSlug) {
      continue;
    }

    const canonicalSlug = SEASON_SLUG_ALIASES[rawSlug] ?? rawSlug;

    if (!CANONICAL_SEASONS.some((season) => season.slug === canonicalSlug)) {
      continue;
    }

    if (!seen.has(canonicalSlug)) {
      seen.add(canonicalSlug);
      slugs.push(canonicalSlug);
    }
  }

  return slugs.length > 0 ? slugs : CANONICAL_SEASONS.map((season) => season.slug);
};

const buildShortDescription = (description: string | null): string | null => {
  if (!description) {
    return null;
  }

  if (description.length <= SHORT_DESCRIPTION_LIMIT) {
    return description;
  }

  const boundarySlice = description.slice(0, SHORT_DESCRIPTION_LIMIT + 1);
  const lastSpace = boundarySlice.lastIndexOf(" ");

  if (lastSpace >= Math.floor(SHORT_DESCRIPTION_LIMIT * 0.6)) {
    return `${boundarySlice.slice(0, lastSpace).trim()}...`;
  }

  return `${description.slice(0, SHORT_DESCRIPTION_LIMIT - 3).trim()}...`;
};

const haversineDistanceKm = (
  firstLat: number,
  firstLon: number,
  secondLat: number,
  secondLon: number,
) => {
  const earthRadiusKm = 6371;
  const latDiff = ((secondLat - firstLat) * Math.PI) / 180;
  const lonDiff = ((secondLon - firstLon) * Math.PI) / 180;
  const firstLatRad = (firstLat * Math.PI) / 180;
  const secondLatRad = (secondLat * Math.PI) / 180;

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(firstLatRad) * Math.cos(secondLatRad) * Math.sin(lonDiff / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

const normalizeExternalIdValue = (value: string | null) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/\+/g, "")
    .replace(/\s+/g, "") ?? null;

const buildStableHash = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

const buildSyntheticExternalId = (input: {
  source: string;
  rawExternalId: string | null;
  dedupeIdentity: string;
  rawExternalIdIsUnique: boolean;
}) => {
  const baseSource = normalizeSlug(input.source) || "unknown";
  const rawExternalId = normalizeExternalIdValue(input.rawExternalId);

  if (rawExternalId && input.rawExternalIdIsUnique) {
    return `${baseSource}:${rawExternalId}`;
  }

  const hash = buildStableHash(input.dedupeIdentity);

  if (rawExternalId) {
    return `${baseSource}:${rawExternalId}:${hash}`;
  }

  return `${baseSource}:generated:${hash}`;
};

const getImageQualityRank = (row: CsvRow, photoUrls: string[]) => {
  if (photoUrls.length === 0) {
    return 3;
  }

  const imageStatus = normalizeKeyPart(row.image_status);
  const imageSource = normalizeKeyPart(row.image_source);

  if (imageStatus === "done" && imageSource && imageSource !== "category_placeholder") {
    return 0;
  }

  if (imageStatus === "done") {
    return 1;
  }

  return 2;
};

const createDroppedRow = (
  rowNumber: number,
  row: Partial<CsvRow>,
  reason: DropReason,
  message: string,
): DroppedRow => ({
  rowNumber,
  reason,
  message,
  name: normalizeText(row.name),
  city: normalizeText(row.city_used),
  type: normalizeText(row.type_name),
});

const getImportConfidence = (distanceToCityKm: number | null): ImportConfidence => {
  if (distanceToCityKm !== null && distanceToCityKm > LOW_CONFIDENCE_CITY_DISTANCE_KM) {
    return "low";
  }

  return "high";
};

const buildImportPlan = (rows: CsvRow[]): PlaceImportPlan => {
  const droppedRows: DroppedRow[] = [];
  const validCandidates: PlaceImportCandidate[] = [];
  const rawExternalIdCounts = new Map<string, number>();

  for (const row of rows) {
    const normalizedExternalId = normalizeExternalIdValue(normalizeText(row.external_id));

    if (!normalizedExternalId) {
      continue;
    }

    rawExternalIdCounts.set(normalizedExternalId, (rawExternalIdCounts.get(normalizedExternalId) ?? 0) + 1);
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = normalizeText(row.name);

    if (!name) {
      droppedRows.push(createDroppedRow(rowNumber, row, "missing_name", "Missing place name"));
      return;
    }

    const latitude = parseCoordinate(row.latitude);

    if (latitude === null) {
      droppedRows.push(
        createDroppedRow(rowNumber, row, "invalid_latitude", "Missing or invalid latitude"),
      );
      return;
    }

    const longitude = parseCoordinate(row.longitude);

    if (longitude === null) {
      droppedRows.push(
        createDroppedRow(rowNumber, row, "invalid_longitude", "Missing or invalid longitude"),
      );
      return;
    }

    const typeSlug = normalizeSlug(normalizeText(row.type_name));

    if (!typeSlug) {
      droppedRows.push(createDroppedRow(rowNumber, row, "missing_type", "Missing type_name"));
      return;
    }

    const cityUsed = normalizeText(row.city_used);
    const rawExternalId = normalizeText(row.external_id);
    const normalizedExternalId = normalizeExternalIdValue(rawExternalId);
    const rawExternalIdIsUnique =
      !!normalizedExternalId && (rawExternalIdCounts.get(normalizedExternalId) ?? 0) === 1;
    const nameKey = normalizeKeyPart(name);
    const cityKey = normalizeKeyPart(cityUsed);
    const coordinatesKey = `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;

    let dedupeKey: string;
    let dedupeStrategy: DedupeStrategy;

    if (normalizedExternalId && rawExternalIdIsUnique) {
      dedupeKey = `external_id:${normalizeSlug(row.external_source) || "unknown"}:${normalizedExternalId}`;
      dedupeStrategy = "external_id";
    } else if (cityKey) {
      dedupeKey = `name_city_type:${nameKey}:${cityKey}:${typeSlug}`;
      dedupeStrategy = "name_city_type";
    } else {
      dedupeKey = `name_coordinates:${nameKey}:${coordinatesKey}`;
      dedupeStrategy = "name_coordinates";
    }

    const dedupeIdentity = `${dedupeKey}|${coordinatesKey}`;
    const cityCenter = cityUsed ? CITY_CENTERS[cityUsed] : undefined;
    const distanceToCityKm = cityCenter
      ? haversineDistanceKm(latitude, longitude, cityCenter.lat, cityCenter.lon)
      : null;
    const description = normalizeText(row.description);
    const photoUrls = parsePhotoUrls(row);

    validCandidates.push({
      rowNumber,
      rawExternalSource: normalizeText(row.external_source) ?? "unknown",
      rawExternalId,
      cityUsed,
      name,
      typeSlug,
      typeName: TYPE_NAMES[typeSlug] ?? typeSlug.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()),
      address: normalizeText(row.address),
      latitude,
      longitude,
      sourceLocation: normalizeText(row.source_location),
      cardUrl: normalizeText(row.website_url),
      description,
      shortDescription: buildShortDescription(description),
      seasonSlugs: parseSeasonSlugs(row.season_slugs),
      photoUrls,
      estimatedCost: parseNumber(row.estimated_cost),
      estimatedDurationMinutes: null,
      isActive: parseBoolean(row.is_active),
      radiusGroup: cityUsed,
      size: null,
      coordinatesRaw: `${latitude},${longitude}`,
      dedupeKey,
      dedupeStrategy,
      syntheticExternalId: buildSyntheticExternalId({
        source: normalizeText(row.external_source) ?? "unknown",
        rawExternalId,
        dedupeIdentity,
        rawExternalIdIsUnique,
      }),
      distanceToCityKm,
      importConfidence: getImportConfidence(distanceToCityKm),
      imageQualityRank: getImageQualityRank(row, photoUrls),
    });
  });

  const candidatesByKey = new Map<string, PlaceImportCandidate[]>();

  for (const candidate of validCandidates) {
    const group = candidatesByKey.get(candidate.dedupeKey) ?? [];
    group.push(candidate);
    candidatesByKey.set(candidate.dedupeKey, group);
  }

  const dedupeStrategyCounts: Record<DedupeStrategy, number> = {
    external_id: 0,
    name_city_type: 0,
    name_coordinates: 0,
  };

  let duplicateRowsRemoved = 0;
  const keptPlaces: PlaceImportCandidate[] = [];

  for (const group of candidatesByKey.values()) {
    const orderedGroup = [...group].sort((left, right) => {
      const leftDistance = left.distanceToCityKm ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceToCityKm ?? Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      if (left.imageQualityRank !== right.imageQualityRank) {
        return left.imageQualityRank - right.imageQualityRank;
      }

      if (left.photoUrls.length !== right.photoUrls.length) {
        return right.photoUrls.length - left.photoUrls.length;
      }

      const leftDescriptionLength = left.description?.length ?? 0;
      const rightDescriptionLength = right.description?.length ?? 0;

      if (leftDescriptionLength !== rightDescriptionLength) {
        return rightDescriptionLength - leftDescriptionLength;
      }

      return left.rowNumber - right.rowNumber;
    });

    const bestCandidate = orderedGroup[0];
    duplicateRowsRemoved += orderedGroup.length - 1;

    dedupeStrategyCounts[bestCandidate.dedupeStrategy] += 1;
    keptPlaces.push(bestCandidate);
  }

  const derivedTypeSlugs = [...new Set(keptPlaces.map((place) => place.typeSlug))].sort();
  const placeSeasonLinks = keptPlaces.reduce(
    (total, place) => total + place.seasonSlugs.length,
    0,
  );
  const lowConfidencePlacesCount = keptPlaces.filter(
    (place) => place.importConfidence === "low",
  ).length;

  return {
    places: keptPlaces.sort((left, right) => left.name.localeCompare(right.name, "ru")),
    validCandidatesCount: validCandidates.length,
    droppedRows,
    duplicateRowsRemoved,
    dedupeStrategyCounts,
    derivedTypeSlugs,
    placeSeasonLinks,
    lowConfidencePlacesCount,
  };
};

const logPlanSummary = (plan: PlaceImportPlan, totalRows: number, csvPath: string) => {
  const droppedByReason = plan.droppedRows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.reason] = (accumulator[row.reason] ?? 0) + 1;
    return accumulator;
  }, {});

  console.log(
    [
      `Source CSV: ${csvPath}`,
      `Rows read: ${totalRows}`,
      `Valid candidates after minimal validation: ${plan.validCandidatesCount}`,
      `Final places kept: ${plan.places.length}`,
      `Rows dropped: ${plan.droppedRows.length}`,
      `Duplicate rows removed: ${plan.duplicateRowsRemoved}`,
      `Place types derived: ${plan.derivedTypeSlugs.length} (${plan.derivedTypeSlugs.join(", ")})`,
      `Place-season links to write: ${plan.placeSeasonLinks}`,
      `Low-confidence imports (> ${LOW_CONFIDENCE_CITY_DISTANCE_KM}km from expected city center): ${plan.lowConfidencePlacesCount}`,
      `Dedupe strategies used: external_id=${plan.dedupeStrategyCounts.external_id}, name_city_type=${plan.dedupeStrategyCounts.name_city_type}, name_coordinates=${plan.dedupeStrategyCounts.name_coordinates}`,
      `Dropped by reason: ${Object.entries(droppedByReason)
        .map(([reason, count]) => `${reason}=${count}`)
        .join(", ") || "none"}`,
    ].join("\n"),
  );

  const droppedSamples = plan.droppedRows.slice(0, 10);

  if (droppedSamples.length > 0) {
    console.log("\nDropped row samples:");

    for (const droppedRow of droppedSamples) {
      console.log(
        `- row ${droppedRow.rowNumber}: ${droppedRow.reason} | ${droppedRow.name ?? "no name"} | ${droppedRow.city ?? "no city"} | ${droppedRow.message}`,
      );
    }
  }
};

const upsertPlaceTypeSql = `
  INSERT INTO place_types (name, slug)
  VALUES ($1, $2)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW()
  RETURNING id
`;

const upsertSeasonSql = `
  INSERT INTO seasons (name, slug)
  VALUES ($1, $2)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW()
  RETURNING id
`;

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
    estimated_cost,
    estimated_duration_minutes,
    radius_group,
    size,
    coordinates_raw,
    is_active,
    import_confidence,
    city_distance_km
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
    $16,
    $17,
    $18,
    $19,
    $20
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
    estimated_cost = EXCLUDED.estimated_cost,
    estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
    radius_group = EXCLUDED.radius_group,
    size = EXCLUDED.size,
    coordinates_raw = EXCLUDED.coordinates_raw,
    is_active = EXCLUDED.is_active,
    import_confidence = EXCLUDED.import_confidence,
    city_distance_km = EXCLUDED.city_distance_km,
    updated_at = NOW()
  RETURNING id
`;

const main = async () => {
  const { dryRun, csvPathArg } = parseArgs();
  const csvPath = path.resolve(process.cwd(), csvPathArg ?? DEFAULT_CSV_PATH);
  const sqlPath = path.resolve(process.cwd(), DEFAULT_SQL_PATH);
  const [csvContent, createSchemaSql] = await Promise.all([
    fs.readFile(csvPath, "utf8"),
    fs.readFile(sqlPath, "utf8"),
  ]);

  const rows = parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as CsvRow[];

  const plan = buildImportPlan(rows);

  if (dryRun) {
    logPlanSummary(plan, rows.length, csvPath);
    return;
  }

  const client = new Client(createPgClientConfig());

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(createSchemaSql);

    const placeTypeIds = new Map<string, number>();

    for (const typeSlug of plan.derivedTypeSlugs) {
      const typeName = TYPE_NAMES[typeSlug] ?? typeSlug;
      const result = await client.query<{ id: number }>(upsertPlaceTypeSql, [typeName, typeSlug]);
      const typeId = result.rows[0]?.id;

      if (!typeId) {
        throw new Error(`Failed to upsert place type ${typeSlug}`);
      }

      placeTypeIds.set(typeSlug, typeId);
    }

    const seasonIds = new Map<string, number>();

    for (const season of CANONICAL_SEASONS) {
      const result = await client.query<{ id: number }>(upsertSeasonSql, [season.name, season.slug]);
      const seasonId = result.rows[0]?.id;

      if (!seasonId) {
        throw new Error(`Failed to upsert season ${season.slug}`);
      }

      seasonIds.set(season.slug, seasonId);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    if (plan.places.length > 0) {
      const existingPlaceRows = await client.query<{ external_id: string }>(
        `
          SELECT external_id
          FROM places
          WHERE external_id = ANY($1::text[])
        `,
        [plan.places.map((place) => place.syntheticExternalId)],
      );

      const existingExternalIds = new Set(existingPlaceRows.rows.map((row) => row.external_id));

      for (const place of plan.places) {
        const typeId = placeTypeIds.get(place.typeSlug);

        if (!typeId) {
          throw new Error(`No type id available for ${place.typeSlug}`);
        }

        const placeResult = await client.query<{ id: number }>(upsertPlaceSql, [
          place.syntheticExternalId,
          typeId,
          place.name,
          place.description,
          place.shortDescription,
          place.address,
          place.latitude,
          place.longitude,
          place.sourceLocation,
          place.cardUrl,
          null,
          JSON.stringify(place.photoUrls),
          place.estimatedCost,
          place.estimatedDurationMinutes,
          place.radiusGroup,
          place.size,
          place.coordinatesRaw,
          place.isActive,
          place.importConfidence,
          place.distanceToCityKm === null ? null : Number(place.distanceToCityKm.toFixed(2)),
        ]);

        const placeId = placeResult.rows[0]?.id;

        if (!placeId) {
          throw new Error(`Failed to upsert place ${place.name}`);
        }

        if (existingExternalIds.has(place.syntheticExternalId)) {
          updatedCount += 1;
        } else {
          insertedCount += 1;
        }

        await client.query(
          `
            DELETE FROM place_seasons
            WHERE place_id = $1
          `,
          [placeId],
        );

        for (const seasonSlug of place.seasonSlugs) {
          const seasonId = seasonIds.get(seasonSlug);

          if (!seasonId) {
            throw new Error(`No season id available for ${seasonSlug}`);
          }

          await client.query(
            `
              INSERT INTO place_seasons (place_id, season_id)
              VALUES ($1, $2)
              ON CONFLICT (place_id, season_id) DO NOTHING
            `,
            [placeId, seasonId],
          );
        }
      }
    }

    await client.query("COMMIT");

    logPlanSummary(plan, rows.length, csvPath);
    console.log(
      [
        "",
        `Imported canonical places from ${csvPath}`,
        `Inserted places: ${insertedCount}`,
        `Updated places: ${updatedCount}`,
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
