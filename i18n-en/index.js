/* v50.2 — حزمة الترجمة الإنجليزية الكاملة (المرحلة 06) — مولّد: كل ملف دفعة { 'نص عربي': 'English' } مع قواعد RX/RX_END اختيارية.
   القاعدة: نصوص الواجهة فقط؛ بيانات المستخدم (أسماء الفروع والأصناف) لا تُترجم، والمطبوعات الرسمية تبقى عربية. */
import * as P0 from './b00-rules.js';
import * as P1 from './b01-core.js';
import * as P2 from './b02-mkt.js';
import * as P3 from './b03-acct1.js';
import * as P4 from './b04-acct2.js';
import * as P5 from './b05-acct3.js';
import * as P6 from './b06-app1.js';
import * as P7 from './b07-app2.js';
import * as P8 from './b08-app3.js';
import * as P9 from './b09-app4.js';
import * as P10 from './b10-app5.js';
import * as P11 from './b11-sysm.js';
const parts = [P0, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11];
const D = {};
parts.forEach(p => Object.assign(D, p.default || {}));
export default D;
export const RX = parts.flatMap(p => p.RX || []);
export const RX_END = parts.flatMap(p => p.RX_END || []);
