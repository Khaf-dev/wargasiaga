// frontend/src/main.tsx
// OPSI C: SW registration di-handle oleh vite-plugin-pwa (sw.js).
// firebase-messaging-sw.js di-import ke dalam sw.js via workbox.importScripts.
// TIDAK ADA manual register FCM SW di sini (hindari double-register conflict).
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);