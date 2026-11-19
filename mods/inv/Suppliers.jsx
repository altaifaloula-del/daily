/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Truck, FileBarChart, ChevronDown, Printer, FileText, Building2, ClipboardCheck, Users, Plus, AlertTriangle, CalendarDays, Trash2, Check, X, Banknote } from 'lucide-react';
import { poNeedsAppr, wfOn, wfState, wfCanAct, wfApprove } from '../../App.jsx';   // v49.5 مسارات الاعتماد
import { canEditRec, autoCfgOf, poSuggestions, DocLink, RowGrip, moveIdx, projList, uomOf, uomOk, lineUnits, lineFac, UomSelect, DupInvHint, Field, Kpi, LOCK_MSG, MAIN_WH, Modal, Num, ROLES, SectionNav, arDate, branchBanks, closingInvoices, isStocked, isoD, itemType, money, nowISO, pFactor, payTotal, periodLocked, printA4, purKey, q3, _xe, roleEdit, rolePost, buildAccounting, INV_BILLERS, itemsSeq, vatNoOk, supVatOf, ItemPick, roleHasTab, stockByWh, sum, supplierPrices, today, uid, whName, whOf, whOn, poWhOf, brSigCheck, signoff, signDecision, sigFailMsg } from '../../App.jsx';
import { cloud, bfKey } from '../../storage';

export function Suppliers({ org, ops, me, myBranches, commit, commitOrg, say, setTab: goTab, billOnly }) {
  const [tab, setTab] = useState('inv');
  const [repOpen, setRepOpen] = useState(false);    // v9.4 قائمة تقارير التطبيق
  const [pay, setPay] = useState(null); const [pdn, setPdn] = useState(null); const [disc, setDisc] = useState('');   // v47.4 الإشعار المدين للمشتريات والخصم المكتسب
  const [amt, setAmt] = useState(0);
  const [payFund, setPayFund] = useState('1201');   // v15.19: مصدر السداد — بنك (افتراضي) أو خزينة رئيسية
  const [newInv, setNewInv] = useState(null);        // نموذج فاتورة توريد (م4)
  const [poF, setPoF] = useState(null);              // نموذج أمر شراء
  const [recv, setRecv] = useState(null);            // نموذج استلام أمر
  const [showPrices, setShowPrices] = useState(false);
  const [ret, setRet] = useState(null);              // v30.9 مرتجع لمورد
  const [qc, setQc] = useState(null);                // v43.5 فحص استلام
  const [cv, setCv] = useState(null);                // v43.5 تحويل الاستلامات المفحوصة إلى فاتورة
  const [svc, setSvc] = useState(null);              // v43.5 فاتورة خدمات ومصروفات
  const [fxPay, setFxPay] = useState({ fc: '', rate: '' });   // v43.9 سداد بعملة أجنبية
  const ids = myBranches.map(b => b.id);
  // v28.2: فواتير المركز (بلا فرع، ومنها المستوردة من ميزان) تظهر للأدوار المركزية
  const invoices = (ops.invoices || []).filter(i => ids.includes(i.branchId) || (!i.branchId && ROLES[me.role]?.scope !== 'own'))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const fixed = (ops.fixedExpenses || []).filter(f => ids.includes(f.branchId));
  const suppliers = org.suppliers || [];
  const canPay = ROLES[me.role]?.scope !== 'own';
  // v45.1: إضافة صنف من باركود غير معروف — للمركز فقط (كصلاحية نموذج الأصناف: نطاق الكل عدا مراقب التكاليف)
  const canAddItem = ROLES[me.role]?.scope === 'all' && !ROLES[me.role]?.costCtl;

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
  // v51.9: صلاحية تعديل/حذف الفواتير شخصية يحددها المسؤول (حسب الدور افتراضيًا)
  const canDelInv = (inv) => canEditRec(me, 'inv', inv);
  const delInv = async (inv) => {
    if (!canDelInv(inv)) return say('لا تملك صلاحية حذف هذه الفاتورة — يحددها مسؤول النظام لكل مستخدم', 'no');
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
    }), { actionType: 'delete', targetType: 'expense', targetId: inv.id, need: 'edit', perm: { kind: 'inv', rec: inv }, branchName: inv.branchName || '',
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
    const next = { approvalLimit: Math.max(0, Number(f.approvalLimit) || 0), priceAlertPct: Math.max(0, Number(f.priceAlertPct) || 0), perpetualFrom: f.perpetual ? (f.perpetualFrom || today().slice(0, 7)) : '', inspect: !!f.inspect, invVarPct: Math.max(0, Number(f.invVarPct) || 0), fx: !!f.fx,
      saleDeductFrom: f.perpetual && f.saleDeduct ? (f.saleDeductFrom || today()) : '' };   // v46.3
    if (next.saleDeductFrom) { const noWh = (org.branches || []).filter(b => b.isActive !== false && !whOf(org).some(w => w.kind === 'branch' && w.branchId === b.id && w.active !== false));
      if (noWh.length && !window.confirm('خصم المبيعات يتم من مستودع الفرع. هذه الفروع بلا مستودع فلن تُخصم مبيعاتها: ' + noWh.map(b => b.name).join('، ') + '\n\nمتابعة؟')) return; }
    const ok = await commitOrg(d => ({ ...d, purchaseCfg: { ...(d.purchaseCfg || {}), ...next } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'purchaseCfg', need: 'edit', title: 'إعدادات المشتريات والمخزون',
      details: 'حد الاعتماد ' + money(next.approvalLimit) + ' · تنبيه السعر ' + next.priceAlertPct + '% · الجرد المستمر ' + (next.perpetualFrom || 'موقوف') + ' · مسار الفحص ' + (next.inspect ? 'مفعّل (تسامح ' + next.invVarPct + '%)' : 'موقوف') + ' · خصم المبيعات من المخزون ' + (next.saleDeductFrom ? 'من ' + next.saleDeductFrom : 'موقوف') });
    if (ok) { setCfgF(null); say('حُفظت الإعدادات ✓'); }
  };
  const decidePo = async (p2, approve) => {
    if (approve && p2.priceAlert && p2.by === me.name && !ROLES[me.role]?.admin) return say('أمر بتنبيه سعر — يعتمده شخص غير منشئه', 'no');
    const note = approve ? '' : window.prompt('سبب رفض أمر الشراء ' + p2.poNo + ':'); if (!approve && note === null) return;
    // v49.5 — مسار الاعتماد المهيّأ: مستويات بالترتيب؛ الأمر يُفتح بعد آخر مستوى مطلوب
    const W = approve && wfOn(org, 'po') ? wfCanAct(org, 'po', p2, poTotal(p2), me) : null;
    if (W && !W.ok) return say(W.why, 'no');
    const sg = await signDecision('po', approve ? 'approve' : 'reject', p2, { branchId: '' });   // v40.0 توقيع موثّق
    if (!sg.ok) return say(sigFailMsg(sg, approve ? 'اعتماد أمر الشراء' : 'رفض أمر الشراء'), 'no');
    if (W && !W.last) {
      const ok = await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id && x.status === 'pending' ? wfApprove(x, W.tier, me) : x) }),
        { actionType: 'approve', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: 'اعتمد مستوى من أمر شراء — ' + W.tier.label, details: p2.poNo + ' · ' + money(poTotal(p2)) });
      if (ok) { const n = wfState(org, 'po', wfApprove(p2, W.tier, me), poTotal(p2)).next; say('اعتُمد «' + W.tier.label + '» ✓ — بانتظار «' + (n ? n.label : '') + '»'); } return;
    }
    await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id && x.status === 'pending' ? { ...(W ? wfApprove(x, W.tier, me) : x), ...(sg.id ? { sigDecide: sg.id } : {}), status: approve ? 'open' : 'rejected', decidedBy: me.name, decidedAt: nowISO(), ...(note ? { rejectNote: note } : {}) } : x) }),
      { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: (approve ? 'اعتمد' : 'رفض') + ' أمر شراء', details: p2.poNo + ' · ' + money(poTotal(p2)) + (note ? ' · ' + note : '') });
    say(approve ? 'اعتُمد أمر الشراء ✓' : 'رُفض أمر الشراء');
  };
  const items = org.items || [];
  const poTotal = (p2) => sum(p2.lines || [], l => (Number(l.qty) || 0) * (Number(l.price) || 0));
  const poRecvQty = (p2) => sum(p2.lines || [], l => Number(l.received) || 0);
  const remOfLine = (l) => Math.max(0, (Number(l.qty) || 0) - (Number(l.received) || 0) - (Number(l.inQc) || 0));   // v43.5: المتبقي = المطلوب − المقبول − قيد الفحص
  // v44.3 — استلامات الفروع المباشرة تُرحَّل تلقائيًا عند فتح المركز للمشتريات (الفرع لا يكتب المستند المركزي)
  const brRcvTried = useRef(new Set());
  const brRcvKey = (ops.poReceipts || []).filter(r => r.status === 'pending').map(r => r.id).join(',');
  // v44.3 (ث34): لا يُحوَّل طلب ولا يُرحَّل استلام إلا بتوقيع موثّق من مدير الفرع — حالة التوقيع لكل سجل معلّق
  const [brSig, setBrSig] = useState({});
  const brSigKey = [...(ops.purchaseReqs || []), ...(ops.poReceipts || [])].filter(x => x.status === 'pending').map(x => x.id + ':' + (x.sigSubmit || '')).join(',');
  useEffect(() => { if (!canPay || !brSigKey) return; let stop = false;
    (async () => { const out = {};
      for (const x of (ops.purchaseReqs || []).filter(y => y.status === 'pending')) out[x.id] = await brSigCheck('preq', x, me, ids);
      for (const x of (ops.poReceipts || []).filter(y => y.status === 'pending')) out[x.id] = await brSigCheck('prcv', x, me, ids);
      if (stop) return; setBrSig(out);
      for (const r of (ops.poReceipts || []).filter(x => x.status === 'pending')) { if (stop) return; if (out[r.id] !== 'ok' || brRcvTried.current.has(r.id)) continue; brRcvTried.current.add(r.id); await postBrRcv(r, true); } })();
    return () => { stop = true; }; }, [brSigKey]); // eslint-disable-line
  const SIG_WHY = { bad: 'بلا توقيع موثّق من مدير الفرع', wait: 'جارٍ التحقق من توقيع مدير الفرع' };
  const poAllRecv = (p2) => (p2.lines || []).every(l => (Number(l.received) || 0) >= (Number(l.qty) || 0));
  const nextPoNo = () => {
    let mx = 0;
    (ops.purchaseOrders || []).forEach(x => { const m2 = /(\d+)$/.exec(x.poNo || ''); if (m2) mx = Math.max(mx, +m2[1]); });
    return 'PO-' + String(mx + 1).padStart(4, '0');
  };

  // v44.1 — فاتورة توريد يدوية ببنود أصناف (قرار المالك): المخزني يدخل المستودع ويُحدّث تكلفته، والاستهلاكي والخدمي مصروف
  const invLine = () => ({ itemId: '', qty: '', price: '', uom: '' });
  // v47.8 — نسخة مطابقة من فاتورة مورد: نفس المورد والأصناف والكميات والأسعار والفرع/المستودع، بتاريخ اليوم ورقم جديد، تُراجع ثم تُحفظ
  const invToForm = (i) => { if (i.kind === 'svc') return null;
    const dd = (i.dueDate && i.date) ? Math.max(0, Math.round((new Date(i.dueDate) - new Date(String(i.date).slice(0, 10))) / 864e5)) : 0;
    const due = (() => { const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() + dd); return d.toISOString().slice(0, 10); })();
    return { supplierId: i.supplierId, invoiceNo: '', taxable: Math.abs(i.vatAmt || 0) > 0.004 || i.taxable === true, date: today(), dueDate: due, branchId: i.branchId || '', copyOf: i.id,
      ...(i.whId ? { whId: i.whId } : {}), ...(i.cur ? { cur: i.cur, rate: i.fxRate } : {}),
      lines: (i.lines || []).filter(l => l.itemId).map(l => { const q = Number(l.uomQty) || Number(l.qty) || 0; const base = l.fcNet != null ? l.fcNet : l.net;
        return { itemId: l.itemId, qty: String(q), price: q ? String(Math.round(base / q * 10000) / 10000) : '', uom: l.uomName || '', ...(l.note ? { note: l.note } : {}) }; }) }; };
  const svcToForm = (i) => ({ supplierId: i.supplierId, invoiceNo: '', date: today(), dueDate: today(), branchId: i.branchId || '', copyOf: i.id, ...(i.projectId ? { projectId: i.projectId } : {}), ...(i.cur ? { cur: i.cur, rate: i.fxRate } : {}),
    lines: (i.expLines || []).map(l => ({ desc: l.desc, accCode: l.accCode, net: String(l.fcNet != null ? l.fcNet : l.net), taxable: Math.abs(l.vat || 0) > 0.004 })) });
  // v51.9 — تعديل فاتورة مورد غير مسددة في فترة مفتوحة: تُستبدل بفاتورة مصحّحة (بنودها وحركاتها المخزنية)، ويبقى أصلها في سجل التدقيق
  const invEditable = (i) => i && i.source === 'stored' && i.kind !== 'svc' && !i.creditNote && !i.supDebit && !i.cur && i.amount > 0
    && !((i.paidAmount || 0) > 0) && !(branchPaid(i.id) > 0) && !periodLocked(org, String(i.date || '').slice(0, 10)) && canEditRec(me, 'inv', i);
  const editInv = (i) => { if (!invEditable(i)) return say('لا يمكن تعديل هذه الفاتورة (مسددة، أو فترة مقفلة، أو بلا صلاحية)', 'no');
    const f = invToForm(i); if (!f || !f.lines.length) return say('لا بنود أصناف في هذه الفاتورة لتعديلها', 'no');
    setNewInv({ ...f, copyOf: undefined, replaces: i.id, invoiceNo: i.invoiceNo || '', date: String(i.date || today()).slice(0, 10), dueDate: String(i.dueDate || i.date || today()).slice(0, 10) }); };
  const copyInv = (i) => { if (i.kind === 'svc') setSvc(svcToForm(i)); else { const f = invToForm(i); if (!f.lines.length) return say('لا بنود أصناف في هذه الفاتورة لنسخها', 'no'); setNewInv(f); } };
  const lastInvOf = (sid) => (ops.invoices || []).filter(i => i.supplierId === sid && !i.creditNote && !i.supDebit && i.kind !== 'svc' && (i.lines || []).some(l => l.itemId)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  // v46.0: الصنف بوحدة غير معتمدة يُحدَّد له وحدة في السطر (baseU) وتُحفظ في بطاقته؛ وسطر الفاتورة بأي وحدة من مجموعته أو وحدة الشراء
  const invItem = (l) => { const it = items.find(x => x.id === l.itemId); return it && l.baseU && !uomOk(it) ? { ...it, unit: l.baseU } : it; };
  const invCalc = (f) => { const r2 = (n) => Math.round(n * 100) / 100; const fxR = isFx(f.cur) ? Number(f.rate) || 0 : 1;
    const ls = (f.lines || []).map(l => { const it = invItem(l); const q = Number(l.qty) || 0, pr = Number(l.price) || 0; const fac = it ? lineFac(it, l.uom) : 1; return { l, it, q, pr, fac, fcNet: r2(q * pr), net: r2(q * pr * fxR) }; }).filter(x => x.it && x.q > 0);
    const fcNet = r2(sum(ls, x => x.fcNet)), net = r2(sum(ls, x => x.net)); const on = !!(org.taxCfg || {}).enabled && !!f.taxable; const rate = (Number((org.taxCfg || {}).rate) || 15) / 100;
    return { ls, fxR, fcNet, net, fcVat: on ? r2(fcNet * rate) : 0, vat: on ? r2(net * rate) : 0 }; };
  const saveInv = async () => {
    const f = newInv;
    const sp = (org.suppliers || []).find(x => x.id === f.supplierId);
    if (!sp) return say('اختر المورد', 'no');
    if ((f.lines || []).some(l => (Number(l.qty) > 0 || Number(l.price) > 0) && !l.itemId)) return say('اختر الصنف لكل بند من الأصناف المضافة', 'no');
    const noU = (f.lines || []).map(invItem).find(it => it && !uomOk(it));
    if (noU) return say('حدد وحدة الصنف «' + noU.name + '» (كيلو، جرام، لتر، حبة، كرتون…) — إلزامية في فواتير المشتريات', 'no');
    const k = invCalc(f);
    if (!k.ls.length || !(k.net > 0)) return say('أضف بندًا واحدًا على الأقل: صنف وكمية وسعر', 'no');
    if (isFx(f.cur) && !(k.fxR > 0)) return say('أدخل سعر صرف ' + f.cur + ' بالريال', 'no');
    if (periodLocked(org, f.date || today())) return say(LOCK_MSG(f.date || today()), 'no');
    const v = Math.round((k.net + k.vat) * 100) / 100;
    const br = org.branches.find(b => b.id === f.branchId);
    // v33.2: الرقم الآلي لا يتكرر حتى بعد حذف فواتير؛ ورقم المورد المكرر يُرفض قبل الحفظ
    const autoNo = () => { const pre = 'INV-' + today().replace(/-/g, '').slice(2) + '-'; let n = (ops.invoices || []).length + 1;
      while ((ops.invoices || []).some(i => i.invoiceNo === pre + String(n).padStart(3, '0'))) n++; return pre + String(n).padStart(3, '0'); };
    const typedNo = (f.invoiceNo || '').trim();
    const orig = f.replaces ? (ops.invoices || []).find(x => x.id === f.replaces) : null;
    if (f.replaces && !invEditable(orig)) return say('لا يمكن تعديل هذه الفاتورة (سُددت أو أُقفلت فترتها أو لا صلاحية)', 'no');
    if (typedNo) { const o = invNoTaken(sp.id, typedNo); if (o && (!orig || o.id !== orig.id)) return say('فاتورة مكررة: رقم ' + typedNo + ' للمورد «' + sp.name + '» مسجّل بتاريخ ' + (o.date || '') + ' بمبلغ ' + money(o.amount) + ' — لم يُحفظ', 'no'); }
    const twin = (ops.invoices || []).find(i => !i.creditNote && (!orig || i.id !== orig.id) && i.supplierId === sp.id && (i.date || '') === (f.date || today()) && Math.abs((i.amount || 0) - v) < 0.01);
    if (twin && !window.confirm('تنبيه: يوجد فاتورة للمورد نفسه بنفس التاريخ والمبلغ (' + money(v) + ') برقم ' + (twin.invoiceNo || '') + '.\nهل هذه فاتورة مختلفة فعلًا؟')) return;
    const py = payOf(f, Math.round((k.fcNet + k.fcVat) * 100) / 100, v, k.fxR, f.date || today()); if (py.err) return say(py.err, 'no');
    if (!(await ensureVat(sp.id, k.vat, f.vatNo))) return;
    const rDate = f.date || today(); const wid = whOn(org) ? (f.whId || MAIN_WH) : ''; const tw = wid ? whOf(org).find(w => w.id === wid) : null;
    const invId = uid('inv'), no = typedNo || autoNo();
    // v46.0: وحدات الأصناف التي حُدّدت في السطر تُحفظ في بطاقاتها أولًا (مرة واحدة)
    const fixU = {}; (f.lines || []).forEach(l => { const it = items.find(x => x.id === l.itemId); if (it && l.baseU && !uomOk(it)) fixU[it.id] = l.baseU; });
    if (Object.keys(fixU).length) {
      const okU = await commitOrg(d => ({ ...d, items: (d.items || []).map(x => fixU[x.id] ? { ...x, unit: fixU[x.id] } : x) }), { actionType: 'update', targetType: 'stock_item', targetId: Object.keys(fixU).join(','),
        title: 'حدّد وحدة أصناف من فاتورة شراء', details: Object.keys(fixU).map(id => ((items.find(x => x.id === id) || {}).name || '') + ' ← ' + fixU[id]).join('، ') });
      if (okU === false) return;
    }
    const lines = k.ls.map(x => ({ itemId: x.it.id, desc: x.it.name, qty: Math.round(x.q * x.fac * 1000) / 1000, unitCost: Math.round(x.pr * k.fxR / x.fac * 10000) / 10000, net: x.net,
      ...(x.fac !== 1 ? { uomName: x.l.uom, uomQty: x.q } : {}), stock: isStocked(x.it), ...(isFx(f.cur) ? { fcNet: x.fcNet } : {}), ...(String(x.l.note || '').trim() ? { note: String(x.l.note).trim() } : {}) }));
    const moves = lines.filter(l => l.stock).map(l => ({ id: uid('sm'), date: rDate, itemId: l.itemId, kind: 'purchase', qty: l.qty, unitCost: l.unitCost, note: 'فاتورة ' + no + ' — ' + l.desc, ref: no, by: me.name, at: nowISO(), invoiceId: invId,
      ...(wid ? { whId: wid } : {}), ...(tw && tw.kind === 'branch' ? { branchId: tw.branchId } : {}) }));
    const docId = await archiveImg(f.img, { branchId: f.branchId, title: 'فاتورة مورد ' + no + ' — ' + sp.name, amount: v, ref: no });
    const rec = { id: invId, supplierId: sp.id, supplierName: sp.name, branchId: f.branchId || (tw && tw.branchId) || '', branchName: br ? br.name : 'المركز الرئيسي', invoiceNo: no,
      amount: v, vatAmt: k.vat, taxable: k.vat > 0, paidAmount: py.paidAmount, pm: py.pm, ...(py.payments.length ? { payments: py.payments } : {}), date: rDate, dueDate: f.dueDate || rDate, createdAt: nowISO(), lines, ...(wid ? { whId: wid } : {}), ...(docId ? { docId } : {}),
      ...(isFx(f.cur) ? { cur: f.cur, fxRate: k.fxR, fcAmount: Math.round((k.fcNet + k.fcVat) * 100) / 100 } : {}) };
    const brMoves = moves.filter(m => m.branchId), mainMoves = moves.filter(m => !m.branchId);
    if (orig) rec.replaces = orig.id;
    const dropOld = (arr) => orig ? (arr || []).filter(x => x.id !== orig.id && x.invoiceId !== orig.id) : (arr || []);
    const ok = await commit(d => ({ ...d, invoices: [rec, ...dropOld(d.invoices)], whMoves: [...brMoves, ...dropOld(d.whMoves)], stockMoves: [...mainMoves, ...dropOld(d.stockMoves)] }), {
      actionType: orig ? 'update' : 'create', targetType: 'expense', targetId: rec.id, branchName: rec.branchName,
      title: 'سجّل فاتورة توريد آجلة', details: sp.name + ' · ' + rec.invoiceNo + ' · ' + lines.length + ' بند · ' + money(v) + (rec.cur ? ' (' + rec.fcAmount + ' ' + rec.cur + ' @ ' + k.fxR + ')' : '') + (rec.taxable ? ' · خاضعة للضريبة' : '') + (moves.length ? ' · دخل المخزون' : '') + ' · ' + PM_AR[py.pm] + (py.paidAmount ? ' ' + money(py.paidAmount) : ''),
      // v51.9: التعديل — العنوان والتفاصيل بنسخة من الأصل
      ...(orig ? { perm: { kind: 'inv', rec: orig }, actionType: 'update', title: 'عدّل فاتورة مورد', details: (orig.invoiceNo || '') + ' · ' + money(orig.amount) + ' ← ' + money(v) + ' · الأصل: ' + JSON.stringify({ id: orig.id, invoiceNo: orig.invoiceNo, amount: orig.amount, vatAmt: orig.vatAmt, date: orig.date, lines: (orig.lines || []).length }) } : {}),
    });
    if (ok === false) return;
    setNewInv(null); if (orig) return say('عُدّلت الفاتورة ' + rec.invoiceNo + ' ✓ — الأصل محفوظ في سجل التدقيق');
    say('سُجّلت الفاتورة ' + rec.invoiceNo + (moves.length ? ' ودخلت أصنافها المخزنية ' + (wid ? whName(org, wid) : 'المخزون') : '') + ' — ' + PM_AR[py.pm] + (py.paidAmount ? ' ' + money(py.paidAmount) + ' ر.س' + (py.paidAmount < v - 0.004 ? ' والباقي آجل' : '') : '') + ' ✓');
  };

  const savePo = async () => {
    const f = poF;
    const sp = (org.suppliers || []).find(x => x.id === f.supplierId);
    if (!sp) return say('اختر المورد', 'no');
    // v44.1: كل بند يُختار من الأصناف المضافة (قرار المالك) — لا بنود حرة
    if ((f.lines || []).some(l => Number(l.qty) > 0 && !l.itemId)) return say('اختر الصنف لكل بند من الأصناف المضافة', 'no');
    const lines = (f.lines || []).filter(l => l.itemId && Number(l.qty) > 0).map(l => ({ ...l, desc: (l.desc || '').trim() || ((items.find(x => x.id === l.itemId) || {}).name || '') }))
      .map(l => { const it = items.find(x => x.id === l.itemId); const fac = it && l.uom === 'p' ? pFactor(it) : 1;
        const w = priceWarn(l);
        return { desc: l.desc.trim(), itemId: l.itemId || '', qty: Number(l.qty), price: Number(l.price) || 0, received: 0, ...(String(l.note || '').trim() ? { note: String(l.note).trim() } : {}), ...(fac > 1 ? { factor: fac, uomName: it.purchaseUnit } : {}),
          ...(w && w.high ? { pAlert: { avg3: w.avg, n: w.n, unit: Math.round(w.u * 10000) / 10000, pct: w.pct } } : {}) }; });
    if (!lines.length) return say('أضف بنداً واحداً على الأقل (وصف وكمية)', 'no');
    const tot0 = lines.reduce((s2, l) => s2 + l.qty * l.price, 0);
    const hiPrice = lines.filter(l => l.pAlert).length;
    // v37.7: بند بسعر أعلى من متوسط آخر 3 مشتريات بأكثر من الحد ⇒ الأمر يحتاج اعتمادًا ولو كان تحت حد القيمة
    const needAppr = poNeedsAppr(org, tot0) || hiPrice > 0;   // v49.5: المسار المهيّأ أو حد الاعتماد
    // v44.3: مستودع الأمر (المستلِم) يُحدَّد عند الإنشاء — والفرع يُشتق منه؛ الاستلام فيه فقط
    const poWid = whOn(org) ? (f.whId || MAIN_WH) : ''; const poTw = poWid ? whOf(org).find(w => w.id === poWid) : null;
    if (poWid && !poTw && poWid !== MAIN_WH) return say('اختر المستودع المستلِم', 'no');
    const req0 = f.reqId ? (ops.purchaseReqs || []).find(r => r.id === f.reqId) : null;
    if (f.reqId && (!req0 || req0.status !== 'pending')) return say('طلب الشراء لم يعد قائمًا', 'no');
    if (req0 && (await brSigCheck('preq', req0, me, ids)) !== 'ok') return say('لا يُحوَّل: الطلب بلا توقيع موثّق من مدير الفرع', 'no');
    let rec = { id: uid('po'), poNo: nextPoNo(), supplierId: sp.id, supplierName: sp.name,
      branchId: (poTw && poTw.kind === 'branch' ? poTw.branchId : '') || f.branchId || '', ...(poWid ? { whId: poWid } : {}), ...(req0 ? { reqId: req0.id, reqNo: req0.no } : {}), note: f.note || '', lines, status: needAppr ? 'pending' : 'open', by: me.name, at: nowISO(), date: today(), ...(hiPrice ? { priceAlert: hiPrice } : {}) };
    // v40.0: أمر بانتظار الاعتماد يُوقَّع تقديمه — مع تنبيه السعر لا يعتمده منشئه (إلا المدير)، والقواعد تفرض ذلك
    if (needAppr) { const sg = await signoff('po', 'submit', rec, { branchId: '', alert: hiPrice > 0 }); if (!sg.ok) return say(sigFailMsg(sg, 'أمر الشراء'), 'no'); if (sg.id) rec = { ...rec, sigSubmit: sg.id }; }
    const okPo = await commit(d => ({ ...d, purchaseOrders: [rec, ...(d.purchaseOrders || [])],
      ...(req0 ? { purchaseReqs: (d.purchaseReqs || []).map(r => r.id === req0.id && r.status === 'pending' ? { ...r, status: 'converted', poId: rec.id, poNo: rec.poNo, supplierName: sp.name, decidedBy: me.name, decidedAt: nowISO() } : r) } : {}) }), {
      actionType: 'create', targetType: 'purchase_order', targetId: rec.id,
      title: 'أنشأ أمر شراء', details: rec.poNo + ' · ' + sp.name + ' · ' + money(poTotal(rec)) + (poWid ? ' · ' + whName(org, poWid) : '') + (req0 ? ' · من طلب ' + req0.no : '')
    });
    if (okPo === false) return;
    setPoF(null); say('أُنشئ أمر الشراء ' + rec.poNo + (needAppr ? ' — بانتظار الاعتماد (' + (hiPrice ? hiPrice + ' بند بسعر أعلى من متوسط آخر 3 مشتريات بأكثر من ' + alertPct + '%' : 'يتجاوز ' + money(apprLimit)) + ')' : '') + ' ✓');
  };

  // v8.2: طباعة أمر شراء كوثيقة تُرسل للمورد
  const printPO = (p2) => {
    const rows = (p2.lines || []).map((l, i) => `<tr><td class="n">${i + 1}</td><td>${_xe(l.desc)}${l.note ? '<div style="font-size:9.5pt;color:#555">ملاحظة: ' + _xe(l.note) + '</div>' : ''}</td><td class="n">${l.qty}</td><td class="n">${money(l.price)}</td><td class="n">${money((l.qty || 0) * (l.price || 0))}</td></tr>`).join('');
    printA4(org, 'أمر شراء ' + p2.poNo, arDate(p2.date || today()) + (whOn(org) ? ' · التسليم: ' + whName(org, poWhOf(org, p2)) : p2.branchId ? ' · ' + ((org.branches.find(b => b.id === p2.branchId) || {}).name || '') : ' · المركز الرئيسي'),
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
    const wid = whOn(org) ? poWhOf(org, p2) : '';   // v44.3: الاستلام في مستودع الأمر فقط (قرار المالك)
    const tw = wid ? whOf(org).find(w => w.id === wid) : null;
    const rDate = (f.date || today()).slice(0, 10);
    if (periodLocked(org, rDate)) return say(LOCK_MSG(rDate), 'no');
    const takes = p2.lines.map((l, i) => Math.min(Math.max(Number(f.qtys[i]) || 0, 0), remOfLine(l)));
    if (!takes.some(q => q > 0)) return say('أدخل كمية مستلمة لبند واحد على الأقل', 'no');
    if (inspectOn) return saveGrn(p2, takes, wid, tw, rDate, f);   // v43.5: الاستلام بانتظار الفحص — لا مخزون ولا فاتورة بعد
    // v44.0: الاستلام العادي يُنشئ الفاتورة تلقائيًا فقط عند المطابقة الكاملة ومعه رقم فاتورة المورد؛ وإلا «مستلم لم يُفوتر» بقيد وسيط
    const supNo0 = String(f.supInvNo || '').trim();
    // v44.1: المطابقة للكميات والمبلغ — مبلغ فاتورة المورد (شامل الضريبة) = قيمة الأمر للمستلم + ضريبته، وللفاتورة الضريبية مورد برقم ضريبي
    const expAmt = rcvExpected(p2, (i) => takes[i], f.taxable !== false);
    const supAmt0 = Number(f.supInvAmt) || 0;
    const amtOk = supAmt0 > 0 && Math.abs(supAmt0 - expAmt.gross) <= 0.01;
    const vatOk = !needVat(p2.supplierId, expAmt.vat);
    const matched = fullMatch(p2, (i) => takes[i]) && !!supNo0 && !invNoTaken(p2.supplierId, supNo0) && amtOk && vatOk;
    const whyNot = !supNo0 ? 'بلا رقم فاتورة المورد' : !fullMatch(p2, (i) => takes[i]) ? 'استلام جزئي' : invNoTaken(p2.supplierId, supNo0) ? 'رقم فاتورة مكرر' : !amtOk ? 'مبلغ الفاتورة ' + money(supAmt0) + ' لا يطابق ' + money(expAmt.gross) : 'المورد بلا رقم ضريبي';
    const docId0 = await archiveImg(f.img, { branchId: (tw && tw.branchId) || p2.branchId || '', title: 'فاتورة مورد ' + (supNo0 || p2.poNo) + ' — ' + p2.supplierName, amount: supAmt0, ref: supNo0 || p2.poNo });
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
    const invRec = invNet > 0 && matched ? { id: invId, invoiceNo: (f.supInvNo || '').trim() || grn, supplierId: p2.supplierId, supplierName: p2.supplierName, amount: Math.round((invNet + vat) * 100) / 100, vatAmt: vat, taxable: taxOn,
      date: rDate, dueDate: due, paidAmount: 0, branchId: (tw && tw.branchId) || p2.branchId || '', poId: p2.id, poNo: p2.poNo, grn, whId: wid, lines: invLines, by: me.name, createdAt: nowISO(), auto: 'match', ...(docId0 ? { docId: docId0 } : {}) } : null;
    // غير مطابق: الحركات تُربط بسجل استلام (GRN) بلا فاتورة — تظهر «مستلم لم يُفوتر» ويحوّلها المحاسب أو مدير النظام
    const gid = uid('grn');
    const gRec = matched ? null : { id: gid, grn, date: rDate, whId: wid, branchId: (tw && tw.branchId) || '', supplierId: p2.supplierId, status: 'done', direct: true, by: me.name, byEmail: me.email || '', at: nowISO(),
      supInvNo: supNo0, supInvAmt: supAmt0, whyNot, taxable: f.taxable !== false, ...(docId0 ? { docId: docId0 } : {}),
      lines: p2.lines.map((l, i) => takes[i] > 0 ? { li: i, itemId: l.itemId || '', desc: l.desc, ...(l.note ? { note: l.note } : {}), qty: takes[i], factor: Number(l.factor) || 1, uomName: l.uomName || '', price: Number(l.price) || 0 } : null).filter(Boolean) };
    if (gRec) gRec.qc = { by: me.name, at: nowISO(), date: rDate, direct: true, lines: gRec.lines.map(l => ({ acc: l.qty, rej: 0, why: '' })) };
    const moves2 = matched ? moves : moves.map(({ invoiceId, ...m }) => ({ ...m, grnRef: gid }));
    const brMoves = moves2.filter(m => m.branchId), mainMoves = moves2.filter(m => !m.branchId);
    await commit(d => ({
      ...d,
      invoices: invRec && !(d.invoices || []).some(x => x.id === invRec.id) ? [invRec, ...(d.invoices || [])] : (d.invoices || []),
      whMoves: [...brMoves.filter(m => !(d.whMoves || []).some(x => x.id === m.id)), ...(d.whMoves || [])],
      stockMoves: [...mainMoves.filter(m => !(d.stockMoves || []).some(x => x.id === m.id)), ...(d.stockMoves || [])],
      purchaseOrders: (d.purchaseOrders || []).map(x => {
        if (x.id !== p2.id) return x;
        const lines = x.lines.map((l, i) => ({ ...l, received: (l.received || 0) + takes[i] }));
        return { ...x, lines, status: lines.every(l => l.received >= l.qty) ? 'received' : 'partial', ...(invRec ? { invoiceId: x.invoiceId || invRec.id, invoiceIds: [...(x.invoiceIds || []), invRec.id] } : {}), ...(gRec ? { grns: [...(x.grns || []), gRec] } : {}) };
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
    setRecv(null); say('سُجّل الاستلام' + (moves.length ? ' في ' + (wid ? whName(org, wid) : 'المخزون') : '') + (invRec ? ' — مطابق: أُنشئت فاتورة المورد ' + invRec.invoiceNo + ' بـ ' + money(invRec.amount) : ' — غير مطابق آليًا (' + whyNot + '): يحوّله المحاسب أو مدير النظام لفاتورة') + ' ✓');
  };

  // ===== v44.3 — استلام مدير الفرع لأمر شراء موجّه لمستودع فرعه (poReceipts في مستند الفرع) =====
  // الفرع أدخل الأصناف مستودعه (بقيد «بضاعة مستلمة لم تُفوتر» بسعر الأمر) أو أرسلها للفحص؛ هنا تُحدَّث كميات الأمر،
  // وتُنشأ فاتورة المورد تلقائيًا عند المطابقة الكاملة (الكميات والمبلغ والرقم الضريبي)، وإلا تبقى «مستلم لم يُفوتر» يحوّلها المحاسب أو مدير النظام.
  const brRcvWhy = (r, sigOk) => { const p2 = (ops.purchaseOrders || []).find(x => x.id === r.poId);
    if (!p2) return 'أمر الشراء غير موجود'; if (!['open', 'partial'].includes(p2.status)) return 'أمر الشراء ليس قيد التوريد';
    if (periodLocked(org, r.date)) return 'الشهر مقفل محاسبيًا'; return sigOk || brSig[r.id] === 'ok' ? '' : SIG_WHY[brSig[r.id] || 'wait']; };
  const postBrRcv = async (r, auto) => {
    const why0 = brRcvWhy(r, auto);   // التلقائي يُستدعى بعد التحقق من التوقيع if (why0) { if (!auto) say('تعذّر الترحيل: ' + why0, 'no'); return false; }
    const p2 = (ops.purchaseOrders || []).find(x => x.id === r.poId);
    const lines = (r.lines || []).filter(l => p2.lines[l.li] && (Number(l.qty) || 0) > 0).map(l => { const pl = p2.lines[l.li];
      return { li: l.li, itemId: pl.itemId || '', desc: pl.desc, ...(pl.note ? { note: pl.note } : {}), qty: Math.min(q3(l.qty), remOfLine(pl)), factor: Number(pl.factor) || 1, uomName: pl.uomName || '', price: Number(pl.price) || 0 }; }).filter(l => l.qty > 0);
    const takes = p2.lines.map((_, i) => sum(lines.filter(l => l.li === i), l => l.qty));
    const rDate = String(r.date || today()).slice(0, 10);
    const supNo = String(r.supInvNo || '').trim(), supAmt = Number(r.supInvAmt) || 0;
    let g = { id: r.id, grn: r.no, date: rDate, whId: r.whId, branchId: r.branchId || '', supplierId: p2.supplierId, lines, by: r.by || '', byEmail: r.byEmail || '', at: r.at || nowISO(), branchRcv: true,
      supInvNo: supNo, supInvAmt: supAmt, taxable: r.taxable !== false, ...(r.docId ? { docId: r.docId } : {}), ...(r.grnSig ? { sigSubmit: r.grnSig } : {}) };
    let inv = null, res = 'qc', whyNot = '';
    if (!inspectOn) {
      const exp = rcvExpected(p2, (i) => takes[i], r.taxable !== false);
      const amtOk = supAmt > 0 && Math.abs(supAmt - exp.gross) <= 0.01, fm = fullMatch(p2, (i) => takes[i]);
      const matched = fm && !!supNo && !invNoTaken(p2.supplierId, supNo) && amtOk && !needVat(p2.supplierId, exp.vat);
      whyNot = matched ? '' : !supNo ? 'بلا رقم فاتورة المورد' : !fm ? 'استلام جزئي' : invNoTaken(p2.supplierId, supNo) ? 'رقم فاتورة مكرر' : !amtOk ? 'مبلغ الفاتورة ' + money(supAmt) + ' لا يطابق ' + money(exp.gross) : 'المورد بلا رقم ضريبي';
      g = { ...g, status: 'done', direct: true, ...(whyNot ? { whyNot } : {}), qc: { by: g.by, at: g.at, date: rDate, direct: true, lines: lines.map(l => ({ acc: l.qty, rej: 0, why: '' })) } };
      if (matched) {
        inv = invFromCv({ rows: lines.map((l, k) => ({ g: g.id, grn: g.grn, k, itemId: l.itemId, desc: l.desc, note: l.note || '', qty: l.qty, factor: l.factor, poPrice: l.price, price: String(l.price), whId: g.whId, branchId: g.branchId })),
          supInvNo: supNo, date: rDate, dueDate: dueOf(p2.supplierId, rDate), taxable: !!(org.taxCfg || {}).enabled && r.taxable !== false }, p2);
        inv = { ...inv, id: 'inv_' + r.id, auto: 'match', ...(r.docId ? { docId: r.docId } : {}) }; g.invoiceId = inv.id;
      }
      res = matched ? 'matched' : 'unbilled';
    } else g = { ...g, status: 'qc' };
    const ok = await commit(d => {
      const cur = (d.poReceipts || []).find(x => x.id === r.id); const po = (d.purchaseOrders || []).find(x => x.id === p2.id);
      if (!cur || cur.status !== 'pending' || !po || (po.grns || []).some(y => y.id === g.id)) return d;
      return { ...d,
        ...(inv ? { invoices: (d.invoices || []).some(x => x.id === inv.id) ? (d.invoices || []) : [inv, ...(d.invoices || [])] } : {}),
        purchaseOrders: (d.purchaseOrders || []).map(x => { if (x.id !== p2.id) return x;
          if (inspectOn) return { ...x, grns: [...(x.grns || []), g], status: x.status === 'open' ? 'partial' : x.status, lines: x.lines.map((l, i) => ({ ...l, inQc: q3((Number(l.inQc) || 0) + (takes[i] || 0)) })) };
          const ls = x.lines.map((l, i) => ({ ...l, received: q3((Number(l.received) || 0) + (takes[i] || 0)) }));
          return { ...x, lines: ls, status: ls.every(l => (Number(l.received) || 0) >= (Number(l.qty) || 0)) ? 'received' : 'partial', grns: [...(x.grns || []), g],
            ...(inv ? { invoiceId: x.invoiceId || inv.id, invoiceIds: [...new Set([...(x.invoiceIds || []), inv.id])] } : {}) }; }),
        // v44.3: الفرع لا يرى الأسعار — حركات استلامه تأخذ تكلفة الوحدة من سعر الأمر عند الترحيل
        whMoves: (d.whMoves || []).map(m => { if (m.grnRef !== r.id || m.kind !== 'purchase' || m.unitCost != null) return m; const l = lines.find(x => x.itemId === m.itemId); return l ? { ...m, unitCost: Math.round(l.price / (l.factor || 1) * 10000) / 10000 } : m; }),
        poReceipts: (d.poReceipts || []).map(x => x.id === r.id ? { ...x, status: 'posted', result: res, postedBy: me.name, postedAt: nowISO(), ...(whyNot ? { whyNot } : {}), ...(inv ? { invoiceId: inv.id, invoiceNo: inv.invoiceNo } : {}) } : x) };
    }, { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, branchName: whName(org, r.whId), title: 'رحّل استلام فرع لأمر شراء',
      details: p2.poNo + ' · ' + r.no + ' · ' + (res === 'matched' ? 'مطابق — فاتورة ' + supNo : res === 'qc' ? 'بانتظار الفحص' : 'غير مطابق (' + whyNot + ')') });
    if (ok === false) return false;
    if (!auto) say('رُحّل الاستلام ' + r.no + ' ✓');
    return true;
  };
  // v44.3 — طلبات شراء الفروع: يراجعها المركز ويحوّلها لأمر شراء (المورد والسعر) موجّه لمستودع الفرع، أو يرفضها بسبب
  const reqsPending = (ops.purchaseReqs || []).filter(r => r.status === 'pending').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const reqToPo = (r) => brSig[r.id] !== 'ok' ? say('لا يُحوَّل: ' + SIG_WHY[brSig[r.id] || 'wait'], 'no') : setPoF({ supplierId: suppliers[0]?.id || '', branchId: r.branchId || '', whId: r.whId || MAIN_WH, reqId: r.id, note: 'طلب ' + r.no + (r.note ? ' — ' + r.note : ''),
    lines: (r.lines || []).map(l => ({ itemId: l.itemId, desc: (items.find(x => x.id === l.itemId) || {}).name || '', qty: String(l.qty), price: '', uom: 'b', ...(l.note ? { note: l.note } : {}) })) });
  const rejectReq = async (r) => {
    const why = window.prompt('رفض طلب الشراء ' + r.no + ' — السبب (يظهر للفرع):'); if (why === null) return; if (!why.trim()) return say('اكتب سبب الرفض', 'no');
    const ok = await commit(d => ({ ...d, purchaseReqs: (d.purchaseReqs || []).map(x => x.id === r.id && x.status === 'pending' ? { ...x, status: 'rejected', rejectNote: why.trim(), decidedBy: me.name, decidedAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'purchase_order', targetId: r.id, branchName: whName(org, r.whId), title: 'رفض طلب شراء فرع', details: r.no + ' · ' + why.trim() });
    if (ok !== false) say('رُفض الطلب ' + r.no + ' ✓');
  };

  // ===== v43.5 — مسار الفحص (org.purchaseCfg.inspect، مُطفأ افتراضيًا): استلام ← فحص بشخص غير المستلم ← مخزون ← تحويل لفاتورة =====
  // قرارات المالك: المقبول وحده يدخل المستودع (بسعر الأمر مقابل «بضاعة مستلمة لم تُفوتر» في الجرد المستمر)، والمرفوض يبقى مطلوبًا من المورد،
  // والفاتورة بسعر المورد: ضمن التسامح (الافتراضي 2% على الإجمالي) تُقيَّد مباشرة، وفوقه تنتظر اعتماد شخص آخر؛ والفرق إلى «فروق أسعار الشراء».
  const inspectOn = !!pcfg.inspect;
  // v43.9 — تعدد العملات لفواتير الموردين (purchaseCfg.fx، مُطفأ افتراضيًا): المبالغ تُدخل بعملة الفاتورة وسعر صرفها يدويًا، وتُحفظ بالريال للدفاتر
  const fxOn = !!pcfg.fx;
  const CURS = ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'JOD', 'TRY', 'CNY', 'INR'];
  const isFx = (c) => !!c && c !== 'SAR';
  const fxPaidFc = (i) => sum(Array.isArray(i.payments) ? i.payments : [], p => Number(p.fc) || 0);
  const fxRemFc = (i) => Math.max(0, Math.round(((Number(i.fcAmount) || 0) - fxPaidFc(i)) * 100) / 100);
  const lastRate = (cur) => { const r = (ops.invoices || []).filter(i => i.cur === cur && i.fxRate > 0).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]; return r ? String(r.fxRate) : ''; };
  const varTol = pcfg.invVarPct != null && pcfg.invVarPct !== '' ? Math.max(0, Number(pcfg.invVarPct) || 0) : 2;
  const canInspect = rolePost(me.role);
  // v44.0 — المطابقة الثلاثية (قرار المالك): الاستلام يتحوّل لفاتورة تلقائيًا فقط إذا استُلمت كل بنود الأمر بكمياتها كاملة دفعةً واحدة
  // بسعر الأمر وبلا رفض، ومعه رقم فاتورة المورد غير مكرر؛ وإلا يبقى «مستلمًا لم يُفوتر» يحوّله المحاسب أو مدير النظام فقط
  const canBill = INV_BILLERS.includes(me.role);
  const invNoTaken = (supplierId, no) => { const k0 = purKey({ supplierId, invoiceNo: no }); return (ops.invoices || []).find(i => purKey(i) === k0) || null; };
  const rcvExpected = (p2, qtyOf, taxable) => { const r2 = (n) => Math.round(n * 100) / 100; const net = r2(sum((p2.lines || []).map((l, i) => (qtyOf(i) || 0) * (Number(l.price) || 0)), x => x));
    const vat = (org.taxCfg || {}).enabled && taxable ? r2(net * ((Number((org.taxCfg || {}).rate) || 15) / 100)) : 0; return { net, vat, gross: r2(net + vat) }; };
  const fullMatch = (p2, accOf) => (p2.lines || []).length > 0 && p2.lines.every((l, i) => !(Number(l.received) || 0) && Math.abs((accOf(i) || 0) - (Number(l.qty) || 0)) < 0.0005);
  // v44.1 — الرقم الضريبي للمورد إلزامي للفاتورة الضريبية (قرار المالك): يُدخل في النافذة نفسها إن نقص ويُحفظ في بطاقة المورد
  const needVat = (supplierId, vat) => vat > 0.004 && !vatNoOk(supVatOf(org, supplierId));
  const ensureVat = async (supplierId, vat, typed) => {
    if (!needVat(supplierId, vat)) return true;
    const v = String(typed || '').replace(/\s/g, '');
    if (!vatNoOk(v)) { say('فاتورة ضريبية: أدخل الرقم الضريبي للمورد (15 رقمًا يبدأ وينتهي بـ 3) — أو اجعلها غير خاضعة', 'no'); return false; }
    const ok = await commitOrg(d => ({ ...d, suppliers: (d.suppliers || []).map(x => x.id === supplierId ? { ...x, vatNo: v } : x) }), { actionType: 'update', targetType: 'partner', targetId: supplierId, title: 'أضاف الرقم الضريبي لمورد', details: v });
    return ok !== false;
  };
  const VatNoField = ({ supplierId, vat, value, onChange }) => needVat(supplierId, vat) ? (
    <Field label="الرقم الضريبي للمورد (إلزامي للفاتورة الضريبية)"><input className="inp num" aria-label="الرقم الضريبي للمورد" value={value || ''} placeholder="3XXXXXXXXXXXXX3" onChange={e => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 15))} />
      <div className="hint" style={{ color: vatNoOk(value) ? 'var(--mint)' : 'var(--rose)' }}>{vatNoOk(value) ? '✓ يُحفظ في بطاقة المورد' : 'المورد بلا رقم ضريبي مسجّل — 15 رقمًا يبدأ وينتهي بـ 3'}</div></Field>) : null;
  // v44.1 — صورة فاتورة المورد (اختيارية): تُضغط وتُحفظ في «أرشيف المستندات» وتُربط بالفاتورة
  const compressImg = (file) => new Promise((resolve, reject) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const mx = 1100; const sc = Math.min(1, mx / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.66)); }; img.onerror = reject; img.src = String(rd.result); }; rd.onerror = reject; rd.readAsDataURL(file); });
  const archiveImg = async (img, meta) => { if (!img) return null; const key = bfKey(meta.branchId || 'hq'); const d = (await cloud.get(key, { items: [] })) || { items: [] };
    const rec = { id: uid('fl'), title: meta.title, category: 'receipt', branchId: meta.branchId || '', fileUrl: img.url, fileType: 'image', fileName: img.name || 'invoice.jpg', fileSizeKb: Math.round(img.url.length * 0.75 / 1024), uploadDate: today(), uploadedBy: me.name, amount: meta.amount || 0, referenceNo: meta.ref || '', notes: 'فاتورة مورد', source: 'supplier-invoice', uploadedAt: nowISO() };
    const ok = await cloud.set(key, { ...d, items: [rec, ...(d.items || [])] }); if (!ok) { say('تعذّر حفظ صورة الفاتورة في الأرشيف — حُفظت الفاتورة بدونها', 'no'); return null; } return rec.id; };
  const ImgField = ({ img, onImg }) => (
    <div className="row" style={{ gap: 8, alignItems: 'center', margin: '6px 0' }} data-imgfield>
      <label className="btn sm gh" style={{ cursor: 'pointer' }}>📎 صورة فاتورة المورد (اختياري)<input type="file" accept="image/*" style={{ display: 'none' }} aria-label="صورة فاتورة المورد"
        onChange={async e => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (!fl) return; if (!fl.type.startsWith('image/')) return say('صورة فقط', 'no'); try { onImg({ url: await compressImg(fl), name: fl.name }); } catch { say('تعذّرت معالجة الصورة', 'no'); } }} /></label>
      {img && <><img src={img.url} alt="" style={{ height: 40, borderRadius: 6, border: '1px solid var(--line)' }} /><button className="btn sm gh" onClick={() => onImg(null)} title="إزالة الصورة"><X size={12} /></button></>}
    </div>);
  // v44.2 — طريقة الدفع إلزامية عند تسجيل فاتورة المورد (قرار المالك): آجل · نقدًا من الخزينة · تحويل بنكي · شيك؛ الدفع الفوري يُسجَّل دفعةً (جزئيًا مسموح والباقي آجل)
  const PMS = [['credit', 'آجل'], ['cash', 'نقدًا من الخزينة'], ['bank', 'تحويل بنكي'], ['cheque', 'شيك']];
  const PM_AR = Object.fromEntries(PMS);
  const PayBox = (f, set, gross, cur) => (
    <div className="card" style={{ padding: 10, margin: '8px 0', background: 'var(--ink2)' }} data-paybox>
      <div className="lbl" style={{ marginBottom: 6 }}>طريقة الدفع (إلزامي)</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{PMS.map(([k, t]) => <button key={k} type="button" data-pm={k} className={'btn sm' + (f.pm === k ? ' pri' : ' gh')} onClick={() => set(x => ({ ...x, pm: k, payAmt: x.payAmt != null && x.payAmt !== '' ? x.payAmt : '', payFund: x.payFund || (k === 'cash' ? '1101' : '1201') }))}>{t}</button>)}</div>
      {f.pm && f.pm !== 'credit' && <div className="grid g3" style={{ marginTop: 8 }}>
        <Field label={'المبلغ المدفوع الآن' + (isFx(cur) ? ' (' + cur + ')' : '')}><input className="inp n" inputMode="decimal" aria-label="المبلغ المدفوع" placeholder={money(gross)} value={f.payAmt ?? ''} onChange={e => set(x => ({ ...x, payAmt: e.target.value.replace(/[^\d.]/g, '') }))} />
          <div className="hint">فارغ = كامل الفاتورة <span className="num">{money(gross)}</span> · الأقل منه يبقى باقيه آجلًا</div></Field>
        {f.pm !== 'cash' && <Field label="من حساب"><select className="sel" aria-label="حساب الدفع" value={f.payFund || '1201'} onChange={e => set(x => ({ ...x, payFund: e.target.value }))}><option value="1201">البنك التجميعي</option>{branchBanks(org).map(bb => <option key={bb.code} value={bb.code}>{bb.name}</option>)}</select></Field>}
        {f.pm !== 'cash' && <Field label={f.pm === 'cheque' ? 'رقم الشيك (إلزامي)' : 'مرجع التحويل (اختياري)'}><input className="inp" aria-label="مرجع الدفع" value={f.payRef || ''} onChange={e => set(x => ({ ...x, payRef: e.target.value }))} /></Field>}
      </div>}
    </div>);
  // يعيد { pm, payments, paidAmount } أو { err } — gross بعملة الفاتورة، fxR سعرها (1 للريال)، grossSar بالريال
  const payOf = (f, gross, grossSar, fxR, date) => {
    if (!f.pm || !PM_AR[f.pm]) return { err: 'اختر طريقة الدفع: آجل أو نقدًا أو تحويل بنكي أو شيك' };
    if (f.pm === 'credit') return { pm: 'credit', payments: [], paidAmount: 0 };
    if (f.pm === 'cheque' && !String(f.payRef || '').trim()) return { err: 'أدخل رقم الشيك' };
    const fc = f.payAmt === '' || f.payAmt == null ? gross : Number(f.payAmt) || 0;
    if (!(fc > 0)) return { err: 'أدخل المبلغ المدفوع' }; if (fc > gross + 0.005) return { err: 'المدفوع أكبر من قيمة الفاتورة' };
    const full = fc >= gross - 0.005; const sar = full ? grossSar : Math.round(fc * fxR * 100) / 100;
    const fund = f.pm === 'cash' ? '1101' : (f.payFund || '1201');
    const p = { id: uid('ipay'), amount: sar, date, fund, by: me.name, at: nowISO(), pm: f.pm, ...(String(f.payRef || '').trim() ? { ref: String(f.payRef).trim() } : {}), ...(fxR !== 1 ? { fc, rate: fxR, paid: sar } : {}) };
    return { pm: f.pm, payments: [p], paidAmount: sar };
  };
  const dueOf = (supplierId, from) => { const sp0 = suppliers.find(x => x.id === supplierId) || {}; const dd = new Date(from + 'T12:00:00'); dd.setDate(dd.getDate() + (Number(sp0.terms) || 0)); return isoD(dd); };
  const saveGrn = async (p2, takes, wid, tw, rDate, f) => {
    const no = 'GRN-' + rDate.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const lines = p2.lines.map((l, i) => takes[i] > 0 ? { li: i, itemId: l.itemId || '', desc: l.desc, ...(l.note ? { note: l.note } : {}), qty: takes[i], factor: Number(l.factor) || 1, uomName: l.uomName || '', price: Number(l.price) || 0,
      ...((f.batch || [])[i] ? { batch: f.batch[i] } : {}), ...((f.expiry || [])[i] ? { expiry: f.expiry[i] } : {}) } : null).filter(Boolean);
    let g = { id: uid('grn'), grn: no, date: rDate, whId: wid, branchId: (tw && tw.branchId) || '', supplierId: p2.supplierId, lines, status: 'qc', by: me.name, byEmail: me.email || '', at: nowISO(),
      supInvNo: String(f.supInvNo || '').trim(), supInvAmt: Number(f.supInvAmt) || 0, taxable: f.taxable !== false };
    const dId = await archiveImg(f.img, { branchId: g.branchId, title: 'فاتورة مورد ' + (g.supInvNo || p2.poNo) + ' — ' + p2.supplierName, amount: g.supInvAmt, ref: g.supInvNo || p2.poNo }); if (dId) g.docId = dId;
    const sg = await signoff('grn', 'submit', g, { branchId: '' }); if (!sg.ok) return say(sigFailMsg(sg, 'الاستلام'), 'no'); if (sg.id) g = { ...g, sigSubmit: sg.id };
    const ok = await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => (x.id !== p2.id || (x.grns || []).some(y => y.id === g.id)) ? x
      : { ...x, grns: [...(x.grns || []), g], status: x.status === 'open' ? 'partial' : x.status, lines: x.lines.map((l, i) => ({ ...l, inQc: Math.round(((Number(l.inQc) || 0) + (takes[i] || 0)) * 1000) / 1000 })) }) }),
      { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, title: 'سجّل استلامًا بانتظار الفحص', details: p2.poNo + ' · ' + g.grn + ' · ' + lines.length + ' بند' });
    if (ok === false) return;
    setRecv(null); say('سُجّل الاستلام ' + g.grn + ' بانتظار الفحص — لا يدخل المخزون قبل أن يفحصه شخص غير المستلم ✓');
  };
  const saveQc = async () => {
    const g = qc.g; const p2 = (ops.purchaseOrders || []).find(x => x.id === qc.po.id) || qc.po;
    if (!canInspect) return say('الفحص للأدوار المركزية المخوّلة بالترحيل', 'no');
    if (((g.byEmail && me.email) ? g.byEmail === me.email : g.by === me.name) && !ROLES[me.role]?.admin) return say('الفحص يجريه شخص غير من سجّل الاستلام', 'no');
    const qDate = today(); if (periodLocked(org, qDate)) return say(LOCK_MSG(qDate), 'no');
    const acc = g.lines.map((l, k) => Math.min(Math.max(Number(qc.acc[k]) || 0, 0), l.qty));
    const rej = g.lines.map((l, k) => Math.round((l.qty - acc[k]) * 1000) / 1000);
    if (rej.some((r, k) => r > 0 && !String(qc.why[k] || '').trim())) return say('اكتب سبب الرفض لكل كمية مرفوضة', 'no');
    const sg = await signDecision('grn', 'approve', g, { branchId: '' }); if (!sg.ok) return say(sigFailMsg(sg, 'الفحص'), 'no');
    const wid = g.whId || ''; const tw = wid ? whOf(org).find(w => w.id === wid) : null;
    const moves = g.lines.map((l, k) => { const it = items.find(x => x.id === l.itemId); const fac = Number(l.factor) || 1;
      return (acc[k] > 0 && l.itemId && (!it || isStocked(it))) ? { id: uid('sm'), date: qDate, itemId: l.itemId, kind: 'purchase', qty: Math.round(acc[k] * fac * 1000) / 1000,
        unitCost: Math.round((Number(l.price) || 0) / fac * 10000) / 10000, note: 'فحص ' + g.grn + ' — ' + l.desc + (fac > 1 ? ' (' + acc[k] + ' ' + (l.uomName || '') + ')' : ''), ref: p2.poNo, by: me.name, at: nowISO(),
        grnRef: g.id, grn: g.grn, ...(l.batch ? { batch: l.batch } : {}), ...(l.expiry ? { expiry: l.expiry } : {}), ...(wid ? { whId: wid } : {}), ...(tw && tw.kind === 'branch' ? { branchId: tw.branchId } : {}) } : null; }).filter(Boolean);
    const brMoves = moves.filter(m => m.branchId), mainMoves = moves.filter(m => !m.branchId);
    const qcRec = { by: me.name, byEmail: me.email || '', at: nowISO(), date: qDate, ...(sg.id ? { sig: sg.id } : {}), lines: g.lines.map((l, k) => ({ acc: acc[k], rej: rej[k], why: String(qc.why[k] || '').trim() })) };
    // v44.0: مطابق كليًا (كل البنود كاملة بلا رفض) ومعه رقم فاتورة المورد ⇒ فاتورة تلقائية بسعر الأمر
    const accOfLi = (i) => sum(g.lines.map((l, k) => [l, k]).filter(([l]) => l.li === i), ([, k]) => acc[k]);
    const expQ = rcvExpected(p2, accOfLi, g.taxable !== false);
    const autoInv = (fullMatch(p2, accOfLi) && rej.every(r => !(r > 0)) && g.supInvNo && !invNoTaken(p2.supplierId, g.supInvNo) && Math.abs((Number(g.supInvAmt) || 0) - expQ.gross) <= 0.01 && !needVat(p2.supplierId, expQ.vat))
      ? invFromCv({ rows: g.lines.map((l, k) => ({ g: g.id, grn: g.grn, k, itemId: l.itemId, desc: l.desc, qty: acc[k], factor: Number(l.factor) || 1, poPrice: Number(l.price) || 0, price: String(Number(l.price) || 0), whId: g.whId, branchId: g.branchId })),
          supInvNo: g.supInvNo, date: qDate, dueDate: dueOf(p2.supplierId, qDate), taxable: !!(org.taxCfg || {}).enabled && g.taxable !== false }, p2) : null;
    if (autoInv) { autoInv.auto = 'match'; if (g.docId) autoInv.docId = g.docId; }
    const ok = await commit(d => ({ ...d,
      whMoves: [...brMoves.filter(m => !(d.whMoves || []).some(x => x.id === m.id)), ...(d.whMoves || [])],
      stockMoves: [...mainMoves.filter(m => !(d.stockMoves || []).some(x => x.id === m.id)), ...(d.stockMoves || [])],
      ...(autoInv ? { invoices: (d.invoices || []).some(x => x.id === autoInv.id) ? (d.invoices || []) : [autoInv, ...(d.invoices || [])] } : {}),
      purchaseOrders: (d.purchaseOrders || []).map(x => {
        if (x.id !== p2.id) return x; const cur = (x.grns || []).find(y => y.id === g.id); if (!cur || cur.status !== 'qc') return x;
        const lines = x.lines.map((l, i) => { const gl = g.lines.map((q, k) => [q, k]).filter(([q]) => q.li === i);
          return gl.length ? { ...l, inQc: Math.max(0, Math.round(((Number(l.inQc) || 0) - sum(gl, ([q]) => q.qty)) * 1000) / 1000), received: Math.round(((Number(l.received) || 0) + sum(gl, ([, k]) => acc[k])) * 1000) / 1000 } : l; });
        return { ...x, lines, status: lines.every(l => (Number(l.received) || 0) >= (Number(l.qty) || 0)) ? 'received' : 'partial', grns: (x.grns || []).map(y => y.id === g.id ? { ...y, status: 'done', qc: qcRec, ...(autoInv ? { invoiceId: autoInv.id } : {}) } : y),
          ...(autoInv ? { invoiceId: x.invoiceId || autoInv.id, invoiceIds: [...new Set([...(x.invoiceIds || []), autoInv.id])] } : {}) };
      }) }), { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, title: 'فحص استلام أمر شراء',
      details: p2.poNo + ' · ' + g.grn + ' · مقبول ' + sum(acc, x => x) + ' · مرفوض ' + sum(rej, x => x) + (moves.length ? ' · دخل المخزون' : '') });
    if (ok === false) return;
    const costUp = g.lines.map((l, k) => (acc[k] > 0 && l.itemId && l.price > 0) ? { id: l.itemId, lastPrice: Math.round(l.price / (Number(l.factor) || 1) * 10000) / 10000 } : null).filter(Boolean);
    if (costUp.length) await commitOrg(d => ({ ...d, items: (d.items || []).map(it => { const u = costUp.find(c => c.id === it.id); return u ? { ...it, lastPrice: u.lastPrice, lastSupplier: p2.supplierName, lastAt: qDate } : it; }) }),
      { actionType: 'update', targetType: 'stock_item', targetId: p2.id, title: 'سجّل آخر سعر شراء للأصناف', details: p2.poNo });
    setQc(null); say('اعتُمد الفحص ' + g.grn + (moves.length ? ' — دخل المقبول ' + (wid ? whName(org, wid) : 'المخزون') : '') + (sum(rej, x => x) > 0 ? ' · المرفوض يبقى مطلوبًا من المورد' : '') + (autoInv ? ' · مطابق: أُنشئت الفاتورة ' + autoInv.invoiceNo + ' تلقائيًا' : ' · غير مطابق آليًا: يحوّله المحاسب أو مدير النظام لفاتورة') + ' ✓');
  };
  const closeRest = async (p2) => {
    if (!canInspect) return say('للأدوار المركزية المخوّلة', 'no');
    if ((p2.lines || []).some(l => (Number(l.inQc) || 0) > 0)) return say('افحص الاستلامات المعلّقة أولًا', 'no');
    const why = window.prompt('إقفال المتبقي من ' + p2.poNo + ' (لن يُورَّد) — السبب:'); if (why === null) return; if (!why.trim()) return say('اكتب السبب', 'no');
    await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id ? { ...x, status: 'closed', closeNote: why.trim(), closedBy: me.name, closedAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, title: 'أقفل المتبقي من أمر شراء', details: p2.poNo + ' · ' + why.trim() });
    say('أُقفل المتبقي من ' + p2.poNo + ' ✓');
  };
  // التحويل لفاتورة: الاستلامات المفحوصة غير المفوترة — بأسعار فاتورة المورد
  const grnsToBill = (p2) => (p2.grns || []).filter(g => g.status === 'done' && !g.invoiceId && !(p2.pinv && (p2.pinv.grnRefs || []).includes(g.id)) && g.lines.some((l, k) => ((g.qc.lines[k] || {}).acc || 0) > 0));
  const openCv = (p2) => { const gs = grnsToBill(p2); const sp0 = suppliers.find(x => x.id === p2.supplierId) || {};
    const rows = gs.flatMap(g => g.lines.map((l, k) => ({ g: g.id, grn: g.grn, k, itemId: l.itemId, desc: l.desc, note: l.note || '', qty: (g.qc.lines[k] || {}).acc || 0, factor: Number(l.factor) || 1, poPrice: Number(l.price) || 0, price: String(Number(l.price) || 0), whId: g.whId, branchId: g.branchId })).filter(r => r.qty > 0));
    const due = (() => { const dd = new Date(today() + 'T12:00:00'); dd.setDate(dd.getDate() + (Number(sp0.terms) || 0)); return isoD(dd); })();
    setCv({ po: p2, rows, supInvNo: (gs.find(g => g.supInvNo) || {}).supInvNo || '', docId: (gs.find(g => g.docId) || {}).docId || '', date: today(), dueDate: due, taxable: !!(org.taxCfg || {}).enabled }); };
  const cvCalc = (c) => { const r2 = (n) => Math.round(n * 100) / 100;
    const poNet = r2(sum(c.rows, r => r.qty * r.poPrice)), net = r2(sum(c.rows, r => r.qty * (Number(r.price) || 0)));
    const vat = (org.taxCfg || {}).enabled && c.taxable ? r2(net * ((Number((org.taxCfg || {}).rate) || 15) / 100)) : 0;
    const pct = poNet > 0 ? Math.round((net - poNet) / poNet * 10000) / 100 : 0;
    return { poNet, net, vat, gross: r2(net + vat), pct, over: Math.abs(pct) > varTol + 1e-9 }; };
  const invFromCv = (c, p2) => { const k = cvCalc(c);
    const lines = c.rows.map(r => { const it = items.find(x => x.id === r.itemId); const fac = r.factor || 1; const pr = Number(r.price) || 0;
      return { itemId: r.itemId || '', desc: r.desc, qty: Math.round(r.qty * fac * 1000) / 1000, unitCost: Math.round(pr / fac * 10000) / 10000, price: pr, poPrice: r.poPrice,
        net: Math.round(r.qty * pr * 100) / 100, poNet: Math.round(r.qty * r.poPrice * 100) / 100, stock: !!(r.itemId && (!it || isStocked(it))), grnRef: r.g, ...(r.note ? { note: r.note } : {}) }; });
    return { id: uid('inv'), invoiceNo: c.supInvNo.trim(), supplierId: p2.supplierId, supplierName: p2.supplierName, amount: k.gross, vatAmt: k.vat, taxable: k.vat > 0,
      date: c.date, dueDate: c.dueDate || c.date, paidAmount: 0, branchId: c.rows[0].branchId || p2.branchId || '', poId: p2.id, poNo: p2.poNo, whId: c.rows[0].whId || '',
      grnRefs: [...new Set(c.rows.map(r => r.g))], grn: [...new Set(c.rows.map(r => r.grn))].join('، '), lines, poNet: k.poNet, varPct: k.pct, by: me.name, createdAt: nowISO() }; };
  const postInv = async (p2, inv, extra) => commit(d => ({ ...d,
    invoices: (d.invoices || []).some(x => x.id === inv.id) ? (d.invoices || []) : [inv, ...(d.invoices || [])],
    purchaseOrders: (d.purchaseOrders || []).map(x => x.id !== p2.id ? x : { ...x, pinv: undefined, invoiceId: x.invoiceId || inv.id, invoiceIds: [...new Set([...(x.invoiceIds || []), inv.id])],
      grns: (x.grns || []).map(g => inv.grnRefs.includes(g.id) ? { ...g, invoiceId: inv.id } : g) }) }), extra);
  const saveCv = async () => {
    const c = cv; const p2 = (ops.purchaseOrders || []).find(x => x.id === c.po.id) || c.po;
    if (!canBill) return say('تحويل الاستلام غير المطابق إلى فاتورة للمحاسب ومدير النظام فقط', 'no');
    if (!c.supInvNo.trim()) return say('أدخل رقم فاتورة المورد كما هو مطبوع', 'no');
    if (c.rows.some(r => !((Number(r.price) || 0) >= 0))) return say('سعر غير صالح', 'no');
    if (periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
    const k0 = purKey({ supplierId: p2.supplierId, invoiceNo: c.supInvNo.trim() }); const o = (ops.invoices || []).find(i => purKey(i) === k0);
    if (o) return say('فاتورة مكررة: رقم ' + c.supInvNo.trim() + ' للمورد مسجّل بتاريخ ' + (o.date || '') + ' — لم يُحفظ', 'no');
    const k = cvCalc(c);
    const pyC = payOf(c, k.gross, k.gross, 1, c.date); if (pyC.err) return say(pyC.err, 'no');
    if (!(await ensureVat(p2.supplierId, k.vat, c.vatNo))) return;
    const inv = invFromCv(c, p2); inv.pm = pyC.pm; if (pyC.payments.length) { inv.payments = pyC.payments; inv.paidAmount = pyC.paidAmount; }
    const cDoc = c.img ? await archiveImg(c.img, { branchId: inv.branchId, title: 'فاتورة مورد ' + inv.invoiceNo + ' — ' + p2.supplierName, amount: inv.amount, ref: inv.invoiceNo }) : (c.docId || null); if (cDoc) inv.docId = cDoc;
    if (k.over) {
      // فوق التسامح: تنتظر اعتماد شخص آخر (توقيع تقديم موسوم بالتنبيه — القواعد تمنع مقدّمها من اعتمادها)
      let pv = { ...inv, varHold: true };
      const sg = await signoff('pinv', 'submit', pv, { branchId: '', alert: true }); if (!sg.ok) return say(sigFailMsg(sg, 'الفاتورة'), 'no'); if (sg.id) pv = { ...pv, sigSubmit: sg.id };
      const ok = await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id && !x.pinv ? { ...x, pinv: pv } : x) }),
        { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: 'فاتورة مورد بفرق سعر يتجاوز التسامح — بانتظار الاعتماد', details: p2.poNo + ' · ' + inv.invoiceNo + ' · فرق ' + k.pct + '% (التسامح ' + varTol + '%)' });
      if (ok === false) return;
      setCv(null); return say('فرق السعر ' + k.pct + '% يتجاوز التسامح ' + varTol + '% — الفاتورة بانتظار اعتماد شخص آخر قبل قيدها', 'no');
    }
    // توقيع موثّق للتحويل — القواعد تقبله من المحاسب ومدير النظام فقط
    const sgc = await signoff('pinv', 'submit', inv, { branchId: '', alert: false }); if (!sgc.ok) return say(sigFailMsg(sgc, 'تحويل الفاتورة'), 'no'); if (sgc.id) inv.sigSubmit = sgc.id;
    const ok = await postInv(p2, inv, { actionType: 'create', targetType: 'expense', targetId: inv.id, title: 'حوّل استلامات مفحوصة إلى فاتورة مورد',
      details: p2.poNo + ' · ' + inv.invoiceNo + ' · ' + money(inv.amount) + (k.pct ? ' · فرق ' + k.pct + '% ضمن التسامح' : '') });
    if (ok === false) return;
    setCv(null); say('سُجّلت الفاتورة ' + inv.invoiceNo + ' بـ ' + money(inv.amount) + ' وأُنشئ قيدها ✓');
  };
  const decidePinv = async (p2, approve) => {
    const pv = p2.pinv; if (!pv) return;
    if (!canApprovePo) return say('اعتماد فرق السعر لمعتمدي أوامر الشراء', 'no');
    if (approve && pv.by === me.name && !ROLES[me.role]?.admin) return say('يعتمد الفرقَ شخصٌ غير من سجّل الفاتورة', 'no');
    const note = approve ? '' : window.prompt('سبب رفض فاتورة ' + pv.invoiceNo + ':'); if (!approve && note === null) return;
    const sg = await signDecision('pinv', approve ? 'approve' : 'reject', pv, { branchId: '' }); if (!sg.ok) return say(sigFailMsg(sg, approve ? 'اعتماد الفرق' : 'رفض الفاتورة'), 'no');
    if (approve) {
      if (periodLocked(org, pv.date)) return say(LOCK_MSG(pv.date), 'no');
      const { varHold, ...inv } = pv; const rec = { ...inv, varApprovedBy: me.name, varApprovedAt: nowISO(), ...(sg.id ? { sigVar: sg.id } : {}) };
      const ok = await postInv(p2, rec, { actionType: 'create', targetType: 'expense', targetId: rec.id, need: 'post', title: 'اعتمد فرق سعر فاتورة مورد', details: p2.poNo + ' · ' + rec.invoiceNo + ' · فرق ' + rec.varPct + '%' });
      if (ok !== false) say('اعتُمد الفرق وسُجّلت الفاتورة ' + rec.invoiceNo + ' ✓');
    } else {
      const ok = await commit(d => ({ ...d, purchaseOrders: (d.purchaseOrders || []).map(x => x.id === p2.id ? { ...x, pinv: undefined, pinvRejected: [...(x.pinvRejected || []), { no: pv.invoiceNo, note, by: me.name, at: nowISO() }] } : x) }),
        { actionType: 'update', targetType: 'purchase_order', targetId: p2.id, need: 'post', title: 'رفض فاتورة مورد بفرق سعر', details: p2.poNo + ' · ' + pv.invoiceNo + ' · ' + note });
      if (ok !== false) say('رُفضت الفاتورة — تعود الاستلامات بانتظار فاتورة صحيحة');
    }
  };
  // فاتورة خدمات ومصروفات: بنود متعددة لكل منها حساب مصروف من دليل الحسابات (قرار المالك)
  // v44.3 (قرار المالك): كل حسابات الدليل متاحة لبنود فاتورة الخدمات والمصروفات — مرتبة بالرمز ومجمّعة بالنوع، عدا ذمم الموردين 2101 (طرف الفاتورة الدائن)
  const ACC_KIND_AR = { asset: 'الأصول', liab: 'الالتزامات', equity: 'حقوق الملكية', rev: 'الإيرادات', exp: 'المصروفات' };
  const svcAccs = useMemo(() => svc ? buildAccounting(org, {}).accounts.filter(a => String(a.code) !== '2101').map(a => ({ code: String(a.code), name: a.name, kind: a.kind || 'exp' })).sort((x, y) => x.code.localeCompare(y.code)) : [], [svc, org]);
  const svcGroups = Object.keys(ACC_KIND_AR).map(k => [k, svcAccs.filter(a => a.kind === k)]).concat([['', svcAccs.filter(a => !ACC_KIND_AR[a.kind])]]).filter(([, l]) => l.length);
  const svcLine = () => ({ desc: '', accCode: '', net: '', taxable: !!(org.taxCfg || {}).enabled });
  const svcCalc = (f) => { const r2 = (n) => Math.round(n * 100) / 100; const rate = (Number((org.taxCfg || {}).rate) || 15) / 100;
    const ls = f.lines.map(l => { const n = r2(Number(l.net) || 0); return { ...l, n, v: (org.taxCfg || {}).enabled && l.taxable ? r2(n * rate) : 0 }; });
    return { ls, net: r2(sum(ls, l => l.n)), vat: r2(sum(ls, l => l.v)), gross: r2(sum(ls, l => l.n + l.v)) }; };
  const saveSvc = async () => {
    const f = svc; const sp = suppliers.find(x => x.id === f.supplierId); if (!sp) return say('اختر المورد', 'no');
    const k = svcCalc(f); const ls = k.ls.filter(l => l.n !== 0);
    const fxR = isFx(f.cur) ? Number(f.rate) || 0 : 1;
    if (isFx(f.cur) && !(fxR > 0)) return say('أدخل سعر صرف ' + f.cur + ' بالريال', 'no');
    const toS = (x) => Math.round(x * fxR * 100) / 100;
    if (!ls.length) return say('أدخل بندًا واحدًا على الأقل بمبلغه', 'no');
    if (ls.some(l => !l.accCode)) return say('اختر حساب المصروف لكل بند', 'no');
    if (ls.some(l => !String(l.desc || '').trim())) return say('اكتب وصف كل بند', 'no');
    if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
    const typedNo = (f.invoiceNo || '').trim();
    if (typedNo) { const k0 = purKey({ supplierId: sp.id, invoiceNo: typedNo }); const o = (ops.invoices || []).find(i => purKey(i) === k0); if (o) return say('فاتورة مكررة: رقم ' + typedNo + ' للمورد «' + sp.name + '» مسجّل بتاريخ ' + (o.date || ''), 'no'); }
    const pyS = payOf(f, k.gross, Math.round((sum(ls, l => toS(l.n)) + toS(k.vat)) * 100) / 100, fxR, f.date); if (pyS.err) return say(pyS.err, 'no');
    if (!(await ensureVat(sp.id, k.vat, f.vatNo))) return;
    const autoNo = () => { const pre = 'SVC-' + today().replace(/-/g, '').slice(2) + '-'; let n = 1; while ((ops.invoices || []).some(i => i.invoiceNo === pre + String(n).padStart(3, '0'))) n++; return pre + String(n).padStart(3, '0'); };
    const br = org.branches.find(b => b.id === f.branchId);
    const rec = { id: uid('inv'), kind: 'svc', ...(f.projectId ? { projectId: f.projectId } : {}), supplierId: sp.id, supplierName: sp.name, branchId: f.branchId || '', branchName: br ? br.name : 'المركز الرئيسي', invoiceNo: typedNo || autoNo(),
      amount: toS(k.gross), vatAmt: toS(k.vat), taxable: k.vat > 0, paidAmount: 0, date: f.date, dueDate: f.dueDate || f.date,
      expLines: ls.map(l => ({ desc: String(l.desc).trim(), accCode: l.accCode, net: toS(l.n), vat: toS(l.v), ...(isFx(f.cur) ? { fcNet: l.n } : {}) })), by: me.name, createdAt: nowISO(),
      ...(isFx(f.cur) ? { cur: f.cur, fxRate: fxR, fcAmount: k.gross } : {}) };
    const sDoc = await archiveImg(f.img, { branchId: f.branchId, title: 'فاتورة خدمات ' + rec.invoiceNo + ' — ' + sp.name, amount: rec.amount, ref: rec.invoiceNo }); if (sDoc) rec.docId = sDoc;
    // تقريب التحويل: الإجمالي بالريال = مجموع البنود + الضريبة (لا فرق تقريب في القيد)
    rec.amount = Math.round((sum(rec.expLines, l => l.net) + rec.vatAmt) * 100) / 100;
    rec.pm = pyS.pm; if (pyS.payments.length) { const pp = { ...pyS.payments[0], amount: Math.min(pyS.payments[0].amount, rec.amount) }; if (pp.paid != null) pp.paid = pp.amount; rec.payments = [pp]; rec.paidAmount = pp.amount; }
    const ok = await commit(d => ({ ...d, invoices: [rec, ...(d.invoices || [])] }), { actionType: 'create', targetType: 'expense', targetId: rec.id, title: 'سجّل فاتورة خدمات ومصروفات',
      details: sp.name + ' · ' + rec.invoiceNo + ' · ' + ls.length + ' بند · ' + money(rec.amount) });
    if (ok === false) return;
    setSvc(null); say('سُجّلت فاتورة الخدمات ' + rec.invoiceNo + ' وقُيّد كل بند على حسابه ✓');
  };
  // v30.9 — مرتجع لمورد: يُخرج الأصناف من المستودع بتكلفة شرائها ويُصدر إشعارًا دائنًا يخفض ذمة المورد وضريبة المدخلات
  const retOpen = (p2) => { if (inspectOn && grnsToBill(p2).length) return say('حوّل الاستلامات المفحوصة إلى فاتورة قبل المرتجع — والمرفوض في الفحص لا يحتاج مرتجعًا', 'no'); const inv0 = (ops.invoices || []).find(i => i.id === p2.invoiceId) || {};
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

  // v47.4 — الإشعار المدين للمشتريات: «نُصدره للمورد» يخفض الذمة والتكلفة وضريبة المدخلات (فرق سعر، خصم مكتسب، نقص/تلف، رسوم غير مستحقة)،
  //          و«استلمناه من المورد» يزيدها (فرق سعر لصالحه، رسوم إضافية). كلاهما مربوط بالفاتورة الأصلية.
  const taxOf = (i) => typeof i.vatAmt === 'number' ? Math.abs(i.vatAmt) > 0.004 : i.taxable === true;
  const vRate = () => Number((org.taxCfg || {}).rate) || 15;
  const accOpts = (i) => { const o = [{ code: (i.accCode || '5198'), ar: 'حساب الفاتورة الأصلية (' + (i.accCode || '5198') + ')' }];
    if (Array.isArray(i.lines) && i.lines.some(l => l.stock)) { const w = whOn(org) ? (whOf(org).find(x => x.id === (i.whId || MAIN_WH)) || {}) : {}; o.push({ code: String(w.accCode || '1601'), ar: 'المخزون' + (w.name ? ' — ' + w.name : '') + ' (للأصناف المخزنية)' }); }
    o.push({ code: '4202', ar: 'خصم مكتسب (4202)' }); return o; };
  const pdnMk = (inv, f, me0) => { const net = Math.round((Number(f.net) || 0) * 100) / 100; const vat = f.taxable ? Math.round(net * vRate() / 100 * 100) / 100 : 0; const tot = Math.round((net + vat) * 100) / 100;
    const no = (f.no || '').trim() || ((f.dir === 'inc' ? 'SDN-' : 'PDN-') + (f.date || today()).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase());
    const base = { id: uid('inv'), invoiceNo: no, supplierId: inv.supplierId, supplierName: inv.supplierName, branchId: inv.branchId || '', branchName: inv.branchName || '', date: f.date, dueDate: f.dir === 'inc' ? (inv.dueDate && inv.dueDate > f.date ? inv.dueDate : f.date) : f.date, paidAmount: 0,
      appliesTo: inv.id, refNo: inv.invoiceNo, ...(inv.projectId ? { projectId: inv.projectId } : {}), reason: f.reason.trim(), taxable: !!f.taxable, accCode: f.acc, ...(inv.whId ? { whId: inv.whId } : {}), ...(f.disc ? { disc: true } : {}), by: me0.name, createdAt: nowISO() };
    return f.dir === 'inc' ? { ...base, supDebit: true, amount: tot, vatAmt: vat } : { ...base, creditNote: true, debitNote: true, amount: -tot, vatAmt: -vat }; };
  const savePdn = async () => {
    const f = pdn, inv = f.inv; if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
    if (!(f.reason || '').trim()) return say('اكتب سبب الإشعار', 'no');
    if (!(Number(f.net) > 0)) return say('أدخل المبلغ قبل الضريبة', 'no');
    if (f.date < (inv.date || '').slice(0, 10)) return say('تاريخ الإشعار قبل تاريخ الفاتورة', 'no');
    const rec = pdnMk(inv, f, me);
    if (f.dir !== 'inc' && -rec.amount > Math.round((inv.amount - cnOf(inv)) * 100) / 100 + 0.004) return say('الإشعار أكبر من قيمة الفاتورة بعد الإشعارات السابقة (' + money(inv.amount - cnOf(inv)) + ')', 'no');
    const ok = await commit(d => ({ ...d, invoices: [rec, ...(d.invoices || [])] }),
      { actionType: 'create', targetType: 'expense', targetId: rec.id, branchName: inv.branchName, need: 'post', title: f.dir === 'inc' ? 'سجّل إشعارًا مدينًا من مورد' : 'أصدر إشعارًا مدينًا لمورد', details: inv.supplierName + ' · عن ' + inv.invoiceNo + ' · ' + money(Math.abs(rec.amount)) + ' · ' + f.reason.trim() });
    if (ok) { setPdn(null); say((f.dir === 'inc' ? 'سُجّل إشعار المورد ' : 'صدر الإشعار المدين ') + rec.invoiceNo + ' بـ ' + money(Math.abs(rec.amount)) + ' ✓');
      if (f.dir !== 'inc') printA4(org, 'إشعار مدين للمورد — ' + rec.invoiceNo, '', pdnHtml(rec, inv)); }
  };
  const pdnHtml = (r, inv) => { const net = Math.round((-r.amount + r.vatAmt) * 100) / 100, sp = (org.suppliers || []).find(x => x.id === r.supplierId) || {};
    return `<div class="sub">رقم الإشعار: <b>${_xe(r.invoiceNo)}</b> · التاريخ: ${_xe(r.date)}${r.by ? ' · أعدّه: ' + _xe(r.by) : ''}</div>
  <table><tbody><tr><td style="width:30%">إلى المورد</td><td>${_xe(r.supplierName)}${sp.vatNo ? ' · الرقم الضريبي ' + _xe(sp.vatNo) : ''}</td></tr>
  <tr><td>عن فاتورته</td><td>${_xe(inv.invoiceNo)} بتاريخ ${_xe((inv.date || '').slice(0, 10))} — ${money(inv.amount)} ر.س</td></tr>
  <tr><td>السبب</td><td>${_xe(r.reason)}</td></tr><tr><td>المبلغ قبل الضريبة</td><td class="n">${money(net)}</td></tr>
  <tr><td>ضريبة القيمة المضافة</td><td class="n">${money(-r.vatAmt)}</td></tr><tr><td><b>يُخصم من حسابكم</b></td><td class="n"><b>${money(-r.amount)} ر.س</b></td></tr></tbody></table>
  <div class="sub" style="margin-top:10px">نرجو إصدار إشعار دائن ضريبي مقابل هذا المبلغ مرتبطًا بفاتورتكم (المادة 40 والمادة 54 من اللائحة التنفيذية لضريبة القيمة المضافة).</div>`; };

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
    // v43.9: فاتورة بعملة أجنبية — المبلغ بالعملة وسعر يوم السداد؛ الذمة تُخفَّض بسعر الفاتورة، والفرق ربح/خسارة صرف محقّقة
    let fxp = null;
    if (inv.cur) {
      const fc = Math.min(Number(fxPay.fc) || 0, fxRemFc(inv)), rate = Number(fxPay.rate) || 0;
      if (!(fc > 0)) return say('أدخل مبلغ السداد بـ' + inv.cur, 'no'); if (!(rate > 0)) return say('أدخل سعر صرف يوم السداد', 'no');
      const ap = fc >= fxRemFc(inv) - 0.005 ? invRem(inv) : Math.round(fc * (Number(inv.fxRate) || 0) * 100) / 100;
      fxp = { fc, rate, paid: Math.round(fc * rate * 100) / 100, ap };
    }
    const dsc = fxp ? 0 : Math.round((Number(disc) || 0) * 100) / 100;   // v47.4 خصم تعجيل سداد مكتسب (بإجماليه شامل الضريبة)
    const v = fxp ? fxp.ap : Math.min(amt, Math.max(0, Math.round((invRem(inv) - dsc) * 100) / 100));
    if (dsc < 0 || dsc > invRem(inv) + 0.004) return say('الخصم أكبر من المتبقي', 'no');
    if (v <= 0 && !(dsc > 0)) return say('أدخل مبلغ سداد صحيح', 'no');
    const dRec = dsc > 0 ? (() => { const tx = taxOf(inv); const net = tx ? Math.round(dsc / (1 + vRate() / 100) * 100) / 100 : dsc;
      return pdnMk(inv, { dir: 'red', date: today(), no: '', reason: 'خصم تعجيل سداد مكتسب', net, taxable: tx, acc: '4202', disc: true }, me); })() : null;
    if (dRec) dRec.amount = -dsc, dRec.vatAmt = -Math.round((dsc - Math.round((dsc / (1 + (taxOf(inv) ? vRate() : 0) / 100)) * 100) / 100) * 100) / 100;   // الإجمالي كما اتُّفق تمامًا
    await commit(d => ({
      ...d,
      // v29.4: الدفعة تُحفظ بتاريخها ومصدرها؛ paidAmount يبقى مجموع المسدَّد (تعتمد عليه شاشات المتبقي)
      invoices: (dRec ? [dRec, ...(d.invoices || [])] : (d.invoices || [])).map(i => i.id === inv.id && v > 0 ? { ...i, paidAmount: Math.round(((i.paidAmount || 0) + v) * 100) / 100,
        payments: [...(Array.isArray(i.payments) ? i.payments : (i.paidAmount > 0 ? [{ id: 'legacy', amount: i.paidAmount, date: (i.paidDate || i.date || '').slice(0, 10), fund: i.payFund || '' }] : [])),
          { id: uid('ipay'), amount: v, date: today(), fund: payFund, by: me.name, at: nowISO(), ...(fxp ? { fc: fxp.fc, rate: fxp.rate, paid: fxp.paid } : {}) }] } : i)
    }), {
      actionType: 'update', targetType: 'expense', targetId: inv.id, branchName: inv.branchName,
      title: 'سدّد دفعة لمورد', details: `${inv.supplierName} · فاتورة ${inv.invoiceNo} · ${money(v)} ر.س` + (fxp ? ` (${fxp.fc} ${inv.cur} @ ${fxp.rate} = ${money(fxp.paid)} ر.س)` : '') + (payFund === '1101' ? ' · نقداً من الخزينة' : ' · من البنك')
    });
    say(fxp ? `تم تسجيل سداد ${fxp.fc} ${inv.cur} = ${money(fxp.paid)} ر.س` + (Math.abs(fxp.paid - v) > 0.004 ? ` · فرق صرف ${fxp.paid > v ? 'خسارة' : 'ربح'} ${money(Math.abs(fxp.paid - v))} ر.س` : '') : `تم تسجيل سداد ${money(v)} ر.س لـ${inv.supplierName}`);
    if (dRec) say('سُجّل السداد' + (v > 0 ? ' ' + money(v) : '') + ' وخصم مكتسب ' + money(dsc) + ' بإشعار مدين ' + dRec.invoiceNo + ' (يخفض ضريبة المدخلات ' + money(-dRec.vatAmt) + ') ✓');
    setPay(null); setAmt(0); setDisc('');
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

  // v44.0 — قائمة «مستلم لم يُفوتر» للمحاسب داخل المحاسبة (قرار المالك): الاستلامات غير المطابقة وفواتير فرق السعر فقط
  const cvModalEl = cv && (() => { const k = cvCalc(cv); return (
        <Modal title={'تحويل لفاتورة — ' + cv.po.poNo + ' · ' + cv.po.supplierName} icon={FileText} onClose={() => setCv(null)} wide
          foot={<><button className="btn gh" onClick={() => setCv(null)}>إلغاء</button><button className="btn pri" data-cvsave onClick={saveCv}><Check size={14} />{k.over ? 'إرسال للاعتماد' : 'تسجيل الفاتورة'}</button></>}>
          <div className="grid g3">
            <Field label="رقم فاتورة المورد (كما هو مطبوع)"><input className="inp" value={cv.supInvNo} onChange={e => setCv(c => ({ ...c, supInvNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={cv.po.supplierId} invoiceNo={cv.supInvNo} /></Field>
            <Field label="تاريخ الفاتورة"><input type="date" className="inp" value={cv.date} onChange={e => setCv(c => ({ ...c, date: e.target.value }))} /></Field>
            <Field label="تاريخ الاستحقاق"><input type="date" className="inp" value={cv.dueDate} onChange={e => setCv(c => ({ ...c, dueDate: e.target.value }))} /></Field>
          </div>
          {!!(org.taxCfg || {}).enabled && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 8px' }}><input type="checkbox" checked={!!cv.taxable} onChange={e => setCv(c => ({ ...c, taxable: e.target.checked }))} />خاضعة لضريبة القيمة المضافة</label>}
          <div className="tw"><table className="tb">
            <thead><tr><th>الاستلام</th><th>البند</th><th style={{ textAlign: 'end' }}>المقبول</th><th style={{ textAlign: 'end' }}>سعر الأمر</th><th style={{ textAlign: 'end' }}>سعر فاتورة المورد</th><th style={{ textAlign: 'end' }}>الصافي</th></tr></thead>
            <tbody>{cv.rows.map((r, i) => <tr key={i}><td className="num" style={{ fontSize: 10.5 }}>{r.grn}</td><td>{r.desc}{r.note ? <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>📝 {r.note}</div> : null}</td><td className="num" style={{ textAlign: 'end' }}>{r.qty}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.poPrice)}</td>
              <td style={{ textAlign: 'end' }}><input className="inp n" style={{ width: 100 }} inputMode="decimal" aria-label={'سعر الفاتورة ' + (i + 1)} value={r.price} onChange={e => setCv(c => ({ ...c, rows: c.rows.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x) }))} /></td>
              <td className="num" style={{ textAlign: 'end' }}>{money(r.qty * (Number(r.price) || 0))}</td></tr>)}</tbody>
          </table></div>
          <div className="mono-b" style={{ margin: '8px 0' }}><span style={{ fontSize: 12 }}>قيمة الأمر للمقبول <span className="num">{money(k.poNet)}</span> · الفاتورة <span className="num">{money(k.net)}</span>{k.vat ? <> + ض <span className="num">{money(k.vat)}</span></> : null}</span><span className="num" style={{ fontWeight: 700 }}>{money(k.gross)}</span></div>
          {VatNoField({ supplierId: cv.po.supplierId, vat: k.vat, value: cv.vatNo, onChange: v => setCv(c => ({ ...c, vatNo: v })) })}
          {PayBox(cv, setCv, k.gross, 'SAR')}
          {cv.docId ? <div className="hint">📎 صورة فاتورة المورد مرفقة من الاستلام</div> : ImgField({ img: cv.img, onImg: (img) => setCv(c => ({ ...c, img })) })}
          <div className={k.over ? 'note warn' : 'note'} data-var={k.pct}>فرق السعر <b className="num">{k.pct}%</b> — التسامح <span className="num">{varTol}%</span>. {k.over ? 'يتجاوز التسامح: تُرسل الفاتورة لاعتماد شخص آخر ولا تُقيَّد قبله.' : 'ضمن التسامح: تُقيَّد مباشرة.'} {pcfg.perpetualFrom ? 'القيد: من ح/ بضاعة مستلمة لم تُفوتر (بسعر الأمر) ± فروق أسعار الشراء، وضريبة المدخلات، إلى ح/ المورد.' : 'القيد: من ح/ المشتريات وضريبة المدخلات إلى ح/ المورد.'}</div>
        </Modal>); })();
  if (billOnly) {
    const rowsB = pos.filter(p2 => grnsToBill(p2).length > 0 || p2.pinv);
    return (
      <div className="card" data-unbilled>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <b style={{ fontSize: 14 }}>مستلم لم يُفوتر</b>
          <span className="badge b-dim">التحويل لفاتورة: المحاسب ومدير النظام فقط</span>
        </div>
        <div className="note" style={{ marginBottom: 8 }}>استلامات لم تتحوّل لفاتورة تلقائيًا لأنها غير مطابقة (استلام جزئي، أو رفض في الفحص، أو بلا رقم فاتورة المورد، أو رقم مكرر). حوّلها برقم فاتورة المورد وأسعارها؛ فرق السعر فوق التسامح ينتظر اعتماد معتمد أوامر الشراء.</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الأمر</th><th>المورد</th><th>الاستلامات</th><th style={{ textAlign: 'end' }}>القيمة بسعر الأمر</th><th /></tr></thead>
          <tbody>{rowsB.map(p2 => { const gs = grnsToBill(p2); const v = sum(gs, g => sum(g.lines, (l, k) => ((g.qc.lines[k] || {}).acc || 0) * (Number(l.price) || 0))); return (
            <tr key={p2.id}><td className="num" style={{ fontSize: 11.5 }}>{p2.poNo}</td><td style={{ fontSize: 12.5 }}>{p2.supplierName}</td>
              <td style={{ fontSize: 11 }}>{gs.map(g => g.grn + (g.supInvNo ? ' · ' + g.supInvNo : '')).join('، ')}{p2.pinv && <div><span className="badge b-rose">فاتورة {p2.pinv.invoiceNo} بانتظار اعتماد الفرق ({p2.pinv.varPct}%)</span></div>}</td>
              <td className="num" style={{ textAlign: 'end' }}>{money(v)}</td>
              <td><div className="row" style={{ gap: 5 }}>{canBill && gs.length > 0 && !p2.pinv && <button className="btn sm pri" data-cv onClick={() => openCv(p2)}>تحويل لفاتورة</button>}
                {canApprovePo && p2.pinv && <><button className="btn sm pri" onClick={() => decidePinv(p2, true)}>اعتماد الفرق</button><button className="btn sm gh" onClick={() => decidePinv(p2, false)}>رفض الفاتورة</button></>}</div></td></tr>); })}
            {rowsB.length === 0 && <tr><td colSpan={5}><div className="empty">لا استلامات غير مفوترة ✓</div></td></tr>}</tbody>
        </table></div>
        {cvModalEl}
      </div>);
  }

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

      <SectionNav label="الفواتير والأوامر" cur={tab} onPick={setTab} items={[{ id: 'inv', ar: 'فواتير الموردين الآجلة', icon: FileText }, { id: 'fx', ar: 'إيجارات وفواتير الفروع', icon: Building2 }, { id: 'po', ar: 'أوامر الشراء', icon: ClipboardCheck, badge: (canPay && reqsPending.length) || null }]}
        extra={<>{goTab && roleHasTab(me, 'partners') && <button className="btn sm gh" onClick={() => goTab('partners')}><Users size={14} />الموردون ← جهات الاتصال</button>}
          {canPay && <button className="btn sm pri" onClick={() => setNewInv({ supplierId: suppliers[0]?.id || '', invoiceNo: '', taxable: !!(org.taxCfg || {}).enabled, date: today(), dueDate: today(), branchId: '', lines: [invLine()] })}><Plus size={14} />فاتورة توريد جديدة</button>}
          {canPay && <button className="btn sm" data-svc onClick={() => setSvc({ supplierId: suppliers[0]?.id || '', invoiceNo: '', date: today(), dueDate: today(), branchId: '', lines: [svcLine()] })}><Plus size={14} />فاتورة خدمات ومصروفات</button>}</>} />
      <div className="grid g4">
        <Kpi label="مستحقات الموردين" value={money(outstanding)} sub={`${allInvs.filter(i => remOf(i) > 0).length} فاتورة مفتوحة (منها ${clInvs.filter(v => cRem(v) > 0).length} من الورديات)`} icon={Truck} color="#D9A83E" />
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
                      <td style={{ fontSize: 11 }}><DocLink to={i.source === 'stored' ? { inv: i.id } : null} title="استعراض الفاتورة"><span className="num">{i.invoiceNo}</span></DocLink>
                        {i.source === 'closing' && <div><span className="badge b-mint" style={{ fontSize: 8.5, marginTop: 2 }}>من وردية · {i.categoryName}</span></div>}</td>
                      <td style={{ fontSize: 12 }}>{i.supplierName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{i.branchName}</td>
                      <td className="dt" style={{ whiteSpace: 'nowrap', color: late ? 'var(--rose)' : 'inherit' }}>{arDate(i.dueDate)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: mahla.c, fontSize: 11.5, fontWeight: 600 }}>{mahla.t}</td>
                      <td className="num">{money(i.amount)}{i.cur && <div style={{ fontSize: 9.5, color: 'var(--faint)' }} data-fxamt>{money(i.fcAmount)} {i.cur} @ {i.fxRate}</div>}{i.pm && <div style={{ fontSize: 9.5, color: 'var(--faint)', fontFamily: 'inherit' }} data-pmlbl>{PM_AR[i.pm]}{(i.payments || []).find(x => x.ref) ? ' · ' + (i.payments || []).find(x => x.ref).ref : ''}</div>}</td>
                      <td className="num" style={{ color: 'var(--mint)' }}>{money(paidOf(i))}
                        {bp > 0 && <div style={{ fontSize: 9, color: 'var(--faint)' }}>منه من الفروع {money(bp)}</div>}</td>
                      <td className="num" style={{ color: rem > 0 ? 'var(--amber)' : 'var(--faint)', fontWeight: 600 }}>{money(rem)}</td>
                      <td><span className={'badge ' + (rem <= 0 ? 'b-mint' : late ? 'b-rose' : 'b-amber')}>
                        {rem <= 0 ? 'مسددة' : late ? 'متأخرة' : 'قيد السداد'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{rem > 0 && canPay &&
                        <button className="btn sm" onClick={() => { setPay(i); setAmt(rem); if (i.cur) setFxPay({ fc: String(fxRemFc(i)), rate: lastRate(i.cur) || String(i.fxRate || '') }); }}>سداد</button>}
                        {i.source === 'stored' && canPay && i.amount > 0 && !i.creditNote && !i.supDebit && <button className="btn sm gh" data-copyinv style={{ marginInlineStart: 4 }} title="نسخة مطابقة بتاريخ اليوم" onClick={() => copyInv(i)}>⧉ نسخ</button>}
                        {i.source === 'stored' && canPay && i.amount > 0 && !i.creditNote && !i.cur && <button className="btn sm gh" data-pdn style={{ marginInlineStart: 4 }} onClick={() => setPdn({ inv: i, dir: 'red', date: today(), no: '', reason: '', net: '', taxable: taxOf(i), acc: i.accCode || '5198' })}>إشعار مدين</button>}
                        {invEditable(i) && <button className="btn sm gh" data-editinv style={{ marginInlineStart: 4 }} title="تعديل الفاتورة (غير مسددة وفترتها مفتوحة)" onClick={() => editInv(i)}>✎ تعديل</button>}
                        {i.source === 'stored' && canDelInv(i) && <button className="btn sm gh" title="حذف فاتورة مكررة أو مستوردة خطأً" style={{ color: 'var(--rose)', marginInlineStart: 4 }} onClick={() => delInv(i)}><Trash2 size={12} /></button>}</td>
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
              {canCfg && <button className="btn sm gh" onClick={() => setCfgF({ approvalLimit: String(apprLimit || ''), priceAlertPct: String(alertPct), saleDeduct: !!pcfg.saleDeductFrom, saleDeductFrom: pcfg.saleDeductFrom || '', perpetual: !!pcfg.perpetualFrom, perpetualFrom: pcfg.perpetualFrom || today().slice(0, 7), inspect: inspectOn, invVarPct: String(varTol), fx: fxOn })}>⚙ الإعدادات</button>}
              {canPay && <button className="btn sm pri" onClick={() => setPoF({ supplierId: suppliers[0]?.id || '', branchId: '', whId: MAIN_WH, note: '', lines: [{ desc: '', itemId: '', qty: '', price: '' }] })}><Plus size={14} />أمر شراء جديد</button>}
            </div>
          </div>
          {/* v52.0 (أتمتة): أوامر مقترحة من نفاد المخزون — تُفتح في نموذج الأمر لمراجعتها، ثم تمر بالاعتماد والتوقيع كالمعتاد */}
          {canPay && autoCfgOf(org).poSuggest && (() => { const G = poSuggestions(org, ops); return G.length ? (
            <div className="card mq-posugg" style={{ background: 'var(--ink)', marginBottom: 10 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>أوامر شراء مقترحة من نفاد المخزون ({G.length})</div>
              {G.slice(0, 8).map(g => <div key={g.supplierId + g.whId} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                <b style={{ fontSize: 12.5 }}>{g.supplierName}</b><span className="badge b-dim">{whName(org, g.whId)}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{g.lines.map(l => l.desc + ' ' + l.qty + (l.unit ? ' ' + l.unit : '')).join('، ')}</span>
                <span className="num" style={{ marginInlineStart: 'auto' }}>{money(g.total)}</span>
                <button className="btn sm pri" onClick={() => setPoF({ supplierId: g.supplierId, branchId: '', whId: g.whId, note: 'مقترح آليًا من نفاد المخزون', lines: g.lines.map(l => ({ desc: l.desc, itemId: l.itemId, qty: String(l.qty), price: String(l.price) })) })}>مراجعة وإنشاء الأمر</button>
              </div>)}
            </div>) : null; })()}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '0 0 10px' }}>
            <span className="badge b-dim">الاعتماد: {apprLimit > 0 ? 'الأوامر فوق ' + money(apprLimit) + ' ر.س' : 'غير مفعّل'}</span>
            <span className="badge b-dim">تنبيه السعر: {alertPct > 0 ? 'أعلى من متوسط آخر 3 مشتريات بأكثر من ' + alertPct + '% ⇐ اعتماد' : 'موقوف'}</span>
            <span className={'badge ' + (pcfg.perpetualFrom ? 'b-mint' : 'b-dim')}>الجرد المستمر: {pcfg.perpetualFrom ? 'من ' + pcfg.perpetualFrom : 'موقوف (دوري)'}</span>
            {pcfg.saleDeductFrom && <span className="badge b-mint" data-saledeductbadge>خصم المبيعات من المخزون: من {pcfg.saleDeductFrom}</span>}
          </div>
          {canPay && reqsPending.length > 0 && (
            <div className="card" style={{ padding: 10, marginBottom: 12, background: 'var(--ink2)' }} data-preqs>
              <div className="card-t" style={{ fontSize: 13, marginBottom: 8 }}>طلبات شراء الفروع بانتظار المراجعة <span className="badge b-amber">{reqsPending.length}</span></div>
              <div className="tw"><table className="tb">
                <thead><tr><th>الطلب</th><th>الفرع / المستودع</th><th>الأصناف</th><th /></tr></thead>
                <tbody>{reqsPending.map(r => (
                  <tr key={r.id} data-preq={r.no}><td><span className="num" style={{ fontSize: 11.5 }}>{r.no}</span><div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{String(r.at || '').slice(0, 10)} · {r.by}</div></td>
                    <td style={{ fontSize: 12 }}>{whName(org, r.whId)}{r.note ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{r.note}</div> : null}</td>
                    <td style={{ fontSize: 11.5 }}>{(r.lines || []).map(l => ((items.find(x => x.id === l.itemId) || {}).name || '—') + ' ' + l.qty + (l.note ? ' (' + l.note + ')' : '')).join('، ')}</td>
                    <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>{brSig[r.id] && brSig[r.id] !== 'ok' ? <span className="badge b-rose">{SIG_WHY[brSig[r.id]]}</span> : <button className="btn sm pri" data-req2po disabled={!brSig[r.id]} onClick={() => reqToPo(r)}>تحويل لأمر شراء</button>}<button className="btn sm gh" onClick={() => rejectReq(r)}>رفض</button></div></td></tr>))}
                </tbody></table></div>
            </div>)}
          {canPay && (ops.poReceipts || []).some(r => r.status === 'pending') && (
            <div className="note" style={{ marginBottom: 10 }} data-brrcv>
              استلامات فروع لم تُرحَّل: {(ops.poReceipts || []).filter(r => r.status === 'pending').map(r => <span key={r.id} style={{ marginInlineEnd: 8 }}>{r.poNo} · {r.no}{brRcvWhy(r) ? ' — ' + brRcvWhy(r) : ''} {!brRcvWhy(r) && <button className="btn sm gh" onClick={() => postBrRcv(r, false)}>ترحيل</button>}</span>)}
            </div>)}
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
                        {whOn(org) && <span className="badge b-dim" style={{ marginTop: 3 }} data-powh>إلى: {whName(org, poWhOf(org, p2))}</span>}{p2.reqNo ? <span className="badge b-sky" style={{ marginTop: 3, marginInlineStart: 4 }}>من طلب {p2.reqNo}</span> : null}
                        {p2.priceAlert ? <span className="badge b-rose" style={{ marginTop: 3 }} title={(p2.lines || []).filter(l => l.pAlert).map(l => l.desc + ': ' + money(l.pAlert.unit) + ' مقابل متوسط ' + money(l.pAlert.avg3) + ' (+' + l.pAlert.pct + '%)').join('\n')}>⚠ سعر أعلى من متوسط آخر 3 · {(p2.lines || []).filter(l => l.pAlert).map(l => l.desc + ' +' + l.pAlert.pct + '%').join('، ') || p2.priceAlert + ' بند'}</span> : null}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(tot)}</td>
                      <td>{p2.status === 'pending' ? <span className="badge b-amber">بانتظار الاعتماد</span>
                        : p2.status === 'rejected' ? <span className="badge b-rose" title={p2.rejectNote || ''}>مرفوض{p2.rejectNote ? ' — ' + p2.rejectNote : ''}</span>
                        : p2.status === 'received' ? <span className="badge b-mint">مستلم كاملاً ✓</span>
                        : p2.status === 'closed' ? <span className="badge b-dim" title={p2.closeNote || ''}>أُقفل المتبقي{p2.closeNote ? ' — ' + p2.closeNote : ''}</span>
                        : p2.status === 'partial' ? <span className="badge b-amber">جزئي</span>
                        : <span className="badge b-sky">بانتظار التوريد</span>}</td>
                      <td>{(p2.grns || []).filter(g => g.status === 'qc').map(g => <div key={g.id}><span className="badge b-amber" style={{ marginBottom: 3 }} data-qcbadge>بانتظار الفحص · {g.grn}</span></div>)}
                        {p2.pinv && <div><span className="badge b-rose" style={{ marginBottom: 3 }} title={'فرق ' + p2.pinv.varPct + '% عن سعر الأمر'}>فاتورة {p2.pinv.invoiceNo} بانتظار اعتماد الفرق ({p2.pinv.varPct}%)</span></div>}
                        {grnsToBill(p2).length > 0 && <div><span className="badge b-sky" style={{ marginBottom: 3 }}>مفحوص لم يُفوتر · {grnsToBill(p2).length}</span></div>}
                        {(p2.returnIds || []).length > 0 && <div><span className="badge b-amber" style={{ marginBottom: 3 }}>مرتجع · {money(-sum((ops.invoices || []).filter(x => (p2.returnIds || []).includes(x.id)), x => x.amount))}</span></div>}{inv ? <span className="badge b-mint">مفوترة · {invs.filter(x => !x.creditNote).map(x => x.invoiceNo).join('، ')}</span> : <span className="badge b-dim">لم تُفوتر</span>}{p2.priceAlert ? <div><span className="badge b-rose" style={{ marginTop: 3 }}>⚠ سعر مرتفع في {p2.priceAlert} بند</span></div> : null}</td>
                      <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                        <button className="btn sm gh" onClick={() => printPO(p2)}><Printer size={12} /></button>
                        {p2.status === 'pending' && wfOn(org, 'po') && (() => { const S = wfState(org, 'po', p2, poTotal(p2)); return S.req.length ? <span className="badge b-amber" data-wfstep>المستوى {S.done.length + 1}/{S.req.length}: {S.next ? S.next.label : ''}</span> : null; })()}
                        {(canApprovePo || (wfOn(org, 'po') && wfCanAct(org, 'po', p2, poTotal(p2), me).ok)) && p2.status === 'pending' && <><button className="btn sm pri" onClick={() => decidePo(p2, true)}>اعتماد</button><button className="btn sm gh" onClick={() => decidePo(p2, false)}>رفض</button></>}
                        {canInspect && (p2.grns || []).filter(g => g.status === 'qc').map(g => <button key={g.id} className="btn sm pri" data-qc onClick={() => setQc({ po: p2, g, acc: g.lines.map(l => String(l.qty)), why: g.lines.map(() => '') })}>فحص {g.grn}</button>)}
                        {canBill && grnsToBill(p2).length > 0 && !p2.pinv && <button className="btn sm pri" data-cv onClick={() => openCv(p2)}>تحويل لفاتورة</button>}
                        {canApprovePo && p2.pinv && <><button className="btn sm pri" onClick={() => decidePinv(p2, true)}>اعتماد الفرق</button><button className="btn sm gh" onClick={() => decidePinv(p2, false)}>رفض الفاتورة</button></>}
                        {canInspect && inspectOn && p2.status === 'partial' && (p2.lines || []).some(l => remOfLine(l) > 0) && !(p2.lines || []).some(l => (Number(l.inQc) || 0) > 0) && <button className="btn sm gh" onClick={() => closeRest(p2)}>إقفال المتبقي</button>}
                        {canPay && !locked2 && p2.status !== 'received' && p2.status !== 'closed' && (p2.lines || []).some(l => remOfLine(l) > 0) && <button className="btn sm" onClick={() => setRecv({ po: p2, qtys: p2.lines.map(l => String(remOfLine(l))), whId: poWhOf(org, p2), date: today(), supInvNo: '', taxable: true, batch: p2.lines.map(() => ''), expiry: p2.lines.map(() => '') })}>تسجيل استلام</button>}
                        {canPay && (p2.lines || []).some(l => (Number(l.received) || 0) > (Number(l.returned) || 0)) && <button className="btn sm gh" onClick={() => retOpen(p2)}>مرتجع</button>}
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
        <Modal title={newInv.replaces ? 'تعديل فاتورة المورد ' + (newInv.invoiceNo || '') : newInv.poId ? 'فاتورة من أمر الشراء' : 'فاتورة توريد جديدة'} icon={FileText} onClose={() => setNewInv(null)}
          foot={<><button className="btn gh" onClick={() => setNewInv(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveInv}><Check size={14} />تسجيل الفاتورة</button></>}>
          <div className="grid g2">
            <Field label="المورد">
              <select className="sel" value={newInv.supplierId} onChange={e => setNewInv(f => ({ ...f, supplierId: e.target.value }))}>
                {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
              {(() => { const L = !newInv.poId && !newInv.copyOf && lastInvOf(newInv.supplierId); if (!L || (newInv.lines || []).some(l => l.itemId)) return null;
                return <button type="button" className="btn sm gh" data-replast style={{ marginTop: 4, fontSize: 11 }} onClick={() => setNewInv(f => ({ ...invToForm(L), img: f.img }))}>⧉ تكرار آخر فاتورة لهذا المورد ({L.invoiceNo} · {money(L.amount)})</button>; })()}
              {newInv.copyOf && <div className="hint" data-copyhint>نسخة من فاتورة سابقة — راجع الكميات والأسعار والتاريخ قبل الحفظ</div>}
            </Field>
            <Field label="رقم الفاتورة (اختياري — يُولَّد تلقائياً)">
              <input className="inp" value={newInv.invoiceNo} onChange={e => setNewInv(f => ({ ...f, invoiceNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={newInv.supplierId} invoiceNo={newInv.invoiceNo} amount={newInv.amount} date={newInv.date} />
            </Field>
          </div>
          <div className="grid g3">
            {whOn(org) && <Field label="المستودع المستلِم (للأصناف المخزنية)"><select className="sel" value={newInv.whId || MAIN_WH} onChange={e => setNewInv(f => ({ ...f, whId: e.target.value }))}>{whOf(org).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
            {fxOn && <Field label="العملة"><select className="sel" aria-label="عملة الفاتورة" value={newInv.cur || 'SAR'} onChange={e => { const c = e.target.value; setNewInv(f => ({ ...f, cur: c, rate: isFx(c) ? (f.rate || lastRate(c)) : '' })); }}>{CURS.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>}
            {fxOn && isFx(newInv.cur) && <Field label={'سعر الصرف (ر.س لكل ' + newInv.cur + ')'}><input className="inp n" inputMode="decimal" aria-label="سعر الصرف" value={newInv.rate || ''} onChange={e => setNewInv(f => ({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
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
              خاضعة لضريبة القيمة المضافة — الأسعار قبل الضريبة
            </label>
          </div>
          {(() => { const k = invCalc(newInv); return (<>
            <div className="lbl" style={{ margin: '4px 0 6px' }}>البنود — من الأصناف المضافة{isFx(newInv.cur) ? ' (الأسعار بـ ' + newInv.cur + ')' : ''}</div>
            {(newInv.lines || []).map((l, i) => { const it = items.find(x => x.id === l.itemId); return (
              <div key={i} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }} data-invline data-rowgrp="inv" data-rowi={i}>
                <RowGrip grp="inv" i={i} n={newInv.lines.length} onMove={(a, b) => setNewInv(f => ({ ...f, lines: moveIdx(f.lines, a, b) }))} />
                <ItemPick items={items} label={'صنف البند ' + (i + 1)} value={l.itemId} quickAdd={canAddItem ? { commitOrg, say } : undefined} addHint onChange={(id) => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, itemId: id, uom: ((uomOf((items.find(y => y.id === id) || {}).unit) || {}).ar) || '', baseU: '', price: x.price || String(((items.find(y => y.id === id) || {}).lastPrice) || '') } : x) }))} />
                {it && !uomOk(it) && <span data-uomfix style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, color: 'var(--amber)' }}>وحدة «{it.name}»:
                  <UomSelect label={'وحدة الصنف للبند ' + (i + 1)} value={l.baseU || it.unit} required style={{ width: 150 }} onChange={v => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, baseU: v, uom: v } : x) }))} /></span>}
                {(() => { const itE = invItem(l); if (!itE || !uomOk(itE) || !uomOf(itE.unit)) return null; const us = lineUnits(itE); const cur = us.find(u => u.name === l.uom) ? l.uom : us[0].name;
                  return us.length > 1 ? <select className="sel" style={{ width: 130 }} aria-label={'وحدة البند ' + (i + 1)} data-lineuom value={cur} onChange={e => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, uom: e.target.value } : x) }))}>
                    {us.map(u => <option key={u.name} value={u.name}>{u.name}{u.fac !== 1 ? ' (= ' + (Math.round(u.fac * 1000) / 1000) + ' ' + us[0].name + ')' : ''}</option>)}</select> : <span className="badge b-dim">{cur}</span>; })()}
                <input className="inp n" style={{ width: 90 }} inputMode="decimal" placeholder={'الكمية' + (invItem(l) && uomOf(invItem(l).unit) ? ' (' + (lineUnits(invItem(l)).find(u => u.name === l.uom) ? l.uom : lineUnits(invItem(l))[0].name) + ')' : '')} aria-label={'كمية البند ' + (i + 1)} value={l.qty} onChange={e => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
                <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="سعر الوحدة" aria-label={'سعر البند ' + (i + 1)} value={l.price} onChange={e => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
                {it && <span className={'badge ' + (isStocked(it) ? 'b-sky' : 'b-dim')}>{isStocked(it) ? 'يدخل المخزون' : 'مصروف'}</span>}
                <input className="inp" style={{ flexBasis: '100%', fontSize: 12 }} placeholder="ملاحظة على البند (اختياري)" aria-label={'ملاحظة البند ' + (i + 1)} value={l.note || ''} onChange={e => setNewInv(f => ({ ...f, lines: f.lines.map((x, k2) => k2 === i ? { ...x, note: e.target.value } : x) }))} />
                {(newInv.lines || []).length > 1 && <button className="btn sm gh" title="حذف البند" onClick={() => setNewInv(f => ({ ...f, lines: f.lines.filter((_, k2) => k2 !== i) }))}><X size={13} /></button>}
              </div>); })}
            <button className="btn sm gh" onClick={() => setNewInv(f => ({ ...f, lines: [...(f.lines || []), invLine()] }))}><Plus size={13} />بند آخر</button>
            <div className="mono-b" style={{ margin: '8px 0' }}><span style={{ fontSize: 12 }}>الصافي <span className="num">{money(k.fcNet)}</span>{k.fcVat ? <> + ض <span className="num">{money(k.fcVat)}</span></> : null}</span><span className="num" style={{ fontWeight: 700 }} data-invtotal>{money(k.fcNet + k.fcVat)}{isFx(newInv.cur) ? ' ' + newInv.cur : ''}</span></div>
            {isFx(newInv.cur) && k.fxR > 0 && <div className="note" data-fxsar>بالريال: <b className="num">{money(k.net + k.vat)}</b> ر.س بسعر {newInv.rate}</div>}
            {VatNoField({ supplierId: (newInv.supplierId), vat: (k.vat), value: (newInv.vatNo), onChange: (v => setNewInv(f => ({ ...f, vatNo: v }))) })}
          </>); })()}
          {ImgField({ img: (newInv.img), onImg: ((img) => setNewInv(f => ({ ...f, img }))) })}
          {(() => { const k = invCalc(newInv); return PayBox(newInv, setNewInv, Math.round((k.fcNet + k.fcVat) * 100) / 100, newInv.cur); })()}
        </Modal>
      )}

      {poF && (
        <Modal title={poF.reqId ? 'تحويل طلب شراء إلى أمر شراء' : 'أمر شراء جديد'} icon={ClipboardCheck} onClose={() => setPoF(null)} wide
          foot={<><button className="btn gh" onClick={() => setPoF(null)}>إلغاء</button>
            <button className="btn pri" onClick={savePo}><Check size={14} />إنشاء الأمر</button></>}>
          <div className="grid g2">
            <Field label="المورد">
              <select className="sel" value={poF.supplierId} onChange={e => setPoF(f => ({ ...f, supplierId: e.target.value }))}>
                {suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </Field>
            {whOn(org) && <Field label="المستودع المستلِم (التسليم إليه)">
              <select className="sel" aria-label="مستودع الأمر" value={poF.whId || MAIN_WH} disabled={!!poF.reqId} onChange={e => setPoF(f => ({ ...f, whId: e.target.value }))}>
                {whOf(org).map(w => <option key={w.id} value={w.id}>{w.name}{w.kind === 'main' ? ' (رئيسي)' : ''}</option>)}
              </select>
              <div className="hint">{poF.reqId ? 'من طلب شراء الفرع — يُسلَّم لمستودعه' : 'مستودع فرع ⇐ يستلمه مدير الفرع من «مستودع الفرع» مباشرة'}</div>
            </Field>}
            <Field label="ملاحظة (اختياري)"><input className="inp" value={poF.note} placeholder="توريد أسبوعي…" onChange={e => setPoF(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
          <div className="lbl" style={{ margin: '4px 0 6px' }}>البنود — اختر كل بند من الأصناف المضافة (بالرمز أو الاسم أو الباركود)</div>
          {(poF.lines || []).map((l, i) => (
            <div key={i} className="row" style={{ gap: 7, marginBottom: 7, flexWrap: 'wrap', alignItems: 'center' }} data-rowgrp="po" data-rowi={i}>
              <RowGrip grp="po" i={i} n={poF.lines.length} onMove={(a, b) => setPoF(f => ({ ...f, lines: moveIdx(f.lines, a, b) }))} />
              <ItemPick items={items} label={'صنف البند ' + (i + 1)} value={l.itemId} quickAdd={canAddItem ? { commitOrg, say } : undefined} addHint
                onChange={(id) => { const it = items.find(x => x.id === id); setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, itemId: id, uom: it && it.purchaseUnit && pFactor(it) > 1 ? 'p' : 'b', desc: it ? it.name : '' } : x) })); }} />
              {(() => { const it = items.find(x => x.id === l.itemId); return it && it.purchaseUnit && pFactor(it) > 1 ? (
                <select className="sel" style={{ width: 120 }} value={l.uom || 'p'} onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, uom: e.target.value } : x) }))}>
                  <option value="p">{it.purchaseUnit} ({pFactor(it)})</option><option value="b">{it.unit}</option>
                </select>) : null; })()}
              <input className="inp n" style={{ width: 90 }} inputMode="decimal" placeholder="الكمية" value={l.qty}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="سعر الوحدة" value={l.price}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              {poF.lines.length > 1 && <button className="btn sm gh" onClick={() => setPoF(f => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}><X size={13} /></button>}
              <input className="inp" style={{ flexBasis: '100%', fontSize: 12 }} placeholder="ملاحظة على البند (اختياري)" aria-label={'ملاحظة بند الأمر ' + (i + 1)} value={l.note || ''} onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, note: e.target.value } : x) }))} />
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
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '8px 0' }} data-inspect>
            <input type="checkbox" checked={!!cfgF.inspect} onChange={e => setCfgF(f => ({ ...f, inspect: e.target.checked }))} />مسار الفحص: استلام ← فحص بشخص غير المستلم ← مخزون ← تحويل لفاتورة
          </label>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '8px 0' }} data-fxcfg>
            <input type="checkbox" checked={!!cfgF.fx} onChange={e => setCfgF(f => ({ ...f, fx: e.target.checked }))} />تعدد العملات لفواتير الموردين (عملة وسعر صرف لكل فاتورة وسداد — فرق الصرف ربح/خسارة محقّقة)
          </label>
          {cfgF.inspect && <Num label="تسامح فرق سعر الفاتورة عن أمر الشراء (% من الإجمالي)" value={cfgF.invVarPct} onChange={v => setCfgF(f => ({ ...f, invVarPct: v }))} hint="فاتورة المورد ضمن هذه النسبة تُقيَّد مباشرة، وفوقها تنتظر اعتماد شخص آخر. الفرق يُقيَّد في «فروق أسعار الشراء»" />}
          {cfgF.perpetual && <Field label="بداية الجرد المستمر (شهر)"><input type="month" className="inp" value={cfgF.perpetualFrom} onChange={e => setCfgF(f => ({ ...f, perpetualFrom: e.target.value }))} /></Field>}
          {cfgF.perpetual && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer' }} data-salededuct>
            <input type="checkbox" checked={!!cfgF.saleDeduct} onChange={e => setCfgF(f => ({ ...f, saleDeduct: e.target.checked, saleDeductFrom: f.saleDeductFrom || today() }))} />خصم المبيعات من المخزون تلقائيًا — مع كل فاتورة بيع حسب وصفات المنتجات
          </label>}
          {cfgF.perpetual && cfgF.saleDeduct && <Field label="يبدأ الخصم من تاريخ"><input type="date" className="inp" aria-label="بداية خصم المبيعات" value={cfgF.saleDeductFrom || ''} onChange={e => setCfgF(f => ({ ...f, saleDeductFrom: e.target.value }))} /></Field>}
          {cfgF.perpetual && cfgF.saleDeduct && <div className="note" style={{ fontSize: 11 }}>تُخصم المواد من مستودع الفرع البائع بالكمية الإجمالية (مع الفاقد)، والتحضيرة المخزّنة يُخصم رصيدها هي. الفاتورة الملغاة تُعيد الكمية. يُقيَّد بالتكلفة على «تكلفة المبيعات» (5505). وصرف المواد الداخلة في الوصفات يدويًا يُمنع بعد تاريخ البدء.</div>}
          <div className="note">في الجرد المستمر: الاستلام يُقيَّد على حساب المستودع، والصرف والهالك والتسويات تُقيَّد بتكلفة المتوسط المرجّح لحظة الحركة، والتحويلات تمر بحساب «بضاعة في الطريق». يُنشأ قيد افتتاحي برصيد المخزون في أول يوم من الشهر المختار، ويتوقف قيد تقييم المخزون الدوري. يُفضَّل اختيار بداية شهر غير مقفل.</div>
        </Modal>
      )}

      {qc && (
        <Modal title={'فحص الاستلام — ' + qc.g.grn + ' · ' + qc.po.poNo} icon={ClipboardCheck} onClose={() => setQc(null)} wide
          foot={<><button className="btn gh" onClick={() => setQc(null)}>إلغاء</button><button className="btn pri" data-qcsave onClick={saveQc}><Check size={14} />اعتماد الفحص</button></>}>
          <div className="note" style={{ marginBottom: 8 }}>سجّل الاستلامَ <b>{qc.g.by}</b> بتاريخ <span className="num">{qc.g.date}</span>{qc.g.whId ? ' · ' + whName(org, qc.g.whId) : ''}. أدخل المقبول لكل بند؛ الباقي مرفوض ويبقى مطلوبًا من المورد، ولا يدخل المخزون ولا يُفوتر.</div>
          {qc.g.lines.map((l, k) => { const rj = Math.round((l.qty - Math.min(Math.max(Number(qc.acc[k]) || 0, 0), l.qty)) * 1000) / 1000; return (
            <div key={k} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 150, fontSize: 12.5 }}>{l.desc}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>المستلم <span className="num">{l.qty}</span>{l.uomName ? ' ' + l.uomName : ''}{l.batch ? ' · دفعة ' + l.batch : ''}{l.expiry ? ' · ينتهي ' + l.expiry : ''}</div></div>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" aria-label={'المقبول ' + (k + 1)} value={qc.acc[k]} onChange={e => setQc(q => ({ ...q, acc: q.acc.map((v, i) => i === k ? e.target.value.replace(/[^\d.]/g, '') : v) }))} />
              <span className="badge b-dim">مرفوض <span className="num">{rj}</span></span>
              {rj > 0 && <input className="inp" style={{ flex: 2, minWidth: 160 }} placeholder="سبب الرفض (إلزامي)" value={qc.why[k]} onChange={e => setQc(q => ({ ...q, why: q.why.map((v, i) => i === k ? e.target.value : v) }))} />}
            </div>); })}
        </Modal>
      )}

      {cvModalEl}

      {svc && (() => { const k = svcCalc(svc); return (
        <Modal title="فاتورة خدمات ومصروفات" icon={FileText} onClose={() => setSvc(null)} wide
          foot={<><button className="btn gh" onClick={() => setSvc(null)}>إلغاء</button><button className="btn pri" data-svcsave onClick={saveSvc}><Check size={14} />تسجيل الفاتورة</button></>}>
          <div className="grid g3">
            <Field label="المورد"><select className="sel" value={svc.supplierId} onChange={e => setSvc(f => ({ ...f, supplierId: e.target.value }))}>{suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}</select></Field>
            <Field label="رقم فاتورة المورد (اختياري — يُولَّد تلقائيًا)"><input className="inp" value={svc.invoiceNo} onChange={e => setSvc(f => ({ ...f, invoiceNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={svc.supplierId} invoiceNo={svc.invoiceNo} /></Field>
            {projList(org).length > 0 && <Field label="المشروع (اختياري)"><select className="sel" aria-label="مشروع فاتورة الخدمات" value={svc.projectId || ''} onChange={e => setSvc(x => ({ ...x, projectId: e.target.value }))}><option value="">—</option>{projList(org).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field>}
            <Field label="الفرع / مركز التكلفة"><select className="sel" value={svc.branchId} onChange={e => setSvc(f => ({ ...f, branchId: e.target.value }))}><option value="">المركز الرئيسي</option>{myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="تاريخ الفاتورة"><input type="date" className="inp" value={svc.date} onChange={e => setSvc(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="تاريخ الاستحقاق"><input type="date" className="inp" value={svc.dueDate} onChange={e => setSvc(f => ({ ...f, dueDate: e.target.value }))} /></Field>
            {fxOn && <Field label="العملة"><select className="sel" aria-label="عملة الفاتورة" value={svc.cur || 'SAR'} onChange={e => { const c = e.target.value; setSvc(f => ({ ...f, cur: c, rate: isFx(c) ? (f.rate || lastRate(c)) : '' })); }}>{CURS.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>}
            {fxOn && isFx(svc.cur) && <Field label={'سعر الصرف (ر.س لكل ' + svc.cur + ')'}><input className="inp n" inputMode="decimal" aria-label="سعر الصرف" value={svc.rate || ''} onChange={e => setSvc(f => ({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
          </div>
          {svc.lines.map((l, i) => (
            <div key={i} className="row" style={{ gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }} data-svcline data-rowgrp="svc" data-rowi={i}>
              <RowGrip grp="svc" i={i} n={svc.lines.length} onMove={(a, b) => setSvc(f => ({ ...f, lines: moveIdx(f.lines, a, b) }))} />
              <input className="inp" style={{ flex: 2, minWidth: 150 }} placeholder="وصف البند (صيانة مكيف، كهرباء نوفمبر…)" value={l.desc} onChange={e => setSvc(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) }))} />
              <select className="sel" style={{ flex: 2, minWidth: 170 }} aria-label={'حساب البند ' + (i + 1)} value={l.accCode} onChange={e => setSvc(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, accCode: e.target.value } : x) }))}>
                <option value="">— الحساب —</option>{svcGroups.map(([k, l]) => <optgroup key={k || 'x'} label={ACC_KIND_AR[k] || 'أخرى'}>{l.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</optgroup>)}</select>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="قبل الضريبة" aria-label={'مبلغ البند ' + (i + 1)} value={l.net} onChange={e => setSvc(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, net: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              {!!(org.taxCfg || {}).enabled && <label className="row" style={{ gap: 4, fontSize: 11.5 }}><input type="checkbox" checked={!!l.taxable} onChange={e => setSvc(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, taxable: e.target.checked } : x) }))} />خاضع</label>}
              {svc.lines.length > 1 && <button className="btn sm gh" title="حذف البند" onClick={() => setSvc(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><X size={13} /></button>}
            </div>))}
          <button className="btn sm gh" onClick={() => setSvc(f => ({ ...f, lines: [...f.lines, svcLine()] }))}><Plus size={13} />بند آخر</button>
          <div className="mono-b" style={{ margin: '8px 0' }}><span style={{ fontSize: 12 }}>الصافي <span className="num">{money(k.net)}</span>{k.vat ? <> + ض <span className="num">{money(k.vat)}</span></> : null}</span><span className="num" style={{ fontWeight: 700 }}>{money(k.gross)}{isFx(svc.cur) ? ' ' + svc.cur : ''}</span></div>
          {isFx(svc.cur) && Number(svc.rate) > 0 && <div className="note" data-fxsar>بالريال: <b className="num">{money(k.gross * Number(svc.rate))}</b> ر.س بسعر {svc.rate}</div>}
          {VatNoField({ supplierId: svc.supplierId, vat: k.vat, value: svc.vatNo, onChange: v => setSvc(f => ({ ...f, vatNo: v })) })}
          {ImgField({ img: svc.img, onImg: (img) => setSvc(f => ({ ...f, img })) })}
          {PayBox(svc, setSvc, k.gross, svc.cur)}
          <div className="note">كل بند يُقيَّد على حسابه المختار، وضريبة المدخلات للبنود الخاضعة، والإجمالي إلى ح/ المورد (آجل) ويظهر في كشفه وأعمار ديونه ويُسدَّد من «سداد».</div>
        </Modal>); })()}

      {recv && (
        <Modal title={'تسجيل استلام — ' + recv.po.poNo} icon={Truck} onClose={() => setRecv(null)}
          foot={<><button className="btn gh" onClick={() => setRecv(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveRecv}><Check size={14} />تأكيد الاستلام</button></>}>
          <div className="grid g2">
            {whOn(org) && <Field label="المستودع المستلِم (مستودع الأمر — لا يُغيَّر)">
              <input className="inp" aria-label="المستودع المستلِم" value={whName(org, poWhOf(org, recv.po))} readOnly disabled />
            </Field>}
            <Field label="تاريخ الاستلام"><input type="date" className="inp" value={recv.date || today()} onChange={e => setRecv(r => ({ ...r, date: e.target.value }))} /></Field>
            {<><Field label="رقم فاتورة المورد (من ورقة المورد — تُنشأ الفاتورة تلقائيًا عند المطابقة)"><input className="inp" aria-label="رقم فاتورة المورد" value={recv.supInvNo || ''} placeholder="فارغ = يبقى بلا فاتورة حتى يحوّله المحاسب" onChange={e => setRecv(r => ({ ...r, supInvNo: e.target.value }))} />
              <DupInvHint invoices={ops.invoices} supplierId={recv.po && recv.po.supplierId} invoiceNo={recv.supInvNo} /></Field>
            <Field label="مبلغ فاتورة المورد (شامل الضريبة)"><input className="inp n" inputMode="decimal" aria-label="مبلغ فاتورة المورد" value={recv.supInvAmt || ''} onChange={e => setRecv(r => ({ ...r, supInvAmt: e.target.value.replace(/[^\d.]/g, '') }))} />
              {(() => { const ex = rcvExpected(recv.po, (i) => Math.min(Math.max(Number(recv.qtys[i]) || 0, 0), remOfLine(recv.po.lines[i])), recv.taxable !== false); const a = Number(recv.supInvAmt) || 0;
                return <div className="hint" data-amtmatch={a > 0 && Math.abs(a - ex.gross) <= 0.01 ? 'yes' : 'no'} style={{ color: a > 0 && Math.abs(a - ex.gross) <= 0.01 ? 'var(--mint)' : 'var(--faint)' }}>بسعر الأمر: <span className="num">{money(ex.gross)}</span>{a > 0 ? (Math.abs(a - ex.gross) <= 0.01 ? ' — مطابق ✓' : ' — غير مطابق: يذهب للمحاسب') : ''}</div>; })()}</Field>
            {!!(org.taxCfg || {}).enabled && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', paddingTop: 14 }}>
              <input type="checkbox" checked={recv.taxable !== false} onChange={e => setRecv(r => ({ ...r, taxable: e.target.checked }))} />الفاتورة خاضعة لضريبة القيمة المضافة
            </label>}</>}
          </div>
          {ImgField({ img: recv.img, onImg: (img) => setRecv(r => ({ ...r, img })) })}
          {recv.po.lines.map((l, i) => {
            const rem = remOfLine(l);
            return (
              <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 150, fontSize: 12.5 }}>{l.desc}{l.note ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>📝 {l.note}</div> : null}
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
            return net > 0 && !inspectOn ? <div className="mono-b" style={{ margin: '6px 0' }}><span style={{ fontSize: 12 }}>فاتورة المورد التي ستُنشأ تلقائيًا</span><span className="num">{money(net)}{vat ? ' + ض ' + money(vat) + ' = ' + money(net + vat) : ''}</span></div> : null; })()}
          {inspectOn ? <div className="note" data-grnnote>مسار الفحص مفعّل: يُسجَّل الاستلام بانتظار الفحص — لا يدخل المخزون ولا تُنشأ فاتورة حتى يفحصه شخص غير المستلم، ثم تُحوَّل الكميات المقبولة إلى فاتورة برقم فاتورة المورد.</div> :
          <div className="note">الأصناف المخزنية تدخل المستودع المختار بدفعتها وتاريخ انتهائها، وتُحدَّث تكلفتها بالمتوسط المرجّح، وتُنشأ فاتورة المورد بأسعار أمر الشراء مع استحقاق حسب شروط المورد.{pcfg.perpetualFrom ? ' القيد: من ح/ المخزون إلى ح/ المورد (جرد مستمر).' : ''}</div>}
        </Modal>
      )}

      {pdn && (() => { const f = pdn, inv = f.inv, net = Number(f.net) || 0, vat = f.taxable ? Math.round(net * vRate() / 100 * 100) / 100 : 0; const R = [['فرق سعر', 'red'], ['خصم مكتسب', 'red'], ['نقص أو تلف مطالَب به', 'red'], ['رسوم غير مستحقة', 'red']]; return (
        <Modal title={'إشعار مدين — فاتورة ' + inv.invoiceNo} icon={FileText} onClose={() => setPdn(null)}
          foot={<><button className="btn pri" data-pdn-save onClick={savePdn}><Check size={14} />{f.dir === 'inc' ? 'تسجيل إشعار المورد' : 'إصدار وطباعة'}</button><button className="btn gh" onClick={() => setPdn(null)}>إلغاء</button></>}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className={'btn sm' + (f.dir === 'red' ? ' pri' : ' gh')} data-pdndir="red" onClick={() => setPdn(x => ({ ...x, dir: 'red', acc: inv.accCode || '5198' }))}>نُصدره للمورد (تخفيض)</button>
            <button className={'btn sm' + (f.dir === 'inc' ? ' pri' : ' gh')} data-pdndir="inc" onClick={() => setPdn(x => ({ ...x, dir: 'inc', acc: inv.accCode || '5198' }))}>استلمناه من المورد (زيادة)</button>
          </div>
          <div className="mono-b" style={{ marginBottom: 8 }}><span style={{ fontSize: 12 }}>{inv.supplierName} · {(inv.date || '').slice(0, 10)}</span><span className="num">{money(inv.amount)}{cnOf(inv) > 0 ? ' · سبق تخفيض ' + money(cnOf(inv)) : ''}</span></div>
          {f.dir === 'red' && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{R.map(([t]) => <button key={t} className={'btn sm' + (f.reason === t ? ' pri' : ' gh')} onClick={() => setPdn(x => ({ ...x, reason: t, acc: t === 'خصم مكتسب' ? '4202' : (x.acc === '4202' ? (inv.accCode || '5198') : x.acc) }))}>{t}</button>)}</div>}
          <div className="grid g2">
            <Field label="السبب"><input className="inp" aria-label="سبب إشعار المورد" value={f.reason} onChange={e => setPdn(x => ({ ...x, reason: e.target.value }))} placeholder={f.dir === 'inc' ? 'فرق سعر، رسوم نقل…' : ''} /></Field>
            <Field label={f.dir === 'inc' ? 'رقم إشعار المورد' : 'رقم الإشعار (اختياري)'}><input className="inp" value={f.no} onChange={e => setPdn(x => ({ ...x, no: e.target.value }))} /></Field>
            <Field label="التاريخ"><input type="date" className="inp" value={f.date} onChange={e => setPdn(x => ({ ...x, date: e.target.value }))} /></Field>
            <Field label="المبلغ قبل الضريبة"><input className="inp n" inputMode="decimal" aria-label="مبلغ إشعار المورد" value={f.net} onChange={e => setPdn(x => ({ ...x, net: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="الحساب المقابل"><select className="sel" aria-label="حساب إشعار المورد" value={f.acc} onChange={e => setPdn(x => ({ ...x, acc: e.target.value }))}>{accOpts(inv).filter(o => f.dir === 'red' || o.code !== '4202').map(o => <option key={o.code} value={o.code}>{o.ar}</option>)}</select></Field>
            <Field label="الضريبة"><label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={!!f.taxable} onChange={e => setPdn(x => ({ ...x, taxable: e.target.checked }))} />خاضع بنسبة {vRate()}%</label></Field>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}><span className="badge b-dim">الضريبة {money(vat)}</span><span className="badge b-sky" data-pdn-total>الإجمالي {money(net + vat)}</span></div>
          <div className="note" style={{ marginTop: 8 }}>{f.dir === 'inc'
            ? 'إشعار المورد المدين يزيد التكلفة وضريبة المدخلات وذمة المورد، ويُسدَّد كفاتورة مستقلة مرتبطة بالأصلية.'
            : 'يخفض ذمة المورد والتكلفة (أو يُثبت خصمًا مكتسبًا) ويعكس ضريبة المدخلات المقابلة. نظاميًا يُصدر المورد إشعارًا دائنًا ضريبيًا مقابله — يُطبع الإشعار لإرساله له.'}</div>
        </Modal>); })()}

      {pay && (
        <Modal title={`سداد فاتورة ${pay.invoiceNo}`} icon={Banknote} onClose={() => setPay(null)}
          foot={<><button className="btn pri" onClick={settle}><Check size={14} />تسجيل السداد</button>
            <button className="btn gh" onClick={() => setPay(null)}>إلغاء</button></>}>
          <div className="mono-b" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12 }}>{pay.supplierName} — {pay.branchName}</span>
            <span className="num" style={{ color: 'var(--amber)' }}>المتبقي {money(invRem(pay))}</span>
          </div>
          {pay.cur ? (() => { const fc = Math.min(Number(fxPay.fc) || 0, fxRemFc(pay)), rate = Number(fxPay.rate) || 0, ap = fc >= fxRemFc(pay) - 0.005 ? invRem(pay) : fc * (Number(pay.fxRate) || 0), paid = fc * rate, d = Math.round((paid - ap) * 100) / 100; return (<>
            <div className="mono-b" style={{ marginBottom: 8 }}><span style={{ fontSize: 12 }}>المتبقي بعملة الفاتورة</span><span><span className="num">{money(fxRemFc(pay))} {pay.cur}</span> · سعر الفاتورة <span className="num">{pay.fxRate}</span></span></div>
            <div className="grid g2">
              <Field label={'مبلغ السداد (' + pay.cur + ')'}><input className="inp n" inputMode="decimal" aria-label="مبلغ السداد بالعملة" value={fxPay.fc} onChange={e => setFxPay(x => ({ ...x, fc: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label={'سعر صرف يوم السداد (ر.س لكل ' + pay.cur + ')'}><input className="inp n" inputMode="decimal" aria-label="سعر صرف السداد" value={fxPay.rate} onChange={e => setFxPay(x => ({ ...x, rate: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            </div>
            {fc > 0 && rate > 0 && <div className="note" data-fxdiff={d}>يخرج من المصدر <b className="num">{money(paid)}</b> ر.س، وتُخفَّض ذمة المورد <b className="num">{money(ap)}</b> ر.س (بسعر الفاتورة){Math.abs(d) > 0.004 ? <> — فرق صرف <b>{d > 0 ? 'خسارة' : 'ربح'} <span className="num">{money(Math.abs(d))}</span></b> ر.س يُقيَّد في «أرباح/خسائر فروق العملة»</> : null}.</div>}
          </>); })() :
          <><Num label="مبلغ السداد" value={amt} onChange={setAmt} hint="يمكن السداد جزئياً على دفعات" />
            {pay.source === 'stored' && <Field label="خصم تعجيل سداد مكتسب (اختياري، شامل الضريبة)"><input className="inp n" inputMode="decimal" aria-label="خصم مكتسب" value={disc} onChange={e => { const x = e.target.value.replace(/[^\d.]/g, ''); setDisc(x); setAmt(Math.max(0, Math.round((invRem(pay) - (Number(x) || 0)) * 100) / 100)); }} />
              {Number(disc) > 0 && <div className="hint" data-discnote>يُسجَّل إشعار مدين للمورد بالخصم{taxOf(pay) ? ' ويُخفَّض من ضريبة المدخلات ' + money(Number(disc) - Number(disc) / (1 + vRate() / 100)) : ''} — اطلب من المورد إشعارًا دائنًا ضريبيًا مقابله.</div>}</Field>}</>}
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
