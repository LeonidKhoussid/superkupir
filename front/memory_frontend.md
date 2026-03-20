# Frontend memory — Край Тур

Краткий снимок состояния фронтенда для продолжения работы другим агентом или в новой сессии.

## Project overview

SPA «Край Тур»: лендинг с hero, квиз из нескольких шагов, экран завершения. Данные квиза пока моковые (без реального API). Вход по кнопке «Войти» — **только UI** (модалка, без интеграции с бэкендом или ВК).

## Current frontend stack

- **Vite 8** + **React** + **TypeScript**
- **Tailwind CSS v4** (`@import 'tailwindcss'`, `@tailwindcss/vite`)
- **React Router** (`BrowserRouter`)
- **Zustand** — ответы квиза (`features/quiz/quizStore.ts`)

## Pages / screens

| Маршрут            | Компонент        | Описание                          |
|--------------------|------------------|-----------------------------------|
| `/`                | `LandingPage`    | Hero (#4385F5), навигация, CTA в квиз |
| `/quiz/:stepId`    | `QuizPage`       | Вопросы, иллюстрации, прогресс    |
| `/quiz/done`       | `QuizDonePage`   | Финиш квиза                       |
| `*`                | редирект на `/`  |                                   |

## Component structure (важное)

- `components/LoginButton.tsx` — открывает модалку (`useState` + `modalKey` для сброса состояния при каждом открытии).
- `components/LoginModal.tsx` — диалог через `createPortal` → `document.body`. **Вход:** email, пароль, «Войти» (тёмная нейтральная кнопка), затем соцкнопки: ВК `#0077ff`, Яндекс `#fc3f1e`, Одноклассники `#ee8208`; ссылка «Зарегистрироваться». **Регистрация:** имя, email, пароль ×2, «Зарегистрироваться» (синяя `#4385f5`), ссылка назад. Всё без API.
- `components/Logo.tsx`, `DecorativeLoops.tsx`, `QuizOption.tsx`, `QuizNextButton.tsx`, `QuizIllustration.tsx`
- `pages/LandingPage.tsx`, `QuizDonePage.tsx`
- `features/quiz/QuizPage.tsx`, `quizStore.ts`
- `data/quizSteps.ts` — конфиг шагов квиза

## Routing structure

См. `src/App.tsx`: три маршрута + fallback `Navigate`.

## State management

- **Квиз:** Zustand (`useQuizStore`) — объект ответов по id шага.
- **Модалка входа/регистрации:** локальный стейт `LoginButton` (`open`, `modalKey`); внутри `LoginModal` — `panel: 'login' | 'register'`.

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
- Поля входа в модалке без отправки: Enter в форме только `preventDefault`.

## Pending tasks (идеи)

- Подключить реальный API входа и OAuth ВК.
- Оптимизировать hero-изображение (размер/формат).
- При необходимости — общий контекст для модалки, если появятся несколько триггеров на одном экране.

## Important decisions

- Документация фронта ведётся в **`front/changes_frontend.md`** (лог) и **`front/memory_frontend.md`** (этот файл).
- Изменения только в каталоге **`front/`**, если не оговорено иное.

## Handoff notes

- После правок фронта: обновить **оба** файла (`changes_frontend.md` + при необходимости `memory_frontend.md`).
- Новый агент: прочитать этот файл и последние записи в `changes_frontend.md`.
