-- Migrasi ini mengkonfigurasi Supabase Realtime untuk tabel yang relevan.
-- Dibuat idempotent agar aman untuk dijalankan berkali-kali.

-- Langkah 1: Pastikan publikasi 'supabase_realtime' ada.
-- Supabase secara otomatis membuat ini, tapi kita pastikan untuk robustness.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Langkah 2: Tambahkan tabel 'incidents' ke publikasi Realtime secara idempotent.
-- Kita cek dulu di pg_publication_tables untuk menghindari error jika tabel sudah ada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'incidents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
    END IF;
END $$;

-- Langkah 2.1: Tambahkan tabel 'incident_responses' ke publikasi Realtime secara idempotent.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'incident_responses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE incident_responses;
    END IF;
END $$;

-- Langkah 3: Set REPLICA IDENTITY menjadi FULL untuk kedua tabel.
-- Ini WAJIB agar saat event 'UPDATE', payload Realtime menyertakan data LAMA ('old' record).
-- Berguna untuk mendeteksi transisi state, contoh: status insiden berubah dari 'active' ke 'resolved'.
-- ALTER TABLE aman dijalankan berulang kali, nilainya hanya akan di-overwrite.
ALTER TABLE incidents REPLICA IDENTITY FULL;
ALTER TABLE incident_responses REPLICA IDENTITY FULL;

-- Langkah 4: Aktifkan Row Level Security (RLS) untuk keamanan.
-- Ini memastikan tidak ada data yang bocor ke client yang tidak berhak.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY juga aman dijalankan berulang kali.
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_responses ENABLE ROW LEVEL SECURITY;

-- Langkah 5: Buat policy SELECT yang permisif menggunakan pola DROP-then-CREATE untuk idempotency.
-- GOTCHA PENTING: Supabase Realtime butuh policy SELECT agar bisa mengirim event.
-- Tanpa ini, koneksi berhasil tapi tidak ada event yang akan diterima.

-- Policy untuk tabel 'incidents'
DROP POLICY IF EXISTS "Allow public read access for realtime" ON incidents;
CREATE POLICY "Allow public read access for realtime"
ON incidents
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy untuk tabel 'incident_responses'
DROP POLICY IF EXISTS "Allow public read access for realtime" ON incident_responses;
CREATE POLICY "Allow public read access for realtime"
ON incident_responses
FOR SELECT
TO anon, authenticated
USING (true);


-- =================================================================
-- VERIFICATION QUERIES (Jalankan manual di SQL Editor untuk cek)
-- =================================================================

-- -- 1. Cek apakah tabel sudah masuk ke publikasi 'supabase_realtime'
-- SELECT pubname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- -- -> Harusnya menampilkan 'incidents' dan 'incident_responses'

-- -- 2. Cek REPLICA IDENTITY untuk tabel
-- SELECT relname, relreplident FROM pg_class WHERE relname IN ('incidents', 'incident_responses');
-- -- -> Kolom 'relreplident' harusnya 'f' (full) untuk kedua tabel

-- -- 3. Cek policy RLS yang aktif
-- SELECT policyname, schemaname, tablename, cmd, roles, qual -- 'qual' adalah kolom yang benar, bukan 'definition'
-- FROM pg_policies 
-- WHERE tablename IN ('incidents', 'incident_responses');
-- -- -> Harusnya menampilkan policy "Allow public read access for realtime" untuk SELECT