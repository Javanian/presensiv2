"""
seed.py — Run this after the database is initialized to create initial data.

Creates:
  • Roles (ADMIN / SUPERVISOR / EMPLOYEE)
  • Original test site "Kantor Pusat" + 3 timezone-representative sites
  • Shifts + work schedules for each new site
  • Original test users (admin / supervisor / employee)
  • 5 supervisors + 5 employees with @ptssb.co.id emails
  • 10 attendance records per employee (Jan 1–10, 2026)

Usage:
    python seed.py

Requires: DATABASE_URL in .env pointing to a running PostgreSQL instance
with the schema from database.sql already applied.
"""

import asyncio
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select, text

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import Attendance, Role, Shift, Site, User, WorkSchedule


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _work_minutes(checkin: datetime, checkout: datetime) -> int:
    return max(0, int((checkout - checkin).total_seconds() / 60))


# ---------------------------------------------------------------------------
# Attendance schedule: same pattern for every employee
# (date_offset, status, ci_h, ci_m, co_h, co_m, in_radius)
# date_offset 0 = Jan 1 2026 (Thursday)
# ---------------------------------------------------------------------------
ATTENDANCE_PATTERN = [
    # offset, status,          ci_h, ci_m, co_h, co_m, in_radius
    (0,  "ONTIME",        7,  5,  17,  0,  True),   # Jan 1 Thu
    (1,  "LATE",          7, 32,  17, 15,  True),   # Jan 2 Fri
    (2,  "ONTIME",        8,  0,  16,  0,  True),   # Jan 3 Sat (weekend)
    (3,  "ONTIME",        7, 55,  17,  0,  True),   # Jan 4 Sun (weekend)
    (4,  "ONTIME",        6, 58,  17,  5,  True),   # Jan 5 Mon
    (5,  "OUT_OF_RADIUS", 7, 10,  17,  0,  False),  # Jan 6 Tue
    (6,  "ONTIME",        7,  3,  17, 30,  True),   # Jan 7 Wed
    (7,  "LATE",          7, 45,  17,  0,  True),   # Jan 8 Thu
    (8,  "ONTIME",        7,  0,  17,  0,  True),   # Jan 9 Fri
    (9,  "ONTIME",        8,  0,  16, 30,  True),   # Jan 10 Sat (weekend)
]

BASE_DATE = date(2026, 1, 1)

# DB day_of_week: 0=Sunday … 6=Saturday
# Weekends: 0 (Sun) or 6 (Sat)
def _is_weekend_db_dow(d: date) -> bool:
    """Return True if the date falls on Saturday or Sunday."""
    python_dow = d.weekday()   # Mon=0 … Sun=6
    db_dow = (python_dow + 1) % 7  # Sun=0, Mon=1 … Sat=6
    return db_dow in {0, 6}


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------

async def seed():
    async with AsyncSessionLocal() as db:

        # ── 0. Inline timezone migration ──────────────────────────────────────
        print("\n[0] Ensuring sites.timezone column exists...")
        await db.execute(text(
            "ALTER TABLE sites "
            "ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta'"
        ))
        await db.commit()
        print("    timezone column: OK")

        # ── 1. Roles ──────────────────────────────────────────────────────────
        print("\n[1] Seeding roles...")
        role_names = ["ADMIN", "SUPERVISOR", "EMPLOYEE"]
        roles: dict[str, Role] = {}

        for rname in role_names:
            result = await db.execute(select(Role).where(Role.name == rname))
            role = result.scalar_one_or_none()
            if not role:
                role = Role(name=rname)
                db.add(role)
                await db.flush()
                print(f"    [+] Role created: {rname}")
            else:
                print(f"    [=] Role exists: {rname}")
            roles[rname] = role

        await db.commit()

        # Re-fetch after commit
        for rname in role_names:
            result = await db.execute(select(Role).where(Role.name == rname))
            roles[rname] = result.scalar_one()

        # ── 2. Original site (Kantor Pusat) ───────────────────────────────────
        print("\n[2] Seeding original site (Kantor Pusat)...")
        result = await db.execute(select(Site).where(Site.name == "Kantor Pusat"))
        orig_site = result.scalar_one_or_none()
        if not orig_site:
            await db.execute(text(
                "INSERT INTO sites (name, latitude, longitude, radius_meter, timezone) "
                "VALUES (:name, :lat, :lon, :radius, :tz)"
            ), {"name": "Kantor Pusat", "lat": -6.200000, "lon": 106.816666,
                "radius": 100, "tz": "Asia/Jakarta"})
            await db.commit()
            result = await db.execute(select(Site).where(Site.name == "Kantor Pusat"))
            orig_site = result.scalar_one()
            print(f"    [+] Site created: Kantor Pusat (id={orig_site.id})")
        else:
            print(f"    [=] Site exists: Kantor Pusat (id={orig_site.id})")

        # ── 3. Three timezone sites ───────────────────────────────────────────
        print("\n[3] Seeding timezone sites (WIB / WITA / WIT)...")
        tz_sites_data = [
            {
                "name": "SSB Jakarta",
                "lat": -6.200000,
                "lon": 106.816666,
                "radius": 100,
                "tz": "Asia/Jakarta",
                "label": "WIB (UTC+7)",
            },
            {
                "name": "SSB Makassar",
                "lat": -5.147350,
                "lon": 119.432181,
                "radius": 100,
                "tz": "Asia/Makassar",
                "label": "WITA (UTC+8)",
            },
            {
                "name": "SSB Jayapura",
                "lat": -2.533333,
                "lon": 140.717361,
                "radius": 100,
                "tz": "Asia/Jayapura",
                "label": "WIT (UTC+9)",
            },
        ]

        tz_sites: dict[str, Site] = {}
        for sd in tz_sites_data:
            result = await db.execute(select(Site).where(Site.name == sd["name"]))
            site = result.scalar_one_or_none()
            if not site:
                await db.execute(text(
                    "INSERT INTO sites (name, latitude, longitude, radius_meter, timezone) "
                    "VALUES (:name, :lat, :lon, :radius, :tz)"
                ), {"name": sd["name"], "lat": sd["lat"], "lon": sd["lon"],
                    "radius": sd["radius"], "tz": sd["tz"]})
                await db.commit()
                result = await db.execute(select(Site).where(Site.name == sd["name"]))
                site = result.scalar_one()
                print(f"    [+] Site created: {sd['name']} [{sd['label']}] (id={site.id})")
            else:
                print(f"    [=] Site exists:  {sd['name']} [{sd['label']}] (id={site.id})")
            tz_sites[sd["name"]] = site

        # ── 4. Shifts + work schedules ────────────────────────────────────────
        print("\n[4] Seeding shifts and work schedules...")
        shift_defs = [
            ("SSB Jakarta",  "Shift Reguler WIB"),
            ("SSB Makassar", "Shift Reguler WITA"),
            ("SSB Jayapura", "Shift Reguler WIT"),
        ]

        site_shifts: dict[str, Shift] = {}
        for site_name, shift_name in shift_defs:
            site = tz_sites[site_name]
            result = await db.execute(
                select(Shift).where(Shift.site_id == site.id, Shift.name == shift_name)
            )
            shift = result.scalar_one_or_none()
            if not shift:
                shift = Shift(
                    site_id=site.id,
                    name=shift_name,
                    start_time=time(7, 0),
                    end_time=time(17, 0),
                    is_cross_midnight=False,
                    work_hours_standard=8,
                )
                db.add(shift)
                await db.flush()
                # Add all 7 days with 15-min late tolerance
                for dow in range(7):
                    db.add(WorkSchedule(
                        shift_id=shift.id,
                        day_of_week=dow,
                        toleransi_telat_menit=15,
                    ))
                await db.commit()
                result = await db.execute(
                    select(Shift).where(Shift.site_id == site.id, Shift.name == shift_name)
                )
                shift = result.scalar_one()
                print(f"    [+] Shift created: {shift_name} (id={shift.id})")
            else:
                print(f"    [=] Shift exists:  {shift_name} (id={shift.id})")
            site_shifts[site_name] = shift

        # ── 5. Original test users ────────────────────────────────────────────
        print("\n[5] Seeding original test users...")
        original_users = [
            {
                "employee_id": "ADM001",
                "name": "Administrator",
                "email": "admin@presensiv2.local",
                "password": "Admin@123",
                "role": "ADMIN",
                "site_id": None,
            },
            {
                "employee_id": "SPV001",
                "name": "Supervisor Satu",
                "email": "supervisor@presensiv2.local",
                "password": "Supervisor@123",
                "role": "SUPERVISOR",
                "site_id": orig_site.id,
            },
            {
                "employee_id": "EMP001",
                "name": "Karyawan Satu",
                "email": "karyawan@presensiv2.local",
                "password": "Karyawan@123",
                "role": "EMPLOYEE",
                "site_id": orig_site.id,
            },
        ]
        for u in original_users:
            result = await db.execute(select(User).where(User.email == u["email"]))
            if result.scalar_one_or_none():
                print(f"    [=] User exists: {u['email']}")
                continue
            db.add(User(
                employee_id=u["employee_id"],
                name=u["name"],
                email=u["email"],
                password_hash=get_password_hash(u["password"]),
                role_id=roles[u["role"]].id,
                site_id=u["site_id"],
                is_active=True,
            ))
            print(f"    [+] User created: {u['email']} / {u['password']}")
        await db.commit()

        # Assign original supervisor hierarchy
        r = await db.execute(select(User).where(User.employee_id == "SPV001"))
        spv001 = r.scalar_one_or_none()
        r = await db.execute(select(User).where(User.employee_id == "EMP001"))
        emp001 = r.scalar_one_or_none()
        if spv001 and emp001 and emp001.supervisor_id != spv001.id:
            emp001.supervisor_id = spv001.id
            await db.commit()
            print("    [+] EMP001 → SPV001 hierarchy set")

        # ── 6. ptssb.co.id supervisors ────────────────────────────────────────
        print("\n[6] Seeding @ptssb.co.id supervisors...")
        jkt  = tz_sites["SSB Jakarta"]
        mks  = tz_sites["SSB Makassar"]
        jpr  = tz_sites["SSB Jayapura"]

        supervisors_data = [
            {"employee_id": "SPV101", "name": "Budi Santoso",   "email": "spv101@ptssb.co.id", "site_id": jkt.id},
            {"employee_id": "SPV102", "name": "Dewi Rahayu",    "email": "spv102@ptssb.co.id", "site_id": jkt.id},
            {"employee_id": "SPV103", "name": "Andi Wijaya",    "email": "spv103@ptssb.co.id", "site_id": mks.id},
            {"employee_id": "SPV104", "name": "Rini Susanti",   "email": "spv104@ptssb.co.id", "site_id": jpr.id},
            {"employee_id": "SPV105", "name": "Hendra Kusuma",  "email": "spv105@ptssb.co.id", "site_id": jpr.id},
        ]
        spv_objects: dict[str, User] = {}
        for u in supervisors_data:
            result = await db.execute(select(User).where(User.employee_id == u["employee_id"]))
            spv = result.scalar_one_or_none()
            if not spv:
                spv = User(
                    employee_id=u["employee_id"],
                    name=u["name"],
                    email=u["email"],
                    password_hash=get_password_hash("12345"),
                    role_id=roles["SUPERVISOR"].id,
                    site_id=u["site_id"],
                    is_active=True,
                )
                db.add(spv)
                await db.flush()
                print(f"    [+] Supervisor created: {u['email']}")
            else:
                print(f"    [=] Supervisor exists:  {u['email']}")
            spv_objects[u["employee_id"]] = spv
        await db.commit()

        # Re-fetch supervisors after commit
        for eid in list(spv_objects.keys()):
            r = await db.execute(select(User).where(User.employee_id == eid))
            spv_objects[eid] = r.scalar_one()

        # ── 7. ptssb.co.id employees ──────────────────────────────────────────
        print("\n[7] Seeding @ptssb.co.id employees...")
        employees_data = [
            # ── Original 5 (1 per supervisor) ──────────────────────────────
            {"employee_id": "EMP101", "name": "Siti Aminah",          "email": "emp101@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP102", "name": "Ahmad Fauzi",          "email": "emp102@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP103", "name": "Lestari Putri",        "email": "emp103@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP104", "name": "Joko Susilo",          "email": "emp104@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP105", "name": "Maya Indah",           "email": "emp105@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            # ── SPV101 additional 7 (SSB Jakarta) ──────────────────────────
            {"employee_id": "EMP106", "name": "Rudi Hartono",         "email": "emp106@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP107", "name": "Fitri Wahyuni",        "email": "emp107@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP108", "name": "Agus Purnomo",         "email": "emp108@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP109", "name": "Dini Anggraini",       "email": "emp109@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP110", "name": "Wahyu Setiawan",       "email": "emp110@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP111", "name": "Nurul Hidayah",        "email": "emp111@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            {"employee_id": "EMP112", "name": "Bagas Prasetyo",       "email": "emp112@ptssb.co.id", "site_id": jkt.id, "spv": "SPV101"},
            # ── SPV102 additional 7 (SSB Jakarta) ──────────────────────────
            {"employee_id": "EMP113", "name": "Ika Ramadhani",        "email": "emp113@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP114", "name": "Dimas Kurniawan",      "email": "emp114@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP115", "name": "Sari Novitasari",      "email": "emp115@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP116", "name": "Farid Maulana",        "email": "emp116@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP117", "name": "Yuni Astuti",          "email": "emp117@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP118", "name": "Rizky Firmansyah",     "email": "emp118@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            {"employee_id": "EMP119", "name": "Ayu Lestari",          "email": "emp119@ptssb.co.id", "site_id": jkt.id, "spv": "SPV102"},
            # ── SPV103 additional 7 (SSB Makassar) ─────────────────────────
            {"employee_id": "EMP120", "name": "Bambang Suryadi",      "email": "emp120@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP121", "name": "Nisa Rahmawati",       "email": "emp121@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP122", "name": "Dedi Kurniawan",       "email": "emp122@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP123", "name": "Susi Wulandari",       "email": "emp123@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP124", "name": "Heri Prasetyo",        "email": "emp124@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP125", "name": "Mira Oktaviani",       "email": "emp125@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            {"employee_id": "EMP126", "name": "Toni Wijaya",          "email": "emp126@ptssb.co.id", "site_id": mks.id, "spv": "SPV103"},
            # ── SPV104 additional 7 (SSB Jayapura) ─────────────────────────
            {"employee_id": "EMP127", "name": "Laras Pertiwi",        "email": "emp127@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP128", "name": "Eko Saputro",          "email": "emp128@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP129", "name": "Dewi Kurniasih",       "email": "emp129@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP130", "name": "Surya Dinata",         "email": "emp130@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP131", "name": "Putri Rahayu",         "email": "emp131@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP132", "name": "Fandi Ahmad",          "email": "emp132@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            {"employee_id": "EMP133", "name": "Rina Susilawati",      "email": "emp133@ptssb.co.id", "site_id": jpr.id, "spv": "SPV104"},
            # ── SPV105 additional 7 (SSB Jayapura) ─────────────────────────
            {"employee_id": "EMP134", "name": "Andika Pratama",       "email": "emp134@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP135", "name": "Wulan Permatasari",    "email": "emp135@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP136", "name": "Gilang Saputra",       "email": "emp136@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP137", "name": "Lidya Kusumaningrum",  "email": "emp137@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP138", "name": "Imam Santosa",         "email": "emp138@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP139", "name": "Anggi Pratiwi",        "email": "emp139@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
            {"employee_id": "EMP140", "name": "Dony Firmansyah",      "email": "emp140@ptssb.co.id", "site_id": jpr.id, "spv": "SPV105"},
        ]
        emp_objects: dict[str, User] = {}
        for u in employees_data:
            result = await db.execute(select(User).where(User.employee_id == u["employee_id"]))
            emp = result.scalar_one_or_none()
            if not emp:
                emp = User(
                    employee_id=u["employee_id"],
                    name=u["name"],
                    email=u["email"],
                    password_hash=get_password_hash("12345"),
                    role_id=roles["EMPLOYEE"].id,
                    site_id=u["site_id"],
                    is_active=True,
                )
                db.add(emp)
                await db.flush()
                print(f"    [+] Employee created: {u['email']}")
            else:
                print(f"    [=] Employee exists:  {u['email']}")
            emp_objects[u["employee_id"]] = emp
        await db.commit()

        # Re-fetch employees and assign supervisor_id
        print("\n[8] Assigning supervisor hierarchy...")
        for u in employees_data:
            r = await db.execute(select(User).where(User.employee_id == u["employee_id"]))
            emp = r.scalar_one()
            spv = spv_objects[u["spv"]]
            if emp.supervisor_id != spv.id:
                emp.supervisor_id = spv.id
                print(f"    [+] {u['employee_id']} → {u['spv']}")
            else:
                print(f"    [=] {u['employee_id']} already supervised by {u['spv']}")
        await db.commit()

        # Re-fetch employees for attendance seeding
        for eid in list(emp_objects.keys()):
            r = await db.execute(select(User).where(User.employee_id == eid))
            emp_objects[eid] = r.scalar_one()

        # ── 9. Attendance records ─────────────────────────────────────────────
        print("\n[9] Seeding attendance records (Jan 1–10, 2026)...")

        # Map site_id → site object for GPS coordinates and shift lookup
        site_map: dict[int, Site] = {
            jkt.id: jkt,
            mks.id: mks,
            jpr.id: jpr,
        }
        # Map site_id → shift object
        shift_map: dict[int, Shift] = {
            jkt.id: site_shifts["SSB Jakarta"],
            mks.id: site_shifts["SSB Makassar"],
            jpr.id: site_shifts["SSB Jayapura"],
        }

        total_inserted = 0
        total_skipped = 0

        for emp in emp_objects.values():
            site = site_map.get(emp.site_id)
            shift = shift_map.get(emp.site_id)
            if not site or not shift:
                print(f"    [!] Skipping {emp.employee_id} — no matching site/shift")
                continue

            for offset, status, ci_h, ci_m, co_h, co_m, in_radius in ATTENDANCE_PATTERN:
                att_date = BASE_DATE + timedelta(days=offset)
                checkin_dt  = datetime(att_date.year, att_date.month, att_date.day, ci_h, ci_m)
                checkout_dt = datetime(att_date.year, att_date.month, att_date.day, co_h, co_m)

                # Check for existing record (same user, same calendar date)
                exists_result = await db.execute(
                    select(Attendance).where(
                        Attendance.user_id == emp.id,
                        func.date(Attendance.checkin_time) == att_date,
                    )
                )
                if exists_result.scalar_one_or_none():
                    total_skipped += 1
                    continue

                is_wknd = _is_weekend_db_dow(att_date)
                work_min = _work_minutes(checkin_dt, checkout_dt)
                overtime_min = work_min if is_wknd else 0

                lat = site.latitude + (1.0 if not in_radius else 0.0)
                lon = site.longitude + (1.0 if not in_radius else 0.0)

                db.add(Attendance(
                    user_id=emp.id,
                    site_id=site.id,
                    shift_id=shift.id,
                    checkin_time=checkin_dt,
                    checkout_time=checkout_dt,
                    auto_checkout=False,
                    latitude=lat,
                    longitude=lon,
                    work_duration_minutes=work_min,
                    overtime_minutes=overtime_min,
                    is_weekend=is_wknd,
                    is_holiday=False,
                    status=status,
                ))
                total_inserted += 1

            await db.commit()

        print(f"    Inserted: {total_inserted}  |  Skipped (already exist): {total_skipped}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("✅ Seed complete!")
    print("=" * 60)
    print("\nOriginal test credentials:")
    print("  Admin      : admin@presensiv2.local      / Admin@123")
    print("  Supervisor : supervisor@presensiv2.local  / Supervisor@123")
    print("  Employee   : karyawan@presensiv2.local    / Karyawan@123")
    print("\nNew @ptssb.co.id credentials (password: 12345):")
    print("  Supervisors: spv101 … spv105 @ptssb.co.id")
    print("  Employees  : emp101 … emp140 @ptssb.co.id (8 per supervisor)")
    print("\nSites seeded:")
    print("  Kantor Pusat  — WIB (Asia/Jakarta)")
    print("  SSB Jakarta   — WIB (Asia/Jakarta)")
    print("  SSB Makassar  — WITA (Asia/Makassar)")
    print("  SSB Jayapura  — WIT  (Asia/Jayapura)")
    print(f"\nAttendance records: {total_inserted} inserted (Jan 1–10, 2026)")


if __name__ == "__main__":
    asyncio.run(seed())
