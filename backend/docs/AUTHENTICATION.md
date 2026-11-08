# Autentikasi & Otorisasi Admin

## Ringkasan

Sistem identitas dibagi menjadi dua mode:

- **Development / staging (default):** `AUTH_DRIVER=dev` (default diluar production).
  - Login admin: `POST /admin/auth/login` dengan `email` + `password`.
  - Token yang dikembalikan adalah token pengembangan (`dev:<uid>`) yang diterima
    langsung dari server, **bukan** token Firebase. Klien tidak perlu SDK Firebase Auth.
  - Firebase Admin SDK **tidak** digunakan di dev. `AUTH_DRIVER=dev` ditolak saat
    `NODE_ENV=production`.
- **Production:** `AUTH_DRIVER=firebase` (wajib). Hanya Firebase ID token yang diformat
  `dev:` yang dapat diterima; API mengecek baris `admin_users` aktif.

## Login admin (email + password)

### POST `/api/v1/admin/auth/login`

| Method | Path |
|---|---|
| `POST` | `/api/v1/admin/auth/login` |

Body JSON:
```json
{
  "email": "h3ndr45imbolon@gmail.com",
  "password": "31SosMed!#"
}
```

Respons 200:
```json
{
  "data": {
    "admin": {
      "id": "00000000-0000-4000-8000-000000000001",
      "email": "h3ndr45imbolon@gmail.com",
      "role": "super_admin",
      "is_active": true,
      "last_login_at": "2026-11-07T04:00:00.000Z"
    },
    "permissions": [
      "dashboard:read", "users:read", "users:status",
      "verifications:read", "verifications:review",
      "listings:read", "listings:moderate",
      "categories:read", "categories:write",
      "reports:read", "reports:resolve",
      "agreements:read", "reviews:read", "reviews:moderate",
      "settings:read", "settings:write", "admins:manage", "audit:read"
    ]
  }
}
```

Respons 401: `Email atau kata sandi salah.`  
Respons 403: `Akun ini belum terdaftar sebagai admin aktif.` atau `Akun ini tidak memiliki akses admin.`

### Perilaku token

- Setelah login berhasil, server menyimpan `last_login_at` dan mengembalikan admin
  yang sama. Token yang diterima klien adalah token dev (`dev:<uid>`) yang mengandung
  UID admin; tidak ada klien yang menyimpan password atau menghasilkan token sendiri.
- Endpoint `POST /api/v1/admin/auth/session` tetap memvalidasi token dev (jika
  `AUTH_DRIVER=dev`) atau token Firebase (jika `AUTH_DRIVER=firebase`).
- `GET /api/v1/admin/auth/me` memerlukan header
  `Authorization: Bearer <token>` dan memeriksa baris `admin_users` aktif sesuai
  `firebase_uid` atau `email` yang cocok.

## Seed admin default (dev only)

Seeder menulis baris admin idempoten saat `npm run db:seed`:

```sql
INSERT INTO admin_users (id, firebase_uid, email, password_hash, role, is_active, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', '', 'h3ndr45imbolon@gmail.com', '<hash scrypt>', 'super_admin', 1, NOW(3), NOW(3));
```

- `email` unik di `admin_users`.
- `password_hash` di-hash dengan scrypt (`node:crypto.scryptSync`) menggunakan salt
  `c2c-nearby-admin-salt`.
- Bisa diinisialisasi otomatis dari `.env`:

  ```
  ADMIN_EMAIL=h3ndr45imbolon@gmail.com
  ADMIN_PASSWORD=31SosMed!#
  ADMIN_PASSWORD_HASH=<opsional: hash pre-computed>
  ADMIN_SIGN_IN_TEST=0
  ```

  Jika hanya `ADMIN_PASSWORD` yang diisi, seeder menghitung hash dari password itu.
  Jika `ADMIN_PASSWORD_HASH` diisi, hash tersebut yang disimpan.

## Peran & izin

Matriks peran (disimpan di `admin_users.role` dan dicek di setiap permintaan):

| Peran | Izin | Deskripsi |
|---|---|---|
| `super_admin` | Semua | Mendapatkan seluruh `ADMIN_PERMISSIONS`. |
| `admin` | 16 izin | Dasbor, pengguna, moderasi, laporan, kategori, setelan. |
| `moderator` | 8 izin | Moderasi laporan/ulasan/daftar, baca admin. |
| `verification_manager` | 5 izin | Verifikasi, perintah status pengguna. |
| `support` | 5 izin | Dasbor, baca pengguna/tersedia, kesepakatan, verifikasi. |

## Login melalui Google (tidak lagi digunakan untuk flow admin baru)

- Form login admin sekarang menggunakan `email` + `password`.
- Google Sign-In tetap tersedia sebagai **opsional**; jika ingin menggunakan
  `POST /admin/auth/session` dengan token Firebase, baris admin harus ada dengan
  `firebase_uid` yang divalidasi melalui Firebase ID token.
- `firebase.config.ts` di `admin_dashboard` (Google popup) dapat dihapus atau
  dinonaktifkan tanpa memengaruhi login email/password.

## Keamanan

- Password tidak pernah dikirimkan ke Firebase; selalu diverifikasi di server.
- `password_hash` disimpan di MySQL sebagai `VARCHAR(128)` (scrypt hex). Admin dapat
  melanjutkan ke `admins:manage` hanya jika barisnya aktif.
- `ADMIN_SIGN_IN_TEST` digunakan untuk mode development yang menjalankan
  `POST /admin/auth/login` tanpa `ADMIN_PASSWORD_HASH`, hanya `ADMIN_EMAIL` +
  `ADMIN_PASSWORD`.
- Rate limit: `10 requests / 1 minute` untuk login admin.
- Audit log muncul di `admin_audit_logs` untuk setiap aktivitas admin.
