# Backend Documentation — Presensi Online SSB v2

> **Stack:** FastAPI · PostgreSQL + pgvector · SQLAlchemy 2.0 (async) · InsightFace · Docker
> **Current phase:** 5 of 7

---

## Overview

Presensi Online SSB v2 is a GPS- and face-recognition-based attendance management system.
The backend is a FastAPI application that exposes a JSON REST API consumed by a React Native mobile client.

Core capabilities delivered across phases 1–5:

| Phase | Feature |
|-------|---------|
| 1 | JWT authentication, role-based access, account locking, audit logging |
| 2 | Site & shift management, work schedules, holiday calendar |
| 3 | Face registration & verification (InsightFace `buffalo_s`, pgvector) |
| 4 | Check-in / check-out engine (Haversine GPS, shift matching, auto-checkout) |
| 5 | Overtime engine (approval workflow, weekend/holiday auto-calculation) |

---

## Folder Structure

```
backend/
├── Dockerfile
├── requirements.txt
├── seed.py                     # One-time DB seed (roles, default site, test users)
├── .env                        # Runtime config (not committed)
├── .env.example                # Config template
└── app/
    ├── main.py                 # FastAPI app, lifespan, middleware, router registration
    ├── core/
    │   ├── config.py           # Pydantic-settings config (reads .env)
    │   ├── database.py         # Async SQLAlchemy engine + session factory + pgvector hook
    │   ├── security.py         # JWT (PyJWT) + bcrypt (passlib) helpers
    │   └── dependencies.py     # FastAPI Depends: get_current_user, require_role
    ├── models/
    │   └── models.py           # All SQLAlchemy ORM models (mirrors database.sql exactly)
    ├── schemas/
    │   ├── auth.py             # LoginRequest, TokenResponse, UserInfo
    │   ├── site.py             # SiteCreate/Update/Response
    │   ├── shift.py            # ShiftCreate/Update/Response, WorkSchedule*, Holiday*
    │   ├── attendance.py       # CheckinRequest, CheckoutRequest, AttendanceResponse
    │   └── overtime.py         # OvertimeRequestCreate/Response
    ├── repositories/
    │   ├── user_repository.py
    │   ├── site_repository.py
    │   ├── shift_repository.py
    │   ├── attendance_repository.py
    │   └── overtime_repository.py
    ├── services/
    │   ├── auth_service.py
    │   ├── site_service.py
    │   ├── shift_service.py
    │   ├── face_service.py
    │   ├── attendance_service.py
    │   └── overtime_service.py
    └── routers/
        ├── auth.py
        ├── sites.py
        ├── shifts.py
        ├── face.py
        ├── attendance.py
        └── overtime.py
```

---

## Module Descriptions

### `app/main.py`
Application entry point. Responsibilities:
- Creates the `FastAPI` instance with `lifespan` context manager.
- **Startup:** Loads InsightFace model (`buffalo_s`, CPU-only) once into `app.state.face_app`; starts the `_auto_checkout_worker` asyncio background task.
- **Shutdown:** Cancels background task; disposes the SQLAlchemy engine.
- Registers all middleware (CORS, secure headers, rate-limiter).
- Registers all routers.

---

### `app/core/`

| File | Purpose |
|------|---------|
| `config.py` | `Settings` class (Pydantic `BaseSettings`). Reads `.env`. Exposes `DATABASE_URL`, JWT settings, CORS origins, login security params, face model config. All tuneable via environment variables. |
| `database.py` | Creates the async SQLAlchemy engine with `asyncpg`. Registers the pgvector type extension via a synchronous event hook (`connect`). Provides `AsyncSessionLocal` session factory and `get_db` FastAPI dependency. |
| `security.py` | `verify_password` / `get_password_hash` (bcrypt via `passlib`). `create_access_token` / `create_refresh_token` / `decode_token` (PyJWT, HS256). Access tokens expire in 15 min; refresh tokens in 7 days. |
| `dependencies.py` | `get_current_user` — validates Bearer token, loads user with role. `require_role(*roles)` — dependency factory that returns the user after verifying their role, raising HTTP 403 on failure. |

---

### `app/models/models.py`

Single file containing all nine SQLAlchemy ORM models. **Schema is never redesigned — it strictly mirrors `database.sql`.**

| Model | Table | Key columns |
|-------|-------|-------------|
| `Role` | `roles` | `id`, `name` (ADMIN / SUPERVISOR / EMPLOYEE) |
| `User` | `users` | `employee_id`, `email`, `password_hash`, `role_id`, `site_id`, `face_embedding VECTOR(512)`, `failed_login_attempts`, `locked_until` |
| `Site` | `sites` | `name`, `latitude`, `longitude`, `radius_meter` |
| `Shift` | `shifts` | `site_id`, `start_time`, `end_time`, `is_cross_midnight`, `work_hours_standard` |
| `WorkSchedule` | `work_schedules` | `shift_id`, `day_of_week` (0=Sun…6=Sat), `toleransi_telat_menit` |
| `Holiday` | `holidays` | `holiday_date` (unique), `description`, `is_national` |
| `Attendance` | `attendance` | `user_id`, `site_id`, `shift_id`, `checkin_time`, `checkout_time`, `auto_checkout`, `latitude`, `longitude`, `work_duration_minutes`, `overtime_minutes`, `is_weekend`, `is_holiday`, `status` |
| `OvertimeRequest` | `overtime_requests` | `attendance_id`, `requested_start`, `requested_end`, `approved_by`, `status` (PENDING/APPROVED/REJECTED) |
| `AuditLog` | `audit_logs` | `user_id`, `action`, `ip_address`, `user_agent`, `status` |

Relationships use `selectinload` (no implicit lazy loads on async sessions).

---

### `app/schemas/`

Pydantic v2 models for request validation and response serialisation.

| File | Schemas |
|------|---------|
| `auth.py` | `LoginRequest` (`identifier` accepts email or employee_id), `TokenResponse`, `RefreshRequest`, `UserInfo` |
| `site.py` | `SiteCreate` (lat/lon/radius validated), `SiteUpdate`, `SiteResponse` |
| `shift.py` | `ShiftCreate` (auto-detects `is_cross_midnight` when `end_time < start_time`), `ShiftUpdate`, `ShiftResponse`, `WorkScheduleCreate/Response`, `HolidayCreate/Update/Response` |
| `attendance.py` | `CheckinRequest` (lat/lon, range-validated), `CheckoutRequest` (optional lat/lon), `AttendanceResponse`, `AutoCheckoutResult` |
| `overtime.py` | `OvertimeRequestCreate` (validates `requested_end > requested_start`), `OvertimeRequestResponse` (includes `@computed_field requested_minutes`) |

All response schemas use `model_config = {"from_attributes": True}` for ORM ↔ Pydantic conversion.

---

### `app/repositories/`

Thin data-access layer. Each repository receives an `AsyncSession` and executes SQLAlchemy queries. No business logic lives here.

| Repository | Key methods |
|------------|-------------|
| `UserRepository` | `get_by_email`, `get_by_employee_id`, `get_by_id`, `increment_failed_attempts`, `reset_failed_attempts`, `update_face_embedding`, `log_audit` |
| `SiteRepository` | `get_all`, `get_by_id`, `get_by_name`, `create`, `update`, `delete` |
| `ShiftRepository` | `get_all`, `get_by_id`, `create`, `update`, `delete`, `add_schedule`, `get_schedule`, `delete_schedule`, `get_all_holidays`, `get_holiday_by_date`, `get_holiday_by_id`, `create_holiday`, `update_holiday`, `delete_holiday` |
| `AttendanceRepository` | `get_today_checkin`, `get_open_for_user`, `get_open_attendances`, `get_by_id`, `get_all`, `get_by_user`, `create`, `checkout` (writes `work_duration_minutes`, `overtime_minutes`, `auto_checkout`), `set_overtime_minutes` |
| `OvertimeRepository` | `get_by_id`, `get_by_attendance`, `get_active_for_attendance` (duplicate guard), `get_all`, `create`, `update_status` |

---

### `app/services/`

Business logic layer. Services are instantiated per-request, receive an `AsyncSession`, and orchestrate one or more repositories.

#### `auth_service.py`
- Resolves `identifier` to a `User` (tries email first, then `employee_id`).
- Checks account lock (`locked_until`), verifies bcrypt password.
- On failure: increments `failed_login_attempts`; locks account for 30 min after 5 failures.
- On success: resets failure counter, issues access + refresh tokens, writes audit log.

#### `site_service.py`
- CRUD over `SiteRepository`.
- Enforces name uniqueness on create and update.

#### `shift_service.py`
- CRUD over shifts, work schedules, and holidays.
- Validates time logic (start ≠ end; non-cross-midnight shifts must have `start < end`).
- Prevents duplicate `day_of_week` within a shift's schedules.

#### `face_service.py`
- Wraps the InsightFace `FaceAnalysis` model stored in `app.state`.
- `_decode_and_resize`: decodes JPEG/PNG bytes with OpenCV; resizes to `FACE_MAX_WIDTH` (640 px).
- `_extract_embedding`: runs face detection; rejects 0 or >1 detected faces (HTTP 422).
- `extract_embedding`: returns L2-normalised 512-d float list for pgvector storage.
- `verify`: computes cosine similarity (dot product of normalised vectors); returns `{verified, similarity, threshold}`.

#### `attendance_service.py`
- **Check-in:** validates user has a site → GPS Haversine check → duplicate check → shift matching → status determination → `is_weekend`/`is_holiday` flags → insert record.
- **Check-out:** finds open record → calculates `work_duration_minutes` → auto-sets `overtime_minutes = work_duration_minutes` if `is_weekend` or `is_holiday`.
- **Shift matching:** converts Python weekday to DB `day_of_week` (0=Sun…6=Sat). Cross-midnight shifts are matched in both the evening window (today's dow, `time >= start_time`) and the early-morning window (yesterday's dow, `time < end_time`).
- **Status:** `OUT_OF_RADIUS` → `LATE` (if beyond `start_time + toleransi_telat_menit`) → `ONTIME`.
- **Auto-checkout worker:** runs every 60 s via asyncio background task; finds open records whose shift end has passed; sets `checkout_time = shift_end_dt` (not wall clock) and writes `work_duration_minutes` / `overtime_minutes`.

#### `overtime_service.py`
- Enforces all overtime business rules before creating an `OvertimeRequest`.
- Blocks: no checkout yet; auto-checkout on regular weekday; weekend/holiday (already auto-calculated); existing PENDING/APPROVED request.
- Validates `requested_start` / `requested_end` are within the actual check-in → check-out window.
- **Approve:** sets `attendance.overtime_minutes = (requested_end − requested_start)` in minutes.
- **Reject:** changes status; `overtime_minutes` stays unchanged.
- EMPLOYEE role sees only their own requests; ADMIN/SUPERVISOR sees all.

---

## API Layers and Responsibilities

```
HTTP Request
    │
    ▼
Router (app/routers/)
  • Parse path/query/body params
  • Declare auth dependency (get_current_user / require_role)
  • Call service method
  • Return response schema
    │
    ▼
Service (app/services/)
  • Business rules and validation
  • Orchestrate multiple repositories
  • Raise HTTPException on rule violations
  • Control transaction boundaries (commit/rollback)
    │
    ▼
Repository (app/repositories/)
  • SQLAlchemy SELECT / INSERT / UPDATE / DELETE
  • Eager-load relationships with selectinload
  • No HTTP or business concerns
    │
    ▼
Database (PostgreSQL + pgvector via asyncpg)
```

---

## Database Interaction Overview

| Concern | Approach |
|---------|----------|
| Driver | `asyncpg` — pure-Python async PostgreSQL driver |
| ORM | SQLAlchemy 2.0 with `async_sessionmaker` + `AsyncSession` |
| Session lifetime | One session per HTTP request via `get_db` FastAPI dependency (yields, auto-closes) |
| Background tasks | Own `AsyncSessionLocal()` context managers (auto-checkout worker) |
| Transactions | Services call `await db.commit()` / `await db.flush()` explicitly; no auto-commit |
| pgvector | Registered at engine connect via `pgvector.asyncpg.register_vector`; `face_embedding` column uses `Vector(512)` type |
| Timezone | All timestamps stored as **naive Asia/Jakarta** datetimes. `DATE(checkin_time)` in the DB unique index returns the correct Jakarta calendar date |
| Schema source of truth | `database.sql` — applied at container startup via Docker `entrypoint-initdb.d` |

### Key database constraints

| Constraint | Table | Purpose |
|------------|-------|---------|
| `UNIQUE INDEX unique_daily_checkin` | `attendance (user_id, DATE(checkin_time))` | One check-in per user per Jakarta day |
| `UNIQUE` on `holiday_date` | `holidays` | No duplicate holidays |
| `UNIQUE` on `roles.name` | `roles` | Prevents duplicate role names |
| `ivfflat` vector index | `users (face_embedding vector_cosine_ops)` | Fast approximate cosine-similarity search |
| `ON DELETE CASCADE` | `shifts → sites`, `work_schedules → shifts`, `attendance → users` | Referential integrity on delete |

---

## Role-Based Access Summary

Three roles are seeded at startup: **ADMIN**, **SUPERVISOR**, **EMPLOYEE**.

Access is enforced at the router level via the `require_role()` dependency factory. `get_current_user` is always called first to validate the JWT.

### Auth
| Endpoint | Anyone |
|----------|--------|
| `POST /auth/login` | ✓ (public) |
| `POST /auth/refresh` | ✓ (public) |
| `GET /auth/me` | ✓ (any authenticated) |

### Sites
| Action | ADMIN | SUPERVISOR | EMPLOYEE |
|--------|-------|------------|---------|
| List / Get | ✓ | ✓ | ✓ |
| Create / Update / Delete | ✓ | — | — |

### Shifts & Schedules
| Action | ADMIN | SUPERVISOR | EMPLOYEE |
|--------|-------|------------|---------|
| List / Get shifts | ✓ | ✓ | ✓ |
| Create / Update shift | ✓ | ✓ | — |
| Delete shift | ✓ | — | — |
| Add / Delete schedule | ✓ | ✓ | — |
| List holidays | ✓ | ✓ | ✓ |
| Create / Update / Delete holiday | ✓ | — | — |

### Face Recognition
| Action | ADMIN | SUPERVISOR | EMPLOYEE |
|--------|-------|------------|---------|
| Register / Replace embedding | ✓ | ✓ | — |
| Verify face | ✓ | ✓ | ✓ |
| Get status | ✓ | ✓ | ✓ |
| Delete embedding | ✓ | — | — |

### Attendance
| Action | ADMIN | SUPERVISOR | EMPLOYEE |
|--------|-------|------------|---------|
| Check-in | ✓ | ✓ | ✓ |
| Check-out | ✓ | ✓ | ✓ |
| View own records (`/me`) | ✓ | ✓ | ✓ |
| View all records | ✓ | ✓ | — |
| View record by ID | ✓ | ✓ | own only |
| Trigger auto-checkout | ✓ | — | — |

### Overtime
| Action | ADMIN | SUPERVISOR | EMPLOYEE |
|--------|-------|------------|---------|
| Submit request | ✓ | ✓ | ✓ (own) |
| View all requests | ✓ | ✓ | — |
| View own requests | ✓ | ✓ | ✓ |
| View by ID | ✓ | ✓ | own only |
| Approve / Reject | ✓ | ✓ | — |

---

## Environment Variables

All values are read from `.env` via Pydantic `BaseSettings`. Override any value without code changes.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://…@db:5432/presensiv2` | Async PostgreSQL DSN |
| `SECRET_KEY` | *(change in production)* | JWT signing secret (min 32 chars) |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | `["http://localhost:3000", …]` | JSON array of allowed origins |
| `MAX_LOGIN_ATTEMPTS` | `5` | Failed attempts before account lock |
| `ACCOUNT_LOCK_MINUTES` | `30` | Lock duration |
| `RATE_LIMIT_LOGIN` | `10/minute` | Rate limit on `/auth/login` |
| `TIMEZONE` | `Asia/Jakarta` | Server timezone (all timestamps) |
| `FACE_MODEL_NAME` | `buffalo_s` | InsightFace model pack |
| `FACE_SIMILARITY_THRESHOLD` | `0.3` | Cosine similarity pass threshold |
| `FACE_MAX_WIDTH` | `640` | Max image width before resize (px) |

---

## Running Locally

```bash
# Start all containers (PostgreSQL + pgvector, FastAPI backend)
docker compose up -d --build

# Seed roles, default site, and three test users
docker exec presensiv2_backend python seed.py

# Swagger UI
open http://localhost:8000/docs

# Health check
curl http://localhost:8000/health
```

> **First-run note:** On the very first startup, InsightFace downloads `buffalo_s.zip` (~120 MB) from GitHub.
> The server will become ready only after the download and model prepare completes (~30–60 s on a fast connection).
> Subsequent restarts skip the download if the volume is preserved.

---

## Troubleshooting

### `localhost didn't send any data` / backend crashes on startup

**Symptom:** `docker ps` shows the container as `Up` but `http://localhost:8000/` returns no data.
**Check logs:** `docker logs presensiv2_backend`

#### Cause: numpy ≥ 2.0 installed with onnxruntime 1.17.3

`onnxruntime==1.17.3` is only compatible with `numpy<2`. If `pip` resolves a newer `numpy`
(e.g., `2.4.x`) the import chain fails with:

```
AttributeError: _ARRAY_API not found
ImportError: Unable to import dependency onnxruntime.
```

**Fix:** Pin `numpy==1.26.4` (last stable 1.x) in `requirements.txt` and rebuild:

```bash
# requirements.txt already has: numpy==1.26.4
docker compose build backend
docker compose up -d backend
```

#### Cause: InsightFace model download fails on first run

If the container has no internet access or GitHub is unreachable, the download will hang
or fail silently. Check logs for the progress bar line. Re-run `docker compose up -d backend`
once connectivity is restored.

#### General restart procedure

```bash
docker compose down
docker compose up -d --build   # full rebuild if requirements changed
# or, for code-only changes:
docker compose restart backend
```

### Test credentials (seeded)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@presensiv2.local` | `Admin@123` |
| SUPERVISOR | `supervisor@presensiv2.local` | `Supervisor@123` |
| EMPLOYEE | `karyawan@presensiv2.local` | `Karyawan@123` |

---

## Security Measures (Phases 1–5)

| Threat | Mitigation |
|--------|-----------|
| Brute-force login | Rate limiting (10 req/min) + account lock after 5 failures |
| Token tampering | PyJWT HS256 signature; `type` claim checked (`access` vs `refresh`) |
| IDOR | Service layer checks `user_id` ownership before returning records |
| Privilege escalation | `require_role()` enforced at every sensitive endpoint |
| Injection | SQLAlchemy ORM uses parameterised queries exclusively |
| XSS | `X-Content-Type-Options: nosniff`, `X-XSS-Protection` headers |
| Clickjacking | `X-Frame-Options: DENY` |
| GPS spoofing | Haversine distance logged; `OUT_OF_RADIUS` status auditable |
| Face spoofing | Cosine similarity threshold + reject >1 face in frame |
| Audit trail | Every login attempt (success or failure) written to `audit_logs` |
