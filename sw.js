// Permite que la aplicación funcione sin conexión a internet.
// Si cambias algún archivo, sube el número de versión para que se actualice.
const VERSION = 'presupuestos-v6';
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './corrector.js',
  './word.js',
  './lib/jszip.min.js',
  './manifest.webmanifest',
  './lib/jspdf.umd.min.js',
  './lib/jspdf.plugin.autotable.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero intenta internet (para recibir mejoras); si no hay, usa la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
