# Project overview

- Backend code lives in `/Users/leo/Documents/superkiper/back`.
- The backend was initially empty except for `readme.md`; the first implemented backend feature is credentials auth.
- Frontend auth UI in `/Users/leo/Documents/superkiper/front` is now wired to the backend email/password auth flow.

# Current backend stack

- Node.js
- TypeScript
- Express
- PostgreSQL via `pg`
- Zod for request validation
- `bcryptjs` for password hashing
- JWT access tokens via `jsonwebtoken`
- Prisma schema file present for DB model alignment, but runtime data access currently uses raw SQL through `pg`
- Local verification completed: `npm run check`, `npm run build`, and a server smoke test against `GET /health`

# Current backend architecture

- `src/server.ts`: process startup and graceful shutdown.
- `src/app.ts`: Express app wiring and minimal CORS headers for browser auth requests from the frontend.
- `src/config/env.ts`: environment validation.
- `src/db/pg-config.ts`: shared PostgreSQL client config using plain `DATABASE_URL` connections.
- `src/db/pool.ts`: PostgreSQL pool.
- `src/lib/errors.ts`: async handler, 404 handler, centralized error middleware.
- `src/scripts/run-auth-sql.ts`: backend-only helper for applying the auth SQL bootstrap file.
- `src/modules/auth/*`: isolated auth module.
- `src/modules/health/*`: simple health route.

# Implemented modules

- Health module:
  - `GET /health`
- Auth module:
  - controller, routes, service, repository, middleware
  - credentials provider isolated in `src/modules/auth/providers/credentials.provider.ts`
  - provider name union already includes `credentials`, `vk`, `yandex`, and `ok` for future extension
  - currently consumed by the frontend login/register modal

# Current auth flow

- Registration:
  - `POST /auth/register`
  - used by the frontend registration panel in `front/src/components/LoginModal.tsx`
  - validates `email` and `password`
  - normalizes email to lowercase
  - prevents duplicate email
  - hashes password with bcrypt
  - returns `{ user, token }`
- Login:
  - `POST /auth/login`
  - used by the frontend login panel in `front/src/components/LoginModal.tsx`
  - validates `email` and `password`
  - compares bcrypt hash
  - returns `{ user, token }`
- Current user:
  - `GET /auth/me`
  - used by the frontend auth bootstrap/store to restore a persisted session from token
  - requires `Authorization: Bearer <token>`
  - verifies JWT and loads the authenticated user
- Logout:
  - currently initiated from the frontend account modal
  - no backend endpoint yet; frontend clears the stored JWT and user locally

# Routes/endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- Browser access is currently allowed via basic `Access-Control-Allow-*` headers in `src/app.ts`

# Database/auth model notes

- SQL bootstrap file: `/Users/leo/Documents/superkiper/back/sql/create_auth_tables.sql`
- SQL runner command: `npm run db:init:auth`
- SQL runner dry run: `npm run db:init:auth -- --dry-run`
- Current backend `.env` uses a plain `DATABASE_URL` connection without SSL/TLS settings
- Frontend contract:
  - `POST /auth/login` and `POST /auth/register` expect `{ email, password }`
  - both return `{ user: { id, email }, token }`
  - `GET /auth/me` returns `{ user: { id, email } }`
- Prisma model snapshot: `/Users/leo/Documents/superkiper/back/prisma/schema.prisma`
- Primary auth table:
  - `auth_users`
  - columns: `id`, `email`, `password_hash`, `created_at`, `updated_at`
- Constraints:
  - unique index on `email`
  - lowercase email check constraint
  - trigger updates `updated_at` on row updates

# Validation/auth rules

- Email must be present, valid, max 320 chars, and is lowercased before persistence.
- Password must be present, minimum 8 chars, maximum 72 chars.
- Password hashes are never returned in API responses.
- Login errors intentionally use a generic invalid credentials message.
- JWT middleware rejects missing, invalid, or expired bearer tokens.

# Env variables used by backend

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`
- `npm run db:init:auth` requires `DATABASE_URL`

# Known issues

- No automated tests yet.
- No migration runner exists yet; the SQL bootstrap file is applied through the backend helper script instead of a formal migration tool.
- JWT refresh tokens and logout/session invalidation are not implemented in this first version.
- Auth endpoints that hit PostgreSQL were not executed end-to-end because the provided auth SQL has not been applied by this backend yet.
- The current plain PostgreSQL connection still fails with `ECONNREFUSED` to `shifisemouco.beget.app:5432`.
- Because of that DB connectivity failure, the new frontend auth wiring is implemented and build-verified, but cannot complete a real successful login until backend DB access works.
- Logout is currently client-side only; existing JWTs are not invalidated server-side.

# Pending tasks

- Apply `sql/create_auth_tables.sql` to the target PostgreSQL database.
- Add automated integration tests for register/login/me flows.
- Add future auth providers behind the provider layer without changing controller contracts or the current frontend store API.
- Add a backend logout/session invalidation endpoint only if the project later needs server-side session control or refresh tokens.
- Decide whether to keep raw `pg` access or move the runtime auth repository to Prisma later.

# Important decisions

- All backend work stays under `back/` to avoid frontend merge conflicts.
- The first auth implementation supports only email/password credentials.
- Provider-specific logic is isolated so social providers can be added later without rewriting route/controller code.
- Runtime data access uses raw SQL for the smallest working implementation, while a Prisma schema file documents the current auth model.
- Backend CORS handling is intentionally minimal and limited to enabling the current frontend auth flow.
- Current logout behavior is intentionally frontend-only to keep the first auth version minimal.

# Handoff notes

- Before starting the server, create a backend `.env` file or export env vars; use `.env.example` as the template.
- Required DB schema is in `sql/create_auth_tables.sql`.
- To apply the schema: run `npm run db:init:auth` from `/Users/leo/Documents/superkiper/back`.
- The auth module assumes the database table already exists.
- Backend-local `.gitignore` ignores `node_modules/`, `dist/`, and `.env`.
- Frontend auth expects the backend to be reachable at `http://localhost:3000` unless `VITE_API_BASE_URL` is set on the frontend side.
