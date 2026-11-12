// Caja Doña Mencía — permite instalar la app y usarla sin conexión.
// Primero intenta la red (para recibir siempre la última versión) y, si no hay, usa lo guardado.

const CACHE = 'caja-dona-mencia-v7';
const ARCHIVOS = [
  './',
  'index.html',
  'css/estilos.css',
  'js/app.js',
  'js/ui.js',
  'js/datos/almacen.js',
  'js/vistas/mas.js',
  'js/vistas/dia.js',
  'js/vistas/cierre.js',
  'js/vistas/cuadre.js',
  'js/vistas/congelado.js',
  'js/nucleo/dia.js',
  'js/nucleo/cierre.js',
  'js/nucleo/congelado.js',
  'js/nucleo/fechas.js',
  'js/nucleo/productos.js',
  'js/nucleo/copia.js',
  'js/nucleo/numeros.js',
  'js/nucleo/cuadre.js',
  'manifest.webmanifest',
  'assets/logo-adolfo.png',
  'assets/icono-192.png',
  'assets/icono-512.png',
  'assets/iconos/frescura.svg',
  'assets/iconos/preparacion.svg',
  'assets/iconos/calidad.svg',
  'assets/iconos/frio.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const propia = url.origin === self.location.origin;
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!propia && !fuentes) return;

  e.respondWith(
    fetch(e.request, propia ? { cache: 'no-cache' } : undefined)
      .then((r) => {
        if (r.ok || r.type === 'opaque') {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))),
  );
});
