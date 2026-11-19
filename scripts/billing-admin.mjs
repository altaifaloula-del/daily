#!/usr/bin/env node
/**
 * v51.4 — المرحلة 07 / S5: أدوات مزوّد مِثقال للفوترة (حتى تُبنى لوحة المزوّد في S6). يشغّلها المالك بحساب خدمة مشروع التحكم.
 *
 *   MQ_CONTROL_PROJECT=mithqal-control MQ_CONTROL_SA_FILE=sa.json node scripts/billing-admin.mjs due
 *       ⇒ حالة كل اشتراك والتوصية (نشط / للقراءة فقط / موقوف) مع أمر تغيير الحالة إن لزم — لا يغيّر شيئًا
 *   ... node scripts/billing-admin.mjs confirm --inv MQ-2026-000012 --ref <مرجع التحويل> --amount 228.85 [--apply]
 *       ⇒ تأكيد تحويل بنكي: المبلغ يجب أن يطابق الفاتورة، ثم يُمدَّد الاشتراك. بلا --apply يعرض ما سيحدث فقط
 *   ... node scripts/billing-admin.mjs void --inv MQ-2026-000012 [--apply]   ⇒ إلغاء فاتورة غير مدفوعة (لا تُحذف)
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { subscriptionState, applyPayment, okInvoiceNo, sar } from '../billing.js';
import { firestoreStore, saTokenSource, extendSub } from '../server-billing.js';

/** التوصيات لكل الاشتراكات — خالصة للاختبار */
export function dueReport(subs, today) {
  return subs.map(s => ({ tenant: s.tenant, paidThrough: s.paidThrough || '', ...subscriptionState(s.paidThrough || '', today) }))
    .map(r => ({ ...r, cmd: r.recommend === 'active' ? '' : 'node scripts/tenant-provision.mjs status --id ' + r.tenant + ' --set ' + r.recommend }));
}
/** تأكيد تحويل بنكي — يعيد الفاتورة الجديدة أو سبب الرفض */
export function confirmTransfer(inv, { ref, amountSar, at }) {
  if (!inv) return { error: 'الفاتورة غير موجودة' };
  if (inv.status !== 'pending_transfer' && inv.status !== 'open') return { error: 'حالة الفاتورة: ' + inv.status };
  if (!ref || String(ref).trim().length < 3) return { error: '--ref مرجع التحويل مطلوب' };
  const amount = Math.round(Number(amountSar) * 100);
  const r = applyPayment(inv, { ref: 'bank:' + String(ref).trim(), method: 'bank', amount, at });
  return r.error ? { error: r.error + ' (المطلوب ' + sar(inv.total) + ' ر.س)' } : { inv: r.inv };
}

function parse(argv) { const a = { _: [] }; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--apply') a.apply = true; else if (k.startsWith('--')) { a[k.slice(2)] = argv[i + 1]; i++; } else a._.push(k); } return a; }

async function main() {
  const a = parse(process.argv.slice(2)), cmd = a._[0];
  const project = process.env.MQ_CONTROL_PROJECT, file = process.env.MQ_CONTROL_SA_FILE;
  if (!project || !file || !fs.existsSync(file)) { console.error('اضبط MQ_CONTROL_PROJECT وMQ_CONTROL_SA_FILE (ملف حساب خدمة مشروع التحكم)'); process.exit(2); }
  const store = firestoreStore({ project, token: saTokenSource(JSON.parse(fs.readFileSync(file, 'utf8'))) });
  const today = new Date().toISOString().slice(0, 10);
  if (cmd === 'due') {
    for (const r of dueReport(await store.listSubs(), today)) console.log(r.tenant.padEnd(22), (r.paidThrough || '—').padEnd(11), r.state.padEnd(8), r.cmd ? '⇒ ' + r.cmd : '');
    return;
  }
  if (!okInvoiceNo(a.inv)) { console.error('--inv رقم فاتورة بصيغة MQ-YYYY-NNNNNN'); process.exit(2); }
  const inv = await store.getInvoice(a.inv);
  if (cmd === 'confirm') {
    const r = confirmTransfer(inv, { ref: a.ref, amountSar: a.amount, at: new Date().toISOString() });
    if (r.error) { console.error(r.error); process.exit(1); }
    console.log((a.apply ? '✓ ' : '(معاينة) ') + r.inv.no + ' مدفوعة بتحويل ' + a.ref + ' — ' + sar(r.inv.total) + ' ر.س — الاشتراك حتى ' + r.inv.end);
    if (a.apply) { await store.putInvoice(r.inv); await extendSub(store, r.inv); } else console.log('أضف --apply للتنفيذ');
    return;
  }
  if (cmd === 'void') {
    if (!inv || inv.status === 'paid') { console.error(inv ? 'لا تُلغى فاتورة مدفوعة' : 'الفاتورة غير موجودة'); process.exit(1); }
    console.log((a.apply ? '✓ ' : '(معاينة) ') + 'إلغاء ' + inv.no);
    if (a.apply) await store.putInvoice({ ...inv, status: 'void', voidAt: new Date().toISOString() }); else console.log('أضف --apply للتنفيذ');
    return;
  }
  console.error('الأمر: due | confirm | void'); process.exit(2);
}
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(e => { console.error(e.message); process.exit(1); });
