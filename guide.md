# Presensi Online SSB v2 — Setup Guide

Setup pertama kali. Database **otomatis dibuat** saat `docker compose up` — tidak perlu setup manual.

---

## Prerequisites

| Tool | Version | Wajib? |
|------|---------|--------|
| Docker Desktop | Latest | **YES** |
| Git | Any | **YES** |
| Node.js | 18+ | Untuk Expo native |
| Expo Go (Play/App Store) | Latest | Untuk test di HP |

RAM minimal **4 GB** untuk container. Windows perlu Hyper-V enabled.

---

## Quick Start

### 1. Clone & buat env files

```powershell
git clone <repo-url> presensiv2
Set-Location presensiv2

# Buat .env (root) — cukup copy dari template
Copy-Item .env.example .env

# Buat backend/.env — WAJIB ganti SECRET_KEY untuk production
Copy-Item backend\.env.example backend\.env
```

**Isi default sudah bisa langsung jalan.** Hanya `SECRET_KEY` di `backend/.env` yang wajib diganti untuk production.

### 2. Start semua service

```powershell
docker compose up -d --build
```

Pertama kali startup akan:
- **Build** backend image (install Python deps + OpenCV/InsightFace)
- **Start PostgreSQL** — otomatis jalankan `database.sql` → membuat schema `hris_ssb` + semua tabel + index + role default
- **Start backend** — download InsightFace model (~120 MB, ~60 detik pertama kali)
- **Start web admin** di port 5173

### 3. Tunggu backend siap

```powershell
docker logs presensiv2_backend -f
```

Tunggu sampai muncul log bahwa InsightFace model ter-load. Lalu `Ctrl+C`.

### 4. Seed database (sekali saja)

```powershell
docker exec presensiv2_backend python seed.py
```

Ini akan mengisi data testing: 4 sites, shifts, 45 user, 400+ attendance records.

### 5. Verifikasi

| Service | URL |
|---------|-----|
| API Health | http://localhost:8000/health |
| Swagger UI | http://localhost:8000/docs |
| Web Admin | http://localhost:5173 |

### 6. Mobile (native, bukan Docker)

```powershell
Set-Location mobile
npm install
npm start -- --clear
```

Scan QR code dengan Expo Go di HP. HP dan laptop harus satu network (WiFi/Tailscale).

---

## Yang Otomatis & Yang Manual

### Otomatis oleh `docker compose up`

| Apa | Detail |
|-----|--------|
| PostgreSQL + pgvector | Container `presensiv2_db` langsung siap |
| Schema & tabel | `database.sql` auto-execute via `entrypoint-initdb.d` |
| Extension `vector` | Dibuat di `public` schema |
| 3 role default | `ADMIN`, `SUPERVISOR`, `EMPLOYEE` |
| Semua index | ivfflat, FK indexes, composite indexes |
| InsightFace model | Download `buffalo_s` sekali, cache di volume |

### Manual (harus dilakukan)

| Step | Command | Kapan |
|------|---------|-------|
| Copy `.env` files | `Copy-Item .env.example .env` dll | Sekali di awal |
| Seed data | `docker exec presensiv2_backend python seed.py` | Sekali setelah DB up |
| Ganti `SECRET_KEY` | Edit `backend/.env` | Sebelum production |

### Tidak diperlukan untuk setup baru

File `backend/migration_*.sql` hanya untuk database lama yang di-upgrade. Skip semua.

---

## Test Accounts (setelah seed)

| Role | Email | Password | Site |
|------|-------|----------|------|
| ADMIN | `admin@presensiv2.local` | `Admin@123` | — (tidak bisa checkin) |
| SUPERVISOR | `spv101@ptssb.co.id` | `12345` | SSB Jakarta (WIB) |
| EMPLOYEE | `emp101@ptssb.co.id` | `12345` | SSB Jakarta (WIB) |

**Gunakan `spv101@ptssb.co.id`** — supervisor, 8 anak buah, ada 10 hari attendance history.

---

## Development URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Web Admin | http://localhost:5173 |
| Expo Metro (Docker) | http://localhost:8081 |

---

## Perintah Sehari-hari

```powershell
# Lihat log backend
docker logs presensiv2_backend -f

# Restart backend (code changes — hot reload sudah on)
docker compose restart backend

# Restart semua
docker compose restart

# Stop semua (data DB tetap aman)
docker compose down

# Stop + hapus semua data (fresh start)
docker compose down -v

# Rebuild backend setelah ubah requirements.txt
docker compose build backend
docker compose up -d backend

# Seed ulang (idempotent — aman dijalankan berkali-kali)
docker exec presensiv2_backend python seed.py

# Mobile dev
cd mobile && npm start -- --clear
```

---

## Ports

| Port | Service |
|------|---------|
| 5433 | PostgreSQL (host → container 5432) |
| 8000 | Backend API |
| 5173 | Web Admin (Vite dev) |
| 8081 | Expo Metro bundler |

---

## Troubleshooting

### InsightFace model lama terdownload

Sekitar 30-60 detik pertama kali. Cek:
```powershell
docker logs presensiv2_backend -f
```

### Port 5433 bentrok dengan PostgreSQL lokal

Edit `DB_HOST_PORT` di `.env` (root). Contoh: `DB_HOST_PORT=5434`.

### ADMIN tidak bisa checkin

By design — ADMIN tidak punya `site_id`. Gunakan akun `@ptssb.co.id`.

### Supervisor/karyawan orisinal tidak bisa checkin

`supervisor@presensiv2.local` dan `karyawan@presensiv2.local` di-assign ke Kantor Pusat yang **tidak punya shift**. Gunakan `@ptssb.co.id` accounts.

### Mobile scan gagal / tidak konek

Pastikan `EXPO_PUBLIC_API_BASE_URL=auto` di `.env` (root). Mode `auto` mendeteksi host dari Metro dev server. Restart Expo dengan `--clear`:
```powershell
cd mobile && npm start -- --clear
```

Jika HP di network berbeda, set IP manual di `.env` (root):
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:8000
```

### CORS error di Web Admin

Pastikan `CORS_ORIGINS` / `CORS_ORIGIN_REGEX` di `backend/.env` mencakup origin browser. Setelah edit:
```powershell
docker compose up -d --force-recreate backend
```

---

## Struktur .env

Hanya perlu **1 file** `.env` di root (`D:\website\presensiv2\.env`) — source of truth untuk semua service:

```ini
# Database
DB_NAME=ptssb
DB_SCHEMA=hris_ssb
DB_USER=presensiv2
DB_PASSWORD=presensiv2pass
DB_HOST_PORT=5433

# Ports
BACKEND_PORT=8000
WEB_PORT=5173

# Web Admin
WEB_API_BASE_URL=/api
WEB_API_PROXY_TARGET=http://backend:8000

# Mobile (Expo)
EXPO_PUBLIC_API_BASE_URL=auto
EXPO_PUBLIC_API_PORT=8000
EXPO_PUBLIC_API_TIMEOUT=10000
```

`backend/.env` terpisah untuk secrets (JWT, CORS, face config) — tidak di-commit ke git.
