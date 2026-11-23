/* v53.5 — موصل Claude (MCP) للقراءة فقط: الروابط السرية، التحقق، بروتوكول JSON-RPC، وأدوات القراءة على محرك المحاسبة الحقيقي */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { mountMcp, handleRpc, MCP_TOOLS, MCP_WRITE_TOOLS, runTool, proposeTool, hashToken, parseToken, newToken } from '../server-mcp.js';
import { loadTenants } from '../tenants.js';
import { buildMcpEngine } from '../scripts/build-mcp-engine.mjs';

const out = path.join(path.dirname(new URL(import.meta.url).pathname), '.cache', 'mq-engine-' + process.pid + '.mjs');
await buildMcpEngine(out); const E = await import(out); fs.unlinkSync(out);

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@altaif-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'altaif-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'altaif-prod', FIREBASE_SERVICE_ACCOUNT: SA };
const ORG = { company: { name: 'شركة الطيف الأولى', taxNumber: '312703692100003' }, taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }],
  suppliers: [{ id: 's1', name: 'مكين' }], accCls: { 5198: 'pur' } };
const OPS = { invoices: [
  { id: 'i1', kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: 'F-1', amount: 1150, vatAmt: 150, taxable: true, date: '2026-01-05', dueDate: '2026-01-05', branchId: 'b1', jeNo: 'PJ-000001', importNo: 'IMP-0001', expLines: [{ accCode: '5198', net: 1000, vat: 150 }], cls: 'pur' },
  { id: 'i2', kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: 'F-2', amount: 230, vatAmt: 30, taxable: true, date: '2026-01-06', dueDate: '2026-01-06', branchId: 'b2', jeNo: 'PJ-000002', expLines: [{ accCode: '5199', net: 200, vat: 30 }], cls: 'exp',
    paidAmount: 230, payments: [{ id: 'p', amount: 230, date: '2026-01-06', fund: '1101' }] }] };

function harness({ env = ENV, role = 'system_admin', memberRole = 'system_admin', memberActive = true } = {}) {
  const routes = {}; const reg = (m) => (p, ...h) => { routes[m + ' ' + p] = h; };
  const app = { get: reg('GET'), post: reg('POST'), delete: reg('DELETE') };
  const store = { mcp_tokens: {}, mcp_proposals: {} }; const sent = []; const logs = [];
  const platform = { rms8_org: { parts: 1, value: JSON.stringify(ORG) }, rms8_core: { parts: 1, value: JSON.stringify(OPS) } };
  const enc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) }]));
  const fetchImpl = async (u, i = {}) => { sent.push({ u, method: i.method || 'GET', body: i.body });
    const J = (status, j) => ({ ok: status < 300, status, json: async () => j });
    if (u.includes('oauth2')) return J(200, { access_token: 'AT', expires_in: 3600 });
    const m = /\/documents\/(.+?)(\?|$)/.exec(u); const p = m ? decodeURIComponent(m[1]) : '';
    if (p.startsWith('members/')) return memberActive != null ? J(200, { fields: enc({ role: memberRole, active: memberActive }) }) : J(404, {});
    if (p === 'platform') return J(200, { documents: Object.entries(platform).map(([id, f]) => ({ name: 'x/platform/' + id, fields: enc(f) })) });
    const [col, id] = p.split('/');
    if (store[col] && !id) return J(200, { documents: Object.entries(store[col]).map(([k, f]) => ({ name: 'x/' + col + '/' + k, fields: enc(f) })) });
    if (store[col] && id) {
      if (i.method === 'PATCH') { const f = Object.fromEntries(Object.entries(JSON.parse(i.body).fields).map(([k, v]) => [k, 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : v.stringValue]));
        if (u.includes('exists=true') && !store[col][id]) return J(404, {}); if (u.includes('exists=false') && store[col][id]) return J(409, {}); store[col][id] = { ...(store[col][id] || {}), ...f }; return J(200, {}); }
      return store[col][id] ? J(200, { fields: enc(store[col][id]), updateTime: '2026-01-01T00:00:00Z' }) : J(404, {}); }
    return J(404, {}); };
  const user = { email: 'o@altaif.sa', role, tenant: 'default' };
  const requireMember = (req, res, next) => { req.user = user; next(); };
  let t = 1_800_000_000_000;
  mountMcp(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), fetchImpl, engine: E, now: () => t,
    log: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) } });
  const call = async (key, { body, params = {} } = {}) => { const req = { body, params, protocol: 'https', get: () => 'mithqal.onrender.com', user: null }; const o = { status: 200, headers: {} };
    const res = { status(c) { o.status = c; return this; }, json(j) { o.json = j; return this; }, end() { o.ended = true; return this; }, set(k, v) { o.headers[k] = v; return this; } };
    for (const h of routes[key]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return o; };
  return { call, store, sent, logs, tick: (ms) => { t += ms; } };
}
const rpc = (H, tok, msg) => H.call('POST /mcp/:token', { params: { token: tok }, body: msg });

test('إنشاء رابط: لمسؤول النظام فقط، يُخزَّن بصمته لا الرمز، ولا يظهر الرمز في السجل', async () => {
  const H = harness();
  const r = await H.call('POST /api/mcp/links', { body: { label: 'هاتفي' } });
  assert.equal(r.status, 200); assert.match(r.json.url, /^https:\/\/mithqal\.onrender\.com\/mcp\/mq_default_[A-Za-z0-9_-]{43}$/);
  const tok = r.json.url.split('/mcp/')[1]; const h = hashToken(tok);
  assert.equal(r.json.id, h); assert.ok(H.store.mcp_tokens[h]); assert.equal(H.store.mcp_tokens[h].email, 'o@altaif.sa');
  assert.ok(!JSON.stringify(H.store).includes(tok), 'الرمز نفسه لا يُخزَّن'); assert.ok(!H.logs.join('\n').includes(tok) && !H.sent.some(s => String(s.body || '').includes(tok)));
  const L = await H.call('GET /api/mcp/links'); assert.equal(L.json.links.length, 1); assert.equal(L.json.links[0].label, 'هاتفي'); assert.equal(L.json.links[0].hint, tok.slice(-4));
  assert.equal((await harness({ role: 'accountant' }).call('POST /api/mcp/links', { body: {} })).status, 403);
  const N = await harness({ env: { ...ENV, FIREBASE_SERVICE_ACCOUNT: '' } }).call('POST /api/mcp/links', { body: {} }); assert.equal(N.status, 409); assert.equal(N.json.code, 'no-sa');
  assert.deepEqual(parseToken(newToken('default')), { tenant: 'default' }); assert.equal(parseToken('mq_default_short'), null);
});

test('البروتوكول: تهيئة، إشعار بلا رد، قائمة أدوات للقراءة فقط، واستدعاء أداة على بيانات المنشأة', async () => {
  const H = harness(); const tok = (await H.call('POST /api/mcp/links', { body: {} })).json.url.split('/mcp/')[1];
  const i = await rpc(H, tok, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude' } } });
  assert.equal(i.json.result.protocolVersion, '2025-06-18'); assert.equal(i.json.result.serverInfo.name, 'mithqal'); assert.ok(i.json.result.capabilities.tools);
  const n = await rpc(H, tok, { jsonrpc: '2.0', method: 'notifications/initialized' }); assert.equal(n.status, 202);
  const L = await rpc(H, tok, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(L.json.result.tools.length, MCP_TOOLS.length + MCP_WRITE_TOOLS.length); assert.ok(L.json.result.tools.filter(t => !/^propose_/.test(t.name)).every(t => t.annotations.readOnlyHint === true && t.inputSchema.type === 'object'));
  assert.ok(L.json.result.tools.filter(t => /^propose_/.test(t.name)).every(t => t.annotations.readOnlyHint === false && t.annotations.destructiveHint === false));
  const o = await rpc(H, tok, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'mithqal_overview', arguments: {} } });
  const ov = o.json.result.structuredContent; assert.equal(ov.company, 'شركة الطيف الأولى'); assert.deepEqual(ov.branches.map(b => b.name), ['طيبة', 'النسيم']); assert.equal(ov.counts.supplier_invoices, 2);
  assert.equal(JSON.parse(o.json.result.content[0].text).company, 'شركة الطيف الأولى');
  const u = await rpc(H, tok, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'delete_everything', arguments: {} } }); assert.equal(u.json.error.code, -32602);
  const bad = await rpc(H, tok, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'income_statement', arguments: { from: '2026/01/01', to: '2026-01-31' } } }); assert.equal(bad.json.result.isError, true);
  assert.equal((await rpc(H, tok, { jsonrpc: '2.0', id: 6, method: 'nope' })).json.error.code, -32601);
  assert.ok(H.logs.some(l => l.includes('mithqal_overview')) && !H.logs.join('\n').includes(tok));
});

test('أدوات القراءة: قائمة الدخل، التصنيف، البحث بالرقم الثابت، الأستاذ، الأرصدة، والفرع', () => {
  const D = { org: ORG, ops: OPS, _at: 'x' };
  const IS = runTool(E, D, 'income_statement', { from: '2026-01-01', to: '2026-01-31' });
  assert.equal(IS.cost_of_sales, 1000, '5198 مصنّف مشتريات ⇒ تكلفة مبيعات'); assert.equal(IS.operating_expenses, 200); assert.equal(IS.net_profit, -1200);
  const P = runTool(E, D, 'purchases_by_class', {}); assert.deepEqual(P.classes.map(c => [c.cls, c.total]).sort(), [['exp', 230], ['pur', 1150]]);
  assert.equal(runTool(E, D, 'purchases_by_class', { branch: 'النسيم' }).grand_total, 230);
  const S = runTool(E, D, 'search_invoices', { q: 'pj-000001' }); assert.equal(S.matched, 1); assert.equal(S.invoices[0].import_no, 'IMP-0001'); assert.equal(S.invoices[0].remaining, 1150);
  const B = runTool(E, D, 'supplier_balances', {}, '2026-02-01'); assert.equal(B.rows[0].remaining, 1150); assert.equal(B.rows[0].overdue, 1150);
  const G = runTool(E, D, 'account_ledger', { code: '2101' }); assert.equal(G.closing, 1150); assert.ok(G.rows.some(r => r.fixed_no === 'PJ-000002/س1'));
  const T = runTool(E, D, 'trial_balance', { to: '2026-01-31' }); assert.equal(T.balanced, true);
  assert.throws(() => runTool(E, D, 'trial_balance', { branch: 'جدة' }), /فرع غير معروف/);
  assert.ok(runTool(E, D, 'chart_of_accounts', { q: '2101' }).accounts.some(a => a.code === '2101'));
  assert.ok(runTool(E, D, 'journal_entries', { q: 'PJ-000001' }).matched >= 1);
});

test('الرابط الملغى أو صاحب الدور المتغير أو الصيغة الخاطئة ⇒ رفض، والإلغاء فوري', async () => {
  const H = harness(); const r = (await H.call('POST /api/mcp/links', { body: {} })).json; const tok = r.url.split('/mcp/')[1];
  assert.equal((await rpc(H, tok, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 200);
  assert.equal((await H.call('POST /api/mcp/links/revoke', { body: { id: r.id } })).status, 200);
  assert.equal((await rpc(H, tok, { jsonrpc: '2.0', id: 2, method: 'ping' })).status, 401, 'الإلغاء يمسح المخبأ فورًا');
  assert.equal((await rpc(H, 'mq_default_' + 'A'.repeat(43), { jsonrpc: '2.0', id: 3, method: 'ping' })).status, 401);
  assert.equal((await rpc(H, 'abc', { jsonrpc: '2.0', id: 4, method: 'ping' })).status, 401);
  const A = harness({ memberRole: 'accountant' }); const t2 = (await A.call('POST /api/mcp/links', { body: {} })).json.url.split('/mcp/')[1];
  assert.equal((await rpc(A, t2, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 401, 'صاحب الرابط لم يعد مسؤول نظام');
  assert.equal((await H.call('GET /mcp/:token', { params: { token: tok } })).status, 405);
  assert.equal((await handleRpc({ jsonrpc: '1.0', id: 1, method: 'ping' })).error.code, -32600);
});

test('v53.6 مشروع البيانات من ملف حساب الخدمة دون FIREBASE_PROJECT_ID — ولا يمس توجيه التحقق من الدخول', () => {
  const T = loadTenants({ ...ENV, FIREBASE_PROJECT_ID: '' });
  assert.equal(T.def.projectId, '', 'التحقق من الدخول كما كان');
  assert.equal(T.def.dataProject, 'altaif-prod'); assert.ok(T.def.sa && T.def.sa.private_key);
  const T2 = loadTenants(ENV); assert.equal(T2.def.dataProject, 'altaif-prod');
  const T3 = loadTenants({ ...ENV, FIREBASE_PROJECT_ID: 'other-proj' }); assert.equal(T3.def.sa, null, 'ملف من مشروع آخر يُرفض');
});


test('v53.7 المقترحات: التحقق عند الاقتراح، الحفظ بانتظار الاعتماد دون مس البيانات، والقرار مرة واحدة', async () => {
  const H = harness(); const tok = (await H.call('POST /api/mcp/links', { body: {} })).json.url.split('/mcp/')[1];
  const call = (name, args) => rpc(H, tok, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name, arguments: args } });
  const bad = await call('propose_journal_entry', { date: '2026-02-01', title: 'غير متوازن', lines: [{ code: '5198', debit: 100 }, { code: '1101', credit: 90 }] });
  assert.equal(bad.json.result.isError, true); assert.match(bad.json.result.content[0].text, /غير متوازن/); assert.equal(Object.keys(H.store.mcp_proposals).length, 0);
  const j = await call('propose_journal_entry', { date: '2026-02-01', title: 'إيجار فبراير', branch: 'طيبة', lines: [{ code: '5198', debit: 100 }, { code: '1101', credit: 100 }], reason: 'عقد الإيجار' });
  const r = j.json.result.structuredContent; assert.equal(r.status, 'pending'); assert.match(r.next, /بانتظار اعتماد/);
  const doc = H.store.mcp_proposals[r.proposal_id]; assert.equal(doc.kind, 'journal'); assert.equal(doc.status, 'pending'); assert.equal(JSON.parse(doc.payload).branchId, 'b1');
  assert.ok(!H.sent.some(x => x.method === 'PATCH' && x.u.includes('/platform')), 'لا كتابة على بيانات المنشأة');
  const rc = await call('propose_reclassify_invoices', { changes: [{ invoice: 'PJ-000002', to_account: '5198' }, { invoice: 'لا-يوجد', to_account: '5198' }] });
  const rr = rc.json.result.structuredContent; assert.equal(rr.summary.count, 1); assert.equal(rr.summary.skipped, 1);
  const L = await call('list_proposals', { status: 'pending' }); assert.equal(L.json.result.structuredContent.proposals.length, 2);
  const G = await H.call('GET /api/mcp/proposals'); assert.equal(G.json.proposals.length, 2); assert.ok(G.json.proposals.every(p => p.payload));
  assert.equal((await H.call('POST /api/mcp/proposals/decide', { body: { id: r.proposal_id, decision: 'applied', note: 'قيد مرحّل' } })).status, 200);
  assert.equal(H.store.mcp_proposals[r.proposal_id].status, 'applied');
  assert.equal((await H.call('POST /api/mcp/proposals/decide', { body: { id: r.proposal_id, decision: 'rejected' } })).status, 409, 'لا يُبت مرتين');
  assert.equal((await harness({ role: 'accountant' }).call('GET /api/mcp/proposals')).status, 403);
});

test('v53.7 دوال المقترحات في المحرك: القيد، إعادة التصنيف، والفواتير بنفس تحقق الاستيراد', () => {
  const D = { org: ORG, ops: OPS };
  const fx = proposeTool(E, D, 'propose_expense_invoices', { invoices: [
    { date: '2026-01-10', supplier: 'مكين', vat_number: '311135091100003', invoice_no: 'NEW-1', account: '5198', net: 100, vat: 15, payment: 'cash' },
    { date: '2026-01-05', supplier: 'مكين', invoice_no: 'F-1', account: '5198', net: 1000, vat: 150 },
    { date: '2026-01-11', supplier: 'مورد جديد', invoice_no: 'Z-9', account: '5199', total: 50 }] });
  assert.equal(fx.summary.count, 2); assert.equal(fx.summary.rejected, 1); assert.match(fx.summary.rejected_rows[0].why, /سابق|مسجل/); assert.deepEqual(fx.summary.new_suppliers, ['مورد جديد']);
  assert.throws(() => proposeTool(E, D, 'propose_journal_entry', { date: '2026-02-01', title: 'x', lines: [{ code: '9999', debit: 1 }, { code: '1101', credit: 1 }] }), /حساب غير موجود/);
});
