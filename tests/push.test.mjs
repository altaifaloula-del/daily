// v45.9 — إرسال ملخصات الإغلاق: المستلمون من بيانات المنشأة لا من الجهاز، ولا سيل في التشغيل الأول، ولا تكرار
import test from 'node:test';
import assert from 'node:assert/strict';
import { recipients, plan } from '../scripts/push-lib.mjs';
import { buildEngine } from './build-engine.mjs';

const E = await buildEngine();
const B = [{ id: 'b1', name: 'طيبة', isActive: true }, { id: 'b2', name: 'النسيم', isActive: true }];
const users = [{ id: 'u1', name: 'المالك', email: 'Owner@x.sa', role: 'system_admin' }, { id: 'u2', name: 'منى', email: 'acc@x.sa', role: 'accountant' },
  { id: 'u3', name: 'خالد', email: 'bm@x.sa', role: 'branch_manager', branchId: 'b1' }, { id: 'u4', name: 'سارة', email: 'off@x.sa', role: 'accountant' }];
const org = (on) => ({ branches: B, users, closeAlerts: { on, varMax: 10 } });
const members = { 'owner@x.sa': { role: 'system_admin' }, 'acc@x.sa': { role: 'accountant' }, 'bm@x.sa': { role: 'branch_manager', branchId: 'b1' }, 'off@x.sa': { role: 'accountant', active: false } };
const tokens = ['owner@x.sa', 'acc@x.sa', 'bm@x.sa', 'off@x.sa', 'ghost@x.sa'].map((e, i) => ({ id: 't' + i, email: e, token: 'tok' + i }));
const sh = (id, b, diff) => ({ id, branchId: b, devName: 'ك1', status: 'closed', closedAt: new Date().toISOString(), closedBy: 'أحمد', expected: 1000, counted: 1000 + diff, diff, n: 5, total: 900 });

test('المستلمون: حسب الدور في بيانات المنشأة — مدير الفرع والعضو الموقوف وغير المعروف مستبعدون', () => {
  const R = recipients(org(true), members, tokens, E);
  assert.deepEqual(R.map(r => r.email).sort(), ['acc@x.sa', 'owner@x.sa']);
  assert.equal(recipients(org(false), members, tokens, E).length, 0, 'الإعداد مغلق ⇒ لا أحد');
  const promo = recipients(org(true), { ...members, 'bm@x.sa': { role: 'branch_manager', branchId: 'b1' } }, [{ id: 'x', email: 'bm@x.sa', token: 't' }], E);
  assert.equal(promo.length, 0, 'لا يرفع الجهاز صلاحيته');
});

test('الخطة: التشغيل الأول يسجّل القائم دون إرسال، ثم يُرسل الجديد مرة واحدة فقط، والفرق فوق الحد تنبيه مستقل', () => {
  const R = recipients(org(true), members, tokens, E);
  const ops1 = { posShifts: [sh('s1', 'b1', 0)], posOrders: [], closings: [] };
  const p1 = plan(org(true), ops1, R, [], E, true);
  assert.equal(p1.msgs.length, 0); assert.ok(p1.sent.length >= 2);
  const ops2 = { ...ops1, posShifts: [...ops1.posShifts, sh('s2', 'b2', -40)] };
  const p2 = plan(org(true), ops2, R, p1.sent, E, false);
  const tags = p2.msgs.map(m => m.tokenId + ':' + m.tag).sort();
  assert.deepEqual(tags, ['t0:z:sh:s2', 't0:z:var:s2', 't1:z:sh:s2', 't1:z:var:s2']);
  assert.match(p2.msgs.find(m => m.tag === 'z:var:s2').title, /عجز نقدي 40\.00/);
  const p3 = plan(org(true), ops2, R, p2.sent, E, false);
  assert.equal(p3.msgs.length, 0, 'لا تكرار');
});
