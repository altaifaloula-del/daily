/* v51.4 — المرحلة 07 / S5: الاشتراك والدفع — الحساب، والتسوية من البوابة لا من الإشعار، والعزل بين المنشآت */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parsePrices, amounts, periodEnd, subscriptionState, applyPayment, buildInvoice, nextPeriod, sellerError, invoiceNo, PAYMENT_METHODS } from '../billing.js';
import { billingConfig, mountBilling, memoryStore, hookSig, settleInvoice, saTokenSource, firestoreStore, gatewayMethod } from '../server-billing.js';

const SELLER = { name: 'مِثقال لتقنية المعلومات', vatNo: '311111111100003' };
const PR = JSON.stringify({ pro: { monthly: 199, yearly: 1990 }, basic: { monthly: 99 } });
const ENV = { MQ_BILLING: '1', MOYASAR_SECRET_KEY: 'sk_test_abcdefghijklmnop', MQ_CONTROL_PROJECT: 'mithqal-control', MQ_CONTROL_SA: JSON.stringify({ client_email: 'b@x.iam.gserviceaccount.com', private_key: 'k' }),
  MQ_SELLER_JSON: JSON.stringify(SELLER), MQ_PRICES_JSON: PR, MQ_BILLING_HOOK_KEY: 'h'.repeat(40), MQ_PUBLIC_API: 'https://api.mithqal.sa', MQ_APP_URL: 'https://app.mithqal.sa', MQ_BANK_IBAN: 'SA0380000000608010167519', MQ_BANK_NAME: 'الراجحي', MQ_BANK_HOLDER: 'مِثقال' };

test('الأسعار من الإعداد بالهللة، والضريبة 15%، ولا كسور', () => {
  const P = parsePrices(PR); assert.deepEqual(P.prices, { pro: { monthly: 19900, yearly: 199000 }, basic: { monthly: 9900 } }); assert.equal(P.errors.length, 0);
  assert.ok(parsePrices('{"gold":{"monthly":1},"pro":{"weekly":2,"monthly":-5}}').errors.length === 3);
  assert.ok(parsePrices('{"pro":{"monthly":199.999}}').errors.length === 1, 'أكثر من هللتين مرفوض');
  assert.deepEqual(amounts(19900), { net: 19900, vat: 2985, total: 22885 });
  assert.deepEqual(amounts(9999), { net: 9999, vat: 1500, total: 11499 });
  assert.throws(() => amounts(0)); assert.equal(invoiceNo(7, '2026'), 'MQ-2026-000007');
  assert.equal(sellerError(SELLER), ''); assert.ok(sellerError({ name: 'x', vatNo: '123' }));
  assert.deepEqual(PAYMENT_METHODS.map(m => m.id), ['mada', 'card', 'applepay', 'stcpay', 'bank']);
});

test('الدورات والحالة: شهري/سنوي، ونهاية الشهر، والمهلة ثم التوصية بالقراءة فقط ثم الإيقاف', () => {
  assert.equal(periodEnd('2026-11-19', 'monthly'), '2026-12-18'); assert.equal(periodEnd('2026-11-19', 'yearly'), '2027-11-18');
  assert.equal(periodEnd('2026-01-31', 'monthly'), '2026-02-27'); assert.equal(periodEnd('2026-12-01', 'monthly'), '2026-12-31');
  assert.deepEqual(nextPeriod('2026-12-18', '2026-12-10', 'monthly'), { start: '2026-12-19', end: '2027-01-18' }, 'التجديد المبكر يبدأ بعد نهاية المدفوع');
  assert.equal(nextPeriod('2026-10-01', '2026-12-10', 'monthly').start, '2026-12-10', 'المنتهي يبدأ من اليوم');
  const S = (p) => subscriptionState(p, '2026-11-19');
  assert.equal(S('').state, 'unpaid'); assert.equal(S('2026-12-30').state, 'active'); assert.equal(S('2026-11-22').state, 'due');
  assert.deepEqual([S('2026-11-15').state, S('2026-11-15').recommend], ['grace', 'active']);
  assert.deepEqual([S('2026-11-01').state, S('2026-11-01').recommend], ['overdue', 'readonly']);
  assert.deepEqual([S('2026-09-01').state, S('2026-09-01').recommend], ['lapsed', 'suspended']);
});

test('الدفعة: تُسجَّل مرة واحدة، والمبلغ المختلف يُرفض، والفاتورة تحفظ بيانات البائع والمشتري وقت الإصدار', () => {
  const inv = buildInvoice({ seq: 1, issuedAt: '2026-11-19T10:00:00Z', tenant: 'c2', buyer: { name: 'مطعم س', vatNo: '300000000000003' }, plan: 'pro', period: 'monthly', start: '2026-11-19', prices: parsePrices(PR).prices, seller: SELLER });
  assert.equal(inv.no, 'MQ-2026-000001'); assert.equal(inv.total, 22885); assert.equal(inv.end, '2026-12-18'); assert.equal(inv.seller.vatNo, SELLER.vatNo); assert.equal(inv.buyer.vatNo, '300000000000003');
  assert.throws(() => buildInvoice({ seq: 2, issuedAt: '2026-11-19T10:00:00Z', tenant: 'c2', plan: 'basic', period: 'yearly', start: '2026-11-19', prices: parsePrices(PR).prices, seller: SELLER }), /لا سعر/);
  assert.match(applyPayment(inv, { ref: 'r1', method: 'mada', amount: 100, at: 'x' }).error, /المبلغ/);
  const a = applyPayment(inv, { ref: 'r1', method: 'mada', amount: 22885, at: 'x' }); assert.equal(a.inv.status, 'paid');
  assert.equal(applyPayment(a.inv, { ref: 'r1', method: 'mada', amount: 22885, at: 'y' }).changed, false, 'نفس المرجع لا يتكرر');
  assert.match(applyPayment(a.inv, { ref: 'r2', method: 'card', amount: 22885, at: 'y' }).error, /سابقًا/, 'لا دفع مزدوج');
});

test('الإعداد: معطّلة حتى يكتمل كل شيء، وتذكر الناقص دون كشف أسرار', () => {
  const off = billingConfig({}); assert.equal(off.enabled, false); assert.ok(off.why.length >= 8);
  assert.ok(!JSON.stringify(billingConfig({ ...ENV, MQ_BILLING: '0' }).why).includes('sk_test'));
  const on = billingConfig(ENV); assert.equal(on.enabled, true, on.why.join()); assert.equal(on.bank.iban, 'SA0380000000608010167519');
  assert.equal(billingConfig({ ...ENV, MQ_BANK_IBAN: 'SA12' }).enabled, false);
  assert.equal(billingConfig({ ...ENV, MQ_BANK_IBAN: '' }).bank, null, 'بلا آيبان: البوابة وحدها');
});

/* ---- خادم مصغّر لاختبار المسارات دون شبكة ---- */
function harness({ env = ENV, users = {}, gwState = {} } = {}) {
  const routes = {}; const app = { get: (p, ...h) => (routes['GET ' + p] = h), post: (p, ...h) => (routes['POST ' + p] = h) };
  const express = { json: () => (req, res, next) => next() };
  const T = { default: { id: 'default', plan: 'enterprise' }, c2: { id: 'c2', plan: 'pro', projectId: 'mithqal-c2' }, c3: { id: 'c3', plan: 'pro', projectId: 'mithqal-c3' } };
  const requireMember = (req, res, next) => { const u = users[req.token]; if (!u) return res.status(401).json({}); req.user = u; next(); };
  const tenantOf = (req) => T[(req.user && req.user.tenant) || 'default'];
  const rateLimit = () => (req, res, next) => next();
  const created = [];
  const gateway = { provider: 'moyasar',
    async createInvoice(p) { const id = 'gw' + (created.length + 1); created.push({ id, ...p }); gwState[id] = { id, status: 'initiated', amount: p.amount, currency: p.currency, metadata: p.metadata }; return { id, url: 'https://checkout.moyasar.com/invoices/' + id }; },
    async fetchInvoice(id) { return structuredClone(gwState[id]); } };
  const store = memoryStore(); const cfg = billingConfig(env);
  mountBilling(app, { express, requireMember, tenantOf, rateLimit, cfg, store, gateway, now: () => Date.parse('2026-11-19T09:00:00Z') });
  const call = async (key, { token, body, query, params } = {}) => {
    const req = { token, body: body || {}, query: query || {}, params: params || {}, headers: {}, ip: '1.1.1.1' }; let out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes[key]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out;
  };
  return { call, store, created, gwState, cfg };
}
const U = { a2: { email: 'a@c2.sa', role: 'system_admin', tenant: 'c2' }, cash2: { email: 'k@c2.sa', role: 'cashier', tenant: 'c2' }, a3: { email: 'a@c3.sa', role: 'system_admin', tenant: 'c3' }, taif: { email: 'o@altaif.sa', role: 'system_admin', tenant: 'default' } };

test('الدفع عبر البوابة: فاتورة واحدة للدورة، والإشعار لا يُصدَّق — الحالة والمبلغ من «ميسر» نفسها', async () => {
  const H = harness({ users: U });
  assert.deepEqual((await H.call('GET /api/billing/summary', { token: 'taif' })).json, { enabled: false }, 'الطيف لا يُفوتَر');
  assert.equal((await H.call('GET /api/billing/summary', { token: 'cash2' })).status, 403, 'الكاشير لا يرى الاشتراك');
  const s0 = (await H.call('GET /api/billing/summary', { token: 'a2' })).json;
  assert.equal(s0.enabled, true); assert.deepEqual(s0.prices, { monthly: 19900, yearly: 199000 }); assert.deepEqual(s0.methods, ['mada', 'card', 'applepay', 'stcpay', 'bank']);
  const c1 = (await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly', buyer: { name: 'مطعم س', vatNo: 'bad' } } })).json;
  assert.match(c1.url, /^https:\/\/checkout\.moyasar\.com\//); assert.equal(c1.total, 22885);
  const g1 = H.created[0]; assert.equal(g1.amount, 22885); assert.deepEqual(g1.metadata, { mq_inv: c1.no, tenant: 'c2' });
  assert.match(g1.callback_url, new RegExp('^https://api\\.mithqal\\.sa/api/billing/webhook\\?inv=' + c1.no + '&sig=' + hookSig(ENV.MQ_BILLING_HOOK_KEY, c1.no) + '$'));
  assert.equal((await H.store.getInvoice(c1.no)).buyer.vatNo, '', 'رقم ضريبي غير صالح لا يُطبع');
  const c2 = (await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly' } })).json; assert.equal(c2.no, c1.no, 'لا فاتورة مكررة لنفس الدورة');

  const hook = (sig) => H.call('POST /api/billing/webhook', { query: { inv: c1.no, sig }, body: { type: 'payment_paid', data: { status: 'paid', amount: 22885 } } });
  assert.equal((await hook('forged')).status, 404, 'رابط إشعار غير موقّع');
  const sig = hookSig(ENV.MQ_BILLING_HOOK_KEY, c1.no);
  assert.equal((await hook(sig)).json.status, 'open', 'جسم إشعار مزوّر يقول «مدفوع» لا يكفي');
  H.gwState.gw1 = { ...H.gwState.gw1, status: 'paid', amount: 100 }; assert.equal((await hook(sig)).json.status, 'open', 'مبلغ مختلف عن الفاتورة');
  H.gwState.gw1 = { ...H.gwState.gw1, amount: 22885, metadata: { mq_inv: c1.no, tenant: 'c3' } }; assert.equal((await hook(sig)).json.status, 'open', 'فاتورة بوابة لمنشأة أخرى');
  H.gwState.gw1 = { ...H.gwState.gw1, metadata: { mq_inv: c1.no, tenant: 'c2' }, payments: [{ status: 'paid', source: { type: 'creditcard', company: 'mada' } }] };
  assert.equal((await hook(sig)).json.status, 'paid');
  const inv = await H.store.getInvoice(c1.no); assert.equal(inv.method, 'mada'); assert.equal(inv.payments.length, 2 - 1);
  assert.equal((await hook(sig)).json.status, 'paid'); assert.equal((await H.store.getInvoice(c1.no)).payments.length, 1, 'الإشعار المكرر لا يكرر الدفعة');
  assert.equal((await H.store.getSub('c2')).paidThrough, '2026-12-18');
  const s1 = (await H.call('GET /api/billing/summary', { token: 'a2' })).json; assert.equal(s1.sub.state, 'active'); assert.equal(s1.invoices[0].status, 'paid'); assert.ok(!('gw' in s1.invoices[0]));
  // التجديد التالي يبدأ بعد نهاية المدفوع
  const c3 = (await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly' } })).json; assert.notEqual(c3.no, c1.no);
  assert.equal((await H.store.getInvoice(c3.no)).start, '2026-12-19');
});

test('العزل: منشأة لا ترى فاتورة أخرى ولا تتحقق منها، وتفاصيل البوابة لا تُكشف', async () => {
  const H = harness({ users: U });
  const c = (await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'yearly' } })).json;
  assert.equal((await H.call('GET /api/billing/invoice/:no', { token: 'a3', params: { no: c.no } })).status, 404);
  assert.equal((await H.call('POST /api/billing/refresh', { token: 'a3', body: { no: c.no } })).status, 404);
  const own = (await H.call('GET /api/billing/invoice/:no', { token: 'a2', params: { no: c.no } })).json; assert.equal(own.no, c.no); assert.ok(!('gw' in own));
  assert.equal((await H.call('GET /api/billing/invoice/:no', { token: 'a2', params: { no: '../x' } })).status, 404);
  assert.equal((await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'weekly' } })).status, 400);
});

test('التحويل البنكي: الفاتورة «بانتظار التأكيد» بمرجعها والآيبان، ولا تُعد مدفوعة حتى يؤكدها المزوّد', async () => {
  const H = harness({ users: U });
  const r = (await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly', method: 'bank' } })).json;
  assert.equal(r.reference, r.no); assert.equal(r.bank.iban, 'SA0380000000608010167519'); assert.equal(H.created.length, 0, 'لا بوابة');
  assert.equal((await H.store.getInvoice(r.no)).status, 'pending_transfer'); assert.equal(await H.store.getSub('c2'), null);
  const H2 = harness({ users: U, env: { ...ENV, MQ_BANK_IBAN: '' } });
  assert.equal((await H2.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly', method: 'bank' } })).status, 409);
  assert.deepEqual((await H2.call('GET /api/billing/summary', { token: 'a2' })).json.methods, ['mada', 'card', 'applepay', 'stcpay']);
});

test('الخادم بلا إعداد كامل: كل المسارات «غير مفعّلة» والإشعار مرفوض', async () => {
  const H = harness({ users: U, env: {} });
  assert.deepEqual((await H.call('GET /api/billing/summary', { token: 'a2' })).json, { enabled: false });
  assert.deepEqual((await H.call('POST /api/billing/checkout', { token: 'a2', body: { period: 'monthly' } })).json, { enabled: false });
  assert.equal((await H.call('POST /api/billing/webhook', { query: { inv: 'MQ-2026-000001', sig: 'x' } })).status, 404);
});

test('وسيلة الدفع من البوابة، ورمز حساب الخدمة موقّع RS256، ورقم الفاتورة يُحجز بشرط عدم التعارض', async () => {
  assert.equal(gatewayMethod({ payments: [{ status: 'paid', source: { type: 'applepay' } }] }), 'applepay');
  assert.equal(gatewayMethod({ payments: [{ status: 'paid', source: { type: 'stcpay' } }] }), 'stcpay');
  assert.equal(gatewayMethod({ payments: [{ status: 'paid', source: { type: 'creditcard', company: 'visa' } }] }), 'card');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  let body = ''; const tok = saTokenSource({ client_email: 'b@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) },
    { fetchImpl: async (u, i) => { body = i.body; return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) }; } });
  assert.equal(await tok(), 'AT'); const jwt = decodeURIComponent(body.split('assertion=')[1]).split('.');
  assert.ok(crypto.createVerify('RSA-SHA256').update(jwt[0] + '.' + jwt[1]).verify(publicKey, Buffer.from(jwt[2], 'base64url')));
  assert.equal(JSON.parse(Buffer.from(jwt[1], 'base64url')).scope, 'https://www.googleapis.com/auth/datastore');
  const urls = []; let n = 0;
  const fs = firestoreStore({ project: 'mithqal-control', token: async () => 'T', fetchImpl: async (u, i) => { urls.push(i.method + ' ' + u);
    if (i.method === 'GET') return { ok: true, status: 200, json: async () => ({ fields: { json: { stringValue: JSON.stringify({ n: 41 }) } }, updateTime: '2026-11-19T00:00:00Z' }) };
    if (++n === 1) return { ok: false, status: 400, json: async () => ({ error: { message: 'FAILED_PRECONDITION' } }) }; return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.equal(await fs.nextSeq(), 42);
  assert.ok(urls.filter(u => u.startsWith('PATCH')).every(u => u.includes('currentDocument.updateTime=')), 'كتابة مشروطة'); assert.equal(urls.filter(u => u.startsWith('PATCH')).length, 2, 'إعادة المحاولة عند التعارض');
});

test('أدوات المزوّد: التوصيات بأوامرها، وتأكيد التحويل يطابق المبلغ ولا يتكرر', async () => {
  const { dueReport, confirmTransfer } = await import('../scripts/billing-admin.mjs');
  const R = dueReport([{ tenant: 'c2', paidThrough: '2026-12-18' }, { tenant: 'c3', paidThrough: '2026-11-01' }, { tenant: 'c4', paidThrough: '2026-08-01' }], '2026-11-19');
  assert.deepEqual(R.map(r => [r.tenant, r.recommend, r.cmd]), [['c2', 'active', ''], ['c3', 'readonly', 'node scripts/tenant-provision.mjs status --id c3 --set readonly'], ['c4', 'suspended', 'node scripts/tenant-provision.mjs status --id c4 --set suspended']]);
  const inv = { ...buildInvoice({ seq: 3, issuedAt: '2026-11-19T10:00:00Z', tenant: 'c2', plan: 'pro', period: 'monthly', start: '2026-11-19', prices: parsePrices(PR).prices, seller: SELLER }), status: 'pending_transfer' };
  assert.match(confirmTransfer(inv, { ref: 'TRX-1', amountSar: '228.00', at: 'x' }).error, /المطلوب 228\.85/);
  assert.match(confirmTransfer(inv, { ref: '', amountSar: '228.85', at: 'x' }).error, /--ref/);
  const ok = confirmTransfer(inv, { ref: 'TRX-1', amountSar: '228.85', at: 'x' }); assert.equal(ok.inv.status, 'paid'); assert.equal(ok.inv.method, 'bank');
  assert.ok(confirmTransfer(ok.inv, { ref: 'TRX-2', amountSar: '228.85', at: 'y' }).error, 'لا تأكيد مزدوج');
});

test('مشروع التحكم: قواعده ترفض كل وصول من المتصفح', async () => {
  const fs = await import('node:fs');
  const r = fs.readFileSync(new URL('../firestore.control.rules', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '');
  assert.equal((r.match(/allow /g) || []).length, 1); assert.match(r, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.equal(JSON.parse(fs.readFileSync(new URL('../firebase.control.json', import.meta.url), 'utf8')).firestore.rules, 'firestore.control.rules');
});
