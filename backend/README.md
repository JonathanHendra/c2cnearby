# C2C Nearby — Backend API

Fastify 5 + TypeScript (ESM) + Sequelize v6 + MySQL 8/9 modular monolith.
FASE 2 mencakup fondasi runtime, koneksi database, 21 tabel lewat migrasi, asosiasi manual,
seeder idempotent, serta probe `/healthz` dan `/readyz`.

## Prasyarat

- Node.js >= 22 dan npm
- MySQL 8.0+ (di mesin ini: Homebrew MySQL 9.4 pada port **3307**, agar tidak bentrok dengan
  MySQL MAMP di 3306)

Menjalankan MySQL lokal (terminal terpisah; belum memakai `brew services`):

```bash
/opt/homebrew/opt/mysql/bin/mysqld \
  --datadir=/opt/homebrew/var/mysql \
  --port=3307 \
  --socket=/tmp/c2c-nearby-mysql.sock \
  --mysqlx=OFF \
  --pid-file=/tmp/c2c-nearby-mysql.pid
```

Membuat database dan user aplikasi (sekali saja, sebagai root):

```sql
CREATE DATABASE c2c_nearby_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE c2c_nearby_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'c2c'@'127.0.0.1' IDENTIFIED BY '<password-lokal>';
CREATE USER 'c2c'@'localhost' IDENTIFIED BY '<password-lokal>';
GRANT ALL PRIVILEGES ON c2c_nearby_dev.* TO 'c2c'@'127.0.0.1', 'c2c'@'localhost';
GRANT ALL PRIVILEGES ON c2c_nearby_test.* TO 'c2c'@'127.0.0.1', 'c2c'@'localhost';
FLUSH PRIVILEGES;
```

## Setup

```bash
cd backend
cp .env.example .env          # lalu isi DB_PASSWORD
npm install
npm run db:migrate            # 11 migrasi -> 21 tabel
npm run db:seed               # 16 kategori + 7 app settings (idempotent)
npm run dev                   # http://127.0.0.1:4000
```

`PORT`, `HOST`, dan variabel `DB_*` dari environment shell **menang** atas `.env` (perilaku
standar dotenv). Jika shell mengekspor `PORT=0`, jalankan `PORT=4000 npm run dev`.

## Scripts

| Script | Kegunaan |
| --- | --- |
| `npm run dev` | `tsx watch` server dengan pretty log |
| `npm run build` | kompilasi `src/` ke `dist/` (`tsconfig.build.json`) |
| `npm start` | menjalankan `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` termasuk test |
| `npm test` | Vitest, butuh MySQL 3307 hidup dan DB `c2c_nearby_test` |
| `npm run db:migrate` | terapkan migrasi pending |
| `npm run db:migrate:status` | daftar migrasi terpasang/pending (exit 1 bila pending) |
| `npm run db:migrate:undo` | batalkan migrasi terakhir |
| `npm run db:migrate:undo:all` | batalkan semua (ditolak saat `NODE_ENV=production`) |
| `npm run db:seed` / `db:seed:undo` | seed idempotent / hapus data seed |

Menargetkan database lain tanpa mengubah `.env`:

```bash
DB_NAME=c2c_nearby_test npm run db:migrate
```

## Struktur

```
src/
  app.ts                     factory Fastify (logger, error handler, plugins, routes)
  server.ts                  bootstrap + migration warning + graceful shutdown
  config/                    env tervalidasi (zod) dan konstanta radius 4.000 m
  common/                    AppError dan envelope { data, meta } / { error }
  plugins/                   error-handler, security (helmet/CORS/rate-limit), multipart, swagger
  routes/system.ts           /healthz, /readyz (+ mirror /api/v1)
  database/
    connection.ts            Sequelize + utf8mb4_0900_ai_ci + UTC + pool
    models/                  21 model dikelompokkan per domain
    associations.ts          seluruh alias, constraints:false, idempotent
    migrations/              11 migrasi raw SQL + helper tipe
    migration-runner.ts      umzug + SequelizeMeta + gate readiness
    seeders/                 kategori & app settings
    cli.ts                   entry point script db:*
test/
  app/health.test.ts         probe, envelope, header, Swagger, gate migrasi
  database/models.test.ts    registry 21 model, tipe kolom, timestamp
  database/associations.test.ts  alias lengkap, idempotensi, tanpa SQL
  database/migrations.test.ts    up/down + FK/unique/CHECK di MySQL nyata
  database/no-sync.test.ts       larangan sync()/ORM lain + lokasi asosiasi
```

## Skema dan kepemilikan DDL

- Semua DDL hanya lewat migrasi; `sequelize.sync()`, `alter`, dan `force` dilarang dan dijaga
  oleh test statis.
- `SequelizeMeta` menyimpan nama migrasi yang sudah diterapkan. `/readyz` mengembalikan
  `503 DB_MIGRATIONS_PENDING` bila ada migrasi yang belum dijalankan.
- UUID `CHAR(36)`, uang `DECIMAL(15,2)`, timestamp `DATETIME(3)` UTC, InnoDB + utf8mb4 +
  `utf8mb4_0900_ai_ci`, 36 foreign key dengan aksi eksplisit, 2 SPATIAL INDEX.
- Koordinat disimpan `POINT SRID 4326` sebagai `POINT(longitude, latitude)`; baca dengan
  `ST_Latitude()` / `ST_Longitude()`. MySQL menolak urutan latitude-first (diverifikasi di 9.4).
- MySQL menolak CHECK pada kolom yang punya FK dengan aksi CASCADE (error 3823), sehingga aturan
  "tidak boleh diri sendiri" untuk blokir, percakapan, offer, agreement, dan review ditegakkan di
  service layer. CHECK harga, rating, dan tanggal event tetap di database.

## Endpoint FASE 2

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/healthz` | liveness, tidak menyentuh database |
| GET | `/readyz` | koneksi DB + status migrasi + radius discovery |
| GET | `/api/v1/healthz`, `/api/v1/readyz` | mirror untuk klien mobile |
| GET | `/docs` | Swagger UI (hanya non-production) |

Envelope sukses: `{ "data": ..., "meta"?: ... }`. Envelope error:
`{ "error": { "code", "message", "details", "request_id" } }`. Setiap respons memuat header
`X-Request-Id` (nilai dari klien dipakai ulang bila <= 128 karakter).

## Test

```bash
npm test        # 5 file, 26 test
npm run typecheck
npm run build
```

Test database memakai `c2c_nearby_test`, menghapus seluruh tabelnya lalu menjalankan migrasi
naik/turun; jangan arahkan `TEST_DB_NAME` ke database yang berisi data penting. Hasil verifikasi
terakhir: 26/26 lulus, termasuk unique `favorites (user_id, listing_id)`, FK 1452, CHECK rating,
SRID 4326, rollback penuh, dan `/readyz` 503 saat migrasi dihapus dari `SequelizeMeta`.

## Belum dikerjakan (FASE 3+)

- Autentikasi Firebase, middleware profil, dan otorisasi per peran admin
- Endpoint bisnis `/api/v1/*` (listings, discovery radius, chat, offer, agreement, review, report)
- Upload S3 + Sharp/WebP, FCM, Socket.IO, job kedaluwarsa listing
- Rate limit terdistribusi (saat ini in-memory per proses) dan observability produksi
