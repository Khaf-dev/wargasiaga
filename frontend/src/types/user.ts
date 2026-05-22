// Enum harus cocok dengan backend/app/db/enums.py
export enum UserRole {
  RW = "RW",
  RT = "RT",
  WARGA = "WARGA",
  STRANGER = "STRANGER",
}

export interface Location {
  lat: number;
  lng: number;
}

export interface OnboardingRequest {
  home_location: Location;
}

// Cocokkan dengan schemas/user.py -> UserResponse
export interface UserResponse {
  id: string; // UUID
  firebase_uid: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_verified: boolean;
  trust_score: number;
  rt_id: string | null; // UUID
  rw_id: string | null; // UUID
}

// Cocokkan dengan schemas/user.py -> OnboardingResponse
export interface OnboardingResponse {
  user: UserResponse;
  message: string;
}

// ─── Phase 8.4: Pendataan Data Diri WARGA ────────────────────────────────────
export type Gender = "L" | "P";

// Cocokkan dengan schemas/user.py -> DataDiriRequest
export interface DataDiriRequest {
  nik: string;
  birth_place: string;
  birth_date: string; // ISO date string "YYYY-MM-DD"
  gender: Gender;
  address_block: string;
  rt_number: string;
  rw_number: string;
  kelurahan: string;
  kecamatan: string;
  phone: string;
}

// Cocokkan dengan schemas/user.py -> DataDiriResponse (usia computed di backend)
export interface DataDiriResponse {
  nik: string | null;
  birth_place: string | null;
  birth_date: string | null;
  gender: Gender | null;
  address_block: string | null;
  rt_number: string | null;
  rw_number: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  phone: string | null;
  data_completed: boolean;
  usia: number | null;
}

// Cocokkan dengan schemas/user.py -> DataDiriUpdateResponse
export interface DataDiriUpdateResponse {
  data: DataDiriResponse;
  message: string;
}