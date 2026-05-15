import api from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '@/lib/firebase';

// --- Tipe Data Baru untuk Phase 4.3a ---

export interface Location {
  lat: number;
  lng: number;
}

export interface ReporterInfo {
  id: string;
  full_name: string;
  role: 'RW' | 'RT' | 'WARGA' | 'STRANGER';
  is_stranger: boolean;
}

export interface ResponderInfo {
  id: string;
  full_name: string;
  role: 'RW' | 'RT' | 'WARGA' | 'STRANGER';
  response_type: 'going' | 'false_alarm' | 'witness';
  current_location: Location | null;
  vote_weight: number;
  joined_at: string; // ISO datetime
}

export interface IncidentDetail {
  id: string;
  status: 'active' | 'resolved' | 'false_alarm' | 'expired';
  location: Location;
  audio_url: string | null;
  audio_duration_sec: number;
  ai_summary: string | null;
  human_address: string | null;
  ai_classification: Record<string, unknown> | null;
  reporter: ReporterInfo;
  responders: ResponderInfo[];
  rt_zone_number: string | null;
  rw_zone_number: string | null;
  created_at: string; // ISO datetime
  total_vote_weight_false_alarm: number;
}

export interface RespondRequest {
  response_type: 'going' | 'false_alarm' | 'witness';
  current_location?: Location;
  notes?: string;
}

export interface RespondResponseData {
  message: string;
  response_id: string;
  vote_weight: number;
  is_final: boolean;
  incident_status: string;
}

// --- Fungsi yang Sudah Ada (dipertahankan verbatim) ---

interface PanicPayload {
  location: Location;
  audioBlob: Blob;
  // userId dihapus — kita pakai Firebase Auth UID langsung untuk match Storage Rules
}

export const triggerPanic = async ({ location, audioBlob }: PanicPayload) => {
  // ⚠️ WAJIB pakai Firebase Auth UID (BUKAN userProfile.id dari Postgres)
  // Storage Rules: allow write if request.auth.uid == userId di path
  const firebaseUid = auth.currentUser?.uid;
  if (!firebaseUid) {
    throw new Error('User tidak terautentikasi. Silakan login ulang.');
  }
  
  // 1. Upload audio ke Firebase Storage dengan path yg match Storage Rules
  const timestamp = Date.now();
  const storageRef = ref(storage, `incidents/${firebaseUid}/${timestamp}.webm`);
  const uploadResult = await uploadBytes(storageRef, audioBlob);
  const downloadURL = await getDownloadURL(uploadResult.ref);

  // 2. Kirim data ke backend API
  const backendPayload = {
    location,
    audio_url: downloadURL,
    audio_duration_sec: 10,
  };
  
  const { data } = await api.post('/incidents/panic', backendPayload);
  return data;
};

// --- Fungsi Baru untuk Phase 4.3a ---

/**
 * Mengambil detail lengkap sebuah insiden dari backend.
 * @param incidentId - UUID dari insiden yang akan diambil.
 * @returns Promise yang resolve ke data detail insiden.
 */
export const getIncidentDetail = async (incidentId: string): Promise<IncidentDetail> => {
  const response = await api.get<IncidentDetail>(`/incidents/${incidentId}`);
  return response.data;
};

/**
 * Mengirimkan respons terhadap sebuah insiden.
 * @param incidentId - UUID dari insiden yang direspon.
 * @param request - Payload respons, termasuk tipe dan lokasi (jika perlu).
 * @returns Promise yang resolve ke data hasil respons.
 */
export const respondToIncident = async (incidentId: string, request: RespondRequest): Promise<RespondResponseData> => {
  const response = await api.post<RespondResponseData>(`/incidents/${incidentId}/respond`, request);
  return response.data;
};