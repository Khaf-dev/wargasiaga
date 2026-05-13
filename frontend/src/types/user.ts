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