import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '@/services/auth';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';
import { FullPageLoader } from '@/components/ui/Loader';

export default function LoginPage() {
  const { firebaseUser, isLoading } = useAuthStore();

  console.log(' Loginpage render:', {
    firebaseUser: firebaseUser?.email,
    isLoading
  });

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success('Berhasil masuk!');
    } catch (error) {
      toast.error('Gagal masuk, coba lagi.');
    }
  };

  if (isLoading) {
    return <FullPageLoader />;
  }

  // Jika user sudah login, tendang ke halaman utama
  if (firebaseUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      {/* ... sisa JSX sama seperti sebelumnya ... */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center"
      >
        <div className="flex justify-center">
          <ShieldCheck className="w-16 h-16 text-navy-900" />
        </div>
        
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 font-display">
            WargaSiaga
          </h1>
          <p className="text-gray-500">"Tetanggamu, Penjagamu"</p>
        </div>

        <p className="text-sm text-gray-600">
          Masuk untuk terhubung dengan tetangga dan menjaga keamanan lingkungan bersama.
        </p>
        
        <motion.button
          onClick={handleLogin}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-navy-900 text-white font-semibold rounded-full shadow-md hover:bg-navy-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
             <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          Masuk dengan Google
        </motion.button>

        <p className="text-xs text-gray-400 pt-4">
          Dengan masuk, Anda setuju dengan Syarat & Ketentuan kami.
        </p>
      </motion.div>
    </div>
  );
}