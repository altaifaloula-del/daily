/* v54.7 — المرحلة 8: دليل المعادلات مطابق للمحرك */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { finDocs } from '../scripts/gen-fin-docs.mjs';
test('FIN_INTEL_FORMULAS.md مطابق لما يولّده المحرك (شغّل node scripts/gen-fin-docs.mjs بعد أي تغيير)', async () => {
  assert.equal(fs.readFileSync(new URL('../PROJECT_AUDIT/FIN_INTEL_FORMULAS.md', import.meta.url), 'utf8'), await finDocs());
});
