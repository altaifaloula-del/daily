/**
 * v56.50 — إرسال الرسائل للعملاء: POST /api/comms/send  { jobId }
 * حقائق المالك (2026-11-27): لم يُختر مزوّد ولا حساب ولا اسم مرسل بعد؛ يعتمد الإرسال المالك أو المدير العام ولا يعتمده منشئه.
 * قرارات المجلس M1/M2: SMS أولًا عبر مزوّد سعودي مرخّص واسم مرسل مسجّل، والحساب باسم المنشأة، والمفتاح في متغيرات بيئة الخادم وحده.
 *
 * • الطالب عضو نشط بدور المالك (system_admin) أو المدير العام (general_management) أو مدير المنصة — من سجل العضوية بحساب الخدمة، لا من جسم الطلب.
 * • المفتاح org.mkt.comms.sendOn يُفحص من مستند المنشأة قبل التحميل الثقيل (مطفأ ⇒ 409).
 * • الدفعة من بيانات الخادم (ops.commsJobs): معتمدة، ومعتمدها غير منشئها، وقناتها sms. الجمهور يُعاد حسابه هنا بالمحرك نفسه (commsAudience) — لا يُقبل قائمة من المتصفح.
 * • ساعات الهدوء بتوقيت الرياض ⇒ 409 code:'quiet' (الاعتماد مسموح والإرسال يُؤجَّل — يُعاد الطلب بعد انتهائها؛ لا جدولة آلية الآن).
 * • نص الإيقاف (optOutText) يُلحق بكل رسالة (داخل commsAudience).
 * • المحوّل: واجهة موحّدة  adapter.send(batch) → results  حيث batch = [{ to: '9665XXXXXXXX', text }] و results = [{ ok: boolean, id?, err? }] بالترتيب نفسه.
 *   المحوّل الوحيد الآن «dryrun»: لا يتصل بأي جهة ولا يرسل شيئًا؛ يعيد ok لكل رسالة مع dry:true. محوّل المزوّد الحقيقي يُضاف لاحقًا هنا
 *   ويقرأ مفتاحه من متغير بيئة (مثل COMMS_PROVIDER_KEY) — لا من مستند المنشأة ولا من المتصفح. COMMS_ADAPTER يختار المحوّل (الافتراضي dryrun).
 * • السجل: comms_log/<jobId> يكتبه الخادم وحده مرة واحدة (currentDocument.exists=false ⇒ لا إرسال مكرر للدفعة نفسها)، والقواعد تمنع العملاء
 *   (القاعدة العامة). فيه الأعداد وعيّنة مقنّعة فقط — لا أرقام كاملة.
 * • حد الطلبات بالمستخدم، ومهلة لكل نداء خارجي.
 */
import { saTokenSource } from './server-billing.js';
import { loadPlatformData } from './server-mcp.js';

const KEY = /^[A-Za-z0-9_-]{1,120}$/;
const FETCH_MS = 10000;
export const COMMS_SEND_ROLES = ['system_admin', 'general_management'];
/** الأعمدة التي يحتاجها حساب الجمهور زيادةً على أعمدة المحاسبة */
export const COMMS_KEEP = ['mktConsents', 'mktMerges', 'mktProfiles', 'commsJobs'];

/** تحقق نقي من جسم الطلب */
export function commsSendInput(b) {
  const x = b || {}; if (typeof x !== 'object' || Array.isArray(x)) return { err: 'طلب غير صالح' };
  if (Object.keys(x).some(k => k !== 'jobId')) return { err: 'حقول غير متوقعة' };
  if (!KEY.test(String(x.jobId || ''))) return { err: 'معرّف الدفعة غير صالح' };
  return { v: { jobId: x.jobId } };
}

/** المحوّلات — dryrun وحده الآن (لا يرسل شيئًا) */
export const COMMS_ADAPTERS = {
  dryrun: { name: 'dryrun', dry: true, async send(batch) { return (batch || []).map(() => ({ ok: true, dry: true })); } },
};
export function commsAdapter(env = process.env) { const n = String((env && env.COMMS_ADAPTER) || 'dryrun').trim() || 'dryrun'; return COMMS_ADAPTERS[n] || null; }

/** فحص الدفعة على بيانات الخادم */
export function commsJobCheck(job) {
  if (!job) return { code: 404, err: 'الدفعة غير موجودة' };
  if (job.status !== 'approved') return { code: 409, err: 'الدفعة غير معتمدة (حالتها: ' + (job.status || '—') + ')' };
  if (!job.approvedBy && !job.approvedById) return { code: 409, err: 'الدفعة بلا معتمد' };
  if (job.approvedById ? job.approvedById === job.byId : job.approvedBy === job.by) return { code: 409, err: 'لا يعتمد المنشئ دفعته — يلزم اعتماد المالك أو المدير العام' };
  if (job.ch !== 'sms') return { code: 400, err: 'القناة الوحيدة الآن رسائل SMS' };
  return null;
}

const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'booleanValue' in f ? f.booleanValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : undefined;
const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };

export function mountComms(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console, engine = null, loader = null, orgLoader = null, now = Date.now, env = process.env, timeoutMs = FETCH_MS }) {
  const json = express.json({ limit: '2kb' });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 5, keyFn: (r) => 'cm:' + String((r.user && r.user.email) || '').toLowerCase() });
  const tokens = new Map();
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const tok = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return tokens.get(t.id)(); };
  const root = (t) => 'projects/' + (t.dataProject || t.projectId) + '/databases/(default)';
  const api = (t) => 'https://firestore.googleapis.com/v1/' + root(t);
  const tfetch = async (u, init = {}) => { const ac = typeof AbortController === 'function' ? new AbortController() : null; const tm = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
    try { return await fetchImpl(u, { ...init, ...(ac ? { signal: ac.signal } : {}) }); } finally { if (tm) clearTimeout(tm); } };
  const call = async (t, path, body, method = 'POST') => {
    const r = await tfetch(api(t) + path, { method, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && method === 'GET') return null;
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error && j.error.status; throw e; }
    return j;
  };
  const getDoc = (t, path) => call(t, '/documents/' + path, null, 'GET');
  let E = engine; const loadEngine = async () => { if (!E) E = await import('./dist-engine/engine.mjs'); return E; };
  const sget = (t) => async (u, init = {}) => { const r = await tfetch(u, { ...init, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' } }); return { ok: r.ok, status: r.status, j: await r.json().catch(() => null) }; };
  // بيانات المنشأة: org + core + الفروع (أعمدة المحاسبة + الموافقات والدمج والملفات والدفعات) + فواتير الكاشير الآجلة + دفتر الولاء
  const loadData = loader || ((t) => loadPlatformData(api(t) + '/documents', sget(t), now, { posCredit: true, keep: COMMS_KEEP, loy: true }));
  const loadOrg = orgLoader || (async (t) => {
    const h = fieldsOf(await getDoc(t, 'platform/rms8_org')); const parts = Number(h.parts) || 1; let text = h.value;
    if (parts > 1) { if (parts > 500) throw new Error('org parts'); const ch = [];
      for (let i = 0; i < parts; i++) ch.push(fieldsOf(await getDoc(t, 'platform/rms8_org__' + (h.ver ? h.ver + '_' : '') + i)).chunk || '');
      text = ch.join(''); }
    return text ? JSON.parse(text) : {};
  });
  const member = async (t, email) => { const [md, ad] = await Promise.all([getDoc(t, 'members/' + encodeURIComponent(email)), getDoc(t, 'platform/admins')]);
    const m = fieldsOf(md); return { m, admin: (fieldsOf(ad).emails || []).some(e => String(e || '').toLowerCase() === email) && (!md || m.active === true) }; };
  const sendOn = (org) => !!(org && org.mkt && org.mkt.comms && org.mkt.comms.sendOn);

  app.post('/api/comms/send', json, requireMember, lim, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const inp = commsSendInput(req.body); if (inp.err) return res.status(400).json({ error: inp.err });
    const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    let M; try { M = await member(t, email); } catch (e) { log.error('comms/send member', t.id, e.message); return res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); }
    if (!(M.admin || (M.m.active === true && COMMS_SEND_ROLES.includes(M.m.role)))) return res.status(403).json({ error: 'إرسال الرسائل للمالك أو المدير العام فقط' });
    try { if (!sendOn(await loadOrg(t))) return res.status(409).json({ error: 'مسار إرسال الرسائل غير مفعّل للمنشأة', code: 'off' }); }
    catch (e) { log.error('comms/send org', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة إعداد المنشأة' }); }
    const adapter = commsAdapter(env); if (!adapter) return res.status(409).json({ error: 'محوّل الإرسال المضبوط غير متاح على الخادم', code: 'adapter' });
    let data, En;
    try { data = await loadData(t); En = await loadEngine(); }
    catch (e) { log.error('comms/send data', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة بيانات المنشأة' }); }
    if (!sendOn(data.org)) return res.status(409).json({ error: 'مسار إرسال الرسائل غير مفعّل للمنشأة', code: 'off' });
    const job = (((data.ops || {}).commsJobs) || []).find(j => j && j.id === inp.v.jobId);
    const bad = commsJobCheck(job); if (bad) return res.status(bad.code).json({ error: bad.err });
    const cfg = En.commsCfgOf(data.org); const at = now();
    if (En.commsQuietRiy(cfg, at)) return res.status(409).json({ error: 'ساعات الهدوء الآن (' + cfg.quietFrom + '–' + cfg.quietTo + ' بتوقيت الرياض) — أعد الإرسال بعد ' + cfg.quietTo, code: 'quiet', until: cfg.quietTo });
    const A = En.commsAudience(data.org, data.ops, data.loy || { members: {}, tx: [] }, job, at);
    const batch = A.list.map(x => ({ to: '966' + x.phone, text: x.text })); const dry = !!adapter.dry; const atIso = new Date(at).toISOString();
    // (1) حجز السجل الدائم قبل أي إرسال — مرة واحدة لكل دفعة (مفتاح عدم التكرار = معرّف الدفعة): أعداد وعيّنة مقنّعة فقط
    const masked = A.list.slice(0, 2000).map(x => ({ m: En.commsMask(x.phone), parts: x.parts }));
    const name = root(t) + '/documents/comms_log/' + inp.v.jobId;
    try { await call(t, '/documents:commit', { writes: [{ update: { name, fields: { jobId: S(inp.v.jobId), kind: S(job.kind), state: S('sending'), n: I(A.n), parts: I(A.parts), dry: { booleanValue: dry },
      adapter: S(adapter.name), skipped: S(JSON.stringify(A.skipped)), items: S(JSON.stringify(masked)), by: S(email), approvedBy: S(job.approvedBy || '') } },
      currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }); }
    catch (e) { if (e.code === 'ALREADY_EXISTS' || e.code === 'FAILED_PRECONDITION' || e.status === 409) return res.status(409).json({ error: 'أُرسلت هذه الدفعة سابقًا', code: 'dup' });
      log.error('comms/send log', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ سجل الإرسال — لم يُرسل شيء' }); }
    // (2) الإرسال عبر المحوّل
    let results = [], failed = false;
    try { results = batch.length ? await adapter.send(batch) : []; if (!Array.isArray(results) || results.length !== batch.length) throw new Error('رد المحوّل غير مطابق'); }
    catch (e) { failed = true; log.error('comms/send adapter', t.id, adapter.name, e.message); results = batch.map(() => ({ ok: false })); }
    const ok = results.filter(r => r && r.ok).length;
    const result = { n: A.n, ok, fail: A.n - ok, parts: A.parts, dry, adapter: adapter.name, at: atIso,
      // بصمات المستلمين (لا أرقام) للحد الشهري — للإرسال الفعلي فقط؛ التجريبي لا يُحتسب
      ...(dry ? {} : { rcpt: A.list.filter((x, i) => results[i] && results[i].ok).map(x => En.commsKey(x.phone)) }) };
    const sample = A.sample.map(s => ({ m: s.m, parts: s.parts }));
    // (3) إكمال السجل بالنتيجة
    try { await call(t, '/documents:commit', { writes: [{ update: { name, fields: { state: S(failed ? 'failed' : 'done'), ok: I(ok), fail: I(A.n - ok) } }, updateMask: { fieldPaths: ['state', 'ok', 'fail'] }, currentDocument: { exists: true } }] }); }
    catch (e) { log.error('comms/send log2', t.id, e.message); }
    log.log('comms/send', t.id, job.kind, adapter.name, A.n + '/' + ok);   // أعداد فقط — لا أرقام ولا نصوص
    if (failed) return res.status(502).json({ error: 'تعذّر الإرسال عبر المحوّل', result });
    return res.json({ result, sample });
  });
}
