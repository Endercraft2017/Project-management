import { Router } from 'express';

/**
 * Keep the old PWA URL available: HTML/404 responses cannot replace an installed
 * cache-first worker. Browser worker-update requests bypass its fetch handler.
 * Preserve all browser storage and avoid navigating tabs with unsaved work.
 * The next ordinary navigation loads the current app after retirement.
 */
export const legacyServiceWorker = `/* E-Z legacy PWA retirement v1 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
`;

// Old HTML may still request this script. Update only the known legacy root
// registration; never create a worker for a fresh browser or touch other scopes.
export const legacyRegistrationScript = `if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration('/').then((registration) => {
    if (!registration) return;
    const worker = registration.active || registration.waiting || registration.installing;
    if (worker && new URL(worker.scriptURL).pathname === '/sw.js'
        && registration.scope === new URL('/', location.origin).href) {
      return registration.update();
    }
  }).catch(() => { /* A later online visit can retry retirement. */ });
}
`;

export const legacyServiceWorkerRoutes = Router();
legacyServiceWorkerRoutes.get(['/sw.js', '/registerSW.js'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Service-Worker-Allowed', '/');
  res.type('application/javascript').send(
    req.path === '/sw.js' ? legacyServiceWorker : legacyRegistrationScript,
  );
});
