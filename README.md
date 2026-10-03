# HadirOps

**Manajemen presensi dan operasional karyawan.**

HadirOps membantu admin dan supervisor mengelola kehadiran, lokasi kerja, jadwal shift, penugasan, dan persetujuan lembur. Karyawan mencatat kehadiran melalui aplikasi mobile dengan verifikasi wajah dan lokasi.

Proyek terdiri dari tiga komponen utama:
- **Backend API**: FastAPI (Python), PostgreSQL dengan ekstensi `pgvector`, InsightFace.
- **Web Admin**: React (Vite), TypeScript, Tailwind CSS, TanStack Query.
- **Mobile App**: React Native (Expo), TypeScript.

---

## Prasyarat Sistem

- **Docker Desktop** (RAM dialokasikan minimal 4 GB)
- **Node.js** v18+ & npm (untuk pengembangan aplikasi mobile)
- **Expo Go** pada perangkat seluler (tersedia di Google Play Store & Apple App Store)

---

## Cara Menjalankan Program (Quick Start)

### 1. Salin File Konfigurasi Environment

Salin file contoh konfigurasi menjadi file `.env`:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

**Linux / macOS:**
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

> **Catatan:** Nilai default di `.env.example` sudah disesuaikan untuk langsung dijalankan pada environment lokal development.

---

### 2. Jalankan Backend, Database, & Web Admin

Jalankan container menggunakan Docker Compose:

```bash
docker compose up -d --build
```

Proses ini akan secara otomatis:
- Membangun environment backend (FastAPI + dependensi InsightFace).
- Menjalankan PostgreSQL dan menginisialisasi skema database (`hris_ssb`) beserta tabel dan index.
- Menjalankan Web Admin di port `5173`.

Pantau status kesiapan model InsightFace di backend:
```bash
docker compose logs -f backend
```
*(Tekan `Ctrl+C` setelah log menunjukkan model telah dimuat dan server berjalan).*

---

### 3. Inisialisasi Data Pengujian (Seed Database)

Jalankan skrip seed untuk mengisi data awal (sites, shifts, struktur hierarki supervisor/karyawan, dan sampel presensi):

```bash
docker compose exec backend python seed.py
```

---

### 4. Jalankan Aplikasi Mobile (Expo)

Masuk ke folder `mobile`, pasang dependensi, lalu jalankan Metro bundler:

```bash
cd mobile
npm install
npm start -- --clear
```

Pindai QR code yang tampil di terminal menggunakan aplikasi **Expo Go** di ponsel Anda.
*(Pastikan ponsel dan komputer terhubung pada jaringan lokal/WiFi yang sama).*

---

## URL Akses Layanan

| Layanan | URL | Keterangan |
|---------|-----|------------|
| Web Admin | [http://localhost:5173](http://localhost:5173) | Dashboard manajemen, approval, dan laporan |
| Backend API | [http://localhost:8000](http://localhost:8000) | Root endpoint |
| Swagger Docs | [http://localhost:8000/docs](http://localhost:8000/docs) | Dokumentasi API interaktif |
| ReDoc | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Dokumentasi API alternatif |

---

## Akun Pengujian (Testing Accounts)

Setelah menjalankan `seed.py`, Anda dapat menggunakan akun berikut untuk pengujian:

| Role | Email | Password | Keterangan |
|------|-------|----------|------------|
| **Admin** | `admin@presensiv2.local` | `Admin@123` | Akses Web Admin untuk manajemen master data |
| **Supervisor** | `spv101@ptssb.co.id` | `12345` | Akses Web & Mobile (memiliki bawahan & approval presensi) |
| **Karyawan** | `emp101@ptssb.co.id` | `12345` | Akses Mobile (presensi & pengajuan lembur) |

---

## Perintah Perawatan (Maintenance Commands)

```bash
# Melihat log backend secara realtime
docker compose logs -f backend

# Me-restart backend
docker compose restart backend

# Me-restart seluruh service
docker compose restart

# Menghentikan seluruh service (data database tetap tersimpan)
docker compose down

# Menghentikan seluruh service dan menghapus volume database (reset total)
docker compose down -v
```

## Konvensi Repository

Source code, migrasi SQL, aset aplikasi, lockfile npm, dan `.env.example` disimpan di Git. Environment lokal, konfigurasi agent/MCP, dependency, cache, hasil build, laporan pengujian, serta data runtime tidak dilacak.

Pola ignore tidak boleh mengabaikan folder source seperti `web/src/lib/`. Gunakan `git ls-files -ci --exclude-standard` untuk memeriksa file terlacak yang terkena aturan ignore.

Nama publik aplikasi adalah **HadirOps**. Nama folder, container, database, identifier paket native, kunci penyimpanan sesi, dan akun seed lama dipertahankan agar konfigurasi lokal tetap kompatibel.

Akun seed di atas hanya untuk pengujian lokal. Jangan gunakan password tersebut pada deployment produksi.
