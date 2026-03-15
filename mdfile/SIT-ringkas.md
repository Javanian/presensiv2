Izin cek dulu file SIT.md yang sudah diupdate.SIT.md sudah diupdate dengan benar. Semua 6 poin sudah masuk — TC-M11 SQL fix, TC-M10 fallback, TC-M07 psql query, TC-W05 klarifikasi, TC-W06 network validation, dan TC-W07b holiday test case baru.

---

## Checklist Testing SIT — Ringkas & Onpoint

### 🔧 Setup Awal (Jalankan Sekali)

```bash
docker compose up -d
docker exec presensiv2_backend python seed.py
curl http://localhost:8000/health
docker exec presensiv2_backend date
```

---

### 🧹 Reset State Sebelum Test

```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "DELETE FROM attendance WHERE user_id IN (
     SELECT id FROM users WHERE email LIKE '%@ptssb.co.id'
   ) AND checkin_time >= NOW() - INTERVAL '1 day';"
```

---

### 📱 Mobile — Urutan Test

| # | Test | Akun | Kondisi Waktu | Validasi DB |
|---|------|------|---------------|-------------|
| TC-M01 | Login valid | emp101 | — | — |
| TC-M02 | Login salah 5x | emp101 | — | Unlock setelah test |
| TC-M11 | Check-in tanpa wajah terdaftar | emp101 | Dalam shift | — |
| TC-M12 | Daftar wajah | emp101 | — | `face_embedding` not null |
| TC-M03 | Check-in ONTIME | emp101 | 07:00–07:15 WIB | `status=ONTIME` |
| TC-M04 | Check-in LATE | emp101 | >07:15 WIB | `status=LATE` |
| TC-M05 | Check-in OUT_OF_RADIUS | emp101 | Dalam shift | `status=OUT_OF_RADIUS` |
| TC-M06 | Check-in di luar jam shift | emp101 | <07:00 atau >17:00 | Tidak ada record baru |
| TC-M07 | Double check-in dicegah | emp101 | Dalam shift | 1 record saja |
| TC-M07 edge | Cross-midnight boundary | emp101 | 23:55 → 00:05 WIB | 2 record, tanggal beda |
| TC-M08 | Check-in weekend | emp101 | Sabtu/Minggu WIB | `is_weekend=TRUE` |
| TC-M09 | Check-out manual | emp101 | Setelah check-in | `work_duration_minutes` benar |
| TC-M10 | Auto-checkout | emp101 | Set jam ke >17:00 | `auto_checkout=TRUE` |
| TC-M13 | Offline saat check-in | emp101 | Dalam shift | Tidak ada record |
| TC-M14 | Supervisor lihat tim | spv101 | — | Hanya 8 subordinat |
| TC-M15 | Shift cross-midnight | emp101 | 22:00–06:00 | `is_cross_midnight=TRUE` |
| TC-M16 | Token expired, auto refresh | emp101 | Tunggu 15 menit | Tidak logout |

**Unlock akun setelah TC-M02:**
```bash
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE email='emp101@ptssb.co.id';"
```

---

### 🖥️ Web Admin — Urutan Test

| # | Test | Akun | Yang Dicek |
|---|------|------|------------|
| TC-W01 | Login + session restore (F5) | admin | Token di sessionStorage, bukan localStorage |
| TC-W02 | Dashboard stats & chart | admin | Recharts render, data Jan 2026 |
| TC-W03 | Filter attendance by date | admin | 400 records Jan 1–10 |
| TC-W04 | Timezone display benar | admin | WIB/WITA/WIT sesuai site |
| TC-W05 | Trigger auto-checkout | admin | Tombol di `/attendance` atau Swagger |
| TC-W06 | Overtime list + detail drawer | admin | Network tab: `GET /attendance/{id}` fired |
| TC-W07 | Overtime approve → cek di mobile | admin | Status APPROVED muncul di HistoryScreen |
| TC-W07b | Holiday effect | emp101 | `is_holiday=TRUE`, `overtime=work_duration` |
| TC-W08 | Buat user baru | admin | User bisa login di mobile |
| TC-W09 | Buat shift baru | spv101/admin | `is_cross_midnight` auto-detect benar |
| TC-W10 | Reports + validasi >30 hari | admin | Error "Rentang maksimal 30 hari" |

---

### 🔗 Cross-Component — Jalankan Terakhir

| # | Test | Yang Dicek |
|---|------|------------|
| TC-INT01 | Check-in mobile → muncul di Web Admin | Record ada dalam detik, WIB benar |
| TC-INT02 | Waktu sama di mobile & web (WITA) | emp103, keduanya tampilkan 08:05 WITA |
| TC-INT03 | Auto-checkout terlihat di mobile History | `(Auto)` label, durasi benar |

---

### 🧹 Restore Setelah Test

```bash
# Restore server clock ke real time
docker exec presensiv2_backend bash -c "ntpdate pool.ntp.org || hwclock --hctosys"

# Hapus holiday test jika TC-W07b dijalankan
docker exec presensiv2_db psql -U presensiv2 -d presensiv2 -c \
  "DELETE FROM holidays WHERE description = 'Hari Libur Nasional Test';"

# Hapus test shift jika Method A dipakai
# (via Swagger DELETE /shifts/{id})
```