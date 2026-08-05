// Service Worker — استراتيجية "الشبكة أولاً" لضمان وصول التحديثات فوراً
const CACHE = 'rms-shell-v3';

self.addEventListener('install', (e) => {
  // نفعّل النسخة الجديدة فوراً دون انتظار
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) // امسح كل الكاش القديم
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // الشبكة أولاً: نجلب أحدث نسخة دائماً، ونستخدم الكاش فقط عند انقطاع الشبكة
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
