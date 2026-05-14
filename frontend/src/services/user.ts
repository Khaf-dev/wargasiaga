// frontend/src/services/user.ts
// BUG FIX: 'dcm_token' → 'fcm_token' (typo di existing code)
// Backend users.py mengecek payload.fcm_token, bukan dcm_token
import api from '@/lib/api';
import type { UserResponse, Location, OnboardingResponse } from '@/types/user';

export const getMe = async (): Promise<UserResponse> => {
  const { data } = await api.get<UserResponse>('/users/me');
  return data;
};

export const onboardUser = async (homeLocation: Location): Promise<OnboardingResponse> => {
  const requestBody = { home_location: homeLocation };
  const { data } = await api.post<OnboardingResponse>('/users/me/onboard', requestBody);
  return data;
};

export const updateFCMToken = async (token: string | null) => {
  // FIX: was 'dcm_token' (typo) — backend expects 'fcm_token'
  const { data } = await api.patch('/users/me/fcm-token', { fcm_token: token });
  return data;
};