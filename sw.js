/* Todo Flow — minimal service worker (no fetch caching).
   Ensures navigator.serviceWorker.ready resolves after register().
   Prevents blank/hung pages when the app uses SW-based notifications. */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
