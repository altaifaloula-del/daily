const CACHE = 'rms-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // لا نتدخل في نداءات Firestore/الشبكة الحية
  if (e.request.method !== 'GET' || !url.origin.includes(self.location.origin)) return;
  // الأصول: من الكاش أولاً ثم الشبكة
  if (/\.(js|css|svg|png|jpg|woff2?)$/.test(url.pathname) || SHELL.some((s) => url.pathname.endsWith(s.replace('./', '')))) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
