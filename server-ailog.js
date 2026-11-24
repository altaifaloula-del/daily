/* v54.6 — المرحلة 7: سجل الذكاء الاصطناعي (ai_log) — كل استدعاء للذكاء الاصطناعي أو للموصل أو لقرار على مقترح يُسجَّل في Firestore بحساب الخدمة:
   من، ومتى، وأي وظيفة، والنموذج، والنتيجة، والمدة — دون محتوى البيانات المالية أو نصوص الطلبات. العميل ممنوع من المجموعة بالقاعدة العامة، والقراءة لمسؤول النظام عبر الخادم.
   الكتابة لا تعطل الطلب الأصلي أبدًا (بلا انتظار، والفشل يُسجَّل في سجلات الخادم فقط). */
import crypto from 'node:crypto';
import { saTokenSource } from './server-billing.js';
import { decodeFields } from './scripts/backup-lib.mjs';

const S = (v) => ({ stringValue: String(v == null ? '' : v).slice(0, 300) }), Bo = (v) => ({ booleanValue: !!v }), I = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
export const AILOG_KINDS = { ai: 'تحليل بالذكاء الاصطناعي', refs: 'مكتبة المراجع', review: 'وكيل المراجعة', mcp: 'موصل Claude', proposal: 'مقترحات Claude' };
/** يصنّف الطلب من مساره — لا يُسجَّل GET (قراءة القوائم) إلا ما يُمرَّر صراحة */
export function aiLogKind(method, p) {
  if (method === 'GET') return null; p = String(p || '');
  if (p.startsWith('/api/ai/')) return { kind: 'ai', name: p.slice(8) };
  if (p === '/api/refs/review') return { kind: 'review', name: 'refs_review' };
  if (p.startsWith('/api/refs/')) return { kind: 'refs', name: p.slice(10) };
  if (p.startsWith('/api/mcp/proposals')) return { kind: 'proposal', name: p.slice(18).replace(/^\//, '') || 'list' };
  if (p.startsWith('/api/mcp/links')) return { kind: 'mcp', name: 'links' + (p.slice(14) || '') };
  return null;
}
export function mountAiLog(app, { requireMember, rateLimit, T, fetchImpl = fetch, log = console, now = Date.now }) {
  const toks = new Map(); const tok = (t) => { if (!toks.has(t.id)) toks.set(t.id, saTokenSource(t.sa, { fetchImpl })); return toks.get(t.id)(); };
  const base = (t) => 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId) + '/databases/(default)/documents';
  const tenantOf = (id) => T.byId(id || 'default') || T.def;
  /** write(tenantId, {by, role, kind, name, model, ok, status, ms, detail}) — بلا انتظار */
  const write = (tenantId, e = {}) => { const t = tenantOf(tenantId); if (!t || !t.sa) return Promise.resolve(false);
    const at = new Date(now()).toISOString(); const id = at.replace(/[-:.TZ]/g, '').slice(0, 17) + '-' + crypto.randomBytes(4).toString('hex');
    const fields = { at: S(at), by: S(e.by), role: S(e.role), kind: S(e.kind), name: S(e.name), model: S(e.model), ok: Bo(e.ok !== false), status: I(e.status || (e.ok === false ? 500 : 200)), ms: I(e.ms), detail: S(e.detail) };
    return (async () => { const r = await fetchImpl(base(t) + '/ai_log?documentId=' + id, { method: 'POST', headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
      if (!r.ok) throw new Error('HTTP ' + r.status); return true; })().catch(err => { log.error('ai_log', t.id, err.message); return false; }); };
  // وسيط عام: يُسجّل طلبات /api/ai و/api/refs و/api/mcp عند انتهائها (المستخدم يُعرف بعد requireMember)
  app.use('/api', (req, res, next) => { const k = aiLogKind(req.method, req.baseUrl + req.path); if (!k) return next(); const t0 = now();
    res.on('finish', () => { if (!req.user) return; write(req.user.tenant, { by: req.user.email, role: req.user.role, kind: k.kind, name: k.name, ok: res.statusCode < 400, status: res.statusCode, ms: now() - t0,
      detail: k.kind === 'refs' && req.body && req.body.rerank ? 'ترتيب بـ Claude' : k.kind === 'review' && req.body && Array.isArray(req.body.cases) ? req.body.cases.length + ' حالة' : '' }); });
    next(); });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 30 });
  app.get('/api/ai/log', requireMember, lim, async (req, res) => {
    if (!req.user || req.user.role !== 'system_admin') return res.status(403).json({ error: 'لمسؤول النظام فقط' });
    const t = tenantOf(req.user.tenant); if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم', code: 'no-sa' });
    try { const r = await fetchImpl(base(t) + '/ai_log?pageSize=300&orderBy=at%20desc', { headers: { authorization: 'Bearer ' + await tok(t) } }); const j = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 404) throw new Error('تعذّرت قراءة السجل');
      res.json({ log: (j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields) })).sort((a, b) => String(b.at).localeCompare(String(a.at))), kinds: AILOG_KINDS }); }
    catch (e) { res.status(502).json({ error: e.message }); } });
  return { write };
}
