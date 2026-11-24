/* v54.4 — المرحلة 5: أدوات مكتبة المراجع المشتركة (الخادم والاختبارات): تطبيع عربي/إنجليزي، تقطيع الصفحات إلى مقاطع بأرقام صفحاتها وفقراتها، بحث نصي مرتّب (BM25 مبسّط)
   مع تعزيز رقم المعيار والفقرة، ومقتطف حرفي من النص الأصلي — لا نص مولَّد. */
export const REF_AUTH = { official: 'متطلب رسمي منشور', internal: 'سياسة داخلية للمنشأة', interpretation: 'تفسير مهني', other: 'مرجع آخر' };
export const REF_CATS = { ifrs: 'IFRS', ias: 'IAS', ifric: 'IFRIC', socpa: 'الهيئة السعودية للمراجعين والمحاسبين', zatca: 'هيئة الزكاة والضريبة والجمارك', vat: 'ضريبة القيمة المضافة', zakat: 'الزكاة', policy: 'سياسات داخلية', procedure: 'إجراءات', audit: 'أدلة مراجعة', contract: 'عقود وسياسات معتمدة', other: 'أخرى' };
const AR_DIAC = /[ً-ٰٟـ]/g;
export const refNorm = (s) => String(s == null ? '' : s).replace(AR_DIAC, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLowerCase();
const STOP = new Set(['في', 'من', 'على', 'الى', 'عن', 'ان', 'او', 'و', 'ما', 'هل', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'كل', 'the', 'of', 'and', 'to', 'a', 'in', 'is', 'for', 'or', 'an', 'be', 'by', 'on', 'as', 'with', 'that', 'this', 'are', 'it']);
const stem = (w) => { if (w.length > 5 && /^(وال|بال|كال|فال|لل)/.test(w)) w = w.slice(w.startsWith('لل') ? 2 : 3); else if (w.length > 4 && /^ال/.test(w)) w = w.slice(2); else if (w.length > 4 && /^[وفبلك][^\x00-\x7f]/.test(w)) w = w.slice(1); return w; };
export const refTokens = (s) => refNorm(s).split(/[^\p{L}\p{N}.]+/u).map(w => w.replace(/^\.+|\.+$/g, '')).filter(w => w && !STOP.has(w)).map(stem);
/** يستخرج مراجع المعايير من النص: IFRS 15، IAS 16، IFRIC 23، والفقرات (15.31، فقرة 31) */
export function refStdRefs(s) {
  const n = refNorm(s); const out = new Set();
  for (const m of n.matchAll(/\b(ifrs|ias|ifric|sic)\s*-?\s*(\d{1,3})\b/g)) out.add(m[1] + ' ' + Number(m[2]));
  for (const m of n.matchAll(/(?:المعيار الدولي للتقرير المالي|معيار التقرير المالي الدولي)\s*(?:رقم\s*)?\(?(\d{1,3})/g)) out.add('ifrs ' + Number(m[1]));
  for (const m of n.matchAll(/(?:معيار المحاسبه الدولي)\s*(?:رقم\s*)?\(?(\d{1,3})/g)) out.add('ias ' + Number(m[1]));
  return [...out];
}
export const refParas = (s) => [...refNorm(s).matchAll(/(?:فقره|paragraph|para|§)\s*(\d+[a-z]?(?:\.\d+)?)/g)].map(m => m[1]);
/** صفحات ⇒ مقاطع (~1,200 حرف) تحفظ الصفحة ورقم المقطع في الصفحة — الاستشهاد يكون بالصفحة الفعلية */
export function refChunk(pages, max = 1200) {
  const out = [];
  (pages || []).forEach(p => { const paras = String(p.text || '').split(/\n\s*\n|\r\n\r\n/).map(x => x.trim()).filter(Boolean); let buf = '', k = 0;
    const flush = () => { if (buf.trim()) out.push({ page: p.page, para: ++k, text: buf.trim() }); buf = ''; };
    paras.forEach(x => { if (buf && (buf.length + x.length) > max) flush(); if (x.length > max * 2) { for (let i = 0; i < x.length; i += max) { buf = x.slice(i, i + max); flush(); } } else buf += (buf ? '\n\n' : '') + x; }); flush(); });
  return out;
}
/** بحث: BM25 مبسّط + تعزيز رقم المعيار/الفقرة والعبارة الحرفية؛ يُرجع المقطع مع مقتطف حرفي */
export function refSearch(chunks, docs, q, opts = {}) {
  const D = new Map((docs || []).map(d => [d.id, d])); const qt = [...new Set(refTokens(q))]; const qs = refStdRefs(q); const qp = refParas(q); const qn = refNorm(q).trim();
  const pool = (chunks || []).filter(c => { const d = D.get(c.doc); if (!d) return false; if (!opts.includeInactive && d.status && d.status !== 'active') return false;
    if (opts.cat && d.cat !== opts.cat) return false; if (opts.authority && d.authority !== opts.authority) return false; if (opts.family && refNorm(d.family) !== refNorm(opts.family)) return false;
    if (opts.year && !String(d.effFrom || d.pubDate || '').startsWith(String(opts.year))) return false; return true; });
  if (!qt.length && !qs.length) return [];
  const N = pool.length || 1; const toks = pool.map(c => refTokens(c.text)); const avg = toks.reduce((a, t) => a + t.length, 0) / N || 1; const df = {};
  toks.forEach(t => new Set(t).forEach(w => { df[w] = (df[w] || 0) + 1; }));
  const res = pool.map((c, i) => { const t = toks[i]; const tf = {}; t.forEach(w => { tf[w] = (tf[w] || 0) + 1; }); let s = 0;
    qt.forEach(w => { const f = tf[w] || 0; if (!f) return; const idf = Math.log(1 + (N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * t.length / avg)); });
    const d = D.get(c.doc); const fam = refNorm(d.family || '') + ' ' + refStdRefs(c.text).join(' ');
    qs.forEach(r => { if (fam.includes(r)) s += 3; }); qp.forEach(p => { if (new RegExp('(^|[^\\d.])' + p.replace('.', '\\.') + '([^\\d]|$)').test(refNorm(c.text))) s += 2; });
    if (qn.length > 6 && refNorm(c.text).includes(qn)) s += 4;
    return { c, s }; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, opts.limit || 20);
  return res.map(({ c, s }) => { const d = D.get(c.doc); return { doc: c.doc, title: d.title, family: d.family || '', version: d.version || '', authority: d.authority, authorityLabel: REF_AUTH[d.authority] || '', verified: !!d.verified, status: d.status || 'active',
    effFrom: d.effFrom || '', page: c.page, para: c.para, score: Math.round(s * 100) / 100, excerpt: refExcerpt(c.text, qt) }; });
}
/** مقتطف حرفي (≤ 420 حرفًا) حول أول تطابق — من النص الأصلي دون تعديل */
export function refExcerpt(text, qt) {
  const t = String(text || ''); const n = refNorm(t); let at = -1; for (const w of qt || []) { const i = n.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const st = Math.max(0, (at < 0 ? 0 : at) - 120); return (st > 0 ? '…' : '') + t.slice(st, st + 420) + (st + 420 < t.length ? '…' : '');
}

/* ===== v54.5 — المرحلة 6: وكيل المراجعة المحاسبية بالمراجع — أدوات حتمية للتحقق من مخرجات النموذج =====
   النموذج يقترح، والتحقق هنا يقرّر: لا استشهاد إلا بمقطع مُرسل إليه وبنص موجود فيه حرفيًا، والحجية تُشتق من بيانات المرجع لا من ادعاء النموذج،
   والقيد التصحيحي يُقبل متوازنًا فقط ثم يمر بتحقق «اقتراح قيد» في الخادم ولا يُرحَّل إلا باعتماد مسؤول النظام. */
export const REV_BASIS = { requirement: 'متطلب رسمي (من نص مرفوع موثّق)', policy: 'سياسة داخلية للمنشأة', interpretation: 'تفسير مهني', ai: 'شرح الذكاء الاصطناعي — بلا سند مرفوع' };
export const REV_CONF = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
export const REV_Q = {
  dup_invoice: 'فاتورة مكررة تسجيل المصروف مرة واحدة الالتزامات', dup_amount: 'تكرار المبلغ نفس المورد الفاتورة',
  vat_calc: 'ضريبة القيمة المضافة احتساب 15% الفاتورة الضريبية', vat_supplier: 'الرقم الضريبي للمورد استرداد ضريبة المدخلات الفاتورة الضريبية',
  missing_doc: 'المستندات المؤيدة للقيد إثبات الفاتورة', future_date: 'تاريخ القيد الفترة المحاسبية الاستحقاق', unbalanced: 'القيد المزدوج تساوي المدين والدائن',
  locked_pending: 'إقفال الفترة القيود المعلقة', equity_touch: 'حقوق الملكية رأس المال جاري الشريك', nature: 'تصنيف المصروف طبيعة الحساب الرصيد', anomaly: 'قيد غير اعتيادي مراجعة',
};
export const revQuery = (c) => [REV_Q[c.cat] || '', String(c.title || '')].join(' ').trim();
const wsn = (s) => refNorm(s).replace(/[\s‏‎«»"“”'.,،:؛;()\-–—…]+/g, ' ').trim();
/** نص التعليمات للنموذج: المقاطع مرقمة، والمطلوب JSON فقط */
export function revPrompt(c, hits) {
  return 'أنت مراجع محاسبي. حلّل الحالة الرقابية التالية مستندًا فقط إلى المقاطع المرقمة أدناه من مراجع المنشأة المرفوعة. لا تذكر معيارًا أو رقم فقرة غير موجود حرفيًا في المقاطع.\n'
    + 'أعد JSON فقط بالشكل: {"analysis":"تحليل موجز","basis":"requirement|policy|interpretation|ai","citations":[{"n":رقم المقطع,"quote":"عبارة منقولة حرفيًا من المقطع لا تتجاوز 25 كلمة"}],"correction":"التصحيح المقترح نصًا","lines":[{"code":"رمز الحساب","debit":0,"credit":0}],"confidence":"high|medium|low"}\n'
    + 'اجعل lines فارغة إن لم يلزم قيد تصحيحي أو لم تتأكد من الحسابات. إن لم تجد سندًا في المقاطع فاجعل citations فارغة وbasis="ai".\n\n'
    + 'الحالة: ' + [c.no, c.title].filter(Boolean).join(' — ') + '\nالفئة: ' + (c.cat || '') + '\nالدليل: ' + String(c.evidence || '').slice(0, 1500) + '\nالأثر التقديري: ' + (Number(c.impact) || 0) + '\nالحل المقترح من الفحص: ' + (c.fix || '') + '\n\n'
    + 'المقاطع:\n' + (hits || []).map((h, i) => '[' + i + '] «' + h.title + '» ص' + h.page + ' مقطع ' + h.para + ' (' + (h.authorityLabel || '') + (h.verified ? '، موثّق' : '، غير موثّق') + '):\n' + String(h.text || h.excerpt || '').slice(0, 1500)).join('\n\n');
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** يتحقق من رد النموذج ويبني «النتيجة» بحقولها الإحدى عشرة — كل ما لا يُثبت يُسقط أو يُخفَّض */
export function revValidate(raw, c, hits, { at = '', model = '' } = {}) {
  let o = raw; if (typeof raw === 'string') { try { o = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { o = {}; } } o = o || {};
  const dropped = [];
  const cites = []; (Array.isArray(o.citations) ? o.citations : []).slice(0, 6).forEach(x => { const n = Number(x && x.n); const h = Number.isInteger(n) ? (hits || [])[n] : null; const q = String((x && x.quote) || '').trim();
    if (!h) return dropped.push('استشهاد بمقطع غير مُرسل'); if (q.length < 8 || !wsn(h.text || h.excerpt).includes(wsn(q))) return dropped.push('عبارة غير موجودة حرفيًا في «' + h.title + '» ص' + h.page);
    if (!cites.some(y => y.doc === h.doc && y.page === h.page && y.para === h.para)) cites.push({ doc: h.doc, title: h.title, family: h.family || '', version: h.version || '', page: h.page, para: h.para, quote: q.slice(0, 300), authority: h.authority, authorityLabel: h.authorityLabel || REF_AUTH[h.authority] || '', verified: !!h.verified, status: h.status || 'active' }); });
  // الحجية من بيانات المرجع: «متطلب» فقط من مرجع رسمي موثّق ساري؛ سياسة من مرجع داخلي؛ وإلا تفسير؛ وبلا استشهاد = شرح AI
  let basis = REV_BASIS[o.basis] ? o.basis : 'interpretation';
  const offOk = cites.some(x => x.authority === 'official' && x.verified && x.status === 'active'), pol = cites.some(x => x.authority === 'internal');
  if (!cites.length) basis = 'ai'; else if (basis === 'requirement' && !offOk) basis = pol ? 'policy' : 'interpretation'; else if (basis === 'policy' && !pol) basis = 'interpretation'; else if (basis === 'ai') basis = 'interpretation';
  let lines = (Array.isArray(o.lines) ? o.lines : []).slice(0, 20).map(l => ({ code: String((l && l.code) || '').trim(), debit: r2(l && l.debit), credit: r2(l && l.credit) })).filter(l => l.code && (l.debit > 0 || l.credit > 0));
  const dr = r2(lines.reduce((s, l) => s + l.debit, 0)), cr = r2(lines.reduce((s, l) => s + l.credit, 0));
  if (lines.length && (lines.length < 2 || dr !== cr || lines.some(l => l.debit > 0 && l.credit > 0))) { dropped.push('قيد تصحيحي غير متوازن أُسقط'); lines = []; }
  let confidence = REV_CONF[o.confidence] ? o.confidence : 'low'; if (basis === 'ai' || cites.some(x => !x.verified)) confidence = confidence === 'high' ? 'medium' : confidence; if (basis === 'ai') confidence = 'low';
  return {
    issue: String(c.title || ''), category: c.cat || '', severity: c.sev || '', evidence: String(c.evidence || ''), citations: cites, basis, basisLabel: REV_BASIS[basis],
    analysis: String(o.analysis || '').slice(0, 2000) || 'لم يُرجع النموذج تحليلًا', impact: r2(c.impact), correction: { text: String(o.correction || '').slice(0, 1200), lines, total: dr },
    confidence, approval: 'required', at, model, dropped, caseNo: c.no || '', caseKey: c.key || '',
  };
}

/* v54.8 — رصيد Anthropic: رفض المزود لنفاد الرصيد يُعرف ويُعرض بالعربية ويوقف بقية الطلبات (لا تكرار لطلب مرفوض حتمًا) */
export const AI_NO_CREDIT = 'رصيد Anthropic غير كافٍ — اشحنه من console.anthropic.com ← Plans & Billing ثم أعد المحاولة';
export const isNoCredit = (e) => /credit balance is too low|purchase credits/i.test(String((e && e.message) || '') + ' ' + String((e && e.error && e.error.error && e.error.error.message) || ''));
