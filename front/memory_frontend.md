# Frontend memory — Край Тур

Краткий снимок состояния фронтенда для продолжения работы другим агентом или в новой сессии.

## Project overview

SPA «Край Тур»: лендинг с hero, квиз из нескольких шагов, экран завершения. Данные квиза пока моковые (без реального API), но auth-модалка теперь подключена к backend email/password auth.

## Current frontend stack

- **Vite 8** + **React** + **TypeScript**
- **Tailwind CSS v4** (`@import 'tailwindcss'`, `@tailwindcss/vite`)
- **React Router** (`BrowserRouter`)
- **Zustand** — ответы квиза (`features/quiz/quizStore.ts`)
- **Zustand** — auth state (`features/auth/authStore.ts`) для `{ user, token }`

## Pages / screens

| Маршрут            | Компонент        | Описание                          |
|--------------------|------------------|-----------------------------------|
| `/`                | `LandingPage`    | Full-bleed hero (видео) + **#places** — карусель из `GET /places` + **#discover** — каталог с пагинацией и Yandex Map |
| `/places/:id`      | `PlaceDetailPage`| Карточка места: `GET /places/:id` (внутренний числовой id) |
| `/quiz/:stepId`    | `QuizPage`       | Вопросы, иллюстрации, прогресс    |
| `/quiz/done`       | `QuizDonePage`   | Финиш квиза                       |
| `*`                | редирект на `/`  |                                   |

## Component structure (важное)

- `components/LandingHeroMedia.tsx` — фон лендинга: `<video>` (URL в константе `LANDING_HERO_VIDEO_SRC`) с `poster={landing-hero.png}`, fallback на то же изображение при ошибке/`play()` reject; при `prefers-reduced-motion: reduce` только картинка. Слои градиентов поверх, `pointer-events-none`, без взаимодействия с видео.
- `features/places/placesApi.ts` — `GET /places` / `GET /places/:id`. Ответ списка: объект `{ items, total, limit, offset }` (не массив). Поля мест в **snake_case** как у API. **Нормализация на фронте:** `id` и при необходимости `total`/`limit`/`offset`/`lat`/`lon` могут приходить **строками** (например BIGINT в JSON) — парсер приводит к числам; невалидные строки в `items` отбрасываются. `photo_urls` — массив строк, иначе `[]`. Для витрины: **`placeHasDisplayablePhoto`** / **`prioritizePlacesWithPhotos`**. Для карты: **`placeHasValidCoordinates`** / **`getPlaceLatLon`** — маркеры только если `lat`/`lon` конечные и в диапазонах широты/долготы; порядок координат для Яндекса **[lat, lon]**. Размер страницы для секции-эксплорера: **`PLACES_PAGE_SIZE_EXPLORER`** (25).
- `components/LandingPlacesCarousel.tsx` — карусель под hero; после загрузки применяет `prioritizePlacesWithPhotos`. **Автопрокрутка:** каждые ~5.2s `scrollBy` на ширину карточки + gap (из layout), в конце — плавный `scrollTo(0)`; при **`prefers-reduced-motion: reduce`** интервал не ставится. **Пауза:** пока курсор над блоком (`mouseenter`/`leave`); после ручного скролла, `wheel`, `touchstart` или кнопок ‹ › — пауза **~10 s** (`pauseUntilRef`); программная прокрутка помечается флагом, чтобы `scroll` не продлевал паузу зря. Состояния loading/error/empty без изменений.
- **`PlacesExplorerSection.tsx`** — секция **`#discover`** сразу **после** карусели: загрузка списка мест тем же `GET /places` с **`limit = PLACES_PAGE_SIZE_EXPLORER`** и нарастающим **`offset`**; первая загрузка + «догрузка вниз»; **`fetchGenRef`** сбрасывает устаревшие ответы при «Повторить»; дедуп по **`id`**; `hasMore` через **`total`** и текущую длину списка; refs против гонок (`fetchingMoreRef`). Состояния: скелет при первой загрузке, ошибка с повтором, пустой список. **Desktop layout:** одна строка grid с **фиксированной высотой** блока (`lg:h-[clamp(22rem,62vh,46rem)]` и т.п.), колонки **32.5%** (список) + **`gap-x-[5%]`** + **62.5%** (карта); **`min-h-0`** / **`overflow-hidden`** на колонках, чтобы flex/grid дети могли сжиматься. **Левая панель:** `overflow-y-auto`, `ref` → **`listScrollRoot`** в state для дочернего IO. **Мобилка:** колонки стекуются (`flex-col`), у списка **`max-h-[min(56vh,520px)]`**, у карты разумный **`min-h`**, без раздувания страницы списком.
- **`PlacesExplorerList.tsx`** — элементы списка внутри **прокручиваемой панели** родителя; **IntersectionObserver** на sentinel с **`root: scrollRoot`** (эта панель), **`rootMargin`** ~120px; пока **`scrollRoot === null`**, observer не создаётся. Колбэк **`onLoadMoreRef`** + `useEffect`. Строка места: миниатюра, имя, регион, бейдж координат; выбор → **`selectedPlaceId`**; «Подробнее» — `Link` на `/places/:id`.
- **`PlacesYandexMap.tsx`** — подключает **`https://api-maps.yandex.ru/2.1/?apikey=...&lang=ru_RU`**. Ключ: **`VITE_YANDEX_MAPS_API_KEY`**. **Отложенный mount** по **`visibilityAnchorRef`**. Карта в **колонке фиксированной высоты**: обёртка и **`containerRef`** с **`h-full` / `min-h-0`**, без `sticky`; после mount **ResizeObserver** на контейнер → **`map.container?.fitToViewport?.()`**. Маркеры через **`getPlaceLatLon`**, `setBounds` / `setCenter` как раньше. **Fallback** при отсутствии ключа или ошибке — на всю высоту колонки (`h-full`, мобильный `min-h`).
- `components/LoginButton.tsx` — открывает модалку (`useState` + `modalKey` для сброса состояния при каждом открытии); передаёт в модалку `initialPanel={user ? 'account' : 'login'}`; после успешного входа показывает email и по клику открывает экран аккаунта.
- `components/LoginModal.tsx` — диалог через `createPortal` → `document.body`. **Вход:** email + пароль отправляются в backend `POST /auth/login`; **регистрация:** email + пароль отправляются в `POST /auth/register`, поле имени пока UI-only, пароль ×2 валидируется на фронте; **logout:** для авторизованного пользователя показывает экран «Аккаунт» с email и кнопкой «Выйти». Показывает loading/error-состояния; соцкнопки пока выводят сообщение «Социальный вход пока недоступен».
- `features/auth/authApi.ts` — frontend API-слой для `POST /auth/login`, `POST /auth/register`, `GET /auth/me`.
- `features/auth/authStore.ts` — Zustand store для auth state, localStorage persistence и восстановления текущего пользователя.
- `components/Logo.tsx`, `DecorativeLoops.tsx`, `QuizOption.tsx`, `QuizNextButton.tsx`, `QuizIllustration.tsx`
- `pages/LandingPage.tsx`, `PlaceDetailPage.tsx`, `QuizDonePage.tsx`
- `features/quiz/QuizPage.tsx`, `quizStore.ts`
- `data/quizSteps.ts` — конфиг шагов квиза

## Routing structure

См. `src/App.tsx`: `/`, `/places/:id`, квиз, fallback `Navigate`.

## State management

- **Квиз:** Zustand (`useQuizStore`) — объект ответов по id шага.
- **Auth:** Zustand (`useAuthStore`) — `user`, `token`, `status`, `error`; хранение в `localStorage` под ключом `kray-tour-auth`.
- **Восстановление сессии:** `App.tsx` вызывает `hydrateSession()`, который при наличии токена делает `GET /auth/me`.
- **Logout:** клиентский `logout()` в `useAuthStore` удаляет `{ user, token }` из Zustand и `localStorage`; отдельного backend logout endpoint пока нет.
- **Модалка auth:** локальный стейт `LoginButton` (`open`, `modalKey`); внутри `LoginModal` — `panel: 'login' | 'register' | 'account'`, состояния полей, локальные валидационные ошибки.

## Styling approach

- Tailwind utility-first, кастомные токены в `src/index.css` (`@theme`): `--font-display`, `--color-kr-blue`, `--color-kr-lime`, и т.д.
- Шрифт интерфейса: **AA Stetica** из `front/assets/fonts/` (объявления `@font-face` в `index.css`).
- Крупные изображения квиза: `src/assets/quiz/*.png`; `landing-hero.png` — постер и fallback для hero-видео на лендинге.

## Asset usage

- Шрифты: `assets/fonts/*.otf` (не коммитить нарушения лицензии — см. `assets/fonts/COPYRIGHT.txt`).
- Favicon: `public/favicon.svg`.
- Иллюстрации квиза и постер hero — импорт в компонентах, Vite кладёт в `dist/assets`. Видео hero грузится по абсолютному URL (не в бандле).

## Important design rules

- Mobile-first; брейкпоинты Tailwind (`sm`, `md`, `lg`).
- Фирменные цвета: hero/акцент **#4385F5**, квиз-фон часто **#3b82f6**, лайм **#C1FF2C** (`text-kr-lime`).
- Соцкнопки в модалке входа: ВК **#0077ff**, Яндекс **#fc3f1e**, ОК **#ee8208**; основная «Войти» по email — **neutral-900** (не конкурирует с синими OAuth).
- Skip-link к основному контенту на лендинге и квизе.

## Known issues

- `landing-hero.png` тяжёлый в бандле (~2.8 MB) — используется как poster/fallback; при желании сжать или заменить первый кадром видео.
- Hero-видео с CDN: зависит от доступности bucket и мобильной сети; при сбое показывается изображение.
- Соцвход (ВК / Яндекс / ОК) по-прежнему не реализован; кнопки в модалке показывают только сообщение, что вход пока недоступен.
- Реальный login/register зависит от доступности backend API и БД; в текущем backend memory зафиксирован `ECONNREFUSED` до PostgreSQL.
- Карусель, секция `#discover` и страница месты требуют работающего `GET /places` / `GET /places/:id`; при недоступности API показывается ошибка и кнопка повтора, без подставных карточек.
- Карта Яндекса на лендинге **опциональна:** без `VITE_YANDEX_MAPS_API_KEY` или при сбое CDN пользователь видит fallback; список в `#discover` остаётся рабочим.
- Logout сейчас только клиентский: JWT просто удаляется на фронте и не инвалидируется на сервере.

## Pending tasks (идеи)

- Подключить будущие OAuth-провайдеры (ВК / Яндекс / ОК) поверх существующего auth store.
- При необходимости добавить backend logout/session invalidation, если появится серверное хранение сессий или refresh tokens.
- Оптимизировать hero-постер / при желании self-host видео или адаптивные битрейты.
- При необходимости — общий контекст для модалки, если появятся несколько триггеров на одном экране.

## Important decisions

- Документация фронта ведётся в **`front/changes_frontend.md`** (лог) и **`front/memory_frontend.md`** (этот файл).
- Изменения только в каталоге **`front/`**, если не оговорено иное.

## Handoff notes

- После правок фронта: обновить **оба** файла (`changes_frontend.md` + при необходимости `memory_frontend.md`).
- Новый агент: прочитать этот файл и последние записи в `changes_frontend.md`.
