// frontend/src/hooks/useFCM.ts
// Signature DIPERTAHANKAN: (isLoggedIn: boolean) — sesuai App.tsx existing
// getMessagingInstance() digunakan sesuai firebase.ts existing
// updateFCMToken() dari @/services/user existing
import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '@/lib/firebase';
import { updateFCMToken } from '@/services/user';
import { toast } from 'sonner';
import { useNotificationStore } from '@/store/notificationStore';
import type { ActivePanicAlert } from '@/store/notificationStore';

export const useFCM = (isLoggedIn: boolean) => {
  const tokenSentRef = useRef(false);
  const { addNotification, setActivePanic } = useNotificationStore();

  // ── Setup permission + ambil token + sync ke backend ─────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubscribeForeground: (() => void) | undefined;

    const setupFCM = async () => {
      try {
        // Gunakan getMessagingInstance() async — sesuai firebase.ts existing
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // 1. Minta izin notifikasi
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[FCM] Izin ditolak user. Notif tidak akan dikirim.');
          return;
        }

        // 2. Dapatkan FCM token
        // Catatan: getToken butuh SW yang sudah terdaftar (dilakukan di main.tsx)
        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        // 3. Sync token ke backend — hanya sekali per session
        if (currentToken) {
          if (!tokenSentRef.current) {
            console.log('[FCM] Syncing token ke backend...');
            await updateFCMToken(currentToken);
            tokenSentRef.current = true;
            console.log('[FCM] Token berhasil disimpan');
          }
        } else {
          console.warn('[FCM] Token kosong — mungkin VAPID key salah atau SW belum ready');
        }

        // 4. Handle pesan saat app di foreground
        // Background ditangani oleh firebase-messaging-sw.js
        unsubscribeForeground = onMessage(messaging, (payload) => {
          console.log('[FCM] Foreground message:', payload);

          const data = payload.data || {};
          const isStranger = data.is_stranger === 'true';
          const title = payload.notification?.title || '🚨 Laporan Darurat!';
          const body = payload.notification?.body || 'Bantuan dibutuhkan.';

          // Tambah ke notification list (untuk badge + history)
          addNotification({
            id: data.incident_id || `notif-${Date.now()}`,
            title,
            body,
            type: (data.type as 'panic_alert' | 'false_alarm' | 'resolved' | 'info') || 'info',
            incidentId: data.incident_id,
            reporterName: data.reporter_name,
            distanceMeters: parseInt(data.distance_meters || '0', 10),
            isStranger,
            aiSummary: data.ai_summary || undefined,
            timestamp: new Date(),
          });

          // Panic alert → trigger IncomingPanicSheet via notificationStore
          if (data.type === 'panic_alert' && data.incident_id) {
            setActivePanic({
              incidentId: data.incident_id,
              reporterName: data.reporter_name || 'Seseorang',
              reporterRole: (data.reporter_role as ActivePanicAlert['reporterRole']) || 'WARGA',
              distanceMeters: parseInt(data.distance_meters || '0', 10),
              isStranger,
              aiSummary: data.ai_summary || undefined,
              timestamp: new Date(),
            });
            return; // IncomingPanicSheet sudah handle visual, skip toast
          }

          // Non-panic → tampilkan toast sonner (sesuai pattern existing)
          toast(title, {
            description: body,
            icon: isStranger ? '⚠️' : data.type === 'false_alarm' ? '✅' : '🚨',
            duration: 10000,
            style: {
              background: isStranger
                ? '#FEF08A'
                : data.type === 'false_alarm'
                ? '#D1FAE5'
                : '#FEE2E2',
              color: '#0F172A',
              border: `1px solid ${
                isStranger ? '#EAB308' : data.type === 'false_alarm' ? '#10B981' : '#EF4444'
              }`,
            },
            action: data.incident_id
              ? {
                  label: 'Lihat',
                  onClick: () => {
                    window.location.href = `/incidents/${data.incident_id}`;
                  },
                }
              : undefined,
          });
        });
      } catch (error) {
        console.error('[FCM] Setup error:', error);
      }
    };

    setupFCM();

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [isLoggedIn]);

  // ── Handle klik notifikasi background (pesan dari SW ke React) ────────────────
  useEffect(() => {
    if (!isLoggedIn || !('serviceWorker' in navigator)) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'FCM_NOTIFICATION_CLICK') return;

      const { incidentId } = event.data;
      if (!incidentId) return;

      // Buka IncomingPanicSheet — data lengkap di-fetch oleh component sendiri
      setActivePanic({
        incidentId,
        reporterName: 'Memuat...',
        reporterRole: 'WARGA',
        distanceMeters: 0,
        isStranger: false,
        timestamp: new Date(),
      });
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, [isLoggedIn]);
};