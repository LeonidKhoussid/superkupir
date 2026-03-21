# Project overview

- Backend code lives in `/Users/leo/Documents/superkiper/back`.
- The backend has been upgraded from a narrow auth + legacy winery dataset setup into a product-oriented architecture centered on:
  - canonical `places`
  - place taxonomy and seasons
  - place interactions
  - saved routes
  - collaborative sharing
  - route build sessions
  - inspiration posts
- Frontend compatibility was preserved where practical:
  - auth contract is unchanged
  - `GET /places` and `GET /places/:id` remain available and still use snake_case public fields
  - place interaction endpoints remain under `/places/:id/...`
- Frontend markdown files were read for compatibility context but not modified in this backend-only task.

# Current backend stack

- Node.js
- TypeScript
- Express
- PostgreSQL via `pg`
- Zod for validation
- JWT via `jsonwebtoken`
- `bcryptjs` for password hashing
- Swagger UI via `swagger-ui-express`
- Raw SQL bootstrap scripts instead of a formal migration framework

# Canonical backend architecture

- `src/server.ts`
  - process startup and graceful shutdown
- `src/app.ts`
  - Express wiring
  - centralized CORS with `GET,POST,PATCH,DELETE,OPTIONS`
  - `/openapi.json`
  - `/api-docs`
  - module mounting
- `src/lib/errors.ts`
  - centralized async/error handling
- `src/db/pool.ts`
  - PostgreSQL pool
- `src/db/with-transaction.ts`
  - transaction helper for multi-step route writes
- `src/swagger/openapi-spec.ts`
  - OpenAPI 3 spec for the current API surface
- `sql/create_product_schema.sql`
  - self-contained canonical relational bootstrap
  - creates `auth_users` plus the canonical product tables
  - seeds taxonomy tables
  - migrates legacy `wineries` rows into `places`
  - repairs legacy `place_likes` / `place_comments` foreign keys to point at `places`
- `src/scripts/import-places.ts`
  - canonical CSV import into `places`

# Current backend modules

- Health:
  - `GET /health`
- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Catalog:
  - `GET /place-types`
  - `GET /seasons`
- Places:
  - `GET /places`
  - `GET /places/:id`
  - `POST /places/recommendations`
- Place interactions:
  - `POST /places/:id/like`
  - `DELETE /places/:id/like`
  - `GET /places/:id/likes`
  - `GET /places/:id/comments`
  - `POST /places/:id/comments`
- Route build sessions:
  - `POST /route-build-sessions`
  - `POST /route-build-sessions/:id/actions`
  - `GET /route-build-sessions/:id/recommendations`
  - `POST /route-build-sessions/:id/finalize`
- Routes:
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
  - `GET /routes/shared/:token`
  - `POST /routes/shared/:token/access`
  - `PATCH /routes/shared/:token`
- Posts:
  - `GET /posts`
  - `GET /posts/:id`
  - `POST /posts`
  - `PATCH /posts/:id`
  - `DELETE /posts/:id`

# Canonical database model

- Canonical SQL file:
  - `back/sql/create_product_schema.sql`
- Real canonical init command:
  - `npm run db:init:product`
- Canonical current tables:
  - `auth_users`
  - `place_types`
  - `seasons`
  - `places`
  - `place_seasons`
  - `place_likes`
  - `place_comments`
  - `routes`
  - `route_places`
  - `route_access`
  - `route_share_links`
  - `route_build_sessions`
  - `route_build_session_places`
  - `posts`
- Legacy compatibility table:
  - `wineries`
  - retained only as a migration source / compatibility bridge
- Helper-only SQL files that remain in the repo:
  - `back/sql/create_auth_tables.sql`
    - isolated helper, aligned with canonical `auth_users`
  - `back/sql/create_place_interactions_tables.sql`
    - isolated helper, aligned with canonical `places`
  - `back/sql/create_wineries_table.sql`
    - legacy helper for the pre-canonical raw winery table

# Current places model

- Canonical runtime table:
  - `places`
- Public `GET /places` / `GET /places/:id` response contract intentionally preserves the existing snake_case shape:
  - `external_id`
  - `source_location`
  - `card_url`
  - `logo_url`
  - `photo_urls`
  - `coordinates_raw`
- Additional fields now available in the places response:
  - `short_description`
  - `type_slug`
  - `season_slugs`
  - `estimated_cost`
  - `estimated_duration_minutes`
  - `radius_group`
  - `is_active`
- `GET /places/:id` still uses the internal numeric `places.id`

# Place taxonomy and seasonality

- `place_types` is the normalized place category dictionary.
- `seasons` is the normalized season dictionary.
- `place_seasons` is mandatory in the canonical model:
  - every canonical place should be represented through one or more `place_seasons` rows
- Current legacy winery CSV lacks season-level metadata, so the import/bootstrap currently attaches all seeded seasons to imported winery rows until richer source data exists.

# Place recommendations

- `POST /places/recommendations`
- Request supports:
  - `season_id` or `season_slug`
  - `anchor_place_id`
  - `exclude_place_ids`
  - `radius_km`
  - `limit`
- Recommendation strategy:
  - filters by season
  - excludes already seen/selected ids
  - if an anchor place is present, prefers:
    - same `radius_group`
    - or same `source_location`
    - or geo distance within the requested radius if coordinates exist
- Response returns place records plus `distance_km`

# Current place interactions model

- Like endpoints remain:
  - `POST /places/:id/like`
  - `DELETE /places/:id/like`
  - `GET /places/:id/likes`
- Comment endpoints remain:
  - `GET /places/:id/comments`
  - `POST /places/:id/comments`
- Auth rules:
  - read likes summary: public, optional auth
  - read comments: public
  - write like/comment: auth required
- Like behavior:
  - idempotent like
  - idempotent unlike
- Comment behavior:
  - fetch-based only
  - newest first
  - no realtime
- Canonical relation target is now `places`, not `wineries`

# Current auth flow

- Registration:
  - `POST /auth/register`
  - returns `{ user, token }`
- Login:
  - `POST /auth/login`
  - returns `{ user, token }`
- Current user:
  - `GET /auth/me`
  - bearer token required
- Auth user storage:
  - `auth_users` now also contains `is_guide` and `avatar_url`
- Public auth response contract was preserved:
  - still only returns `{ id, email }` for the user object

# Current routes model

- Core route table:
  - `routes`
- Ordered places table:
  - `route_places`
- Explicit non-owner access:
  - `route_access`
- Share links:
  - `route_share_links`
- Owner model:
  - owner stored on `routes.owner_user_id`
  - `route_access` is only for non-owner attached access
- Supported `creation_mode` values:
  - `quiz`
  - `selection_builder`
  - `manual`
  - `shared_copy`

# Collaborative route editing

- Conflict safety is implemented with `revision_number`.
- The backend rejects stale writes with `409 Route revision conflict`.
- Route writes that depend on revision checking:
  - `PATCH /routes/:id`
  - `DELETE /routes/:id`
  - `POST /routes/:id/places`
  - `PATCH /routes/:id/places/:routePlaceId`
  - `DELETE /routes/:id/places/:routePlaceId`
  - `PATCH /routes/shared/:token`
- Share-link behavior:
  - `POST /routes/:id/share` creates a token
  - `GET /routes/shared/:token` opens the route publicly
  - `POST /routes/shared/:token/access` attaches the shared route to the authenticated user's route list
  - `PATCH /routes/shared/:token` edits through the token when `can_edit` is enabled

# Quiz route flow

- `POST /routes/from-quiz`
- Current behavior:
  - accepts quiz payload and optional generated place ids
  - persists a route with `creation_mode = 'quiz'`
  - does not implement real ML yet
  - if generated place ids are omitted, it falls back to the current recommendation query boundary

# Route build session flow

- `route_build_sessions` stores the temporary state for mobile swipe / desktop board route creation.
- `route_build_session_places` stores per-place decisions:
  - `accepted`
  - `rejected`
  - `saved`
- Current flow:
  - `POST /route-build-sessions`
  - `POST /route-build-sessions/:id/actions`
  - `GET /route-build-sessions/:id/recommendations`
  - `POST /route-build-sessions/:id/finalize`
- Finalization creates a persisted route with `creation_mode = 'selection_builder'`.

# Posts / inspiration model

- Table:
  - `posts`
- Current filters on `GET /posts`:
  - `guide=true`
  - `guide=false`
  - `mine=true`
- `guide` filtering is backed by `auth_users.is_guide`
- Post ownership rules:
  - only the owner can `PATCH /posts/:id`
  - only the owner can `DELETE /posts/:id`
- No likes/comments on posts yet

# Current import and bootstrap flow

- Canonical schema bootstrap:
  - `npm run db:init:product`
- Canonical schema dry run:
  - `npm run db:init:product -- --dry-run`
- Canonical place import:
  - `npm run db:import:places`
- Canonical import dry run:
  - `npm run db:import:places -- --dry-run`
- Import source:
  - `/Users/leo/Downloads/scrapping.csv`
- Canonical bootstrap status:
  - `create_product_schema.sql` is now self-contained for a fresh product DB
  - it no longer depends on running `db:init:auth` first
  - the documented canonical schema and the actual SQL/bootstrap files are now aligned
  - helper SQL files still exist, but they are no longer the primary init path
- Import behavior:
  - upserts into `places`
  - uses the seeded `winery` place type
  - stores `photo_urls` as JSON arrays
  - assigns all seeded seasons to imported rows
  - uses `source_location` as the initial `radius_group` fallback

# Swagger / OpenAPI

- Spec endpoint:
  - `GET /openapi.json`
- UI endpoint:
  - `GET /api-docs`
- Coverage includes:
  - auth
  - health
  - place taxonomy
  - places
  - place interactions
  - route build sessions
  - routes and share links
  - posts

# Frontend compatibility preserved

- Auth endpoints stayed unchanged:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Public places endpoints stayed in place:
  - `GET /places`
  - `GET /places/:id`
- Place id convention stayed unchanged for the public contract:
  - internal numeric id
- Place interaction endpoints stayed under `/places/:id/...`
- Existing frontend like/comment behavior should continue to work against the current routes.

# Current CORS/browser support

- Centralized in `src/app.ts`
- Allowed methods:
  - `GET`
  - `POST`
  - `PATCH`
  - `DELETE`
  - `OPTIONS`
- Requested headers are mirrored for preflight support.
- This now covers route editing endpoints that use `PATCH`, in addition to the earlier auth and unlike flows.

# Env variables used by backend

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`

# Known limitations

- No formal migration framework yet; canonical DB setup is still raw SQL bootstrap.
- Legacy databases still need the canonical bootstrap to be executed so the FK repair steps can move `place_likes` / `place_comments` onto canonical `places`.
- Until `npm run db:init:product` is actually applied against a live database, the documented canonical structure should be treated as SQL-complete and dry-run-verified rather than DB-executed in this workspace.
- Legacy winery source data does not contain real season metadata, so all seasons are attached during import as a temporary compatibility decision.
- `POST /routes/from-quiz` is a persistence wrapper around a placeholder route-generation boundary, not a real ML integration.
- No realtime collaboration or websocket merge resolution exists; route conflicts are handled by optimistic locking only.
- Live DB-backed runtime verification is still limited by the existing PostgreSQL connectivity problem; current verification is compile/build/openapi/app-start and dry-run based.

# Pending tasks

- Introduce a real migration framework.
- Add real ML integration behind `POST /routes/from-quiz`.
- Enrich place seasonality from product data instead of the current all-seasons fallback.
- Add stronger geo/radius modeling if the product needs more precise nearby logic.
- Add route/history or audit logging if collaboration becomes more complex.
- Add tests beyond compile/build sanity.

# Important decisions

- Canonical place runtime table is now `places`.
- `wineries` is legacy compatibility only.
- Owner is stored only on `routes.owner_user_id`.
- `route_access` stores non-owner access only.
- Share-token editing is public by token when `can_edit = true`.
- Optimistic locking through `revision_number` is mandatory for route mutations.
- Swagger/OpenAPI is maintained manually in `src/swagger/openapi-spec.ts`.

# Handoff notes

- Canonical schema and endpoint documentation now live in:
  - `back/backend_db_structure.md`
- Verification completed in this overhaul:
  - `npm run check`
  - `npm run build`
  - `npm run db:init:product -- --dry-run`
  - `npm run db:import:places -- --dry-run`
  - `npm run db:init:auth -- --dry-run`
  - `npm run db:init:place-interactions -- --dry-run`
  - Node app startup sanity via `createApp()`
  - OpenAPI load sanity from built output
  - in-process CORS preflight sanity for `PATCH`
