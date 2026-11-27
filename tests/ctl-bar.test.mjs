/**
 * v56.23 — G2: النموذج 2 «شريط التحكم» (المرحلة 1 — المحاسبة). معطّل افتراضيًا، وتوافق رجعي.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('G2 (v56.38 — قرار المالك U1): شريط التحكم افتراضي لكل منشأة', () => {
  assert.equal(E.ctlBarOn(null), true);
  assert.equal(E.ctlBarOn({}), true);
  assert.equal(E.ctlBarOn({ ctlBar: {} }), true);
  assert.equal(E.ctlBarOn({ ctlBar: { on: true, at: '2026-11-26T00:00:00Z' } }), true);
});

test('G2: الإيقاف الصريح يعيد الشكل السابق', () => {
  assert.equal(E.ctlBarOn({ ctlBar: { on: false } }), false);
});
