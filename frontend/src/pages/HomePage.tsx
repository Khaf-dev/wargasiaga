// frontend/src/pages/HomePage.tsx
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { LogOut, MapPin, Users, UserCircle, ChevronRight } from 'lucide-react';
import type { UserRole } from '@/types/user';
import { PanicButton } from '@/components/panic/PanicButton';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { triggerPanic } from '@/services/incident';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const RoleBadge = ({ role }: { role: UserRole }) => {
  const styles = {
    WARGA: "bg-green-100 text-green-800",
    RT: "bg-yellow-100 text-yellow-800",
    RW: "bg-yellow-100 text-yellow-800",
    STRANGER: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`px-2.5 py-0.5 text-sm font-medium rounded-full ${styles[role]}`}>
      {role}
    </span>
  );
};

// Phase 8.6: Card menu navigasi (Section 4 — card, navy, Framer Motion)
const MenuCard = ({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    whileHover={{ scale: 1.01 }}
    className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-left"
  >
    <div className="w-10 h-10 rounded-xl bg-navy-900/10 flex items-center justify-center text-navy-900 flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      <p className="text-xs text-slate-500 truncate">{subtitle}</p>
    </div>
    <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
  </motion.button>
);

export default function HomePage() {
  const { userProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const { location, requestPermission } = useGpsTracking();
  const { audioBlob, startRecording, resetAudioBlob } = useAudioRecorder(10000);

  const isSendingRef = useRef(false);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handlePanic = async () => {
    if (isSendingRef.current) return;

    toast.info("Merekam audio selama 10 detik...");
    try {
      await startRecording();
    } catch (error) {
      toast.error("Gagal memulai laporan: Izin mikrofon ditolak");
    }
  };

  useEffect(() => {
    if (!audioBlob || isSendingRef.current) return;

    const sendPanicReport = async () => {
      if (!location) {
        toast.error("Lokasi tidak ditemukan. Laporan tidak dapat dikirim.");
        resetAudioBlob();
        return;
      }

      if (!userProfile) return;

      isSendingRef.current = true;

      const toastId = toast.loading("Mengirim laporan darurat...");

      try {
        const data = await triggerPanic({
          location,
          audioBlob,
          // userId: userProfile.id, <== fungsi ini sebenernya harus di hapus karena kita sudah pakai Firebase Auth API untuk handle auth di backend, jadi backend bisa langsung ambil UID dari token tanpa perlu dikirim dari client. Tapi untuk backward compatibility kita biarkan dulu, nanti di refactor di Phase 4.3b.
        });
        toast.success("Laporan berhasil dikirim! Bantuan sedang dikoordinasikan.", { id: toastId });
        // Navigate ke IncidentMapPage untuk monitor respon + AI analysis
        if (data?.incident_id) {
          navigate(`/incidents/${data.incident_id}`);
        }
      } catch (error) {
        toast.error("Gagal mengirim laporan. Periksa koneksi Anda.", { id: toastId });
      } finally {
        isSendingRef.current = false;
        resetAudioBlob();
      }
    };

    sendPanicReport();
  }, [audioBlob, location, userProfile, resetAudioBlob, navigate]); // Dependency array di-update sesuai best practice React

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 pb-32">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-white rounded-card shadow-card text-center relative z-10"
      >
        <div className="flex items-center justify-center gap-4 mb-2">
          <h1 className="text-2xl font-bold text-navy-900">Beranda</h1>
          {userProfile && <RoleBadge role={userProfile.role} />}
        </div>

        <p className="text-gray-600 mb-6">
          Selamat datang, <span className="font-semibold">{userProfile?.full_name}</span>!
        </p>

        {userProfile?.is_verified && (
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800 mb-6 font-medium">
            ✅ Anda telah terverifikasi sebagai {userProfile.role}
          </div>
        )}

        {/* FIX UI: Menghilangkan div min-h-screen yang redundant di dalam card */}
        <div className="p-4 mb-4">
            <p className="text-sm text-gray-500">Tekan tombol di bawah saat keadaan darurat.</p>
        </div>

        {/* Phase 8.6: Menu role-based */}
        <div className="space-y-2.5 mb-6">
          {/* Semua role: lengkapi data diri */}
          <MenuCard
            icon={<UserCircle size={20} />}
            title="Data Diri"
            subtitle="Lengkapi atau perbarui data dirimu"
            onClick={() => navigate('/data-diri')}
          />

          {/* RT/RW: kelola wilayah + lihat warga */}
          {(userProfile?.role === 'RT' || userProfile?.role === 'RW') && (
            <>
              <MenuCard
                icon={<MapPin size={20} />}
                title="Kelola Wilayah"
                subtitle={`Tentukan batas wilayah ${userProfile.role}`}
                onClick={() => navigate('/daftar-wilayah')}
              />
              <MenuCard
                icon={<Users size={20} />}
                title="Daftar Warga"
                subtitle="Lihat warga terdaftar di wilayahmu"
                onClick={() => navigate('/daftar-warga')}
              />
            </>
          )}

          {/* RW only: daftar RT */}
          {userProfile?.role === 'RW' && (
            <MenuCard
              icon={<Users size={20} />}
              title="Daftar RT"
              subtitle="Lihat semua RT di wilayah RW-mu"
              onClick={() => navigate('/daftar-rt')}
            />
          )}
        </div>

        <motion.button
          onClick={logout}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-200 text-slate-700 font-semibold rounded-full shadow-sm hover:bg-slate-300 transition-colors"
        >
          <LogOut size={18} />
          Keluar
        </motion.button>
      </motion.div>

      {/* PanicButton di luar card agar posisinya fixed di bottom screen */}
      <PanicButton onLongPressTrigger={handlePanic} />
    </div>
  );
}