// v45.9 — عامل خدمة للإشعارات فقط (ملخصات الإغلاق والمنصة مغلقة): لا كاش ولا اعتراض لأي طلب.
// نطاقه ./push/ فلا يتحكم في صفحات المنصة أبدًا — التحديثات تبقى فورية كما هي.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { notification: { body: e.data ? e.data.text() : '' } }; }
  var n = d.notification || {}, x = d.data || {};
  var title = n.title || x.title || 'RESTAURANT PRO';
  var app = self.registration.scope.replace(/push\/$/, '');
  e.waitUntil(self.registration.showNotification(title, {
    body: n.body || x.body || '', icon: app + 'icon-192.png', badge: app + 'icon-192.png',
    dir: 'rtl', lang: 'ar', tag: x.tag || undefined, renotify: !!x.tag, data: { url: app }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope.replace(/push\/$/, '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if (cs[i].url.indexOf(url) === 0 && 'focus' in cs[i]) return cs[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
