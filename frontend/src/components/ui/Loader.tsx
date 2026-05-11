import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export const FullPageLoader = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-3">
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <ShieldCheck className="w-16 h-16 text-navy-900" />
    </motion.div>
    <p className="text-sm text-gray-500 font-medium">Memuat...</p>
  </div>
);