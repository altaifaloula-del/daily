/**
 * v51.3 — المرحلة 07 / S4: قواعد المنشآت المشتركة (firestore.tenant.rules) على المحاكي.
 * الاشتراك النشط يكتب كالمعتاد؛ «للقراءة فقط» و«موقوف» لا يكتبان من أي حساب (حتى المالك) والقراءة باقية؛
 * حالة الاشتراك لا يغيّرها أي عميل.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

let env;
const OWNER = 'owner@t.sa', CASH = 'cash@t.sa';
const as = (e) => env.authenticatedContext('u-' + e, { email: e }).firestore();
const pulse = () => ({ value: '{}', parts: 1, cv: 400000 });
const setStatus = (status) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'mq_control', 'subscription'), { status, plan: 'pro' }));

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'tenant-rules-test', firestore: { rules: fs.readFileSync('firestore.tenant.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [OWNER] });
    await setDoc(doc(d, 'members', OWNER), { email: OWNER, active: true });
    await setDoc(doc(d, 'members', CASH), { email: CASH, active: true, scope: 'branch', branchId: 'A', role: 'cashier' });
    await setDoc(doc(d, 'platform', 'rms8_pulse'), pulse());
  });
});
after(async () => { if (env) await env.cleanup(); });

test('اشتراك نشط (أو بلا مستند حالة): الكتابة كالمعتاد', async () => {
  await assertSucceeds(setDoc(doc(as(CASH), 'platform', 'rms8_pulse'), pulse()));
  await setStatus('active');
  await assertSucceeds(setDoc(doc(as(CASH), 'platform', 'rms8_pulse'), pulse()));
  await assertSucceeds(setDoc(doc(as(OWNER), 'members', 'new@t.sa'), { email: 'new@t.sa', active: true }));
});

for (const st of ['readonly', 'suspended']) {
  test('اشتراك «' + st + '»: لا كتابة من أحد — والقراءة باقية', async () => {
    await setStatus(st);
    await assertFails(setDoc(doc(as(CASH), 'platform', 'rms8_pulse'), pulse()), 'الكاشير');
    await assertFails(setDoc(doc(as(OWNER), 'platform', 'rms8_pulse'), pulse()), 'المالك');
    await assertFails(setDoc(doc(as(OWNER), 'members', 'x@t.sa'), { email: 'x@t.sa', active: true }), 'إضافة عضو');
    await assertFails(deleteDoc(doc(as(OWNER), 'members', CASH)), 'حذف عضو');
    await assertSucceeds(getDoc(doc(as(CASH), 'platform', 'rms8_pulse')), 'القراءة باقية');
    await assertSucceeds(getDoc(doc(as(OWNER), 'members', CASH)));
    await setStatus('active');
  });
}

test('حالة الاشتراك: يقرؤها الأعضاء، ولا يكتبها أي عميل — حتى المالك', async () => {
  await setStatus('readonly');
  await assertSucceeds(getDoc(doc(as(CASH), 'mq_control', 'subscription')));
  await assertFails(getDoc(doc(env.authenticatedContext('u-x', { email: 'stranger@x.sa' }).firestore(), 'mq_control', 'subscription')), 'غير عضو');
  await assertFails(setDoc(doc(as(OWNER), 'mq_control', 'subscription'), { status: 'active', plan: 'enterprise' }), 'المالك لا يرفع حالته أو خطته');
  await assertFails(deleteDoc(doc(as(OWNER), 'mq_control', 'subscription')), 'ولا يحذفها ليتجاوز القيد');
  await setStatus('active');
});
