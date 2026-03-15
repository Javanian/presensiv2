# How to Run — Presensi SSB v2 Mobile App

This guide covers:
- Starting the backend (Docker)
- Running the app on your PC (web or emulator) or on a physical phone (Expo Go)
- Test accounts and what each can do
- Step-by-step test checklist for every feature

---

## Prerequisites

| Tool | Purpose | Download |
|------|---------|---------|
| Docker Desktop | Run backend + database | https://www.docker.com/products/docker-desktop |
| Node.js 18+ | Run Expo / Metro | https://nodejs.org |
| Android Studio | Android emulator (optional) | https://developer.android.com/studio |
| **Expo Go** | Test on your physical Android/iOS phone | Play Store / App Store: "Expo Go" |

---

## Part 1 — Start the Backend

### Step 1 — Create backend `.env`

```bash
cd "d:\Presensi Online SSB\presensiv2\backend"
copy .env.example .env
```

Open `.env` and set at minimum:
```
DATABASE_URL=postgresql+asyncpg://presensiv2:presensiv2pass@db:5432/presensiv2
SECRET_KEY=dev-secret-key-change-in-production-32chars
CORS_ORIGINS=["http://localhost:3000","http://localhost:8081","http://10.0.2.2:8081"]
```

### Step 2 — Start Docker containers

```bash
cd "d:\Presensi Online SSB\presensiv2"
docker compose up -d --build
```

Wait ~30 seconds. Verify:

```bash
docker compose ps
```

Both `presensiv2_db` and `presensiv2_backend` should show status **Up**.

### Step 3 — Seed the database (first time only)

```bash
docker exec presensiv2_backend python seed.py
```

### Step 4 — Verify backend is running

Open in browser: **http://localhost:8000/docs**

You should see the Swagger UI. If you see it, the backend is ready.

---

## Part 2 — Test Accounts

These accounts are created by `seed.py`:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **ADMIN** | `admin@presensiv2.local` | `Admin@123` | No site assigned — cannot check in |
| **SUPERVISOR** | `supervisor@presensiv2.local` | `Supervisor@123` | Has site, can check in + register face |
| **EMPLOYEE** | `karyawan@presensiv2.local` | `Karyawan@123` | Has site, can check in, no face section |

> **Tip:** For most testing use the **SUPERVISOR** account — it has all permissions enabled and a site assigned.

---

## Part 3 — Configure Mobile App `.env`

The `.env` file in the mobile folder tells the app where to find the backend.

**File:** `d:\Presensi Online SSB\presensiv2\mobile\.env`

### Option A — Expo Go on Physical Phone (recommended)

Your phone must be on the **same Wi-Fi network** as your PC.

```
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_LAN_IP:8000
EXPO_PUBLIC_API_TIMEOUT=10000
```

Find your PC's LAN IP:
```bash
# Windows — look for "IPv4 Address" under your Wi-Fi adapter
ipconfig
# Example result: 192.168.1.100
```

So the value becomes: `http://192.168.1.100:8000`

### Option B — Android Emulator (PC only)

```
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
EXPO_PUBLIC_API_TIMEOUT=10000
```

> `10.0.2.2` is the emulator's built-in alias for your PC's `localhost`.

### Option C — Web Browser (PC only, limited features)

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_API_TIMEOUT=10000
```

> Camera and GPS do **not** work in web mode. Use Options A or B for full testing.

After changing `.env`, always restart Metro with `--clear`:
```bash
npx expo start --clear
```

---

## Part 4 — Run the App

### On Your Physical Phone with Expo Go

1. Install **Expo Go** from the Play Store (Android) or App Store (iOS)
2. Set `.env` to Option A (your PC's LAN IP)
3. Phone and PC must be on the **same Wi-Fi**
4. In the mobile folder, run:
   ```bash
   cd "d:\Presensi Online SSB\presensiv2\mobile"
   npx expo start --clear
   ```
5. A QR code appears in the terminal
6. **Android:** Open Expo Go → tap **Scan QR Code** → scan the code
7. **iOS:** Open the Camera app → point at the QR code → tap the Expo Go banner

The app loads directly onto your phone — no build/APK needed.

### On Android Emulator (Android Studio)

1. Open Android Studio → start an emulator (API 30+ recommended)
2. Set `.env` to Option B (`10.0.2.2`)
3. Run `npx expo start`
4. Press **`a`** in the terminal — the app installs automatically

### In Web Browser (limited)

1. Set `.env` to Option C (`localhost`)
2. Run `npx expo start`
3. Press **`w`** in the terminal — browser opens automatically
4. Only Auth and History features work fully in web mode

---

## Part 5 — Required Setup Before Testing Check-In

> **Important:** The seed script creates users and a site, but **no shifts**. Check-in will fail with "No active shift" unless you create one first.

### Create a test shift via Swagger

1. Open **http://localhost:8000/docs**
2. Click **Authorize** (top right) → enter: `supervisor@presensiv2.local` / `Supervisor@123`
3. Find **POST /shifts** → click **Try it out**
4. Paste this body (covers all days, 07:00–17:00):

```json
{
  "name": "Shift Reguler",
  "site_id": 1,
  "start_time": "07:00:00",
  "end_time": "17:00:00",
  "is_cross_midnight": false,
  "work_schedules": [
    { "day_of_week": 0, "toleransi_telat_menit": 15 },
    { "day_of_week": 1, "toleransi_telat_menit": 15 },
    { "day_of_week": 2, "toleransi_telat_menit": 15 },
    { "day_of_week": 3, "toleransi_telat_menit": 15 },
    { "day_of_week": 4, "toleransi_telat_menit": 15 },
    { "day_of_week": 5, "toleransi_telat_menit": 15 },
    { "day_of_week": 6, "toleransi_telat_menit": 15 }
  ]
}
```

> `day_of_week`: 0=Sunday, 1=Monday, 2=Tuesday … 6=Saturday. The body above covers all 7 days.

Click **Execute** → expect `201 Created`. The shift is now active.

---

## Part 6 — What You Can Test (Feature Checklist)

### Authentication (all platforms)

| Test | Steps | Expected result |
|------|-------|-----------------|
| Login | Enter email + password → tap Masuk | Lands on Home tab |
| Wrong password | Enter wrong password | Inline error message (no popup) |
| Remember session | Login → close app → reopen | Stays logged in, goes to Home |
| Logout | Profile tab → tap Keluar | Returns to Login screen |

---

### Home Screen (all platforms)

| Test | Steps | Expected result |
|------|-------|-----------------|
| Welcome card | Login as any user | Name + role badge visible |
| Not checked in | Login with no check-in today | Grey "Belum Absen" card + green "Check In" button |
| Pull to refresh | Pull down on Home | Attendance status reloads |

---

### Check In / Check Out (requires GPS — physical phone or emulator)

> Login as **supervisor** or **employee**. Create a shift first (Part 5).
> The test site is in Jakarta (lat -6.2, lon 106.8). If you're outside Jakarta, check-in still works — you'll get status **LUAR AREA**, which is correct behavior.

| Test | Steps | Expected result |
|------|-------|-----------------|
| Open check-in | Tap "Check In" | Bottom sheet opens, locating GPS |
| Location found | Wait for GPS | Coordinates shown + "Konfirmasi Check In" button appears |
| Confirm check-in | Tap "Konfirmasi Check In" | Status shown: TEPAT WAKTU / TERLAMBAT / LUAR AREA |
| Home updates | Close modal | Home card shows check-in time + status badge |
| Check out | Tap "Check Out" | Bottom sheet opens, acquires GPS |
| Confirm checkout | Tap "Konfirmasi Check Out" | Work duration + overtime shown |
| Completed state | After checkout | Home shows "Absensi Selesai" + both times + duration |
| Double check-in | Tap "Check In" when already checked in | (Button shows "Check Out" — no double check-in possible) |
| Location denied | Deny GPS permission | Error message with instructions to enable in Settings |

---

### Attendance History (all platforms)

| Test | Steps | Expected result |
|------|-------|-----------------|
| View records | History tab | Cards with date, times, status badges |
| Filter by month | Tap a month chip | Only that month's records shown |
| All records | Tap "Semua" chip | All records shown |
| Empty period | Select a month with no records | "Belum ada data" empty state |
| Pull to refresh | Pull down | List reloads |
| Status colors | Check badge colors | Green = Tepat Waktu, Amber = Terlambat, Red = Luar Area |
| Overtime badge | Record with overtime > 0 | Amber "Lembur Xm" chip shown |
| Auto-checkout mark | Backend auto-checked out | Checkout time shows "(auto)" |

---

### Face Registration (requires camera — physical phone or emulator)

> Only visible for **ADMIN** and **SUPERVISOR** roles. Not shown for EMPLOYEE.

| Test | Steps | Expected result |
|------|-------|-----------------|
| Face section hidden | Login as employee → Profile tab | No "Wajah Biometrik" section |
| Face section visible | Login as supervisor → Profile tab | "Wajah Biometrik" card shown |
| First time | Before registering | "Belum terdaftar" + "Daftarkan Wajah" button (filled blue) |
| Open camera | Tap "Daftarkan Wajah" | Front camera opens with oval face guide overlay |
| Capture | Tap shutter button | Photo preview with "Ambil Ulang" + "Gunakan Foto Ini" |
| Retake | Tap "Ambil Ulang" | Returns to camera |
| Upload face | Tap "Gunakan Foto Ini" with face visible | Success + embedding_dim displayed |
| Status updated | Close modal → check Profile | Button now says "Perbarui Wajah" (outline style) |
| No face error | Submit photo with no face | "Tidak ada wajah terdeteksi" error message |
| Multiple faces | Submit photo with 2+ faces | "Terdeteksi lebih dari satu wajah" error message |
| Camera denied | Deny camera permission | "Izin kamera diperlukan" error with instructions |

---

### Profile (all platforms)

| Test | Steps | Expected result |
|------|-------|-----------------|
| User info | Profile tab | Name, role badge, employee ID, email, site, status shown |
| Role badge colors | Admin=purple, Supervisor=blue, Employee=green | Correct color per role |

---

## Part 7 — What Works Where

| Feature | Web browser | Android emulator | Physical phone |
|---------|-------------|-----------------|----------------|
| Login / Auth | ✅ | ✅ | ✅ |
| Home screen | ✅ | ✅ | ✅ |
| Attendance History | ✅ | ✅ | ✅ |
| Profile + Logout | ✅ | ✅ | ✅ |
| **Check In / Check Out** | ❌ no GPS | ✅ (mock GPS) | ✅ |
| **Face Registration** | ❌ no camera | ✅ | ✅ |

---

## Troubleshooting

### "No active shift found" when checking in
→ Create a shift via Swagger as described in Part 5.

### "User is not assigned to any site"
→ You are logged in as **Admin**. Admin has no site in the seed data. Use **Supervisor** or **Employee** for check-in.

### "Network request failed" / can't reach backend
- Is Docker running? → `docker compose ps` (both services must show **Up**)
- Quick check: http://localhost:8000/health in browser
- Expo Go on phone? → Use your PC's LAN IP, not `localhost`
- After changing `.env` → `npx expo start --clear`

### QR code not working in Expo Go
- Phone and PC must be on the same Wi-Fi
- Press **`s`** in the Metro terminal to switch to LAN mode

### Camera or GPS permission denied
- **Android:** Settings → Apps → Expo Go → Permissions → enable Camera / Location
- **iOS:** Settings → Expo Go → Camera → On, Location → While Using

### Metro cache issues
```bash
npx expo start --clear
```

### Port 8000 already in use
```bash
docker compose down
docker compose up -d
```

### Database empty after restart
```bash
docker exec presensiv2_backend python seed.py
```

### Android emulator can't connect
- Must use `10.0.2.2` not `localhost` in `.env`
- Check ADB: `adb devices` (emulator should be listed)

---

## Stop Everything

```bash
# Stop Metro bundler
Ctrl + C

# Stop Docker backend + database
cd "d:\Presensi Online SSB\presensiv2"
docker compose down
```

Database data persists after `docker compose down`. To wipe everything and start fresh:

```bash
docker compose down -v
# Re-seed after restarting: docker exec presensiv2_backend python seed.py
```
