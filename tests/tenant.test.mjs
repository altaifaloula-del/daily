/* v51.0 — المرحلة 07 / S1: طبقة المستأجر في الواجهة والخادم — الافتراضي (الطيف) مطابق للسلوك السابق، والإعداد المحقون يُتحقق منه */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenant, tenantConfigError, DEFAULT_TENANT_ID } from '../tenant.js';
import { loadTenants } from '../tenants.js';
const ENV = { VITE_FIREBASE_API_KEY: 'AIzaSyA-default-key-0123456789abcd', VITE_FIREBASE_PROJECT_ID: 'altaif-prod', VITE_FIREBASE_AUTH_DOMAIN: 'altaif-prod.firebaseapp.com', VITE_FIREBASE_APP_ID: '1:2:web:3' };
const GOOD = { id: 'client2', name: 'مطعم تجريبي', plan: 'pro', firebase: { apiKey: 'AIzaSyB-client2-key-0123456789abcd', projectId: 'mithqal-client2' } };

test('الافتراضي = متغيرات البناء كما هي (لا تغيير على الطيف)', () => {
  const t = resolveTenant(ENV, undefined);
  assert.equal(t.id, DEFAULT_TENANT_ID); assert.equal(t.collection, 'platform'); assert.equal(t.plan, 'enterprise'); assert.equal(t.source, 'env');
  assert.equal(t.firebase.projectId, 'altaif-prod'); assert.equal(t.firebase.apiKey, ENV.VITE_FIREBASE_API_KEY); assert.equal(t.firebase.appId, '1:2:web:3');
  assert.equal(resolveTenant({ ...ENV, VITE_FIREBASE_COLLECTION: 'plat2' }).collection, 'plat2');
});
test('إعداد محقون صالح يُعتمد، والمنطقة الافتراضية للعملاء الجدد الدمام', () => {
  const t = resolveTenant(ENV, GOOD);
  assert.equal(t.id, 'client2'); assert.equal(t.firebase.projectId, 'mithqal-client2'); assert.equal(t.firebase.authDomain, 'mithqal-client2.firebaseapp.com');
  assert.equal(t.region, 'me-central2'); assert.equal(t.plan, 'pro'); assert.equal(t.source, 'injected');
});
test('إعداد محقون غير صالح يُرفض ويعمل الافتراضي', () => {
  for (const bad of [{}, { ...GOOD, id: 'default' }, { ...GOOD, id: 'A B' }, { ...GOOD, firebase: { ...GOOD.firebase, projectId: 'X' } }, { ...GOOD, firebase: { ...GOOD.firebase, apiKey: 'short' } },
    { ...GOOD, plan: 'gold' }, { ...GOOD, region: 'us-central1' }, { ...GOOD, collection: '../x' }, 'str']) {
    assert.ok(tenantConfigError(bad), JSON.stringify(bad));
    const t = resolveTenant(ENV, bad); assert.equal(t.id, 'default'); assert.equal(t.firebase.projectId, 'altaif-prod'); assert.ok(t.rejected);
  }
});
test('سجل الخادم: الافتراضي من البيئة، والإضافي يُعرف بمشروع الرمز لا بترويسة', () => {
  const R = loadTenants({ FIREBASE_API_KEY: ' "k-default" ', FIREBASE_PROJECT_ID: 'altaif-prod', ZATCA_ENC_KEY: 'z'.repeat(40),
    MQ_TENANTS_JSON: JSON.stringify([{ id: 'client2', projectId: 'mithqal-client2', apiKeyEnv: 'FB_KEY_C2', zatcaKeyEnv: 'ZK_C2' }, { id: 'default', projectId: 'x-proj1' }, { id: 'dup', projectId: 'altaif-prod', apiKeyEnv: 'FB_X' }, { id: 'bad', projectId: 'mithqal-bad', apiKeyEnv: 'lower' }]),
    FB_KEY_C2: 'k-c2', ZK_C2: 'q'.repeat(40) });
  assert.equal(R.def.apiKey, 'k-default'); assert.equal(R.def.projectId, 'altaif-prod');
  assert.equal(R.byProject('altaif-prod').id, 'default'); assert.equal(R.byProject('mithqal-client2').apiKey, 'k-c2');
  assert.equal(R.byProject('unknown-proj'), null); assert.equal(R.list.length, 2); assert.equal(R.errors.length, 3);
  assert.deepEqual(loadTenants({ MQ_TENANTS_JSON: '{bad' }).errors, ['MQ_TENANTS_JSON غير صالح']);
  assert.equal(loadTenants({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p-proj' }).def.projectId, 'p-proj', 'أسماء VITE_ مقبولة كما كانت');
});
