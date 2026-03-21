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
