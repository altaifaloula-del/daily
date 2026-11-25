/* v50.4 — حارس الهوية الرسمية MUKTASAB: لا ألوان الهوية القديمة في الشاشات والمطبوعات، والملفات الرسمية كما هي في الحزمة */
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
  // v56.0 (أمر التصميم — قرار المالك: «النموذج الأول · Refine · Geometric · Flat»): الرمز القديم بالخطوط استُبدل بهندسة الكتل.
  // الحارس الآن يقفل الهندسة الجديدة: مضلعات الرمز في ملف الواجهة = المصدر الموحّد brand-geom.js، ولا نص حي ولا تدرجات في ملفات الشعار.
  // v56.0 (إعادة التسمية) (قرار المالك 2026-11-25): الهوية «مُكتسَب» برمز البوصلة تحل محل رمز M لمثقال. الحارس يقفل هندسة البوصلة الجديدة.
  const sym = fs.readFileSync(path.join(root, 'public', 'brand', 'mithqal-symbol.svg'), 'utf8');
  for (const p of ['50,3 59.5,50 40.5,50', '50,97 40.5,50 59.5,50', '97,50 50,40.5 50,59.5', '3,50 50,59.5 50,40.5']) assert.ok(sym.includes(p), 'مضلع الرمز ' + p);
  assert.match(sym, /<mask [^>]*>[\s\S]*<circle cx="50" cy="50" r="5.5"/, 'المركز المفرّغ');
  assert.match(fs.readFileSync(path.join(root, 'brand-geom.js'), 'utf8'), /MQ_GEOM = Object\.freeze\(\{ c: 50, R: 47, W: 9\.5, r: 30, w: 6, h: 5\.5, minorOpacity: 0\.55 \}\)/);
  assert.match(fs.readFileSync(path.join(root, 'App.jsx'), 'utf8'), /mqSymbolShapes\(\)/, 'مكوّن الواجهة من الهندسة الموحّدة');
  const svgs = fs.readdirSync(path.join(root, 'brand', 'logo'), { recursive: true }).filter(f => f.endsWith('.svg'));
  assert.ok(svgs.length >= 23, 'كل نسخ الشعار موجودة');
  for (const f of svgs) assert.doesNotMatch(fs.readFileSync(path.join(root, 'brand', 'logo', f), 'utf8'), /<text|Gradient|<filter|<image/, f + ' بلا نص حي ولا تدرج ولا مؤثر');
  assert.equal(fs.readFileSync(path.join(root, 'public', 'icon.svg'), 'utf8'), fs.readFileSync(path.join(root, 'public', 'brand', 'mithqal-app-icon.svg'), 'utf8'));
});
