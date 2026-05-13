import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '@/lib/firebase';
import { updateFCMToken } from '@/services/user';
import { toast } from 'sonner';

export const useFCM = (isLoggedIn: boolean) => {
  const tokenSentRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubscribe: (() => void) | undefined;

    const setupFCM = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // 1. Minta Izin
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn("FCM: Izin ditolak user. Notif tidak akan dikirim.");
          return; // JANGAN panggil updateFCMToken(null) di sini
        }

        // 2. Dapatkan Token
        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        // 3. Sync Token (Hanya jika token ada)
        if (currentToken) {
          if (!tokenSentRef.current) {
            console.log("FCM: Syncing token...");
            await updateFCMToken(currentToken);
            tokenSentRef.current = true;
          }
        } else {
          console.warn("FCM: Token kosong.");
        }

        // 4. Handle Notif Foreground
        unsubscribe = onMessage(messaging, (payload) => {
          const isStranger = payload.data?.is_stranger === 'true';
          const title = payload.notification?.title || "Laporan Darurat!";
          const body = payload.notification?.body || "Bantuan dibutuhkan.";

          toast(title, {
            description: body,
            icon: isStranger ? '⚠️' : '🚨',
            duration: 10000,
            style: {
              background: isStranger ? '#FEF08A' : '#FEE2E2',
              color: '#0F172A',
              border: `1px solid ${isStranger ? '#EAB308' : '#EF4444'}`
            },
            action: {
              label: 'Lihat',
              onClick: () => console.log(`Navigasi ke incident: ${payload.data?.incident_id}`)
            }
          });
        });

      } catch (error) {
        console.error("FCM Setup Error:", error);
      }
    };

    setupFCM();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isLoggedIn]);
};