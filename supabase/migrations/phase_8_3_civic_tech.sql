-- ============================================================
-- WARGASIAGA — MIGRATION PHASE 8.3
-- Civic-Tech Expansion: Pendataan Data Diri + Geofencing + Invite Code
-- PRINSIP: ADDITIVE ONLY. Zero risk ke data existing.
-- Target: public schema (BUKAN auth.users Supabase).
-- Idempotent: aman dijalankan ulang.
-- ============================================================

-- 1. GENDER ENUM (value L/P, standar KTP Indonesia)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
    CREATE TYPE gender_type AS ENUM ('L', 'P');
  END IF;
END$$;

-- 2. PENDATAAN DATA DIRI — kolom baru di public.users (semua nullable, optional)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nik TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_place TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender gender_type;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address_block TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kelurahan TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kecamatan TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS data_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- NIK unique tapi nullable → partial unique index (multiple NULL diizinkan)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_nik
  ON public.users (nik)
  WHERE nik IS NOT NULL;

-- 3. GEOFENCING — radius_meters di neighborhood_zones
--    (area POLYGON sudah NOT NULL → di-generate dari center+radius di Phase 8.5)
ALTER TABLE public.neighborhood_zones ADD COLUMN IF NOT EXISTS radius_meters INT;

-- 4. INVITE CODES — tabel baru (RT/RW chain of trust)
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  role_target user_role NOT NULL,
  issuer_id   UUID REFERENCES public.users(id),
  zone_id     UUID REFERENCES public.neighborhood_zones(id),
  expires_at  TIMESTAMPTZ,
  used_by     UUID REFERENCES public.users(id),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes (code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_zone ON public.invite_codes (zone_id);