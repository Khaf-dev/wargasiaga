// frontend/public/firebase-messaging-sw.js
// Config diambil dari existing file lu — JANGAN ganti value-nya
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Hardcode config di SW itu normal dan aman — ini cuma project identifier publik
// Security dihandle Firebase Rules + Auth token, bukan config ini
firebase.initializeApp({
  apiKey: "AIzaSyBT2bLOwePeWoJiNxWgqivm2BCAPGrzFGqA",
  authDomain: "jvckaffarozi.firebaseapp.com",
  projectId: "jvckaffarozi",
  storageBucket: "gs://jvckaffarozi.firebasestorage.app",
  messagingSenderId: "577486245816",
  appId: "1:577486245816:web:565109924574eda70e494d"
});

const messaging = firebase.messaging();

// ─── Helper format jarak ───────────────────────────────────────────────────────
function formatDistance(meters) {
  if (!meters || meters === 0) return 'Lokasi tidak diketahui';
  return meters < 1000
    ? `~${Math.round(meters)}m dari lokasimu`
    : `~${(meters / 1000).toFixed(1)} km dari lokasimu`;
}

// ─── Background message handler ───────────────────────────────────────────────
// Dipanggil HANYA saat app tidak di foreground (background / closed / minimized)
// Saat foreground: onMessage() di useFCM.ts yang handle via toast
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message diterima:', payload);

  const data = payload.data || {};
  const incidentId = data.incident_id;
  const notifType = data.type; // 'panic_alert' | 'false_alarm' | 'resolved'
  const isStranger = data.is_stranger === 'true';
  const distanceMeters = parseInt(data.distance_meters || '0', 10);
  const reporterName = data.reporter_name || 'Seseorang';

  let title = '🚨 Waspada! Ada Insiden Terdekat';
  let body = `${reporterName} butuh bantuan — ${formatDistance(distanceMeters)}`;

  if (isStranger) {
    title = '⚠️ Insiden dari Pelapor Tidak Dikenal';
    body = `Seseorang (belum terverifikasi) butuh bantuan — ${formatDistance(distanceMeters)}`;
  }
  if (notifType === 'false_alarm') {
    title = '✅ Laporan Sebelumnya Dibatalkan';
    body = payload.notification?.body || 'Insiden dinyatakan tidak valid oleh warga';
  }
  if (notifType === 'resolved') {
    title = '✅ Situasi Telah Aman';
    body = payload.notification?.body || 'Insiden telah berhasil diselesaikan';
  }

  // Backend bisa override title/body via notification payload
  if (payload.notification?.title) title = payload.notification.title;
  if (payload.notification?.body) body = payload.notification.body;

  const isPanic = notifType === 'panic_alert';

  return self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg', // sesuaikan dengan ikon yang ada di public/
    badge: '/favicon.svg',
    // Tag deduplikasi: satu notif per incident, tidak spam
    tag: `wargasiaga-${incidentId || Date.now()}`,
    // renotify: panic rebuzz meski tag sama (replace notif lama)
    renotify: isPanic,
    data: {
      incidentId,
      type: notifType,
      url: incidentId ? `/incidents/${incidentId}` : '/',
    },
    actions: isPanic
      ? [
          { action: 'navigate', title: '🗺️ Lihat Lokasi' },
          { action: 'dismiss', title: 'Abaikan' },
        ]
      : [{ action: 'navigate', title: '📋 Lihat Detail' }],
    // Pola vibrasi SOS untuk panic (300-100-300-100-600ms)
    vibrate: isPanic ? [300, 100, 300, 100, 600] : [150],
    // Panic tetap visible sampai user interaksi
    requireInteraction: isPanic,
    timestamp: Date.now(),
  });
});

// ─── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { incidentId, url } = event.notification.data || {};
  const action = event.action;

  // Tap "Abaikan" → close saja
  if (action === 'dismiss') return;

  const targetUrl = url || (incidentId ? `/incidents/${incidentId}` : '/');

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Cari tab WargaSiaga yang sudah buka — focus + kirim pesan ke React
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            // Kirim ke React app untuk trigger IncomingPanicSheet
            client.postMessage({
              type: 'FCM_NOTIFICATION_CLICK',
              incidentId,
              url: targetUrl,
            });
            return;
          }
        }
        // Tidak ada tab buka → buka tab baru
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});