/**
 * v53.5 — موصل Claude (MCP) للقراءة فقط: يربط تطبيق Claude ببيانات مثقال الحية (طلب المالك 2026-11-23).
 * • مسؤول النظام يُنشئ «رابط ربط» من الإعدادات ← ربط Claude. الرابط سرّي (رمز عشوائي 256 بت)، ويُخزَّن منه بصمته فقط (SHA-256)
 *   في mcp_tokens/{بصمة} بقاعدة المنشأة نفسها (قواعد Firestore تمنع العملاء من قراءتها — الخادم وحده بحساب الخدمة).
 * • كل طلب: الرمز صالح ونشط ⇒ صاحبه ما زال عضوًا نشطًا بدور «مسؤول النظام» ⇒ تُقرأ البيانات بحساب خدمة المنشأة.
 * • للقراءة فقط: لا أداة تكتب أو تعدّل أو تحذف. لا يُطبع الرمز في أي سجل. الإلغاء من الواجهة يوقفه فورًا (خلال دقيقة كحد أقصى).
 * • البروتوكول: MCP عبر HTTP (JSON-RPC 2.0، رد JSON مباشر بلا SSE) — POST /mcp/<الرمز>.
 */
import crypto from 'node:crypto';
import { saTokenSource } from './server-billing.js';
import { decodeFields, assemble, composeLogical } from './scripts/backup-lib.mjs';

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
  { name: 'journal_entries', title: 'قيود اليومية', description: 'قيود اليومية (الآلية واليدوية) لفترة مع بنودها. ابحث في البيان أو رقم القيد أو المرجع. limit الافتراضي 50.', inputSchema: { type: 'object', properties: { from: FROM, to: TO, q: { type: 'string' }, branch: BR, limit: { type: 'integer', minimum: 1, maximum: 300 } } } },
].map(t => ({ ...t, annotations: { ...RO, title: t.title } }));

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
export async function handleRpc(msg, { tools = MCP_TOOLS, call, version = '' } = {}) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { jsonrpc: '2.0', id: (msg && msg.id) ?? null, error: { code: -32600, message: 'Invalid Request' } };
  if (!('id' in msg)) return null;   // إشعار (notifications/*) — لا رد
  const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result }); const err = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
  const p = msg.params || {};
  switch (msg.method) {
    case 'initialize': return ok({ protocolVersion: MCP_PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : MCP_PROTOCOLS[0], capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mithqal', title: 'مِثقال ERP', version: version || '1' },
      instructions: 'موصل مثقال للقراءة فقط: بيانات المنشأة المحاسبية الحية (قيود، ميزان، قائمة دخل، مبيعات الفروع، فواتير الموردين وتصنيفها، أرصدة الموردين). ابدأ بـ mithqal_overview لمعرفة الفروع ونطاق التواريخ. المبالغ بالريال السعودي. أجب المستخدم بالعربية.' });
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
export function mountMcp(app, { express, requireMember, requireFeature = () => (q, r, n) => n(), rateLimit, T, fetchImpl = fetch, log = console, engine = null, now = Date.now, publicBase = '' }) {
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
    try { const L = await listOf(t); res.json({ links: L.map(x => ({ id: x.id, label: x.label || '', email: x.email || '', createdAt: x.createdAt || '', active: !!x.active, lastUsedAt: x.lastUsedAt || '', calls: Number(x.calls) || 0, hint: x.hint || '' })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) }); }
    catch (e) { log.error('mcp/links', t.id, e.message); res.status(502).json({ error: e.message }); }
  });
  app.post('/api/mcp/links', small, requireMember, requireFeature('ai'), lim, async (req, res) => {
    const t = admin(req, res); if (!t) return;
    const label = String((req.body && req.body.label) || '').trim().slice(0, 60) || 'Claude';
    try {
      const L = await listOf(t); if (L.filter(x => x.active).length >= MAX_TOKENS) return res.status(409).json({ error: 'وصلت الحد (' + MAX_TOKENS + ' روابط نشطة) — ألغِ رابطًا غير مستخدم أولًا' });
      const tok = newToken(t.id), h = hashToken(tok);
      const w = await fs(t, docs(t) + '/mcp_tokens/' + h + '?currentDocument.exists=false', { method: 'PATCH', body: JSON.stringify({ fields: { email: S(req.user.email), label: S(label), createdAt: S(new Date(now()).toISOString()), active: Bo(true), calls: I(0), hint: S(tok.slice(-4)), scope: S('read') } }) });
      if (!w.ok) throw new Error('تعذّر حفظ الرابط');
      log.log('mcp: رابط جديد', t.id, req.user.email, label);
      res.json({ id: h, url: baseOf(req) + '/mcp/' + tok, label });
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

  // --- التحقق من الرابط عند كل طلب (مخبأ دقيقة) ---
  const auth = new Map();
  const verify = async (tok) => {
    const p = parseToken(tok); if (!p) return null; const t = T.byId(p.tenant); if (!t || !t.sa) return null;
    const h = hashToken(tok); const c = auth.get(h); if (c && c.exp > now()) return c.v;
    let v = null;
    const d = await fs(t, docs(t) + '/mcp_tokens/' + h);
    if (d.ok) { const f = decodeFields(d.j.fields); if (f.active === true && f.email) {
      const m = await fs(t, docs(t) + '/members/' + encodeURIComponent(String(f.email).toLowerCase()));
      const mf = m.ok ? decodeFields(m.j.fields) : {};
      if (mf.active === true && mf.role === 'system_admin') v = { t, h, email: f.email, calls: Number(f.calls) || 0, lastUsedAt: f.lastUsedAt || '' }; } }
    auth.set(h, { v, exp: now() + 60000 }); if (auth.size > 500) auth.delete(auth.keys().next().value);
    return v;
  };
  const touch = async (v) => { const last = Date.parse(v.lastUsedAt || 0) || 0; v.calls++; if (now() - last < 5 * 60000) return; v.lastUsedAt = new Date(now()).toISOString();
    try { await fs(v.t, docs(v.t) + '/mcp_tokens/' + v.h + '?updateMask.fieldPaths=lastUsedAt&updateMask.fieldPaths=calls&currentDocument.exists=true', { method: 'PATCH', body: JSON.stringify({ fields: { lastUsedAt: S(v.lastUsedAt), calls: I(v.calls) } }) }); } catch { } };

  // --- البيانات: كل مستندات platform بحساب الخدمة ⇒ تجميع منطقي (مخبأ دقيقتين لكل منشأة) ---
  const data = new Map();
  const loadData = (t) => { const c = data.get(t.id); if (c && c.exp > now()) return c.p;
    const p = (async () => { const all = {}; let pt = '';
      for (let i = 0; i < 100; i++) { const r = await fs(t, docs(t) + '/platform?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''));
        if (!r.ok) throw new Error('تعذّرت قراءة بيانات المنشأة (' + r.status + ')');
        (r.j.documents || []).forEach(d => { all[d.name.split('/').pop()] = decodeFields(d.fields); }); pt = r.j.nextPageToken || ''; if (!pt) break; }
      const A = assemble(all); const L = composeLogical(A.values); return { org: L.org || {}, ops: L.ops || {}, _at: new Date(now()).toISOString() }; })();
    data.set(t.id, { p, exp: now() + 120000 }); p.catch(() => data.delete(t.id)); return p; };

  const mlim = rateLimit({ windowMs: 60000, max: 60, keyFn: (r) => 'mcp:' + hashToken(r.params.token || '').slice(0, 16) });
  const deny = (res, code, msg) => res.status(code).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: msg } });
  app.post('/mcp/:token', mlim, json, async (req, res) => {
    let v; try { v = await verify(req.params.token); } catch (e) { log.error('mcp verify', e.message); return deny(res, 503, 'تعذّر التحقق من الرابط'); }
    if (!v) return deny(res, 401, 'رابط ربط غير صالح أو أُلغي — أنشئ رابطًا جديدًا من مثقال: الإعدادات ← ربط Claude');
    const msgs = Array.isArray(req.body) ? req.body : [req.body];
    let D = null; const call = async (name, args) => { if (!D) D = await loadData(v.t); const En = await loadEngine(); touch(v);
      log.log('mcp:', v.t.id, v.email, name); return runTool(En, D, name, args); };
    const out = []; for (const m of msgs) { const r = await handleRpc(m, { call, version: (E && E.APP_VER) || '' }); if (r) out.push(r); }
    if (!out.length) return res.status(202).end();
    res.json(Array.isArray(req.body) ? out : out[0]);
  });
  app.get('/mcp/:token', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'استخدم POST (MCP عبر HTTP)' }));
  app.delete('/mcp/:token', (_req, res) => res.status(405).set('Allow', 'POST').end());
  return { verify, loadData, auth, data };
}
