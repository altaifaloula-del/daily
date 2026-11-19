#!/usr/bin/env node
/**
 * v51.3 — المرحلة 07 / S4: يولّد قواعد Firestore الخاصة بالمنشآت المشتركة (firestore.tenant.rules) من قواعد الطيف نفسها.
 * • قواعد الطيف (firestore.rules) لا تُمس — تبقى كما هي حرفيًا.
 * • كل قاعدة كتابة (create/update/delete/write) تُغلَّف بشرط subOk(): الاشتراك «نشط».
 *   اشتراك «للقراءة فقط» أو «موقوف» ⇒ لا كتابة إطلاقًا من أي حساب، والقراءة تبقى (حق المنشأة في بياناتها وتصديرها).
 * • حالة الاشتراك في mq_control/subscription — يقرؤها الأعضاء ولا يكتبها أي عميل (يكتبها مزوّد مِثقال بحساب الخدمة فقط).
 * الاستعمال: node scripts/tenant-rules.mjs           ⇒ يكتب الملف
 *            node scripts/tenant-rules.mjs --check   ⇒ يفشل إن كان الملف غير محدَّث
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const SUB = '/databases/$(database)/documents/mq_control/subscription';
const HEADER = '// ⚠ ملف مولَّد من firestore.rules بواسطة scripts/tenant-rules.mjs — لا تعدّله يدويًا. للمنشآت المشتركة فقط (ليس الطيف).\n';
const FUNCS = `
    // [TENANT] v51.3 — حالة اشتراك المنشأة: الكتابة للمشترك النشط فقط
    function subOk() {
      return !exists(${SUB})
        || get(${SUB}).data.get('status', 'active') == 'active';
    }
`;
const CONTROL = `
    // [TENANT] حالة الاشتراك والخطة — للقراءة فقط من الواجهة؛ يكتبها مزوّد مِثقال بحساب الخدمة
    match /mq_control/{docId} {
      allow read: if isMember() || isAdmin();
      allow write: if false;
    }
`;

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
  const tail = out.lastIndexOf('match /{document=**}');
  if (tail < 0) throw new Error('لا توجد قاعدة الرفض العامة');
  const ls = out.lastIndexOf('\n', tail) + 1;
  out = out.slice(0, ls) + CONTROL.replace(/^\n/, '') + '\n' + out.slice(ls);
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
