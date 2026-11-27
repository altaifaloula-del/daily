/**
 * v56.47 (P4) — قوائم أسعار تطبيقات التوصيل: المطعم يحدد السعر ويختلف حسب التطبيق (المبيعات بالإجمالي كما هي).
 * الأرقام وهمية: منتج سعره في المطعم 20 وفي تطبيق «تجريبي أ» 23، ومنتج بلا سعر تطبيق 10.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const P = [{ id: 'p1', name: 'وجبة', sellPrice: 20, appPrices: { appA: 23 } }, { id: 'p2', name: 'مشروب', sellPrice: 10 }];
const cart = () => [{ key: 'l1', productId: 'p1', name: 'وجبة', price: 20, qty: 2, note: '' }, { key: 'l2', productId: 'p2', name: 'مشروب', price: 10, qty: 1, note: '' }];
const APPS = [{ id: 'appA', n: 'تجريبي أ' }, { id: 'appB', n: 'تجريبي ب' }];
const org = (x = {}) => ({ products: P, posCfg: { appPrices: true }, ...x });
const NOW = new Date('2026-03-10T12:00:00Z');

test('بلا قائمة: التسعير كما كان حرفيًا (سعر السلة)', () => {
  const a = E.posPriceCart(cart(), P, [], { now: NOW }), b = E.posPriceCart(cart(), P, [], { now: NOW, priceList: '' });
  assert.deepEqual(a, b); assert.deepEqual(a.lines.map(l => l.price), [20, 10]); assert.equal(a.sub, 50);
  assert.equal(E.posAppPricesOn({}), false); assert.equal(E.posAppPricesOn({ posCfg: {} }), false);
});

test('بالقائمة: السعر من appPrices وإلا sellPrice — قبل العروض', () => {
  const r = E.posPriceCart(cart(), P, [], { now: NOW, priceList: 'appA' });
  assert.deepEqual(r.lines.map(l => l.price), [23, 10]); assert.equal(r.sub, 56);
  assert.equal(E.posListPrice(P[0], 'appA'), 23); assert.equal(E.posListPrice(P[0], 'appB'), 20); assert.equal(E.posListPrice(P[1], 'appA'), 10);
  assert.equal(E.posListPrice({ id: 'x' }, 'appA', 7), 7, 'منتج محذوف: سعر السطر');
  // العرض بالنسبة يُحسب على سعر القائمة
  const promo = { id: 'pr1', name: 'عرض 10%', type: 'pct', scope: 'all', value: 10 };
  const w = E.posPriceCart(cart(), P, [promo], { now: NOW, priceList: 'appA' }), w0 = E.posPriceCart(cart(), P, [promo], { now: NOW });
  assert.equal(w0.lines[0].disc, 4); assert.equal(w.lines[0].disc, 4.6, '10% من 2 × 23');
});

test('تطابق قائمة الأسعار مع الدفع (مع التفعيل فقط)', () => {
  const app = (id) => [{ m: 'app', appId: id, amount: '56' }];
  assert.equal(E.posPriceListErr(org({ posCfg: {} }), '', app('appA'), APPS), '', 'بلا تفعيل لا منع');
  assert.equal(E.posPriceListErr(org(), 'appA', app('appA'), APPS), '');
  assert.match(E.posPriceListErr(org(), 'appA', app('appB'), APPS), /لا تطابق/);
  assert.match(E.posPriceListErr(org(), 'appA', [{ m: 'cash', amount: '56' }], APPS), /الدفع بالتطبيق نفسه/);
  assert.match(E.posPriceListErr(org(), '', app('appA'), APPS), /أسعار خاصة/, 'دفع بتطبيق له أسعار والقائمة «المطعم»');
  assert.equal(E.posPriceListErr(org(), '', app('appB'), APPS), '', 'تطبيق بلا أسعار خاصة: سعر المطعم');
  assert.equal(E.posPriceListErr(org(), '', [{ m: 'cash', amount: '50' }], APPS), '');
  assert.equal(E.posAppHasPrices(P, 'appA'), true); assert.equal(E.posAppHasPrices(P, 'appB'), false);
});
