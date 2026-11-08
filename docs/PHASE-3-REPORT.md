# Laporan FASE 3 — Authentication & Onboarding

Status: **selesai untuk scope backend, Flutter, dan Angular**; verifikasi Firebase
end-to-end belum dapat dijalankan karena kredensial Firebase belum tersedia di mesin ini.

## 1. Backend (Fastify + Sequelize + MySQL)

### Yang dibuat

| Berkas | Isi |
| --- | --- |
| `src/auth/types.ts` | `VerifiedIdentity`, `TokenVerifier`, `InvalidTokenError` |
| `src/auth/firebase-verifier.ts` | Firebase Admin `verifyIdToken(token, true)` (cek revocation), klaim → identitas |
| `src/auth/dev-verifier.ts` | Driver pengembangan `dev:<uid>` / `dev:<uid>:<628xx>`; menolak produksi |
| `src/auth/index.ts` | `createTokenVerifier`, guard `authenticate` / `requireAdmin` / `authorize(permission)` |
| `src/auth/onboarding.ts` | State machine onboarding + capability + `maskPhone` |
| `src/auth/permissions.ts` | Matriks peran → izin (super_admin, admin, moderator, verification_manager, support) |
| `src/services/user-service.ts` | Provisioning, profil, username, telepon, lokasi POINT, penghapusan akun, DTO |
| `src/services/username.ts` | Aturan username, reserved words, placeholder unik |
| `src/services/face-verification.ts` | `FaceVerificationProvider` + `MockFaceVerificationProvider` (HMAC, anti-replay) |
| `src/storage/avatar-storage.ts` | Sharp → WebP 512 px, validasi dimensi/magic byte |
| `src/routes/auth.ts` | `POST /auth/session` |
| `src/routes/me.ts` | `/me`, `/me/username`, `/me/avatar`, `/me/phone/verify`, `/me/location`, sesi verifikasi wajah, `DELETE /me` |
| `src/routes/admin-auth.ts` | `POST /admin/auth/session`, `GET /admin/auth/me` |
| `src/database/migrations/20261105011200-add-user-account-lifecycle.ts` | `username_chosen_at`, `deletion_requested_at` |
| `src/common/schemas.ts` | Skema envelope error untuk Swagger |

### Perilaku penting

- Token hanya dari `Authorization: Bearer <Firebase ID token>`; UID/role tidak pernah
  dibaca dari body.
- `POST /auth/session` memprovisi profil dalam satu transaksi logis, idempoten terhadap
  `firebase_uid`, memberi username placeholder `pengguna_<8 hex>`, dan mengembalikan
  `user` + `onboarding` + `session`.
- Login pada masa tenggang 30 hari membatalkan permintaan penghapusan.
- Status akun diperiksa pada setiap request: `suspended`/`deactivated` → 403.
- Onboarding berurutan: profil (username + nama + area) → telepon → wajah. Endpoint
  telepon menolak sebelum profil lengkap, endpoint wajah menolak sebelum telepon
  terverifikasi (`403 ONBOARDING_REQUIRED` + `required_step`).
- Nomor telepon hanya dikembalikan ke pemilik; admin melihat bentuk tersamar
  (`+628•••••789`).
- Lokasi disimpan sebagai `POINT SRID 4326` (urutan sumbu latitude–longitude khas MySQL)
  dan hanya dibaca pemilik.
- Avatar: multipart `file`, Sharp `cover` → WebP 512 px, disajikan dari `/uploads`.
- Callback wajah diautentikasi HMAC-SHA256 (`x-face-signature` atas `<session>:<status>`),
  sekali pakai (`409 FACE_CALLBACK_REPLAY`). Mock tidak pernah menghasilkan `verified`.
- `AUTH_DRIVER=dev` ditolak bila `NODE_ENV=production`; `AUTH_DRIVER=firebase` mewajibkan
  tiga variabel service account (gagal saat boot dengan pesan yang jelas).

### Endpoint

| Method | Path | Guard |
| --- | --- | --- |
| POST | `/api/v1/auth/session` | token Firebase |
| GET | `/api/v1/me` | user aktif |
| PATCH | `/api/v1/me` | user aktif |
| PATCH | `/api/v1/me/username` | user aktif, rate limit 10/menit |
| POST | `/api/v1/me/avatar` | user aktif, multipart |
| POST | `/api/v1/me/phone/verify` | user aktif + profil lengkap |
| GET/PUT | `/api/v1/me/location` | user aktif |
| POST | `/api/v1/me/verification/face/session` | user aktif + telepon terverifikasi |
| GET | `/api/v1/me/verification/face/session/:id` | pemilik sesi |
| POST | `/api/v1/me/verification/face/callback` | signature provider |
| DELETE | `/api/v1/me` | user aktif (masa tenggang) |
| POST | `/api/v1/admin/auth/session` | token + baris admin aktif |
| GET | `/api/v1/admin/auth/me` | admin aktif |

## 2. Flutter

| Berkas | Isi |
| --- | --- |
| `lib/core/config/app_config.dart` | `API_BASE_URL`, `GOOGLE_SERVER_CLIENT_ID` via `--dart-define` |
| `lib/data/models/auth_models.dart` | `AuthUser`, `Onboarding`, `ProfileSnapshot`, `FaceSessionInfo` |
| `lib/core/auth/auth_api.dart` | Klien Dio untuk seluruh endpoint FASE 3, retry sekali setelah refresh token |
| `lib/core/auth/auth_controller.dart` | Riverpod state: Google Sign-In, Phone Auth (login & link), onboarding, avatar, hapus akun |
| `lib/features/auth/login_page.dart` | UI Google + OTP |
| `lib/features/auth/onboarding_page.dart` | Profil, telepon, wajah (dengan label simulasi) |
| `lib/app/providers.dart` | `authProvider`, `currentUserProvider` (profil nyata / fallback demo) |
| `lib/app/router.dart` | Route `/masuk`, `/onboarding` |
| `lib/features/profile/*` | Header profil, pengaturan akun, edit profil memakai sesi nyata |

- Token tidak pernah ditulis ke `shared_preferences`; Firebase SDK yang menyimpan sesi,
  setiap request meminta `getIdToken()` (refresh paksa sekali pada 401).
- `Firebase.initializeApp()` dibungkus try/catch agar aplikasi tetap bisa menjelajah
  tanpa konfigurasi native.
- Mode jelajah tetap tersedia tanpa akun; hanya profil/onboarding yang butuh sesi.
- Tombol Google menampilkan pesan bila `GOOGLE_SERVER_CLIENT_ID` belum diisi.

## 3. Angular (admin)

| Berkas | Isi |
| --- | --- |
| `src/environments/environment.ts` / `.production.ts` | `apiBaseUrl`, konfigurasi Firebase web (publik) |
| `src/app/core/auth/firebase.config.ts` | Inisialisasi Firebase aman + flag `firebaseConfigured` |
| `src/app/core/auth/admin-auth.service.ts` | Google popup → `POST /admin/auth/session`, signal sesi + izin, `token()`, `signOut()` |
| `src/app/core/auth/auth.interceptor.ts` | Menempelkan Bearer hanya ke origin API |
| `src/app/core/auth/admin-auth.guard.ts` | Guard seluruh layout admin → `/masuk` |
| `src/app/features/login/admin-login.component.ts` | Halaman masuk admin |
| `src/app/app.config.ts`, `app.routes.ts`, `angular.json` | HttpClient + interceptor, route login, guard, `fileReplacements` produksi |

Peran & izin dibaca ulang dari server pada setiap muat; UI memakai `auth.can(permission)`.

## 4. Hasil pengujian

| Perintah | Hasil |
| --- | --- |
| `npm run typecheck` (backend) | bersih |
| `npm run build` (backend) | sukses |
| `npm test` (backend, MySQL 9.4 port 3307) | **54/54 lulus** (10 berkas) |
| `npm run db:migrate` | 12 migrasi diterapkan (1 baru) |
| Smoke API dev (`Bearer dev:smoke_user`) | `POST /auth/session` 201, `GET /me` 200, `/readyz` 200 |
| `flutter analyze` | No issues found |
| `flutter test` | 1/1 lulus |
| `flutter build apk --debug` | sukses |
| `flutter build apk --release` | sukses (APK 60,6 MB, tersigned) |
| `ng build` | sukses |
| `ng test --watch=false` | 2/2 lulus |

Tes backend baru: `test/auth/session.test.ts` (6), `onboarding.test.ts` (9),
`avatar-face.test.ts` (5), `admin.test.ts` (4), `config.test.ts` (4).

## 5. Konfigurasi manual yang masih diperlukan

1. **Service account Firebase** → isi `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` dan set `AUTH_DRIVER=firebase` agar backend memverifikasi token
   Firebase sungguhan. Tanpa ini backend berjalan dengan `AUTH_DRIVER=dev`.
2. **SHA-1 / SHA-256 di Firebase Console** untuk package `com.c2cnearby.c2c_nearby`:
   - Debug: `F3:C9:FF:FE:B2:71:F5:E9:85:3E:73:6D:D0:53:EB:94:5B:11:20:37`
     (SHA-256 `2E:39:DC:07:92:8D:21:F7:E7:DE:EB:66:12:21:53:B4:FC:06:78:11:09:0E:A9:66:5A:BE:C4:A9:FA:92:92:05`)
   - Release (keystore lokal `android/keystore/release.jks`, alias `c2c-nearby`):
     `18:9C:21:4F:A0:F4:7E:69:E9:1D:BC:96:1B:5F:BB:61:9E:D3:F4:7B`
     (SHA-256 `67:82:77:70:07:3A:4E:C3:B3:B4:0B:EC:79:FB:C5:6D:72:71:A9:F4:B0:82:17:1D:7C:0C:DB:E5:CC:17:DF:B6`)
   - `google-services.json` saat ini memuat SHA-1 lain (`fe961c55ce152c7e512c45…`), jadi
     Google Sign-In **belum akan berhasil** sampai fingerprint di atas ditambahkan dan
     file JSON diunduh ulang.
3. **Web client ID OAuth** → `flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=<id>.apps.googleusercontent.com`
   dan isi `firebase.apiKey` / `appId` di `admin_dashboard/src/environments/environment.ts`.
4. **Daftarkan admin** → baris aktif di `admin_users` (firebase_uid akun Google) dan
   `FACE_CALLBACK_SECRET` untuk callback wajah.
5. **Keystore release**: cadangkan `android/keystore/release.jks` + `android/key.properties`
   (keduanya masuk `.gitignore`). Kehilangan keystore menghalangi pembaruan Play Store.

## 6. Belum dikerjakan pada fase ini (sesuai rencana)

- Verifikasi Firebase sungguhan (butuh kredensial pada poin 5.1–5.3).
- Penyedia e-KYC produksi: hanya antarmuka + mock; status tidak akan menjadi `verified`.
- FCM/device token, preferensi notifikasi (Fase 7).
- Penghapusan data otomatis setelah 30 hari (job Fase 7); saat ini hanya status.
- Sinkronisasi data posting/chat/ulasan di UI masih mock (Fase 4–5).
