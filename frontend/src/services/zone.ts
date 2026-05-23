// frontend/src/services/zone.ts
// Phase 8.5: API call untuk pendaftaran wilayah RT/RW
import api from '@/lib/api';
import type {
  ZoneGeometryRequest,
  ZoneResponse,
  ZoneUpdateResponse,
  ChildRT,
  ZoneOverview,
  MembersListResponse,
} from '@/types/zone';

// Ambil zona yang dikelola ketua (prefill map picker)
export const getMyZone = async (): Promise<ZoneResponse> => {
  const { data } = await api.get<ZoneResponse>('/zones/me');
  return data;
};

// Set center + radius zona (ketua klik kediaman di map)
export const updateZoneGeometry = async (
  payload: ZoneGeometryRequest
): Promise<ZoneUpdateResponse> => {
  const { data } = await api.patch<ZoneUpdateResponse>('/zones/me/geometry', payload);
  return data;
};

// ─── Phase 8.6: Dashboard ────────────────────────────────────────────────────
export const getZoneMembers = async (): Promise<MembersListResponse> => {
  const { data } = await api.get<MembersListResponse>('/zones/me/members');
  return data;
};

export const getChildRTs = async (): Promise<ChildRT[]> => {
  const { data } = await api.get<ChildRT[]>('/zones/me/children');
  return data;
};

export const getZoneOverview = async (): Promise<ZoneOverview> => {
  const { data } = await api.get<ZoneOverview>('/zones/me/overview');
  return data;
};