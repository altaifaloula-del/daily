import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, ClipboardCheck, Banknote, Users, Building2, FileBarChart,
  ShieldCheck, Bell, LogOut, Plus, Minus, Trash2, Check, X, Search,
  CircleDollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet,
  ArrowLeftRight, UserCog, Menu, RefreshCw, Lock, Radio, Download,
  ChevronLeft, Stamp, Landmark, Receipt, CalendarDays, Store, Eye, Send, Copy,
  Sparkles, Lightbulb, Gift, Truck, Printer, HardDrive, Settings, FileText, Upload,
  Camera, Image as ImageIcon, Clock, Timer, Compass,
  Fingerprint, ScanFace, ShieldAlert, Video, Grid3x3,
  BarChart3, CheckCircle2, ArrowUp, ArrowDown,
  CreditCard, Coins, ChevronDown, ChevronRight,
  Crop, RotateCw, RotateCcw, EyeOff, Sun, Wand2, Delete, Scale, Home, Star, QrCode, Signature, PenLine
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line
} from 'recharts';
import { CSS } from './styles';
import { cloud, KEYS, kb, authApi, brKey, bfKey } from './storage';

/* ===== v38.3 — تحميل التطبيقات عند الطلب =====
   الحزمة الأولى تحمل الدخول والرئيسية والهيكل فقط؛ كل تطبيق في ملف مستقل يُنزَّل عند فتحه (ثم يُجلب الباقي بهدوء في الخلفية).
   فشل تحميل ملف بعد نشر نسخة جديدة (اسم قديم لم يعد موجودًا) يعيد تحميل الصفحة مرة واحدة. */
function ModLoading() {
  return React.createElement('div', { className: 'mod-loading', role: 'status', 'aria-live': 'polite' }, React.createElement('span', { className: 'mod-spin' }), 'جارٍ تحميل التطبيق…');
}
const MOD_LOADERS = [];
function lazyComp(load, name) {
  const safe = () => load().then(m => { try { sessionStorage.removeItem('mod_reload'); } catch { } return m; }).catch(e => {
    let tried = false; try { tried = !!sessionStorage.getItem('mod_reload'); sessionStorage.setItem('mod_reload', '1'); } catch { }
    if (!tried && typeof location !== 'undefined') { location.reload(); return new Promise(() => { }); }
    throw e; });
  const L = React.lazy(() => safe().then(m => ({ default: m[name] })));
  const W = (props) => React.createElement(React.Suspense, { fallback: React.createElement(ModLoading) }, React.createElement(L, props));
  W.displayName = name; MOD_LOADERS.push(load);
  return W;
}
// جلب كل ملفات التطبيقات في الخلفية بعد ظهور الواجهة — فتح أي تطبيق لاحقًا فوري
function prefetchMods() { MOD_LOADERS.forEach((f, i) => setTimeout(() => { f().catch(() => { }); }, 150 * i)); }
const MfaPolicyCard = lazyComp(() => import('./mods/admin/MfaPolicyCard.jsx'), 'MfaPolicyCard');
const PasswordPanel = lazyComp(() => import('./mods/admin/PasswordPanel.jsx'), 'PasswordPanel');
const OutputDialog = lazyComp(() => import('./mods/closing/OutputDialog.jsx'), 'OutputDialog');
const CashierBook = lazyComp(() => import('./mods/pos/CashierBook.jsx'), 'CashierBook');
const DailyBranchReport = lazyComp(() => import('./mods/acct/DailyBranchReport.jsx'), 'DailyBranchReport');
const PosImport = lazyComp(() => import('./mods/pos/PosImport.jsx'), 'PosImport');
const SalesInvoices = lazyComp(() => import('./mods/pos/SalesInvoices.jsx'), 'SalesInvoices');
const Sales = lazyComp(() => import('./mods/pos/Sales.jsx'), 'Sales');
const BranchCompare = lazyComp(() => import('./mods/acct/BranchCompare.jsx'), 'BranchCompare');
const SmartPurchasing = lazyComp(() => import('./mods/inv/SmartPurchasing.jsx'), 'SmartPurchasing');
const CashFlow13 = lazyComp(() => import('./mods/acct/CashFlow13.jsx'), 'CashFlow13');
const BoardPack = lazyComp(() => import('./mods/acct/BoardPack.jsx'), 'BoardPack');
const Scenario = lazyComp(() => import('./mods/acct/Scenario.jsx'), 'Scenario');
const Scorecard = lazyComp(() => import('./mods/acct/Scorecard.jsx'), 'Scorecard');
const BreakEven = lazyComp(() => import('./mods/acct/BreakEven.jsx'), 'BreakEven');
const GrowthAnalytics = lazyComp(() => import('./mods/acct/GrowthAnalytics.jsx'), 'GrowthAnalytics');
const EntitiesCenter = lazyComp(() => import('./mods/acct/EntitiesCenter.jsx'), 'EntitiesCenter');
const ReportBuilder = lazyComp(() => import('./mods/acct/ReportBuilder.jsx'), 'ReportBuilder');
const ExecDashboard = lazyComp(() => import('./mods/acct/ExecDashboard.jsx'), 'ExecDashboard');
const AlertsCenter = lazyComp(() => import('./mods/acct/AlertsCenter.jsx'), 'AlertsCenter');
const Dashboard = lazyComp(() => import('./mods/acct/Dashboard.jsx'), 'Dashboard');
const PosApp = lazyComp(() => import('./mods/pos/PosApp.jsx'), 'PosApp');
const PosQuickProducts = lazyComp(() => import('./mods/pos/PosQuickProducts.jsx'), 'PosQuickProducts');
const PosPromos = lazyComp(() => import('./mods/pos/PosPromos.jsx'), 'PosPromos');
const PosLoyalty = lazyComp(() => import('./mods/pos/PosLoyalty.jsx'), 'PosLoyalty');
const PosShifts = lazyComp(() => import('./mods/pos/PosShifts.jsx'), 'PosShifts');
const PosSettings = lazyComp(() => import('./mods/pos/PosSettings.jsx'), 'PosSettings');
const Closing = lazyComp(() => import('./mods/closing/Closing.jsx'), 'Closing');
const ClosingForm = lazyComp(() => import('./mods/closing/ClosingForm.jsx'), 'ClosingForm');
const ClosingView = lazyComp(() => import('./mods/closing/ClosingView.jsx'), 'ClosingView');
const Approvals = lazyComp(() => import('./mods/closing/Approvals.jsx'), 'Approvals');
const Treasury = lazyComp(() => import('./mods/acct/Treasury.jsx'), 'Treasury');
const Leaves = lazyComp(() => import('./mods/hr/Leaves.jsx'), 'Leaves');
const OvertimeSheet = lazyComp(() => import('./mods/hr/OvertimeSheet.jsx'), 'OvertimeSheet');
const PayrollMuster = lazyComp(() => import('./mods/hr/PayrollMuster.jsx'), 'PayrollMuster');
const Payroll = lazyComp(() => import('./mods/hr/Payroll.jsx'), 'Payroll');
const HrMaster = lazyComp(() => import('./mods/hr/HrMaster.jsx'), 'HrMaster');
const HrPolicy = lazyComp(() => import('./mods/hr/HrPolicy.jsx'), 'HrPolicy');
const Attendance = lazyComp(() => import('./mods/hr/Attendance.jsx'), 'Attendance');
const ShiftEngine = lazyComp(() => import('./mods/hr/ShiftEngine.jsx'), 'ShiftEngine');
const Tasks = lazyComp(() => import('./mods/hr/Tasks.jsx'), 'Tasks');
const PointsLedger = lazyComp(() => import('./mods/hr/PointsLedger.jsx'), 'PointsLedger');
const EmployeeFile = lazyComp(() => import('./mods/hr/EmployeeFile.jsx'), 'EmployeeFile');
const Performance = lazyComp(() => import('./mods/hr/Performance.jsx'), 'Performance');
const Rewards = lazyComp(() => import('./mods/hr/Rewards.jsx'), 'Rewards');
const Corrective = lazyComp(() => import('./mods/hr/Corrective.jsx'), 'Corrective');
const Training = lazyComp(() => import('./mods/hr/Training.jsx'), 'Training');
const RoleKpi = lazyComp(() => import('./mods/hr/RoleKpi.jsx'), 'RoleKpi');
const PerfSnap = lazyComp(() => import('./mods/hr/PerfSnap.jsx'), 'PerfSnap');
const HrDashboard = lazyComp(() => import('./mods/hr/HrDashboard.jsx'), 'HrDashboard');
const HrSignPad = lazyComp(() => import('./mods/hr/HrSignPad.jsx'), 'HrSignPad');
const SignDocsModal = lazyComp(() => import('./mods/hr/SignDocsModal.jsx'), 'SignDocsModal');
const ESign = lazyComp(() => import('./mods/hr/ESign.jsx'), 'ESign');
const Reports = lazyComp(() => import('./mods/acct/Reports.jsx'), 'Reports');
const DeliveryAppsPanel = lazyComp(() => import('./mods/admin/DeliveryAppsPanel.jsx'), 'DeliveryAppsPanel');
const Admin = lazyComp(() => import('./mods/admin/Admin.jsx'), 'Admin');
const BranchForm = lazyComp(() => import('./mods/admin/BranchForm.jsx'), 'BranchForm');
const UserForm = lazyComp(() => import('./mods/admin/UserForm.jsx'), 'UserForm');
const Suppliers = lazyComp(() => import('./mods/inv/Suppliers.jsx'), 'Suppliers');
const CountScheduleCard = lazyComp(() => import('./mods/inv/CountScheduleCard.jsx'), 'CountScheduleCard');
const WarehousesPanel = lazyComp(() => import('./mods/inv/WarehousesPanel.jsx'), 'WarehousesPanel');
const BlindCount = lazyComp(() => import('./mods/inv/BlindCount.jsx'), 'BlindCount');
const WasteFields = lazyComp(() => import('./mods/inv/WasteFields.jsx'), 'WasteFields');
const WastePending = lazyComp(() => import('./mods/inv/WastePending.jsx'), 'WastePending');
const PriceAlerts = lazyComp(() => import('./mods/inv/PriceAlerts.jsx'), 'PriceAlerts');
const WasteControl = lazyComp(() => import('./mods/inv/WasteControl.jsx'), 'WasteControl');
const BranchWarehouse = lazyComp(() => import('./mods/inv/BranchWarehouse.jsx'), 'BranchWarehouse');
const UsageVariance = lazyComp(() => import('./mods/inv/UsageVariance.jsx'), 'UsageVariance');
const Inventory = lazyComp(() => import('./mods/inv/Inventory.jsx'), 'Inventory');
const AppPermsPanel = lazyComp(() => import('./mods/admin/AppPermsPanel.jsx'), 'AppPermsPanel');
const AppsCenter = lazyComp(() => import('./mods/admin/AppsCenter.jsx'), 'AppsCenter');
const MizanMerge = lazyComp(() => import('./mods/acct/MizanMerge.jsx'), 'MizanMerge');
const Accounting = lazyComp(() => import('./mods/acct/Accounting.jsx'), 'Accounting');
const Partners = lazyComp(() => import('./mods/inv/Partners.jsx'), 'Partners');
const AiCenter = lazyComp(() => import('./mods/acct/AiCenter.jsx'), 'AiCenter');
const CloudHealth = lazyComp(() => import('./mods/admin/CloudHealth.jsx'), 'CloudHealth');
const SystemPanel = lazyComp(() => import('./mods/admin/SystemPanel.jsx'), 'SystemPanel');
const CategoriesPanel = lazyComp(() => import('./mods/admin/CategoriesPanel.jsx'), 'CategoriesPanel');
const Workforce = lazyComp(() => import('./mods/hr/Workforce.jsx'), 'Workforce');
const Shifts = lazyComp(() => import('./mods/hr/Shifts.jsx'), 'Shifts');
const DocsCenter = lazyComp(() => import('./mods/acct/DocsCenter.jsx'), 'DocsCenter');
const Archive = lazyComp(() => import('./mods/acct/Archive.jsx'), 'Archive');
const FinancialReports = lazyComp(() => import('./mods/acct/FinancialReports.jsx'), 'FinancialReports');
const IncomeStatement = lazyComp(() => import('./mods/acct/IncomeStatement.jsx'), 'IncomeStatement');
const QrFeedback = lazyComp(() => import('./mods/pos/QrFeedback.jsx'), 'QrFeedback');
const QrDashboard = lazyComp(() => import('./mods/pos/QrDashboard.jsx'), 'QrDashboard');
const QrComplaints = lazyComp(() => import('./mods/pos/QrComplaints.jsx'), 'QrComplaints');
const QrBranchesView = lazyComp(() => import('./mods/pos/QrBranchesView.jsx'), 'QrBranchesView');


/* ================= أدوات مساعدة عامة ================= */
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
// v29.3: التواريخ بتوقيت الجهاز المحلي (السعودية UTC+3) — toISOString كان يعيد تاريخ UTC
// فيُرجع «أمس» بين 00:00 و03:00، ويُنقص يومًا من كل تاريخ يُبنى من منتصف الليل المحلي (addDays(d,1) = d)
const pad2 = (n) => String(n).padStart(2, '0');
const isoD = (dt) => dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
const today = () => isoD(new Date());
// يوم العمل للإغلاق: ما قبل 6 صباحًا يخص وردية اليوم السابق (المطاعم تغلق بعد منتصف الليل)
const businessDay = () => { const d = new Date(); if (d.getHours() < 6) d.setDate(d.getDate() - 1); return isoD(d); };
const nowISO = () => new Date().toISOString();

/* تجزئة كلمة السر (SHA-256) — لا تُخزَّن كلمة السر كنص صريح */
async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text + '::rms8'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
/* المسافة بالأمتار بين نقطتين (Haversine) — للتحقّق من نطاق جيوفنس الفرع عند تسجيل الحضور (م3) */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ================= البصمة الحيوية عبر WebAuthn (بصمة/وجه الجهاز) ================= */
const webauthnSupported = () =>
  typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials);

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (str) => {
    const s = str.replace(/-/g, '+').replace(/_/g, '/'); const pad = s.length % 4 ? '='.repeat(4 - s.length % 4) : '';
    const bin = atob(s + pad); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr.buffer;
  }
};

// تسجيل بصمة الجهاز لمستخدم — يعيد معرّف الاعتماد ليُخزَّن على حسابه
async function bioEnroll(user) {
  if (!webauthnSupported()) throw new Error('الجهاز لا يدعم البصمة الحيوية');
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'ميزان — منصة إدارة المطاعم', id: location.hostname },
      user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
      timeout: 60000, attestation: 'none'
    }
  });
  return b64.enc(cred.rawId);
}

// التحقق ببصمة الجهاز مقابل معرّف مخزَّن
async function bioVerify(credId) {
  if (!webauthnSupported()) throw new Error('الجهاز لا يدعم البصمة الحيوية');
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: b64.dec(credId), transports: ['internal'] }],
      userVerification: 'required', timeout: 60000, rpId: location.hostname
    }
  });
  return true;
}

/* v32.3 — بصمة/وجه هذا الجهاز لقفل التطبيق (على نمط تطبيقات البنوك): الاعتماد يُحفظ على الجهاز نفسه لكل مستخدم،
   والجلسة السحابية تبقى قائمة — البصمة تفتح التطبيق عند فتحه أو العودة إليه، وكلمة السر للدخول الكامل */
const BIO_KEY = (email) => 'mizan:bio:' + String(email || '').toLowerCase();
const devBioId = (me) => { try { return (me && localStorage.getItem(BIO_KEY(me.email))) || ''; } catch { return ''; } };
const setDevBio = (me, id) => { try { if (id) localStorage.setItem(BIO_KEY(me.email), id); else localStorage.removeItem(BIO_KEY(me.email)); } catch { } };
const bioAvailable = async () => { try { return webauthnSupported() && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } };
const inAppBrowser = () => { try { return /FBAN|FBAV|Instagram|WhatsApp|Line\/|GSA\/|Snapchat|Twitter|TikTok/i.test(navigator.userAgent); } catch { return false; } };

/* ================= تنبيهات النشاط الحيّة (إعداد لكل جهاز) ================= */
const NOTIFY_KEY = 'rms8:notify';
// v30.2: الإعداد يشمل فئات الإشعارات (كلها مفعّلة افتراضيًا ضمن ما يسمح به دور المستخدم)
const notifyCfg = () => { try { const c = JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}'); return { on: false, sound: true, ...c, cats: { inv: true, closing: true, fin: true, hr: true, act: true, ...((c && c.cats) || {}) } }; } catch { return { on: false, sound: true, cats: { inv: true, closing: true, fin: true, hr: true, act: true } }; } };
const saveNotifyCfg = (c) => { try { localStorage.setItem(NOTIFY_KEY, JSON.stringify({ on: !!c.on, sound: !!c.sound, cats: c.cats || {} })); } catch { } };

// إشعار متصفح (يعمل والمنصة مفتوحة ولو في تبويب/نافذة خلفية) — الضغط عليه يفتح الشاشة المعنية
function notifyBrowser(title, body, icon, opt) {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    const n = new Notification(title, { body, icon: icon || undefined, dir: 'rtl', lang: 'ar', tag: (opt && opt.tag) || 'rms8-act' });
    if (opt && opt.onClick) n.onclick = () => { try { window.focus(); opt.onClick(); n.close(); } catch { } };
    return true;
  } catch { return false; }
}

/* ============================================================
   v30.2 — إشعارات الجهاز حسب الدور: كل مستخدم يُشعَر بما يخصه فقط (حسب شاشات دوره وفروعه)
   الأحداث تُشتق من البيانات الحية — لكل حدث معرّف ثابت، ويُشعَر به مرة واحدة على الجهاز.
   ============================================================ */
const NOTIF_CATS = {
  inv: { ar: 'المخزون والتحويلات', tabs: ['inv', 'whbranch'] },
  closing: { ar: 'الإغلاق اليومي', tabs: ['approve', 'closing'] },
  fin: { ar: 'المالية والموردون', tabs: ['suppliers', 'purchasing', 'treasury', 'acct'] },
  hr: { ar: 'الموارد البشرية', tabs: ['hrops', 'hrmaster', 'people'], who: (me) => { const R = ROLES[me?.role] || {}; return R.scope === 'all' || R.approver || me?.role === 'branch_manager' || me?.role === 'regional_manager'; } },
  act: { ar: 'نشاط المستخدمين الآخرين', admin: true }
};
const roleHasTab = (me, t) => ((ROLES[me?.role] || {}).tabs || []).includes(t);
const notifCatsFor = (me) => Object.keys(NOTIF_CATS).filter(k => NOTIF_CATS[k].admin ? !!(ROLES[me?.role] || {}).admin
  : (NOTIF_CATS[k].tabs.some(t => roleHasTab(me, t)) && (!NOTIF_CATS[k].who || NOTIF_CATS[k].who(me))));
function buildNotifEvents(org, ops, me, myBranches) {
  const ev = [];
  if (!me) return ev;
  const R = ROLES[me.role] || {};
  const central = R.scope === 'all';
  const post = rolePost(me.role);
  const brIds = (myBranches || []).map(b => b.id);
  const inScope = (bId) => central || brIds.includes(bId);
  const td = today(), bd = businessDay();
  const itemN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || 'صنف';
  const linesTxt = (t) => (t.lines || []).slice(0, 3).map(l => itemN(l.itemId) + ' ' + (l.qtySent || l.qtyReq || '')).join('، ') + ((t.lines || []).length > 3 ? '…' : '');
  const push = (id, cat, title, body, tab, view) => ev.push({ id, cat, title, body, tab, view });

  // —— المخزون والتحويلات ——
  if (whOn(org)) {
    const T = ops.whTransfers || [];
    if (central && post && roleHasTab(me, 'inv')) {
      T.forEach(t => {
        if (t.status === 'requested') push('inv:req:' + t.id, 'inv', 'طلب تحويل من ' + whName(org, t.toWh), linesTxt(t), 'inv', 'wh');
        if (t.kind === 'b2b' && t.status === 'proposed') push('inv:b2b:' + t.id, 'inv', 'تحويل بانتظار اعتمادك: ' + whName(org, t.fromWh) + ' ← ' + whName(org, t.toWh), linesTxt(t), 'inv', 'wh');
        if (t.kind === 'return' && t.status === 'sent') push('inv:ret:' + t.id, 'inv', 'إرجاع بانتظار الاستلام من ' + whName(org, t.fromWh), linesTxt(t), 'inv', 'wh');
        if (t.status === 'received' && (t.lines || []).some(l => Math.abs((Number(l.qtySent) || 0) - (Number(l.qtyRecv) || 0)) > 0.0005))
          push('inv:diff:' + t.id, 'inv', 'فرق استلام في ' + whName(org, t.toWh), (t.no || '') + ' — الكمية المستلمة أقل/أكثر من المصروفة', 'inv', 'wh');
      });
    }
    if (roleHasTab(me, 'whbranch') && !central) {   // الاستلام والطلب مهمة الفرع — المركز يُشعَر بما يحتاج إجراءه هو
      const myWh = (myBranches || []).map(b => whForBranch(org, b.id)).filter(Boolean).map(w => w.id);
      T.forEach(t => {
        if (myWh.includes(t.toWh) && t.status === 'sent' && t.kind !== 'b2b' && t.kind !== 'return') push('inv:in:' + t.id, 'inv', 'وارد إلى ' + whName(org, t.toWh) + ' — بانتظار استلامك', linesTxt(t), 'whbranch');
        if (myWh.includes(t.fromWh) && t.kind === 'b2b' && (t.status === 'sent' || t.status === 'rejected'))
          push('inv:out:' + t.id + ':' + t.status, 'inv', t.status === 'sent' ? 'اعتمد المركز تحويلك إلى ' + whName(org, t.toWh) : 'رُفض تحويلك إلى ' + whName(org, t.toWh), t.rejectNote || linesTxt(t), 'whbranch');
      });
      (countSchedule(org, ops) || []).forEach(x => { if (myWh.includes(x.w.id) && (x.st === 'over' || x.st === 'due')) push('inv:cnt:' + x.w.id + ':' + x.due, 'inv', (x.st === 'over' ? 'جرد دوري متأخر — ' : 'جرد دوري مستحق اليوم — ') + x.w.name, 'آخر جرد: ' + (x.last || 'لا يوجد') + ' · الموعد ' + x.due, 'whbranch'); });
      {
        const SB = stockByWh(org, ops);
        myWh.forEach(w => (org.items || []).forEach(it => { const mn = Number(it.minQty) || 0; const q = ((SB.byWh[w] || {})[it.id]) || 0;
          if (mn > 0 && q <= mn) push('inv:low:' + w + ':' + it.id + ':' + td, 'inv', 'صنف عند الحد الأدنى في ' + whName(org, w), it.name + (bookHidden(org, me) ? ' — عند حد الطلب' : ' — الرصيد ' + q3(q)), 'whbranch'); }));
      }
    }
  }
  // —— v37.4: هدر بانتظار الاعتماد (لمن يملك الاعتماد، عدا مقدّم الطلب) ——
  if (canApproveWaste(me)) (ops.wasteRequests || []).forEach(r => { if (r.status === 'pending' && r.by !== me.name && (!r.branchId || inScope(r.branchId))) push('inv:wr:' + r.id, 'inv', 'هدر بانتظار اعتمادك — ' + whName(org, r.whId || MAIN_WH), money(r.value) + ' ر.س · ' + wasteReasonAr(r.reason) + ' · ' + (r.by || ''), central && roleHasTab(me, 'inv') ? 'inv' : 'whbranch', central && roleHasTab(me, 'inv') ? 'waste' : 'mv'); });
  // —— v37.8: تجاوز سقف الهدر اليومي — لمتابعي الهدر في المركز (شاشة ضبط الهدر) ——
  if (central && roleHasTab(me, 'inv')) { try { computeSmartAlerts(org, ops, myBranches || []).forEach(a => { if (/^wcap-/.test(String(a.id))) push('inv:' + a.id, 'inv', a.title, a.msg || '', 'inv', 'waste'); }); } catch { } }
  // —— v37.5: الجرد الأعمى — اعتماد لشخص آخر، إعادة عدّ، وجرد A اليومي ——
  {
    const myWhs = central ? null : (myBranches || []).map(b => whForBranch(org, b.id)).filter(Boolean).map(w => w.id);
    const whTab = (w) => (w || MAIN_WH) === MAIN_WH ? (roleHasTab(me, 'inv') ? ['inv', 'count'] : null) : (roleHasTab(me, 'whbranch') ? ['whbranch', 'count'] : central && roleHasTab(me, 'inv') ? ['inv', 'wh'] : null);
    (ops.countSessions || []).forEach(s => { const w = s.whId || MAIN_WH; const tv = whTab(w); if (!tv || (myWhs && !myWhs.includes(w))) return;
      if (s.status === 'submitted' && canApproveCount(me) && s.countedBy !== me.name && s.recountBy !== me.name) push('inv:cs:' + s.id, 'inv', 'جرد بانتظار اعتمادك — ' + whName(org, w), (s.lines || []).length + ' صنف · عدّه ' + (s.countedBy || ''), tv[0], tv[1]);
      if (s.status === 'recount') push('inv:rc:' + s.id, 'inv', 'إعادة عدّ مطلوبة — ' + whName(org, w), (s.lines || []).filter(l => l.flag).length + ' صنف خارج التسامح', tv[0], tv[1]); });
    if (countCfgOf(org).dailyA && myWhs) myWhs.forEach(w => { if (!aCountDone(ops, w, td) && roleHasTab(me, 'whbranch')) push('inv:acnt:' + w + ':' + td, 'inv', 'جرد أصناف A اليومي — ' + whName(org, w), 'لم يُسلَّم جرد اليوم للأصناف الأعلى قيمة', 'whbranch', 'count'); });
  }
  // —— الإغلاق اليومي ——
  if (roleHasTab(me, 'approve')) (ops.closings || []).forEach(c => { if (c.status === 'submitted' && inScope(c.branchId)) push('cl:sub:' + c.id, 'closing', 'إغلاق بانتظار التدقيق — ' + (c.branchName || ''), (c.date || '') + ' · إيراد ' + money(c.totalRevenue || 0) + (c.variance ? ' · فرق ' + money(c.variance) : ''), 'approve'); });
  if (roleHasTab(me, 'closing') && !central) (ops.closings || []).forEach(c => { if (c.status === 'rejected' && inScope(c.branchId)) push('cl:rej:' + c.id + ':' + (c.updatedAt || ''), 'closing', 'أُعيد إغلاق للتصحيح — ' + (c.branchName || ''), (c.date || '') + (c.rejectionReason ? ' · ' + c.rejectionReason : ''), 'closing'); });
  if (central || roleHasTab(me, 'closing')) {
    try { computeSmartAlerts(org, ops, myBranches || []).forEach(a => { if (/^late-|deficit|def-|defp-/.test(String(a.id))) push('cl:sa:' + a.id + ':' + bd, 'closing', a.title, a.msg || '', 'closing'); }); } catch { }
  }
  // —— v30.5: أوامر شراء بانتظار الاعتماد + دفعات قريبة الانتهاء ——
  if ((R.approver || R.admin) && central) (ops.purchaseOrders || []).forEach(po => { if (po.status === 'pending') push('fin:po:' + po.id, 'fin', 'أمر شراء بانتظار اعتمادك — ' + (po.supplierName || ''), (po.poNo || '') + ' · ' + money((po.lines || []).reduce((s2, l) => s2 + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)) + ' ر.س' + (po.priceAlert ? ' · ⚠ ' + po.priceAlert + ' بند بسعر أعلى من متوسط آخر 3 مشتريات' : ''), 'purchasing'); });
  if (whOn(org) && (central || roleHasTab(me, 'whbranch'))) {
    const myWh = central ? null : (myBranches || []).map(b => whForBranch(org, b.id)).filter(Boolean).map(w => w.id);
    const lim = isoD(new Date(Date.now() + 7 * 86400000));
    expiryLots(org, ops).forEach(l => { if ((!myWh || myWh.includes(l.whId)) && l.expiry <= lim) push('inv:exp:' + l.id + ':' + (l.expiry <= td ? 'x' : 's'), 'inv', (l.expiry <= td ? 'دفعة منتهية الصلاحية — ' : 'دفعة تنتهي خلال 7 أيام — ') + whName(org, l.whId), itemN(l.itemId) + ' · ' + q3(l.left) + (l.batch ? ' · دفعة ' + l.batch : '') + ' · ' + l.expiry, central ? 'inv' : 'whbranch', 'wh'); });
  }
  // —— المالية والموردون ——
  if (central && (roleHasTab(me, 'suppliers') || roleHasTab(me, 'purchasing') || roleHasTab(me, 'acct'))) {
    const due = (ops.invoices || []).filter(i => (i.amount || 0) > 0 && (i.amount - (i.paidAmount || 0)) > 0.004 && i.dueDate && i.dueDate <= td);
    if (due.length) push('fin:due:' + td, 'fin', due.length + ' فاتورة مورد مستحقة اليوم أو متأخرة', 'المتبقي ' + money(due.reduce((s, i) => s + (i.amount - (i.paidAmount || 0)), 0)) + ' ر.س', roleHasTab(me, 'suppliers') ? 'suppliers' : roleHasTab(me, 'purchasing') ? 'purchasing' : 'acct');
  }
  if (central && (roleHasTab(me, 'treasury') || roleHasTab(me, 'acct'))) (ops.transfers || []).forEach(t => { if (t.status === 'pending') push('fin:tr:' + t.id, 'fin', 'توريد نقدي بانتظار الاستلام — ' + (t.branchName || ''), money(t.amount || 0) + ' ر.س · ' + (t.date || ''), roleHasTab(me, 'treasury') ? 'treasury' : 'acct'); });
  // —— الموارد البشرية ——
  if (roleHasTab(me, 'hrops') && (central || R.approver || me.role === 'branch_manager' || me.role === 'regional_manager')) {
    [['leaveRequests', 'طلب إجازة'], ['shiftSwapRequests', 'طلب تبديل وردية'], ['branchTransferRequests', 'طلب نقل موظف بين الفروع'], ['rewardRequests', 'طلب مكافأة/جزاء']].forEach(([col, ar]) =>
      (ops[col] || []).forEach(r => { if (r.status === 'pending' && inScope(r.branchId)) push('hr:' + col + ':' + r.id, 'hr', ar + ' بانتظار القرار', (r.employeeName || r.empFromName || '') + (r.branchName ? ' · ' + r.branchName : ''), 'hrops'); }));
  }
  if (central && (roleHasTab(me, 'hrmaster') || roleHasTab(me, 'people'))) {
    let exp = 0, soon = 0;
    (org.employees || []).forEach(e => (e.docs || []).forEach(dc => { if (!dc.expiryDate) return; const dl = Math.round((Date.parse(dc.expiryDate + 'T00:00:00') - Date.parse(td + 'T00:00:00')) / 86400000); if (dl < 0) exp++; else if (dl <= 30) soon++; }));
    if (exp || soon) push('hr:docs:' + td, 'hr', 'مستندات موظفين تحتاج تجديدًا', (exp ? exp + ' منتهية' : '') + (exp && soon ? ' · ' : '') + (soon ? soon + ' تنتهي خلال 30 يومًا' : ''), roleHasTab(me, 'hrmaster') ? 'hrmaster' : 'people');
  }
  return ev;
}

// نغمة تنبيه قصيرة دون أي ملفات خارجية
let _actx = null;
function alertBeep() {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume().catch(() => { });
    const t0 = _actx.currentTime;
    [[880, 0, 0.12], [1318, 0.16, 0.2]].forEach(([f, dt, dur]) => {
      const o = _actx.createOscillator(), g = _actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.connect(g); g.connect(_actx.destination);
      o.start(t0 + dt); o.stop(t0 + dt + dur + 0.03);
    });
  } catch { }
}

const money = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// تنسيق مالي حيّ أثناء الكتابة: فواصل آلاف مع حفظ الكسور (حتى منزلتين)
const fmtCurStr = (s) => {
  let v = String(s).replace(/[^\d.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  const p = v.split('.');
  let i = (p[0] || '').replace(/^0+(?=\d)/, '') || '0';
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return p.length > 1 ? i + '.' + p[1].slice(0, 2) : i;
};
// تفكيك نص قد يحوي عدة مبالغ (مفصولة بـ + أو أسطر) إلى أرقام ومجموعها
const parseAmounts = (s) => {
  const parts = String(s).split(/[+\n]/).map(t => t.replace(/[^\d.]/g, '')).filter(t => t !== '' && t !== '.');
  const nums = parts.map(Number).filter(n => !isNaN(n));
  const total = Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
  return { nums, total };
};
/* ===== v38.0 — رقابة إدخال الأرقام (على كل حقول الأرقام في المنصّة) =====
   1) لوحة المفاتيح العربية تكتب 0123…9 (وبعض الأجهزة 0123 الفارسية) والفاصلة العشرية «.» — كانت الحقول تحذفها بصمت
      فيُحفظ رقم ناقص. الآن تُحوَّل لحظة الكتابة/اللصق إلى 0-9 و«.»، وفاصل الآلاف «,/,» يُزال.
   2) نقطة عشرية واحدة فقط في الحقل، ولا نقاط في الحقول الصحيحة (numeric).
   3) التفقيط الحي: تحت حقل المبلغ المركّز يظهر الرقم منسّقًا ومكتوبًا بالحروف — يكشف الصفر الزائد/الناقص فورًا. */
const tafqeet = (n0) => {
  let n = Math.floor(Math.abs(Number(n0) || 0)); if (!n) return 'صفر';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hund = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const g = (x) => { const h = Math.floor(x / 100), r = x % 100, w = [];
    if (h) w.push(hund[h]);
    if (r) w.push(r < 20 ? ones[r] : (r % 10 ? ones[r % 10] + ' و' + tens[Math.floor(r / 10)] : tens[r / 10]));
    return w.join(' و'); };
  const scales = [[1e9, 'مليار', 'ملياران', 'مليارات', 'مليارًا'], [1e6, 'مليون', 'مليونان', 'ملايين', 'مليونًا'], [1e3, 'ألف', 'ألفان', 'آلاف', 'ألفًا']];
  const parts = [];
  scales.forEach(([v, one, two, few, acc]) => { const k = Math.floor(n / v); n %= v; if (!k) return;
    const r = k % 100;
    parts.push(k === 1 ? one : k === 2 ? two : k <= 10 ? g(k) + ' ' + few : g(k) + ' ' + (r >= 11 && r <= 99 ? acc : one)); });
  if (n) parts.push(g(n));
  return parts.join(' و');
};
const NUM_SEL = 'input.n, textarea.n, input[inputmode="decimal"], input[inputmode="numeric"]';
const normNumText = (s, el) => {
  const multi = el.tagName === 'TEXTAREA' || /[+\n]/.test(s);
  let t = String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٫]/g, '.').replace(/[٬،]/g, ',');
  if (el.getAttribute('inputmode') === 'numeric') return t.replace(/[.,]/g, '');
  if (!multi) { const i = t.indexOf('.'); if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, ''); }
  return t;
};
let numGuardOn = false;
function installNumGuard() {
  if (numGuardOn || typeof document === 'undefined') return; numGuardOn = true;
  const setNative = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); };
  // تُنفَّذ قبل React (التقاط على window) فيستلم onChange القيمة المصحّحة — بالمُعيِّن الأصلي كي يبقى React يرى التغيير
  window.addEventListener('input', (e) => {
    const el = e.target; if (!el || !el.matches || !el.matches(NUM_SEL) || el.type === 'password') return;
    const v = el.value, nv = normNumText(v, el); if (nv === v) return;
    let pos = null; try { pos = el.selectionStart; } catch { }
    setNative(el, nv);
    if (pos != null) { const p = Math.max(0, pos - (v.length - nv.length)); try { el.setSelectionRange(p, p); } catch { } }
  }, true);
  // التفقيط الحي تحت حقل المبلغ المركّز
  let tip = null, cur = null;
  const hide = () => { if (tip) tip.style.display = 'none'; cur = null; };
  const show = () => {
    const el = cur; if (!el || !document.contains(el)) return hide();
    const raw = String(el.value || ''); const multi = /[+\n]/.test(raw.trim().replace(/[+\s]+$/, ''));
    const num = multi ? parseAmounts(raw).total : Number(raw.replace(/[^\d.]/g, ''));
    if (!raw.trim() || !Number.isFinite(num) || num < 1 || el.getAttribute('inputmode') !== 'decimal') { if (tip) tip.style.display = 'none'; return; }
    const host = el.closest('.rms') || document.body;
    if (!tip || tip.parentNode !== host) { if (tip) tip.remove(); tip = document.createElement('div'); tip.className = 'num-tip'; tip.setAttribute('aria-live', 'polite'); host.appendChild(tip); }
    const fr = Math.round((num - Math.floor(num)) * 100);
    tip.innerHTML = '<b dir="ltr">' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + '</b><span>' + tafqeet(num) + (fr ? ' و' + fr + ' من 100' : '') + '</span>';
    const r = el.getBoundingClientRect(); tip.style.display = 'flex';
    const w = tip.offsetWidth, vw = document.documentElement.clientWidth;
    let left = r.right - w; if (left < 8) left = 8; if (left + w > vw - 8) left = Math.max(8, vw - 8 - w);
    let top = r.bottom + 6; if (top + tip.offsetHeight > window.innerHeight - 6) top = r.top - tip.offsetHeight - 6;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  };
  document.addEventListener('focusin', (e) => { const el = e.target; if (el && el.matches && el.matches(NUM_SEL)) { cur = el; requestAnimationFrame(show); } else hide(); });
  document.addEventListener('focusout', (e) => { if (e.target === cur) setTimeout(() => { if (document.activeElement !== cur) hide(); }, 0); });
  document.addEventListener('input', (e) => { if (e.target === cur) requestAnimationFrame(show); });
  window.addEventListener('scroll', () => { if (cur) show(); }, true);
  window.addEventListener('resize', () => { if (cur) show(); });
}
installNumGuard();
const short = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
};
// v38.1 — صيغة موحّدة للتاريخ والوقت في كل المنصّة: «09 نوف 2026 · 02:05 م» — ميلادي وأرقام 0-9 دائمًا
const NUM_LOCALE = 'ar-SA-u-ca-gregory-nu-latn';
const arClock = (x) => { try { const d = x instanceof Date ? x : new Date(x); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(NUM_LOCALE, { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const arDT = (x) => { if (!x) return '—'; try { const d = x instanceof Date ? x : new Date(x); if (isNaN(d.getTime())) return String(x); return arDate(isoD(d)) + ' · ' + arClock(d); } catch { return String(x); } };
const arDate = (d) => {
  // v36.4: تاريخ فارغ أو غير صالح يظهر «—» بدل «Invalid Date»، والتقويم ميلادي صراحةً
  if (!d) return '—';
  try {
    const x = new Date(String(d).slice(0, 10) + 'T00:00:00');
    if (isNaN(x.getTime())) return String(d);
    return x.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};
const monthLabel = (ym) => { try { return new Date(ym + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); } catch { return ym; } };
const arTime = (iso) => {
  try {
    const t = new Date(iso), diff = (Date.now() - t.getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
    return t.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};
const sum = (a, f) => a.reduce((s, x) => s + (Number(f ? f(x) : x) || 0), 0);

/* ============ الخطوة 4: تصدير Excel احترافي منسّق ============ */
function exportExcel(filename, sheetTitle, headers, rows, opts = {}) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const meta = opts.meta || []; // أسطر علوية (شركة، تاريخ...)
  const totals = opts.totals || null; // صف إجماليات اختياري
  const thead = '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const tbody = rows.map(r => '<tr>' + r.map((c, i) => {
    const numeric = typeof c === 'number';
    return `<td class="${numeric ? 'n' : 't'}">${esc(numeric ? c : c)}</td>`;
  }).join('') + '</tr>').join('');
  const tfoot = totals ? '<tr class="tot">' + totals.map((c, i) =>
    `<td class="${typeof c === 'number' ? 'n' : 't'}">${esc(c)}</td>`).join('') + '</tr>' : '';
  const metaRows = meta.map(m => `<tr><td colspan="${headers.length}" class="meta">${esc(m)}</td></tr>`).join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>
      table{border-collapse:collapse;font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl}
      caption{font-size:15px;font-weight:bold;padding:10px;text-align:right}
      th{background:#C8A24A;color:#1a1410;font-weight:bold;border:1px solid #8C6F2C;padding:7px 10px;text-align:center}
      td{border:1px solid #ccc;padding:6px 10px}
      td.n{mso-number-format:"#,##0.00";text-align:left}
      td.t{text-align:right}
      .meta{background:#F6F2E9;font-weight:bold;border:none;text-align:right}
      .tot td{background:#241F1B;color:#fff;font-weight:bold;border:1px solid #000}
    </style></head><body>
    <table><caption>${esc(sheetTitle)}</caption>
    ${metaRows}${thead}${tbody}${tfoot}</table></body></html>`;
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.xls') ? filename : filename + '.xls'; a.click();
  URL.revokeObjectURL(url);
}
/* ألوان الرسوم البيانية تتبع الثيم النشط ووضعه (نهار/ليل) بقراءة متغيّرات CSS الحيّة.
   grid/tick/tip من الأسطح؛ accent=هوية الثيم؛ pos/neg/warn دلالية (إيراد/مصروف/تكلفة). */
const _cget = (cs, n, fb) => { try { const v = (cs.getPropertyValue(n) || '').trim(); return v || fb; } catch { return fb; } };
const chartTone = () => {
  try {
    if (typeof document !== 'undefined') {
      const el = document.querySelector('.rms');
      if (el) {
        const cs = getComputedStyle(el);
        const acc = _cget(cs, '--acc', '#C8A24A');
        return {
          grid: _cget(cs, '--line', '#332C26'), tick: _cget(cs, '--faint', '#6E635A'),
          axis: _cget(cs, '--dim', '#8A7F72'), tip: _cget(cs, '--ink2', '#1C1815'),
          tipTxt: _cget(cs, '--txt', '#EFE7DB'), bar: _cget(cs, '--dim', '#3A322B'),
          accent: acc, pos: _cget(cs, '--mint', '#4FB286'), neg: _cget(cs, '--rose', '#D9544D'),
          warn: _cget(cs, '--amber', '#E0A458'), info: _cget(cs, '--sky', '#5B93C4'), muted: _cget(cs, '--dim', '#7E7566'),
          series: [acc, _cget(cs, '--sky', '#5B93C4'), _cget(cs, '--mint', '#4FB286'), _cget(cs, '--amber', '#E0A458'), _cget(cs, '--violet', '#9B7BB8'), _cget(cs, '--rose', '#D9544D')]
        };
      }
    }
  } catch (e) { }
  return { grid: '#332C26', tick: '#6E635A', axis: '#8A7F72', tip: '#1C1815', tipTxt: '#EFE7DB', bar: '#3A322B', accent: '#C8A24A', pos: '#4FB286', neg: '#D9544D', warn: '#E0A458', info: '#5B93C4', muted: '#7E7566', series: ['#C8A24A', '#5B93C4', '#4FB286', '#E0A458', '#9B7BB8', '#D9544D'] };
};
const clr = (i) => ['#C8A24A', '#4FB286', '#5B93C4', '#D9544D', '#E0A458', '#9B7BB8'][i % 6];

/* ================= دفتر الشركاء: تجميع حركات كل شريك من مصادرها ================= */
// الرصيد الجاري = مجموع الدائن − مجموع المدين. موجب = دائن (علينا)، سالب = مدين (لنا).
// الإغلاق المُحتسب ماليًا = المرحّل أو المعتمد فقط (المسودات والمرفوضة لا تدخل الدفاتر ولا المؤشرات ولا التقارير)
const countedClosing = (c) => !!c && (c.status === 'submitted' || c.status === 'approved');

/* v8.4 — إقفال الفترات: قفل تراكمي حتى شهر (org.periodLocks.lockedThrough)
   كل ما يغيّر قيود شهر مقفل يُمنع — والفتح استثنائي موثق بسبب من شاشة الإقفال */
const lockedThru = (org) => ((org || {}).periodLocks || {}).lockedThrough || '';
const periodLocked = (org, dateStr) => {
  const lt = lockedThru(org);
  return !!lt && !!(dateStr || '') && (dateStr || '').slice(0, 7) <= lt;
};
/* v29.5 — حارس مركزي للإقفال: بصمة قيود الأشهر المقفلة قبل الحفظ وبعده. أي اختلاف (من أي شاشة أو إعداد:
   تعديل إغلاق، ربط بنك فرع، تغيير تصنيف، قيد يدوي…) يُرفض — كما في أي نظام محاسبي. الحد = الأدنى بين القفل قبل وبعد،
   فإجراء الفتح الموثّق نفسه (الذي يخفّض القفل) لا يُمنع. */
function lockedLedgerSig(org, ops, lt) {
  try {
    return buildAccounting(org || {}, ops || {}).entries
      .filter(e => e.date && String(e.date).slice(0, 7) <= lt)
      .map(e => e.id + '|' + e.date + '|' + e.lines.map(l => l.code + ':' + (Math.round((l.debit || 0) * 100)) + ':' + (Math.round((l.credit || 0) * 100))).join(','))
      .sort().join('\n');
  } catch (e) { console.warn('lockedLedgerSig', e); return null; }
}
function lockedLedgerChanged(orgA, opsA, orgB, opsB) {
  const a = lockedThru(orgA), b = lockedThru(orgB);
  if (!a || !b) return false;
  const lt = a < b ? a : b;
  const x = lockedLedgerSig(orgA, opsA, lt), y = lockedLedgerSig(orgB, opsB, lt);
  return x !== null && y !== null && x !== y;
}
// v34.16: نفاد حصة Firestore اليومية (الخطة المجانية): تتجدد منتصف الليل بتوقيت المحيط الهادئ (11:00 صباحًا بتوقيت السعودية شتاءً)
const QUOTA_MSG = () => { const u = cloud.quotaUntil(); return 'لم يُحفظ: نفدت حصة الكتابة في قاعدة البيانات (Firestore) لهذا اليوم — البيانات محفوظة على الجهاز. تتجدد الحصة الساعة 11:00 صباحًا بتوقيت السعودية (أو بترقية مشروع Firebase إلى خطة Blaze)' + (u ? '؛ إعادة المحاولة تلقائيًا بعد ' + new Date(u).toTimeString().slice(0, 5) : ''); };
const LOCK_MSG = (d) => 'شهر ' + (d || '').slice(0, 7) + ' مقفل محاسبيًا 🔒 — الفتح الاستثنائي من المحاسبة ← الإقفال';

/* ============================================================
   v9.0 — عزل بيانات الفروع (أمان المرحلة الثانية)
   البيانات تُخزَّن سحابيًا مقسّمة: دليل عام منزوع الأسرار (dir)،
   بيانات مركزية (core)، ومستند لكل فرع (br_*) — والعزل يفرضه
   الخادم عبر قواعد Firestore. أما داخل التطبيق فالنموذج يبقى
   كما هو (org + ops مدمجة) — الترجمة تتم عند حواف التخزين فقط.
   ============================================================ */
const BR_COLS = ['closings', 'transfers', 'partnerRequests', 'notifications', 'branchPartners',
  // v24.0 — بيانات HR التشغيلية لكل فرع (م3–م7): تُخزَّن في مستند الفرع كي تقرأها وتكتبها أجهزة الفروع (لا تصل لـ org)
  'attendanceEvents', 'hrPins', 'shiftTemplates', 'shiftAssignments', 'shiftSwapRequests', 'branchTransferRequests', 'taskTemplates', 'taskAssignments', 'taskCompletions', 'pointsEntries', 'qualityReviews', 'rewardRequests',
  // v27.0 — م10: مستندات التوقيع الإلكتروني (إقرارات استلام الراتب وإشعارات المكافآت/الجزاءات) — يوقّعها الموظف من جهاز الفرع
  'hrSignDocs',
  // v27.6 — م20: الإجراءات التأديبية التصحيحية وخطط تحسين الأداء (PIP) — بفرعها كي يقرأها/يكتبها جهاز الفرع
  'hrCorrective', 'hrPips',
  // v27.7 — م19: سجلات التدريب والشهادات (البرامج المركزية في org.trainingPrograms)
  'hrTraining',
  // v27.9 — م11: قياسات KPI الشهرية لكل موظف (تعريفات المؤشرات في org.roleKpis)
  'hrKpiEntries',
  // v29.9 — المستودعات: حركات مستودع الفرع وتحويلاته (يكتبها جهاز الفرع)
  'whMoves', 'whTransfers',
  // v37.4 — طلبات هدر فوق حد الاعتماد (معلّقة لا تمسّ الرصيد حتى تُعتمد)
  'wasteRequests',
  // v37.5 — جلسات الجرد الأعمى (عدّ ← إعادة عدّ ← اعتماد شخص آخر)
  'countSessions',
  // v31.1 — مبيعات المنتجات (الكميات) لكل فرع وفترة — أساس الاستهلاك النظري
  'productSales',
  // v31.2 — طلبات الإجازات (يرفعها الفرع ويعتمدها المركز)
  'leaveRequests',
  // v31.4 — سجل جلسات الجرد (حتى المطابقة بلا فروقات) — أساس الجرد الدوري المجدول
  'stockCounts',
  // v33.0 — نقطة البيع: الفواتير المبسّطة والورديات (يكتبها جهاز الفرع)
  'posOrders', 'posShifts',
  // v33.1 — مبيعات نقاط البيع المستوردة من Excel (ملخص يومي لكل فرع)
  'posImports'];
const CORE_COLS = ['ledgerSnaps', 'salesInvoices', 'advances', 'invoices', 'fixedExpenses', 'disbursements', 'ledgerEntries', 'journalManual', 'purchaseOrders', 'stockMoves', 'bankRecs', 'closingInvPays', 'appSettlements', 'schedules', 'hrScoreSnapshots'];

// تقسيم ops المدمجة إلى مستند مركزي + مستند لكل فرع
function splitOps(ops, branchIds) {
  const core = {};
  CORE_COLS.forEach(c => { core[c] = ops[c] || []; });
  BR_COLS.forEach(c => { core[c] = (ops[c] || []).filter(x => !x.branchId || !branchIds.includes(x.branchId)); });
  const br = {};
  branchIds.forEach(b => {
    br[b] = {};
    BR_COLS.forEach(c => { br[b][c] = (ops[c] || []).filter(x => x.branchId === b); });
  });
  return { core, br };
}

// v27.2 — مقارنة محتوى مستندين بمعزل عن بيانات الكتابة (rev/wtag): لا نكتب إلا ما تغيّر فعلًا
const sameDoc = (a, b) => JSON.stringify({ ...(a || {}), rev: 0, wtag: '' }) === JSON.stringify({ ...(b || {}), rev: 0, wtag: '' });
// v27.2 — التحقق من أن ما قرأناه بعد الكتابة هو ما كتبناه نحن: بوسم الكاتب (wtag) لا برقم rev وحده.
// كاتبان انطلقا من نفس الأساس (المركز وجهاز فرع في اللحظة نفسها) ينتجان نفس رقم rev، فكان الأخير
// يطغى بصمت على الأول دون أن يُكتشف التصادم. المستندات القديمة بلا wtag تُقارَن بالرقم.
const wroteMine = (chk, doc) => !!chk && (doc.wtag ? chk.wtag === doc.wtag : (chk.rev || 0) === (doc.rev || 0));

// تجميع المستندات المقسّمة إلى ops واحدة كما اعتاد التطبيق
function composeOps(core, brMap) {
  const out = emptyOps();
  CORE_COLS.forEach(c => { out[c] = (core && core[c]) || []; });
  BR_COLS.forEach(c => {
    out[c] = [...((core && core[c]) || [])];
    Object.keys(brMap || {}).forEach(b => { out[c] = out[c].concat((brMap[b] && brMap[b][c]) || []); });
  });
  return out;
}

// الدليل العام: كل ما يحتاجه الفرع للعمل — بلا كلمات مشفرة ولا رواتب ولا إعدادات حساسة
function dirOf(org) {
  return {
    dirOnly: true,
    company: { name: (org.company || {}).name || '', logoUrl: (org.company || {}).logoUrl || '', activity: (org.company || {}).activity || '', taxNumber: (org.company || {}).taxNumber || '' },
    // v34.0: ما تحتاجه نقطة البيع على أجهزة الفروع — الأصناف بأسعار البيع فقط (بلا تكلفة ولا وصفات)، الإعدادات، العروض، الولاء، الضريبة
    products: (org.products || []).map(p => ({ id: p.id, name: p.name, sellPrice: p.sellPrice || 0, cat: p.cat || '', ...(p.posOff ? { posOff: true } : {}), ...(p.disc ? { disc: p.disc } : {}) })),
    posCfg: org.posCfg || {}, posPromos: org.posPromos || [], loyaltyCfg: org.loyaltyCfg || {},
    taxCfg: { enabled: !!(org.taxCfg || {}).enabled, rate: (org.taxCfg || {}).rate || 15 },
    branches: (org.branches || []).map(b => ({ id: b.id, name: b.name, defaultFloat: b.defaultFloat || 0, isActive: b.isActive !== false, logoUrl: b.logoUrl || '', city: b.city || '', bankName: b.bankName || '', bankAcc: b.bankAcc || '', geofence: b.geofence || null })),   // v24.0: الجيوفنس لازم لكشك الحضور على جهاز الفرع
    expenseCats: org.expenseCats || [],
    deliveryApps: org.deliveryApps || [],
    // v29.9: أصناف المخزون (بلا تكلفة) والمستودعات — لشاشة «مستودع الفرع»
    items: (org.items || []).map(it => ({ id: it.id, name: it.name, unit: it.unit || '', minQty: it.minQty || 0, isActive: it.isActive !== false, type: it.type || 'stock', purchaseUnit: it.purchaseUnit || '', purchaseFactor: it.purchaseFactor || 1 })),
    warehouses: (org.warehouses || []).map(w => ({ id: w.id, name: w.name, kind: w.kind, branchId: w.branchId || '', parentId: w.parentId || '', active: w.active !== false })),
    suppliers: (org.suppliers || []).map(x => ({ id: x.id, name: x.name, category: x.category || '', code: x.code || '', terms: x.terms || 0 })),
    employees: (org.employees || []).map(e => ({ id: e.id, name: e.name, branchId: e.branchId || '', jobTitle: e.jobTitle || '', code: e.code || '', isActive: e.isActive !== false })),
    users: (org.users || []).map(u => ({ id: u.id, name: u.name, email: u.email || '', role: u.role, branchId: u.branchId || '', allowedBranchIds: u.allowedBranchIds || [], appAllow: u.appAllow || [], appDeny: u.appDeny || [], isActive: u.isActive !== false })),
    partners: (org.partners || []).map(p => ({ id: p.id, key: p.key, name: p.name, type: p.type, cat: p.cat || '', code: p.code || '' })),
    customAccounts: org.customAccounts || [],   // v15.21: لازمة لتطابق أكواد بنوك الفروع المربوطة بالدليل على أجهزة الفروع
    periodLocks: org.periodLocks || {},
    appsCfg: org.appsCfg || {},
    // v24.0: إعدادات HR غير الحساسة التي تحتاجها شاشات الفروع (سماحية التأخير، أوزان الدرجة، قواعد النقاط، أهداف KPI)
    hrPolicies: org.hrPolicies || {}, pointsRules: org.pointsRules || {}, kpiTargets: org.kpiTargets || {}, rewardTiers: org.rewardTiers || {}, trainingPrograms: org.trainingPrograms || [], roleKpis: org.roleKpis || [],
    setupComplete: true, migratedV9: org.migratedV9 || ''
  };
}

// الهجرة: تُنفَّذ مرة واحدة على جهاز الإدارة — تقسيم القديم وكتابة الدليل، مع إبقاء القديم نسخة مجمّدة
async function migrateV9(org, ops) {
  const branchIds = (org.branches || []).map(b => b.id);
  const { core, br } = splitOps(ops, branchIds);
  await cloud.set(KEYS.core, { ...core, rev: 1, migratedAt: nowISO() });
  for (const b of branchIds) await cloud.set(brKey(b), { ...br[b], rev: 1 });
  // أرشيف الصور: توزيعه بالفرع
  const files = (await cloud.get(KEYS.files, { items: [] })) || { items: [] };
  const byBr = {};
  (files.items || []).forEach(it => { const b = it.branchId || ''; (byBr[b] = byBr[b] || []).push(it); });
  for (const b of Object.keys(byBr)) { if (b && branchIds.includes(b)) await cloud.set(bfKey(b), { items: byBr[b] }); }
  await cloud.set(KEYS.dir, dirOf(org));
  const org2 = { ...org, migratedV9: nowISO() };
  await cloud.set(KEYS.org, org2);
  return org2;
}

// v24.0 — هجرة لمرة واحدة (على جهاز المركز): بيانات HR التشغيلية (م3–م7) التي حُفظت في org
// تنتقل إلى مستندات الفروع (rms8_br_*) كي تقرأها وتكتبها أجهزة الفروع؛ org لا يقرؤه إلا المركز.
const HR_MIGRATE_COLS = ['attendanceEvents', 'shiftTemplates', 'shiftAssignments', 'shiftSwapRequests', 'branchTransferRequests', 'taskTemplates', 'taskAssignments', 'taskCompletions', 'pointsEntries', 'qualityReviews'];
async function migrateHrToOps(o) {
  const branchIds = (o.branches || []).map(b => b.id);
  const byBr = {}; const coreAdd = {};
  const put = (c, rec) => {
    const b = rec.branchId && branchIds.includes(rec.branchId) ? rec.branchId : null;
    if (b) { byBr[b] = byBr[b] || {}; (byBr[b][c] = byBr[b][c] || []).push(rec); }
    else { (coreAdd[c] = coreAdd[c] || []).push(rec); }
  };
  HR_MIGRATE_COLS.forEach(c => (o[c] || []).forEach(rec => put(c, (c === 'branchTransferRequests' && !rec.branchId) ? { ...rec, branchId: rec.fromBranchId } : rec)));
  (o.employees || []).forEach(e => { if (e.attendancePinHash) put('hrPins', { id: uid('pin'), branchId: e.branchId, employeeId: e.id, pinHash: e.attendancePinHash, updatedAt: nowISO() }); });
  const merge = (doc, add) => {
    const next = { ...doc, rev: (doc.rev || 0) + 1 };
    Object.keys(add).forEach(c => { const ids = new Set((doc[c] || []).map(x => x.id)); next[c] = [...(doc[c] || []), ...add[c].filter(x => !ids.has(x.id))]; });
    return next;
  };
  for (const b of Object.keys(byBr)) {
    const doc = (await cloud.get(brKey(b), null)) || {};
    if (!(await cloud.set(brKey(b), merge(doc, byBr[b])))) throw new Error('hr-migrate-br:' + b);
  }
  if (Object.keys(coreAdd).length) {
    const core = (await cloud.get(KEYS.core, null)) || {};
    if (!(await cloud.set(KEYS.core, merge(core, coreAdd)))) throw new Error('hr-migrate-core');
  }
  const o2 = { ...o, hrMigratedV24: nowISO(), employees: (o.employees || []).map(e => { const { attendancePinHash, ...rest } = e; return rest; }) };
  HR_MIGRATE_COLS.forEach(c => { delete o2[c]; });
  return o2;
}

// سداد المورد قد يُوزَّع على أكثر من طريقة دفع (نقد + شبكة + تحويل + غير ذلك) لنفس الدفعة/الفاتورة
const paySplits = (pm) => {
  if (pm.cash != null || pm.card != null || pm.transfer != null || pm.other != null)
    return { cash: pm.cash || 0, card: pm.card || 0, transfer: pm.transfer || 0, other: pm.other || 0 };
  const a = pm.amount || 0; // توافق مع الصيغة القديمة {method, amount}
  return { cash: pm.method === 'cash' ? a : 0, card: pm.method === 'card' ? a : 0, transfer: pm.method === 'bank_transfer' ? a : 0, other: pm.method === 'other' ? a : 0 };
};
const payTotal = (pm) => { const s = paySplits(pm); return s.cash + s.card + s.transfer + s.other; };
const payCashPart = (pm) => paySplits(pm).cash;
const payLabel = (pm) => {
  const s = paySplits(pm), out = [];
  if (s.cash) out.push('نقد ' + money(s.cash));
  if (s.card) out.push('شبكة ' + money(s.card));
  if (s.transfer) out.push('تحويل ' + money(s.transfer));
  if (s.other) out.push('غير ذلك ' + money(s.other));
  return out.join(' + ');
};
// v15.20 — بنوك الفروع المعرّفة، للاستخدام في الواجهات (محدِّدات مصدر الصرف والتسوية البنكية).
// الأكواد بنفس منطق buildAccounting حرفياً: '12'+(11+فهرس الفرع) — أي تعديل هناك يستلزم تعديلاً هنا.
const branchBanks = (org) => {
  const out = []; const seen = new Set();
  const validAcc = (code) => !!code && (String(code) === '1201' || ((org && org.customAccounts) || []).some(ca => String(ca.code) === String(code)));
  (org?.branches || []).forEach((b, i) => {
    if (!(b && ((b.bankName && String(b.bankName).trim()) || (b.bankIban && String(b.bankIban).trim()) || (b.bankAcc && String(b.bankAcc).trim())))) return;
    // v15.21: الربط الصريح بحساب من الدليل يتقدّم على الكود التلقائي؛ 1201 لا يُكرَّر (مُدرج كخيار ثابت في القوائم)
    const code = validAcc(b.bankAcc) ? String(b.bankAcc) : '12' + String(11 + i);
    if (code === '1201' || seen.has(code)) return;
    seen.add(code);
    const ca = ((org && org.customAccounts) || []).find(x => String(x.code) === code);
    out.push({ code, branchId: b.id, name: ca ? (ca.name || code) : ('بنك ' + (b.name || 'فرع') + (b.bankName ? ' — ' + b.bankName : '')) });
  });
  return out;
};

/* ═══ v16.7 — وسيط الشبكة تحت التسوية + قارئ كشف البنك والمطابقة ═══ */
// كود وسيط الشبكة مشتق من كود البنك نفسه (عائلة 18 — ثابت لا يتأثر بترتيب الفروع)
const posClrOf = (bank) => String(bank) === '1201' ? '1801'
  : (/^12\d\d$/.test(String(bank)) ? '18' + String(bank).slice(2) : '18' + String(bank));
// بنك الفرع بنفس منطق buildAccounting حرفياً (كما branchBanks أعلاه)
const bankOfBranch = (org, branchId) => {
  const bs = (org && org.branches) || [];
  const i = bs.findIndex(b => b.id === branchId);
  if (i < 0) return '1201';
  const b = bs[i];
  const has = !!(b && ((b.bankName && String(b.bankName).trim()) || (b.bankIban && String(b.bankIban).trim()) || (b.bankAcc && String(b.bankAcc).trim())));
  if (!has) return '1201';
  const validAcc = (code) => !!code && (String(code) === '1201' || ((org && org.customAccounts) || []).some(ca => String(ca.code) === String(code)));
  return validAcc(b.bankAcc) ? String(b.bankAcc) : '12' + String(11 + i);
};
const stAddDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// أرقام الكشوف: فواصل آلاف، أرقام عربية-هندية، أقواس سالبة، رموز عملة
const stNum = (v) => {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const AR = '٠١٢٣٤٥٦٧٨٩';
  s = s.replace(/[٠-٩]/g, ch => String(AR.indexOf(ch))).replace(/[٬,\s]/g, '').replace(/ر\.?س|SAR|SR/gi, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
};
/* v32.2 — قراءة كشف الحساب بالصيغة البنكية القياسية MT940 (تُنزَّل من قنوات البنوك للشركات):
   :60F: الرصيد الافتتاحي · :61: حركة (تاريخ القيمة، مدين/دائن، المبلغ بفاصلة عشرية، النوع، المرجع) · :86: البيان · :62F: الرصيد الختامي */
function parseMt940(text) {
  const t = String(text || '').replace(/\r/g, '');
  if (!/:61:/.test(t) || !/:6[02][FM]:/.test(t)) return null;
  const tags = []; let cur = null;
  t.split('\n').forEach(line => { const m = line.match(/^:(\d{2}[A-Z]?):(.*)$/); if (m) { cur = { tag: m[1], v: m[2] }; tags.push(cur); } else if (cur && line.trim() && !/^-}?$/.test(line.trim())) cur.v += '\n' + line; });
  const ymd = (yy, mm, dd) => (Number(yy) < 80 ? '20' : '19') + yy + '-' + mm + '-' + dd;
  const bal = (v) => { const m = String(v).match(/^([CD])(\d{2})(\d{2})(\d{2})([A-Z]{3})([\d,\.]+)/); return m ? { date: ymd(m[2], m[3], m[4]), cur: m[5], amount: (m[1] === 'D' ? -1 : 1) * Number(m[6].replace(',', '.')) } : null; };
  const out = { account: '', open: null, close: null, lines: [] };
  tags.forEach((x, i) => {
    if (x.tag === '25') out.account = x.v.trim();
    if (x.tag === '60F' || x.tag === '60M') out.open = out.open || bal(x.v);
    if (x.tag === '62F' || x.tag === '62M') out.close = bal(x.v);
    if (x.tag === '61') {
      const m = x.v.match(/^(\d{2})(\d{2})(\d{2})(\d{4})?(R?[CD])([A-Z])?([\d,\.]+)(\w{4})?([^\n]*)/);
      if (!m) return;
      const sign = m[5].includes('D') !== m[5].startsWith('R') ? -1 : 1;
      const nx = tags[i + 1] && tags[i + 1].tag === '86' ? tags[i + 1].v.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
      out.lines.push({ date: ymd(m[1], m[2], m[3]), amount: Math.round(sign * Number(m[7].replace(',', '.')) * 100) / 100, ref: (m[9] || '').replace(/^\/\//, '').trim(), desc: nx || (m[8] || '') });
    }
  });
  return out.lines.length ? out : null;
}
// تواريخ الكشوف: ISO · يوم/شهر/سنة (السائد بكشوف البنوك السعودية) · رقم إكسل التسلسلي
const stDate = (v) => {
  if (v == null) return '';
  const s = String(v).trim().replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  const n = parseFloat(s);
  if (isFinite(n) && n > 25569 && n < 80000) {   // تاريخ إكسل تسلسلي
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  return '';
};
// CSV: يدعم الفاصلة والفاصلة المنقوطة وTab والاقتباس وBOM
const parseCsvGrid = (text) => {
  const t = String(text).replace(/^﻿/, '');
  const firstLine = t.slice(0, t.indexOf('\n') > -1 ? t.indexOf('\n') : t.length);
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';'
    : ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',');
  const grid = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => String(c).trim() !== '')) grid.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => String(c).trim() !== '')) grid.push(row);
  return grid;
};
// XLSX: قارئ مصغّر — سجل الدليل المركزي للـzip + فك deflate عبر DecompressionStream + XML للورقة الأولى
const parseXlsxGrid = async (buf) => {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip');
  const cnt = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = {};
  for (let e = 0; e < cnt; e++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.slice(off + 46, off + 46 + nlen));
    entries[name] = { method, csize, lho };
    off += 46 + nlen + elen + clen;
  }
  const readEntry = async (name) => {
    const en = entries[name];
    if (!en) return null;
    const lnlen = dv.getUint16(en.lho + 26, true), lelen = dv.getUint16(en.lho + 28, true);
    const data = u8.slice(en.lho + 30 + lnlen + lelen, en.lho + 30 + lnlen + lelen + en.csize);
    if (en.method === 0) return new TextDecoder().decode(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('ds');
    const ds = new DecompressionStream('deflate-raw');
    const ab = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
    return new TextDecoder().decode(ab);
  };
  // v30.3: فك المراجع الرقمية (&#1602; و&#x642;) — بعض البرامج تحفظ النص العربي بها، فكانت تُقرأ رموزًا لا حروفًا
  const dec = (s) => String(s || '').replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c))).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const sstXml = await readEntry('xl/sharedStrings.xml');
  const sst = [];
  if (sstXml) {
    const sis = sstXml.split('<si>').slice(1);
    sis.forEach(si => {
      let txt = '';
      const parts = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      parts.forEach(p => { txt += dec(p.replace(/<t[^>]*>/, '').replace('</t>', '')); });
      sst.push(txt);
    });
  }
  const sheetName = Object.keys(entries).find(n => /^xl\/worksheets\/sheet1\.xml$/.test(n)) || Object.keys(entries).find(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shXml = await readEntry(sheetName);
  if (!shXml) throw new Error('sheet');
  const grid = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g; let rm;
  while ((rm = rowRe.exec(shXml))) {
    const cells = [];
    const cellRe = /<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] || ''; const inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1] || '';
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      col = Math.max(0, col - 1);
      const type = (attrs.match(/t="(\w+)"/) || [])[1] || '';
      let val = '';
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (type === 'inlineStr') { const tM = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/); val = dec(tM ? tM[1] : ''); }
      else if (vM) val = type === 's' ? (sst[Number(vM[1])] ?? '') : dec(vM[1]);
      cells[col] = val;
    }
    grid.push(Array.from(cells, x => x ?? ''));
  }
  return grid.filter(r => r.some(c => String(c).trim() !== ''));
};
// اكتشاف أعمدة الكشف تلقائياً بكلمات مفاتيح شائعة (عربي/إنجليزي)
const detectStmtMap = (grid) => {
  const kw = {
    date: ['تاريخ', 'التاريخ', 'date', 'يوم'],
    credit: ['دائن', 'إيداع', 'ايداع', 'وارد', 'credit', 'deposit'],
    debit: ['مدين', 'خصم', 'سحب', 'صادر', 'debit', 'withdraw'],
    amount: ['مبلغ', 'المبلغ', 'قيمة', 'amount'],
    desc: ['وصف', 'بيان', 'البيان', 'تفاصيل', 'description', 'details', 'narration']
  };
  const hit = (cell, list) => { const s = String(cell || '').toLowerCase(); return list.some(k => s.includes(k)); };
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    const row = grid[r] || [];
    const m = { date: -1, credit: -1, debit: -1, amount: -1, desc: -1 };
    row.forEach((cell, ci) => {
      Object.keys(kw).forEach(k => { if (m[k] < 0 && hit(cell, kw[k])) m[k] = ci; });
    });
    if (m.date >= 0 && (m.credit >= 0 || m.amount >= 0)) return { ...m, start: r + 1 };
  }
  return null;
};

// ترقيم تلقائي لكل شريك حسب نوعه — لتمييز التكرار في الأسماء
const PT_PREFIX = { supplier: 'مورد', employee: 'موظف', customer: 'عميل' };
const partnerCode = (type, seq) => (PT_PREFIX[type] || 'شريك') + '-' + String(seq).padStart(3, '0');

/* v29.4 — دفعات فاتورة المورد كسجل مستقل لكل دفعة (تاريخها ومصدرها).
   كان السداد يُجمَّع في paidAmount واحد بلا تاريخ، فيُقيَّد بتاريخ الفاتورة لا تاريخ الدفع،
   ومصدر آخر دفعة (payFund) يُطبَّق بأثر رجعي على كل الدفعات السابقة. الفواتير القديمة:
   ما سُدِّد قبل هذا الإصدار يبقى دفعة واحدة بسلوكه السابق (paidDate أو تاريخ الفاتورة، وpayFund). */
function invPayments(i) {
  const d = (i.date || i.createdAt || i.dueDate || '').slice(0, 10);
  const list = Array.isArray(i.payments) ? i.payments.filter(p => (Number(p.amount) || 0) > 0) : [];
  const listed = Math.round(list.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
  const legacy = Math.round(((i.paidAmount || 0) - listed) * 100) / 100;
  const out = list.map((p, k) => ({ id: p.id || String(k), amount: Number(p.amount) || 0, date: (p.date || d || '').slice(0, 10), fund: p.fund || '' }));
  if (legacy > 0.004) out.unshift({ id: 'legacy', amount: legacy, date: (i.paidDate || d || '').slice(0, 10), fund: i.payFund || '' });
  return out;
}
// تاريخ محلي من طابع زمني كامل (nowISO بتوقيت UTC) — أو التاريخ كما هو إن كان YYYY-MM-DD
const dayOf = (v) => { const t = String(v || ''); if (t.length > 10 && t.includes('T')) { const x = new Date(t); if (!isNaN(x)) return isoD(x); } return t.slice(0, 10); };

/* v31.0 — سجل فواتير المبيعات: سجل دائم مرقّم متسلسلًا (لكل سلسلة وسنة) لا يُعدَّل ولا يُحذف — يُعكس بإشعار دائن.
   كل فاتورة تحمل بصمة SHA-256 لمحتواها مع بصمة السابقة (سلسلة) فيُكشف أي تعديل أو حذف لاحق. */
function sha256Hex(str) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const b = new TextEncoder().encode(String(str)); const l = b.length; const n = (((l + 9) + 63) >> 6) << 6; const m = new Uint8Array(n); m.set(b); m[l] = 0x80;
  const bits = l * 8; for (let i = 0; i < 8; i++) m[n - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; const w = new Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) { const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) | 0, S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const SI_SERIES = { invoice: 'فاتورة', credit: 'إشعار' };
/* v32.1 — الدفتر المُرحَّل المجمَّد: عند إقفال شهر يُحفظ ميزانه (مدين/دائن لكل حساب) وبصمة SHA-256 لقيوده،
   ثم يُقارن الحي بالمجمَّد في أي وقت — أي اختلاف (بعد فتح استثنائي أو خلل) يظهر فورًا */
function monthLedger(A, m) {
  const es = A.entries.filter(e => String(e.date || '').slice(0, 7) === m).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const tb = {}; let dr = 0, cr = 0;
  es.forEach(e => e.lines.forEach(l => { const x = tb[l.code] || (tb[l.code] = [0, 0]); x[0] += l.debit || 0; x[1] += l.credit || 0; dr += l.debit || 0; cr += l.credit || 0; }));
  Object.keys(tb).forEach(k => { tb[k] = [Math.round(tb[k][0] * 100) / 100, Math.round(tb[k][1] * 100) / 100]; });
  const sig = sha256Hex(es.map(e => e.id + '|' + e.date + '|' + e.lines.map(l => l.code + ':' + Math.round((l.debit || 0) * 100) + ':' + Math.round((l.credit || 0) * 100)).join(',')).join('\n'));
  return { month: m, n: es.length, dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100, tb, sig };
}
function snapMonths(A, upTo, existing) {
  const have = new Set((existing || []).map(x => x.month));
  const months = [...new Set(A.entries.map(e => String(e.date || '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m) && m <= upTo))].sort();
  return months.filter(m => !have.has(m));
}
// المحتوى المُبصَم: كل ما يغيّر أثر الفاتورة (التحصيلات خارجه لأنها تُضاف لاحقًا)
const siCanon = (x) => JSON.stringify([x.no, x.kind, x.type, x.date, x.time || '', x.entityId || '', x.branchId || '', x.customerKey || '', (x.buyer || {}).name || '', (x.buyer || {}).vat || '',
  (x.lines || []).map(l => [l.desc, l.qty, l.price, l.vatRate, l.net, l.vat]), x.net, x.vat, x.total, x.terms, x.fund || '', x.refId || '', !!x.inClosing, x.icv, x.pih || '']);
const siSorted = (list) => (list || []).slice().sort((a, b) => (a.icv || 0) - (b.icv || 0));
// بناء سجل جديد داخل دالة الحفظ (على أحدث نسخة) — الرقم والعداد والبصمة تُحسب هنا فلا يتكرر رقم بين جهازين
/* v33.2 — منع تكرار الفواتير: يُفحص كل حفظ مركزيًا مهما كانت الشاشة.
   المشتريات: نفس المورد + نفس رقم الفاتورة (بعد التطبيع) = مكرر. المبيعات: الترقيم تسلسلي فلا يتكرر رقم،
   والحماية من الإصدار المزدوج (نقرتان/إعادة إرسال): نفس العميل والتاريخ والبنود والإجمالي خلال 10 دقائق. */
const invNoNorm = (x) => String(x == null ? '' : x).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .toLowerCase().replace(/[^0-9a-z؀-ۿ]/g, '').replace(/(^|[^0-9])0+(?=\d)/g, '$1');
const purKey = (i) => { const n = invNoNorm(i.invoiceNo); if (!n) return ''; return (i.supplierId || ('n:' + invNoNorm(i.supplierName))) + '|' + (i.creditNote ? 'cn' : 'inv') + '|' + n; };
const siSig = (x) => [x.kind, x.refId || '', x.date, x.customerKey || invNoNorm((x.buyer || {}).name), Math.round((Number(x.total) || 0) * 100),
  (x.lines || []).map(l => invNoNorm(l.desc) + ':' + l.qty + ':' + l.price).join(';')].join('|');
function findDupInvoices(prev, next) {
  const out = [];
  const pIds = new Set((prev.invoices || []).map(i => i.id));
  const seen = new Map(); (prev.invoices || []).forEach(i => { const k = purKey(i); if (k && !seen.has(k)) seen.set(k, i); });
  // سجلات ميزان المستوردة تُمنع من التكرار بمعرّفها في ميزان (mizanId) — هي دفتر محاسبي قائم فلا تُرفض الدفعة كلها
  (next.invoices || []).filter(i => !pIds.has(i.id) && !i.mizanId).forEach(i => { const k = purKey(i); if (!k) return; const o = seen.get(k);
    if (o) out.push({ kind: 'purchase', rec: i, dup: o, msg: 'فاتورة المورد «' + (i.supplierName || '') + '» رقم ' + i.invoiceNo + ' مسجّلة مسبقًا بتاريخ ' + (o.date || '') + ' بمبلغ ' + money(Math.abs(o.amount || 0)) });
    else seen.set(k, i); });
  const sIds = new Set((prev.salesInvoices || []).map(x => x.id));
  const tms = (x) => Date.parse(x.at || '') || 0;
  const olds = (prev.salesInvoices || []).slice();
  (next.salesInvoices || []).filter(x => !sIds.has(x.id)).forEach(x => { const sg = siSig(x);
    const o = olds.find(y => siSig(y) === sg && Math.abs(tms(x) - tms(y)) < 10 * 60 * 1000);
    if (o) out.push({ kind: 'sales', rec: x, dup: o, msg: (x.kind === 'credit' ? 'إشعار دائن مطابق' : 'فاتورة مبيعات مطابقة') + ' (نفس العميل والبنود والإجمالي ' + money(x.total) + ') صدرت قبل دقائق برقم ' + (o.no || '') });
    else olds.push(x); });
  return out;
}

// v33.3 — تنبيه فوري أثناء كتابة رقم فاتورة المورد (قبل الضغط على حفظ)
function DupInvHint({ invoices, supplierId, invoiceNo, amount, date }) {
  const no = String(invoiceNo || '').trim();
  const k0 = no && supplierId ? purKey({ supplierId, invoiceNo: no }) : '';
  const o = k0 ? (invoices || []).find(i => purKey(i) === k0) : null;
  if (o) return <div className="badge b-rose" style={{ marginTop: 5, whiteSpace: 'normal', lineHeight: 1.7 }}>⚠ رقم مكرر: الفاتورة {o.invoiceNo} لهذا المورد مسجّلة بتاريخ {o.date || '—'} بمبلغ {money(Math.abs(o.amount || 0))} — لن تُحفظ</div>;
  const v = Number(amount) || 0;
  const tw = v > 0 && supplierId && date ? (invoices || []).find(i => !i.creditNote && i.supplierId === supplierId && (i.date || '') === date && Math.abs((i.amount || 0) - v) < 0.01) : null;
  if (tw) return <div className="badge b-amber" style={{ marginTop: 5, whiteSpace: 'normal', lineHeight: 1.7 }}>تنبيه: فاتورة لنفس المورد بنفس التاريخ والمبلغ برقم {tw.invoiceNo || '—'} — تأكد أنها ليست مكررة</div>;
  return no && supplierId ? <div style={{ marginTop: 4, fontSize: 11, color: 'var(--mint)' }}>✓ الرقم غير مسجّل لهذا المورد</div> : null;
}

function siStamp(list, rec) {
  const yr = String(rec.date || '').slice(0, 4), pre = SI_SERIES[rec.kind] || 'فاتورة';
  const seq = 1 + (list || []).filter(x => x.kind === rec.kind && String(x.date || '').slice(0, 4) === yr).reduce((mx, x) => Math.max(mx, Number(x.seq) || 0), 0);
  const last = siSorted(list).slice(-1)[0];
  const out = { ...rec, seq, no: pre + '-' + yr + '-' + String(seq).padStart(5, '0'), icv: ((last && last.icv) || 0) + 1, pih: (last && last.hash) || '0' };
  out.hash = sha256Hex(siCanon(out));
  return out;
}
function siVerify(list) {
  const L = siSorted(list); let prev = '0';
  for (let i = 0; i < L.length; i++) { const x = L[i];
    if (x.icv !== i + 1) return { ok: false, at: x.no, why: 'فجوة في العداد عند ' + x.no };
    if ((x.pih || '0') !== prev) return { ok: false, at: x.no, why: 'انقطاع السلسلة عند ' + x.no };
    if (sha256Hex(siCanon(x)) !== x.hash) return { ok: false, at: x.no, why: 'محتوى معدّل في ' + x.no };
    prev = x.hash; }
  return { ok: true, n: L.length };
}
const siPaid = (x) => Math.round((x.receipts || []).reduce((a, r) => a + (Number(r.amount) || 0), 0) * 100) / 100;
const siCredited = (ops, x) => Math.round((ops.salesInvoices || []).filter(c => c.kind === 'credit' && c.refId === x.id).reduce((a, c) => a + (Number(c.total) || 0), 0) * 100) / 100;
const siRem = (ops, x) => x.kind === 'credit' || x.terms !== 'credit' ? 0 : Math.max(0, Math.round((x.total - siPaid(x) - siCredited(ops, x)) * 100) / 100);

/* v31.4 — الجرد الدوري المجدول: لكل مستودع موعد جرد حسب التكرار، وآخر جرد من سجل الجلسات أو تسويات الجرد */
const COUNT_FREQ = { weekly: { ar: 'أسبوعي', d: 7 }, biweekly: { ar: 'كل أسبوعين', d: 14 }, monthly: { ar: 'شهري', d: 30 } };
function countSchedule(org, ops) {
  const c = org.countCfg || {}; if (!c.freq || !COUNT_FREQ[c.freq]) return null;
  const whs = whOn(org) ? whOf(org) : [{ id: MAIN_WH, name: 'المخزون', kind: 'main' }];
  const td = today();
  return whs.map(w => {
    const fromLog = (ops.stockCounts || []).filter(x => (x.whId || MAIN_WH) === w.id && x.scope !== 'a').map(x => x.date);
    const fromAdj = [...(ops.stockMoves || []).filter(m => (m.whId || MAIN_WH) === w.id), ...(ops.whMoves || []).filter(m => m.whId === w.id)].filter(m => m.kind === 'adjust' && m.countScope !== 'a').map(m => m.date);
    const last = [...fromLog, ...fromAdj].filter(Boolean).sort().slice(-1)[0] || '';
    const base = last || c.since || td;
    const due = isoD(new Date(Date.parse(base + 'T12:00:00') + COUNT_FREQ[c.freq].d * 86400000));
    const st = !last && !c.since ? 'due' : due < td ? 'over' : due === td ? 'due' : (Date.parse(due) - Date.parse(td)) / 86400000 <= 2 ? 'soon' : 'ok';
    return { w, last, due, st };
  });
}
// أصناف الجرد الدوري: الكل أو الأعلى قيمة في المستودع (افتراضي 15)
function countFocus(org, ops, whId) {
  const c = org.countCfg || {}; if (c.scope !== 'top') return null;
  const SB = stockByWh(org, ops); const AVG = itemAvgCosts(org, ops); const bal = (whOn(org) ? SB.byWh[whId] : SB.total) || {};
  return new Set((org.items || []).filter(isStocked).map(it => ({ id: it.id, v: Math.max(0, bal[it.id] || 0) * (AVG[it.id] || 0) })).sort((a, b) => b.v - a.v).slice(0, Number(c.top) || 15).filter(x => x.v > 0).map(x => x.id));
}

/* v31.2 — الإجازات وفق نظام العمل السعودي
   السنوية: 21 يومًا وتصبح 30 بعد 5 سنوات خدمة (م109) — تُستحق يوميًا بالتناسب. المرضية (م117): أول 30 يومًا بأجر كامل، ثم 60 بثلاثة أرباع، ثم 30 بلا أجر خلال السنة.
   بدون راتب: خصم كامل. الزواج 5، الوفاة 5، المولود 3، الحج حتى 15 مرة واحدة، الوضع 10 أسابيع — مدفوعة ولا تخصم من الرصيد.
   الخصومات تُكتب سلفًا من نوع خصم على شهرها فتدخل المسير والقيود تلقائيًا. والأيام المعتمدة لا تُحتسب غيابًا في الحضور. */
const LEAVE_TYPES = {
  annual: { ar: 'سنوية', paid: true, bal: true },
  sick: { ar: 'مرضية', paid: 'tiered' },
  unpaid: { ar: 'بدون راتب', paid: false },
  marriage: { ar: 'زواج', paid: true, max: 5 },
  death: { ar: 'وفاة قريب', paid: true, max: 5 },
  birth: { ar: 'مولود', paid: true, max: 3 },
  hajj: { ar: 'حج', paid: true, max: 15, once: true, minYears: 2 },
  maternity: { ar: 'وضع (أمومة)', paid: true, max: 70 },
  exam: { ar: 'امتحان', paid: false }
};
const lvDays = (from, to) => { const a = Date.parse(from + 'T12:00:00'), b = Date.parse(to + 'T12:00:00'); return (isNaN(a) || isNaN(b) || b < a) ? 0 : Math.round((b - a) / 86400000) + 1; };
const lvAddD = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
const onLeave = (ops, empId, ds) => (ops.leaveRequests || []).some(r => r.employeeId === empId && r.status === 'approved' && ds >= r.from && ds <= r.to);
const lvCfg = (org) => { const c = org.leaveCfg || {}; return { annual: Number(c.annual) || 21, after5: Number(c.after5) || 30 }; };
// رصيد الإجازة السنوية في تاريخ D: الافتتاحي + المستحق يوميًا − المأخوذ (المعتمد) حتى D
function leaveBalance(org, ops, e, D) {
  const C = lvCfg(org); const op = e.leaveOpening || null;
  const start = (op && op.date) || e.hireDate; if (!start) return { ok: false, accrued: 0, used: 0, balance: 0, rate: C.annual };
  const end = (e.isActive === false && e.endDate && e.endDate < D) ? e.endDate : D;
  let accrued = (op && Number(op.days)) || 0;
  if (end >= start) {
    const five = e.hireDate ? lvAddD(e.hireDate, Math.round(5 * 365.25)) : '9999-12-31';
    const d1 = lvDays(start, end < five ? end : lvAddD(five, -1)), d2 = end >= five ? lvDays(five > start ? five : start, end) : 0;
    accrued += Math.max(0, d1) * C.annual / 365 + Math.max(0, d2) * C.after5 / 365;
  }
  let used = 0;
  (ops.leaveRequests || []).filter(r => r.employeeId === e.id && r.status === 'approved' && r.type === 'annual' && (!op || r.from > op.date)).forEach(r => {
    if (r.from > D) return; used += lvDays(r.from, r.to < D ? r.to : D); });
  const r2 = (n) => Math.round(n * 100) / 100;
  const yrs = e.hireDate ? eosYears(e.hireDate, D) : 0;
  return { ok: true, accrued: r2(accrued), used, balance: r2(accrued - used), rate: yrs >= 5 ? C.after5 : C.annual };
}
// خصم الإجازة موزعًا على الأشهر: [{month, days, pct}] — pct نسبة الخصم من أجر اليوم
function leaveDeductPlan(ops, e, type, from, to, exceptId) {
  const days = []; for (let d = from; d <= to; d = lvAddD(d, 1)) days.push(d);
  let pcts;
  if (type === 'unpaid' || type === 'exam') pcts = days.map(() => 100);
  else if (type === 'sick') {
    const yrAgo = lvAddD(from, -365);
    let prior = 0; (ops.leaveRequests || []).filter(r => r.id !== exceptId && r.employeeId === e.id && r.status === 'approved' && r.type === 'sick' && r.to >= yrAgo && r.from < from)
      .forEach(r => { prior += lvDays(r.from < yrAgo ? yrAgo : r.from, r.to < from ? r.to : lvAddD(from, -1)); });
    pcts = days.map((_, i) => { const n = prior + i + 1; return n <= 30 ? 0 : n <= 90 ? 25 : 100; });
  } else pcts = days.map(() => 0);
  const by = {}; days.forEach((d, i) => { if (!pcts[i]) return; const m = d.slice(0, 7); const k = m + '|' + pcts[i]; by[k] = by[k] || { month: m, pct: pcts[i], days: 0 }; by[k].days++; });
  return Object.values(by);
}
const lvDaily = (e) => Math.round(eosWageOf(e) / 30 * 100) / 100;
// مخصص الإجازات (التزام): رصيد الأيام × أجر اليوم — يُرحَّل شهريًا بالفرق مثل مخصص نهاية الخدمة
function lvState(ops) {
  const L = (ops.ledgerEntries || []).filter(x => x.kind === 'lv_open' || x.kind === 'lv_accrual');
  const open = L.find(x => x.kind === 'lv_open') || null; const months = new Set(L.filter(x => x.kind === 'lv_accrual').map(x => x.month)); const bal = {};
  L.forEach(x => (x.lines || []).forEach(l => { bal[l.empId] = Math.round(((bal[l.empId] || 0) + (Number(l.amt) || 0)) * 100) / 100; }));
  return { open, months, bal, from: open ? open.month : '' };
}
function lvRequired(org, ops, e, D) {
  if (!e.hireDate && !e.leaveOpening) return 0;
  if (eosState(ops).paid[e.id] && (eosState(ops).paid[e.id].date || '') <= D) return 0;
  const b = leaveBalance(org, ops, e, D); return Math.max(0, Math.round(b.balance * lvDaily(e) * 100) / 100);
}
function lvAccrualLines(org, ops, D) {
  const ST = lvState(ops);
  return (org.employees || []).map(e => { const cum = lvRequired(org, ops, e, D); const amt = Math.round((cum - (ST.bal[e.id] || 0)) * 100) / 100;
    return { empId: e.id, name: e.name, branchId: e.branchId || '', cum, amt }; }).filter(l => Math.abs(l.amt) > 0.004);
}

/* v30.8 — مخصص مكافأة نهاية الخدمة (نظام العمل م84): يُقاس على أساس الاستحقاق الكامل (إنهاء من صاحب العمل)
   بأجر آخر شهر (الأساسي + البدلات)، ويُرحَّل شهريًا كقيد دائم: الفرق بين المخصص المطلوب ورصيده المسجّل.
   السجلات في ledgerEntries بلا partnerKey (لا تظهر في كشف الموظف لأنها ليست مستحقة الدفع بعد). */
const eosWageOf = (e) => Math.round(((Number(e.baseSalary) || 0) + (Number(e.housingAllowance) || 0) + (Number(e.transportAllowance) || 0) + (Number(e.otherAllowance) || 0)) * 100) / 100;
const eosYears = (hire, end) => { if (!hire || !end) return 0; const h = Date.parse(hire + 'T00:00:00'), t = Date.parse(end + 'T00:00:00'); if (isNaN(h) || isNaN(t) || t < h) return 0; return (t - h) / (365.25 * 86400000); };
const eosFullAmt = (wage, years) => years <= 5 ? wage * 0.5 * years : wage * (2.5 + (years - 5));
const eosEntitledAmt = (wage, years, reason) => { const full = eosFullAmt(wage, years); if (reason === 'termination') return full; if (years < 2) return 0; if (years < 5) return full / 3; if (years < 10) return full * 2 / 3; return full; };
const monthEnd = (m) => { const [y, mo] = m.split('-').map(Number); return isoD(new Date(y, mo, 0)); };
// المخصص المطلوب للموظف في تاريخ D — الخدمة تتوقف عند تاريخ انتهائها
function eosCumAt(e, D) {
  if (!e || !e.hireDate || e.hireDate > D) return 0;
  const end = (e.isActive === false && e.endDate && e.endDate < D) ? e.endDate : D;
  return Math.round(eosFullAmt(eosWageOf(e), eosYears(e.hireDate, end)) * 100) / 100;
}
function eosState(ops) {
  const L = (ops.ledgerEntries || []).filter(x => x.kind === 'eos_open' || x.kind === 'eos_accrual' || x.kind === 'eos_pay');
  const open = L.find(x => x.kind === 'eos_open') || null;
  const months = new Set(L.filter(x => x.kind === 'eos_accrual').map(x => x.month));
  const bal = {}, paid = {};
  L.forEach(x => { if (x.kind === 'eos_pay') { paid[x.empId] = x; return; } (x.lines || []).forEach(l => { bal[l.empId] = Math.round(((bal[l.empId] || 0) + (Number(l.amt) || 0)) * 100) / 100; }); });
  Object.keys(paid).forEach(id => { bal[id] = 0; });
  return { open, months, bal, paid, from: open ? open.month : '' };
}
// أسطر ترحيل شهر: الفرق بين المطلوب في نهاية الشهر والرصيد المسجّل لكل موظف لم تُصرف مخالصته
function eosAccrualLines(org, ops, month) {
  const ST = eosState(ops), D = monthEnd(month);
  return (org.employees || []).filter(e => !ST.paid[e.id] && e.hireDate && e.hireDate <= D).map(e => {
    const cum = eosCumAt(e, D), amt = Math.round((cum - (ST.bal[e.id] || 0)) * 100) / 100;
    return { empId: e.id, name: e.name, branchId: e.branchId || '', cum, amt };
  }).filter(l => Math.abs(l.amt) > 0.004);
}

// v30.7 — العنوان الوطني السعودي (سبل): رقم المبنى، الشارع، الحي، المدينة، الرمز البريدي، الرقم الإضافي، الوحدة، العنوان المختصر
const NA_F = [['bldg', 'رقم المبنى', '4 أرقام', 4], ['street', 'اسم الشارع', '', 0], ['district', 'الحي', '', 0], ['city', 'المدينة', '', 0], ['zip', 'الرمز البريدي', '5 أرقام', 5], ['addl', 'الرقم الإضافي', '4 أرقام', 4], ['unit', 'رقم الوحدة (اختياري)', '', 0], ['short', 'العنوان المختصر (اختياري)', 'مثل RRRD2929', 0]];
const naClean = (na) => { const o = {}; NA_F.forEach(([k]) => { const v = String((na || {})[k] || '').trim(); if (v) o[k] = k === 'short' ? v.toUpperCase().replace(/\s/g, '') : v; }); return o; };
const naHas = (na) => Object.keys(naClean(na)).length > 0;
const fmtNA = (na) => { const a = naClean(na); if (!naHas(a)) return '';
  return [a.bldg && 'مبنى ' + a.bldg, a.street && 'شارع ' + a.street.replace(/^شارع\s+/, ''), a.district && 'حي ' + a.district.replace(/^حي\s+/, ''), [a.city, a.zip].filter(Boolean).join(' '), a.addl && 'الرقم الإضافي ' + a.addl, a.unit && 'وحدة ' + a.unit].filter(Boolean).join('، ') + (a.short ? ' (' + a.short + ')' : ''); };
const naErr = (na) => { const a = naClean(na); if (!naHas(a)) return '';
  if (a.bldg && !/^\d{4}$/.test(a.bldg)) return 'رقم المبنى 4 أرقام';
  if (a.zip && !/^\d{5}$/.test(a.zip)) return 'الرمز البريدي 5 أرقام';
  if (a.addl && !/^\d{4}$/.test(a.addl)) return 'الرقم الإضافي 4 أرقام';
  if (a.short && !/^[A-Z]{4}\d{4}$/.test(a.short)) return 'العنوان المختصر 4 أحرف إنجليزية ثم 4 أرقام (مثل RRRD2929)';
  return ''; };
// ناقص لفاتورة ضريبية (B2B): المبنى والشارع والحي والمدينة والرمز البريدي
const naMissing = (na) => { const a = naClean(na); return [['bldg', 'رقم المبنى'], ['street', 'الشارع'], ['district', 'الحي'], ['city', 'المدينة'], ['zip', 'الرمز البريدي']].filter(([k]) => !a[k]).map(x => x[1]); };
function NationalAddressFields({ value, onChange, legacy }) {
  const na = value || {};
  const set = (k, v) => onChange({ ...na, [k]: v });
  const err = naErr(na), miss = naHas(na) ? naMissing(na) : [];
  return (
    <div className="card" style={{ background: 'var(--ink)', padding: 12, margin: '6px 0' }}>
      <div className="lbl" style={{ marginBottom: 6 }}>العنوان الوطني</div>
      <div className="grid g4" style={{ gap: 8 }}>
        {NA_F.map(([k, lbl, ph, dig]) => (
          <Field key={k} label={lbl}><input className={'inp' + (dig ? ' n' : '')} inputMode={dig ? 'numeric' : undefined} maxLength={dig || (k === 'short' ? 8 : undefined)} placeholder={ph}
            style={k === 'short' ? { direction: 'ltr', textAlign: 'right' } : undefined} value={na[k] || ''}
            onChange={e => set(k, dig ? e.target.value.replace(/\D/g, '') : e.target.value)} /></Field>
        ))}
      </div>
      {naHas(na) && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>📍 {fmtNA(na)}</div>}
      {err && <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 4 }}>⚠ {err}</div>}
      {!err && miss.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4 }}>للفاتورة الضريبية يلزم أيضًا: {miss.join('، ')}</div>}
      {!naHas(na) && legacy && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>العنوان المحفوظ سابقًا (نص حر): {legacy} — يُستبدل عند تعبئة الحقول.</div>}
    </div>
  );
}

// v30.6 — حقول بطاقة جهة الاتصال (مشتركة للموردين والعملاء)
const CONTACT_F = ['contactPerson', 'mobile2', 'email', 'city', 'crNo', 'iban', 'bankName', 'creditLimit', 'notes', 'inactive'];
const waNum = (ph) => { let d = String(ph || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('05')) d = '966' + d.slice(1); else if (d.startsWith('5') && d.length === 9) d = '966' + d; return d; };
const contactFields = (c) => { const o = {}; CONTACT_F.forEach(k => { if (k === 'inactive') return; const v = c[k]; o[k] = k === 'creditLimit' ? (Number(v) || 0) : (v == null ? '' : String(v).trim()); });
  if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) o.email = '';
  o.na = naClean(c.na); if (naHas(o.na)) o.address = fmtNA(o.na); if (o.na.city) o.city = o.na.city; return o; };
const contactOf = (r) => { const o = {}; CONTACT_F.forEach(k => { if (r && r[k] != null && r[k] !== '') o[k] = r[k]; }); if (r && naHas(r.na)) o.na = naClean(r.na); return o; };
function buildPartners(org, ops) {
  const parts = [];
  const led = ops.ledgerEntries || [];
  const ledFor = (key) => led.filter(e => e.partnerKey === key).map(e => ({
    date: (e.date || '').slice(0, 10), desc: e.desc || 'حركة يدوية', ref: e.ref || '',
    src: e.src || 'manual', debit: e.debit || 0, credit: e.credit || 0, entryId: e.id
  }));
  // الدفتر يعتمد الإغلاقات المرحّلة/المعتمدة فقط — المسودات والمرفوضة لا تدخل كشوف الحسابات
  const countedClosings = (ops.closings || []).filter(c => c.status === 'submitted' || c.status === 'approved');
  const EXP_PM_AR = { cash: 'نقدًا', card: 'شبكة', cheque: 'شيكًا', bank_transfer: 'تحويلًا' };
  // مصروفات/مشتريات الإغلاق المرتبطة بشريك (عبر partnerKey للجميع، أو supplierId للموردين توافقاً)
  // الآجلة فقط ترفع الرصيد المستحق؛ المدفوعة فورًا تُقيَّد مع سدادها بنفس السطر (أثر صافٍ صفر)
  const closeFor = (key, supId) => {
    const t = [];
    countedClosings.forEach(c => (c.expenses || []).forEach(e => {
      if (e.partnerKey === key || (supId && e.supplierId === supId)) {
        const amt = e.amount || 0; if (!amt) return;
        const base = (e.categoryName || 'مصروف');
        if (e.paymentMethod === 'deferred') {
          t.push({ date: c.date, desc: base + ' (آجل — على الحساب) — إغلاق ' + (c.branchName || ''), ref: c.id, src: 'close', debit: 0, credit: amt });
        } else {
          t.push({ date: c.date, desc: base + ' (مسدّدة ' + (EXP_PM_AR[e.paymentMethod] || 'فورًا') + ') — إغلاق ' + (c.branchName || ''), ref: c.id, src: 'close', debit: amt, credit: amt });
        }
      }
    }));
    return t;
  };
  // سدادات الموردين المسجّلة في الإغلاق → مدين (يقلّل ما علينا)، وقد تُوزَّع على عدة طرق دفع
  const payFor = (key, supId) => {
    const t = [];
    countedClosings.forEach(c => (c.supplierPayments || []).forEach(pm => {
      if (pm.partnerKey === key || (supId && pm.supplierId === supId)) {
        const tot = payTotal(pm); if (tot <= 0) return;
        t.push({ date: c.date, desc: 'سداد' + (payLabel(pm) ? ' (' + payLabel(pm) + ')' : '') + ' — إغلاق ' + (c.branchName || ''), ref: pm.reference || c.id, src: 'pay', debit: tot, credit: 0 });
      }
    }));
    return t;
  };

  // الموردون — فواتير + سداداتها + مشتريات الإغلاق المرتبطة + حركات يدوية
  (org.suppliers || []).forEach(sp => {
    const key = sp.key || ('sup:' + sp.id); const txns = []; let linked = false;
    (ops.invoices || []).filter(i => i.supplierId === sp.id).forEach(i => {
      const d = (i.date || i.createdAt || i.dueDate || today() || '').slice(0, 10);
      // v28.2: الإشعار الدائن (مبلغ سالب) يُعرض مدينًا يخفض الرصيد بدل دائن سالب
      txns.push((i.amount || 0) < 0
        ? { date: d, desc: 'إشعار دائن من المورد ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: -i.amount, credit: 0 }
        : { date: d, desc: 'فاتورة توريد ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: 0, credit: i.amount || 0 });
      invPayments(i).forEach(p => txns.push({ date: p.date, desc: 'سداد فاتورة ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: p.amount, credit: 0 }));
      linked = true;
    });
    const ct = closeFor(key, sp.id); txns.push(...ct); if (ct.length) linked = true;
    const pt = payFor(key, sp.id); txns.push(...pt); if (pt.length) linked = true;
    // v8.1: السدادات المركزية لفواتير الورديات المشتقة
    (ops.closingInvPays || []).filter(x => x.supplierId === sp.id).forEach(x => {
      txns.push({ date: (x.date || '').slice(0, 10), desc: x.mizanId ? ('سداد من البنك' + (x.payType ? ' — ' + x.payType : '') + (x.bankRef ? ' · ' + x.bankRef : '')) : 'سداد مركزي لمشتريات وردية', ref: x.mizanId || x.refId || '', src: 'pay', debit: x.amount || 0, credit: 0 });
      linked = true;
    });
    txns.push(...ledFor(key));
    parts.push({ key, id: sp.id, ...contactOf(sp), name: sp.name, type: 'supplier', cat: sp.category || 'مورد', phone: sp.phone || '', tax: sp.vatNo || '', address: sp.address || '', taxable: !!sp.taxable, terms: sp.terms || 0, linked, txns, storedCode: sp.code });
  });

  // v31.0: حركات العميل من سجل فواتير المبيعات (الآجلة فقط: الفاتورة مدين، التحصيل والإشعار الدائن دائن)
  const siFor = (key) => { const t = [];
    (ops.salesInvoices || []).filter(x => x.customerKey === key && !x.inClosing).forEach(x => {
      if (x.kind === 'credit') { if (x.terms === 'credit') t.push({ date: x.date, desc: 'إشعار دائن ' + x.no, ref: x.no, src: 'si', debit: 0, credit: x.total }); return; }
      if (x.terms !== 'credit') return;
      t.push({ date: x.date, desc: 'فاتورة مبيعات ' + x.no, ref: x.no, src: 'si', debit: x.total, credit: 0, due: x.dueDate });
      (x.receipts || []).forEach(r => t.push({ date: r.date, desc: 'تحصيل عن ' + x.no, ref: x.no, src: 'si', debit: 0, credit: Number(r.amount) || 0 }));
    }); return t; };

  // الموظفون — استحقاق وصرف الرواتب قيود دائمة تُرحَّل من شاشة الرواتب (لا سطر اصطناعي يتغيّر بالشهر)
  (org.employees || []).forEach(em => {
    const key = 'emp:' + em.id; const txns = []; let linked = false;
    (ops.advances || []).filter(a => a.employeeId === em.id && !PAY_ADD_TYPES.includes(a.type)).forEach(a => {   // المكافأة (م8) داخل استحقاق الراتب أصلًا — لا تُعرض كمديونية على الموظف
      const isDraw = ['advance', 'salary_draw'].includes(a.type);
      txns.push({ date: (a.date || '').slice(0, 10), desc: (isDraw ? 'سلفة/سحب على الراتب' : 'خصم/جزاء') + (a.reason ? ' — ' + a.reason : ''), ref: a.month || '', src: 'adv', debit: a.amount || 0, credit: 0 });
      linked = true;
    });
    const ce = closeFor(key); txns.push(...ce); if (ce.length) linked = true;
    const pe = payFor(key); txns.push(...pe); if (pe.length) linked = true;
    txns.push(...ledFor(key));
    parts.push({ key, id: em.id, email: em.email || '', branchId: em.branchId || '', name: em.name, type: 'employee', cat: em.jobTitle || em.title || 'موظف', phone: em.phone || '', tax: em.nationalId || em.iqamaNo || '', terms: 0, linked, txns, storedCode: em.code });
  });

  // العملاء والشركاء اليدويون — حركات يدوية فقط
  (org.partners || []).forEach(pt => {
    const key = pt.key || ('cust:' + pt.id);
    const ce = [...closeFor(key), ...siFor(key)], pp = payFor(key);
    parts.push({ key, id: pt.id, ...contactOf(pt), name: pt.name, type: pt.type || 'customer', cat: pt.cat || 'عميل', phone: pt.phone || '', tax: pt.tax || '', address: pt.address || '', taxable: !!pt.taxable, terms: pt.terms || 0, linked: (ce.length + pp.length) > 0, custom: true, txns: [...ce, ...pp, ...ledFor(key)], storedCode: pt.code });
  });

  // v15.14 — شركاء الفرع: أُضيفوا فوريًا من فرعهم بلا اعتماد إداري (br store)؛ يُجمَّعون هنا
  // للعرض المركزي. إن رُقّي أحدهم لاحقًا لدفتر الشركاء الرسمي بنفس المفتاح، تسقط نسخة الفرع
  // هنا تلقائيًا (المركزي أولًا) فلا يظهر مكررًا.
  const orgKeys = new Set(parts.map(p => p.key));
  (ops.branchPartners || []).forEach(bp => {
    if (orgKeys.has(bp.key)) return;
    const ce = closeFor(bp.key), pp = payFor(bp.key);
    parts.push({
      key: bp.key, id: bp.id, name: bp.name, type: bp.type || 'customer',
      cat: bp.cat || (PT_TYPE[bp.type] || {}).ar || 'عميل', phone: bp.phone || '', tax: '', terms: 0,
      linked: (ce.length + pp.length) > 0, custom: true, txns: [...ce, ...pp, ...ledFor(bp.key)],
      storedCode: bp.code, source: 'branch', branchOrigin: bp.branchId || '', branchOriginName: bp.branchName || ''
    });
  });

  // الأكواد: المخزَّنة على البطاقة ثابتة لا تتغير؛ ولمن بلا كود نُكمل الترقيم دون تصادم
  const usedNums = {};
  parts.forEach(p => {
    const m2 = /-(\d+)$/.exec(p.storedCode || '');
    if (m2) (usedNums[p.type] = usedNums[p.type] || new Set()).add(+m2[1]);
  });
  const nextNum = {};
  parts.forEach(p => {
    p.txns.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    p.balance = p.txns.reduce((s, t) => s + (t.credit || 0) - (t.debit || 0), 0);
    if (p.storedCode) { p.code = p.storedCode; return; }
    const u = (usedNums[p.type] = usedNums[p.type] || new Set());
    let n = (nextNum[p.type] || 0) + 1;
    while (u.has(n)) n++;
    nextNum[p.type] = n; u.add(n);
    p.code = partnerCode(p.type, n);
  });
  return parts;
}

// v10.7/v10.8 — أعمار ذمّة مورد: الأعباء (دائن فقط) تُطبَّق عليها السدادات (مدين فقط) بالأقدم أولًا، والمتبقّي يُصنَّف بعُمره
function supplierAging(p, todayStr) {
  const upto = (t) => !todayStr || !t.date || t.date <= todayStr; // v15.5: أعمار كما في تاريخ — تُستثنى الحركات بعده
  const charges = (p.txns || []).filter(t => upto(t) && (t.credit || 0) > 0 && !((t.debit || 0) > 0)).map(t => ({ date: t.date, open: t.credit }));
  charges.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let pay = (p.txns || []).reduce((s, t) => s + ((upto(t) && (t.debit || 0) > 0 && !((t.credit || 0) > 0)) ? t.debit : 0), 0);
  for (const ch of charges) { if (pay <= 0.004) break; const ap = Math.min(pay, ch.open); ch.open -= ap; pay -= ap; }
  const dd = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? 0 : Math.max(0, Math.floor((y - x) / 86400000)); };
  const bk = { b0: 0, b30: 0, b60: 0, b90: 0 };
  charges.forEach(ch => { if (ch.open <= 0.004) return; const d = dd(ch.date, todayStr); if (d <= 30) bk.b0 += ch.open; else if (d <= 60) bk.b30 += ch.open; else if (d <= 90) bk.b60 += ch.open; else bk.b90 += ch.open; });
  const r = (n) => Math.round(n * 100) / 100;
  return { b0: r(bk.b0), b30: r(bk.b30), b60: r(bk.b60), b90: r(bk.b90), total: r(bk.b0 + bk.b30 + bk.b60 + bk.b90), credit: r(pay) };
}

// v12.2 — أعمار ذمّة عميل (مدينة): الأعباء (مدين فقط = على العميل) تُطبَّق عليها التحصيلات (دائن فقط) بالأقدم أولًا، والمتبقّي المفتوح يُصنَّف بعُمره. مرآة أعمار الموردين باتجاه معاكس.
function customerAging(p, todayStr) {
  const upto = (t) => !todayStr || !t.date || t.date <= todayStr; // v15.5: أعمار كما في تاريخ
  const charges = (p.txns || []).filter(t => upto(t) && (t.debit || 0) > 0 && !((t.credit || 0) > 0)).map(t => ({ date: t.date, open: t.debit }));
  charges.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let pay = (p.txns || []).reduce((s, t) => s + ((upto(t) && (t.credit || 0) > 0 && !((t.debit || 0) > 0)) ? t.credit : 0), 0);
  for (const ch of charges) { if (pay <= 0.004) break; const ap = Math.min(pay, ch.open); ch.open -= ap; pay -= ap; }
  const dd = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? 0 : Math.max(0, Math.floor((y - x) / 86400000)); };
  const bk = { b0: 0, b30: 0, b60: 0, b90: 0 };
  charges.forEach(ch => { if (ch.open <= 0.004) return; const d = dd(ch.date, todayStr); if (d <= 30) bk.b0 += ch.open; else if (d <= 60) bk.b30 += ch.open; else if (d <= 90) bk.b60 += ch.open; else bk.b90 += ch.open; });
  const r = (n) => Math.round(n * 100) / 100;
  return { b0: r(bk.b0), b30: r(bk.b30), b60: r(bk.b60), b90: r(bk.b90), total: r(bk.b0 + bk.b30 + bk.b60 + bk.b90), credit: r(pay) };
}

// ===== v11.3: توليد ملف Excel حقيقي (.xlsx) بلا أي مكتبة — ZIP(store)+CRC32+OOXML، دعم RTL وأرقام وعناوين عريضة =====
const _crcTab = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function _crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = _crcTab[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function _zipStore(files) {
  const enc = new TextEncoder(); const u16 = n => [n & 255, (n >> 8) & 255]; const u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  const parts = []; const central = []; let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name); const data = f.data; const crc = _crc32(data); const len = data.length;
    const lh = new Uint8Array([].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0), u16(0), u16(33), u32(crc), u32(len), u32(len), u16(name.length), u16(0)));
    parts.push(lh, name, data);
    central.push(new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(0), u16(33), u32(crc), u32(len), u32(len), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
    offset += lh.length + name.length + len;
  });
  let cLen = 0; central.forEach(c => cLen += c.length);
  const end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cLen), u32(offset), u16(0)));
  return new Blob(parts.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function _colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function _xe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _sheetXml(rows) {
  let body = '';
  (rows || []).forEach((row, r) => {
    let cells = '';
    row.forEach((v, c) => {
      const ref = _colName(c) + (r + 1); const st = r === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && isFinite(v)) cells += `<c r="${ref}"${st}><v>${v}</v></c>`;
      else cells += `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${_xe(v == null ? '' : v)}</t></is></c>`;
    });
    body += `<row r="${r + 1}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${body}</sheetData></worksheet>`;
}
function makeXlsx(sheets) {
  const enc = new TextEncoder(); const files = []; const add = (name, str) => files.push({ name, data: enc.encode(str) });
  const names = sheets.map((s, i) => (s.name || ('ورقة' + (i + 1))).slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${_xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>`);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, _sheetXml(s.rows)));
  return _zipStore(files);
}

/* ============================================================
   v11.8 — الفوترة الإلكترونية (زاتكا / رمز QR) — من غير أي مكتبة خارجية
   مولّد رمز QR كامل (نمط البايت، اختيار الإصدار والتصحيح تلقائيًا) +
   بانٍ لرمز زاتكا للمرحلة الأولى (TLV بترميز Base64). خوارزمية عامة
   (Nayuki، ملكية عامة) تم التحقق منها بفكّ فعلي عبر jsQR.
   ============================================================ */
const _QR_ECC_CW = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const _QR_ECC_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
function _qrMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
function _qrDivisor(degree) {
  const result = []; for (let i = 0; i < degree - 1; i++) result.push(0); result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) { result[j] = _qrMul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
    root = _qrMul(root, 0x02);
  }
  return result;
}
function _qrRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) { const factor = b ^ result.shift(); result.push(0); divisor.forEach((coef, i) => { result[i] ^= _qrMul(coef, factor); }); }
  return result;
}
function _qrRawModules(ver) { let r = (16 * ver + 128) * ver + 64; if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; } return r; }
function _qrDataCodewords(ver, ecl) { return Math.floor(_qrRawModules(ver) / 8) - _QR_ECC_CW[ecl][ver] * _QR_ECC_BLOCKS[ecl][ver]; }
function _qrAlign(ver) {
  if (ver === 1) return [];
  const num = Math.floor(ver / 7) + 2;
  const step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < num; pos -= step) result.splice(1, 0, pos);
  return result;
}
// يبني مصفوفة رمز QR منطقية (true=خانة داكنة). ecl: 0=L,1=M,2=Q,3=H
function qrMatrix(text, ecl) {
  if (ecl == null) ecl = 1;
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  for (; version <= 40; version++) {
    const cap = _qrDataCodewords(version, ecl); const ccBits = version <= 9 ? 8 : 16;
    if (Math.ceil((4 + ccBits + bytes.length * 8) / 8) <= cap) break;
  }
  if (version > 40) throw new Error('QR: data too long');
  const bb = [];
  const append = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
  append(0x4, 4); append(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const dataCap = _qrDataCodewords(version, ecl) * 8;
  append(0, Math.min(4, dataCap - bb.length));
  while (bb.length % 8 !== 0) bb.push(0);
  for (let pad = 0xEC; bb.length < dataCap; pad ^= 0xEC ^ 0x11) append(pad, 8);
  const dataCodewords = [];
  for (let i = 0; i < bb.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bb[i + j]; dataCodewords.push(b); }
  const numBlocks = _QR_ECC_BLOCKS[ecl][version], eccLen = _QR_ECC_CW[ecl][version];
  const rawCodewords = Math.floor(_qrRawModules(version) / 8);
  const numShort = numBlocks - rawCodewords % numBlocks, shortLen = Math.floor(rawCodewords / numBlocks);
  const blocks = [], divisor = _qrDivisor(eccLen); let k = 0;
  for (let i = 0; i < numBlocks; i++) { const datLen = shortLen - eccLen + (i < numShort ? 0 : 1); const dat = dataCodewords.slice(k, k + datLen); k += datLen; blocks.push({ dat, ecc: _qrRemainder(dat, divisor) }); }
  const allCodewords = []; const maxDat = shortLen - eccLen + 1;
  for (let i = 0; i < maxDat; i++) for (let j = 0; j < numBlocks; j++) { if (i < blocks[j].dat.length) allCodewords.push(blocks[j].dat[i]); }
  for (let i = 0; i < eccLen; i++) for (let j = 0; j < numBlocks; j++) allCodewords.push(blocks[j].ecc[i]);
  const size = version * 4 + 17;
  const modules = [], isFunction = [];
  for (let i = 0; i < size; i++) { modules.push(new Array(size).fill(false)); isFunction.push(new Array(size).fill(false)); }
  const setFunc = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };
  const drawFinder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunc(xx, yy, dist !== 2 && dist !== 4); } };
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
  for (let i = 0; i < size; i++) { if (!isFunction[6][i]) setFunc(i, 6, i % 2 === 0); if (!isFunction[i][6]) setFunc(6, i, i % 2 === 0); }
  const ap = _qrAlign(version);
  for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
    const cx = ap[i], cy = ap[j];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunc(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  for (let i = 0; i < 9; i++) { isFunction[i][8] = true; isFunction[8][i] = true; }
  for (let i = 0; i < 8; i++) { isFunction[8][size - 1 - i] = true; isFunction[size - 1 - i][8] = true; }
  setFunc(8, size - 8, true);
  if (version >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); isFunction[b][a] = true; isFunction[a][b] = true; }
  const dataBits = [];
  for (const cw of allCodewords) for (let i = 7; i >= 0; i--) dataBits.push((cw >>> i) & 1);
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let jj = 0; jj < 2; jj++) {
      const x = right - jj, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!isFunction[y][x] && bitIdx < dataBits.length) { modules[y][x] = dataBits[bitIdx] === 1; bitIdx++; }
    }
  }
  const applyMask = (mask, grid) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isFunction[y][x]) continue;
      let inv = false;
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break;
        case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
      }
      if (inv) grid[y][x] = !grid[y][x];
    }
  };
  const drawFormat = (mask, grid) => {
    const eccFmt = [1, 0, 3, 2][ecl]; const data = (eccFmt << 3) | mask;
    let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) grid[i][8] = ((bits >>> i) & 1) !== 0;
    grid[7][8] = ((bits >>> 6) & 1) !== 0; grid[8][8] = ((bits >>> 7) & 1) !== 0; grid[8][7] = ((bits >>> 8) & 1) !== 0;
    for (let i = 9; i < 15; i++) grid[8][14 - i] = ((bits >>> i) & 1) !== 0;
    for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = ((bits >>> i) & 1) !== 0;
    for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = ((bits >>> i) & 1) !== 0;
    grid[size - 8][8] = true;
  };
  const drawVersion = (grid) => {
    if (version < 7) return;
    let rem = version; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) { const bit = ((bits >>> i) & 1) !== 0, a = Math.floor(i / 3), b = size - 11 + i % 3; grid[a][b] = bit; grid[b][a] = bit; }
  };
  const penalty = (grid) => {
    let p = 0;
    for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (grid[y][x] === grid[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (grid[y][x] === grid[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (grid[y][x] === grid[y][x + 1] && grid[y][x] === grid[y + 1][x] && grid[y][x] === grid[y + 1][x + 1]) p += 3;
    let dark = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
    return p;
  };
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) { const grid = modules.map(r => r.slice()); applyMask(mask, grid); drawFormat(mask, grid); drawVersion(grid); const p = penalty(grid); if (p < bestP) { bestP = p; best = grid; } }
  return best;
}
// Base64 من مصفوفة بايتات (متوافق مع المتصفح)
function _qrB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
// رمز زاتكا للمرحلة الأولى: TLV (وسم-طول-قيمة) بترميز Base64 — 5 حقول إلزامية
function zatcaTLV(seller, vatNo, tsISO, total, vatAmount) {
  const enc = new TextEncoder();
  const tlv = (tag, valStr) => { const v = enc.encode(String(valStr == null ? '' : valStr)); const out = new Uint8Array(2 + v.length); out[0] = tag; out[1] = v.length; out.set(v, 2); return out; };
  const parts = [tlv(1, seller), tlv(2, vatNo), tlv(3, tsISO), tlv(4, Number(total || 0).toFixed(2)), tlv(5, Number(vatAmount || 0).toFixed(2))];
  let len = 0; parts.forEach(p => len += p.length);
  const buf = new Uint8Array(len); let off = 0; parts.forEach(p => { buf.set(p, off); off += p.length; });
  return _qrB64(buf);
}
// يحوّل نصًّا إلى رمز QR كصورة SVG (سلسلة) — للمعاينة الحية وللطباعة
function qrSvg(text, opts) {
  opts = opts || {};
  const ecl = opts.ecl != null ? opts.ecl : 1, quiet = opts.quiet != null ? opts.quiet : 4, px = opts.px || 220;
  let mat; try { mat = qrMatrix(text, ecl); } catch (e) { return ''; }
  const n = mat.length, total = n + quiet * 2, dark = opts.dark || '#111', light = opts.light || '#fff';
  let rects = '';
  for (let y = 0; y < n; y++) { let x = 0; while (x < n) { if (mat[y][x]) { let w = 1; while (x + w < n && mat[y][x + w]) w++; rects += `<rect x="${x + quiet}" y="${y + quiet}" width="${w}" height="1"/>`; x += w; } else x++; } }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}

/* v8.1 — فواتير مشتقة من الورديات: كل مصروف آجل مربوط بمورد في وردية معتمدة
   يظهر كفاتورة في تطبيق المشتريات (استحقاقها = تاريخ الوردية + مهلة المورد).
   قيدها المحاسبي هو قيد الوردية نفسه — لا قيد ثانٍ، فلا ازدواج ممكن. */
function closingInvoices(org, ops) {
  const out = [];
  (ops.closings || []).filter(countedClosing).forEach(c => (c.expenses || []).forEach((e, ix) => {
    if (e.paymentMethod !== 'deferred') return;
    const supId = e.supplierId || ((e.partnerKey || '').startsWith('sup:') ? e.partnerKey.slice(4) : '');
    if (!supId) return;
    const amt = e.amount || 0; if (amt <= 0) return;
    const sp = (org.suppliers || []).find(x => x.id === supId);
    const terms = sp ? (Number(sp.terms) || 0) : 0;
    const due = new Date((c.date || '') + 'T12:00:00');
    if (!isNaN(due)) due.setDate(due.getDate() + terms);
    out.push({
      id: 'clx:' + c.id + ':' + (e.id || ix), source: 'closing',
      supplierId: supId, supplierName: sp ? sp.name : (e.beneficiaryName || 'مورد'),
      branchId: c.branchId, branchName: c.branchName || '',
      invoiceNo: 'وردية ' + (c.date || ''), categoryName: e.categoryName || 'مشتريات',
      amount: amt, date: c.date, dueDate: isNaN(due) ? (c.date || '') : isoD(due),
      closingId: c.id
    });
  }));
  return out;
}

// الرقم التالي المتاح لنوع شريك — لتثبيته على البطاقة عند الإنشاء
function nextPartnerCode(parts, type) {
  let max = 0;
  parts.filter(p => p.type === type).forEach(p => { const m2 = /-(\d+)$/.exec(p.code || ''); if (m2) max = Math.max(max, +m2[1]); });
  return partnerCode(type, max + 1);
}

/* ============================================================
   م1 — المحاسبة الداخلية: دليل الحسابات ومحرك القيود التلقائية
   القيود تُشتق حسابيًا من العمليات المعتمدة نفسها (لا تُخزَّن نسخة
   ثانية) — أي تصحيح في المصدر ينعكس هنا فورًا وبأثر رجعي.
   المبالغ في هذه المرحلة إجمالية كما سُجّلت؛ فصل ضريبة القيمة
   المضافة يأتي في مرحلة الضريبة.
   ============================================================ */
const ACC_KIND = {
  asset: { ar: 'الأصول', nature: 'مدين' },
  liab: { ar: 'الخصوم', nature: 'دائن' },
  equity: { ar: 'حقوق الملكية', nature: 'دائن' },
  rev: { ar: 'الإيرادات', nature: 'دائن' },
  exp: { ar: 'المصروفات', nature: 'مدين' }
};
/* v15: نِسب التأمينات الاجتماعية حسب اللوائح — سعودي (قديم/جديد) وغير سعودي، مع سقف الأجر الخاضع.
   القيم افتراضات نظامية قابلة للتعديل من إعداد التأمينات؛ عند عدم تحديد الجنسية تُستخدم النِّسب العامة (توافق رجعي). */
const GOSI_DEF = { saudiOldEmp: 9.75, saudiOldEr: 11.75, saudiNewEmp: 10.75, saudiNewEr: 12.75, nonSaudiEmp: 0, nonSaudiEr: 2, ceiling: 45000, newFrom: '2024-07-03' };
function gosiRatesFor(e, gcfg) {
  gcfg = gcfg || {};
  const base0 = e.gosiWage != null ? Number(e.gosiWage) || 0 : Math.round(((e.baseSalary || 0) + (e.housingAllowance || 0)) * 100) / 100;
  const cap = Number(gcfg.ceiling != null ? gcfg.ceiling : GOSI_DEF.ceiling) || GOSI_DEF.ceiling;
  const pick = (k) => Number(gcfg[k] != null ? gcfg[k] : GOSI_DEF[k]) || 0;
  if (e.nationality === 'nonSaudi') return { emp: pick('nonSaudiEmp'), er: pick('nonSaudiEr'), base: Math.min(base0, cap), cat: 'غير سعودي' };
  if (e.nationality === 'saudi') {
    const isNew = (e.hireDate || '') >= (gcfg.newFrom || GOSI_DEF.newFrom);
    return isNew
      ? { emp: pick('saudiNewEmp'), er: pick('saudiNewEr'), base: Math.min(base0, cap), cat: 'سعودي (جديد)' }
      : { emp: pick('saudiOldEmp'), er: pick('saudiOldEr'), base: Math.min(base0, cap), cat: 'سعودي (قديم)' };
  }
  return { emp: Number(gcfg.empRate != null ? gcfg.empRate : GOSI_DEF.saudiOldEmp) || 0, er: Number(gcfg.erRate != null ? gcfg.erRate : GOSI_DEF.saudiOldEr) || 0, base: base0, cat: 'عام' };
}

function buildAccounting(org, ops) {
  // م3: الضريبة — تُفعّل صراحةً من شاشة الضريبة (org.taxCfg)، والمبالغ المسجلة تُعامل شاملةً للضريبة
  const tax = org.taxCfg || {};
  const taxOn = !!tax.enabled;
  const trate = taxOn ? (Number(tax.rate) || 15) / 100 : 0;
  const splitVat = (grossAmt) => {
    if (!taxOn || !grossAmt) return { net: grossAmt, vat: 0 };
    const net = Math.round(grossAmt / (1 + trate) * 100) / 100;
    return { net, vat: Math.round((grossAmt - net) * 100) / 100 };
  };
  const accounts = []; const accIx = {};
  const addAcc = (code, name, kind, meta) => {
    const a = { code, name, kind, debit: 0, credit: 0, ...(meta || {}) };
    accounts.push(a); accIx[code] = a; return a;
  };
  // — الأصول —  (النقد وما في حكمه مُعلَّم بـ cash:true لقائمة التدفقات النقدية)
  addAcc('1101', 'الخزينة الرئيسية', 'asset', { link: 'شاشة الخزينة والترحيل', cash: true });
  const cashCode = {};
  (org.branches || []).forEach((b, i) => {
    const code = '11' + String(11 + i);
    cashCode[b.id] = code;
    addAcc(code, 'صندوق ' + (b.name || 'فرع'), 'asset', { link: 'خزينة الفرع', cash: true });
  });
  addAcc('1201', 'البنك — الشبكة والمدفوعات البنكية (تجميعي)', 'asset', { link: 'يُطابَق من شاشة التسوية البنكية', cash: true });
  // v15.4: لكل فرع له حساب بنكي مُدخَل — بنك مستقل + حساب وسيط «تحصيلات تحت التحويل» (اختياري، لا يمسّ الفروع القديمة)
  // v15.21: يمكن ربط بنك الفرع بحساب قائم من الدليل (b.bankAcc: التجميعي 1201 أو حساب مخصّص «أصول»)
  //         بدل الحساب التلقائي — الربط الصريح ثابت لا يتأثر بترتيب الفروع، ويجوز اشتراك أكثر من فرع بحساب واحد.
  const branchHasBank = (b) => !!(b && ((b.bankName && String(b.bankName).trim()) || (b.bankIban && String(b.bankIban).trim()) || (b.bankAcc && String(b.bankAcc).trim())));
  const validBankAcc = (code) => !!code && (String(code) === '1201' || (org.customAccounts || []).some(ca => String(ca.code) === String(code)));
  const bankCode = {};   // بنك الفرع — تحصيلات الشبكة/التحويل بالفرع
  const clrCode = {};    // حساب وسيط الفرع — نقدٌ غادر الفرع ولم يصل الرئيسي بعد
  (org.branches || []).forEach((b, i) => {
    if (!branchHasBank(b)) return;
    if (validBankAcc(b.bankAcc)) {
      bankCode[b.id] = String(b.bankAcc);   // حساب من الدليل — يُسجَّل لاحقاً ضمن الحسابات المخصّصة (أو هو 1201 القائم)
    } else {
      const bk = '12' + String(11 + i);
      bankCode[b.id] = bk;
      addAcc(bk, 'بنك الفرع — ' + (b.name || 'فرع') + (b.bankName ? ' (' + b.bankName + ')' : ''), 'asset', { link: 'تحصيلات الشبكة والتحويل بالفرع', cash: true });
    }
    const cl = '19' + String(11 + i);
    clrCode[b.id] = cl;
    addAcc(cl, 'حساب وسيط — تحصيلات تحت التحويل — ' + (b.name || 'فرع'), 'asset', { link: 'نقدٌ غادر الفرع للرئيسي ولم يُستلَم بعد', cash: true });
  });
  // v16.7 — وسيط الشبكة تحت التسوية (اختياري، يسري من شهر يحدده المالك): مبيعات الشبكة
  // تُقيَّد في وسيط البنك بدل البنك مباشرة (البنك يسوّيها لاحقاً بعد خصم رسومه)، ثم
  // تُقفل في البنك من شاشة التسوية البنكية عند المطابقة مع الكشف. عائلة الرمز 18.
  const pcCfg = org.posClearing || {};
  const pcFrom = (pcCfg.enabled && pcCfg.from) ? String(pcCfg.from) : null;
  const pcOn = (d) => !!(pcFrom && d && String(d).slice(0, 7) >= pcFrom);
  if (pcFrom) {
    const usedBanks = new Set(['1201', ...Object.values(bankCode)]);
    usedBanks.forEach(bk => {
      const names = (org.branches || []).filter(b => bankCode[b.id] === bk).map(b => b.name).filter(Boolean);
      addAcc(posClrOf(bk), 'وسيط الشبكة تحت التسوية — ' + (bk === '1201' ? 'البنك التجميعي' : (names.join('، ') || ('بنك ' + bk))), 'asset',
        { link: 'شبكة لم يسوّها البنك بعد — تُقفل من شاشة التسوية البنكية', cash: true });
    });
  }
  // ذمم مبوّبة: حساب مستقل لكل تطبيق توصيل — يُدمج بعمولته المعرّفة في الإعدادات
  const appAcc = {};
  (org.deliveryApps || []).forEach((a, i) => {
    const code = '13' + String(i + 1).padStart(2, '0');
    appAcc[a.id] = code;
    addAcc(code, 'ذمم تطبيق — ' + (a.n || 'توصيل'), 'asset', { link: 'مبيعات ' + (a.n || 'التطبيق') + (a.c ? ' · عمولة ' + a.c + '%' : ' · بلا عمولة'), appId: a.id });
  });
  addAcc('1399', 'ذمم تطبيقات أخرى (غير معرّفة)', 'asset');
  addAcc('1380', 'ذمم العملاء — مبيعات آجلة', 'asset', { link: 'سجل فواتير المبيعات' });
  addAcc('1401', 'سلف الموظفين وعُهدهم', 'asset', { link: 'الرواتب والسلف' });
  addAcc('1501', 'ضريبة القيمة المضافة — مدخلات', 'asset', { link: 'مدخلات الفترة الجارية — تُقفل في 2302 مع الإقرار' });
  addAcc('1601', 'المخزون — بضاعة آخر المدة', 'asset', { link: 'رسملة المخزون — من شاشة المخزون' });
  // v30.5 — الجرد المستمر (org.purchaseCfg.perpetualFrom = 'YYYY-MM'): حسابات تكلفة الاستهلاك والهدر والفروقات
  const perpFrom = ((org.purchaseCfg || {}).perpetualFrom || '').slice(0, 7);
  const perpOn = (d) => !!perpFrom && !!d && String(d).slice(0, 7) >= perpFrom;
  if (perpFrom) {
    addAcc('5501', 'تكلفة مواد مستهلكة — صرف للتشغيل', 'exp', { link: 'صرف المستودعات للمطابخ بالمتوسط المرجّح (لكل فرع)' });
    addAcc('5502', 'هدر وتالف المخزون', 'exp', { link: 'حركات الهدر في المستودعات' });
    addAcc('5503', 'فروقات جرد وتحويلات المخزون', 'exp', { link: 'تسويات الجرد ونقص الاستلام' });
  }
  const whAccOf = (whId) => { if (!whOn(org)) return '1601'; const w = whOf(org).find(x => x.id === (whId || MAIN_WH)) || whOf(org).find(x => x.id === MAIN_WH); return (w && w.accCode) ? String(w.accCode) : '1601'; };
  // v29.9: حساب مخزون لكل مستودع + بضاعة في الطريق بين المستودعات
  if (whOn(org)) {
    whOf(org).forEach(w => { if (w.accCode && !accIx[w.accCode]) addAcc(String(w.accCode), 'المخزون — ' + (w.name || 'مستودع'), 'asset', { link: 'رصيد المستودع — رسملة المخزون', whId: w.id }); });
    addAcc('1609', 'بضاعة في الطريق بين المستودعات', 'asset', { link: 'تحويلات مصروفة لم تُستلم بعد' });
  }
  addAcc('1701', 'الأصول الثابتة', 'asset', { link: 'سجل الأصول' });
  addAcc('1791', 'مجمّع الإهلاك (يُطرح من الأصول)', 'asset', { link: 'قسط ثابت شهري تلقائي' });
  // — الخصوم —
  addAcc('2101', 'ذمم الموردين', 'liab', { link: 'دفتر الشركاء' });
  addAcc('2201', 'رواتب مستحقة', 'liab', { link: 'كشف الرواتب' });
  addAcc('2203', 'مخصص مكافأة نهاية الخدمة', 'liab', { link: 'الرواتب ← نهاية الخدمة' });
  addAcc('2204', 'مخصص الإجازات المستحقة', 'liab', { link: 'الإجازات ← المخصص' });
  addAcc('2202', 'تأمينات اجتماعية مستحقة (GOSI)', 'liab', { link: 'حصتا الموظف وصاحب العمل — تُحوّل للتأمينات' });
  addAcc('2301', 'ضريبة القيمة المضافة — مخرجات', 'liab', { link: 'مخرجات الفترة الجارية — تُقفل في 2302 مع الإقرار' });
  addAcc('2302', 'ضريبة القيمة المضافة المستحقة — صافي الإقرار', 'liab', { link: 'قيد إقفال الفترة الضريبية ← السداد للهيئة' });
  // — حقوق الملكية (تُفعَّل بالقيد الافتتاحي في المرحلة التالية) —
  addAcc('3101', 'رأس المال والأرصدة الافتتاحية', 'equity', { link: 'الأرصدة الافتتاحية — من شاشة المحاسبة' });
  addAcc('3201', 'الأرباح المبقاة (المدوّرة)', 'equity', { link: 'قيد إقفال السنة المالية — من شاشة المحاسبة' });
  // — الإيرادات —
  addAcc('4101', 'المبيعات (إجمالية)', 'rev', { link: 'إغلاقات الورديات المعتمدة' });
  addAcc('4102', 'مبيعات بالفواتير (عملاء ومؤسسات)', 'rev', { link: 'سجل فواتير المبيعات — غير المسجّلة في الإغلاقات' });
  addAcc('4201', 'أرباح بيع/استبعاد الأصول', 'rev', { link: 'سجل الأصول — عند البيع بأعلى من القيمة الدفترية' });
  // — المصروفات —
  addAcc('5201', 'الرواتب والأجور (كشف الرواتب)', 'exp', { link: 'ترحيل الاستحقاق الشهري' });
  addAcc('5203', 'مصروف مكافأة نهاية الخدمة', 'exp', { link: 'ترحيل المخصص الشهري' });
  addAcc('5204', 'مصروف الإجازات المستحقة', 'exp', { link: 'ترحيل مخصص الإجازات الشهري' });
  addAcc('5202', 'التأمينات الاجتماعية — حصة صاحب العمل', 'exp', { link: 'كشف الرواتب — عند تفعيل التأمينات' });
  addAcc('5301', 'عمولات تطبيقات التوصيل', 'exp', { link: 'نِسَب العمولة من إعدادات التطبيقات' });
  addAcc('5302', 'خصومات وغرامات تطبيقات التوصيل', 'exp', { link: 'تسوية كشوف التطبيقات — فروق الإيداع' });
  addAcc('5401', 'عجز/فائض الصندوق', 'exp', { link: 'فرق الجرد النقدي في الإغلاق اليومي (المعدود − المتوقّع)' });
  addAcc('5701', 'مصروف الإهلاك', 'exp', { link: 'سجل الأصول — تلقائي' });
  addAcc('5801', 'خسائر بيع/استبعاد الأصول', 'exp', { link: 'سجل الأصول — عند البيع بأقل من القيمة الدفترية' });
  addAcc('5901', 'مصروفات الخزينة الرئيسية (أوامر الصرف)', 'exp', { link: 'شاشة الخزينة' });
  const catAcc = {};
  (org.expenseCats || []).forEach((c, i) => {
    // «سلف ومسحوبات» طبيعتها ذمة على الموظف لا مصروف — تُوجَّه لحساب السلف
    if (/سلف|مسحوبات/.test(c.n || '')) { catAcc[c.id] = '1401'; return; }
    const code = '51' + String(i + 1).padStart(2, '0');
    catAcc[c.id] = code;
    addAcc(code, c.n || 'مصروف', 'exp', { link: 'تصنيفات مصروفات الوردية' });
  });
  addAcc('5198', 'مشتريات فواتير التوريد الآجلة', 'exp', { link: 'شاشة الموردين' });
  addAcc('5199', 'مصروفات وردية غير مصنّفة', 'exp');
  addAcc('5150', 'بضاعة آخر المدة (تُخفّض تكلفة المشتريات)', 'exp', { link: 'رسملة المخزون — الطريقة الدورية' });
  // v15.3: الحسابات المخصّصة التي يضيفها المستخدم من دليل الحسابات (إضافة/تعديل/حذف)
  (org.customAccounts || []).forEach(ca => {
    if (!(ca && ca.code && !accIx[ca.code])) return;
    // v15.21: حساب مخصّص مربوط كبنك فرع يُعامل كنقد وما في حكمه (يدخل مؤشر «النقد الآن»)
    const isBranchBank = Object.values(bankCode).includes(String(ca.code));
    // v28.2: حساب مخصّص موسوم cash (بنوك/وسطاء نقد مستوردة من ميزان) يُعامل كنقد وما في حكمه
    addAcc(String(ca.code), ca.name || String(ca.code), ca.kind || 'exp', { link: isBranchBank ? 'بنك فرع (مربوط من كرت الفرع)' : (ca.mizanBatch ? 'حساب مستورد من ميزان' : 'حساب مخصّص'), custom: true, ...((isBranchBank || ca.cash) ? { cash: true } : {}) });
  });

  // ===== محرك القيود =====
  const entries = [];
  const L = (code, debit, credit) => ({ code, name: (accIx[code] || { name: code }).name, debit: debit || 0, credit: credit || 0 });
  const push = (e) => {
    e.debit = sum(e.lines, l => l.debit); e.credit = sum(e.lines, l => l.credit);
    // v15.12: سماح توازن = هللة كاملة (0.01) بدل نصف هللة (0.005) — نصف الهللة هو نفسه أسوأ خطأ تقريب،
    //         فكان قد يُظهر قيدًا سليمًا كأنه غير متوازن عند مدخلٍ بكسور أدق من الهللة. لا يغيّر أي قيد فعلي.
    e.balanced = Math.abs(e.debit - e.credit) < 0.01;
    entries.push(e);
  };
  const pmToAcc = (m, bCode, bkCode) => m === 'cash' ? bCode : (bkCode || '1201'); // شبكة/تحويل/شيك → بنك الفرع (إن وُجد) أو البنك التجميعي
  const supNameOf = (pm) => pm.supplierName
    || ((org.suppliers || []).find(s => s.id === pm.supplierId) || {}).name || '';

  const counted = (ops.closings || []).filter(countedClosing);
  counted.forEach(c => {
    const bCode = cashCode[c.branchId] || '1101';
    const bkCode = bankCode[c.branchId] || '1201'; // v15.4: بنك الفرع (إن وُجد) وإلا البنك التجميعي
    // 1) إيراد الوردية: نقدي/شبكة ← ثم سطر لكل تطبيق بذمّته وعمولته المسجّلة على الوردية نفسها
    const cash = c.cashSales || 0, card = c.cardSales || 0, bankT = c.bankTransferSales || 0;
    const appRows = (c.deliverySales || []).filter(s => (s.amount || 0) > 0);
    const appsGross = sum(appRows, s => s.amount);
    const tot = cash + card + bankT + appsGross;
    if (tot > 0) {
      const lines = [];
      if (cash) lines.push(L(bCode, cash, 0));
      // v16.7: مع تفعيل وسيط الشبكة، الشبكة تدخل الوسيط (البنك يسوّيها لاحقاً) — التحويل البنكي المباشر يبقى للبنك
      if (card) lines.push(L(pcOn(c.date) ? posClrOf(bkCode) : bkCode, card, 0));
      if (bankT) lines.push(L(bkCode, bankT, 0)); // v15: تحصيل التحويل البنكي المباشر في البنك (v15.4: بنك الفرع إن وُجد)
      appRows.forEach(s => {
        const gross = s.amount || 0;
        const app = (org.deliveryApps || []).find(a => a.id === s.appId);
        const rate = s.commissionPercentage != null ? Number(s.commissionPercentage) || 0 : (app ? Number(app.c) || 0 : 0);
        const comm = Math.round(gross * rate) / 100;           // gross × rate% بدقة قرشين
        const net = Math.round((gross - comm) * 100) / 100;
        const code = appAcc[s.appId] || '1399';
        if (net) lines.push(L(code, net, 0));
        if (comm) lines.push(L('5301', comm, 0));
      });
      const sv = splitVat(tot);
      lines.push(L('4101', 0, sv.net));
      if (sv.vat) lines.push(L('2301', 0, sv.vat));
      push({ id: 'rev:' + c.id, date: c.date, branchId: c.branchId, title: 'إيراد وردية — ' + (c.branchName || ''), src: 'إغلاق وردية', ref: c.id, lines,
        vat: sv.vat ? { out: sv.vat, inn: 0, netSales: sv.net, netPurch: 0 } : null });
    }
    // v15) ترحيل فرق جرد الصندوق (عجز/فائض) — يجعل رصيد الخزينة الدفتري يطابق النقد المعدود فعلًا
    const varc = Math.round((c.variance || 0) * 100) / 100;
    if (varc) {
      push({ id: 'cashvar:' + c.id, date: c.date, branchId: c.branchId,
        title: (varc < 0 ? 'عجز صندوق — ' : 'فائض صندوق — ') + (c.branchName || ''), src: 'فرق جرد الصندوق', ref: c.id,
        lines: varc < 0 ? [L('5401', -varc, 0), L(bCode, 0, -varc)] : [L(bCode, varc, 0), L('5401', 0, varc)] });
    }
    // 2) مصروفات الوردية: نقدًا من الصندوق، بنكيًا من البنك، وآجلًا على ذمم الموردين
    (c.expenses || []).forEach((e, ix) => {
      const amt = e.amount || 0; if (!amt) return;
      const expCode = catAcc[e.categoryId] || '5199';
      const credCode = e.paymentMethod === 'deferred' ? '2101' : pmToAcc(e.paymentMethod, bCode, bkCode);
      // السلف ليست مصروفًا خاضعًا — لا فصل ضريبي على حساب 1401
      const tx = (e.isTaxable && expCode !== '1401') ? splitVat(amt) : { net: amt, vat: 0 };
      push({
        id: 'exp:' + c.id + ':' + (e.id || ix), date: c.date, branchId: c.branchId,
        title: (e.categoryName || 'مصروف') + (e.paymentMethod === 'deferred' ? ' (آجل — على الحساب)' : '') + ' — ' + (c.branchName || ''),
        src: 'مصروف وردية', ref: c.id,
        lines: tx.vat
          ? [L(expCode, tx.net, 0), L('1501', tx.vat, 0), L(credCode, 0, amt)]
          : [L(expCode, amt, 0), L(credCode, 0, amt)],
        vat: tx.vat ? { out: 0, inn: tx.vat, netSales: 0, netPurch: tx.net } : null
      });
    });
    // 3) سدادات الموردين داخل الوردية — قد تتوزع على أكثر من طريقة دفع
    (c.supplierPayments || []).forEach((pm, ix) => {
      const s = paySplits(pm); const t2 = s.cash + s.card + s.transfer + s.other;
      if (t2 <= 0) return;
      const lines = [L('2101', t2, 0)];
      if (s.cash) lines.push(L(bCode, 0, s.cash));
      const bank = s.card + s.transfer + s.other;
      if (bank) lines.push(L(bkCode, 0, bank));
      const nm = supNameOf(pm);
      push({
        id: 'spay:' + c.id + ':' + (pm.id || ix), date: c.date, branchId: c.branchId,
        title: 'سداد مورد' + (nm ? ' — ' + nm : '') + ' (' + (c.branchName || '') + ')',
        src: 'سداد مورد بالوردية', ref: pm.reference || pm.invoiceId || c.id, lines
      });
    });
  });

  // 4) توريد النقد من الفرع للخزينة الرئيسية
  //    فرعٌ بحساب بنكي مُدخَل (v15.4): يمرّ عبر حساب وسيط — «تحت التحويل» عند الإرسال ← «الخزينة الرئيسية» عند الاستلام،
  //    فيظهر النقد في الطريق. وفرعٌ بلا حساب بنكي: سلوك سابق تمامًا (يُرحَّل عند الاستلام مباشرةً).
  (ops.transfers || []).forEach(t => {
    if (!(t.amount > 0)) return;
    const src = cashCode[t.branchId] || '1101';
    const clr = clrCode[t.branchId];
    if (clr) {
      if (t.status !== 'pending' && t.status !== 'received') return; // مرفوض/مُعاد: النقد يبقى بالفرع — لا قيد
      push({
        id: 'trs:' + t.id, date: t.date, branchId: t.branchId, title: 'توريد نقدي — تحت التحويل — ' + (t.branchName || ''),
        src: 'تحويل خزينة', ref: t.referenceNo || t.id,
        lines: [L(clr, t.amount, 0), L(src, 0, t.amount)]
      });
      if (t.status === 'received') push({
        id: 'trr:' + t.id, date: dayOf(t.receivedAt || t.date), branchId: t.branchId, title: 'استلام التوريد بالخزينة الرئيسية — ' + (t.branchName || ''),
        src: 'تحويل خزينة', ref: t.referenceNo || t.id,
        lines: [L('1101', t.amount, 0), L(clr, 0, t.amount)]
      });
    } else if (t.status === 'received') {
      push({
        id: 'tr:' + t.id, date: t.date, branchId: t.branchId, title: 'توريد نقدي للخزينة الرئيسية — ' + (t.branchName || ''),
        src: 'تحويل خزينة', ref: t.referenceNo || t.id,
        lines: [L('1101', t.amount, 0), L(src, 0, t.amount)]
      });
    }
  });
  // 5) أوامر الصرف من الخزينة الرئيسية
  (ops.disbursements || []).forEach(x => {
    if (!(x.amount > 0)) return;
    push({
      id: 'dis:' + x.id, date: x.date,
      title: 'أمر صرف — ' + (x.category || 'منصرف') + (x.beneficiary ? ' · ' + x.beneficiary : ''),
      src: 'الخزينة الرئيسية', ref: x.reference || x.id,
      lines: [L('5901', x.amount, 0), L('1101', 0, x.amount)]
    });
  });
  // 6) فواتير التوريد الآجلة وسداداتها المركزية (سدادات الفروع تدخل من قيود الورديات)
  (ops.invoices || []).forEach(i => {
    const d = (i.date || i.createdAt || i.dueDate || '').slice(0, 10);
    if (i.amount > 0) {
      // فصل ضريبة المدخلات للفواتير الموسومة «خاضعة» فقط (الحقل الجديد في م4) — القديمة بلا وسم تبقى إجمالية
      // v28.2: فواتير مستوردة تحمل ضريبتها الفعلية (vatAmt) وحساب مصروفها (accCode) — القديمة بلا الحقلين كما هي
      const ti = (typeof i.vatAmt === 'number')
        ? { net: Math.round((i.amount - i.vatAmt) * 100) / 100, vat: Math.round(i.vatAmt * 100) / 100 }
        : (i.taxable === true) ? splitVat(i.amount) : { net: i.amount, vat: 0 };
      const exC = (i.accCode && accIx[i.accCode]) ? String(i.accCode) : '5198';
      // v30.5: فاتورة استلام أمر شراء في فترة الجرد المستمر — صافي البنود المخزنية يُرسمل في حساب المستودع لا المصروف
      const stockNet = (perpOn(d) && Array.isArray(i.lines)) ? Math.min(ti.net, Math.round(i.lines.filter(l => l.stock).reduce((s2, l) => s2 + (Number(l.net) || 0), 0) * 100) / 100) : 0;
      const restNet = Math.round((ti.net - stockNet) * 100) / 100;
      const debit = [...(stockNet > 0 ? [L(whAccOf(i.whId), stockNet, 0)] : []), ...(Math.abs(restNet) > 0.004 ? [L(exC, restNet, 0)] : [])];
      push({
        id: 'inv:' + i.id, date: d, branchId: i.branchId, title: 'فاتورة توريد آجلة — ' + (i.supplierName || 'مورد') + (stockNet > 0 ? ' (مخزون)' : ''),
        src: 'فاتورة مورد', ref: i.invoiceNo || i.id,
        lines: ti.vat
          ? [...debit, L('1501', ti.vat, 0), L('2101', 0, i.amount)]
          : [...debit, L('2101', 0, i.amount)],
        vat: ti.vat ? { out: 0, inn: ti.vat, netSales: 0, netPurch: ti.net } : null
      });
    } else if (i.amount < 0 && (i.mizanId || i.creditNote)) {
      // v28.2: إشعار دائن من مورد (مرتجع) مستورد من ميزان — يعكس قيد الفاتورة: يخفض الذمة والمصروف وضريبة المدخلات
      const a = Math.round(-i.amount * 100) / 100;
      const v = Math.round(Math.abs(typeof i.vatAmt === 'number' ? i.vatAmt : 0) * 100) / 100;
      const n = Math.round((a - v) * 100) / 100;
      const exC = (i.accCode && accIx[i.accCode]) ? String(i.accCode) : '5198';
      // v30.9: مرتجع أصناف مخزنية في فترة الجرد المستمر — يُخفَّض حساب المستودع بتكلفة الشراء بدل المصروف
      const stockCr = (perpOn(d) && Array.isArray(i.lines)) ? Math.min(n, Math.round(i.lines.filter(l => l.stock).reduce((s2, l) => s2 + Math.abs(Number(l.net) || 0), 0) * 100) / 100) : 0;
      const restCr = Math.round((n - stockCr) * 100) / 100;
      push({
        id: 'inv:' + i.id, date: d, branchId: i.branchId, title: (i.creditNote ? 'مرتجع مشتريات — إشعار دائن ' : 'إشعار دائن من مورد — ') + (i.supplierName || 'مورد'),
        src: 'فاتورة مورد', ref: i.invoiceNo || i.id,
        lines: [L('2101', a, 0), ...(stockCr > 0 ? [L(whAccOf(i.whId), 0, stockCr)] : []), ...(restCr > 0.004 ? [L(exC, 0, restCr)] : []), ...(v ? [L('1501', 0, v)] : [])],
        vat: v ? { out: 0, inn: -v, netSales: 0, netPurch: -n } : null
      });
    }
    // v29.4: قيد لكل دفعة بتاريخها ومصدرها (الدفعة القديمة المجمّعة تبقى بمعرّفها السابق invp:)
    invPayments(i).forEach(p => push({
      id: p.id === 'legacy' ? 'invp:' + i.id : 'invp:' + i.id + ':' + p.id, date: p.date,
      title: 'سداد مركزي لفاتورة توريد — ' + (i.supplierName || 'مورد') + (p.fund === '1101' ? ' (نقداً من الخزينة)' : ''),
      src: 'سداد مركزي', ref: i.invoiceNo || i.id,
      lines: [L('2101', p.amount, 0), L((p.fund && accIx[p.fund]) ? p.fund : '1201', 0, p.amount)]   // v15.19/v15.20: المصدر المختار (خزينة أو أي بنك — تجميعي/فرع)
    }));
  });
  // 6مكرر) السداد المركزي لفواتير الورديات المشتقة (v8.1): مدين ذمم الموردين / دائن البنك
  //         — قيد الفاتورة نفسها هو قيد المصروف الآجل في الوردية، فلا يتكرر هنا
  (ops.closingInvPays || []).forEach(pmt => {
    if (!(pmt.amount > 0)) return;
    const spn = ((org.suppliers || []).find(x => x.id === pmt.supplierId) || {}).name || 'مورد';
    push({
      id: 'cip:' + pmt.id, date: (pmt.date || '').slice(0, 10),
      title: (pmt.mizanId ? 'سداد مورد من البنك — ' + spn + (pmt.payType ? ' (' + pmt.payType + ')' : '') : 'سداد مركزي لمشتريات وردية — ' + spn + (pmt.fund === '1101' ? ' (نقداً من الخزينة)' : '')),
      src: 'سداد مركزي', ref: pmt.refId || pmt.id,
      lines: [L('2101', pmt.amount, 0), L((pmt.fund && accIx[pmt.fund]) ? pmt.fund : '1201', 0, pmt.amount)]   // v15.19/v15.20: المصدر المختار (خزينة أو أي بنك)
    });
  });

  // 6-ب) v31.0 فواتير المبيعات: الآجلة على ذمم العملاء، والنقدية على الصندوق/البنك. المسجّلة في إغلاق وردية لا تُقيَّد مرة ثانية.
  const siById = {}; (ops.salesInvoices || []).forEach(x => { siById[x.id] = x; });
  (ops.salesInvoices || []).forEach(x => {
    const fundOf = (f) => (f && accIx[f]) ? f : '1201';
    if (!x.inClosing && x.total > 0) {
      const orig = x.kind === 'credit' ? (siById[x.refId] || {}) : x;
      const side = (orig.terms === 'credit' && x.kind !== 'credit') || (x.kind === 'credit' && x.terms === 'credit') ? '1380' : fundOf(x.fund);
      const net = Math.round((x.net || 0) * 100) / 100, vt = Math.round((x.vat || 0) * 100) / 100;
      const lines = x.kind === 'credit'
        ? [L('4102', net, 0), ...(vt ? [L('2301', vt, 0)] : []), L(side, 0, x.total)]
        : [L(side, x.total, 0), L('4102', 0, net), ...(vt ? [L('2301', 0, vt)] : [])];
      push({ id: 'si:' + x.id, date: x.date, ...(x.branchId ? { branchId: x.branchId } : {}), title: (x.kind === 'credit' ? 'إشعار دائن مبيعات ' + x.no + ' (عن ' + (orig.no || '') + ')' : (x.terms === 'credit' ? 'فاتورة مبيعات آجلة ' : 'فاتورة مبيعات نقدية ') + x.no) + ' — ' + ((x.buyer || {}).name || 'عميل'),
        src: 'فواتير المبيعات', ref: x.no, lines, vat: vt ? (x.kind === 'credit' ? { out: -vt, inn: 0, netSales: -net, netPurch: 0 } : { out: vt, inn: 0, netSales: net, netPurch: 0 }) : null });
    }
    (x.receipts || []).forEach(r => { const a = Math.round((Number(r.amount) || 0) * 100) / 100; if (!(a > 0)) return;
      push({ id: 'sir:' + r.id, date: r.date, ...(x.branchId ? { branchId: x.branchId } : {}), title: 'تحصيل من عميل — ' + ((x.buyer || {}).name || '') + ' عن ' + x.no, src: 'فواتير المبيعات', ref: x.no, lines: [L(fundOf(r.fund), a, 0), L('1380', 0, a)] }); });
  });

  // 7) الرواتب: الاستحقاق كما رُحِّل، والصرف كما سُجِّل، وتسوية فرق السلف والخصومات
  const led = ops.ledgerEntries || [];
  // 7-أ) v30.8 مخصص نهاية الخدمة: افتتاحي (أرباح مبقاة) ← ترحيل شهري (مصروف) ← صرف المخالصة (استخدام المخصص)
  const eosBal = {};
  led.filter(x => x.kind === 'eos_open' || x.kind === 'eos_accrual').sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(x => {
    const byBr = {};
    (x.lines || []).forEach(l => { const v = Number(l.amt) || 0; eosBal[l.empId] = (eosBal[l.empId] || 0) + v; byBr[l.branchId || ''] = (byBr[l.branchId || ''] || 0) + v; });
    if (x.kind === 'eos_open' && x.noPost) return;
    Object.entries(byBr).forEach(([br, v]) => { v = Math.round(v * 100) / 100; if (Math.abs(v) < 0.005) return;
      const dc = x.kind === 'eos_open' ? '3201' : '5203';
      push({ id: 'eos:' + x.id + ':' + (br || 'hq'), date: x.date, ...(br ? { branchId: br } : {}), title: (x.kind === 'eos_open' ? 'مخصص نهاية الخدمة المتراكم حتى ' + (x.asOf || x.date) : x.final ? 'تسوية مخصص نهاية الخدمة حتى تاريخ انتهاء خدمة ' + (((x.lines || [])[0] || {}).name || '') : 'مخصص نهاية الخدمة — شهر ' + x.month),
        src: 'نهاية الخدمة', ref: 'eos-' + (x.month || ''), lines: v > 0 ? [L(dc, v, 0), L('2203', 0, v)] : [L('2203', -v, 0), L(dc, 0, -v)] }); });
  });
  // 7-ب) v31.2 مخصص الإجازات: افتتاحي (أرباح مبقاة) ثم ترحيل شهري بالفرق (يرتفع بالاستحقاق وينخفض بالأخذ)
  led.filter(x => x.kind === 'lv_open' || x.kind === 'lv_accrual').forEach(x => {
    if (x.kind === 'lv_open' && x.noPost) return;
    const byBr = {}; (x.lines || []).forEach(l => { byBr[l.branchId || ''] = (byBr[l.branchId || ''] || 0) + (Number(l.amt) || 0); });
    Object.entries(byBr).forEach(([br, v]) => { v = Math.round(v * 100) / 100; if (Math.abs(v) < 0.005) return; const dc = x.kind === 'lv_open' ? '3201' : '5204';
      push({ id: 'lv:' + x.id + ':' + (br || 'hq'), date: x.date, ...(br ? { branchId: br } : {}), title: x.kind === 'lv_open' ? 'مخصص الإجازات المتراكم حتى ' + (x.asOf || x.date) : 'مخصص الإجازات — شهر ' + x.month,
        src: 'الإجازات', ref: 'lv-' + (x.month || ''), lines: v > 0 ? [L(dc, v, 0), L('2204', 0, v)] : [L('2204', -v, 0), L(dc, 0, -v)] }); });
  });
  led.filter(x => x.kind === 'eos_pay').forEach(x => {
    const rel = Math.round((eosBal[x.empId] || 0) * 100) / 100, paid = Math.round((Number(x.entitled) || 0) * 100) / 100, lv = Math.round((Number(x.leavePay) || 0) * 100) / 100;
    const fund = (x.fund && accIx[x.fund]) ? x.fund : '1201';
    const lines = [];
    if (rel > 0) lines.push(L('2203', rel, 0));
    if (paid > rel + 0.004) lines.push(L('5203', Math.round((paid - rel) * 100) / 100, 0));
    if (rel > paid + 0.004) lines.push(L('5203', 0, Math.round((rel - paid) * 100) / 100));
    if (lv > 0) lines.push(L('5201', lv, 0));
    if (paid + lv > 0) lines.push(L(fund, 0, Math.round((paid + lv) * 100) / 100));
    if (lines.length >= 2) push({ id: 'eos-pay:' + x.id, date: x.date, ...(x.branchId ? { branchId: x.branchId } : {}), title: 'صرف مخالصة نهاية الخدمة — ' + (x.name || '') + (rel > paid + 0.004 ? ' (رد الفائض من المخصص)' : ''), src: 'نهاية الخدمة', ref: 'eos-pay', lines });
  });
  const salMonths = [...new Set(led.filter(x => x.kind === 'salary_accrual' || x.kind === 'salary_payout').map(x => x.month))].sort();
  salMonths.forEach(m => {
    const acc = sum(led.filter(x => x.kind === 'salary_accrual' && x.month === m), x => x.credit || 0);
    const pay = sum(led.filter(x => x.kind === 'salary_payout' && x.month === m), x => x.debit || 0);
    if (acc > 0) push({
      id: 'sal-acc:' + m, date: m + '-28', title: 'استحقاق رواتب شهر ' + m,
      src: 'كشف الرواتب', ref: 'payroll-' + m,
      lines: [L('5201', acc, 0), L('2201', 0, acc)]
    });
    if (pay > 0) {
      const payoutEntries = led.filter(x => x.kind === 'salary_payout' && x.month === m);
      const payDate = ((payoutEntries[0] || {}).date || (m + '-28')).slice(0, 10);
      const gosiEmp = Math.round(sum(payoutEntries, x => x.gosi || 0) * 100) / 100;   // حصة الموظف المستقطعة (v11.0)
      const gosiEr = Math.round(sum(payoutEntries, x => x.gosiEr || 0) * 100) / 100;  // حصة صاحب العمل
      // v15.19/v15.20: مصدر صرف الرواتب يُحترم كما سُجّل (fund على قيود الصرف): خزينة رئيسية
      // أو أي بنك (تجميعي/بنك فرع). قيود قديمة بلا fund تبقى على البنك التجميعي (سلوكها السابق).
      const payByFund = {};
      payoutEntries.forEach(x => {
        const fc = (x.fund && accIx[x.fund]) ? x.fund : '1201';
        payByFund[fc] = Math.round(((payByFund[fc] || 0) + (x.debit || 0)) * 100) / 100;
      });
      const payCashT = payByFund['1101'] || 0;
      push({
        id: 'sal-pay:' + m, date: payDate, title: 'صرف رواتب شهر ' + m + ' (صافي بعد السلف والخصوم' + (gosiEmp > 0.004 ? ' والتأمينات' : '') + ')' + (payCashT > 0.004 ? (pay - payCashT > 0.004 ? ' — بنك + خزينة' : ' — نقداً من الخزينة') : ''),
        src: 'كشف الرواتب', ref: 'payout-' + m,
        lines: [L('2201', pay, 0), ...Object.entries(payByFund).filter(([, v]) => v > 0.004).map(([c, v]) => L(c, 0, v))]
      });
      const diff = Math.round((acc - pay) * 100) / 100;   // = السلف + الخصومات + حصة الموظف من التأمينات
      if (diff > 0.004) {
        const ads = (ops.advances || []).filter(a => a.month === m);
        const draws = sum(ads.filter(a => ['advance', 'salary_draw'].includes(a.type)), a => a.amount);
        const cd = Math.min(draws, diff);                             // سلف مُستردّة ← 1401
        const gd = Math.min(gosiEmp, Math.round((diff - cd) * 100) / 100);  // حصة الموظف من التأمينات ← 2202
        const cc = Math.round((diff - cd - gd) * 100) / 100;          // خصومات/جزاءات ← عكس 5201
        const lines = [L('2201', diff, 0)];
        if (cd > 0) lines.push(L('1401', 0, cd));
        if (gd > 0) lines.push(L('2202', 0, gd));
        if (cc > 0) lines.push(L('5201', 0, cc));
        push({
          id: 'sal-set:' + m, date: payDate, title: 'تسوية سلف وخصومات' + (gd > 0.004 ? ' وتأمينات' : '') + ' رواتب ' + m,
          src: 'كشف الرواتب', ref: 'payroll-' + m, lines
        });
      }
      // حصة صاحب العمل من التأمينات: مصروف إضافي (5202) والتزام مستحق (2202)
      if (gosiEr > 0.004) push({
        id: 'gosi-er:' + m, date: payDate, title: 'تأمينات اجتماعية — حصة صاحب العمل ' + m,
        src: 'كشف الرواتب', ref: 'gosi-' + m, lines: [L('5202', gosiEr, 0), L('2202', 0, gosiEr)]
      });
    }
  });
  // 8) صرف السلف والمسحوبات (عهدة على الموظف حتى استقطاعها من الراتب)
  // v15.19: نحترم «طريقة الصرف» المسجّلة على السلفة نفسها — كانت كل السلف تُخصم من البنك
  // خطأً مهما كانت الطريقة المختارة (أحد أسباب ظهور رصيد البنك سالبًا):
  // «نقداً من صندوق الفرع» ← صندوق فرع الموظف · «عهدة نثرية» ← الخزينة الرئيسية ·
  // «تحويل بنكي» ← البنك. سجل قديم بلا طريقة محفوظة يبقى على البنك (سلوكه السابق حرفيًا).
  (ops.advances || []).filter(a => ['advance', 'salary_draw'].includes(a.type)).forEach(a => {
    if (!(a.amount > 0)) return;
    const advSrc = a.paymentMethod === 'cash' ? (cashCode[a.branchId] || '1101')
      : a.paymentMethod === 'petty_cash' ? '1101'
        : '1201';
    push({
      id: 'adv:' + a.id, date: (a.date || '').slice(0, 10) || (a.month ? a.month + '-15' : ''),
      title: 'سلفة/سحب على الراتب' + (a.reason ? ' — ' + a.reason : ''),
      src: 'الرواتب والسلف', ref: a.month || a.id,
      lines: [L('1401', a.amount, 0), L(advSrc, 0, a.amount)]
    });
  });

  // 9) الأصول الثابتة: قيد شراء بمصدر تمويل صريح + إهلاك قسط ثابت شهري (يُشتق كاملًا — تعديل الأصل يعيد الاشتقاق)
  const ymAdd = (ym, k) => { const pr = ym.split('-').map(Number); const t = pr[0] * 12 + (pr[1] - 1) + k; return String(Math.floor(t / 12)).padStart(4, '0') + '-' + String((t % 12) + 1).padStart(2, '0'); };
  const nowYm = today().slice(0, 7);
  const FUND_AR = { '1101': 'من الخزينة الرئيسية', '1201': 'من البنك', '3101': 'قيد افتتاحي (رصيد سابق)', none: '' };
  const depByMonth = {};
  const assetRows = (org.assets || []).map(a => {
    const cost = Number(a.cost) || 0;
    const nM = Math.max(1, Math.round((Number(a.lifeYears) || 0) * 12));
    const funded = cost > 0 && a.fund && a.fund !== 'none' && accIx[a.fund];
    if (funded) push({
      id: 'ast:' + a.id, date: (a.buyDate || '').slice(0, 10), title: 'شراء أصل ثابت — ' + (a.name || '') + ' (' + (FUND_AR[a.fund] || '') + ')',
      src: 'الأصول الثابتة', ref: a.id,
      lines: [L('1701', cost, 0), L(a.fund, 0, cost)]
    });
    const dispYm = a.disposedDate ? a.disposedDate.slice(0, 7) : '';   // يتوقف الإهلاك عند شهر الاستبعاد
    let accum = 0, monthsDone = 0;
    // v15.11: الإهلاك التلقائي فقط للأصول المرسملة بقيد شراء (funded). أصل «بلا قيد شراء» (none) يسوّيه المحاسب يدويًا — فلا إهلاك تلقائي يخلق مجمّع إهلاك بلا أصل.
    if (funded && (Number(a.lifeYears) || 0) > 0 && a.buyDate) {
      const base = Math.floor(cost / nM * 100) / 100;
      const start = ymAdd(a.buyDate.slice(0, 7), 1);       // الإهلاك من الشهر التالي للشراء
      for (let k = 0; k < nM; k++) {
        const ym = ymAdd(start, k);
        if (ym > nowYm) break;
        if (dispYm && ym >= dispYm) break;                 // لا إهلاك في شهر الاستبعاد وما بعده
        const amt = k === nM - 1 ? Math.round((cost - base * (nM - 1)) * 100) / 100 : base;
        depByMonth[ym] = Math.round(((depByMonth[ym] || 0) + amt) * 100) / 100;
        accum = Math.round((accum + amt) * 100) / 100; monthsDone++;
      }
    }
    const book = Math.round((cost - accum) * 100) / 100;
    // بيع/استبعاد الأصل: إخراجه بالتكلفة + إقفال مجمّع إهلاكه، والفرق مع سعر البيع ربح (4201) أو خسارة (5801)
    // القيد متوازن دائمًا: مدين (المقبوض + المجمّع + خسارة) = دائن (التكلفة + ربح)
    let disposed = false, gain = 0, salePrice = 0;
    if (a.disposedDate && funded) {
      disposed = true;
      salePrice = Number(a.salePrice) || 0;
      gain = Math.round((salePrice - book) * 100) / 100;
      const saleFund = a.saleFund && accIx[a.saleFund] ? a.saleFund : '1201';
      const lines = [];
      if (salePrice > 0) lines.push(L(saleFund, salePrice, 0));   // المقبوض من البيع (بنك/خزينة)
      if (accum > 0) lines.push(L('1791', accum, 0));            // إقفال مجمّع الإهلاك
      lines.push(L('1701', 0, cost));                           // إخراج الأصل بتكلفته
      if (gain > 0.005) lines.push(L('4201', 0, gain));          // ربح بيع
      else if (gain < -0.005) lines.push(L('5801', -gain, 0));   // خسارة بيع/استبعاد
      push({
        id: 'disp:' + a.id, date: a.disposedDate.slice(0, 10),
        title: 'بيع/استبعاد أصل — ' + (a.name || '') + (gain > 0.005 ? ' (ربح ' + money(gain) + ')' : gain < -0.005 ? ' (خسارة ' + money(-gain) + ')' : ' (بلا ربح/خسارة)'),
        src: 'الأصول الثابتة', ref: a.id, lines
      });
    }
    return { ...a, cost, nM, monthly: Math.floor(cost / nM * 100) / 100, accum, book, monthsDone, done: monthsDone >= nM, disposed, gain, salePrice };
  });
  Object.keys(depByMonth).sort().forEach(ym => {
    if (depByMonth[ym] <= 0) return;
    push({
      id: 'dep:' + ym, date: ym + '-28', title: 'إهلاك شهر ' + ym + ' (قسط ثابت — كل الأصول)',
      src: 'الأصول الثابتة', ref: 'dep-' + ym,
      lines: [L('5701', depByMonth[ym], 0), L('1791', 0, depByMonth[ym])]
    });
  });

  // 9) الأرصدة الافتتاحية (رصيد ما قبل المنصة) — قيد افتتاحي واحد، وحساب رأس المال (3101) يوازنه تلقائيًا
  //     رأس المال المحسوب = مجموع الموجودات − مجموع المطلوبات (معادلة الميزانية)
  const ob = org.openingBalances;
  if (ob && ob.enabled !== false && (ob.lines || []).some(l => (l.debit || 0) || (l.credit || 0))) {
    const obLines = (ob.lines || []).filter(l => (l.debit || 0) || (l.credit || 0)).map(l => L(l.code, l.debit || 0, l.credit || 0));
    const d = sum(obLines, l => l.debit), c = sum(obLines, l => l.credit);
    const diff = Math.round((d - c) * 100) / 100;   // موجب = موجودات أكثر ⇒ رأس المال دائن
    if (Math.abs(diff) >= 0.005) obLines.push(L('3101', diff < 0 ? -diff : 0, diff > 0 ? diff : 0));
    push({
      id: 'opening', date: (ob.asOf || today()).slice(0, 10),
      title: 'الأرصدة الافتتاحية (رصيد ما قبل المنصة)', src: 'قيد افتتاحي', ref: 'افتتاحي', opening: true, lines: obLines
    });
  }

  // 9ب) تسوية كشوف تطبيقات التوصيل: إيداع للبنك + خصومات موثّقة ← يُقفلان ذمة التطبيق
  //     مدين البنك (المودع) + مدين خصومات (الفروق الموثّقة) = دائن ذمة التطبيق (المُقفَل)
  (ops.appSettlements || []).forEach(s => {
    const dep = Math.round((Number(s.deposit) || 0) * 100) / 100;
    const ded = Math.round((Number(s.deductions) || 0) * 100) / 100;
    const cleared = Math.round((dep + ded) * 100) / 100;
    if (cleared <= 0) return;
    const acc = appAcc[s.appId] || '1399';
    const appNm = ((org.deliveryApps || []).find(a => a.id === s.appId) || {}).n || 'تطبيق';
    const lines = [];
    if (dep) lines.push(L('1201', dep, 0));
    if (ded > 0) lines.push(L('5302', ded, 0));
    else if (ded < 0) lines.push(L('5302', 0, -ded));   // إيداع أعلى من المتوقع (مكافأة/تصحيح) — دائن المصروف
    lines.push(L(acc, 0, cleared));
    push({ id: 'astl:' + s.id, date: (s.date || '').slice(0, 10), title: 'تسوية كشف ' + appNm + ' — إيداع ' + money(dep), src: 'تسوية تطبيقات', ref: s.by || '', lines });
  });

  // 9ج) رسملة المخزون (الطريقة الدورية): بضاعة آخر المدة تُرسمَل أصلًا (1601) وتُخفّض تكلفة الفترة (5150 دائن)
  //     فيصير: تكلفة البضاعة المباعة = المشتريات − بضاعة آخر المدة، والمخزون يظهر أصلًا في المركز المالي
  // 9ج-2) v30.5 — قيود الجرد المستمر لكل حركة مخزون في الفترة (بالمتوسط المرجّح لحظة الحركة)
  if (perpFrom) {
    const SC = stockCosting(org, ops);
    const brOfWh = (wid) => ((whOf(org).find(w => w.id === wid) || {}).branchId) || '';
    const itN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || 'صنف';
    const val = (q, u) => Math.round(Math.abs(q) * (u || 0) * 100) / 100;
    const KIND_AR = { out: 'صرف للتشغيل', waste: 'هدر/إتلاف', adjust: 'تسوية جرد', in: 'رصيد افتتاحي/توريد يدوي', purchase: 'استلام بلا فاتورة' };
    const moveEntry = (m, key, wid) => {
      const dd = String(m.date || '').slice(0, 10); if (!perpOn(dd)) return;
      if (m.kind === 'purchase' && m.invoiceId) return;   // استلام أمر شراء: قيد فاتورته يرسمله
      const u = SC.at[key]; const v = val(m.qty, u); if (!(v > 0)) return;
      const acc = whAccOf(wid), q = Number(m.qty) || 0;
      let lines;
      if (m.kind === 'out') lines = [L('5501', v, 0), L(acc, 0, v)];
      else if (m.kind === 'waste') lines = [L('5502', v, 0), L(acc, 0, v)];
      else if (m.kind === 'adjust') lines = q < 0 ? [L('5503', v, 0), L(acc, 0, v)] : [L(acc, v, 0), L('5503', 0, v)];
      else if (m.kind === 'in') lines = [L(acc, v, 0), L('3101', 0, v)];
      else if (m.kind === 'purchase') lines = [L(acc, v, 0), L('5198', 0, v)];   // استلام قديم بلا فاتورة: يُعاد تبويب مصروف المشتريات إلى المخزون
      else return;
      push({ id: 'stk:' + key, date: dd, branchId: brOfWh(wid), title: (KIND_AR[m.kind] || m.kind) + ' — ' + itN(m.itemId) + ' (' + whName(org, wid) + ')', src: 'جرد مستمر', ref: m.ref || m.id, lines });
    };
    (ops.stockMoves || []).forEach(m => moveEntry(m, 'sm:' + m.id, m.whId || MAIN_WH));
    (ops.whMoves || []).forEach(m => moveEntry(m, 'wm:' + m.id, m.whId));
    (ops.whTransfers || []).forEach(t => {
      if (t.status !== 'sent' && t.status !== 'received') return;
      const lines = t.lines || [];
      const unitOf = (i) => SC.at['tx:' + (t.kind === 'b2b-in' ? t.linkId : t.id) + ':' + i] || 0;
      // الصرف: من مستودع المرسِل إلى «في الطريق» (النسخة الواردة لا تكرر الصرف)
      if (t.kind !== 'b2b-in' && perpOn(t.sentDate)) {
        const v = Math.round(lines.reduce((s2, l, i) => s2 + (Number(l.qtySent) || 0) * unitOf(i), 0) * 100) / 100;
        if (v > 0) push({ id: 'stx:' + t.id, date: t.sentDate, branchId: brOfWh(t.fromWh), title: 'تحويل مخزني ' + (t.no || '') + ' — ' + whName(org, t.fromWh) + ' ← في الطريق', src: 'جرد مستمر', ref: t.no || t.id, lines: [L('1609', v, 0), L(whAccOf(t.fromWh), 0, v)] });
      }
      // الاستلام: من «في الطريق» إلى مستودع المستلم، والنقص فرق جرد (النسخة الصادرة لا تُستلم)
      if (t.status === 'received' && t.kind !== 'b2b' && perpOn(t.receivedDate)) {
        const sentV = Math.round(lines.reduce((s2, l, i) => s2 + (Number(l.qtySent) || 0) * unitOf(i), 0) * 100) / 100;
        const recvV = Math.round(lines.reduce((s2, l, i) => s2 + (Number(l.qtyRecv) || 0) * unitOf(i), 0) * 100) / 100;
        const diff = Math.round((sentV - recvV) * 100) / 100;
        const ls = [L(whAccOf(t.toWh), recvV, 0), ...(diff > 0.004 ? [L('5503', diff, 0)] : diff < -0.004 ? [L('5503', 0, -diff)] : []), L('1609', 0, sentV)];
        if (sentV > 0) push({ id: 'srx:' + t.id, date: t.receivedDate, branchId: brOfWh(t.toWh), title: 'استلام تحويل ' + (t.no || '') + ' — ' + whName(org, t.toWh) + (diff > 0.004 ? ' (نقص ' + money(diff) + ')' : ''), src: 'جرد مستمر', ref: t.no || t.id, lines: ls });
      }
    });
    // رصيد المخزون عند بدء الجرد المستمر (ما قبل perpFrom) يُرحَّل مرة واحدة كرصيد افتتاحي للمستودعات
    const pre = (() => { const p = perpFrom.split('-').map(Number); const d0 = new Date(p[0], p[1] - 1, 0); return isoD(d0); })();
    const SB0 = stockByWh(org, ops, pre), AV0 = itemAvgCosts(org, ops, pre);
    const openLines = [];
    Object.entries(SB0.byWh).forEach(([wid, m]) => { const v = Math.round(Object.entries(m).reduce((s2, [id, q]) => s2 + Math.max(0, q) * (AV0[id] || 0), 0) * 100) / 100; if (v > 0) openLines.push(L(whAccOf(wid), v, 0)); });
    const tv0 = Math.round(Object.entries(SB0.transit).reduce((s2, [id, q]) => s2 + q * (AV0[id] || 0), 0) * 100) / 100; if (tv0 > 0) openLines.push(L('1609', tv0, 0));
    const openV = Math.round(openLines.reduce((s2, l) => s2 + l.debit, 0) * 100) / 100;
    if (openV > 0) push({ id: 'stk-open', date: perpFrom + '-01', title: 'رصيد المخزون عند بدء الجرد المستمر', src: 'جرد مستمر', ref: perpFrom, opening: true, lines: [...openLines, L('3101', 0, openV)] });
  }

  const iv = perpFrom ? null : org.invValuation;   // v30.5: الرسملة الدورية تتوقف مع الجرد المستمر (لا ازدواج)
  if (iv && iv.enabled) {
    const ivDate = (iv.asOf || today()).slice(0, 10);
    // v29.9: الأرصدة كما في تاريخ الرسملة (لا الأرصدة الحالية) — حركة اليوم لا تغيّر قيد شهر سابق
    const SB = stockByWh(org, ops, ivDate);
    const AVG = itemAvgCosts(org, ops, ivDate);   // v30.4: المتوسط المرجّح كما في تاريخ الرسملة
    const costOf = (id) => AVG[id] || 0;
    const valOf = (m) => Math.round(Object.entries(m || {}).reduce((s, [id, q]) => s + Math.max(0, q) * costOf(id), 0) * 100) / 100;
    if (whOn(org) && iv.auto !== false) {
      const lines = [];
      whOf(org).forEach(w => { const v = valOf(SB.byWh[w.id]); if (v > 0) lines.push(L(String(w.accCode || '1601'), v, 0)); });
      const tv = valOf(SB.transit); if (tv > 0) lines.push(L('1609', tv, 0));
      const val = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
      if (val > 0) push({ id: 'invval', date: ivDate, title: 'رسملة المخزون — بضاعة آخر المدة (حسب المستودع)', src: 'تسوية مخزون', ref: '', lines: [...lines, L('5150', 0, val)] });
    } else {
      const autoVal = valOf(SB.total);
      const val = Math.round((iv.auto !== false ? autoVal : (Number(iv.value) || 0)) * 100) / 100;
      if (val > 0) push({
        id: 'invval', date: ivDate,
        title: 'رسملة المخزون — بضاعة آخر المدة', src: 'تسوية مخزون', ref: '', lines: [L('1601', val, 0), L('5150', 0, val)]
      });
    }
  }

  // 9مكرر) القيود اليدوية والافتتاحية — يُدخلها المحاسب من شاشة المحاسبة (التصحيح بقيد عكسي لا بالحذف)
  (ops.journalManual || []).forEach(j => {
    push({
      id: 'man:' + j.id, date: (j.date || '').slice(0, 10),
      title: j.title || 'قيد يدوي', src: j.opening ? 'قيد افتتاحي' : j.vatClose ? 'إقفال ضريبي' : j.vatPay ? 'سداد ضريبة' : (j.mizanSales ? 'مبيعات مستوردة' : 'قيد يدوي'),
      ref: j.by || '', manual: true, ...(j.vat ? { vat: j.vat } : {}),   // v28.5: قيد مبيعات مستورد يحمل أثره الضريبي لشاشة الضريبة
      lines: (j.lines || []).map(l => L(l.code, l.debit || 0, l.credit || 0))
    });
  });

  // 9د) قيد إقفال السنة المالية: يُصفّر الإيرادات والمصروفات حتى تاريخ الإقفال ويحوّل صافيها إلى «الأرباح المبقاة» (3201)
  //     يُستثنى من قائمة الدخل (closing:true) فتبقى قائمة الدخل تعرض الأداء التشغيلي، ويُدرَج في الميزان والمركز المالي
  //     التوازن مضمون: مدين (الإيرادات + صافي الخسارة) = دائن (المصروفات + صافي الربح)
  const ye = org.yearEnd;
  if (ye && ye.enabled && ye.closeDate) {
    const cd = ye.closeDate.slice(0, 10);
    const cm = {};
    entries.forEach(e => { if ((e.date || '') <= cd) e.lines.forEach(l => { const x = cm[l.code] || (cm[l.code] = { debit: 0, credit: 0 }); x.debit += l.debit; x.credit += l.credit; }); });
    let dr = 0, cr = 0; const clLines = [];
    accounts.filter(a => a.kind === 'rev' || a.kind === 'exp').forEach(a => {
      const agg = cm[a.code] || { debit: 0, credit: 0 };
      const bal = a.kind === 'rev' ? agg.credit - agg.debit : agg.debit - agg.credit; // الرصيد الطبيعي
      if (Math.abs(bal) < 0.005) return;
      if (a.kind === 'rev') { if (bal > 0) { clLines.push(L(a.code, bal, 0)); dr += bal; } else { clLines.push(L(a.code, 0, -bal)); cr += -bal; } }
      else { if (bal > 0) { clLines.push(L(a.code, 0, bal)); cr += bal; } else { clLines.push(L(a.code, -bal, 0)); dr += -bal; } }
    });
    const plug = Math.round((dr - cr) * 100) / 100;   // موجب = ربح (دائن للأرباح المبقاة) · سالب = خسارة
    if (Math.abs(plug) >= 0.005) clLines.push(plug > 0 ? L('3201', 0, plug) : L('3201', -plug, 0));
    if (clLines.length) push({
      id: 'yearend', date: cd,
      title: 'قيد إقفال السنة المالية حتى ' + cd + (plug > 0 ? ' (ربح مُدوّر ' + money(plug) + ')' : plug < 0 ? ' (خسارة مُدوّرة ' + money(-plug) + ')' : ''),
      src: 'إقفال سنوي', ref: 'إقفال', closing: true, lines: clLines
    });
  }

  // ===== الترقيم والتجميع =====
  entries.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id));
  entries.forEach((e, i) => { e.no = 'ق-' + String(i + 1).padStart(4, '0'); });
  // v29.4: سطر برمز غير موجود في الدليل (حساب حُذف أو تغيّر رمزه، أو رمز خاطئ في قيد يدوي/افتتاحي)
  // كان يُسقَط بصمت فيختل ميزان المراجعة دون أي تنبيه — يُجمع الآن في حساب معلّق ظاهر يحتاج تصحيحًا
  const unknownCodes = new Set();
  entries.forEach(e => e.lines.forEach(l => {
    let a = accIx[l.code];
    if (!a) {
      unknownCodes.add(String(l.code));
      a = accIx['9999'] || addAcc('9999', 'حساب معلّق — رموز غير معرّفة في الدليل (يحتاج تصحيح)', 'asset', { link: 'قيود تشير لحساب محذوف أو رمز خاطئ' });
    }
    a.debit += l.debit; a.credit += l.credit;
  }));
  accounts.forEach(a => {
    a.balance = (a.kind === 'asset' || a.kind === 'exp') ? a.debit - a.credit : a.credit - a.debit;
    a.active = a.debit !== 0 || a.credit !== 0;
  });
  const totalDebit = sum(entries, e => e.debit);
  const totalCredit = sum(entries, e => e.credit);
  return {
    accounts, entries: entries.slice().reverse(), cashCode, assetRows,
    totalDebit, totalCredit, unknownCodes: [...unknownCodes],
    balanced: Math.abs(totalDebit - totalCredit) < 0.01 && entries.every(e => e.balanced)
  };
}

const DENOMS = [
  { k: 'd500', v: 500, c: '#2B6CB0' }, { k: 'd200', v: 200, c: '#5F7A55' },
  { k: 'd100', v: 100, c: '#A83B3B' }, { k: 'd50', v: 50, c: '#2F8F5B' },
  { k: 'd20', v: 20, c: '#9C6B2E' }, { k: 'd10', v: 10, c: '#7A5834' },
  { k: 'd5', v: 5, c: '#6E4A94' }, { k: 'd1', v: 1, c: '#4A5157' },
  { k: 'coins', v: 0.5, c: '#5E5E5E' }
];
const emptyDenoms = () => DENOMS.reduce((o, d) => ({ ...o, [d.k]: 0 }), {});
const countDenoms = (d) => DENOMS.reduce((s, x) => s + (Number(d?.[x.k]) || 0) * x.v, 0);

const ALL_TABS = ['pos', 'whbranch', 'analytics', 'reporting', 'people', 'purchasing', 'exec', 'alerts', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'boardpack', 'cashflow', 'sales', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'workforce', 'hrmaster', 'hrpolicy', 'hrops', 'hrperf', 'attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'kpi', 'empfile', 'rewards', 'esign', 'corrective', 'training', 'rolekpi', 'hrdash', 'perfsnap', 'suppliers', 'inv', 'reorder', 'partners', 'acct', 'shifts', 'docs', 'archive', 'ai', 'reports', 'rbuild', 'entities', 'admin', 'audit', 'qrfb'];
const TAB_AR = {
  muster: 'مسير الرواتب', overtime: 'مسير الأجور الإضافية',
  cashiers: 'سجل الكاشير',
  analytics: 'مركز التحليل والأداء', reporting: 'مركز التقارير', exec: 'اللوحة التنفيذية',
  pos: 'نقطة البيع', dash: 'لوحة المؤشرات', compare: 'مقارنة الفروع', growth: 'تحليلات النمو', breakeven: 'تحليل التعادل', scorecard: 'لوحة الأهداف', scenario: 'ماذا-لو', boardpack: 'تقرير الإدارة', cashflow: 'التدفق النقدي', closing: 'الإغلاق اليومي', apps: 'التطبيقات',
  approve: 'التدقيق والاعتماد', treasury: 'الخزينة والترحيل', people: 'شؤون الموظفين', payroll: 'الرواتب والسلف', leaves: 'الإجازات', workforce: 'تخطيط العمالة والتكلفة', hrmaster: 'البيانات الرئيسية', hrpolicy: 'السياسات والأدوار', attendance: 'الحضور الموثَّق', shiftengine: 'محرّك الورديات', tasks: 'المهام', points: 'دفتر النقاط', kpi: 'الأداء والتقييم', rewards: 'المكافآت والجزاءات', esign: 'التوقيع الإلكتروني', corrective: 'الإجراءات التصحيحية', training: 'التدريب والشهادات', rolekpi: 'مؤشرات الأداء بالدور', hrdash: 'لوحة الموارد البشرية', perfsnap: 'تجميد الأداء الشهري',
  purchasing: 'المشتريات والموردون', suppliers: 'الموردون والمشتريات', inv: 'المخزون والمنتجات', reorder: 'المشتريات الذكية', partners: 'جهات الاتصال',
  acct: 'المحاسبة', shifts: 'مواعيد الإغلاق والتذكيرات', archive: 'أرشيف المستندات', ai: 'المركز الذكي',
  reports: 'التقارير المالية', rbuild: 'منشئ التقارير', entities: 'مركز المنشآت', admin: 'الفروع والمستخدمون', audit: 'سجل التدقيق', qrfb: 'تقييم العملاء (QR)', whbranch: 'مستودع الفرع'
};
// ═══ ثيمات المنصّة الاحترافية (11 أسلوب تصميم كامل) × وضع ليل/نهار — v14.7 ═══
const THEME_META = {
  mizan: { name: 'ميزان 2 (الافتراضي)', desc: 'واضح احترافي', color: '#C9A24D' },
  royal: { name: 'الملكي الذهبي', desc: 'فخم دافئ', color: '#A87D28' },
  glass: { name: 'الزجاجي الشفّاف', desc: 'بطاقات ضبابية', color: '#2E7CC4' },
  minimal: { name: 'النقي المسطّح', desc: 'بسيط بلا ظلال', color: '#46525E' },
  elevated: { name: 'المرتفع الفاخر', desc: 'ظلال وارتفاع', color: '#6A44A8' },
  corporate: { name: 'المؤسسي الحادّ', desc: 'زوايا حادّة', color: '#33459C' },
  saudi: { name: 'الأخضر السعودي', desc: 'هوية وطنية', color: '#0F7A3D' },
  neon: { name: 'النيون الليلي', desc: 'سايبر متوهّج', color: '#16C8E6' },
  desert: { name: 'الترابي الصحراوي', desc: 'دافئ عضوي', color: '#B4622F' },
  pastel: { name: 'الباستيل الهادئ', desc: 'ناعم لطيف', color: '#D96FA6' },
  paper: { name: 'الورقي الكلاسيكي', desc: 'دفتر أستاذ', color: '#A6321F' },
  carbon: { name: 'الصناعي الفحمي', desc: 'لوحة تقنية', color: '#F59E0B' }
};
const THEME_ORDER = ['mizan', 'royal', 'glass', 'minimal', 'elevated', 'corporate', 'saudi', 'neon', 'desert', 'pastel', 'paper', 'carbon'];
const THEME_LEGACY = { gold: 'royal', charcoal: 'royal', bronze: 'royal', terra: 'royal', lite: 'royal', dark: 'royal', blue: 'glass', teal: 'glass', midnight: 'glass', slate: 'minimal', navy: 'corporate', purple: 'elevated', wine: 'elevated', emerald: 'saudi' };
const normTheme = (t) => THEME_META[t] ? t : (THEME_LEGACY[t] || 'mizan');
// v15.6: قراءة وضع النهار/الليل المحفوظ — تُستخدم في شاشات ما قبل الدخول التي لا تملك حالة mode
const readMode = () => { try { return localStorage.getItem('rms8:mode') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
const themeCls = (t, mode) => 'rms mode-' + (mode === 'dark' ? 'dark' : 'light') + ' thm-' + normTheme(t);

const ROLES = {
  // ===== الأدوار الخمسة المعتمدة =====
  cashier: {
    ar: 'كاشير — إدخال إغلاق اليوم', badge: 'b-sky', scope: 'own', create: true, todayOnly: true,
    tabs: ['pos', 'closing', 'hrops', 'attendance', 'tasks', 'points', 'esign'],
    perms: ['إنشاء وترحيل إغلاق اليوم لفرعه', 'جرد الصندوق وإدخال المبيعات والمصروفات', 'تسجيل حضور وانصراف موظفي فرعه من جهاز الفرع', 'كشك التوقيع الإلكتروني: يوقّع موظفو فرعه إقرارات الراتب والإشعارات بعد التحقق بـPIN', 'اليوم الحالي فقط دون سجلّ سابق — عدا مسوداته والمرفوضات المعادة للتصحيح فتظهر دائماً']
  },
  branch_manager: {
    ar: 'مدير الفرع', badge: 'b-mint', scope: 'own', create: true,
    tabs: ['pos', 'whbranch', 'closing', 'sales', 'apps', 'archive', 'hrops', 'hrperf', 'attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'kpi', 'empfile', 'rewards', 'esign', 'corrective', 'training', 'rolekpi', 'hrdash', 'qrfb'],
    perms: ['إدخال وترحيل إغلاق فرعه', 'عرض سجل إغلاقات فرعه', 'أرشيف مستندات فرعه فقط', 'تسجيل الحضور وضبط أرقام PIN وسجل حضور فرعه', 'محرّك ورديات فرعه: قوالب، تعيين أسبوعي، مطابقة حضور، تبديل وردية، طلب نقل موظف', 'كشك التوقيع الإلكتروني وسجل إقرارات فرعه (بلا مبالغ الرواتب)']
  },
  regional_manager: {
    ar: 'مدير إقليمي — فروع مُسندة', badge: 'b-amber', scope: 'assigned',
    tabs: ['whbranch', 'analytics', 'reporting', 'dash', 'compare', 'growth', 'sales', 'closing', 'apps', 'reports', 'archive', 'hrops', 'hrperf', 'attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'kpi', 'empfile', 'rewards', 'esign', 'corrective', 'training', 'rolekpi', 'hrdash', 'qrfb'],
    perms: ['متابعة الفروع المسندة إليه فقط', 'مقارنة وتقارير فروعه ولوحة مؤشراتها ونموّها', 'سجل حضور فروعه المسندة ومحرّك ورديات فروعه', 'بلا وصول للمحاسبة والخزينة والإعدادات']
  },
  head_office: {
    ar: 'المكتب الرئيسي — المالية والإدارة', badge: 'b-brass', scope: 'all', approver: true,
    tabs: ['whbranch', 'analytics', 'reporting', 'people', 'purchasing', 'exec', 'alerts', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'boardpack', 'cashflow', 'sales', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'workforce', 'hrmaster', 'hrpolicy', 'hrops', 'hrperf', 'attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'kpi', 'empfile', 'rewards', 'esign', 'corrective', 'training', 'rolekpi', 'hrdash', 'perfsnap', 'suppliers', 'inv', 'reorder', 'partners', 'acct', 'shifts', 'docs', 'archive', 'ai', 'reports', 'rbuild', 'entities', 'audit', 'qrfb'],
    perms: ['كل الفروع والتقارير المجمّعة', 'التدقيق والاعتماد النهائي', 'الخزينة والرواتب والموردون والمشتريات والمخزون', 'المحاسبة الكاملة: قيود وميزان وقوائم وضريبة وأصول ومراكز تكلفة']
  },
  system_admin: {
    ar: 'مسؤول النظام — وصول كامل', badge: 'b-rose', scope: 'all', create: true, admin: true, approver: true,
    tabs: ALL_TABS.slice(),
    perms: ['وصول كامل غير مقيّد', 'إدارة الفروع والمستخدمين والأدوار', 'إعدادات النظام والنسخ الاحتياطي']
  },
  // v37.8 — مراقب التكاليف والمخزون: يتابع الهدر والجرد والأسعار لكل الفروع ويعتمد، دون مالية أو إعدادات أو حركات مخزون
  cost_controller: {
    ar: 'مراقب التكاليف والمخزون', badge: 'b-amber', scope: 'all', postOnly: true, limitedApps: true, costCtl: true,
    tabs: ['inv', 'whbranch'],
    perms: ['تقرير ضبط الهدر لكل الفروع وتنبيه تجاوز السقف اليومي', 'اعتماد أو رفض طلبات الهدر فوق الحد', 'اعتماد الجرد الأعمى أو رفضه (لا يعتمد جردًا عدّه بنفسه)', 'الاستهلاك النظري مقابل الفعلي وتنبيهات أسعار الشراء', 'اطّلاع على الأصناف والوصفات والأرصدة — دون تعديلها', 'لا خزينة ولا رواتب ولا قيود ولا تعديل لحدود الضوابط']
  },
  // ===== توافق مع الحسابات القائمة (لا تظهر عند إنشاء مستخدم جديد) =====
  general_management: {
    ar: 'الإدارة العليا — مدير عام', badge: 'b-brass', scope: 'all', create: true, admin: true, approver: true, legacy: true,
    tabs: ALL_TABS.slice(),
    perms: ['كل الشاشات وكل الفروع', 'الاعتماد والإلغاء', 'إدارة المستخدمين والفروع']
  },
  finance_department: {
    // إعادة ترتيب v8.0: المحاسب الرئيسي بطبيعته يعمل على المنشأة كلها — نطاق كامل
    // بلا صلاحيات إدارة (لا مستخدمين/فروع، لا تفعيل ضريبة، لا إدارة تطبيقات)
    ar: 'الإدارة المالية — محاسب رئيسي', badge: 'b-sky', scope: 'all', legacy: true,
    tabs: ['whbranch', 'analytics', 'reporting', 'people', 'purchasing', 'exec', 'alerts', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'boardpack', 'cashflow', 'sales', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'workforce', 'hrmaster', 'hrpolicy', 'hrops', 'hrperf', 'attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'kpi', 'empfile', 'rewards', 'esign', 'corrective', 'training', 'rolekpi', 'hrdash', 'perfsnap', 'suppliers', 'inv', 'reorder', 'partners', 'acct', 'shifts', 'docs', 'archive', 'ai', 'reports', 'rbuild', 'entities', 'audit', 'qrfb'],
    perms: ['المحاسبة كاملة: قيود يدوية وافتتاحية وميزان وقوائم ومراكز تكلفة', 'الضريبة والأصول والتسوية البنكية (عرض وتسجيل — التفعيل للإدارة)', 'المشتريات والمخزون والرواتب والخزينة', 'كل الفروع — دون إدارة المستخدمين والإعدادات']
  },
  // ===== v15.9: نماذج صلاحيات المحاسب — نطاق «المحاسبة + التقارير المالية فقط» =====
  accountant: {
    // «يُدخل ولا يعدّل»: يُرحّل القيود ويُدخل البيانات، لكن لا يُعدّل/يحذف الحسابات أو الأصول ولا يغيّر الإعدادات
    ar: 'محاسب — محاسبة وتقارير (إدخال بلا تعديل)', badge: 'b-sky', scope: 'all', postOnly: true, limitedApps: true,
    tabs: ['acct', 'reporting'],
    perms: ['المحاسبة كاملة (عرض وإدخال): القيود اليدوية والافتتاحية، الميزان، القوائم، الضريبة، الزكاة، الأصول، مراكز التكلفة، التسوية، الإقفال', 'التقارير المالية ومنشئ التقارير وحزمة المجلس والتدفق النقدي — لكل الفروع', 'يُدخل القيود ويُصدّر ويطبع — دون تعديل/حذف الحسابات أو استبعاد الأصول أو تعديل حدود الائتمان', 'بلا خزينة/رواتب/موردين/مخزون، وبلا إدارة مستخدمين/فروع/إعدادات، وبلا اعتماد إغلاقات']
  },
  accountant_view: {
    // للمراجعة الخارجية: اطّلاع وتصدير فقط، بلا أي إدخال أو تعديل
    ar: 'مراجع مالي — محاسبة وتقارير (عرض فقط)', badge: 'b-dim', scope: 'all', readOnly: true, limitedApps: true,
    tabs: ['acct', 'reporting'],
    perms: ['اطّلاع كامل على المحاسبة والتقارير المالية لكل الفروع', 'تصدير وطباعة كل التقارير (Excel وPDF)', 'دون أي إدخال أو تعديل أو حذف — مناسب للمراجع/المدقّق الخارجي']
  }
};
// v15.9: اشتقاق صلاحيات الكتابة من الدور — canPost=إدخال/ترحيل، canEdit=تعديل/حذف/تغيير إعدادات.
// (للأدوار القائمة: readOnly/postOnly غير معرّفين ⇒ canPost=canEdit=النطاق الكامل، بلا أي تغيير سلوك.)
const rolePost = (role) => ROLES[role]?.scope === 'all' && !ROLES[role]?.readOnly;
const isCostCtl = (me) => !!(ROLES[me?.role] || {}).costCtl;   // v37.8 مراقب التكاليف: يعتمد ويراقب ولا يُدخل حركات
// v27.1 — نطاق فروع المستخدم كما تعرضه الواجهة (myBranches): null = كل الفروع (المركز)، وإلا قائمة معرّفات.
// نطاق الكتابة (dataCtx.myBrIds) يجب أن يطابقه حرفيًا — أي سجل بفرع خارج هذا النطاق لا يُحفظ من جهاز الفرع.
const branchIdsOfUser = (u) => {
  if (!u) return [];
  const s = (ROLES[u.role] || ROLES.cashier).scope;
  if (s === 'all') return null;
  if (s === 'own') return u.branchId ? [u.branchId] : [];
  return u.allowedBranchIds || [];
};
// v27.1 — سجلات في next (بعد mutator) تقع خارج نطاق الفروع المسموح كتابته — على مسار الفرع تضيع بصمت إن لم تُرفض
function outOfScopeRecords(next, latest, myBrIds) {
  const seen = new Set();
  BR_COLS.forEach(c => ((latest || {})[c] || []).forEach(x => seen.add(c + ':' + x.id)));
  const out = [];
  BR_COLS.forEach(c => ((next || {})[c] || []).forEach(x => { if (!seen.has(c + ':' + x.id) && (!x.branchId || !(myBrIds || []).includes(x.branchId))) out.push({ col: c, id: x.id, branchId: x.branchId || '' }); }));
  return out;
}
const roleEdit = (role) => rolePost(role) && !ROLES[role]?.postOnly;
// v15.12: البوابة الأمنية المركزية — الحارس داخل عملية الحفظ نفسها (دفاع بعمق).
//   need='post' يتطلب صلاحية الإدخال، need='edit' يتطلب صلاحية التعديل/الإعدادات،
//   بلا need = بلا اشتراط (توافق خلفي كامل: كل الكتابات التشغيلية للكاشير/المدراء تمر كما كانت).
//   بهذا لا يُنفَّذ أي حفظ حسّاس دون فحص الصلاحية — حتى لو نسي زرٌّ ما فحصه.
const capOK = (role, need) => !need || (need === 'post' ? rolePost(role) : need === 'edit' ? roleEdit(role) : true);

// تطبيقات التوصيل المعروفة في السعودية — العمولة اختيارية (0 افتراضياً، تُعدّل عند الحاجة)
const APPS = [
  { id: 'jahez', n: 'جاهز', c: 0 }, { id: 'hunger', n: 'هنقرستيشن', c: 0 },
  { id: 'toyou', n: 'تويو', c: 0 }, { id: 'mrsool', n: 'مرسول', c: 0 },
  { id: 'ninja', n: 'نينجا', c: 0 }, { id: 'keeta', n: 'كيتا', c: 0 },
  { id: 'chefz', n: 'ذا شيفز', c: 0 }, { id: 'careem', n: 'كريم فود', c: 0 },
  { id: 'noon', n: 'نون فود', c: 0 }, { id: 'cari', n: 'كاري', c: 0 },
  { id: 'direct', n: 'المتجر الخاص / طلب مباشر', c: 0 }
];

const EXP_CATS = [
  { id: 'ec1', n: 'مشتريات مواد خام', taxable: true },
  { id: 'ec2', n: 'رواتب وأجور', taxable: false },
  { id: 'ec3', n: 'سلف ومسحوبات موظفين', taxable: false },
  { id: 'ec4', n: 'صيانة وتشغيل', taxable: true },
  { id: 'ec5', n: 'كهرباء ومياه', taxable: true },
  { id: 'ec6', n: 'إيجار الفرع', taxable: false },
  { id: 'ec7', n: 'نظافة ومستهلكات', taxable: true },
  { id: 'ec8', n: 'مصاريف نثرية', taxable: true }
];

/* ============================================================
   سجل التطبيقات المركزي — ERP Application Registry (v7.6)
   كل تطبيق يشير إلى وحدة فعلية موجودة (tab + شاشة فرعية اختيارية).
   لا صفحات وهمية: عناصر «قريباً» هي خطة التطوير المعلنة فقط،
   معطّلة صراحةً حتى بنائها. الصلاحيات تُشتق من أدوار النظام نفسها
   (ROLES.tabs) — لا طبقة صلاحيات موازية قد تتعارض.
   إضافة تطبيق مستقبلاً = سطر واحد هنا.
   ============================================================ */
const REG_CATS = [
  { id: 'fin', ar: 'المالية والمحاسبة', en: 'Finance & Accounting', icon: Landmark },
  { id: 'pos', ar: 'الفروع ونقاط البيع', en: 'Branches & POS', icon: Store },
  { id: 'pur', ar: 'المشتريات والموردون', en: 'Purchasing & Payables', icon: Truck },
  { id: 'hr', ar: 'الموارد البشرية', en: 'Human Resources', icon: Users },
  { id: 'tax', ar: 'الزكاة والضريبة', en: 'Zakat & VAT', icon: Receipt },
  { id: 'inv2', ar: 'المخزون', en: 'Inventory', icon: HardDrive },
  { id: 'ast', ar: 'الأصول والتسويات', en: 'Assets & Reconciliation', icon: Building2 },
  { id: 'gov', ar: 'التدقيق والحوكمة', en: 'Audit & Governance', icon: ShieldCheck },
  { id: 'bi', ar: 'التحليل والذكاء المالي', en: 'Financial Intelligence', icon: Sparkles }
];
const REG_APPS = [
  // ——— المالية والمحاسبة (كلها على المحرك المحاسبي المركزي buildAccounting) ———
  { id: 'gl', ar: 'القيود اليومية', en: 'General Ledger', cat: 'fin', icon: FileText, open: { tab: 'acct', view: 'jr' }, kw: ['قيد', 'يومية', 'أستاذ', 'محاسبة', 'مدين', 'دائن'], fns: ['قيود تلقائية من كل العمليات', 'قيد يدوي', 'قيد افتتاحي', 'بحث وفلترة', 'فتح المصدر'], d: 'كل عملياتك تتحول لقيود مزدوجة متوازنة تلقائياً — مع القيود اليدوية والافتتاحية.' },
  { id: 'coa', ar: 'دليل الحسابات', en: 'Chart of Accounts', cat: 'fin', icon: Landmark, open: { tab: 'acct', view: 'coa' }, kw: ['حساب', 'دليل', 'شجرة', 'رصيد'], fns: ['شجرة جاهزة للمطاعم', 'أرصدة حية', 'ربط تلقائي بالفروع والموردين والتطبيقات'], d: 'شجرة الحسابات بأرصدة حية مربوطة بكياناتك — صندوق لكل فرع وذمّة لكل تطبيق.' },
  { id: 'tb', ar: 'ميزان المراجعة', en: 'Trial Balance', cat: 'fin', icon: Scale, open: { tab: 'acct', view: 'tb' }, kw: ['ميزان', 'مراجعة', 'توازن'], fns: ['فلتر فترة', 'فلتر فرع/مركزي', 'توازن مضمون'], d: 'مدين = دائن دائماً — بأي فترة وأي فرع.' },
  { id: 'fs', ar: 'القوائم المالية', en: 'Financial Statements', cat: 'fin', icon: FileBarChart, open: { tab: 'acct', view: 'fs' }, kw: ['قائمة', 'دخل', 'ميزانية', 'مركز مالي', 'أرباح', 'خسارة'], fns: ['قائمة الدخل بالفترة', 'المركز المالي', 'أرباح متراكمة تلقائية', 'فحص تطابق'], d: 'قائمة الدخل والمركز المالي من قيودك مباشرة، بفحص تطابق دائم.' },
  { id: 'cc', ar: 'مراكز التكلفة والربحية', en: 'Cost Centers', cat: 'fin', icon: BarChart3, open: { tab: 'acct', view: 'cc' }, kw: ['مركز تكلفة', 'ربحية', 'فرع', 'صافي', 'توزيع'], fns: ['عمود لكل فرع + المركز الرئيسي', 'أرقام مباشرة من القيود الموسومة', 'صافي ربحية كل مركز'], d: 'ربحية كل فرع كمركز تكلفة مستقل — إيرادات ومصروفات وصافٍ من قيودك مباشرة.' },
  { id: 'treasury', ar: 'الخزينة والبنوك', en: 'Treasury & Cash', cat: 'fin', icon: Banknote, open: { tab: 'treasury' }, kw: ['خزينة', 'تحويل', 'صرف', 'نقدية', 'سند', 'توريد'], fns: ['استلام تحويلات الفروع', 'أوامر الصرف', 'دفتر الخزينة'], d: 'استلام توريدات الفروع وأوامر الصرف — رصيدها يطابق حسابها المحاسبي.' },
  { id: 'reports', ar: 'التقارير المالية', en: 'Financial Reports', cat: 'fin', icon: FileBarChart, open: { tab: 'reports' }, kw: ['تقرير', 'طباعة', 'تصدير', 'فاتورة', 'يومي', 'شهري'], fns: ['تقارير يومية وشهرية', 'طباعة واعتماد', 'تصدير'], d: 'تقارير الفروع والفترات جاهزة للطباعة والاعتماد.' },
  // ——— الفروع ونقاط البيع ———
  { id: 'closing', ar: 'الإغلاق اليومي للورديات', en: 'Daily Shift Closing (POS)', cat: 'pos', icon: ClipboardCheck, open: { tab: 'closing' }, kw: ['وردية', 'إغلاق', 'نقدية', 'مبيعات', 'جرد', 'فرق', 'عجز', 'فاتورة'], fns: ['فتح وإغلاق الوردية', 'جرد الفئات النقدية', 'المصروفات والسدادات', 'توثيق بالصور', 'طباعة'], d: 'قلب التشغيل: إغلاق ورديات الفروع بالجرد والتوثيق — ويولّد قيوده محاسبياً.' },
  { id: 'approve', ar: 'التدقيق والاعتماد', en: 'Review & Approvals', cat: 'pos', icon: ShieldCheck, open: { tab: 'approve' }, kw: ['اعتماد', 'تدقيق', 'مطابقة', 'مراجعة'], fns: ['مراجعة الإغلاقات', 'اعتماد أو إرجاع', 'ملاحظات'], d: 'مراجعة إغلاقات الفروع واعتمادها النهائي من المركز.' },
  { id: 'dash', ar: 'لوحة المؤشرات', en: 'Dashboard', cat: 'pos', icon: LayoutDashboard, open: { tab: 'dash' }, kw: ['مؤشر', 'لوحة', 'إيراد', 'ملخص'], fns: ['مؤشرات حية', 'حركة الإيرادات', 'قنوات التحصيل', 'تنبيهات ذكية'], d: 'صورة اليوم كاملة: إيرادات، مصروفات، فروقات، وتنبيهات.' },
  { id: 'compare', ar: 'مقارنة الفروع والرقابة', en: 'Branch Compare', cat: 'pos', icon: BarChart3, open: { tab: 'compare' }, kw: ['مقارنة', 'أداء', 'رقابة', 'فرع'], fns: ['مقارنة الإيرادات', 'الالتزام بالإغلاق', 'الفروقات'], d: 'أداء الفروع جنباً إلى جنب — من يبيع ومن يلتزم.' },
  { id: 'shifts', ar: 'مواعيد الإغلاق والتذكيرات', en: 'Closing Deadlines', cat: 'pos', icon: Clock, open: { tab: 'shifts' }, kw: ['إغلاق', 'موعد', 'تذكير', 'تأخر', 'وردية', 'مراقبة'], fns: ['موعد إغلاق لكل فرع', 'تنبيه قبل الموعد', 'رصد الفروع المتأخرة عن الإغلاق'], d: 'مراقبة التزام الفروع بموعد إغلاق اليوم — تنبيه قبل الموعد ورصد المتأخرين.' },
  { id: 'brmgmt', ar: 'الفروع والمستخدمون', en: 'Branches & Users', cat: 'pos', icon: UserCog, open: { tab: 'admin' }, kw: ['فرع', 'مستخدم', 'صلاحية', 'شعار', 'تصنيف', 'تطبيق توصيل'], fns: ['إدارة الفروع', 'المستخدمون والأدوار', 'تصنيفات المصروفات', 'تطبيقات التوصيل وعمولاتها', 'النظام'], d: 'إدارة الفروع والمستخدمين والصلاحيات وإعدادات النظام.' },
  // ——— المشتريات والموردون ———
  { id: 'suppliers', ar: 'الموردون والالتزامات', en: 'Suppliers & Payables', cat: 'pur', icon: Truck, open: { tab: 'suppliers' }, kw: ['مورد', 'فاتورة', 'سداد', 'التزام', 'أعمار', 'استحقاق', 'إيجار'], fns: ['فواتير التوريد الآجلة', 'السداد المركزي', 'الإيجارات والفواتير الثابتة', 'سجل الموردين'], d: 'فواتير الموردين وسداداتها والتزامات الفروع الثابتة.' },
  { id: 'partners', ar: 'جهات الاتصال', en: 'Contacts', cat: 'pur', icon: Users, open: { tab: 'partners' }, kw: ['جهات الاتصال', 'اتصال', 'دفتر الشركاء', 'عميل', 'مورد', 'موظف', 'كشف حساب', 'ذمم', 'مدين', 'دائن', 'فاتورة'], fns: ['كشف حساب لكل شريك', 'ترقيم تلقائي', 'طلبات إضافة باعتماد', 'حركات يدوية'], d: 'عملاء وموردون وموظفون — مدين ودائن وكشف حساب لكل شريك.' },
  { id: 'po', ar: 'أوامر الشراء', en: 'Purchase Orders', cat: 'pur', icon: ClipboardCheck, open: { tab: 'suppliers' }, kw: ['أمر شراء', 'طلب', 'استلام', 'مورد'], fns: ['إنشاء أمر بنود وأسعار', 'استلام كلي أو جزئي يغذي المخزون', 'تحويل لفاتورة بحقل ضريبي'], d: 'أمر شراء ← استلام ← فاتورة ← سداد — من تبويب أوامر الشراء في شاشة الموردين.' },
  // ——— الموارد البشرية ———
  { id: 'payroll', ar: 'الرواتب والسلف', en: 'Payroll & Advances', cat: 'hr', icon: Wallet, open: { tab: 'payroll' }, kw: ['راتب', 'سلفة', 'خصم', 'استحقاق', 'صرف', 'موظف', 'قسيمة'], fns: ['كشف رواتب شهري', 'سلف وخصومات', 'ترحيل الاستحقاق والصرف للدفتر', 'قسائم رواتب'], d: 'كشف الرواتب والسلف والخصومات — مرحّلة محاسبياً باستحقاقها وصرفها.' },
  { id: 'workforce', ar: 'تخطيط العمالة والتكلفة', en: 'Labor Planning & Cost', cat: 'hr', icon: CalendarDays, open: { tab: 'workforce' }, kw: ['جدولة', 'ساعات', 'عمالة', 'تكلفة', 'دوام', 'تخطيط', 'إنتاجية', 'مبيعات لكل ساعة'], fns: ['تخطيط ساعات أسبوعي لكل موظف', 'الساعات الفعلية تلقائيًا من الحضور الموثَّق', 'نسبة العمالة من المبيعات', 'المبيعات لكل ساعة عمل', 'تنبيهات الزيادة والنقص'], d: 'خطّط ساعات فريقك، والفعلي يأتي من الحضور الموثَّق، وقِس نسبة العمالة من مبيعاتك — بهدف قابل للضبط.' },
  { id: 'attendance', ar: 'الحضور الموثَّق', en: 'Verified Attendance', cat: 'hr', icon: Fingerprint, open: { tab: 'attendance' }, kw: ['حضور', 'انصراف', 'بصمة', 'PIN', 'جيوفنس', 'موقع', 'كاشير', 'كيوسك'], fns: ['تسجيل حضور وانصراف من جهاز الفرع بـPIN', 'تحقّق تلقائي من نطاق جيوفنس الفرع', 'سجل حضور كامل قابل للفلترة'], d: 'تسجيل حضور وانصراف الموظفين من جهاز الفرع نفسه — برقم PIN وتحقّق موقعي، دون حساب دخول شخصي لكل موظف.' },
  { id: 'shiftengine', ar: 'محرّك الورديات', en: 'Shift Engine', cat: 'hr', icon: ArrowLeftRight, open: { tab: 'shiftengine' }, kw: ['وردية', 'ورديات', 'تعيين', 'تبديل', 'نقل موظف', 'قالب وردية', 'جدول'], fns: ['قوالب ورديات لكل فرع', 'تقويم تعيين أسبوعي', 'مطابقة تلقائية مع الحضور الفعلي', 'طلبات تبديل وردية', 'طلبات نقل موظف بين الفروع'], d: 'قوالب ورديات جاهزة، تقويم تعيين أسبوعي، مطابقة تلقائية مع الحضور الفعلي، وطلبات تبديل وردية أو نقل موظف بين الفروع.' },
  { id: 'tasks', ar: 'المهام', en: 'Tasks', cat: 'hr', icon: CheckCircle2, open: { tab: 'tasks' }, kw: ['مهام', 'مهمة', 'تشيك ليست', 'تكليف', 'التزام', 'قائمة مهام'], fns: ['قوائم مهام يومية/أسبوعية متكررة لكل فرع', 'تكليف مهام فردية لموظف معيّن', 'قائمة مهام مرتبطة بالوردية', 'تقرير الالتزام بالمهام لكل موظف/فرع'], d: 'قوائم مهام متكررة لكل فرع، تكليف مهام فردية، إنجاز من جهاز الفرع، وتقرير التزام لكل موظف وفرع.' },
  { id: 'points', ar: 'دفتر النقاط', en: 'Points Ledger', cat: 'hr', icon: Star, open: { tab: 'points' }, kw: ['نقاط', 'دفتر نقاط', 'ترتيب', 'تحفيز', 'مكافأة', 'رصيد'], fns: ['دفتر نقاط لكل موظف مع حركات يدوية بسبب موثَّق', 'قواعد نقاط تلقائية من الحضور والورديات والمهام (قابلة للضبط)', 'لوحة ترتيب شهرية للفرع والشركة', 'عرض رصيد الموظف من كشك الفرع بـPIN'], d: 'رصيد نقاط لكل موظف يجمع الحركات اليدوية والنقاط التلقائية من الحضور والمهام، مع لوحة ترتيب شهرية وعرض للموظف من جهاز الفرع.' },
  { id: 'kpi', ar: 'الأداء والتقييم', en: 'Performance & KPI', cat: 'hr', icon: TrendingUp, open: { tab: 'kpi' }, kw: ['تقييم', 'أداء', 'kpi', 'درجة', 'مؤشرات', 'أهداف', 'بطاقة أداء'], fns: ['درجة أداء شهرية مركّبة لكل موظف بأوزان قابلة للضبط', 'تقييم المدير الشهري للجودة', 'أهداف KPI لكل فرع مقابل الفعلي', 'بطاقة أداء الموظف (سجل 6 أشهر + اتجاه) قابلة للطباعة'], d: 'درجة أداء شهرية من 100 تجمع الحضور والمهام والانضباط وتقييم المدير بأوزان قابلة للضبط، مع أهداف KPI للفرع وبطاقة أداء لكل موظف.' },
  { id: 'rewards', ar: 'المكافآت والجزاءات', en: 'Rewards & Penalties', cat: 'hr', icon: Coins, open: { tab: 'rewards' }, kw: ['مكافأة', 'مكافآت', 'جزاء', 'جزاءات', 'اعتماد', 'حافز', 'خصم', 'راتب'], fns: ['طلب مكافأة أو جزاء لموظف بمبلغ وسبب', 'سلسلة اعتماد مركزية بسجل كامل', 'ترحيل تلقائي لمسيّر الرواتب بعد الاعتماد', 'شرائح مكافآت تلقائية حسب درجة الأداء (قابلة للضبط، مُعطَّلة افتراضيًا)'], d: 'طلبات مكافآت وجزاءات من الفروع، اعتماد مركزي، وترحيل تلقائي لمسيّر الرواتب بعد الاعتماد — مع شرائح مكافآت اختيارية مبنية على درجة الأداء.' },
  { id: 'esign', ar: 'التوقيع الإلكتروني', en: 'E-Signature', cat: 'hr', icon: Signature, open: { tab: 'esign' }, kw: ['توقيع', 'إقرار', 'استلام', 'راتب', 'قسيمة', 'إشعار', 'جزاء', 'مكافأة', 'كشك', 'PIN'], fns: ['إقرار استلام الراتب الشهري يوقّعه الموظف بإصبعه بعد التحقق بـPIN', 'إشعارات المكافآت والجزاءات المعتمدة توقَّع بالعلم', 'التوقيع من كشك الفرع أو من شاشة الرواتب بالمكتب', 'التوقيع يظهر على قسيمة الراتب ومسير الرواتب المطبوعين', 'سجل إقرارات وتقرير حالة التوقيعات وتنبيه بغير الموقَّع'], d: 'توقيع إلكتروني للموظف على إقرارات استلام الراتب وإشعارات المكافآت والجزاءات — من جهاز الفرع بعد التحقق بـPIN، ويُطبع على القسائم والمسير.' },
  { id: 'corrective', ar: 'الإجراءات التصحيحية', en: 'Corrective Actions', cat: 'hr', icon: ShieldAlert, open: { tab: 'corrective' }, kw: ['جزاء', 'تأديب', 'إنذار', 'مخالفة', 'لائحة', 'تظلّم', 'خطة تحسين', 'pip', 'محضر'], fns: ['فتح إجراء تأديبي متدرّج حسب لائحة الجزاءات', 'اعتماد مركزي وترحيل الغرامة للرواتب بسقف نظامي', 'محضر بالعلم يوقّعه الموظف من كشك الفرع', 'خطط تحسين الأداء (PIP) بأهداف ومراجعات', 'محو الجزاء تلقائيًا بعد المدة النظامية'], d: 'إجراءات تأديبية متدرّجة وفق نظام العمل ولائحة المنشأة، باعتماد مركزي ومحضر توقيع، وخطط تحسين أداء بديلة تطويرية.' },
  { id: 'training', ar: 'التدريب والشهادات', en: 'Training & Certifications', cat: 'hr', icon: Stamp, open: { tab: 'training' }, kw: ['تدريب', 'شهادة', 'صحية', 'سلامة الغذاء', 'انتهاء', 'امتثال', 'برنامج', 'هاسب'], fns: ['برامج تدريب وشهادات بمدد صلاحية', 'تسجيل اجتياز الموظفين وحساب تاريخ الانتهاء', 'مصفوفة امتثال للتدريب الإلزامي لكل موظف', 'تنبيهات انتهاء الشهادات والنقص الإلزامي'], d: 'برامج التدريب والشهادات الإلزامية (الشهادة الصحية، سلامة الغذاء) بمدد صلاحية، مع مصفوفة امتثال وتنبيهات انتهاء ونقص.' },
  { id: 'rolekpi', ar: 'مؤشرات الأداء بالدور', en: 'Role KPIs', cat: 'hr', icon: TrendingUp, open: { tab: 'rolekpi' }, kw: ['مؤشر', 'kpi', 'أداء', 'دور', 'هدف', 'قياس', 'تحقّق', 'كاشير', 'شيف'], fns: ['مكتبة مؤشرات لكل مسمى وظيفي بهدف ووزن واتجاه', 'إدخال قياسات شهرية لكل موظف وحساب نسبة التحقّق', 'محور خامس اختياري في درجة الأداء المركّبة (م7)', 'مُعطَّل افتراضيًا حتى يفعّله المركز'], d: 'مكتبة مؤشرات أداء خاصة بكل دور (فروق النقد للكاشير، الجودة والهدر للمطبخ…)، قياس شهري، ومحور اختياري في الدرجة المركّبة.' },
  { id: 'hrdash', ar: 'لوحة الموارد البشرية', en: 'HR Dashboard', cat: 'hr', icon: LayoutDashboard, open: { tab: 'hrdash' }, kw: ['لوحة', 'تقارير', 'حضور', 'مكافآت', 'نقاط', 'موارد بشرية', 'hr', 'excel'], fns: ['لوحة HR تنفيذية لكل الفروع بمقارنة شهرية', 'تقرير الحضور الشهري التفصيلي (طباعة وExcel)', 'تقرير المكافآت والجزاءات والنقاط', 'تنبيهات HR في مركز التنبيهات'], d: 'لوحة تنفيذية لمؤشرات الموارد البشرية لكل الفروع، وتقارير الحضور والمكافآت والنقاط قابلة للطباعة وExcel.' },
  { id: 'perfsnap', ar: 'تجميد الأداء الشهري', en: 'Performance Snapshot', cat: 'hr', icon: Lock, open: { tab: 'perfsnap' }, kw: ['تجميد', 'لقطة', 'أداء', 'اعتماد', 'ثبات', 'تلاعب', 'انحراف'], fns: ['تجميد درجات الأداء ومكوّناتها شهريًا سجلًّا ثابتًا', 'كشف تغيّر بيانات شهر معتمد (مقارنة الحيّ بالمجمّد)', 'فكّ التجميد لمسؤول النظام بتدقيق', 'تصدير Excel'], d: 'تثبيت أداء الشهر المعتمد لقطةً لا تُعاد حسابها، مع كشف أي تعديل رجعي على بياناته.' },
  // ——— الزكاة والضريبة (خطة م3) ———
  { id: 'vat', ar: 'ضريبة القيمة المضافة', en: 'VAT', cat: 'tax', icon: Receipt, open: { tab: 'acct', view: 'vat' }, kw: ['ضريبة', 'زاتكا', 'مدخلات', 'مخرجات', 'فاتورة', 'إقرار'], fns: ['تفعيل بنسبة قابلة للضبط', 'فصل المخرجات في قيد الإيراد', 'فصل مدخلات المصروفات الخاضعة', 'مؤشرات بالفترة'], d: 'فصل تلقائي لضريبة المخرجات والمدخلات في القيود — بأثر رجعي فور التفعيل.' },
  { id: 'vatret', ar: 'الإقرار الضريبي', en: 'VAT Return', cat: 'tax', icon: FileText, open: { tab: 'acct', view: 'vat' }, kw: ['إقرار', 'ضريبة', 'ربع', 'زاتكا'], fns: ['مسودة إقرار بالفترة', 'زر الربع الحالي', 'صافي المستحق'], d: 'مسودة إقرار جاهزة من قيودك لأي فترة تحددها.' },
  // ——— المخزون (خطة م4) ———
  { id: 'products', ar: 'المنتجات والوصفات', en: 'Products & Recipes', cat: 'inv2', icon: Store, open: { tab: 'inv', view: 'recipes' }, kw: ['منتج', 'وصفة', 'تكلفة', 'هامش', 'مخزون'], fns: ['وصفة بمكونات من الأصناف', 'تكلفة حقيقية بآخر شراء', 'هامش لحظي (صافي الضريبة)'], d: 'وصفة وتكلفة وهامش لكل منتج — من أصناف مخزونك وأسعارها الفعلية.' },
  { id: 'stock', ar: 'المخزون والجرد', en: 'Stock & Stocktake', cat: 'inv2', icon: HardDrive, open: { tab: 'inv', view: 'items' }, kw: ['مستودع', 'جرد', 'حركة', 'رصيد', 'هدر', 'مخزون', 'حد أدنى'], fns: ['أرصدة حية بحد أدنى وتنبيه', 'توريد وصرف وهدر', 'جرد بعدّ فعلي وتسويات موثقة'], d: 'أرصدة أصنافك وحركاتها وجردها الدوري — والتوريد من أوامر الشراء تلقائي.' },
  { id: 'whbranch', ar: 'مستودع الفرع', en: 'Branch Warehouse', cat: 'inv2', icon: Truck, open: { tab: 'whbranch' }, kw: ['مستودع', 'فرع', 'تحويل', 'استلام', 'طلب', 'صرف', 'هدر', 'جرد'], fns: ['أرصدة مستودع الفرع', 'طلب من المستودع الرئيسي', 'استلام التحويلات بالكميات الفعلية', 'صرف للمطبخ وهدر', 'جرد المستودع'] },
  // ——— الأصول والتسويات (خطة م5) ———
  { id: 'assets', ar: 'الأصول الثابتة والإهلاك', en: 'Fixed Assets', cat: 'ast', icon: Building2, open: { tab: 'acct', view: 'ast' }, kw: ['أصل', 'إهلاك', 'معدات', 'قيمة دفترية'], fns: ['سجل أصول بمصدر تمويل صريح', 'إهلاك شهري تلقائي بأثر رجعي', 'قيمة دفترية حية'], d: 'سجل أصولك وقيود شرائها وإهلاكها الشهري تلقائياً حتى نهاية عمرها.' },
  { id: 'bankrec', ar: 'التسوية البنكية', en: 'Bank Reconciliation', cat: 'ast', icon: Landmark, open: { tab: 'acct', view: 'bank' }, kw: ['بنك', 'تسوية', 'كشف', 'مطابقة', 'شبكة', 'فرق'], fns: ['رصيد الدفتر مقابل كشف البنك', 'فرق موثق بسجل تسويات', 'حركات البنك مفصلة'], d: 'طابق حساب البنك التجميعي مع كشفك الفعلي ووثّق الفروقات — والتصحيح بقيد يدوي.' },
  // ——— التدقيق والحوكمة ———
  { id: 'backup', ar: 'النسخ الاحتياطي والاستعادة', en: 'Backup & Restore', cat: 'gov', icon: HardDrive, open: { tab: 'admin' }, kw: ['نسخة', 'احتياطي', 'استعادة', 'لقطة', 'حماية', 'تصدير'], fns: ['نسخة كاملة موقّعة', 'فحص نسخة (تجربة استعادة)', 'استعادة بتأكيد ولقطة أمان', 'لقطات يومية محلية 7 أيام'], d: 'نزّل نسختك، افحصها قبل الحاجة، واستعدها بأمان موثق — من الفروع والمستخدمون ← بيانات الشركة.' },
  { id: 'lock', ar: 'الإقفال الشهري', en: 'Period Locking', cat: 'gov', icon: Lock, open: { tab: 'acct', view: 'lock' }, kw: ['إقفال', 'قفل', 'فترة', 'شهر', 'حماية', 'مراجع'], fns: ['قفل تراكمي حتى شهر', 'فحوصات ما قبل القفل', 'فتح استثنائي بسبب موثق', 'سجل كامل'], d: 'اقفل الشهور المعتمدة ضد أي تعديل — والفتح استثنائي موثق بسبب أمام المراجع.' },
  { id: 'audit', ar: 'سجل التدقيق', en: 'Audit Trail', cat: 'gov', icon: Eye, open: { tab: 'audit' }, kw: ['تدقيق', 'سجل', 'عملية', 'حوكمة', 'من فعل'], fns: ['كل عملية باسم صاحبها ووقتها', 'تنبيهات حية لمدير النظام'], d: 'من فعل ماذا ومتى — سجل كامل لا يُمحى لكل حركة في النظام.' },
  { id: 'archive', ar: 'أرشيف المستندات', en: 'Documents Archive', cat: 'gov', icon: ImageIcon, open: { tab: 'archive' }, kw: ['مستند', 'صورة', 'أرشيف', 'وثيقة', 'إيصال'], fns: ['صور الإغلاقات والإيصالات', 'تصفح بالفرع والتاريخ'], d: 'كل صور التوثيق والإيصالات مؤرشفة بالفرع والتاريخ.' },
  // ——— التحليل والذكاء المالي ———
  { id: 'ai', ar: 'المركز المالي الذكي', en: 'Financial Intelligence', cat: 'bi', icon: Sparkles, open: { tab: 'ai' }, kw: ['تحليل', 'ذكاء', 'توقع', 'انحراف', 'نسبة', 'اتجاه'], fns: ['مؤشرات وتحليلات', 'كشف الانحرافات', 'توصيات'], d: 'قراءة ذكية لأرقامك: اتجاهات وانحرافات وتوصيات.' },
  { id: 'qrfb', ar: 'تقييم العملاء بالـ QR', en: 'QR Customer Feedback', cat: 'pos', icon: QrCode, open: { tab: 'qrfb' }, kw: ['تقييم', 'عميل', 'عملاء', 'رضا', 'شكوى', 'شكاوى', 'QR', 'تعليق', 'نجوم'], fns: ['رمز QR لكل فرع يفتح صفحة تقييم بلا تسجيل دخول', 'تقييم 10 عناصر (الطعام والخدمة والمكان) + تعليق', 'شكوى تلقائية عند تقييم أقل من 3 مع مهلة 24 ساعة', 'مقارنة الفروع والاتجاه الأسبوعي وأكثر المشاكل', 'تحليل التعليقات بالذكاء الاصطناعي'], d: 'العميل يمسح رمز الطاولة ويقيّم تجربته، والمدير يتابع الشكاوى والاتجاهات والتوصيات لحظيًا.' }
];
const REG_IX = {}; REG_APPS.forEach(a => { REG_IX[a.id] = a; });

// v9.3 — تطبيقات الشاشة الرئيسية مُجمّعة (كل تطبيق يضمّ أقسامه المتشابهة، بنمط أودو)
// المحاسبة تطبيق واحد بثمانية أقسام، الموردون بثلاثة، المخزون بأربعة… (تطابق النموذج المعتمد)
const LAUNCH_APPS = [
  { id: 'pos', ar: 'نقطة البيع', en: 'Point of Sale', cat: 'pos', icon: Store, open: { tab: 'pos' }, kw: ['نقطة بيع', 'كاشير', 'بيع', 'فاتورة مبسطة', 'طلب', 'وردية'], sections: ['البيع', 'طلبات اليوم', 'الوردية'], d: 'بيع سريع بالأصناف وفاتورة مبسّطة برمز QR وورديات — يعمل دون إنترنت ويملأ الإغلاق اليومي.' },
  { id: 'analytics', tabs: ['analytics', 'alerts'], ar: 'التحليل والتنبيهات', en: 'Analytics & Alerts', cat: 'bi', icon: Compass, open: { tab: 'analytics' },
    sections: ['اللوحة التنفيذية', 'لوحة المؤشرات', 'مقارنة الفروع', 'تحليلات النمو', 'تحليل التعادل', 'لوحة الأهداف', 'ماذا-لو', 'المركز الذكي'], kw: ['تحليل', 'أداء', 'لوحة', 'تنفيذية', 'مؤشرات', 'مقارنة', 'فروع', 'نمو', 'تعادل', 'أهداف', 'سيناريو', 'ماذا لو', 'ذكاء', 'توقع', 'kpi'] },
  { id: 'alerts', hideOnHome: 'analytics', ar: 'مركز التنبيهات', en: 'Alerts', cat: 'bi', icon: Bell, open: { tab: 'alerts' },
    sections: ['موردون', 'موازنة', 'نقد وسيولة', 'مخزون', 'ضريبة', 'تشغيل', 'إعداد'], kw: ['تنبيه', 'تنبيهات', 'إنذار', 'متأخر', 'تجاوز', 'عجز', 'متابعة', 'إجراء'] },
  { id: 'acct', tabs: ['acct', 'treasury', 'entities'], ar: 'المالية والمحاسبة', en: 'Finance & Accounting', cat: 'fin', icon: Scale, open: { tab: 'acct' },
    sections: ['القيود اليومية', 'دليل الحسابات', 'ميزان المراجعة', 'القوائم المالية', 'مراكز التكلفة', 'الضريبة والزكاة', 'الأصول والإهلاك', 'التسوية البنكية', 'الإقفال الشهري'],
    kw: ['قيد', 'يومية', 'حساب', 'ميزان', 'قائمة', 'دخل', 'مركز مالي', 'مراكز تكلفة', 'أصل', 'إهلاك', 'بنك', 'تسوية', 'إقفال', 'قفل', 'محاسبة', 'ضريبة', 'قيمة مضافة', 'زكاة', 'زاتكا'] },
  { id: 'treasury', hideOnHome: 'acct', ar: 'الخزينة والترحيل', en: 'Treasury', cat: 'fin', icon: Landmark, open: { tab: 'treasury' },
    sections: ['التحويلات الواردة', 'حركة الخزينة'], kw: ['خزينة', 'تحويل', 'ترحيل', 'نقد', 'بنك'] },
  { id: 'reporting', ar: 'مركز التقارير', en: 'Reports Center', cat: 'fin', icon: FileBarChart, open: { tab: 'reporting' },
    sections: ['التقارير المالية', 'منشئ التقارير', 'تقرير الإدارة الشهري', 'التدفق النقدي (13 أسبوعًا)'], kw: ['تقرير', 'تقارير', 'طباعة', 'تصدير', 'منشئ', 'قالب', 'إدارة', 'شهري', 'حزمة', 'تدفق', 'نقدي', 'سيولة', 'مالية'] },
  { id: 'entities', hideOnHome: 'acct', ar: 'مركز المنشآت', en: 'Entities', cat: 'fin', icon: Building2, open: { tab: 'entities' },
    sections: ['النظرة الموحّدة', 'إدارة المنشآت', 'إسناد الفروع'], kw: ['منشأة', 'منشآت', 'شركة', 'شركات', 'كيان', 'موحّد', 'مجموعة', 'رقم ضريبي', 'تعدد'] },
  { id: 'closing', tabs: ['closing', 'approve', 'shifts', 'cashiers'], ar: 'الإغلاق اليومي والاعتماد', en: 'Daily Closing & Approvals', cat: 'pos', icon: ClipboardCheck, open: { tab: 'closing' },
    sections: ['تسجيل إغلاق اليوم', 'سجل الإغلاقات'], kw: ['اغلاق', 'إغلاق', 'وردية', 'مبيعات', 'صندوق', 'كاشير', 'نقطة بيع', 'نقاط البيع'] },
  { id: 'shifts', hideOnHome: 'closing', ar: 'مواعيد الإغلاق والتذكيرات', en: 'Closing Deadlines', cat: 'pos', icon: Clock, open: { tab: 'shifts' },
    sections: ['مواعيد الإغلاق', 'التذكيرات', 'المتأخرون'], kw: ['إغلاق', 'موعد', 'تذكير', 'تأخر', 'مراقبة'] },
  { id: 'hrops', hideOnHome: 'people', homeAr: 'الموارد البشرية', ar: 'الموارد البشرية — التشغيل', en: 'HR Operations', cat: 'hr', icon: Fingerprint, open: { tab: 'hrops' },
    sections: ['الحضور الموثَّق', 'محرّك الورديات', 'المهام', 'دفتر النقاط', 'التوقيع الإلكتروني'], kw: ['حضور', 'انصراف', 'وردية', 'مهام', 'نقاط', 'توقيع', 'pin', 'كيوسك', 'موظف'] },
  { id: 'hrperf', hideOnHome: 'hrops', homeAr: 'الموارد البشرية', ar: 'الأداء والانضباط', en: 'Performance & Discipline', cat: 'hr', icon: TrendingUp, open: { tab: 'hrperf' },
    sections: ['الأداء والتقييم', 'مؤشرات الأداء بالدور', 'المكافآت والجزاءات', 'الإجراءات التصحيحية', 'التدريب والشهادات', 'تجميد الأداء', 'لوحة الموارد البشرية'], kw: ['أداء', 'تقييم', 'kpi', 'مؤشر', 'مكافأة', 'جزاء', 'تأديب', 'إجراء', 'تدريب', 'شهادة', 'تجميد', 'لوحة'] },
  { id: 'qrfb', ar: 'تقييم العملاء (QR)', en: 'QR Customer Feedback', cat: 'pos', icon: QrCode, open: { tab: 'qrfb' },
    sections: ['لوحة التقييمات', 'الشكاوى', 'رموز QR للفروع'], kw: ['تقييم', 'عميل', 'عملاء', 'رضا', 'شكوى', 'شكاوى', 'QR', 'تعليق', 'نجوم', 'طاولة'] },
  { id: 'whbranch', ar: 'مستودع الفرع', en: 'Branch Warehouse', cat: 'inv2', icon: Truck, open: { tab: 'whbranch' },
    sections: ['الأرصدة', 'الوارد', 'طلب من الرئيسي', 'صرف وهدر', 'الجرد'], kw: ['مستودع', 'فرع', 'تحويل', 'استلام', 'طلب', 'هدر', 'جرد'] },
  { id: 'sales', ar: 'المبيعات', en: 'Sales', cat: 'pos', icon: CircleDollarSign, open: { tab: 'sales' },
    sections: ['حسب القناة', 'حسب الفرع', 'حسب التطبيق'], kw: ['مبيعات', 'نقاط البيع', 'نقطة بيع', 'قناة', 'نقد', 'شبكة', 'توصيل', 'تحليل'] },
  { id: 'approve', hideOnHome: 'closing', ar: 'التدقيق والاعتماد', en: 'Approvals', cat: 'pos', icon: ShieldCheck, open: { tab: 'approve' },
    kw: ['تدقيق', 'اعتماد', 'مراجعة'] },
  { id: 'brmgmt', ar: 'الإعدادات والمستخدمون', en: 'Settings & Users', cat: 'gov', icon: UserCog, open: { tab: 'admin' },
    sections: ['الفروع', 'المستخدمون والصلاحيات', 'بنود المصروف', 'تطبيقات التوصيل', 'ظهور التطبيقات'], kw: ['فرع', 'مستخدم', 'صلاحية', 'إعداد', 'مستخدمون'] },
  { id: 'purchasing', ar: 'المشتريات', en: 'Purchasing & Suppliers', cat: 'pur', icon: Truck, open: { tab: 'purchasing' },
    sections: ['الموردون والمشتريات', 'الفواتير والالتزامات', 'سجل الموردين', 'أوامر الشراء', 'المشتريات الذكية', 'إعادة الطلب'], kw: ['مورد', 'موردون', 'فاتورة', 'التزام', 'أمر شراء', 'دفع', 'مشتريات', 'شراء', 'إعادة طلب', 'نفاد', 'حد أدنى', 'مخزون', 'reorder'] },
  { id: 'partners', ar: 'جهات الاتصال', en: 'Contacts', cat: 'pur', icon: Users, open: { tab: 'partners' },
    kw: ['جهات الاتصال', 'اتصال', 'شريك', 'شركاء', 'دفتر', 'موردون', 'عملاء'] },
  { id: 'people', homeAr: 'الموارد البشرية', ar: 'شؤون الموظفين', en: 'People & Payroll', cat: 'hr', icon: Wallet, open: { tab: 'people' },
    sections: ['البيانات الرئيسية', 'السياسات والأدوار', 'الرواتب والسلف', 'تخطيط العمالة والتكلفة'], kw: ['راتب', 'رواتب', 'سلفة', 'موظف', 'أجور', 'جدولة', 'حضور', 'ساعات', 'عمالة', 'دوام', 'وردية', 'تذكير', 'شؤون', 'قسم', 'أقسام', 'وظيفة', 'وظائف', 'عقد', 'مستند', 'سياسة', 'سياسات', 'جيوفنس', 'موقع', 'رمز', 'QR', 'مدير مباشر', 'رئيس قسم'] },
  // v33.3: الضريبة جزء من «المالية والمحاسبة» (قسم الضريبة والزكاة) — لا تطبيق مستقل مكرر في الرئيسية؛ تبقى في البحث
  { id: 'vat', hideOnHome: 'acct', ar: 'ضريبة القيمة المضافة', en: 'VAT', cat: 'tax', icon: Receipt, open: { tab: 'acct', view: 'vat' },
    sections: ['احتساب الضريبة', 'الإقرار الضريبي'], kw: ['ضريبة', 'قيمة مضافة', 'زاتكا', 'مدخلات', 'مخرجات', 'إقرار'] },
  { id: 'inv', ar: 'المخزون والمنتجات', en: 'Inventory', cat: 'inv2', icon: HardDrive, open: { tab: 'inv' },
    sections: ['الأصناف', 'الحركات', 'الجرد', 'المنتجات والوصفات'], kw: ['مخزون', 'صنف', 'جرد', 'منتج', 'وصفة', 'مستودع', 'هدر'] },
  { id: 'docs', tabs: ['docs', 'archive'], ar: 'المستندات والأرشيف', en: 'Documents & Archive', cat: 'gov', icon: Stamp, open: { tab: 'docs' },
    sections: ['السجل التجاري', 'الشهادات والرخص', 'العقود والتأمين', 'تنبيهات الانتهاء'], kw: ['وثيقة', 'مستند', 'سجل تجاري', 'رخصة', 'شهادة', 'ضريبة', 'زكاة', 'عقد', 'انتهاء', 'صلاحية', 'تجديد'] },
  { id: 'archive', hideOnHome: 'docs', ar: 'أرشيف المستندات', en: 'Archive', cat: 'gov', icon: ImageIcon, open: { tab: 'archive' },
    kw: ['أرشيف', 'صورة', 'إيصال', 'مرفق'] },
  { id: 'audit', ar: 'سجل التدقيق', en: 'Audit Log', cat: 'gov', icon: Eye, open: { tab: 'audit' },
    kw: ['سجل', 'تدقيق', 'نشاط', 'إجراء'] },
  { id: 'backup', hideOnHome: 'brmgmt', ar: 'النسخ الاحتياطي', en: 'Backup', cat: 'gov', icon: Download, open: { tab: 'admin' },
    kw: ['نسخة', 'احتياطي', 'استعادة', 'لقطة', 'حماية'] },
];
const LAUNCH_IX = {}; LAUNCH_APPS.forEach(a => { LAUNCH_IX[a.id] = a; });
// v15.10: أقسام شاشة المحاسبة القابلة للتخصيص لكل مستخدم — تُخفى عبر appDeny بالمفتاح acctsec:<view>
const ACCT_SECTIONS = [
  { v: 'jr', ar: 'القيود اليومية' }, { v: 'coa', ar: 'دليل الحسابات' }, { v: 'tb', ar: 'ميزان المراجعة' },
  { v: 'fs', ar: 'القوائم المالية' }, { v: 'food', ar: 'تكلفة الطعام بالفروع' }, { v: 'cf', ar: 'التدفقات النقدية' }, { v: 'fcast', ar: 'التوقّع النقدي' },
  { v: 'bud', ar: 'الموازنة' }, { v: 'anl', ar: 'التحليل والنِسَب' }, { v: 'apage', ar: 'أعمار الموردين' },
  { v: 'arage', ar: 'أعمار العملاء' }, { v: 'export', ar: 'تصدير للمحاسب' }, { v: 'cc', ar: 'مراكز التكلفة' },
  { v: 'vat', ar: 'الضريبة (ق.م)' }, { v: 'einv', ar: 'الفوترة (زاتكا)' }, { v: 'zakat', ar: 'الزكاة وضريبة الدخل' },
  { v: 'ast', ar: 'الأصول والإهلاك' }, { v: 'bank', ar: 'التسوية البنكية' }, { v: 'mclose', ar: 'حزمة الإقفال' },
  { v: 'ctrl', ar: 'الضوابط والتدقيق' }, { v: 'lock', ar: 'الإقفال الشهري' }, { v: 'astl', ar: 'تسوية التطبيقات' },
  { v: 'ob', ar: 'الأرصدة الافتتاحية' }, { v: 'yend', ar: 'إقفال السنة' },
  { v: 'mizan', ar: 'استيراد البيانات التاريخية' }   // v28.2
];
const acctSecKey = (v) => 'acctsec:' + v;
const ACCT_SEC_AR = {}; ACCT_SECTIONS.forEach(s => { ACCT_SEC_AR[s.v] = s.ar; });
// v31.5 — ترتيب حسب دورة العمل: التشغيل اليومي (الإغلاق والمبيعات) ← المخزون والمشتريات وجهات الاتصال ←
// المالية والضريبة والتقارير والتحليل ← الموارد البشرية ← المستندات والإعدادات والتدقيق. المدمجة في غيرها في الآخر (لا تظهر مستقلة)
// v36.8: التطبيق الموحّد — أي من البطاقات الثلاث يظهر يحمل أقسام وكلمات بحث الثلاثة
(() => { const ids = ['hrops', 'people', 'hrperf']; const as = ids.map(id => LAUNCH_APPS.find(a => a.id === id)).filter(Boolean);
  const secs = [...new Set(as.flatMap(a => a.sections || []))], kw = [...new Set(as.flatMap(a => a.kw || []))];
  as.forEach(a => { a.sections = secs; a.kw = kw; }); })();
const LAUNCH_ORDER = ['pos', 'closing', 'sales', 'qrfb', 'whbranch', 'inv', 'purchasing', 'partners', 'acct', 'vat', 'reporting', 'analytics', 'hrops', 'people', 'hrperf', 'docs', 'brmgmt', 'audit', 'approve', 'shifts', 'alerts', 'treasury', 'entities', 'archive', 'backup'];
const launchRank = (id) => { const i = LAUNCH_ORDER.indexOf(id); return i < 0 ? 999 : i; };
/* v8.5 — لقطات احتياطية يومية محلية (IndexedDB) على أجهزة الإدارة:
   حماية إضافية ضد التلف أو الحذف الخاطئ — والنسخة الملفية تبقى الحماية الخارجية */
const snapDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('rms8-snaps', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('snaps', { keyPath: 'key' }); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const snapPut = async (key, val) => { const db = await snapDB(); return new Promise((res, rej) => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').put({ key, ...val }); tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); rej(tx.error); }; }); };
const snapAll = async () => { const db = await snapDB(); return new Promise((res, rej) => { const rq = db.transaction('snaps').objectStore('snaps').getAll(); rq.onsuccess = () => { db.close(); res(rq.result || []); }; rq.onerror = () => { db.close(); rej(rq.error); }; }); };
const snapDel = async (key) => { const db = await snapDB(); return new Promise((res, rej) => { const tx = db.transaction('snaps', 'readwrite'); tx.objectStore('snaps').delete(key); tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); rej(tx.error); }; }); };
// فحص سلامة نسخة احتياطية: البنية + تشغيل المحرك المحاسبي عليها والتأكد من توازنها
function verifyBackup(data) {
  try {
    if (!data || typeof data !== 'object') return { ok: false, err: 'الملف ليس نسخة صالحة' };
    if (!data.org || !Array.isArray(data.org.branches) || !Array.isArray(data.org.users)) return { ok: false, err: 'بنية المنشأة ناقصة (فروع/مستخدمون)' };
    const ops2 = data.ops || {};
    const A = buildAccounting(data.org, ops2);
    return {
      ok: true,
      counts: {
        branches: (data.org.branches || []).length, users: (data.org.users || []).length,
        closings: (ops2.closings || []).length, suppliers: (data.org.suppliers || []).length,
        items: (data.org.items || []).length, assets: (data.org.assets || []).length,
        entries: A.entries.length
      },
      balanced: A.balanced, totalDebit: A.totalDebit,
      exportedAt: (data.meta && data.meta.exportedAt) || data.exportedAt || '', by: (data.meta && data.meta.by) || ''
    };
  } catch (e) { return { ok: false, err: 'تعذّرت قراءة النسخة: ' + (e.message || '') }; }
}

// تفضيلات الاستخدام لكل مستخدم (مفضلة + آخر استخدام) — محلية على الجهاز
const appUseGet = (uid) => { try { return JSON.parse(localStorage.getItem('rms8:appuse:' + uid) || '{}') || {}; } catch { return {}; } };
const appUseSet = (uid, v) => { try { localStorage.setItem('rms8:appuse:' + uid, JSON.stringify(v)); } catch { } };
// يقبل كائن المستخدم (لتخصيص الظهور لكل مستخدم) أو نص الدور (توافق قديم)
/* ===== v35.4 — قائمة الدخل بالشكل المحاسبي للمطاعم =====
   صافي المبيعات ← تكلفة المبيعات ← مجمل الربح ← مصروفات التشغيل (مجمّعة) ← الربح التشغيلي ← بنود أخرى ← صافي الربح.
   amt بإشارة الأثر على الربح: الإيراد موجب والمصروف سالب (يظهر بين قوسين). لا يغيّر أي قيد — عرض فقط، والمجموع = revP − expP. */
const IS_COGS_RX = /مواد|مشتريات|بضاعة|خامات|طعام|لحوم|خضار|دواجن|أسماك|مخبوزات|ألبان/;
const isLayout = (accounts, balFn, keep) => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const L = (a, sg) => ({ code: a.code, name: a.name, amt: r2(sg * balFn(a)) });
  const nz = (l) => Math.abs(l.amt) > 0.004 || !!(keep && keep.has(l.code));
  const rev = accounts.filter(a => a.kind === 'rev'), exp = accounts.filter(a => a.kind === 'exp');
  const otherRev = (a) => /^42/.test(a.code);
  const otherExp = (a) => /^58/.test(a.code);
  const cogsOf = (a) => ['5501', '5502', '5503', '5198', '5150'].includes(a.code) || (/^51/.test(a.code) && IS_COGS_RX.test(a.name || ''));
  const grpOf = (a) => /^52/.test(a.code) ? 'pay' : /^53/.test(a.code) ? 'apps' : a.code === '5701' ? 'dep' : 'oth';
  const sales = rev.filter(a => !otherRev(a)).map(a => L(a, 1)).filter(nz);
  const cogs = exp.filter(cogsOf).map(a => L(a, -1)).filter(nz);
  const opex = exp.filter(a => !cogsOf(a) && !otherExp(a)).map(a => ({ ...L(a, -1), g: grpOf(a) })).filter(nz);
  const other = [...rev.filter(otherRev).map(a => L(a, 1)), ...exp.filter(otherExp).map(a => L(a, -1))].filter(nz);
  const S = (ls) => r2(ls.reduce((t, l) => t + l.amt, 0));
  const netSales = S(sales), cogsT = S(cogs), gross = r2(netSales + cogsT), opexT = S(opex), oper = r2(gross + opexT), otherT = S(other), net = r2(oper + otherT);
  const G = [['pay', 'الرواتب والمزايا'], ['apps', 'عمولات وخصومات التطبيقات'], ['dep', 'الإهلاك'], ['oth', 'مصروفات تشغيل أخرى']]
    .map(([k, t]) => ({ k, t, lines: opex.filter(l => l.g === k).sort((x, y) => x.amt - y.amt) })).filter(g => g.lines.length);
  return { sales, cogs, opexG: G, other, netSales, cogsT, gross, opexT, oper, otherT, net };
};
// v35.7 — المركز المالي بالتبويب المحاسبي: متداول/غير متداول للأصول والخصوم، ثم حقوق الملكية (عرض فقط — المجاميع = bsAssets و bsLiab+bsEquity+bsProfit)
const bsLayout = (accounts, balFn, profit) => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const L = (a) => ({ code: a.code, name: a.name, amt: r2(balFn(a)) });
  const nz = (l) => Math.abs(l.amt) > 0.004;
  const S = (ls) => r2(ls.reduce((t, l) => t + l.amt, 0));
  const ncA = (a) => /^17/.test(a.code), ncL = (a) => a.code === '2203';
  const ca = accounts.filter(a => a.kind === 'asset' && !ncA(a)).map(L).filter(nz);
  const nca = accounts.filter(a => a.kind === 'asset' && ncA(a)).map(L).filter(nz);
  const cl = accounts.filter(a => a.kind === 'liab' && !ncL(a)).map(L).filter(nz);
  const ncl = accounts.filter(a => a.kind === 'liab' && ncL(a)).map(L).filter(nz);
  const eq = [...accounts.filter(a => a.kind === 'equity').map(L).filter(nz), ...(Math.abs(profit) > 0.004 ? [{ code: 'P', name: 'أرباح الفترة غير المقفلة', amt: r2(profit) }] : [])];
  const Y = { ca, nca, cl, ncl, eq, caT: S(ca), ncaT: S(nca), clT: S(cl), nclT: S(ncl), eqT: S(eq) };
  Y.assets = r2(Y.caT + Y.ncaT); Y.liab = r2(Y.clT + Y.nclT); Y.le = r2(Y.liab + Y.eqT);
  Y.wc = r2(Y.caT - Y.clT); Y.cr = Y.clT > 0.004 ? Math.round(Y.caT / Y.clT * 100) / 100 : null;
  return Y;
};
const bsRowsOf = (Y, ok) => {
  const out = [];
  const grp = (t, ls, subL, subV) => { if (!ls.length) return; out.push({ t: 'grp', label: t }); ls.forEach(l => out.push({ t: 'line', label: l.name, amt: l.amt })); out.push({ t: 'sub', label: subL, amt: subV }); };
  out.push({ t: 'head', label: 'الأصول' });
  grp('الأصول المتداولة', Y.ca, 'إجمالي الأصول المتداولة', Y.caT);
  grp('الأصول غير المتداولة', Y.nca, 'إجمالي الأصول غير المتداولة', Y.ncaT);
  out.push({ t: 'total', label: 'إجمالي الأصول', amt: Y.assets });
  out.push({ t: 'head', label: 'الخصوم وحقوق الملكية' });
  grp('الخصوم المتداولة', Y.cl, 'إجمالي الخصوم المتداولة', Y.clT);
  grp('الخصوم غير المتداولة', Y.ncl, 'إجمالي الخصوم غير المتداولة', Y.nclT);
  out.push({ t: 'total', label: 'إجمالي الخصوم', amt: Y.liab });
  grp('حقوق الملكية', Y.eq, 'إجمالي حقوق الملكية', Y.eqT);
  out.push({ t: 'net', label: 'إجمالي الخصوم وحقوق الملكية' + (ok ? ' ✓' : ' — لا يطابق!'), amt: Y.le });
  return out;
};
// صفوف موحّدة للعرض والطباعة والتصدير: t = head|line|sub|grp|total
const isRowsOf = (Y) => {
  const out = [];
  out.push({ t: 'head', label: 'الإيرادات' });
  Y.sales.forEach(l => out.push({ t: 'line', k: l.code, label: l.name, amt: l.amt }));
  out.push({ t: 'sub', k: 'NS', label: 'صافي المبيعات', amt: Y.netSales });
  if (Y.cogs.length) { out.push({ t: 'head', label: 'تكلفة المبيعات' }); Y.cogs.forEach(l => out.push({ t: 'line', k: l.code, label: l.name, amt: l.amt })); out.push({ t: 'sub', k: 'CG', label: 'إجمالي تكلفة المبيعات', amt: Y.cogsT }); }
  out.push({ t: 'total', k: 'GP', label: Y.gross >= 0 ? 'مجمل الربح' : 'مجمل الخسارة', amt: Y.gross });
  if (Y.opexG.length) {
    out.push({ t: 'head', label: 'مصروفات التشغيل' });
    Y.opexG.forEach(g => { out.push({ t: 'grp', k: 'G' + g.k, label: g.t, amt: Math.round(g.lines.reduce((x, l) => x + l.amt, 0) * 100) / 100 }); g.lines.forEach(l => out.push({ t: 'line', k: l.code, label: l.name, amt: l.amt, ind: 2 })); });
    out.push({ t: 'sub', k: 'OX', label: 'إجمالي مصروفات التشغيل', amt: Y.opexT });
  }
  out.push({ t: 'total', k: 'OP', label: Y.oper >= 0 ? 'الربح التشغيلي' : 'الخسارة التشغيلية', amt: Y.oper });
  if (Y.other.length) { out.push({ t: 'head', label: 'إيرادات ومصروفات أخرى' }); Y.other.forEach(l => out.push({ t: 'line', k: l.code, label: l.name, amt: l.amt })); out.push({ t: 'sub', k: 'OT', label: 'صافي البنود الأخرى', amt: Y.otherT }); }
  out.push({ t: 'net', k: 'NP', label: Y.net >= 0 ? 'صافي الربح' : 'صافي الخسارة', amt: Y.net });
  return out;
};
const appCanSee = (meOrRole, a) => {
  const role = typeof meOrRole === 'string' ? meOrRole : meOrRole?.role;
  const R = ROLES[role] || {};
  if (a.soon) return R.scope === 'all' && !R.limitedApps;  // خارطة الطريق تظهر لأدوار المركز فقط (لا للأدوار المحدودة)
  if (meOrRole && typeof meOrRole === 'object') {
    if ((meOrRole.appDeny || []).includes(a.id)) return false;   // مُخفى يدويًا لهذا المستخدم
    if ((meOrRole.appAllow || []).includes(a.id)) return true;   // مُضاف يدويًا فوق دوره
  }
  return (a.tabs || [a.open.tab]).some(t => (R.tabs || []).includes(t));   // الأساس: صلاحيات الدور (v31.5: التطبيق المدمج يظهر إن سُمح بأي من أقسامه)
};
const appOpenNow = (a, me, setTab, openAcctView, openInvView) => {
  if (a.soon) return false;
  const u = appUseGet(me.id); const r = (u.rec = u.rec || {});
  r[a.id] = { at: Date.now(), count: ((r[a.id] || {}).count || 0) + 1 };
  appUseSet(me.id, u);
  if (a.open.view) {
    if (a.open.tab === 'acct' && openAcctView) openAcctView(a.open.view);
    if (a.open.tab === 'inv' && openInvView) openInvView(a.open.view);
  }
  // v31.5: التطبيق المدمج يفتح على أول قسم مسموح للمستخدم
  const rt = (ROLES[me.role] || {}).tabs || [];
  setTab(a.tabs && !rt.includes(a.open.tab) ? (a.tabs.find(t => rt.includes(t)) || a.open.tab) : a.open.tab);
  return true;
};



/* ============================================================
   ميزان — منصة إدارة المطاعم (سابقًا: منصة الإغلاق اليومي) — v28.6
   نسخة تفاعلية متعددة المستخدمين — بيانات مشتركة سحابياً
   ============================================================ */



/* ================= أدوات ================= */
/* ================= البيانات التأسيسية ================= */
function rnd(seed) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }

function emptyOrg(company) {
  return {
    company: company || {
      name: '', activity: 'مطاعم ومقاهي', taxNumber: '', commercialReg: '',
      phone: '', email: '', address: '', logoUrl: ''
    },
    branches: [],
    users: [],
    employees: [],
    departments: [],
    positions: [],
    expenseCats: EXP_CATS.map(c => ({ ...c, budgetLimitMonthly: 0 })),
    deliveryApps: APPS,
    suppliers: [],
    partners: [],
    setupComplete: false
  };
}

function emptyOps() {
  return { countSessions: [], wasteRequests: [], posImports: [], posOrders: [], posShifts: [], ledgerSnaps: [], stockCounts: [], leaveRequests: [], productSales: [], salesInvoices: [], closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [], ledgerEntries: [], partnerRequests: [], journalManual: [], purchaseOrders: [], stockMoves: [], bankRecs: [], closingInvPays: [], appSettlements: [], schedules: [], branchPartners: [],
    attendanceEvents: [], hrPins: [], shiftTemplates: [], shiftAssignments: [], shiftSwapRequests: [], branchTransferRequests: [], taskTemplates: [], taskAssignments: [], taskCompletions: [], pointsEntries: [], qualityReviews: [], rewardRequests: [], hrSignDocs: [], hrCorrective: [], hrPips: [], hrTraining: [], hrKpiEntries: [], hrScoreSnapshots: [] };
}


/* ================= الجذر ================= */
// v28.0 — رابط رمز QR للعميل (?rate=<branchId>) يعرض صفحة التقييم العامة قبل أي إقلاع أو بوابة دخول
/* v32.0 — حاجز الأخطاء: أي خطأ في شاشة يُعرض رسالة عربية مع «إعادة المحاولة» بدل شاشة سوداء،
   ويُحفظ آخر 20 خطأ على الجهاز (للإرسال للدعم) — لا تتوقف المنصة كلها بسبب قسم واحد */
const ERRLOG_KEY = 'mizan:errlog';
function logClientError(err, where) {
  try {
    const a = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]');
    a.unshift({ at: new Date().toISOString(), where: where || '', msg: String((err && err.message) || err).slice(0, 300), stack: String((err && err.stack) || '').slice(0, 900), v: 'v35.2' });
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(a.slice(0, 20)));
  } catch { }
}
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null, copied: false }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { logClientError(err, (this.props.where || '') + ' ' + String((info && info.componentStack) || '').split('\n').slice(0, 3).join(' ').trim()); }
  render() {
    if (!this.state.err) return this.props.children;
    const full = this.props.full;
    const txt = 'الموقع: ' + (this.props.where || 'المنصة') + '\nالخطأ: ' + String(this.state.err && this.state.err.message) + '\nالوقت: ' + new Date().toISOString();
    const box = (
      <div className="card" style={{ maxWidth: 560, margin: full ? '12vh auto' : '10px auto', textAlign: 'center', borderColor: 'rgba(217,84,77,.45)' }}>
        <div style={{ fontSize: 34 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '6px 0' }}>حدث خطأ في {this.props.where || 'المنصة'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.8 }}>بياناتك سليمة ولم يُحفظ شيء خاطئ. جرّب «إعادة المحاولة»، وإن تكرر الخطأ فانسخ التفاصيل وأرسلها للدعم.</div>
        <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn pri" onClick={() => this.setState({ err: null })}>إعادة المحاولة</button>
          {full && <button className="btn" onClick={() => location.reload()}>تحديث الصفحة</button>}
          <button className="btn gh" onClick={() => { try { navigator.clipboard.writeText(txt); this.setState({ copied: true }); } catch { } }}>{this.state.copied ? 'نُسخت ✓' : 'نسخ تفاصيل الخطأ'}</button>
        </div>
        <div className="num" style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10, direction: 'ltr' }}>{String(this.state.err && this.state.err.message).slice(0, 160)}</div>
      </div>);
    return full ? <div className="rms mode-dark thm-mizan" style={{ minHeight: '100vh', background: '#141210', padding: 16 }}>{box}</div> : box;
  }
}
export { ErrorBoundary, logClientError };
if (typeof window !== 'undefined' && !window.__mizanErrHook) {
  window.__mizanErrHook = true;
  window.addEventListener('error', (e) => logClientError(e.error || e.message, 'window'));
  window.addEventListener('unhandledrejection', (e) => logClientError(e.reason, 'promise'));
}

export default function App() {
  const [rateId] = useState(qrRateParam);
  return rateId ? <QrRatePublic branchId={rateId} /> : <PlatformApp />;
}

function PlatformApp() {
  useEffect(() => { const h = setTimeout(prefetchMods, 2500); return () => clearTimeout(h); }, []);   // v38.3 جلب التطبيقات في الخلفية بعد ظهور الواجهة
  const [org, setOrg] = useState(null);
  const orgNow = useRef(null); orgNow.current = org;   // v29.5: للحارس المركزي للإقفال داخل writeOps
  const [ops, setOps] = useState({ closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [], ledgerEntries: [], partnerRequests: [], journalManual: [], purchaseOrders: [], stockMoves: [], bankRecs: [], closingInvPays: [], appSettlements: [], schedules: [], branchPartners: [] });
  const opsNow = useRef(null); opsNow.current = ops;   // v29.5: للحارس المركزي للإقفال داخل commitOrg
  const [pulse, setPulse] = useState({ presence: {}, audit: [] });
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('home');
  const [acctIntent, setAcctIntent] = useState(null);          // فتح المحاسبة على شاشة محددة من مركز التطبيقات
  const openAcctView = useCallback((v) => setAcctIntent({ v, ts: Date.now() }), []);
  const [invIntent, setInvIntent] = useState(null);            // فتح المخزون على شاشة محددة
  const openInvView = useCallback((v) => setInvIntent({ v, ts: Date.now() }), []);
  const [drawer, setDrawer] = useState(false);
  const [moreSheet, setMoreSheet] = useState(false);
  const [userMenu, setUserMenu] = useState(false);   // v9.6 قائمة الحساب في الرأس
  const [themePick, setThemePick] = useState(false); // v14.3 منتقي الثيمات
  const touchRef = useRef({ x0: 0, y0: 0, active: false, mode: null });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [boot, setBoot] = useState('loading');
  const [toast, setToast] = useState(null);
  const [bell, setBell] = useState(false);
  const [lastSeenAudit, setLastSeenAudit] = useState(() => Date.now());
  const [theme, setTheme] = useState(() => { try { if (localStorage.getItem('rms8:themeV35') !== '1') { localStorage.setItem('rms8:themeV35', '1'); localStorage.setItem('rms8:theme', 'mizan'); return 'mizan'; } return normTheme(localStorage.getItem('rms8:theme') || 'mizan'); } catch { return 'mizan'; } });
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('rms8:mode') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [tour, setTour] = useState(false);
  const [live, setLive] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);   // v11.1 توفّر نسخة أحدث منشورة
  // v27.1 — تشخيص صلاحيات الخادم على جهاز الفرع: {kind:'dir'|'branch'|'member', ids, mem, expected}
  // (سابقًا كان رفض القراءة يسقط بصمت إلى نسخة localStorage القديمة فتبدو الشاشات «تعمل» بينما كل كتابة سحابية ترفض)
  const [accessErr, setAccessErr] = useState(null);
  const lastDupMsg = useRef('');
  const lastWriteErr = useRef('');   // 'denied' | 'net' | 'scope' | ''
  const [brSetVer, setBrSetVer] = useState(0);   // v27.3: يتغيّر عند تغيّر مجموعة الفروع المشترَك بها — يُعيد بناء الاشتراكات الحيّة
  const sid = useRef(uid('s'));
  // v15.29 — جلسة واحدة لكل مستخدم (عدا أدوار الإدارة): هوية ثابتة لهذا المتصفح تبقى
  // عبر إعادة التحميل وتتشاركها تبويبات المتصفح الواحد (فلا يطرد المتصفح نفسه)،
  // بينما يحمل كل متصفح/جهاز آخر هوية مختلفة فيُكشف الدخول المزدوج ويُنهى الأقدم.
  const bsid = useRef((() => {
    try {
      if (typeof window !== 'undefined' && window.__bsidTest) return window.__bsidTest;   // خطّاف اختبار آلي فقط
      let v = localStorage.getItem('rms8:bsid');
      if (!v) { v = uid('bw'); localStorage.setItem('rms8:bsid', v); }
      return v;
    } catch { return uid('bw'); }
  })());
  const claimRef = useRef({ done: false, at: 0 });          // مطالبة هذا المتصفح بجلسة المستخدم الحالي
  const [kickMsg, setKickMsg] = useState(null);             // سبب الإنهاء التلقائي — يُعرض في بوابة الدخول
  const toastTimer = useRef(null);

  // v15.14: نلغي أي مؤقّت إخفاء سابق قبل جدولة مؤقّت جديد — وإلا فرسالة سريعة تالية لأخرى
  // خلال أقل من 3.2 ثانية (كإضافة شريك ثم ترقيته مباشرة) قد تُخفى قبل أن يراها المستخدم،
  // لأن مؤقّت الرسالة الأقدم كان سيبقى يعمل ويُخفي الرسالة الأحدث دون علاقة بها.
  const say = useCallback((msg, kind) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind: kind || 'ok' });
    // v37.1: رسائل التنبيه/الخطأ تبقى أطول (تحتاج قراءة)، والنجاح قصيرة؛ والضغط يُغلقها
    toastTimer.current = setTimeout(() => setToast(null), kind === 'no' ? 6500 : 3200);
  }, []);

  /* --- الإقلاع: مع المصادقة السحابية لا تُحمَّل أي بيانات قبل دخول حقيقي --- */
  const [needAuth, setNeedAuth] = useState(false);

  // v9: سياق الجلسة — مركزية (ترى كل الفروع) أم فرعية (مستند فرعها فقط)
  const dataCtx = useRef({ central: true, myBrIds: [], email: '' });

  const loadAll = useCallback(async (email) => {
    if (email) dataCtx.current.email = (email || '').toLowerCase();
    const t = await cloud.tryGet(KEYS.org);
    let o = t.value;

    if (t.denied || (window.__forceDirOnly && !o?.__ignore)) {
      /* ===== مسار الفرع: الخادم رفض المنشأة الكاملة — نقرأ الدليل العام فقط ===== */
      // v27.1: tryGet بدل get — رفض الصلاحيات يُعلَن صراحةً (ولا يُخفى بنسخة localStorage قديمة)
      const dr = await cloud.tryGet(KEYS.dir);
      const dir = dr.value || null;
      if (dr.denied) setAccessErr({ kind: 'dir' });
      if (!dir) { setBoot('ready'); setNeedAuth(false); setOrg(emptyOrg()); setOps(emptyOps()); return emptyOrg(); }
      o = { ...emptyOrg(), ...dir };
      const em = dataCtx.current.email || ((await authApi.ready()) || {}).email || '';
      const meU = (o.users || []).find(x => (x.email || '').toLowerCase() === em && x.isActive);
      // v27.1: نطاق الجلسة يطابق myBranches حرفيًا (المدير الإقليمي = فروعه المُسندة وإن كان له branchId)
      const myBr = branchIdsOfUser(meU) || [];
      dataCtx.current = { central: false, myBrIds: myBr, email: em };
      const brMap = {}; const deniedBr = [];
      // v29.0: مستندات فروع المستخدم + النبض بالتوازي بدل الطابور
      const [brRes, pulseB] = await Promise.all([Promise.all(myBr.map(b => cloud.tryGet(brKey(b)))), cloud.get(KEYS.pulse, { presence: {}, audit: [] })]);
      myBr.forEach((b, i) => { const r = brRes[i]; if (r.denied) deniedBr.push(b); brMap[b] = r.value || {}; });
      if (deniedBr.length) {
        // نقارن عضوية الخادم (التي تعتمد عليها القواعد) بسجل المستخدم في المنصة لتسمية السبب بدقة
        let mem = null; try { mem = await authApi.myMembership(); } catch { mem = null; }
        setAccessErr({ kind: 'branch', ids: deniedBr, mem, expected: myBr });
      }
      docsCache.current = { core: null, br: brMap };
      setOps(composeOps(null, brMap));
      setOrg(o);
      setPulse(pulseB);
      setLastSync(new Date()); setBoot('ready');
      return o;
    }

    /* ===== مسار المركز ===== */
    // v28.1: قراءة فاشلة أو مستند تالف ≠ منصة جديدة — لا نكتب منشأة فارغة فوق بيانات لم نستطع قراءتها
    if (!o && cloud.readFailed(KEYS.org)) { setBoot('error'); return null; }
    if (!o || !o.branches) {
      o = emptyOrg();
      await cloud.set(KEYS.org, o);
      await cloud.set(KEYS.ops, emptyOps());
      await cloud.set(KEYS.pulse, { presence: {}, audit: [] });
    }
    // الهجرة الآمنة لمرة واحدة: لقطة أمان ثم تقسيم القديم
    if (!o.migratedV9 && (o.branches || []).length) {
      try { const oldOps = (await cloud.get(KEYS.ops, null)) || emptyOps(); await snapPut('pre-v9-migration-' + today(), { at: nowISO(), by: 'migration', org: o, ops: oldOps }); } catch { }
      const oldOps = (await cloud.get(KEYS.ops, null)) || emptyOps();
      o = await migrateV9(o, oldOps);
    }
    // مزامنة نطاقات الأعضاء (فرع/مركز) مع مستندات العضوية — تعتمد عليها القواعد الخادمية
    if (authApi.enabled && o.migratedV9 && !o.membersSyncedV9) {
      try {
        for (const u2 of (o.users || [])) {
          if (!u2.email) continue;
          await authApi.upsertMember(u2.email, { active: u2.isActive !== false, role: u2.role, branchId: u2.branchId || '', branchIds: u2.allowedBranchIds || [], scope: (ROLES[u2.role]?.scope === 'all') ? 'all' : 'branch' });
        }
        o = { ...o, membersSyncedV9: nowISO() };
        await cloud.set(KEYS.org, o);
      } catch { }
    }
    // v24.0: نقل بيانات HR من org إلى مستندات الفروع + تجديد الدليل العام (يحمل الآن إعدادات HR غير الحساسة) — مرة واحدة
    if (o.migratedV9 && !o.hrMigratedV24) {
      try {
        const o3 = await migrateHrToOps(o);
        if (await cloud.set(KEYS.org, o3)) { o = o3; try { await cloud.set(KEYS.dir, dirOf(o)); } catch { } }
      } catch (e) { console.warn('هجرة HR v24.0 لم تكتمل — ستُعاد في التحميل التالي:', e); }
    }
    // v28.1: مع مصادقة Firebase لا مكان لبصمات كلمات السر في مستند المنشأة (يقرؤه كل دور مركزي) — تُحذف مرة واحدة
    if (authApi.enabled && (o.users || []).some(u2 => u2.passHash || u2.pin)) {
      const o4 = { ...o, users: o.users.map(u2 => { const { passHash, pin, ...rest } = u2; return rest; }) };
      if (await cloud.set(KEYS.org, o4)) o = o4;
    }
    const branchIds = (o.branches || []).map(b => b.id);
    dataCtx.current = { central: true, myBrIds: branchIds, email: dataCtx.current.email };
    // v29.0: مستند المركز ومستندات الفروع ونبض النظام تُقرأ معًا بالتوازي بدل الطابور
    const [core0, brVals, pulse0] = await Promise.all([
      cloud.get(KEYS.core, null),
      Promise.all(branchIds.map(b => cloud.get(brKey(b), null))),
      cloud.get(KEYS.pulse, { presence: {}, audit: [] })
    ]);
    const core = core0 || {};
    const brMap = {};
    branchIds.forEach((b, i) => { brMap[b] = brVals[i] || {}; });
    // v27.1: تهيئة المخبأ الحيّ منذ الإقلاع — كان يبقى فارغًا حتى تصل لقطة كل مستند فرع (ومستند فرع غير موجود
    // لا يرسل لقطة أبدًا) فتتعطّل إعادة التجميع اللحظية حتى أول استطلاع دوري (5 دقائق) — أي أن حضورًا يُسجَّل
    // من جهاز فرع قد لا يظهر في المركز إلا بعد دقائق أو بعد «مزامنة الآن».
    docsCache.current = { core, br: brMap };
    setOps(composeOps(core, brMap));
    setOrg(o);
    setPulse(pulse0);
    setLastSync(new Date());
    setBoot('ready');
    return o;
  }, []);

  useEffect(() => {
    (async () => {
      if (authApi.enabled) {
        const u = await authApi.ready();
        if (!u) { setNeedAuth(true); setBoot('ready'); return; }   // بوابة الدخول أولاً
        await authApi.bootstrap();
        // جلسة قائمة لعضوية أُوقفت لاحقاً → خروج وعرض البوابة (الرسالة تظهر عند محاولة الدخول)
        const mem = await authApi.myMembership();
        if (mem && !mem.active) {
          await authApi.signOutAll().catch(() => { });
          setNeedAuth(true); setBoot('ready'); return;
        }
        const o2 = await loadAll(u.email);
        // v15.15 — إصلاح جذري: جلسة موثّقة قائمة كانت تحمّل البيانات ثم تعرض بوابة «ثانية»
        // تفحص كلمة السر محليًا (passHash قد يكون قديمًا/غير متزامن) فيعلق المستخدم على
        // «كلمة السر غير صحيحة» رغم أن مصادقته السحابية صحيحة تمامًا. الصحيح: من اجتاز
        // المصادقة السحابية وعضويته نشطة وحسابه مسجَّل بالمنصة يدخل مباشرة — نفس منطق
        // finishFb حرفيًا بعد الدخول اليدوي.
        const uu = ((o2 && o2.users) || []).find(x => (x.email || '').toLowerCase() === u.email && x.isActive);
        if (uu) {
          setMe(uu); setTab('home');
          try { localStorage.setItem('rms8:lastEmail', uu.email || ''); } catch { }
        } else if (((o2 && o2.users) || []).length > 0) {
          // جلسة موثّقة لبريد لم يعد مسجّلًا/نشطًا بالمنصة (حساب حُذف مثلاً): خروج وبوابة
          // المصادقة — لا بوابة محلية عالقة بلا مخرج.
          await authApi.signOutAll().catch(() => { });
          setNeedAuth(true);
        }
        return;
      }
      await loadAll();
    })();
  }, [loadAll]);

  /* --- دخول المصادقة السحابية --- */
  const mapAuthErr = (e) => {
    const c = String((e && e.code) || '');
    if (c.includes('user-not-found')) return 'لا يوجد حساب مصادقة بهذا البريد — إن كنت المالك استخدم «الإعداد الأول»، وإلا اطلب من المدير إنشاءه';
    if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'كلمة السر غير صحيحة';
    if (c.includes('too-many-requests')) return 'محاولات كثيرة — انتظر دقائق ثم أعد المحاولة';
    if (c.includes('email-already-in-use')) return 'هذا البريد له حساب مصادقة — استخدم «دخول» بكلمة سرّه';
    if (c.includes('weak-password')) return 'كلمة السر ضعيفة — 6 أحرف على الأقل';
    if (c.includes('invalid-email')) return 'صيغة البريد غير صحيحة';
    if (c.includes('network')) return 'تعذّر الاتصال — تحقق من الشبكة';
    return 'تعذّر الدخول (' + c.replace('auth/', '') + ')';
  };

  const finishFb = useCallback(async (email) => {
    await authApi.bootstrap();
    // بوابة العضوية: موثّق بلا عضوية نشطة لا يُكمل — رسالة واضحة بدل شاشة مشوّشة
    const mem = await authApi.myMembership();
    if (mem && !mem.active) {
      await authApi.signOutAll().catch(() => { });
      return {
        ok: false, err: mem.exists
          ? 'عضويتك موقوفة — راجع مسؤول النظام'
          : 'حسابك موثّق لكن عضويتك غير مهيأة بعد — اطلب من المدير فتح حسابك في «الفروع والمستخدمون» وحفظه'
      };
    }
    const o = await loadAll(email);
    if (!o) return { ok: false, err: 'تعذّرت قراءة بيانات المنصة من السحابة — لم يُكتب شيء، أعد المحاولة بعد لحظات' };
    const u = (o.users || []).find(x => (x.email || '').toLowerCase() === email && x.isActive);
    if (!u && (o.users || []).length > 0) {
      await authApi.signOutAll().catch(() => { });
      return { ok: false, err: 'حسابك موثّق لكنه غير مُسجَّل في المنصة — يضيفه مسؤول النظام من «الفروع والمستخدمون»' };
    }
    setNeedAuth(false);
    if (u) {
      setMe(u); setTab('home');
      try { localStorage.setItem('rms8:lastEmail', u.email || ''); } catch { }
    }
    return { ok: true };   // لا مستخدمين بعد → شاشة التهيئة الأولى
  }, [loadAll]);

  const fbLogin = useCallback(async (email, pass) => {
    interactiveLogin.current = true;
    try { const r = await authApi.signIn(email, pass); return await finishFb(r.email); }
    catch (e) {
      if (e && e.code === 'mfa-required') return { ok: false, mfa: true };
      if (e && e.code === 'mfa-unsupported') return { ok: false, err: 'حسابك محمي بعامل تحقق لا تدعمه المنصة — راجع مسؤول النظام' };
      return { ok: false, err: mapAuthErr(e) };
    }
  }, [finishFb]);
  // v31.3 — الخطوة الثانية: رمز تطبيق المصادقة
  const fbMfa = useCallback(async (code) => {
    try { const r = await authApi.mfaVerify(code); return await finishFb(r.email); }
    catch (e) { const c = String((e && e.code) || '');
      return { ok: false, err: c.includes('invalid-verification-code') || c.includes('invalid-credential') ? 'الرمز غير صحيح — تأكد من وقت الهاتف واستخدم الرمز الحالي' : c.includes('expired') || c.includes('mfa-expired') ? 'انتهت مهلة الخطوة الثانية — أعد إدخال كلمة السر' : 'تعذّر التحقق (' + c.replace('auth/', '') + ')' }; }
  }, [finishFb]);

  const fbFirstSetup = useCallback(async (email, pass) => {
    try { const r = await authApi.firstSetup(email, pass); return await finishFb(r.email); }
    catch (e) { return { ok: false, err: mapAuthErr(e) }; }
  }, [finishFb]);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // v16.2 — بطلب المالك: نوافذ الإدخال والاستعراض تتبع ألوان الشاشة (الوضع الفاتح/الداكن
  // والثيم المختار). النوافذ تُرسم عبر portal خارج غلاف الثيم فكانت تبقى داكنة دائماً؛
  // مزامنة أصناف الثيم على body تجعلها ترث الثيم والوضع الحاليين تلقائياً.
  useEffect(() => {
    const cs = themeCls(theme, mode).split(' ').filter(Boolean);
    document.body.classList.add(...cs);
    return () => document.body.classList.remove(...cs);
  }, [theme, mode]);

  useEffect(() => {
    const bip = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const done = () => { setInstalled(true); setInstallPrompt(null); };
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone || window.navigator.standalone) setInstalled(true);
    window.addEventListener('beforeinstallprompt', bip);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', bip); window.removeEventListener('appinstalled', done); };
  }, []);

  const doInstall = useCallback(async () => {
    if (!installPrompt) {
      const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      say(iOS
        ? 'على آيفون: اضغط زر المشاركة في المتصفح ثم «إضافة إلى الشاشة الرئيسية»'
        : 'لتثبيت التطبيق: افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «Install app»', 'ok');
      return;
    }
    installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === 'accepted') say('تم تثبيت التطبيق على جهازك');
    setInstallPrompt(null);
  }, [installPrompt, say]);

  // v11.1 — تحديث فوري للأحدث: يزيل عامل الخدمة وكل الكاش ويعيد التحميل بلا تخزين مؤقت (يعمل على الجوال بضغطة)
  const forceUpdate = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
      if (typeof caches !== 'undefined') { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
    } catch (e) { /* تجاهل */ }
    location.replace(location.pathname + '?u=' + Date.now());   // معلمة كسر الكاش تضمن جلب index.html جديدًا
  }, []);

  // v11.1 — كشف تلقائي لنسخة أحدث منشورة: يقارن اسم حزمة index.html المنشورة باسم الحزمة الجارية
  useEffect(() => {
    const grab = (s) => (String(s || '').match(/assets\/index-[\w-]+\.js/) || [])[0] || '';
    const mineEl = document.querySelector('script[type=module][src*="assets/index-"]');
    const mine = grab(mineEl && mineEl.getAttribute('src'));
    if (!mine) return;   // بيئة تطوير (بلا حزمة مُجمّعة) — لا فحص
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch(location.pathname + '?_c=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return; const html = await r.text(); const latest = grab(html);
        if (latest && latest !== mine && !stop) setUpdateReady(true);
      } catch (e) { /* غير متصل — تجاهل */ }
    };
    const t = setInterval(check, 90000);         // v30.0: كل 90 ثانية (طلب صفحة صغيرة ~2KB)
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    const first = setTimeout(check, 9000);       // فحص أولي بعد التحميل
    return () => { stop = true; clearInterval(t); clearTimeout(first); window.removeEventListener('focus', onFocus); };
  }, []);

  // v30.0 — عدّاد التحديث: عند توفر نسخة أحدث يبدأ عدّ تنازلي (60 ثانية) ثم يُحدَّث تلقائيًا.
  // لا يُحدَّث أثناء الإدخال: يتوقف العدّ إن كُتب شيء خلال آخر دقيقة أو كانت نافذة/نموذج مفتوحًا — فلا تضيع بيانات لم تُحفظ.
  const UPD_SECS = 60;
  const [updLeft, setUpdLeft] = useState(UPD_SECS);
  const [updPaused, setUpdPaused] = useState(false);
  const [updSnooze, setUpdSnooze] = useState(0);
  const lastInputAt = useRef(0);
  useEffect(() => {
    const on = () => { lastInputAt.current = Date.now(); };
    document.addEventListener('input', on, true); document.addEventListener('change', on, true);
    return () => { document.removeEventListener('input', on, true); document.removeEventListener('change', on, true); };
  }, []);
  useEffect(() => {
    if (!updateReady) return;
    const t = setInterval(() => {
      if (Date.now() < updSnooze) return;
      const busy = (Date.now() - lastInputAt.current < 60000) || !!document.querySelector('[role=dialog]');
      setUpdPaused(busy);
      if (busy) return;
      setUpdLeft(n => { if (n <= 1) { forceUpdate(); return 0; } return n - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [updateReady, updSnooze, forceUpdate]);
  const updShow = updateReady && Date.now() >= updSnooze;

  /* --- المزامنة الدورية + الحضور --- */
  const snap = useRef({});
  // v15.28 — مخبأ المستندات الحيّ: الاستماع اللحظي يحدّث نسخة المستند الواصل هنا فقط
  // ويعيد التجميع محلياً بصفر قراءات إضافية (كان كل إشعار يعيد قراءة كل المستندات).
  const docsCache = useRef({ core: null, br: {} });
  const refresh = useCallback(async (silent) => {
    if (silent && typeof document !== 'undefined' && document.hidden) return;
    if (!silent) setSyncing(true);
    const ctx = dataCtx.current;
    const orgKey = ctx.central ? KEYS.org : KEYS.dir;
    const [o, core, pu, ...brs] = await Promise.all([
      cloud.get(orgKey, null),
      ctx.central ? cloud.get(KEYS.core, null) : Promise.resolve(null),
      cloud.get(KEYS.pulse, null),
      ...ctx.myBrIds.map(b => cloud.get(brKey(b), null))
    ]);
    const brMap = {}; ctx.myBrIds.forEach((b, i) => { brMap[b] = brs[i] || {}; });
    docsCache.current = { core: core || null, br: brMap };
    const p = composeOps(core, brMap);
    const put = (k, v, setter) => {
      if (!v) return;
      const j = JSON.stringify(v);
      if (snap.current[k] === j) return;   // لا تغيير — نتفادى إعادة الرسم
      snap.current[k] = j; setter(v);
    };
    put('org', o ? (ctx.central ? o : { ...emptyOrg(), ...o }) : null, setOrg);
    put('ops', p, setOps); put('pulse', pu, setPulse);
    setLastSync(new Date());
    setTimeout(() => setSyncing(false), 350);
  }, []);

  useEffect(() => {
    if (boot !== 'ready' || needAuth) return;
    const subs = [];
    const wire = (slot, key, setter) => {
      const un = cloud.subscribe?.(key, (v) => {
        const j = JSON.stringify(v);
        if (snap.current[slot] === j) return;
        snap.current[slot] = j; setter(v); setLastSync(new Date());
      });
      if (un) subs.push(un);
    };
    const ctx = dataCtx.current;
    wire('org', ctx.central ? KEYS.org : KEYS.dir, (v) => setOrg(ctx.central ? v : { ...emptyOrg(), ...v }));
    wire('pulse', KEYS.pulse, setPulse);
    // v15.28: المستند الواصل لحظياً يُخزَّن في المخبأ ويُعاد التجميع محلياً — صفر قراءات
    // إضافية (سابقاً كان كل إشعار يستدعي refresh كاملاً يقرأ كل المستندات من جديد).
    const cacheRecompose = () => {
      const dc = docsCache.current;
      const ready = (!ctx.central || dc.core != null) && ctx.myBrIds.every(b => dc.br[b] != null);
      if (!ready) return;   // اللقطات الأولى لم تكتمل بعد — نُبقي على ما حمّله الإقلاع
      const composed = composeOps(ctx.central ? dc.core : null, dc.br);
      const j = JSON.stringify(composed);
      if (snap.current.ops === j) return;
      snap.current.ops = j; setOps(composed); setLastSync(new Date());
    };
    if (ctx.central) { const un = cloud.subscribe?.(KEYS.core, (v) => { docsCache.current.core = v || {}; cacheRecompose(); }); if (un) subs.push(un); }
    ctx.myBrIds.forEach(b => { const un = cloud.subscribe?.(brKey(b), (v) => { docsCache.current.br[b] = v || {}; cacheRecompose(); }); if (un) subs.push(un); });
    if (subs.length) setLive(true);
    return () => subs.forEach(u => u());
  }, [boot, needAuth, refresh, brSetVer]);   // v27.3: brSetVer يُعيد بناء الاشتراكات عند تغيّر مجموعة الفروع (فرع جديد يظهر حيًّا بلا إعادة تحميل)

  useEffect(() => {
    if (boot !== 'ready') return;
    // v15.28: مع الاستماع اللحظي (الذي يوصل كل تغيير فور وقوعه) يكفي استطلاع احتياطي كل
    // 5 دقائق بدل 45 ثانية — خفض قراءات الاستطلاع نحو 7 أضعاف دون أي تأثير على الفورية.
    const t = setInterval(() => refresh(true), live ? 300000 : 8000);
    // v27.1: العودة إلى التبويب = مزامنة فورية (الاستطلاع الدوري يتوقف والتبويب مخفي، فقد يتأخر ما سجّلته الفروع)
    const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) refresh(true); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, [boot, live, refresh]);

  // v9: نضبط نطاق فروع الجلسة بعد الإقلاع.
  // v27.3: يشمل الآن حساب المركز أيضًا — كان مستثنى صراحةً، فأي فرع يُنشأ/يُسند بعد فتح صفحة
  // المركز لم يكن يُقرأ مستنده ولا يُشترَك فيه حتى إعادة تحميل كاملة، فلا يظهر حضوره ولا بياناته
  // في المركز والتقارير. الآن عند تغيّر قائمة الفروع نحدّث النطاق ونعيد بناء الاشتراكات فورًا.
  useEffect(() => {
    if (!me) return;
    const central = dataCtx.current.central;
    const ids = central ? (org.branches || []).map(b => b.id) : (branchIdsOfUser(me) || []);
    if (JSON.stringify(ids) !== JSON.stringify(dataCtx.current.myBrIds)) {
      dataCtx.current.myBrIds = ids;
      if (!central) dataCtx.current.email = (me.email || '').toLowerCase();
      setBrSetVer(v => v + 1);   // يُعيد تشغيل تأثير الاشتراكات على المجموعة الجديدة
      refresh(true);
    }
  }, [me, org, refresh]);

  /* --- تنبيهات النشاط الحيّة لمدراء النظام: إشعار متصفح + صوت لأي نشاط من الآخرين --- */
  const actBaseRef = useRef(Date.now());
  useEffect(() => { actBaseRef.current = Date.now(); }, [me]);

  // v8.5: لقطة احتياطية يومية محلية تلقائية (أجهزة أدوار الإدارة فقط) — آخر 7 أيام
  const snapDoneRef = useRef(false);
  useEffect(() => {
    if (snapDoneRef.current || !me || !ROLES[me.role]?.admin || !(org.branches || []).length) return;
    snapDoneRef.current = true;
    (async () => {
      try {
        const key = 'day-' + today();
        const all = await snapAll();
        if (!all.some(x => x.key === key)) {
          await snapPut(key, { at: nowISO(), by: me.name, org, ops });
          const days = all.filter(x => (x.key || '').startsWith('day-')).sort((a, b) => b.key.localeCompare(a.key));
          for (const old2 of days.slice(6)) await snapDel(old2.key);
        }
      } catch { /* متصفح بوضع خاص أو تخزين ممتلئ — النسخة الملفية تبقى متاحة */ }
    })();
  }, [me, org, ops]);
  useEffect(() => {
    if (!me || !ROLES[me.role]?.admin) return;
    const cfg = notifyCfg();
    if (!cfg.on || cfg.cats.act === false) return;
    const fresh = (pulse.audit || []).filter(e => (e.at || 0) > actBaseRef.current && e.userName !== me.name);
    if (!fresh.length) return;
    actBaseRef.current = Math.max(...fresh.map(e => e.at || 0));
    const e = fresh[0];
    const more = fresh.length > 1 ? ` (+${fresh.length - 1} نشاط آخر)` : '';
    const body = `${e.userName}: ${e.title}${e.details ? ' — ' + String(e.details).slice(0, 90) : ''}${more}`;
    notifyBrowser('نشاط جديد — ' + (org.company?.name || 'المنصة'), body, org.company?.logoUrl);
    if (cfg.sound) alertBeep();
  }, [pulse, me, org]);

  /* --- v15.24: مهلة انتهاء الجلسة (خمول) — معطّلة افتراضياً، تُفعَّل من إعدادات النظام --- */
  const lastActRef = useRef(Date.now());
  const [sessWarnLeft, setSessWarnLeft] = useState(null);   // ثوانٍ متبقية في التحذير، null = لا تحذير
  const [locked, setLocked] = useState(false);              // v15.25: شاشة القفل — عودة بالدخول السريع (رقم سري/بصمة)
  // v32.3: بصمة هذا الجهاز تقفل التطبيق عند فتحه بجلسة محفوظة، وعند العودة إليه بعد دقيقتين في الخلفية
  useEffect(() => {
    if (!me || !devBioId(me)) return;
    if (!interactiveLogin.current) setLocked(true);
    interactiveLogin.current = false;
    let hiddenAt = 0;
    const onVis = () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 120000 && devBioId(me)) setLocked(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [me && me.id]); // eslint-disable-line
  useEffect(() => {
    const bumpAct = () => { lastActRef.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    evs.forEach(ev => window.addEventListener(ev, bumpAct, { passive: true }));
    return () => evs.forEach(ev => window.removeEventListener(ev, bumpAct));
  }, []);
  const sessLogout = useCallback(async () => {
    setSessWarnLeft(null); setLocked(false);
    // خروج سحابي صحيح: إنهاء جلسة المصادقة أيضاً حتى تظهر بوابة الدخول الحقيقية لا بوابة محلية
    if (authApi.enabled) { try { await authApi.signOutAll(); } catch { } setNeedAuth(true); }
    setMe(null);
  }, []);
  useEffect(() => {
    const cfg = (org && org.sessionCfg) || {};
    if (!me || !cfg.enabled || locked) { setSessWarnLeft(null); return; }
    // خطّافا اختبار (على غرار __forceOrgReadonly): يقصّران المهلة والتحذير للفحص الآلي فقط
    const limit = (typeof window !== 'undefined' && window.__sessTestMs) || Math.max(1, Number(cfg.minutes) || 15) * 60000;
    const warnDur = (typeof window !== 'undefined' && window.__sessTestWarnMs) || 60000;
    const t = setInterval(() => {
      const idle = Date.now() - lastActRef.current;
      if (idle >= limit + warnDur) {
        // v15.25: عند التهيئة على «قفل» ولدى المستخدم دخول سريع (رقم سري/بصمة) نقفل الشاشة
        // بدل الخروج الكامل؛ من لا يملك أياً منهما يسقط للخروج الكامل الآمن.
        if (cfg.onTimeout === 'lock' && (me.pinHash || me.bioCredId)) {
          setSessWarnLeft(null); lastActRef.current = Date.now(); setLocked(true);
        } else sessLogout();
      }
      else if (idle >= limit) setSessWarnLeft(Math.max(0, Math.ceil((limit + warnDur - idle) / 1000)));
      else setSessWarnLeft(w => (w == null ? w : null));   // عاد النشاط أثناء التحذير — يختفي تلقائياً
    }, 1000);
    return () => clearInterval(t);
  }, [me, org, locked, sessLogout]);

  // v15.29: رسالة الإنهاء التلقائي (دخول من متصفح آخر) — تُمسح فور دخول ناجح جديد
  useEffect(() => { if (me) setKickMsg(null); }, [me]);
  const kickOut = useCallback(() => {
    setKickMsg('تم تسجيل الدخول لحسابك من متصفح أو جهاز آخر، فأُنهيت هذه الجلسة تلقائياً حفاظاً على سلامة إدخال البيانات. إن لم يكن ذلك أنت فغيّر كلمة السر فوراً.');
    sessLogout();
  }, [sessLogout]);

  useEffect(() => {
    if (!me) return;
    // v15.29 — جلسة واحدة لكل مستخدم (عدا أدوار الإدارة admin): عند الدخول يطالب هذا
    // المتصفح بالجلسة داخل مستند النبض (logins[معرّف المستخدم] = هوية المتصفح + لحظة
    // الدخول)، وأي متصفح آخر لنفس المستخدم يكتشف مطالبة أحدث فيخرج تلقائياً — الأحدث
    // دائماً يفوز، فلا إدخال مزدوج متعارض. صفر قراءات إضافية: الفحص داخل قراءة النبضة
    // القائمة أصلاً، والاكتشاف اللحظي عبر اشتراك النبض القائم أصلاً.
    claimRef.current = { done: false, at: Date.now() };
    const single = !(ROLES[me.role] || {}).admin;
    const beat = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      // v29.5: النبضة تُكتب مشروطة — إن أضاف أحدٌ قيد تدقيق بعد قراءتنا نعيد على الأحدث بدل محوه
      for (let tryN = 0; tryN < 3; tryN++) {
      const pu = await cloud.get(KEYS.pulse, { presence: {}, audit: [] });
      if (single && claimRef.current.done) {
        const lg = (pu.logins || {})[me.id];
        if (lg && lg.sid !== bsid.current && (lg.at || 0) > claimRef.current.at) { kickOut(); return; }
        // مطالبة أقدم أو ممسوحة بكتابة متزامنة عتيقة → نعيد كتابة مطالبتنا الأحدث أدناه
      }
      const pres = { ...(pu.presence || {}) };
      pres[sid.current] = { name: me.name, role: me.role, at: Date.now() };
      Object.keys(pres).forEach(k => { if (Date.now() - (pres[k].at || 0) > 150000) delete pres[k]; });
      const next = { ...pu, presence: pres };
      if (single) {
        next.logins = { ...(pu.logins || {}) };
        next.logins[me.id] = { sid: bsid.current, at: claimRef.current.at, name: me.name };
        claimRef.current.done = true;
      }
      const r = await cloud.setIfUnchanged(KEYS.pulse, next);
      if (r === 'conflict') continue;
      if (r === 'ok') setPulse(next);
      return;
      }
    };
    beat();
    const t = setInterval(beat, 60000);
    const onVis = () => { if (!document.hidden) beat(); };   // عودة التبويب = نبضة فورية
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [me, kickOut]);

  // v15.29: الاكتشاف اللحظي — أي تحديث للنبض يصل (اشتراك لحظي أو استطلاع) يُفحص فوراً،
  // فالمتصفح الأقدم يخرج خلال ثوانٍ من دخول الأحدث دون انتظار النبضة التالية.
  useEffect(() => {
    if (!me || (ROLES[me.role] || {}).admin || !claimRef.current.done) return;
    const lg = (pulse.logins || {})[me.id];
    if (lg && lg.sid !== bsid.current && (lg.at || 0) > claimRef.current.at) kickOut();
  }, [pulse, me, kickOut]);

  /* --- v9: الكتابة الآمنة الموجَّهة — التعديل يقع على ops المدمجة كما اعتاد كل الكود،
         ثم يُوزَّع على المستند المركزي ومستندات الفروع، ولا يُكتب إلا ما تغيّر فعلًا.
         محاولة كتابة خارج نطاق الجلسة يرفضها الخادم فيفشل الحفظ بصدق --- */
  // v34.7: حفظ واحد في كل مرة على الجهاز — حفظان متداخلان (إرسال نقطة البيع الدوري أثناء رفع مستند كبير) كانا يتعارضان بلا نهاية
  const writeChain = useRef(Promise.resolve());
  const writeOps = useCallback((mutator) => { const run = writeChain.current.then(() => writeOpsRaw(mutator), () => writeOpsRaw(mutator)); writeChain.current = run.catch(() => { }); return run; }, []);   // eslint-disable-line
  const writeOpsRaw = useCallback(async (mutator) => {
    const ctx = dataCtx.current;
    lastWriteErr.current = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      // أحدث نسخة لكل مستند ضمن نطاقي
      const core = ctx.central ? ((await cloud.get(KEYS.core, null)) || {}) : null;
      const brMap = {};
      for (const b of ctx.myBrIds) {
        // v27.1: على مسار الفرع، رفض القراءة = رفض كتابة حتمًا — نُبلغ بدقة بدل الكتابة فوق نسخة localStorage قديمة
        const r = await cloud.tryGet(brKey(b));
        if (r.denied) { lastWriteErr.current = 'denied'; setAccessErr(a => a || { kind: 'branch', ids: [b], expected: ctx.myBrIds }); return false; }
        brMap[b] = r.value || {};
      }
      const latest = composeOps(core, brMap);
      const next = mutator(JSON.parse(JSON.stringify(latest)));
      // v29.5: الحارس المركزي — لا تعديل لقيود شهر مقفل مهما كانت الشاشة
      if (orgNow.current && lockedLedgerChanged(orgNow.current, latest, orgNow.current, next)) { lastWriteErr.current = 'locked'; return false; }
      // v33.2: الحارس المركزي لتكرار الفواتير — يُفحص على أحدث نسخة سحابية (يمنع النقرتين والتصادم بين جهازين)
      const dups = findDupInvoices(latest, next);
      if (dups.length) { lastWriteErr.current = 'dup'; lastDupMsg.current = dups[0].msg + (dups.length > 1 ? ' (+' + (dups.length - 1) + ' أخرى)' : ''); return false; }
      // v27.1: على مسار الفرع لا يُكتب المستند المركزي — أي سجل جديد بلا فرع أو لفرع خارج نطاقي كان يضيع بصمت
      // (يظهر محليًا ثم يختفي بعد إعادة التحميل). نرفضه صراحةً.
      if (!ctx.central) {
        const lost = outOfScopeRecords(next, latest, ctx.myBrIds);
        if (lost.length) { lastWriteErr.current = 'scope'; console.warn('writeOps: سجلات خارج نطاق الفرع لن تُحفظ', lost, ctx.myBrIds); return false; }
      }
      const { core: coreOut, br: brOut } = splitOps(next, ctx.myBrIds);
      // v34.1: تعذّرت قراءة المستند المركزي؟ إن لم يغيّر هذا الحفظ شيئًا فيه (وردية، فاتورة نقطة بيع، إغلاق فرع…)
      // نكتب مستند الفرع وحده بدل رفض الحفظ كله. وإن غيّره، نرفض صراحةً حمايةً للبيانات.
      // v34.3: المرجع «ما الذي غيّره هذا الحفظ؟» = تقسيم أحدث نسخة مقروءة. مستند لم يتغير لا يُكتب أصلًا —
      // فمستند فرع آخر تالف أو تعذّرت قراءته لا يوقف حفظ وردية في فرعك.
      const baseSplit = splitOps(latest, ctx.myBrIds);
      const coreReadFailed = !!(ctx.central && cloud.readFailed(KEYS.core));
      const coreTouched = !sameDoc(coreOut, baseSplit.core);

      let allOk = true, conflict = false;
      let wroteCoreDoc = null; const wroteBrDocs = {};
      // المستند المركزي (أدوار المركز فقط)
      if (ctx.central && coreTouched) {
        {
          const rv = ((core || {}).rev || 0) + 1;
          const doc = { ...coreOut, rev: rv, wtag: uid('w') };   // v27.2: وسم كاتب لكشف التصادم
          // v29.5: كتابة مشروطة — تُرفض إن عدّل غيري المستند بعد قراءتي، فنعيد على الأحدث (لا يُمحى تعديله)
          const r = await cloud.setIfUnchanged(KEYS.core, doc);
          if (r === 'conflict') conflict = true;
          else if (r !== 'ok') { allOk = false; }
          else wroteCoreDoc = doc;
        }
      }
      // مستندات الفروع المتغيرة فقط
      for (const b of ctx.myBrIds) {
        if (!sameDoc(brOut[b], baseSplit.br[b])) {
          const rv = ((brMap[b] || {}).rev || 0) + 1;
          const doc = { ...brOut[b], rev: rv, wtag: uid('w') };   // v27.2: وسم كاتب لكشف التصادم
          const r = await cloud.setIfUnchanged(brKey(b), doc);   // v29.5: كتابة مشروطة
          if (r === 'conflict') conflict = true;
          else if (r !== 'ok') { allOk = false; if (String((cloud.lastError || {}).code || '').toLowerCase().includes('permission')) { lastWriteErr.current = 'denied'; return false; } }
          else wroteBrDocs[b] = doc;
        }
      }
      if (!allOk && String((cloud.lastError || {}).code) === 'resource-exhausted') { lastWriteErr.current = 'quota'; return false; }
      if (!allOk) { if (attempt >= 2) { lastWriteErr.current = lastWriteErr.current || 'net'; return false; } continue; }
      if (conflict) continue;   // كتب آخر بنفس اللحظة — نعيد على الأحدث
      // v15.28: نجاح — ما كتبناه (وما قرأناه للتو قبله) هو الحالة الكاملة بين أيدينا؛
      // لا حاجة لإعادة قراءة كل المستندات من السحابة (كانت تكلف قراءة لكل فرع بعد كل حفظ).
      if (ctx.central) docsCache.current.core = wroteCoreDoc || core || {};
      for (const b of ctx.myBrIds) docsCache.current.br[b] = wroteBrDocs[b] || brMap[b] || {};
      snap.current.ops = JSON.stringify(next); setOps(next);
      return true;
    }
    return false;
  }, []);

  // v29.5: إضافة قيد لسجل التدقيق بكتابة مشروطة — كانت نبضات الحضور (كل دقيقة من كل جهاز) تكتب مستند النبض كاملًا
  // فتمحو أي قيد تدقيق أُضيف بين قراءتها وكتابتها
  const appendAudit = useCallback(async (entry) => {
    for (let i = 0; i < 4; i++) {
      const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
      const nx = { ...pu, audit: [entry, ...(pu.audit || [])].slice(0, 150) };
      const r = await cloud.setIfUnchanged(KEYS.pulse, nx);
      if (r === 'ok') { setPulse(nx); return true; }
      if (r === 'fail') return false;
    }
    return false;
  }, []);

  const commit = useCallback(async (mutator, log) => {
    // v15.12: البوابة المركزية — ترفض أي حفظ حسّاس (log.need) لا يملك المستخدم صلاحيته، مهما كان مصدر النداء.
    if (log?.need && !capOK(me?.role, log.need)) { say('لا تملك صلاحية هذا الإجراء — تواصل مع مدير النظام', 'no'); return false; }
    const ok = await writeOps(mutator);
    if (!ok) {
      // v27.1: رسالة تُسمّي السبب — رفض صلاحيات الخادم (عضوية الحساب لا تحمل فرعه) يختلف تمامًا عن انقطاع الشبكة
      const k = lastWriteErr.current;
      if (k === 'dup') say('لم يُحفظ — فاتورة مكررة: ' + lastDupMsg.current, 'no');
      else if (k === 'quota') say(QUOTA_MSG(), 'no');
      else if (k === 'locked') say('لم يُحفظ: هذا التعديل يغيّر قيودًا في شهر مقفل محاسبيًا 🔒 — الفتح الاستثنائي من المحاسبة ← الإقفال', 'no');
      else if (k === 'denied') say('رفض الخادم حفظ بيانات فرعك (صلاحيات، لا اتصال): عضوية حسابك على الخادم لا تحمل هذا الفرع — اطلب من مسؤول النظام «مزامنة صلاحيات الأعضاء» من الفروع والمستخدمين ثم أعد الدخول', 'no');
      else if (k === 'scope') say('لم يُحفظ: السجل يخص فرعًا خارج نطاق حسابك (أو بلا فرع) — راجع إعداد فرع حسابك', 'no');
      else if (String((cloud.lastError || {}).code) === 'read-failed') { const ek = (cloud.lastError || {}).key || ''; const re = cloud.readErr(ek) || {};
        const lbl = ek === KEYS.core ? 'المستند المركزي' : ek.startsWith('rms8:br_') ? 'مستند فرع «' + (((orgNow.current || {}).branches || []).find(b => 'rms8:br_' + b.id === ek) || { name: ek.slice(8) }).name + '»' : ek;
        const det = (/\(([^)]+)\)\s*$/.exec(re.msg || '') || [])[1];
        say('لم يُحفظ: تعذّرت قراءة ' + lbl + ' من السحابة' + (re.code ? ' (السبب: ' + re.code + (det ? ' — ' + det : '') + ')' : '') + ' — أعد المحاولة بعد لحظات. إن تكرر: الإعدادات ← النسخ الاحتياطي ← «فحص سلامة البيانات السحابية»', 'no'); }
      else if (false) say('لم يُحفظ: تعذّرت قراءة النسخة الحالية من السحابة (قد تكون تالفة)، فلم يُكتب شيء حمايةً للبيانات — أعد تحميل الصفحة، وإن تكرر تواصل مع المطوّر', 'no');
      else say('تعذّر الحفظ السحابي بعد عدة محاولات — تحقق من الاتصال وأعد المحاولة', 'no');
      return false;
    }
    if (log && me) await appendAudit({
      id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role,
      userRoleLabel: (ROLES[me.role] || {}).ar || me.role, ...log
    });
    setLastSync(new Date());
    return true;
  }, [writeOps, me, say, appendAudit]);

  const commitOrg = useCallback(async (mutator, log) => {
    // v15.12: البوابة المركزية — نفس الحارس على كتابات الإعدادات/المنشأة.
    if (log?.need && !capOK(me?.role, log.need)) { say('لا تملك صلاحية هذا الإجراء — تواصل مع مدير النظام', 'no'); return false; }
    // v29.5: كتابة مشروطة مع إعادة المحاولة — لا يمحو حفظُ إعدادات تعديلَ مستخدم آخر في اللحظة نفسها
    let next = null, saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const latest = (await cloud.get(KEYS.org, null)) || org;
      next = mutator(JSON.parse(JSON.stringify(latest)));
      // الحارس المركزي للإقفال: إعداد يغيّر قيود شهر مقفل (ربط بنك، تصنيف، تطبيق…) يُرفض
      if (lockedLedgerChanged(latest, opsNow.current, next, opsNow.current)) { say('لم يُحفظ: هذا التعديل يغيّر قيودًا في شهر مقفل محاسبيًا 🔒 — الفتح الاستثنائي من المحاسبة ← الإقفال', 'no'); return false; }
      const r = await cloud.setIfUnchanged(KEYS.org, next);
      if (r === 'ok') saved = true;
      else if (r === 'fail') break;
    }
    if (!saved) { say('تعذّر حفظ الإعدادات سحابياً — أعد المحاولة', 'no'); return false; }
    // v9: كل تعديل للمنشأة يجدّد الدليل العام المنزوع الأسرار الذي تقرؤه أجهزة الفروع
    try { await cloud.set(KEYS.dir, dirOf(next)); } catch { }
    snap.current.org = JSON.stringify(next);
    setOrg(next);
    if (log && me) await appendAudit({ id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role, userRoleLabel: (ROLES[me.role] || {}).ar || me.role, ...log });
    setLastSync(new Date());
    return true;
  }, [org, me, say, appendAudit]);

  // v28.1: تفريغ المنصة لمسؤول النظام فقط، بتأكيد مكتوب، ويبقى سجل التدقيق ويُقيَّد فيه الحدث
  const resetAll = useCallback(async () => {
    if (!me || !(ROLES[me.role] || {}).admin) return say('تفريغ المنصة لمسؤول النظام فقط', 'no');
    const typed = window.prompt('سيُحذف كل ما أُدخل نهائياً (الإغلاقات، الموظفون، الموردون، المستخدمون) وتعود المنصة فارغة.\nنزّل نسخة احتياطية أولًا.\n\nللتأكيد اكتب: تفريغ نهائي');
    if ((typed || '').trim() !== 'تفريغ نهائي') return say('أُلغي التفريغ — لم يتغير شيء', 'no');
    const keepCompany = org?.company;
    const o = emptyOrg(keepCompany); const p = emptyOps();
    const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
    const entry = { id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role, userRoleLabel: (ROLES[me.role] || {}).ar || me.role, actionType: 'delete', targetType: 'system_settings', targetId: 'reset', title: 'فرّغ بيانات المنصة بالكامل', details: (org.branches || []).length + ' فرع · ' + (ops.closings || []).length + ' إغلاق' };
    const nx = { ...pu, audit: [entry, ...(pu.audit || [])] };
    if (!(await cloud.set(KEYS.pulse, nx))) return say('تعذّر توثيق التفريغ في السجل — أُلغي ولم يتغير شيء', 'no');
    const results = [await cloud.set(KEYS.org, o), await cloud.set(KEYS.ops, p), await cloud.set(KEYS.core, { rev: 1 })];
    for (const b of (org.branches || [])) results.push(await cloud.set(brKey(b.id), { rev: 1 }));
    results.push(await cloud.set(KEYS.dir, dirOf(o)));
    setOrg(o); setOps(p); setPulse(nx);
    say(results.every(Boolean) ? 'تمت إعادة المنصة إلى الوضع الفارغ' : 'تم التفريغ جزئيًا — بعض المستندات تعذّرت كتابتها، حدّث الصفحة وتحقق', results.every(Boolean) ? 'ok' : 'no');
  }, [say, org, ops, me]);

  /* --- نطاق الفروع حسب الدور --- */
  const myBranches = useMemo(() => {
    if (!org || !me) return [];
    const s = (ROLES[me.role] || ROLES.cashier).scope;   // دور غير معروف → أضيق صلاحية بدل انهيار الواجهة
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

  // v30.2 — إشعارات الجهاز حسب الدور: كل حدث جديد يخص المستخدم يصله إشعارًا مرة واحدة (والمنصة مفتوحة ولو في الخلفية).
  // أول تشغيل على الجهاز يعتبر الأحداث القائمة «مقروءة» (لا سيل إشعارات)، وما يستجد بعدها — ولو أثناء إغلاق المنصة — يصل عند فتحها.
  const nSeenRef = useRef(null);
  useEffect(() => {
    if (!me || !org || !(org.branches || []).length) return;
    const cfg = notifyCfg();
    if (!cfg.on) { nSeenRef.current = null; return; }
    const cats = new Set(notifCatsFor(me).filter(k => k !== 'act' && cfg.cats[k] !== false));
    if (!cats.size) return;
    let evs = [];
    try { evs = buildNotifEvents(org, ops, me, myBranches).filter(e => cats.has(e.cat)); } catch (e) { console.warn('notif events', e); return; }
    const key = 'rms8:nseen:' + me.id;
    const persist = (set) => { try { localStorage.setItem(key, JSON.stringify([...set].slice(-800))); } catch { } };
    let seen = nSeenRef.current;
    if (!seen) {
      let stored = null; try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch { }
      if (!Array.isArray(stored)) { seen = new Set(evs.map(e => e.id)); nSeenRef.current = seen; persist(seen); return; }
      seen = new Set(stored); nSeenRef.current = seen;
    }
    const fresh = evs.filter(e => !seen.has(e.id));
    if (!fresh.length) return;
    fresh.forEach(e => seen.add(e.id)); persist(seen);
    const logo = org.company?.logoUrl;
    const go = (e) => () => { setTab(e.tab); if (e.tab === 'inv' && e.view) openInvView(e.view); };
    if (fresh.length <= 3) fresh.forEach(e => notifyBrowser(e.title, e.body, logo, { tag: e.id, onClick: go(e) }));
    else notifyBrowser(fresh.length + ' تنبيهات جديدة — ' + (org.company?.name || 'المنصة'), fresh.slice(0, 3).map(e => e.title).join(' · ') + ' …', logo, { tag: 'rms8-batch', onClick: go(fresh[0]) });
    if (cfg.sound) alertBeep();
  }, [org, ops, me, myBranches, openInvView]);

  // v31.3 — التحقق بخطوتين: حالة المستخدم وسياسة الإلزام (v31.5: قبل أي return شرطي — كان بعده فيتغيّر عدد الـhooks عند انتهاء التحميل فتظهر شاشة سوداء)
  const [mfaS, setMfaS] = useState(null); const [mfaPol, setMfaPol] = useState(null); const [mfaOpen, setMfaOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);   // v31.9 تغيير كلمة السر
  const [bioOpen, setBioOpen] = useState(false);  // v32.3 البصمة لهذا الجهاز
  const interactiveLogin = useRef(false);        // دخول بكلمة السر الآن ← لا قفل فوري
  const mfaReload = useCallback(async () => { if (!authApi.enabled) return; const [i, p] = await Promise.all([authApi.mfaInfo().catch(() => null), authApi.getPolicy().catch(() => null)]); setMfaS(i); setMfaPol(p); }, []);
  useEffect(() => { if (me && authApi.enabled) mfaReload(); }, [me && me.id, mfaReload]);

  if (boot === 'error') {
    return (
      <div className="rms" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <AlertTriangle size={28} color="#D9544D" />
          <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700 }}>تعذّرت قراءة بيانات المنشأة من السحابة</div>
          <div style={{ marginTop: 8, color: '#A2968A', fontSize: 13, lineHeight: 1.9 }}>لم يُكتب أي شيء حمايةً للبيانات. تحقق من الاتصال ثم أعد تحميل الصفحة، وإن تكرر الأمر تواصل مع المطوّر.</div>
          <button className="btn pri" style={{ marginTop: 16 }} onClick={() => location.reload()}><RefreshCw size={14} />إعادة التحميل</button>
        </div>
      </div>
    );
  }

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

  const mfaNeed = !!(me && mfaPol && ((mfaPol.admins && (ROLES[me.role] || {}).admin) || (mfaPol.roles || []).includes(me.role)));

  // مصادقة سحابية مفعّلة ولا جلسة: بوابة الدخول الحقيقية قبل تحميل أي بيانات
  if (needAuth && !me) {
    return <FbGate css={CSS} theme={theme} fbLogin={fbLogin} fbMfa={fbMfa} fbFirstSetup={fbFirstSetup} notice={kickMsg} />;
  }

  // أول تشغيل: لا يوجد أي مستخدم بعد → شاشة التسجيل الأولي لإنشاء حساب المالك
  if ((org.users || []).length === 0) {
    return <FirstRun css={CSS} theme={theme} commitOrg={commitOrg} say={say}
      onDone={(u) => { setMe(u); setTab('admin'); }} />;
  }

  if (!me) {
    return <Gate css={CSS} theme={theme} org={org} notice={kickMsg}
      onLogin={(u) => { setMe(u); setTab('home'); }}
      online={Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 150000)} />;
  }

  // v15.25: الشاشة مقفلة — عودة سريعة برقم سري/بصمة (الجلسة السحابية باقية تحتها)
  if (locked) {
    return <LockScreen me={me} theme={theme} mode={mode}
      onUnlock={() => { setLocked(false); lastActRef.current = Date.now(); }}
      onLogout={sessLogout} />;
  }

  // v31.3: دور مُلزَم بالتحقق بخطوتين ولم يسجّل بعد ← لا دخول للمنصة قبل التسجيل (والقواعد تمنع البيانات أصلًا)
  if (authApi.enabled && mfaNeed && mfaS && (!mfaS.enrolled || !mfaS.used)) {
    return (
      <div className={themeCls(theme, mode)}><style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="gate"><div className="gate-c">
          <BrandHead title="التحقق بخطوتين مطلوب" sub={'سياسة المنشأة تُلزم دور «' + ((ROLES[me.role] || {}).ar || me.role).split('—')[0].trim() + '» بالتحقق بخطوتين'} />
          <MfaPanel me={me} required inline onDone={sessLogout} onLogout={sessLogout} say={say} info={mfaS} reload={mfaReload} />
        </div></div>
      </div>);
  }

  const smartAlertCount = computeSmartAlerts(org, ops, myBranches).length;
  const unread = (ops.notifications || []).filter(n => !n.isRead).length + smartAlertCount;
  const pending = scoped.closings.filter(c => c.status === 'submitted').length;
  const online = Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 150000);

  // النشاط الجديد منذ آخر مشاهدة للسجل (تنبيه مستمر)
  const auditLog = pulse.audit || [];
  const newActivity = auditLog.filter(a => (a.at || Date.parse(a.timestamp) || 0) > lastSeenAudit && a.userName !== me.name);
  const latestActivity = auditLog[0];

  // التبويبات الفعّالة = تبويبات الدور + تبويبات التطبيقات المُضافة يدويًا − التبويبات المُخفاة بالكامل
  // «الرئيسية» تبقى دائمًا (لا خطر حجب المستخدم — يهبط على الشبكة)
  const roleTabsMe = ROLES[me.role]?.tabs || [];
  const grantTabsMe = (me.appAllow || []).map(id => LAUNCH_IX[id]?.open?.tab).filter(Boolean);
  const denyDedMe = (() => {
    const deny = new Set(me.appDeny || []);
    if (!deny.size) return new Set();
    const byTab = {};
    LAUNCH_APPS.forEach(a => { (byTab[a.open.tab] = byTab[a.open.tab] || []).push(a.id); });
    return new Set(Object.entries(byTab).filter(([t, ids]) => ids.length && ids.every(id => deny.has(id))).map(([t]) => t));
  })();
  const NAV = [
    { id: 'home', ar: 'الرئيسية', icon: Home },
    { id: 'analytics', ar: 'التحليل والتنبيهات', icon: Compass },
    { id: 'alerts', ar: 'مركز التنبيهات', icon: Bell },
    { id: 'reporting', ar: 'مركز التقارير', icon: FileBarChart },
    { id: 'sales', ar: 'المبيعات', icon: CircleDollarSign },
    { id: 'pos', ar: 'نقطة البيع', icon: Store },
    { id: 'closing', ar: 'الإغلاق اليومي والاعتماد', icon: ClipboardCheck, cnt: pending },
    { id: 'shifts', ar: 'مواعيد الإغلاق والتذكيرات', icon: Clock },
    { id: 'hrops', ar: 'الموارد البشرية — التشغيل', icon: Fingerprint },
    { id: 'hrperf', ar: 'الأداء والانضباط', icon: TrendingUp },
    { id: 'qrfb', ar: 'تقييم العملاء (QR)', icon: QrCode },
    { id: 'apps', ar: 'إدارة التطبيقات', icon: Grid3x3 },
    { id: 'approve', ar: 'التدقيق والاعتماد', icon: ShieldCheck, cnt: pending },
    { id: 'treasury', ar: 'الخزينة والترحيل', icon: Landmark },
    { id: 'people', ar: 'شؤون الموظفين', icon: Wallet },
    { id: 'purchasing', ar: 'المشتريات', icon: Truck },
    { id: 'inv', ar: 'المخزون والمنتجات', icon: HardDrive },
    { id: 'whbranch', ar: 'مستودع الفرع', icon: Truck },
    { id: 'partners', ar: 'جهات الاتصال', icon: Users },
    { id: 'acct', ar: 'المالية والمحاسبة', icon: Scale },
    { id: 'docs', ar: 'المستندات والأرشيف', icon: Stamp },
    { id: 'archive', ar: 'أرشيف المستندات', icon: ImageIcon },
    { id: 'entities', ar: 'مركز المنشآت', icon: Building2 },
    { id: 'admin', ar: 'الإعدادات والمستخدمون', icon: UserCog },
    { id: 'audit', ar: 'سجل التدقيق', icon: Eye }
  ].filter(n => n.id === 'home' || ((roleTabsMe.includes(n.id) || grantTabsMe.includes(n.id)) && !denyDedMe.has(n.id)));
  // v31.5: الأقسام المدمجة لا تتكرر في القائمة الجانبية ما دام قسمها الأم ظاهرًا (تبقى مسموحة ويُوصل إليها من داخله)
  const NAV_PARENT = { alerts: 'analytics', approve: 'closing', shifts: 'closing', treasury: 'acct', entities: 'acct', archive: 'docs' };
  // v36.8: تطبيقات الموارد البشرية الثلاثة تظهر عنصرًا واحدًا «الموارد البشرية» (أول ما يتاح للدور منها)
  const HR_IDS = ['people', 'hrops', 'hrperf'];
  const hrRep = NAV.find(n => HR_IDS.includes(n.id));
  const NAV_SHOW = NAV.filter(n => !(NAV_PARENT[n.id] && NAV.some(m => m.id === NAV_PARENT[n.id])))
    .filter(n => !HR_IDS.includes(n.id) || n === hrRep).map(n => n === hrRep ? { ...n, ar: 'الموارد البشرية', icon: Users } : n);
  // v35.3: الشريط السفلي بأولوية العمل اليومي — الرئيسية، البيع، الإغلاق، التقارير — والباقي في «المزيد»
  const BOT_PRI = ['home', 'pos', 'closing', 'reporting', 'acct', 'sales', 'purchasing', 'analytics'];
  const BOT_AR = { home: 'الرئيسية', pos: 'البيع', closing: 'الإغلاق', reporting: 'التقارير', acct: 'المحاسبة', sales: 'المبيعات', purchasing: 'المشتريات', analytics: 'التحليل' };
  const BOT_SUB = { closing: ['approve', 'shifts', 'cashiers'], reporting: ['reports', 'rbuild', 'boardpack', 'cashflow'], acct: ['treasury', 'entities'], analytics: ['alerts', 'exec', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'ai'] };
  const botNav = (() => { const pick = BOT_PRI.map(id => NAV_SHOW.find(n => n.id === id)).filter(Boolean); const rest = NAV_SHOW.filter(n => !BOT_PRI.includes(n.id)); const all = [...pick, ...rest]; return all.length <= 5 ? all : all.slice(0, 4); })();

  const shared = { org, ops, pulse, me, myBranches, scoped, commit, commitOrg, say, setTab, theme, acctIntent, openAcctView, invIntent, openInvView };

  // حماية: منع الوصول لتبويب غير مسموح لدور المستخدم (بلا hook — بعد returns الشرطية)
  const allowedTabs = [...NAV.map(n => n.id), ...(NAV.some(n => n.id === 'closing') && (ROLES[me.role]?.approver || ROLES[me.role]?.admin || ROLES[me.role]?.scope === 'all') ? ['cashiers'] : []), ...(NAV.some(n => n.id === 'analytics') ? ['exec', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'ai'] : []), ...(NAV.some(n => n.id === 'reporting') ? ['reports', 'rbuild', 'boardpack', 'cashflow'] : []), ...(NAV.some(n => n.id === 'people') ? ['payroll', 'workforce', 'muster', 'overtime'] : []), ...(NAV.some(n => n.id === 'purchasing') ? ['suppliers', 'reorder'] : []), ...(NAV.some(n => n.id === 'hrops') ? ['attendance', 'leaves', 'shiftengine', 'tasks', 'points', 'esign'] : []), ...(NAV.some(n => n.id === 'hrperf') ? ['kpi', 'empfile', 'rolekpi', 'rewards', 'corrective', 'training', 'perfsnap', 'hrdash'] : [])];
  const safeTab = allowedTabs.includes(tab) ? tab : (allowedTabs[0] || 'closing');

  return (
    <div className={themeCls(theme, mode)}>
      <style dangerouslySetInnerHTML={{ __html: CSS + '.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}' }} />
      <div className="shell"
        onTouchStart={(e) => {
          if (window.innerWidth > 900) return;
          const t = e.touches[0];
          const startX = t.clientX;
          // فتح: يبدأ اللمس من الحافة اليمنى (بداية RTL) والقائمة مغلقة
          // إغلاق: اللمس والقائمة مفتوحة
          const nearStartEdge = startX > window.innerWidth - 28;
          touchRef.current = {
            x0: startX, y0: t.clientY, active: true,
            mode: drawer ? 'close' : (nearStartEdge ? 'open' : null)
          };
        }}
        onTouchMove={(e) => {
          const r = touchRef.current;
          if (!r.active || !r.mode) return;
          const t = e.touches[0];
          const dx = t.clientX - r.x0;
          const dy = t.clientY - r.y0;
          if (Math.abs(dy) > Math.abs(dx)) return; // تمرير عمودي، تجاهل
          // في RTL: السحب لليسار (dx سالب) يفتح، السحب لليمين (dx موجب) يغلق
          if (r.mode === 'open' && dx < -55) { setDrawer(true); r.mode = null; }
          if (r.mode === 'close' && dx > 55) { setDrawer(false); r.mode = null; }
        }}
        onTouchEnd={() => { touchRef.current.active = false; touchRef.current.mode = null; }}>
        {!drawer && <div className="edgehint" />}
        {drawer && <div className="mask" style={{ zIndex: 55 }} onClick={() => setDrawer(false)} />}
        <aside className={'side' + (drawer ? ' open' : '')}>
          <div className="brand">
            {org.company.logoUrl
              ? <img className="brand-logo" src={org.company.logoUrl} alt="شعار الشركة" />
              : <div className="brand-mark"><MizanMark size={26} anim /></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-t">{org.company.name}</div>
              <div className="brand-s">CLOUD CLOSING SUITE</div>
            </div>
            <button className="btn sm gh sideclose" onClick={() => setDrawer(false)} title="إخفاء القائمة">
              <X size={18} />
            </button>
          </div>
          <div className="nav-lbl">التشغيل اليومي</div>
          {NAV_SHOW.map(n => (
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
                <div style={{ fontSize: 10, color: 'var(--faint)' }}>{((ROLES[me.role] || {}).ar || me.role).split('—')[0]}</div>
              </div>
              <button className="btn sm gh" onClick={() => setMe(null)} title="خروج"><LogOut size={13} /></button>
            </div>
            {!installed && (
              <button className="nav-i" onClick={doInstall} style={{ fontSize: 11.5, color: 'var(--brass)' }}>
                <Download size={14} />تثبيت التطبيق على الجهاز
              </button>
            )}
            <button className="nav-i" onClick={() => setTour(true)} style={{ fontSize: 11.5 }}>
              <Compass size={14} />جولة تعريفية في المنصة
            </button>
            <button className="nav-i" onClick={resetAll} style={{ fontSize: 11.5 }}>
              <Trash2 size={14} />تفريغ بيانات المنصة
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="top">
            <button className="btn sm gh hidden-desk topmenu" onClick={() => setDrawer(d => !d)} title={drawer ? 'إخفاء القائمة' : 'إظهار القائمة'}>
              {drawer ? <X size={18} /> : <Menu size={18} />}
            </button>
            {safeTab !== 'home' && (
              <button className="homebtn2" onClick={() => setTab('home')} title="الرئيسية — كل التطبيقات">
                <Home size={17} />
              </button>
            )}
            {org.company.logoUrl
              ? <img className="toplogo" src={org.company.logoUrl} alt="شعار الشركة" />
              : <span className="toplogo-mark"><MizanMark size={24} /></span>}
            <h1 className="toptitle">{safeTab === 'home' ? (org.company.name || 'الرئيسية') : HR_TABS.includes(safeTab) ? 'الموارد البشرية' : (NAV.find(n => n.id === safeTab)?.ar || TAB_AR[safeTab] || '')}</h1>
            <span className="verbadge" style={{ fontSize: 11, color: '#1a1410', background: 'var(--mint)', fontFamily: 'monospace', flexShrink: 0, padding: '3px 8px', borderRadius: 6, fontWeight: 700, alignSelf: 'center' }}>v38.4</span>
            <div className="topstatus">
              <div className="row avrow" style={{ gap: 0 }}>
                {online.slice(0, 4).map((p, i) => (
                  <div key={i} className="av avtip" style={{ background: clr(i) }}
                    data-tip={p.name + ((ROLES[p.role] || {}).ar ? ' · ' + ROLES[p.role].ar.split('—')[0].trim() : '')}>
                    {p.name.charAt(0)}
                  </div>
                ))}
              </div>
              <span className={'badge livebadge ' + (live ? 'b-mint' : 'b-dim')}
                title={live ? 'مزامنة لحظية عبر Firestore' : 'مزامنة دورية كل 8 ثوانٍ'}>
                <span className="dot" />{online.length}{live ? ' · لحظي' : ''}
              </span>
              <button className="btn sm gh synctime" onClick={() => refresh(false)} title="مزامنة الآن">
                <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                <span className="num tt" style={{ fontSize: 10, color: 'var(--faint)' }}>
                  {lastSync ? lastSync.toLocaleTimeString(NUM_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </button>
              <button className="btn sm gh" title={mode === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'} onClick={() => setMode(m => { const n = m === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('rms8:mode', n); } catch { } return n; })} style={{ fontSize: 15 }}>{mode === 'dark' ? '🌞' : '🌙'}</button>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="btn sm gh themebtn" title="ثيم المنصّة" onClick={() => setThemePick(v => !v)} style={{ fontSize: 15 }}>🎨</button>
                {themePick && (<>
                  <div className="usermenu-back" onClick={() => setThemePick(false)} />
                  <div className="usermenu-menu" style={{ minWidth: 252, padding: 8, zIndex: 70 }}>
                    <div className="umhd" style={{ padding: '4px 6px 8px' }}><b>ثيم المنصّة</b><small>أسلوب التصميم والوضع — فوريّ ومحفوظ</small></div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[['light', '🌞 نهار'], ['dark', '🌙 ليل']].map(([mv, lbl]) => (
                        <button key={mv} onClick={() => { setMode(mv); try { localStorage.setItem('rms8:mode', mv); } catch { } }}
                          style={{ flex: 1, padding: '7px 6px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: 'var(--txt)', border: '1px solid ' + (mode === mv ? 'var(--brass)' : 'var(--line)'), background: mode === mv ? 'var(--acc-soft)' : 'transparent' }}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {THEME_ORDER.map(id => { const m = THEME_META[id]; const on = normTheme(theme) === id; return (
                        <button key={id} onClick={() => { setTheme(id); try { localStorage.setItem('rms8:theme', id); } catch { } }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', border: '1px solid ' + (on ? 'var(--brass)' : 'var(--line)'), background: on ? 'var(--acc-soft)' : 'transparent', color: 'var(--txt)' }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: m.color, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.35)' }} />
                          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}{on ? ' ✓' : ''}</span><span style={{ fontSize: 9, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{m.desc}</span></span>
                        </button>
                      ); })}
                    </div>
                  </div>
                </>)}
              </div>
              <button className="btn sm gh" onClick={() => setBell(true)} style={{ position: 'relative' }}>
                <Bell size={15} />
                {unread > 0 && <span style={{
                  position: 'absolute', top: -3, insetInlineEnd: -3, background: 'var(--rose)',
                  width: 15, height: 15, borderRadius: '50%', fontSize: 9, display: 'grid',
                  placeItems: 'center', color: '#fff', fontWeight: 700
                }}>{unread}</span>}
              </button>
              {/* قائمة الحساب — v9.6 (بديل ذيل القائمة الجانبية المخفية) · v15.8: على الجوال تفتح لوحة «الأقسام» السفلية بدل القائمة المنسدلة التي يقصّها رأس الجوال */}
              <div className="usermenu">
                <button className="usermenu-btn" onClick={() => { if (typeof window !== 'undefined' && window.innerWidth <= 900) { setUserMenu(false); setMoreSheet(true); } else { setUserMenu(v => !v); } }} title="حسابي">
                  <span className="uav">{(me.name || 'م').trim().charAt(0)}</span>
                  <span className="un">{(me.name || '').split(' ')[0]}<small>{((ROLES[me.role] || {}).ar || me.role).split('—')[0].trim()}</small></span>
                  <ChevronDown size={13} />
                </button>
                {userMenu && (<>
                  <div className="usermenu-back" onClick={() => setUserMenu(false)} />
                  <div className="usermenu-menu">
                    <div className="umhd"><b>{me.name}</b><small>{me.email || ''}</small></div>
                    <button onClick={() => { setUserMenu(false); setTab('home'); }}><Home size={14} />الرئيسية — كل التطبيقات</button>
                    {!installed && <button onClick={() => { setUserMenu(false); doInstall(); }}><Download size={14} />تثبيت التطبيق على الجهاز</button>}
                    <button onClick={() => { setUserMenu(false); forceUpdate(); }}><RefreshCw size={14} />تحديث للأحدث (مسح الكاش){updateReady ? ' — نسخة جديدة!' : ''}</button>
                    <button onClick={() => { setUserMenu(false); setTour(true); }}><Compass size={14} />جولة تعريفية في المنصة</button>
                    {authApi.enabled && <button onClick={() => { setUserMenu(false); setPwOpen(true); }}><Lock size={14} />تغيير كلمة السر</button>}
                    <button onClick={() => { setUserMenu(false); setBioOpen(true); }}><Fingerprint size={14} />البصمة لهذا الجهاز{devBioId(me) ? ' ✓' : ''}</button>
                    {authApi.enabled && <button onClick={() => { setUserMenu(false); setMfaOpen(true); }}><ShieldCheck size={14} />التحقق بخطوتين{mfaS && mfaS.enrolled ? ' ✓' : ''}</button>}
                    {(me.pinHash || me.bioCredId || devBioId(me)) && (
                      <button onClick={() => { setUserMenu(false); setLocked(true); }}><Lock size={14} />قفل الشاشة — عودة بالدخول السريع</button>
                    )}
                    {(ROLES[me.role] || {}).admin && <button onClick={() => { setUserMenu(false); resetAll(); }}><Trash2 size={14} />تفريغ بيانات المنصة</button>}
                    <button className="danger" onClick={() => { setUserMenu(false); sessLogout(); }}><LogOut size={14} />تسجيل الخروج</button>
                  </div>
                </>)}
              </div>
            </div>
          </header>

          {updShow && (
            <div style={{
              position: 'relative', overflow: 'hidden',
              background: 'rgba(79,178,134,.16)', borderBottom: '1px solid rgba(79,178,134,.45)',
              color: 'var(--mint)', padding: '9px 20px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap'
            }}>
              <RefreshCw size={15} />
              <span>نسخة أحدث من المنصة متوفّرة —{' '}
                {updPaused
                  ? <b>التحديث التلقائي متوقف مؤقتًا أثناء الإدخال (لن تضيع بياناتك)</b>
                  : <>تُحدَّث تلقائيًا خلال <b className="num" style={{ fontSize: 14 }}>{updLeft}</b> ثانية</>}
              </span>
              <button className="btn sm pri" onClick={forceUpdate}><RefreshCw size={13} />تحديث الآن</button>
              <button className="btn sm gh" onClick={() => { setUpdSnooze(Date.now() + 10 * 60000); setUpdLeft(UPD_SECS); }}>لاحقًا (10 دقائق)</button>
              <div style={{ position: 'absolute', insetInlineStart: 0, bottom: 0, height: 3, background: 'var(--mint)', opacity: updPaused ? 0.3 : 0.8,
                width: (Math.max(0, updLeft) / UPD_SECS * 100) + '%', transition: 'width 1s linear' }} />
            </div>
          )}

          {accessErr && (() => {
            // v27.1 — تشخيص صلاحيات الخادم على جهاز الفرع (يظهر بدل الفشل الصامت)
            const nm = (id) => ((org.branches || []).find(x => x.id === id) || {}).name || id;
            const mem = accessErr.mem || null;
            const memBr = mem ? [mem.branchId, ...(mem.branchIds || [])].filter(Boolean) : [];
            const diag = accessErr.kind === 'dir'
              ? 'الخادم رفض قراءة الدليل العام لهذا الحساب — عضويته على الخادم غير نشطة أو غير موجودة.'
              : 'الخادم رفض قراءة/كتابة بيانات فرع ' + (accessErr.ids || []).map(nm).join('، ') + ' لهذا الحساب'
                + (mem && mem.exists ? ' — عضويته على الخادم' + (memBr.length ? ' مرتبطة بفرع ' + memBr.map(nm).join('، ') : ' بلا فرع') + (mem.scope ? ' (نطاق ' + mem.scope + ')' : '') + ' بينما حسابه في المنصة مرتبط بفرع ' + (accessErr.expected || []).map(nm).join('، ') + '.' : (mem && !mem.exists ? ' — لا توجد عضوية له على الخادم.' : '.'));
            return (
              <div style={{ background: 'rgba(217,84,77,.14)', borderBottom: '1px solid rgba(217,84,77,.45)', color: 'var(--rose)', padding: '9px 20px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <ShieldAlert size={16} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <b>لن تُحفظ أي بيانات من هذا الجهاز سحابيًا.</b> {diag}
                  <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--dim)' }}>الحل: يفتح مسؤول النظام «الفروع والمستخدمون ← المستخدمون» ويضغط «مزامنة صلاحيات الأعضاء» (أو يعيد حفظ هذا المستخدم)، ثم يُعاد الدخول هنا.</div>
                </div>
                <button className="btn sm" onClick={() => location.reload()}><RefreshCw size={13} />أعد المحاولة</button>
              </div>
            );
          })()}

          {offline && (
            <div style={{
              background: 'rgba(224,164,88,.14)', borderBottom: '1px solid rgba(224,164,88,.4)',
              color: 'var(--amber)', padding: '9px 20px', fontSize: 12, display: 'flex', gap: 9, alignItems: 'center'
            }}>
              <AlertTriangle size={15} />
              انقطع الاتصال — تابع الإدخال، لكن الحفظ السحابي لن يكتمل حتى عودة الشبكة. تجنّب اعتماد الإغلاق الآن.
            </div>
          )}

          {(newActivity.length > 0 || (unread > 0 && tab !== 'audit')) && (
            <div className="actbar">
              <div className="row" style={{ gap: 9, alignItems: 'center', flex: 1, minWidth: 0 }}>
                <span className="actbar-dot" />
                <Bell size={14} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {newActivity.length > 0
                    ? <>نشاط جديد: <b>{latestActivity?.userName}</b> — {latestActivity?.title}
                        {newActivity.length > 1 && <span className="num"> (+{newActivity.length - 1})</span>}</>
                    : <>لديك <span className="num">{unread}</span> تنبيه بانتظار الاطلاع</>}
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <button className="btn sm gh" onClick={() => { setTab('audit'); setLastSeenAudit(Date.now()); }}>
                  <Eye size={12} />سجل النشاط
                </button>
                <button className="btn sm gh" onClick={() => setLastSeenAudit(Date.now())} title="إخفاء">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="page">
            <div className="page-inner"><ErrorBoundary key={safeTab} where={(NAV.find(n => n.id === safeTab) || {}).ar || 'هذا القسم'}>
              {safeTab === 'home' && <Launcher {...shared} online={online} />}
              {['analytics', 'exec', 'dash', 'compare', 'growth', 'breakeven', 'scorecard', 'scenario', 'ai', 'alerts'].includes(safeTab) && <Hub hubId="analytics" {...shared} online={online} view={safeTab} />}
              {['reporting', 'reports', 'rbuild', 'boardpack', 'cashflow'].includes(safeTab) && <Hub hubId="reporting" {...shared} view={safeTab} />}
              {safeTab === 'sales' && <SalesHub {...shared} />}
              {safeTab === 'pos' && <PosApp {...shared} />}
              {['closing', 'approve', 'shifts', 'cashiers'].includes(safeTab) && <Hub hubId="closehub" {...shared} view={safeTab} />}
              {HR_TABS.includes(safeTab) && <Hub hubId="hr" {...shared} view={safeTab} />}
              {safeTab === 'qrfb' && <QrFeedback {...shared} />}
              {safeTab === 'apps' && <AppsCenter {...shared} />}

              {['purchasing', 'suppliers', 'reorder'].includes(safeTab) && <Hub hubId="purchasing" {...shared} view={safeTab} />}
              {safeTab === 'inv' && <Inventory {...shared} />}
              {safeTab === 'whbranch' && <BranchWarehouse {...shared} />}
              {safeTab === 'partners' && <Partners {...shared} />}
              {['acct', 'treasury', 'entities'].includes(safeTab) && <Hub hubId="finhub" {...shared} view={safeTab} />}
              {['docs', 'archive'].includes(safeTab) && <Hub hubId="docshub" {...shared} view={safeTab} />}
              {safeTab === 'admin' && <Admin {...shared} />}
              {safeTab === 'audit' && <AuditView {...shared} onSeen={() => setLastSeenAudit(Date.now())} />}
            </ErrorBoundary></div>
          </div>

          <div className="tick">
            <span>الشركة: {org.company.name || '—'}</span>
            {org.company.taxNumber && <span>الرقم الضريبي: <span className="num">{org.company.taxNumber}</span></span>}
            <span>{myBranches.length === 1 ? 'فرعك' : 'فروعك'}: <span className="num">{myBranches.filter(b => b.isActive).length}</span></span>
            <span>إغلاقاتك المسجلة: <span className="num">{scoped.closings.length}</span></span>
            <span style={{ color: live ? 'var(--mint)' : 'var(--dim)' }}>{live ? 'مزامنة لحظية' : 'مزامنة دورية'}</span>
          </div>
        </div>
      {/* شريط تنقّل سفلي — يظهر على الجوال فقط */}
      <nav className="botnav">
        {botNav.map(n => (
          <button key={n.id} className={'botnav-i' + (tab === n.id || (BOT_SUB[n.id] || []).includes(tab) ? ' on' : '')} onClick={() => { setTab(n.id); setMoreSheet(false); }}>
            <n.icon size={20} />
            <span>{BOT_AR[n.id] || n.ar.split(' ')[0]}</span>
            {n.cnt > 0 && <span className="bdg">{n.cnt}</span>}
          </button>
        ))}
        {NAV.length > botNav.length && (
          <button className={'botnav-i botnav-more' + (moreSheet ? ' on' : '')} onClick={() => setMoreSheet(v => !v)}>
            <Grid3x3 size={20} />
            <span>المزيد</span>
            {(pending + unread) > 0 && !moreSheet && <span className="bdg">{pending + unread}</span>}
          </button>
        )}
      </nav>
      </div>



      {bioOpen && <Modal title="البصمة لهذا الجهاز" icon={Fingerprint} onClose={() => setBioOpen(false)}><BioPanel me={me} say={say} onLockNow={() => { setBioOpen(false); setLocked(true); }} /></Modal>}
      {pwOpen && <Modal title="تغيير كلمة السر" icon={Lock} onClose={() => setPwOpen(false)}>
        <PasswordPanel me={me} mfa={!!(mfaS && mfaS.enrolled)} say={say} onDone={() => setPwOpen(false)} /></Modal>}
      {mfaOpen && <Modal title="التحقق بخطوتين" icon={ShieldCheck} onClose={() => setMfaOpen(false)}>
        <MfaPanel me={me} required={mfaNeed} onDone={sessLogout} onLogout={sessLogout} say={say} info={mfaS} reload={mfaReload} /></Modal>}
      {moreSheet && (
        <div className="sheet-mask" onClick={() => setMoreSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <span>كل الأقسام</span>
              <button className="btn sm gh" onClick={() => setMoreSheet(false)}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 10, alignItems: 'center', padding: '2px 4px 10px' }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--acc-soft)', color: 'var(--brass)', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{(me.name || 'م').trim().charAt(0)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.email || ((ROLES[me.role] || {}).ar || me.role)}</div>
                </div>
              </div>
              <div className="grid g2" style={{ gap: 8 }}>
                <button className="btn gh" onClick={() => { setMoreSheet(false); forceUpdate(); }}><RefreshCw size={15} />تحديث للأحدث</button>
                <button className="btn" style={{ background: 'rgba(217,84,77,.14)', color: 'var(--rose)', borderColor: 'rgba(217,84,77,.42)' }} onClick={() => { setMoreSheet(false); setMe(null); }}><LogOut size={15} />تسجيل الخروج</button>
              </div>
              <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setMoreSheet(false); setBioOpen(true); }}><Fingerprint size={15} />البصمة / بصمة الوجه لهذا الجهاز{devBioId(me) ? ' — مفعّلة ✓' : ''}</button>
              {authApi.enabled && <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setMoreSheet(false); setPwOpen(true); }}><Lock size={15} />تغيير كلمة السر</button>}
              {authApi.enabled && <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setMoreSheet(false); setMfaOpen(true); }}>
                <ShieldCheck size={15} />التحقق بخطوتين{mfaS && mfaS.enrolled ? ' — مفعّل ✓' : ' — غير مفعّل'}</button>}
            </div>
            <div className="iconsgrid">
              {NAV_SHOW.map(n => (
                <button key={n.id} className={'icontile' + (tab === n.id ? ' on' : '')}
                  onClick={() => { setTab(n.id); setMoreSheet(false); }}>
                  <div className="icontile-i"><n.icon size={22} />
                    {n.cnt > 0 && <span className="icontile-b">{n.cnt}</span>}
                  </div>
                  <span>{n.ar}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bell && <Notifications ops={ops} org={org} me={me} myBranches={myBranches} commit={commit} onClose={() => setBell(false)} />}
      {tour && <TourModal me={me} onClose={() => setTour(false)} go={(t) => { setTab(t); setTour(false); }} />}

      {sessWarnLeft != null && (
        <Modal title="ستنتهي الجلسة قريباً" icon={Clock}
          onClose={() => { lastActRef.current = Date.now(); setSessWarnLeft(null); }}>
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div className="num" style={{ fontSize: 44, fontWeight: 800, color: sessWarnLeft <= 10 ? 'var(--rose)' : 'var(--brass)' }}>{sessWarnLeft}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.8 }}>
              لا يوجد نشاط منذ فترة — حمايةً لحسابك سيُسجَّل خروجك تلقائياً خلال الثواني أعلاه.
            </div>
            <button className="btn pri" style={{ marginTop: 14 }}
              onClick={() => { lastActRef.current = Date.now(); setSessWarnLeft(null); }}>
              <Check size={14} />متابعة الجلسة
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className={'mz-toast ' + (toast.kind === 'no' ? 'no' : 'ok')} role="status" aria-live="polite" onClick={() => setToast(null)}>
          <span className="mz-toast-i" aria-hidden="true">{toast.kind === 'no' ? '!' : '✓'}</span><span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* ================= بوابة الدخول ================= */
function BrandHead({ title, sub, logo }) {
  return (
    <div className="bhead" style={{ textAlign: 'center', marginBottom: 24 }}>
      {logo
        ? <img src={logo} alt="شعار" className="bhead-logo" style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 16, objectFit: 'cover', border: '1px solid var(--line)', display: 'block' }} />
        : <div className="brand-mark bhead-logo" style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 18 }}>
          <MizanMark size={44} anim />
        </div>}
      <h1 style={{ fontSize: 20 }}>{title || 'ميزان — منصة إدارة المطاعم'}</h1>
      <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 5 }}>{sub}</div>
    </div>
  );
}

/* ================= التسجيل الأول (إنشاء حساب المالك) ================= */
function FirstRun({ css, theme, commitOrg, say, onDone }) {
  const [f, setF] = useState({ company: '', taxNumber: '', name: '', email: '', pass: '', pass2: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const create = async () => {
    if (!f.company.trim()) return say('اكتب اسم المنشأة', 'no');
    if (!f.name.trim()) return say('اكتب اسمك', 'no');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return say('أدخل بريداً إلكترونياً صحيحاً', 'no');
    if (f.pass.length < 6) return say('كلمة السر يجب ألا تقل عن 6 أحرف', 'no');
    if (f.pass !== f.pass2) return say('كلمتا السر غير متطابقتين', 'no');
    setBusy(true);
    // v28.1: مع Firebase تحفظ المصادقةُ كلمة السر — لا بصمة في مستند المنشأة
    const passHash = authApi.enabled ? '' : await sha(f.pass);
    const owner = {
      id: uid('u'), name: f.name.trim(), email: f.email.trim().toLowerCase(),
      role: 'system_admin', ...(passHash ? { passHash } : {}), isActive: true, createdAt: today()
    };
    await commitOrg(d => ({
      ...d,
      company: { ...d.company, name: f.company.trim(), taxNumber: f.taxNumber.trim() },
      users: [owner],
      setupComplete: true
    }), { actionType: 'create', targetType: 'user_account', targetId: owner.id, title: 'أنشأ حساب المالك وهيّأ المنصة', details: f.company.trim() });
    setBusy(false);
    say('تم إنشاء المنصة — أضف الآن فروعك ومستخدميك');
    onDone(owner);
  };

  return (
    <div className={themeCls(theme, readMode())}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <BrandHead title="تهيئة المنصة لأول مرة" sub="أنشئ حساب المالك — سيكون لك وصول كامل لكل الشاشات" />
          <div className="card">
            <div className="lbl" style={{ marginBottom: 8 }}>بيانات المنشأة</div>
            <Field label="اسم المنشأة">
              <input className="inp" value={f.company} placeholder="مثال: مجموعة … للمطاعم" onChange={e => set('company', e.target.value)} />
            </Field>
            <Field label="الرقم الضريبي (اختياري الآن)">
              <input className="inp n" value={f.taxNumber} placeholder="3xxxxxxxxxxxxx3" onChange={e => set('taxNumber', e.target.value)} />
            </Field>
            <hr className="hr" />
            <div className="lbl" style={{ marginBottom: 8 }}>حساب المالك (المدير العام)</div>
            <Field label="الاسم الكامل">
              <input className="inp" value={f.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label="البريد الإلكتروني">
              <input className="inp" type="email" style={{ direction: 'ltr', textAlign: 'right' }} value={f.email}
                placeholder="owner@company.com" onChange={e => set('email', e.target.value)} />
            </Field>
            <div className="grid g2">
              <Field label="كلمة السر">
                <input className="inp" type="password" value={f.pass} onChange={e => set('pass', e.target.value)} />
              </Field>
              <Field label="تأكيد كلمة السر">
                <input className="inp" type="password" value={f.pass2} onChange={e => set('pass2', e.target.value)} />
              </Field>
            </div>
            <button className="btn pri" style={{ width: '100%', marginTop: 6 }} disabled={busy} onClick={create}>
              {busy ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
              إنشاء المنصة والدخول
            </button>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, lineHeight: 1.8, textAlign: 'center' }}>
              كلمة السر تُخزَّن مجزّأة (SHA-256) ولا تُحفظ كنص. احتفظ بها — لا يمكن استرجاعها.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= بوابة الدخول (بريد وكلمة سر) ================= */
/* ================= بوابة الدخول — المصادقة السحابية الحقيقية ================= */
/* v31.3 — سياسة إلزام التحقق بخطوتين (يُفرض على الخادم بقواعد Firestore) */
const MFA_DEFAULT_ROLES = ['general_management', 'finance_department', 'accountant', 'head_office'];
/* MfaPolicyCard: نُقل إلى mods/admin/MfaPolicyCard.jsx (تحميل كسول) */

/* v32.3 — تفعيل البصمة / بصمة الوجه لهذا الجهاز ذاتيًا */
function BioPanel({ me, say, onLockNow }) {
  const [avail, setAvail] = useState(null); const [on, setOn] = useState(!!devBioId(me)); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { bioAvailable().then(setAvail); }, []);
  const enable = async () => {
    setBusy(true); setErr('');
    try { const id = await bioEnroll({ id: me.id, email: me.email, name: me.name }); setDevBio(me, id); setOn(true); say('فُعّلت البصمة لهذا الجهاز ✓'); }
    catch (e) { const n = String((e && e.name) || ''); setErr(n === 'NotAllowedError' ? 'أُلغي الطلب أو انتهت مهلته — أعد المحاولة وأكّد بالبصمة أو بصمة الوجه' : n === 'InvalidStateError' ? 'هذا الجهاز مسجّل مسبقًا — ألغِ ثم فعّل من جديد' : 'تعذّر التفعيل (' + (n || (e && e.message) || '') + ')'); }
    setBusy(false);
  };
  const disable = () => { setDevBio(me, ''); setOn(false); say('أُلغيت البصمة لهذا الجهاز'); };
  return (
    <div className="grid" style={{ gap: 10 }}>
      <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>بعد التفعيل يُطلب <b>بصمة الوجه أو الإصبع</b> كلما فتحت المنصة على هذا الجهاز أو عدت إليها بعد دقيقتين — بدل كتابة كلمة السر. تسجيل الدخول الكامل يبقى بكلمة السر والتحقق بخطوتين.</div>
      {inAppBrowser() && <div className="note" style={{ color: 'var(--amber)' }}>أنت تفتح المنصة من داخل تطبيق آخر (مثل واتساب أو البريد) — هذه المتصفحات الداخلية لا تدعم البصمة. افتح الرابط في <b>Safari</b> أو أضف المنصة للشاشة الرئيسية.</div>}
      {avail === false && !inAppBrowser() && <div className="note" style={{ color: 'var(--amber)' }}>هذا الجهاز أو المتصفح لا يتيح البصمة الآن. على الآيفون: تأكد من تفعيل بصمة الوجه من الإعدادات ← Face ID ورمز الدخول، وافتح المنصة من Safari أو من أيقونتها في الشاشة الرئيسية.</div>}
      {on ? <>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="badge b-mint"><Check size={11} />مفعّلة على هذا الجهاز</span>
          <button className="btn sm" onClick={onLockNow}><Lock size={13} />جرّبها الآن (قفل)</button>
          <button className="btn sm gh" onClick={disable}><Trash2 size={13} color="#D9544D" />إلغاء</button></div>
      </> : <button className="btn pri" disabled={busy || avail === false} onClick={enable}>{busy ? <RefreshCw size={14} className="spin" /> : <ScanFace size={15} />}تفعيل البصمة / بصمة الوجه</button>}
      {err && <div className="gate-err">{err}</div>}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.7 }}>تُحفظ على هذا الجهاز وحده — فعّلها على كل جهاز تستخدمه. مسح بيانات Safari يلغيها فتفعّلها من جديد.</div>
    </div>);
}

/* v31.9 — تغيير كلمة السر ذاتيًا (Firebase): الكلمة الحالية + رمز التطبيق إن كان التحقق بخطوتين مفعّلًا */
const pwStrength = (p) => { p = String(p || ''); if (p.length < 8) return 'ثمانية أحرف على الأقل'; if (!/[A-Za-z؀-ۿ]/.test(p) || !/\d/.test(p)) return 'تحتوي حروفًا وأرقامًا معًا'; return ''; };
/* PasswordPanel: نُقل إلى mods/admin/PasswordPanel.jsx (تحميل كسول) */

/* v31.3 — لوحة التحقق بخطوتين: تسجيل تطبيق المصادقة (رمز QR + مفتاح احتياطي) أو إلغاؤه */
function MfaPanel({ me, required, inline, onDone, onLogout, say, info, reload }) {
  const [step, setStep] = useState('idle'); const [pass, setPass] = useState(''); const [code, setCode] = useState('');
  const [sec, setSec] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const errOf = (e) => { const c = String((e && e.code) || '');
    if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'كلمة السر غير صحيحة';
    if (c.includes('unverified-email')) return 'verify';
    if (c.includes('operation-not-allowed') || c.includes('admin-restricted') || c.includes('not-enabled')) return 'التحقق بخطوتين غير مفعّل في مشروع Firebase بعد — يفعّله مسؤول النظام مرة واحدة (سير «تفعيل التحقق بخطوتين» في GitHub).';
    if (c.includes('invalid-verification-code')) return 'الرمز غير صحيح — تأكد أنك مسحت رمز QR الظاهر الآن (لا رمز محاولة سابقة)، وأن ساعة الهاتف تلقائية، واكتب الرمز قبل أن يتغير';
    if (c.includes('too-many-enrollment-attempts')) return 'أوقف نظام المصادقة المحاولات مؤقتًا بعد عدة رموز غير مقبولة. انتظر قرابة ساعة، ثم احذف حسابات «ميزان» القديمة من تطبيق المصادقة، واضغط «بدء التفعيل» مرة واحدة وامسح الرمز الجديد.';
    if (c.includes('too-many-requests')) return 'محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة';
    if (c.includes('requires-recent-login')) return 'أعد إدخال كلمة السر';
    return 'تعذّر الإجراء (' + c.replace('auth/', '') + ')'; };
  const start = async () => { if (!pass || busy) return; setBusy(true); setErr('');
    try { const r = await authApi.mfaStart(pass); setSec(r); setStep('scan'); setPass(''); } catch (e) { const m = errOf(e); if (m === 'verify') setStep('verify'); else setErr(m); } setBusy(false); };
  const finish = async () => { if (code.length !== 6 || busy) return; setBusy(true); setErr('');
    try { await authApi.mfaFinish(code); setStep('done'); say('فُعّل التحقق بخطوتين ✓ — سجّل الدخول من جديد بالرمز'); setTimeout(() => onDone && onDone(), 2500); } catch (e) { setErr(errOf(e)); } setBusy(false); };
  const remove = async () => { if (!pass || busy) return; if (!window.confirm('إلغاء التحقق بخطوتين؟ يصبح حسابك محميًا بكلمة السر وحدها.')) return; setBusy(true); setErr('');
    if (code.length !== 6) { setBusy(false); return setErr('اكتب رمز تطبيق المصادقة الحالي'); }
    try { await authApi.mfaRemove(pass, code); say('أُلغي التحقق بخطوتين — سجّل الدخول من جديد'); setTimeout(() => onLogout && onLogout(), 1500); } catch (e) { setErr(errOf(e)); } setBusy(false); };
  const sendV = async () => { setBusy(true); try { await authApi.sendVerify(); say('أُرسل رابط توثيق البريد إلى ' + me.email); } catch { setErr('تعذّر إرسال رابط التوثيق'); } setBusy(false); };
  const checkV = async () => { setBusy(true); const ok = await authApi.emailVerified(); setBusy(false); if (ok) { setStep('idle'); setErr(''); say('وُثّق البريد ✓ — تابع التفعيل'); } else setErr('لم يُوثَّق البريد بعد — افتح الرابط في بريدك ثم أعد المحاولة'); };
  const keyFmt = (k) => String(k || '').replace(/(.{4})/g, '$1 ').trim();
  const box = { background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 };
  const body = (
    <div className="grid" style={{ gap: 10 }}>
      {info && info.enrolled && step === 'idle' && <>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="badge b-mint">مفعّل ✓</span>{(info.factors || []).map(f => <span key={f.uid} className="badge b-dim">{f.name || 'تطبيق المصادقة'}{f.at ? ' · منذ ' + String(f.at).slice(0, 16) : ''}</span>)}</div>
        {info && !info.used && <div className="note" style={{ color: 'var(--amber)' }}>هذه الجلسة بدأت قبل التفعيل — سجّل الخروج وادخل بالرمز ليصبح دخولك محميًا.</div>}
        {required ? <div className="note">سياسة المنشأة تُلزم دورك بالتحقق بخطوتين — لا يمكن إلغاؤه.</div> : <>
          <Field label="كلمة السر (لإلغاء التحقق بخطوتين)"><input className="inp" type="password" value={pass} onChange={e => setPass(e.target.value)} /></Field>
          <Field label="رمز التطبيق الحالي"><input className="inp n" inputMode="numeric" maxLength={6} placeholder="000000" style={{ direction: 'ltr', textAlign: 'center', letterSpacing: 4 }} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
          <button className="btn gh" disabled={busy || !pass} onClick={remove}>إلغاء التحقق بخطوتين</button></>}
      </>}
      {(!info || !info.enrolled) && step === 'idle' && <>
        <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>بعد التفعيل يطلب الدخول <b>كلمة السر + رمزًا متغيرًا من 6 أرقام</b> من تطبيق المصادقة في هاتفك (Google Authenticator أو Microsoft Authenticator أو غيرهما). من يعرف كلمة سرك وحدها لا يستطيع الدخول.</div>
        <Field label="أدخل كلمة السر للمتابعة"><input className="inp" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && start()} /></Field>
        <button className="btn pri" disabled={busy || !pass} onClick={start}>{busy ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}بدء التفعيل</button>
      </>}
      {step === 'verify' && <>
        <div className="note">يتطلب التحقق بخطوتين بريدًا موثّقًا. أرسل رابط التوثيق إلى <b>{me.email}</b>، افتحه من بريدك، ثم اضغط «تحققت».
          <div style={{ marginTop: 6 }}>💡 إن لم تجد الرسالة فابحث في <b>البريد غير المرغوب فيه</b>. هناك يعطّل البريد الروابط — اضغط «ليست رسالة مزعجة» لتنتقل إلى الوارد فيعمل الرابط، أو انسخ الرابط كاملًا والصقه في المتصفح.</div></div>
        <div className="row" style={{ gap: 8 }}><button className="btn" disabled={busy} onClick={sendV}>إرسال رابط التوثيق</button><button className="btn pri" disabled={busy} onClick={checkV}>تحققت — متابعة</button></div>
      </>}
      {step === 'scan' && sec && <>
        <div style={{ fontSize: 12.5 }}>1) افتح تطبيق المصادقة واختر «إضافة حساب» ثم امسح الرمز:</div>
        <div style={{ fontSize: 11, color: 'var(--amber)' }}>إن كان في التطبيق حساب «ميزان» من محاولة سابقة فاحذفه أولًا — كل محاولة تولّد رمزًا جديدًا.</div>
        <div style={{ ...box, display: 'grid', placeItems: 'center', background: '#fff' }} dangerouslySetInnerHTML={{ __html: qrSvg(sec.url, { ecl: 1, px: 190 }) }} />
        <div style={box}><div style={{ fontSize: 11, color: 'var(--dim)' }}>أو أدخل هذا المفتاح يدويًا — <b>واحفظه في مكان آمن</b>: به تعيد إضافة الحساب لهاتف جديد إن فقدت هاتفك</div>
          <div className="num" style={{ direction: 'ltr', fontSize: 15, fontWeight: 800, letterSpacing: 1, marginTop: 6, wordBreak: 'break-all' }}>{keyFmt(sec.key)}</div></div>
        <div style={{ fontSize: 12.5 }}>2) اكتب الرمز الظاهر في التطبيق:</div>
        <input className="inp n" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center', direction: 'ltr' }}
          value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} onKeyDown={e => e.key === 'Enter' && finish()} />
        <button className="btn pri" disabled={busy || code.length !== 6} onClick={finish}>{busy ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}تأكيد التفعيل</button>
      </>}
      {step === 'done' && <div className="note" style={{ color: 'var(--mint)' }}>✓ فُعّل التحقق بخطوتين. سيُسجَّل خروجك الآن — ادخل من جديد بكلمة السر ثم الرمز.</div>}
      {err && <div className="gate-err">{err}</div>}
      {inline && <button className="btn gh" onClick={onLogout}><LogOut size={14} />تسجيل الخروج</button>}
    </div>);
  return inline ? <div className="card">{body}</div> : body;
}

function FbGate({ css, theme, fbLogin, fbMfa, fbFirstSetup, notice }) {
  const [mfa, setMfa] = useState(false); const [code, setCode] = useState(''); const [note, setNote] = useState('');
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('rms8:lastEmail') || ''; } catch { return ''; } });
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [setup, setSetup] = useState(false);

  const go = async () => {
    if (!email || !pass || busy) return;
    setErr(''); setBusy(true);
    const r = setup ? await fbFirstSetup(email, pass) : await fbLogin(email, pass);
    setBusy(false);
    if (r.mfa) { setMfa(true); setCode(''); return; }
    if (!r.ok) setErr(r.err || 'تعذّر الدخول');
  };
  const goMfa = async () => {
    if (code.length !== 6 || busy) return; setErr(''); setBusy(true);
    const r = await fbMfa(code); setBusy(false);
    if (!r.ok) { setErr(r.err || 'تعذّر التحقق'); if (/أعد إدخال كلمة السر/.test(r.err || '')) { setMfa(false); setPass(''); } }
  };

  return (
    <div className={themeCls(theme, readMode())}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <BrandHead title="ميزان — منصة إدارة المطاعم" sub="دخول موثّق — البيانات محمية بحساب مصادقة لكل مستخدم" />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="badge b-mint"><Lock size={10} />مصادقة سحابية مفعّلة</span>
          </div>
          <div className="card">
            {notice && <div style={{ border: '1px solid rgba(200,162,74,.45)', background: 'rgba(200,162,74,.10)', color: 'var(--brass-l)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12, lineHeight: 1.8, textAlign: 'center' }}>{notice}</div>}
            {setup && <div style={{ border: '1px solid rgba(200,162,74,.4)', background: 'rgba(200,162,74,.08)', color: 'var(--brass-l)', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.7 }}>
              الإعداد الأول (مرة واحدة بعد الترقية): أدخل بريد المالك وكلمة سر جديدة — يُنشأ حساب المصادقة وتصبح مديرًا للمنصة.
            </div>}
            {mfa ? (<>
              <div style={{ textAlign: 'center', marginBottom: 12 }}><ShieldCheck size={30} color="var(--brass)" />
                <div style={{ fontWeight: 800, marginTop: 6 }}>التحقق بخطوتين</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4, lineHeight: 1.7 }}>افتح تطبيق المصادقة في هاتفك واكتب الرمز المكوّن من 6 أرقام لحساب «ميزان»</div></div>
              <input className="inp n" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
                style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center', direction: 'ltr' }} value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} onKeyDown={e => e.key === 'Enter' && goMfa()} />
              {err && <div className="gate-err" style={{ marginTop: 10 }}>{err}</div>}
              <button className="btn pri" style={{ width: '100%', marginTop: 12 }} disabled={busy || code.length !== 6} onClick={goMfa}>
                {busy ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}تحقق ودخول</button>
              <button className="btn gh" style={{ width: '100%', marginTop: 10 }} onClick={() => { setMfa(false); setPass(''); setErr(''); }}>رجوع</button>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, lineHeight: 1.7, textAlign: 'center' }}>فقدت هاتفك؟ أضف الحساب لهاتف جديد بالمفتاح الذي حفظته عند التفعيل، أو راجع مسؤول النظام.</div>
            </>) : (<>
            <Field label="البريد الإلكتروني">
              <input className="inp" type="email" autoFocus style={{ direction: 'ltr', textAlign: 'right' }}
                value={email} placeholder="you@company.com"
                onChange={e => { setEmail(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && go()} />
            </Field>
            <Field label={setup ? 'كلمة سر جديدة (6 أحرف فأكثر)' : 'كلمة السر'}>
              <div style={{ position: 'relative' }}>
                <input className="inp" type={show ? 'text' : 'password'} value={pass}
                  onChange={e => { setPass(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && go()} />
                <button className="btn sm gh" style={{ position: 'absolute', insetInlineEnd: 4, top: 4, padding: '4px 8px' }}
                  onClick={() => setShow(s => !s)} tabIndex={-1}><Eye size={14} /></button>
              </div>
            </Field>
            {err && <div className="gate-err">{err}</div>}
            <button className="btn pri" style={{ width: '100%' }} disabled={busy || !email || !pass} onClick={go}>
              {busy ? <RefreshCw size={15} className="spin" /> : <Lock size={15} />}
              {setup ? 'إنشاء حساب المصادقة والدخول' : 'دخول'}
            </button>
            <button className="btn gh" style={{ width: '100%', marginTop: 10 }} onClick={() => { setSetup(s => !s); setErr(''); }}>
              {setup ? 'لديّ حساب — عودة للدخول' : 'الإعداد الأول بعد الترقية (للمالك)'}
            </button>
            {!setup && <button className="btn gh" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={async () => {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة السر؟»');
              setBusy(true); try { await authApi.resetPass(email); } catch { } setBusy(false);
              setErr(''); setNote('إن كان البريد مسجّلًا فسيصله رابط تعيين كلمة السر خلال دقائق. إن وجدته في البريد غير المرغوب فيه فاضغط «ليست رسالة مزعجة» ليعمل الرابط، أو انسخه والصقه في المتصفح.');
            }}><Lock size={14} />نسيت كلمة السر؟</button>}
            {note && <div style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 10, lineHeight: 1.7, textAlign: 'center' }}>{note}</div>}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* v15.25 — شاشة القفل: عودة سريعة للجلسة برقم سري أو بصمة دون إعادة كتابة البريد وكلمة السر */
function LockScreen({ me, theme, mode, onUnlock, onLogout }) {
  const bioId = devBioId(me) || me.bioCredId || '';
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const tryPin = async () => {
    setErr('');
    const h = await sha('pin:' + pin);
    if (h === me.pinHash) onUnlock();
    else { setErr('الرقم السري غير صحيح'); setPin(''); }
  };
  const key = (d) => { setErr(''); if (d === 'del') setPin(p => p.slice(0, -1)); else setPin(p => (p.length < 6 ? p + d : p)); };
  const tryBio = async () => {
    setBusy(true); setErr('');
    try { await bioVerify(bioId); onUnlock(); }
    catch { setErr('تعذّر التحقق بالبصمة — ' + (me.pinHash ? 'جرّب الرقم السري' : 'أعد المحاولة، أو سجّل خروجًا كاملًا وادخل بكلمة السر')); }
    setBusy(false);
  };
  // v16.3 — بطلب المالك: لوحة القفل تستجيب للوحة المفاتيح مباشرة (مع بقاء الفأرة):
  // أرقام 0-9 (ومكافئاتها العربية 0-9 ولوحة الأرقام الجانبية) + Backspace للمسح + Enter للفتح.
  useEffect(() => {
    const AR = '٠١٢٣٤٥٦٧٨٩';
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = ((e.target && e.target.tagName) || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      let d = e.key;
      if (AR.includes(d)) d = String(AR.indexOf(d));
      if (/^[0-9]$/.test(d)) { e.preventDefault(); key(d); }
      else if (e.key === 'Backspace') { e.preventDefault(); key('del'); }
      else if (e.key === 'Enter') { e.preventDefault(); if (pin.length >= 4) tryPin(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin]);
  return (
    <div className={themeCls(theme, mode || readMode())}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="gate">
        <div className="gate-c">
          <div className="bhead" style={{ textAlign: 'center', marginBottom: 20 }}>
            <div className="brand-mark bhead-logo" style={{ width: 54, height: 54, margin: '0 auto 12px', fontSize: 19, borderRadius: 16 }}>
              {(me.name || 'م').trim().charAt(0) || 'م'}
            </div>
            <h1 style={{ fontSize: 19 }}>الشاشة مقفلة 🔒</h1>
            <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 5 }}>
              {me.name} — {bioId ? 'افتح بالبصمة أو بصمة الوجه' : 'ادخل سريعاً برقمك السري'}{bioId && me.pinHash ? ' أو برقمك السري' : ''}
            </div>
          </div>
          <div className="card">
            {me.pinHash ? (<>
              <div className="pin-dots">
                {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={'pin-dot' + (i < pin.length ? ' on' : '')} />)}
              </div>
              {err && <div className="gate-err">{err}</div>}
              <div className="pinpad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d =>
                  <button key={d} type="button" className="pinkey" onClick={() => key(d)}>{d}</button>)}
                <button type="button" className="pinkey ghost" onClick={() => setPin('')}>مسح</button>
                <button type="button" className="pinkey" onClick={() => key('0')}>0</button>
                <button type="button" className="pinkey ghost" onClick={() => key('del')} aria-label="حذف"><Delete size={17} /></button>
              </div>
              <button className="btn pri" style={{ width: '100%' }} disabled={pin.length < 4} onClick={tryPin}>
                <Grid3x3 size={15} />فتح
              </button>
            </>) : (
              <>
                {err && <div className="gate-err">{err}</div>}
                {!bioId && <div className="empty" style={{ padding: '10px 0' }}>
                  لا رقم سري ولا بصمة لهذا الجهاز — سجّل الخروج وادخل بكلمة السر.
                </div>}
              </>
            )}
            {bioId && webauthnSupported() && (
              <button className={'btn' + (me.pinHash ? '' : ' pri')} style={{ width: '100%', marginTop: 10, padding: me.pinHash ? undefined : '14px 0', fontSize: me.pinHash ? undefined : 15 }} disabled={busy} onClick={tryBio}>
                {busy ? <RefreshCw size={15} className="spin" /> : <Fingerprint size={16} />}فتح بالبصمة الحيوية
              </button>
            )}
            <button className="btn gh" style={{ width: '100%', marginTop: 10 }} onClick={onLogout}>
              <LogOut size={14} />تسجيل خروج كامل — دخول بحساب آخر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gate({ css, org, onLogin, online, theme, notice }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [mode, setMode] = useState('pass');   // pass | pin
  const [pin, setPin] = useState('');
  const bioUsers = (org.users || []).filter(u => u.isActive && u.bioCredId);
  const hasPinUsers = (org.users || []).some(u => u.isActive && u.pinHash);

  // تذكّر آخر بريد على هذا الجهاز لتسريع الدخول
  useEffect(() => { try { const e = localStorage.getItem('rms8:lastEmail'); if (e) setEmail(e); } catch { } }, []);
  const finish = (u) => { try { localStorage.setItem('rms8:lastEmail', u.email || ''); } catch { } onLogin(u); };

  const bioLogin = async () => {
    setErr(''); setBioBusy(true);
    try {
      // نطابق البصمة مع الحساب المرتبط بها. عند تعدد الحسابات ذات البصمة على الجهاز
      // يكفي التحقق من أحدها؛ WebAuthn سيعرض المتاح على هذا الجهاز.
      const target = bioUsers.find(u => (u.email || '').toLowerCase() === email.trim().toLowerCase()) || bioUsers[0];
      await bioVerify(target.bioCredId);
      finish(target);
    } catch (e) {
      setErr('تعذّر التحقق بالبصمة. استخدم البريد وكلمة السر، أو جرّب مجدداً.');
    }
    setBioBusy(false);
  };

  const submit = async () => {
    setErr(''); setBusy(true);
    const u = (org.users || []).find(x => (x.email || '').toLowerCase() === email.trim().toLowerCase() && x.isActive);
    if (!u) { setBusy(false); return setErr('لا يوجد حساب نشط بهذا البريد'); }
    const h = await sha(pass);
    // دعم الحسابات القديمة التي تملك pin بدل passHash
    const ok = u.passHash ? u.passHash === h : (u.pin && u.pin === pass);
    setBusy(false);
    if (ok) finish(u);
    else setErr('كلمة السر غير صحيحة');
  };

  const pinSubmit = async () => {
    setErr(''); setBusy(true);
    const u = (org.users || []).find(x => (x.email || '').toLowerCase() === email.trim().toLowerCase() && x.isActive);
    if (!u) { setBusy(false); return setErr('لا يوجد حساب نشط بهذا البريد'); }
    if (!u.pinHash) { setBusy(false); return setErr('لا يوجد رقم سري لهذا الحساب — ادخل بكلمة السر، ثم اضبط رقماً سرياً من إدارة المستخدمين'); }
    const h = await sha('pin:' + pin);
    setBusy(false);
    if (h === u.pinHash) finish(u);
    else { setErr('الرقم السري غير صحيح'); setPin(''); }
  };
  const pinKey = (d) => { setErr(''); if (d === 'del') setPin(p => p.slice(0, -1)); else setPin(p => (p.length < 6 ? p + d : p)); };

  // v16.3 — بوابة «الدخول السريع برقم سري» تستجيب للوحة المفاتيح مباشرة (والفأرة متاحة كما هي):
  // أرقام 0-9/0-9/لوحة الأرقام + Backspace للمسح + Enter للدخول. الكتابة داخل حقل البريد لا تُلتقط.
  useEffect(() => {
    if (mode !== 'pin') return;
    const AR = '٠١٢٣٤٥٦٧٨٩';
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = ((e.target && e.target.tagName) || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      let d = e.key;
      if (AR.includes(d)) d = String(AR.indexOf(d));
      if (/^[0-9]$/.test(d)) { e.preventDefault(); pinKey(d); }
      else if (e.key === 'Backspace') { e.preventDefault(); pinKey('del'); }
      else if (e.key === 'Enter') { e.preventDefault(); if (pin.length >= 4) pinSubmit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, pin, email]);

  return (
    <div className={themeCls(theme, readMode())}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <BrandHead title={org.company?.name || 'ميزان'} sub="ميزان — منصة إدارة المطاعم: الإغلاق اليومي والمحاسبة والمشتريات والمخزون والموارد البشرية" logo={org.company?.logoUrl} />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="badge b-mint"><span className="dot" />{online.length} متصل الآن</span>
            <span className="badge b-dim"><Lock size={10} />بيانات مشتركة ومؤمّنة</span>
          </div>
          <div className="card">
            {notice && <div style={{ border: '1px solid rgba(200,162,74,.45)', background: 'rgba(200,162,74,.10)', color: 'var(--brass-l)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12, lineHeight: 1.8, textAlign: 'center' }}>{notice}</div>}
            {(hasPinUsers || mode === 'pin') && (
              <div className="loginseg">
                <button type="button" className={'loginseg-b' + (mode === 'pass' ? ' on' : '')} onClick={() => { setMode('pass'); setErr(''); }}><Lock size={13} />كلمة السر</button>
                <button type="button" className={'loginseg-b' + (mode === 'pin' ? ' on' : '')} onClick={() => { setMode('pin'); setErr(''); }}><Grid3x3 size={13} />دخول سريع برقم سري</button>
              </div>
            )}
            <Field label="البريد الإلكتروني">
              <input className="inp" type="email" autoFocus style={{ direction: 'ltr', textAlign: 'right' }}
                value={email} placeholder="you@company.com"
                onChange={e => { setEmail(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && (mode === 'pin' ? pinSubmit() : submit())} />
            </Field>

            {mode === 'pass' ? (
              <>
                <Field label="كلمة السر">
                  <div style={{ position: 'relative' }}>
                    <input className="inp" type={show ? 'text' : 'password'} value={pass}
                      onChange={e => { setPass(e.target.value); setErr(''); }}
                      onKeyDown={e => e.key === 'Enter' && submit()} />
                    <button className="btn sm gh" style={{ position: 'absolute', insetInlineEnd: 4, top: 4, padding: '4px 8px' }}
                      onClick={() => setShow(s => !s)} tabIndex={-1}><Eye size={14} /></button>
                  </div>
                </Field>
                {err && <div className="gate-err">{err}</div>}
                <button className="btn pri" style={{ width: '100%' }} disabled={busy || !email || !pass} onClick={submit}>
                  {busy ? <RefreshCw size={15} className="spin" /> : <Lock size={15} />}دخول
                </button>
              </>
            ) : (
              <>
                <div className="lbl" style={{ textAlign: 'center', marginBottom: 8 }}>أدخل الرقم السري</div>
                <div className="pin-dots">
                  {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={'pin-dot' + (i < pin.length ? ' on' : '')} />)}
                </div>
                {err && <div className="gate-err">{err}</div>}
                <div className="pinpad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d =>
                    <button key={d} type="button" className="pinkey" onClick={() => pinKey(d)}>{d}</button>)}
                  <button type="button" className="pinkey ghost" onClick={() => setPin('')}>مسح</button>
                  <button type="button" className="pinkey" onClick={() => pinKey('0')}>0</button>
                  <button type="button" className="pinkey ghost" onClick={() => pinKey('del')} aria-label="حذف"><Delete size={17} /></button>
                </div>
                <button className="btn pri" style={{ width: '100%' }} disabled={busy || !email || pin.length < 4} onClick={pinSubmit}>
                  {busy ? <RefreshCw size={15} className="spin" /> : <Grid3x3 size={15} />}دخول بالرقم السري
                </button>
              </>
            )}

            {bioUsers.length > 0 && webauthnSupported() && (
              <>
                <div className="row" style={{ justifyContent: 'center', margin: '12px 0', color: 'var(--faint)', fontSize: 11 }}>
                  <span style={{ height: 1, background: 'var(--line)', flex: 1 }} /> أو <span style={{ height: 1, background: 'var(--line)', flex: 1 }} />
                </div>
                <button className="btn" style={{ width: '100%' }} disabled={bioBusy} onClick={bioLogin}>
                  {bioBusy ? <RefreshCw size={15} className="spin" /> : <Fingerprint size={16} />}الدخول بالبصمة الحيوية
                </button>
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, lineHeight: 1.7, textAlign: 'center' }}>
              نسيت بياناتك؟ راجع المدير العام لإعادة تعيينها من إدارة المستخدمين.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= مكوّنات مشتركة ================= */
function Modal({ title, sub, icon: Icon, children, foot, onClose, wide, flow }) {
  // قفل تمرير الصفحة الخلفية بالكامل (يعمل مع تداخل النوافذ) + إغلاق بمفتاح Escape
  useEffect(() => {
    const de = document.documentElement, b = document.body;
    const prev = { htmlO: de.style.overflow, bodyO: b.style.overflow, osb: b.style.overscrollBehavior };
    de.style.overflow = 'hidden'; b.style.overflow = 'hidden'; b.style.overscrollBehavior = 'none';
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      de.style.overflow = prev.htmlO; b.style.overflow = prev.bodyO; b.style.overscrollBehavior = prev.osb;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // نُصيّر النافذة مباشرةً على body (Portal) حتى لا يحصرها أي عنصر أب فيه transform/filter
  return createPortal((
    <div className="mask" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className={'modal' + (flow ? ' modal-flow' : '')} style={flow ? undefined : (wide ? { maxWidth: 1100 } : undefined)}>
        <div className="modal-h">
          <div className="modal-h-t">
            <div className="card-t">{Icon && <Icon size={16} color="var(--brass)" />}{title}</div>
            {sub && <div className="modal-h-s">{sub}</div>}
          </div>
          <button className="btn sm gh" onClick={onClose} aria-label="إغلاق"><X size={15} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {foot && <div className="modal-f">{foot}</div>}
      </div>
    </div>
  ), (typeof document !== 'undefined' && document.querySelector('.rms')) || document.body);   // v36.5: داخل غلاف الثيم ليرث ألوانه (كانت النوافذ تخرج عن الثيم)
}

function Field({ label, children, style }) {
  return <div className="fld" style={style}><label className="lbl">{label}</label>{children}</div>;
}

// حقل مالي ذكي: تنسيق حيّ (1,250.00) + دعم عدة مبالغ في حقل واحد عند sum
function MoneyField({ value, onChange, sum, placeholder, autoFocus, style }) {
  const [raw, setRaw] = useState(() => (value ? money(value) : ''));
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (focused) return;
    if (Math.round(parseAmounts(raw).total * 100) !== Math.round((Number(value) || 0) * 100)) {
      setRaw(value ? money(value) : '');
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const { nums, total } = parseAmounts(raw);
  const multi = sum && nums.length > 1;
  const onText = (e) => {
    let s = e.target.value;
    s = sum ? s.replace(/[^\d.+\n ]/g, '') : fmtCurStr(s.replace(/[^\d.]/g, ''));
    setRaw(s);
    onChange(parseAmounts(s).total);
  };
  // زر «أضف مبلغًا»: يضيف فاصل + لإدخال عدة مبالغ على الجوال حيث لا تتوفّر علامة + في لوحة الأرقام
  const addAmount = () => {
    const base = raw.trim().replace(/[+\s]+$/, '');
    const nv = base ? base + ' + ' : '';
    setRaw(nv); onChange(parseAmounts(nv).total);
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); const l = el.value.length; try { el.setSelectionRange(l, l); } catch (er) {} } });
  };
  const common = {
    ref, value: raw, placeholder: placeholder || '0.00', inputMode: 'decimal', autoFocus,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); if (!(sum && parseAmounts(raw).nums.length > 1)) setRaw(value ? money(value) : ''); },
    onChange: onText
  };
  return (
    <>
      {sum
        ? <textarea {...common} className={'inp n inp-sum-ta' + (multi ? ' on' : '')} rows={1}
            placeholder="مبلغ واحد، أو عدة مبالغ: 500+250 — أو زر «أضف مبلغًا»" style={{ ...style, resize: 'vertical', minHeight: 44, lineHeight: 1.6 }} />
        : <input {...common} className="inp n" style={style} />}
      {sum && (
        <div className="money-multi">
          <button type="button" className="btn sm gh money-add" onClick={addAmount}><Plus size={14} />أضف مبلغًا</button>
          {multi && <span className="money-multi-t"><b className="num">{nums.length}</b> مبالغ · الإجمالي: <b className="num">{money(total)}</b></span>}
        </div>
      )}
    </>
  );
}

function Num({ label, value, onChange, hint, sum }) {
  return (
    <div className="fld">
      <label className="lbl">{label}{sum && <span style={{ color: 'var(--brass)', fontWeight: 400 }}> · يقبل عدة مبالغ</span>}</label>
      <MoneyField value={value} onChange={onChange} sum={sum} />
      {hint && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ================= الجهاز والمتصفح (لسجل التدقيق) ================= */
const deviceType = () => {
  const u = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPhone|iPad|iPod/i.test(u)) return 'iPhone/iPad';
  if (/Android/i.test(u)) return 'Android';
  return 'كمبيوتر';
};
const browserName = () => {
  const u = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Edg/i.test(u)) return 'Edge';
  if (/OPR|Opera/i.test(u)) return 'Opera';
  if (/Chrome/i.test(u)) return 'Chrome';
  if (/Firefox/i.test(u)) return 'Firefox';
  if (/Safari/i.test(u)) return 'Safari';
  return 'متصفح';
};

/* ================= نافذة الإخراج الإلزامية قبل إتمام الإغلاق (#21) ================= */
/* OutputDialog: نُقل إلى mods/closing/OutputDialog.jsx (تحميل كسول) */

const ST = {
  draft: ['b-dim', 'مسودة'], submitted: ['b-amber', 'مرحّل للمراجعة'],
  approved: ['b-mint', 'مدقّق ومعتمد'], rejected: ['b-rose', 'مرفوض'],
  pending: ['b-amber', 'قيد الانتظار'], received: ['b-mint', 'مستلم بالخزينة']
};
/* v16.5 — مرفقات PDF: حقول الصور تقبل PDF أيضاً (ميزة قائمة)، لكن العرض كان يضعها في
   وسم <img> فتظهر «صورة مكسورة». هذه الأدوات تكشف النوع وتفتح PDF بشكل صحيح. */
const isPdfData = (v) => typeof v === 'string' && v.startsWith('data:application/pdf');
const openPdfData = (v, name) => {
  try {
    const bin = atob((v.split(',')[1] || ''));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { /* ملف تالف */ }
};
function PdfTile({ v, label, small }) {
  return (
    <button type="button" className="btn" onClick={() => openPdfData(v, label)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: small ? 'auto' : '100%', justifyContent: 'flex-start', padding: small ? '6px 10px' : '12px 14px' }}>
      <FileText size={small ? 13 : 17} color="var(--rose)" />
      <span style={{ textAlign: 'start', minWidth: 0 }}>
        <b style={{ fontSize: small ? 11 : 12.5, display: 'block' }}>{label || 'مرفق PDF'}</b>
        {!small && <small style={{ color: 'var(--dim)', fontSize: 10.5 }}>ملف PDF — اضغط للفتح في تبويب جديد</small>}
      </span>
    </button>
  );
}

function Badge({ s }) {
  const [c, t] = ST[s] || ['b-dim', s];
  return <span className={'badge ' + c}>{t}</span>;
}

function Kpi({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="kpi" style={{ '--acc': color }}>
      <div className="kpi-l">{Icon && <Icon size={13} color={color} />}{label}</div>
      <div className="kpi-v num">{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

/* ============ الخطوة 2: محرّك التنبيهات الذكية الاستباقية ============ */
/* v36.6 — إعداد تنبيه العجز (حد واحد لكل المنصة): عجز أكبر من الحد = تنبيه فوري، وتكرار العجز (أي مبلغ) في نافذة أيام = نمط يستحق المراجعة */
const deficitCfg = (org) => { const c = (org && org.alertCfg) || {}; return { max: Number.isFinite(Number(c.deficitMax)) ? Number(c.deficitMax) : 50, repeat: Number(c.deficitRepeat) > 0 ? Number(c.deficitRepeat) : 3, days: Number(c.deficitDays) > 0 ? Number(c.deficitDays) : 7 }; };
const deficitPatterns = (org, closings, branchIds, refDay) => {
  const cf = deficitCfg(org); const d0 = new Date((refDay || today()) + 'T00:00:00'); d0.setDate(d0.getDate() - (cf.days - 1)); const from = isoD(d0);
  const by = {}; (closings || []).filter(c => countedClosing(c) && (Number(c.variance) || 0) < -0.004 && c.date >= from && c.date <= (refDay || today()) && (!branchIds || branchIds.includes(c.branchId)))
    .forEach(c => { const x = by[c.branchId] = by[c.branchId] || { branchId: c.branchId, branchName: c.branchName || '', n: 0, total: 0 }; x.n++; x.total = Math.round((x.total + (Number(c.variance) || 0)) * 100) / 100; });
  return Object.values(by).filter(x => x.n >= cf.repeat);
};
/* ===== v36.7 — سجل الكاشير =====
   لكل شخص: ورديات نقطة البيع التي فتحها (المبيعات، الفواتير، فرق العدّ) + الإغلاقات اليومية التي أدخلها (الفرق).
   الهدف رقابي: هل الفروقات مرتبطة بفرع أم بشخص؟ مؤشر الخطر = تكرار العجز (لا حجمه فقط). أرقام من السجلات كما هي. */
/* CashierBook: نُقل إلى mods/pos/CashierBook.jsx (تحميل كسول) */
const fmtBalP = (n) => n < 0 ? '(' + money(-n) + ')' : money(n);
function computeSmartAlerts(org, ops, myBranches, deficitThreshold = deficitCfg(org).max) {
  const alerts = [];
  const ids = myBranches.map(b => b.id);
  const td = today();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // 1) فروع لم تُغلق بعد موعدها اليوم
  // v29.3: الوردية التي تنتهي بعد منتصف الليل (قبل 6 ص) تخص يوم العمل السابق — كان التنبيه يفحص إغلاق «اليوم»
  // فيظهر «تأخّر عن الإغلاق» طوال النهار التالي، ولا يظهر أبدًا في وقته الصحيح بعد منتصف الليل
  myBranches.forEach(b => {
    if (!b.shiftEndTime) return;
    const [h, m] = b.shiftEndTime.split(':').map(Number);
    const afterMidnight = h < 6, nowH = new Date().getHours();
    if (afterMidnight && nowH >= 6) return;                       // موعد الليلة لم يأتِ بعد
    const wd = afterMidnight ? businessDay() : td;
    const closed = (ops.closings || []).some(c => c.branchId === b.id && c.date === wd);
    if (!closed) {
      if (nowMin > (h * 60 + m) + 30) {
        alerts.push({ id: 'late-' + b.id, sev: 'high', icon: 'clock',
          title: 'فرع تأخّر عن الإغلاق', msg: `${b.name} تجاوز موعد الإغلاق (${b.shiftEndTime}) ولم يُسجّل إغلاقه بعد.` });
      }
    }
  });

  // 2) عجز صندوق يتجاوز الحد اليوم
  (ops.closings || []).filter(c => countedClosing(c) && c.date === businessDay() && ids.includes(c.branchId) && c.variance < -deficitThreshold)
    .forEach(c => alerts.push({ id: 'def-' + c.id, sev: 'high', icon: 'down',
      title: 'عجز صندوق تجاوز الحد', msg: `${c.branchName}: عجز ${money(Math.abs(c.variance))} ر.س في إغلاق اليوم (الحد ${money(deficitThreshold)}).` }));
  // 2ب) عجز متكرر — أي مبلغ — يتكرر في الفرع خلال النافذة (مؤشر رقابي أقوى من عجز واحد كبير)
  deficitPatterns(org, ops.closings, ids, businessDay()).forEach(x => alerts.push({ id: 'defp-' + x.branchId, sev: 'high', icon: 'down',
    title: 'عجز متكرر في فرع', msg: `${x.branchName}: ${x.n} حالات عجز خلال ${deficitCfg(org).days} أيام بإجمالي ${money(Math.abs(x.total))} ر.س — راجع الكاشير والإجراءات.` }));

  // 3) فواتير موردين تستحق اليوم أو غداً أو متأخرة
  const tomorrow = isoD(new Date(Date.now() + 864e5));
  // المتبقي = القيمة − سداد الرئيسي − سداد الفروع المرتبط (نفس معادلة شاشة الموردين)
  const invBranchPaid = (invId) => sum((ops.closings || []).filter(countedClosing)
    .flatMap(c => (c.supplierPayments || []).filter(pm => pm.invoiceId === invId)), payTotal);
  (ops.invoices || []).filter(i => ids.includes(i.branchId) && (i.amount - (i.paidAmount || 0) - invBranchPaid(i.id)) > 0)
    .forEach(i => {
      const rem = i.amount - (i.paidAmount || 0) - invBranchPaid(i.id);
      if (i.dueDate < td) alerts.push({ id: 'ovd-' + i.id, sev: 'high', icon: 'truck',
        title: 'فاتورة مورد متأخرة', msg: `${i.supplierName} · فاتورة ${i.invoiceNo || ''} · متبقٍّ ${money(rem)} ر.س — تجاوزت ${i.dueDate}.` });
      else if (i.dueDate === td) alerts.push({ id: 'due-' + i.id, sev: 'medium', icon: 'truck',
        title: 'فاتورة مورد تستحق اليوم', msg: `${i.supplierName} · متبقٍّ ${money(rem)} ر.س.` });
      else if (i.dueDate === tomorrow) alerts.push({ id: 'dtm-' + i.id, sev: 'medium', icon: 'truck',
        title: 'فاتورة مورد تستحق غداً', msg: `${i.supplierName} · متبقٍّ ${money(rem)} ر.س.` });
    });

  // 4) سلف موظف تجاوزت راتبه لهذا الشهر
  const month = td.slice(0, 7);
  (org.employees || []).filter(e => ids.includes(e.branchId)).forEach(e => {
    const adv = sum((ops.advances || []).filter(a => a.employeeId === e.id && a.month === month), a => a.amount);
    const gross = (e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0);
    if (adv > gross && gross > 0) alerts.push({ id: 'adv-' + e.id, sev: 'medium', icon: 'wallet',
      title: 'سلف تجاوزت الراتب', msg: `${e.name}: مجموع السلف ${money(adv)} ر.س يتجاوز صافي الراتب ${money(gross)} ر.س.` });
  });

  // 5) v37.4 — هدر اليوم/أمس فوق السقف اليومي (% من مبيعات الفرع)، وهدر بلا مبيعات مسجّلة
  try {
    const wc = wasteCfg(org);
    const yd = (() => { const d = new Date(td + 'T00:00:00'); d.setDate(d.getDate() - 1); return isoD(d); })();
    const hasW = [...(ops.stockMoves || []), ...(ops.whMoves || [])].some(m => m.kind === 'waste' && String(m.date || '') >= yd);
    if (wc.capPct > 0 && hasW) {
      wasteDaily(org, ops, itemAvgCosts(org, ops), yd, td).filter(x => ids.includes(x.branchId) && x.pct != null && x.pct > wc.capPct).forEach(x => {
        const bn = ((org.branches || []).find(b => b.id === x.branchId) || {}).name || '';
        alerts.push({ id: 'wcap-' + x.branchId + '-' + x.date, sev: x.pct > wc.capPct * 2 ? 'high' : 'medium', icon: 'trash',
          title: 'هدر فوق السقف اليومي', msg: `${bn} · ${x.date === td ? 'اليوم' : 'أمس'}: هدر ${money(x.waste)} ر.س = ${x.pct}% من المبيعات (السقف ${wc.capPct}%).` });
      });
    }
    const pw = (ops.wasteRequests || []).filter(r => r.status === 'pending' && (!r.branchId || ids.includes(r.branchId)));
    if (pw.length) alerts.push({ id: 'wpend-' + pw.length, sev: 'medium', icon: 'trash', title: 'هدر بانتظار الاعتماد', msg: `${pw.length} طلب بقيمة ${money(sum(pw, r => r.value))} ر.س — لا يُخصم من المخزون قبل الاعتماد.` });
  } catch { }

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => order[a.sev] - order[b.sev]);
}

const ALERT_ICON = { clock: Clock, down: TrendingDown, truck: Truck, wallet: Wallet, bell: Bell, trash: Trash2 };

function Notifications({ ops, org, me, myBranches, commit, onClose }) {
  const list = [...(ops.notifications || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const smart = computeSmartAlerts(org, ops, myBranches || []);
  const markAll = () => commit(d => ({ ...d, notifications: (d.notifications || []).map(n => ({ ...n, isRead: true })) }));

  // إعدادات تنبيهات النشاط الحيّة (لمدراء النظام — لكل جهاز)
  const isAdminRole = !!ROLES[me?.role]?.admin;
  const [ncfg, setNcfg] = useState(() => notifyCfg());
  const [nMsg, setNMsg] = useState('');
  const toggleLive = async () => {
    setNMsg('');
    if (!ncfg.on) {
      if (typeof Notification === 'undefined') { setNMsg('متصفحك لا يدعم إشعارات النظام'); return; }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNMsg('لم يُمنح الإذن — فعّل الإشعارات لهذا الموقع من إعدادات المتصفح'); return; }
    }
    const next = { ...ncfg, on: !ncfg.on };
    saveNotifyCfg(next); setNcfg(next);
    if (next.on) setNMsg('مفعّلة — ستصلك إشعارات ما يخص دورك أثناء فتح المنصة (ولو في تبويب خلفي أو مصغّرة)');
  };
  const toggleSound = () => { const next = { ...ncfg, sound: !ncfg.sound }; saveNotifyCfg(next); setNcfg(next); };
  const myCats = notifCatsFor(me);
  const toggleCat = (k) => { const next = { ...ncfg, cats: { ...ncfg.cats, [k]: ncfg.cats[k] === false } }; saveNotifyCfg(next); setNcfg(next); };
  const testNow = () => {
    const ok = notifyBrowser('تجربة تنبيه — ' + (org.company?.name || 'المنصة'), 'هكذا سيصلك إشعار النشاط', org.company?.logoUrl);
    if (ncfg.sound) alertBeep();
    setNMsg(ok ? 'أُرسلت التجربة ✓' : 'تعذّر الإشعار — تأكد من تفعيله ومن إذن المتصفح');
  };

  return (
    <Modal title="مركز التنبيهات" icon={Bell} onClose={onClose}
      foot={<><button className="btn" onClick={markAll}><Check size={14} />تعليم الكل كمقروء</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      {myCats.length > 0 && (
        <div className="card" style={{ background: 'var(--ink)', padding: 12, marginBottom: 14, border: '1px solid ' + (ncfg.on ? 'rgba(79,178,134,.45)' : 'var(--line)') }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Radio size={14} color={ncfg.on ? 'var(--mint)' : 'var(--brass)'} />إشعارات هذا الجهاز
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.6 }}>
                إشعار من النظام وصوت لما يخص دورك — تصلك والمنصة مفتوحة ولو في تبويب خلفي. الضغط على الإشعار يفتح الشاشة المعنية.
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (ncfg.on ? ' ok' : ' pri')} onClick={toggleLive}>
                {ncfg.on ? <><Check size={13} />مفعّلة — إيقاف</> : <><Bell size={13} />تفعيل</>}
              </button>
              <button className={'btn sm' + (ncfg.sound ? '' : ' gh')} onClick={toggleSound} title="نغمة التنبيه">
                {ncfg.sound ? '🔊 الصوت' : '🔇 صامت'}
              </button>
              <button className="btn sm gh" onClick={testNow}>جرّب</button>
            </div>
          </div>
          {ncfg.on && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {myCats.map(k => (
                <button key={k} className={'btn sm' + (ncfg.cats[k] !== false ? ' ok' : ' gh')} onClick={() => toggleCat(k)}>
                  {ncfg.cats[k] !== false ? <Check size={12} /> : <X size={12} />}{NOTIF_CATS[k].ar}
                </button>))}
            </div>
          )}
          {nMsg && <div style={{ fontSize: 10.5, marginTop: 8, color: nMsg.includes('✓') || nMsg.startsWith('مفعّلة') ? 'var(--mint)' : 'var(--amber)' }}>{nMsg}</div>}
        </div>
      )}
      {smart.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 7, marginBottom: 8, color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}>
            <ShieldAlert size={15} />تنبيهات استباقية ذكية ({smart.length})
          </div>
          {smart.map(a => {
            const Ic = ALERT_ICON[a.icon] || Bell;
            return (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 7,
                borderRadius: 'var(--r-sm)', background: a.sev === 'high' ? 'rgba(217,84,77,.1)' : 'rgba(224,164,88,.1)',
                border: '1px solid ' + (a.sev === 'high' ? 'rgba(217,84,77,.3)' : 'rgba(224,164,88,.3)') }}>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center',
                  background: a.sev === 'high' ? 'rgba(217,84,77,.18)' : 'rgba(224,164,88,.18)',
                  color: a.sev === 'high' ? 'var(--rose)' : 'var(--amber)' }}>
                  <Ic size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.6 }}>{a.msg}</div>
                </div>
              </div>
            );
          })}
          {list.length > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '14px 0 10px' }} />}
        </div>
      )}
      {list.length === 0 && smart.length === 0 && <div className="empty">لا توجد تنبيهات حالياً.</div>}
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
/* ================= طباعة تقارير الفروع اليومية ================= */
/* DailyBranchReport: نُقل إلى mods/acct/DailyBranchReport.jsx (تحميل كسول) */

/* ============ تطبيق المبيعات — تحليل مبيعات نقاط البيع (مصدرها الإغلاق اليومي) v10.1 ============ */
/* ============================================================
   v31.0 — سجل فواتير المبيعات (مرقّم متسلسلًا، بصمة سلسلة، قيد وذمم وإشعار دائن وحد ائتمان)
   ============================================================ */
/* v33.1 — استيراد مبيعات نقاط البيع من Excel/CSV: يتعرّف على الأعمدة تلقائيًا، ويقبل شكلين:
   (أ) فاتورة لكل سطر بعمود «طريقة الدفع»، (ب) ملخص لكل سطر بعمود لكل طريقة. يُجمَّع يوميًا لكل فرع ويملأ الإغلاق. */
const PI_KW = {
  date: ['تاريخ', 'التاريخ', 'date', 'يوم', 'business date'], branch: ['فرع', 'الفرع', 'branch', 'store', 'location', 'المتجر'],
  count: ['عدد', 'count', 'orders', 'الطلبات', 'transactions'],
  no: ['رقم الفاتورة', 'فاتورة', 'invoice', 'receipt', 'order', 'رقم الطلب', 'reference'], total: ['الإجمالي', 'اجمالي', 'إجمالي', 'المجموع', 'total', 'net sales', 'المبلغ', 'amount', 'grand'],
  vat: ['ضريبة', 'الضريبة', 'vat', 'tax'], pay: ['طريقة الدفع', 'الدفع', 'payment', 'pay method', 'tender', 'نوع الدفع']
};
// أسماء التطبيقات بالإنجليزية كما تظهر في تقارير أنظمة نقاط البيع
const PI_APP_EN = { jahez: 'جاهز', hunger: 'هنقرستيشن', hungerstation: 'هنقرستيشن', mrsool: 'مرسول', toyou: 'تويو', keeta: 'كيتا', chefz: 'ذا شيفز', thechefz: 'ذا شيفز', ninja: 'نينجا', careem: 'كريم', noon: 'نون' };
const piNorm = (x) => String(x == null ? '' : x).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim().toLowerCase();
const PAY_GUESS = (v, apps) => { const t = piNorm(v); if (!t) return '';
  if (/نقد|كاش|cash/.test(t)) return 'cash'; if (/مدي|شبكه|بطاقه|فيزا|ماستر|card|visa|master|mada|stc|apple|ابل/.test(t)) return 'card'; if (/تحويل|transfer|bank/.test(t)) return 'transfer';
  const en = Object.keys(PI_APP_EN).find(k => t.replace(/[\s_-]/g, '').includes(k)); const t2 = en ? piNorm(PI_APP_EN[en]) : t;
  const a = (apps || []).find(x => x.id === en || [t, t2].some(q => q.includes(piNorm(x.n)) || piNorm(x.n).includes(q))); return a ? 'app:' + a.id : ''; };
function piDetect(grid) {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = (grid[r] || []).map(piNorm); const m = {};
    Object.entries(PI_KW).forEach(([k, kw]) => { const i = row.findIndex((c, ci) => c && kw.some(w => c.includes(piNorm(w))) && !Object.values(m).includes(ci)); if (i >= 0) m[k] = i; });
    if (m.date != null && (m.total != null || m.pay != null)) {
      // شكل الملخص: أعمدة رقمية بعناوين طرق دفع
      const payCols = row.map((c, ci) => ({ ci, c })).filter(x => x.c && !Object.values(m).includes(x.ci) && /نقد|كاش|cash|مدي|شبكه|card|visa|mada|تحويل|transfer|جاهز|هنقر|مرسول|تويو|كيتا|شيفز|نينجا|كريم|نون|jahez|hunger|mrsool|toyou|keeta|chefz|ninja|careem|noon/.test(x.c));
      return { start: r + 1, map: { date: m.date, branch: m.branch ?? -1, no: m.no ?? -1, total: m.total ?? -1, vat: m.vat ?? -1, pay: m.pay ?? -1, count: m.count ?? -1 }, layout: (m.pay == null && payCols.length >= 2) ? 'summary' : 'invoice', payCols: payCols.map(x => x.ci), headers: grid[r] };
    }
  }
  return null;
}
// تجميع الملف إلى ملخص يومي لكل فرع: { 'branchId|date': {n,total,vat,cash,card,transfer,apps:{id:{amount,n}}, nos:Set} }
function piAggregate(grid, cfg) {
  const out = {}; const issues = { noBranch: 0, noPay: 0, badDate: 0, dup: 0 }; const seen = new Set();
  for (let r = cfg.start; r < grid.length; r++) {
    const g = grid[r] || []; if (!g.some(x => String(x || '').trim())) continue;
    const d = stDate(g[cfg.map.date]); if (!d) { issues.badDate++; continue; }
    const bName = cfg.map.branch >= 0 ? String(g[cfg.map.branch] || '').trim() : '';
    const bId = cfg.map.branch >= 0 ? (cfg.brMap[bName] || '') : cfg.branchId; if (!bId) { issues.noBranch++; continue; }
    const k = bId + '|' + d; const x = out[k] || (out[k] = { branchId: bId, date: d, n: 0, total: 0, vat: 0, cash: 0, card: 0, transfer: 0, apps: {}, nos: [] });
    const addPay = (dest, amt, cnt) => { if (!amt) return; if (dest === 'cash' || dest === 'card' || dest === 'transfer') x[dest] += amt; else if (dest && dest.startsWith('app:')) { const a = x.apps[dest.slice(4)] || (x.apps[dest.slice(4)] = { amount: 0, n: 0 }); a.amount += amt; a.n += cnt ?? 1; } };
    if (cfg.layout === 'summary') {
      let rowTot = 0; cfg.payCols.forEach(ci => { const amt = stNum(g[ci]); if (!amt) return; const dest = cfg.payMap[String((cfg.headers || [])[ci] || '').trim()] || ''; if (!dest) { issues.noPay++; return; } addPay(dest, amt, 0); rowTot += amt; });
      x.total += cfg.map.total >= 0 ? stNum(g[cfg.map.total]) || rowTot : rowTot; x.vat += cfg.map.vat >= 0 ? stNum(g[cfg.map.vat]) : 0; x.n += cfg.map.count >= 0 ? stNum(g[cfg.map.count]) : 0;
    } else {
      const no = cfg.map.no >= 0 ? String(g[cfg.map.no] || '').trim() : ''; if (no) { if (seen.has(bId + '|' + no)) { issues.dup++; continue; } seen.add(bId + '|' + no); x.nos.push(no); }
      const amt = stNum(g[cfg.map.total]); const dest = cfg.map.pay >= 0 ? cfg.payMap[String(g[cfg.map.pay] || '').trim()] || '' : 'cash';
      if (!dest) { issues.noPay++; continue; }
      addPay(dest, amt, 1); x.total += amt; x.vat += cfg.map.vat >= 0 ? stNum(g[cfg.map.vat]) : 0; x.n += 1;
    }
  }
  Object.values(out).forEach(x => { ['total', 'vat', 'cash', 'card', 'transfer'].forEach(k => { x[k] = posR2(x[k]); }); Object.values(x.apps).forEach(a => { a.amount = posR2(a.amount); }); });
  return { days: Object.values(out).sort((a, b) => (a.date + a.branchId).localeCompare(b.date + b.branchId)), issues };
}
// ملخص اليوم من نقطة البيع الداخلية أو من الاستيراد (الداخلية أولًا)
function salesDaySource(ops, branchId, date) {
  const ps = posDaySummary(ops.posOrders || [], branchId, date); if (ps.n) return { ...ps, src: 'pos' };
  const im = (ops.posImports || []).find(x => x.branchId === branchId && x.date === date);
  return im ? { n: im.n, total: im.total, vat: im.vat, cash: im.cash, card: im.card, transfer: im.transfer, apps: im.apps || {}, src: 'import', file: im.file } : { n: 0 };
}

/* PosImport: نُقل إلى mods/pos/PosImport.jsx (تحميل كسول) */

function SalesHub(props) {
  const [v, setV] = useState('analysis');
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '9px 13px' }}><SectionNav label="أقسام المبيعات" cur={v} onPick={setV} items={[{ id: 'analysis', ar: 'تحليل المبيعات', icon: BarChart3 }, { id: 'invoices', ar: 'فواتير المبيعات', icon: FileText }, { id: 'posimp', ar: 'استيراد نقاط البيع', icon: Upload }]} /></div>
      {v === 'analysis' ? <Sales {...props} /> : v === 'posimp' ? <PosImport {...props} /> : <SalesInvoices {...props} />}
    </div>
  );
}
function printSalesInvoice(org, x, orig) {
  const ent = entityById(org, x.entityId);
  const seller = ent.name || ((org.company || {}).name) || '', svat = ent.taxNumber || '', scr = ent.commercialReg || '';
  const sAddr = ent.primary ? ((org.company || {}).address || '') : (ent.address || '');
  const std = x.type === 'standard', cr = x.kind === 'credit';
  const ts = x.date + 'T' + (/^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '12:00') + ':00Z';
  const svg = svat ? qrSvg(zatcaTLV(seller, svat, ts, x.total, x.vat), { ecl: 1, px: 140 }) : '';
  const b = x.buyer || {};
  const title = cr ? (std ? 'إشعار دائن ضريبي' : 'إشعار دائن ضريبي مبسّط') : (std ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسّطة');
  const rows = (x.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${_xe(l.desc || '')}</td><td class="n">${l.qty}</td><td class="n">${money(l.price)}</td><td class="n">${money(l.net)}</td><td class="n">${l.vatRate}%</td><td class="n">${money(l.vat)}</td><td class="n">${money(Math.round((l.net + l.vat) * 100) / 100)}</td></tr>`).join('');
  const body = `
    <div class="box" style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px">
      <div style="line-height:1.9">
        <div style="font-size:15px;font-weight:800;color:#5a4a1e">${title}</div>
        <div style="margin-top:8px"><b>البائع:</b> ${_xe(seller)} · الرقم الضريبي: ${_xe(svat || '—')}${scr ? ' · س.ت ' + _xe(scr) : ''}</div>
        ${sAddr ? '<div>العنوان: ' + _xe(sAddr) + '</div>' : ''}
        <div style="margin-top:6px">الرقم: <b>${_xe(x.no)}</b> · التاريخ: <span class="n">${x.date}${x.time ? ' ' + x.time : ''}</span>${x.terms === 'credit' && !cr ? ' · الاستحقاق: <span class="n">' + (x.dueDate || '') + '</span>' : ''}</div>
        ${cr && orig ? '<div>عن الفاتورة: <b>' + _xe(orig.no) + '</b> بتاريخ ' + orig.date + (x.reason ? ' — السبب: ' + _xe(x.reason) : '') + '</div>' : ''}
        ${b.name ? `<div style="margin-top:6px"><b>${std ? 'المشتري' : 'العميل'}:</b> ${_xe(b.name)}${b.vat ? ' · الرقم الضريبي: ' + _xe(b.vat) : ''}${b.crNo ? ' · س.ت ' + _xe(b.crNo) : ''}${std && b.address ? '<br>العنوان: ' + _xe(b.address) : ''}</div>` : ''}
      </div>
      <div style="text-align:center">${svg}<div class="sub" style="margin-top:3px">${svg ? 'امسح رمز QR للتحقق' : ''}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>البيان</th><th class="n">الكمية</th><th class="n">سعر الوحدة</th><th class="n">قبل الضريبة</th><th class="n">النسبة</th><th class="n">الضريبة</th><th class="n">الإجمالي</th></tr></thead>
      <tbody>${rows}
        <tr><td colspan="7">الإجمالي قبل الضريبة</td><td class="n">${money(x.net)}</td></tr>
        <tr><td colspan="7">ضريبة القيمة المضافة</td><td class="n">${money(x.vat)}</td></tr>
        <tr class="tot"><td colspan="7">${cr ? 'إجمالي الإشعار' : 'الإجمالي شامل الضريبة'}</td><td class="n">${money(x.total)}</td></tr>
      </tbody>
    </table>
    <div class="box" style="font-size:9.5px;color:#888">التسلسل في السجل: ${x.icv} · البصمة الرقمية: <span style="direction:ltr;unicode-bidi:embed">${x.hash ? x.hash.slice(0, 32) + '…' : ''}</span></div>`;
  return printA4(org, title + ' ' + x.no, 'البائع: ' + seller + (svat ? ' · الرقم الضريبي: ' + svat : ''), body);
}
/* SalesInvoices: نُقل إلى mods/pos/SalesInvoices.jsx (تحميل كسول) */

/* Sales: نُقل إلى mods/pos/Sales.jsx (تحميل كسول) */

/* ============ الخطوة 1: لوحة مقارنة الفروع الفورية ============ */
/* BranchCompare: نُقل إلى mods/acct/BranchCompare.jsx (تحميل كسول) */

// ===== v10.8: اللوحة التنفيذية الموحّدة — تجمع مؤشرات كل الوحدات في شاشة واحدة =====
/* ============================================================
   v13.2 — المشتريات الذكية ونقطة إعادة الطلب
   حدود دنيا/عليا للأصناف، ومعدّل استهلاك، وأيام تغطية، واقتراح كميات
   الطلب، وإنشاء أمر شراء بضغطة. من مخزونك الفعلي — الحدود بيدك، بلا افتراض.
   ============================================================ */
/* SmartPurchasing: نُقل إلى mods/inv/SmartPurchasing.jsx (تحميل كسول) */

/* ============================================================
   v13.1 — التدفق النقدي المتدحرج (13 أسبوعًا)
   تنبؤ أسبوعي بالنقد الداخل والخارج لكشف فجوات السيولة مبكرًا.
   الافتراضات مبدئية من متوسطاتك الفعلية وذممك — كلها قابلة للتعديل. بلا افتراض خفيّ.
   ============================================================ */
/* CashFlow13: نُقل إلى mods/acct/CashFlow13.jsx (تحميل كسول) */

/* ============================================================
   v13.0 — تقرير الإدارة الشهري الشامل (حزمة المالك)
   يجمع القوائم والمؤشرات والأعمار والتعادل والنمو وأداء الفروع في تقرير
   واحد للشهر — معاينة على الشاشة + طباعة A4 كاملة + Excel متعدّد الأوراق.
   ============================================================ */
/* BoardPack: نُقل إلى mods/acct/BoardPack.jsx (تحميل كسول) */

/* ============================================================
   v12.9 — التخطيط والسيناريوهات (ماذا-لو)
   انطلاقًا من أرقام شهرٍ فعلي: حاكِ قرارات (أسعار/تكلفة مواد/تكاليف
   ثابتة/فرع جديد) وشاهد أثرها على الربح والتعادل قبل أن تقرّر. بلا افتراض.
   ============================================================ */
/* Scenario: نُقل إلى mods/acct/Scenario.jsx (تحميل كسول) */

/* ============================================================
   v12.8 — لوحة مؤشرات بأهداف (Scorecard)
   اختر مؤشراتك، حدّد أهدافها الشهرية، وتابع تحقّقها بإشارات لونية.
   القيم الفعلية من قيودك؛ الأهداف بيدك — بلا افتراض.
   ============================================================ */
const SC_KPIS = [
  { k: 'rev', ar: 'إيراد الشهر', unit: 'sar', dir: 'up' },
  { k: 'net', ar: 'صافي ربح الشهر', unit: 'sar', dir: 'up' },
  { k: 'margin', ar: 'هامش صافي الربح', unit: 'pct', dir: 'up' },
  { k: 'food', ar: 'تكلفة الطعام', unit: 'pct', dir: 'down' },
  { k: 'labor', ar: 'تكلفة العمالة', unit: 'pct', dir: 'down' },
  { k: 'prime', ar: 'التكلفة الأولية (طعام+عمالة)', unit: 'pct', dir: 'down' },
  { k: 'avgday', ar: 'متوسط الإغلاق اليومي', unit: 'sar', dir: 'up' },
  { k: 'variance', ar: 'فرق الصندوق (تسامح)', unit: 'sar', dir: 'zero' },
  { k: 'count', ar: 'عدد الإغلاقات', unit: 'num', dir: 'up' },
  { k: 'cash', ar: 'النقد الحالي', unit: 'sar', dir: 'up' }
];
/* Scorecard: نُقل إلى mods/acct/Scorecard.jsx (تحميل كسول) */

/* ============================================================
   v12.6 — تحليل التعادل وتكلفة الطعام
   من أرقامك الفعلية (إيراد ومصروفات الشهر): تصنيف التكاليف ثابت/متغيّر
   (بمبدئيات معلنة قابلة للتعديل) → نقطة التعادل وهامش الأمان، ونِسَب
   تكلفة الطعام والعمالة والتكلفة الأولية. بلا افتراض — التصنيف بيدك.
   ============================================================ */
/* BreakEven: نُقل إلى mods/acct/BreakEven.jsx (تحميل كسول) */

/* ============================================================
   v11.9 — تحليلات النمو والمقارنة السنوية
   عدسة تحليلية جديدة: النمو عبر الزمن (سنة بسنة · شهر بشهر) — تختلف عن
   «مقارنة الفروع» (لقطة يوم واحد) وعن «التحليل والنِسَب». تُشتق من الإغلاقات
   المعتمدة ضمن نطاق المستخدم، بلا أي افتراض — تظهر فقط ما سُجّل فعلًا.
   ============================================================ */
const GROWTH_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/* GrowthAnalytics: نُقل إلى mods/acct/GrowthAnalytics.jsx (تحميل كسول) */

/* ============================================================
   v12.1 — تعدّد المنشآت/الشركات (اختياري، مطفأ افتراضيًا)
   المنشأة الرئيسية = org.company (كما هي). المنشآت الإضافية في org.entities،
   وكل فرع يُسنَد لمنشأة عبر branch.entityId (فارغ = الرئيسية). بلا منشآت
   إضافية يبقى النظام أحادي المنشأة تمامًا كما كان — توافق رجعي كامل.
   ============================================================ */
function entityList(org) {
  const co = org.company || {};
  const primary = { id: 'primary', name: co.name || 'المنشأة الرئيسية', taxNumber: co.taxNumber || '', commercialReg: co.commercialReg || '', activity: co.activity || '', address: co.address || '', na: co.na || {}, primary: true };
  return [primary, ...((org.entities || []).map(e => ({ ...e, primary: false })))];
}
function branchEntityId(b) { return (b && b.entityId) ? b.entityId : 'primary'; }
function entityById(org, id) { const l = entityList(org); return l.find(e => e.id === (id || 'primary')) || l[0]; }
function multiEntityOn(org) { return (org.entities || []).length > 0; }

/* EntitiesCenter: نُقل إلى mods/acct/EntitiesCenter.jsx (تحميل كسول) */

/* ============================================================
   v12.0 — منشئ التقارير المخصّصة
   تقرير يبنيه المستخدم بنفسه: مصدر (إغلاقات/مصروفات/أرصدة) + فترة + فرع +
   تجميع + اختيار أعمدة + فرز، مع حفظ قوالب وإعادة استخدامها وطباعة/Excel/CSV.
   يُشتق من البيانات المعتمدة نفسها — لا تخزين مزدوج ولا افتراض.
   ============================================================ */
const RB_SOURCES = {
  closings: {
    ar: 'المبيعات والإغلاقات',
    groups: [['none', 'كل إغلاق'], ['branch', 'حسب الفرع'], ['month', 'حسب الشهر'], ['day', 'حسب اليوم']],
    cols: [
      { k: 'date', ar: 'التاريخ', num: false }, { k: 'branch', ar: 'الفرع', num: false },
      { k: 'rev', ar: 'الإيراد', num: true }, { k: 'exp', ar: 'المصروفات', num: true }, { k: 'net', ar: 'الصافي', num: true },
      { k: 'cash', ar: 'النقد', num: true }, { k: 'card', ar: 'الشبكة', num: true }, { k: 'delivery', ar: 'التوصيل', num: true },
      { k: 'variance', ar: 'فرق الصندوق', num: true }, { k: 'count', ar: 'عدد الإغلاقات', num: true }
    ],
    dflt: ['date', 'branch', 'rev', 'exp', 'net']
  },
  expenses: {
    ar: 'المصروفات',
    groups: [['none', 'كل بند'], ['category', 'حسب البند'], ['branch', 'حسب الفرع'], ['month', 'حسب الشهر']],
    cols: [
      { k: 'date', ar: 'التاريخ', num: false }, { k: 'branch', ar: 'الفرع', num: false }, { k: 'category', ar: 'البند', num: false },
      { k: 'beneficiary', ar: 'المستفيد', num: false }, { k: 'method', ar: 'طريقة الدفع', num: false },
      { k: 'amount', ar: 'المبلغ', num: true }, { k: 'count', ar: 'عدد البنود', num: true }
    ],
    dflt: ['date', 'branch', 'category', 'amount']
  },
  balances: {
    ar: 'أرصدة الحسابات',
    groups: [['none', 'كل حساب'], ['kind', 'حسب النوع']],
    cols: [
      { k: 'code', ar: 'الكود', num: false }, { k: 'name', ar: 'الحساب', num: false }, { k: 'kind', ar: 'النوع', num: false },
      { k: 'debit', ar: 'مدين', num: true }, { k: 'credit', ar: 'دائن', num: true }, { k: 'balance', ar: 'الرصيد', num: true }
    ],
    dflt: ['code', 'name', 'kind', 'balance']
  }
};
const RB_KIND_AR = { asset: 'أصول', liab: 'التزامات', equity: 'حقوق ملكية', rev: 'إيرادات', exp: 'مصروفات' };
const RB_PM_AR = { cash: 'نقدًا', card: 'شبكة', deferred: 'آجل', credit: 'آجل', cheque: 'شيك', bank_transfer: 'تحويل' };
/* ReportBuilder: نُقل إلى mods/acct/ReportBuilder.jsx (تحميل كسول) */

/* ============================================================
   v13.8 — نمط المراكز الموحّد (Hub) + تحسين التجربة
   مكوّن واحد عام لكل المراكز: ترويسة «نظرة عامة» (اسم المركز ووصفه) + شريط أقسام،
   يحترم صلاحيات الدور فيعرض المسموح فقط، ويتذكّر آخر قسم فتحته في كل مركز (لكل مستخدم).
   «القسم الحالي» = التبويب العام، فتظل الروابط القديمة تعمل وتفتح داخل المركز — بلا فقدان أي ميزة.
   ============================================================ */
const HUBS = {
  analytics: {
    ar: 'مركز التحليل والأداء', desc: 'لوحاتك ومؤشراتك وتحليلاتك في مكان واحد', icon: Compass,
    views: [
      { id: 'exec', ar: 'اللوحة التنفيذية', icon: Compass, comp: ExecDashboard },
      { id: 'dash', ar: 'لوحة المؤشرات', icon: LayoutDashboard, comp: Dashboard },
      { id: 'compare', ar: 'مقارنة الفروع', icon: BarChart3, comp: BranchCompare },
      { id: 'growth', ar: 'تحليلات النمو', icon: TrendingUp, comp: GrowthAnalytics },
      { id: 'breakeven', ar: 'تحليل التعادل', icon: Scale, comp: BreakEven },
      { id: 'scorecard', ar: 'لوحة الأهداف', icon: CheckCircle2, comp: Scorecard },
      { id: 'scenario', ar: 'ماذا-لو', icon: Compass, comp: Scenario },
      { id: 'ai', ar: 'المركز الذكي', icon: Sparkles, comp: AiCenter },
      { id: 'alerts', ar: 'التنبيهات', icon: Bell, comp: AlertsCenter }
    ]
  },
  reporting: {
    ar: 'مركز التقارير', desc: 'التقارير المالية والإدارية وبناؤها وتصديرها', icon: FileBarChart,
    views: [
      { id: 'reports', ar: 'التقارير المالية', icon: FileBarChart, comp: Reports },
      { id: 'rbuild', ar: 'منشئ التقارير', icon: Wand2, comp: ReportBuilder },
      { id: 'boardpack', ar: 'تقرير الإدارة الشهري', icon: FileText, comp: BoardPack },
      { id: 'cashflow', ar: 'التدفق النقدي (13 أسبوعًا)', icon: Banknote, comp: CashFlow13 }
    ]
  },
  people: {
    ar: 'شؤون الموظفين', desc: 'البيانات الرئيسية والسياسات والرواتب والسلف وتخطيط العمالة', icon: Wallet,
    views: [
      { id: 'hrmaster', ar: 'البيانات الرئيسية', icon: Building2, comp: HrMaster },
      { id: 'hrpolicy', ar: 'السياسات والأدوار', icon: ShieldCheck, comp: HrPolicy },
      { id: 'payroll', ar: 'الرواتب والسلف', icon: Wallet, comp: Payroll },
      { id: 'workforce', ar: 'تخطيط العمالة والتكلفة', icon: CalendarDays, comp: Workforce }
    ]
  },
  purchasing: {
    ar: 'المشتريات', desc: 'أوامر الشراء والاستلام وفواتير الموردين وإعادة الطلب — بطاقات الموردين في «جهات الاتصال»', icon: Truck,
    views: [
      { id: 'suppliers', ar: 'المشتريات والفواتير', icon: Truck, comp: Suppliers },
      { id: 'reorder', ar: 'المشتريات الذكية', icon: ClipboardCheck, comp: SmartPurchasing }
    ]
  },
  hrops: {
    ar: 'الموارد البشرية — التشغيل', desc: 'الحضور والورديات والمهام والنقاط والتوقيع الإلكتروني', icon: Fingerprint,
    views: [
      { id: 'attendance', ar: 'الحضور الموثَّق', icon: Fingerprint, comp: Attendance },
      { id: 'leaves', ar: 'الإجازات', icon: CalendarDays, comp: Leaves },
      { id: 'shiftengine', ar: 'محرّك الورديات', icon: ArrowLeftRight, comp: ShiftEngine },
      { id: 'tasks', ar: 'المهام', icon: CheckCircle2, comp: Tasks },
      { id: 'points', ar: 'دفتر النقاط', icon: Star, comp: PointsLedger },
      { id: 'esign', ar: 'التوقيع الإلكتروني', icon: Signature, comp: ESign }
    ]
  },
  // v31.5 — دمج المتشابهات: أيقونة واحدة وأقسامها داخلها
  closehub: {
    ar: 'الإغلاق اليومي والاعتماد', desc: 'إدخال الإغلاق ← التدقيق والاعتماد ← المواعيد والتذكيرات', icon: ClipboardCheck,
    views: [
      { id: 'closing', ar: 'الإغلاق اليومي', icon: ClipboardCheck, comp: Closing },
      { id: 'approve', ar: 'التدقيق والاعتماد', icon: ShieldCheck, comp: Approvals },
      { id: 'shifts', ar: 'المواعيد والتذكيرات', icon: Clock, comp: Shifts },
      { id: 'cashiers', ar: 'سجل الكاشير', icon: Users, comp: CashierBook }
    ]
  },
  finhub: {
    ar: 'المالية والمحاسبة', desc: 'القيود والقوائم والتسويات ← الخزينة والترحيل ← المنشآت', icon: Scale,
    views: [
      { id: 'acct', ar: 'المحاسبة', icon: Scale, comp: Accounting },
      { id: 'treasury', ar: 'الخزينة والترحيل', icon: Landmark, comp: Treasury },
      { id: 'entities', ar: 'المنشآت', icon: Building2, comp: EntitiesCenter }
    ]
  },
  docshub: {
    ar: 'المستندات والأرشيف', desc: 'المستندات الرسمية والصادرة ← أرشيف الصور والمرفقات', icon: Stamp,
    views: [
      { id: 'docs', ar: 'مركز المستندات', icon: Stamp, comp: DocsCenter },
      { id: 'archive', ar: 'الأرشيف', icon: ImageIcon, comp: Archive }
    ]
  },
  hrperf: {
    ar: 'الأداء والانضباط', desc: 'التقييم ومؤشرات الدور والحوافز والإجراءات التصحيحية والتدريب وتجميد الأداء ولوحة HR', icon: TrendingUp,
    views: [
      { id: 'empfile', ar: 'ملف الموظف', icon: UserCog, comp: EmployeeFile },
      { id: 'kpi', ar: 'الأداء والتقييم', icon: TrendingUp, comp: Performance },
      { id: 'rolekpi', ar: 'مؤشرات الأداء بالدور', icon: TrendingUp, comp: RoleKpi },
      { id: 'rewards', ar: 'المكافآت والجزاءات', icon: Coins, comp: Rewards },
      { id: 'corrective', ar: 'الإجراءات التصحيحية', icon: ShieldAlert, comp: Corrective },
      { id: 'training', ar: 'التدريب والشهادات', icon: Stamp, comp: Training },
      { id: 'perfsnap', ar: 'تجميد الأداء الشهري', icon: Lock, comp: PerfSnap },
      { id: 'hrdash', ar: 'لوحة الموارد البشرية', icon: LayoutDashboard, comp: HrDashboard }
    ]
  }
};
/* v36.8 — تطبيق واحد «الموارد البشرية» يجمع: التشغيل اليومي + شؤون الموظفين والرواتب + الأداء والانضباط.
   صلاحية كل قسم كما هي (حسب معرّف القسم في الدور)، فلا يكسب أحد ولا يخسر وصولًا. معرّفات الأقسام لم تتغير. */
HUBS.hr = {
  ar: 'الموارد البشرية', desc: 'الحضور والورديات والإجازات · البيانات والرواتب والسلف · الأداء والتدريب والانضباط', icon: Users,
  views: [
    ...HUBS.hrops.views.map(v => ({ ...v, group: 'التشغيل اليومي' })),
    ...HUBS.people.views.filter(v => !['suppliers', 'reorder'].includes(v.id)).flatMap(v => v.id === 'payroll' ? [v, { id: 'muster', ar: 'مسير الرواتب', icon: FileText, comp: PayrollMuster, like: 'payroll' }, { id: 'overtime', ar: 'مسير الأجور الإضافية', icon: Clock, comp: OvertimeSheet, like: 'payroll' }] : [v]).map(v => ({ ...v, group: 'شؤون الموظفين والرواتب' })),
    ...HUBS.hrperf.views.map(v => ({ ...v, group: 'الأداء والانضباط' }))
  ]
};
delete HUBS.hrops; delete HUBS.people; delete HUBS.hrperf;
const HR_TABS = ['hr', 'hrops', 'hrperf', 'people', ...HUBS.hr.views.map(v => v.id)];
/* ============================================================
   v31.7 — عرض أقسام التطبيقات: شبكة احترافية (افتراضي) أو قائمة منسدلة أو تبويبات — اختيار واحد لكل المستخدم يسري على كل التطبيقات
   ============================================================ */
const SECNAV_KEY = 'mizan:secNav';
const readSecNav = () => { try { const v = localStorage.getItem(SECNAV_KEY); return ['grid', 'dd', 'tabs'].includes(v) ? v : 'grid'; } catch { return 'grid'; } };
function useSecNav() {
  const [m, setM] = useState(readSecNav);
  useEffect(() => { const h = () => setM(readSecNav()); window.addEventListener('mizan-secnav', h); window.addEventListener('storage', h); return () => { window.removeEventListener('mizan-secnav', h); window.removeEventListener('storage', h); }; }, []);
  const set = (v) => { try { localStorage.setItem(SECNAV_KEY, v); } catch { } setM(v); try { window.dispatchEvent(new Event('mizan-secnav')); } catch { } };
  return [m, set];
}
// items: [{id, ar, icon, badge?}] · cur · onPick(id) · extra: أزرار إجراءات تُعرض بجانب التنقل
function SectionNav({ items, cur, onPick, extra, label, force }) {
  const [modeSel, setMode] = useSecNav();
  const mode = force || modeSel;   // force: نمط ثابت لشاشات تحتاج المساحة (نقطة البيع)
  const [open, setOpen] = useState(false);
  // v36.8: إظهار القسم النشط داخل الشريط الأفقي (على الجوال قد يكون خارج الشاشة)
  const navRef = useRef(null);
  useEffect(() => { try { const el = navRef.current && navRef.current.querySelector('.acct-tile.on'); const sc = el && el.closest('.acct-grid');
    if (el && sc && sc.scrollWidth > sc.clientWidth + 2) { const r = el.getBoundingClientRect(), rs = sc.getBoundingClientRect(); sc.scrollLeft += (r.left + r.width / 2) - (rs.left + rs.width / 2); } } catch { } }, [cur, mode]);
  const list = (items || []).filter(Boolean);
  if (list.length < 2 && !extra) return null;
  const curIt = list.find(x => x.id === cur) || list[0] || {};
  const CurI = curIt.icon || Grid3x3;
  const sw = list.length >= 2 && !force && (
    <div className="acct-mode" role="group" aria-label="طريقة عرض الأقسام">
      <button className={mode === 'grid' ? 'on' : ''} onClick={() => setMode('grid')} title="شبكة"><Grid3x3 size={13} /><span>شبكة</span></button>
      <button className={mode === 'dd' ? 'on' : ''} onClick={() => setMode('dd')} title="قائمة منسدلة"><ChevronDown size={13} /><span>قائمة</span></button>
      <button className={mode === 'tabs' ? 'on' : ''} onClick={() => setMode('tabs')} title="تبويبات"><Menu size={13} /><span>تبويبات</span></button>
    </div>);
  const pick = (id) => { setOpen(false); onPick(id); };
  const bdg = (x) => x.badge ? <span className="badge b-amber" style={{ fontSize: 9.5, padding: '1px 6px' }}>{x.badge}</span> : null;
  if (list.length >= 2 && mode === 'grid') return (
    <div className="secnav-grid" ref={navRef}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <div className="acct-gtitle" style={{ marginInlineEnd: 'auto' }}><Grid3x3 size={14} />{label || 'الأقسام'}</div>{sw}{extra}
      </div>
      {list.some(x => x.group) ? (
        <div className="acct-gridnav">
          {[...new Set(list.map(x => x.group || ''))].map(g => (
            <div key={g} className="acct-gsec">
              {g && <div className="acct-ghd">{g}</div>}
              <div className="acct-grid">
                {list.filter(x => (x.group || '') === g).map(x => { const I = x.icon || Grid3x3; return (
                  <button key={x.id} className={'acct-tile' + (cur === x.id ? ' on' : '')} onClick={() => pick(x.id)}><I size={19} /><span>{x.ar}</span>{bdg(x)}</button>); })}
              </div>
            </div>))}
        </div>
      ) : (
      <div className="acct-grid">
        {list.map(x => { const I = x.icon || Grid3x3; return (
          <button key={x.id} className={'acct-tile' + (cur === x.id ? ' on' : '')} onClick={() => pick(x.id)}><I size={19} /><span>{x.ar}</span>{bdg(x)}</button>); })}
      </div>)}
    </div>);
  if (list.length >= 2 && mode === 'dd') return (
    <div className="row acct-nav" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div className="abar-dd">
        <button className="btn sm pri" onClick={() => setOpen(o => !o)}><CurI size={14} />{curIt.ar}{bdg(curIt)}<ChevronDown size={13} /></button>
        {open && (<>
          <div className="abar-back" onClick={() => setOpen(false)} />
          <div className="abar-menu">
            <div className="abar-hd">{label || 'الأقسام'}</div>
            {list.map(x => { const I = x.icon || Grid3x3; return (
              <button key={x.id} onClick={() => pick(x.id)} style={cur === x.id ? { background: 'var(--acc-soft)', fontWeight: 700 } : undefined}><I size={13} />{x.ar}{bdg(x)}{cur === x.id && <Check size={13} style={{ marginInlineStart: 'auto' }} />}</button>); })}
          </div>
        </>)}
      </div>
      {sw}<span style={{ marginInlineStart: 'auto' }} />{extra}
    </div>);
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {list.length >= 2 && list.map(x => { const I = x.icon || Grid3x3; return (
        <button key={x.id} className={'btn sm' + (cur === x.id ? ' pri' : ' gh')} onClick={() => pick(x.id)}><I size={13} />{x.ar}{bdg(x)}</button>); })}
      {sw}<span style={{ marginInlineStart: 'auto' }} />{extra}
    </div>);
}

function Hub({ hubId, view, ...rest }) {
  const me = rest.me;
  const cfg = HUBS[hubId] || { ar: '', desc: '', icon: Compass, views: [] };
  const rt = ROLES[me.role]?.tabs || [];
  const full = ROLES[me.role]?.scope === 'all' && !ROLES[me.role]?.limitedApps;   // v31.5: الأدوار المحدودة (المحاسب) ترى أقسام دورها فقط داخل المراكز المدمجة
  const granted = (me.appAllow || []).map(id => (LAUNCH_IX[id] || {}).open).filter(Boolean).map(o => o.tab);
  const views = cfg.views.filter(v => full || rt.includes(v.id) || granted.includes(v.id) || (v.like && (rt.includes(v.like) || granted.includes(v.like))));
  const remembered = (appUseGet(me.id).hubView || {})[hubId];
  const cur = (views.find(v => v.id === view) || views.find(v => v.id === remembered) || views[0] || {}).id;
  const go = (id) => { const u = appUseGet(me.id); u.hubView = { ...(u.hubView || {}), [hubId]: id }; appUseSet(me.id, u); rest.setTab(id); };
  const Cur = (views.find(v => v.id === cur) || {}).comp;
  const HubIcon = cfg.icon;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '9px 13px' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
            <HubIcon size={16} color="var(--brass)" />
            <b style={{ fontSize: 13 }}>{cfg.ar}</b>
            <span style={{ fontSize: 11, color: 'var(--dim)' }} className="hub-desc">· {cfg.desc}</span>
          </div>
        </div>
        {views.length > 1 && <div style={{ marginTop: 8 }}><SectionNav items={views.map(v => ({ id: v.id, ar: v.ar, icon: v.icon, group: v.group }))} cur={cur} onPick={go} label={'أقسام ' + cfg.ar} /></div>}
      </div>
      {Cur ? <Cur {...rest} /> : <div className="card"><div className="empty">لا توجد أقسام متاحة لصلاحيتك.</div></div>}
    </div>
  );
}

/* ExecDashboard: نُقل إلى mods/acct/ExecDashboard.jsx (تحميل كسول) */

// ===== v10.9: مركز التنبيهات الذكية — قائمة إجراءات حيّة عبر كل الوحدات، بأولويات وفئات وتصفية =====
/* AlertsCenter: نُقل إلى mods/acct/AlertsCenter.jsx (تحميل كسول) */

/* Dashboard: نُقل إلى mods/acct/Dashboard.jsx (تحميل كسول) */

/* ================= الإغلاق اليومي ================= */
/* ============================================================
   v33.0 — نقطة البيع (تجربة فرع): بيع سريع باللمس، فاتورة مبسّطة برمز QR (المرحلة الأولى)، ورديات بعدّ النقد،
   يعمل دون إنترنت: الفاتورة تُحفظ على الجهاز فورًا وتُرسَل عند الاتصال — ترقيم وسلسلة بصمات لكل جهاز فلا تتكرر الأرقام.
   الإيراد يُقيَّد من الإغلاق اليومي كما هو (الإغلاق يُعبّأ من نقطة البيع) فلا قيد مكرر.
   ============================================================ */
const POS_DEV_KEY = 'mizan:posDev', POS_Q_KEY = 'mizan:posQueue';
const posDev = () => { try { let d = JSON.parse(localStorage.getItem(POS_DEV_KEY) || 'null'); if (!d || !d.tag) { d = { tag: Math.random().toString(36).slice(2, 4).toUpperCase(), name: 'كاشير' }; localStorage.setItem(POS_DEV_KEY, JSON.stringify(d)); } return d; } catch { return { tag: 'X1', name: 'كاشير' }; } };
const POS_SH_KEY = 'mizan:posShiftLocal';
const POS_SC_KEY = 'mizan:posShiftClose';   // v34.14: ورديات أُغلقت على الجهاز ولم تُرسل بعد (قائمة)
const pendShiftsGet = () => { try { const v = JSON.parse(localStorage.getItem(POS_SC_KEY) || '[]'); return Array.isArray(v) ? v : (v ? [v] : []); } catch { return []; } };
const pendShiftsSet = (a) => { try { if (a.length) localStorage.setItem(POS_SC_KEY, JSON.stringify(a)); else localStorage.removeItem(POS_SC_KEY); } catch { } };
const POS_LQ_KEY = 'mizan:posLoyQ';
const loyQ = () => { try { return JSON.parse(localStorage.getItem(POS_LQ_KEY) || '[]'); } catch { return []; } };
const loyQSet = (a) => { try { localStorage.setItem(POS_LQ_KEY, JSON.stringify(a)); } catch { } };
// ترحيل حركات النقاط إلى المستند المشترك (كتابة مشروطة، ولا تُكرر حركة بنفس المعرّف)
async function loyPost(txs) {
  for (let i = 0; i < 5; i++) {
    const cur = (await cloud.get(KEYS.loy, null)) || { members: {}, tx: [] };
    const have = new Set((cur.tx || []).map(t => t.id)); const add = (txs || []).filter(t => !have.has(t.id));
    if (!add.length) return cur;
    const next = { ...cur, members: { ...(cur.members || {}) }, tx: [...(cur.tx || []), ...add] };
    add.forEach(t => { const m = next.members[t.phone] || {}; next.members[t.phone] = { ...m, name: t.name || m.name || '', since: m.since || t.at, last: t.at }; });
    const r = await cloud.setIfUnchanged(KEYS.loy, next);
    if (r === 'ok') return next; if (r === 'fail') return null;
  }
  return null;
}
const posQueue = () => { try { return JSON.parse(localStorage.getItem(POS_Q_KEY) || '[]'); } catch { return []; } };
const posQueueSet = (a) => { try { localStorage.setItem(POS_Q_KEY, JSON.stringify(a)); } catch { } };
const posR2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// إجماليات الطلب: الأسعار شاملة الضريبة؛ الخصم من الإجمالي؛ الضريبة = الإجمالي × النسبة ÷ (100 + النسبة)
function posTotals(lines, discount, rate) {
  const gross = posR2((lines || []).reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0));
  const ldisc = posR2((lines || []).reduce((a, l) => a + (Number(l.disc) || 0), 0));   // v34.0: خصومات الأسطر (العروض وخصم الصنف)
  const disc = Math.min(gross, posR2(ldisc + posR2(discount)));
  const total = posR2(gross - disc);
  const vat = rate ? posR2(total * rate / (100 + rate)) : 0;
  return { gross, ldisc, disc, total, vat, net: posR2(total - vat) };
}
/* ===== v34.0 — العروض والخصومات ونقاط الولاء =====
   العرض: { id, name, type: pct|amt|price|bxgy|order, value, x, y, mode (للفاتورة: pct|amt), minTotal, scope: all|cats|items, cats[], items[],
            code (كوبون اختياري), from, to (تاريخ), days[0..6], tFrom, tTo (ساعات — يدعم ما بعد منتصف الليل), branches[], active }
   القاعدة: لكل سطر أفضل خصم واحد للعميل (بلا تراكب) من «خصم الصنف» في بطاقته أو العروض العامة، ثم أفضل عرض على الفاتورة. */
const hmOf = (x) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(x || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };
function promoActive(pr, now, branchId) {
  if (!pr || pr.active === false) return false;
  const d = isoD(now);
  if (pr.from && d < pr.from) return false; if (pr.to && d > pr.to) return false;
  if ((pr.days || []).length && !pr.days.includes(now.getDay())) return false;
  const a = hmOf(pr.tFrom), b = hmOf(pr.tTo);
  if (a != null && b != null && a !== b) { const t = now.getHours() * 60 + now.getMinutes(); if (a < b ? (t < a || t >= b) : (t < a && t >= b)) return false; }
  if ((pr.branches || []).length && branchId && !pr.branches.includes(branchId)) return false;
  return true;
}
const promoHits = (pr, p) => !pr.scope || pr.scope === 'all' || (pr.scope === 'items' && (pr.items || []).includes(p.id)) || (pr.scope === 'cats' && (pr.cats || []).includes(p.cat || 'أخرى'));
function promoLineDisc(pr, unit, qty) {
  const v = Number(pr.value) || 0; unit = Number(unit) || 0; qty = Number(qty) || 0;
  if (pr.type === 'pct') return posR2(unit * qty * Math.min(100, Math.max(0, v)) / 100);
  if (pr.type === 'amt') return posR2(Math.min(unit, Math.max(0, v)) * qty);
  if (pr.type === 'price') return v > 0 && v < unit ? posR2((unit - v) * qty) : 0;
  if (pr.type === 'bxgy') { const x = Math.floor(Number(pr.x) || 0), y = Math.floor(Number(pr.y) || 0); if (x < 1 || y < 1) return 0; return posR2(Math.floor(qty / (x + y)) * y * unit); }
  return 0;
}
function posPriceCart(cart, products, promos, opt) {
  opt = opt || {}; const now = opt.now || new Date(); const code = String(opt.code || '').trim().toLowerCase();
  const act = (promos || []).filter(pr => promoActive(pr, now, opt.branchId) && (!pr.code || String(pr.code).trim().toLowerCase() === code));
  const lines = (cart || []).map(l => {
    const p = (products || []).find(x => x.id === l.productId) || { id: l.productId };
    const cands = [];
    if (p.disc && Number(p.disc.v) > 0 && (!p.disc.to || isoD(now) <= p.disc.to)) cands.push({ id: 'card:' + p.id, name: 'خصم الصنف', type: p.disc.t === 'amt' ? 'amt' : 'pct', value: p.disc.v });
    act.filter(pr => pr.type !== 'order' && promoHits(pr, p)).forEach(pr => cands.push(pr));
    let best = null, bd = 0;
    cands.forEach(pr => { const dd = promoLineDisc(pr, l.price, l.qty); if (dd > bd + 0.0001) { bd = dd; best = pr; } });
    const { disc: _d, promoId: _p, promoName: _n, ...rest } = l;
    return { ...rest, disc: posR2(bd), ...(best ? { promoId: best.id, promoName: best.name } : {}) };
  });
  const sub = posR2(lines.reduce((a, l) => a + l.qty * l.price - (l.disc || 0), 0));
  let order = null, od = 0;
  act.filter(pr => pr.type === 'order' && sub > 0 && sub + 0.0001 >= (Number(pr.minTotal) || 0)).forEach(pr => {
    const v = Number(pr.value) || 0; const dd = pr.mode === 'amt' ? Math.min(sub, v) : posR2(sub * Math.min(100, v) / 100); if (dd > od + 0.0001) { od = posR2(dd); order = pr; } });
  return { lines, sub, orderDisc: od, orderPromo: order ? { id: order.id, name: order.name } : null, codeOk: !!code && act.some(pr => pr.code) };
}
// نقاط الولاء: { enabled, earnPer (ريال لكل نقطة), ptValue (قيمة النقطة بالريال), minRedeem (حد أدنى للاستبدال), maxRedeemPct (سقف % من الفاتورة) }
const normPhone = (x) => { let d = String(x || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, ''); d = d.replace(/^(00966|966)/, '').replace(/^0/, ''); return d; };
const loyEarn = (cfg, amount) => (cfg && cfg.enabled && Number(cfg.earnPer) > 0) ? Math.floor((Number(amount) || 0) / Number(cfg.earnPer) + 1e-9) : 0;
const loyBal = (doc, phone) => posR2(((doc && doc.tx) || []).filter(t => t.phone === phone).reduce((a, t) => a + (Number(t.pts) || 0), 0));
function loyRedeemMax(cfg, bal, payable) {
  if (!cfg || !cfg.enabled) return 0; const pv = Number(cfg.ptValue) || 0;
  if (pv <= 0 || bal <= 0 || bal < (Number(cfg.minRedeem) || 0)) return 0;
  const cap = (Number(payable) || 0) * (Number(cfg.maxRedeemPct) || 100) / 100;
  return Math.max(0, Math.floor(Math.min(bal, cap / pv) + 1e-9));
}
// ملخص فواتير (وردية/يوم/فرع): المبيعات وطرق الدفع والخصومات والعروض والولاء والملغاة
function posOrdersStats(orders) {
  const ok = (orders || []).filter(o => o.status !== 'void'), vd = (orders || []).filter(o => o.status === 'void');
  const s = posDaySummary(ok.map(o => ({ ...o, branchId: 'x', date: 'x' })), 'x', 'x');
  const promo = {}; let ldisc = 0, odisc = 0, mdisc = 0, lred = 0, lpts = 0, earned = 0, gross = 0;
  ok.forEach(o => { gross += o.gross || 0; (o.lines || []).forEach(l => { if (l.disc) { ldisc += l.disc; const k = l.promoName || 'عرض'; promo[k] = posR2((promo[k] || 0) + l.disc); } });
    if (o.orderDisc) { odisc += o.orderDisc; const k = (o.orderPromo || {}).name || 'خصم الفاتورة'; promo[k] = posR2((promo[k] || 0) + o.orderDisc); }
    mdisc += o.manualDisc != null ? o.manualDisc : (o.orderDisc || o.loyalty ? 0 : (o.disc || 0) - (o.lines || []).reduce((a, l) => a + (l.disc || 0), 0));
    if (o.loyalty) { lred += o.loyalty.redeemAmt || 0; lpts += o.loyalty.redeemed || 0; earned += o.loyalty.earned || 0; } });
  const pms = {}; ok.forEach(o => (o.payments || []).forEach(p => { if (p.pmName) pms[p.pmName] = posR2((pms[p.pmName] || 0) + (Number(p.amount) || 0)); }));
  return { ...s, pms, gross: posR2(gross), ldisc: posR2(ldisc), odisc: posR2(odisc), mdisc: posR2(Math.max(0, mdisc)), promo, loyAmt: posR2(lred), loyPts: lpts, loyEarned: earned, voidN: vd.length, voidAmt: posR2(vd.reduce((a, o) => a + (o.total || 0), 0)) };
}
// صافي النقد في الطلب = المدفوع نقدًا − الباقي
const posCashNet = (o) => posR2((o.payments || []).filter(p => p.m === 'cash').reduce((a, p) => a + (Number(p.amount) || 0), 0) - (Number(o.change) || 0));
// ملخص مبيعات فرع في يوم: لتعبئة الإغلاق
function posDaySummary(orders, branchId, date) {
  const os = (orders || []).filter(o => o.branchId === branchId && o.date === date && o.status !== 'void');
  const out = { n: os.length, total: 0, cash: 0, card: 0, transfer: 0, apps: {}, vat: 0 };
  os.forEach(o => { out.total += o.total; out.vat += o.vat; out.cash += posCashNet(o);
    (o.payments || []).forEach(p => { const a = Number(p.amount) || 0; if (p.m === 'card') out.card += a; else if (p.m === 'transfer') out.transfer += a; else if (p.m === 'app') { const x = out.apps[p.appId] || (out.apps[p.appId] = { amount: 0, n: 0 }); x.amount += a; x.n += 1; } }); });
  ['total', 'cash', 'card', 'transfer', 'vat'].forEach(k => { out[k] = posR2(out[k]); }); Object.values(out.apps).forEach(x => { x.amount = posR2(x.amount); });
  return out;
}
function posReceiptHtml(org, o, br) {
  const co = org.company || {}; const svat = co.taxNumber || '';
  const ts = (o.at || '').slice(0, 19) + 'Z';
  const qr = svat ? qrSvg(zatcaTLV(co.name || '', svat, ts, o.total, o.vat), { ecl: 1, px: 120 }) : '';
  const m = (n) => money(n);
  const L = (o.lines || []).map(l => `<tr><td>${_xe(l.name)}${l.note ? '<div class="nt">' + _xe(l.note) + '</div>' : ''}${l.disc ? '<div class="nt">' + _xe(l.promoName || 'عرض') + ': −' + m(l.disc) + '</div>' : ''}</td><td class="n">${l.qty}</td><td class="n">${m(l.qty * l.price - (l.disc || 0))}</td></tr>`).join('');
  const ly = o.loyalty;
  const P = (o.payments || []).map(p => `<tr><td colspan="2">${p.pmName ? _xe(p.pmName) : p.m === 'cash' ? 'نقدًا' : p.m === 'card' ? 'شبكة' : p.m === 'transfer' ? 'تحويل' : _xe(p.appName || 'تطبيق')}</td><td class="n">${m(p.amount)}</td></tr>`).join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${_xe(o.no)}</title><style>${NUM_FACE}
  @page{size:80mm auto;margin:3mm} *{box-sizing:border-box} body{font-family:'MizanNum','IBM Plex Sans Arabic',Tahoma,sans-serif;width:74mm;margin:0 auto;color:#000;font-size:11.5px}
  h1{font-size:15px;text-align:center;margin:2px 0} .c{text-align:center} .s{font-size:10px;color:#333} table{width:100%;border-collapse:collapse;margin-top:6px}
  td{padding:3px 0;border-bottom:1px dashed #999;vertical-align:top} td.n{text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums} .nt{font-size:9.5px;color:#555}
  .tot td{font-weight:800;font-size:13px;border-bottom:2px solid #000} .qr{text-align:center;margin-top:8px} .qr svg{width:34mm;height:34mm}</style></head><body>
  <h1>${_xe(co.name || '')}</h1><div class="c s">${_xe(br ? br.name : '')}${svat ? '<br>الرقم الضريبي: ' + _xe(svat) : ''}</div>
  <div class="c" style="font-weight:800;margin-top:6px">فاتورة ضريبية مبسّطة</div>
  <div class="c s">رقم: ${_xe(o.no)} · ${_xe((o.at || '').slice(0, 10))} ${_xe(new Date(o.at).toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' }))}${o.channel === 'takeaway' ? ' · سفري' : o.channel === 'delivery' ? ' · توصيل' : o.channel === 'dinein' ? ' · محلي' : ''}</div>
  <table>${L}
  ${o.orderDisc ? `<tr><td colspan="2">${_xe((o.orderPromo || {}).name || 'خصم الفاتورة')}</td><td class="n">−${m(o.orderDisc)}</td></tr>` : ''}
  ${(o.manualDisc != null ? o.manualDisc : (o.lines || []).some(l => l.disc) ? 0 : o.disc) ? `<tr><td colspan="2">خصم${o.discReason ? ' (' + _xe(o.discReason) + ')' : ''}</td><td class="n">−${m(o.manualDisc != null ? o.manualDisc : o.disc)}</td></tr>` : ''}
  ${ly && ly.redeemAmt ? `<tr><td colspan="2">استبدال ${ly.redeemed} نقطة</td><td class="n">−${m(ly.redeemAmt)}</td></tr>` : ''}
  <tr><td colspan="2">الإجمالي قبل الضريبة</td><td class="n">${m(o.net)}</td></tr><tr><td colspan="2">ضريبة القيمة المضافة</td><td class="n">${m(o.vat)}</td></tr>
  <tr class="tot"><td colspan="2">الإجمالي شامل الضريبة</td><td class="n">${m(o.total)}</td></tr>${P}${o.change ? `<tr><td colspan="2">الباقي</td><td class="n">${m(o.change)}</td></tr>` : ''}</table>
  ${ly ? `<div class="c s" style="margin-top:6px;border:1px dashed #999;padding:4px">نقاط الولاء${ly.name ? ' — ' + _xe(ly.name) : ''}<br>المكتسبة: ${ly.earned || 0}${ly.redeemed ? ' · المستبدلة: ' + ly.redeemed : ''} · الرصيد: ${ly.balAfter != null ? ly.balAfter : '—'}</div>` : ''}
  ${qr ? '<div class="qr">' + qr + '</div>' : ''}${(org.posCfg || {}).footer ? '<div class="c s" style="margin-top:6px">' + _xe(org.posCfg.footer) + '</div>' : ''}<div class="c s" style="margin-top:4px">شكرًا لزيارتكم</div></body></html>`;
}
// طباعة عبر إطار مخفي — بلا نوافذ منبثقة (يعمل على الآيباد والكمبيوتر)
/* v34.13 — الطباعة داخل الصفحة نفسها: الإطار المخفي لا يطبع على الآيفون/سفاري (يطبع الصفحة كلها أو لا شيء).
   نضع المستند في حاوية #mz-print بأنماط طباعة فقط، ونخفي بقية المنصة عند الطباعة، ثم window.print() — يعمل على كل المتصفحات. */
function printHtmlInPage(html) {
  try {
    html = mzBrandDoc(html);
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    let css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n');
    const faces = (css.match(/@font-face\s*{[^}]*}/g) || []).join('\n'); css = css.replace(/@font-face\s*{[^}]*}/g, '');
    const pages = (css.match(/@page\s*{[^}]*}/g) || []).join('\n'); css = css.replace(/@page\s*{[^}]*}/g, '');
    css = css.replace(/(^|[{}\s,;])(html|body)(?=\s*[{,.:#\[>~+\s])/g, '$1#mz-print');
    document.getElementById('mz-print')?.remove(); document.getElementById('mz-print-css')?.remove();
    const st = document.createElement('style'); st.id = 'mz-print-css';
    st.textContent = faces + '\n@media screen{#mz-print{display:none !important}}\n@media print{' + pages + '\nhtml,body{background:#fff !important;height:auto !important;overflow:visible !important}body>*:not(#mz-print){display:none !important}#mz-print{display:block !important}\n' + css + '}';
    const box = document.createElement('div'); box.id = 'mz-print'; box.setAttribute('dir', doc.documentElement.getAttribute('dir') || 'rtl');
    box.innerHTML = doc.body ? doc.body.innerHTML : String(html);
    document.head.appendChild(st); document.body.appendChild(box);
    const clean = () => { try { box.remove(); st.remove(); } catch { } window.removeEventListener('afterprint', clean); };
    window.addEventListener('afterprint', clean);
    setTimeout(() => { try { window.print(); } catch { } setTimeout(clean, 60000); }, 250);
    return true;
  } catch { return false; }
}
function posPrint(html) { return printHtmlInPage(html); }

/* PosApp: نُقل إلى mods/pos/PosApp.jsx (تحميل كسول) */
// v34.0: تقرير الوردية — X (مؤقت لوردية مفتوحة) أو Z (إغلاق) — بالمبيعات وطرق الدفع والخصومات والعروض والولاء والملغاة
function posShiftHtml(org, sh, allOs, br, kind) {
  const st = posOrdersStats(allOs); const m = (n) => money(n);
  const expected = sh.expected != null && kind === 'Z' ? sh.expected : posR2((sh.openingCash || 0) + st.cash);
  const row = (k, v) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير ${kind} — ${_xe(br.name)}</title><style>${NUM_FACE}@page{size:80mm auto;margin:3mm}body{font-family:'MizanNum',Tahoma,sans-serif;width:74mm;margin:0 auto;font-size:12px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dashed #999}td.n{text-align:left}h1{font-size:15px;text-align:center;margin:2px 0}.sec td{font-weight:800;border-bottom:1.5px solid #000;padding-top:8px}</style></head><body>
  <h1>${kind === 'Z' ? 'تقرير إغلاق وردية (Z)' : 'تقرير وردية مؤقت (X)'}</h1><div style="text-align:center">${_xe((org.company || {}).name || '')}<br>${_xe(br.name)} · ${_xe(sh.devName || '')} (${_xe(sh.dev || '')})<br>${_xe(String(sh.openedAt).slice(0, 16).replace('T', ' '))} ← ${kind === 'Z' ? _xe(String(sh.closedAt || '').slice(11, 16)) : 'الآن ' + _xe(new Date().toTimeString().slice(0, 5))}</div>
  <table><tr class="sec"><td colspan="2">المبيعات</td></tr>${row('عدد الفواتير', st.n)}${row('المبيعات قبل الخصومات', m(st.gross))}${row('إجمالي المبيعات', m(st.total))}${row('منها ضريبة', m(st.vat))}
  <tr class="sec"><td colspan="2">طرق الدفع</td></tr>${row('نقدي (صافي)', m(st.cash))}${row('شبكة', m(st.card))}${row('تحويل', m(st.transfer))}
  ${Object.entries(st.apps).map(([id, x]) => row(_xe(((org.deliveryApps || APPS).find(a => a.id === id) || {}).n || 'تطبيق'), m(x.amount))).join('')}
  ${Object.entries(st.pms || {}).map(([n, v]) => row('منها: ' + _xe(n), m(v))).join('')}
  ${st.ldisc || st.odisc || st.mdisc || st.loyAmt ? `<tr class="sec"><td colspan="2">الخصومات والعروض</td></tr>${Object.entries(st.promo).map(([k, v]) => row(_xe(k), '−' + m(v))).join('')}${st.mdisc ? row('خصم يدوي', '−' + m(st.mdisc)) : ''}${st.loyAmt ? row('استبدال نقاط (' + st.loyPts + ')', '−' + m(st.loyAmt)) : ''}` : ''}
  ${st.loyEarned ? row('نقاط مكتسبة', st.loyEarned) : ''}${st.voidN ? row('فواتير ملغاة', st.voidN + ' · ' + m(st.voidAmt)) : ''}
  <tr class="sec"><td colspan="2">الدرج</td></tr>${row('النقد الافتتاحي', m(sh.openingCash || 0))}${row('النقد المتوقع', m(expected))}
  ${kind === 'Z' ? row('النقد المعدود', m(sh.counted)) + row('<b>الفرق</b>', '<b>' + m(sh.diff) + '</b>') : ''}</table>
  <div style="margin-top:8px">${kind === 'Z' ? 'أغلقها: ' + _xe(sh.closedBy || '') + (sh.closeNote ? '<br>ملاحظة: ' + _xe(sh.closeNote) : '') : 'طُبع: ' + _xe(arDT(new Date()))}</div></body></html>`;
}
const posZHtml = (org, sh, os, br) => posShiftHtml(org, sh, os, br, 'Z');
/* v34.1 — إضافة الأصناف وتسعيرها من نقطة البيع مباشرة (حين لا توجد أصناف بأسعار بيع) */
/* PosQuickProducts: نُقل إلى mods/pos/PosQuickProducts.jsx (تحميل كسول) */

/* ===== v34.0 — إدارة العروض ===== */
const PROMO_T = { pct: 'خصم نسبة %', amt: 'خصم مبلغ ثابت للوحدة', price: 'سعر خاص', bxgy: 'اشترِ X واحصل على Y مجانًا', order: 'خصم على الفاتورة' };
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const promoDesc = (pr) => pr.type === 'pct' ? pr.value + '%' : pr.type === 'amt' ? money(pr.value) + ' للوحدة' : pr.type === 'price' ? 'بـ ' + money(pr.value) : pr.type === 'bxgy' ? 'اشترِ ' + pr.x + ' واحصل على ' + pr.y : (pr.mode === 'amt' ? money(pr.value) : pr.value + '%') + (Number(pr.minTotal) ? ' فوق ' + money(pr.minTotal) : '');
const PROMO_IDEAS = [
  { k: 'ساعة سعيدة', d: 'خصم على المشروبات في ساعات الهدوء', f: { name: 'الساعة السعيدة', type: 'pct', value: '20', scope: 'cats', tFrom: '15:00', tTo: '18:00' } },
  { k: 'اشترِ 2 والثالث مجانًا', d: 'يرفع متوسط الكمية', f: { name: 'اشترِ 2 والثالث مجانًا', type: 'bxgy', x: '2', y: '1', scope: 'items' } },
  { k: 'خصم الفاتورة الكبيرة', d: 'يرفع متوسط الفاتورة', f: { name: 'خصم الطلبات فوق 150', type: 'order', mode: 'pct', value: '10', minTotal: '150', scope: 'all' } },
  { k: 'عرض نهاية الأسبوع', d: 'الخميس والجمعة', f: { name: 'عرض الويكند', type: 'pct', value: '15', scope: 'all', days: [4, 5] } },
  { k: 'وجبة اليوم', d: 'سعر خاص لصنف محدد', f: { name: 'وجبة اليوم', type: 'price', value: '', scope: 'items' } },
  { k: 'كوبون حملة', d: 'للتسويق عبر السوشال أو SMS', f: { name: 'كوبون الحملة', type: 'pct', value: '10', scope: 'all', code: 'MIZAN10' } },
  { k: 'افتتاح فرع', d: 'لفرع محدد لفترة محددة', f: { name: 'عرض الافتتاح', type: 'pct', value: '25', scope: 'all' } }
];
/* PosPromos: نُقل إلى mods/pos/PosPromos.jsx (تحميل كسول) */

/* ===== v34.0 — نقاط الولاء: الإعداد والعملاء ===== */
/* PosLoyalty: نُقل إلى mods/pos/PosLoyalty.jsx (تحميل كسول) */

/* ===== v34.0 — الورديات والتقارير (للمركز ومدير الفرع): تقرير X/Z، إنهاء وردية جهاز آخر، تقرير اليوم المجمّع ===== */
/* PosShifts: نُقل إلى mods/pos/PosShifts.jsx (تحميل كسول) */

/* PosSettings: نُقل إلى mods/pos/PosSettings.jsx (تحميل كسول) */

/* Closing: نُقل إلى mods/closing/Closing.jsx (تحميل كسول) */

// ترحيل سدادات الصيغة القديمة {method, amount} إلى خانات التوزيع — حتى لا يضيع المبلغ عند التعديل
function normalizeSupPays(arr) {
  return (arr || []).map(pm => {
    if (pm.cash != null || pm.card != null || pm.transfer != null || pm.other != null) return pm;
    const s = paySplits(pm);
    const { method, amount, ...rest } = pm;
    return { ...rest, ...s };
  });
}

/* ClosingForm: نُقل إلى mods/closing/ClosingForm.jsx (تحميل كسول) */

/* ClosingView: نُقل إلى mods/closing/ClosingView.jsx (تحميل كسول) */

/* ================= التدقيق والاعتماد ================= */
/* Approvals: نُقل إلى mods/closing/Approvals.jsx (تحميل كسول) */

/* ================= الخزينة الرئيسية ================= */
/* Treasury: نُقل إلى mods/acct/Treasury.jsx (تحميل كسول) */

function DisbursementForm({ org, me, balance, commit, say, onClose }) {
  const [f, setF] = useState({
    date: today(), category: 'توريد مواد خام مركزي', amount: 0,
    beneficiary: '', method: 'bank_transfer', reference: ''
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (f.amount <= 0) return say('أدخل مبلغ الصرف', 'no');
    if (!f.beneficiary.trim()) return say('اكتب اسم المستفيد', 'no');
    if (f.amount > balance) return say('المبلغ يتجاوز رصيد الخزينة المتاح', 'no');
    if (periodLocked(org, f.date || today())) return say(LOCK_MSG(f.date || today()), 'no');
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
/* ============================================================
   v31.2 — الإجازات: طلب ← اعتماد ← رصيد ← خصم تلقائي ← مخصص في الدفاتر
   ============================================================ */
/* Leaves: نُقل إلى mods/hr/Leaves.jsx (تحميل كسول) */

/* ===== v36.9 — مسير الرواتب الشهري ومسير الأجور الإضافية =====
   payrollRowsOf: حساب كشف الرواتب الموحّد (تستخدمه شاشة الرواتب والمسير معًا — رقم واحد في كل مكان).
   الإضافي يُخزَّن كحركة في advances بنوع 'overtime' (مثل المكافأة: إضافة للإجمالي) فيدخل الاستحقاق والقيود تلقائيًا. */
const PAY_ADD_TYPES = ['bonus', 'overtime'];
function payrollRowsOf(org, advances, emps, month) {
  const gosiOn = !!(org.gosiCfg || {}).enabled;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  return (emps || []).map(e => {
    const ads = (advances || []).filter(a => a.employeeId === e.id && a.month === month);
    const draws = sum(ads.filter(a => ['advance', 'salary_draw'].includes(a.type)), a => a.amount);
    const bonus = r2(sum(ads.filter(a => a.type === 'bonus'), a => a.amount));
    const otA = ads.filter(a => a.type === 'overtime');
    const ot = r2(sum(otA, a => a.amount)), otHours = r2(sum(otA, a => Number(a.hours) || 0));
    const cuts = sum(ads.filter(a => !['advance', 'salary_draw', ...PAY_ADD_TYPES].includes(a.type)), a => a.amount);
    const allow = (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowance || 0);
    const gross = r2((e.baseSalary || 0) + allow + bonus + ot);
    const gr = gosiRatesFor(e, org.gosiCfg);
    const gEmp = (gosiOn && e.gosiSubject) ? r2(gr.base * gr.emp / 100) : 0;
    const gEr = (gosiOn && e.gosiSubject) ? r2(gr.base * gr.er / 100) : 0;
    return { e, ads, draws, bonus, ot, otHours, cuts, allow, gross, gEmp, gEr, net: r2(gross - draws - cuts - gEmp), flags: ads.filter(a => a.isUnjustified).length };
  });
}

// أجر ساعة العمل الإضافي — المادة 107 من نظام العمل: أجر الساعة + 50% من أجر الساعة الأساسي
// أجر الساعة = الأجر الشهري ÷ 30 ÷ ساعات العمل اليومية. الأساس: «الفعلي» (الأساسي + البدلات، افتراضي — نص المادة 107) أو «الأساسي» (= 1.5 × ساعة أساسية).
function otRateOf(e, hoursPerDay, basis) {
  const r4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const H = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : 8;
  const base = Number(e.baseSalary) || 0;
  const actual = base + (Number(e.housingAllowance) || 0) + (Number(e.transportAllowance) || 0) + (Number(e.otherAllowance) || 0);
  const hBasic = r4(base / 30 / H), hActual = r4(actual / 30 / H);
  const rate = r4((basis === 'actual' ? hActual : hBasic) + 0.5 * hBasic);
  return { H, base, actual, hBasic, hActual, rate };
}
// ساعات الإضافي من البصمة لشهر: يوم عمل ← (آخر خروج − أول دخول) − ساعات اليوم إن كانت موجبة؛ يوم الراحة الأسبوعية ← كل الساعات
function otFromAttendance(org, ops, emp, month) {
  const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const H = Number(pol.workHoursPerDay) > 0 ? Number(pol.workHoursPerDay) : 8;
  const off = new Set((pol.weeklyOffDays || []).map(Number));
  const byDay = {};
  (ops.attendanceEvents || []).filter(ev => ev.employeeId === emp.id && (ev.at || '').slice(0, 7) === month)
    .forEach(ev => { const ds = (ev.at || '').slice(0, 10); (byDay[ds] = byDay[ds] || []).push(ev); });
  let regMin = 0, offMin = 0, days = 0, open = 0;
  Object.keys(byDay).forEach(ds => {
    const evs = byDay[ds].sort((a, b) => (a.at < b.at ? -1 : 1));
    const fi = evs.find(x => x.type === 'in'); const outs = evs.filter(x => x.type === 'out'); const lo = outs[outs.length - 1];
    if (!fi) return;
    if (!lo || lo.at <= fi.at) { open++; return; }
    const mins = Math.round((new Date(lo.at) - new Date(fi.at)) / 60000); if (!(mins > 0)) return;
    days++;
    if (off.has(new Date(ds + 'T00:00:00').getDay())) offMin += mins; else regMin += Math.max(0, mins - H * 60);
  });
  // تقريب لأقرب ربع ساعة لأسفل (لا تُحتسب كسور الدقائق لصالح أي طرف بلا اعتماد)
  const q = (m) => Math.floor(m / 15) / 4;
  return { hours: q(regMin + offMin), regH: q(regMin), offH: q(offMin), days, open, H };
}

/* OvertimeSheet: نُقل إلى mods/hr/OvertimeSheet.jsx (تحميل كسول) */

/* PayrollMuster: نُقل إلى mods/hr/PayrollMuster.jsx (تحميل كسول) */

/* Payroll: نُقل إلى mods/hr/Payroll.jsx (تحميل كسول) */

// م3 (v27.8) — بناء وصف وظيفي كامل قابل للطباعة من حقول الوظيفة
function positionJdHtml(pos, org) {
  const progs = (org.trainingPrograms && org.trainingPrograms.length) ? org.trainingPrograms : defaultTrainingPrograms();
  const posName = (id) => ((org.positions || []).find(p => p.id === id) || {}).title || '—';
  const deptName = ((org.departments || []).find(d => d.id === pos.departmentId) || {}).name || '—';
  const list = (s) => { const items = String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean); return items.length ? '<ul style="margin:4px 0;padding-inline-start:18px">' + items.map(i => '<li>' + escH(i) + '</li>').join('') + '</ul>' : '—'; };
  const reqT = (pos.requiredTrainingIds || []).map(id => (progs.find(p => p.id === id) || {}).title).filter(Boolean);
  const row = (k, v) => '<tr><td style="width:160px;color:#555;vertical-align:top">' + k + '</td><td>' + v + '</td></tr>';
  return '<table><tbody>' +
    row('المسمى الوظيفي', '<b>' + escH(pos.title) + '</b>') +
    row('الكود / الدرجة / المستوى', [pos.code, pos.grade, pos.level].map(x => escH(x || '—')).join(' · ')) +
    row('القسم', escH(deptName)) +
    row('يرفع تقاريره إلى', escH(posName(pos.reportsToId))) +
    row('الوظيفة البديلة', escH(posName(pos.backupPositionId))) +
    row('ملخص الوظيفة', escH(pos.summary || '—')) +
    row('المهام والمسؤوليات', list(pos.duties)) +
    row('المؤهلات والخبرات', list(pos.qualifications)) +
    row('الجدارات والمهارات', list(pos.competencies)) +
    row('الصلاحيات', list(pos.authorities)) +
    row('القيود والمحظورات', list(pos.restrictions)) +
    row('التدريب/الشهادات المطلوبة', reqT.length ? escH(reqT.join('، ')) : '—') +
    '</tbody></table>';
}
/* HrMaster: نُقل إلى mods/hr/HrMaster.jsx (تحميل كسول) */

/* ================= م2 — سياسات الموارد البشرية وأدوار الإشراف التنظيمي ================= */
const HR_WEEK_DAYS = [
  { v: 0, ar: 'الأحد' }, { v: 1, ar: 'الاثنين' }, { v: 2, ar: 'الثلاثاء' }, { v: 3, ar: 'الأربعاء' },
  { v: 4, ar: 'الخميس' }, { v: 5, ar: 'الجمعة' }, { v: 6, ar: 'السبت' },
];
const defaultHrPolicies = () => ({
  workHoursPerDay: 8, weeklyOffDays: [5], lateToleranceMinutes: 15,
  overtimeEnabled: false, overtimeMaxHoursPerMonth: 30, otBasis: 'actual',   // v37.0: المادة 107 — أجر الساعة الفعلي (الأساسي + البدلات) + 50% من أجر الساعة الأساسي (اعتماد المالك)
  scoreWeightsEnabled: false, scoreWeights: { attendance: 25, quality: 25, tasks: 25, discipline: 25 },
  disciplineBase: 50, disciplinePointValue: 5, // م7: محور الانضباط = القاعدة + (صافي نقاط الشهر × قيمة النقطة)، محصور 0–100
  signReminderDays: 3, // م10 (v27.0): بعد كم يومًا من إصدار إقرار/إشعار غير موقَّع يظهر تنبيه في مركز التنبيهات
  // م20 (v27.6) — الإجراءات التأديبية (نظام العمل — افتراضات قابلة للضبط؛ لائحة المنشأة المسجّلة هي المرجع الملزم)
  penaltyEraseDays: 180, fineCapDaysPerMonth: 5, chargeWindowDays: 30, objectionDays: 15, pipTriggerScore: 60,
  penaltySchedule: defaultPenaltySchedule(),
  trainingExpiryAlertDays: 30, // م19 (v27.7): تنبيه قبل انتهاء الشهادة بعدد الأيام
  roleKpiEnabled: false, roleKpiWeight: 20, // م11 (v27.9): محور مؤشرات الدور — مُعطَّل افتراضيًا
});
// م6 — قواعد النقاط التلقائية (مُعطَّلة افتراضيًا حتى يراجعها المالك ويفعّلها — قرار H/3 في hr-audit-m0)
const defaultPointsRules = () => ({ enabled: false, onTime: 1, late: -1, absent: -3, taskDone: 1 });
// م8 — شرائح مكافآت تلقائية حسب درجة الأداء (م7): مُعطَّلة افتراضيًا (قرار H/3)؛ تُولِّد طلبات مقترحة تمرّ بالاعتماد نفسه
const defaultRewardTiers = () => ({ enabled: false, tiers: [{ minScore: 90, amount: 500 }, { minScore: 80, amount: 250 }] });
// كود نافذة زمنية للمعاينة فقط — دالة تجزئة خفيفة متزامنة (ليست تشفيرًا فعليًا).
// التحقّق الأمني الحقيقي عند تسجيل الحضور بمسح الرمز يُبنى في م3 فوق نفس السرّ المخزَّن هنا.
function hrHashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h.toString(36);
}
function hrQrWindowCode(secret, rotateMinutes, branchId) {
  const win = Math.floor(Date.now() / ((rotateMinutes || 3) * 60000));
  return hrHashStr(branchId + ':' + secret + ':' + win);
}

/* HrPolicy: نُقل إلى mods/hr/HrPolicy.jsx (تحميل كسول) */

/* ============================================================
   م3 — الحضور الموثَّق (Verified Attendance)
   بلا حساب دخول شخصي للموظف وبلا دخول مجهول (Anonymous Auth) وبلا أي
   تعديل على قواعد Firestore: التسجيل يتم فقط عبر جهاز الفرع المشترك
   (جلسة الكاشير/مدير الفرع المُصادَق عليها أصلاً)، برقم PIN خاص بكل
   موظف (مُجزَّأ SHA-256 عبر sha()) + تحقّق موقعي اختياري (جيوفنس الفرع
   من م2، عبر haversineMeters) يُسجَّل كعلَم امتثال بلا حجب العملية.
   ============================================================ */
/* Attendance: نُقل إلى mods/hr/Attendance.jsx (تحميل كسول) */

/* ============================================================
   م4 — محرّك الورديات (Shift Engine)
   قوالب ورديات لكل فرع + تقويم تعيين أسبوعي + مطابقة تلقائية مع
   الحضور الفعلي (ops.attendanceEvents من م3) + طلبات تبديل وردية بين
   موظفين + طلبات نقل موظف بين الفروع. تبويب مستقل (وليس متداخلًا داخل
   people) — مضاف صراحةً في ثلاثة مواضع معًا: ROLES.tabs، بلاطة
   LAUNCH_APPS/REG_APPS، ومصفوفة NAV (درس v19.0→v19.1، راجع الدليل).
   ============================================================ */
/* ShiftEngine: نُقل إلى mods/hr/ShiftEngine.jsx (تحميل كسول) */

/* Tasks: نُقل إلى mods/hr/Tasks.jsx (تحميل كسول) */

/* PointsLedger: نُقل إلى mods/hr/PointsLedger.jsx (تحميل كسول) */

// ===== م7 — دوال نقيّة مشتركة لإحصاءات الموظف والدرجة المركّبة (مُشتقّة، لا تُخزَّن) =====
function hrEmpStats(org, ops, emp, from, to) {
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const tolerance = Number(policies.lateToleranceMinutes) || 0;
  const rules = { ...defaultPointsRules(), ...(org.pointsRules || {}) };
  const td = today();
  const cap = to < td ? to : td;
  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const parseHM = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const s = { onTime: 0, late: 0, absent: 0, tasksExpected: 0, tasksDone: 0, manualPts: 0, manualCount: 0, autoPts: 0 };
  (ops.shiftAssignments || []).filter(a => a.empId === emp.id).forEach(a => {
    (a.shiftIds || []).forEach((sid, di) => {
      if (!sid) return;
      const ds = addDays(a.weekStart, di);
      if (ds < from || ds > cap) return;
      const tpl = (ops.shiftTemplates || []).find(t => t.id === sid);
      const evs = (ops.attendanceEvents || []).filter(ev => ev.employeeId === emp.id && (ev.at || '').slice(0, 10) === ds).sort((x, y) => (x.at < y.at ? -1 : 1));
      const inEv = evs.find(ev => ev.type === 'in');
      if (!inEv) { if (ds < td && !onLeave(ops, emp.id, ds)) s.absent++; return; }
      const inMin = new Date(inEv.at).getHours() * 60 + new Date(inEv.at).getMinutes();
      const lateBy = tpl ? inMin - parseHM(tpl.startTime) - tolerance : 0;
      if (lateBy > 0) s.late++; else s.onTime++;
    });
  });
  if (from <= cap) {
    for (let ds = from, guard = 0; ds <= cap && guard < 62; ds = addDays(ds, 1), guard++) {
      const wd = new Date(ds + 'T00:00:00').getDay();
      (ops.taskTemplates || []).filter(t => t.branchId === emp.branchId && t.isActive !== false && (t.freq === 'daily' || (t.weekdays || []).includes(wd))).forEach(t => {
        s.tasksExpected++;
        if ((ops.taskCompletions || []).some(c => c.templateId === t.id && c.employeeId === emp.id && c.date === ds)) s.tasksDone++;
      });
    }
  }
  (ops.taskAssignments || []).filter(x => x.employeeId === emp.id && x.dueDate >= from && x.dueDate <= cap).forEach(x => { s.tasksExpected++; if (x.status === 'done') s.tasksDone++; });
  const manual = (ops.pointsEntries || []).filter(x => x.employeeId === emp.id && x.date >= from && x.date <= to);
  s.manualCount = manual.length;
  s.manualPts = manual.reduce((a, x) => a + Number(x.points || 0), 0);
  const taskCount = (ops.taskCompletions || []).filter(x => x.employeeId === emp.id && x.date >= from && x.date <= to).length
    + (ops.taskAssignments || []).filter(x => x.employeeId === emp.id && x.status === 'done' && (x.doneAt || '').slice(0, 10) >= from && (x.doneAt || '').slice(0, 10) <= to).length;
  s.autoPts = rules.enabled ? s.onTime * Number(rules.onTime || 0) + s.late * Number(rules.late || 0) + s.absent * Number(rules.absent || 0) + taskCount * Number(rules.taskDone || 0) : 0;
  s.pointsActivity = s.manualCount > 0 || (rules.enabled && (s.onTime + s.late + s.absent + taskCount > 0));
  return s;
}
function hrScoreFor(org, ops, emp, ym) {
  const from = ym + '-01', to = ym + '-31';
  const st = hrEmpStats(org, ops, emp, from, to);
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const w = policies.scoreWeightsEnabled ? (policies.scoreWeights || {}) : defaultHrPolicies().scoreWeights;
  const base = Number(policies.disciplineBase); const pv = Number(policies.disciplinePointValue);
  const attTotal = st.onTime + st.late + st.absent;
  const rv = (ops.qualityReviews || []).find(r => r.employeeId === emp.id && r.ym === ym) || null;
  // م11 (v27.9): محور مؤشرات الدور — مُعطَّل افتراضيًا (roleKpiEnabled=false) فلا يغيّر أي درجة قائمة
  const rkOn = !!policies.roleKpiEnabled;
  const rkW = rkOn ? (Number(policies.roleKpiWeight) || 0) : 0;
  const axes = {
    attendance: attTotal ? Math.round(st.onTime / attTotal * 100) : null,
    tasks: st.tasksExpected ? Math.round(st.tasksDone / st.tasksExpected * 100) : null,
    discipline: st.pointsActivity ? Math.max(0, Math.min(100, Math.round((isNaN(base) ? 50 : base) + (st.manualPts + st.autoPts) * (isNaN(pv) ? 5 : pv)))) : null,
    quality: rv ? Math.round(((Number(rv.workQuality) + Number(rv.customerService) + Number(rv.teamwork)) / 3 - 1) / 4 * 100) : null,
    roleKpi: rkOn ? hrRoleKpiScore(org, ops, emp, ym).score : null,
  };
  let num = 0, den = 0;
  Object.keys(axes).forEach(k => { const wk = k === 'roleKpi' ? rkW : (Number(w[k]) || 0); if (axes[k] != null && wk > 0) { num += axes[k] * wk; den += wk; } });
  return { st, axes, score: den ? Math.round(num / den) : null, review: rv, weights: w, weightsEnabled: !!policies.scoreWeightsEnabled };
}

/* ============================================================
   v31.6 — ملف الموظف الموحّد: كل ما يخص أداء الموظف وانضباطه في شاشة واحدة
   (الدرجة الشهرية ومحاورها، الحضور والإجازات، النقاط، المكافآت والجزاءات، الإجراءات التصحيحية وخطط التحسين، التدريب والشهادات)
   ============================================================ */
/* EmployeeFile: نُقل إلى mods/hr/EmployeeFile.jsx (تحميل كسول) */

/* Performance: نُقل إلى mods/hr/Performance.jsx (تحميل كسول) */

/* Rewards: نُقل إلى mods/hr/Rewards.jsx (تحميل كسول) */

/* ================= م20 (v27.6) — الإجراءات التأديبية التصحيحية + خطط تحسين الأداء (PIP) =================
   نموذج البيانات (BR_COLS — بفرعها كي يقرأه/يكتبه جهاز الفرع ويقرأه المركز):
   ops.hrCorrective[] = { id, branchId, branchName, employeeId, employeeName, month(YYYY-MM), date,
     category, code, title, level, penaltyType, fineDays, fineAmount, description, discoveredAt, investigation, witnessName,
     status:'pending'|'approved'|'rejected', requestedBy/Name, requestedAt, decidedBy/Name, decidedAt, decisionNote,
     expiresAt, advanceId, signRefId, objection:{at,text,decidedNote,decidedByName,decidedAt} }
   ops.hrPips[] = { id, branchId, branchName, employeeId, employeeName, openedAt, reason, triggerScore, triggerMonth,
     objectives:[{text,metric,target}], mentorName, startAt, endAt, reviews:[{at,byName,note,progress}],
     status:'active'|'passed'|'failed'|'closed', outcome, closedByName, closedAt }
   نظام العمل السعودي (افتراضات قابلة للضبط في اللائحة — المرجع الملزم هو لائحة المنشأة المسجّلة بوزارة الموارد البشرية):
   أنواع الجزاءات وتدرّجها؛ محو الجزاء بعد 180 يومًا من الإبلاغ؛ سقف الغرامة أجر 5 أيام شهريًا؛
   مهلة المؤاخذة 30 يومًا من اكتشاف المخالفة؛ ومهلة تظلّم الموظف 15 يومًا من إبلاغه بالجزاء.
   ====================================================================================================== */
const PEN_TYPES = [
  { k: 'verbal', ar: 'تنبيه شفهي', rank: 1 },
  { k: 'warning', ar: 'إنذار كتابي', rank: 2 },
  { k: 'fine', ar: 'غرامة (خصم أيام أجر)', rank: 3 },
  { k: 'deny_raise', ar: 'الحرمان من العلاوة أو تأجيلها', rank: 4 },
  { k: 'deny_promo', ar: 'الحرمان من الترقية', rank: 5 },
  { k: 'suspend', ar: 'الإيقاف عن العمل', rank: 6 },
  { k: 'dismiss', ar: 'توصية بالفصل', rank: 7 },
];
const penTypeAr = (k) => (PEN_TYPES.find(t => t.k === k) || {}).ar || k;
function defaultPenaltySchedule() {
  const lad = (arr) => arr.map((x, i) => ({ level: i + 1, penaltyType: x[0], fineDays: x[1] || 0 }));
  return [
    { code: 'late', category: 'حضور', title: 'التأخّر عن موعد العمل', ladder: lad([['verbal', 0], ['warning', 0], ['fine', 0.5], ['fine', 1]]) },
    { code: 'absence', category: 'حضور', title: 'الغياب بدون إذن', ladder: lad([['warning', 0], ['fine', 1], ['fine', 3], ['dismiss', 0]]) },
    { code: 'hygiene', category: 'سلامة ونظافة', title: 'الإخلال بمعايير النظافة أو السلامة', ladder: lad([['verbal', 0], ['warning', 0], ['fine', 1], ['fine', 3]]) },
    { code: 'customer', category: 'سلوك', title: 'سوء التعامل مع العميل', ladder: lad([['warning', 0], ['fine', 1], ['fine', 3], ['suspend', 0]]) },
    { code: 'quality', category: 'جودة', title: 'مخالفة معايير التحضير أو الجودة', ladder: lad([['verbal', 0], ['warning', 0], ['fine', 1], ['fine', 2]]) },
    { code: 'cash', category: 'عهدة ونقدية', title: 'مخالفة تعليمات العهدة أو النقدية', ladder: lad([['warning', 0], ['fine', 2], ['fine', 5], ['dismiss', 0]]) },
  ];
}
// جزاءات معتمدة سابقة لنفس المخالفة ما زالت سارية (لم يمضِ عليها eraseDays) — أساس التدرّج ومحو الجزاء
function activePriorCorrectives(list, empId, code, asOfStr, eraseDays) {
  const asOf = new Date((asOfStr || today()) + 'T00:00:00');
  return (list || []).filter(c => c.employeeId === empId && c.code === code && c.status === 'approved')
    .filter(c => { const ds = (c.date || (c.decidedAt || '').slice(0, 10) || asOfStr); const d = new Date(ds + 'T00:00:00'); return (asOf - d) / 86400000 <= (Number(eraseDays) || 180); })
    .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1));
}
// المستوى التالي في سلّم اللائحة بحسب عدد الجزاءات السارية السابقة (0 ⇒ المستوى الأول)
function suggestNextLevel(schedule, code, priorCount) {
  const item = (schedule || []).find(s => s.code === code);
  if (!item || !(item.ladder || []).length) return null;
  const idx = Math.min(Number(priorCount) || 0, item.ladder.length - 1);
  return { ...item.ladder[idx], overflow: (Number(priorCount) || 0) >= item.ladder.length, title: item.title, category: item.category };
}
const correctiveExpiry = (dateStr, eraseDays) => { const d = new Date((dateStr || today()) + 'T00:00:00'); d.setDate(d.getDate() + (Number(eraseDays) || 180)); return isoD(d); };
const dailyWageOf = (base) => (Number(base) || 0) / 30;   // أجر اليوم = الأساسي ÷ 30 (نظام العمل)
// الغرامة المقترحة بحدّ نظام العمل: fineDays أيام أجر، بحيث لا يتجاوز مجموع غرامات الشهر السقف
function fineSuggest(base, fineDays, capDays, priorFineDaysThisMonth) {
  const dw = dailyWageOf(base);
  const remaining = Math.max(0, (Number(capDays) || 5) - (Number(priorFineDaysThisMonth) || 0));
  const days = Math.min(Number(fineDays) || 0, remaining);
  return { days, amount: Math.round(dw * days * 100) / 100, dw: Math.round(dw * 100) / 100, capped: (Number(fineDays) || 0) > remaining, remaining };
}
const pipTriggered = (score, threshold) => score != null && score < (Number(threshold) || 0);
const daysBetween = (aStr, bStr) => Math.round((new Date((bStr || today()) + 'T00:00:00') - new Date((aStr || today()) + 'T00:00:00')) / 86400000);

// محضر إجراء تأديبي يوقّعه الموظف بالعلم من كشك الفرع (م10) — إثبات المؤاخذة في محضر وفق نظام العمل
function correctiveSignDoc(rec, me) {
  return {
    id: uid('sg'), branchId: rec.branchId || '', branchName: rec.branchName || '', employeeId: rec.employeeId, employeeName: rec.employeeName,
    docType: 'corrective', month: rec.month || (rec.date || '').slice(0, 7), refId: rec.id,
    title: 'محضر إجراء تأديبي — ' + (rec.title || rec.category || ''), amount: rec.fineAmount || 0,
    lines: null, reason: (rec.category ? rec.category + ' · ' : '') + penTypeAr(rec.penaltyType) + (rec.description ? ' — ' + rec.description : ''),
    issuedAt: nowISO(), issuedBy: me ? me.id : '', issuedByName: me ? me.name : '', status: 'pending',
    signedAt: '', signedVia: '', signedOnBy: '', signedOnByName: '', pinVerified: false, witnessName: '', sig: null, sigHash: ''
  };
}

/* Corrective: نُقل إلى mods/hr/Corrective.jsx (تحميل كسول) */


/* ================= م19 (v27.7) — التدريب والشهادات الإلزامية =================
   نموذج البيانات:
   - org.trainingPrograms[] (إعداد مركزي، يصل الفروع عبر dirOf): { id, title, category, validityMonths(0=بلا انتهاء), mandatory, requiredJobTitles[], provider }
   - ops.hrTraining[] (BR_COLS — بفرعها؛ يقرأه/يكتبه جهاز الفرع ويقرأه المركز):
       { id, branchId, employeeId, employeeName, programId, programTitle, status:'planned'|'in_progress'|'completed',
         plannedDate, completedDate, expiryDate, score, result:'pass'|'fail'|'', certNo, note, recordedBy/Name, recordedAt }
   - الإعداد في org.hrPolicies: trainingExpiryAlertDays (تنبيه قبل انتهاء الشهادة).
   السياق (السعودية): الشهادة الصحية إلزامية لكل متداولي الأغذية وصلاحيتها سنة (وزارة البلديات)؛
   وتدريب سلامة الغذاء من جهة معتمدة لدى هيئة الغذاء والدواء. المدد والبرامج قابلة للضبط — لائحة الجهة الرسمية هي المرجع.
   المصادر موثّقة في claude/hr-training-v27.7.md.
   ============================================================================= */
function defaultTrainingPrograms() {
  return [
    { id: 'health_cert', title: 'الشهادة الصحية (متداول أغذية)', category: 'إلزامي', validityMonths: 12, mandatory: true, requiredJobTitles: [], provider: 'وزارة البلديات / بلدي' },
    { id: 'food_safety', title: 'تدريب سلامة الغذاء الأساسي', category: 'سلامة غذاء', validityMonths: 36, mandatory: true, requiredJobTitles: [], provider: 'جهة معتمدة (هيئة الغذاء والدواء)' },
    { id: 'haccp', title: 'نظام الهاسب (HACCP) للمشرفين', category: 'سلامة غذاء', validityMonths: 36, mandatory: false, requiredJobTitles: ['مدير الفرع', 'مشرف', 'شيف'], provider: 'جهة معتمدة' },
    { id: 'fire_safety', title: 'السلامة ومكافحة الحريق', category: 'سلامة', validityMonths: 24, mandatory: false, requiredJobTitles: [], provider: 'الدفاع المدني / جهة معتمدة' },
    { id: 'customer_service', title: 'مهارات خدمة العملاء', category: 'مهارات', validityMonths: 0, mandatory: false, requiredJobTitles: [], provider: 'داخلي' },
  ];
}
const TRAIN_STATUS_AR = { planned: 'مجدول', in_progress: 'جارٍ', completed: 'مكتمل', expired: 'منتهية' };
function addMonthsStr(dateStr, months) {
  if (!dateStr) return '';
  const [Y, M, D] = dateStr.split('-').map(Number); const d = new Date(Y, (M - 1) + (Number(months) || 0), D || 1);
  return isoD(d);
}
const trainingExpiryOf = (completedDate, validityMonths) => (!completedDate || !(Number(validityMonths) > 0)) ? '' : addMonthsStr(completedDate, validityMonths);
// الحالة الفعلية الآن: مكتمل بشهادة منتهية ⇒ 'expired'
function trainingStatusNow(rec, todayStr) {
  const td = todayStr || today();
  if (rec.status === 'completed' && rec.expiryDate && rec.expiryDate < td) return 'expired';
  return rec.status;
}
// هل البرنامج مطلوب لهذا الموظف (إلزامي، ومطابق لمسماه إن حُدّدت مسميات)
function programRequiredFor(prog, emp) {
  if (!prog || !prog.mandatory) return false;
  const jt = (prog.requiredJobTitles || []);
  return jt.length === 0 || jt.includes(emp.jobTitle || '');
}
// آخر سجل مكتمل ساري المفعول لبرنامج
function activeTrainingRecord(records, empId, programId, todayStr) {
  const td = todayStr || today();
  return (records || []).filter(r => r.employeeId === empId && r.programId === programId && r.status === 'completed')
    .filter(r => !r.expiryDate || r.expiryDate >= td)
    .sort((a, b) => ((a.completedDate || '') < (b.completedDate || '') ? 1 : -1))[0] || null;
}
// برامج إلزامية ينقص الموظف اجتيازها ساريةً
function missingRequiredTraining(programs, records, emp, todayStr) {
  return (programs || []).filter(p => programRequiredFor(p, emp)).filter(p => !activeTrainingRecord(records, emp.id, p.id, todayStr));
}
// سجلات مكتملة تنتهي خلال days (أو منتهية) — للتنبيهات والمصفوفة
function expiringTraining(records, days, todayStr) {
  const td = todayStr || today(); const lim = addMonthsStr(td, 0);
  const cutoff = (() => { const d = new Date(td + 'T00:00:00'); d.setDate(d.getDate() + (Number(days) || 0)); return isoD(d); })();
  void lim;
  return (records || []).filter(r => r.status === 'completed' && r.expiryDate && r.expiryDate <= cutoff);
}

/* Training: نُقل إلى mods/hr/Training.jsx (تحميل كسول) */


/* ================= م11 (v27.9) — مكتبة مؤشرات الأداء لكل دور (Role KPIs) =================
   نموذج البيانات:
   - org.roleKpis[] (إعداد مركزي، يصل الفروع عبر dirOf): { id, jobTitles[], title, unit, direction:'higher'|'lower', target, weight }
   - ops.hrKpiEntries[] (BR_COLS — بفرعها): { id, branchId, employeeId, employeeName, ym, values:{kpiId:number}, recordedBy/Name, recordedAt }
   - org.hrPolicies.roleKpiEnabled (افتراضي false) + roleKpiWeight (وزن المحور في الدرجة المركّبة م7 عند التفعيل).
   التكامل: عند التفعيل فقط يُضاف محور roleKpi إلى hrScoreFor؛ وهو مُعطَّل افتراضيًا فلا يغيّر أي درجة قائمة.
   ========================================================================================= */
function defaultRoleKpis() {
  return [
    { id: 'cash_var', jobTitles: ['كاشير'], title: 'دقة النقدية (إجمالي الفروقات شهريًا)', unit: 'ريال', direction: 'lower', target: 0, weight: 40 },
    { id: 'avg_ticket', jobTitles: ['كاشير'], title: 'متوسط قيمة الطلب', unit: 'ريال', direction: 'higher', target: 50, weight: 30 },
    { id: 'food_quality', jobTitles: ['شيف', 'مساعد شيف'], title: 'الالتزام بمعايير الجودة', unit: '%', direction: 'higher', target: 95, weight: 50 },
    { id: 'waste', jobTitles: ['شيف', 'مساعد شيف'], title: 'نسبة الهدر', unit: '%', direction: 'lower', target: 5, weight: 30 },
    { id: 'prep_time', jobTitles: [], title: 'زمن تجهيز الطلب', unit: 'دقيقة', direction: 'lower', target: 8, weight: 20 },
    { id: 'csat', jobTitles: [], title: 'رضا العملاء', unit: '%', direction: 'higher', target: 90, weight: 30 },
  ];
}
// نسبة تحقّق مؤشر واحد (0–100) وفق الاتجاه والهدف
function kpiAchievement(actual, target, direction) {
  const a = Number(actual), tgt = Number(target) || 0;
  if (actual == null || actual === '' || isNaN(a)) return null;
  if (direction === 'lower') {
    if (a <= tgt) return 100;
    if (tgt <= 0) return 0;                 // الهدف صفر وتجاوزه ⇒ 0
    return Math.max(0, Math.round(tgt / a * 100));
  }
  if (tgt <= 0) return a > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(a / tgt * 100)));
}
// مؤشرات منطبقة على مسمى الموظف (فارغة jobTitles ⇒ للجميع)
function roleKpisFor(org, emp) {
  const kpis = (org.roleKpis && org.roleKpis.length) ? org.roleKpis : defaultRoleKpis();
  return kpis.filter(k => !(k.jobTitles || []).length || (k.jobTitles || []).includes(emp.jobTitle || ''));
}
// درجة KPI بالدور لموظف/شهر (مُشتقّة): متوسط مرجّح لنسب التحقّق للمؤشرات المُدخَلة
function hrRoleKpiScore(org, ops, emp, ym) {
  const kpis = roleKpisFor(org, emp);
  const entry = (ops.hrKpiEntries || []).find(e => e.employeeId === emp.id && e.ym === ym) || null;
  const vals = (entry && entry.values) || {};
  let num = 0, den = 0; const items = [];
  kpis.forEach(k => {
    const w = Number(k.weight) || 0;
    const ach = kpiAchievement(vals[k.id], k.target, k.direction);
    items.push({ kpi: k, actual: vals[k.id], ach });
    if (ach != null && w > 0) { num += ach * w; den += w; }
  });
  return { score: den ? Math.round(num / den) : null, items, hasEntry: !!entry };
}

/* RoleKpi: نُقل إلى mods/hr/RoleKpi.jsx (تحميل كسول) */


/* ================= م6/§32 (v27.10) — تجميد الأداء الشهري + كشف التلاعب =================
   نموذج البيانات: ops.hrScoreSnapshots[] (CORE_COLS — مركزي فقط، لا تكتبه/تقرؤه أجهزة الفروع):
   { id, ym, createdAt, createdBy, createdByName, locked:true,
     meta:{ weightsEnabled, roleKpiEnabled, roleKpiWeight, weights },
     rows:[{ employeeId, employeeName, branchId, branchName, jobTitle, score, axes, st:{scheduled,onTime,late,absent,tasksExpected,tasksDone,manualPts,autoPts} }] }
   الغرض: تجميد درجة الأداء ومكوّناتها لحظة الاعتماد لقطةً ثابتة لا تُعاد حسابها؛ ومقارنة الحيّ بالمجمّد
   لكشف أي تغيّر رجعي في بيانات شهر مُعتمَد (منع التلاعب). التجميد يدوي مركزي؛ فكّ التجميد للمسؤول فقط بتدقيق.
   ======================================================================================= */
function frozenSnapshotFor(ops, ym) {
  return ((ops || {}).hrScoreSnapshots || []).find(s => s.ym === ym && s.locked) || null;
}

/* PerfSnap: نُقل إلى mods/hr/PerfSnap.jsx (تحميل كسول) */


// ===== م9 — تفصيل حضور موظف لفترة (مُشتقّ، لا يُخزَّن): أيام مجدولة، حضور، تأخير بالدقائق، غياب، انصراف مبكر =====
function hrAttendanceDetail(org, ops, emp, from, to) {
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const tolerance = Number(policies.lateToleranceMinutes) || 0;
  const td = today(); const cap = to < td ? to : td;
  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const parseHM = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const s = { scheduled: 0, present: 0, onTime: 0, late: 0, lateMinutes: 0, absent: 0, early: 0, earlyMinutes: 0, noCheckout: 0, unscheduledIns: 0,
    // v27.4 — حضور فعلي بلا اعتماد على الجدولة (يعمل حتى بلا ورديات مُعيَّنة)
    actualDays: 0, workedMinutes: 0, openDays: 0 };
  const seen = new Set();
  (ops.shiftAssignments || []).filter(a => a.empId === emp.id).forEach(a => {
    (a.shiftIds || []).forEach((sid, di) => {
      if (!sid) return;
      const ds = addDays(a.weekStart, di);
      if (ds < from || ds > cap || seen.has(ds)) return;
      seen.add(ds); s.scheduled++;
      const tpl = (ops.shiftTemplates || []).find(t => t.id === sid);
      const evs = (ops.attendanceEvents || []).filter(ev => ev.employeeId === emp.id && (ev.at || '').slice(0, 10) === ds).sort((x, y) => (x.at < y.at ? -1 : 1));
      const inEv = evs.find(ev => ev.type === 'in');
      if (!inEv) { if (ds < td) s.absent++; else s.scheduled--; return; }
      s.present++;
      const inMin = new Date(inEv.at).getHours() * 60 + new Date(inEv.at).getMinutes();
      const lateBy = tpl ? inMin - parseHM(tpl.startTime) - tolerance : 0;
      if (lateBy > 0) { s.late++; s.lateMinutes += lateBy; } else s.onTime++;
      const outs = evs.filter(ev => ev.type === 'out'); const outEv = outs[outs.length - 1];
      if (outEv && tpl) {
        const outMin = new Date(outEv.at).getHours() * 60 + new Date(outEv.at).getMinutes();
        const earlyBy = parseHM(tpl.endTime) - outMin - tolerance;
        if (earlyBy > 0) { s.early++; s.earlyMinutes += earlyBy; }
      } else if (!outEv && ds < td) s.noCheckout++;
    });
  });
  // v27.4 — الحضور الفعلي: يُحسب من البصمات مباشرة لكل يوم (بلا حاجة لوردية مُعيَّنة)
  //   actualDays = أيام بها بصمة دخول، workedMinutes = مجموع (آخر خروج − أول دخول) لكل يوم، openDays = دخول بلا خروج
  const byDay = {};
  (ops.attendanceEvents || []).filter(ev => ev.employeeId === emp.id && (ev.at || '').slice(0, 10) >= from && (ev.at || '').slice(0, 10) <= cap)
    .forEach(ev => { const ds = (ev.at || '').slice(0, 10); (byDay[ds] = byDay[ds] || []).push(ev); });
  Object.keys(byDay).forEach(ds => {
    const evs = byDay[ds].sort((a, b) => (a.at < b.at ? -1 : 1));
    const firstIn = evs.find(e => e.type === 'in');
    if (!firstIn) return;                         // يوم بلا دخول لا يُعدّ حضورًا
    s.actualDays++;
    if (!seen.has(ds)) s.unscheduledIns++;        // دخول في يوم غير مجدول (معلوماتي)
    const outs = evs.filter(e => e.type === 'out'); const lastOut = outs[outs.length - 1];
    if (lastOut && lastOut.at > firstIn.at) { const mins = Math.round((new Date(lastOut.at) - new Date(firstIn.at)) / 60000); if (mins > 0) s.workedMinutes += mins; }
    else s.openDays++;                            // دخول بلا انصراف (فعلي)
  });
  return s;
}

/* HrDashboard: نُقل إلى mods/hr/HrDashboard.jsx (تحميل كسول) */

/* ================= م10 (v27.0) — التوقيع الإلكتروني: إقرارات استلام الراتب وإشعارات المكافآت/الجزاءات =================
   نموذج البيانات: ops.hrSignDocs[] — ضمن BR_COLS (مستند الفرع) كي يقرأه ويكتبه جهاز الفرع، ويقرأه المركز:
   { id, branchId, branchName, employeeId, employeeName, docType:'payslip'|'reward'|'penalty', month, refId, title, amount,
     lines:{base,allow,bonus,gross,draws,cuts,gEmp,net} (القسيمة فقط), reason, issuedAt, issuedBy, issuedByName,
     status:'pending'|'signed'|'voided', signedAt, signedVia:'branch_kiosk'|'central', signedOnBy, signedOnByName,
     pinVerified, witnessName, sig:{w,h,s:[[x,y,x,y,…],…]} (مسارات متجهة مبسَّطة — لا صور), sigHash }
   الإصدار: المركز (تسجيل صرف الرواتب / اعتماد مكافأة أو جزاء). التوقيع: كشك الفرع بعد التحقق بـPIN، أو من المكتب.
   ============================================================================================================ */
const SIG_W = 400, SIG_H = 160;
const SIGN_DOC_AR = { payslip: 'إقرار استلام راتب', reward: 'إشعار مكافأة', penalty: 'إشعار جزاء', corrective: 'محضر إجراء تأديبي' };
const escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* v28.1 — حماية نوافذ الطباعة: كل HTML يُكتب في نافذة about:blank (ترث صلاحيات جلسة المستخدم) يُنقّى أولًا —
   تُحذف السكربتات والإطارات وخصائص الأحداث وروابط javascript:، فلا ينفّذ نصٌّ أدخله مستخدم (سبب فرق، اسم، ملاحظة) أي كود */
function safePrintHtml(html) {
  try {
    const doc = new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html');
    // noscript/noembed/noframes/xmp/template: تُحلَّل بشكل مختلف عند إعادة الكتابة (mXSS) — تُحذف كليًا.
    // animate/set (SVG): تستطيع تغيير href إلى javascript: بعد التنقية — تُحذف كذلك.
    doc.querySelectorAll('script,iframe,frame,frameset,object,embed,applet,base,form,link,meta[http-equiv],noscript,noembed,noframes,xmp,plaintext,template,animate,set,animateTransform,animateMotion').forEach(n => n.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(a => {
        const n = a.name.toLowerCase();
        const v = String(a.value || '').replace(/[\s -]+/g, '').toLowerCase();
        if (n.startsWith('on')) el.removeAttribute(a.name);
        else if (['src', 'href', 'xlink:href', 'action', 'formaction', 'srcset', 'background', 'poster', 'data'].includes(n)) {
          const ok = v === '' || v.startsWith('#') || v.startsWith('data:image/') || v.startsWith('https:') || v.startsWith('http:') || v.startsWith('blob:');
          if (!ok) el.removeAttribute(a.name);
        } else if (n === 'style' && /expression\(|javascript:|url\(/.test(v)) el.removeAttribute(a.name);
      });
    });
    return '<!doctype html>' + doc.documentElement.outerHTML;
  } catch (e) { return ''; }
}
(function installPrintGuard() {
  if (typeof window === 'undefined' || window.__rmsPrintGuard) return;
  window.__rmsPrintGuard = true;
  const nativeOpen = window.open;
  window.open = function (url, ...rest) {
    const w = nativeOpen.call(window, url, ...rest);
    try {
      if (w && (!url || url === 'about:blank')) {
        const d = w.document;
        const nativeWrite = d.write.bind(d);
        d.write = (...parts) => nativeWrite(safePrintHtml(parts.join('')));
        d.writeln = (...parts) => nativeWrite(safePrintHtml(parts.join('')));
      }
    } catch (e) { /* نافذة من أصل آخر — لا تعنينا */ }
    return w;
  };
})();

// تبسيط المسارات: تقريب لأعداد صحيحة داخل الإطار وإسقاط النقاط الأقرب من minDist إلى آخر نقطة محفوظة (تصغير الحجم المخزَّن بلا أثر مرئي)
function simplifySig(strokes, minDist) {
  const md = minDist == null ? 1.5 : minDist;
  const out = [];
  (strokes || []).forEach(pts => {
    const s = []; let lx = null, ly = null;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x = Math.round(Math.min(SIG_W, Math.max(0, Number(pts[i]) || 0))), y = Math.round(Math.min(SIG_H, Math.max(0, Number(pts[i + 1]) || 0)));
      const last = i + 2 >= pts.length;
      if (lx != null && !last && Math.hypot(x - lx, y - ly) < md) continue;
      s.push(x, y); lx = x; ly = y;
    }
    if (s.length >= 2) out.push(s);
  });
  return out;
}
const sigPoints = (sig) => ((sig && sig.s) || []).reduce((n, s) => n + Math.floor(s.length / 2), 0);
function sigPathD(sig) {
  return ((sig && sig.s) || []).map(pts => {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0] + ' ' + pts[1];
    if (pts.length < 4) return d + ' l0.5 0';   // نقطة مفردة تُرسم كنقطة
    for (let i = 2; i + 1 < pts.length; i += 2) d += ' L' + pts[i] + ' ' + pts[i + 1];
    return d;
  }).filter(Boolean).join(' ');
}
// SVG للطباعة/التصدير (نص) — والمكوّن SigView للعرض داخل التطبيق
function sigSvg(sig, opts) {
  const o = opts || {};
  if (!sigPoints(sig)) return '';
  const w = o.width || 160, W = sig.w || SIG_W, H = sig.h || SIG_H, h = Math.round(w * H / W);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + w + '" height="' + h + '" style="display:block;margin:0 auto"><path d="' + sigPathD(sig) + '" fill="none" stroke="' + (o.stroke || '#1b2a6b') + '" stroke-width="' + (o.sw || 3) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function SigView({ sig, width, style }) {
  if (!sigPoints(sig)) return <span style={{ color: 'var(--faint)' }}>—</span>;
  const w = width || 120, W = sig.w || SIG_W, H = sig.h || SIG_H;
  return <svg viewBox={'0 0 ' + W + ' ' + H} width={w} height={Math.round(w * H / W)} style={{ display: 'block', background: '#fff', borderRadius: 6, ...(style || {}) }}><path d={sigPathD(sig)} fill="none" stroke="#1b2a6b" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// قسائم الشهر: مستند إقرار لكل موظف صافيه > 0 لا يملك مستندًا لهذا الشهر بعد (idempotent — يُستدعى داخل mutator على أحدث نسخة)
function buildPayslipSignDocs(rows, month, existing, branches, me) {
  const has = new Set((existing || []).filter(d => d.docType === 'payslip' && d.month === month && d.status !== 'voided').map(d => d.employeeId));
  return (rows || []).filter(r => r.net > 0 && !has.has(r.e.id)).map(r => {
    const b = (branches || []).find(x => x.id === r.e.branchId) || {};
    return {
      id: uid('sg'), branchId: r.e.branchId || '', branchName: b.name || '', employeeId: r.e.id, employeeName: r.e.name,
      docType: 'payslip', month, refId: 'payout-' + month, title: 'إقرار استلام راتب شهر ' + month, amount: r.net,
      lines: { base: r.e.baseSalary || 0, allow: r.allow || 0, bonus: r.bonus || 0, ot: r.ot || 0, otHours: r.otHours || 0, gross: r.gross, draws: r.draws || 0, cuts: r.cuts || 0, gEmp: r.gEmp || 0, net: r.net },
      reason: '', issuedAt: nowISO(), issuedBy: me ? me.id : '', issuedByName: me ? me.name : '', status: 'pending',
      signedAt: '', signedVia: '', signedOnBy: '', signedOnByName: '', pinVerified: false, witnessName: '', sig: null, sigHash: ''
    };
  });
}
// إشعار بالعلم عند الاعتماد النهائي لمكافأة/جزاء (م8)
function rewardSignDoc(r, me) {
  return {
    id: uid('sg'), branchId: r.branchId || '', branchName: r.branchName || '', employeeId: r.employeeId, employeeName: r.employeeName,
    docType: r.kind === 'reward' ? 'reward' : 'penalty', month: r.month, refId: r.id, title: (r.kind === 'reward' ? 'إشعار مكافأة' : 'إشعار جزاء') + ' — شهر ' + r.month, amount: r.amount,
    lines: null, reason: r.reason || '', issuedAt: nowISO(), issuedBy: me ? me.id : '', issuedByName: me ? me.name : '', status: 'pending',
    signedAt: '', signedVia: '', signedOnBy: '', signedOnByName: '', pinVerified: false, witnessName: '', sig: null, sigHash: ''
  };
}
// نص الإقرار الذي يوقّعه الموظف
function signDeclaration(doc) {
  const m = money(doc.amount || 0);
  if (doc.docType === 'payslip') return 'أقرّ أنا ' + doc.employeeName + ' باستلام صافي راتبي عن شهر ' + doc.month + ' وقدره ' + m + ' ر.س بعد السلف والخصومات الموضّحة، وبأنه لا مطالبة لي عن هذا الشهر.';
  if (doc.docType === 'reward') return 'أقرّ أنا ' + doc.employeeName + ' بالعلم باعتماد مكافأة قدرها ' + m + ' ر.س تُضاف إلى راتب شهر ' + doc.month + (doc.reason ? ' — السبب: ' + doc.reason : '') + '.';
  if (doc.docType === 'corrective') return 'أقرّ أنا ' + doc.employeeName + ' بالعلم بالإجراء التأديبي: ' + (doc.reason || doc.title || '') + (doc.amount ? ' — بغرامة قدرها ' + m + ' ر.س تُخصم من راتب شهر ' + doc.month : '') + '، وقد أُبلِغتُ به واستُجوِبتُ، مع احتفاظي بحق التظلّم خلال المدة النظامية.';
  return 'أقرّ أنا ' + doc.employeeName + ' بالعلم بتوقيع جزاء قدره ' + m + ' ر.س يُخصم من راتب شهر ' + doc.month + (doc.reason ? ' — السبب: ' + doc.reason : '') + '، مع احتفاظي بحق التظلّم وفق النظام.';
}
// مستندات معلّقة تجاوزت مهلة التذكير (hrPolicies.signReminderDays) — لمركز التنبيهات
function overdueSignDocs(org, ops, branchIds, todayStr) {
  const pol = (org || {}).hrPolicies || {};
  const days = Math.max(0, Number(pol.signReminderDays != null ? pol.signReminderDays : defaultHrPolicies().signReminderDays) || 0);
  const d = new Date((todayStr || today()) + 'T00:00:00'); d.setDate(d.getDate() - days);
  const cutoff = isoD(d);
  return ((ops || {}).hrSignDocs || []).filter(x => x.status === 'pending' && (branchIds || []).includes(x.branchId) && (x.issuedAt || '').slice(0, 10) <= cutoff);
}
// كتلة التوقيع للطباعة (قسيمة الراتب، المسير، الإقرار)
function sigBlockHtml(doc, width) {
  if (!doc || doc.status !== 'signed' || !sigPoints(doc.sig)) return '';
  let when = ''; try { when = arDT(doc.signedAt); } catch { when = doc.signedAt || ''; }
  return '<div style="text-align:center">' + sigSvg(doc.sig, { width: width || 150 }) + '<div style="font-size:9.5px;color:#555;margin-top:2px">وُقِّع إلكترونيًا ' + escH(when) + (doc.pinVerified ? ' · تحقّق PIN' : (doc.witnessName ? ' · بحضور ' + escH(doc.witnessName) : '')) + (doc.sigHash ? ' · #' + escH(String(doc.sigHash).slice(0, 10)) : '') + '</div></div>';
}
// صفحة الإقرار A4 (للطباعة من السجل أو من شاشة الرواتب)
function signDocHtml(doc, showAmounts) {
  const L = doc.lines || {}; const m = (n) => money(n);
  let body = '';
  if (doc.docType === 'payslip') {
    body = showAmounts ? `<table><tbody>
      <tr><td>الراتب الأساسي</td><td class="n">${m(L.base)}</td></tr>
      <tr><td>البدلات</td><td class="n">${m(L.allow)}</td></tr>
      ${L.ot ? `<tr><td>عمل إضافي${L.otHours ? ' (' + L.otHours + ' ساعة)' : ''}</td><td class="n">${m(L.ot)}</td></tr>` : ''}
      ${L.bonus ? `<tr><td>مكافآت معتمدة</td><td class="n">${m(L.bonus)}</td></tr>` : ''}
      <tr><td>إجمالي الاستحقاق</td><td class="n">${m(L.gross)}</td></tr>
      <tr><td>السلف والسحوبات</td><td class="n neg">- ${m(L.draws)}</td></tr>
      <tr><td>الخصومات والجزاءات</td><td class="n neg">- ${m(L.cuts)}</td></tr>
      ${L.gEmp ? `<tr><td>التأمينات الاجتماعية (حصة الموظف)</td><td class="n neg">- ${m(L.gEmp)}</td></tr>` : ''}
      <tr class="tot"><td>صافي المستلم</td><td class="n">${m(L.net)}</td></tr></tbody></table>`
      : `<table><tbody><tr><td>شهر الراتب</td><td class="n">${escH(doc.month)}</td></tr><tr><td>صافي المستلم</td><td class="n">${m(doc.amount)}</td></tr></tbody></table>`;
  } else {
    body = doc.docType === 'corrective'
      ? `<table><tbody><tr><td>الإجراء</td><td>${escH(doc.title || 'محضر إجراء تأديبي')}</td></tr>${doc.amount ? `<tr><td>الغرامة</td><td class="n">${m(doc.amount)}</td></tr>` : ''}<tr><td>الشهر</td><td class="n">${escH(doc.month)}</td></tr><tr><td>البيان</td><td>${escH(doc.reason) || '—'}</td></tr></tbody></table>`
      : `<table><tbody><tr><td>النوع</td><td>${SIGN_DOC_AR[doc.docType] || ''}</td></tr><tr><td>المبلغ</td><td class="n">${m(doc.amount)}</td></tr><tr><td>شهر الراتب</td><td class="n">${escH(doc.month)}</td></tr><tr><td>السبب</td><td>${escH(doc.reason) || '—'}</td></tr></tbody></table>`;
  }
  const signed = doc.status === 'signed';
  const sigPart = signed
    ? `<div style="display:flex;justify-content:space-around;margin-top:24px;align-items:flex-end"><div style="text-align:center"><div style="font-size:11px;color:#555;margin-bottom:4px">توقيع الموظف</div>${sigBlockHtml(doc, 170)}</div><div class="sign" style="margin-top:0"><div>${escH(doc.witnessName ? 'الشاهد: ' + doc.witnessName : 'المحاسب / الإدارة')}</div></div></div>`
    : `<div class="sign"><div>توقيع الموظف</div><div>المحاسب / الإدارة</div></div>`;
  return `<div class="box"><b>${escH(doc.employeeName)}</b>${doc.branchName ? ' · ' + escH(doc.branchName) : ''} · رقم المستند ${escH(doc.id)}<br>أُصدر ${escH((doc.issuedAt || '').slice(0, 10))}${doc.issuedByName ? ' بواسطة ' + escH(doc.issuedByName) : ''} · الحالة: ${signed ? 'موقَّع إلكترونيًا' : doc.status === 'voided' ? 'مُلغى' : 'بانتظار التوقيع'}</div>
  ${body}
  <div class="box" style="margin-top:12px;font-size:12.5px;line-height:1.9">${escH(signDeclaration(doc))}</div>
  ${sigPart}`;
}

// لوحة التوقيع: قلم/لمس/فأرة عبر Pointer Events — الرسم على canvas للاستجابة الفورية، والمسارات تُخزَّن بإحداثيات منطقية SIG_W×SIG_H
/* HrSignPad: نُقل إلى mods/hr/HrSignPad.jsx (تحميل كسول) */

// نافذة التوقيع: تحقّق PIN مرة واحدة (أو بحضور مستخدم مركزي) ثم التوقيع على كل مستند معلّق للموظف على التوالي
/* SignDocsModal: نُقل إلى mods/hr/SignDocsModal.jsx (تحميل كسول) */

// شاشة «التوقيع الإلكتروني»: كشك الفرع (كل الأدوار) + سجل الإقرارات وتقرير الحالة (غير الكاشير) + إلغاء المعلّق (المركز)
/* ESign: نُقل إلى mods/hr/ESign.jsx (تحميل كسول) */

function AdvanceForm({ emps, org, me, commit, say, onClose }) {
  const [f, setF] = useState({ employeeId: emps[0]?.id || '', date: today(), type: 'advance', amount: 0, reason: '', paymentMethod: 'cash', isUnjustified: false });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const emp = emps.find(e => e.id === f.employeeId);

  const save = async () => {
    if (!emp) return say('اختر الموظف', 'no');
    if (f.amount <= 0) return say('أدخل مبلغاً صحيحاً', 'no');
    if (!f.reason.trim()) return say('اكتب سبب السلفة أو الخصم', 'no');
    if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
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
/* Reports: نُقل إلى mods/acct/Reports.jsx (تحميل كسول) */

/* ================= الفروع والمستخدمون ================= */
/* ============ إدارة تطبيقات التوصيل ============ */
/* DeliveryAppsPanel: نُقل إلى mods/admin/DeliveryAppsPanel.jsx (تحميل كسول) */

/* Admin: نُقل إلى mods/admin/Admin.jsx (تحميل كسول) */

// مسودة فرع جديد بالقيم الافتراضية — مشتركة بين «الفروع والمستخدمون» ووحدة تقييم العملاء
const newBranchDraft = () => ({ id: uid('b'), name: '', city: '', managerName: '', phone: '', defaultFloat: 1500, shiftEndTime: '02:00', isActive: true });

/* BranchForm: نُقل إلى mods/admin/BranchForm.jsx (تحميل كسول) */

/* UserForm: نُقل إلى mods/admin/UserForm.jsx (تحميل كسول) */

/* ================= سجل التدقيق ================= */
function AuditView({ pulse, onSeen }) {
  const [q, setQ] = useState('');
  useEffect(() => { onSeen && onSeen(); }, []);
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
                  <td><span className={'badge ' + (ROLES[l.userRole] || ROLES.cashier).badge}>{(ROLES[l.userRole] || ROLES.cashier).ar.split('—')[0]}</span></td>
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

/* ================= طباعة تقارير الإغلاق ================= */

// بناء محتوى تقرير A4 رسمي مطابق للنموذج المعتمد
function buildClosingA4(c, org) {
  const co = org.company || {};
  const branch = (org.branches || []).find(b => b.id === c.branchId);
  const headLogo = (branch && branch.logoUrl) || co.logoUrl || '';
  const money2 = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dels = (c.deliverySales || []);
  const delComm = (d) => (d.commissionAmount != null ? d.commissionAmount : (d.amount * (d.commissionPercentage || 0) / 100));
  const statusAr = c.gmApprovalStatus === 'approved' ? 'معتمد نهائياً'
    : c.status === 'approved' ? 'مدقّق — بانتظار الاعتماد'
    : c.status === 'submitted' ? 'بانتظار الاعتماد' : 'مسودة';
  const varClass = c.variance === 0 ? 'ok' : c.variance < 0 ? 'bad' : 'warn';
  const varText = c.variance === 0 ? 'مطابق (0.00)' : c.variance < 0 ? 'عجز ' + money2(Math.abs(c.variance)) : 'فائض ' + money2(c.variance);

  const delRows = dels.length ? `<tr class="subhead"><td colspan="4">مبيعات تطبيقات التوصيل (${dels.length} تطبيقات)</td></tr>` +
    dels.map(d => `<tr>
    <td>تطبيق: ${d.appName || '—'}</td>
    <td class="num">${money2(d.amount)}</td>
    <td class="num dim">-${money2(delComm(d))}</td>
    <td class="num dim">${d.orderCount || 0} طلب</td></tr>`).join('') : '';

  const payLbl = (pm) => ({cash:'نقداً',card:'شبكة',cheque:'شيك',bank_transfer:'تحويل',deferred:'آجل'})[pm] || pm;
  // سداد الموردين خلال الوردية — يظهر في التقرير حتى تكتمل معادلة الصندوق أمام المدقق
  const supPaysArr = (c.supplierPayments || []).filter(pm => payTotal(pm) > 0);
  const supPayRows = supPaysArr.map(pm => `<tr>
    <td>${pm.supplierName || '—'}</td>
    <td class="dim">${payLabel(pm) || '—'}</td>
    <td class="dim">${pm.reference || '—'}</td>
    <td class="num">${money2(payTotal(pm))} ر.س</td></tr>`).join('');
  const supPaySum = supPaysArr.reduce((s, pm) => s + payTotal(pm), 0);
  const supPayCash = supPaysArr.reduce((s, pm) => s + payCashPart(pm), 0);
  const expRows = (c.expenses || []).length ? (c.expenses || []).map(e => `<tr>
    <td>${e.categoryName || '—'}${e.isTaxable ? '<br><span style="font-size:8px;color:#8C6F2C">خاضع للضريبة' + (e.taxInvoice ? ' · فاتورة ضريبية' : '') + '</span>' : '<br><span style="font-size:8px;color:#999">غير خاضع</span>'}</td>
    <td class="dim">${e.beneficiaryName || '—'}</td>
    <td>${payLbl(e.paymentMethod)}${e.receiptNumber ? '<br><span style="font-size:8px;color:#999">' + e.receiptNumber + '</span>' : ''}</td>
    <td class="ce">${e.receiptImage ? '<span class="chip">مرفق ✓</span>' : '—'}</td>
    <td class="num rose">${money2(e.amount)} ر.س</td></tr>`).join('')
    : `<tr><td colspan="5" class="ce dim">لا توجد مصروفات على هذه الوردية</td></tr>`;

  // v16.5: مرفقات PDF لا تُوضع في <img> (تظهر مكسورة) — تُذكر عدّاً في التقرير وتُفتح من المنصة
  const allAtt = [];
  if (c.cardReceiptImage) allAtt.push({ t: 'إثبات الشبكة / التحويل', u: c.cardReceiptImage });
  (c.expenses || []).forEach(e => { if (e.receiptImage) allAtt.push({ t: (e.categoryName || 'مصروف') + (e.beneficiaryName ? ' — ' + e.beneficiaryName : ''), u: e.receiptImage }); });
  ((c.sessionPhotos && c.sessionPhotos.length) ? c.sessionPhotos : (c.sessionPhoto ? [c.sessionPhoto] : []))
    .forEach((u, i, arr) => allAtt.push({ t: 'توثيق المسؤول' + (arr.length > 1 ? ' ' + (i + 1) : ''), u }));
  const isPdfU = (v) => typeof v === 'string' && v.indexOf('data:application/pdf') === 0;
  const receiptImgs = allAtt.filter(im => !isPdfU(im.u));
  const pdfAtts = allAtt.filter(im => isPdfU(im.u));
  const imgsBlock = (receiptImgs.length || pdfAtts.length) ? `
    <div class="sec-h">صور الفواتير والمرفقات (${allAtt.length})</div>
    ${receiptImgs.length ? `<div class="imgs">${receiptImgs.map(im => `<div class="img-c"><img src="${im.u}"><div class="img-t">${im.t}</div></div>`).join('')}</div>` : ''}
    ${pdfAtts.length ? `<div style="font-size:9.5px;color:#666;margin-top:4px">📎 مرفقات PDF (${pdfAtts.length}): ${pdfAtts.map(x => x.t).join(' · ')} — تُفتح من شاشة استعراض الإغلاق في المنصة.</div>` : ''}` : '';

  return `<div class="page">
    <div class="head">
      <div class="co">
        ${headLogo ? `<img class="logo" src="${headLogo}">` :MZ_LOGO_HTML}
        <div>
          <div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div>
        </div>
      </div>
      <div class="doc-title">تقرير الإغلاق اليومي الرسمي</div>
      <div class="doc-sub">فرع ${c.branchName} · ${arDate(c.date)}</div>
      <div class="doc-sub dim">تاريخ التصدير: ${arDT(new Date())}</div>
    </div>

    <div class="summary-card">
      <div class="summary-h">📊 التلخيص المالي — تقرير إغلاق يومي</div>
      <div class="summary-grid">
        <div class="sc"><span>إجمالي المبيعات</span><b class="mint">${money2(c.totalRevenue)} ر.س</b></div>
        <div class="sc"><span>إجمالي المصروفات</span><b class="rose">${money2(c.totalExpenses)} ر.س</b></div>
        <div class="sc"><span>عمولات منصات التوصيل</span><b class="warn2">${money2(sum(dels, d => delComm(d)))} ر.س</b></div>
        <div class="sc"><span>صافي الأرباح التشغيلية</span><b class="mint">${money2(c.totalRevenue - c.totalExpenses)} ر.س</b></div>
        <div class="sc"><span>صور الفواتير المرفقة</span><b class="brass">${receiptImgs.length} صور</b></div>
      </div>
    </div>

    <div class="banner">
      <div class="banner-r">
        <div class="banner-id">تقرير الإغلاق اليومي #${c.id || c.transferReferenceNo || ''}</div>
        <div class="banner-sub">التاريخ: ${arDate(c.date)}${c.transferReferenceNo ? ' · سند: ' + c.transferReferenceNo : ''}</div>
      </div>
      <div class="banner-l">
        <div>الفرع: <b>${c.branchName}</b> · المسؤول: <b>${c.managerName}</b></div>
        <span class="banner-badge">${statusAr}</span>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><span>إجمالي الإيرادات</span><b class="brass">${money2(c.totalRevenue)} ر.س</b></div>
      <div class="kpi"><span>إجمالي المصروفات</span><b class="rose">${money2(c.totalExpenses)} ر.س</b></div>
      <div class="kpi"><span>عمولات التوصيل</span><b>${money2(sum(dels, d => d.commissionAmount || 0))} ر.س</b></div>
      <div class="kpi"><span>صافي اليوم التشغيلي</span><b class="mint">${money2(c.totalRevenue - c.totalExpenses)} ر.س</b></div>
      <div class="kpi"><span>المحوّل للخزينة</span><b>${money2(c.transferredToMainTreasury)} ر.س</b></div>
      <div class="kpi ${varClass}"><span>مطابقة الصندوق</span><b>${varText}</b></div>
    </div>

    <div class="meta-row">
      <span class="badge">${statusAr}</span>
      <span>المسؤول: ${c.managerName}</span>
      <span>سند التحويل: ${c.transferReferenceNo || '—'}</span>
    </div>

    <div class="sec-h">تفاصيل المبيعات والإيرادات</div>
    <table class="t">
      <thead><tr><th>نوع الإيراد / الوسيلة</th><th class="num">المبلغ (ر.س)</th><th class="num">العمولة</th><th class="num">التفاصيل</th></tr></thead>
      <tbody>
        <tr><td>الرصيد الافتتاحي للعهدة</td><td class="num">${money2(c.openingBalance)}</td><td class="num dim">—</td><td class="num dim">افتتاح الصندوق</td></tr>
        <tr><td>المبيعات النقدية (Cash)</td><td class="num">${money2(c.cashSales)}</td><td class="num dim">—</td><td class="num dim">محصّل كاش</td></tr>
        <tr><td>مبيعات الشبكة (مدى/POS)</td><td class="num">${money2(c.cardSales)}</td><td class="num dim">—</td><td class="num dim">نقاط البيع</td></tr>
        ${c.bankTransferSales ? `<tr><td>تحويل بنكي مباشر</td><td class="num">${money2(c.bankTransferSales)}</td><td class="num dim">—</td><td class="num dim">حساب بنكي</td></tr>` : ''}
        ${delRows}
      </tbody>
      <tfoot><tr class="tot"><td>إجمالي الإيرادات</td><td class="num brass">${money2(c.totalRevenue)}</td><td colspan="2"></td></tr></tfoot>
    </table>

    <div class="sec-h">المصروفات التشغيلية المخصومة</div>
    <table class="t">
      <thead><tr><th>التصنيف</th><th>المورد/المستفيد</th><th>طريقة الدفع</th><th class="ce">المرفقات</th><th class="num">المبلغ</th></tr></thead>
      <tbody>${expRows}</tbody>
      <tfoot><tr class="tot"><td colspan="4">إجمالي المصروفات التشغيلية</td><td class="num rose">${money2(c.totalExpenses)} ر.س</td></tr></tfoot>
    </table>

    ${supPaysArr.length ? `
    <div class="sec-h">سداد الموردين خلال الوردية</div>
    <table class="t">
      <thead><tr><th>المورد</th><th>توزيع الدفع</th><th>المرجع/الفاتورة</th><th class="num">المبلغ</th></tr></thead>
      <tbody>${supPayRows}</tbody>
      <tfoot><tr class="tot"><td colspan="3">إجمالي سداد الموردين — منه نقدًا من الصندوق ${money2(supPayCash)} ر.س</td><td class="num">${money2(supPaySum)} ر.س</td></tr></tfoot>
    </table>` : ''}

    <div class="sec-h">مطابقة الصندوق والعهدة</div>
    <table class="t compact">
      <tr><td>المتوقع بالصندوق (كاش)</td><td class="num">${money2(c.expectedCashInSafe)} ر.س</td></tr>
      <tr><td>العدّ الفعلي بالجرد</td><td class="num">${money2(c.actualCashCount)} ر.س</td></tr>
      <tr><td>العهدة المتبقية للغد</td><td class="num">${money2(c.retainedFloatForTomorrow)} ر.س</td></tr>
      <tr class="tot ${varClass}"><td>فارق الصندوق</td><td class="num">${varText}</td></tr>
    </table>
    ${c.varianceReason ? `<div class="note">سبب الفرق: ${c.varianceReason}</div>` : ''}
    ${imgsBlock}

    <div class="sigs">
      <div class="sig">
        <div class="sig-t">إعداد وتوقيع مسؤول الفرع</div>
        <div class="sig-r dim">${c.managerName}</div>
        ${c.managerSignature ? `<img class="sig-img" src="${c.managerSignature}">` : '<div class="sig-line"></div>'}
        <div class="sig-ok">${c.managerSignature ? '✔ توقيع رقمي موثّق' : ''}</div>
      </div>
      <div class="sig">
        <div class="sig-t">مراجعة الإدارة المالية</div>
        <div class="sig-r dim">قسم المحاسبة والمالية</div>
        <div class="sig-line"></div>
        <div class="sig-ok dim">التوقيع والختم</div>
      </div>
      <div class="sig">
        <div class="sig-t">اعتماد المدير العام</div>
        <div class="sig-r dim">المالك والمدير العام</div>
        <div class="sig-line"></div>
        <div class="sig-ok dim">الاعتماد النهائي</div>
      </div>
    </div>
    <div class="foot dim">تم تصدير هذا التقرير آلياً من منصة ميزان · ${co.name || ''}</div>
  </div>`;
}

// v32.4 — خط الأرقام في نوافذ الطباعة (عنوان كامل لأن نافذة الطباعة بلا عنوان أساس)
/* v33.2 — عارض التقارير داخل التطبيق: على الجوال والآيباد وتطبيق الشاشة الرئيسية كانت التقارير تُفتح في نافذة جديدة
   بلا زر رجوع فلا يُخرج منها إلا بإغلاق التطبيق. الآن تُعرض فوق المنصة بشريط «إغلاق · طباعة/PDF · مشاركة»،
   ويغلقها زر الرجوع أيضًا. على الكمبيوتر تبقى النافذة المنفصلة كما هي. */
const isStandaloneApp = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { return false; } };
const isIOSDev = () => { try { return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); } catch { return false; } };
const docInApp = () => { try { return isStandaloneApp() || isIOSDev() || /Android|Mobile/i.test(navigator.userAgent); } catch { return false; } };
/* ===== v35.7 — شعار ميزان في المطبوعات =====
   mzSvg: الشعار كنص SVG للمستندات المطبوعة (بلا اعتماد على CSS الصفحة).
   mzBrandDoc: يضيف توقيع «منصة ميزان» بالشعار في تذييل كل مستند (أو سطرًا صغيرًا إن لم يوجد تذييل) — مرة واحدة فقط. */
const mzSvg = (size, ink = '#1D1B18', gold = '#C9A24D', lines = true) => {
  const D = [[16, 16], [32, 16], [48, 16], [16, 32], [48, 32], [16, 48], [32, 48], [48, 48]];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="4 4 56 56" style="vertical-align:middle;flex-shrink:0">' +
    (lines ? '<g stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round" opacity=".45">' + D.map(([x, y]) => '<path d="M32 32L' + x + ' ' + y + '"/>').join('') + '</g>' : '') +
    '<g fill="' + ink + '">' + D.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="' + (lines ? 3.8 : 4.6) + '"/>').join('') + '</g><circle cx="32" cy="32" r="7" fill="' + gold + '"/></svg>';
};
const MZ_LOGO_HTML = '<span class="logo" style="display:inline-grid;place-items:center;background:#1F1C18;border-radius:8px">' + mzSvg(30, '#EFEAE1') + '</span>';
const mzBrandDoc = (html) => {
  html = String(html || '');
  if (html.includes('data-mzb')) return html;
  const sig = '<span data-mzb style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap">' + mzSvg(12, '#555', '#C9A24D', false) + 'منصة ميزان</span>';
  const bi = html.search(/<body[^>]*>/i);
  if (bi < 0) return html;
  const head = html.slice(0, bi), body = html.slice(bi);
  if (body.includes('منصة ميزان')) return head + body.replace(/منصة ميزان/g, sig);
  const foot = '<div data-mzb style="text-align:center;font-size:9px;color:#888;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:4px">' + mzSvg(11, '#888', '#C9A24D', false) + 'منصة ميزان</div>';
  return /<\/body>/i.test(body) ? head + body.replace(/<\/body>/i, foot + '</body>') : head + body + foot;
};
function openDocWin(features) {
  if (typeof document === 'undefined' || !docInApp()) {
    const rw = window.open('', '_blank', features); if (!rw) return null;
    let b = '';
    return { get closed() { return rw.closed; },
      document: { open() { b = ''; }, write(x) { b += String(x); }, close() { rw.document.open(); rw.document.write(mzBrandDoc(b)); rw.document.close(); } },
      focus() { rw.focus(); }, print() { rw.print(); }, close() { rw.close(); } };
  }
  let buf = '', t = null, closed = false;
  const box = document.createElement('div');
  box.setAttribute('dir', 'rtl'); box.className = 'mz-docv';
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px 10px;background:#241F1B;color:#fff;font-family:Tahoma,sans-serif;flex:0 0 auto';
  const mk = (txt, bg) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.style.cssText = 'border:0;border-radius:9px;padding:9px 14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;background:' + bg + ';color:' + (bg === '#C8A24A' ? '#1a1410' : '#fff'); bar.appendChild(b); return b; };
  const bClose = mk('✕ إغلاق', '#a33');
  const bPrint = mk('طباعة / PDF', '#C8A24A');
  const bShare = (navigator.share && typeof File !== 'undefined') ? mk('مشاركة', '#3b4a5a') : null;
  const ttl = document.createElement('div'); ttl.style.cssText = 'flex:1;text-align:start;font-size:12.5px;opacity:.85;overflow:hidden;white-space:nowrap;text-overflow:ellipsis'; bar.appendChild(ttl);
  const ifr = document.createElement('iframe'); ifr.style.cssText = 'flex:1;width:100%;border:0;background:#fff';
  box.appendChild(bar); box.appendChild(ifr); document.body.appendChild(box);
  const fit = () => { try { const d = ifr.contentDocument; if (!d) return; const de = d.documentElement; de.style.zoom = ''; const dw = de.scrollWidth, cw = ifr.clientWidth;
    if (dw > cw + 4) de.style.zoom = String(Math.max(0.35, cw / dw)); } catch { /* */ } };
  const render = () => { t = null; buf = mzBrandDoc(buf); ifr.srcdoc = buf; const m = /<title>([^<]*)<\/title>/i.exec(buf); ttl.textContent = m ? m[1] : ''; };
  ifr.addEventListener('load', fit);
  const close = () => { if (closed) return; closed = true; try { box.remove(); } catch { /* */ } window.removeEventListener('popstate', onPop); if (history.state && history.state.mzDoc) { try { history.back(); } catch { /* */ } } };
  const onPop = () => { if (!closed) { closed = true; try { box.remove(); } catch { /* */ } window.removeEventListener('popstate', onPop); } };
  try { history.pushState({ ...(history.state || {}), mzDoc: 1 }, ''); } catch { /* */ }
  window.addEventListener('popstate', onPop);
  bClose.onclick = close;
  bPrint.onclick = () => { printHtmlInPage(buf); };   // v34.13: طباعة داخل الصفحة — تعمل على الآيفون
  if (bShare) bShare.onclick = async () => { try { const f = new File([buf], (ttl.textContent || 'تقرير').replace(/[\\/:*?"<>|]/g, '-') + '.html', { type: 'text/html' });
    if (!navigator.canShare || navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: ttl.textContent || 'تقرير' }); } catch { /* أُلغيت المشاركة */ } };
  const fake = {
    get closed() { return closed; },
    document: { open() { buf = ''; }, write(x) { buf += String(x); if (!t) t = setTimeout(render, 0); }, close() { if (t) clearTimeout(t); render(); } },
    focus() { }, print() { /* على الجوال لا تُفتح الطباعة تلقائيًا — زر «طباعة / PDF» في الشريط */ }, close
  };
  return fake;
}
/* تنزيل الملفات (Excel/PDF) داخل تطبيق الآيفون المثبّت: الرابط المباشر يفتح الملف فوق التطبيق بلا رجوع،
   فنحوّله إلى لوحة المشاركة (حفظ في الملفات / إرسال) ويبقى المستخدم داخل المنصة. */
(() => { try {
  if (typeof window === 'undefined' || !isIOSDev() || !isStandaloneApp() || !navigator.share || typeof File === 'undefined') return;
  const blobs = new Map(); const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (o) => { const u = oc(o); if (o instanceof Blob) { blobs.set(u, o); if (blobs.size > 30) blobs.delete(blobs.keys().next().value); } return u; };
  const ac = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const b = blobs.get(this.href);
    if (b) { const ext = /pdf/.test(b.type) ? '.pdf' : /csv/.test(b.type) ? '.csv' : /sheet|excel/.test(b.type) ? '.xlsx' : '';
      const f = new File([b], this.download || ('ملف' + ext), { type: b.type || 'application/octet-stream' });
      if (!navigator.canShare || navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(() => { }); return; } }
    return ac.call(this);
  };
} catch { /* */ } })();

const NUM_FACE = (() => { try { const u = new URL('fonts/inter-latin.woff2', document.baseURI).href;
  return "@font-face{font-family:'MizanNum';src:url('" + u + "') format('woff2');font-weight:100 900;unicode-range:U+0030-0039,U+0025,U+0024,U+002B-002E,U+002F,U+003A,U+00D7,U+2212,U+2013}"; } catch { return ''; } })();
const A4_CSS = `
  ${NUM_FACE}
  @page { size: A4; margin: 12mm }
  * { box-sizing: border-box }
  body { font-family: 'MizanNum','IBM Plex Sans Arabic','Readex Pro',Tahoma,sans-serif; font-variant-numeric: tabular-nums; color: #1a1a1a; margin: 0; font-size: 11px; background: #fff }
  .page { max-width: 186mm; margin: 0 auto }
  .head { border-bottom: 2.5px solid #8C6F2C; padding-bottom: 10px; margin-bottom: 12px }
  .co { display: flex; align-items: center; gap: 10px; margin-bottom: 8px }
  .logo { height: 44px; width: 44px; object-fit: contain; border-radius: 8px }
  .co-n { font-size: 16px; font-weight: 700; color: #14110F }
  .co-m { font-size: 9.5px; color: #666; margin-top: 2px }
  .doc-title { font-size: 15px; font-weight: 700; color: #8C6F2C; margin-top: 6px }
  .doc-sub { font-size: 11px; margin-top: 2px }
  .dim { color: #888 }
  .kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; margin-bottom: 12px }
  .kpi { border: 1px solid #e5e0d5; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; background: #faf8f3 }
  .kpi span { font-size: 9px; color: #777 }
  .kpi b { font-size: 13px }
  .kpi.ok { background: #eef8f2; border-color: #b6e2cd } .kpi.ok b { color: #2E8B62 }
  .kpi.bad { background: #fdeeed; border-color: #f2c3bf } .kpi.bad b { color: #C0392B }
  .kpi.warn { background: #fdf6e9; border-color: #f2ddb0 } .kpi.warn b { color: #B7791F }
  .brass { color: #8C6F2C } .rose { color: #C0392B } .mint { color: #2E8B62 }
  .meta-row { display: flex; gap: 14px; align-items: center; font-size: 10.5px; color: #555; margin-bottom: 12px; flex-wrap: wrap }
  .badge { background: #8C6F2C; color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 600 }
  .sec-h { background: #f0ebe0; color: #14110F; font-weight: 700; font-size: 11.5px; padding: 5px 9px; border-radius: 5px; margin: 12px 0 7px }
  table.t { width: 100%; border-collapse: collapse; font-size: 10.5px }
  table.t th { background: #14110F; color: #fff; padding: 6px 8px; text-align: right; font-weight: 600; font-size: 10px }
  table.t th.num, table.t td.num { text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap }
  table.t th.ce, table.t td.ce { text-align: center }
  table.t td { padding: 6px 8px; border-bottom: 1px solid #eee }
  table.t tfoot .tot td { font-weight: 700; font-size: 11.5px; border-top: 2px solid #14110F; background: #faf8f3 }
  table.t.compact td { padding: 6px 9px }
  table.t .tot.ok { background: #eef8f2 } table.t .tot.bad { background: #fdeeed } table.t .tot.warn { background: #fdf6e9 }
  .chip { background: #eef8f2; color: #2E8B62; padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 600 }
  .note { font-size: 10px; color: #B7791F; margin-top: 6px; padding: 5px 9px; background: #fdf6e9; border-radius: 5px }
  .imgs { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 6px }
  .img-c { border: 1px solid #e5e0d5; border-radius: 6px; overflow: hidden }
  .img-c img { width: 100%; height: 90px; object-fit: cover; display: block }
  .img-t { font-size: 8.5px; padding: 4px 5px; color: #666; text-align: center }
  .sigs { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 18px }
  .sig { border: 1px solid #e5e0d5; border-radius: 8px; padding: 10px; text-align: center }
  .sig-t { font-size: 11px; font-weight: 700 }
  .sig-r { font-size: 9.5px; margin-top: 2px }
  .sig-img { max-width: 100%; height: 46px; object-fit: contain; margin: 6px auto }
  .sig-line { border-bottom: 1px dashed #999; margin: 22px 12px 6px }
  .sig-ok { font-size: 9.5px; color: #2E8B62; font-weight: 600; margin-top: 4px }
  .foot { text-align: center; font-size: 9px; margin-top: 16px; border-top: 1px dashed #ccc; padding-top: 8px }
  .summary-card { border: 1px solid #e5e0d5; border-radius: 10px; padding: 11px 14px; margin-bottom: 12px; background: #faf8f3 }
  .summary-h { font-size: 11.5px; font-weight: 700; color: #14110F; margin-bottom: 9px }
  .summary-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px }
  .sc { text-align: center } .sc span { font-size: 8.5px; color: #777; display: block } .sc b { font-size: 12.5px; display: block; margin-top: 3px }
  .warn2 { color: #B7791F }
  .banner { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #14110F; color: #EFE7DB; border-radius: 10px; padding: 11px 15px; margin-bottom: 12px; flex-wrap: wrap }
  .banner-id { font-family: 'MizanNum','IBM Plex Mono',ui-monospace,monospace; color: #E0C074; font-size: 12px; font-weight: 700; direction: ltr; text-align: left }
  .banner-sub { font-size: 9px; color: #A2968A; margin-top: 3px }
  .banner-l { text-align: end; font-size: 10px; color: #D9CFC0; display: flex; flex-direction: column; gap: 3px; align-items: flex-end }
  .banner-l b { color: #fff }
  .banner-badge { background: rgba(224,164,88,.22); color: #E0A458; padding: 2px 9px; border-radius: 10px; font-size: 9px; font-weight: 700 }
  table.t .subhead td { background: #f2edfa; color: #6b4fa0; font-weight: 700; font-size: 9.5px; padding: 5px 9px }
`;

function printClosingA4(c, org) {
  const w = openDocWin('width=880,height=1000');
  if (!w) return false;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>تقرير الإغلاق - ${c.branchName} - ${c.date}</title><style>${A4_CSS}</style></head>
    <body>${buildClosingA4(c, org)}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
  return true;
}

// طباعة حرارية 80مم بنفس ترتيب التقرير
function printReceipt(c, org, size) {
  const PG = size === '58' ? 58 : 80, W = size === '58' ? 48 : 74;
  const co = (org && org.company) || {};
  const branch = ((org && org.branches) || []).find(b => b.id === c.branchId);
  const thLogo = (branch && branch.logoUrl) || co.logoUrl || '';
  const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const line = (k, v) => `<tr><td>${k}</td><td class="v">${v}</td></tr>`;
  const dels = (c.deliverySales || []).filter(d => d.amount > 0)
    .map(d => line(`${d.appName} (${d.orderCount})`, m(d.amount))).join('');
  const exps = (c.expenses || []).map(e => line(`${e.categoryName}${e.receiptImage ? ' 📎' : ''}`, m(e.amount))).join('');
  const supPaysR = (c.supplierPayments || []).filter(pm => payTotal(pm) > 0);
  const paysR = supPaysR.map(pm => line(`${pm.supplierName || 'مورد'}${payLabel(pm) ? ' (' + payLabel(pm) + ')' : ''}`, m(payTotal(pm)))).join('');
  const paysSum = supPaysR.reduce((s, pm) => s + payTotal(pm), 0);
  const dens = DENOMS.filter(d => (c.denominationDetails?.[d.k] || 0) > 0)
    .map(d => line(`${d.k === 'coins' ? 'هللات' : d.v + ' ريال'} × ${c.denominationDetails[d.k]}`,
      m((c.denominationDetails[d.k] || 0) * d.v))).join('');
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <title>إيصال إغلاق ${c.branchName}</title><style>${NUM_FACE}
  @page{size:${PG}mm auto;margin:3mm}
  body{font-family:'MizanNum','IBM Plex Sans Arabic',Tahoma,sans-serif;width:${W}mm;margin:0 auto;color:#000;font-size:11px}
  h1{font-size:14px;text-align:center;margin:0 0 2px}
  .c{text-align:center;font-size:9.5px;color:#333}
  .sep{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 0;vertical-align:top}
  td.v{text-align:left;font-family:'MizanNum','IBM Plex Mono',monospace;white-space:nowrap}
  .sec{font-weight:700;font-size:11px;margin-top:6px;background:#eee;padding:2px 4px}
  .tot{font-weight:700;font-size:12px;border-top:1px solid #000;border-bottom:2.5px double #000;padding:3px 0}
  .stamp{border:2px solid #000;padding:5px;text-align:center;font-weight:700;margin-top:8px}
  </style></head><body>
  ${thLogo ? `<div class="c"><img src="${thLogo}" style="height:36px"></div>` : ''}
  <h1>${co.name || 'إيصال إغلاق'}</h1>
  <div class="c">تقرير إغلاق يومي</div>
  <div class="c">${c.branchName}</div>
  <div class="c">${arDate(c.date)} · ${c.managerName}</div>
  <div class="c">سند: ${c.transferReferenceNo || '—'}</div>
  <div class="sep"></div>
  <div class="sec">الإيرادات</div>
  <table>${line('عهدة افتتاحية', m(c.openingBalance))}${line('مبيعات نقدية', m(c.cashSales))}${line('مبيعات الشبكة', m(c.cardSales))}
  ${c.bankTransferSales ? line('تحويل بنكي', m(c.bankTransferSales)) : ''}${dels}</table>
  <table><tr class="tot"><td>إجمالي الإيراد</td><td class="v">${m(c.totalRevenue)}</td></tr></table>
  <div class="sec">المصروفات</div>
  <table>${exps || '<tr><td>لا مصروفات</td><td class="v">0.00</td></tr>'}
  <tr class="tot"><td>إجمالي المصروف</td><td class="v">${m(c.totalExpenses)}</td></tr></table>
  ${supPaysR.length ? `<div class="sec">سداد الموردين</div>
  <table>${paysR}<tr class="tot"><td>إجمالي السداد</td><td class="v">${m(paysSum)}</td></tr></table>` : ''}
  <div class="sec">مطابقة الصندوق</div>
  <table>${dens}${line('المتوقع', m(c.expectedCashInSafe))}${line('الفعلي', m(c.actualCashCount))}
  <tr class="tot"><td>الفرق</td><td class="v">${c.variance > 0 ? '+' : ''}${m(c.variance)}</td></tr></table>
  ${c.varianceReason ? `<div style="font-size:9.5px;margin-top:4px">السبب: ${c.varianceReason}</div>` : ''}
  <div class="sec">الترحيل</div>
  <table>${line('المرحّل للخزينة', m(c.transferredToMainTreasury))}${line('عهدة الغد', m(c.retainedFloatForTomorrow))}</table>
  <div class="stamp">${c.variance === 0 ? 'الصندوق مطابق ✓' : c.variance < 0 ? 'عجز: ' + m(Math.abs(c.variance)) : 'فائض: ' + m(c.variance)}</div>
  <div class="sep"></div>
  ${c.managerSignature ? `<div class="c"><img src="${c.managerSignature}" style="max-width:52mm"></div>` : ''}
  <div class="c">توقيع المسؤول: __________</div>
  <div class="c">أمين الخزينة: __________</div>
  <div class="c" style="margin-top:8px">${arDT(new Date())}</div>
  </body></html>`;
  const w = openDocWin('width=420,height=760');
  if (!w) return false;
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}

/* ================= الموردون والالتزامات الشهرية ================= */
/* Suppliers: نُقل إلى mods/inv/Suppliers.jsx (تحميل كسول) */

/* ================= دفتر الشركاء: طباعة كشف حساب A4 ================= */
function printPartnerStatement(p, org) {
  const w = openDocWin('width=900,height=1000');
  if (!w) return false;
  const co = org.company || {};
  const typeAr = { customer: 'عميل', supplier: 'مورد', employee: 'موظف' };
  let run = 0, sdr = 0, scr = 0;
  const rows = p.txns.map(t => {
    run += (t.credit || 0) - (t.debit || 0); sdr += t.debit || 0; scr += t.credit || 0;
    const rb = Math.abs(run) < 0.005 ? '0.00' : money(Math.abs(run)) + (run > 0 ? ' دائن' : ' مدين');
    return `<tr><td>${t.date || ''}</td><td>${t.desc || ''}${t.ref ? ' · ' + t.ref : ''}</td>
      <td class="n">${t.debit ? money(t.debit) : '—'}</td><td class="n">${t.credit ? money(t.credit) : '—'}</td><td class="n">${rb}</td></tr>`;
  }).join('');
  const bal = scr - sdr;
  const balT = Math.abs(bal) < 0.005 ? 'مسدّد' : (bal > 0 ? money(bal) + ' دائن (مستحق للطرف علينا)' : money(-bal) + ' مدين (مستحق لنا على الطرف)');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ${p.name}</title>
  <style>${NUM_FACE}*{font-family:'MizanNum','Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:28px;color:#1a1a1a}
  .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #8C6F2C;padding-bottom:12px;margin-bottom:16px}
  .co{font-size:20px;font-weight:800;color:#5a4a1e}.sub{font-size:12px;color:#666;margin-top:3px}
  .t{font-size:22px;font-weight:800}.who{background:#faf6ee;border:1px solid #e5dcc5;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.9}
  .who b{color:#5a4a1e}.bal{text-align:center;background:#f5f0e4;border:1px solid #d9cba5;border-radius:10px;padding:12px;margin-bottom:14px}
  .bal .v{font-size:26px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#efe8d8;color:#4a3f22;padding:8px;text-align:right;border:1px solid #d9cba5}
  td{padding:7px 8px;border:1px solid #e6ddc8}.n{text-align:left;font-variant-numeric:tabular-nums;direction:ltr}
  tfoot td{background:#f5f0e4;font-weight:800;border-top:2px solid #8C6F2C}
  .ft{margin-top:16px;font-size:10.5px;color:#888;text-align:center}</style></head><body>
  <div class="h"><div><div class="co">${co.name || 'الشركة'}</div><div class="sub">${co.activity || ''} ${co.taxNumber ? '· رقم ضريبي ' + co.taxNumber : ''}</div></div>
  <div style="text-align:left"><div class="t">كشف حساب</div><div class="sub">${arDate(today())}</div></div></div>
  <div class="who"><b>الطرف:</b> ${p.name} &nbsp; <span style="background:#eee;border-radius:5px;padding:1px 7px">${typeAr[p.type] || ''}</span> &nbsp; <b>الرقم:</b> ${p.code || '—'}<br>
  <b>التصنيف:</b> ${p.cat || '—'} &nbsp; <b>الجوال:</b> ${p.phone || '—'} &nbsp; <b>الرقم الضريبي/الهوية:</b> ${p.tax || '—'}</div>
  <div class="bal"><div>الرصيد الحالي</div><div class="v">${balT}</div></div>
  <table><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
  <tbody>${rows || '<tr><td colspan=5 style="text-align:center;color:#999;padding:20px">لا حركات</td></tr>'}</tbody>
  <tfoot><tr><td colspan="2">الإجماليات</td><td class="n">${money(sdr)}</td><td class="n">${money(scr)}</td><td class="n">${money(Math.abs(bal))}${bal > 0 ? ' دائن' : bal < 0 ? ' مدين' : ''}</td></tr></tfoot></table>
  <div class="ft">كشف حساب صادر من منصة ميزان — ${co.name || ''} · ${arDate(today())}</div></body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}

/* ================= v8.2: مساعد طباعة A4 موحّد بترويسة الشركة ================= */
function printA4(org, title, sub, bodyHtml) {
  const w = openDocWin('width=900,height=1000');
  if (!w) return false;
  const co = org.company || {};
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
  <style>${NUM_FACE}*{font-family:'MizanNum','Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:26px;color:#1a1a1a;font-size:12px}
  .h{display:flex;justify-content:space-between;border-bottom:2px solid #8C6F2C;padding-bottom:10px;margin-bottom:14px}
  .co{font-size:18px;font-weight:800;color:#5a4a1e}.sub{font-size:11px;color:#666;margin-top:2px}
  h1{font-size:16px;margin:0}table{width:100%;border-collapse:collapse;margin:8px 0}
  th{background:#efe8d8;color:#4a3f22;padding:7px;border:1px solid #d9cba5;text-align:right;font-size:11px}
  td{padding:6px 8px;border:1px solid #e6ddc8}.n{text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
  .tot td{background:#f5f0e4;font-weight:800;border-top:2px solid #8C6F2C}.neg{color:#C0392B}
  .box{background:#faf6ee;border:1px solid #e5dcc5;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:11.5px}
  .sign{display:flex;justify-content:space-around;margin-top:34px;text-align:center;font-size:11px}
  .sign div{border-top:1px solid #999;padding-top:6px;min-width:140px}
  .ft{margin-top:14px;font-size:10px;color:#888;text-align:center}</style></head><body>
  <div class="h"><div><div class="co">${co.name || 'الشركة'}</div><div class="sub">${co.taxNumber ? 'الرقم الضريبي: ' + co.taxNumber : ''}</div></div>
  <div style="text-align:left"><h1>${title}</h1><div class="sub">${sub || ''}</div></div></div>
  ${bodyHtml}
  <div class="ft">صادر من منصة ميزان — ${arDate(today())}</div></body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}

/* ================= دفتر الشركاء (عملاء/موردون/موظفون · مدين ودائن) ================= */
const PT_TYPE = { customer: { ar: 'عميل', c: '#5B93C4' }, supplier: { ar: 'مورد', c: '#E0A458' }, employee: { ar: 'موظف', c: '#9B7BB8' } };
const PT_SRC = {
  inv: { t: 'فاتورة', c: 'var(--amber)' }, close: { t: 'إغلاق فرع', c: 'var(--mint)' },
  adv: { t: 'سلفة/خصم', c: 'var(--violet)' }, salary: { t: 'رواتب', c: 'var(--sky)' },
  open: { t: 'افتتاحي', c: 'var(--faint)' }, manual: { t: 'يدوي', c: 'var(--sky)' },
  pay: { t: 'سداد', c: 'var(--mint)' }, si: { t: 'فاتورة مبيعات', c: 'var(--brass)' }
};

function PartnerChip({ type }) {
  const t = PT_TYPE[type] || PT_TYPE.customer;
  return <span className="badge" style={{ background: t.c + '28', color: t.c }}>{t.ar}</span>;
}
function BalCell({ bal }) {
  if (Math.abs(bal) < 0.005) return <span className="num" style={{ color: 'var(--faint)', fontWeight: 700 }}>مسدّد</span>;
  const cr = bal > 0;
  return <span><span className="num" style={{ color: cr ? 'var(--rose)' : 'var(--mint)', fontWeight: 700, fontSize: 14 }}>{money(Math.abs(bal))}</span>
    <span style={{ fontSize: 10, color: 'var(--faint)', marginInlineStart: 5 }}>{cr ? 'دائن · علينا' : 'مدين · لنا'}</span></span>;
}

/* ================= م4: المخزون والمنتجات — أصناف، حركات، جرد، وصفات ================= */
/* ============================================================
   v29.9 — المستودعات: رئيسي + مستودع لكل فرع (org.warehouses)
   • حركات المستودع الرئيسي: ops.stockMoves (المستند المركزي) — الحركات القديمة بلا whId تخص الرئيسي.
   • حركات مستودع الفرع: ops.whMoves (مستند الفرع) — يسجّلها موظفو الفرع لمستودع فرعهم فقط.
   • التحويلات: ops.whTransfers (مستند الفرع المستلم): طلب ← صرف (بضاعة في الطريق) ← استلام بالكميات الفعلية.
   • لكل مستودع حساب مخزون في الدليل (accCode ثابت مخزّن على المستودع) + حساب «بضاعة في الطريق» 1609.
   الأرصدة تُشتق حسابيًا من الحركات والتحويلات — لا أرصدة مخزّنة تتعارض.
   ============================================================ */
const MAIN_WH = 'wh-main';
const whOf = (org) => ((org && org.warehouses) || []).filter(w => w && w.active !== false);
const whOn = (org) => whOf(org).length > 0;
const whForBranch = (org, bId) => whOf(org).find(w => w.kind === 'branch' && w.branchId === bId);
const whName = (org, id) => (whOf(org).find(w => w.id === id) || {}).name || (id === MAIN_WH ? 'المستودع الرئيسي' : '—');
const q3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
// الأرصدة لكل مستودع + البضاعة في الطريق + الإجمالي. asOf (اختياري): الأرصدة كما في تاريخ (لقيد رسملة المخزون)
function stockByWh(org, ops, asOf) {
  const byWh = {}, transit = {}, total = {};
  const okD = (d) => !asOf || !d || String(d).slice(0, 10) <= asOf;
  const add = (w, it, q) => { if (!it || !q) return; const m = byWh[w] || (byWh[w] = {}); m[it] = (m[it] || 0) + q; total[it] = (total[it] || 0) + q; };
  (ops.stockMoves || []).forEach(m => { if (okD(m.date || m.at)) add(m.whId || MAIN_WH, m.itemId, Number(m.qty) || 0); });
  (ops.whMoves || []).forEach(m => { if (okD(m.date || m.at)) add(m.whId, m.itemId, Number(m.qty) || 0); });
  (ops.whTransfers || []).forEach(t => {
    if (t.status !== 'sent' && t.status !== 'received') return;
    if (!okD(t.sentDate)) return;
    // v30.1 — فرع إلى فرع: نسختان. «الصادرة» (مستند المرسِل) تخصم من مستودعه عند اعتماد المركز؛
    // «الواردة» (ينشئها المركز في مستند المستلم) بضاعة في الطريق حتى يستلمها — فلا يُحتسب شيء مرتين.
    if (t.kind === 'b2b') { (t.lines || []).forEach(l => add(t.fromWh, l.itemId, -(Number(l.qtySent) || 0))); return; }
    if (t.kind === 'b2b-in') {
      const rin = t.status === 'received' && okD(t.receivedDate);
      (t.lines || []).forEach(l => {
        const sq = Number(l.qtySent) || 0; if (!sq) return;
        if (rin) add(t.toWh, l.itemId, Number(l.qtyRecv) || 0);
        else { transit[l.itemId] = (transit[l.itemId] || 0) + sq; total[l.itemId] = (total[l.itemId] || 0) + sq; }
      });
      return;
    }
    const recvd = t.status === 'received' && okD(t.receivedDate);
    (t.lines || []).forEach(l => {
      const sq = Number(l.qtySent) || 0; if (!sq) return;
      add(t.fromWh || MAIN_WH, l.itemId, -sq);
      if (recvd) add(t.toWh, l.itemId, Number(l.qtyRecv) || 0);
      else { transit[l.itemId] = (transit[l.itemId] || 0) + sq; total[l.itemId] = (total[l.itemId] || 0) + sq; }
    });
  });
  return { byWh, transit, total };
}
/* v30.4 — أنواع الأصناف + المتوسط المرجّح + وحدات الشراء
   • النوع: استهلاكي (مواد خام ومستلزمات تُستهلك) · قابل للبيع (بضاعة تُباع كما هي) · خدمي (لا يُخزَّن — لا أرصدة ولا جرد).
   • وحدة الشراء: purchaseUnit + purchaseFactor (مثال: كرتون = 12 حبة) — الأرصدة دائمًا بالوحدة الأساسية unit.
   • التكلفة: المتوسط المرجّح على مستوى المنشأة — كل وارد بتكلفة (unitCost) يعيد حساب المتوسط، وكل صادر يخرج به.
     يُشتق بإعادة تشغيل الحركات زمنيًا (لا رقم مخزّن يتعارض). الحركات القديمة بلا تكلفة تُسعَّر بتكلفة الصنف المرجعية. */
const ITEM_TYPES = {
  stock: { ar: 'استهلاكي — مواد خام ومستلزمات تُستهلك', short: 'استهلاكي', c: 'b-sky' },
  sale: { ar: 'قابل للبيع — بضاعة تُباع كما هي', short: 'للبيع', c: 'b-mint' },
  service: { ar: 'خدمي — لا يُخزَّن (صيانة، نظافة، توصيل…)', short: 'خدمي', c: 'b-dim' }
};
const itemType = (it) => (it && ITEM_TYPES[it.type]) ? it.type : 'stock';
const isStocked = (it) => itemType(it) !== 'service';
const pFactor = (it) => Math.max(1, Number(it && it.purchaseFactor) || 1);
// v30.5 — دفتر التكلفة: يعيد تشغيل الحركات زمنيًا ويعطي لكل حدث متوسطه لحظة وقوعه (لقيود الجرد المستمر)
//   المفاتيح: 'sm:'+id (حركة الرئيسي) · 'wm:'+id (حركة فرع) · 'tx:'+تحويل+':'+سطر (تكلفة الوحدة لحظة الصرف)
function stockCosting(org, ops, asOf) {
  const items = org.items || [], byId = {}; items.forEach(it => { byId[it.id] = it; });
  const okD = (d) => !asOf || !d || String(d).slice(0, 10) <= asOf;
  const ev = [];
  const add = (key, m) => { if (!m || !m.itemId || !okD(m.date || m.at)) return; ev.push({ key, k: String(m.date || '').slice(0, 10) + '|' + String(m.at || ''), itemId: m.itemId, qty: Number(m.qty) || 0, kind: m.kind, unitCost: m.unitCost }); };
  (ops.stockMoves || []).forEach(m => add('sm:' + m.id, m)); (ops.whMoves || []).forEach(m => add('wm:' + m.id, m));
  (ops.whTransfers || []).forEach(t => {
    if (t.status !== 'sent' && t.status !== 'received') return;
    if (t.kind !== 'b2b-in') (t.lines || []).forEach((l, i) => add('tx:' + (t.kind === 'b2b' ? t.id : t.id) + ':' + i, { itemId: l.itemId, qty: 0, date: t.sentDate, at: t.sentAt || t.approvedAt || '' }));   // مسبار: متوسط لحظة الصرف
    if (t.status === 'received' && t.kind !== 'b2b') (t.lines || []).forEach(l => { const lost = (Number(l.qtySent) || 0) - (Number(l.qtyRecv) || 0); if (Math.abs(lost) > 0.0005) add('', { itemId: l.itemId, qty: -lost, date: t.receivedDate, at: t.receivedAt || '' }); });
  });
  ev.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
  const st = {}, at = {};
  ev.forEach(e => {
    const s = st[e.itemId] || (st[e.itemId] = { q: 0, a: null });
    const ref = Number((byId[e.itemId] || {}).cost) || 0;
    let c = e.unitCost != null && e.unitCost !== '' && Number.isFinite(Number(e.unitCost)) ? Number(e.unitCost) : null;
    if (c == null && e.qty > 0 && (e.kind === 'purchase' || e.kind === 'in')) c = ref;   // حركات قديمة بلا تكلفة
    if (e.qty > 0 && c != null) { s.a = (s.q <= 0 || s.a == null) ? c : (s.q * s.a + e.qty * c) / (s.q + e.qty); s.q += e.qty; if (e.key) at[e.key] = c; }
    else if (e.qty < 0 && e.kind === 'purchase' && c != null) {   // v30.9 مرتجع لمورد: يُخرج بتكلفة شرائه فيعدّل المتوسط
      const nq = s.q + e.qty; if (nq > 0.0005 && s.a != null) s.a = Math.max(0, (s.q * s.a + e.qty * c) / nq); s.q = nq; if (e.key) at[e.key] = c; }
    else { if (e.key) at[e.key] = s.a != null ? s.a : ref; s.q += e.qty; }   // صادر/تسوية/مسبار: بالمتوسط القائم
  });
  const avg = {};
  items.forEach(it => { const s = st[it.id]; avg[it.id] = (s && s.a != null) ? Math.round(s.a * 10000) / 10000 : (Number(it.cost) || 0); });
  return { avg, at };
}
function itemAvgCosts(org, ops, asOf) { return stockCosting(org, ops, asOf).avg; }

// v30.5 — أسعار الموردين: من بنود أوامر الشراء المستلمة (تكلفة الوحدة الأساسية) — مشتقة بلا تخزين
function supplierPrices(ops) {
  const out = {};
  (ops.purchaseOrders || []).forEach(po => (po.lines || []).forEach(l => {
    if (!l.itemId || !((Number(l.received) || 0) > 0) || !((Number(l.price) || 0) > 0)) return;
    const u = Math.round((Number(l.price) || 0) / (Number(l.factor) || 1) * 10000) / 10000;
    (out[l.itemId] = out[l.itemId] || []).push({ supplierId: po.supplierId, supplierName: po.supplierName, unitCost: u, date: po.date || (po.at || '').slice(0, 10), poNo: po.poNo });
  }));
  Object.values(out).forEach(a => a.sort((x, y) => String(y.date).localeCompare(String(x.date))));
  return out;
}
// v30.5 — دفعات الصلاحية: كل استلام بتاريخ انتهاء دفعة في مستودعه؛ الصادر من المستودع يستهلك الأقرب انتهاءً أولًا (FEFO)
function expiryLots(org, ops) {
  const lots = [], byWhItem = {};
  const inMoves = [...(ops.stockMoves || []).map(m => ({ ...m, whId: m.whId || MAIN_WH })), ...(ops.whMoves || [])];
  inMoves.filter(m => (Number(m.qty) || 0) > 0 && m.expiry).forEach(m => { const k = m.whId + '|' + m.itemId; const lot = { id: m.id, whId: m.whId, itemId: m.itemId, batch: m.batch || '', expiry: m.expiry, qty: Number(m.qty) || 0, left: Number(m.qty) || 0 }; lots.push(lot); (byWhItem[k] = byWhItem[k] || []).push(lot); });
  Object.values(byWhItem).forEach(a => a.sort((x, y) => String(x.expiry).localeCompare(String(y.expiry))));
  const SB = stockByWh(org, ops);
  // الرصيد الحالي للمستودع يُوزَّع على الدفعات الأحدث انتهاءً أولًا؛ ما زاد عنه استُهلك من الأقدم
  Object.entries(byWhItem).forEach(([k, a]) => { const [w, it] = k.split('|'); let have = Math.max(0, ((SB.byWh[w] || {})[it]) || 0);
    for (let i = a.length - 1; i >= 0; i--) { const t = Math.min(a[i].qty, have); a[i].left = Math.round(t * 1000) / 1000; have -= t; } });
  return lots.filter(l => l.left > 0.0005);
}

// رمز حساب مخزون جديد للمستودع: 160101، 160102… (ثابت على المستودع — لا يتغير بترتيب الفروع)
const nextWhAcc = (list) => { let n = 1; const used = new Set((list || []).map(w => String(w.accCode || ''))); while (used.has('1601' + String(n).padStart(2, '0'))) n++; return '1601' + String(n).padStart(2, '0'); };

/* v37.6 — معامل الناتج (Yield) لكل مكوّن: الكمية في الوصفة صافية (بعد التنظيف/الطهي)،
   والمستهلك من المخزون = الكمية ÷ الناتج. مثال: 0.25 كجم لحم مطبوخ بناتج 82% ⇒ 0.305 كجم نيء. */
const partYield = (pt) => { const y = Number(pt && pt.yield); return y > 0 && y < 100 ? y : 100; };
const partGross = (pt) => Math.round((Number(pt && pt.qty) || 0) / (partYield(pt) / 100) * 10000) / 10000;
const MOVE_KINDS = {
  purchase: { ar: 'توريد شراء', sign: 1, c: 'b-mint' },
  in: { ar: 'توريد يدوي', sign: 1, c: 'b-mint' },
  out: { ar: 'صرف للتشغيل', sign: -1, c: 'b-sky' },
  waste: { ar: 'هدر/إتلاف', sign: -1, c: 'b-rose' },
  adjust: { ar: 'تسوية جرد', sign: 1, c: 'b-amber' }
};
/* ============ v29.9 — لوحة المستودعات (المركز): الإعداد، الأرصدة، صرف التحويلات ============ */
const WH_ST = { requested: ['b-amber', 'مطلوب'], proposed: ['b-amber', 'بانتظار اعتماد المركز'], sent: ['b-sky', 'في الطريق'], received: ['b-mint', 'مُستلم'], cancelled: ['b-dim', 'ملغى'], rejected: ['b-rose', 'مرفوض'] };
const WH_KIND = { b2b: 'فرع ← فرع', return: 'إرجاع للرئيسي' };
function WhLines({ items, lines, setLines, field, max }) {
  return (
    <div className="grid" style={{ gap: 6 }}>
      {lines.map((l, i) => (
        <div key={i} className="row" style={{ gap: 6, alignItems: 'center' }}>
          <select className="inp sel" style={{ flex: 2 }} value={l.itemId} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, itemId: e.target.value } : x))}>
            <option value="">— الصنف —</option>
            {items.filter(it => it.isActive !== false).map(it => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
          </select>
          <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="الكمية" value={l[field] ?? ''}
            onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, [field]: e.target.value } : x))} />
          {max && l.itemId && <span style={{ fontSize: 10.5, color: 'var(--faint)', minWidth: 70 }}>المتاح {q3(max(l.itemId))}</span>}
          <button className="btn sm gh" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><X size={12} /></button>
        </div>
      ))}
      <button className="btn sm gh" style={{ alignSelf: 'flex-start' }} onClick={() => setLines(ls => [...ls, { itemId: '', [field]: '' }])}><Plus size={12} />سطر</button>
    </div>
  );
}

/* v31.4 — بطاقة الجرد الدوري المجدول: التكرار والنطاق + حالة كل مستودع */
/* CountScheduleCard: نُقل إلى mods/inv/CountScheduleCard.jsx (تحميل كسول) */

/* WarehousesPanel: نُقل إلى mods/inv/WarehousesPanel.jsx (تحميل كسول) */

/* ============ v29.9 — مستودع الفرع (موظفو الفرع): الاستلام، الطلب، الصرف للمطبخ، الهدر، الجرد ============ */
const WH_MOVE = { out: { ar: 'صرف للمطبخ', sign: -1, c: 'b-sky' }, waste: { ar: 'هدر/إتلاف', sign: -1, c: 'b-rose' }, adjust: { ar: 'تسوية جرد', sign: 1, c: 'b-amber' } };
/* ===== v37.5 — الجرد الأعمى بالاعتماد المزدوج =====
   1) العادّ يُدخل الكميات دون أن يرى الرصيد الدفتري ولا الفرق (عدّ أعمى).
   2) عند التسليم يُلتقط الرصيد الدفتري لحظتها؛ كل صنف فرقه فوق التسامح (قيمة ≥ الحد ونسبة ≥ الحد) يعود «لإعادة العدّ» أعمى أيضًا.
   3) لا يُرحَّل أي فرق حتى يعتمده شخص آخر غير العادّ/المعيد — عندها فقط تُسجَّل «تسوية جرد» بتاريخ العدّ.
   4) جرد يومي اختياري لأصناف الفئة A (الأعلى قيمة في المستودع). */
const countCfgOf = (org) => { const c = (org && org.countCfg) || {}; const n = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v))) ? d : Math.max(0, Number(v));
  return { tolPct: n(c.tolPct, 3), tolVal: n(c.tolVal, 25), dailyA: !!c.dailyA, aTop: Math.max(1, n(c.aTop, 5)), hideBook: c.hideBook !== false }; };
// v38.2 — الرصيد الدفتري لا يظهر لموظفي الفرع (من يعدّون) في أي شاشة — يرون حالة الصنف (يكفي/اطلب) لا الكمية
const bookHidden = (org, me) => countCfgOf(org).hideBook && (ROLES[me?.role] || {}).scope === 'own';
const canApproveCount = (me) => { const R = ROLES[me?.role] || {}; return !!(rolePost(me?.role) || R.approver || R.admin || me?.role === 'regional_manager' || me?.role === 'branch_manager'); };
// أصناف الفئة A في المستودع: الأعلى قيمة رصيدًا (بالمتوسط المرجّح)
function aItemsOf(org, ops, whId, SB, AVG) {
  SB = SB || stockByWh(org, ops); AVG = AVG || itemAvgCosts(org, ops);
  const bal = (whOn(org) ? SB.byWh[whId] : SB.total) || {};
  return (org.items || []).filter(it => isStocked(it) && it.isActive !== false).map(it => ({ id: it.id, v: Math.max(0, bal[it.id] || 0) * (AVG[it.id] || 0) }))
    .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, countCfgOf(org).aTop).map(x => x.id);
}
// جلسة جرد اليوم لأصناف A (أو جرد كامل) لمستودع — لتنبيه «جرد A اليوم»
const aCountDone = (ops, whId, d) => (ops.countSessions || []).some(s => (s.whId || MAIN_WH) === whId && s.date === d && s.status !== 'rejected');
const COUNT_ST = { recount: ['b-amber', 'إعادة عدّ مطلوبة'], submitted: ['b-sky', 'بانتظار الاعتماد'], approved: ['b-mint', 'معتمد'], rejected: ['b-rose', 'مرفوض'] };
/* BlindCount: نُقل إلى mods/inv/BlindCount.jsx (تحميل كسول) */
/* ===== v37.4 — ضبط الهدر =====
   • سبب منظّم إلزامي لكل هدر (لا نص حر فقط) — أساس تقرير الهدر حسب السبب والموظف.
   • قيمة الهدر = الكمية × المتوسط المرجّح لحظة التسجيل. فوق «حد الصورة» تُلزم صورة للتالف.
   • فوق «حد الاعتماد» لا يُرحَّل الهدر: يُحفظ طلبًا معلّقًا (wasteRequests) لا يمسّ الرصيد ولا القيود
     حتى يعتمده شخص آخر بصلاحية اعتماد (المركز/مدير إقليمي). مسؤول النظام وحده يعتمد طلبه ويُوسم «اعتماد ذاتي».
   • سقف يومي للهدر كنسبة من مبيعات الفرع — تجاوزه تنبيه في مركز التنبيهات. */
const WASTE_REASONS = { expired: 'منتهي الصلاحية', recv: 'تالف عند الاستلام', storage: 'تلف بالتخزين/التبريد', prep: 'خطأ تحضير', returned: 'مرتجع عميل', dropped: 'كسر أو سقوط', other: 'سبب آخر' };
const wasteCfg = (org) => { const c = (org && org.wasteCfg) || {}; const n = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v))) ? d : Math.max(0, Number(v));
  return { photoOver: n(c.photoOver, 50), approveOver: n(c.approveOver, 300), capPct: n(c.capPct, 2) }; };
const canApproveWaste = (me) => { const R = ROLES[me?.role] || {}; return !!(R.approver || R.admin || R.costCtl || me?.role === 'regional_manager'); };
const wasteReasonAr = (k) => WASTE_REASONS[k] || '—';
// قيمة هدر حركة مرحّلة: المسجّلة لحظتها، وإلا الكمية × المتوسط الحالي (حركات قبل v37.4)
const wasteValOf = (m, avg) => m.wasteVal != null ? Number(m.wasteVal) || 0 : Math.round(Math.abs(Number(m.qty) || 0) * ((avg || {})[m.itemId] || 0) * 100) / 100;
// كل الهدر المرحّل (رئيسي + فروع) بصيغة موحّدة
function wasteRows(org, ops, avg) {
  const brOfWh = (wid) => ((whOf(org).find(w => w.id === wid) || {}).branchId) || '';
  return [...(ops.stockMoves || []).map(m => ({ ...m, whId: m.whId || MAIN_WH, branchId: m.branchId || brOfWh(m.whId || MAIN_WH) })), ...(ops.whMoves || []).map(m => ({ ...m, branchId: m.branchId || brOfWh(m.whId) }))]
    .filter(m => m.kind === 'waste').map(m => ({ ...m, val: wasteValOf(m, avg) }));
}
// الهدر اليومي لكل فرع مقابل مبيعاته: [{branchId, date, waste, sales, pct}]
function wasteDaily(org, ops, avg, from, to) {
  const W = {};
  wasteRows(org, ops, avg).forEach(m => { const d = String(m.date || '').slice(0, 10); if (!m.branchId || d < from || d > to) return; const k = m.branchId + '|' + d; W[k] = Math.round(((W[k] || 0) + m.val) * 100) / 100; });
  return Object.entries(W).map(([k, w]) => { const [b, d] = k.split('|');
    const cl = (ops.closings || []).find(c => c.branchId === b && c.date === d && countedClosing(c));
    const sales = cl ? Number(cl.totalRevenue) || 0 : Number(salesDaySource(ops, b, d).total) || 0;
    return { branchId: b, date: d, waste: w, sales, pct: sales > 0 ? Math.round(w / sales * 10000) / 100 : null }; });
}
// حقول الهدر: السبب + البيان + صورة التالف (إلزامية فوق الحد) + قيمة الهدر وأثرها
/* WasteFields: نُقل إلى mods/inv/WasteFields.jsx (تحميل كسول) */
// تسجيل الهدر: يتحقق من السبب والصورة، ثم يرحّل الحركات أو يرفع طلب اعتماد
async function submitWaste({ org, me, commit, say, col, whId, branchId, lines, f, avg, title }) {
  const cfg = wasteCfg(org);
  const itN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || 'صنف';
  if (!f.reason || !WASTE_REASONS[f.reason]) { say('اختر سبب الهدر', 'no'); return false; }
  if (f.reason === 'other' && !String(f.note || '').trim()) { say('اكتب وصف السبب', 'no'); return false; }
  const L = lines.map(l => ({ itemId: l.itemId, qty: q3(l.qty), val: Math.round(q3(l.qty) * ((avg || {})[l.itemId] || 0) * 100) / 100 }));
  const value = Math.round(sum(L, l => l.val) * 100) / 100;
  if (cfg.photoOver > 0 && value >= cfg.photoOver && !f.photo) { say('قيمة الهدر ' + money(value) + ' — أرفق صورة التالف', 'no'); return false; }
  const base = { ...(whId ? { whId } : {}), ...(branchId ? { branchId } : {}), reason: f.reason, note: String(f.note || '').trim(), by: me.name, at: nowISO(), date: today() };
  const det = L.map(l => itN(l.itemId) + ' ' + l.qty).join('، ').slice(0, 140) + ' · ' + wasteReasonAr(f.reason) + ' · ' + money(value);
  if (cfg.approveOver > 0 && value >= cfg.approveOver) {
    const rec = { id: uid('wr'), col, ...base, lines: L, value, photo: f.photo || '', status: 'pending' };
    const ok = await commit(d => ({ ...d, wasteRequests: [rec, ...(d.wasteRequests || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, whId), title: 'طلب اعتماد هدر — ' + title, details: det });
    if (ok) say('أُرسل الهدر للاعتماد (' + money(value) + ') — لا يُخصم من الرصيد قبل الاعتماد');
    return !!ok;
  }
  const grp = uid('wg');
  const recs = L.map((l, i) => ({ id: uid(col === 'whMoves' ? 'wm' : 'sm'), ...base, itemId: l.itemId, kind: 'waste', qty: -l.qty, wasteVal: l.val, grp, ...(i === 0 && f.photo ? { photo: f.photo } : {}) }));
  const ok = await commit(d => ({ ...d, [col]: [...recs, ...(d[col] || [])] }),
    { actionType: 'create', targetType: 'stock_move', targetId: recs[0].id, branchName: whName(org, whId), title: 'هدر/إتلاف — ' + title, details: det });
  if (ok) say('سُجّل الهدر ✓');
  return !!ok;
}
// قائمة طلبات الهدر المعلّقة + الاعتماد/الرفض (شخص غير مقدّم الطلب)
/* WastePending: نُقل إلى mods/inv/WastePending.jsx (تحميل كسول) */
// v37.8 — تنبيهات أسعار الشراء (اطّلاع): بنود أوامر شراء تجاوزت متوسط آخر 3 مشتريات، وأصناف ارتفع آخر سعر لها
/* PriceAlerts: نُقل إلى mods/inv/PriceAlerts.jsx (تحميل كسول) */
// شاشة «ضبط الهدر» (المركز): الإعداد، الطلبات المعلّقة، الهدر حسب السبب والموظف والفرع، وأيام تجاوز السقف
/* WasteControl: نُقل إلى mods/inv/WasteControl.jsx (تحميل كسول) */
/* BranchWarehouse: نُقل إلى mods/inv/BranchWarehouse.jsx (تحميل كسول) */

/* ============================================================
   v31.1 — الاستهلاك النظري مقابل الفعلي (كشف الهدر)
   النظري = كميات المنتجات المبيعة × وصفاتها. الفعلي = ما خرج من المستودع في الفترة: صرف للمطبخ + هدر مسجّل + عجز الجرد.
   الفرق لكل صنف بالكمية والقيمة (بالمتوسط المرجّح) مع حد تسامح، ونسبة تكلفة الطعام النظرية والفعلية.
   ============================================================ */
const _normName = (s) => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
function usageReport(org, ops, wid, from, to) {
  const items = org.items || [], products = org.products || [];
  const whs = whOf(org), useWh = whs.length > 0;
  const w = useWh ? whs.find(x => x.id === wid) : null;
  const branches = (org.branches || []).filter(b => b.isActive !== false);
  const served = !useWh ? branches.map(b => b.id) : (w && w.kind === 'branch') ? [w.branchId] : branches.filter(b => !whForBranch(org, b.id)).map(b => b.id);
  const inP = (d) => { d = String(d || '').slice(0, 10); return d >= from && d <= to; };
  // v33.0: فروع نقطة البيع تُحتسب كمياتها الفعلية من فواتيرها (بدل الاستيراد اليدوي)
  const posOs = (ops.posOrders || []).filter(o => served.includes(o.branchId) && o.status !== 'void' && o.date >= from && o.date <= to);
  const posBr = new Set(posOs.map(o => o.branchId));
  const recs = (ops.productSales || []).filter(r => served.includes(r.branchId) && !posBr.has(r.branchId) && r.from >= from && r.to <= to);
  const partial = (ops.productSales || []).filter(r => served.includes(r.branchId) && !(r.from >= from && r.to <= to) && r.to >= from && r.from <= to);
  const pQty = {}; recs.forEach(r => (r.lines || []).forEach(l => { pQty[l.productId] = (pQty[l.productId] || 0) + (Number(l.qty) || 0); }));
  posOs.forEach(o => (o.lines || []).forEach(l => { if (l.productId) pQty[l.productId] = (pQty[l.productId] || 0) + (Number(l.qty) || 0); }));
  const theo = {}; let revenue = 0;
  const tax = org.taxCfg || {}; const netOf = (p) => tax.enabled ? p / (1 + (Number(tax.rate) || 15) / 100) : p;
  Object.entries(pQty).forEach(([pid, q]) => { const pr = products.find(x => x.id === pid); if (!pr) return; revenue += q * netOf(Number(pr.sellPrice) || 0);
    (pr.parts || []).forEach(pt => { theo[pt.itemId] = (theo[pt.itemId] || 0) + q * partGross(pt); }); });   // v37.6 بالناتج
  const mv = useWh ? (w && w.kind === 'branch' ? (ops.whMoves || []).filter(m => m.whId === wid) : (ops.stockMoves || []).filter(m => (m.whId || MAIN_WH) === wid)) : (ops.stockMoves || []);
  const act = {}; const add = (id, k, v) => { const a = act[id] || (act[id] = { out: 0, waste: 0, count: 0 }); a[k] += v; };
  mv.filter(m => inP(m.date)).forEach(m => { const q = Number(m.qty) || 0;
    if (m.kind === 'out') add(m.itemId, 'out', -q); else if (m.kind === 'waste') add(m.itemId, 'waste', -q); else if (m.kind === 'adjust') add(m.itemId, 'count', -q); });
  const AVG = itemAvgCosts(org, ops, to);
  const ids = [...new Set([...Object.keys(theo), ...Object.keys(act)])];
  const r3 = (n) => Math.round(n * 1000) / 1000, r2 = (n) => Math.round(n * 100) / 100;
  const rows = ids.map(id => { const it = items.find(x => x.id === id) || { name: 'صنف محذوف', unit: '' }; const a = act[id] || { out: 0, waste: 0, count: 0 };
    const t = r3(theo[id] || 0), actual = r3(a.out + a.waste + a.count), c = AVG[id] || Number(it.cost) || 0, dq = r3(actual - t);
    return { id, name: it.name, unit: it.unit, theo: t, out: r3(a.out), waste: r3(a.waste), count: r3(a.count), actual, dq, dv: r2(dq * c), pct: t > 0 ? Math.round(dq / t * 1000) / 10 : null, cost: c, theoV: r2(t * c), actV: r2(actual * c) };
  }).sort((x, y) => Math.abs(y.dv) - Math.abs(x.dv));
  const noRecipe = Object.keys(pQty).filter(pid => { const pr = products.find(x => x.id === pid); return !pr || !(pr.parts || []).length; });
  return { rows, served, recs: [...recs, ...(posOs.length ? [{ pos: true }] : [])], posN: posOs.length, partial, revenue: r2(revenue), theoV: r2(rows.reduce((a, r) => a + r.theoV, 0)), actV: r2(rows.reduce((a, r) => a + r.actV, 0)), pQty, noRecipe };
}
/* UsageVariance: نُقل إلى mods/inv/UsageVariance.jsx (تحميل كسول) */

/* Inventory: نُقل إلى mods/inv/Inventory.jsx (تحميل كسول) */

/* ================= مركز تطبيقات ERP — بوابة وحدات النظام (v7.6) ================= */
function AppsStrip({ me, setTab, openAcctView, openInvView }) {
  // شريط ERP Home: المفضلة وآخر المستخدَم — يظهر أعلى لوحة المؤشرات
  const u = appUseGet(me.id);
  const can = (a) => a && appCanSee(me, a) && !a.soon;
  const favs = (u.fav || []).map(id => LAUNCH_IX[id] || REG_IX[id]).filter(can).slice(0, 5);
  const recs = Object.entries(u.rec || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([id]) => LAUNCH_IX[id] || REG_IX[id]).filter(can).filter(a => !favs.includes(a)).slice(0, 3);
  return (
    <div className="appstrip">
      {favs.map(a => (
        <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}>
          <span className="st">⭐</span>{a.ar}
        </button>
      ))}
      {recs.map(a => (
        <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}>
          <Clock size={11} />{a.ar}
        </button>
      ))}
      <button className="appchip" style={{ borderColor: 'var(--frame)', color: 'var(--brass-l)' }} onClick={() => setTab('apps')}>
        <Grid3x3 size={12} />فتح التطبيقات
      </button>
    </div>
  );
}

// ألوان التصنيفات لواجهة التطبيقات (Launcher) — v9.1
const CAT_CLR = {
  fin: 'var(--brass)', pos: 'var(--mint)', pur: 'var(--sky)', hr: 'var(--violet)',
  tax: 'var(--amber)', inv2: '#C87E4A', ast: '#C4756B', gov: '#7E93B5', bi: '#5FAE9E'
};

/* ===== v35.5 — أيقونات التطبيقات المتحركة (نموذج B + حالات C) =====
   رموز SVG مرسومة يدويًا، كل رمز يؤدي حركة قصيرة من عالمه عند المرور/اللمس (.go)، ويتحرك باستمرار
   فقط إذا كانت هناك حالة حقيقية تستحق الانتباه (.live). تُعطّل كليًا مع «تقليل الحركة». */
/* ===== v35.6 — شعار ميزان «الفروع التسعة» =====
   ثماني نقاط حول مركز ذهبي، متصلة به: إدارة مالية واحدة لكل الفروع. اللون يتبع currentColor، والمركز بلون --mz-c.
   بحجم ≤ 24 تُحذف الخطوط ليبقى الرمز مقروءًا في الأحجام الصغيرة. anim: حركة افتتاحية (تظهر النقاط ثم تُرسم الخطوط). */
const MZ_DOTS = [[16, 16], [32, 16], [48, 16], [16, 32], [48, 32], [16, 48], [32, 48], [48, 48]];
function MizanMark({ size = 28, anim = false, className = '' }) {
  const small = size <= 24;
  return (
    <svg className={'mzm' + (anim ? ' mz-in' : '') + (className ? ' ' + className : '')} width={size} height={size} viewBox="4 4 56 56" aria-hidden="true">
      {!small && MZ_DOTS.map(([x, y], i) => <path key={'l' + i} className="mzm-l" pathLength="1" d={'M32 32L' + x + ' ' + y} style={{ '--d': i }} />)}
      {MZ_DOTS.map(([x, y], i) => <circle key={'d' + i} className="mzm-d" cx={x} cy={y} r={small ? 4.6 : 3.8} style={{ '--d': i }} />)}
      <circle className="mzm-c" cx="32" cy="32" r={small ? 7.5 : 7} />
    </svg>
  );
}
const APP_GLYPH = {
  pos: '<g class="p-rcpt"><path d="M8.5 10V3.5h7V10"/><path d="M10.5 5.6h3M10.5 7.4h2"/></g><path class="bgf" d="M4 9.5h16l1 9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 13.5h.01M10.5 13.5h.01M14 13.5h.01M7 16.8h10"/>',
  closing: '<rect x="5.5" y="4" width="13" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path class="p-draw" pathLength="1" d="M8.8 13l2.3 2.3 4.4-4.6"/>',
  approve: '<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/><path class="p-draw" pathLength="1" d="M8.8 12l2.3 2.3 4.4-4.6"/>',
  sales: '<g class="p-flip"><circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2.1-.5-2.6-1.4M12 6.3v11.4"/></g>',
  analytics: '<circle cx="12" cy="12" r="9"/><g class="p-swing"><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/></g>',
  alerts: '<g class="p-ring"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M12 3v2"/></g><path class="p-clap" d="M10 20.5a2 2 0 0 0 4 0"/>',
  reporting: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path class="p-bar" d="M9 18v-3"/><path class="p-bar b2" d="M12 18v-5.5"/><path class="p-bar b3" d="M15 18v-2"/>',
  acct: '<path d="M12 4.5V20M8 20h8"/><g class="p-tilt"><path d="M4.5 7h15"/><path d="M4.5 7l-2.3 5.6a2.4 2.4 0 0 0 4.6 0z"/><path d="M19.5 7l-2.3 5.6a2.4 2.4 0 0 0 4.6 0z"/></g><circle cx="12" cy="4.5" r="1.2"/>',
  vat: '<path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><g class="p-pop"><circle cx="9.8" cy="9" r="1.1"/><circle cx="14.2" cy="14" r="1.1"/><path d="M14.6 8.4l-5.2 6.2"/></g>',
  purchasing: '<path class="p-speed" d="M.5 9.5h2M0 12.5h2.5"/><g class="p-drive"><path d="M3.5 6h10.5v10H3.5z"/><path d="M14 9.5h4l3 3V16h-7"/><circle class="bgf" cx="7.5" cy="17.2" r="1.9"/><circle class="bgf" cx="17" cy="17.2" r="1.9"/></g>',
  inv: '<path d="M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5"/><path d="M9.5 13.5h5"/><g class="p-lid"><path d="M3 5.5h18v4H3z"/></g>',
  whbranch: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><g class="p-lid"><path d="M9.5 16h5"/></g>',
  hrops: '<path d="M12 4a8 8 0 0 1 8 8M4 12a8 8 0 0 1 4-6.9M7.4 20A12 12 0 0 1 7 12a5 5 0 0 1 10 0c0 2 0 4-.5 6M12 12c0 3 .5 6 2 8M10 7.6A4.5 4.5 0 0 1 12 7"/><path class="p-scan" d="M3 12h18"/>',
  hrperf: '<path d="M4 4v16h16"/><path class="p-draw" pathLength="1" d="M7.5 15.5l4-4 3 3 4.8-6"/><path class="p-pop" d="M15.5 8.5h3.8v3.8"/>',
  qrfb: '<path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4z"/><path d="M15 15h2v2h-2zM19.5 19.5h.5M18 15h2M15 19.5h1.5"/><path class="p-scan" d="M2.5 12h19"/>',
  partners: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><g class="p-peek"><circle cx="17" cy="9" r="2.6"/><path d="M15.6 14.2a4.5 4.5 0 0 1 5.4 4.4"/></g>',
  docs: '<g class="p-stamp"><path d="M9.5 3h5v4l-1.3 3h-2.4L9.5 7z"/><path d="M5 12.5h14v3H5z"/></g><path class="p-mark" d="M7 20h10" stroke-width="2.6"/>',
  people: '<g class="p-card"><rect x="6.5" y="3.5" width="11" height="6" rx="1"/></g><path class="bgf" d="M3 7.5h16a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16.5 13.8h.01"/>',
  brmgmt: '<g class="p-spin"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.5v2.9M12 18.6v2.9M2.5 12h2.9M18.6 12h2.9M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/></g>',
  shifts: '<circle cx="12" cy="12" r="9"/><g class="p-spin"><path d="M12 7v5l3 2"/></g>',
  audit: '<g class="p-blink"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></g>',
  backup: '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><g class="p-drop"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/></g>'
};
// v36.8: بطاقة «الموارد البشرية» الموحّدة — بطاقة هوية موظف
APP_GLYPH.hrops = APP_GLYPH.people = APP_GLYPH.hrperf = '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M9.5 3v3.5h5V3"/><circle cx="12" cy="11.3" r="2.4"/><path class="p-draw" pathLength="1" d="M8 17.3a4 4 0 0 1 8 0"/>';
// v35.6: نمط «الرسم» — كل خط في الرمز يُعاد رسمه بالقلم عند المرور/اللمس (pathLength موحّد = 1)
const agDraw = (g) => g.replace(/<(path|rect|circle)(?![^>]*pathLength)/g, '<$1 pathLength="1"');
const glyphGo = (el) => { const b = el && el.querySelector && el.querySelector('.lh-box'); if (!b) return; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); clearTimeout(b._gt); b._gt = setTimeout(() => b.classList.remove('go'), 2900); };
function AppGlyph({ a, size = 36 }) {
  const g = APP_GLYPH[a.id];
  if (!g) return <a.icon size={size} />;
  return <svg className="ag" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: agDraw(g) }} />;
}
// واجهة البداية بنمط شبكة التطبيقات (Odoo-style) — الشاشة الرئيسية v9.1
/* ===== v35.3 — لوحة «اليوم» أعلى الرئيسية =====
   أرقام حقيقية فقط من الإغلاقات المرحّلة/المعتمدة ونقطة البيع — بلا تقديرات.
   مبيعات الفرع اليوم: إغلاقه إن رُحّل، وإلا مبيعات نقطة البيع الحيّة (موسومة «مباشر»). */
const brCnt = (n) => n === 1 ? 'فرع واحد' : n === 2 ? 'فرعان' : n + (n >= 3 && n <= 10 ? ' فروع' : ' فرعًا');
const moneyP = (n) => (Number(n) || 0) < 0 ? '(' + money(-n) + ')' : money(n);
/* ===== v36.5 — التقرير الصباحي =====
   صفحة واحدة تلخّص يوم أمس (أو أي يوم) لفروع المستخدم: الإغلاقات والمبيعات مقابل نفس اليوم من الأسبوع السابق،
   فروقات الصناديق، ما ينتظر الاعتماد، فواتير الموردين المتأخرة والمستحقة خلال 7 أيام، تكلفة الطعام للشهر، وضريبة غير مسددة.
   أرقام حقيقية فقط بنفس منطق شاشاتها (المشتريات، تكلفة الطعام، الإقرار). طباعة/PDF ومشاركة نصية عبر واتساب. */
function morningData(org, ops, me, myBranches, scoped, day) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const R = ROLES[me.role] || {};
  const tabs = R.tabs || [];
  const can = (t) => tabs.includes(t) || (me.appAllow || []).some(id => (LAUNCH_IX[id]?.open?.tab) === t);
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  const ids = new Set(brs.map(b => b.id));
  const cls = (scoped?.closings || []);
  const counted = cls.filter(countedClosing);
  const wk = (() => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() - 7); return isoD(d); })();
  const rows = brs.map(b => {
    const bc = counted.filter(c => c.branchId === b.id && c.date === day);
    const prev = r2(sum(counted.filter(c => c.branchId === b.id && c.date === wk), c => c.totalRevenue));
    if (bc.length) return { b, st: 'closed', rev: r2(sum(bc, c => c.totalRevenue)), var: r2(sum(bc, c => c.variance)), exp: r2(sum(bc, c => c.totalExpenses)), prev, pend: bc.some(c => c.status === 'submitted') };
    const ps = salesDaySource(ops || {}, b.id, day);
    const dr = cls.some(c => c.branchId === b.id && c.date === day && c.status === 'draft');
    return { b, st: ps.n || ps.total ? 'pos' : dr ? 'draft' : 'none', rev: r2(ps.total || 0), var: 0, exp: 0, prev, pend: false };
  }).sort((x, y) => y.rev - x.rev);
  const revT = r2(sum(rows, r => r.rev)), prevT = r2(sum(rows, r => r.prev));
  const chg = prevT > 0.004 ? Math.round((revT - prevT) / prevT * 1000) / 10 : null;
  const varRows = rows.filter(r => r.st === 'closed' && Math.abs(r.var) >= 0.01);
  const dcf = deficitCfg(org); const bigRows = rows.filter(r => r.st === 'closed' && r.var < -dcf.max);
  const patterns = deficitPatterns(org, cls, [...ids], day);
  const notClosed = rows.filter(r => r.st !== 'closed');
  const pendL = cls.filter(c => c.status === 'submitted');
  const oldest = pendL.length ? pendL.map(c => c.date).sort()[0] : '';
  const ageDays = oldest ? Math.round((new Date(day + 'T00:00:00') - new Date(oldest + 'T00:00:00')) / 864e5) : 0;
  // الموردون — نفس منطق شاشة المشتريات (فواتير مخزّنة + فواتير الورديات الآجلة، ناقص كل السدادات والمرتجعات)
  let pay = null;
  if (can('purchasing')) {
    const central = R.scope !== 'own';
    const branchPaid = (invId) => sum(counted.flatMap(c => (c.supplierPayments || []).filter(pm => pm.invoiceId === invId)), payTotal);
    const alloc = {}; (ops.closingInvPays || []).forEach(x => (x.alloc || []).forEach(([id, v]) => { alloc[id] = (alloc[id] || 0) + (Number(v) || 0); }));
    const cnOf = (i) => sum((ops.invoices || []).filter(x => x.creditNote && x.appliesTo === i.id), x => -(x.amount || 0));
    const invRem = (i) => i.amount < 0 ? 0 : Math.max(0, r2(i.amount - ((i.paidAmount || 0) + branchPaid(i.id) + (alloc[i.id] || 0)) - cnOf(i)));
    const cPaid = (refId) => sum((ops.closingInvPays || []).filter(x => x.refId === refId), x => x.amount);
    const all = [
      ...(ops.invoices || []).filter(i => ids.has(i.branchId) || (!i.branchId && central)).map(i => ({ no: i.invoiceNo || '', sup: i.supplierName || '', due: i.dueDate || '', rem: invRem(i) })),
      ...closingInvoices(org, ops).filter(v => ids.has(v.branchId)).map(v => ({ no: v.invoiceNo || '', sup: v.supplierName || '', due: v.dueDate || '', rem: Math.max(0, r2(v.amount - cPaid(v.id))) }))
    ].filter(x => x.rem > 0.004);
    const in7 = (() => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + 7); return isoD(d); })();
    const over = all.filter(x => x.due && x.due < day).sort((a, b) => a.due.localeCompare(b.due));
    const soon = all.filter(x => x.due && x.due >= day && x.due <= in7).sort((a, b) => a.due.localeCompare(b.due));
    pay = { over, soon, overT: r2(sum(over, x => x.rem)), soonT: r2(sum(soon, x => x.rem)), openT: r2(sum(all, x => x.rem)) };
  }
  // تكلفة الطعام من أول الشهر حتى اليوم — نفس تصنيف قائمة الدخل، والهدف من لوحة المؤشرات
  let food = null, vat2302 = null;
  if (can('acct')) {
    const A = buildAccounting(org, ops);
    const from = day.slice(0, 8) + '01';
    const es = A.entries.filter(e => (e.date || '') >= from && (e.date || '') <= day && !e.closing);
    const agg = (list) => { const m = {}; list.forEach(e => e.lines.forEach(l => { const x = m[l.code] || (m[l.code] = { debit: 0, credit: 0 }); x.debit += l.debit; x.credit += l.credit; })); return m; };
    const bal = (a, m) => { const x = m[a.code]; if (!x) return 0; return (a.kind === 'asset' || a.kind === 'exp') ? x.debit - x.credit : x.credit - x.debit; };
    const fc = (list) => { const m = agg(list); const Y = isLayout(A.accounts, (a) => bal(a, m)); return { ns: Y.netSales, cogs: -Y.cogsT, pct: Y.netSales > 0.004 ? Math.round(-Y.cogsT / Y.netSales * 1000) / 10 : null }; };
    const tgt = Number(((org.scorecard || {}).targets || {}).food) || 30;
    const all = fc(es);
    const per = brs.map(b => ({ b, ...fc(es.filter(e => e.branchId === b.id)) })).filter(x => x.pct != null).sort((x, y) => y.pct - x.pct);
    food = { tgt, all, over: per.filter(x => x.cogs > 0.004 && x.pct > tgt), from };
    if ((org.taxCfg || {}).enabled) { let d = 0, c = 0; A.entries.forEach(e => e.lines.forEach(l => { if (l.code === '2302') { d += l.debit; c += l.credit; } })); vat2302 = r2(c - d); }
  }
  return { day, wk, rows, revT, prevT, chg, varRows, bigRows, patterns, dcf, notClosed, pendL, ageDays, approver: !!R.approver, pay, food, vat2302, brs };
}
const mbStAr = { closed: 'مُغلق', pos: 'غير مُغلق — مبيعات نقطة البيع', draft: 'مسودة لم تُرحَّل', none: 'لا إغلاق ولا مبيعات' };
function morningText(org, D) {
  const L = [];
  L.push('📋 التقرير الصباحي — ' + (org.company?.name || ''));
  L.push('ليوم ' + arDate(D.day));
  L.push('');
  L.push('💰 المبيعات: ' + money(D.revT) + (D.chg != null ? ' (' + (D.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(D.chg) + '% عن ' + arDate(D.wk) + ')' : ''));
  D.rows.forEach(r => L.push('• ' + r.b.name + ': ' + (r.st === 'none' ? '—' : money(r.rev)) + (r.st !== 'closed' ? ' ⚠️ ' + mbStAr[r.st] : '') + (Math.abs(r.var) >= 0.01 ? ' · ' + (r.var < -D.dcf.max ? '🚨 ' : '') + 'فرق ' + (r.var < 0 ? 'عجز ' : 'زيادة ') + money(Math.abs(r.var)) : '')));
  if (D.patterns.length) { L.push(''); D.patterns.forEach(x => L.push('🚨 عجز متكرر — ' + x.branchName + ': ' + x.n + ' حالات خلال ' + D.dcf.days + ' أيام بإجمالي ' + money(Math.abs(x.total)))); }
  if (D.approver && D.pendL.length) { L.push(''); L.push('⏳ بانتظار الاعتماد: ' + D.pendL.length + (D.ageDays > 1 ? ' (أقدمها منذ ' + D.ageDays + ' أيام)' : '')); }
  if (D.pay && (D.pay.over.length || D.pay.soon.length)) { L.push(''); L.push('🧾 الموردون: متأخر ' + money(D.pay.overT) + ' (' + D.pay.over.length + ') · مستحق خلال 7 أيام ' + money(D.pay.soonT) + ' (' + D.pay.soon.length + ')'); }
  if (D.food && D.food.all.pct != null) { L.push(''); L.push('🍽️ تكلفة الطعام للشهر: ' + D.food.all.pct + '% (الهدف ' + D.food.tgt + '%)' + (D.food.over.length ? ' · فوق الهدف: ' + D.food.over.map(x => x.b.name + ' ' + x.pct + '%').join('، ') : '')); }
  if (D.vat2302 != null && D.vat2302 > 0.004) { L.push(''); L.push('🏛️ ضريبة مستحقة غير مسددة: ' + money(D.vat2302)); }
  L.push(''); L.push('— منصة ميزان');
  return L.join('\n');
}
function morningHtml(org, D) {
  const co = org.company || {};
  const st = (r) => r.st === 'closed' ? (r.pend ? '<span class="chip" style="background:#fdf6e9;color:#B7791F">بانتظار الاعتماد</span>' : '<span class="chip">مُغلق</span>') : '<span class="chip" style="background:#fdeeed;color:#C0392B">' + mbStAr[r.st] + '</span>';
  const pct = (r) => r.prev > 0.004 ? ((r.rev - r.prev) / r.prev * 100) : null;
  const rows = D.rows.map(r => { const p = pct(r); return `<tr><td>${r.b.name}</td><td>${st(r)}</td><td class="num">${r.st === 'none' ? '—' : money(r.rev)}</td><td class="num">${r.prev ? money(r.prev) : '—'}</td><td class="num ${p == null ? '' : p >= 0 ? 'mint' : 'rose'}">${p == null ? '—' : (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p).toFixed(1) + '%'}</td><td class="num ${r.var < 0 ? 'rose' : ''}">${Math.abs(r.var) >= 0.01 ? (r.var < 0 ? '(' + money(-r.var) + ')' : money(r.var)) : '—'}</td></tr>`; }).join('');
  const k = (l, v, cls, s) => `<div class="kpi ${cls || ''}"><span>${l}</span><b>${v}</b>${s ? '<span>' + s + '</span>' : ''}</div>`;
  const varT = sum(D.varRows, r => r.var);
  const payT = D.pay ? `<div class="sec-h">الموردون</div><table class="t"><thead><tr><th>المورد</th><th>الفاتورة</th><th>الاستحقاق</th><th class="num">المتبقي</th></tr></thead><tbody>
    ${[...D.pay.over.map(x => ({ ...x, late: 1 })), ...D.pay.soon].slice(0, 15).map(x => `<tr><td>${x.sup}</td><td>${x.no}</td><td class="${x.late ? 'rose' : ''}">${arDate(x.due)}${x.late ? ' — متأخرة' : ''}</td><td class="num">${money(x.rem)}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">لا فواتير متأخرة أو مستحقة خلال 7 أيام</td></tr>'}
    </tbody></table>` : '';
  const foodT = D.food && D.food.all.pct != null ? `<div class="sec-h">تكلفة الطعام — من ${arDate(D.food.from)} حتى ${arDate(D.day)}</div>
    <div class="note" style="background:${D.food.all.pct > D.food.tgt ? '#fdeeed' : '#eef8f2'};color:${D.food.all.pct > D.food.tgt ? '#C0392B' : '#2E8B62'}">الشركة ${D.food.all.pct}% مقابل هدف ${D.food.tgt}%${D.food.over.length ? ' — فوق الهدف: ' + D.food.over.map(x => x.b.name + ' ' + x.pct + '%').join('، ') : ' — كل الفروع ضمن الهدف'}</div>` : '';
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>التقرير الصباحي — ${D.day}</title><style>${A4_CSS}</style></head><body><div class="page">
    <div class="head"><div class="co">${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` : MZ_LOGO_HTML}<div><div class="co-n">${co.name || ''}</div><div class="co-m">${D.brs.length} فرع</div></div></div>
    <div class="doc-title">التقرير الصباحي</div><div class="doc-sub">ليوم ${arDate(D.day)} · مقارنة بـ ${arDate(D.wk)}</div></div>
    <div class="kpis">${k('مبيعات اليوم', money(D.revT), '', D.chg != null ? (D.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(D.chg) + '% عن الأسبوع السابق' : '')}
      ${k('فروع لم تُغلق', D.notClosed.length + ' / ' + D.rows.length, D.notClosed.length ? 'warn' : 'ok', D.notClosed.map(r => r.b.name).join('، '))}
      ${k('فروقات الصناديق', Math.abs(varT) >= 0.01 ? (varT < 0 ? '(' + money(-varT) + ')' : money(varT)) : '0.00', varT < -0.004 ? 'bad' : 'ok', D.varRows.length + ' فرع')}</div>
    ${D.approver ? `<div class="kpis">${k('بانتظار اعتمادك', String(D.pendL.length), D.pendL.length ? 'warn' : 'ok', D.ageDays > 1 ? 'أقدمها منذ ' + D.ageDays + ' أيام' : '')}
      ${D.pay ? k('موردون متأخرون', money(D.pay.overT), D.pay.over.length ? 'bad' : 'ok', D.pay.over.length + ' فاتورة') + k('مستحق خلال 7 أيام', money(D.pay.soonT), '', D.pay.soon.length + ' فاتورة') : ''}</div>` : ''}
    <div class="sec-h">الفروع</div>
    <table class="t"><thead><tr><th>الفرع</th><th>الحالة</th><th class="num">المبيعات</th><th class="num">قبل أسبوع</th><th class="num">التغيّر</th><th class="num">فرق الصندوق</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td colspan="2">الإجمالي</td><td class="num">${money(D.revT)}</td><td class="num">${money(D.prevT)}</td><td class="num">${D.chg == null ? '—' : (D.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(D.chg) + '%'}</td><td class="num">${Math.abs(varT) >= 0.01 ? (varT < 0 ? '(' + money(-varT) + ')' : money(varT)) : '—'}</td></tr></tfoot></table>
    ${D.patterns.length || D.bigRows.length ? `<div class="sec-h" style="background:#fdeeed;color:#C0392B">تنبيهات العجز (الحد ${money(D.dcf.max)})</div>
      ${D.bigRows.map(r => `<div class="note" style="background:#fdeeed;color:#C0392B">${r.b.name}: عجز ${money(Math.abs(r.var))} تجاوز الحد</div>`).join('')}
      ${D.patterns.map(x => `<div class="note" style="background:#fdeeed;color:#C0392B">عجز متكرر — ${x.branchName}: ${x.n} حالات خلال ${D.dcf.days} أيام بإجمالي ${money(Math.abs(x.total))}</div>`).join('')}` : ''}
    ${payT}${foodT}
    ${D.vat2302 != null && D.vat2302 > 0.004 ? `<div class="note">ضريبة القيمة المضافة المستحقة غير المسددة (2302): ${money(D.vat2302)}</div>` : ''}
    <div class="foot dim" style="margin-top:14px;text-align:center;font-size:9.5px">تقرير آلي من منصة ميزان — الأرقام من الإغلاقات والقيود الفعلية</div>
  </div></body></html>`;
}
function MorningBrief({ org, ops, me, myBranches, scoped, setTab, onClose }) {
  const yd = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoD(d); })();
  const [day, setDay] = useState(yd);
  const D = useMemo(() => morningData(org, ops, me, myBranches, scoped, day), [org, ops, me, myBranches, scoped, day]);
  const print = () => { const w = openDocWin('width=900,height=1000'); if (!w) return; w.document.write(morningHtml(org, D)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch { } }, 400); };
  const wa = () => { const t = morningText(org, D); try { window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); } catch { } };
  const copy = async () => { try { await navigator.clipboard.writeText(morningText(org, D)); } catch { } };
  const varT = sum(D.varRows, r => r.var);
  const go = (t) => { onClose(); setTab(t); };
  return (
    <Modal title="التقرير الصباحي" sub={'ليوم ' + arDate(day) + ' · مقارنة بـ ' + arDate(D.wk)} icon={ClipboardCheck} onClose={onClose} wide
      foot={<div className="row" style={{ gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <button className="btn pri" onClick={print}><Printer size={14} />طباعة / PDF</button>
        <button className="btn" onClick={wa}><Send size={14} />مشاركة واتساب</button>
        <button className="btn gh" onClick={copy}><Copy size={14} />نسخ النص</button>
      </div>}>
      <div className="mb">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>اليوم</span>
          <input type="date" className="inp" style={{ width: 170 }} value={day} max={today()} onChange={e => e.target.value && setDay(e.target.value)} />
          {day !== yd && <button className="btn sm gh" onClick={() => setDay(yd)}>أمس</button>}
        </div>
        <div className="tdy-kpis">
          <div className="tdy-k"><span className="tdy-kl">المبيعات</span><span className="tdy-kv num">{money(D.revT)}</span>
            <span className={'tdy-ks' + (D.chg == null ? '' : D.chg >= 0 ? ' pos' : ' neg')}>{D.chg == null ? 'لا مقارنة' : (D.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(D.chg) + '% عن الأسبوع السابق'}</span></div>
          <div className="tdy-k"><span className="tdy-kl">فروع لم تُغلق</span><span className={'tdy-kv num' + (D.notClosed.length ? ' neg' : '')}>{D.notClosed.length}/{D.rows.length}</span>
            <span className="tdy-ks">{D.notClosed.length ? D.notClosed.map(r => r.b.name).slice(0, 3).join('، ') : 'كل الفروع أُغلقت ✓'}</span></div>
          <div className="tdy-k"><span className="tdy-kl">فروقات الصناديق</span><span className={'tdy-kv num' + (varT < -0.004 ? ' neg' : '')}>{Math.abs(varT) >= 0.01 ? moneyP(varT) : '0.00'}</span>
            <span className="tdy-ks">{D.varRows.length ? brCnt(D.varRows.length) + ' بفرق' : 'بلا فروقات'}</span></div>
          {D.approver && <div className="tdy-k" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => go('approve')}><span className="tdy-kl">بانتظار اعتمادك</span><span className="tdy-kv num">{D.pendL.length}</span>
            <span className={'tdy-ks' + (D.ageDays > 2 ? ' neg' : '')}>{D.pendL.length ? (D.ageDays > 1 ? 'أقدمها منذ ' + D.ageDays + ' أيام' : 'حديثة') : 'لا شيء معلّق'}</span></div>}
        </div>
        <div className="tdy-br">
          <div className="tdy-brh"><b>الفروع</b><small>مقارنة بنفس اليوم من الأسبوع السابق</small></div>
          {D.rows.map(r => { const p = r.prev > 0.004 ? Math.round((r.rev - r.prev) / r.prev * 1000) / 10 : null; return (
            <div key={r.b.id} className="tdy-bri mb-bri">
              <span className="tdy-brn">{r.b.name}</span>
              <span className={'tdy-st ' + (r.st === 'closed' ? (r.pend ? 'draft' : 'closed') : r.st === 'pos' ? 'live' : 'draft')}>{r.st === 'closed' ? (r.pend ? 'بانتظار الاعتماد' : 'مُغلق') : r.st === 'pos' ? 'غير مُغلق' : r.st === 'draft' ? 'مسودة' : 'لا إغلاق'}</span>
              {Math.abs(r.var) >= 0.01 && <span className={'mb-var num' + (r.var < 0 ? ' neg' : '') + (r.var < -D.dcf.max ? ' big' : '')}>{r.var < -D.dcf.max ? '🚨 ' : ''}{r.var < 0 ? 'عجز ' : 'زيادة '}{money(Math.abs(r.var))}</span>}
              <span className={'mb-chg num' + (p == null ? '' : p >= 0 ? ' pos' : ' neg')}>{p == null ? '' : (p >= 0 ? '▲' : '▼') + Math.abs(p) + '%'}</span>
              <span className="num tdy-brv">{r.st === 'none' ? '—' : money(r.rev)}</span>
            </div>); })}
        </div>
        {D.patterns.map(x => <div key={x.branchId} className="vck-i bad"><span>✗</span>عجز متكرر — {x.branchName}: {x.n} حالات خلال {D.dcf.days} أيام بإجمالي {money(Math.abs(x.total))} — راجع الكاشير والإجراءات</div>)}
        {D.pay && (D.pay.over.length > 0 || D.pay.soon.length > 0) && (
          <div className="tdy-br">
            <div className="tdy-brh"><b>الموردون</b><small>متأخر <span className="num">{money(D.pay.overT)}</span> · خلال 7 أيام <span className="num">{money(D.pay.soonT)}</span></small></div>
            {[...D.pay.over.map(x => ({ ...x, late: 1 })), ...D.pay.soon].slice(0, 8).map((x, i) => (
              <div key={i} className="tdy-bri"><span className="tdy-brn">{x.sup}<small style={{ color: 'var(--faint)', fontWeight: 400 }}> · {x.no}</small></span>
                <span className={'tdy-st ' + (x.late ? 'draft' : '')} style={x.late ? { color: 'var(--rose)', borderColor: 'color-mix(in srgb,var(--rose) 45%,transparent)' } : undefined}>{x.late ? 'متأخرة · ' : ''}{arDate(x.due)}</span>
                <span className="num tdy-brv">{money(x.rem)}</span></div>))}
            <button type="button" className="tdy-more" onClick={() => go('suppliers')}>فتح المشتريات</button>
          </div>)}
        {D.food && D.food.all.pct != null && (
          <div className={'vck-i ' + (D.food.all.pct > D.food.tgt ? 'bad' : 'ok')}><span>{D.food.all.pct > D.food.tgt ? '✗' : '✓'}</span>
            تكلفة الطعام للشهر حتى اليوم {D.food.all.pct}% مقابل هدف {D.food.tgt}%{D.food.over.length ? ' — فوق الهدف: ' + D.food.over.map(x => x.b.name + ' ' + x.pct + '%').join('، ') : ' — كل الفروع ضمن الهدف'}</div>)}
        {D.vat2302 != null && D.vat2302 > 0.004 && <div className="vck-i warn"><span>!</span>ضريبة القيمة المضافة المستحقة غير المسددة: {money(D.vat2302)}</div>}
      </div>
    </Modal>
  );
}

function TodayPanel({ org, ops, me, myBranches, scoped, setTab }) {
  const [mbOpen, setMbOpen] = useState(false);
  const [allBr, setAllBr] = useState(false);
  const R = ROLES[me.role] || {};
  const td = today();
  const yd = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoD(d); })();
  const w7 = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return isoD(d); })();
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  if (!brs.length) return null;
  const cls = (scoped?.closings || []);
  const counted = cls.filter(countedClosing);
  const rows = brs.map(b => {
    const bc = counted.filter(c => c.branchId === b.id && c.date === td);
    if (bc.length) return { b, v: sum(bc, c => c.totalRevenue), st: 'closed', var: sum(bc, c => c.variance) };
    const ps = salesDaySource(ops || {}, b.id, td);
    if (ps.n || ps.total) return { b, v: Number(ps.total) || 0, st: 'live', n: ps.n };
    const dr = cls.some(c => c.branchId === b.id && c.date === td && c.status === 'draft');
    return { b, v: 0, st: dr ? 'draft' : 'none' };
  }).sort((a, b) => b.v - a.v);
  const salesT = sum(rows, r => r.v);
  const salesY = sum(counted.filter(c => c.date === yd), c => c.totalRevenue);
  const closedN = rows.filter(r => r.st === 'closed').length;
  const varW = counted.filter(c => c.date >= w7);
  const varSum = sum(varW, c => c.variance);
  const shortBr = new Set(varW.filter(c => (Number(c.variance) || 0) < 0).map(c => c.branchId)).size;
  const dcfT = deficitCfg(org); const bigDef = varW.filter(c => (Number(c.variance) || 0) < -dcfT.max).length;
  const patT = deficitPatterns(org, cls, brs.map(b => b.id), td);
  const pendL = cls.filter(c => c.status === 'submitted');
  const pendShort = pendL.filter(c => (Number(c.variance) || 0) < 0);
  const tabs = R.tabs || [];
  const can = (t) => tabs.includes(t) || (me.appAllow || []).some(id => (LAUNCH_IX[id]?.open?.tab) === t);
  const approver = !!R.approver && (can('approve') || can('closing'));
  const qa = [
    { t: 'pos', ar: 'نقطة البيع', ic: Store, pri: true },
    { t: 'closing', ar: 'إغلاق اليوم', ic: ClipboardCheck },
    { t: 'purchasing', ar: 'المشتريات', ic: Truck },
    { t: 'reporting', ar: 'التقارير', ic: FileBarChart },
    { t: 'acct', ar: 'المحاسبة', ic: Scale }
  ].filter(x => can(x.t)).slice(0, 4);
  const stAr = { closed: 'مُغلق', live: 'مباشر', draft: 'مسودة', none: 'لم يُغلق' };
  const shown = allBr ? rows : rows.slice(0, 5);
  return (
    <div className="tdy">
      <button type="button" className="tdy-mb" onClick={() => setMbOpen(true)}><ClipboardCheck size={18} /><span><b>التقرير الصباحي</b><small>ملخص أمس لكل الفروع — للطباعة والمشاركة</small></span><span aria-hidden="true">←</span></button>
      {mbOpen && <MorningBrief org={org} ops={ops} me={me} myBranches={myBranches} scoped={scoped} setTab={setTab} onClose={() => setMbOpen(false)} />}
      {patT.length > 0 && (
        <button type="button" className="tdy-act tdy-alarm" onClick={() => setTab(can('approve') ? 'approve' : 'closing')}>
          <span className="tdy-act-n num">{patT.length}</span>
          <span className="tdy-act-t"><b>عجز متكرر في {patT.length === 1 ? 'فرع' : brCnt(patT.length)}</b>
            <small className="neg">{patT.map(x => x.branchName + ' (' + x.n + ' حالات · ' + money(Math.abs(x.total)) + ')').join('، ')}</small></span>
          <span className="tdy-act-go" aria-hidden="true">←</span>
        </button>
      )}
      {approver && pendL.length > 0 && (
        <button type="button" className="tdy-act" onClick={() => setTab(can('approve') ? 'approve' : 'closing')}>
          <span className="tdy-act-n num">{pendL.length}</span>
          <span className="tdy-act-t"><b>إغلاقات بانتظار اعتمادك</b>
            {pendShort.length > 0
              ? <small className="neg">{pendShort.length === 1 ? 'أحدها بعجز' : pendShort.length + ' منها بعجز'} <span className="num">{moneyP(sum(pendShort, c => c.variance))}</span></small>
              : <small>بلا عجز — راجعها واعتمدها</small>}
          </span>
          <span className="tdy-act-go" aria-hidden="true">←</span>
        </button>
      )}
      <div className="tdy-kpis">
        <div className="tdy-k"><span className="tdy-kl">مبيعات اليوم</span><span className="tdy-kv num">{money(salesT)}</span>
          <span className="tdy-ks">أمس <span className="num">{money(salesY)}</span></span></div>
        <div className="tdy-k"><span className="tdy-kl">إغلاقات اليوم</span><span className="tdy-kv num">{closedN}/{brs.length}</span>
          <span className={'tdy-ks' + (closedN === brs.length ? ' pos' : '')}>{closedN === brs.length ? 'كل الفروع أُغلقت' : brCnt(brs.length - closedN) + ' لم يُرحَّل'}</span></div>
        <div className="tdy-k"><span className="tdy-kl">فروقات الصناديق</span><span className={'tdy-kv num' + (varSum < 0 ? ' neg' : '')}>{moneyP(varSum)}</span>
          <span className={'tdy-ks' + (shortBr ? ' neg' : '')}>آخر 7 أيام{shortBr ? ' · ' + brCnt(shortBr) + ' بعجز' : ''}{bigDef ? ' · ' + bigDef + ' فوق الحد' : ''}</span></div>
        <div className="tdy-k"><span className="tdy-kl">بانتظار الاعتماد</span><span className="tdy-kv num">{pendL.length}</span>
          <span className="tdy-ks">{pendL.length ? 'بقيمة ' + money(sum(pendL, c => c.totalRevenue)) : 'لا شيء معلّق'}</span></div>
      </div>
      {qa.length > 0 && (
        <div className="tdy-qa">
          {qa.map(x => <button key={x.t} type="button" className={'tdy-q' + (x.pri ? ' pri' : '')} onClick={() => setTab(x.t)}><x.ic size={18} />{x.ar}</button>)}
        </div>
      )}
      <div className="tdy-br">
        <div className="tdy-brh"><b>الفروع اليوم</b><small>الإغلاق المرحّل أولًا، وإلا مبيعات نقطة البيع الحيّة</small></div>
        {shown.map(r => (
          <div key={r.b.id} className="tdy-bri">
            <span className="tdy-brn">{r.b.name}</span>
            <span className={'tdy-st ' + r.st}>{stAr[r.st]}</span>
            <span className="num tdy-brv">{r.st === 'none' || r.st === 'draft' ? '—' : money(r.v)}</span>
          </div>
        ))}
        {rows.length > 5 && <button type="button" className="tdy-more" onClick={() => setAllBr(v => !v)}>{allBr ? 'عرض أقل' : 'كل الفروع (' + rows.length + ')'}</button>}
      </div>
    </div>
  );
}

function Launcher({ org, ops, me, myBranches, scoped, setTab, openAcctView, openInvView }) {
  const [q, setQ] = useState('');
  const [bump, setBump] = useState(0);
  const u = appUseGet(me.id);
  const isFav = (id) => (u.fav || []).includes(id);
  const toggleFav = (id, e) => {
    e.stopPropagation();
    const v = appUseGet(me.id); v.fav = v.fav || [];
    v.fav = v.fav.includes(id) ? v.fav.filter(x => x !== id) : [...v.fav, id];
    appUseSet(me.id, v); setBump(b => b + 1);
  };
  const pend = (ops?.closings || []).filter(c => c.status === 'submitted').length;
  // v35.5 — حالات حيّة حقيقية فقط: وردية نقطة بيع مفتوحة على هذا الجهاز، إغلاقات معلّقة للمعتمد، أوامر شراء معتمدة لم تُستلم
  const myBrIds = new Set((myBranches || []).map(b => b.id));
  const shiftsOpenN = (ops?.posShifts || []).filter(x => x.status === 'open' && myBrIds.has(x.branchId)).length;
  const shiftOpen = shiftsOpenN > 0 || (() => { try { const v = JSON.parse(localStorage.getItem(POS_SH_KEY) || 'null'); return !!(v && v.id); } catch { return false; } })();
  const poOpen = (ops?.purchaseOrders || []).filter(po => po.status === 'open' && !po.invoiceId).length;
  const canApr = !!(ROLES[me.role] || {}).approver;
  const liveOf = (id) => id === 'pos' ? (shiftOpen ? { dot: 1, t: shiftsOpenN > 1 ? shiftsOpenN + ' ورديات مفتوحة الآن' : 'وردية مفتوحة الآن' } : null)
    : (id === 'closing' || id === 'approve') ? (canApr && pend > 0 ? { t: pend + ' بانتظار الاعتماد' } : null)
      : id === 'purchasing' ? (poOpen > 0 ? { t: poOpen + ' أمر شراء بانتظار الاستلام' } : null) : null;

  /* ===== v15.16 — إعادة ترتيب التطبيقات بالسحب والإفلات =====
     الترتيب المخصّص يُحفَظ لكل مستخدم على جهازه (rms8:appuse — نفس مخزن المفضلة).
     تطبيق جديد لم يدخل الترتيب المحفوظ بعد يظهر في موضعه المنطقي الافتراضي. */
  const [tileOrder, setTileOrder] = useState(() => (appUseGet(me.id).order || []));
  const [dragId, setDragId] = useState(null);
  const gridRef = useRef(null);
  const flipRef = useRef(null);          // لقطات مواقع البلاطات قبل تغيير الترتيب (FLIP)
  const mineIdsRef = useRef([]);
  const suppressClick = useRef(false);   // منع «نقرة» فتح التطبيق بعد إفلات سحب
  const dragSt = useRef({ id: null, active: false, ghost: null, offX: 0, offY: 0, px: 0, py: 0, pendingId: null, pendingNode: null, lpTimer: null, moved: false });

  const orderRank = (id) => { const i = tileOrder.indexOf(id); return i < 0 ? 1000 + launchRank(id) : i; };

  // انزلاق سلس (FLIP) لبقية البلاطات عند تغيّر الترتيب أثناء السحب
  const snapRects = () => {
    const m = new Map();
    (gridRef.current ? gridRef.current.querySelectorAll('[data-appid]') : []).forEach(el => m.set(el.dataset.appid, el.getBoundingClientRect()));
    return m;
  };
  useLayoutEffect(() => {
    const prev = flipRef.current; flipRef.current = null;
    if (!prev || !gridRef.current) return;
    gridRef.current.querySelectorAll('[data-appid]').forEach(el => {
      if (el.dataset.appid === dragSt.current.id) return;
      const p = prev.get(el.dataset.appid); if (!p) return;
      const n = el.getBoundingClientRect();
      const dx = p.left - n.left, dy = p.top - n.top;
      if (!dx && !dy) return;
      el.style.animation = 'none';        // حركة الدخول المتدرّج تتغلّب على transform المضمّن — نعطّلها بعد اكتمالها
      el.style.transition = 'none'; el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(() => { el.style.transition = 'transform .28s cubic-bezier(.2,.7,.2,1)'; el.style.transform = ''; });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileOrder]);

  const blockTouchScroll = (e) => { if (dragSt.current.active) e.preventDefault(); };
  const endDrag = useCallback(() => {
    const st = dragSt.current;
    if (st.lpTimer) { clearTimeout(st.lpTimer); st.lpTimer = null; }
    window.removeEventListener('pointermove', winMoveRef.current);
    window.removeEventListener('pointerup', winUpRef.current);
    window.removeEventListener('pointercancel', winUpRef.current);
    window.removeEventListener('touchmove', blockTouchScroll);
    document.body.classList.remove('lh-dragging');
    if (st.ghost) { st.ghost.remove(); st.ghost = null; }
    if (st.active && st.moved) {
      const v = appUseGet(me.id); v.order = mineIdsRef.current.slice(); appUseSet(me.id, v);
      suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 300);
    }
    st.active = false; st.id = null; st.pendingId = null; st.pendingNode = null; st.moved = false;
    setDragId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const beginDrag = (id, node, x, y) => {
    const st = dragSt.current;
    st.id = id; st.active = true; st.moved = false;
    const r = node.getBoundingClientRect();
    st.offX = x - r.left; st.offY = y - r.top;
    const g = node.cloneNode(true);
    g.classList.add('lh-drag-ghost');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.left = (x - st.offX) + 'px'; g.style.top = (y - st.offY) + 'px';
    document.body.appendChild(g);
    st.ghost = g;
    document.body.classList.add('lh-dragging');
    window.addEventListener('touchmove', blockTouchScroll, { passive: false });
    setDragId(id);
  };

  const onDragMove = (x, y) => {
    const st = dragSt.current; if (!st.active || !st.ghost) return;
    st.moved = true;
    st.ghost.style.left = (x - st.offX) + 'px'; st.ghost.style.top = (y - st.offY) + 'px';
    st.ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    st.ghost.style.display = '';
    const t = el && el.closest && el.closest('[data-appid]');
    if (t && t.dataset.appid !== st.id) {
      const ids = mineIdsRef.current.slice();
      const from = ids.indexOf(st.id), to = ids.indexOf(t.dataset.appid);
      if (from > -1 && to > -1 && from !== to) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        flipRef.current = snapRects();
        setTileOrder(ids);
      }
    }
  };

  const winMoveRef = useRef(null), winUpRef = useRef(null);
  winMoveRef.current = (e) => {
    const st = dragSt.current;
    if (st.active) { onDragMove(e.clientX, e.clientY); return; }
    if (!st.pendingId) return;
    const dx = e.clientX - st.px, dy = e.clientY - st.py;
    const dist = Math.hypot(dx, dy);
    if (st.lpTimer) { // لمس: تحرّك قبل اكتمال الضغط المطوّل = تمرير عادي، نلغي
      if (dist > 12) { clearTimeout(st.lpTimer); st.lpTimer = null; st.pendingId = null; endDrag(); }
      return;
    }
    if (dist > 6) beginDrag(st.pendingId, st.pendingNode, e.clientX, e.clientY); // فأرة: يبدأ بعد حركة صغيرة
  };
  winUpRef.current = () => endDrag();

  const tilePointerDown = (a) => (e) => {
    if (qq) return;                                   // لا ترتيب داخل نتائج البحث
    if (e.target.closest && e.target.closest('.lh-star')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const st = dragSt.current;
    st.px = e.clientX; st.py = e.clientY; st.pendingId = a.id; st.pendingNode = e.currentTarget;
    if (e.pointerType === 'touch') st.lpTimer = setTimeout(() => { st.lpTimer = null; beginDrag(a.id, st.pendingNode, st.px, st.py); }, 350);
    window.addEventListener('pointermove', winMoveRef.current);
    window.addEventListener('pointerup', winUpRef.current);
    window.addEventListener('pointercancel', winUpRef.current);
  };
  useEffect(() => () => endDrag(), [endDrag]);        // تنظيف عند مغادرة الشاشة

  // التطبيقات المُجمّعة (LAUNCH_APPS): كل تطبيق يضمّ أقسامه المتشابهة — بترتيب المستخدم المخصّص إن وُجد
  // v31.5: التطبيقات المدمجة في غيرها لا تظهر مستقلة (إلا إن لم يُتح للمستخدم تطبيقها الأم)
  const mine = LAUNCH_APPS.filter(a => appCanSee(me, a) && !(a.hideOnHome && LAUNCH_IX[a.hideOnHome] && appCanSee(me, LAUNCH_IX[a.hideOnHome]))).sort((a, b) => orderRank(a.id) - orderRank(b.id));
  mineIdsRef.current = mine.map(a => a.id);
  const norm = (s) => (s || '').replace(/[أإآ]/g, 'ا');
  const qq = norm(q.trim());
  const match = (a) => !qq || norm(a.ar + ' ' + (a.en || '') + ' ' + (a.kw || []).join(' ') + ' ' + (a.sections || []).join(' ')).includes(qq);
  const shown = mine.filter(match);
  const favApps = mine.filter(a => isFav(a.id) && match(a));
  // v13.9 — فهرس الأقسام داخل المراكز: بحث يقفز مباشرةً لأي قسم (وفق صلاحية الدور)
  const rtMe = ROLES[me.role]?.tabs || [];
  const fullMe = ROLES[me.role]?.scope === 'all' && !ROLES[me.role]?.limitedApps;  // v15.9: الأدوار المحدودة (المحاسب) لا ترى كل الأقسام في البحث
  const secIndex = Object.entries(HUBS).flatMap(([hubId, h]) => h.views.filter(v => fullMe || rtMe.includes(v.id) || rtMe.includes(hubId)).map(v => ({ id: v.id, ar: v.ar, icon: v.icon, hubId, hubAr: h.ar, cat: (LAUNCH_IX[hubId] || {}).cat })));
  const matchedSecs = qq ? secIndex.filter(v => norm(v.ar + ' ' + v.hubAr).includes(qq)) : [];
  const favSecs = secIndex.filter(v => isFav(v.id));   // v14.0 — أقسام مثبّتة في المفضلة
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير';

  const Tile = (a, draggable) => (
    <div key={a.id} className={'lh-tile' + (dragId === a.id ? ' lh-drag-src' : '')}
      style={{ '--c': CAT_CLR[a.cat] || 'var(--brass)' }}
      {...(draggable ? { 'data-appid': a.id, onPointerDown: (e) => { glyphGo(e.currentTarget); tilePointerDown(a)(e); } } : { onPointerDown: (e) => glyphGo(e.currentTarget) })}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') glyphGo(e.currentTarget); }}
      onClick={() => { if (suppressClick.current) return; appOpenNow(a, me, setTab, openAcctView, openInvView); }}
      title={(a.sections?.length ? a.sections.join(' · ') : a.ar) + (draggable ? ' — اسحبه لتغيير ترتيبه' : '')}>
      <button className={'lh-star' + (isFav(a.id) ? ' on' : '')} title={isFav(a.id) ? 'إزالة من المفضلة' : 'تثبيت في المفضلة'}
        onClick={(e) => toggleFav(a.id, e)}><Star size={12} fill={isFav(a.id) ? 'currentColor' : 'none'} /></button>
      {(a.id === 'approve' || (a.id === 'closing' && canApr)) && pend > 0 && <span className="lh-bdg">{pend}</span>}
      {(() => { const lv = liveOf(a.id); return (
      <div className={'lh-box' + (lv ? ' live' : '')} title={lv ? lv.t : undefined}><AppGlyph a={a} />{lv && lv.dot && <span className="lh-dot" />}{a.sections?.length > 1 && <span className="lh-cnt" title={a.sections.length + ' أقسام'}>{a.sections.length}</span>}</div>); })()}
      <div className="lh-nm">{a.homeAr || a.ar}</div>
    </div>
  );

  const SecTile = (v) => (
    <div key={'sec:' + v.hubId + ':' + v.id} className="lh-tile" style={{ '--c': CAT_CLR[v.cat] || 'var(--brass)' }}
      onClick={() => setTab(v.id)} title={v.hubAr + ' ← ' + v.ar}>
      <button className={'lh-star' + (isFav(v.id) ? ' on' : '')} title={isFav(v.id) ? 'إزالة من المفضلة' : 'تثبيت في المفضلة'}
        onClick={(e) => toggleFav(v.id, e)}><Star size={12} fill={isFav(v.id) ? 'currentColor' : 'none'} /></button>
      <div className="lh-box"><v.icon size={32} /></div>
      <div className="lh-nm">{v.ar}</div>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1, textAlign: 'center' }}>{v.hubAr}</div>
    </div>
  );

  return (
    <>
    <div className="lh-bg" aria-hidden="true">
      {org.company?.logoUrl
        ? <img className="lh-wm" src={org.company.logoUrl} alt="" />
        : <div className="lh-wm mark"><MizanMark size={420} /></div>}
    </div>
    <div className="lh">
      <p className="lh-hi">{greet} يا <b>{(me.name || '').split(' ')[0]}</b> · <span>{new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
      <div className="lh-role"><span className="pill">{(ROLES[me.role]?.ar || me.role).split('—')[0].trim()} · {shown.length} تطبيقاً</span></div>
      <div className="lh-search">
        <Search size={15} className="lh-si" />
        <input className="inp" placeholder="ابحث عن تطبيق أو قسم… (جرّب: تعادل، رواتب، تدفق نقدي)" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!qq && <TodayPanel org={org} ops={ops} me={me} myBranches={myBranches} scoped={scoped} setTab={setTab} />}

      {qq && matchedSecs.length > 0 && (
        <div className="lh-sec">
          <div className="lh-sect"><Search size={14} className="ic" />أقسام مطابقة — انتقال مباشر</div>
          <div className="lh-grid">{matchedSecs.map(SecTile)}</div>
        </div>
      )}

      {(favApps.length + favSecs.length) > 0 && !qq && (
        <div className="lh-sec">
          <div className="lh-sect"><Star size={14} className="ic" fill="currentColor" />المفضلة</div>
          <div className="lh-grid">{favApps.map(a => Tile(a, false))}{favSecs.map(SecTile)}</div>
        </div>
      )}

      {/* شبكة موحّدة مرتّبة بتدفّق منطقي — نمط أودو (بلا صفوف مبعثرة) */}
      <div className="lh-sec">
        <div className="lh-sect">{qq ? `نتائج «${q.trim()}»` : 'كل التطبيقات'}</div>
        <div className="lh-grid" ref={gridRef}>{shown.map(a => Tile(a, !qq))}</div>
      </div>
      {shown.length === 0 && <div className="lh-empty">لا يوجد تطبيق بهذا الاسم — جرّب كلمة أخرى</div>}
    </div>
    </>
  );
}

// لوحة ظهور التطبيقات لكل مستخدم — v9.2 (تخصيص فوق الدور)
/* AppPermsPanel: نُقل إلى mods/admin/AppPermsPanel.jsx (تحميل كسول) */

/* AppsCenter: نُقل إلى mods/admin/AppsCenter.jsx (تحميل كسول) */

/* ================= شاشة المحاسبة — م1+م2: دليل، قيود، ميزان، قوائم ================= */
/* ═══════════════════════════════════════════════════════════════════════════════════════
   v28.2 — دمج بيانات «ميزان المحاسبي» (حزمة mizan-export)
   ───────────────────────────────────────────────────────────────────────────────────────
   • مُطفأ افتراضيًا: لا شيء يتغيّر حتى يفعّله صاحب صلاحية الترحيل ويستورد الحزمة بنفسه.
   • لا افتراض: كل حساب في الحزمة يُربط صراحةً بحساب في الدليل (أو يُنشأ حساب مخصّص جديد)،
     والموردون يُطابَقون بالرقم الضريبي ثم بالاسم، والمكرّر (نفس الدفعة) لا يُستورد مرتين.
   • يحترم الإقفال الشهري: أي سجل في شهر مقفل يمنع الاستيراد كله.
   • التراجع ممكن: كل سجل مستورد يحمل mizanBatch، وزر «إلغاء الدفعة» يحذف سجلاتها التشغيلية.
   ═══════════════════════════════════════════════════════════════════════════════════════ */
const MZ_FIXED = { '211001': '2101', '115001': '1501' };          // ذمم الموردين وضريبة المدخلات — ثابتان بطبيعتهما
const MZ_SUGGEST = { '213002': '2301', '319001': '3101', '411009': '4101', '213001': '2301' };   // v28.5: المبيعات وضريبة المخرجات        // اقتراح أولي قابل للتغيير
const MZ_KIND_AR = { asset: 'أصل', liab: 'خصم', equity: 'حقوق ملكية', rev: 'إيراد', exp: 'مصروف' };
const mzNorm = (s) => String(s || '').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const mzNewCode = (c) => 'MZ-' + c;
const mzR2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function mizanPlan(org, ops, pkg, map, withSales) {
  const A = buildAccounting(org, ops);
  const accSet = new Set(A.accounts.map(a => a.code));
  const target = (code) => MZ_FIXED[code] || (map[code] === '__new' || !map[code] ? mzNewCode(code) : map[code]);
  // الموردون: الرقم الضريبي أولًا ثم الاسم بعد التطبيع — ولا مطابقة غير ذلك
  const exVat = {}; const exName = {};
  (org.suppliers || []).forEach(s => { const v = String(s.vatNo || '').trim(); if (v) exVat[v] = s; exName[mzNorm(s.name)] = s; });
  const supMap = {}; const newSups = []; let supByVat = 0, supByName = 0;
  (pkg.suppliers || []).forEach(s => {
    const hit = (s.vat && exVat[s.vat]) || exName[mzNorm(s.name)];
    if (hit) { supMap[s.mid] = { id: hit.id, name: hit.name }; if (s.vat && exVat[s.vat]) supByVat++; else supByName++; return; }
    const id = 'sup-mz-' + s.mid;
    supMap[s.mid] = { id, name: s.name };
    newSups.push({ id, name: s.name, category: 'مورد', phone: '', vatNo: s.vat || '', address: '', taxable: !!s.vat, terms: 0, mizanBatch: pkg.batch, mizanId: s.mid });
  });
  // الحسابات الجديدة المطلوب إنشاؤها
  const pkgAcc = {}; (pkg.accounts || []).forEach(a => { pkgAcc[a.code] = a; });
  const bankCodes = new Set((pkg.banks || []).map(b => b.acc));
  const newAccs = [];
  (pkg.accounts || []).forEach(a => {
    if (MZ_FIXED[a.code]) return;
    const t = target(a.code);
    if (t === mzNewCode(a.code) && !accSet.has(t)) newAccs.push({ code: t, name: a.name, kind: a.kind, ...(bankCodes.has(a.code) || a.code === '111902' || a.code === '111903' ? { cash: true } : {}), mizanBatch: pkg.batch });
  });
  const missing = (pkg.accounts || []).filter(a => { const t = target(a.code); return !MZ_FIXED[a.code] && t !== mzNewCode(a.code) && !accSet.has(t); }).map(a => a.code);
  // التكرار: نفس الدفعة أو نفس المعرّف المستورد
  const has = (arr) => new Set((arr || []).filter(x => x && x.mizanId).map(x => x.mizanId));
  const invHas = has(ops.invoices), payHas = has(ops.closingInvPays), jrHas = has(ops.journalManual);
  const invId = (mid) => 'mz-' + mid;
  const invoices = (pkg.invoices || []).filter(i => !invHas.has(i.mid)).map(i => {
    const sp = supMap[i.sup] || { id: '', name: '' };
    return {
      id: invId(i.mid), supplierId: sp.id, supplierName: sp.name, branchId: '', branchName: 'المركز الرئيسي',
      invoiceNo: i.inv || i.mid, amount: mzR2(i.total), paidAmount: 0, taxable: (i.vat || 0) > 0, vatAmt: mzR2(i.vat), accCode: target(i.acc),
      date: i.date, dueDate: i.date, createdAt: nowISO(), note: i.note || '', mizanBatch: pkg.batch, mizanId: i.mid, mizanSrc: i.src || ''
    };
  });
  const bankAcc = {}; (pkg.banks || []).forEach(b => { bankAcc[b.mid] = target(b.acc); });
  const payments = (pkg.payments || []).filter(p => !payHas.has(p.mid)).map(p => ({
    id: 'mzp-' + p.mid, refId: 'mizan:' + p.mid, supplierId: (supMap[p.sup] || {}).id || '', amount: mzR2(p.amount), date: p.date,
    by: 'استيراد ميزان', at: nowISO(), fund: bankAcc[p.bank], alloc: (p.alloc || []).map(a => [invId(a[0]), mzR2(a[1])]),
    payType: p.payType || '', payee: p.payee || '', bankRef: p.bankRef || '', memo: p.memo || '', mizanBatch: pkg.batch, mizanId: p.mid
  }));
  const journals = (pkg.journals || []).filter(j => !jrHas.has(j.mid)).map(j => ({
    id: 'mzj-' + j.mid, date: j.date, title: j.title, opening: !!j.opening, by: 'استيراد ميزان', createdAt: nowISO(),
    lines: j.lines.map(l => ({ code: MZ_FIXED[l.acc] || target(l.acc), debit: mzR2(l.d), credit: mzR2(l.c) })), mizanBatch: pkg.batch, mizanId: j.mid
  }));
  // v28.5: المبيعات الربعية الإجمالية — قيد لكل بند، ويُستبعد أي ربع فيه إغلاقات يومية معتمدة/مرحّلة (تفاديًا لتكرار المبيعات)
  const qStart = (d) => { const y = d.slice(0, 4), m = +d.slice(5, 7); return y + '-' + String(m - ((m - 1) % 3)).padStart(2, '0') + '-01'; };
  const closingsIn = (from, to) => (ops.closings || []).filter(c => countedClosing(c) && (c.date || '') >= from && (c.date || '') <= to).length;
  const salesAll = (pkg.sales || []).map(x => ({ ...x, from: qStart(x.date), closings: closingsIn(qStart(x.date), x.date) }));
  const salesSkip = salesAll.filter(x => x.closings > 0);
  const salesJr = !withSales ? [] : salesAll.filter(x => !x.closings && !jrHas.has(x.mid)).map(x => {
    const gross = mzR2(x.net + x.vat);
    return {
      id: 'mzj-' + x.mid, date: x.date, title: x.desc + (x.note ? ' — ' + x.note : ''), opening: false, by: 'استيراد ميزان', createdAt: nowISO(),
      lines: [{ code: target('111901'), debit: gross, credit: 0 }, { code: target('411009'), debit: 0, credit: mzR2(x.net) }, ...(x.vat ? [{ code: target('213001'), debit: 0, credit: mzR2(x.vat) }] : [])],
      vat: x.vat ? { out: mzR2(x.vat), inn: 0, netSales: mzR2(x.net), netPurch: 0 } : null,
      mizanBatch: pkg.batch, mizanId: x.mid, mizanSales: true
    };
  });
  journals.push(...salesJr);
  const locked = [...invoices.map(x => x.date), ...payments.map(x => x.date), ...journals.map(x => x.date)].filter(d => periodLocked(org, d));
  const lockedMonths = [...new Set(locked.map(d => d.slice(0, 7)))].sort();
  const noSup = invoices.filter(i => !i.supplierId).length + payments.filter(p => !p.supplierId).length;
  // أثر الحزمة وحدها على كل بنك مربوط = رصيد الكشف (فحص توازن قبل الحفظ)
  const bankCheck = (pkg.banks || []).map(b => {
    const code = bankAcc[b.mid];
    const fromPays = -sum(payments.filter(p => p.fund === code), p => p.amount);
    const fromJr = sum(journals.flatMap(j => j.lines).filter(l => l.code === code), l => l.debit - l.credit);
    return { mid: b.mid, name: b.name, code, close: b.close, asOf: b.asOf, pkgNet: mzR2(fromPays + fromJr) };
  });
  return { supMap, newSups, supByVat, supByName, newAccs, missing, invoices, payments, journals, lockedMonths, noSup, bankCheck, salesAll, salesSkip, salesJr,
    dup: { inv: (pkg.invoices || []).length - invoices.length, pay: (pkg.payments || []).length - payments.length, jr: (pkg.journals || []).length - (journals.length - salesJr.length) } };
}

/* MizanMerge: نُقل إلى mods/acct/MizanMerge.jsx (تحميل كسول) */

/* Accounting: نُقل إلى mods/acct/Accounting.jsx (تحميل كسول) */

/* Partners: نُقل إلى mods/inv/Partners.jsx (تحميل كسول) */

/* ================= المركز المالي الذكي ================= */
/* AiCenter: نُقل إلى mods/acct/AiCenter.jsx (تحميل كسول) */

/* ================= بيانات الشركة والنسخ الاحتياطي ================= */
/* v34.1 — فحص سلامة المستندات السحابية: يكشف المستند الذي تتعذّر قراءته (جزء مفقود/JSON تالف/رفض) ويصلحه من نسخة هذا الجهاز */
// v34.7: صور الإغلاق داخل ملف الفرع ← أرشيف المستندات (bf_) ثم تُزال من الإغلاق — ملف الفرع يصغر من عشرات الميجابايت إلى كيلوبايتات
const closingImgs = (c) => { const out = [];
  if (c.cardReceiptImage) out.push({ u: c.cardReceiptImage, cat: 'pos_settlement', lbl: 'إثبات شبكة/تحويل', t: 'إثبات الشبكة', amount: c.cardSales || 0 });
  ((c.sessionPhotos && c.sessionPhotos.length) ? c.sessionPhotos : (c.sessionPhoto ? [c.sessionPhoto] : [])).forEach((u, i) => out.push({ u, cat: 'signature', lbl: 'توثيق المسؤول', t: 'توثيق الإغلاق ' + (i + 1), amount: 0 }));
  (c.expenses || []).forEach(e => { if (e.receiptImage) out.push({ u: e.receiptImage, cat: 'expense', lbl: 'فاتورة مصروف', t: (e.categoryName || 'مصروف') + (e.beneficiaryName ? ' — ' + e.beneficiaryName : ''), amount: e.amount || 0 }); });
  return out.filter(x => typeof x.u === 'string' && x.u.length > 200); };
async function slimBranchDoc(branch, commit, me, drop) {
  const doc = await cloud.get(brKey(branch.id), null); if (!doc) return { err: 'تعذّرت قراءة ملف الفرع' };
  const withImgs = (doc.closings || []).filter(c => closingImgs(c).length);
  if (!withImgs.length) return { n: 0, imgs: 0 };
  // v34.10: حذف نهائي بطلب المستخدم — بلا نسخ للأرشيف
  if (drop) { const ids0 = new Set(withImgs.map(c => c.id)); let im0 = 0; withImgs.forEach(c => { im0 += closingImgs(c).length; });
    const ok0 = await commit(d => ({ ...d, closings: (d.closings || []).map(c => ids0.has(c.id) && c.branchId === branch.id ? { ...c, sessionPhoto: '', sessionPhotos: [], cardReceiptImage: '', expenses: (c.expenses || []).map(e => e.receiptImage ? { ...e, receiptImage: '' } : e), imagesPruned: true, imagesDeleted: true } : c) }),
      { actionType: 'delete', targetType: 'daily_closing', targetId: branch.id, branchName: branch.name, title: 'حذف صور الإغلاقات نهائيًا (تخفيف ملف الفرع)', details: withImgs.length + ' إغلاق · ' + im0 + ' صورة' });
    return ok0 ? { n: withImgs.length, imgs: im0 } : { err: 'تعذّر تحديث ملف الفرع — أعد المحاولة' }; }
  const store = await cloud.get(bfKey(branch.id), { items: [] }); const items = (store && Array.isArray(store.items)) ? store.items : [];
  const have = new Set(items.map(x => (x.closingId || '') + '|' + (x.fileUrl || '').length + '|' + (x.fileUrl || '').slice(-64)));
  const add = []; withImgs.forEach(c => closingImgs(c).forEach((im, k) => { const sig = c.id + '|' + im.u.length + '|' + im.u.slice(-64); if (have.has(sig)) return; have.add(sig);
    const pdfA = im.u.startsWith('data:application/pdf');
    add.push({ id: 'arc-' + c.id + '-slim' + k, title: im.t + ' — ' + (c.branchName || branch.name) + ' ' + (c.date || ''), category: im.cat, categoryLabelAr: im.lbl, branchId: branch.id, branchName: c.branchName || branch.name,
      fileUrl: im.u, fileType: pdfA ? 'pdf' : 'image', fileName: im.t + (pdfA ? '.pdf' : '.jpg'), fileSizeKb: Math.round(im.u.length * 0.75 / 1024), uploadDate: c.date, uploadedBy: (me || {}).name || '', amount: im.amount, closingId: c.id, source: 'closing', uploadedAt: nowISO() }); }));
  if (cloud.readFailed(bfKey(branch.id))) { const re = cloud.readErr(bfKey(branch.id)) || {}; return { err: 'تعذّرت قراءة «أرشيف مستندات ' + branch.name + '» (' + (re.code || '') + ') — لم يُحذف شيء. أصلح سطر الأرشيف في الفحص أولًا ثم خفّف الملف' }; }
  if (add.length && !(await cloud.set(bfKey(branch.id), { ...(store || {}), items: [...add, ...items] }))) return { err: 'تعذّر حفظ الصور في أرشيف المستندات (' + String((cloud.lastError || {}).code || '') + ') — لم يُحذف شيء' };
  const ids = new Set(withImgs.map(c => c.id)); let imgs = 0; withImgs.forEach(c => { imgs += closingImgs(c).length; });
  const ok = await commit(d => ({ ...d, closings: (d.closings || []).map(c => ids.has(c.id) && c.branchId === branch.id ? { ...c, sessionPhoto: '', sessionPhotos: [], cardReceiptImage: '', expenses: (c.expenses || []).map(e => e.receiptImage ? { ...e, receiptImage: '' } : e), imagesPruned: true, imagesArchived: true } : c) }),
    { actionType: 'update', targetType: 'daily_closing', targetId: branch.id, branchName: branch.name, title: 'نقل صور الإغلاقات إلى أرشيف المستندات (تخفيف ملف الفرع)', details: withImgs.length + ' إغلاق · ' + imgs + ' صورة · منها ' + add.length + ' أُضيفت للأرشيف' });
  return ok ? { n: withImgs.length, imgs, added: add.length } : { err: 'نُسخت الصور للأرشيف لكن تعذّر تحديث ملف الفرع — أعد المحاولة' };
}

/* CloudHealth: نُقل إلى mods/admin/CloudHealth.jsx (تحميل كسول) */

/* SystemPanel: نُقل إلى mods/admin/SystemPanel.jsx (تحميل كسول) */

/* ================= لوحة التوقيع الرقمي ================= */
/* ================= حقل صورة: التقاط بالكاميرا أو رفع ملف ================= */
function compressImage(file, max = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = String(rd.result);
    };
    rd.onerror = reject; rd.readAsDataURL(file);
  });
}

/* ================= كاميرا حية: التقاط صورة الوجه ================= */
function CameraModal({ title, onCapture, onClose, say }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [shot, setShot] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; setReady(true); }
      } catch (e) {
        setErr('تعذّر الوصول للكاميرا. تأكد من منح الإذن، وأن الموقع يعمل على HTTPS.');
      }
    })();
    return () => { active = false; if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const snap = () => {
    const v = videoRef.current; if (!v) return;
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 480;
    const ctx = cv.getContext('2d');
    const sx = (v.videoWidth - size) / 2, sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, 480, 480);
    setShot(cv.toDataURL('image/jpeg', 0.88));   // مرّرها إلى المحرّر قبل الاعتماد
  };

  return (
    <Modal title={title || 'التقاط صورة الوجه'} icon={ScanFace} onClose={onClose}
      foot={<><button className="btn pri" disabled={!ready} onClick={snap}><Camera size={14} />التقاط الصورة</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      {err ? (
        <div className="empty" style={{ color: 'var(--rose)' }}><ShieldAlert size={22} style={{ margin: '0 auto 10px' }} /><div>{err}</div></div>
      ) : (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
            <div style={{ width: '62%', aspectRatio: '3/4', border: '2.5px dashed rgba(200,162,74,.75)', borderRadius: '50% 50% 46% 46%' }} />
          </div>
          {!ready && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
            <RefreshCw size={22} className="spin" /></div>}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 12, textAlign: 'center', lineHeight: 1.8 }}>
        ضع وجهك داخل الإطار في إضاءة جيدة، ثم اضغط التقاط. تُحفظ الصورة كتوثيق مرئي للجلسة.
      </div>
      {shot && <ImageEditor src={shot} say={say} title="تحرير صورة التوثيق قبل الاعتماد"
        onCancel={() => setShot(null)}
        onDone={img => { setShot(null); onCapture(img); }} />}
    </Modal>
  );
}

// شحذ/تنقية بسيطة عبر التفاف 3×3 لإبراز التفاصيل وتقليل الضبابية
function sharpenCanvas(ctx, w, h) {
  try {
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const k = [0, -0.6, 0, -0.6, 3.4, -0.6, 0, -0.6, 0];
    const S = src.data, D = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const oi = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let a = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, x + dx));
          a += S[(yy * w + xx) * 4 + c] * k[ki++];
        }
        D[oi + c] = a < 0 ? 0 : a > 255 ? 255 : a;
      }
      D[oi + 3] = S[oi + 3];
    }
    ctx.putImageData(out, 0, 0);
  } catch (e) { /* الشحذ تكميلي */ }
}

// محرّر الصورة: قصّ + تدوير + سطوع/تباين + توضيح وتنقية قبل الرفع (#2)
function ImageEditor({ src, onDone, onCancel, say, title }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const [base, setBase] = useState(src);
  const [bri, setBri] = useState(100);
  const [con, setCon] = useState(105);
  const [clean, setClean] = useState(true);
  const [disp, setDisp] = useState(null);
  const [box, setBox] = useState(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  const measure = () => {
    const st = stageRef.current, im = imgRef.current;
    if (!st || !im || !im.naturalWidth) return;
    const sw = st.clientWidth, sh = st.clientHeight;
    const scale = Math.min(sw / im.naturalWidth, sh / im.naturalHeight);
    const dispW = im.naturalWidth * scale, dispH = im.naturalHeight * scale;
    const offX = (sw - dispW) / 2, offY = (sh - dispH) / 2;
    setDisp({ scale, offX, offY, dispW, dispH });
    setBox({ x: offX + dispW * 0.04, y: offY + dispH * 0.04, w: dispW * 0.92, h: dispH * 0.92 });
  };
  useEffect(() => { const t = setTimeout(measure, 60); return () => clearTimeout(t); }, [base]);

  const clamp = (b) => {
    if (!disp) return b;
    let w = Math.max(28, Math.min(b.w, disp.dispW));
    let h = Math.max(28, Math.min(b.h, disp.dispH));
    let x = Math.max(disp.offX, Math.min(b.x, disp.offX + disp.dispW - w));
    let y = Math.max(disp.offY, Math.min(b.y, disp.offY + disp.dispH - h));
    return { x, y, w, h };
  };
  const onDown = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box: { ...box } };
    const mv = (ev) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.sx, dy = ev.clientY - drag.current.sy, b = drag.current.box;
      if (drag.current.mode === 'move') setBox(clamp({ ...b, x: b.x + dx, y: b.y + dy }));
      else setBox(clamp({ ...b, w: b.w + dx, h: b.h + dy }));
    };
    const up = () => { drag.current = null; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const rotate = () => {
    const im = imgRef.current; if (!im) return;
    const c = document.createElement('canvas'); c.width = im.naturalHeight; c.height = im.naturalWidth;
    const ctx = c.getContext('2d'); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(Math.PI / 2);
    ctx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    setBase(c.toDataURL('image/jpeg', 0.92));
  };

  const apply = async () => {
    if (!disp || !box) { onDone(base); return; }
    setBusy(true);
    try {
      const im = imgRef.current;
      const sx = (box.x - disp.offX) / disp.scale, sy = (box.y - disp.offY) / disp.scale;
      const sw = box.w / disp.scale, sh = box.h / disp.scale;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(sw)); out.height = Math.max(1, Math.round(sh));
      const ctx = out.getContext('2d');
      ctx.filter = `brightness(${bri}%) contrast(${con}%)` + (clean ? ' saturate(104%)' : '');
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, out.width, out.height);
      if (clean) sharpenCanvas(ctx, out.width, out.height);
      onDone(out.toDataURL('image/jpeg', 0.82));
    } catch (e) { say && say('تعذّرت معالجة الصورة', 'no'); onDone(base); }
    setBusy(false);
  };

  return (
    <Modal title={title || 'تحرير الصورة قبل الرفع'} icon={Crop} onClose={onCancel}
      foot={<><button className="btn pri" disabled={busy} onClick={apply}>{busy ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}اعتماد الصورة</button>
        <button className="btn gh" onClick={onCancel}>إلغاء</button></>}>
      <div className="imgstage" ref={stageRef}>
        <img ref={imgRef} src={base} onLoad={measure} alt="تحرير"
          style={{ filter: `brightness(${bri}%) contrast(${con}%)` + (clean ? ' saturate(104%)' : ''), position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        {box && (
          <div className="cropbox" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={onDown('move')}>
            <span className="crop-h" onPointerDown={onDown('resize')} />
            <span className="crop-grid" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center', margin: '8px 0 4px' }}>اسحب الإطار لتحديد منطقة القص، والزاوية لتغيير الحجم.</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 }}>
        <button className="btn sm" onClick={rotate}><RotateCw size={13} />تدوير</button>
        <button className="btn sm" onClick={measure}><Crop size={13} />إعادة ضبط القص</button>
        <button className={'btn sm' + (clean ? ' pri' : ' gh')} onClick={() => setClean(c => !c)}><Wand2 size={13} />توضيح وتنقية</button>
      </div>
      <div className="editrow"><span className="lbl"><Sun size={12} /> السطوع</span>
        <input type="range" min="60" max="150" value={bri} onChange={e => setBri(+e.target.value)} />
        <span className="num" style={{ fontSize: 11, width: 34 }}>{bri}%</span></div>
      <div className="editrow"><span className="lbl">◐ التباين</span>
        <input type="range" min="70" max="160" value={con} onChange={e => setCon(+e.target.value)} />
        <span className="num" style={{ fontSize: 11, width: 34 }}>{con}%</span></div>
    </Modal>
  );
}

function PhotoField({ label, value, onChange, say, onOcr }) {
  const cam = useRef(); const file = useRef(); const pdf = useRef();
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [editing, setEditing] = useState(null);

  const isPdf = typeof value === 'string' && value.startsWith('data:application/pdf');

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return say && say('يُقبل رفع الصور فقط', 'no');
    setBusy(true);
    try { setEditing(await compressImage(f)); }   // افتح المحرّر قبل الاعتماد
    catch { say && say('تعذّرت معالجة الصورة', 'no'); }
    setBusy(false);
  };

  const pickPdf = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return say && say('يُقبل ملف PDF فقط', 'no');
    if (f.size > 4 * 1024 * 1024) return say && say('حجم الملف يتجاوز 4 ميجابايت', 'no');
    setBusy(true);
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      onChange(b64);
      say && say('تم إرفاق ملف PDF');
    } catch { say && say('تعذّر رفع الملف', 'no'); }
    setBusy(false);
  };

  // استخراج النص من الصورة عبر OCR (تُحمّل المكتبة عند الحاجة فقط)
  const runOcr = async () => {
    if (!value || isPdf) return;
    setOcrBusy(true);
    say && say('جارٍ قراءة النص من الصورة...');
    try {
      if (!window.Tesseract) {
        await new Promise((res, rej) => {
          const sc = document.createElement('script');
          sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
        });
      }
      const { data } = await window.Tesseract.recognize(value, 'ara+eng');
      const text = (data.text || '').trim();
      if (text && onOcr) onOcr(text);
      say && say(text ? 'تم استخراج النص' : 'لم يُعثر على نص واضح', text ? 'ok' : 'no');
    } catch {
      say && say('تعذّر تشغيل قارئ النص', 'no');
    }
    setOcrBusy(false);
  };

  return (
    <div className="fld">
      {label && <label className="lbl">{label}</label>}
      {!value ? (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className="btn sm" disabled={busy} onClick={() => cam.current?.click()}>
            {busy ? <RefreshCw size={13} className="spin" /> : <Camera size={13} />}التقاط
          </button>
          <button type="button" className="btn sm gh" disabled={busy} onClick={() => file.current?.click()}>
            <Upload size={13} />صورة
          </button>
          <button type="button" className="btn sm gh" disabled={busy} onClick={() => pdf.current?.click()}>
            <FileText size={13} />PDF
          </button>
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {isPdf ? (
            <a href={value} download="مستند.pdf" className="badge b-sky" style={{ textDecoration: 'none' }}>
              <FileText size={12} />ملف PDF مرفق
            </a>
          ) : (
            <img src={value} alt="مرفق" onClick={() => setZoom(true)}
              style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in', border: '1px solid var(--line)' }} />
          )}
          <span className="badge b-mint"><Check size={11} />مرفق</span>
          {!isPdf && onOcr && (
            <button type="button" className="btn sm gh" disabled={ocrBusy} onClick={runOcr}>
              {ocrBusy ? <RefreshCw size={12} className="spin" /> : <Search size={12} />}قراءة OCR
            </button>
          )}
          <button type="button" className="btn sm gh" onClick={() => onChange('')}>
            <Trash2 size={12} color="#D9544D" />إزالة
          </button>
        </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pick} />
      <input ref={file} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
      <input ref={pdf} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={pickPdf} />
      {zoom && !isPdf && (
        <div className="mask" onClick={() => setZoom(false)}>
          <img src={value} alt="مرفق" style={{ maxWidth: '92%', maxHeight: '90vh', borderRadius: 12, background: '#000' }} />
        </div>
      )}
      {editing && <ImageEditor src={editing} say={say}
        onCancel={() => setEditing(null)}
        onDone={img => { setEditing(null); onChange(img); say && say('تم تحرير الصورة'); }} />}
    </div>
  );
}

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
/* CategoriesPanel: نُقل إلى mods/admin/CategoriesPanel.jsx (تحميل كسول) */

/* ================= الورديات وتذكيرات الإغلاق ================= */
/* ============================================================
   v13.3 — تخطيط العمالة والتكلفة (الفعلي من الحضور الموثَّق منذ v27.12)
   جدول ساعات أسبوعي لكل موظف + تسجيل الحضور الفعلي + قياس نسبة العمالة
   من المبيعات (من الإغلاقات المعتمدة) بهدف قابل للضبط. كل الإعدادات صريحة — بلا افتراض خفيّ.
   الأجر/الساعة = (الأساسي + البدلات) ÷ الساعات الشهرية المعيارية (افتراضي 208 = 26×8، قابل للتعديل).
   يُخزَّن الجدول في مجموعة schedules المركزية؛ لا يراه الكاشير.
   ============================================================ */
/* Workforce: نُقل إلى mods/hr/Workforce.jsx (تحميل كسول) */

/* Shifts: نُقل إلى mods/hr/Shifts.jsx (تحميل كسول) */

/* ================= أرشيف المستندات والمرفقات ================= */
const FILE_CATS = [
  { id: 'receipt', ar: 'إيصال صرف' }, { id: 'invoice', ar: 'فاتورة مورد' },
  { id: 'bank_statement', ar: 'إشعار بنكي' }, { id: 'contract', ar: 'عقد' },
  { id: 'payroll', ar: 'مستند رواتب' }, { id: 'official_doc', ar: 'مستند رسمي' },
  { id: 'general', ar: 'عام' }
];

// ===== v11.7: مركز المستندات الذكي — سجل الوثائق الرسمية وتتبّع صلاحياتها والتنبيه قبل الانتهاء =====
const DOC_TYPES = [
  { id: 'cr', ar: 'السجل التجاري' }, { id: 'vat', ar: 'شهادة ضريبة القيمة المضافة' }, { id: 'zakat', ar: 'شهادة الزكاة' },
  { id: 'municipal', ar: 'رخصة البلدية' }, { id: 'civil', ar: 'رخصة الدفاع المدني' }, { id: 'lease', ar: 'عقد إيجار' },
  { id: 'insurance', ar: 'شهادة تأمين' }, { id: 'saudization', ar: 'شهادة السعودة (نطاقات)' }, { id: 'chamber', ar: 'اشتراك الغرفة التجارية' },
  { id: 'work_permit', ar: 'رخصة/تصريح عمل' }, { id: 'other', ar: 'أخرى' }
];
const DOC_LABEL = (t) => (DOC_TYPES.find(x => x.id === t) || {}).ar || 'وثيقة';
/* DocsCenter: نُقل إلى mods/acct/DocsCenter.jsx (تحميل كسول) */

/* Archive: نُقل إلى mods/acct/Archive.jsx (تحميل كسول) */

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
  const allowed = (ROLES[me.role]?.tabs || []).includes(s.to) ? s.to : (ROLES[me.role]?.tabs || ['closing'])[0];

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
        الخطوة <span className="num">{i + 1}</span> من <span className="num">{steps.length}</span> · صلاحيتك الحالية: {(ROLES[me.role] || {}).ar || me.role}
      </div>
    </Modal>
  );
}

/* ================= محرّك القوائم المالية (يومي/شهري/سنوي) ================= */

// يحسب قائمة الدخل لأي مدى تاريخي ومجموعة فروع
function computeIncome(org, ops, closings, ids, from, to) {
  const cls = closings.filter(c => c.date >= from && c.date <= to && ids.includes(c.branchId));
  const R = {
    cash: sum(cls, c => c.cashSales), card: sum(cls, c => c.cardSales),
    bank: sum(cls, c => c.bankTransferSales || 0), del: sum(cls, c => c.totalDeliverySales)
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

  // الالتزامات الثابتة والرواتب: نجمعها لكل شهر يقع ضمن المدى
  const monthsInRange = (() => {
    const set = new Set();
    cls.forEach(c => set.add(c.date.slice(0, 7)));
    // نضيف كل الشهور بين from و to لضمان تضمين الالتزامات حتى بلا إغلاقات
    let d = new Date(from.slice(0, 7) + '-01');
    const end = new Date(to.slice(0, 7) + '-01');
    while (d <= end) { set.add(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() + 1); }
    return [...set];
  })();
  const fx = (ops.fixedExpenses || []).filter(f => monthsInRange.includes(f.month) && ids.includes(f.branchId));
  const fixedTotal = sum(fx, f => (f.rentAmount || 0) + (f.electricityBill || 0) + (f.waterBill || 0) + (f.internetBill || 0) + (f.otherBills || 0));

  const emps = (org.employees || []).filter(e => ids.includes(e.branchId));
  const monthlyPayroll = sum(emps, e => (e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0));
  const payrollCost = monthlyPayroll * Math.max(1, monthsInRange.length);
  const paidAtBranch = sum(byCat.filter(x => ['ec2', 'ec3'].includes(x.id)), x => x.v);
  const payrollRemaining = Math.max(0, payrollCost - paidAtBranch);

  const _tc = org.taxCfg || {}; const _vr = _tc.enabled ? (Number(_tc.rate) || 15) : 0; // v15: تتبع تفعيل الضريبة ونسبتها
  const vatOut = _vr ? grossRevenue * _vr / (100 + _vr) : 0;
  const vatIn = _vr ? sum(byCat.filter(x => x.taxable), x => x.v) * _vr / (100 + _vr) : 0;
  const vatDue = vatOut - vatIn;

  const totalCost = branchExpenses + fixedTotal + payrollRemaining;
  const operatingProfit = netRevenue - totalCost;
  const netAfterVat = operatingProfit - vatDue;
  const cashVariance = sum(cls, c => c.variance);

  return {
    n: cls.length, R, grossRevenue, commissions, netRevenue, byCat, branchExpenses,
    fixedTotal, payrollRemaining, vatOut, vatIn, vatDue, totalCost, operatingProfit,
    netAfterVat, cashVariance, months: monthsInRange.length
  };
}

// طباعة قائمة الدخل كتقرير A4 رسمي
function printIncomeA4(org, data, meta) {
  const co = org.company || {};
  const logo = meta.branchLogo || co.logoUrl || '';
  const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const d = data;
  const row = (k, v, cls, ind) => `<tr class="${cls || ''}"><td style="${ind ? 'padding-inline-start:22px;color:#777' : ''}">${k}</td><td class="num">${m(v)}</td></tr>`;
  const expRows = d.byCat.map(x => row(x.n, -x.v, '', true)).join('');

  const w = openDocWin('width=880,height=1000');
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <title>قائمة الدخل - ${meta.periodLabel}</title><style>${A4_CSS}
    .is-t { width:100%; border-collapse:collapse; font-size:11.5px; margin-top:8px }
    .is-t td { padding:8px 10px; border-bottom:1px solid #eee }
    .is-t td.num { text-align:left; font-variant-numeric:tabular-nums; font-weight:500 }
    .is-t tr.sub td { background:#faf8f3; font-weight:700; border-top:1.5px solid #ddd }
    .is-t tr.pos td { background:#eef8f2; font-weight:700; color:#2E8B62; font-size:13px; border-top:2px solid #2E8B62 }
    .is-t tr.neg td { background:#fdeeed; font-weight:700; color:#C0392B; font-size:13px; border-top:2px solid #C0392B }
    .is-t tr.rev td { color:#8C6F2C }
  </style></head><body><div class="page">
    <div class="head">
      <div class="co">${logo ? `<img class="logo" src="${logo}">` :MZ_LOGO_HTML}
        <div><div class="co-n">${co.name || 'المنشأة'}</div>
        <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div></div>
      </div>
      <div class="doc-title">قائمة الدخل (${meta.periodType})</div>
      <div class="doc-sub">${meta.scopeLabel} · ${meta.periodLabel}</div>
      <div class="doc-sub dim">عدد الإغلاقات: ${d.n} · تاريخ التصدير: ${arDT(new Date())}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>صافي الإيراد</span><b class="brass">${m(d.netRevenue)} ر.س</b></div>
      <div class="kpi"><span>إجمالي التكاليف</span><b class="rose">${m(d.totalCost)} ر.س</b></div>
      <div class="kpi ${d.netAfterVat >= 0 ? 'ok' : 'bad'}"><span>صافي الربح بعد الضريبة</span><b>${m(d.netAfterVat)} ر.س</b></div>
    </div>
    <table class="is-t">
      <tr class="rev"><td>المبيعات النقدية</td><td class="num">${m(d.R.cash)}</td></tr>
      <tr class="rev"><td>مبيعات الشبكة (مدى/POS)</td><td class="num">${m(d.R.card)}</td></tr>
      <tr class="rev"><td>تحويل بنكي مباشر</td><td class="num">${m(d.R.bank)}</td></tr>
      <tr class="rev"><td>مبيعات تطبيقات التوصيل</td><td class="num">${m(d.R.del)}</td></tr>
      <tr class="sub"><td>إجمالي الإيرادات</td><td class="num">${m(d.grossRevenue)}</td></tr>
      ${row('عمولات منصات التوصيل', -d.commissions, '', true)}
      <tr class="sub"><td>صافي الإيرادات</td><td class="num">${m(d.netRevenue)}</td></tr>
      <tr><td colspan="2" style="background:#14110F;color:#fff;font-weight:700;font-size:11px">التكاليف والمصروفات</td></tr>
      ${expRows}
      ${row('الالتزامات الثابتة (إيجار/كهرباء/مياه)', -d.fixedTotal, '', true)}
      ${row('الرواتب غير المصروفة بالفروع', -d.payrollRemaining, '', true)}
      <tr class="sub"><td>إجمالي التكاليف</td><td class="num">${m(-d.totalCost)}</td></tr>
      <tr class="${d.operatingProfit >= 0 ? 'pos' : 'neg'}"><td>الربح التشغيلي</td><td class="num">${m(d.operatingProfit)}</td></tr>
      ${row('ضريبة القيمة المضافة المستحقة', -d.vatDue, '', true)}
      <tr class="${d.netAfterVat >= 0 ? 'pos' : 'neg'}"><td>صافي الربح بعد الضريبة</td><td class="num">${m(d.netAfterVat)}</td></tr>
    </table>
    <div class="sec-h">مؤشرات ضريبية ورقابية</div>
    <table class="t compact">
      <tr><td>ض.ق.م على المبيعات (مُخرجة)</td><td class="num">${m(d.vatOut)} ر.س</td></tr>
      <tr><td>ض.ق.م على المشتريات (مُدخلة)</td><td class="num">${m(d.vatIn)} ر.س</td></tr>
      <tr class="tot"><td>صافي الضريبة المستحقة للهيئة</td><td class="num">${m(d.vatDue)} ر.س</td></tr>
      <tr><td>إجمالي فروقات الصندوق للفترة</td><td class="num">${m(d.cashVariance)} ر.س</td></tr>
    </table>
    <div class="sigs">
      <div class="sig"><div class="sig-t">إعداد المحاسب</div><div class="sig-line"></div><div class="sig-ok dim">التوقيع</div></div>
      <div class="sig"><div class="sig-t">مراجعة الإدارة المالية</div><div class="sig-line"></div><div class="sig-ok dim">التوقيع والختم</div></div>
      <div class="sig"><div class="sig-t">اعتماد المدير العام</div><div class="sig-line"></div><div class="sig-ok dim">الاعتماد النهائي</div></div>
    </div>
    <div class="foot dim">قائمة استرشادية لأغراض الإدارة · ${co.name || ''} · لا تحل محل القوائم المعتمدة من المحاسب القانوني</div>
  </div></body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

/* ================= التقارير المالية الموحّدة (يومي/شهري/سنوي) ================= */
/* FinancialReports: نُقل إلى mods/acct/FinancialReports.jsx (تحميل كسول) */

/* ================= قائمة الدخل الشهرية ================= */
/* IncomeStatement: نُقل إلى mods/acct/IncomeStatement.jsx (تحميل كسول) */

/* ============================================================
   v28.0 — وحدة تقييم العملاء بالـ QR (QR Customer Feedback & Intelligence)
   مبنية حسب مواصفات qr-feedback-system ومكيّفة لمعمار المنصة:
   • صفحة العميل العامة بلا تسجيل دخول: <رابط المنصة>?rate=<branchId>
     تكتب في مجموعة qr_feedback فقط، والقواعد تتحقق من الشكل والقيم ووقت الخادم.
   • qr_branches/{id}: اسم الفرع وحالة الاستقبال — قراءة عامة، والكتابة للمركز.
   • بلا Cloud Functions: المتوسط والشكوى التلقائية (< 3) ومهلة 24 ساعة والاتجاه الأسبوعي
     والتوصيات تُحسب في الواجهة، وتحليل التعليقات بـ Claude يُطلق من اللوحة.
   ============================================================ */
const QR_CATEGORIES = [
  { key: 'food', label: 'الطعام', items: [['quality', 'جودة الطعام'], ['taste', 'الطعم'], ['temp', 'حرارة الطعام'], ['size', 'حجم الطلب']] },
  { key: 'service', label: 'الخدمة', items: [['staff', 'تعامل الموظفين'], ['speed', 'سرعة الخدمة'], ['pro', 'الاحترافية']] },
  { key: 'place', label: 'المكان', items: [['clean', 'النظافة'], ['vibe', 'الأجواء'], ['comfort', 'الراحة']] }
];
const QR_ITEMS = QR_CATEGORIES.flatMap(c => c.items.map(([key, label]) => ({ key, label, category: c.label })));
const QR_KEYS = QR_ITEMS.map(i => i.key);
const QR_COMPLAINT_BELOW = 3;
const QR_SLA_MS = 24 * 3600 * 1000;
const QR_STATUS = {
  new: { ar: 'جديد', badge: 'b-rose' },
  in_progress: { ar: 'تحت المعالجة', badge: 'b-amber' },
  resolved: { ar: 'تم الحل', badge: 'b-mint' }
};
const QR_ISSUES = ['وقت الخدمة', 'جودة الطعام', 'الأسعار', 'النظافة', 'الخدمة', 'المكان'];
const QR_RESUBMIT_MS = 10 * 60 * 1000;   // مهلة إعادة التقييم من الجهاز نفسه (حدّ بسيط ضد التكرار)

const qrMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : (Number(ts) || 0));
const qrAvg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const qrF1 = (n) => (Number.isFinite(n) && n > 0 ? n.toFixed(1) : '—');
const qrOverall = (f) => qrAvg(QR_KEYS.map(k => Number(f && f.ratings && f.ratings[k]) || 0).filter(Boolean));
const qrIsComplaint = (f) => { const o = qrOverall(f); return o > 0 && o < QR_COMPLAINT_BELOW; };
const qrStatusOf = (f) => (QR_STATUS[f.status] ? f.status : 'new');
const qrOverdue = (f) => qrStatusOf(f) !== 'resolved' && qrMs(f.createdAt) > 0 && Date.now() - qrMs(f.createdAt) > QR_SLA_MS;
const qrDate = (ts) => { const ms = qrMs(ts); return ms ? new Date(ms).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; };
const qrSentBadge = (s) => (s === 'سلبي' ? 'b-rose' : s === 'إيجابي' ? 'b-mint' : 'b-amber');
// إحصاءات كل فرع: العدد والمتوسط والاتجاه الأسبوعي (آخر 7 أيام مقابل السبعة قبلها) والشكاوى — للوحة وللتقرير المطبوع
const qrBranchStats = (fb, brs) => {
  const now = Date.now(), wk = 7 * 864e5;
  return brs.map(b => {
    const all = fb.filter(f => f.branchId === b.id);
    const cur = all.filter(f => now - qrMs(f.createdAt) <= wk);
    const prev = all.filter(f => { const a = now - qrMs(f.createdAt); return a > wk && a <= 2 * wk; });
    const ca = qrAvg(cur.map(qrOverall)), pa = qrAvg(prev.map(qrOverall));
    const complaints = all.filter(qrIsComplaint);
    return {
      b, n: all.length, a: qrAvg(all.map(qrOverall)),
      trend: cur.length && prev.length && pa ? ((ca - pa) / pa) * 100 : 0,
      complaints: complaints.length,
      open: complaints.filter(f => qrStatusOf(f) !== 'resolved').length
    };
  });
};

// معرّف الفرع من رابط رمز QR — يُقبل شكل المعرّفات فقط
const qrRateParam = () => {
  try {
    const v = new URLSearchParams(window.location.search).get('rate');
    return v && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : '';
  } catch { return ''; }
};
// الرابط المطبوع داخل رمز QR: VITE_PUBLIC_URL إن ضُبط، وإلا أصل المنصة ومسارها الأساسي (يدعم GitHub Pages)
const qrRateUrl = (branchId) => {
  const E = import.meta.env || {};
  const base = (E.VITE_PUBLIC_URL || (window.location.origin + (E.BASE_URL || '/'))).replace(/\/?$/, '/');
  return base + '?rate=' + encodeURIComponent(branchId);
};

// Firestore مباشرة (خارج طبقة cloud): صفحة العميل تعمل بلا جلسة، واللوحة تستعلم مجموعات مستقلة
let _qrFsP = null;
function qrFs() {
  const E = import.meta.env || {};
  if (!(E.VITE_FIREBASE_API_KEY && E.VITE_FIREBASE_PROJECT_ID)) return Promise.resolve(null);
  if (!_qrFsP) {
    _qrFsP = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const sdk = await import('firebase/firestore');
      const app = getApps().length ? getApp() : initializeApp({
        apiKey: E.VITE_FIREBASE_API_KEY, authDomain: E.VITE_FIREBASE_AUTH_DOMAIN, projectId: E.VITE_FIREBASE_PROJECT_ID,
        storageBucket: E.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: E.VITE_FIREBASE_SENDER_ID, appId: E.VITE_FIREBASE_APP_ID
      });
      return { db: sdk.getFirestore(app), ...sdk };
    })().catch((e) => { _qrFsP = null; throw e; });
  }
  return _qrFsP;
}

function QrStars({ value = 0, onChange, size = 28 }) {
  return (
    <div role={onChange ? 'radiogroup' : undefined} style={{ display: 'flex', gap: 2, direction: 'ltr' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" aria-label={n + ' من 5'} role={onChange ? 'radio' : undefined} aria-checked={onChange ? value === n : undefined}
          onClick={onChange ? () => onChange(n) : undefined}
          style={{ background: 'none', border: 'none', padding: 2, cursor: onChange ? 'pointer' : 'default', fontSize: size, lineHeight: 1, color: n <= value ? '#D9A441' : 'var(--line)' }}>
          ★
        </button>
      ))}
    </div>
  );
}

/* ---------- صفحة العميل العامة: ?rate=<branchId> ---------- */
function QrRatePublic({ branchId }) {
  const [branch, setBranch] = useState(undefined);   // undefined = تحميل، null = غير موجود
  const [noCloud, setNoCloud] = useState(false);
  const [ratings, setRatings] = useState({});
  const [tableNo, setTableNo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const lastKey = 'rms8:qrfb:last:' + branchId;
  const [recent] = useState(() => { try { return Date.now() - (Number(localStorage.getItem(lastKey)) || 0) < QR_RESUBMIT_MS; } catch { return false; } });
  const now = useMemo(() => new Date().toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'full', timeStyle: 'short' }), []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const f = await qrFs();
        if (!f) { if (!dead) { setNoCloud(true); setBranch(null); } return; }
        const s = await f.getDoc(f.doc(f.db, 'qr_branches', branchId));
        if (!dead) setBranch(s.exists() ? { id: s.id, ...s.data() } : null);
      } catch (e) { console.warn('تعذّر تحميل بيانات الفرع:', e); if (!dead) setBranch(null); }
    })();
    return () => { dead = true; };
  }, [branchId]);

  const remaining = QR_KEYS.filter(k => !ratings[k]).length;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const f = await qrFs();
      if (!f) throw new Error('no-cloud');
      const short = (s) => { const t = String(s || '').trim().slice(0, 20); return t || null; };
      await f.addDoc(f.collection(f.db, 'qr_feedback'), {
        branchId, ratings, comment: comment.trim().slice(0, 1000),
        tableNo: short(tableNo), invoiceNo: short(invoiceNo), source: 'qr', createdAt: f.serverTimestamp()
      });
      try { localStorage.setItem(lastKey, String(Date.now())); } catch { }
      setDone(qrAvg(Object.values(ratings)));
    } catch (e) {
      console.error(e);
      setErr('تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.');
    }
    setBusy(false);
  };

  const shell = (children) => (
    <div className={themeCls('mizan', readMode())} style={{ minHeight: '100vh', background: 'var(--ink)', color: 'var(--txt)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px 40px' }}>{children}</main>
    </div>
  );
  const center = (children) => shell(<div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}><div>{children}</div></div>);

  if (branch === undefined) return center(<div style={{ color: 'var(--dim)' }}>جارٍ التحميل…</div>);
  if (noCloud) return center(<div style={{ color: 'var(--dim)' }}>خدمة التقييم غير مفعّلة على هذه المنصة حاليًا.</div>);
  if (branch === null) return center(<div style={{ color: 'var(--dim)' }}>رابط التقييم غير صحيح أو الفرع غير موجود.</div>);
  if (!branch.active) return center(<div style={{ color: 'var(--dim)' }}>هذا الفرع لا يستقبل تقييمات حاليًا.</div>);

  if (done !== null || recent) {
    const low = done !== null && done < QR_COMPLAINT_BELOW;
    return center(<>
      <div style={{ fontSize: 46 }}>{low ? '🙏' : '💚'}</div>
      <h1 style={{ fontSize: 21, marginTop: 10 }}>شكرًا لك، وصلنا رأيك</h1>
      <p style={{ color: 'var(--dim)', fontSize: 13.5, marginTop: 6 }}>
        {low ? 'نأسف لتجربتك. تم إبلاغ مدير الفرع وسنعالج الأمر.' : done !== null ? 'رأيك يساعدنا نتحسّن كل يوم.' : 'استلمنا تقييمك من هذا الجهاز قبل قليل.'}
      </p>
    </>);
  }

  return shell(<>
    <div className="card" style={{ background: 'linear-gradient(135deg,var(--brass-l),var(--brass))', color: '#1a1410', border: 'none' }}>
      <div style={{ fontSize: 11.5, opacity: 0.75 }}>{now}</div>
      {branch.company && <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{branch.company}</div>}
      <h1 style={{ fontSize: 22, marginTop: 4, lineHeight: 1.35 }}>كيف كانت تجربتك في {branch.name}؟</h1>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>دقيقة واحدة، بدون تسجيل دخول.</div>
    </div>

    <div className="grid g2" style={{ marginTop: 12 }}>
      <Field label="رقم الطاولة (اختياري)"><input className="inp" inputMode="numeric" maxLength={20} value={tableNo} onChange={e => setTableNo(e.target.value)} /></Field>
      <Field label="رقم الفاتورة (اختياري)"><input className="inp" inputMode="numeric" maxLength={20} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} /></Field>
    </div>

    {QR_CATEGORIES.map(c => (
      <div key={c.key} className="card" style={{ marginTop: 12 }}>
        <div className="card-t" style={{ marginBottom: 6 }}>{c.label}</div>
        {c.items.map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line)', padding: '8px 0' }}>
            <span style={{ fontSize: 14 }}>{label}</span>
            <QrStars value={ratings[key] || 0} onChange={(n) => setRatings(r => ({ ...r, [key]: n }))} />
          </div>
        ))}
      </div>
    ))}

    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-t" style={{ marginBottom: 8 }}>شاركنا رأيك</div>
      <textarea className="inp" rows={4} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder="مثال: الأكل ممتاز لكن الانتظار طويل" />
    </div>

    {err && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(217,84,77,.12)', color: 'var(--rose)', fontSize: 13 }}>{err}</div>}

    <button className="btn pri" style={{ width: '100%', marginTop: 14, padding: '14px 16px', fontSize: 15 }} disabled={remaining > 0 || busy} onClick={submit}>
      {busy ? 'جارٍ الإرسال…' : remaining ? 'قيّم ' + remaining + ' عناصر متبقية' : 'إرسال التقييم'}
    </button>
  </>);
}

/* ---------- لوحة الإدارة: تقييم العملاء (تبويب qrfb) ---------- */
/* QrFeedback: نُقل إلى mods/pos/QrFeedback.jsx (تحميل كسول) */

/* QrDashboard: نُقل إلى mods/pos/QrDashboard.jsx (تحميل كسول) */

/* ---------- الشكاوى: كل تقييم متوسطه أقل من 3 = تذكرة (جديد ← تحت المعالجة ← تم الحل) بمهلة 24 ساعة ---------- */
/* QrComplaints: نُقل إلى mods/pos/QrComplaints.jsx (تحميل كسول) */

/* ---------- رموز QR للفروع: تفعيل الاستقبال + معاينة وتحميل وطباعة ---------- */
/* QrBranchesView: نُقل إلى mods/pos/QrBranchesView.jsx (تحميل كسول) */

/* ---------- تقرير تقييم العملاء للطباعة (A4) — للفترة والفرع المحدَّدين في الشاشة ---------- */
function qrPrintReport({ org, fb, brs, days, sel, nb, say }) {
  const w = openDocWin('width=980,height=780');
  if (!w) return say('اسمح بالنوافذ المنبثقة لطباعة التقرير', 'no');
  const co = org.company || {};
  const e = escH;
  const f1 = (n) => (Number.isFinite(n) && n > 0 ? n.toFixed(1) : '—');
  const iso = (ms) => isoD(new Date(ms));
  const to = Date.now(), from = to - days * 864e5;
  const complaints = fb.filter(qrIsComplaint).sort((a, b) => qrMs(b.createdAt) - qrMs(a.createdAt));
  const open = complaints.filter(c => qrStatusOf(c) !== 'resolved');
  const overdue = open.filter(qrOverdue);
  const overall = qrAvg(fb.map(qrOverall));
  const happy = fb.length ? Math.round(fb.filter(x => qrOverall(x) >= 4).length / fb.length * 100) : 0;
  const issues = Object.entries(fb.reduce((m, x) => { const i = x.ai && x.ai.issue; if (i && i !== '—') m[i] = (m[i] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const withComment = fb.filter(x => x.comment);
  const kpi = (label, val, cls) => `<div class="kpi ${cls || ''}"><span>${label}</span><b>${val}</b></div>`;
  const empty = (cols, txt) => `<tr><td colspan="${cols}" class="dim">${txt}</td></tr>`;

  const branchRows = qrBranchStats(fb, brs).map(r => `<tr><td>${e(r.b.name)}</td><td class="num">${r.n}</td><td class="num">${f1(r.a)}</td>
    <td class="num">${r.trend ? (r.trend > 0 ? '▲ ' : '▼ ') + Math.abs(r.trend).toFixed(0) + '%' : '—'}</td>
    <td class="num">${r.complaints}</td><td class="num ${r.open ? 'rose' : ''}">${r.open}</td></tr>`).join('');
  const itemRows = QR_ITEMS.map(i => {
    const v = qrAvg(fb.map(x => Number(x.ratings && x.ratings[i.key]) || 0).filter(Boolean));
    return `<tr><td>${e(i.category)}</td><td>${e(i.label)}</td><td class="num ${v && v < 3 ? 'rose' : ''}">${f1(v)}</td></tr>`;
  }).join('');
  const issueRows = issues.map(([n, c]) => `<tr><td>${e(n)}</td><td class="num">${c}</td></tr>`).join('');
  const complaintRows = complaints.map(c => `<tr><td class="num">#${e(c.id.slice(0, 6).toUpperCase())}</td><td>${e(nb(c.branchId))}</td>
    <td class="num">${e(qrDate(c.createdAt))}</td><td class="num">${f1(qrOverall(c))}</td>
    <td>${e(QR_STATUS[qrStatusOf(c)].ar)}${qrOverdue(c) ? ' <span class="rose">(تجاوزت المهلة)</span>' : ''}</td>
    <td>${e(c.comment || '—')}${c.tableNo ? `<div class="dim">طاولة ${e(c.tableNo)}</div>` : ''}</td></tr>`).join('');
  const commentRows = withComment.slice(0, 40).map(x => `<tr><td>${e(nb(x.branchId))}</td><td class="num">${e(qrDate(x.createdAt))}</td>
    <td class="num">${f1(qrOverall(x))}</td><td>${e(x.comment)}</td><td>${x.ai ? e(x.ai.sentiment) : '—'}</td></tr>`).join('');
  const scope = sel === 'all' ? 'كل الفروع' : e((brs[0] || {}).name || nb(sel));

  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>تقرير تقييم العملاء</title><style>${A4_CSS}</style></head><body><div class="page">
    <div class="head">
      <div class="co">${co.logoUrl ? `<img class="logo" src="${e(co.logoUrl)}">` :MZ_LOGO_HTML}
        <div><div class="co-n">${e(co.name || 'المنشأة')}</div><div class="co-m">الرقم الضريبي: ${e(co.taxNumber || '—')}</div></div></div>
      <div class="doc-title">تقرير تقييم العملاء (QR)</div>
      <div class="doc-sub">${scope} · من ${arDate(iso(from))} إلى ${arDate(iso(to))} (آخر ${days} يومًا)</div>
    </div>
    <div class="kpis">
      ${kpi('عدد التقييمات', fb.length)}
      ${kpi('متوسط التقييم', f1(overall) + ' / 5', overall && overall < 3.5 ? 'bad' : 'ok')}
      ${kpi('نسبة الرضا (4 نجوم فأكثر)', happy + '%', happy >= 70 ? 'ok' : 'warn')}
      ${kpi('إجمالي الشكاوى', complaints.length, complaints.length ? 'warn' : 'ok')}
      ${kpi('شكاوى مفتوحة', open.length, open.length ? 'bad' : 'ok')}
      ${kpi('تجاوزت مهلة 24 ساعة', overdue.length, overdue.length ? 'bad' : 'ok')}
    </div>
    <div class="sec-h">مقارنة الفروع</div>
    <table class="t"><thead><tr><th>الفرع</th><th class="num">التقييمات</th><th class="num">المتوسط</th><th class="num">الاتجاه الأسبوعي</th><th class="num">الشكاوى</th><th class="num">مفتوحة</th></tr></thead>
      <tbody>${branchRows || empty(6, 'لا توجد فروع')}</tbody></table>
    <div class="sec-h">متوسط عناصر التقييم</div>
    <table class="t compact"><thead><tr><th>الفئة</th><th>العنصر</th><th class="num">المتوسط من 5</th></tr></thead><tbody>${itemRows}</tbody></table>
    ${issues.length ? `<div class="sec-h">أكثر المشاكل (من تحليل التعليقات)</div>
    <table class="t compact"><thead><tr><th>المشكلة</th><th class="num">التكرار</th></tr></thead><tbody>${issueRows}</tbody></table>` : ''}
    <div class="sec-h">الشكاوى (تقييم أقل من 3)</div>
    <table class="t"><thead><tr><th>الرقم</th><th>الفرع</th><th>التاريخ</th><th class="num">التقييم</th><th>الحالة</th><th>التعليق</th></tr></thead>
      <tbody>${complaintRows || empty(6, 'لا توجد شكاوى في هذه الفترة')}</tbody></table>
    <div class="sec-h">آخر التعليقات${withComment.length > 40 ? ' (أحدث 40 من ' + withComment.length + ')' : ''}</div>
    <table class="t"><thead><tr><th>الفرع</th><th>التاريخ</th><th class="num">التقييم</th><th>التعليق</th><th>الانطباع</th></tr></thead>
      <tbody>${commentRows || empty(5, 'لا توجد تعليقات مكتوبة')}</tbody></table>
    <div class="foot dim">تم التصدير آليًا من وحدة تقييم العملاء · ${arDT(new Date())}</div>
    </div></body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

/* ---------- تحليل التعليقات بـ Claude ----------
   عبر وسيط الخادم فقط (server.js: /api/ai/feedback) كي لا يصل مفتاح Anthropic للمتصفح أبدًا.
   الرابط: VITE_AI_FEEDBACK_ENDPOINT، أو يُشتق من VITE_AI_ENDPOINT (‎/api/ai/analyze → ‎/api/ai/feedback). */
async function aiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const t = await authApi.idToken();
  if (t) h.Authorization = 'Bearer ' + t;
  return h;
}
async function qrAnalyzeComments(items) {
  const E = import.meta.env || {};
  const endpoint = E.VITE_AI_FEEDBACK_ENDPOINT || (E.VITE_AI_ENDPOINT ? String(E.VITE_AI_ENDPOINT).replace(/\/analyze\/?$/, '/feedback') : '');
  const payload = items.map(f => ({ id: f.id, comment: String(f.comment || '').slice(0, 1000) }));
  if (!endpoint) throw new Error('no-endpoint');
  const r = await fetch(endpoint, { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ items: payload }) });
  const parsed = await r.json().catch(() => ({}));
  if (!r.ok || parsed.error) throw new Error(parsed.error || ('HTTP ' + r.status));
  const S = (v, n) => String(v == null ? '' : v).trim().slice(0, n) || '—';
  const ids = new Set(payload.map(p => p.id));
  const out = {};
  (Array.isArray(parsed && parsed.results) ? parsed.results : []).forEach(x => {
    if (!x || !ids.has(x.id)) return;
    out[x.id] = {
      sentiment: ['إيجابي', 'سلبي', 'محايد'].includes(x.sentiment) ? x.sentiment : 'محايد',
      positive: S(x.positive, 200),
      issue: QR_ISSUES.includes(x.issue) ? x.issue : '—',
      issueDetail: S(x.issueDetail, 300),
      keywords: (Array.isArray(x.keywords) ? x.keywords : []).slice(0, 6).map(k => String(k).slice(0, 30)),
      severity: Math.min(5, Math.max(1, Math.round(Number(x.severity) || 1))),
      recommendation: S(x.recommendation, 300),
      model: 'endpoint',
      analyzedAt: Date.now()
    };
  });
  return out;
}


// v38.3 — ما تحتاجه ملفات التطبيقات المنفصلة (mods/) من النواة
export { A4_CSS, ACCT_SECTIONS, ACCT_SEC_AR, ACC_KIND, ALL_TABS, APPS, AdvanceForm, AppPermsPanel, AppsStrip, BR_COLS, Badge, BalCell, BlindCount, BranchForm, COUNT_FREQ, COUNT_ST, CameraModal, CategoriesPanel, ClosingView, CloudHealth, CountScheduleCard, DAYS_AR, DENOMS, DOC_LABEL, DOC_TYPES, DailyBranchReport, DeliveryAppsPanel, DisbursementForm, DupInvHint, EXP_CATS, FILE_CATS, Field, FinancialReports, GROWTH_MONTHS, HR_WEEK_DAYS, HrSignPad, ITEM_TYPES, Kpi, LAUNCH_APPS, LEAVE_TYPES, LOCK_MSG, MAIN_WH, MFA_DEFAULT_ROLES, MOVE_KINDS, MZ_FIXED, MZ_KIND_AR, MZ_LOGO_HTML, MZ_SUGGEST, MfaPolicyCard, MizanMerge, Modal, MoneyField, NUM_FACE, NUM_LOCALE, NationalAddressFields, Num, OutputDialog, PAY_ADD_TYPES, PAY_GUESS, PEN_TYPES, POS_DEV_KEY, POS_SH_KEY, PROMO_IDEAS, PROMO_T, PT_SRC, PT_TYPE, PartnerChip, PdfTile, PhotoField, PosLoyalty, PosPromos, PosQuickProducts, PosSettings, PosShifts, PriceAlerts, QR_ITEMS, QR_STATUS, QUOTA_MSG, QrBranchesView, QrComplaints, QrDashboard, RB_KIND_AR, RB_PM_AR, RB_SOURCES, REG_APPS, REG_CATS, REG_IX, ROLES, SC_KPIS, SIGN_DOC_AR, SIG_H, SIG_W, SectionNav, SigView, SignDocsModal, SignaturePad, SystemPanel, TAB_AR, TRAIN_STATUS_AR, UsageVariance, UserForm, WASTE_REASONS, WH_KIND, WH_MOVE, WH_ST, WarehousesPanel, WasteControl, WasteFields, WastePending, WhLines, _normName, _xe, aCountDone, aItemsOf, acctSecKey, activePriorCorrectives, activeTrainingRecord, aiHeaders, appCanSee, appOpenNow, appUseGet, appUseSet, arDT, arDate, arTime, bankOfBranch, bioEnroll, bookHidden, branchBanks, branchEntityId, browserName, bsLayout, bsRowsOf, buildAccounting, buildClosingA4, buildPartners, buildPayslipSignDocs, businessDay, canApproveCount, canApproveWaste, capOK, chartTone, closingInvoices, clr, compressImage, computeIncome, contactFields, contactOf, correctiveExpiry, correctiveSignDoc, countCfgOf, countDenoms, countFocus, countSchedule, countedClosing, customerAging, daysBetween, defaultHrPolicies, defaultPenaltySchedule, defaultPointsRules, defaultRewardTiers, defaultRoleKpis, defaultTrainingPrograms, deficitCfg, deficitPatterns, detectStmtMap, deviceType, emptyDenoms, entityById, entityList, eosAccrualLines, eosCumAt, eosState, eosYears, escH, expiringTraining, expiryLots, exportExcel, fineSuggest, fmtBalP, fmtNA, frozenSnapshotFor, gosiRatesFor, haversineMeters, hrAttendanceDetail, hrEmpStats, hrQrWindowCode, hrScoreFor, isCostCtl, isLayout, isPdfData, isRowsOf, isStocked, isoD, itemAvgCosts, itemType, kpiAchievement, leaveBalance, leaveDeductPlan, lockedThru, loyBal, loyEarn, loyPost, loyQ, loyQSet, loyRedeemMax, lvAccrualLines, lvAddD, lvCfg, lvDaily, lvDays, lvRequired, lvState, makeXlsx, missingRequiredTraining, mizanPlan, money, moneyP, monthEnd, monthLabel, monthLedger, multiEntityOn, mzNewCode, mzR2, naClean, naErr, naHas, naMissing, newBranchDraft, nextPartnerCode, nextWhAcc, normPhone, normalizeSupPays, nowISO, onLeave, openDocWin, openPdfData, otFromAttendance, otRateOf, overdueSignDocs, pFactor, parseCsvGrid, parseMt940, parseXlsxGrid, partGross, partYield, payCashPart, payLabel, paySplits, payTotal, payrollRowsOf, penTypeAr, pendShiftsGet, pendShiftsSet, periodLocked, piAggregate, piDetect, piNorm, pipTriggered, posCashNet, posClrOf, posDaySummary, posDev, posOrdersStats, posPriceCart, posPrint, posQueue, posQueueSet, posR2, posReceiptHtml, posShiftHtml, posTotals, posZHtml, positionJdHtml, printA4, printClosingA4, printIncomeA4, printPartnerStatement, printReceipt, printSalesInvoice, programRequiredFor, promoActive, promoDesc, promoHits, purKey, pwStrength, q3, qrAnalyzeComments, qrAvg, qrBranchStats, qrDate, qrF1, qrFs, qrIsComplaint, qrMs, qrOverall, qrOverdue, qrPrintReport, qrRateUrl, qrSentBadge, qrStatusOf, qrSvg, rewardSignDoc, roleEdit, roleHasTab, roleKpisFor, rolePost, salesDaySource, sha, sha256Hex, short, siCredited, siRem, siSorted, siStamp, siVerify, sigBlockHtml, sigPoints, sigSvg, signDeclaration, signDocHtml, simplifySig, slimBranchDoc, snapAll, snapMonths, snapPut, stAddDays, stDate, stNum, stockByWh, submitWaste, suggestNextLevel, sum, supplierAging, supplierPrices, today, trainingExpiryOf, trainingStatusNow, uid, usageReport, useSecNav, verifyBackup, waNum, wasteCfg, wasteDaily, wasteReasonAr, wasteRows, webauthnSupported, whForBranch, whName, whOf, whOn, zatcaTLV };
export { ClosingForm };
// v38.3 — للاختبارات الآلية (tests/): دوال المحرك والشاشات تُستورد من النواة مباشرة
export { stockCosting, eosEntitledAmt, eosFullAmt, findDupInvoices, invNoNorm, promoLineDisc, tafqeet, Hub, Launcher, PosApp, Inventory, Partners, SalesHub, QrFeedback, AppsCenter, BranchWarehouse, Admin, AuditView, Accounting, emptyOrg, emptyOps, HUBS };
