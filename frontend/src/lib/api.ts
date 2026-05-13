import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menambahkan token ke setiap request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().idToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor untuk menangani error, terutama 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        toast.error('Sesi Anda telah berakhir. Silakan masuk kembali.');
        // Trigger logout global
        useAuthStore.getState().logout();
      } else {
        // Handle error network atau server lainnya
        const message = error.response?.data?.detail || 'Terjadi kesalahan pada server.';
        toast.error(message);
      }
    }
    return Promise.reject(error);
  }
);

export default api;