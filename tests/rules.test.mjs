/**
 * اختبارات قواعد أمان Firestore — نموذج «العضويات» (المرحلة الأمنية 1 / v7.x)
 * تتحقق على المحاكي أن:
 *  • لا قراءة/كتابة لبيانات المنصة إلا لعضو نشط بحساب موثّق (بريد).
 *  • مستندات الإعدادات (rms8_org*) يكتبها المدراء فقط.
 *  • سجل العضوية يديره المدراء فقط.
 *  • قائمة المدراء تُنشأ مرة واحدة باسم منشئها فقط، ولا يعدّلها إلا مدير.
 *  • أي مسار خارج platform/members مرفوض للجميع.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const OWNER = 'owner@test.com';      // مدير (ضمن platform/admins)
const STAFF = 'staff@test.com';      // عضو نشط غير مدير (بلا scope/فرع — توافق قديم)
const FROZEN = 'frozen@test.com';    // عضوية موقوفة
const GHOST = 'ghost@test.com';      // موثّق بلا عضوية
const CENTRAL = 'central@test.com';  // عضو مركزي scope:'all' (محاسب/إدارة مالية)
const BR_A = 'cashiera@test.com';    // كاشير الفرع A فقط
const BR_B = 'cashierb@test.com';    // كاشير الفرع B فقط
const REGIONAL = 'regional@test.com';
const VIEWER = 'viewer@test.com';     // محاسب للعرض فقط (accountant_view) // مدير إقليمي مُسنَد للفرع A فقط (ضمن branchIds)

const db = (ctx) => ctx.firestore();
const owner = () => env.authenticatedContext('u-owner', { email: OWNER }).firestore();
const staff = () => env.authenticatedContext('u-staff', { email: STAFF }).firestore();
const frozen = () => env.authenticatedContext('u-frozen', { email: FROZEN }).firestore();
const ghost = () => env.authenticatedContext('u-ghost', { email: GHOST }).firestore();
const central = () => env.authenticatedContext('u-central', { email: CENTRAL }).firestore();
const brA = () => env.authenticatedContext('u-brA', { email: BR_A }).firestore();
const brB = () => env.authenticatedContext('u-brB', { email: BR_B }).firestore();
const regional = () => env.authenticatedContext('u-regional', { email: REGIONAL }).firestore();
const viewer = () => env.authenticatedContext('u-viewer', { email: VIEWER }).firestore();
const noEmail = () => env.authenticatedContext('u-anonlike').firestore(); // مصادق بلا بريد ≈ مجهول
const visitor = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.RULES_FILE ? 'rules-tenant-test' : 'rules-test',
    firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') }
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, 'platform', 'admins'), { emails: [OWNER] });
    await setDoc(doc(d, 'members', OWNER), { email: OWNER, active: true });
    await setDoc(doc(d, 'members', STAFF), { email: STAFF, active: true });
    await setDoc(doc(d, 'members', FROZEN), { email: FROZEN, active: false });
    await setDoc(doc(d, 'members', CENTRAL), { email: CENTRAL, active: true, scope: 'all', role: 'accountant' });
    await setDoc(doc(d, 'members', BR_A), { email: BR_A, active: true, scope: 'branch', branchId: 'b-AAA', branchIds: [], role: 'cashier' });
    await setDoc(doc(d, 'members', BR_B), { email: BR_B, active: true, scope: 'branch', branchId: 'b-BBB', branchIds: [], role: 'cashier' });
    await setDoc(doc(d, 'members', VIEWER), { email: VIEWER, active: true, scope: 'all', role: 'accountant_view' });
    await setDoc(doc(d, 'members', REGIONAL), { email: REGIONAL, active: true, scope: 'branch', branchId: '', branchIds: ['b-AAA'], role: 'regional_manager' });
    await setDoc(doc(d, 'platform', 'rms8_ops'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_org'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_dir'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_core'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_br_b-AAA'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_bf_b-AAA'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_br_b-BBB'), { value: '{}', parts: 1 });
  });
});

after(async () => { if (env) await env.cleanup(); });

test('الزائر غير المصادق لا يقرأ ولا يكتب بيانات المنصة', async () => {
  await assertFails(getDoc(doc(visitor(), 'platform', 'rms8_ops')));
  await assertFails(setDoc(doc(visitor(), 'platform', 'rms8_ops'), { value: '{}' }));
});

test('مصادق بلا بريد (يعادل المجهول) مرفوض', async () => {
  await assertFails(getDoc(doc(noEmail(), 'platform', 'rms8_ops')));
  await assertFails(setDoc(doc(noEmail(), 'platform', 'rms8_ops'), { value: '{}' }));
});

test('موثّق بلا عضوية لا يصل للبيانات', async () => {
  await assertFails(getDoc(doc(ghost(), 'platform', 'rms8_ops')));
  await assertFails(setDoc(doc(ghost(), 'platform', 'rms8_ops'), { value: '{}' }));
});

test('العضوية الموقوفة لا تصل للبيانات', async () => {
  await assertFails(getDoc(doc(frozen(), 'platform', 'rms8_ops')));
});

test('العضو النشط يقرأ ويكتب مستند فرعه وأجزاءه بالشكل الحقيقي', async () => {
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_br_b-AAA')));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { value: '{"x":1}', parts: 1, updatedAt: 1 }));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA__0'), { chunk: 'abc' }));
});

test('العضو غير الإداري لا يكتب مستندات الإعدادات rms8_org*', async () => {
  await assertFails(setDoc(doc(staff(), 'platform', 'rms8_org'), { value: '{}' }));
  await assertFails(setDoc(doc(staff(), 'platform', 'rms8_org__0'), { chunk: 'x' }));
});

test('المدير يكتب مستندات الإعدادات', async () => {
  await assertSucceeds(setDoc(doc(owner(), 'platform', 'rms8_org'), { value: '{"branches":[]}', parts: 1 }));
});

test('سجل العضوية: يقرأ العضو سجلّه فقط، ويكتبه المدير فقط', async () => {
  await assertSucceeds(getDoc(doc(staff(), 'members', STAFF)));
  await assertFails(getDoc(doc(staff(), 'members', OWNER)));
  await assertFails(setDoc(doc(staff(), 'members', 'new@test.com'), { email: 'new@test.com', active: true }));
  await assertSucceeds(setDoc(doc(owner(), 'members', 'new@test.com'), { email: 'new@test.com', active: true }));
});

test('قائمة المدراء: تُقرأ للأعضاء فقط ولا يعدّلها غير المدير', async () => {
  await assertSucceeds(getDoc(doc(staff(), 'platform', 'admins')));
  await assertFails(getDoc(doc(ghost(), 'platform', 'admins')));     // موثّق بلا عضوية لا يرى بريد المدراء
  await assertFails(getDoc(doc(visitor(), 'platform', 'admins')));
  await assertFails(updateDoc(doc(staff(), 'platform', 'admins'), { emails: [STAFF] }));
  await assertSucceeds(updateDoc(doc(owner(), 'platform', 'admins'), { emails: [OWNER] }));
});

test('أي مجموعة خارج platform/members مرفوضة حتى للمدير', async () => {
  await assertFails(getDoc(doc(owner(), 'secrets', 'x')));
  await assertFails(setDoc(doc(owner(), 'secrets', 'x'), { a: 1 }));
});

test('التمهيد: إنشاء قائمة المدراء عند غيابها يقبل بريد المنشئ فقط', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(db(ctx), 'platform', 'admins')); });
  // غياب القائمة يُقرأ لأي موثّق (يحتاجه التمهيد ليعرف أنها غير موجودة)
  await assertSucceeds(getDoc(doc(ghost(), 'platform', 'admins')));
  // محاولة تنصيب الغير مرفوضة
  await assertFails(setDoc(doc(ghost(), 'platform', 'admins'), { emails: [GHOST, 'evil@test.com'] }));
  // أول داخل ينصّب نفسه فقط — مقبول
  await assertSucceeds(setDoc(doc(ghost(), 'platform', 'admins'), { emails: [GHOST] }));
  // وبعد وجودها لا يُعاد إنشاؤها/تعديلها من غير مدير قائم
  await assertFails(setDoc(doc(staff(), 'platform', 'admins'), { emails: [STAFF] }));
  // إعادة القائمة الأصلية حتى لا تتأثر الاختبارات اللاحقة بترتيب التنفيذ
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(db(ctx), 'platform', 'admins'), { emails: [OWNER] }); });
});

/* ===== المرحلة الأمنية 2: عزل الفروع + كتم أسرار المنشأة (أُضيفت بعد تدقيق HR م٠) ===== */

test('rms8_org: القراءة للمركزيين والمدراء فقط — الفرعي والعضو القديم بلا scope يُرفَضان', async () => {
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_org')));
  await assertSucceeds(getDoc(doc(owner(), 'platform', 'rms8_org')));
  await assertFails(getDoc(doc(brA(), 'platform', 'rms8_org')));
  await assertFails(getDoc(doc(staff(), 'platform', 'rms8_org'))); // عضو قديم بلا حقل scope — لا يُفترض له وصول مركزي
});

test('rms8_core: تشغيل مركزي — للمركزيين/المدراء فقط قراءةً وكتابةً', async () => {
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_core')));
  await assertSucceeds(setDoc(doc(central(), 'platform', 'rms8_core'), { value: '{"x":1}', parts: 1 }));
  await assertFails(getDoc(doc(brA(), 'platform', 'rms8_core')));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_core'), { value: '{}', parts: 1 }));
});

test('rms8_dir: يقرؤه أي عضو نشط، لكن يكتبه المدراء فقط', async () => {
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_dir')));
  await assertSucceeds(getDoc(doc(staff(), 'platform', 'rms8_dir')));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_dir'), { value: '{}', parts: 1 }));
  await assertFails(setDoc(doc(central(), 'platform', 'rms8_dir'), { value: '{}', parts: 1 }));
  await assertSucceeds(setDoc(doc(owner(), 'platform', 'rms8_dir'), { value: '{}', parts: 1 }));
});

test('عزل الفروع: كاشير الفرع A يصل لمستند فرعه فقط، لا فرع B', async () => {
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_br_b-AAA')));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { value: '{"x":1}', parts: 1 }));
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_bf_b-AAA')));
  await assertFails(getDoc(doc(brA(), 'platform', 'rms8_br_b-BBB')));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-BBB'), { value: '{}', parts: 1 }));
});

test('عزل الفروع: كاشير الفرع B لا يصل لمستند الفرع A، ولا لمستندات التقسيم التابعة له', async () => {
  await assertFails(getDoc(doc(brB(), 'platform', 'rms8_br_b-AAA')));
  await assertFails(getDoc(doc(brB(), 'platform', 'rms8_bf_b-AAA')));
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_br_b-AAA__0'), { chunk: 'x' }));
});

test('v52.7 فواتير نقطة البيع الشهرية: صلاحيتها صلاحية الفرع — الفرع A يقرأ ويكتب شهره، والفرع B لا، والمركز يقرأ، والاسم المخالف مرفوض', async () => {
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_pos_b-AAA_202611'), { value: '{"orders":[]}', parts: 1, updatedAt: 1 }));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_pos_b-AAA_202611__v1abc_0'), { chunk: 'abc' }));
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_pos_b-AAA_202611')));
  await assertFails(getDoc(doc(brB(), 'platform', 'rms8_pos_b-AAA_202611')));
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_pos_b-AAA_202612'), { value: '{}', parts: 1 }));
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_pos_b-AAA_202611__v1abc_0'), { chunk: 'x' }));
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_pos_b-AAA_202611')));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_pos_b-AAA_2026-11'), { value: '{}', parts: 1 }));   // شهر بغير الصيغة = اسم غير معروف
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_pos_b-AAA'), { value: '{}', parts: 1 }));
});

test('عزل الفروع: مدير إقليمي مُسنَد لفرع A فقط يصل له لا لفرع B', async () => {
  await assertSucceeds(getDoc(doc(regional(), 'platform', 'rms8_br_b-AAA')));
  await assertFails(getDoc(doc(regional(), 'platform', 'rms8_br_b-BBB')));
});

test('عزل الفروع: المركزي والمدير يصلان لكل الفروع', async () => {
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_br_b-AAA')));
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_br_b-BBB')));
  await assertSucceeds(getDoc(doc(owner(), 'platform', 'rms8_br_b-BBB')));
  await assertSucceeds(setDoc(doc(central(), 'platform', 'rms8_br_b-BBB'), { value: '{"y":1}', parts: 1 }));
});

test('rms8_pulse: يُكتب بالشكل الحقيقي فقط ({parts, updatedAt, value})', async () => {
  const pulse = (o) => ({ value: JSON.stringify(o), parts: 1, updatedAt: Date.now() });
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_pulse')));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_pulse'), pulse({ presence: {}, audit: [{ a: 1 }] })));
  // الشكل غير الحقيقي (حقول مباشرة) مرفوض. حماية محتوى audit نفسه تحتاج نقل السجل إلى مجموعة مستقلة — غير مغطاة هنا.
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_pulse'), { presence: {}, audit: [] }));
});

test('v34.6: أجزاء المستند المُصدَّرة «__<نسخة>_<رقم>» ورأس بحقل ver — بنفس عزل الفروع', async () => {
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA__mw6hcaesg2j_0'), { chunk: 'x' }));
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_br_b-AAA__mw6hcaesg2j_0')));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { parts: 2, updatedAt: Date.now(), value: '', ver: 'mw6hcaesg2j' }));
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_br_b-AAA__mw6hcaesg2j_0'), { chunk: 'x' }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA__mw6hcaesg2j_0'), { chunk: 'x', extra: 1 }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { parts: 2, updatedAt: Date.now(), value: '', ver: 5 }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { parts: 2, updatedAt: Date.now(), value: '', ver: 'x'.repeat(30) }));
});

test('rms8_loy (v34.0): نقاط الولاء مشتركة — يقرؤها ويكتبها كاشير أي فرع بالشكل الحقيقي، ولا يكتبها «عرض فقط» ولا الزائر', async () => {
  const loy = (o) => ({ value: JSON.stringify(o), parts: 1, updatedAt: Date.now() });
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_loy'), loy({ members: {}, tx: [{ id: 'o1:e', phone: '551234567', pts: 5 }] })));
  await assertSucceeds(getDoc(doc(brB(), 'platform', 'rms8_loy')));
  await assertSucceeds(setDoc(doc(brB(), 'platform', 'rms8_loy__0'), { chunk: 'x' }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_loy'), { members: {}, tx: [] }));
  await assertFails(setDoc(doc(viewer(), 'platform', 'rms8_loy'), loy({ members: {}, tx: [] })));
  await assertFails(getDoc(doc(visitor(), 'platform', 'rms8_loy')));
  await assertFails(getDoc(doc(ghost(), 'platform', 'rms8_loy')));
});

/* ===== v28.0 — وحدة تقييم العملاء بالـ QR (qr_branches / qr_feedback) ===== */
const RATINGS = { quality: 5, taste: 4, temp: 4, size: 5, staff: 3, speed: 2, pro: 4, clean: 5, vibe: 4, comfort: 4 };
const fbDoc = (over) => ({ branchId: 'b-AAA', ratings: { ...RATINGS }, comment: 'ممتاز', tableNo: '7', invoiceNo: null, source: 'qr', createdAt: serverTimestamp(), ...over });

test('QR: تهيئة بيانات الوحدة', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, 'platform', 'admins'), { emails: [OWNER] });   // اختبار التمهيد أعلاه يستبدل قائمة المدراء
    await setDoc(doc(d, 'qr_branches', 'b-AAA'), { name: 'فرع أ', company: 'تجربة', active: true });
    await setDoc(doc(d, 'qr_branches', 'b-OFF'), { name: 'فرع موقوف', company: 'تجربة', active: false });
    await setDoc(doc(d, 'qr_feedback', 'fb-A'), { branchId: 'b-AAA', ratings: RATINGS, comment: 'x', tableNo: null, invoiceNo: null, source: 'qr', createdAt: new Date() });
    await setDoc(doc(d, 'qr_feedback', 'fb-B'), { branchId: 'b-BBB', ratings: RATINGS, comment: 'y', tableNo: null, invoiceNo: null, source: 'qr', createdAt: new Date() });
  });
});

test('QR: حالة الفرع تُقرأ علنًا لصفحة العميل، ولا يكتبها إلا المركز', async () => {
  await assertSucceeds(getDoc(doc(visitor(), 'qr_branches', 'b-AAA')));
  await assertFails(setDoc(doc(visitor(), 'qr_branches', 'b-AAA'), { name: 'x', active: true }));
  await assertFails(setDoc(doc(brA(), 'qr_branches', 'b-AAA'), { name: 'x', active: true }));
  await assertFails(setDoc(doc(staff(), 'qr_branches', 'b-AAA'), { name: 'x', active: true }));
  await assertSucceeds(setDoc(doc(central(), 'qr_branches', 'b-AAA'), { name: 'فرع أ', company: 'تجربة', active: true, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(central(), 'qr_branches', 'b-AAA'), { name: 'فرع أ', active: true, extra: 1 }));
});

test('QR: الزائر بلا تسجيل دخول يرسل تقييمًا صحيحًا لفرع مفعّل', async () => {
  await assertSucceeds(addDoc(collection(visitor(), 'qr_feedback'), fbDoc()));
});

test('QR: تُرفض التقييمات المخالفة للشكل أو لفرع موقوف/غير موجود', async () => {
  const v = visitor();
  const { comfort, ...nine } = RATINGS;
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ ratings: { ...RATINGS, taste: 6 } })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ ratings: { ...RATINGS, taste: 4.5 } })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ ratings: nine })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ overall: 5 })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ status: 'resolved' })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ comment: 'x'.repeat(1001) })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ tableNo: '1'.repeat(21) })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ createdAt: new Date() })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ branchId: 'b-OFF' })));
  await assertFails(addDoc(collection(v, 'qr_feedback'), fbDoc({ branchId: 'b-NONE' })));
});

test('QR: قراءة التقييمات لأعضاء الفرع والمركز فقط', async () => {
  await assertFails(getDoc(doc(visitor(), 'qr_feedback', 'fb-A')));
  await assertSucceeds(getDoc(doc(brA(), 'qr_feedback', 'fb-A')));
  await assertFails(getDoc(doc(brA(), 'qr_feedback', 'fb-B')));
  await assertSucceeds(getDoc(doc(regional(), 'qr_feedback', 'fb-A')));
  await assertSucceeds(getDoc(doc(central(), 'qr_feedback', 'fb-B')));
});

test('QR: معالجة الشكوى تعدّل حقول المتابعة فقط ولفرع المستخدم فقط', async () => {
  await assertSucceeds(updateDoc(doc(brA(), 'qr_feedback', 'fb-A'), { status: 'in_progress', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(brA(), 'qr_feedback', 'fb-A'), { status: 'closed' }));
  await assertFails(updateDoc(doc(brA(), 'qr_feedback', 'fb-A'), { 'ratings.taste': 5 }));
  await assertFails(updateDoc(doc(brB(), 'qr_feedback', 'fb-A'), { status: 'resolved' }));
  await assertFails(updateDoc(doc(visitor(), 'qr_feedback', 'fb-A'), { status: 'resolved' }));
});

/* ===== v28.1 — تشديد مستندات المنصة وصفة المدير ===== */
test('v28.1: أسماء المستندات غير المعروفة مرفوضة حتى للمدير', async () => {
  await assertFails(getDoc(doc(owner(), 'platform', 'rms8_secret')));
  await assertFails(setDoc(doc(owner(), 'platform', 'rms8_secret'), { value: '{}', parts: 1 }));
  await assertFails(setDoc(doc(brA(), 'platform', 'random_doc'), { value: '{}', parts: 1 }));
});

test('v28.1: المستندات القديمة (ops/files/hist) للمركز والمدير فقط', async () => {
  await assertFails(getDoc(doc(brA(), 'platform', 'rms8_hist')));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_hist'), { value: '{"closings":[]}', parts: 1 }));
  await assertFails(getDoc(doc(staff(), 'platform', 'rms8_ops')));
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_ops')));
  await assertSucceeds(setDoc(doc(central(), 'platform', 'rms8_hist'), { value: '{"closings":[]}', parts: 1, updatedAt: 1 }));
});

test('v28.1: شكل المستند وسقف الأجزاء', async () => {
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { value: '', parts: 100000, updatedAt: 1 }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { value: '{}', parts: 1, extra: true }));
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA__0'), { chunk: 'x', parts: 1 }));
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_br_b-AAA'), { value: '', parts: 3, updatedAt: 1 }));
});

test('v28.1: أجزاء الدليل مقيدة كالدليل نفسه', async () => {
  await assertFails(setDoc(doc(brA(), 'platform', 'rms8_dir__0'), { chunk: 'x' }));
  await assertSucceeds(setDoc(doc(owner(), 'platform', 'rms8_dir__0'), { chunk: 'x' }));
});

test('v28.1: المدير الموقوف يفقد صلاحياته رغم بقاء بريده في القائمة', async () => {
  const EX = 'exadmin@test.com';
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, 'platform', 'admins'), { emails: [OWNER, EX] });
    await setDoc(doc(d, 'members', EX), { email: EX, active: false });
  });
  const ex = env.authenticatedContext('u-ex', { email: EX }).firestore();
  await assertFails(setDoc(doc(ex, 'members', EX), { email: EX, active: true, scope: 'all' }));
  await assertFails(getDoc(doc(ex, 'platform', 'rms8_org')));
  await assertSucceeds(setDoc(doc(owner(), 'members', 'new2@test.com'), { email: 'new2@test.com', active: true }));
});

/* ===== v29.5 — أدوار العرض فقط ===== */
test('v29.5: المحاسب للعرض فقط يقرأ كل شيء ولا يكتب إلا النبض', async () => {
  await assertSucceeds(getDoc(doc(viewer(), 'platform', 'rms8_core')));
  await assertSucceeds(getDoc(doc(viewer(), 'platform', 'rms8_br_b-AAA')));
  await assertFails(setDoc(doc(viewer(), 'platform', 'rms8_core'), { value: '{"x":1}', parts: 1, updatedAt: 1 }));
  await assertFails(setDoc(doc(viewer(), 'platform', 'rms8_br_b-AAA'), { value: '{"x":1}', parts: 1, updatedAt: 1 }));
  await assertFails(setDoc(doc(viewer(), 'platform', 'rms8_core__0'), { chunk: 'x' }));
  await assertSucceeds(setDoc(doc(viewer(), 'platform', 'rms8_pulse'), { value: '{"presence":{}}', parts: 1, updatedAt: 1 }));
  await assertFails(setDoc(doc(viewer(), 'qr_branches', 'b-AAA'), { name: 'x', company: 'y', active: true }));
  await assertFails(updateDoc(doc(viewer(), 'qr_feedback', 'fb-A'), { status: 'resolved' }));
  // المحاسب الكامل ما زال يكتب
  await assertSucceeds(setDoc(doc(central(), 'platform', 'rms8_core'), { value: '{"y":2}', parts: 1, updatedAt: 2 }));
});

/* ===== v31.3 — التحقق بخطوتين ===== */
const tf = (uid, email) => env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp' } }).firestore();
/* ===== v38.5 — سجل أخطاء الأجهزة المركزي ===== */
const errDoc = (email, x = {}) => ({ at: serverTimestamp(), msg: 'TypeError: x is undefined', stack: 'at f (core.js:1:2)', where: 'المخزون', v: 'v38.5', role: 'cashier', branchId: 'b-AAA', device: 'جوال', email, sig: 'abc123', n: 1, ...x });
test('v38.5: العضو يسجّل خطأ جهازه باسمه فقط وبحقول محدودة؛ والمسؤول وحده يقرأ ويحذف', async () => {
  await assertSucceeds(setDoc(doc(brA(), 'client_errors', 'e1'), errDoc(BR_A)));
  await assertFails(setDoc(doc(brA(), 'client_errors', 'e2'), errDoc(BR_B)), 'لا يكتب باسم غيره');
  await assertFails(setDoc(doc(brA(), 'client_errors', 'e3'), errDoc(BR_A, { msg: 'x'.repeat(401) })), 'الرسالة محدودة');
  await assertFails(setDoc(doc(brA(), 'client_errors', 'e4'), errDoc(BR_A, { closings: [] })), 'لا حقول أخرى');
  await assertFails(setDoc(doc(brA(), 'client_errors', 'e5'), errDoc(BR_A, { at: new Date(0) })), 'الوقت وقت الخادم');
  await assertFails(setDoc(doc(ghost(), 'client_errors', 'e6'), errDoc(GHOST)), 'غير العضو لا يكتب');
  await assertFails(setDoc(doc(visitor(), 'client_errors', 'e7'), errDoc('x@y.z')));
  await assertFails(getDoc(doc(brA(), 'client_errors', 'e1')), 'العضو لا يقرأ السجل');
  await assertFails(getDoc(doc(central(), 'client_errors', 'e1')), 'المركزي غير المسؤول لا يقرأ');
  await assertFails(updateDoc(doc(brA(), 'client_errors', 'e1'), { msg: 'y' }), 'لا تعديل');
  await assertSucceeds(getDoc(doc(owner(), 'client_errors', 'e1')));
  await assertSucceeds(deleteDoc(doc(owner(), 'client_errors', 'e1')));
});
test('v31.3: بلا سياسة لا يتغير شيء', async () => {
  await assertSucceeds(getDoc(doc(owner(), 'platform', 'rms8_org')));
  await assertSucceeds(getDoc(doc(central(), 'platform', 'rms8_core')));
});
test('v31.3: المدير لا يفعّل السياسة على نفسه دون جلسة بخطوتين، ومعها يفعّلها', async () => {
  await assertFails(setDoc(doc(owner(), 'platform', 'security'), { roles: ['accountant'], admins: true, at: 1 }));
  await assertFails(setDoc(doc(central(), 'platform', 'security'), { roles: [], admins: false, at: 1 }));
  await assertFails(setDoc(doc(tf('u-owner', OWNER), 'platform', 'security'), { roles: ['accountant'], admins: true, extra: 1 }));
  await assertSucceeds(setDoc(doc(tf('u-owner', OWNER), 'platform', 'security'), { roles: ['accountant'], admins: true, at: 1 }));
  await assertSucceeds(getDoc(doc(central(), 'platform', 'security')));
});
test('v31.3: الأدوار المُلزَمة تُمنع دون الخطوة الثانية وتصل بها، وغيرها لا يتأثر', async () => {
  await assertFails(getDoc(doc(owner(), 'platform', 'rms8_org')));
  await assertFails(getDoc(doc(central(), 'platform', 'rms8_core')));
  await assertFails(setDoc(doc(central(), 'platform', 'rms8_core'), { value: '{}', parts: 1, updatedAt: 3 }));
  await assertSucceeds(getDoc(doc(tf('u-owner', OWNER), 'platform', 'rms8_org')));
  await assertSucceeds(getDoc(doc(tf('u-central', CENTRAL), 'platform', 'rms8_core')));
  await assertSucceeds(setDoc(doc(tf('u-central', CENTRAL), 'platform', 'rms8_core'), { value: '{}', parts: 1, updatedAt: 3 }));
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_br_b-AAA')));
  await assertSucceeds(getDoc(doc(viewer(), 'platform', 'rms8_core')));
  // سجل العضوية يبقى مقروءًا لصاحبه حتى يكمل التسجيل
  await assertSucceeds(getDoc(doc(central(), 'members', CENTRAL)));
});
test('v31.3: إلغاء السياسة للمدير بجلسة بخطوتين فقط', async () => {
  await assertFails(deleteDoc(doc(owner(), 'platform', 'security')));
  await assertSucceeds(deleteDoc(doc(tf('u-owner', OWNER), 'platform', 'security')));
  await assertSucceeds(getDoc(doc(owner(), 'platform', 'rms8_org')));
});

/* ===== v49.0 — المرحلة 01 (G1-ب): السجلات المالية المستقلة ===== */
const ACCT = 'acct@test.com', ACCT2 = 'acct2@test.com', HO = 'ho@test.com';
const acct = () => env.authenticatedContext('u-acct', { email: ACCT }).firestore();
const acct2 = () => env.authenticatedContext('u-acct2', { email: ACCT2 }).firestore();
const ho = () => env.authenticatedContext('u-ho', { email: HO }).firestore();
const D64 = 'a'.repeat(64);
const fj = (email, over) => ({ date: '2026-11-10', status: 'pending', digest: D64, data: '{"lines":[]}', by: email, at: serverTimestamp(), ...(over || {}) });
async function finSeed(lockedTo) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, 'members', ACCT), { email: ACCT, active: true, scope: 'all', role: 'accountant' });
    await setDoc(doc(d, 'members', ACCT2), { email: ACCT2, active: true, scope: 'all', role: 'finance_department' });
    await setDoc(doc(d, 'members', HO), { email: HO, active: true, scope: 'all', role: 'head_office' });
    if (lockedTo) await setDoc(doc(d, 'fin_periods', 'locks'), { lockedTo, by: OWNER, at: new Date() });
  });
}

test('v49.0 fin_journal: المحاسب ينشئ «بانتظار الاعتماد» فقط، ولا ينشئ مرحّلًا، والكاشير والعرض فقط ممنوعان', async () => {
  await finSeed('2026-10-31');
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'j1'), fj(ACCT)));
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'j2'), fj(ACCT, { status: 'posted' })), 'المرحّل مباشرة للمدير فقط');
  await assertSucceeds(setDoc(doc(owner(), 'fin_journal', 'j3'), fj(OWNER, { status: 'posted' })));
  await assertFails(setDoc(doc(brA(), 'fin_journal', 'j4'), fj(BR_A)));
  await assertFails(setDoc(doc(viewer(), 'fin_journal', 'j5'), fj(VIEWER)));
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'j6'), fj(OWNER)), 'لا ينتحل منشئًا آخر');
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'j7'), { ...fj(ACCT), extra: 1 }), 'شكل صارم');
});

test('v49.0 fin_journal: الفترة المقفلة ممنوعة على الخادم (إنشاءً واعتمادًا)، والفتح يتطلب سببًا من المدير', async () => {
  await finSeed('2026-10-31');
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'l1'), fj(ACCT, { date: '2026-10-31' })), 'يوم الإقفال نفسه مقفل');
  await assertFails(setDoc(doc(owner(), 'fin_journal', 'l2'), fj(OWNER, { status: 'posted', date: '2026-09-15' })), 'حتى المدير');
  await assertFails(setDoc(doc(acct(), 'fin_periods', 'locks'), { lockedTo: '2026-11-30', by: ACCT, at: serverTimestamp() }), 'الإقفال للمدير فقط');
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'locks'), { lockedTo: '2026-11-15', by: OWNER, at: serverTimestamp() }));
  await assertFails(setDoc(doc(owner(), 'fin_periods', 'locks'), { lockedTo: '2026-09-30', by: OWNER, at: serverTimestamp() }), 'الفتح بلا سبب');
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'locks'), { lockedTo: '2026-09-30', by: OWNER, at: serverTimestamp(), reason: 'تصحيح قيد أكتوبر بقرار المالك' }));
  await assertFails(deleteDoc(doc(owner(), 'fin_periods', 'locks')));
});

test('v49.0 fin_journal: الاعتماد انتقال واحد بمعتمِد غير المنشئ، والمحتوى ثابت، ولا حذف ولا تعديل بعد الترحيل', async () => {
  await finSeed('2026-10-31');
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'a1'), fj(ACCT)));
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'a1'), fj(ACCT, { status: 'posted', decidedBy: ACCT, decidedAt: serverTimestamp() })), 'لا يعتمد قيده');
  await assertFails(setDoc(doc(ho(), 'fin_journal', 'a1'), fj(ACCT, { status: 'posted', decidedBy: HO, decidedAt: serverTimestamp() })), 'المكتب الرئيسي ليس معتمِدًا للقيود');
  await assertFails(updateDoc(doc(acct2(), 'fin_journal', 'a1'), { status: 'posted', decidedBy: ACCT2, decidedAt: serverTimestamp(), data: '{"lines":[1]}' }), 'المحتوى ثابت');
  await assertSucceeds(updateDoc(doc(acct2(), 'fin_journal', 'a1'), { status: 'posted', decidedBy: ACCT2, decidedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner(), 'fin_journal', 'a1'), { status: 'rejected', decidedBy: OWNER, decidedAt: serverTimestamp() }), 'المرحّل لا يتغير');
  await assertFails(deleteDoc(doc(owner(), 'fin_journal', 'a1')), 'لا حذف حتى للمدير');
  await assertSucceeds(getDoc(doc(acct(), 'fin_journal', 'a1')));
  await assertFails(getDoc(doc(brA(), 'fin_journal', 'a1')), 'الفروع لا تقرأ القيود');
});

test('v49.0 fin_journal: حذف القيد قبل اعتماده لمنشئه أو للمعتمِد فقط، ولا حذف بعد القرار', async () => {
  await finSeed('2026-10-31');
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'd1'), fj(ACCT)));
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'd2'), fj(ACCT)));
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'd3'), fj(ACCT)));
  await assertFails(deleteDoc(doc(ho(), 'fin_journal', 'd1')), 'ليس منشئه ولا معتمِدًا');
  await assertFails(deleteDoc(doc(brA(), 'fin_journal', 'd1')));
  await assertSucceeds(deleteDoc(doc(acct(), 'fin_journal', 'd1')), 'المنشئ يحذف قيده المعلّق');
  await assertSucceeds(deleteDoc(doc(acct2(), 'fin_journal', 'd2')), 'المعتمِد يحذف المعلّق');
  await assertSucceeds(updateDoc(doc(acct2(), 'fin_journal', 'd3'), { status: 'rejected', decidedBy: ACCT2, decidedAt: serverTimestamp(), reason: 'خطأ في الحساب' }));
  await assertFails(deleteDoc(doc(acct(), 'fin_journal', 'd3')), 'المرفوض لا يُحذف');
  await assertFails(deleteDoc(doc(owner(), 'fin_journal', 'd3')), 'ولا للمدير');
});

test('v49.0 G4 نافذة الترحيل: المدير وحده يفتحها لمدة ≤24 ساعة، وخلالها فقط تُنسخ القيود القديمة بحالتها وفي الفترات المقفلة', async () => {
  await finSeed('2026-10-31');
  const leg = (email, over) => fj(email, { legacy: true, origBy: 'محاسب سابق', date: '2026-03-15', ...(over || {}) });
  const soon = () => Timestamp.fromMillis(Date.now() + 3600e3);
  // قبل فتح النافذة: مرفوض
  await assertFails(setDoc(doc(owner(), 'fin_journal', 'g1'), leg(OWNER, { status: 'posted' })), 'النافذة مغلقة');
  // الفتح للمدير فقط وبمدة ≤ 24 ساعة
  await assertFails(setDoc(doc(acct(), 'fin_periods', 'migration'), { open: true, until: soon(), by: ACCT, at: serverTimestamp() }));
  await assertFails(setDoc(doc(owner(), 'fin_periods', 'migration'), { open: true, until: Timestamp.fromMillis(Date.now() + 48 * 3600e3), by: OWNER, at: serverTimestamp() }), 'أكثر من 24 ساعة');
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'migration'), { open: true, until: soon(), by: OWNER, at: serverTimestamp() }));
  // خلال النافذة: المدير ينسخ المرحّل والمرفوض والمعلّق في فترة مقفلة؛ المحاسب لا
  await assertSucceeds(setDoc(doc(owner(), 'fin_journal', 'g1'), leg(OWNER, { status: 'posted' })));
  await assertSucceeds(setDoc(doc(owner(), 'fin_journal', 'g2'), leg(OWNER, { status: 'rejected', reason: 'مرفوض سابقًا' })));
  await assertSucceeds(setDoc(doc(owner(), 'fin_journal', 'g3'), leg(OWNER, { status: 'pending', date: '2026-11-12' })));
  await assertFails(setDoc(doc(acct(), 'fin_journal', 'g4'), leg(ACCT)), 'الترحيل للمدير فقط');
  await assertFails(setDoc(doc(owner(), 'fin_journal', 'g5'), fj(OWNER, { date: '2026-03-15', status: 'posted' })), 'بلا علامة legacy تبقى قاعدة الإقفال');
  // القيد المعلّق المرحَّل يعتمده المدير (المنشئ الأصلي غيره)، والعلامة ثابتة؛ والمرحّل لا يتغير
  await assertFails(updateDoc(doc(owner(), 'fin_journal', 'g3'), { status: 'posted', decidedBy: OWNER, decidedAt: serverTimestamp(), legacy: false }));
  await assertSucceeds(updateDoc(doc(owner(), 'fin_journal', 'g3'), { status: 'posted', decidedBy: OWNER, decidedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner(), 'fin_journal', 'g1'), { status: 'rejected', decidedBy: OWNER, decidedAt: serverTimestamp() }));
  // بعد الإغلاق: لا ترحيل
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'migration'), { open: false, until: Timestamp.fromMillis(Date.now()), by: OWNER, at: serverTimestamp() }));
  await assertFails(setDoc(doc(owner(), 'fin_journal', 'g6'), leg(OWNER, { status: 'posted' })), 'النافذة أُغلقت');
});

/* ===== v49.0 الخطوة 6: الفواتير والسندات سجلات مستقلة (fin_docs) ===== */
const fd = (kind, email, over) => ({ kind, date: '2026-11-10', digest: D64, data: '{"lines":[]}', prog: '{}', paid: 0, by: email, at: serverTimestamp(), ...(over || {}) });
test('v49.0 fin_docs: الإنشاء بعد الإقفال، والمحتوى ثابت ولا يتغير إلا السداد، والسند لا يُعدَّل ولا يُحذف', async () => {
  await finSeed('2026-10-31');
  await assertSucceeds(setDoc(doc(brA(), 'fin_docs', 'pi_a1'), fd('pi', BR_A)), 'الفرع يسجل فاتورة مورد');
  await assertSucceeds(setDoc(doc(acct(), 'fin_docs', 'si_s1'), fd('si', ACCT)));
  await assertSucceeds(setDoc(doc(acct(), 'fin_docs', 'cv_v1'), fd('cv', ACCT)));
  await assertFails(setDoc(doc(acct(), 'fin_docs', 'pi_old'), fd('pi', ACCT, { date: '2026-10-15' })), 'فترة مقفلة');
  await assertFails(setDoc(doc(acct(), 'fin_docs', 'si_x'), fd('pi', ACCT)), 'النوع يطابق المعرّف');
  await assertFails(setDoc(doc(viewer(), 'fin_docs', 'pi_v'), fd('pi', VIEWER)));
  await assertFails(setDoc(doc(acct(), 'fin_docs', 'pi_n'), fd('pi', ACCT, { paid: -1 })));
  // السداد يغيّر prog وpaid فقط
  await assertSucceeds(updateDoc(doc(acct(), 'fin_docs', 'pi_a1'), { prog: '{"paidAmount":50}', paid: 50, updBy: ACCT, updAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(acct(), 'fin_docs', 'pi_a1'), { data: '{"lines":[9]}', updBy: ACCT, updAt: serverTimestamp() }), 'المحتوى ثابت');
  await assertFails(updateDoc(doc(acct(), 'fin_docs', 'pi_a1'), { date: '2026-11-20', updBy: ACCT, updAt: serverTimestamp() }), 'التاريخ ثابت');
  await assertFails(updateDoc(doc(acct(), 'fin_docs', 'cv_v1'), { prog: '{"x":1}', updBy: ACCT, updAt: serverTimestamp() }), 'السند لا يُعدَّل');
  // الحذف: فاتورة مورد غير مسددة في فترة مفتوحة فقط
  await assertFails(deleteDoc(doc(owner(), 'fin_docs', 'pi_a1')), 'مسدد منها');
  await assertSucceeds(setDoc(doc(acct(), 'fin_docs', 'pi_a2'), fd('pi', ACCT)));
  await assertSucceeds(deleteDoc(doc(acct(), 'fin_docs', 'pi_a2')));
  await assertFails(deleteDoc(doc(owner(), 'fin_docs', 'si_s1')), 'فاتورة المبيعات لا تُحذف');
  await assertFails(deleteDoc(doc(owner(), 'fin_docs', 'cv_v1')), 'السند لا يُحذف');
  await assertSucceeds(getDoc(doc(acct(), 'fin_docs', 'si_s1')));
  await assertFails(getDoc(doc(brA(), 'fin_docs', 'si_s1')), 'الفروع لا تقرأ السجل المركزي');
});

test('v49.0 fin_docs: الترحيل legacy للمدير داخل النافذة فقط وفي الفترات المقفلة', async () => {
  await finSeed('2026-10-31');
  const leg = fd('si', OWNER, { legacy: true, date: '2026-02-01' });
  await assertFails(setDoc(doc(owner(), 'fin_docs', 'si_l1'), leg), 'النافذة مغلقة');
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'migration'), { open: true, until: Timestamp.fromMillis(Date.now() + 3600e3), by: OWNER, at: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(owner(), 'fin_docs', 'si_l1'), leg));
  await assertFails(setDoc(doc(acct(), 'fin_docs', 'si_l2'), fd('si', ACCT, { legacy: true, date: '2026-02-01' })), 'للمدير فقط');
  await assertFails(updateDoc(doc(owner(), 'fin_docs', 'si_l1'), { legacy: false, updBy: OWNER, updAt: serverTimestamp() }), 'العلامة ثابتة');
  await assertSucceeds(setDoc(doc(owner(), 'fin_periods', 'migration'), { open: false, until: Timestamp.fromMillis(Date.now()), by: OWNER, at: serverTimestamp() }));
});

/* v49.0.1 — إصلاح: في الإنتاج توجد سياسة التحقق الثنائي وحد الإصدار (platform/security, platform/release)، فيزيد عدد قراءات القاعدة.
   كانت قاعدة الإنشاء تُقيِّم المسارين (العادي ثم الترحيل) فتتجاوز حد 10 قراءات ⇒ permission-denied رغم صحة الطلب. */
test('v49.0.1 السجلات المستقلة في ظروف الإنتاج (سياسة تحقق ثنائي + حد إصدار): الترحيل والإنشاء والقرار ضمن حد القراءات', async () => {
  await finSeed('2026-10-31');
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, 'platform', 'security'), { roles: ['accountant', 'finance_department'], admins: true, at: 1 });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 10000 });
  });
  const O = () => tf('u-owner', OWNER), A1 = () => tf('u-acct', ACCT), A2 = () => tf('u-acct2', ACCT2);
  const cv = { cv: 490000 };
  try {
    await assertSucceeds(setDoc(doc(O(), 'fin_periods', 'migration'), { open: true, until: Timestamp.fromMillis(Date.now() + 3600e3), by: OWNER, at: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(O(), 'fin_docs', 'pi_p1'), fd('pi', OWNER, { legacy: true, date: '2026-02-01', paid: 120.5, ...cv })), 'ترحيل فاتورة مورد');
    await assertSucceeds(setDoc(doc(O(), 'fin_journal', 'p_j1'), fj(OWNER, { legacy: true, origBy: 'منى', status: 'rejected', date: '2026-02-01', ...cv })), 'ترحيل قيد');
    await assertSucceeds(setDoc(doc(A1(), 'fin_docs', 'pi_p2'), fd('pi', ACCT, cv)), 'إنشاء عادي');
    await assertSucceeds(updateDoc(doc(A1(), 'fin_docs', 'pi_p2'), { prog: '{"paidAmount":5}', paid: 5, updBy: ACCT, updAt: serverTimestamp(), ...cv }));
    await assertSucceeds(setDoc(doc(A1(), 'fin_journal', 'p_j2'), fj(ACCT, cv)));
    await assertSucceeds(updateDoc(doc(A2(), 'fin_journal', 'p_j2'), { status: 'posted', decidedBy: ACCT2, decidedAt: serverTimestamp(), ...cv }));
    await assertSucceeds(setDoc(doc(A1(), 'fin_journal', 'p_j3'), fj(ACCT, cv)));
    await assertSucceeds(deleteDoc(doc(A1(), 'fin_journal', 'p_j3')));
    await assertSucceeds(setDoc(doc(A1(), 'fin_docs', 'pi_p3'), fd('pi', ACCT, cv)));
    await assertSucceeds(deleteDoc(doc(A1(), 'fin_docs', 'pi_p3')));
    await assertFails(setDoc(doc(A1(), 'fin_docs', 'pi_p4'), fd('pi', ACCT, { legacy: true, date: '2026-02-01', ...cv })), 'الترحيل للمدير فقط');
    await assertFails(setDoc(doc(owner(), 'fin_docs', 'pi_p5'), fd('pi', OWNER, cv)), 'المدير بلا تحقق ثنائي مرفوض حين تفرضه السياسة');
  } finally {
    await env.withSecurityRulesDisabled(async (ctx) => { const d = db(ctx);
      await deleteDoc(doc(d, 'platform', 'security')); await deleteDoc(doc(d, 'platform', 'release'));
      await setDoc(doc(d, 'fin_periods', 'migration'), { open: false, until: new Date(), by: OWNER, at: new Date() }); });
  }
});

test('v51.9 صلاحيات التعديل: «ممنوع» على عضوية الخادم يمنع حذف القيد المعلّق وفاتورة المورد — وغيره كما كان', async () => {
  await finSeed('2026-10-31');
  await assertSucceeds(setDoc(doc(acct(), 'fin_journal', 'ed1'), fj(ACCT)));
  await assertSucceeds(setDoc(doc(acct(), 'fin_docs', 'pi_ed1'), fd('pi', ACCT)));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(db(ctx), 'members', ACCT), { email: ACCT, active: true, scope: 'all', role: 'accountant', editDeny: ['je', 'inv'] }));
  await assertFails(deleteDoc(doc(acct(), 'fin_journal', 'ed1')), 'ممنوع من تعديل القيود');
  await assertFails(deleteDoc(doc(acct(), 'fin_docs', 'pi_ed1')), 'ممنوع من تعديل الفواتير');
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(db(ctx), 'members', ACCT), { email: ACCT, active: true, scope: 'all', role: 'accountant', editDeny: [] }));
  await assertSucceeds(deleteDoc(doc(acct(), 'fin_journal', 'ed1')), 'بلا منع يعود كما كان');
  await assertSucceeds(deleteDoc(doc(acct(), 'fin_docs', 'pi_ed1')));
});
