# CLAUDE.md — Presensi Online SSB v2

> AI context file. Read this before generating any code for this project.

---

## Project Overview

**Presensi Online SSB v2** is a GPS + face-recognition based attendance management system for SSB (Sanggar Sarana Baja/ Manufacture with many site).

- **Backend:** FastAPI REST API (Python 3.11)
- **Mobile client:** React Native (Expo) — Android + iOS
- **Database:** PostgreSQL 16 + pgvector extension
- **AI/ML:** InsightFace `buffalo_s` model (512-dim face embeddings)
- **Containerized:** Docker Compose
- **Timezone:** Per-site (WIB/WITA/WIT). All timestamps stored in UTC (`TIMESTAMPTZ`). Business logic converts to the site's local timezone.

**Current status (as of 2026-04-14):**

| Component | Phase | Status |
|-----------|-------|--------|
| Backend | Phase 7 of 7 + post | All phases complete + Assignments feature added |
| Mobile | Phase F7 of F7 | F7 (UX hardening) COMPLETE — toast, offline detection, error interceptors, double-submit prevention, full timezone display |
| Mobile Overtime | — | **FULLY IMPLEMENTED** — submit, list my/team overtimes, approve, reject with calendar + TimeStepper UI |
| Web Admin | W6 of W6 + post-W6 | ALL PHASES COMPLETE + Leaflet map picker in Sites + Assignments management page |

---

## Critical Rules

1. **Never redesign the DB schema** — always follow `database.sql` exactly. The ORM in `backend/app/models/models.py` must mirror it strictly.
2. **No business logic in frontend** — all validation, GPS checks, shift logic, overtime calc, and face verification live in the backend only.
3. **Build per phase** — wait for confirmation before advancing to next phase.
4. **All timestamps stored in UTC** in the database (`TIMESTAMPTZ` columns). Convert to `site.timezone` for all business logic: shift matching, day-boundary checks, weekday detection, holiday lookups, auto-checkout. Never use `Asia/Jakarta` as a global default.
5. **numpy must stay pinned to `==1.26.4`** — `onnxruntime==1.17.3` is incompatible with numpy ≥ 2.0.
6. **Valid site timezone strings:** `"Asia/Jakarta"` (WIB, UTC+7) | `"Asia/Makassar"` (WITA, UTC+8) | `"Asia/Jayapura"` (WIT, UTC+9).

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | FastAPI 0.115.5 |
| Server | Uvicorn with `--reload` in dev |
| ORM | SQLAlchemy 2.0 (async) + asyncpg |
| Auth | PyJWT (HS256), passlib/bcrypt |
| Rate limiting | slowapi |
| Face AI | InsightFace (`buffalo_s`) + OpenCV headless |
| Vector DB | pgvector 0.3.5 (cosine similarity, threshold 0.3) |
| Config | pydantic-settings (reads `.env`) |
| Container | Python 3.11-slim Docker image |

### Mobile
| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81.5 + Expo ~54.0.33 (New Architecture enabled) |
| Language | TypeScript 5.9 (strict mode) |
| API client | Axios 1.13.5 + auto token refresh interceptor (JSON APIs only) |
| FormData upload | `XMLHttpRequest` direct (NOT Axios, NOT native fetch) — see face.api.ts |
| State/cache | @tanstack/react-query v5.90 |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| Icons | @expo/vector-icons 15 (Ionicons) |
| Auth storage | expo-secure-store 15 (NOT AsyncStorage) |
| Camera | expo-camera 17 |
| GPS | expo-location 19 |

### Web Admin
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI primitives) |
| API Client | Axios (JSON only) — same interceptor pattern as mobile |
| Server State | @tanstack/react-query v5 |
| Tables | @tanstack/react-table v8 |
| Charts | recharts |
| Forms | React Hook Form + Zod |
| Router | React Router v6 |
| Icons | lucide-react |
| Toast | sonner |
| Map | leaflet 1.9.4 + @types/leaflet — used in `SiteMapPicker` (Sites create/edit) |
| Token storage | Access token: **memory only** (React Context). Refresh token: **sessionStorage** key `presensiv2_refresh_token`. NEVER localStorage |
| Dev port | 5173 (Vite dev server) |

### Infrastructure
| Service | Detail |
|---------|--------|
| Database | pgvector/pgvector:pg16 Docker image |
| DB name | `presensiv2` |
| DB user | `presensiv2` |
| DB port | 5432 |
| Backend port | 8000 |
| Web Admin dev port | 5173 |
| Schema init | `database.sql` auto-applied via `entrypoint-initdb.d` |

---

## Repository Structure

```
presensiv2/
├── CLAUDE.md                    ← This file
├── Aplikasi.md                  ← Master spec (phases, requirements)
├── backend.md                   ← Backend architecture docs (authoritative)
├── frontend.md                  ← Mobile architecture docs (authoritative)
├── database.sql                 ← SINGLE SOURCE OF TRUTH for DB schema
├── docker-compose.yml           ← Orchestrates db + backend containers
│
├── web/                         ← Web Admin panel (React + Vite) — W1–W5 complete
│   ├── src/
│   │   ├── api/                 ← auth, users, sites, shifts, attendance, overtime, assignments API modules
│   │   ├── components/
│   │   │   ├── layout/, ui/ (shadcn), users/, shifts/, holidays/, attendance/, overtime/
│   │   │   └── sites/
│   │   │       ├── SiteFormModal.tsx  ← create/edit dialog; horizontal split layout (form left 1/4, map right 3/4)
│   │   │       └── SiteMapPicker.tsx  ← Leaflet map; OSM tiles; Nominatim search; draggable marker + radius circle
│   │   ├── hooks/useAuth.ts     ← useLogin, useLogout, useCurrentUser, useHasRole
│   │   ├── pages/               ← LoginPage, DashboardPage, users/, sites/, shifts/, holidays/, attendance/, overtime/, reports/ReportsPage, assignments/AssignmentsPage
│   │   ├── components/dashboard/ ← StatsCard, AttendanceChart (recharts)
│   │   ├── router/index.tsx     ← all routes; /dashboard and /reports fully implemented (W6 complete)
│   │   ├── store/               ← authStore.ts (Context + tokenAccessors), AuthProvider.tsx
│   │   ├── types/               ← auth.ts, users.ts, attendance.ts, overtime.ts
│   │   └── utils/               ← datetime.ts (formatDateTime/Date/Time/Duration), toast.ts
│   ├── .env                     ← VITE_API_BASE_URL=http://localhost:8000
│   └── index.html               ← title "HRIS SSB", favicon /ssb.svg
│
├── backend/
│   ├── Dockerfile               ← Python 3.11-slim, installs system deps for OpenCV/InsightFace
│   ├── requirements.txt         ← Pinned deps (numpy==1.26.4 critical)
│   ├── seed.py                  ← Idempotent DB seed: roles, 4 sites, 3 shifts+schedules, 45 users, 400 attendance records (Jan 1–10 2026)
│   ├── migration_f6.sql         ← Add supervisor_id column (run on pre-F6 DBs)
│   ├── .env                     ← Runtime config (NOT committed)
│   └── app/
│       ├── main.py              ← App entry: lifespan, middleware, routers, auto-checkout worker
│       ├── core/
│       │   ├── config.py        ← Pydantic Settings class (all env vars)
│       │   ├── database.py      ← Async SQLAlchemy engine + pgvector registration
│       │   ├── security.py      ← JWT + bcrypt helpers
│       │   └── dependencies.py  ← get_current_user, require_role() deps
│       ├── models/
│       │   └── models.py        ← All ORM models (mirrors database.sql)
│       ├── schemas/             ← Pydantic v2 request/response schemas
│       │   ├── auth.py
│       │   ├── site.py
│       │   ├── shift.py
│       │   ├── attendance.py
│       │   └── overtime.py
│       ├── repositories/        ← Data access only (no business logic)
│       │   ├── user_repository.py
│       │   ├── site_repository.py
│       │   ├── shift_repository.py
│       │   ├── attendance_repository.py
│       │   └── overtime_repository.py
│       ├── services/            ← Business logic layer
│       │   ├── auth_service.py
│       │   ├── site_service.py
│       │   ├── shift_service.py
│       │   ├── face_service.py
│       │   ├── attendance_service.py
│       │   └── overtime_service.py
│       └── routers/             ← HTTP routing + auth deps
│           ├── auth.py
│           ├── sites.py
│           ├── shifts.py
│           ├── face.py
│           ├── attendance.py
│           ├── overtime.py
│           ├── assignments.py   ← shift/site assignment management (ADMIN only)
│           └── users.py
│
└── mobile/
    ├── App.tsx                  ← Root: QueryClientProvider + SafeAreaProvider + RootNavigator
    ├── app.json                 ← Expo app config
    ├── package.json
    ├── tsconfig.json
    ├── .env                     ← EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_API_TIMEOUT
    └── src/
        ├── api/
        │   ├── axios.ts         ← Axios instance + Bearer token interceptor + 401 refresh queue; exports BASE_URL
        │   ├── auth.api.ts      ← login, refresh, me
        │   ├── attendance.api.ts ← checkin, checkout, getMyAttendance, getTeamAttendance
        │   ├── face.api.ts      ← faceUpload() via XHR (NOT Axios/fetch); register, verify, getStatus
        │   └── overtime.api.ts  ← listMine, listTeam, getById, submit, approve, reject
        ├── hooks/
        │   ├── useAuth.ts       ← useLogin (with authApi.me post-login), useLogout, useMe
        │   ├── useCheckin.ts    ← useCheckin + useCheckout mutations (both exported here)
        │   ├── useAttendance.ts ← useTodayAttendance(siteTimezone), useAttendanceHistory(monthStr), useTeamAttendance(monthStr)
        │   ├── useFaceRegister.ts ← useFaceStatus, useFaceRegister, useFaceVerify
        │   ├── useOvertime.ts   ← useMyOvertimes, useTeamOvertimes, useSubmitOvertime, useApproveOvertime, useRejectOvertime
        │   └── useNetworkStatus.ts ← online/offline detection hook
        ├── screens/
        │   ├── LoginScreen.tsx
        │   ├── HomeScreen.tsx   ← useTodayAttendance with siteTimezone; Intl.DateTimeFormat for display
        │   ├── HistoryScreen.tsx ← infinite scroll + month chip filter; Intl.DateTimeFormat with record.site_timezone
        │   ├── OvertimeScreen.tsx ← FULLY IMPLEMENTED: submit (calendar+TimeStepper), list my/team, approve/reject modals, FilterBar with date range
        │   ├── ProfileScreen.tsx ← user info, face status, opens FaceRegisterModal + ChangePasswordModal
        │   ├── SubordinateAttendanceScreen.tsx ← month arrow-nav, groups records by user_id into EmployeeSummary; uses Intl.DateTimeFormat with site_timezone ✅
        │   ├── SplashScreen.tsx ← checks tokens → authApi.me() → sets auth state
        │   └── LoadingScreen.tsx ← generic spinner
        ├── components/
        │   ├── CheckinModal.tsx  ← deferred useEffect upload pattern (capture → setState → effect fires after CameraView unmounts → XHR verify → Axios checkin)
        │   ├── CheckoutModal.tsx ← inline async pattern (capture → verify → checkout in same async fn); GPS optional
        │   ├── FaceRegisterModal.tsx ← capture → review step (user confirms) → XHR upload
        │   ├── ChangePasswordModal.tsx ← change password form (used in ProfileScreen)
        │   ├── OfflineBanner.tsx ← offline status banner component (uses useNetworkStatus)
        │   └── DateRangePicker.tsx ← Calendar, DatePickerModal, fmtDateShort, getTodayStr helpers (used in OvertimeScreen)
        ├── navigation/
        │   ├── RootNavigator.tsx ← pub/sub authStore → Splash | Auth | Main
        │   ├── AuthNavigator.tsx ← Login only
        │   └── MainNavigator.tsx ← 5 bottom tabs: Home, History, Overtime, Team (SUPERVISOR/ADMIN only), Profile
        ├── store/
        │   └── authStore.ts     ← Vanilla pub/sub auth state (no Redux/Zustand); exports TOKEN_KEYS, getAuthState, subscribeToAuthState, setAuthUser, persistTokens, clearTokens
        └── types/
            ├── auth.ts          ← TokenResponse, UserInfo (includes site_timezone: string | null), LoginPayload
            ├── attendance.ts    ← AttendanceRecord (includes site_timezone: string), TeamAttendanceRecord, EmployeeSummary
            ├── face.ts          ← FaceStatus, FaceRegisterResponse, FaceVerifyResponse
            └── overtime.ts      ← OvertimeRequest (includes employee_id, employee_name), OvertimeSubmitPayload, ApprovePayload, RejectPayload
```

---

## Database Schema

**Source of truth:** `database.sql` (applied at container start)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `roles` | `id`, `name` (ADMIN/SUPERVISOR/EMPLOYEE) | Seeded at init |
| `users` | `employee_id`, `email`, `password_hash`, `role_id`, `site_id`, `face_embedding VECTOR(512)`, `failed_login_attempts`, `locked_until`, `supervisor_id` | supervisor_id added in migration_f6.sql |
| `sites` | `name`, `latitude`, `longitude`, `radius_meter`, `timezone VARCHAR(50) DEFAULT 'Asia/Jakarta'` | WIB/WITA/WIT per site |
| `shifts` | `site_id`, `name`, `start_time`, `end_time`, `is_cross_midnight`, `work_hours_standard` | CASCADE delete from sites |
| `work_schedules` | `shift_id`, `day_of_week` (0=Sun…6=Sat), `toleransi_telat_menit` | CASCADE delete from shifts |
| `holidays` | `holiday_date` (UNIQUE), `description`, `is_national` | |
| `attendance` | `user_id`, `site_id`, `shift_id`, `checkin_time`, `checkout_time`, `auto_checkout`, `lat/lon`, `work_duration_minutes`, `overtime_minutes`, `is_weekend`, `is_holiday`, `status` | UNIQUE INDEX on (user_id, DATE(checkin_time)) |
| `overtime_requests` | `attendance_id`, `requested_start`, `requested_end`, `approved_by`, `status` (PENDING/APPROVED/REJECTED) | CASCADE delete from attendance |
| `audit_logs` | `user_id`, `action`, `ip_address`, `user_agent`, `status` | Written on every login attempt |

**Key DB constraints:**
- `UNIQUE INDEX unique_daily_checkin` on `attendance(user_id, DATE(checkin_time))` — one check-in per day per user
- `ivfflat` vector index on `users(face_embedding vector_cosine_ops)` with `lists=100`
- All FK cascades: sites→shifts→work_schedules; users→attendance

**Timezone note:** All timestamps stored as **UTC** using PostgreSQL `TIMESTAMPTZ` columns (`DateTime(timezone=True)` in SQLAlchemy). Business logic must convert to `ZoneInfo(site.timezone)` before any date/day-of-week/time-of-day comparison. The `unique_daily_checkin` constraint is enforced in the **application layer** (not a raw `DATE()` DB index), because the calendar-day boundary differs per site timezone.

---

## Key Commands

### Backend (Docker)

```bash
# Start everything (first time — builds containers)
docker compose up -d --build

# Start without rebuilding
docker compose up -d

# Seed roles, default site, test users (first time only)
docker exec presensiv2_backend python seed.py

# View backend logs
docker logs presensiv2_backend -f

# Rebuild only backend (after requirements.txt change)
docker compose build backend && docker compose up -d backend

# Restart backend (code-only change — hot reload is on in dev)
docker compose restart backend

# Full teardown (keeps DB data)
docker compose down

# Full teardown + wipe DB volume
docker compose down -v

# Run migration for pre-F6 databases
docker exec presensiv2_backend psql $DATABASE_URL -f migration_f6.sql
```

### Mobile (Expo)

```bash
# Install deps
cd mobile && npm install

# Start Metro (always use --clear after .env changes)
npx expo start --clear

# Target Android emulator
npx expo start --clear   # then press 'a'

# Target iOS simulator
npx expo start --clear   # then press 'i'

# Open in web browser (limited — no camera/GPS)
npx expo start --clear   # then press 'w'
```

### Web Admin

```bash
# Start dev server
cd web && npm run dev    # → http://localhost:5173

# Type check (must stay at 0 errors)
cd web && npx tsc --noEmit

# Production build
cd web && npm run build
```

### Development URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Health check | http://localhost:8000/health |
| Web Admin | http://localhost:5173 |

---

## Backend Architecture Patterns

### Layered Architecture
```
Router → Service → Repository → Database
```
- **Routers:** Parse params, declare auth deps (`get_current_user` / `require_role`), call service, return schema
- **Services:** Business rules, orchestrate repositories, raise HTTPException, own transactions (`commit`/`rollback`)
- **Repositories:** SQLAlchemy SELECT/INSERT/UPDATE/DELETE only, no HTTP concerns, use `selectinload` for relationships

### Auth Pattern
- JWT HS256, access token 15 min, refresh token 7 days
- `get_current_user` dependency validates Bearer token
- `require_role("ADMIN", "SUPERVISOR")` factory enforces RBAC
- Login identifier accepts both email and employee_id
- Account lock: 5 failed attempts → locked for 30 min

### Face Recognition Pattern
- InsightFace `buffalo_s` loaded once at startup into `app.state.face_app`
- L2-normalized 512-dim embeddings stored as pgvector `VECTOR(512)`
- Cosine similarity threshold = 0.3 (configurable via `FACE_SIMILARITY_THRESHOLD`)
- Reject: 0 faces or >1 face detected (HTTP 422)

### Multi-Timezone Pattern (WIB / WITA / WIT)

- **Storage:** UTC everywhere — `TIMESTAMPTZ` DB columns, `DateTime(timezone=True)` SQLAlchemy type.
- **Business logic:** Convert stored UTC to `ZoneInfo(site.timezone)` before any of:
  - Shift matching (time-of-day comparison, day-of-week lookup)
  - Day-boundary checks (duplicate checkin, `from_date`/`to_date` filters)
  - Weekend detection (`is_weekend` flag)
  - Holiday date lookup
  - Auto-checkout shift-end comparison
- **API responses:** Return UTC ISO 8601 strings (`2025-01-15T17:00:00Z`). Mobile client converts for display using the `site.timezone` field.
- **Helper pattern:** `_now_site(tz: str) -> datetime` — returns `datetime.now(ZoneInfo(tz))` (aware, in site local time).
- **Valid timezone strings:** `"Asia/Jakarta"` (WIB, UTC+7) | `"Asia/Makassar"` (WITA, UTC+8) | `"Asia/Jayapura"` (WIT, UTC+9)
- **Duplicate checkin guard:** Query UTC range corresponding to the site-local calendar day (midnight-to-midnight in site TZ), not `DATE(checkin_time)`.

### Attendance Patterns
- GPS validation: Haversine formula vs `site.radius_meter`
- Status: `OUT_OF_RADIUS` → `LATE` (past start + toleransi) → `ONTIME`
- Shift matching: converts Python weekday to DB `day_of_week` (0=Sun…6=Sat)
- Cross-midnight shifts: matched in both evening window (today) and morning window (yesterday)
- Auto-checkout: asyncio background task runs every 60 s, checks shift end time

### Pydantic Schemas
- All response schemas use `model_config = {"from_attributes": True}`
- `ShiftCreate` auto-detects `is_cross_midnight` when `end_time < start_time`
- `OvertimeRequestResponse` has `@computed_field requested_minutes`

---

## Mobile Architecture Patterns

### API Layer
- Single `apiClient` (Axios) in `src/api/axios.ts` — JSON requests only
- Request interceptor: attaches `Authorization: Bearer <access_token>` from SecureStore
- Response interceptor: handles 401 with refresh queue (prevents parallel refresh races). Special guard: if the failed request body is `instanceof FormData`, the interceptor skips the Axios retry and re-throws (delegates 401 handling to `faceUpload`'s own refresh logic)
- Tokens stored in `expo-secure-store` (keys: `presensiv2_access_token`, `presensiv2_refresh_token`)
- Never use `AsyncStorage` for tokens

### FormData Upload Pattern (face.api.ts)
- **Do NOT use Axios for FormData**: Axios's `transformRequest` pipeline serializes React Native's FormData polyfill to `'{}'` before `xhr.send()`, causing silent upload failures
- **Do NOT use native `fetch` for FormData**: `fetch()` with a FormData file URI body fails on the very first call on Android (first-call initialization issue); subsequent calls succeed
- **Use `XMLHttpRequest` directly**: XHR is initialized and used by Axios for all JSON calls well before any face upload, so it's reliable from the first use
- `_xhrPost(url, token, formData)` wraps XHR in a Promise; `faceUpload<T>()` adds 401 token refresh + one automatic retry on network error
- Errors are shaped to match AxiosError (`err.isAxiosError = true`, `err.response`, `err.config`) so all modal `isAxiosError(e)` checks work unchanged

### CheckinModal Upload Timing (Android)
- `handleCapture` captures photo, stores URI in `capturedUri` state, sets `step = 'verifying'` — no upload here
- A `useEffect([step, capturedUri, ...])` fires after React commits the render (CameraView fully unmounted), then calls `verify.mutateAsync` → checkin
- This mirrors `FaceRegisterModal`'s review-step delay pattern; uploading while CameraView is still mounted causes the first XHR to fail
- `CheckoutModal` does NOT use this pattern (checkout has no face verify step — inline async is fine)

### State Management
- Auth state: custom vanilla pub/sub store in `src/store/authStore.ts` (no Redux/Zustand)
- Server data: React Query (staleTime 30–60 s per query)
- No local business logic computation — always trust backend responses

### Navigation
- `RootNavigator` → subscribes to authStore pub/sub → renders `SplashScreen` (initializing), `AuthNavigator` (unauthenticated), or `MainNavigator` (authenticated)
- `AuthNavigator`: Login screen only
- `MainNavigator`: 5 bottom tabs — Home, History, Overtime, **Team** (SUPERVISOR/ADMIN only, hidden for EMPLOYEE), Profile

### Mobile `.env` Variables
```
EXPO_PUBLIC_API_BASE_URL=http://<HOST>:8000
EXPO_PUBLIC_API_TIMEOUT=10000
```
- Physical phone (Expo Go): use LAN IP of your PC
- Android emulator: use `10.0.2.2`
- Web: use `localhost`

---

## Web Admin Architecture Patterns

### SiteFormModal Layout
- Dialog: `max-w-6xl max-h-[calc(100vh-4rem)] flex flex-col p-0 overflow-hidden` — fits viewport, no outer scroll
- Body: `flex flex-row` — form left `w-1/4 min-w-[260px] overflow-y-auto`, map right `flex-1`
- `<form>` wraps only the left column — the map sits outside the form to avoid nested `<form>` elements
- Default create-mode lat/lng in RHF: `NaN` (not `0`). `Number.isFinite(NaN) === false` → map receives `null` → shows default SSB location without triggering a marker at `0,0`

### SiteMapPicker — Leaflet Integration
- **CSS:** `import 'leaflet/dist/leaflet.css'` inside the component file
- **Marker icons:** Default Leaflet icons break in Vite (asset hashing). Fix: delete `_getIconUrl` on `L.Icon.Default.prototype` and point `iconUrl`/`iconRetinaUrl`/`shadowUrl` to unpkg CDN
- **Default center:** `[-6.2903448109466655, 106.79813861846925]` (SSB Cikarang), zoom 15. Create-mode places a visual marker here but does **not** call `onChange` — user must click/drag to confirm
- **Edit-mode centering problem:** `useEffect([])` (map init) runs before RHF `reset()` populates lat/lng, so `latitude` prop is `null` at init → map renders at default. Fixed with `viewCenteredRef = useRef(false)`: the sync effect `[latitude, longitude]` calls `setView` the first time real coords arrive and sets the ref to `true`
- **Flex blank-tile fix:** call `setTimeout(() => map.invalidateSize(), 100)` after `L.map()` init
- **Map container sizing:** `style={{ width: '100%', height: '100%', minHeight: 0 }}` — no fixed pixel height; fills flex parent
- **Search:** Nominatim `https://nominatim.openstreetmap.org/search` — debounced 500 ms, fly-only (does not call `onChange`), headers `{ 'Accept-Language': 'id', 'User-Agent': 'presensiv2-webadmin' }`
- **CSP** (`web/index.html`): `img-src` must include `https://*.tile.openstreetmap.org https://unpkg.com`; `connect-src` must include `https://nominatim.openstreetmap.org`
- **CORS** (`backend/.env` + `docker-compose.yml` `environment` block): `CORS_ORIGINS` must list all Vite dev ports in use (5173, 5174, …). The `environment` block in `docker-compose.yml` overrides `env_file` — edit both or consolidate into `env_file` only. After any change: `docker compose up -d --force-recreate backend` (restart alone does not re-apply env)

---

## Role-Based Access Control

| Feature | ADMIN | SUPERVISOR | EMPLOYEE |
|---------|-------|------------|---------|
| Login/Refresh/Me | ✓ | ✓ | ✓ |
| Sites CRUD | ✓ | read-only | read-only |
| Shifts create/update | ✓ | ✓ | — |
| Shifts delete | ✓ | — | — |
| Holidays CRUD | ✓ | — | — |
| Face register/replace | ✓ | ✓ | — |
| Face verify/status | ✓ | ✓ | ✓ |
| Face delete | ✓ | — | — |
| Check-in/out | ✓ | ✓ | ✓ |
| View own attendance | ✓ | ✓ | ✓ |
| View all attendance | ✓ | ✓ | — |
| Overtime submit | ✓ | ✓ | ✓ (own only) |
| Overtime approve/reject | ✓ | ✓ | — |
| Assignments CRUD | ✓ | — | — |

---

## Test Credentials (Seeded)

### Original accounts (no attendance data)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| ADMIN | `admin@presensiv2.local` | `Admin@123` | No site — cannot check in |
| SUPERVISOR | `supervisor@presensiv2.local` | `Supervisor@123` | Kantor Pusat, no shift seeded |
| EMPLOYEE | `karyawan@presensiv2.local` | `Karyawan@123` | Kantor Pusat, no shift seeded |

### @ptssb.co.id accounts (rich test data — prefer these)

| employee_id | Email | Password | Role | Site | Subordinates |
|------------|-------|----------|------|------|-------------|
| SPV101 | `spv101@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jakarta (WIB) | EMP101, EMP106–EMP112 |
| SPV102 | `spv102@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jakarta (WIB) | EMP102, EMP113–EMP119 |
| SPV103 | `spv103@ptssb.co.id` | `12345` | SUPERVISOR | SSB Makassar (WITA) | EMP103, EMP120–EMP126 |
| SPV104 | `spv104@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jayapura (WIT) | EMP104, EMP127–EMP133 |
| SPV105 | `spv105@ptssb.co.id` | `12345` | SUPERVISOR | SSB Jayapura (WIT) | EMP105, EMP134–EMP140 |
| EMP101–EMP140 | `empNNN@ptssb.co.id` | `12345` | EMPLOYEE | same site as supervisor | — |

All 40 employees have **10 attendance records each (Jan 1–10, 2026)**: ONTIME, LATE, weekend (×3), OUT_OF_RADIUS, and normal days.

**For testing, prefer `spv101@ptssb.co.id`** — SSB Jakarta, 8 subordinates, full attendance history.

---

## Environment Variables (Backend `.env`)

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://presensiv2:presensiv2pass@db:5432/presensiv2` | Use `db` as host inside Docker |
| `SECRET_KEY` | *(change in prod)* | Min 32 chars |
| `ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |
| `CORS_ORIGINS` | JSON array | e.g. `["http://localhost:8081"]` |
| `MAX_LOGIN_ATTEMPTS` | `5` | |
| `ACCOUNT_LOCK_MINUTES` | `30` | |
| `RATE_LIMIT_LOGIN` | `10/minute` | |
| `TIMEZONE` | `Asia/Jakarta` | |
| `FACE_MODEL_NAME` | `buffalo_s` | |
| `FACE_SIMILARITY_THRESHOLD` | `0.3` | Cosine similarity pass threshold |
| `FACE_MAX_WIDTH` | `640` | px, image resized before detection |

---

## Gotchas & Known Issues

### numpy / onnxruntime compatibility
`onnxruntime==1.17.3` only works with `numpy<2`. If pip resolves numpy ≥ 2.0 the container crashes with `AttributeError: _ARRAY_API not found`. **numpy is pinned to `1.26.4` in `requirements.txt`** — do not change it.

### InsightFace first-run download
On first container start, InsightFace downloads `buffalo_s.zip` (~120 MB) from GitHub. Backend becomes ready only after download + model prepare (~30–60 s). Subsequent restarts skip download if volume is preserved.

### No shifts for Kantor Pusat → check-in fails for original test users
`seed.py` seeds shifts only for the three `@ptssb.co.id` sites (SSB Jakarta/Makassar/Jayapura). The original `Kantor Pusat` site has no shift. The original `supervisor@presensiv2.local` / `karyawan@presensiv2.local` users are assigned to Kantor Pusat and will get "No active shift" on check-in. Use the `@ptssb.co.id` accounts or create a shift via Swagger (POST /shifts) for Kantor Pusat.

### ADMIN has no site
Seeded ADMIN user has no `site_id`. Attempting check-in as ADMIN gives "User is not assigned to any site".

### Supervisor–Employee hierarchy migration
`migration_f6.sql` adds `supervisor_id` column. Run this on any database initialized before Phase F6 of the mobile app.

### day_of_week convention
The DB uses `0=Sunday, 6=Saturday` (not the Python weekday convention of `0=Monday`). The `attendance_service.py` converts Python weekday to this convention before shift lookup.

### Cross-midnight shift matching
Shifts where `end_time < start_time` set `is_cross_midnight=True`. Attendance service checks both the evening window (today's DOW, `time >= start_time`) and the morning window (yesterday's DOW, `time < end_time`).

### Token storage keys
Mobile SecureStore keys: `presensiv2_access_token`, `presensiv2_refresh_token`.

### Login bug fix (2026-02-26)
`LoginScreen.tsx` previously used dynamic `import()` inside `handleLogin`. This was fixed by moving `authApi.me()` + `setAuthUser()` into `useLogin.onSuccess` in `hooks/useAuth.ts`. Do not reintroduce dynamic imports in the auth flow.

### SubordinateAttendanceScreen
`SubordinateAttendanceScreen.tsx` exists (visible to SUPERVISOR/ADMIN) for viewing subordinate attendance — relates to the supervisor_id hierarchy added in F6. Month filter is a compact `< Januari 2026 >` arrow-navigator (not a chip scroll), bounded at current month and 12 months back. Groups `TeamAttendanceRecord[]` by `user_id` into collapsible `EmployeeSummary` cards. `formatDate`/`formatTime` use `Intl.DateTimeFormat` with `record.site_timezone` — timezone display is complete (fixed 2026-03-09).

### Mobile OvertimeScreen — fully implemented
`mobile/src/api/overtime.api.ts`, `mobile/src/hooks/useOvertime.ts`, and `mobile/src/types/overtime.ts` all exist. `OvertimeScreen.tsx` is fully implemented with submit, list, approve, and reject. The earlier stub placeholder has been replaced.

### Face FormData upload: use XHR only
Three approaches were tried and ruled out for face registration/verify uploads:
1. **Axios** — `transformRequest` serializes RN FormData to `'{}'` → upload body is empty
2. **Native `fetch`** — fails on the first call on Android with "Network request failed"; second call succeeds (first-call initialization bug in RN's fetch + FormData file URI)
3. **✓ XMLHttpRequest** — reliable from first call; used by Axios for all JSON calls so it's pre-initialized. Implemented in `_xhrPost()` in `face.api.ts` with one automatic retry on network error

### Axios 401 interceptor skips FormData requests
In `axios.ts`, when the 401 response interceptor attempts to retry the original request, it checks `if (originalRequest.data instanceof FormData)` — if true, it re-throws without retrying via Axios. This prevents Axios from corrupting the FormData body on retry. The `faceUpload()` function handles its own 401 token refresh independently.

### Multi-timezone: unique_daily_checkin index must be dropped
The original `UNIQUE INDEX unique_daily_checkin ON attendance(user_id, DATE(checkin_time))` used naive Jakarta dates. With UTC storage, `DATE(checkin_time)` returns the UTC calendar date — which crosses midnight at a different wall-clock time than the site's local midnight. This index **must be dropped** (`migration_tz.sql`) and duplicate-checkin enforcement moved to the service layer: query by UTC range spanning the site-local calendar day (00:00–23:59:59 in site TZ → UTC).

### Config `TIMEZONE` setting is deprecated
`app/core/config.py` previously had `TIMEZONE: str = "Asia/Jakarta"` as a global. This setting is **deprecated** — timezone now comes from `site.timezone` per attendance record. Do not use this setting for any attendance or shift logic.

### attendance_service: `_now_jakarta()` removed
The module-level `_JAKARTA = ZoneInfo("Asia/Jakarta")` constant and `_now_jakarta()` helper have been **removed**. Use `_now_site(site.timezone)` which returns the current moment as an aware datetime in the site's local timezone. Store UTC in the DB by calling `.astimezone(timezone.utc)` before persisting.

### Mobile: timestamp display — complete
All mobile screens (`HomeScreen`, `HistoryScreen`, `CheckinModal`, `CheckoutModal`, `SubordinateAttendanceScreen`) use `Intl.DateTimeFormat` with `site_timezone` from the record. Timezone display is complete across all screens (fixed 2026-03-09).

### migration_tz.sql required for existing databases
Any database initialized before the timezone refactor must have `migration_tz.sql` applied. It:
1. Adds `timezone` column to `sites` (default `'Asia/Jakarta'`)
2. Converts all `TIMESTAMP` columns to `TIMESTAMPTZ` (interpreting existing data as `Asia/Jakarta`)
3. Drops the `unique_daily_checkin` DB index (duplicate checking moves to service layer)

---

## Web Admin Architecture Patterns

### Token Storage
- Access token: **memory only** — stored in `useAuthStore` React Context using `useRef` (never React state, to prevent re-renders on every token refresh)
- Refresh token: **sessionStorage** key `presensiv2_refresh_token` — automatically cleared when the browser tab closes
- NEVER localStorage (public web deployment, XSS risk)

### tokenAccessors Injection
`authStore.ts` exports a module-level `tokenAccessors` object with `getAccessToken()` and `setTokens()`. `AuthProvider` calls `injectTokenAccessors(tokenAccessors)` once on mount. Axios interceptors (which live outside React) call `tokenAccessors.getAccessToken()` to read the current token. The getter uses a `useRef` to avoid stale closures.

### 401 Refresh Queue
Identical pattern to mobile: first 401 triggers a refresh, subsequent 401s queue. On refresh failure: `window.dispatchEvent(new CustomEvent('auth:logout-required'))` → `AuthProvider` listens and calls `logout()`.

### Session Restore
`AuthProvider.useEffect([])` calls raw `fetch()` (NOT `apiClient`) to `POST /auth/refresh`. Using `apiClient` would trigger the 401 interceptor → refresh → 401 loop.

### Radix Select Sentinel Rule
Never use `value=""` on `<SelectItem>` — Radix throws an error. Use named sentinels:
- `'__none__'` → null (nullable foreign key selects)
- `'__all__'` → empty string / no filter (filter dropdowns)

### Attendance API Notes
- List endpoint: `GET /attendance/team` (not `/all`) — returns `TeamAttendanceRecord[]` with `employee_id`, `employee_name`, `site_name`, `site_timezone`
- `site_name` added 2026-04-14: both backend `TeamAttendanceRecord` schema and frontend `attendance.ts` type now include `site_name: string | null`, populated via `att.site.name`
- Detail endpoint: `GET /attendance/{id}` — returns `AttendanceDetail` with `latitude`, `longitude`, `auto_checkout`, `site_timezone`; does NOT include employee name
- Auto-checkout trigger: `POST /attendance/trigger-auto-checkout` (ADMIN only)

### Overtime API — employee fields available
`OvertimeRequestResponse` now includes `employee_id` and `employee_name` (denormalised from the submitter user). The schema's `from_orm` factory populates these via `att.user.employee_id` / `att.user.name`. The detail drawer still fetches `GET /attendance/{attendance_id}` for `site_timezone` and full attendance context.

---

## Security Measures

| Threat | Mitigation |
|--------|-----------|
| Brute-force login | Rate limit 10/min + account lock after 5 failures |
| JWT tampering | HS256 signature + `type` claim check (`access` vs `refresh`) |
| IDOR | Service layer verifies `user_id` ownership |
| Privilege escalation | `require_role()` on every sensitive endpoint |
| SQL injection | SQLAlchemy ORM parameterized queries only |
| XSS | `X-Content-Type-Options: nosniff`, `X-XSS-Protection` headers |
| Clickjacking | `X-Frame-Options: DENY` |
| GPS spoofing | Haversine distance logged; `OUT_OF_RADIUS` status auditable |
| Face spoofing | Cosine similarity threshold + reject >1 face |
| Audit trail | All login attempts logged to `audit_logs` |

---

## API Endpoints Summary

| Router | Prefix | Key endpoints |
|--------|--------|---------------|
| auth | `/auth` | POST /login, POST /refresh, GET /me |
| sites | `/sites` | GET /sites, POST /sites, PUT /sites/{id}, DELETE /sites/{id} |
| shifts | `/shifts` | CRUD + work_schedules + holidays |
| face | `/face` | POST /register, POST /verify, GET /status, DELETE / |
| attendance | `/attendance` | POST /checkin, POST /checkout, GET /me, GET /team, POST /trigger-auto-checkout |
| overtime | `/overtime` | POST /, GET /me, GET / (role-scoped), GET /{id}, GET /attendance/{att_id}, PATCH /{id}/approve, PATCH /{id}/reject |
| assignments | `/assignments` | GET / (filter by user_id/site_id/active_only), POST /, DELETE /{id} — ADMIN only |
| users | `/users` | CRUD user management |

Health check: `GET /health`

---

## Multi-Timezone Refactor: Code-Change Inventory

> This section tracks all files that must change to implement per-site WIB/WITA/WIT timezone support.
> Status: **COMPLETE (2026-03-09)** — all screens use `Intl.DateTimeFormat` with `site_timezone`. Backend uses UTC `TIMESTAMPTZ` with `ZoneInfo(site.timezone)` for business logic.

### Database / Schema

| File | Change |
|------|--------|
| `database.sql` | Add `timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta'` to `sites`; change all `TIMESTAMP` → `TIMESTAMPTZ`; remove `unique_daily_checkin` index |
| `backend/migration_tz.sql` *(new file)* | Migration for existing DBs: add `sites.timezone`, convert columns to `TIMESTAMPTZ`, drop `unique_daily_checkin` index |

```sql
-- migration_tz.sql (safe to run on existing databases)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta';
ALTER TABLE attendance ALTER COLUMN checkin_time TYPE TIMESTAMPTZ USING checkin_time AT TIME ZONE 'Asia/Jakarta';
ALTER TABLE attendance ALTER COLUMN checkout_time TYPE TIMESTAMPTZ USING checkout_time AT TIME ZONE 'Asia/Jakarta';
ALTER TABLE attendance ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Asia/Jakarta';
ALTER TABLE overtime_requests ALTER COLUMN requested_start TYPE TIMESTAMPTZ USING requested_start AT TIME ZONE 'Asia/Jakarta';
ALTER TABLE overtime_requests ALTER COLUMN requested_end TYPE TIMESTAMPTZ USING requested_end AT TIME ZONE 'Asia/Jakarta';
ALTER TABLE users ALTER COLUMN locked_until TYPE TIMESTAMPTZ USING locked_until AT TIME ZONE 'Asia/Jakarta';
DROP INDEX IF EXISTS unique_daily_checkin;
```

### Backend — Python

| File | Change Required |
|------|----------------|
| `app/core/config.py` | Add deprecation comment to `TIMEZONE` setting; do not remove (may still be referenced in legacy paths) |
| `app/core/database.py` | No change — `asyncpg` handles `TIMESTAMPTZ` natively |
| `app/models/models.py` | `Site`: add `timezone = Column(String(50), default="Asia/Jakarta", nullable=False)`; all `DateTime` columns → `DateTime(timezone=True)` across all models |
| `app/schemas/site.py` | Add `timezone: str = "Asia/Jakarta"` to `SiteCreate`, `SiteUpdate`, `SiteResponse`; add Pydantic validator restricting values to `{"Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"}` |
| `app/services/attendance_service.py` | **Most impacted.** Remove `_JAKARTA` + `_now_jakarta()`; add `_now_site(tz: str) -> datetime`; thread `site.timezone` through `_find_active_shift()`, `_determine_status()`, `checkin()`, `checkout()`, `run_auto_checkout()`; store UTC (`aware_dt.astimezone(utc)`); compare in site-local |
| `app/repositories/attendance_repository.py` | `get_today_checkin()`: accept `site_timezone`, convert date → UTC range (day start/end in site TZ → UTC). `get_all()`, `get_by_user()`, `get_team_attendance()`: same date-filter conversion; remove `func.date()` comparisons |
| `app/services/overtime_service.py` | Minimal: timestamp comparisons already in UTC; ensure callers send UTC-aware datetimes |
| `app/services/auth_service.py` | No change — `locked_until` already uses UTC via `_utcnow()` |

### Mobile — TypeScript

| File | Status | Notes |
|------|--------|-------|
| `src/types/auth.ts` | ✅ Done | `UserInfo.site_timezone: string \| null` present |
| `src/types/attendance.ts` | ✅ Done | `AttendanceRecord.site_timezone: string` and `TeamAttendanceRecord.site_timezone: string` present; `EmployeeSummary` type added |
| `src/screens/HomeScreen.tsx` | ✅ Done | `formatTime(iso, tz)` uses `Intl.DateTimeFormat` |
| `src/screens/HistoryScreen.tsx` | ✅ Done | `formatDate`/`formatTime` use `Intl.DateTimeFormat` with `record.site_timezone` |
| `src/components/CheckinModal.tsx` | ✅ Done | `formatTime` uses `siteTimezone` prop |
| `src/components/CheckoutModal.tsx` | ✅ Done | `formatTime` uses `siteTimezone` prop |
| `src/hooks/useAttendance.ts` | ✅ Done | `getTodayString(tz)` uses `Intl.DateTimeFormat('sv-SE', {timeZone: tz})` |
| `src/screens/SubordinateAttendanceScreen.tsx` | ✅ Done (2026-03-09) | Uses `Intl.DateTimeFormat` with `record.site_timezone` |
| `src/api/attendance.api.ts` | ✅ No change needed | Date strings passed as-is; backend interprets in site timezone |
