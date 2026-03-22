[2026-03-22] - Док: Chrome Private Network Access vs публичный frontend + `localhost` API

Type: docs

What changed:
	•	**`memory_backend.md`** (раздел CORS/browser): пояснение, что блокировка запросов с публичной страницы на **`http://localhost:3000`** — ограничение браузера (PNA), а не CORS middleware; ссылка на **`front/src/lib/apiBaseUrl.ts`** и **`front/memory_frontend.md`**.

Why it changed:
	•	При **`vite preview --host`** и доступе по IP консоль показывала CORS/PNA на посты и другие `fetch` к loopback; бэкенд при этом мог быть настроен корректно.

Files touched: `back/memory_backend.md`, `back/changes_backend.md`

⸻

[2026-03-22] - Совместное редактирование по шарингу: OpenAPI + согласование доков с `route_access` / `revision_number`

Type: docs (OpenAPI + markdown; поведение модуля routes без изменений в этой записи)

What changed:
	•	**`openapi-spec.ts`**: уточнены описания **`POST /routes/shared/:token/access`**, **`GET/PATCH /routes/{id}`**, **`POST /routes/{id}/places`**, **`POST /routes/{id}/share`** — одна строка **`routes`**, выдача **`route_access`** (`collaborator` при `can_edit`, иначе `viewer`), оптимистичная блокировка **`revision_number`**, **`409`** при рассинхроне для владельца и коллабораторов.
	•	**`memory_backend.md`**, **`backend_db_structure.md`**: роли владелец / коллаборатор / зритель, привязка к **`POST .../access`**, список **`GET /routes?scope=accessible`** на фронте для «Мои туры».

Why it changed:
	•	Шаринг должен явно документироваться как совместное редактирование **того же** маршрута с безопасными сохранениями, а не только просмотр по ссылке.

Files touched: `back/src/swagger/openapi-spec.ts`, `back/memory_backend.md`, `back/backend_db_structure.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build`

⸻

[2026-03-22] - Документация шаринга: SPA `/routes/shared/:token` и публичный `GET /routes/shared/:token`

Type: chore (docs; контракт без изменения runtime-кода модуля routes в этой задаче)

What changed:
	•	**`backend_db_structure.md`**: уточнена модель шаринга — публичный **`GET /routes/shared/:token`**, привязка **`POST /routes/shared/:token/access`**, сборка пользовательской ссылки только на frontend-origin; добавлены UI-допущения для **`RouteSharedPage`**.
	•	**`memory_backend.md`**: снято упоминание о «pending» shared-screen; зафиксирована связка с фронтом.

Why it changed:
	•	Фронтенд реализовал экран общего доступа по токену; документация должна совпадать с фактическим E2E-потоком и разделением API vs public app URL.

Files touched: `back/backend_db_structure.md`, `back/memory_backend.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build` (как часть общей проверки репозитория)

⸻

[2026-03-22] - `POST /routes/from-quiz`: отели/еда без day-budget, компакт основных точек

Type: fix (quiz route hospitality + geo spread)

What changed:
	•	**`findPlacesForQuizClustered`**: доминирующий **`radius_group`** считается только по **не-hospitality** местам; выбор отеля и ресторана/гастро идёт с **широким** диапазоном `estimated_cost` (0…1e9), а не с «бюджетом на человека за день», иначе отели/ужины отсекались и в маршрут попадали одни винодельни.
	•	**`routes.service`**: после финализации **`mainIds`** — **`compactMainPlaceIdsByCentroid`** (~95 км от центроида): отбрасываются дальние выбросы, чтобы линия маршрута не растягивалась на сотни км; для «умеренный»/«спокойный» винодельня сдвинута ниже в приоритете типов.

Why it changed:
	•	Пользовательский сценарий: в маршруте должны появляться отель и заведения питания, точки — географически ближе друг к другу.

Files touched: `back/src/modules/places/places.repository.ts`, `back/src/modules/routes/routes.service.ts`, `back/changes_backend.md`

Checks: `cd back && npm run check`

⸻

[2026-03-22] - `POST /routes/from-quiz`: кластер `radius_group`, отели/рестораны, разнообразие типов

Type: feature / fix (quiz route realism)

What changed:
	•	**`places.repository`**: **`findPlacesForQuizClustered`** — доминирующий **`radius_group`**, основные места без отелей/ресторанов, отдельно отель и гастро/ресторан в том же районе.
	•	**`routes.service`**: v2-квиз использует кластер; при пустом отеле/еде — глобальный пул кандидатов + **`pickClosestPlaceIds`** к центроиду основных точек; **`mergeQuizRouteStops`** (еда в середине, отель в конце); приоритеты **`mainAttractionTypePreferences`** без перегруза виноделен; рекомендации-fallback фильтруют hospitality.
	•	Доки: **`memory_backend.md`**, **`backend_db_structure.md`**, **`changes_backend.md`**.

Why it changed:
	•	Маршрут не должен состоять только из виноделен по всему краю; нужны ночёвка/еда и точки в одном районе.

Files touched: `back/src/modules/places/places.types.ts`, `back/src/modules/places/places.repository.ts`, `back/src/modules/routes/routes.service.ts`, `back/memory_backend.md`, `back/backend_db_structure.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build`

⸻

[2026-03-22] - `POST /routes/from-quiz`: гео-порядок остановок (запад → nearest-neighbor)

Type: fix (quiz route polyline / UX)

What changed:
	•	**`routes.service`**: после выбора id мест для квиза (v2 и legacy) порядок **`sort_order`** пересчитывается: эффективные координаты как у рекомендаций (`lat`/`lon` или `coordinates_raw`), старт с **минимальной долготы**, далее **жадный nearest-neighbor** по грубой дистанции км; места без координат — в конец в исходном относительном порядке.

Why it changed:
	•	Подбор только по типу/сезону/id давал «зигзаги» на карте; нужен более логичный путь по региону.

Files touched: `back/src/modules/routes/routes.service.ts`, `back/memory_backend.md`, `back/backend_db_structure.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build`

⸻

[2026-03-22] - `POST /routes/from-quiz`: продуктовый квиз + rule-based подбор мест

Type: feature (quiz → saved route)

What changed:
	•	Тело запроса: основной набор **`people_count`**, **`season`** (spring/summer/autumn/winter/fall, `fall` → autumn в БД), **`budget_from`**, **`budget_to`**, **`excursion_type`** (активный/умеренный/спокойный), **`days_count`**; опционально **`title`**, **`description`**. Legacy по-прежнему: **`quiz_answers`** + опционально **`season_slug`**, **`desired_place_count`**, **`generated_place_ids`**.
	•	**`routes.service`**: ветка v2 — подбор id через **`PlacesRepository.findPlacesForQuizBuild`** (сезон, бюджет на человека, порядок предпочтения **`place_types.slug`**), fallback без бюджета и сезонный fallback как у рекомендаций; **`total_estimated_cost`** и **`total_estimated_duration_minutes`** для квиз-маршрута.
	•	**`places.repository`**: новый метод **`findPlacesForQuizBuild`**.
	•	**`routes.schemas`**, OpenAPI **`CreateRouteFromQuizBody`**, документация **`memory_backend.md`**, **`backend_db_structure.md`**.

Why it changed:
	•	Хакатонный сценарий «квиз → сохранённый маршрут» без реальной ML-модели, с предсказуемой логикой на существующем каталоге мест.

Files touched: `back/src/modules/places/places.types.ts`, `back/src/modules/places/places.repository.ts`, `back/src/modules/routes/routes.schemas.ts`, `back/src/modules/routes/routes.service.ts`, `back/src/modules/routes/routes.controller.ts`, `back/src/swagger/openapi-spec.ts`, `back/memory_backend.md`, `back/backend_db_structure.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build`

⸻

[2026-03-22] - `POST /places/recommendations`: optional `type_slug` filter (same-type shortlist)

Type: feature

What changed:
	•	Optional body field **`type_slug`**: adds `place_types.slug = $n` to recommendation queries (anchored + season-only fallback).
	•	`places.schemas.ts`, `places.types.ts`, `places.repository.ts`, OpenAPI **`PlaceRecommendationsRequest`**, docs in **`memory_backend.md`** / **`backend_db_structure.md`**.

Why it changed:
	•	Frontend `/places` route builder should, after the first pick, suggest only a few more places of the **same category** as the anchor.

Files touched: `back/src/modules/places/places.schemas.ts`, `back/src/modules/places/places.types.ts`, `back/src/modules/places/places.repository.ts`, `back/src/swagger/openapi-spec.ts`, `back/memory_backend.md`, `back/backend_db_structure.md`, `back/changes_backend.md`

Checks: `cd back && npm run check && npm run build`

⸻

[2026-03-22] - `POST /places/recommendations`: consistent distance_km, effective coords, ordering, broad fallback

Type: feature / fix (recommendations)

What changed:
	•	`back/src/modules/places/places.repository.ts`: рекомендации с якорём строятся через CTE **`anchor`** с **eff_lat / eff_lon** — координаты из колонок или разбор **`coordinates_raw`** (простой шаблон `"lat,lon"`). **`distance_km`** считается для каждой строки, если у якоря и кандидата есть эффективные координаты, независимо от того, по какому из трёх правил (radius_group / source_location / радиус) кандидат прошёл фильтр. Сортировка: **`distance_km` ASC NULLS LAST**, затем совпадение **`radius_group`** с якорём, затем **`places.id`**. Если якорный фильтр дал **0** строк, выполняется fallback-запрос только по сезону и **`exclude_place_ids`**; в ответ добавляется флаг.
	•	`back/src/modules/places/places.types.ts`, `places.service.ts`: опциональное поле ответа **`recommendation_broad_fallback`**.
	•	`back/src/swagger/openapi-spec.ts`: задокументировано **`recommendation_broad_fallback`**.
	•	`back/memory_backend.md`, `back/backend_db_structure.md`: описание контракта и поведения.

Why it changed:
	•	На фронте часто пропадал **`distance_km`** при совпадении по **`radius_group`/`source_location`**, хотя координаты у обеих точек были; нужна предсказуемая сортировка «ближе к якорю» и честный fallback, когда рядом больше нечего показать.

Files touched:
	•	back/src/modules/places/places.repository.ts
	•	back/src/modules/places/places.types.ts
	•	back/src/modules/places/places.service.ts
	•	back/src/swagger/openapi-spec.ts
	•	back/memory_backend.md
	•	back/backend_db_structure.md
	•	back/changes_backend.md

Checks:
	•	`cd back && npm run check` — успешно.
	•	`cd back && npm run build` — успешно.
	•	Загрузка собранного OpenAPI из `dist` — успешно.

⸻

[2026-03-22] - Panorama route page: no backend/API changes

Type: chore (docs only)

What changed:
	•	Frontend added `/routes/:id/panorama` using the existing `GET /routes/:id` response (ordered places with coordinates, photos, types, text fields) and existing route-place write endpoints for save sync.
	•	Documented in backend memory that no new routes module endpoints or response-shape changes were required for this feature.

Why it changed:
	•	Keep backend memory aligned with how the frontend consumes route detail for the new Google Street View flow.

Files touched:
	•	back/changes_backend.md
	•	back/memory_backend.md

Checks:
	•	`cd back && npm run check` — успешно.
	•	`cd back && npm run build` — успешно.

⸻

[2026-03-22 08:15] - Clarify token-only share contract for the fixed `/routes/:id` page

Type: chore

What changed:
	•	Documented that `/routes/:id` no longer treats the backend as the public share origin: the backend continues to return a token from `POST /routes/:id/share`, while the frontend now builds the final copied URL from its own public app origin.
	•	Clarified that no backend runtime endpoint change was required for this fix pass: the existing token-based share response remains valid, and the route-review page only changed how it turns that token into a user-facing link.
	•	Updated backend memory/DB-structure docs so the current contract explicitly states that frontend share URLs use the future-safe frontend route shape `/routes/shared/:token`.
	•	Re-verified backend sanity with `npm run check`, `npm run build`, built OpenAPI load sanity, and `createApp()` startup sanity after the route-page fix pass.

Why it changed:
	•	The previous route-page implementation copied `http://localhost:3000/routes/shared/<token>`, which tied the user-facing share URL to the backend host and was not deployment-safe once frontend and backend live on different origins.

Files touched:
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-22 07:57] - Clarify route-detail save/share contract for the upgraded `/routes/:id` page

Type: chore

What changed:
	•	Confirmed that the upgraded frontend `/routes/:id` page now uses the existing route contract without backend runtime code changes: `GET /routes/:id` for detail, `POST/PATCH/DELETE /routes/:id/places` for persisting add/remove/reorder edits, and `POST /routes/:id/share` for temporary share-link creation.
	•	Documented that the current route detail payload still does not include concrete shared-recipient users, so the frontend intentionally renders a placeholder/shared-link status in the “Поделились с” block instead of a real recipient list.
	•	Recorded the current temporary share behavior: the route page copies the backend shared-token URL `GET /routes/shared/:token` until a dedicated frontend deeplink screen exists.
	•	Verified the existing backend route contract still compiles and boots cleanly with `npm run check`, `npm run build`, built OpenAPI load sanity, and `createApp()` startup sanity after the frontend integration work.

Why it changed:
	•	The route review page now depends on a real save/share flow, so backend memory and DB-structure docs need to reflect the current contract and its present limitations even though the backend code itself did not need a new endpoint for this iteration.

Files touched:
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-22 07:29] - Speed up paged places loading and remove canonical `external_id`

Type: feature

What changed:
	•	Removed `external_id` from the canonical `places` runtime schema and public place serializer. `places` now keeps an internal-only `import_key` for canonical importer/upsert identity, while `/places` and `/places/:id` expose only the numeric `id`.
	•	Updated `back/sql/create_product_schema.sql` so existing databases migrate old `external_id` values into `import_key`, drop the legacy column, add `places_is_active_id_idx`, and keep the legacy `wineries` bridge working through `import_key`.
	•	Updated the canonical importer `back/src/scripts/import-places.ts` to stop storing/sending `external_id`, to upsert by internal `import_key`, and to fall back to a natural-key match (`name + type + rounded coordinates`) when adopting pre-existing place rows.
	•	Updated the places and routes repositories plus OpenAPI so nested/public place payloads no longer include `external_id`.
	•	Optimized `GET /places` list loading by first selecting only the paged place ids and then hydrating details/season slugs for that page slice, instead of expanding full place rows before pagination.
	•	Verified `cd front && npm run lint`, `cd front && npm run build`, `cd back && npm run check`, `cd back && npm run build`, `cd back && npm run db:init:product -- --dry-run`, OpenAPI load sanity, app startup sanity, and `cd back && npm run db:import:places -- --dry-run /Users/leo/shduahdskja/places_with_images_all_in_one_repriced_image_urls_updated.csv`.

Why it changed:
	•	The biggest places-feed slowdown was frontend overfetching, but the backend also still carried legacy `external_id` fields through the canonical schema and place serializers.
	•	The runtime app should use only canonical numeric `places.id`, while the importer still needs a stable internal identity for idempotent updates.

Files touched:
	•	back/sql/create_product_schema.sql
	•	back/src/modules/places/places.repository.ts
	•	back/src/modules/places/places.types.ts
	•	back/src/modules/routes/routes.repository.ts
	•	back/src/scripts/import-places.ts
	•	back/src/swagger/openapi-spec.ts
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-22 06:12] - Add owned-only route list scope for `/myroutes`

Type: feature

What changed:
	•	Extended `GET /routes` with a backward-compatible query param `scope`, where `scope=owned` now returns only routes created by the authenticated user and the default `scope=accessible` keeps the previous owned + shared-access behavior.
	•	Updated the routes query validation, service, and repository flow so `/myroutes` can consume a clean owned-routes contract without frontend-side filtering hacks.
	•	Updated Swagger/OpenAPI for `GET /routes` to document the new `scope` query param and its default behavior.
	•	Verified `npm run check`, `npm run build`, OpenAPI load sanity, and app startup sanity after the route-list contract change.

Why it changed:
	•	The new frontend `/myroutes` page must show only user-created routes in this iteration, while the general backend route model still supports shared access for later UI work.
	•	A dedicated owned-only scope keeps the list contract explicit and avoids coupling the frontend to internal `access_type` filtering rules.

Files touched:
	•	back/src/modules/routes/routes.schemas.ts
	•	back/src/modules/routes/routes.service.ts
	•	back/src/modules/routes/routes.repository.ts
	•	back/src/swagger/openapi-spec.ts
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-22 05:37] - Keep far-distance CSV places as low-confidence imports

Type: fix

What changed:
	•	Updated `back/src/scripts/import-places.ts` so the canonical importer no longer drops deduped places solely because they are more than `100km` from the expected `city_used` center.
	•	Kept the existing dedupe and candidate ranking rules, but converted the city-distance threshold into an import-quality marker: far-distance rows are now imported with `import_confidence = 'low'` and their `city_distance_km` stored for backend visibility.
	•	Extended `back/sql/create_product_schema.sql` so canonical `places` now includes `import_confidence` and `city_distance_km`, with additive `ALTER TABLE` support for existing databases and a confidence check constraint.
	•	Updated the importer summary to report low-confidence imports explicitly while reserving hard drops for true validation failures only.
	•	Reran `npm run check`, `npm run build`, `npm run db:init:product -- --dry-run`, `npm run db:import:places -- --dry-run`, app startup sanity, and OpenAPI load sanity.
	•	New dry-run result for the canonical CSV is now: `500` rows read, `500` valid candidates, `432` kept places, `0` dropped rows, `68` duplicate rows removed, `432` place-season links, and `100` low-confidence imports.
	•	Retried a real `npm run db:import:places`, but it again stalled at the PostgreSQL connection layer and had to be stopped; the runtime DB reachability limitation remains unchanged.

Why it changed:
	•	The previous `implausible_city_distance` rule was too destructive for the current CSV and discarded otherwise valid places simply because the best deduped coordinate candidate was far from the expected city center.
	•	The backend needs to preserve as much usable place content as possible while still retaining explicit visibility into lower-confidence geo imports.

Files touched:
	•	back/src/scripts/import-places.ts
	•	back/sql/create_product_schema.sql
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-22 05:22] - Rework canonical places import for the new 500-row CSV source

Type: feature

What changed:
	•	Rewrote `back/src/scripts/import-places.ts` so `npm run db:import:places` now uses `/Users/leo/Documents/superkiper/back/places_with_images_all_in_one_repriced_image_urls_updated.csv` as the canonical source of truth for place content import.
	•	Added canonical CSV transformation rules in code: `type_name` -> `place_types`, `season_slugs` with `fall -> autumn`, `primary_image_url` -> first `photo_urls` item, derived `short_description`, `website_url` -> `card_url`, `city_used` -> `radius_group`, and derived `coordinates_raw`.
	•	Implemented non-destructive canonical dedupe logic with synthetic stable `external_id` values because the CSV raw `external_id` column has severe collisions and cannot be trusted globally.
	•	Dedupe priority is now: unique raw `external_id`, otherwise `name + city_used + type_name`, otherwise `name + coordinates`; duplicate groups choose the candidate closest to the expected city center, then better image quality, then richer description / earlier row.
	•	Added a row-quality guard that drops records only when required fields are missing/invalid or when the best deduped candidate is more than `100km` from the expected city center, because those coordinates are treated as implausible for the target region.
	•	Dry-run validation of the current CSV now reports: `500` rows read, `500` minimally valid candidates, `332` kept canonical places, `68` duplicate rows collapsed, `100` rows dropped for `implausible_city_distance`, and `10` CSV-derived place types.
	•	Attempted a real `npm run db:import:places`, but the run stalled at the database connection layer and had to be stopped; this matches the existing backend DB reachability limitation rather than a transformation error in the importer itself.
	•	Updated backend docs so the canonical import path, CSV source, type/season/photo mapping, dedupe rules, defaults, and dropped-row behavior match the actual importer.

Why it changed:
	•	The previous canonical importer was still built around the older winery CSV and did not understand the new backend-owned CSV shape or the canonical taxonomy/season schema.
	•	The new CSV has broken raw ids and many duplicate geo candidates, so the backend needed a real transformation pipeline instead of a simple row upsert.

Files touched:
	•	back/src/scripts/import-places.ts
	•	back/changes_backend.md
	•	back/memory_backend.md
	•	back/backend_db_structure.md

⸻

[2026-03-21 22:41] - Make the canonical DB bootstrap self-contained and resolve legacy SQL conflicts

Type: fix

What changed:
	•	Corrected `back/sql/create_product_schema.sql` so the canonical bootstrap now creates `auth_users` itself, not just the product tables that depended on it.
	•	Added canonical bootstrap repair steps that re-point existing `place_likes` and `place_comments` foreign keys to `places`, so legacy interaction tables no longer stay bound to `wineries` after the canonical schema is applied.
	•	Updated `back/sql/create_auth_tables.sql` so the standalone auth helper now matches the documented auth schema with `is_guide` and `avatar_url`.
	•	Updated `back/sql/create_place_interactions_tables.sql` so the standalone interaction helper now references canonical `places` instead of legacy `wineries`.
	•	Confirmed that the real canonical DB init path remains `npm run db:init:product`, while `db:init:auth`, `db:init:place-interactions`, and `db:init:wineries` remain as helper/legacy scripts rather than the primary product bootstrap.
	•	Verified `npm run check`, `npm run build`, `npm run db:init:product -- --dry-run`, `npm run db:import:places -- --dry-run`, `npm run db:init:auth -- --dry-run`, `npm run db:init:place-interactions -- --dry-run`, built OpenAPI loading, app startup sanity, and in-process `PATCH` preflight support.

Why it changed:
	•	The previously documented canonical architecture was not fully real on a fresh database because the canonical product SQL still depended on the older auth bootstrap.
	•	Legacy helper SQL also still contained conflicting references to `wineries`, which would leave place-interaction FKs inconsistent with the documented canonical schema.

Files touched:
	•	back/sql/create_product_schema.sql
	•	back/sql/create_auth_tables.sql
	•	back/sql/create_place_interactions_tables.sql
	•	back/backend_db_structure.md
	•	back/changes_backend.md
	•	back/memory_backend.md

⸻

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
