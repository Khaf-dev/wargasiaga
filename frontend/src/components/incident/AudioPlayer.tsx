import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, AlertTriangle, Mic } from 'lucide-react';
import { toast } from 'sonner';
import BottomSheet from '@/components/ui/BottomSheet';

interface AudioPlayerProps {
  audioUrl: string | null;
  durationSec: number;
}

const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function AudioPlayer({ audioUrl, durationSec }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  // Cek consent dari localStorage saat komponen pertama kali mount
  useEffect(() => {
    try {
      if (localStorage.getItem('wargasiaga_audio_consent_v1') === 'true') {
        setHasConsented(true);
      }
    } catch (error) {
      console.warn("Gagal mengakses localStorage:", error);
    }
  }, []);

  // Setup event listener untuk elemen audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      toast.error("Gagal memuat audio. File mungkin rusak atau tidak ada.");
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Cleanup listener saat komponen unmount
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!audioUrl) return;

    if (!hasConsented) {
      setShowConsent(true);
      return;
    }

    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleConsentAndPlay = () => {
    try {
      localStorage.setItem('wargasiaga_audio_consent_v1', 'true');
    } catch (error) {
      console.warn("Gagal menyimpan consent ke localStorage:", error);
    }
    setHasConsented(true);
    setShowConsent(false);
    
    // Tunggu sebentar agar sheet tertutup sebelum play
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }, 300);
  };

  const progress = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;

  return (
    <>
      <div className="rounded-2xl bg-white shadow-sm p-4">
        {/* Elemen audio yang disembunyikan */}
        <audio ref={audioRef} src={audioUrl || ''} preload="metadata" />

        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800">Rekaman Audio Korban</h3>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {durationSec} detik
          </span>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            onClick={handlePlayPause}
            disabled={!audioUrl}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 flex-shrink-0 bg-navy-900 text-white rounded-full flex items-center justify-center disabled:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </motion.button>
          <div className="flex-1">
            {audioUrl ? (
              <>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-navy-900"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-right text-xs text-slate-500 mt-1">
                  {formatTime(currentTime)} / {formatTime(durationSec)}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Audio belum tersedia.</p>
            )}
          </div>
        </div>
      </div>

      <BottomSheet isOpen={showConsent} onClose={() => setShowConsent(false)} title="Pemberitahuan">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Audio Mengandung Konten Sensitif</h3>
          <p className="text-sm text-slate-600 mb-6">
            Audio ini direkam dari situasi darurat dan dapat mengandung suara teriakan, bahasa kasar, atau konten yang mengganggu. Pastikan Anda siap secara mental sebelum mendengarkan.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowConsent(false)} className="py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl">Batal</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleConsentAndPlay} className="py-3 bg-navy-900 text-white font-semibold rounded-xl">Saya Mengerti, Putar Audio</motion.button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}