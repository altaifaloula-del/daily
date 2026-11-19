/* v51.3 — المرحلة 07 / S4: الخطط وأعلام الخصائص + القواعد المولّدة للمنشآت */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLAN_FEATURES, planFeatures, planAllows, branchesOk, STATUS_AR, PLAN_AR } from '../plans.js';
import { PLANS, resolveTenant, tenantConfigError } from '../tenant.js';
import { loadTenants } from '../tenants.js';
import { tenantRules } from '../scripts/tenant-rules.mjs';
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('الخطط: كل خطة معرّفة، والطيف «المؤسسات» بكل الخصائص، وغير المعروف ⇒ الأضيق', () => {
  assert.deepEqual(Object.keys(PLAN_FEATURES).sort(), [...PLANS].sort());
  for (const p of PLANS) assert.ok(PLAN_AR[p]);
  assert.equal(planAllows('enterprise', 'ai'), true); assert.equal(planAllows('enterprise', 'zatca'), true); assert.equal(branchesOk('enterprise', 500), true);
  assert.equal(planAllows('basic', 'ai'), false); assert.equal(branchesOk('basic', 2), false);
  assert.deepEqual(planFeatures('gold'), PLAN_FEATURES.basic);
  assert.equal(planAllows('gold', 'ai'), false);
  assert.equal(resolveTenant({}, undefined).plan, 'enterprise'); assert.equal(resolveTenant({}, undefined).status, 'active');
  assert.deepEqual(Object.keys(STATUS_AR), ['active', 'readonly', 'suspended']);
});

test('الخادم: الخطة من السجل، والطيف «المؤسسات»، والخطة المجهولة ⇒ الأساسية مع تنبيه', () => {
  const env = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FB_C2: 'AIzaSy' + 'b'.repeat(33), FB_C3: 'AIzaSy' + 'c'.repeat(33),
    MQ_TENANTS_JSON: JSON.stringify([{ id: 'c2', projectId: 'mithqal-c2', apiKeyEnv: 'FB_C2', plan: 'pro' }, { id: 'c3', projectId: 'mithqal-c3', apiKeyEnv: 'FB_C3', plan: 'gold' }]) };
  const T = loadTenants(env);
  assert.equal(T.def.plan, 'enterprise'); assert.equal(T.byId('c2').plan, 'pro'); assert.equal(T.byId('c3').plan, 'basic');
  assert.match(T.errors.join(), /c3: خطة غير معروفة/);
});

test('الخادم يفرض الخطة على مسارات الذكاء والفوترة (لا يكفي الإخفاء في الواجهة)', () => {
  const s = rd('server.js');
  for (const r of ["'/api/ai/analyze'", "'/api/ai/feedback'"]) assert.match(s, new RegExp('app\\.post\\(' + r.replace(/\//g, '\\/') + ", [^\\n]*requireMember, requireFeature\\('ai'\\)"), r);
  assert.match(s, /app\.post\('\/api\/zatca\/onboard', [^\n]*requireMember, requireFeature\('zatca'\)/);
  assert.match(s, /res\.status\(402\)/);
});

test('السجل: حالة الاشتراك مقيّدة القيم، والمنشأة «للقراءة فقط» تعمل والموقوفة لا', () => {
  const base = { id: 'c2', plan: 'pro', firebase: { projectId: 'mithqal-c2', apiKey: 'AIzaSy' + 'b'.repeat(33) } };
  assert.equal(tenantConfigError({ ...base, status: 'readonly' }), '');
  assert.match(tenantConfigError({ ...base, status: 'paused' }), /حالة/);
  assert.equal(resolveTenant({}, { ...base, status: 'readonly' }).status, 'readonly');
});

test('قواعد المنشآت مولّدة من قواعد الطيف ومحدَّثة — وكل قاعدة كتابة مشروطة بالاشتراك', () => {
  const src = rd('firestore.rules'), gen = tenantRules(src);
  assert.equal(rd('firestore.tenant.rules'), gen.text, 'شغّل node scripts/tenant-rules.mjs');
  assert.doesNotMatch(src, /subOk|'sub'/, 'قواعد الطيف لم تُمس');
  const allows = [...gen.text.matchAll(/^\s*allow ([a-z, ]+):\s*if\s+([^\n]*)/gm)];
  const writes = allows.filter(m => /create|update|delete|write/.test(m[1]));
  assert.ok(writes.length >= 25);
  for (const m of writes) assert.ok(/^false/.test(m[2]) || m[2].startsWith('subOk() && ('), m[0].trim());
  for (const m of allows.filter(m => /read/.test(m[1]))) assert.ok(!/create|update|delete|write/.test(m[1]) || /^false/.test(m[2]), 'القراءة لا تُربط بالاشتراك: ' + m[0].trim());
  assert.match(gen.text, /function subOk\(\) \{\s*let r = relOf\(\);\s*return r == null \|\| r\.get\('sub', 'active'\) == 'active';/, 'الحالة من مستند تقرؤه الطلبات أصلًا (لا قراءة إضافية)');
  assert.match(gen.text, /hasOnly\(\['minCv', 'cutover', 'at', 'by', 'sub'\]\)\s*\/\/[^\n]*\n\s*&& request\.resource\.data\.get\('sub', 'active'\) == \(resource == null \? 'active' : resource\.data\.get\('sub', 'active'\)\)/);
  const fb = JSON.parse(rd('firebase.tenant.json')); assert.equal(fb.firestore.rules, 'firestore.tenant.rules');
  // عبارة مركّبة: الشرط كاملًا داخل القوسين
  const t = tenantRules("service x {\n  match /databases/{database}/documents {\n    function relOf() { return null; }\n    match /platform/release {\n      allow write: if request.resource.data.keys().hasOnly(['minCv', 'cutover', 'at', 'by']);\n    }\n    match /a/{i} {\n      allow read, delete: if A() // ملاحظة; لا تقطع\n        || B('x;y');\n    }\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n").text;
  assert.match(t, /allow read: if A\(\) \/\/ ملاحظة; لا تقطع\n        \|\| B\('x;y'\);/);
  assert.match(t, /allow delete: if subOk\(\) && \(A\(\) \/\/ ملاحظة; لا تقطع\n        \|\| B\('x;y'\)\);/);
});

test('تغيير حالة الاشتراك: أوامر فقط، على مستند الحالة وحده، ولا يمس الخطة ولا الطيف', async () => {
  const { statusPlan, provisionPlan } = await import('../scripts/tenant-provision.mjs');
  assert.match(statusPlan({ id: 'c2', set: 'paused' }).error, /--set/); assert.ok(statusPlan({ id: 'default', set: 'readonly' }).error);
  const r = JSON.stringify(statusPlan({ id: 'c2', set: 'readonly' }));
  assert.match(r, /mithqal-c2\/databases\/\(default\)\/documents\/platform\/release\?updateMask\.fieldPaths=sub\\"/); assert.doesNotMatch(r, /plan|minCv/, 'يغيّر الحالة وحدها');
  const P = provisionPlan({ id: 'c2', name: 'مطعم', plan: 'pro', owner: 'o@c.sa' }), txt = JSON.stringify(P);
  assert.match(txt, /firebase deploy --config firebase\.tenant\.json/); assert.match(txt, /\\"plan\\":\\"pro\\"/);
  const iRules = P.findIndex(s => /قواعد المنشآت/.test(s.t)), iSub = P.findIndex(s => /حالة الاشتراك/.test(s.t)), iReg = P.findIndex(s => /إضافة المنشأة إلى السجل/.test(s.t));
  assert.ok(iRules < iSub && iSub < iReg, 'القواعد ثم الحالة قبل نشر الرابط');
});
