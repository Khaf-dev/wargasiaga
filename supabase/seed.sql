-- Seed data untuk WargaSiaga, dibuat idempotent.
-- Pusat: Monas, Jakarta (-6.1754, 106.8272)

-- Definisikan UUID yang valid untuk zona
-- Gunakan SELECT untuk menyimpan UUID ke dalam variabel agar mudah direferensikan
DO $$
DECLARE
    rw05_id UUID := 'f1b3b3a0-3b1e-4b4a-8c1a-2b0a9d1e4f5a';
    rt03_id UUID := 'e2c4c4b1-4c2f-4c5b-9d2b-3c1b0e2f5a6b';
    rt04_id UUID := 'd3d5d5c2-5d3a-4d6c-8e3c-4d2c1f3a6b7c';
BEGIN

-- 1. Buat Zona RW 05 Gambir (Polygon ~800m radius)
INSERT INTO neighborhood_zones (id, zone_type, zone_number, area, center, city, province)
VALUES (
    rw05_id, 'RW', '05',
    ST_GeogFromText('SRID=4326;POLYGON((106.8222 -6.1714, 106.8322 -6.1714, 106.8322 -6.1794, 106.8222 -6.1794, 106.8222 -6.1714))'),
    ST_GeogFromText('SRID=4326;POINT(106.8272 -6.1754)'),
    'Jakarta Pusat', 'DKI Jakarta'
) ON CONFLICT (id) DO NOTHING;

-- 2. Buat Zona RT 03 di dalam RW 05
INSERT INTO neighborhood_zones (id, zone_type, zone_number, parent_id, area, city, province)
VALUES (
    rt03_id, 'RT', '03', rw05_id,
    ST_GeogFromText('SRID=4326;POLYGON((106.8225 -6.1720, 106.8270 -6.1720, 106.8270 -6.1750, 106.8225 -6.1750, 106.8225 -6.1720))'),
    'Jakarta Pusat', 'DKI Jakarta'
) ON CONFLICT (id) DO NOTHING;

-- 3. Buat Zona RT 04 di dalam RW 05
INSERT INTO neighborhood_zones (id, zone_type, zone_number, parent_id, area, city, province)
VALUES (
    rt04_id, 'RT', '04', rw05_id,
    ST_GeogFromText('SRID=4326;POLYGON((106.8275 -6.1755, 106.8320 -6.1755, 106.8320 -6.1785, 106.8275 -6.1785, 106.8275 -6.1755))'),
    'Jakarta Pusat', 'DKI Jakarta'
) ON CONFLICT (id) DO NOTHING;

-- 4. Buat Users (Ketua, Warga, Stranger)
-- Ketua RW
INSERT INTO users (firebase_uid, full_name, email, role, rw_id, is_verified, trust_score, home_location)
VALUES ('seed_rw_ahmad', 'Ahmad Suryanto', 'ahmad.rw@example.com', 'RW', rw05_id, true, 1.00, ST_GeogFromText('SRID=4326;POINT(106.8275 -6.1750)'))
ON CONFLICT (firebase_uid) DO NOTHING;
-- Ketua RT 03
INSERT INTO users (firebase_uid, full_name, email, role, rt_id, rw_id, is_verified, trust_score, home_location)
VALUES ('seed_rt_budi', 'Budi Hartono', 'budi.rt@example.com', 'RT', rt03_id, rw05_id, true, 0.90, ST_GeogFromText('SRID=4326;POINT(106.8230 -6.1725)'))
ON CONFLICT (firebase_uid) DO NOTHING;
-- Ketua RT 04
INSERT INTO users (firebase_uid, full_name, email, role, rt_id, rw_id, is_verified, trust_score, home_location)
VALUES ('seed_rt_siti', 'Siti Rahayu', 'siti.rt@example.com', 'RT', rt04_id, rw05_id, true, 0.90, ST_GeogFromText('SRID=4326;POINT(106.8280 -6.1760)'))
ON CONFLICT (firebase_uid) DO NOTHING;

-- Warga RT 03 (6 orang)
INSERT INTO users (firebase_uid, full_name, email, role, rt_id, rw_id, is_verified, trust_score, home_location) VALUES
('seed_warga_andi', 'Andi Pratama', 'andi@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8240 -6.1730)')),
('seed_warga_diana', 'Diana Putri', 'diana@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8250 -6.1740)')),
('seed_warga_eko', 'Eko Wijaya', 'eko@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8245 -6.1735)')),
('seed_warga_fitri', 'Fitri Maharani', 'fitri@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8255 -6.1725)')),
('seed_warga_galih', 'Galih Saputro', 'galih@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8260 -6.1745)')),
('seed_warga_hesti', 'Hesti Lestari', 'hesti@example.com', 'WARGA', rt03_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8235 -6.1748)'))
ON CONFLICT (firebase_uid) DO NOTHING;

-- Warga RT 04 (6 orang)
INSERT INTO users (firebase_uid, full_name, email, role, rt_id, rw_id, is_verified, trust_score, home_location) VALUES
('seed_warga_indra', 'Indra Kurniawan', 'indra@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8290 -6.1770)')),
('seed_warga_joko', 'Joko Santoso', 'joko@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8300 -6.1780)')),
('seed_warga_kartika', 'Kartika Dewi', 'kartika@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8285 -6.1775)')),
('seed_warga_lukman', 'Lukman Hakim', 'lukman@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8310 -6.1765)')),
('seed_warga_maya', 'Maya Anggraini', 'maya@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8295 -6.1760)')),
('seed_warga_nanda', 'Nanda Permana', 'nanda@example.com', 'WARGA', rt04_id, rw05_id, true, 0.50, ST_GeogFromText('SRID=4326;POINT(106.8305 -6.1758)'))
ON CONFLICT (firebase_uid) DO NOTHING;

-- Strangers
INSERT INTO users (firebase_uid, full_name, email, role, trust_score, current_location) VALUES
('seed_stranger_1', 'Unknown User 1', 'stranger1@example.com', 'STRANGER', 0.20, ST_GeogFromText('SRID=4326;POINT(106.8100 -6.1700)')),
('seed_stranger_2', 'Unknown User 2', 'stranger2@example.com', 'STRANGER', 0.20, ST_GeogFromText('SRID=4326;POINT(106.8275 -6.1756)'))
ON CONFLICT (firebase_uid) DO NOTHING;

END;
$$;