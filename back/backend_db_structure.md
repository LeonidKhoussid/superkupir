# Backend DB Structure

## Canonical backend schema

- Canonical bootstrap SQL: `back/sql/create_product_schema.sql`
- Canonical init command: `npm run db:init:product`
- Canonical CSV import: `back/src/scripts/import-places.ts`
- Canonical import command: `npm run db:import:places`
- Canonical CSV source: `/Users/leo/Documents/superkiper/back/places_with_images_all_in_one_repriced_image_urls_updated.csv`
- Canonical runtime place table: `places`
- Runtime API docs:
  - `GET /openapi.json`
  - `GET /api-docs`

The canonical bootstrap is now self-contained:
- it creates `auth_users`
- it creates all canonical product tables
- it seeds `place_types` and `seasons`
- it migrates legacy `wineries` rows into `places`
- it re-points existing `place_likes` / `place_comments` foreign keys to `places`

The backend runtime no longer treats `wineries` as the primary application table. `wineries` is now a legacy import source and compatibility bridge only. New backend code reads from `places`, `place_seasons`, `routes`, `posts`, and the other canonical product tables.

## Canonical vs helper SQL files

Canonical:
- `back/sql/create_product_schema.sql`
- `back/src/scripts/import-places.ts`
  - canonical transformation + import pipeline for places CSV data
  - reads the CSV source, normalizes rows, deduplicates candidates, upserts `place_types`, upserts `places`, and writes `place_seasons`

Helper / legacy-support SQL:
- `back/sql/create_auth_tables.sql`
  - still available for isolated auth table bootstrap
  - now aligned with the canonical `auth_users` shape
- `back/sql/create_place_interactions_tables.sql`
  - still available for isolated place-interactions bootstrap
  - now aligned with canonical `places`
- `back/sql/create_wineries_table.sql`
  - legacy helper for the original raw winery table only
  - not part of the canonical runtime schema

## Canonical CSV import rules

Source file:
- `/Users/leo/Documents/superkiper/back/places_with_images_all_in_one_repriced_image_urls_updated.csv`

Field mapping:
- `type_name` -> `place_types.slug`
- CSV-derived type slugs are upserted into `place_types`
- `season_slugs` -> canonical `seasons.slug`
- `fall` is normalized to `autumn`
- missing/invalid season values default to all four canonical seasons
- `primary_image_url` becomes the first `photo_urls` item
- `photo_urls` is parsed as additional image URLs when present
- `website_url` -> `places.card_url`
- `description` -> `places.description`
- derived `short_description` -> `places.short_description`
- `estimated_cost` -> `places.estimated_cost`
- `estimated_duration` is currently not trusted enough to map to minutes, so `places.estimated_duration_minutes` stays `NULL`
- `city_used` -> `places.radius_group`
- `latitude` / `longitude` -> `places.latitude` / `places.longitude`
- derived `coordinates_raw` -> `"latitude,longitude"`
- `is_active` -> `places.is_active`
- `distance(city_used, coordinates)` -> `places.city_distance_km` when the importer can resolve a city center
- importer quality flag -> `places.import_confidence`

Dedupe rules:
- Use raw `external_id` only when it is unique in the CSV
- Otherwise dedupe by `name + city_used + type_name`
- Final fallback: `name + coordinates`
- Final canonical `places.external_id` is synthesized deterministically from source/raw id/hash so it remains unique even when the CSV raw ids collide

Row selection rules:
- When a duplicate group exists, keep the candidate closest to the expected `city_used` center
- Secondary preference is better image quality
- Then prefer richer descriptions / earlier rows
- The `100km` city-distance threshold is now a confidence threshold, not a delete threshold

Drop rules:
- Drop rows missing `name`
- Drop rows with invalid `latitude`
- Drop rows with invalid `longitude`
- Do not drop rows solely because they are far from the expected city center
- If the selected candidate is more than `100km` from the expected city center, keep it and mark it as `import_confidence = 'low'`

Current dry-run result for the canonical CSV:
- `500` raw rows
- `432` kept canonical places
- `68` duplicate rows collapsed
- `0` rows dropped after validation
- `100` low-confidence places retained because they exceed the `100km` city-distance threshold
- `10` place types derived from the CSV

## Table list

### `auth_users`

Purpose:
- Credentials auth users.

Key columns:
- `id UUID PRIMARY KEY`
- `email TEXT UNIQUE NOT NULL`
- `password_hash TEXT NOT NULL`
- `is_guide BOOLEAN NOT NULL DEFAULT FALSE`
- `avatar_url TEXT`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important notes:
- Extended in place instead of creating a separate product user table.
- `is_guide` is used by the posts/inspiration filtering.
- The canonical bootstrap now creates this table directly, so a fresh product init does not depend on `create_auth_tables.sql`.

### `place_types`

Purpose:
- Normalized taxonomy for place category/type.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Seeded values:
- `winery`
- `hotel`
- `park`
- `farm`
- `gastro`
- `mountain`
- `event`
- `museum`

Import note:
- The canonical CSV importer can add missing slugs such as `guest_house`, `recreation_base`, `restaurant`, `cheese`, and `workshop`.

### `seasons`

Purpose:
- Normalized season dictionary.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Seeded values:
- `spring`
- `summer`
- `autumn`
- `winter`

### `places`

Purpose:
- Canonical place catalog table used by the API.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `external_id TEXT UNIQUE`
- `type_id BIGINT NOT NULL REFERENCES place_types(id)`
- `name TEXT NOT NULL`
- `description TEXT`
- `short_description TEXT`
- `address TEXT`
- `latitude DOUBLE PRECISION`
- `longitude DOUBLE PRECISION`
- `source_location TEXT`
- `card_url TEXT`
- `logo_url TEXT`
- `photo_urls JSONB NOT NULL DEFAULT '[]'`
- `estimated_cost NUMERIC(12,2)`
- `estimated_duration_minutes INTEGER`
- `radius_group TEXT`
- `size TEXT`
- `coordinates_raw TEXT`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `import_confidence TEXT NOT NULL DEFAULT 'high'`
- `city_distance_km NUMERIC(10,2)`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `photo_urls` must be a JSON array.
- `import_confidence` must be `high` or `low`.

Important indexes:
- `places_type_id_idx`
- `places_source_location_idx`
- `places_radius_group_idx`
- `places_lat_lon_idx`

Import note:
- `import_confidence` and `city_distance_km` are backend/internal import metadata and are not required by the current public `/places` response contract.

### `place_seasons`

Purpose:
- Required seasonality mapping for places.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE`
- `season_id BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE`
- `created_at TIMESTAMPTZ`

Important constraints:
- `UNIQUE (place_id, season_id)`

Seasonality rule:
- Canonical places are expected to be associated with one or more seasons through this table.
- During legacy winery import, all seeded seasons are attached because the old CSV does not provide season-level detail.
- During canonical CSV import, per-row `season_slugs` are used when valid, with `fall -> autumn` normalization and an all-seasons fallback when the source season value is missing or invalid.

### `place_likes`

Purpose:
- User likes for places.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `created_at TIMESTAMPTZ`

Important constraints:
- `UNIQUE (place_id, user_id)`

Important indexes:
- `place_likes_place_id_idx`
- `place_likes_user_id_idx`

### `place_comments`

Purpose:
- User comments for places.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `content TEXT NOT NULL`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `CHECK (btrim(content) <> '')`

Important indexes:
- `place_comments_place_id_idx`
- `place_comments_user_id_idx`
- `place_comments_created_at_idx`

### `routes`

Purpose:
- Core saved route entity.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `owner_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `description TEXT`
- `creation_mode TEXT NOT NULL`
- `season_id BIGINT REFERENCES seasons(id)`
- `total_estimated_cost NUMERIC(12,2)`
- `total_estimated_duration_minutes INTEGER`
- `revision_number INTEGER NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `creation_mode IN ('quiz', 'selection_builder', 'manual', 'shared_copy')`

Important indexes:
- `routes_owner_user_id_idx`
- `routes_season_id_idx`

Conflict control:
- Every route write operation uses `revision_number`.
- Stale updates are rejected with `409` instead of silently overwriting newer edits.

### `route_places`

Purpose:
- Ordered place list inside a route.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE`
- `place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE`
- `sort_order INTEGER NOT NULL`
- `day_number INTEGER`
- `estimated_travel_minutes_from_previous INTEGER`
- `estimated_distance_km_from_previous NUMERIC(8,2)`
- `stay_duration_minutes INTEGER`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `UNIQUE (route_id, sort_order)`

Important indexes:
- `route_places_route_id_idx`
- `route_places_place_id_idx`

### `route_access`

Purpose:
- Explicit non-owner route access records.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `access_type TEXT NOT NULL`
- `added_at TIMESTAMPTZ`

Important constraints:
- `UNIQUE (route_id, user_id)`
- `access_type IN ('shared', 'collaborator', 'viewer')`

Ownership model:
- Owner is stored only on `routes.owner_user_id`.
- `route_access` is for attached shared access, not for the owner row.

### `route_share_links`

Purpose:
- Public share-link tokens for collaborative route access.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `route_id BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE`
- `token TEXT NOT NULL UNIQUE`
- `can_edit BOOLEAN NOT NULL DEFAULT TRUE`
- `created_by_user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `expires_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`

Important indexes:
- `route_share_links_route_id_idx`
- `route_share_links_expires_at_idx`

Sharing model:
- `GET /routes/shared/:token` opens the route by token.
- `POST /routes/shared/:token/access` attaches the route to an authenticated user's route list via `route_access`.
- `PATCH /routes/shared/:token` updates the route through the token when `can_edit = true`.

### `route_build_sessions`

Purpose:
- Temporary builder session for the swipe/board place-selection flow.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL`
- `season_id BIGINT NOT NULL REFERENCES seasons(id)`
- `source_mode TEXT NOT NULL`
- `anchor_place_id BIGINT REFERENCES places(id) ON DELETE SET NULL`
- `status TEXT NOT NULL DEFAULT 'active'`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `source_mode IN ('mobile_swipe', 'desktop_board')`
- `status IN ('active', 'completed', 'cancelled')`

Important indexes:
- `route_build_sessions_user_id_idx`
- `route_build_sessions_status_idx`

### `route_build_session_places`

Purpose:
- Logged user decisions inside a route build session.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `session_id BIGINT NOT NULL REFERENCES route_build_sessions(id) ON DELETE CASCADE`
- `place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE`
- `action_type TEXT NOT NULL`
- `created_at TIMESTAMPTZ`

Important constraints:
- `action_type IN ('accepted', 'rejected', 'saved')`

Important indexes:
- `route_build_session_places_session_id_idx`
- `route_build_session_places_place_id_idx`
- `route_build_session_places_action_type_idx`

Builder flow notes:
- Accepted and saved places are used to finalize a stored route.
- Seen place ids are excluded from subsequent recommendations.
- Accepted or saved places update the session anchor place, which drives same-radius recommendations.

### `posts`

Purpose:
- Inspiration feed posts from guides and regular users.

Key columns:
- `id BIGSERIAL PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
- `title TEXT`
- `content TEXT NOT NULL`
- `image_urls JSONB NOT NULL DEFAULT '[]'`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Important constraints:
- `CHECK (btrim(content) <> '')`
- `image_urls` must be a JSON array.

Important indexes:
- `posts_user_id_idx`
- `posts_created_at_idx`

### Legacy compatibility table: `wineries`

Purpose:
- Legacy imported dataset from the original CSV bootstrap.

Current role:
- No longer used as the canonical runtime source for places endpoints.
- `create_product_schema.sql` migrates existing winery rows into `places` and preserves ids where possible.
- Kept only for backward compatibility and bootstrap transition.

## Collaboration and conflict control

- Route edits are optimistic-lock protected through `routes.revision_number`.
- The following endpoints require the caller to provide the expected revision:
  - `PATCH /routes/:id`
  - `DELETE /routes/:id`
  - `POST /routes/:id/places`
  - `PATCH /routes/:id/places/:routePlaceId`
  - `DELETE /routes/:id/places/:routePlaceId`
  - `PATCH /routes/shared/:token`
- When the stored revision does not match the client revision, the backend returns `409 Route revision conflict`.

## Route build session behavior

- A route build session belongs to one authenticated user.
- The session stores:
  - selected season
  - source mode (`mobile_swipe` or `desktop_board`)
  - current anchor place
  - current status
  - per-place accept/reject/save decisions
- Recommendation generation is season-aware and tries, in order:
  - same `radius_group`
  - same `source_location`
  - geo-distance within the requested radius if coordinates are available
- Finalization converts accepted/saved place ids into a persisted route with `creation_mode = 'selection_builder'`.

## Sharing model

- Share links are token-based and stored in `route_share_links`.
- A token can be editable or read-only through `can_edit`.
- A shared route can be attached to a logged-in user through `route_access`.
- Token-based editing is currently HTTP-only and protected by optimistic locking, not websockets or realtime merge logic.

## Current endpoint map

### Health

- Public:
  - `GET /health`

### Auth

- Public:
  - `POST /auth/register`
  - `POST /auth/login`
- Auth required:
  - `GET /auth/me`

### Catalog

- Public:
  - `GET /place-types`
  - `GET /seasons`

### Places

- Public:
  - `GET /places`
  - `GET /places/:id`
  - `POST /places/recommendations`

### Place interactions

- Public:
  - `GET /places/:id/likes`
  - `GET /places/:id/comments`
- Auth required:
  - `POST /places/:id/like`
  - `DELETE /places/:id/like`
  - `POST /places/:id/comments`

### Route build sessions

- Auth required:
  - `POST /route-build-sessions`
  - `POST /route-build-sessions/:id/actions`
  - `GET /route-build-sessions/:id/recommendations`
  - `POST /route-build-sessions/:id/finalize`

### Routes

- Auth required:
  - `POST /routes/from-quiz`
  - `GET /routes`
  - `POST /routes`
  - `GET /routes/:id`
  - `PATCH /routes/:id`
  - `DELETE /routes/:id`
  - `POST /routes/:id/places`
  - `PATCH /routes/:id/places/:routePlaceId`
  - `DELETE /routes/:id/places/:routePlaceId`
  - `POST /routes/:id/share`
  - `POST /routes/shared/:token/access`
- Public:
  - `GET /routes/shared/:token`
  - `PATCH /routes/shared/:token`

### Posts

- Public:
  - `GET /posts`
  - `GET /posts/:id`
- Auth required:
  - `POST /posts`
  - `PATCH /posts/:id`
  - `DELETE /posts/:id`

## Swagger / OpenAPI

- Spec file: `back/src/swagger/openapi-spec.ts`
- Served endpoints:
  - `GET /openapi.json`
  - `GET /api-docs`
- Coverage includes:
  - existing auth and place endpoints
  - place taxonomy
  - place recommendations
  - place likes/comments
  - route build sessions
  - routes and share links
  - posts

## Known limitations

- ML route generation is still a placeholder boundary. `POST /routes/from-quiz` stores the route but does not call a real ML service yet.
- Legacy databases still need the canonical bootstrap to be executed for the FK repair steps to run. Until `npm run db:init:product` is actually applied against that database, old `place_likes` / `place_comments` constraints may still point at `wineries`.
- The canonical CSV contains severe raw `external_id` collisions and many geographically implausible duplicates, so importer heuristics are required to produce stable canonical places.
- Far-distance rows are now retained as low-confidence imports instead of being dropped, so downstream consumers should not assume every imported place is equally geo-trustworthy.
- Legacy winery imports attach all four seeded seasons because the source CSV does not include explicit season data.
- No formal migration framework exists yet. The canonical bootstrap is still raw SQL-based.
- Live DB runtime verification remains limited by the existing PostgreSQL connectivity issue; current verification is compile-time and dry-run based.
