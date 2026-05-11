import { create } from 'zustand';
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  idToken: string | null;
  isLoading: boolean;
}

interface AuthActions {
  setUserAndToken: (user: FirebaseUser | null, token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  firebaseUser: null,
  idToken: null,
  isLoading: true,
  
  setUserAndToken: (user, token) => set({ firebaseUser: user, idToken: token, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    set({ firebaseUser: null, idToken: null, isLoading: false });
  },
}));

/**
 * Inisialisasi listener untuk status otentikasi Firebase.
 * Harus dipanggil sekali di root component aplikasi.
 * @returns Fungsi `unsubscribe` untuk membersihkan listener.
 */
export const initAuthListener = () => {
  // onIdTokenChanged lebih superior karena handle login, logout, DAN token refresh.
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      useAuthStore.getState().setUserAndToken(user, token);
    } else {
      useAuthStore.getState().logout();
    }
  });
  return unsubscribe;
};