// frontend/src/hooks/useGpsTracking.ts
// Hook untuk live GPS tracking di map view.
// BEDA dari useGeolocation: auto-prompt saat mount, return rich status enum.
import { useState, useEffect, useCallback } from 'react';

interface UseGpsTrackingReturn {
  location: { lat: number; lng: number } | null;
  status: 'pending' | 'granted' | 'denied' | 'unavailable' | 'error';
  error: string | null;
  requestPermission: () => void;
}

export const useGpsTracking = (): UseGpsTrackingReturn => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<UseGpsTrackingReturn['status']>('pending');
  const [error, setError] = useState<string | null>(null);

  const handleSuccess: PositionCallback = (position) => {
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    setStatus('granted');
    setError(null);
  };

  const handleError: PositionErrorCallback = (err) => {
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        setStatus('denied');
        setError("Akses lokasi ditolak. Aktifkan di pengaturan browser.");
        break;
      case 2: // POSITION_UNAVAILABLE
        setStatus('unavailable');
        setError("Lokasi tidak tersedia saat ini.");
        break;
      case 3: // TIMEOUT
        setStatus('error');
        setError("Gagal mendapatkan lokasi (timeout). Coba lagi.");
        break;
      default:
        setStatus('error');
        setError("Gagal mendapatkan lokasi. Coba lagi.");
        break;
    }
  };

  const getPosition = useCallback(() => {
    // Defensive guard kalau browser gak support GPS
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setError("Browser tidak mendukung GPS.");
      return;
    }

    setStatus('pending');
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  }, []);

  // Auto-request saat hook pertama di-mount
  useEffect(() => {
    getPosition();
  }, [getPosition]);

  return { location, status, error, requestPermission: getPosition };
};