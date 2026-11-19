#!/usr/bin/env node
/**
 * v51.3 — المرحلة 07 / S4: يولّد قواعد Firestore الخاصة بالمنشآت المشتركة (firestore.tenant.rules) من قواعد الطيف نفسها.
 * • قواعد الطيف (firestore.rules) لا تُمس — تبقى كما هي حرفيًا.
 * • كل قاعدة كتابة (create/update/delete/write) تُغلَّف بشرط subOk(): الاشتراك «نشط».
 *   اشتراك «للقراءة فقط» أو «موقوف» ⇒ لا كتابة إطلاقًا من أي حساب، والقراءة تبقى (حق المنشأة في بياناتها وتصديرها).
 * • حالة الاشتراك في platform/release.sub — يقرؤها الأعضاء، ولا يغيّرها أي حساب في المنشأة (يكتبها مزوّد مِثقال بحساب الخدمة فقط).
 * الاستعمال: node scripts/tenant-rules.mjs           ⇒ يكتب الملف
 *            node scripts/tenant-rules.mjs --check   ⇒ يفشل إن كان الملف غير محدَّث
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

// حالة الاشتراك حقل «sub» في platform/release — المستند الذي تقرؤه أثقل الطلبات أصلًا (relOf)، فلا تُضاف قراءة جديدة
// تتجاوز سقف 10 قراءات للطلب. غياب الحقل أو المستند ⇒ نشط. يكتبه مزوّد مِثقال بحساب الخدمة؛ والمدير لا يغيّره.
const HEADER = '// ⚠ ملف مولَّد من firestore.rules بواسطة scripts/tenant-rules.mjs — لا تعدّله يدويًا. للمنشآت المشتركة فقط (ليس الطيف).\n';
const FUNCS = `
    // [TENANT] v51.3 — حالة اشتراك المنشأة (platform/release.sub): الكتابة للمشترك النشط فقط
    function subOk() {
      let r = relOf();
      return r == null || r.get('sub', 'active') == 'active';
    }
`;
const REL_OLD = "request.resource.data.keys().hasOnly(['minCv', 'cutover', 'at', 'by'])";
const REL_NEW = "request.resource.data.keys().hasOnly(['minCv', 'cutover', 'at', 'by', 'sub'])\n        // [TENANT] المدير يرفع الإصدار ولا يغيّر حالة الاشتراك\n        && request.resource.data.get('sub', 'active') == (resource == null ? 'active' : resource.data.get('sub', 'active'))";

/** نهاية عبارة allow: أول «;» خارج النصوص والتعليقات */
function stmtEnd(s, i) {
  let q = '';
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = ''; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) break; continue; }   // تعليق حتى نهاية السطر
    if (c === ';') return i;
  }
  throw new Error('عبارة allow بلا «;»');
}

export function tenantRules(src) {
  const RX = /^([ \t]*)allow ([a-z, ]+):[ \t]*if[ \t]+/gm;
  let out = '', last = 0, m, wrapped = 0;
  while ((m = RX.exec(src))) {
    const ops = m[2].split(',').map(x => x.trim()).filter(Boolean);
    const writes = ops.filter(o => ['create', 'update', 'delete', 'write'].includes(o));
    const reads = ops.filter(o => !writes.includes(o));
    const condStart = m.index + m[0].length, end = stmtEnd(src, condStart);
    const cond = src.slice(condStart, end);
    out += src.slice(last, m.index);
    if (!writes.length || /^false\s*$/.test(cond)) out += src.slice(m.index, end + 1);
    else {
      const ind = m[1];
      if (reads.length) out += ind + 'allow ' + reads.join(', ') + ': if ' + cond + ';\n';
      out += ind + 'allow ' + writes.join(', ') + ': if subOk() && (' + cond + ');';
      wrapped++;
    }
    last = end + 1; RX.lastIndex = last;
  }
  out += src.slice(last);
  const a = out.indexOf('match /databases/{database}/documents {');
  if (a < 0) throw new Error('بنية القواعد غير متوقعة');
  const ins = out.indexOf('\n', a) + 1;
  out = out.slice(0, ins) + FUNCS + out.slice(ins);
  if (out.split(REL_OLD).length !== 2) throw new Error('شكل قاعدة platform/release تغيّر — حدّث المولّد');
  if (!/function relOf\(\)/.test(out)) throw new Error('relOf غير موجودة');
  out = out.replace(REL_OLD, REL_NEW);
  return { text: HEADER + out, wrapped };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { text, wrapped } = tenantRules(fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8'));
  const dst = path.join(root, 'firestore.tenant.rules');
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
    if (cur !== text) { console.error('firestore.tenant.rules غير محدَّث — شغّل: node scripts/tenant-rules.mjs'); process.exit(1); }
    console.log('✓ firestore.tenant.rules محدَّث (' + wrapped + ' قاعدة كتابة)');
  } else { fs.writeFileSync(dst, text); console.log('✓ ' + dst + ' — ' + wrapped + ' قاعدة كتابة مشروطة بالاشتراك'); }
}
