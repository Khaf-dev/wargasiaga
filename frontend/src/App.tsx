// frontend/src/App.tsx
// Perubahan: tambah import IncomingPanicSheet + render di bawah Toaster
// useFCM(!!firebaseUser) TIDAK DIUBAH — signature tetap sama
import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { initAuthListener, useAuthStore } from '@/store/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import OnboardingPage from '@/pages/OnboardingPage';
import { useFCM } from '@/hooks/useFCM';
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;