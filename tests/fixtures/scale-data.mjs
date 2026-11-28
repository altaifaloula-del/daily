/* المرحلة H (v56.59) — مولّد بيانات اصطناعية بحجم منشأة كبيرة لاختبارات الأداء.
   كل الأسماء والأرقام وهمية ومولَّدة حتميًا (لا عشوائية): نفس المدخل ⇒ نفس البيانات في كل تشغيل.
   الحجم الافتراضي: 20 فرعًا × 365 يومًا من الإغلاقات، 200 ألف فاتورة نقطة بيع، 50 ألف فاتورة مورد/مصروف،
   5 آلاف أصل ثابت، 500 موظف برواتب 12 شهرًا، 1,000 عميل آجل بـ 5 آلاف فاتورة مبيعات. */
const r2 = (x) => Math.round(x * 100) / 100;

export function scaleData(o = {}) {
  const NB = o.branches ?? 20, DAYS = o.days ?? 365, NO = o.orders ?? 200000, NI = o.invoices ?? 50000, NA = o.assets ?? 5000, NE = o.employees ?? 500;
  const NS = o.suppliers ?? 300, NC = o.customers ?? 1000, NSI = o.salesInvoices ?? 5000;
  const END = Date.parse((o.end || '2025-12-31') + 'T12:00:00Z');
  const day = (k) => new Date(END - k * 864e5).toISOString().slice(0, 10);   // k = 0 ⇒ آخر يوم
  const branches = Array.from({ length: NB }, (_, i) => ({ id: 'b' + i, name: 'فرع تجريبي ' + (i + 1), isActive: true, ...(i % 2 ? { bankName: 'بنك تجريبي', bankIban: 'SA0000000000000000000' + String(i).padStart(3, '0') } : {}) }));
  const suppliers = Array.from({ length: NS }, (_, i) => ({ id: 's' + i, name: 'مورد تجريبي ' + i, taxable: true }));
  const partners = Array.from({ length: NC }, (_, i) => ({ id: 'c' + i, type: 'customer', name: 'عميل تجريبي ' + i, terms: 30 }));
  const employees = Array.from({ length: NE }, (_, i) => ({ id: 'e' + i, name: 'موظف ' + i, branchId: 'b' + (i % NB), baseSalary: 4000 + (i % 7) * 500, housingAllowance: 1000, transportAllowance: 300,
    nationality: i % 3 ? 'other' : 'saudi', gosiSubject: true, hireDate: '2020-01-01' }));
  const assets = Array.from({ length: NA }, (_, i) => ({ id: 'a' + i, name: 'أصل ' + i, cost: 1000 + (i % 50) * 100, lifeYears: 3 + (i % 5), buyDate: day(30 + (i % (DAYS - 30 > 0 ? DAYS - 30 : 1))), fund: '1201', branchId: 'b' + (i % NB) }));
  const products = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i, name: 'صنف ' + i, sellPrice: 10 + i }));
  // فواتير نقطة البيع موزعة على كل (فرع، يوم) بالتساوي تقريبًا؛ الإغلاق يساوي مجموع فواتير يومه (فيطابق posGl)
  const posOrders = []; const dayTot = new Map();
  for (let i = 0; i < NO; i++) {
    const slot = i % (NB * DAYS), b = 'b' + (slot % NB), d = day(Math.floor(slot / NB));
    const p = products[i % 60], qty = 1 + (i % 3), total = r2(p.sellPrice * qty), vat = r2(total * 15 / 115), voided = i % 211 === 0;
    const card = i % 2 === 1;
    posOrders.push({ id: 'po' + i.toString(36), no: 'ف-' + i, branchId: b, dev: 'A', date: d, at: d + 'T12:00:00.000Z', status: voided ? 'void' : 'paid', rate: 15,
      lines: [{ productId: p.id, name: p.name, qty, price: p.sellPrice }], gross: total, disc: 0, manualDisc: 0, total, vat, net: total, payments: [{ m: card ? 'card' : 'cash', amount: total }], change: 0,
      ...(i % 5 === 0 ? { loyalty: { phone: '5' + String(10000000 + (i % 4000)), earned: 2, redeemed: 0, redeemAmt: 0, pv: 0.1 } } : {}) });
    if (!voided) { const k = b + '|' + d; const t = dayTot.get(k) || { cash: 0, card: 0 }; t[card ? 'card' : 'cash'] = r2(t[card ? 'card' : 'cash'] + total); dayTot.set(k, t); }
  }
  const closings = [];
  for (let k = 0; k < DAYS; k++) for (const br of branches) {
    const d = day(k), t = dayTot.get(br.id + '|' + d) || { cash: 0, card: 0 }, exp = 50;
    closings.push({ id: 'cl_' + br.id + '_' + k, branchId: br.id, branchName: br.name, date: d, status: 'approved', totalRevenue: r2(t.cash + t.card), cashSales: t.cash, cardSales: t.card, bankTransferSales: 0,
      deliverySales: [], totalDeliverySales: 0, expenses: [{ categoryName: 'صيانة', amount: exp, paymentMethod: 'cash' }], totalExpenses: exp, variance: 0, actualCashCount: r2(t.cash - exp), expectedCashInSafe: r2(t.cash - exp),
      transferredToMainTreasury: 0, supplierPayments: [] });
  }
  const invoices = Array.from({ length: NI }, (_, i) => { const d = day(i % DAYS), amt = r2(115 * (1 + (i % 40)));
    return { id: 'inv' + i, supplierId: 's' + (i % NS), supplierName: 'مورد تجريبي ' + (i % NS), invoiceNo: 'INV-' + i, amount: amt, vatAmt: r2(amt * 15 / 115), taxable: true, date: d, dueDate: day(Math.max(0, (i % DAYS) - 30)),
      paidAmount: i % 3 ? amt : 0, ...(i % 3 ? { paidDate: d, payFund: '1201' } : {}), branchId: 'b' + (i % NB), category: i % 2 ? 'مواد خام' : 'خدمات' }; });
  const salesInvoices = Array.from({ length: NSI }, (_, i) => { const d = day(i % DAYS), tot = r2(1150 + (i % 9) * 115);
    return { id: 'si' + i, no: 'INV-S-' + i, kind: 'invoice', terms: 'credit', customerKey: 'cust:c' + (i % NC), date: d, dueDate: day(Math.max(0, (i % DAYS) - 30)), total: tot, vat: r2(tot * 15 / 115),
      receipts: i % 2 ? [{ date: d, amount: tot }] : [] }; });
  const ledgerEntries = []; const advances = [];
  const months = [...new Set(closings.map(c => c.date.slice(0, 7)))].sort();
  months.forEach((m, j) => {
    const gross = r2(employees.reduce((a, e) => a + e.baseSalary + e.housingAllowance + e.transportAllowance, 0));
    ledgerEntries.push({ id: 'acc_' + m, kind: 'salary_accrual', month: m, date: m + '-28', credit: gross },
      { id: 'pay_' + m, kind: 'salary_payout', month: m, date: m + '-28', debit: r2(gross * 0.9), gosi: r2(gross * 0.1), gosiEr: r2(gross * 0.12), fund: '1201' });
    if (j % 3 === 0) employees.slice(0, 50).forEach((e, k) => advances.push({ id: 'ad_' + m + '_' + k, employeeId: e.id, employeeName: e.name, branchId: e.branchId, month: m, date: m + '-10', type: 'advance', amount: 500, paymentMethod: 'bank' }));
  });
  const org = { company: { name: 'منشأة اختبار الأداء' }, branches, suppliers, partners, employees, assets, products, taxCfg: { enabled: true, rate: 15 }, gosiCfg: { enabled: true } };
  const ops = { closings, posOrders, invoices, salesInvoices, ledgerEntries, advances, journalManual: [] };
  return { org, ops, months, first: day(DAYS - 1), last: day(0), day };
}
