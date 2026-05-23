// frontend/src/components/map/ZonePickerMap.tsx
// Phase 8.5: Map picker untuk pendaftaran wilayah RT/RW.
// Ketua klik titik kediaman → marker + circle radius (by role) muncul langsung.
// Reuse pattern @googlemaps/react-wrapper dari IncidentMap.tsx.
import { useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { Map as MapIcon, AlertTriangle } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
if (!MAPS_API_KEY) {
  throw new Error('VITE_GOOGLE_MAPS_API_KEY tidak ditemukan di environment variables.');
}

interface ZonePickerMapProps {
  // Titik terpilih (null = belum klik). Controlled dari parent.
  selectedPoint: { lat: number; lng: number } | null;
  // Dipanggil saat user klik map → kirim lat/lng ke parent
  onPointSelected: (point: { lat: number; lng: number }) => void;
  // Radius circle (meter) — by role: RT 500 / RW 1500
  radiusMeters: number;
  // Center awal map (default Monas kalau belum ada)
  initialCenter?: { lat: number; lng: number };
  // Warna circle (navy default; merah kalau invalid, dipakai parent nanti)
  circleColor?: string;
  className?: string;
}

const GoogleMapInner = ({
  selectedPoint,
  onPointSelected,
  radiusMeters,
  initialCenter,
  circleColor = '#1E3A8A',
}: ZonePickerMapProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  // Default center: Monas kalau gak ada initialCenter
  const defaultCenter = initialCenter ?? { lat: -6.1754, lng: 106.8272 };

  // Inisialisasi peta sekali saat mount
  useEffect(() => {
    if (ref.current && !mapInstance.current) {
      const map = new google.maps.Map(ref.current, {
        center: selectedPoint ?? defaultCenter,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false, // cegah klik POI mengganggu pick titik
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        ],
      });
      mapInstance.current = map;

      // Klik map → ambil lat/lng → kirim ke parent
      clickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onPointSelected({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    }

    return () => {
      // Cleanup listener + marker + circle saat unmount
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + circle saat selectedPoint / radius / warna berubah
  useEffect(() => {
    if (!mapInstance.current) return;

    if (!selectedPoint) {
      // Belum ada titik → bersihkan marker + circle
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    // ─── Marker titik kediaman ───────────────────────────────────────────────
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: selectedPoint,
        map: mapInstance.current,
        title: 'Titik kediaman ketua',
        zIndex: 1000,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: circleColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3,
          scale: 9,
        },
      });
    } else {
      markerRef.current.setPosition(selectedPoint);
      markerRef.current.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: circleColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3,
        scale: 9,
      });
    }

    // ─── Circle radius (by role, langsung muncul — Q-Picker-1=a) ─────────────
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map: mapInstance.current,
        center: selectedPoint,
        radius: radiusMeters,
        fillColor: circleColor,
        fillOpacity: 0.12,
        strokeColor: circleColor,
        strokeOpacity: 0.5,
        strokeWeight: 2,
        zIndex: 1,
      });
    } else {
      circleRef.current.setCenter(selectedPoint);
      circleRef.current.setRadius(radiusMeters);
      circleRef.current.setOptions({
        fillColor: circleColor,
        strokeColor: circleColor,
      });
    }

    // Pan + fit ke circle biar keliatan utuh
    const bounds = circleRef.current.getBounds();
    if (bounds) {
      mapInstance.current.fitBounds(bounds, 40);
    } else {
      mapInstance.current.panTo(selectedPoint);
    }
  }, [selectedPoint, radiusMeters, circleColor]);

  return <div ref={ref} className="h-full w-full" />;
};

const ZonePickerMap = ({ className, ...props }: ZonePickerMapProps) => {
  const renderStatus = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-200 animate-pulse">
            <MapIcon size={48} className="text-slate-400 mb-2" />
            <p className="text-slate-500 text-sm font-medium">Memuat peta...</p>
          </div>
        );
      case Status.FAILURE:
        return (
          <div className="flex flex-col items-center justify-center h-full bg-red-50 text-red-700">
            <AlertTriangle size={48} className="mb-2" />
            <p className="text-sm font-semibold">Gagal memuat peta.</p>
            <p className="text-xs">Coba refresh halaman.</p>
          </div>
        );
      default:
        return <GoogleMapInner {...props} />;
    }
  };

  return (
    <div className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className ?? ''}`}>
      <Wrapper apiKey={MAPS_API_KEY} render={renderStatus} />
    </div>
  );
};

export default ZonePickerMap;