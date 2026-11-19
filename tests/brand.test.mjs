/* v50.4 — حارس الهوية الرسمية MITHQAL ERP: لا ألوان الهوية القديمة في الشاشات والمطبوعات، والملفات الرسمية كما هي في الحزمة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['App.jsx', ...fs.readdirSync(path.join(root, 'mods'), { recursive: true }).filter(f => f.endsWith('.jsx')).map(f => 'mods/' + f)];
test('لا ألوان الهوية القديمة (البني/النحاسي/الإسبريسو) في الشاشات والمطبوعات', () => {
  const OLD = /#(C8A24A|8C6F2C|5a4a1e|4a3f22|14110F|241F1B|efe8d8|d9cba5|e6ddc8|e5dcc5|faf6ee|101D35|0B1F3A|C7A45B)\b/i;
  const bad = files.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').map((l, i) => OLD.test(l) && !/THEME_META|mizan: \{ name/.test(l) ? f + ':' + (i + 1) : null).filter(Boolean));
  assert.deepEqual(bad, []);
});
test('ملف التوكنات والرمز مطابقان للحزمة الرسمية', () => {
  const css = fs.readFileSync(path.join(root, 'brand', 'mithqal-brand-tokens.css'), 'utf8');
  for (const [k, v] of [['navy', '#10294A'], ['gold', '#D9A83E'], ['deep-navy', '#091A30'], ['tech-blue', '#2671B9'], ['white', '#FFFFFF'], ['soft-gray', '#F3F5F8']]) assert.match(css, new RegExp('--mithqal-' + k + ':\\s*' + v));
  const sym = fs.readFileSync(path.join(root, 'public', 'brand', 'mithqal-symbol.svg'), 'utf8');
  for (const d of ['M18 82 L18 24 L50 55 L82 24 L82 82', 'M50 55 L50 82', 'M31 24 L50 42 L69 24']) { assert.ok(sym.includes(d)); assert.ok(fs.readFileSync(path.join(root, 'App.jsx'), 'utf8').includes('d="' + d + '"')); }
  assert.equal(fs.readFileSync(path.join(root, 'public', 'icon.svg'), 'utf8'), fs.readFileSync(path.join(root, 'public', 'brand', 'mithqal-app-icon.svg'), 'utf8'));
});
