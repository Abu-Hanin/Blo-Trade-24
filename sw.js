// Blo Trade 24 — Service Worker: إشعارات الجهاز (Web Push) + فتح الصفحة الصح عند الضغط
// الإشعار بيوصل حتى لو التطبيق مقفول، وكل إشعار بيظهر في كارت لوحده
const CACHE_NAME = 'blotrade-v41';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// كاش للصفحة نفسها بس (عشان التطبيق يفتح لو النت قطع) — الأسعار والبيانات بتروح للنت مباشرة
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./')))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Blo Trade 24', {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'badge-72.png?v=2',
    tag: 'blo-' + (data.id || '') + '-' + Date.now(), // tag مختلف = كل إشعار في كارت لوحده
    data: { link: data.link || '' },
    dir: 'rtl', lang: 'ar',
    vibrate: [120, 60, 120],
    renotify: true,
    timestamp: Date.now()
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '';
  const external = /^https:\/\//.test(link) && !link.startsWith(self.registration.scope);
  event.waitUntil((async () => {
    if (external) return clients.openWindow(link);
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.postMessage({ type: 'open', link }); return c.focus(); }
    }
    return clients.openWindow(self.registration.scope + (link ? '?open=' + encodeURIComponent(link) : ''));
  })());
});
