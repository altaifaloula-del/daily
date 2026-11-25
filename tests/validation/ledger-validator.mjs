/**
 * MITHQAL — محرك التحقق المحاسبي المستقل (Accounting Validation Engine)
 *
 * مستقل تمامًا عن App.jsx: لا يستورد أي دالة من المحرك المحاسبي المختبَر، ويعيد حساب كل شيء
 * بطريقة مختلفة (حساب صحيح بالهللات، إعادة بناء الأرصدة من السطور، مقارنة بالقيود المتوقعة).
 * المدخل: دفتر بصيغة محايدة (انظر normalizeFromEngine في engine-adapter.test.mjs للتحويل).
 *
 * قاعدة: توازن القيد وحده ليس دليل صحة — لذلك يوجد فحص expected-entry يقارن القيد بما يجب أن يكون.
 */

export const SEV = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium' };
export const KINDS = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const DEBIT_NATURE = new Set(['asset', 'expense']);

/** ريال ← هللات (عدد صحيح). يرفض أكثر من خانتين عشريتين. */
export function toH(x) {
  const n = Number(x || 0);
  const h = Math.round(n * 100);
  return { h, exact: Math.abs(n * 100 - h) < 1e-6 };
}
const fromH = (h) => h / 100;

function finding(check, severity, msg, ref) { return { check, severity, msg, ...(ref ? { ref } : {}) }; }

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const live = (e) => (e.status || 'posted') === 'posted';
const srcKey = (e) => (e.source && e.source.type && e.source.id) ? e.source.type + ':' + e.source.id : null;

/** يعيد بناء الأرصدة (بالهللات) من السطور: مدين موجب، دائن سالب. */
export function computeBalances(ledger, { upTo, from } = {}) {
  const bal = {}; const dr = {}; const cr = {};
  for (const e of ledger.entries || []) {
    if (!live(e)) continue;
    if (upTo && e.date > upTo) continue;
    if (from && e.date < from) continue;
    for (const l of e.lines || []) {
      const d = toH(l.dr).h, c = toH(l.cr).h;
      bal[l.acc] = (bal[l.acc] || 0) + d - c;
      dr[l.acc] = (dr[l.acc] || 0) + d; cr[l.acc] = (cr[l.acc] || 0) + c;
    }
  }
  return { bal, dr, cr };
}

/** ميزان مراجعة مستقل: لكل حساب رصيد مدين أو دائن، ومجموعان يجب أن يتساويا. */
export function trialBalance(ledger, opts) {
  const { bal } = computeBalances(ledger, opts);
  let tDr = 0, tCr = 0; const rows = [];
  for (const [acc, h] of Object.entries(bal).sort()) {
    rows.push({ acc, dr: h > 0 ? fromH(h) : 0, cr: h < 0 ? fromH(-h) : 0 });
    if (h > 0) tDr += h; else tCr -= h;
  }
  return { rows, totalDr: fromH(tDr), totalCr: fromH(tCr), balanced: tDr === tCr };
}

/** الفحص الرئيسي: يعيد {ok, findings, tb}. opts.reported و opts.expected اختياريان. */
export function validateLedger(ledger, opts = {}) {
  const F = [];
  const accIx = Object.fromEntries((ledger.accounts || []).map(a => [a.code, a]));
  const base = ledger.baseCurrency || 'SAR';
  const byId = {}; const seenSrc = {}; const reversedBy = {};

  for (const e of ledger.entries || []) {
    const ref = e.id;
    if (byId[e.id]) F.push(finding('posting.duplicate-id', SEV.CRITICAL, `رقم قيد مكرر ${e.id}`, ref));
    byId[e.id] = e;
    // تعدد المنشآت
    if (ledger.tenant && e.tenant && e.tenant !== ledger.tenant)
      F.push(finding('tenant.isolation', SEV.CRITICAL, `قيد لمنشأة أخرى (${e.tenant}) داخل دفتر ${ledger.tenant}`, ref));
    if (!['posted', 'draft', 'void', undefined].includes(e.status))
      F.push(finding('posting.status', SEV.HIGH, `حالة قيد غير معروفة: ${e.status}`, ref));
    if (!live(e)) continue;   // المسودة والملغى لا يدخلان الأرصدة — ولا تُفحص كقيود مرحّلة
    if (!isDate(e.date)) F.push(finding('posting.date', SEV.CRITICAL, `تاريخ غير صالح: ${e.date}`, ref));
    const lines = e.lines || [];
    if (lines.length < 2) F.push(finding('balance.min-lines', SEV.CRITICAL, 'القيد أقل من سطرين', ref));
    let sDr = 0, sCr = 0;
    const fx = e.currency && e.currency !== base;
    for (const l of lines) {
      const d = toH(l.dr), c = toH(l.cr);
      if (!d.exact || !c.exact) F.push(finding('rounding.precision', SEV.HIGH, `مبلغ بأكثر من خانتين عشريتين في ${l.acc}`, ref));
      if (d.h < 0 || c.h < 0) F.push(finding('balance.negative', SEV.CRITICAL, `مبلغ سالب في ${l.acc}`, ref));
      if (d.h > 0 && c.h > 0) F.push(finding('balance.both-sides', SEV.HIGH, `سطر مدين ودائن معًا في ${l.acc}`, ref));
      const a = accIx[l.acc];
      if (!a) F.push(finding('posting.account-missing', SEV.CRITICAL, `حساب غير موجود في الدليل: ${l.acc}`, ref));
      else {
        if (a.postable === false) F.push(finding('posting.non-postable', SEV.HIGH, `ترحيل على حساب رئيسي غير قابل للترحيل: ${l.acc}`, ref));
        if (a.tenant && ledger.tenant && a.tenant !== ledger.tenant) F.push(finding('tenant.isolation', SEV.CRITICAL, `حساب منشأة أخرى ${l.acc}`, ref));
      }
      if (fx) {
        // تعدد العملات: المبلغ بعملة الأساس = المبلغ الأجنبي × السعر، مقربًا لهللة
        if (!(Number(e.rate) > 0)) F.push(finding('fx.rate', SEV.CRITICAL, 'قيد بعملة أجنبية بلا سعر صرف', ref));
        else if (l.fc != null) {
          const want = Math.round(Number(l.fc) * Number(e.rate) * 100);
          const got = d.h || c.h;
          if (want !== got) F.push(finding('fx.conversion', SEV.HIGH, `تحويل خاطئ في ${l.acc}: ${fromH(got)} والمتوقع ${fromH(want)}`, ref));
        }
      }
      sDr += d.h; sCr += c.h;
    }
    if (sDr !== sCr) F.push(finding('balance.entry', SEV.CRITICAL, `قيد غير متوازن: مدين ${fromH(sDr)} ≠ دائن ${fromH(sCr)}`, ref));
    if (sDr === 0 && sCr === 0 && lines.length) F.push(finding('balance.zero', SEV.MEDIUM, 'قيد بمبالغ صفرية', ref));
    // الفترات المقفلة: قيد مؤرخ داخل فترة مقفلة ومُرحَّل بعد الإقفال
    if (ledger.lockedThru && e.date <= ledger.lockedThru && ledger.lockedAt && e.postedAt && e.postedAt > ledger.lockedAt)
      F.push(finding('period.locked', SEV.CRITICAL, `قيد في فترة مقفلة (${ledger.lockedThru}) رُحّل بعد الإقفال`, ref));
    // تكرار الترحيل لنفس المصدر (العكس لا يُعد تكرارًا)
    const k = srcKey(e);
    if (k && !e.reversalOf) {
      if (seenSrc[k]) F.push(finding('posting.duplicate-source', SEV.CRITICAL, `ترحيل مكرر للمصدر ${k} (${seenSrc[k]} و${e.id})`, ref));
      else seenSrc[k] = e.id;
    }
  }

  // سلامة العكس
  for (const e of ledger.entries || []) {
    if (!live(e) || !e.reversalOf) continue;
    const o = byId[e.reversalOf];
    if (!o || !live(o)) { F.push(finding('reversal.orphan', SEV.CRITICAL, `قيد عكسي لقيد غير موجود أو غير مرحّل: ${e.reversalOf}`, e.id)); continue; }
    if (reversedBy[o.id]) F.push(finding('reversal.double', SEV.CRITICAL, `القيد ${o.id} عُكس مرتين`, e.id));
    reversedBy[o.id] = e.id;
    if (e.date < o.date) F.push(finding('reversal.date', SEV.HIGH, 'تاريخ العكس قبل تاريخ القيد الأصلي', e.id));
    const sig = (ls, flip) => ls.map(l => `${l.acc}|${toH(flip ? l.cr : l.dr).h}|${toH(flip ? l.dr : l.cr).h}`).sort().join(';');
    if (sig(e.lines || [], false) !== sig(o.lines || [], true))
      F.push(finding('reversal.mirror', SEV.CRITICAL, `القيد العكسي لا يطابق ${o.id} بتبديل الجانبين`, e.id));
  }

  const tb = trialBalance(ledger);
  if (!tb.balanced) F.push(finding('tb.balanced', SEV.CRITICAL, `ميزان المراجعة غير متوازن: ${tb.totalDr} ≠ ${tb.totalCr}`));

  const R = opts.reported || {};
  const { bal } = computeBalances(ledger);
  // صحة أرصدة الحسابات المعلنة من النظام المختبَر
  if (R.balances) for (const [acc, v] of Object.entries(R.balances)) {
    const want = bal[acc] || 0, got = toH(v).h;
    if (want !== got) F.push(finding('balance.account', SEV.CRITICAL, `رصيد ${acc} المعلن ${fromH(got)} والمعاد حسابه ${fromH(want)}`));
  }
  // الأستاذ العام مقابل ميزان المراجعة المعلن
  if (R.tb) {
    for (const r of R.tb) {
      const want = bal[r.acc] || 0, got = toH(r.dr).h - toH(r.cr).h;
      if (want !== got) F.push(finding('gl-vs-tb', SEV.CRITICAL, `سطر الميزان ${r.acc} = ${fromH(got)} والأستاذ ${fromH(want)}`));
    }
    const listed = new Set(R.tb.map(r => r.acc));
    for (const [acc, h] of Object.entries(bal)) if (h !== 0 && !listed.has(acc)) F.push(finding('gl-vs-tb', SEV.CRITICAL, `حساب برصيد ${fromH(h)} غائب عن الميزان: ${acc}`));
  }
  // الأستاذ المساعد (عملاء/موردون) مقابل الحساب الإجمالي
  for (const a of ledger.accounts || []) {
    if (!a.control) continue;
    const parties = {};
    for (const e of ledger.entries || []) if (live(e)) for (const l of e.lines || []) if (l.acc === a.code) {
      if (!l.party) F.push(finding('subledger.party', SEV.HIGH, `سطر على حساب إجمالي ${a.code} بلا طرف`, e.id));
      parties[l.party || '?'] = (parties[l.party || '?'] || 0) + toH(l.dr).h - toH(l.cr).h;
    }
    const sum = Object.values(parties).reduce((s, x) => s + x, 0);
    if (sum !== (bal[a.code] || 0)) F.push(finding('subledger.control', SEV.CRITICAL, `Σالمساعد ≠ رصيد ${a.code}`));
    const rep = R.subledger && R.subledger[a.code];
    if (rep) for (const [p, v] of Object.entries(rep)) if ((parties[p] || 0) !== toH(v).h)
      F.push(finding('subledger.match', SEV.CRITICAL, `رصيد الطرف ${p} المعلن ${v} والمعاد حسابه ${fromH(parties[p] || 0)}`));
  }
  // القوائم المالية
  if (R.statements) F.push(...checkStatements(ledger, R.statements));
  // إقفال السنة: حسابات النتيجة صفرية بعد قيد الإقفال
  if (opts.closedYear) {
    const y = String(opts.closedYear);
    const { bal: yb } = computeBalances(ledger, { from: y + '-01-01', upTo: y + '-12-31' });
    for (const [acc, h] of Object.entries(yb)) {
      const k = accIx[acc] && accIx[acc].kind;
      if ((k === 'revenue' || k === 'expense') && h !== 0) F.push(finding('period.close', SEV.CRITICAL, `حساب النتيجة ${acc} غير مقفل في ${y}: ${fromH(h)}`));
    }
  }
  // القيود المتوقعة (يكشف القيد المتوازن الخاطئ)
  for (const x of opts.expected || []) {
    const got = (ledger.entries || []).filter(e => live(e) && !e.reversalOf && srcKey(e) === x.source.type + ':' + x.source.id);
    if (!got.length) { F.push(finding('expected.missing', SEV.CRITICAL, `لا قيد للمصدر ${x.source.type}:${x.source.id}`)); continue; }
    const net = (ls) => { const m = {}; for (const l of ls) m[l.acc] = (m[l.acc] || 0) + toH(l.dr).h - toH(l.cr).h; for (const k of Object.keys(m)) if (!m[k]) delete m[k]; return m; };
    const g = net(got.flatMap(e => e.lines)), w = net(x.lines);
    for (const acc of new Set([...Object.keys(g), ...Object.keys(w)]))
      if ((g[acc] || 0) !== (w[acc] || 0)) F.push(finding('expected.entry', SEV.CRITICAL, `المصدر ${x.source.id}: الحساب ${acc} = ${fromH(g[acc] || 0)} والمتوقع ${fromH(w[acc] || 0)}`));
  }
  return { ok: !F.some(f => f.severity === SEV.CRITICAL || f.severity === SEV.HIGH), findings: F, tb };
}

/** القوائم: الإيراد والمصروف وصافي الربح، والأصول = الالتزامات + حقوق الملكية + صافي الربح */
export function checkStatements(ledger, st) {
  const F = []; const { bal } = computeBalances(ledger);
  const sum = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 };
  for (const a of ledger.accounts || []) if (KINDS.includes(a.kind)) sum[a.kind] += (bal[a.code] || 0) * (DEBIT_NATURE.has(a.kind) ? 1 : -1);
  const ni = sum.revenue - sum.expense;
  const cmp = (k, want) => { if (st[k] != null && toH(st[k]).h !== want) F.push(finding('statements.' + k, SEV.CRITICAL, `${k} المعلن ${st[k]} والمعاد حسابه ${fromH(want)}`)); };
  cmp('revenue', sum.revenue); cmp('expenses', sum.expense); cmp('netIncome', ni);
  cmp('assets', sum.asset); cmp('liabilities', sum.liability); cmp('equity', sum.equity);
  if (sum.asset !== sum.liability + sum.equity + ni) F.push(finding('statements.equation', SEV.CRITICAL, 'الأصول ≠ الالتزامات + حقوق الملكية + صافي الربح'));
  return F;
}

/** التسوية البنكية: الرصيدان المعدّلان يجب أن يتساويا */
export function checkBankRec(r) {
  const s = toH(r.statementBalance).h + toH(r.depositsInTransit).h - toH(r.outstanding).h + toH(r.bankErrors).h;
  const b = toH(r.bookBalance).h - toH(r.unrecordedCharges).h + toH(r.unrecordedCredits).h + toH(r.bookErrors).h;
  const F = s === b ? [] : [finding('bank.reconcile', SEV.CRITICAL, `الرصيد المعدّل حسب البنك ${fromH(s)} ≠ حسب الدفاتر ${fromH(b)}`)];
  if (r.reportedAdjusted != null && toH(r.reportedAdjusted).h !== s) F.push(finding('bank.reported', SEV.CRITICAL, `الرصيد المعدّل المعلن ${r.reportedAdjusted} والصحيح ${fromH(s)}`));
  return F;
}

/** الإهلاك بالقسط الثابت شهريًا — حساب مستقل */
export function straightLineAccum({ cost, salvage = 0, lifeMonths, startDate, asOf }) {
  const [y1, m1] = startDate.split('-').map(Number); const [y2, m2] = asOf.split('-').map(Number);
  const months = Math.max(0, Math.min(lifeMonths, (y2 - y1) * 12 + (m2 - m1) + 1));
  const base = toH(cost).h - toH(salvage).h;
  // كل الأشهر بالتقريب ما عدا الأخير يغلق الفرق — المجموع لا يتجاوز الأساس
  const per = Math.round(base / lifeMonths);
  return fromH(months === lifeMonths ? base : per * months);
}
export function checkDepreciation(a) {
  const want = straightLineAccum(a);
  return toH(a.reportedAccum).h === toH(want).h ? [] : [finding('depreciation', SEV.CRITICAL, `مجمع الإهلاك المعلن ${a.reportedAccum} والصحيح ${want}`)];
}

/** المتوسط المرجّح للمخزون — حساب مستقل بالهللات */
export function weightedAverage(moves) {
  let qty = 0, val = 0;   // val بالهللات
  for (const m of moves) {
    if (m.qty > 0 && m.kind !== 'out') { val += Math.round(m.qty * m.unitCost * 100); qty += m.qty; }
    else { const q = Math.abs(m.qty); if (q > qty + 1e-9) return { error: 'رصيد سالب' }; const avg = qty ? val / qty : 0; val -= Math.round(q * avg); qty -= q; }
  }
  return { qty: Math.round(qty * 1000) / 1000, value: fromH(val), avg: qty ? Math.round(val / qty) / 100 : 0 };
}
export function checkInventory(moves, reported) {
  const w = weightedAverage(moves);
  if (w.error) return [finding('inventory.negative', SEV.CRITICAL, w.error)];
  const F = [];
  if (reported.qty != null && Math.abs(reported.qty - w.qty) > 1e-6) F.push(finding('inventory.qty', SEV.CRITICAL, `الكمية ${reported.qty} والصحيحة ${w.qty}`));
  if (reported.value != null && toH(reported.value).h !== toH(w.value).h) F.push(finding('inventory.value', SEV.CRITICAL, `القيمة ${reported.value} والصحيحة ${w.value}`));
  return F;
}

/** مطابقة مصدر البيانات مع التقرير: مجموع السجلات المصدرية = رقم التقرير */
export function checkSourceVsReport(records, field, reportedTotal, label = 'التقرير') {
  const s = records.reduce((t, r) => t + toH(r[field]).h, 0);
  return s === toH(reportedTotal).h ? [] : [finding('source-vs-report', SEV.CRITICAL, `${label}: المجموع المعلن ${reportedTotal} ومجموع المصدر ${fromH(s)}`)];
}
