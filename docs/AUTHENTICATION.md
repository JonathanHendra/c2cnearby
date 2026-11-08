# Authentication & Onboarding

## Identity provider

Firebase Authentication is the only identity system: Google Sign-In and Firebase Phone
Authentication. Passwordless; no password is ever stored or handled by this platform.

## Mobile flow (Google)

1. Flutter runs `GoogleSignIn` and obtains a Firebase credential.
2. Firebase client signs in and returns an ID token + refresh token.
3. Flutter sends `Authorization: Bearer <idToken>` to `POST /api/v1/auth/session`.
4. Fastify verifies the token with Firebase Admin SDK (`verifyIdToken`, clock tolerance on).
5. Backend derives `firebase_uid` and email from the verified token only.
6. If no local user exists, backend creates a row (`profile_completed = 0`, `account_status =
   active`, generated unique username placeholder) inside a transaction.
7. Response contains the user profile and onboarding state.
8. Flutter stores only the refresh session via Firebase SDK and caches profile data locally;
   tokens are never written to plain shared preferences (use secure storage for any cached
   sensitive value).

The ID token is refreshed by the Firebase SDK before each API call; the UI never sends a UID or
role.

## Onboarding state machine

```
incomplete → profile_completed → phone_verified → face_verification_pending → verified
                                                                    ↘ rejected
```

- `incomplete`: missing display name/username/area.
- `profile_completed`: public profile usable.
- `phone_verified`: Firebase phone credential verified and mirrored to `users.phone_verified`.
- `face_verification_pending` / `verified` / `rejected`: derived from
  `users.face_verification_status` and latest `user_verifications` row.

Browsing is allowed at every stage. Selling requires `profile_completed`; chat and offers require
`phone_verified`; face verification is required for high-value categories (configuration-driven,
not hard-coded in clients).

## Phone verification

1. Flutter uses Firebase Phone Auth (`verifyPhoneNumber`) with an Indonesian number normalised to
   `+62…`.
2. Firebase handles SMS/OTP, resend cooldown and attempt limits; the app additionally enforces a
   60-second resend cooldown and a 5-attempt limit per session for UX.
3. On success, Flutter receives a Firebase ID token (and phone credential) and calls
   `POST /me/phone/verify`.
4. Backend verifies the token contains the phone number, writes `phone_private` and
   `phone_verified = 1`, and records `user_verifications (phone, firebase, verified)`.

Privacy: the number is never returned to other users, never included in listing payloads, never
logged, and never sent in push notifications. Admin list views receive only a masked value
(`+62 812•••••789`); full value access is a separate audited permission.

## Face verification adapter

```ts
interface FaceVerificationProvider {
  createSession(input: { userId: string; consent: boolean }): Promise<FaceSession>;
  getSessionStatus(sessionId: string): Promise<FaceSessionStatus>;
  processCallback(payload: unknown, signature?: string): Promise<FaceSessionStatus>;
  cancelSession(sessionId: string): Promise<void>;
}
```

- Development uses `MockFaceVerificationProvider`: returns `pending` and never `verified`; the UI
  displays "Simulasi pengembangan — bukan verifikasi resmi".
- A production adapter must be selected contractually (e.g. a licensed e-KYC provider). The
  platform never implements its own face recognition.
- Explicit consent is recorded before session creation; raw selfies are never persisted by this
  platform; only provider references and status are stored.
- Callback endpoints verify provider signature/state; replay is rejected.

## Admin authentication

- Angular signs in with Google via Firebase Authentication.
- Backend `POST /admin/auth/session` (or shared `/auth/session`) verifies the token and requires an
  active `admin_users` record. Custom claims are issued **only** by a trusted backend process, and
  the database role remains authoritative.
- Every admin request reloads the admin record (short cache allowed with invalidation) so a
  revoked admin loses access immediately.
- Sessions expire with the Firebase token; admin UI signs out on 401/403 and does not cache
  sensitive lists in browser storage.

## Logout and account deletion

- Logout: Firebase sign-out, clear local caches, deregister FCM token.
- Account deletion request: 30-day grace; login during grace cancels deletion. After grace,
  profile is anonymised, private location and device tokens deleted, listings archived, chat
  purged per retention policy, and an audit record retained.

## Implementation status (FASE 3)

Implemented in `backend/src/auth`, `backend/src/routes/{auth,me,admin-auth}.ts`, the Flutter
`lib/core/auth` module and the Angular `core/auth` module. Details and test results are in
`docs/PHASE-3-REPORT.md`.

- `AUTH_DRIVER=dev` (default outside production) accepts `Bearer dev:<uid>` so the API and
  mobile flows can be exercised without a service account. It is refused when
  `NODE_ENV=production`, and `AUTH_DRIVER=firebase` refuses to boot without the three
  service-account variables.
- Flutter never persists tokens itself: the Firebase SDK owns the session and every request
  asks for a fresh ID token; a single forced refresh is attempted on `401`.
- Onboarding endpoints enforce the documented order (profile → phone → face) and return
  `403 ONBOARDING_REQUIRED` with `details.required_step`.
- Face verification ships with the mock adapter only; it reports `development: true` and
  cannot produce `verified`.
- Admin permissions come from the role matrix in `src/auth/permissions.ts` and are
  re-derived from `admin_users` on every request.

## Error handling

| Case | Response |
| --- | --- |
| Missing/invalid token | 401 `UNAUTHENTICATED` |
| Expired token | 401 `TOKEN_EXPIRED` (client refreshes and retries once) |
| Suspended account | 403 `ACCOUNT_SUSPENDED` |
| Onboarding required for action | 403 `ONBOARDING_REQUIRED` with required step |
| Admin without role | 403 `FORBIDDEN` |
