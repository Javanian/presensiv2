# PROMPT — Web Admin Frontend: Presensi Online SSB v2

> **File purpose:** Claude Code instruction prompt for building the Admin Web Frontend.
> Send this entire file as the first message to Claude Code from the project root.

---

## Project Context

This is a GPS + face-recognition based attendance management system for SSB (Sanggar Sarana Baja — a multi-site manufacturing company).

- **Backend:** COMPLETE — FastAPI, Phases 1–7 ✅
- **Mobile:** COMPLETE — React Native/Expo, Phases F1–F7 ✅
- **Web Admin:** 🔨 TO BUILD — browser-based admin panel (this project)

**Before writing a single line of code, read the following files:**
- `CLAUDE.md` — critical rules, architecture, known gotchas
- `backend.md` — all endpoints, schemas, RBAC, business logic behavior
- `database.sql` — single source of truth for DB schema
- `Aplikasi.md` — phase specifications

---

## Target Folder

```
presensiv2/
├── backend/        ← already exists, do NOT modify
├── mobile/         ← already exists, do NOT modify
└── web/            ← CREATE HERE (new folder)
```

Full path: `D:\Presensi Online SSB\presensiv2\web`

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + Vite |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 + shadcn/ui |
| API Client | Axios (JSON only) |
| Server State | @tanstack/react-query v5 |
| Forms | React Hook Form + Zod |
| Router | React Router v6 |
| Tables | TanStack Table v8 |
| Charts | recharts |
| Notifications | sonner (toast) |
| Icons | lucide-react |
| Auth Storage | Access token in **memory only** (React Context); refresh token in **sessionStorage** — NEVER localStorage |

---

## Non-Negotiable Rules

1. **No business logic in the frontend** — all validation, GPS checks, shift logic, overtime calculation, and face verification must remain in the backend only.
2. **Never redesign the DB schema** — follow `database.sql` and `backend.md` exactly.
3. **Secure token storage:**
   - Access token: store in **memory (React Context / useState)** — never localStorage.
   - Refresh token: **sessionStorage** only (cleared when browser tab closes).
   - Reason: this admin panel is a public web deployment — localStorage is too vulnerable to XSS.
4. **All timestamps must be displayed in the record's site timezone** using `Intl.DateTimeFormat` with the `site_timezone` field from the API response. Never use `new Date().toLocaleDateString()`. Never hardcode `"Asia/Jakarta"`.
5. **Strict RBAC enforcement** at the route level — page-level guards, not just UI hiding.
6. **Backend is the source of truth** — do not cache operational data (attendance, overtime) for more than 60 seconds.
7. **Build phase by phase** — wait for explicit confirmation before advancing to the next phase.

---

## Security Requirements (Public Web Deployment)

Because this panel will be deployed to a publicly accessible URL, implement the following:

### HTTP Security Headers

Add to `index.html`:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; connect-src 'self' https://YOUR_API_DOMAIN;
               img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
<meta http-equiv="Permissions-Policy" content="geolocation=(), camera=(), microphone=()">
```

### Axios Instance Security

- Every request must include `Authorization: Bearer <token>`
- Set `withCredentials: true`
- Timeout: `15000` ms
- **Response interceptors:**
  - `401` → attempt token refresh → retry original request → on failure: clear session + redirect to `/login`
  - `403` → toast "Access Denied"
  - `422` → extract `detail` from response body → display as toast (field-level errors shown inline in forms)
  - `500+` → generic server error toast
  - Network error → "No internet connection" toast
- **Never log tokens or sensitive response data to the console in production.** Use `import.meta.env.PROD` guard.

### Route Guards

```
/login               → public (redirect to /dashboard if already authenticated)
/dashboard/*         → require: authenticated + role ADMIN or SUPERVISOR
/users/*             → require: ADMIN only
/sites/*             → require: ADMIN only
/shifts/*            → require: ADMIN or SUPERVISOR
/holidays/*          → require: ADMIN only
/attendance/*        → require: ADMIN or SUPERVISOR
/overtime/*          → require: ADMIN or SUPERVISOR
/reports/*           → require: ADMIN or SUPERVISOR
```

### Input Sanitization

- All form inputs validated through a Zod schema **before** sending to the API
- Use `encodeURIComponent` for any user-supplied query parameters
- Never render raw HTML from API responses (`dangerouslySetInnerHTML` is forbidden)
- Validate image file type (JPEG/PNG only) and size before any upload

---

## Phase Breakdown

---

### PHASE W1 — Foundation & Authentication

**Goal:** Project setup, authentication flow, base layout.

**Deliverables:**

1. Initialize project:
   ```bash
   npm create vite@latest web -- --template react-ts
   cd web
   npm install
   ```

2. Install all dependencies:
   ```bash
   npm install axios @tanstack/react-query react-router-dom react-hook-form zod
   npm install @tanstack/react-table recharts sonner lucide-react
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   # initialize shadcn/ui
   npx shadcn@latest init
   ```

3. Folder structure:
   ```
   web/
   ├── public/
   ├── src/
   │   ├── api/
   │   │   ├── axios.ts            ← Axios instance + all interceptors
   │   │   └── auth.api.ts         ← login, refresh, me
   │   ├── components/
   │   │   ├── ui/                 ← shadcn/ui components
   │   │   └── layout/
   │   │       ├── Sidebar.tsx
   │   │       ├── TopBar.tsx
   │   │       └── AppLayout.tsx
   │   ├── hooks/
   │   │   └── useAuth.ts
   │   ├── pages/
   │   │   ├── LoginPage.tsx
   │   │   └── DashboardPage.tsx   ← placeholder
   │   ├── router/
   │   │   ├── index.tsx
   │   │   └── ProtectedRoute.tsx
   │   ├── store/
   │   │   └── authStore.ts        ← React Context, token in memory
   │   ├── types/
   │   │   └── auth.ts
   │   └── utils/
   │       └── toast.ts
   ├── .env
   ├── .env.example
   ├── .gitignore
   ├── index.html
   ├── tailwind.config.ts
   ├── vite.config.ts
   └── tsconfig.json
   ```

4. Auth flow:
   - `POST /auth/login` → store access token in memory (authStore Context)
   - `GET /auth/me` → populate user info (`name`, `role`, `site_id`, `site_timezone`)
   - On app init (SplashScreen equivalent): attempt `POST /auth/refresh` using sessionStorage refresh token → if fails → redirect to `/login`
   - Logout → clear memory + clear sessionStorage + redirect to `/login`

5. Login Page UI:
   - App logo + name
   - Form: Email or Employee ID + Password
   - Error handling: account locked message, wrong credentials, rate limit (429)
   - Loading state on submit
   - No "Remember me" option (intentional — admin panel should not persist sessions across browser restarts)

6. Sidebar navigation (role-aware):
   - **ADMIN:** Dashboard, Users, Sites, Shifts, Holidays, Attendance, Overtime, Reports
   - **SUPERVISOR:** Dashboard, Shifts, Attendance, Overtime

**Environment variables:**
```env
# web/.env.example
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=15000
VITE_APP_NAME=Presensi Online SSB v2
```

**Vite config (vite.config.ts) — dev proxy:**
```typescript
server: {
  proxy: {
    '/api': {
      target: env.VITE_API_BASE_URL || 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

---

### PHASE W2 — User Management

**Goal:** ADMIN can manage all system users.

**Endpoints used:**
- `GET /users` — list all users *(check backend.md; note as TODO if endpoint is missing)*
- `POST /users` or equivalent registration endpoint
- `PUT /users/{id}`
- `DELETE /users/{id}`
- `GET /sites` — for site assignment dropdown
- `GET /users/{id}` — user detail

**New files:**
```
src/api/users.api.ts
src/pages/users/UsersPage.tsx
src/pages/users/UserDetailPage.tsx
src/components/users/UserFormModal.tsx
```

**Page `/users`:**
- TanStack Table with columns: `employee_id`, `name`, `email`, `role badge`, `site`, `status (active / locked)`, `face registered (yes/no)`
- Server-side pagination, filtering by role / site / status, search by name or employee_id
- Action buttons: **Add User**, **Edit** (row), **Reset Password**, **Toggle Active/Lock**
- Role badges: ADMIN = red, SUPERVISOR = amber, EMPLOYEE = green

**Add / Edit User (Dialog modal):**
- Fields: `employee_id`*, `name`*, `email`*, `password` (create only), `role`*, `site_id` (dropdown), `supervisor_id` (dropdown — visible only when role = EMPLOYEE)
- Zod validation: valid email format, password min 8 characters on create
- Backend field-level errors displayed inline under the relevant input

**User Detail Page `/users/{id}`:**
- Full user info card
- Face embedding status badge (registered / not registered)
- Button: **Delete Face Embedding** (ADMIN only, with confirmation dialog)
- Recent audit log entries if available

---

### PHASE W3 — Site & Shift Management

**Goal:** Manage work locations, shifts, schedules, and public holidays.

#### Sites (`/sites`) — ADMIN only

**Endpoints:** `GET /sites`, `POST /sites`, `PUT /sites/{id}`, `DELETE /sites/{id}`

**New files:**
```
src/api/sites.api.ts
src/pages/sites/SitesPage.tsx
src/components/sites/SiteFormModal.tsx
```

**Page `/sites`:**
- Card grid or table: site name, coordinates, radius (meters), timezone label (WIB/WITA/WIT), employee count
- Buttons: Add Site, Edit, Delete (with confirmation)

**Site Form:**
- Fields: `name`*, `latitude`*, `longitude`*, `radius_meter`*, `timezone`* (dropdown: `Asia/Jakarta — WIB (UTC+7)` | `Asia/Makassar — WITA (UTC+8)` | `Asia/Jayapura — WIT (UTC+9)`)
- Optional: display a static coordinate preview link to Google Maps

---

#### Shifts (`/shifts`) — ADMIN + SUPERVISOR

**Endpoints:**
- `GET /shifts`, `POST /shifts`, `PUT /shifts/{id}`, `DELETE /shifts/{id}`
- `POST /shifts/{id}/schedules`, `DELETE /shifts/{id}/schedules/{schedule_id}`

**New files:**
```
src/api/shifts.api.ts
src/pages/shifts/ShiftsPage.tsx
src/components/shifts/ShiftFormModal.tsx
src/components/shifts/ScheduleManagerModal.tsx
```

**Page `/shifts`:**
- Table: shift name, site, start time, end time, cross-midnight badge, standard work hours
- Filter by site
- Buttons: Add Shift, Edit, Delete, **Manage Schedule**

**Shift Form:**
- Fields: `site_id`* (dropdown), `name`*, `start_time`*, `end_time`*, `work_hours_standard`*
- Auto-detect cross-midnight: show warning badge when `end_time < start_time`

**Schedule Manager (modal):**
- 7 day checkboxes (Sunday–Saturday, matching `day_of_week` 0–6)
- When a day is checked: input field for `toleransi_telat_menit` (late tolerance in minutes)
- Save → POST `/shifts/{id}/schedules` for each checked day
- Delete → DELETE `/shifts/{id}/schedules/{schedule_id}`

---

#### Holidays (`/holidays`) — ADMIN only

**Endpoints:** `GET /holidays`, `POST /holidays`, `PUT /holidays/{id}`, `DELETE /holidays/{id}`

**New files:**
```
src/pages/holidays/HolidaysPage.tsx
src/components/holidays/HolidayFormModal.tsx
```

**Page `/holidays`:**
- Table: date, description, is_national badge (National / Custom)
- Buttons: Add Holiday, Edit, Delete

---

### PHASE W4 — Attendance Monitoring

**Goal:** 
Admins can monitor all attendance records.
Supervisors can monitor the attendance records of their subordinates.

**Endpoints:**
- `GET /attendance/all` — all records (ADMIN)
- `GET /attendance/team` — subordinates attendance record
- `GET /attendance/{id}` — single record detail
- `POST /attendance/auto-checkout` — manual trigger (ADMIN only)

**New files:**
```
src/api/attendance.api.ts
src/pages/attendance/AttendancePage.tsx
src/components/attendance/AttendanceDetailModal.tsx
src/utils/datetime.ts   ← formatDateTime(iso, siteTimezone), formatDuration(minutes)
```

**Page `/attendance`:**
- Filter bar:
  - Date range picker (default: today)
  - Site dropdown
  - Status filter (ONTIME / LATE / OUT_OF_RADIUS)
  - Search by employee name or employee_id
- Table columns: `employee_id`, `name`, `site`, `shift`, `check-in time`, `check-out time`, `status badge`, `work duration`, `overtime minutes`, `auto-checkout badge`
- **All times displayed in site timezone** using `Intl.DateTimeFormat` + `record.site_timezone`
- Row click → attendance detail modal
- **Export CSV** button (client-side, from currently fetched/filtered data)
- **Trigger Auto-Checkout** button — ADMIN only, requires confirmation dialog before firing

**Status badges:**
- `ONTIME` → green
- `LATE` → amber/yellow
- `OUT_OF_RADIUS` → red

**Attendance Detail Modal:**
- All attendance fields
- GPS coordinates + Google Maps link: `https://maps.google.com/?q={latitude},{longitude}`
- Related overtime request info (if any)

---

### PHASE W5 — Overtime Management

**Goal:** ADMIN and SUPERVISOR can review and approve/reject overtime requests.

**Endpoints:**
- `GET /overtime/all` — all requests
- `GET /overtime/{id}` — single request detail
- `PATCH /overtime/{id}/approve`
- `PATCH /overtime/{id}/reject`

**New files:**
```
src/api/overtime.api.ts
src/pages/overtime/OvertimePage.tsx
src/components/overtime/OvertimeDetailDrawer.tsx
```

**Page `/overtime`:**
- Tab filter: **All** | **PENDING** | **APPROVED** | **REJECTED**
- Secondary filters: date range, site, employee search
- Table: `employee`, `attendance date`, `requested start`, `requested end`, `duration (min)`, `status badge`, `approved by`
- All times displayed in site timezone
- Row click → detail drawer/sheet with Approve / Reject buttons

**Approve / Reject Drawer:**
- Show linked attendance info: check-in time, check-out time, total work duration
- Show requested overtime window
- **Approve** button (green) + **Reject** button (red)
- Both require a confirmation dialog before firing
- Loading state during API call; close drawer and refresh list on success

**Status badges:**
- `PENDING` → amber
- `APPROVED` → green
- `REJECTED` → red/slate

---

### PHASE W6 — Dashboard & Reports

**Goal:** Summary overview and exportable reports.

**New files:**
```
src/pages/DashboardPage.tsx     ← replaces placeholder from W1
src/pages/reports/ReportsPage.tsx
src/components/dashboard/StatsCard.tsx
src/components/dashboard/AttendanceChart.tsx
```

**Dashboard (`/dashboard`):**

Stats cards (derived from attendance API, filtered to today):
- Total check-ins today
- ONTIME count
- LATE count
- OUT_OF_RADIUS count
- Pending overtime approvals

Charts (recharts):
- Bar chart: attendance status per site (last 7 days)
- Line chart: daily attendance trend for the current month

Recent activity table:
- Last 10 check-ins, auto-refreshes every 30 seconds (`refetchInterval: 30000`)

**Reports Page (`/reports`):**
- Filter form: site (dropdown), date range (max 31 days enforced by Zod), employee name/ID (optional)
- **Generate Report** button → fetch → render table + summary row
- Summary: total present, average work duration, total overtime minutes, breakdown by status
- **Export CSV** (client-side from fetched data)

---

## API Layer Structure

Mirror the pattern from `mobile/src/api/`:

```
src/api/
├── axios.ts            ← single Axios instance + all interceptors (auth, error handling)
├── auth.api.ts         ← login, refresh, me
├── users.api.ts        ← list, create, update, delete, get by id
├── sites.api.ts        ← CRUD sites
├── shifts.api.ts       ← CRUD shifts + manage schedules + CRUD holidays
├── attendance.api.ts   ← getAll, getById, triggerAutoCheckout
└── overtime.api.ts     ← getAll, getById, approve, reject
```

---

## Shared Utility: `src/utils/datetime.ts`

```typescript
// Always use site_timezone from API — never device timezone or hardcoded "Asia/Jakarta"

export function formatDateTime(isoString: string, siteTimezone: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: siteTimezone,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

export function formatTime(isoString: string, siteTimezone: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: siteTimezone,
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
```

---

## UI / UX Guidelines

| Concern | Guideline |
|---------|-----------|
| Theme | Professional / enterprise. Neutral slate/gray base with blue primary actions. |
| Layout | Fixed left sidebar + scrollable main content + top bar. |
| Sidebar | Collapsible on mobile, always visible on desktop (≥ 1024px). |
| Tables | Sticky header, row hover highlight, skeleton loader on initial fetch. |
| Modals | Use shadcn `Dialog` for forms, `Sheet` (drawer) for detail views. |
| Toast | sonner for all notifications (success / error / info). |
| Loading | Skeleton on initial load; spinner on action buttons (submit, delete, approve). |
| Empty state | Illustration or descriptive message when data is empty. |
| Error state | Show error message + **Retry** button when a fetch fails. |
| Destructive actions | Always require a shadcn `AlertDialog` confirmation before delete / reject. |
| Responsive | Fully responsive: mobile (360px) → tablet (768px) → desktop (1280px+). Touch-friendly tap targets (min 44×44px). |
| Accessibility | All interactive elements must have accessible labels. Use semantic HTML. |

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Mobile < 768px | Sidebar hidden, toggle via hamburger menu (Sheet/Drawer). Tables switch to card-list layout. |
| Tablet 768px–1023px | Sidebar collapsible (icon-only mode). Tables show reduced columns. |
| Desktop ≥ 1024px | Full sidebar always visible. Tables show all columns. |

- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:` — never fixed pixel widths.
- All buttons and interactive elements must have min touch target `h-11` (44px) for mobile usability.
- Forms in modals should be full-screen Sheet on mobile, centered Dialog on desktop.
- Data tables on mobile: hide low-priority columns (`hidden md:table-cell`), show only essential columns (name, status, time).
- Font sizes must scale: use `text-sm` on mobile, `text-base` on desktop for table content.
- Avoid horizontal scroll — prioritize column hiding over overflow.

---

Design the UI using this corporate color system.

--- CORE PALETTE ---

Background:
  Page background:  #FFFFFF (white, 65% of visible UI)
  Surface/Card bg:  #F5F9FC (very light blue-tinted white, for cards, sidebar, table rows alt)

Primary brand color:
  Light Blue #6FB0CC (20%)
  Use ONLY as: section backgrounds, hero/banner fills, info block backgrounds,
  horizontal rule accents, icon fills, input focus rings.
  ⚠ NEVER use #6FB0CC as text color — contrast ratio is too low for readability.

Secondary brand color:
  Dark Blue #1C7FAF (10%)
  Use for: navigation bar background, sidebar active item, headings (H1–H3),
  footer, table header backgrounds, structural components, links.
  ✅ Safe for text on white background (contrast 4.6:1).

Accent color:
  Orange #F79A1B (3%)
  Use ONLY for: CTA buttons, active/selected state indicators, important action badges.
  When used as button background, use dark text (#1A1A1A) NOT white text
  (white on #F79A1B fails WCAG contrast).
  Avoid overusing orange. Max 1–2 orange elements per screen.

Neutral:
  Light Gray #E9E9E9 (2%)
  Use for: dividers, table borders, input borders (inactive), subtle separators.

--- TEXT COLORS ---

Primary text:   #1A2B3C   (dark navy, for body text, table cells, form labels)
Secondary text: #5A7184   (muted, for subtitles, helper text, timestamps)
Disabled text:  #A0AEC0   (for disabled inputs and inactive states)
Link color:     #1C7FAF   (same as secondary brand — consistent)
Inverse text:   #FFFFFF   (on dark blue or orange backgrounds)

--- SEMANTIC / STATUS COLORS ---
(These are standard UI colors, do not replace with brand colors)

Success:   #16A34A  background: #DCFCE7  (ONTIME, APPROVED, positive states)
Warning:   #D97706  background: #FEF3C7  (LATE, PENDING, caution states)
Danger:    #DC2626  background: #FEE2E2  (OUT_OF_RADIUS, REJECTED, errors, delete)
Info:      #1C7FAF  background: #DBEAFE  (informational — reuse brand Dark Blue)

Status badges should use light background + dark text of the same semantic color family.
Example: ONTIME → bg #DCFCE7, text #15803D.

--- DESIGN PRINCIPLES ---

1. White and #F5F9FC dominate the layout — the interface must feel open and light.
2. Light Blue (#6FB0CC) is the main visual brand color — use it as backgrounds
   and decorative fills, never as text.
3. Dark Blue (#1C7FAF) defines structure and hierarchy — nav, headings, key UI frames.
4. Orange (#F79A1B) is reserved strictly for call-to-action. Use it sparingly.
   Maximum 1–2 orange elements visible at any time.
5. Status colors (success/warning/danger) must follow semantic meaning consistently
   across all pages — do not substitute brand colors for status indicators.
6. Maintain WCAG AA contrast compliance on all text elements.
7. Keep the interface minimal and professional — no gradients, no shadows heavier
   than shadow-sm, no decorative patterns.


## `.gitignore` additions

```
# web
web/node_modules
web/.env
web/dist
web/.env.local
```

---

## Known Backend Dependencies to Verify

Before implementing each phase, confirm these endpoints exist in `backend.md`. If missing, note as TODO and do not mock:

| Phase | Endpoint to verify |
|-------|--------------------|
| W2 | `GET /users` (list all users with pagination + filters) |
| W2 | `POST /users` (admin user creation) |
| W2 | `PUT /users/{id}` (update user) |
| W4 | `GET /attendance/all` supports `from_date`, `to_date`, `site_id`, `status` query params |
| W5 | `GET /overtime/all` supports `status`, `from_date`, `to_date`, `site_id` query params |
| W6 | Dashboard aggregate stats — may need to derive from existing endpoints |

---

## Instructions for Claude Code

1. **Start with Phase W1 only.** Do not begin W2 until W1 is explicitly confirmed.
2. Before each phase, **re-read `backend.md`** to verify every endpoint used in that phase.
3. If a required endpoint does not exist in `backend.md`, **log it as a TODO comment** — do not create a mock or client-side workaround.
4. **Never use `localStorage`** for tokens. Access token → memory. Refresh token → sessionStorage.
5. Every timestamp displayed to the user must go through `formatDateTime(iso, record.site_timezone)` — never `new Date().toLocaleDateString()` and never `"Asia/Jakarta"` hardcoded.
6. Use `import.meta.env.PROD` to suppress sensitive logs in production builds.
7. Follow naming conventions from `mobile/` and `backend/` — camelCase for TypeScript, snake_case matches the API field names.
8. Never commit `.env` — ensure it is listed in `.gitignore` before the first commit.
9. Use `import.meta.env.VITE_*` for all environment variables in Vite.
10. All form validation schemas (Zod) must be co-located with their form component.

---

## Start Here: Phase W1

Please begin with **Phase W1 — Foundation & Authentication**.

Execution order:
1. Create the `web/` directory at the project root
2. Initialize Vite + React + TypeScript
3. Install and configure Tailwind CSS + shadcn/ui + all dependencies
4. Build the full folder structure
5. Implement the auth flow (login, access token in memory, refresh token in sessionStorage, route guard, `/auth/me`)
6. Implement base layout (sidebar + top bar + AppLayout wrapper)
7. Implement a fully functional and secure Login page

After W1 is complete and confirmed working, proceed to W2.