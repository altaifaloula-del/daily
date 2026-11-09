/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect, useMemo } from 'react';
import { EInvoiceOnboard } from './EInvoiceOnboard.jsx';
import { Scale, FileBarChart, ChevronDown, Printer, Settings, Receipt, BarChart3, Lock, Landmark, FileText, TrendingUp, ArrowLeftRight, Store, Users, QrCode, Building2, Truck, ClipboardCheck, ShieldCheck, CalendarDays, Download, Upload, Plus, Grid3x3, Check, Trash2, RefreshCw, Wallet, TrendingDown, AlertTriangle, ChevronRight, ShieldAlert, Eye, ChevronLeft, CircleDollarSign, X } from 'lucide-react';
import { ACCT_SECTIONS, ACC_KIND, Field, Kpi, LOCK_MSG, MizanMerge, Modal, NUM_FACE, Num, ROLES, _xe, acctSecKey, arDate, bankOfBranch, branchBanks, bsLayout, bsRowsOf, buildAccounting, buildPartners, capOK, countedClosing, customerAging, detectStmtMap, entityById, entityList, gosiRatesFor, isLayout, isRowsOf, isoD, lockedThru, makeXlsx, money, monthEnd, monthLedger, multiEntityOn, naMissing, nowISO, openDocWin, parseCsvGrid, parseMt940, parseXlsxGrid, payTotal, periodLocked, posClrOf, printA4, qrSvg, roleEdit, rolePost, snapMonths, stAddDays, stDate, stNum, sum, supplierAging, today, uid, useSecNav, zatcaTLV } from '../../App.jsx';

export function Accounting({ org, ops, me, commit, commitOrg, say, setTab, acctIntent }) {
  const [view, setView] = useState('jr');           // jr قيود · coa دليل · tb ميزان · fs قوائم
  const [vatTab, setVatTab] = useState('form');      // v35.8: أقسام تفاصيل الإقرار
  const [vpay, setVpay] = useState(null);            // v36.1: نموذج سداد الضريبة
  const [vatQ, setVatQ] = useState('');
  const [repOpen, setRepOpen] = useState(false);    // v9.4 قائمة التقارير
  const [stgOpen, setStgOpen] = useState(false);    // v9.4 قائمة الإعدادات
  const [acctNavOpen, setAcctNavOpen] = useState(null); // v28.8 القائمة المنسدلة المفتوحة لأقسام المحاسبة
  // v28.9: طريقة عرض أقسام المحاسبة — 'dd' قوائم منسدلة (الافتراضي) أو 'grid' شبكة بطاقات؛ تُحفظ في متصفح المستخدم فقط
  const [secMode, setSecMode] = useSecNav();   // v31.7: المحاسبة تتبع اختيار عرض الأقسام الموحّد (شبكة / قائمة؛ التبويبات تُعرض قوائم مجمّعة لكثرة الأقسام)
  const acctNavMode = secMode === 'grid' ? 'grid' : 'dd';
  const [acctGridOpen, setAcctGridOpen] = useState(true);
  const switchAcctNav = (m) => { setSecMode(m); setAcctNavOpen(null); setAcctGridOpen(true); };
  const [obD, setObD] = useState(() => {            // v9.7 مسودة الأرصدة الافتتاحية
    const o = org.openingBalances || {};
    const map = {};
    (o.lines || []).forEach(l => { map[l.code] = String((l.debit || 0) || (l.credit || 0)); });
    return { asOf: o.asOf || today(), enabled: o.enabled !== false, map };
  });
  const [open, setOpen] = useState({});             // القيود المفتوحة التفاصيل
  const [stlF, setStlF] = useState(null);           // v9.9 نموذج تسوية كشف تطبيق
  const [yeD, setYeD] = useState(() => {            // v10.3 مسودة إقفال السنة المالية
    const y = org.yearEnd || {};
    return { enabled: !!y.enabled, closeDate: y.closeDate || (String(new Date().getFullYear() - 1) + '-12-31') };
  });
  const [budD, setBudD] = useState(() => {          // v10.5 مسودة الموازنة التقديرية (مبالغ شهرية لكل حساب)
    const bg = org.budget || {};
    const map = {};
    (bg.lines || []).forEach(l => { if (l.amount) map[l.code] = String(l.amount); });
    return { enabled: !!bg.enabled, map };
  });
  const [bMonth, setBMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); // شهر المقارنة
  const [apSel, setApSel] = useState(null);         // v10.7 المورد المختار لكشف الحساب
  const [arSel, setArSel] = useState(null);         // v12.2 العميل المختار لكشف الحساب
  const [arLimitF, setArLimitF] = useState(null);   // v12.2 نموذج تعديل حد ائتمان عميل
  const [fcD, setFcD] = useState(() => { const f = org.forecastCfg || {}; return { monthlySales: f.monthlySales != null ? String(f.monthlySales) : '', monthlyOpex: f.monthlyOpex != null ? String(f.monthlyOpex) : '', buffer: f.safetyBuffer != null ? String(f.safetyBuffer) : '', horizon: f.horizon || 6 }; }); // v11.4 توقّع نقدي
  const [mcMonth, setMcMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); // v11.5 شهر الإقفال
  const [audD, setAudD] = useState(() => { const a = org.auditCfg || {}; return { largeAmount: a.largeAmount != null ? String(a.largeAmount) : '5000' }; }); // v11.6 عتبة التدقيق
  const [einvF, setEinvF] = useState({ mode: 'gross', amount: '', buyer: '', buyerId: '', buyerVat: '', buyerAddress: '', type: 'simplified', invNo: '', date: today(), time: '', desc: 'مبيعات', closingId: '', entity: 'primary' }); // v11.8 الفوترة (زاتكا) · v12.1 المنشأة · v15.2 مبسّطة/ضريبية + بيانات العميل
  const [einvRaw, setEinvRaw] = useState(false); // إظهار سلسلة TLV الخام
  const [coaF, setCoaF] = useState(null); // v15.3 نموذج إضافة/تعديل حساب مخصّص في دليل الحسابات
  const [zkD, setZkD] = useState(() => { const z = org.zakatCfg || {}; return { rate: z.rate != null ? String(z.rate) : '2.5', provisions: z.provisions != null ? String(z.provisions) : '', ltLoans: z.ltLoans != null ? String(z.ltLoans) : '', ltInvest: z.ltInvest != null ? String(z.ltInvest) : '', ownerType: z.ownerType || 'saudi', saudiPct: z.saudiPct != null ? String(z.saudiPct) : '100', incomeTaxRate: z.incomeTaxRate != null ? String(z.incomeTaxRate) : '20' }; }); // v12.5 حاسبة الزكاة · v15.1 نوع الملكية + ضريبة الدخل
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');           // فلتر شهر للقيود
  const [from, setFrom] = useState('');             // فترة الميزان/القوائم
  const [to, setTo] = useState('');
  const [bf, setBf] = useState('');                 // فلتر الفرع: '' الكل · central مركزي · bId
  const [jm, setJm] = useState(null);               // نموذج القيد اليدوي
  const [astF, setAstF] = useState(null);           // نموذج أصل ثابت
  const [dspF, setDspF] = useState(null);           // نموذج بيع/استبعاد أصل
  const [brF, setBrF] = useState({ date: today(), stmt: '', note: '' }); // نموذج تسوية بنكية
  const [brAcc, setBrAcc] = useState('1201');   // v15.20: البنك محل التسوية — التجميعي أو أي بنك فرع معرّف
  const [mPct, setMPct] = useState(null);           // مسودة النسب اليدوية لتوزيع المركز (v8.3)
  const [lockTo, setLockTo] = useState('');         // شهر القفل الجديد (v8.4)
  const [unReason, setUnReason] = useState('');     // سبب الفتح الاستثنائي
  const [unTo, setUnTo] = useState('');             // الحد الجديد بعد الفتح (فارغ = فتح الكل)

  // فتح شاشة محددة قادمة من مركز التطبيقات (دليل/ميزان/قوائم…)
  useEffect(() => { if (acctIntent && acctIntent.v) setView(acctIntent.v); }, [acctIntent && acctIntent.ts]);
  // v11.5 — على شاشة حزمة الإقفال: اضبط فترة التقارير على شهر الإقفال المختار
  const mcLastDay = (m) => { const pr = m.split('-').map(Number); return m + '-' + String(new Date(pr[0], pr[1], 0).getDate()).padStart(2, '0'); };
  useEffect(() => { if (view === 'mclose') { setFrom(mcMonth + '-01'); setTo(mcLastDay(mcMonth)); } }, [view, mcMonth]);

  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const canPost = rolePost(me?.role);            // إدخال/ترحيل (قيود، أرصدة افتتاحية، إضافة حساب/أصل…)
  const canEdit = roleEdit(me?.role);            // v15.9: تعديل/حذف موجود (يُمنع على «محاسب — إدخال بلا تعديل»)
  // v15.10: تخصيص أقسام المحاسبة لكل مستخدم — يُخفى القسم إن أُخفي من «الإعدادات ← ظهور التطبيقات للمستخدمين ← أقسام المحاسبة»
  const acctDeny = useMemo(() => new Set((me && me.appDeny) || []), [me]);
  const viewOK = (v) => !acctDeny.has(acctSecKey(v));
  useEffect(() => { if (!viewOK(view)) setView(ACCT_SECTIONS.map(s => s.v).find(viewOK) || 'jr'); }, [view, acctDeny]);

  const entries = A.entries.filter(e =>
    (!month || (e.date || '').startsWith(month)) &&
    (!q.trim() || (e.title + ' ' + e.no + ' ' + (e.src || '')).includes(q.trim()))
  );
  const kinds = ['asset', 'liab', 'equity', 'rev', 'exp'];
  const srcBadge = (s) => s === 'إغلاق وردية' ? 'b-mint'
    : s === 'كشف الرواتب' ? 'b-sky'
    : s === 'قيد يدوي' || s === 'قيد افتتاحي' ? 'b-violet'
    : s === 'إقفال سنوي' ? 'b-brass'
    : s === 'تحويل خزينة' || s === 'الخزينة الرئيسية' ? 'b-brass'
    : s === 'فاتورة مورد' || s === 'سداد مركزي' || s === 'سداد مورد بالوردية' ? 'b-amber'
    : 'b-dim';
  const fmtBal = (n) => n < 0 ? '(' + money(-n) + ')' : money(n);
  const codeChip = (c) => (
    <span className="num" style={{ fontSize: 10.5, color: 'var(--brass-l)', background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 6, padding: '0 7px' }}>{c}</span>
  );

  // ===== تجميع بفترة/فرع — كل قيد وحدة متوازنة، لذا أي تصفية كاملة القيود تبقى متوازنة =====
  const inPeriod = (e, f, t) => (!f || (e.date || '') >= f) && (!t || (e.date || '') <= t);
  const byBranch = (e) => !bf ? true : bf === 'central' ? !e.branchId : e.branchId === bf;
  const aggOf = (ents) => {
    const m = {};
    ents.forEach(e => e.lines.forEach(l => {
      const a = m[l.code] || (m[l.code] = { debit: 0, credit: 0 });
      a.debit += l.debit; a.credit += l.credit;
    }));
    return m;
  };
  const tbEntries = A.entries.filter(e => inPeriod(e, from, to) && byBranch(e));
  const tbAgg = aggOf(tbEntries);
  const tbD = sum(tbEntries, e => e.debit), tbC = sum(tbEntries, e => e.credit);
  // v36.3: رصيد أول المدة (ما قبل «من») وآخرها — بنفس تصفية الفرع
  const tbOpAgg = from ? aggOf(A.entries.filter(e => (e.date || '') < from && byBranch(e))) : {};
  const TB_VAT = ['1501', '2301', '2302'];
  const tbShow = (a) => !!(tbAgg[a.code] || tbOpAgg[a.code] || ((org.taxCfg || {}).enabled && TB_VAT.includes(a.code)));
  const tbOpen = (a) => tbOpAgg[a.code] ? balOf(a, tbOpAgg) : 0;
  const tbMov = (a) => tbAgg[a.code] || { debit: 0, credit: 0 };
  const tbClose = (a) => { const m = tbMov(a); return Math.round((tbOpen(a) + ((a.kind === 'asset' || a.kind === 'exp') ? m.debit - m.credit : m.credit - m.debit)) * 100) / 100; };
  const fsEntries = A.entries.filter(e => inPeriod(e, from, to) && !e.closing);  // قائمة الدخل بالفترة (تستثني قيد الإقفال السنوي)
  const fsAgg = aggOf(fsEntries);
  const bsEntries = A.entries.filter(e => inPeriod(e, '', to));        // المركز المالي تراكمي حتى تاريخ
  const bsAgg = aggOf(bsEntries);
  const balOf = (a, m) => {
    const x = m[a.code] || { debit: 0, credit: 0 };
    return (a.kind === 'asset' || a.kind === 'exp') ? x.debit - x.credit : x.credit - x.debit;
  };
  // v8.2: قائمة الدخل تحترم فلتر الفرع (bf) — لعرض دخل كل فرع من الرئيسي
  const isEntries = bf ? fsEntries.filter(byBranch) : fsEntries;
  const isAgg = aggOf(isEntries);
  const bfLabel = !bf ? '' : bf === 'central' ? 'القيود المركزية' : (((org.branches || []).find(b => b.id === bf) || {}).name || '');
  const revP = sum(A.accounts.filter(a => a.kind === 'rev'), a => balOf(a, isAgg));
  const expP = sum(A.accounts.filter(a => a.kind === 'exp'), a => balOf(a, isAgg));
  const netP = Math.round((revP - expP) * 100) / 100;
  // v35.7 — الفترة السابقة بنفس الطول مباشرةً قبل الفترة المحددة (تُحسب فقط إذا حُدِّد «من»)
  const prevRange = (() => {
    if (!from) return null;
    const t = to || today(); const d0 = new Date(from + 'T00:00:00'), d1 = new Date(t + 'T00:00:00');
    const days = Math.round((d1 - d0) / 86400000) + 1; if (!(days > 0)) return null;
    const pt = new Date(d0); pt.setDate(pt.getDate() - 1); const pf = new Date(pt); pf.setDate(pf.getDate() - days + 1);
    // شهر كامل ← الشهر السابق كاملًا (لا 30 يومًا)
    const fullMonth = from.slice(8) === '01' && (() => { const e = new Date(d0.getFullYear(), d0.getMonth() + 1, 0); return isoD(e) === t; })();
    if (fullMonth) { const ps = new Date(d0.getFullYear(), d0.getMonth() - 1, 1), pe = new Date(d0.getFullYear(), d0.getMonth(), 0); return { f: isoD(ps), t: isoD(pe) }; }
    return { f: isoD(pf), t: isoD(pt) };
  })();
  const prevAgg = prevRange ? aggOf(A.entries.filter(e => inPeriod(e, prevRange.f, prevRange.t) && !e.closing && (!bf || byBranch(e)))) : null;
  const isKeep = (() => { if (!prevAgg) return null; const k = new Set(); A.accounts.filter(a => a.kind === 'rev' || a.kind === 'exp').forEach(a => { if (Math.abs(balOf(a, isAgg)) > 0.004 || Math.abs(balOf(a, prevAgg)) > 0.004) k.add(a.code); }); return k; })();
  const isY = isLayout(A.accounts, (a) => balOf(a, isAgg), isKeep);   // v35.4: نفس الأرقام بترتيب محاسبي (isY.net = netP)
  const isP = prevAgg ? isLayout(A.accounts, (a) => balOf(a, prevAgg), isKeep) : null;
  const isPmap = isP ? Object.fromEntries(isRowsOf(isP).filter(r => r.k).map(r => [r.k, r.amt])) : null;
  const bsAssets = sum(A.accounts.filter(a => a.kind === 'asset'), a => balOf(a, bsAgg));
  const bsLiab = sum(A.accounts.filter(a => a.kind === 'liab'), a => balOf(a, bsAgg));
  const bsEquity = sum(A.accounts.filter(a => a.kind === 'equity'), a => balOf(a, bsAgg));
  const bsProfit = Math.round((sum(A.accounts.filter(a => a.kind === 'rev'), a => balOf(a, bsAgg))
    - sum(A.accounts.filter(a => a.kind === 'exp'), a => balOf(a, bsAgg))) * 100) / 100;
  const bsOk = Math.abs(bsAssets - (bsLiab + bsEquity + bsProfit)) < 0.01;
  const bsY = bsLayout(A.accounts, (a) => balOf(a, bsAgg), bsProfit);   // v35.7: bsY.assets = bsAssets و bsY.le = الخصوم+الملكية+الربح

  // ===== v10.4: قائمة التدفقات النقدية (الطريقة المباشرة على حسابات النقد) =====
  // النقد وما في حكمه = الحسابات المُعلَّمة cash:true (الخزائن + البنك). صافي أثر أي قيد على النقد = Σ(مدين−دائن) لأسطر النقد.
  // التحويلات الداخلية بين الخزائن أثرها صفر (طرفاها نقد) فتُلغى تلقائيًا. قيد إقفال السنة لا يمسّ النقد فلا يظهر.
  const cashSet = new Set(A.accounts.filter(a => a.cash).map(a => a.code));
  const accByCode = {}; A.accounts.forEach(a => { accByCode[a.code] = a; });
  // v15.3 — إضافة/تعديل/حذف حسابات مخصّصة في دليل الحسابات (الحسابات النظامية محميّة)
  const saveAcct = async () => {
    const f = coaF; const code = String(f.code || '').trim(); const name = String(f.name || '').trim();
    if (!code || !name) return say('أدخل رمز الحساب واسمه', 'no');
    if (!/^[0-9A-Za-z\-]{2,12}$/.test(code)) return say('الرمز: أرقام أو أحرف إنجليزية (2–12)', 'no');
    const clash = A.accounts.find(a => a.code === code && a.code !== f.origCode);
    // v29.4: تغيير رمز حساب عليه حركة يفصل قيوده عنه (تشير للرمز القديم) — يُمنع
    const orig = f.origCode && A.accounts.find(a => a.code === f.origCode);
    if (orig && code !== f.origCode && ((orig.debit || 0) !== 0 || (orig.credit || 0) !== 0)) return say('لا يُغيَّر رمز حساب عليه حركة — يمكن تعديل اسمه فقط', 'no');
    if (clash) return say(clash.custom ? 'يوجد حساب مخصّص بهذا الرمز' : 'الرمز محجوز لحساب نظامي — اختر رمزًا آخر', 'no');
    await commitOrg(d => { const list = (d.customAccounts || []).filter(x => x.code !== f.origCode); return { ...d, customAccounts: [...list, { code, name, kind: f.kind || 'exp' }] }; },
      { actionType: f.origCode ? 'update' : 'create', targetType: 'tax_settings', targetId: code, need: f.origCode ? 'edit' : 'post', title: (f.origCode ? 'تعديل' : 'إضافة') + ' حساب في الدليل', details: code + ' · ' + name });
    setCoaF(null); say('حُفظ الحساب ✓');
  };
  const delAcct = async (a) => {
    if (!a.custom) return say('لا يمكن حذف حساب نظامي', 'no');
    if ((a.debit || 0) !== 0 || (a.credit || 0) !== 0) return say('لا يُحذف حساب عليه حركة — انقل قيوده أولًا', 'no');
    await commitOrg(d => ({ ...d, customAccounts: (d.customAccounts || []).filter(x => x.code !== a.code) }),
      { actionType: 'delete', targetType: 'tax_settings', targetId: a.code, need: 'edit', title: 'حذف حساب من الدليل', details: a.code + ' · ' + a.name });
    say('حُذف الحساب ✓');
  };
  const cashDelta = (e) => sum(e.lines.filter(l => cashSet.has(l.code)), l => l.debit - l.credit);
  const cashBalOver = (ents) => { const m = aggOf(ents); return sum(A.accounts.filter(a => a.cash), a => balOf(a, m)); };
  const cfClassOf = (e) => {                 // التصنيف بحسب الطرف غير النقدي: أصل ثابت⇒استثماري · حقوق ملكية⇒تمويلي · غير ذلك⇒تشغيلي
    const non = e.lines.filter(l => !cashSet.has(l.code));
    if (non.some(l => l.code === '1701' || l.code === '1791')) return 'inv';
    if (non.some(l => (accByCode[l.code] || {}).kind === 'equity')) return 'fin';
    return 'op';
  };
  const cfLabelOf = (e, cls) => {
    if (cls === 'inv') return (e.id || '').startsWith('disp:') ? 'متحصّلات بيع/استبعاد أصول' : 'شراء أصول ثابتة';
    if (cls === 'fin') return e.src === 'قيد افتتاحي' ? 'رأس المال الافتتاحي' : (cashDelta(e) >= 0 ? 'تمويل/إضافات رأس المال' : 'مسحوبات وتوزيعات');
    return ({ 'إغلاق وردية': 'مقبوضات المبيعات', 'مصروف وردية': 'مدفوعات المصروفات التشغيلية', 'سداد مورد بالوردية': 'مدفوعات الموردين', 'سداد مورد': 'مدفوعات الموردين', 'سداد مركزي': 'مدفوعات الموردين', 'كشف الرواتب': 'مدفوعات الرواتب', 'تسوية تطبيقات': 'تحصيل مستحقات تطبيقات التوصيل', 'الخزينة الرئيسية': 'أوامر صرف من الخزينة', 'قيد يدوي': 'حركات نقدية يدوية' })[e.src] || 'حركات تشغيلية أخرى';
  };
  const cfPeriodEntries = A.entries.filter(e => inPeriod(e, from, to) && byBranch(e) && Math.abs(cashDelta(e)) > 0.004);
  const cfBuckets = { op: {}, inv: {}, fin: {} };
  cfPeriodEntries.forEach(e => { const cls = cfClassOf(e); const lb = cfLabelOf(e, cls); cfBuckets[cls][lb] = Math.round(((cfBuckets[cls][lb] || 0) + cashDelta(e)) * 100) / 100; });
  const cfRows = (cls) => Object.entries(cfBuckets[cls]).map(([label, amt]) => ({ label, amt })).sort((a, b) => b.amt - a.amt);
  const cfNet = (cls) => Math.round(sum(Object.values(cfBuckets[cls]), v => v) * 100) / 100;
  const cfOp = cfNet('op'), cfInv = cfNet('inv'), cfFin = cfNet('fin');
  const cfChange = Math.round((cfOp + cfInv + cfFin) * 100) / 100;
  const cfBegin = from ? Math.round(cashBalOver(A.entries.filter(e => (e.date || '') < from && byBranch(e))) * 100) / 100 : 0;
  const cfEndBook = Math.round(cashBalOver(A.entries.filter(e => inPeriod(e, '', to) && byBranch(e))) * 100) / 100;
  const cfEndComputed = Math.round((cfBegin + cfChange) * 100) / 100;
  const cfOk = Math.abs(cfEndComputed - cfEndBook) < 0.01;

  // ===== v10.5: الموازنة التقديرية والانحرافات (مبالغ شهرية · مقارنة الفعلي بالمخطّط لشهر مختار) =====
  const budgetOn = !!(org.budget && org.budget.enabled);
  const budMap = {}; ((org.budget && org.budget.lines) || []).forEach(l => { budMap[l.code] = Number(l.amount) || 0; });
  const budAccounts = A.accounts.filter(a => (a.kind === 'rev' || a.kind === 'exp') && !['4201', '5801', '5150'].includes(a.code));
  const monAgg = aggOf(A.entries.filter(e => (e.date || '').slice(0, 7) === bMonth));
  const budActual = (a) => Math.round(balOf(a, monAgg) * 100) / 100;
  const budRows = budAccounts.filter(a => (budMap[a.code] > 0) || Math.abs(budActual(a)) > 0.004).map(a => {
    const budget = Math.round((budMap[a.code] || 0) * 100) / 100;
    const actual = budActual(a);
    const variance = Math.round((actual - budget) * 100) / 100;
    const pct = budget > 0 ? Math.round(variance / budget * 1000) / 10 : null;
    return { a, budget, actual, variance, pct, over: a.kind === 'exp' ? variance > 0.005 : variance < -0.005 };
  });
  const budRevB = sum(budAccounts.filter(a => a.kind === 'rev'), a => budMap[a.code] || 0);
  const budRevA = sum(budAccounts.filter(a => a.kind === 'rev'), a => budActual(a));
  const budExpB = sum(budAccounts.filter(a => a.kind === 'exp'), a => budMap[a.code] || 0);
  const budExpA = sum(budAccounts.filter(a => a.kind === 'exp'), a => budActual(a));
  const budNetB = Math.round((budRevB - budExpB) * 100) / 100;
  const budNetA = Math.round((budRevA - budExpA) * 100) / 100;

  // ===== v10.6: التحليل المالي والنِسَب ومقارنة الفترات (مشتقّ بالكامل — بلا إعدادات) =====
  const r2 = (n) => Math.round(n * 100) / 100;
  const ymAddC = (ym, k) => { const pr = ym.split('-').map(Number); const t = pr[0] * 12 + (pr[1] - 1) + k; return String(Math.floor(t / 12)).padStart(4, '0') + '-' + String((t % 12) + 1).padStart(2, '0'); };
  const nowYmC = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  const anlEndYm = to ? to.slice(0, 7) : nowYmC;
  const monthIS = (ym) => {
    const ma = aggOf(A.entries.filter(e => (e.date || '').slice(0, 7) === ym && !e.closing && byBranch(e)));
    const rev = sum(A.accounts.filter(a => a.kind === 'rev'), a => balOf(a, ma));
    const exp = sum(A.accounts.filter(a => a.kind === 'exp'), a => balOf(a, ma));
    return { ym, rev: r2(rev), exp: r2(exp), net: r2(rev - exp) };
  };
  const anlTrend = Array.from({ length: 6 }, (_, i) => monthIS(ymAddC(anlEndYm, i - 5)));  // 6 أشهر تنتهي عند الفترة
  const anlCur = anlTrend[5], anlPrev = anlTrend[4];
  const pctChange = (c, p) => Math.abs(p) < 0.005 ? null : (c - p) / Math.abs(p) * 100;
  // النِسَب — الربحية من قائمة الدخل للفترة، والسيولة/الرفع من المركز المالي حتى نهايتها
  const anTotAssets = bsAssets, anTotLiab = bsLiab, anTotEquity = r2(bsEquity + bsProfit);
  const anNetFixed = r2(balOf(accByCode['1701'], bsAgg) + balOf(accByCode['1791'], bsAgg));
  const anInventory = r2(balOf(accByCode['1601'], bsAgg));
  const anCurAssets = r2(anTotAssets - anNetFixed);
  const anCash = r2(cashBalOver(bsEntries.filter(e => byBranch(e))));
  const anDiv = (a, b) => Math.abs(b) < 0.005 ? null : a / b;
  const ratios = {
    netMargin: anDiv(netP, revP), expRatio: anDiv(expP, revP), roa: anDiv(netP, anTotAssets), roe: anDiv(netP, anTotEquity),
    current: anDiv(anCurAssets, anTotLiab), quick: anDiv(anCurAssets - anInventory, anTotLiab), cashRatio: anDiv(anCash, anTotLiab), workingCap: r2(anCurAssets - anTotLiab),
    de: anDiv(anTotLiab, anTotEquity), da: anDiv(anTotLiab, anTotAssets), turnover: anDiv(revP, anTotAssets)
  };
  const pctTxt = (x) => x == null ? '—' : (Math.round(x * 1000) / 10) + '%';
  const xTxt = (x) => x == null ? '—' : (Math.round(x * 100) / 100).toFixed(2) + '×';

  // ===== v10.7: أعمار ديون الموردين وكشوف الحساب =====
  // الفواتير/الآجل (دائن فقط) أعباء مؤرّخة، والسدادات (مدين فقط) تُطبَّق على الأقدم أولًا (FIFO)، والباقي المفتوح يُصنَّف بعُمره.
  // المصروفات المسدّدة فورًا (مدين=دائن) تُستثنى — ليست ذمّة قائمة. المجموع المفتوح = رصيد المورد دائمًا.
  const [apToday, setApToday] = useState(today()); // v15.5: أعمار الموردين كما في تاريخ (قابل للاختيار)
  const apAgingOf = (p) => supplierAging(p, apToday);
  const apSuppliers = buildPartners(org, ops).filter(p => p.type === 'supplier');
  const apRows = apSuppliers.map(p => ({ p, ...apAgingOf(p) })).filter(r => r.total > 0.004 || r.credit > 0.004);
  const apTot = { owed: r2(sum(apRows, r => r.total)), b0: r2(sum(apRows, r => r.b0)), b30: r2(sum(apRows, r => r.b30)), b60: r2(sum(apRows, r => r.b60)), b90: r2(sum(apRows, r => r.b90)), credit: r2(sum(apRows, r => r.credit)), debtors: apRows.filter(r => r.total > 0.004).length };
  const apStmt = (p) => { let run = 0; return (p.txns || []).filter(t => !t.date || t.date <= apToday).map(t => { run = r2(run + (t.credit || 0) - (t.debit || 0)); return { ...t, run }; }); };

  // ===== v12.2: العملاء والذمم المدينة (مرآة الموردين باتجاه معاكس) =====
  const [arToday, setArToday] = useState(today()); // v15.5: أعمار العملاء كما في تاريخ (قابل للاختيار)
  const arCustomers = buildPartners(org, ops).filter(p => p.type === 'customer');
  const custRec = (id) => (org.partners || []).find(x => x.id === id) || {};
  const arRows = arCustomers.map(p => { const ag = customerAging(p, arToday); const limit = Number(custRec(p.id).creditLimit) || 0; return { p, ...ag, limit, over: limit > 0 && ag.total > limit + 0.004 }; }).filter(r => r.total > 0.004 || r.credit > 0.004);
  const arTot = { owed: r2(sum(arRows, r => r.total)), b0: r2(sum(arRows, r => r.b0)), b30: r2(sum(arRows, r => r.b30)), b60: r2(sum(arRows, r => r.b60)), b90: r2(sum(arRows, r => r.b90)), credit: r2(sum(arRows, r => r.credit)), debtors: arRows.filter(r => r.total > 0.004).length, over: arRows.filter(r => r.over).length };
  const arStmt = (p) => { let run = 0; return (p.txns || []).filter(t => !t.date || t.date <= arToday).map(t => { run = r2(run + (t.debit || 0) - (t.credit || 0)); return { ...t, run }; }); };
  const saveArLimit = async () => {
    const f = arLimitF; const lim = Number(String(f.limit).replace(/[^\d.]/g, '')) || 0;
    await commitOrg(d => ({ ...d, partners: (d.partners || []).map(pt => pt.id === f.id ? { ...pt, creditLimit: lim } : pt) }), { actionType: 'update', targetType: 'customer', targetId: f.id, need: 'edit', title: 'تعديل حد ائتمان عميل', details: f.name + ' — ' + money(lim) });
    setArLimitF(null);
  };

  // ===== م3: الضريبة =====
  const taxCfg = org.taxCfg || {};
  const taxOn = !!taxCfg.enabled;
  const taxRate = Number(taxCfg.rate) || 15;
  const canTax = !!ROLES[me?.role]?.admin;
  const vsum = { out: 0, inn: 0, netSales: 0, netPurch: 0 };
  fsEntries.forEach(e => { if (e.vat) { vsum.out += e.vat.out; vsum.inn += e.vat.inn; vsum.netSales += e.vat.netSales; vsum.netPurch += e.vat.netPurch; } });
  const vatDue = Math.round((vsum.out - vsum.inn) * 100) / 100;
  // ===== v35.8 — تفاصيل الإقرار الضريبي: نموذج الهيئة، التحليل حسب المصدر/الفرع/الشهر/المورد، وفحوص المدقق =====
  // كل الأرقام من نفس القيود التي تبني vsum (مجموع التفاصيل = الإجماليات دائمًا)
  const r2x = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const vatX = (() => {
    const ents = fsEntries.filter(e => e.vat && (Math.abs(e.vat.out) > 0.004 || Math.abs(e.vat.inn) > 0.004));
    const brName = (id) => !id ? 'المركز الرئيسي' : (((org.branches || []).find(b => b.id === id) || {}).name || id);
    const invById = {}; (ops.invoices || []).forEach(i => { invById[i.id] = i; });
    const parById = {}; (org.partners || []).forEach(x => { parById[x.id] = x; });
    const clById = {}; (ops.closings || []).forEach(c => { clById[c.id] = c; });
    const F = { s: 0, sAdj: 0, sV: 0, sVAdj: 0, p: 0, pAdj: 0, pV: 0, pVAdj: 0 };
    const bySrc = {}, byBr = {}, byMon = {}, bySup = {};
    const tx = [];
    const noVatSup = { n: 0, vat: 0 }, noRcpt = { n: 0, vat: 0 }; let credits = 0;
    ents.forEach(e => {
      const v = e.vat;
      // التعديلات (إشعارات دائنة/مرتجعات) تُفصل في عمودها كما في نموذج الهيئة
      if (v.out > 0 || v.netSales > 0) { F.s += v.netSales; F.sV += v.out; } else if (v.out < 0 || v.netSales < 0) { F.sAdj += v.netSales; F.sVAdj += v.out; credits++; }
      if (v.inn > 0 || v.netPurch > 0) { F.p += v.netPurch; F.pV += v.inn; } else if (v.inn < 0 || v.netPurch < 0) { F.pAdj += v.netPurch; F.pVAdj += v.inn; credits++; }
      const sk = e.src || 'أخرى'; const S = bySrc[sk] = bySrc[sk] || { n: 0, net: 0, out: 0, inn: 0 };
      S.n++; S.net += (v.netSales || 0) + (v.netPurch || 0); S.out += v.out || 0; S.inn += v.inn || 0;
      const B = byBr[e.branchId || ''] = byBr[e.branchId || ''] || { name: brName(e.branchId), ns: 0, out: 0, np: 0, inn: 0 };
      B.ns += v.netSales || 0; B.out += v.out || 0; B.np += v.netPurch || 0; B.inn += v.inn || 0;
      const mk = (e.date || '').slice(0, 7); const M = byMon[mk] = byMon[mk] || { out: 0, inn: 0, ns: 0, np: 0 };
      M.out += v.out || 0; M.inn += v.inn || 0; M.ns += v.netSales || 0; M.np += v.netPurch || 0;
      let party = '', pVat = '', flag = '';
      if (/^inv:/.test(e.id || '')) {
        const inv = invById[e.id.slice(4)] || {}; const sup = parById[inv.supplierId] || {};
        party = inv.supplierName || sup.name || 'مورد'; pVat = String(sup.vatNo || sup.tax || inv.supplierVat || '').trim();
        const U = bySup[party] = bySup[party] || { name: party, vatNo: pVat, n: 0, net: 0, vat: 0 };
        U.n++; U.net += v.netPurch || 0; U.vat += v.inn || 0;
        if (!pVat && v.inn > 0) { noVatSup.n++; noVatSup.vat += v.inn; flag = 'مورد بلا رقم ضريبي'; }
      } else if (/^exp:/.test(e.id || '')) {
        const parts = e.id.split(':'); const c = clById[parts[1]] || {};
        const x = (c.expenses || []).find((y, ix) => String(y.id || ix) === parts[2]) || {};
        party = x.categoryName || x.party || x.partyName || '';
        if (v.inn > 0 && !x.receiptImage && !x.receiptNumber) { noRcpt.n++; noRcpt.vat += v.inn; flag = 'بلا إيصال'; }
      }
      tx.push({ date: e.date, src: sk, ref: e.ref || '', title: e.title || '', br: brName(e.branchId), party, pVat, ns: r2x(v.netSales), out: r2x(v.out), np: r2x(v.netPurch), inn: r2x(v.inn), flag });
    });
    Object.keys(F).forEach(k => { F[k] = r2x(F[k]); });
    const rnd = (o) => { Object.keys(o).forEach(k => { if (typeof o[k] === 'number' && k !== 'n') o[k] = r2x(o[k]); }); return o; };
    const effRate = vsum.netSales > 0.004 ? Math.round(vsum.out / vsum.netSales * 10000) / 100 : null;
    return {
      F, tx: tx.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      src: Object.entries(bySrc).map(([k, o]) => ({ k, ...rnd(o) })).sort((a, b) => (b.out + b.inn) - (a.out + a.inn)),
      br: Object.values(byBr).map(rnd).sort((a, b) => b.out - a.out),
      mon: Object.entries(byMon).map(([k, o]) => ({ k, ...rnd(o) })).sort((a, b) => a.k.localeCompare(b.k)),
      sup: Object.values(bySup).map(rnd).sort((a, b) => b.vat - a.vat),
      noVatSup: rnd(noVatSup), noRcpt: rnd(noRcpt), credits, effRate,
      rateOk: effRate == null || Math.abs(effRate - taxRate) < 0.15
    };
  })();
  // ===== v36.3 — مطابقة حسابات الضريبة في ميزان المراجعة مع الإقرار =====
  // للفترة نفسها: حركة 2301 (دائن − مدين) و1501 (مدين − دائن) من القيود التشغيلية (بلا قيود الإقفال/السداد الضريبي)
  // يجب أن تساوي ضريبة المخرجات/المدخلات في الإقرار. أي فرق يُردّ إلى قيود محددة تُعرض بالاسم.
  const vatRec = (() => {
    if (!taxOn) return null;
    const pe = A.entries.filter(e => inPeriod(e, from, to) && !e.closing);
    const isTaxSettle = (e) => e.src === 'إقفال ضريبي' || e.src === 'سداد ضريبة';
    const opE = pe.filter(e => !isTaxSettle(e));
    const mv = (code, es) => { let d = 0, c = 0; es.forEach(e => e.lines.forEach(l => { if (l.code === code) { d += l.debit; c += l.credit; } })); return { d: r2x(d), c: r2x(c) }; };
    const o = mv('2301', opE), i = mv('1501', opE);
    const tbOut = r2x(o.c - o.d), tbIn = r2x(i.d - i.c);
    const dOut = r2x(tbOut - vsum.out), dIn = r2x(tbIn - vsum.inn);
    // أسباب الفرق: (أ) قيود تمسّ الحسابين بلا أثر ضريبي مسجّل (قيد يدوي، سداد قديم، استيراد) — (ب) قيود أثرها الضريبي لا يطابق سطرها
    const causes = [];
    opE.forEach(e => {
      const a = mv('2301', [e]), b = mv('1501', [e]); const lo = r2x(a.c - a.d), li = r2x(b.d - b.c);
      if (!lo && !li) return;
      const vo = e.vat ? r2x(e.vat.out) : 0, vi = e.vat ? r2x(e.vat.inn) : 0;
      if (Math.abs(lo - vo) > 0.009 || Math.abs(li - vi) > 0.009)
        causes.push({ date: e.date, title: e.title, src: e.src, ref: e.ref || '', out: r2x(lo - vo), inn: r2x(li - vi), why: e.vat ? 'مبلغ السطر لا يطابق الأثر الضريبي للقيد' : 'قيد على حساب الضريبة بلا أثر في الإقرار' });
    });
    // فحص الوعاء: ضريبة المخرجات مقابل الإيراد المسجّل في 4101/4102 × النسبة (يكشف مبيعات سُجّلت بلا ضريبة)
    const r1 = mv('4101', pe), r2 = mv('4102', pe);
    const revNet = r2x(r1.c - r1.d + r2.c - r2.d);
    const expOut = r2x(revNet * taxRate / 100);
    const dBase = r2x(vsum.out - expOut);
    const untaxed = pe.filter(e => !isTaxSettle(e) && !e.vat && e.lines.some(l => (l.code === '4101' || l.code === '4102') && l.credit > 0.004))
      .map(e => ({ date: e.date, title: e.title, src: e.src, amt: r2x(sum(e.lines.filter(l => l.code === '4101' || l.code === '4102'), l => l.credit - l.debit)) }));
    const s2 = mv('2302', pe);
    return { tbOut, tbIn, dOut, dIn, causes, revNet, expOut, dBase, untaxed, o, i, closeCr: r2x(s2.c), payDr: r2x(s2.d),
      ok: Math.abs(dOut) < 0.01 && Math.abs(dIn) < 0.01 };
  })();
  const vatChecks = [
    vatRec && (vatRec.ok ? { s: 'ok', t: 'ميزان المراجعة يطابق الإقرار: حركة 2301 = ' + money(vatRec.tbOut) + ' وحركة 1501 = ' + money(vatRec.tbIn) } : { s: 'bad', t: 'ميزان المراجعة لا يطابق الإقرار — فرق المخرجات ' + fmtBal(vatRec.dOut) + ' وفرق المدخلات ' + fmtBal(vatRec.dIn) + ' (التفاصيل في ميزان المراجعة)' }),
    !(from && to) ? { s: 'warn', t: 'لم تُحدَّد فترة الإقرار — الأرقام لكامل المدة. اضغط «الربع الحالي» أو حدّد الفترة.' } : { s: 'ok', t: 'فترة الإقرار: ' + from + ' ← ' + to },
    vatX.rateOk ? { s: 'ok', t: 'النسبة الفعلية للمخرجات ' + (vatX.effRate == null ? '—' : vatX.effRate + '%') + ' تطابق النسبة المعتمدة ' + taxRate + '%' } : { s: 'bad', t: 'النسبة الفعلية للمخرجات ' + vatX.effRate + '% لا تطابق ' + taxRate + '% — راجع مبيعات مسجّلة بنسبة مختلفة أو بلا ضريبة' },
    vatX.noVatSup.n ? { s: 'bad', t: vatX.noVatSup.n + ' فاتورة مورد بضريبة مدخلات ' + money(vatX.noVatSup.vat) + ' من موردين بلا رقم ضريبي في جهات الاتصال — قد لا تُقبل للخصم' } : { s: 'ok', t: 'كل فواتير الموردين ذات الضريبة لموردين لهم رقم ضريبي' },
    vatX.noRcpt.n ? { s: 'warn', t: vatX.noRcpt.n + ' مصروف وردية بضريبة ' + money(vatX.noRcpt.vat) + ' بلا صورة أو رقم إيصال — احتفظ بالفاتورة الضريبية لإثبات الخصم' } : { s: 'ok', t: 'مصروفات الورديات ذات الضريبة موثّقة بإيصال' },
    vatX.credits ? { s: 'warn', t: vatX.credits + ' إشعار دائن/مرتجع في الفترة — يظهر في عمود «التعديلات»' } : { s: 'ok', t: 'لا إشعارات دائنة أو مرتجعات في الفترة' }
  ].filter(Boolean);
  const vatFormRows = () => {
    const F = vatX.F, Z = { a: 0, adj: 0, v: 0 };
    return [
      { n: '1', t: 'المبيعات الخاضعة للنسبة الأساسية', a: F.s, adj: F.sAdj, v: r2x(F.sV + F.sVAdj) },
      { n: '2', t: 'المبيعات للمواطنين (خدمات صحية وتعليمية خاصة)', ...Z, na: 1 },
      { n: '3', t: 'المبيعات المحلية الخاضعة للنسبة الصفرية', ...Z, na: 1 },
      { n: '4', t: 'الصادرات', ...Z, na: 1 },
      { n: '5', t: 'المبيعات المعفاة', ...Z, na: 1 },
      { n: '6', t: 'إجمالي المبيعات', a: F.s, adj: F.sAdj, v: r2x(F.sV + F.sVAdj), tot: 1 },
      { n: '7', t: 'المشتريات الخاضعة للنسبة الأساسية', a: F.p, adj: F.pAdj, v: r2x(F.pV + F.pVAdj) },
      { n: '8', t: 'الاستيرادات الخاضعة للضريبة المدفوعة في الجمارك', ...Z, na: 1 },
      { n: '9', t: 'الاستيرادات الخاضعة لآلية الاحتساب العكسي', ...Z, na: 1 },
      { n: '10', t: 'المشتريات الخاضعة للنسبة الصفرية', ...Z, na: 1 },
      { n: '11', t: 'المشتريات المعفاة', ...Z, na: 1 },
      { n: '12', t: 'إجمالي المشتريات', a: F.p, adj: F.pAdj, v: r2x(F.pV + F.pVAdj), tot: 1 },
      { n: '13', t: 'إجمالي ضريبة القيمة المضافة المستحقة عن الفترة', v: vatDue, tot: 1, only: 1 },
      { n: '14', t: 'تصحيحات من الفترات السابقة (بحد ±5,000 ر.س)', v: 0, only: 1, na: 1 },
      { n: '15', t: 'رصيد الضريبة المرحّل من الفترة/الفترات السابقة', v: 0, only: 1, na: 1 },
      { n: '', t: vatDue >= 0 ? 'صافي الضريبة المستحقة للسداد' : 'صافي رصيد دائن لصالح المنشأة', v: vatDue, net: 1, only: 1 }
    ];
  };
  // ===== v36.1 — إقفال الفترة الضريبية في الحساب الوسيط 2302 وسدادها =====
  // قيد الإقفال: من 2301 (مخرجات الفترة) إلى 1501 (مدخلات الفترة) والفرق إلى 2302 (المستحق للهيئة) — بمبالغ الإقرار نفسها.
  // قيد السداد: من 2302 إلى حساب نقدي. القيود تُخزَّن في journalManual بوسم vatClose/vatPay ولا تحمل أثرًا ضريبيًا فلا تغيّر الإقرار.
  const vatCloses = (ops.journalManual || []).filter(j => j.vatClose).sort((a, b) => (b.vatClose.to || '').localeCompare(a.vatClose.to || ''));
  const vatPays = (ops.journalManual || []).filter(j => j.vatPay);
  const vcPaid = (id) => r2x(sum(vatPays.filter(p => p.vatPay.closeId === id), p => p.vatPay.amount));
  const vcOverlap = (f, t) => vatCloses.find(c => !(t < c.vatClose.from || f > c.vatClose.to));
  const vcNextFrom = vatCloses.length ? (() => { const d = new Date(vatCloses[0].vatClose.to + 'T00:00:00'); d.setDate(d.getDate() + 1); return isoD(d); })() : '';
  const vcBlock = !taxOn ? 'الضريبة غير مفعّلة' : !(from && to) ? 'حدّد فترة الإقرار (من/إلى) أولًا — مثل «الربع الحالي»'
    : !canPost ? 'الإقفال صلاحية المحاسب/الإدارة المالية' : periodLocked(org, to) ? LOCK_MSG(to)
      : vcOverlap(from, to) ? 'الفترة تتداخل مع إقفال سابق: من ' + vcOverlap(from, to).vatClose.from + ' إلى ' + vcOverlap(from, to).vatClose.to
        : (Math.abs(vsum.out) < 0.005 && Math.abs(vsum.inn) < 0.005) ? 'لا حركة ضريبية في الفترة' : '';
  // أرصدة الحسابين حتى نهاية الفترة — بعد الإقفال يجب أن تساوي صفرًا لكل الفترات المقفلة (أي باقٍ = قيد مباشر على الحسابين خارج الإقرار)
  const balTo = (code, kind, t) => { let d = 0, c = 0; A.entries.forEach(e => { if (t && (e.date || '') > t) return; e.lines.forEach(l => { if (l.code === code) { d += l.debit; c += l.credit; } }); }); return r2x(kind === 'asset' ? d - c : c - d); };
  const vat2302 = balTo('2302', 'liab', '');
  const lastCloseTo = vatCloses.length ? vatCloses[0].vatClose.to : '';
  const vcResid = lastCloseTo ? { out: balTo('2301', 'liab', lastCloseTo), inn: balTo('1501', 'asset', lastCloseTo) } : null;
  const postVatClose = async () => {
    if (vcBlock) return say(vcBlock, 'no');
    const out = r2x(vsum.out), inn = r2x(vsum.inn), net = r2x(out - inn);
    const lines = [
      ...(out ? [{ code: '2301', debit: out > 0 ? out : 0, credit: out < 0 ? -out : 0 }] : []),
      ...(inn ? [{ code: '1501', debit: inn < 0 ? -inn : 0, credit: inn > 0 ? inn : 0 }] : []),
      ...(net ? [{ code: '2302', debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0 }] : [])
    ];
    const rec = { id: uid('jm'), date: to, title: 'إقفال الفترة الضريبية ' + from + ' ← ' + to + (net >= 0 ? ' — مستحق للهيئة' : ' — رصيد دائن مرحّل'),
      opening: false, by: me?.name || '', createdAt: nowISO(), src: 'vat-close', vatClose: { from, to, out, inn, net, rate: taxRate }, lines };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'إقفال فترة ضريبية', details: from + ' ← ' + to + ' · مخرجات ' + money(out) + ' · مدخلات ' + money(inn) + ' · صافي ' + money(net) });
    if (ok) say('أُقفلت الفترة الضريبية ✓ — الصافي ' + money(Math.abs(net)) + (net >= 0 ? ' مستحق للهيئة في 2302' : ' رصيد دائن لصالحك'));
  };
  const cashAccts = A.accounts.filter(a => a.cash);
  const postVatPay = async () => {
    const f = vpay; if (!f) return;
    const c = vatCloses.find(x => x.id === f.closeId); if (!c) return say('اختر الفترة', 'no');
    const amt = r2x(Number(String(f.amount).replace(/[^\d.]/g, '')) || 0);
    const rem = r2x(c.vatClose.net - vcPaid(c.id));
    if (!(amt > 0)) return say('أدخل مبلغ السداد', 'no');
    if (amt > rem + 0.01) return say('المبلغ أكبر من المتبقي لهذه الفترة (' + money(rem) + ')', 'no');
    if (!f.acc) return say('اختر حساب السداد', 'no');
    if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
    const rec = { id: uid('jm'), date: f.date, title: 'سداد ضريبة القيمة المضافة — فترة ' + c.vatClose.from + ' ← ' + c.vatClose.to + (f.ref ? ' · ' + f.ref : ''),
      opening: false, by: me?.name || '', createdAt: nowISO(), src: 'vat-pay', vatPay: { closeId: c.id, amount: amt, ref: f.ref || '' },
      lines: [{ code: '2302', debit: amt, credit: 0 }, { code: f.acc, debit: 0, credit: amt }] };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'سداد ضريبة القيمة المضافة', details: money(amt) + ' · ' + c.vatClose.from + ' ← ' + c.vatClose.to });
    if (ok) { setVpay(null); say('سُجّل السداد ✓'); }
  };
  const undoVatClose = async (c) => {
    if (vatCloses[0]?.id !== c.id) return say('يُلغى آخر إقفال فقط — ألغِ الأحدث أولًا', 'no');
    if (vcPaid(c.id) > 0) return say('على هذه الفترة سداد مسجّل — اعكس السداد بقيد يدوي قبل الإلغاء', 'no');
    if (periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
    const ok = await commit(d => ({ ...d, journalManual: (d.journalManual || []).filter(j => j.id !== c.id) }), { actionType: 'delete', targetType: 'journal_entry', targetId: c.id, need: 'post', title: 'ألغى إقفال فترة ضريبية', details: c.vatClose.from + ' ← ' + c.vatClose.to + ' · صافي ' + money(c.vatClose.net) });
    if (ok) say('أُلغي الإقفال — يمكنك إعادة إقفال الفترة بعد التصحيح');
  };
  const vatTxRows = () => [['التاريخ', 'المصدر', 'المرجع', 'البيان', 'الفرع', 'الطرف', 'الرقم الضريبي للطرف', 'مبيعات صافية', 'ضريبة مخرجات', 'مشتريات صافية', 'ضريبة مدخلات', 'ملاحظة المدقق'],
    ...vatX.tx.map(t => [t.date, t.src, t.ref, t.title, t.br, t.party, t.pVat, t.ns, t.out, t.np, t.inn, t.flag])];
  const xlVAT = () => { try {
    const form = [['البند', 'الوصف', 'المبلغ', 'التعديلات', 'ضريبة القيمة المضافة'], ...vatFormRows().map(r => [r.n, r.t, r.only ? '' : r.a, r.only ? '' : r.adj, r.v])];
    const br = [['الفرع', 'مبيعات صافية', 'ضريبة مخرجات', 'مشتريات صافية', 'ضريبة مدخلات', 'الصافي'], ...vatX.br.map(b => [b.name, b.ns, b.out, b.np, b.inn, r2x(b.out - b.inn)])];
    const mon = [['الشهر', 'مبيعات صافية', 'ضريبة مخرجات', 'مشتريات صافية', 'ضريبة مدخلات', 'الصافي'], ...vatX.mon.map(m => [m.k, m.ns, m.out, m.np, m.inn, r2x(m.out - m.inn)])];
    const sup = [['المورد', 'الرقم الضريبي', 'عدد الفواتير', 'مشتريات صافية', 'ضريبة مدخلات'], ...vatX.sup.map(u => [u.name, u.vatNo || '— غير مسجّل —', u.n, u.net, u.vat])];
    dlBlob('الإقرار_الضريبي_' + expTag + '.xlsx', makeXlsx([{ name: 'نموذج الإقرار', rows: form }, { name: 'حسب الفرع', rows: br }, { name: 'حسب الشهر', rows: mon }, { name: 'الموردون', rows: sup }, { name: 'الحركات', rows: vatTxRows() }]));
  } catch (e) { say('تعذّر توليد Excel', 'no'); } };
  const setQuarter = () => {
    const d = new Date(); const qs = Math.floor(d.getMonth() / 3) * 3;
    const f = new Date(d.getFullYear(), qs, 1), t = new Date(d.getFullYear(), qs + 3, 0);
    setFrom(isoD(f)); setTo(isoD(t));
  };
  const saveTax = async (next, title, details) => {
    if (lockedThru(org)) return say('توجد فترات مقفلة حتى ' + lockedThru(org) + ' — تغيير الضريبة يعيد احتساب قيودها؛ افتح الإقفال أولًا', 'no');
    await commitOrg(d => ({ ...d, taxCfg: next }), {
      actionType: 'update', targetType: 'tax_settings', targetId: 'taxCfg', need: 'edit', title, details
    });
  };

  // ===== v11.8: الفوترة الإلكترونية المبسّطة (زاتكا — رمز QR للمرحلة الأولى) =====
  const einvEnt = entityById(org, einvF.entity);
  const einvSeller = einvEnt.name || '';
  const einvSellerVat = einvEnt.taxNumber || '';
  const einvSellerAddr = einvEnt.primary ? ((org.company || {}).address || '') : (einvEnt.address || ''); // v15.2 عنوان البائع
  const einvSellerCR = einvEnt.commercialReg || '';
  const einvIsStd = einvF.type === 'standard';                                                          // فاتورة ضريبية (B2B)
  const einvCustomers = (org.partners || []).filter(p => (p.type || 'customer') === 'customer');        // عملاء دفتر الشركاء
  const einvRate = taxOn ? taxRate : 15;            // النسبة المعتمدة (تُعرض 15% افتراضيًا للفاتورة إن كانت الضريبة موقوفة)
  const _e2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const einvAmt = Number(String(einvF.amount).replace(/[^\d.]/g, '')) || 0;
  const einvCalc = (() => {
    let net, vat, gross;
    if (einvF.mode === 'net') { net = _e2(einvAmt); vat = _e2(net * einvRate / 100); gross = _e2(net + vat); }
    else { gross = _e2(einvAmt); vat = _e2(gross * einvRate / (100 + einvRate)); net = _e2(gross - vat); }
    return { net, vat, gross };
  })();
  const einvTs = einvF.date + 'T' + (/^\d{2}:\d{2}$/.test(einvF.time) ? einvF.time : '12:00') + ':00Z';
  const einvNo = einvF.invNo.trim() || ((einvF.type === 'standard' ? 'ضريبية-' : 'مبسّطة-') + String((org.einvSeq || 0) + 1).padStart(5, '0')); // v15: عدّاد تسلسلي فريد (ICV)
  const einvReady = !!einvSeller && !!einvSellerVat && einvCalc.gross > 0;
  const einvB64 = einvReady ? zatcaTLV(einvSeller, einvSellerVat, einvTs, einvCalc.gross, einvCalc.vat) : '';
  const einvClosings = (ops.closings || []).filter(countedClosing).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 80);
  const printEInv = () => {
    if (!einvReady) return say(einvSellerVat ? 'أدخل مبلغ الفاتورة أولًا' : 'أضف الرقم الضريبي للمنشأة من الإعدادات ← بيانات الشركة', 'no');
    const svg = qrSvg(einvB64, { ecl: 1, px: 150 });
    const buyerBlock = einvIsStd
      ? `<div style="margin-top:6px"><b>المشتري:</b> ${_xe(einvF.buyer.trim() || '—')}${einvF.buyerVat.trim() ? ' · الرقم الضريبي: ' + _xe(einvF.buyerVat.trim()) : ''}${einvF.buyerAddress.trim() ? '<br>العنوان: ' + _xe(einvF.buyerAddress.trim()) : ''}</div>`
      : (einvF.buyer.trim() ? `<div style="margin-top:6px">العميل: ${_xe(einvF.buyer.trim())}</div>` : '');
    const body = `
    <div class="box" style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px">
      <div style="line-height:1.9">
        <div style="font-size:15px;font-weight:800;color:#5a4a1e">${einvIsStd ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسّطة'}</div>
        <div class="sub">${einvIsStd ? 'Tax Invoice' : 'Simplified Tax Invoice'}</div>
        <div style="margin-top:8px"><b>البائع:</b> ${_xe(einvSeller)} · الرقم الضريبي: ${_xe(einvSellerVat)}${einvSellerCR ? ' · س.ت ' + _xe(einvSellerCR) : ''}</div>
        ${einvSellerAddr ? '<div>العنوان: ' + _xe(einvSellerAddr) + '</div>' : ''}
        <div style="margin-top:6px">رقم الفاتورة: <b>${_xe(einvNo)}</b> · التاريخ: <span class="n">${einvF.date}${einvF.time ? ' ' + einvF.time : ''}</span></div>
        ${buyerBlock}
      </div>
      <div style="text-align:center">${svg}<div class="sub" style="margin-top:3px">امسح رمز QR للتحقق</div></div>
    </div>
    <table>
      <thead><tr><th>البيان</th><th class="n">المبلغ (ر.س)</th></tr></thead>
      <tbody>
        <tr><td>${_xe(einvF.desc.trim() || 'مبيعات')} — قبل الضريبة</td><td class="n">${money(einvCalc.net)}</td></tr>
        <tr><td>ضريبة القيمة المضافة (${einvRate}%)</td><td class="n">${money(einvCalc.vat)}</td></tr>
        <tr class="tot"><td>الإجمالي شامل الضريبة</td><td class="n">${money(einvCalc.gross)}</td></tr>
      </tbody>
    </table>
    <div class="box" style="font-size:10px;color:#777">${einvIsStd ? 'فاتورة ضريبية (B2B) تحوي بيانات البائع والمشتري كاملة' : 'فاتورة ضريبية مبسّطة (B2C)'} متوافقة مع المرحلة الأولى للفوترة الإلكترونية (رمز QR بترميز TLV: اسم البائع، الرقم الضريبي، التاريخ والوقت، الإجمالي، وقيمة الضريبة). الربط المعتمد للمرحلة الثانية يتطلب شهادة رقمية وتكامل بوابة «فاتورة» من هيئة الزكاة والضريبة والجمارك.</div>`;
    const ok = printA4(org, einvIsStd ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسّطة', 'البائع: ' + (einvSeller || '—') + ' · الرقم الضريبي: ' + (einvSellerVat || '—'), body);
    if (!ok) return say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
    if (!einvF.invNo.trim() && canPost) commitOrg(d => ({ ...d, einvSeq: (d.einvSeq || 0) + 1 }), { actionType: 'create', targetType: 'tax_settings', targetId: 'einvSeq', need: 'post', title: 'إصدار ' + (einvIsStd ? 'فاتورة ضريبية' : 'فاتورة مبسّطة'), details: einvNo }).catch(() => { });  // v15.11: لا يزيد التسلسل لدور «عرض فقط»
  };

  // ===== م5: الأصول الثابتة =====
  const saveAst = async () => {
    const f = astF;
    if (!f.name.trim()) return say('أدخل اسم الأصل', 'no');
    if (periodLocked(org, f.buyDate)) return say('تاريخ الشراء في شهر مقفل — ' + LOCK_MSG(f.buyDate), 'no');
    const cost = Number(f.cost) || 0;
    if (cost <= 0) return say('أدخل تكلفة الأصل', 'no');
    if (!(Number(f.lifeYears) > 0)) return say('أدخل العمر الإنتاجي بالسنوات', 'no');
    const rec = { id: f.id || uid('as'), name: f.name.trim(), cost, buyDate: f.buyDate || today(), lifeYears: Number(f.lifeYears), fund: f.fund || 'none', note: f.note || '' };
    await commitOrg(d => ({ ...d, assets: f.id ? (d.assets || []).map(x => x.id === f.id ? rec : x) : [...(d.assets || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'fixed_asset', targetId: rec.id,
      need: f.id ? 'edit' : 'post', title: f.id ? 'عدّل أصلاً ثابتاً (أُعيد اشتقاق إهلاكه)' : 'سجّل أصلاً ثابتاً',
      details: rec.name + ' · ' + money(cost) + ' · ' + rec.lifeYears + ' سنة'
    });
    setAstF(null); say('حُفظ الأصل — قيود الشراء والإهلاك تولّدت تلقائياً ✓');
  };

  // القيمة الدفترية عند تاريخ محدد (لمعاينة الربح/الخسارة قبل التأكيد) — يطابق منطق المحرك تمامًا
  const assetBookAt = (a, dateStr) => {
    const cost = Number(a.cost) || 0;
    const nM = Math.max(1, Math.round((Number(a.lifeYears) || 0) * 12));
    if (!(cost > 0 && Number(a.lifeYears) > 0 && a.buyDate)) return { accum: 0, book: cost };
    const ymAdd2 = (ym, k) => { const pr = ym.split('-').map(Number); const t = pr[0] * 12 + (pr[1] - 1) + k; return String(Math.floor(t / 12)).padStart(4, '0') + '-' + String((t % 12) + 1).padStart(2, '0'); };
    const dispYm = dateStr ? dateStr.slice(0, 7) : '';
    const base = Math.floor(cost / nM * 100) / 100;
    const start = ymAdd2(a.buyDate.slice(0, 7), 1);
    let accum = 0;
    for (let k = 0; k < nM; k++) {
      const ym = ymAdd2(start, k);
      if (dispYm && ym >= dispYm) break;
      const amt = k === nM - 1 ? Math.round((cost - base * (nM - 1)) * 100) / 100 : base;
      accum = Math.round((accum + amt) * 100) / 100;
    }
    return { accum, book: Math.round((cost - accum) * 100) / 100 };
  };
  const saveDispose = async () => {
    const f = dspF;
    const a = (org.assets || []).find(x => x.id === f.id);
    if (!a) return setDspF(null);
    if (!f.disposedDate) return say('أدخل تاريخ البيع/الاستبعاد', 'no');
    if (f.disposedDate < a.buyDate) return say('تاريخ الاستبعاد قبل تاريخ الشراء', 'no');
    if (f.disposedDate > today()) return say('لا يمكن استبعاد أصل بتاريخ مستقبلي', 'no');
    if (periodLocked(org, f.disposedDate)) return say('تاريخ الاستبعاد في شهر مقفل — ' + LOCK_MSG(f.disposedDate), 'no');
    const salePrice = Number(f.salePrice) || 0;
    const rec = { ...a, disposedDate: f.disposedDate, salePrice, saleFund: f.saleFund || '1201' };
    await commitOrg(d => ({ ...d, assets: (d.assets || []).map(x => x.id === f.id ? rec : x) }), {
      actionType: 'update', targetType: 'fixed_asset', targetId: a.id,
      need: 'edit', title: 'سجّل بيع/استبعاد أصل ثابت', details: a.name + ' · سعر البيع ' + money(salePrice) + ' · ' + f.disposedDate
    });
    setDspF(null);
    // v15.12: الأصل «بلا قيد شراء» (none) لا تكلفةَ له في الدفاتر، فلا يُولَّد قيد بيع تلقائي — ننبّه المحاسب لتسجيله يدويًا (اتساقًا مع سياسة v15.11).
    const autoJournal = a.fund && a.fund !== 'none' && (Number(a.cost) || 0) > 0;
    say(autoJournal
      ? 'سُجّل الاستبعاد — قيد الإقفال والربح/الخسارة تولّد تلقائياً ✓'
      : 'سُجّل الاستبعاد. تنبيه: هذا أصل «بلا قيد شراء» فلن يُولَّد قيد بيع تلقائيًا — سجّل قيد المقبوض والربح/الخسارة يدويًا ⚠', autoJournal ? '' : 'no');
  };
  const undoDispose = async (id) => {
    const a = (org.assets || []).find(x => x.id === id); if (!a) return;
    const rec = { ...a }; delete rec.disposedDate; delete rec.salePrice; delete rec.saleFund;
    await commitOrg(d => ({ ...d, assets: (d.assets || []).map(x => x.id === id ? rec : x) }), {
      actionType: 'update', targetType: 'fixed_asset', targetId: id,
      need: 'edit', title: 'ألغى بيع/استبعاد أصل ثابت', details: a.name
    });
    say('أُلغي الاستبعاد — عاد الأصل نشطاً وأُعيد احتساب إهلاكه ✓');
  };

  // ===== م5: التسوية البنكية — v15.20: لكل بنك (التجميعي أو بنك فرع) تسويته المستقلة =====
  const brBanks = branchBanks(org);
  const bankLabel = (code) => code === '1201' || !code ? 'البنك التجميعي' : ((brBanks.find(x => x.code === code) || {}).name || ('حساب ' + code));
  const bankBookAt = (d) => {
    let v = 0;
    A.entries.forEach(e => { if (!d || (e.date || '') <= d) e.lines.forEach(l => { if (l.code === brAcc) v += l.debit - l.credit; }); });
    return Math.round(v * 100) / 100;
  };
  const bankMoves = A.entries
    .filter(e => e.lines.some(l => l.code === brAcc))
    .slice(0, 60)
    .map(e => ({ ...e, bankD: sum(e.lines.filter(l => l.code === brAcc), l => l.debit), bankC: sum(e.lines.filter(l => l.code === brAcc), l => l.credit) }));
  const saveBankRec = async () => {
    const stmt = Number(brF.stmt) || 0;
    const book = bankBookAt(brF.date);
    const rec = { id: uid('br'), date: brF.date || today(), acc: brAcc, stmtBalance: stmt, bookBalance: book,
      diff: Math.round((stmt - book) * 100) / 100, note: brF.note || '', by: me?.name || '', at: nowISO() };
    await commit(d => ({ ...d, bankRecs: [rec, ...(d.bankRecs || [])] }), {
      actionType: 'create', targetType: 'bank_rec', targetId: rec.id,
      need: 'post', title: 'وثّق تسوية بنكية', details: bankLabel(brAcc) + ' · ' + rec.date + ' · كشف ' + money(stmt) + ' · دفتر ' + money(book) + ' · فرق ' + money(rec.diff)
    });
    setBrF({ date: today(), stmt: '', note: '' }); say('وُثّقت تسوية ' + bankLabel(brAcc) + ' — عالج الفرق بقيد يدوي إن لزم ✓');
  };
  // آخر تسوية للبنك المختار نفسه (سجلات قديمة بلا acc تُعامل كتجميعي)
  const lastRec = (ops.bankRecs || []).find(r => (r.acc || '1201') === brAcc);

  // ===== v16.7: وسيط الشبكة تحت التسوية + رفع كشف البنك والمطابقة =====
  const pcCfgUi = org.posClearing || {};
  const clrAcc = posClrOf(brAcc);
  const clrBal = (() => { const a = A.accounts.find(x => x.code === clrAcc); return a ? Math.round(a.balance * 100) / 100 : 0; })();
  const canEditMe = capOK(me?.role, 'edit');
  const [pcF, setPcF] = useState(() => ({ enabled: !!pcCfgUi.enabled, from: pcCfgUi.from || isoD(new Date()).slice(0, 7) }));
  const savePc = async () => {
    if (pcF.enabled && !pcF.from) return say('حدد الشهر الذي يسري منه الوسيط', 'no');
    const ok = await commitOrg(d => ({ ...d, posClearing: { enabled: !!pcF.enabled, from: pcF.from } }), {
      actionType: 'update', targetType: 'settings', targetId: 'posClearing', need: 'edit',
      title: pcF.enabled ? 'فعّل وسيط الشبكة تحت التسوية' : 'أوقف وسيط الشبكة تحت التسوية',
      details: pcF.enabled ? ('يسري من ' + pcF.from) : ''
    });
    if (ok) say(pcF.enabled ? 'فُعّل وسيط الشبكة — يسري على إغلاقات ' + pcF.from + ' فما بعد ✓' : 'أُوقف وسيط الشبكة — عادت الشبكة تدخل البنك مباشرة');
  };

  const [stF, setStF] = useState(null);        // {name, grid, map} — الكشف المرفوع وخريطته
  const [stMonth, setStMonth] = useState(() => isoD(new Date()).slice(0, 7));
  const [stMatch, setStMatch] = useState(null); // نتيجة المطابقة
  const stPick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      let grid;
      if (!/\.(xlsx)$/i.test(f.name)) {
        const txt = await f.text(); const mt = parseMt940(txt);
        if (mt) {   // v32.2: كشف MT940 — يُحوَّل لجدول بأعمدة معروفة مع الرصيدين الافتتاحي والختامي من البنك نفسه
          grid = [['التاريخ', 'البيان', 'مدين', 'دائن', 'المرجع'], ...mt.lines.map(l => [l.date, l.desc, l.amount < 0 ? -l.amount : '', l.amount > 0 ? l.amount : '', l.ref])];
          setStMatch(null); setFullM(null);
          setStF({ name: f.name, grid, map: { date: 0, desc: 1, debit: 2, credit: 3, amount: -1, start: 1 }, auto: true, mt940: { account: mt.account, open: mt.open, close: mt.close, n: mt.lines.length } });
          return say('قُرئ كشف MT940 ✓ — ' + mt.lines.length + ' حركة' + (mt.close ? ' · الرصيد الختامي ' + money(mt.close.amount) + ' في ' + mt.close.date : ''));
        }
        grid = parseCsvGrid(txt);
      } else grid = await parseXlsxGrid(await f.arrayBuffer());
      if (!grid || grid.length < 2) return say('الملف فارغ أو غير مقروء — جرّب تصديره CSV من بنكك', 'no');
      const map = detectStmtMap(grid);
      setStMatch(null);
      setStF({ name: f.name, grid, map: map || { date: 0, credit: -1, debit: -1, amount: 1, desc: -1, start: 1 }, auto: !!map });
      say(map ? 'قُرئ الكشف (' + (grid.length - map.start) + ' سطراً) وتعرّفت على أعمدته تلقائياً ✓' : 'قُرئ الكشف — حدّد الأعمدة يدوياً ثم اضغط «طابق»');
    } catch (err) {
      say('تعذّرت قراءة الملف — إن كان Excel قديماً (.xls) فاحفظه بصيغة CSV أو xlsx وأعد رفعه', 'no');
    }
  };
  const stRun = () => {
    if (!stF) return say('ارفع ملف كشف البنك أولاً', 'no');
    const { grid, map } = stF;
    const deposits = [];
    for (let r = map.start; r < grid.length; r++) {
      const g = grid[r] || [];
      const d = stDate(g[map.date]);
      let credit = 0;
      if (map.credit >= 0) credit = stNum(g[map.credit]);
      else if (map.amount >= 0) credit = Math.max(0, stNum(g[map.amount]));
      if (!d || !(credit > 0)) continue;
      deposits.push({ date: d, amount: Math.round(credit * 100) / 100, desc: String(g[map.desc] ?? '').slice(0, 70), used: false });
    }
    const mStart = stMonth + '-01';
    const nm = new Date(mStart + 'T12:00:00Z'); nm.setUTCMonth(nm.getUTCMonth() + 1);
    const mEnd = stAddDays(nm.toISOString().slice(0, 10), 6);   // حتى نهاية الشهر + 6 أيام (تسوية آخر الشهر تصل أول التالي)
    const dep = deposits.filter(x => x.date >= mStart && x.date <= mEnd).sort((a, b) => a.date.localeCompare(b.date));
    const sysMap = {};
    (ops.closings || []).forEach(c => {
      if (!(c.status === 'submitted' || c.status === 'approved')) return;
      if ((c.date || '').slice(0, 7) !== stMonth) return;
      if (bankOfBranch(org, c.branchId) !== brAcc) return;
      const amt = Math.round((c.cardSales || 0) * 100) / 100;
      if (amt > 0) sysMap[c.date] = Math.round(((sysMap[c.date] || 0) + amt) * 100) / 100;
    });
    const sys = Object.entries(sysMap).map(([date, amount]) => ({ date, amount, used: false })).sort((a, b) => a.date.localeCompare(b.date));
    const matched = [];
    sys.forEach(s => {
      const hit = dep.find(dp => !dp.used && Math.abs(dp.amount - s.amount) < 0.01 && dp.date >= s.date && dp.date <= stAddDays(s.date, 4));
      if (hit) { hit.used = true; s.used = true; matched.push({ sDate: s.date, bDate: hit.date, amount: s.amount }); }
    });
    const r2s = (arr) => Math.round(sum(arr, x => x.amount) * 100) / 100;
    const res = {
      month: stMonth, bank: brAcc, depCount: dep.length,
      sysTotal: r2s(sys), bankTotal: r2s(dep), matchedTotal: r2s(matched),
      matched, sysUn: sys.filter(s => !s.used), bankUn: dep.filter(x => !x.used)
    };
    res.diff = Math.round((res.sysTotal - res.bankTotal) * 100) / 100;
    setStMatch(res);
    setClsAmt(String(res.matchedTotal || ''));
  };
  // v31.4 — مطابقة شاملة: كل سطر في الكشف (إيداع/سحب) مقابل قيود هذا البنك بالمبلغ والتاريخ (±5 أيام)
  const [fullM, setFullM] = useState(null);
  const [fixAcc, setFixAcc] = useState({});
  const stLines = () => {
    const { grid, map } = stF; const out = [];
    for (let r = map.start; r < grid.length; r++) { const g = grid[r] || []; const d = stDate(g[map.date]); if (!d) continue;
      let a = 0; const cr = map.credit >= 0 ? stNum(g[map.credit]) : 0, dr = map.debit >= 0 ? stNum(g[map.debit]) : 0;
      if (cr > 0) a = cr; else if (dr > 0) a = -dr; else if (map.amount >= 0) a = stNum(g[map.amount]);
      if (!a) continue; out.push({ i: r, date: d, amount: Math.round(a * 100) / 100, desc: String(g[map.desc] ?? '').slice(0, 80) }); }
    return out;
  };
  const stFull = () => {
    if (!stF) return say('ارفع ملف كشف البنك أولاً', 'no');
    const mStart = stMonth + '-01', mEnd = monthEnd(stMonth);
    const bank = stLines().filter(x => x.date >= mStart && x.date <= mEnd).map(x => ({ ...x, used: false }));
    const lo = stAddDays(mStart, -5), hi = stAddDays(mEnd, 5);
    const book = A.entries.filter(e => (e.date || '') >= lo && (e.date || '') <= hi && e.lines.some(l => l.code === brAcc))
      .map(e => ({ id: e.id, date: e.date, title: e.title, amount: Math.round(sum(e.lines.filter(l => l.code === brAcc), l => l.debit - l.credit) * 100) / 100, used: false }))
      .filter(b => Math.abs(b.amount) > 0.004);
    const dd = (a, b) => Math.abs((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);
    const matched = [];
    bank.forEach(x => { let best = null; book.forEach(b => { if (b.used || Math.abs(b.amount - x.amount) > 0.009 || dd(b.date, x.date) > 5) return; if (!best || dd(b.date, x.date) < dd(best.date, x.date)) best = b; });
      if (best) { best.used = true; x.used = true; matched.push({ bank: x, book: best }); } });
    const bankUn = bank.filter(x => !x.used), bookUn = book.filter(b => !b.used && b.date >= mStart && b.date <= mEnd);
    const bookEnd = bankBookAt(mEnd);
    const r2x = (n) => Math.round(n * 100) / 100;
    // رصيد الكشف المتوقع = رصيد الدفتر + ما في الكشف ولم يُقيَّد − ما قُيِّد ولم يظهر في الكشف
    const expStmt = r2x(bookEnd + sum(bankUn, x => x.amount) - sum(bookUn, b => b.amount));
    setFullM({ month: stMonth, bank: bank.length, matched, bankUn, bookUn, bookEnd, expStmt });
    const sug = {}; bankUn.forEach(x => { sug[x.i] = suggestAcc(x); }); setFixAcc(sug);
  };
  const accOpts = A.accounts.filter(a => a.code !== brAcc && !a.cash && a.kind !== 'equity');
  const suggestAcc = (x) => { const t = String(x.desc || ''); const find = (re) => (A.accounts.find(a => re.test(a.name || '')) || {}).code;
    if (/رسوم|عمولة|عمولات|fee|charge|commission/i.test(t)) return find(/رسوم بنك|عمولات بنك|مصاريف بنك/) || '5901';
    if (/رواتب|salary|payroll|wps/i.test(t)) return '2201';
    if (/زكاة/i.test(t)) return '';
    if (/ضريبة|zatca|vat/i.test(t)) return x.amount < 0 ? '2302' : '';   // v36.1: سداد الإقرار من الحساب الوسيط
    return ''; };
  const postFix = async (x) => {
    const code = fixAcc[x.i]; if (!code) return say('اختر الحساب المقابل', 'no');
    if (periodLocked(org, x.date)) return say(LOCK_MSG(x.date), 'no');
    const a = Math.abs(x.amount);
    const rec = { id: uid('jm'), date: x.date, title: 'من كشف ' + bankLabel(brAcc) + ': ' + (x.desc || (x.amount > 0 ? 'إيداع' : 'سحب')), opening: false, by: me?.name || '', createdAt: nowISO(), src: 'bank-stmt',
      lines: x.amount > 0 ? [{ code: brAcc, debit: a, credit: 0 }, { code, debit: 0, credit: a }] : [{ code, debit: a, credit: 0 }, { code: brAcc, debit: 0, credit: a }] };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'قيد من كشف البنك', details: bankLabel(brAcc) + ' · ' + x.date + ' · ' + money(x.amount) + ' · ' + (x.desc || '') });
    if (ok) { say('قُيّد ✓ — أعد المطابقة لتحديث الأرصدة'); setFullM(m => m ? { ...m, bankUn: m.bankUn.filter(y => y.i !== x.i), fixed: [...(m.fixed || []), x] } : m); }
  };
  const [clsAmt, setClsAmt] = useState('');
  const [clsDate, setClsDate] = useState(() => today());
  const postClearingClose = async () => {
    const amt = Math.round((Number(clsAmt) || 0) * 100) / 100;
    if (!(amt > 0)) return say('أدخل مبلغ الإقفال', 'no');
    if (periodLocked(org, clsDate)) return say(LOCK_MSG(clsDate), 'no');
    if (amt > clrBal + 0.01) return say('المبلغ أكبر من رصيد الوسيط الحالي (' + money(clrBal) + ')', 'no');
    const rec = {
      id: uid('jm'), date: clsDate, title: 'إقفال وسيط الشبكة في ' + bankLabel(brAcc) + (stMatch ? ' — مطابقة ' + stMatch.month : ''),
      opening: false, by: me?.name || '', createdAt: nowISO(),
      lines: [{ code: brAcc, debit: amt, credit: 0 }, { code: clrAcc, debit: 0, credit: amt }]
    };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), {
      actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post',
      title: 'قيد إقفال وسيط الشبكة', details: bankLabel(brAcc) + ' · ' + money(amt) + ' ر.س'
    });
    if (ok) { setClsAmt(''); say('أُقفل ' + money(amt) + ' من وسيط الشبكة في ' + bankLabel(brAcc) + ' ✓'); }
  };

  // ===== v8.4: إقفال الفترات =====
  const plCfg = org.periodLocks || {};
  const plLog = plCfg.log || [];
  const canLock = !!ROLES[me?.role]?.admin;
  const prevYm = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return isoD(d).slice(0, 7); })();
  const lockChecks = (m) => {
    const end = m + '-31';
    const cls = (ops.closings || []).filter(c => (c.date || '') <= end);
    return {
      drafts: cls.filter(c => c.status === 'draft' || c.status === 'rejected').length,
      pending: cls.filter(c => c.status === 'submitted').length
    };
  };
  const savePl = async (patch, title, details) => {
    await commitOrg(d => {
      const cur = d.periodLocks || {};
      const log = [{ id: uid('pl'), at: nowISO(), by: me.name, ...patch.logEntry }, ...(cur.log || [])].slice(0, 60);
      return { ...d, periodLocks: { ...cur, lockedThrough: patch.lockedThrough, log } };
    }, { actionType: 'update', targetType: 'period_lock', targetId: 'periodLocks', need: 'edit', title, details: details || '' });
  };
  const doLock = async () => {
    const m = lockTo || prevYm;
    if (plCfg.lockedThrough && m <= plCfg.lockedThrough) return say('المقفل حاليًا يغطي هذا الشهر أصلًا', 'no');
    await savePl({ lockedThrough: m, logEntry: { action: 'lock', month: m } },
      'أقفل الفترات المحاسبية حتى ' + m, 'قفل تراكمي — كل ما قبله وضمنه محمي من التعديل');
    // v32.1: تجميد ميزان كل شهر مقفل لم يُجمَّد بعد (أو أُعيد قفله بعد فتح) مع بصمة قيوده
    const AA = buildAccounting(org, ops);
    const todo = snapMonths(AA, m, (ops.ledgerSnaps || []).filter(x => !x.reopened));
    if (todo.length) await commit(d => ({ ...d, ledgerSnaps: [...(d.ledgerSnaps || []).filter(x => !todo.includes(x.month)), ...todo.map(mm => ({ ...monthLedger(AA, mm), id: uid('ls'), at: nowISO(), by: me.name }))] }),
      { actionType: 'create', targetType: 'period_lock', targetId: 'ledgerSnaps', need: 'edit', title: 'جمّد الدفتر المُرحَّل', details: todo.join('، ') });
    setLockTo(''); say('أُقفلت الفترات حتى نهاية ' + m + ' 🔒' + (todo.length ? ' — وجُمّد دفتر ' + todo.length + ' شهر' : ''));
  };
  const doUnlock = async () => {
    if (!unReason.trim()) return say('اكتب سبب الفتح الاستثنائي — إلزامي للتوثيق', 'no');
    if (unTo && plCfg.lockedThrough && unTo >= plCfg.lockedThrough) return say('اختر حدًّا أسبق من المقفل الحالي أو اتركه فارغًا لفتح الكل', 'no');
    await savePl({ lockedThrough: unTo || '', logEntry: { action: 'unlock', month: unTo || 'فتح كامل', reason: unReason.trim() } },
      'فتح استثنائي للفترات المقفلة', 'السبب: ' + unReason.trim() + (unTo ? ' · الحد الجديد ' + unTo : ' · فُتح الكل'));
    // الأشهر المفتوحة تُعلَّم «مفتوحة للتصحيح» — تُجمَّد من جديد عند إعادة القفل، وتبقى الصورة السابقة للمقارنة
    await commit(d => ({ ...d, ledgerSnaps: (d.ledgerSnaps || []).map(x => (!unTo || x.month > unTo) ? { ...x, reopened: nowISO(), reopenReason: unReason.trim() } : x) }),
      { actionType: 'update', targetType: 'period_lock', targetId: 'ledgerSnaps', need: 'edit', title: 'علّم الدفاتر المجمّدة المفتوحة', details: unTo || 'الكل' });
    setUnReason(''); setUnTo(''); say('نُفّذ الفتح الاستثنائي ووُثّق السبب ✓');
  };

  // ===== v8.0: مراكز التكلفة — كل فرع مركز + «المركز الرئيسي» لغير الموسوم بفرع =====
  const centers = [...(org.branches || []).map(b => ({ id: b.id, ar: b.name })), { id: 'central', ar: 'المركز الرئيسي' }];
  const ccAgg = useMemo(() => {
    const m = {};   // accCode -> centerId -> {debit, credit}
    fsEntries.forEach(e => {
      const cid = e.branchId || 'central';
      e.lines.forEach(l => {
        const acc = (m[l.code] = m[l.code] || {});
        const c = (acc[cid] = acc[cid] || { debit: 0, credit: 0 });
        c.debit += l.debit; c.credit += l.credit;
      });
    });
    return m;
  }, [fsEntries]);
  const ccVal = (a, cid) => {
    const x = (ccAgg[a.code] || {})[cid] || { debit: 0, credit: 0 };
    return Math.round(((a.kind === 'asset' || a.kind === 'exp') ? x.debit - x.credit : x.credit - x.debit) * 100) / 100;
  };
  const ccSum = (kind, cid) => Math.round(sum(A.accounts.filter(a => a.kind === kind), a => ccVal(a, cid)) * 100) / 100;
  const ccNet = (cid) => Math.round((ccSum('rev', cid) - ccSum('exp', cid)) * 100) / 100;

  // ===== v8.3: توزيع مصروفات المركز على الفروع — الأساس اختياري حسب الحاجة =====
  // إما تلقائيًا بنسبة مبيعات كل فرع من الإجمالي، أو بنسب يدوية يحددها صاحب المنشأة
  // توزيع تقريري في التقارير فقط — لا يولّد قيودًا
  const ccCfg = org.ccAlloc || { enabled: true, basis: 'sales' };
  const ccBasis = ccCfg.basis || 'sales';
  const ccManual = ccCfg.manual || {};
  const branchRev = {}; let totBranchRev = 0;
  (org.branches || []).forEach(b => { const r = ccSum('rev', b.id); branchRev[b.id] = r; totBranchRev = Math.round((totBranchRev + r) * 100) / 100; });
  const centralExp = ccSum('exp', 'central');
  const manualTot = Math.round(sum(org.branches || [], b => Number(ccManual[b.id]) || 0) * 10) / 10;
  const allocOf = {};
  if (ccCfg.enabled && centralExp > 0) {
    const bs2 = org.branches || [];
    if (ccBasis === 'manual') {
      let accum2 = 0;
      bs2.forEach((b, i) => {
        const pct = Number(ccManual[b.id]) || 0;
        let v = Math.round(centralExp * pct) / 100;
        if (Math.abs(manualTot - 100) < 0.05 && i === bs2.length - 1) v = Math.round((centralExp - accum2) * 100) / 100;
        allocOf[b.id] = v; accum2 = Math.round((accum2 + v) * 100) / 100;
      });
    } else if (totBranchRev > 0) {
      let accum2 = 0;
      bs2.forEach((b, i) => {
        const v = i === bs2.length - 1
          ? Math.round((centralExp - accum2) * 100) / 100
          : Math.round(centralExp * (branchRev[b.id] / totBranchRev) * 100) / 100;
        allocOf[b.id] = v; accum2 = Math.round((accum2 + v) * 100) / 100;
      });
    }
  }
  const allocTot = Math.round(sum(org.branches || [], b => allocOf[b.id] || 0) * 100) / 100;
  const unalloc = Math.round((centralExp - allocTot) * 100) / 100;
  const shareOf = (bid) => ccBasis === 'manual'
    ? (Number(ccManual[bid]) || 0)
    : (totBranchRev > 0 ? Math.round(branchRev[bid] / totBranchRev * 1000) / 10 : 0);
  const netAfter = (bid) => Math.round((ccNet(bid) - (allocOf[bid] || 0)) * 100) / 100;
  const ccReady = ccBasis === 'manual' ? manualTot > 0 : totBranchRev > 0;
  const saveCcAlloc = async (patch, title, details) => {
    await commitOrg(d => ({ ...d, ccAlloc: { enabled: true, basis: 'sales', ...(d.ccAlloc || {}), ...patch } }), {
      actionType: 'update', targetType: 'tax_settings', targetId: 'ccAlloc', need: 'post', title, details: details || ''
    });
  };

  // ===== v8.2: طباعة موحّدة لكل تقارير المحاسبة =====
  const periodSub = (from || to) ? ('الفترة: ' + (from || 'البداية') + ' ← ' + (to || today())) : 'كامل المدة حتى ' + arDate(today());
  const printTB = () => {
    const rows = A.accounts.filter(tbShow).map(a => {
      const x = tbMov(a); const bl = tbClose(a); const op = tbOpen(a);
      return `<tr${TB_VAT.includes(a.code) ? ' style="background:#fbf6ea"' : ''}><td>${a.code} · ${a.name}</td>${from ? `<td class="n">${op ? fmtBal(op) : '—'}</td>` : ''}<td class="n">${x.debit ? money(x.debit) : '—'}</td><td class="n">${x.credit ? money(x.credit) : '—'}</td><td class="n ${bl < 0 ? 'neg' : ''}">${fmtBal(bl)}</td></tr>`;
    }).join('');
    const rec = vatRec ? `<h3 style="margin:14px 0 4px;font-size:13px">مطابقة حسابات الضريبة مع الإقرار — ${vatRec.ok ? 'مطابق ✓' : 'يوجد فرق'}</h3>
      <table><thead><tr><th>البند</th><th>ميزان المراجعة</th><th>الإقرار</th><th>الفرق</th></tr></thead><tbody>
      <tr><td>ضريبة المخرجات (2301)</td><td class="n">${money(vatRec.tbOut)}</td><td class="n">${money(vsum.out)}</td><td class="n">${fmtBal(vatRec.dOut)}</td></tr>
      <tr><td>ضريبة المدخلات (1501)</td><td class="n">${money(vatRec.tbIn)}</td><td class="n">${money(vsum.inn)}</td><td class="n">${fmtBal(vatRec.dIn)}</td></tr>
      <tr class="tot"><td>الصافي</td><td class="n">${fmtBal(r2x(vatRec.tbOut - vatRec.tbIn))}</td><td class="n">${fmtBal(vatDue)}</td><td class="n">${fmtBal(r2x(vatRec.dOut - vatRec.dIn))}</td></tr></tbody></table>
      ${vatRec.causes.length ? '<div class="box">القيود المسببة للفرق: ' + vatRec.causes.map(c => c.date + ' · ' + c.title + ' (' + c.why + ')').join(' — ') + '</div>' : ''}` : '';
    printA4(org, 'ميزان المراجعة', periodSub + (bf ? ' · ' + (bf === 'central' ? 'القيود المركزية' : (((org.branches || []).find(b => b.id === bf) || {}).name || '')) : ' · كل الفروع'),
      `<table><thead><tr><th>الحساب</th>${from ? '<th>أول المدة</th>' : ''}<th>مدين</th><th>دائن</th><th>${from ? 'آخر المدة' : 'الرصيد'}</th></tr></thead><tbody>${rows}
      <tr class="tot"><td${from ? ' colspan="2"' : ''}>الإجمالي ${Math.abs(tbD - tbC) < 0.01 ? '— متوازن ✓' : ''}</td><td class="n">${money(tbD)}</td><td class="n">${money(tbC)}</td><td></td></tr></tbody></table>${rec}`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printCC = () => {
    const head = centers.map(c => `<th>${c.ar}</th>`).join('');
    const rowOf = (a) => `<tr><td>${a.name}</td>${centers.map(c => `<td class="n">${ccVal(a, c.id) ? money(ccVal(a, c.id)) : '—'}</td>`).join('')}<td class="n">${money(sum(centers, c => ccVal(a, c.id)))}</td></tr>`;
    const revRows = A.accounts.filter(a => a.kind === 'rev' && ccAgg[a.code]).map(rowOf).join('');
    const expRows = A.accounts.filter(a => a.kind === 'exp' && ccAgg[a.code]).map(rowOf).join('');
    printA4(org, 'مراكز التكلفة والربحية', periodSub,
      `<table><thead><tr><th>الحساب</th>${head}<th>الإجمالي</th></tr></thead><tbody>
      <tr class="tot"><td colspan="${centers.length + 2}">الإيرادات</td></tr>${revRows}
      <tr class="tot"><td colspan="${centers.length + 2}">المصروفات</td></tr>${expRows}
      <tr class="tot"><td>صافي كل مركز</td>${centers.map(c => `<td class="n ${ccNet(c.id) < 0 ? 'neg' : ''}">${ccNet(c.id) < 0 ? '(' + money(-ccNet(c.id)) + ')' : money(ccNet(c.id))}</td>`).join('')}<td class="n">${money(sum(centers, c => ccNet(c.id)))}</td></tr></tbody></table>
      ${ccCfg.enabled && ccReady ? `<h1 style="font-size:14px;margin:14px 0 4px">توزيع مصروفات المركز على الفروع — ${ccBasis === 'manual' ? 'نسب يدوية' : 'بنسبة المبيعات'}</h1>
      <table><thead><tr><th>الفرع</th><th>مبيعاته</th><th>نسبته</th><th>حصته من مصروفات المركز</th><th>صافيه المباشر</th><th>صافيه بعد التحميل</th></tr></thead><tbody>
      ${(org.branches || []).map(b => `<tr><td>${b.name}</td><td class="n">${money(branchRev[b.id] || 0)}</td><td class="n">${shareOf(b.id)}%</td><td class="n neg">(${money(allocOf[b.id] || 0)})</td><td class="n">${money(ccNet(b.id))}</td><td class="n">${money(netAfter(b.id))}</td></tr>`).join('')}
      <tr class="tot"><td>الإجمالي</td><td class="n">${money(totBranchRev)}</td><td class="n">100%</td><td class="n">(${money(centralExp)})</td><td class="n">${money(sum(org.branches || [], b => ccNet(b.id)))}</td><td class="n">${money(sum(org.branches || [], b => netAfter(b.id)))}</td></tr></tbody></table>
      <div class="box">${ccBasis === 'manual' ? 'الأساس: نسب يدوية حددها صاحب المنشأة (المجموع ' + manualTot + '%)' : 'القاعدة: حصة الفرع = مصروفات المركز × (مبيعاته ÷ إجمالي مبيعات الفروع)'} — توزيع تقريري لا يولّد قيودًا.</div>` : '<div class="box">عمود «المركز الرئيسي» يضم ما لا يخص فرعًا بعينه.</div>'}`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printJR = () => {
    const list = entries.slice(0, 300);
    const rows = list.map(e => `<tr><td class="n">${e.no}</td><td class="n">${e.date}</td><td>${e.title}</td><td>${e.manual ? e.src : 'تلقائي · ' + e.src}</td><td class="n">${money(e.debit)}</td></tr>`).join('');
    printA4(org, 'دفتر اليومية', periodSub + (month ? ' · شهر ' + month : '') + (q.trim() ? ' · بحث: ' + q.trim() : '') + ' · ' + list.length + ' قيدًا',
      `<table><thead><tr><th>رقم</th><th>التاريخ</th><th>البيان</th><th>المصدر</th><th>المبلغ</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="4">إجمالي القيود المعروضة</td><td class="n">${money(sum(list, e => e.debit))}</td></tr></tbody></table>
      <div class="box">تفاصيل أطراف كل قيد (مدين/دائن) متاحة داخل النظام بفتح القيد — وكلها متوازنة.</div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printVAT = () => {
    const tr = (cells, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.join('') + '</tr>';
    const td = (x, n) => '<td' + (n ? ' class="n"' : '') + '>' + x + '</td>';
    const form = vatFormRows().map(r => tr([td(r.n), td(r.t + (r.na ? ' <span style="color:#999;font-size:10px">(غير مسجّل)</span>' : '')), td(r.only ? '' : fmtBal(r.a), 1), td(r.only ? '' : fmtBal(r.adj), 1), td(fmtBal(r.v), 1)], r.net || r.tot ? 'tot' : '')).join('');
    const br = vatX.br.map(b2 => tr([td(b2.name), td(fmtBal(b2.ns), 1), td(fmtBal(b2.out), 1), td(fmtBal(b2.np), 1), td(fmtBal(b2.inn), 1), td(fmtBal(r2x(b2.out - b2.inn)), 1)])).join('');
    const mon = vatX.mon.map(m => tr([td(m.k), td(fmtBal(m.ns), 1), td(fmtBal(m.out), 1), td(fmtBal(m.inn), 1), td(fmtBal(r2x(m.out - m.inn)), 1)])).join('');
    const sup = vatX.sup.slice(0, 15).map(u => tr([td(u.name), td(u.vatNo || '<span class="neg">غير مسجّل</span>'), td(u.n, 1), td(fmtBal(u.net), 1), td(fmtBal(u.vat), 1)])).join('');
    const ck = vatChecks.map(c => '<div style="margin:3px 0;color:' + (c.s === 'bad' ? '#C0392B' : c.s === 'warn' ? '#B7791F' : '#2E8B62') + '">' + (c.s === 'ok' ? '✓ ' : c.s === 'bad' ? '✗ ' : '! ') + c.t + '</div>').join('');
    printA4(org, 'مسودة الإقرار الضريبي', periodSub + ' · النسبة ' + taxRate + '%',
      `<div class="box">${ck}</div>
      <h3 style="margin:10px 0 4px;font-size:13px">نموذج الإقرار</h3>
      <table><thead><tr><th>#</th><th>البند</th><th>المبلغ</th><th>التعديلات</th><th>الضريبة ${taxRate}%</th></tr></thead><tbody>${form}</tbody></table>
      <h3 style="margin:12px 0 4px;font-size:13px">حسب الفرع</h3>
      <table><thead><tr><th>الفرع</th><th>مبيعات صافية</th><th>مخرجات</th><th>مشتريات صافية</th><th>مدخلات</th><th>الصافي</th></tr></thead><tbody>${br}
      <tr class="tot"><td>الإجمالي</td><td class="n">${money(vsum.netSales)}</td><td class="n">${money(vsum.out)}</td><td class="n">${money(vsum.netPurch)}</td><td class="n">${money(vsum.inn)}</td><td class="n">${fmtBal(vatDue)}</td></tr></tbody></table>
      <h3 style="margin:12px 0 4px;font-size:13px">حسب الشهر</h3>
      <table><thead><tr><th>الشهر</th><th>مبيعات صافية</th><th>مخرجات</th><th>مدخلات</th><th>الصافي</th></tr></thead><tbody>${mon}</tbody></table>
      ${sup ? `<h3 style="margin:12px 0 4px;font-size:13px">أكبر الموردين بضريبة المدخلات</h3><table><thead><tr><th>المورد</th><th>الرقم الضريبي</th><th>الفواتير</th><th>مشتريات صافية</th><th>مدخلات</th></tr></thead><tbody>${sup}</tbody></table>` : ''}
      <div class="box">مسودة داخلية تساعد على تعبئة الإقرار في بوابة الهيئة — وليست تقديمًا رسميًا. البنود غير المسجّلة في المنصة تظهر صفرًا.</div>
      <div class="sign"><div>المحاسب</div><div>الإدارة المالية</div><div>اعتماد الإدارة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printAST = () => {
    const act = A.assetRows.filter(a => !a.disposed);
    const rows = A.assetRows.map(a => `<tr${a.disposed ? ' style="color:#999"' : ''}><td>${a.name}</td><td class="n">${a.buyDate}</td><td class="n">${money(a.cost)}</td><td class="n">${money(a.monthly)}</td><td class="n">${money(a.accum)}</td><td class="n">${a.disposed ? '—' : money(a.book)}</td><td>${a.disposed ? 'مُستبعَد ' + a.disposedDate + (Math.abs(a.gain) >= 0.005 ? (a.gain > 0 ? ' (ربح ' : ' (خسارة ') + money(Math.abs(a.gain)) + ')' : '') : a.done ? 'مُهلك بالكامل' : 'قيد الإهلاك ' + a.monthsDone + '/' + a.nM}</td></tr>`).join('');
    printA4(org, 'سجل الأصول الثابتة والإهلاك', arDate(today()),
      `<table><thead><tr><th>الأصل</th><th>الشراء</th><th>التكلفة</th><th>القسط الشهري</th><th>المجمّع</th><th>القيمة الدفترية</th><th>الحالة</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="2">إجمالي الأصول القائمة</td><td class="n">${money(sum(act, a => a.cost))}</td><td></td><td class="n">${money(sum(act, a => a.accum))}</td><td class="n">${money(sum(act, a => a.book))}</td><td></td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v10.4: طباعة قائمة التدفقات النقدية A4 =====
  const printCF = () => {
    const secHtml = (cls, title, sub) => {
      const rows = cfRows(cls).map(r => `<tr><td>${r.label}</td><td class="n">${r.amt < 0 ? '(' + money(-r.amt) + ')' : money(r.amt)}</td></tr>`).join('') || '<tr><td>لا حركة في الفترة</td><td class="n">0.00</td></tr>';
      const n = cfNet(cls);
      return `<tr class="sec"><td colspan="2">${title}</td></tr>${rows}<tr class="sub"><td>${sub}</td><td class="n">${n < 0 ? '(' + money(-n) + ')' : money(n)}</td></tr>`;
    };
    const period = (from || to) ? ('الفترة: ' + (from || 'البداية') + ' ← ' + (to || arDate(today()))) : 'حتى ' + arDate(today());
    printA4(org, 'قائمة التدفقات النقدية' + (bfLabel ? ' — ' + bfLabel : ''), period,
      `<table><tbody>
        <tr class="tot"><td>النقد في بداية الفترة</td><td class="n">${money(cfBegin)}</td></tr>
        ${secHtml('op', 'الأنشطة التشغيلية', 'صافي النقد من الأنشطة التشغيلية')}
        ${secHtml('inv', 'الأنشطة الاستثمارية', 'صافي النقد من الأنشطة الاستثمارية')}
        ${secHtml('fin', 'الأنشطة التمويلية', 'صافي النقد من الأنشطة التمويلية')}
        <tr class="tot"><td>صافي التغيّر في النقد</td><td class="n">${cfChange < 0 ? '(' + money(-cfChange) + ')' : money(cfChange)}</td></tr>
        <tr class="tot"><td>النقد في نهاية الفترة (محسوب)</td><td class="n">${money(cfEndComputed)}</td></tr>
        <tr class="tot"><td>مطابقة رصيد النقد الدفتري ${cfOk ? '✓' : '(لا يطابق)'}</td><td class="n">${money(cfEndBook)}</td></tr>
      </tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v10.5: طباعة الموازنة والانحرافات A4 =====
  const printBudget = () => {
    const rows = budRows.map(r => {
      const vtxt = r.variance < 0 ? '(' + money(-r.variance) + ')' : money(r.variance);
      const state = r.a.kind === 'exp' ? (r.over ? 'تجاوز' : 'ضمن الميزانية') : (r.actual + 0.005 >= r.budget ? 'تحقّق الهدف' : 'دون الهدف');
      return `<tr><td>${r.a.name}</td><td class="n">${money(r.budget)}</td><td class="n">${money(r.actual)}</td><td class="n">${vtxt}</td><td class="n">${r.pct == null ? '—' : r.pct + '%'}</td><td>${state}</td></tr>`;
    }).join('');
    printA4(org, 'الموازنة التقديرية والانحرافات — شهر ' + bMonth, arDate(today()),
      `<table><thead><tr><th>البند</th><th>الموازنة</th><th>الفعلي</th><th>الفرق</th><th>النسبة</th><th>الحالة</th></tr></thead><tbody>${rows}
      <tr class="tot"><td>إجمالي الإيرادات</td><td class="n">${money(budRevB)}</td><td class="n">${money(budRevA)}</td><td class="n">${(budRevA - budRevB) < 0 ? '(' + money(budRevB - budRevA) + ')' : money(budRevA - budRevB)}</td><td></td><td></td></tr>
      <tr class="tot"><td>إجمالي المصروفات</td><td class="n">${money(budExpB)}</td><td class="n">${money(budExpA)}</td><td class="n">${(budExpA - budExpB) < 0 ? '(' + money(budExpB - budExpA) + ')' : money(budExpA - budExpB)}</td><td></td><td></td></tr>
      <tr class="tot"><td>صافي الربح</td><td class="n">${money(budNetB)}</td><td class="n">${money(budNetA)}</td><td class="n">${(budNetA - budNetB) < 0 ? '(' + money(budNetB - budNetA) + ')' : money(budNetA - budNetB)}</td><td></td><td></td></tr>
      </tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v10.6: طباعة التحليل والنِسَب A4 =====
  const printAnalysis = () => {
    const rr = (label, val) => `<tr><td>${label}</td><td class="n">${val}</td></tr>`;
    const trend = anlTrend.map(m => `<tr><td>${m.ym}</td><td class="n">${money(m.rev)}</td><td class="n">${money(m.exp)}</td><td class="n">${money(m.net)}</td></tr>`).join('');
    const period = (from || to) ? ('الفترة: ' + (from || 'البداية') + ' ← ' + (to || arDate(today()))) : 'حتى ' + arDate(today());
    printA4(org, 'التحليل المالي والنِسَب' + (bfLabel ? ' — ' + bfLabel : ''), period,
      `<div style="display:flex;gap:16px">
        <table style="flex:1"><thead><tr><th colspan="2">الربحية</th></tr></thead><tbody>
          ${rr('هامش الربح الصافي', pctTxt(ratios.netMargin))}${rr('نسبة المصروفات للإيراد', pctTxt(ratios.expRatio))}${rr('العائد على الأصول', pctTxt(ratios.roa))}${rr('العائد على حقوق الملكية', pctTxt(ratios.roe))}
        </tbody></table>
        <table style="flex:1"><thead><tr><th colspan="2">السيولة</th></tr></thead><tbody>
          ${rr('النسبة الجارية', xTxt(ratios.current))}${rr('النسبة السريعة', xTxt(ratios.quick))}${rr('نسبة النقد', xTxt(ratios.cashRatio))}${rr('رأس المال العامل', money(ratios.workingCap))}
        </tbody></table>
        <table style="flex:1"><thead><tr><th colspan="2">الرفع والكفاءة</th></tr></thead><tbody>
          ${rr('الدين إلى حقوق الملكية', xTxt(ratios.de))}${rr('الخصوم إلى الأصول', pctTxt(ratios.da))}${rr('معدل دوران الأصول', xTxt(ratios.turnover))}
        </tbody></table>
      </div>
      <h3 style="margin:14px 0 6px;color:#5a4a1e">الاتجاه الشهري (آخر 6 أشهر)</h3>
      <table><thead><tr><th>الشهر</th><th>الإيرادات</th><th>المصروفات</th><th>صافي الربح</th></tr></thead><tbody>${trend}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v10.7: طباعة أعمار الموردين وكشف الحساب A4 =====
  const printAging = () => {
    const rows = apRows.map(r => `<tr><td>${r.p.name}</td><td class="n">${r.p.terms ? r.p.terms + ' يوم' : '—'}</td><td class="n">${money(r.b0)}</td><td class="n">${money(r.b30)}</td><td class="n">${money(r.b60)}</td><td class="n">${money(r.b90)}</td><td class="n">${money(r.total)}</td></tr>`).join('');
    printA4(org, 'أعمار ديون الموردين', 'حتى ' + arDate(apToday),
      `<table><thead><tr><th>المورد</th><th>المهلة</th><th>جاري ≤30</th><th>31–60</th><th>61–90</th><th>أكثر من 90</th><th>الإجمالي</th></tr></thead><tbody>${rows}
      <tr class="tot"><td>الإجمالي</td><td></td><td class="n">${money(apTot.b0)}</td><td class="n">${money(apTot.b30)}</td><td class="n">${money(apTot.b60)}</td><td class="n">${money(apTot.b90)}</td><td class="n">${money(apTot.owed)}</td></tr>
      </tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printSupStatement = (p) => {
    const rows = apStmt(p).map(t => `<tr><td class="n">${t.date}</td><td>${t.desc}</td><td class="n">${t.credit ? money(t.credit) : ''}</td><td class="n">${t.debit ? money(t.debit) : ''}</td><td class="n">${money(t.run)}</td></tr>`).join('');
    printA4(org, 'كشف حساب مورد — ' + p.name, 'حتى ' + arDate(apToday),
      `<table><thead><tr><th>التاريخ</th><th>البيان</th><th>فاتورة/عليك</th><th>سداد</th><th>الرصيد</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="4">الرصيد المستحق للمورد</td><td class="n">${money(p.balance)}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printArAging = () => {
    const rows = arRows.map(r => `<tr><td>${_xe(r.p.name)}</td><td class="n">${r.limit ? money(r.limit) : '—'}</td><td class="n">${money(r.b0)}</td><td class="n">${money(r.b30)}</td><td class="n">${money(r.b60)}</td><td class="n">${money(r.b90)}</td><td class="n">${money(r.total)}</td></tr>`).join('');
    printA4(org, 'أعمار الذمم المدينة (العملاء)', 'حتى ' + arDate(arToday),
      `<table><thead><tr><th>العميل</th><th>حد الائتمان</th><th>جاري ≤30</th><th>31–60</th><th>61–90</th><th>أكثر من 90</th><th>الإجمالي</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="2">الإجمالي</td><td class="n">${money(arTot.b0)}</td><td class="n">${money(arTot.b30)}</td><td class="n">${money(arTot.b60)}</td><td class="n">${money(arTot.b90)}</td><td class="n">${money(arTot.owed)}</td></tr>
      </tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printCustStatement = (p) => {
    const rows = arStmt(p).map(t => `<tr><td class="n">${t.date}</td><td>${_xe(t.desc)}</td><td class="n">${t.debit ? money(t.debit) : ''}</td><td class="n">${t.credit ? money(t.credit) : ''}</td><td class="n">${money(t.run)}</td></tr>`).join('');
    printA4(org, 'كشف حساب عميل — ' + p.name, 'حتى ' + arDate(arToday),
      `<table><thead><tr><th>التاريخ</th><th>البيان</th><th>على العميل</th><th>تحصيل</th><th>الرصيد المدين</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="4">إجمالي المستحق على العميل</td><td class="n">${money(r2(-p.balance))}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v8.0: طباعة القوائم المالية A4 =====
  const printFS = () => {
    const w = openDocWin('width=900,height=1000');
    if (!w) return say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
    const co = org.company || {};
    const period = (from || to) ? ('الفترة: ' + (from || 'البداية') + ' ← ' + (to || today())) : 'كامل المدة حتى ' + arDate(today());
    const isTitle = bfLabel ? ' — ' + bfLabel : ' (موحدة)';
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>القوائم المالية — ${co.name || ''}</title>
    <style>${NUM_FACE}*{font-family:'MizanNum','Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:26px;color:#1a1a1a;font-size:12.5px}
    .h{display:flex;justify-content:space-between;border-bottom:2px solid #8C6F2C;padding-bottom:10px;margin-bottom:14px}
    .co{font-size:19px;font-weight:800;color:#5a4a1e}.sub{font-size:11px;color:#666;margin-top:2px}
    h2{font-size:15px;margin:14px 0 8px;color:#5a4a1e}table{width:100%;border-collapse:collapse;margin-bottom:8px}
    td{padding:6px 8px;border:1px solid #e6ddc8}.n{text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
    .tot td{background:#f5f0e4;font-weight:800;border-top:2px solid #8C6F2C}
    .hd td{font-weight:800;color:#5a4a1e;border:0;padding-top:10px}.grp td{font-weight:700;background:#fbf8f1}.net td{border-top:3px double #1a1a1a;font-size:13.5px}
    .ft{margin-top:14px;font-size:10px;color:#888;text-align:center}.grid2{display:flex;gap:16px}.grid2>div{flex:1}</style></head><body>
    <div class="h"><div><div class="co">${co.name || 'الشركة'}</div><div class="sub">${co.taxNumber ? 'الرقم الضريبي: ' + co.taxNumber : ''}</div></div>
    <div style="text-align:left"><div style="font-size:17px;font-weight:800">القوائم المالية</div><div class="sub">${period}</div></div></div>
    <div class="grid2"><div>
    <h2>قائمة الدخل${isTitle}</h2><table>
    ${isRowsOf(isY).map(r => r.t === 'head' ? `<tr class="hd"><td colspan="2">${r.label}</td></tr>`
      : `<tr class="${r.t === 'line' ? '' : r.t === 'grp' ? 'grp' : 'tot'}${r.t === 'net' ? ' net' : ''}"><td${r.ind ? ' style="padding-right:22px"' : ''}>${r.label}</td><td class="n">${fmtBal(r.amt)}</td></tr>`).join('')}</table>
    </div><div>
    <h2>قائمة المركز المالي (موحدة — البنك والخزينة ورأس المال مركزية)</h2><table>
    ${bsRowsOf(bsY, bsOk).map(r => r.t === 'head' ? `<tr class="hd"><td colspan="2">${r.label}</td></tr>` : r.t === 'grp' ? `<tr class="grp"><td colspan="2">${r.label}</td></tr>`
      : `<tr class="${r.t === 'line' ? '' : 'tot'}${r.t === 'net' ? ' net' : ''}"><td${r.t === 'line' ? ' style="padding-right:18px"' : ''}>${r.label}</td><td class="n">${fmtBal(r.amt)}</td></tr>`).join('')}</table>
    </div></div>
    ${taxOn ? '<div class="sub">الأرقام صافية — ضريبة القيمة المضافة مفصولة في حسابَي المدخلات والمخرجات.</div>' : '<div class="sub">الأرقام إجمالية شاملة الضريبة.</div>'}
    <div class="ft">صادر من منصة ميزان — ${arDate(today())} · القيود مشتقة تلقائيًا ومتوازنة (مدين = دائن)</div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  // ===== القيد اليدوي/الافتتاحي =====
  const newJm = () => setJm({
    date: today(), title: '', opening: false,
    lines: [{ code: '', debit: '', credit: '' }, { code: '', debit: '', credit: '' }]
  });
  const jmUp = (i, k, v) => setJm(m => ({ ...m, lines: m.lines.map((l, x) => x === i ? { ...l, [k]: v } : l) }));
  const jmD = jm ? sum(jm.lines, l => Number(l.debit) || 0) : 0;
  const jmC = jm ? sum(jm.lines, l => Number(l.credit) || 0) : 0;
  const jmOk = jm && jmD > 0 && Math.abs(jmD - jmC) < 0.005 &&
    jm.lines.every(l => !((Number(l.debit) || 0) && (Number(l.credit) || 0))) &&
    jm.lines.filter(l => l.code && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0).length >= 2;
  const saveJm = async () => {
    if (periodLocked(org, jm && jm.date)) return say(LOCK_MSG(jm.date), 'no');
    if (!jmOk) return say('القيد غير مكتمل — اختر الحسابات وتأكد أن مجموع المدين يساوي الدائن', 'no');
    const rec = {
      id: uid('jm'), date: jm.date || today(), title: jm.title.trim() || (jm.opening ? 'قيد افتتاحي' : 'قيد يدوي'),
      opening: !!jm.opening, by: me?.name || '', createdAt: nowISO(),
      lines: jm.lines.filter(l => l.code && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0)
        .map(l => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
    };
    await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), {
      actionType: 'create', targetType: 'journal_entry', targetId: rec.id,
      need: 'post', title: rec.opening ? 'أضاف قيدًا افتتاحيًا' : 'أضاف قيدًا محاسبيًا يدويًا',
      details: rec.title + ' · ' + money(sum(rec.lines, l => l.debit)) + ' ر.س'
    });
    setJm(null); say('سُجّل القيد ✓ — التصحيح لاحقًا يكون بقيد عكسي لا بالحذف');
  };

  // v9.7 — الحسابات القابلة لإدخال رصيد افتتاحي (أصول/خصوم، عدا ضريبة ومجمع إهلاك وأصول ثابتة ورأس المال المحسوب)
  const obAccounts = A.accounts.filter(a => (a.kind === 'asset' || a.kind === 'liab') && !['1501', '2301', '1701', '1791'].includes(a.code));
  const saveOB = async () => {
    const asOf = (obD.asOf || today()).slice(0, 10);
    if (periodLocked(org, asOf)) return say(LOCK_MSG(asOf), 'no');
    const lines = obAccounts.map(a => {
      const amt = Math.round((Number(obD.map[a.code]) || 0) * 100) / 100;
      if (!amt) return null;
      return a.kind === 'asset' ? { code: a.code, debit: amt, credit: 0 } : { code: a.code, debit: 0, credit: amt };
    }).filter(Boolean);
    await commitOrg(d => ({ ...d, openingBalances: { asOf, enabled: obD.enabled !== false, lines } }), {
      actionType: 'update', targetType: 'opening_balances', targetId: 'ob',
      need: 'post', title: 'حدّث الأرصدة الافتتاحية', details: lines.length + ' حساب · بتاريخ ' + asOf
    });
    say('حُفظت الأرصدة الافتتاحية — يظهر القيد الافتتاحي في اليومية والميزان');
  };

  // v10.3 — حفظ إعداد إقفال السنة المالية (قيد إقفال آلي يُصفّر الإيرادات/المصروفات إلى الأرباح المبقاة)
  const saveYearEnd = async () => {
    const cd = (yeD.closeDate || '').slice(0, 10);
    if (yeD.enabled && !cd) return say('اختر تاريخ إقفال السنة', 'no');
    if (yeD.enabled && cd > today()) return say('تاريخ الإقفال في المستقبل — اختر تاريخًا منتهيًا', 'no');
    await commitOrg(d => ({ ...d, yearEnd: { enabled: !!yeD.enabled, closeDate: cd } }), {
      actionType: 'update', targetType: 'year_end', targetId: 'yearend',
      need: 'edit', title: yeD.enabled ? 'فعّل إقفال السنة المالية' : 'أوقف إقفال السنة المالية',
      details: yeD.enabled ? ('حتى ' + cd) : 'موقوف'
    });
    say(yeD.enabled ? 'فُعّل الإقفال — تولّد قيد إقفال السنة وحُوّل الصافي إلى الأرباح المبقاة ✓' : 'أُوقف إقفال السنة');
  };

  // v10.5 — حفظ الموازنة التقديرية (مبالغ شهرية لكل حساب إيراد/مصروف)
  const saveBudget = async () => {
    const lines = Object.keys(budD.map).map(code => { const amount = Math.round((Number(budD.map[code]) || 0) * 100) / 100; return amount > 0 ? { code, amount } : null; }).filter(Boolean);
    await commitOrg(d => ({ ...d, budget: { enabled: !!budD.enabled, lines } }), {
      actionType: 'update', targetType: 'budget', targetId: 'budget',
      need: 'post', title: budD.enabled ? 'حدّث/فعّل الموازنة التقديرية' : 'أوقف الموازنة التقديرية',
      details: lines.length + ' بند'
    });
    say(budD.enabled ? 'حُفظت الموازنة — قارِن الفعلي بالمخطّط شهريًا ✓' : 'حُفظت الموازنة (موقوفة)');
  };

  // v11.4 — حفظ افتراضات التوقّع النقدي (فارغ = يستخدم المتوسط التاريخي تلقائيًا)
  const saveForecast = async () => {
    const num = (s) => s === '' ? null : (Math.round((Number(s) || 0) * 100) / 100);
    await commitOrg(d => ({ ...d, forecastCfg: { monthlySales: num(fcD.monthlySales), monthlyOpex: num(fcD.monthlyOpex), safetyBuffer: num(fcD.buffer), horizon: Number(fcD.horizon) || 6 } }), {
      actionType: 'update', targetType: 'year_end', targetId: 'forecast',
      need: 'post', title: 'حدّث افتراضات التوقّع النقدي', details: 'أفق ' + (fcD.horizon || 6) + ' أشهر'
    });
    say('حُفظت افتراضات التوقّع ✓');
  };

  // v11.6 — حفظ عتبة التدقيق
  const saveAudit = async () => {
    await commitOrg(d => ({ ...d, auditCfg: { largeAmount: Math.round((Number(audD.largeAmount) || 0) * 100) / 100 } }), {
      actionType: 'update', targetType: 'year_end', targetId: 'audit', need: 'edit', title: 'حدّث عتبة التدقيق الداخلي', details: 'حد المبلغ الكبير ' + money(Number(audD.largeAmount) || 0)
    });
    say('حُفظت عتبة التدقيق ✓');
  };

  // v9.9 — حفظ تسوية كشف تطبيق توصيل
  const saveStl = async () => {
    if (!stlF) return;
    if (periodLocked(org, stlF.date)) return say(LOCK_MSG(stlF.date), 'no');
    if (!stlF.appId) return say('اختر تطبيق التوصيل', 'no');
    const dep = Math.round((Number(stlF.deposit) || 0) * 100) / 100;
    const ded = Math.round((Number(stlF.deductions) || 0) * 100) / 100;
    if (dep + ded <= 0) return say('أدخل مبلغ الإيداع', 'no');
    const appNm = ((org.deliveryApps || []).find(a => a.id === stlF.appId) || {}).n || 'تطبيق';
    const rec = { id: uid('astl'), appId: stlF.appId, date: stlF.date || today(), deposit: dep, deductions: ded, note: stlF.note || '', by: me?.name || '', createdAt: nowISO() };
    await commit(d => ({ ...d, appSettlements: [rec, ...(d.appSettlements || [])] }), {
      actionType: 'create', targetType: 'app_settlement', targetId: rec.id,
      need: 'post', title: 'سجّل تسوية كشف تطبيق', details: appNm + ' · إيداع ' + money(dep) + (ded ? ' · خصم ' + money(ded) : '')
    });
    setStlF(null); say('سُجّلت التسوية — أُقفلت ذمة ' + appNm + ' بمقدار ' + money(dep + ded));
  };

  // ===== v11.2: تصدير للمحاسب — CSV بترميز UTF-8 (يفتح في Excel بالعربية)، يحترم الفترة والفرع =====
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = (rows) => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const dlFile = (name, text) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const kindAr = { asset: 'أصول', liab: 'خصوم', equity: 'حقوق ملكية', rev: 'إيرادات', exp: 'مصروفات' };
  const expTag = (from || to) ? ((from || 'البداية') + '_' + (to || today())) : ('حتى_' + today());
  const journalRows = () => {
    const rows = [['رقم القيد', 'التاريخ', 'البيان', 'المصدر', 'رمز الحساب', 'اسم الحساب', 'مدين', 'دائن']];
    tbEntries.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.no || '').localeCompare(b.no || ''))
      .forEach(e => e.lines.forEach(l => rows.push([e.no, e.date, e.title, e.src, l.code, l.name, l.debit || '', l.credit || ''])));
    rows.push(['', '', '', '', '', 'الإجمالي', Math.round(tbD * 100) / 100, Math.round(tbC * 100) / 100]);
    return rows;
  };
  const tbRows = () => {
    const rows = [['رمز الحساب', 'اسم الحساب', 'النوع', 'رصيد أول المدة', 'مدين', 'دائن', 'رصيد آخر المدة']];
    A.accounts.filter(tbShow).forEach(a => { const x = tbMov(a); rows.push([a.code, a.name, kindAr[a.kind] || a.kind, Math.round(tbOpen(a) * 100) / 100, Math.round(x.debit * 100) / 100, Math.round(x.credit * 100) / 100, tbClose(a)]); });
    rows.push(['', 'الإجمالي', '', '', Math.round(tbD * 100) / 100, Math.round(tbC * 100) / 100, '']);
    if (vatRec) { rows.push(['', '', '', '', '', '', ''], ['', 'مطابقة الضريبة مع الإقرار', '', 'ميزان المراجعة', 'الإقرار', 'الفرق', ''],
      ['2301', 'ضريبة المخرجات', '', vatRec.tbOut, r2x(vsum.out), vatRec.dOut, ''], ['1501', 'ضريبة المدخلات', '', vatRec.tbIn, r2x(vsum.inn), vatRec.dIn, '']); }
    return rows;
  };
  const fsRows = () => {
    const R = (n) => Math.round(n * 100) / 100;
    const rows = [['قائمة الدخل', ''], ['الحساب', 'المبلغ']];
    isRowsOf(isY).forEach(r => rows.push(r.t === 'head' ? [r.label, ''] : [(r.ind ? '    ' : '') + r.label, R(r.amt)]));
    rows.push(['', '']);
    rows.push(['قائمة المركز المالي', ''], ['الحساب', 'المبلغ']);
    bsRowsOf(bsY, bsOk).forEach(r => rows.push(r.t === 'head' || r.t === 'grp' ? [r.label, ''] : [(r.t === 'line' ? '    ' : '') + r.label, R(r.amt)]));
    return rows;
  };
  const coaRows = () => { const rows = [['رمز الحساب', 'اسم الحساب', 'النوع']]; A.accounts.forEach(a => rows.push([a.code, a.name, kindAr[a.kind] || a.kind])); return rows; };
  const isRows = () => {
    const R = (n) => Math.round(n * 100) / 100; const rows = [['الحساب', 'المبلغ']];
    isRowsOf(isY).forEach(r => rows.push(r.t === 'head' ? [r.label, ''] : [(r.ind ? '    ' : '') + r.label, R(r.amt)]));
    return rows;
  };
  const bsRows = () => {
    const R = (n) => Math.round(n * 100) / 100; const rows = [['الحساب', 'المبلغ']];
    bsRowsOf(bsY, bsOk).forEach(r => rows.push(r.t === 'head' || r.t === 'grp' ? [r.label, ''] : [(r.t === 'line' ? '    ' : '') + r.label, R(r.amt)]));
    return rows;
  };
  const dlBlob = (name, blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); };
  const exportExcel = () => {
    try {
      const blob = makeXlsx([
        { name: 'دليل الحسابات', rows: coaRows() },
        { name: 'اليومية', rows: journalRows() },
        { name: 'ميزان المراجعة', rows: tbRows() },
        { name: 'قائمة الدخل', rows: isRows() },
        { name: 'المركز المالي', rows: bsRows() }
      ]);
      dlBlob('حزمة_المحاسب_' + expTag + '.xlsx', blob);
    } catch (e) { say('تعذّر توليد ملف Excel — جرّب تصدير CSV', 'no'); }
  };
  const exportJournal = () => dlFile('يومية_' + expTag + '.csv', toCsv(journalRows()));
  const exportTB = () => dlFile('ميزان_المراجعة_' + expTag + '.csv', toCsv(tbRows()));
  const exportFS = () => dlFile('القوائم_المالية_' + expTag + '.csv', toCsv(fsRows()));
  // v15.4: تصدير كل تقرير في ملف Excel (.xlsx) مستقل — بدل الملف المجمّع
  const xlOne = (base, rows) => { try { dlBlob(base + '_' + expTag + '.xlsx', makeXlsx([{ name: base.replace(/_/g, ' ').slice(0, 28), rows }])); } catch (e) { say('تعذّر توليد Excel', 'no'); } };
  const xlCoa = () => xlOne('دليل_الحسابات', coaRows());
  const xlJournal = () => xlOne('دفتر_اليومية', journalRows());
  const xlTB = () => xlOne('ميزان_المراجعة', tbRows());
  const xlIS = () => xlOne('قائمة_الدخل', isRows());
  const xlBS = () => xlOne('المركز_المالي', bsRows());

  // ===== v11.4: محرك التوقّع النقدي — رصيد حالي + مبيعات متوقّعة + تحصيل ذمم التطبيقات − (موردون مستحقون + رواتب + مصروفات تشغيل) =====
  const fcastData = () => {
    const R = (n) => Math.round(n * 100) / 100;
    const cashNow = R(sum(A.accounts.filter(a => a.cash), a => a.balance));
    const appRecv = R(sum(A.accounts.filter(a => /^13/.test(a.code)), a => a.balance));   // ذمم التطبيقات — تُحصّل قريبًا
    const cc = (ops.closings || []).filter(countedClosing);
    const recent = [...new Set(cc.map(c => (c.date || '').slice(0, 7)))].sort().slice(-6);
    const nMo = Math.max(1, recent.length);
    const inRecent = (c) => recent.includes((c.date || '').slice(0, 7));
    const avgSales = Math.round(sum(cc.filter(inRecent), c => c.totalRevenue || 0) / nMo);
    const avgOpex = Math.round(sum(cc.filter(inRecent), c => sum(c.expenses || [], e => e.amount || 0)) / nMo);
    const gcfg = org.gosiCfg || {};
    const payroll = R(sum((org.employees || []).filter(e => e.isActive !== false), e => {
      const gross = (e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowance || 0);
      const grr = gosiRatesFor(e, gcfg); const gEr = (gcfg.enabled && e.gosiSubject) ? Math.round(grr.base * grr.er) / 100 : 0;
      return gross + gEr;
    }));
    const paidInCl = (id) => sum(cc.flatMap(c => (c.supplierPayments || []).filter(pm => pm.invoiceId === id)), pm => payTotal(pm));
    const outstanding = (ops.invoices || []).map(i => ({ due: ((i.dueDate || i.date || today()) + '').slice(0, 7), rem: Math.max(0, (i.amount || 0) - (i.paidAmount || 0) - paidInCl(i.id)) })).filter(x => x.rem > 0.004);
    const monthlySales = fcD.monthlySales !== '' ? (Number(fcD.monthlySales) || 0) : avgSales;
    const monthlyOpex = fcD.monthlyOpex !== '' ? (Number(fcD.monthlyOpex) || 0) : avgOpex;
    const buffer = fcD.buffer !== '' ? (Number(fcD.buffer) || 0) : 0;
    const horizon = Math.max(1, Math.min(12, Number(fcD.horizon) || 6));
    const ymAddL = (ym, k) => { const pr = ym.split('-').map(Number); const t = pr[0] * 12 + (pr[1] - 1) + k; return String(Math.floor(t / 12)).padStart(4, '0') + '-' + String((t % 12) + 1).padStart(2, '0'); };
    const curYm = today().slice(0, 7);
    let opening = cashNow; const rows = [];
    for (let k = 0; k < horizon; k++) {
      const ym = ymAddL(curYm, k);
      const recv = k === 0 ? appRecv : 0;
      const payDue = R(sum(outstanding.filter(o => k === 0 ? o.due <= ym : o.due === ym), o => o.rem));
      const inflow = R(monthlySales + recv);
      const outflow = R(payDue + payroll + monthlyOpex);
      const closing = R(opening + inflow - outflow);
      rows.push({ ym, opening: R(opening), sales: monthlySales, recv, payDue, payroll, opex: monthlyOpex, inflow, outflow, closing });
      opening = closing;
    }
    const minClosing = rows.length ? Math.min(...rows.map(r => r.closing)) : cashNow;
    const gap = rows.find(r => r.closing < buffer - 0.004);
    return { cashNow, appRecv, avgSales, avgOpex, payroll, monthlySales, monthlyOpex, buffer, horizon, rows, minClosing, gap };
  };
  const printForecast = () => {
    const f = fcastData();
    const rws = f.rows.map(r => `<tr><td>${r.ym}</td><td class="n">${money(r.opening)}</td><td class="n">${money(r.sales)}</td><td class="n">${r.recv ? money(r.recv) : '—'}</td><td class="n">${r.payDue ? money(r.payDue) : '—'}</td><td class="n">${money(r.payroll)}</td><td class="n">${money(r.opex)}</td><td class="n">${money(r.closing)}</td></tr>`).join('');
    printA4(org, 'التوقّع النقدي — ' + f.horizon + ' أشهر', 'من ' + arDate(today()) + ' · النقد الآن ' + money(f.cashNow),
      `<table><thead><tr><th>الشهر</th><th>أول المدة</th><th>مبيعات متوقّعة</th><th>تحصيل تطبيقات</th><th>موردون مستحقون</th><th>رواتب</th><th>مصروفات تشغيل</th><th>آخر المدة</th></tr></thead><tbody>${rws}
      <tr class="tot"><td colspan="7">أدنى رصيد متوقّع خلال المدة</td><td class="n">${money(f.minClosing)}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const exportPack = () => {
    const co = (org.company && org.company.name) || 'المنشأة';
    const all = [['حزمة المحاسب — ' + co], ['الفترة', expTag], [''], ['— دليل الحسابات —']]
      .concat(coaRows(), [[''], ['— دفتر اليومية —']], journalRows(), [[''], ['— ميزان المراجعة —']], tbRows(), [[''], ['— القوائم المالية —']], fsRows());
    dlFile('حزمة_المحاسب_' + expTag + '.csv', toCsv(all));
  };

  const periodBar = (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>من</span>
      <input type="date" className="inp" style={{ width: 150 }} value={from} onChange={e => setFrom(e.target.value)} />
      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>إلى</span>
      <input type="date" className="inp" style={{ width: 150 }} value={to} onChange={e => setTo(e.target.value)} />
      {view === 'tb' && (
        <select className="sel" style={{ width: 170 }} value={bf} onChange={e => setBf(e.target.value)}>
          <option value="">كل الفروع والمركز</option>
          <option value="central">القيود المركزية فقط</option>
          {(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {(() => { const n = new Date(); const ms = (y, m) => isoD(new Date(y, m, 1)), me2 = (y, m) => isoD(new Date(y, m + 1, 0));
        const P = [['هذا الشهر', ms(n.getFullYear(), n.getMonth()), me2(n.getFullYear(), n.getMonth())], ['الشهر السابق', ms(n.getFullYear(), n.getMonth() - 1), me2(n.getFullYear(), n.getMonth() - 1)], ['هذه السنة', n.getFullYear() + '-01-01', n.getFullYear() + '-12-31']];
        return P.map(([l, f2, t2]) => <button key={l} className={'btn sm' + (from === f2 && to === t2 ? ' pri' : ' gh')} onClick={() => { setFrom(f2); setTo(t2); }}>{l}</button>); })()}
      {(from || to || bf) && <button className="btn sm gh" onClick={() => { setFrom(''); setTo(''); setBf(''); }}>إظهار الكل</button>}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.4: اسم المحاسبة + قائمة تقاريره + إعداداته */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Scale size={17} /></span>المحاسبة<small>القيود · الحسابات · الميزان · القوائم · مراكز التكلفة · الأصول · التسوية · الإقفال</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => { setRepOpen(o => !o); setStgOpen(false); }}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير المحاسبة</div>
              {viewOK('jr') && <button onClick={() => { setRepOpen(false); printJR(); }}><Printer size={13} />دفتر اليومية</button>}
              {viewOK('tb') && <button onClick={() => { setRepOpen(false); printTB(); }}><Printer size={13} />ميزان المراجعة</button>}
              {viewOK('fs') && <button onClick={() => { setRepOpen(false); printFS(); }}><Printer size={13} />القوائم المالية</button>}
              {viewOK('cc') && <button onClick={() => { setRepOpen(false); printCC(); }}><Printer size={13} />مراكز التكلفة والربحية</button>}
              {viewOK('ast') && <button onClick={() => { setRepOpen(false); printAST(); }}><Printer size={13} />سجل الأصول والإهلاك</button>}
              {viewOK('vat') && <button onClick={() => { setRepOpen(false); printVAT(); }}><Printer size={13} />الإقرار الضريبي</button>}
            </div>
          </>)}
        </div>
        <div className="abar-dd">
          <button className="btn sm gh" onClick={() => { setStgOpen(o => !o); setRepOpen(false); }}><Settings size={14} />إعدادات<ChevronDown size={13} /></button>
          {stgOpen && (<>
            <div className="abar-back" onClick={() => setStgOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">إعدادات المحاسبة</div>
              {viewOK('vat') && <button onClick={() => { setStgOpen(false); setView('vat'); }}><Receipt size={13} />ضريبة القيمة المضافة</button>}
              {viewOK('cc') && <button onClick={() => { setStgOpen(false); setView('cc'); }}><BarChart3 size={13} />توزيع مراكز التكلفة</button>}
              {viewOK('lock') && <button onClick={() => { setStgOpen(false); setView('lock'); }}><Lock size={13} />الإقفال الشهري</button>}
              <button onClick={() => { setStgOpen(false); setView('ob'); }}><Landmark size={13} />الأرصدة الافتتاحية</button>
            </div>
          </>)}
        </div>
      </div>

      {(A.unknownCodes || []).length > 0 && (
        <div className="card" style={{ borderColor: 'var(--rose)', background: 'rgba(217,84,77,.08)' }}>
          <b style={{ color: 'var(--rose)' }}>⚠ قيود تشير لحسابات غير موجودة في الدليل:</b> {A.unknownCodes.join('، ')}
          <div style={{ fontSize: 12.5, marginTop: 4 }}>جُمعت مبالغها في «الحساب المعلّق 9999» حتى لا يختل ميزان المراجعة. صحّحها بقيد يدوي ينقلها للحساب الصحيح، أو أعِد إنشاء الحساب بالرمز نفسه.</div>
        </div>
      )}
      <div className="grid g4">
        <Kpi label="القيود المسجّلة" value={String(A.entries.length)} sub="تلقائية من عملياتك + يدوية المحاسب" icon={FileText} color="#4FB286" />
        <Kpi label={A.balanced ? 'كل القيود متوازنة ✓' : 'يوجد قيد غير متوازن!'} value={money(A.totalDebit)}
          sub="إجمالي المدين = إجمالي الدائن" icon={Scale} color={A.balanced ? '#C8A24A' : '#D9544D'} />
        <Kpi label="صافي نتيجة الفترة المعروضة" value={money(netP)} sub={netP >= 0 ? 'ربح' : 'خسارة'} icon={TrendingUp} color={netP >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="حسابات نشطة" value={String(A.accounts.filter(a => a.active).length) + ' / ' + A.accounts.length}
          sub="من دليل الحسابات" icon={Landmark} color="#5B93C4" />
      </div>

      {/* v28.8: أقسام المحاسبة في قوائم منسدلة مجمّعة بدل صف الأزرار الطويل — v28.9: + عرض شبكة اختياري. نفس الأقسام ونفس الصلاحيات (viewOK) */}
      {(() => {
        const go = (v) => { setAcctNavOpen(null); setAcctGridOpen(false); setView(v); if (v === 'apage') setApSel(null); if (v === 'arage') setArSel(null); };
        const IT = {
          jr: ['القيود اليومية', FileText], coa: ['دليل الحسابات', Landmark], tb: ['ميزان المراجعة', Scale], ob: ['الأرصدة الافتتاحية', Landmark],
          fs: ['القوائم المالية', FileBarChart], cf: ['التدفقات النقدية', ArrowLeftRight], fcast: ['التوقّع النقدي', TrendingUp], bud: ['الموازنة', BarChart3], anl: ['التحليل والنِسَب', TrendingUp], cc: ['مراكز التكلفة', BarChart3],
          food: ['تكلفة الطعام بالفروع', Store], apage: ['أعمار الموردين', Users], arage: ['أعمار العملاء', Users],
          vat: ['الضريبة (ق.م)', Receipt], einv: ['الفوترة (زاتكا)', QrCode], zakat: ['الزكاة وضريبة الدخل', Landmark],
          bank: ['التسوية البنكية', Landmark], ast: ['الأصول والإهلاك', Building2], astl: ['تسوية التطبيقات', Truck],
          mclose: ['حزمة الإقفال', ClipboardCheck], ctrl: ['الضوابط والتدقيق', ShieldCheck], lock: ['الإقفال الشهري', Lock], yend: ['إقفال السنة', CalendarDays],
          export: ['تصدير للمحاسب', Download], mizan: ['استيراد البيانات التاريخية', Upload]
        };
        const GROUPS = [
          { id: 'books', ar: 'الدفاتر', icon: FileText, items: ['jr', 'coa', 'tb', 'ob'] },
          { id: 'stmts', ar: 'القوائم والتحليل', icon: FileBarChart, items: ['fs', 'food', 'cf', 'fcast', 'bud', 'anl', 'cc'] },
          { id: 'ages', ar: 'الذمم والأعمار', icon: Users, items: ['apage', 'arage'] },
          { id: 'tax', ar: 'الضريبة والزكاة', icon: Receipt, items: ['vat', 'einv', 'zakat'] },
          { id: 'bank', ar: 'البنوك والأصول', icon: Building2, items: ['bank', 'ast', 'astl'] },
          { id: 'close', ar: 'الإقفال والرقابة', icon: Lock, items: ['mclose', 'ctrl', 'lock', 'yend'] },
          { id: 'tools', ar: 'أدوات', icon: Download, items: ['export', 'mizan'] }
        ];
        const ok = (v) => viewOK(v) && (v !== 'mizan' || canPost);
        const manualBtn = canPost && ACCT_SECTIONS.some(s => viewOK(s.v)) && <button className="btn sm" style={{ marginInlineStart: 'auto' }} onClick={newJm}><Plus size={14} />قيد يدوي / افتتاحي</button>;
        const modeSw = (
          <div className="acct-mode" role="group" aria-label="طريقة عرض الأقسام">
            <button className={acctNavMode === 'dd' ? 'on' : ''} onClick={() => switchAcctNav('dd')} title="قوائم منسدلة"><ChevronDown size={14} /><span>قوائم</span></button>
            <button className={acctNavMode === 'grid' ? 'on' : ''} onClick={() => switchAcctNav('grid')} title="شبكة"><Grid3x3 size={14} /><span>شبكة</span></button>
          </div>
        );
        if (acctNavMode === 'grid') {
          const cur = IT[view];
          const CurI = cur ? cur[1] : FileText;
          return (
            <div className="acct-gridnav">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {acctGridOpen
                  ? <div className="acct-gtitle"><Grid3x3 size={15} />أقسام المحاسبة</div>
                  : <button className="btn sm pri" onClick={() => setAcctGridOpen(true)}><Grid3x3 size={14} />كل الأقسام</button>}
                {!acctGridOpen && cur && <div className="acct-gcur"><CurI size={14} />{cur[0]}</div>}
                {acctGridOpen && cur && <button className="btn sm gh" onClick={() => setAcctGridOpen(false)}>إخفاء الشبكة<ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /></button>}
                {modeSw}
                {manualBtn}
              </div>
              {acctGridOpen && GROUPS.map(g => {
                const its = g.items.filter(ok);
                if (!its.length) return null;
                return (
                  <div className="acct-gsec" key={g.id}>
                    <div className="acct-ghd"><g.icon size={13} />{g.ar}</div>
                    <div className="acct-grid">
                      {its.map(v => { const [n, I] = IT[v]; return (
                        <button key={v} className={'acct-tile' + (view === v ? ' on' : '')} onClick={() => go(v)}><I size={20} /><span>{n}</span></button>
                      ); })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <div className="row acct-nav" style={{ gap: 8, flexWrap: 'wrap' }}>
            {GROUPS.map(g => {
              const its = g.items.filter(ok);
              if (!its.length) return null;
              const act = its.includes(view);
              const Ic = act ? IT[view][1] : g.icon;
              return (
                <div className="abar-dd" key={g.id}>
                  <button className={'btn sm' + (act ? ' pri' : ' gh')} onClick={() => { setAcctNavOpen(o => o === g.id ? null : g.id); setRepOpen(false); setStgOpen(false); }}>
                    <Ic size={14} />{act ? g.ar + ': ' + IT[view][0] : g.ar}<ChevronDown size={13} />
                  </button>
                  {acctNavOpen === g.id && (<>
                    <div className="abar-back" onClick={() => setAcctNavOpen(null)} />
                    <div className="abar-menu">
                      <div className="abar-hd">{g.ar}</div>
                      {its.map(v => { const [n, I] = IT[v]; return (
                        <button key={v} onClick={() => go(v)} style={view === v ? { background: 'var(--acc-soft)', fontWeight: 700 } : undefined}><I size={13} />{n}{view === v && <Check size={13} style={{ marginInlineStart: 'auto' }} />}</button>
                      ); })}
                    </div>
                  </>)}
                </div>
              );
            })}
            {modeSw}
            {manualBtn}
          </div>
        );
      })()}

      {/* v15.11: لا قسم متاح (أُخفيت كل الأقسام لهذا المستخدم) — رسالة بدل تسريب اليومية */}
      {!ACCT_SECTIONS.some(s => viewOK(s.v)) && (
        <div className="card"><div className="empty">لا توجد أقسام محاسبة متاحة لحسابك حاليًا — تواصل مع مدير النظام لتخصيص الأقسام من «ظهور التطبيقات للمستخدمين».</div></div>
      )}

      {view === 'jr' && viewOK('jr') && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><FileText size={15} color="var(--brass)" />القيود اليومية — اضغط أي قيد لتفاصيله</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={printJR}><Printer size={13} />طباعة دفتر اليومية</button>
              <input className="inp" style={{ width: 190 }} placeholder="بحث في القيود…" value={q} onChange={e => setQ(e.target.value)} />
              <input type="month" className="inp" style={{ width: 150 }} value={month} onChange={e => setMonth(e.target.value)} />
              {month && <button className="btn sm gh" onClick={() => setMonth('')}>كل الشهور</button>}
            </div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>رقم</th><th>التاريخ</th><th>البيان</th><th>المصدر</th><th style={{ textAlign: 'end' }}>المبلغ</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <React.Fragment key={e.id}>
                    <tr onClick={() => setOpen(o => ({ ...o, [e.id]: !o[e.id] }))} style={{ cursor: 'pointer' }}>
                      <td className="num" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{e.no}</td>
                      <td className="num" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.date}{periodLocked(org, e.date) ? ' 🔒' : ''}</td>
                      <td style={{ fontSize: 12.5 }}>{e.title}
                        {!e.balanced && <span className="badge b-rose" style={{ marginInlineStart: 6 }}>غير متوازن!</span>}</td>
                      <td><span className={'badge ' + srcBadge(e.src)} style={{ fontSize: 9.5 }}>{e.manual ? '' : 'تلقائي · '}{e.src}</span></td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 600 }}>{money(e.debit)}</td>
                    </tr>
                    {open[e.id] && (
                      <tr><td colSpan={5} style={{ padding: 0 }}>
                        <div style={{ background: 'var(--ink)', border: '1px solid var(--line-g)', borderRadius: 10, margin: '4px 2px 10px', padding: 12 }}>
                          <table className="tb" style={{ fontSize: 12 }}>
                            <thead><tr><th>الحساب</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th></tr></thead>
                            <tbody>
                              {e.lines.map((l, i) => (
                                <tr key={i}>
                                  <td>{codeChip(l.code)} <span style={{ marginInlineStart: 4 }}>{l.name}</span></td>
                                  <td className="num" style={{ textAlign: 'end' }}>{l.debit ? money(l.debit) : '—'}</td>
                                  <td className="num" style={{ textAlign: 'end' }}>{l.credit ? money(l.credit) : '—'}</td>
                                </tr>
                              ))}
                              <tr style={{ fontWeight: 700 }}>
                                <td>الإجمالي {e.balanced ? '— متوازن ✓' : ''}</td>
                                <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(e.debit)}</td>
                                <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(e.credit)}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>
                            {e.manual
                              ? <>قيد {e.src === 'قيد افتتاحي' ? 'افتتاحي' : 'يدوي'} أدخله: {e.ref || '—'} — التصحيح يكون بقيد عكسي، لا حذف حفاظًا على سلامة السجل.</>
                              : <>المصدر: {e.src} · المرجع: <span className="num">{e.ref}</span> — لم يُدخل هذا القيد يدويًا؛ تصحيح المصدر ينعكس هنا تلقائيًا.
                                {(() => { const SRC_TAB = { 'إغلاق وردية': 'closing', 'مصروف وردية': 'closing', 'سداد مورد بالوردية': 'closing', 'تحويل خزينة': 'treasury', 'الخزينة الرئيسية': 'treasury', 'فاتورة مورد': 'suppliers', 'سداد مركزي': 'suppliers', 'كشف الرواتب': 'payroll', 'الرواتب والسلف': 'payroll' };
                                  const t = SRC_TAB[e.src];
                                  return t && setTab && (ROLES[me?.role]?.tabs || []).includes(t)
                                    ? <button className="btn sm gh" style={{ marginInlineStart: 8, padding: '3px 9px', fontSize: 10.5 }} onClick={() => setTab(t)}>↗ فتح المصدر</button>
                                    : null; })()}</>}
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
                {entries.length === 0 && <tr><td colSpan={5}><div className="empty">لا قيود مطابقة — القيود تتولّد تلقائيًا من الإغلاقات المعتمدة والسدادات والرواتب والتحويلات.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'export' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {periodBar}
            <select className="sel" style={{ width: 200 }} value={bf} onChange={e => setBf(e.target.value)}>
              <option value="">كل الفروع والمركز</option>
              <option value="central">القيود المركزية فقط</option>
              {(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brass-l)', marginTop: 2 }}>كل تقرير في ملف Excel (.xlsx) مستقل — لكل عنصر ملفّه وحده</div>
          <div className="grid g2">
            <div className="card">
              <div className="card-t" style={{ marginBottom: 6 }}><Landmark size={15} color="var(--brass)" />دليل الحسابات</div>
              <div className="note" style={{ marginBottom: 10 }}>كل حساب برمزه واسمه ونوعه (أصول/خصوم/حقوق ملكية/إيرادات/مصروفات) — بما فيها حساباتك المخصّصة.</div>
              <button className="btn pri" onClick={xlCoa}><Download size={14} />تصدير دليل الحسابات (Excel)</button>
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />دفتر اليومية</div>
              <div className="note" style={{ marginBottom: 10 }}>كل القيود سطرًا سطرًا (رقم القيد، التاريخ، البيان، رمز الحساب واسمه، مدين، دائن) للفترة والفرع المحددين.</div>
              <button className="btn pri" onClick={xlJournal}><Download size={14} />تصدير اليومية (Excel)</button>
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 6 }}><Scale size={15} color="var(--brass)" />ميزان المراجعة</div>
              <div className="note" style={{ marginBottom: 10 }}>كل حساب برمزه ونوعه ومجموع مدينه ودائنه ورصيده — جاهز للمراجعة.</div>
              <button className="btn pri" onClick={xlTB}><Download size={14} />تصدير الميزان (Excel)</button>
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 6 }}><FileBarChart size={15} color="var(--brass)" />قائمة الدخل</div>
              <div className="note" style={{ marginBottom: 10 }}>الإيرادات والمصروفات وصافي الربح/الخسارة بأرقام الفترة المحددة.</div>
              <button className="btn pri" onClick={xlIS}><Download size={14} />تصدير قائمة الدخل (Excel)</button>
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 6 }}><Landmark size={15} color="var(--brass)" />قائمة المركز المالي</div>
              <div className="note" style={{ marginBottom: 10 }}>الأصول والخصوم وحقوق الملكية وأرباح الفترة — الميزانية العمومية للفترة المحددة.</div>
              <button className="btn pri" onClick={xlBS}><Download size={14} />تصدير المركز المالي (Excel)</button>
            </div>
            <div className="card" style={{ borderColor: 'var(--frame)' }}>
              <div className="card-t" style={{ marginBottom: 6 }}><Download size={15} color="var(--brass)" />أو ملف واحد بكل الأوراق</div>
              <div className="note" style={{ marginBottom: 10 }}>إذا فضّلت ملفًا واحدًا: كتاب Excel بخمس أوراق (دليل الحسابات · اليومية · الميزان · قائمة الدخل · المركز المالي).</div>
              <button className="btn" onClick={exportExcel}><Download size={14} />الكل في ملف واحد (Excel)</button>
            </div>
          </div>
          <div className="note">ملفات <b>.xlsx</b> حقيقية مبنيّة داخل متصفحك بلا أي خدمة خارجية، تفتح مباشرةً في Excel وGoogle Sheets بالعربية من اليمين لليسار، والأرقام أرقامٌ قابلة للحساب والعناوين عريضة. كل ملف يحمل اسم الفترة ويحترم فلتر الفترة (من/إلى) والفرع المحدد أعلاه.
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>تحتاج CSV لنظام محاسبي قديم؟</span>
              <button className="btn sm gh" onClick={exportJournal}>اليومية CSV</button>
              <button className="btn sm gh" onClick={exportTB}>الميزان CSV</button>
              <button className="btn sm gh" onClick={exportFS}>القوائم CSV</button>
              <button className="btn sm gh" onClick={exportPack}>الحزمة الكاملة CSV</button>
            </div>
          </div>
        </div>
      )}

      {view === 'coa' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Landmark size={15} color="var(--brass)" />دليل الحسابات — أرصدة حيّة</div>
            {canPost && <button className="btn pri" onClick={() => setCoaF({ code: '', name: '', kind: 'exp', origCode: '' })}><Plus size={15} />إضافة حساب جديد</button>}
          </div>
          {canPost && !coaF && (
            <div className="note" style={{ background: 'rgba(200,162,74,.07)', border: '1px solid var(--brass-d)', borderRadius: 10, padding: '9px 12px', marginBottom: 10 }}>
              💡 <b>تقدر تضيف حساباتك الخاصة:</b> اضغط «<b>إضافة حساب جديد</b>» بالأعلى. وأي حساب تضيفه يظهر موسومًا بـ«<b>مخصّص</b>» ويظهر تحته زرّا «<b>تعديل</b>» و«<b>حذف</b>». الحسابات النظامية محميّة (لا تُعدَّل ولا تُحذف) لأنها مرتبطة بالترحيل التلقائي. {(A.accounts.filter(a => a.custom).length > 0) && <span>— لديك حاليًا <b>{A.accounts.filter(a => a.custom).length}</b> حساب مخصّص.</span>}
            </div>
          )}
          {coaF && (
            <div className="card" style={{ background: 'var(--ink3)', border: '1px dashed var(--brass-d)', marginBottom: 10 }}>
              <div className="grid g4" style={{ gap: 9, alignItems: 'end' }}>
                <Field label="الرمز"><input className="inp n" value={coaF.code} onChange={e => setCoaF(s => ({ ...s, code: e.target.value.replace(/[^0-9A-Za-z\-]/g, '') }))} placeholder="مثال 5205" /></Field>
                <Field label="اسم الحساب" style={{ gridColumn: 'span 2' }}><input className="inp" value={coaF.name} onChange={e => setCoaF(s => ({ ...s, name: e.target.value }))} placeholder="اسم الحساب" /></Field>
                <Field label="النوع"><select className="inp sel" value={coaF.kind} onChange={e => setCoaF(s => ({ ...s, kind: e.target.value }))}>{Object.keys(ACC_KIND).map(k => <option key={k} value={k}>{ACC_KIND[k].ar}</option>)}</select></Field>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn pri" onClick={saveAcct}><Check size={14} />{coaF.origCode ? 'حفظ التعديل' : 'إضافة الحساب'}</button>
                <button className="btn gh" onClick={() => setCoaF(null)}>إلغاء</button>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>الحساب المخصّص يظهر في الدليل وميزان المراجعة، ويُستخدم في القيود اليدوية. الحسابات النظامية لا تُعدَّل ولا تُحذف.</div>
            </div>
          )}
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الرمز</th><th>الحساب</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th><th style={{ textAlign: 'end' }}>الرصيد</th></tr></thead>
              <tbody>
                {kinds.map(k => (
                  <React.Fragment key={k}>
                    <tr><td colSpan={5} style={{ background: 'var(--acc-soft)', fontWeight: 800, color: 'var(--brass-l)', fontSize: 12.5 }}>
                      {ACC_KIND[k].ar} <span style={{ color: 'var(--faint)', fontWeight: 500, fontSize: 10.5 }}>· طبيعته {ACC_KIND[k].nature}</span></td></tr>
                    {A.accounts.filter(a => a.kind === k).map(a => (
                      <tr key={a.code} style={{ opacity: a.active ? 1 : .55 }}>
                        <td>{codeChip(a.code)}</td>
                        <td style={{ fontSize: 12.5 }}>{a.name}
                          {a.custom && <span className="badge b-brass" style={{ fontSize: 8.5, marginInlineStart: 6, padding: '1px 6px' }}>مخصّص</span>}
                          {a.link && <div style={{ fontSize: 9.5, color: 'var(--sky)' }}>مرتبط: {a.link}</div>}
                          {a.custom && canEdit && <div className="row" style={{ gap: 7, marginTop: 5 }}>
                            <button className="btn sm" style={{ padding: '4px 12px', fontSize: 11.5 }} onClick={() => setCoaF({ code: a.code, name: a.name, kind: a.kind, origCode: a.code })}>✏️ تعديل</button>
                            <button className="btn sm gh" style={{ padding: '4px 12px', fontSize: 11.5, color: 'var(--rose)' }} onClick={() => delAcct(a)}><Trash2 size={12} />حذف</button>
                          </div>}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{a.debit ? money(a.debit) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{a.credit ? money(a.credit) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: a.balance < 0 ? 'var(--rose)' : 'var(--txt)' }}>{fmtBal(a.balance)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td colSpan={2}>الإجمالي {A.balanced ? '— متوازن ✓' : '— غير متوازن!'}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(A.totalDebit)}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(A.totalCredit)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'tb' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Scale size={15} color="var(--brass)" />ميزان المراجعة</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{periodBar}<button className="btn sm" onClick={printTB}><Printer size={13} />طباعة</button></div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الرمز</th><th>الحساب</th>{from && <th style={{ textAlign: 'end' }}>رصيد أول المدة</th>}<th style={{ textAlign: 'end' }}>مدين الفترة</th><th style={{ textAlign: 'end' }}>دائن الفترة</th><th style={{ textAlign: 'end' }}>{from ? 'رصيد آخر المدة' : 'الرصيد'}</th></tr></thead>
              <tbody>
                {A.accounts.filter(tbShow).map(a => {
                  const x = tbMov(a); const op = tbOpen(a); const b = tbClose(a); const isV = TB_VAT.includes(a.code);
                  return (
                    <tr key={a.code} className={isV ? 'tb-vat' : undefined}>
                      <td>{codeChip(a.code)}</td>
                      <td style={{ fontSize: 12.5 }}>{a.name}{isV && <span className="badge b-brass" style={{ marginInlineStart: 6, fontSize: 10 }}>ضريبة</span>}</td>
                      {from && <td className="num" style={{ textAlign: 'end', color: op < 0 ? 'var(--rose)' : 'var(--dim)' }}>{op ? fmtBal(op) : '—'}</td>}
                      <td className="num" style={{ textAlign: 'end' }}>{x.debit ? money(x.debit) : '—'}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{x.credit ? money(x.credit) : '—'}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b < 0 ? 'var(--rose)' : 'var(--txt)' }}>{fmtBal(b)}</td>
                    </tr>
                  );
                })}
                {tbEntries.length === 0 && <tr><td colSpan={5}><div className="empty">لا حركة في هذه الفترة/الفرع.</div></td></tr>}
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td colSpan={from ? 3 : 2}>إجمالي الفترة {Math.abs(tbD - tbC) < 0.01 ? '— متوازن ✓' : '— غير متوازن!'}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(tbD)}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(tbC)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>كل قيد وحدة كاملة لا تتجزأ — لذلك يبقى الميزان متوازنًا مع أي تصفية بالفترة أو الفرع. القيود المركزية (رواتب، خزينة، فواتير المركز) تظهر ضمن خيار «القيود المركزية».</div>
        </div>
      )}

      {view === 'tb' && vatRec && (
        <div className={'card vrec' + (vatRec.ok ? '' : ' bad')}>
          <div className="card-h">
            <div className="card-t"><Receipt size={15} color="var(--brass)" />مطابقة حسابات الضريبة مع الإقرار {from || to ? <span className="badge b-dim">من <span className="num">{from || 'البداية'}</span> إلى <span className="num">{to || today()}</span></span> : <span className="badge b-dim">كامل المدة</span>}</div>
            <span className={'badge ' + (vatRec.ok ? 'b-mint' : 'b-rose')}>{vatRec.ok ? 'مطابق ✓' : 'يوجد فرق'}</span>
          </div>
          <div className="tw">
            <table className="tb is-tb">
              <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>ميزان المراجعة</th><th style={{ textAlign: 'end' }}>الإقرار</th><th style={{ textAlign: 'end' }}>الفرق</th></tr></thead>
              <tbody>
                <tr className={'is-line' + (Math.abs(vatRec.dOut) >= 0.01 ? ' bad' : '')}><td>ضريبة المخرجات — حركة 2301 (دائن {money(vatRec.o.c)} − مدين {money(vatRec.o.d)})</td><td className="is-amt"><span className="num">{money(vatRec.tbOut)}</span></td><td className="is-amt"><span className="num">{money(vsum.out)}</span></td><td className={'is-amt' + (Math.abs(vatRec.dOut) >= 0.01 ? ' neg' : '')}><span className="num">{Math.abs(vatRec.dOut) < 0.01 ? '✓ 0.00' : fmtBal(vatRec.dOut)}</span></td></tr>
                <tr className={'is-line' + (Math.abs(vatRec.dIn) >= 0.01 ? ' bad' : '')}><td>ضريبة المدخلات — حركة 1501 (مدين {money(vatRec.i.d)} − دائن {money(vatRec.i.c)})</td><td className="is-amt"><span className="num">{money(vatRec.tbIn)}</span></td><td className="is-amt"><span className="num">{money(vsum.inn)}</span></td><td className={'is-amt' + (Math.abs(vatRec.dIn) >= 0.01 ? ' neg' : '')}><span className="num">{Math.abs(vatRec.dIn) < 0.01 ? '✓ 0.00' : fmtBal(vatRec.dIn)}</span></td></tr>
                <tr className="is-total"><td>صافي الضريبة للفترة</td><td className="is-amt"><span className="num">{fmtBal(r2x(vatRec.tbOut - vatRec.tbIn))}</span></td><td className="is-amt"><span className="num">{fmtBal(vatDue)}</span></td><td className={'is-amt' + (vatRec.ok ? '' : ' neg')}><span className="num">{fmtBal(r2x(vatRec.dOut - vatRec.dIn))}</span></td></tr>
                <tr className={'is-line' + (Math.abs(vatRec.dBase) >= 1 ? ' warnr' : '')}><td>فحص الوعاء: إيراد المبيعات 4101+4102 ({money(vatRec.revNet)}) × {taxRate}%</td><td className="is-amt"><span className="num">{money(vatRec.expOut)}</span></td><td className="is-amt"><span className="num">{money(vsum.out)}</span></td><td className={'is-amt' + (Math.abs(vatRec.dBase) >= 1 ? ' neg' : '')}><span className="num">{Math.abs(vatRec.dBase) < 1 ? '✓' : fmtBal(vatRec.dBase)}</span></td></tr>
                {(vatRec.closeCr > 0 || vatRec.payDr > 0) && <tr className="is-line"><td>الحساب الوسيط 2302 في الفترة: إقفالات (دائن) / سداد (مدين)</td><td className="is-amt"><span className="num">{money(vatRec.closeCr)}</span></td><td className="is-amt"><span className="num">{money(vatRec.payDr)}</span></td><td className="is-amt"><span className="num">{fmtBal(r2x(vatRec.closeCr - vatRec.payDr))}</span></td></tr>}
              </tbody>
            </table>
          </div>
          {vatRec.causes.length > 0 && (<>
            <div className="vrec-h">✗ القيود المسببة لفرق الحسابين ({vatRec.causes.length})</div>
            <div className="tw"><table className="tb is-tb">
              <thead><tr><th>التاريخ</th><th>القيد</th><th>المصدر</th><th style={{ textAlign: 'end' }}>أثر على 2301</th><th style={{ textAlign: 'end' }}>أثر على 1501</th><th>السبب</th></tr></thead>
              <tbody>{vatRec.causes.map((c, i) => <tr key={i} className="is-line bad"><td><span className="num">{c.date}</span></td><td>{c.title}</td><td>{c.src}</td><td className="is-amt"><span className="num">{c.out ? fmtBal(c.out) : '—'}</span></td><td className="is-amt"><span className="num">{c.inn ? fmtBal(c.inn) : '—'}</span></td><td style={{ fontSize: 12 }}>{c.why}</td></tr>)}</tbody>
            </table></div>
            <div className="note" style={{ marginTop: 8 }}>التصحيح: قيد يدوي ينقل المبلغ إلى الحساب الصحيح (سداد الهيئة ← 2302، مصروف بلا ضريبة ← حساب المصروف). لا تُحذف القيود الأصلية.</div>
          </>)}
          {vatRec.untaxed.length > 0 && Math.abs(vatRec.dBase) >= 1 && (<>
            <div className="vrec-h warn">! إيرادات مبيعات سُجّلت بلا ضريبة مخرجات ({vatRec.untaxed.length}) — تفسّر فرق الوعاء</div>
            <div className="tw"><table className="tb is-tb">
              <thead><tr><th>التاريخ</th><th>القيد</th><th>المصدر</th><th style={{ textAlign: 'end' }}>الإيراد</th><th style={{ textAlign: 'end' }}>الضريبة المفترضة</th></tr></thead>
              <tbody>{vatRec.untaxed.slice(0, 50).map((c, i) => <tr key={i} className="is-line"><td><span className="num">{c.date}</span></td><td>{c.title}</td><td>{c.src}</td><td className="is-amt"><span className="num">{money(c.amt)}</span></td><td className="is-amt"><span className="num">{money(r2x(c.amt * taxRate / 100))}</span></td></tr>)}</tbody>
            </table></div>
          </>)}
          {vatRec.ok && !vatRec.causes.length && <div className="vck-i ok" style={{ marginTop: 10 }}><span>✓</span>كل قيد على 2301 و1501 في الفترة له أثر ضريبي مطابق في الإقرار — لا خلل.</div>}
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>المطابقة موحّدة لكل الفروع (الإقرار على مستوى المنشأة)، وتستبعد قيود إقفال الفترة الضريبية وسدادها لأنها تسوية لا حركة.</div>
        </div>
      )}

      {view === 'fs' && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-h">
              <div className="card-t"><TrendingUp size={15} color="var(--mint)" />قائمة الدخل {bfLabel ? '— ' + bfLabel : '(موحدة)'} {from || to ? '· الفترة المحددة' : ''}</div>
              <button className="btn sm" onClick={printFS}><Printer size={13} />طباعة القوائم A4</button>
            </div>
            {periodBar}
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <select className="sel" style={{ width: 200 }} value={bf} onChange={e => setBf(e.target.value)}>
                <option value="">قائمة دخل موحدة (كل الفروع)</option>
                <option value="central">القيود المركزية فقط</option>
                {(org.branches || []).map(b => <option key={b.id} value={b.id}>دخل {b.name}</option>)}
              </select>
              {bf && <span className="badge b-brass">عرض دخل: {bfLabel}</span>}
            </div>
            <div className="is-kpis">
              <div><span>صافي المبيعات</span><b className="num">{money(isY.netSales)}</b></div>
              <div><span>مجمل الربح</span><b className={'num' + (isY.gross < 0 ? ' neg' : '')}>{fmtBal(isY.gross)}</b><small>{isY.netSales ? (Math.round(isY.gross / isY.netSales * 1000) / 10) + '%' : '—'}</small></div>
              <div><span>{isY.net >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</span><b className={'num' + (isY.net < 0 ? ' neg' : '')}>{fmtBal(isY.net)}</b><small>{isY.netSales ? 'هامش ' + (Math.round(isY.net / isY.netSales * 1000) / 10) + '%' : '—'}</small></div>
            </div>
            {isPmap ? <div className="note" style={{ marginTop: 8 }}>المقارنة مع الفترة السابقة: <b className="num">{prevRange.f}</b> ← <b className="num">{prevRange.t}</b>. السهم الأخضر يعني أثرًا أفضل على الربح (إيراد أعلى أو مصروف أقل).</div>
              : <div className="note" style={{ marginTop: 8 }}>اختر فترة (أو «هذا الشهر») لتظهر المقارنة مع الفترة السابقة.</div>}
            {isY.netSales > 0 && !isY.cogs.length && <div className="note" style={{ marginTop: 8 }}>⚠ لا توجد تكلفة مواد مسجّلة في الفترة — مجمل الربح يساوي المبيعات. سجّل مشتريات المواد أو صرف المستودعات لتظهر تكلفة الطعام الحقيقية.</div>}
            <div className="tw" style={{ marginTop: 10 }}>
              <table className="tb is-tb">
                <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>المبلغ (ر.س)</th><th className="c-pct" style={{ textAlign: 'end' }}>% من المبيعات</th>
                  {isPmap && <><th style={{ textAlign: 'end' }}>الفترة السابقة</th><th style={{ textAlign: 'end' }}>التغيّر</th></>}</tr></thead>
                <tbody>
                  {isRowsOf(isY).map((r, i) => r.t === 'head'
                    ? <tr key={i} className="is-head"><td colSpan={isPmap ? 5 : 3}>{r.label}</td></tr>
                    : <tr key={i} className={'is-' + r.t}>
                      <td style={r.ind ? { paddingInlineStart: 26 } : undefined}>{r.label}</td>
                      <td className={'is-amt' + (r.amt < 0 ? ' neg' : '')}><span className="num">{fmtBal(r.amt)}</span></td>
                      <td className="is-pct"><span className="num">{isY.netSales && r.t !== 'line' ? (() => { const v = Math.round(r.amt / isY.netSales * 1000) / 10; return v < 0 ? '(' + (-v).toFixed(1) + '%)' : v.toFixed(1) + '%'; })() : ''}</span></td>
                      {isPmap && (() => { const pv = isPmap[r.k] || 0; const d = Math.round((r.amt - pv) * 100) / 100;
                        const pc = Math.abs(pv) > 0.004 ? Math.round(d / Math.abs(pv) * 1000) / 10 : null;
                        return <><td className={'is-amt is-prev' + (pv < 0 ? ' neg' : '')}><span className="num">{fmtBal(pv)}</span></td>
                          <td className={'is-pct is-chg' + (Math.abs(d) < 0.005 ? '' : d > 0 ? ' up' : ' dn')}><span className="num">{Math.abs(d) < 0.005 ? '—' : (d > 0 ? '▲ ' : '▼ ') + (pc == null ? 'جديد' : Math.abs(pc).toFixed(1) + '%')}</span></td></>; })()}
                    </tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>{taxOn ? 'الإيرادات والمصروفات صافية — الضريبة مفصولة في حسابَي المدخلات (1501) والمخرجات (2301).' : 'الأرقام إجمالية شاملة الضريبة — فعّل الاحتساب من شاشة الضريبة لفصلها.'}</div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><Landmark size={15} color="var(--brass)" />قائمة المركز المالي {to ? 'حتى ' + to : '(حتى اليوم)'}</div>
            <div className="is-kpis">
              <div><span>إجمالي الأصول</span><b className="num">{money(bsY.assets)}</b></div>
              <div><span>رأس المال العامل</span><b className={'num' + (bsY.wc < 0 ? ' neg' : '')}>{fmtBal(bsY.wc)}</b><small>المتداولة − الخصوم المتداولة</small></div>
              <div><span>نسبة التداول</span><b className="num">{bsY.cr == null ? '—' : bsY.cr.toFixed(2) + '×'}</b><small>{bsY.cr == null ? 'لا خصوم متداولة' : bsY.cr >= 1 ? 'تغطي الالتزامات القصيرة' : 'أقل من 1 — راقب السيولة'}</small></div>
            </div>
            <div className="tw" style={{ marginTop: 10 }}>
              <table className="tb is-tb">
                <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>المبلغ (ر.س)</th></tr></thead>
                <tbody>
                  {bsRowsOf(bsY, bsOk).map((r, i) => r.t === 'head'
                    ? <tr key={i} className="is-head"><td colSpan={2}>{r.label}</td></tr>
                    : r.t === 'grp' ? <tr key={i} className="is-grp"><td colSpan={2}>{r.label}</td></tr>
                      : <tr key={i} className={'is-' + r.t + (r.t === 'net' && !bsOk ? ' bad' : '')}>
                        <td>{r.label}</td>
                        <td className={'is-amt' + (r.amt < 0 ? ' neg' : '')}><span className="num">{fmtBal(r.amt)}</span></td>
                      </tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>الأرصدة الافتتاحية (نقدية، بنك، ذمم، موردون…) تُدخل من تبويب «الأرصدة الافتتاحية» ورأس المال يُحسب تلقائيًا.</div>
          </div>
        </div>
      )}

      {view === 'cf' && (() => {
        const Section = (cls, title, sub) => (
          <React.Fragment>
            <tr className="is-head"><td colSpan={2}>{title}</td></tr>
            {cfRows(cls).map(r => (
              <tr key={cls + r.label} className="is-line"><td>{r.label}</td>
                <td className={'is-amt' + (r.amt < 0 ? ' neg' : '')}><span className="num">{fmtBal(r.amt)}</span></td></tr>
            ))}
            {cfRows(cls).length === 0 && <tr className="is-line"><td style={{ color: 'var(--faint)' }}>لا حركة في الفترة</td><td className="is-amt"><span className="num" style={{ color: 'var(--faint)' }}>0.00</span></td></tr>}
            <tr className="is-sub"><td>{sub}</td>
              <td className={'is-amt' + (cfNet(cls) < 0 ? ' neg' : '')}><span className="num">{fmtBal(cfNet(cls))}</span></td></tr>
          </React.Fragment>
        );
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {periodBar}
              <div className="row" style={{ gap: 8 }}>
                <select className="sel" style={{ width: 190 }} value={bf} onChange={e => setBf(e.target.value)}>
                  <option value="">تدفقات موحدة (كل الفروع)</option>
                  <option value="central">القيود المركزية فقط</option>
                  {(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="btn sm" onClick={printCF}><Printer size={13} />طباعة A4</button>
              </div>
            </div>
            <div className="grid g3">
              <Kpi label="صافي التدفق التشغيلي" value={money(cfOp)} sub="من نشاطك اليومي" icon={RefreshCw} color={cfOp >= 0 ? '#4FB286' : '#D9544D'} />
              <Kpi label="صافي التدفق الاستثماري" value={money(cfInv)} sub="شراء/بيع الأصول" icon={Building2} color={cfInv >= 0 ? '#4FB286' : '#E0A458'} />
              <Kpi label="صافي التدفق التمويلي" value={money(cfFin)} sub="رأس المال والمسحوبات" icon={Landmark} color={cfFin >= 0 ? '#4FB286' : '#E0A458'} />
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><ArrowLeftRight size={15} color="var(--brass)" />قائمة التدفقات النقدية {from || to ? '· الفترة المحددة' : '(حتى اليوم)'} {bfLabel ? '— ' + bfLabel : ''}</div>
              <div className="tw">
                <table className="tb is-tb">
                  <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>المبلغ (ر.س)</th></tr></thead>
                  <tbody>
                    <tr className="is-total"><td>النقد في بداية الفترة</td><td className="is-amt"><span className="num">{money(cfBegin)}</span></td></tr>
                    {Section('op', 'الأنشطة التشغيلية', 'صافي النقد من الأنشطة التشغيلية')}
                    {Section('inv', 'الأنشطة الاستثمارية', 'صافي النقد من الأنشطة الاستثمارية')}
                    {Section('fin', 'الأنشطة التمويلية', 'صافي النقد من الأنشطة التمويلية')}
                    <tr className="is-total"><td>صافي التغيّر في النقد</td>
                      <td className={'is-amt' + (cfChange < 0 ? ' neg' : '')}><span className="num">{fmtBal(cfChange)}</span></td></tr>
                    <tr className="is-net"><td>النقد في نهاية الفترة</td><td className="is-amt"><span className="num">{money(cfEndComputed)}</span></td></tr>
                    <tr className={'is-sub' + (cfOk ? '' : ' bad')}>
                      <td>مطابقة رصيد النقد الدفتري {cfOk ? '— مطابق ✓' : '— لا يطابق!'}</td>
                      <td className={'is-amt' + (cfOk ? '' : ' neg')}><span className="num">{money(cfEndBook)}</span></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                «النقد وما في حكمه» = الخزائن + البنك. بالطريقة المباشرة تُصنَّف كل حركة نقدية: <b>تشغيلية</b> (مبيعات، مصروفات، موردون، رواتب)،
                <b> استثمارية</b> (شراء/بيع الأصول الثابتة)، أو <b>تمويلية</b> (رأس المال، المسحوبات). التحويلات بين خزائنك لا تظهر لأنها لا تُغيّر إجمالي النقد،
                وقيد إقفال السنة لا يمسّ النقد. صافي التغيّر يطابق حركة رصيد النقد الفعلية دائمًا.
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'fcast' && (() => {
        const f = fcastData();
        const maxAbs = Math.max(1, ...f.rows.map(r => Math.abs(r.closing)));
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-h"><div className="card-t"><TrendingUp size={15} color="var(--brass)" />افتراضات التوقّع</div>
                <button className="btn sm" onClick={printForecast}><Printer size={13} />طباعة A4</button></div>
              <div className="note" style={{ margin: '6px 0 10px' }}>القيم فارغةً تُحسب تلقائيًا من متوسط آخر 6 أشهر. الرواتب ومستحقات الموردين تُؤخذ من بياناتك الفعلية (بتواريخ الاستحقاق). عدّل التقديرات كما تتوقّع.</div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="مبيعات شهرية متوقّعة" style={{ width: 160 }}><input className="inp n" inputMode="decimal" value={fcD.monthlySales} placeholder={'تلقائي: ' + money(f.avgSales)} onChange={e => setFcD(s => ({ ...s, monthlySales: e.target.value.replace(/[^\d.]/g, '') }))} disabled={!canPost} /></Field>
                <Field label="مصروفات تشغيل شهرية" style={{ width: 160 }}><input className="inp n" inputMode="decimal" value={fcD.monthlyOpex} placeholder={'تلقائي: ' + money(f.avgOpex)} onChange={e => setFcD(s => ({ ...s, monthlyOpex: e.target.value.replace(/[^\d.]/g, '') }))} disabled={!canPost} /></Field>
                <Field label="حد الأمان النقدي" style={{ width: 140 }}><input className="inp n" inputMode="decimal" value={fcD.buffer} placeholder="0.00" onChange={e => setFcD(s => ({ ...s, buffer: e.target.value.replace(/[^\d.]/g, '') }))} disabled={!canPost} /></Field>
                <Field label="الأفق" style={{ width: 110 }}>
                  <select className="sel" value={fcD.horizon} onChange={e => setFcD(s => ({ ...s, horizon: Number(e.target.value) }))} disabled={!canPost}>
                    <option value={3}>3 أشهر</option><option value={6}>6 أشهر</option><option value={12}>12 شهرًا</option>
                  </select>
                </Field>
                {canPost && <button className="btn pri" onClick={saveForecast}><Check size={14} />حفظ الافتراضات</button>}
              </div>
            </div>

            <div className="grid g3">
              <Kpi label="النقد الآن (خزائن + بنك)" value={money(f.cashNow)} sub={'+ ذمم تطبيقات ' + money(f.appRecv)} icon={Wallet} color="#C8A24A" />
              <Kpi label="أدنى رصيد متوقّع" value={money(f.minClosing)} sub={'خلال ' + f.horizon + ' أشهر'} icon={TrendingDown} color={f.minClosing < f.buffer - 0.004 ? '#D9544D' : '#4FB286'} />
              <Kpi label={f.gap ? 'أول شهر عجز متوقّع' : 'لا عجز متوقّع'} value={f.gap ? f.gap.ym : '✓'} sub={f.gap ? 'الرصيد ' + money(f.gap.closing) : 'ضمن حد الأمان'} icon={AlertTriangle} color={f.gap ? '#D9544D' : '#4FB286'} />
            </div>

            {f.gap && <div className="note" style={{ borderColor: 'rgba(217,84,77,.4)', color: 'var(--rose)' }}>⚠️ يُتوقّع أن ينخفض النقد دون حد الأمان في {f.gap.ym} (رصيد {money(f.gap.closing)}). راجع مواعيد سداد الموردين أو رتّب تمويلًا مسبقًا.</div>}

            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={15} color="var(--brass)" />التوقّع الشهري</div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>أول المدة</th><th style={{ textAlign: 'end' }}>مبيعات</th><th style={{ textAlign: 'end' }}>تحصيل تطبيقات</th><th style={{ textAlign: 'end' }}>موردون</th><th style={{ textAlign: 'end' }}>رواتب</th><th style={{ textAlign: 'end' }}>تشغيل</th><th style={{ textAlign: 'end' }}>آخر المدة</th><th style={{ width: '16%' }} /></tr></thead>
                  <tbody>
                    {f.rows.map(r => (
                      <tr key={r.ym}>
                        <td className="num" style={{ fontSize: 11.5 }}>{r.ym}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(r.opening)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{money(r.sales)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{r.recv ? money(r.recv) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{r.payDue ? money(r.payDue) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{money(r.payroll)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{money(r.opex)}</td>
                        <td className="num" style={{ textAlign: 'end', fontWeight: 800, color: r.closing < f.buffer - 0.004 ? 'var(--rose)' : 'var(--mint)' }}>{money(r.closing)}</td>
                        <td><div style={{ height: 9, borderRadius: 5, width: Math.max(2, Math.abs(r.closing) / maxAbs * 100) + '%', background: r.closing < f.buffer - 0.004 ? 'var(--rose)' : 'var(--mint)', opacity: .75 }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>توقّع تقديري: المبيعات والمصروفات التشغيلية تقديرات (متوسط تاريخي قابل للتعديل)، بينما <b>الرواتب والتأمينات ومستحقات الموردين</b> من التزاماتك الفعلية بتواريخها. ذمم التطبيقات الحالية تُحصَّل في الشهر الأول. ليس ضمانًا — أداة تخطيط للسيولة.</div>
            </div>
          </div>
        );
      })()}

      {view === 'bud' && (() => {
        const setB = (code, v) => setBudD(s => ({ ...s, map: { ...s.map, [code]: v.replace(/[^\d.]/g, '') } }));
        const BudLine = (a) => (
          <div key={a.code} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>{a.name}</span>
            <input className="inp n" style={{ width: 120 }} inputMode="decimal" value={budD.map[a.code] || ''} placeholder="0.00"
              onChange={e => setB(a.code, e.target.value)} disabled={!canPost} />
          </div>
        );
        const revIn = budAccounts.filter(a => a.kind === 'rev');
        const expIn = budAccounts.filter(a => a.kind === 'exp');
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t"><BarChart3 size={15} color="var(--brass)" />الموازنة التقديرية والانحرافات</div>
              <div className="note" style={{ margin: '8px 0 12px' }}>
                حدّد <b>ميزانيتك الشهرية المتوقّعة</b> لكل بند (إيراد/مصروف)، ثم قارن الفعلي بالمخطّط لأي شهر مع نسبة الانحراف.
                الموازنة على مستوى المنشأة (كل الفروع)، و<b>موقوفة افتراضيًا</b> حتى تُدخل بنودك وتفعّلها.
              </div>
              <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={budD.enabled} onChange={e => setBudD(s => ({ ...s, enabled: e.target.checked }))} disabled={!canPost} />
                تفعيل الموازنة والمقارنة
              </label>
              <div className="grid g2" style={{ alignItems: 'start' }}>
                <div className="card" style={{ background: 'rgba(79,178,134,.05)' }}>
                  <div className="lbl" style={{ marginBottom: 8 }}>الإيرادات — الهدف الشهري</div>
                  {revIn.map(BudLine)}
                </div>
                <div className="card" style={{ background: 'rgba(217,84,77,.05)' }}>
                  <div className="lbl" style={{ marginBottom: 8 }}>المصروفات — الموازنة الشهرية</div>
                  {expIn.map(BudLine)}
                </div>
              </div>
              {canPost && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn pri" onClick={saveBudget}><Check size={14} />{budD.enabled ? 'حفظ وتفعيل الموازنة' : 'حفظ (موقوفة)'}</button></div>}
            </div>

            {budgetOn ? (
              <div className="card">
                <div className="card-h">
                  <div className="card-t"><BarChart3 size={15} color="var(--brass)" />مقارنة الفعلي بالمخطّط</div>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>الشهر</span>
                    <input type="month" className="inp" style={{ width: 150 }} value={bMonth} onChange={e => setBMonth(e.target.value)} />
                    <button className="btn sm" onClick={printBudget}><Printer size={13} />طباعة</button>
                  </div>
                </div>
                <div className="grid g3" style={{ marginTop: 10 }}>
                  <Kpi label="الإيرادات (فعلي)" value={money(budRevA)} sub={'الهدف ' + money(budRevB) + ' · ' + (budRevA + 0.005 >= budRevB ? 'محقَّق' : 'دونه')} icon={TrendingUp} color={budRevA + 0.005 >= budRevB ? '#4FB286' : '#E0A458'} />
                  <Kpi label="المصروفات (فعلي)" value={money(budExpA)} sub={'الموازنة ' + money(budExpB) + ' · ' + (budExpA <= budExpB + 0.005 ? 'ضمنها' : 'تجاوز')} icon={TrendingDown} color={budExpA <= budExpB + 0.005 ? '#4FB286' : '#D9544D'} />
                  <Kpi label="صافي الربح (فعلي)" value={money(budNetA)} sub={'المخطّط ' + money(budNetB)} icon={Scale} color={budNetA + 0.005 >= budNetB ? '#4FB286' : '#E0A458'} />
                </div>
                <div className="tw" style={{ marginTop: 12 }}>
                  <table className="tb">
                    <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>الموازنة الشهرية</th><th style={{ textAlign: 'end' }}>الفعلي ({bMonth})</th><th style={{ textAlign: 'end' }}>الفرق</th><th style={{ textAlign: 'end' }}>النسبة</th><th>الحالة</th></tr></thead>
                    <tbody>
                      {budRows.map(r => {
                        const stTxt = r.a.kind === 'exp' ? (r.over ? 'تجاوز' : 'ضمن الميزانية') : (r.actual + 0.005 >= r.budget ? 'تحقّق الهدف' : 'دون الهدف');
                        const stCls = r.a.kind === 'exp' ? (r.over ? 'b-rose' : 'b-mint') : (r.actual + 0.005 >= r.budget ? 'b-mint' : 'b-amber');
                        return (
                          <tr key={r.a.code}>
                            <td style={{ fontSize: 12.5 }}>{r.a.name}</td>
                            <td className="num" style={{ textAlign: 'end' }}>{r.budget ? money(r.budget) : '—'}</td>
                            <td className="num" style={{ textAlign: 'end' }}>{money(r.actual)}</td>
                            <td className="num" style={{ textAlign: 'end', color: r.over ? 'var(--rose)' : 'var(--mint)' }}>{fmtBal(r.variance)}</td>
                            <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{r.pct == null ? '—' : (r.pct > 0 ? '+' : '') + r.pct + '%'}</td>
                            <td><span className={'badge ' + stCls}>{stTxt}</span></td>
                          </tr>
                        );
                      })}
                      {budRows.length === 0 && <tr><td colSpan={6}><div className="empty">لا بنود موازنة ولا حركة في {bMonth}. أدخل بنود الموازنة أعلاه.</div></td></tr>}
                      <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                        <td>صافي الربح</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(budNetB)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(budNetA)}</td>
                        <td className="num" style={{ textAlign: 'end', color: (budNetA + 0.005 >= budNetB) ? 'var(--mint)' : 'var(--rose)' }}>{fmtBal(Math.round((budNetA - budNetB) * 100) / 100)}</td>
                        <td /><td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="note" style={{ marginTop: 10 }}>الفعلي مصدره قيودك المرحّلة لذلك الشهر. المصروف يتجاوز حين يزيد الفعلي عن الموازنة، والإيراد يحقّق هدفه حين يبلغه أو يتخطّاه. البنود بلا موازنة تظهر فعليها للاطّلاع فقط.</div>
              </div>
            ) : (
              <div className="note">فعّل الموازنة أعلاه وأدخل بنودها الشهرية لتظهر مقارنة الفعلي بالمخطّط والانحرافات.</div>
            )}
          </div>
        );
      })()}

      {view === 'food' && (() => {
        // v36.0 — لوحة تكلفة الطعام بالفروع: تكلفة المبيعات ÷ صافي المبيعات لكل فرع مقابل الهدف — بنفس تصنيف قائمة الدخل
        const fTo = to || today();
        const fFrom = from || (fTo.slice(0, 8) + '01');
        const tgt = Number(((org.scorecard || {}).targets || {}).food) || 30;
        const ents = A.entries.filter(e => inPeriod(e, fFrom, fTo) && !e.closing);
        const fcOf = (es) => { const Y = isLayout(A.accounts, (a) => balOf(a, aggOf(es))); const cogs = -Y.cogsT; return { ns: Y.netSales, cogs, pct: Y.netSales > 0.004 ? Math.round(cogs / Y.netSales * 1000) / 10 : null }; };
        const brs = (org.branches || []).filter(b => b.isActive !== false);
        const rows = brs.map(b => ({ b, ...fcOf(ents.filter(e => e.branchId === b.id)) })).sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1));
        const central = fcOf(ents.filter(e => !e.branchId));
        const all = fcOf(ents);
        const stOf = (r) => r.pct == null ? 'na' : r.cogs < 0.005 ? 'gap' : r.pct > tgt + 2 ? 'bad' : r.pct > tgt ? 'warn' : 'ok';
        const stAr = { ok: 'ضمن الهدف', warn: 'قريب من الحد', bad: 'فوق الهدف', gap: 'لا تكلفة مسجّلة', na: 'لا مبيعات' };
        const over = rows.filter(r => ['bad', 'warn'].includes(stOf(r)));
        const saving = Math.round(sum(over, r => (r.pct - tgt) / 100 * r.ns) * 100) / 100;
        const gaps = rows.filter(r => stOf(r) === 'gap');
        const maxPct = Math.max(tgt * 1.6, ...rows.map(r => r.pct || 0), 1);
        // الاتجاه: آخر 6 أشهر حتى نهاية الفترة
        const mons = (() => { const out = []; const d = new Date(fTo.slice(0, 7) + '-01T00:00:00'); for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(isoD(x).slice(0, 7)); } return out; })();
        const monE = {}; mons.forEach(m => { monE[m] = A.entries.filter(e => (e.date || '').slice(0, 7) === m && !e.closing); });
        const cell = (es) => fcOf(es);
        const saveTgt = async (v) => {
          const n = Number(String(v).replace(/[^\d.]/g, '')); if (!(n > 0 && n < 100)) return say('أدخل نسبة بين 1 و99', 'no');
          await commitOrg(d => ({ ...d, scorecard: { ...(d.scorecard || {}), targets: { ...((d.scorecard || {}).targets || {}), food: n } } }), { actionType: 'update', targetType: 'scorecard', targetId: 'food', need: 'edit', title: 'عدّل هدف تكلفة الطعام', details: n + '%' });
          say('هدف تكلفة الطعام الآن ' + n + '%');
        };
        const pctTxt = (p) => p == null ? '—' : p.toFixed(1) + '%';
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{periodBar}</div>
            <div className="grid g4">
              <Kpi label="تكلفة الطعام — الشركة" value={pctTxt(all.pct)} sub={money(all.cogs) + ' من مبيعات ' + money(all.ns)} icon={Store} color={all.pct != null && all.pct > tgt ? '#D9544D' : '#4FB286'} />
              <Kpi label="الهدف" value={tgt + '%'} sub={canPost ? 'قابل للتعديل أدناه' : 'تحدده الإدارة المالية'} icon={Scale} color="#C8A24A" />
              <Kpi label="فروع فوق الهدف" value={String(over.length) + ' / ' + rows.length} sub={over.length ? over.map(r => r.b.name).slice(0, 2).join('، ') + (over.length > 2 ? '…' : '') : 'كل الفروع ضمن الهدف'} icon={AlertTriangle} color={over.length ? '#D9544D' : '#4FB286'} />
              <Kpi label="وفر ممكن عند بلوغ الهدف" value={money(saving)} sub="للفترة المعروضة" icon={TrendingDown} color="#5B93C4" />
            </div>
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Store size={15} color="var(--brass)" />تكلفة الطعام حسب الفرع <span className="badge b-dim">من <span className="num">{fFrom}</span> إلى <span className="num">{fTo}</span></span></div>
                {canPost && <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>الهدف %</span>
                  <input className="inp n" style={{ width: 80 }} inputMode="decimal" defaultValue={tgt} key={tgt} onBlur={e => { if (Number(e.target.value) !== tgt) saveTgt(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
                </div>}
              </div>
              <div className="fc-list">
                {rows.map(r => { const st = stOf(r); return (
                  <div key={r.b.id} className={'fc-row ' + st}>
                    <div className="fc-h"><b>{r.b.name}</b><span className={'fc-st ' + st}>{stAr[st]}</span><span className="fc-p num">{pctTxt(r.pct)}</span></div>
                    <div className="fc-bar"><span style={{ width: Math.min(100, (r.pct || 0) / maxPct * 100) + '%' }} /><i style={{ insetInlineStart: (tgt / maxPct * 100) + '%' }} title={'الهدف ' + tgt + '%'} /></div>
                    <div className="fc-s">تكلفة <span className="num">{money(r.cogs)}</span> · مبيعات صافية <span className="num">{money(r.ns)}</span>
                      {st === 'bad' || st === 'warn' ? <> · زيادة <span className="num">{money(Math.round((r.pct - tgt) / 100 * r.ns * 100) / 100)}</span> عن الهدف</> : null}</div>
                  </div>); })}
                {central.cogs > 0.004 && <div className="fc-row gap"><div className="fc-h"><b>تكلفة غير موزّعة على الفروع</b><span className="fc-st gap">مركزية</span><span className="fc-p num">{money(central.cogs)}</span></div>
                  <div className="fc-s">مشتريات أو صرف مواد سُجّل بلا فرع — تدخل في نسبة الشركة فقط. حدّد الفرع في الفاتورة أو أمر الصرف لتظهر في نسبة الفرع الصحيح.</div></div>}
              </div>
              {gaps.length > 0 && <div className="note" style={{ marginTop: 10 }}>⚠ {gaps.map(r => r.b.name).join('، ')}: مبيعات بلا أي تكلفة مواد مسجّلة — النسبة 0% مضللة. سجّل مشتريات المواد أو صرف المستودع لهذه الفروع.</div>}
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><TrendingUp size={15} color="var(--brass)" />الاتجاه — آخر 6 أشهر</div>
              <div className="tw">
                <table className="tb is-tb fc-tr">
                  <thead><tr><th>الفرع</th>{mons.map(m => <th key={m} style={{ textAlign: 'center' }}><span className="num">{m}</span></th>)}</tr></thead>
                  <tbody>
                    {[{ id: '*', name: 'الشركة' }, ...brs].map(b => (
                      <tr key={b.id} className={b.id === '*' ? 'is-total' : 'is-line'}>
                        <td>{b.name}</td>
                        {mons.map(m => { const c = cell(b.id === '*' ? monE[m] : monE[m].filter(e => e.branchId === b.id)); const st = c.pct == null ? 'na' : c.cogs < 0.005 ? 'gap' : c.pct > tgt + 2 ? 'bad' : c.pct > tgt ? 'warn' : 'ok';
                          return <td key={m} className={'fc-c ' + st}><span className="num">{pctTxt(c.pct)}</span></td>; })}
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                تكلفة الطعام = تكلفة المبيعات (صرف المواد، الهدر، فروقات الجرد، مشتريات المواد) ÷ صافي المبيعات — بنفس تصنيف قائمة الدخل.
                الأخضر ضمن الهدف، والكهرماني حتى نقطتين فوقه، والأحمر أكثر من ذلك. الأرقام من القيود مباشرة وتتحدث تلقائيًا.
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'anl' && (() => {
        const chgTxt = (c, p) => { const v = pctChange(c, p); return v == null ? '—' : (v >= 0 ? '+' : '') + (Math.round(v * 10) / 10) + '%'; };
        const Ratio = (label, val, color) => (
          <div className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>
            <b className="num" style={{ fontSize: 12.5, color: color || 'var(--txt)' }}>{val}</b>
          </div>
        );
        const maxNet = Math.max(...anlTrend.map(m => Math.abs(m.net)), 1);
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {periodBar}
              <div className="row" style={{ gap: 8 }}>
                <select className="sel" style={{ width: 190 }} value={bf} onChange={e => setBf(e.target.value)}>
                  <option value="">تحليل موحّد (كل الفروع)</option>
                  <option value="central">القيود المركزية فقط</option>
                  {(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="btn sm" onClick={printAnalysis}><Printer size={13} />طباعة A4</button>
              </div>
            </div>
            {/* مقارنة شهر بشهر */}
            <div className="grid g3">
              <Kpi label={'الإيرادات — ' + anlCur.ym} value={money(anlCur.rev)} sub={'السابق ' + money(anlPrev.rev) + ' · ' + chgTxt(anlCur.rev, anlPrev.rev)} icon={TrendingUp} color={anlCur.rev + 0.005 >= anlPrev.rev ? '#4FB286' : '#D9544D'} />
              <Kpi label={'المصروفات — ' + anlCur.ym} value={money(anlCur.exp)} sub={'السابق ' + money(anlPrev.exp) + ' · ' + chgTxt(anlCur.exp, anlPrev.exp)} icon={TrendingDown} color={anlCur.exp <= anlPrev.exp + 0.005 ? '#4FB286' : '#D9544D'} />
              <Kpi label={'صافي الربح — ' + anlCur.ym} value={money(anlCur.net)} sub={'السابق ' + money(anlPrev.net) + ' · ' + chgTxt(anlCur.net, anlPrev.net)} icon={Scale} color={anlCur.net + 0.005 >= anlPrev.net ? '#4FB286' : '#E0A458'} />
            </div>
            {/* النِسَب */}
            <div className="grid g3">
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={14} color="var(--mint)" />الربحية</div>
                {Ratio('هامش الربح الصافي', pctTxt(ratios.netMargin), ratios.netMargin == null ? null : ratios.netMargin >= 0 ? 'var(--mint)' : 'var(--rose)')}
                {Ratio('نسبة المصروفات للإيراد', pctTxt(ratios.expRatio))}
                {Ratio('العائد على الأصول (ROA)', pctTxt(ratios.roa))}
                {Ratio('العائد على حقوق الملكية (ROE)', pctTxt(ratios.roe))}
              </div>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><Wallet size={14} color="var(--brass)" />السيولة</div>
                {Ratio('النسبة الجارية', xTxt(ratios.current), ratios.current == null ? null : ratios.current >= 1 ? 'var(--mint)' : 'var(--amber)')}
                {Ratio('النسبة السريعة', xTxt(ratios.quick), ratios.quick == null ? null : ratios.quick >= 1 ? 'var(--mint)' : 'var(--amber)')}
                {Ratio('نسبة النقد', xTxt(ratios.cashRatio))}
                {Ratio('رأس المال العامل', money(ratios.workingCap), ratios.workingCap >= 0 ? 'var(--mint)' : 'var(--rose)')}
              </div>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><Scale size={14} color="var(--brass)" />الرفع والكفاءة</div>
                {Ratio('الدين إلى حقوق الملكية', xTxt(ratios.de))}
                {Ratio('الخصوم إلى الأصول', pctTxt(ratios.da))}
                {Ratio('معدل دوران الأصول', xTxt(ratios.turnover))}
                {Ratio('إجمالي الأصول', money(anTotAssets))}
              </div>
            </div>
            {/* الاتجاه الشهري */}
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><BarChart3 size={15} color="var(--brass)" />الاتجاه الشهري — آخر 6 أشهر {bfLabel ? '· ' + bfLabel : ''}</div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>الإيرادات</th><th style={{ textAlign: 'end' }}>المصروفات</th><th style={{ textAlign: 'end' }}>صافي الربح</th><th style={{ width: '32%' }}>الاتجاه</th></tr></thead>
                  <tbody>
                    {anlTrend.map(m => (
                      <tr key={m.ym}>
                        <td className="num" style={{ fontSize: 11.5 }}>{m.ym}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{money(m.rev)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{money(m.exp)}</td>
                        <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: m.net >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{fmtBal(m.net)}</td>
                        <td><div style={{ height: 10, borderRadius: 5, width: Math.max(2, Math.abs(m.net) / maxNet * 100) + '%', background: m.net >= 0 ? 'var(--mint)' : 'var(--rose)', opacity: .75 }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>النِسَب مشتقّة من قوائمك مباشرةً: الربحية من قائمة الدخل للفترة المحددة، والسيولة والرفع من المركز المالي حتى نهايتها. الاتجاه يعرض آخر 6 أشهر منتهيةً بالفترة (أو الشهر الحالي). «×» تعني «مرّة»، والقيم بلا بسط/مقام صالح تظهر «—».</div>
            </div>
          </div>
        );
      })()}

      {view === 'apage' && (() => {
        const sel = apSel ? apSuppliers.find(p => p.id === apSel) : null;
        if (sel) {
          const stmt = apStmt(sel);
          return (
            <div className="grid" style={{ gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button className="btn sm gh" onClick={() => setApSel(null)}><ChevronRight size={14} />رجوع للأعمار</button>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>كشف حساب — {sel.name}</b>
                  <button className="btn sm" onClick={() => printSupStatement(sel)}><Printer size={13} />طباعة A4</button>
                </div>
              </div>
              <div className="grid g3">
                <Kpi label="الرصيد المستحق للمورد" value={money(sel.balance)} sub={sel.balance > 0 ? 'عليك سداده' : sel.balance < 0 ? 'دفعة مقدمة لصالحك' : 'مسوّى'} icon={Users} color={sel.balance > 0.004 ? '#D9544D' : '#4FB286'} />
                <Kpi label="مهلة السداد" value={sel.terms ? sel.terms + ' يوم' : '—'} sub={sel.phone || 'بلا هاتف'} icon={ClipboardCheck} color="#5B93C4" />
                <Kpi label="عدد الحركات" value={String(stmt.length)} sub={sel.tax ? 'ر.ض ' + sel.tax : 'مورد'} icon={FileText} color="#C8A24A" />
              </div>
              <div className="card">
                <div className="tw">
                  <table className="tb">
                    <thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>فاتورة/عليك</th><th style={{ textAlign: 'end' }}>سداد</th><th style={{ textAlign: 'end' }}>الرصيد</th></tr></thead>
                    <tbody>
                      {stmt.map((t, i) => (
                        <tr key={i}>
                          <td className="num" style={{ fontSize: 11 }}>{t.date}</td>
                          <td style={{ fontSize: 12 }}>{t.desc}</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{t.credit ? money(t.credit) : '—'}</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{t.debit ? money(t.debit) : '—'}</td>
                          <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(t.run)}</td>
                        </tr>
                      ))}
                      {stmt.length === 0 && <tr><td colSpan={5}><div className="empty">لا حركات لهذا المورد بعد.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="note" style={{ marginTop: 10 }}>«فاتورة/عليك» يرفع رصيدك المستحق، و«سداد» يخفضه. الرصيد الجاري تراكمي حتى كل حركة. المصروفات المسدّدة فورًا تظهر بطرفيها (أثرها صافٍ صفر).</div>
              </div>
            </div>
          );
        }
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div className="grid g4" style={{ flex: 1, minWidth: 300 }}>
                <Kpi label="إجمالي المستحق للموردين" value={money(apTot.owed)} sub={apTot.debtors + ' مورد مدين'} icon={Users} color="#C8A24A" />
                <Kpi label="جاري (≤30 يوم)" value={money(apTot.b0)} sub="غير متأخر" icon={ClipboardCheck} color="#4FB286" />
                <Kpi label="متأخر 31–90" value={money(r2(apTot.b30 + apTot.b60))} sub="يستحق المتابعة" icon={AlertTriangle} color="#E0A458" />
                <Kpi label="متأخر أكثر من 90" value={money(apTot.b90)} sub="أولوية سداد" icon={AlertTriangle} color={apTot.b90 > 0.004 ? '#D9544D' : '#4FB286'} />
              </div>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={printAging}><Printer size={13} />طباعة الأعمار</button>
            </div>
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Users size={15} color="var(--brass)" />أعمار ديون الموردين</div>
                <label className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--dim)', alignItems: 'center' }}>كما في تاريخ:
                  <input type="date" className="inp" style={{ width: 150 }} value={apToday} onChange={e => setApToday(e.target.value || today())} />
                  {apToday !== today() && <button className="btn sm gh" onClick={() => setApToday(today())}>اليوم</button>}
                </label>
              </div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>المورد</th><th style={{ textAlign: 'end' }}>جاري ≤30</th><th style={{ textAlign: 'end' }}>31–60</th><th style={{ textAlign: 'end' }}>61–90</th><th style={{ textAlign: 'end' }}>أكثر من 90</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th /></tr></thead>
                  <tbody>
                    {apRows.map(r => (
                      <tr key={r.p.id}>
                        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.p.name}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{r.p.terms ? 'مهلة ' + r.p.terms + ' يوم' : 'بلا مهلة'}{r.credit > 0.004 ? ' · دفعة مقدمة ' + money(r.credit) : ''}</div></td>
                        <td className="num" style={{ textAlign: 'end' }}>{r.b0 ? money(r.b0) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b30 ? 'var(--amber)' : 'inherit' }}>{r.b30 ? money(r.b30) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b60 ? 'var(--amber)' : 'inherit' }}>{r.b60 ? money(r.b60) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b90 ? 'var(--rose)' : 'inherit', fontWeight: r.b90 ? 700 : 400 }}>{r.b90 ? money(r.b90) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', fontWeight: 800 }}>{money(r.total)}</td>
                        <td><button className="btn sm gh" onClick={() => setApSel(r.p.id)}>كشف حساب</button></td>
                      </tr>
                    ))}
                    {apRows.length === 0 && <tr><td colSpan={7}><div className="empty">لا ذمم موردين قائمة — كل الفواتير مسدّدة أو لا فواتير آجلة بعد.</div></td></tr>}
                    {apRows.length > 0 && (
                      <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                        <td>الإجمالي</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(apTot.b0)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(apTot.b30)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(apTot.b60)}</td>
                        <td className="num" style={{ textAlign: 'end', color: apTot.b90 > 0.004 ? 'var(--rose)' : 'inherit' }}>{money(apTot.b90)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(apTot.owed)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>الأعمار تُحتسب بتطبيق سداداتك على أقدم الفواتير أولًا، ثم تصنيف المتبقّي المفتوح بعُمره من تاريخ الفاتورة. المجموع يطابق رصيد المورد في دفتر الذمم. اضغط «كشف حساب» لتفاصيل حركة أي مورد ورصيده الجاري.</div>
            </div>
          </div>
        );
      })()}

      {view === 'arage' && (() => {
        const sel = arSel ? arCustomers.find(p => p.id === arSel) : null;
        if (sel) {
          const stmt = arStmt(sel); const due = r2(-sel.balance); const lim = Number(custRec(sel.id).creditLimit) || 0;
          return (
            <div className="grid" style={{ gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button className="btn sm gh" onClick={() => setArSel(null)}><ChevronRight size={14} />رجوع للأعمار</button>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>كشف حساب — {sel.name}</b>
                  <button className="btn sm" onClick={() => printCustStatement(sel)}><Printer size={13} />طباعة A4</button>
                </div>
              </div>
              <div className="grid g3">
                <Kpi label="المستحق على العميل" value={money(due)} sub={due > 0.004 ? 'مدين لك' : due < -0.004 ? 'رصيد دائن لصالحه' : 'مسوّى'} icon={Users} color={due > 0.004 ? '#E0A458' : '#4FB286'} />
                <Kpi label="حد الائتمان" value={lim ? money(lim) : 'غير محدّد'} sub={lim && due > lim + 0.004 ? 'تجاوز الحد بـ ' + money(r2(due - lim)) : lim ? 'ضمن الحد' : 'اضبطه من الأعمار'} icon={ShieldCheck} color={lim && due > lim + 0.004 ? '#D9544D' : '#5B93C4'} />
                <Kpi label="عدد الحركات" value={String(stmt.length)} sub={sel.phone || (sel.tax ? 'ر.ض ' + sel.tax : 'عميل')} icon={FileText} color="#C8A24A" />
              </div>
              <div className="card">
                <div className="tw">
                  <table className="tb">
                    <thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>على العميل</th><th style={{ textAlign: 'end' }}>تحصيل</th><th style={{ textAlign: 'end' }}>الرصيد المدين</th></tr></thead>
                    <tbody>
                      {stmt.map((t, i) => (
                        <tr key={i}>
                          <td className="num" style={{ fontSize: 11 }}>{t.date}</td>
                          <td style={{ fontSize: 12 }}>{t.desc}</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{t.debit ? money(t.debit) : '—'}</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{t.credit ? money(t.credit) : '—'}</td>
                          <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(t.run)}</td>
                        </tr>
                      ))}
                      {stmt.length === 0 && <tr><td colSpan={5}><div className="empty">لا حركات لهذا العميل بعد.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="note" style={{ marginTop: 10 }}>«على العميل» يرفع رصيده المدين (بيع آجل)، و«تحصيل» يخفضه. الرصيد الجاري تراكمي. تُسجَّل الحركات من دفتر الشركاء.</div>
              </div>
            </div>
          );
        }
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div className="grid g4" style={{ flex: 1, minWidth: 300 }}>
                <Kpi label="إجمالي الذمم المدينة" value={money(arTot.owed)} sub={arTot.debtors + ' عميل مدين'} icon={Users} color="#C8A24A" />
                <Kpi label="جاري (≤30 يوم)" value={money(arTot.b0)} sub="غير متأخر" icon={ClipboardCheck} color="#4FB286" />
                <Kpi label="متأخر 31–90" value={money(r2(arTot.b30 + arTot.b60))} sub="يستحق المتابعة" icon={AlertTriangle} color="#E0A458" />
                <Kpi label="تجاوزوا حد الائتمان" value={String(arTot.over)} sub={arTot.b90 > 0.004 ? 'متأخر +90: ' + money(arTot.b90) : 'راقب الحدود'} icon={ShieldAlert} color={arTot.over > 0 || arTot.b90 > 0.004 ? '#D9544D' : '#4FB286'} />
              </div>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={printArAging}><Printer size={13} />طباعة الأعمار</button>
            </div>
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Users size={15} color="var(--brass)" />أعمار الذمم المدينة — العملاء</div>
                <label className="row" style={{ gap: 6, fontSize: 11.5, color: 'var(--dim)', alignItems: 'center' }}>كما في تاريخ:
                  <input type="date" className="inp" style={{ width: 150 }} value={arToday} onChange={e => setArToday(e.target.value || today())} />
                  {arToday !== today() && <button className="btn sm gh" onClick={() => setArToday(today())}>اليوم</button>}
                </label>
              </div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>العميل</th><th style={{ textAlign: 'end' }}>جاري ≤30</th><th style={{ textAlign: 'end' }}>31–60</th><th style={{ textAlign: 'end' }}>61–90</th><th style={{ textAlign: 'end' }}>أكثر من 90</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th style={{ textAlign: 'end' }}>حد الائتمان</th><th /></tr></thead>
                  <tbody>
                    {arRows.map(r => (
                      <tr key={r.p.id} style={r.over ? { background: 'rgba(217,84,77,.06)' } : null}>
                        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.p.name}{r.over && <span className="badge b-rose" style={{ marginInlineStart: 6 }}>تجاوز الحد</span>}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{r.p.phone || (r.p.terms ? 'مهلة ' + r.p.terms + ' يوم' : 'عميل')}{r.credit > 0.004 ? ' · رصيد دائن ' + money(r.credit) : ''}</div></td>
                        <td className="num" style={{ textAlign: 'end' }}>{r.b0 ? money(r.b0) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b30 ? 'var(--amber)' : 'inherit' }}>{r.b30 ? money(r.b30) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b60 ? 'var(--amber)' : 'inherit' }}>{r.b60 ? money(r.b60) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.b90 ? 'var(--rose)' : 'inherit', fontWeight: r.b90 ? 700 : 400 }}>{r.b90 ? money(r.b90) : '—'}</td>
                        <td className="num" style={{ textAlign: 'end', fontWeight: 800 }}>{money(r.total)}</td>
                        <td className="num" style={{ textAlign: 'end', color: r.over ? 'var(--rose)' : 'var(--dim)' }}>{r.limit ? money(r.limit) : '—'}</td>
                        <td><div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          {canEdit && <button className="btn sm gh" onClick={() => setArLimitF({ id: r.p.id, name: r.p.name, limit: r.limit ? String(r.limit) : '' })} title="حد الائتمان"><ShieldCheck size={13} /></button>}
                          <button className="btn sm gh" onClick={() => setArSel(r.p.id)}>كشف حساب</button>
                        </div></td>
                      </tr>
                    ))}
                    {arRows.length === 0 && <tr><td colSpan={8}><div className="empty">لا ذمم عملاء قائمة — سجّل بيعًا آجلًا لعميل من «دفتر الشركاء» لتظهر هنا بأعمارها.</div></td></tr>}
                    {arRows.length > 0 && (
                      <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                        <td>الإجمالي</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(arTot.b0)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(arTot.b30)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(arTot.b60)}</td>
                        <td className="num" style={{ textAlign: 'end', color: arTot.b90 > 0.004 ? 'var(--rose)' : 'inherit' }}>{money(arTot.b90)}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(arTot.owed)}</td>
                        <td /><td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>مرآة أعمار الموردين: «على العميل» (بيع آجل) يرفع ذمّته المدينة، والتحصيلات تُطبَّق على الأقدم أولًا. تُسجَّل حركات العملاء من «دفتر الشركاء» (نوع: عميل). حدّ الائتمان اختياري؛ عند تجاوزه يُميَّز العميل بالأحمر.</div>
            </div>
            {arLimitF && (
              <Modal title={'حد ائتمان — ' + arLimitF.name} icon={ShieldCheck} onClose={() => setArLimitF(null)}
                foot={<><button className="btn gh" onClick={() => setArLimitF(null)}>إلغاء</button><button className="btn pri" onClick={saveArLimit}><Check size={14} />حفظ</button></>}>
                <Field label="حد الائتمان (ر.س) — اترّكه صفرًا لإلغائه">
                  <input className="inp n" inputMode="decimal" value={arLimitF.limit} placeholder="0.00" onChange={e => setArLimitF({ ...arLimitF, limit: e.target.value })} />
                </Field>
                <div className="note" style={{ marginTop: 10 }}>عند تجاوز رصيد العميل المدين هذا الحد، يظهر تنبيه أحمر في الأعمار. لا يمنع البيع — هو مؤشر رقابي.</div>
              </Modal>
            )}
          </div>
        );
      })()}

      {view === 'cc' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{periodBar}</div>
          <div className="grid g4">
            {centers.map(c => {
              const n = ccNet(c.id);
              return <Kpi key={c.id} label={'صافي ' + c.ar} value={money(n)} sub={'إيراد ' + money(ccSum('rev', c.id)) + ' − مصروف ' + money(ccSum('exp', c.id))} icon={c.id === 'central' ? Landmark : Store} color={n >= 0 ? '#4FB286' : '#D9544D'} />;
            })}
          </div>
          <div className="card">
            <div className="card-h">
              <div className="card-t"><BarChart3 size={15} color="var(--brass)" />مراكز التكلفة — أرقام مباشرة من القيود الموسومة بالفرع</div>
              <button className="btn sm" onClick={printCC}><Printer size={13} />طباعة</button>
            </div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الحساب</th>{centers.map(c => <th key={c.id} style={{ textAlign: 'end' }}>{c.ar}</th>)}<th style={{ textAlign: 'end' }}>الإجمالي</th></tr></thead>
                <tbody>
                  <tr><td colSpan={centers.length + 2} style={{ background: 'var(--acc-soft)', fontWeight: 800, color: 'var(--brass-l)', fontSize: 12 }}>الإيرادات</td></tr>
                  {A.accounts.filter(a => a.kind === 'rev' && ccAgg[a.code]).map(a => (
                    <tr key={a.code}><td style={{ fontSize: 12 }}>{a.name}</td>
                      {centers.map(c => <td key={c.id} className="num" style={{ textAlign: 'end' }}>{ccVal(a, c.id) ? money(ccVal(a, c.id)) : '—'}</td>)}
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(sum(centers, c => ccVal(a, c.id)))}</td></tr>
                  ))}
                  <tr><td colSpan={centers.length + 2} style={{ background: 'var(--acc-soft)', fontWeight: 800, color: 'var(--brass-l)', fontSize: 12 }}>المصروفات</td></tr>
                  {A.accounts.filter(a => a.kind === 'exp' && ccAgg[a.code]).map(a => (
                    <tr key={a.code}><td style={{ fontSize: 12, color: 'var(--dim)' }}>{a.name}</td>
                      {centers.map(c => <td key={c.id} className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{ccVal(a, c.id) ? '(' + money(ccVal(a, c.id)) + ')' : '—'}</td>)}
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: 'var(--rose)' }}>({money(sum(centers, c => ccVal(a, c.id)))})</td></tr>
                  ))}
                  <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                    <td>صافي كل مركز</td>
                    {centers.map(c => <td key={c.id} className="num" style={{ textAlign: 'end', color: ccNet(c.id) >= 0 ? 'var(--mint)' : 'var(--rose)', fontSize: 13 }}>{ccNet(c.id) < 0 ? '(' + money(-ccNet(c.id)) + ')' : money(ccNet(c.id))}</td>)}
                    <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)', fontSize: 13 }}>{money(sum(centers, c => ccNet(c.id)))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 10 }}>
              💡 عمود «المركز الرئيسي» يضم ما لا يخص فرعًا بعينه (رواتب الكشف المركزي، أوامر صرف الخزينة، فواتير المركز، الإهلاك…).
            </div>
          </div>

          {/* v8.3: التوزيع التحميلي — الأساس اختياري: بنسبة المبيعات أو نسب يدوية */}
          <div className="card" style={{ borderColor: ccCfg.enabled ? 'rgba(79,178,134,.4)' : 'var(--line-g)' }}>
            <div className="card-h">
              <div className="card-t"><Scale size={15} color="var(--brass)" />توزيع مصروفات المركز على الفروع</div>
              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                {canPost && ccCfg.enabled && (
                  <select className="sel" style={{ width: 210 }} value={ccBasis}
                    onChange={e => { setMPct(null); saveCcAlloc({ basis: e.target.value }, 'غيّر أساس توزيع مصروفات المركز', e.target.value === 'manual' ? 'نسب يدوية' : 'بنسبة المبيعات'); }}>
                    <option value="sales">تلقائي — بنسبة المبيعات</option>
                    <option value="manual">نسب يدوية أحددها حسب الحاجة</option>
                  </select>
                )}
                {canPost && (ccCfg.enabled
                  ? <button className="btn sm no" onClick={() => saveCcAlloc({ enabled: false }, 'أوقف توزيع مصروفات المركز')}>إيقاف التوزيع</button>
                  : <button className="btn sm pri" onClick={() => saveCcAlloc({ enabled: true }, 'فعّل توزيع مصروفات المركز')}><Check size={13} />تفعيل التوزيع</button>)}
              </div>
            </div>
            {!ccCfg.enabled && <div className="empty">التوزيع متوقف — عمود المركز يبقى كما هو في الجدول أعلاه.</div>}
            {ccCfg.enabled && !ccReady && <div className="empty">{ccBasis === 'manual' ? 'أدخل نسب الفروع أدناه واحفظها ليبدأ التوزيع.' : 'لا مبيعات فروع في الفترة المحددة — لا أساس للتوزيع.'}</div>}
            {ccCfg.enabled && (ccReady || ccBasis === 'manual') && (
              <>
                <div className="tw">
                  <table className="tb">
                    <thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>مبيعاته</th><th style={{ textAlign: 'end' }}>{ccBasis === 'manual' ? 'نسبته اليدوية %' : 'نسبته من المبيعات'}</th><th style={{ textAlign: 'end' }}>حصته من مصروفات المركز</th><th style={{ textAlign: 'end' }}>صافيه المباشر</th><th style={{ textAlign: 'end' }}>صافيه بعد التحميل</th></tr></thead>
                    <tbody>
                      {(org.branches || []).map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600, fontSize: 12.5 }}>{b.name}</td>
                          <td className="num" style={{ textAlign: 'end' }}>{money(branchRev[b.id] || 0)}</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>
                            {ccBasis === 'manual' && canPost
                              ? <input className="inp n cc-pct" style={{ width: 76, padding: '5px 8px', textAlign: 'end' }} inputMode="decimal"
                                  value={(mPct || ccManual)[b.id] ?? ''} placeholder="0"
                                  onChange={e => setMPct(m => ({ ...(m || ccManual), [b.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
                              : (shareOf(b.id) + '%')}
                          </td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>({money(allocOf[b.id] || 0)})</td>
                          <td className="num" style={{ textAlign: 'end' }}>{money(ccNet(b.id))}</td>
                          <td className="num" style={{ textAlign: 'end', fontWeight: 800, color: netAfter(b.id) >= 0 ? 'var(--mint)' : 'var(--rose)', fontSize: 13 }}>{money(netAfter(b.id))}</td>
                        </tr>
                      ))}
                      {unalloc > 0.004 && ccBasis === 'manual' && (
                        <tr>
                          <td style={{ color: 'var(--amber)', fontWeight: 700 }}>متبقٍ غير موزع (يبقى بالمركز)</td>
                          <td /><td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{Math.round((100 - manualTot) * 10) / 10}%</td>
                          <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{money(unalloc)}</td><td /><td />
                        </tr>
                      )}
                      <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                        <td>مصروفات المركز</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(totBranchRev)}</td>
                        <td className="num" style={{ textAlign: 'end' }}>{ccBasis === 'manual' ? manualTot + '%' : '100%'}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>({money(allocTot)})</td>
                        <td className="num" style={{ textAlign: 'end' }}>{money(sum(org.branches || [], b => ccNet(b.id)))}</td>
                        <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(sum(org.branches || [], b => netAfter(b.id)))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {ccBasis === 'manual' && canPost && (
                  <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn sm pri" onClick={() => {
                      const clean = {}; (org.branches || []).forEach(b => { const v = Number((mPct || ccManual)[b.id]) || 0; if (v > 0) clean[b.id] = v; });
                      const tot = Math.round(sum(org.branches || [], b => clean[b.id] || 0) * 10) / 10;
                      saveCcAlloc({ manual: clean, basis: 'manual' }, 'حدّد نسب توزيع مصروفات المركز يدويًا', 'المجموع ' + tot + '%');
                      setMPct(null);
                    }}><Check size={13} />حفظ النسب</button>
                    {(() => { const t = Math.round(sum(org.branches || [], b => Number((mPct || ccManual)[b.id]) || 0) * 10) / 10;
                      return <span className={'badge ' + (Math.abs(t - 100) < 0.05 ? 'b-mint' : 'b-amber')}>مجموع النسب: {t}% {Math.abs(t - 100) < 0.05 ? '✓' : '— ما دون 100% يبقى بالمركز'}</span>; })()}
                  </div>
                )}
                <div className="note" style={{ marginTop: 10 }}>
                  ⚖️ الأساس الحالي: {ccBasis === 'manual' ? 'نسب يدوية تحددها حسب الحاجة — عدّلها متى شئت' : 'حصة الفرع = مصروفات المركز × (مبيعاته ÷ إجمالي مبيعات الفروع) للفترة المعروضة'}.
                  توزيع <b>تقريري</b> يظهر هنا وفي الطباعة فقط — لا يولّد قيودًا محاسبية، فدفاترك تبقى نظيفة أمام المراجع.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'astl' && (() => {
        const apps = org.deliveryApps || [];
        const stls = (ops.appSettlements || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const recvOf = (appId) => { const a = A.accounts.find(x => x.appId === appId); return a ? a.balance : 0; };
        const appNm = (id) => (apps.find(a => a.id === id) || {}).n || '—';
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t"><Truck size={15} color="var(--brass)" />تسوية كشوف تطبيقات التوصيل</div>
              <div className="note" style={{ margin: '8px 0 12px' }}>
                طابِق ما أودعه كل تطبيق فعليًا في بنكك مع ذمّته في دفاترك. الفرق (رسوم إضافية، طلبات ملغاة، غرامات)
                يُسجَّل خصمًا موثّقًا. <b>القيد: مدين البنك (المُودَع) + مدين الخصومات (الفرق) = إقفال ذمة التطبيق.</b>
              </div>
              {apps.length === 0 ? <div className="empty">لا تطبيقات توصيل — أضِفها من «الفروع والمستخدمون ← تطبيقات التوصيل».</div> : (
                <div className="grid g3">
                  {apps.map(a => { const recv = recvOf(a.id); return (
                    <Kpi key={a.id} label={'ذمة ' + a.n} value={money(recv)} sub={recv > 0.5 ? 'مستحق لك — بانتظار التسوية' : (recv < -0.5 ? 'رصيد دائن' : 'مسوّاة بالكامل ✓')}
                      icon={Truck} color={recv > 0.5 ? '#E0A458' : '#4FB286'} />
                  ); })}
                </div>
              )}
              {canPost && apps.length > 0 && <div className="row" style={{ marginTop: 12 }}>
                <button className="btn pri" onClick={() => setStlF({ id: '', appId: apps[0]?.id || '', date: today(), deposit: '', deductions: '', note: '' })}><Plus size={14} />تسجيل تسوية إيداع</button>
              </div>}
            </div>
            {stls.length > 0 && (
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><Eye size={15} color="var(--brass)" />سجل التسويات</div>
                <div className="tw"><table className="tb">
                  <thead><tr><th>التاريخ</th><th>التطبيق</th><th>المُودَع (بنك)</th><th>الخصومات</th><th>المُقفَل من الذمة</th><th>ملاحظة</th></tr></thead>
                  <tbody>{stls.map(s => (
                    <tr key={s.id}>
                      <td className="num" style={{ fontSize: 11 }}>{(s.date || '').slice(0, 10)}</td>
                      <td style={{ fontWeight: 600 }}>{appNm(s.appId)}</td>
                      <td className="num">{money(s.deposit)}</td>
                      <td className="num" style={{ color: (Number(s.deductions) || 0) > 0 ? 'var(--rose)' : 'var(--dim)' }}>{s.deductions ? money(s.deductions) : '—'}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{money((Number(s.deposit) || 0) + (Number(s.deductions) || 0))}</td>
                      <td style={{ fontSize: 11, color: 'var(--dim)' }}>{s.note || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>
            )}
          </div>
        );
      })()}

      {view === 'ob' && (() => {
        const assets = obAccounts.filter(a => a.kind === 'asset');
        const liabs = obAccounts.filter(a => a.kind === 'liab');
        const sd = (arr) => sum(arr, a => Number(obD.map[a.code]) || 0);
        const totA = sd(assets), totL = sd(liabs);
        const capital = Math.round((totA - totL) * 100) / 100;
        const setAmt = (code, v) => setObD(s => ({ ...s, map: { ...s.map, [code]: v.replace(/[^\d.]/g, '') } }));
        const obLocked = periodLocked(org, obD.asOf);
        const Line = (a) => (
          <div key={a.code} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>{a.code} · {a.name}</span>
            <input className="inp n" style={{ width: 130 }} inputMode="decimal" value={obD.map[a.code] || ''}
              onChange={e => setAmt(a.code, e.target.value)} placeholder="0.00" disabled={!canPost} />
          </div>
        );
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t"><Landmark size={15} color="var(--brass)" />الأرصدة الافتتاحية — رصيد ما قبل المنصة</div>
              <div className="note" style={{ margin: '8px 0 12px' }}>
                أدخِل أرصدة حساباتك كما كانت قبل بدء التشغيل على المنصة (نقدية، بنك، ذمم، موردون…).
                <b> رأس المال يُحسب تلقائيًا</b> = الموجودات − المطلوبات، وتُسجَّل جميعها بقيدٍ افتتاحي واحد متوازن بتاريخ الرصيد.
                الأصول الثابتة تُدخل من تبويب «الأصول» (بتمويل: قيد افتتاحي)، لا من هنا.
              </div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                <Field label="تاريخ الرصيد الافتتاحي (عادةً يوم ما قبل التشغيل)">
                  <input type="date" className="inp" style={{ width: 170 }} value={obD.asOf}
                    onChange={e => setObD(s => ({ ...s, asOf: e.target.value }))} disabled={!canPost} />
                </Field>
                <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={obD.enabled !== false} onChange={e => setObD(s => ({ ...s, enabled: e.target.checked }))} disabled={!canPost} />
                  تفعيل الأرصدة الافتتاحية في المحاسبة
                </label>
              </div>
              {obLocked && <div className="note" style={{ marginBottom: 10, borderColor: 'rgba(224,164,88,.4)' }}>⚠️ شهر {String(obD.asOf).slice(0, 7)} مقفل — افتح الإقفال أولًا لتعديل الأرصدة الافتتاحية.</div>}
              <div className="grid g2" style={{ alignItems: 'start' }}>
                <div className="card" style={{ background: 'rgba(91,147,196,.05)' }}>
                  <div className="lbl" style={{ marginBottom: 8 }}>الموجودات (أصول)</div>
                  {assets.map(Line)}
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <b style={{ fontSize: 12 }}>مجموع الموجودات</b><b className="num">{money(totA)}</b>
                  </div>
                </div>
                <div className="card" style={{ background: 'rgba(224,164,88,.05)' }}>
                  <div className="lbl" style={{ marginBottom: 8 }}>المطلوبات (خصوم)</div>
                  {liabs.map(Line)}
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <b style={{ fontSize: 12 }}>مجموع المطلوبات</b><b className="num">{money(totL)}</b>
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 14, marginTop: 14, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge b-brass" style={{ fontSize: 12.5, padding: '6px 12px' }}>
                  رأس المال المحسوب (3101) = الموجودات − المطلوبات: <b className="num">{money(capital)}</b>
                </span>
                {canPost && <button className="btn pri" disabled={obLocked} onClick={saveOB}><Check size={14} />حفظ الأرصدة الافتتاحية</button>}
              </div>
            </div>
            {org.openingBalances && (org.openingBalances.lines || []).length > 0 && (
              <div className="note">✓ الأرصدة الافتتاحية مُفعّلة حاليًا بتاريخ {org.openingBalances.asOf} — تظهر كقيد «الأرصدة الافتتاحية» في اليومية وتنعكس في الميزان والمركز المالي.</div>
            )}
          </div>
        );
      })()}

      {view === 'yend' && (() => {
        const cd = (yeD.closeDate || '').slice(0, 10);
        const opAgg = {};
        A.entries.forEach(e => { if (!e.closing && (e.date || '') <= cd) e.lines.forEach(l => { const x = opAgg[l.code] || (opAgg[l.code] = { debit: 0, credit: 0 }); x.debit += l.debit; x.credit += l.credit; }); });
        const revAccts = A.accounts.filter(a => a.kind === 'rev');
        const expAccts = A.accounts.filter(a => a.kind === 'exp');
        const bOf = (a) => { const x = opAgg[a.code] || { debit: 0, credit: 0 }; return a.kind === 'rev' ? x.credit - x.debit : x.debit - x.credit; };
        const totRev = Math.round(sum(revAccts, bOf) * 100) / 100;
        const totExp = Math.round(sum(expAccts, bOf) * 100) / 100;
        const net = Math.round((totRev - totExp) * 100) / 100;
        const retainedNow = Math.round(((A.accounts.find(a => a.code === '3201') || {}).balance || 0) * 100) / 100;
        const active = !!(org.yearEnd && org.yearEnd.enabled);
        const yeLocked = periodLocked(org, cd);
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t"><CalendarDays size={15} color="var(--brass)" />إقفال السنة المالية</div>
              <div className="note" style={{ margin: '8px 0 12px' }}>
                في نهاية كل سنة، يُصفَّر رصيد <b>الإيرادات والمصروفات</b> ويُحوَّل صافيها (ربح أو خسارة) إلى
                حساب <b>«الأرباح المبقاة (3201)»</b> ضمن حقوق الملكية — فتبدأ السنة الجديدة بأرباح صفرية.
                قائمة الدخل تبقى تعرض الأداء التشغيلي كما هو (قيد الإقفال لا يظهر فيها)، بينما ينعكس التدوير في
                <b> الميزان والمركز المالي</b>. <b>موقوف افتراضيًا</b>، وقابل للتراجع بإلغاء التفعيل، ومؤمّن ضد الشهور المقفلة.
              </div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                <Field label="تاريخ نهاية السنة المالية (يُقفَل حتى هذا التاريخ)">
                  <input type="date" className="inp" style={{ width: 170 }} value={yeD.closeDate}
                    onChange={e => setYeD(s => ({ ...s, closeDate: e.target.value }))} disabled={!canPost} />
                </Field>
                <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={yeD.enabled} onChange={e => setYeD(s => ({ ...s, enabled: e.target.checked }))} disabled={!canPost} />
                  تفعيل قيد إقفال السنة
                </label>
              </div>
              {yeLocked && <div className="note" style={{ marginBottom: 10, borderColor: 'rgba(224,164,88,.4)' }}>⚠️ شهر {cd.slice(0, 7)} مقفل — افتح الإقفال أولًا لتعديل إقفال السنة.</div>}
              <div className="card" style={{ background: 'rgba(200,162,74,.05)' }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ color: 'var(--dim)' }}>إجمالي الإيرادات حتى {cd || '—'}</span><b className="num" style={{ color: 'var(--mint)' }}>{money(totRev)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ color: 'var(--dim)' }}>إجمالي المصروفات حتى {cd || '—'}</span><b className="num" style={{ color: 'var(--rose)' }}>{money(totExp)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 14, paddingTop: 8, borderTop: '1px solid var(--line)', fontWeight: 800 }}>
                  <span>{net >= 0 ? 'صافي ربح يُدوَّر إلى الأرباح المبقاة' : 'صافي خسارة تُخصم من الأرباح المبقاة'}</span>
                  <b className="num" style={{ color: net >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(Math.abs(net))}</b>
                </div>
              </div>
              <div className="row" style={{ gap: 14, marginTop: 14, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={'badge ' + (active ? 'b-mint' : 'b-dim')} style={{ fontSize: 12.5, padding: '6px 12px' }}>
                  {active ? <>مُفعّل — رصيد الأرباح المبقاة (3201) الآن: <b className="num">{money(retainedNow)}</b></> : 'غير مُفعّل — لن يتولّد قيد إقفال'}
                </span>
                {canEdit && <button className="btn pri" disabled={yeLocked} onClick={saveYearEnd}><Check size={14} />{yeD.enabled ? 'حفظ وتفعيل الإقفال' : 'حفظ (موقوف)'}</button>}
              </div>
            </div>
            {active && <div className="note">✓ قيد «إقفال السنة المالية حتى {(org.yearEnd || {}).closeDate}» يظهر في اليومية (مُوسَّم كإقفال) ويُحوّل الصافي إلى الأرباح المبقاة. قائمة الدخل غير متأثرة، والمركز المالي يعرض «الأرباح المبقاة» ضمن حقوق الملكية.</div>}
          </div>
        );
      })()}

      {view === 'mclose' && (() => {
        const mEnd = mcLastDay(mcMonth);
        const mClosings = (ops.closings || []).filter(c => (c.date || '').slice(0, 7) === mcMonth);
        const notApproved = mClosings.filter(c => c.status !== 'approved').length;
        const deficits = mClosings.filter(c => countedClosing(c) && (c.variance || 0) < 0).length;
        const bankMoved = A.entries.some(e => (e.date || '').slice(0, 7) <= mcMonth && e.lines.some(l => l.code === '1201'));
        const bankOk = (ops.bankRecs || []).some(r => (r.date || '') >= mEnd);
        const hasItems = (org.items || []).length > 0;
        const invOn = !!(org.invValuation && org.invValuation.enabled);
        const hasEmp = (org.employees || []).filter(e => e.isActive !== false).length > 0;
        const payAcc = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === mcMonth);
        const payPay = (ops.ledgerEntries || []).some(x => x.kind === 'salary_payout' && x.month === mcMonth);
        const taxOn2 = !!(org.taxCfg && org.taxCfg.enabled);
        const locked = periodLocked(org, mEnd);
        const chk = [];
        if (mClosings.length === 0) chk.push({ st: 'info', label: 'إغلاقات الشهر', detail: 'لا إغلاقات مسجّلة لهذا الشهر بعد.', act: { l: 'الإغلاق', go: () => setTab('closing') } });
        else chk.push({ st: notApproved === 0 ? 'done' : 'pending', label: 'اعتماد كل إغلاقات الشهر', detail: notApproved === 0 ? mClosings.length + ' إغلاق — كلها معتمدة' : notApproved + ' إغلاق بانتظار الاعتماد', act: { l: 'الاعتماد', go: () => setTab('approve') } });
        chk.push({ st: deficits === 0 ? 'done' : 'pending', label: 'معالجة فروقات الصندوق', detail: deficits === 0 ? 'لا عجز في إغلاقات الشهر' : deficits + ' إغلاق فيه عجز صندوق', act: { l: 'المقارنة', go: () => setTab('compare') } });
        if (bankMoved) chk.push({ st: bankOk ? 'done' : 'pending', label: 'التسوية البنكية للشهر', detail: bankOk ? 'طُوبِقَ رصيد البنك مع الكشف' : 'لم تُوثَّق تسوية بنكية بعد نهاية الشهر', act: { l: 'التسوية', go: () => setView('bank') } });
        if (hasItems) chk.push({ st: invOn ? 'done' : 'pending', label: 'رسملة المخزون', detail: invOn ? 'مفعّلة — تكلفة البضاعة والمخزون صحيحة' : 'غير مفعّلة — قد تختلّ تكلفة البضاعة المباعة', act: { l: 'المخزون', go: () => setTab('inv') } });
        if (hasEmp) chk.push({ st: (payAcc && payPay) ? 'done' : 'pending', label: 'ترحيل رواتب الشهر', detail: (payAcc && payPay) ? 'رُحّل الاستحقاق وسُجّل الصرف' : !payAcc ? 'لم يُرحّل استحقاق الرواتب' : 'رُحّل الاستحقاق ولم يُسجّل الصرف', act: { l: 'الرواتب', go: () => setTab('payroll') } });
        if (taxOn2) chk.push({ st: 'info', label: 'مراجعة الضريبة', detail: 'راجع مسودة الإقرار للفترة قبل التقديم', act: { l: 'الضريبة', go: () => setView('vat') } });
        chk.push({ st: locked ? 'done' : 'pending', label: 'قفل فترة الشهر (آخر خطوة)', detail: locked ? 'الشهر مقفل ضد التعديل' : 'اقفله بعد اكتمال المراجعة لحماية الأرقام', act: { l: 'الإقفال', go: () => setView('lock') } });
        const applicable = chk.filter(c => c.st !== 'info');
        const doneN = applicable.filter(c => c.st === 'done').length;
        const allDone = applicable.length > 0 && doneN === applicable.length;
        const stCls = { done: 'b-mint', pending: 'b-amber', info: 'b-dim' }, stTx = { done: 'تمّت', pending: 'ناقصة', info: 'مراجعة' };
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <ClipboardCheck size={16} color="var(--brass)" />
                  <b style={{ fontSize: 13.5 }}>حزمة الإقفال الشهري</b>
                  <input type="month" className="inp" style={{ width: 150 }} value={mcMonth} onChange={e => setMcMonth(e.target.value)} />
                </div>
                <span className={'badge ' + (allDone ? 'b-mint' : 'b-amber')} style={{ fontSize: 12.5, padding: '6px 12px' }}>{allDone ? 'جاهز للإقفال ✓' : doneN + ' من ' + applicable.length + ' خطوات مكتملة'}</span>
              </div>
              <div style={{ height: 8, borderRadius: 5, background: 'var(--ink3)', marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (applicable.length ? doneN / applicable.length * 100 : 0) + '%', background: allDone ? 'var(--mint)' : 'var(--brass)', borderRadius: 5 }} />
              </div>
            </div>

            <div className="grid" style={{ gap: 8 }}>
              {chk.map((c, i) => (
                <div key={i} className="card" style={{ borderInlineStart: '3px solid ' + (c.st === 'done' ? 'var(--mint)' : c.st === 'pending' ? 'var(--amber)' : 'var(--dim)') }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className={'badge ' + stCls[c.st]} style={{ fontSize: 9.5 }}>{stTx[c.st]}</span>
                        <b style={{ fontSize: 13 }}>{c.label}</b>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>{c.detail}</div>
                    </div>
                    {c.act && <button className={'btn sm' + (c.st === 'done' ? ' gh' : '')} onClick={c.act.go}>{c.act.l}<ChevronLeft size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-t" style={{ marginBottom: 4 }}><FileBarChart size={15} color="var(--brass)" />حزمة تقارير الشهر — {mcMonth}</div>
              <div className="note" style={{ marginBottom: 10 }}>كل التقارير أدناه مضبوطة تلقائيًا على شهر الإقفال المختار.</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={printFS}><Printer size={14} />القوائم المالية</button>
                <button className="btn" onClick={printTB}><Printer size={14} />ميزان المراجعة</button>
                <button className="btn" onClick={printForecast}><Printer size={14} />التوقّع النقدي</button>
                <button className="btn pri" onClick={exportExcel}><Download size={14} />تصدير كل التقارير (Excel)</button>
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'ctrl' && (() => {
        const largeAmt = audD.largeAmount !== '' ? (Number(audD.largeAmount) || 0) : 5000;
        const cc = (ops.closings || []).filter(countedClosing);
        const F = [];
        const add = (sev, cat, title, detail) => F.push({ sev, cat, title, detail });
        // 1) فصل المهام: نفس الشخص أنشأ واعتمد
        (ops.closings || []).forEach(c => { if (c.auditedBy && c.managerName && c.auditedBy === c.managerName) add('high', 'فصل المهام', 'نفس الشخص أنشأ الإغلاق واعتمده', (c.branchName || '') + ' · ' + c.date + ' · ' + c.managerName + ' — يجب فصل الإنشاء عن الاعتماد.'); });
        // 2) قيود يدوية كبيرة
        (ops.journalManual || []).forEach(j => { const t = sum(j.lines || [], l => l.debit || 0); if (t >= largeAmt) add('mid', 'قيود يدوية', 'قيد يدوي كبير', (j.title || 'قيد يدوي') + ' · ' + (j.date || '').slice(0, 10) + ' · ' + money(t) + ' — القيود اليدوية تتجاوز الأتمتة؛ راجع سندها.'); });
        // 3) مبالغ شاذة (إيراد إغلاق مرتفع إحصائيًا)
        if (cc.length >= 4) {
          const revs = cc.map(c => c.totalRevenue || 0); const mean = sum(revs, x => x) / revs.length;
          const sd = Math.sqrt(sum(revs, x => (x - mean) * (x - mean)) / revs.length);
          cc.forEach(c => { if (sd > 0 && (c.totalRevenue || 0) > mean + 3 * sd) add('mid', 'مبالغ شاذة', 'إيراد إغلاق شاذّ (مرتفع بشكل غير معتاد)', (c.branchName || '') + ' · ' + c.date + ' · ' + money(c.totalRevenue) + ' مقابل متوسط ' + money(Math.round(mean)) + ' — تحقّق من الإدخال.'); });
        }
        // 4) ازدواج محتمل: مصروف بنفس اليوم والبند والمبلغ
        const em = {};
        cc.forEach(c => (c.expenses || []).forEach(e => { if (!(e.amount > 0)) return; const k = c.date + '|' + (e.categoryName || '') + '|' + e.amount; (em[k] = em[k] || []).push(1); }));
        Object.entries(em).forEach(([k, arr]) => { if (arr.length >= 2) { const pr = k.split('|'); add('high', 'ازدواج محتمل', 'مصروف مكرّر بنفس اليوم والمبلغ', pr[1] + ' · ' + pr[0] + ' · ' + money(Number(pr[2])) + ' — تكرّر ' + arr.length + ' مرات، قد يكون مزدوجًا.'); } });
        // 5) فروقات صندوق متكررة
        const db = {};
        cc.forEach(c => { if ((c.variance || 0) < 0) db[c.branchName || '—'] = (db[c.branchName || '—'] || 0) + 1; });
        Object.entries(db).forEach(([br, n]) => { if (n >= 2) add('high', 'فروقات متكررة', 'عجز صندوق متكرّر', br + ' · ' + n + ' حالات عجز — نمط يستحق التحقيق لا حادثة منفردة.'); });
        // 6) سلف متكررة لموظف
        const ab = {};
        (ops.advances || []).filter(a => ['advance', 'salary_draw'].includes(a.type)).forEach(a => { const key = a.employeeName || a.employeeId || '—'; ab[key] = (ab[key] || 0) + 1; });
        Object.entries(ab).forEach(([e2, n]) => { if (n >= 3) add('mid', 'سلف متكررة', 'سلف متكرّرة لموظف', e2 + ' · ' + n + ' سلف — راجع سبب التكرار.'); });
        // 7) مدفوعات موردين بلا فاتورة مرتبطة
        cc.forEach(c => (c.supplierPayments || []).forEach(pm => { const t = payTotal(pm); if (t > 0 && !pm.invoiceId) add('high', 'مدفوعات غير مدعّمة', 'سداد مورد بلا فاتورة مرتبطة', (pm.supplierName || 'مورد') + ' · ' + c.date + ' · ' + money(t) + ' — لا فاتورة مرجعية؛ وثّق السند.'); }));
        // 8) مبالغ مستديرة كبيرة
        cc.forEach(c => (c.expenses || []).forEach(e => { const a = e.amount || 0; if (a >= largeAmt && a % 1000 === 0) add('low', 'مبالغ مستديرة', 'مبلغ مستدير كبير', (e.categoryName || 'مصروف') + ' · ' + c.date + ' · ' + money(a) + ' — المبالغ المستديرة الكبيرة قد تكون تقديرات؛ تحقّق.'); }));

        const rank = { high: 0, mid: 1, low: 2 }; F.sort((a, b) => rank[a.sev] - rank[b.sev]);
        const nHi = F.filter(f => f.sev === 'high').length, nMd = F.filter(f => f.sev === 'mid').length, nLo = F.filter(f => f.sev === 'low').length;
        const sevCls = { high: 'b-rose', mid: 'b-amber', low: 'b-dim' }, sevTx = { high: 'مرتفع', mid: 'متوسط', low: 'منخفض' };
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <div><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الضوابط الداخلية والتدقيق</div>
                  <div className="note" style={{ marginTop: 6 }}>فحص جنائيّ لبياناتك يكشف الشذوذ والازدواج وفصل المهام — <b>مؤشرات للمراجعة لا اتهامات</b>. راجع كل ملاحظة بسندها.</div></div>
                <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
                  <Field label="حد «المبلغ الكبير»" style={{ width: 150 }}><input className="inp n" inputMode="decimal" value={audD.largeAmount} onChange={e => setAudD({ largeAmount: e.target.value.replace(/[^\d.]/g, '') })} disabled={!canEdit} /></Field>
                  {canEdit && <button className="btn pri" onClick={saveAudit}><Check size={14} />حفظ</button>}
                </div>
              </div>
            </div>

            <div className="grid g3">
              <Kpi label="إجمالي الملاحظات" value={String(F.length)} sub="عبر 8 ضوابط" icon={ShieldCheck} color={F.length ? '#C8A24A' : '#4FB286'} />
              <Kpi label="مرتفعة المخاطر" value={String(nHi)} sub="تتطلب تحقيقًا" icon={AlertTriangle} color={nHi ? '#D9544D' : '#4FB286'} />
              <Kpi label="متوسطة/منخفضة" value={nMd + ' / ' + nLo} sub="مراجعة" icon={Eye} color="#5B93C4" />
            </div>

            <div className="grid" style={{ gap: 8 }}>
              {F.slice(0, 60).map((f, i) => (
                <div key={i} className="card" style={{ borderInlineStart: '3px solid ' + (f.sev === 'high' ? 'var(--rose)' : f.sev === 'mid' ? 'var(--amber)' : 'var(--dim)') }}>
                  <div className="row" style={{ gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={'badge ' + sevCls[f.sev]} style={{ fontSize: 9.5 }}>{sevTx[f.sev]}</span>
                    <span className="badge b-dim" style={{ fontSize: 9.5 }}>{f.cat}</span>
                    <b style={{ fontSize: 13 }}>{f.title}</b>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>{f.detail}</div>
                </div>
              ))}
              {F.length === 0 && <div className="card"><div className="empty">لا ملاحظات رقابية — ضوابطك سليمة ✓</div></div>}
              {F.length > 60 && <div className="note">عُرضت أول 60 ملاحظة من {F.length}. عالِج المرتفعة أولًا.</div>}
            </div>

            <div className="note">الضوابط المفحوصة: فصل المهام (منشئ الإغلاق ≠ معتمِده) · القيود اليدوية الكبيرة · المبالغ الشاذة إحصائيًا · الازدواج المحتمل · فروقات الصندوق المتكررة · السلف المتكررة · مدفوعات الموردين بلا فاتورة · المبالغ المستديرة الكبيرة. عدّل «حد المبلغ الكبير» أعلاه حسب حجم نشاطك.</div>
          </div>
        );
      })()}

      {view === 'lock' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid g3">
            <Kpi label={plCfg.lockedThrough ? 'مقفل حتى نهاية' : 'لا فترات مقفلة'} value={plCfg.lockedThrough || '—'}
              sub={plCfg.lockedThrough ? 'كل ما قبله وضمنه محمي من التعديل' : 'اقفل الشهور المعتمدة لحمايتها'} icon={Lock} color={plCfg.lockedThrough ? '#4FB286' : '#E0A458'} />
            <Kpi label="آخر إجراء" value={plLog[0] ? (plLog[0].action === 'lock' ? 'قفل ' + plLog[0].month : 'فتح استثنائي') : '—'}
              sub={plLog[0] ? 'بواسطة ' + plLog[0].by + ' · ' + (plLog[0].at || '').slice(0, 10) : ''} icon={Eye} color="#5B93C4" />
            <Kpi label="إجراءات السجل" value={String(plLog.length)} sub="كل قفل وفتح موثق دائمًا" icon={ShieldCheck} color="#C8A24A" />
          </div>

          {canLock ? (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ borderColor: 'rgba(79,178,134,.4)' }}>
                <div className="card-t" style={{ marginBottom: 8 }}><Lock size={15} color="var(--mint)" />قفل الفترات حتى شهر</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Field label="اقفل حتى نهاية شهر" style={{ width: 160 }}>
                    <input type="month" className="inp" value={lockTo || prevYm} onChange={e => setLockTo(e.target.value)} />
                  </Field>
                  <button className="btn pri" onClick={doLock}><Lock size={14} />قفل الفترات</button>
                </div>
                {(() => { const c = lockChecks(lockTo || prevYm);
                  return (c.drafts > 0 || c.pending > 0) && (
                    <div className="note" style={{ marginTop: 10 }}>
                      ⚠️ قبل القفل: {c.drafts > 0 ? c.drafts + ' مسودة/مرفوض حتى هذا الشهر لن يمكن إتمامها بعد القفل. ' : ''}
                      {c.pending > 0 ? c.pending + ' إغلاق مرحّل بانتظار التدقيق — اعتمده الآن أو سيلزم فتح استثنائي.' : ''}
                    </div>
                  ); })()}
                <div className="note" style={{ marginTop: 8 }}>
                  القفل تراكمي: يمنع تعديل/حذف/اعتماد الإغلاقات، والقيود اليدوية، وترحيل الرواتب، والسلف،
                  واستلام التحويلات، والفواتير، والأصول بتواريخ الشهور المقفلة — وتغيير إعداد الضريبة أثناء وجود قفل.
                </div>
              </div>
              <div className="card" style={{ borderColor: 'rgba(224,164,88,.4)' }}>
                <div className="card-t" style={{ marginBottom: 8 }}><ShieldAlert size={15} color="var(--amber)" />فتح استثنائي (بسبب موثق)</div>
                <Field label="سبب الفتح — إلزامي ويُسجل باسمك">
                  <input className="inp" placeholder="مثال: تصحيح وردية 5 أغسطس بطلب المراجع…" value={unReason} onChange={e => setUnReason(e.target.value)} />
                </Field>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Field label="الحد الجديد (اختياري — فارغ = فتح الكل)" style={{ width: 190 }}>
                    <input type="month" className="inp" value={unTo} onChange={e => setUnTo(e.target.value)} />
                  </Field>
                  <button className="btn no" disabled={!plCfg.lockedThrough} onClick={doUnlock}>فتح استثنائي</button>
                </div>
                <div className="note" style={{ marginTop: 8 }}>بعد التصحيح أعد القفل — وكل فتحٍ يبقى في السجل أدناه وفي سجل التدقيق أمام أي مراجع.</div>
              </div>
            </div>
          ) : (
            <div className="card"><div className="empty">القفل والفتح الاستثنائي صلاحية للإدارة العليا / مسؤول النظام — يمكنك الاطلاع على الحالة والسجل.</div></div>
          )}

          {(ops.ledgerSnaps || []).length > 0 && (() => { const AA = A; const rows = (ops.ledgerSnaps || []).slice().sort((a, b) => b.month.localeCompare(a.month)).map(x => ({ x, live: monthLedger(AA, x.month) }));
            const bad = rows.filter(r => r.live.sig !== r.x.sig);
            return (
            <div className="card" style={{ borderColor: bad.length ? 'rgba(217,84,77,.5)' : 'rgba(79,178,134,.4)' }}>
              <div className="card-t" style={{ marginBottom: 8 }}><ShieldCheck size={15} color={bad.length ? 'var(--rose)' : 'var(--mint)'} />الدفتر المُرحَّل المجمَّد — {bad.length ? bad.length + ' شهر تغيّر بعد تجميده' : 'كل الأشهر مطابقة لما جُمِّد ✓'}</div>
              <div className="tw"><table className="tb">
                <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>القيود</th><th style={{ textAlign: 'end' }}>إجمالي المدين</th><th>جُمّد</th><th>الحالة</th></tr></thead>
                <tbody>{rows.map(({ x, live }) => { const ok = live.sig === x.sig; const dd = Math.round((live.dr - x.dr) * 100) / 100; return (
                  <tr key={x.id || x.month}>
                    <td className="num">{x.month}</td><td className="num" style={{ textAlign: 'end' }}>{x.n}{live.n !== x.n ? ' → ' + live.n : ''}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{money(x.dr)}{Math.abs(dd) > 0.004 ? <div style={{ fontSize: 10, color: 'var(--rose)' }}>الحي {money(live.dr)}</div> : null}</td>
                    <td style={{ fontSize: 11, color: 'var(--faint)' }}>{String(x.at || '').slice(0, 10)} · {x.by}</td>
                    <td>{ok ? <span className="badge b-mint">مطابق ✓</span> : x.reopened ? <span className="badge b-amber" title={x.reopenReason || ''}>مفتوح للتصحيح — أعد القفل</span> : <span className="badge b-rose">تغيّر بعد التجميد ⚠</span>}</td>
                  </tr>); })}</tbody>
              </table></div>
              <div className="note" style={{ marginTop: 8 }}>عند كل إقفال يُحفظ ميزان الشهر وبصمة قيوده. «تغيّر بعد التجميد» يعني أن أرقام شهر مقفل اختلفت عمّا اعتُمد — راجع سجل الفتح الاستثنائي والتعديلات. الشهر المفتوح للتصحيح يُجمَّد من جديد عند إعادة قفله.</div>
            </div>); })()}

          {plLog.length > 0 && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Eye size={15} color="var(--brass)" />سجل الإقفال والفتح</div>
              <div className="tw"><table className="tb">
                <thead><tr><th>التاريخ</th><th>الإجراء</th><th>الشهر/الحد</th><th>السبب</th><th>بواسطة</th></tr></thead>
                <tbody>{plLog.map(l => (
                  <tr key={l.id}>
                    <td className="num" style={{ fontSize: 11 }}>{(l.at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td>{l.action === 'lock' ? <span className="badge b-mint">قفل 🔒</span> : <span className="badge b-amber">فتح استثنائي</span>}</td>
                    <td className="num">{l.month}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{l.reason || '—'}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--faint)' }}>{l.by}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}
        </div>
      )}

      {view === 'vat' && (
        <div className="grid" style={{ gap: 12 }}>
          {/* بطاقة الإعداد — قرار التفعيل بيد الإدارة، بأثر رجعي معلن */}
          <div className="card" style={{ borderColor: taxOn ? 'rgba(79,178,134,.45)' : 'rgba(224,164,88,.45)' }}>
            <div className="card-h">
              <div className="card-t"><Receipt size={15} color="var(--brass)" />إعداد ضريبة القيمة المضافة</div>
              <span className={'badge ' + (taxOn ? 'b-mint' : 'b-amber')}>{taxOn ? 'مفعّلة — ' + taxRate + '%' : 'غير مفعّلة'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 10 }}>
              عند التفعيل تُعامل مبالغك المسجلة (مبيعات ومصروفات موسومة «خاضعة») على أنها <b>شاملة الضريبة</b>،
              ويفصل المحرك المخرجات والمدخلات تلقائيًا في كل القيود <b>بأثر رجعي فوري</b> — لأن القيود تُشتق حسابيًا لا تُخزَّن.
              يمكن الإيقاف في أي وقت فتعود الأرقام إجمالية كما كانت.
            </div>
            {canTax ? (
              <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="نسبة الضريبة %" style={{ width: 120 }}>
                  <input className="inp n" inputMode="decimal" value={String(taxRate)} disabled={!canTax}
                    onChange={e => { const v = Number(e.target.value.replace(/[^\d.]/g, '')) || 0; if (v >= 0 && v <= 50) saveTax({ ...taxCfg, rate: v }, 'عدّل نسبة ضريبة القيمة المضافة', v + '%'); }} />
                </Field>
                {taxOn
                  ? <button className="btn no" onClick={() => saveTax({ ...taxCfg, enabled: false }, 'أوقف احتساب ضريبة القيمة المضافة', '')}>إيقاف الاحتساب</button>
                  : <button className="btn pri" onClick={() => saveTax({ ...taxCfg, enabled: true, rate: taxRate }, 'فعّل احتساب ضريبة القيمة المضافة', taxRate + '%')}><Check size={14} />تفعيل الاحتساب ({taxRate}%)</button>}
              </div>
            ) : <div className="note">تفعيل الضريبة وتعديل نسبتها صلاحية للإدارة العليا/مسؤول النظام فقط.</div>}
          </div>

          {taxOn && <>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {periodBar}
              <button className="btn sm" onClick={setQuarter}><CalendarDays size={13} />الربع الحالي</button>
            </div>
            <div className="grid g3">
              <Kpi label="ضريبة المخرجات (على مبيعاتك)" value={money(vsum.out)} sub={'من مبيعات صافية ' + money(vsum.netSales)} icon={TrendingUp} color="#4FB286" />
              <Kpi label="ضريبة المدخلات (على مشترياتك)" value={money(vsum.inn)} sub={'من مشتريات خاضعة صافية ' + money(vsum.netPurch)} icon={TrendingDown} color="#5B93C4" />
              <Kpi label={vatDue >= 0 ? 'صافي المستحق للهيئة' : 'صافي رصيد لصالحك'} value={money(Math.abs(vatDue))} sub={from || to ? 'للفترة المحددة' : 'كامل المدة'} icon={Receipt} color="#E0A458" />
            </div>
            <div className="card vcl">
              <div className="card-h">
                <div className="card-t"><Lock size={15} color="var(--brass)" />إقفال الفترة الضريبية والسداد</div>
                <span className={'badge ' + (vat2302 > 0.004 ? 'b-amber' : vat2302 < -0.004 ? 'b-mint' : 'b-dim')}>رصيد 2302: {vat2302 > 0.004 ? money(vat2302) + ' مستحق للهيئة' : vat2302 < -0.004 ? money(-vat2302) + ' دائن لصالحك' : 'صفر'}</span>
              </div>
              <div className="vcl-je">
                <div className="vcl-jh">قيد الإقفال للفترة {from && to ? <b>من <span className="num">{from}</span> إلى <span className="num">{to}</span></b> : <i>— حدّد الفترة</i>}</div>
                <div className="vcl-ln"><span>من ح/ 2301 ضريبة المخرجات</span><b className="num">{money(vsum.out)}</b><b /></div>
                <div className="vcl-ln cr"><span>إلى ح/ 1501 ضريبة المدخلات</span><b /><b className="num">{money(vsum.inn)}</b></div>
                <div className="vcl-ln cr"><span>إلى ح/ 2302 الضريبة المستحقة {vatDue < 0 ? '(مدين — رصيد مرحّل)' : ''}</span>{vatDue < 0 ? <b className="num">{money(-vatDue)}</b> : <b />}{vatDue >= 0 ? <b className="num">{money(vatDue)}</b> : <b />}</div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn pri" disabled={!!vcBlock} onClick={postVatClose}><Lock size={14} />إقفال الفترة وترحيل الصافي</button>
                {vcBlock ? <span className="hint" style={{ fontSize: 12, color: 'var(--faint)' }}>{vcBlock}</span> : <span style={{ fontSize: 12, color: 'var(--dim)' }}>المبالغ هي أرقام الإقرار أدناه حرفيًا</span>}
                {vcNextFrom && !from && <button className="btn sm gh" onClick={() => { setFrom(vcNextFrom); }}>ابدأ من {vcNextFrom}</button>}
              </div>
              {vatCloses.length > 0 && (
                <div className="tw" style={{ marginTop: 12 }}>
                  <table className="tb is-tb">
                    <thead><tr><th>الفترة</th><th style={{ textAlign: 'end' }}>مخرجات</th><th style={{ textAlign: 'end' }}>مدخلات</th><th style={{ textAlign: 'end' }}>الصافي</th><th style={{ textAlign: 'end' }}>المسدد</th><th>الحالة</th><th /></tr></thead>
                    <tbody>
                      {vatCloses.map((c, i) => { const v = c.vatClose; const paid = vcPaid(c.id); const rem = r2x(v.net - paid);
                        const st = v.net < 0 ? ['b-mint', 'رصيد دائن مرحّل'] : rem <= 0.004 ? ['b-mint', 'مسددة ✓'] : paid > 0 ? ['b-amber', 'مسددة جزئيًا'] : ['b-amber', 'بانتظار السداد'];
                        return (<tr key={c.id} className="is-line">
                          <td>من <span className="num">{v.from}</span> إلى <span className="num">{v.to}</span><div style={{ fontSize: 11, color: 'var(--faint)' }}>{c.by}</div></td>
                          <td className="is-amt"><span className="num">{fmtBal(v.out)}</span></td>
                          <td className="is-amt"><span className="num">{fmtBal(v.inn)}</span></td>
                          <td className={'is-amt' + (v.net < 0 ? ' neg' : '')}><span className="num">{fmtBal(v.net)}</span></td>
                          <td className="is-amt"><span className="num">{money(paid)}</span></td>
                          <td><span className={'badge ' + st[0]}>{st[1]}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {canPost && v.net > 0 && rem > 0.004 && <button className="btn sm" onClick={() => setVpay({ closeId: c.id, amount: String(rem), date: today(), acc: (cashAccts.find(a => a.code === '1201') || cashAccts[0] || {}).code || '', ref: '' })}>تسجيل السداد</button>}
                            {canPost && i === 0 && paid <= 0 && <button className="btn sm gh" onClick={() => undoVatClose(c)}>إلغاء الإقفال</button>}
                          </td>
                        </tr>); })}
                    </tbody>
                  </table>
                </div>)}
              {vpay && (() => { const c = vatCloses.find(x => x.id === vpay.closeId) || { vatClose: {} }; return (
                <div className="vcl-pay">
                  <b>سداد فترة من <span className="num">{c.vatClose.from}</span> إلى <span className="num">{c.vatClose.to}</span></b>
                  <div className="grid g4" style={{ gap: 8 }}>
                    <Field label="المبلغ"><input className="inp n" inputMode="decimal" value={vpay.amount} onChange={e => setVpay(v => ({ ...v, amount: e.target.value }))} /></Field>
                    <Field label="التاريخ"><input className="inp" type="date" value={vpay.date} onChange={e => setVpay(v => ({ ...v, date: e.target.value }))} /></Field>
                    <Field label="من حساب"><select className="inp" value={vpay.acc} onChange={e => setVpay(v => ({ ...v, acc: e.target.value }))}>{cashAccts.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select></Field>
                    <Field label="رقم السداد/الفاتورة (اختياري)"><input className="inp" value={vpay.ref} onChange={e => setVpay(v => ({ ...v, ref: e.target.value }))} /></Field>
                  </div>
                  <div className="row" style={{ gap: 8 }}><button className="btn pri" onClick={postVatPay}><Check size={14} />ترحيل قيد السداد</button><button className="btn gh" onClick={() => setVpay(null)}>إلغاء</button></div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>القيد: من ح/ 2302 الضريبة المستحقة — إلى ح/ {vpay.acc || '…'}</div>
                </div>); })()}
              {vcResid && (Math.abs(vcResid.out) > 0.009 || Math.abs(vcResid.inn) > 0.009) && (
                <div className="vck-i bad" style={{ marginTop: 10 }}><span>✗</span>بعد آخر إقفال ({lastCloseTo}) بقي في 2301 رصيد {fmtBal(vcResid.out)} وفي 1501 رصيد {fmtBal(vcResid.inn)} حتى ذلك التاريخ — يعني وجود قيود مباشرة على الحسابين خارج الإقرار (مثل سداد قديم قُيّد على 2301). صحّحها بقيد يدوي إلى 2302.</div>)}
              {vcResid && Math.abs(vcResid.out) <= 0.009 && Math.abs(vcResid.inn) <= 0.009 && (
                <div className="vck-i ok" style={{ marginTop: 10 }}><span>✓</span>حسابا المخرجات والمدخلات صفريان حتى آخر فترة مقفلة ({lastCloseTo}) — رصيدهما الحالي يخص الفترة الجارية فقط.</div>)}
            </div>
            <div className="card">
              <div className="card-h">
                <div className="card-t"><ShieldCheck size={15} color="var(--brass)" />فحوص المدقق قبل تقديم الإقرار</div>
                <span className={'badge ' + (vatChecks.some(c => c.s === 'bad') ? 'b-rose' : vatChecks.some(c => c.s === 'warn') ? 'b-amber' : 'b-mint')}>
                  {vatChecks.filter(c => c.s === 'bad').length ? vatChecks.filter(c => c.s === 'bad').length + ' ملاحظة جوهرية' : vatChecks.filter(c => c.s === 'warn').length ? vatChecks.filter(c => c.s === 'warn').length + ' تنبيه' : 'جاهز'}</span>
              </div>
              <div className="vck">{vatChecks.map((c, i) => <div key={i} className={'vck-i ' + c.s}><span>{c.s === 'ok' ? '✓' : c.s === 'bad' ? '✗' : '!'}</span>{c.t}</div>)}</div>
            </div>
            <div className="card">
              <div className="card-h">
                <div className="card-t"><FileText size={15} color="var(--brass)" />تفاصيل الإقرار الضريبي</div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={xlVAT}><Download size={13} />Excel كامل</button>
                  <button className="btn sm" onClick={printVAT}><Printer size={13} />طباعة الإقرار</button>
                </div>
              </div>
              <div className="vtabs" role="tablist">
                {[['form', 'نموذج الهيئة'], ['src', 'حسب المصدر'], ['br', 'حسب الفرع'], ['mon', 'حسب الشهر'], ['sup', 'الموردون'], ['tx', 'الحركات (' + vatX.tx.length + ')']].map(([k, l]) =>
                  <button key={k} type="button" role="tab" aria-selected={vatTab === k} className={'vtab' + (vatTab === k ? ' on' : '')} onClick={() => setVatTab(k)}>{l}</button>)}
              </div>
              <div className="tw" style={{ marginTop: 10 }}>
                {vatTab === 'form' && (
                  <table className="tb is-tb vat-tb">
                    <thead><tr><th style={{ width: 34 }}>#</th><th>البند</th><th style={{ textAlign: 'end' }}>المبلغ (ر.س)</th><th style={{ textAlign: 'end' }}>التعديلات</th><th style={{ textAlign: 'end' }}>الضريبة {taxRate}%</th></tr></thead>
                    <tbody>
                      {vatFormRows().map((r, i) => (
                        <tr key={i} className={r.net ? 'is-net' : r.tot ? 'is-total' : r.na ? 'vat-na' : 'is-line'}>
                          <td className="vat-n"><span className="num">{r.n}</span></td>
                          <td>{r.t}{r.na && <small className="vat-nat"> — غير مسجّل في المنصة</small>}</td>
                          <td className="is-amt">{!r.only && <span className="num">{fmtBal(r.a)}</span>}</td>
                          <td className={'is-amt' + (r.adj < 0 ? ' neg' : '')}>{!r.only && <span className="num">{fmtBal(r.adj)}</span>}</td>
                          <td className={'is-amt' + (r.v < 0 ? ' neg' : '')}><span className="num">{fmtBal(r.v)}</span></td>
                        </tr>))}
                    </tbody>
                  </table>)}
                {vatTab === 'src' && (
                  <table className="tb is-tb">
                    <thead><tr><th>المصدر</th><th style={{ textAlign: 'end' }}>عدد القيود</th><th style={{ textAlign: 'end' }}>الصافي</th><th style={{ textAlign: 'end' }}>ضريبة مخرجات</th><th style={{ textAlign: 'end' }}>ضريبة مدخلات</th></tr></thead>
                    <tbody>
                      {vatX.src.map(r => <tr key={r.k} className="is-line"><td>{r.k}</td><td className="is-amt"><span className="num">{r.n}</span></td><td className="is-amt"><span className="num">{fmtBal(r.net)}</span></td><td className="is-amt"><span className="num">{fmtBal(r.out)}</span></td><td className="is-amt"><span className="num">{fmtBal(r.inn)}</span></td></tr>)}
                      <tr className="is-total"><td>الإجمالي</td><td className="is-amt"><span className="num">{sum(vatX.src, r => r.n)}</span></td><td /><td className="is-amt"><span className="num">{money(vsum.out)}</span></td><td className="is-amt"><span className="num">{money(vsum.inn)}</span></td></tr>
                    </tbody>
                  </table>)}
                {vatTab === 'br' && (
                  <table className="tb is-tb">
                    <thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>مبيعات صافية</th><th style={{ textAlign: 'end' }}>ضريبة مخرجات</th><th style={{ textAlign: 'end' }}>مشتريات صافية</th><th style={{ textAlign: 'end' }}>ضريبة مدخلات</th><th style={{ textAlign: 'end' }}>الصافي</th></tr></thead>
                    <tbody>
                      {vatX.br.map(b => <tr key={b.name} className="is-line"><td>{b.name}</td><td className="is-amt"><span className="num">{fmtBal(b.ns)}</span></td><td className="is-amt"><span className="num">{fmtBal(b.out)}</span></td><td className="is-amt"><span className="num">{fmtBal(b.np)}</span></td><td className="is-amt"><span className="num">{fmtBal(b.inn)}</span></td><td className={'is-amt' + (b.out - b.inn < 0 ? ' neg' : '')}><span className="num">{fmtBal(r2x(b.out - b.inn))}</span></td></tr>)}
                      <tr className="is-total"><td>الإجمالي</td><td className="is-amt"><span className="num">{money(vsum.netSales)}</span></td><td className="is-amt"><span className="num">{money(vsum.out)}</span></td><td className="is-amt"><span className="num">{money(vsum.netPurch)}</span></td><td className="is-amt"><span className="num">{money(vsum.inn)}</span></td><td className={'is-amt' + (vatDue < 0 ? ' neg' : '')}><span className="num">{fmtBal(vatDue)}</span></td></tr>
                    </tbody>
                  </table>)}
                {vatTab === 'mon' && (
                  <table className="tb is-tb">
                    <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>مبيعات صافية</th><th style={{ textAlign: 'end' }}>ضريبة مخرجات</th><th style={{ textAlign: 'end' }}>ضريبة مدخلات</th><th style={{ textAlign: 'end' }}>الصافي</th><th style={{ textAlign: 'end' }}>النسبة الفعلية</th></tr></thead>
                    <tbody>
                      {vatX.mon.map(m => <tr key={m.k} className="is-line"><td><span className="num">{m.k}</span></td><td className="is-amt"><span className="num">{fmtBal(m.ns)}</span></td><td className="is-amt"><span className="num">{fmtBal(m.out)}</span></td><td className="is-amt"><span className="num">{fmtBal(m.inn)}</span></td><td className={'is-amt' + (m.out - m.inn < 0 ? ' neg' : '')}><span className="num">{fmtBal(r2x(m.out - m.inn))}</span></td><td className={'is-amt' + (m.ns > 0 && Math.abs(m.out / m.ns * 100 - taxRate) >= 0.15 ? ' neg' : '')}><span className="num">{m.ns > 0 ? (Math.round(m.out / m.ns * 10000) / 100) + '%' : '—'}</span></td></tr>)}
                      <tr className="is-total"><td>الإجمالي</td><td className="is-amt"><span className="num">{money(vsum.netSales)}</span></td><td className="is-amt"><span className="num">{money(vsum.out)}</span></td><td className="is-amt"><span className="num">{money(vsum.inn)}</span></td><td className={'is-amt' + (vatDue < 0 ? ' neg' : '')}><span className="num">{fmtBal(vatDue)}</span></td><td className="is-amt"><span className="num">{vatX.effRate == null ? '—' : vatX.effRate + '%'}</span></td></tr>
                    </tbody>
                  </table>)}
                {vatTab === 'sup' && (vatX.sup.length ? (
                  <table className="tb is-tb">
                    <thead><tr><th>المورد</th><th>الرقم الضريبي</th><th style={{ textAlign: 'end' }}>الفواتير</th><th style={{ textAlign: 'end' }}>مشتريات صافية</th><th style={{ textAlign: 'end' }}>ضريبة مدخلات</th></tr></thead>
                    <tbody>
                      {vatX.sup.map(u => <tr key={u.name} className={'is-line' + (u.vatNo ? '' : ' bad')}><td>{u.name}</td><td>{u.vatNo ? <span className="num">{u.vatNo}</span> : 'غير مسجّل ✗'}</td><td className="is-amt"><span className="num">{u.n}</span></td><td className="is-amt"><span className="num">{fmtBal(u.net)}</span></td><td className="is-amt"><span className="num">{fmtBal(u.vat)}</span></td></tr>)}
                    </tbody>
                  </table>) : <div className="empty">لا فواتير موردين بضريبة في الفترة.</div>)}
                {vatTab === 'tx' && (() => {
                  const qn = vatQ.trim(); const rows = vatX.tx.filter(t => !qn || (t.title + ' ' + t.party + ' ' + t.ref + ' ' + t.br + ' ' + t.src + ' ' + t.flag).includes(qn));
                  return (<>
                    <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <input className="inp" style={{ maxWidth: 280 }} placeholder="بحث: مورد، فرع، مرجع، «بلا إيصال»…" value={vatQ} onChange={e => setVatQ(e.target.value)} />
                      <span className="badge b-dim">{rows.length} حركة · مخرجات {money(sum(rows, t => t.out))} · مدخلات {money(sum(rows, t => t.inn))}</span>
                    </div>
                    <table className="tb is-tb">
                      <thead><tr><th>التاريخ</th><th>البيان</th><th>الفرع</th><th style={{ textAlign: 'end' }}>الصافي</th><th style={{ textAlign: 'end' }}>مخرجات</th><th style={{ textAlign: 'end' }}>مدخلات</th></tr></thead>
                      <tbody>
                        {rows.slice(0, 300).map((t, i) => <tr key={i} className={'is-line' + (t.flag ? ' flag' : '')}>
                          <td><span className="num">{t.date}</span></td>
                          <td>{t.title}{t.flag && <small className="vat-flag"> · {t.flag}</small>}</td>
                          <td>{t.br}</td>
                          <td className={'is-amt' + (t.ns + t.np < 0 ? ' neg' : '')}><span className="num">{fmtBal(r2x(t.ns + t.np))}</span></td>
                          <td className={'is-amt' + (t.out < 0 ? ' neg' : '')}><span className="num">{t.out ? fmtBal(t.out) : '—'}</span></td>
                          <td className={'is-amt' + (t.inn < 0 ? ' neg' : '')}><span className="num">{t.inn ? fmtBal(t.inn) : '—'}</span></td>
                        </tr>)}
                      </tbody>
                    </table>
                    {rows.length > 300 && <div className="note" style={{ marginTop: 8 }}>تُعرض أول 300 حركة — كل الحركات في ملف Excel.</div>}
                  </>);
                })()}
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                ⚠️ <b>بشفافية:</b> هذه مسودة تساعدك أنت ومحاسبك على تعبئة الإقرار في بوابة الهيئة — وليست تقديمًا رسميًا.
                البنود 2–5 و8–11 و14–15 لا تُسجَّل في المنصة حاليًا فتظهر صفرًا؛ أدخلها يدويًا في البوابة إن وُجدت لديك.
                مجموع كل التفاصيل (المصدر، الفرع، الشهر، الحركات) يساوي إجماليات الإقرار دائمًا لأنها من نفس القيود.
              </div>
            </div>
          </>}
          {!taxOn && <div className="card"><div className="empty">فعّل الاحتساب أعلاه لتظهر مؤشرات الضريبة ومسودة الإقرار من قيودك مباشرة.</div></div>}
        </div>
      )}

      {view === 'einv' && <EInvoiceOnboard org={org} me={me} commitOrg={commitOrg} say={say} />}
      {view === 'einv' && (
        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          <div className="card" style={{ borderColor: einvSellerVat ? 'rgba(79,178,134,.4)' : 'rgba(224,164,88,.5)' }}>
            <div className="card-h">
              <div className="card-t"><QrCode size={15} color="var(--brass)" />الفوترة الإلكترونية — رمز زاتكا (QR)</div>
              <span className={'badge ' + (einvSellerVat ? 'b-mint' : 'b-amber')}>{einvSellerVat ? 'جاهزة' : 'الرقم الضريبي ناقص'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9 }}>
              أنشئ <b>فاتورة ضريبية مبسّطة</b> (للأفراد B2C — بلا بيانات عميل) أو <b>فاتورة ضريبية</b> (للمنشآت B2B — ببيانات البائع والمشتري كاملة)،
              مع <b>رمز QR</b> متوافق مع المرحلة الأولى (اسم البائع، الرقم الضريبي، التاريخ، الإجمالي، الضريبة).
            </div>
            {!einvSellerVat && <div className="note" style={{ marginTop: 8 }}>⚠️ رمز زاتكا يتطلب <b>الرقم الضريبي للمنشأة</b>. أضِفه من <b>الإعدادات ← بيانات الشركة</b> ثم عُد هنا.</div>}
          </div>

          <div className="grid g2" style={{ gap: 12, alignItems: 'start' }}>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><FileText size={15} color="var(--brass)" />بيانات الفاتورة</div>
              <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button className={'btn sm' + (!einvIsStd ? ' pri' : ' gh')} onClick={() => setEinvF(f => ({ ...f, type: 'simplified' }))}>مبسّطة (للأفراد)</button>
                <button className={'btn sm' + (einvIsStd ? ' pri' : ' gh')} onClick={() => setEinvF(f => ({ ...f, type: 'standard' }))}>ضريبية (للمنشآت)</button>
              </div>
              <div className="mono-b" style={{ marginBottom: 10, flexDirection: 'column', alignItems: 'stretch', gap: 3 }}>
                <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>بيانات البائع (منشأتك)</div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{einvSeller || '— أضِف اسم الشركة من الإعدادات —'}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>الرقم الضريبي: <span className="num">{einvSellerVat || '—'}</span>{einvSellerCR ? ' · س.ت ' + einvSellerCR : ''}</div>
                {einvSellerAddr && <div style={{ fontSize: 11, color: 'var(--dim)' }}>العنوان: {einvSellerAddr}</div>}
              </div>
              {multiEntityOn(org) && (
                <div style={{ marginBottom: 10 }}>
                  <Field label="المنشأة المُصدِرة">
                    <select className="inp" value={einvF.entity} onChange={e => setEinvF(f => ({ ...f, entity: e.target.value }))}>
                      {entityList(org).map(en => <option key={en.id} value={en.id}>{en.name}{en.taxNumber ? ' — ' + en.taxNumber : ' (بلا رقم ضريبي)'}</option>)}
                    </select>
                  </Field>
                </div>
              )}
              <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button className={'btn sm' + (einvF.mode === 'gross' ? ' pri' : ' gh')} onClick={() => setEinvF(f => ({ ...f, mode: 'gross' }))}>المبلغ شامل الضريبة</button>
                <button className={'btn sm' + (einvF.mode === 'net' ? ' pri' : ' gh')} onClick={() => setEinvF(f => ({ ...f, mode: 'net' }))}>المبلغ قبل الضريبة</button>
              </div>
              <div className="grid g2" style={{ gap: 9 }}>
                <Field label={einvF.mode === 'gross' ? 'المبلغ شامل الضريبة (ر.س)' : 'المبلغ قبل الضريبة (ر.س)'}>
                  <input className="inp n" inputMode="decimal" value={einvF.amount} placeholder="0.00" onChange={e => setEinvF(f => ({ ...f, amount: e.target.value, closingId: '' }))} />
                </Field>
                <Field label="نسبة الضريبة"><input className="inp n" value={einvRate + '%'} disabled /></Field>
                <Field label="رقم الفاتورة (اختياري)"><input className="inp" value={einvF.invNo} placeholder={einvNo} onChange={e => setEinvF(f => ({ ...f, invNo: e.target.value }))} /></Field>
                <Field label="البيان"><input className="inp" value={einvF.desc} onChange={e => setEinvF(f => ({ ...f, desc: e.target.value }))} /></Field>
                <Field label="التاريخ"><input className="inp" type="date" value={einvF.date} onChange={e => setEinvF(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="الوقت (اختياري)"><input className="inp" type="time" value={einvF.time} onChange={e => setEinvF(f => ({ ...f, time: e.target.value }))} /></Field>
                {einvIsStd ? (
                  <Field label="اختر العميل (من دفتر الشركاء)">
                    <select className="inp" value={einvF.buyerId} onChange={e => { const c = einvCustomers.find(x => x.id === e.target.value); setEinvF(f => ({ ...f, buyerId: e.target.value, buyer: c ? c.name : f.buyer, buyerVat: c ? (c.vatNo || c.tax || '') : f.buyerVat, buyerAddress: c ? (c.address || '') : f.buyerAddress })); }}>
                      <option value="">— إدخال يدوي —</option>
                      {einvCustomers.map(c => <option key={c.id} value={c.id}>{c.name}{(c.vatNo || c.tax) ? ' — ' + (c.vatNo || c.tax) : ''}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="العميل (اختياري)"><input className="inp" value={einvF.buyer} placeholder="المبسّطة لا تتطلب بيانات العميل" onChange={e => setEinvF(f => ({ ...f, buyer: e.target.value }))} /></Field>
                )}
                <Field label="أو عبّئ المبلغ من إغلاق يوم">
                  <select className="inp" value={einvF.closingId} onChange={e => {
                    const id = e.target.value; const c = einvClosings.find(x => x.id === id);
                    setEinvF(f => ({ ...f, closingId: id, mode: 'gross', amount: c ? String(c.totalRevenue || 0) : f.amount, date: c ? (c.date || f.date) : f.date, desc: c ? ('مبيعات ' + (c.branchName || '')) : f.desc }));
                  }}>
                    <option value="">— بدون —</option>
                    {einvClosings.map(c => <option key={c.id} value={c.id}>{c.date} · {c.branchName || 'فرع'} · {money(c.totalRevenue || 0)}</option>)}
                  </select>
                </Field>
              </div>
              {einvIsStd && (
                <div className="grid g2" style={{ gap: 9, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                  <Field label="اسم المشتري"><input className="inp" value={einvF.buyer} onChange={e => setEinvF(f => ({ ...f, buyer: e.target.value }))} placeholder="اسم المنشأة المشترية" /></Field>
                  <Field label="الرقم الضريبي للمشتري"><input className="inp n" value={einvF.buyerVat} onChange={e => setEinvF(f => ({ ...f, buyerVat: e.target.value }))} placeholder="15 رقمًا" /></Field>
                  <Field label="عنوان المشتري" style={{ gridColumn: 'span 2' }}><input className="inp" value={einvF.buyerAddress} onChange={e => setEinvF(f => ({ ...f, buyerAddress: e.target.value }))} placeholder="المدينة، الحي، الشارع، الرمز البريدي" /></Field>
                  {(() => { const bc = einvCustomers.find(x => x.id === einvF.buyerId); const sm = naMissing(einvEnt.na || (einvEnt.primary ? (org.company || {}).na : null)); const bm = bc ? naMissing(bc.na) : [];
                    return (sm.length || bm.length) ? <div style={{ gridColumn: 'span 2', fontSize: 10.5, color: 'var(--amber)', lineHeight: 1.7 }}>
                      {sm.length ? <div>⚠ العنوان الوطني للمنشأة البائعة ناقص ({sm.join('، ')}) — يُكمَل من الإعدادات ← بيانات المنشأة.</div> : null}
                      {bm.length ? <div>⚠ العنوان الوطني للعميل ناقص ({bm.join('، ')}) — يُكمَل من جهات الاتصال.</div> : null}
                    </div> : null; })()}
                </div>
              )}
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-t" style={{ marginBottom: 10, justifyContent: 'center' }}><QrCode size={15} color="var(--brass)" />المعاينة الحيّة</div>
              {einvReady ? (
                <>
                  <div id="einv-qr" style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--frame-o)' }}
                    dangerouslySetInnerHTML={{ __html: qrSvg(einvB64, { ecl: 1, px: 240 }) }} />
                  <div className="grid g3" style={{ gap: 8, marginTop: 12 }}>
                    <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 10, padding: '8px 6px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>قبل الضريبة</div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 800 }}>{money(einvCalc.net)}</div>
                    </div>
                    <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 10, padding: '8px 6px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>الضريبة {einvRate}%</div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brass-l)' }}>{money(einvCalc.vat)}</div>
                    </div>
                    <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 10, padding: '8px 6px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>الإجمالي</div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--mint)' }}>{money(einvCalc.gross)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, textAlign: 'start', fontSize: 11.5, background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 11px', lineHeight: 1.9 }}>
                    <div><span style={{ color: 'var(--faint)' }}>البائع:</span> <b>{einvSeller || '—'}</b> · <span className="num">{einvSellerVat || '—'}</span></div>
                    {einvIsStd && <div><span style={{ color: 'var(--faint)' }}>المشتري:</span> <b>{einvF.buyer || '—'}</b>{einvF.buyerVat ? ' · ' : ''}<span className="num">{einvF.buyerVat}</span>{einvF.buyerAddress ? ' · ' + einvF.buyerAddress : ''}</div>}
                    <div><span style={{ color: 'var(--faint)' }}>النوع:</span> {einvIsStd ? 'فاتورة ضريبية (للمنشآت)' : 'فاتورة ضريبية مبسّطة (للأفراد)'} · رقم <span className="num">{einvNo}</span></div>
                  </div>
                  <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="btn pri" onClick={printEInv}><Printer size={14} />طباعة {einvIsStd ? 'الفاتورة الضريبية' : 'الفاتورة المبسّطة'}</button>
                    <button className="btn sm gh" onClick={() => setEinvRaw(v => !v)}>{einvRaw ? 'إخفاء' : 'إظهار'} سلسلة الترميز</button>
                  </div>
                  {einvRaw && <div data-einv-b64="1" style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', direction: 'ltr', textAlign: 'left', background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 8, padding: 10 }}>{einvB64}</div>}
                </>
              ) : (
                <div className="empty" style={{ padding: '30px 10px' }}>{einvSellerVat ? 'أدخل مبلغ الفاتورة لتظهر المعاينة ورمز QR.' : 'أضف الرقم الضريبي للمنشأة أولًا (الإعدادات ← بيانات الشركة).'}</div>
              )}
            </div>
          </div>

          <div className="note">
            💡 <b>بشفافية:</b> <b>المبسّطة</b> للبيع للأفراد (B2C) بلا بيانات عميل؛ <b>الضريبية</b> للمنشآت (B2B) وتُظهر بيانات البائع والمشتري كاملة (اختر العميل من دفتر الشركاء — بياناته الضريبية تُملأ تلقائيًا). كلاهما بـ<b>رمز QR</b> للمرحلة الأولى. لا تُخزَّن هنا كسجل رسمي ولا تُرسَل للهيئة — الربط المعتمد للمرحلة الثانية (بوابة «فاتورة») يتطلب شهادة رقمية وربطًا رسميًا منفصلًا.
          </div>
        </div>
      )}

      {view === 'zakat' && (() => {
        const num = (s) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;
        const capital = r2(accByCode['3101'] ? accByCode['3101'].balance : 0);
        const retained = r2(accByCode['3201'] ? accByCode['3201'].balance : 0);
        const netFixed = r2((accByCode['1701'] ? accByCode['1701'].balance : 0) + (accByCode['1791'] ? accByCode['1791'].balance : 0));
        const netProfit = r2(bsProfit); // v15: الربح غير المقفل فقط — يمنع ازدواج الاحتساب مع 3201 عند الإقفال السنوي
        const provisions = num(zkD.provisions), ltLoans = num(zkD.ltLoans), ltInvest = num(zkD.ltInvest);
        const additions = r2(capital + retained + provisions + ltLoans + netProfit);
        const deductions = r2(netFixed + ltInvest);
        let base = r2(additions - deductions);
        const floored = base < netProfit && netProfit > 0;
        if (floored) base = netProfit;
        base = r2(Math.max(base, 0));
        const rate = num(zkD.rate) || 2.5;
        const zakat = r2(base * rate / 100);
        // v15.1: نوع ملكية المنشأة — الزكاة على الحصة السعودية/الخليجية، وضريبة الدخل على الحصة الأجنبية
        const saudiShare = zkD.ownerType === 'foreign' ? 0 : (zkD.ownerType === 'mixed' ? Math.max(0, Math.min(100, num(zkD.saudiPct))) : 100);
        const foreignShare = r2(100 - saudiShare);
        const ownerLabel = zkD.ownerType === 'foreign' ? 'أجنبية بالكامل' : (zkD.ownerType === 'mixed' ? 'مختلطة' : 'سعودية/خليجية');
        const zakatDue = r2(zakat * saudiShare / 100);
        const incTaxRate = num(zkD.incomeTaxRate) || 20;
        const incTaxBase = r2(Math.max(0, netProfit));
        const incomeTax = r2(incTaxBase * foreignShare / 100 * incTaxRate / 100);
        const dueTotal = r2(zakatDue + incomeTax);
        const periodSub2 = (from || to) ? ((from || 'البداية') + ' ← ' + (to || today())) : 'كامل المدة حتى ' + today();
        const zkAdd = [['رأس المال (3101)', capital], ['الأرباح المبقاة (3201)', retained], ['المخصصات والاحتياطيات', provisions], ['القروض والالتزامات طويلة الأجل', ltLoans], ['صافي ربح الفترة (غير المقفل)', netProfit]];
        const zkDed = [['صافي الأصول الثابتة (1701/1791)', netFixed], ['الاستثمارات طويلة الأجل', ltInvest]];
        const saveZakat = async () => { await commitOrg(d => ({ ...d, zakatCfg: { rate, provisions, ltLoans, ltInvest, ownerType: zkD.ownerType, saudiPct: num(zkD.saudiPct), incomeTaxRate: incTaxRate } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'zakatCfg', need: 'edit', title: 'حفظ إعداد الزكاة والضريبة', details: ownerLabel + ' · زكاة ' + rate + '% · دخل ' + incTaxRate + '%' }); say('حُفظ الإعداد ✓'); };
        const zkTable = () => [['البند', 'المبلغ'], ['الإضافات (مصادر التمويل)', ''], ...zkAdd, ['إجمالي الإضافات', additions], ['المخصومات', ''], ...zkDed, ['إجمالي المخصومات', deductions], ['وعاء الزكاة', base], ['نسبة الزكاة %', rate], ['الزكاة على كامل الوعاء', zakat], ['نوع الملكية', ownerLabel], ['الحصة السعودية %', saudiShare], ['الزكاة المستحقة (حصة سعودية)', zakatDue], ['الحصة الأجنبية %', foreignShare], ['نسبة ضريبة الدخل %', incTaxRate], ['ضريبة الدخل المستحقة', incomeTax], ['الإجمالي المستحق (زكاة + دخل)', dueTotal]];
        const exportZakatXlsx = () => { try { const blob = makeXlsx([{ name: 'حاسبة الزكاة', rows: zkTable() }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'حاسبة_الزكاة.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّلت حاسبة الزكاة (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };
        const printZakat = () => {
          const rws = (arr) => arr.map(x => `<tr><td>${_xe(x[0])}</td><td class="n">${money(x[1])}</td></tr>`).join('');
          printA4(org, 'حاسبة الزكاة — وعاء مصادر الأموال', 'الفترة: ' + periodSub2 + ' · النسبة ' + rate + '%',
            `<table><thead><tr><th>الإضافات (مصادر التمويل)</th><th class="n">المبلغ</th></tr></thead><tbody>${rws(zkAdd)}<tr class="tot"><td>إجمالي الإضافات</td><td class="n">${money(additions)}</td></tr></tbody></table>
            <table><thead><tr><th>المخصومات</th><th class="n">المبلغ</th></tr></thead><tbody>${rws(zkDed)}<tr class="tot"><td>إجمالي المخصومات</td><td class="n">${money(deductions)}</td></tr></tbody></table>
            <table><tbody><tr class="tot"><td>وعاء الزكاة${floored ? ' (رُفع لصافي الربح)' : ''}</td><td class="n">${money(base)}</td></tr>
            <tr><td>الزكاة على كامل الوعاء (${rate}%)</td><td class="n">${money(zakat)}</td></tr>
            <tr><td>نوع الملكية</td><td class="n">${_xe(ownerLabel)}${zkD.ownerType !== 'saudi' ? ` (${saudiShare}% سعودي · ${foreignShare}% أجنبي)` : ''}</td></tr>
            ${saudiShare > 0 ? `<tr class="tot"><td>الزكاة المستحقة${saudiShare < 100 ? ` — حصة سعودية (${saudiShare}%)` : ''}</td><td class="n">${money(zakatDue)}</td></tr>` : ''}
            ${foreignShare > 0 ? `<tr class="tot"><td>ضريبة الدخل — حصة أجنبية (${foreignShare}% × ${incTaxRate}%)</td><td class="n">${money(incomeTax)}</td></tr>` : ''}
            <tr class="tot"><td>الإجمالي المستحق (زكاة + ضريبة دخل)</td><td class="n">${money(dueTotal)}</td></tr></tbody></table>
            <div class="box" style="margin-top:12px;font-size:10px;color:#777">تقدير استرشادي: الزكاة (2.5% على الحصة السعودية/الخليجية) وضريبة الدخل (على الحصة الأجنبية) بطريقة «مصادر الأموال». الإقرار الرسمي للهيئة يخضع لضوابط تفصيلية. راجع محاسبك.</div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
        };
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{periodBar}<span className="badge b-dim">الفترة: {periodSub2}</span></div>
              <div className="row" style={{ gap: 8 }}><button className="btn sm" onClick={printZakat}><Printer size={13} />طباعة</button><button className="btn sm" onClick={exportZakatXlsx}><Download size={13} />Excel</button></div>
            </div>
            <div className="grid g3">
              <Kpi label="الزكاة المستحقة (تقديري)" value={saudiShare > 0 ? money(zakatDue) : 'غير مطبّقة'} sub={saudiShare === 100 ? ('ملكية سعودية/خليجية · وعاء ' + money(base)) : (saudiShare > 0 ? ('على حصة ' + saudiShare + '% · وعاء ' + money(base)) : 'منشأة أجنبية — ضريبة دخل')} icon={Landmark} color="#4FB286" />
              <Kpi label="ضريبة الدخل المستحقة (تقديري)" value={foreignShare > 0 ? money(incomeTax) : 'غير مطبّقة'} sub={foreignShare > 0 ? ('حصة ' + foreignShare + '% × ' + incTaxRate + '% من صافي الربح') : 'لا حصة أجنبية'} icon={Receipt} color="#5B93C4" />
              <Kpi label="الإجمالي المستحق" value={money(dueTotal)} sub="زكاة + ضريبة دخل" icon={CircleDollarSign} color="#C8A24A" />
            </div>
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><FileText size={15} color="var(--brass)" />ورقة عمل وعاء الزكاة</div>
                <div className="tw"><table className="tb"><tbody>
                  <tr style={{ fontWeight: 800, background: 'rgba(79,178,134,.06)' }}><td colSpan={2}>الإضافات (مصادر التمويل)</td></tr>
                  {zkAdd.map((x, i) => <tr key={'a' + i}><td>{x[0]}</td><td className="num" style={{ textAlign: 'end' }}>{money(x[1])}</td></tr>)}
                  <tr style={{ fontWeight: 700 }}><td>إجمالي الإضافات</td><td className="num" style={{ textAlign: 'end' }}>{money(additions)}</td></tr>
                  <tr style={{ fontWeight: 800, background: 'rgba(217,84,77,.06)' }}><td colSpan={2}>المخصومات</td></tr>
                  {zkDed.map((x, i) => <tr key={'d' + i}><td>{x[0]}</td><td className="num" style={{ textAlign: 'end' }}>({money(x[1])})</td></tr>)}
                  <tr style={{ fontWeight: 700 }}><td>إجمالي المخصومات</td><td className="num" style={{ textAlign: 'end' }}>({money(deductions)})</td></tr>
                  <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.08)' }}><td>وعاء الزكاة{floored ? ' (رُفع لصافي الربح)' : ''}</td><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)', fontSize: 14 }}>{money(base)}</td></tr>
                  <tr style={{ fontWeight: 700 }}><td>الزكاة على كامل الوعاء ({rate}%)</td><td className="num" style={{ textAlign: 'end', color: 'var(--dim)', fontSize: 13 }}>{money(zakat)}</td></tr>
                  <tr><td>نوع الملكية</td><td className="num" style={{ textAlign: 'end' }}>{ownerLabel}{zkD.ownerType !== 'saudi' ? ' (' + saudiShare + '% سعودي · ' + foreignShare + '% أجنبي)' : ''}</td></tr>
                  {saudiShare > 0 && <tr style={{ fontWeight: 900, background: 'rgba(79,178,134,.08)' }}><td>الزكاة المستحقة{saudiShare < 100 ? ' — حصة الملكية السعودية (' + saudiShare + '%)' : ''}</td><td className="num" style={{ textAlign: 'end', color: 'var(--mint)', fontSize: 14 }}>{money(zakatDue)}</td></tr>}
                  {foreignShare > 0 && <tr style={{ fontWeight: 900, background: 'rgba(91,147,196,.08)' }}><td>ضريبة الدخل المستحقة — الحصة الأجنبية ({foreignShare}% × {incTaxRate}%)</td><td className="num" style={{ textAlign: 'end', color: 'var(--sky)', fontSize: 14 }}>{money(incomeTax)}</td></tr>}
                  {foreignShare > 0 && saudiShare > 0 && <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.08)' }}><td>الإجمالي المستحق (زكاة + ضريبة دخل)</td><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)', fontSize: 14 }}>{money(dueTotal)}</td></tr>}
                </tbody></table></div>
              </div>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 10 }}><Settings size={15} color="var(--brass)" />بنود يدوية وإعداد</div>
                {canEdit ? <>
                  <div className="grid g2" style={{ gap: 9, marginBottom: 9 }}>
                    <Field label="نوع ملكية المنشأة"><select className="inp sel" value={zkD.ownerType} onChange={e => setZkD(s => ({ ...s, ownerType: e.target.value }))}>
                      <option value="saudi">سعودية/خليجية — زكاة كاملة</option>
                      <option value="mixed">مختلطة — زكاة + ضريبة دخل</option>
                      <option value="foreign">أجنبية بالكامل — ضريبة دخل فقط</option>
                    </select></Field>
                    {zkD.ownerType === 'mixed' && <Field label="نسبة الملكية السعودية/الخليجية %"><input className="inp n" inputMode="decimal" value={zkD.saudiPct} onChange={e => setZkD(s => ({ ...s, saudiPct: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
                    {zkD.ownerType !== 'saudi' && <Field label="نسبة ضريبة الدخل %"><input className="inp n" inputMode="decimal" value={zkD.incomeTaxRate} onChange={e => setZkD(s => ({ ...s, incomeTaxRate: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
                  </div>
                  <div className="grid g2" style={{ gap: 9 }}>
                    <Field label="المخصصات والاحتياطيات"><input className="inp n" inputMode="decimal" value={zkD.provisions} placeholder="0" onChange={e => setZkD(s => ({ ...s, provisions: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                    <Field label="قروض والتزامات طويلة الأجل"><input className="inp n" inputMode="decimal" value={zkD.ltLoans} placeholder="0" onChange={e => setZkD(s => ({ ...s, ltLoans: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                    <Field label="الاستثمارات طويلة الأجل"><input className="inp n" inputMode="decimal" value={zkD.ltInvest} placeholder="0" onChange={e => setZkD(s => ({ ...s, ltInvest: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                    <Field label="نسبة الزكاة %"><input className="inp n" inputMode="decimal" value={zkD.rate} onChange={e => setZkD(s => ({ ...s, rate: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                  </div>
                  <button className="btn pri" style={{ marginTop: 10 }} onClick={saveZakat}><Check size={14} />حفظ الإعداد</button>
                </> : <div className="note">تعديل بنود الزكاة صلاحية للإدارة/المالية. البنود المشتقة من الحسابات تظهر تلقائيًا.</div>}
                <div className="note" style={{ marginTop: 10 }}>البنود المشتقة (رأس المال، الأرباح المبقاة، الأصول الثابتة، صافي الربح) تأتي من قيودك تلقائيًا. أضِف يدويًا ما لا يظهر في الحسابات (قروض/استثمارات/مخصصات).</div>
              </div>
            </div>
            <div className="note">⚠️ <b>بشفافية:</b> حاسبة <b>استرشادية</b> بطريقة «مصادر الأموال». تُطبَّق حسب <b>نوع الملكية</b>: الزكاة (2.5%) على الحصة السعودية/الخليجية، و<b>ضريبة الدخل</b> (20% افتراضيًا) على الحصة الأجنبية من صافي الربح. المنشأة الأجنبية بالكامل تخضع لضريبة الدخل فقط، والسعودية للزكاة فقط. ليست إقرارًا رسميًا — الوعاء الرسمي يخضع لضوابط الهيئة، والوعاء لا يقل عن صافي الربح المعدّل (طُبّق تلقائيًا). راجِع محاسبك.</div>
          </div>
        );
      })()}

      {view === 'ast' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="grid g3" style={{ flex: 1, minWidth: 280 }}>
              <Kpi label="تكلفة الأصول القائمة" value={money(sum(A.assetRows.filter(a => !a.disposed), a => a.cost))} sub={A.assetRows.filter(a => !a.disposed).length + ' أصلاً قائماً' + (A.assetRows.some(a => a.disposed) ? ' · ' + A.assetRows.filter(a => a.disposed).length + ' مُستبعَد' : '')} icon={Building2} color="#C8A24A" />
              <Kpi label="مجمّع الإهلاك" value={money(sum(A.assetRows.filter(a => !a.disposed), a => a.accum))} sub="قسط ثابت شهري تلقائي" icon={TrendingDown} color="#E0A458" />
              <Kpi label="القيمة الدفترية" value={money(sum(A.assetRows.filter(a => !a.disposed), a => a.book))} sub="للأصول القائمة (التكلفة − المجمّع)" icon={Scale} color="#4FB286" />
            </div>
            <div className="row" style={{ gap: 8, alignSelf: 'flex-start' }}>
              <button className="btn sm" onClick={printAST}><Printer size={13} />طباعة السجل</button>
              {canPost && <button className="btn pri" onClick={() => setAstF({ name: '', cost: '', buyDate: today(), lifeYears: '5', fund: '1201', note: '' })}><Plus size={14} />أصل جديد</button>}
            </div>
          </div>
          <div className="card">
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الأصل</th><th>الشراء</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>القسط الشهري</th><th style={{ textAlign: 'end' }}>المجمّع</th><th style={{ textAlign: 'end' }}>الدفترية</th><th>الحالة</th><th /></tr></thead>
                <tbody>
                  {A.assetRows.map(a => (
                    <tr key={a.id} style={a.disposed ? { opacity: .62 } : null}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{a.name}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{a.lifeYears} سنة · {a.fund === 'none' ? 'بلا قيد شراء (مسجل سابقاً)' : 'التمويل: ' + ((({ '1101': 'الخزينة', '1201': 'البنك', '3101': 'افتتاحي' })[a.fund]) || '')}</div></td>
                      <td className="num" style={{ fontSize: 11 }}>{a.buyDate}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(a.cost)}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(a.monthly)}</td>
                      <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{money(a.accum)}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{a.disposed ? '—' : money(a.book)}</td>
                      <td>{a.disposed
                        ? <span className="badge b-dim" title={'بيع ' + money(a.salePrice) + ' بتاريخ ' + a.disposedDate}>مُستبعَد · {a.disposedDate}{Math.abs(a.gain) >= 0.005 ? <b style={{ marginInlineStart: 4, color: a.gain > 0 ? 'var(--mint)' : 'var(--rose)' }}>{a.gain > 0 ? 'ربح ' : 'خسارة '}{money(Math.abs(a.gain))}</b> : ''}</span>
                        : a.done ? <span className="badge b-dim">مُهلك بالكامل</span> : <span className="badge b-mint">قيد الإهلاك · {a.monthsDone}/{a.nM} شهراً</span>}</td>
                      <td><div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>{canEdit && (a.disposed
                        ? <button className="btn sm gh" onClick={() => undoDispose(a.id)}>تراجع</button>
                        : <>
                          <button className="btn sm gh" onClick={() => setAstF({ ...a, cost: String(a.cost), lifeYears: String(a.lifeYears) })}>تعديل</button>
                          {a.fund !== 'none' && <button className="btn sm" onClick={() => setDspF({ id: a.id, name: a.name, disposedDate: today(), salePrice: '', saleFund: '1201' })}>بيع/استبعاد</button>}
                        </>)}</div></td>
                    </tr>
                  ))}
                  {A.assetRows.length === 0 && <tr><td colSpan={8}><div className="empty">سجّل أصولك الثابتة (معدات المطبخ، الأثاث، السيارات…) لتتولد قيود شرائها وإهلاكها تلقائياً.</div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 10 }}>الإهلاك قسط ثابت يبدأ من الشهر التالي للشراء ويتوقف باكتمال العمر — قيد مجمّع واحد شهرياً في اليومية. تعديل الأصل يعيد اشتقاق إهلاكه كاملاً (القيود محسوبة لا مخزنة). <b style={{ color: 'var(--brass-l)' }}>البيع/الاستبعاد</b>: يتوقف الإهلاك عند شهر البيع، ويتولّد قيد إقفال متوازن يُخرج الأصل ومجمّعه ويحتسب الفرق مع سعر البيع ربحًا (4201) أو خسارة (5801) تلقائيًا.</div>
          </div>
        </div>
      )}

      {view === 'mizan' && viewOK('mizan') && <MizanMerge org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} A={A} />}
      {view === 'bank' && (
        <div className="grid" style={{ gap: 12 }}>
          {brBanks.length > 0 && (
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="lbl" style={{ margin: 0 }}>البنك محل التسوية:</span>
              <select className="sel" style={{ width: 'auto' }} value={brAcc} onChange={e => setBrAcc(e.target.value)}>
                <option value="1201">البنك التجميعي (1201)</option>
                {brBanks.map(bb => <option key={bb.code} value={bb.code}>{bb.name} ({bb.code})</option>)}
              </select>
            </div>
          )}
          {/* ═══ v16.7: وسيط الشبكة تحت التسوية ═══ */}
          <div className="card" style={{ background: 'rgba(200,162,74,.05)', borderColor: 'var(--frame)' }}>
            <div className="card-h" style={{ marginBottom: 6 }}>
              <div className="card-t" style={{ fontSize: 14 }}><ArrowLeftRight size={15} color="var(--brass)" />وسيط الشبكة تحت التسوية{pcCfgUi.enabled ? '' : ' — غير مفعّل'}</div>
              {pcCfgUi.enabled && <span className="badge b-mint">مفعّل من {pcCfgUi.from}</span>}
            </div>
            <div className="note" style={{ marginBottom: 10 }}>
              عند التفعيل: مبيعات <b>الشبكة</b> تُقيَّد في حساب وسيط لكل بنك بدل دخول البنك مباشرة (لأن البنك يسوّيها
              بعد يوم أو أكثر وبخصم رسومه)، ثم <b>تُقفل في البنك من هنا عند المطابقة</b> مع الكشف. النقد والتحويل
              البنكي المباشر لا يتغيّران، والتاريخ الأقدم من شهر السريان يبقى كما هو تمامًا.
            </div>
            {canEditMe && (
              <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label className="row" style={{ gap: 7, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pcF.enabled} onChange={e => setPcF(f => ({ ...f, enabled: e.target.checked }))} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>تفعيل وسيط الشبكة</span>
                </label>
                <Field label="يسري من شهر" style={{ width: 160, marginBottom: 0 }}>
                  <input type="month" className="inp" value={pcF.from} onChange={e => setPcF(f => ({ ...f, from: e.target.value }))} />
                </Field>
                <button className="btn pri" onClick={savePc}><Check size={14} />حفظ الإعداد</button>
              </div>
            )}
            {pcCfgUi.enabled && (
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="badge b-brass">رصيد وسيط {bankLabel(brAcc)}: <span className="num">{money(clrBal)}</span> ر.س</span>
                {clrBal > 0.009 && <span className="badge b-amber">شبكة لم يسوّها البنك بعد — طابِق ثم أقفِل أدناه</span>}
                {Math.abs(clrBal) <= 0.009 && <span className="badge b-mint">الوسيط مُقفل بالكامل ✓</span>}
              </div>
            )}
          </div>

          {/* ═══ v16.7: رفع كشف البنك والمطابقة الآلية ═══ */}
          {canPost && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><FileBarChart size={15} color="var(--brass)" />مطابقة كشف {bankLabel(brAcc)} — ارفع الملف واعرف الفارق أين</div>
              <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="شهر المطابقة" style={{ width: 150, marginBottom: 0 }}>
                  <input type="month" className="inp" value={stMonth} onChange={e => { setStMonth(e.target.value); setStMatch(null); }} />
                </Field>
                <div>
                  <input type="file" accept=".csv,.xlsx,.sta,.mt940,.940,.txt,text/csv,text/plain" style={{ display: 'none' }} id="stfile" onChange={stPick} />
                  <button className="btn" onClick={() => document.getElementById('stfile').click()}><Download size={14} />رفع كشف البنك (Excel / CSV / MT940)</button>
                </div>
                {stF && <span className="badge b-dim" style={{ direction: 'ltr' }}>{stF.name}</span>}
                {stF && <button className="btn pri" onClick={stRun}><Scale size={14} />مطابقة الشبكة</button>}
                {stF && <button className="btn" onClick={stFull}><Scale size={14} />مطابقة شاملة لكل الحركات</button>}
              </div>
              {stF && !stF.auto && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px dashed var(--line-g)' }}>
                  <div className="lbl">لم أتعرّف على أعمدة الكشف تلقائيًا — حدّدها يدويًا (رقم العمود يبدأ من 1 يمينًا في الملف):</div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {[['date', 'عمود التاريخ'], ['credit', 'عمود الإيداع (دائن)'], ['debit', 'عمود السحب (مدين)'], ['amount', 'أو عمود المبلغ'], ['desc', 'عمود الوصف (اختياري)']].map(([k, lb]) => (
                      <Field key={k} label={lb} style={{ width: 140, marginBottom: 0 }}>
                        <select className="sel" value={stF.map[k]} onChange={e => setStF(s => ({ ...s, map: { ...s.map, [k]: Number(e.target.value) } }))}>
                          <option value={-1}>—</option>
                          {(stF.grid[0] || []).map((_, ci) => <option key={ci} value={ci}>عمود {ci + 1}{stF.grid[stF.map.start] ? ' · ' + String(stF.grid[stF.map.start][ci] ?? '').slice(0, 14) : ''}</option>)}
                        </select>
                      </Field>
                    ))}
                    <Field label="أول صف بيانات" style={{ width: 110, marginBottom: 0 }}>
                      <input className="inp n" inputMode="numeric" value={stF.map.start + 1} onChange={e => setStF(s => ({ ...s, map: { ...s.map, start: Math.max(0, (Number(e.target.value) || 1) - 1) } }))} />
                    </Field>
                  </div>
                </div>
              )}
              {fullM && (
                <div style={{ marginTop: 12 }}>
                  <div className="grid g4" style={{ gap: 9 }}>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>حركات الكشف — {fullM.month}</span><span className="num">{fullM.bank}</span></div>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>تطابقت تلقائيًا</span><span className="num" style={{ color: 'var(--mint)' }}>{fullM.matched.length}</span></div>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>رصيد الدفتر آخر الشهر</span><span className="num">{money(fullM.bookEnd)}</span></div>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>رصيد الكشف المتوقع</span><span className="num" style={{ color: 'var(--brass)' }}>{money(fullM.expStmt)}</span></div>
                  </div>
                  {stF && stF.mt940 && stF.mt940.close && (() => { const d = Math.round((stF.mt940.close.amount - fullM.expStmt) * 100) / 100; const ok = Math.abs(d) < 0.01; return (
                    <div className="mono-b" style={{ marginTop: 8, borderColor: ok ? 'rgba(79,178,134,.5)' : 'rgba(217,84,77,.5)' }}>
                      <span style={{ fontSize: 11.5 }}>الرصيد الختامي من البنك ({stF.mt940.close.date}{stF.mt940.close.date.slice(0, 7) !== fullM.month ? ' — تأكد أن الكشف لشهر ' + fullM.month : ''})</span>
                      <span className="num" style={{ color: ok ? 'var(--mint)' : 'var(--rose)' }}>{money(stF.mt940.close.amount)} {ok ? '— التسوية مكتملة ✓' : '— الفرق ' + money(d)}</span>
                    </div>); })()}
                  <div className="note" style={{ marginTop: 6 }}>قارن «رصيد الكشف المتوقع» برصيد آخر يوم في كشفك: إن تساويا فالتسوية مكتملة. الفرق يعني سطرًا غير مقروء أو قيدًا بمبلغ مختلف.</div>
                  {fullM.bankUn.length > 0 && <>
                    <div className="lbl" style={{ marginTop: 10 }}>في الكشف وغير مقيّد في الدفاتر ({fullM.bankUn.length}) — قيّده بضغطة</div>
                    <div className="tw"><table className="tb"><tbody>
                      {fullM.bankUn.map(x => (
                        <tr key={x.i}><td className="num" style={{ fontSize: 11.5 }}>{x.date}</td><td style={{ fontSize: 12 }}>{x.desc || '—'}</td>
                          <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: x.amount < 0 ? 'var(--rose)' : 'var(--mint)' }}>{money(x.amount)}</td>
                          <td><select className="sel" style={{ minWidth: 170 }} value={fixAcc[x.i] || ''} onChange={e => setFixAcc(f => ({ ...f, [x.i]: e.target.value }))}>
                            <option value="">— الحساب المقابل —</option>{accOpts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></td>
                          <td><button className="btn sm pri" onClick={() => postFix(x)}>قيّد</button></td></tr>))}
                    </tbody></table></div></>}
                  {fullM.bookUn.length > 0 && <>
                    <div className="lbl" style={{ marginTop: 10 }}>مقيّد في الدفاتر ولم يظهر في الكشف ({fullM.bookUn.length}) — شيكات معلّقة أو إيداعات في الطريق أو أخطاء</div>
                    <div className="tw"><table className="tb"><tbody>
                      {fullM.bookUn.map(b => <tr key={b.id}><td className="num" style={{ fontSize: 11.5 }}>{b.date}</td><td style={{ fontSize: 12 }}>{b.title}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(b.amount)}</td></tr>)}
                    </tbody></table></div></>}
                  {!fullM.bankUn.length && !fullM.bookUn.length && <div className="note" style={{ color: 'var(--mint)', marginTop: 8 }}>✓ كل حركات الكشف تطابقت مع الدفاتر.</div>}
                </div>
              )}
              {stMatch && (
                <div style={{ marginTop: 12 }}>
                  <div className="grid g4" style={{ gap: 9 }}>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>شبكة النظام — {stMatch.month}</span><span className="num" style={{ color: 'var(--brass)' }}>{money(stMatch.sysTotal)}</span></div>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>إيداعات الكشف</span><span className="num">{money(stMatch.bankTotal)}</span></div>
                    <div className="mono-b"><span style={{ fontSize: 11 }}>تطابق تلقائيًا</span><span className="num" style={{ color: 'var(--mint)' }}>{money(stMatch.matchedTotal)}</span></div>
                    <div className="mono-b" style={{ borderColor: Math.abs(stMatch.diff) < 0.01 ? 'rgba(79,178,134,.4)' : 'rgba(217,84,77,.4)' }}>
                      <span style={{ fontSize: 11 }}>الفارق</span>
                      <span className="num" style={{ color: Math.abs(stMatch.diff) < 0.01 ? 'var(--mint)' : 'var(--rose)' }}>{Math.abs(stMatch.diff) < 0.01 ? 'مطابق ✓' : money(stMatch.diff)}</span>
                    </div>
                  </div>
                  {(stMatch.sysUn.length > 0 || stMatch.bankUn.length > 0) ? (
                    <div className="grid g2" style={{ gap: 10, marginTop: 10 }}>
                      <div>
                        <div className="lbl" style={{ color: 'var(--rose)' }}>⚠ في النظام ولم تظهر في الكشف ({stMatch.sysUn.length}) — شبكة لم يسوّها البنك بعد أو سُوّيت بخصم رسوم</div>
                        {stMatch.sysUn.length ? (
                          <div className="tw"><table className="tb" style={{ minWidth: 0 }}>
                            <thead><tr><th>يوم البيع</th><th style={{ textAlign: 'end' }}>شبكة النظام</th></tr></thead>
                            <tbody>{stMatch.sysUn.map(s => <tr key={s.date}><td className="num" style={{ fontSize: 11 }}>{s.date}</td><td className="num" style={{ textAlign: 'end' }}>{money(s.amount)}</td></tr>)}</tbody>
                          </table></div>
                        ) : <div className="empty" style={{ padding: 12 }}>لا شيء — كل أيام النظام وجدت مقابلها ✓</div>}
                      </div>
                      <div>
                        <div className="lbl" style={{ color: 'var(--amber)' }}>⚠ في الكشف بلا مقابل في النظام ({stMatch.bankUn.length}) — إيداعات أخرى أو تسويات مجمّعة/منقوصة الرسوم</div>
                        {stMatch.bankUn.length ? (
                          <div className="tw"><table className="tb" style={{ minWidth: 0 }}>
                            <thead><tr><th>تاريخ الإيداع</th><th>الوصف</th><th style={{ textAlign: 'end' }}>المبلغ</th></tr></thead>
                            <tbody>{stMatch.bankUn.map((x, i) => <tr key={i}><td className="num" style={{ fontSize: 11 }}>{x.date}</td><td style={{ fontSize: 11, color: 'var(--dim)' }}>{x.desc || '—'}</td><td className="num" style={{ textAlign: 'end' }}>{money(x.amount)}</td></tr>)}</tbody>
                          </table></div>
                        ) : <div className="empty" style={{ padding: 12 }}>لا شيء — كل إيداعات الكشف وجدت مقابلها ✓</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="note" style={{ marginTop: 10 }}>🎉 مطابقة كاملة — كل أيام شبكة النظام وجدت إيداعاتها في الكشف والعكس.</div>
                  )}
                  {pcCfgUi.enabled && (
                    <div className="row" style={{ gap: 9, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 12px', borderRadius: 10, background: 'var(--acc-soft)', border: '1px solid var(--frame-o)' }}>
                      <b style={{ fontSize: 12.5 }}>إقفال المطابَق في البنك:</b>
                      <Field label="المبلغ" style={{ width: 140, marginBottom: 0 }}>
                        <input className="inp n" inputMode="decimal" value={clsAmt} onChange={e => setClsAmt(e.target.value.replace(/[^\d.]/g, ''))} />
                      </Field>
                      <Field label="بتاريخ" style={{ width: 145, marginBottom: 0 }}>
                        <input type="date" className="inp" value={clsDate} onChange={e => setClsDate(e.target.value)} />
                      </Field>
                      <button className="btn pri" onClick={postClearingClose}><Check size={14} />قيد الإقفال (بنك من وسيط)</button>
                      <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>رصيد الوسيط الحالي: <span className="num">{money(clrBal)}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid g3">
            <Kpi label={'رصيد ' + bankLabel(brAcc) + ' بالدفاتر (' + brAcc + ')'} value={money(bankBookAt(''))} sub={brAcc === '1201' ? 'الشبكة والمدفوعات البنكية — تجميعي' : 'تحصيلات الشبكة والتحويل بالفرع'} icon={Landmark} color="#C8A24A" />
            <Kpi label={lastRec ? 'آخر تسوية موثقة' : 'لا تسويات بعد'} value={lastRec ? money(lastRec.stmtBalance) : '—'} sub={lastRec ? lastRec.date + ' · بواسطة ' + lastRec.by : 'ابدأ أول تسوية أدناه'} icon={ClipboardCheck} color="#5B93C4" />
            <Kpi label={lastRec ? 'فرق آخر تسوية' : 'الفرق'} value={lastRec ? money(Math.abs(lastRec.diff)) : '—'} sub={lastRec ? (Math.abs(lastRec.diff) < 0.01 ? 'مطابق تماماً ✓' : lastRec.diff > 0 ? 'الكشف أعلى من الدفتر' : 'الدفتر أعلى من الكشف') : ''} icon={Scale} color={lastRec && Math.abs(lastRec.diff) >= 0.01 ? '#D9544D' : '#4FB286'} />
          </div>
          {canPost && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><Landmark size={15} color="var(--brass)" />تسوية جديدة — أدخل رصيد كشف البنك الفعلي</div>
              <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="بتاريخ" style={{ width: 150 }}><input type="date" className="inp" value={brF.date} onChange={e => setBrF(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="رصيد كشف البنك" style={{ width: 160 }}><input className="inp n" inputMode="decimal" value={brF.stmt} onChange={e => setBrF(f => ({ ...f, stmt: e.target.value.replace(/[^\d.-]/g, '') }))} /></Field>
                <Field label="ملاحظة (اختياري)" style={{ flex: 1, minWidth: 160 }}><input className="inp" value={brF.note} placeholder="عمولات بنكية لم تُقيّد…" onChange={e => setBrF(f => ({ ...f, note: e.target.value }))} /></Field>
                <button className="btn pri" onClick={saveBankRec}><Check size={14} />توثيق التسوية</button>
              </div>
              {brF.stmt !== '' && (
                <div className="note" style={{ marginTop: 10 }}>
                  رصيد الدفتر بتاريخ {brF.date}: <b className="num">{money(bankBookAt(brF.date))}</b> · الفرق مع الكشف:
                  <b className="num" style={{ color: Math.abs((Number(brF.stmt) || 0) - bankBookAt(brF.date)) < 0.01 ? 'var(--mint)' : 'var(--rose)', marginInlineStart: 5 }}>
                    {money((Number(brF.stmt) || 0) - bankBookAt(brF.date))}</b> — عالج الفرق (عمولات بنك، فروق تحصيل الشبكة…) بزر «قيد يدوي / افتتاحي».
                </div>
              )}
            </div>
          )}
          {(ops.bankRecs || []).length > 0 && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />سجل التسويات</div>
              <div className="tw"><table className="tb">
                <thead><tr><th>التاريخ</th><th>البنك</th><th style={{ textAlign: 'end' }}>كشف البنك</th><th style={{ textAlign: 'end' }}>الدفتر</th><th style={{ textAlign: 'end' }}>الفرق</th><th>ملاحظة</th><th>بواسطة</th></tr></thead>
                <tbody>{(ops.bankRecs || []).map(r => (
                  <tr key={r.id}>
                    <td className="num" style={{ fontSize: 11 }}>{r.date}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{bankLabel(r.acc)}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{money(r.stmtBalance)}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{money(r.bookBalance)}</td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: Math.abs(r.diff) < 0.01 ? 'var(--mint)' : 'var(--rose)' }}>{Math.abs(r.diff) < 0.01 ? 'مطابق ✓' : money(r.diff)}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{r.note || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--faint)' }}>{r.by}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><ArrowLeftRight size={15} color="var(--brass)" />حركات {bankLabel(brAcc)} (أحدث 60)</div>
            <div className="tw"><table className="tb">
              <thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>وارد</th><th style={{ textAlign: 'end' }}>صادر</th></tr></thead>
              <tbody>{bankMoves.map(e => (
                <tr key={e.id}>
                  <td className="num" style={{ fontSize: 11 }}>{e.date}</td>
                  <td style={{ fontSize: 12 }}>{e.title}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{e.bankD ? money(e.bankD) : '—'}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{e.bankC ? money(e.bankC) : '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
      )}

      {astF && (
        <Modal title={astF.id ? 'تعديل أصل ثابت' : 'أصل ثابت جديد'} icon={Building2} onClose={() => setAstF(null)}
          foot={<><button className="btn gh" onClick={() => setAstF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveAst}><Check size={14} />حفظ الأصل</button></>}>
          <Field label="اسم الأصل"><input className="inp" value={astF.name} placeholder="فرن مطبخ · ثلاجة عرض · سيارة توصيل…" onChange={e => setAstF(f => ({ ...f, name: e.target.value }))} /></Field>
          <div className="grid g3">
            <Field label="التكلفة"><input className="inp n" inputMode="decimal" value={astF.cost} onChange={e => setAstF(f => ({ ...f, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="تاريخ الشراء"><input type="date" className="inp" value={astF.buyDate} onChange={e => setAstF(f => ({ ...f, buyDate: e.target.value }))} /></Field>
            <Field label="العمر الإنتاجي (سنوات)"><input className="inp n" inputMode="decimal" value={astF.lifeYears} onChange={e => setAstF(f => ({ ...f, lifeYears: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          </div>
          <Field label="مصدر تمويل الشراء — يحدد الطرف الدائن لقيد الشراء">
            <select className="sel" value={astF.fund} onChange={e => setAstF(f => ({ ...f, fund: e.target.value }))}>
              <option value="1201">دُفع من البنك (1201)</option>
              <option value="1101">دُفع من الخزينة الرئيسية (1101)</option>
              <option value="3101">أصل قائم قبل النظام — قيد افتتاحي (3101)</option>
              <option value="none">بلا قيد شراء (سيسوّيه المحاسب يدوياً)</option>
            </select>
          </Field>
          <Field label="ملاحظة (اختياري)"><input className="inp" value={astF.note} onChange={e => setAstF(f => ({ ...f, note: e.target.value }))} /></Field>
          <div className="note">الإهلاك يبدأ من الشهر التالي للشراء بقسط ثابت شهري حتى نهاية العمر — ويُعاد اشتقاقه تلقائياً عند أي تعديل.</div>
        </Modal>
      )}

      {dspF && (() => {
        const raw = (org.assets || []).find(x => x.id === dspF.id) || {};
        const pv = assetBookAt(raw, dspF.disposedDate);
        const salePrice = Number(dspF.salePrice) || 0;
        const gain = Math.round((salePrice - pv.book) * 100) / 100;
        return (
          <Modal title={'بيع/استبعاد أصل — ' + dspF.name} icon={TrendingDown} onClose={() => setDspF(null)}
            foot={<><button className="btn gh" onClick={() => setDspF(null)}>إلغاء</button>
              <button className="btn pri" onClick={saveDispose}><Check size={14} />تأكيد الاستبعاد</button></>}>
            <div className="grid g2">
              <Field label="تاريخ البيع/الاستبعاد"><input type="date" className="inp" value={dspF.disposedDate} onChange={e => setDspF(f => ({ ...f, disposedDate: e.target.value }))} /></Field>
              <Field label="سعر البيع (اتركه صفرًا للاستبعاد/التخريد بلا مقابل)"><input className="inp n" inputMode="decimal" value={dspF.salePrice} onChange={e => setDspF(f => ({ ...f, salePrice: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            </div>
            <Field label="أين دخل مبلغ البيع؟">
              <select className="sel" value={dspF.saleFund} onChange={e => setDspF(f => ({ ...f, saleFund: e.target.value }))}>
                <option value="1201">دخل إلى البنك (1201)</option>
                <option value="1101">دخل إلى الخزينة الرئيسية (1101)</option>
              </select>
            </Field>
            <div className="card" style={{ background: 'rgba(200,162,74,.05)', marginTop: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--dim)' }}>القيمة الدفترية عند {dspF.disposedDate || '—'}</span><b className="num">{money(pv.book)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, marginTop: 5 }}><span style={{ color: 'var(--dim)' }}>سعر البيع</span><b className="num">{money(salePrice)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5, marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--line)', fontWeight: 800 }}>
                <span>{Math.abs(gain) < 0.005 ? 'بلا ربح أو خسارة' : gain > 0 ? 'ربح البيع (4201)' : 'خسارة البيع/الاستبعاد (5801)'}</span>
                <b className="num" style={{ color: Math.abs(gain) < 0.005 ? 'var(--dim)' : gain > 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(Math.abs(gain))}</b>
              </div>
            </div>
            <div className="note">سيتوقف الإهلاك عند شهر البيع، ويتولّد قيد إقفال متوازن: مدين ({dspF.saleFund === '1101' ? 'الخزينة' : 'البنك'} + مجمّع الإهلاك{gain < -0.005 ? ' + الخسارة' : ''}) = دائن (تكلفة الأصل{gain > 0.005 ? ' + الربح' : ''}). يمكنك التراجع لاحقًا من زر «تراجع».</div>
          </Modal>
        );
      })()}

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>حدود المرحلة الحالية (بشفافية):</b> {taxOn ? 'الضريبة مفعّلة (' + taxRate + '%) — المبيعات والمصروفات والفواتير الموسومة «خاضعة» مفصولة تلقائيًا.' : 'المبالغ إجمالية كما سُجّلت — فصل الضريبة متاح من شاشة الضريبة متى فعّلته.'}
          كل تطبيق توصيل له ذمّة مستقلة وتُفصل عمولته تلقائيًا بنسبته المعرّفة في «الفروع والمستخدمون ← تطبيقات التوصيل»؛ وعند استلام مستحقات تطبيق في البنك سجّلها بقيد يدوي (مدين البنك / دائن ذمّة التطبيق).
          المدفوعات البنكية تتجمع في حساب واحد (1201) وتُطابقه شاشة «التسوية البنكية» مع كشفك الفعلي.
          بطاقات «إيجارات وفواتير الفروع» الثابتة لا تولّد قيودًا (سدادها الفعلي يدخل من مصروفات الورديات) تفاديًا للازدواج.
          القيود لا تُحذف — التصحيح بقيد عكسي، حفاظًا على سلامة السجل أمام أي مراجع.
        </div>
      </div>

      {stlF && (() => {
        const appNm = ((org.deliveryApps || []).find(a => a.id === stlF.appId) || {}).n || 'تطبيق';
        const recvA = A.accounts.find(x => x.appId === stlF.appId);
        const recv = recvA ? recvA.balance : 0;
        const cleared = (Number(stlF.deposit) || 0) + (Number(stlF.deductions) || 0);
        const set = (k, v) => setStlF(f => ({ ...f, [k]: v }));
        return (
          <Modal title="تسوية كشف تطبيق توصيل" sub="طابِق إيداع التطبيق مع ذمّته — والفرق خصمٌ موثّق" icon={Truck} onClose={() => setStlF(null)}
            foot={<><button className="btn gh" onClick={() => setStlF(null)}>إلغاء</button>
              <button className="btn pri" onClick={saveStl}><Check size={14} />تسجيل التسوية</button></>}>
            <div className="grid g2">
              <Field label="التطبيق">
                <select className="sel" value={stlF.appId} onChange={e => set('appId', e.target.value)}>
                  {(org.deliveryApps || []).map(a => <option key={a.id} value={a.id}>{a.n}</option>)}
                </select>
              </Field>
              <Field label="تاريخ الإيداع"><input type="date" className="inp" value={stlF.date} onChange={e => set('date', e.target.value)} /></Field>
            </div>
            <div className="note" style={{ margin: '4px 0 10px' }}>ذمة <b>{appNm}</b> الحالية في دفاترك: <b className="num">{money(recv)}</b> — هذا ما يُفترض أن يُسوّى.</div>
            <div className="grid g2">
              <Num label="المبلغ المُودَع في البنك" value={stlF.deposit} onChange={v => set('deposit', v)} />
              <Num label="الخصومات/الرسوم الموثّقة (الفرق)" value={stlF.deductions} onChange={v => set('deductions', v)} hint="رسوم إضافية، طلبات ملغاة، غرامات" />
            </div>
            <Field label="ملاحظة"><input className="inp" value={stlF.note} placeholder="رقم كشف التطبيق أو ملاحظة" onChange={e => set('note', e.target.value)} /></Field>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              <span className="badge b-sky">سيُقفل من الذمة: <b className="num">{money(cleared)}</b></span>
              <span className={'badge ' + (Math.abs(recv - cleared) < 0.5 ? 'b-mint' : 'b-amber')}>{Math.abs(recv - cleared) < 0.5 ? 'يطابق الذمة تمامًا ✓' : 'المتبقّي بعد التسوية: ' + money(recv - cleared)}</span>
            </div>
          </Modal>
        );
      })()}

      {jm && (
        <Modal title={jm.opening ? 'قيد افتتاحي' : 'قيد محاسبي يدوي'} sub="مجموع المدين يجب أن يساوي مجموع الدائن — وكل سطر في جهة واحدة فقط"
          icon={FileText} onClose={() => setJm(null)} wide
          foot={<>
            <button className="btn gh" onClick={() => setJm(null)}>إلغاء</button>
            <button className="btn pri" disabled={!jmOk} onClick={saveJm}><Check size={14} />تسجيل القيد</button>
          </>}>
          <div className="row" style={{ gap: 9, flexWrap: 'wrap' }}>
            <Field label="التاريخ" style={{ width: 160 }}>
              <input type="date" className="inp" value={jm.date} onChange={e => setJm(m => ({ ...m, date: e.target.value }))} />
            </Field>
            <Field label="بيان القيد" style={{ flex: 1, minWidth: 200 }}>
              <input className="inp" placeholder="مثال: استلام مستحقات جاهز في البنك · رصيد افتتاحي للصندوق…" value={jm.title} onChange={e => setJm(m => ({ ...m, title: e.target.value }))} />
            </Field>
            <label className="row" style={{ gap: 6, fontSize: 12, color: 'var(--dim)', alignItems: 'center', cursor: 'pointer', paddingTop: 16 }}>
              <input type="checkbox" checked={jm.opening} onChange={e => setJm(m => ({ ...m, opening: e.target.checked }))} />
              قيد افتتاحي (أرصدة بداية المدة)
            </label>
          </div>
          {jm.lines.map((l, i) => (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select className="sel jm-acc" style={{ flex: 2, minWidth: 190 }} value={l.code} onChange={e => jmUp(i, 'code', e.target.value)}>
                <option value="">— اختر الحساب —</option>
                {kinds.map(k => (
                  <optgroup key={k} label={ACC_KIND[k].ar}>
                    {A.accounts.filter(a => a.kind === k).map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <input className="inp n jm-d" inputMode="decimal" style={{ flex: 1, minWidth: 110 }} placeholder="مدين 0.00" value={l.debit}
                onChange={e => jmUp(i, 'debit', e.target.value.replace(/[^\d.]/g, ''))} />
              <input className="inp n jm-c" inputMode="decimal" style={{ flex: 1, minWidth: 110 }} placeholder="دائن 0.00" value={l.credit}
                onChange={e => jmUp(i, 'credit', e.target.value.replace(/[^\d.]/g, ''))} />
              {jm.lines.length > 2 && <button className="btn sm gh" onClick={() => setJm(m => ({ ...m, lines: m.lines.filter((_, x) => x !== i) }))}><X size={13} /></button>}
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setJm(m => ({ ...m, lines: [...m.lines, { code: '', debit: '', credit: '' }] }))}><Plus size={13} />سطر إضافي</button>
            <div className="row" style={{ gap: 10, fontSize: 12.5 }}>
              <span>مدين: <b className="num" style={{ color: 'var(--brass-l)' }}>{money(jmD)}</b></span>
              <span>دائن: <b className="num" style={{ color: 'var(--brass-l)' }}>{money(jmC)}</b></span>
              <span className={'badge ' + (jmOk ? 'b-mint' : 'b-rose')}>{jmOk ? 'متوازن ✓' : Math.abs(jmD - jmC) < 0.005 ? 'أكمل البيانات' : 'فرق ' + money(Math.abs(jmD - jmC))}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
