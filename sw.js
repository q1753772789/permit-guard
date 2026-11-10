/* 作业票助手 · Service Worker
 * 只缓存本机静态资源，保证断网也能查规则；AI 请求永不缓存。
 */
const CACHE = 'permit-guard-v38';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/store.js',
  './assets/js/data.js',
  './assets/js/ai.js',
  './assets/js/settings.js',
  './assets/js/update.js',
  './assets/js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 跨域（模型 API / CDN）一律走网络

  // 网络优先：保证每次打开都是最新版本；断网时回落到缓存
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
