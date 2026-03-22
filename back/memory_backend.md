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
  - the public places contract now uses only numeric `id`; `external_id` is no longer exposed
  - place interaction endpoints remain under `/places/:id/...`
- Frontend memory files are used as compatibility context before backend contract changes so the public app flows stay aligned.

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
- Internal importer identity:
  - `places.import_key`
  - backend-only, not exposed in public API payloads
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
- Public `GET /places` / `GET /places/:id` response contract intentionally preserves the existing snake_case shape for user-facing fields:
  - `source_location`
  - `card_url`
  - `logo_url`
  - `photo_urls`
  - `coordinates_raw`
- Public place payloads no longer include `external_id`
- Canonical runtime identifier is now only:
  - `id`
- Additional fields now available in the places response:
  - `short_description`
  - `type_slug`
  - `season_slugs`
  - `estimated_cost`
  - `estimated_duration_minutes`
  - `radius_group`
  - `is_active`
- Internal-only place import metadata stored in `places`:
  - `import_key`
  - `import_confidence`
  - `city_distance_km`
- `GET /places/:id` still uses the internal numeric `places.id`
- `GET /places` list performance path:
  - first counts filtered rows
  - then selects only the current page of `places.id`
  - then hydrates detailed place rows + season slugs only for that page slice
  - this keeps the paged list query cheaper for feed/catalog usage

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
  - if an anchor place is present, candidates must match **one of**:
    - same `radius_group`
    - same `source_location`
    - geo distance within `radius_km` using **effective coordinates** (DB lat/lon, or parsed `coordinates_raw` when it looks like `"lat,lon"`)
- **`distance_km`:** filled whenever both anchor and candidate have effective coordinates, regardless of which of the three relevance rules admitted the row (not only the strict geo branch).
- **Ordering:** `distance_km` ascending (nulls last), then same `radius_group` as anchor, then stable `places.id`.
- **Broad fallback:** if the anchored filter returns no rows, the service runs a second **season + exclude-only** query and sets optional `recommendation_broad_fallback: true` in the JSON so clients can label wider results (distances are usually null in that path).
- Optional **`type_slug`:** restricts candidates to a single place type (`place_types.slug`); `/places` uses it with a small `limit` so post-first-pick recommendations stay same-category.
- Response returns place records plus `distance_km` and optional `recommendation_broad_fallback`.

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
- Route list behavior:
  - `GET /routes` with default `scope=accessible` returns owned routes plus any routes attached through `route_access`
  - `GET /routes?scope=owned` returns only routes where `routes.owner_user_id = current user id`
  - frontend `/myroutes` uses `scope=accessible` so users see owned routes plus any row in `route_access` (collaborative edit or view-only)
- Current `/routes/:id` page behavior against the backend contract:
  - `GET /routes/:id` provides the route summary + ordered places for page load
  - the frontend persists add/remove/reorder edits by chaining:
    - `POST /routes/:id/places`
    - `PATCH /routes/:id/places/:routePlaceId`
    - `DELETE /routes/:id/places/:routePlaceId`
  - the frontend respects optimistic locking via `revision_number` for all editors (owner and collaborators); `409 Route revision conflict` surfaces as an explicit conflict UI with reload-from-server (no silent overwrite)
  - the frontend currently does not patch route title/description/season from `/routes/:id`; the save action only persists route-place composition/order
  - the route page uses `POST /routes/:id/share` to create a temporary share token and builds the copied public URL on the frontend as `{VITE_PUBLIC_APP_URL || window.location.origin}/routes/shared/:token`; the SPA route `/routes/shared/:token` (`RouteSharedPage`) loads the route via public `GET /routes/shared/:token` and may call `POST /routes/shared/:token/access` when a logged-in user attaches the route
  - the route detail payload still does not include concrete shared-recipient users, so the frontend shows placeholder/shared-link status text in the “Поделились с” panel
  - the frontend `/routes/:id/panorama` page reuses the same `GET /routes/:id` payload (ordered `places` with embedded `place` objects including `lat`, `lon`, `photo_urls`, `type_slug`, descriptions) and the same route-place mutation chain for its “save” action; no new backend endpoints were added for panorama

# Collaborative route editing

- **Same route row:** invited users work on `routes.id` the owner created; `route_access` grants non-owner access. No `shared_copy` is required for collaboration.
- **Roles:** `owner` — full edit + delete route + create share links. `collaborator` (from share with `can_edit=true` via `POST /routes/shared/:token/access`) — same route-place and metadata mutations as owner, subject to `revision_number`. `viewer` — read-only. `shared` in `route_access` remains a legacy/edit bucket in code paths; attach flow uses `collaborator` or `viewer`.
- Conflict safety is implemented with `revision_number` on `routes`; every successful mutating place/metadata operation bumps it.
- The backend rejects stale writes with `409 Route revision conflict` (`ROUTE_REVISION_CONFLICT` in repository).
- Route writes that depend on revision checking:
  - `PATCH /routes/:id`
  - `DELETE /routes/:id`
  - `POST /routes/:id/places`
  - `PATCH /routes/:id/places/:routePlaceId`
  - `DELETE /routes/:id/places/:routePlaceId`
  - `PATCH /routes/shared/:token`
- Share-link behavior:
  - `POST /routes/:id/share` creates a token (`can_edit` stored on `route_share_links`); requires current user to have edit access (owner or collaborator).
  - `GET /routes/shared/:token` returns public detail + `can_edit` flag.
  - `POST /routes/shared/:token/access` upserts `route_access`: `collaborator` if link `can_edit`, else `viewer`, so the user can call authenticated `GET/PATCH /routes/:id` and place endpoints on the **same** route id.
  - `PATCH /routes/shared/:token` edits through the token when `can_edit` is enabled (alternative to JWT route endpoints).
- Frontend:
  - Share URL is app-origin `/routes/shared/:token`; after attach, user edits at `/routes/:id` like the owner.
  - `/myroutes` lists `scope=accessible` so collaborative routes appear with access badges.
  - Conflict UX on save: reload latest route from server when `409`.
- `GET /routes/:id` still does not return a recipient list for “shared with” chips.

# Quiz route flow

- `POST /routes/from-quiz`
- **Основной контракт (фронт квиза):** `people_count`, `season` (`spring` | `summer` | `autumn` | `winter` | `fall`, `fall` → `autumn`), `budget_from`, `budget_to`, `excursion_type` (`активный` | `умеренный` | `спокойный`), `days_count`, **`city`** (строка 1–120 символов: город/регион — в JSON для ML и фильтр каталога по подстроке в `places.source_location` / `places.address`); опционально `title`, `description`. **Кластер:** среди мест сезона и бюджета «на человека» выбирается доминирующий **`radius_group`**; **основные** остановки (без отелей и ресторанов) набираются только в этом районе через **`findPlacesForQuizClustered`** + приоритет типов **`mainAttractionTypePreferences`** (без перегруза виноделен). В тот же район отдельно подмешиваются **отель** (до 1) и **ресторан/гастро** (до 2); если в районе нет — глобальный пул и выбор ближайших к центроиду основных точек. **Порядок:** основные — запад → nearest-neighbor; еда вставляется около середины цепочки; отель в конце (**`mergeQuizRouteStops`**). Fallback основных: `findPlacesForQuizBuild` / рекомендации без hospitality. **Legacy-ветка** квиза по-прежнему без кластера. Суммарная стоимость и `days_count * 8 * 60` минут — как раньше.
- **Legacy:** объект `quiz_answers` + опционально `season_slug`, `desired_place_count`, `generated_place_ids` — прежняя ветка через `findRecommendations` без якоря.
- **ML-квиз:** если задан **`ML_QUIZ_ROUTE_URL`** (полный URL `POST …/v1/quiz/route`), `POST /routes/from-quiz` сначала запрашивает **`place_ids`** у ML, фильтрует по активным местам в Postgres, упорядочивает **запад → nearest-neighbor** (`orderQuizPlaceIdsGeographically`) и сохраняет маршрут; при ошибке сети, пустом ответе или меньше двух точек — прежний rule-based подбор. Таймаут: **`ML_QUIZ_ROUTE_TIMEOUT_MS`** (по умолчанию 20s).

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
  - importer default still points to `/Users/leo/Documents/superkiper/back/places_with_images_all_in_one_repriced_image_urls_updated.csv`
  - that repo-local CSV is currently absent in this workspace
  - latest verified dry run used an explicit CLI path: `/Users/leo/shduahdskja/places_with_images_all_in_one_repriced_image_urls_updated.csv`
- Explicit-path import form:
  - `npm run db:import:places -- /absolute/path/to/places_with_images_all_in_one_repriced_image_urls_updated.csv`
- Canonical bootstrap status:
  - `create_product_schema.sql` is now self-contained for a fresh product DB
  - it no longer depends on running `db:init:auth` first
  - the documented canonical schema and the actual SQL/bootstrap files are now aligned
  - helper SQL files still exist, but they are no longer the primary init path
- Canonical CSV transformation rules:
  - `type_name` is treated as the canonical place-type slug and upserted into `place_types`
  - importer can create missing type slugs from the CSV beyond the original SQL seed set
  - `season_slugs` is normalized into canonical backend seasons with `fall -> autumn`
  - missing or invalid season values fall back to all four canonical seasons
  - `primary_image_url` is treated as the primary photo and becomes the first item in `photo_urls`
  - `photo_urls` field is parsed as extra image sources when present
  - `website_url` maps into `card_url`
  - `logo_url` stays `NULL` because the CSV does not provide it
  - `short_description` is derived from `description` at roughly 200 chars with a word-boundary cutoff
  - `estimated_cost` is parsed as numeric
  - `estimated_duration_minutes` is currently left `NULL` because CSV `estimated_duration` values are not reliable enough to interpret as minutes
  - `radius_group` now uses `city_used`, not the region-wide `source_location`
  - `coordinates_raw` is derived as `"latitude,longitude"`
  - `city_distance_km` stores the computed distance from the expected `city_used` center when that center is known
  - `import_confidence` is `high` by default and becomes `low` for rows that exceed the `100km` city-distance threshold
- Dedupe rules:
  - raw `external_id` is only trusted as a dedupe key when it is unique in the CSV
  - when `external_id` collides, dedupe falls back to `name + city_used + type_name`
  - final fallback is `name + coordinates`
  - canonical DB `import_key` is synthesized deterministically as a unique stable internal key using source/raw id/hash so the importer stays idempotent even when the CSV raw ids collide
  - importer upsert/adoption strategy is:
    - first exact match by `import_key`
    - otherwise fallback match by natural key: `name + type_slug + rounded latitude/longitude`
  - duplicate groups are resolved by choosing the candidate closest to the expected city center, then by image quality, then by richer description / earlier row
- Drop rules:
  - rows are dropped immediately only if `name` is missing or `latitude` / `longitude` is invalid
  - rows are no longer dropped solely for large city-distance values
  - after dedupe, candidates more than `100km` from the expected `city_used` center are kept as low-confidence imports instead
- Current dry-run result for the new CSV:
  - `500` rows read
  - `500` valid candidates after minimal validation
  - `432` canonical places kept
  - `68` duplicate candidate rows collapsed
  - `0` final rows dropped
  - `100` low-confidence imports retained because they exceed the `100km` city-distance threshold
  - `10` place types derived
  - `432` `place_seasons` links produced

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
- Frontend now consumes the optimized paged list path and no longer expects `external_id` in public place payloads.
- Frontend routes area now depends on:
  - `GET /routes?scope=accessible` for `/myroutes` (owned + `route_access`)
  - `GET /routes/:id` for route detail
  - `POST /routes/:id/places`, `PATCH /routes/:id/places/:routePlaceId`, `DELETE /routes/:id/places/:routePlaceId` for route-detail save
  - `POST /routes/:id/share` for share-token creation, with the final public URL assembled on the frontend
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
- **Private Network Access (Chrome):** если страница открыта с **публичного IP/домена** (типично `npm run preview --host`), а клиент шлёт `fetch` на **`http://localhost:3000`**, браузер режет запрос (в консоли часто выглядит как CORS и *«resource is in more-private address space `loopback`»*) — это ограничение браузера, не отсутствие заголовков на бэке. SPA должна звать API на **тот же публичный хост** (порт **`PORT`**) или задать **`VITE_API_BASE_URL`**. Реализация на фронте: **`front/src/lib/apiBaseUrl.ts`**, описание — **`front/memory_frontend.md`**.

# Env variables used by backend

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`

# Known limitations

- No formal migration framework yet; canonical DB setup is still raw SQL bootstrap.
- Legacy databases still need the canonical bootstrap to be executed so the FK repair steps can move `place_likes` / `place_comments` onto canonical `places`.
- Until `npm run db:init:product` is actually applied against a live database, the documented canonical structure should be treated as SQL-complete and dry-run-verified rather than DB-executed in this workspace.
- Legacy winery source data does not contain real season metadata, so all seasons are attached during import as a temporary compatibility decision.
- The repo-local default CSV path for `npm run db:import:places` is currently absent in this workspace; importer verification requires passing an explicit CSV file path.
- The new canonical CSV source has major raw `external_id` collisions and many coordinate candidates that are far from the expected city; the importer compensates with synthetic internal `import_key` values, city-aware dedupe, and low-confidence import metadata instead of hard-dropping those rows.
- Low-confidence imports are currently stored only as backend/internal metadata in `places`; the public `/places` API does not surface that flag yet.
- No realtime collaboration or websocket merge resolution exists; route conflicts are handled by optimistic locking only.
- Route detail still does not expose a concrete recipient list for “shared with”; the current frontend page therefore uses placeholder/shared-link status text rather than actual recipient chips.
- The frontend share URL uses `/routes/shared/:token` under the public app origin; the shared-route screen is implemented and calls the backend API origin separately (`VITE_API_BASE_URL`), so split frontend/backend deployments remain valid.
- Live DB-backed runtime verification is still limited by the existing PostgreSQL connectivity problem; current verification is compile/build/openapi/app-start and dry-run based.
- A real `npm run db:import:places` attempt against the configured DB was started in this workspace but stalled at the connection layer and was stopped, so the importer is transformation-complete and dry-run verified but not confirmed against a live reachable DB from this environment.

# Pending tasks

- Introduce a real migration framework.
- При необходимости — заменить rule-based ветку `POST /routes/from-quiz` на реальную ML-интеграцию (сейчас намеренно отсутствует).
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
  - canonical new-CSV dry run summary: 500 raw rows -> 432 kept places, 100 low-confidence imports, 0 validation drops
  - live `npm run db:import:places` attempt blocked by DB connection hang
  - **2026-03-22:** `POST /places/recommendations` — effective coords from `coordinates_raw`, consistent `distance_km`, ordering, broad fallback flag — см. **`back/changes_backend.md`**
