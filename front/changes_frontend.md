# Frontend change log

Новые записи добавляются **сверху** (сначала самые свежие).

---

## [2026-03-22] - Лендинг: секция «Как работает сервис» (`#how`) — только мобильная вёрстка

**Type:** fix (responsive layout, `max-sm` only)

**What changed:**
- **`pages/LandingPage.tsx`:** секция **`#how`** на **`max-sm`** переведена в колонку (**`max-sm:flex-col max-sm:gap-8`**), текст на полную ширину (**`max-sm:max-w-none`**, **`min-w-0`** у обёртки), абзац с чуть плотнее межстрочным интервалом только на мобиле (**`max-sm:leading-[1.65]`**); иллюстрация — **`max-sm:w-full`**, **`object-contain`**, ограничение высоты **`max-sm:max-h-[min(48vh,380px)]`**, **`decoding="async"`**, **`alt=""`**; порядок в DOM: сначала текст, затем картинка.
- На **`sm+`** сохранены прежние **`flex`-ряд** и **`gap-12`**, отступы **`px`/`py`** как до правки; десктопная композиция не менялась намеренно.

**Testing:** `cd front && npm run lint`, `npm run build` — два прохода подряд, успешно.

---

## [2026-03-22] - «Впечатления» `/impressions`: вкладка «Мои посты» — публикация из сохранённого маршрута (POST /posts)

**Type:** feature (create post from owned route)

**What changed:**
- **`features/posts/postsApi.ts`:** **`createPost(token, { content, image_urls?, title? })`** — **`POST /posts`** (Bearer), тело в **`snake_case`** как у **`createPostSchema`** на бэке.
- **`components/ImpressionsMyPostsTab.tsx`:** форма «Мои посты»: **`GET /routes?scope=owned`** через **`fetchAllUserRoutes`**, выбор маршрута, **`GET /routes/:id`** для остановок и превью, **`image_urls`** из **`getPrimaryDisplayPhotoUrl`** по порядку остановок (до 20 уникальных URL), textarea, **`Опубликовать`**, список **`GET /posts?mine=true`**; гость — **`requestAuthModalOpen`**; пустой список маршрутов — CTA на **`/places`** / **`/myroutes`**.
- **`pages/ImpressionsPage.tsx`:** левая мини-навигация — переключение **«Маршруты пользователей»** / **«Мои посты»**; лента общих постов не трогается при смене вкладки; после успешного создания поста — **`reloadKey`** для обновления ленты.
- **`memory_frontend.md`**, **`changes_frontend.md`**.

**Testing:** `cd front && npm run lint`, `npm run build` — два прохода подряд, успешно.

---

## [2026-03-22] - Страница «Впечатления» `/impressions`: лента постов, мини-навигация, «Построить маршрут» через POST /routes

**Type:** feature (posts feed + route from post)

**What changed:**
- **`features/posts/postsApi.ts`:** **`GET /posts`**, парсинг **`PostsListResult`** / **`PublicPostItem`** (snake_case: **`image_urls`**, **`is_guide`**, даты строками).
- **`features/posts/postPlaceHydration.ts`:** индекс URL фото каталога → **`PublicPlace`**; слоты по **`image_urls`** поста; **`orderedUniquePlaceIdsFromSlots`**. В контракте поста нет **`place_ids`** — сопоставление по URL **`photo_urls`** мест.
- **`pages/ImpressionsPage.tsx`:** шапка как у каталога/моих туров; слева мини-блок (**«Маршруты пользователей»** активен; **«Готовые маршруты»**, **«Мои посты»** — заглушки); **«Новые посты»**; карточка: email, по одному фото на URL в посте, текст (**`whitespace-pre-wrap`**), список точек, **`Построить маршрут`** → **`createRouteFromSelection`** + **`navigate(/routes/:id)`**; гость → **`requestAuthModalOpen`**; **`fetchPostsList`** + **`fetchAllPlaces()`**; фильтр **`!author.is_guide`** без query **`guide=false`** (из‑за **`z.coerce.boolean`** и строки `"false"`).
- **`App.tsx`:** **`/impressions`**.
- **`LandingPage`**, **`PlacesCatalogPage`**, **`MyRoutesPage`:** **«Впечатления»** → **`/impressions`**.
- **`memory_frontend.md`**, **`changes_frontend.md`**.

**Testing:** `cd front && npm run lint`, `npm run build` — два прохода подряд, успешно.

---

## [2026-03-22] - Совместное редактирование маршрута по ссылке (одна запись, revision, UX)

**Type:** feature (collaborative share/edit, conflict handling)

**What changed:**
- **`MyRoutesPage`**: список через **`GET /routes?scope=accessible`** — видны свои и приглашённые маршруты; на карточках бейдж **«Совместное редактирование»** / **«Только просмотр»**; обновлены тексты intro / auth wall.
- **`RouteDetailPage`**: при **`409`** при сохранении — отдельное состояние **`conflict`**, блок с кнопкой **«Загрузить актуальную версию с сервера»**; подсказка для **`access_type === collaborator`**; **`ShareModal`** — флаг **`collaborativeEdit`** и зелёный блок про совместное редактирование и версии; при создании ссылки сохраняется **`shareCollaborative`** из **`link.can_edit`**.
- **`RouteSharedPage`**: владелец видит переход на **`/routes/:id`** без **`access`**; приглашённый — явные подписи кнопок **«…и редактировать»** / **(просмотр)**; тексты про один маршрут на сервере и не-live синхронизацию.
- **`RoutePanoramaPage`**: **`409`** при сохранении → режим **`conflict`** и кнопка **«Загрузить с сервера»**.

**Why it changed:**
- Шаринг должен означать работу **с тем же маршрутом**, что и владелец, с ручным сохранением и безопасной обработкой конфликтов **`revision_number`**, а не только просмотр по ссылке.

**Files touched:** `front/src/pages/MyRoutesPage.tsx`, `front/src/pages/RouteDetailPage.tsx`, `front/src/pages/RouteSharedPage.tsx`, `front/src/pages/RoutePanoramaPage.tsx`, `front/memory_frontend.md`, `front/changes_frontend.md`.

**Testing:** `cd front && npm run lint && npm run build`.

---

## [2026-03-22] - Шаринг маршрута: страница `/routes/shared/:token` и публичный fetch по токену

**Type:** feature / fix (route sharing E2E)

**What changed:**
- Добавлена **`RouteSharedPage`**: маршрут **`/routes/shared/:token`** в **`App.tsx`** (объявлен **выше** **`/routes/:id`**, чтобы путь не матчился как числовой id).
- **`features/routes/routesApi.ts`**: **`fetchSharedRouteByToken`** — **`GET /routes/shared/:token`** без JWT; **`attachSharedRouteToUser`** — **`POST /routes/shared/:token/access`**; тип **`SharedRouteDetail`** (**`UserRouteDetail`** + **`share_can_edit`** из **`can_edit`** в JSON).
- Просмотр по ссылке: карта (**`RouteYandexMap`**), сводка, основные точки и «отдых/еда», ссылки на **`/places/:id`**, состояния загрузки / ошибки / «Повторить». Для авторизованных — **«Добавить в Мои туры»** с редиректом на **`/routes/:id`**.
- Модалка «Поделиться» на **`/routes/:id`**: текст обновлён — ссылка ведёт на реальный экран приложения, а не «позже».

**Why it changed:**
- Раньше копируемая публичная ссылка не имела рабочего экрана в SPA; теперь цепочка share → открытие → просмотр (и опционально attach) работает при раздельных origin фронта и API.

**Files touched:** `front/src/pages/RouteSharedPage.tsx`, `front/src/App.tsx`, `front/src/pages/RouteDetailPage.tsx`, `front/src/features/routes/routesApi.ts`, `front/memory_frontend.md`, `front/changes_frontend.md`, `back/memory_backend.md`, `back/changes_backend.md`, `back/backend_db_structure.md`.

**Testing:** `cd front && npm run lint && npm run build`; `cd back && npm run check && npm run build`.

---

## [2026-03-22] - `/places`: рекомендации — сдерживать уже выбранные типы, показывать остальные по близости

**Type:** fix / feature (route builder UX)

**What changed:**
- Убран режим «после первого выбора только **`type_slug`** якоря и **`limit` 6»**.
- **`fetchPlaceRecommendations`** вызывается с **`limit` 32** без **`type_slug`**; ответ фильтруется, сортируется по **`distance_km`**, затем **`diversifyRecommendationsBySelectedTypes`**: не больше **3** новых карточек на каждый тип, уже попавший в маршрут; до **24** карточек в блоке.
- Подзаголовок секции рекомендаций обновлён под эту логику.

**Why it changed:**
- Продукт: если пользователь уже добавил, например, ресторан, дальше нужны в основном **другие** категории рядом с якорем, а не ещё пачка ресторанов.

**Files touched:** `front/src/pages/PlacesCatalogPage.tsx`, `front/memory_frontend.md`, `front/changes_frontend.md`.

**Testing:** `cd front && npm run lint && npm run build`.

---

## [2026-03-22] - `/routes/:id/panorama`: Яндекс Панорамы вместо Google iframe

**Type:** feature / refactor (карты Яндекса)

**What changed:**
- Удалён **`googlePanoramaUrls.ts`** (ранее URL для iframe Google).
- Добавлены **`routePanoramaHelpers.ts`** (координаты, порядок остановок, дефолтная точка) и **`RouteYandexPanoramaView.tsx`** на **`@pbe/react-yandex-maps`** (**`Panorama`** + **`Map`** со спутником).
- **`RoutePanoramaPage`**: вместо **`<iframe>`** — **`RouteYandexPanoramaView`**, ключ **`VITE_YANDEX_MAPS_API_KEY`**; без ключа — подсказка в UI.
- Зависимость **`@pbe/react-yandex-maps`**, для React 19 — **`legacy-peer-deps`** (см. **`front/.npmrc`**).
- Обновлены **`memory_frontend.md`**, комментарий в **`routeReviewHelpers.ts`**.

**Why it changed:**
- Единый стек карт с каталогом (Яндекс), интерактивная панорама через официальный JS API 2.1.

**Files touched:** `front/src/pages/RoutePanoramaPage.tsx`, `front/src/components/RouteYandexPanoramaView.tsx`, `front/src/features/routes/routePanoramaHelpers.ts`, `front/src/features/routes/routeReviewHelpers.ts`, `front/package.json`, `front/package-lock.json`, `front/.npmrc`, `front/memory_frontend.md`, `front/changes_frontend.md` (удалён `googlePanoramaUrls.ts` при наличии в репо).

**Testing:** `cd front && npm run lint && npm run build`.

---

## [2026-03-22] - Квиз-маршрут: порядок точек на карте (доки)

**Type:** chore (docs; логика на бэкенде)

**What changed:** В **`memory_frontend.md`** уточнено, что порядок остановок квиз-маршрута задаётся сервером (гео-упорядочивание).

**Backend:** см. **`back/changes_backend.md`** — `RoutesService` + nearest-neighbor.

---

## [2026-03-22] - Квиз → сохранённый маршрут: `POST /routes/from-quiz`, экран «сборки», один сезон

**Type:** feature (quiz route builder, mock «генерация»)

**What changed:**
- **`features/quiz/quizStore.ts`**: один выбранный **`season`** вместо массива **`seasons`**; **`setSeason`**; **`seasonSlugToQuizApi`** (осень → `fall` в JSON API).
- **`data/quizSteps.ts`**: шаг сезона с **`kind: 'season'`** (один выбор).
- **`features/quiz/QuizPage.tsx`**: прогресс «шаг N из 5», полоса прогресса, радио-выбор сезона, кнопки **«Назад»** / **«Далее»**.
- **`pages/QuizDonePage.tsx`**: сводка ответов, **«Собрать маршрут»** (гость → **`requestAuthModalOpen`**), экран загрузки с ротацией статусов **~6.6 с** параллельно с **`createRouteFromQuiz`** (**`Promise.all`** с задержкой), редирект на **`/routes/:id`**.
- **`features/routes/routesApi.ts`**: **`createRouteFromQuiz`**, тип **`CreateRouteFromQuizInput`**.
- Обновлены **`front/memory_frontend.md`**, **`front/changes_frontend.md`**.

**Why it changed:**
- Продуктовый флоу квиза с имитацией подбора маршрута и реальной записью маршрута в БД через бэкенд.

**Backend:** см. **`back/changes_backend.md`** (`POST /routes/from-quiz`).

**Files touched:** `front/src/features/quiz/quizStore.ts`, `front/src/data/quizSteps.ts`, `front/src/features/quiz/QuizPage.tsx`, `front/src/pages/QuizDonePage.tsx`, `front/src/features/routes/routesApi.ts`, `front/memory_frontend.md`, `front/changes_frontend.md`

**Testing:** `cd front && npm run lint && npm run build`; `cd back && npm run check && npm run build`.

---

## [2026-03-22] - `/routes/:id/panorama`: iframe Google без ключей API в приложении

**Type:** refactor (встраивание как «обычный» embed)

**What changed:**
- Убраны **Maps JavaScript API**, **`GoogleMapsPanoramaPane`**, **`googleMapsJsLoader`**, переменная **`VITE_GOOGLE_MAPS_API_KEY`**, devDependency **`@types/google.maps`**, тип **`google.maps`** в **`tsconfig.app.json`**.
- **`RoutePanoramaPage`**: снова **`<iframe src={...}>`**; URL собираются в **`googlePanoramaUrls.ts`**: **`buildGoogleKeylessStreetViewEmbedUrl`** (`maps.google.com/maps`, **`layer=c`**, **`cbll`**, **`output=svembed`**) и **`buildGoogleKeylessSatelliteMapEmbedUrl`** (`www.google.com/maps`, **`output=embed`**, **`t=k`** для спутника).
- **`readme.md`**, **`vite-env.d.ts`**: панорама не требует своего ключа в **`.env`**.

**Why it changed:**
- Запрос: встроить карту/улицу через **iframe**, **без** ключей Maps API в проекте.

**Files touched:** `front/src/pages/RoutePanoramaPage.tsx`, `front/src/features/routes/googlePanoramaUrls.ts`, удалены `front/src/components/GoogleMapsPanoramaPane.tsx`, `front/src/lib/googleMapsJsLoader.ts`, `front/package.json`, `front/package-lock.json`, `front/tsconfig.app.json`, `front/src/vite-env.d.ts`, `front/readme.md`, `front/memory_frontend.md`, `front/changes_frontend.md`.

**Testing:** `cd front && npm run lint && npm run build`.

---

## [2026-03-22] - `/places`: рекомендации после первого выбора — только тот же тип, мало карточек

**Type:** feature (route builder)

**What changed:**
- После того как в маршруте есть ≥1 место и у якоря известен **`type_slug`**, **`fetchPlaceRecommendations`** отправляет **`type_slug`** и **`limit: 6`**; иначе **`limit: 24`** без фильтра типа.
- Подзаголовок блока рекомендаций поясняет режим «до 6 точек той же категории».
- **`features/places/placesApi.ts`**: тело запроса поддерживает **`type_slug`**.

**Backend:** опциональный **`type_slug`** в **`POST /places/recommendations`** (см. **`back/changes_backend.md`**).

**Files touched:** `front/src/pages/PlacesCatalogPage.tsx`, `front/src/features/places/placesApi.ts`, `front/memory_frontend.md`, `front/changes_frontend.md`, `back/...`

**Testing:** `cd front && npm run lint && npm run build`; `cd back && npm run check && npm run build`.

---

## [2026-03-22] - `/places`: реактивные рекомендации, якорь, дистанция и broad-fallback

**Type:** feature / fix (route builder UX + recommendations)

**What changed:**
- **`pages/PlacesCatalogPage.tsx`**: сигнатура перезапроса рекомендаций **`recSignature`** теперь включает **`anchorPlaceId`** (раньше смена якоря без изменения списка выбранных не триггерила fetch). При смене зависимостей сразу **`setRecommendationsLoading()`**, debounce **~160ms**, ответ фильтруется по актуальному **`selectedIds`/`swipeRejectedIds`**; в стор передаётся **`recommendation_broad_fallback`**. Секция рекомендаций: заголовок **«Следующие точки маршрута»**, подзаголовок с якорем и сезоном, предупреждение при broad-fallback; сортировка рекомендаций по **`distance_km`**, затем **`id`**. В липкой панели чипы: клик по **имени** точки — **`setRouteAnchor`** (подсветка якоря).
- **`features/routeCart/routeCartStore.ts`**: **`recommendationsBroadFallback`**, **`setRouteAnchor`**, **`setRecommendationsResult(items, broadFallback?)`**.
- **`features/places/placesApi.ts`**: парсинг **`recommendation_broad_fallback`**, **`formatRecommendationDistanceKm`**.
- **`components/PlacesSwipeDeck.tsx`**: чип расстояния на верхней карточке при наличии **`distance_km`**.

**Why it changed:**
- Подбор из «Места» должен обновляться при якоре/корзине/пропусках и ясно показывать расстояние и режим «широкого» fallback.

**Backend:** см. **`back/changes_backend.md`** (`POST /places/recommendations`).

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/features/routeCart/routeCartStore.ts`
- `front/src/features/places/placesApi.ts`
- `front/src/components/PlacesSwipeDeck.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`
- `back/changes_backend.md`
- `back/memory_backend.md`
- `back/backend_db_structure.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- `cd back && npm run check && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id/panorama`: Street View через Maps JavaScript API (без Embed / iframe)

**Type:** refactor (тот же UX, другой способ встраивания)

**What changed:**
- Вместо iframe **`maps/embed/v1/streetview`** и **`.../view`** используется **Maps JavaScript API**: **`lib/googleMapsJsLoader.ts`** подключает **`https://maps.googleapis.com/maps/api/js?key=...&loading=async`**, **`components/GoogleMapsPanoramaPane.tsx`** создаёт **`google.maps.StreetViewPanorama`** и при режиме «Улица» вызывает **`StreetViewService.getPanorama`** (радиус 100 м, **`NEAREST`**); при отсутствии панорамы — подсказка переключиться на «Карта»; режим «Карта» — **`google.maps.Map`** со спутником. Типы: devDependency **`@types/google.maps`**.
- **`pages/RoutePanoramaPage.tsx`**: вместо **`iframeSrc`** — пропсы **`lat`/`lng`** в панель; текст про ключ — **Maps JavaScript API** и ссылка на [Street View for Web](https://developers.google.com/streetview/web).
- **`features/routes/googlePanoramaUrls.ts`**: удалены **`buildGoogleStreetViewEmbedUrl`** / **`buildGoogleMapViewEmbedUrl`**; остались координаты, **`getDefaultPanoramaStopIndex`**, **`orderedRoutePlaceRows`**.
- **`vite-env.d.ts`**, **`front/readme.md`**, **`memory_frontend.md`**: ключ **`VITE_GOOGLE_MAPS_API_KEY`** описан под JS API, не Embed API.

**Why it changed:**
- Требование продукта: интерактивный Street View через JS API, в духе официального обзора [Street View for Web](https://developers.google.com/streetview/web).

**Files touched:**
- `front/src/lib/googleMapsJsLoader.ts` (новый)
- `front/src/components/GoogleMapsPanoramaPane.tsx` (новый)
- `front/src/pages/RoutePanoramaPage.tsx`
- `front/src/features/routes/googlePanoramaUrls.ts`
- `front/package.json` / `package-lock.json` (`@types/google.maps`)
- `front/tsconfig.app.json` — в **`compilerOptions.types`** добавлен **`google.maps`** (вместе с **`vite/client`**), чтобы **`window.google`** и **`google.maps.*`** проходили **`tsc`**
- `front/src/vite-env.d.ts`
- `front/readme.md`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` и `npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id/panorama`: отдельная страница Google Street View + навигация по точкам

**Type:** feature (замена Yandex-модалки)

**What changed:**
- **Новый маршрут** **`/routes/:id/panorama`** (`App.tsx` — объявлен **выше** **`/routes/:id`**). Страница **`pages/RoutePanoramaPage.tsx`**: полноэкранный layout, **синяя боковая панель** со списком всех остановок маршрута в порядке **`sort_order`**, миниатюра (**`getPrimaryDisplayPhotoUrl`**), заголовок, сниппет описания, бейдж **«Отдых / еда»** для hospitality-type; точки **без координат** неактивны. **Справа** — крупный **iframe** Google (**Street View** или **спутник** переключателем «Улица» / «Карта»). Выбор точки в сайдбаре меняет **`src`** iframe (**свои координаты на каждую точку**). Кнопка **«← К маршруту»** → **`/routes/:id`**. **«Сохранить маршрут»** вызывает тот же **`syncRouteStopsToServer`**, что и review-страница (после **`GET /routes/:id`** синхронизирует состав с сервером; без локальных правок — подтверждение без изменений).
- **`features/routes/googlePanoramaUrls.ts`**: **`buildGoogleStreetViewEmbedUrl`**, **`buildGoogleMapViewEmbedUrl`**, **`placeHasPanoramaCoordinates`**, **`getDefaultPanoramaStopIndex`**, **`orderedRoutePlaceRows`**. URL: **`https://www.google.com/maps/embed/v1/streetview`** и **`.../view`** (нужен **`VITE_GOOGLE_MAPS_API_KEY`**). Дефолтная точка: первая **не** hospitality с координатами, иначе первая с координатами. Query **`?place=<place_id>`** задаёт стартовую точку (компонент с **`key`** сбрасывает ручной выбор при смене query).
- **`features/routes/syncRouteStopsToServer.ts`**: вынесена логика синхронизации остановок из **`RouteDetailPage`** (импорт в review и panorama).
- **`pages/RouteDetailPage.tsx`**: удалены **PanoramaModal**, Yandex iframe, состояние панорамы; кнопка **«360 / Панорама»** — **`Link`** на **`/routes/:id/panorama`**.
- **`features/routes/routeReviewHelpers.ts`**: удалены **`buildPanoramaEmbedUrl`** и **`getRoutePanoramaTargetPlace`** (Yandex).
- **`vite-env.d.ts`**: **`VITE_GOOGLE_MAPS_API_KEY`**. **`front/readme.md`**: заметка про ключ.

**Why it changed:**
- Продукт: панорама не в модалке, переключение **по каждой** точке маршрута, провайдер **Google**.

**Backend:**
- Изменений API не требуется: используется существующий **`GET /routes/:id`** (места с **`lat`/`lon`**, **`photo_urls`**, **`type_slug`**, описание).

**Files touched:**
- `front/src/pages/RoutePanoramaPage.tsx` (новый)
- `front/src/pages/RouteDetailPage.tsx`
- `front/src/features/routes/googlePanoramaUrls.ts` (новый)
- `front/src/features/routes/syncRouteStopsToServer.ts` (новый)
- `front/src/features/routes/routeReviewHelpers.ts`
- `front/src/App.tsx`
- `front/src/vite-env.d.ts`
- `front/readme.md`
- `front/memory_frontend.md`
- `front/changes_frontend.md`
- `back/changes_backend.md`
- `back/memory_backend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- `cd back && npm run check && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id`: карта ~60vh (clamp до 720px)

**Type:** UX (route detail polish)

**What changed:**
- **`pages/RouteDetailPage.tsx`**: высота контейнера карты **`clamp(220px, 60vh, 720px)`** вместо 40vh / max 520px.

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id`: карта ~40vh, отдельный скролл правой колонки

**Type:** UX (route detail layout)

**What changed:**
- **`pages/RouteDetailPage.tsx`**: высота карты **`clamp(220px, 40vh, 520px)`**. На **`lg`** **`main`** снова **`overflow-hidden`**, **`grid-rows-[minmax(0,1fr)]`**, **`h-full` / `min-h-0`**, чтобы строка сетки занимала оставшуюся высоту под шапкой; **правая колонка** (`aside`) с **`lg:h-full`**, **`lg:overflow-y-auto`**, **`lg:overscroll-contain`** — прокручивается только она, страница в целом не уезжает. **Левая колонка** при переполнении имеет **`lg:overflow-y-auto`** (редкий случай). Внутренние **`max-h`** у списков точек убраны: один общий скролл по правой панели.

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id`: компактная карта, кнопки под картой, скролл `main` вместо `overflow-hidden`

**Type:** fix (route detail layout)

**What changed:**
- **`pages/RouteDetailPage.tsx`**: карта с **`clamp`-высотой** и пропом **`compact`** у **`RouteYandexMap`**; блок **«360 / Панорама»**, **«Сохранить»**, **«Поделиться»** и тексты под ними перенесены **под карту** в левую колонку; блок **«Карта маршрута»** + дистанция — ниже. Убран **`lg:overflow-hidden`** у корня; **`main`** с **`overflow-y-auto`**, **`lg:items-start`** и без жёсткой строки сетки **`1fr`** — правая колонка не сжимается из‑за «высоты на весь экран» левой. **`aside`** — простой столбец без четырёхрядной сетки; списки точек с **`max-h-[min(…)]`** и **`overflow-y-auto`**.
- **`components/RouteYandexMap.tsx`**: опциональный **`compact`** ( **`min-h-0`**, без **`flex-1`** на корне).
- **`features/routes/routeReviewHelpers.ts`**: комментарий, что модуль — логика без UI.

**Why it changed:**
- Перекрытие нижних кнопок из‑за фиксированного **`100dvh`** + **`overflow-hidden`** и конкурирующих **`1fr`**-рядов в сайдбаре; целевой UX — меньшая карта и действия сразу под ней (как в референсе).

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/src/components/RouteYandexMap.tsx`
- `front/src/features/routes/routeReviewHelpers.ts`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id`: fix clipped route sections in the right sidebar

**Type:** fix (route review layout)

**What changed:**
- **`pages/RouteDetailPage.tsx`**: desktop review grid now explicitly uses a constrained content row (`lg:grid-rows-[minmax(0,1fr)]`) so the right sidebar is sized from the viewport instead of from overflowing content.
- The **`Основные точки`** and **`Отдых и еда`** list areas are now true `flex-1 min-h-0 overflow-y-auto` scroll regions inside their cards, instead of auto-height blocks that could be clipped out of view by the page shell.
- This keeps the summary card, both route-point sections, and the bottom action row visible together in the desktop 100dvh layout.

**Why it changed:**
- After the route review redesign, the sidebar cards could disappear below the fold because the page shell hid overflow while the two point lists still sized themselves from content height rather than from the available viewport height.

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.

---

## [2026-03-22] - `/routes/:id`: fix map visibility, single panorama modal, frontend-owned share URL, 100vh shell

**Type:** fix (route review UX / layout / share)

**What changed:**
- **`components/RouteYandexMap.tsx`**: fixed the desktop map collapse by keeping a real minimum height on the map container and letting it stretch through an explicit height chain; `/routes/:id` now gives the map column a true viewport-height layout instead of relying on auto height.
- **`pages/RouteDetailPage.tsx`**: page shell rebuilt into a desktop **100dvh** review layout: header at top, map panel on the left, right column with stacked cards, and internal scrolling only inside the two point-list sections. The route page itself no longer needs a normal long desktop page scroll.
- Removed all per-point 360 buttons. Added **one route-level `360 / Панорама` button** that chooses the best representative stop (first main point with coordinates, otherwise first coordinate-bearing stop) and opens a large modal with an embedded iframe instead of redirecting the user out of the app.
- **`features/routes/routeReviewHelpers.ts`** now contains explicit helpers for panorama target selection and embed URL generation, plus a frontend public share URL builder.
- Fixed share-link generation on the route page: copied links are now built as **frontend-owned URLs** via **`VITE_PUBLIC_APP_URL`** with `window.location.origin` fallback for local dev, instead of `http://localhost:3000/...` backend links.
- **`src/vite-env.d.ts`** extended with `VITE_PUBLIC_APP_URL` for the deployment-safe share-link origin.

**Why it changed:**
- The route page had four user-facing regressions at once: the map could collapse on desktop, the page scrolled like a long document instead of fitting the viewport, 360 actions were implemented on each point instead of once for the route, and share links were tied to the backend origin instead of the frontend app origin.

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/src/components/RouteYandexMap.tsx`
- `front/src/features/routes/routeReviewHelpers.ts`
- `front/src/vite-env.d.ts`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- `cd back && npm run check` — успешно.
- `cd back && npm run build` — успешно.
- `node -e "const { createApp } = require('./dist/app'); ..."` — успешно.
- `node -e "const { openApiSpec } = require('./dist/swagger/openapi-spec'); ..."` — успешно.

---

## [2026-03-22] - `/routes/:id`: маршрут-ревью с реальным save/share, сводкой и 360-кнопками

**Type:** feature (route review / save-share UX)

**What changed:**
- **`pages/RouteDetailPage.tsx`** переработана под review-layout: карта слева, справа стек панелей с summary-card, секцией основных точек, отдельной секцией гостиниц/ресторанов и нижним action-row.
- Добавлены summary-метрики маршрута: группа (только для `creation_mode=quiz`), длительность, бюджет, сезон, фактическая длина маршрута и статус шаринга. Длительность считается по hackathon-правилу: **1 день на каждую точку, кроме hotel / guest_house / recreation_base / restaurant / gastro / cheese, минимум 1 день**.
- **`components/RouteYandexMap.tsx`** теперь поднимает дорожные метрики в родителя: если Yandex multi-route отдаёт расстояние, `/routes/:id` показывает его как основную длину маршрута; при сбое маршрутизации используется честный approximate fallback по ломаной между точками.
- Каждая точка маршрута теперь имеет явные действия: открыть место, **360° вид** (через координатный panorama/street-view URL), а при edit-доступе — перемещение вверх/вниз и удаление.
- Локальное редактирование перестало быть тупиковым: страница использует реальные backend route-place endpoints для сохранения порядка/состава маршрута через кнопку **«Сохранить маршрут»**, с учётом `revision_number` и сообщением о конфликте при `409`.
- Кнопка **«Поделиться»** теперь использует существующий backend `POST /routes/:id/share`: создаёт временную ссылку доступа, открывает небольшое share-окно и пытается сразу скопировать URL в буфер.
- **`features/routes/routesApi.ts`** расширен mutation-helper'ами для `POST/PATCH/DELETE /routes/:id/places` и `POST /routes/:id/share`; добавлен helper-модуль **`features/routes/routeReviewHelpers.ts`** для правил duration/season/budget/panorama/grouping.

**Why it changed:**
- Страница `/routes/:id` должна выглядеть как полноценный review/travel-planning экран, а не как локальный session-only редактор.
- Пользователю нужен реальный save action, видимая дистанция маршрута из карты и намеренный share UX уже сейчас, даже если полный deeplink/user-sharing UI будет позже.

**Files touched:**
- `front/src/pages/RouteDetailPage.tsx`
- `front/src/components/RouteYandexMap.tsx`
- `front/src/features/routes/routesApi.ts`
- `front/src/features/routes/routeReviewHelpers.ts`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- `cd back && npm run check` — успешно.
- `cd back && npm run build` — успешно.
- Санити-проверки backend runtime-контракта: `node -e "const { createApp } = require('./dist/app'); ..."` и `node -e "const { openApiSpec } = require('./dist/swagger/openapi-spec'); ..."` — успешно.

---

## [2026-03-22] - `/places`: ленивая подгрузка UI (карточки + чанк колоды)

**Type:** performance (lazy UI)

**What changed:**
- **`pages/PlacesCatalogPage.tsx`**: компонент **`LazyMountCatalogCard`** с **`IntersectionObserver`** (`rootMargin` ~280px / 400px по вертикали) — до появления слота в зоне просмотра показывается лёгкий плейсхолдер той же пропорции, затем монтируется полная **`CatalogPlaceCard`**; обёртка стоит на всех десктопных сетках (каталог без конструктора, «В маршруте», рекомендации, «Ещё из каталога»). **`PlacesSwipeDeck`** подключается через **`React.lazy`** + **`Suspense`** с fallback той же высоты, что у колоды, чтобы вынести свайп-модуль в отдельный JS-чанк на мобиле.
- Уже существующие **`loading="lazy"`** на фото карточек не трогались.

**Why it changed:**
- На длинном каталоге не нужно сразу монтировать десятки тяжёлых карточек; на мобиле тяжёлая логика колоды не обязана попадать в основной бандл до захода на `/places`.

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно; в сборке виден отдельный чанк **`PlacesSwipeDeck-*.js`**.

---

## [2026-03-22] - Ускорение каталога мест и удаление `external_id` из фронтенд-контракта

**Type:** feature / fix (places performance / contract cleanup)

**What changed:**
- **`features/places/placesApi.ts`**: `PublicPlace` больше не содержит `external_id`; добавлены helper'ы для быстрой дозагрузки каталога (`appendUniquePlaces`) и разделены размеры первой страницы и фоновой догрузки.
- **`pages/PlacesCatalogPage.tsx`** больше не блокирует первый рендер полным `fetchAllPlaces()`: теперь страница сначала получает первую страницу `GET /places` (`limit=24`), сразу рендерит каталог и продолжает догружать остальные страницы в фоне более крупными пачками.
- Поиск на `/places` и список рекомендаций в каталоге переведены на `useDeferredValue(query)`, чтобы не пересчитывать большие массивы синхронно на каждый символ.
- **`components/RouteAddStopModal.tsx`** тоже перестала тянуть весь каталог до показа контента: сначала открывается по первой странице, затем догружает остальное в фоне и показывает прогресс по количеству уже загруженных мест.
- Фронтенд-парсинг мест полностью переведён на канонический числовой `id`; сериализация `external_id` больше не ожидается ни в карточках мест, ни в route-detail вложенных местах, ни в селекторе добавления остановки.

**Why it changed:**
- Основная задержка на `/places` была вызвана тем, что страница ждала загрузки всех страниц `GET /places` перед первым рендером, хотя пользователю для старта нужен только первый экран карточек.
- `external_id` больше не нужен в пользовательском контракте: каноническим идентификатором места в приложении теперь является только внутренний числовой `id`.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/components/RouteAddStopModal.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- Логически проверены: быстрый первый рендер `/places`, фоновая догрузка каталога, отсутствие `external_id` в фронтенд-типах/парсерах, работа селектора добавления остановок с числовым `place.id`.

---

## [2026-03-22] - `/myroutes`: страница «Мои Туры», owned-only список маршрутов и новый пункт навигации

**Type:** feature (routes area / navigation)

**What changed:**
- Добавлена новая страница **`/myroutes`**: **`pages/MyRoutesPage.tsx`**. Она показывает только маршруты, созданные текущим пользователем, с loading / empty / error / auth-required состояниями и карточками-ссылками на **`/routes/:id`**.
- **`features/routes/routesApi.ts`** расширен list-логикой: парсинг **`GET /routes`**, типы summary/list, и helper для загрузки owned-only списка через **`scope=owned`**.
- В **`App.tsx`** зарегистрирован маршрут **`/myroutes`**.
- Первичная навигация приведена к продуктовой тройке **`Места` / `Впечатления` / `Мои Туры`**:
  - desktop nav на лендинге;
  - desktop nav и mobile drawer на **`/places`**;
  - desktop nav и mobile drawer на новой странице **`/myroutes`**.
- Для гостя страница **`/myroutes`** показывает чистый auth wall с CTA на существующую auth-модалку и ссылкой в каталог; для пустого списка — отдельный empty state с CTA в **`/places`**.

**Why it changed:**
- Появился отдельный пользовательский раздел «Мои Туры», где в этой итерации нужно показывать только собственные маршруты без shared/collaboration UI.
- Фронтенду был нужен явный сценарий owned-only загрузки списка маршрутов вместо смешивания созданных и shared маршрутов.

**Files touched:**
- `front/src/pages/MyRoutesPage.tsx`
- `front/src/features/routes/routesApi.ts`
- `front/src/App.tsx`
- `front/src/pages/LandingPage.tsx`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- `cd front && npm run lint` — успешно.
- `cd front && npm run build` — успешно.
- Логически проверены: регистрация маршрута **`/myroutes`**, наличие пункта **`Мои Туры`** в desktop nav и mobile drawer каталога, owned-only fetch flow, auth-required / empty / success состояния, переход по карточке в **`/routes/:id`**.

---

## [2026-03-21] - `/routes/:id`: прямое редактирование остановок на странице (добавить / убрать / порядок), синхронизация карты

**Type:** feature (route planner UX)

**What changed:**
- **`features/routes/editableRouteStops.ts`:** тип **`EditableRouteStop`**, **`stopsFromUserRoute`**, **`newClientRouteStop`**, **`editableStopsToRouteRows`** — мост к блокам отелей/ресторанов.
- **`components/RouteAddStopModal.tsx`:** модалка (портал, Escape, **`body` overflow**): **`fetchAllPlaces({ pageLimit: 24 })`**, клиентский поиск, скрытие уже добавленных **`place_id`**, кнопка «Повторить» при ошибке.
- **`pages/RouteDetailPage.tsx`:** локальное состояние **`editorStops`** + **`baselineSig`** (несохранённые правки); секция **«Ключевые точки маршрута»** — **Убрать**, **↑ / ↓**, ссылка на деталь места; **«Добавить остановку»**; **«Сбросить к загруженному»** при **`isDirty`**; карта и счётчик остановок из **`editorStops`**; отели/еда пересчитываются с текущего списка; убран текст про невозможность редактирования на странице; явно указано, что правки **только в сессии вкладки**, **без сохранения на сервер**.
- **`front/memory_frontend.md`**, **`front/changes_frontend.md`**.

**Why it changed:**
- Пользователь должен менять маршрут на самой странице просмотра, без обязательного ухода в каталог.

**Files touched:**
- `front/src/features/routes/editableRouteStops.ts`
- `front/src/components/RouteAddStopModal.tsx`
- `front/src/pages/RouteDetailPage.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: `cd front && npm run lint && npm run build` — успешно.

---

## [2026-03-21] - `/routes/:id`: обзор маршрута — карта Яндекса, маршрут по дорогам, блоки квиза / остановок / отелей и еды

**Type:** feature (route review / result page)

**What changed:**
- **`src/lib/yandexMapsLoader.ts`:** общая загрузка скрипта Maps 2.1, **`getYMaps`**, **`loadYandexMaps2`**, константы центра/зума, **`escapeHtmlForYandexBalloon`**.
- **`components/PlacesYandexMap.tsx`:** переведён на **`yandexMapsLoader`** (без дублирования загрузчика).
- **`components/RouteYandexMap.tsx`:** карта маршрута — нумерованные метки по порядку остановок, **`multiRouter.MultiRoute`** (авто по дорогам) с **`requestfail` → Polyline** между точками; **`fullscreenControl`**.
- **`features/routes/routePlaceGroups.ts`:** разбиение точек маршрута на «гостиницы» (**`hotel`**, **`guest_house`**, **`recreation_base`**) и «поесть» (**`restaurant`**, **`gastro`**) по **`type_slug`**.
- **`pages/RouteDetailPage.tsx`:** layout **карта слева** (липкая на `lg`), **панель справа** — заголовок, CTA **«Изменить остановки»** → **`/places`**, блок **параметры из квиза** только при **`creation_mode === 'quiz'`** и заполненном **`useQuizStore`** (люди, сезоны, бюджет, вид отдыха, дни); иначе для квиз-маршрута — подсказка со ссылкой на **`/quiz/1`**; секции **остановки**, **где остановиться**, **поесть**; skip-link, шапка с логотипом и **`LoginButton`**.
- **`front/memory_frontend.md`**, **`front/changes_frontend.md`**.

**Why it changed:**
- Экран сохранённого маршрута должен совпадать с продуктовым сценарием: карта, линия маршрута, сводка и точки, согласованность с корзиной/каталогом без правок backend.

**Files touched:**
- `front/src/lib/yandexMapsLoader.ts`
- `front/src/components/PlacesYandexMap.tsx`
- `front/src/components/RouteYandexMap.tsx`
- `front/src/features/routes/routePlaceGroups.ts`
- `front/src/pages/RouteDetailPage.tsx`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: `cd front && npm run lint && npm run build` — успешно.

---

## [2026-03-21] - Квиз: иллюстрация с CDN (quizImg1.png)

**Type:** content / assets

**What changed:**
- **`src/data/quizSteps.ts`:** все шаги используют **`QUIZ_ILLUSTRATION_URL`** → `https://storage.yandexcloud.net/hackathon-ss/quizImg1.png`; удалены импорты локальных PNG из `assets/quiz/`.
- **`front/memory_frontend.md`**, **`front/changes_frontend.md`**.

**Files touched:**
- `front/src/data/quizSteps.ts`
- `front/memory_frontend.md`
- `front/changes_frontend.md`

---

## [2026-03-21] - Квиз: 5 вопросов с нужными контролами (число, сезоны, бюджет, вид отдыха, дни)

**Type:** feature / fix (quiz UX)

**What changed:**
- **`src/data/quizSteps.ts`:** ровно **5 шагов** — **«Сколько человек?»**, **«Какой сезон?»**, **«Бюджет?»**, **«Вид отдыха?»**, **«Сколько дней?»**; у каждого шага **`kind`**: `count` | `seasons` | `budget` | `radio`; сезоны — slug **`spring` / `summer` / `autumn` / `winter`** и подписи весна/лето/осень/зима; радио — Активный / Умеренный / Спокойный; удалён лишний шаг про город.
- **`features/quiz/quizStore.ts`:** **`peopleCount`**, **`seasons[]`**, **`budget { from, to }`**, **`restType`**, **`daysCount`**; **`toggleSeason`**, **`setBudgetFrom` / `setBudgetTo`** с **`from <= to`**; **`formatSeasonLabel`**.
- **`features/quiz/QuizPage.tsx`:** рендер по **`kind`** — `number`, чекбоксы, два **`range`**, radio; валидация **`stepIsValid`**; переход только при валидном ответе.
- **`components/QuizNextButton.tsx`:** **`disabled`**.
- **`pages/QuizDonePage.tsx`:** итог по новым полям.
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Согласовать вопросы и типы ответов со спецификацией, без смены **`/quiz/:stepId`** и **`/quiz/done`**.

**Files touched:**
- `front/src/data/quizSteps.ts`
- `front/src/features/quiz/quizStore.ts`
- `front/src/features/quiz/QuizPage.tsx`
- `front/src/components/QuizNextButton.tsx`
- `front/src/pages/QuizDonePage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: повтор — успешно.

---

## [2026-03-21] - `/places` mobile: без крупного заголовка, одно фото в карточке, компактный экран без скролла страницы

**Type:** UX / layout (mobile `/places`)

**What changed:**
- **`PlacesCatalogPage.tsx`:** на **`max-sm`** крупный **`h1`** «Места Краснодарского края» скрыт визуально (**`sr-only`**), на **`sm+`** остаётся как раньше (**`sm:not-sr-only`**); при **`phase === 'ok'`** корень страницы **`max-sm:h-dvh max-sm:overflow-hidden max-sm:flex max-sm:flex-col`**, убраны **`pb-[26rem]`** / лишний нижний отступ на мобиле; **`main`** на мобиле **`flex-1 min-h-0 overflow-hidden`**, уменьшены отступы и поле поиска; колода в **`flex-1`**-обёртке; нижняя панель маршрута на мобиле плотнее (**`py-2`**, **`gap-2`**, **`safe-area`**); текст модалки свайпа без упоминания галереи.
- **`PlacesSwipeDeck.tsx`:** только **одно** изображение через **`getPrimaryDisplayPhotoUrl`**; убраны точки, стрелки и переключение фото; кнопки «Пропуск» / «В маршрут» и ссылка «Подробнее» перенесены **внутрь** карточки (нижняя полоса), высота колоды **`h-[min(calc(100dvh-12.5rem),78dvh)]`**; превью следующей карточки на том же primary.
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Меньше шума и высоты; свайп-механика и корзина без изменений логики.

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/components/PlacesSwipeDeck.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: повтор — успешно.

---

## [2026-03-21] - `/places`: баннер «Конструктор маршрута» заменён на toaster + одно превью якоря

**Type:** UX / polish

**What changed:**
- **`PlacesCatalogPage.tsx`:** большой инлайн-блок «Конструктор маршрута» убран из потока под поиском; вместо него **toaster** через **`createPortal`** (`z-[45]`, под модалками): фиксированная плашка под шапкой на мобиле / справа сверху на **`sm+`**, закрытие по **×**, тот же текст (якорь, сезон, подсказка про свайп / «Создать маршрут»), предупреждение про сезон и ошибка рекомендаций внутри тоста; **одно изображение** — превью **якорного** места (**`AnchorToastThumb`**, primary photo или плейсхолдер).
- Состояние **`builderToastDismissed`**: сброс при **`resetBuilder`** через **`builderStarted === false`**; если тост закрыт и рекомендации упали — компактная **красная полоса** под поиском с текстом ошибки.
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Меньше забирает место у колоды/каталога; поведение ближе к ненавязчивому уведомлению.

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: те же команды повторно — успешно.

---

## [2026-03-21] - `/places` (mobile): модалка подсказки свайпа, «к маршруту» + обзор маршрута, компактная шапка и бургер

**Type:** UX / polish (mobile `/places`)

**What changed:**
- **`PlacesCatalogPage.tsx`:** подсказка «влево = пропуск / вправо = в маршрут» вынесена в **закрываемую модалку** с затемнённым фоном (`createPortal`, `z-[100]`, `bg-black/55`); показ **один раз за сессию** на мобиле при успешной загрузке каталога (`sessionStorage` ключ `kray-places-swipe-hint-seen`); **Escape** и клик по фону закрывают; при открытых оверлеях — **`body` overflow hidden**.
- **Маршрут на мобиле:** полный список остановок **не показывается** в основном layout; внизу — счётчик **«В маршруте: N»** и кнопка **«к маршруту»**, открывающая **модалку обзора** со списком выбранных мест, **«Убрать»**, **«Создать маршрут»**, сбросом конструктора и текстом для гостя; десктоп — прежняя панель с чипами и **«Создать маршрут»** без изменения логики **`handleCreateRoute`** (после успеха модалка обзора закрывается).
- **Шапка каталога на мобиле:** уменьшены вертикальные отступы и размер логотипа; навигация **скрыта за бургером** (`sm:hidden` drawer справа с теми же ссылками); на **`sm+`** — прежний горизонтальный `nav`.
- **`PlacesSwipeDeck.tsx`:** убрана дублирующая инлайн-подсказка по свайпу (текст перенесён в модалку на странице).
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Меньше визуального шума на мобильном свайпе; подсказка и обзор маршрута ощущаются как осознанные шаги; шапка компактнее.

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/components/PlacesSwipeDeck.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: те же команды повторно — успешно.

---

## [2026-03-21] - `/places`: мобильный свайп-режим (Tinder-like) + отклонённые карточки в рекомендациях

**Type:** feature / UX (mobile)

**What changed:**
- **`routeCartStore.ts`:** массив **`swipeRejectedIds`** (persist в sessionStorage вместе с корзиной), экшен **`rejectSwipePlace`**, сброс отклонений при **`resetBuilder`** и при опустошении корзины; в **`POST /places/recommendations`** на `/places` в **`exclude_place_ids`** передаются и выбранные, и отклонённые свайпом id (триггер обновления — общий **`recSignature`**).
- **`PlacesCatalogPage.tsx`:** на **`max-sm`** колода **`PlacesSwipeDeck`** (свайп влево → пропуск, вправо → **`addPlace`** / маршрут); источник колоды — после старта конструктора сначала рекомендации, отсортированные по **`distance_km`**, затем доп. каталог; до конструктора — видимый каталог без корзины и без отклонённых; сетка конструктора и обычный каталог — только **`sm+`** (`hidden sm:grid` / `hidden sm:flex`); поиск и баннер конструктора общие; отступ снизу увеличен на мобиле под колоду и панель.
- **`PlacesSwipeDeck.tsx`:** новый компонент — указательное перетаскивание, порог вылета, лёгкий поворот (отключается при **`prefers-reduced-motion`** через **`useSyncExternalStore`**), последовательный просмотр **`photo_urls`** (точки-индикаторы min 44×44, стрелки «‹ ›»), кнопки «Пропуск» / «В маршрут», ссылка **«Подробнее о месте»**, фоновая превью-карта следующего места.
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Нужен мобильный медиа-first сценарий подбора мест с жестами и галереей фото без смены backend и с сохранением корзины/рекомендаций.

**Files touched:**
- `front/src/features/routeCart/routeCartStore.ts`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/components/PlacesSwipeDeck.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- Проход 1: `cd front && npm run lint`, `cd front && npm run build` — успешно.
- Проход 2: те же команды повторно — успешно.

---

## [2026-03-21] - Конструктор маршрута на `/places` (корзина + рекомендации + создание маршрута)

**Type:** feature

**What changed:**
- **`placesApi.ts`:** расширен **`PublicPlace`** полями контракта backend (`season_slugs`, `type_slug`, `short_description`, оценки и т.д.); **`parsePublicPlace`** принимает `external_id` как строку или пустую строку при отсутствии; добавлены **`PublicPlaceRecommendation`**, **`parsePublicPlaceRecommendation`**, **`fetchPlaceRecommendations`** — `POST /places/recommendations` (публичный).
- **`catalogApi.ts`:** **`fetchSeasons`** — `GET /seasons` для fallback сезона и привязки `season_id` к slug.
- **`routesApi.ts`:** **`createRouteFromSelection`** (`POST /routes` с `creation_mode: selection_builder`), **`fetchUserRouteById`**, парсинг **`UserRouteDetail`**.
- **`routeCartStore.ts`:** Zustand + persist в **`sessionStorage`** — выбранные места, якорь, активный сезон (slug/id), статусы рекомендаций и ошибок создания маршрута.
- **`PlacesCatalogPage.tsx`:** кнопка «в маршрут» на карточке; после старта конструктора — блок контекста, секции «В маршруте», «Рекомендации для вашего маршрута» (debounce запроса), «Ещё из каталога»; липкая панель корзины с чипами, сбросом и **«Создать маршрут»** (гость → `requestAuthModalOpen`, авторизованный → `POST /routes` → сброс корзины → переход на **`/routes/:id`**).
- **`PlaceDetailPage.tsx`:** кнопка **«В маршрут»** / состояние «В маршруте», ссылка в каталог; подгрузка сезонов для fallback slug.
- **`RouteDetailPage.tsx`**, **`App.tsx`:** маршрут **`/routes/:id`** — просмотр созданного маршрута (`GET /routes/:id`) или экран входа без токена.
- Обновлены **`front/changes_frontend.md`**, **`front/memory_frontend.md`**.

**Why it changed:**
- Нужен frontend-only сценарий подборки маршрута: рекомендации рядом с якорем и по сезону через поддержанный API, сохранение маршрута через существующий **`POST /routes`**.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/features/catalog/catalogApi.ts`
- `front/src/features/routes/routesApi.ts`
- `front/src/features/routeCart/routeCartStore.ts`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/pages/PlaceDetailPage.tsx`
- `front/src/pages/RouteDetailPage.tsx`
- `front/src/App.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-21] - Каталог `/places`: limit запроса 24 и более высокие карточки

**Type:** UX / polish

**What changed:**
- **`placesApi.ts`:** константа **`PLACES_CATALOG_FETCH_LIMIT = 24`**; **`fetchAllPlaces(options?: { pageLimit?: number })`** — при вызове с **`pageLimit`** каждый `GET /places` использует этот limit (сжатие в диапазон 1…`PLACES_LIST_MAX_LIMIT`). Каталог вызывает **`fetchAllPlaces({ pageLimit: PLACES_CATALOG_FETCH_LIMIT })`**.
- **`PlacesCatalogPage.tsx`:** блок медиа карточки — **`aspect-[3/4]`** + **`min-h`** по брейкпоинтам; нижний градиент и текст чуть просторнее (**`pt-16`**, **`pb-5`**, описание **`line-clamp-3`**); скелетоны согласованы по пропорциям.

**Why it changed:**
- Пагинация каталога фиксированным размером страницы 24; карточки визуально выше и менее тесные.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-21] - Каталог: порядок по уникальности фото; деталь места: «Назад» по истории

**Type:** fix / UX

**What changed:**
- **`placesApi.ts`:** добавлены **`getPrimaryDisplayPhotoUrl`** (первый `photo_urls[0]` после trim, как у карточки), **`orderPlacesByCatalogImagePriority`** — порядок: уникальный primary URL → тот же URL у нескольких мест → без фото; внутри групп сохраняется исходный порядок. **`placeHasDisplayablePhoto`** сведён к проверке `getPrimaryDisplayPhotoUrl`.
- **`PlacesCatalogPage`:** после фильтра поиска список проходит через **`orderPlacesByCatalogImagePriority`**; **`CatalogCardImage`** берёт URL через **`getPrimaryDisplayPhotoUrl`** (в т.ч. пробелы в первом элементе).
- **`PlaceDetailPage`:** кнопка **«← Назад»** вызывает **`navigate(-1)`**, если в **`history.state.idx`** (React Router) есть индекс > 0 или **`window.history.length > 1`**; иначе **`navigate('/places')`**. Ссылки с экранов ошибки / не найдено / плохой id ведут на **`/places`** вместо `/#places`. Hero-фото на детали через **`getPrimaryDisplayPhotoUrl`**.

**Why it changed:**
- Витрина каталога должна поднимать карточки с уникальными картинками; «Назад» с детали не должен жёстко вести на лендинг.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/pages/PlacesCatalogPage.tsx`
- `front/src/pages/PlaceDetailPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-21] - Страница каталога мест `/places`

**Type:** feature

**What changed:**
- Добавлена страница **`PlacesCatalogPage`**: маршрут **`/places`** (в `App.tsx` объявлен **до** `/places/:id`, детальная карточка не затронута). Шапка с логотипом, навигация (Места / Впечатления → `/#places` / Как это работает → `/#how`), кнопка входа варианта **`on-catalog`** (синяя кнопка, белый текст). Блок: заголовок «Места Краснодарского края», справа поле **«Поиск по названию»** с иконкой, сетка карточек (1–4 колонки), фон `#e8f4fc`. Карточка: фото или плейсхолдер, опциональный бейдж (`size` или первая часть `source_location`), декоративное «сердце», градиент снизу, название и усечённое описание; клик ведёт на **`/places/:id`**.
- В **`placesApi.ts`**: константа **`PLACES_LIST_MAX_LIMIT`** (100) и функция **`fetchAllPlaces()`** — последовательные запросы `GET /places` с пагинацией, дедуп по `id`, пока не покрыт `total`.
- В **`LandingPage`**: пункт **«Места»** в hero-навигации — **`Link to="/places"`** вместо якоря `#places`. Восстановлен рендер **`PlacesExplorerSection`** под каруселью (секция `#discover`), чтобы не ломать лендинг.
- **`LoginButton`**: вариант **`on-catalog`** для светлой шапки каталога.

**Why it changed:**
- Нужна отдельная витрина всех мест по референсу, с поиском и переходом на существующую страницу места.

**Files touched:**
- `front/src/pages/PlacesCatalogPage.tsx` (новый)
- `front/src/App.tsx`
- `front/src/pages/LandingPage.tsx`
- `front/src/features/places/placesApi.ts`
- `front/src/components/LoginButton.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

**Testing:**
- `cd front && npm run lint`, `cd front && npm run build` — успешно.

---

## [2026-03-21] - Hero h1 «Куда поедем?» в шрифте Gerhaus

**Type:** feature / typography

**What changed:**
- В `index.css` снова подключены `@font-face` для **Gerhaus** (Regular + Italic, `assets/fonts/Gerhaus-*.ttf`) и токен темы **`--font-gerhaus`** → утилита **`font-gerhaus`**.
- В `LandingPage.tsx` у единственного hero **`h1`** («Куда поедем?») класс **`font-display`** заменён на **`font-gerhaus`**; остальной UI по-прежнему на AA Stetica.

**Why it changed:**
- Акцентный заголовок hero должен визуально отличаться и использовать Gerhaus.

**Files touched:**
- `front/src/index.css`
- `front/src/pages/LandingPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21] - Единый шрифт интерфейса: AA Stetica

**Type:** feature / typography

**What changed:**
- В `src/index.css` удалены подключения **Gerhaus**; добавлены `@font-face` для **AA Stetica** (веса 300 / 400 / 500 / 700 / 900 и соответствующие italic из `assets/fonts/*.otf`).
- В `@theme` заданы **`--font-sans`** и **`--font-display`** как `'AA Stetica', system-ui, sans-serif` — базовый текст и утилита `font-display` используют одно семейство.
- `body` использует `font-family: var(--font-sans)`.
- На `PlaceDetailPage` у блока координат убран `font-mono`, чтобы и он рендерился в AA Stetica.

**Why it changed:**
- Требование: весь текст приложения в AA Stetica с предсказуемыми начертаниями для `font-bold` и т.п.

**Files touched:**
- `front/src/index.css`
- `front/src/pages/PlaceDetailPage.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21] - Лендинг: SVG-логотип, синий акцент в hero, синяя CTA «ПРОЙТИ КВИЗ»

**Type:** feature / branding

**What changed:**
- Логотип в шапке лендинга и в компоненте `Logo` (квиз) заменён на растрово-векторный файл **`src/assets/brand-logo.svg`** (исходный ассет с CDN hackathon-ss); шапка лендинга: ссылка на `/` с `alt` «Край Тур», `object-contain`, ограничение высоты для мобилки и десктопа.
- В hero подзаголовке акцент **«готовый маршрут»** переведён с `text-kr-lime` на **`text-kr-blue`**.
- Кнопка **«ПРОЙТИ КВИЗ»**: фон **`bg-kr-blue`**, текст **белый**, hover **`brightness-110`**, focus ring без изменений по смыслу (белая обводка).

**Why it changed:**
- Обновление визуального бренда хакатона: единый логотип-изображение и согласованный синий акцент с CTA.

**Files touched:**
- `front/src/assets/brand-logo.svg`
- `front/src/pages/LandingPage.tsx`
- `front/src/components/Logo.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 06:31] - Фикс unlike + рабочая comments modal в карусели мест

**Type:** fix

**What changed:**
- `LandingPlacesCarousel.tsx` обновлена: кнопка комментариев стала реальным action-button, карточка открывает comments modal без навигации, а счётчик комментариев на карточке синхронизируется после загрузки списка и после успешной отправки нового комментария.
- Добавлен новый компонент `PlaceCommentsModal.tsx`: модалка открывается из карусели, загружает `GET /places/:id/comments`, показывает loading / empty / error / retry состояния, список комментариев, форму отправки и CTA на логин для гостей.
- `placeInteractionsApi.ts` расширен поддержкой `POST /places/:id/comments`, чтобы фронтенд использовал существующий backend-контракт для создания комментария без отдельного ad-hoc fetch-кода.
- Like/unlike flow оставлен optimistic, но теперь он реально работает end-to-end в браузере вместе с backend CORS fix для `DELETE`; фронтенд продолжает открывать auth-модалку для гостей и откатывает локальное состояние при ошибке.
- Проверено: `cd front && npm run lint`, `cd front && npm run build`, `cd back && npm run check`, `cd back && npm run build`, плюс runtime-проверка preflight `OPTIONS /places/:id/like` на backend.

**Why it changed:**
- Нужно было починить сломанный unlike из браузера и превратить dead comments icon в рабочий UX для просмотра и добавления комментариев без редизайна лендинга.

**Files touched:**
- `front/src/components/LandingPlacesCarousel.tsx`
- `front/src/components/PlaceCommentsModal.tsx`
- `front/src/features/places/placeInteractionsApi.ts`
- `front/changes_frontend.md`
- `front/memory_frontend.md`
- `back/src/app.ts`
- `back/changes_backend.md`
- `back/memory_backend.md`

---

## [2026-03-21 06:16] - Карусель мест как recommendation feed с лайками и счётчиком комментариев

**Type:** feature

**What changed:**
- Добавлен frontend API-слой **`placeInteractionsApi.ts`** для текущего backend-контракта: `GET /places/:id/likes`, `POST /places/:id/like`, `DELETE /places/:id/like`, `GET /places/:id/comments`.
- Добавлен лёгкий frontend-триггер **`authModalEvents.ts`**: неавторизованный клик по лайку на лендинге открывает уже существующую auth-модалку через `LoginButton`, без нового глобального auth-контекста.
- **`LandingPlacesCarousel.tsx`** превращена в recommendation feed: после `GET /places` карусель гидратирует лайки/комментарии только для карточек фида, показывает отдельную строку взаимодействий под контентом карточки и слегка увеличивает высоту карточек/скелетонов.
- Итоговый порядок карточек в карусели теперь такой: **`likes_count DESC` → наличие displayable photo → исходный порядок API**. Если interaction hydration недоступна, карусель остаётся рабочей и фактически падает обратно к photo-first / stable ordering.
- Кнопка лайка теперь работает как toggle: при наличии токена — optimistic update с rollback на ошибке, блокировка повторного клика на время запроса и синхронизация по ответу backend; при отсутствии токена — чистое сообщение + открытие auth-модалки.
- Карточки показывают иконку лайка, иконку комментариев и оба счётчика; комментарии в этой версии используются **как fetch-based count only** и не тянут отдельный comments UI на лендинге.
- Проверено: `npm run lint` и `npm run build`.

**Why it changed:**
- Требовалось сделать landing places carousel похожей на реальную рекомендательную ленту с backend-backed лайками и comment counts, не ломая существующий фронтенд и без broad refactor.

**Files touched:**
- `front/src/features/places/placeInteractionsApi.ts`
- `front/src/features/auth/authModalEvents.ts`
- `front/src/components/LandingPlacesCarousel.tsx`
- `front/src/components/LoginButton.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`
- `back/changes_backend.md`
- `back/memory_backend.md`

---

## [2026-03-21 07:45] - Секция «Каталог на карте»: фиксированная высота, скролл списка, пропорции 32.5% / 5% / 62.5%

**Type:** fix / UX

**What changed:**
- **`PlacesExplorerSection.tsx`:** split-блок на `lg+` получает **фиксированную высоту** (`clamp(22rem, 62vh, 46rem)`), обе колонки тянутся на всю высоту ряда (`grid` + `items-stretch`, `min-h-0` / `overflow-hidden` где нужно). Ширина ряда: **32.5%** список, **`gap-x-[5%]`**, **62.5%** карта (`grid-cols-[minmax(0,32.5%)_minmax(0,62.5%)]`). Список в **отдельной панели** с `overflow-y-auto`, на мобиле — `max-h-[min(56vh,520px)]`, на desktop высота панели от flex/grid. Подписи «Список мест» / «Карта» вынесены над панелями; корень скролла передаётся в список через `ref={setListScrollRoot}`.
- **`PlacesExplorerList.tsx`:** **IntersectionObserver** для догрузки с **`root: scrollRoot`** (панель списка), а не viewport; без `scrollRoot` observer не вешается. `rootMargin` ~120px.
- **`PlacesYandexMap.tsx`:** убран **`lg:sticky`** и фиксированные `lg:h-[520px]`; контейнер **`h-full` / `flex-1` / `min-h-0`** в колонке; на мобиле **`min-h-[min(42vh,360px)]`**. Добавлен **ResizeObserver** → `map.container?.fitToViewport?.()` после появления размеров. Fallback/error-блоки тоже заполняют высоту колонки.

**Why it changed:**
- Секция не должна раздуваться по высоте списка; карта и список — **равной высоты**; скролл только **внутри** левой панели; догрузка должна срабатывать при прокрутке **панели**, а не страницы.

**Files touched:**
- `front/src/components/PlacesExplorerSection.tsx`
- `front/src/components/PlacesExplorerList.tsx`
- `front/src/components/PlacesYandexMap.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 06:30] - Секция «Каталог на карте»: список с подгрузкой + Yandex Map

**Type:** feature

**What changed:**
- После карусели мест на лендинге добавлена секция **`#discover`** («Каталог на карте»): две колонки на `lg+` — слева список мест, справа карта; на меньших экранах блоки стекуются (список сверху, карта ниже).
- **`placesApi.ts`:** `placeHasValidCoordinates`, `getPlaceLatLon` ([lat, lon] для Яндекса), константа **`PLACES_PAGE_SIZE_EXPLORER = 25`** для пагинации `GET /places` (в пределах backend `limit` 1–100).
- **`PlacesExplorerSection.tsx`:** первая страница + догрузка по `offset`; дедуп по `id`; защита от параллельных дублирующих запросов и от повторной подгрузки после конца (`total`); состояния loading / error / empty / «Повторить» с инвалидацией устаревших ответов (`fetchGenRef`).
- **`PlacesExplorerList.tsx`:** бесконечная подгрузка через **IntersectionObserver** (sentinel у низа списка, `rootMargin` ~280px); компактные строки (фото, имя, регион, метка «На карте» / «Без координат»); клик/Enter/Space выбирает место для карты; ссылка «Подробнее» → `/places/:id` с `stopPropagation`.
- **`PlacesYandexMap.tsx`:** загрузка скрипта **Yandex Maps 2.1** с CDN (`apikey` + `lang=ru_RU`); отложенный старт по видимости колонки карты (**IntersectionObserver**); плейсмарки только для мест с валидными `lat`/`lon`; `setBounds` при нескольких точках, центрирование на **`selectedPlaceId`**; балун/хинт с названием; при отсутствии **`VITE_YANDEX_MAPS_API_KEY`**, ошибке загрузки SDK или инициализации — стабильный fallback (список работает).
- **`vite-env.d.ts`:** опциональная типизация `VITE_YANDEX_MAPS_API_KEY`.
- **`LandingPage.tsx`:** `<PlacesExplorerSection />` сразу после `<LandingPlacesCarousel />`.

**Why it changed:**
- Хакатон: обогащение лендинга интерактивным каталогом и картой без изменений backend, с упором на производительность (пагинация + ленивая инициализация карты).

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/components/PlacesExplorerSection.tsx`
- `front/src/components/PlacesExplorerList.tsx`
- `front/src/components/PlacesYandexMap.tsx`
- `front/src/pages/LandingPage.tsx`
- `front/src/vite-env.d.ts`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 05:10] - Карусель мест: автопрокрутка и приоритет карточек с фото

**Type:** feature

**What changed:**
- `placesApi.ts`: экспорт `placeHasDisplayablePhoto` и `prioritizePlacesWithPhotos` — сортировка по первому непустому URL в `photo_urls` (после trim), стабильный порядок внутри групп.
- `LandingPlacesCarousel.tsx`: после успешной загрузки список пропускается через `prioritizePlacesWithPhotos`; добавлена автопрокрутка по таймеру (~5.2s), шаг = ширина карточки + CSS gap, в конце — плавный возврат к началу; пауза при наведении на десктопе; пауза ~10s после ручного скролла, колёсика, касания или кнопок навигации; при `prefers-reduced-motion: reduce` автопрокрутка отключена; уточнён подзаголовок секции и подпись на мобильных.

**Why it changed:**
- Витрина лендинга: визуально сильные карточки первыми и живое, но ненавязчивое движение карусели.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/components/LandingPlacesCarousel.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 05:05] - Bug fix: карусель мест не показывала карточки при строковом `id`

**Type:** fix

**What changed:**
- В `placesApi.ts` ослаблен парсинг ответа `/places`: `id` места принимается и как **number**, и как **строка** (нормализация в целое ≥ 1), как при сериализации BIGINT / драйвера.
- `total`, `limit`, `offset` в корне ответа также допускают строковые неотрицательные целые.
- `lat` / `lon` дополнительно парсятся из строки в number для детальной страницы.

**Why it changed:**
- Реальный API отдавал `"id": "1"`; `parsePublicPlace` требовал только `number`, из-за чего все элементы отфильтровывались и `items` оказывался пустым при успешном HTTP.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 04:56] - Карусель мест с API GET /places под hero

**Type:** feature

**What changed:**
- Добавлен `features/places/placesApi.ts`: `GET /places` с query `limit`/`offset` (витрина лендинга — `limit=12`, `offset=0`), парсинг ответа `{ items, total, limit, offset }` и сущности в **snake_case** (`photo_urls` как массив строк и т.д. по `memory_backend.md`); `GET /places/:id` по **внутреннему числовому id**; база URL как у auth (`VITE_API_BASE_URL` / `localhost:3000`).
- Компонент `LandingPlacesCarousel`: секция `#places` сразу под hero-видео; горизонтальный скролл + `snap-x`/`snap-center`; карточки (имя, регион `source_location`/`address`, `size`, обрезанное `description`, первое фото из `photo_urls` с плейсхолдером и `onError`); состояния **loading** (скелеты с фиксированной min-height), **empty**, **error** с текстом и **«Повторить»** (без подмены данных моками); на `lg` — кнопки прокрутки.
- Маршрут `GET /places/:id` на фронте: `PlaceDetailPage` по пути `/places/:id` (загрузка, 404, ошибка сети); карточки ведут на деталь.
- `LandingPage`: вставлена карусель под hero; якорь `#places` перенесён на реальную секцию (удалён sr-only placeholder).
- `App.tsx`: зарегистрирован маршрут `/places/:id`.

**Why it changed:**
- Хакатон: витрина мест с реальными данными backend и навигация на деталь по документированному контракту.

**Files touched:**
- `front/src/features/places/placesApi.ts`
- `front/src/components/LandingPlacesCarousel.tsx`
- `front/src/pages/PlaceDetailPage.tsx`
- `front/src/pages/LandingPage.tsx`
- `front/src/App.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 04:51] - Кинематографичный hero с видео на лендинге

**Type:** feature

**What changed:**
- Добавлен компонент `LandingHeroMedia`: полноэкранный фон hero с MP4 с Yandex Object Storage (`LANDING_HERO_VIDEO_SRC`), `autoplay` + `muted` + `loop` + `playsInline` + `object-cover`, `poster` и статичный fallback на `landing-hero.png` при ошибке загрузки или сбое `play()`.
- При `prefers-reduced-motion: reduce` видео не показывается — только постер/изображение; оверлеи (тёмные и градиенты бренда) сохраняют читаемость текста и кликабельность CTA/`LoginButton`.
- Секция hero: увеличенные `min-height` (`88dvh`–`92dvh`), тёмный базовый фон против CLS; обновлены eyebrow, заголовок и подзаголовок в travel-тоне; CTA «ПРОЙТИ КВИЗ» с `z-20` и тенью.
- Удалён прежний split-image hero из `LandingPage` в пользу видео-фона.
- **Bug fix:** в `LoginModal` убран `useEffect`, синхронно вызывавший `setPanel` при открытии (нарушение eslint `react-hooks/set-state-in-effect`); стартовая вкладка передаётся пропом `initialPanel` из `LoginButton` при смене `key`.

**Why it changed:**
- Требование вывести указанное промо-видео как главный above-the-fold визуал премиального travel-hero без поломки auth и вёрстки.

**Files touched:**
- `front/src/components/LandingHeroMedia.tsx`
- `front/src/pages/LandingPage.tsx`
- `front/src/components/LoginModal.tsx`
- `front/src/components/LoginButton.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 01:50] - Logout в auth-модалке

**Type:** feature

**What changed:**
- Кнопка auth в шапке больше не блокируется после входа: при клике авторизованный пользователь открывает модалку состояния аккаунта.
- В `LoginModal` добавлен экран «Аккаунт» с текущим email и кнопкой «Выйти», которая очищает локальную auth-сессию через существующий `logout()` в Zustand store.
- После logout UI возвращается в гостевое состояние: токен и пользователь удаляются из `localStorage`, а кнопка снова показывает «Войти».

**Why it changed:**
- Требовалось добавить минимальную logout-функциональность без отдельного backend endpoint и без редизайна существующего auth UI.

**Files touched:**
- `front/src/components/LoginButton.tsx`
- `front/src/components/LoginModal.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 01:43] - Подключение auth UI к backend auth

**Type:** feature

**What changed:**
- Добавлены `authApi` и `authStore` на Zustand для входа, регистрации, хранения `{ user, token }` и восстановления сессии через `GET /auth/me`.
- `LoginModal` подключена к backend-эндпоинтам `POST /auth/login` и `POST /auth/register`: формы теперь отправляют данные, показывают loading/error-состояния и закрываются при успешной авторизации.
- `LoginButton` теперь реагирует на auth state: после успешного входа показывает email пользователя вместо текста «Войти».
- В `App.tsx` добавлена инициализация auth-сессии при старте приложения.

**Why it changed:**
- Требовалось подключить существующий UI входа/регистрации к backend auth без редизайна и с минимальными безопасными изменениями.

**Files touched:**
- `front/src/features/auth/authApi.ts`
- `front/src/features/auth/authStore.ts`
- `front/src/components/LoginModal.tsx`
- `front/src/components/LoginButton.tsx`
- `front/src/App.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 00:13] - Цвет кнопки «Войти» и соцвход Яндекс / ОК

**Type:** style

**What changed:**
- Кнопка email/пароль «Войти» переведена на тёмно-нейтральный фон (`neutral-900`), чтобы визуально отличаться от блока соцкнопок с фирменными синими/красными/оранжевыми цветами.
- Добавлены визуальные кнопки «Войти через Яндекс» (#fc3f1e) и «Войти через Одноклассники» (#ee8208); ВК, Яндекс и ОК сгруппированы в колонку с `gap-3` и `aria-label` на группе.

**Why it changed:**
- Запрос развести стиль основного входа и отдельный визуальный ряд OAuth-кнопок (ВК уже имел свой цвет).

**Files touched:**
- `front/src/components/LoginModal.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 00:11] - Кнопка «Войти», регистрация и ссылка в модалке

**Type:** feature

**What changed:**
- В форме входа добавлена основная кнопка «Войти» (синяя плашка, `preventDefault`, без API).
- Под «Войти через ВК» добавлена ссылка «Зарегистрироваться», переключающая модалку на экран регистрации.
- Экран регистрации: поля Имя, Email, Пароль, Подтвердите пароль и кнопка «Зарегистрироваться» (только визуал); ссылка «Уже есть аккаунт? Войти» возвращает на вход.
- Подписи полей усилены до почти чёрного (`neutral-900`) для ближе к референсу макета.
- При каждом открытии модалки инкрементируется `key`, чтобы состояние панели сбрасывалось на «Вход».

**Why it changed:**
- Соответствие макету/референсу модалки «Вход» и запрос на полноценный визуальный флоу входа и регистрации без бэкенда.

**Files touched:**
- `front/src/components/LoginModal.tsx`
- `front/src/components/LoginButton.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---

## [2026-03-21 00:06] - Модальное окно входа по кнопке «Войти»

**Type:** feature

**What changed:**
- По клику на «Войти» открывается модальное окно (портал в `document.body`) с полями email и пароль (форма без отправки на сервер) и кнопкой «Войти через ВК» ниже (только визуал).
- Кнопка «Войти» в шапке заменена с `Link` на `button`; добавлены закрытие по клику на оверлей, по Escape, фокус на поле email при открытии, `aria-*` для диалога.
- Добавлены файлы журнала изменений и памяти фронтенда в каталоге `front/`.

**Why it changed:**
- Нужен UI входа без бэкенда; единое поведение на лендинге и в квизе.

**Files touched:**
- `front/src/components/LoginModal.tsx`
- `front/src/components/LoginButton.tsx`
- `front/changes_frontend.md`
- `front/memory_frontend.md`

---
