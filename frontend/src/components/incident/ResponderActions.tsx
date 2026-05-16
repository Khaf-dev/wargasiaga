import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { respondToIncident } from '@/services/incident';
import type { ResponderInfo, RespondRequest, Location } from '@/services/incident';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { MapPin, AlertTriangle, Check, Loader2 } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';

interface ResponderActionsProps {
  incidentId: string;
  reporterId: string;
  initialResponders: ResponderInfo[];
  ownLocation: Location | null;
  onResponseSubmitted: () => void;
}

export default function ResponderActions({ incidentId, reporterId, initialResponders, ownLocation, onResponseSubmitted }: ResponderActionsProps) {
  const currentUser = useAuthStore(s => s.userProfile);
  const [submitting, setSubmitting] = useState<null | 'going' | 'false_alarm'>(null);
  const [showFalseAlarmConfirm, setShowFalseAlarmConfirm] = useState(false);

  if (!currentUser) return null; // Harusnya tidak terjadi di halaman yang protected

  const isReporter = currentUser.id === reporterId;
  const alreadyResponded = initialResponders.some(r => r.id === currentUser.id);
  const canVoteFalseAlarm = currentUser.role !== 'STRANGER';

  const handleGoing = async () => {
    if (!ownLocation) {
      toast.error("Aktifkan GPS untuk bisa merespon 'Saya ke Lokasi'.");
      return;
    }
    setSubmitting('going');
    const toastId = toast.loading("Mengirim respons...");
    try {
      const request: RespondRequest = {
        response_type: 'going',
        current_location: ownLocation,
      };
      await respondToIncident(incidentId, request);
      toast.success("Respons terkirim! Tetap waspada di lokasi.", { id: toastId });
      onResponseSubmitted();
    } catch (err) {
      const msg = err instanceof AxiosError ? (err.response?.data?.detail || "Gagal mengirim respons") : "Gagal mengirim respons";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(null);
    }
  };

  const handleFalseAlarm = async () => {
    setShowFalseAlarmConfirm(false);
    setSubmitting('false_alarm');
    const toastId = toast.loading("Mengirim vote...");
    try {
      const request: RespondRequest = { response_type: 'false_alarm' };
      await respondToIncident(incidentId, request);
      toast.success("Vote diterima. Tetangga akan melihat penilaian Anda.", { id: toastId });
      onResponseSubmitted();
    } catch (err) {
      const msg = err instanceof AxiosError ? (err.response?.data?.detail || "Gagal mengirim vote") : "Gagal mengirim vote";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(null);
    }
  };

  if (isReporter) {
    return (
      <div className="rounded-2xl bg-slate-100 p-4 text-center text-slate-500 text-sm">
        Ini adalah laporan Anda. Anda tidak bisa merespon laporan sendiri.
      </div>
    );
  }

  if (alreadyResponded) {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center text-green-800 font-medium flex items-center justify-center gap-2">
        <Check size={20} />
        <span>Anda sudah merespon laporan ini. Terima kasih!</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={handleGoing}
          disabled={submitting !== null || !ownLocation}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-green-600 text-white font-semibold rounded-2xl shadow-sm hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting === 'going' ? <Loader2 className="animate-spin" /> : <MapPin />}
          <span>Saya ke Lokasi</span>
          {!ownLocation && <span className="text-xs font-normal opacity-70">(Aktifkan GPS)</span>}
        </motion.button>

        <motion.button
          onClick={() => setShowFalseAlarmConfirm(true)}
          disabled={submitting !== null || !canVoteFalseAlarm}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-red-500 text-red-600 font-semibold rounded-2xl shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting === 'false_alarm' ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
          <span>Laporan Palsu</span>
          {!canVoteFalseAlarm && <span className="text-xs font-normal">(Tidak ada hak vote)</span>}
        </motion.button>
      </div>

      <BottomSheet isOpen={showFalseAlarmConfirm} onClose={() => setShowFalseAlarmConfirm(false)} title="Konfirmasi Laporan Palsu">
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Yakin laporan ini palsu?</h3>
          <p className="text-sm text-slate-600 mb-6">
            Vote Anda akan dihitung bersama warga lain. Jika cukup vote terkumpul, laporan ini akan dibatalkan secara otomatis.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowFalseAlarmConfirm(false)} className="py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl">Batalkan</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleFalseAlarm} className="py-3 bg-red-600 text-white font-semibold rounded-xl">Ya, Vote Palsu</motion.button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}