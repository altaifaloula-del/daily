/* v50.2 — قواعد عامة للنصوص المركّبة (تُجرَّب بعد كل القواعد الخاصة):
   «بادئة معروفة — اسم/قيمة» و«بادئة: قيمة» و«عدد + كلمة معروفة». الجزء المتغيّر (أسماء الفروع والموردين) يبقى كما هو. */
import { EN, trWord } from '../i18n.js';
const tr = (x) => { const v = trWord(x); return v == null ? x : v; };
const known = (a) => EN[a.trim()] != null;
export const RX_END = [
  [/^(.+?) — (.+)$/s, (s, a, b) => known(a) ? EN[a.trim()] + ' — ' + tr(b) : s],
  [/^(.+?): (.+)$/s, (s, a, b) => known(a) ? EN[a.trim()] + ': ' + tr(b) : s],
  [/^(.+?) ← (.+)$/s, (s, a, b) => known(a) ? EN[a.trim()] + ' → ' + tr(b) : s],
  [/^(-?[\d.,]+) (\D.*)$/s, (s, n, w) => known(w) ? n + ' ' + EN[w.trim()] : s],
  [/^(\D.*?) (-?[\d.,]+%?)$/s, (s, w, n) => known(w) ? EN[w.trim()] + ' ' + n : s],
  [/^(.+?) \((.+)\)$/s, (s, a, b) => known(a) ? EN[a.trim()] + ' (' + tr(b) + ')' : s],
  [/^(.+?)، (.+)$/s, (s, a, b) => known(a) || known(b) ? tr(a) + ', ' + tr(b) : s]
];
export default {};
