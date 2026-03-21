# Frontend change log

Новые записи добавляются **сверху** (сначала самые свежие).

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
