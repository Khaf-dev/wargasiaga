import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    // Token akan di-handle oleh listener di authStore
    console.log("Login berhasil:", user.displayName);
    return user;
  } catch (error) {
    console.error("Error saat login dengan Google:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    console.log("Logout berhasil");
  } catch (error) {
    console.error("Error saat logout:", error);
    throw error;
  }
};