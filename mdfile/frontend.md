## Presensi Online SSB v2 – Mobile Application

> **Last updated:** 2026-03-09
>
> ### Phase Completion Status
> | Phase | Description | Status |
> |-------|-------------|--------|
> | F1 | Project Setup & Authentication | ✅ COMPLETE (login bug fixed 2026-02-26) |
> | F2 | Navigation & Base Layout | ✅ COMPLETE |
> | F3 | Attendance Check-in / Check-out | ✅ COMPLETE |
> | F4 | Face Registration | ✅ COMPLETE |
> | F5 | Attendance History | ✅ COMPLETE |
> | F6 | Overtime Request | ⚠ STUB — `OvertimeScreen.tsx` is a placeholder ("Fitur ini masih dalam tahap pengembangan"). No API integration. `overtime.api.ts` does NOT exist. |
> | F7 | UX & Error Hardening | ✅ COMPLETE (2026-03-09) |
>
> ### Known Fixed Bugs & Completed Work
> - **2026-02-26** `LoginScreen.tsx`: Removed dynamic `import()` inside `handleLogin`. Moved `authApi.me()` + `setAuthUser()` into `useLogin.onSuccess` in `hooks/useAuth.ts`. Previously, dynamic import failure on Android silently swallowed errors and prevented navigation after login.
> - **2026-03-09** Multi-timezone display: All screens now use `Intl.DateTimeFormat` with `site_timezone` from API response. `SubordinateAttendanceScreen` was the last screen fixed.
> - **2026-03-09** F7 UX hardening complete: Toast notifications via `react-native-toast-message` (`src/utils/toast.ts`); Axios second interceptor for 403/422/500/network errors → Indonesian toast; offline detection via `@react-native-community/netinfo` (`src/hooks/useNetworkStatus.ts`); `OfflineBanner` component (red banner, added to Home/History/SubordinateAttendance/Profile); checkin/checkout buttons disabled when offline; double-submit prevention (`isCapturing` guard in modals, `isPending` guard on face register).

---

# 1️⃣ Overview

Mobile application for Presensi Online SSB v2.

Platform:

* Android
* iOS

Framework & Tools:

* React Native 0.81.5 (Expo ~54.0.33, New Architecture enabled)
* TypeScript 5.9 (strict mode)
* Axios 1.13.5 (JSON APIs only; NOT used for FormData uploads)
* XMLHttpRequest (direct, for face image FormData uploads — see `face.api.ts`)
* React Query v5 (`@tanstack/react-query` ^5.90)
* React Navigation v7 (native-stack + bottom-tabs)
* expo-camera 17
* expo-location 19
* expo-secure-store 15 (tokens only — NOT AsyncStorage)
* react-native-toast-message (F7)
* @react-native-community/netinfo (F7)

---

## ⚠ Important Rules

* Mobile app must strictly follow API contract defined in `backend.md`.
* Do NOT implement business logic in frontend.
* All validation, shift logic, overtime calculation, GPS validation, and face verification must remain in backend.
* Frontend acts as UI layer only.

---

# 2️⃣ Development Strategy (Build Per Phase)

The mobile application must be built phase-by-phase to ensure stability and backend compatibility.

---

# 🟢 PHASE F1 — Project Setup & Authentication

## Objective

Setup base project and authentication system.

## Requirements

### Project Setup

* Create Expo project with TypeScript.
* Enable TypeScript strict mode.
* Configure environment variables for API base URL.

### Core Setup

* Axios instance with baseURL.
* React Query provider.
* Navigation container.
* Global error handler.

### Authentication Flow

* Login screen.
* Splash screen.
* Loading screen.

### API Integration

* POST `/auth/login`
* POST `/auth/refresh`
* GET `/auth/me`

### Token Handling

* Store tokens in `expo-secure-store`.
* Automatically refresh access token.
* Logout clears tokens.

### Protected Navigation

* Prevent access to protected screens if not authenticated.

No attendance features in this phase.

---

# 🟢 PHASE F2 — Navigation & Base Layout

## Objective

Create main app navigation structure.

## Navigation Structure

Bottom Tab Navigation:

* Home
* History
* Overtime
* Team (visible to SUPERVISOR and ADMIN only — routes to `SubordinateAttendanceScreen`)
* Profile

### Home Screen

* Welcome message
* Current shift information
* Check-in / Check-out button

### Profile Screen

* User information from `/auth/me`
* Logout button

---

# 🟢 PHASE F3 — Attendance (Check-in / Check-out)

## Objective

Implement full attendance flow.

---

## Check-in Flow

1. User taps "Check-in".
2. Request camera permission.
3. Request location permission.
4. Capture selfie.
5. Get GPS coordinates.
6. Send to backend:

```
POST /attendance/checkin
```

Payload:

* Image (multipart/form-data)
* latitude
* longitude

7. Display backend response:

   * ONTIME
   * LATE
   * OUT_OF_RADIUS
   * Error message

⚠ Do not calculate status locally.

---

## Check-out Flow

```
POST /attendance/checkout
```

Display:

* Work duration
* Overtime minutes
* Status

All calculations must come from backend.

---

# 🟢 PHASE F4 — Face Registration

## Objective

Allow ADMIN and SUPERVISOR to register or update face embedding.

### Flow

1. Capture selfie.
2. Send to:

```
POST /face/register
```

Handle backend errors:

* Multiple faces detected
* No face detected
* Invalid image

---

# 🟢 PHASE F5 — Attendance History

## Objective

Display attendance records.

### Endpoint

```
GET /attendance/me
```

### Features

* List view
* Show:

  * Date
  * Check-in time
  * Check-out time
  * Status
  * Overtime minutes
* Pull-to-refresh
* Pagination if required

---

# ⚠ PHASE F6 — Overtime Request (STUB — Not Yet Integrated)

## Objective

Allow employees to submit overtime requests.

> **Current status:** `OvertimeScreen.tsx` is a stub placeholder. It displays a "Fitur ini masih dalam tahap pengembangan" (feature in development) message only. `overtime.api.ts` does NOT exist. No API calls are made. The overtime backend endpoints exist and are functional — only the mobile integration is pending.

### Intended Flow (not yet implemented)

1. Select attendance record or create for future date
2. Choose:

   * requested_start
   * requested_end
3. Send:

```
POST /overtime
```

4. Display status:

   * PENDING
   * APPROVED
   * REJECTED

Supervisor must be able to:

* Approve
* Reject

---

# ✅ PHASE F7 — UX & Error Hardening (COMPLETE 2026-03-09)

## Requirements & Implementation

* **Global API error handling** — Axios second response interceptor in `axios.ts`:
  * 401 Unauthorized → refresh + retry, or "Sesi habis" toast then logout
  * 403 Forbidden → toast "Akses Ditolak"
  * 422 Validation error → extracts and displays detail message
  * 500+ Server error → generic server error toast
  * Network error → "Tidak ada koneksi internet" toast
* **Toast notifications** — `react-native-toast-message` via `src/utils/toast.ts` (`showSuccess`, `showError`, `showInfo`). `<Toast />` mounted in `App.tsx`.
* **Offline detection** — `@react-native-community/netinfo` via `src/hooks/useNetworkStatus.ts`; `src/components/OfflineBanner.tsx` (red banner); added to Home, History, SubordinateAttendance, Profile screens; checkin/checkout buttons disabled when offline.
* **Prevent double-submit** — `isCapturing` state guard in `CheckinModal` and `CheckoutModal` shutter; `register.isPending` guard in `FaceRegisterModal` upload button.
* **Retry UI** — HomeScreen has isError + retry button; HistoryScreen and SubordinateAttendanceScreen already had retry.
* **Multi-timezone display** — all timestamp display uses `Intl.DateTimeFormat` with `site_timezone` from API. Last screen fixed: `SubordinateAttendanceScreen`.

---

# 3️⃣ Critical Implementation Notes

## FormData Upload — XMLHttpRequest Only

Three approaches were tested for face image uploads:

1. **Axios** ❌ — `transformRequest` serializes React Native FormData to `'{}'` before `xhr.send()`; upload body is empty
2. **Native `fetch`** ❌ — First call on Android fails with "Network request failed" when body contains a file URI; second call succeeds (RN initialization bug)
3. **XMLHttpRequest (direct)** ✅ — Pre-initialized by Axios for all JSON calls; reliable from first use

`_xhrPost(url, token, formData)` in `face.api.ts` wraps XHR in a Promise. `faceUpload<T>()` adds 401 refresh + 1 auto-retry on network error. Errors are shaped to mimic `AxiosError` so modal `isAxiosError(e)` checks work unchanged.

## CheckinModal Upload Timing (Android)

`handleCapture` captures photo → sets `capturedUri` state → sets `step = 'verifying'`. A `useEffect([step, capturedUri])` fires after React commits (CameraView fully unmounted) → calls `verify.mutateAsync` → then `checkin.mutateAsync`. Uploading while CameraView is still mounted causes the first XHR to fail on Android.

`CheckoutModal` does NOT use this deferred pattern (no face verify step; inline async is safe).

## Multi-Timezone Display

All timestamp display uses `Intl.DateTimeFormat` with the `site_timezone` field from API responses (e.g. `"Asia/Jakarta"`, `"Asia/Makassar"`, `"Asia/Jayapura"`). Never use `new Date().toLocaleDateString()` (device timezone). Never use `"Asia/Jakarta"` as a hardcoded default.

## Axios 401 Interceptor — FormData Guard

When the 401 interceptor attempts to retry the original request, it checks `if (originalRequest.data instanceof FormData)` — if true, re-throws without retrying via Axios. The `faceUpload()` function handles its own 401 refresh independently.

---

# 4️⃣ Security Requirements (Frontend)

Frontend must:

* Use SecureStore (not AsyncStorage) for tokens.
* Never log tokens.
* Never expose production backend URL in public repo.
* Validate image type before upload (JPEG/PNG only).
* Limit image size before upload.
* Always send `Authorization: Bearer <token>` header.
* Never trust device time for attendance logic.

---

# 5️⃣ Camera & GPS Requirements

Use:

* `expo-camera`
* `expo-location`

Must:

* Ask permission properly.
* Handle denied permissions gracefully.
* Show error if GPS disabled.
* Show error if camera disabled.
* Prevent submission if location is null.

---

# 6️⃣ UI Design Guidelines

Design principles:

* Clean and minimal UI.
* Large primary Check-in button.
* Clear visual feedback.

Color coding:

* Green → ONTIME
* Yellow → LATE
* Red → OUT_OF_RADIUS

Optional:

* Dark mode support.

---

# 7️⃣ Actual Folder Structure

```
mobile/
 ├── App.tsx                          ← Root: QueryClientProvider + SafeAreaProvider + RootNavigator + <Toast />
 ├── app.json
 ├── package.json
 ├── tsconfig.json
 ├── .env                             ← EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_API_TIMEOUT
 └── src/
      ├── api/
      │   ├── axios.ts                ← Axios instance + Bearer interceptor + 401 refresh queue + error toast interceptor
      │   ├── auth.api.ts             ← login, refresh, me
      │   ├── attendance.api.ts       ← checkin, checkout, getMyAttendance, getTeamAttendance
      │   └── face.api.ts             ← faceUpload() via XHR (_xhrPost); register, verify, getStatus
      │   NOTE: overtime.api.ts does NOT exist
      │
      ├── hooks/
      │   ├── useAuth.ts              ← useLogin (calls authApi.me in onSuccess), useLogout, useMe
      │   ├── useCheckin.ts           ← useCheckin + useCheckout mutations
      │   ├── useAttendance.ts        ← useTodayAttendance, useAttendanceHistory, useTeamAttendance
      │   ├── useFaceRegister.ts      ← useFaceStatus, useFaceRegister, useFaceVerify
      │   └── useNetworkStatus.ts     ← @react-native-community/netinfo listener (F7)
      │
      ├── screens/
      │   ├── LoginScreen.tsx
      │   ├── SplashScreen.tsx        ← checks tokens → authApi.me() → sets auth state
      │   ├── LoadingScreen.tsx       ← generic spinner
      │   ├── HomeScreen.tsx          ← today attendance, checkin/checkout buttons, offline guard
      │   ├── HistoryScreen.tsx       ← infinite scroll + month chip filter; Intl.DateTimeFormat
      │   ├── OvertimeScreen.tsx      ← STUB PLACEHOLDER — no API integration
      │   ├── SubordinateAttendanceScreen.tsx  ← month arrow-nav, EmployeeSummary cards; Intl.DateTimeFormat
      │   └── ProfileScreen.tsx       ← user info, face status, opens FaceRegisterModal
      │
      ├── components/
      │   ├── CheckinModal.tsx        ← deferred useEffect upload pattern (CameraView unmount → XHR verify → Axios checkin)
      │   ├── CheckoutModal.tsx       ← inline async (no face verify; GPS optional)
      │   ├── FaceRegisterModal.tsx   ← capture → review step → XHR upload
      │   └── OfflineBanner.tsx       ← red banner shown when offline (F7)
      │
      ├── navigation/
      │   ├── RootNavigator.tsx       ← pub/sub authStore → Splash | Auth | Main
      │   ├── AuthNavigator.tsx       ← Login only
      │   └── MainNavigator.tsx       ← 5 bottom tabs: Home, History, Overtime, Team (SUPERVISOR/ADMIN), Profile
      │
      ├── store/
      │   └── authStore.ts            ← Vanilla pub/sub auth state; TOKEN_KEYS; persistTokens; clearTokens
      │
      ├── types/
      │   ├── auth.ts                 ← TokenResponse, UserInfo (site_timezone: string | null), LoginPayload
      │   ├── attendance.ts           ← AttendanceRecord (site_timezone: string), TeamAttendanceRecord, EmployeeSummary
      │   └── face.ts                 ← FaceStatus, FaceRegisterResponse, FaceVerifyResponse
      │
      └── utils/
           └── toast.ts               ← showSuccess, showError, showInfo (react-native-toast-message wrappers, F7)
```

---

# 8️⃣ Non-Functional Requirements

* TypeScript strict mode.
* Modular architecture.
* Reusable UI components.
* Centralized API error handling.
* Environment config for:

  * Development
  * Staging
  * Production
* Code must be scalable and maintainable.

---

# 9️⃣ AI Instructions (For Code Generation)

When generating code:

1. Always follow backend API contract from `backend.md`.
2. Do not create new endpoints.
3. Do not move business logic to frontend.
4. Build phase-by-phase.
5. Wait for confirmation before next phase.
6. Use functional components + hooks only.
7. Use React Query for all API calls.
8. Keep architecture scalable.

---

# 🎯 Expected Deliverables

* Expo-based React Native app
* Secure authentication flow
* Camera + GPS check-in
* Overtime request UI
* Modular and scalable structure
* Production-ready configuration

