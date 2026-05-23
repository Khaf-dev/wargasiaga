// frontend/src/pages/DaftarWilayahPage.tsx
// Phase 8.5: Halaman pendaftaran wilayah untuk Ketua RT/RW.
// Ketua klik titik kediaman di map → circle radius (by role) → simpan zona.
// Design: Section 4 — card navy, Framer Motion, skeleton, toast.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Info, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getMyZone, updateZoneGeometry } from '@/services/zone';
import type { ZoneResponse } from '@/types/zone';
import ZonePickerMap from '@/components/map/ZonePickerMap';

// Radius by role (Q-Service-1=a). Backend tetap authoritative; ini untuk preview circle.
const RADIUS_BY_ROLE: Record<string, number> = {
  RW: 1500,
  RT: 500,
};

// Format radius jadi label ramah (500m / 1.5km)
const formatRadius = (meters: number): string =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;

const PageSkeleton = () => (
  <div className="p-4 space-y-4">
    <div className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
    <div className="h-[340px] bg-slate-200 rounded-2xl animate-pulse" />
    <div className="h-12 bg-slate-200 rounded-full animate-pulse" />
  </div>
);

export default function DaftarWilayahPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuthStore();

  const [zone, setZone] = useState<ZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Titik terpilih (null = belum klik)
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Radius preview by role (RT 500 / RW 1500)
  const role = userProfile?.role ?? '';
  const radiusMeters = RADIUS_BY_ROLE[role] ?? 500;

  // Fetch zona yang dikelola ketua (prefill kalau udah pernah set)
  useEffect(() => {
    const fetchZone = async () => {
      try {
        const data = await getMyZone();
        setZone(data);
        // Prefill titik kalau zona udah punya center
        if (data.center_lat !== null && data.center_lng !== null) {
          setPoint({ lat: data.center_lat, lng: data.center_lng });
        }
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 403) {
          // Bukan ketua RT/RW
          setAccessError(
            err.response.data?.detail ||
              'Halaman ini hanya untuk Ketua RT atau RW.'
          );
        } else {
          setAccessError('Gagal memuat data wilayah. Periksa koneksi internet Anda.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchZone();
  }, []);

  const handleSubmit = async () => {
    if (!point) {
      toast.error('Tap lokasi kediaman Anda di peta terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateZoneGeometry({ lat: point.lat, lng: point.lng });
      toast.success(res.message, { icon: '✅' });
      setZone(res.zone);
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 400) {
        // Validasi gagal: RT di luar RW / RW belum daftar / bukan ketua
        toast.error(err.response.data?.detail || 'Lokasi tidak valid untuk wilayah ini.');
      } else {
        toast.error('Gagal menyimpan wilayah. Periksa koneksi internet Anda.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Akses ditolak (bukan ketua) ───────────────────────────────────────────
  if (!loading && accessError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-center p-4">
        <h2 className="text-5xl mb-4">🔒</h2>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Akses Terbatas</h3>
        <p className="text-slate-500 mb-6 max-w-xs">{accessError}</p>
        <motion.button
          onClick={() => navigate('/')}
          whileTap={{ scale: 0.95 }}
          className="px-5 py-2.5 bg-navy-900 text-white font-semibold rounded-full"
        >
          Kembali ke Beranda
        </motion.button>
      </div>
    );
  }

  const zoneLabel = zone ? `${zone.zone_type} ${zone.zone_number}` : 'Wilayah Anda';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 min-h-screen">
      <div className="max-w-md mx-auto pb-10">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
          <div className="flex items-center">
            <motion.button
              onClick={() => navigate(-1)}
              whileTap={{ scale: 0.9 }}
              className="p-2 -ml-2 mr-2"
            >
              <ChevronLeft size={24} className="text-slate-700" />
            </motion.button>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">Daftar Wilayah</h1>
              <p className="text-xs text-slate-500">
                {zone?.has_geometry ? 'Perbarui batas wilayahmu' : `Tentukan batas ${zoneLabel}`}
              </p>
            </div>
          </div>
        </header>

        <main className="p-4 space-y-4">
          {loading ? (
            <PageSkeleton />
          ) : (
            <>
              {/* Info card: zona + radius */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border-l-4 border-navy-900 bg-white shadow-sm p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">🏘️</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-sm">
                      {zone ? `Ketua ${zone.zone_type} ${zone.zone_number}` : 'Wilayah Anda'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {zone?.city}
                      {zone?.city && zone?.province ? ', ' : ''}
                      {zone?.province}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-navy-900">
                      <ShieldCheck size={14} />
                      <span>Radius wilayah: {formatRadius(radiusMeters)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Instruksi */}
              <div className="flex items-start gap-2 px-1">
                <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tap titik kediaman Anda di peta. Sistem akan otomatis membuat
                  batas wilayah berbentuk lingkaran dengan radius {formatRadius(radiusMeters)}
                  {role === 'RT' && ' (harus berada di dalam wilayah RW induk)'}.
                </p>
              </div>

              {/* Map Picker */}
              <ZonePickerMap
                className="h-[340px]"
                selectedPoint={point}
                onPointSelected={setPoint}
                radiusMeters={radiusMeters}
                initialCenter={
                  zone?.center_lat && zone?.center_lng
                    ? { lat: zone.center_lat, lng: zone.center_lng }
                    : undefined
                }
              />

              {/* Status titik terpilih */}
              {point && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-1 text-xs text-slate-600"
                >
                  <MapPin size={14} className="text-navy-900" />
                  <span>
                    Titik dipilih: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </span>
                </motion.div>
              )}

              {/* Tombol simpan */}
              <motion.button
                onClick={handleSubmit}
                disabled={submitting || !point}
                whileHover={{ scale: submitting || !point ? 1 : 1.02 }}
                whileTap={{ scale: submitting || !point ? 1 : 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-navy-900 text-white font-semibold rounded-full shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block"
                    >
                      <CheckCircle2 size={18} />
                    </motion.span>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <MapPin size={18} />
                    {zone?.has_geometry ? 'Perbarui Wilayah' : 'Simpan Wilayah'}
                  </>
                )}
              </motion.button>

              <p className="text-center text-xs text-slate-400 leading-relaxed px-4">
                Batas wilayah ini digunakan untuk menentukan warga mana yang masuk
                ke dalam {zoneLabel} dan menerima notifikasi darurat.
              </p>
            </>
          )}
        </main>
      </div>
    </motion.div>
  );
}