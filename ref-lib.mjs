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
