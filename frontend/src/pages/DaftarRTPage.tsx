// frontend/src/pages/DaftarRTPage.tsx
// Phase 8.6: Daftar RT di bawah RW + ringkasan zona (RW only). Design: Section 4.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { AxiosError } from 'axios';
import { getChildRTs, getZoneOverview } from '@/services/zone';
import type { ChildRT, ZoneOverview } from '@/types/zone';

const SkeletonList = () => (
  <div className="space-y-3">
    <div className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
    {[...Array(3)].map((_, i) => (
      <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
    ))}
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-6xl mb-3">🗺️</div>
    <h3 className="font-semibold text-slate-700 mb-1">Belum Ada RT</h3>
    <p className="text-sm text-slate-400 max-w-xs">
      Belum ada RT yang terdaftar di wilayah RW ini.
    </p>
  </div>
);

export default function DaftarRTPage() {
  const navigate = useNavigate();
  const [rts, setRts] = useState<ChildRT[]>([]);
  const [overview, setOverview] = useState<ZoneOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Ambil overview + daftar RT paralel
        const [ov, childRts] = await Promise.all([getZoneOverview(), getChildRTs()]);
        setOverview(ov);
        setRts(childRts);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 403) {
          setAccessError(err.response.data?.detail || 'Halaman ini hanya untuk Ketua RW.');
        } else {
          setAccessError('Gagal memuat data. Periksa koneksi internet Anda.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 min-h-screen">
      <div className="max-w-md mx-auto pb-10">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
          <div className="flex items-center">
            <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.9 }} className="p-2 -ml-2 mr-2">
              <ChevronLeft size={24} className="text-slate-700" />
            </motion.button>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">Daftar RT</h1>
              <p className="text-xs text-slate-500">
                {loading ? 'Memuat...' : overview ? `RW ${overview.zone_number} • ${rts.length} RT` : ''}
              </p>
            </div>
          </div>
        </header>

        <main className="p-4 space-y-4">
          {loading ? (
            <SkeletonList />
          ) : (
            <>
              {/* Overview RW (Daftar RW = ringkasan RW sendiri, Q-Dash-A=b) */}
              {overview && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border-l-4 border-navy-900 bg-white shadow-sm p-4"
                >
                  <h3 className="font-bold text-slate-800 text-sm mb-3">
                    Ringkasan RW {overview.zone_number}
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-navy-900">{overview.total_child_rts}</p>
                      <p className="text-xs text-slate-500">RT</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-navy-900">{overview.total_members}</p>
                      <p className="text-xs text-slate-500">Total Warga</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">{overview.verified_members}</p>
                      <p className="text-xs text-slate-500">Terverifikasi</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    {overview.city}, {overview.province}
                  </p>
                </motion.div>
              )}

              {/* Daftar RT */}
              {rts.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  {rts.map((rt, idx) => (
                    <motion.div
                      key={rt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                            {rt.zone_number}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800 text-sm">RT {rt.zone_number}</h3>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Users size={12} />
                              <span>{rt.member_count} warga</span>
                            </div>
                          </div>
                        </div>
                        {/* Status geometry (udah set wilayah / belum) */}
                        {rt.has_geometry ? (
                          <span className="flex items-center gap-1 text-xs text-success font-medium">
                            <CheckCircle2 size={13} /> {rt.radius_meters}m
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                            <AlertCircle size={13} /> Belum diset
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </motion.div>
  );
}