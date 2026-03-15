# System Integration Test (SIT) — Presensi Online SSB v2

> **Version:** 1.0
> **Date:** 2026-03-15
> **Scope:** Mobile App (Expo/React Native) + Web Admin (React/Vite) + Backend (FastAPI)
> **Environment:** Docker Compose — backend port 8000, web admin port 5173

---

## Table of Contents

1. [System Under Test](#1-system-under-test)
2. [Testing Strategy — Time Simulation](#2-testing-strategy--time-simulation)
3. [Test Environment Setup](#3-test-environment-setup)
4. [Reference Data](#4-reference-data)
5. [Mobile App Test Cases](#5-mobile-app-test-cases)
6. [Web Admin Test Cases](#6-web-admin-test-cases)
7. [Cross-Component Integration Test Cases](#7-cross-component-integration-test-cases)
8. [Test Execution Log Template](#8-test-execution-log-template)

---

## 1. System Under Test

### Components

| Component | Technology | URL / Access |
|-----------|------------|--------------|
| Backend API | FastAPI (Python 3.11) | http://localhost:8000 |
| Swagger UI | FastAPI auto-docs | http://localhost:8000/docs |
| Web Admin | React 18 + Vite | http://localhost:5173 |
| Mobile App | React Native (Expo ~54) | Physical device or Android emulator |
| Database | PostgreSQL 16 + pgvector | Internal (port 5432) |

### Critical Architecture Fact

> ⚠️ **The attendance timestamp is determined by the SERVER, not the device.**
>
> The mobile app sends only GPS coordinates (`latitude`, `longitude`) to the backend. The server calls `datetime.now(ZoneInfo(site.timezone))` to obtain the current time. **Changing the device clock does NOT affect the recorded attendance time.**
>
> All time simulation for SIT must therefore target the **server clock** or use **shift configuration tricks**.

---

## 2. Testing Strategy — Time Simulation

Since attendance logic is entirely server-side, testers have four practical approaches to simulate different time conditions:

---

### Method A — Shift-Time Alignment (Recommended for SIT)

**Concept:** Create a temporary test shift whose `start_time` matches the current real-world clock time. This way, a check-in performed right now will be ONTIME; a check-in performed 16+ minutes later will be LATE.

**Procedure:**

1. Open Swagger UI at `http://localhost:8000/docs`
2. Authenticate: `POST /auth/login` with `admin@presensiv2.local` / `Admin@123`
3. Create a test shift via `POST /shifts`:
   ```json
   {
     "site_id": <target_site_id>,
     "name": "Test Shift SIT",
     "start_time": "HH:MM",
     "end_time": "HH:MM",
     "work_hours_standard": 8,
     "schedules": [
       { "day_of_week": <today_db_dow>, "toleransi_telat_menit": 15 }
     ]
   }
   ```
   Where `HH:MM` is the current clock time and `today_db_dow` is today's day (0=Sun, 1=Mon … 6=Sat).
4. Perform the test immediately (ONTIME window), then wait 16+ minutes (LATE window).
5. Delete the test shift after the test run.

**Day-of-week quick reference:**

| Day | `day_of_week` (DB) |
|-----|--------------------|
| Sunday | 0 |
| Monday | 1 |
| Tuesday | 2 |
| Wednesday | 3 |
| Thursday | 4 |
| Friday | 5 |
| Saturday | 6 |

---

### Method B — Timezone Differential (No Server Change Required)

**Concept:** The same absolute UTC moment represents different local times across the three sites. A tester can use **different site accounts** to observe different time-relative states simultaneously.

**Time offsets:**

| Site | Timezone | UTC Offset |
|------|----------|------------|
| SSB Jakarta | Asia/Jakarta (WIB) | UTC+7 |
| SSB Makassar | Asia/Makassar (WITA) | UTC+8 |
| SSB Jayapura | Asia/Jayapura (WIT) | UTC+9 |

**Practical example** (all sites use 07:00 shift start, 15 min tolerance):

| When UTC is… | Jakarta (WIB) sees… | Makassar (WITA) sees… | Jayapura (WIT) sees… |
|---|---|---|---|
| 23:50 UTC | 06:50 — before shift | 07:50 — LATE | 08:50 — LATE |
| 00:00 UTC | 07:00 — ONTIME | 08:00 — LATE | 09:00 — LATE |
| 00:05 UTC | 07:05 — ONTIME | 08:05 — LATE | 09:05 — LATE |
| 00:15 UTC | 07:15 — ONTIME (last minute) | 08:15 — LATE | 09:15 — LATE |
| 00:16 UTC | 07:16 — LATE | 08:16 — LATE | 09:16 — LATE |
| 10:00 UTC | 17:00 — shift end | 18:00 — after shift | 19:00 — after shift |

**Use case:** Test ONTIME vs LATE simultaneously without waiting — log in as Jakarta employee for ONTIME, and log in as Makassar employee for LATE, at the same real moment.

---

### Method C — Docker Server Clock Override

**Concept:** Directly change the system clock inside the running backend container.

> ⚠️ **SIT environment only.** Never use in production. Restore clock immediately after the test.

**Commands:**

```bash
# Check current server time
docker exec presensiv2_backend date

# Set server time to 06:50 WIB (= 23:50 UTC on PREVIOUS day)
# This simulates "before shift" for Jakarta account
docker exec presensiv2_backend date -s "2026-03-15 23:50:00"

# Set server time to exactly shift start 07:00 WIB (= 00:00 UTC)
docker exec presensiv2_backend date -s "2026-03-16 00:00:00"

# Set server time to 07:05 WIB — ONTIME window (= 00:05 UTC)
docker exec presensiv2_backend date -s "2026-03-16 00:05:00"

# Set server time to 07:16 WIB — LATE (= 00:16 UTC)
docker exec presensiv2_backend date -s "2026-03-16 00:16:00"

# Set server time to 17:00 WIB — shift end (= 10:00 UTC)
docker exec presensiv2_backend date -s "2026-03-16 10:00:00"

# Restore to real time (sync NTP from host)
docker exec presensiv2_backend bash -c "apt-get install -y ntpdate 2>/dev/null; ntpdate pool.ntp.org || hwclock --hctosys"
```

> **Note:** Some Docker images on Windows/WSL2 do not allow `date -s` inside the container without `--privileged` flag. If this fails, use Method A or B.

---

### Method D — Validate Server Timestamps via API

After every test, validate the server-recorded UTC timestamp:

```bash
# Via Swagger: GET /attendance/me
# Or via psql:
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT id, user_id, checkin_time, checkin_time AT TIME ZONE 'Asia/Jakarta' AS wib, \
   checkout_time, status FROM attendance ORDER BY created_at DESC LIMIT 5;"
```

**Interpreting results:**

| DB Column | Format | Meaning |
|-----------|--------|---------|
| `checkin_time` | `2026-03-15 00:05:00+00` | UTC timestamp |
| `AT TIME ZONE 'Asia/Jakarta'` | `2026-03-15 07:05:00` | Actual local check-in time |
| `status` | `ONTIME` / `LATE` / `OUT_OF_RADIUS` | Determined at check-in |

---

## 3. Test Environment Setup

### Prerequisites

```bash
# 1. Start all services
docker compose up -d

# 2. Seed test data (first time only)
docker exec presensiv2_backend python seed.py

# 3. Verify backend health
curl http://localhost:8000/health

# 4. Check server time matches expected timezone
docker exec presensiv2_backend date
```

### Clean Attendance State Before Each Test Run

```bash
# Remove today's attendance records for test accounts (run ONLY in SIT environment)
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "DELETE FROM attendance WHERE user_id IN (
     SELECT id FROM users WHERE email LIKE '%@ptssb.co.id'
   ) AND checkin_time >= NOW() - INTERVAL '1 day';"
```

### Install Mobile App for Testing

```bash
# Development build (physical Android device)
cd mobile && npx expo start --clear
# Press 'a' for Android emulator or scan QR code with Expo Go

# Set API base URL for physical device (use your LAN IP)
# Edit mobile/.env: EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

---

## 4. Reference Data

### Test Accounts

| Account | Password | Role | Site | Timezone |
|---------|----------|------|------|----------|
| `emp101@ptssb.co.id` | `12345` | EMPLOYEE | SSB Jakarta | WIB (UTC+7) |
| `emp103@ptssb.co.id` | `12345` | EMPLOYEE | SSB Makassar | WITA (UTC+8) |
| `emp104@ptssb.co.id` | `12345` | EMPLOYEE | SSB Jayapura | WIT (UTC+9) |
| `spv101@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jakarta | WIB (UTC+7) |
| `spv103@ptssb.co.id` | `12345` | SUPERVISOR | SSB Makassar | WITA (UTC+8) |
| `admin@presensiv2.local` | `Admin@123` | ADMIN | None | — |

### Seeded Shift Configuration (All 3 Sites)

| Parameter | Value |
|-----------|-------|
| Shift name | "Shift Reguler WIB/WITA/WIT" |
| Start time | 07:00 (local site time) |
| End time | 17:00 (local site time) |
| Cross-midnight | No |
| Days active | All 7 days (Mon–Sun) |
| Late tolerance | 15 minutes |
| ONTIME window | 07:00:00 → 07:15:00 (inclusive) |
| LATE window | 07:15:01+ |

### Site GPS Coordinates

| Site | Latitude | Longitude | Radius |
|------|----------|-----------|--------|
| SSB Jakarta | -6.200000 | 106.816666 | 100 m |
| SSB Makassar | -5.147350 | 119.432181 | 100 m |
| SSB Jayapura | -2.533333 | 140.717361 | 100 m |

### Status Logic Summary

```
IF GPS distance > site.radius_meter  →  status = "OUT_OF_RADIUS"
ELSE IF server_local_time <= (shift.start_time + 15 min)  →  status = "ONTIME"
ELSE  →  status = "LATE"
```

---

## 5. Mobile App Test Cases

---

### TC-M01 — Login: Valid Employee Credentials

**Objective:** Verify that an employee can authenticate and the app navigates to Home screen.

**Preconditions:** Backend running, seed data loaded.

**Simulated Time Setup:** None required.

**Steps:**
1. Open mobile app.
2. Enter email: `emp101@ptssb.co.id`, password: `12345`.
3. Tap **Masuk**.

**Expected Result:**
- Access token stored in SecureStore (`presensiv2_access_token`).
- App navigates to Home screen.
- Home screen shows employee name, site name "SSB Jakarta", today's date in WIB (Intl.DateTimeFormat with `Asia/Jakarta`).
- Bottom nav shows: Home, History, Overtime, Profile (no Team tab — EMPLOYEE role).

**Notes:** If navigation does not change, check that the `useLogin.onSuccess` in `hooks/useAuth.ts` correctly calls `authApi.me()` and `setAuthUser()`.

---

### TC-M02 — Login: Invalid Password

**Objective:** Verify lockout counter increments and error is shown.

**Preconditions:** Account not locked.

**Simulated Time Setup:** None required.

**Steps:**
1. Enter `emp101@ptssb.co.id` with password `wrongpassword`.
2. Tap **Masuk**.
3. Observe error message.
4. Repeat 4 more times (5 total failed attempts).

**Expected Result:**
- Attempts 1–4: Error toast shown ("Email atau password salah" or similar).
- Attempt 5: Account locked; error indicates lock for 30 minutes.
- DB: `users.failed_login_attempts = 5`, `users.locked_until = NOW() + 30 min` (UTC).

**Notes for Tester:** After this test, unlock the account for subsequent tests:
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE email='emp101@ptssb.co.id';"
```

---

### TC-M03 — Check-in: ONTIME (Within Tolerance Window)

**Objective:** Verify that check-in within 15 minutes of shift start records status `ONTIME`.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id` (SSB Jakarta, shift 07:00).
- No attendance record for today.
- Server time is within 07:00–07:15 WIB.

**Simulated Time Setup:**

*Option A (Method A — Shift Alignment):*
1. Create a test shift via Swagger with `start_time = current_time`, `toleransi_telat_menit = 15`.
2. Immediately perform the check-in.

*Option B (Method C — Docker clock):*
```bash
# Set server to 07:05 WIB = 00:05 UTC (use tomorrow's date if past midnight UTC)
docker exec presensiv2_backend date -s "2026-03-16 00:05:00"
```

*Option C (Method B — Timezone):*
At the real moment when UTC clock is between 00:00 and 00:15, use `emp101@ptssb.co.id` (Jakarta account). The local time will be 07:00–07:15 WIB → ONTIME.

**Steps:**
1. Open Home screen.
2. Tap **Check-in**.
3. When prompted, allow camera access and take face photo.
4. Allow location access.
5. Confirm check-in.

**Expected Result:**
- Modal shows "Check-in berhasil".
- Home screen shows check-in time in WIB format (e.g., "07:05 WIB").
- `attendance.status = "ONTIME"`.
- `attendance.checkin_time` stored in UTC (e.g., `2026-03-16T00:05:00Z`).
- `attendance.is_weekend` = TRUE if Saturday/Sunday in WIB, FALSE otherwise.

**Validate:**
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT checkin_time, checkin_time AT TIME ZONE 'Asia/Jakarta' AS wib, status FROM attendance ORDER BY created_at DESC LIMIT 1;"
```

---

### TC-M04 — Check-in: LATE (Past Tolerance Deadline)

**Objective:** Verify that check-in after 07:15 WIB records status `LATE`.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id`.
- No attendance record for today.
- Server time is after 07:15 WIB (and before 17:00 WIB).

**Simulated Time Setup:**

*Option A (Method A):* Create shift matching current time, then wait 16 minutes before checking in.

*Option B (Method C):*
```bash
# Set to 07:32 WIB = 00:32 UTC
docker exec presensiv2_backend date -s "2026-03-16 00:32:00"
```

*Option C (Method B):* Between 00:15 UTC and 10:00 UTC, any Jakarta check-in is LATE.

**Steps:** Same as TC-M03.

**Expected Result:**
- `attendance.status = "LATE"`.
- Check-in time shows correctly in WIB on Home screen.
- Work history in HistoryScreen shows LATE badge for this record.

---

### TC-M05 — Check-in: OUT_OF_RADIUS (GPS Outside Site Boundary)

**Objective:** Verify that check-in with GPS position >100m from site center records `OUT_OF_RADIUS`.

**Preconditions:**
- Logged in as any employee account.
- No attendance record for today.
- Server time is within shift window.

**Simulated Time Setup:** Ensure server time is within shift (Method A or B).

**GPS Simulation Methods:**
- **Emulator:** Android Studio → Extended Controls → Location → enter custom coordinates.
- **Physical device:** Walk/drive outside the 100m radius of the site center. For SSB Jakarta center (-6.200000, 106.816666), any GPS position >100m away qualifies.
- **Mock GPS app:** Install "Fake GPS Location" on Android (requires Developer Options → Mock Location).

**Out-of-radius test coordinates (>100m from SSB Jakarta center):**
- Latitude: `-6.201500`, Longitude: `106.816666` (~167m south → OUT_OF_RADIUS)

**In-radius test coordinates (<100m from SSB Jakarta center):**
- Latitude: `-6.200050`, Longitude: `106.816800` (~16m → IN_RADIUS)

**Steps:**
1. Configure mock GPS to out-of-radius coordinates.
2. Open Home screen, tap **Check-in**.
3. Complete face capture.

**Expected Result:**
- `attendance.status = "OUT_OF_RADIUS"`.
- App still records check-in (OUT_OF_RADIUS is informational, not a block).
- Home screen shows check-in time.

**Notes:** The system records `OUT_OF_RADIUS` attendance — it does NOT reject the check-in. Verification/disciplinary action is an admin decision.

---

### TC-M06 — Check-in: No Active Shift (Outside Shift Hours)

**Objective:** Verify that check-in outside any shift window is rejected with 422 error.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id`.
- Server time is before 07:00 WIB or after 17:00 WIB, and no overtime covers this time.

**Simulated Time Setup:**

*Option A (Method C):*
```bash
# Set to 06:50 WIB = 23:50 UTC (previous day)
docker exec presensiv2_backend date -s "2026-03-15 23:50:00"
```

*Option B (Method B):* At UTC 00:20 (between 00:15–10:00), Jakarta = 07:20 WIB (LATE, but still in shift window). For before-shift, need UTC < 00:00 (i.e., local time < 07:00) — so test between UTC 17:00–23:59 the previous day.

**Steps:**
1. Tap **Check-in** on Home screen.
2. Complete face capture and GPS.

**Expected Result:**
- Error toast shown: "No active shift" (or Indonesian equivalent).
- HTTP 422 returned from server.
- No attendance record created.
- Check-in button re-enables after failure.

---

### TC-M07 — Double Check-in Prevention (Same Calendar Day)

**Objective:** Verify that a second check-in on the same site-local calendar day is rejected.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id`.
- Attendance record already exists for today (status: ONTIME or LATE).

**Simulated Time Setup:** Ensure server time is still within shift window (after first check-in).

**Steps:**
1. After a successful check-in (TC-M03 or TC-M04), attempt a second check-in.
2. Tap **Check-in** again.

**Expected Result:**
- Error: "Already checked in today at HH:MM:SS" (HTTP 409).
- Toast shown.
- No duplicate record created.
- DB: still only one attendance record for this user today.

**Timezone edge case to verify separately (Method C):**
```bash
# Test: Check-in in Jakarta at 23:55 WIB (16:55 UTC), then cross midnight
# Set clock to 23:55 WIB
docker exec presensiv2_backend date -s "2026-03-15 16:55:00"
# Check-in → succeeds (23:55 WIB = March 15 in Jakarta)
# Then set clock to next day 00:05 WIB
docker exec presensiv2_backend date -s "2026-03-15 17:05:00"
# Second check-in attempt → should SUCCEED because it's now March 16 in WIB
# (The day boundary is at 17:00 UTC = midnight WIB)
```

Expected: Second check-in on next calendar day SUCCEEDS (it's a new day in Jakarta).

**DB Validation — Confirm two records exist on different local dates despite close UTC timestamps:**
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT id, checkin_time, checkin_time AT TIME ZONE 'Asia/Jakarta' AS wib_date
   FROM attendance
   WHERE user_id = (SELECT id FROM users WHERE email='emp101@ptssb.co.id')
   ORDER BY checkin_time DESC LIMIT 2;"
```

Expected output: two rows where `checkin_time` values are only ~10 minutes apart in UTC, but `wib_date` shows **different calendar dates** (e.g., `2026-03-15 23:55:00` and `2026-03-16 00:05:00`), confirming the day-boundary logic correctly uses Jakarta midnight (17:00 UTC) rather than UTC midnight.

---

### TC-M08 — Check-in: Weekend (Saturday or Sunday)

**Objective:** Verify that weekend check-in records `is_weekend = TRUE` and overtime is auto-assigned.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id`.
- Server date is a Saturday or Sunday in WIB.
- Server time within shift window.

**Simulated Time Setup:**

*Option A (Method C):* Set server to a Saturday 07:05 WIB:
```bash
# March 14 2026 is a Saturday
docker exec presensiv2_backend date -s "2026-03-14 00:05:00"  # = 07:05 WIB Sat
```

**Steps:**
1. Check-in normally.
2. After check-in, check-out.

**Expected Result:**
- `attendance.is_weekend = TRUE`.
- `attendance.status = "ONTIME"` (if within tolerance).
- After checkout, `attendance.overtime_minutes = attendance.work_duration_minutes` (all hours = overtime).

---

### TC-M09 — Check-out: Manual Checkout

**Objective:** Verify that checkout calculates work duration correctly.

**Preconditions:**
- Active check-in exists (no checkout yet).
- Server time is after check-in time.

**Simulated Time Setup:** After TC-M03 check-in at 07:05, set server to 12:00 WIB (if using Docker clock).

**Steps:**
1. Tap **Check-out** on Home screen.
2. Complete GPS (optional for checkout).
3. Confirm.

**Expected Result:**
- `attendance.checkout_time` recorded in UTC.
- `attendance.work_duration_minutes` = minutes between checkin and checkout (e.g., 295 min for 07:05→12:00).
- Home screen check-out button replaced with "Sudah Absen Pulang" or disabled state.

**Validate:**
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT work_duration_minutes, overtime_minutes, auto_checkout FROM attendance ORDER BY created_at DESC LIMIT 1;"
```

---

### TC-M10 — Auto-Checkout Verification

**Objective:** Verify that the auto-checkout background worker closes open attendance at shift end.

**Preconditions:**
- Active check-in exists (no checkout).
- Server time approaches 17:00 WIB (shift end).

**Simulated Time Setup:**

*Method C — Docker clock:*
```bash
# Check-in at 07:05 (set clock, perform check-in)
docker exec presensiv2_backend date -s "2026-03-16 00:05:00"
# Perform check-in via app...

# Jump clock to shift end
docker exec presensiv2_backend date -s "2026-03-16 10:00:00"  # = 17:00 WIB
# Wait up to 60 seconds for auto-checkout worker
sleep 65

# Verify
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT checkout_time, auto_checkout, work_duration_minutes FROM attendance ORDER BY created_at DESC LIMIT 1;"
```

**Fallback if `date -s` is blocked (missing `--privileged` flag):**

If the Docker container does not allow system clock changes, skip the clock manipulation and instead trigger auto-checkout directly via Swagger (ADMIN only):
1. Open `http://localhost:8000/docs` → authenticate as admin.
2. Call `POST /attendance/trigger-auto-checkout`.
3. The response returns `{ "processed": N, "message": "..." }` — records closed immediately, no 60-second wait required.

This substitutes for the background worker and is safe to use in the SIT environment.

**Expected Result:**
- Within 60 seconds of shift end (or immediately via manual trigger): `attendance.checkout_time` is set.
- `attendance.auto_checkout = TRUE`.
- `attendance.work_duration_minutes` = minutes from check-in to 17:00 WIB.
- Mobile Home screen refreshes and shows checked-out state (on next query refresh cycle).

---

### TC-M11 — Face Recognition: Unregistered Face

**Objective:** Verify that check-in is blocked if the employee has no registered face embedding.

**Preconditions:**
- Using a test account with no face registered (or face deleted).
- Delete face: `UPDATE users SET face_embedding=NULL WHERE email='emp101@ptssb.co.id'` (or use DELETE /face endpoint as ADMIN).

**Steps:**
1. Log in as the test account.
2. Tap **Check-in**.
3. Take face photo.

**Expected Result:**
- Error: "No face registered" or "Face not found" (HTTP 404/422 from `/face/verify`).
- Check-in is not completed.
- Profile screen shows face status as "Belum Terdaftar".

---

### TC-M12 — Face Registration Flow

**Objective:** Verify the face registration flow from ProfileScreen.

**Preconditions:**
- Logged in as `emp101@ptssb.co.id` with no face registered.

**Steps:**
1. Navigate to Profile tab.
2. Tap **Daftarkan Wajah**.
3. Take face photo in `FaceRegisterModal`.
4. Review photo, tap **Konfirmasi Upload**.
5. Wait for result.

**Expected Result:**
- Upload succeeds (XHR to `POST /face/register`).
- Profile screen shows "Wajah Terdaftar" badge.
- `users.face_embedding` is non-null in DB (512-float vector).

**Notes for Tester:** Face upload uses XHR (NOT Axios, NOT native fetch). If upload fails, check network connectivity and that the backend InsightFace model is loaded (`docker logs presensiv2_backend | grep buffalo_s`).

---

### TC-M13 — Network Offline During Check-in

**Objective:** Verify graceful handling of network disconnection during attendance submission.

**Preconditions:**
- Logged in, no attendance today.
- Network connection available initially.

**Steps:**
1. Start the check-in flow (tap Check-in, camera opens).
2. Disable Wi-Fi / mobile data on device.
3. Take face photo (triggers upload attempt).

**Expected Result:**
- Error toast shown (Indonesian message, e.g., "Koneksi terputus" or network error).
- `OfflineBanner` (red bar) appears at top of screen.
- Check-in button re-enables after failure.
- No attendance record created.
- On reconnect: banner disappears; user can retry.

---

### TC-M14 — Supervisor: View Team Attendance

**Objective:** Verify SUPERVISOR can view subordinate attendance records.

**Preconditions:**
- Logged in as `spv101@ptssb.co.id`.
- Subordinates (EMP101, EMP106–EMP112) have attendance records.

**Steps:**
1. Navigate to **Team** tab (visible to SUPERVISOR/ADMIN only).
2. Use month arrows to navigate to January 2026.
3. Expand an employee card.

**Expected Result:**
- List shows only this supervisor's subordinates (8 employees).
- Records display date, check-in time, check-out time, status badge, all in WIB (Intl.DateTimeFormat with `Asia/Jakarta`).
- EMPLOYEE role: **Team tab is NOT visible** (verify with `emp101@ptssb.co.id`).

---

### TC-M15 — Cross-Midnight Shift (Advanced)

**Objective:** Verify shift matching and status logic for a cross-midnight shift (e.g., 22:00–06:00).

**Preconditions:**
- Create a cross-midnight test shift via Swagger for SSB Jakarta:
  ```json
  {
    "site_id": <jakarta_site_id>,
    "name": "Shift Malam Test",
    "start_time": "22:00",
    "end_time": "06:00",
    "work_hours_standard": 8,
    "schedules": [
      { "day_of_week": <today_dow>, "toleransi_telat_menit": 15 }
    ]
  }
  ```
  `is_cross_midnight` is auto-detected by backend (`end_time < start_time`).

**Simulated Time Setup (Method C):**

```bash
# Scenario A: Evening check-in at 22:05 (in ONTIME window)
docker exec presensiv2_backend date -s "2026-03-15 15:05:00"  # = 22:05 WIB

# Scenario B: Morning check-in at 03:30 (morning window = auto-ONTIME)
docker exec presensiv2_backend date -s "2026-03-15 20:30:00"  # = 03:30 WIB

# Scenario C: Morning check-in at 05:45 (still within end_time=06:00)
docker exec presensiv2_backend date -s "2026-03-15 22:45:00"  # = 05:45 WIB
```

**Expected Results:**

| Scenario | Check-in Time (WIB) | Expected Status | Reason |
|----------|---------------------|-----------------|--------|
| A | 22:05 | ONTIME | Within start + 15 min tolerance |
| A-late | 22:20 | LATE | Past 22:15 deadline |
| B | 03:30 | ONTIME | Morning window: always ONTIME |
| C | 05:45 | ONTIME | Morning window: always ONTIME |

**Notes:** Morning-window check-ins are always ONTIME by design (`_determine_status()` returns `"ONTIME"` unconditionally for `time < shift.end_time` when `is_cross_midnight`).

---

### TC-M16 — Token Refresh (Expired Access Token)

**Objective:** Verify the 401 refresh interceptor silently refreshes expired access tokens.

**Preconditions:**
- Logged in. Access token has 15-min lifetime.

**Simulated Time Setup:** Wait 16 minutes after login, or:
```bash
# Shorten token expiry for testing: set ACCESS_TOKEN_EXPIRE_MINUTES=1 in backend/.env
# Then restart: docker compose restart backend
# Wait 2 minutes after login
```

**Steps:**
1. Log in.
2. Wait for access token to expire (default: 15 min; reduced: 1–2 min).
3. Attempt any API action (e.g., navigate to History tab).

**Expected Result:**
- App seamlessly performs the action (no logout, no error visible to user).
- Axios interceptor transparently calls `POST /auth/refresh` and retries the original request.
- New access token stored in SecureStore.

---

## 6. Web Admin Test Cases

---

### TC-W01 — Login: Admin Credentials

**Objective:** Verify admin login and session restore on page reload.

**Steps:**
1. Open `http://localhost:5173`.
2. Enter `admin@presensiv2.local` / `Admin@123`.
3. Click **Masuk**.
4. After navigating to dashboard, press F5 (page reload).

**Expected Result:**
- Login succeeds → redirect to `/dashboard`.
- After reload: session restored (raw `fetch()` to `POST /auth/refresh` using sessionStorage refresh token).
- Access token is in **memory only** (not in localStorage — verify via DevTools → Application → Local Storage: should be empty).
- Refresh token in **sessionStorage** key `presensiv2_refresh_token`.

---

### TC-W02 — Dashboard: Stats Cards and Chart

**Objective:** Verify the dashboard displays correct aggregated data.

**Preconditions:** Seed data loaded (400 attendance records for Jan 1–10, 2026).

**Steps:**
1. Log in as admin.
2. Navigate to `/dashboard`.
3. Observe stats cards and attendance chart.

**Expected Result:**
- Stats cards show: Total Employees, ONTIME count, LATE count, attendance for today's date range.
- Attendance chart (7-day bar chart) shows correctly colored bars.
- No console errors.

**Time Simulation Note:** Stats are calculated from `GET /attendance/team` with today's date range. If testing on a day with no attendance records (e.g., not Jan 1–10, 2026), the dashboard will show zeros — this is correct behavior, not a bug.

---

### TC-W03 — Attendance Monitoring: Date Filter and Status

**Objective:** Verify attendance list page filters by date and shows correct status badges.

**Steps:**
1. Navigate to `/attendance`.
2. Set date range: 2026-01-01 to 2026-01-10.
3. Observe table.

**Expected Result:**
- Table shows 400 records (40 employees × 10 days).
- Status column shows ONTIME (green), LATE (amber), OUT_OF_RADIUS (red) badges.
- Check-in times displayed in each employee's site timezone (WIB/WITA/WIT) using `site_timezone` field.
- Sorting by date, employee name works.

---

### TC-W04 — Attendance Monitoring: Timezone Display Verification

**Objective:** Verify that attendance timestamps are displayed in the site's local timezone, not UTC.

**Preconditions:** Attendance records exist for multiple sites (Jakarta, Makassar, Jayapura).

**Steps:**
1. Navigate to `/attendance`.
2. Set date range covering Jan 1–10, 2026.
3. Filter or sort by site.
4. Compare timestamps across sites.

**Expected Result (for the same UTC moment `2025-01-01 00:05:00Z`):**
- SSB Jakarta record: displays **07:05 WIB** (UTC+7)
- SSB Makassar record: displays **08:05 WITA** (UTC+8)
- SSB Jayapura record: displays **09:05 WIT** (UTC+9)

**Verify:** Open browser DevTools → Network → check response of `GET /attendance/team` → `checkin_time` should be ISO UTC strings. The conversion to local timezone happens on the client via `formatTime(iso, site_timezone)`.

---

### TC-W05 — Admin Triggers Auto-Checkout

**Objective:** Verify admin can manually trigger auto-checkout via Web Admin.

**Preconditions:**
- At least one employee has an open check-in (no checkout) and their shift end time has passed.

**Simulated Time Setup:** Set server clock past 17:00 WIB, ensure open attendance exists.

**Steps:**
1. Navigate to `/attendance`.
2. Locate the **Trigger Auto-Checkout** button on the Attendance page (visible to ADMIN role only, typically in the page header or action bar). Click it.
   - If the button cannot be found in the UI, fall back to Swagger: open `http://localhost:8000/docs`, authenticate as admin, and call `POST /attendance/trigger-auto-checkout` directly.
3. Check the result.

**Expected Result:**
- Response: `{ "processed": N, "message": "..." }` where N is number of records closed.
- Previously open records now show checkout time = shift end time.
- `auto_checkout = TRUE` in those records.

---

### TC-W06 — Overtime Management: List and Detail

**Objective:** Verify overtime requests are listed and detail drawer shows correct information.

**Steps:**
1. Navigate to `/overtime`.
2. View list of overtime requests.
3. Click a request to open detail drawer.

**Expected Result:**
- List shows request ID, attendance_id, status (PENDING/APPROVED/REJECTED).
- Detail drawer fetches `GET /attendance/{attendance_id}` to show timezone-aware timestamps.
- Approve/Reject buttons functional for PENDING requests.
- **Network validation:** Open browser DevTools → **Network** tab before clicking a row. When the detail drawer opens, confirm that a request to `GET /attendance/{attendance_id}` is fired (filter by "attendance" in the Network tab). This call is how the drawer obtains `site_timezone` and attendance context for correct local-time display. If this request is absent, the drawer cannot display timezone-correct timestamps.

**Notes for Tester:** The `OvertimeRequestResponse` from `GET /overtime` does NOT include employee name or ID — only `attendance_id`. This is by design (API limitation). The name appears only in the detail drawer after fetching the linked attendance record.

---

### TC-W07 — Overtime Approval: Approve → Verify Mobile App

**Objective:** Verify overtime approval on Web Admin reflects in mobile attendance records.

**Preconditions:**
- An employee has submitted an overtime request (PENDING status).

**Steps:**
1. Web Admin: Navigate to `/overtime`, find PENDING request.
2. Click **Approve** (or open detail → Approve).
3. Mobile App: Log in as the employee, check HistoryScreen for the attendance record.

**Expected Result:**
- Web Admin: Status changes to APPROVED.
- Mobile HistoryScreen: The attendance record linked to the overtime request reflects the updated status.

---

### TC-W07b — Holiday Effect on Attendance Record

**Objective:** Verify that when an employee checks in on a date recorded in the `holidays` table, the attendance record has `is_holiday = TRUE` and all work hours are automatically counted as overtime.

**Preconditions:**
- A holiday entry exists for today's date. Insert via Swagger (`POST /shifts/holidays`) or directly:
  ```bash
  docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
    "INSERT INTO holidays (holiday_date, description, is_national)
     VALUES (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta', 'Hari Libur Nasional Test', TRUE)
     ON CONFLICT (holiday_date) DO NOTHING;"
  ```
- No attendance record exists for the test employee today.
- Server time is within the shift window.

**Simulated Time Setup:** Use Method A (shift-time alignment) or Method C (Docker clock) to ensure server time falls within an active shift on the holiday date.

**Steps:**
1. Log in as `emp101@ptssb.co.id` on the mobile app.
2. Perform check-in (TC-M03 steps).
3. Perform check-out (TC-M09 steps) after at least a few minutes.
4. Run the DB validation query below.

**Expected Result:**
- Check-in and checkout succeed normally (holidays do not block attendance).
- `attendance.is_holiday = TRUE`.
- `attendance.overtime_minutes = attendance.work_duration_minutes` (every minute worked on a holiday is overtime).
- `attendance.is_weekend` reflects the actual day of week (may be FALSE if holiday falls on a weekday).

**DB Validation:**
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT is_holiday, is_weekend, work_duration_minutes, overtime_minutes
   FROM attendance ORDER BY created_at DESC LIMIT 1;"
```

Expected output:
```
 is_holiday | is_weekend | work_duration_minutes | overtime_minutes
------------+------------+-----------------------+------------------
 t          | f          | <N>                   | <N>
```

Where `overtime_minutes = work_duration_minutes` confirms all hours are automatically overtime on a holiday.

**Cleanup:** Remove the test holiday after the test run:
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "DELETE FROM holidays WHERE description = 'Hari Libur Nasional Test';"
```

---

### TC-W08 — User Management: Create New Employee

**Objective:** Verify admin can create a new user assigned to a site.

**Steps:**
1. Navigate to `/users`.
2. Click **Tambah User**.
3. Fill form: name, email, employee_id, role=EMPLOYEE, site=SSB Jakarta, password.
4. Save.

**Expected Result:**
- User created (HTTP 201).
- User appears in the list.
- New user can log in via mobile app.
- Site and role are correctly assigned.

---

### TC-W09 — Shift Management: Create Shift with Work Schedules

**Objective:** Verify supervisor can create a new shift with day schedules.

**Preconditions:** Logged in as SUPERVISOR (`spv101@ptssb.co.id`) or ADMIN.

**Steps:**
1. Navigate to `/shifts`.
2. Select site SSB Jakarta.
3. Click **Tambah Shift**.
4. Enter: name "Shift Siang", start_time=13:00, end_time=22:00.
5. Add work schedules for Monday–Friday with tolerance 10 minutes.
6. Save.

**Expected Result:**
- Shift created with `is_cross_midnight = FALSE` (backend auto-detects since 13:00 < 22:00).
- Work schedules visible in the shift detail.
- Employees at SSB Jakarta can check-in during 13:00–22:00 shift window.

---

### TC-W10 — Reports: Date Range Validation and Export

**Objective:** Verify reports page filters data correctly and respects date range limits.

**Steps:**
1. Navigate to `/reports`.
2. Set date range: 2026-01-01 to 2026-01-10.
3. Apply optional filters (status, employee search).
4. Attempt date range > 30 days (should be rejected by client-side Zod validation).

**Expected Result:**
- Valid range: Table loads attendance data matching filters.
- >30 day range: Form validation error "Rentang maksimal 30 hari" (client-side, no API call).
- Status badges visible with correct colors.
- Download/export button (if implemented) triggers correct file download.

---

## 7. Cross-Component Integration Test Cases

---

### TC-INT01 — End-to-End Check-in Flow (Mobile → Backend → Web Admin)

**Objective:** Verify a mobile check-in appears correctly in Web Admin attendance monitoring.

**Simulated Time Setup:** Method A (create test shift matching current time).

**Steps:**
1. Mobile: Log in as `emp101@ptssb.co.id`, perform check-in (ONTIME).
2. Web Admin: Log in as admin, navigate to `/attendance`, set today's date range.
3. Locate emp101's record.

**Expected Result:**
- Record appears in Web Admin within seconds.
- Check-in time displayed in WIB (Asia/Jakarta).
- Status = ONTIME.
- GPS latitude/longitude visible in detail view.

---

### TC-INT02 — Timezone Consistency: Mobile vs Web Admin

**Objective:** Verify that the same attendance record shows identical local time on both mobile (HistoryScreen) and Web Admin (AttendancePage).

**Steps:**
1. Mobile: Perform check-in as `emp103@ptssb.co.id` (SSB Makassar, WITA).
2. Note the displayed check-in time on mobile.
3. Web Admin: View the same record in `/attendance`.

**Expected Result:**
- Both display the check-in time in WITA (UTC+8).
- Example: If UTC is `00:05:00Z`, both show **08:05 WITA**.
- The UTC value stored in DB remains `00:05:00Z` regardless of display.

---

### TC-INT03 — Auto-Checkout Visible in Mobile

**Objective:** Verify that auto-checkout triggered by backend appears in mobile HistoryScreen.

**Steps:**
1. Mobile: Perform check-in, do NOT check out.
2. Docker: Advance server clock past 17:00 WIB (shift end).
3. Wait 60 seconds for auto-checkout worker.
4. Mobile: Navigate to History tab, find today's record.

**Expected Result:**
- Checkout time shown on mobile History.
- Record shows `auto_checkout` visually (e.g., "(Auto)" label or specific UI indicator).
- Work duration minutes correct (from checkin to 17:00 WIB).

---

## 8. Test Execution Log Template

```
Test ID     : TC-M03
Date        : 2026-03-15
Tester      : [Name]
Environment : SIT — Docker (local)
Test Method : Method C (Docker clock set to 00:05 UTC)

Pre-test server time  : [docker exec presensiv2_backend date]
Pre-test DB state     : [attendance records count before test]

Steps Executed:
  1. [describe action + result]
  2. [describe action + result]
  ...

Post-test DB Validation:
  Query result: [paste output]

Result         : PASS / FAIL
Status (actual): ONTIME / LATE / OUT_OF_RADIUS
Expected status: ONTIME

Notes / Defects:
  [Any deviation from expected result]

Tester Signature: ________________
```

---

*End of SIT.md — Presensi Online SSB v2*
