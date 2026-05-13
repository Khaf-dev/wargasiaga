// Import Firebase SDK compat version
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// PENTING: Paste firebaseConfig lu di sini secara hardcode
// Ini aman karena file ini public dan isinya cuma identifier project
const firebaseConfig = {
  apiKey: "AIzaSyBT2bLOwePoWJiNxWgqivm2BCAPGrzFGqA",
  authDomain: "jvckaffarozi.firebaseapp.com",
  projectId: "jvckaffarozi",
  storageBucket: "gs://jvckaffarozi.firebasestorage.app",
  messagingSenderId: "577486245816",
  appId: "1:577486245816:web:5651099245b4eda70e494d"
};

// Inisialisasi Firebase app di service worker
firebase.initializeApp(firebaseConfig);

// Dapatkan instance messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Menerima background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    // Gunakan icon dari payload atau default icon aplikasi
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});