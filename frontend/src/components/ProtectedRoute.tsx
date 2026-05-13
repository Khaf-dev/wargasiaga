import { useAuthStore } from '@/store/authStore';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader } from '@/components/ui/Loader';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, isLoading, isOnboarded, userProfile } = useAuthStore();
  const location = useLocation();

  // Tampilkan loader saat:
  // 1. Initial auth state check
  // 2. User sudah login tapi profil dari backend belum selesai di-fetch
  if (isLoading || (firebaseUser && !userProfile)) {
    return <FullPageLoader />;
  }

  // Jika tidak ada user sama sekali, tendang ke login
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika user sudah login tapi belum onboard, dan DIA TIDAK SEDANG di halaman onboarding
  if (!isOnboarded && location.pathname !== '/onboard') {
    return <Navigate to="/onboard" replace />;
  }
  
  // Jika user sudah onboard tapi mencoba akses halaman onboarding, tendang ke home
  if (isOnboarded && location.pathname === '/onboard') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};