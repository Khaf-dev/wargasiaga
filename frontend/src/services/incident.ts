import api from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Location } from '@/types/user';

interface PanicPayload {
  location: Location;
  audioBlob: Blob;
  userId: string;
}

export const triggerPanic = async ({ location, audioBlob, userId }: PanicPayload) => {
  // 1. Upload audio ke Firebase Storage
  const timestamp = Date.now();
  const storageRef = ref(storage, `incidents/${userId}/${timestamp}.webm`);
  const uploadResult = await uploadBytes(storageRef, audioBlob);
  const downloadURL = await getDownloadURL(uploadResult.ref);

  // 2. Kirim data ke backend API
  const backendPayload = {
    location,
    audio_url: downloadURL,
    audio_duration_sec: 10,
  };
  
  const { data } = await api.post('/incidents/panic', backendPayload);
  return data;
};