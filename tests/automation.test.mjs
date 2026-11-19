/* v51.8 — الأتمتة: القيود الدورية تلقائيًا بلا تكرار، والفاتورة المسبقة، وتطبيق حالة الاشتراك وعودتها فور الدفع */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAutomation, automationConfig } from '../server-automation.js';
import { memoryStore, billingConfig } from '../server-billing.js';
import { loadTenants } from '../tenants.js';
import { buildEngine } from './build-engine.mjs';

const SA = JSON.stringify({ client_email: 'ops@x.iam.gserviceaccount.com', private_key: 'k', project_id: 'mithqal-c2' });
const T = loadTenants({ FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FB_C2: 'AIzaSy' + 'b'.repeat(33), FB_C3: 'AIzaSy' + 'c'.repeat(33), SA_C2: SA,
  MQ_TENANTS_JSON: JSON.stringify([{ id: 'c2', projectId: 'mithqal-c2', apiKeyEnv: 'FB_C2', plan: 'pro', saEnv: 'SA_C2' }, { id: 'c3', projectId: 'mithqal-c3', apiKeyEnv: 'FB_C3', plan: 'pro' }]) });
const BILL = billingConfig({ MQ_BILLING: '1', MQ_CONTROL_PROJECT: 'mithqal-control', MQ_CONTROL_SA: JSON.stringify({ client_email: 'b@x', private_key: 'k' }), MQ_SELLER_JSON: JSON.stringify({ name: 'مِثقال', vatNo: '311111111100003' }),
  MQ_PRICES_JSON: '{"pro":{"monthly":199}}', MQ_APP_URL: 'https://app.x', MQ_BANK_IBAN: 'SA0380000000608010167519' });
const at = (d) => () => Date.parse(d + 'T09:00:00Z');

test('الأتمتة: فاتورة مسبقة قبل الاستحقاق بأسبوع — مرة واحدة', async () => {
  assert.equal(BILL.enabled, true, BILL.why.join());
  const store = memoryStore(); await store.putSub('c2', { paidThrough: '2026-11-24', period: 'monthly', buyer: { name: 'مطعم س', vatNo: '300000000000003' } });
  const w = []; const run = (d) => runAutomation({ T, store, billing: BILL, auto: automationConfig({}), now: at(d), writeStatus: async (t, s) => w.push(t.id + ':' + s) });
  assert.deepEqual(await run('2026-11-10'), [], 'قبل موعد التذكير لا شيء');
  const l = await run('2026-11-19'); assert.equal(l[0].action, 'invoice');
  const inv = (await store.listInvoices('c2'))[0]; assert.equal(inv.start, '2026-11-25'); assert.equal(inv.total, 22885); assert.equal(inv.auto, true); assert.equal(inv.buyer.vatNo, '300000000000003');
  assert.deepEqual(await run('2026-11-20'), [], 'لا فاتورة ثانية لنفس الدورة'); assert.deepEqual(w, []);
});

test('الأتمتة: للقراءة فقط بعد المهلة، ثم موقوف، وتعود نشطة فور الدفع — وبلا حساب خدمة تبقى توصية', async () => {
  const store = memoryStore(); await store.putSub('c2', { paidThrough: '2026-11-01', period: 'monthly' }); await store.putSub('c3', { paidThrough: '2026-11-01' }); await store.putSub('default', { paidThrough: '2020-01-01' });
  const w = []; const run = (d) => runAutomation({ T, store, billing: BILL, auto: { status: true, invoice: false }, now: at(d), writeStatus: async (t, s) => w.push(t.id + ':' + s) });
  let l = await run('2026-11-05'); assert.deepEqual(w, [], 'داخل المهلة');
  l = await run('2026-11-19'); assert.deepEqual(w, ['c2:readonly']); assert.ok(l.some(x => x.tenant === 'c3' && x.action === 'status-skipped'), 'c3 بلا حساب خدمة');
  assert.ok(!l.some(x => x.tenant === 'default'), 'الطيف لا يُمس أبدًا');
  await run('2026-11-20'); assert.deepEqual(w, ['c2:readonly'], 'لا تكرار للكتابة');
  await run('2026-12-20'); assert.deepEqual(w, ['c2:readonly', 'c2:suspended']);
  await store.putSub('c2', { ...(await store.getSub('c2')), paidThrough: '2027-01-19' });   // دفعة
  await runAutomation({ T, store, billing: BILL, auto: { status: true, invoice: false }, now: at('2026-12-20'), only: 'c2', writeStatus: async (t, s) => w.push(t.id + ':' + s) });
  assert.deepEqual(w.slice(-1), ['c2:active'], 'تعود نشطة فور الدفع');
  const off = []; await store.putSub('c2', { paidThrough: '2026-01-01', appliedStatus: 'active' });
  await runAutomation({ T, store, billing: BILL, auto: automationConfig({ MQ_AUTO_STATUS: '0' }), now: at('2026-12-20'), writeStatus: async (t, s) => off.push(s) }); assert.deepEqual(off, [], 'MQ_AUTO_STATUS=0 يوقفها');
});

test('القيود الدورية: التطبيق التلقائي والزر بمعرّفات ثابتة — لا تكرار مهما تكرر التشغيل أو تعددت الأجهزة', async () => {
  const E = await buildEngine();
  const tpl = { id: 'rent', title: 'إيجار', every: 'm', day: 1, next: '2026-10-01', active: true, lines: [{ acc: '5201', debit: 1000 }, { acc: '1101', credit: 1000 }] };
  const d0 = { jeRecurring: [tpl], journalManual: [] }, owner = { id: 'u1', name: 'مجاهد', role: 'system_admin' }, acct = { id: 'u2', name: 'محاسب', role: 'accountant' };
  const r1 = E.recurApply(d0, owner, {}, '2026-11-19');
  assert.deepEqual(r1.recs.map(x => x.id), ['jmr_rent_2026-10-01', 'jmr_rent_2026-11-01']); assert.equal(r1.recs[0].status, 'posted'); assert.equal(r1.next.jeRecurring[0].next, '2026-12-01');
  // جهاز آخر ببيانات قديمة (لم يرَ التحديث) يطبّق على الأحدث: لا شيء جديد
  const stale = E.recurApply({ ...r1.next, jeRecurring: [tpl] }, owner, {}, '2026-11-19'); assert.equal(stale.recs.length, 0, 'المعرّفات موجودة ⇒ لا تكرار');
  assert.equal(E.recurApply(d0, acct, {}, '2026-11-19').recs[0].status, 'pending', 'غير المالك ⇒ بانتظار الاعتماد');
});
