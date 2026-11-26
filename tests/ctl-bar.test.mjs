/**
 * v56.23 — G2: النموذج 2 «شريط التحكم» (المرحلة 1 — المحاسبة). معطّل افتراضيًا، وتوافق رجعي.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('G2: شريط التحكم معطّل افتراضيًا لكل منشأة قائمة', () => {
  assert.equal(E.ctlBarOn(null), false);
  assert.equal(E.ctlBarOn({}), false);
  assert.equal(E.ctlBarOn({ ctlBar: {} }), false);
  assert.equal(E.ctlBarOn({ ctlBar: { on: false } }), false);
});

test('G2: يعمل فقط بالتفعيل الصريح', () => {
  assert.equal(E.ctlBarOn({ ctlBar: { on: true, at: '2026-11-26T00:00:00Z' } }), true);
});
