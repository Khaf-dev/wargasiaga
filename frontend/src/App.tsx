// frontend/src/App.tsx
import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { initAuthListener, useAuthStore } from '@/store/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useFCM } from '@/hooks/useFCM';

// Import Pages
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import OnboardingPage from '@/pages/OnboardingPage';
import IncidentMapPage from '@/pages/IncidentMapPage';
import DataDiriPage from '@/pages/DataDiriPage';

// Import persistent components
import { IncomingPanicSheet } from '@/components/panic/IncomingPanicSheet';

function App() {
  const { firebaseUser } = useAuthStore();
  
  // Signature dipertahankan: useFCM(boolean)
  useFCM(!!firebaseUser);
  
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, []);

  return (
    <>
      <Toaster position="top-center" richColors />

      {/* IncomingPanicSheet di luar Routes — persistent di semua halaman */}
      <IncomingPanicSheet />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route 
          path="/onboard" 
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />

        {/* Route Baru untuk Phase 4.3a */}
        <Route
          path="/incidents/:incidentId"
          element={
            <ProtectedRoute>
              <IncidentMapPage />
            </ProtectedRoute>
          }
        />
        {/* Phase 8.4: Pendataan data diri WARGA */}
        <Route
          path="/data-diri"
          element={
            <ProtectedRoute>
              <DataDiriPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;