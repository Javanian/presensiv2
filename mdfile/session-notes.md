# Session Notes — HRIS SSB Web Admin
**Last updated:** 2026-03-11
**Scope:** Phases W1–W6 complete

---

## Phase Completion Summary

| Phase | Scope | Status |
|-------|-------|--------|
| W1 | Foundation & Authentication | ✅ Complete |
| W2 | User Management | ✅ Complete |
| W3 | Site & Shift Management | ✅ Complete |
| W4 | Attendance Monitoring | ✅ Complete |
| W5 | Overtime Management | ✅ Complete |
| W6 | Dashboard & Reports | ✅ Complete |

---

## All Web Files — Current State

```
web/
├── public/
│   └── ssb.svg                               ← corporate logo (favicon)
├── src/
│   ├── api/
│   │   ├── auth.api.ts                       ← W1: login, refresh, me
│   │   ├── axios.ts                          ← W1: Axios instance + interceptors
│   │   ├── attendance.api.ts                 ← W4: getTeam, getById, triggerAutoCheckout
│   │   ├── overtime.api.ts                   ← W5: list, getById, approve, reject
│   │   ├── shifts.api.ts                     ← W3: CRUD shifts + schedules + holidays
│   │   ├── sites.api.ts                      ← W3: CRUD sites
│   │   └── users.api.ts                      ← W2: list, create, update, delete, getById
│   ├── components/
│   │   ├── attendance/
│   │   │   └── AttendanceDetailModal.tsx     ← W4: detail dialog with GPS link
│   │   ├── holidays/
│   │   │   └── HolidayFormModal.tsx          ← W3: create/edit holiday
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx                 ← W1: sidebar + topbar shell
│   │   │   ├── Sidebar.tsx                   ← W1: role-aware nav (ADMIN vs SUPERVISOR)
│   │   │   └── TopBar.tsx                    ← W1: user info + logout
│   │   ├── overtime/
│   │   │   └── OvertimeDetailDrawer.tsx      ← W5: detail + approve/reject dialog
│   │   ├── shifts/
│   │   │   ├── ScheduleManagerModal.tsx      ← W3: 7-day schedule editor
│   │   │   └── ShiftFormModal.tsx            ← W3: create/edit shift
│   │   ├── sites/
│   │   │   └── SiteFormModal.tsx             ← W3: create/edit site
│   │   ├── ui/
│   │   │   ├── alert-dialog.tsx              ← Radix AlertDialog (destructive actions)
│   │   │   ├── badge.tsx                     ← CVA badge: success/warning/danger/info/admin/supervisor/employee
│   │   │   ├── button.tsx                    ← CVA button: default/accent/destructive/outline/ghost/link
│   │   │   ├── checkbox.tsx                  ← W3: used in ScheduleManagerModal
│   │   │   ├── dialog.tsx                    ← Radix Dialog
│   │   │   ├── input.tsx                     ← styled input with brand focus ring
│   │   │   ├── label.tsx                     ← Radix Label wrapper
│   │   │   ├── select.tsx                    ← Radix Select
│   │   │   └── skeleton.tsx                  ← pulse animation placeholder
│   │   └── users/
│   │       └── UserFormModal.tsx             ← W2: create/edit user (two separate forms)
│   ├── hooks/
│   │   └── useAuth.ts                        ← W1: useLogin, useLogout, useCurrentUser, useHasRole
│   ├── lib/
│   │   ├── queryClient.ts                    ← W1: React Query client instance
│   │   └── utils.ts                          ← W1: cn() helper (clsx + tailwind-merge)
│   ├── pages/
│   │   ├── DashboardPage.tsx                 ← W1 placeholder (to be replaced in W6)
│   │   ├── LoginPage.tsx                     ← W1: login form, error handling
│   │   ├── attendance/
│   │   │   └── AttendancePage.tsx            ← W4: monitoring page
│   │   ├── holidays/
│   │   │   └── HolidaysPage.tsx              ← W3: holiday table + CRUD
│   │   ├── overtime/
│   │   │   └── OvertimePage.tsx              ← W5: overtime list + status tabs
│   │   ├── shifts/
│   │   │   └── ShiftsPage.tsx                ← W3: shift table + schedule management
│   │   ├── sites/
│   │   │   └── SitesPage.tsx                 ← W3: site cards + CRUD
│   │   └── users/
│   │       ├── UserDetailPage.tsx            ← W2: user info + face management
│   │       └── UsersPage.tsx                 ← W2: user table + search/filter
│   ├── router/
│   │   ├── ProtectedRoute.tsx                ← W1: role-guard wrapper
│   │   ├── PublicRoute.tsx                   ← W1: redirect if authenticated
│   │   └── index.tsx                         ← W1–W5: all routes wired
│   ├── store/
│   │   ├── AuthProvider.tsx                  ← W1: session restore + logout event listener
│   │   └── authStore.ts                      ← W1: React Context + tokenAccessors injection
│   ├── types/
│   │   ├── attendance.ts                     ← W4: TeamAttendanceRecord, AttendanceDetail, AutoCheckoutResult
│   │   ├── auth.ts                           ← W1: LoginPayload, TokenResponse, UserInfo, UserRole
│   │   ├── overtime.ts                       ← W5: OvertimeRequest, OvertimeStatus
│   │   └── users.ts                          ← W2: UserListItem, CreateUserPayload, UpdateUserPayload
│   └── utils/
│       ├── datetime.ts                       ← W2: formatDateTime/Date/Time/Duration (always pass siteTimezone)
│       └── toast.ts                          ← W1: showSuccess, showError, showInfo wrappers
├── .env                                      ← VITE_API_BASE_URL=http://localhost:8000
├── index.html                                ← title: "HRIS SSB", favicon: /ssb.svg
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## Phase Details

### W1 — Foundation & Authentication

**Completed work:**
- Vite + React 18 + TypeScript strict project initialized
- Tailwind CSS v3 configured with brand color palette (`brand`, `accent`, `surface`, `text-primary`, `text-secondary`, `divider`)
- shadcn/ui components: button, input, label, dialog, alert-dialog, select, badge, skeleton
- Axios instance (`api/axios.ts`): Bearer token injection, 401 refresh queue, 403/422/500/network error toasts
- Auth flow: `POST /auth/login` → `GET /auth/me` → store in React Context; session restore via `AuthProvider.useEffect`
- Token storage: access token in **memory only** (React Context), refresh token in **sessionStorage**
- `tokenAccessors.setTokens()`/`getAccessToken()` injection pattern bridges Axios (outside React) to Context (inside React)
- LoginPage: email/employee_id + password form, error messages, loading state
- AppLayout: Sidebar (role-aware nav) + TopBar (user info + logout)
- Router: ProtectedRoute (role guard), PublicRoute (redirect if authed)
- Browser tab: title "HRIS SSB", favicon `ssb.svg`

### W2 — User Management (ADMIN only)

**Completed work:**
- `GET/POST/PUT/DELETE /users` + `GET /users/{id}` wired (requires backend users router)
- UsersPage: TanStack Table, search by name/employee_id, role filter, server-side pagination (20/page)
- UserFormModal: create (employee_id, name, email, password, role, site, supervisor) + edit (no password field, has is_active toggle). Two separate useForm instances for type safety
- UserDetailPage: user info card + face status + "Delete Face Embedding" for ADMIN
- Scroll restoration: sessionStorage-based scroll position preserved when navigating to/from detail page; deferred restore pattern fires after React Query finishes loading (not on mount)
- `datetime.ts` utility created: `formatDateTime`, `formatDate`, `formatTime`, `formatDuration` — all require explicit `siteTimezone` arg

**Bug fixed — Radix Select empty string:**
Never use `value=""` on `<SelectItem>`. Use sentinel strings (`__none__`, `__all__`) and convert in `onValueChange`. Applies to all Selects throughout the codebase.

### W3 — Site & Shift Management

**Completed work:**
- SitesPage: card grid, CRUD (POST/PATCH/DELETE /sites), timezone badge (WIB/WITA/WIT), Google Maps preview link
- SiteFormModal: name, latitude, longitude, radius_meter, timezone dropdown (3 options: Asia/Jakarta, Asia/Makassar, Asia/Jayapura)
- ShiftsPage: table with shift details, site filter, cross-midnight badge, CRUD + Schedule Manager
- ShiftFormModal: site dropdown, name, start_time, end_time, work_hours_standard; auto-detects cross-midnight when `end_time < start_time`
- ScheduleManagerModal: 7-day checkbox grid (0=Sunday…6=Saturday), each checked day gets `toleransi_telat_menit` input
- HolidaysPage: table with CRUD (POST/PUT/DELETE /holidays), is_national badge
- `checkbox.tsx` shadcn component added

### W4 — Attendance Monitoring

**Completed work:**
- `GET /attendance/team` used for list (not `/attendance/all`) — includes `employee_id`, `employee_name`, `site_timezone`; backend auto-scopes ADMIN→all, SUPERVISOR→subordinates
- `GET /attendance/{id}` fetched inside detail modal for `latitude`, `longitude`, `auto_checkout`
- AttendancePage: date range filter (native `<input type="date">`), status filter (client-side), employee search (client-side), stats row (total/ontime/late/out-of-radius), table, Export CSV
- Table: all headers center-aligned; ID/check-in/check-out/duration/status/notes cells center-aligned; employee name cell left-aligned
- Check-in/Check-out columns: date line (`text-xs text-text-secondary`) stacked above time line (`text-sm font-medium`)
- Trigger Auto-Checkout button (ADMIN only) + confirmation AlertDialog
- Export CSV: client-side from filtered data, UTF-8 BOM for Excel compatibility
- AttendanceDetailModal: Karyawan / Waktu / Durasi / Status / Lokasi GPS sections; Google Maps link when lat/lon available
- `POST /attendance/trigger-auto-checkout` endpoint (not `/auto-checkout`)

**Endpoint clarification:**
The team endpoint is `GET /attendance/team` (not `/attendance/all`). The `TeamAttendanceRecord` schema includes `site_timezone` but NOT `auto_checkout`/`lat`/`lon` — those come from `GET /attendance/{id}`.

### W5 — Overtime Management

**Completed work:**
- `GET /overtime` (with optional `?status=PENDING|APPROVED|REJECTED` filter), `GET /overtime/{id}`, `PATCH /overtime/{id}/approve`, `PATCH /overtime/{id}/reject`
- OvertimePage: status tab filter (Semua/Menunggu/Disetujui/Ditolak) with server-side status param; summary cards (pending/approved/rejected counts); search by request ID or attendance ID; table; row click → detail drawer
- OvertimeDetailDrawer (implemented as Dialog): fetches `/overtime/{id}` (fresh status) + `/attendance/{attendance_id}` (for site_timezone + checkin/checkout context); Approve/Reject buttons (ADMIN/SUPERVISOR only, PENDING status only); each action requires confirmation AlertDialog

**API limitation:** `OvertimeRequestResponse` does NOT include `employee_name` or `employee_id`. The list table shows `#request_id` and `#attendance_id` only. Employee name is not available without an extra request. The detail drawer shows `attendance_id` as reference; user can cross-check via Attendance page.

**Timestamp display in list:** List table uses browser locale (`Intl.DateTimeFormat('id-ID')` without explicit `timeZone`) since site_timezone is not available per overtime record. The detail drawer uses correct `site_timezone` fetched from the linked attendance record.

---

## Architecture Patterns (Web Admin)

### Token Storage
- Access token: **memory only** (React Context via `useAuthStore`)
- Refresh token: **sessionStorage** key `presensiv2_refresh_token` — cleared when tab closes
- NEVER localStorage

### Axios 401 Refresh Flow
1. Request fails with 401
2. Interceptor adds request to queue, fires one `POST /auth/refresh`
3. On refresh success: update token, retry all queued requests
4. On refresh failure: `window.dispatchEvent(new CustomEvent('auth:logout-required'))` → `AuthProvider` calls `logout()`

### tokenAccessors Injection Pattern
- `authStore.ts` exports `tokenAccessors = { getAccessToken, setTokens }` (module-level object)
- `AuthProvider` calls `injectTokenAccessors(tokenAccessors)` once on mount — this bridges Axios interceptors (which run outside React) to the in-memory token (stored inside React state via useRef)
- `useRef` inside the store prevents stale closures in the getter

### useLogin Timing
- Call `tokenAccessors.setTokens(access, refresh)` BEFORE `authApi.me()` — so the /me request has a Bearer token
- Then call `login(tokenData, user)` to commit to React state

### Session Restore
- `AuthProvider.useEffect([])` calls raw `fetch()` (not apiClient) to `POST /auth/refresh` using sessionStorage token
- Using `apiClient` would cause an interceptor loop (401 → refresh → 401 → ...)

### Radix Select Rule
Never use `value=""` on `<SelectItem>`. The component throws:
> A `<Select.Item />` must have a value prop that is not an empty string.

Use sentinel strings and convert in onValueChange:
```tsx
// For nullable selects:
value={field.value != null ? field.value.toString() : '__none__'}
onValueChange={(v) => field.onChange(v === '__none__' ? null : parseInt(v))}

// For "all" filters:
value={filter || '__all__'}
onValueChange={(v) => setFilter(v === '__all__' ? '' : v)}
```

### Timestamp Display
- `web/src/utils/datetime.ts` exports `formatDateTime`, `formatDate`, `formatTime`, `formatDuration`
- All accept `siteTimezone: string` as second arg — always pass it from `record.site_timezone`
- **Never** use `new Date().toLocaleDateString()` or hardcode `"Asia/Jakarta"`
- Exception: overtime list table uses browser locale (no explicit tz) because site_timezone is not available in the OT list response

### UserFormModal: Two useForm Instances
Create and Edit use different Zod schemas (Create has `employee_id` + `password` required; Edit has `is_active` toggle). Each form destructured with unique prefix (`regCreate`/`regEdit`, `handleCreate`/`handleEdit`, `errorsCreate`/`errorsEdit`) and rendered in separate JSX branches.

---

## Key Rules Going Forward

1. **Radix Select:** Never `value=""` — use sentinel strings
2. **Timestamps:** Always pass `siteTimezone` to `formatDateTime/Date/Time`
3. **No backend logic in frontend:** All calculations stay in backend
4. **staleTime:** `60_000` for relatively stable data (users, sites, shifts, holidays); `30_000` for operational data (attendance, overtime)
5. **Invalidation:** Always `void qc.invalidateQueries({ queryKey: [...] })` after mutations
6. **Endpoint names:** `GET /attendance/team` (not `/all`), `POST /attendance/trigger-auto-checkout`

---

## Dev Commands

```bash
# Start web dev server
cd web && npm run dev    # → http://localhost:5173

# Type check
cd web && npx tsc --noEmit

# Build
cd web && npm run build
```

---

## Test Credentials

| Role | Login | Password | Web Admin Access |
|------|-------|----------|-----------------|
| ADMIN | `admin@presensiv2.local` | `Admin@123` | All pages |
| SUPERVISOR | `spv101@ptssb.co.id` | `12345` | Shifts, Attendance, Overtime |

---

## Phase W6 — Dashboard & Reports (Complete)

### W6 completed work:

**New files created:**
```
src/components/dashboard/StatsCard.tsx       ← presentational stat card with variant colors + skeleton
src/components/dashboard/AttendanceChart.tsx ← recharts BarChart: 7-day trend grouped by status
src/pages/reports/ReportsPage.tsx            ← full reports page
```

**Files replaced/modified:**
- `src/pages/DashboardPage.tsx` — replaced placeholder with 3 queries + 4 stat cards + chart + activity table
- `src/router/index.tsx` — replaced ComingSoon with ReportsPage; removed unused ComingSoon component
- `src/components/layout/Sidebar.tsx` — added "Laporan" to SUPERVISOR_NAV

**Dashboard data flow:**
- Q1: `GET /attendance/team?from_date=today&to_date=today` — drives 3 stat cards + recent activity; `refetchInterval: 30_000`, `staleTime: 0`
- Q2: `GET /attendance/team?from_date=6daysago&to_date=today` — drives BarChart; `staleTime: 60_000`
- Q3: `GET /overtime?status=PENDING&limit=200` — drives "Lembur Pending" card; `staleTime: 30_000`
- Recent activity: last 10 from Q1 sorted by `checkin_time DESC`

**Reports page:**
- Form: from_date, to_date (Zod: max 31 day diff), employee_search, status_filter (native `<select>`)
- Manual trigger: `enabled: queryParams !== null`, form submit sets queryParams state
- Client-side filter: employee_search (name + ID case-insensitive) + status_filter applied to rawData
- 6 summary StatsCard: total, ontime (+ %), late (+ %), out_of_radius (+ %), avg durasi, total lembur
- Table: No / Nama / ID (md+) / Tanggal / Check-In / Check-Out (lg+) / Durasi (lg+) / Lembur (xl+) / Status
- CSV export: UTF-8 BOM, uses `formatDate`/`formatTime` with `site_timezone`

**Chart implementation (AttendanceChart.tsx):**
- X-axis labels built from UTC date slice `checkin_time.slice(0, 10)`; `Intl.DateTimeFormat('id-ID', { weekday:'short', day:'numeric', month:'short' })`
- 3 grouped bars: ONTIME (#22c55e), LATE (#f59e0b), OUT_OF_RADIUS (#ef4444)
- Tooltip formatter maps English keys to Indonesian labels

**No new npm packages** — recharts, react-hook-form, zod, @hookform/resolvers already installed.
