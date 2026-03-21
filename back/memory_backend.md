# Project overview

- Backend code lives in `/Users/leo/Documents/superkiper/back`.
- The backend was initially empty except for `readme.md`; the first implemented backend feature is credentials auth.
- Frontend auth UI in `/Users/leo/Documents/superkiper/front` is now wired to the backend email/password auth flow.
- The backend also now includes a minimal import path for the current winery/location CSV dataset from `/Users/leo/Downloads/scrapping.csv`.
- The frontend landing places carousel now also consumes the backend place-interactions endpoints for recommendation ordering, like toggles, comment counts, and a comments modal with fetch/post behavior.

# Current backend stack

- Node.js
- TypeScript
- Express
- PostgreSQL via `pg`
- Zod for request validation
- `bcryptjs` for password hashing
- JWT access tokens via `jsonwebtoken`
- Prisma schema file present for DB model alignment, but runtime data access currently uses raw SQL through `pg`
- Local verification completed: `npm run check`, `npm run build`, a server smoke test against `GET /health`, and dry runs for the winery SQL/import commands

# Current backend architecture

- `src/server.ts`: process startup and graceful shutdown.
- `src/app.ts`: Express app wiring and centralized CORS headers for browser auth + place-interactions requests from the frontend, including `DELETE` preflight support.
- `src/config/env.ts`: environment validation.
- `src/db/pg-config.ts`: shared PostgreSQL client config using plain `DATABASE_URL` connections.
- `src/db/pool.ts`: PostgreSQL pool.
- `src/lib/errors.ts`: async handler, 404 handler, centralized error middleware.
- `src/scripts/run-auth-sql.ts`: backend-only helper for applying the auth SQL bootstrap file.
- `src/scripts/import-wineries.ts`: backend-only CSV importer for the current winery dataset; applies the wineries table SQL and then upserts rows.
- `src/modules/auth/*`: isolated auth module.
- `src/modules/health/*`: simple health route.
- `src/modules/places/*`: isolated read-only places module for listing and fetching the current winery dataset.
- `src/modules/place-interactions/*`: isolated likes/comments module mounted under `/places/:id/...`.
- `sql/create_wineries_table.sql`: SQL bootstrap for the current winery dataset table.
- `sql/create_place_interactions_tables.sql`: SQL bootstrap for place likes/comments tables.

# Implemented modules

- Health module:
  - `GET /health`
- Auth module:
  - controller, routes, service, repository, middleware
  - credentials provider isolated in `src/modules/auth/providers/credentials.provider.ts`
  - provider name union already includes `credentials`, `vk`, `yandex`, and `ok` for future extension
  - currently consumed by the frontend login/register modal
- Winery dataset bootstrap:
  - SQL table bootstrap in `sql/create_wineries_table.sql`
  - CSV import command in `npm run db:import:wineries`
- Places dataset API:
  - `GET /places`
  - `GET /places/:id`
  - repository/service/controller/routes live in `src/modules/places`
- Place interactions API:
  - `POST /places/:id/like`
  - `DELETE /places/:id/like`
  - `GET /places/:id/likes`
  - `GET /places/:id/comments`
  - `POST /places/:id/comments`
  - repository/service/controller/routes live in `src/modules/place-interactions`
  - currently consumed by the frontend landing carousel and landing comments modal in `front/src/components/LandingPlacesCarousel.tsx` and `front/src/components/PlaceCommentsModal.tsx`

# Current auth flow

- Registration:
  - `POST /auth/register`
  - used by the frontend registration panel in `front/src/components/LoginModal.tsx`
  - validates `email` and `password`
  - normalizes email to lowercase
  - prevents duplicate email
  - hashes password with bcrypt
  - returns `{ user, token }`
- Login:
  - `POST /auth/login`
  - used by the frontend login panel in `front/src/components/LoginModal.tsx`
  - validates `email` and `password`
  - compares bcrypt hash
  - returns `{ user, token }`
- Current user:
  - `GET /auth/me`
  - used by the frontend auth bootstrap/store to restore a persisted session from token
  - requires `Authorization: Bearer <token>`
  - verifies JWT and loads the authenticated user
- Logout:
  - currently initiated from the frontend account modal
  - no backend endpoint yet; frontend clears the stored JWT and user locally

# Routes/endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /places`
- `GET /places/:id`
- `POST /places/:id/like`
- `DELETE /places/:id/like`
- `GET /places/:id/likes`
- `GET /places/:id/comments`
- `POST /places/:id/comments`
- Browser access is currently allowed via centralized `Access-Control-Allow-*` headers in `src/app.ts`
- Current browser CORS support:
  - `Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS`
  - `Access-Control-Allow-Headers`: mirrors `Access-Control-Request-Headers` when present, otherwise falls back to `Content-Type, Authorization`
  - `OPTIONS` preflight requests return `204`

# Current winery dataset storage

- Dataset source:
  - `/Users/leo/Downloads/scrapping.csv`
  - current file shape: 71 data rows with columns `wines_id`, `name`, `source_location`, `card_url`, `logo_url`, `size`, `description`, `photo_urls`, `lat`, `lon`, `coordinates_raw`, `address`
- Chosen table:
  - `wineries`
  - explicit naming is intentional because the current CSV is winery-specific and the broader app place model is not designed yet
- Schema:
  - `id BIGSERIAL PRIMARY KEY`
  - `external_id TEXT NOT NULL UNIQUE`
  - `name TEXT NOT NULL`
  - `source_location TEXT`
  - `card_url TEXT`
  - `logo_url TEXT`
  - `size TEXT`
  - `description TEXT`
  - `photo_urls JSONB`
  - `lat DOUBLE PRECISION`
  - `lon DOUBLE PRECISION`
  - `coordinates_raw TEXT`
  - `address TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Indexes and constraints:
  - unique index on `external_id`
  - `(lat, lon)` index for simple geo lookups/filtering later
  - update trigger keeps `updated_at` current
- Field decisions:
  - `external_id` stays `TEXT`, not integer, because source IDs contain leading zeroes like `001`
  - `photo_urls` is stored as `JSONB` array, parsed from the CSV semicolon-delimited string

# Current place interactions schema

- SQL file:
  - `sql/create_place_interactions_tables.sql`
- `place_likes` table:
  - `id BIGSERIAL PRIMARY KEY`
  - `place_id BIGINT NOT NULL REFERENCES wineries(id) ON DELETE CASCADE`
  - `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - unique index on `(place_id, user_id)`
  - index on `place_id`
  - index on `user_id`
- `place_comments` table:
  - `id BIGSERIAL PRIMARY KEY`
  - `place_id BIGINT NOT NULL REFERENCES wineries(id) ON DELETE CASCADE`
  - `user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE`
  - `content TEXT NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `CHECK (btrim(content) <> '')`
  - index on `place_id`
  - index on `user_id`
  - index on `created_at DESC`
  - update trigger keeps `updated_at` current
- Important note:
  - interaction `user_id` columns use `UUID`, not `BIGINT`, because the existing `auth_users.id` primary key is UUID-based

# Current places API

- Base dataset source:
  - reads from the `wineries` table created by `sql/create_wineries_table.sql`
- List endpoint:
  - `GET /places`
  - returns `{ items, total, limit, offset }`
  - default behavior with no query params:
    - returns all currently available rows in stable `id ASC` order
    - response `limit` is the count of rows returned in that response
  - supported query params:
    - `limit`: integer `1..100`
    - `offset`: integer `>= 0`
    - `q`: simple `ILIKE` search across `name`, `description`, and `source_location`
    - `name`: partial `ILIKE` filter on `name`
    - `location`: partial `ILIKE` filter on `source_location`
    - `source_location`: alias for the same `source_location` filter; if both alias params are present, `source_location` wins
- Detail endpoint:
  - `GET /places/:id`
  - uses the internal numeric DB `id`, not `external_id`
  - returns one place object or `404` if not found
- Response shape:
  - fields are exposed in snake_case to match the current dataset naming: `external_id`, `source_location`, `card_url`, `logo_url`, `photo_urls`, `coordinates_raw`
  - `photo_urls` is always returned as an array of strings
  - when the DB value is null or malformed, `photo_urls` falls back to `[]`
  - existing `/places` responses are intentionally unchanged in this version and do not include interaction counts

# Current place interactions API

- Like endpoints:
  - `POST /places/:id/like`
    - auth required
    - idempotent: already-liked still returns success
    - response: `{ liked: true, likes_count }`
  - `DELETE /places/:id/like`
    - auth required
    - idempotent: deleting a missing like still returns success
    - response: `{ liked: false, likes_count }`
  - `GET /places/:id/likes`
    - public
    - optional bearer token support via `optionalAuth`
    - response: `{ place_id, likes_count, liked_by_current_user }`
    - `liked_by_current_user` is `null` when no auth token is provided
- Comment endpoints:
  - `GET /places/:id/comments`
    - public
    - returns `{ items, total, limit, offset }`
    - ordered by `created_at DESC, id DESC`
    - supports `limit` (`1..100`, default `20`) and `offset` (`>= 0`, default `0`)
  - `POST /places/:id/comments`
    - auth required
    - request body: `{ content }`
    - trims content and enforces `1..1000` chars after trimming
    - returns the created comment with a minimal author object `{ id, email }`
- Comments delivery model:
  - comments are fetch-based HTTP reads only
  - no realtime, websockets, or live subscriptions are implemented
- Counts:
  - `likes_count` is returned by the like endpoints and likes summary endpoint
  - `GET /places/:id/comments` returns `total`, which serves as the current comments count for that place
- Current frontend consumption:
  - landing carousel fetches `GET /places`, then hydrates each carousel place with `GET /places/:id/likes` and `GET /places/:id/comments?limit=1&offset=0`
  - landing carousel sorts places by `likes_count DESC`, then by displayable-photo priority, then by stable original API order
  - carousel like toggle uses `POST /places/:id/like` and `DELETE /places/:id/like`; browser preflight for `DELETE` is now explicitly supported by backend CORS
  - frontend treats `liked_by_current_user: null` from `GET /places/:id/likes` as guest state and opens the existing auth modal on unauthenticated like attempts
  - clicking the carousel comment button opens a frontend comments modal that calls `GET /places/:id/comments` for list rendering and `POST /places/:id/comments` for creation
  - after successful comment creation, the frontend refetches `GET /places/:id/comments` and syncs the returned `total` back into the carousel card count
  - comments remain fetch-based only; no realtime delivery is expected by the current frontend

# Winery import approach

- SQL init command:
  - `npm run db:init:wineries`
- SQL dry run:
  - `npm run db:init:wineries -- --dry-run`
- Import command:
  - `npm run db:import:wineries`
- Import dry run:
  - `npm run db:import:wineries -- --dry-run`
- Import behavior:
  - reads `/Users/leo/Downloads/scrapping.csv` by default, with an optional custom CSV path argument
  - loads `sql/create_wineries_table.sql` first so the table exists before import
  - parses CSV with `csv-parse`
  - normalizes empty strings to `NULL`
  - parses `photo_urls` into a JSON array
  - upserts on `external_id` so re-running the import updates changed rows instead of duplicating them
  - deduplicates duplicate `external_id` rows inside the CSV in-memory; the last duplicate row wins
- Current dry-run verification:
  - parsed 71 rows
  - 71 unique `external_id` values
  - 69 rows currently include photo URL arrays

# Database/auth model notes

- SQL bootstrap file: `/Users/leo/Documents/superkiper/back/sql/create_auth_tables.sql`
- SQL runner command: `npm run db:init:auth`
- SQL runner dry run: `npm run db:init:auth -- --dry-run`
- Current backend `.env` uses a plain `DATABASE_URL` connection without SSL/TLS settings
- Frontend contract:
  - `POST /auth/login` and `POST /auth/register` expect `{ email, password }`
  - both return `{ user: { id, email }, token }`
  - `GET /auth/me` returns `{ user: { id, email } }`
- Prisma model snapshot: `/Users/leo/Documents/superkiper/back/prisma/schema.prisma`
- Primary auth table:
  - `auth_users`
  - columns: `id`, `email`, `password_hash`, `created_at`, `updated_at`
- Constraints:
  - unique index on `email`
  - lowercase email check constraint
  - trigger updates `updated_at` on row updates

# Validation/auth rules

- Email must be present, valid, max 320 chars, and is lowercased before persistence.
- Password must be present, minimum 8 chars, maximum 72 chars.
- Password hashes are never returned in API responses.
- Login errors intentionally use a generic invalid credentials message.
- JWT middleware rejects missing, invalid, or expired bearer tokens.

# Env variables used by backend

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`
- `npm run db:init:auth` requires `DATABASE_URL`
- `npm run db:init:wineries` requires `DATABASE_URL`
- `npm run db:init:place-interactions` requires `DATABASE_URL`
- `npm run db:import:wineries` requires `DATABASE_URL`

# Known issues

- No automated tests yet.
- No migration runner exists yet; the SQL bootstrap file is applied through the backend helper script instead of a formal migration tool.
- JWT refresh tokens and logout/session invalidation are not implemented in this first version.
- Auth endpoints that hit PostgreSQL were not executed end-to-end because the provided auth SQL has not been applied by this backend yet.
- The current plain PostgreSQL connection still fails with `ECONNREFUSED` to `shifisemouco.beget.app:5432`.
- Because of that DB connectivity failure, the new frontend auth wiring is implemented and build-verified, but cannot complete a real successful login until backend DB access works.
- Logout is currently client-side only; existing JWTs are not invalidated server-side.
- The winery import flow is only dry-run verified so far; actual table creation/import is blocked by the same PostgreSQL `ECONNREFUSED` connectivity problem.
- The current winery table is intentionally raw and source-shaped; duplicated text in `description` and source-specific formatting in `size` are preserved as-is for now.
- The winery dataset is stored via raw SQL only right now; the new API layer also uses raw SQL and no Prisma model has been added for it yet.
- The places API currently supports only basic list/detail/filter behavior; no geospatial filtering, sorting options, or route generation logic has been added.
- `/places/:id` uses internal DB ids, so clients that only know `external_id` must first fetch the list or add a future external-id lookup route.
- The new place interactions endpoints are only compile-verified plus a runtime `OPTIONS` preflight check so far; full DB-backed runtime testing is still blocked by the current PostgreSQL connectivity failure.
- Existing `/places` and `/places/:id` responses do not include `likes_count` or `comments_count`; clients must call the dedicated interaction endpoints for counts and state.
- Comments currently expose a minimal author object with `id` and `email` because there is no separate public profile model yet.
- Frontend comments UI currently exists only as a landing-page modal; the place detail page still does not consume `GET /places/:id/comments` or `POST /places/:id/comments`.
- The current frontend comments modal loads the first 20 comments and refetches after submit; there is no load-more UX yet even though backend pagination exists.

# Pending tasks

- Apply `sql/create_auth_tables.sql` to the target PostgreSQL database.
- Apply `sql/create_wineries_table.sql` and run `npm run db:import:wineries` once PostgreSQL is reachable.
- Apply `sql/create_place_interactions_tables.sql` once PostgreSQL is reachable.
- Add automated integration tests for register/login/me flows.
- Add automated endpoint tests for `GET /places` and `GET /places/:id` once PostgreSQL is reachable.
- Add automated endpoint tests for place likes/comments once PostgreSQL is reachable.
- Extend frontend usage of the place interaction endpoints later to the place detail page if comments display/posting becomes a priority.
- Expand or normalize the winery schema later only after the broader product data model is agreed.
- Add future auth providers behind the provider layer without changing controller contracts or the current frontend store API.
- Add a backend logout/session invalidation endpoint only if the project later needs server-side session control or refresh tokens.
- Decide whether to keep raw `pg` access or move the runtime auth repository to Prisma later.

# Important decisions

- All backend work stays under `back/` to avoid frontend merge conflicts.
- The first auth implementation supports only email/password credentials.
- Provider-specific logic is isolated so social providers can be added later without rewriting route/controller code.
- Runtime data access uses raw SQL for the smallest working implementation, while a Prisma schema file documents the current auth model.
- Backend CORS handling is intentionally minimal and centralized, but it now explicitly covers the current browser auth flow plus `DELETE`/`OPTIONS` for place-like toggles.
- Current logout behavior is intentionally frontend-only to keep the first auth version minimal.
- The current winery dataset uses a dedicated `wineries` table instead of a generic `places` table because the CSV is winery-specific and the broader place taxonomy is not settled yet.
- `photo_urls` is stored as `JSONB` because the source field is consistently semicolon-delimited and should remain queryable without inventing a separate child table yet.
- The winery import is designed as idempotent upsert-by-`external_id` so the same source CSV can be reloaded safely.
- The backend dataset read API is exposed as `/places` even though the current table name is `wineries`, so the public route can stay broader than the first dataset implementation.
- `/places/:id` intentionally uses the internal numeric primary key for the first version because it matches the current table shape and keeps lookup logic simple.
- Place likes use idempotent POST/DELETE behavior to reduce frontend edge cases and simplify later integration.
- Interaction routes are exposed under `/places/:id/...` but stored in a dedicated `place-interactions` backend module so the existing places read API stays stable.
- Existing `/places` responses were intentionally left unchanged in this version to avoid making them depend on newly added tables before the SQL bootstrap is applied.

# Handoff notes

- Before starting the server, create a backend `.env` file or export env vars; use `.env.example` as the template.
- Required DB schema is in `sql/create_auth_tables.sql`.
- To apply the schema: run `npm run db:init:auth` from `/Users/leo/Documents/superkiper/back`.
- Winery dataset schema is in `sql/create_wineries_table.sql`.
- Place interactions schema is in `sql/create_place_interactions_tables.sql`.
- To initialize just the winery table: run `npm run db:init:wineries`.
- To initialize the place interactions tables: run `npm run db:init:place-interactions`.
- To import the provided CSV dataset: run `npm run db:import:wineries`.
- To import a different CSV file later with the same structure: run `npm run db:import:wineries -- /absolute/path/to/file.csv`.
- The current dataset can now be read through `GET /places` and `GET /places/:id`.
- `GET /places/:id` expects the internal numeric `wineries.id` value.
- Place interactions now live under `/places/:id/like`, `/places/:id/likes`, and `/places/:id/comments`.
- The frontend now uses `DELETE /places/:id/like` directly from the browser and opens a landing-page comments modal backed by `GET /places/:id/comments` and `POST /places/:id/comments`.
- The auth module assumes the database table already exists.
- Backend-local `.gitignore` ignores `node_modules/`, `dist/`, and `.env`.
- Frontend auth expects the backend to be reachable at `http://localhost:3000` unless `VITE_API_BASE_URL` is set on the frontend side.
