/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { authApi, cloud, bfKey } from '../../storage';
import { Check, ChevronDown, ClipboardCheck, FileText, Send, Banknote, CreditCard, Truck, Plus, Trash2, Receipt, Coins, Minus, Stamp, Landmark, ArrowLeftRight, Wallet, Lock, X, ScanFace, Users, CheckCircle2 } from 'lucide-react';
import { APPS, CameraModal, DENOMS, EXP_CATS, Field, LOCK_MSG, Modal, MoneyField, Num, OutputDialog, PT_TYPE, PhotoField, ROLES, SignaturePad, arDate, buildPartners, businessDay, countDenoms, countedClosing, deficitCfg, deficitPatterns, emptyDenoms, isoD, money, nextPartnerCode, normalizeSupPays, nowISO, payCashPart, paySplits, payTotal, periodLocked, posR2, salesDaySource, sum, uid } from '../../App.jsx';

export function ClosingForm({ org, me, branches, initial, commit, commitOrg, say, onClose, onStartNew, existing = [], invoices = [], branchPartners = [], posOrders = [], posImports = [] }) {
  const [f, setF] = useState(() => initial ? { ...initial, supplierPayments: normalizeSupPays(initial.supplierPayments) } : {
    date: businessDay(), branchId: branches[0]?.id || '',
    openingBalance: branches[0]?.defaultFloat || 0,
    cashSales: 0, cardSales: 0, bankTransferSales: 0,
    deliverySales: (org.deliveryApps || APPS).map(a => ({ appId: a.id, appName: a.n, amount: 0, orderCount: 0, commissionPercentage: a.c })),
    expenses: [], supplierPayments: [], denominationDetails: emptyDenoms(),
    transferredToMainTreasury: 0, varianceReason: '', notes: ''
  });
  const [secs, setSecs] = useState(() => {
    const d = initial || {};
    return {
      sales: true,
      network: (d.cardSales || 0) > 0 || (d.bankTransferSales || 0) > 0,
      delivery: sum(d.deliverySales || [], x => x.amount) > 0,
      expenses: (d.expenses || []).length > 0,
      inventory: true,
      transfer: (d.transferredToMainTreasury || 0) > 0 || !!d.treasuryChoice,
      supplierPay: (d.supplierPayments || []).length > 0,
      notes: !!(d.notes || d.managerSignature || d.sessionPhoto || (d.sessionPhotos || []).length),
    };
  });
  const toggleSec = (k) => setSecs(p => {
    const willOpen = !p[k];
    // على الجوال: قسم واحد مفتوح في كل مرة (أكورديون)
    if (willOpen && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:640px)').matches) {
      return { sales: false, network: false, delivery: false, expenses: false, inventory: false, transfer: false, supplierPay: false, notes: false, [k]: true };
    }
    return { ...p, [k]: !p[k] };
  });
  const allSecsOpen = Object.values(secs).every(Boolean);
  const setAllSecs = (v) => setSecs({ sales: v, network: v, delivery: v, expenses: v, inventory: v, transfer: v, supplierPay: v, notes: v });
  const [cam, setCam] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [outPrompt, setOutPrompt] = useState(false);
  const [pend, setPend] = useState(null);
  const [done, setDone] = useState(null);
  const [newParty, setNewParty] = useState(null);   // إضافة مورد/موظف/عميل إلى الرئيسي من الإغلاق
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const branch = org.branches.find(b => b.id === f.branchId);

  // v29.4: المجاميع تُقرَّب للهللة — جمع الكسور العشرية في JavaScript يترك بواقي (0.1+0.2 = 0.30000000000000004)
  const r2c = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const totalDelivery = r2c(sum(f.deliverySales, d => d.amount));
  const totalRevenue = r2c((Number(f.cashSales) || 0) + (Number(f.cardSales) || 0) + (Number(f.bankTransferSales) || 0) + totalDelivery);
  const cashExp = r2c(sum(f.expenses.filter(e => e.paymentMethod === 'cash'), e => e.amount));
  const totalExp = r2c(sum(f.expenses, e => e.amount));
  const supPays = f.supplierPayments || [];
  const totalSupplierPay = sum(supPays, payTotal);
  const cashSupplierPay = sum(supPays, payCashPart);
  // السداد النقدي للموردين يخرج من الصندوق فيقلّل النقد المتوقع (لضبط الجرد)
  const expected = r2c((Number(f.openingBalance) || 0) + (Number(f.cashSales) || 0) - cashExp - cashSupplierPay);
  const actual = r2c(countDenoms(f.denominationDetails));
  const variance = Math.round((actual - expected) * 100) / 100;
  // v16.8 — يوم بلا نقد متوقع (مبيعات شبكة/تحويل فقط، لا عهدة): الجرد صفر منطقي ولا يعيق الترحيل
  const zeroCashDay = Math.abs(expected) <= 0.004;
  const retained = Math.max(0, actual - f.transferredToMainTreasury);

  const setDen = (k, v) => set('denominationDetails', { ...f.denominationDetails, [k]: Math.max(0, v) });
  // v15.18 — صور توثيق متعددة عند الترحيل، بتوافق خلفي كامل: الإغلاقات القديمة بحقلها
  // المفرد sessionPhoto تُعرض وتعمل كما هي، والجديدة تحمل sessionPhotos + أول صورة تُنسخ
  // في sessionPhoto نفسه حتى تبقى كل الشاشات/التقارير/الأرشفة القديمة صحيحة بلا تعديل.
  const sPhotos = f.sessionPhotos || (f.sessionPhoto ? [f.sessionPhoto] : []);
  const setPhotos = (arr) => setF(p => ({ ...p, sessionPhotos: arr, sessionPhoto: arr[0] || '' }));
  const addDelivApp = () => set('deliverySales', [...f.deliverySales, { appId: uid('app'), appName: '', amount: 0, orderCount: 0, commissionPercentage: 0, custom: true }]);
  const upDeliv = (i, k, v) => { const n = [...f.deliverySales]; n[i] = { ...n[i], [k]: v }; set('deliverySales', n); };
  const removeDeliv = (i) => set('deliverySales', f.deliverySales.filter((_, x) => x !== i));

  // شركاء الرئيسي المتاحون للربط (موردون + موظفون + عملاء) + شركاء هذا الفرع تحديدًا (لم يُرقَّوا بعد)
  const myBranchPartners = (branchPartners || []).filter(bp => bp.branchId === f.branchId);
  const partyOptions = buildPartners(org, { branchPartners: myBranchPartners }).map(p => ({
    key: p.key, id: p.id, name: p.name, type: (PT_TYPE[p.type] || {}).ar || 'عميل', rawType: p.type, code: p.code,
    source: p.source || 'org', branchOriginName: p.branchOriginName || ''
  }));
  // منع التكرار: هل هذا الاسم (بنفس النوع) موجود مسبقًا ضمن الخيارات المتاحة؟
  const findPartyByName = (name, type) => {
    const q = (name || '').trim().toLowerCase();
    if (!q) return null;
    const t = type === 'supplier' ? 'supplier' : type === 'employee' ? 'employee' : (type || 'customer');
    return partyOptions.find(o => o.name.trim().toLowerCase() === q && o.rawType === t) || null;
  };
  const linkExpParty = (expId, key, name, supplierId) =>
    set('expenses', f.expenses.map(x => x.id === expId ? { ...x, partnerKey: key || undefined, beneficiaryName: name != null ? name : x.beneficiaryName, supplierId } : x));
  const linkPayParty = (payId, key, name, supplierId) =>
    set('supplierPayments', (f.supplierPayments || []).map(x => x.id === payId ? { ...x, partnerKey: key || undefined, supplierName: name != null ? name : x.supplierName, supplierId } : x));
  // سداد الموردين داخل الإغلاق
  const addSupPay = () => set('supplierPayments', [...(f.supplierPayments || []), { id: uid('sp'), partnerKey: '', supplierName: '', cash: 0, card: 0, transfer: 0, other: 0, reference: '' }]);
  const upSupPay = (id, k, v) => set('supplierPayments', (f.supplierPayments || []).map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeSupPay = (id) => set('supplierPayments', (f.supplierPayments || []).filter(x => x.id !== id));
  // مع المصادقة السحابية: كتابة سجل الرئيسي للمدراء فقط — غير الإداري يرسل «طلب اعتماد» بدل كتابة تُرفض
  const canWriteOrg = !(typeof window !== 'undefined' && window.__forceOrgReadonly) && (!authApi.enabled || !!ROLES[me.role]?.admin);

  // حفظ شريك جديد في الرئيسي وربطه بالمصروف/السداد — هذا ما يجعله «ينضاف إلى الرئيسي»
  const saveParty = async () => {
    const np = newParty;
    if (!np.name || !np.name.trim()) return say('اكتب اسم الشريك', 'no');
    const nameQ = np.name.trim();
    // منع التكرار: لو الاسم موجود مسبقًا بنفس النوع (مركزيًا أو في دفتر هذا الفرع) نربط بالبطاقة القائمة بدل تكرارها
    const dupe = findPartyByName(nameQ, np.type);
    if (dupe) {
      if (np.target === 'pay') linkPayParty(np.rowId, dupe.key, dupe.name, dupe.rawType === 'supplier' ? dupe.id : undefined);
      else linkExpParty(np.rowId, dupe.key, dupe.name, dupe.rawType === 'supplier' ? dupe.id : undefined);
      say('«' + dupe.name + '» موجود مسبقًا (' + dupe.code + ') — رُبطت الحركة به بدل تكراره ✓');
      setNewParty(null);
      return;
    }
    if (!canWriteOrg) {
      // v15.14: دور غير إداري: يُضاف فورًا إلى دفتر شركاء هذا الفرع (بلا انتظار اعتماد)، ويُربط بالسطر مباشرة،
      // ويظهر مُجمَّعًا في دفتر الشركاء بالرئيسي — والإدارة تقدر ترقّيه لاحقًا للسجل الرسمي بضغطة واحدة.
      const id = uid('bp');
      const type = np.type === 'supplier' ? 'supplier' : np.type === 'employee' ? 'employee' : (np.type || 'customer');
      const key = (type === 'supplier' ? 'sup:' : type === 'employee' ? 'emp:' : 'cust:') + id;
      const code = nextPartnerCode(buildPartners(org, { branchPartners: myBranchPartners }), type);
      const bp = { id, key, type, name: nameQ, cat: np.cat || '', phone: np.phone || '', code, branchId: f.branchId, branchName: branch?.name || '', createdBy: me.name, at: nowISO() };
      const ok = await commit(d => ({ ...d, branchPartners: [bp, ...(d.branchPartners || [])] }), {
        actionType: 'create', targetType: 'user_account', targetId: id,
        title: 'أضاف شريكاً لدفتر الفرع', details: nameQ + ' — ' + (PT_TYPE[type] || { ar: 'عميل' }).ar + ' · فرع ' + (branch?.name || '')
      });
      if (ok) {
        if (np.target === 'pay') linkPayParty(np.rowId, key, nameQ, type === 'supplier' ? id : undefined);
        else linkExpParty(np.rowId, key, nameQ, type === 'supplier' ? id : undefined);
        say('أُضيف «' + nameQ + '» لدفتر شركاء الفرع ورُبط بالسطر فورًا ✓');
        setNewParty(null);
      }
      return;
    }
    if (!commitOrg) return say('لا تملك صلاحية الإضافة للرئيسي', 'no');
    const name = nameQ, id = uid('pt');
    const code = nextPartnerCode(buildPartners(org, { branchPartners: myBranchPartners }), np.type === 'supplier' ? 'supplier' : np.type === 'employee' ? 'employee' : (np.type || 'customer'));
    let key, mut;
    if (np.type === 'supplier') { key = 'sup:' + id; mut = d => ({ ...d, suppliers: [...(d.suppliers || []), { id, code, name, category: np.cat || '', phone: np.phone || '', vatNo: '', address: '', taxable: false, terms: 0 }] }); }
    else if (np.type === 'employee') { key = 'emp:' + id; mut = d => ({ ...d, employees: [...(d.employees || []), { id, code, name, jobTitle: np.cat || '', phone: np.phone || '', baseSalary: 0, housingAllowance: 0, transportAllowance: 0, branchId: f.branchId, isActive: true }] }); }
    else { key = 'cust:' + id; mut = d => ({ ...d, partners: [...(d.partners || []), { id, key, code, name, type: np.type, cat: np.cat || '', phone: np.phone || '', tax: '', terms: 0 }] }); }
    await commitOrg(mut, { actionType: 'create', targetType: 'user_account', targetId: id, title: 'أضاف شريكاً للرئيسي من الإغلاق', details: name + ' — ' + (PT_TYPE[np.type] || { ar: 'عميل' }).ar });
    if (np.target === 'pay') linkPayParty(np.rowId, key, name, np.type === 'supplier' ? id : undefined);
    else linkExpParty(np.rowId, key, name, np.type === 'supplier' ? id : undefined);
    say('أُضيف إلى دفتر الشركاء بالرئيسي ✓'); setNewParty(null);
  };
  const addExp = () => set('expenses', [...f.expenses, {
    id: uid('ex'), categoryId: (org.expenseCats || EXP_CATS)[0]?.id, categoryName: (org.expenseCats || EXP_CATS)[0]?.n,
    amount: 0, paymentMethod: 'cash', beneficiaryName: '', receiptNumber: '',
    isTaxable: true, taxInvoice: false
  }]);
  const upExp = (id, k, v) => set('expenses', f.expenses.map(e => {
    if (e.id !== id) return e;
    const n = { ...e, [k]: v };
    if (k === 'categoryId') {
      const c = (org.expenseCats || EXP_CATS).find(x => x.id === v);
      n.categoryName = c?.n || '';
      if (!e.taxTouched) n.isTaxable = !!c?.taxable; // احترام تعديل المستخدم اليدوي
    }
    if (k === 'isTaxable') n.taxTouched = true;
    return n;
  }));

  // v16.9 — الإدارة تعدّل إغلاقاً مرحّلاً/معتمداً: يعود مسودةً حصراً ليراجعها الكاشير
  const demoteMode = !!(initial && (initial.status === 'submitted' || initial.status === 'approved'));

  // بناء سجل الإغلاق بعد التحقّق (يعيد null عند فشل التحقّق)
  const buildRecord = (status) => {
    if (!f.branchId) { say('اختر الفرع أولاً', 'no'); return null; }
    if (totalRevenue <= 0) { say('أدخل مبيعات الوردية قبل الحفظ', 'no'); return null; }
    // المرفوض لا يمنع إعادة إغلاق اليوم — حتى لا يُقفل اليوم نهائيًا بعد الرفض
    const dup = existing.find(c => c.branchId === f.branchId && c.date === f.date && c.id !== initial?.id && c.status !== 'rejected');
    if (dup) { say('يوجد إغلاق مسجّل لهذا الفرع بنفس التاريخ — عدّل الإغلاق القائم بدل إنشاء نسخة ثانية', 'no'); return null; }
    if (status === 'submitted') {
      // v16.8: كان يُشترط عدّ موجب دائمًا — فيوم كل مبيعاته شبكة (صندوق صفر) يستحيل إغلاقه.
      // الآن: لا نقد متوقع ← يمر مباشرة؛ نقد متوقع وصندوق فارغ فعلًا ← إقرار صريح + توثيق سبب العجز.
      if (actual <= 0 && !zeroCashDay && !f.zeroCashConfirmed) {
        say('أكمل جرد الفئات النقدية قبل الترحيل — وإن كان الصندوق فارغًا فعلًا فعلّم «الصندوق فارغ» في قسم الجرد', 'no');
        return null;
      }
      if (variance !== 0 && !f.varianceReason.trim()) { say('وثّق سبب العجز أو الفائض قبل الترحيل', 'no'); return null; }
      if (f.transferredToMainTreasury > actual) { say('المرحّل للخزينة يتجاوز النقد المعدود', 'no'); return null; }
      // v15.18: صورة التوثيق إجبارية لكل الأدوار عدا الكاشير (بطلب صريح من المالك) — تبقى متاحة له اختيارياً
      if (me.role !== 'cashier' && sPhotos.length === 0) { say('التقط صورة توثيق المسؤول قبل الترحيل — إجباري', 'no'); return null; }
    }
    const id = initial?.id || 'cl-' + f.branchId + '-' + f.date + '-' + Math.random().toString(36).slice(2, 5);
    const ref = 'TR-' + f.date.replace(/-/g, '') + '-' + f.branchId.slice(-2);
    const rec = {
      ...f, id, branchName: branch?.name || '', managerName: me.name,
      sessionPhotos: sPhotos, sessionPhoto: sPhotos[0] || '',
      deliverySales: f.deliverySales.map(d => ({ ...d, commissionAmount: Math.round(d.amount * (d.commissionPercentage || 0)) / 100 })),
      totalDeliverySales: totalDelivery, otherRevenues: [], totalOtherRevenues: 0,
      totalRevenue, totalExpenses: totalExp, totalCashExpenses: cashExp,
      totalCardExpenses: sum(f.expenses.filter(e => e.paymentMethod === 'card'), e => e.amount),
      expectedCashInSafe: expected, actualCashCount: actual, variance,
      retainedFloatForTomorrow: retained, transferReferenceNo: ref,
      transferStatus: 'pending', status, gmApprovalStatus: 'pending',
      rejectionReason: status === 'submitted' ? '' : (f.rejectionReason || ''),
      // v16.9: عند العودة مسودةً تُمسح آثار التدقيق السابقة — دورة اعتماد جديدة نظيفة
      ...(status === 'draft' ? { auditedBy: '', auditNote: '' } : {}),
      createdBy: me.name, createdAt: initial?.createdAt || nowISO(), updatedAt: nowISO()
    };
    return { rec: { ...rec, closingNo: ref }, id, ref };
  };

  // إتمام الحفظ فعلياً + قيد التدقيق (out = بيانات الإخراج عند الإتمام)
  const finalize = async (status, recIn, id, ref, out) => {
    if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
    const rec = { ...recIn, completion: out ? { ...out, at: nowISO(), by: me.name } : (recIn.completion || null) };
    // v15.18: نتحقق من نجاح الحفظ فعلياً — فشل الحفظ سابقاً كان يُتجاهَل فيظهر «تم الحفظ»
    // ويُغلق النموذج بينما لم يُكتب شيء للسحابة (فتختفي المسودة). الآن: عند الفشل تبقى
    // النافذة مفتوحة ببياناتها كاملة ليعيد المستخدم المحاولة (رسالة الخطأ يعرضها commit).
    const okSave = await commit(d => {
      // سياسة الاحتفاظ: بعد 14 يومًا تُنظَّف الصور من سجل الإغلاق (تبقى نسخها في أرشيف المستندات) لكبح تضخم ملف الفرع
      // v34.7: كانت 60 يومًا — فبلغ ملف فرع ~20MB يُنزَّل ويُرفع مع كل حفظ
      const cutoff = isoD(new Date(Date.now() - 14 * 864e5));
      const pruneImgs = (c) => {
        if (c.imagesPruned || !c.date || c.date >= cutoff || c.status === 'draft') return c;
        if (!c.sessionPhoto && !(c.sessionPhotos || []).length && !c.cardReceiptImage && !(c.expenses || []).some(e => e.receiptImage)) return c;
        return { ...c, sessionPhoto: '', sessionPhotos: [], cardReceiptImage: '', expenses: (c.expenses || []).map(e => e.receiptImage ? { ...e, receiptImage: '' } : e), imagesPruned: true };
      };
      const closings = [rec, ...d.closings.filter(c => c.id !== id)].map(pruneImgs);
      let transfers = d.transfers.filter(t => t.closingId !== id);
      if (status === 'submitted' && rec.transferredToMainTreasury > 0) {
        transfers = [{
          id: uid('tr'), closingId: id, date: f.date, branchId: f.branchId, branchName: rec.branchName,
          amount: rec.transferredToMainTreasury, referenceNo: ref, status: 'pending'
        }, ...transfers];
      }
      let notifications = d.notifications || [];
      const dcf = deficitCfg(org);
      if (status === 'submitted') {
        notifications = [{
          id: uid('n'), type: 'closing_submitted', title: 'إغلاق جديد بانتظار التدقيق',
          message: `${rec.branchName} — ${arDate(f.date)} · إيراد ${money(totalRevenue)} ر.س`,
          severity: variance < -dcf.max ? 'high' : 'medium', branchId: f.branchId, closingId: id,
          date: f.date, createdAt: nowISO(), isRead: false
        }, ...notifications].slice(0, 60);
        // v36.6: تنبيه العجز الفوري فقط فوق الحد المعتمد (كان يُطلق لأي عجز ولو هللات فيضيع المهم بين الكثير)
        if (variance < -dcf.max) notifications = [{
          id: uid('n'), type: 'cash_deficit', title: 'عجز صندوق تجاوز الحد',
          message: `${rec.branchName}: عجز ${money(Math.abs(variance))} ر.س بتاريخ ${arDate(f.date)} (الحد ${money(dcf.max)})${f.varianceReason ? ' — السبب: ' + String(f.varianceReason).slice(0, 80) : ''}`,
          severity: 'high', branchId: f.branchId, closingId: id, date: f.date, createdAt: nowISO(), isRead: false
        }, ...notifications].slice(0, 60);
        // نمط: تكرار العجز في الفرع نفسه خلال النافذة (يشمل هذا الإغلاق) — تنبيه واحد لكل فرع ويوم
        if (variance < -0.004) { const pt = deficitPatterns(org, closings, [f.branchId], f.date)[0];
          if (pt && !notifications.some(n => n.type === 'deficit_pattern' && n.branchId === f.branchId && n.date === f.date)) notifications = [{
            id: uid('n'), type: 'deficit_pattern', title: 'عجز متكرر في فرع',
            message: `${rec.branchName}: ${pt.n} حالات عجز خلال ${dcf.days} أيام بإجمالي ${money(Math.abs(pt.total))} ر.س — راجع الكاشير والإجراءات`,
            severity: 'high', branchId: f.branchId, date: f.date, createdAt: nowISO(), isRead: false
          }, ...notifications].slice(0, 60); }
      }
      // v16.9: الإدارة أعادت إغلاقاً مرحّلاً/معتمداً إلى مسودة — إشعار حتى يراجعه الكاشير ويرحّله
      if (status === 'draft' && demoteMode) {
        notifications = [{
          id: uid('n'), type: 'closing_reverted', title: 'إغلاق أُعيد مسودةً للمراجعة',
          message: `${rec.branchName} — ${arDate(f.date)} · عدّلته الإدارة (${me.name}) وأعادته مسودة — راجعه ورحّله من جديد`,
          severity: 'medium', branchId: f.branchId, closingId: id, date: f.date, createdAt: nowISO(), isRead: false
        }, ...notifications].slice(0, 60);
      }
      return { ...d, closings, transfers, notifications };
    }, {
      actionType: initial ? 'update' : 'create', targetType: 'daily_closing', targetId: id,
      branchId: f.branchId, branchName: rec.branchName,
      title: status === 'submitted' ? 'إتمام وترحيل إغلاق وردية'
        : (demoteMode ? 'أعادت الإدارة إغلاقاً مرحّلاً إلى مسودة للمراجعة' : 'حفظ مسودة إغلاق'),
      details: `${rec.branchName} — ${arDate(f.date)} · إيراد ${money(totalRevenue)} · فرق ${money(variance)}`
        + (out ? ` · إخراج: ${out.outputMethod} · جهاز: ${out.device} · بصمة ${(out.reportHash || '').slice(0, 10)}` : ''),
      ...(out ? {
        closingNo: ref, outputMethod: out.outputMethod, printerSize: out.thermalSize,
        pdfStatus: out.pdfStatus, printStatus: out.printStatus, printAttempts: out.printAttempts,
        device: out.device, browser: out.browser, reportHash: out.reportHash
      } : {})
    });
    if (!okSave) { setOutPrompt(false); setPend(null); return; }   // v15.18: لا نجاح زائف — البيانات باقية أمامك، أعد المحاولة

    // ترحيل صور الإغلاق إلى أرشيف المستندات، مرتّبة حسب الفرع واليوم
    let archivedCount = 0;
    try {
      const stamp = arDate(f.date);
      const docs = [];
      const push = (img, cat, catLabel, title, amount) => {
        if (!img) return;
        const pdfA = typeof img === 'string' && img.startsWith('data:application/pdf');
        docs.push({
          id: 'arc-' + id + '-' + cat + (docs.length),
          title, category: cat, categoryLabelAr: catLabel,
          branchId: f.branchId, branchName: rec.branchName,
          fileUrl: img, fileType: pdfA ? 'pdf' : 'image', fileName: title + (pdfA ? '.pdf' : '.jpg'),
          fileSizeKb: Math.round(img.length * 0.75 / 1024),
          uploadDate: f.date, uploadedBy: me.name, amount: amount || 0,
          closingId: id, source: 'closing', uploadedAt: nowISO()
        });
      };
      push(f.cardReceiptImage, 'pos_settlement', 'إثبات شبكة/تحويل', `إثبات الشبكة — ${rec.branchName} ${stamp}`, rec.cardSales);
      (rec.sessionPhotos && rec.sessionPhotos.length ? rec.sessionPhotos : (rec.sessionPhoto ? [rec.sessionPhoto] : []))
        .forEach((img, i, arr) => push(img, 'signature', 'توثيق المسؤول', `توثيق الإغلاق${arr.length > 1 ? ' ' + (i + 1) : ''} — ${rec.branchName} ${stamp}`, 0));
      (f.expenses || []).forEach((e) => push(e.receiptImage, 'expense', 'فاتورة مصروف',
        `${e.categoryName || 'مصروف'}${e.beneficiaryName ? ' — ' + e.beneficiaryName : ''} (${stamp})`, e.amount));

      if (docs.length) {
        const store = await cloud.get(bfKey(f.branchId), { items: [] });
        const prevItems = (store && Array.isArray(store.items)) ? store.items : [];
        const kept = prevItems.filter(x => x.closingId !== id);
        await cloud.set(bfKey(f.branchId), { items: [...docs, ...kept] });   // v28.1: لا اقتطاع لمستندات توثيق الإغلاق
        archivedCount = docs.length;
      }
    } catch (err) { /* الأرشفة تكميلية — لا توقف حفظ الإغلاق */ }

    setOutPrompt(false); setPend(null);
    if (status === 'submitted') {
      say(archivedCount ? `تم إغلاق الوردية ✓ ورُحّل ${archivedCount} مستندًا للأرشيف` : 'تم إغلاق الوردية بنجاح ✓');
      setDone({ branchName: rec.branchName, total: totalRevenue, ref, docsArchived: archivedCount });
    } else {
      say(demoteMode ? 'أُعيد الإغلاق مسودةً وأُشعر الفرع — يراجعه الكاشير ويرحّله من جديد ✓' : 'تم حفظ المسودة');
      onClose();
    }
  };

  // المسودة تُحفظ مباشرة؛ أمّا الإتمام فيتطلب خطوة الإخراج الرسمية أولاً (#21)
  const save = (status) => {
    const built = buildRecord(status);
    if (!built) return;
    if (status === 'submitted' && numAnoms.length && !window.confirm('أرقام غير معتادة في هذا الإغلاق:\n\n• ' + numAnoms.map(x => x.t).join('\n• ') + '\n\nهل راجعتها وهي صحيحة؟')) return;
    if (status === 'submitted') { setPend(built); setOutPrompt(true); }
    else finalize(status, built.rec, built.id, built.ref, null);
  };

  const vatDeduct = sum(f.expenses.filter(e => e.isTaxable), e => e.amount) * 15 / 115;
  // v16.8: الجرد يُعد مكتملاً أيضاً عندما لا نقد متوقع أصلاً (0.00 منطقية) أو أقرّ المستخدم بفراغ الصندوق
  const counted = actual > 0 || zeroCashDay || !!f.zeroCashConfirmed; // لم يُجرد الصندوق بعد؟ لا نُظهر عجزاً وهمياً
  const vColor = !counted ? 'var(--faint)' : variance < 0 ? 'var(--rose)' : variance > 0 ? 'var(--mint)' : 'var(--faint)';
  const vStat = !counted
    ? { c: 'var(--sky)', bg: 'rgba(91,147,196,.10)', bd: 'rgba(91,147,196,.40)', ic: '◔', t: 'أكمل جرد الصندوق (الخطوة 3) لحساب الفرق' }
    : variance === 0
      ? { c: 'var(--mint)', bg: 'rgba(79,178,134,.12)', bd: 'rgba(79,178,134,.45)', ic: '✔', t: 'الصندوق مطابق — لا يوجد ما يمنع الترحيل' }
      : variance < 0
        ? { c: 'var(--rose)', bg: 'rgba(217,84,77,.12)', bd: 'rgba(217,84,77,.45)', ic: '⚠', t: `عجز ${money(Math.abs(variance))} ر.س — التوثيق إلزامي قبل الترحيل` }
        : { c: 'var(--amber)', bg: 'rgba(224,164,88,.12)', bd: 'rgba(224,164,88,.45)', ic: '▲', t: `فائض ${money(variance)} ر.س — راجع إدخالات المبيعات والمصروفات` };
  // v35.2 — فحوص المدقق قبل الترحيل: «يمنع» = يرفضه الترحيل نفسه، «تنبيه» = يُراجع ولا يمنع، «سليم» = مطابق
  const goSec = (keys) => { setSecs(p => { const n = { ...p }; keys.forEach(k => { n[k] = true; }); return n; });
    setTimeout(() => { try { document.getElementById('esec-' + keys[0])?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { } }, 60); };
  // v38.0 — أرقام غير معتادة مقابل تاريخ الفرع (آخر 30 إغلاقًا مرحّلًا): تكشف الصفر الزائد/الناقص قبل الترحيل
  const numAnoms = (() => {
    const H = (existing || []).filter(c => c.branchId === f.branchId && c.date !== f.date && countedClosing(c)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    if (H.length < 5) return [];
    const med = (arr) => { const a = arr.filter(x => x > 0).sort((x, y) => x - y); if (a.length < 5) return 0; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const out = [];
    const mRev = med(H.map(c => Number(c.totalRevenue) || 0));
    if (mRev > 0 && totalRevenue > 0 && (totalRevenue > mRev * 3 || totalRevenue < mRev / 3))
      out.push({ t: 'المبيعات ' + money(totalRevenue) + ' ' + (totalRevenue > mRev ? 'أعلى' : 'أقل') + ' بكثير من المعتاد لهذا الفرع (الوسيط ' + money(mRev) + ') — تأكد من عدد الأصفار', keys: ['sales'] });
    const mExp = med(H.flatMap(c => (c.expenses || []).map(e => Number(e.amount) || 0)));
    f.expenses.forEach(e => { const a = Number(e.amount) || 0;
      if (a > 0 && ((mExp > 0 && a > mExp * 10) || (totalRevenue > 0 && a > totalRevenue * 0.5)))
        out.push({ t: 'مصروف «' + (e.beneficiaryName || e.categoryName || 'بلا وصف') + '» ' + money(a) + ' غير معتاد' + (mExp > 0 ? ' (المعتاد ' + money(mExp) + ')' : '') + ' — تأكد من الرقم', keys: ['expenses'] }); });
    return out;
  })();
  const auditChecks = (() => {
    const L = []; const add = (lvl, t, keys) => L.push({ lvl, t, keys });
    if (totalRevenue <= 0) add('block', 'لا مبيعات مُدخلة لهذه الوردية', ['sales']);
    numAnoms.forEach(x => add('warn', x.t, x.keys));
    const ps = f.branchId ? salesDaySource({ posOrders, posImports }, f.branchId, f.date) : { n: 0 };
    if (ps.n || ps.total) {
      const dCash = posR2((f.cashSales || 0) - (ps.cash || 0)), dCard = posR2((f.cardSales || 0) + (f.bankTransferSales || 0) - (ps.card || 0) - (ps.transfer || 0)),
        dApps = posR2(totalDelivery - Object.values(ps.apps || {}).reduce((a, x) => a + x.amount, 0));
      if (Math.abs(dCash) < 0.01 && Math.abs(dCard) < 0.01 && Math.abs(dApps) < 0.01) add('ok', 'المبيعات مطابقة لنقطة البيع' + (ps.n ? ' (' + ps.n + ' فاتورة)' : ''), ['sales']);
      else add('warn', 'فرق عن نقطة البيع —' + (Math.abs(dCash) >= 0.01 ? ' نقدي ' + money(dCash) : '') + (Math.abs(dCard) >= 0.01 ? ' شبكة ' + money(dCard) : '') + (Math.abs(dApps) >= 0.01 ? ' تطبيقات ' + money(dApps) : ''), ['sales', 'network', 'delivery']);
    }
    if ((f.cardSales || 0) > 0) { if (f.cardReceiptImage) add('ok', 'إثبات تسوية الشبكة مرفق', ['network']); else add('warn', 'إثبات تسوية الشبكة غير مرفق', ['network']); }
    const exNoRcpt = f.expenses.filter(e => (e.amount || 0) > 0 && !e.receiptImage).length, exNoParty = f.expenses.filter(e => (e.amount || 0) > 0 && !(e.beneficiaryName || e.partnerKey || e.supplierId)).length;
    if (f.expenses.length) {
      if (!exNoRcpt && !exNoParty) add('ok', 'كل مصروف له جهة وإيصال', ['expenses']);
      if (exNoParty) add('warn', exNoParty + ' مصروف بلا جهة (مورد/مستفيد)', ['expenses']);
      if (exNoRcpt) add('warn', exNoRcpt + ' مصروف بلا صورة إيصال', ['expenses']);
    }
    if (!counted) add('block', 'جرد الصندوق لم يكتمل', ['inventory']);
    else if (variance !== 0 && !String(f.varianceReason || '').trim()) add('block', (variance < 0 ? 'عجز ' : 'فائض ') + money(Math.abs(variance)) + ' بلا سبب مكتوب', ['inventory']);
    else if (variance !== 0) add('warn', (variance < 0 ? 'عجز ' : 'فائض ') + money(Math.abs(variance)) + ' — موثّق السبب', ['inventory']);
    else add('ok', 'الصندوق مطابق للمتوقع', ['inventory']);
    if (f.transferredToMainTreasury > actual) add('block', 'المرحّل للخزينة يتجاوز النقد المعدود', ['transfer']);
    if (me.role !== 'cashier' && sPhotos.length === 0) add('block', 'صورة توثيق المسؤول مطلوبة', ['notes']);
    return L;
  })();
  const auditBlocks = auditChecks.filter(x => x.lvl === 'block').length, auditWarns = auditChecks.filter(x => x.lvl === 'warn').length;
  const auditBox = (
    <div className="eaudit">
      <div className="eaudit-h"><span>فحوص المدقق قبل الترحيل</span>{auditBlocks ? <span className="badge b-rose">{auditBlocks} يمنع</span> : auditWarns ? <span className="badge b-amber">{auditWarns} تنبيه</span> : <span className="badge b-mint">جاهز</span>}</div>
      {auditChecks.map((x, i) => <button key={i} type="button" className={'eaudit-i ' + x.lvl} onClick={() => goSec(x.keys)}><span className="eaudit-m">{x.lvl === 'ok' ? '✓' : x.lvl === 'warn' ? '!' : '✗'}</span><span>{x.t}</span></button>)}
    </div>
  );
  const summaryRows = (
    <>
      <div className="esum-h">ملخّص النظام · حيّ</div>
      <div className="esum-hero" style={{ borderColor: vStat.bd, background: vStat.bg }}>
        <div className="esum-hero-l">الفرق (الفعلي − المتوقع)</div>
        <div className="esum-hero-v num" style={{ color: vStat.c }}>{counted ? (variance > 0 ? '+' : '') + money(variance) : '—'}</div>
        <div className="esum-badge" style={{ color: vStat.c, borderColor: vStat.bd, background: vStat.bg }}>
          <span>{vStat.ic}</span><span>{!counted ? 'بانتظار الجرد' : variance === 0 ? 'الصندوق متوازن' : variance < 0 ? 'عجز نقدي' : 'فائض نقدي'}</span>
        </div>
      </div>
      <div className="esum-row"><span className="k">المبيعات</span><span className="v num" style={{ color: 'var(--brass)' }}>{money(totalRevenue)}</span></div>
      <div className="esum-row sub"><span className="k">— نقدي</span><span className="v num">{money(f.cashSales)}</span></div>
      <div className="esum-row sub"><span className="k">— شبكة وتحويل</span><span className="v num">{money(f.cardSales + (f.bankTransferSales || 0))}</span></div>
      <div className="esum-row sub"><span className="k">— توصيل</span><span className="v num">{money(totalDelivery)}</span></div>
      <div className="esum-row"><span className="k">المصروفات</span><span className="v num" style={{ color: 'var(--rose)' }}>{money(totalExp)}</span></div>
      <div className="esum-row"><span className="k">المتوقع بالصندوق</span><span className="v num">{money(expected)}</span></div>
      <div className="esum-row"><span className="k">العدّ الفعلي</span><span className="v num" style={{ color: 'var(--brass)' }}>{counted ? money(actual) : '—'}</span></div>
      <div className="esum-row"><span className="k">ض.ق.م القابلة للخصم</span><span className="v num" style={{ color: 'var(--mint)' }}>{money(vatDeduct)}</span></div>
      <div className="esum-net"><span className="k">صافي اليوم</span><span className="v num">{money(totalRevenue - totalExp)}</span></div>
      <div className="cflow-alert" style={{ border: `1px solid ${vStat.bd}`, background: vStat.bg, color: vStat.c, marginTop: 12 }}><span>{vStat.ic}</span><span>{vStat.t}</span></div>
      {auditBox}
    </>
  );

  const sec = (k, Ic, title, subt, valNode, done, body) => (
    <div id={'esec-' + k} className={'esec' + (secs[k] ? ' open' : '') + (done ? ' done' : '')}>
      <button type="button" className="esec-h" onClick={() => toggleSec(k)} aria-expanded={secs[k]}>
        <span className="esec-ic">{done ? <Check size={16} /> : <Ic size={16} />}</span>
        <span className="esec-t"><b>{title}</b><span>{subt}</span></span>
        {valNode != null && <span className="esec-v">{valNode}</span>}
        <ChevronDown size={16} className="esec-chv" />
      </button>
      {secs[k] && <div className="esec-b">{body}</div>}
    </div>
  );

  return (
    <Modal wide flow title={initial ? 'تعديل إغلاق وردية' : 'إغلاق وردية جديد'} icon={ClipboardCheck} onClose={onClose}
      sub={`${branch?.name || 'اختر الفرع'} · ${arDate(f.date)}${initial?.transferReferenceNo ? ' · ' + initial.transferReferenceNo : ''} · ${initial ? (initial.status === 'submitted' ? 'مُرحّل' : 'مسودة') : 'إغلاق جديد'}`}
      foot={demoteMode ? <>
        {/* v16.9: تعديل الإدارة لإغلاق مرحّل/معتمد — الحفظ الوحيد المتاح هو مسودة ليراجعها الكاشير */}
        <button className="btn pri" onClick={() => save('draft')}><FileText size={14} />حفظ كمسودة ليراجعها الكاشير</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button>
      </> : <>
        <button className="btn pri" onClick={() => save('submitted')} title={auditBlocks ? auditChecks.filter(x => x.lvl === 'block').map(x => x.t).join(' · ') : ''}><Send size={14} />ترحيل للإدارة المالية{auditBlocks ? <span className="num" style={{ marginInlineStart: 6, background: 'var(--rose)', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 11 }}>{auditBlocks}</span> : null}</button>
        <button className="btn" onClick={() => save('draft')}>حفظ كمسودة</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button>
      </>}>

      <div className="cflow">
        <div className="cflow-main">
          <div className={'cflow-msum' + (sumOpen ? ' open' : '')}>
            <button type="button" className="cflow-msum-bar" onClick={() => setSumOpen(o => !o)}>
              <span className="msum-i"><small>صافي اليوم</small><b className="num" style={{ color: 'var(--mint)' }}>{money(totalRevenue - totalExp)}</b></span>
              <span className="msum-i"><small>الفرق</small><b className="num" style={{ color: vColor }}>{counted ? money(variance) : '—'}</b></span>
              <span className="msum-chv">الملخّص ▾</span>
            </button>
            <div className="cflow-msum-full">{summaryRows}</div>
          </div>
          <div className="cflow-form">
            {/* v35.2: شريط الخطوات — أربع مراحل الإغلاق، كل خطوة تفتح أقسامها وتنتقل إليها */}
            <nav className="esteps" aria-label="خطوات الإغلاق">
              {[['sales', 'المبيعات', ['sales', 'network', 'delivery'], totalRevenue > 0],
                ['exp', 'المصروفات والموردون', ['expenses', 'supplierPay'], f.expenses.length > 0 || supPays.length > 0, true],
                ['cash', 'النقد والترحيل', ['inventory', 'transfer'], counted && (variance === 0 || !!String(f.varianceReason || '').trim())],
                ['doc', 'التوثيق والترحيل', ['notes'], me.role === 'cashier' || sPhotos.length > 0]].map(([id, t, keys, ok, optional], i) =>
                <button key={id} type="button" className={'estep' + (ok ? ' ok' : '')} onClick={() => goSec(keys)}>
                  <span className="estep-n">{ok ? '✓' : <span className="num">{i + 1}</span>}</span><span className="estep-t">{t}{optional && !ok ? <small>اختياري</small> : null}</span></button>)}
            </nav>
            <div className="eclose-tools">
              <span className="hint">الملخّص وفحوص المدقق تتحدّث فورًا مع كل إدخال</span>
              <button type="button" className="btn sm gh" onClick={() => setAllSecs(!allSecsOpen)}>{allSecsOpen ? 'طيّ الكل' : 'توسيع الكل'}</button>
            </div>

            {sec('sales', Banknote, 'النقد والمبيعات', 'الفرع والتاريخ + العهدة والنقدي', <span className="num">{money(f.cashSales)}</span>, f.cashSales > 0, (
              <>
                <div className="grid g2">
                  <Field label="الفرع">
                    {branches.length <= 1 ? (
                      <div className="inp" style={{ display: 'flex', alignItems: 'center', background: 'var(--ink2)', color: 'var(--txt)', fontWeight: 600 }}>
                        {branch?.name || branches[0]?.name || '—'}
                      </div>
                    ) : (
                      <select className="sel" value={f.branchId} disabled={ROLES[me.role]?.scope === 'own' && !!initial}
                        onChange={e => { const b = org.branches.find(x => x.id === e.target.value); setF(p => ({ ...p, branchId: e.target.value, openingBalance: b?.defaultFloat || 0 })); }}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="تاريخ الوردية">
                    <input type="date" className="inp" value={f.date} onChange={e => set('date', e.target.value)} />
                  </Field>
                </div>
                <div className="grid g2">
                  <Num label="العهدة الافتتاحية" value={f.openingBalance} onChange={v => set('openingBalance', v)} hint="رصيد بداية الوردية" />
                  <Num label="مبيعات نقدية (كاش)" value={f.cashSales} onChange={v => set('cashSales', v)} sum />
                  {(() => { const ps = salesDaySource({ posOrders, posImports }, f.branchId, f.date); if (!ps.n && !ps.total) return null; return (
                    <div className="note" style={{ gridColumn: '1 / -1', borderColor: 'rgba(79,178,134,.45)' }}>
                      <b>{ps.src === 'import' ? 'مبيعات مستوردة من نقطة البيع' : 'نقطة البيع'}:</b> {ps.n ? ps.n + ' فاتورة' : ''} بإجمالي <span className="num">{money(ps.total)}</span> — نقد <span className="num">{money(ps.cash)}</span> · شبكة <span className="num">{money(ps.card)}</span>{Object.keys(ps.apps).length ? ' · تطبيقات ' + money(Object.values(ps.apps).reduce((a, x) => a + x.amount, 0)) : ''}
                      <button type="button" className="btn sm pri" style={{ marginInlineStart: 8 }} onClick={() => setF(p => ({ ...p, cashSales: ps.cash, cardSales: ps.card, bankTransferSales: ps.transfer,
                        deliverySales: (p.deliverySales || []).map(d => ps.apps[d.appId] ? { ...d, amount: ps.apps[d.appId].amount, orderCount: ps.apps[d.appId].n } : { ...d, amount: 0, orderCount: 0 }), posFilled: { at: nowISO(), n: ps.n, total: ps.total } }))}>تعبئة من نقطة البيع</button>
                      {f.posFilled && <span className="badge b-mint" style={{ marginInlineStart: 6 }}>عُبّئ ✓</span>}
                    </div>); })()}
                </div>
              </>
            ))}

            {sec('network', CreditCard, 'الشبكة والتحويل', 'مدى/فيزا + تحويل بنكي مباشر', <span className="num">{money(f.cardSales + (f.bankTransferSales || 0))}</span>, (f.cardSales > 0 || f.bankTransferSales > 0), (
              <>
                <div className="grid g2">
                  <Num label="مبيعات الشبكة (مدى/فيزا)" value={f.cardSales} onChange={v => set('cardSales', v)} sum />
                  <Num label="مبيعات تحويل بنكي مباشر" value={f.bankTransferSales} onChange={v => set('bankTransferSales', v)} />
                </div>
                {(f.cardSales > 0 || f.bankTransferSales > 0) && (
                  <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 4 }}>
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>إثبات تحصيل الشبكة / التحويل</div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>صورة إشعار الشبكة أو سند التحويل — اختياري لكنه يوثّق المبلغ</div>
                      </div>
                      <PhotoField value={f.cardReceiptImage} onChange={v => set('cardReceiptImage', v)} say={say} />
                    </div>
                  </div>
                )}
              </>
            ))}

            {sec('delivery', Truck, 'تطبيقات التوصيل', 'هنقرستيشن · كيتا · جاهز', <span className="num">{money(totalDelivery)}</span>, totalDelivery > 0, (
              <>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="lbl" style={{ margin: 0 }}>مبيعات تطبيقات التوصيل</div>
                  <button className="btn sm" onClick={addDelivApp}><Plus size={13} />إضافة تطبيق</button>
                </div>
                {f.deliverySales.map((d, i) => (
                  <div key={d.appId} className="card" style={{ background: 'var(--ink)', padding: 12, marginBottom: 9 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, gap: 8, flexWrap: 'wrap' }}>
                      {d.custom
                        ? <input className="inp" style={{ maxWidth: 170, minHeight: 38 }} placeholder="اسم التطبيق"
                            value={d.appName} onChange={e => upDeliv(i, 'appName', e.target.value)} />
                        : <div style={{ fontSize: 14, fontWeight: 700 }}>{d.appName}</div>}
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        {d.custom
                          ? <span className="row" style={{ gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--dim)' }}>عمولة</span>
                              <input className="inp n" style={{ maxWidth: 56, minHeight: 38, textAlign: 'center' }} inputMode="decimal" placeholder="%"
                                value={d.commissionPercentage === 0 ? '' : d.commissionPercentage}
                                onChange={e => upDeliv(i, 'commissionPercentage', Number(e.target.value.replace(/[^\d.]/g, '')) || 0)} />
                              <span style={{ fontSize: 11, color: 'var(--dim)' }}>%</span>
                            </span>
                          : <span className="badge b-dim">عمولة <span className="num">{d.commissionPercentage}%</span></span>}
                        {d.custom && <button className="btn sm gh" onClick={() => removeDeliv(i)}><Trash2 size={13} color="#D9544D" /></button>}
                      </div>
                    </div>
                    <div className="grid g2" style={{ gap: 9 }}>
                      <div className="fld" style={{ margin: 0 }}>
                        <label className="lbl">مبيعات التطبيق · يقبل عدة مبالغ</label>
                        <MoneyField value={d.amount} sum onChange={v => upDeliv(i, 'amount', v)} />
                      </div>
                      <div className="fld" style={{ margin: 0 }}>
                        <label className="lbl">عدد الطلبات</label>
                        <input className="inp n" inputMode="numeric" placeholder="0" value={d.orderCount === 0 ? '' : d.orderCount}
                          onChange={e => upDeliv(i, 'orderCount', Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mono-b" style={{ marginTop: 12, borderColor: 'var(--brass-d)' }}>
                  <span style={{ fontSize: 12.5 }}>إجمالي إيراد الوردية</span>
                  <span className="num" style={{ fontSize: 17, color: 'var(--brass)', fontWeight: 600 }}>{money(totalRevenue)}</span>
                </div>
              </>
            ))}

            {sec('expenses', Receipt, 'المصروفات والمشتريات', 'مسحوبات ومشتريات الوردية', <span className="num" style={{ color: 'var(--rose)' }}>{money(totalExp)}</span>, f.expenses.length > 0, (
              <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="lbl" style={{ margin: 0 }}>مصروفات ومسحوبات الوردية</div>
            <button className="btn sm" onClick={addExp}><Plus size={13} />إضافة مصروف</button>
          </div>
          {f.expenses.length === 0 && <div className="empty">لا توجد مصروفات مسجلة على هذه الوردية.</div>}
          {f.expenses.map(e => (
            <div key={e.id} className="card" style={{ padding: 12, marginBottom: 9, background: 'var(--ink)' }}>
              <div className="grid g2" style={{ gap: 9 }}>
                <Field label="بند المصروف">
                  <select className="sel" value={e.categoryId} onChange={ev => upExp(e.id, 'categoryId', ev.target.value)}>
                    {(org.expenseCats || EXP_CATS).map(c => <option key={c.id} value={c.id}>{c.n}</option>)}
                  </select>
                </Field>
                <Field label="طريقة الدفع">
                  <select className="sel" value={e.paymentMethod} onChange={ev => upExp(e.id, 'paymentMethod', ev.target.value)}>
                    <option value="cash">نقداً من الصندوق</option>
                    <option value="card">شبكة (نقاط بيع)</option>
                    <option value="cheque">شيك</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="deferred">آجل (على الحساب)</option>
                  </select>
                </Field>
              </div>
              <div className="grid g3" style={{ gap: 9 }}>
                <Num label="المبلغ" value={e.amount} onChange={v => upExp(e.id, 'amount', v)} sum />
                <Field label="المستفيد / المورد">
                  <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                    <select className="sel" style={{ flex: 1, minWidth: 0 }} value={e.partnerKey || ''}
                      onChange={ev => {
                        const o = partyOptions.find(x => x.key === ev.target.value);
                        linkExpParty(e.id, ev.target.value, o ? o.name : e.beneficiaryName, o && o.key.startsWith('sup:') ? o.id : undefined);
                      }}>
                      <option value="">— اربطه بشريك في الرئيسي (اختياري) —</option>
                      {partyOptions.map(o => <option key={o.key} value={o.key}>{o.code} · {o.name} · {o.type}</option>)}
                    </select>
                    {commitOrg && <button type="button" className="btn sm gh" style={{ flexShrink: 0 }} onClick={() => setNewParty({ target: 'exp', rowId: e.id, type: 'supplier', name: e.beneficiaryName || '', cat: '', phone: '' })}><Plus size={13} />جديد</button>}
                  </div>
                  <input className="inp" value={e.beneficiaryName || ''} placeholder="اسم الجهة"
                    onChange={ev => upExp(e.id, 'beneficiaryName', ev.target.value)} />
                </Field>
                <Field label={e.paymentMethod === 'cheque' ? 'رقم الشيك' : e.paymentMethod === 'bank_transfer' ? 'مرجع التحويل' : 'رقم الإيصال'}>
                  <input className="inp" value={e.receiptNumber || ''} placeholder="اختياري"
                    onChange={ev => upExp(e.id, 'receiptNumber', ev.target.value)} />
                </Field>
              </div>

              {/* التصنيف الضريبي للمشتريات */}
              <div className="grid g2" style={{ gap: 9 }}>
                <div className="fld">
                  <label className="lbl">التصنيف الضريبي</label>
                  <div className="row" style={{ gap: 6 }}>
                    <button type="button" style={{ flex: 1 }} className={'btn sm' + (e.isTaxable ? ' pri' : ' gh')}
                      onClick={() => upExp(e.id, 'isTaxable', true)}>خاضع للضريبة</button>
                    <button type="button" style={{ flex: 1 }} className={'btn sm' + (!e.isTaxable ? ' pri' : ' gh')}
                      onClick={() => upExp(e.id, 'isTaxable', false)}>غير خاضع</button>
                  </div>
                </div>
                {e.isTaxable && (
                  <div className="fld">
                    <label className="lbl">نوع الفاتورة</label>
                    <div className="row" style={{ gap: 6 }}>
                      <button type="button" className={'btn sm' + (e.taxInvoice ? ' pri' : ' gh')}
                        onClick={() => upExp(e.id, 'taxInvoice', true)}>ضريبية</button>
                      <button type="button" className={'btn sm' + (!e.taxInvoice ? ' pri' : ' gh')}
                        onClick={() => upExp(e.id, 'taxInvoice', false)}>مبسّطة</button>
                    </div>
                  </div>
                )}
              </div>

              <PhotoField label="صورة الفاتورة / الإيصال (كاميرا · صورة · PDF)" value={e.receiptImage}
                onChange={v => upExp(e.id, 'receiptImage', v)} say={say}
                onOcr={txt => upExp(e.id, 'note', ((e.note || '') + ' ' + txt).trim().slice(0, 500))} />
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div className="row" style={{ gap: 6 }}>
                  {e.isTaxable ? (
                    <span className="badge b-brass">ض.ق.م 15% ≈ <span className="num">{money(e.amount * 15 / 115)}</span></span>
                  ) : <span className="badge b-dim">غير خاضع للضريبة</span>}
                  {e.isTaxable && e.taxInvoice && <span className="badge b-mint">فاتورة ضريبية</span>}
                  {e.paymentMethod === 'deferred' && <span className="badge b-amber">آجل — على الحساب</span>}
                  {e.paymentMethod === 'cheque' && <span className="badge b-sky">شيك</span>}
                </div>
                <button className="btn sm gh" onClick={() => set('expenses', f.expenses.filter(x => x.id !== e.id))}>
                  <Trash2 size={13} color="#D9544D" />حذف
                </button>
              </div>
            </div>
          ))}
          {f.expenses.length > 0 && (
            <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 12 }}>
              <div className="lbl" style={{ marginBottom: 8 }}>تحليل المشتريات</div>
              <div className="grid g2" style={{ gap: 8 }}>
                <div className="mono-b"><span style={{ fontSize: 11 }}>مشتريات خاضعة للضريبة</span>
                  <span className="num">{money(sum(f.expenses.filter(e => e.isTaxable), e => e.amount))}</span></div>
                <div className="mono-b"><span style={{ fontSize: 11 }}>مشتريات غير خاضعة</span>
                  <span className="num">{money(sum(f.expenses.filter(e => !e.isTaxable), e => e.amount))}</span></div>
                <div className="mono-b"><span style={{ fontSize: 11 }}>ض.ق.م القابلة للخصم</span>
                  <span className="num" style={{ color: 'var(--mint)' }}>{money(sum(f.expenses.filter(e => e.isTaxable), e => e.amount) * 15 / 115)}</span></div>
                <div className="mono-b"><span style={{ fontSize: 11 }}>مشتريات آجلة (ذمم)</span>
                  <span className="num" style={{ color: 'var(--amber)' }}>{money(sum(f.expenses.filter(e => e.paymentMethod === 'deferred'), e => e.amount))}</span></div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[['cash', 'نقد'], ['card', 'شبكة'], ['cheque', 'شيك'], ['bank_transfer', 'تحويل'], ['deferred', 'آجل']].map(([pm, lbl]) => {
                  const v = sum(f.expenses.filter(e => e.paymentMethod === pm), e => e.amount);
                  return v > 0 ? <span key={pm} className="badge b-dim">{lbl}: <span className="num">{money(v)}</span></span> : null;
                })}
              </div>
            </div>
          )}
          <div className="grid g2" style={{ marginTop: 12 }}>
            <div className="mono-b"><span style={{ fontSize: 12 }}>إجمالي المصروفات</span>
              <span className="num" style={{ color: 'var(--rose)', fontWeight: 600 }}>{money(totalExp)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 12 }}>المخصوم نقداً من الصندوق</span>
              <span className="num" style={{ color: 'var(--amber)', fontWeight: 600 }}>{money(cashExp)}</span></div>
          </div>
              </>
            ))}

            {sec('supplierPay', Banknote, 'سداد الموردين', 'دفعات نقد/شبكة/تحويل للموردين', <span className="num" style={{ color: 'var(--mint)' }}>{money(totalSupplierPay)}</span>, supPays.length > 0, (
              <>
          <div className="lbl" style={{ marginBottom: 8 }}>سجّل دفعات سداد الموردين — تُخصم الدفعة النقدية من الصندoق وتظهر في كشف حساب المورد بالرئيسي.</div>
          {supPays.map((pm) => (
            <div key={pm.id} className="card" style={{ background: 'var(--ink)', padding: 12, marginBottom: 10 }}>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <select className="sel" style={{ flex: 1, minWidth: 0 }} value={pm.partnerKey || ''}
                  onChange={ev => { const o = partyOptions.find(x => x.key === ev.target.value); linkPayParty(pm.id, ev.target.value, o ? o.name : pm.supplierName, o && o.key.startsWith('sup:') ? o.id : undefined); }}>
                  <option value="">— اختر المورد من الرئيسي —</option>
                  {partyOptions.map(o => <option key={o.key} value={o.key}>{o.code} · {o.name} · {o.type}</option>)}
                </select>
                {commitOrg && <button type="button" className="btn sm gh" style={{ flexShrink: 0 }} onClick={() => setNewParty({ target: 'pay', rowId: pm.id, type: 'supplier', name: pm.supplierName || '', cat: '', phone: '' })}><Plus size={13} />جديد</button>}
                <button type="button" className="btn sm gh" style={{ flexShrink: 0 }} onClick={() => removeSupPay(pm.id)}><Trash2 size={13} color="#D9544D" /></button>
              </div>
              <input className="inp" style={{ marginBottom: 8 }} value={pm.supplierName || ''} placeholder="اسم المورد"
                onChange={ev => upSupPay(pm.id, 'supplierName', ev.target.value)} />
              {pm.supplierId && invoices.some(i => i.supplierId === pm.supplierId && (i.amount - (i.paidAmount || 0)) > 0) && (
                <select className="sel" style={{ marginBottom: 8 }} value={pm.invoiceId || ''}
                  onChange={ev => {
                    const inv = invoices.find(i => i.id === ev.target.value);
                    set('supplierPayments', (f.supplierPayments || []).map(x => x.id === pm.id
                      ? { ...x, invoiceId: ev.target.value || undefined, reference: inv ? (inv.invoiceNo || x.reference) : x.reference } : x));
                  }}>
                  <option value="">— اربط السداد بفاتورة مفتوحة (اختياري — يمنع الازدواج مع سداد الرئيسي) —</option>
                  {invoices.filter(i => i.supplierId === pm.supplierId && (i.amount - (i.paidAmount || 0)) > 0)
                    .map(i => <option key={i.id} value={i.id}>{i.invoiceNo} · متبقٍ {money(i.amount - (i.paidAmount || 0))}</option>)}
                </select>
              )}
              <div className="lbl" style={{ marginBottom: 4 }}>وزّع السداد على طرق الدفع (يمكن الجمع بينها لنفس الفاتورة)</div>
              <div className="grid g2" style={{ gap: 9 }}>
                <Num label="نقدًا" value={paySplits(pm).cash} onChange={v => upSupPay(pm.id, 'cash', v)} sum />
                <Num label="شبكة" value={paySplits(pm).card} onChange={v => upSupPay(pm.id, 'card', v)} sum />
                <Num label="تحويل" value={paySplits(pm).transfer} onChange={v => upSupPay(pm.id, 'transfer', v)} sum />
                <Num label="غير ذلك" value={paySplits(pm).other} onChange={v => upSupPay(pm.id, 'other', v)} sum />
              </div>
              <div className="grid g2" style={{ gap: 9, marginTop: 9 }}>
                <Field label="المرجع / الفاتورة (اختياري)"><input className="inp" value={pm.reference || ''} placeholder="رقم فاتورة/سند"
                  onChange={ev => upSupPay(pm.id, 'reference', ev.target.value)} /></Field>
                <div className="mono-b" style={{ alignSelf: 'end' }}><span style={{ fontSize: 12 }}>إجمالي هذه الدفعة</span>
                  <span className="num" style={{ color: 'var(--mint)', fontWeight: 700 }}>{money(payTotal(pm))}</span></div>
              </div>
            </div>
          ))}
          <button className="btn sm" onClick={addSupPay}><Plus size={14} />إضافة دفعة سداد مورد</button>
          {supPays.length > 0 && (
            <div className="grid g2" style={{ marginTop: 12 }}>
              <div className="mono-b"><span style={{ fontSize: 12 }}>إجمالي سداد الموردين</span>
                <span className="num" style={{ color: 'var(--mint)', fontWeight: 600 }}>{money(totalSupplierPay)}</span></div>
              <div className="mono-b"><span style={{ fontSize: 12 }}>المخصوم نقداً من الصندوق</span>
                <span className="num" style={{ color: 'var(--amber)', fontWeight: 600 }}>{money(cashSupplierPay)}</span></div>
            </div>
          )}
              </>
            ))}

            {sec('inventory', Coins, 'جرد الصندوق', 'عدّ الفئات النقدية فعليًّا', <span className="num" style={{ color: 'var(--brass)' }}>{counted ? money(actual) : '—'}</span>, counted, (
              <>
          <div className="lbl" style={{ marginBottom: 10 }}>جرد الفئات النقدية — عدّ الصندوق فعلياً</div>
          <div className="notes">
            {DENOMS.map(d => (
              <div key={d.k} className="note" style={{ '--nc': d.c }}>
                <div className="note-v">{d.k === 'coins' ? 'هللات' : d.v}</div>
                <div className="note-u">{d.k === 'coins' ? 'قطع × 0.50' : 'ريال'}</div>
                <div className="note-r">
                  <button className="stp" onClick={() => setDen(d.k, (f.denominationDetails[d.k] || 0) - 1)}><Minus size={12} /></button>
                  <input className="note-i" inputMode="numeric" value={f.denominationDetails[d.k] || 0}
                    onChange={e => setDen(d.k, Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                  <button className="stp" onClick={() => setDen(d.k, (f.denominationDetails[d.k] || 0) + 1)}><Plus size={12} /></button>
                </div>
                <div className="note-t">{money((f.denominationDetails[d.k] || 0) * d.v)}</div>
              </div>
            ))}
          </div>

          <div className="grid g3" style={{ marginTop: 16 }}>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>المتوقع بالصندوق</span>
              <span className="num" style={{ fontWeight: 600 }}>{money(expected)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>العدّ الفعلي</span>
              <span className="num" style={{ fontWeight: 600, color: 'var(--brass)' }}>{money(actual)}</span></div>
            <div className="mono-b" style={{ borderColor: variance === 0 ? 'var(--line)' : variance < 0 ? 'rgba(217,84,77,.5)' : 'rgba(79,178,134,.5)' }}>
              <span style={{ fontSize: 11.5 }}>الفرق</span>
              <span className="num" style={{ fontWeight: 600, color: variance < 0 ? 'var(--rose)' : variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>
                {variance > 0 ? '+' : ''}{money(variance)}
              </span></div>
          </div>

          {/* v16.8: صندوق فارغ فعليًا رغم وجود نقد متوقع — إقرار صريح يفتح الترحيل مع توثيق العجز */}
          {actual === 0 && !zeroCashDay && (
            <label className="row" style={{ gap: 9, marginTop: 12, cursor: 'pointer', padding: '11px 13px', borderRadius: 10, border: '1.5px dashed var(--line-g)', background: 'var(--acc-soft)', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!f.zeroCashConfirmed} onChange={e => set('zeroCashConfirmed', e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 12, lineHeight: 1.7 }}>
                <b>أُجري الجرد والصندوق فارغ فعلًا (0.00)</b> — رغم أن المتوقع <b className="num">{money(expected)}</b>.
                سيُسجَّل الفرق كعجز ويلزم توثيق سببه قبل الترحيل.
              </span>
            </label>
          )}
          {actual === 0 && zeroCashDay && (
            <div className="note" style={{ marginTop: 12 }}>
              لا نقد متوقع بالصندوق لهذا اليوم (مبيعات غير نقدية ولا عهدة افتتاحية) — الجرد مكتمل تلقائيًا بقيمة 0.00 ويمكنك الترحيل مباشرة.
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {counted && (
              <div className="seal" style={{ '--sc': variance === 0 ? 'var(--mint)' : variance < 0 ? 'var(--rose)' : 'var(--amber)' }}>
                <Stamp size={22} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "'Markazi Text',serif" }}>
                    {variance === 0 ? 'الصندوق مطابق تماماً' : variance < 0 ? 'عجز نقدي يستوجب التبرير' : 'فائض نقدي غير مبرر'}
                  </div>
                  <div style={{ fontSize: 11, opacity: .85 }}>
                    {variance === 0 ? 'لا فروقات — يمكن الترحيل مباشرة'
                      : `مقدار الفرق ${money(Math.abs(variance))} ر.س — التوثيق إلزامي قبل الترحيل`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {variance !== 0 && (
            <Field label="سبب العجز أو الفائض (إلزامي)">
              <textarea className="inp" value={f.varianceReason} placeholder="مثال: باقي عميل لم يُستلم / خطأ في إدخال فاتورة"
                onChange={e => set('varianceReason', e.target.value)} />
            </Field>
          )}
              </>
            ))}

            {sec('transfer', Landmark, 'الترحيل للخزينة', 'وجهة نقد اليوم للخزينة الرئيسية', <span className="num">{money(f.transferredToMainTreasury)}</span>, (!!f.treasuryChoice || f.transferredToMainTreasury > 0), (
              <>
          <div className="card" style={{ background: 'var(--ink)', padding: 14, marginBottom: 14, borderColor: 'rgba(200,162,74,.3)' }}>
            <div className="card-t" style={{ fontSize: 13, marginBottom: 4 }}>
              <Landmark size={15} color="var(--brass)" />ماذا تريد أن تفعل بنقد اليوم؟
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 12 }}>
              المبلغ المعدود بالصندوق <span className="num" style={{ color: 'var(--brass)' }}>{money(actual)}</span> ر.س. اختر وجهته:
            </div>
            <div className="grid g3" style={{ gap: 9 }}>
              <button type="button" className={'btn' + (f.treasuryChoice === 'all' ? ' pri' : ' gh')}
                onClick={() => { set('treasuryChoice', 'all'); set('transferredToMainTreasury', actual); }}
                style={{ flexDirection: 'column', height: 'auto', padding: '12px 8px', gap: 5 }}>
                <ArrowLeftRight size={18} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>ترحيل الكل للخزينة</span>
                <span className="num" style={{ fontSize: 11, opacity: .8 }}>{money(actual)}</span>
              </button>
              <button type="button" className={'btn' + (f.treasuryChoice === 'float' ? ' pri' : ' gh')}
                onClick={() => { set('treasuryChoice', 'float'); set('transferredToMainTreasury', Math.max(0, actual - (branch?.defaultFloat || 0))); }}
                style={{ flexDirection: 'column', height: 'auto', padding: '12px 8px', gap: 5 }}>
                <Wallet size={18} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>ترحيل الفائض وإبقاء عهدة</span>
                <span className="num" style={{ fontSize: 11, opacity: .8 }}>عهدة {money(branch?.defaultFloat || 0)}</span>
              </button>
              <button type="button" className={'btn' + (f.treasuryChoice === 'keep' ? ' pri' : ' gh')}
                onClick={() => { set('treasuryChoice', 'keep'); set('transferredToMainTreasury', 0); }}
                style={{ flexDirection: 'column', height: 'auto', padding: '12px 8px', gap: 5 }}>
                <Lock size={18} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>إبقاء الكل عهدة بالفرع</span>
                <span className="num" style={{ fontSize: 11, opacity: .8 }}>0 للخزينة</span>
              </button>
            </div>
          </div>
          <div className="grid g2">
            <Num label="المرحّل للخزينة الرئيسية" value={f.transferredToMainTreasury}
              onChange={v => { set('transferredToMainTreasury', Math.min(v, actual)); set('treasuryChoice', 'custom'); }}
              hint={`أقصى مبلغ متاح ${money(actual)} ر.س — يمكنك تعديله يدوياً`} />
            <div className="fld">
              <label className="lbl">المتبقي كعهدة للغد</label>
              <div className="mono-b"><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>محسوب آلياً</span>
                <span className="num" style={{ fontWeight: 600, color: 'var(--mint)' }}>{money(retained)}</span></div>
            </div>
          </div>
              </>
            ))}

            {sec('notes', FileText, 'التوثيق والملاحظات', 'ملاحظات · توقيع · صور التوثيق', null, !!(f.notes || f.managerSignature || sPhotos.length), (
              <>
          <Field label="ملاحظات الإغلاق">
            <textarea className="inp" value={f.notes} placeholder="ملاحظات المدير على الوردية"
              onChange={e => set('notes', e.target.value)} />
          </Field>
          <Field label={me.role === 'cashier'
            ? 'صور توثيق الوردية (اختيارية للكاشير — يمكن التقاط أكثر من صورة)'
            : 'صور توثيق المسؤول (إجباري قبل الترحيل — يمكن التقاط أكثر من صورة)'}>
            {sPhotos.length > 0 && (
              <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                {sPhotos.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} alt={'توثيق ' + (i + 1)} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                    <button type="button" className="btn sm gh" title="إزالة هذه الصورة"
                      style={{ position: 'absolute', top: -9, insetInlineEnd: -9, padding: '2px 5px', background: 'var(--ink2)', borderRadius: 999 }}
                      onClick={() => setPhotos(sPhotos.filter((_, x) => x !== i))}><X size={11} color="#D9544D" /></button>
                  </div>
                ))}
                <span className="badge b-mint"><Check size={11} />{sPhotos.length > 1 ? sPhotos.length + ' صور موثّقة' : 'تم التوثيق'}</span>
              </div>
            )}
            <button type="button" className="btn sm" onClick={() => setCam(true)}>
              <ScanFace size={13} />{sPhotos.length ? 'التقاط صورة إضافية' : 'التقاط صورة بالكاميرا'}
            </button>
          </Field>
          <Field label="توقيع المسؤول الرقمي">
            <SignaturePad value={f.managerSignature} onChange={v => set('managerSignature', v)} />
          </Field>
              </>
            ))}
          </div>
        </div>
        <aside className="cflow-sum">
          {summaryRows}
        </aside>
      </div>
      {cam && <CameraModal onClose={() => setCam(false)} say={say}
        onCapture={(img) => { setPhotos([...sPhotos, img]); setCam(false); say('تم توثيق الصورة (' + (sPhotos.length + 1) + ') — يمكنك التقاط صورة إضافية من نفس الزر'); }} />}
      {outPrompt && pend && <OutputDialog rec={pend.rec} org={org}
        onCancel={() => { setOutPrompt(false); setPend(null); }}
        onDone={(out) => finalize('submitted', pend.rec, pend.id, pend.ref, out)} />}
      {newParty && (
        <Modal title={canWriteOrg ? 'إضافة شريك جديد إلى الرئيسي' : 'إضافة شريك جديد إلى دفتر الفرع'} icon={Users} onClose={() => setNewParty(null)}
          foot={<><button className="btn pri" onClick={saveParty}><Check size={14} />{canWriteOrg ? 'حفظ وربط' : 'إضافة وربط فورًا'}</button>
            <button className="btn gh" onClick={() => setNewParty(null)}>إلغاء</button></>}>
          <Field label="النوع">
            <select className="sel" value={newParty.type} onChange={ev => setNewParty({ ...newParty, type: ev.target.value })}>
              <option value="supplier">مورد</option>
              <option value="employee">موظف</option>
              <option value="customer">عميل</option>
            </select>
          </Field>
          <Field label="الاسم"><input className="inp" autoFocus list="party-suggest" value={newParty.name} placeholder="اسم المورد/الموظف/العميل"
            onChange={ev => setNewParty({ ...newParty, name: ev.target.value })} />
            <datalist id="party-suggest">{partyOptions.map(o => <option key={o.key} value={o.name} />)}</datalist>
          </Field>
          {newParty.name && newParty.name.trim() && findPartyByName(newParty.name, newParty.type) && (
            <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: -6, marginBottom: 8, lineHeight: 1.7 }}>
              ⚠ «{findPartyByName(newParty.name, newParty.type).name}» موجود مسبقًا ({findPartyByName(newParty.name, newParty.type).code}) — سيُربط السطر بنفس البطاقة بدل إنشاء بطاقة مكررة.
            </div>
          )}
          <div className="grid g2">
            <Field label={newParty.type === 'employee' ? 'المسمى الوظيفي' : 'التصنيف'}><input className="inp" value={newParty.cat}
              onChange={ev => setNewParty({ ...newParty, cat: ev.target.value })} placeholder={newParty.type === 'supplier' ? 'مثال: مواد خام' : ''} /></Field>
            <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={newParty.phone}
              onChange={ev => setNewParty({ ...newParty, phone: ev.target.value })} /></Field>
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6, lineHeight: 1.7 }}>
            {canWriteOrg
              ? 'يُسجَّل مباشرةً في الإدارة الرئيسية (دفتر الشركاء) ويُربط بهذا السطر — فيظهر في كشف حسابه.'
              : 'يُضاف فورًا لدفتر شركاء هذا الفرع ويُربط بالسطر مباشرة بلا انتظار — ويظهر مُجمَّعًا في دفتر الشركاء بالرئيسي فورًا. تقدر الإدارة ترقّيه لاحقًا للسجل الرسمي بضغطة واحدة، وكل حركاته تبقى مربوطة.'}
          </div>
        </Modal>
      )}
      {done && <Modal title="تم إغلاق الوردية" icon={CheckCircle2} onClose={onClose}
        foot={<>
          <button className="btn pri" onClick={() => (onStartNew ? onStartNew() : onClose())}><Plus size={14} />بدء وردية جديدة</button>
          <button className="btn gh" onClick={onClose}>العودة للقائمة</button>
        </>}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(79,178,134,.15)', color: 'var(--mint)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={32} /></div>
          <div style={{ fontFamily: "'Markazi Text',serif", fontSize: 20, fontWeight: 700 }}>تم إغلاق وردية {done.branchName} بنجاح</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 8 }}>الإيراد <span className="num" style={{ color: 'var(--brass)' }}>{money(done.total)}</span> ر.س · سند <span className="num">{done.ref}</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12, lineHeight: 1.7 }}>حُفظ الإغلاق وقيد التدقيق والطباعة. يمكنك بدء وردية جديدة مباشرة أو العودة للقائمة.</div>
          {done.docsArchived > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 10, background: 'rgba(79,178,134,.1)', border: '1px solid rgba(79,178,134,.3)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.7 }}>
              🗄 رُحّلت <b>{done.docsArchived}</b> مستندًا من هذا الإغلاق (إثبات الشبكة/التحويل · توثيق المسؤول · فواتير المصروفات) تلقائيًا إلى <b>«أرشيف المستندات»</b> — تجدها مرتّبة بالفرع والتاريخ.
            </div>
          )}
        </div>
      </Modal>}
    </Modal>
  );
}
