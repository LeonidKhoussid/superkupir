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
| `/`                | `LandingPage`    | Hero (#4385F5), навигация, CTA в квиз |
| `/quiz/:stepId`    | `QuizPage`       | Вопросы, иллюстрации, прогресс    |
| `/quiz/done`       | `QuizDonePage`   | Финиш квиза                       |
| `*`                | редирект на `/`  |                                   |

## Component structure (важное)

- `components/LoginButton.tsx` — открывает модалку (`useState` + `modalKey` для сброса состояния при каждом открытии); после успешного входа показывает email авторизованного пользователя и открывает account-состояние модалки по клику.
- `components/LoginModal.tsx` — диалог через `createPortal` → `document.body`. **Вход:** email + пароль отправляются в backend `POST /auth/login`; **регистрация:** email + пароль отправляются в `POST /auth/register`, поле имени пока UI-only, пароль ×2 валидируется на фронте; **logout:** для авторизованного пользователя показывает экран «Аккаунт» с email и кнопкой «Выйти». Показывает loading/error-состояния; соцкнопки пока выводят сообщение «Социальный вход пока недоступен».
- `features/auth/authApi.ts` — frontend API-слой для `POST /auth/login`, `POST /auth/register`, `GET /auth/me`.
- `features/auth/authStore.ts` — Zustand store для auth state, localStorage persistence и восстановления текущего пользователя.
- `components/Logo.tsx`, `DecorativeLoops.tsx`, `QuizOption.tsx`, `QuizNextButton.tsx`, `QuizIllustration.tsx`
- `pages/LandingPage.tsx`, `QuizDonePage.tsx`
- `features/quiz/QuizPage.tsx`, `quizStore.ts`
- `data/quizSteps.ts` — конфиг шагов квиза

## Routing structure

См. `src/App.tsx`: три маршрута + fallback `Navigate`.

## State management

- **Квиз:** Zustand (`useQuizStore`) — объект ответов по id шага.
- **Auth:** Zustand (`useAuthStore`) — `user`, `token`, `status`, `error`; хранение в `localStorage` под ключом `kray-tour-auth`.
- **Восстановление сессии:** `App.tsx` вызывает `hydrateSession()`, который при наличии токена делает `GET /auth/me`.
- **Logout:** клиентский `logout()` в `useAuthStore` удаляет `{ user, token }` из Zustand и `localStorage`; отдельного backend logout endpoint пока нет.
- **Модалка auth:** локальный стейт `LoginButton` (`open`, `modalKey`); внутри `LoginModal` — `panel: 'login' | 'register' | 'account'`, состояния полей, локальные валидационные ошибки.

## Styling approach

- Tailwind utility-first, кастомные токены в `src/index.css` (`@theme`): `--font-display`, `--color-kr-blue`, `--color-kr-lime`, и т.д.
- Шрифт интерфейса: **AA Stetica** из `front/assets/fonts/` (объявления `@font-face` в `index.css`).
- Крупные изображения квиза: `src/assets/quiz/*.png`; hero лендинга: `src/assets/landing-hero.png` (разделение 50/50 по ширине в hero).

## Asset usage

- Шрифты: `assets/fonts/*.otf` (не коммитить нарушения лицензии — см. `assets/fonts/COPYRIGHT.txt`).
- Favicon: `public/favicon.svg`.
- Иллюстрации квиза и hero — импорт в компонентах, Vite кладёт в `dist/assets`.

## Important design rules

- Mobile-first; брейкпоинты Tailwind (`sm`, `md`, `lg`).
- Фирменные цвета: hero/акцент **#4385F5**, квиз-фон часто **#3b82f6**, лайм **#C1FF2C** (`text-kr-lime`).
- Соцкнопки в модалке входа: ВК **#0077ff**, Яндекс **#fc3f1e**, ОК **#ee8208**; основная «Войти» по email — **neutral-900** (не конкурирует с синими OAuth).
- Skip-link к основному контенту на лендинге и квизе.

## Known issues

- `landing-hero.png` очень тяжёлый в бандле (~2.8 MB) — при желании оптимизировать отдельно.
- Соцвход (ВК / Яндекс / ОК) по-прежнему не реализован; кнопки в модалке показывают только сообщение, что вход пока недоступен.
- Реальный login/register зависит от доступности backend API и БД; в текущем backend memory зафиксирован `ECONNREFUSED` до PostgreSQL.
- Logout сейчас только клиентский: JWT просто удаляется на фронте и не инвалидируется на сервере.

## Pending tasks (идеи)

- Подключить будущие OAuth-провайдеры (ВК / Яндекс / ОК) поверх существующего auth store.
- При необходимости добавить backend logout/session invalidation, если появится серверное хранение сессий или refresh tokens.
- Оптимизировать hero-изображение (размер/формат).
- При необходимости — общий контекст для модалки, если появятся несколько триггеров на одном экране.

## Important decisions

- Документация фронта ведётся в **`front/changes_frontend.md`** (лог) и **`front/memory_frontend.md`** (этот файл).
- Изменения только в каталоге **`front/`**, если не оговорено иное.

## Handoff notes

- После правок фронта: обновить **оба** файла (`changes_frontend.md` + при необходимости `memory_frontend.md`).
- Новый агент: прочитать этот файл и последние записи в `changes_frontend.md`.
