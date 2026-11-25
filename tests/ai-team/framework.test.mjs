/**
 * سلامة إطار فريق الذكاء الاصطناعي: الوكلاء، المهارات، الإعدادات، والوثائق.
 * بلا اعتماديات: node --test tests/ai-team/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** محلل بسيط لرأس YAML (مفاتيح نصية + قوائم بشرطة) */
export function frontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const o = {}; let last = null;
  for (const line of m[1].split('\n')) {
    const li = line.match(/^\s+-\s+(.+)$/);
    if (li && last) { (o[last] = Array.isArray(o[last]) ? o[last] : []).push(li[1].trim()); continue; }
    const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (kv) { last = kv[1]; let v = kv[2].trim(); if (v.startsWith('"')) v = JSON.parse(v); o[last] = v === '' ? [] : v; }
  }
  return o;
}

const AGENTS = ['mithqal-orchestrator', 'accounting-chief', 'financial-accountant', 'cost-accountant', 'zatca-specialist', 'financial-controller', 'erp-architect', 'database-architect', 'backend-engineer', 'frontend-engineer', 'integration-engineer', 'uiux-director', 'reports-designer', 'icon-designer', 'qa-engineer', 'security-auditor',
  'quality-assurance-director', 'accounting-validation-agent', 'design-quality-auditor', 'release-approval-agent'];
const READ_ONLY = ['accounting-chief', 'financial-accountant', 'cost-accountant', 'zatca-specialist', 'financial-controller', 'security-auditor', 'quality-assurance-director', 'accounting-validation-agent', 'design-quality-auditor', 'release-approval-agent'];
const SKILLS = ['accounting-standards', 'general-ledger', 'financial-statements', 'bank-reconciliation', 'accounts-receivable-payable', 'cost-accounting', 'restaurant-accounting', 'saudi-zatca-compliance',
  'erp-gap-analysis', 'erp-module-builder', 'multi-tenant-architecture', 'database-design', 'api-integration', 'rbac-permissions',
  'premium-ui-design', 'design-system', 'responsive-layouts', 'dashboard-design', 'financial-report-design', 'pdf-print-engine', 'excel-reporting', 'app-icon-design', 'svg-icon-system', 'erp-regression-testing'];
const KNOWN_TOOLS = new Set(['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'WebSearch', 'WebFetch', 'Agent', 'TodoWrite']);
const KNOWN_MODELS = new Set(['inherit', 'opus', 'sonnet', 'haiku']);
const tools = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean);

test('عدد الوكلاء = 20 بالأسماء المطلوبة تمامًا', () => {
  const files = fs.readdirSync(path.join(ROOT, '.claude/agents')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)).sort();
  assert.deepEqual(files, [...AGENTS].sort());
});

for (const a of AGENTS) test(`الوكيل ${a}: رأس صالح، أدوات معروفة، مهارات موجودة، وأقسام إلزامية`, () => {
  const src = rd(`.claude/agents/${a}.md`); const f = frontmatter(src);
  assert.ok(f, 'رأس YAML مفقود');
  assert.equal(f.name, a);
  assert.ok(/^[a-z][a-z0-9-]*$/.test(f.name));
  assert.ok(f.description && f.description.length >= 60 && f.description.length <= 1024, 'الوصف');
  for (const t of tools(f.tools)) assert.ok(KNOWN_TOOLS.has(t), 'أداة غير معروفة: ' + t);
  assert.ok(KNOWN_MODELS.has(f.model), 'نموذج غير معروف');
  assert.ok(Array.isArray(f.skills) && f.skills.length >= 1, 'لا مهارات');
  for (const s of f.skills) assert.ok(fs.existsSync(path.join(ROOT, `.claude/skills/${s}/SKILL.md`)), 'مهارة غير موجودة: ' + s);
  for (const h of ['## الهوية والتخصص', '## نطاق المسؤولية', '## خارج النطاق', '## الأدوات والصلاحيات', '## طريقة العمل', '## ما يحتاج موافقة صريحة', '## معايير القبول والتسليم', '## التواصل مع المنسق', '### تقرير التسليم'])
    assert.ok(src.includes(h), 'قسم مفقود: ' + h);
  assert.ok(src.includes('لا يعتمد وكيل عمله بنفسه'), 'قاعدة الاستقلالية مفقودة');
});

test('وكلاء المراجعة المالية والأمنية والاعتماد: قراءة فقط (لا Write ولا Edit)', () => {
  for (const a of READ_ONLY) {
    const f = frontmatter(rd(`.claude/agents/${a}.md`));
    const t = tools(f.tools); const d = tools(f.disallowedTools);
    assert.ok(!t.includes('Write') && !t.includes('Edit'), a + ' يملك أداة كتابة');
    assert.ok(d.includes('Write') && d.includes('Edit'), a + ' لا يمنع الكتابة صراحةً');
  }
});

test('مهندسو المعمارية والبيانات: كتابة وثائق جديدة بلا تعديل ملفات قائمة', () => {
  for (const a of ['erp-architect', 'database-architect']) assert.ok(tools(frontmatter(rd(`.claude/agents/${a}.md`)).disallowedTools).includes('Edit'));
});

test('المنسق يعرف كل الوكلاء ودورة العمل', () => {
  const s = rd('.claude/agents/mithqal-orchestrator.md');
  for (const a of AGENTS.filter(x => x !== 'mithqal-orchestrator')) assert.ok(s.includes('`' + a + '`'), 'المنسق لا يذكر ' + a);
  assert.ok(s.includes('ANALYZE → PLAN → DEVELOP → TEST → VALIDATE → AUDIT → APPROVE → RELEASE'));
});

test('عدد المهارات = 24 بالأسماء المطلوبة تمامًا، وكل مهارة يستخدمها وكيل', () => {
  const dirs = fs.readdirSync(path.join(ROOT, '.claude/skills')).filter(d => fs.existsSync(path.join(ROOT, '.claude/skills', d, 'SKILL.md'))).sort();
  assert.deepEqual(dirs, [...SKILLS].sort());
  const used = new Set(AGENTS.flatMap(a => frontmatter(rd(`.claude/agents/${a}.md`)).skills));
  for (const s of SKILLS) assert.ok(used.has(s), 'مهارة لا يستخدمها أي وكيل: ' + s);
});

for (const s of SKILLS) test(`المهارة ${s}: رأس صالح والأقسام التسعة`, () => {
  const src = rd(`.claude/skills/${s}/SKILL.md`); const f = frontmatter(src);
  assert.equal(f.name, s);
  assert.ok(f.description.length >= 60 && f.description.length <= 1024);
  assert.ok(!/[<>]/.test(f.description), 'الوصف يحوي أقواس زاوية');
  for (const h of ['## متى تُفعَّل المهارة', '## متطلبات التنفيذ', '## خطوات العمل', '## المعايير المحاسبية أو الهندسية ذات الصلة', '## أمثلة عملية', '## حالات الخطأ', '## اختبارات التحقق', '## المخرجات المطلوبة'])
    assert.ok(src.includes(h), 'قسم مفقود: ' + h);
  assert.ok(src.split('\n').length < 500, 'SKILL.md أطول من 500 سطر');
});

test('.claude/settings.json: JSON صالح ويمنع الأسرار والنشر وكتابة الموافقات', () => {
  const s = JSON.parse(rd('.claude/settings.json'));
  const deny = s.permissions.deny.join('\n'), ask = s.permissions.ask.join('\n');
  for (const r of ['Read(./.env)', 'Bash(firebase deploy *)', 'Bash(git push origin main)', 'Write(./docs/approvals/granted/**)', 'Edit(./public/brand/**)']) assert.ok(deny.includes(r), 'منع مفقود: ' + r);
  for (const r of ['Bash(git push *)', 'Bash(gh pr merge *)', 'Edit(./firestore.rules)']) assert.ok(ask.includes(r), 'طلب موافقة مفقود: ' + r);
  for (const r of [...s.permissions.deny, ...s.permissions.ask, ...s.permissions.allow]) assert.match(r, /^(Read|Edit|Write|Bash)\(.+\)$/);
});

const DOCS = ['AI_TEAM_ARCHITECTURE', 'AI_TEAM_USAGE_GUIDE', 'AI_TEAM_INITIAL_AUDIT', 'ACCOUNTING_QUALITY_STANDARDS', 'UI_UX_DESIGN_STANDARDS', 'REPORTING_STANDARDS', 'ICON_DESIGN_STANDARDS', 'SECURITY_GUARDRAILS', 'AGENT_SKILL_TEST_RESULTS',
  'QUALITY_CONTROL_FRAMEWORK', 'ACCOUNTING_VALIDATION_REPORT', 'DESIGN_QUALITY_REPORT', 'SECURITY_VALIDATION_REPORT', 'REGRESSION_TEST_REPORT', 'RELEASE_READINESS_REPORT', 'HUMAN_APPROVAL_POLICY'];
test('الوثائق الست عشرة موجودة وغير فارغة', () => {
  for (const d of DOCS) { const p = `docs/${d}.md`; assert.ok(fs.existsSync(path.join(ROOT, p)), 'مفقود: ' + p); assert.ok(rd(p).length > 800, 'قصير جدًا: ' + p); }
});

test('تقارير الرقابة السبعة تحوي البنود الإلزامية التسعة', () => {
  const must = ['تاريخ التنفيذ', 'النطاق', 'الاختبارات المنفذة', 'النتائج الفعلية', 'الأخطاء المكتشفة', 'الأخطاء التي عولجت', 'الأخطاء المتبقية', 'المخاطر', 'قرار الاعتماد'];
  for (const d of ['ACCOUNTING_VALIDATION_REPORT', 'DESIGN_QUALITY_REPORT', 'SECURITY_VALIDATION_REPORT', 'REGRESSION_TEST_REPORT', 'RELEASE_READINESS_REPORT']) {
    const s = rd(`docs/${d}.md`); for (const m of must) assert.ok(s.includes(m), `${d}: ينقصه «${m}»`);
  }
  for (const d of ['QUALITY_CONTROL_FRAMEWORK', 'HUMAN_APPROVAL_POLICY']) { const s = rd(`docs/${d}.md`); assert.ok(s.includes('قرار الاعتماد') && s.includes('النطاق')); }
});

test('لا موافقة ممنوحة وضعها الإطار نفسه', () => {
  const g = fs.readdirSync(path.join(ROOT, 'docs/approvals/granted')).filter(f => f !== 'README.md');
  assert.deepEqual(g, []);
});
