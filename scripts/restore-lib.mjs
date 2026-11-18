// v49.1 — MQ-171: تمرين الاستعادة (نقي وقابل للاختبار دون شبكة)
//  • disassemble: عكس assemble — قيمة منطقية ⇒ مستندات Firestore بصيغة المنصة (رأس {parts, ver, value} + أجزاء {chunk})
//  • fingerprint: بصمة النسخة المنطقية (الإعدادات + كل المجموعات + الأرصدة) للمقارنة قبل الاستعادة وبعدها
//  • reconcileProtected: مطابقة السجلات المحمية في النسخة (closings, fin_journal, fin_docs) مع البيانات — ناقص/مختلف/زائد
import crypto from 'node:crypto';

export const CHUNK = 700000;   // أقل من حد المستند (1MiB) بهامش للحقول
export function disassemble(values, size = CHUNK) {
  const docs = {};
  for (const [id, v] of Object.entries(values || {})) {
    if (v === undefined) continue;
    if (!id.startsWith('rms8_')) { docs[id] = v; continue; }   // مستندات التحكم كما هي
    const text = JSON.stringify(v);
    if (text.length <= size) { docs[id] = { parts: 1, value: text, updatedAt: 0 }; continue; }
    const ver = 'r' + crypto.randomBytes(4).toString('hex'), n = Math.ceil(text.length / size);
    docs[id] = { parts: n, ver, updatedAt: 0 };
    for (let i = 0; i < n; i++) docs[id + '__' + ver + '_' + i] = { chunk: text.slice(i * size, (i + 1) * size) };
  }
  return docs;
}
const stable = (x) => Array.isArray(x) ? x.map(stable) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
/** بصمة لكل جزء من النسخة المنطقية: الإعدادات، كل مجموعة، والسجل التاريخي — للمقارنة الدقيقة بعد الاستعادة */
export function fingerprint(logical) {
  const out = { org: sha(JSON.stringify(stable(logical.org || null))), hist: sha(JSON.stringify(stable(logical.hist || null))), ops: {} };
  Object.keys(logical.ops || {}).sort().forEach(k => { out.ops[k] = { n: (logical.ops[k] || []).length, h: sha(JSON.stringify(stable(logical.ops[k]))) }; });
  return out;
}
export function diffPrints(a, b) {
  const d = [];
  if (a.org !== b.org) d.push('org'); if (a.hist !== b.hist) d.push('hist');
  new Set([...Object.keys(a.ops), ...Object.keys(b.ops)]).forEach(k => { const x = a.ops[k], y = b.ops[k]; if (!x || !y || x.h !== y.h) d.push(k + ' (' + (x ? x.n : 0) + ' ⇢ ' + (y ? y.n : 0) + ')'); });
  return d;
}
/** E = محرك المنصة (buildEngine). raw = { closings:{id:data}, fin_journal:{…}, fin_docs:{…} } */
export function reconcileProtected(E, logical, raw) {
  const ops = logical.ops || {}, rec = (c) => Object.entries((raw || {})[c] || {}).map(([id, d]) => ({ id, ...d })), out = {};
  if ((raw || {}).closings) { const r = E.clrCompare(ops.closings || [], rec('closings')); out.closings = { ok: r.ok, missing: r.missing.length, differ: r.differ.length, extra: r.extra.length }; }
  if ((raw || {}).fin_journal) { const r = E.fjCompare(ops.journalManual || [], rec('fin_journal')); out.journal = { ok: r.ok, missing: r.missing.length, differ: r.differ.length, extra: r.extra.length }; }
  if ((raw || {}).fin_docs) { const R = rec('fin_docs'); for (const [k, col] of [['pi', 'invoices'], ['si', 'salesInvoices'], ['cv', 'cashVouchers']]) {
    const r = E.fdCompare(k, ops[col] || [], R); out['docs_' + k] = { ok: r.ok, missing: r.missing.length, differ: r.differ.length, extra: r.extra.length }; } }
  return out;
}
