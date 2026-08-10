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
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env;
const OWNER = 'owner@test.com';      // مدير (ضمن platform/admins)
const STAFF = 'staff@test.com';      // عضو نشط غير مدير
const FROZEN = 'frozen@test.com';    // عضوية موقوفة
const GHOST = 'ghost@test.com';      // موثّق بلا عضوية

const db = (ctx) => ctx.firestore();
const owner = () => env.authenticatedContext('u-owner', { email: OWNER }).firestore();
const staff = () => env.authenticatedContext('u-staff', { email: STAFF }).firestore();
const frozen = () => env.authenticatedContext('u-frozen', { email: FROZEN }).firestore();
const ghost = () => env.authenticatedContext('u-ghost', { email: GHOST }).firestore();
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
    await setDoc(doc(d, 'platform', 'rms8_ops'), { value: '{}', parts: 1 });
    await setDoc(doc(d, 'platform', 'rms8_org'), { value: '{}', parts: 1 });
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
