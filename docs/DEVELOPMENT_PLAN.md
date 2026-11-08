# Development Plan

Work is delivered in tested phases. A phase closes only when its gates pass and the report is
written. Backend features are never faked in the UI once the API exists.

## Phase 0 — Audit, architecture, database design ✅

Deliverables:

- Environment audit (Node 24.20, Flutter 3.41.6/Dart 3.11.4, Angular CLI 21.2.2, MySQL 9.4).
- Monorepo scaffold (`mobile_app/`, `admin_dashboard/`, `backend/`, `docs/`).
- `docs/ARCHITECTURE.md`, `DATABASE.md` (ERD + 21 tables + indexes + spatial plan),
  `DATABASE_MIGRATIONS.md`, `DATABASE_ASSOCIATIONS.md`, `AUTHENTICATION.md`, `STORAGE.md`,
  `SECURITY.md`, `API.md`, `DEPLOYMENT.md`, this plan.
- Sequencing rules: no `sync()`, manual associations, explicit migrations, fixed 4 km radius.

Gate: documents reviewed; schema agreed; no code depends on Docker.

## Phase 1 — UI/UX and application skeleton 🚧

Flutter (mock repositories behind interfaces):

- Design system: Electric Blue / Navy palette, Plus Jakarta Sans, 16–20 px radii, light + dark.
- Five-tab shell: Jelajah, Favorit, Jual, Chat, Profil (center action).
- Explore feed with search, post-type tabs, categories, radius-4-km label, pagination, skeleton,
  empty and error states.
- Detail screens for sell/event/information variants; favorite toggle; chat entry.
- Create flow for sell/event/information with validation, image picker, draft state, success.
- Favorites with type filter; chat list + room with text/image/offer/meetup bubbles and local
  accept/counter actions; profile, my posts, reviews, verification and settings screens.
- Light/dark switching persisted locally.

Angular (mock data service):

- Corporate layout: sidebar, toolbar, responsive drawer, theme toggle.
- 15 menu areas with functional tables/filters/forms on mock data: dashboard, users,
  verifications, posts/moderation, categories, events, information, reports, agreements, reviews,
  notifications, settings, admins/roles, audit log.
- Lazy-load all feature routes; strict templates; reactive forms where editable.

Gate: `flutter analyze` clean, Flutter widget smoke test passes, `ng build` succeeds. Mock data is
labelled as such; no claim of backend persistence.

## Phase 2 — Backend foundation and database ⏳

- Fastify app factory, env validation, Pino, Helmet, CORS, rate limit, multipart, Swagger,
  centralized errors, response envelope.
- Sequelize connection + pool, model registry (21 models), manual associations, migration runner.
- 21+ migrations incl. spatial indexes and FK constraints; seeders for categories and dev data.
- `/healthz`, `/readyz` with migration compatibility check; startup refuses pending migrations.
- Tests: model init, association aliases, migration up/down on scratch DB, FK/unique enforcement,
  readiness failure on pending migration, static scan for `sync(`.

## Phase 3 — Authentication and onboarding ✅

Firebase Admin verification plugin, session provisioning, profile/username/avatar, phone
verification mirroring, face provider interface + mock, onboarding state, admin session/roles.
Flutter and Angular wired to real endpoints; tokens stay with the Firebase SDK and are never
persisted by the app. Report: `PHASE-3-REPORT.md`. Live Firebase verification still needs the
service account and Android fingerprints to be registered in the console.

## Phase 4 — Posts, media, 4 km discovery ⏳

Listing CRUD for three post types, status transitions, image pipeline (Sharp → WebP + thumbnail),
StorageService (S3 + local), 4 km spatial search with bounding box + `ST_Distance_Sphere`,
privacy-safe DTOs, favorites, event participation, expiry job.

## Phase 5 — Chat, offers, agreements, reviews ⏳

Socket.IO gateway with membership authorization, message persistence and read receipts, typing,
structured offers with counter/accept/reject, agreements with meetup, dual confirmation,
transaction completion, review eligibility and aggregates.

## Phase 6 — Admin dashboard integration ⏳

Replace mock services with API, auth guard, role-based UI + backend permissions, moderation
workflow, category management, verification review (masked phone), reports, audit log viewer.

## Phase 7 — Notifications and hardening ⏳

FCM device tokens, per-type preferences, push payloads without personal data, event reminders,
expiry notices; security tests, rate-limit tests, account deletion, data export, privacy docs.

## Phase 8 — Optimization and release ⏳

Query and feed optimization with EXPLAIN, image/cache tuning, Flutter performance pass, Angular
production build, E2E tests, deployment runbook rehearsal, Android release bundle, final docs.

## Working agreements

1. Each phase ends with: files created/changed, what works, what is pending, manual config, test
   results, found errors, run instructions.
2. Do not start a phase while its critical tests fail.
3. Never modify an applied migration; add a new one.
4. Never add Docker or a second ORM.
5. Never widen the 4 km radius or expose private location/phone data.
6. Report mock/simulated behaviour explicitly (face verification, Phase-1 data).
