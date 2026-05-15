// frontend/src/hooks/useGeolocation.ts
// Hook untuk on-demand GPS capture (dipakai HomePage untuk panic button).
// On-demand = user harus klik tombol, BUKAN auto-prompt.
import { useState, useCallback } from 'react';
import type { Location } from '@/types/user';

interface GeolocationState {
  location: Location | null;
  error: string | null;
  isLoading: boolean;
  getGeolocation: () => void;
}

export const useGeolocation = (): GeolocationState => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getGeolocation = useCallback(() => {
    setIsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  return { location, error, isLoading, getGeolocation };
};