# Production Deployment Plan — Presensi Online SSB v2

> Generated: 2026-03-13
> All backend (7/7), mobile (F7/F7), and web admin (W6/W6) phases are complete.

---

## Deployment Targets

| Component | Target | Method |
|-----------|--------|--------|
| Backend (FastAPI + PostgreSQL) | AWS EC2 — Docker Compose | Production-hardened compose file |
| Web Admin (React + Vite) | Same AWS EC2 — Nginx | rsync `dist/` + Nginx static serve |
| Mobile Android | Google Play Store | Expo EAS Build → AAB |
| Mobile iOS | Apple App Store | Expo EAS Build → IPA |

---

## Environment Switching Guide

This project has three components that each need environment-specific configuration. Below is the complete reference for switching between **development** and **production** for each.

---

### Backend

The backend reads all config from `backend/.env` via Pydantic Settings. There is no separate `.env.development` — the dev `.env` is what's in the repo (or omitted from git entirely); the production `.env` lives only on the server.

**Development `backend/.env`** (local Docker Compose):
```env
DATABASE_URL=postgresql+asyncpg://presensiv2:presensiv2pass@db:5432/presensiv2
SECRET_KEY=any-dev-key-at-least-32-chars-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173","http://localhost:8081","http://10.0.2.2:8000"]
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_MINUTES=30
RATE_LIMIT_LOGIN=10/minute
TIMEZONE=Asia/Jakarta
FACE_MODEL_NAME=buffalo_s
FACE_SIMILARITY_THRESHOLD=0.3
FACE_MAX_WIDTH=640
ENVIRONMENT=development
```

**Production `backend/.env`** (on EC2 server — never committed):
```env
DATABASE_URL=postgresql+asyncpg://presensiv2:STRONG_PASS@db:5432/presensiv2
SECRET_KEY=<openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["https://admin.yourdomain.com"]
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_MINUTES=30
RATE_LIMIT_LOGIN=10/minute
TIMEZONE=Asia/Jakarta
FACE_MODEL_NAME=buffalo_s
FACE_SIMILARITY_THRESHOLD=0.3
FACE_MAX_WIDTH=640
ENVIRONMENT=production
```

**Switch dev → prod:** deploy to EC2, write the production `.env` on the server, use `docker-compose.prod.yml`.

**Switch prod → dev:** stop the prod container, run `docker compose up -d` locally with dev `.env`.

Swagger UI visibility is automatic via the `ENVIRONMENT` variable (dev = `/docs` enabled, prod = disabled).

---

### Web Admin

Vite has built-in env file precedence. You do not change any code — only which `.env.*` file is present.

| File | When used |
|------|-----------|
| `web/.env` | `npm run dev` (local dev server) |
| `web/.env.production` | `npm run build` (production build) |
| `web/.env.local` | Overrides `.env` locally, never committed |

**`web/.env`** (dev — already in repo):
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=15000
VITE_APP_NAME=Presensi Online SSB v2
```

**`web/.env.production`** (create this file — not committed):
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_API_TIMEOUT=15000
VITE_APP_NAME=Presensi Online SSB v2
```

**Switch dev → prod:**
```bash
# Ensure .env.production exists with the real API URL, then:
cd web && npm run build
# Vite automatically uses .env.production — no flag needed
```

**Switch prod → dev:**
```bash
cd web && npm run dev
# Vite uses .env — points to localhost:8000
```

> ⚠️ **`web/index.html` CSP must also match.** The `connect-src` in `index.html` is baked into the static build. If you ever need to run a production build pointing at a different domain, update that line before building. See the Critical Changes section below.

---

### Mobile

Expo reads `.env` at **build time** (EAS Build) or **start time** (Expo Go / Metro). There is no automatic `.env.production` — you switch the file manually or use EAS environment variables.

**`mobile/.env`** (dev — LAN/emulator):
```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_API_TIMEOUT=10000
```
> Use `http://10.0.2.2:8000` for Android emulator, or your PC's LAN IP for a physical device.

**`mobile/.env`** (production — before running EAS build):
```env
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com
EXPO_PUBLIC_API_TIMEOUT=10000
```

**Switch dev → prod (for store build):**
```bash
# 1. Edit mobile/.env — set EXPO_PUBLIC_API_BASE_URL to production HTTPS URL
# 2. Build for store
cd mobile && eas build --platform android --profile production
# EAS captures .env at build time — the APK/AAB will use the production URL
```

**Switch prod → dev (for local testing):**
```bash
# 1. Edit mobile/.env — set EXPO_PUBLIC_API_BASE_URL back to local/LAN URL
# 2. Restart Metro with cache cleared
cd mobile && npx expo start --clear
```

**Recommended: use EAS environment variables to avoid manual edits**

Rather than editing `.env` before every build, configure environment variables in the EAS dashboard or `eas.json`:

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "http://10.0.2.2:8000",
        "EXPO_PUBLIC_API_TIMEOUT": "10000"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.yourdomain.com",
        "EXPO_PUBLIC_API_TIMEOUT": "10000"
      }
    }
  }
}
```

With this in place: `eas build --profile development` uses local URL, `eas build --profile production` uses the production URL — no `.env` edits required.

---

### Quick Reference — Environment Switch Cheatsheet

| Action | Command / File to change |
|--------|--------------------------|
| Start backend locally (dev) | `docker compose up -d` (uses dev `docker-compose.yml`) |
| Start backend in prod | `docker compose -f docker-compose.prod.yml up -d` |
| Start web admin dev server | `cd web && npm run dev` (reads `web/.env`) |
| Build web admin for prod | `cd web && npm run build` (reads `web/.env.production`) |
| Run mobile on emulator | Edit `mobile/.env` → LAN/emulator URL, then `npx expo start --clear` |
| Build mobile for Play Store | Edit `mobile/.env` → HTTPS prod URL, then `eas build --profile production` |
| Enable Swagger UI | Set `ENVIRONMENT=development` in `backend/.env`, restart backend |
| Disable Swagger UI | Set `ENVIRONMENT=production` in `backend/.env`, restart backend |
| Change API URL web admin | Edit `web/.env` (dev) or `web/.env.production` (prod build) + rebuild |
| Change API URL mobile | Edit `mobile/.env`, then `npx expo start --clear` or EAS rebuild |

---

## ⛔ CRITICAL PRE-DEPLOYMENT CHANGES (Must Fix Before Anything Else)

### 1. Fix `web/index.html` CSP — BLOCKER
The `connect-src` currently hardcodes `http://localhost:8000`. The web admin will silently fail all API calls in production because the browser's CSP will block them.

**File:** `web/index.html`
```html
<!-- CHANGE THIS: -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               connect-src 'self' https://api.yourdomain.com;
               img-src 'self' data: blob:;
               style-src 'self' 'unsafe-inline';
               script-src 'self';">
```
Replace `api.yourdomain.com` with your actual API domain.

---

### 2. Create `web/.env.production`
Vite automatically uses `.env.production` when `npm run build` is run. The current `.env` and `.env.example` both point to `http://localhost:8000`.

```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_API_TIMEOUT=15000
VITE_APP_NAME=Presensi Online SSB v2
```

---

### 3. Fix `mobile/.env`
The current file points to a LAN IP (`http://10.122.59.235:8000`) and has a malformed line (`contoh=http://10.0.2.2:8000cd m`).

```env
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com
EXPO_PUBLIC_API_TIMEOUT=10000
```

---

### 4. Generate a real SECRET_KEY
The current `backend/.env.example` has a placeholder. On the server:
```bash
openssl rand -hex 32
```
Write the output to `SECRET_KEY=` in `backend/.env` on the server. Never commit this file.

---

### 5. Set CORS_ORIGINS correctly in `backend/.env`
The value must be a valid JSON array string (Pydantic parses it with `json.loads`):
```env
CORS_ORIGINS=["https://admin.yourdomain.com"]
```
⚠️ No trailing spaces, no single quotes. If you need multiple origins:
```env
CORS_ORIGINS=["https://admin.yourdomain.com","https://staging-admin.yourdomain.com"]
```

---

## PHASE 1 — Backend on EC2 (Docker Compose)

### Pre-deployment checklist
- [ ] EC2 Ubuntu 22.04 LTS, minimum **t3.medium** (4 GB RAM — InsightFace needs it)
- [ ] AWS Security Group: allow 22, 80, 443 only. **Block 5432 and 8000** from internet.
- [ ] Domain DNS: `api.yourdomain.com` → EC2 public IP
- [ ] Docker + Docker Compose plugin installed on server
- [ ] `backend/.env` created on server (not from git) with production values
- [ ] SECRET_KEY is random 32+ chars (see above)
- [ ] CORS_ORIGINS set to production frontend domain
- [ ] DATABASE_URL uses `db` as hostname (Docker internal network)
- [ ] Swap space configured (see Memory section below)

### Create `docker-compose.prod.yml` at project root

Key differences from dev `docker-compose.yml`:
- DB port **not** exposed to host
- Backend binds to `127.0.0.1:8000` only (Nginx proxies)
- No `--reload`, no source volume mount
- `restart: always`

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: presensiv2_db
    restart: always
    environment:
      POSTGRES_USER: presensiv2
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: presensiv2
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database.sql:/docker-entrypoint-initdb.d/01_schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U presensiv2 -d presensiv2"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: presensiv2_backend
    restart: always
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

volumes:
  pgdata:
```

### Backend `.env` on server (full template)
```env
DATABASE_URL=postgresql+asyncpg://presensiv2:STRONG_DB_PASS@db:5432/presensiv2
SECRET_KEY=<output of openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["https://admin.yourdomain.com"]
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_MINUTES=30
RATE_LIMIT_LOGIN=10/minute
TIMEZONE=Asia/Jakarta
FACE_MODEL_NAME=buffalo_s
FACE_SIMILARITY_THRESHOLD=0.3
FACE_MAX_WIDTH=640
ENVIRONMENT=production
```

### Deployment steps (first time)

```bash
# 1. SSH in
ssh ubuntu@<EC2_IP>

# 2. Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu && newgrp docker

# 3. Deploy code
git clone <repo-url> /opt/presensiv2
cd /opt/presensiv2

# 4. Create backend/.env with production values (use nano or heredoc)
nano backend/.env

# 5. Build and start
docker compose -f docker-compose.prod.yml up -d --build

# 6. Watch logs — InsightFace downloads ~120 MB on first start (~60s)
docker logs presensiv2_backend -f
# Wait until you see: "Application startup complete"

# 7. Seed DB (first time only)
docker exec presensiv2_backend python seed.py

# 8. Verify health (internal)
curl http://localhost:8000/health
```

### Re-deployment steps (code updates)

```bash
cd /opt/presensiv2

# ALWAYS backup DB before any deploy
sudo mkdir -p /opt/backups
docker exec presensiv2_db pg_dump -U presensiv2 presensiv2 \
  > /opt/backups/presensiv2_$(date +%Y%m%d_%H%M%S).sql

# Tag current image for rollback
docker tag presensiv2-backend:latest presensiv2-backend:previous

# Pull latest code
git pull

# Rebuild and restart backend only (DB data is preserved in volume)
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

### Nginx config for API — `/etc/nginx/sites-available/api.yourdomain.com`

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

---

## PHASE 2 — Web Admin on EC2 (Nginx Static)

### Pre-deployment checklist
- [ ] `web/index.html` CSP updated (see Critical section above)
- [ ] `web/.env.production` created with production API URL
- [ ] `npm run build` runs clean with 0 TypeScript errors
- [ ] Domain `admin.yourdomain.com` DNS → EC2 IP
- [ ] Nginx installed on EC2
- [ ] Certbot installed

### Build (run locally or on CI)

```bash
cd web
npm ci
npx tsc --noEmit          # Must be 0 errors
npm run build             # Vite picks up .env.production automatically
# Output: web/dist/
```

### Transfer to server

```bash
# Archive existing deploy (rollback insurance)
ssh ubuntu@<EC2_IP> \
  "[ -d /var/www/presensiv2-admin ] && cp -r /var/www/presensiv2-admin /var/www/presensiv2-admin.bak"

# Push new build
rsync -avz --delete web/dist/ ubuntu@<EC2_IP>:/var/www/presensiv2-admin/
```

### Rollback web admin

```bash
ssh ubuntu@<EC2_IP> \
  "rm -rf /var/www/presensiv2-admin && mv /var/www/presensiv2-admin.bak /var/www/presensiv2-admin"
# No nginx reload needed — same directory, Nginx serves immediately
```

### Nginx config for web admin — `/etc/nginx/sites-available/admin.yourdomain.com`

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    root /var/www/presensiv2-admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

### SSL — Certbot setup

```bash
sudo apt install -y certbot python3-certbot-nginx

# Get certs for both subdomains in one command
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com

# Enable sites
sudo ln -s /etc/nginx/sites-available/admin.yourdomain.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/

sudo nginx -t && sudo systemctl reload nginx

# Verify auto-renewal timer is active
sudo systemctl status certbot.timer
```

### AWS Security Group rules

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP only | Server management |
| HTTP | 80 | 0.0.0.0/0 | Redirect to HTTPS |
| HTTPS | 443 | 0.0.0.0/0 | Web admin + API |
| ❌ Custom TCP | 8000 | BLOCK ALL | Nginx proxies this |
| ❌ PostgreSQL | 5432 | BLOCK ALL | Internal only |

---

## PHASE 3 — Mobile App (Google Play + App Store)

### Pre-deployment checklist
- [ ] `mobile/.env` fixed — production URL, malformed line removed
- [ ] `app.json` bundle IDs confirmed or updated to your org's ID
- [ ] App icons ready: `assets/icon.png` (1024×1024), `assets/adaptive-icon.png`
- [ ] Splash: `assets/splash-icon.png`
- [ ] EAS CLI: `npm install -g eas-cli` + `eas login`
- [ ] `mobile/eas.json` created (see below)

### Create `mobile/eas.json`

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "distribution": "store" }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      },
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Android — Google Play Store

```bash
cd mobile

# First time: link EAS project
eas build:configure

# Build AAB for Play Store
eas build --platform android --profile production

# Submit (after app created in Play Console)
eas submit --platform android --profile production
```

Play Console requirements:
- [ ] Google Play Developer account ($25 one-time)
- [ ] App listing created with package `com.presensiv2.mobile`
- [ ] Privacy policy URL (mandatory — app uses camera, GPS, biometric/face data)
- [ ] Data safety form: declare face data (biometric), precise location, camera
- [ ] Target SDK 34+ — Expo 54 handles this automatically

### iOS — App Store

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

App Store requirements:
- [ ] Apple Developer account ($99/year)
- [ ] App registered in App Store Connect, bundle ID `com.presensiv2.mobile`
- [ ] Privacy policy URL
- [ ] Age rating form (likely 4+, no objectionable content)
- [ ] Camera permission string ✅ already in `app.json`
- [ ] Location permission string ✅ already in `app.json`

---

## PHASE 4 — Production Hardening

### Database Backups

Run this **before every deployment and before every migration**:

```bash
# On EC2 server
sudo mkdir -p /opt/backups

docker exec presensiv2_db pg_dump -U presensiv2 presensiv2 \
  > /opt/backups/presensiv2_$(date +%Y%m%d_%H%M%S).sql

# Verify it's not empty
ls -lh /opt/backups/

# Restore if needed
docker exec -i presensiv2_db psql -U presensiv2 presensiv2 \
  < /opt/backups/presensiv2_TIMESTAMP.sql
```

For automated daily backups, add to crontab (`crontab -e`):
```cron
0 2 * * * docker exec presensiv2_db pg_dump -U presensiv2 presensiv2 > /opt/backups/presensiv2_$(date +\%Y\%m\%d).sql
```

### Backend Rollback

```bash
# BEFORE deploying, tag current image
docker tag presensiv2-backend:latest presensiv2-backend:previous

# If new deploy is broken
docker compose -f docker-compose.prod.yml down backend
docker tag presensiv2-backend:previous presensiv2-backend:latest
docker compose -f docker-compose.prod.yml up -d backend
```

### Memory / Swap for InsightFace (t3.medium = 4 GB RAM)

InsightFace `buffalo_s` uses ~500 MB RAM at startup. PostgreSQL + OS overhead brings total to ~2–3 GB under load. Set up swap as a safety net:

```bash
# One-time setup
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persist across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h   # Should show ~2G swap
docker stats --no-stream   # Monitor per-container usage
```

> If container memory regularly exceeds 85%, upgrade to **t3.large (8 GB)**.

### Disable FastAPI Swagger UI in Production

**File:** `backend/app/main.py`

```python
import os
_is_prod = os.getenv("ENVIRONMENT", "development") == "production"

app = FastAPI(
    title="Presensi Online SSB v2",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)
```

**File:** `backend/app/core/config.py` — add to `Settings` class:
```python
ENVIRONMENT: str = "development"
```

**`backend/.env` on server:**
```env
ENVIRONMENT=production
```

---

## Gaps & Missing Configurations Summary

| Gap | Severity | File | Action |
|-----|----------|------|--------|
| `index.html` CSP hardcodes `localhost:8000` | 🔴 CRITICAL | `web/index.html` | Change to production API domain |
| No `web/.env.production` | 🔴 CRITICAL | — | Create with production API URL |
| `mobile/.env` has LAN IP + malformed line | 🔴 CRITICAL | `mobile/.env` | Fix to HTTPS production URL |
| `docker-compose.yml` uses `--reload` | 🟠 HIGH | `docker-compose.yml` | Use `docker-compose.prod.yml` |
| DB port 5432 exposed to host in compose | 🟠 HIGH | `docker-compose.yml` | Remove in prod |
| Backend binds `0.0.0.0:8000` (internet-facing) | 🟠 HIGH | `docker-compose.yml` | Bind to `127.0.0.1:8000` |
| No Nginx config | 🟠 HIGH | — | Create per plan above |
| No SSL | 🟠 HIGH | — | Certbot |
| SECRET_KEY is placeholder | 🟠 HIGH | `backend/.env` | `openssl rand -hex 32` |
| CORS_ORIGINS points to localhost | 🟠 HIGH | `backend/.env` | Set to production domain |
| Swagger UI accessible in prod | 🟠 HIGH | `backend/app/main.py` | Gate behind `ENVIRONMENT` check |
| No `eas.json` for mobile builds | 🟡 MEDIUM | `mobile/` | Create per plan |
| No `docker-compose.prod.yml` | 🟡 MEDIUM | root | Create per plan |
| DB password hardcoded in dev compose | 🟡 MEDIUM | `docker-compose.prod.yml` | Use `${DB_PASSWORD}` env var |
| `app.json` bundle ID is generic | 🟡 MEDIUM | `mobile/app.json` | Confirm or update to org ID |
| No automated DB backups | 🟡 MEDIUM | — | Add cron job |
| No swap on server | 🟡 MEDIUM | EC2 | `fallocate -l 2G /swapfile` |

---

## Post-Deploy Verification Checklist

### Backend
- [ ] `curl https://api.yourdomain.com/health` → `{"status":"ok"}`
- [ ] `curl https://api.yourdomain.com/docs` → 404 (Swagger disabled in prod)
- [ ] Login via Swagger or Postman with `admin@presensiv2.local / Admin@123` succeeds
- [ ] `curl http://<EC2_IP>:8000` → **connection refused** (not accessible directly)

### Web Admin
- [ ] `https://admin.yourdomain.com` loads, no console errors
- [ ] Login → redirects to `/dashboard`
- [ ] Open DevTools → Network tab → all API calls go to `https://api.yourdomain.com`
- [ ] No `localhost` anywhere in Network tab
- [ ] Browser console shows no CSP violations
- [ ] Page reload keeps session (refresh token in sessionStorage)
- [ ] `curl -I http://admin.yourdomain.com` → `301 Moved Permanently`

### Mobile
- [ ] Install test APK (`eas build --profile preview`) on physical Android device
- [ ] API calls reach `https://api.yourdomain.com` (check backend logs)
- [ ] Check-in flow: camera → GPS → face verify → success
- [ ] Face registration works (Android XHR upload pattern)
- [ ] No SSL certificate errors

### Security
- [ ] Port 8000 blocked: `curl --connect-timeout 5 http://<EC2_IP>:8000` → timeout
- [ ] Port 5432 blocked: `nc -zv <EC2_IP> 5432` → fails
- [ ] HTTPS redirect: `curl -I http://admin.yourdomain.com` → `301`
- [ ] HSTS present: `curl -I https://admin.yourdomain.com | grep Strict`
- [ ] X-Frame-Options DENY present in response headers
