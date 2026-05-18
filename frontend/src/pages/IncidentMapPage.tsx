import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getIncidentDetail } from '@/services/incident';
import type { IncidentDetail, ResponderInfo as ResponderType } from '@/services/incident';
import { ChevronLeft, MapPin, User, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { AxiosError } from 'axios';
import IncidentMap from '@/components/map/IncidentMap';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import AudioPlayer from '@/components/incident/AudioPlayer';
import ResponderActions from '@/components/incident/ResponderActions';
import { useIncidentRealtime } from '@/hooks/useIncidentRealtime';
import { toast } from 'sonner';
import VoteProgressBanner from '@/components/incident/VoteProgressBanner';

const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
};

type RoleKey = 'RW' | 'RT' | 'WARGA' | 'STRANGER';

const RoleBadge = ({ role, isStranger }: { role: RoleKey; isStranger: boolean }) => {
  const styles: Record<RoleKey, string> = {
    RW: 'bg-purple-100 text-purple-700',
    RT: 'bg-blue-100 text-blue-700',
    WARGA: 'bg-green-100 text-green-700',
    STRANGER: 'bg-yellow-100 text-yellow-700',
  };
  const labels: Record<RoleKey, string> = {
    RW: 'Ketua RW',
    RT: 'Ketua RT',
    WARGA: 'Warga',
    STRANGER: '⚠️ Belum Terverifikasi',
  };
  const key: RoleKey = isStranger ? 'STRANGER' : role;
  return (
    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${styles[key]}`}>
      {labels[key]}
    </span>
  );
};

const SkeletonLoader = () => (
  <div className="p-4 space-y-4">
    <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
    <div className="h-20 bg-slate-200 rounded-2xl animate-pulse"></div>
    <div className="h-[320px] bg-slate-200 rounded-2xl animate-pulse"></div>
    <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
  </div>
);

const GpsWarningBanner = ({ status, error, onRetry }: { status: string; error: string | null; onRetry: () => void }) => {
  if (status === 'granted' || status === 'pending') return null;
  return (
    <div className="rounded-xl bg-yellow-50 border-l-4 border-yellow-400 p-3 flex items-start gap-3">
      <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-yellow-800">
          {status === 'denied' ? 'Aktifkan GPS' : 'Lokasi Tidak Tersedia'}
        </p>
        <p className="text-xs text-yellow-700">
          {error}
          {status !== 'denied' && (
            <motion.button onClick={onRetry} whileTap={{ scale: 0.95 }} className="ml-1 font-semibold underline">
              Coba lagi
            </motion.button>
          )}
        </p>
      </div>
    </div>
  );
};

type ConnectionStatus = 'idle' | 'subscribing' | 'connected' | 'disconnected' | 'error';
type ActiveConnectionStatus = Exclude<ConnectionStatus, 'idle'>;

const ConnectionIndicator = ({ status }: { status: ConnectionStatus }) => {
  const indicatorStyles: Record<ActiveConnectionStatus, { bg: string; text: string }> = {
    connected: { bg: 'bg-green-500', text: 'Live' },
    subscribing: { bg: 'bg-yellow-500', text: 'Menghubungkan...' },
    disconnected: { bg: 'bg-slate-400', text: 'Offline' },
    error: { bg: 'bg-red-500', text: 'Error' },
  };

  if (status === 'idle') return null;

  // Setelah guard di atas, TypeScript narrow status jadi ActiveConnectionStatus
  const { bg, text } = indicatorStyles[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <motion.div
        className={`w-2 h-2 rounded-full ${bg}`}
        animate={status === 'connected' ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] } : {}}
        transition={status === 'connected' ? { duration: 1.5, repeat: Infinity } : {}}
      />
      <span>{text}</span>
    </div>
  );
};

export default function IncidentMapPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { location: ownLocation, status: gpsStatus, error: gpsError, requestPermission } = useGpsTracking();

  const fetchData = async () => {
    if (!incidentId) {
      setError("ID insiden tidak valid.");
      setLoading(false);
      return;
    }
    if (!incident) setLoading(true);
    setError(null);
    try {
      const data = await getIncidentDetail(incidentId);
      setIncident(data);
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 404) setError("Insiden tidak ditemukan atau sudah ditutup.");
        else if (err.response?.status === 401) navigate('/login');
        else setError("Gagal memuat data. Periksa koneksi internet Anda.");
      } else {
        setError("Terjadi kesalahan yang tidak diketahui.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [incidentId]);
  
const { connectionStatus } = useIncidentRealtime({
  incidentId,
  onResponseAdded: () => {
    // Notif singkat, detail nama akan muncul setelah fetchData refresh
    toast.info('👋 Ada tetangga baru yang merespon.');
    fetchData();
  },
  onIncidentUpdated: (newRecord, oldRecord) => {
    // Type narrowing: payload realtime dari Supabase berformat raw DB row
    const newStatus = (newRecord as { status?: string })?.status;
    const oldStatus = (oldRecord as { status?: string })?.status;
    
    if (oldStatus && newStatus && newStatus !== oldStatus) {
      const statusLabels: Record<string, string> = {
        false_alarm: '🛑 Laporan Palsu',
        resolved: '✅ Selesai',
        expired: '⏰ Kedaluwarsa',
      };
      toast.success(`Status berubah: ${statusLabels[newStatus] || newStatus}`);
    }
    fetchData();
  },
});

  if (loading) return <SkeletonLoader />;

  if (error || !incident) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-center p-4">
        <h2 className="text-5xl mb-4">😕</h2>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Oops, Gagal Memuat</h3>
        <p className="text-slate-500 mb-6 max-w-xs">{error || "Data insiden tidak dapat ditampilkan."}</p>
        <div className="flex gap-4">
          <motion.button onClick={() => navigate('/')} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-full">Kembali ke Beranda</motion.button>
          <motion.button onClick={fetchData} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white font-semibold rounded-full">
            <RefreshCw size={16} /> Coba Lagi
          </motion.button>
        </div>
      </div>
    );
  }

  const respondingNeighborsCount = incident.responders.filter(r => r.response_type === 'going').length;
  const responderLocations = incident.responders
    .filter((r): r is ResponderType & { current_location: { lat: number, lng: number } } => r.response_type === 'going' && r.current_location !== null)
    .map(r => ({ id: r.id, name: r.full_name, location: r.current_location }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 min-h-screen">
      <div className="max-w-md mx-auto">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.9 }} className="p-2 -ml-2 mr-2"><ChevronLeft size={24} className="text-slate-700" /></motion.button>
              <div>
                <h1 className="font-bold text-lg text-slate-900 leading-tight">🚨 Panik dari {incident.reporter.full_name}</h1>
                <p className="text-xs text-slate-500">
                  {incident.rt_zone_number && `RT ${incident.rt_zone_number}`}{incident.rt_zone_number && incident.rw_zone_number && ' • '}{incident.rw_zone_number && `RW ${incident.rw_zone_number}`}{' • '}{formatTimeAgo(incident.created_at)}
                </p>
              </div>
            </div>
            <ConnectionIndicator status={connectionStatus} />
          </div>
        </header>

        <main className="p-4 space-y-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="rounded-2xl border-l-4 border-navy-900 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl">🤖</span>
              <div>
                <h3 className="font-semibold text-slate-800">Analisis AI</h3>
                {incident.ai_summary ? (<p className="text-sm text-slate-600 mt-1">{incident.ai_summary}</p>) : (<div className="mt-2 space-y-2"><p className="text-sm text-slate-500">Menganalisis suara dengan AI...</p><div className="h-2 w-full bg-slate-200 rounded-full animate-pulse"></div></div>)}
              </div>
            </div>
          </motion.div>
          
          {/* PHASE 6.2: Vote Progress Banner */}
          <VoteProgressBanner
            currentWeight={incident.total_vote_weight_false_alarm}
            incidentStatus={incident.status}
          />
          
          <GpsWarningBanner status={gpsStatus} error={gpsError} onRetry={requestPermission} />
          <IncidentMap className="h-[320px]" korbanLocation={incident.location} ownLocation={ownLocation} responders={responderLocations} />
          <div className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3"><MapPin size={20} className="text-slate-400 mt-0.5 flex-shrink-0" /><p className="text-sm text-slate-700">{incident.human_address || `Koordinat: ${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}`}</p></div>
            <div className="flex items-center gap-3"><User size={20} className="text-slate-400 flex-shrink-0" /><p className="text-sm text-slate-700 font-medium">{incident.reporter.full_name}<RoleBadge role={incident.reporter.role} isStranger={incident.reporter.is_stranger} /></p></div>
            <div className="flex items-center gap-3"><Users size={20} className="text-slate-400 flex-shrink-0" /><p className="text-sm text-slate-700">{respondingNeighborsCount > 0 ? `${respondingNeighborsCount} tetangga sedang merespon` : "Belum ada yang merespon"}</p></div>
            {incident.status === 'false_alarm' && (<div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 text-xs font-medium rounded-lg"><AlertTriangle size={14} /><span>Laporan ini ditandai sebagai laporan palsu.</span></div>)}
          </div>
          
          <div className="space-y-4">
            <AudioPlayer audioUrl={incident.audio_url} durationSec={incident.audio_duration_sec} />
            <ResponderActions 
              incidentId={incident.id}
              reporterId={incident.reporter.id}
              initialResponders={incident.responders}
              ownLocation={ownLocation}
              onResponseSubmitted={fetchData}
            />
          </div>
        </main>
      </div>
    </motion.div>
  );
}