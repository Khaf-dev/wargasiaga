import { useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

interface PanicButtonProps {
  onLongPressTrigger: () => void;
}

export const PanicButton = ({ onLongPressTrigger }: PanicButtonProps) => {
  const controls = useAnimation();
  const pressTimeoutRef = useRef<number | null>(null);
  const isTriggeredRef = useRef(false); // Guard untuk memastikan trigger hanya sekali

  const handlePressStart = (event: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    // Cek apakah event dari keyboard dan bukan tombol spasi/enter
    if ('key' in event && event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    // Cek apakah sudah dalam proses menekan
    if (pressTimeoutRef.current) return;

    // FIX: Mencegah event mouse compatibility di mobile
    event.preventDefault();

    // Beri getaran saat mulai menekan
    if ('vibrate' in navigator) navigator.vibrate(50);

    isTriggeredRef.current = false;
    controls.start({
      pathLength: 1,
      transition: { duration: 2, ease: 'linear' },
    });
    
    pressTimeoutRef.current = window.setTimeout(() => {
      if (!isTriggeredRef.current) {
        // Beri getaran lebih kuat saat ter-trigger
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        onLongPressTrigger();
        isTriggeredRef.current = true;
      }
      handlePressEnd();
    }, 2000);
  };

  const handlePressEnd = () => {
    if (pressTimeoutRef.current) {
      window.clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }
    controls.stop();
    controls.set({ pathLength: 0 });
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <motion.button
        aria-label="Tahan Tombol Panik selama 2 detik untuk mengirim laporan darurat"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd} // Batalkan jika kursor keluar
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onKeyDown={handlePressStart}
        onKeyUp={handlePressEnd}
        whileTap={{ scale: 0.9 }}
        className="relative w-20 h-20 rounded-full bg-emergency flex items-center justify-center shadow-lg focus:outline-none focus:ring-4 focus:ring-red-300"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* ... (SVG dan Icon tidak berubah) ... */}
        <svg className="absolute w-full h-full" viewBox="0 0 100 100">
          <motion.path
            d="M 50, 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"
            fill="none"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={controls}
          />
        </svg>
        <ShieldAlert size={40} className="text-white z-10" />
      </motion.button>
    </div>
  );
};