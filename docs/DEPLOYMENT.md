# Deployment (Native, No Docker)

Docker, Docker Compose, Dockerfiles, container orchestration and Docker-based database setups are
**not used and must not be added**. Development and production use native installations.

## 1. Prerequisites

| Tool | Version used in this repo |
| --- | --- |
| Node.js | 24.x LTS (≥20 supported) |
| npm | 11.x |
| MySQL | 8.0+ (verified 9.4) |
| Flutter | 3.41.x stable (Dart 3.11) |
| Angular CLI | 21.x |
| Xcode / Android SDK | for mobile builds |

## 2. Local setup — macOS (Homebrew)

```bash
brew install node mysql
brew services start mysql
mysql -u root -e "CREATE DATABASE hyperlocal_marketplace CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -e "CREATE DATABASE hyperlocal_marketplace_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

cd backend
cp .env.example .env          # fill MySQL/Firebase/storage values
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000

cd ../admin_dashboard
npm install
npm start                     # http://localhost:4200

cd ../mobile_app
flutter pub get
flutter run
```

## 3. Local setup — Linux server

```bash
sudo apt update && sudo apt install -y mysql-server nginx curl
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo mysql_secure_installation
```

Create a restricted database user:

```sql
CREATE USER 'c2c_app'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON hyperlocal_marketplace.* TO 'c2c_app'@'localhost';
GRANT CREATE, ALTER, INDEX, DROP, REFERENCES ON hyperlocal_marketplace.* TO 'c2c_migrator'@'localhost';
```

Use separate credentials for runtime (`c2c_app`, no DDL) and migrations (`c2c_migrator`).

## 4. Backend production

```bash
cd backend
npm ci
npm run build
NODE_ENV=production npm run db:migrate     # separate, explicit step
pm2 start dist/server.js --name c2c-api -i 2 --env production
pm2 save
```

- `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`.
- Secrets in `/etc/c2c/api.env` (0600) passed via PM2 `env_file` or `--env`.
- `/readyz` verified before traffic is enabled; PM2 reload is graceful.
- Swagger UI disabled or protected in production.

## 5. Nginx reverse proxy

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.id;

  ssl_certificate     /etc/letsencrypt/live/api.example.id/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.id/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 75s;
  }
}
```

## 6. Admin dashboard

```bash
cd admin_dashboard
npm ci
npm run build          # dist/admin_dashboard/browser
```

Serve the static build via Nginx with SPA fallback (`try_files $uri /index.html;`) and a CSP that
allows Firebase Auth, API and Socket.IO origins.

## 7. Flutter release (Google Play)

```bash
cd mobile_app
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.example.id/api/v1 \
  --dart-define=SOCKET_URL=https://api.example.id
```

- `android/key.properties` and keystore are **not** committed.
- Configure `google-services.json` (public client config only) and FCM.
- Play Console: data safety form (location, phone, photos), privacy policy URL, content rating.
- Versioning via `pubspec.yaml` `version: x.y.z+build`; increment build for every upload.

## 8. Environments

| | Development | Staging | Production |
| --- | --- | --- | --- |
| MySQL | local | dedicated host | managed/large host, backups |
| Firebase | dev project | staging project | production project |
| Storage | local adapter | S3 staging bucket | S3 production bucket |
| Swagger | enabled | enabled (auth-gated) | disabled |
| Log level | debug | info | info/warn |
| CORS | localhost origins | staging origins | production origins only |
| Migration run | manual | manual | manual deployment gate |

## 9. Operational runbook

- **Deploy**: backup → `npm ci` → build → `db:migrate` → reload → check `/readyz` → smoke test.
- **Rollback**: redeploy previous artifact; if schema changed destructively, restore the verified
  backup (expand-and-contract avoids this).
- **Backup**: nightly logical dump + binlogs; monthly restore drill.
- **Monitoring**: `/healthz`, `/readyz`, pino logs shipped to a log store, error-rate alerting.
- **Incident**: rotate secrets, revoke Firebase sessions, disable affected admin accounts, review
  `admin_audit_logs`.

## 10. Health checks

| Endpoint | Checks | Used by |
| --- | --- | --- |
| `GET /healthz` | process alive | load balancer liveness |
| `GET /readyz` | DB connection + migrations applied + storage config | deploy gate / LB readiness |
