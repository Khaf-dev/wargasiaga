import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  // Efek untuk mengunci scroll di background saat sheet terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    // Cleanup function untuk mengembalikan scroll saat komponen unmount
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()} // Mencegah klik di dalam sheet menutupnya
            className="fixed bottom-0 left-0 right-0 mx-auto max-w-md w-full bg-white rounded-t-3xl shadow-2xl z-50"
          >
            <div className="p-6">
              {/* Drag Handle Visual */}
              <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              
              {/* Header */}
              {title && (
                <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="p-1 rounded-full text-slate-500 hover:bg-slate-100"
                  >
                    <X size={20} />
                  </motion.button>
                </div>
              )}
              
              {/* Content */}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}