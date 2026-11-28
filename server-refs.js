/**
 * v54.4 — المرحلة 5: مكتبة المراجع المحاسبية (قرار المالك: النص فقط في Firestore + بحث نصي وترتيب بـ Claude).
 * • التخزين: ref_docs/{id} (البيانات الوصفية والإصدار والنفاذ والحالة والتوثيق) و ref_chunks/{id}__{n} (نص كل مقطع بصفحته) — يكتبها ويقرؤها الخادم وحده
 *   بحساب خدمة المنشأة؛ قواعد Firestore تمنع العملاء تمامًا (القاعدة العامة)، فالعزل بين المنشآت والوصول بالأدوار مفروض هنا.
 * • الاستخراج: النص/CSV/Excel/Word يستخرجه المتصفح بصفحاته أو أوراقه أو فقراته؛ PDF (ومنه الممسوح) يستخرجه Claude صفحةً صفحة (≤ 100 صفحة).
 * • لا يُعدّ أي ملف مرفوع معيارًا رسميًا ساريًا قبل أن يوثّقه مسؤول النظام (الإصدار وتاريخ النفاذ) — verified:false افتراضيًا.
 * • البحث: refSearch (حرفي مرتّب) ثم ترتيب اختياري بـ Claude مقيَّد بالمقاطع المسترجعة فقط — لا نص ولا رقم فقرة من خارجها.
 */
import crypto from 'node:crypto';
import { saTokenSource } from './server-billing.js';
import { decodeFields } from './scripts/backup-lib.mjs';
import { refChunk, refSearch, REF_AUTH, REF_CATS, revQuery, revPrompt, revValidate, AI_NO_CREDIT, isNoCredit } from './ref-lib.mjs';
export const REVIEW_ROLES = new Set(['system_admin', 'finance_department', 'accountant', 'general_management', 'head_office']);

const S = (v) => ({ stringValue: String(v == null ? '' : v) }), Bo = (v) => ({ booleanValue: !!v }), I = (v) => ({ integerValue: String(Math.round(Number(v) || 0)) });
const META = ['title', 'cat', 'authority', 'family', 'version', 'pubDate', 'effFrom', 'effTo', 'status', 'supersededBy', 'source', 'lang', 'note'];
const okDate = (d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);
export function refMetaClean(m = {}) {
  const o = {}; META.forEach(k => { if (m[k] != null) o[k] = String(m[k]).trim().slice(0, k === 'note' ? 1000 : 200); });
  if (!o.title) throw new Error('عنوان المرجع مطلوب');
  if (o.cat && !REF_CATS[o.cat]) throw new Error('تصنيف غير معروف'); if (o.authority && !REF_AUTH[o.authority]) throw new Error('نوع حجية غير معروف');
  if (!okDate(o.pubDate) || !okDate(o.effFrom) || !okDate(o.effTo)) throw new Error('التواريخ بصيغة YYYY-MM-DD');
  if (o.status && !['active', 'superseded', 'draft'].includes(o.status)) throw new Error('حالة غير معروفة');
  return { cat: 'other', authority: 'other', status: 'active', ...o };
}
/** يستخرج نص PDF صفحةً صفحة بـ Claude (OCR للممسوح) — دفعات من 15 صفحة؛ يُرجع [{page,text}] */
export async function refPdfPages(ai, model, b64, { maxPages = 100, batch = 15 } = {}) {
  const pages = []; let total = null;
  for (let a = 1; a <= (total || batch) && a <= maxPages; a += batch) {
    const b = a + batch - 1;
    const r = await ai.messages.create({ model, max_tokens: 32000, messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
      { type: 'text', text: 'استخرج النص حرفيًا كما هو مكتوب للصفحات من ' + a + ' إلى ' + b + ' (استعمل التعرف الضوئي إن كانت الصفحة صورة). لا تلخّص ولا تترجم ولا تضف شيئًا. حافظ على أرقام الفقرات والعناوين وافصل الفقرات بسطر فارغ.' +
        ' أعد JSON فقط بالشكل: {"total_pages": <عدد صفحات الملف كله>, "pages": [{"page": <رقم>, "text": "<النص>"}]} — وإن كانت صفحة فارغة فاجعل text فارغًا.' }] }] });
    const txt = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('تعذّر استخراج نص الصفحات ' + a + '–' + b);
    let j; try { j = JSON.parse(m[0]); } catch { throw new Error('رد غير صالح عند استخراج الصفحات ' + a + '–' + b); }
    if (total == null) { total = Number(j.total_pages) || 0; if (total > maxPages) throw new Error('الملف ' + total + ' صفحة — الحد ' + maxPages + '؛ قسّمه إلى ملفات أصغر'); }
    (j.pages || []).forEach(p => { const n = Number(p.page); if (n >= a && n <= b && !pages.some(x => x.page === n)) pages.push({ page: n, text: String(p.text || '') }); });
    if (!total) break;
  }
  return pages.sort((x, y) => x.page - y.page);
}

export function mountRefs(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, aiClient, refModel = 'claude-haiku-5-5', log = console, now = Date.now }) {
  const toks = new Map(); const tok = (t) => { if (!toks.has(t.id)) toks.set(t.id, saTokenSource(t.sa, { fetchImpl })); return toks.get(t.id)(); };
  const base = (t) => 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId) + '/databases/(default)/documents';
  const fs = async (t, url, init = {}) => { const r = await fetchImpl(url, { ...init, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json', ...(init.headers || {}) } }); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j }; };
  const tenantOf = (req, res) => { const t = T.byId((req.user && req.user.tenant) || 'default') || T.def; if (!t || !t.sa) { res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)', code: 'no-sa' }); return null; } return t; };
  const isAdmin = (req) => req.user && req.user.role === 'system_admin';
  const list = async (t, col) => { const out = []; let pt = ''; for (let i = 0; i < 200; i++) { const r = await fs(t, base(t) + '/' + col + '?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''));
    if (!r.ok && r.status !== 404) throw new Error('تعذّرت قراءة ' + col); (r.j.documents || []).forEach(d => out.push({ id: d.name.split('/').pop(), ...decodeFields(d.fields) })); pt = r.j.nextPageToken || ''; if (!pt) break; } return out; };
  const cache = new Map(); const lib = async (t) => { const c = cache.get(t.id); if (c && c.exp > now()) return c.v; const v = { docs: await list(t, 'ref_docs'), chunks: await list(t, 'ref_chunks') }; cache.set(t.id, { v, exp: now() + 10 * 60000 }); return v; };
  const commit = async (t, writes) => { for (let i = 0; i < writes.length; i += 400) { const r = await fs(t, base(t) + ':commit', { method: 'POST', body: JSON.stringify({ writes: writes.slice(i, i + 400) }) }); if (!r.ok) throw new Error('تعذّر الحفظ (' + r.status + ')'); } };
  const docPath = (t, col, id) => base(t).replace('https://firestore.googleapis.com/v1/', '') + '/' + col + '/' + id;
  const lim = rateLimit({ windowMs: 60 * 1000, max: 60 }); const upLim = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
  const jobs = new Map();
  // v56.59 — الهوية قبل قراءة أي جسم (طلب بلا هوية بجسم 40MB ⇒ 401 دون تحليله)، ويسبقها حد لكل عنوان IP على مسار الرفع الكبير
  const ipUpLim = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyFn: (r) => 'refup-ip:' + (r.ip || 'anon') });

  app.get('/api/refs', requireMember, lim, async (req, res) => { const t = tenantOf(req, res); if (!t) return;
    try { const L = await lib(t); res.json({ docs: L.docs.map(d => ({ ...d, chunks: L.chunks.filter(c => c.doc === d.id).length })), cats: REF_CATS, auth: REF_AUTH }); } catch (e) { res.status(502).json({ error: e.message }); } });
  app.post('/api/refs/search', requireMember, lim, express.json({ limit: '16kb' }), async (req, res) => { const t = tenantOf(req, res); if (!t) return;
    const b = req.body || {}; const q = String(b.q || '').slice(0, 500); if (q.trim().length < 2) return res.status(400).json({ error: 'اكتب عبارة البحث' });
    try { const L = await lib(t); let hits = refSearch(L.chunks, L.docs, q, { cat: b.cat, authority: b.authority, family: b.family, year: b.year, includeInactive: !!b.includeInactive, limit: 20 });
      let ranked = false, rkNote = '';
      if (b.rerank && hits.length > 1 && aiClient) { try {
        const ai = aiClient(); const r = await ai.messages.create({ model: refModel, max_tokens: 800, messages: [{ role: 'user', content: 'رتّب المقاطع التالية حسب صلتها بالسؤال. أعد JSON فقط: {"order":[أرقام المقاطع]} ولا تضف مقاطع.\nالسؤال: ' + q + '\n\n' + hits.map((h, i) => '[' + i + '] ' + h.excerpt).join('\n\n') }] });
        const m = ((r.content || []).find(c => c.type === 'text') || {}).text || ''; const o = (JSON.parse((m.match(/\{[\s\S]*\}/) || ['{}'])[0]).order || []).map(Number).filter(i => i >= 0 && i < hits.length);
        if (o.length) { const seen = new Set(o); hits = [...o.map(i => hits[i]), ...hits.filter((_, i) => !seen.has(i))]; ranked = true; } } catch (e) { log.error('refs rerank', e.message); if (isNoCredit(e)) rkNote = AI_NO_CREDIT; } }
      res.json({ q, ranked, hits, ...(rkNote ? { rerankError: rkNote } : {}), note: 'المقتطفات حرفية من الملفات المرفوعة. «غير موثّق» = لم يتحقق مسؤول النظام من إصداره ونفاذه.' }); } catch (e) { res.status(502).json({ error: e.message }); } });
  // رفع: {meta, pages:[{page,text}]} أو {meta, pdf: base64}
  app.post('/api/refs/upload', ipUpLim, requireMember, upLim, (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'رفع المراجع لمسؤول النظام فقط' }), express.json({ limit: '40mb' }), async (req, res) => { const t = tenantOf(req, res); if (!t) return;
    if (!isAdmin(req)) return res.status(403).json({ error: 'رفع المراجع لمسؤول النظام فقط' });
    let meta; try { meta = refMetaClean((req.body || {}).meta); } catch (e) { return res.status(400).json({ error: e.message }); }
    const b = req.body || {}; const id = 'rf-' + crypto.randomBytes(6).toString('hex'); const job = { id, state: 'running', at: now() }; jobs.set(id, job);
    res.json({ job: id });
    (async () => {
      let pages = Array.isArray(b.pages) ? b.pages.slice(0, 5000).map(p => ({ page: Number(p.page) || 1, text: String(p.text || '').slice(0, 200000) })) : null;
      if (!pages && b.pdf) { if (!aiClient) throw new Error('استخراج PDF يتطلب ANTHROPIC_API_KEY'); job.state = 'extracting'; pages = await refPdfPages(aiClient(), refModel, String(b.pdf)); }
      if (!pages || !pages.some(p => p.text.trim())) throw new Error('لا نص مستخرج من الملف');
      const ch = refChunk(pages); job.state = 'saving';
      const writes = [{ update: { name: docPath(t, 'ref_docs', id), fields: { ...Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, S(v)])), verified: Bo(false), pages: I(pages.length), chunks: I(ch.length), uploadedBy: S(req.user.email), at: S(new Date(now()).toISOString()) } } },
        ...ch.map((c, n) => ({ update: { name: docPath(t, 'ref_chunks', id + '__' + String(n).padStart(5, '0')), fields: { doc: S(id), page: I(c.page), para: I(c.para), text: S(c.text) } } }))];
      await commit(t, writes); cache.delete(t.id); job.state = 'done'; job.pages = pages.length; job.chunks = ch.length; log.log('refs: رفع', t.id, id, pages.length + 'ص');
    })().catch(e => { job.state = 'error'; job.error = isNoCredit(e) ? AI_NO_CREDIT : e.message; job.code = isNoCredit(e) ? 'no-credit' : ''; log.error('refs upload', e.message); });
  });
  app.get('/api/refs/job/:id', requireMember, (req, res) => { const j = jobs.get(String(req.params.id)); if (!j) return res.status(404).json({ error: 'غير موجود' }); res.json(j); });
  app.post('/api/refs/update', requireMember, lim, express.json({ limit: '16kb' }), async (req, res) => { const t = tenantOf(req, res); if (!t) return;
    if (!isAdmin(req)) return res.status(403).json({ error: 'لمسؤول النظام فقط' });
    const b = req.body || {}; const id = String(b.id || ''); if (!/^rf-[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'معرّف غير صالح' });
    try { const cur = await fs(t, base(t) + '/ref_docs/' + id); if (!cur.ok) return res.status(404).json({ error: 'غير موجود' });
      const m = refMetaClean({ ...decodeFields(cur.j.fields), ...(b.meta || {}) }); const f = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, S(v)]));
      if (b.verify != null) { f.verified = Bo(!!b.verify); f.verifiedBy = S(req.user.email); f.verifiedAt = S(new Date(now()).toISOString()); }
      const mask = Object.keys(f).map(k => 'updateMask.fieldPaths=' + k).join('&');
      const w = await fs(t, base(t) + '/ref_docs/' + id + '?' + mask + '&currentDocument.exists=true', { method: 'PATCH', body: JSON.stringify({ fields: f }) }); if (!w.ok) throw new Error('تعذّر الحفظ');
      cache.delete(t.id); log.log('refs: تحديث', t.id, id, req.user.email); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); } });
  // v54.5 — المرحلة 6: وكيل المراجعة: لكل حالة رقابية ⇐ بحث في المراجع ⇐ Claude مقيَّد بالمقاطع ⇐ تحقق حتمي (revValidate). لا يكتب شيئًا في بيانات المنشأة.
  const revLim = rateLimit({ windowMs: 60 * 60 * 1000, max: 60 });
  app.post('/api/refs/review', requireMember, revLim, express.json({ limit: '128kb' }), async (req, res) => { const t = tenantOf(req, res); if (!t) return;
    if (!REVIEW_ROLES.has(req.user && req.user.role)) return res.status(403).json({ error: 'المراجعة المحاسبية للمالية والإدارة فقط' });
    if (!aiClient) return res.status(503).json({ error: 'وكيل المراجعة يتطلب ANTHROPIC_API_KEY على الخادم', code: 'no-ai' });
    const cases = (Array.isArray((req.body || {}).cases) ? req.body.cases : []).slice(0, 10).map(c => ({ no: String(c.no || '').slice(0, 20), key: String(c.key || '').slice(0, 300), cat: String(c.cat || '').slice(0, 30), sev: String(c.sev || '').slice(0, 12),
      title: String(c.title || '').slice(0, 300), evidence: String(c.evidence || '').slice(0, 2000), fix: String(c.fix || '').slice(0, 600), impact: Number(c.impact) || 0 }));
    if (!cases.length) return res.status(400).json({ error: 'لا حالات للمراجعة' });
    try { const L = await lib(t); const txt = new Map(L.chunks.map(c => [c.doc + '|' + c.page + '|' + c.para, c.text])); const ai = aiClient(); const out = [];
      for (const c of cases) {
        const hits = refSearch(L.chunks, L.docs, revQuery(c), { limit: 6 }).map(h => ({ ...h, text: txt.get(h.doc + '|' + h.page + '|' + h.para) || h.excerpt }));
        let raw = '{}'; try { const r = await ai.messages.create({ model: refModel, max_tokens: 1500, messages: [{ role: 'user', content: revPrompt(c, hits) }] }); raw = ((r.content || []).find(x => x.type === 'text') || {}).text || '{}'; }
        catch (e) { log.error('refs review', e.message); if (isNoCredit(e)) return res.status(402).json({ error: AI_NO_CREDIT, code: 'no-credit', done: out.length }); out.push({ caseNo: c.no, caseKey: c.key, error: 'تعذّر تحليل الحالة: ' + e.message }); continue; }
        out.push({ ...revValidate(raw, c, hits, { at: new Date(now()).toISOString(), model: refModel }), searched: hits.length }); }
      log.log('refs: مراجعة', t.id, req.user.email, cases.length); res.json({ findings: out, note: hits0(L) }); } catch (e) { res.status(502).json({ error: e.message }); } });
  const hits0 = (L) => L.docs.length ? 'الاستشهادات تحققها المنصة حرفيًا من المراجع المرفوعة؛ ما لا يثبت يُسقط.' : 'لا مراجع مرفوعة بعد — النتائج ستكون شرحًا من الذكاء الاصطناعي بلا سند.';
  return { lib, jobs, cache };
}
