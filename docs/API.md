# REST API Contract (v1)

Base URL: `/api/v1`. All private endpoints require `Authorization: Bearer <Firebase ID token>`.
Responses use a consistent envelope:

```json
{ "data": { }, "meta": { "page": 1, "limit": 20, "total": 134 } }
```

Errors:

```json
{ "error": { "code": "LISTING_NOT_FOUND", "message": "Posting tidak ditemukan.", "details": null } }
```

Status codes: 200/201 success, 204 no content, 400 validation, 401 unauthenticated, 403
forbidden, 404 missing, 409 conflict/state, 422 business rule, 429 rate limited, 500 unexpected.

Pagination: `?page=1&limit=20`; `limit` max 50. Feed endpoints also accept `cursor` where noted.
All timestamps are ISO-8601 UTC. IDs are UUID strings.

## Endpoints (implementation status)

Legend: `[P2]` backend phase 2, `[P3]` auth/profile, `[P4]` listings, `[P5]` chat, `[P6]` admin,
`[P7]` notifications.

### System `[P2]`
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | liveness, no DB |
| GET | `/readyz` | DB + migration readiness |
| GET | `/docs` | Swagger UI (non-production) |

### Auth & profile `[P3]`
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/session` | verify Firebase token, provision/find user, return profile + onboarding state |
| GET | `/me` | own profile (private fields masked except own phone) |
| PATCH | `/me` | display name, bio, area label |
| PATCH | `/me/username` | uniqueness + rate limit |
| POST | `/me/avatar` | multipart, WebP 512 px |
| POST | `/me/phone/verify` | submit Firebase phone credential, mark verified after server verification |
| GET | `/me/location` | own location (private) |
| PUT | `/me/location` | lat/lng validation, stores POINT |
| POST | `/me/verification/face/session` | create provider session (mock in dev) |
| GET | `/me/verification/face/session/:id` | status |
| POST | `/me/verification/face/callback` | provider callback, signature/state checked |
| DELETE | `/me` | account deletion request (grace period) |

### Listings & discovery `[P4]`
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/categories?post_type=` | active categories ordered |
| GET | `/listings` | `lat`, `lng` required for feed; `post_type`, `category_id`, `q`, `page`, `limit`. Radius fixed 4000 m |
| GET | `/listings/:id` | public detail; distance computed for authenticated viewer location |
| POST | `/listings` | create draft/active; ownership of images validated |
| PATCH | `/listings/:id` | owner only; status transitions validated |
| DELETE | `/listings/:id` | soft delete, owner only |
| POST | `/listings/:id/renew` | extends expiry |
| POST | `/listings/:id/images` | multipart, max 8 |
| DELETE | `/listings/:id/images/:imageId` | owner only |
| POST | `/listings/:id/favorite` | idempotent |
| DELETE | `/listings/:id/favorite` | |
| GET | `/me/favorites` | paginated, filter `post_type` |
| POST | `/events/:id/participate` | interested/going |
| DELETE | `/events/:id/participate` | cancel |

### Chat, offers, agreements `[P5]`
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/conversations` | `{ listing_id }`; buyer derived from token; blocks checked |
| GET | `/conversations` | own threads, paginated |
| GET | `/conversations/:id/messages` | membership checked, cursor |
| POST | `/conversations/:id/messages` | text/image, persisted then emitted |
| POST | `/conversations/:id/offers` | offer/counter, price > 0, listing negotiable |
| PATCH | `/offers/:id` | accept/reject/withdraw; receiver/sender rules |
| POST | `/conversations/:id/agreements` | buyer/seller agreement with price + meetup |
| PATCH | `/agreements/:id` | meetup, confirm, cancel, dispute |
| POST | `/agreements/:id/reviews` | after completion, one per party |

### Reviews, reports, notifications `[P5–P7]`
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users/:username` | public profile + rating + active listing count |
| GET | `/users/:username/reviews` | paginated |
| POST | `/reports` | reason, description, target user/listing |
| POST | `/users/:id/block` | |
| DELETE | `/users/:id/block` | |
| GET | `/notifications` | own, paginated |
| POST | `/notifications/read` | mark all/specific |
| GET | `/me/notification-preferences` / PATCH | per-type toggles |
| POST | `/me/device-tokens` | register FCM token |
| DELETE | `/me/device-tokens/:token` | |

### Admin `[P6]`
All require an active admin role; permission checks server-side.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/admin/dashboard/summary` | any admin |
| GET | `/admin/users` + `/:id` | any admin |
| PATCH | `/admin/users/:id/status` | admin, super_admin |
| GET | `/admin/verifications` + review actions | verification_manager, super_admin |
| GET | `/admin/listings`, PATCH status, DELETE | moderator, admin, super_admin |
| GET/POST/PATCH | `/admin/categories` | admin, super_admin |
| GET | `/admin/reports`, PATCH resolve | moderator, admin, super_admin |
| GET | `/admin/agreements` | support, admin, super_admin |
| GET | `/admin/reviews`, PATCH visibility | moderator, admin, super_admin |
| GET/PUT | `/admin/settings` | super_admin (write), admin (read) |
| GET/POST/PATCH | `/admin/admins` | super_admin |
| GET | `/admin/audit-logs` | super_admin |

### FASE 3 implementation notes

Implemented exactly as listed above, with these additions and clarifications
(see `docs/PHASE-3-REPORT.md`):

- `POST /auth/session` returns `200` for an existing profile and `201` for a newly provisioned
  one; body is `{ user, onboarding, session }` where `session` carries the verifier name and
  token expiry.
- `GET|PATCH /me` additionally return `location` (`GET`) and `onboarding`; `phone` is returned
  only to its owner, `phone_masked` always.
- `POST /me/phone/verify` requires a completed profile (`403 ONBOARDING_REQUIRED`) and a token
  carrying `phone_number` (`422 PHONE_NOT_VERIFIED`).
- `POST /me/verification/face/session` requires a verified phone and explicit consent
  (`422 FACE_CONSENT_REQUIRED`). The callback is authenticated by `x-face-signature`
  (HMAC-SHA256 of `<session_id>:<status>`) and replays return `409 FACE_CALLBACK_REPLAY`.
- `DELETE /me` answers `202` with `grace_days`, `purge_after` and the request timestamp; the
  next `POST /auth/session` cancels the pending deletion.
- Admin auth is exposed as `POST /admin/auth/session` and `GET /admin/auth/me`, returning
  `{ admin, permissions }` with permissions derived from the database role.

## WebSocket events

Namespace `/chat`. Handshake: `auth.token` Firebase ID token. Server joins
`user:<id>` and `conversation:<id>` after membership checks.

Client → server: `message:send`, `typing:start`, `typing:stop`, `message:read`.
Server → client: `message:new`, `message:read`, `typing`, `offer:new`, `offer:updated`,
`agreement:updated`, `notification:new`.

Every write is validated and persisted before emission; clients reconcile with REST snapshots
after reconnect.

## Upload contract

`multipart/form-data`, field `file`, plus `purpose` (`listing|event|avatar|chat|verification`).
Response: `{ data: { url, thumbnail_url, width, height, mime, size } }`. Servers reject files
that fail magic-byte, dimension, or size validation with `400 INVALID_IMAGE`.
