import { useAuthStore } from '@/store/authStore';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageLoader } from '@/components/ui/Loader';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};