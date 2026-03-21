[2026-03-21 21:29] - Redesign backend schema and route architecture for product flows

Type: feature

What changed:
	•	Added the canonical product schema bootstrap in `back/sql/create_product_schema.sql`, extending `auth_users`, introducing normalized `place_types` / `seasons` / `places`, preserving place interactions in the canonical schema, and adding `routes`, `route_places`, `route_access`, `route_share_links`, `route_build_sessions`, `route_build_session_places`, and `posts`.
	•	Added canonical CSV import flow in `back/src/scripts/import-places.ts` plus `npm run db:init:product` and `npm run db:import:places` to initialize and load the current dataset into `places`.
	•	Reworked the backend places module to read from `places`, preserve the existing `/places` and `/places/:id` public contracts where practical, and add `POST /places/recommendations` for season-aware and radius-aware candidate fetching.
	•	Added new backend modules for catalog taxonomy, collaborative routes, route-build sessions, and inspiration posts with the following route groups:
	•	`GET /place-types`, `GET /seasons`
	•	`POST /routes/from-quiz`, `GET /routes`, `POST /routes`, `GET /routes/:id`, `PATCH /routes/:id`, `DELETE /routes/:id`, `POST /routes/:id/places`, `PATCH /routes/:id/places/:routePlaceId`, `DELETE /routes/:id/places/:routePlaceId`, `POST /routes/:id/share`, `GET /routes/shared/:token`, `POST /routes/shared/:token/access`, `PATCH /routes/shared/:token`
	•	`POST /route-build-sessions`, `POST /route-build-sessions/:id/actions`, `GET /route-build-sessions/:id/recommendations`, `POST /route-build-sessions/:id/finalize`
	•	`GET /posts`, `GET /posts/:id`, `POST /posts`, `PATCH /posts/:id`, `DELETE /posts/:id`
	•	Implemented optimistic concurrency for collaborative route editing through `routes.revision_number`, returning `409` on stale updates instead of silently overwriting newer edits.
	•	Updated centralized CORS in `back/src/app.ts` to include `PATCH` alongside `GET`, `POST`, `DELETE`, and `OPTIONS`, because the new route and post editing endpoints are browser-facing.
	•	Rebuilt Swagger/OpenAPI coverage in `back/src/swagger/openapi-spec.ts` and added the backend architecture reference doc `back/backend_db_structure.md`.
	•	Verified `npm run check`, `npm run build`, `npm run db:init:product -- --dry-run`, `npm run db:import:places -- --dry-run`, built OpenAPI loading, app startup sanity via `createApp()`, and in-process CORS preflight support for `PATCH`.

Why it changed:
	•	The previous backend was centered on a raw winery import and could not support the updated product behavior around taxonomy, seasons, route generation flows, collaborative editing, share links, and inspiration posts.
	•	The backend needed a canonical relational model and route map that could support the current frontend contracts while unlocking the new product flows without requiring frontend file changes in this task.

Files touched:
	•	back/package.json
	•	back/sql/create_product_schema.sql
	•	back/src/db/with-transaction.ts
	•	back/src/scripts/import-places.ts
	•	back/src/app.ts
	•	back/src/swagger/openapi-spec.ts
	•	back/src/modules/auth/auth.types.ts
	•	back/src/modules/auth/auth.repository.ts
	•	back/src/modules/catalog/catalog.types.ts
	•	back/src/modules/catalog/catalog.repository.ts
	•	back/src/modules/catalog/catalog.service.ts
	•	back/src/modules/catalog/catalog.controller.ts
	•	back/src/modules/catalog/catalog.routes.ts
	•	back/src/modules/catalog/catalog.module.ts
	•	back/src/modules/places/places.types.ts
	•	back/src/modules/places/places.schemas.ts
	•	back/src/modules/places/places.repository.ts
	•	back/src/modules/places/places.service.ts
	•	back/src/modules/places/places.controller.ts
	•	back/src/modules/places/places.routes.ts
	•	back/src/modules/place-interactions/place-interactions.repository.ts
	•	back/src/modules/routes/routes.types.ts
	•	back/src/modules/routes/routes.schemas.ts
	•	back/src/modules/routes/routes.repository.ts
	•	back/src/modules/routes/routes.service.ts
	•	back/src/modules/routes/routes.controller.ts
	•	back/src/modules/routes/routes.routes.ts
	•	back/src/modules/routes/routes.module.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.types.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.schemas.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.repository.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.service.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.controller.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.routes.ts
	•	back/src/modules/route-build-sessions/route-build-sessions.module.ts
	•	back/src/modules/posts/posts.types.ts
	•	back/src/modules/posts/posts.schemas.ts
	•	back/src/modules/posts/posts.repository.ts
	•	back/src/modules/posts/posts.service.ts
	•	back/src/modules/posts/posts.controller.ts
	•	back/src/modules/posts/posts.routes.ts
	•	back/src/modules/posts/posts.module.ts
	•	back/backend_db_structure.md
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 06:31] - Fix browser CORS for unlike and confirm live comments frontend usage

Type: fix

What changed:
	•	Updated the centralized CORS middleware in `src/app.ts` so browser preflight requests now allow `GET`, `POST`, `DELETE`, and `OPTIONS`, and mirror requested headers such as `authorization` / `content-type`.
	•	Kept the existing place-interactions route contract unchanged: the frontend now actively uses `DELETE /places/:id/like` for unlike plus `GET /places/:id/comments` and `POST /places/:id/comments` for the new comments modal flow.
	•	Statically verified `npm run check` and `npm run build`, and runtime-verified the preflight path with an in-process `OPTIONS /places/:id/like` request returning `204` and `Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS`.

Why it changed:
	•	The frontend unlike action was failing in the browser before it reached the route handler because backend CORS preflight did not allow `DELETE`.
	•	Backend documentation also needed to reflect that the frontend now consumes the comments list/create endpoints as real UI behavior rather than comments-count-only hydration.

Files touched:
	•	back/src/app.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 06:16] - Document frontend consumption of place interaction endpoints

Type: chore

What changed:
	•	Updated backend memory/log files to reflect that the frontend landing carousel now consumes the existing place interaction endpoints without requiring backend code changes in this task.
	•	Documented the confirmed frontend usage pattern: `GET /places/:id/likes` and `GET /places/:id/comments` for carousel hydration, plus `POST /places/:id/like` / `DELETE /places/:id/like` for like toggles.
	•	Documented that comments are currently used as count-only data in the carousel, while existing `/places` and `/places/:id` responses remain unchanged and are not enriched with interaction counts.

Why it changed:
	•	Backend handoff notes need to capture the live frontend dependency on the current place-interactions contract, even though no backend runtime code changed during this frontend integration task.

Files touched:
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 05:56] - Add place likes and comments backend

Type: feature

What changed:
	•	Added `sql/create_place_interactions_tables.sql` with the new `place_likes` and `place_comments` tables, indexes, foreign keys, and an `updated_at` trigger for comments.
	•	Added a dedicated backend `place-interactions` module with repository, service, controller, routes, and module wiring for likes and comments under `/places/:id/...`.
	•	Added `POST /places/:id/like`, `DELETE /places/:id/like`, `GET /places/:id/likes`, `GET /places/:id/comments`, and `POST /places/:id/comments`.
	•	Implemented idempotent like/unlike behavior using `ON CONFLICT DO NOTHING` for likes and delete-if-present for unlikes.
	•	Added optional auth support for the public likes summary endpoint so it can return `liked_by_current_user` when a valid bearer token is present.
	•	Kept existing `GET /places` and `GET /places/:id` response shapes unchanged; counts are returned through the new interaction endpoints instead of enriching the existing places payloads.
	•	Added the npm command `npm run db:init:place-interactions` and verified `npm run check`, `npm run build`, and `npm run db:init:place-interactions -- --dry-run`.

Why it changed:
	•	The backend needed a minimal interaction layer for the current place dataset so authenticated users can like places and create comments without requiring frontend changes in this task.
	•	Keeping likes/comments in a dedicated backend module limits merge risk and avoids destabilizing the existing places read API.

Files touched:
	•	back/package.json
	•	back/sql/create_place_interactions_tables.sql
	•	back/src/app.ts
	•	back/src/modules/auth/auth.middleware.ts
	•	back/src/modules/place-interactions/place-interactions.types.ts
	•	back/src/modules/place-interactions/place-interactions.schemas.ts
	•	back/src/modules/place-interactions/place-interactions.repository.ts
	•	back/src/modules/place-interactions/place-interactions.service.ts
	•	back/src/modules/place-interactions/place-interactions.controller.ts
	•	back/src/modules/place-interactions/place-interactions.routes.ts
	•	back/src/modules/place-interactions/place-interactions.module.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 04:36] - Add backend places read endpoints

Type: feature

What changed:
	•	Added an isolated backend `places` module with repository, service, controller, routes, and module wiring for reading the current `wineries` dataset.
	•	Added `GET /places` with stable `id ASC` ordering plus validated support for `limit`, `offset`, `q`, `name`, `location`, and `source_location`.
	•	Added `GET /places/:id` using the internal numeric DB `id` and returning `404` when the record is missing.
	•	Normalized `photo_urls` responses to arrays of strings, returning `[]` when the DB value is null or not a valid JSON array.
	•	Wired the new router into `src/app.ts` and verified `npm run check` and `npm run build`.

Why it changed:
	•	The frontend will need a clean backend read API for the already imported winery/place dataset, but this task needed to stay isolated to backend-only dataset access.
	•	Using a dedicated `places` read module keeps the current dataset accessible without changing auth, frontend code, or the underlying DB schema.

Files touched:
	•	back/src/app.ts
	•	back/src/modules/places/places.types.ts
	•	back/src/modules/places/places.schemas.ts
	•	back/src/modules/places/places.repository.ts
	•	back/src/modules/places/places.service.ts
	•	back/src/modules/places/places.controller.ts
	•	back/src/modules/places/places.routes.ts
	•	back/src/modules/places/places.module.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

## [2026-03-21 04:20] - Add winery dataset table and CSV import flow

**Type:** feature

**What changed:**
- Added `sql/create_wineries_table.sql` to create a backend-only `wineries` table with timestamps, a unique `external_id`, and a `(lat, lon)` index for the current CSV dataset.
- Added `src/scripts/import-wineries.ts` plus npm commands for SQL init/import so the provided `scrapping.csv` file can be parsed and upserted into PostgreSQL.
- Chose `photo_urls` storage as `JSONB`, splitting the source semicolon-delimited string into an array of URLs during import.
- Generalized the SQL runner error message so the same backend SQL helper can be reused for the wineries table command.
- Verified `npm run check`, `npm run build`, `npm run db:init:wineries -- --dry-run`, and `npm run db:import:wineries -- --dry-run`.

**Why it changed:**
- The backend needed a minimal schema and seed/import path for the current winery/location CSV without expanding into the full future product data model.
- Keeping the import isolated to `back/` avoids merge risk with frontend/mobile work while making the current dataset load repeatable.

**Files touched:**
- `back/package.json`
- `back/package-lock.json`
- `back/sql/create_wineries_table.sql`
- `back/src/scripts/import-wineries.ts`
- `back/src/scripts/run-auth-sql.ts`
- `back/changes_backend.md`
- `back/memory_backend.md`

---

## [2026-03-21 01:50] - Document frontend logout integration state

**Type:** chore

**What changed:**
- Updated backend memory/log files to reflect that frontend logout now exists and currently works by clearing the stored JWT on the client.
- Documented that there is still no dedicated backend `/auth/logout` endpoint or server-side token invalidation.

**Why it changed:**
- The current auth integration state changed after logout was added on the frontend, and backend handoff notes need to stay accurate even without backend code changes.

**Files touched:**
- `back/changes_backend.md`
- `back/memory_backend.md`

---

## [2026-03-21 01:43] - Minimal backend auth adjustments for frontend integration

**Type:** fix

**What changed:**
- Added minimal CORS headers in `back/src/app.ts` so the Vite frontend can call the existing backend auth endpoints from the browser.
- Kept the auth contract unchanged: frontend now uses `POST /auth/login`, `POST /auth/register`, and `GET /auth/me` as already implemented.
- Updated backend memory/log files to reflect the frontend integration path and the current DB reachability limitation.

**Why it changed:**
- The frontend auth modal now sends real browser requests to the backend, so the backend needed a minimal browser-access adjustment without broader refactors.

**Files touched:**
- `back/src/app.ts`
- `back/changes_backend.md`
- `back/memory_backend.md`

---

[2026-03-21 01:06] - Remove backend PostgreSQL TLS config

Type: refactor

What changed:
	•	Removed SSL/TLS-specific PostgreSQL settings from the backend environment files and runtime config.
	•	Simplified `src/db/pg-config.ts` so the backend pool and auth SQL runner now use plain `DATABASE_URL` connections only.
	•	Verified `npm run check`, `npm run build`, and `npm run db:init:auth` after the change.

Why it changed:
	•	The backend database connection should no longer depend on SSL flags or local certificate files.
	•	This narrows the remaining DB issue down to plain host reachability instead of TLS setup.

Files touched:
	•	back/.env
	•	back/.env.example
	•	back/src/db/pg-config.ts
	•	back/src/config/env.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 00:59] - Fix backend PostgreSQL env and add TLS config

Type: fix

What changed:
	•	Corrected the backend `.env` PostgreSQL connection string to match the provided database host, database name, and URL-encoded password format.
	•	Added shared PostgreSQL client config in `src/db/pg-config.ts` so both the backend pool and the auth SQL runner use the same TLS/SSL settings.
	•	Added support for `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_SSL_CA_PATH`, and `DATABASE_SSL_CA`, plus updated `.env.example` with the new backend DB settings.
	•	Verified `npm run check`, `npm run build`, and confirmed that the current runtime blocker is a missing CA file at `/Users/leo/.postgresql/root.crt`.

Why it changed:
	•	The previous backend `.env` used a malformed `DATABASE_URL` and disabled SSL, which did not match the database connection details you provided.
	•	The backend needed proper CA-based TLS support so DB access is configured consistently for both runtime queries and schema initialization.

Files touched:
	•	back/.env
	•	back/.env.example
	•	back/src/db/pg-config.ts
	•	back/src/db/pool.ts
	•	back/src/config/env.ts
	•	back/src/scripts/run-auth-sql.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 00:38] - Add backend auth SQL runner script

Type: feature

What changed:
	•	Added a backend-only SQL runner script at `src/scripts/run-auth-sql.ts` that loads and executes `sql/create_auth_tables.sql` against PostgreSQL.
	•	Added the npm command `npm run db:init:auth` and support for `--dry-run` to validate the SQL file path without applying changes to the database.
	•	Verified the backend still passes `npm run check`, `npm run build`, and the new SQL runner dry run.

Why it changed:
	•	The auth bootstrap SQL needed a repeatable backend-local command so the auth schema can be applied without manually copying SQL into a database console.
	•	The script avoids coupling DB initialization to the full auth runtime env, so only DB settings are required to apply the schema.

Files touched:
	•	back/package.json
	•	back/src/scripts/run-auth-sql.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

[2026-03-21 00:34] - Bootstrap backend auth module

Type: feature

What changed:
	•	Created an isolated TypeScript + Express backend inside `back/` with a dedicated auth module and startup entrypoint.
	•	Added `POST /auth/register`, `POST /auth/login`, and `GET /auth/me` with validation, password hashing, JWT auth, and centralized backend error handling.
	•	Added PostgreSQL access for `auth_users`, plus backend-local SQL in `sql/create_auth_tables.sql` and a matching Prisma schema snapshot in `prisma/schema.prisma`.
	•	Added backend-local setup files: `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `.gitignore`, and a basic `/health` route.
	•	Verified the backend compiles with `npm run check`, builds with `npm run build`, and starts successfully for a local `/health` smoke test.

Why it changed:
	•	The repo had no implemented backend code yet, so the auth module needed a minimal isolated backend foundation inside `back/`.
	•	The first auth version only needs email/password credentials now, but the provider structure leaves room for VK/Yandex/OK later.

Files touched:
	•	back/.gitignore
	•	back/package.json
	•	back/package-lock.json
	•	back/tsconfig.json
	•	back/.env.example
	•	back/sql/create_auth_tables.sql
	•	back/prisma/schema.prisma
	•	back/src/config/env.ts
	•	back/src/db/pool.ts
	•	back/src/lib/errors.ts
	•	back/src/modules/auth/auth.types.ts
	•	back/src/modules/auth/auth.schemas.ts
	•	back/src/modules/auth/auth.repository.ts
	•	back/src/modules/auth/passwords.ts
	•	back/src/modules/auth/token.ts
	•	back/src/modules/auth/providers/provider.types.ts
	•	back/src/modules/auth/providers/credentials.provider.ts
	•	back/src/modules/auth/auth.service.ts
	•	back/src/modules/auth/auth.controller.ts
	•	back/src/modules/auth/auth.middleware.ts
	•	back/src/modules/auth/auth.routes.ts
	•	back/src/modules/auth/auth.module.ts
	•	back/src/modules/health/health.routes.ts
	•	back/src/types/express.d.ts
	•	back/src/app.ts
	•	back/src/server.ts
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻
