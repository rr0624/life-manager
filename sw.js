// Service Worker — 离线缓存
const CACHE_NAME = 'life-manager-v11';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=10',
  './js/app.js?v=10',
  './js/db.js?v=10',
  './js/ai.js?v=10',
  './js/nav.js?v=10',
  './js/schedule.js?v=10',
  './js/goals.js?v=10',
  './js/records.js?v=10',
  './js/utils.js?v=10',
  './manifest.json'
];

// 安装：预缓存所有静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求拦截：缓存优先，网络回退
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).catch(() => caches.match('./index.html'))
    )
  );
});
