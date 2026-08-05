/**
 * اختبارات قواعد أمان Firestore
 * تعمل على محاكي Firebase وتتحقق أن بيانات المنصة محمية فعلاً:
 *  • الزائر غير المصادق لا يقرأ ولا يكتب.
 *  • المستخدم المصادق (دخول مجهول) يقرأ ويكتب مستندات المنصة.
 *  • أي مسار خارج مجموعة platform مرفوض للجميع.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => { if (env) await env.cleanup(); });

test('الزائر غير المصادق لا يستطيع القراءة', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'platform', 'rms8_ops')));
});

test('الزائر غير المصادق لا يستطيع الكتابة', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'platform', 'rms8_ops'), { value: '{}' }));
});

test('المستخدم المصادق يقرأ مستندات المنصة', async () => {
  const db = env.authenticatedContext('anon-user').firestore();
  await assertSucceeds(getDoc(doc(db, 'platform', 'rms8_ops')));
});

test('المستخدم المصادق يكتب مستندات المنصة', async () => {
  const db = env.authenticatedContext('anon-user').firestore();
  await assertSucceeds(setDoc(doc(db, 'platform', 'rms8_org'), {
    value: JSON.stringify({ branches: [] }), parts: 1, updatedAt: Date.now()
  }));
});

test('مستندات القيم المقسّمة مسموحة أيضاً', async () => {
  const db = env.authenticatedContext('anon-user').firestore();
  await assertSucceeds(setDoc(doc(db, 'platform', 'rms8_files__0'), { chunk: 'abc' }));
});

test('أي مجموعة أخرى مرفوضة حتى للمصادق', async () => {
  const db = env.authenticatedContext('anon-user').firestore();
  await assertFails(getDoc(doc(db, 'secrets', 'x')));
  await assertFails(setDoc(doc(db, 'secrets', 'x'), { a: 1 }));
});
