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
  const { data } = await api.patch('/users/me/fcm-token', { dcm_token: token });
  return data;
}