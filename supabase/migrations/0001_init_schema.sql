-- Pastikan ekstensi PostGIS aktif
CREATE EXTENSION IF NOT EXISTS postgis;

-- Buat ENUM types agar data konsisten (idempotent)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('RW', 'RT', 'WARGA', 'STRANGER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('active', 'resolved', 'false_alarm', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Tabel untuk zona RT/RW
CREATE TABLE IF NOT EXISTS neighborhood_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_type TEXT CHECK (zone_type IN ('RT','RW')) NOT NULL,
  zone_number TEXT NOT NULL,
  parent_id UUID REFERENCES neighborhood_zones(id) ON DELETE SET NULL, -- RT menunjuk ke RW
  ketua_id UUID, -- Akan diisi nanti, FK ke users
  area GEOGRAPHY(POLYGON, 4326) NOT NULL,
  center GEOGRAPHY(POINT, 4326),
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zones_area ON neighborhood_zones USING GIST (area);


-- Tabel utama untuk user
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'STRANGER',
  rw_id UUID REFERENCES neighborhood_zones(id) ON DELETE SET NULL,
  rt_id UUID REFERENCES neighborhood_zones(id) ON DELETE SET NULL,
  home_location GEOGRAPHY(POINT, 4326),
  current_location GEOGRAPHY(POINT, 4326),
  trust_score DECIMAL(3,2) DEFAULT 0.50 CHECK (trust_score BETWEEN 0.00 AND 1.00),
  is_verified BOOLEAN DEFAULT FALSE,
  fcm_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_home ON users USING GIST (home_location);
CREATE INDEX IF NOT EXISTS idx_users_current ON users USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users (firebase_uid);

-- Tambahkan FK dari zones ke users setelah tabel users ada (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_ketua_id' AND conrelid = 'neighborhood_zones'::regclass
    ) THEN
        ALTER TABLE neighborhood_zones 
        ADD CONSTRAINT fk_ketua_id 
        FOREIGN KEY (ketua_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END;
$$;


-- Tabel untuk insiden/panic button
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  audio_url TEXT,
  audio_duration_sec INT DEFAULT 10,
  ai_classification JSONB,
  ai_summary TEXT,
  human_address TEXT,
  status incident_status DEFAULT 'active',
  rw_id UUID REFERENCES neighborhood_zones(id),
  rt_id UUID REFERENCES neighborhood_zones(id),
  is_reporter_stranger BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);


-- Tabel untuk response dari tetangga
CREATE TABLE IF NOT EXISTS incident_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES users(id),
  response_type TEXT CHECK (response_type IN ('going','false_alarm','witness')) NOT NULL,
  vote_weight INT NOT NULL DEFAULT 1,
  current_location GEOGRAPHY(POINT, 4326),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (incident_id, responder_id, response_type)
);
CREATE INDEX IF NOT EXISTS idx_responses_incident ON incident_responses (incident_id);


-- Tabel untuk logging audit
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);