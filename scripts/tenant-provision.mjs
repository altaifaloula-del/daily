#!/usr/bin/env node
/**
 * v51.1 — المرحلة 07 / S2: تهيئة منشأة مشتركة جديدة (مشروع Firebase مستقل في الدمام).
 *
 *   node scripts/tenant-provision.mjs plan     --id client2 --name "مطعم تجريبي" --plan pro --owner owner@client.sa [--billing XXXXXX-XXXXXX-XXXXXX]
 *   node scripts/tenant-provision.mjs registry --id client2 --name "مطعم تجريبي" --plan pro --owner owner@client.sa --sdk sdkconfig.json
 *
 * «plan»: يطبع الخطوات والأوامر بالترتيب (لا ينفّذ شيئًا) — ينفّذها المالك بحسابه في Google بعد المراجعة.
 * «registry»: يحوّل مخرجات `firebase apps:sdkconfig web` إلى ملف السجل public/tenants/<id>.json بعد التحقق منه.
 *   node scripts/tenant-provision.mjs status   --id client2 --set readonly|suspended|active   (v51.3 — يطبع أوامر تغيير الحالة فقط)
 *
 * لا يحذف شيئًا ولا يلمس مشروع الطيف أبدًا.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { tenantConfigError, PLANS, TENANT_REGIONS } from '../tenant.js';
import { TENANT_STATUSES, STATUS_AR } from '../plans.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REGION = TENANT_REGIONS[0];   // الدمام — قرار المالك 2026-11-19
export const projectIdOf = (id) => 'mithqal-' + id;
const okId = (v) => /^[a-z0-9][a-z0-9-]{1,21}$/.test(v || '') && v !== 'default';   // معرّف المشروع mithqal-<id> ≤ 30 حرفًا

export function validateArgs(a) {
  const errs = [];
  if (!okId(a.id)) errs.push('--id: حروف إنجليزية صغيرة وأرقام وشرطة (2–22) وليس default');
  if (!a.name || String(a.name).trim().length < 2) errs.push('--name: اسم المنشأة مطلوب');
  if (!PLANS.includes(a.plan || '')) errs.push('--plan: ' + PLANS.join(' | '));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.owner || '')) errs.push('--owner: بريد مالك المنشأة مطلوب (يُثبَّت مديرًا قبل فتح الرابط)');
  if (a.billing && !/^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/.test(a.billing)) errs.push('--billing: صيغة حساب الفوترة XXXXXX-XXXXXX-XXXXXX');
  return errs;
}

// v51.3: حالة الاشتراك حقل sub في platform/release (تقرؤه القواعد دون قراءة إضافية). الإنشاء الأول: إصدار 0 وبداية التوقيع اليوم.
const relUrl = (P, mask) => '"https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents/platform/release' + (mask ? '?updateMask.fieldPaths=sub&currentDocument.exists=true' : '') + '"';
const AUTH = ' -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" -d ';
const subPatch = (P, status, init) => 'curl -sS -X PATCH ' + relUrl(P, !init) + AUTH + "'" + JSON.stringify({ fields: init
  ? { minCv: { integerValue: '0' }, cutover: { stringValue: new Date().toISOString().slice(0, 10) }, at: { integerValue: String(Date.now()) }, by: { stringValue: 'mithqal-provision' }, sub: { stringValue: status } }
  : { sub: { stringValue: status } } }) + "'";

/** v51.3: تغيير حالة اشتراك منشأة — أوامر فقط (تُنفَّذ بعد موافقة المالك) */
export function statusPlan(a) {
  if (!okId(a.id)) return { error: '--id غير صالح' };
  if (!TENANT_STATUSES.includes(a.set)) return { error: '--set: ' + TENANT_STATUSES.join(' | ') };
  const P = projectIdOf(a.id);
  return { steps: [
    { t: 'القاعدة (التطبيق الفعلي): الحالة «' + STATUS_AR[a.set] + '»', cmd: [subPatch(P, a.set)], note: a.set === 'active' ? 'تعود الكتابة فورًا' : 'تتوقف كل كتابة في المنشأة فورًا؛ القراءة والتصدير باقيان' },
    { t: 'السجل (ما تعرضه الواجهة)', cmd: [], note: 'public/tenants/' + a.id + '.json: "status": "' + a.set + '" — ثم طلب دمج' + (a.set === 'suspended' ? ' (الموقوفة تظهر لها صفحة إيقاف)' : '') }
  ] };
}

/** خطوات التهيئة بالترتيب — كل خطوة: عنوان، وأوامر (إن وُجدت)، وملاحظة */
export function provisionPlan(a) {
  const P = projectIdOf(a.id), q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
  const K = a.id.toUpperCase().replace(/-/g, '_');
  return [
    { t: 'إنشاء مشروع Google Cloud مستقل للمنشأة', cmd: ['gcloud projects create ' + P + ' --name=' + q('Muktasab ' + a.id)] },
    { t: 'ربط حساب الفوترة (خطة Blaze) وتحديد سقف ميزانية وتنبيه', cmd: a.billing ? ['gcloud billing projects link ' + P + ' --billing-account=' + a.billing] : [], note: a.billing ? '' : 'أضف --billing أو اربطه من وحدة تحكم الفوترة، ثم ضع تنبيه ميزانية شهري' },
    { t: 'إضافة Firebase إلى المشروع', cmd: ['firebase projects:addfirebase ' + P] },
    { t: 'إنشاء قاعدة Firestore في الدمام (لا يتغير الموقع بعد الإنشاء)', cmd: ['gcloud firestore databases create --project=' + P + ' --location=' + REGION + ' --type=firestore-native'] },
    { t: 'تفعيل الدخول بالبريد وكلمة السر', cmd: [], note: 'وحدة تحكم Firebase ← Authentication ← Sign-in method ← Email/Password' },
    { t: 'إنشاء تطبيق الويب وتنزيل إعداده', cmd: ['firebase apps:create web ' + q('Muktasab Web') + ' --project ' + P, 'firebase apps:sdkconfig web --project ' + P + ' > sdkconfig.json'] },
    { t: 'نشر قواعد المنشآت المشتركة (قواعد الطيف نفسها + شرط الاشتراك) والفهارس', cmd: ['node scripts/tenant-rules.mjs --check', 'firebase deploy --config firebase.tenant.json --only firestore:rules,firestore:indexes --project ' + P] },
    { t: 'تثبيت مالك المنشأة مديرًا قبل نشر الرابط (يغلق باب «أول من يسجّل يصبح مديرًا»)', cmd: ['curl -sS -X PATCH "https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents/platform/admins" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" -d \'{"fields":{"emails":{"arrayValue":{"values":[{"stringValue":"' + String(a.owner).toLowerCase() + '"}]}},"at":{"integerValue":"' + Date.now() + '"}}}\''] },
    { t: 'تسجيل حالة الاشتراك «نشط» (لا يغيّرها أي حساب في المنشأة — حساب الخدمة فقط)', cmd: [subPatch(P, 'active', true)], note: 'الخطة نفسها في السجل وعلى الخادم (MQ_TENANTS_JSON)' },
    { t: 'تقييد مفتاح الويب بنطاق المنصة', cmd: [], note: 'Google Cloud ← APIs & Services ← Credentials ← قيود HTTP referrer على نطاق مُكتسَب' },
    { t: 'إضافة المنشأة إلى السجل', cmd: ['node scripts/tenant-provision.mjs registry --id ' + a.id + ' --name ' + q(a.name) + ' --plan ' + a.plan + ' --owner ' + a.owner + ' --sdk sdkconfig.json'], note: 'ثم طلب دمج يعتمده المالك' },
    { t: 'إعداد الخادم للمنشأة', cmd: [], note: 'متغيرات Render: إضافة {"id":"' + a.id + '","projectId":"' + P + '","plan":"' + a.plan + '","apiKeyEnv":"FB_KEY_' + K + '","zatcaKeyEnv":"ZATCA_KEY_' + K + '"} إلى MQ_TENANTS_JSON، ثم FB_KEY_' + K + ' = مفتاح الويب، وZATCA_KEY_' + K + ' = سر عشوائي جديد (32+ حرفًا، لا يُعاد استخدام سر منشأة أخرى) — مثل: openssl rand -base64 48. اختياريًا للوحة مُكتسَب (تغيير حالة الاشتراك بضغطة): أضف "saEnv":"SA_OPS_' + K + '" ومحتوى حساب خدمة بدور Cloud Datastore User في هذا المشروع (gcloud iam service-accounts create mithqal-ops --project=' + P + ')' },
    { t: 'النسخ الليلي للمنشأة', cmd: ['gcloud iam service-accounts create mithqal-backup --project=' + P, 'gcloud projects add-iam-policy-binding ' + P + ' --member=serviceAccount:mithqal-backup@' + P + '.iam.gserviceaccount.com --role=roles/datastore.viewer', 'gcloud iam service-accounts keys create sa-' + a.id + '.json --iam-account=mithqal-backup@' + P + '.iam.gserviceaccount.com'], note: 'أسرار المستودع: FIREBASE_SERVICE_ACCOUNT_' + K + ' = محتوى sa-' + a.id + '.json (ثم احذف الملف)، وBACKUP_KEY_' + K + ' = سر تشفير مستقل (12+ حرفًا). سير النسخ الليلي يلتقط المنشأة من السجل تلقائيًا' },
    { t: 'فتح «الإعداد الأول» لمالك المنشأة', cmd: [], note: 'الرابط: ' + '<موقع مُكتسَب>/?t=' + a.id + ' — ينشئ المالك حسابه ومنشأته بنفسه' }
  ];
}

/** يبني ملف السجل من مخرجات sdkconfig — يعيد { cfg } أو { error } */
export function registryEntry(a, sdkText) {
  let sdk; try { const m = String(sdkText).match(/\{[\s\S]*\}/); sdk = JSON.parse(m ? m[0] : sdkText); } catch { return { error: 'تعذّرت قراءة sdkconfig' }; }
  if (sdk.projectId !== projectIdOf(a.id)) return { error: 'مشروع sdkconfig (' + sdk.projectId + ') لا يطابق ' + projectIdOf(a.id) };
  const cfg = { id: a.id, name: String(a.name).trim(), plan: a.plan, region: REGION, status: 'active', collection: 'platform',
    firebase: { apiKey: sdk.apiKey, authDomain: sdk.authDomain, projectId: sdk.projectId, storageBucket: sdk.storageBucket || '', messagingSenderId: sdk.messagingSenderId || '', appId: sdk.appId || '' } };
  const e = tenantConfigError(cfg); return e ? { error: e } : { cfg };
}

function parse(argv) { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k.startsWith('--')) { a[k.slice(2)] = argv[i + 1]; i++; } else a._.push(k); } return a; }

async function main() {
  const a = parse(process.argv.slice(2)), cmd = a._[0];
  if (cmd === 'status') {
    const r = statusPlan(a); if (r.error) { console.error(r.error); process.exit(2); }
    r.steps.forEach((s, i) => { console.log(`\n${i + 1}) ${s.t}`); s.cmd.forEach(c => console.log('   $ ' + c)); if (s.note) console.log('   ↳ ' + s.note); });
    return;
  }
  const errs = validateArgs(a); if (!['plan', 'registry'].includes(cmd)) errs.unshift('الأمر: plan | registry | status');
  if (errs.length) { console.error(errs.join('\n')); process.exit(2); }
  if (cmd === 'plan') {
    provisionPlan(a).forEach((s, i) => { console.log(`\n${i + 1}) ${s.t}`); (s.cmd || []).forEach(c => console.log('   $ ' + c)); if (s.note) console.log('   ↳ ' + s.note); });
    return;
  }
  if (!a.sdk || !fs.existsSync(a.sdk)) { console.error('--sdk: ملف sdkconfig.json غير موجود'); process.exit(2); }
  const r = registryEntry(a, fs.readFileSync(a.sdk, 'utf8')); if (r.error) { console.error(r.error); process.exit(1); }
  const out = path.join(root, 'public', 'tenants', a.id + '.json');
  if (fs.existsSync(out)) { console.error('موجود مسبقًا: ' + out + ' — لا يُستبدل تلقائيًا'); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify(r.cfg, null, 2) + '\n'); console.log('✓ ' + out);
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
