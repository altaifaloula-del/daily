/* v52.5 — المرحلة J: المساعد الذكي (ملخص بلا بيانات شخصية) + إعدادات التواصل (تمهيد للمرحلة I) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

test('ملخص المساعد: أرقام مجمّعة فقط — لا جوالات ولا أسماء عملاء، والإرسال غير مفعّل', () => {
  const org = { branches: [{ id: 'b1', name: 'طيبة' }], products: [{ id: 'k', name: 'كبسة', sellPrice: 46 }], posPromos: [{ id: 'p', name: 'ترحيب', type: 'pct', value: 10, code: 'HI', active: true }] };
  const ops = { posOrders: [{ id: 'o', date: '2026-11-10', at: '2026-11-10T09:00:00.000Z', branchId: 'b1', total: 46, net: 40, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 46 }], loyalty: { phone: '0551234567', name: 'محمد السري' } }],
    mktCampaigns: [{ id: 'c', no: 'CMP-0001', name: 'عودة', status: 'active', from: '2026-11-01', to: '2026-12-01', promoIds: ['p'], segment: 'all' }] };
  const list = [{ phone: '551234567', name: 'محمد السري', cls: 'new', tags: [], first: '2026-11-10', consent: E.mktConsentOf({}, '551234567') }];
  const D = E.growthDigest(org, ops, list, { from: '2026-11-01', to: '2026-11-30', avg: {} });
  const s = JSON.stringify(D);
  assert.ok(!/551234567|محمد السري/.test(s), 'لا بيانات شخصية في الملخص');
  assert.equal(D.kpis.orders, 1); assert.equal(D.branches[0].name, 'طيبة'); assert.equal(D.segments.new, 1);
  assert.equal(D.campaigns[0].name, 'عودة'); assert.equal(D.promos[0].coupon, true); assert.equal(D.comms.sendingEnabled, false);
  assert.ok(s.length < 150000);
});

test('تنظيف رد المساعد: حقول وحدود ثابتة، ورد ناقص لا يكسر الواجهة', () => {
  const r = E.aiGrowthClean({ answer: 'x'.repeat(5000), points: Array(12).fill('ن'), actions: [{ title: 'حملة', why: 'لأن', where: 'الحملات' }, { why: 'بلا عنوان' }], caveats: ['ق'] });
  assert.equal(r.answer.length, 4000); assert.equal(r.points.length, 8); assert.deepEqual(r.actions, [{ title: 'حملة', why: 'لأن', where: 'الحملات' }]);
  assert.deepEqual(E.aiGrowthClean(null), { answer: '—', points: [], actions: [], caveats: [] });
  assert.ok(E.AI_GROWTH_PRESETS.length >= 4);
});

test('إعدادات التواصل: افتراضيات، الإرسال دائمًا غير مفعّل، والقوالب والمتغيرات وأجزاء SMS وساعات الهدوء', () => {
  const c = E.commsCfgOf({});
  assert.equal(c.provider, ''); assert.equal(c.sendingEnabled, false); assert.equal(c.quietFrom, '22:00'); assert.equal(c.maxPerMonth, 4);
  const c2 = E.commsCfgOf({ mkt: { comms: { provider: 'hack', sendingEnabled: true, quietFrom: '25:99', senderName: 'AlTaifRestaurant', maxPerMonth: 99 } } });
  assert.equal(c2.provider, ''); assert.equal(c2.sendingEnabled, false); assert.equal(c2.quietFrom, '22:00'); assert.equal(c2.senderName.length, 11); assert.equal(c2.maxPerMonth, 30);
  assert.deepEqual(E.commsRender('أهلًا {name}، رصيدك {points} نقطة {x}', { name: 'سارة', points: 120 }), { text: 'أهلًا سارة، رصيدك 120 نقطة {x}', unknown: ['x'] });
  assert.equal(E.commsTplErr({ name: 'ت', ch: 'sms', body: 'مرحبا {foo}' }), 'متغير غير معروف: {foo}');
  assert.equal(E.commsTplErr({ name: 'ت', ch: 'sms', body: 'مرحبا {name}' }), '');
  assert.equal(E.commsTplErr({ name: '', ch: 'sms', body: 'مرحبا' }), 'اسم القالب مطلوب');
  assert.deepEqual(E.smsParts('ا'.repeat(70)), { chars: 70, parts: 1, uni: true });
  assert.deepEqual(E.smsParts('ا'.repeat(71)), { chars: 71, parts: 2, uni: true });
  assert.deepEqual(E.smsParts('a'.repeat(161)), { chars: 161, parts: 2, uni: false });
  const at = (h, m) => { const d = new Date(2026, 10, 20, h, m); return d; };
  assert.equal(E.commsQuiet(c, at(23, 0)), true); assert.equal(E.commsQuiet(c, at(8, 59)), true); assert.equal(E.commsQuiet(c, at(9, 0)), false); assert.equal(E.commsQuiet(c, at(15, 0)), false);
  assert.equal(E.commsQuiet({ quietFrom: '13:00', quietTo: '15:00' }, at(14, 0)), true);
});
