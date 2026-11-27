/**
 * v56.50 — إرسال الرسائل للعملاء: POST /api/comms/approve { jobId } · POST /api/comms/send { jobId }
 * حقائق المالك (2026-11-27): لم يُختر مزوّد ولا حساب ولا اسم مرسل بعد؛ يعتمد الإرسال المالك أو المدير العام ولا يعتمده منشئه.
 * قرارات المجلس M1/M2: SMS أولًا عبر مزوّد سعودي مرخّص واسم مرسل مسجّل، والحساب باسم المنشأة، والمفتاح في متغيرات بيئة الخادم وحده.
 *
 * • الطالب عضو نشط بدور المالك (system_admin) أو المدير العام (general_management) أو مدير المنصة — من سجل العضوية بحساب الخدمة، والهوية من الرمز لا من جسم الطلب.
 * • المفتاح org.mkt.comms.sendOn يُفحص من مستند المنشأة قبل التحميل الثقيل (مطفأ ⇒ 409).
 * • (المراجعة الأمنية) المنشئ يُسجَّل في الخادم: /submit (المركز ممن يحق له الإنشاء: المالك، المدير العام، المكتب الرئيسي) يكتب comms_sub/<jobId> مرة واحدة
 *   ببريد الرمز والوقت وبصمة المحتوى. الهوية في الاعتماد من الرمز وهذا السجل وحدهما — لا من org.users ولا byId/byEmail في المستند.
 * • /approve (المالك أو المدير العام) يشترط سجل submit، ويرفض إن كان بريد المعتمد = بريد المُرسِل للاعتماد (403 self)، وإن تغيّرت بصمة المحتوى عن بصمة
 *   الإرسال للاعتماد (409 changed)؛ ويكتب comms_appr/<jobId> مرة واحدة (بريد المعتمد، بريد المنشئ من سجل submit، الوقت، البصمة).
 *   البصمة sha256 لـ commsApprCanon: النوع، القناة، القالب ونصه، المرشّح، نص الإيقاف، اسم المرسل.
 *   /send يشترط السجلين، وأن المعتمد ≠ المنشئ، وأن بصمة المحتوى الحالي = بصمة الاعتماد؛ وإلا 409. حالة «معتمدة» في المستند وحدها لا تكفي.
 * • الجمهور يُعاد حسابه هنا بالمحرك نفسه (commsAudience) — لا يُقبل قائمة من المتصفح. سقف 5000 مستلم للطلب الواحد (413).
 * • (المراجعة الأمنية 2) الحد الشهري من comms_log وحده (يكتبه الخادم): بصمات HMAC-SHA256 للمستلمين الناجحين بمفتاح COMMS_HMAC_KEY؛
 *   بلا المفتاح يُولَّد مفتاح عند الإقلاع مع تحذير (يكفي للتجريبي الذي لا يُحتسب أصلًا)، والإرسال الفعلي يُرفض بلا المفتاح.
 * • ساعات الهدوء بتوقيت الرياض ⇒ 409 code:'quiet' (الاعتماد مسموح والإرسال يُؤجَّل — يُعاد الطلب بعد انتهائها؛ لا جدولة آلية — قرار المجلس).
 * • نص الإيقاف (optOutText) يُلحق بكل رسالة (داخل commsAudience).
 * • المحوّل: adapter.send(batch, { signal }) → results، batch = [{ to: '9665XXXXXXXX', text }]، results = [{ ok: boolean, id?, err? }] بالترتيب نفسه.
 *   (المراجعة الأمنية 3) يُستدعى بدفعات من 100 ولكل دفعة مهلة (AbortController)، وفشل دفعة لا يوقف الباقي، ورسالة الخطأ تُنقّى من الأرقام قبل الحفظ.
 *   المحوّل الوحيد الآن «dryrun»: لا يتصل بأي جهة ولا يرسل شيئًا. محوّل المزوّد يُضاف لاحقًا ويقرأ مفتاحه من متغير بيئة؛ COMMS_ADAPTER يختاره (الافتراضي dryrun).
 * • comms_log/<jobId> وcomms_appr/<jobId> يكتبهما الخادم وحده مرة واحدة، والقواعد تمنع العملاء (القاعدة العامة). لا أرقام كاملة فيهما.
 * • حد الطلبات بالمستخدم، ومهلة لكل نداء خارجي.
 */
import crypto from 'crypto';
import { saTokenSource } from './server-billing.js';
import { loadPlatformData } from './server-mcp.js';

const KEY = /^[A-Za-z0-9_-]{1,120}$/;
const FETCH_MS = 10000;
export const COMMS_SEND_ROLES = ['system_admin', 'general_management'];
/** من يُرسل الدفعة للاعتماد (مطابق لمن ينشئها في الواجهة: الأدوار المركزية بصلاحية الاعتماد — mktCanApprove + scope all) */
export const COMMS_SUBMIT_ROLES = ['system_admin', 'general_management', 'head_office'];
export const COMMS_MAX_RCPT = 5000, COMMS_CHUNK = 100, COMMS_ADAPTER_MS = 20000;
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

/** تنقية رسالة خطأ المحوّل: أي تسلسل أرقام ≥ 7 (بفواصل أو بدونها) ⇒ نجوم، وحد الطول */
export const commsScrub = (msg) => String(msg == null ? '' : msg).replace(/\+?\d[\d\s-]{5,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '*******' : m)).slice(0, 200);

/** بصمة المحتوى المعتمد (sha256 للصيغة الثابتة من المحرك) */
export const commsApprHash = (canon) => crypto.createHash('sha256').update(String(canon)).digest('hex');

/** بصمة رقم للحد الشهري: HMAC-SHA256 بمفتاح الخادم (مقتطعة إلى 32 خانة) */
export const commsRcptKey = (key, phone) => crypto.createHmac('sha256', String(key)).update('c:' + String(phone || '')).digest('hex').slice(0, 32);

/** اسم العرض فقط (لا هوية): من org.users بالبريد، وإلا البريد */
const displayOf = (org, email) => { const u = ((org && org.users) || []).find(x => x && String(x.email || '').toLowerCase() === email); return { name: (u && u.name) || email, id: (u && u.id) || '' }; };
/** قرار الاعتماد (نقي): sub = سجل الإرسال للاعتماد، email = بريد المعتمد من الرمز، hash = بصمة المحتوى الآن */
export function commsSubCheck(sub, email, hash) {
  if (!sub) return { code: 409, err: 'لم تُرسَل الدفعة للاعتماد عبر الخادم — أرسلها للاعتماد من «الرسائل»', why: 'nosub' };
  if (String(sub.email || '').toLowerCase() === String(email || '').toLowerCase()) return { code: 403, err: 'لا يعتمد من أرسل الدفعة للاعتماد دفعته — يعتمدها المالك أو المدير العام الآخر', why: 'self' };
  if (sub.hash !== hash) return { code: 409, err: 'تغيّر المحتوى (القالب أو المرشّح أو نص الإيقاف أو اسم المرسل) بعد الإرسال للاعتماد — أعد إنشاء الدفعة', why: 'changed' };
  return null;
}

/** فحص الدفعة للإرسال على بيانات الخادم (الاعتماد نفسه من comms_appr — commsApprCheck) */
export function commsJobCheck(job) {
  if (!job) return { code: 404, err: 'الدفعة غير موجودة' };
  if (job.status !== 'approved') return { code: 409, err: 'الدفعة غير معتمدة (حالتها: ' + (job.status || '—') + ')' };
  if (job.ch !== 'sms') return { code: 400, err: 'القناة الوحيدة الآن رسائل SMS' };
  return null;
}
/** فحص سجلي الخادم للإرسال: الاعتماد والإرسال للاعتماد مقابل المحتوى الحالي (الهوية من السجلين وحدهما) */
export function commsApprCheck(appr, sub, hash) {
  if (!appr) return { code: 409, err: 'لا اعتماد محفوظ في الخادم لهذه الدفعة — اعتمدها من «الرسائل»', why: 'noappr' };
  if (!sub) return { code: 409, err: 'لا سجل إرسال للاعتماد في الخادم لهذه الدفعة', why: 'nosub' };
  const ae = String(appr.email || '').toLowerCase(), ce = String(appr.creatorEmail || '').toLowerCase(), se = String(sub.email || '').toLowerCase();
  if (!ae || ae === ce || ae === se) return { code: 409, err: 'المعتمد هو من أرسل الدفعة للاعتماد', why: 'self' };
  if (ce !== se) return { code: 409, err: 'سجل الاعتماد لا يطابق سجل الإرسال للاعتماد', why: 'changed' };
  if (appr.hash !== hash || sub.hash !== hash) return { code: 409, err: 'تغيّر المحتوى (القالب أو المرشّح أو نص الإيقاف أو اسم المرسل) بعد الاعتماد — أعد إنشاء الدفعة واعتمادها', why: 'changed' };
  return null;
}

const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'booleanValue' in f ? f.booleanValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : undefined;
const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };

export function mountComms(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console, engine = null, loader = null, orgLoader = null, now = Date.now, env = process.env, timeoutMs = FETCH_MS, adapterMs = COMMS_ADAPTER_MS }) {
  const json = express.json({ limit: '2kb' });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 5, keyFn: (r) => 'cm:' + String((r.user && r.user.email) || '').toLowerCase() });
  const limA = rateLimit({ windowMs: 60 * 1000, max: 10, keyFn: (r) => 'cma:' + String((r.user && r.user.email) || '').toLowerCase() });
  // مفتاح بصمات المستلمين: من البيئة، وإلا مولّد عند الإقلاع (تحذير) — لا يُطبع أبدًا
  const hmacEnv = String((env && env.COMMS_HMAC_KEY) || ''); const hmacKey = hmacEnv || crypto.randomBytes(32).toString('hex');
  if (!hmacEnv) log.log('comms: تحذير — COMMS_HMAC_KEY غير مضبوط؛ مفتاح مؤقت مولّد عند الإقلاع (يكفي للمحوّل التجريبي فقط، والإرسال الفعلي يُرفض بدونه)');
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
  const readDoc = async (t, path) => { const d = await getDoc(t, path); return d ? fieldsOf(d) : null; };
  const once = async (t, path, fields) => call(t, '/documents:commit', { writes: [{ update: { name: root(t) + '/documents/' + path, fields }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] });
  const isDup = (e) => e.code === 'ALREADY_EXISTS' || e.code === 'FAILED_PRECONDITION' || e.status === 409;
  const sendOn = (org) => !!(org && org.mkt && org.mkt.comms && org.mkt.comms.sendOn);
  /** عدّاد الشهر (بتوقيت الرياض) من comms_log: الإرسال الفعلي للحملات والولاء فقط — بصمة ⇒ عدد */
  const monthUsed = async (t, ym) => {
    const r = await call(t, '/documents:runQuery', { structuredQuery: { from: [{ collectionId: 'comms_log' }], where: { fieldFilter: { field: { fieldPath: 'ym' }, op: 'EQUAL', value: S(ym) } } } });
    const used = {};
    (Array.isArray(r) ? r : []).forEach(x => { const f = x && x.document ? fieldsOf(x.document) : null; if (!f || f.dry !== false || !['campaign', 'loy'].includes(f.kind)) return;
      let L = []; try { L = JSON.parse(f.rcpt || '[]'); } catch { L = []; } (Array.isArray(L) ? L : []).forEach(k => { if (typeof k === 'string') used[k] = (used[k] || 0) + 1; }); });
    return used;
  };
  // المشترك: الهوية والدور والمفتاح والبيانات والدفعة
  const prelude = async (req, res, tag) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const inp = commsSendInput(req.body); if (inp.err) { res.status(400).json({ error: inp.err }); return null; }
    const t = tenantOf(req);
    if (!t || !t.sa) { res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' }); return null; }
    let M; try { M = await member(t, email); } catch (e) { log.error('comms/' + tag + ' member', t.id, e.message); res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); return null; }
    const R = tag === 'submit' ? COMMS_SUBMIT_ROLES : COMMS_SEND_ROLES;
    if (!(M.admin || (M.m.active === true && R.includes(M.m.role)))) { res.status(403).json({ error: tag === 'submit' ? 'إرسال الدفعة للاعتماد للمركز (المالك أو المدير العام أو المكتب الرئيسي)' : (tag === 'approve' ? 'اعتماد' : 'إرسال') + ' الرسائل للمالك أو المدير العام فقط' }); return null; }
    try { if (!sendOn(await loadOrg(t))) { res.status(409).json({ error: 'مسار إرسال الرسائل غير مفعّل للمنشأة', code: 'off' }); return null; } }
    catch (e) { log.error('comms/' + tag + ' org', t.id, e.message); res.status(502).json({ error: 'تعذّرت قراءة إعداد المنشأة' }); return null; }
    let data, En;
    try { data = await loadData(t); En = await loadEngine(); }
    catch (e) { log.error('comms/' + tag + ' data', t.id, e.message); res.status(502).json({ error: 'تعذّرت قراءة بيانات المنشأة' }); return null; }
    if (!sendOn(data.org)) { res.status(409).json({ error: 'مسار إرسال الرسائل غير مفعّل للمنشأة', code: 'off' }); return null; }
    const job = (((data.ops || {}).commsJobs) || []).find(j => j && j.id === inp.v.jobId);
    return { email, t, data, En, job, jobId: inp.v.jobId };
  };

  /** الإرسال للاعتماد — يسجّل المُرسِل (بريد الرمز) وبصمة المحتوى في سجل لا يكتبه غير الخادم */
  app.post('/api/comms/submit', json, requireMember, limA, async (req, res) => {
    const P = await prelude(req, res, 'submit'); if (!P) return; const { email, t, data, En, job, jobId } = P;
    if (!job) return res.status(404).json({ error: 'الدفعة غير موجودة' });
    if (!['draft', 'pending'].includes(job.status)) return res.status(409).json({ error: 'الدفعة ليست مسودة (حالتها: ' + (job.status || '—') + ')' });
    if (job.ch !== 'sms') return res.status(400).json({ error: 'القناة الوحيدة الآن رسائل SMS' });
    if (!En.commsCfgOf(data.org).templates.some(x => x.id === job.tplId)) return res.status(409).json({ error: 'قالب الدفعة غير موجود' });
    const hash = commsApprHash(En.commsApprCanon(data.org, job)); const at = new Date(now()).toISOString();
    try { await once(t, 'comms_sub/' + jobId, { jobId: S(jobId), email: S(email), kind: S(job.kind), tplId: S(job.tplId), hash: S(hash), atIso: S(at) }); }
    catch (e) { if (isDup(e)) return res.status(409).json({ error: 'أُرسلت هذه الدفعة للاعتماد سابقًا', code: 'dup' });
      log.error('comms/submit log', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ الإرسال للاعتماد' }); }
    log.log('comms/submit', t.id, job.kind);
    return res.json({ ok: true, submittedAt: at });
  });

  /** الاعتماد في الخادم — لا يعتمد من أرسلها للاعتماد (من سجل submit لا من المستند)، وتُبصم المحتوى المعتمد */
  app.post('/api/comms/approve', json, requireMember, limA, async (req, res) => {
    const P = await prelude(req, res, 'approve'); if (!P) return; const { email, t, data, En, job, jobId } = P;
    if (!job) return res.status(404).json({ error: 'الدفعة غير موجودة' });
    if (job.status !== 'pending') return res.status(409).json({ error: 'الدفعة ليست بانتظار الاعتماد (حالتها: ' + (job.status || '—') + ')' });
    if (job.ch !== 'sms') return res.status(400).json({ error: 'القناة الوحيدة الآن رسائل SMS' });
    if (!En.commsCfgOf(data.org).templates.some(x => x.id === job.tplId)) return res.status(409).json({ error: 'قالب الدفعة غير موجود' });
    let sub; try { sub = await readDoc(t, 'comms_sub/' + jobId); } catch (e) { log.error('comms/approve sub', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة سجل الإرسال للاعتماد' }); }
    const hash = commsApprHash(En.commsApprCanon(data.org, job));
    const sb = commsSubCheck(sub, email, hash); if (sb) return res.status(sb.code).json({ error: sb.err, code: sb.why });
    const at = new Date(now()).toISOString(); const who = displayOf(data.org, email);
    try { await once(t, 'comms_appr/' + jobId, { jobId: S(jobId), email: S(email), creatorEmail: S(String(sub.email || '').toLowerCase()), kind: S(job.kind), tplId: S(job.tplId), hash: S(hash), atIso: S(at) }); }
    catch (e) { if (isDup(e)) return res.status(409).json({ error: 'اعتُمدت هذه الدفعة سابقًا', code: 'dup' });
      log.error('comms/approve log', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ الاعتماد' }); }
    log.log('comms/approve', t.id, job.kind);
    return res.json({ ok: true, approvedBy: who.name, approvedById: who.id, approvedAt: at });
  });

  app.post('/api/comms/send', json, requireMember, lim, async (req, res) => {
    const P = await prelude(req, res, 'send'); if (!P) return; const { email, t, data, En, job, jobId } = P;
    const adapter = commsAdapter(env); if (!adapter) return res.status(409).json({ error: 'محوّل الإرسال المضبوط غير متاح على الخادم', code: 'adapter' });
    const dry = !!adapter.dry;
    if (!dry && !hmacEnv) return res.status(409).json({ error: 'الإرسال الفعلي يتطلب COMMS_HMAC_KEY في إعدادات الخادم', code: 'hmac' });
    const bad = commsJobCheck(job); if (bad) return res.status(bad.code).json({ error: bad.err });
    let appr, sub; try { [appr, sub] = await Promise.all([readDoc(t, 'comms_appr/' + jobId), readDoc(t, 'comms_sub/' + jobId)]); }
    catch (e) { log.error('comms/send appr', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة الاعتماد' }); }
    const ab = commsApprCheck(appr, sub, commsApprHash(En.commsApprCanon(data.org, job))); if (ab) return res.status(ab.code).json({ error: ab.err, code: ab.why });
    const cfg = En.commsCfgOf(data.org); const at = now(); const ym = new Date(at + 3 * 3600e3).toISOString().slice(0, 7);
    if (En.commsQuietRiy(cfg, at)) return res.status(409).json({ error: 'ساعات الهدوء الآن (' + cfg.quietFrom + '–' + cfg.quietTo + ' بتوقيت الرياض) — أعد الإرسال بعد ' + cfg.quietTo, code: 'quiet', until: cfg.quietTo });
    const keyOf = (ph) => commsRcptKey(hmacKey, ph);
    let used = {};
    if (job.kind === 'campaign' || job.kind === 'loy') { try { used = await monthUsed(t, ym); } catch (e) { log.error('comms/send used', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة سجل الإرسال للحد الشهري' }); } }
    const A = En.commsAudience(data.org, data.ops, data.loy || { members: {}, tx: [] }, job, at, { used, keyOf });
    if (A.n > COMMS_MAX_RCPT) return res.status(413).json({ error: 'المستلمون ' + A.n + ' أكثر من الحد للدفعة الواحدة (' + COMMS_MAX_RCPT + ') — قسّمها بمرشّح', code: 'too-many' });
    const batch = A.list.map(x => ({ to: '966' + x.phone, text: x.text })); const atIso = new Date(at).toISOString();
    // (1) حجز السجل الدائم قبل أي إرسال — مرة واحدة لكل دفعة (مفتاح عدم التكرار = معرّف الدفعة): أعداد وعيّنة مقنّعة فقط
    const masked = A.list.slice(0, 2000).map(x => ({ m: En.commsMask(x.phone), parts: x.parts }));
    const name = root(t) + '/documents/comms_log/' + jobId;
    // بصمات المستلمين المقصودين تُحفظ في الحجز نفسه (قبل الإرسال) — إن تعطّل الإكمال يبقى العدّاد كاملًا لا أقل؛ والإكمال يستبدلها بالناجحين
    const rcpt0 = dry ? [] : A.list.map(x => keyOf(x.phone));
    try { await call(t, '/documents:commit', { writes: [{ update: { name, fields: { jobId: S(jobId), kind: S(job.kind), ym: S(ym), state: S('sending'), n: I(A.n), parts: I(A.parts), dry: { booleanValue: dry }, rcpt: S(JSON.stringify(rcpt0)),
      adapter: S(adapter.name), skipped: S(JSON.stringify(A.skipped)), items: S(JSON.stringify(masked)), by: S(email), approvedBy: S(appr.email || ''), submittedBy: S(sub.email || '') } },
      currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }] }); }
    catch (e) { if (e.code === 'ALREADY_EXISTS' || e.code === 'FAILED_PRECONDITION' || e.status === 409) return res.status(409).json({ error: 'أُرسلت هذه الدفعة سابقًا', code: 'dup' });
      log.error('comms/send log', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ سجل الإرسال — لم يُرسل شيء' }); }
    // (2) الإرسال عبر المحوّل: دفعات بمهلة لكل منها، وفشل دفعة لا يوقف الباقي
    const results = new Array(batch.length).fill(null); let errMsg = '';
    for (let i = 0; i < batch.length; i += COMMS_CHUNK) {
      const part = batch.slice(i, i + COMMS_CHUNK); const ac = new AbortController(); let tm;
      try {
        const r = await Promise.race([adapter.send(part, { signal: ac.signal }), new Promise((_, rej) => { tm = setTimeout(() => { ac.abort(); rej(new Error('انتهت مهلة المحوّل')); }, adapterMs); })]);
        if (!Array.isArray(r) || r.length !== part.length) throw new Error('رد المحوّل غير مطابق');
        r.forEach((x, k) => { results[i + k] = x && x.ok ? { ok: true } : { ok: false }; });
      } catch (e) { errMsg = errMsg || commsScrub(e && e.message); part.forEach((_, k) => { results[i + k] = { ok: false }; }); }
      finally { clearTimeout(tm); }
    }
    const ok = results.filter(r => r && r.ok).length; const failed = A.n > 0 && ok === 0 && !!errMsg;
    const result = { n: A.n, ok, fail: A.n - ok, parts: A.parts, dry, adapter: adapter.name, at: atIso, ...(errMsg ? { err: errMsg } : {}) };
    const sample = A.sample.map(s => ({ m: s.m, parts: s.parts }));
    // (3) إكمال السجل: النتيجة وبصمات HMAC للناجحين (الإرسال الفعلي فقط — منها يُحسب الحد الشهري؛ التجريبي لا يُحتسب)
    const rcpt = dry ? [] : A.list.filter((x, i) => results[i] && results[i].ok).map(x => keyOf(x.phone));
    try { await call(t, '/documents:commit', { writes: [{ update: { name, fields: { state: S(failed ? 'failed' : 'done'), ok: I(ok), fail: I(A.n - ok), rcpt: S(JSON.stringify(rcpt)), err: S(errMsg) } },
      updateMask: { fieldPaths: ['state', 'ok', 'fail', 'rcpt', 'err'] }, currentDocument: { exists: true } }] }); }
    catch (e) { log.error('comms/send log2', t.id, e.message); }
    log.log('comms/send', t.id, job.kind, adapter.name, A.n + '/' + ok);   // أعداد فقط — لا أرقام ولا نصوص
    if (failed) return res.status(502).json({ error: 'تعذّر الإرسال عبر المحوّل', result });
    return res.json({ result, sample });
  });
}
