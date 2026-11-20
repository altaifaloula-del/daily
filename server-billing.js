/**
 * v51.4 — المرحلة 07 / S5: الاشتراك والدفع على خادم مِثقال.
 * • البوابة: «ميسر» (مرخّصة من البنك المركزي السعودي) — صفحة دفع مستضافة تقبل مدى وفيزا/ماستركارد وApple Pay وSTC Pay،
 *   فلا تمر بيانات البطاقة بخوادمنا أبدًا. والتحويل البنكي وسيلة ثانية يؤكدها مزوّد مِثقال.
 * • لا يُصدَّق إشعار الدفع الوارد: الخادم يعيد قراءة الفاتورة من «ميسر» بمفتاحه السري ويطابق الحالة والمبلغ والعملة ورقم فاتورتنا.
 * • السجل: مشروع تحكم مستقل لمِثقال (لا قاعدة الطيف ولا قاعدة أي عميل) عبر Firestore REST بحساب خدمة.
 * • معطّلة بالكامل حتى تكتمل إعداداتها (MQ_BILLING=1 + المفاتيح + الأسعار + بيانات البائع) — الطيف لا يُفوتَر.
 */
import crypto from 'node:crypto';
import { parsePrices, priceFor, buildInvoice, applyPayment, sellerError, nextPeriod, subscriptionState, PERIODS, PAYMENT_METHODS, okInvoiceNo } from './billing.js';

const BILL_ROLES = new Set(['system_admin', 'general_management', 'head_office']);
const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const today = (now) => new Date(now()).toISOString().slice(0, 10);

/* ================= الإعداد ================= */
export function billingConfig(env = process.env) {
  const P = parsePrices(env.MQ_PRICES_JSON || '');
  let seller = null; try { seller = env.MQ_SELLER_JSON ? JSON.parse(env.MQ_SELLER_JSON) : null; } catch { seller = null; }
  let sa = null; try { sa = env.MQ_CONTROL_SA ? JSON.parse(env.MQ_CONTROL_SA) : null; } catch { sa = null; }
  const why = [];
  if (env.MQ_BILLING !== '1') why.push('MQ_BILLING غير مفعّل');
  // v51.7 (S7): البوابة اختيارية — يكفي التحويل البنكي وحده للبدء (قرار المالك: تجربة مجانية ثم تحويل بنكي)
  const gateway = /^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(String(env.MOYASAR_SECRET_KEY || ''));
  if (env.MOYASAR_SECRET_KEY && !gateway) why.push('MOYASAR_SECRET_KEY غير صالح');
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(String(env.MQ_CONTROL_PROJECT || ''))) why.push('MQ_CONTROL_PROJECT');
  if (!sa || !sa.client_email || !sa.private_key) why.push('MQ_CONTROL_SA');
  const se = sellerError(seller); if (se) why.push('MQ_SELLER_JSON: ' + se);
  if (!Object.keys(P.prices).length) why.push('MQ_PRICES_JSON: لا أسعار');
  if (gateway && String(env.MQ_BILLING_HOOK_KEY || '').length < 32) why.push('MQ_BILLING_HOOK_KEY (32+ حرفًا)');
  if (gateway && !/^https:\/\//.test(String(env.MQ_PUBLIC_API || ''))) why.push('MQ_PUBLIC_API (عنوان الخادم https)');
  if (!/^https:\/\//.test(String(env.MQ_APP_URL || ''))) why.push('MQ_APP_URL (عنوان المنصة https)');
  const bank = env.MQ_BANK_IBAN ? { iban: s(env.MQ_BANK_IBAN, 34).replace(/\s+/g, ''), name: s(env.MQ_BANK_NAME, 80), holder: s(env.MQ_BANK_HOLDER, 120) } : null;
  if (bank && !/^SA[0-9]{22}$/.test(bank.iban)) why.push('MQ_BANK_IBAN غير صالح');
  if (!gateway && !(bank && /^SA[0-9]{22}$/.test(bank.iban))) why.push('لا وسيلة دفع: MOYASAR_SECRET_KEY أو MQ_BANK_IBAN');
  const controlReady = /^[a-z][a-z0-9-]{4,29}$/.test(String(env.MQ_CONTROL_PROJECT || '')) && !!(sa && sa.client_email && sa.private_key);
  return {
    enabled: why.length === 0, why, controlReady, gateway, priceErrors: P.errors, prices: P.prices, seller, bank: bank && /^SA[0-9]{22}$/.test(bank.iban) ? bank : null,
    secretKey: String(env.MOYASAR_SECRET_KEY || ''), controlProject: String(env.MQ_CONTROL_PROJECT || ''), sa,
    hookKey: String(env.MQ_BILLING_HOOK_KEY || ''), publicApi: String(env.MQ_PUBLIC_API || '').replace(/\/+$/, ''), appUrl: String(env.MQ_APP_URL || '').replace(/\/+$/, '')
  };
}
export const hookSig = (key, no) => crypto.createHmac('sha256', key).update('mq-billing|' + no).digest('hex').slice(0, 32);
const sigOk = (key, no, sig) => { const a = Buffer.from(hookSig(key, no)), b = Buffer.from(String(sig || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

/* ================= بوابة «ميسر» ================= */
export function moyasarGateway({ secretKey, fetchImpl = fetch, base = 'https://api.moyasar.com/v1' }) {
  const auth = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
  const call = async (method, path, body) => {
    const r = await fetchImpl(base + path, { method, headers: { authorization: auth, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error('moyasar ' + r.status + ': ' + s(j.message || j.type, 200)); e.status = 502; throw e; }
    return j;
  };
  return {
    provider: 'moyasar',
    createInvoice: (p) => call('POST', '/invoices', p),
    fetchInvoice: (id) => call('GET', '/invoices/' + encodeURIComponent(id))
  };
}
/** وسيلة الدفع من فاتورة «ميسر» المدفوعة */
export function gatewayMethod(g) {
  const p = (g.payments || []).find(x => x.status === 'paid') || {};
  const src = (p.source || {}), t = String(src.type || '').toLowerCase(), co = String(src.company || '').toLowerCase();
  if (t === 'applepay') return 'applepay';
  if (t === 'stcpay') return 'stcpay';
  if (co === 'mada') return 'mada';
  return t === 'creditcard' ? 'card' : 'gateway';
}

/* ================= سجل الفوترة (مشروع التحكم) ================= */
export function memoryStore() {
  const inv = new Map(), subs = new Map(), sgs = new Map(), seq = {};
  return {
    async nextSeq(name = 'seq') { return (seq[name] = (seq[name] || 0) + 1); },
    async nextSignupSeq() { return this.nextSeq('signup'); },
    async getSignup(id) { const v = sgs.get(id); return v ? { ...v } : null; },
    async putSignup(v) { sgs.set(v.id, { ...v }); return v; },
    async listSignups() { return [...sgs.values()].sort((a, b) => b.seq - a.seq).map(v => ({ ...v })); },
    async getInvoice(no) { const v = inv.get(no); return v ? structuredClone(v) : null; },
    async putInvoice(v) { inv.set(v.no, structuredClone(v)); return v; },
    async listInvoices(tenant) { return [...inv.values()].filter(v => v.tenant === tenant).sort((a, b) => b.seq - a.seq).map(v => structuredClone(v)); },
    async getSub(tenant) { return subs.has(tenant) ? { ...subs.get(tenant) } : null; },
    async putSub(tenant, v) { subs.set(tenant, { ...v }); return v; },
    async listSubs() { return [...subs.entries()].map(([tenant, v]) => ({ tenant, ...v })); }
  };
}

/** رمز وصول بحساب الخدمة (JWT RS256) — بلا مكتبات إضافية على الخادم */
export function saTokenSource(sa, { fetchImpl = fetch, now = Date.now, scope = 'https://www.googleapis.com/auth/datastore' } = {}) {
  let cache = null;
  return async () => {
    if (cache && cache.exp > now() + 60000) return cache.token;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const iat = Math.floor(now() / 1000);
    const head = b64({ alg: 'RS256', typ: 'JWT' }), claim = b64({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
    const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.private_key).toString('base64url');
    const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('تعذّر الحصول على رمز حساب الخدمة');
    cache = { token: j.access_token, exp: now() + (Number(j.expires_in) || 3600) * 1000 };
    return cache.token;
  };
}

/** السجل في Firestore (REST): billing_invoices/<no> · billing_subs/<tenant> · billing_meta/seq — كل مستند حقل JSON واحد */
export function firestoreStore({ project, token, fetchImpl = fetch }) {
  const root = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents';
  const req = async (method, url, body) => {
    const r = await fetchImpl(url, { method, headers: { authorization: 'Bearer ' + (await token()), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (r.status === 404 && method === 'GET') return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error('control store ' + r.status + ': ' + s(j.error && j.error.message, 200)); e.code = r.status; throw e; }
    return j;
  };
  const enc = (v, extra) => ({ fields: { json: { stringValue: JSON.stringify(v) }, ...(extra || {}) } });
  const dec = (d) => (d && d.fields && d.fields.json ? JSON.parse(d.fields.json.stringValue) : null);
  return {
    async nextSignupSeq() { return this.nextSeq('signup'); },
    async getSignup(id) { return dec(await req('GET', root + '/signups/' + encodeURIComponent(id))); },
    async putSignup(v) { await req('PATCH', root + '/signups/' + encodeURIComponent(v.id), enc(v, { status: { stringValue: v.status } })); return v; },
    async listSignups() {
      const r = await req('GET', root + '/signups?pageSize=300');
      return ((r && r.documents) || []).map(dec).filter(Boolean).sort((a, b) => b.seq - a.seq);
    },
    async nextSeq(name = 'seq') {
      for (let i = 0; i < 6; i++) {
        const d = await req('GET', root + '/billing_meta/' + name);
        const n = (dec(d) || { n: 0 }).n + 1;
        const pre = d ? 'currentDocument.updateTime=' + encodeURIComponent(d.updateTime) : 'currentDocument.exists=false';
        try { await req('PATCH', root + '/billing_meta/' + name + '?' + pre, enc({ n })); return n; } catch (e) { if (e.code !== 400 && e.code !== 409 && e.code !== 412) throw e; }
      }
      throw new Error('تعذّر حجز رقم فاتورة — أعد المحاولة');
    },
    async getInvoice(no) { return dec(await req('GET', root + '/billing_invoices/' + encodeURIComponent(no))); },
    async putInvoice(v) { await req('PATCH', root + '/billing_invoices/' + encodeURIComponent(v.no), enc(v, { tenant: { stringValue: v.tenant }, status: { stringValue: v.status } })); return v; },
    async listInvoices(tenant) {
      const r = await req('POST', root + ':runQuery', { structuredQuery: { from: [{ collectionId: 'billing_invoices' }], where: { fieldFilter: { field: { fieldPath: 'tenant' }, op: 'EQUAL', value: { stringValue: tenant } } }, limit: 60 } });
      return (r || []).map(x => dec(x.document)).filter(Boolean).sort((a, b) => b.seq - a.seq);
    },
    async getSub(tenant) { return dec(await req('GET', root + '/billing_subs/' + encodeURIComponent(tenant))); },
    async putSub(tenant, v) { await req('PATCH', root + '/billing_subs/' + encodeURIComponent(tenant), enc(v)); return v; },
    async listSubs() {
      const r = await req('GET', root + '/billing_subs?pageSize=300');
      return ((r && r.documents) || []).map(d => ({ tenant: decodeURIComponent(d.name.split('/').pop()), ...dec(d) }));
    }
  };
}

/* ================= التسوية: الحقيقة من البوابة لا من الإشعار ================= */
export async function settleInvoice({ store, gateway, no, now = Date.now }) {
  const inv = await store.getInvoice(no);
  if (!inv) return { ok: false, why: 'not-found' };
  if (inv.status === 'paid') return { ok: true, inv, already: true };
  for (const id of inv.gw || []) {
    const g = await gateway.fetchInvoice(id);
    const meta = g.metadata || {};
    if (g.status !== 'paid') continue;
    if (g.amount !== inv.total || String(g.currency || '').toUpperCase() !== 'SAR' || meta.mq_inv !== inv.no || meta.tenant !== inv.tenant) {
      console.error('[billing] فاتورة بوابة لا تطابق', inv.no, id); continue;
    }
    const r = applyPayment(inv, { ref: 'moyasar:' + id, method: gatewayMethod(g), amount: g.amount, at: new Date(now()).toISOString() });
    if (!r.changed) return { ok: !r.error, inv, why: r.error };
    await store.putInvoice(r.inv);
    await extendSub(store, r.inv);
    return { ok: true, inv: r.inv, paidNow: true };
  }
  return { ok: false, inv, why: 'unpaid' };
}
export async function extendSub(store, inv) {
  const cur = (await store.getSub(inv.tenant)) || {};
  const paidThrough = !cur.paidThrough || inv.end > cur.paidThrough ? inv.end : cur.paidThrough;
  return store.putSub(inv.tenant, { ...cur, plan: inv.plan, period: inv.period, paidThrough, lastInvoice: inv.no, ...(inv.buyer && inv.buyer.name ? { buyer: inv.buyer } : {}) });
}

/* ================= المسارات ================= */
export function mountBilling(app, { express, requireMember, tenantOf, rateLimit, cfg, store, gateway, now = Date.now, adminCheck, onPaid = () => {} }) {
  const json = express.json({ limit: '16kb' });
  const isAdmin = async (req) => BILL_ROLES.has(req.user && req.user.role) || (adminCheck ? await adminCheck(req) : false);
  const gate = async (req, res) => {
    const t = tenantOf(req);
    if (!cfg.enabled || !t || t.id === 'default') { res.json({ enabled: false }); return null; }
    if (!(await isAdmin(req))) { res.status(403).json({ error: 'الاشتراك والدفع لمسؤول المنشأة فقط' }); return null; }
    return t;
  };
  const view = (inv) => ({ no: inv.no, issuedAt: inv.issuedAt, plan: inv.plan, period: inv.period, start: inv.start, end: inv.end, net: inv.net, vat: inv.vat, total: inv.total, status: inv.status, method: inv.method || '', paidAt: inv.paidAt || '' });
  const lim = rateLimit({ windowMs: 3600000, max: 30, keyFn: (r) => 'bill:' + (tenantOf(r) || {}).id + ':' + ((r.user && r.user.email) || r.ip) });

  app.get('/api/billing/summary', requireMember, async (req, res) => {
    try {
      const t = await gate(req, res); if (!t) return;
      const sub = (await store.getSub(t.id)) || {};
      const st = subscriptionState(sub.paidThrough || '', today(now));
      const prices = Object.fromEntries(PERIODS.map(p => [p, priceFor(cfg.prices, t.plan, p)]).filter(x => x[1]));
      res.json({ enabled: true, plan: t.plan, prices, sub: { paidThrough: sub.paidThrough || '', period: sub.period || '', ...st },
        invoices: (await store.listInvoices(t.id)).slice(0, 24).map(view), methods: PAYMENT_METHODS.filter(m => (m.via === 'gateway' && cfg.gateway) || (m.via === 'manual' && cfg.bank)).map(m => m.id),
        bank: cfg.bank, seller: { name: cfg.seller.name, vatNo: cfg.seller.vatNo } });
    } catch (e) { console.error('[billing] summary', e.message); res.status(502).json({ error: 'تعذّر تحميل بيانات الاشتراك' }); }
  });

  app.post('/api/billing/checkout', json, requireMember, lim, async (req, res) => {
    try {
      const t = await gate(req, res); if (!t) return;
      const period = PERIODS.includes(req.body && req.body.period) ? req.body.period : '';
      const method = req.body && req.body.method === 'bank' ? 'bank' : 'gateway';
      if (!period) return res.status(400).json({ error: 'اختر دورة الاشتراك' });
      if (!priceFor(cfg.prices, t.plan, period)) return res.status(409).json({ error: 'لا سعر معتمد لهذه الخطة والدورة بعد' });
      if (method === 'bank' && !cfg.bank) return res.status(409).json({ error: 'التحويل البنكي غير متاح حاليًا' });
      if (method === 'gateway' && !cfg.gateway) return res.status(409).json({ error: 'الدفع الإلكتروني غير متاح حاليًا — استخدم التحويل البنكي' });
      const b = (req.body && req.body.buyer) || {};
      const buyer = { name: s(b.name, 120), vatNo: /^3[0-9]{13}3$/.test(String(b.vatNo || '')) ? String(b.vatNo) : '', address: s(b.address, 200) };
      // فاتورة مفتوحة لنفس الدورة تُعاد (لا فواتير مكررة)؛ وإلا تُصدر الفاتورة التالية
      let inv = (await store.listInvoices(t.id)).find(v => (v.status === 'open' || v.status === 'pending_transfer') && v.period === period && v.plan === t.plan);
      if (!inv) {
        const sub = (await store.getSub(t.id)) || {};
        const np = nextPeriod(sub.paidThrough || '', today(now), period);
        inv = buildInvoice({ seq: await store.nextSeq(), issuedAt: new Date(now()).toISOString(), tenant: t.id, buyer, plan: t.plan, period, start: np.start, prices: cfg.prices, seller: cfg.seller });
      }
      if (method === 'bank') {
        inv = { ...inv, status: 'pending_transfer' }; await store.putInvoice(inv);
        console.log('[billing] bank', t.id, inv.no);
        return res.json({ no: inv.no, total: inv.total, bank: cfg.bank, reference: inv.no });
      }
      const q = 'inv=' + encodeURIComponent(inv.no) + '&sig=' + hookSig(cfg.hookKey, inv.no);
      const back = cfg.appUrl + '/?t=' + encodeURIComponent(t.id) + '&billing=' + encodeURIComponent(inv.no);
      const g = await gateway.createInvoice({ amount: inv.total, currency: 'SAR', description: 'اشتراك مِثقال — ' + inv.plan + ' — ' + inv.period + ' — ' + inv.no,
        callback_url: cfg.publicApi + '/api/billing/webhook?' + q, success_url: back, back_url: back, metadata: { mq_inv: inv.no, tenant: t.id } });
      if (!g || !g.id || !/^https:\/\//.test(String(g.url || ''))) throw new Error('رد غير متوقع من البوابة');
      inv = { ...inv, status: inv.status === 'pending_transfer' ? 'open' : inv.status, gw: [...(inv.gw || []), g.id].slice(-10) };
      await store.putInvoice(inv);
      console.log('[billing] checkout', t.id, inv.no, g.id);
      res.json({ no: inv.no, total: inv.total, url: g.url });
    } catch (e) { console.error('[billing] checkout', e.message); res.status(e.status || 502).json({ error: 'تعذّر بدء الدفع — أعد المحاولة بعد قليل' }); }
  });

  // بعد العودة من صفحة الدفع: يتحقق الخادم من البوابة مباشرة (احتياط لو تأخر الإشعار)
  app.post('/api/billing/refresh', json, requireMember, lim, async (req, res) => {
    try {
      const t = await gate(req, res); if (!t) return;
      const no = String((req.body && req.body.no) || '');
      if (!okInvoiceNo(no)) return res.status(400).json({ error: 'رقم فاتورة غير صالح' });
      const inv = await store.getInvoice(no);
      if (!inv || inv.tenant !== t.id) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      const r = await settleInvoice({ store, gateway, no, now });
      if (r.paidNow) Promise.resolve(onPaid(inv.tenant)).catch(() => { });
      res.json({ status: (r.inv || inv).status });
    } catch (e) { console.error('[billing] refresh', e.message); res.status(502).json({ error: 'تعذّر التحقق من الدفع' }); }
  });

  // إشعار البوابة: الرابط موقّع برقم فاتورتنا، والجسم لا يُصدَّق — الحالة تُقرأ من البوابة بمفتاحنا السري
  app.post('/api/billing/webhook', express.json({ limit: '64kb' }), rateLimit({ windowMs: 60000, max: 120 }), async (req, res) => {
    const no = String(req.query.inv || '');
    if (!cfg.enabled || !cfg.gateway || !okInvoiceNo(no) || !sigOk(cfg.hookKey, no, req.query.sig)) return res.status(404).json({ ok: false });
    try { const r = await settleInvoice({ store, gateway, no, now }); if (r.paidNow) Promise.resolve(onPaid(r.inv.tenant)).catch(() => { }); res.json({ ok: true, status: r.inv ? r.inv.status : 'unknown' }); }
    catch (e) { console.error('[billing] webhook', no, e.message); res.status(502).json({ ok: false }); }   // البوابة تعيد المحاولة
  });

  // الفاتورة الضريبية لمنشأتها فقط — تُطبع في الواجهة
  app.get('/api/billing/invoice/:no', requireMember, async (req, res) => {
    try {
      const t = await gate(req, res); if (!t) return;
      const no = String(req.params.no || '');
      const inv = okInvoiceNo(no) ? await store.getInvoice(no) : null;
      if (!inv || inv.tenant !== t.id) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      const { gw, ...pub } = inv; res.json(pub);
    } catch (e) { res.status(502).json({ error: 'تعذّر تحميل الفاتورة' }); }
  });
}
