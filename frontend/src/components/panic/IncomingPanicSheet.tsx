// frontend/src/components/panic/IncomingPanicSheet.tsx
// Taruh di folder panic/ (sudah ada) — bukan notifications/
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertTriangle, Shield, Brain } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import type { ActivePanicAlert } from '@/store/notificationStore';

// ─── Config badge per role ──────────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  ActivePanicAlert['reporterRole'],
  { label: string; className: string; icon: string }
> = {
  RW: { label: 'Ketua RW', className: 'bg-[#1E3A8A] text-white', icon: '👑' },
  RT: { label: 'Ketua RT', className: 'bg-blue-500 text-white', icon: '🛡️' },
  WARGA: { label: 'Warga Terverifikasi', className: 'bg-slate-500 text-white', icon: '👤' },
  STRANGER: { label: 'Belum Terverifikasi', className: 'bg-amber-500 text-white', icon: '⚠️' },
};

// ─── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({ duration, onComplete }: { duration: number; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(duration);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const strokeOffset = circumference - (remaining / duration) * circumference;

  return (
    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <svg className="absolute -rotate-90" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="text-[11px] font-bold text-[#1E3A8A] tabular-nums">{remaining}s</span>
    </div>
  );
}

// ─── Pulsing alert icon ─────────────────────────────────────────────────────────
function PulsingAlertIcon() {
  return (
    <div className="relative w-14 h-14 shrink-0">
      <motion.div
        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        className="absolute inset-0 rounded-full bg-red-400"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
        className="absolute inset-0 rounded-full bg-red-500"
      />
      <div className="absolute inset-0 rounded-full bg-[#DC2626] flex items-center justify-center shadow-lg">
        <AlertTriangle size={22} className="text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function IncomingPanicSheet() {
  const navigate = useNavigate();
  const { activePanic, clearActivePanic, markRead } = useNotificationStore();
  const isDragging = useRef(false);

  const formatDistanceText = (meters: number): string => {
    if (!meters) return 'Lokasi tidak diketahui';
    return meters < 1000 ? `~${meters}m dari lokasimu` : `~${(meters / 1000).toFixed(1)} km dari lokasimu`;
  };

  const getDistanceLabel = (meters: number): { text: string; color: string } => {
    if (!meters) return { text: 'Jarak tidak diketahui', color: 'text-slate-500' };
    if (meters < 150) return { text: '🔴 Sangat Dekat!', color: 'text-red-600' };
    if (meters < 400) return { text: '🟠 Cukup Dekat', color: 'text-orange-500' };
    return { text: '🟡 Masih Terjangkau', color: 'text-amber-500' };
  };

  const handleGoToLocation = () => {
    if (!activePanic) return;
    markRead(activePanic.incidentId);
    clearActivePanic();
    navigate(`/incidents/${activePanic.incidentId}`);
  };

  const handleDismiss = () => {
    if (activePanic) markRead(activePanic.incidentId);
    clearActivePanic();
  };

  if (!activePanic) return null;

  const roleConfig = ROLE_CONFIG[activePanic.reporterRole] ?? ROLE_CONFIG.WARGA;
  const distanceLabel = getDistanceLabel(activePanic.distanceMeters);
  const isUnverified = activePanic.reporterRole === 'STRANGER' || activePanic.isStranger;

  return (
    <AnimatePresence>
      {activePanic && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/45 z-40 backdrop-blur-[2px]"
            onClick={() => { if (!isDragging.current) handleDismiss(); }}
          />

          {/* Bottom Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 380, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.35 }}
            onDragStart={() => { isDragging.current = true; }}
            onDragEnd={(_, info) => {
              isDragging.current = false;
              if (info.offset.y > 90) handleDismiss();
            }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[22px] overflow-hidden"
            style={{ maxHeight: '88vh', boxShadow: '0 -6px 40px rgba(0,0,0,0.20)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-5 pb-8 pt-2" style={{ maxHeight: 'calc(88vh - 28px)' }}>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <PulsingAlertIcon />
                  <div>
                    <p className="text-[11px] font-bold text-[#DC2626] uppercase tracking-widest">
                      Insiden Terdekat
                    </p>
                    <h2 className="text-[22px] font-extrabold text-slate-900 leading-tight">
                      Butuh Bantuan!
                    </h2>
                  </div>
                </div>
                {/* Auto-dismiss countdown 60 detik */}
                <CountdownRing duration={60} onComplete={handleDismiss} />
              </div>

              {/* Reporter card */}
              <div className="bg-slate-50 rounded-2xl p-4 mb-3 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar inisial */}
                    <div className="w-10 h-10 rounded-full bg-[#1E3A8A] flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-sm">
                        {activePanic.reporterName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm leading-tight">
                        {activePanic.reporterName}
                      </p>
                      <span className={`inline-flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleConfig.className}`}>
                        {roleConfig.icon} {roleConfig.label}
                      </span>
                    </div>
                  </div>
                  {/* Verification badge */}
                  {!isUnverified ? (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                      <Shield size={11} /> Terverifikasi
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full shrink-0">
                      <AlertTriangle size={11} /> Tak Dikenal
                    </div>
                  )}
                </div>

                {/* Stranger warning */}
                {isUnverified && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3"
                  >
                    <p className="text-xs text-amber-800 leading-relaxed">
                      ⚠️ Pelapor ini belum terdaftar di RT/RW sekitarmu. Prioritaskan
                      keselamatanmu sebelum merespons.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Distance info */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4 mb-3 border border-slate-100">
                <div className="w-9 h-9 rounded-full bg-[#1E3A8A]/10 flex items-center justify-center shrink-0">
                  <MapPin size={17} className="text-[#1E3A8A]" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${distanceLabel.color}`}>
                    {distanceLabel.text}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDistanceText(activePanic.distanceMeters)}
                  </p>
                </div>
              </div>

              {/* AI summary — hanya tampil kalau ada (Phase 5 mengisi ini) */}
              {activePanic.aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-[#1E3A8A]/5 border border-[#1E3A8A]/15 rounded-2xl p-4 mb-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Brain size={13} className="text-[#1E3A8A]" />
                    <p className="text-[11px] font-bold text-[#1E3A8A] uppercase tracking-widest">
                      Analisis AI
                    </p>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{activePanic.aiSummary}</p>
                </motion.div>
              )}

              {/* CTA buttons */}
              <div className="space-y-3 mt-5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGoToLocation}
                  className="w-full py-[15px] rounded-2xl bg-[#10B981] text-white font-bold text-base flex items-center justify-center gap-2 active:brightness-95"
                  style={{ boxShadow: '0 4px 20px rgba(16,185,129,0.40)' }}
                >
                  <MapPin size={20} strokeWidth={2.5} />
                  Saya ke Lokasi
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDismiss}
                  className="w-full py-[14px] rounded-2xl border-2 border-slate-200 text-slate-500 font-semibold text-base active:bg-slate-50"
                >
                  Abaikan Sekarang
                </motion.button>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed px-4">
                Keselamatanmu adalah prioritas utama.
                Hanya bantu jika kondisi sekitarmu aman.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}