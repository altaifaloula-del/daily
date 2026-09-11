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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

let env;
const OWNER = 'owner@test.com';      // مدير (ضمن platform/admins)
const STAFF = 'staff@test.com';      // عضو نشط غير مدير (بلا scope/فرع — توافق قديم)
const FROZEN = 'frozen@test.com';    // عضوية موقوفة
const GHOST = 'ghost@test.com';      // موثّق بلا عضوية
const CENTRAL = 'central@test.com';  // عضو مركزي scope:'all' (محاسب/إدارة مالية)
const BR_A = 'cashierA@test.com';    // كاشير الفرع A فقط
const BR_B = 'cashierB@test.com';    // كاشير الفرع B فقط
const REGIONAL = 'regional@test.com'; // مدير إقليمي مُسنَد للفرع A فقط (ضمن branchIds)

const db = (ctx) => ctx.firestore();
const owner = () => env.authenticatedContext('u-owner', { email: OWNER }).firestore();
const staff = () => env.authenticatedContext('u-staff', { email: STAFF }).firestore();
const frozen = () => env.authenticatedContext('u-frozen', { email: FROZEN }).firestore();
const ghost = () => env.authenticatedContext('u-ghost', { email: GHOST }).firestore();
const central = () => env.authenticatedContext('u-central', { email: CENTRAL }).firestore();
const brA = () => env.authenticatedContext('u-brA', { email: BR_A }).firestore();
const brB = () => env.authenticatedContext('u-brB', { email: BR_B }).firestore();
const regional = () => env.authenticatedContext('u-regional', { email: REGIONAL }).firestore();
const noEmail = () => env.authenticatedContext('u-anonlike').firestore(); // مصادق بلا بريد ≈ مجهول
const visitor = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
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

test('العضو النشط يقرأ ويكتب بيانات التشغيل (ومستندات التقسيم)', async () => {
  await assertSucceeds(getDoc(doc(staff(), 'platform', 'rms8_ops')));
  await assertSucceeds(setDoc(doc(staff(), 'platform', 'rms8_ops'), { value: '{"x":1}', parts: 1 }));
  await assertSucceeds(setDoc(doc(staff(), 'platform', 'rms8_files__0'), { chunk: 'abc' }));
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

test('قائمة المدراء: تُقرأ للموثّقين ولا يعدّلها غير المدير', async () => {
  await assertSucceeds(getDoc(doc(ghost(), 'platform', 'admins')));
  await assertFails(updateDoc(doc(staff(), 'platform', 'admins'), { emails: [STAFF] }));
  await assertSucceeds(updateDoc(doc(owner(), 'platform', 'admins'), { emails: [OWNER] }));
});

test('أي مجموعة خارج platform/members مرفوضة حتى للمدير', async () => {
  await assertFails(getDoc(doc(owner(), 'secrets', 'x')));
  await assertFails(setDoc(doc(owner(), 'secrets', 'x'), { a: 1 }));
});

test('التمهيد: إنشاء قائمة المدراء عند غيابها يقبل بريد المنشئ فقط', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(db(ctx), 'platform', 'admins')); });
  // محاولة تنصيب الغير مرفوضة
  await assertFails(setDoc(doc(ghost(), 'platform', 'admins'), { emails: [GHOST, 'evil@test.com'] }));
  // أول داخل ينصّب نفسه فقط — مقبول
  await assertSucceeds(setDoc(doc(ghost(), 'platform', 'admins'), { emails: [GHOST] }));
  // وبعد وجودها لا يُعاد إنشاؤها/تعديلها من غير مدير قائم
  await assertFails(setDoc(doc(staff(), 'platform', 'admins'), { emails: [STAFF] }));
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

test('rms8_pulse: أي عضو نشط يقرأ/يكتب، لكن لا يُقلَّص سجل audit إلا من مدير', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(db(ctx), 'platform', 'rms8_pulse'), { presence: {}, audit: [{ a: 1 }, { a: 2 }, { a: 3 }] });
  });
  await assertSucceeds(getDoc(doc(brA(), 'platform', 'rms8_pulse')));
  // إضافة حدث جديد (المصفوفة تكبر) — مقبول من عضو عادي
  await assertSucceeds(setDoc(doc(brA(), 'platform', 'rms8_pulse'), { presence: {}, audit: [{ a: 4 }, { a: 1 }, { a: 2 }, { a: 3 }] }));
  // تقليص/مسح السجل من عضو عادي — مرفوض
  await assertFails(setDoc(doc(brB(), 'platform', 'rms8_pulse'), { presence: {}, audit: [{ a: 1 }] }));
  // المدير وحده يقدر يقلّص السجل عند الحاجة
  await assertSucceeds(setDoc(doc(owner(), 'platform', 'rms8_pulse'), { presence: {}, audit: [] }));
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
