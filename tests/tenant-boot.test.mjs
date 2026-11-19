/* v51.1 — المرحلة 07 / S2: تحديد المستأجر من السجل، عزل التخزين المحلي، وسكربت التهيئة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { tenantRequest, fetchTenant, bootTenant, nsStorage, tenantErrorHtml, TENANT_LS } from '../tenant-boot.js';
import { validateArgs, provisionPlan, registryEntry, projectIdOf, REGION } from '../scripts/tenant-provision.mjs';
import { tenantConfigError } from '../tenant.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = { id: 'client2', name: 'مطعم تجريبي', plan: 'pro', region: 'me-central2', status: 'active', collection: 'platform', firebase: { apiKey: 'AIzaSyB-client2-key-0123456789abcd', projectId: 'mithqal-client2', authDomain: 'mithqal-client2.firebaseapp.com' } };
const res = (code, body) => ({ ok: code === 200, json: async () => body });
const fetchOf = (map) => async (u) => { const id = u.match(/tenants\/([^/]+)\.json/)[1]; if (map === 'throw') throw new Error('net'); return map[id] ? res(200, map[id]) : res(404); };
class FakeStorage { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const mkWin = (href, saved, map) => { class S extends FakeStorage { } const ls = new S(); if (saved) ls.setItem(TENANT_LS, saved); const u = new URL(href); return { Storage: S, localStorage: ls, location: { hostname: u.hostname, search: u.search }, fetch: fetchOf(map || {}) }; };

test('تحديد المنشأة المطلوبة: النطاق الفرعي ← ?t ← المحفوظ ← الافتراضي', () => {
  assert.deepEqual(tenantRequest({ hostname: 'client2.mithqal.sa', domain: 'mithqal.sa' }), { id: 'client2', from: 'subdomain' });
  assert.deepEqual(tenantRequest({ hostname: 'app.mithqal.sa', domain: 'mithqal.sa' }), { id: '', from: 'default' });
  assert.deepEqual(tenantRequest({ hostname: 'x.github.io', search: '?t=Client2' }), { id: 'client2', from: 'query' });
  assert.deepEqual(tenantRequest({ search: '?t=default', saved: 'client2' }), { id: '', from: 'reset' });
  assert.equal(tenantRequest({ search: '?t=../evil' }).from, 'invalid');
  assert.deepEqual(tenantRequest({ saved: 'client2' }), { id: 'client2', from: 'saved' });
  assert.deepEqual(tenantRequest({}), { id: '', from: 'default' });
});
test('الإعداد من السجل فقط ويُتحقق منه — لا عودة صامتة للافتراضي', async () => {
  assert.deepEqual((await fetchTenant('client2', fetchOf({ client2: CFG }))).cfg.id, 'client2');
  assert.equal((await fetchTenant('nope', fetchOf({}))).error, 'not-found');
  assert.equal((await fetchTenant('client2', fetchOf({ client2: { ...CFG, id: 'other' } }))).error, 'mismatch');
  assert.equal((await fetchTenant('client2', fetchOf({ client2: { ...CFG, firebase: { apiKey: 'x', projectId: 'P' } } }))).error, 'invalid');
  assert.equal((await fetchTenant('client2', fetchOf({ client2: { ...CFG, status: 'suspended' } }))).error, 'suspended');
  assert.equal((await fetchTenant('client2', fetchOf('throw'))).error, 'network');
});
test('الإقلاع: الافتراضي بلا تغيير، والمنشأة تُحفظ على الجهاز، والمحذوفة من السجل تُنسى', async () => {
  const w0 = mkWin('https://x.github.io/daily/'); assert.deepEqual(await bootTenant(w0), { ok: true, id: 'default' }); assert.equal(w0.__MQ_TENANT__, undefined);
  const w1 = mkWin('https://x.github.io/daily/?t=client2', '', { client2: CFG }); const b1 = await bootTenant(w1);
  assert.equal(b1.ok, true); assert.equal(w1.__MQ_TENANT__.firebase.projectId, 'mithqal-client2'); assert.equal(w1.localStorage.getItem(TENANT_LS), 'client2');
  const w2 = mkWin('https://x.github.io/daily/', 'gone', {}); const b2 = await bootTenant(w2);
  assert.equal(b2.ok, false); assert.equal(b2.error, 'not-found'); assert.equal(w2.localStorage.getItem(TENANT_LS), null);
  const w3 = mkWin('https://x.github.io/daily/?t=default', 'client2'); assert.equal((await bootTenant(w3)).id, 'default'); assert.equal(w3.localStorage.getItem(TENANT_LS), null);
  assert.equal((await bootTenant(mkWin('https://x.github.io/?t=Bad_Id!'))).error, 'invalid');
  assert.match(tenantErrorHtml('not-found', 'x<y'), /المنشأة غير موجودة/); assert.doesNotMatch(tenantErrorHtml('not-found', 'x<y'), /x<y/);
});
test('عزل التخزين المحلي على الجهاز لغير الطيف', () => {
  const w = mkWin('https://x/'); w.localStorage.setItem('rms8:org', 'ALTAIF'); w.localStorage.setItem('mizan:posQueue', 'Q-ALTAIF');
  assert.equal(nsStorage(w, 'default'), false);
  assert.equal(nsStorage(w, 'client2'), true);
  assert.equal(w.localStorage.getItem('rms8:org'), null, 'بيانات الطيف المحلية لا تظهر للمنشأة الأخرى');
  w.localStorage.setItem('mizan:posQueue', 'Q-C2'); assert.equal(w.localStorage.m.get('mq@client2:mizan:posQueue'), 'Q-C2');
  assert.equal(w.localStorage.m.get('mizan:posQueue'), 'Q-ALTAIF', 'طابور الطيف لم يُمس');
  w.localStorage.setItem('mq:tenant', 'client2'); assert.equal(w.localStorage.m.get('mq:tenant'), 'client2');
  assert.equal(nsStorage(w, 'client2'), false, 'لا يُطبَّق مرتين');
});
test('سكربت التهيئة: تحقق المدخلات، الدمام، وتثبيت المالك قبل نشر الرابط', () => {
  assert.equal(validateArgs({ id: 'client2', name: 'مطعم', plan: 'pro', owner: 'o@c.sa' }).length, 0);
  assert.ok(validateArgs({ id: 'default', name: 'x', plan: 'pro', owner: 'o@c.sa' }).length);
  assert.ok(validateArgs({ id: 'a'.repeat(23), name: 'xx', plan: 'pro', owner: 'o@c.sa' }).length, 'معرّف المشروع ≤ 30');
  assert.ok(validateArgs({ id: 'client2', name: 'xx', plan: 'gold', owner: 'bad' }).length >= 2);
  assert.equal(projectIdOf('a'.repeat(22)).length, 30);
  const P = provisionPlan({ id: 'client2', name: 'مطعم', plan: 'pro', owner: 'Owner@C.sa' }), txt = JSON.stringify(P);
  assert.match(txt, /--location=me-central2/); assert.equal(REGION, 'me-central2');
  const iAdmin = P.findIndex(s => /تثبيت مالك/.test(s.t)), iReg = P.findIndex(s => /إضافة المنشأة إلى السجل/.test(s.t)), iOpen = P.findIndex(s => /الإعداد الأول/.test(s.t));
  assert.ok(iAdmin > 0 && iAdmin < iReg && iReg < iOpen, 'المالك يُثبَّت قبل نشر الرابط'); assert.match(txt, /owner@c\.sa/);
  assert.doesNotMatch(txt, /altaif|delete|rm -rf/i, 'لا يمس مشروع الطيف ولا يحذف شيئًا');
});
test('ملف السجل من sdkconfig — والسجل المنشور كله صالح', () => {
  const sdk = 'Firebase config:\n' + JSON.stringify({ projectId: 'mithqal-client2', apiKey: 'AIzaSyB-client2-key-0123456789abcd', authDomain: 'mithqal-client2.firebaseapp.com', appId: '1:2:web:3' });
  const r = registryEntry({ id: 'client2', name: 'مطعم', plan: 'pro' }, sdk); assert.equal(r.cfg.region, 'me-central2'); assert.equal(r.cfg.status, 'active'); assert.equal(tenantConfigError(r.cfg), '');
  assert.match(registryEntry({ id: 'client3', name: 'x', plan: 'pro' }, sdk).error, /لا يطابق/);
  const dir = path.join(root, 'public', 'tenants');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); assert.equal(c.id + '.json', f); assert.equal(tenantConfigError(c), '', f); assert.ok(!/secret|private|password/i.test(JSON.stringify(c)), f + ': لا أسرار'); }
});
