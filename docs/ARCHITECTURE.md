# C2C Nearby — System Architecture

## 1. Product summary

C2C Nearby is a hyperlocal community marketplace. One account can buy, sell, publish events,
share local information, chat, negotiate, and review. The discovery radius is **fixed at 4,000
meters by the backend** and can never be widened by a client.

Transaction model: discovery → chat → price negotiation → meetup agreement → direct payment
between the two parties → mutual completion confirmation → review. The platform never processes
payments and never treats an accepted offer as proof of payment or delivery.

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Mobile | Flutter stable, Dart, Riverpod, GoRouter, Dio, Firebase Auth, FCM, Socket.IO client, secure storage |
| Admin | Angular stable (standalone components, strict TS), Angular Router lazy loading, Reactive Forms, Angular Material |
| API | Node.js, Fastify, TypeScript, Sequelize v6, MySQL 8+ (verified on MySQL 9.4), Firebase Admin SDK, Socket.IO, Sharp, S3-compatible storage |
| Realtime | Socket.IO gateway, authenticated with Firebase ID token, rooms derived from conversation membership |
| Infra | Native macOS/Linux installs only. **No Docker, no Compose, no Dockerfile.** |

Sequelize is the only ORM. Prisma, TypeORM, PostgreSQL and PostGIS are prohibited.

## 3. Monorepo layout

```
c2cNearby/
├── mobile_app/          Flutter app (feature-first)
├── admin_dashboard/     Angular admin (lazy routes)
├── backend/             Fastify modular monolith
├── docs/                Architecture, DB, API, security, deployment
└── README.md
```

Each app owns its dependencies and configuration. No shared runtime code between them.

## 4. Backend shape — modular monolith

```
backend/src/
├── app.ts                  Fastify instance factory (plugins, routes, error handler)
├── server.ts               bootstrap: config → db → migrations check → listen
├── config/                 env schema, constants (radius, pagination)
├── plugins/                firebase auth, db, security, swagger, multipart, errors
├── common/                 errors, response envelope, pagination, guards, types
├── modules/<domain>/       routes + handler + service + repository + schema + types
├── database/               models, migrations, seeders, associations, migration-runner, index
├── storage/                StorageService abstraction (S3 adapter + local adapter)
├── websocket/              Socket.IO gateway and authorization
├── jobs/                   optional background jobs (expiry, notification fan-out)
├── types/                  shared augmentations
└── utils/
```

Every module follows the same layering:

- **route** — HTTP contract, schema validation, auth/permission preconditions.
- **handler/controller** — translates request ↔ service call; no business rules.
- **service** — business rules, ownership checks, transactions.
- **repository** — Sequelize queries; keeps services free of query details.
- **schema** — TypeBox request/response schemas (also feeds OpenAPI).

Dependency wiring uses Fastify decorators and plain factory functions. No DI framework.

### Database lifecycle (hard rule)

1. Read config.
2. Create the Sequelize instance (pool from env).
3. Instantiate every model.
4. Register all associations once, centrally (`database/associations.ts`).
5. `authenticate()`.
6. Verify applied migrations equal the app's expected migration set; fail readiness otherwise.
7. Only then start Fastify.

`sequelize.sync()` and any `alter`/`force` variant are forbidden. They are guarded by tests that
grep the source tree. Migrations are executed only through explicit npm scripts.

### Request pipeline

`request → helmet/cors → rate limit → firebase auth (optional/required) → route schema
validation → handler → service → repository → response serialization → pino log`

Errors are centralised: domain errors (`AppError` with code/status) are mapped to a consistent
envelope; unknown errors are logged with the request id and returned as a generic 500.

### API conventions

- Base path `/api/v1`.
- Envelope: `{ "data": ..., "meta": { ... } }`; errors `{ "error": { "code", "message", "details" } }`.
- Cursor or page pagination, bounded `limit` (default 20, max 50).
- OpenAPI at `/docs`, JSON at `/docs/json`.
- Health: `/healthz` (liveness), `/readyz` (DB + migration status).

## 5. Identity and authorization

Firebase Authentication is the identity provider (Google Sign-In, phone OTP). The backend never
accepts a UID, role or phone number from a request body as authoritative.

- Mobile/Admin send `Authorization: Bearer <Firebase ID token>`.
- `firebaseAuth` plugin verifies the token with Firebase Admin SDK and loads the local user
  (auto-provisioning on first login with an incomplete profile).
- Admin routes additionally require an active `admin_users` row; role checks run in the service
  layer, not just the Angular menu.
- WebSocket handshake verifies the same token and derives room access from conversation rows.
- Sensitive mutations use `isSameOrigin` checks (admin) and CSRF-safe bearer-only APIs.

Onboarding status is derived from `profile_completed`, `phone_verified` and
`face_verification_status`; browsing is allowed before full verification, while selling,
offering, and chat can be gated by feature flags in the service layer.

## 6. Location and privacy model

- Every listing and user location stores `POINT` with `SRID 4326` as `POINT(longitude,
  latitude)`; MySQL keeps x=longitude, y=latitude for this SRS, so reads use `ST_Latitude()` and
  `ST_Longitude()`.
- A `SPATIAL INDEX` provides the candidate set; a bounding box (`ST_Within` on an envelope)
  narrows it, then `ST_Distance_Sphere` computes exact meters.
- The radius is a server constant (`DISCOVERY_RADIUS_M = 4000`). Client-provided radius is
  ignored and rejected by schema validation if present.
- Responses expose `distance_m` (rounded) and `location_public_label` only. Private coordinates,
  exact addresses and phone numbers never leave the backend.
- Raw spatial SQL uses `sequelize.query` with named replacements/bindings. No string
  concatenation with user input.

## 7. Media pipeline

Client picks/compresses an image → multipart upload → backend validates magic bytes, MIME,
extension and size → Sharp strips metadata, rotates, converts to WebP → thumbnail variant →
StorageService upload → metadata row in MySQL.

| Variant | Longest side | WebP quality |
| --- | --- | --- |
| Listing / event poster | 1600 px | 78 |
| Thumbnail | 400 px | 70 |
| Avatar | 512 px | 75 |
| Chat media | 1280 px | 75 |

Verification media uses the private bucket/prefix and time-limited signed URLs. Binary image data
is never stored in MySQL.

## 8. Realtime chat

Socket.IO is transport only; MySQL is the source of truth. Each message is persisted first, then
broadcast. Rooms are `conversation:<uuid>` and membership is checked against `conversations`
before join. Offers, meetups, and transaction state are structured tables, emitted as events after
the database commit.

## 9. Admin dashboard

Angular SPA, REST-only. No database driver, no service credentials, no Firebase Admin SDK in the
browser. Firebase Auth (Google) is used for sign-in; the API verifies admin membership and role
on every request. Menu visibility is a UX convenience, never an authorization boundary.

## 10. Environments

Development, staging, production share the same code and differ only by environment variables.
Production runs Node.js behind Nginx/PM2 on a Linux host with a native MySQL server. Backups,
restore drills and migration procedures are documented in `docs/DEPLOYMENT.md` and
`docs/DATABASE_MIGRATIONS.md`.

## 11. Non-goals for the first release

- In-app payments, escrow, shipping and courier integration.
- Microservices, message brokers, Kubernetes, Docker.
- Algorithmic face recognition (an external provider adapter with a clearly labelled mock is used
  until a provider is contractually selected).
