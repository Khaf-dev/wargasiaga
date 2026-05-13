import { create } from 'zustand';
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getMe } from '@/services/user';
import type { UserResponse } from '@/types/user';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  idToken: string | null;
  isLoading: boolean;
  userProfile: UserResponse | null;
  isOnboarded: boolean;
}

interface AuthActions {
  setUserAndToken: (user: FirebaseUser | null, token: string | null) => void;
  setLoading: (loading: boolean) => void;
  fetchUserProfile: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  firebaseUser: null,
  idToken: null,
  isLoading: true,
  userProfile: null,
  isOnboarded: false,

  setUserAndToken: (user, token) => set({ firebaseUser: user, idToken: token }),

  setLoading: (loading) => set({ isLoading: loading }),

  fetchUserProfile: async () => {
    if (!get().idToken) {
      console.log("AuthStore: Skipping fetchUserProfile, no token.");
      set({ isLoading: false });
      return;
    }
    console.log("AuthStore: Fetching user profile...");
    try {
      const profile = await getMe();
      console.log("AuthStore: Profile fetched successfully", profile);
      set({
        userProfile: profile,
        isOnboarded: profile.is_verified === true,
        isLoading: false,
      });
    } catch (error) {
      console.error("AuthStore: Gagal mengambil profil user:", error);
      set({ isLoading: false });
    }
  },

  logout: () => {
    console.log("AuthStore: Logout action triggered, clearing state.");
    auth.signOut();
    set({
      firebaseUser: null,
      idToken: null,
      isLoading: false,
      userProfile: null,
      isOnboarded: false,
    });
  },
}));

export const initAuthListener = () => {
  console.log("AuthStore: Initializing auth listener...");
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    if (user) {
      console.log(`AuthStore: onIdTokenChanged fired. User FOUND. UID: ${user.uid}`);
      const token = await user.getIdToken();
      useAuthStore.getState().setUserAndToken(user, token);
      await useAuthStore.getState().fetchUserProfile();
    } else {
      console.log("AuthStore: onIdTokenChanged fired. User is NULL.");
      // Jika user null, pastikan state loading selesai.
      useAuthStore.getState().setUserAndToken(null, null);
      setLoading(false);
    }
  });
  return unsubscribe;
};

// Helper untuk state loading di luar listener
const { setLoading } = useAuthStore.getState();

// DEV ONLY: expose ke window untuk debugging
if (import.meta.env.DEV) {
  (window as any).__authStore = useAuthStore;
}

