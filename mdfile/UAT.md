# User Acceptance Test (UAT) — Presensi Online SSB v2

> **Version:** 1.0
> **Date:** 2026-03-15
> **Scope:** Mobile Application (Employee/Supervisor) + Web Admin Panel (Admin/Supervisor)
> **Target Testers:** Business users, HR staff, site supervisors, and selected employees

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [How Time Is Simulated in This Test](#2-how-time-is-simulated-in-this-test)
3. [Before You Start — Preparation Guide](#3-before-you-start--preparation-guide)
4. [Mobile App Scenarios — Employee](#4-mobile-app-scenarios--employee)
5. [Mobile App Scenarios — Supervisor](#5-mobile-app-scenarios--supervisor)
6. [Web Admin Scenarios — Admin / Supervisor](#6-web-admin-scenarios--admin--supervisor)
7. [Sign-Off Checklist](#7-sign-off-checklist)

---

## 1. Introduction

This UAT document guides testers through real-world usage scenarios of the **Presensi Online SSB v2** attendance system. The goal is to verify that the application works correctly **from a business perspective** — that employees can check in and check out correctly, that supervisors see their team's attendance, and that admins can manage the system.

### What We Are Testing

| Area | Who Tests |
|------|-----------|
| Employee check-in (on time, late, out of radius) | Employee testers |
| Employee face registration | Employee testers |
| Supervisor team view | Supervisor testers |
| Admin: attendance monitoring | HR/Admin staff |
| Admin: shift and schedule management | HR/Admin staff |
| Admin: overtime approval | HR/Admin staff |
| Admin: reports generation | HR/Admin staff |

### Test Accounts Provided

All passwords are **12345** unless otherwise stated.

**Mobile App (Employee/Supervisor):**

| Login Email | Role | Site | Timezone |
|-------------|------|------|----------|
| `emp101@ptssb.co.id` | Employee | SSB Jakarta | WIB (UTC+7) |
| `emp103@ptssb.co.id` | Employee | SSB Makassar | WITA (UTC+8) |
| `emp104@ptssb.co.id` | Employee | SSB Jayapura | WIT (UTC+9) |
| `spv101@ptssb.co.id` | Supervisor | SSB Jakarta | WIB (UTC+7) |
| `spv103@ptssb.co.id` | Supervisor | SSB Makassar | WITA (UTC+8) |

**Web Admin Panel:**

| Login Email | Password | Role |
|-------------|----------|------|
| `admin@presensiv2.local` | `Admin@123` | Admin (full access) |
| `spv101@ptssb.co.id` | `12345` | Supervisor |

---

## 2. How Time Is Simulated in This Test

### ⚠️ Important: The App Uses Server Time, Not Your Phone's Clock

The attendance system **records time based on the server's clock**, not your device clock. This means changing the time on your phone will NOT affect what time the server records for your attendance.

To test scenarios at different times of day without waiting, this UAT uses two techniques:

---

### Technique 1 — Pre-Configured Test Shifts

Before each time-sensitive test scenario, the test coordinator will **create a special test shift** whose start time matches the current real clock time. This allows you to perform an ONTIME check-in immediately, and a LATE check-in after waiting 16 minutes.

**Example:**
- It is currently 14:00.
- Coordinator creates "Test Shift UAT" with `start_time = 14:00`, tolerance = 15 minutes.
- You check in at 14:05 → **ONTIME**.
- You wait until 14:17, then check in → **LATE**.
- You check in at 13:55 → **"No active shift found"** (before shift starts).

---

### Technique 2 — Timezone Accounts

The three company sites use different timezones. Even at the same real-world moment, the local time at each site is different:

| Site | Timezone | Difference from Jakarta |
|------|----------|------------------------|
| SSB Jakarta | WIB (UTC+7) | — |
| SSB Makassar | WITA (UTC+8) | +1 hour |
| SSB Jayapura | WIT (UTC+9) | +2 hours |

**Example — Testing at the same moment, different states:**

Imagine the real time is **07:05 WIB** (Jakarta local time). At this exact same moment:
- SSB Jakarta employee checks in → sees **07:05** → **ONTIME** (within 15-min tolerance from 07:00)
- SSB Makassar employee checks in → sees **08:05** → **LATE** (53 minutes past shift start)
- SSB Jayapura employee checks in → sees **09:05** → **LATE** (2 hours past shift start)

This allows one tester to see ONTIME while another sees LATE — at the same clock moment.

---

### Summary: What Times to Perform Each Test

The test coordinator will prepare and announce the exact times. The table below summarizes the time windows for each scenario using the **SSB Jakarta (WIB)** account and the 07:00–17:00 shift:

| Scenario | When to Perform (Jakarta/WIB) |
|----------|-------------------------------|
| Before shift (no active shift) | Before 07:00 |
| ONTIME check-in | 07:00 → 07:15 |
| LATE check-in | 07:16 → 16:59 |
| After shift (no active shift) | After 17:00 |
| Weekend check-in | Any Saturday or Sunday |

---

## 3. Before You Start — Preparation Guide

### For the Test Coordinator

Before starting UAT, ensure the following are ready:

**Step 1 — Verify system is running:**
- Backend: `http://localhost:8000/health` should return `{"status": "ok"}` or similar.
- Web Admin: `http://localhost:5173` should show the login page.

**Step 2 — Load seed data (if not already done):**
```bash
docker exec presensiv2_backend python seed.py
```

**Step 3 — Create test shifts aligned to UAT schedule:**
Using Swagger at `http://localhost:8000/docs`, log in as admin and create temporary test shifts for each time-sensitive scenario. Set `start_time` = the scheduled test time and `toleransi_telat_menit = 15`.

**Step 4 — Prepare face registration for test accounts:**
- If emp101/emp103/emp104 do not yet have face embeddings, instruct them to complete TC-UAT-M03 (face registration) first.

**Step 5 — Distribute test coordinates for GPS simulation:**
- For testers using physical devices at a different location than the site, provide GPS mock coordinates (see Section 4, Scenario 4).
- Recommended: use Android Developer Mode → Mock Location app to simulate being at the site.

**Step 6 — Clear any existing today's attendance records for clean testing:**
> Only do this if testers have already checked in today and need a clean slate.
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "DELETE FROM attendance WHERE user_id IN (
     SELECT id FROM users WHERE email LIKE '%@ptssb.co.id'
   ) AND checkin_time >= NOW() - INTERVAL '24 hours';"
```

---

### For Testers (Mobile App)

1. Install the app on your Android device using Expo Go or the provided APK.
2. Make sure your device is connected to the same Wi-Fi as the server.
3. The app URL is set to the server IP provided by the coordinator.
4. Ensure location permission and camera permission are granted to the app.
5. Use the test account assigned to you.

### For Testers (Web Admin)

1. Open a browser (Chrome recommended).
2. Navigate to `http://localhost:5173` or the URL provided by coordinator.
3. Log in with the admin or supervisor credentials provided.

---

## 4. Mobile App Scenarios — Employee

---

### UAT-M01 — Employee Login

**Objective:** I can log in to the app with my employee credentials.

**Preconditions:** App installed, connected to network.

**Simulated Time Setup:** None required.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open the Presensi app | Splash screen appears, then Login screen |
| 2 | Enter email: `emp101@ptssb.co.id` | Email field filled |
| 3 | Enter password: `12345` | Password field filled (hidden) |
| 4 | Tap **Masuk** | Loading indicator appears |
| 5 | Wait for response | Home screen appears |

**Expected Result:**
- ✅ Home screen shows my name, site name (SSB Jakarta), and today's date in WIB.
- ✅ Bottom navigation shows: **Beranda**, **Riwayat**, **Lembur**, **Profil** (4 tabs — no Team tab for employees).
- ✅ No error messages.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M02 — Login with Wrong Password

**Objective:** I cannot log in with an incorrect password, and the system prevents brute force.

**Simulated Time Setup:** None required.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Enter email: `emp101@ptssb.co.id`, password: `salahpassword` | — |
| 2 | Tap **Masuk** | Error message: "Email atau password salah" |
| 3 | Repeat 4 more times | Error each time |
| 4 | Attempt 5th time | Account locked message appears |

**Expected Result:**
- ✅ Error shown for wrong password.
- ✅ After 5 failed attempts, account is locked for 30 minutes.
- ✅ Valid credentials during lock period → error "Account is locked".

> **After this test:** Inform the test coordinator to unlock the account before proceeding.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M03 — Face Registration

**Objective:** I can register my face so that the system can verify me during check-in.

**Preconditions:** Logged in, no face registered yet (or face cleared by coordinator).

**Simulated Time Setup:** None required.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Profil** tab | Profile screen shows face status "Belum Terdaftar" |
| 2 | Tap **Daftarkan Wajah** | Camera opens inside the modal |
| 3 | Position face in frame, tap camera button | Photo captured, review step appears |
| 4 | Check the photo is clear (face visible, well lit) | Preview shown |
| 5 | Tap **Konfirmasi Upload** | Upload progress, then result |

**Expected Result:**
- ✅ "Wajah berhasil didaftarkan" or success notification.
- ✅ Profile screen now shows "Wajah Terdaftar" badge.
- ✅ Only 1 face detected in the photo (multi-face → rejected with error).

**Troubleshooting:**
- If error "No face detected": improve lighting, face the camera directly.
- If error "Multiple faces detected": ensure only one person is in frame.
- If upload fails: check network connection; app shows error toast.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M04 — ONTIME Check-in (At the Right Time, At the Right Place)

**Objective:** I can check in and receive ONTIME status when I check in within the tolerance window, at the correct location.

**Preconditions:**
- Face registered (UAT-M03 completed).
- No attendance record for today.
- Server time is within the ONTIME window (coordinator confirms).
- GPS is at or near the site location (mock GPS or physical presence).

**Simulated Time Setup:**
> 📢 **Coordinator:** Before this test, set test shift start_time = [scheduled start time, e.g., 10:00]. Announce the ONTIME window (10:00–10:15) and LATE cutoff (10:16+) to testers. Testers perform this scenario within the announced window.

**GPS Setup (if testing remotely):**
- Enable Developer Mode on Android: Settings → About Phone → tap Build Number 7 times.
- Install "Fake GPS Location" app.
- Set fake GPS to SSB Jakarta: Latitude **-6.200000**, Longitude **106.816666**.
- In Android Developer Options, set "Mock Location App" to Fake GPS.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open Home screen | Today's date shown, check-in button visible |
| 2 | Tap **Absen Masuk** | Check-in modal opens |
| 3 | Point camera at your face | Camera preview appears |
| 4 | Tap camera button to capture | Photo taken |
| 5 | Wait for face verification | "Wajah dikenali" or verification progress |
| 6 | App requests location | Location indicator active |
| 7 | Check-in submitted automatically | Success message appears |

**Expected Result:**
- ✅ Check-in recorded with status **ONTIME**.
- ✅ Home screen shows check-in time in correct local timezone (WIB for Jakarta).
- ✅ Check-in button changes to "Sudah Absen Masuk" or shows time.
- ✅ **Absen Pulang** button becomes active.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M05 — LATE Check-in (After Tolerance Window)

**Objective:** I receive LATE status when I check in after the tolerance deadline.

**Preconditions:**
- Face registered.
- No attendance for today.
- Server time is AFTER tolerance deadline (coordinator confirms cutoff time + 1 minute).

**Simulated Time Setup:**
> 📢 **Coordinator:** Wait until 16 minutes after shift start (e.g., if shift starts at 10:00, wait until 10:16). Announce "Now testing LATE scenario."

**Steps:** Same as UAT-M04.

**Expected Result:**
- ✅ Check-in recorded with status **LATE**.
- ✅ History screen shows LATE badge (amber/orange) for this record.
- ✅ Home screen still shows check-in time correctly in local timezone.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M06 — Check-in Outside Working Hours (No Active Shift)

**Objective:** The system prevents check-in when no shift is active (before shift starts or after shift ends).

**Preconditions:**
- No attendance for today.
- Server time is BEFORE shift start time or AFTER shift end time.

**Simulated Time Setup:**
> 📢 **Coordinator:** Set the test shift end time to the current time (so shift has just ended), or use a shift that starts 30 minutes from now (so shift hasn't started yet). Announce the test.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Tap **Absen Masuk** on Home screen | Check-in modal opens |
| 2 | Take face photo | Verification attempt |
| 3 | Wait for result | Error message |

**Expected Result:**
- ✅ Error shown: "Tidak ada shift aktif" (No active shift found).
- ✅ Check-in is NOT recorded.
- ✅ Database: no new attendance record for this user today.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M07 — Check-in Outside Radius (OUT_OF_RADIUS)

**Objective:** The system records my check-in but marks it as OUT_OF_RADIUS when I am too far from the site.

**Preconditions:**
- Face registered.
- No attendance for today.
- Server time within shift window.
- GPS is set to a location MORE than 100 meters from the site center.

**GPS Setup — Out-of-Radius Position (SSB Jakarta):**
Set mock GPS to: Latitude **-6.201500**, Longitude **106.816666**
(approximately 167 meters from site center — outside 100m radius)

**Simulated Time Setup:** Server time within shift window (coordinator confirms).

**Steps:** Same as UAT-M04, but using the out-of-radius GPS coordinates.

**Expected Result:**
- ✅ Check-in IS recorded (not rejected — the system still logs the attempt).
- ✅ Status shows **OUT_OF_RADIUS** (shown in red or distinct badge in History).
- ✅ No error message preventing completion — check-in proceeds.

> **Business note to testers:** OUT_OF_RADIUS check-in is ALLOWED but flagged. The HR/Admin team reviews these records and takes appropriate action. The app does not block the attendance.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M08 — Double Check-in Prevention

**Objective:** I cannot check in twice on the same work day.

**Preconditions:** Already checked in today (UAT-M04 or UAT-M05 completed).

**Simulated Time Setup:** Server time still within shift window.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Tap **Absen Masuk** again | Modal opens |
| 2 | Take face photo | Verification attempt |
| 3 | Wait for result | Error message |

**Expected Result:**
- ✅ Error: "Already checked in today at [HH:MM:SS]" (showing today's first check-in time).
- ✅ No duplicate attendance record created.
- ✅ App remains on Home screen with original check-in time visible.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M09 — Check-out (Absen Pulang)

**Objective:** I can check out and the system records my work duration correctly.

**Preconditions:** Checked in today (UAT-M04). No checkout yet.

**Simulated Time Setup:**
> 📢 **Coordinator:** Announce checkout test time. Verify that the server time is after the check-in time.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Home screen shows check-in time and **Absen Pulang** button | Visible |
| 2 | Tap **Absen Pulang** | Checkout modal/confirmation opens |
| 3 | Allow location (optional) | GPS captured |
| 4 | Confirm checkout | Success message |

**Expected Result:**
- ✅ Checkout time displayed on Home screen.
- ✅ **Absen Pulang** button disabled/hidden after successful checkout.
- ✅ History screen shows check-in time, checkout time, and work duration.
- ✅ Work duration = time between check-in and check-out (in minutes).

**Verify Work Duration:**
> Example: Checked in at 10:05, checked out at 12:30 → work duration should be **145 minutes (2h 25m)**.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M10 — Attendance History (Riwayat)

**Objective:** I can view my past attendance records with correct timestamps per timezone.

**Preconditions:** User has existing attendance records (seed data: January 2026).

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Tap **Riwayat** tab | History screen opens, showing current month |
| 2 | Swipe or use month chip to navigate to **Januari 2026** | January records load |
| 3 | Scroll through records | Records visible |
| 4 | Tap a record for details | Detail expands/opens |

**Expected Result:**
- ✅ Records show correct date, check-in time, checkout time, status.
- ✅ Timestamps displayed in **WIB** for Jakarta employee (not UTC).
- ✅ Status badges: ONTIME (green), LATE (amber), OUT_OF_RADIUS (red).
- ✅ Weekend records (Jan 3 Sat, Jan 4 Sun) marked as weekend.

**Cross-Timezone Check:**
Log in as `emp103@ptssb.co.id` (Makassar/WITA) and check the same month. Times should display in **WITA** (UTC+8), one hour ahead of Jakarta records.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M11 — Offline Detection

**Objective:** The app clearly indicates when there is no internet connection and prevents attendance actions.

**Preconditions:** Logged in, on Home screen.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | On Home screen, disable Wi-Fi and mobile data on device | — |
| 2 | Observe the app | Red offline banner appears at top |
| 3 | Try to tap **Absen Masuk** | Button is disabled (grayed out) |
| 4 | Re-enable Wi-Fi | Red banner disappears |
| 5 | Try **Absen Masuk** again | Button is enabled, flow proceeds normally |

**Expected Result:**
- ✅ Offline banner appears immediately when network is lost.
- ✅ Check-in/check-out buttons are disabled when offline.
- ✅ Banner disappears when connection is restored.
- ✅ No crashes or frozen states.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M12 — Weekend Check-in (Kehadiran Akhir Pekan)

**Objective:** The system accepts check-in on weekends and marks work hours as overtime.

**Preconditions:**
- Test is performed on a Saturday or Sunday (real or simulated by coordinator via server clock).
- Face registered.

**Simulated Time Setup:**
> 📢 **Coordinator:** If testing on a weekday, use Method C (Docker server clock) to set server date to a Saturday within shift window. Or schedule this test for Saturday.

**Steps:** Same as UAT-M04 (ONTIME check-in), then UAT-M09 (checkout).

**Expected Result:**
- ✅ Check-in succeeds with `is_weekend = TRUE`.
- ✅ History record shows weekend indicator.
- ✅ After checkout: work duration = overtime duration (all hours counted as overtime).

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

## 5. Mobile App Scenarios — Supervisor

---

### UAT-M13 — Supervisor Login and Team Tab

**Objective:** A supervisor sees the Team tab and can view subordinate attendance.

**Preconditions:** Logged in as `spv101@ptssb.co.id` (12345).

**Simulated Time Setup:** None required.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as spv101 | Home screen |
| 2 | Check bottom navigation | 5 tabs visible: Beranda, Riwayat, Lembur, **Tim**, Profil |
| 3 | Tap **Tim** tab | Team attendance screen opens |
| 4 | Navigate to January 2026 using left/right arrows | January records load |
| 5 | Find an employee card and expand it | Attendance details visible |

**Expected Result:**
- ✅ **Tim** tab visible (not visible for employees — verify with emp101 account).
- ✅ Shows only spv101's subordinates (EMP101, EMP106–EMP112 = 8 employees).
- ✅ Each record shows date, check-in/out time in WIB, status badge.
- ✅ Timestamps use **WIB** timezone correctly (Intl.DateTimeFormat with Asia/Jakarta).

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-M14 — Cross-Timezone Team View (Multi-Site Supervisor)

**Objective:** A supervisor at Makassar site sees team timestamps in WITA correctly.

**Preconditions:** Logged in as `spv103@ptssb.co.id` (Makassar/WITA supervisor).

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as spv103 | Home screen (SSB Makassar site) |
| 2 | Navigate to Tim tab → January 2026 | Team records load |
| 3 | Check timestamps on records | Times should be in WITA (UTC+8) |

**Expected Result:**
- ✅ The same attendance record that shows 07:05 for Jakarta employees shows **08:05** for Makassar employees (1-hour difference).
- ✅ "WITA" or "+08:00" visible in timestamp display.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

## 6. Web Admin Scenarios — Admin / Supervisor

---

### UAT-W01 — Admin Login and Session Restore

**Objective:** Admin can log in, and the session is maintained after browser page reload.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open `http://localhost:5173` | Login page appears |
| 2 | Enter `admin@presensiv2.local` / `Admin@123` | — |
| 3 | Click **Masuk** | Dashboard opens |
| 4 | Press **F5** (page reload) | Page reloads |

**Expected Result:**
- ✅ After reload: admin remains logged in (session restored automatically).
- ✅ Dashboard loads with data.
- ✅ **Security check:** Open DevTools (F12) → Application → Local Storage. It should be **empty** — the access token is NOT stored in localStorage.
- ✅ DevTools → Application → Session Storage should contain `presensiv2_refresh_token` key.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W02 — Session Ends When Browser Tab is Closed

**Objective:** Closing the browser tab automatically invalidates the session.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as admin | Dashboard visible |
| 2 | Close the browser tab (not just minimize) | Tab closed |
| 3 | Open a new browser tab | — |
| 4 | Navigate to `http://localhost:5173` | Login page shown |

**Expected Result:**
- ✅ After closing the tab, re-opening the URL shows the Login page (not dashboard).
- ✅ Session is cleared because refresh token was in sessionStorage (auto-cleared on tab close).

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W03 — Dashboard: Summary Statistics

**Objective:** The dashboard shows correct attendance summary for today.

**Simulated Time Setup:**
> 📢 **Coordinator:** To see a non-zero dashboard, perform several mobile check-ins (TC-M04, TC-M05) before running this test. Or use the date range for January 2026.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as admin | — |
| 2 | Navigate to Dashboard | Stats cards visible |
| 3 | Observe "Total Karyawan", ONTIME count, LATE count cards | Values shown |
| 4 | View the attendance chart (7-day bar chart) | Chart renders |

**Expected Result:**
- ✅ Stats cards show meaningful data.
- ✅ Attendance chart shows bars for recent days.
- ✅ No loading errors or blank charts.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W04 — Attendance Monitoring: View and Filter

**Objective:** Admin can view all employee attendance and filter by date, employee, and status.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Kehadiran** (/attendance) | Attendance table opens |
| 2 | Set date range: 2026-01-01 to 2026-01-10 | Table loads 400 records |
| 3 | Filter by status: LATE | Only LATE records shown |
| 4 | Search by employee name or ID | Filtered results |
| 5 | Click a record row | Detail view opens |

**Expected Result:**
- ✅ Table shows employee name, site, check-in/out time, status, duration.
- ✅ Timestamps shown in each employee's site timezone (WIB/WITA/WIT).
- ✅ Status filter works correctly.
- ✅ Detail shows GPS latitude/longitude and auto-checkout flag.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W05 — Attendance: Verify Timezone Correct Display

**Objective:** The same attendance record shows the correct local time for each site timezone.

**Preconditions:** Attendance records exist for Jakarta, Makassar, and Jayapura employees.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to Kehadiran | — |
| 2 | Set date range to Jan 1–10, 2026 | All site records visible |
| 3 | Find a Jakarta employee record | Note check-in time |
| 4 | Find a Makassar employee record with a similar UTC timestamp | Note check-in time |

**Expected Result:**
- ✅ Jakarta record: check-in time in **WIB** (e.g., "07:05 WIB")
- ✅ Makassar record: check-in time in **WITA** (e.g., "08:05 WITA") — **one hour ahead**
- ✅ Jayapura record: check-in time in **WIT** (e.g., "09:05 WIT") — **two hours ahead**

**Why this matters:** All timestamps are stored in UTC in the database. The application converts them to each site's timezone for display. If this is wrong, employees would see incorrect times.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W06 — Shift Management: Create New Shift

**Objective:** Admin/Supervisor can create a new work shift with daily schedules.

**Preconditions:** Logged in as admin or supervisor.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Jadwal Shift** (/shifts) | Shift list for selected site |
| 2 | Select site: SSB Jakarta | SSB Jakarta shifts shown |
| 3 | Click **Tambah Shift** | Create shift form opens |
| 4 | Enter: Name = "Shift Siang", Start = 13:00, End = 21:00 | — |
| 5 | Add schedule for Monday–Friday, tolerance = 10 minutes | — |
| 6 | Click **Simpan** | — |

**Expected Result:**
- ✅ Shift created successfully.
- ✅ Shift appears in the list with correct start/end times.
- ✅ Cross-midnight flag: NOT cross-midnight (13:00 < 21:00 is normal).
- ✅ An employee at SSB Jakarta can now check-in during 13:00–21:00 on weekdays.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W07 — Shift Management: Create Cross-Midnight Shift

**Objective:** Admin can create a night shift that crosses midnight.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Jadwal Shift**, select SSB Makassar | — |
| 2 | Click **Tambah Shift** | — |
| 3 | Enter: Name = "Shift Malam", Start = **22:00**, End = **06:00** | End < Start signals cross-midnight |
| 4 | Add schedule for Monday–Friday, tolerance = 15 minutes | — |
| 5 | Click **Simpan** | — |

**Expected Result:**
- ✅ Shift created with `is_cross_midnight = TRUE` (auto-detected by backend because end < start).
- ✅ Shift appears with night shift indicator.
- ✅ Employee can check in from 22:00 WITA through 06:00 WITA next morning.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W08 — Holiday Management

**Objective:** Admin can add a national holiday, which affects attendance records.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Hari Libur** (/holidays) | Holiday list visible |
| 2 | Click **Tambah Hari Libur** | Create form opens |
| 3 | Enter date: 2026-04-14, description: "Hari Raya Idul Fitri", is_national: Yes | — |
| 4 | Click **Simpan** | — |

**Expected Result:**
- ✅ Holiday appears in list with date and description.
- ✅ Any attendance on 2026-04-14 will have `is_holiday = TRUE`.
- ✅ Work hours on that day are automatically counted as overtime.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W09 — Overtime Request: View and Approve

**Objective:** Admin/Supervisor can review and approve overtime requests.

**Preconditions:** At least one PENDING overtime request exists.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Lembur** (/overtime) | Overtime list shows requests |
| 2 | Find a PENDING request | Status shown as PENDING |
| 3 | Click the request row | Detail drawer/panel opens |
| 4 | Review overtime period and attendance details | Information visible |
| 5 | Click **Setujui** (Approve) | Confirmation prompt |
| 6 | Confirm | Status changes to APPROVED |

**Expected Result:**
- ✅ Status changes from PENDING → APPROVED.
- ✅ `approved_by` is set to the current admin's user ID.
- ✅ The employee's attendance record is updated.

**Reject Test:**
Repeat with a different PENDING request, click **Tolak** (Reject). Expected: Status changes to REJECTED.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W10 — Reports: Generate Attendance Report

**Objective:** Admin can generate an attendance report for a specified date range.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Laporan** (/reports) | Report filter form visible |
| 2 | Set **Dari Tanggal**: 2026-01-01, **Sampai**: 2026-01-10 | — |
| 3 | Click **Cari / Tampilkan** | Report table loads |
| 4 | Optionally filter by employee name | Filtered results |
| 5 | Optionally filter by status (LATE) | Only LATE records |
| 6 | Try setting range > 30 days | Validation error shown |

**Expected Result:**
- ✅ Report shows correct attendance data for the date range.
- ✅ Timestamps in correct timezone per site.
- ✅ Summary stats visible (total ONTIME, LATE, OUT_OF_RADIUS).
- ✅ Date range validation: > 30 days shows error "Rentang maksimal 30 hari" without making an API call.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W11 — User Management: Create and Assign Employee

**Objective:** Admin can create a new employee account and assign them to a site.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Navigate to **Pengguna** (/users) | User list visible |
| 2 | Click **Tambah Pengguna** | Create form |
| 3 | Fill in: name, email, employee_id, role=EMPLOYEE, site=SSB Jakarta, password | — |
| 4 | Click **Simpan** | — |
| 5 | Find the new user in the list | Visible |
| 6 | Click the user → Edit → change their supervisor assignment | — |

**Expected Result:**
- ✅ New user created and appears in list.
- ✅ New user can log in to mobile app immediately.
- ✅ Supervisor assignment updates correctly.

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

### UAT-W12 — Supervisor Role: Limited Access

**Objective:** A supervisor can only access what their role permits.

**Steps:**

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as `spv101@ptssb.co.id` / `12345` | Dashboard visible |
| 2 | Try to navigate to `/users` (User Management) | Access denied or redirected |
| 3 | Try to navigate to `/sites` (Site Management) | Access denied or redirected |
| 4 | Navigate to `/shifts` | Accessible (supervisor can manage shifts) |
| 5 | Navigate to `/attendance` | Accessible (sees only their subordinates' data) |
| 6 | Navigate to `/overtime` | Accessible (can approve/reject) |

**Expected Result:**
- ✅ `/users` and `/sites`: redirected to dashboard or access denied message.
- ✅ `/shifts`, `/attendance`, `/overtime`: accessible.
- ✅ Attendance list shows only spv101's subordinates (not all company employees).

**Result:** ☐ PASS &nbsp;&nbsp; ☐ FAIL

**Tester Notes:**
___________________________________________

---

## 7. Sign-Off Checklist

### UAT Completion Summary

| Scenario | Tester Name | Date | Result |
|----------|-------------|------|--------|
| UAT-M01 Login | | | ☐ Pass ☐ Fail |
| UAT-M02 Wrong Password | | | ☐ Pass ☐ Fail |
| UAT-M03 Face Registration | | | ☐ Pass ☐ Fail |
| UAT-M04 ONTIME Check-in | | | ☐ Pass ☐ Fail |
| UAT-M05 LATE Check-in | | | ☐ Pass ☐ Fail |
| UAT-M06 Outside Hours | | | ☐ Pass ☐ Fail |
| UAT-M07 OUT_OF_RADIUS | | | ☐ Pass ☐ Fail |
| UAT-M08 Double Check-in | | | ☐ Pass ☐ Fail |
| UAT-M09 Check-out | | | ☐ Pass ☐ Fail |
| UAT-M10 Attendance History | | | ☐ Pass ☐ Fail |
| UAT-M11 Offline Detection | | | ☐ Pass ☐ Fail |
| UAT-M12 Weekend Check-in | | | ☐ Pass ☐ Fail |
| UAT-M13 Supervisor Team Tab | | | ☐ Pass ☐ Fail |
| UAT-M14 Cross-Timezone Team | | | ☐ Pass ☐ Fail |
| UAT-W01 Admin Login + Restore | | | ☐ Pass ☐ Fail |
| UAT-W02 Session Expires on Close | | | ☐ Pass ☐ Fail |
| UAT-W03 Dashboard Stats | | | ☐ Pass ☐ Fail |
| UAT-W04 Attendance Filter | | | ☐ Pass ☐ Fail |
| UAT-W05 Timezone Display | | | ☐ Pass ☐ Fail |
| UAT-W06 Create Shift | | | ☐ Pass ☐ Fail |
| UAT-W07 Cross-Midnight Shift | | | ☐ Pass ☐ Fail |
| UAT-W08 Holiday Management | | | ☐ Pass ☐ Fail |
| UAT-W09 Overtime Approve | | | ☐ Pass ☐ Fail |
| UAT-W10 Reports | | | ☐ Pass ☐ Fail |
| UAT-W11 Create Employee | | | ☐ Pass ☐ Fail |
| UAT-W12 Supervisor Role Limits | | | ☐ Pass ☐ Fail |

---

### Overall UAT Decision

| Decision | Signature | Date |
|----------|-----------|------|
| ☐ **ACCEPTED** — System meets requirements, ready for production | | |
| ☐ **CONDITIONALLY ACCEPTED** — Minor issues noted, acceptable with fix plan | | |
| ☐ **REJECTED** — Critical issues found, re-test required after fix | | |

---

### Open Issues / Defects Found During UAT

| # | Scenario | Description | Severity (High/Med/Low) | Status |
|---|----------|-------------|------------------------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

### UAT Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Business Owner / Requester | | | |
| IT Project Manager | | | |
| QA Lead | | | |
| HR Representative | | | |

---

*End of UAT.md — Presensi Online SSB v2*
