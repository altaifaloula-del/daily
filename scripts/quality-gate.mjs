#!/usr/bin/env node
/**
 * MITHQAL — بوابة الجودة والإصدار (Quality & Release Gate)
 *
 *   node scripts/quality-gate.mjs                 بوابة التغيير (قبل طلب الدمج)
 *   node scripts/quality-gate.mjs --release       بوابة الإصدار (تشترط الموافقة البشرية وعدم وجود أخطاء حرجة مفتوحة)
 *   node scripts/quality-gate.mjs --baseline F    مقارنة بنتيجة سابقة (نجح ← فشل = انحدار = FAIL)
 *   node scripts/quality-gate.mjs --dashboard     يحدّث docs/QUALITY_DASHBOARD.md
 *   node scripts/quality-gate.mjs --self-test     يثبت أن البوابة تكتشف الأخطاء المتعمدة وتمنع الاعتماد
 *   node scripts/quality-gate.mjs --only a,b      تشغيل فحوص محددة
 *
 * الحالات: PASS (0) · CONDITIONAL PASS (0) · FAIL (1) · BLOCKED (2)
 * قاعدة: الفحص الإلزامي الذي لم يُشغَّل (بيئة ناقصة) ≠ نجاح ⇒ BLOCKED. لا يُخفى أي فشل.
 * لا يكتب هذا السكربت في أي قاعدة بيانات، ولا ينشر، ولا يدفع إلى git.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'tests', '.cache', 'quality');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

export const STATUS = { PASS: 'PASS', COND: 'CONDITIONAL PASS', FAIL: 'FAIL', BLOCKED: 'BLOCKED' };

const has = (p) => fs.existsSync(path.join(ROOT, p));
const which = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true; } catch { return false; } };
const git = (...a) => { try { return execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const needDeps = () => has('node_modules/esbuild') && has('node_modules/vite') ? null : 'الاعتماديات غير مثبتة (npm ci)';
const needJava = () => needDeps() || (which('java') ? null : 'Java غير متوفرة لمحاكي Firestore');
const needPw = () => needDeps() || (has('node_modules/playwright') && fs.existsSync(path.join(process.env.HOME || '', '.cache/ms-playwright')) ? null : 'متصفح Playwright غير مثبت');

/** الفحوص. critical: فشله = FAIL. mandatory: الأوضاع التي يجب أن يُشغَّل فيها وإلا BLOCKED. */
export const CHECKS = [
  { id: 'framework', title: 'سلامة إطار الوكلاء والمهارات والوثائق', cat: 'process', critical: true, mandatory: ['change', 'release'], cmd: ['node', '--test', 'tests/ai-team/*.test.mjs'] },
  { id: 'accounting-validation', title: 'محرك التحقق المحاسبي المستقل (سيناريوهات معروفة + أخطاء متعمدة)', cat: 'accounting', critical: true, mandatory: ['change', 'release'], cmd: ['node', '--test', 'tests/validation/validator.test.mjs'] },
  { id: 'engine-validation', title: 'التحقق المستقل من مخرجات buildAccounting الحقيقي', cat: 'accounting', critical: true, mandatory: ['change', 'release'], needs: needDeps, cmd: ['node', '--test', 'tests/validation/engine-adapter.test.mjs'], skipIsNotRun: true },
  { id: 'design-lint', title: 'هوية MITHQAL وملفات SVG (ثابت)', cat: 'design', critical: true, mandatory: ['change', 'release'], cmd: ['node', 'tests/ai-team/design-lint.mjs'] },
  { id: 'secrets', title: 'فحص الأسرار في الملفات المتتبَّعة', cat: 'security', critical: true, mandatory: ['change', 'release'], fn: secretsScan },
  { id: 'build', title: 'بناء الواجهة (vite build)', cat: 'code', critical: true, mandatory: ['change', 'release'], needs: needDeps, cmd: ['npm', 'run', 'build'] },
  { id: 'engine-tests', title: 'اختبارات المحرك والخادم القائمة (npm test)', cat: 'code', critical: true, mandatory: ['change', 'release'], needs: needDeps, cmd: ['npm', 'test'] },
  { id: 'rules', title: 'قواعد Firestore: الصلاحيات والعزل والاستعادة (المحاكي)', cat: 'security', critical: true, mandatory: ['change', 'release'], needs: needJava, cmd: ['npm', 'run', 'test:rules'] },
  { id: 'ui', title: 'اختبارات الواجهة Playwright (جوال وحاسوب، RTL/LTR)', cat: 'design', critical: true, mandatory: ['change', 'release'], uiOnly: true, needs: needPw, cmd: ['npm', 'run', 'test:ui'] },
  { id: 'design-review', title: 'مراجعة التصميم المستقلة (design-quality-auditor)', cat: 'design', critical: true, mandatory: ['change', 'release'], uiOnly: true, fn: designReview },
  { id: 'open-critical-bugs', title: 'لا أخطاء حرجة مفتوحة في سجل الأخطاء', cat: 'process', critical: true, mandatory: ['release'], fn: openCriticalBugs },
  { id: 'human-approval', title: 'الموافقة البشرية الفعلية على الإصدار', cat: 'approval', critical: true, mandatory: ['release'], fn: humanApproval },
];

// ———— الفحوص الداخلية ————
const SECRET_RX = [
  ['مفتاح خاص', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['مفتاح Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['حساب خدمة Google', /"private_key"\s*:\s*"-----BEGIN/],
  ['رمز GitHub', /gh[pousr]_[A-Za-z0-9]{36}/],
  ['مفتاح AWS', /AKIA[0-9A-Z]{16}/],
];
export function secretsScan(root = ROOT) {
  let files = [];
  try { files = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return { status: 'not-run', reason: 'git غير متاح' }; }
  const hits = [];
  for (const f of files) {
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i.test(f) || f === 'package-lock.json') continue;
    let s; try { s = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    for (const [name, rx] of SECRET_RX) if (rx.test(s)) hits.push(`${name} في ${f}`);   // لا تُطبع القيمة أبدًا
  }
  return hits.length ? { status: 'fail', detail: hits } : { status: 'pass', detail: [`${files.length} ملفًا مفحوصًا`] };
}
const BRANCH = () => git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown';
const HEAD = () => git('rev-parse', 'HEAD');
const changedFiles = () => (git('diff', '--name-only', 'main...HEAD') || '').split('\n').filter(Boolean);
export const isUiChange = (files) => files.some(f => /^(mods\/.*\.jsx|styles\.js|index\.html|public\/|brand\/|i18n)/.test(f) || (f === 'App.jsx'));
function designReview() {
  const f = path.join(ROOT, 'docs', 'quality', 'reviews', BRANCH().replace(/[^\w.-]+/g, '_') + '.json');
  if (!fs.existsSync(f)) return { status: 'not-run', reason: 'لا يوجد سجل مراجعة تصميم لهذا الفرع (docs/quality/reviews/<branch>.json)' };
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (r.commit !== HEAD()) return { status: 'not-run', reason: 'سجل المراجعة لالتزام أقدم — أعد المراجعة على آخر التزام' };
  if (r.by === r.author) return { status: 'fail', detail: ['المراجع هو المنفذ نفسه — مخالفة الاستقلالية'] };
  return r.verdict === 'PASS' ? { status: 'pass', detail: [`${r.by} — ${r.date}`] } : { status: 'fail', detail: r.issues || [r.verdict] };
}
export function openCriticalBugs(root = ROOT) {
  const f = path.join(root, 'PROJECT_AUDIT/ERP_V48/BUGS_AND_ISSUES.md');
  if (!fs.existsSync(f)) return { status: 'not-run', reason: 'سجل الأخطاء غير موجود' };
  const open = fs.readFileSync(f, 'utf8').split('\n').filter(l => /^\| BUG-[\w-]+ \| حرجة \|/.test(l) && !/(مُصلح|مصلح|مكتمل|مغلق|مُعالج|منشور)/.test(l)).map(l => l.split('|')[1].trim());
  return open.length ? { status: 'fail', detail: open.map(b => b + ' مفتوح (أو لم يُحدَّث وضعه في السجل)') } : { status: 'pass', detail: ['لا أخطاء حرجة مفتوحة'] };
}
function humanApproval() {
  const dir = path.join(ROOT, 'docs', 'approvals', 'granted');
  const ver = (fs.readFileSync(path.join(ROOT, 'App.jsx'), 'utf8').match(/const APP_VER = '([^']+)'/) || [])[1];
  const f = fs.existsSync(dir) ? fs.readdirSync(dir).find(n => n.includes(ver || '@@')) : null;
  if (!f) return { status: 'not-run', reason: `لا توجد موافقة ممنوحة للإصدار ${ver} في docs/approvals/granted/ — إعداد طلب الموافقة ليس موافقة` };
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  return /^status:\s*APPROVED\s*$/m.test(s) && /^approved_by:\s*\S+/m.test(s) && /^date:\s*\d{4}-\d{2}-\d{2}/m.test(s)
    ? { status: 'pass', detail: [f] } : { status: 'fail', detail: [`${f}: ينقصه status: APPROVED أو approved_by أو date`] };
}

// ———— التشغيل ————
function parseNodeTest(out) {
  const g = (k) => { const m = out.match(new RegExp('^# ' + k + ' (\\d+)', 'm')); return m ? +m[1] : null; };
  return { tests: g('tests'), pass: g('pass'), fail: g('fail'), skipped: g('skipped') };
}
export function runCheck(c, mode, ui) {
  const t0 = Date.now();
  if (!c.mandatory.includes(mode)) return { ...pick(c), status: 'n/a', reason: 'لبوابة الإصدار فقط' };
  if (c.uiOnly && !ui && (c.id === 'design-review' || mode !== 'release')) return { ...pick(c), status: 'n/a', reason: 'لا تغييرات واجهة' };
  const need = c.needs && c.needs();
  if (need) return { ...pick(c), status: 'not-run', reason: need };
  if (c.fn) { const r = c.fn(); return { ...pick(c), ...r, ms: Date.now() - t0 }; }
  const env = { ...process.env, FORCE_COLOR: '0' }; delete env.NODE_TEST_CONTEXT;   // نتيجة اختبار متداخل لا تُبتلع
  const r = spawnSync(c.cmd[0], c.cmd.slice(1), { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, env });
  const out = (r.stdout || '') + (r.stderr || '');
  const counts = parseNodeTest(out);
  let status = r.status === 0 ? 'pass' : 'fail';
  if (status === 'pass' && c.skipIsNotRun && counts.skipped && counts.skipped === counts.tests) status = 'not-run';
  const failLines = out.split('\n').filter(l => /^not ok|✗|Error:/.test(l)).slice(0, 15);
  return { ...pick(c), status, counts, ms: Date.now() - t0, ...(status !== 'pass' ? { detail: failLines.length ? failLines : out.trim().split('\n').slice(-8) } : {}), ...(status === 'not-run' ? { reason: 'كل الحالات متخطاة (البيئة ناقصة)' } : {}) };
}
const pick = (c) => ({ id: c.id, title: c.title, cat: c.cat, critical: c.critical, mandatory: c.mandatory.includes(MODE) });
let MODE = 'change';

/** الحكم — دالة نقية تُختبر في tests/ai-team/gate.test.mjs */
export function verdict(results, { baseline } = {}) {
  const reasons = [];
  const regressions = [];
  if (baseline) for (const r of results) { const b = baseline.find(x => x.id === r.id); if (b && b.status === 'pass' && r.status === 'fail') regressions.push(r.id); }
  const failedCrit = results.filter(r => r.status === 'fail' && r.critical);
  const failedMinor = results.filter(r => r.status === 'fail' && !r.critical);
  const notRun = results.filter(r => r.status === 'not-run' && r.mandatory);
  if (regressions.length) reasons.push('انحدار: ' + regressions.join(', '));
  failedCrit.forEach(r => reasons.push('فشل فحص حرج: ' + r.id));
  if (regressions.length || failedCrit.length) return { status: STATUS.FAIL, reasons, regressions };
  notRun.forEach(r => reasons.push('لم يُشغَّل فحص إلزامي: ' + r.id + ' — ' + (r.reason || '')));
  if (notRun.length) return { status: STATUS.BLOCKED, reasons, regressions };
  failedMinor.forEach(r => reasons.push('ملاحظة غير حرجة: ' + r.id));
  return failedMinor.length ? { status: STATUS.COND, reasons, regressions } : { status: STATUS.PASS, reasons: ['كل الفحوص المطلوبة نجحت'], regressions };
}

function pendingApprovals() {
  const rq = path.join(ROOT, 'docs/approvals/requests'), gr = path.join(ROOT, 'docs/approvals/granted');
  const req = fs.existsSync(rq) ? fs.readdirSync(rq).filter(f => f.endsWith('.md') && !f.startsWith('_')) : [];
  const got = new Set(fs.existsSync(gr) ? fs.readdirSync(gr) : []);
  return req.filter(f => !got.has(f));
}

/** تغطية الدوال الحرجة (بنيوية وليست تغطية أسطر — مذكورة كذلك صراحةً) */
const CRITICAL_FNS = ['buildAccounting', 'glLedger', 'acctActivity', 'isLayout', 'periodLocked', 'canApproveJe', 'jeLive', 'stockCosting', 'itemAvgCosts', 'recipeCost', 'deprSchedule', 'cardRecon', 'parseMt940', 'customerAging', 'vatRegister', 'vatCloseLive', 'findDupInvoices', 'posReturnCalc', 'canEditRec', 'makeRptXlsx', 'rptShell'];
function structuralCoverage() {
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8')).join('\n');
  const cov = CRITICAL_FNS.map(fn => ({ fn, tested: new RegExp('\\b' + fn + '\\b').test(files) }));
  return { covered: cov.filter(c => c.tested).length, total: cov.length, untested: cov.filter(c => !c.tested).map(c => c.fn) };
}

function dashboard(run) {
  const R = run.results; const sum = (k) => R.reduce((s, r) => s + ((r.counts && r.counts[k]) || 0), 0);
  const byCat = (cat) => R.filter(r => r.cat === cat && r.status === 'fail').reduce((s, r) => s + Math.max(1, (r.counts && r.counts.fail) || (r.detail || []).length), 0);
  const cv = run.coverage; const pend = run.pendingApprovals;
  const row = (r) => `| ${r.id} | ${r.title} | ${r.critical ? 'حرج' : '—'} | ${{ pass: '✅ نجح', fail: '❌ فشل', 'not-run': '⏸ لم يُشغَّل', 'n/a': '— لا ينطبق' }[r.status]} | ${r.counts && r.counts.tests != null ? `${r.counts.pass}/${r.counts.tests}${r.counts.skipped ? ` (متخطى ${r.counts.skipped})` : ''}` : ''} | ${(r.reason || (r.detail || []).slice(0, 2).join('؛ ') || '').replace(/\|/g, '/').slice(0, 160)} |`;
  return `# لوحة الرقابة على الجودة — MITHQAL ERP

> مولّدة آليًا بـ \`node scripts/quality-gate.mjs${run.mode === 'release' ? ' --release' : ''} --dashboard\`. لا تُعدَّل يدويًا.

| البند | القيمة |
|---|---|
| تاريخ التشغيل | ${run.at} |
| الفرع / الالتزام | \`${run.branch}\` / \`${(run.commit || '').slice(0, 7)}\` |
| الوضع | ${run.mode === 'release' ? 'بوابة الإصدار' : 'بوابة التغيير'} |
| **جاهزية الإصدار** | **${run.verdict.status}** |
| الاختبارات المنفذة (حالات node:test) | ${sum('tests')} |
| الناجحة | ${sum('pass')} |
| الفاشلة | ${sum('fail')} |
| المتخطاة (لا تُحسب نجاحًا) | ${sum('skipped')} |
| الأخطاء المحاسبية المكتشفة | ${byCat('accounting')} |
| الأخطاء البرمجية المكتشفة | ${byCat('code')} |
| أخطاء التصميم | ${byCat('design')} |
| الثغرات الأمنية | ${byCat('security')} |
| تعديلات تنتظر الموافقة | ${pend.length}${pend.length ? ' — ' + pend.join('، ') : ''} |
| تغطية الدوال الحرجة (بنيوية) | ${cv.covered}/${cv.total} مذكورة في اختبارات${cv.untested.length ? ' — بلا اختبار: ' + cv.untested.join('، ') : ''} |
| تغطية الأسطر | **غير مقاسة** — لا تُعرض نسبة شكلية |

## أسباب الحكم
${run.verdict.reasons.map(r => '- ' + r).join('\n')}

## الفحوص
| المعرّف | الفحص | النوع | الحالة | الحالات | التفاصيل |
|---|---|---|---|---|---|
${R.map(row).join('\n')}

## تنبيه
النسبة العالية لا تعني صحة النظام. «لم يُشغَّل» يعني أن البيئة ناقصة وليس نجاحًا. التغطية البنيوية تعني أن اسم الدالة مذكور في ملف اختبار، لا أن كل فروعها مختبرة.
`;
}

export function runGate({ mode = 'change', only = null, baseline = null } = {}) {
  MODE = mode;
  const files = changedFiles(); const ui = isUiChange(files);
  const list = CHECKS.filter(c => !only || only.includes(c.id));
  const results = list.map(c => runCheck(c, mode, ui));
  const v = verdict(results, { baseline });
  return { at: new Date().toISOString(), mode, branch: BRANCH(), commit: HEAD(), changedFiles: files.length, uiChange: ui, results, verdict: v, coverage: structuralCoverage(), pendingApprovals: pendingApprovals() };
}

/** اختبار ذاتي: فحوص متعمدة الفشل عبر المشغّل الحقيقي */
function selfTest() {
  const fake = (id, cmd, critical = true, mandatory = ['change']) => ({ id, title: id, cat: 'process', critical, mandatory, cmd });
  MODE = 'change';
  const ok = runCheck(fake('ok', ['node', '-e', 'process.exit(0)']), 'change', false);
  const bad = runCheck(fake('bad', ['node', '-e', 'process.exit(1)']), 'change', false);
  const minor = runCheck(fake('minor', ['node', '-e', 'process.exit(1)'], false), 'change', false);
  const missing = runCheck({ ...fake('env', ['node', '-e', '0']), needs: () => 'بيئة ناقصة متعمدة' }, 'change', false);
  const cases = [
    ['فحص حرج فاشل ⇐ FAIL', verdict([ok, bad]).status, STATUS.FAIL],
    ['فحص إلزامي لم يُشغَّل ⇐ BLOCKED', verdict([ok, missing]).status, STATUS.BLOCKED],
    ['فحص غير حرج فاشل ⇐ CONDITIONAL PASS', verdict([ok, minor]).status, STATUS.COND],
    ['كل الفحوص ناجحة ⇐ PASS', verdict([ok]).status, STATUS.PASS],
    ['انحدار (نجح ثم فشل) ⇐ FAIL', verdict([{ ...minor }], { baseline: [{ id: 'minor', status: 'pass' }] }).status, STATUS.FAIL],
  ];
  // الأخطاء المحاسبية المتعمدة: يجب أن يفشل محرك التحقق إن عُطّل الكشف — نشغّله ونتأكد أنه يكتشف
  const acct = runCheck(CHECKS.find(c => c.id === 'accounting-validation'), 'change', false);
  cases.push(['محرك التحقق المحاسبي يكتشف كل الأخطاء المتعمدة', acct.status, 'pass']);
  let bad2 = 0; for (const [name, got, want] of cases) { const p = got === want; if (!p) bad2++; console.log(`${p ? '✓' : '✗'} ${name} — الناتج: ${got}`); }
  console.log(bad2 ? `\nفشل الاختبار الذاتي (${bad2})` : '\nالاختبار الذاتي: البوابة تكتشف الأخطاء المتعمدة وتمنع اعتمادها.');
  process.exit(bad2 ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (flag('--self-test')) selfTest();
  const baseline = opt('--baseline') ? JSON.parse(fs.readFileSync(opt('--baseline'), 'utf8')).results : null;
  const run = runGate({ mode: flag('--release') ? 'release' : 'change', only: opt('--only') ? opt('--only').split(',') : null, baseline });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'last-run.json'), JSON.stringify(run, null, 1));
  if (flag('--dashboard')) fs.writeFileSync(path.join(ROOT, 'docs', 'QUALITY_DASHBOARD.md'), dashboard(run));
  if (flag('--json')) console.log(JSON.stringify(run, null, 1));
  else {
    console.log(`\nبوابة ${run.mode === 'release' ? 'الإصدار' : 'التغيير'} — ${run.branch}@${(run.commit || '').slice(0, 7)}`);
    for (const r of run.results) console.log(`  ${{ pass: '✓', fail: '✗', 'not-run': '⏸', 'n/a': '—' }[r.status]} ${r.id}${r.counts && r.counts.tests != null ? ` (${r.counts.pass}/${r.counts.tests})` : ''}${r.reason ? ' — ' + r.reason : ''}${r.status === 'fail' && r.detail ? '\n      ' + r.detail.slice(0, 5).join('\n      ') : ''}`);
    console.log(`\nالحكم: ${run.verdict.status}`); run.verdict.reasons.forEach(r => console.log('  - ' + r));
  }
  process.exit({ [STATUS.PASS]: 0, [STATUS.COND]: 0, [STATUS.FAIL]: 1, [STATUS.BLOCKED]: 2 }[run.verdict.status]);
}
