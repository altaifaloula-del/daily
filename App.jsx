import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutDashboard, ClipboardCheck, Banknote, Users, Building2, FileBarChart,
  ShieldCheck, Bell, LogOut, Plus, Minus, Trash2, Check, X, Search,
  CircleDollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet,
  ArrowLeftRight, UserCog, Menu, RefreshCw, Lock, Radio, Download,
  ChevronLeft, Stamp, Landmark, Receipt, CalendarDays, Store, Eye, Send,
  Sparkles, Truck, Printer, HardDrive, Settings, FileText, Upload,
  Camera, Image as ImageIcon, Clock, Timer, Compass
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line
} from 'recharts';
import { CSS } from './styles';
import { cloud, KEYS, kb } from './storage';

/* ============================================================
   منصة سحابية متكاملة لإدارة وإغلاق فروع المطاعم
   نسخة تفاعلية متعددة المستخدمين — بيانات مشتركة سحابياً
   ============================================================ */



/* ================= أدوات ================= */
/* ================= البيانات التأسيسية ================= */
function rnd(seed) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }

function seedOrg() {
  const branches = [
    { id: 'b-01', name: 'الفرع الرئيسي — الملقا', city: 'الرياض', managerName: 'أحمد العلي', phone: '0501112233', defaultFloat: 2000, shiftEndTime: '23:30', isActive: true, autoClosingReminderEnabled: true, inAppReminderEnabled: true, emailReminderEnabled: true, reminderBeforeMinutes: 30, managerEmails: 'admin@restaurant.sa, finance@restaurant.sa' },
    { id: 'b-02', name: 'فرع النخيل مول', city: 'الرياض', managerName: 'سعد القحطاني', phone: '0502223344', defaultFloat: 1500, shiftEndTime: '01:30', isActive: true, autoClosingReminderEnabled: true, inAppReminderEnabled: true, emailReminderEnabled: false, reminderBeforeMinutes: 45, managerEmails: 'finance@restaurant.sa' },
    { id: 'b-03', name: 'فرع الكورنيش', city: 'جدة', managerName: 'ماجد الزهراني', phone: '0503334455', defaultFloat: 1800, shiftEndTime: '02:30', isActive: true, autoClosingReminderEnabled: false, inAppReminderEnabled: true, emailReminderEnabled: false, reminderBeforeMinutes: 15, managerEmails: '' }
  ];
  const users = [
    { id: 'u-gm', name: 'عبدالله المالك', email: 'admin@restaurant.sa', role: 'general_management', pin: '1234', isActive: true, createdAt: '2026-01-01' },
    { id: 'u-fin', name: 'نورة الحربي', email: 'finance@restaurant.sa', role: 'finance_department', pin: '1234', allowedBranchIds: ['b-01', 'b-02', 'b-03'], isActive: true, createdAt: '2026-01-01' },
    { id: 'u-b1', name: 'أحمد العلي', email: 'malqa@restaurant.sa', role: 'branch_manager', pin: '1234', branchId: 'b-01', isActive: true, createdAt: '2026-01-02' },
    { id: 'u-b2', name: 'سعد القحطاني', email: 'nakheel@restaurant.sa', role: 'branch_manager', pin: '1234', branchId: 'b-02', isActive: true, createdAt: '2026-01-02' },
    { id: 'u-b3', name: 'ماجد الزهراني', email: 'jeddah@restaurant.sa', role: 'branch_manager', pin: '1234', branchId: 'b-03', isActive: true, createdAt: '2026-01-05' }
  ];
  const names = ['خالد السبيعي', 'محمد الشمري', 'فيصل الدوسري', 'ياسر العتيبي', 'تركي المطيري', 'بدر الغامدي', 'عمر الحارثي', 'سلطان الرشيد', 'راكان البقمي'];
  const jobs = ['كاشير', 'شيف', 'مساعد شيف', 'مشرف صالة', 'عامل توصيل', 'مسؤول مخزن'];
  const employees = names.map((n, i) => ({
    id: 'e-' + (i + 1), name: n, branchId: branches[i % 3].id, branchName: branches[i % 3].name,
    jobTitle: jobs[i % jobs.length], baseSalary: 3200 + (i % 5) * 600, housingAllowance: 400,
    phone: '05' + (10000000 + i * 111111), status: 'active', hireDate: '2025-0' + ((i % 8) + 1) + '-15'
  }));
  return {
    company: { name: 'مجموعة مذاق الشرق للمطاعم', activity: 'مطاعم ومقاهي', taxNumber: '3001234567890003', commercialReg: '1010456789', phone: '0112345678', address: 'الرياض — طريق الملك فهد' },
    branches, users, employees,
    expenseCats: EXP_CATS.map(c => ({ ...c, budgetLimitMonthly: { ec1: 60000, ec2: 45000, ec3: 9000, ec4: 8000, ec5: 9000, ec6: 60000, ec7: 5000, ec8: 3000 }[c.id] || 5000 })),
    deliveryApps: APPS,
    suppliers: [
      { id: 'sp-1', name: 'مؤسسة الخيرات للتموين', category: 'مواد غذائية', phone: '0553334441', vatNo: '3001112223330003', terms: 30, isActive: true },
      { id: 'sp-2', name: 'شركة الألبان الوطنية', category: 'ألبان وأجبان', phone: '0553334442', vatNo: '3001112223340003', terms: 15, isActive: true },
      { id: 'sp-3', name: 'مصنع التغليف الحديث', category: 'مواد تغليف', phone: '0553334443', vatNo: '3001112223350003', terms: 45, isActive: true },
      { id: 'sp-4', name: 'ورشة التبريد المتخصصة', category: 'صيانة', phone: '0553334444', vatNo: '3001112223360003', terms: 7, isActive: true }
    ]
  };
}

function seedOps(org) {
  const closings = [], transfers = [], advances = [], notifications = [];
  const base = new Date();
  for (let d = 20; d >= 0; d--) {
    const dt = new Date(base); dt.setDate(dt.getDate() - d);
    const ds = dt.toISOString().slice(0, 10);
    org.branches.forEach((b, bi) => {
      const s = d * 7 + bi * 31;
      const weekend = [4, 5].includes(dt.getDay()) ? 1.28 : 1;
      const cash = Math.round((2600 + rnd(s) * 2200) * weekend);
      const card = Math.round((5200 + rnd(s + 1) * 3800) * weekend);
      const bank = d % 6 === 0 ? Math.round(600 + rnd(s + 9) * 900) : 0;
      const delivery = APPS.map((a, ai) => {
        const amt = Math.round((700 + rnd(s + ai + 3) * 1500) * weekend);
        return { appId: a.id, appName: a.n, amount: amt, orderCount: Math.round(amt / 62), commissionPercentage: a.c, commissionAmount: Math.round(amt * a.c) / 100 };
      });
      const totalDelivery = sum(delivery, x => x.amount);
      const exps = [
        { id: uid('x'), categoryId: 'ec1', categoryName: 'مشتريات مواد خام', amount: Math.round(900 + rnd(s + 5) * 1400), paymentMethod: 'cash', beneficiaryName: 'مؤسسة الخيرات للتموين', isTaxable: true },
        { id: uid('x'), categoryId: 'ec7', categoryName: 'نظافة ومستهلكات', amount: Math.round(120 + rnd(s + 6) * 260), paymentMethod: 'cash', beneficiaryName: 'سوق الجملة', isTaxable: true },
        { id: uid('x'), categoryId: 'ec4', categoryName: 'صيانة وتشغيل', amount: d % 4 === 0 ? Math.round(200 + rnd(s + 7) * 500) : 0, paymentMethod: 'card', beneficiaryName: 'ورشة التبريد', isTaxable: true }
      ].filter(e => e.amount > 0);
      const cashExp = sum(exps.filter(e => e.paymentMethod === 'cash'), e => e.amount);
      const cardExp = sum(exps.filter(e => e.paymentMethod === 'card'), e => e.amount);
      const opening = b.defaultFloat;
      const expected = opening + cash - cashExp;
      const varr = d < 3 && bi === 1 ? -Math.round(20 + rnd(s + 8) * 90) : (rnd(s + 11) > 0.82 ? Math.round((rnd(s + 12) - 0.5) * 70) : 0);
      const actual = expected + varr;
      const den = emptyDenoms();
      let rem = Math.max(0, Math.round(actual));
      DENOMS.forEach(dn => { if (dn.v >= 1) { den[dn.k] = Math.floor(rem / dn.v); rem -= den[dn.k] * dn.v; } });
      den.coins = Math.round(rem * 2);
      const transfer = Math.max(0, Math.round(actual - opening));
      const totalRev = cash + card + bank + totalDelivery;
      const st = d <= 1 ? (bi === 0 ? 'submitted' : 'draft') : (d <= 3 ? 'submitted' : 'approved');
      const cl = {
        id: 'cl-' + b.id + '-' + ds, date: ds, branchId: b.id, branchName: b.name, managerName: b.managerName,
        openingBalance: opening, cashSales: cash, cardSales: card, bankTransferSales: bank,
        deliverySales: delivery, totalDeliverySales: totalDelivery, otherRevenues: [], totalOtherRevenues: 0,
        totalRevenue: totalRev, expenses: exps, totalExpenses: sum(exps, e => e.amount),
        totalCashExpenses: cashExp, totalCardExpenses: cardExp,
        expectedCashInSafe: expected, actualCashCount: actual, denominationDetails: den,
        variance: varr, varianceReason: varr < 0 ? 'فرق باقي عملاء غير موثق' : '',
        transferredToMainTreasury: transfer, retainedFloatForTomorrow: Math.max(0, actual - transfer),
        transferReferenceNo: 'TR-' + ds.replace(/-/g, '') + '-' + b.id.slice(-2),
        transferStatus: d > 3 ? 'received' : 'pending',
        status: st,
        auditedBy: d > 3 ? 'نورة الحربي' : '', auditedAt: d > 3 ? ds + 'T09:00:00Z' : '',
        gmApprovalStatus: d > 5 ? 'approved' : 'pending', gmApprovedBy: d > 5 ? 'عبدالله المالك' : '',
        createdBy: b.managerName, createdAt: ds + 'T22:30:00Z', updatedAt: ds + 'T22:30:00Z'
      };
      closings.push(cl);
      if (transfer > 0 && st !== 'draft') {
        transfers.push({
          id: uid('tr'), closingId: cl.id, date: ds, branchId: b.id, branchName: b.name,
          amount: transfer, referenceNo: cl.transferReferenceNo, status: cl.transferStatus,
          receivedBy: cl.transferStatus === 'received' ? 'نورة الحربي' : '', receivedAt: cl.transferStatus === 'received' ? ds + 'T10:00:00Z' : ''
        });
      }
    });
  }
  const month = today().slice(0, 7);
  org.employees.forEach((e, i) => {
    if (i % 2 === 0) {
      const b = org.branches.find(x => x.id === e.branchId);
      advances.push({
        id: uid('ad'), employeeId: e.id, employeeName: e.name, branchId: e.branchId, branchName: b?.name || '',
        date: month + '-0' + ((i % 8) + 1), month, type: i % 4 === 0 ? 'advance' : 'salary_draw',
        amount: 300 + (i % 4) * 250, reason: i % 4 === 0 ? 'سلفة ظروف عائلية' : 'مسحوبة على الراتب',
        paymentMethod: 'cash', isUnjustified: i === 4, createdByName: b?.managerName || '', createdAt: nowISO()
      });
    }
  });
  notifications.push({
    id: uid('n'), type: 'gm_approval', title: 'إغلاقات بانتظار الاعتماد',
    message: 'يوجد إغلاقات مرحّلة تنتظر تدقيق الإدارة المالية والاعتماد النهائي.',
    severity: 'medium', date: today(), createdAt: nowISO(), isRead: false
  });
  const invoices = [];
  const sups = ['sp-1', 'sp-2', 'sp-3', 'sp-4'];
  const supNames = { 'sp-1': 'مؤسسة الخيرات للتموين', 'sp-2': 'شركة الألبان الوطنية', 'sp-3': 'مصنع التغليف الحديث', 'sp-4': 'ورشة التبريد المتخصصة' };
  for (let i = 0; i < 14; i++) {
    const b = org.branches[i % 3];
    const dt = new Date(); dt.setDate(dt.getDate() - (i * 3 + 1));
    const ds = dt.toISOString().slice(0, 10);
    const due = new Date(dt); due.setDate(due.getDate() + [30, 15, 45, 7][i % 4]);
    const amt = Math.round(1200 + rnd(i * 13) * 5400);
    const paid = i % 3 === 0 ? amt : (i % 3 === 1 ? Math.round(amt / 2) : 0);
    invoices.push({
      id: uid('inv'), supplierId: sups[i % 4], supplierName: supNames[sups[i % 4]],
      branchId: b.id, branchName: b.name, invoiceNo: 'INV-' + (24010 + i),
      date: ds, dueDate: due.toISOString().slice(0, 10), amount: amt,
      paidAmount: paid, isTaxable: true, notes: ''
    });
  }
  const fixedExpenses = [];
  org.branches.forEach((b, i) => {
    fixedExpenses.push({
      id: uid('fx'), branchId: b.id, branchName: b.name, month,
      rentAmount: 18000 + i * 4000, electricityBill: 2400 + i * 300, waterBill: 480,
      internetBill: 399, otherBills: 650, dueDayOfMonth: 25, isPaid: i === 0, paidDate: i === 0 ? month + '-05' : ''
    });
  });
  const disbursements = [
    { id: uid('ds'), date: today(), category: 'توريد مواد خام مركزي', amount: 12500, beneficiary: 'مؤسسة الخيرات للتموين', method: 'bank_transfer', reference: 'PO-88120', by: 'نورة الحربي', createdAt: nowISO() },
    { id: uid('ds'), date: today(), category: 'إيجارات الفروع', amount: 22000, beneficiary: 'شركة الأملاك العقارية', method: 'bank_transfer', reference: 'RENT-08', by: 'نورة الحربي', createdAt: nowISO() },
    { id: uid('ds'), date: today(), category: 'صرف رواتب', amount: 31200, beneficiary: 'كشف رواتب الشهر', method: 'bank_transfer', reference: 'PAY-08', by: 'عبدالله المالك', createdAt: nowISO() }
  ];
  return { closings, transfers, advances, notifications, invoices, fixedExpenses, disbursements };
}

/* ================= الجذر ================= */
export default function App() {
  const [org, setOrg] = useState(null);
  const [ops, setOps] = useState({ closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [] });
  const [pulse, setPulse] = useState({ presence: {}, audit: [] });
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('dash');
  const [drawer, setDrawer] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [boot, setBoot] = useState('loading');
  const [toast, setToast] = useState(null);
  const [bell, setBell] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [tour, setTour] = useState(false);
  const [live, setLive] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const sid = useRef(uid('s'));

  const say = useCallback((msg, kind) => {
    setToast({ msg, kind: kind || 'ok' });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* --- الإقلاع وتهيئة السحابة --- */
  useEffect(() => {
    (async () => {
      let o = await cloud.get(KEYS.org, null);
      if (!o || !o.branches) {
        o = seedOrg();
        const seeded = seedOps(o);
        await cloud.set(KEYS.org, o);
        await cloud.set(KEYS.ops, seeded);
        await cloud.set(KEYS.pulse, { presence: {}, audit: [] });
        setOps(seeded);
      } else {
        const p = await cloud.get(KEYS.ops, null);
        setOps(p || { closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [] });
      }
      setOrg(o);
      setPulse(await cloud.get(KEYS.pulse, { presence: {}, audit: [] }));
      setLastSync(new Date());
      setBoot('ready');
    })();
  }, []);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* --- المزامنة الدورية + الحضور --- */
  const snap = useRef({});
  const refresh = useCallback(async (silent) => {
    if (silent && typeof document !== 'undefined' && document.hidden) return;
    if (!silent) setSyncing(true);
    const [o, p, pu] = await Promise.all([
      cloud.get(KEYS.org, null), cloud.get(KEYS.ops, null), cloud.get(KEYS.pulse, null)
    ]);
    const put = (k, v, setter) => {
      if (!v) return;
      const j = JSON.stringify(v);
      if (snap.current[k] === j) return;   // لا تغيير — نتفادى إعادة الرسم
      snap.current[k] = j; setter(v);
    };
    put('org', o, setOrg); put('ops', p, setOps); put('pulse', pu, setPulse);
    setLastSync(new Date());
    setTimeout(() => setSyncing(false), 350);
  }, []);

  useEffect(() => {
    if (boot !== 'ready') return;
    const subs = [];
    const wire = (slot, key, setter) => {
      const un = cloud.subscribe?.(key, (v) => {
        const j = JSON.stringify(v);
        if (snap.current[slot] === j) return;
        snap.current[slot] = j; setter(v); setLastSync(new Date());
      });
      if (un) subs.push(un);
    };
    wire('org', KEYS.org, setOrg);
    wire('ops', KEYS.ops, setOps);
    wire('pulse', KEYS.pulse, setPulse);
    if (subs.length) setLive(true);
    return () => subs.forEach(u => u());
  }, [boot]);

  useEffect(() => {
    if (boot !== 'ready') return;
    // مع الاستماع اللحظي يكفي استطلاع احتياطي متباعد
    const t = setInterval(() => refresh(true), live ? 45000 : 8000);
    return () => clearInterval(t);
  }, [boot, live, refresh]);

  useEffect(() => {
    if (!me) return;
    const beat = async () => {
      const pu = await cloud.get(KEYS.pulse, { presence: {}, audit: [] });
      const pres = { ...(pu.presence || {}) };
      pres[sid.current] = { name: me.name, role: me.role, at: Date.now() };
      Object.keys(pres).forEach(k => { if (Date.now() - (pres[k].at || 0) > 70000) delete pres[k]; });
      const next = { ...pu, presence: pres };
      await cloud.set(KEYS.pulse, next);
      setPulse(next);
    };
    beat();
    const t = setInterval(beat, 20000);
    return () => clearInterval(t);
  }, [me]);

  /* --- الكتابة الآمنة: قراءة أحدث نسخة، تطبيق التعديل، تحقق من الإصدار، إعادة المحاولة عند التعارض --- */
  const writeOps = useCallback(async (mutator) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = (await cloud.get(KEYS.ops, null)) || ops;
      const baseRev = latest.rev || 0;
      const next = mutator(JSON.parse(JSON.stringify(latest)));
      next.rev = baseRev + 1;
      const ok = await cloud.set(KEYS.ops, next);
      if (!ok) continue;
      const check = await cloud.get(KEYS.ops, null);
      if (check && (check.rev || 0) === next.rev) { snap.current.ops = JSON.stringify(check); setOps(check); return true; }
      // كتب مستخدم آخر في نفس اللحظة — نعيد تطبيق التعديل على أحدث نسخة
    }
    return false;
  }, [ops]);

  const commit = useCallback(async (mutator, log) => {
    const ok = await writeOps(mutator);
    if (!ok) {
      say('تعذّر الحفظ السحابي بعد عدة محاولات — تحقق من الاتصال وأعد المحاولة', 'no');
      return false;
    }
    if (log && me) {
      const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
      const entry = {
        id: uid('lg'), timestamp: nowISO(), userName: me.name, userRole: me.role,
        userRoleLabel: ROLES[me.role].ar, ...log
      };
      const nx = { ...pu, audit: [entry, ...(pu.audit || [])].slice(0, 150) };
      await cloud.set(KEYS.pulse, nx);
      setPulse(nx);
    }
    setLastSync(new Date());
    return true;
  }, [writeOps, me, say]);

  const commitOrg = useCallback(async (mutator, log) => {
    const latest = (await cloud.get(KEYS.org, null)) || org;
    const next = mutator(JSON.parse(JSON.stringify(latest)));
    const ok = await cloud.set(KEYS.org, next);
    if (!ok) { say('تعذّر حفظ الإعدادات سحابياً — أعد المحاولة', 'no'); return false; }
    snap.current.org = JSON.stringify(next);
    setOrg(next);
    if (log && me) {
      const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
      const entry = { id: uid('lg'), timestamp: nowISO(), userName: me.name, userRole: me.role, userRoleLabel: ROLES[me.role].ar, ...log };
      const nx = { ...pu, audit: [entry, ...(pu.audit || [])].slice(0, 150) };
      await cloud.set(KEYS.pulse, nx);
      setPulse(nx);
    }
    setLastSync(new Date());
    return true;
  }, [org, me, say]);

  const resetAll = useCallback(async () => {
    const o = seedOrg(); const p = seedOps(o);
    await cloud.set(KEYS.org, o); await cloud.set(KEYS.ops, p);
    await cloud.set(KEYS.pulse, { presence: {}, audit: [] });
    setOrg(o); setOps(p); setPulse({ presence: {}, audit: [] });
    say('تمت إعادة ضبط بيانات المنصة إلى الحالة التأسيسية');
  }, [say]);

  /* --- نطاق الفروع حسب الدور --- */
  const myBranches = useMemo(() => {
    if (!org || !me) return [];
    const s = ROLES[me.role].scope;
    if (s === 'all') return org.branches;
    if (s === 'own') return org.branches.filter(b => b.id === me.branchId);
    return org.branches.filter(b => (me.allowedBranchIds || []).includes(b.id));
  }, [org, me]);

  const scoped = useMemo(() => {
    const ids = myBranches.map(b => b.id);
    return {
      closings: (ops.closings || []).filter(c => ids.includes(c.branchId)),
      transfers: (ops.transfers || []).filter(t => ids.includes(t.branchId)),
      advances: (ops.advances || []).filter(a => ids.includes(a.branchId))
    };
  }, [ops, myBranches]);

  if (boot === 'loading') {
    return (
      <div className="rms" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={26} color="#C8A24A" className="spin" />
          <div style={{ marginTop: 12, color: '#A2968A', fontSize: 13 }}>جارٍ الاتصال بالسحابة…</div>
        </div>
      </div>
    );
  }

  if (!me) {
    return <Gate css={CSS} theme={theme} org={org} onLogin={(u) => { setMe(u); setTab('dash'); setTour(true); }}
      online={Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 70000)} />;
  }

  const unread = (ops.notifications || []).filter(n => !n.isRead).length;
  const pending = scoped.closings.filter(c => c.status === 'submitted').length;
  const online = Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 70000);

  const NAV = [
    { id: 'dash', ar: 'لوحة المؤشرات', icon: LayoutDashboard, roles: ['all'] },
    { id: 'closing', ar: 'الإغلاق اليومي', icon: ClipboardCheck, roles: ['all'] },
    { id: 'approve', ar: 'التدقيق والاعتماد', icon: ShieldCheck, roles: ['finance_department', 'general_management'], cnt: pending },
    { id: 'treasury', ar: 'الخزينة والتحويلات', icon: Landmark, roles: ['all'] },
    { id: 'payroll', ar: 'الرواتب والسلف', icon: Wallet, roles: ['all'] },
    { id: 'suppliers', ar: 'الموردون والالتزامات', icon: Truck, roles: ['all'] },
    { id: 'shifts', ar: 'الورديات والتذكيرات', icon: Clock, roles: ['all'] },
    { id: 'archive', ar: 'أرشيف المستندات', icon: ImageIcon, roles: ['all'] },
    { id: 'ai', ar: 'المركز المالي الذكي', icon: Sparkles, roles: ['finance_department', 'general_management'] },
    { id: 'reports', ar: 'التقارير المالية', icon: FileBarChart, roles: ['all'] },
    { id: 'admin', ar: 'الفروع والمستخدمون', icon: UserCog, roles: ['general_management'] },
    { id: 'audit', ar: 'سجل التدقيق', icon: Eye, roles: ['finance_department', 'general_management'] }
  ].filter(n => n.roles.includes('all') || n.roles.includes(me.role));

  const shared = { org, ops, pulse, me, myBranches, scoped, commit, commitOrg, say, setTab, theme };

  return (
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
      <style dangerouslySetInnerHTML={{ __html: CSS + '.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}' }} />
      <div className="shell">
        {drawer && <div className="mask" style={{ zIndex: 55 }} onClick={() => setDrawer(false)} />}
        <aside className={'side' + (drawer ? ' open' : '')}>
          <div className="brand">
            <div className="brand-mark">مذ</div>
            <div>
              <div className="brand-t">{org.company.name}</div>
              <div className="brand-s">CLOUD CLOSING SUITE</div>
            </div>
          </div>
          <div className="nav-lbl">التشغيل اليومي</div>
          {NAV.map(n => (
            <button key={n.id} className={'nav-i' + (tab === n.id ? ' on' : '')}
              onClick={() => { setTab(n.id); setDrawer(false); }}>
              <n.icon size={16} />{n.ar}
              {n.cnt > 0 && <span className="cnt num">{n.cnt}</span>}
            </button>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <div className="mono-b" style={{ marginBottom: 8, padding: '9px 11px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
                <div style={{ fontSize: 10, color: 'var(--faint)' }}>{ROLES[me.role].ar.split('—')[0]}</div>
              </div>
              <button className="btn sm gh" onClick={() => setMe(null)} title="خروج"><LogOut size={13} /></button>
            </div>
            <button className="nav-i" onClick={() => setTour(true)} style={{ fontSize: 11.5 }}>
              <Compass size={14} />جولة تعريفية في المنصة
            </button>
            <button className="nav-i" onClick={resetAll} style={{ fontSize: 11.5 }}>
              <RefreshCw size={14} />إعادة ضبط بيانات العرض
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="top">
            <button className="btn sm gh hidden-desk" onClick={() => setDrawer(true)}><Menu size={16} /></button>
            <h1 style={{ fontSize: 15 }}>{NAV.find(n => n.id === tab)?.ar}</h1>
            <div style={{ marginInlineStart: 'auto' }} className="row">
              <div className="row" style={{ gap: 0 }}>
                {online.slice(0, 4).map((p, i) => (
                  <div key={i} className="av" title={p.name} style={{ background: clr(i) }}>{p.name.charAt(0)}</div>
                ))}
              </div>
              <span className={'badge ' + (live ? 'b-mint' : 'b-dim')}
                title={live ? 'مزامنة لحظية عبر Firestore' : 'مزامنة دورية كل 8 ثوانٍ'}>
                <span className="dot" />{online.length} متصل{live ? ' · لحظي' : ''}
              </span>
              <button className="btn sm gh" onClick={() => refresh(false)} title="مزامنة الآن">
                <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                <span className="num" style={{ fontSize: 10, color: 'var(--faint)' }}>
                  {lastSync ? lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </button>
              <button className="btn sm gh" title="تبديل السمة"
                onClick={() => setTheme(t => t === 'lite' ? 'dark' : 'lite')}>
                {theme === 'lite' ? '🌙' : '☀️'}
              </button>
              <button className="btn sm gh" onClick={() => setBell(true)} style={{ position: 'relative' }}>
                <Bell size={15} />
                {unread > 0 && <span style={{
                  position: 'absolute', top: -3, insetInlineEnd: -3, background: 'var(--rose)',
                  width: 15, height: 15, borderRadius: '50%', fontSize: 9, display: 'grid',
                  placeItems: 'center', color: '#fff', fontWeight: 700
                }}>{unread}</span>}
              </button>
            </div>
          </header>

          {offline && (
            <div style={{
              background: 'rgba(224,164,88,.14)', borderBottom: '1px solid rgba(224,164,88,.4)',
              color: 'var(--amber)', padding: '9px 20px', fontSize: 12, display: 'flex', gap: 9, alignItems: 'center'
            }}>
              <AlertTriangle size={15} />
              انقطع الاتصال — تابع الإدخال، لكن الحفظ السحابي لن يكتمل حتى عودة الشبكة. تجنّب اعتماد الإغلاق الآن.
            </div>
          )}

          <div className="page">
            {tab === 'dash' && <Dashboard {...shared} online={online} />}
            {tab === 'closing' && <Closing {...shared} />}
            {tab === 'approve' && <Approvals {...shared} />}
            {tab === 'treasury' && <Treasury {...shared} />}
            {tab === 'payroll' && <Payroll {...shared} />}
            {tab === 'suppliers' && <Suppliers {...shared} />}
            {tab === 'shifts' && <Shifts {...shared} />}
            {tab === 'archive' && <Archive {...shared} />}
            {tab === 'ai' && <AiCenter {...shared} />}
            {tab === 'reports' && <Reports {...shared} />}
            {tab === 'admin' && <Admin {...shared} />}
            {tab === 'audit' && <AuditView {...shared} />}
          </div>

          <div className="tick">
            <span>الشركة: {org.company.name}</span>
            <span>الرقم الضريبي: <span className="num">{org.company.taxNumber}</span></span>
            <span>الفروع النشطة: <span className="num">{org.branches.filter(b => b.isActive).length}</span></span>
            <span>الإغلاقات المسجلة: <span className="num">{ops.closings.length}</span></span>
            <span style={{ color: 'var(--mint)' }}>المزامنة السحابية فعّالة</span>
          </div>
        </div>
      </div>

      {bell && <Notifications ops={ops} commit={commit} onClose={() => setBell(false)} />}
      {tour && <TourModal me={me} onClose={() => setTour(false)} go={(t) => { setTab(t); setTour(false); }} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, insetInlineStart: 20, zIndex: 99,
          background: toast.kind === 'no' ? 'rgba(217,84,77,.15)' : 'rgba(79,178,134,.14)',
          border: '1px solid ' + (toast.kind === 'no' ? 'rgba(217,84,77,.45)' : 'rgba(79,178,134,.45)'),
          color: toast.kind === 'no' ? '#D9544D' : '#4FB286',
          padding: '11px 16px', borderRadius: 11, fontSize: 12.5, maxWidth: 340,
          backdropFilter: 'blur(8px)'
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

/* ================= بوابة الدخول ================= */
function Gate({ css, org, onLogin, online, theme }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [err, setErr] = useState('');
  const refs = [useRef(), useRef(), useRef(), useRef()];

  const type = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...pin]; n[i] = v; setPin(n); setErr('');
    if (v && i < 3) refs[i + 1].current?.focus();
    if (n.join('').length === 4) submit(n.join(''));
  };
  const submit = (code) => {
    if (!sel) return;
    if (code === (sel.pin || '1234')) onLogin(sel);
    else { setErr('رمز الدخول غير صحيح — حاول مرة أخرى'); setPin(['', '', '', '']); refs[0].current?.focus(); }
  };

  return (
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div className="brand-mark" style={{ width: 52, height: 52, margin: '0 auto 14px', fontSize: 18, borderRadius: 15 }}>مذ</div>
            <h1 style={{ fontSize: 20 }}>{org.company.name}</h1>
            <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 5 }}>
              منصة سحابية متكاملة لإغلاق وإدارة فروع المطاعم
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <span className="badge b-mint"><span className="dot" />{online.length} مستخدم متصل الآن</span>
              <span className="badge b-dim"><Lock size={10} />بيانات مشتركة بين الجميع</span>
            </div>
          </div>

          {!sel ? (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 12 }}><Users size={15} />اختر حسابك للدخول</div>
              {org.users.filter(u => u.isActive).map(u => {
                const b = org.branches.find(x => x.id === u.branchId);
                return (
                  <button key={u.id} className="gate-u" onClick={() => { setSel(u); setTimeout(() => refs[0].current?.focus(), 80); }}>
                    <div className="av" style={{ background: clr(org.users.indexOf(u)), margin: 0, width: 34, height: 34, fontSize: 13 }}>
                      {u.name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                        {ROLES[u.role].ar}{b ? ' • ' + b.name : ''}
                      </div>
                    </div>
                    <ChevronLeft size={15} color="var(--faint)" />
                  </button>
                );
              })}
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, lineHeight: 1.7 }}>
                افتح المنصة على جهاز آخر واختر حساباً مختلفاً — ستظهر تعديلات كل مستخدم لدى الباقين خلال ثوانٍ.
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="row" style={{ marginBottom: 18 }}>
                <div className="av" style={{ background: clr(org.users.findIndex(u => u.id === sel.id)), margin: 0, width: 38, height: 38, fontSize: 14 }}>
                  {sel.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{sel.name}</div>
                  <span className={'badge ' + ROLES[sel.role].badge} style={{ marginTop: 4 }}>{ROLES[sel.role].ar}</span>
                </div>
                <button className="btn sm gh" onClick={() => { setSel(null); setPin(['', '', '', '']); setErr(''); }}>
                  <X size={14} />
                </button>
              </div>
              <div className="lbl" style={{ textAlign: 'center', marginBottom: 12 }}>أدخل رمز الدخول السريع</div>
              <div className="pin">
                {pin.map((p, i) => (
                  <input key={i} ref={refs[i]} className="num" value={p} inputMode="numeric" maxLength={1}
                    type="password" onChange={e => type(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Backspace' && !pin[i] && i > 0) refs[i - 1].current?.focus(); }} />
                ))}
              </div>
              {err && <div style={{ color: 'var(--rose)', fontSize: 11.5, textAlign: 'center', marginTop: 12 }}>{err}</div>}
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--faint)' }}>
                رمز العرض التجريبي: <span className="num" style={{ color: 'var(--brass)' }}>1234</span>
              </div>
              <hr className="hr" />
              <div className="lbl">صلاحيات هذا الدور</div>
              {ROLES[sel.role].perms.map((p, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--dim)', display: 'flex', gap: 7, marginBottom: 5 }}>
                  <Check size={13} color="var(--mint)" style={{ flexShrink: 0, marginTop: 3 }} />{p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= مكوّنات مشتركة ================= */
function Modal({ title, icon: Icon, children, foot, onClose, wide }) {
  return (
    <div className="mask" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { maxWidth: 860 } : undefined}>
        <div className="modal-h">
          <div className="card-t">{Icon && <Icon size={16} color="var(--brass)" />}{title}</div>
          <button className="btn sm gh" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {foot && <div className="modal-f">{foot}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="fld"><label className="lbl">{label}</label>{children}</div>;
}

function Num({ label, value, onChange, hint }) {
  return (
    <div className="fld">
      <label className="lbl">{label}</label>
      <input className="inp n" inputMode="decimal" value={value === 0 ? '' : value}
        placeholder="0.00" onChange={e => onChange(Number(e.target.value.replace(/[^\d.-]/g, '')) || 0)} />
      {hint && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const ST = {
  draft: ['b-dim', 'مسودة'], submitted: ['b-amber', 'مرحّل للمراجعة'],
  approved: ['b-mint', 'مدقّق ومعتمد'], rejected: ['b-rose', 'مرفوض'],
  pending: ['b-amber', 'قيد الانتظار'], received: ['b-mint', 'مستلم بالخزينة']
};
function Badge({ s }) {
  const [c, t] = ST[s] || ['b-dim', s];
  return <span className={'badge ' + c}>{t}</span>;
}

function Kpi({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="kpi" style={{ '--acc': color }}>
      <div className="kpi-l">{Icon && <Icon size={13} color={color} />}{label}</div>
      <div className="kpi-v num" style={{ color }}>{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

function Notifications({ ops, commit, onClose }) {
  const list = [...(ops.notifications || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const markAll = () => commit(d => ({ ...d, notifications: (d.notifications || []).map(n => ({ ...n, isRead: true })) }));
  return (
    <Modal title="مركز التنبيهات" icon={Bell} onClose={onClose}
      foot={<><button className="btn" onClick={markAll}><Check size={14} />تعليم الكل كمقروء</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      {list.length === 0 && <div className="empty">لا توجد تنبيهات حالياً.</div>}
      {list.map(n => (
        <div key={n.id} className="mono-b" style={{ marginBottom: 8, alignItems: 'flex-start', opacity: n.isRead ? .55 : 1 }}>
          <div>
            <div className="row" style={{ gap: 7, marginBottom: 3 }}>
              <span className={'badge ' + (n.severity === 'high' ? 'b-rose' : n.severity === 'medium' ? 'b-amber' : 'b-sky')}>
                {n.severity === 'high' ? 'عاجل' : n.severity === 'medium' ? 'متابعة' : 'معلومة'}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{n.title}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{n.message}</div>
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>{arTime(n.createdAt)}</div>
          </div>
        </div>
      ))}
    </Modal>
  );
}

/* ================= لوحة المؤشرات ================= */
function Dashboard({ org, ops, pulse, me, myBranches, scoped, online, setTab, theme }) {
  const [days, setDays] = useState(14);
  const tn = chartTone(theme);
  const cls = scoped.closings;
  const from = new Date(); from.setDate(from.getDate() - days);
  const fromS = from.toISOString().slice(0, 10);
  const win = cls.filter(c => c.date >= fromS);

  const rev = sum(win, c => c.totalRevenue);
  const exp = sum(win, c => c.totalExpenses);
  const net = rev - exp;
  const margin = rev ? (net / rev) * 100 : 0;
  const varSum = sum(win, c => c.variance);
  const deficits = win.filter(c => c.variance < 0);

  const series = useMemo(() => {
    const map = {};
    win.forEach(c => {
      if (!map[c.date]) map[c.date] = { d: c.date, rev: 0, exp: 0, cash: 0 };
      map[c.date].rev += c.totalRevenue; map[c.date].exp += c.totalExpenses; map[c.date].cash += c.cashSales;
    });
    return Object.values(map).sort((a, b) => a.d.localeCompare(b.d))
      .map(x => ({ ...x, lbl: x.d.slice(5).replace('-', '/'), net: x.rev - x.exp }));
  }, [win]);

  const perBranch = useMemo(() => myBranches.map(b => {
    const bc = win.filter(c => c.branchId === b.id);
    const r = sum(bc, c => c.totalRevenue), e = sum(bc, c => c.totalExpenses);
    return { name: b.name.replace('الفرع ', '').replace('فرع ', ''), rev: r, exp: e, net: r - e, id: b.id, n: bc.length };
  }).sort((a, b) => b.net - a.net), [win, myBranches]);

  const channels = useMemo(() => [
    { k: 'نقدي', v: sum(win, c => c.cashSales), c: '#4FB286' },
    { k: 'شبكة', v: sum(win, c => c.cardSales), c: '#5B93C4' },
    { k: 'تطبيقات', v: sum(win, c => c.totalDeliverySales), c: '#C8A24A' },
    { k: 'تحويل بنكي', v: sum(win, c => c.bankTransferSales || 0), c: '#9B7BB8' }
  ], [win]);
  const chTotal = sum(channels, c => c.v) || 1;

  const pendingT = scoped.transfers.filter(t => t.status === 'pending');
  const missing = myBranches.filter(b => !cls.some(c => c.date === today() && c.branchId === b.id));
  const audit = (pulse.audit || []).slice(0, 8);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مرحباً {me.name.split(' ')[0]} 👋</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            {myBranches.length} فرع ضمن نطاق صلاحيتك · آخر {days} يوماً
          </div>
        </div>
        <div className="row">
          {[7, 14, 30].map(d => (
            <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="إجمالي الإيرادات" value={money(rev)} sub={`${win.length} إغلاق مسجل`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="إجمالي المصروفات" value={money(exp)} sub={`${rev ? ((exp / rev) * 100).toFixed(1) : 0}% من الإيراد`} icon={Receipt} color="#D9544D" />
        <Kpi label="صافي الربح" value={money(net)} sub={`هامش ${margin.toFixed(1)}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="فروقات الصندوق" value={money(varSum)} sub={`${deficits.length} حالة عجز`} icon={AlertTriangle} color={varSum < 0 ? '#D9544D' : '#5B93C4'} />
      </div>

      {(missing.length > 0 || pendingT.length > 0) && (
        <div className="grid g2">
          {missing.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(224,164,88,.35)' }}>
              <div className="card-t" style={{ color: 'var(--amber)' }}><AlertTriangle size={15} />إغلاقات اليوم لم تُسجّل بعد</div>
              {missing.map(b => (
                <div key={b.id} className="mono-b" style={{ marginBottom: 7 }}>
                  <div><div style={{ fontSize: 12.5 }}>{b.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>نهاية الوردية {b.shiftEndTime}</div></div>
                  <button className="btn sm pri" onClick={() => setTab('closing')}>تسجيل الآن</button>
                </div>
              ))}
            </div>
          )}
          {pendingT.length > 0 && (
            <div className="card">
              <div className="card-t"><Landmark size={15} color="var(--brass)" />تحويلات بانتظار الاستلام</div>
              <div className="kpi-v num" style={{ color: 'var(--brass)' }}>{money(sum(pendingT, t => t.amount))}</div>
              <div className="kpi-s">{pendingT.length} سند تحويل من {new Set(pendingT.map(t => t.branchId)).size} فرع</div>
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setTab('treasury')}>
                <ArrowLeftRight size={13} />فتح الخزينة
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <div className="card-t"><TrendingUp size={15} color="var(--brass)" />حركة الإيرادات والمصروفات</div>
          <span className="badge b-dim">ريال سعودي</span>
        </div>
        <div style={{ height: 260, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C8A24A" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#C8A24A" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D9544D" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D9544D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                labelStyle={{ color: '#A2968A' }} formatter={(v, n) => [money(v), n === 'rev' ? 'الإيراد' : n === 'exp' ? 'المصروف' : 'الصافي']} />
              <Area type="monotone" dataKey="rev" stroke="#C8A24A" strokeWidth={2} fill="url(#gr)" />
              <Area type="monotone" dataKey="exp" stroke="#D9544D" strokeWidth={1.6} fill="url(#ge)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-t" style={{ marginBottom: 14 }}><Store size={15} color="var(--brass)" />أداء الفروع</div>
          <div style={{ height: 210, direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBranch} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={tn.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tn.tick, fontSize: 9.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }}
                  contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                  formatter={(v, n) => [money(v), n === 'rev' ? 'الإيراد' : 'الصافي']} />
                <Bar dataKey="rev" fill={tn.bar} radius={[5, 5, 0, 0]} />
                <Bar dataKey="net" fill="#C8A24A" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-t" style={{ marginBottom: 14 }}><Banknote size={15} color="var(--brass)" />توزيع قنوات التحصيل</div>
          {channels.map((c, i) => (
            <div key={i} style={{ marginBottom: 13 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span>{c.k}</span>
                <span className="num" style={{ color: c.c }}>{money(c.v)} · {((c.v / chTotal) * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: ((c.v / chTotal) * 100) + '%', height: '100%', background: c.c, borderRadius: 6, transition: '.5s' }} />
              </div>
            </div>
          ))}
          <hr className="hr" />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--dim)' }}>عمولات تطبيقات التوصيل المقدّرة</span>
            <span className="num" style={{ color: 'var(--rose)' }}>
              {money(sum(win, c => sum(c.deliverySales || [], d => d.commissionAmount || 0)))}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><Radio size={15} color="var(--mint)" />النشاط اللحظي على المنصة</div>
          <span className="badge b-mint"><span className="dot" />{online.map(o => o.name.split(' ')[0]).join('، ') || 'أنت فقط'}</span>
        </div>
        {audit.length === 0 && <div className="empty">لا يوجد نشاط بعد — أي إجراء تقوم به سيظهر هنا لدى بقية المستخدمين.</div>}
        {audit.map(a => (
          <div key={a.id} className="feed">
            <div className="feed-d" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><b style={{ fontWeight: 600 }}>{a.userName}</b> <span style={{ color: 'var(--dim)' }}>{a.title}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{a.details} · {arTime(a.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= الإغلاق اليومي ================= */
function Closing({ org, ops, me, myBranches, scoped, commit, say }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const canEdit = me.role === 'branch_manager' || me.role === 'general_management';
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [bid, setBid] = useState('all');
  const [limit, setLimit] = useState(15);

  const filtered = [...scoped.closings]
    .filter(c => st === 'all' || c.status === st)
    .filter(c => bid === 'all' || c.branchId === bid)
    .filter(c => !q || (c.branchName + c.date + c.managerName).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const list = filtered.slice(0, limit);

  const remove = (c) => commit(
    d => ({ ...d, closings: d.closings.filter(x => x.id !== c.id), transfers: d.transfers.filter(t => t.closingId !== c.id) }),
    { actionType: 'delete', targetType: 'daily_closing', targetId: c.id, branchName: c.branchName, title: 'حذف إغلاق يومي', details: `${c.branchName} — ${arDate(c.date)}` }
  ).then(() => say('تم حذف الإغلاق'));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
          سجل إغلاقات الورديات — مطابقة النقدية وترحيلها للخزينة الرئيسية
        </div>
        {canEdit && (
          <button className="btn pri" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus size={15} />إغلاق وردية جديد
          </button>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 7, flex: 1, minWidth: 200 }}>
            <Search size={14} color="var(--faint)" />
            <input className="inp" style={{ flex: 1, minWidth: 150 }} placeholder="بحث بالفرع أو التاريخ أو المسؤول"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="sel" style={{ width: 165 }} value={st} onChange={e => setSt(e.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="submitted">مرحّل للمراجعة</option>
            <option value="approved">مدقّق ومعتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
          {myBranches.length > 1 && (
            <select className="sel" style={{ width: 190 }} value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">كل الفروع</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <span className="badge b-dim"><span className="num">{filtered.length}</span> نتيجة</span>
        </div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>التاريخ</th><th>الفرع</th><th>الإيراد</th><th>المصروف</th>
              <th>المتوقع بالصندوق</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(c.date)}</td>
                  <td style={{ fontSize: 12 }}>{c.branchName}</td>
                  <td className="num" style={{ color: 'var(--brass)' }}>{money(c.totalRevenue)}</td>
                  <td className="num" style={{ color: 'var(--rose)' }}>{money(c.totalExpenses)}</td>
                  <td className="num">{money(c.expectedCashInSafe)}</td>
                  <td className="num">{money(c.actualCashCount)}</td>
                  <td className="num" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>
                    {c.variance > 0 ? '+' : ''}{money(c.variance)}
                  </td>
                  <td><Badge s={c.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                      <button className="btn sm gh" onClick={() => setView(c)}><Eye size={13} /></button>
                      {canEdit && c.status === 'draft' && (
                        <>
                          <button className="btn sm gh" onClick={() => { setEdit(c); setOpen(true); }}>تعديل</button>
                          <button className="btn sm gh" onClick={() => remove(c)}><Trash2 size={13} color="#D9544D" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={9}><div className="empty">
                {scoped.closings.length ? 'لا نتائج مطابقة لبحثك.' : 'لا توجد إغلاقات ضمن نطاقك بعد.'}
              </div></td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimit(l => l + 15)}>
            عرض 15 إغلاقاً إضافياً ({filtered.length - limit} متبقٍ)
          </button>
        )}
      </div>

      {open && (
        <ClosingForm org={org} me={me} branches={myBranches} initial={edit} commit={commit} say={say}
          existing={ops.closings || []}
          onClose={() => { setOpen(false); setEdit(null); }} />
      )}
      {view && <ClosingView c={view} onClose={() => setView(null)} />}
    </div>
  );
}

function ClosingForm({ org, me, branches, initial, commit, say, onClose, existing = [] }) {
  const [f, setF] = useState(() => initial || {
    date: today(), branchId: branches[0]?.id || '',
    openingBalance: branches[0]?.defaultFloat || 0,
    cashSales: 0, cardSales: 0, bankTransferSales: 0,
    deliverySales: APPS.map(a => ({ appId: a.id, appName: a.n, amount: 0, orderCount: 0, commissionPercentage: a.c })),
    expenses: [], denominationDetails: emptyDenoms(),
    transferredToMainTreasury: 0, varianceReason: '', notes: ''
  });
  const [step, setStep] = useState(1);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const branch = org.branches.find(b => b.id === f.branchId);

  const totalDelivery = sum(f.deliverySales, d => d.amount);
  const totalRevenue = f.cashSales + f.cardSales + (f.bankTransferSales || 0) + totalDelivery;
  const cashExp = sum(f.expenses.filter(e => e.paymentMethod === 'cash'), e => e.amount);
  const totalExp = sum(f.expenses, e => e.amount);
  const expected = f.openingBalance + f.cashSales - cashExp;
  const actual = countDenoms(f.denominationDetails);
  const variance = Math.round((actual - expected) * 100) / 100;
  const retained = Math.max(0, actual - f.transferredToMainTreasury);

  const setDen = (k, v) => set('denominationDetails', { ...f.denominationDetails, [k]: Math.max(0, v) });
  const addExp = () => set('expenses', [...f.expenses, {
    id: uid('x'), categoryId: 'ec1', categoryName: 'مشتريات مواد خام', amount: 0,
    paymentMethod: 'cash', beneficiaryName: '', receiptNumber: '', isTaxable: true
  }]);
  const upExp = (id, k, v) => set('expenses', f.expenses.map(e => {
    if (e.id !== id) return e;
    const n = { ...e, [k]: v };
    if (k === 'categoryId') { const c = (org.expenseCats || EXP_CATS).find(x => x.id === v); n.categoryName = c?.n || ''; n.isTaxable = !!c?.taxable; }
    return n;
  }));

  const save = async (status) => {
    if (!f.branchId) return say('اختر الفرع أولاً', 'no');
    if (totalRevenue <= 0) return say('أدخل مبيعات الوردية قبل الحفظ', 'no');
    const dup = existing.find(c => c.branchId === f.branchId && c.date === f.date && c.id !== initial?.id);
    if (dup) return say('يوجد إغلاق مسجّل لهذا الفرع بنفس التاريخ — عدّل الإغلاق القائم بدل إنشاء نسخة ثانية', 'no');
    if (status === 'submitted') {
      if (actual <= 0) return say('أكمل جرد الفئات النقدية قبل الترحيل', 'no');
      if (variance !== 0 && !f.varianceReason.trim()) return say('وثّق سبب العجز أو الفائض قبل الترحيل', 'no');
      if (f.transferredToMainTreasury > actual) return say('المرحّل للخزينة يتجاوز النقد المعدود', 'no');
    }
    const id = initial?.id || 'cl-' + f.branchId + '-' + f.date + '-' + Math.random().toString(36).slice(2, 5);
    const ref = 'TR-' + f.date.replace(/-/g, '') + '-' + f.branchId.slice(-2);
    const rec = {
      ...f, id, branchName: branch?.name || '', managerName: me.name,
      deliverySales: f.deliverySales.map(d => ({ ...d, commissionAmount: Math.round(d.amount * (d.commissionPercentage || 0)) / 100 })),
      totalDeliverySales: totalDelivery, otherRevenues: [], totalOtherRevenues: 0,
      totalRevenue, totalExpenses: totalExp, totalCashExpenses: cashExp,
      totalCardExpenses: sum(f.expenses.filter(e => e.paymentMethod === 'card'), e => e.amount),
      expectedCashInSafe: expected, actualCashCount: actual, variance,
      retainedFloatForTomorrow: retained, transferReferenceNo: ref,
      transferStatus: status === 'submitted' ? 'pending' : 'pending',
      status, gmApprovalStatus: 'pending',
      createdBy: me.name, createdAt: initial?.createdAt || nowISO(), updatedAt: nowISO()
    };
    await commit(d => {
      const closings = [rec, ...d.closings.filter(c => c.id !== id)];
      let transfers = d.transfers.filter(t => t.closingId !== id);
      if (status === 'submitted' && rec.transferredToMainTreasury > 0) {
        transfers = [{
          id: uid('tr'), closingId: id, date: f.date, branchId: f.branchId, branchName: rec.branchName,
          amount: rec.transferredToMainTreasury, referenceNo: ref, status: 'pending'
        }, ...transfers];
      }
      let notifications = d.notifications || [];
      if (status === 'submitted') {
        notifications = [{
          id: uid('n'), type: 'closing_submitted', title: 'إغلاق جديد بانتظار التدقيق',
          message: `${rec.branchName} — ${arDate(f.date)} · إيراد ${money(totalRevenue)} ر.س`,
          severity: variance < 0 ? 'high' : 'medium', branchId: f.branchId, closingId: id,
          date: f.date, createdAt: nowISO(), isRead: false
        }, ...notifications].slice(0, 60);
        if (variance < 0) notifications = [{
          id: uid('n'), type: 'cash_deficit', title: 'عجز نقدي في الصندوق',
          message: `${rec.branchName}: عجز بمقدار ${money(Math.abs(variance))} ر.س بتاريخ ${arDate(f.date)}`,
          severity: 'high', branchId: f.branchId, date: f.date, createdAt: nowISO(), isRead: false
        }, ...notifications].slice(0, 60);
      }
      return { ...d, closings, transfers, notifications };
    }, {
      actionType: initial ? 'update' : 'create', targetType: 'daily_closing', targetId: id,
      branchId: f.branchId, branchName: rec.branchName,
      title: status === 'submitted' ? 'رحّل إغلاق وردية' : 'حفظ مسودة إغلاق',
      details: `${rec.branchName} — ${arDate(f.date)} · إيراد ${money(totalRevenue)} · فرق ${money(variance)}`
    });
    say(status === 'submitted' ? 'تم ترحيل الإغلاق للإدارة المالية' : 'تم حفظ المسودة');
    onClose();
  };

  const steps = ['المبيعات', 'المصروفات', 'جرد الصندوق', 'الترحيل'];

  return (
    <Modal wide title={initial ? 'تعديل إغلاق وردية' : 'إغلاق وردية جديد'} icon={ClipboardCheck} onClose={onClose}
      foot={<>
        {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>السابق</button>}
        {step < 4 && <button className="btn pri" onClick={() => setStep(step + 1)}>التالي</button>}
        {step === 4 && <>
          <button className="btn pri" onClick={() => save('submitted')}><Send size={14} />ترحيل للإدارة المالية</button>
          <button className="btn" onClick={() => save('draft')}>حفظ كمسودة</button>
        </>}
        <button className="btn gh" onClick={onClose}>إلغاء</button>
      </>}>

      <div className="row" style={{ marginBottom: 16, gap: 6 }}>
        {steps.map((s, i) => (
          <button key={s} className={'btn sm' + (step === i + 1 ? ' pri' : ' gh')} onClick={() => setStep(i + 1)}>
            <span className="num">{i + 1}</span> {s}
          </button>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="grid g2">
            <Field label="الفرع">
              <select className="sel" value={f.branchId} disabled={me.role === 'branch_manager' && !!initial}
                onChange={e => { const b = org.branches.find(x => x.id === e.target.value); setF(p => ({ ...p, branchId: e.target.value, openingBalance: b?.defaultFloat || 0 })); }}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="تاريخ الوردية">
              <input type="date" className="inp" value={f.date} onChange={e => set('date', e.target.value)} />
            </Field>
          </div>
          <div className="grid g3">
            <Num label="العهدة الافتتاحية" value={f.openingBalance} onChange={v => set('openingBalance', v)} hint="رصيد بداية الوردية" />
            <Num label="مبيعات نقدية (كاش)" value={f.cashSales} onChange={v => set('cashSales', v)} />
            <Num label="مبيعات الشبكة (مدى/فيزا)" value={f.cardSales} onChange={v => set('cardSales', v)} />
          </div>
          <Num label="مبيعات تحويل بنكي مباشر" value={f.bankTransferSales} onChange={v => set('bankTransferSales', v)} />
          <hr className="hr" />
          <div className="lbl" style={{ marginBottom: 10 }}>مبيعات تطبيقات التوصيل</div>
          {f.deliverySales.map((d, i) => (
            <div key={d.appId} className="mono-b" style={{ marginBottom: 8 }}>
              <div style={{ minWidth: 78 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.appName}</div>
                <div style={{ fontSize: 10, color: 'var(--faint)' }}>عمولة <span className="num">{d.commissionPercentage}%</span></div>
              </div>
              <input className="inp n" style={{ maxWidth: 130 }} inputMode="decimal" placeholder="0.00"
                value={d.amount === 0 ? '' : d.amount}
                onChange={e => { const v = Number(e.target.value.replace(/[^\d.]/g, '')) || 0; const n = [...f.deliverySales]; n[i] = { ...d, amount: v }; set('deliverySales', n); }} />
              <input className="inp n" style={{ maxWidth: 78 }} inputMode="numeric" placeholder="طلبات"
                value={d.orderCount === 0 ? '' : d.orderCount}
                onChange={e => { const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0; const n = [...f.deliverySales]; n[i] = { ...d, orderCount: v }; set('deliverySales', n); }} />
            </div>
          ))}
          <div className="mono-b" style={{ marginTop: 12, borderColor: 'var(--brass-d)' }}>
            <span style={{ fontSize: 12.5 }}>إجمالي إيراد الوردية</span>
            <span className="num" style={{ fontSize: 17, color: 'var(--brass)', fontWeight: 600 }}>{money(totalRevenue)}</span>
          </div>
        </>
      )}

      {step === 2 && (
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
                    <option value="card">شبكة</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="deferred">آجل (على الحساب)</option>
                  </select>
                </Field>
              </div>
              <div className="grid g3" style={{ gap: 9 }}>
                <Num label="المبلغ" value={e.amount} onChange={v => upExp(e.id, 'amount', v)} />
                <Field label="المستفيد / المورد">
                  <input className="inp" value={e.beneficiaryName || ''} placeholder="اسم الجهة"
                    onChange={ev => upExp(e.id, 'beneficiaryName', ev.target.value)} />
                </Field>
                <Field label="رقم الإيصال">
                  <input className="inp" value={e.receiptNumber || ''} placeholder="اختياري"
                    onChange={ev => upExp(e.id, 'receiptNumber', ev.target.value)} />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="badge b-dim">
                  {e.isTaxable ? <>ضريبة 15% ≈ <span className="num">{money(e.amount * 15 / 115)}</span></> : 'غير خاضع للضريبة'}
                </span>
                <button className="btn sm gh" onClick={() => set('expenses', f.expenses.filter(x => x.id !== e.id))}>
                  <Trash2 size={13} color="#D9544D" />حذف
                </button>
              </div>
            </div>
          ))}
          <div className="grid g2" style={{ marginTop: 12 }}>
            <div className="mono-b"><span style={{ fontSize: 12 }}>إجمالي المصروفات</span>
              <span className="num" style={{ color: 'var(--rose)', fontWeight: 600 }}>{money(totalExp)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 12 }}>المخصوم نقداً من الصندوق</span>
              <span className="num" style={{ color: 'var(--amber)', fontWeight: 600 }}>{money(cashExp)}</span></div>
          </div>
        </>
      )}

      {step === 3 && (
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

          <div style={{ marginTop: 14 }}>
            {actual > 0 && (
              <div className="seal" style={{ '--sc': variance === 0 ? 'var(--mint)' : variance < 0 ? 'var(--rose)' : 'var(--amber)' }}>
                <Stamp size={22} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "'Readex Pro',sans-serif" }}>
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
      )}

      {step === 4 && (
        <>
          <div className="grid g2">
            <Num label="المرحّل للخزينة الرئيسية" value={f.transferredToMainTreasury}
              onChange={v => set('transferredToMainTreasury', Math.min(v, actual))}
              hint={`أقصى مبلغ متاح ${money(actual)} ر.س`} />
            <div className="fld">
              <label className="lbl">المتبقي كعهدة للغد</label>
              <div className="mono-b"><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>محسوب آلياً</span>
                <span className="num" style={{ fontWeight: 600, color: 'var(--mint)' }}>{money(retained)}</span></div>
            </div>
          </div>
          <button className="btn sm" style={{ marginBottom: 14 }}
            onClick={() => set('transferredToMainTreasury', Math.max(0, actual - (branch?.defaultFloat || 0)))}>
            <Wallet size={13} />ترحيل الفائض وإبقاء العهدة ({money(branch?.defaultFloat || 0)})
          </button>
          <Field label="ملاحظات الإغلاق">
            <textarea className="inp" value={f.notes} placeholder="ملاحظات المدير على الوردية"
              onChange={e => set('notes', e.target.value)} />
          </Field>
          <Field label="توقيع المسؤول الرقمي">
            <SignaturePad value={f.managerSignature} onChange={v => set('managerSignature', v)} />
          </Field>
          <hr className="hr" />
          <div className="grid g2" style={{ gap: 9 }}>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>إجمالي الإيراد</span><span className="num" style={{ color: 'var(--brass)' }}>{money(totalRevenue)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>إجمالي المصروف</span><span className="num" style={{ color: 'var(--rose)' }}>{money(totalExp)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>صافي اليوم</span><span className="num" style={{ color: 'var(--mint)' }}>{money(totalRevenue - totalExp)}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11.5 }}>سند التحويل</span><span className="num" style={{ fontSize: 11 }}>TR-{f.date.replace(/-/g, '')}</span></div>
          </div>
        </>
      )}
    </Modal>
  );
}

function ClosingView({ c, onClose }) {
  const Row = ({ k, v, color }) => (
    <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(51,44,38,.5)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--dim)' }}>{k}</span><span className="num" style={{ color }}>{v}</span>
    </div>
  );
  return (
    <Modal wide title={`إغلاق ${c.branchName} — ${arDate(c.date)}`} icon={Receipt} onClose={onClose}
      foot={<><button className="btn pri" onClick={() => printReceipt(c)}><Printer size={14} />طباعة إيصال الإغلاق</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Badge s={c.status} />
        {c.gmApprovalStatus === 'approved' && <span className="badge b-brass"><ShieldCheck size={11} />معتمد من الإدارة العليا</span>}
        <span className="badge b-dim">المسؤول: {c.managerName}</span>
        {c.auditedBy && <span className="badge b-sky">دقّقه: {c.auditedBy}</span>}
      </div>
      <div className="grid g2">
        <div className="card" style={{ background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>الإيرادات</div>
          <Row k="مبيعات نقدية" v={money(c.cashSales)} />
          <Row k="مبيعات الشبكة" v={money(c.cardSales)} />
          <Row k="تحويل بنكي" v={money(c.bankTransferSales || 0)} />
          {(c.deliverySales || []).filter(d => d.amount > 0).map(d => (
            <Row key={d.appId} k={`${d.appName} (${d.orderCount} طلب)`} v={money(d.amount)} />
          ))}
          <Row k="الإجمالي" v={money(c.totalRevenue)} color="var(--brass)" />
        </div>
        <div className="card" style={{ background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>المصروفات</div>
          {(c.expenses || []).map(e => (
            <Row key={e.id} k={`${e.categoryName}${e.beneficiaryName ? ' — ' + e.beneficiaryName : ''}`} v={money(e.amount)} />
          ))}
          {(!c.expenses || c.expenses.length === 0) && <div className="empty" style={{ padding: 18 }}>لا مصروفات</div>}
          <Row k="الإجمالي" v={money(c.totalExpenses)} color="var(--rose)" />
        </div>
      </div>
      <hr className="hr" />
      <div className="lbl" style={{ marginBottom: 10 }}>جرد الفئات النقدية</div>
      <div className="notes">
        {DENOMS.filter(d => (c.denominationDetails?.[d.k] || 0) > 0).map(d => (
          <div key={d.k} className="note" style={{ '--nc': d.c }}>
            <div className="note-v">{d.k === 'coins' ? 'هللات' : d.v}</div>
            <div className="note-u">عدد <span className="num">{c.denominationDetails[d.k]}</span></div>
            <div className="note-t">{money((c.denominationDetails[d.k] || 0) * d.v)}</div>
          </div>
        ))}
      </div>
      <div className="grid g3" style={{ marginTop: 14 }}>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>المتوقع</span><span className="num">{money(c.expectedCashInSafe)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>الفعلي</span><span className="num">{money(c.actualCashCount)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>الفرق</span>
          <span className="num" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(c.variance)}</span></div>
      </div>
      {c.varianceReason && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dim)' }}>سبب الفرق: {c.varianceReason}</div>}
      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>المرحّل للخزينة</span><span className="num" style={{ color: 'var(--brass)' }}>{money(c.transferredToMainTreasury)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>عهدة الغد</span><span className="num">{money(c.retainedFloatForTomorrow)}</span></div>
      </div>
      {c.notes && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--dim)' }}>ملاحظات: {c.notes}</div>}
      {c.managerSignature && (
        <div style={{ marginTop: 12 }}>
          <div className="lbl">توقيع المسؤول</div>
          <img src={c.managerSignature} alt="توقيع" style={{ maxWidth: 240, background: '#fff', borderRadius: 8, padding: 4 }} />
        </div>
      )}
    </Modal>
  );
}

/* ================= التدقيق والاعتماد ================= */
function Approvals({ me, scoped, commit, say }) {
  const [note, setNote] = useState({});
  const [view, setView] = useState(null);
  const isGM = me.role === 'general_management';
  const queue = scoped.closings.filter(c => c.status === 'submitted' || (c.status === 'approved' && c.gmApprovalStatus === 'pending'))
    .sort((a, b) => b.date.localeCompare(a.date));

  const act = async (c, kind) => {
    const reason = note[c.id] || '';
    if (kind === 'reject' && !reason) return say('اكتب سبب الرفض قبل الإرجاع', 'no');
    await commit(d => ({
      ...d,
      closings: d.closings.map(x => {
        if (x.id !== c.id) return x;
        if (kind === 'audit') return { ...x, status: 'approved', auditedBy: me.name, auditedAt: nowISO(), updatedAt: nowISO() };
        if (kind === 'gm') return { ...x, gmApprovalStatus: 'approved', gmApprovedBy: me.name, gmApprovedAt: nowISO(), gmNotes: reason, updatedAt: nowISO() };
        return { ...x, status: 'rejected', rejectionReason: reason, updatedAt: nowISO() };
      }),
      notifications: [{
        id: uid('n'), type: kind === 'reject' ? 'closing_rejected' : 'gm_approval',
        title: kind === 'reject' ? 'إغلاق مرفوض ويحتاج تصحيحاً' : kind === 'gm' ? 'اعتماد نهائي من الإدارة العليا' : 'تم تدقيق الإغلاق',
        message: `${c.branchName} — ${arDate(c.date)}${reason ? ' · ' + reason : ''}`,
        severity: kind === 'reject' ? 'high' : 'info', branchId: c.branchId, closingId: c.id,
        date: c.date, createdAt: nowISO(), isRead: false
      }, ...(d.notifications || [])].slice(0, 60)
    }), {
      actionType: kind === 'reject' ? 'reject' : 'approve', targetType: 'daily_closing', targetId: c.id,
      branchName: c.branchName,
      title: kind === 'audit' ? 'دقّق إغلاقاً مالياً' : kind === 'gm' ? 'اعتمد إغلاقاً نهائياً' : 'أرجع إغلاقاً للتصحيح',
      details: `${c.branchName} — ${arDate(c.date)}${reason ? ' · ' + reason : ''}`
    });
    say(kind === 'reject' ? 'أُرجع الإغلاق للفرع مع السبب' : 'تم الاعتماد بنجاح');
    setNote(p => ({ ...p, [c.id]: '' }));
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g3">
        <Kpi label="بانتظار التدقيق المالي" value={scoped.closings.filter(c => c.status === 'submitted').length} icon={ClipboardCheck} color="#E0A458" />
        <Kpi label="بانتظار الاعتماد النهائي" value={scoped.closings.filter(c => c.status === 'approved' && c.gmApprovalStatus === 'pending').length} icon={ShieldCheck} color="#5B93C4" />
        <Kpi label="إغلاقات بها فروقات" value={queue.filter(c => c.variance !== 0).length} icon={AlertTriangle} color="#D9544D" />
      </div>

      {queue.length === 0 && <div className="card"><div className="empty">لا يوجد ما ينتظر إجراءك — كل الإغلاقات مدقّقة ومعتمدة.</div></div>}

      {queue.map(c => {
        const needAudit = c.status === 'submitted';
        const canAct = needAudit ? (me.role === 'finance_department' || isGM) : isGM;
        return (
          <div key={c.id} className="card" style={{ borderColor: c.variance < 0 ? 'rgba(217,84,77,.3)' : 'var(--line)' }}>
            <div className="card-h">
              <div>
                <div className="card-t">{c.branchName}<span className="num" style={{ color: 'var(--faint)', fontSize: 12 }}>{arDate(c.date)}</span></div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>سجّله {c.managerName} · {arTime(c.createdAt)}</div>
              </div>
              <div className="row">
                <Badge s={c.status} />
                {needAudit ? <span className="badge b-dim">المرحلة 1: تدقيق مالي</span> : <span className="badge b-sky">المرحلة 2: اعتماد نهائي</span>}
              </div>
            </div>
            <div className="grid g4" style={{ gap: 9 }}>
              <div className="mono-b"><span style={{ fontSize: 11 }}>الإيراد</span><span className="num" style={{ color: 'var(--brass)' }}>{money(c.totalRevenue)}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11 }}>المصروف</span><span className="num" style={{ color: 'var(--rose)' }}>{money(c.totalExpenses)}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11 }}>المرحّل</span><span className="num">{money(c.transferredToMainTreasury)}</span></div>
              <div className="mono-b" style={{ borderColor: c.variance !== 0 ? 'rgba(217,84,77,.4)' : 'var(--line)' }}>
                <span style={{ fontSize: 11 }}>الفرق</span>
                <span className="num" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(c.variance)}</span>
              </div>
            </div>
            {c.varianceReason && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 10 }}>تبرير الفرق: {c.varianceReason}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <input className="inp" style={{ flex: 1, minWidth: 180 }} placeholder="ملاحظة التدقيق أو سبب الإرجاع"
                value={note[c.id] || ''} onChange={e => setNote(p => ({ ...p, [c.id]: e.target.value }))} />
              <button className="btn sm gh" onClick={() => setView(c)}><Eye size={13} />تفاصيل</button>
              {canAct ? (
                <>
                  <button className="btn sm ok" onClick={() => act(c, needAudit ? 'audit' : 'gm')}>
                    <Check size={13} />{needAudit ? 'اعتماد التدقيق' : 'اعتماد نهائي'}
                  </button>
                  <button className="btn sm no" onClick={() => act(c, 'reject')}><X size={13} />إرجاع</button>
                </>
              ) : <span className="badge b-dim"><Lock size={10} />خارج صلاحيتك</span>}
            </div>
          </div>
        );
      })}
      {view && <ClosingView c={view} onClose={() => setView(null)} />}
    </div>
  );
}

/* ================= الخزينة الرئيسية ================= */
function Treasury({ org, ops, me, myBranches, scoped, commit, say }) {
  const [tab, setTab] = useState('in');
  const [add, setAdd] = useState(false);
  const canReceive = me.role !== 'branch_manager';
  const isCentral = me.role !== 'branch_manager';

  const list = [...scoped.transfers].sort((a, b) => b.date.localeCompare(a.date));
  const pending = list.filter(t => t.status === 'pending');
  const received = list.filter(t => t.status === 'received');
  const disb = isCentral ? [...(ops.disbursements || [])].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const inflow = sum((ops.transfers || []).filter(t => t.status === 'received'), t => t.amount);
  const outflow = sum(ops.disbursements || [], d => d.amount);
  const balance = inflow - outflow;

  const receive = async (t, ok) => {
    await commit(d => ({
      ...d,
      transfers: d.transfers.map(x => x.id === t.id ? {
        ...x, status: ok ? 'received' : 'rejected', receivedBy: me.name, receivedAt: nowISO()
      } : x),
      closings: d.closings.map(c => c.id === t.closingId ? { ...c, transferStatus: ok ? 'received' : 'rejected' } : c)
    }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: t.id, branchName: t.branchName,
      title: ok ? 'استلم تحويلاً نقدياً بالخزينة' : 'رفض سند تحويل',
      details: `${t.branchName} · ${money(t.amount)} ر.س · سند ${t.referenceNo}`
    });
    say(ok ? 'تم تأكيد استلام المبلغ في الخزينة الرئيسية' : 'تم رفض السند وإبلاغ الفرع');
  };

  const ledger = useMemo(() => {
    const items = [
      ...(ops.transfers || []).filter(t => t.status === 'received')
        .map(t => ({ id: t.id, date: t.date, kind: 'in', label: 'توريد من ' + t.branchName, ref: t.referenceNo, amount: t.amount })),
      ...(ops.disbursements || [])
        .map(x => ({ id: x.id, date: x.date, kind: 'out', label: x.category + ' — ' + x.beneficiary, ref: x.reference, amount: x.amount }))
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let run = 0;
    return items.map(i => { run += i.kind === 'in' ? i.amount : -i.amount; return { ...i, run }; }).reverse();
  }, [ops]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        {isCentral && <Kpi label="رصيد الخزينة الرئيسية" value={money(balance)} sub="الوارد ناقص المنصرف" icon={Landmark} color="#C8A24A" />}
        <Kpi label="بانتظار الاستلام" value={money(sum(pending, t => t.amount))} sub={`${pending.length} سند`} icon={ArrowLeftRight} color="#E0A458" />
        <Kpi label="الوارد المستلم" value={money(isCentral ? inflow : sum(received, t => t.amount))} sub={`${received.length} سند من فروعك`} icon={TrendingUp} color="#4FB286" />
        {isCentral && <Kpi label="المنصرف من الخزينة" value={money(outflow)} sub={`${disb.length} أمر صرف`} icon={TrendingDown} color="#D9544D" />}
      </div>

      <div className="row">
        <button className={'btn sm' + (tab === 'in' ? ' pri' : ' gh')} onClick={() => setTab('in')}>
          <ArrowLeftRight size={14} />سندات التوريد
        </button>
        {isCentral && <>
          <button className={'btn sm' + (tab === 'out' ? ' pri' : ' gh')} onClick={() => setTab('out')}>
            <Banknote size={14} />أوامر الصرف
          </button>
          <button className={'btn sm' + (tab === 'led' ? ' pri' : ' gh')} onClick={() => setTab('led')}>
            <FileText size={14} />كشف حركة الخزينة
          </button>
          {tab === 'out' && <button className="btn pri" style={{ marginInlineStart: 'auto' }} onClick={() => setAdd(true)}>
            <Plus size={15} />أمر صرف جديد
          </button>}
        </>}
      </div>

      {tab === 'in' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Landmark size={15} color="var(--brass)" />سندات ترحيل النقدية من الفروع</div>
            {!canReceive && <span className="badge b-dim"><Lock size={10} />الاستلام من صلاحية الإدارة المالية</span>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>الفرع</th><th>رقم السند</th><th>المبلغ</th><th>الحالة</th><th>المستلم</th><th></th></tr></thead>
              <tbody>
                {list.slice(0, 60).map(t => (
                  <tr key={t.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(t.date)}</td>
                    <td style={{ fontSize: 12 }}>{t.branchName}</td>
                    <td className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{t.referenceNo}</td>
                    <td className="num" style={{ color: 'var(--brass)', fontWeight: 600 }}>{money(t.amount)}</td>
                    <td><Badge s={t.status} /></td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{t.receivedBy || '—'}</td>
                    <td>
                      {t.status === 'pending' && canReceive && (
                        <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                          <button className="btn sm ok" onClick={() => receive(t, true)}><Check size={12} />استلام</button>
                          <button className="btn sm no" onClick={() => receive(t, false)}><X size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={7}><div className="empty">لا توجد سندات تحويل بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'out' && isCentral && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><Banknote size={15} color="var(--brass)" />أوامر الصرف من الخزينة</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البند</th><th>المستفيد</th><th>المرجع</th><th>الطريقة</th><th>المبلغ</th><th>أمر الصرف</th></tr></thead>
              <tbody>
                {disb.map(x => (
                  <tr key={x.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(x.date)}</td>
                    <td style={{ fontSize: 12 }}>{x.category}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.beneficiary}</td>
                    <td className="num" style={{ fontSize: 11, color: 'var(--faint)' }}>{x.reference}</td>
                    <td><span className="badge b-dim">
                      {{ cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك' }[x.method] || x.method}</span></td>
                    <td className="num" style={{ color: 'var(--rose)', fontWeight: 600 }}>{money(x.amount)}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.by}</td>
                  </tr>
                ))}
                {disb.length === 0 && <tr><td colSpan={7}><div className="empty">لا توجد أوامر صرف مسجلة.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'led' && isCentral && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><FileText size={15} color="var(--brass)" />كشف حركة الخزينة الرئيسية</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead>
              <tbody>
                {ledger.slice(0, 80).map(i => (
                  <tr key={i.kind + i.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(i.date)}</td>
                    <td style={{ fontSize: 12 }}>{i.label}</td>
                    <td className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{i.ref}</td>
                    <td className="num" style={{ color: 'var(--mint)' }}>{i.kind === 'in' ? money(i.amount) : '—'}</td>
                    <td className="num" style={{ color: 'var(--rose)' }}>{i.kind === 'out' ? money(i.amount) : '—'}</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--brass)' }}>{money(i.run)}</td>
                  </tr>
                ))}
                {ledger.length === 0 && <tr><td colSpan={6}><div className="empty">لا حركات على الخزينة بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {add && <DisbursementForm me={me} balance={balance} commit={commit} say={say} onClose={() => setAdd(false)} />}
    </div>
  );
}

function DisbursementForm({ me, balance, commit, say, onClose }) {
  const [f, setF] = useState({
    date: today(), category: 'توريد مواد خام مركزي', amount: 0,
    beneficiary: '', method: 'bank_transfer', reference: ''
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (f.amount <= 0) return say('أدخل مبلغ الصرف', 'no');
    if (!f.beneficiary.trim()) return say('اكتب اسم المستفيد', 'no');
    if (f.amount > balance) return say('المبلغ يتجاوز رصيد الخزينة المتاح', 'no');
    const rec = { ...f, id: uid('ds'), by: me.name, createdAt: nowISO() };
    await commit(d => ({ ...d, disbursements: [rec, ...(d.disbursements || [])] }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: rec.id,
      title: 'أصدر أمر صرف من الخزينة',
      details: `${f.category} · ${f.beneficiary} · ${money(f.amount)} ر.س`
    });
    say('تم تسجيل أمر الصرف وخصمه من رصيد الخزينة');
    onClose();
  };
  return (
    <Modal title="أمر صرف من الخزينة الرئيسية" icon={Banknote} onClose={onClose}
      foot={<><button className="btn pri" onClick={save}><Check size={14} />اعتماد الصرف</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="mono-b" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 12 }}>الرصيد المتاح بالخزينة</span>
        <span className="num" style={{ color: 'var(--brass)', fontWeight: 600 }}>{money(balance)}</span>
      </div>
      <div className="grid g2">
        <Field label="بند الصرف">
          <select className="sel" value={f.category} onChange={e => set('category', e.target.value)}>
            {['توريد مواد خام مركزي', 'إيجارات الفروع', 'صرف رواتب', 'سداد موردين', 'صيانة وتشغيل',
              'ضريبة القيمة المضافة', 'مصاريف إدارية'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الصرف">
          <input type="date" className="inp" value={f.date} onChange={e => set('date', e.target.value)} />
        </Field>
      </div>
      <div className="grid g2">
        <Num label="المبلغ" value={f.amount} onChange={v => set('amount', v)} />
        <Field label="طريقة الصرف">
          <select className="sel" value={f.method} onChange={e => set('method', e.target.value)}>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="cash">نقداً</option>
            <option value="cheque">شيك</option>
          </select>
        </Field>
      </div>
      <div className="grid g2">
        <Field label="المستفيد">
          <input className="inp" value={f.beneficiary} placeholder="اسم الجهة أو المورد"
            onChange={e => set('beneficiary', e.target.value)} />
        </Field>
        <Field label="رقم المرجع / السند">
          <input className="inp" value={f.reference} placeholder="اختياري"
            onChange={e => set('reference', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ================= الرواتب والسلف ================= */
function Payroll({ org, ops, me, myBranches, scoped, commit, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [add, setAdd] = useState(false);
  const ids = myBranches.map(b => b.id);
  const emps = org.employees.filter(e => ids.includes(e.branchId));
  const canPay = me.role !== 'branch_manager';

  const rows = emps.map(e => {
    const ads = scoped.advances.filter(a => a.employeeId === e.id && a.month === month);
    const draws = sum(ads.filter(a => ['advance', 'salary_draw'].includes(a.type)), a => a.amount);
    const cuts = sum(ads.filter(a => !['advance', 'salary_draw'].includes(a.type)), a => a.amount);
    const gross = e.baseSalary + (e.housingAllowance || 0);
    return { e, ads, draws, cuts, gross, net: gross - draws - cuts, flags: ads.filter(a => a.isUnjustified).length };
  });

  const totalNet = sum(rows, r => r.net);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <input type="month" className="inp" style={{ width: 165 }} value={month} onChange={e => setMonth(e.target.value)} />
          <span className="badge b-dim">{emps.length} موظف</span>
        </div>
        <button className="btn pri" onClick={() => setAdd(true)}><Plus size={15} />تسجيل سلفة أو خصم</button>
      </div>

      <div className="grid g4">
        <Kpi label="إجمالي الرواتب الأساسية" value={money(sum(rows, r => r.gross))} icon={Wallet} color="#C8A24A" />
        <Kpi label="السلف والمسحوبات" value={money(sum(rows, r => r.draws))} icon={TrendingDown} color="#E0A458" />
        <Kpi label="الخصومات والجزاءات" value={money(sum(rows, r => r.cuts))} icon={AlertTriangle} color="#D9544D" />
        <Kpi label="صافي المستحق للصرف" value={money(totalNet)} icon={Banknote} color="#4FB286" />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><Users size={15} color="var(--brass)" />كشف رواتب {month}</div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الموظف</th><th>الفرع</th><th>المسمى</th><th>الإجمالي</th>
              <th>سلف ومسحوبات</th><th>خصومات</th><th>الصافي</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.e.id}>
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.e.name}</div>
                    {r.flags > 0 && <span className="badge b-rose" style={{ marginTop: 3 }}>{r.flags} سحبية غير مبررة</span>}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{org.branches.find(b => b.id === r.e.branchId)?.name}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.e.jobTitle}</td>
                  <td className="num">{money(r.gross)}</td>
                  <td className="num" style={{ color: 'var(--amber)' }}>{money(r.draws)}</td>
                  <td className="num" style={{ color: 'var(--rose)' }}>{money(r.cuts)}</td>
                  <td className="num" style={{ color: 'var(--mint)', fontWeight: 600 }}>{money(r.net)}</td>
                  <td>{canPay && <button className="btn sm" onClick={() => say(`اعتُمد صرف راتب ${r.e.name} بمبلغ ${money(r.net)} ر.س`)}>اعتماد الصرف</button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}><div className="empty">لا يوجد موظفون ضمن نطاقك.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><Receipt size={15} color="var(--brass)" />حركة السلف والخصومات</div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>التاريخ</th><th>الموظف</th><th>النوع</th><th>المبلغ</th><th>السبب</th><th>سجّله</th></tr></thead>
            <tbody>
              {scoped.advances.filter(a => a.month === month).sort((a, b) => b.date.localeCompare(a.date)).map(a => (
                <tr key={a.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(a.date)}</td>
                  <td style={{ fontSize: 12 }}>{a.employeeName}</td>
                  <td><span className={'badge ' + (['advance', 'salary_draw'].includes(a.type) ? 'b-amber' : 'b-rose')}>
                    {{ advance: 'سلفة', salary_draw: 'مسحوبة', discount: 'خصم', absence_penalty: 'غياب', lateness_penalty: 'تأخير', other: 'أخرى' }[a.type]}
                  </span></td>
                  <td className="num">{money(a.amount)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{a.reason}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--faint)' }}>{a.createdByName}</td>
                </tr>
              ))}
              {scoped.advances.filter(a => a.month === month).length === 0 &&
                <tr><td colSpan={6}><div className="empty">لا حركات مسجلة لهذا الشهر.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {add && <AdvanceForm emps={emps} org={org} me={me} commit={commit} say={say} onClose={() => setAdd(false)} />}
    </div>
  );
}

function AdvanceForm({ emps, org, me, commit, say, onClose }) {
  const [f, setF] = useState({ employeeId: emps[0]?.id || '', date: today(), type: 'advance', amount: 0, reason: '', paymentMethod: 'cash', isUnjustified: false });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const emp = emps.find(e => e.id === f.employeeId);

  const save = async () => {
    if (!emp) return say('اختر الموظف', 'no');
    if (f.amount <= 0) return say('أدخل مبلغاً صحيحاً', 'no');
    if (!f.reason.trim()) return say('اكتب سبب السلفة أو الخصم', 'no');
    const b = org.branches.find(x => x.id === emp.branchId);
    const rec = {
      ...f, id: uid('ad'), employeeName: emp.name, branchId: emp.branchId, branchName: b?.name || '',
      month: f.date.slice(0, 7), createdByName: me.name, createdAt: nowISO()
    };
    await commit(d => ({ ...d, advances: [rec, ...(d.advances || [])] }), {
      actionType: 'payroll_record', targetType: 'payroll', targetId: rec.id, branchName: rec.branchName,
      title: 'سجّل سلفة/خصماً على موظف',
      details: `${emp.name} · ${money(f.amount)} ر.س · ${f.reason}`
    });
    say('تم تسجيل الحركة على كشف الراتب');
    onClose();
  };

  return (
    <Modal title="تسجيل سلفة أو خصم" icon={Wallet} onClose={onClose}
      foot={<><button className="btn pri" onClick={save}><Check size={14} />حفظ الحركة</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="الموظف">
          <select className="sel" value={f.employeeId} onChange={e => set('employeeId', e.target.value)}>
            {emps.map(e => <option key={e.id} value={e.id}>{e.name} — {e.jobTitle}</option>)}
          </select>
        </Field>
        <Field label="التاريخ">
          <input type="date" className="inp" value={f.date} onChange={e => set('date', e.target.value)} />
        </Field>
      </div>
      <div className="grid g2">
        <Field label="نوع الحركة">
          <select className="sel" value={f.type} onChange={e => set('type', e.target.value)}>
            <option value="advance">سلفة</option>
            <option value="salary_draw">مسحوبة على الراتب</option>
            <option value="discount">خصم</option>
            <option value="absence_penalty">جزاء غياب</option>
            <option value="lateness_penalty">جزاء تأخير</option>
          </select>
        </Field>
        <Num label="المبلغ" value={f.amount} onChange={v => set('amount', v)}
          hint={emp ? `الراتب الأساسي ${money(emp.baseSalary)} ر.س` : ''} />
      </div>
      <Field label="طريقة الصرف">
        <select className="sel" value={f.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
          <option value="cash">نقداً من صندوق الفرع</option>
          <option value="bank_transfer">تحويل بنكي</option>
          <option value="petty_cash">عهدة نثرية</option>
        </select>
      </Field>
      <Field label="السبب">
        <textarea className="inp" value={f.reason} placeholder="سبب السلفة أو الخصم" onChange={e => set('reason', e.target.value)} />
      </Field>
      <label className="row" style={{ fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.isUnjustified} onChange={e => set('isUnjustified', e.target.checked)} />
        وضع علامة "غير مبررة" لتنبيه الإدارة المالية
      </label>
    </Modal>
  );
}

/* ================= التقارير المالية ================= */
function Reports({ org, ops, me, myBranches, scoped, say, theme }) {
  const tn = chartTone(theme);
  const [mode, setMode] = useState('ops');
  const d30 = new Date(); d30.setDate(d30.getDate() - 29);
  const [from, setFrom] = useState(d30.toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const [bid, setBid] = useState('all');

  const rows = scoped.closings.filter(c => c.date >= from && c.date <= to && (bid === 'all' || c.branchId === bid));

  const byBranch = myBranches.filter(b => bid === 'all' || b.id === bid).map(b => {
    const bc = rows.filter(c => c.branchId === b.id);
    const rev = sum(bc, c => c.totalRevenue), exp = sum(bc, c => c.totalExpenses);
    const cash = sum(bc, c => c.cashSales), card = sum(bc, c => c.cardSales);
    const del = sum(bc, c => c.totalDeliverySales);
    const net = rev - exp;
    return {
      id: b.id, name: b.name, n: bc.length, rev, exp, cash, card, del, net,
      margin: rev ? (net / rev) * 100 : 0, varr: sum(bc, c => c.variance),
      vat: sum(bc, c => c.totalRevenue) * 15 / 115
    };
  });

  const T = {
    rev: sum(byBranch, x => x.rev), exp: sum(byBranch, x => x.exp),
    net: sum(byBranch, x => x.net), varr: sum(byBranch, x => x.varr), vat: sum(byBranch, x => x.vat)
  };

  const daily = useMemo(() => {
    const m = {};
    rows.forEach(c => { m[c.date] = (m[c.date] || 0) + c.totalRevenue - c.totalExpenses; });
    return Object.entries(m).sort().map(([d, v]) => ({ lbl: d.slice(5).replace('-', '/'), net: v }));
  }, [rows]);

  const exportCsv = () => {
    const head = ['الفرع', 'عدد الإغلاقات', 'الإيراد', 'المصروف', 'الصافي', 'الهامش%', 'نقدي', 'شبكة', 'تطبيقات', 'فروقات الصندوق', 'ض.القيمة المضافة'];
    const body = byBranch.map(b => [b.name, b.n, b.rev.toFixed(2), b.exp.toFixed(2), b.net.toFixed(2), b.margin.toFixed(1), b.cash.toFixed(2), b.card.toFixed(2), b.del.toFixed(2), b.varr.toFixed(2), b.vat.toFixed(2)]);
    const csv = '\uFEFF' + [head, ...body].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `تقرير-الفروع-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل التقرير بصيغة CSV');
  };

  const Tabs = () => (
    <div className="row">
      <button className={'btn sm' + (mode === 'ops' ? ' pri' : ' gh')} onClick={() => setMode('ops')}>
        <FileBarChart size={14} />تقرير الأداء التشغيلي
      </button>
      <button className={'btn sm' + (mode === 'pnl' ? ' pri' : ' gh')} onClick={() => setMode('pnl')}>
        <FileText size={14} />قائمة الدخل الشهرية
      </button>
    </div>
  );

  if (mode === 'pnl') return (
    <div className="grid" style={{ gap: 14 }}>
      <Tabs />
      <IncomeStatement org={org} ops={ops} myBranches={myBranches} scoped={scoped} say={say} />
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Tabs />
      <div className="card">
        <div className="row">
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="lbl">من تاريخ</label>
            <input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="lbl">إلى تاريخ</label>
            <input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div style={{ flex: 1.4, minWidth: 170 }}>
            <label className="lbl">الفرع</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">جميع الفروع ضمن صلاحيتي</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button className="btn pri" style={{ alignSelf: 'flex-end' }} onClick={exportCsv}>
            <Download size={14} />تصدير CSV
          </button>
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="الإيرادات" value={money(T.rev)} sub={`${rows.length} إغلاق`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="المصروفات" value={money(T.exp)} icon={Receipt} color="#D9544D" />
        <Kpi label="صافي الربح" value={money(T.net)} sub={`هامش ${T.rev ? ((T.net / T.rev) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="ض. القيمة المضافة المستحقة" value={money(T.vat)} sub="15% من الإيراد الشامل" icon={Landmark} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><TrendingUp size={15} color="var(--brass)" />صافي الربح اليومي</div>
        <div style={{ height: 220, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                formatter={v => [money(v), 'الصافي']} />
              <Line type="monotone" dataKey="net" stroke="#4FB286" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><FileBarChart size={15} color="var(--brass)" />قائمة أداء الفروع</div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الفرع</th><th>إغلاقات</th><th>الإيراد</th><th>نقدي</th><th>شبكة</th><th>تطبيقات</th>
              <th>المصروف</th><th>الصافي</th><th>الهامش</th><th>فروقات</th>
            </tr></thead>
            <tbody>
              {byBranch.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</td>
                  <td className="num">{b.n}</td>
                  <td className="num" style={{ color: 'var(--brass)' }}>{money(b.rev)}</td>
                  <td className="num">{money(b.cash)}</td>
                  <td className="num">{money(b.card)}</td>
                  <td className="num">{money(b.del)}</td>
                  <td className="num" style={{ color: 'var(--rose)' }}>{money(b.exp)}</td>
                  <td className="num" style={{ color: 'var(--mint)', fontWeight: 600 }}>{money(b.net)}</td>
                  <td><span className={'badge ' + (b.margin > 25 ? 'b-mint' : b.margin > 12 ? 'b-amber' : 'b-rose')}>
                    <span className="num">{b.margin.toFixed(1)}%</span></span></td>
                  <td className="num" style={{ color: b.varr < 0 ? 'var(--rose)' : 'var(--faint)' }}>{money(b.varr)}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(200,162,74,.06)' }}>
                <td style={{ fontWeight: 700 }}>الإجمالي</td><td className="num">{sum(byBranch, b => b.n)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--brass)' }}>{money(T.rev)}</td>
                <td className="num">{money(sum(byBranch, b => b.cash))}</td>
                <td className="num">{money(sum(byBranch, b => b.card))}</td>
                <td className="num">{money(sum(byBranch, b => b.del))}</td>
                <td className="num" style={{ color: 'var(--rose)' }}>{money(T.exp)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--mint)' }}>{money(T.net)}</td>
                <td>—</td>
                <td className="num" style={{ color: T.varr < 0 ? 'var(--rose)' : 'var(--faint)' }}>{money(T.varr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= الفروع والمستخدمون ================= */
function Admin({ org, ops, commitOrg, say }) {
  const [tab, setTab] = useState('branches');
  const [bEdit, setBEdit] = useState(null);
  const [uEdit, setUEdit] = useState(null);

  const saveBranch = async (b) => {
    const isNew = !org.branches.some(x => x.id === b.id);
    await commitOrg(d => ({ ...d, branches: isNew ? [...d.branches, b] : d.branches.map(x => x.id === b.id ? b : x) }), {
      actionType: isNew ? 'create' : 'update', targetType: 'branch', targetId: b.id, branchName: b.name,
      title: isNew ? 'أضاف فرعاً جديداً' : 'عدّل بيانات فرع', details: `${b.name} — ${b.city}`
    });
    say(isNew ? 'تمت إضافة الفرع' : 'تم تحديث بيانات الفرع'); setBEdit(null);
  };
  const saveUser = async (u) => {
    const isNew = !org.users.some(x => x.id === u.id);
    await commitOrg(d => ({ ...d, users: isNew ? [...d.users, u] : d.users.map(x => x.id === u.id ? u : x) }), {
      actionType: isNew ? 'create' : 'permission_change', targetType: 'user_account', targetId: u.id,
      title: isNew ? 'أنشأ مستخدماً جديداً' : 'عدّل صلاحيات مستخدم', details: `${u.name} — ${ROLES[u.role].ar}`
    });
    say(isNew ? 'تم إنشاء الحساب — يمكنه الدخول برمزه الآن' : 'تم تحديث الحساب'); setUEdit(null);
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row">
        <button className={'btn sm' + (tab === 'branches' ? ' pri' : ' gh')} onClick={() => setTab('branches')}>
          <Building2 size={14} />الفروع
        </button>
        <button className={'btn sm' + (tab === 'users' ? ' pri' : ' gh')} onClick={() => setTab('users')}>
          <Users size={14} />المستخدمون والصلاحيات
        </button>
        <button className={'btn sm' + (tab === 'cats' ? ' pri' : ' gh')} onClick={() => setTab('cats')}>
          <Receipt size={14} />بنود المصروف والميزانيات
        </button>
        <button className={'btn sm' + (tab === 'system' ? ' pri' : ' gh')} onClick={() => setTab('system')}>
          <Settings size={14} />بيانات الشركة والنسخ الاحتياطي
        </button>
        {(tab === 'branches' || tab === 'users') && <button className="btn pri" style={{ marginInlineStart: 'auto' }}
          onClick={() => tab === 'branches'
            ? setBEdit({ id: uid('b'), name: '', city: '', managerName: '', phone: '', defaultFloat: 1500, shiftEndTime: '02:00', isActive: true })
            : setUEdit({ id: uid('u'), name: '', email: '', role: 'branch_manager', pin: '1234', branchId: org.branches[0]?.id, allowedBranchIds: [], isActive: true, createdAt: today() })}>
          <Plus size={15} />{tab === 'branches' ? 'فرع جديد' : 'مستخدم جديد'}
        </button>}
      </div>

      {tab === 'branches' && (
        <div className="grid g2">
          {org.branches.map(b => (
            <div key={b.id} className="card">
              <div className="card-h">
                <div className="card-t"><Store size={15} color="var(--brass)" />{b.name}</div>
                <span className={'badge ' + (b.isActive ? 'b-mint' : 'b-dim')}>{b.isActive ? 'نشط' : 'موقوف'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 2 }}>
                <div>المدينة: {b.city} · المسؤول: {b.managerName}</div>
                <div>الجوال: <span className="num">{b.phone}</span> · نهاية الوردية: <span className="num">{b.shiftEndTime}</span></div>
                <div>العهدة الافتراضية: <span className="num" style={{ color: 'var(--brass)' }}>{money(b.defaultFloat)}</span> ر.س</div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => setBEdit(b)}>تعديل</button>
                <button className="btn sm gh" onClick={() => saveBranch({ ...b, isActive: !b.isActive })}>
                  {b.isActive ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>المستخدم</th><th>الدور</th><th>النطاق</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {org.users.map((u, i) => (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                        <div className="av" style={{ background: clr(i), margin: 0 }}>{u.name.charAt(0)}</div>
                        <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><span className={'badge ' + ROLES[u.role].badge}>{ROLES[u.role].ar.split('—')[0]}</span></td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                      {ROLES[u.role].scope === 'all' ? 'جميع الفروع'
                        : ROLES[u.role].scope === 'own' ? (org.branches.find(b => b.id === u.branchId)?.name || '—')
                          : `${(u.allowedBranchIds || []).length} فرع مصرّح`}
                    </td>
                    <td><span className={'badge ' + (u.isActive ? 'b-mint' : 'b-dim')}>{u.isActive ? 'نشط' : 'موقوف'}</span></td>
                    <td>
                      <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                        <button className="btn sm" onClick={() => setUEdit(u)}>تعديل</button>
                        <button className="btn sm gh" onClick={() => saveUser({ ...u, isActive: !u.isActive })}>
                          {u.isActive ? <Lock size={12} /> : <Check size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cats' && <CategoriesPanel org={org} ops={ops} commitOrg={commitOrg} say={say} />}
      {tab === 'system' && <SystemPanel org={org} ops={ops} commit={commit} commitOrg={commitOrg} say={say} />}

      {bEdit && <BranchForm b={bEdit} onSave={saveBranch} onClose={() => setBEdit(null)} />}
      {uEdit && <UserForm u={uEdit} org={org} onSave={saveUser} onClose={() => setUEdit(null)} />}
    </div>
  );
}

function BranchForm({ b, onSave, onClose }) {
  const [f, setF] = useState(b);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal title={b.name ? 'تعديل فرع' : 'إضافة فرع جديد'} icon={Building2} onClose={onClose}
      foot={<><button className="btn pri" onClick={() => f.name ? onSave(f) : null} disabled={!f.name}>
        <Check size={14} />حفظ الفرع</button><button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="اسم الفرع"><input className="inp" value={f.name} onChange={e => set('name', e.target.value)} placeholder="فرع ..." /></Field>
        <Field label="المدينة"><input className="inp" value={f.city} onChange={e => set('city', e.target.value)} /></Field>
        <Field label="مدير الفرع"><input className="inp" value={f.managerName} onChange={e => set('managerName', e.target.value)} /></Field>
        <Field label="جوال الفرع"><input className="inp n" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Num label="العهدة التشغيلية الافتراضية" value={f.defaultFloat} onChange={v => set('defaultFloat', v)} />
        <Field label="وقت نهاية الوردية"><input type="time" className="inp" value={f.shiftEndTime} onChange={e => set('shiftEndTime', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function UserForm({ u, org, onSave, onClose }) {
  const [f, setF] = useState(u);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggle = (id) => {
    const cur = f.allowedBranchIds || [];
    set('allowedBranchIds', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };
  return (
    <Modal title={u.name ? 'تعديل مستخدم' : 'مستخدم جديد'} icon={UserCog} onClose={onClose}
      foot={<><button className="btn pri" disabled={!f.name} onClick={() => onSave(f)}><Check size={14} />حفظ الحساب</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="الاسم الكامل"><input className="inp" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="البريد الإلكتروني"><input className="inp" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@restaurant.sa" /></Field>
      </div>
      <Field label="الدور والصلاحية">
        <select className="sel" value={f.role} onChange={e => set('role', e.target.value)}>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
        </select>
      </Field>
      {ROLES[f.role].scope === 'own' && (
        <Field label="الفرع المخصص">
          <select className="sel" value={f.branchId} onChange={e => set('branchId', e.target.value)}>
            {org.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      {ROLES[f.role].scope === 'assigned' && (
        <Field label="الفروع المصرّح بالوصول إليها">
          <div className="row">
            {org.branches.map(b => (
              <button key={b.id} className={'btn sm' + ((f.allowedBranchIds || []).includes(b.id) ? ' pri' : ' gh')}
                onClick={() => toggle(b.id)}>{b.name}</button>
            ))}
          </div>
        </Field>
      )}
      <Field label="رمز الدخول السريع (4 أرقام)">
        <input className="inp n" maxLength={4} value={f.pin} onChange={e => set('pin', e.target.value.replace(/[^\d]/g, ''))} />
      </Field>
      <div className="card" style={{ background: 'var(--ink)', padding: 12 }}>
        <div className="lbl">ما يستطيع هذا الدور فعله</div>
        {ROLES[f.role].perms.map((p, i) => (
          <div key={i} style={{ fontSize: 11.5, color: 'var(--dim)', display: 'flex', gap: 7, marginBottom: 4 }}>
            <Check size={13} color="var(--mint)" style={{ flexShrink: 0, marginTop: 3 }} />{p}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ================= سجل التدقيق ================= */
function AuditView({ pulse }) {
  const [q, setQ] = useState('');
  const logs = (pulse.audit || []).filter(l =>
    !q || (l.userName + l.title + l.details).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><Eye size={15} color="var(--brass)" />سجل الإجراءات على المنصة</div>
          <div className="row">
            <Search size={14} color="var(--faint)" />
            <input className="inp" style={{ width: 200 }} placeholder="بحث بالمستخدم أو الإجراء"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>الإجراء</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{arTime(l.timestamp)}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{l.userName}</td>
                  <td><span className={'badge ' + ROLES[l.userRole].badge}>{ROLES[l.userRole].ar.split('—')[0]}</span></td>
                  <td style={{ fontSize: 12 }}>{l.title}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{l.details}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5}><div className="empty">
                لا توجد سجلات بعد. كل إجراء يقوم به أي مستخدم سيُقيَّد هنا تلقائياً.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= طباعة إيصال الإغلاق (نمط الطابعة الحرارية) ================= */
function printReceipt(c) {
  const line = (k, v) => `<tr><td>${k}</td><td class="v">${v}</td></tr>`;
  const dels = (c.deliverySales || []).filter(d => d.amount > 0)
    .map(d => line(`${d.appName} (${d.orderCount})`, money(d.amount))).join('');
  const exps = (c.expenses || []).map(e => line(e.categoryName, money(e.amount))).join('');
  const dens = DENOMS.filter(d => (c.denominationDetails?.[d.k] || 0) > 0)
    .map(d => line(`${d.k === 'coins' ? 'هللات' : d.v + ' ريال'} × ${c.denominationDetails[d.k]}`,
      money((c.denominationDetails[d.k] || 0) * d.v))).join('');
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <title>إيصال إغلاق ${c.branchName}</title><style>
  @page{size:80mm auto;margin:4mm}
  body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;width:72mm;margin:0 auto;color:#000;font-size:11px}
  h1{font-size:14px;text-align:center;margin:0 0 2px}
  .c{text-align:center;font-size:10px;color:#333}
  .sep{border-top:1px dashed #000;margin:7px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 0;vertical-align:top}
  td.v{text-align:left;font-family:'IBM Plex Mono',monospace;white-space:nowrap}
  .sec{font-weight:700;font-size:11px;margin-top:6px;background:#eee;padding:2px 4px}
  .tot{font-weight:700;font-size:12.5px;border-top:1px solid #000;border-bottom:3px double #000;padding:4px 0}
  .stamp{border:2px solid #000;padding:6px;text-align:center;font-weight:700;margin-top:8px;transform:rotate(-1deg)}
  </style></head><body>
  <h1>إيصال إغلاق وردية</h1>
  <div class="c">${c.branchName}</div>
  <div class="c">${arDate(c.date)} · المسؤول: ${c.managerName}</div>
  <div class="c">سند التحويل: ${c.transferReferenceNo || '—'}</div>
  <div class="sep"></div>
  <div class="sec">الإيرادات</div>
  <table>${line('مبيعات نقدية', money(c.cashSales))}${line('مبيعات الشبكة', money(c.cardSales))}
  ${c.bankTransferSales ? line('تحويل بنكي', money(c.bankTransferSales)) : ''}${dels}</table>
  <table><tr class="tot"><td>إجمالي الإيراد</td><td class="v">${money(c.totalRevenue)}</td></tr></table>
  <div class="sec">المصروفات</div>
  <table>${exps || '<tr><td>لا مصروفات</td><td class="v">0.00</td></tr>'}
  ${line('المخصوم نقداً', money(c.totalCashExpenses))}</table>
  <div class="sec">جرد الصندوق</div>
  <table>${dens}${line('العهدة الافتتاحية', money(c.openingBalance))}
  ${line('المتوقع بالصندوق', money(c.expectedCashInSafe))}${line('العدّ الفعلي', money(c.actualCashCount))}
  <tr class="tot"><td>الفرق</td><td class="v">${c.variance > 0 ? '+' : ''}${money(c.variance)}</td></tr></table>
  ${c.varianceReason ? `<div style="font-size:10px;margin-top:4px">السبب: ${c.varianceReason}</div>` : ''}
  <div class="sec">الترحيل</div>
  <table>${line('المرحّل للخزينة', money(c.transferredToMainTreasury))}
  ${line('عهدة اليوم التالي', money(c.retainedFloatForTomorrow))}</table>
  <div class="stamp">${c.variance === 0 ? 'الصندوق مطابق' : c.variance < 0 ? 'عجز نقدي: ' + money(Math.abs(c.variance)) : 'فائض نقدي: ' + money(c.variance)}</div>
  <div class="sep"></div>
  ${c.managerSignature ? `<div style="text-align:center"><img src="${c.managerSignature}" style="max-width:52mm"></div>` : ''}
  <div class="c">توقيع المسؤول: ____________</div>
  <div class="c">توقيع أمين الخزينة: ____________</div>
  <div class="c" style="margin-top:8px">طُبع في ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=420,height=760');
  if (!w) return;
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

/* ================= الموردون والالتزامات الشهرية ================= */
function Suppliers({ org, ops, me, myBranches, commit, say }) {
  const [tab, setTab] = useState('inv');
  const [pay, setPay] = useState(null);
  const [amt, setAmt] = useState(0);
  const ids = myBranches.map(b => b.id);
  const invoices = (ops.invoices || []).filter(i => ids.includes(i.branchId))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const fixed = (ops.fixedExpenses || []).filter(f => ids.includes(f.branchId));
  const suppliers = org.suppliers || [];
  const canPay = me.role !== 'branch_manager';

  const outstanding = sum(invoices, i => i.amount - (i.paidAmount || 0));
  const overdue = invoices.filter(i => (i.amount - (i.paidAmount || 0)) > 0 && i.dueDate < today());

  const settle = async () => {
    const inv = pay; const v = Math.min(amt, inv.amount - (inv.paidAmount || 0));
    if (v <= 0) return say('أدخل مبلغ سداد صحيح', 'no');
    await commit(d => ({
      ...d,
      invoices: (d.invoices || []).map(i => i.id === inv.id ? { ...i, paidAmount: (i.paidAmount || 0) + v } : i)
    }), {
      actionType: 'update', targetType: 'expense', targetId: inv.id, branchName: inv.branchName,
      title: 'سدّد دفعة لمورد', details: `${inv.supplierName} · فاتورة ${inv.invoiceNo} · ${money(v)} ر.س`
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
      <div className="grid g4">
        <Kpi label="مستحقات الموردين" value={money(outstanding)} sub={`${invoices.filter(i => i.amount > (i.paidAmount || 0)).length} فاتورة مفتوحة`} icon={Truck} color="#C8A24A" />
        <Kpi label="متأخرة عن الاستحقاق" value={money(sum(overdue, i => i.amount - (i.paidAmount || 0)))} sub={`${overdue.length} فاتورة`} icon={AlertTriangle} color="#D9544D" />
        <Kpi label="التزامات الشهر الثابتة" value={money(sum(fixed, fxTotal))} sub={`${fixed.length} فرع`} icon={Building2} color="#5B93C4" />
        <Kpi label="غير المسدد من الثابتة" value={money(sum(fixed.filter(f => !f.isPaid), fxTotal))} icon={CalendarDays} color="#E0A458" />
      </div>

      <div className="row">
        <button className={'btn sm' + (tab === 'inv' ? ' pri' : ' gh')} onClick={() => setTab('inv')}>
          <FileText size={14} />فواتير الموردين الآجلة
        </button>
        <button className={'btn sm' + (tab === 'fx' ? ' pri' : ' gh')} onClick={() => setTab('fx')}>
          <Building2 size={14} />إيجارات وفواتير الفروع
        </button>
        <button className={'btn sm' + (tab === 'sup' ? ' pri' : ' gh')} onClick={() => setTab('sup')}>
          <Truck size={14} />سجل الموردين
        </button>
      </div>

      {tab === 'inv' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الفاتورة</th><th>المورد</th><th>الفرع</th><th>التاريخ</th><th>الاستحقاق</th>
                <th>القيمة</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {invoices.map(i => {
                  const rem = i.amount - (i.paidAmount || 0);
                  const late = rem > 0 && i.dueDate < today();
                  return (
                    <tr key={i.id}>
                      <td className="num" style={{ fontSize: 11 }}>{i.invoiceNo}</td>
                      <td style={{ fontSize: 12 }}>{i.supplierName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{i.branchName}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{arDate(i.date)}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap', color: late ? 'var(--rose)' : 'inherit' }}>{arDate(i.dueDate)}</td>
                      <td className="num">{money(i.amount)}</td>
                      <td className="num" style={{ color: 'var(--mint)' }}>{money(i.paidAmount || 0)}</td>
                      <td className="num" style={{ color: rem > 0 ? 'var(--amber)' : 'var(--faint)', fontWeight: 600 }}>{money(rem)}</td>
                      <td><span className={'badge ' + (rem <= 0 ? 'b-mint' : late ? 'b-rose' : 'b-amber')}>
                        {rem <= 0 ? 'مسددة' : late ? 'متأخرة' : 'قيد السداد'}</span></td>
                      <td>{rem > 0 && canPay &&
                        <button className="btn sm" onClick={() => { setPay(i); setAmt(rem); }}>سداد</button>}</td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && <tr><td colSpan={10}><div className="empty">لا فواتير آجلة.</div></td></tr>}
              </tbody>
            </table>
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
                  const bal = sum(invoices.filter(i => i.supplierId === sp.id), i => i.amount - (i.paidAmount || 0));
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

      {pay && (
        <Modal title={`سداد فاتورة ${pay.invoiceNo}`} icon={Banknote} onClose={() => setPay(null)}
          foot={<><button className="btn pri" onClick={settle}><Check size={14} />تسجيل السداد</button>
            <button className="btn gh" onClick={() => setPay(null)}>إلغاء</button></>}>
          <div className="mono-b" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12 }}>{pay.supplierName} — {pay.branchName}</span>
            <span className="num" style={{ color: 'var(--amber)' }}>المتبقي {money(pay.amount - (pay.paidAmount || 0))}</span>
          </div>
          <Num label="مبلغ السداد" value={amt} onChange={setAmt} hint="يمكن السداد جزئياً على دفعات" />
        </Modal>
      )}
    </div>
  );
}

/* ================= المركز المالي الذكي ================= */
function AiCenter({ org, ops, me, myBranches, scoped, say }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(14);

  const digest = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - days);
    const fs = from.toISOString().slice(0, 10);
    const win = scoped.closings.filter(c => c.date >= fs);
    const perBranch = myBranches.map(b => {
      const bc = win.filter(c => c.branchId === b.id);
      const rev = sum(bc, c => c.totalRevenue), exp = sum(bc, c => c.totalExpenses);
      return {
        الفرع: b.name, عدد_الإغلاقات: bc.length, الإيراد: Math.round(rev), المصروف: Math.round(exp),
        الصافي: Math.round(rev - exp), نقدي: Math.round(sum(bc, c => c.cashSales)),
        شبكة: Math.round(sum(bc, c => c.cardSales)), تطبيقات: Math.round(sum(bc, c => c.totalDeliverySales)),
        عمولات_التطبيقات: Math.round(sum(bc, c => sum(c.deliverySales || [], d => d.commissionAmount || 0))),
        فروقات_الصندوق: Math.round(sum(bc, c => c.variance)),
        أعلى_بنود_المصروف: Object.entries(bc.flatMap(c => c.expenses || [])
          .reduce((m, e) => ({ ...m, [e.categoryName]: (m[e.categoryName] || 0) + e.amount }), {}))
          .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k}: ${Math.round(v)}`)
      };
    });
    return {
      الفترة: `آخر ${days} يوماً`, العملة: 'ريال سعودي',
      الالتزامات_المتأخرة: (ops.invoices || []).filter(i => (i.amount - (i.paidAmount || 0)) > 0 && i.dueDate < today()).length,
      السلف_غير_المبررة: (ops.advances || []).filter(a => a.isUnjustified).length,
      الفروع: perBranch
    };
  }, [scoped, myBranches, days, ops]);

  const analyze = async () => {
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest })
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'failed');
      setRes(data.result);
      say('اكتمل التحليل المالي الذكي');
    } catch (e) {
      setErr('تعذّر إتمام التحليل. تأكد من ضبط ANTHROPIC_API_KEY في ملف .env وتشغيل الخادم.');
    }
    setBusy(false);
  };

  const grade = (s) => s === 'ممتاز' ? 'b-mint' : s === 'جيد جداً' ? 'b-sky' : s === 'متوسط' ? 'b-amber' : 'b-rose';

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
        <div className="card-h">
          <div>
            <div className="card-t"><Sparkles size={16} color="var(--brass)" />المدير المالي الذكي</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 5 }}>
              يقرأ إغلاقات {myBranches.length} فرع ويستخرج التوصيات ومخاطر النقدية وتقييم أداء كل فرع.
            </div>
          </div>
          <div className="row">
            {[7, 14, 30].map(d => (
              <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>{d} يوم</button>
            ))}
          </div>
        </div>
        <button className="btn pri" onClick={analyze} disabled={busy}>
          {busy ? <><RefreshCw size={15} className="spin" />جارٍ التحليل…</> : <><Sparkles size={15} />تشغيل التحليل المالي</>}
        </button>
        {err && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 12 }}>{err}</div>}
      </div>

      {!res && !busy && (
        <div className="card"><div className="empty">
          لم يُشغَّل التحليل بعد. اضغط «تشغيل التحليل المالي» للحصول على قراءة مالية لفترة {days} يوماً.
        </div></div>
      )}

      {res && (
        <>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><FileText size={15} color="var(--brass)" />الملخص التنفيذي</div>
            <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--txt)' }}>{res.الملخص_التنفيذي}</div>
            <hr className="hr" />
            <div className="lbl">اتجاهات المبيعات والمصروفات</div>
            <div style={{ fontSize: 12.5, lineHeight: 2, color: 'var(--dim)' }}>{res.اتجاهات_المبيعات_والمصروفات}</div>
          </div>

          <div className="grid g2">
            <div className="card">
              <div className="card-t" style={{ marginBottom: 12 }}><TrendingDown size={15} color="var(--mint)" />توصيات خفض التكلفة</div>
              {(res.توصيات_خفض_التكلفة || []).map((t, i) => (
                <div key={i} className="feed">
                  <div className="feed-d" style={{ background: 'var(--mint)' }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>{t}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 12 }}><AlertTriangle size={15} color="var(--rose)" />مخاطر النقدية</div>
              {(res.مخاطر_النقدية || []).map((t, i) => (
                <div key={i} className="feed">
                  <div className="feed-d" style={{ background: 'var(--rose)' }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-t" style={{ marginBottom: 12 }}><Store size={15} color="var(--brass)" />تقييم أداء الفروع</div>
            <div className="grid g3">
              {(res.تقييم_الفروع || []).map((b, i) => (
                <div key={i} className="card" style={{ background: 'var(--ink)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.الفرع}</span>
                    <span className={'badge ' + grade(b.الحالة)}>{b.الحالة}</span>
                  </div>
                  <div className="num" style={{ fontSize: 26, color: 'var(--brass)', margin: '8px 0 4px' }}>
                    {b.الدرجة}<span style={{ fontSize: 12, color: 'var(--faint)' }}>/100</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--ink2)', borderRadius: 5, overflow: 'hidden', marginBottom: 9 }}>
                    <div style={{ width: Math.min(100, b.الدرجة) + '%', height: '100%', background: 'var(--brass)' }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.8 }}>{b.التعليق}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', textAlign: 'center' }}>
            تحليل استرشادي مبني على بيانات الإغلاقات المسجلة — لا يغني عن مراجعة المحاسب القانوني.
          </div>
        </>
      )}
    </div>
  );
}

/* ================= بيانات الشركة والنسخ الاحتياطي ================= */
function SystemPanel({ org, ops, commit, commitOrg, say }) {
  const [hist, setHist] = useState(null);
  const [working, setWorking] = useState(false);
  useEffect(() => { (async () => setHist(await cloud.get(KEYS.hist, { closings: [] })))(); }, []);

  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
  const oldOnes = (ops.closings || []).filter(c => c.date < cutoff);

  const archiveOld = async () => {
    if (oldOnes.length === 0) return say('لا توجد إغلاقات أقدم من 90 يوماً', 'no');
    setWorking(true);
    const prev = (await cloud.get(KEYS.hist, { closings: [] })).closings || [];
    const ids = oldOnes.map(c => c.id);
    const okStore = await cloud.set(KEYS.hist, { closings: [...oldOnes, ...prev].slice(0, 800), updatedAt: nowISO() });
    if (!okStore) { setWorking(false); return say('تعذّر حفظ الأرشيف — أعد المحاولة', 'no'); }
    await commit(d => ({
      ...d,
      closings: (d.closings || []).filter(c => c.date >= cutoff),
      transfers: (d.transfers || []).filter(t => !ids.includes(t.closingId))
    }), {
      actionType: 'update', targetType: 'system_settings', targetId: 'archive',
      title: 'أرشف إغلاقات قديمة', details: `${oldOnes.length} إغلاق أقدم من ${cutoff}`
    });
    setHist(await cloud.get(KEYS.hist, { closings: [] }));
    setWorking(false);
    say(`تمت أرشفة ${oldOnes.length} إغلاق — بيانات التشغيل أصبحت أخف`);
  };
  const [c, setC] = useState(org.company);
  const set = (k, v) => setC(p => ({ ...p, [k]: v }));
  const fileRef = useRef();

  const saveCompany = async () => {
    await commitOrg(d => ({ ...d, company: c }), {
      actionType: 'update', targetType: 'system_settings', targetId: 'company',
      title: 'حدّث بيانات الشركة', details: c.name
    });
    say('تم حفظ بيانات الشركة');
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify({ org, ops, hist, exportedAt: nowISO() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `نسخة-احتياطية-${today()}.json`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل النسخة الاحتياطية الكاملة');
  };

  const restore = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const data = JSON.parse(String(rd.result));
        if (!data.org?.branches) throw new Error('bad');
        await cloud.set(KEYS.org, data.org);
        if (data.ops) await cloud.set(KEYS.ops, data.ops);
        if (data.hist) await cloud.set(KEYS.hist, data.hist);
        say('تمت الاستعادة — حدّث الصفحة لعرض البيانات المستعادة');
      } catch { say('الملف غير صالح كنسخة احتياطية لهذه المنصة', 'no'); }
    };
    rd.readAsText(f);
  };

  const stats = [
    ['الفروع', org.branches.length], ['المستخدمون', org.users.length],
    ['الموظفون', org.employees.length], ['الإغلاقات', (ops.closings || []).length],
    ['سندات التحويل', (ops.transfers || []).length], ['فواتير الموردين', (ops.invoices || []).length]
  ];
  const sizes = [
    ['بيانات المنشأة', kb(org)], ['بيانات التشغيل', kb(ops)],
    ['الأرشيف التاريخي', kb(hist)], ['إصدار البيانات', ops.rev || 0]
  ];

  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><Settings size={15} color="var(--brass)" />بيانات المنشأة</div>
        <Field label="اسم الشركة"><input className="inp" value={c.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="النشاط"><input className="inp" value={c.activity} onChange={e => set('activity', e.target.value)} /></Field>
        <div className="grid g2">
          <Field label="الرقم الضريبي"><input className="inp n" value={c.taxNumber} onChange={e => set('taxNumber', e.target.value)} /></Field>
          <Field label="السجل التجاري"><input className="inp n" value={c.commercialReg} onChange={e => set('commercialReg', e.target.value)} /></Field>
        </div>
        <div className="grid g2">
          <Field label="الهاتف"><input className="inp n" value={c.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="العنوان"><input className="inp" value={c.address} onChange={e => set('address', e.target.value)} /></Field>
        </div>
        <button className="btn pri" onClick={saveCompany}><Check size={14} />حفظ بيانات المنشأة</button>
      </div>

      <div className="grid" style={{ gap: 12, alignContent: 'start' }}>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><HardDrive size={15} color="var(--brass)" />النسخ الاحتياطي والاستعادة</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.9 }}>
            نزّل نسخة كاملة من بيانات المنصة بصيغة JSON، أو استعِد نسخة سابقة لتحل محل البيانات الحالية لدى جميع المستخدمين.
          </div>
          <div className="row">
            <button className="btn pri" onClick={backup}><Download size={14} />تنزيل نسخة احتياطية</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} />استعادة من ملف</button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={restore} />
          </div>
        </div>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><HardDrive size={15} color="var(--brass)" />الصيانة وتخفيف البيانات</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 12 }}>
            نقل الإغلاقات الأقدم من 90 يوماً إلى أرشيف منفصل يقلّل حجم المزامنة اللحظية ويسرّع المنصة لدى الجميع.
            الأرشيف يبقى متاحاً للاسترجاع ضمن النسخة الاحتياطية.
          </div>
          <div className="grid g4" style={{ gap: 9, marginBottom: 12 }}>
            {sizes.map(([k, v]) => (
              <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                <span className="num" style={{ fontSize: 16, color: 'var(--brass)' }}>
                  {k === 'إصدار البيانات' ? v : v + ' ك.ب'}
                </span>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={working} onClick={archiveOld}>
              {working ? <RefreshCw size={14} className="spin" /> : <HardDrive size={14} />}
              أرشفة {oldOnes.length} إغلاق قديم
            </button>
            <span className="badge b-dim">
              الأرشيف يضم <span className="num">{(hist?.closings || []).length}</span> إغلاق
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><FileBarChart size={15} color="var(--brass)" />حجم قاعدة البيانات</div>
          <div className="grid g3" style={{ gap: 9 }}>
            {stats.map(([k, v]) => (
              <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                <span className="num" style={{ fontSize: 18, color: 'var(--brass)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= لوحة التوقيع الرقمي ================= */
function SignaturePad({ value, onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height); img.src = value; }
  }, []);

  const pos = (e) => {
    const cv = ref.current, r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL('image/png')); };
  const clear = () => { const cv = ref.current; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); onChange(''); };

  return (
    <div>
      <canvas ref={ref} width={520} height={170}
        style={{ width: '100%', maxWidth: 400, height: 130, background: '#fff', borderRadius: 10, border: '1px solid var(--line)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm gh" onClick={clear}><Trash2 size={13} />مسح التوقيع</button>
        <span className="badge b-dim">{value ? 'تم التوقيع — سيُطبع على الإيصال' : 'وقّع بالإصبع أو الفأرة'}</span>
      </div>
    </div>
  );
}

/* ================= بنود المصروف والميزانيات ================= */
function CategoriesPanel({ org, ops, commitOrg, say }) {
  const [edit, setEdit] = useState(null);
  const month = today().slice(0, 7);
  const cats = org.expenseCats || EXP_CATS;

  const spent = useMemo(() => {
    const m = {};
    (ops.closings || []).filter(c => c.date.slice(0, 7) === month)
      .forEach(c => (c.expenses || []).forEach(e => { m[e.categoryId] = (m[e.categoryId] || 0) + e.amount; }));
    return m;
  }, [ops, month]);

  const save = async (c) => {
    const isNew = !cats.some(x => x.id === c.id);
    await commitOrg(d => ({
      ...d, expenseCats: isNew ? [...(d.expenseCats || []), c] : (d.expenseCats || []).map(x => x.id === c.id ? c : x)
    }), {
      actionType: isNew ? 'create' : 'update', targetType: 'system_settings', targetId: c.id,
      title: isNew ? 'أضاف بند مصروف' : 'عدّل بند مصروف وميزانيته',
      details: `${c.n} · حد شهري ${money(c.budgetLimitMonthly || 0)} ر.س`
    });
    say('تم حفظ البند'); setEdit(null);
  };

  const totalBudget = sum(cats, c => c.budgetLimitMonthly || 0);
  const totalSpent = sum(cats, c => spent[c.id] || 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="badge b-dim">شهر <span className="num">{month}</span></span>
          <span className="badge b-brass">المنصرف <span className="num">{money(totalSpent)}</span> من <span className="num">{money(totalBudget)}</span></span>
        </div>
        <button className="btn pri" onClick={() => setEdit({ id: uid('ec'), n: '', taxable: true, budgetLimitMonthly: 5000 })}>
          <Plus size={15} />بند جديد
        </button>
      </div>

      <div className="grid g2">
        {cats.map(c => {
          const sp = spent[c.id] || 0, bd = c.budgetLimitMonthly || 0;
          const pct = bd ? Math.min(100, (sp / bd) * 100) : 0;
          const over = bd && sp > bd;
          return (
            <div key={c.id} className="card" style={{ borderColor: over ? 'rgba(217,84,77,.4)' : 'var(--line)' }}>
              <div className="card-h" style={{ marginBottom: 10 }}>
                <div className="card-t" style={{ fontSize: 13 }}>{c.n}</div>
                <div className="row">
                  <span className={'badge ' + (c.taxable ? 'b-sky' : 'b-dim')}>{c.taxable ? 'خاضع لض.ق.م' : 'معفى'}</span>
                  <button className="btn sm gh" onClick={() => setEdit(c)}>تعديل</button>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--dim)' }}>المنصرف هذا الشهر</span>
                <span className="num" style={{ color: over ? 'var(--rose)' : 'var(--txt)' }}>
                  {money(sp)} / {money(bd)}
                </span>
              </div>
              <div style={{ height: 7, background: 'var(--ink)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', borderRadius: 7, transition: '.5s', background: over ? 'var(--rose)' : pct > 80 ? 'var(--amber)' : 'var(--mint)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: over ? 'var(--rose)' : 'var(--faint)', marginTop: 6 }}>
                {over ? `تجاوز الميزانية بمقدار ${money(sp - bd)} ر.س` : `المتبقي ${money(Math.max(0, bd - sp))} ر.س`}
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <Modal title={edit.n ? 'تعديل بند مصروف' : 'بند مصروف جديد'} icon={Receipt} onClose={() => setEdit(null)}
          foot={<><button className="btn pri" disabled={!edit.n} onClick={() => save(edit)}><Check size={14} />حفظ البند</button>
            <button className="btn gh" onClick={() => setEdit(null)}>إلغاء</button></>}>
          <Field label="اسم البند">
            <input className="inp" value={edit.n} onChange={e => setEdit({ ...edit, n: e.target.value })} placeholder="مثال: مصاريف تسويق" />
          </Field>
          <Num label="حد الميزانية الشهري" value={edit.budgetLimitMonthly || 0}
            onChange={v => setEdit({ ...edit, budgetLimitMonthly: v })} hint="ينبّه النظام عند تجاوزه" />
          <label className="row" style={{ fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!edit.taxable} onChange={e => setEdit({ ...edit, taxable: e.target.checked })} />
            خاضع لضريبة القيمة المضافة 15%
          </label>
        </Modal>
      )}
    </div>
  );
}

/* ================= الورديات وتذكيرات الإغلاق ================= */
function Shifts({ org, ops, me, myBranches, commitOrg, say }) {
  const [now, setNow] = useState(new Date());
  const [edit, setEdit] = useState(null);
  const isGM = me.role === 'general_management';

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const status = (b) => {
    const [h, m] = (b.shiftEndTime || '02:00').split(':').map(Number);
    const dl = new Date(now); dl.setHours(h, m, 0, 0);
    // الورديات التي تنتهي بعد منتصف الليل تخص يوم العمل السابق
    if (h < 6 && now.getHours() >= 6) dl.setDate(dl.getDate() + 1);
    const mins = Math.round((dl - now) / 60000);
    const workDay = h < 6 ? new Date(dl.getTime() - 86400000).toISOString().slice(0, 10) : dl.toISOString().slice(0, 10);
    const done = (ops.closings || []).some(c => c.branchId === b.id && c.date === workDay && c.status !== 'draft');
    const warn = mins <= (b.reminderBeforeMinutes || 30) && mins > 0;
    return { dl, mins, done, warn, late: mins < 0 && !done, workDay };
  };

  const save = async (b) => {
    await commitOrg(d => ({ ...d, branches: d.branches.map(x => x.id === b.id ? b : x) }), {
      actionType: 'update', targetType: 'branch', targetId: b.id, branchName: b.name,
      title: 'عدّل إعدادات وردية فرع',
      details: `${b.name} · نهاية الوردية ${b.shiftEndTime} · تنبيه قبل ${b.reminderBeforeMinutes} دقيقة`
    });
    say('تم حفظ إعدادات الوردية'); setEdit(null);
  };

  const fmtLeft = (m) => m < 0
    ? `تأخر ${Math.floor(-m / 60)} س ${(-m) % 60} د`
    : `متبقٍ ${Math.floor(m / 60)} س ${m % 60} د`;

  const rows = myBranches.map(b => ({ b, st: status(b) }));
  const late = rows.filter(r => r.st.late).length;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g3">
        <Kpi label="فروع أغلقت وردية اليوم" value={rows.filter(r => r.st.done).length + ' / ' + rows.length} icon={Check} color="#4FB286" />
        <Kpi label="فروع متأخرة عن الإغلاق" value={late} sub={late ? 'تتطلب متابعة فورية' : 'لا تأخير'} icon={AlertTriangle} color={late ? '#D9544D' : '#5B93C4'} />
        <Kpi label="الوقت الآن" value={now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} sub={arDate(today())} icon={Clock} color="#C8A24A" />
      </div>

      <div className="grid g2">
        {rows.map(({ b, st }) => (
          <div key={b.id} className="card" style={{
            borderColor: st.late ? 'rgba(217,84,77,.45)' : st.warn ? 'rgba(224,164,88,.45)' : 'var(--line)'
          }}>
            <div className="card-h" style={{ marginBottom: 10 }}>
              <div className="card-t"><Store size={15} color="var(--brass)" />{b.name}</div>
              {st.done ? <span className="badge b-mint"><Check size={11} />تم الإغلاق</span>
                : st.late ? <span className="badge b-rose"><AlertTriangle size={11} />متأخر</span>
                  : st.warn ? <span className="badge b-amber"><Timer size={11} />اقترب الموعد</span>
                    : <span className="badge b-dim">قيد التشغيل</span>}
            </div>
            <div className="grid g2" style={{ gap: 9 }}>
              <div className="mono-b"><span style={{ fontSize: 11.5 }}>نهاية الوردية</span>
                <span className="num" style={{ fontWeight: 600 }}>{b.shiftEndTime}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11.5 }}>العدّاد</span>
                <span className="num" style={{ fontWeight: 600, color: st.done ? 'var(--mint)' : st.late ? 'var(--rose)' : 'var(--brass)' }}>
                  {st.done ? 'مكتمل' : fmtLeft(st.mins)}
                </span></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className={'badge ' + (b.autoClosingReminderEnabled ? 'b-mint' : 'b-dim')}>
                تذكير تلقائي {b.autoClosingReminderEnabled ? 'مفعّل' : 'موقوف'}
              </span>
              <span className="badge b-dim">قبل <span className="num">{b.reminderBeforeMinutes || 30}</span> دقيقة</span>
              {b.emailReminderEnabled && <span className="badge b-sky">تنبيه بريدي</span>}
              {b.inAppReminderEnabled && <span className="badge b-sky">إشعار داخل المنصة</span>}
            </div>
            {b.managerEmails && (
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, direction: 'ltr', textAlign: 'right' }}>
                {b.managerEmails}
              </div>
            )}
            {isGM && <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setEdit({ ...b })}>
              <Settings size={13} />إعدادات الوردية والتذكير
            </button>}
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={`إعدادات وردية ${edit.name}`} icon={Clock} onClose={() => setEdit(null)}
          foot={<><button className="btn pri" onClick={() => save(edit)}><Check size={14} />حفظ الإعدادات</button>
            <button className="btn gh" onClick={() => setEdit(null)}>إلغاء</button></>}>
          <div className="grid g2">
            <Field label="وقت نهاية الوردية">
              <input type="time" className="inp" value={edit.shiftEndTime || '02:00'}
                onChange={e => setEdit({ ...edit, shiftEndTime: e.target.value })} />
            </Field>
            <Field label="التنبيه قبل الموعد">
              <select className="sel" value={edit.reminderBeforeMinutes || 30}
                onChange={e => setEdit({ ...edit, reminderBeforeMinutes: Number(e.target.value) })}>
                {[15, 30, 45, 60].map(m => <option key={m} value={m}>{m} دقيقة</option>)}
              </select>
            </Field>
          </div>
          {[['autoClosingReminderEnabled', 'تفعيل تذكيرات الإغلاق التلقائية'],
          ['inAppReminderEnabled', 'إشعار داخل المنصة'],
          ['emailReminderEnabled', 'تنبيه عبر البريد الإلكتروني']].map(([k, lbl]) => (
            <label key={k} className="row" style={{ fontSize: 12.5, cursor: 'pointer', marginBottom: 9 }}>
              <input type="checkbox" checked={!!edit[k]} onChange={e => setEdit({ ...edit, [k]: e.target.checked })} />
              {lbl}
            </label>
          ))}
          <Field label="بريد المدراء المستلمين (مفصول بفاصلة)">
            <input className="inp" style={{ direction: 'ltr' }} value={edit.managerEmails || ''}
              placeholder="admin@restaurant.sa, finance@restaurant.sa"
              onChange={e => setEdit({ ...edit, managerEmails: e.target.value })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

/* ================= أرشيف المستندات والمرفقات ================= */
const FILE_CATS = [
  { id: 'receipt', ar: 'إيصال صرف' }, { id: 'invoice', ar: 'فاتورة مورد' },
  { id: 'bank_statement', ar: 'إشعار بنكي' }, { id: 'contract', ar: 'عقد' },
  { id: 'payroll', ar: 'مستند رواتب' }, { id: 'official_doc', ar: 'مستند رسمي' },
  { id: 'general', ar: 'عام' }
];

function Archive({ org, me, myBranches, say }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState(null);
  const [draft, setDraft] = useState(null);
  const camRef = useRef(); const fileRef = useRef();

  useEffect(() => { (async () => setItems((await cloud.get(KEYS.files, { items: [] })).items || []))(); }, []);

  const persist = async (next) => {
    setItems(next);
    await cloud.set(KEYS.files, { items: next });
  };

  const compress = (file) => new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = reject; img.src = String(rd.result);
    };
    rd.onerror = reject; rd.readAsDataURL(file);
  });

  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return say('يُقبل رفع الصور فقط في هذه النسخة', 'no');
    setBusy(true);
    try {
      const url = await compress(file);
      setDraft({
        id: uid('fl'), title: '', category: 'receipt',
        branchId: myBranches[0]?.id || '', fileUrl: url, fileType: 'image',
        fileName: file.name, fileSizeKb: Math.round(url.length * 0.75 / 1024),
        uploadDate: today(), uploadedBy: me.name, amount: 0, referenceNo: '', notes: ''
      });
    } catch { say('تعذّرت معالجة الصورة', 'no'); }
    setBusy(false);
  };

  const saveDraft = async () => {
    if (!draft.title.trim()) return say('اكتب عنوان المستند', 'no');
    const b = org.branches.find(x => x.id === draft.branchId);
    const rec = { ...draft, branchName: b?.name || '', uploadedAt: nowISO() };
    await persist([rec, ...(items || [])].slice(0, 60));
    say('تمت أرشفة المستند وأصبح متاحاً لبقية المستخدمين');
    setDraft(null);
  };

  const del = async (it) => { await persist((items || []).filter(x => x.id !== it.id)); say('تم حذف المستند من الأرشيف'); };

  const ids = myBranches.map(b => b.id);
  const list = (items || []).filter(i => ids.includes(i.branchId) && (filter === 'all' || i.category === filter));
  const totalKb = sum(items || [], i => i.fileSizeKb || 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-t"><ImageIcon size={15} color="var(--brass)" />أرشيف الإيصالات والمستندات</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 5 }}>
              {(items || []).length} مستند · <span className="num">{(totalKb / 1024).toFixed(2)}</span> ميجابايت — تُضغط الصور تلقائياً قبل الحفظ.
            </div>
          </div>
          <div className="row">
            <button className="btn pri" disabled={busy} onClick={() => camRef.current?.click()}>
              <Camera size={15} />التقاط بالكاميرا
            </button>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={14} />رفع صورة
            </button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pick} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
          </div>
        </div>
        <div className="row">
          <button className={'btn sm' + (filter === 'all' ? ' pri' : ' gh')} onClick={() => setFilter('all')}>الكل</button>
          {FILE_CATS.map(c => (
            <button key={c.id} className={'btn sm' + (filter === c.id ? ' pri' : ' gh')} onClick={() => setFilter(c.id)}>{c.ar}</button>
          ))}
        </div>
      </div>

      {items === null && <div className="card"><div className="empty">جارٍ تحميل الأرشيف…</div></div>}
      {items !== null && list.length === 0 && (
        <div className="card"><div className="empty">
          لا مستندات في هذا التصنيف. التقط صورة إيصال أو ارفعها لتُحفظ في أرشيف فروعك.
        </div></div>
      )}

      <div className="grid g4">
        {list.map(it => (
          <div key={it.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <img src={it.fileUrl} alt={it.title} onClick={() => setPreview(it)}
              style={{ width: '100%', height: 140, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{it.title}</div>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge b-brass">{FILE_CATS.find(c => c.id === it.category)?.ar}</span>
                {it.amount > 0 && <span className="badge b-dim"><span className="num">{money(it.amount)}</span></span>}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 7 }}>
                {it.branchName} · {arDate(it.uploadDate)} · {it.uploadedBy}
              </div>
              <div className="row" style={{ marginTop: 9 }}>
                <button className="btn sm gh" onClick={() => setPreview(it)}><Eye size={12} />عرض</button>
                <button className="btn sm gh" onClick={() => del(it)}><Trash2 size={12} color="#D9544D" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <Modal title="بيانات المستند قبل الأرشفة" icon={Camera} onClose={() => setDraft(null)}
          foot={<><button className="btn pri" onClick={saveDraft}><Check size={14} />حفظ في الأرشيف</button>
            <button className="btn gh" onClick={() => setDraft(null)}>إلغاء</button></>}>
          <img src={draft.fileUrl} alt="معاينة" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, marginBottom: 14, background: '#000' }} />
          <div className="grid g2">
            <Field label="عنوان المستند">
              <input className="inp" value={draft.title} placeholder="مثال: فاتورة خضار 12/8"
                onChange={e => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="التصنيف">
              <select className="sel" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {FILE_CATS.map(c => <option key={c.id} value={c.id}>{c.ar}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid g2">
            <Field label="الفرع">
              <select className="sel" value={draft.branchId} onChange={e => setDraft({ ...draft, branchId: e.target.value })}>
                {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Num label="قيمة المستند (اختياري)" value={draft.amount} onChange={v => setDraft({ ...draft, amount: v })}
              hint={`حجم الصورة بعد الضغط ${draft.fileSizeKb} ك.ب`} />
          </div>
          <Field label="ملاحظات">
            <input className="inp" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </Modal>
      )}

      {preview && (
        <Modal wide title={preview.title} icon={ImageIcon} onClose={() => setPreview(null)}
          foot={<button className="btn gh" onClick={() => setPreview(null)}>إغلاق</button>}>
          <img src={preview.fileUrl} alt={preview.title} style={{ width: '100%', borderRadius: 10, background: '#000' }} />
          <div className="row" style={{ marginTop: 12 }}>
            <span className="badge b-brass">{FILE_CATS.find(c => c.id === preview.category)?.ar}</span>
            <span className="badge b-dim">{preview.branchName}</span>
            <span className="badge b-dim">{arDate(preview.uploadDate)}</span>
            {preview.amount > 0 && <span className="badge b-mint"><span className="num">{money(preview.amount)}</span> ر.س</span>}
          </div>
          {preview.notes && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10 }}>{preview.notes}</div>}
        </Modal>
      )}
    </div>
  );
}

/* ================= الجولة التعريفية ================= */
function TourModal({ me, onClose, go }) {
  const [i, setI] = useState(0);
  const steps = [
    { icon: Radio, t: 'منصة واحدة يعمل عليها الجميع', d: 'كل ما تسجله يظهر لبقية المستخدمين خلال ثوانٍ. صور المتصلين أعلى الشاشة تُظهر من يعمل معك الآن، وشريط النشاط اللحظي في لوحة المؤشرات يعرض آخر الإجراءات.', to: 'dash' },
    { icon: ClipboardCheck, t: 'الإغلاق اليومي في أربع خطوات', d: 'المبيعات ثم المصروفات ثم جرد الفئات النقدية ثم الترحيل. عند الجرد يحسب النظام الفرق بين المتوقع والفعلي ويطلب تبريره إن وُجد، وينتهي بتوقيعك الرقمي.', to: 'closing' },
    { icon: ShieldCheck, t: 'دورة اعتماد من مرحلتين', d: 'الفرع يرحّل، الإدارة المالية تدقق، والإدارة العليا تعتمد نهائياً. أي إرجاع يصل الفرع مع السبب، وكل خطوة تُقيَّد في سجل التدقيق.', to: 'approve' },
    { icon: Landmark, t: 'الخزينة الرئيسية تحت السيطرة', d: 'استلام سندات التوريد من الفروع، إصدار أوامر الصرف بحدود الرصيد المتاح، وكشف حركة برصيد تراكمي لكل عملية.', to: 'treasury' },
    { icon: Sparkles, t: 'مدير مالي ذكي تحت الطلب', d: 'يقرأ إغلاقات فروعك ويعيد ملخصاً تنفيذياً وتوصيات لخفض التكلفة ومخاطر النقدية ودرجة أداء لكل فرع.', to: 'ai' }
  ];
  const s = steps[i];
  const allowed = me.role === 'branch_manager' && ['approve', 'ai'].includes(s.to) ? 'dash' : s.to;

  return (
    <Modal title="جولة سريعة في المنصة" icon={Compass} onClose={onClose}
      foot={<>
        {i < steps.length - 1
          ? <button className="btn pri" onClick={() => setI(i + 1)}>التالي</button>
          : <button className="btn pri" onClick={onClose}><Check size={14} />ابدأ العمل</button>}
        <button className="btn" onClick={() => go(allowed)}>افتح هذه الشاشة</button>
        <button className="btn gh" onClick={onClose}>تخطي الجولة</button>
      </>}>
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        {steps.map((_, k) => (
          <div key={k} style={{
            height: 4, flex: 1, borderRadius: 4,
            background: k <= i ? 'var(--brass)' : 'var(--ink3)', transition: '.3s'
          }} />
        ))}
      </div>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 13 }}>
          <s.icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>{s.t}</h3>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 2 }}>{s.d}</div>
        </div>
      </div>
      <hr className="hr" />
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
        الخطوة <span className="num">{i + 1}</span> من <span className="num">{steps.length}</span> · صلاحيتك الحالية: {ROLES[me.role].ar}
      </div>
    </Modal>
  );
}

/* ================= قائمة الدخل الشهرية ================= */
function IncomeStatement({ org, ops, myBranches, scoped, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [bid, setBid] = useState('all');

  const branches = myBranches.filter(b => bid === 'all' || b.id === bid);
  const ids = branches.map(b => b.id);
  const cls = scoped.closings.filter(c => c.date.slice(0, 7) === month && ids.includes(c.branchId));

  const R = {
    cash: sum(cls, c => c.cashSales),
    card: sum(cls, c => c.cardSales),
    bank: sum(cls, c => c.bankTransferSales || 0),
    del: sum(cls, c => c.totalDeliverySales)
  };
  const grossRevenue = R.cash + R.card + R.bank + R.del;
  const commissions = sum(cls, c => sum(c.deliverySales || [], d => d.commissionAmount || 0));
  const netRevenue = grossRevenue - commissions;

  const cats = org.expenseCats || EXP_CATS;
  const byCat = cats.map(k => ({
    id: k.id, n: k.n, taxable: k.taxable,
    v: sum(cls.flatMap(c => c.expenses || []).filter(e => e.categoryId === k.id), e => e.amount)
  })).filter(x => x.v > 0);
  const branchExpenses = sum(byCat, x => x.v);

  const fx = (ops.fixedExpenses || []).filter(f => f.month === month && ids.includes(f.branchId));
  const fixedTotal = sum(fx, f => f.rentAmount + f.electricityBill + f.waterBill + f.internetBill + f.otherBills);

  const emps = org.employees.filter(e => ids.includes(e.branchId));
  const payrollCost = sum(emps, e => e.baseSalary + (e.housingAllowance || 0) + (e.transportAllowance || 0));
  const paidAtBranch = sum(byCat.filter(x => ['ec2', 'ec3'].includes(x.id)), x => x.v);
  const payrollRemaining = Math.max(0, payrollCost - paidAtBranch);

  const vatOut = grossRevenue * 15 / 115;
  const vatIn = sum(byCat.filter(x => x.taxable), x => x.v) * 15 / 115;
  const vatDue = vatOut - vatIn;

  const totalCost = branchExpenses + fixedTotal + payrollRemaining;
  const operatingProfit = netRevenue - totalCost;
  const netAfterVat = operatingProfit - vatDue;
  const cashVariance = sum(cls, c => c.variance);

  const L = ({ k, v, c, bold, ind, note }) => (
    <div className="row" style={{
      justifyContent: 'space-between', padding: '9px 0',
      borderBottom: '1px solid rgba(51,44,38,.45)',
      paddingInlineStart: ind ? 18 : 0
    }}>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 600 : 400, color: ind ? 'var(--dim)' : 'var(--txt)' }}>
        {k}{note && <span style={{ fontSize: 10.5, color: 'var(--faint)', marginInlineStart: 7 }}>{note}</span>}
      </span>
      <span className="num" style={{ fontSize: bold ? 14 : 12.5, fontWeight: bold ? 700 : 500, color: c }}>{money(v)}</span>
    </div>
  );

  const exportCsv = () => {
    const rows = [
      ['قائمة الدخل', month, bid === 'all' ? 'كل الفروع' : branches[0]?.name],
      ['مبيعات نقدية', R.cash], ['مبيعات الشبكة', R.card], ['تحويل بنكي', R.bank],
      ['تطبيقات التوصيل', R.del], ['إجمالي الإيراد', grossRevenue],
      ['عمولات التطبيقات', -commissions], ['صافي الإيراد', netRevenue],
      ...byCat.map(x => ['مصروف: ' + x.n, -x.v]),
      ['الالتزامات الثابتة', -fixedTotal],
      ['الرواتب غير المصروفة بالفروع', -payrollRemaining],
      ['إجمالي التكاليف', -totalCost],
      ['الربح التشغيلي', operatingProfit],
      ['ض.ق.م المستحقة', -vatDue],
      ['صافي الربح بعد الضريبة', netAfterVat],
      ['فروقات الصندوق', cashVariance]
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `قائمة-الدخل-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل قائمة الدخل');
  };

  return (
    <>
      <div className="card">
        <div className="row">
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الشهر المالي</label>
            <input type="month" className="inp" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <div style={{ flex: 1.5, minWidth: 180 }}>
            <label className="lbl">النطاق</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">كل الفروع ضمن صلاحيتي</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button className="btn pri" style={{ alignSelf: 'flex-end' }} onClick={exportCsv}>
            <Download size={14} />تصدير القائمة
          </button>
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="صافي الإيراد" value={money(netRevenue)} sub={`${cls.length} إغلاق`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="إجمالي التكاليف" value={money(totalCost)} sub={`${netRevenue ? ((totalCost / netRevenue) * 100).toFixed(1) : 0}% من الإيراد`} icon={Receipt} color="#D9544D" />
        <Kpi label="الربح التشغيلي" value={money(operatingProfit)} sub={`هامش ${netRevenue ? ((operatingProfit / netRevenue) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="ض.ق.م المستحقة" value={money(vatDue)} sub="مخرجات ناقص مدخلات" icon={Landmark} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><FileText size={15} color="var(--brass)" />قائمة الدخل — {month}</div>
          <span className="badge b-dim">{bid === 'all' ? `${branches.length} فرع` : branches[0]?.name}</span>
        </div>

        <div className="lbl" style={{ marginTop: 4 }}>الإيرادات</div>
        <L k="مبيعات نقدية" v={R.cash} ind />
        <L k="مبيعات الشبكة (مدى/فيزا)" v={R.card} ind />
        <L k="تحويل بنكي مباشر" v={R.bank} ind />
        <L k="تطبيقات التوصيل" v={R.del} ind />
        <L k="إجمالي الإيراد" v={grossRevenue} bold c="var(--brass)" />
        <L k="ناقص عمولات التطبيقات" v={-commissions} ind c="var(--rose)" />
        <L k="صافي الإيراد" v={netRevenue} bold c="var(--brass)" />

        <div className="lbl" style={{ marginTop: 16 }}>التكاليف التشغيلية بالفروع</div>
        {byCat.map(x => <L key={x.id} k={x.n} v={x.v} ind />)}
        {byCat.length === 0 && <div className="empty" style={{ padding: 16 }}>لا مصروفات مسجلة لهذا الشهر.</div>}
        <L k="إجمالي مصروفات الفروع" v={branchExpenses} bold c="var(--rose)" />

        <div className="lbl" style={{ marginTop: 16 }}>التكاليف الثابتة والإدارية</div>
        <L k="إيجارات الفروع" v={sum(fx, f => f.rentAmount)} ind />
        <L k="كهرباء ومياه" v={sum(fx, f => f.electricityBill + f.waterBill)} ind />
        <L k="إنترنت ومصاريف إدارية" v={sum(fx, f => f.internetBill + f.otherBills)} ind />
        <L k="الرواتب المستحقة" v={payrollRemaining} ind note={paidAtBranch > 0 ? `صُرف بالفروع ${money(paidAtBranch)}` : ''} />
        <L k="إجمالي التكاليف الثابتة" v={fixedTotal + payrollRemaining} bold c="var(--rose)" />

        <hr className="hr" />
        <L k="الربح التشغيلي" v={operatingProfit} bold c={operatingProfit >= 0 ? 'var(--mint)' : 'var(--rose)'} />
        <L k="ضريبة القيمة المضافة المستحقة" v={vatDue} ind c="var(--sky)"
          note={`مخرجات ${money(vatOut)} − مدخلات ${money(vatIn)}`} />
        <div style={{
          marginTop: 12, padding: '13px 15px', borderRadius: 12,
          border: '1px solid ' + (netAfterVat >= 0 ? 'rgba(79,178,134,.45)' : 'rgba(217,84,77,.45)'),
          background: netAfterVat >= 0 ? 'rgba(79,178,134,.08)' : 'rgba(217,84,77,.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>صافي الربح بعد الضريبة</span>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: netAfterVat >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
            {money(netAfterVat)}
          </span>
        </div>
        {cashVariance !== 0 && (
          <div style={{ fontSize: 11.5, color: cashVariance < 0 ? 'var(--rose)' : 'var(--dim)', marginTop: 10 }}>
            ملاحظة: فروقات الصندوق خلال الشهر بلغت {money(cashVariance)} ر.س وهي خارج القائمة أعلاه وتُعالَج كتسويات.
          </div>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.9 }}>
          الرواتب تظهر بالمستحق الشهري بعد استبعاد ما صُرف نقداً بالفروع لتفادي الازدواج. القائمة استرشادية لأغراض الإدارة ولا تحل محل القوائم المعتمدة من المحاسب القانوني.
        </div>
      </div>
    </>
  );
}
