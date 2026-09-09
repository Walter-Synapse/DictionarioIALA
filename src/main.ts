// Puncto de entrata principal pro Vite e TypeScript
import './app';
import { registerSW } from 'virtual:pwa-register';

// Registro e auto-actualisation de Service Worker PWA con reload automatico
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info('[PWA] Nova version detegite, actualisante...');
  },
  onOfflineReady() {
    console.info('[PWA] Application preste pro uso 100% offline.');
  }
});


