# Overtime Feature — Local Testing Guide

## Prerequisites

- Backend running: `docker compose up -d`
- Backend seeded: `docker exec presensiv2_backend python seed.py`
- Migration applied (on existing DB): run `migration_ot_notes.sql` (see below)
- Mobile: `cd mobile && npx expo start --clear`
- Swagger UI: http://localhost:8000/docs

---

## 1. Applying the Migration (Existing Database)

Run once on any DB initialized before this feature:

```bash
docker cp backend/migration_ot_notes.sql presensiv2_db:/tmp/
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -f /tmp/migration_ot_notes.sql
```

Verify:
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 \
  -c "\d overtime_requests"
# Should show: notes | character varying(500) | nullable
```

---

## 2. Test Accounts

| Account | Password | Role | Site |
|---------|----------|------|------|
| `spv101@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jakarta (WIB, UTC+7) |
| `emp101@ptssb.co.id` | `12345` | EMPLOYEE | SSB Jakarta (WIB, UTC+7) |
| `spv103@ptssb.co.id` | `12345` | SUPERVISOR | SSB Makassar (WITA, UTC+8) |

EMP101 has 10 attendance records (Jan 1–10 2026), all checked out, weekdays — eligible for overtime requests.

---

## 3. How the OvertimeScreen UI Works

The **Lembur** tab (3rd bottom tab) has:

- **"Pengajuan Saya"** tab — your own requests
- **"Tim"** tab — visible to SUPERVISOR/ADMIN; shows subordinates' requests with Approve/Reject buttons
- **Filter chips** — Semua / Menunggu / Disetujui / Ditolak
- **FAB (+)** button — opens SubmitModal

### SubmitModal

1. Calendar (only today and future dates are selectable — past dates greyed out)
2. After selecting a date: Time Stepper for **Jam Mulai** and **Jam Selesai** (5-minute increments)
3. If end time < start time → cross-midnight warning appears automatically
4. Optional **Catatan** text input
5. Tap **Kirim Pengajuan** — payload sent to `POST /overtime` (no `attendance_id` needed; backend resolves it from the user + date)

### OvertimeCard Status Banners

Each card shows a contextual banner based on current time vs. approved window:

| Condition | Banner |
|-----------|--------|
| `PENDING` | 🟡 "Menunggu persetujuan atasan — belum dapat memulai lembur" |
| `REJECTED` | 🔴 "Pengajuan ditolak — tidak dapat memulai lembur" |
| `APPROVED` + now < start | 🔵 "Disetujui · Dapat dimulai: HH:MM" |
| `APPROVED` + now between start–end | 🟢 "Sedang berlangsung · Berakhir: HH:MM" |
| `APPROVED` + now > end | ⬜ "Lembur telah selesai" |

---

## 4. Full Overtime Flow — Mobile

### As Employee (EMP101)

1. Login as `emp101@ptssb.co.id`
2. Tap **Lembur** tab → **Pengajuan Saya**
3. Tap **+** FAB → SubmitModal opens
4. Tap a **future date** on the calendar (e.g., today's date)
5. Set **Jam Mulai** = 17:00, **Jam Selesai** = 20:00
6. Optionally add Catatan, tap **Kirim Pengajuan**
7. Card appears under "Menunggu" chip with yellow banner

### As Supervisor (SPV101) — Approve

1. Logout, login as `spv101@ptssb.co.id`
2. Tap **Lembur** → **Tim** tab (default filter: Menunggu)
3. EMP101's request is visible; tap **Setujui** → ApproveModal opens
4. Optionally tick "Ubah jam lembur yang disetujui" to override the time range
5. Add optional Catatan, tap **Setujui**
6. Card moves to "Disetujui" status on EMP101's screen

### As Supervisor (SPV101) — Reject

- On the **Tim** tab, tap **Tolak** on a PENDING card
- Enter optional reason, tap **Tolak Pengajuan**
- Card status changes to "Ditolak" (red banner on employee's screen)

---

## 5. Full Overtime Flow — Swagger

### Step 1 — Get an eligible attendance ID for EMP101

Login as `emp101@ptssb.co.id` → **Authorize**, then:

```
GET /attendance/me?limit=10
```

Pick a record where:
- `checkout_time` is not null
- `is_weekend = false`
- `is_holiday = false`

Note the `id` (e.g., `id: 5`).

### Step 2 — Submit overtime request

Still as EMP101:

```
POST /overtime
{
  "attendance_id": 5,
  "requested_start": "2026-01-02T10:00:00Z",
  "requested_end": "2026-01-02T13:00:00Z"
}
```

Expected: `201 Created`, `status: "PENDING"`.

### Step 3 — Approve with time override

Login as `spv101@ptssb.co.id`, then:

```
PATCH /overtime/{id}/approve
{
  "notes": "Disetujui sesuai kebutuhan proyek",
  "approved_start": "2026-01-02T10:00:00Z",
  "approved_end": "2026-01-02T12:00:00Z"
}
```

Expected:
- `status: "APPROVED"`
- `requested_minutes: 120` (2 hours, after override)
- Attendance record `overtime_minutes` updated to 120

```
GET /attendance/{attendance_id}
# Verify: overtime_minutes == 120
```

### Step 4 — Reject with notes

Create another OT request (different attendance), then as SPV101:

```
PATCH /overtime/{id}/reject
{
  "notes": "Tidak ada kebutuhan lembur hari ini"
}
```

Expected: `status: "REJECTED"`, `notes` set.

---

## 6. Testing Auto-Checkout Behavior

The auto-checkout background worker runs every **60 seconds**. It closes any approved overtime session when `requested_end` has passed.

### What it verifies
- `checkout_time` is set on the attendance record
- `auto_checkout = true`
- `work_duration_minutes` is populated

---

### Option A — Real-time test (recommended, ~2 minutes)

**Goal:** Approve an OT with end time ~2 minutes in the future and watch auto-checkout fire.

**Step 1 — Find today's active attendance for EMP101**

```bash
# Check if EMP101 has a checkin today (no checkout yet)
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT id, checkin_time, checkout_time FROM attendance \
   WHERE user_id = (SELECT id FROM users WHERE email='emp101@ptssb.co.id') \
   ORDER BY checkin_time DESC LIMIT 5;"
```

If none, create one via mobile app (checkin as EMP101) or via Swagger:
```
POST /attendance/checkin
```

**Step 2 — Submit OT request ending ~2 minutes from now**

Calculate 2 minutes from now in UTC (WIB = UTC+7, so current UTC = current WIB - 7 hours):

```
POST /overtime
{
  "attendance_id": <id>,
  "requested_start": "<now_utc>",
  "requested_end": "<now_utc + 2 minutes>"
}
```

Example (if current UTC time is 08:00):
```
{
  "attendance_id": 5,
  "requested_start": "2026-03-15T08:00:00Z",
  "requested_end": "2026-03-15T08:02:00Z"
}
```

**Step 3 — Approve immediately as SPV101**

```
PATCH /overtime/{id}/approve
{}
```

**Step 4 — Watch the logs**

```bash
docker logs presensiv2_backend -f
```

Within 60 seconds after `requested_end` passes, you should see:
```
[auto-checkout] OT-end: 1 record(s).
```

**Step 5 — Verify**

```
GET /attendance/{attendance_id}
```
Check:
- `checkout_time` is now set (matches roughly the `requested_end` time)
- `auto_checkout: true`
- `work_duration_minutes` is populated

---

### Option B — Force via DB manipulation (dev only, instant)

Use this when you don't want to wait for a real-time test.

```bash
# 1. Create an approved OT request (via Swagger as above)

# 2. Backdate the requested_end to 1 minute ago
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "UPDATE overtime_requests \
   SET requested_end = NOW() - INTERVAL '1 minute' \
   WHERE id = <ot_id> AND status = 'APPROVED';"

# 3. Watch logs — worker fires within 60s
docker logs presensiv2_backend -f
# Expect: [auto-checkout] OT-end: 1 record(s).

# 4. Verify attendance record
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "SELECT id, checkout_time, auto_checkout, work_duration_minutes \
   FROM attendance WHERE id = <attendance_id>;"
```

---

### Option C — Trigger the manual endpoint (ADMIN only)

```
POST /attendance/trigger-auto-checkout
```

This fires the same worker on demand. Login as `admin@presensiv2.local` (password: `Admin@123`) in Swagger to call it.

---

## 7. Verifying Status Banners After Approval

On the mobile **Lembur** screen, the card banner changes in real-time based on `new Date()` vs the approved window:

| Test scenario | Expected banner |
|---------------|----------------|
| Just submitted, not yet approved | 🟡 "Menunggu persetujuan atasan" |
| Approved, current time < start | 🔵 "Disetujui · Dapat dimulai: HH:MM" |
| Approved, current time between start–end | 🟢 "Sedang berlangsung · Berakhir: HH:MM" |
| Approved, current time > end (or auto-checkout fired) | ⬜ "Lembur telah selesai" |

To force the banner to change without waiting: **pull-to-refresh** on the list. React Query refetches and re-renders the card with updated status.

---

## 8. Testing Cross-Midnight Overtime

### Request body (UTC values for WIB = UTC+7):
- Start: `2026-01-03T10:00:00Z` = 17:00 WIB Jan 3
- End: `2026-01-03T19:00:00Z` = 02:00 WIB Jan 4

```
POST /overtime
{
  "attendance_id": <id>,
  "requested_start": "2026-01-03T10:00:00Z",
  "requested_end": "2026-01-03T19:00:00Z"
}
```

**In the mobile app:**
- Select **Jan 3** on calendar
- Set Jam Mulai = 17:00, Jam Selesai = 02:00
- Cross-midnight warning appears automatically: "Lembur melewati tengah malam — selesai pada hari berikutnya"

The card also shows "(lintas tengah malam)" label and the time range formatted as:
`17:00 — 4 Jan 2026 02:00`

---

## 9. Testing Supervisor Submitting Their Own Overtime

SPV101 can also submit their own overtime:

1. Login as `spv101@ptssb.co.id`
2. Tap **Lembur** → **Pengajuan Saya** → **+** FAB
3. Submit a request — appears under their own "Menunggu" chip
4. Another supervisor or ADMIN must approve it

---

## 10. Test Data Summary

All attendance records from `seed.py` (EMP101–EMP140, Jan 1–10 2026):

| Record Type | Eligible for OT Request? |
|-------------|--------------------------|
| Weekday, normal checkout | ✅ Yes |
| Weekday, `auto_checkout=true` | ❌ No |
| Weekend (`is_weekend=true`) | ❌ No |
| Holiday (`is_holiday=true`) | ❌ No |

Use attendance records with `status = 'ONTIME'` or `'LATE'` on weekdays for clean test scenarios.
