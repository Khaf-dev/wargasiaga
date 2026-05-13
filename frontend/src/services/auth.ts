import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    // FIX: Secara eksplisit set persistensi ke local storage browser.
    // Ini memastikan sesi login tetap ada setelah popup redirect.
    await setPersistence(auth, browserLocalPersistence);
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Logging tambahan untuk memastikan user object ada setelah popup
    console.log("✅ signInWithGoogle success:", {
      displayName: user.displayName,
      uid: user.uid,
    });

    return user;
  } catch (error) {
    console.error("Error saat login dengan Google:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    console.log("User signed out");
  } catch (error) {
    console.error("Error saat logout:", error);
    throw error;
  }
};