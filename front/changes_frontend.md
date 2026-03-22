# Frontend change log

Новые записи добавляются **сверху** (сначала самые свежие).

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
