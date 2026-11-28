/**
 * اختبار النظام الرقابي نفسه: أخطاء متعمدة في بيئة مؤقتة يجب أن تكتشفها البوابات وتمنع اعتمادها.
 * لا يمس ملفات المشروع الحقيقية — كل شيء في مجلد مؤقت يُحذف بعد الاختبار.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verdict, STATUS, secretsScan, openCriticalBugs, isUiChange } from '../../scripts/quality-gate.mjs';
import { lint } from './design-lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mq-gate-'));
const R = (id, status, critical = true, mandatory = true) => ({ id, status, critical, mandatory });

test('الحكم: FAIL عند فشل حرج، BLOCKED عند فحص إلزامي لم يُشغَّل، CONDITIONAL عند ملاحظة غير حرجة، PASS عند النجاح الكامل', () => {
  assert.equal(verdict([R('a', 'pass'), R('b', 'fail')]).status, STATUS.FAIL);
  assert.equal(verdict([R('a', 'pass'), R('b', 'not-run')]).status, STATUS.BLOCKED);
  assert.equal(verdict([R('a', 'pass'), R('b', 'fail', false)]).status, STATUS.COND);
  assert.equal(verdict([R('a', 'pass'), R('b', 'n/a')]).status, STATUS.PASS);
  assert.equal(verdict([R('a', 'pass'), R('b', 'not-run', true, false)]).status, STATUS.PASS, 'غير الإلزامي في هذا الوضع لا يمنع');
});

test('الفشل الحرج يغلب على BLOCKED (لا يُخفى الفشل خلف الانتظار)', () => {
  assert.equal(verdict([R('a', 'fail'), R('b', 'not-run')]).status, STATUS.FAIL);
});

test('الانحدار: فحص كان ناجحًا في خط الأساس وفشل الآن ⇒ FAIL حتى لو كان غير حرج', () => {
  const v = verdict([R('x', 'fail', false)], { baseline: [{ id: 'x', status: 'pass' }] });
  assert.equal(v.status, STATUS.FAIL); assert.deepEqual(v.regressions, ['x']);
});

test('خطأ متعمد في محرك التحقق نفسه (حذف فحص التوازن) ⇒ اختباراته تفشل', () => {
  const d = tmp(); const vd = path.join(d, 'validation'); fs.mkdirSync(vd);
  for (const f of ['ledger-validator.mjs', 'scenarios.mjs', 'validator.test.mjs']) fs.copyFileSync(path.join(ROOT, 'tests/validation', f), path.join(vd, f));
  const p = path.join(vd, 'ledger-validator.mjs');
  const src = fs.readFileSync(p, 'utf8');
  const broken = src.replace("if (sDr !== sCr) F.push(", "if (false) F.push(");
  assert.notEqual(broken, src, 'تم إدخال الخطأ');
  fs.writeFileSync(p, broken);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;   // وإلا يعمل كعملية فرعية للمشغّل ويخرج دائمًا بـ 0
  const r = spawnSync(process.execPath, ['--test', path.join(vd, 'validator.test.mjs')], { encoding: 'utf8', env });
  assert.match(r.stdout, /not ok .*balance\.entry/, 'الحالة الفاشلة هي حالة التوازن تحديدًا');
  fs.rmSync(d, { recursive: true, force: true });
  assert.notEqual(r.status, 0, 'يجب أن تفشل الاختبارات عند تعطيل فحص التوازن');
});

test('خطأ متعمد في الهوية (تغيير لون الكحلي) ⇒ design-lint يفشل', () => {
  const d = tmp();
  fs.cpSync(path.join(ROOT, 'brand'), path.join(d, 'brand'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'public', 'brand'), path.join(d, 'public', 'brand'), { recursive: true });
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/ai-team/brand-baseline.json'), 'utf8'));
  assert.equal(lint(d, base).ok, true, 'النسخة السليمة تمر');
  const f = path.join(d, 'brand/mithqal-brand-tokens.css');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('#10294A', '#112233'));
  const r = lint(d, base);
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(r.ok, false); assert.ok(r.critical.some(x => x.includes('--mithqal-navy')));
});

test('خطأ متعمد في SVG (نص برمجي) ⇒ design-lint يفشل', () => {
  const d = tmp();
  fs.cpSync(path.join(ROOT, 'brand'), path.join(d, 'brand'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'public', 'brand'), path.join(d, 'public', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(d, 'public/brand/evil.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>');
  const r = lint(d, JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/ai-team/brand-baseline.json'), 'utf8')));
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(r.ok, false);
});

test('خطأ متعمد: مفتاح خاص مزروع في ملف متتبَّع ⇒ فحص الأسرار يفشل ولا يطبع القيمة', () => {
  const d = tmp();
  execFileSync('git', ['init', '-q', d]);
  const fakeKey = '-----BEGIN ' + 'PRIVATE KEY-----\nAAAAfakefakefake\n-----END ' + 'PRIVATE KEY-----\n';
  fs.writeFileSync(path.join(d, 'leak.txt'), fakeKey);
  fs.writeFileSync(path.join(d, 'ok.txt'), 'لا أسرار هنا');
  execFileSync('git', ['-C', d, 'add', '.']);
  const r = secretsScan(d);
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(r.status, 'fail');
  assert.ok(r.detail[0].includes('leak.txt'));
  assert.ok(!JSON.stringify(r).includes('fakefake'), 'لا تُطبع قيمة السر');
});

test('المستودع الحالي بلا أسرار', () => {
  assert.equal(secretsScan(ROOT).status, 'pass');
});

test('سجل الأخطاء: خطأ حرج بلا حالة إصلاح ⇒ مفتوح يمنع الإصدار', () => {
  const d = tmp(); fs.mkdirSync(path.join(d, 'PROJECT_AUDIT/ERP_V48'), { recursive: true });
  const f = path.join(d, 'PROJECT_AUDIT/ERP_V48/BUGS_AND_ISSUES.md');
  fs.writeFileSync(f, '| BUG-9 | حرجة | محاسبة | خطأ | x | 01 |\n| BUG-8 | حرجة | محاسبة | خطأ — **مُصلح** | x | 01 |\n');
  const r = openCriticalBugs(d);
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(r.status, 'fail'); assert.equal(r.detail.length, 1); assert.ok(r.detail[0].startsWith('BUG-9'));
});

test('اكتشاف تغييرات الواجهة يفعّل مراجعة التصميم', () => {
  assert.equal(isUiChange(['mods/acct/Treasury.jsx']), true);
  assert.equal(isUiChange(['styles.js']), true);
  assert.equal(isUiChange(['docs/X.md', 'tests/a.test.mjs']), false);
});

test('فحوص الإصدار فقط لا تُشغَّل في بوابة التغيير', async () => {
  const { runCheck, CHECKS } = await import('../../scripts/quality-gate.mjs');
  const r = runCheck(CHECKS.find(c => c.id === 'human-approval'), 'change', false);
  assert.equal(r.status, 'n/a');
});

test('v56.61: مسار متصفحات Playwright يتبع PLAYWRIGHT_BROWSERS_PATH (كما يقرؤه Playwright) وإلا المسار الافتراضي', async () => {
  const { pwBrowsersDir } = await import('../../scripts/quality-gate.mjs');
  assert.equal(pwBrowsersDir({ PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-test', HOME: '/home/x' }), path.resolve('/opt/pw-test'));
  assert.match(pwBrowsersDir({ PLAYWRIGHT_BROWSERS_PATH: '0', HOME: '/home/x' }), /node_modules[\\/]playwright-core[\\/]\.local-browsers$/);
  if (process.platform === 'linux') {
    assert.equal(pwBrowsersDir({ HOME: '/home/x' }), '/home/x/.cache/ms-playwright', 'الافتراضي كما كان');
    assert.equal(pwBrowsersDir({ HOME: '/home/x', XDG_CACHE_HOME: '/c' }), '/c/ms-playwright');
  }
});
