/* v51.2 — المرحلة 07 / S3: الخادم متعدد المنشآت — لا يعبر رمز منشأة إلى أخرى، ولكل منشأة مفتاح تشفير مستقل */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadTenants } from '../tenants.js';
import { createVerifier, tenantForToken, tokenProject } from '../server-auth.js';
import { seal, open, vaultReady } from '../zatca/vault.js';

const K = (n) => 'AIzaSy' + n.padEnd(33, 'x');
const ENV = { FIREBASE_API_KEY: K('altaif'), FIREBASE_PROJECT_ID: 'altaif-prod', ZATCA_ENC_KEY: 'z'.repeat(40), FB_KEY_C2: K('c2'), ZK_C2: 'q'.repeat(40),
  MQ_TENANTS_JSON: JSON.stringify([{ id: 'client2', projectId: 'mithqal-client2', apiKeyEnv: 'FB_KEY_C2', zatcaKeyEnv: 'ZK_C2' }]) };
const KEY_PROJECT = { [K('altaif')]: 'altaif-prod', [K('c2')]: 'mithqal-client2' };
const tok = (aud, email) => ['h', Buffer.from(JSON.stringify({ aud, email })).toString('base64url'), 's'].join('.');
// محاكاة Google: الرمز يُقبل فقط بمفتاح مشروعه؛ والعضوية تُقرأ من قاعدة مشروع الرمز
const MEMBERS = { 'altaif-prod': { 'a@altaif.sa': 'system_admin' }, 'mithqal-client2': { 'b@c2.sa': 'branch_manager' } };
const calls = [];
const fakeFetch = async (url, init) => {
  calls.push(url);
  if (url.includes('accounts:lookup')) {
    const key = decodeURIComponent(url.split('key=')[1]); const { idToken } = JSON.parse(init.body);
    const p = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url')); const ok = KEY_PROJECT[key] === p.aud;
    return { ok, status: ok ? 200 : 400, json: async () => ok ? { users: [{ email: p.email }] } : { error: { message: 'INVALID_ID_TOKEN' } } };
  }
  const m = url.match(/projects\/([^/]+)\/databases\/\(default\)\/documents\/members\/(.+)$/);
  const role = m && (MEMBERS[decodeURIComponent(m[1])] || {})[decodeURIComponent(m[2])];
  return { ok: !!role, json: async () => ({ fields: { active: { booleanValue: true }, role: { stringValue: role } } }) };
};

test('السجل على الخادم: الطيف + منشأة إضافية، والأسرار من متغيرات بيئة بأسمائها', () => {
  const T = loadTenants(ENV);
  assert.deepEqual(T.list.map(t => t.id), ['default', 'client2']); assert.equal(T.errors.length, 0);
  assert.equal(T.byProject('mithqal-client2').apiKey, K('c2'));
  const D = loadTenants({ ...ENV, ZK_C2: ENV.ZATCA_ENC_KEY });
  assert.equal(D.byId('client2').zatcaKey, '', 'مفتاح فوترة مكرر يُعطَّل'); assert.match(D.errors.join(), /مكرر/);
});

test('الهوية: كل منشأة تتحقق بمفتاحها، ورمز منشأة لا يفتح الأخرى', async () => {
  const T = loadTenants(ENV); const v = createVerifier({ T, fetchImpl: fakeFetch });
  assert.deepEqual(await v(tok('altaif-prod', 'a@altaif.sa')), { email: 'a@altaif.sa', role: 'system_admin', tenant: 'default' });
  assert.deepEqual(await v(tok('mithqal-client2', 'b@c2.sa')), { email: 'b@c2.sa', role: 'branch_manager', tenant: 'client2' });
  calls.length = 0;
  assert.equal(await v(tok('mithqal-client2', 'a@altaif.sa')), null, 'مدير الطيف ليس عضوًا في منشأة أخرى');
  assert.ok(calls.some(u => u.includes('projects/mithqal-client2/')) && !calls.some(u => u.includes('projects/altaif-prod/')), 'العضوية من قاعدة المنشأة نفسها فقط');
  assert.equal(await v(tok('evil-project', 'a@altaif.sa')), null, 'مشروع غير مسجَّل يُرفض');
  assert.equal(await v('not-a-jwt'), null);
});

test('الطيف بلا FIREBASE_PROJECT_ID: يبقى السلوك القديم (مفتاح الطيف هو الحَكَم)', async () => {
  const { FIREBASE_PROJECT_ID, ...env } = ENV; const T = loadTenants(env);
  assert.equal(tenantForToken(T, tok('altaif-prod', 'x')).id, 'default');
  assert.equal(tenantForToken(T, tok('mithqal-client2', 'x')).id, 'client2');
  const v = createVerifier({ T, fetchImpl: fakeFetch });
  assert.equal((await v(tok('altaif-prod', 'a@altaif.sa'))).tenant, 'default');
  assert.equal(await v(tok('evil-project', 'a@altaif.sa')), null, 'Google ترفض رمز مشروع آخر بمفتاح الطيف');
  assert.equal(tokenProject(tok('A_B', 'x')), '');
});

test('خزنة الفوترة لكل منشأة: الطيف على اشتقاقه القديم، ولا يُفك جهاز منشأة بمفتاح أخرى', () => {
  const sec = crypto.randomBytes(32).toString('base64');
  const k0 = process.env.ZATCA_ENC_KEY; process.env.ZATCA_ENC_KEY = sec;
  const legacy = seal({ k: 'PEM-ALTAIF' }, 'egs|simulation|b1');   // كما كانت تُشفَّر قبل S3
  assert.equal(open(legacy, 'egs|simulation|b1', { secret: sec, tenant: 'default' }).k, 'PEM-ALTAIF', 'أجهزة الطيف المسجّلة سابقًا تبقى تُفك');
  const c2 = seal({ k: 'PEM-C2' }, 'egs|simulation|b1', { secret: sec, tenant: 'client2' });
  assert.throws(() => open(c2, 'egs|simulation|b1', { secret: sec, tenant: 'default' }), 'حتى بالسر نفسه لا يُفك باسم منشأة أخرى');
  assert.throws(() => open(c2, 'egs|simulation|b1', { secret: sec, tenant: 'client3' }));
  assert.equal(open(c2, 'egs|simulation|b1', { secret: sec, tenant: 'client2' }).k, 'PEM-C2');
  assert.equal(vaultReady({ secret: '', tenant: 'client2' }), false); assert.throws(() => seal({}, 'x', { secret: 'short', tenant: 'client2' }));
  process.env.ZATCA_ENC_KEY = k0;
});

test('صورة Docker تنسخ كل ملفات الخادم المحلية التي يستوردها server.js', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8'), df = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const locals = [...src.matchAll(/from '\.\/([^'/]+\.js)'/g)].map(m => m[1]);
  assert.ok(locals.includes('server-auth.js'));
  for (const f of locals) assert.match(df, new RegExp('COPY [^\\n]*\\b' + f.replace('.', '\\.') + '\\b'), f + ' غير منسوخ في Dockerfile');
});
