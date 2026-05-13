import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { onboardUser } from '@/services/user';
import { toast } from 'sonner';
import type { Location, OnboardingResponse } from '@/types/user';
import { useNavigate } from 'react-router-dom';

type OnboardingStep = 'intro' | 'locating' | 'confirm' | 'submitting' | 'success' | 'fail';

const stepVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function OnboardingPage() {
  const { userProfile, fetchUserProfile } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [location, setLocation] = useState<Location | null>(null);
  const [onboardResult, setOnboardResult] = useState<OnboardingResponse | null>(null);

  const handleGetLocation = () => {
    setStep('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStep('confirm');
      },
      (error) => {
        toast.error(error.code === 1 ? "Izin lokasi ditolak. Aktifkan di pengaturan browser." : "Gagal mendapatkan lokasi.");
        setStep('intro');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleOnboard = async () => {
    if (!location) return;
    setStep('submitting');
    try {
      const response = await onboardUser(location);
      setOnboardResult(response);
      await fetchUserProfile();
      setStep(response.user.is_verified ? 'success' : 'fail');
    } catch (error) {
      toast.error("Verifikasi gagal. Silakan coba lagi.");
      setStep('confirm');
    }
  };

  const resetFlow = () => {
    setLocation(null);
    setOnboardResult(null);
    setStep('intro');
  };

  const renderStepContent = () => {
    switch (step) {
      case 'intro':
        return (
          <motion.div key="intro" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center">
            <h1 className="text-2xl font-bold text-navy-900">Selamat Datang, {userProfile?.full_name}!</h1>
            <p className="text-gray-600 mt-2 mb-8">Satu langkah lagi untuk mengamankan lingkunganmu. Verifikasi alamat rumah Anda.</p>
            <motion.button onClick={handleGetLocation} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-navy-900 text-white font-semibold rounded-full shadow-md">
              <MapPin size={20} /> Gunakan Lokasi Saya
            </motion.button>
          </motion.div>
        );
      case 'locating':
        return (
          <motion.div key="locating" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center flex flex-col items-center">
             <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
             >
                <MapPin size={48} className="text-navy-900" />
             </motion.div>
             <p className="text-gray-600 mt-4 font-semibold">Mencari lokasi Anda...</p>
          </motion.div>
        );
      case 'confirm':
        return (
          <motion.div key="confirm" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center">
            <h3 className="text-lg font-bold text-gray-800">Konfirmasi Lokasi</h3>
            <p className="text-sm text-gray-500 mt-2">Pastikan ini adalah lokasi rumah Anda untuk verifikasi zona RT/RW yang akurat.</p>
            <div className="my-4 p-3 bg-slate-100 rounded-lg text-xs text-center text-gray-700">
              Lat: {location?.lat.toFixed(6)}, Lng: {location?.lng.toFixed(6)}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <motion.button onClick={() => setStep('intro')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full py-3 bg-slate-200 text-slate-800 font-semibold rounded-full">Coba Lagi</motion.button>
              <motion.button onClick={handleOnboard} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full py-3 bg-navy-900 text-white font-semibold rounded-full">Lanjutkan Verifikasi</motion.button>
            </div>
          </motion.div>
        );
      case 'submitting':
          return (
            <motion.div key="submitting" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center flex flex-col items-center">
               <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
               >
                  <CheckCircle2 size={48} className="text-navy-900" />
               </motion.div>
               <p className="text-gray-600 mt-4 font-semibold">Memverifikasi zona...</p>
            </motion.div>
          );
      case 'success':
        return (
          <motion.div key="success" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
              <CheckCircle2 size={64} className="mx-auto text-success" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">🎉 Verifikasi Berhasil!</h1>
            <p className="text-gray-600 mt-2 mb-8">{onboardResult?.message}</p>
            <motion.button onClick={() => navigate('/')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full py-3 bg-navy-900 text-white font-semibold rounded-full">Lanjut ke Beranda</motion.button>
          </motion.div>
        );
      case 'fail':
        return (
          <motion.div key="fail" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center">
             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
                <AlertCircle size={64} className="mx-auto text-yellow-500" />
             </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Verifikasi Belum Berhasil</h1>
            <p className="text-gray-600 mt-2 mb-8">{onboardResult?.message}</p>
            <div className="flex flex-col gap-3">
              <motion.button onClick={resetFlow} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full py-3 bg-navy-900 text-white font-semibold rounded-full">Coba Lokasi Lain</motion.button>
              <button disabled className="w-full py-3 bg-slate-200 text-slate-500 font-semibold rounded-full cursor-not-allowed">Hubungi RT Setempat</button>
            </div>
          </motion.div>
        );
      default: return null;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-card shadow-card flex items-center justify-center" style={{ minHeight: '320px' }}>
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </div>
    </div>
  );
}