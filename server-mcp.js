/**
 * v53.5 — موصل Claude (MCP) للقراءة فقط: يربط تطبيق Claude ببيانات مُكتسَب الحية (طلب المالك 2026-11-23).
 * • مسؤول النظام يُنشئ «رابط ربط» من الإعدادات ← ربط Claude. الرابط سرّي (رمز عشوائي 256 بت)، ويُخزَّن منه بصمته فقط (SHA-256)
 *   في mcp_tokens/{بصمة} بقاعدة المنشأة نفسها (قواعد Firestore تمنع العملاء من قراءتها — الخادم وحده بحساب الخدمة).
 * • كل طلب: الرمز صالح ونشط ⇒ صاحبه ما زال عضوًا نشطًا بدور «مسؤول النظام» ⇒ تُقرأ البيانات بحساب خدمة المنشأة.
 * • للقراءة فقط: لا أداة تكتب أو تعدّل أو تحذف. لا يُطبع الرمز في أي سجل. الإلغاء من الواجهة يوقفه فورًا (خلال دقيقة كحد أقصى).
 * • البروتوكول: MCP عبر HTTP (JSON-RPC 2.0، رد JSON مباشر بلا SSE) — POST /mcp/<الرمز>.
 */
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { saTokenSource } from './server-billing.js';
import { decodeFields, assemble, composeLogical } from './scripts/backup-lib.mjs';

// مستندات المنصة التي يحتاجها الموصل (ورؤوسها وأجزاؤها __…) — يُستبعد السجل التاريخي والولاء وفواتير نقطة البيع الشهرية توفيرًا للذاكرة
// (محرك المحاسبة buildAccounting وأدوات الموصل لا تقرأ posOrders/posShifts — الإيراد من الإغلاقات اليومية)
export const MCP_DOC_RE = /^rms8_(org|core|br_[^_].*?)(__.+)?$/;

// مصفوفات العمليات التي يقرؤها محرك المحاسبة (buildAccounting وما يستدعيه) ودوال المقترحات وأدوات الموصل — مُستخرجة من App.jsx.
// أي مصفوفة أخرى (نقطة البيع، التسويق، الموارد البشرية…) تُحذف فور فك مستندها توفيرًا للذاكرة.
export const MCP_OPS_KEYS = new Set(['advances', 'appSettlements', 'cashVouchers', 'closingInvPays', 'closings', 'disbursements', 'eclDocs', 'invoices',
  'journalManual', 'ledgerEntries', 'salesInvoices', 'stockMoves', 'transfers', 'whMoves', 'whTransfers']);
// الملفات المضمّنة (صور/مرفقات data:…) لا تلزم المحاسبة — تُسقط أثناء الفك نفسه فلا تبقى في الذاكرة
const DROP_BLOBS = (k, v) => (typeof v === 'string' && v.length > 1024 && v.startsWith('data:')) ? undefined : v;

/** v53.9: تحميل بيانات المنشأة للموصل — قراءة المستندات اللازمة بأسمائها (batchGet) لا تصفّح المجموعة كلها:
 *  المجموعة فيها أرشيف الصور لكل فرع (rms8_bf_*) وفواتير نقطة البيع الشهرية والسجل التاريخي والهيكل القديم — تنزيلها كان
 *  يستنفد ذاكرة الخطة المجانية ويستغرق دقائق. الآن: org + core + مستند كل فرع من org.branches، وكل مستند يُجمَّع ويُفك وحده
 *  ثم تُحرَّر نصوصه، مع حذف المصفوفات غير المحاسبية والمرفقات المضمّنة. get(url, init?) ⇒ { ok, status, j } بحساب الخدمة. */
// v56.46: opts.posCredit — يُبقي من فواتير نقطة البيع ما فيه دفعة آجلة فقط (ومن مستنداتها الشهرية) لتفويض البيع الآجل (server-poscredit.js)
const posCreditOnly = (arr) => (Array.isArray(arr) ? arr : []).filter(o => o && Array.isArray(o.payments) && o.payments.some(p => p && p.m === 'credit'));
// v56.50: opts.keep — مصفوفات إضافية تُبقى (لإرسال الرسائل: الموافقات والدمج والملفات والدفعات)؛ opts.loy — يُحمَّل مستند الولاء rms8_loy كما هو ويُعاد في loy
export async function loadPlatformData(base, get, now = Date.now, opts = {}) {
  const keep = new Set(Array.isArray(opts.keep) ? opts.keep : []);
  const prefix = base.replace(/^https:\/\/[^/]+\/v1\//, '') + '/platform/';
  const batch = async (ids) => { const out = {};
    for (let i = 0; i < ids.length; i += 10) {
      const r = await get(base + ':batchGet', { method: 'POST', body: JSON.stringify({ documents: ids.slice(i, i + 10).map(id => prefix + id) }) });
      if (!r.ok) throw new Error('تعذّرت قراءة بيانات المنشأة (' + r.status + ')');
      (Array.isArray(r.j) ? r.j : []).forEach(x => { if (x && x.found) out[x.found.name.split('/').pop()] = decodeFields(x.found.fields); }); r.j = null; }
    return out; };
  const values = {}, bad = [];
  const load = async (ids) => { const heads = await batch(ids);
    for (const id of ids) { const f = heads[id]; if (!f) continue; delete heads[id];
      const parts = Number(f.parts) || 1; let text = f.value;
      if (parts > 1) { if (parts > 500) { bad.push(id); continue; }
        const names = Array.from({ length: parts }, (_, i) => id + '__' + (f.ver ? f.ver + '_' : '') + i);
        const ch = await batch(names); if (names.some(n => !ch[n] || typeof ch[n].chunk !== 'string')) { bad.push(id); continue; }
        text = names.map(n => ch[n].chunk).join(''); }
      if (typeof text !== 'string' || !text) continue;
      let v; try { v = JSON.parse(text, id === 'rms8_org' ? undefined : DROP_BLOBS); } catch { bad.push(id); continue; } text = null;
      if (opts.posCredit && v && typeof v === 'object') { if (Array.isArray(v.posOrders)) v.posOrders = posCreditOnly(v.posOrders); if (Array.isArray(v.orders)) v.orders = posCreditOnly(v.orders); }
      if (id !== 'rms8_org' && id !== 'rms8_loy' && v && typeof v === 'object') Object.keys(v).forEach(k => { if (Array.isArray(v[k]) && !MCP_OPS_KEYS.has(k) && !keep.has(k) && !(opts.posCredit && (k === 'posOrders' || k === 'orders' || k === 'posMonths'))) delete v[k]; });
      values[id] = v; } };
  await load(['rms8_org', 'rms8_core']);
  const brs = (((values.rms8_org || {}).branches) || []).map(b => 'rms8_br_' + String((b && b.id) || '').replace(/[^\w-]/g, '_')).filter(x => x !== 'rms8_br_');
  for (const id of brs) await load([id]);   // فرع فرع — مستند واحد مفكوك في الذاكرة في كل مرة
  if (opts.posCredit) for (const id of brs) { const ms = ((values[id] || {}).posMonths) || []; const b = id.slice('rms8_br_'.length);
    for (const ym of ms) if (/^[0-9]{6}$/.test(String(ym))) await load(['rms8_pos_' + b + '_' + ym]); }
  let loy;
  if (opts.loy) { await load(['rms8_loy']); if (bad.includes('rms8_loy')) throw new Error('تعذّرت قراءة دفتر الولاء كاملًا'); loy = values.rms8_loy || { members: {}, tx: [] }; delete values.rms8_loy; }
  if (bad.length) console.error('mcp: مستندات لم تُقرأ كاملة:', bad.join(','));
  const L = composeLogical(values); return { org: L.org || {}, ops: L.ops || {}, ...(opts.loy ? { loy } : {}), _at: new Date(now()).toISOString() };
}


export const MCP_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const TOKEN_RE = /^mq_([a-z0-9][a-z0-9-]{1,39})_([A-Za-z0-9_-]{43})$/;
const MAX_TOKENS = 10;
const r2 = (n) => (Math.round((Number(n) || 0) * 100) / 100) || 0;
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const norm = (x) => String(x == null ? '' : x).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
export const hashToken = (tok) => crypto.createHash('sha256').update(String(tok)).digest('hex');
export function newToken(tenantId) { return 'mq_' + tenantId + '_' + crypto.randomBytes(32).toString('base64url'); }
export function parseToken(tok) { const m = TOKEN_RE.exec(String(tok || '')); return m ? { tenant: m[1] } : null; }

/* ===================== أدوات القراءة — دوال نقية على (المحرك، البيانات) ===================== */
const BR = { type: 'string', description: 'اسم الفرع أو معرّفه، أو "central" للمركز الرئيسي. اتركه فارغًا لكل الفروع.' };
const FROM = { type: 'string', description: 'من تاريخ YYYY-MM-DD' }, TO = { type: 'string', description: 'إلى تاريخ YYYY-MM-DD' };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const MCP_TOOLS = [
  { name: 'mithqal_overview', title: 'نظرة عامة على المنشأة', description: 'اسم المنشأة والفروع ونطاق تواريخ البيانات وأعداد السجلات. ابدأ بها لمعرفة أسماء الفروع والفترات المتاحة.', inputSchema: { type: 'object', properties: {} } },
  { name: 'chart_of_accounts', title: 'دليل الحسابات', description: 'دليل الحسابات: الرمز والاسم والنوع (asset/liab/equity/rev/exp) والتصنيف (pur مشتريات / exp مصروفات / asset أصول). ابحث بجزء من الاسم أو الرمز.', inputSchema: { type: 'object', properties: { q: { type: 'string', description: 'جزء من اسم الحساب أو رمزه' } } } },
  { name: 'trial_balance', title: 'ميزان المراجعة', description: 'ميزان المراجعة لفترة: لكل حساب الرصيد الافتتاحي والمدين والدائن والختامي، مع تحقق التوازن.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, branch: BR } } },
  { name: 'income_statement', title: 'قائمة الدخل', description: 'قائمة الدخل لفترة: صافي المبيعات، تكلفة المبيعات، مجمل الربح، مصروفات التشغيل، صافي الربح ونسبها من المبيعات.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, branch: BR }, required: ['from', 'to'] } },
  { name: 'account_ledger', title: 'دفتر أستاذ حساب', description: 'حركة حساب واحد (ويشمل الحسابات الفرعية التي تبدأ برمزه) لفترة مع الرصيد الجاري. limit لعدد آخر الحركات (الافتراضي 200).', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'رمز الحساب، مثل 5101' }, from: FROM, to: TO, branch: BR, limit: { type: 'integer', minimum: 1, maximum: 1000 } }, required: ['code'] } },
  { name: 'sales_by_branch', title: 'المبيعات حسب الفرع والفترة', description: 'صافي الإيرادات (من القيود) لكل فرع مجمّعة بالشهر أو اليوم.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, group: { type: 'string', enum: ['month', 'day'], description: 'التجميع (الافتراضي month)' } }, required: ['from', 'to'] } },
  { name: 'purchases_by_class', title: 'المشتريات والمصروفات حسب التصنيف', description: 'فواتير الموردين مجمّعة حسب التصنيف (مشتريات/مصروفات/أصول) ثم الحساب، مع أكبر الموردين لكل تصنيف.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, branch: BR, cls: { type: 'string', enum: ['pur', 'exp', 'asset'] } } } },
  { name: 'supplier_balances', title: 'أرصدة الموردين', description: 'لكل مورد: إجمالي الفواتير والمسدد والمتبقي والمتأخر عن الاستحقاق، مرتبة من الأكبر متبقيًا.', inputSchema: { type: 'object', properties: { supplier: { type: 'string', description: 'جزء من اسم المورد' }, open_only: { type: 'boolean' } } } },
  { name: 'search_invoices', title: 'بحث في فواتير الموردين', description: 'فواتير الموردين برقمها أو المورد أو رقم القيد الثابت (PJ-) أو دفعة الاستيراد (IMP-)، مع التصنيف والحساب والمبالغ والمتبقي. limit الافتراضي 50.', inputSchema: { type: 'object', properties: { q: { type: 'string' }, from: FROM, to: TO, cls: { type: 'string', enum: ['pur', 'exp', 'asset'] }, open_only: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 500 } } } },
  { name: 'financial_analysis', title: 'التحليل المالي المتتبَّع', description: '14 نسبة مالية (سيولة، ربحية، كفاءة، ملاءة، تدفق نقدي) لكل منها المعادلة والحسابات المصدرية والفترة والقيمة والمقارنة بالفترة السابقة والسنة السابقة والمخاطرة والإجراء، مع فحص اكتمال البيانات أولًا. النسبة ذات البيانات الناقصة قيمتها null وحالتها insufficient — اذكر ذلك للمستخدم ولا تقدّر قيمة بديلة.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, branch: BR }, required: ['from', 'to'] } },
  { name: 'control_scan', title: 'الفحص الرقابي وسجل الحالات', description: 'نتائج الفحص المحاسبي الحتمي الآن (فواتير مكررة، ضريبة غير مطابقة، ضريبة بلا رقم ضريبي للمورد، أرصدة بعكس طبيعتها، قيود غير متوازنة…) مع حالات السجل المسجّلة وحالتها ومسؤولها وموعدها. للقراءة فقط.', inputSchema: { type: 'object', properties: { category: { type: 'string' }, open_only: { type: 'boolean' } } } },
  { name: 'search_references', title: 'البحث في مكتبة المراجع', description: 'بحث في المراجع المرفوعة للمنشأة (IFRS/IAS/IFRIC، الهيئة السعودية للمراجعين والمحاسبين، هيئة الزكاة والضريبة والجمارك، السياسات الداخلية). يُرجع مقتطفات حرفية مع العنوان والصفحة والفقرة وحجية المرجع وحالة توثيقه. استشهد فقط بما يُرجعه — لا تذكر فقرة أو متطلبًا غير موجود في المقتطفات، وفرّق بين «متطلب رسمي» و«سياسة داخلية» و«تفسير مهني» وشرحك أنت، ونبّه إن كان المرجع «غير موثّق».', inputSchema: { type: 'object', properties: { q: { type: 'string', description: 'السؤال أو الكلمات أو رقم المعيار/الفقرة' }, cat: { type: 'string' }, family: { type: 'string', description: 'مثل IFRS 15' }, include_inactive: { type: 'boolean' } }, required: ['q'] } },
  { name: 'journal_entries', title: 'قيود اليومية', description: 'قيود اليومية (الآلية واليدوية) لفترة مع بنودها. ابحث في البيان أو رقم القيد أو المرجع. limit الافتراضي 50.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, q: { type: 'string' }, branch: BR, limit: { type: 'integer', minimum: 1, maximum: 300 } } } },
].map(t => ({ ...t, annotations: { ...RO, title: t.title } }));

/* ===== v53.7 — كتابة مشروطة بالاعتماد: أدوات «اقتراح» تُسجّل مقترحًا في mcp_proposals ولا تمس بيانات المنشأة؛ التنفيذ عند اعتماد مسؤول النظام في مُكتسَب ===== */
const WR = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const PEND = ' لا يُنفَّذ شيء الآن: يُسجَّل «مقترحًا بانتظار الاعتماد» ويعتمده مسؤول النظام في مُكتسَب (الإعدادات ← ربط Claude ← المقترحات). أخبر المستخدم بذلك.';
export const MCP_WRITE_TOOLS = [
  { name: 'propose_journal_entry', title: 'اقتراح قيد يومية', description: 'اقتراح قيد يومية يدوي متوازن (حسابات من chart_of_accounts).' + PEND, inputSchema: { type: 'object', properties: {
    date: { type: 'string', description: 'YYYY-MM-DD' }, title: { type: 'string', description: 'بيان القيد' }, branch: BR,
    lines: { type: 'array', minItems: 2, maxItems: 60, items: { type: 'object', properties: { code: { type: 'string' }, debit: { type: 'number' }, credit: { type: 'number' } }, required: ['code'] } },
    reason: { type: 'string', description: 'سبب القيد للمعتمِد' } }, required: ['date', 'title', 'lines'] } },
  { name: 'propose_reclassify_invoices', title: 'اقتراح إعادة تصنيف فواتير', description: 'نقل فواتير مصروفات (بحساب واحد) إلى حساب آخر. invoice = رقم القيد الثابت PJ- أو رقم فاتورة المورد (مع supplier عند التكرار). حتى 2000 فاتورة في المقترح.' + PEND, inputSchema: { type: 'object', properties: {
    changes: { type: 'array', minItems: 1, maxItems: 2000, items: { type: 'object', properties: { invoice: { type: 'string' }, supplier: { type: 'string' }, to_account: { type: 'string' } }, required: ['invoice', 'to_account'] } },
    reason: { type: 'string' } }, required: ['changes'] } },
  { name: 'propose_expense_invoices', title: 'اقتراح فواتير مصروفات ومشتريات', description: 'تسجيل فواتير موردين (خدمات/مصروفات/مشتريات بلا أصناف) بنفس تحقق استيراد Excel: الموردون، الرقم الضريبي، التكرار، الإقفال. payment: credit آجل / cash نقدي / bank بنك. حتى 300 فاتورة.' + PEND, inputSchema: { type: 'object', properties: {
    invoices: { type: 'array', minItems: 1, maxItems: 300, items: { type: 'object', properties: { date: { type: 'string' }, supplier: { type: 'string' }, vat_number: { type: 'string' }, invoice_no: { type: 'string' }, description: { type: 'string' },
      account: { type: 'string', description: 'رمز الحساب' }, net: { type: 'number' }, vat: { type: 'number' }, total: { type: 'number' }, branch: { type: 'string' }, payment: { type: 'string', enum: ['credit', 'cash', 'bank'] } }, required: ['date', 'supplier', 'invoice_no', 'account'] } },
    reason: { type: 'string' } }, required: ['invoices'] } },
  { name: 'list_proposals', title: 'حالة المقترحات', description: 'المقترحات المرسلة وحالتها (بانتظار الاعتماد / نُفّذ / رُفض) مع ملاحظة المعتمِد.', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'applied', 'rejected'] } } } },
].map(t => ({ ...t, annotations: { ...(t.name === 'list_proposals' ? RO : WR), title: t.title } }));
export const WRITE_NAMES = new Set(MCP_WRITE_TOOLS.filter(t => t.name !== 'list_proposals').map(t => t.name));

/** يبني المقترح ويتحقق منه على البيانات الحالية (نفس دوال التطبيق في مُكتسَب) — يرمي خطأ مفهومًا إن لم يصلح شيء */
export function proposeTool(E, D, name, a = {}) {
  const C = ctxOf(E, D); const reason = String(a.reason || '').slice(0, 500);
  if (name === 'propose_journal_entry') {
    if (D._scope && !a.branch) throw new Error('الرابط مقيّد بفروع محددة — حدّد الفرع في القيد (لا قيود على المركز الرئيسي)');
    const payload = { date: String(a.date || '').slice(0, 10), title: String(a.title || '').slice(0, 140), ...(a.branch ? { branchId: (() => { const b = C.brOf(a.branch); return b === 'central' ? '' : b; })() } : {}),
      lines: (a.lines || []).map(l => ({ code: String(l.code || '').trim(), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) };
    const P = E.mcpPlanJournal(C.org, payload, { role: 'system_admin' }); if (!P.ok) throw new Error('القيد مرفوض: ' + P.errs.join(' · '));
    return { kind: 'journal', title: payload.title, reason, payload, summary: { date: payload.date, branch: payload.branchId ? C.brName(payload.branchId) : 'المركز الرئيسي', total: P.total, lines: P.lines } };
  }
  if (name === 'propose_reclassify_invoices') {
    const inv = C.ops.invoices || []; const byJe = new Map(), byNo = new Map(); const pre = [];
    inv.forEach(i => { if (i.jeNo) byJe.set(String(i.jeNo).toUpperCase(), i); const k = norm(i.invoiceNo); if (k) (byNo.get(k) || byNo.set(k, []).get(k)).push(i); });
    (a.changes || []).slice(0, 2000).forEach(c => { const ref = String(c.invoice || '').trim(); let i = inv.find(x => x.id === ref) || byJe.get(ref.toUpperCase());
      if (!i) { let L = byNo.get(norm(ref)) || []; if (c.supplier) L = L.filter(x => norm(x.supplierName).includes(norm(c.supplier))); if (L.length === 1) i = L[0]; else { pre.push({ ref, why: L.length ? 'رقم الفاتورة مكرر — حدّد المورد أو استعمل PJ-' : 'الفاتورة غير موجودة' }); return; } }
      pre.push({ id: i.id, to: String(c.to_account || '').trim() }); });
    const P = E.mcpPlanReclass(C.org, C.ops, { changes: pre.filter(x => x.id) });
    const skipped = [...pre.filter(x => !x.id), ...P.skipped];
    if (!P.ok.length) throw new Error('لا تغيير صالح: ' + skipped.slice(0, 10).map(x => x.ref + ' — ' + x.why).join(' · '));
    const by = {}; P.ok.forEach(x => { const k = x.from + ' → ' + x.to; const g = by[k] || (by[k] = { from: x.from + ' ' + x.fromName, to: x.to + ' ' + x.toName, count: 0, total: 0 }); g.count++; g.total = r2(g.total + x.amount); });
    return { kind: 'reclass', title: 'إعادة تصنيف ' + P.ok.length + ' فاتورة', reason, payload: { changes: P.ok.map(x => ({ id: x.id, from: x.from, to: x.to })) },
      summary: { count: P.ok.length, total: P.total, groups: Object.values(by), skipped: skipped.length, skipped_sample: skipped.slice(0, 20) } };
  }
  if (name === 'propose_expense_invoices') {
    const rows = (a.invoices || []).slice(0, 300); const P = E.mcpPlanExp(C.org, C.ops, { invoices: rows });
    const okRows = P.rows.map((r, k) => r.ok ? rows[k] : null).filter(Boolean);
    const bad = P.rows.map((r, k) => r.ok ? null : { row: k + 1, invoice_no: rows[k] && rows[k].invoice_no, why: r.err.join(' · ') }).filter(Boolean);
    if (!okRows.length) throw new Error('لا فاتورة صالحة: ' + bad.slice(0, 10).map(x => '#' + x.row + ' ' + (x.invoice_no || '') + ' — ' + x.why).join(' · '));
    return { kind: 'expinv', title: okRows.length + ' فاتورة مصروفات ومشتريات', reason, payload: { invoices: okRows },
      summary: { count: okRows.length, total: P.sum, vat: P.vatSum, new_suppliers: P.newSup.map(x => x.name), rejected: bad.length, rejected_rows: bad.slice(0, 30) } };
  }
  const e = new Error('أداة غير معروفة: ' + name); e.code = -32602; throw e;
}

function ctxOf(E, D) {
  const org = D.org || {}, ops = D.ops || {};
  const A = D._A || (D._A = E.buildAccounting(org, ops));
  const branches = (org.branches || []).map(b => ({ id: b.id, name: b.name }));
  const accName = (c) => ((A.accounts || []).find(a => a.code === String(c)) || {}).name || String(c);
  const brName = (id) => !id ? 'المركز الرئيسي' : ((branches.find(b => b.id === id) || {}).name || id);
  const brOf = (v) => { const s = String(v || '').trim(); if (!s) return ''; if (/^(central|المركز|المركز الرئيسي)$/i.test(s)) return 'central';
    const n = norm(s); const b = branches.find(x => x.id === s) || branches.find(x => norm(x.name) === n) || branches.find(x => norm(x.name).includes(n) || n.includes(norm(x.name)));
    if (!b) throw new Error('فرع غير معروف: ' + s + ' — الفروع: ' + branches.map(x => x.name).join('، ')); return b.id; };
  return { org, ops, A, branches, accName, brName, brOf };
}
const range = (a) => { for (const k of ['from', 'to']) if (a[k] && !okDate(a[k])) throw new Error(k + ' يجب أن يكون بصيغة YYYY-MM-DD'); if (a.from && a.to && a.from > a.to) throw new Error('from بعد to'); };
const inR = (d, a) => { d = String(d || '').slice(0, 10); return (!a.from || d >= a.from) && (!a.to || d <= a.to); };
const invPaid = (E, i) => r2(E.invPayments(i).reduce((s, p) => s + (Number(p.amount) || 0), 0));

export function runTool(E, D, name, a = {}, today = new Date().toISOString().slice(0, 10)) {
  const C = ctxOf(E, D); range(a);
  const bf = a.branch ? C.brOf(a.branch) : '';
  switch (name) {
    case 'mithqal_overview': {
      const ds = (C.A.entries || []).map(e => String(e.date || '')).filter(Boolean).sort();
      const co = C.org.company || {};
      return { company: co.name || '', tax_number: co.taxNumber || '', app_version: E.APP_VER, data_as_of: D._at, currency: 'SAR',
        branches: C.branches, entries_date_range: ds.length ? { from: ds[0], to: ds[ds.length - 1] } : null,
        counts: { journal_entries: (C.A.entries || []).length, supplier_invoices: (C.ops.invoices || []).length, suppliers: (C.org.suppliers || []).length, daily_closings: (C.ops.closings || []).length, accounts: (C.A.accounts || []).length },
        note: 'للقراءة فقط. المبالغ بالريال السعودي. التواريخ YYYY-MM-DD.' };
    }
    case 'chart_of_accounts': {
      const q = norm(a.q);
      return { accounts: (C.A.accounts || []).filter(x => !q || norm(x.name).includes(q) || String(x.code).startsWith(String(a.q).trim())).map(x => ({ code: x.code, name: x.name, kind: x.kind, ...(x.cls ? { cls: x.cls } : {}) })) };
    }
    case 'trial_balance': {
      const T = E.acctActivity(C.A, { from: a.from || '', to: a.to || '', bf });
      return { period: { from: a.from || null, to: a.to || null }, branch: bf ? C.brName(bf === 'central' ? '' : bf) : 'الكل', balanced: T.balanced, total_debit: T.debit, total_credit: T.credit, rows: T.rows };
    }
    case 'income_statement': {
      if (!a.from || !a.to) throw new Error('from و to مطلوبان');
      const T = E.acctActivity(C.A, { from: a.from, to: a.to, bf }); const mv = {};
      T.rows.forEach(r => { const n = (r.kind === 'asset' || r.kind === 'exp') ? 1 : -1; mv[r.code] = n * (r.debit - r.credit); });
      const Y = E.isLayout(C.A.accounts, (x) => mv[x.code] || 0);
      const pct = (v) => Y.netSales > 0.004 ? Math.round(v / Y.netSales * 1000) / 10 : null;
      const lines = (ls) => ls.map(l => ({ code: l.code, name: l.name, amount: r2(Math.abs(l.amt)), pct_of_sales: pct(Math.abs(l.amt)) }));
      return { period: { from: a.from, to: a.to }, branch: bf ? C.brName(bf === 'central' ? '' : bf) : 'الكل',
        net_sales: Y.netSales, sales: lines(Y.sales), cost_of_sales: r2(-Y.cogsT), cost_of_sales_pct: pct(-Y.cogsT), cost_of_sales_lines: lines(Y.cogs),
        gross_profit: Y.gross, gross_margin_pct: pct(Y.gross), operating_expenses: r2(-Y.opexT), operating_expenses_pct: pct(-Y.opexT),
        operating_expense_groups: (Y.opexG || []).map(g => ({ group: g.t, total: r2(-(g.lines || []).reduce((s, l) => s + l.amt, 0)), lines: lines(g.lines || []) })),
        operating_profit: Y.oper, other_items: Y.otherT, net_profit: Y.net, net_margin_pct: pct(Y.net) };
    }
    case 'account_ledger': {
      const L = E.glLedger(C.A, String(a.code || '').trim(), { from: a.from || '', to: a.to || '', bf });
      const lim = Math.min(1000, Math.max(1, Number(a.limit) || 200)); const rows = L.rows.slice(-lim);
      return { account: { code: L.acc.code, name: L.acc.name, kind: L.acc.kind }, period: { from: a.from || null, to: a.to || null }, opening: L.open, debit: L.debit, credit: L.credit, closing: L.close,
        rows_total: L.rows.length, rows_shown: rows.length, rows: rows.map(r => ({ date: r.date, entry_no: r.no, fixed_no: r.fix || undefined, title: r.title, source: r.src, ref: r.ref, branch: C.brName(r.branchId), debit: r.debit, credit: r.credit, balance: r.bal })) };
    }
    case 'sales_by_branch': {
      if (!a.from || !a.to) throw new Error('from و to مطلوبان');
      const kind = {}; (C.A.accounts || []).forEach(x => { kind[x.code] = x.kind; }); const len = a.group === 'day' ? 10 : 7; const out = {};
      (C.A.entries || []).forEach(e => { if (!inR(e.date, a) || e.closing) return; const v = (e.lines || []).reduce((s, l) => s + (kind[l.code] === 'rev' && !/^42/.test(l.code) ? (Number(l.credit) || 0) - (Number(l.debit) || 0) : 0), 0);
        if (Math.abs(v) < 0.005) return; const k = C.brName(e.branchId) + '|' + String(e.date).slice(0, len); out[k] = (out[k] || 0) + v; });
      const rows = Object.entries(out).map(([k, v]) => { const [branch, period] = k.split('|'); return { branch, period, net_revenue: r2(v) }; }).sort((x, y) => x.period.localeCompare(y.period) || x.branch.localeCompare(y.branch));
      const tot = {}; rows.forEach(r => { tot[r.branch] = r2((tot[r.branch] || 0) + r.net_revenue); });
      return { period: { from: a.from, to: a.to }, group: a.group === 'day' ? 'day' : 'month', totals_by_branch: tot, total: r2(rows.reduce((s, r) => s + r.net_revenue, 0)), rows };
    }
    case 'purchases_by_class': {
      const inv = (C.ops.invoices || []).filter(i => (Number(i.amount) || 0) > 0 && !i.creditNote && inR(i.date, a) && (!bf || (bf === 'central' ? !i.branchId : i.branchId === bf)));
      const cl = {}; inv.forEach(i => { const c = E.invCls(C.org, i); if (a.cls && c !== a.cls) return;
        const k = cl[c] || (cl[c] = { cls: c, name: E.INV_CLS[c], count: 0, total: 0, vat: 0, accounts: {}, suppliers: {} });
        const code = (Array.isArray(i.expLines) && i.expLines[0] && i.expLines[0].accCode) || i.accCode || (Array.isArray(i.lines) && i.lines.length ? 'مخزون' : '—');
        k.count++; k.total += Number(i.amount) || 0; k.vat += Number(i.vatAmt) || 0;
        const ac = k.accounts[code] || (k.accounts[code] = { code, name: code === 'مخزون' ? 'أصناف مخزنية' : C.accName(code), count: 0, total: 0 }); ac.count++; ac.total += Number(i.amount) || 0;
        k.suppliers[i.supplierName || '—'] = (k.suppliers[i.supplierName || '—'] || 0) + (Number(i.amount) || 0); });
      const classes = Object.values(cl).map(k => ({ cls: k.cls, name: k.name, invoices: k.count, total: r2(k.total), input_vat: r2(k.vat),
        accounts: Object.values(k.accounts).map(x => ({ ...x, total: r2(x.total) })).sort((x, y) => y.total - x.total),
        top_suppliers: Object.entries(k.suppliers).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([s, v]) => ({ supplier: s, total: r2(v) })) }));
      return { period: { from: a.from || null, to: a.to || null }, branch: bf ? C.brName(bf === 'central' ? '' : bf) : 'الكل', classes, grand_total: r2(classes.reduce((s, c) => s + c.total, 0)) };
    }
    case 'supplier_balances': {
      const q = norm(a.supplier); const m = {};
      (C.ops.invoices || []).forEach(i => { if (q && !norm(i.supplierName).includes(q)) return; const amt = Number(i.amount) || 0, paid = invPaid(E, i), rem = r2(amt - paid);
        const s = m[i.supplierName || '—'] || (m[i.supplierName || '—'] = { supplier: i.supplierName || '—', invoices: 0, total: 0, paid: 0, remaining: 0, overdue: 0 });
        s.invoices++; s.total += amt; s.paid += paid; s.remaining += rem; if (rem > 0.004 && i.dueDate && i.dueDate < today) s.overdue += rem; });
      let rows = Object.values(m).map(s => ({ ...s, total: r2(s.total), paid: r2(s.paid), remaining: r2(s.remaining), overdue: r2(s.overdue) }));
      if (a.open_only) rows = rows.filter(s => s.remaining > 0.004); rows.sort((x, y) => y.remaining - x.remaining);
      return { as_of: today, suppliers: rows.length, total_remaining: r2(rows.reduce((s, x) => s + x.remaining, 0)), total_overdue: r2(rows.reduce((s, x) => s + x.overdue, 0)), rows: rows.slice(0, 300) };
    }
    case 'search_invoices': {
      const q = norm(a.q); const lim = Math.min(500, Math.max(1, Number(a.limit) || 50));
      const hit = (C.ops.invoices || []).filter(i => inR(i.date, a) && (!q || norm([i.invoiceNo, i.supplierName, i.jeNo, i.importNo, i.extRef].join(' ')).includes(q)))
        .map(i => { const paid = invPaid(E, i); return { date: String(i.date || '').slice(0, 10), invoice_no: i.invoiceNo, supplier: i.supplierName, branch: C.brName(i.branchId), cls: E.invCls(C.org, i),
          account: (Array.isArray(i.expLines) && i.expLines[0]) ? i.expLines[0].accCode + ' ' + C.accName(i.expLines[0].accCode) : undefined, fixed_entry_no: i.jeNo, import_no: i.importNo, ext_ref: i.extRef,
          amount: r2(i.amount), vat: r2(i.vatAmt), paid, remaining: r2((Number(i.amount) || 0) - paid), due: i.dueDate }; })
        .filter(i => (!a.cls || i.cls === a.cls) && (!a.open_only || i.remaining > 0.004)).sort((x, y) => y.date.localeCompare(x.date));
      return { matched: hit.length, shown: Math.min(lim, hit.length), total_amount: r2(hit.reduce((s, i) => s + i.amount, 0)), invoices: hit.slice(0, lim) };
    }
    case 'financial_analysis': {
      if (!a.from || !a.to) throw new Error('from و to مطلوبان');
      const F = E.finAnalyze(C.org, C.ops, { from: a.from, to: a.to, bf }, C.A); return { ...F, branch: bf ? C.brName(bf === 'central' ? '' : bf) : 'الكل' };
    }
    case 'control_scan': {
      const I = E.ctlScan(C.org, C.ops, { today, A: C.A }).filter(x => !a.category || x.cat === a.category);
      const K = (C.ops.ctlCases || []).filter(c => (!a.category || c.cat === a.category) && (!a.open_only || E.CTL_OPEN.includes(c.status)));
      const by = {}; I.forEach(x => { by[x.cat] = (by[x.cat] || 0) + 1; });
      return { scanned_at: today, issues_now: I.length, by_category: by, issues: I.slice(0, 200).map(x => ({ key: x.key, category: x.cat, severity: x.sev, title: x.title, evidence: x.evidence, impact: x.impact, fix: x.fix, branch: C.brName(x.branchId) })),
        registered_cases: K.length, cases: K.slice(0, 200).map(c => ({ no: c.no, category: c.cat, severity: c.sev, status: c.status, title: c.title, owner: c.owner, due: c.due, impact: c.impact, occurrences: c.occurrences })) };
    }
    case 'journal_entries': {
      const q = norm(a.q); const lim = Math.min(300, Math.max(1, Number(a.limit) || 50));
      const hit = (C.A.entries || []).filter(e => inR(e.date, a) && (!bf || (bf === 'central' ? !e.branchId : e.branchId === bf)) && (!q || norm([e.title, e.no, e.fix, e.ref, e.src].join(' ')).includes(q)));
      return { matched: hit.length, shown: Math.min(lim, hit.length), entries: hit.slice(-lim).map(e => ({ entry_no: e.no, fixed_no: e.fix, date: e.date, title: e.title, source: e.src, ref: e.ref, branch: C.brName(e.branchId),
        lines: (e.lines || []).map(l => ({ code: l.code, name: l.name, debit: r2(l.debit), credit: r2(l.credit) })) })) };
    }
    default: { const e = new Error('أداة غير معروفة: ' + name); e.code = -32602; throw e; }
  }
}

/* ===================== JSON-RPC (MCP) ===================== */
export async function handleRpc(msg, { tools = [...MCP_TOOLS, ...MCP_WRITE_TOOLS], call, version = '' } = {}) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { jsonrpc: '2.0', id: (msg && msg.id) ?? null, error: { code: -32600, message: 'Invalid Request' } };
  if (!('id' in msg)) return null;   // إشعار (notifications/*) — لا رد
  const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result }); const err = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
  const p = msg.params || {};
  switch (msg.method) {
    case 'initialize': return ok({ protocolVersion: MCP_PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : MCP_PROTOCOLS[0], capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mithqal', title: 'مُكتسَب ERP', version: version || '1' },
      instructions: 'موصل مُكتسَب: قراءة مباشرة لبيانات المنشأة المحاسبية الحية (قيود، ميزان، قائمة دخل، مبيعات الفروع، فواتير الموردين وتصنيفها، أرصدة الموردين). ابدأ بـ mithqal_overview لمعرفة الفروع ونطاق التواريخ. الكتابة بأدوات propose_* فقط وهي مقترحات لا تُنفَّذ إلا باعتماد مسؤول النظام في مُكتسَب — لا تقل إنها نُفّذت. المبالغ بالريال السعودي. أجب المستخدم بالعربية.' });
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools });
    case 'tools/call': {
      const t = tools.find(x => x.name === p.name); if (!t) return err(-32602, 'أداة غير معروفة: ' + p.name);
      try { const r = await call(p.name, p.arguments || {}); return ok({ content: [{ type: 'text', text: JSON.stringify(r) }], structuredContent: r, isError: false }); }
      catch (e) { if (e && e.code === -32602) return err(-32602, e.message); return ok({ content: [{ type: 'text', text: 'خطأ: ' + ((e && e.message) || 'تعذّر التنفيذ') }], isError: true }); }
    }
    case 'resources/list': return ok({ resources: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return err(-32601, 'Method not found: ' + msg.method);
  }
}

/* ===================== التركيب على الخادم ===================== */
/* v54.6 — المرحلة 7: نطاق الفروع للرابط — رابط مقيّد يرى بيانات فروعه فقط (العمليات بلا فرع — مستوى الشركة — تُستبعد)، ولا يقترح قيدًا على المركز */
export const SCOPE_RE = /^[A-Za-z0-9_-]{1,60}$/;
export function mcpScope(D, scope) {
  if (!scope || !scope.length) return D; const key = scope.slice().sort().join(','); D._sc = D._sc || new Map(); if (D._sc.has(key)) return D._sc.get(key);
  const set = new Set(scope); const org = D.org || {}, ops = D.ops || {}; const inS = (x) => x && typeof x === 'object' && set.has(String(x.branchId || x.branch || ''));
  const sOps = Object.fromEntries(Object.entries(ops).map(([k, v]) => [k, Array.isArray(v) ? v.filter(inS) : v]));
  const R = { ...D, org: { ...org, branches: (org.branches || []).filter(b => set.has(b.id)) }, ops: sOps, _scope: [...set], _A: null, _sc: null }; D._sc.set(key, R); return R;
}
export function mountMcp(app, { audit = null, refs = null, express, requireMember, requireFeature = () => (q, r, n) => n(), rateLimit, T, fetchImpl = fetch, log = console, engine = null, now = Date.now, publicBase = '', isolate = null }) {
  const json = express.json({ limit: '256kb' }), small = express.json({ limit: '4kb' });
  const toks = new Map(); const tokenFor = (t) => { if (!toks.has(t.id)) toks.set(t.id, saTokenSource(t.sa, { fetchImpl })); return toks.get(t.id)(); };
  const docs = (t) => 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId) + '/databases/(default)/documents';
  const fs = async (t, url, init = {}) => { const r = await fetchImpl(url, { ...init, headers: { authorization: 'Bearer ' + await tokenFor(t), 'content-type': 'application/json', ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j }; };
  const S = (v) => ({ stringValue: String(v) }), Bo = (v) => ({ booleanValue: !!v }), I = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
  let E = engine; const loadEngine = async () => { if (!E) E = await import('./dist-engine/engine.mjs'); return E; };

  // --- إدارة الروابط (من التطبيق، لمسؤول النظام) ---
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const admin = (req, res) => { if (!req.user || req.user.role !== 'system_admin') { res.status(403).json({ error: 'لمسؤول النظام فقط' }); return null; }
    const t = tenantOf(req); if (!t || !t.sa) { res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT) — أضفه في إعدادات Render ثم أعد المحاولة', code: 'no-sa' }); return null; } return t; };
  const listOf = async (t) => { const r = await fs(t, docs(t) + '/mcp_tokens?pageSize=100'); if (!r.ok && r.status !== 404) throw new Error('تعذّرت قراءة الروابط');
    return (r.j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields) })); };
  const lim = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
  const baseOf = (req) => publicBase || (req.protocol + '://' + req.get('host'));

  app.get('/api/mcp/links', requireMember, lim, async (req, res) => {
    const t = admin(req, res); if (!t) return;
    try { const L = await listOf(t); res.json({ links: L.map(x => ({ id: x.id, label: x.label || '', email: x.email || '', createdAt: x.createdAt || '', active: !!x.active, lastUsedAt: x.lastUsedAt || '', calls: Number(x.calls) || 0, hint: x.hint || '', branches: String(x.branches || '').split(',').filter(Boolean) })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) }); }
    catch (e) { log.error('mcp/links', t.id, e.message); res.status(502).json({ error: e.message }); }
  });
  app.post('/api/mcp/links', small, requireMember, requireFeature('ai'), lim, async (req, res) => {
    const t = admin(req, res); if (!t) return;
    const label = String((req.body && req.body.label) || '').trim().slice(0, 60) || 'Claude';
    try {
      const L = await listOf(t); if (L.filter(x => x.active).length >= MAX_TOKENS) return res.status(409).json({ error: 'وصلت الحد (' + MAX_TOKENS + ' روابط نشطة) — ألغِ رابطًا غير مستخدم أولًا' });
      const br = Array.isArray(req.body && req.body.branches) ? [...new Set(req.body.branches.map(String))].slice(0, 30) : []; if (br.some(x => !SCOPE_RE.test(x))) return res.status(400).json({ error: 'معرّف فرع غير صالح' });
      const tok = newToken(t.id), h = hashToken(tok);
      const w = await fs(t, docs(t) + '/mcp_tokens/' + h + '?currentDocument.exists=false', { method: 'PATCH', body: JSON.stringify({ fields: { email: S(req.user.email), label: S(label), createdAt: S(new Date(now()).toISOString()), active: Bo(true), calls: I(0), hint: S(tok.slice(-4)), scope: S('read'), branches: S(br.join(',')) } }) });
      if (!w.ok) throw new Error('تعذّر حفظ الرابط');
      log.log('mcp: رابط جديد', t.id, req.user.email, label);
      res.json({ id: h, url: baseOf(req) + '/mcp/' + tok, label, branches: br });
    } catch (e) { log.error('mcp/create', t.id, e.message); res.status(502).json({ error: e.message }); }
  });
  app.post('/api/mcp/links/revoke', small, requireMember, lim, async (req, res) => {
    const t = admin(req, res); if (!t) return;
    const id = String((req.body && req.body.id) || ''); if (!/^[a-f0-9]{64}$/.test(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
    try { const w = await fs(t, docs(t) + '/mcp_tokens/' + id + '?updateMask.fieldPaths=active&updateMask.fieldPaths=revokedAt&updateMask.fieldPaths=revokedBy&currentDocument.exists=true',
      { method: 'PATCH', body: JSON.stringify({ fields: { active: Bo(false), revokedAt: S(new Date(now()).toISOString()), revokedBy: S(req.user.email) } }) });
      if (!w.ok) return res.status(w.status === 404 ? 404 : 502).json({ error: w.status === 404 ? 'الرابط غير موجود' : 'تعذّر الإلغاء' });
      auth.delete(id); log.log('mcp: أُلغي رابط', t.id, req.user.email); res.json({ ok: true }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });

  // --- v53.7: المقترحات (mcp_proposals/{id}) — يكتبها الخادم وحده؛ التطبيق يقرؤها ويقرّر عبر الخادم، والتنفيذ بالحفظ العادي في التطبيق ---
  const MAX_PENDING = 50;
  const propList = async (t) => { const r = await fs(t, docs(t) + '/mcp_proposals?pageSize=300'); if (!r.ok && r.status !== 404) throw new Error('تعذّرت قراءة المقترحات');
    return (r.j.documents || []).map(d => { const f = decodeFields(d.fields); let payload = null, summary = null; try { payload = JSON.parse(f.payload || 'null'); summary = JSON.parse(f.summary || 'null'); } catch { }
      return { id: d.name.split('/').pop(), kind: f.kind, status: f.status, title: f.title || '', reason: f.reason || '', by: f.by || '', link: f.link || '', createdAt: f.createdAt || '', decidedAt: f.decidedAt || '', decidedBy: f.decidedBy || '', note: f.note || '', payload, summary }; })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); };
  const listProposals = async (t, status) => ({ proposals: (await propList(t)).filter(p => !status || p.status === status).slice(0, 100).map(({ payload, ...p }) => p) });
  const storeProposal = async (v, P) => {
    const L = await propList(v.t); if (L.filter(p => p.status === 'pending').length >= MAX_PENDING) throw new Error('يوجد ' + MAX_PENDING + ' مقترحًا بانتظار الاعتماد — اطلب من المستخدم مراجعتها أولًا');
    const body = JSON.stringify(P.payload); if (body.length > 900000) throw new Error('المقترح كبير جدًا — قسّمه');
    const id = 'mp-' + new Date(now()).toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(5).toString('hex');
    const w = await fs(v.t, docs(v.t) + '/mcp_proposals/' + id + '?currentDocument.exists=false', { method: 'PATCH', body: JSON.stringify({ fields: { kind: S(P.kind), status: S('pending'), title: S(P.title), reason: S(P.reason || ''),
      payload: S(body), summary: S(JSON.stringify(P.summary)), by: S(v.email), link: S(v.h.slice(0, 12)), createdAt: S(new Date(now()).toISOString()) } }) });
    if (!w.ok) throw new Error('تعذّر حفظ المقترح');
    log.log('mcp: مقترح', v.t.id, id, P.kind);
    return { proposal_id: id, status: 'pending', kind: P.kind, title: P.title, summary: P.summary, next: 'بانتظار اعتماد مسؤول النظام في مُكتسَب: الإعدادات ← ربط Claude ← المقترحات. لم يُنفَّذ شيء بعد.' };
  };
  // v54.5 — المرحلة 6: قيد تصحيحي من «وكيل المراجعة» يمر بنفس تحقق propose_journal_entry ويُحفظ مقترحًا بانتظار اعتماد مسؤول النظام — لا ترحيل مباشر
  const REV_ROLES = new Set(['system_admin', 'finance_department', 'accountant', 'general_management', 'head_office']);
  app.post('/api/mcp/proposals/review', requireMember, lim, express.json({ limit: '64kb' }), async (req, res) => {
    if (!req.user || !REV_ROLES.has(req.user.role)) return res.status(403).json({ error: 'للمالية والإدارة فقط' });
    const t = tenantOf(req); if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم', code: 'no-sa' });
    const b = req.body || {}; const caseNo = String(b.caseNo || '').slice(0, 20);
    const args = { date: String(b.date || '').slice(0, 10), title: String(b.title || ('تصحيح ' + caseNo)).slice(0, 140), lines: Array.isArray(b.lines) ? b.lines.slice(0, 20) : [], ...(b.branch ? { branch: String(b.branch) } : {}),
      reason: ('من وكيل المراجعة — الحالة ' + caseNo + (b.reason ? ' · ' + String(b.reason) : '')).slice(0, 500) };
    const v = { t, email: req.user.email, h: 'review-agent' };
    try { const P = isolate ? await inWorker(t, 'propose', 'propose_journal_entry', args) : proposeTool(await loadEngine(), await loadData(t), 'propose_journal_entry', args);
      P.summary = { ...P.summary, case: caseNo, citations: (Array.isArray(b.citations) ? b.citations : []).slice(0, 6).map(c => String(c).slice(0, 200)) };
      res.json(await storeProposal(v, P)); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/mcp/proposals', requireMember, lim, async (req, res) => {
    const t = admin(req, res); if (!t) return;
    try { res.json({ proposals: (await propList(t)).slice(0, 200) }); } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.post('/api/mcp/proposals/decide', requireMember, lim, express.json({ limit: '64kb' }), async (req, res) => {
    const t = admin(req, res); if (!t) return;
    const b = req.body || {}; const id = String(b.id || ''); const dec = String(b.decision || '');
    if (!/^mp-\d{8}-[a-f0-9]{10}$/.test(id) || !['applied', 'rejected'].includes(dec)) return res.status(400).json({ error: 'طلب غير صالح' });
    try {
      const cur = await fs(t, docs(t) + '/mcp_proposals/' + id); if (!cur.ok) return res.status(404).json({ error: 'المقترح غير موجود' });
      const st = decodeFields(cur.j.fields).status; if (st !== 'pending') return res.status(409).json({ error: 'سبق البت في هذا المقترح (' + st + ')', status: st });
      const w = await fs(t, docs(t) + '/mcp_proposals/' + id + '?updateMask.fieldPaths=status&updateMask.fieldPaths=decidedAt&updateMask.fieldPaths=decidedBy&updateMask.fieldPaths=note&currentDocument.updateTime=' + encodeURIComponent(cur.j.updateTime || ''),
        { method: 'PATCH', body: JSON.stringify({ fields: { status: S(dec), decidedAt: S(new Date(now()).toISOString()), decidedBy: S(req.user.email), note: S(String(b.note || '').slice(0, 500)) } }) });
      if (!w.ok) return res.status(w.status === 400 || w.status === 412 ? 409 : 502).json({ error: 'تعذّر تسجيل القرار — أعد المحاولة' });
      log.log('mcp: قرار', t.id, id, dec, req.user.email); res.json({ ok: true });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // --- التحقق من الرابط عند كل طلب (مخبأ دقيقة) ---
  const auth = new Map();
  // v53.9: يعيد { v, why } — سبب الرفض يُسجَّل في سجلات الخادم (بلا المفتاح نفسه) لتشخيص الربط
  const verify = async (tok) => {
    const p = parseToken(tok); if (!p) return { v: null, why: 'شكل الرابط غير صحيح (len=' + String(tok || '').length + ')' };
    const t = T.byId(p.tenant); if (!t) return { v: null, why: 'منشأة غير معروفة: ' + p.tenant };
    if (!t.sa) return { v: null, why: 'لا يوجد حساب خدمة للمنشأة ' + t.id };
    const h = hashToken(tok); const c = auth.get(h); if (c && c.exp > now()) return c.r;
    let r = { v: null, why: '' };
    const d = await fs(t, docs(t) + '/mcp_tokens/' + h);
    if (!d.ok) r.why = 'الرابط غير موجود في القاعدة (' + d.status + ')';
    else { const f = decodeFields(d.j.fields);
      if (f.active !== true) r.why = 'الرابط ملغى';
      else if (!f.email) r.why = 'الرابط بلا بريد صاحبه';
      else {
        const m = await fs(t, docs(t) + '/members/' + encodeURIComponent(String(f.email).toLowerCase()));
        const mf = m.ok ? decodeFields(m.j.fields) : {};
        if (!m.ok) r.why = 'تعذّرت قراءة عضوية ' + f.email + ' (' + m.status + ')';
        else if (mf.active !== true) r.why = 'عضوية ' + f.email + ' غير نشطة';
        else if (mf.role !== 'system_admin') r.why = 'دور ' + f.email + ' ليس مسؤول نظام (' + mf.role + ')';
        else r = { v: { t, h, email: f.email, calls: Number(f.calls) || 0, lastUsedAt: f.lastUsedAt || '', scope: String(f.branches || '').split(',').filter(Boolean) }, why: '' }; } }
    auth.set(h, { r, exp: now() + 60000 }); if (auth.size > 500) auth.delete(auth.keys().next().value);
    return r;
  };
  const touch = async (v) => { const last = Date.parse(v.lastUsedAt || 0) || 0; v.calls++; if (now() - last < 5 * 60000) return; v.lastUsedAt = new Date(now()).toISOString();
    try { await fs(v.t, docs(v.t) + '/mcp_tokens/' + v.h + '?updateMask.fieldPaths=lastUsedAt&updateMask.fieldPaths=calls&currentDocument.exists=true', { method: 'PATCH', body: JSON.stringify({ fields: { lastUsedAt: S(v.lastUsedAt), calls: I(v.calls) } }) }); } catch { } };

  // --- البيانات: كل مستندات platform بحساب الخدمة ⇒ تجميع منطقي (مخبأ دقيقتين لكل منشأة) ---
  const data = new Map();
  const loadData = (t) => { const c = data.get(t.id); if (c && c.exp > now()) return c.p;
    const p = loadPlatformData(docs(t), (u, init) => fs(t, u, init), now);
    data.set(t.id, { p, exp: now() + 120000 }); p.catch(() => data.delete(t.id)); return p; };

  // v53.9: عزل الحساب في عامل بحد ذاكرة مستقل — نفاد الذاكرة أو التعليق يُنهي العامل وحده لا الخادم (الفوترة والذكاء الاصطناعي)
  let W = null; const pend = new Map(); let seq = 0; let lastFail = null;   // سبب آخر فشل للعامل — يُعرض بدل «ما زال يجهّز»
  const failAll = (msg) => { pend.forEach(p => { clearTimeout(p.tm); p.rej(new Error(msg)); }); pend.clear(); };
  const worker = () => { if (W) return W;
    W = new Worker(new URL('./server-mcp-worker.mjs', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: isolate.heapMb || 220 } });
    W.unref(); W.on('message', (m) => { if (m.ok) lastFail = null; if (!pend.size) clearTimeout(hard); const p = pend.get(m.id); if (!p) return; pend.delete(m.id); clearTimeout(p.tm); if (m.ver) appVer = m.ver;
      if (m.ok) p.res(m.result); else { const e = new Error(m.error); if (m.code) e.code = m.code; p.rej(e); } });
    W.on('error', (e) => { log.error('mcp worker', e && (e.code || e.message)); lastFail = { at: now(), oom: !!(e && e.code === 'ERR_WORKER_OUT_OF_MEMORY') }; failAll(e && e.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'بيانات المنشأة أكبر من ذاكرة الموصل المتاحة (MCP_WORKER_MB) — رقِّ خطة الخادم وارفع السقف؛ بقية المنصة لم تتأثر' : 'تعذّر الحساب — أعد المحاولة'); W = null; });
    W.on('exit', (c) => { if (c) failAll('توقف الحساب — أعد المحاولة'); W = null; });
    return W; };
  let appVer = '';
  // مهلتان: «لينة» تعيد رسالة للمستخدم ويواصل العامل الحساب ويخبّئ النتيجة (المعالج في الخطة المجانية بطيء: 0.1 CPU)،
  // و«صلبة» تُنهي العامل إن علق فعلًا
  let hard = null; const armHard = () => { clearTimeout(hard); hard = setTimeout(() => { if (W) { log.error('mcp worker: مهلة صلبة — إنهاء'); try { W.terminate(); } catch { } W = null; } }, isolate.hardMs || 600000); };
  const inWorker = (t, op, name, args, scope = []) => new Promise((res, rej) => { const id = ++seq; const w = worker(); armHard();
    const tm = setTimeout(() => { const p = pend.get(id); if (!p) return; pend.delete(id);
      rej(new Error(lastFail && lastFail.oom && now() - lastFail.at < 15 * 60000 ? 'بيانات المنشأة أكبر من ذاكرة الموصل في الخطة الحالية (نفدت أثناء التجهيز) — بقية المنصة تعمل؛ الحل ترقية خطة الخادم' : 'ما زال الخادم يجهّز بيانات المنشأة (أول طلب بعد الخمول يأخذ دقائق على الخطة المجانية) — أعد السؤال بعد دقيقة أو دقيقتين')); }, isolate.timeoutMs || 100000);
    pend.set(id, { res, rej, tm }); w.postMessage({ id, t: { id: t.id, sa: t.sa, projectId: t.projectId, dataProject: t.dataProject }, op, name, args: args || {}, scope }); });

  // v53.9: سطر لكل طلب من Claude (المفتاح مخفي) — لتشخيص الربط لأن سجلات الطلبات غير متاحة في خطة Render المجانية
  if (typeof app.use === 'function') app.use((req, res, next) => {
    if (!/^\/(mcp\/|\.well-known\/|authorize|register|token)/.test(req.path)) return next();
    const t0 = now(); const path = req.path.replace(/(mq_[a-z0-9-]+_)[A-Za-z0-9_-]*?([A-Za-z0-9_-]{4})(?=\/|$)/g, '$1…$2');
    res.on('finish', () => log.log('mcp طلب:', req.method, path, res.statusCode, (now() - t0) + 'ms', String(req.headers['user-agent'] || '').slice(0, 40)));
    next();
  });
  const mlim = rateLimit({ windowMs: 60000, max: 60, keyFn: (r) => 'mcp:' + hashToken(r.params.token || '').slice(0, 16) });
  const deny = (res, code, msg) => res.status(code).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: msg } });
  // v53.9 أمان: حد لكل عنوان IP (لا يكفي الحد لكل رابط — من يجرّب روابط كثيرة يتجاوزه)، وحظر مؤقت بعد محاولات فاشلة متكررة
  const iplim = rateLimit({ windowMs: 60000, max: 120, keyFn: (r) => 'mcpip:' + (r.ip || '') });
  const fails = new Map(); const FAIL_MAX = 10, FAIL_WIN = 15 * 60000;
  const blocked = (ip) => { const f = fails.get(ip); return !!(f && now() - f.t < FAIL_WIN && f.n >= FAIL_MAX); };
  const failed = (ip) => { const f = fails.get(ip); if (!f || now() - f.t >= FAIL_WIN) fails.set(ip, { t: now(), n: 1 }); else f.n++; if (fails.size > 5000) fails.delete(fails.keys().next().value); };
  // حماية من DNS rebinding/الطلبات من المتصفح (توصية مواصفة MCP): يُرفض أي Origin غير Claude — خوادم Claude لا ترسل Origin أصلًا
  const ORIGIN_OK = /^https:\/\/([a-z0-9-]+\.)?(claude\.ai|claude\.com|anthropic\.com)$/i;
  app.post('/mcp/:token', iplim, mlim, (req, res, next) => {
    const o = String((req.headers || {}).origin || ''); if (o && !ORIGIN_OK.test(o)) { log.error('mcp رفض: Origin غير مسموح', o.slice(0, 80)); return deny(res, 403, 'مصدر غير مسموح'); }
    if (blocked(req.ip || '')) return deny(res, 429, 'محاولات فاشلة كثيرة — أعد المحاولة لاحقًا');
    next(); }, json, async (req, res) => {
    let r; try { r = await verify(req.params.token); } catch (e) { log.error('mcp verify', e.message); return deny(res, 503, 'تعذّر التحقق من الرابط'); }
    const v = r.v;
    // 403 لا 401: الرد 401 يجعل Claude يظن أن الخادم يطلب تسجيل دخول OAuth فيفتح /authorize (غير موجود)
    // السبب التفصيلي في سجل الخادم فقط — لا يُكشف للطالب (قد يتضمن بريد صاحب الرابط ودوره)
    if (!v) { failed(req.ip || ''); log.error('mcp رفض:', r.why); return deny(res, 403, 'رابط ربط غير صالح أو أُلغي — أنشئ رابطًا جديدًا من مُكتسَب: الإعدادات ← ربط Claude'); }
    const msgs = Array.isArray(req.body) ? req.body : [req.body];
    if (msgs.length > 20) return deny(res, 400, 'دفعة طلبات كبيرة');
    let D = null; const call = async (name, args) => { const t0 = now(); try { const out = await call0(name, args); if (audit) audit(v.t.id, { by: v.email, role: 'system_admin', kind: WRITE_NAMES.has(name) ? 'proposal' : 'mcp', name, ok: true, ms: now() - t0, detail: (v.scope || []).length ? 'نطاق: ' + v.scope.length + ' فرع' : '' }); return out; }
      catch (e) { if (audit) audit(v.t.id, { by: v.email, role: 'system_admin', kind: WRITE_NAMES.has(name) ? 'proposal' : 'mcp', name, ok: false, ms: now() - t0, detail: String(e.message || '').slice(0, 200) }); throw e; } };
    const call0 = async (name, args) => { touch(v); const sc = v.scope || [];
      log.log('mcp:', v.t.id, v.email, name);
      if (name === 'search_references') { if (!refs) throw new Error('مكتبة المراجع غير متاحة'); const hits = await refs.search(v.t, args); return { hits, count: hits.length, note: hits.length ? 'مقتطفات حرفية — استشهد بالعنوان والصفحة' : 'لا نتائج في المراجع المرفوعة — لا تستشهد بمراجع غير موجودة' }; }
      if (name === 'list_proposals') return listProposals(v.t, args.status);
      if (isolate) return WRITE_NAMES.has(name) ? storeProposal(v, await inWorker(v.t, 'propose', name, args, sc)) : inWorker(v.t, 'run', name, args, sc);
      if (!D) D = mcpScope(await loadData(v.t), sc); const En = await loadEngine();
      if (WRITE_NAMES.has(name)) return storeProposal(v, proposeTool(En, D, name, args));
      return runTool(En, D, name, args); };
    const out = []; for (const m of msgs) { const r = await handleRpc(m, { call, version: (E && E.APP_VER) || appVer || '' }); if (r) out.push(r); }
    if (!out.length) return res.status(202).end();
    res.json(Array.isArray(req.body) ? out : out[0]);
  });
  app.get('/mcp/:token', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'استخدم POST (MCP عبر HTTP)' }));
  app.delete('/mcp/:token', (_req, res) => res.status(405).set('Allow', 'POST').end());
  return { verify, loadData, auth, data };
}
