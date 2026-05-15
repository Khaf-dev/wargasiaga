import { createClient } from '@supabase/supabase-js';

// Ambil konfigurasi dari environment variables Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail fast: Langsung error saat startup jika konfigurasi penting tidak ada.
// Ini mencegah bug aneh di kemudian hari saat aplikasi sudah berjalan.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variabel environment VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan.");
}

// Inisialisasi Supabase client singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Opsi global untuk client
  global: {
    headers: {
      // Header kustom untuk tracing request di sisi Supabase (opsional tapi bagus untuk observability)
      'x-client-info': 'wargasiaga-web@0.1.0',
    },
  },
  // Opsi khusus untuk Realtime
  realtime: {
    params: {
      // Batasi jumlah event yang diterima per detik untuk mencegah client kewalahan
      eventsPerSecond: 10,
    },
  },
  // Opsi untuk Auth (PENTING!)
  auth: {
    // Kita TIDAK menggunakan Supabase Auth (karena pakai Firebase Auth), jadi semua fitur terkait dimatikan.
    // Ini mencegah client mencoba mengelola sesi atau token yang tidak ada, yang bisa menyebabkan error.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// KHUSUS DEVELOPMENT: Expose client ke window untuk memudahkan debugging via browser console.
// Di console, kita bisa panggil `window.__supabase` untuk inspect channel, dll.
if (import.meta.env.DEV) {
  // @ts-ignore - Kita sengaja men-assign ke window untuk debugging
  window.__supabase = supabase;
}