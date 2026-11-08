# Security & Privacy Policy (Privacy by Design)

## 1. Data classification

**Public** (safe in API responses, logs, push payloads): username, display name, avatar URL,
coarse `area_label`, rating aggregate, verification badges, active public posts, listing distance
(rounded) and public meetup label.

**Private** (never exposed to other users, never logged or pushed):
full name, phone number (E.164), email, private POINT coordinates, exact meetup coordinates before
agreement, verification media, provider references, report details, security events, device
tokens, admin audit metadata.

Access to private fields requires a dedicated repository method, a service-level purpose check,
and an audit log entry for human access (admin support/verification roles).

## 2. Authentication & authorization

- Firebase Authentication is the sole identity source. Google Sign-In and phone OTP.
- Firebase Admin SDK verifies ID tokens on every private API request and on Socket.IO handshake.
- The backend never trusts a UID, role, phone number, or verification status supplied by a client.
- Admin authorization is enforced in Fastify: active `admin_users` row + role permission matrix.
  Angular route guards/menu hiding are UX only.
- Every object mutation checks ownership (`listing.user_id === auth.user.id`, conversation
  membership, offer participant). Admin overrides are explicit, role-gated, and audited.
- WebSocket rooms are joined only after verifying the user is the buyer or seller of that
  conversation. Clients cannot subscribe to arbitrary rooms.
- Account status `suspended` blocks write endpoints; `deactivated` blocks authentication
  (token rejection at profile load).
- Token revocation checks are used for sensitive actions (role change, account deletion, admin
  session establishment) via Firebase `verifyIdToken(token, true)`.

## 3. Transport & headers

- HTTPS only in staging/production; HSTS at Nginx and via Helmet.
- Helmet: CSP (admin), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`.
- CORS: explicit allow-list from `CORS_ORIGINS`; no wildcard with credentials; Socket.IO uses the
  same allow-list. Mobile clients send no Origin and are allowed by absence of browser CORS.
- Rate limits per IP + per authenticated user:
  - global 120 req/min
  - auth-exchange 20/min
  - OTP request 3/10 min per phone (Firebase-enforced too)
  - listing create 10/hour
  - chat message 60/min per user
  - report 5/hour
  - upload 30/hour
- Request body limits: JSON 1 MB, multipart 8 MB per file, max 8 files per listing.

## 4. Input & query safety

- TypeBox schemas validate body/query/params; unknown fields rejected on sensitive routes.
- Sequelize parameter binding only. Raw spatial SQL uses replacements, never template
  interpolation of user input.
- `limit` capped (≤50), page offset bounded; sort fields whitelisted.
- Rich text is stored as plain text; clients render as text. URLs validated (http/https only).
- Phone numbers validated as Indonesian E.164 (`+62…`) server-side.

## 5. Upload safety

- Allow-list: `image/jpeg`, `image/png`, `image/webp` (magic-byte sniffing with `file-type`).
- Reject SVG, GIF (animation abuse), executables, archives, polyglots.
- Size cap 8 MB; dimensions capped (reject > 8000 px); Sharp re-encodes (never passes through
  original bytes); EXIF/GPS stripped by re-encode.
- Random object keys (`uuid`), server-controlled prefixes; no user-supplied filenames or paths.
- Private bucket/prefix for verification media; signed GET URLs with ≤10 min TTL.
- Listing images are public-read but unguessable; deletion removes objects via StorageService.

## 6. Audit logging

Append-only `admin_audit_logs` for: login as admin, role changes, account suspension/activation,
verification decisions, moderation hide/remove, report resolution, app-setting changes, bulk
exports, and access to sensitive data. Each entry: actor, action, target type/id, metadata
(non-secret), IP, timestamp. Audit logs are readable by `super_admin` only; never editable via API.

## 7. Privacy controls

- Phone number masked everywhere in admin UI (`+62 812•••••789`), full value available only to a
  dedicated `verification_manager`/`super_admin` endpoint with audit logging.
- Users can block others; blocked pairs cannot start conversations, send offers, or see each
  other's active listings.
- Account deletion: request → 30-day grace (login restores) → anonymise profile, delete tokens and
  private location, archive listings, purge chat after retention. Documented in-app and in the
  Privacy Policy.
- Data export: self-service JSON of profile, listings, offers, agreements, reviews (Phase 7).
- No ad tracking, no third-party analytics SDK by default. Crash reporting must be configured to
  exclude personal data.

## 8. Secrets

- Backend secrets only in environment variables (`.env` untracked) or the process manager's
  encrypted environment.
- Firebase service account private key never enters Flutter or Angular; Flutter ships only
  `google-services.json`/`GoogleService-Info.plist` public client configuration.
- S3 credentials stay server-side; clients receive presigned URLs only.
- `.env` is gitignored; `.env.example` contains names only.

## 9. Compliance (UU PDP Indonesia)

- Lawful basis: consent for location and biometric verification, contract for marketplace use.
- Explicit consent screens before location access and face verification, with purpose and
  retention explained.
- Data minimisation: no raw biometric storage, no exact home coordinates in responses.
- Breach notification runbook: detect → contain → assess → notify affected users and authorities
  within the statutory window (3×24 hours where applicable).
- Processor agreements with Firebase, object storage, and verification providers required.

## 10. Security testing gates

- Unauthenticated request → 401 on all private routes.
- Foreign user cannot read/update another's listing, chat, offers, agreements, reviews.
- Client cannot escalate role or set `phone_verified`.
- Admin endpoints 403 for non-admin and for roles lacking the permission.
- WebSocket join to a foreign conversation is rejected and logged.
- Search with radius/limit tampering still returns ≤4 km results.
- Upload of `.exe`, SVG, oversized, and EXIF-laden files behaves as specified.
- No `sync()`/`alter` in the codebase (static test).
- Rate limits enforced (integration test with lowered limits).
