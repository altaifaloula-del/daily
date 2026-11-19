/* v51.9 — صلاحيات التعديل الاختيارية لكل مستخدم: القيود اليدوية وفواتير الموردين */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

test('صلاحيات التعديل: حسب الدور افتراضيًا، والمنح والمنع والحصر فيما أدخله وفي آخر أيام', async () => {
  const E = await buildEngine();
  const roles = Object.entries(E.ROLES);
  const postOnly = roles.find(([, r]) => r.postOnly && r.scope === 'all' && !r.readOnly)[0];
  const editor = roles.find(([k, r]) => E.rolePost(k) && !r.postOnly && !r.admin)[0];
  const admin = roles.find(([, r]) => r.admin)[0];
  const branch = roles.find(([k]) => !E.rolePost(k))[0];
  const rec = { id: 'j1', by: 'سالم', byId: 'u9', createdAt: '2026-11-01T10:00:00Z', date: '2026-11-01' };
  const U = (role, ep, id = 'u1', name = 'أحمد') => ({ id, name, role, ...(ep ? { editPerms: ep } : {}) });
  assert.deepEqual(Object.keys(E.EDIT_KINDS), ['je', 'inv']);
  // الافتراضي = الدور (لا تغيير لأحد)
  assert.equal(E.canEditRec(U(editor), 'je', rec, '2026-11-19'), true);
  assert.equal(E.canEditRec(U(postOnly), 'je', rec, '2026-11-19'), false, 'إدخال بلا تعديل');
  assert.equal(E.canEditRec(U(admin, { je: { mode: 'deny' } }), 'je', rec), true, 'الإدارة دائمًا');
  // المنح لمن يُدخل فقط
  assert.equal(E.canEditRec(U(postOnly, { je: { mode: 'allow' } }), 'je', rec, '2026-11-19'), true, 'منح لموظف محدد');
  assert.equal(E.canEditRec(U(branch, { je: { mode: 'allow' } }), 'je', rec, '2026-11-19'), false, 'المنح لا يرفع من لا يُدخل أصلًا');
  // المنع
  assert.equal(E.canEditRec(U(editor, { inv: { mode: 'deny' } }), 'inv', rec), false); assert.equal(E.canEditRec(U(editor, { inv: { mode: 'deny' } }), 'je', rec, '2026-11-19'), true, 'لكل نوع على حدة');
  // الحصر
  assert.equal(E.canEditRec(U(editor, { je: { mode: 'role', own: true } }), 'je', rec, '2026-11-19'), false, 'ليس ما أدخله');
  assert.equal(E.canEditRec(U(editor, { je: { mode: 'role', own: true } }, 'u9', 'سالم'), 'je', rec, '2026-11-19'), true);
  assert.equal(E.canEditRec(U(postOnly, { je: { mode: 'allow', days: 7 } }), 'je', rec, '2026-11-19'), false, 'أقدم من 7 أيام');
  assert.equal(E.canEditRec(U(postOnly, { je: { mode: 'allow', days: 30 } }), 'je', rec, '2026-11-19'), true);
  assert.deepEqual(E.editPermOf({ editPerms: { je: { mode: 'x', days: '-4' } } }, 'je'), { mode: 'role', own: false, days: 0 }, 'قيم غير صالحة ⇒ الافتراضي');
});
