/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Truck, FileBarChart, ChevronDown, Printer, FileText, Building2, ClipboardCheck, Users, Plus, AlertTriangle, CalendarDays, Trash2, Check, X, Banknote } from 'lucide-react';
import { DupInvHint, Field, Kpi, LOCK_MSG, MAIN_WH, Modal, Num, ROLES, SectionNav, arDate, branchBanks, closingInvoices, isStocked, isoD, itemType, money, nowISO, pFactor, payTotal, periodLocked, printA4, purKey, q3, roleEdit, roleHasTab, stockByWh, sum, supplierPrices, today, uid, whName, whOf, whOn, signoff, signDecision, sigFailMsg } from '../../App.jsx';

export function Suppliers({ org, ops, me, myBranches, commit, commitOrg, say, setTab: goTab }) {
  const [tab, setTab] = useState('inv');
  const [repOpen, setRepOpen] = useState(false);    // v9.4 قائمة تقارير التطبيق
  const [pay, setPay] = useState(null);
  const [amt, setAmt] = useState(0);
  const [payFund, setPayFund] = useState('1201');   // v15.19: مصدر السداد — بنك (افتراضي) أو خزينة رئيسية
  const [newInv, setNewInv] = useState(null);        // نموذج فاتورة توريد (م4)
  const [poF, setPoF] = useState(null);              // نموذج أمر شراء
  const [recv, setRecv] = useState(null);            // نموذج استلام أمر
  const [showPrices, setShowPrices] = useState(false);
  const [ret, setRet] = useState(null);              // v30.9 مرتجع لمورد
  const ids = myBranches.map(b => b.id);
  // v28.2: فواتير المركز (بلا فرع، ومنها المستوردة من ميزان) تظهر للأدوار المركزية
  const invoices = (ops.invoices || []).filter(i => ids.includes(i.branchId) || (!i.branchId && ROLES[me.role]?.scope !== 'own'))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const fixed = (ops.fixedExpenses || []).filter(f => ids.includes(f.branchId));
  const suppliers = org.suppliers || [];
  const canPay = ROLES[me.role]?.scope !== 'own';

  // سدادات الفروع المرتبطة بالفواتير (من الإغلاقات المرحّلة/المعتمدة) — تُحتسب دون تعديل الفاتورة فلا ازدواج
  const branchPaid = (invId) => sum(
    (ops.closings || []).filter(c => c.status === 'submitted' || c.status === 'approved')
      .flatMap(c => (c.supplierPayments || []).filter(pm => pm.invoiceId === invId)), payTotal);
  // v28.2: سدادات مركزية مخصّصة على الفاتورة (alloc) — من دمج ميزان
  const allocPaid = useMemo(() => { const m = {}; (ops.closingInvPays || []).forEach(x => (x.alloc || []).forEach(([id, v]) => { m[id] = (m[id] || 0) + (Number(v) || 0); })); return m; }, [ops.closingInvPays]);
  const invPaid = (i) => (i.paidAmount || 0) + branchPaid(i.id) + (allocPaid[i.id] || 0);
  const cnOf = (i) => sum((ops.invoices || []).filter(x => x.creditNote && x.appliesTo === i.id), x => -(x.amount || 0));   // v30.9 مرتجعات مطبّقة على الفاتورة
  const invRem = (i) => (i.amount < 0 ? 0 : Math.max(0, Math.round((i.amount - invPaid(i) - cnOf(i)) * 100) / 100));   // v28.2: الإشعار الدائن لا يُعد فاتورة مفتوحة

  // v8.1: الفواتير المشتقة من الورديات (الآجلة المربوطة بموردين) + سداداتها المركزية
  const clInvs = closingInvoices(org, ops).filter(v => ids.includes(v.branchId));
  const cPaid = (refId) => sum((ops.closingInvPays || []).filter(x => x.refId === refId), x => x.amount);
  const cRem = (v) => Math.max(0, v.amount - cPaid(v.id));
  const allInvs = [
    ...invoices.map(i => ({ ...i, source: 'stored' })),
    ...clInvs
  ].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const remOf = (x) => x.source === 'closing' ? cRem(x) : invRem(x);
  const paidOf = (x) => x.source === 'closing' ? cPaid(x.id) : invPaid(x);

  const outstanding = sum(invoices, invRem) + sum(clInvs, cRem);
  const overdue = allInvs.filter(i => remOf(i) > 0 && i.dueDate < today());

  // v29.7: بحث في الفواتير (آلاف الفواتير المستوردة كانت تُعرض كلها دفعة واحدة بلا بحث)
  const [invQ, setInvQ] = useState('');
  const INV_CAP = 300;
  const invShown = (() => {
    const q = invQ.trim().toLowerCase();
    const list = q ? allInvs.filter(i => (String(i.invoiceNo || '') + ' ' + (i.supplierName || '') + ' ' + (i.mizanId || '')).toLowerCase().includes(q)) : allInvs;
    return { list: list.slice(0, INV_CAP), total: list.length };
  })();

  // v29.7: حذف فاتورة مورد مفردة (مكررة أو مستوردة خطأً) — كان الحذف متاحًا فقط لدفعة استيراد كاملة.
  // ضوابط: صلاحية التعديل، لا سداد مسجّل عليها من المنصة، ليست في شهر مقفل، تأكيد بكتابة رقمها، وسجل تدقيق بنسخة منها.
  // السدادات البنكية الموزّعة عليها (alloc) تنتقل لتوأمها (نفس المورد والتاريخ والمبلغ) إن وُجد، وإلا تبقى على المورد غير موزّعة.
  const canDelInv = roleEdit(me.role);
  const delInv = async (inv) => {
    if (!canDelInv) return say('حذف الفواتير لمن يملك صلاحية التعديل فقط', 'no');
    if ((inv.paidAmount || 0) > 0 || branchPaid(inv.id) > 0) return say('على الفاتورة سداد مسجّل من المنصة — لا تُحذف. صحّحها بإشعار دائن أو قيد يدوي', 'no');
    const d0 = (inv.date || inv.createdAt || inv.dueDate || '').slice(0, 10);
    if (periodLocked(org, d0)) return say(LOCK_MSG(d0), 'no');
    const twin = invoices.find(x => x.id !== inv.id && x.supplierId === inv.supplierId && (x.date || '').slice(0, 10) === d0 && Math.abs((x.amount || 0) - (inv.amount || 0)) < 0.005);
    const typed = window.prompt('حذف فاتورة ' + (inv.invoiceNo || '') + ' — ' + (inv.supplierName || '') + ' بمبلغ ' + money(inv.amount) + ' بتاريخ ' + d0
      + (twin ? '\nتوأمها المطابق: ' + (twin.invoiceNo || '') + ' (تنتقل إليه السدادات الموزّعة على هذه)' : '\nلا توجد فاتورة مطابقة لنفس المورد والتاريخ والمبلغ')
      + '\n\nللتأكيد اكتب رقم الفاتورة: ' + (inv.invoiceNo || ''));
    if ((typed || '').trim() !== String(inv.invoiceNo || '').trim()) return say('أُلغي الحذف — لم يتغير شيء', 'no');
    const snapshot = JSON.stringify({ id: inv.id, invoiceNo: inv.invoiceNo, supplierName: inv.supplierName, amount: inv.amount, vatAmt: inv.vatAmt, date: d0, mizanId: inv.mizanId || '', mizanBatch: inv.mizanBatch || '' });
    const ok = await commit(d => ({
      ...d,
      invoices: (d.invoices || []).filter(x => x.id !== inv.id),
      closingInvPays: (d.closingInvPays || []).map(p => Array.isArray(p.alloc) && p.alloc.some(([id]) => id === inv.id)
        ? { ...p, alloc: twin ? p.alloc.map(([id, v]) => [id === inv.id ? twin.id : id, v]) : p.alloc.filter(([id]) => id !== inv.id) }
        : p)
    }), { actionType: 'delete', targetType: 'expense', targetId: inv.id, need: 'edit', branchName: inv.branchName || '',
      title: 'حذف فاتورة مورد', details: snapshot });
    if (ok) say('حُذفت الفاتورة ' + (inv.invoiceNo || '') + (twin ? ' ونُقلت سداداتها الموزّعة إلى ' + (twin.invoiceNo || '') : '') + ' ✓');
  };

  // ===== م4: أوامر الشراء والفواتير =====
  const pos = (ops.purchaseOrders || []).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  // v30.5 — إعدادات المشتريات + الاعتماد + أسعار الموردين
  const pcfg = org.purchaseCfg || {};
  const apprLimit = Number(pcfg.approvalLimit) || 0;
  const alertPct = pcfg.priceAlertPct != null ? Number(pcfg.priceAlertPct) || 0 : 5;   // v37.6: الافتراضي 5% عن متوسط آخر 3 مشتريات
  const canApprovePo = !!(ROLES[me.role]?.approver || ROLES[me.role]?.admin);
  const canCfg = roleEdit(me.role);
  const [cfgF, setCfgF] = useState(null);
  const PRICES = useMemo(() => supplierPrices(ops), [ops]);
  const lastPriceOf = (itemId) => (PRICES[itemId] || [])[0] || null;
  // v37.7 — مرجع التنبيه: متوسط تكلفة الوحدة في آخر 3 مشتريات للصنف (أي مورد) — لا آخر سعر وحده
  const avg3Of = (itemId) => { const a = (PRICES[itemId] || []).slice(0, 3); return a.length ? { avg: Math.round(sum(a, r => r.unitCost) / a.length * 10000) / 10000, n: a.length } : null; };
  const priceWarn = (l) => { const it = items.find(x => x.id === l.itemId); const lp = lastPriceOf(l.itemId); const a3 = avg3Of(l.itemId); if (!it || !lp || !a3 || !(a3.avg > 0) || !(Number(l.price) > 0)) return null;
    const u = (Number(l.price) || 0) / (l.uom === 'p' ? pFactor(it) : 1); const pct = (u - a3.avg) / a3.avg * 100;
    return { u, lp, avg: a3.avg, n: a3.n, pct: Math.round(pct * 10) / 10, high: alertPct > 0 && pct > alertPct }; };
  const saveCfg = async () => {
    const f = cfgF;
    const next = { approvalLimit: Math.max(0, Number(f.approvalLimit) || 0), priceAlertPct: Math.max(0, Number(f.priceAlertPct) || 0), perpetualFrom: f.perpetual ? (f.perpetualFrom || today().slice(0, 7)) : '' };
    const ok = await commitOrg(d => ({ ...d, purchaseCfg: { ...(d.purchaseCfg || {}), ...next } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'purchaseCfg', need: 'edit', title: 'إعدادات المشتريات والمخزون',
      details: 'حد الاعتماد ' + money(next.approvalLimit) + ' · تنبيه السعر ' + next.priceAlertPct + '% · الجرد المستمر ' + (next.perpetualFrom || 'موقوف') });
    if (ok) { setCfgF(null); say('حُفظت الإعدادات ✓'); }
  };
  const decidePo = async (p2, approve) => {
    if (approve && p2.priceAlert && p2.by === me.name && !ROLES[me.role]?.admin) return say('أمر بتنبيه سعر — يعتمده شخص غير منشئه', 'no');
    const note = approve ? '' : window.prompt('سبب رفض أمر الشراء ' + p2.poNo + ':'); if (!approve && note === null) return;
    const sg = await signDecision('po', approve ? 'approve' : 'reject', p2, { branchId: '' });   // v40.0 توقيع موثّق
    if (!sg.ok) return say(sigFailMsg(sg, approve ? 'اعتماد أمر الشراء' : 'رفض أمر الشراء'), 'no');
    await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id && x.status === 'pending' ? { ...x, ...(sg.id ? { sigDecide: sg.id } : {}), status: approve ? 'open' : 'rejected', decidedBy: me.name, decidedAt: nowISO(), ...(note ? { rejectNote: note } : {}) } : x) }),
      { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: (approve ? 'اعتمد' : 'رفض') + ' أمر شراء', details: p2.poNo + ' · ' + money(poTotal(p2)) + (note ? ' · ' + note : '') });
    say(approve ? 'اعتُمد أمر الشراء ✓' : 'رُفض أمر الشراء');
  };
  const items = org.items || [];
  const poTotal = (p2) => sum(p2.lines || [], l => (Number(l.qty) || 0) * (Number(l.price) || 0));
  const poRecvQty = (p2) => sum(p2.lines || [], l => Number(l.received) || 0);
  const poAllRecv = (p2) => (p2.lines || []).every(l => (Number(l.received) || 0) >= (Number(l.qty) || 0));
  const nextPoNo = () => {
    let mx = 0;
    (ops.purchaseOrders || []).forEach(x => { const m2 = /(\d+)$/.exec(x.poNo || ''); if (m2) mx = Math.max(mx, +m2[1]); });
    return 'PO-' + String(mx + 1).padStart(4, '0');
  };

  const saveInv = async () => {
    const f = newInv;
    const sp = (org.suppliers || []).find(x => x.id === f.supplierId);
    if (!sp) return say('اختر المورد', 'no');
    const v = Number(f.amount) || 0;
    if (v <= 0) return say('أدخل مبلغ الفاتورة', 'no');
    if (periodLocked(org, f.date || today())) return say(LOCK_MSG(f.date || today()), 'no');
    const br = org.branches.find(b => b.id === f.branchId);
    // v33.2: الرقم الآلي لا يتكرر حتى بعد حذف فواتير؛ ورقم المورد المكرر يُرفض قبل الحفظ
    const autoNo = () => { const pre = 'INV-' + today().replace(/-/g, '').slice(2) + '-'; let k = (ops.invoices || []).length + 1;
      while ((ops.invoices || []).some(i => i.invoiceNo === pre + String(k).padStart(3, '0'))) k++; return pre + String(k).padStart(3, '0'); };
    const typedNo = (f.invoiceNo || '').trim();
    if (typedNo) { const k0 = purKey({ supplierId: sp.id, invoiceNo: typedNo }); const o = (ops.invoices || []).find(i => purKey(i) === k0);
      if (o) return say('فاتورة مكررة: رقم ' + typedNo + ' للمورد «' + sp.name + '» مسجّل بتاريخ ' + (o.date || '') + ' بمبلغ ' + money(o.amount) + ' — لم يُحفظ', 'no'); }
    const twin = (ops.invoices || []).find(i => !i.creditNote && i.supplierId === sp.id && (i.date || '') === (f.date || today()) && Math.abs((i.amount || 0) - v) < 0.01);
    if (twin && !window.confirm('تنبيه: يوجد فاتورة للمورد نفسه بنفس التاريخ والمبلغ (' + money(v) + ') برقم ' + (twin.invoiceNo || '') + '.\nهل هذه فاتورة مختلفة فعلًا؟')) return;
    const rec = {
      id: uid('inv'), supplierId: sp.id, supplierName: sp.name,
      branchId: f.branchId || '', branchName: br ? br.name : 'المركز الرئيسي',
      invoiceNo: typedNo || autoNo(),
      amount: v, paidAmount: 0, taxable: !!f.taxable,
      date: f.date || today(), dueDate: f.dueDate || today(), poId: f.poId || undefined, createdAt: nowISO()
    };
    await commit(d => ({ ...d, invoices: [rec, ...(d.invoices || [])],
      purchaseOrders: f.poId ? (d.purchaseOrders || []).map(x => x.id === f.poId ? { ...x, invoiceId: rec.id } : x) : (d.purchaseOrders || []) }), {
      actionType: 'create', targetType: 'expense', targetId: rec.id, branchName: rec.branchName,
      title: 'سجّل فاتورة توريد آجلة', details: sp.name + ' · ' + rec.invoiceNo + ' · ' + money(v) + (rec.taxable ? ' · خاضعة للضريبة' : '')
    });
    setNewInv(null); say('سُجّلت الفاتورة وأنشئ قيدها المحاسبي تلقائياً ✓');
  };

  const savePo = async () => {
    const f = poF;
    const sp = (org.suppliers || []).find(x => x.id === f.supplierId);
    if (!sp) return say('اختر المورد', 'no');
    const lines = (f.lines || []).filter(l => (l.desc || '').trim() && Number(l.qty) > 0)
      .map(l => { const it = items.find(x => x.id === l.itemId); const fac = it && l.uom === 'p' ? pFactor(it) : 1;
        const w = priceWarn(l);
        return { desc: l.desc.trim(), itemId: l.itemId || '', qty: Number(l.qty), price: Number(l.price) || 0, received: 0, ...(fac > 1 ? { factor: fac, uomName: it.purchaseUnit } : {}),
          ...(w && w.high ? { pAlert: { avg3: w.avg, n: w.n, unit: Math.round(w.u * 10000) / 10000, pct: w.pct } } : {}) }; });
    if (!lines.length) return say('أضف بنداً واحداً على الأقل (وصف وكمية)', 'no');
    const tot0 = lines.reduce((s2, l) => s2 + l.qty * l.price, 0);
    const hiPrice = lines.filter(l => l.pAlert).length;
    // v37.7: بند بسعر أعلى من متوسط آخر 3 مشتريات بأكثر من الحد ⇒ الأمر يحتاج اعتمادًا ولو كان تحت حد القيمة
    const needAppr = (apprLimit > 0 && tot0 > apprLimit) || hiPrice > 0;
    let rec = { id: uid('po'), poNo: nextPoNo(), supplierId: sp.id, supplierName: sp.name,
      branchId: f.branchId || '', note: f.note || '', lines, status: needAppr ? 'pending' : 'open', by: me.name, at: nowISO(), date: today(), ...(hiPrice ? { priceAlert: hiPrice } : {}) };
    // v40.0: أمر بانتظار الاعتماد يُوقَّع تقديمه — مع تنبيه السعر لا يعتمده منشئه (إلا المدير)، والقواعد تفرض ذلك
    if (needAppr) { const sg = await signoff('po', 'submit', rec, { branchId: '', alert: hiPrice > 0 }); if (!sg.ok) return say(sigFailMsg(sg, 'أمر الشراء'), 'no'); if (sg.id) rec = { ...rec, sigSubmit: sg.id }; }
    await commit(d => ({ ...d, purchaseOrders: [rec, ...(d.purchaseOrders || [])] }), {
      actionType: 'create', targetType: 'purchase_order', targetId: rec.id,
      title: 'أنشأ أمر شراء', details: rec.poNo + ' · ' + sp.name + ' · ' + money(poTotal(rec))
    });
    setPoF(null); say('أُنشئ أمر الشراء ' + rec.poNo + (needAppr ? ' — بانتظار الاعتماد (' + (hiPrice ? hiPrice + ' بند بسعر أعلى من متوسط آخر 3 مشتريات بأكثر من ' + alertPct + '%' : 'يتجاوز ' + money(apprLimit)) + ')' : '') + ' ✓');
  };

  // v8.2: طباعة أمر شراء كوثيقة تُرسل للمورد
  const printPO = (p2) => {
    const rows = (p2.lines || []).map((l, i) => `<tr><td class="n">${i + 1}</td><td>${l.desc}</td><td class="n">${l.qty}</td><td class="n">${money(l.price)}</td><td class="n">${money((l.qty || 0) * (l.price || 0))}</td></tr>`).join('');
    printA4(org, 'أمر شراء ' + p2.poNo, arDate(p2.date || today()) + (p2.branchId ? ' · ' + ((org.branches.find(b => b.id === p2.branchId) || {}).name || '') : ' · المركز الرئيسي'),
      `<div class="box"><b>المورد:</b> ${p2.supplierName} ${p2.note ? '· ' + p2.note : ''}<br><b>أعده:</b> ${p2.by || ''}</div>
      <table><thead><tr><th>#</th><th>البيان</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="4">قيمة الأمر</td><td class="n">${money(poTotal(p2))}</td></tr></tbody></table>
      <div class="sign"><div>إعداد</div><div>اعتماد الإدارة</div><div>استلام المورد</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printInvs = () => {
    const open2 = allInvs.filter(i => remOf(i) > 0);
    const rows = open2.map(i => `<tr><td>${i.invoiceNo}${i.source === 'closing' ? ' (من وردية)' : ''}</td><td>${i.supplierName}</td><td>${i.branchName || ''}</td><td class="n">${i.dueDate || ''}</td><td class="n">${money(i.amount)}</td><td class="n">${money(paidOf(i))}</td><td class="n">${money(remOf(i))}</td></tr>`).join('');
    printA4(org, 'الفواتير المفتوحة وأعمار الديون', arDate(today()) + ' · ' + open2.length + ' فاتورة',
      `<table><thead><tr><th>الفاتورة</th><th>المورد</th><th>الفرع</th><th>الاستحقاق</th><th>القيمة</th><th>المسدد</th><th>المتبقي</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="6">إجمالي المستحق</td><td class="n">${money(sum(open2, remOf))}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  const saveRecv = async () => {
    const f = recv; const p2 = f.po;
    if (p2.status === 'pending' || p2.status === 'rejected') return say('أمر الشراء غير معتمد — لا يُستلم قبل الاعتماد', 'no');
    const wid = whOn(org) ? (f.whId || MAIN_WH) : '';
    const tw = wid ? whOf(org).find(w => w.id === wid) : null;
    const rDate = (f.date || today()).slice(0, 10);
    if (periodLocked(org, rDate)) return say(LOCK_MSG(rDate), 'no');
    const takes = p2.lines.map((l, i) => Math.min(Math.max(Number(f.qtys[i]) || 0, 0), (l.qty || 0) - (l.received || 0)));
    if (!takes.some(q => q > 0)) return say('أدخل كمية مستلمة لبند واحد على الأقل', 'no');
    // v30.4: الكمية بوحدة الشراء تُحوَّل للأساسية، وسعر البند يصبح تكلفة الوحدة الأساسية فيُحدّث المتوسط المرجّح. الخدمي لا يُخزَّن.
    // v30.5: الاستلام يُنشئ فاتورة المورد تلقائيًا (أسعار أمر الشراء قبل الضريبة) ويُدخل الأصناف المخزنية مستودعًا مختارًا بدفعتها وصلاحيتها
    const invId = uid('inv'), grn = 'GRN-' + rDate.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const moves = p2.lines.map((l, i) => { const it = items.find(x => x.id === l.itemId); const fac = Number(l.factor) || 1;
      return (takes[i] > 0 && l.itemId && (!it || isStocked(it))) ? {
        id: uid('sm'), date: rDate, itemId: l.itemId, kind: 'purchase', qty: Math.round(takes[i] * fac * 1000) / 1000,
        unitCost: Math.round((Number(l.price) || 0) / fac * 10000) / 10000,
        note: 'استلام ' + p2.poNo + ' — ' + l.desc + (fac > 1 ? ' (' + takes[i] + ' ' + (l.uomName || '') + ')' : ''), ref: p2.poNo, by: me.name, at: nowISO(),
        invoiceId: invId, grn, ...((f.batch || [])[i] ? { batch: f.batch[i] } : {}), ...((f.expiry || [])[i] ? { expiry: f.expiry[i] } : {}),
        ...(wid ? { whId: wid } : {}), ...(tw && tw.kind === 'branch' ? { branchId: tw.branchId } : {})
      } : null; }).filter(Boolean);
    const invLines = p2.lines.map((l, i) => { if (!(takes[i] > 0)) return null; const it = items.find(x => x.id === l.itemId); const fac = Number(l.factor) || 1;
      return { itemId: l.itemId || '', desc: l.desc, qty: Math.round(takes[i] * fac * 1000) / 1000, unitCost: Math.round((Number(l.price) || 0) / fac * 10000) / 10000,
        net: Math.round(takes[i] * (Number(l.price) || 0) * 100) / 100, stock: !!(l.itemId && it && isStocked(it)) }; }).filter(Boolean);
    const invNet = Math.round(invLines.reduce((s2, l) => s2 + l.net, 0) * 100) / 100;
    const taxOn = !!(org.taxCfg || {}).enabled && f.taxable !== false;
    const vat = taxOn ? Math.round(invNet * ((Number((org.taxCfg || {}).rate) || 15) / 100) * 100) / 100 : 0;
    const sp0 = suppliers.find(x => x.id === p2.supplierId) || {};
    const due = (() => { const dd = new Date(rDate + 'T12:00:00'); dd.setDate(dd.getDate() + (Number(sp0.terms) || 0)); return isoD(dd); })();
    if ((f.supInvNo || '').trim() && invNet > 0) { const k0 = purKey({ supplierId: p2.supplierId, invoiceNo: f.supInvNo.trim() }); const o = (ops.invoices || []).find(i => purKey(i) === k0);
      if (o) return say('فاتورة مكررة: رقم ' + f.supInvNo.trim() + ' للمورد «' + p2.supplierName + '» مسجّل بتاريخ ' + (o.date || '') + ' — صحّح رقم فاتورة المورد', 'no'); }
    const invRec = invNet > 0 ? { id: invId, invoiceNo: (f.supInvNo || '').trim() || grn, supplierId: p2.supplierId, supplierName: p2.supplierName, amount: Math.round((invNet + vat) * 100) / 100, vatAmt: vat, taxable: taxOn,
      date: rDate, dueDate: due, paidAmount: 0, branchId: (tw && tw.branchId) || p2.branchId || '', poId: p2.id, poNo: p2.poNo, grn, whId: wid, lines: invLines, by: me.name, createdAt: nowISO() } : null;
    const brMoves = moves.filter(m => m.branchId), mainMoves = moves.filter(m => !m.branchId);
    await commit(d => ({
      ...d,
      invoices: invRec && !(d.invoices || []).some(x => x.id === invRec.id) ? [invRec, ...(d.invoices || [])] : (d.invoices || []),
      whMoves: [...brMoves.filter(m => !(d.whMoves || []).some(x => x.id === m.id)), ...(d.whMoves || [])],
      stockMoves: [...mainMoves.filter(m => !(d.stockMoves || []).some(x => x.id === m.id)), ...(d.stockMoves || [])],
      purchaseOrders: (d.purchaseOrders || []).map(x => {
        if (x.id !== p2.id) return x;
        const lines = x.lines.map((l, i) => ({ ...l, received: (l.received || 0) + takes[i] }));
        return { ...x, lines, status: lines.every(l => l.received >= l.qty) ? 'received' : 'partial', ...(invRec ? { invoiceId: x.invoiceId || invRec.id, invoiceIds: [...(x.invoiceIds || []), invRec.id] } : {}) };
      })
    }), {
      actionType: 'update', targetType: 'purchase_order', targetId: p2.id,
      title: 'سجّل استلام أمر شراء', details: p2.poNo + ' · ' + takes.filter(q => q > 0).length + ' بند' + (moves.length ? ' · غُذّي المخزون' : '')
    });
    // تحديث تكلفة الأصناف المرتبطة بآخر سعر شراء
    // v30.4: التكلفة تُحتسب بالمتوسط المرجّح من الحركات — يُحفظ آخر سعر شراء للمرجعية فقط (بالوحدة الأساسية)
    const costUp = p2.lines.map((l, i) => (takes[i] > 0 && l.itemId && l.price > 0) ? { id: l.itemId, lastPrice: Math.round(l.price / (Number(l.factor) || 1) * 10000) / 10000, lastSupplier: p2.supplierName, lastAt: today() } : null).filter(Boolean);
    if (costUp.length) await commitOrg(d => ({
      ...d, items: (d.items || []).map(it => { const u = costUp.find(c => c.id === it.id); return u ? { ...it, lastPrice: u.lastPrice, lastSupplier: u.lastSupplier, lastAt: u.lastAt } : it; })
    }), { actionType: 'update', targetType: 'stock_item', targetId: p2.id, title: 'سجّل آخر سعر شراء للأصناف', details: p2.poNo });
    setRecv(null); say('سُجّل الاستلام' + (moves.length ? ' في ' + (wid ? whName(org, wid) : 'المخزون') : '') + (invRec ? ' وأُنشئت فاتورة المورد ' + invRec.invoiceNo + ' بـ ' + money(invRec.amount) : '') + ' ✓');
  };
  // v30.9 — مرتجع لمورد: يُخرج الأصناف من المستودع بتكلفة شرائها ويُصدر إشعارًا دائنًا يخفض ذمة المورد وضريبة المدخلات
  const retOpen = (p2) => { const inv0 = (ops.invoices || []).find(i => i.id === p2.invoiceId) || {};
    setRet({ po: p2, date: today(), whId: inv0.whId || MAIN_WH, cnNo: '', reason: '', taxable: inv0.taxable !== false, qtys: p2.lines.map(() => '') }); };
  const saveRet = async () => {
    const f = ret, p2 = f.po, rDate = (f.date || today()).slice(0, 10);
    if (periodLocked(org, rDate)) return say(LOCK_MSG(rDate), 'no');
    if (!(f.reason || '').trim()) return say('اكتب سبب الإرجاع', 'no');
    const takes = p2.lines.map((l, i) => Math.min(Number(f.qtys[i]) || 0, Math.max(0, (Number(l.received) || 0) - (Number(l.returned) || 0))));
    if (!takes.some(q => q > 0)) return say('أدخل كمية مرتجعة', 'no');
    const wid = whOn(org) ? (f.whId || MAIN_WH) : '';
    const tw = wid ? whOf(org).find(w => w.id === wid) : null;
    const SB = stockByWh(org, ops);
    for (let i = 0; i < p2.lines.length; i++) { const l = p2.lines[i]; const it = items.find(x => x.id === l.itemId); if (!(takes[i] > 0) || !l.itemId || (it && !isStocked(it))) continue;
      const need = takes[i] * (Number(l.factor) || 1); const have = wid ? (((SB.byWh[wid] || {})[l.itemId]) || 0) : (SB.total[l.itemId] || 0);
      if (need > have + 0.0005) return say('الرصيد غير كافٍ لإرجاع ' + l.desc + ' من ' + (wid ? whName(org, wid) : 'المخزون') + ' (المتاح ' + q3(have) + ')', 'no'); }
    const cnId = uid('inv'), rtn = 'RTN-' + rDate.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const moves = p2.lines.map((l, i) => { const it = items.find(x => x.id === l.itemId); const fac = Number(l.factor) || 1;
      return (takes[i] > 0 && l.itemId && (!it || isStocked(it))) ? { id: uid('sm'), date: rDate, itemId: l.itemId, kind: 'purchase', qty: -Math.round(takes[i] * fac * 1000) / 1000,
        unitCost: Math.round((Number(l.price) || 0) / fac * 10000) / 10000, note: 'مرتجع لمورد ' + p2.supplierName + ' — ' + l.desc + ' · ' + f.reason.trim(), ref: p2.poNo, rtn, invoiceId: cnId, returnOf: p2.id, by: me.name, at: nowISO(),
        ...(wid ? { whId: wid } : {}), ...(tw && tw.kind === 'branch' ? { branchId: tw.branchId } : {}) } : null; }).filter(Boolean);
    const cnLines = p2.lines.map((l, i) => { if (!(takes[i] > 0)) return null; const it = items.find(x => x.id === l.itemId); const fac = Number(l.factor) || 1;
      return { itemId: l.itemId || '', desc: l.desc, qty: -Math.round(takes[i] * fac * 1000) / 1000, unitCost: Math.round((Number(l.price) || 0) / fac * 10000) / 10000, net: -Math.round(takes[i] * (Number(l.price) || 0) * 100) / 100, stock: !!(l.itemId && it && isStocked(it)) }; }).filter(Boolean);
    const net = Math.round(-cnLines.reduce((a, l) => a + l.net, 0) * 100) / 100;
    const taxOn = !!(org.taxCfg || {}).enabled && f.taxable !== false;
    const vat = taxOn ? Math.round(net * ((Number((org.taxCfg || {}).rate) || 15) / 100) * 100) / 100 : 0;
    const cn = { id: cnId, creditNote: true, invoiceNo: (f.cnNo || '').trim() || rtn, supplierId: p2.supplierId, supplierName: p2.supplierName, amount: -Math.round((net + vat) * 100) / 100, vatAmt: -vat, taxable: taxOn,
      date: rDate, dueDate: rDate, paidAmount: 0, branchId: (tw && tw.branchId) || p2.branchId || '', poId: p2.id, poNo: p2.poNo, appliesTo: p2.invoiceId || '', whId: wid, reason: f.reason.trim(), lines: cnLines, by: me.name, createdAt: nowISO() };
    const brMoves = moves.filter(m => m.branchId), mainMoves = moves.filter(m => !m.branchId);
    const ok = await commit(d => ({ ...d,
      invoices: (d.invoices || []).some(x => x.id === cn.id) ? d.invoices : [cn, ...(d.invoices || [])],
      whMoves: [...brMoves, ...(d.whMoves || [])], stockMoves: [...mainMoves, ...(d.stockMoves || [])],
      purchaseOrders: (d.purchaseOrders || []).map(x => x.id !== p2.id ? x : { ...x, lines: x.lines.map((l, i) => ({ ...l, returned: Math.round(((Number(l.returned) || 0) + takes[i]) * 1000) / 1000 })), returnIds: [...(x.returnIds || []), cn.id] })
    }), { actionType: 'create', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: 'مرتجع لمورد', details: p2.poNo + ' · ' + p2.supplierName + ' · ' + money(-cn.amount) + ' · ' + f.reason.trim() });
    if (ok) { setRet(null); say('سُجّل المرتجع وأُصدر إشعار دائن ' + cn.invoiceNo + ' بـ ' + money(-cn.amount) + ' ✓'); }
  };

  const settle = async () => {
    const inv = pay;
    // v8.1: فاتورة مشتقة من وردية → السداد يُسجل في سجل مستقل وقيده (ذمم/بنك) يتولد تلقائياً
    if (inv.source === 'closing') {
      const v = Math.min(amt, cRem(inv));
      if (v <= 0) return say('أدخل مبلغ سداد صحيح', 'no');
      const rec = { id: uid('cip'), refId: inv.id, supplierId: inv.supplierId, amount: v, date: today(), by: me.name, at: nowISO(), fund: payFund };
      await commit(d => ({ ...d, closingInvPays: [rec, ...(d.closingInvPays || [])] }), {
        actionType: 'create', targetType: 'expense', targetId: rec.id, branchName: inv.branchName,
        title: 'سدّد مركزياً مشتريات وردية آجلة', details: `${inv.supplierName} · ${inv.invoiceNo} · ${money(v)} ر.س` + (payFund === '1101' ? ' · نقداً من الخزينة' : ' · من البنك')
      });
      setPay(null); setAmt(0); say('سُجّل السداد وتولد قيده تلقائياً ✓');
      return;
    }
    const v = Math.min(amt, invRem(inv));
    if (v <= 0) return say('أدخل مبلغ سداد صحيح', 'no');
    await commit(d => ({
      ...d,
      // v29.4: الدفعة تُحفظ بتاريخها ومصدرها؛ paidAmount يبقى مجموع المسدَّد (تعتمد عليه شاشات المتبقي)
      invoices: (d.invoices || []).map(i => i.id === inv.id ? { ...i, paidAmount: Math.round(((i.paidAmount || 0) + v) * 100) / 100,
        payments: [...(Array.isArray(i.payments) ? i.payments : (i.paidAmount > 0 ? [{ id: 'legacy', amount: i.paidAmount, date: (i.paidDate || i.date || '').slice(0, 10), fund: i.payFund || '' }] : [])),
          { id: uid('ipay'), amount: v, date: today(), fund: payFund, by: me.name, at: nowISO() }] } : i)
    }), {
      actionType: 'update', targetType: 'expense', targetId: inv.id, branchName: inv.branchName,
      title: 'سدّد دفعة لمورد', details: `${inv.supplierName} · فاتورة ${inv.invoiceNo} · ${money(v)} ر.س` + (payFund === '1101' ? ' · نقداً من الخزينة' : ' · من البنك')
    });
    say(`تم تسجيل سداد ${money(v)} ر.س لـ${inv.supplierName}`);
    setPay(null); setAmt(0);
  };

  const togglePaid = async (f) => {
    await commit(d => ({
      ...d,
      fixedExpenses: (d.fixedExpenses || []).map(x => x.id === f.id
        ? { ...x, isPaid: !x.isPaid, paidDate: !x.isPaid ? today() : '' } : x)
    }), {
      actionType: 'update', targetType: 'expense', targetId: f.id, branchName: f.branchName,
      title: f.isPaid ? 'ألغى سداد التزامات فرع' : 'اعتمد سداد التزامات فرع',
      details: `${f.branchName} — ${f.month}`
    });
    say('تم تحديث حالة السداد');
  };

  const fxTotal = (f) => f.rentAmount + f.electricityBill + f.waterBill + f.internetBill + f.otherBills;

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.4 */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Truck size={17} /></span>الموردون والمشتريات<small>الفواتير والالتزامات · سجل الموردين · أوامر الشراء</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير الموردون والمشتريات</div>
              <button onClick={() => { setRepOpen(false); printInvs(); }}><Printer size={13} />الفواتير المفتوحة وأعمار الديون</button>
              <button onClick={() => { setRepOpen(false); setTab('po'); say('أوامر الشراء — اطبع أي أمر من زر الطابعة بجانبه'); }}><Printer size={13} />أوامر الشراء</button>
            </div>
          </>)}
        </div>
      </div>

      <SectionNav label="الفواتير والأوامر" cur={tab} onPick={setTab} items={[{ id: 'inv', ar: 'فواتير الموردين الآجلة', icon: FileText }, { id: 'fx', ar: 'إيجارات وفواتير الفروع', icon: Building2 }, { id: 'po', ar: 'أوامر الشراء', icon: ClipboardCheck }]}
        extra={<>{goTab && roleHasTab(me, 'partners') && <button className="btn sm gh" onClick={() => goTab('partners')}><Users size={14} />الموردون ← جهات الاتصال</button>}
          {canPay && <button className="btn sm pri" onClick={() => setNewInv({ supplierId: suppliers[0]?.id || '', invoiceNo: '', amount: '', taxable: true, date: today(), dueDate: today(), branchId: '' })}><Plus size={14} />فاتورة توريد جديدة</button>}</>} />
      <div className="grid g4">
        <Kpi label="مستحقات الموردين" value={money(outstanding)} sub={`${allInvs.filter(i => remOf(i) > 0).length} فاتورة مفتوحة (منها ${clInvs.filter(v => cRem(v) > 0).length} من الورديات)`} icon={Truck} color="#C8A24A" />
        <Kpi label="متأخرة عن الاستحقاق" value={money(sum(overdue, remOf))} sub={`${overdue.length} فاتورة`} icon={AlertTriangle} color="#D9544D" />
        <Kpi label="التزامات الشهر الثابتة" value={money(sum(fixed, fxTotal))} sub={`${fixed.length} فرع`} icon={Building2} color="#5B93C4" />
        <Kpi label="غير المسدد من الثابتة" value={money(sum(fixed.filter(f => !f.isPaid), fxTotal))} icon={CalendarDays} color="#E0A458" />
      </div>


      {tab === 'inv' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <input className="inp" style={{ maxWidth: 320 }} placeholder="بحث برقم الفاتورة أو اسم المورد…" value={invQ} onChange={e => setInvQ(e.target.value)} />
            <button className="btn sm" onClick={printInvs}><Printer size={13} />طباعة الفواتير المفتوحة</button>
          </div>
          {invShown.total > invShown.list.length && <div className="note" style={{ marginBottom: 8, fontSize: 12 }}>يُعرض أول {invShown.list.length} من {invShown.total} فاتورة — استخدم البحث للوصول لفاتورة محددة.</div>}
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الفاتورة</th><th>المورد</th><th>الفرع</th><th>الاستحقاق</th><th>المهلة</th>
                <th>القيمة</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {invShown.list.map(i => {
                  const bp = i.source === 'closing' ? 0 : branchPaid(i.id);
                  const rem = remOf(i);
                  const late = rem > 0 && i.dueDate < today();
                  const daysLeft = i.dueDate ? Math.round((new Date(i.dueDate) - new Date(today())) / 864e5) : null;
                  const mahla = rem <= 0 ? { t: '—', c: 'var(--faint)' }
                    : daysLeft === null ? { t: '—', c: 'var(--faint)' }
                    : daysLeft < 0 ? { t: `متأخر ${Math.abs(daysLeft)} يوم`, c: 'var(--rose)' }
                    : daysLeft === 0 ? { t: 'اليوم', c: 'var(--rose)' }
                    : daysLeft === 1 ? { t: 'غداً', c: 'var(--amber)' }
                    : daysLeft <= 3 ? { t: `${daysLeft} أيام`, c: 'var(--amber)' }
                    : { t: `${daysLeft} يوم`, c: 'var(--dim)' };
                  return (
                    <tr key={i.id}>
                      <td style={{ fontSize: 11 }}><span className="num">{i.invoiceNo}</span>
                        {i.source === 'closing' && <div><span className="badge b-mint" style={{ fontSize: 8.5, marginTop: 2 }}>من وردية · {i.categoryName}</span></div>}</td>
                      <td style={{ fontSize: 12 }}>{i.supplierName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{i.branchName}</td>
                      <td className="dt" style={{ whiteSpace: 'nowrap', color: late ? 'var(--rose)' : 'inherit' }}>{arDate(i.dueDate)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: mahla.c, fontSize: 11.5, fontWeight: 600 }}>{mahla.t}</td>
                      <td className="num">{money(i.amount)}</td>
                      <td className="num" style={{ color: 'var(--mint)' }}>{money(paidOf(i))}
                        {bp > 0 && <div style={{ fontSize: 9, color: 'var(--faint)' }}>منه من الفروع {money(bp)}</div>}</td>
                      <td className="num" style={{ color: rem > 0 ? 'var(--amber)' : 'var(--faint)', fontWeight: 600 }}>{money(rem)}</td>
                      <td><span className={'badge ' + (rem <= 0 ? 'b-mint' : late ? 'b-rose' : 'b-amber')}>
                        {rem <= 0 ? 'مسددة' : late ? 'متأخرة' : 'قيد السداد'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{rem > 0 && canPay &&
                        <button className="btn sm" onClick={() => { setPay(i); setAmt(rem); }}>سداد</button>}
                        {i.source === 'stored' && canDelInv && <button className="btn sm gh" title="حذف فاتورة مكررة أو مستوردة خطأً" style={{ color: 'var(--rose)', marginInlineStart: 4 }} onClick={() => delInv(i)}><Trash2 size={12} /></button>}</td>
                    </tr>
                  );
                })}
                {invShown.total === 0 && invQ.trim() && <tr><td colSpan={10}><div className="empty">لا فاتورة تطابق «{invQ}»</div></td></tr>}
                {allInvs.length === 0 && <tr><td colSpan={10}><div className="empty">لا فواتير آجلة — المشتريات الآجلة المربوطة بموردين في الورديات ستظهر هنا تلقائياً.</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            🔗 <b>الربط التلقائي (v8.1):</b> كل مصروف آجل مربوط بمورد في وردية معتمدة يظهر هنا فاتورةً
            باستحقاق = تاريخ الوردية + مهلة المورد — بأثر رجعي على كل الورديات السابقة.
            قيدها المحاسبي هو قيد الوردية نفسه (لا ازدواج)، وسدادها من هنا يتولد قيده (ذمم الموردين / البنك)
            ويظهر في كشف المورد بدفتر الشركاء.
          </div>
        </div>
      )}

      {tab === 'fx' && (
        <div className="grid g2">
          {fixed.map(f => (
            <div key={f.id} className="card">
              <div className="card-h">
                <div className="card-t"><Building2 size={15} color="var(--brass)" />{f.branchName}</div>
                <span className={'badge ' + (f.isPaid ? 'b-mint' : 'b-amber')}>{f.isPaid ? 'مسددة' : 'مستحقة يوم ' + f.dueDayOfMonth}</span>
              </div>
              {[['إيجار الفرع', f.rentAmount], ['كهرباء', f.electricityBill], ['مياه', f.waterBill],
              ['إنترنت', f.internetBill], ['مصاريف إدارية أخرى', f.otherBills]].map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid rgba(51,44,38,.5)' }}>
                  <span style={{ color: 'var(--dim)' }}>{k}</span><span className="num">{money(v)}</span>
                </div>
              ))}
              <div className="mono-b" style={{ marginTop: 10, borderColor: 'var(--brass-d)' }}>
                <span style={{ fontSize: 12 }}>إجمالي التزامات {f.month}</span>
                <span className="num" style={{ color: 'var(--brass)', fontWeight: 600 }}>{money(fxTotal(f))}</span>
              </div>
              {canPay && <button className={'btn sm ' + (f.isPaid ? 'gh' : 'ok')} style={{ marginTop: 10 }} onClick={() => togglePaid(f)}>
                {f.isPaid ? 'إلغاء تعليم السداد' : <><Check size={13} />اعتماد السداد</>}
              </button>}
            </div>
          ))}
        </div>
      )}

      {tab === 'sup' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>المورد</th><th>التصنيف</th><th>الجوال</th><th>الرقم الضريبي</th><th>مهلة السداد</th><th>الرصيد المستحق</th></tr></thead>
              <tbody>
                {suppliers.map(sp => {
                  const bal = sum(invoices.filter(i => i.supplierId === sp.id), invRem);
                  return (
                    <tr key={sp.id}>
                      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{sp.name}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{sp.category}</td>
                      <td className="num" style={{ fontSize: 11.5 }}>{sp.phone}</td>
                      <td className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{sp.vatNo}</td>
                      <td><span className="badge b-dim"><span className="num">{sp.terms}</span> يوم</span></td>
                      <td className="num" style={{ color: bal > 0 ? 'var(--amber)' : 'var(--mint)', fontWeight: 600 }}>{money(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'po' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><ClipboardCheck size={15} color="var(--brass)" />أوامر الشراء — إنشاء ← استلام ← فاتورة ← سداد</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (showPrices ? ' pri' : ' gh')} onClick={() => setShowPrices(v => !v)}>أسعار الموردين</button>
              {canCfg && <button className="btn sm gh" onClick={() => setCfgF({ approvalLimit: String(apprLimit || ''), priceAlertPct: String(alertPct), perpetual: !!pcfg.perpetualFrom, perpetualFrom: pcfg.perpetualFrom || today().slice(0, 7) })}>⚙ الإعدادات</button>}
              {canPay && <button className="btn sm pri" onClick={() => setPoF({ supplierId: suppliers[0]?.id || '', branchId: '', note: '', lines: [{ desc: '', itemId: '', qty: '', price: '' }] })}><Plus size={14} />أمر شراء جديد</button>}
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '0 0 10px' }}>
            <span className="badge b-dim">الاعتماد: {apprLimit > 0 ? 'الأوامر فوق ' + money(apprLimit) + ' ر.س' : 'غير مفعّل'}</span>
            <span className="badge b-dim">تنبيه السعر: {alertPct > 0 ? 'أعلى من متوسط آخر 3 مشتريات بأكثر من ' + alertPct + '% ⇐ اعتماد' : 'موقوف'}</span>
            <span className={'badge ' + (pcfg.perpetualFrom ? 'b-mint' : 'b-dim')}>الجرد المستمر: {pcfg.perpetualFrom ? 'من ' + pcfg.perpetualFrom : 'موقوف (دوري)'}</span>
          </div>
          {showPrices && (() => { const rows = Object.entries(PRICES).map(([id, a]) => { const it = items.find(x => x.id === id); const bySup = {}; a.forEach(r => { if (!bySup[r.supplierId]) bySup[r.supplierId] = r; });
              const sups = Object.values(bySup).sort((x, y) => x.unitCost - y.unitCost); const p3 = a.slice(1, 4); return { id, name: it ? it.name : 'صنف', unit: it ? it.unit : '', last: a[0], prev: p3.length ? { unitCost: sum(p3, r => r.unitCost) / p3.length, n: p3.length } : null, sups }; }).sort((x, y) => x.name.localeCompare(y.name, 'ar'));
            return (
            <div className="tw" style={{ marginBottom: 12 }}>
              <table className="tb">
                <thead><tr><th>الصنف</th><th style={{ textAlign: 'end' }}>آخر سعر (للوحدة الأساسية)</th><th>مقابل متوسط آخر 3</th><th>مقارنة الموردين — آخر سعر لكل مورد</th></tr></thead>
                <tbody>
                  {rows.map(r => { const ch = r.prev ? Math.round((r.last.unitCost - r.prev.unitCost) / r.prev.unitCost * 1000) / 10 : null; return (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12.5 }}>{r.name}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{r.unit} · {r.last.supplierName} · {r.last.date}</div></td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(r.last.unitCost)}</td>
                      <td>{ch == null ? <span className="badge b-dim">—</span> : <span className={'badge ' + (ch > alertPct && alertPct > 0 ? 'b-rose' : ch > 0 ? 'b-amber' : 'b-mint')}>{ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : ''}{Math.abs(ch)}%</span>}{r.prev && <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>متوسط {r.prev.n}: <span className="num">{money(r.prev.unitCost)}</span></div>}</td>
                      <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>{r.sups.map((x, k) => <span key={x.supplierId} className={'badge ' + (k === 0 && r.sups.length > 1 ? 'b-mint' : 'b-dim')}>{x.supplierName}: <span className="num">{money(x.unitCost)}</span>{k === 0 && r.sups.length > 1 ? ' — الأرخص' : ''}</span>)}</div></td>
                    </tr>); })}
                  {rows.length === 0 && <tr><td colSpan={4}><div className="empty">تظهر الأسعار بعد أول استلام لأمر شراء مربوط بأصناف.</div></td></tr>}
                </tbody>
              </table>
            </div>); })()}
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الأمر</th><th>المورد</th><th style={{ textAlign: 'end' }}>القيمة</th><th>الاستلام</th><th>الفاتورة</th><th /></tr></thead>
              <tbody>
                {pos.map(p2 => {
                  const tot = poTotal(p2);
                  const invs = (ops.invoices || []).filter(i => !i.creditNote && (i.id === p2.invoiceId || (p2.invoiceIds || []).includes(i.id) || i.poId === p2.id));
                  const inv = invs[0];
                  const locked2 = p2.status === 'pending' || p2.status === 'rejected';
                  return (
                    <tr key={p2.id}>
                      <td><span className="num" style={{ fontSize: 11.5 }}>{p2.poNo}</span><div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{p2.date} · {p2.by}</div></td>
                      <td style={{ fontSize: 12.5 }}>{p2.supplierName}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{(p2.lines || []).length} بند{p2.note ? ' · ' + p2.note : ''}</div>
                        {p2.priceAlert ? <span className="badge b-rose" style={{ marginTop: 3 }} title={(p2.lines || []).filter(l => l.pAlert).map(l => l.desc + ': ' + money(l.pAlert.unit) + ' مقابل متوسط ' + money(l.pAlert.avg3) + ' (+' + l.pAlert.pct + '%)').join('\n')}>⚠ سعر أعلى من متوسط آخر 3 · {(p2.lines || []).filter(l => l.pAlert).map(l => l.desc + ' +' + l.pAlert.pct + '%').join('، ') || p2.priceAlert + ' بند'}</span> : null}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(tot)}</td>
                      <td>{p2.status === 'pending' ? <span className="badge b-amber">بانتظار الاعتماد</span>
                        : p2.status === 'rejected' ? <span className="badge b-rose" title={p2.rejectNote || ''}>مرفوض{p2.rejectNote ? ' — ' + p2.rejectNote : ''}</span>
                        : p2.status === 'received' ? <span className="badge b-mint">مستلم كاملاً ✓</span>
                        : p2.status === 'partial' ? <span className="badge b-amber">جزئي</span>
                        : <span className="badge b-sky">بانتظار التوريد</span>}</td>
                      <td>{(p2.returnIds || []).length > 0 && <div><span className="badge b-amber" style={{ marginBottom: 3 }}>مرتجع · {money(-sum((ops.invoices || []).filter(x => (p2.returnIds || []).includes(x.id)), x => x.amount))}</span></div>}{inv ? <span className="badge b-mint">مفوترة · {invs.filter(x => !x.creditNote).map(x => x.invoiceNo).join('، ')}</span> : <span className="badge b-dim">لم تُفوتر</span>}{p2.priceAlert ? <div><span className="badge b-rose" style={{ marginTop: 3 }}>⚠ سعر مرتفع في {p2.priceAlert} بند</span></div> : null}</td>
                      <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                        <button className="btn sm gh" onClick={() => printPO(p2)}><Printer size={12} /></button>
                        {canApprovePo && p2.status === 'pending' && <><button className="btn sm pri" onClick={() => decidePo(p2, true)}>اعتماد</button><button className="btn sm gh" onClick={() => decidePo(p2, false)}>رفض</button></>}
                        {canPay && !locked2 && p2.status !== 'received' && <button className="btn sm" onClick={() => setRecv({ po: p2, qtys: p2.lines.map(l => String((l.qty || 0) - (l.received || 0))), whId: MAIN_WH, date: today(), supInvNo: '', taxable: true, batch: p2.lines.map(() => ''), expiry: p2.lines.map(() => '') })}>تسجيل استلام</button>}
                        {canPay && (p2.lines || []).some(l => (Number(l.received) || 0) > (Number(l.returned) || 0)) && <button className="btn sm gh" onClick={() => retOpen(p2)}>مرتجع</button>}
                        {canPay && !inv && !locked2 && <button className="btn sm gh" onClick={() => setNewInv({ supplierId: p2.supplierId, invoiceNo: '', amount: String(tot), taxable: true, date: today(), dueDate: today(), branchId: p2.branchId || '', poId: p2.id })}>إنشاء فاتورة</button>}
                      </div></td>
                    </tr>
                  );
                })}
                {pos.length === 0 && <tr><td colSpan={6}><div className="empty">لا أوامر شراء بعد — أنشئ أمرك الأول وسيغذّي المخزون عند الاستلام.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {newInv && (
        <Modal title={newInv.poId ? 'فاتورة من أمر الشراء' : 'فاتورة توريد جديدة'} icon={FileText} onClose={() => setNewInv(null)}
          foot={<><button className="btn gh" onClick={() => setNewInv(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveInv}><Check size={14} />تسجيل الفاتورة</button></>}>
          <div className="grid g2">
            <Field label="المورد">
              <select className="sel" value={newInv.supplierId} onChange={e => setNewInv(f => ({ ...f, supplierId: e.target.value }))}>
                {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </Field>
            <Field label="رقم الفاتورة (اختياري — يُولَّد تلقائياً)">
              <input className="inp" value={newInv.invoiceNo} onChange={e => setNewInv(f => ({ ...f, invoiceNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={newInv.supplierId} invoiceNo={newInv.invoiceNo} amount={newInv.amount} date={newInv.date} />
            </Field>
          </div>
          <div className="grid g3">
            <Field label="المبلغ (شامل الضريبة إن كانت خاضعة)">
              <input className="inp n" inputMode="decimal" value={newInv.amount} onChange={e => setNewInv(f => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))} />
            </Field>
            <Field label="تاريخ الفاتورة"><input type="date" className="inp" value={newInv.date} onChange={e => setNewInv(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="تاريخ الاستحقاق"><input type="date" className="inp" value={newInv.dueDate} onChange={e => setNewInv(f => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <Field label="الفرع (اختياري)">
              <select className="sel" value={newInv.branchId} onChange={e => setNewInv(f => ({ ...f, branchId: e.target.value }))}>
                <option value="">المركز الرئيسي</option>
                {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', paddingTop: 14 }}>
              <input type="checkbox" checked={!!newInv.taxable} onChange={e => setNewInv(f => ({ ...f, taxable: e.target.checked }))} />
              خاضعة لضريبة القيمة المضافة — يفصل المحرك ضريبة المدخلات تلقائياً عند تفعيل الضريبة
            </label>
          </div>
        </Modal>
      )}

      {poF && (
        <Modal title="أمر شراء جديد" icon={ClipboardCheck} onClose={() => setPoF(null)} wide
          foot={<><button className="btn gh" onClick={() => setPoF(null)}>إلغاء</button>
            <button className="btn pri" onClick={savePo}><Check size={14} />إنشاء الأمر</button></>}>
          <div className="grid g2">
            <Field label="المورد">
              <select className="sel" value={poF.supplierId} onChange={e => setPoF(f => ({ ...f, supplierId: e.target.value }))}>
                {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </Field>
            <Field label="ملاحظة (اختياري)"><input className="inp" value={poF.note} placeholder="توريد أسبوعي…" onChange={e => setPoF(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
          <div className="lbl" style={{ margin: '4px 0 6px' }}>البنود — اربط البند بصنف مخزون ليُغذّى رصيده تلقائياً عند الاستلام</div>
          {(poF.lines || []).map((l, i) => (
            <div key={i} className="row" style={{ gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
              <input className="inp" style={{ flex: 2, minWidth: 150 }} placeholder="الوصف (لحم غنم مبرد…)" value={l.desc}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, desc: e.target.value } : x) }))} />
              <select className="sel" style={{ flex: 1.4, minWidth: 130 }} value={l.itemId}
                onChange={e => { const it = items.find(x => x.id === e.target.value); setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, itemId: e.target.value, uom: it && it.purchaseUnit && pFactor(it) > 1 ? 'p' : 'b', desc: x.desc || (it ? it.name : '') } : x) })); }}>
                <option value="">بلا ربط مخزون</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.unit}){itemType(it) === 'service' ? ' — خدمي' : ''}</option>)}
              </select>
              {(() => { const it = items.find(x => x.id === l.itemId); return it && it.purchaseUnit && pFactor(it) > 1 ? (
                <select className="sel" style={{ width: 120 }} value={l.uom || 'p'} onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, uom: e.target.value } : x) }))}>
                  <option value="p">{it.purchaseUnit} ({pFactor(it)})</option><option value="b">{it.unit}</option>
                </select>) : null; })()}
              <input className="inp n" style={{ width: 90 }} inputMode="decimal" placeholder="الكمية" value={l.qty}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="سعر الوحدة" value={l.price}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              {poF.lines.length > 1 && <button className="btn sm gh" onClick={() => setPoF(f => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}><X size={13} /></button>}
              {(() => { const lp = l.itemId && lastPriceOf(l.itemId); if (!lp) return null; const w = priceWarn(l); return (
                <div style={{ flexBasis: '100%', fontSize: 10.5, color: w && w.high ? 'var(--rose)' : 'var(--faint)' }}>
                  آخر سعر: <span className="num">{money(lp.unitCost)}</span> ({lp.supplierName} · {lp.date}){w ? <> · متوسط آخر {w.n}: <span className="num">{money(w.avg)}</span> · سعرك <span className="num">{money(w.u)}</span> (<span dir="ltr">{(w.pct > 0 ? '+' : '') + w.pct}%</span>)</> : ''}{w && w.high ? ' ⚠ يتجاوز حد التنبيه ' + alertPct + '% — سيحتاج الأمر اعتمادًا' : ''}
                </div>); })()}
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setPoF(f => ({ ...f, lines: [...f.lines, { desc: '', itemId: '', qty: '', price: '' }] }))}><Plus size={13} />بند إضافي</button>
            <span className="badge b-brass">قيمة الأمر: {money(sum(poF.lines || [], l => (Number(l.qty) || 0) * (Number(l.price) || 0)))}</span>
          </div>
          {apprLimit > 0 && sum(poF.lines || [], l => (Number(l.qty) || 0) * (Number(l.price) || 0)) > apprLimit && <div className="note" style={{ marginTop: 8 }}>القيمة تتجاوز حد الاعتماد {money(apprLimit)} — سيُحفظ الأمر «بانتظار الاعتماد» ولا يُستلم قبل اعتماده.</div>}
        </Modal>
      )}

      {ret && (
        <Modal title={'مرتجع لمورد — ' + ret.po.poNo + ' · ' + ret.po.supplierName} icon={Truck} onClose={() => setRet(null)}
          foot={<><button className="btn gh" onClick={() => setRet(null)}>إلغاء</button><button className="btn pri" onClick={saveRet}><Check size={14} />تسجيل المرتجع</button></>}>
          <div className="grid g2">
            {whOn(org) && <Field label="المستودع الذي يُخرج منه"><select className="sel" value={ret.whId || MAIN_WH} onChange={e => setRet(r => ({ ...r, whId: e.target.value }))}>
              {whOf(org).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
            <Field label="تاريخ الإرجاع"><input type="date" className="inp" value={ret.date} onChange={e => setRet(r => ({ ...r, date: e.target.value }))} /></Field>
            <Field label="رقم الإشعار الدائن من المورد (اختياري)"><input className="inp" value={ret.cnNo} placeholder="يُولَّد رقم مرتجع إن تُرك فارغًا" onChange={e => setRet(r => ({ ...r, cnNo: e.target.value }))} /></Field>
            <Field label="سبب الإرجاع"><input className="inp" value={ret.reason} placeholder="تالف، منتهي، مخالف للمواصفات…" onChange={e => setRet(r => ({ ...r, reason: e.target.value }))} /></Field>
          </div>
          {ret.po.lines.map((l, i) => { const can = Math.max(0, (Number(l.received) || 0) - (Number(l.returned) || 0)); return (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 150, fontSize: 12.5 }}>{l.desc}
                <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>المستلم <span className="num">{l.received || 0}</span> · المرتجع سابقًا <span className="num">{l.returned || 0}</span> · يمكن إرجاع <span className="num">{can}</span>{l.uomName ? ' ' + l.uomName : ''} · بسعر <span className="num">{money(l.price)}</span></div></div>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="الكمية المرتجعة" disabled={can <= 0} value={ret.qtys[i]}
                onChange={e => setRet(r => ({ ...r, qtys: r.qtys.map((q, k) => k === i ? e.target.value.replace(/[^\d.]/g, '') : q) }))} />
            </div>); })}
          {(() => { const net = ret.po.lines.reduce((a, l, i) => a + Math.min(Number(ret.qtys[i]) || 0, Math.max(0, (Number(l.received) || 0) - (Number(l.returned) || 0))) * (Number(l.price) || 0), 0);
            const vat = (org.taxCfg || {}).enabled && ret.taxable !== false ? net * ((Number((org.taxCfg || {}).rate) || 15) / 100) : 0;
            return net > 0 ? <div className="mono-b" style={{ margin: '6px 0' }}><span style={{ fontSize: 12 }}>الإشعار الدائن</span><span className="num">{money(net)}{vat ? ' + ض ' + money(vat) + ' = ' + money(net + vat) : ''}</span></div> : null; })()}
          <div className="note">يُخرج الأصناف من المستودع بتكلفة شرائها، ويُخفّض ذمة المورد وضريبة المدخلات، ويُطبَّق على رصيد فاتورة الاستلام.</div>
        </Modal>
      )}

      {cfgF && (
        <Modal title="إعدادات المشتريات والمخزون" icon={ClipboardCheck} onClose={() => setCfgF(null)}
          foot={<><button className="btn gh" onClick={() => setCfgF(null)}>إلغاء</button><button className="btn pri" onClick={saveCfg}><Check size={14} />حفظ</button></>}>
          <div className="grid g2">
            <Num label="حد اعتماد أمر الشراء (ر.س)" value={cfgF.approvalLimit} onChange={v => setCfgF(f => ({ ...f, approvalLimit: v }))} hint="الأوامر الأعلى منه تحتاج اعتماد المدير/المعتمِد — 0 = بلا اعتماد" />
            <Num label="تنبيه ارتفاع السعر (%)" value={cfgF.priceAlertPct} onChange={v => setCfgF(f => ({ ...f, priceAlertPct: v }))} hint="يُنبَّه إذا زاد سعر البند عن متوسط آخر 3 مشتريات للصنف بأكثر من هذه النسبة، ويحتاج الأمر اعتمادًا — 0 = موقوف" />
          </div>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '8px 0' }}>
            <input type="checkbox" checked={!!cfgF.perpetual} onChange={e => setCfgF(f => ({ ...f, perpetual: e.target.checked }))} />تفعيل الجرد المستمر (قيود مخزون آلية مع كل حركة)
          </label>
          {cfgF.perpetual && <Field label="بداية الجرد المستمر (شهر)"><input type="month" className="inp" value={cfgF.perpetualFrom} onChange={e => setCfgF(f => ({ ...f, perpetualFrom: e.target.value }))} /></Field>}
          <div className="note">في الجرد المستمر: الاستلام يُقيَّد على حساب المستودع، والصرف والهالك والتسويات تُقيَّد بتكلفة المتوسط المرجّح لحظة الحركة، والتحويلات تمر بحساب «بضاعة في الطريق». يُنشأ قيد افتتاحي برصيد المخزون في أول يوم من الشهر المختار، ويتوقف قيد تقييم المخزون الدوري. يُفضَّل اختيار بداية شهر غير مقفل.</div>
        </Modal>
      )}

      {recv && (
        <Modal title={'تسجيل استلام — ' + recv.po.poNo} icon={Truck} onClose={() => setRecv(null)}
          foot={<><button className="btn gh" onClick={() => setRecv(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveRecv}><Check size={14} />تأكيد الاستلام</button></>}>
          <div className="grid g2">
            {whOn(org) && <Field label="المستودع المستلِم">
              <select className="sel" value={recv.whId || MAIN_WH} onChange={e => setRecv(r => ({ ...r, whId: e.target.value }))}>
                {whOf(org).map(w => <option key={w.id} value={w.id}>{w.name}{w.kind === 'main' ? ' (رئيسي)' : ''}</option>)}
              </select>
            </Field>}
            <Field label="تاريخ الاستلام"><input type="date" className="inp" value={recv.date || today()} onChange={e => setRecv(r => ({ ...r, date: e.target.value }))} /></Field>
            <Field label="رقم فاتورة المورد (اختياري)"><input className="inp" value={recv.supInvNo || ''} placeholder="يُولَّد رقم استلام إن تُرك فارغًا" onChange={e => setRecv(r => ({ ...r, supInvNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={recv.po && recv.po.supplierId} invoiceNo={recv.supInvNo} /></Field>
            {!!(org.taxCfg || {}).enabled && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', paddingTop: 14 }}>
              <input type="checkbox" checked={recv.taxable !== false} onChange={e => setRecv(r => ({ ...r, taxable: e.target.checked }))} />الفاتورة خاضعة لضريبة القيمة المضافة
            </label>}
          </div>
          {recv.po.lines.map((l, i) => {
            const rem = (l.qty || 0) - (l.received || 0);
            return (
              <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 150, fontSize: 12.5 }}>{l.desc}
                  <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>المطلوب <span className="num">{l.qty}</span> · المستلم سابقاً <span className="num">{l.received || 0}</span> · المتبقي <span className="num">{rem}</span>{l.itemId ? ' · مربوط بالمخزون' : ''}</div>
                </div>
                <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="المستلم الآن" value={recv.qtys[i]}
                  disabled={rem <= 0}
                  onChange={e => setRecv(r => ({ ...r, qtys: r.qtys.map((q, k) => k === i ? e.target.value.replace(/[^\d.]/g, '') : q) }))} />
                {rem > 0 && l.itemId && (() => { const it = items.find(x => x.id === l.itemId); return !it || isStocked(it); })() && <>
                  <input className="inp" style={{ width: 100 }} placeholder="رقم الدفعة" value={(recv.batch || [])[i] || ''} onChange={e => setRecv(r => ({ ...r, batch: (r.batch || []).map((q, k) => k === i ? e.target.value : q) }))} />
                  <input type="date" className="inp" style={{ width: 140 }} title="تاريخ الانتهاء" value={(recv.expiry || [])[i] || ''} onChange={e => setRecv(r => ({ ...r, expiry: (r.expiry || []).map((q, k) => k === i ? e.target.value : q) }))} />
                </>}
              </div>
            );
          })}
          {(() => { const net = recv.po.lines.reduce((s2, l, i) => s2 + (Number(recv.qtys[i]) || 0) * (Number(l.price) || 0), 0); const vat = (org.taxCfg || {}).enabled && recv.taxable !== false ? net * ((Number((org.taxCfg || {}).rate) || 15) / 100) : 0;
            return net > 0 ? <div className="mono-b" style={{ margin: '6px 0' }}><span style={{ fontSize: 12 }}>فاتورة المورد التي ستُنشأ تلقائيًا</span><span className="num">{money(net)}{vat ? ' + ض ' + money(vat) + ' = ' + money(net + vat) : ''}</span></div> : null; })()}
          <div className="note">الأصناف المخزنية تدخل المستودع المختار بدفعتها وتاريخ انتهائها، وتُحدَّث تكلفتها بالمتوسط المرجّح، وتُنشأ فاتورة المورد بأسعار أمر الشراء مع استحقاق حسب شروط المورد.{pcfg.perpetualFrom ? ' القيد: من ح/ المخزون إلى ح/ المورد (جرد مستمر).' : ''}</div>
        </Modal>
      )}

      {pay && (
        <Modal title={`سداد فاتورة ${pay.invoiceNo}`} icon={Banknote} onClose={() => setPay(null)}
          foot={<><button className="btn pri" onClick={settle}><Check size={14} />تسجيل السداد</button>
            <button className="btn gh" onClick={() => setPay(null)}>إلغاء</button></>}>
          <div className="mono-b" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12 }}>{pay.supplierName} — {pay.branchName}</span>
            <span className="num" style={{ color: 'var(--amber)' }}>المتبقي {money(invRem(pay))}</span>
          </div>
          <Num label="مبلغ السداد" value={amt} onChange={setAmt} hint="يمكن السداد جزئياً على دفعات" />
          <Field label="مصدر السداد">
            <select className="sel" value={payFund} onChange={e => setPayFund(e.target.value)}>
              <option value="1201">من البنك التجميعي</option>
              {branchBanks(org).map(bb => <option key={bb.code} value={bb.code}>من {bb.name}</option>)}
              <option value="1101">نقداً من الخزينة الرئيسية</option>
            </select>
          </Field>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4, lineHeight: 1.7 }}>
            يُقيَّد السداد على المصدر المختار في المحاسبة تلقائيًا. للفاتورة الواحدة المسدَّدة على دفعات، يُعتمد مصدر آخر دفعة لكامل سداداتها.
          </div>
        </Modal>
      )}
    </div>
  );
}
