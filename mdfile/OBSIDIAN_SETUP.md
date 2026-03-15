# OBSIDIAN_SETUP.md
# Jalankan file ini SEKALI untuk setup vault Obsidian dari awal.
# Vault path: D:\Catatan Tee\Catatan Tee\

---

## INSTRUKSI UNTUK CLAUDE CODE

Baca file ini dan jalankan semua task di bawah secara berurutan.
Gunakan obsidian-vault MCP untuk membuat semua folder dan file.
Vault root ada di: `D:\Presensi Online SSB\presensiv2\mdfile\`

---

## TASK 1 — Buat Struktur Folder

Buat folder-folder berikut di dalam vault (buat file `.gitkeep` kosong
di setiap folder agar folder terbentuk):

```
Projects/
Projects/Presensi SSB v2/
Projects/Presensi SSB v2/Sessions/
Projects/Presensi SSB v2/Docs/

Knowledge/
Knowledge/FastAPI/
Knowledge/React Native Expo/
Knowledge/Docker/
Knowledge/PostgreSQL/
Knowledge/Tailwind + shadcn/

Journal/
Journal/2026-03/

Inbox/

Templates/
```

---

## TASK 2 — Buat _index.md (MOC Utama)

Buat file `_index.md` di root vault dengan isi:

```markdown
# 🗺️ Vault Index — Catatan Tee

> Pintu masuk utama vault. Update ini setiap ada project baru.

---

## 🗂️ Projects Aktif

| Project | Status | Terakhir Diupdate |
|---------|--------|-------------------|
| [[Projects/Presensi SSB v2/_overview\|Presensi SSB v2]] | 🟡 SIT/UAT | - |

---

## 📚 Knowledge Base
- [[Knowledge/FastAPI/|FastAPI]]
- [[Knowledge/React Native Expo/|React Native Expo]]
- [[Knowledge/Docker/|Docker]]
- [[Knowledge/PostgreSQL/|PostgreSQL]]
- [[Knowledge/Tailwind + shadcn/|Tailwind + shadcn]]

---

## 📓 Journal
- [[Journal/2026-03/|Maret 2026]]

---

## 📥 Inbox
- [[Inbox/|Dump cepat & belum dikategorikan]]

---

## 🔖 Cara Pakai Vault Ini

- **Project baru** → buat folder di `Projects/`, update tabel di atas
- **Dump cepat** → tulis di `Inbox/`, rapikan nanti
- **Referensi teknis** → simpan di `Knowledge/`
- **Harian** → tulis di `Journal/YYYY-MM/YYYY-MM-DD.md`
- **Session coding** → Claude Code auto-generate di `Projects/{nama}/Sessions/`
```

---

## TASK 3 — Buat Project Overview: Presensi SSB v2

Buat file `Projects/Presensi SSB v2/_overview.md` dengan isi:

```markdown
# Presensi Online SSB v2

> GPS + face-recognition attendance management system untuk SSB
> (Sanggar Sarana Baja — perusahaan manufaktur multi-site)

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | FastAPI 0.115.5 + Python 3.11 |
| Mobile | React Native (Expo ~54) + TypeScript |
| Web Admin | React 18 + Vite + Tailwind + shadcn/ui |
| Database | PostgreSQL 16 + pgvector |
| AI/ML | InsightFace buffalo_s (512-dim face embeddings) |
| Container | Docker Compose |

---

## Status Komponen

| Komponen | Phase | Status |
|----------|-------|--------|
| Backend | 7/7 | ✅ Complete |
| Mobile | F7/F7 | ✅ Complete |
| Web Admin | W6/W6 | ✅ Complete |
| Mobile Overtime | — | 🔴 Stub placeholder |

---

## URLs Development

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Web Admin | http://localhost:5173 |

---

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@presensiv2.local | Admin@123 | ADMIN |
| spv101@ptssb.co.id | 12345 | SUPERVISOR (Jakarta) |
| emp101@ptssb.co.id | 12345 | EMPLOYEE (Jakarta) |

---

## Dokumen Penting

- [[Docs/SIT|System Integration Test (SIT)]]
- [[Docs/UAT|User Acceptance Test (UAT)]]

---

## Sessions
- [[Sessions/|Lihat semua session notes →]]

---

## Catatan Penting

- Semua timestamp disimpan UTC di DB, dikonversi ke timezone site untuk display
- numpy harus tetap pin ==1.26.4 (onnxruntime kompatibilitas)
- Access token: memory only. Refresh token: sessionStorage
- JANGAN simpan token di localStorage
```

---

## TASK 4 — Buat Session Template

Buat file `Templates/session-note.md` dengan isi:

```markdown
# Session — {{DATE}}

**Project:** {{PROJECT}}
**Durasi:** {{DURASI}}
**Claude Session:** {{SESSION_ID}}

---

## ✅ Yang Dikerjakan
-

---

## 🔑 Keputusan Penting
-

---

## 📁 File yang Diubah
| File | Perubahan |
|------|-----------|
| | |

---

## 🐛 Bug / Issues Ditemukan
-

---

## 📋 TODO Next Session
- [ ]

---

## 🚧 Blockers
-

---

## 💡 Catatan / Learnings
-
```

---

## TASK 5 — Buat Journal Entry Hari Ini

Buat file `Journal/2026-03/2026-03-16.md` dengan isi:

```markdown
# 📓 2026-03-16 — Minggu

## Focus Hari Ini
-

## Yang Dikerjakan
-

## Mood / Energy
- [ ] 🔋 Penuh
- [ ] 🔋 Sedang
- [ ] 🪫 Habis

## Catatan
-
```

---

## TASK 6 — Buat README di Inbox

Buat file `Inbox/README.md` dengan isi:

```markdown
# 📥 Inbox

Tempat dump cepat. Tulis apapun di sini dulu,
rapikan ke folder yang tepat nanti.

---

> Kalau sudah dirapikan, hapus atau pindahkan file-nya.
```

---

## SETELAH SEMUA TASK SELESAI

Konfirmasi ke user bahwa semua file dan folder sudah dibuat,
dan tampilkan struktur lengkap vault yang sudah terbentuk.

Lalu berikan instruksi prompt standar ini untuk dipakai user
setiap menutup sesi Claude Code:

```
Tutup sesi ini. Buat session note baru di Obsidian vault
di folder Projects/[NAMA PROJECT]/Sessions/
dengan nama file [TANGGAL-HARI-INI].md
Isi dengan summary session ini: apa yang dikerjakan,
keputusan penting, file yang diubah, dan TODO next session.
Gunakan template dari Templates/session-note.md
```