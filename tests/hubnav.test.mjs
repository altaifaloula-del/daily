/* v54.9 — كل قسم في المراكز المدمجة قابل للوصول: لا عودة إلى الرئيسية عند اختيار قسم جديد */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
test('كل أقسام المراكز تبويبات معروفة، ومنها أقسام الذكاء المالي الجديدة', () => {
  for (const [h, cfg] of Object.entries(E.HUBS)) { if (h === 'hr') continue;
    for (const v of cfg.views) assert.ok(E.hubTabs(h).includes(v.id) || E.HR_TABS.includes(v.id), h + ':' + v.id); }
  ['cfo', 'finintel', 'cases', 'recs', 'refs', 'profitmx'].forEach(id => assert.ok(E.hubTabs('analytics').includes(id), id));
  assert.ok(E.hubTabs('purchasing').includes('rfq')); assert.ok(E.HR_TABS.includes('hrmaster'));
});
test('الشاشة الرئيسية تعرض المراكز وتسمح بأقسامها من HUBS لا من قوائم يدوية', () => {
  const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  ['analytics', 'reporting', 'purchasing', 'finhub', 'docshub'].forEach(h => assert.match(src, new RegExp("hubTabs\\('" + h + "'\\)\\.includes\\(safeTab\\) && <Hub hubId=\"" + h + "\"")));
  assert.match(src, /Object\.entries\(HUB_BASE\)\.forEach\(\(\[h, b\]\) => \{ if \(h !== 'closehub' && NAV\.some/);
});
