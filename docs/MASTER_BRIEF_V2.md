# WARGASIAGA — MASTER BRIEF v2
### Pair Programming North Star | Post-Deploy Edition
**Tagline:** "Tetanggamu, Penjagamu"
**Event:** #JuaraVibeCoding (Google AI Studio + GCP credit)
**Solo dev:** Kaff (rifyatkaffa) | **Deadline:** 31 Mei 2026
**Status dokumen:** v2 — disusun setelah Phase 7 (production deploy) + Bug #3 fix
**Pengganti:** Master Brief v1 (Section 9 phase plan lama sudah usang sampai Phase 7)

---

## 0. CARA PAKAI DOKUMEN INI

Ini **north star strategic**, bukan spec implementasi baris-per-baris. Detail kode (schema SQL final, signature endpoint, breakdown komponen) tetap dibedah **per sub-phase saat eksekusi**, sesuai workflow "calibrated patches" — Claude minta file asli dulu, sandbox-test, baru kasih patch minimal. Filosofi tetap: **Sumatra pait + gula dikit** = patch terkalibrasi, bukan rewrite.

Brand tokens, design philosophy, output rules, dan anti-hallucination rules dari Brief v1 **TETAP BERLAKU** dan tidak diulang penuh di sini (lihat Section 8 untuk ringkasan + apa yang berubah).

---

## 1. SNAPSHOT — STATE TERKINI (per 20 Mei 2026)

### Production URLs (LIVE)
| Layer | URL | Platform |
|---|---|---|
| Frontend | https://jvckaffarozi.web.app | Firebase Hosting (PWA) |
| Backend | https://wargasiaga-backend-577486245816.asia-southeast2.run.app | Cloud Run (asia-southeast2) |
| API base | `{backend}/api/v1` | — |

### Infra Facts (jangan ditebak ulang)
- **GCP project:** `jvckaffarozi` (number `577486245816`)
- **Compute SA:** `577486245816-compute@developer.gserviceaccount.com`
- **Region:** asia-southeast2 (Jakarta)
- **Python runtime Cloud Run:** 3.13.x (registry HANYA punya 3.13.x + 3.14.x — TIDAK ada 3.12.x). `.python-version` = `3.13.x`, `requires-python = ">=3.11,<3.14"`.
- **Secrets (Secret Manager, 5):** `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_GEOCODING_API_KEY`, `CORS_ORIGIN` (v2: `http://localhost:5173,https://jvckaffarozi.web.app`), `FIREBASE_SERVICE_ACCOUNT` (mounted as file `/secrets/firebase/key.json`)
- **Backend deploy command:** tersimpan verbatim (lihat Section 7)
- **Frontend deploy:** `firebase deploy --only hosting` dari `D:\wargasiaga\frontend\` (firebase.json + .firebaserc ADA DI frontend/, BUKAN root)

### Tech Stack (LOCKED — tidak berubah dari v1)
React 19.2 + Vite 8 + TS 6 + Tailwind 3.4 + Framer Motion + Zustand + Sonner | FastAPI + SQLAlchemy 2.0 async + asyncpg + Pydantic v2 | Supabase (Postgres 15 + PostGIS) + Supabase Realtime | Firebase Auth (Google only) + FCM + Storage | Gemini 2.5 Flash (server-side) | Google Maps JS API.

### Completion Status
```
✅ Phase 0  Setup
✅ Phase 1  Auth + User (Google Sign-In, onboarding, claim RT/RW)
✅ Phase 2  Panic + Audio + GPS
✅ Phase 3  Neighbor Discovery + FCM
✅ Phase 4  Map + Realtime + Responder
✅ Phase 5  Gemini AI Combo (classify + summary + reverse geocode)
✅ Phase 6  Anti-Prank Voting (weighted, RW override, auto-dismiss)
✅ Phase 7  Polish + Deploy (Cloud Run + Firebase Hosting + PWA + CORS + E2E)
✅ Bug #3   Onboarding logout fix
🟡 Phase 8  Civic-Tech Expansion + Bug #1/#2 (THIS DOCUMENT)
⏳ Phase 9  Demo Prep (digeser dari Phase 8 lama)
```

### E2E Test Verdict (Phase 7.5.8, 4 email, multi-device)
- ✅ **Core jalan:** panic → audio → GPS → AI → notif → realtime responder tracking (titik hijau muncul di map korban). Fitur paling kompleks = **WORKING di production.**
- 🐛 3 bug ditemukan (Bug #3 sudah fixed, #1 + #2 di backlog Section 2).

---

## 2. BUG BACKLOG — Phase 8

### Bug #1 — Notif Click Redirect ke localhost (P1)
**Gejala:** Email C tekan notif panic dari Email A → diarahkan ke `localhost:/incident`, bukan `https://jvckaffarozi.web.app/incidents/<uuid>`.
**Root cause (hipotesis kuat):** hardcoded `localhost` di `frontend/public/firebase-messaging-sw.js` click handler. Service Worker TIDAK baca Vite env vars (`import.meta.env`) — env injection ke SW butuh mekanisme khusus.
**Arah fix (dibedah saat eksekusi):**
- Ganti hardcoded URL → `self.location.origin` (SW punya akses ini) atau `clients.openWindow` dengan path relatif.
- Verify: `notificationclick` handler pakai relative path `/incidents/${id}`, bukan absolute localhost.
**Belum 100% yakin** struktur file SW lu — minta paste `firebase-messaging-sw.js` saat mulai fix. Jangan asumsi.

### Bug #2 — Korban Tampil sebagai Titik Biru (P2)
**Gejala:** Email C (KORBAN) buka halaman incident-nya → dirinya jadi titik BIRU ("lokasi pelapor"), padahal harusnya titik MERAH ("korban").
**Root cause (hipotesis):** logic marker di `IncidentMapPage.tsx` tidak membedakan "viewer adalah korban" vs "viewer adalah responder". Saat `viewer.id === incident.reporter_id`, dua marker (red `incident.location` + blue `ownLocation`) menumpuk di titik yang sama → membingungkan.
**Arah fix (dibedah saat eksekusi):**
- Conditional: jika `viewer.id === incident.reporter_id` → tampilkan HANYA marker merah (korban view), sembunyikan/relabel titik biru.
- Jika viewer = responder → behavior sekarang (merah = korban, biru = diri sendiri) sudah benar.
**Minta paste `IncidentMapPage.tsx`** saat mulai fix.

---

## 3. FITUR BARU — Phase 8 (Civic-Tech Expansion)

Semua keputusan di bawah sudah di-LOCK bareng Kaff. Design WAJIB ikut philosophy Section 8. Claude TANYA dulu kalau ada ambiguitas implementasi, tidak ambil keputusan sepihak.

### 3.1 — Pendataan Data Diri WARGA
**Tujuan:** kejelasan identitas pelapor (siapa, blok berapa, RT/RW mana). Pondasi untuk potensi integrasi Disdukcapil bila project scale.

**Keputusan LOCKED:**
- **NIK validation:** format-check 16 digit saja + simpan + verifikasi manual oleh RT/RW (Q1=c). **TIDAK** ada validasi ke API Disdukcapil real.
- **Privacy:** untuk hackathon **PAKAI DATA DUMMY** — JANGAN simpan NIK real (Q2=a). Concern UU PDP. Seeder pakai NIK fiktif.
- **Timing:** **optional**, bukan blocking. Warga bisa pakai panic dulu; kelengkapan data **meng-unlock fitur lebih** (Q3=b).
- **Halaman terpisah** dari panic button (halaman profil/pendataan sendiri).

**Field yang diisi (Q-detail dari Kaff):**
```
- NIK (16 digit, format-check)
- Nama lengkap
- Tempat lahir
- Tanggal lahir  → usia auto-calculate dari tanggal lahir
- Jenis kelamin
- Alamat (FIELD TERPISAH, bukan 1 string):
    - alamat rumah / blok
    - RT
    - RW
    - kelurahan
    - kecamatan
- No. telp
```

**Catatan implementasi (dibedah nanti):** usia sebaiknya **computed** (dari tanggal lahir), jangan disimpan statis biar tidak basi. Validasi NIK pakai Pydantic v2 validator (format + checksum opsional).

### 3.2 — List Data Warga Terdaftar
**Tujuan:** RT/RW bisa lihat warga di zona-nya + trust score up-to-date.

**Keputusan LOCKED:**
- **Akses:** HANYA RT/RW, dan **HANYA zona masing-masing** (Q4=b). RT lihat warga RT-nya; RW lihat semua warga di RW-nya.
- **Trust score visibility:** **private** — hanya RT/RW yang lihat (Q5=b). Warga biasa TIDAK lihat skor tetangga (hindari stigma sosial).
- Data sensitif (NIK) tampil ke RT/RW (mereka verifikator), tapi pertimbangkan masking untuk tampilan list (full hanya di detail).

### 3.3 — Autentikasi Khusus RT/RW (Invite-Code Chain of Trust)
**Masalah yang dihindari:** self-claim role = lubang keamanan. Siapa saja bisa ngaku RW → instant-dismiss semua panic.

**Keputusan LOCKED:**
- **Metode:** **invite-code chain** (Q6=b). Rantai kepercayaan: **RW → RT → Warga.**
  - RW dapat kode (seeded untuk demo) → RW generate/bagikan kode ke RT → RT terverifikasi.
  - RT generate/bagikan kode ke warga → warga ter-assign ke RT/RW yang benar.
- **Demo hackathon:** pakai **seeded data** (RT/RW sudah di-set di DB), full verification flow dipresentasikan sebagai **roadmap di pitch** (Q7=b). Tidak wajib implement flow lengkap untuk demo, tapi arsitekturnya disiapkan.

**Arah implementasi (dibedah nanti):** tabel `invite_codes` baru (kode, role_target, issuer_id, zone_id, expires_at, used_by). Saat redeem → set role + zone assignment.

### 3.4 — Geofencing via Google Maps Picker ⭐ (Fitur Pembeda)
**Tujuan:** Ketua RT/RW daftarkan wilayah dengan **klik titik kediaman di Google Maps**, sistem auto-generate zona radius. Jauh lebih baik dari input lat/long manual (susah + error-prone).

**Keputusan LOCKED:**
- **Shape:** **circle radius** (Q8=a), bukan kotak. Natural + PostGIS `ST_DWithin` simpel.
  - **RT:** radius **500m** dari titik kediaman Ketua RT.
  - **RW:** radius **1.5km (1500m)** dari titik kediaman Ketua RW.
- **Hierarki:** **RT WAJIB child dari RW** (Q10). `parent_id` RT harus terisi. Validasi: center RT harus berada DALAM radius RW (`ST_DWithin(rt_center, rw_center, 1500) = true`).
- **Overlap handling:**
  - **Hackathon:** **first-registered wins** (Q9=b) — warga di area overlap masuk RT yang terdaftar duluan. Simpel.
  - **Real-case (roadmap):** **multi-RT membership** (Q9=c) — warga bisa anggota >1 RT. Disebutkan di pitch sebagai future.

**Arah arsitektur (dibedah saat eksekusi, schema sudah mendukung):**
```
neighborhood_zones (SUDAH PUNYA center POINT + area POLYGON + parent_id):
  RW: center = kediaman ketua RW, radius 1500m
  RT: center = kediaman ketua RT, radius 500m, parent_id = <rw_id>

Map Picker flow (pakai @googlemaps/react-wrapper yang SUDAH ada):
  1. Ketua buka map → klik titik kediaman → dapat lat/lng
  2. Preview lingkaran radius (500m RT / 1500m RW) di map
  3. Confirm → POST backend
  4. Backend: ST_Buffer(center, radius) → simpan polygon ke kolom area

Warga auto-assign saat set home_location:
  - cari RT dengan ST_DWithin(home, rt_center, 500)
  - ketemu → assign rt_id + rw_id (parent)
  - masuk RW tapi tidak ada RT → rw_id only, rt_id null
  - tidak ketemu sama sekali → STRANGER
  - overlap → first-registered (hackathon)
```

### 3.5 — STRANGER Flow Proper (digeser dari Bug #3 Versi B)
**Konteks:** Bug #3 sudah di-fix versi minimum (tombol "Keluar & Ganti Akun"). Versi proper (humane policy) masuk Phase 8 karena terkait erat dengan geofencing + pendataan.

**Arah (align dengan Brief v1 Section 6 — "Stranger CAN trigger panic, humane policy"):**
- User yang lokasinya belum masuk zona → boleh masuk app sebagai STRANGER (bisa panic, di-flag ⚠️ "Pelapor belum terverifikasi") + diingatkan lengkapi data / hubungi RT.
- Butuh sentuh `ProtectedRoute.tsx` (sekarang kemungkinan block kalau `!is_verified`). Minta paste saat eksekusi.

---

## 4. PERUBAHAN DATABASE (Sketch — finalize saat eksekusi)

**JANGAN jalankan SQL ini mentah-mentah** — ini sketch arah. Schema final dibedah + di-review saat sub-phase, dengan migration hati-hati ke Supabase production yang sudah ada datanya.

### `users` — tambahan kolom (pendataan data diri)
```
nik             TEXT        -- 16 digit, dummy untuk demo, nullable (optional)
birth_place     TEXT
birth_date      DATE        -- usia computed dari sini, jangan simpan usia statis
gender          TEXT        -- enum: 'L' | 'P'
address_block   TEXT        -- alamat rumah / blok
kelurahan       TEXT
kecamatan       TEXT
data_completed  BOOLEAN DEFAULT FALSE  -- penanda kelengkapan (unlock fitur)
-- phone, rt_id, rw_id, home_location SUDAH ADA di schema v1
```

### `neighborhood_zones` — sudah cukup, tambah kolom radius eksplisit
```
radius_meters   INT         -- 500 (RT) / 1500 (RW), untuk regenerate/preview
-- center, area, parent_id, zone_type, ketua_id SUDAH ADA
```

### `invite_codes` — tabel BARU (RT/RW chain of trust)
```
id          UUID PK
code        TEXT UNIQUE          -- kode redeem
role_target user_role            -- 'RT' | 'WARGA' (RW seeded)
issuer_id   UUID REFERENCES users(id)
zone_id     UUID REFERENCES neighborhood_zones(id)
expires_at  TIMESTAMPTZ
used_by     UUID REFERENCES users(id) NULL
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**Migration concern:** Supabase production sudah punya data seed (RW 05 Gambir + warga). Tambah kolom = `ALTER TABLE ... ADD COLUMN` (aman, nullable/default). Hindari operasi destruktif.

---

## 5. RENCANA PHASE 8 (Sub-Phase — Satu per Satu)

Disiplin "satu phase, tunggu approval `lanjut`" tetap berlaku. Urutan dirancang untuk minimize risiko (fix bug dulu yang murah, fitur besar belakangan).

| Sub | Output | Estimasi |
|---|---|---|
| **8.1** | Fix Bug #1 (notif click → dynamic origin di SW) | ½ hari |
| **8.2** | Fix Bug #2 (korban-view marker conditional) | ½ hari |
| **8.3** | Schema migration (users kolom baru + invite_codes + radius) — review + apply hati-hati ke Supabase | ½ hari |
| **8.4** | Pendataan Data Diri WARGA — halaman + form + validasi NIK + usia computed (FE + BE endpoint) | 1–2 hari |
| **8.5** | Geofencing Map Picker (RT/RW) — klik titik → preview radius → simpan polygon. Warga auto-assign via ST_DWithin | 2 hari |
| **8.6** | List Warga (RT/RW only, zona masing-masing) + trust score private | 1 hari |
| **8.7** | Invite-code chain (RW→RT→warga) — seeded untuk demo + flow dasar | 1 hari |
| **8.8** | STRANGER flow proper (ProtectedRoute + badge ⚠️) | ½ hari |

> Estimasi kasar; deadline 31 Mei = ±11 hari sisa. Prioritaskan **8.1, 8.2, 8.4, 8.5** (highest demo value). 8.6–8.8 = bonus kalau waktu cukup, atau roadmap di pitch.

### Phase 9 — Demo Prep (digeser dari Phase 8 lama Brief v1)
- Seed demo final (RW 05 Gambir, Monas center) + skenario demo
- Script video LinkedIn (story arc: 4 build-fail iterations Cloud Run → success = drama bagus)
- README + dokumentasi submission GDG
- Screen recording panic flow dari **production URL** (kredibilitas)

---

## 6. ROLE HIERARCHY & VOTING (dari v1 — tidak berubah)
```
RW       trust 1.0 | vote FINAL (instant dismiss)
RT       trust 0.9 | vote 2x
WARGA    trust 0.5 | vote 1x
STRANGER trust 0.2 | vote 0  (boleh panic, di-flag ⚠️)
```
Threshold false alarm: ≥6 weight / 3 menit, ATAU 1 vote RW = final. STRANGER 3x false alarm / 30 hari → suspended. (Sudah implemented Phase 6.)

---

## 7. DEPLOY COMMANDS (Verbatim — untuk redeploy)

### Backend (Cloud Run) — dari `D:\wargasiaga\backend\`
```
gcloud run deploy wargasiaga-backend --source . --region asia-southeast2 --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --timeout 60 --set-env-vars="ENVIRONMENT=production,DEBUG=false,LOG_LEVEL=INFO,GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase/key.json" --set-secrets="DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_GEOCODING_API_KEY=GOOGLE_GEOCODING_API_KEY:latest,CORS_ORIGIN=CORS_ORIGIN:latest,/secrets/firebase/key.json=FIREBASE_SERVICE_ACCOUNT:latest"
```

### Frontend (Firebase Hosting) — dari `D:\wargasiaga\frontend\`
```
pnpm build
firebase deploy --only hosting
```

### Update CORS (kalau domain frontend berubah)
```
# tambah versi secret baru, lalu redeploy backend (Cloud Run tidak auto-pickup secret tanpa revisi baru)
gcloud secrets versions add CORS_ORIGIN --data-file="<file UTF-8 no BOM>"
# lalu jalankan ulang deploy backend di atas
```

**Gotchas deploy yang sudah dipetakan:**
- Cloud Run buildpacks default ambil Python TERBARU (3.14) → konflik `<3.14`. Solusi: `.python-version` = `3.13.x` (registry tidak punya 3.12.x sama sekali).
- `firebase init` versi 15.x bisa nulis config + placeholder dist ke ROOT walau di-run dari frontend. Pastikan `firebase.json` + `.firebaserc` ADA di `frontend/`, dan `dist/` yang dipakai adalah output Vite (bukan placeholder).
- SW filename PWA = `sw.js`, FCM = `firebase-messaging-sw.js`. Workbox `navigateFallbackDenylist` exclude `/firebase-messaging-sw.js` + `/api/`.

---

## 8. DESIGN, OUTPUT & ANTI-HALLUCINATION (Ringkasan — penuh di Brief v1)

### Brand Tokens (LOCKED, tidak berubah)
Navy `#1E3A8A` (primary) · Emergency Red `#DC2626` (panic only) · Success Green `#10B981` · BG `#F8FAFC` · Font Inter · Radius 12–16px card / 9999px pill · Shadow `0 2px 12px rgba(0,0,0,0.08)`.

### MANDATORY UI (tetap)
Card rounded · **bottom sheets** (bukan modal tengah) · **bottom tab bar** (≤5) · **floating panic button** · Framer Motion microinteraction · **skeleton loading** (bukan spinner) · toast + auto-dismiss · empty state ilustratif · **semua copy Bahasa Indonesia** friendly + kontekstual.

### BANNED (tetap auto-reject)
Gradient blob · glassmorphism berlebih · default shadcn look · MUI generic card · modal tengah Bootstrap · spinner · lorem ipsum · UI Inggris generik ("Submit"/"Click here") · Tailwind `gray` default tanpa kustomisasi.

### Output Rules (tetap)
File path eksplisit di atas tiap kode · NO truncation (full file kecuali diminta "diff only") · semua import lengkap · komentar Bahasa Indonesia untuk logic non-trivial · NEVER invent library di luar stack · setiap komponen ikut design philosophy · setelah kode: 3–5 bullet (apa berubah, kenapa, gotcha) · tutup dengan saran next step.

### Anti-Hallucination (tetap — KRITIS)
1. Ragu → TANYA sebelum koding. 1 pertanyaan > 50 baris kode salah.
2. Signature library/API ragu → bilang, jangan ngebluff. Cek docs.
3. JANGAN referensikan file yang belum dibuat — flag kalau perlu.
4. Cite docs untuk klaim Firebase/Supabase/Gemini.
5. Cost-aware: lewati free tier → flag 💰 + alternatif.
6. Security: API key (Gemini, Maps server) NEVER di frontend. FastAPI proxy.
7. No mock data di production logic (seed boleh).
8. **Selalu minta file asli sebelum patch.** Sandbox-test output sebelum Kaff apply.

### Workflow Roles (tetap)
Claude = architect / prompt-engineer / code-reviewer, sandbox-test dulu. Kaff = executor, senior peer (React + FastAPI native). Register casual "gua/lu", direct, teknis. Off-script → adapt tapi flag ("ini di luar phase X, oke gua bantu").

---

## 9. EDGE CASES TAMBAHAN (Phase 8 specific)
- 🗺️ Map picker: user klik di luar wilayah RW saat daftar RT → tolak, kasih pesan "Titik RT harus dalam radius RW [nama]".
- 👥 Warga set home di area overlap 2 RT → first-registered (hackathon), log untuk audit.
- 🆔 NIK duplikat saat pendataan → tolak (unique check), pesan "NIK sudah terdaftar".
- 📍 RW belum daftar zona tapi RT mau daftar → blok, "RW [x] belum menetapkan wilayah".
- 🔢 Invite code expired / sudah dipakai → tolak dengan pesan jelas.
- 🎂 Tanggal lahir di masa depan / usia < 0 → validasi tolak.

---

## 10. SUBMISSION CHECKLIST (Phase 9 — jangan lupa)
- [ ] Public URL frontend submit ke GDG: https://jvckaffarozi.web.app
- [ ] Video LinkedIn vibe-coding journey (cek durasi & guideline #JuaraVibeCoding)
- [ ] README repo (setup, arsitektur, fitur, screenshot)
- [ ] Demo scenario script (multi-akun, story arc panic→respon→resolve)
- [ ] Seed data demo final di Supabase production
- [ ] Backup: rekaman demo (jaga-jaga live demo gagal saat penjurian)

---

**LOCKED v2. Konfirmasi + bedah per sub-phase, jangan menyimpang.**
*Susunan: pasca-Phase 7 deploy. Pengganti phase plan Brief v1 dari Phase 8 ke atas.*
