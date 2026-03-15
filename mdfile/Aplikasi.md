Tech Stack:

* Frontend: React Native (Expo ~54.0.33, New Architecture enabled)
* Backend: FastAPI (Python 3.11+)
* AI: InsightFace `buffalo_s` (512-dim embedding)
* Database: PostgreSQL 16 + pgvector
* Containerized: Docker Compose
* Timezone: Per-site (WIB/WITA/WIT); all timestamps stored as UTC (`TIMESTAMPTZ`); business logic uses `site.timezone`

## Current Status (as of 2026-03-09)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core Infrastructure | ✅ COMPLETE |
| 2 | Site & Shift Management | ✅ COMPLETE |
| 3 | Face Recognition & Registration | ✅ COMPLETE |
| 4 | Attendance Engine | ✅ COMPLETE |
| 5 | Overtime Engine | ✅ COMPLETE |
| 6 | Security Hardening | ✅ COMPLETE |
| 7 | Optimization & Production Readiness | ✅ COMPLETE |

⚠ IMPORTANT:
Before generating models, AI must read and follow the schema from:

```
database.sql
```

All table structures, relationships, constraints, and indexes must strictly follow `database.sql`.

Do not redesign schema unless explicitly instructed.

---

# 🚀 DEVELOPMENT STRATEGY (BUILD PER PHASE)

System must be implemented in phases to ensure accuracy and maintainability.

---

# 🟢 PHASE 1 — Core Infrastructure

## Objective

Setup backend foundation and authentication system.

## Requirements

1. FastAPI project structure using clean architecture:

   * routers/
   * services/
   * repositories/
   * models/
   * schemas/
   * core/

2. JWT Authentication:

   * Access token (15 minutes)
   * Refresh token
   * Role-based access (ADMIN, SUPERVISOR, EMPLOYEE)

3. Password hashing using bcrypt

4. Login security:

   * Max 5 failed attempts
   * Account lock mechanism
   * Rate limiting

5. Read database schema from `database.sql`

6. Connect to PostgreSQL using async driver

7. Implement:

   * Login
   * Refresh token
   * Role middleware
   * Secure headers
   * CORS restriction

Phase 1 must be completed and tested before moving to Phase 2.

---

# 🟢 PHASE 2 — Site & Shift Management

## Objective

Implement site, shift, and schedule logic.

## Requirements

Follow tables from `database.sql`:

* sites
* shifts
* work_schedules
* holidays

Features:

* CRUD site (ADMIN only)
* CRUD shift
* Assign shift per site
* Work schedule per day_of_week
* Holiday management

Validation:

* Shift may cross midnight
* Shift must belong to a site
* Validate time logic

No attendance logic yet in this phase.

---

# 🟢 PHASE 3 — Face Recognition & Registration

## Objective

Implement user registration with face embedding.

Requirements:

1. Use InsightFace pretrained model
2. Generate 512-dimension embedding
3. Store in:
   users.face_embedding (pgvector)
4. Reject:

   * Multiple faces detected
   * No face detected
5. Do not permanently store raw image (optional encrypted temp storage)
6. Create vector index (already defined in database.sql)

Matching rule:

* Cosine similarity threshold = 0.3 (configurable via `FACE_SIMILARITY_THRESHOLD` env var)

Test:

* Successful match
* Failed match
* Multiple faces scenario

---

# 🟢 PHASE 4 — Attendance Engine

## Objective

Implement check-in & check-out logic.

Rules:

1. Use server time per site timezone (WIB/WITA/WIT). Store all timestamps as UTC (`TIMESTAMPTZ`). Convert to `ZoneInfo(site.timezone)` for all business logic.

2. Prevent double check-in via service-layer UTC-range query: compute site-local midnight-to-midnight window, convert to UTC, then query. Do NOT use raw `DATE(checkin_time)` DB index (wrong for non-Jakarta timezones).

3. GPS validation:

   * Haversine formula
   * Compare with site radius

4. Validate shift:

   * Cross-midnight support
   * Late tolerance

5. Auto checkout:

   * Trigger at shift end
   * Mark auto_checkout = TRUE

6. Calculate:

   * work_duration_minutes
   * status (ONTIME / LATE / OUT_OF_RADIUS)

No overtime yet in this phase.

---

# 🟢 PHASE 5 — Overtime Engine

## Objective

Implement overtime logic with approval system.

Rules:

1. Standard working hours = 8 hours
2. Weekend → all hours = overtime
3. Holiday → all hours = overtime
4. Overtime requires approval unless weekend/holiday

Tables:

* overtime_requests
* holidays

Logic:

* If overtime_approved → calculate extra minutes
* If auto checkout without approval → no overtime

Edge Cases:

* Cross-midnight shift
* Early check-in
* Late checkout

---

# 🟢 PHASE 6 — Security Hardening (Pentest Ready)

System must defend against:

* SQL Injection
* XSS
* CSRF
* IDOR
* JWT tampering
* Replay attack
* Brute force login
* File upload abuse
* Privilege escalation

Implement:

1. Strict Pydantic validation
2. Parameterized queries only
3. Object-level permission check
4. Rate limiting
5. Audit logging (audit_logs table)
6. Secure headers:

   * Content-Security-Policy
   * X-Frame-Options
   * X-Content-Type-Options
7. HTTPS-only environment
8. Access control per role

Log suspicious activities:

* Face mismatch
* GPS outside radius
* Multiple failed login
* Unauthorized endpoint access

---

# 🟢 PHASE 7 — Optimization & Production Readiness

1. Async endpoints
2. DB indexing validation
3. Vector index optimization
4. Structured logging
5. Health check endpoint
6. Docker multi-stage build
7. Environment variable config
8. Swagger documentation
9. Unit tests

---

# 🎯 NON-FUNCTIONAL REQUIREMENTS

* Clean architecture
* SOLID principles
* No business logic in frontend
* Backend must be source of truth
* All validation server-side
* Configurable via .env
* Audit trail enabled

---

# 📌 FINAL NOTES FOR AI

1. Always reference `database.sql` before generating models.
2. Do not redesign schema unless explicitly told.
3. Build per phase.
4. Wait for confirmation before moving to next phase.
5. Keep code modular and secure by default.
6. Use async where possible.
7. Ensure timezone correctness.

---

# 📦 Expected Deliverables

* Modular FastAPI backend
* Dockerized environment
* Production-ready configuration
* Secure attendance engine
* Overtime engine
* Audit trail system
* Clean documentation

