const CACHE = 'skazanie-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/dice.js', './js/rules.js', './js/heroes.js', './js/bestiary.js', './js/adventure.js',
  './js/state.js', './js/combat.js', './js/save.js', './js/audio.js', './js/ui.js', './js/main.js',
  './manifest.json',
  './assets/fonts/Forum-Regular.woff2',
  './assets/fonts/Lora-Regular.woff2',
  './assets/fonts/Lora-Italic.woff2',
  './assets/fonts/Lora-Bold.woff2'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (x) { return x !== CACHE; }).map(function (x) { return caches.delete(x); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (c) {
    return c || fetch(e.request).then(function (r) {
      var cp = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
      return r;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
