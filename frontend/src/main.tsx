// frontend/src/main.tsx
// Upgrade SW registration: tambah updateViaCache + update detection
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

// Register Firebase Messaging SW dengan handling yang lebih robust
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js', {
      scope: '/',
      // Selalu cek update SW saat app load — penting agar SW baru aktif segera
      updateViaCache: 'none',
    })
    .then((registration) => {
      console.log('[SW] Firebase Messaging SW terdaftar, scope:', registration.scope);

      // Deteksi update SW — berguna saat deploy baru
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] Update SW tersedia, aktif saat app reload berikutnya');
          }
        });
      });
    })
    .catch((error) => {
      console.error('[SW] Gagal mendaftarkan Service Worker:', error);
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);