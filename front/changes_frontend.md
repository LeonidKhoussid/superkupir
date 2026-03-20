# Frontend change log

Новые записи добавляются **сверху** (сначала самые свежие).

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
