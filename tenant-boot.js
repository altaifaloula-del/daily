/**
 * v51.1 — المرحلة 07 / S2: تحديد المستأجر قبل تحميل التطبيق.
 * المصدر الوحيد للإعداد: سجل المستأجرين الثابت المنشور مع الموقع (tenants/<id>.json) — لا يُقبل إعداد من الرابط نفسه أبدًا،
 * فلا يستطيع رابط خبيث توجيه المستخدم إلى قاعدة بيانات أخرى.
 * ترتيب التحديد: النطاق الفرعي (<id>.<VITE_TENANT_DOMAIN>) ← ?t=<id> في الرابط ← آخر منشأة محفوظة على الجهاز ← الافتراضي (الطيف).
 * إن طُلبت منشأة غير موجودة في السجل لا نعود بصمت إلى الافتراضي: تظهر رسالة واضحة.
 */
import { DEFAULT_TENANT_ID, tenantConfigError } from './tenant.js';

export const TENANT_LS = 'mq:tenant';
const okId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{1,39}$/.test(v) && v !== DEFAULT_TENANT_ID;

/** يستخرج معرّف المستأجر المطلوب ومصدره — دالة نقية قابلة للاختبار */
export function tenantRequest({ hostname = '', search = '', domain = '', saved = '' } = {}) {
  const h = String(hostname).toLowerCase(), d = String(domain).toLowerCase().replace(/^\.+/, '');
  if (d && h.endsWith('.' + d)) { const sub = h.slice(0, -(d.length + 1)); if (okId(sub) && !['www', 'app'].includes(sub)) return { id: sub, from: 'subdomain' }; }
  let q = ''; try { q = new URLSearchParams(search).get('t') || ''; } catch { }
  q = q.trim().toLowerCase();
  if (q === DEFAULT_TENANT_ID) return { id: '', from: 'reset' };
  if (q) return okId(q) ? { id: q, from: 'query' } : { id: '', from: 'invalid', bad: q };
  if (okId(saved)) return { id: saved, from: 'saved' };
  return { id: '', from: 'default' };
}

/** يجلب إعداد المستأجر من السجل ويتحقق منه — يعيد { cfg } أو { error } */
export async function fetchTenant(id, fetchImpl, base = './') {
  try {
    const r = await fetchImpl(base + 'tenants/' + id + '.json', { cache: 'no-store' });
    if (!r.ok) return { error: 'not-found' };
    const cfg = await r.json();
    if (!cfg || cfg.id !== id) return { error: 'mismatch' };
    const e = tenantConfigError(cfg); if (e) return { error: 'invalid', detail: e };
    if (cfg.status && cfg.status !== 'active' && cfg.status !== 'readonly') return { error: 'suspended' };
    return { cfg };
  } catch { return { error: 'network' }; }
}

/** عزل التخزين المحلي للمنشأة على الجهاز: مفاتيح المنصة (rms8: / mizan: / mz-) تُسبق بـ mq@<id>: لغير الطيف،
 *  فلا تختلط على جهاز واحد نسخ البيانات المحلية ولا طابور مبيعات نقطة البيع بلا اتصال بين منشأتين. الطيف بلا أي تغيير. */
export const NS_RX = /^(rms8:|mizan:|mz-)/;
export function nsStorage(win, id) {
  const P = win && win.Storage && win.Storage.prototype; if (!P || !id || id === DEFAULT_TENANT_ID || P.__mqNs) return false;
  const pre = 'mq@' + id + ':', ls = win.localStorage, wrap = (fn) => function (k, ...r) { return fn.call(this, this === ls && NS_RX.test(String(k)) ? pre + k : k, ...r); };
  P.getItem = wrap(P.getItem); P.setItem = wrap(P.setItem); P.removeItem = wrap(P.removeItem);
  Object.defineProperty(P, '__mqNs', { value: id });
  return true;
}

/** يُستدعى من main.jsx قبل استيراد التطبيق */
export async function bootTenant(win = window) {
  let saved = ''; try { saved = win.localStorage.getItem(TENANT_LS) || ''; } catch { }
  const env = (() => { try { return import.meta.env || {}; } catch { return {}; } })();
  const req = tenantRequest({ hostname: win.location.hostname, search: win.location.search, domain: env.VITE_TENANT_DOMAIN || '', saved });
  if (req.from === 'reset') { try { win.localStorage.removeItem(TENANT_LS); } catch { } return { ok: true, id: DEFAULT_TENANT_ID }; }
  if (req.from === 'invalid') return { ok: false, error: 'invalid', id: req.bad };
  if (!req.id) return { ok: true, id: DEFAULT_TENANT_ID };
  const res = await fetchTenant(req.id, win.fetch.bind(win));
  if (res.error) {
    // منشأة محفوظة على الجهاز اختفت من السجل: ننسى الحفظ حتى لا يعلق الجهاز
    if (req.from === 'saved') { try { win.localStorage.removeItem(TENANT_LS); } catch { } }
    return { ok: false, error: res.error, id: req.id };
  }
  win.__MQ_TENANT__ = res.cfg;
  nsStorage(win, req.id);
  if (req.from !== 'subdomain') { try { win.localStorage.setItem(TENANT_LS, req.id); } catch { } }
  return { ok: true, id: req.id, cfg: res.cfg };
}

const MSG = {
  'not-found': ['المنشأة غير موجودة', 'Organization not found'],
  suspended: ['اشتراك المنشأة موقوف — تواصل مع مِثقال', 'This organization is suspended — contact Mithqal'],
  invalid: ['رابط المنشأة غير صالح', 'Invalid organization link'],
  mismatch: ['إعداد المنشأة غير صالح', 'Invalid organization configuration'],
  network: ['تعذّر الاتصال — تحقق من الشبكة ثم أعد المحاولة', 'Could not connect — check the network and retry']
};
export function tenantErrorHtml(err, id) {
  const [ar, en] = MSG[err] || MSG.network;
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return '<div style="min-height:100vh;display:grid;place-items:center;background:#F3F5F8;font-family:\'IBM Plex Sans Arabic\',\'Noto Sans Arabic\',Tahoma,sans-serif;color:#10294A;text-align:center;padding:24px">'
    + '<div><svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 82 L18 24 L50 55 L82 24 L82 82" stroke="#10294A" stroke-width="11"/><path d="M50 55 L50 82" stroke="#D9A83E" stroke-width="11"/><path d="M31 24 L50 42 L69 24" stroke="#D9A83E" stroke-width="7"/></g></svg>'
    + '<h1 style="font-size:20px;margin:14px 0 6px">' + e(ar) + '</h1><div style="font-size:13px;opacity:.7" dir="ltr">' + e(en) + (id ? ' · ' + e(id) : '') + '</div>'
    + '<div style="margin-top:18px;display:flex;gap:10px;justify-content:center"><a href="?" onclick="location.reload();return false" style="background:#10294A;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">إعادة المحاولة</a>'
    + '<a href="?t=default" style="border:1px solid #CBD3DF;color:#10294A;padding:10px 18px;border-radius:10px;text-decoration:none">المنشأة الافتراضية</a></div></div></div>';
}
