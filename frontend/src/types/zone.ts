// frontend/src/types/zone.ts
// Phase 8.5: Types untuk geofencing / pendaftaran wilayah RT/RW

// Cocokkan dengan schemas/zone.py -> ZoneGeometryRequest
export interface ZoneGeometryRequest {
  lat: number;
  lng: number;
}

// Cocokkan dengan schemas/zone.py -> ZoneResponse
export interface ZoneResponse {
  id: string;
  zone_type: string; // 'RT' | 'RW'
  zone_number: string;
  radius_meters: number | null;
  parent_id: string | null;
  city: string;
  province: string;
  center_lat: number | null;
  center_lng: number | null;
  has_geometry: boolean;
}

// Cocokkan dengan schemas/zone.py -> ZoneUpdateResponse
export interface ZoneUpdateResponse {
  zone: ZoneResponse;
  message: string;
}

// ─── Phase 8.6: Dashboard role-based ─────────────────────────────────────────
export interface ZoneMember {
  id: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  address_block: string | null;
  rt_number: string | null;
  rw_number: string | null;
  phone: string | null;
  data_completed: boolean;
}

export interface ChildRT {
  id: string;
  zone_type: string;
  zone_number: string;
  radius_meters: number | null;
  has_geometry: boolean;
  member_count: number;
}

export interface ZoneOverview {
  zone_id: string;
  zone_type: string;
  zone_number: string;
  city: string;
  province: string;
  has_geometry: boolean;
  radius_meters: number | null;
  total_members: number;
  total_child_rts: number;
  verified_members: number;
}

export interface MembersListResponse {
  members: ZoneMember[];
  total: number;
}