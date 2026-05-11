import { motion } from 'framer-motion';
import { signOutUser } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import { LogOut } from 'lucide-react';

export default function HomePage() {
  const { firebaseUser } = useAuthStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-white rounded-card shadow-card text-center"
      >
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Selamat Datang!</h1>
        <p className="text-gray-600 mb-6">
          Anda masuk sebagai <span className="font-semibold">{firebaseUser?.displayName}</span>
        </p>
        <motion.button
          onClick={signOutUser}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emergency text-white font-semibold rounded-full shadow-md hover:bg-red-700 transition-colors"
        >
          <LogOut size={18} />
          Keluar
        </motion.button>
      </motion.div>
    </div>
  );
}