/* Frase a Frase — funciona offline (exceto podcasts e vídeos, que precisam de internet) */
var CACHE = 'faf-v57';
var VOZ_CACHE = 'faf-voz'; // áudios da voz natural: guardados entre versões
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'data/frases.json', 'data/textos.json', 'data/curso.json', 'data/en/frases.json', 'data/en/textos.json', 'data/en/curso.json', 'conta.js?v=5'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== VOZ_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  // biblioteca do login (versão fixa no endereço, em conta.js): guardada para o app abrir sem internet
  var isLib = url.hostname === 'cdn.jsdelivr.net' && url.pathname.indexOf('/npm/@supabase/') === 0;
  if (/\.workers\.dev$/.test(url.hostname) && url.pathname === '/voz') {
    e.respondWith(caches.open(VOZ_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  if (!sameOrigin && !isFont && !isLib) return;
  if (req.mode === 'navigate' || (sameOrigin && url.pathname.indexOf('/data/') >= 0)) {
    // rede primeiro para pegar atualizações; cache se estiver offline
    // só a página do app vira "index.html" no cache (outras páginas, como a de privacidade, ficam com o próprio endereço)
    var isApp = req.mode === 'navigate' && sameOrigin && /\/(index\.html)?$/.test(url.pathname);
    var key = isApp ? 'index.html' : req;
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }); }
      return res;
    }).catch(function () { return caches.match(key); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok || res.type === 'opaque') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
