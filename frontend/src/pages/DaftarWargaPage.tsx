// frontend/src/pages/DaftarWargaPage.tsx
// Phase 8.6: Daftar warga di zona yang dikelola (RT/RW only).
// Data sensitif (NIK/trust) DIKECUALIKAN backend. Design: Section 4.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { getZoneMembers } from '@/services/zone';
import type { ZoneMember } from '@/types/zone';

// Badge role
const RoleBadge = ({ role }: { role: string }) => {
  const styles: Record<string, string> = {
    RW: 'bg-purple-100 text-purple-700',
    RT: 'bg-blue-100 text-blue-700',
    WARGA: 'bg-green-100 text-green-700',
    STRANGER: 'bg-yellow-100 text-yellow-700',
  };
  const labels: Record<string, string> = {
    RW: 'Ketua RW',
    RT: 'Ketua RT',
    WARGA: 'Warga',
    STRANGER: 'Belum Terverifikasi',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[role] ?? styles.STRANGER}`}>
      {labels[role] ?? role}
    </span>
  );
};

const SkeletonList = () => (
  <div className="space-y-3">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

// Empty state ilustratif (Section 4: custom empty state, bukan stock icon)
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-6xl mb-3">🏘️</div>
    <h3 className="font-semibold text-slate-700 mb-1">Belum Ada Warga</h3>
    <p className="text-sm text-slate-400 max-w-xs">
      Belum ada warga yang terdaftar di wilayah ini. Warga akan muncul setelah
      mereka mendaftar dan memvalidasi lokasi.
    </p>
  </div>
);

export default function DaftarWargaPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<ZoneMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getZoneMembers();
        setMembers(data.members);
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 403) {
          setAccessError(err.response.data?.detail || 'Halaman ini hanya untuk Ketua RT/RW.');
        } else {
          setAccessError('Gagal memuat daftar warga. Periksa koneksi internet Anda.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
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
              <h1 className="font-bold text-lg text-slate-900 leading-tight">Daftar Warga</h1>
              <p className="text-xs text-slate-500">
                {loading ? 'Memuat...' : `${members.length} warga terdaftar`}
              </p>
            </div>
          </div>
        </header>

        <main className="p-4">
          {loading ? (
            <SkeletonList />
          ) : members.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {members.map((m, idx) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                >
                  {/* Nama + role */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-navy-900/10 flex items-center justify-center text-navy-900 font-bold text-sm flex-shrink-0">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{m.full_name}</h3>
                    </div>
                    <RoleBadge role={m.role} />
                  </div>

                  {/* Detail: alamat, telp, status */}
                  <div className="space-y-1.5 pl-11">
                    {m.address_block && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {m.address_block}
                          {m.rt_number && ` • RT ${m.rt_number}`}
                          {m.rw_number && `/RW ${m.rw_number}`}
                        </span>
                      </div>
                    )}
                    {m.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={13} className="text-slate-400 flex-shrink-0" />
                        <a href={`tel:${m.phone}`} className="text-navy-900 hover:underline">
                          {m.phone}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      {m.data_completed ? (
                        <span className="flex items-center gap-1 text-success font-medium">
                          <CheckCircle2 size={13} /> Data lengkap
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={13} /> Data belum lengkap
                        </span>
                      )}
                      {m.is_verified && (
                        <span className="flex items-center gap-1 text-navy-900 font-medium">
                          <CheckCircle2 size={13} /> Terverifikasi
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </motion.div>
  );
}