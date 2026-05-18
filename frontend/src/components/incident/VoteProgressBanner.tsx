import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

interface VoteProgressBannerProps {
  currentWeight: number;
  incidentStatus: 'active' | 'resolved' | 'false_alarm' | 'expired';
  threshold?: number;
}

// Sinkronkan dengan threshold di backend
const DEFAULT_THRESHOLD = 6;

export default function VoteProgressBanner({
  currentWeight,
  incidentStatus,
  threshold = DEFAULT_THRESHOLD,
}: VoteProgressBannerProps) {
  // Guard: Banner ini hanya muncul jika ada vote dan insiden masih aktif.
  const isVisible = incidentStatus === 'active' && currentWeight > 0;

  // Kalkulasi untuk progress bar dan teks
  const percent = Math.min((currentWeight / threshold) * 100, 100);
  const remaining = Math.max(threshold - currentWeight, 0);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="rounded-2xl bg-amber-50 border-l-4 border-amber-400 p-4 shadow-sm space-y-2"
        >
          {/* Header Banner */}
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-600" />
            <h3 className="font-semibold text-amber-900">Vote Laporan Palsu</h3>
            <span className="ml-auto text-sm font-medium text-amber-700">
              {currentWeight}/{threshold} poin
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 w-full bg-amber-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Status Teks */}
          <p className="text-xs text-amber-700">
            {remaining > 0
              ? `Butuh ${remaining} poin lagi untuk membatalkan laporan ini secara otomatis.`
              : 'Poin tercapai. Laporan akan segera dibatalkan...'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}