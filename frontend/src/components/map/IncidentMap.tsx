import { useEffect, useRef } from 'react';
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Map, AlertTriangle } from 'lucide-react';

// Pastikan VITE_GOOGLE_MAPS_API_KEY ada saat build, fail fast jika tidak.
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
if (!MAPS_API_KEY) {
  throw new Error("VITE_GOOGLE_MAPS_API_KEY tidak ditemukan di environment variables.");
}

interface IncidentMapProps {
  korbanLocation: { lat: number; lng: number };
  ownLocation: { lat: number; lng: number } | null;
  responders: Array<{
    id: string;
    name: string;
    location: { lat: number; lng: number };
  }>;
  className?: string;
  // PHASE 8.2: true jika viewer adalah korban sendiri (ubah title marker merah)
  isViewerKorban?: boolean;
}

// Komponen inner yang hanya dirender setelah Google Maps API siap
const GoogleMapInner = ({ korbanLocation, ownLocation, responders, isViewerKorban }: IncidentMapProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pulseCircleRef = useRef<google.maps.Circle | null>(null);

  // Inisialisasi peta saat komponen pertama kali mount
  useEffect(() => {
    if (ref.current && !mapInstance.current) {
      const map = new google.maps.Map(ref.current, {
        center: korbanLocation,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        // Style untuk mengurangi noise visual di peta
        styles: [
          { featureType: "poi.business", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
      });
      mapInstance.current = map;

      // Inisialisasi pulsing circle untuk korban
      pulseCircleRef.current = new google.maps.Circle({
        map,
        center: korbanLocation,
        radius: 50,
        fillColor: '#DC2626',
        fillOpacity: 0.15,
        strokeColor: '#DC2626',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        zIndex: 1,
      });
    }

    // Cleanup saat unmount
    return () => {
      // Hapus semua marker dari peta
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      // Hapus circle
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setMap(null);
      }
    };
  }, []); // Hanya dijalankan sekali

  // Efek untuk animasi pulsing circle
  useEffect(() => {
    let radius = 50;
    let direction = 1;
    const interval = setInterval(() => {
      if (pulseCircleRef.current) {
        if (radius > 80) direction = -1;
        if (radius < 50) direction = 1;
        radius += direction * 5;
        pulseCircleRef.current.setRadius(radius);
      }
    }, 100);

    // Wajib cleanup interval untuk mencegah memory leak
    return () => clearInterval(interval);
  }, []);

  // Efek untuk mengelola marker dan auto-zoom
  useEffect(() => {
    if (!mapInstance.current) return;

    // 1. Cleanup marker lama
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // 2. Buat marker korban
    const korbanMarker = new google.maps.Marker({
      position: korbanLocation,
      map: mapInstance.current,
      // PHASE 8.2: kalau viewer adalah korban sendiri, perjelas "Lokasi Anda (Korban)"
      title: isViewerKorban ? "📍 Lokasi Anda (Korban)" : "📍 Lokasi Korban",
      zIndex: 1000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#DC2626',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3,
        scale: 12,
      },
    });
    markersRef.current.push(korbanMarker);
    bounds.extend(korbanLocation);

    // 3. Buat marker lokasi sendiri (jika ada)
    if (ownLocation) {
      const ownMarker = new google.maps.Marker({
        position: ownLocation,
        map: mapInstance.current,
        title: "🙋 Lokasi Anda",
        zIndex: 500,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#1E3A8A',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3,
          scale: 10,
        },
      });
      markersRef.current.push(ownMarker);
      bounds.extend(ownLocation);
    }

    // 4. Buat marker untuk semua responder
    responders.forEach(responder => {
      const responderMarker = new google.maps.Marker({
        position: responder.location,
        map: mapInstance.current,
        title: `🏃 ${responder.name}`,
        zIndex: 100,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
          scale: 8,
        },
      });
      markersRef.current.push(responderMarker);
      bounds.extend(responder.location);
    });

    // 5. Auto-fit bounds
    // Jika hanya ada satu titik (korban), jangan zoom terlalu dekat.
    if (markersRef.current.length > 1) {
      mapInstance.current.fitBounds(bounds, 60); // Padding 60px
    } else {
      mapInstance.current.setCenter(korbanLocation);
      mapInstance.current.setZoom(16);
    }

  }, [korbanLocation, ownLocation, responders, isViewerKorban]);

  return <div ref={ref} id="map-container" className="h-full w-full" />;
};

// Komponen Wrapper utama
const IncidentMap = ({ className, ...props }: IncidentMapProps) => {
  const renderMapStatus = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-200 animate-pulse">
            <Map size={48} className="text-slate-400 mb-2" />
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
    <div className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      <Wrapper apiKey={MAPS_API_KEY} render={renderMapStatus} />
    </div>
  );
};

export default IncidentMap;