# Frontend memory — Край Тур

Краткий снимок состояния фронтенда для продолжения работы другим агентом или в новой сессии.

## Project overview

SPA «Край Тур»: лендинг с hero, квиз из нескольких шагов, экран завершения. Данные квиза пока моковые (без реального API), auth-модалка подключена к backend email/password auth, а landing carousel мест теперь умеет и лайки, и комментарии через backend place-interactions API.

## Current frontend stack

- **Vite 8** + **React** + **TypeScript**
- **Tailwind CSS v4** (`@import 'tailwindcss'`, `@tailwindcss/vite`)
- **React Router** (`BrowserRouter`)
- **Zustand** — ответы квиза (`features/quiz/quizStore.ts`): **`peopleCount`**, **`seasons`** (slug **`spring` | `summer` | `autumn` | `winter`**), **`budget.from` / `budget.to`**, **`restType`** (Активный / Умеренный / Спокойный), **`daysCount`**
- **Zustand** — auth state (`features/auth/authStore.ts`) для `{ user, token }`
- Локальное состояние компонентов — interaction hydration, like-toggle и comments modal для landing places carousel

## Pages / screens

| Маршрут            | Компонент        | Описание                          |
|--------------------|------------------|-----------------------------------|
| `/`                | `LandingPage`    | Full-bleed hero (видео) + **#places** — карусель из `GET /places` + **#discover** — каталог с пагинацией и Yandex Map |
| `/places`          | `PlacesCatalogPage` | Полный каталог мест: **`fetchAllPlaces({ pageLimit: PLACES_CATALOG_FETCH_LIMIT })`** — постраничный `GET /places` с **limit 24**, клиентский поиск. **Desktop (`sm+`):** сетка карточек → **`/places/:id`**, липкая панель корзины с чипами и **«Создать маршрут»**, видимый **`h1`**. **Mobile (`max-sm`):** **`h-dvh`** + **`overflow-hidden`** при **`phase === 'ok`** (без скролла страницы в норме); крупный заголовок страницы не показывается (**`sr-only`**); колода **`PlacesSwipeDeck`** — одно фото, свайп влево = **`rejectSwipePlace`**, вправо = **`addPlace`**; модалка подсказки (`sessionStorage` **`kray-places-swipe-hint-seen`**); **«к маршруту»** → модалка обзора; бургер **`z-[95]`**. Рекомендации и **`POST /places/recommendations`** без изменений по контракту |
| `/places/:id`      | `PlaceDetailPage`| Карточка места: `GET /places/:id` (внутренний числовой id); кнопка **«В маршрут»** пишет в общий **`routeCartStore`** (тот же конструктор, что на каталоге) |
| `/routes/:id`      | `RouteDetailPage`| **Обзор + редактор на странице:** `GET /routes/:id` с JWT. Локальное состояние **`editorStops`** (**`editableRouteStops.ts`**) инициализируется с ответа API; **добавить** остановку — модалка **`RouteAddStopModal`** (`fetchAllPlaces` + поиск, без дубликатов по **`place.id`**); **убрать** и **↑ / ↓** на карточке; карта **`RouteYandexMap`** и блоки **отели / еда** от **`editorStops`**; **`baselineSig`** + **«Сбросить к загруженному»** при правках. Правки **не отправляются на backend** (честный дисклеймер в UI). Блок **квиза** без изменений по условиям показа. Ссылка на **`/places`** остаётся как доп. конструктор. Ключ карты: **`VITE_YANDEX_MAPS_API_KEY`** |
| `/quiz/:stepId`    | `QuizPage`       | **5 шагов:** человек (number), сезон (мультивыбор чекбоксы), бюджет (два **range** от/до), вид отдыха (radio), дни (number); валидация на шаг; **«Далее»** disabled пока шаг невалиден |
| `/quiz/done`       | `QuizDonePage`   | Финиш квиза                       |
| `*`                | редирект на `/`  |                                   |

## Component structure (важное)

- `components/LandingHeroMedia.tsx` — фон лендинга: `<video>` (URL в константе `LANDING_HERO_VIDEO_SRC`) с `poster={landing-hero.png}`, fallback на то же изображение при ошибке/`play()` reject; при `prefers-reduced-motion: reduce` только картинка. Слои градиентов поверх, `pointer-events-none`, без взаимодействия с видео.
- **Логотип бренда:** файл **`src/assets/brand-logo.svg`**; в шапке лендинга (`LandingPage.tsx`) — `<img>` внутри `Link` на `/`, `alt="Край Тур"`. Компонент **`Logo.tsx`** (шаги квиза) рендерит тот же ассет с размерами по `LogoMode` (`row-wide` / `stack` / `wordmark`), без текстового wordmark.
- **Hero лендинга:** акцентная фраза «готовый маршрут» оформлена **`text-kr-blue`** (не лайм). CTA **«ПРОЙТИ КВИЗ»** — **`bg-kr-blue`**, текст **белый**, hover чуть ярче (`brightness-110`).
- `features/places/placesApi.ts` — `GET /places` / `GET /places/:id`. Ответ списка: объект `{ items, total, limit, offset }` (не массив). Поля мест в **snake_case** как у API. **Нормализация на фронте:** `id` и при необходимости `total`/`limit`/`offset`/`lat`/`lon` могут приходить **строками** (например BIGINT в JSON) — парсер приводит к числам; невалидные строки в `items` отбрасываются. `photo_urls` — массив строк, иначе `[]`. **`PublicPlace`** дополнен полями как у backend **`toPublicPlace`**: `season_slugs`, `type_slug`, `short_description`, `estimated_cost`, `estimated_duration_minutes`, `radius_group`, `is_active`; `external_id` при отсутствии в JSON становится пустой строкой. **`fetchPlaceRecommendations`** — **`POST /places/recommendations`** (публичный): тело с **`season_slug` или `season_id`**, опционально `anchor_place_id`, `exclude_place_ids`, `radius_km`, `limit`; ответные элементы парсятся как **`PublicPlaceRecommendation`** (поле **`distance_km`**). Primary-картинка для витрины и каталога: **`getPrimaryDisplayPhotoUrl`** (первый непустой `photo_urls[0]` после trim); **`placeHasDisplayablePhoto`** = наличие этого URL; **`orderPlacesByCatalogImagePriority`** — сортировка каталога по уникальности primary URL. **`prioritizePlacesWithPhotos`** — карусель. Для карты: **`placeHasValidCoordinates`** / **`getPlaceLatLon`**. Размер страницы для секции-эксплорера: **`PLACES_PAGE_SIZE_EXPLORER`** (25). Для **полного каталога** на `/places`: **`PLACES_CATALOG_FETCH_LIMIT`** (24) передаётся в **`fetchAllPlaces({ pageLimit })`**; цикл `GET /places` до `total`, дедуп по `id`. Без опций **`fetchAllPlaces()`** по-прежнему использует **`PLACES_LIST_MAX_LIMIT`** (100) на страницу.
- **`features/catalog/catalogApi.ts`** — **`fetchSeasons`**: `GET /seasons` → `{ items: { id, name, slug }[] }` для fallback сезона в конструкторе маршрута и сопоставления slug → id.
- **`features/routes/routesApi.ts`** — авторизованные вызовы: **`createRouteFromSelection`** (`POST /routes`, `creation_mode: selection_builder`, `place_ids`, опционально `season_id`), **`fetchUserRouteById`**; парсер детализации маршрута и вложенных **`place`** через **`parsePublicPlace`**.
- **`features/routeCart/routeCartStore.ts`** — Zustand **`useRouteCartStore`**: порядок **`selectedIds`**, снимки **`placesById`**, **`swipeRejectedIds`** (пропуски в мобильной колоде `/places` — не в корзине, участвуют в **`exclude_place_ids`** рекомендаций), **`anchorPlaceId`** (последнее добавленное / повторный клик по карточке в корзине), **`activeSeasonSlug`** / **`activeSeasonId`**, флаг **`builderStarted`**, **`recommendationItems`** + статусы загрузки/ошибки/пусто, ошибка **`routeCreateError`**, **`routeCreateLoading`**. Экшены: **`rejectSwipePlace`**, **`resetBuilder`** и опустошение корзины сбрасывают отклонения. Persist (**`sessionStorage`**, ключ `kray-tour-route-cart-v1`): только устойчивое состояние корзины и **`swipeRejectedIds`**; лента рекомендаций после перезагрузки вкладки сбрасывается и запрашивается заново на `/places`.
- **`pages/PlacesCatalogPage.tsx`** — светлая страница каталога; hero-навигация на лендинге **«Места»** ведёт сюда (`Link to="/places"`). Загрузка: **`fetchAllPlaces({ pageLimit: PLACES_CATALOG_FETCH_LIMIT })`** (24 записи на запрос). Поиск фильтрует уже загруженный массив по **имени** (минимум), плюс `description`, `source_location`, `address`; затем **`orderPlacesByCatalogImagePriority`**: **уникальный** primary URL → **дубликаты** → **без фото**. Витрина без отклонённых свайпом: **`sortedCatalogVisible`** = каталог минус **`swipeRejectedIds`** (и для сетки **`sm+`**, и для мобильной колоды). **`fetchPlaceRecommendations`**: **`exclude_place_ids`** = **union(`selectedIds`, `swipeRejectedIds`)**; сигнатура **`recSignature`** включает оба списка для перезапроса после лайка/пропуска. На **мобиле** при успешной загрузке каталога: корень **`h-dvh`**, **`overflow-hidden`**, **`flex flex-col`**; **`main`** — **`flex-1 min-h-0 overflow-hidden`**; крупный **`h1`** визуально скрыт (**`sr-only`**, с **`sm:not-sr-only`** на десктопе); колода в **`flex-1`**-цепочке; нижняя панель маршрута компактнее. **Mobile-only (`sm:hidden`):** **`PlacesSwipeDeck`** — колода **`mobileDeckPlaces`**: в режиме конструктора сначала рекомендации, отсортированные по **`distance_km`**, затем **«Ещё из каталога»**; без конструктора — **`sortedCatalogVisible`** без мест из корзины. **Модалки (портал в `document.body`, `z-[100]`):** при **`phase === 'ok'`** и **`matchMedia('(max-width: 639px)')`** без ключа в **`sessionStorage`** открывается подсказка свайпа; **`dismissSwipeHint`** пишет ключ и закрывает; **Escape** закрывает подсказку → обзор маршрута → бургер. **Обзор маршрута:** состояние **`routeReviewOpen`**, кнопка **«к маршруту»** в мобильной нижней панели; пустой список — текст-заглушка; **`handleCreateRoute`** по успеху вызывает **`setRouteReviewOpen(false)`** перед **`resetBuilder`**. **Шапка:** на мобиле **`py-2`**, логотип **`h-9`**, **`nav`** только **`sm:flex`**, бургер **`sm:hidden`** + drawer. **Toaster конструктора** (`z-[45]`, портал): при активном конструкторе и **`phase === 'ok'`** показывается, пока не нажали **×** (**`builderToastDismissed`**); сброс dismissed при **`builderStarted === false`**; контент — заголовок **«Конструктор маршрута»**, **одно** превью якоря (**`AnchorToastThumb`**, primary фото), текст про якорь/сезон/свайп; ошибка рекомендаций в тосте; после закрытия тоста при ошибке — красная полоска под поиском. **Desktop-only (`hidden sm:grid` / `hidden sm:flex`):** прежняя сетка карточек и секции конструктора. Карточка (десктоп): медиа-блок **`aspect-[3/4]`**, ссылка на **`/places/:id`**, кнопка «сердце» → **`addPlace`**. Конструктор: секции рекомендаций/каталога (только **`sm+`**), липкая панель корзины при **`builderStarted`** с чипами и **«Создать маршрут»**.
- **`components/PlacesSwipeDeck.tsx`** — мобильная колода: **`pointer`**-свайп, порог ~**100px**, подписи «Пропуск» / «В маршрут» и ссылка детали — **внутри** карточки (нижняя панель); **одно** фото — **`getPrimaryDisplayPhotoUrl`** (без точек/стрелок/галереи); высота области колоды **`min(calc(100dvh - 12.5rem), 78dvh)`**; **`prefers-reduced-motion`** — без поворота (**`useSyncExternalStore`** на `matchMedia`); превью карты сзади — то же primary; подсказка по жестам в модалке страницы.
- **`PlaceDetailPage`:** кнопка **«← Назад»** — шаг назад по истории (`navigate(-1)`), если `history.state.idx > 0` (стек React Router) или `history.length > 1`; иначе переход на **`/places`**. Явные ссылки «к каталогу» на экранах ошибок ведут на **`/places`**.
- **`LoginButton`**: вариант **`on-catalog`** — синяя заливка, белый текст (шапка каталога).
- `features/places/placeInteractionsApi.ts` — frontend API-слой для `GET /places/:id/likes`, `POST /places/:id/like`, `DELETE /places/:id/like`, `GET /places/:id/comments`, `POST /places/:id/comments`. Для ленты есть helper `hydratePlaceInteractions(...)` с ограниченной конкуррентностью (по умолчанию 4) и graceful fallback на нулевые interaction counts при частичных ошибках. Для recommendation feed комментарии гидратируются как `total` из `GET /places/:id/comments?limit=1&offset=0`, а для modal используется полноценный `GET /places/:id/comments` + `POST /places/:id/comments`.
- `features/auth/authModalEvents.ts` — лёгкий event bridge для открытия существующей auth-модалки из кнопок лайка на лендинге без отдельного глобального modal store.
- `components/PlaceCommentsModal.tsx` — comments modal, открываемая из карточки места на лендинге. Показывает заголовок места, comments list, loading / empty / error / retry состояния, форму отправки для авторизованного пользователя и CTA на login для гостя. После успешной отправки комментария делает обычный refetch списка и передаёт новый `total` обратно в карусель.
- `components/LandingPlacesCarousel.tsx` — карусель под hero теперь работает как **recommendation feed**. После `GET /places` карточки гидратируют `likes_count`, `liked_by_current_user` и comments `total` через backend place-interactions endpoints. Итоговый порядок: **`likes_count DESC` → наличие displayable photo → исходный порядок API**. Карточка получила нижнюю interaction-row (лайк + счётчик, комментарии + счётчик), а высота карточки немного увеличена. **Лайк:** optimistic toggle с rollback по ошибке, блокировка повторного клика во время in-flight запроса, красное активное состояние, использование токена из `useAuthStore`, и при гостевом клике — чистое сообщение + открытие auth-модалки. **Комментарии:** кнопка комментариев открывает `PlaceCommentsModal`, а counts на карточке синхронизируются после загрузки modal и после успешного `POST /places/:id/comments`. **Автопрокрутка:** как раньше — каждые ~5.2s `scrollBy` на ширину карточки + gap; пауза при hover и после user input.
- **`PlacesExplorerSection.tsx`** — секция **`#discover`** сразу **после** карусели: загрузка списка мест тем же `GET /places` с **`limit = PLACES_PAGE_SIZE_EXPLORER`** и нарастающим **`offset`**; первая загрузка + «догрузка вниз»; **`fetchGenRef`** сбрасывает устаревшие ответы при «Повторить»; дедуп по **`id`**; `hasMore` через **`total`** и текущую длину списка; refs против гонок (`fetchingMoreRef`). Состояния: скелет при первой загрузке, ошибка с повтором, пустой список. **Desktop layout:** одна строка grid с **фиксированной высотой** блока (`lg:h-[clamp(22rem,62vh,46rem)]` и т.п.), колонки **32.5%** (список) + **`gap-x-[5%]`** + **62.5%** (карта); **`min-h-0`** / **`overflow-hidden`** на колонках, чтобы flex/grid дети могли сжиматься. **Левая панель:** `overflow-y-auto`, `ref` → **`listScrollRoot`** в state для дочернего IO. **Мобилка:** колонки стекуются (`flex-col`), у списка **`max-h-[min(56vh,520px)]`**, у карты разумный **`min-h`**, без раздувания страницы списком.
- **`PlacesExplorerList.tsx`** — элементы списка внутри **прокручиваемой панели** родителя; **IntersectionObserver** на sentinel с **`root: scrollRoot`** (эта панель), **`rootMargin`** ~120px; пока **`scrollRoot === null`**, observer не создаётся. Колбэк **`onLoadMoreRef`** + `useEffect`. Строка места: миниатюра, имя, регион, бейдж координат; выбор → **`selectedPlaceId`**; «Подробнее» — `Link` на `/places/:id`.
- **`lib/yandexMapsLoader.ts`** — **`loadYandexMaps2`**, **`getYMaps`**, **`YANDEX_DEFAULT_CENTER` / `YANDEX_DEFAULT_ZOOM`**, **`escapeHtmlForYandexBalloon`** для скрипта Maps 2.1 (общий для карт).
- **`PlacesYandexMap.tsx`** — через **`yandexMapsLoader`**: **`https://api-maps.yandex.ru/2.1/?apikey=...&lang=ru_RU`**. Ключ: **`VITE_YANDEX_MAPS_API_KEY`**. **Отложенный mount** по **`visibilityAnchorRef`**. Карта в **колонке фиксированной высоты**: обёртка и **`containerRef`** с **`h-full` / `min-h-0`**, без `sticky`; после mount **ResizeObserver** → **`fitToViewport`**. Маркеры через **`getPlaceLatLon`**, `setBounds` / `setCenter`. **Fallback** при отсутствии ключа или ошибке.
- **`RouteYandexMap.tsx`** — карта маршрута на **`/routes/:id`**: нумерованные метки, **`multiRouter.MultiRoute`** между точками с координатами, при **`model.requestfail`** — прямая **Polyline**; без ключа — тот же fallback-текст, что у эксплорера. Получает **`orderedPlaces`** с **`RouteDetailPage`** из локального **`editorStops`**.
- **`RouteAddStopModal.tsx`** — выбор места для добавления в маршрут: портал **`z-[110]`**, поиск по загруженному каталогу (**`fetchAllPlaces`**, limit 24 на запрос), исключение **`existingPlaceIds`**.
- **`features/routes/editableRouteStops.ts`** — преобразование **`UserRouteDetail`** ↔ редактируемый список остановок.
- **`features/routes/routePlaceGroups.ts`** — **`partitionRoutePlacesByHospitality`**: отели (**`hotel`**, **`guest_house`**, **`recreation_base`**) и еда (**`restaurant`**, **`gastro`**).
- `components/LoginButton.tsx` — открывает модалку (`useState` + `modalKey` для сброса состояния при каждом открытии); передаёт в модалку `initialPanel={user ? 'account' : 'login'}`; после успешного входа показывает email и по клику открывает экран аккаунта.
- `components/LoginModal.tsx` — диалог через `createPortal` → `document.body`. **Вход:** email + пароль отправляются в backend `POST /auth/login`; **регистрация:** email + пароль отправляются в `POST /auth/register`, поле имени пока UI-only, пароль ×2 валидируется на фронте; **logout:** для авторизованного пользователя показывает экран «Аккаунт» с email и кнопкой «Выйти». Показывает loading/error-состояния; соцкнопки пока выводят сообщение «Социальный вход пока недоступен».
- `features/auth/authApi.ts` — frontend API-слой для `POST /auth/login`, `POST /auth/register`, `GET /auth/me`.
- `features/auth/authStore.ts` — Zustand store для auth state, localStorage persistence и восстановления текущего пользователя.
- `components/Logo.tsx`, `DecorativeLoops.tsx`, `QuizOption.tsx`, `QuizNextButton.tsx`, `QuizIllustration.tsx`
- `pages/LandingPage.tsx`, `PlaceDetailPage.tsx`, `QuizDonePage.tsx`
- `features/quiz/QuizPage.tsx`, `quizStore.ts`, `data/quizSteps.ts`
- `data/quizSteps.ts` — конфиг шагов квиза

## Routing structure

См. `src/App.tsx`: `/`, **`/places`** (каталог + конструктор маршрута), **`/places/:id`** (деталь), **`/routes/:id`** (просмотр сохранённого маршрута), квиз, fallback `Navigate`.

## State management

- **Квиз:** Zustand (`useQuizStore`) — см. типы в **`quizStore.ts`**; конфиг шагов **`src/data/quizSteps.ts`** (поле **`kind`** на шаг); **`QuizNextButton`** поддерживает **`disabled`**.
- **Auth:** Zustand (`useAuthStore`) — `user`, `token`, `status`, `error`; хранение в `localStorage` под ключом `kray-tour-auth`.
- **Конструктор маршрута (каталог):** Zustand **`useRouteCartStore`** (`features/routeCart/routeCartStore.ts`), persist в **`sessionStorage`**; сезон для API: приоритет **`season_slugs[0]`** у якорного/добавленного места, иначе первый slug из **`GET /seasons`**; **`activeSeasonId`** выставляется на `/places` при наличии списка сезонов. Создание маршрута только при наличии JWT (**`POST /routes`**), иначе открывается существующая auth-модалка через **`requestAuthModalOpen`**. Мобильные пропуски свайпом накапливаются в **`swipeRejectedIds`** и уменьшают повторный показ карточек в рекомендациях и колоде.
- **Восстановление сессии:** `App.tsx` вызывает `hydrateSession()`, который при наличии токена делает `GET /auth/me`.
- **Logout:** клиентский `logout()` в `useAuthStore` удаляет `{ user, token }` из Zustand и `localStorage`; отдельного backend logout endpoint пока нет.
- **Модалка auth:** локальный стейт `LoginButton` (`open`, `modalKey`); внутри `LoginModal` — `panel: 'login' | 'register' | 'account'`, состояния полей, локальные валидационные ошибки.
- **Carousel interactions:** локальный state в `LandingPlacesCarousel` — `interactionsByPlaceId`, `pendingLikeByPlaceId`, `interactionNotice`, `commentsPlace`. Повторных запросов на rerender нет: hydration идёт только после загрузки фида и при смене auth token. Comments modal локально хранит список, draft, loading/error/submit state и после refetch поднимает новый `commentsCount` в родительскую карусель.

## Styling approach

- Tailwind utility-first, кастомные токены в `src/index.css` (`@theme`): **`--font-sans`**, **`--font-display`** (оба — **AA Stetica** + системный fallback), дополнительно **`--font-gerhaus`** → **`font-gerhaus`**, `--color-kr-blue`, `--color-kr-lime`, и т.д.
- Шрифт интерфейса по умолчанию: **AA Stetica** (начертания 300–900 + italic в `assets/fonts/AA Stetica *.otf`). **Gerhaus** подключён точечно: `@font-face` Regular/Italic (`Gerhaus-*.ttf`); hero **`h1`** «Куда поедем?» на лендинге — класс **`font-gerhaus`**. `body` → `var(--font-sans)`; **`font-display`** = AA Stetica.
- Иллюстрация квиза (все шаги): внешний URL **`QUIZ_ILLUSTRATION_URL`** в `src/data/quizSteps.ts` (`https://storage.yandexcloud.net/hackathon-ss/quizImg1.png`). Локальные `src/assets/quiz/*.png` для шагов больше не используются. `landing-hero.png` — постер и fallback для hero-видео на лендинге; **`brand-logo.svg`** — логотип в шапке лендинга и в `Logo.tsx` на шагах квиза.

## Asset usage

- Шрифты: **AA Stetica** `assets/fonts/*.otf` и **Gerhaus** `assets/fonts/Gerhaus-*.ttf` (лицензии — см. `assets/fonts/COPYRIGHT.txt`).
- Favicon: `public/favicon.svg`.
- Постер hero — импорт в компонентах, Vite кладёт в `dist/assets`. Иллюстрация квиза — абсолютный URL (CDN). Видео hero грузится по абсолютному URL (не в бандле).

## Important design rules

- Mobile-first; брейкпоинты Tailwind (`sm`, `md`, `lg`).
- Фирменные цвета: hero/акцент **#4385F5** (`kr-blue`), квиз-фон часто **#3b82f6**, лайм **#C1FF2C** (`text-kr-lime`) — на лендинге в hero подзаголовке для «готового маршрута» и у CTA «ПРОЙТИ КВИЗ» используется синий/белый, как в текущем брендинге.
- Соцкнопки в модалке входа: ВК **#0077ff**, Яндекс **#fc3f1e**, ОК **#ee8208**; основная «Войти» по email — **neutral-900** (не конкурирует с синими OAuth).
- Skip-link к основному контенту на лендинге и квизе.

## Known issues

- `landing-hero.png` тяжёлый в бандле (~2.8 MB) — используется как poster/fallback; при желании сжать или заменить первый кадром видео.
- Hero-видео с CDN: зависит от доступности bucket и мобильной сети; при сбое показывается изображение.
- Соцвход (ВК / Яндекс / ОК) по-прежнему не реализован; кнопки в модалке показывают только сообщение, что вход пока недоступен.
- Реальный login/register зависит от доступности backend API и БД; в текущем backend memory зафиксирован `ECONNREFUSED` до PostgreSQL.
- Карусель, секция `#discover` и страница месты требуют работающего `GET /places` / `GET /places/:id`; при недоступности API показывается ошибка и кнопка повтора, без подставных карточек.
- Interaction hydration для карусели тоже зависит от backend; при частичном падении `GET /places/:id/likes` / `GET /places/:id/comments` карточки всё равно рендерятся, но временно показывают fallback counts.
- Comments UI сейчас живёт только в `PlaceCommentsModal` на лендинге; на `PlaceDetailPage` комментарии и форма отправки пока не интегрированы.
- Comments modal пока загружает первую страницу `limit=20` и не реализует явную пагинацию / «показать ещё», хотя backend поддерживает `limit` и `offset`.
- Карта Яндекса на лендинге **опциональна:** без `VITE_YANDEX_MAPS_API_KEY` или при сбое CDN пользователь видит fallback; список в `#discover` остаётся рабочим.
- Logout сейчас только клиентский: JWT просто удаляется на фронте и не инвалидируется на сервере.

## Pending tasks (идеи)

- Подключить будущие OAuth-провайдеры (ВК / Яндекс / ОК) поверх существующего auth store.
- При необходимости добавить backend logout/session invalidation, если появится серверное хранение сессий или refresh tokens.
- При желании расширить integration до detail page: рендер комментариев, posting comments и отдельный interaction block на `/places/:id`.
- Если comments modal станет активнее использоваться, добавить пагинацию / `load more` поверх уже существующего backend `limit` / `offset`.
- Оптимизировать hero-постер / при желании self-host видео или адаптивные битрейты.
- При необходимости — общий контекст для модалки, если появятся несколько триггеров на одном экране.

## Important decisions

- Документация фронта ведётся в **`front/changes_frontend.md`** (лог) и **`front/memory_frontend.md`** (этот файл).
- Изменения только в каталоге **`front/`**, если не оговорено иное.
- Recommendation ordering для landing carousel теперь фиксирован и задокументирован: **likes first, then displayable photo quality, then stable API order**.
- Существующую auth-модалку не выносили в глобальный store: для гостевых лайков используется небольшой browser event bridge, чтобы не раздувать архитектуру ради одного interaction flow.
- Для комментариев на лендинге выбран modal-подход поверх существующей карусели, а не навигация на detail page, чтобы не ломать recommendation-feed UX и не плодить лишние переходы.

## Handoff notes

- **2026-03-21, mobile `/places` UX:** проверка после модалки свайпа, модалки «к маршруту» и бургер-шапки — **`cd front && npm run lint`** и **`npm run build`**, повтор вторым проходом; оба прохода успешны.
- **2026-03-21, toaster конструктора:** после замены инлайн-баннера на toaster — снова **`npm run lint`** и **`npm run build`** два прохода подряд; успешно.
- **2026-03-21, mobile `/places` layout:** после скрытия **`h1`**, однофото-колоды и **`h-dvh`**-layout — **`npm run lint`** и **`npm run build`** ×2; успешно.
- **2026-03-21, редактирование маршрута на `/routes/:id`:** после **`editableRouteStops`**, **`RouteAddStopModal`**, правок **`RouteDetailPage`** — **`npm run lint`** и **`npm run build`** ×2 (второй проход — снова **`lint` + `build`** в одной команде); успешно.
- **2026-03-21, `/routes/:id` review:** после **`RouteDetailPage`**, **`RouteYandexMap`**, **`yandexMapsLoader`**, **`routePlaceGroups`**, рефактор **`PlacesYandexMap`** — **`npm run lint`** и **`npm run build`** дважды (второй раз подряд в одной команде); успешно.
- **2026-03-21, квиз (5 вопросов):** после обновления **`quizSteps`**, **`quizStore`**, **`QuizPage`**, **`QuizNextButton`**, **`QuizDonePage`** — **`npm run lint`** и **`npm run build`** ×2; успешно.
- После правок фронта: обновить **оба** файла (`changes_frontend.md` + при необходимости `memory_frontend.md`).
- Новый агент: прочитать этот файл и последние записи в `changes_frontend.md`.
- После правок по interaction flow также обновлять backend docs: `back/changes_backend.md` и `back/memory_backend.md`, потому что фронтенд теперь зависит от конкретного place-interactions контракта.
