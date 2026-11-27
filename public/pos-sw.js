// v56.54 — عامل خدمة نقطة البيع لفتح التطبيق دون إنترنت (docs/pos/POS_OFFLINE_SW.md).
// يُسجَّل فقط على جهاز نقطة بيع موسوم محليًا (mizan:posSwOn) حين يفعّل مسؤول النظام posCfg.offline + posCfg.offShell.
// • الصفحة (index.html): الشبكة أولًا، والنسخة المخزّنة عند انقطاع الشبكة فقط (لا عند البطء والجهاز متصل) — فلا يعلق جهاز متصل على نسخة قديمة.
// • الأصول المجزّأة الأسماء (/assets/*-<hash>.js|css…): الكاش أولًا (اسمها يتغيّر مع كل إصدار فلا تتقادم).
// • لا يُخزَّن ولا يُعترض أي طلب بيانات: Firestore وGoogle و/api وأي أصل خارجي وأي طلب غير GET — كلها تمر للشبكة كما هي.
// • الكاش باسم يحمل الإصدار (?v=) ويُحذف القديم عند التفعيل، وبحد أعلى MAX_ENTRIES. سكربت الشفاء في index.html يمسحه ويلغيه إن زالت العلامة.
// • v56.56: الجهاز دون شبكة ظاهرًا ⇒ الصفحة المخزّنة فورًا؛ والتسخين يشمل أصول هيكل نقطة البيع من البناء (pos-shell.json).
var VER = (function () { try { return new URL(self.location.href).searchParams.get('v') || 'dev'; } catch (_) { return 'dev'; } })();
var PREFIX = 'muktasab-pos-shell-';
var CACHE = PREFIX + VER;
var SOFT_MS = 3000, HARD_MS = 12000;
var MAX_ENTRIES = 80;   // v56.56 (f): حد أعلى لعناصر الكاش (إصدار واحد فقط يبقى — القديم يُحذف عند التفعيل)
var ASSET_RE = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|png|svg|jpg|jpeg|webp)$/;

/** اختيار الاستراتيجية لطلب (دالة نقية — مختبرة في tests/pos-offline-b.test.mjs): 'shell' | 'asset' | 'pass' */
function posSwRoute(req, origin, scopePath) {
  var u; try { u = new URL(req.url); } catch (_) { return 'pass'; }
  if ((req.method || 'GET') !== 'GET') return 'pass';
  if (u.origin !== origin) return 'pass';                       // Firestore وGoogle والخطوط وأي خارجي
  var p = u.pathname;
  if (/\/api\//.test(p) || /\/__\//.test(p)) return 'pass';     // واجهات الخادم وخدمات الاستضافة
  if (req.mode === 'navigate') {
    if (scopePath && p.indexOf(scopePath) !== 0) return 'pass';
    return (/\/$/.test(p) || /\.html$/.test(p)) ? 'shell' : 'pass';
  }
  if (ASSET_RE.test(p)) return 'asset';
  return 'pass';                                                // tenants/*.json والأيقونات وفحص النسخة (?_c=) … للشبكة
}
/** مفتاح الصفحة في الكاش: المسار بلا استعلام (?u= و?t= لا يغيّران index.html) */
function shellKey(url) { var u = new URL(url); return u.origin + u.pathname; }
self.posSwRoute = posSwRoute; self.posShellKey = shellKey;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// التسخين: الصفحة الحالية وأصولها المحمّلة فعلًا (من posSwSync) — لا يُخزَّن إلا ما يمر بـ posSwRoute
self.addEventListener('message', function (e) {
  var d = e.data || {}; if (d.type !== 'warm' || !Array.isArray(d.urls)) return;
  var scope = new URL(self.registration.scope);
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(d.urls.slice(0, MAX_ENTRIES).map(function (url) {
      var abs; try { abs = new URL(url, scope).href; } catch (_) { return null; }
      var r = posSwRoute({ url: abs, method: 'GET', mode: /\/assets\//.test(abs) ? 'cors' : 'navigate' }, scope.origin, scope.pathname);
      if (r === 'pass') return null;
      var key = r === 'shell' ? shellKey(abs) : abs;
      return c.match(key).then(function (hit) {
        if (hit && r === 'asset') return null;
        return fetch(abs, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) { if (res && res.ok && res.type === 'basic') return putBounded(c, key, res); }).catch(function () { });
      });
    }));
  }));
});
// v56.56 (قرار المجلس G): كل عناصر الكاش — الصفحات والأصول والتسخين — ضمن MAX_ENTRIES؛ تحديث عنصر موجود مسموح دائمًا
function putBounded(c, key, res) {
  var url = typeof key === 'string' ? key : key.url;
  return Promise.resolve(c.keys ? c.keys() : []).then(function (ks) { ks = ks || [];
    var has = ks.some(function (k) { return (typeof k === 'string' ? k : k.url) === url; });
    if (has || ks.length < MAX_ENTRIES) return c.put(key, res); });
}
function shell(req) {
  var key = shellKey(req.url);
  var net = fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(CACHE).then(function (c) { return putBounded(c, key, cp); }).catch(function () { }); }
    return res;
  });
  var cached = function () { return caches.open(CACHE).then(function (c) { return c.match(key); }); };
  return new Promise(function (ok, no) {
    var done = false, t1 = 0, t2 = 0;
    var stop = function () { done = true; if (t1) clearTimeout(t1); if (t2) clearTimeout(t2); };
    var finish = function (r) { if (!done) { stop(); ok(r); } };
    var fallback = function (err) { cached().then(function (hit) { if (hit) finish(hit); else if (err && !done) { stop(); no(err); } }); };
    net.then(finish, function (err) { fallback(err || new Error('offline')); });
    // v56.56 (a): الجهاز دون شبكة ظاهرًا عند الطلب ⇒ المخزّن فورًا (بلا انتظار مهلة)؛ بلا نسخة مخزّنة يبقى انتظار الشبكة
    if (self.navigator && self.navigator.onLine === false) fallback(null);
    // انقطاع ظاهر (الجهاز دون شبكة) بعد مهلة قصيرة ⇒ المخزّن؛ متصل وبطيء ⇒ ننتظر الشبكة حتى المهلة القصوى
    t1 = setTimeout(function () { if (!done && self.navigator && self.navigator.onLine === false) fallback(null); }, SOFT_MS);
    t2 = setTimeout(function () { if (!done) fallback(null); }, HARD_MS);
  });
}
function asset(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') putBounded(c, req, res.clone()).catch(function () { });
        return res; });
    });
  });
}
self.addEventListener('fetch', function (e) {
  var scope = new URL(self.registration.scope);
  var r = posSwRoute(e.request, scope.origin, scope.pathname);
  if (r === 'shell') e.respondWith(shell(e.request));
  else if (r === 'asset') e.respondWith(asset(e.request));
  // 'pass': لا respondWith — الطلب يذهب للشبكة مباشرة كما بلا عامل خدمة
});
