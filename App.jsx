import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, ClipboardCheck, Banknote, Users, Building2, FileBarChart,
  ShieldCheck, Bell, LogOut, Plus, Minus, Trash2, Check, X, Search,
  CircleDollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet,
  ArrowLeftRight, UserCog, Menu, RefreshCw, Lock, Radio, Download,
  ChevronLeft, Stamp, Landmark, Receipt, CalendarDays, Store, Eye, Send,
  Sparkles, Truck, Printer, HardDrive, Settings, FileText, Upload,
  Camera, Image as ImageIcon, Clock, Timer, Compass,
  Fingerprint, ScanFace, ShieldAlert, Video, Grid3x3,
  BarChart3, CheckCircle2, ArrowUp, ArrowDown,
  CreditCard, Coins, ChevronDown, ChevronRight,
  Crop, RotateCw, Sun, Wand2, Delete, Scale
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line
} from 'recharts';
import { CSS } from './styles';
import { cloud, KEYS, kb, authApi } from './storage';

/* ================= أدوات مساعدة عامة ================= */
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

/* تجزئة كلمة السر (SHA-256) — لا تُخزَّن كلمة السر كنص صريح */
async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text + '::rms8'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
      rp: { name: 'منصة إغلاق الفروع', id: location.hostname },
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

/* ================= تنبيهات النشاط الحيّة (إعداد لكل جهاز) ================= */
const NOTIFY_KEY = 'rms8:notify';
const notifyCfg = () => { try { return { on: false, sound: true, ...(JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}')) }; } catch { return { on: false, sound: true }; } };
const saveNotifyCfg = (c) => { try { localStorage.setItem(NOTIFY_KEY, JSON.stringify({ on: !!c.on, sound: !!c.sound })); } catch { } };

// إشعار متصفح (يعمل والمنصة مفتوحة ولو في تبويب/نافذة خلفية)
function notifyBrowser(title, body, icon) {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    new Notification(title, { body, icon: icon || undefined, dir: 'rtl', lang: 'ar', tag: 'rms8-act' });
    return true;
  } catch { return false; }
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
const short = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
};
const arDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return d; }
};
const arTime = (iso) => {
  try {
    const t = new Date(iso), diff = (Date.now() - t.getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
    return t.toLocaleDateString('ar-SA-u-nu-latn', { day: '2-digit', month: 'short' });
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
const chartTone = (t) => t === 'lite'
  ? { grid: '#DDD4C4', tick: '#8A7F72', tip: '#FFFDF8', tipTxt: '#241F1A', bar: '#E3DACA' }
  : { grid: '#332C26', tick: '#6E635A', tip: '#1C1815', tipTxt: '#EFE7DB', bar: '#3A322B' };
const clr = (i) => ['#C8A24A', '#4FB286', '#5B93C4', '#D9544D', '#E0A458', '#9B7BB8'][i % 6];

/* ================= دفتر الشركاء: تجميع حركات كل شريك من مصادرها ================= */
// الرصيد الجاري = مجموع الدائن − مجموع المدين. موجب = دائن (علينا)، سالب = مدين (لنا).
// الإغلاق المُحتسب ماليًا = المرحّل أو المعتمد فقط (المسودات والمرفوضة لا تدخل الدفاتر ولا المؤشرات ولا التقارير)
const countedClosing = (c) => !!c && (c.status === 'submitted' || c.status === 'approved');

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
// ترقيم تلقائي لكل شريك حسب نوعه — لتمييز التكرار في الأسماء
const PT_PREFIX = { supplier: 'مورد', employee: 'موظف', customer: 'عميل' };
const partnerCode = (type, seq) => (PT_PREFIX[type] || 'شريك') + '-' + String(seq).padStart(3, '0');

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
    const key = 'sup:' + sp.id; const txns = []; let linked = false;
    (ops.invoices || []).filter(i => i.supplierId === sp.id).forEach(i => {
      const d = (i.date || i.createdAt || i.dueDate || today() || '').slice(0, 10);
      txns.push({ date: d, desc: 'فاتورة توريد ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: 0, credit: i.amount || 0 });
      if ((i.paidAmount || 0) > 0) txns.push({ date: (i.paidDate || d || '').slice(0, 10), desc: 'سداد فاتورة ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: i.paidAmount || 0, credit: 0 });
      linked = true;
    });
    const ct = closeFor(key, sp.id); txns.push(...ct); if (ct.length) linked = true;
    const pt = payFor(key, sp.id); txns.push(...pt); if (pt.length) linked = true;
    txns.push(...ledFor(key));
    parts.push({ key, id: sp.id, name: sp.name, type: 'supplier', cat: sp.category || 'مورد', phone: sp.phone || '', tax: sp.vatNo || '', terms: sp.terms || 0, linked, txns, storedCode: sp.code });
  });

  // الموظفون — استحقاق وصرف الرواتب قيود دائمة تُرحَّل من شاشة الرواتب (لا سطر اصطناعي يتغيّر بالشهر)
  (org.employees || []).forEach(em => {
    const key = 'emp:' + em.id; const txns = []; let linked = false;
    (ops.advances || []).filter(a => a.employeeId === em.id).forEach(a => {
      const isDraw = ['advance', 'salary_draw'].includes(a.type);
      txns.push({ date: (a.date || '').slice(0, 10), desc: (isDraw ? 'سلفة/سحب على الراتب' : 'خصم/جزاء') + (a.reason ? ' — ' + a.reason : ''), ref: a.month || '', src: 'adv', debit: a.amount || 0, credit: 0 });
      linked = true;
    });
    const ce = closeFor(key); txns.push(...ce); if (ce.length) linked = true;
    const pe = payFor(key); txns.push(...pe); if (pe.length) linked = true;
    txns.push(...ledFor(key));
    parts.push({ key, id: em.id, name: em.name, type: 'employee', cat: em.jobTitle || em.title || 'موظف', phone: em.phone || '', tax: em.nationalId || em.iqamaNo || '', terms: 0, linked, txns, storedCode: em.code });
  });

  // العملاء والشركاء اليدويون — حركات يدوية فقط
  (org.partners || []).forEach(pt => {
    const key = pt.key || ('cust:' + pt.id);
    const ce = closeFor(key), pp = payFor(key);
    parts.push({ key, id: pt.id, name: pt.name, type: pt.type || 'customer', cat: pt.cat || 'عميل', phone: pt.phone || '', tax: pt.tax || '', terms: pt.terms || 0, linked: (ce.length + pp.length) > 0, custom: true, txns: [...ce, ...pp, ...ledFor(key)], storedCode: pt.code });
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

// الرقم التالي المتاح لنوع شريك — لتثبيته على البطاقة عند الإنشاء
function nextPartnerCode(parts, type) {
  let max = 0;
  parts.filter(p => p.type === type).forEach(p => { const m2 = /-(\d+)$/.exec(p.code || ''); if (m2) max = Math.max(max, +m2[1]); });
  return partnerCode(type, max + 1);
}

/* ============================================================
   م١ — المحاسبة الداخلية: دليل الحسابات ومحرك القيود التلقائية
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
function buildAccounting(org, ops) {
  // م٣: الضريبة — تُفعّل صراحةً من شاشة الضريبة (org.taxCfg)، والمبالغ المسجلة تُعامل شاملةً للضريبة
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
  // — الأصول —
  addAcc('1101', 'الخزينة الرئيسية', 'asset', { link: 'شاشة الخزينة والترحيل' });
  const cashCode = {};
  (org.branches || []).forEach((b, i) => {
    const code = '11' + String(11 + i);
    cashCode[b.id] = code;
    addAcc(code, 'صندوق ' + (b.name || 'فرع'), 'asset', { link: 'خزينة الفرع' });
  });
  addAcc('1201', 'البنك — الشبكة والمدفوعات البنكية (تجميعي)', 'asset', { link: 'يُطابَق من شاشة التسوية البنكية' });
  // ذمم مبوّبة: حساب مستقل لكل تطبيق توصيل — يُدمج بعمولته المعرّفة في الإعدادات
  const appAcc = {};
  (org.deliveryApps || []).forEach((a, i) => {
    const code = '13' + String(i + 1).padStart(2, '0');
    appAcc[a.id] = code;
    addAcc(code, 'ذمم تطبيق — ' + (a.n || 'توصيل'), 'asset', { link: 'مبيعات ' + (a.n || 'التطبيق') + (a.c ? ' · عمولة ' + a.c + '%' : ' · بلا عمولة'), appId: a.id });
  });
  addAcc('1399', 'ذمم تطبيقات أخرى (غير معرّفة)', 'asset');
  addAcc('1401', 'سلف الموظفين وعُهدهم', 'asset', { link: 'الرواتب والسلف' });
  addAcc('1501', 'ضريبة القيمة المضافة — مدخلات', 'asset', { link: 'تُخصم من الإقرار' });
  addAcc('1701', 'الأصول الثابتة', 'asset', { link: 'سجل الأصول' });
  addAcc('1791', 'مجمّع الإهلاك (يُطرح من الأصول)', 'asset', { link: 'قسط ثابت شهري تلقائي' });
  // — الخصوم —
  addAcc('2101', 'ذمم الموردين', 'liab', { link: 'دفتر الشركاء' });
  addAcc('2201', 'رواتب مستحقة', 'liab', { link: 'كشف الرواتب' });
  addAcc('2301', 'ضريبة القيمة المضافة — مخرجات', 'liab', { link: 'مستحقة للهيئة' });
  // — حقوق الملكية (تُفعَّل بالقيد الافتتاحي في المرحلة التالية) —
  addAcc('3101', 'رأس المال والأرصدة الافتتاحية', 'equity', { link: 'القيد الافتتاحي — مرحلة تالية' });
  // — الإيرادات —
  addAcc('4101', 'المبيعات (إجمالية)', 'rev', { link: 'إغلاقات الورديات المعتمدة' });
  // — المصروفات —
  addAcc('5201', 'الرواتب والأجور (كشف الرواتب)', 'exp', { link: 'ترحيل الاستحقاق الشهري' });
  addAcc('5301', 'عمولات تطبيقات التوصيل', 'exp', { link: 'نِسَب العمولة من إعدادات التطبيقات' });
  addAcc('5701', 'مصروف الإهلاك', 'exp', { link: 'سجل الأصول — تلقائي' });
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

  // ===== محرك القيود =====
  const entries = [];
  const L = (code, debit, credit) => ({ code, name: (accIx[code] || { name: code }).name, debit: debit || 0, credit: credit || 0 });
  const push = (e) => {
    e.debit = sum(e.lines, l => l.debit); e.credit = sum(e.lines, l => l.credit);
    e.balanced = Math.abs(e.debit - e.credit) < 0.005;
    entries.push(e);
  };
  const pmToAcc = (m, bCode) => m === 'cash' ? bCode : '1201'; // شبكة/تحويل/شيك → البنك التجميعي
  const supNameOf = (pm) => pm.supplierName
    || ((org.suppliers || []).find(s => s.id === pm.supplierId) || {}).name || '';

  const counted = (ops.closings || []).filter(countedClosing);
  counted.forEach(c => {
    const bCode = cashCode[c.branchId] || '1101';
    // ١) إيراد الوردية: نقدي/شبكة ← ثم سطر لكل تطبيق بذمّته وعمولته المسجّلة على الوردية نفسها
    const cash = c.cashSales || 0, card = c.cardSales || 0;
    const appRows = (c.deliverySales || []).filter(s => (s.amount || 0) > 0);
    const appsGross = sum(appRows, s => s.amount);
    const tot = cash + card + appsGross;
    if (tot > 0) {
      const lines = [];
      if (cash) lines.push(L(bCode, cash, 0));
      if (card) lines.push(L('1201', card, 0));
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
    // ٢) مصروفات الوردية: نقدًا من الصندوق، بنكيًا من البنك، وآجلًا على ذمم الموردين
    (c.expenses || []).forEach((e, ix) => {
      const amt = e.amount || 0; if (!amt) return;
      const expCode = catAcc[e.categoryId] || '5199';
      const credCode = e.paymentMethod === 'deferred' ? '2101' : pmToAcc(e.paymentMethod, bCode);
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
    // ٣) سدادات الموردين داخل الوردية — قد تتوزع على أكثر من طريقة دفع
    (c.supplierPayments || []).forEach((pm, ix) => {
      const s = paySplits(pm); const t2 = s.cash + s.card + s.transfer + s.other;
      if (t2 <= 0) return;
      const lines = [L('2101', t2, 0)];
      if (s.cash) lines.push(L(bCode, 0, s.cash));
      const bank = s.card + s.transfer + s.other;
      if (bank) lines.push(L('1201', 0, bank));
      const nm = supNameOf(pm);
      push({
        id: 'spay:' + c.id + ':' + (pm.id || ix), date: c.date, branchId: c.branchId,
        title: 'سداد مورد' + (nm ? ' — ' + nm : '') + ' (' + (c.branchName || '') + ')',
        src: 'سداد مورد بالوردية', ref: pm.reference || pm.invoiceId || c.id, lines
      });
    });
  });

  // ٤) التحويلات المؤكّد استلامها → الخزينة الرئيسية (المعلّقة تبقى بعهدة الفرع حتى التأكيد)
  (ops.transfers || []).filter(t => t.status === 'received').forEach(t => {
    if (!(t.amount > 0)) return;
    push({
      id: 'tr:' + t.id, date: t.date, branchId: t.branchId, title: 'توريد نقدي للخزينة الرئيسية — ' + (t.branchName || ''),
      src: 'تحويل خزينة', ref: t.referenceNo || t.id,
      lines: [L('1101', t.amount, 0), L(cashCode[t.branchId] || '1101', 0, t.amount)]
    });
  });
  // ٥) أوامر الصرف من الخزينة الرئيسية
  (ops.disbursements || []).forEach(x => {
    if (!(x.amount > 0)) return;
    push({
      id: 'dis:' + x.id, date: x.date,
      title: 'أمر صرف — ' + (x.category || 'منصرف') + (x.beneficiary ? ' · ' + x.beneficiary : ''),
      src: 'الخزينة الرئيسية', ref: x.reference || x.id,
      lines: [L('5901', x.amount, 0), L('1101', 0, x.amount)]
    });
  });
  // ٦) فواتير التوريد الآجلة وسداداتها المركزية (سدادات الفروع تدخل من قيود الورديات)
  (ops.invoices || []).forEach(i => {
    const d = (i.date || i.createdAt || i.dueDate || '').slice(0, 10);
    if (i.amount > 0) {
      // فصل ضريبة المدخلات للفواتير الموسومة «خاضعة» فقط (الحقل الجديد في م٤) — القديمة بلا وسم تبقى إجمالية
      const ti = (i.taxable === true) ? splitVat(i.amount) : { net: i.amount, vat: 0 };
      push({
        id: 'inv:' + i.id, date: d, branchId: i.branchId, title: 'فاتورة توريد آجلة — ' + (i.supplierName || 'مورد'),
        src: 'فاتورة مورد', ref: i.invoiceNo || i.id,
        lines: ti.vat
          ? [L('5198', ti.net, 0), L('1501', ti.vat, 0), L('2101', 0, i.amount)]
          : [L('5198', i.amount, 0), L('2101', 0, i.amount)],
        vat: ti.vat ? { out: 0, inn: ti.vat, netSales: 0, netPurch: ti.net } : null
      });
    }
    if ((i.paidAmount || 0) > 0) push({
      id: 'invp:' + i.id, date: (i.paidDate || d || '').slice(0, 10),
      title: 'سداد مركزي لفاتورة توريد — ' + (i.supplierName || 'مورد'),
      src: 'سداد مركزي', ref: i.invoiceNo || i.id,
      lines: [L('2101', i.paidAmount, 0), L('1201', 0, i.paidAmount)]
    });
  });
  // ٧) الرواتب: الاستحقاق كما رُحِّل، والصرف كما سُجِّل، وتسوية فرق السلف والخصومات
  const led = ops.ledgerEntries || [];
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
      const payDate = ((led.find(x => x.kind === 'salary_payout' && x.month === m) || {}).date || (m + '-28')).slice(0, 10);
      push({
        id: 'sal-pay:' + m, date: payDate, title: 'صرف رواتب شهر ' + m + ' (صافي بعد السلف والخصوم)',
        src: 'كشف الرواتب', ref: 'payout-' + m,
        lines: [L('2201', pay, 0), L('1201', 0, pay)]
      });
      const diff = Math.round((acc - pay) * 100) / 100;
      if (diff > 0.004) {
        const ads = (ops.advances || []).filter(a => a.month === m);
        const draws = sum(ads.filter(a => ['advance', 'salary_draw'].includes(a.type)), a => a.amount);
        const cd = Math.min(draws, diff);
        const cc = Math.round((diff - cd) * 100) / 100;
        const lines = [L('2201', diff, 0)];
        if (cd > 0) lines.push(L('1401', 0, cd));
        if (cc > 0) lines.push(L('5201', 0, cc));
        push({
          id: 'sal-set:' + m, date: payDate, title: 'تسوية سلف وخصومات رواتب ' + m,
          src: 'كشف الرواتب', ref: 'payroll-' + m, lines
        });
      }
    }
  });
  // ٨) صرف السلف والمسحوبات (عهدة على الموظف حتى استقطاعها من الراتب)
  (ops.advances || []).filter(a => ['advance', 'salary_draw'].includes(a.type)).forEach(a => {
    if (!(a.amount > 0)) return;
    push({
      id: 'adv:' + a.id, date: (a.date || '').slice(0, 10) || (a.month ? a.month + '-15' : ''),
      title: 'سلفة/سحب على الراتب' + (a.reason ? ' — ' + a.reason : ''),
      src: 'الرواتب والسلف', ref: a.month || a.id,
      lines: [L('1401', a.amount, 0), L('1201', 0, a.amount)]
    });
  });

  // ٩) الأصول الثابتة: قيد شراء بمصدر تمويل صريح + إهلاك قسط ثابت شهري (يُشتق كاملًا — تعديل الأصل يعيد الاشتقاق)
  const ymAdd = (ym, k) => { const pr = ym.split('-').map(Number); const t = pr[0] * 12 + (pr[1] - 1) + k; return String(Math.floor(t / 12)).padStart(4, '0') + '-' + String((t % 12) + 1).padStart(2, '0'); };
  const nowYm = today().slice(0, 7);
  const FUND_AR = { '1101': 'من الخزينة الرئيسية', '1201': 'من البنك', '3101': 'قيد افتتاحي (رصيد سابق)', none: '' };
  const depByMonth = {};
  const assetRows = (org.assets || []).map(a => {
    const cost = Number(a.cost) || 0;
    const nM = Math.max(1, Math.round((Number(a.lifeYears) || 0) * 12));
    if (cost > 0 && a.fund && a.fund !== 'none' && accIx[a.fund]) push({
      id: 'ast:' + a.id, date: (a.buyDate || '').slice(0, 10), title: 'شراء أصل ثابت — ' + (a.name || '') + ' (' + (FUND_AR[a.fund] || '') + ')',
      src: 'الأصول الثابتة', ref: a.id,
      lines: [L('1701', cost, 0), L(a.fund, 0, cost)]
    });
    let accum = 0, monthsDone = 0;
    if (cost > 0 && (Number(a.lifeYears) || 0) > 0 && a.buyDate) {
      const base = Math.floor(cost / nM * 100) / 100;
      const start = ymAdd(a.buyDate.slice(0, 7), 1);       // الإهلاك من الشهر التالي للشراء
      for (let k = 0; k < nM; k++) {
        const ym = ymAdd(start, k);
        if (ym > nowYm) break;
        const amt = k === nM - 1 ? Math.round((cost - base * (nM - 1)) * 100) / 100 : base;
        depByMonth[ym] = Math.round(((depByMonth[ym] || 0) + amt) * 100) / 100;
        accum = Math.round((accum + amt) * 100) / 100; monthsDone++;
      }
    }
    return { ...a, cost, nM, monthly: Math.floor(cost / nM * 100) / 100, accum, book: Math.round((cost - accum) * 100) / 100, monthsDone, done: monthsDone >= nM };
  });
  Object.keys(depByMonth).sort().forEach(ym => {
    if (depByMonth[ym] <= 0) return;
    push({
      id: 'dep:' + ym, date: ym + '-28', title: 'إهلاك شهر ' + ym + ' (قسط ثابت — كل الأصول)',
      src: 'الأصول الثابتة', ref: 'dep-' + ym,
      lines: [L('5701', depByMonth[ym], 0), L('1791', 0, depByMonth[ym])]
    });
  });

  // ٩مكرر) القيود اليدوية والافتتاحية — يُدخلها المحاسب من شاشة المحاسبة (التصحيح بقيد عكسي لا بالحذف)
  (ops.journalManual || []).forEach(j => {
    push({
      id: 'man:' + j.id, date: (j.date || '').slice(0, 10),
      title: j.title || 'قيد يدوي', src: j.opening ? 'قيد افتتاحي' : 'قيد يدوي',
      ref: j.by || '', manual: true,
      lines: (j.lines || []).map(l => L(l.code, l.debit || 0, l.credit || 0))
    });
  });

  // ===== الترقيم والتجميع =====
  entries.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id));
  entries.forEach((e, i) => { e.no = 'ق-' + String(i + 1).padStart(4, '0'); });
  entries.forEach(e => e.lines.forEach(l => {
    const a = accIx[l.code]; if (!a) return;
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
    totalDebit, totalCredit,
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

const ALL_TABS = ['dash', 'compare', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'suppliers', 'inv', 'partners', 'acct', 'shifts', 'archive', 'ai', 'reports', 'admin', 'audit'];
const TAB_AR = {
  dash: 'لوحة المؤشرات', compare: 'مقارنة الفروع', closing: 'الإغلاق اليومي', apps: 'التطبيقات',
  approve: 'التدقيق والاعتماد', treasury: 'الخزينة والترحيل', payroll: 'الرواتب والسلف',
  suppliers: 'الموردون والمشتريات', inv: 'المخزون والمنتجات', partners: 'دفتر الشركاء',
  acct: 'المحاسبة', shifts: 'الورديات', archive: 'أرشيف المستندات', ai: 'المركز الذكي',
  reports: 'التقارير المالية', admin: 'الفروع والمستخدمون', audit: 'سجل التدقيق'
};
const ROLES = {
  // ===== الأدوار الخمسة المعتمدة =====
  cashier: {
    ar: 'كاشير — إدخال إغلاق اليوم', badge: 'b-sky', scope: 'own', create: true, todayOnly: true,
    tabs: ['closing'],
    perms: ['إنشاء وترحيل إغلاق اليوم لفرعه', 'جرد الصندوق وإدخال المبيعات والمصروفات', 'اليوم الحالي فقط دون سجلّ سابق']
  },
  branch_manager: {
    ar: 'مدير الفرع', badge: 'b-mint', scope: 'own', create: true,
    tabs: ['closing', 'apps', 'archive'],
    perms: ['إدخال وترحيل إغلاق فرعه', 'عرض سجل إغلاقات فرعه', 'أرشيف مستندات فرعه فقط']
  },
  regional_manager: {
    ar: 'مدير إقليمي — فروع مُسندة', badge: 'b-amber', scope: 'assigned',
    tabs: ['dash', 'compare', 'closing', 'apps', 'reports', 'archive'],
    perms: ['متابعة الفروع المسندة إليه فقط', 'مقارنة وتقارير فروعه ولوحة مؤشراتها', 'بلا وصول للمحاسبة والخزينة والإعدادات']
  },
  head_office: {
    ar: 'المكتب الرئيسي — المالية والإدارة', badge: 'b-brass', scope: 'all', approver: true,
    tabs: ['dash', 'compare', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'suppliers', 'inv', 'partners', 'acct', 'shifts', 'archive', 'ai', 'reports', 'audit'],
    perms: ['كل الفروع والتقارير المجمّعة', 'التدقيق والاعتماد النهائي', 'الخزينة والرواتب والموردون والمشتريات والمخزون', 'المحاسبة الكاملة: قيود وميزان وقوائم وضريبة وأصول ومراكز تكلفة']
  },
  system_admin: {
    ar: 'مسؤول النظام — وصول كامل', badge: 'b-rose', scope: 'all', create: true, admin: true, approver: true,
    tabs: ALL_TABS.slice(),
    perms: ['وصول كامل غير مقيّد', 'إدارة الفروع والمستخدمين والأدوار', 'إعدادات النظام والنسخ الاحتياطي']
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
    tabs: ['dash', 'compare', 'closing', 'apps', 'approve', 'treasury', 'payroll', 'suppliers', 'inv', 'partners', 'acct', 'shifts', 'archive', 'ai', 'reports', 'audit'],
    perms: ['المحاسبة كاملة: قيود يدوية وافتتاحية وميزان وقوائم ومراكز تكلفة', 'الضريبة والأصول والتسوية البنكية (عرض وتسجيل — التفعيل للإدارة)', 'المشتريات والمخزون والرواتب والخزينة', 'كل الفروع — دون إدارة المستخدمين والإعدادات']
  }
};

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
  { id: 'shifts', ar: 'الورديات والتذكيرات', en: 'Shifts & Reminders', cat: 'pos', icon: Clock, open: { tab: 'shifts' }, kw: ['وردية', 'تذكير', 'موعد'], fns: ['جدول الورديات', 'تذكيرات الإغلاق'], d: 'مواعيد الورديات وتذكيرات ما قبل الإغلاق.' },
  { id: 'brmgmt', ar: 'الفروع والمستخدمون', en: 'Branches & Users', cat: 'pos', icon: UserCog, open: { tab: 'admin' }, kw: ['فرع', 'مستخدم', 'صلاحية', 'شعار', 'تصنيف', 'تطبيق توصيل'], fns: ['إدارة الفروع', 'المستخدمون والأدوار', 'تصنيفات المصروفات', 'تطبيقات التوصيل وعمولاتها', 'النظام'], d: 'إدارة الفروع والمستخدمين والصلاحيات وإعدادات النظام.' },
  // ——— المشتريات والموردون ———
  { id: 'suppliers', ar: 'الموردون والالتزامات', en: 'Suppliers & Payables', cat: 'pur', icon: Truck, open: { tab: 'suppliers' }, kw: ['مورد', 'فاتورة', 'سداد', 'التزام', 'أعمار', 'استحقاق', 'إيجار'], fns: ['فواتير التوريد الآجلة', 'السداد المركزي', 'الإيجارات والفواتير الثابتة', 'سجل الموردين'], d: 'فواتير الموردين وسداداتها والتزامات الفروع الثابتة.' },
  { id: 'partners', ar: 'دفتر الشركاء', en: 'Partners Ledger', cat: 'pur', icon: Users, open: { tab: 'partners' }, kw: ['عميل', 'مورد', 'موظف', 'كشف حساب', 'ذمم', 'مدين', 'دائن', 'فاتورة'], fns: ['كشف حساب لكل شريك', 'ترقيم تلقائي', 'طلبات إضافة باعتماد', 'حركات يدوية'], d: 'عملاء وموردون وموظفون — مدين ودائن وكشف حساب لكل شريك.' },
  { id: 'po', ar: 'أوامر الشراء', en: 'Purchase Orders', cat: 'pur', icon: ClipboardCheck, open: { tab: 'suppliers' }, kw: ['أمر شراء', 'طلب', 'استلام', 'مورد'], fns: ['إنشاء أمر بنود وأسعار', 'استلام كلي أو جزئي يغذي المخزون', 'تحويل لفاتورة بحقل ضريبي'], d: 'أمر شراء ← استلام ← فاتورة ← سداد — من تبويب أوامر الشراء في شاشة الموردين.' },
  // ——— الموارد البشرية ———
  { id: 'payroll', ar: 'الرواتب والسلف', en: 'Payroll & Advances', cat: 'hr', icon: Wallet, open: { tab: 'payroll' }, kw: ['راتب', 'سلفة', 'خصم', 'استحقاق', 'صرف', 'موظف', 'قسيمة'], fns: ['كشف رواتب شهري', 'سلف وخصومات', 'ترحيل الاستحقاق والصرف للدفتر', 'قسائم رواتب'], d: 'كشف الرواتب والسلف والخصومات — مرحّلة محاسبياً باستحقاقها وصرفها.' },
  // ——— الزكاة والضريبة (خطة م٣) ———
  { id: 'vat', ar: 'ضريبة القيمة المضافة', en: 'VAT', cat: 'tax', icon: Receipt, open: { tab: 'acct', view: 'vat' }, kw: ['ضريبة', 'زاتكا', 'مدخلات', 'مخرجات', 'فاتورة', 'إقرار'], fns: ['تفعيل بنسبة قابلة للضبط', 'فصل المخرجات في قيد الإيراد', 'فصل مدخلات المصروفات الخاضعة', 'مؤشرات بالفترة'], d: 'فصل تلقائي لضريبة المخرجات والمدخلات في القيود — بأثر رجعي فور التفعيل.' },
  { id: 'vatret', ar: 'الإقرار الضريبي', en: 'VAT Return', cat: 'tax', icon: FileText, open: { tab: 'acct', view: 'vat' }, kw: ['إقرار', 'ضريبة', 'ربع', 'زاتكا'], fns: ['مسودة إقرار بالفترة', 'زر الربع الحالي', 'صافي المستحق'], d: 'مسودة إقرار جاهزة من قيودك لأي فترة تحددها.' },
  // ——— المخزون (خطة م٤) ———
  { id: 'products', ar: 'المنتجات والوصفات', en: 'Products & Recipes', cat: 'inv2', icon: Store, open: { tab: 'inv', view: 'recipes' }, kw: ['منتج', 'وصفة', 'تكلفة', 'هامش', 'مخزون'], fns: ['وصفة بمكونات من الأصناف', 'تكلفة حقيقية بآخر شراء', 'هامش لحظي (صافي الضريبة)'], d: 'وصفة وتكلفة وهامش لكل منتج — من أصناف مخزونك وأسعارها الفعلية.' },
  { id: 'stock', ar: 'المخزون والجرد', en: 'Stock & Stocktake', cat: 'inv2', icon: HardDrive, open: { tab: 'inv', view: 'items' }, kw: ['مستودع', 'جرد', 'حركة', 'رصيد', 'هدر', 'مخزون', 'حد أدنى'], fns: ['أرصدة حية بحد أدنى وتنبيه', 'توريد وصرف وهدر', 'جرد بعدّ فعلي وتسويات موثقة'], d: 'أرصدة أصنافك وحركاتها وجردها الدوري — والتوريد من أوامر الشراء تلقائي.' },
  // ——— الأصول والتسويات (خطة م٥) ———
  { id: 'assets', ar: 'الأصول الثابتة والإهلاك', en: 'Fixed Assets', cat: 'ast', icon: Building2, open: { tab: 'acct', view: 'ast' }, kw: ['أصل', 'إهلاك', 'معدات', 'قيمة دفترية'], fns: ['سجل أصول بمصدر تمويل صريح', 'إهلاك شهري تلقائي بأثر رجعي', 'قيمة دفترية حية'], d: 'سجل أصولك وقيود شرائها وإهلاكها الشهري تلقائياً حتى نهاية عمرها.' },
  { id: 'bankrec', ar: 'التسوية البنكية', en: 'Bank Reconciliation', cat: 'ast', icon: Landmark, open: { tab: 'acct', view: 'bank' }, kw: ['بنك', 'تسوية', 'كشف', 'مطابقة', 'شبكة', 'فرق'], fns: ['رصيد الدفتر مقابل كشف البنك', 'فرق موثق بسجل تسويات', 'حركات البنك مفصلة'], d: 'طابق حساب البنك التجميعي مع كشفك الفعلي ووثّق الفروقات — والتصحيح بقيد يدوي.' },
  // ——— التدقيق والحوكمة ———
  { id: 'audit', ar: 'سجل التدقيق', en: 'Audit Trail', cat: 'gov', icon: Eye, open: { tab: 'audit' }, kw: ['تدقيق', 'سجل', 'عملية', 'حوكمة', 'من فعل'], fns: ['كل عملية باسم صاحبها ووقتها', 'تنبيهات حية لمدير النظام'], d: 'من فعل ماذا ومتى — سجل كامل لا يُمحى لكل حركة في النظام.' },
  { id: 'archive', ar: 'أرشيف المستندات', en: 'Documents Archive', cat: 'gov', icon: ImageIcon, open: { tab: 'archive' }, kw: ['مستند', 'صورة', 'أرشيف', 'وثيقة', 'إيصال'], fns: ['صور الإغلاقات والإيصالات', 'تصفح بالفرع والتاريخ'], d: 'كل صور التوثيق والإيصالات مؤرشفة بالفرع والتاريخ.' },
  // ——— التحليل والذكاء المالي ———
  { id: 'ai', ar: 'المركز المالي الذكي', en: 'Financial Intelligence', cat: 'bi', icon: Sparkles, open: { tab: 'ai' }, kw: ['تحليل', 'ذكاء', 'توقع', 'انحراف', 'نسبة', 'اتجاه'], fns: ['مؤشرات وتحليلات', 'كشف الانحرافات', 'توصيات'], d: 'قراءة ذكية لأرقامك: اتجاهات وانحرافات وتوصيات.' }
];
const REG_IX = {}; REG_APPS.forEach(a => { REG_IX[a.id] = a; });
// تفضيلات الاستخدام لكل مستخدم (مفضلة + آخر استخدام) — محلية على الجهاز
const appUseGet = (uid) => { try { return JSON.parse(localStorage.getItem('rms8:appuse:' + uid) || '{}') || {}; } catch { return {}; } };
const appUseSet = (uid, v) => { try { localStorage.setItem('rms8:appuse:' + uid, JSON.stringify(v)); } catch { } };
const appCanSee = (role, a) => {
  const R = ROLES[role] || {};
  if (a.soon) return R.scope === 'all';                    // خارطة الطريق تظهر لأدوار المركز فقط
  return (R.tabs || []).includes(a.open.tab);              // نفس صلاحيات النظام حرفياً — لا طبقة موازية
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
  setTab(a.open.tab);
  return true;
};



/* ============================================================
   منصة سحابية متكاملة لإدارة وإغلاق فروع المطاعم
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
    expenseCats: EXP_CATS.map(c => ({ ...c, budgetLimitMonthly: 0 })),
    deliveryApps: APPS,
    suppliers: [],
    partners: [],
    setupComplete: false
  };
}

function emptyOps() {
  return { closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [], ledgerEntries: [], partnerRequests: [], journalManual: [], purchaseOrders: [], stockMoves: [], bankRecs: [] };
}


/* ================= الجذر ================= */
export default function App() {
  const [org, setOrg] = useState(null);
  const [ops, setOps] = useState({ closings: [], transfers: [], advances: [], notifications: [], invoices: [], fixedExpenses: [], disbursements: [], ledgerEntries: [], partnerRequests: [], journalManual: [], purchaseOrders: [], stockMoves: [], bankRecs: [] });
  const [pulse, setPulse] = useState({ presence: {}, audit: [] });
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('dash');
  const [acctIntent, setAcctIntent] = useState(null);          // فتح المحاسبة على شاشة محددة من مركز التطبيقات
  const openAcctView = useCallback((v) => setAcctIntent({ v, ts: Date.now() }), []);
  const [invIntent, setInvIntent] = useState(null);            // فتح المخزون على شاشة محددة
  const openInvView = useCallback((v) => setInvIntent({ v, ts: Date.now() }), []);
  const [drawer, setDrawer] = useState(false);
  const [moreSheet, setMoreSheet] = useState(false);
  const touchRef = useRef({ x0: 0, y0: 0, active: false, mode: null });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [boot, setBoot] = useState('loading');
  const [toast, setToast] = useState(null);
  const [bell, setBell] = useState(false);
  const [lastSeenAudit, setLastSeenAudit] = useState(() => Date.now());
  const [theme, setTheme] = useState('dark');
  const [tour, setTour] = useState(false);
  const [live, setLive] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const sid = useRef(uid('s'));

  const say = useCallback((msg, kind) => {
    setToast({ msg, kind: kind || 'ok' });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* --- الإقلاع: مع المصادقة السحابية لا تُحمَّل أي بيانات قبل دخول حقيقي --- */
  const [needAuth, setNeedAuth] = useState(false);

  const loadAll = useCallback(async () => {
    let o = await cloud.get(KEYS.org, null);
    if (!o || !o.branches) {
      o = emptyOrg();
      await cloud.set(KEYS.org, o);
      await cloud.set(KEYS.ops, emptyOps());
      await cloud.set(KEYS.pulse, { presence: {}, audit: [] });
      setOps(emptyOps());
    } else {
      const p = await cloud.get(KEYS.ops, null);
      setOps(p || emptyOps());
    }
    setOrg(o);
    setPulse(await cloud.get(KEYS.pulse, { presence: {}, audit: [] }));
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
    const o = await loadAll();
    const u = (o.users || []).find(x => (x.email || '').toLowerCase() === email && x.isActive);
    if (!u && (o.users || []).length > 0) {
      await authApi.signOutAll().catch(() => { });
      return { ok: false, err: 'حسابك موثّق لكنه غير مُسجَّل في المنصة — يضيفه مسؤول النظام من «الفروع والمستخدمون»' };
    }
    setNeedAuth(false);
    if (u) {
      setMe(u); setTab((ROLES[u.role]?.tabs || ['closing'])[0]);
      try { localStorage.setItem('rms8:lastEmail', u.email || ''); } catch { }
    }
    return { ok: true };   // لا مستخدمين بعد → شاشة التهيئة الأولى
  }, [loadAll]);

  const fbLogin = useCallback(async (email, pass) => {
    try { const r = await authApi.signIn(email, pass); return await finishFb(r.email); }
    catch (e) { return { ok: false, err: mapAuthErr(e) }; }
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
    wire('org', KEYS.org, setOrg);
    wire('ops', KEYS.ops, setOps);
    wire('pulse', KEYS.pulse, setPulse);
    if (subs.length) setLive(true);
    return () => subs.forEach(u => u());
  }, [boot, needAuth]);

  useEffect(() => {
    if (boot !== 'ready') return;
    // مع الاستماع اللحظي يكفي استطلاع احتياطي متباعد
    const t = setInterval(() => refresh(true), live ? 45000 : 8000);
    return () => clearInterval(t);
  }, [boot, live, refresh]);

  /* --- تنبيهات النشاط الحيّة لمدراء النظام: إشعار متصفح + صوت لأي نشاط من الآخرين --- */
  const actBaseRef = useRef(Date.now());
  useEffect(() => { actBaseRef.current = Date.now(); }, [me]);
  useEffect(() => {
    if (!me || !ROLES[me.role]?.admin) return;
    const cfg = notifyCfg();
    if (!cfg.on) return;
    const fresh = (pulse.audit || []).filter(e => (e.at || 0) > actBaseRef.current && e.userName !== me.name);
    if (!fresh.length) return;
    actBaseRef.current = Math.max(...fresh.map(e => e.at || 0));
    const e = fresh[0];
    const more = fresh.length > 1 ? ` (+${fresh.length - 1} نشاط آخر)` : '';
    const body = `${e.userName}: ${e.title}${e.details ? ' — ' + String(e.details).slice(0, 90) : ''}${more}`;
    notifyBrowser('نشاط جديد — ' + (org.company?.name || 'المنصة'), body, org.company?.logoUrl);
    if (cfg.sound) alertBeep();
  }, [pulse, me, org]);

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
        id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role,
        userRoleLabel: (ROLES[me.role] || {}).ar || me.role, ...log
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
      const entry = { id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role, userRoleLabel: (ROLES[me.role] || {}).ar || me.role, ...log };
      const nx = { ...pu, audit: [entry, ...(pu.audit || [])].slice(0, 150) };
      await cloud.set(KEYS.pulse, nx);
      setPulse(nx);
    }
    setLastSync(new Date());
    return true;
  }, [org, me, say]);

  const resetAll = useCallback(async () => {
    if (!window.confirm('سيُحذف كل ما أدخلته نهائياً (الإغلاقات، الموظفون، الموردون) وتعود المنصة فارغة. هل أنت متأكد؟')) return;
    const keepCompany = org?.company;
    const o = emptyOrg(keepCompany); const p = emptyOps();
    await cloud.set(KEYS.org, o); await cloud.set(KEYS.ops, p);
    await cloud.set(KEYS.pulse, { presence: {}, audit: [] });
    setOrg(o); setOps(p); setPulse({ presence: {}, audit: [] });
    say('تمت إعادة المنصة إلى الوضع الفارغ');
  }, [say, org]);

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

  // مصادقة سحابية مفعّلة ولا جلسة: بوابة الدخول الحقيقية قبل تحميل أي بيانات
  if (needAuth && !me) {
    return <FbGate css={CSS} theme={theme} fbLogin={fbLogin} fbFirstSetup={fbFirstSetup} />;
  }

  // أول تشغيل: لا يوجد أي مستخدم بعد → شاشة التسجيل الأولي لإنشاء حساب المالك
  if ((org.users || []).length === 0) {
    return <FirstRun css={CSS} theme={theme} commitOrg={commitOrg} say={say}
      onDone={(u) => { setMe(u); setTab('admin'); }} />;
  }

  if (!me) {
    return <Gate css={CSS} theme={theme} org={org}
      onLogin={(u) => { setMe(u); setTab((ROLES[u.role]?.tabs || ['closing'])[0]); }}
      online={Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 70000)} />;
  }

  const smartAlertCount = computeSmartAlerts(org, ops, myBranches).length;
  const unread = (ops.notifications || []).filter(n => !n.isRead).length + smartAlertCount;
  const pending = scoped.closings.filter(c => c.status === 'submitted').length;
  const online = Object.values(pulse.presence || {}).filter(p => Date.now() - p.at < 70000);

  // النشاط الجديد منذ آخر مشاهدة للسجل (تنبيه مستمر)
  const auditLog = pulse.audit || [];
  const newActivity = auditLog.filter(a => (a.at || Date.parse(a.timestamp) || 0) > lastSeenAudit && a.userName !== me.name);
  const latestActivity = auditLog[0];

  const NAV = [
    { id: 'dash', ar: 'لوحة المؤشرات', icon: LayoutDashboard },
    { id: 'compare', ar: 'مقارنة الفروع', icon: BarChart3 },
    { id: 'closing', ar: 'الإغلاق اليومي', icon: ClipboardCheck },
    { id: 'apps', ar: 'التطبيقات', icon: Grid3x3 },
    { id: 'approve', ar: 'التدقيق والاعتماد', icon: ShieldCheck, cnt: pending },
    { id: 'treasury', ar: 'الخزينة والترحيل', icon: Landmark },
    { id: 'payroll', ar: 'الرواتب والسلف', icon: Wallet },
    { id: 'suppliers', ar: 'الموردون والالتزامات', icon: Truck },
    { id: 'inv', ar: 'المخزون والمنتجات', icon: HardDrive },
    { id: 'partners', ar: 'دفتر الشركاء', icon: Users },
    { id: 'acct', ar: 'المحاسبة', icon: Scale },
    { id: 'shifts', ar: 'الورديات والتذكيرات', icon: Clock },
    { id: 'archive', ar: 'أرشيف المستندات', icon: ImageIcon },
    { id: 'ai', ar: 'المركز المالي الذكي', icon: Sparkles },
    { id: 'reports', ar: 'التقارير المالية', icon: FileBarChart },
    { id: 'admin', ar: 'الفروع والمستخدمون', icon: UserCog },
    { id: 'audit', ar: 'سجل التدقيق', icon: Eye }
  ].filter(n => (ROLES[me.role]?.tabs || []).includes(n.id));

  const shared = { org, ops, pulse, me, myBranches, scoped, commit, commitOrg, say, setTab, theme, acctIntent, openAcctView, invIntent, openInvView };

  // حماية: منع الوصول لتبويب غير مسموح لدور المستخدم (بلا hook — بعد returns الشرطية)
  const allowedTabs = NAV.map(n => n.id);
  const safeTab = allowedTabs.includes(tab) ? tab : (allowedTabs[0] || 'closing');

  return (
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
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
              : <div className="brand-mark">{(org.company.name || 'مذ').trim().charAt(0) || 'م'}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-t">{org.company.name}</div>
              <div className="brand-s">CLOUD CLOSING SUITE</div>
            </div>
            <button className="btn sm gh sideclose" onClick={() => setDrawer(false)} title="إخفاء القائمة">
              <X size={18} />
            </button>
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
            <h1 className="toptitle">{NAV.find(n => n.id === safeTab)?.ar}</h1>
            <span style={{ fontSize: 11, color: '#1a1410', background: 'var(--mint)', fontFamily: 'monospace', flexShrink: 0, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>v8.0 🎯</span>
            <div className="topstatus">
              <div className="row avrow" style={{ gap: 0 }}>
                {online.slice(0, 4).map((p, i) => (
                  <div key={i} className="av" title={p.name} style={{ background: clr(i) }}>{p.name.charAt(0)}</div>
                ))}
              </div>
              <span className={'badge livebadge ' + (live ? 'b-mint' : 'b-dim')}
                title={live ? 'مزامنة لحظية عبر Firestore' : 'مزامنة دورية كل 8 ثوانٍ'}>
                <span className="dot" />{online.length}{live ? ' · لحظي' : ''}
              </span>
              <button className="btn sm gh synctime" onClick={() => refresh(false)} title="مزامنة الآن">
                <RefreshCw size={14} className={syncing ? 'spin' : ''} />
                <span className="num tt" style={{ fontSize: 10, color: 'var(--faint)' }}>
                  {lastSync ? lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
              </button>
              <button className="btn sm gh themebtn" title="تبديل السمة"
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
            <div className="page-inner">
              {safeTab === 'dash' && <Dashboard {...shared} online={online} />}
              {safeTab === 'compare' && <BranchCompare {...shared} />}
              {safeTab === 'closing' && <Closing {...shared} />}
              {safeTab === 'apps' && <AppsCenter {...shared} />}
              {safeTab === 'approve' && <Approvals {...shared} />}
              {safeTab === 'treasury' && <Treasury {...shared} />}
              {safeTab === 'payroll' && <Payroll {...shared} />}
              {safeTab === 'suppliers' && <Suppliers {...shared} />}
              {safeTab === 'inv' && <Inventory {...shared} />}
              {safeTab === 'partners' && <Partners {...shared} />}
              {safeTab === 'acct' && <Accounting {...shared} />}
              {safeTab === 'shifts' && <Shifts {...shared} />}
              {safeTab === 'archive' && <Archive {...shared} />}
              {safeTab === 'ai' && <AiCenter {...shared} />}
              {safeTab === 'reports' && <Reports {...shared} />}
              {safeTab === 'admin' && <Admin {...shared} />}
              {safeTab === 'audit' && <AuditView {...shared} onSeen={() => setLastSeenAudit(Date.now())} />}
            </div>
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
        {(NAV.length <= 5 ? NAV : NAV.slice(0, 4)).map(n => (
          <button key={n.id} className={'botnav-i' + (tab === n.id ? ' on' : '')} onClick={() => { setTab(n.id); setMoreSheet(false); }}>
            <n.icon size={20} />
            <span>{n.ar.split(' ')[0]}</span>
            {n.cnt > 0 && <span className="bdg">{n.cnt}</span>}
          </button>
        ))}
        {NAV.length > 5 && (
          <button className={'botnav-i botnav-more' + (moreSheet ? ' on' : '')} onClick={() => setMoreSheet(v => !v)}>
            <Grid3x3 size={20} />
            <span>الأقسام</span>
            {(pending + unread) > 0 && !moreSheet && <span className="bdg">{pending + unread}</span>}
          </button>
        )}
      </nav>
      </div>



      {moreSheet && (
        <div className="sheet-mask" onClick={() => setMoreSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <span>كل الأقسام</span>
              <button className="btn sm gh" onClick={() => setMoreSheet(false)}><X size={16} /></button>
            </div>
            <div className="iconsgrid">
              {NAV.map(n => (
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
function BrandHead({ title, sub, logo }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      {logo
        ? <img src={logo} alt="شعار" style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 16, objectFit: 'cover', border: '1px solid var(--line)', display: 'block' }} />
        : <div className="brand-mark" style={{ width: 54, height: 54, margin: '0 auto 14px', fontSize: 19, borderRadius: 16 }}>
          {(title || 'المنصة').trim().charAt(0) || 'م'}
        </div>}
      <h1 style={{ fontSize: 20 }}>{title || 'منصة إغلاق وإدارة الفروع'}</h1>
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
    const passHash = await sha(f.pass);
    const owner = {
      id: uid('u'), name: f.name.trim(), email: f.email.trim().toLowerCase(),
      role: 'system_admin', passHash, isActive: true, createdAt: today()
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
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
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
function FbGate({ css, theme, fbLogin, fbFirstSetup }) {
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
    if (!r.ok) setErr(r.err || 'تعذّر الدخول');
  };

  return (
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <BrandHead title="منصة الإغلاق اليومي" sub="دخول موثّق — البيانات محمية بحساب مصادقة لكل مستخدم" />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="badge b-mint"><Lock size={10} />مصادقة سحابية مفعّلة</span>
          </div>
          <div className="card">
            {setup && <div style={{ border: '1px solid rgba(200,162,74,.4)', background: 'rgba(200,162,74,.08)', color: 'var(--brass-l)', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.7 }}>
              الإعداد الأول (مرة واحدة بعد الترقية): أدخل بريد المالك وكلمة سر جديدة — يُنشأ حساب المصادقة وتصبح مديرًا للمنصة.
            </div>}
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
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, lineHeight: 1.7, textAlign: 'center' }}>
              نسيت كلمة السر؟ اطلب من المدير «إرسال رابط تعيين كلمة السر» من إدارة المستخدمين.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gate({ css, org, onLogin, online, theme }) {
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

  return (
    <div className={'rms' + (theme === 'lite' ? ' lite' : '')}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gate">
        <div className="gate-c">
          <BrandHead title={org.company?.name || 'منصة إغلاق الفروع'} sub="منصة سحابية متكاملة لإغلاق وإدارة فروع المطاعم" logo={org.company?.logoUrl} />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="badge b-mint"><span className="dot" />{online.length} متصل الآن</span>
            <span className="badge b-dim"><Lock size={10} />بيانات مشتركة ومؤمّنة</span>
          </div>
          <div className="card">
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
  ), document.body);
}

function Field({ label, children, style }) {
  return <div className="fld" style={style}><label className="lbl">{label}</label>{children}</div>;
}

// حقل مالي ذكي: تنسيق حيّ (١٬٢٥٠٫٠٠) + دعم عدة مبالغ في حقل واحد عند sum
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
function OutputDialog({ rec, org, onDone, onCancel }) {
  const [method, setMethod] = useState('both');
  const [size, setSize] = useState('80');
  const [phase, setPhase] = useState('choose'); // choose | confirm
  const [attempts, setAttempts] = useState(0);
  const [pdfOk, setPdfOk] = useState(false);
  const [printConfirmed, setPrintConfirmed] = useState(false);
  const [printFailed, setPrintFailed] = useState(false);
  const [pdfAck, setPdfAck] = useState(false);
  const [hash, setHash] = useState('');

  const needPdf = method === 'pdf' || method === 'both';
  const needPrint = method === 'print' || method === 'both';

  const runOutputs = async () => {
    const h = await sha([rec.transferReferenceNo, rec.branchName, rec.date, rec.totalRevenue, rec.totalExpenses, rec.actualCashCount, rec.variance, rec.transferredToMainTreasury].join('|'));
    setHash(h);
    if (needPdf) { const ok = printClosingA4(rec, org); setPdfOk(ok !== false); }
    if (needPrint) { const ok = printReceipt(rec, org, size); setAttempts(1); setPrintFailed(ok === false); }
    setPhase('confirm');
  };
  const reprint = () => { const ok = printReceipt(rec, org, size); setAttempts(a => a + 1); setPrintFailed(ok === false); };
  const regenPdf = () => { const ok = printClosingA4(rec, org); setPdfOk(ok !== false); };

  // يكفي لإتمام الإغلاق أن يكون المُخرَج الرسمي قد أُنشئ فعلاً (بعد «متابعة الإخراج»).
  // تأكيد الطباعة وحالة الـPDF تُسجَّل في التدقيق لكنها لا تحجب الإتمام حتى لا يعلق المستخدم.
  const canFinish = phase === 'confirm';
  const finish = () => onDone({
    outputMethod: method === 'both' ? 'طباعة + PDF' : method === 'pdf' ? 'PDF فقط' : 'طباعة حرارية',
    thermalSize: needPrint ? size + 'مم' : '—',
    pdfStatus: needPdf ? (pdfOk ? 'تم الإنشاء' : 'فشل') : 'غير مطلوب',
    printStatus: needPrint ? (printConfirmed ? 'تمت' : printFailed ? 'فشلت' : 'غير مؤكدة') : 'غير مطلوب',
    printAttempts: attempts, device: deviceType(), browser: browserName(), reportHash: hash
  });

  const opt = (k, lbl, tag) => (
    <button key={k} type="button" onClick={() => setMethod(k)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start', marginBottom: 8, padding: '13px 14px', borderRadius: 12, cursor: 'pointer', minHeight: 44,
        border: '1px solid ' + (method === k ? 'var(--brass)' : 'var(--line)'), background: method === k ? 'rgba(200,162,74,.1)' : 'var(--ink3)', color: 'var(--txt)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600 }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (method === k ? 'var(--brass)' : 'var(--faint)'), flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {method === k && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brass)' }} />}
      </span>
      <span style={{ flex: 1 }}>{lbl}</span>
      <span className="badge b-dim" style={{ fontSize: 9.5 }}>{tag}</span>
    </button>
  );
  const statusRow = (label, node) => (
    <div className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(120,100,80,.14)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5 }}>{label}</span>{node}
    </div>
  );

  return (
    <Modal title="إخراج الإغلاق الرسمي — خطوة إلزامية" icon={Printer} onClose={onCancel}
      foot={phase === 'confirm'
        ? <>
            <button className="btn pri" disabled={!canFinish} onClick={finish}><Check size={14} />إتمام الإغلاق</button>
            <button className="btn gh" onClick={onCancel}>إلغاء الإغلاق</button>
          </>
        : <>
            <button className="btn pri" onClick={runOutputs}><Printer size={14} />متابعة الإخراج</button>
            <button className="btn gh" onClick={onCancel}>إلغاء</button>
          </>}>
      {phase === 'choose' ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 12 }}>
            لا يمكن إتمام الإغلاق قبل اختيار مُخرَج رسمي واحد على الأقل:
          </div>
          {opt('both', '🖨 + 📄  طباعة حرارية + تقرير PDF', 'موصى به')}
          {opt('print', '🖨  طباعة حرارية للكاشير', '58/80مم')}
          {opt('pdf', '📄  تقرير PDF رسمي', 'A4')}
          {needPrint && (
            <div style={{ marginTop: 12 }}>
              <div className="lbl">حجم ورق طابعة الكاشير</div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className={'btn sm' + (size === '80' ? ' pri' : ' gh')} onClick={() => setSize('80')}>80مم</button>
                <button type="button" className={'btn sm' + (size === '58' ? ' pri' : ' gh')} onClick={() => setSize('58')}>58مم</button>
              </div>
            </div>
          )}
          <div className="cflow-alert" style={{ border: '1px solid rgba(91,147,196,.4)', background: 'rgba(91,147,196,.1)', color: 'var(--sky)', marginTop: 14, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8 }}>
            <span>ℹ</span><span style={{ fontSize: 11.5, lineHeight: 1.6 }}>تُرسَل الطباعة عبر نافذة الطباعة في المتصفح — اختر طابعة الكاشير (58/80مم) المثبّتة على الجهاز. سيُطلب منك تأكيد نجاح الطباعة قبل اعتماد الإغلاق.</span>
          </div>
        </>
      ) : (
        <>
          {needPdf && statusRow('📄 تقرير PDF الرسمي',
            (pdfOk || pdfAck) ? <span className="badge b-mint"><Check size={11} />{pdfOk ? 'تم الإنشاء — عايِنه ونزّله من النافذة' : 'مُتابَع'}</span>
              : <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="badge b-rose">لم تُفتح النافذة</span><button className="btn sm" onClick={regenPdf}>إعادة</button><button className="btn sm gh" onClick={() => setPdfAck(true)}>متابعة بدونها</button></span>)}
          {needPrint && (
            <>
              {statusRow(<span>🖨 طباعة حرارية {size}مم · محاولات: <span className="num">{attempts}</span></span>,
                printConfirmed ? <span className="badge b-mint"><Check size={11} />تمت الطباعة</span>
                  : <span className="badge b-amber">بانتظار تأكيدك</span>)}
              {!printConfirmed && (
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn sm pri" onClick={() => { setPrintConfirmed(true); setPrintFailed(false); }}><Check size={13} />نعم، تمت الطباعة</button>
                  <button className="btn sm" onClick={reprint}><RefreshCw size={13} />أعد المحاولة</button>
                  <button className="btn sm gh" onClick={() => { const ns = size === '80' ? '58' : '80'; setSize(ns); }}>بدّل الحجم</button>
                </div>
              )}
            </>
          )}
          <div className="cflow-alert" style={{ border: '1px solid rgba(200,162,74,.35)', background: 'rgba(200,162,74,.08)', color: 'var(--dim)', marginTop: 14, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, fontSize: 11 }}>
            <span>🔒</span><span>بصمة التقرير الرقمية: <span className="num" style={{ fontSize: 10 }}>{(hash || '').slice(0, 20)}…</span><br />الجهاز: {deviceType()} · المتصفح: {browserName()} — تُحفظ في سجل التدقيق.</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 10, textAlign: 'center', lineHeight: 1.7 }}>
            تم إنشاء المُخرَج الرسمي — اضغط «إتمام الإغلاق» لإنهاء الوردية وبدء وردية جديدة.
            {needPrint && !printConfirmed ? ' (تأكيد الطباعة اختياري ويُسجَّل في التدقيق.)' : ''}
          </div>
        </>
      )}
    </Modal>
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
      <div className="kpi-v num">{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

/* ============ الخطوة 2: محرّك التنبيهات الذكية الاستباقية ============ */
function computeSmartAlerts(org, ops, myBranches, deficitThreshold = 50) {
  const alerts = [];
  const ids = myBranches.map(b => b.id);
  const td = today();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // 1) فروع لم تُغلق بعد موعدها اليوم
  myBranches.forEach(b => {
    const closed = (ops.closings || []).some(c => c.branchId === b.id && c.date === td);
    if (!closed && b.shiftEndTime) {
      const [h, m] = b.shiftEndTime.split(':').map(Number);
      if (nowMin > (h * 60 + m) + 30) {
        alerts.push({ id: 'late-' + b.id, sev: 'high', icon: 'clock',
          title: 'فرع تأخّر عن الإغلاق', msg: `${b.name} تجاوز موعد الإغلاق (${b.shiftEndTime}) ولم يُسجّل إغلاقه بعد.` });
      }
    }
  });

  // 2) عجز صندوق يتجاوز الحد اليوم
  (ops.closings || []).filter(c => countedClosing(c) && c.date === td && ids.includes(c.branchId) && c.variance < -deficitThreshold)
    .forEach(c => alerts.push({ id: 'def-' + c.id, sev: 'high', icon: 'down',
      title: 'عجز صندوق تجاوز الحد', msg: `${c.branchName}: عجز ${money(c.variance)} ر.س في إغلاق اليوم.` }));

  // 3) فواتير موردين تستحق اليوم أو غداً أو متأخرة
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
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

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => order[a.sev] - order[b.sev]);
}

const ALERT_ICON = { clock: Clock, down: TrendingDown, truck: Truck, wallet: Wallet, bell: Bell };

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
    const next = { on: !ncfg.on, sound: ncfg.sound };
    saveNotifyCfg(next); setNcfg(next);
    if (next.on) setNMsg('مفعّلة — ستصلك إشعارات أي نشاط يقوم به الآخرون أثناء فتح المنصة (ولو في تبويب خلفي)');
  };
  const toggleSound = () => { const next = { on: ncfg.on, sound: !ncfg.sound }; saveNotifyCfg(next); setNcfg(next); };
  const testNow = () => {
    const ok = notifyBrowser('تجربة تنبيه — ' + (org.company?.name || 'المنصة'), 'هكذا سيصلك إشعار النشاط', org.company?.logoUrl);
    if (ncfg.sound) alertBeep();
    setNMsg(ok ? 'أُرسلت التجربة ✓' : 'تعذّر الإشعار — تأكد من تفعيله ومن إذن المتصفح');
  };

  return (
    <Modal title="مركز التنبيهات" icon={Bell} onClose={onClose}
      foot={<><button className="btn" onClick={markAll}><Check size={14} />تعليم الكل كمقروء</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      {isAdminRole && (
        <div className="card" style={{ background: 'var(--ink)', padding: 12, marginBottom: 14, border: '1px solid ' + (ncfg.on ? 'rgba(79,178,134,.45)' : 'var(--line)') }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Radio size={14} color={ncfg.on ? 'var(--mint)' : 'var(--brass)'} />تنبيهات النشاط الحيّة (هذا الجهاز)
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.6 }}>
                إشعار وصوت لأي نشاط يقوم به الآخرون — ترحيل إغلاق، سداد، تعديل… أثناء فتح المنصة.
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
function DailyBranchReport({ org, scoped, myBranches, onClose }) {
  const [date, setDate] = useState(today());
  const [scope, setScope] = useState('all'); // all | one | some
  const [oneBranch, setOneBranch] = useState(myBranches[0]?.id || '');
  const [someIds, setSomeIds] = useState([]);

  const targetBranches = scope === 'all' ? myBranches
    : scope === 'one' ? myBranches.filter(b => b.id === oneBranch)
    : myBranches.filter(b => someIds.includes(b.id));

  const dayClosings = scoped.closings.filter(c => countedClosing(c) && c.date === date &&
    targetBranches.some(b => b.id === c.branchId));

  const toggleSome = (id) => setSomeIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // طباعة تقرير مجمّع ليوم واحد لكل الفروع المحددة
  const printConsolidated = () => {
    const co = org.company || {};
    const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const T = {
      rev: sum(dayClosings, c => c.totalRevenue), exp: sum(dayClosings, c => c.totalExpenses),
      cash: sum(dayClosings, c => c.cashSales), card: sum(dayClosings, c => c.cardSales),
      bank: sum(dayClosings, c => c.bankTransferSales || 0), del: sum(dayClosings, c => c.totalDeliverySales),
      transfer: sum(dayClosings, c => c.transferredToMainTreasury), variance: sum(dayClosings, c => c.variance)
    };
    const rows = dayClosings.map(c => `<tr>
      <td>${c.branchName}</td>
      <td class="num brass">${m(c.totalRevenue)}</td>
      <td class="num">${m(c.cashSales)}</td>
      <td class="num">${m(c.cardSales)}</td>
      <td class="num">${m(c.bankTransferSales || 0)}</td>
      <td class="num">${m(c.totalDeliverySales)}</td>
      <td class="num rose">${m(c.totalExpenses)}</td>
      <td class="num mint">${m(c.totalRevenue - c.totalExpenses)}</td>
      <td class="num">${m(c.transferredToMainTreasury)}</td>
      <td class="num ${c.variance < 0 ? 'rose' : ''}">${m(c.variance)}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير الفروع اليومي - ${date}</title><style>${A4_CSS}</style></head><body><div class="page">
      <div class="head">
        <div class="co">${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` : ''}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div></div></div>
        <div class="doc-title">تقرير الإغلاق اليومي المجمّع للفروع</div>
        <div class="doc-sub">${arDate(date)} · عدد الفروع: ${dayClosings.length}</div>
        <div class="doc-sub dim">تاريخ التصدير: ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>إجمالي الإيرادات</span><b class="brass">${m(T.rev)} ر.س</b></div>
        <div class="kpi"><span>إجمالي المصروفات</span><b class="rose">${m(T.exp)} ر.س</b></div>
        <div class="kpi ok"><span>صافي اليوم</span><b>${m(T.rev - T.exp)} ر.س</b></div>
        <div class="kpi"><span>المحوّل للخزينة</span><b>${m(T.transfer)} ر.س</b></div>
        <div class="kpi"><span>المبيعات النقدية</span><b>${m(T.cash)} ر.س</b></div>
        <div class="kpi ${T.variance === 0 ? 'ok' : T.variance < 0 ? 'bad' : 'warn'}"><span>فروقات الصندوق</span><b>${m(T.variance)} ر.س</b></div>
      </div>
      <table class="t"><thead><tr>
        <th>الفرع</th><th class="num">الإيراد</th><th class="num">نقدي</th><th class="num">شبكة</th>
        <th class="num">تحويل</th><th class="num">تطبيقات</th><th class="num">المصروف</th>
        <th class="num">الصافي</th><th class="num">للخزينة</th><th class="num">فروقات</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="10" class="ce dim">لا إغلاقات في هذا اليوم للفروع المحددة</td></tr>'}</tbody>
      <tfoot><tr class="tot"><td>الإجمالي</td>
        <td class="num brass">${m(T.rev)}</td><td class="num">${m(T.cash)}</td><td class="num">${m(T.card)}</td>
        <td class="num">${m(T.bank)}</td><td class="num">${m(T.del)}</td><td class="num rose">${m(T.exp)}</td>
        <td class="num mint">${m(T.rev - T.exp)}</td><td class="num">${m(T.transfer)}</td>
        <td class="num">${m(T.variance)}</td></tr></tfoot></table>
      <div class="foot dim">تقرير مجمّع لأغراض الإدارة · ${co.name || ''}</div>
      </div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // طباعة تقرير رسمي منفصل لكل فرع (كل إغلاق في صفحته)
  const printEachDetailed = () => {
    if (dayClosings.length === 0) return;
    const co = org.company || {};
    const pages = dayClosings.map(c => buildClosingA4(c, org)).join('<div style="page-break-after:always"></div>');
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقارير الفروع اليومية - ${date}</title><style>${A4_CSS}</style></head><body>${pages}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <Modal title="طباعة تقارير الفروع اليومية" icon={FileText} onClose={onClose}
      foot={<>
        <button className="btn pri" disabled={dayClosings.length === 0} onClick={printConsolidated}>
          <FileText size={14} />تقرير مجمّع
        </button>
        <button className="btn" disabled={dayClosings.length === 0} onClick={printEachDetailed}>
          <Printer size={14} />تقرير رسمي لكل فرع
        </button>
        <button className="btn gh" onClick={onClose}>إغلاق</button>
      </>}>
      <Field label="اليوم">
        <input type="date" className="inp" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="نطاق الفروع">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className={'btn sm' + (scope === 'all' ? ' pri' : ' gh')} onClick={() => setScope('all')}>جميع الفروع</button>
          <button type="button" className={'btn sm' + (scope === 'some' ? ' pri' : ' gh')} onClick={() => setScope('some')}>فروع محددة</button>
          <button type="button" className={'btn sm' + (scope === 'one' ? ' pri' : ' gh')} onClick={() => setScope('one')}>فرع واحد</button>
        </div>
      </Field>
      {scope === 'one' && (
        <Field label="اختر الفرع">
          <select className="sel" value={oneBranch} onChange={e => setOneBranch(e.target.value)}>
            {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      {scope === 'some' && (
        <Field label="اختر الفروع المطلوبة">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {myBranches.map(b => (
              <button key={b.id} type="button" className={'btn sm' + (someIds.includes(b.id) ? ' pri' : ' gh')}
                onClick={() => toggleSome(b.id)}>{b.name}</button>
            ))}
          </div>
        </Field>
      )}
      <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 4 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>الإغلاقات المتاحة في هذا اليوم</span>
          <span className="badge b-brass"><span className="num">{dayClosings.length}</span> من {targetBranches.length} فرع</span>
        </div>
        {dayClosings.length > 0 && (
          <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {dayClosings.map(c => <span key={c.id} className="badge b-dim">{c.branchName}: <span className="num">{money(c.totalRevenue)}</span></span>)}
          </div>
        )}
        {dayClosings.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 8 }}>
            لا توجد إغلاقات مسجّلة في هذا اليوم للفروع المحددة. اختر يوماً آخر أو نطاقاً مختلفاً.
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============ الخطوة 1: لوحة مقارنة الفروع الفورية ============ */
function BranchCompare({ org, ops, me, myBranches, scoped, theme, setTab }) {
  const tn = chartTone(theme);
  const [day, setDay] = useState(today());

  const rows = useMemo(() => myBranches.map(b => {
    const c = scoped.closings.find(x => countedClosing(x) && x.branchId === b.id && x.date === day);
    return {
      id: b.id, name: b.name,
      closed: !!c,
      status: c ? c.status : 'none',
      rev: c ? c.totalRevenue : 0,
      exp: c ? c.totalExpenses : 0,
      net: c ? c.totalRevenue - c.totalExpenses : 0,
      cash: c ? c.cashSales : 0,
      variance: c ? c.variance : 0,
      transfer: c ? c.transferredToMainTreasury : 0,
      shiftEnd: b.shiftEndTime || ''
    };
  }), [myBranches, scoped, day]);

  const closedCount = rows.filter(r => r.closed).length;
  const pendingRows = rows.filter(r => !r.closed);
  const deficitRows = rows.filter(r => r.closed && r.variance < 0);
  const totRev = sum(rows, r => r.rev);
  const totNet = sum(rows, r => r.net);
  const sorted = [...rows].filter(r => r.closed).sort((a, b) => b.rev - a.rev);
  const top = sorted[0], bottom = sorted[sorted.length - 1];

  // هل تأخّر فرع عن موعد إغلاقه؟
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = day === today();
  const late = (r) => {
    if (!isToday || r.closed || !r.shiftEnd) return false;
    const [h, m] = r.shiftEnd.split(':').map(Number);
    return nowMin > (h * 60 + m) + 30; // متأخر أكثر من 30 دقيقة
  };

  const barData = sorted.map(r => ({ name: r.name.replace('الفرع ', '').replace('فرع ', ''), الإيراد: r.rev, المصروف: r.exp }));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مقارنة الفروع الفورية</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>نظرة شاملة على أداء كل الفروع في يوم واحد</div>
        </div>
        <input type="date" className="inp" style={{ width: 'auto' }} value={day} onChange={e => setDay(e.target.value)} />
      </div>

      <div className="grid g4">
        <Kpi label="فروع أغلقت" value={`${closedCount} / ${rows.length}`} icon={CheckCircle2} color="#4FB286" />
        <Kpi label="إجمالي الإيراد" value={money(totRev)} icon={TrendingUp} color="#C8A24A" />
        <Kpi label="صافي المجموعة" value={money(totNet)} icon={Landmark} color={totNet >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="فروع بعجز" value={deficitRows.length} icon={AlertTriangle} color={deficitRows.length ? '#D9544D' : '#4FB286'} />
      </div>

      {/* تنبيهات فورية */}
      {(pendingRows.length > 0 || deficitRows.length > 0) && (
        <div className="card" style={{ borderColor: 'rgba(224,164,88,.35)' }}>
          <div className="card-h"><div className="card-t"><Bell size={15} color="#E0A458" />تنبيهات اليوم</div></div>
          <div className="grid" style={{ gap: 8 }}>
            {pendingRows.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', background: late(r) ? 'rgba(217,84,77,.1)' : 'var(--ink)', borderRadius: 9, border: '1px solid ' + (late(r) ? 'rgba(217,84,77,.3)' : 'var(--line)') }}>
                <span className="row" style={{ gap: 8, fontSize: 12.5 }}>
                  {late(r) ? <AlertTriangle size={14} color="#D9544D" /> : <Clock size={14} color="#E0A458" />}
                  {r.name}
                </span>
                <span className="badge" style={{ color: late(r) ? '#D9544D' : '#E0A458', borderColor: 'currentColor', fontSize: 10 }}>
                  {late(r) ? 'متأخر عن الإغلاق' : 'لم يُغلق بعد'}{r.shiftEnd ? ' · ' + r.shiftEnd : ''}
                </span>
              </div>
            ))}
            {deficitRows.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(217,84,77,.1)', borderRadius: 9, border: '1px solid rgba(217,84,77,.3)' }}>
                <span className="row" style={{ gap: 8, fontSize: 12.5 }}><TrendingDown size={14} color="#D9544D" />{r.name}</span>
                <span className="badge" style={{ color: '#D9544D', borderColor: 'currentColor', fontSize: 10 }}>عجز صندوق <span className="num">{money(r.variance)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الأفضل والأضعف */}
      {closedCount > 1 && (
        <div className="grid g2">
          <div className="card" style={{ background: 'linear-gradient(135deg,rgba(79,178,134,.1),transparent)' }}>
            <div className="row" style={{ gap: 8, color: '#4FB286', fontSize: 12, marginBottom: 6 }}><ArrowUp size={15} />الأعلى إيراداً</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{top?.name}</div>
            <div className="num" style={{ fontSize: 22, color: '#4FB286', marginTop: 4 }}>{money(top?.rev || 0)}</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg,rgba(217,84,77,.08),transparent)' }}>
            <div className="row" style={{ gap: 8, color: '#D9544D', fontSize: 12, marginBottom: 6 }}><ArrowDown size={15} />الأدنى إيراداً</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{bottom?.name}</div>
            <div className="num" style={{ fontSize: 22, color: '#D9544D', marginTop: 4 }}>{money(bottom?.rev || 0)}</div>
          </div>
        </div>
      )}

      {/* رسم بياني مقارن */}
      {barData.length > 0 && (
        <div className="card">
          <div className="card-h"><div className="card-t"><BarChart3 size={15} />الإيراد مقابل المصروف لكل فرع</div></div>
          <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 46)}>
            <BarChart data={barData} layout="vertical" margin={{ right: 12, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tn.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: tn.tick, fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: tn.tick, fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="الإيراد" fill="#4FB286" radius={[0, 4, 4, 0]} />
              <Bar dataKey="المصروف" fill="#D9544D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* جدول تفصيلي */}
      <div className="card">
        <div className="card-h"><div className="card-t"><Building2 size={15} />تفاصيل كل الفروع</div></div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الفرع</th><th>الحالة</th><th className="num">الإيراد</th><th className="num">المصروف</th>
              <th className="num">الصافي</th><th className="num">نقدي</th><th className="num">للخزينة</th><th className="num">الفرق</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    {!r.closed ? <span className="badge b-dim" style={{ fontSize: 10 }}>لم يُغلق</span>
                      : r.status === 'approved' ? <span className="badge b-mint" style={{ fontSize: 10 }}>معتمد</span>
                      : r.status === 'submitted' ? <span className="badge b-amber" style={{ fontSize: 10 }}>بانتظار</span>
                      : <span className="badge b-brass" style={{ fontSize: 10 }}>مغلق</span>}
                  </td>
                  <td className="num brass">{r.closed ? money(r.rev) : '—'}</td>
                  <td className="num rose">{r.closed ? money(r.exp) : '—'}</td>
                  <td className="num" style={{ color: r.net >= 0 ? '#4FB286' : '#D9544D' }}>{r.closed ? money(r.net) : '—'}</td>
                  <td className="num">{r.closed ? money(r.cash) : '—'}</td>
                  <td className="num">{r.closed ? money(r.transfer) : '—'}</td>
                  <td className="num" style={{ color: r.variance < 0 ? '#D9544D' : r.variance > 0 ? '#E0A458' : 'var(--dim)' }}>{r.closed ? money(r.variance) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ org, ops, pulse, me, myBranches, scoped, online, setTab, theme, openAcctView, openInvView }) {
  const [days, setDays] = useState(14);
  const [dayReport, setDayReport] = useState(false);
  const tn = chartTone(theme);

  // منصة جديدة بلا فروع بعد → دليل البدء
  if ((org.branches || []).length === 0) {
    const steps = [
      { n: 1, t: 'أضف فروعك', d: 'سجّل كل فرع باسمه ومدينته والعهدة الافتتاحية.', to: 'admin', ic: Building2, done: false },
      { n: 2, t: 'أنشئ حسابات المستخدمين', d: 'مدير لكل فرع، ومحاسب للإدارة المالية — بريد وكلمة سر لكل منهم.', to: 'admin', ic: Users, done: false },
      { n: 3, t: 'أضف الموظفين', d: 'لتفعيل كشوف الرواتب والسلف.', to: 'admin', ic: UserCog, done: (org.employees || []).length > 0 },
      { n: 4, t: 'سجّل أول إغلاق يومي', d: 'ابدأ التشغيل الفعلي بإغلاق وردية.', to: 'closing', ic: ClipboardCheck, done: false }
    ];
    return (
      <div className="grid" style={{ gap: 14 }}>
        <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>مرحباً {me.name.split(' ')[0]} — لنبدأ التهيئة</h2>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.9 }}>
            هذه منصة حية جديدة بلا بيانات تجريبية. أكمل الخطوات التالية لتشغيلها. كل ما تدخله يُحفظ سحابياً ويظهر لبقية المستخدمين فوراً.
          </div>
        </div>
        <div className="grid g2">
          {steps.map(st => (
            <div key={st.n} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="brand-mark" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: st.done ? 'linear-gradient(145deg,#4FB286,#2E8B62)' : 'linear-gradient(145deg,var(--brass),var(--brass-d))' }}>
                {st.done ? <Check size={18} /> : <st.ic size={17} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>الخطوة {st.n}: {st.t}</div>
                  {st.done && <span className="badge b-mint">تم</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', margin: '5px 0 10px', lineHeight: 1.7 }}>{st.d}</div>
                <button className="btn sm pri" onClick={() => setTab(st.to)}>ابدأ</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cls = scoped.closings.filter(countedClosing);
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
      <AppsStrip me={me} setTab={setTab} openAcctView={openAcctView} openInvView={openInvView} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مرحباً {me.name.split(' ')[0]} 👋</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            {myBranches.length} فرع ضمن نطاق صلاحيتك · آخر {days} يوماً
          </div>
        </div>
        <div className="row">
          <button className="btn sm pri" onClick={() => setDayReport(true)}>
            <FileText size={14} />تقارير الفروع اليومية
          </button>
          {[7, 14, 30].map(d => (
            <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      {dayReport && <DailyBranchReport org={org} scoped={scoped} myBranches={myBranches} onClose={() => setDayReport(false)} />}

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
function Closing({ org, ops, me, myBranches, scoped, commit, commitOrg, say }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const canEdit = !!ROLES[me.role]?.create;
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [bid, setBid] = useState('all');
  const [fromD, setFromD] = useState('');
  const [toD, setToD] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(15);

  const filtered = [...scoped.closings]
    .filter(c => !ROLES[me.role]?.todayOnly || c.date === today())
    .filter(c => st === 'all' || c.status === st)
    .filter(c => bid === 'all' || c.branchId === bid)
    .filter(c => !fromD || c.date >= fromD)
    .filter(c => !toD || c.date <= toD)
    .filter(c => !q || (c.branchName + c.date + (c.managerName || '')).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const list = filtered.slice(0, limit);

  const remove = (c) => commit(
    d => ({ ...d, closings: d.closings.filter(x => x.id !== c.id), transfers: d.transfers.filter(t => t.closingId !== c.id) }),
    { actionType: 'delete', targetType: 'daily_closing', targetId: c.id, branchName: c.branchName, title: 'حذف إغلاق يومي', details: `${c.branchName} — ${arDate(c.date)}` }
  ).then(() => say('تم حذف الإغلاق'));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="pagehead">
        <div>
          <h2 className="pagehead-t">الإغلاق اليومي</h2>
          <div className="pagehead-s">مطابقة النقدية وترحيلها للخزينة الرئيسية</div>
        </div>
        {canEdit && (
          <button className="btn pri newclosing-btn" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus size={16} />إغلاق وردية جديد
          </button>
        )}
      </div>

      {/* زر عائم دائم الظهور على الجوال — لا يختفي بالتمرير */}
      {canEdit && (
        <button className="btn pri fab-new" onClick={() => { setEdit(null); setOpen(true); }} aria-label="فتح نموذج إغلاق وردية جديد">
          <Plus size={20} /><span className="fab-lbl">إغلاق وردية</span>
        </button>
      )}

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 7, flex: 1, minWidth: 0 }}>
              <Search size={14} color="var(--faint)" style={{ flexShrink: 0 }} />
              <input className="inp" style={{ flex: 1, minWidth: 0 }} placeholder="بحث سريع..."
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button className={'btn sm' + (showFilters || st !== 'all' || bid !== 'all' || fromD || toD ? ' pri' : ' gh')}
              onClick={() => setShowFilters(v => !v)} style={{ flexShrink: 0 }}>
              <Search size={13} />فلترة
              {(st !== 'all' || bid !== 'all' || fromD || toD) && <span className="num" style={{ marginInlineStart: 3 }}>•</span>}
            </button>
            <span className="badge b-dim" style={{ flexShrink: 0 }}><span className="num">{filtered.length}</span></span>
          </div>
          {showFilters && (
            <div className="card" style={{ padding: 12, marginTop: 10, background: 'var(--ink)' }}>
              <div className="grid g2" style={{ gap: 10 }}>
                <Field label="الحالة">
                  <select className="sel" value={st} onChange={e => setSt(e.target.value)}>
                    <option value="all">كل الحالات</option>
                    <option value="draft">مسودة</option>
                    <option value="submitted">مرحّل للمراجعة</option>
                    <option value="approved">مدقّق ومعتمد</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </Field>
                {myBranches.length > 1 && (
                  <Field label="الفرع">
                    <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
                      <option value="all">كل الفروع</option>
                      {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="من تاريخ">
                  <input type="date" className="inp" value={fromD} onChange={e => setFromD(e.target.value)} />
                </Field>
                <Field label="إلى تاريخ">
                  <input type="date" className="inp" value={toD} onChange={e => setToD(e.target.value)} />
                </Field>
              </div>
              {(q || st !== 'all' || bid !== 'all' || fromD || toD) && (
                <button className="btn sm gh" style={{ marginTop: 10 }} onClick={() => { setQ(''); setSt('all'); setBid('all'); setFromD(''); setToD(''); }}>
                  <X size={13} />مسح كل الفلاتر
                </button>
              )}
            </div>
          )}
        </div>
        <div className="tw">
          <table className="tb cards">
            <thead><tr>
              <th>التاريخ</th><th>الفرع</th><th>الإيراد</th><th>المصروف</th>
              <th>المتوقع بالصندوق</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td className="num" data-label="التاريخ" style={{ whiteSpace: 'nowrap' }}>{arDate(c.date)}</td>
                  <td data-label="الفرع" style={{ fontSize: 12 }}>{c.branchName}</td>
                  <td className="num" data-label="الإيراد" style={{ color: 'var(--brass)' }}>{money(c.totalRevenue)}</td>
                  <td className="num" data-label="المصروف" style={{ color: 'var(--rose)' }}>{money(c.totalExpenses)}</td>
                  <td className="num" data-label="المتوقع بالصندوق">{money(c.expectedCashInSafe)}</td>
                  <td className="num" data-label="الفعلي">{money(c.actualCashCount)}</td>
                  <td className="num" data-label="الفرق" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>
                    {c.variance > 0 ? '+' : ''}{money(c.variance)}
                  </td>
                  <td data-label="الحالة"><Badge s={c.status} /></td>
                  <td className="acts">
                    <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                      <button className="btn sm gh" onClick={() => setView(c)}><Eye size={13} /></button>
                      {canEdit && (c.status === 'draft' || c.status === 'rejected') && (
                        <>
                          <button className="btn sm gh" onClick={() => { setEdit(c); setOpen(true); }}>{c.status === 'rejected' ? 'تصحيح' : 'تعديل'}</button>
                          {c.status === 'draft' && <button className="btn sm gh" onClick={() => remove(c)}><Trash2 size={13} color="#D9544D" /></button>}
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
        <ClosingForm key={formKey} org={org} me={me} branches={myBranches} initial={edit} commit={commit} commitOrg={commitOrg} say={say}
          existing={ops.closings || []} invoices={ops.invoices || []}
          onStartNew={() => { setEdit(null); setFormKey(k => k + 1); }}
          onClose={() => { setOpen(false); setEdit(null); }} />
      )}
      {view && <ClosingView c={view} org={org} onClose={() => setView(null)} />}
    </div>
  );
}

// ترحيل سدادات الصيغة القديمة {method, amount} إلى خانات التوزيع — حتى لا يضيع المبلغ عند التعديل
function normalizeSupPays(arr) {
  return (arr || []).map(pm => {
    if (pm.cash != null || pm.card != null || pm.transfer != null || pm.other != null) return pm;
    const s = paySplits(pm);
    const { method, amount, ...rest } = pm;
    return { ...rest, ...s };
  });
}

export function ClosingForm({ org, me, branches, initial, commit, commitOrg, say, onClose, onStartNew, existing = [], invoices = [] }) {
  const [f, setF] = useState(() => initial ? { ...initial, supplierPayments: normalizeSupPays(initial.supplierPayments) } : {
    date: today(), branchId: branches[0]?.id || '',
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
      notes: !!(d.notes || d.managerSignature || d.sessionPhoto),
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

  const totalDelivery = sum(f.deliverySales, d => d.amount);
  const totalRevenue = f.cashSales + f.cardSales + (f.bankTransferSales || 0) + totalDelivery;
  const cashExp = sum(f.expenses.filter(e => e.paymentMethod === 'cash'), e => e.amount);
  const totalExp = sum(f.expenses, e => e.amount);
  const supPays = f.supplierPayments || [];
  const totalSupplierPay = sum(supPays, payTotal);
  const cashSupplierPay = sum(supPays, payCashPart);
  // السداد النقدي للموردين يخرج من الصندوق فيقلّل النقد المتوقع (لضبط الجرد)
  const expected = f.openingBalance + f.cashSales - cashExp - cashSupplierPay;
  const actual = countDenoms(f.denominationDetails);
  const variance = Math.round((actual - expected) * 100) / 100;
  const retained = Math.max(0, actual - f.transferredToMainTreasury);

  const setDen = (k, v) => set('denominationDetails', { ...f.denominationDetails, [k]: Math.max(0, v) });
  const addDelivApp = () => set('deliverySales', [...f.deliverySales, { appId: uid('app'), appName: '', amount: 0, orderCount: 0, commissionPercentage: 0, custom: true }]);
  const upDeliv = (i, k, v) => { const n = [...f.deliverySales]; n[i] = { ...n[i], [k]: v }; set('deliverySales', n); };
  const removeDeliv = (i) => set('deliverySales', f.deliverySales.filter((_, x) => x !== i));

  // شركاء الرئيسي المتاحون للربط (موردون + موظفون + عملاء)
  const partyOptions = buildPartners(org, {}).map(p => ({ key: p.key, id: p.id, name: p.name, type: (PT_TYPE[p.type] || {}).ar || 'عميل', code: p.code }));
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
    if (!canWriteOrg) {
      // دور غير إداري: طلب اعتماد يصل للإدارة في دفتر الشركاء، والاسم يُسجَّل نصياً في السطر فوراً
      const req = {
        id: uid('pr'), name: nameQ, type: np.type || 'supplier', cat: np.cat || '', phone: np.phone || '',
        requestedBy: me.name, branchId: f.branchId, branchName: branch?.name || '', at: nowISO()
      };
      const okReq = await commit(d => ({ ...d, partnerRequests: [req, ...(d.partnerRequests || [])] }), {
        actionType: 'create', targetType: 'user_account', targetId: req.id,
        title: 'طلب إضافة شريك للرئيسي', details: nameQ + ' — ' + (PT_TYPE[req.type] || { ar: 'عميل' }).ar + ' · بانتظار اعتماد الإدارة'
      });
      if (okReq) {
        if (np.target === 'pay') linkPayParty(np.rowId, '', nameQ, undefined);
        else linkExpParty(np.rowId, '', nameQ, undefined);
        say('أُرسل طلب اعتماد «' + nameQ + '» للإدارة — والاسم مسجّل في السطر ✓');
        setNewParty(null);
      }
      return;
    }
    if (!commitOrg) return say('لا تملك صلاحية الإضافة للرئيسي', 'no');
    const name = nameQ, id = uid('pt');
    const code = nextPartnerCode(buildPartners(org, {}), np.type === 'supplier' ? 'supplier' : np.type === 'employee' ? 'employee' : (np.type || 'customer'));
    let key, mut;
    if (np.type === 'supplier') { key = 'sup:' + id; mut = d => ({ ...d, suppliers: [...(d.suppliers || []), { id, code, name, category: np.cat || '', phone: np.phone || '', vatNo: '', terms: 0 }] }); }
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

  // بناء سجل الإغلاق بعد التحقّق (يعيد null عند فشل التحقّق)
  const buildRecord = (status) => {
    if (!f.branchId) { say('اختر الفرع أولاً', 'no'); return null; }
    if (totalRevenue <= 0) { say('أدخل مبيعات الوردية قبل الحفظ', 'no'); return null; }
    // المرفوض لا يمنع إعادة إغلاق اليوم — حتى لا يُقفل اليوم نهائيًا بعد الرفض
    const dup = existing.find(c => c.branchId === f.branchId && c.date === f.date && c.id !== initial?.id && c.status !== 'rejected');
    if (dup) { say('يوجد إغلاق مسجّل لهذا الفرع بنفس التاريخ — عدّل الإغلاق القائم بدل إنشاء نسخة ثانية', 'no'); return null; }
    if (status === 'submitted') {
      if (actual <= 0) { say('أكمل جرد الفئات النقدية قبل الترحيل', 'no'); return null; }
      if (variance !== 0 && !f.varianceReason.trim()) { say('وثّق سبب العجز أو الفائض قبل الترحيل', 'no'); return null; }
      if (f.transferredToMainTreasury > actual) { say('المرحّل للخزينة يتجاوز النقد المعدود', 'no'); return null; }
      if (!f.sessionPhoto) { say('التقط صورة توثيق المسؤول قبل الترحيل — إجباري', 'no'); return null; }
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
      transferStatus: 'pending', status, gmApprovalStatus: 'pending',
      rejectionReason: status === 'submitted' ? '' : (f.rejectionReason || ''),
      createdBy: me.name, createdAt: initial?.createdAt || nowISO(), updatedAt: nowISO()
    };
    return { rec: { ...rec, closingNo: ref }, id, ref };
  };

  // إتمام الحفظ فعلياً + قيد التدقيق (out = بيانات الإخراج عند الإتمام)
  const finalize = async (status, recIn, id, ref, out) => {
    const rec = { ...recIn, completion: out ? { ...out, at: nowISO(), by: me.name } : (recIn.completion || null) };
    await commit(d => {
      // سياسة الاحتفاظ: بعد 60 يومًا تُنظَّف الصور من سجل الإغلاق (تبقى نسخها في أرشيف المستندات) لكبح تضخم التخزين
      const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const pruneImgs = (c) => {
        if (c.imagesPruned || !c.date || c.date >= cutoff || c.status === 'draft') return c;
        if (!c.sessionPhoto && !c.cardReceiptImage && !(c.expenses || []).some(e => e.receiptImage)) return c;
        return { ...c, sessionPhoto: '', cardReceiptImage: '', expenses: (c.expenses || []).map(e => e.receiptImage ? { ...e, receiptImage: '' } : e), imagesPruned: true };
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
      title: status === 'submitted' ? 'إتمام وترحيل إغلاق وردية' : 'حفظ مسودة إغلاق',
      details: `${rec.branchName} — ${arDate(f.date)} · إيراد ${money(totalRevenue)} · فرق ${money(variance)}`
        + (out ? ` · إخراج: ${out.outputMethod} · جهاز: ${out.device} · بصمة ${(out.reportHash || '').slice(0, 10)}` : ''),
      ...(out ? {
        closingNo: ref, outputMethod: out.outputMethod, printerSize: out.thermalSize,
        pdfStatus: out.pdfStatus, printStatus: out.printStatus, printAttempts: out.printAttempts,
        device: out.device, browser: out.browser, reportHash: out.reportHash
      } : {})
    });

    // ترحيل صور الإغلاق إلى أرشيف المستندات، مرتّبة حسب الفرع واليوم
    try {
      const stamp = arDate(f.date);
      const docs = [];
      const push = (img, cat, catLabel, title, amount) => {
        if (!img) return;
        docs.push({
          id: 'arc-' + id + '-' + cat + (docs.length),
          title, category: cat, categoryLabelAr: catLabel,
          branchId: f.branchId, branchName: rec.branchName,
          fileUrl: img, fileType: 'image', fileName: title + '.jpg',
          fileSizeKb: Math.round(img.length * 0.75 / 1024),
          uploadDate: f.date, uploadedBy: me.name, amount: amount || 0,
          closingId: id, source: 'closing', uploadedAt: nowISO()
        });
      };
      push(f.cardReceiptImage, 'pos_settlement', 'إثبات شبكة/تحويل', `إثبات الشبكة — ${rec.branchName} ${stamp}`, rec.cardSales);
      push(f.sessionPhoto, 'signature', 'توثيق المسؤول', `توثيق الإغلاق — ${rec.branchName} ${stamp}`, 0);
      (f.expenses || []).forEach((e) => push(e.receiptImage, 'expense', 'فاتورة مصروف',
        `${e.categoryName || 'مصروف'}${e.beneficiaryName ? ' — ' + e.beneficiaryName : ''} (${stamp})`, e.amount));

      if (docs.length) {
        const store = await cloud.get(KEYS.files, { items: [] });
        const prevItems = (store && Array.isArray(store.items)) ? store.items : [];
        const kept = prevItems.filter(x => x.closingId !== id);
        await cloud.set(KEYS.files, { items: [...docs, ...kept].slice(0, 1500) });
      }
    } catch (err) { /* الأرشفة تكميلية — لا توقف حفظ الإغلاق */ }

    setOutPrompt(false); setPend(null);
    if (status === 'submitted') {
      say('تم إغلاق الوردية بنجاح ✓');
      setDone({ branchName: rec.branchName, total: totalRevenue, ref });
    } else {
      say('تم حفظ المسودة');
      onClose();
    }
  };

  // المسودة تُحفظ مباشرة؛ أمّا الإتمام فيتطلب خطوة الإخراج الرسمية أولاً (#21)
  const save = (status) => {
    const built = buildRecord(status);
    if (!built) return;
    if (status === 'submitted') { setPend(built); setOutPrompt(true); }
    else finalize(status, built.rec, built.id, built.ref, null);
  };

  const vatDeduct = sum(f.expenses.filter(e => e.isTaxable), e => e.amount) * 15 / 115;
  const counted = actual > 0; // لم يُجرد الصندوق بعد؟ لا نُظهر عجزاً وهمياً
  const vColor = !counted ? 'var(--faint)' : variance < 0 ? 'var(--rose)' : variance > 0 ? 'var(--mint)' : 'var(--faint)';
  const vStat = !counted
    ? { c: 'var(--sky)', bg: 'rgba(91,147,196,.10)', bd: 'rgba(91,147,196,.40)', ic: '◔', t: 'أكمل جرد الصندوق (الخطوة ٣) لحساب الفرق' }
    : variance === 0
      ? { c: 'var(--mint)', bg: 'rgba(79,178,134,.12)', bd: 'rgba(79,178,134,.45)', ic: '✔', t: 'الصندوق مطابق — لا يوجد ما يمنع الترحيل' }
      : variance < 0
        ? { c: 'var(--rose)', bg: 'rgba(217,84,77,.12)', bd: 'rgba(217,84,77,.45)', ic: '⚠', t: `عجز ${money(Math.abs(variance))} ر.س — التوثيق إلزامي قبل الترحيل` }
        : { c: 'var(--amber)', bg: 'rgba(224,164,88,.12)', bd: 'rgba(224,164,88,.45)', ic: '▲', t: `فائض ${money(variance)} ر.س — راجع إدخالات المبيعات والمصروفات` };
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
    </>
  );

  const sec = (k, Ic, title, subt, valNode, done, body) => (
    <div className={'esec' + (secs[k] ? ' open' : '') + (done ? ' done' : '')}>
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
      foot={<>
        <button className="btn pri" onClick={() => save('submitted')}><Send size={14} />ترحيل للإدارة المالية</button>
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
            <div className="eclose-tools">
              <span className="hint">أقسام قابلة للطي — املأ ما يلزم، والملخّص يتحدّث فورًا</span>
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

          <div style={{ marginTop: 14 }}>
            {actual > 0 && (
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

            {sec('notes', FileText, 'التوثيق والملاحظات', 'ملاحظات · توقيع · صورة المسؤول', null, !!(f.notes || f.managerSignature || f.sessionPhoto), (
              <>
          <Field label="ملاحظات الإغلاق">
            <textarea className="inp" value={f.notes} placeholder="ملاحظات المدير على الوردية"
              onChange={e => set('notes', e.target.value)} />
          </Field>
          <Field label="صورة توثيق المسؤول (إجباري قبل الترحيل)">
            {f.sessionPhoto ? (
              <div className="row" style={{ alignItems: 'center' }}>
                <img src={f.sessionPhoto} alt="توثيق" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                <span className="badge b-mint"><Check size={11} />تم التوثيق</span>
                <button type="button" className="btn sm gh" onClick={() => set('sessionPhoto', '')}><Trash2 size={12} color="#D9544D" />إزالة</button>
              </div>
            ) : (
              <button type="button" className="btn sm" onClick={() => setCam(true)}>
                <ScanFace size={13} />التقاط صورة الوجه بالكاميرا
              </button>
            )}
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
        onCapture={(img) => { set('sessionPhoto', img); setCam(false); say('تم توثيق الصورة'); }} />}
      {outPrompt && pend && <OutputDialog rec={pend.rec} org={org}
        onCancel={() => { setOutPrompt(false); setPend(null); }}
        onDone={(out) => finalize('submitted', pend.rec, pend.id, pend.ref, out)} />}
      {newParty && (
        <Modal title={canWriteOrg ? 'إضافة شريك جديد إلى الرئيسي' : 'طلب إضافة شريك (باعتماد الإدارة)'} icon={Users} onClose={() => setNewParty(null)}
          foot={<><button className="btn pri" onClick={saveParty}><Check size={14} />{canWriteOrg ? 'حفظ وربط' : 'إرسال طلب الاعتماد'}</button>
            <button className="btn gh" onClick={() => setNewParty(null)}>إلغاء</button></>}>
          <Field label="النوع">
            <select className="sel" value={newParty.type} onChange={ev => setNewParty({ ...newParty, type: ev.target.value })}>
              <option value="supplier">مورد</option>
              <option value="employee">موظف</option>
              <option value="customer">عميل</option>
            </select>
          </Field>
          <Field label="الاسم"><input className="inp" autoFocus value={newParty.name} placeholder="اسم المورد/الموظف/العميل"
            onChange={ev => setNewParty({ ...newParty, name: ev.target.value })} /></Field>
          <div className="grid g2">
            <Field label={newParty.type === 'employee' ? 'المسمى الوظيفي' : 'التصنيف'}><input className="inp" value={newParty.cat}
              onChange={ev => setNewParty({ ...newParty, cat: ev.target.value })} placeholder={newParty.type === 'supplier' ? 'مثال: مواد خام' : ''} /></Field>
            <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={newParty.phone}
              onChange={ev => setNewParty({ ...newParty, phone: ev.target.value })} /></Field>
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6, lineHeight: 1.7 }}>
            {canWriteOrg
              ? 'يُسجَّل مباشرةً في الإدارة الرئيسية (دفتر الشركاء) ويُربط بهذا السطر — فيظهر في كشف حسابه.'
              : 'يصل الطلب للإدارة في «دفتر الشركاء» لاعتماده، ويُسجَّل الاسم نصياً في السطر فوراً. بعد الاعتماد يظهر الشريك بالسجل المركزي برقمه.'}
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
        </div>
      </Modal>}
    </Modal>
  );
}

function ClosingView({ c, org, onClose }) {
  const Row = ({ k, v, color }) => (
    <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(51,44,38,.5)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--dim)' }}>{k}</span><span className="num" style={{ color }}>{v}</span>
    </div>
  );
  return (
    <Modal wide title={`إغلاق ${c.branchName} — ${arDate(c.date)}`} icon={Receipt} onClose={onClose}
      foot={<><button className="btn pri" onClick={() => printClosingA4(c, org)}><FileText size={14} />تقرير PDF رسمي</button>
        <button className="btn" onClick={() => printReceipt(c, org)}><Printer size={14} />طباعة حرارية 80مم</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Badge s={c.status} />
        {c.gmApprovalStatus === 'approved' && <span className="badge b-brass"><ShieldCheck size={11} />معتمد من الإدارة العليا</span>}
        {c.imagesPruned && <span className="badge b-dim" title="سياسة الاحتفاظ 60 يومًا">🗄 صور هذا الإغلاق في أرشيف المستندات</span>}
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
          {c.cardReceiptImage && (
            <div style={{ marginTop: 8 }}>
              <div className="lbl">إثبات الشبكة / التحويل</div>
              <img src={c.cardReceiptImage} alt="إثبات"
                onClick={() => { const w = window.open(); if (w) w.document.write('<img src="'+c.cardReceiptImage+'" style="max-width:100%">'); }}
                style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, background: '#000', cursor: 'zoom-in' }} />
            </div>
          )}
        </div>
        <div className="card" style={{ background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>المصروفات</div>
          {(c.expenses || []).map(e => (
            <div key={e.id} style={{ paddingBottom: 4 }}>
              <Row k={`${e.categoryName}${e.beneficiaryName ? ' — ' + e.beneficiaryName : ''}`} v={money(e.amount)} />
              <div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span className="badge b-dim" style={{ fontSize: 9 }}>{({cash:'نقد',card:'شبكة',cheque:'شيك',bank_transfer:'تحويل',deferred:'آجل'})[e.paymentMethod] || e.paymentMethod}</span>
                {e.isTaxable ? <span className="badge b-brass" style={{ fontSize: 9 }}>خاضع للضريبة{e.taxInvoice ? ' · ضريبية' : ''}</span> : <span className="badge b-dim" style={{ fontSize: 9 }}>غير خاضع</span>}
                {e.receiptNumber && <span className="badge b-dim" style={{ fontSize: 9 }}>#{e.receiptNumber}</span>}
              </div>
              {e.receiptImage && <img src={e.receiptImage} alt="إيصال"
                onClick={() => { const w = window.open(); if (w) w.document.write('<img src="'+e.receiptImage+'" style="max-width:100%">'); }}
                style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6, margin: '4px 0 6px', cursor: 'zoom-in', border: '1px solid var(--line)' }} />}
            </div>
          ))}
          {(!c.expenses || c.expenses.length === 0) && <div className="empty" style={{ padding: 18 }}>لا مصروفات</div>}
          <Row k="الإجمالي" v={money(c.totalExpenses)} color="var(--rose)" />
        </div>
      </div>
      {(c.supplierPayments || []).filter(pm => payTotal(pm) > 0).length > 0 && (
        <div className="card" style={{ background: 'var(--ink)', marginTop: 12 }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>سداد الموردين خلال الوردية</div>
          {(c.supplierPayments || []).filter(pm => payTotal(pm) > 0).map(pm => (
            <div key={pm.id} style={{ paddingBottom: 4 }}>
              <Row k={pm.supplierName || 'مورد'} v={money(payTotal(pm))} color="var(--mint)" />
              <div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span className="badge b-dim" style={{ fontSize: 9 }}>{payLabel(pm) || '—'}</span>
                {pm.reference && <span className="badge b-dim" style={{ fontSize: 9 }}>#{pm.reference}</span>}
              </div>
            </div>
          ))}
          <Row k="الإجمالي — منه نقدًا من الصندوق" v={`${money(sum((c.supplierPayments || []), payCashPart))} / ${money(sum((c.supplierPayments || []), payTotal))}`} color="var(--mint)" />
        </div>
      )}
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
      {c.completion && (
        <div className="card" style={{ background: 'var(--ink)', marginTop: 14, borderColor: 'rgba(200,162,74,.3)' }}>
          <div className="card-t" style={{ fontSize: 12.5, marginBottom: 8 }}><ShieldCheck size={14} color="var(--brass)" />سجل إتمام الإغلاق — قيد تدقيق غير قابل للتعديل</div>
          <div className="grid g2" style={{ gap: 8 }}>
            <div className="mono-b"><span style={{ fontSize: 11 }}>رقم الإغلاق</span><span className="num" style={{ fontSize: 11 }}>{c.closingNo || c.transferReferenceNo || '—'}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>وسيلة الإخراج</span><span style={{ fontSize: 11.5 }}>{c.completion.outputMethod}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>حالة PDF</span><span style={{ fontSize: 11.5 }}>{c.completion.pdfStatus}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>الطباعة{c.completion.thermalSize && c.completion.thermalSize !== '—' ? ' (' + c.completion.thermalSize + ')' : ''}</span><span style={{ fontSize: 11.5 }}>{c.completion.printStatus} · محاولات <span className="num">{c.completion.printAttempts}</span></span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>الجهاز / المتصفح</span><span style={{ fontSize: 11 }}>{c.completion.device} · {c.completion.browser}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>المستخدم</span><span style={{ fontSize: 11 }}>{c.completion.by || c.managerName}</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 8, wordBreak: 'break-all' }}>🔒 بصمة التقرير الرقمية: <span className="num">{c.completion.reportHash || '—'}</span></div>
        </div>
      )}
    </Modal>
  );
}

/* ================= التدقيق والاعتماد ================= */
function Approvals({ org, me, scoped, commit, say }) {
  const [note, setNote] = useState({});
  const [view, setView] = useState(null);
  const isGM = !!ROLES[me.role]?.approver;
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
        const canAct = needAudit ? (ROLES[me.role]?.scope !== 'own' && ROLES[me.role]?.tabs?.includes('approve')) : isGM;
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
      {view && <ClosingView c={view} org={org} onClose={() => setView(null)} />}
    </div>
  );
}

/* ================= الخزينة الرئيسية ================= */
function Treasury({ org, ops, me, myBranches, scoped, commit, say }) {
  const [tab, setTab] = useState('in');
  const [add, setAdd] = useState(false);
  const canReceive = ROLES[me.role]?.scope !== 'own';
  const isCentral = ROLES[me.role]?.scope !== 'own';

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
  const canPay = ROLES[me.role]?.scope !== 'own';
  // ترحيل الاستحقاق/الصرف قرار على مستوى المنشأة كلها — يُقصر على الأدوار شاملة النطاق
  const canPost = ROLES[me.role]?.scope === 'all';

  const rows = emps.map(e => {
    const ads = scoped.advances.filter(a => a.employeeId === e.id && a.month === month);
    const draws = sum(ads.filter(a => ['advance', 'salary_draw'].includes(a.type)), a => a.amount);
    const cuts = sum(ads.filter(a => !['advance', 'salary_draw'].includes(a.type)), a => a.amount);
    const gross = e.baseSalary + (e.housingAllowance || 0);
    return { e, ads, draws, cuts, gross, net: gross - draws - cuts, flags: ads.filter(a => a.isUnjustified).length };
  });

  const totalNet = sum(rows, r => r.net);

  const printPayslip = (r) => {
    const co = org.company || {};
    const b = org.branches.find(x => x.id === r.e.branchId);
    const m = (n) => money(n);
    const monthName = new Date(month + '-01').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const adRows = r.ads.map(a => `<tr>
      <td>${arDate(a.date)}</td>
      <td>${['advance', 'salary_draw'].includes(a.type) ? 'سلفة/سحب' : 'خصم/جزاء'}</td>
      <td class="n">${m(a.amount)}</td>
      <td>${a.reason || '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="ce">لا سلف أو خصومات هذا الشهر</td></tr>';
    const w = window.open('', '_blank', 'width=850,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>قسيمة راتب - ${r.e.name} - ${monthName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
        body{padding:32px;color:#222;background:#fff}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C8A24A;padding-bottom:16px;margin-bottom:20px}
        .logo{width:64px;height:64px;object-fit:contain}
        .co-n{font-size:19px;font-weight:bold;color:#8C6F2C}
        .co-m{font-size:11px;color:#666;margin-top:3px}
        .title{text-align:center;font-size:16px;font-weight:bold;margin:8px 0}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:20px}
        .fld{display:flex;justify-content:space-between;padding:8px 12px;background:#F6F2E9;border-radius:6px;font-size:13px}
        .fld b{color:#8C6F2C}
        table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12.5px}
        th{background:#241F1B;color:#fff;padding:8px;text-align:right}
        td{border:1px solid #ddd;padding:7px 10px}
        td.n{text-align:left;font-variant-numeric:tabular-nums}
        td.ce{text-align:center;color:#999}
        .totals{margin-top:20px;border:2px solid #C8A24A;border-radius:10px;overflow:hidden}
        .totals .row{display:flex;justify-content:space-between;padding:11px 16px;font-size:14px;border-bottom:1px solid #eee}
        .totals .net{background:#241F1B;color:#fff;font-size:17px;font-weight:bold;border:none}
        .sign{display:flex;justify-content:space-between;margin-top:48px;gap:40px}
        .sign div{flex:1;text-align:center;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="head">
        <div style="display:flex;gap:14px;align-items:center">
          ${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` : ''}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · س.تجاري: ${co.commercialReg || '—'}</div></div>
        </div>
        <div style="text-align:left;font-size:11px;color:#888">تاريخ الإصدار<br><b>${new Date().toLocaleDateString('ar-EG')}</b></div>
      </div>
      <div class="title">قسيمة راتب</div>
      <div class="sub">عن شهر ${monthName}</div>
      <div class="grid">
        <div class="fld"><span>اسم الموظف</span><b>${r.e.name}</b></div>
        <div class="fld"><span>المسمى الوظيفي</span><b>${r.e.jobTitle || '—'}</b></div>
        <div class="fld"><span>الفرع</span><b>${b?.name || '—'}</b></div>
        <div class="fld"><span>رقم الموظف</span><b>${r.e.empNo || r.e.id.slice(-5)}</b></div>
      </div>
      <table><thead><tr><th>التاريخ</th><th>البند</th><th class="n">المبلغ</th><th>السبب</th></tr></thead>
        <tbody>${adRows}</tbody></table>
      <div class="totals">
        <div class="row"><span>الراتب الأساسي</span><b>${m(r.e.baseSalary || 0)} ر.س</b></div>
        <div class="row"><span>بدل السكن</span><b>${m(r.e.housingAllowance || 0)} ر.س</b></div>
        <div class="row"><span>إجمالي الاستحقاق</span><b>${m(r.gross)} ر.س</b></div>
        <div class="row"><span>السلف والسحوبات</span><b style="color:#C0392B">- ${m(r.draws)} ر.س</b></div>
        <div class="row"><span>الخصومات والجزاءات</span><b style="color:#C0392B">- ${m(r.cuts)} ر.س</b></div>
        <div class="row net"><span>صافي المستحق</span><b>${m(r.net)} ر.س</b></div>
      </div>
      <div class="sign">
        <div>توقيع الموظف</div>
        <div>المحاسب</div>
        <div>اعتماد الإدارة</div>
      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // ترحيل استحقاق الشهر وقيد الصرف إلى دفتر الشركاء — قيود دائمة لا تتغيّر بتغيّر الشهر (إصلاح المراجعة #4)
  const accrualPosted = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === month);
  const payoutPosted = (ops.ledgerEntries || []).some(x => x.kind === 'salary_payout' && x.month === month);
  const postAccrual = async () => {
    if (accrualPosted) return say('استحقاق هذا الشهر مُرحّل مسبقاً', 'no');
    const entries = rows.filter(r => r.gross > 0).map(r => ({
      id: uid('le'), partnerKey: 'emp:' + r.e.id, date: month + '-28', month, kind: 'salary_accrual',
      desc: 'استحقاق راتب شهر ' + month, src: 'salary', debit: 0, credit: r.gross
    }));
    if (!entries.length) return say('لا رواتب لترحيلها هذا الشهر', 'no');
    await commit(d => ({ ...d, ledgerEntries: [...entries, ...(d.ledgerEntries || [])] }), {
      actionType: 'create', targetType: 'daily_closing', targetId: 'payroll-' + month,
      title: 'رحّل استحقاق رواتب الشهر للدفتر', details: month + ' · ' + entries.length + ' موظف · إجمالي ' + money(sum(rows.filter(r => r.gross > 0), r => r.gross))
    });
    say('رُحّل استحقاق ' + month + ' إلى دفتر الشركاء ✓');
  };
  const postPayout = async () => {
    if (!accrualPosted) return say('رحّل استحقاق الشهر أولاً', 'no');
    if (payoutPosted) return say('صرف هذا الشهر مسجّل مسبقاً', 'no');
    const entries = rows.filter(r => r.net > 0).map(r => ({
      id: uid('le'), partnerKey: 'emp:' + r.e.id, date: today(), month, kind: 'salary_payout',
      desc: 'صرف راتب شهر ' + month + ' (صافي بعد السلف والخصوم)', src: 'salary', debit: r.net, credit: 0
    }));
    if (!entries.length) return say('لا صافي مستحق للصرف', 'no');
    await commit(d => ({ ...d, ledgerEntries: [...entries, ...(d.ledgerEntries || [])] }), {
      actionType: 'create', targetType: 'daily_closing', targetId: 'payout-' + month,
      title: 'سجّل صرف رواتب الشهر', details: month + ' · صافي ' + money(sum(rows.filter(r => r.net > 0), r => r.net))
    });
    say('سُجّل صرف رواتب ' + month + ' — أُقفل استحقاق الشهر في كشوف الموظفين ✓');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="row">
          <input type="month" className="inp" style={{ width: 165 }} value={month} onChange={e => setMonth(e.target.value)} />
          <span className="badge b-dim">{emps.length} موظف</span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {canPost && (accrualPosted
            ? <span className="badge b-mint"><Check size={11} />استحقاق {month} مُرحّل للدفتر</span>
            : <button className="btn" onClick={postAccrual}><Landmark size={14} />ترحيل استحقاق الشهر للدفتر</button>)}
          {canPost && (payoutPosted
            ? <span className="badge b-mint"><Check size={11} />صرف {month} مسجّل</span>
            : <button className="btn" disabled={!accrualPosted} onClick={postPayout}><Banknote size={14} />تسجيل صرف الرواتب</button>)}
          <button className="btn pri" onClick={() => setAdd(true)}><Plus size={15} />تسجيل سلفة أو خصم</button>
        </div>
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
                  <td>
                    <div className="row" style={{ gap: 5 }}>
                      <button className="btn sm gh" onClick={() => printPayslip(r)} title="قسيمة راتب"><Printer size={13} />قسيمة</button>
                      {canPay && <button className="btn sm" onClick={() => say(`اعتُمد صرف راتب ${r.e.name} بمبلغ ${money(r.net)} ر.س`)}>اعتماد الصرف</button>}
                    </div>
                  </td>
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

  const rows = scoped.closings.filter(c => countedClosing(c) && c.date >= from && c.date <= to && (bid === 'all' || c.branchId === bid));

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

  const exportXlsx = () => {
    const headers = ['الفرع', 'عدد الإغلاقات', 'الإيراد', 'المصروف', 'الصافي', 'الهامش %', 'نقدي', 'شبكة', 'تطبيقات', 'فروقات الصندوق', 'ض.القيمة المضافة'];
    const rows = byBranch.map(b => [b.name, b.n, +b.rev.toFixed(2), +b.exp.toFixed(2), +b.net.toFixed(2), +b.margin.toFixed(1), +b.cash.toFixed(2), +b.card.toFixed(2), +b.del.toFixed(2), +b.varr.toFixed(2), +b.vat.toFixed(2)]);
    const t = byBranch.reduce((a, b) => ({ n: a.n + b.n, rev: a.rev + b.rev, exp: a.exp + b.exp, net: a.net + b.net, cash: a.cash + b.cash, card: a.card + b.card, del: a.del + b.del, varr: a.varr + b.varr, vat: a.vat + b.vat }), { n: 0, rev: 0, exp: 0, net: 0, cash: 0, card: 0, del: 0, varr: 0, vat: 0 });
    exportExcel(`تقرير-الفروع-${from}_${to}`, `تقرير أداء الفروع`, headers, rows, {
      meta: [`${org.company.name || ''} · الرقم الضريبي: ${org.company.taxNumber || '—'}`, `الفترة: من ${from} إلى ${to}`],
      totals: ['الإجمالي', t.n, +t.rev.toFixed(2), +t.exp.toFixed(2), +t.net.toFixed(2), '', +t.cash.toFixed(2), +t.card.toFixed(2), +t.del.toFixed(2), +t.varr.toFixed(2), +t.vat.toFixed(2)]
    });
    say('تم تنزيل التقرير بصيغة Excel');
  };

  const printOps = () => {
    const co = org.company || {};
    const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const rows = byBranch.map(b => `<tr>
      <td>${b.name}</td><td class="num">${b.n}</td>
      <td class="num brass">${m(b.rev)}</td><td class="num">${m(b.cash)}</td>
      <td class="num">${m(b.card)}</td><td class="num">${m(b.del)}</td>
      <td class="num rose">${m(b.exp)}</td><td class="num mint">${m(b.net)}</td>
      <td class="num">${b.margin.toFixed(1)}%</td>
      <td class="num">${m(b.varr)}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=980,height=780');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير أداء الفروع</title><style>${A4_CSS}</style></head><body><div class="page">
      <div class="head">
        <div class="co">${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` : ''}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'}</div></div></div>
        <div class="doc-title">تقرير الأداء التشغيلي للفروع</div>
        <div class="doc-sub">من ${arDate(from)} إلى ${arDate(to)}</div>
      </div>
      <table class="t"><thead><tr>
        <th>الفرع</th><th class="num">إغلاقات</th><th class="num">الإيراد</th><th class="num">نقدي</th>
        <th class="num">شبكة</th><th class="num">تطبيقات</th><th class="num">المصروف</th>
        <th class="num">الصافي</th><th class="num">الهامش</th><th class="num">فروقات</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td>الإجمالي</td><td class="num">${sum(byBranch, b => b.n)}</td>
        <td class="num brass">${m(T.rev)}</td><td class="num">${m(sum(byBranch, b => b.cash))}</td>
        <td class="num">${m(sum(byBranch, b => b.card))}</td><td class="num">${m(sum(byBranch, b => b.del))}</td>
        <td class="num rose">${m(T.exp)}</td><td class="num mint">${m(T.net)}</td><td>—</td>
        <td class="num">${m(T.varr)}</td></tr></tfoot></table>
      <div class="foot dim">تم التصدير آلياً من منصة إغلاق الفروع · ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
      </div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const Tabs = () => (
    <div className="row scroll-x">
      <button className={'btn sm' + (mode === 'ops' ? ' pri' : ' gh')} onClick={() => setMode('ops')}>
        <FileBarChart size={14} />الأداء التشغيلي
      </button>
      <button className={'btn sm' + (mode === 'pnl' ? ' pri' : ' gh')} onClick={() => setMode('pnl')}>
        <FileText size={14} />قائمة الدخل (يومي/شهري/سنوي)
      </button>
    </div>
  );

  if (mode === 'pnl') return (
    <div className="grid" style={{ gap: 14 }}>
      <Tabs />
      <FinancialReports org={org} ops={ops} myBranches={myBranches} scoped={scoped} say={say} />
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
          <div className="row" style={{ alignSelf: 'flex-end' }}>
            <button className="btn pri" onClick={printOps}><FileText size={14} />طباعة (PDF)</button>
            <button className="btn" onClick={exportCsv}><Download size={14} />تصدير CSV</button>
            <button className="btn ok" onClick={exportXlsx}><FileBarChart size={14} />تصدير Excel</button>
          </div>
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
/* ============ إدارة تطبيقات التوصيل ============ */
function DeliveryAppsPanel({ org, commitOrg, say }) {
  const apps = org.deliveryApps || APPS;
  const [nm, setNm] = useState('');
  const [comm, setComm] = useState('');

  const addApp = async () => {
    const name = nm.trim();
    if (!name) return say('أدخل اسم التطبيق', 'no');
    const c = Number(comm) || 0;
    if (c < 0 || c > 100) return say('نسبة العمولة يجب أن تكون بين 0 و 100', 'no');
    if (apps.some(a => a.n === name)) return say('هذا التطبيق مضاف مسبقاً', 'no');
    const app = { id: uid('app'), n: name, c };
    await commitOrg(d => ({ ...d, deliveryApps: [...(d.deliveryApps || APPS), app] }), {
      actionType: 'create', targetType: 'delivery_app', targetId: app.id, title: 'أضاف تطبيق توصيل', details: `${name} — عمولة ${c}%`
    });
    setNm(''); setComm(''); say('تمت إضافة التطبيق — سيظهر في الإغلاقات الجديدة');
  };

  const updateComm = async (id, c) => {
    await commitOrg(d => ({ ...d, deliveryApps: (d.deliveryApps || APPS).map(a => a.id === id ? { ...a, c: Number(c) || 0 } : a) }), {
      actionType: 'update', targetType: 'delivery_app', targetId: id, title: 'عدّل عمولة تطبيق توصيل', details: `عمولة ${c}%`
    });
  };

  const removeApp = async (app) => {
    await commitOrg(d => ({ ...d, deliveryApps: (d.deliveryApps || APPS).filter(a => a.id !== app.id) }), {
      actionType: 'delete', targetType: 'delivery_app', targetId: app.id, title: 'حذف تطبيق توصيل', details: app.n
    });
    say('تم حذف التطبيق');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
        <div className="card-h"><div className="card-t"><Plus size={15} />إضافة تطبيق توصيل جديد</div></div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 12 }}>
          عند ظهور تطبيق توصيل جديد في السوق، أضِفه هنا فيظهر تلقائياً في نموذج الإغلاق اليومي لكل الفروع.
        </div>
        <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="اسم التطبيق" style={{ flex: 1, minWidth: 160 }}>
            <input className="inp" placeholder="مثال: مرسول، ذا شيف..." value={nm} onChange={e => setNm(e.target.value)} />
          </Field>
          <Field label="نسبة العمولة %" style={{ width: 130 }}>
            <input className="inp n" inputMode="decimal" placeholder="0" value={comm} onChange={e => setComm(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
          <button className="btn pri" onClick={addApp}><Plus size={15} />إضافة</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><Truck size={15} />التطبيقات المفعّلة ({apps.length})</div></div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>التطبيق</th><th>نسبة العمولة %</th><th></th></tr></thead>
            <tbody>
              {apps.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.n}</td>
                  <td>
                    <input className="inp n" style={{ width: 90 }} inputMode="decimal" defaultValue={a.c}
                      onBlur={e => updateComm(a.id, e.target.value.replace(/[^\d.]/g, ''))} />
                  </td>
                  <td>
                    <button className="btn sm gh" onClick={() => removeApp(a)}><Trash2 size={12} color="#D9544D" />حذف</button>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={3}><div className="empty">لا توجد تطبيقات. أضف تطبيقاً من الأعلى.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Admin({ org, ops, commit, commitOrg, say }) {
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
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('أدخل بريداً إلكترونياً صحيحاً', 'no');
    if (org.users.some(x => x.id !== u.id && (x.email || '').toLowerCase() === email)) return say('هذا البريد مستخدم بحساب آخر', 'no');
    if (isNew && (!u.newPass || u.newPass.length < 6)) return say('كلمة سر الحساب الجديد يجب ألا تقل عن 6 أحرف', 'no');
    const rec = { ...u, email };
    if (u.newPass) { rec.passHash = await sha(u.newPass); }
    if (u.newPin) { rec.pinHash = await sha('pin:' + u.newPin); }
    delete rec.newPass; delete rec.newPin; delete rec.pin;
    await commitOrg(d => ({ ...d, users: isNew ? [...d.users, rec] : d.users.map(x => x.id === rec.id ? rec : x) }), {
      actionType: isNew ? 'create' : 'permission_change', targetType: 'user_account', targetId: rec.id,
      title: isNew ? 'أنشأ مستخدماً جديداً' : 'عدّل بيانات مستخدم', details: `${rec.name} — ${ROLES[rec.role].ar}`
    });
    // مزامنة المصادقة السحابية: حساب دخول + عضوية + صفة مدير حسب الدور
    if (authApi.enabled) {
      if (isNew && u.newPass) {
        try { await authApi.createUser(email, u.newPass); }
        catch (e) {
          const c = String((e && e.code) || '');
          if (!c.includes('email-already-in-use')) say('أُنشئ الحساب في المنصة لكن تعذّر إنشاء حساب المصادقة (' + c.replace('auth/', '') + ') — أعد المحاولة من تعديل المستخدم', 'no');
        }
      }
      await authApi.upsertMember(email, { active: rec.isActive !== false, role: rec.role, branchId: rec.branchId || '' });
      await authApi.syncAdmin(email, !!ROLES[rec.role]?.admin);
    }
    say(isNew ? 'تم إنشاء الحساب — يدخل ببريده وكلمة سره' : 'تم تحديث الحساب'); setUEdit(null);
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
        <button className={'btn sm' + (tab === 'delivery' ? ' pri' : ' gh')} onClick={() => setTab('delivery')}>
          <Truck size={14} />تطبيقات التوصيل
        </button>
        <button className={'btn sm' + (tab === 'perms' ? ' pri' : ' gh')} onClick={() => setTab('perms')}>
          <ShieldCheck size={14} />مصفوفة الصلاحيات
        </button>
        <button className={'btn sm' + (tab === 'system' ? ' pri' : ' gh')} onClick={() => setTab('system')}>
          <Settings size={14} />بيانات الشركة والنسخ الاحتياطي
        </button>
        {(tab === 'branches' || tab === 'users') && <button className="btn pri" style={{ marginInlineStart: 'auto' }}
          onClick={() => tab === 'branches'
            ? setBEdit({ id: uid('b'), name: '', city: '', managerName: '', phone: '', defaultFloat: 1500, shiftEndTime: '02:00', isActive: true })
            : setUEdit({ id: uid('u'), name: '', email: '', role: 'branch_manager', newPass: '', branchId: org.branches[0]?.id, allowedBranchIds: [], isActive: true, createdAt: today() })}>
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
      {tab === 'delivery' && <DeliveryAppsPanel org={org} commitOrg={commitOrg} say={say} />}
      {tab === 'system' && <SystemPanel org={org} ops={ops} commit={commit} commitOrg={commitOrg} say={say} />}
      {tab === 'perms' && (() => {
        const roleIds = ['system_admin', 'general_management', 'head_office', 'finance_department', 'regional_manager', 'branch_manager', 'cashier'];
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><ShieldCheck size={15} color="var(--brass)" />مصفوفة الصلاحيات — من يرى ماذا (المصدر الواحد للحقيقة)</div>
              <div className="tw">
                <table className="tb" style={{ fontSize: 11.5 }}>
                  <thead><tr><th>الشاشة</th>{roleIds.map(r => <th key={r} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{(ROLES[r]?.ar || r).split(' — ')[0]}</th>)}</tr></thead>
                  <tbody>
                    {ALL_TABS.map(t => (
                      <tr key={t}>
                        <td style={{ fontWeight: 600 }}>{TAB_AR[t] || t}</td>
                        {roleIds.map(r => {
                          const ok = (ROLES[r]?.tabs || []).includes(t);
                          return <td key={r} style={{ textAlign: 'center', color: ok ? 'var(--mint)' : 'var(--faint)', fontWeight: ok ? 800 : 400 }}>{ok ? '✓' : '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 2 }}>
                <b style={{ color: 'var(--brass-l)' }}>صلاحيات الكتابة الحساسة (إضافة إلى رؤية الشاشات):</b><br />
                • القيود اليدوية والأصول والتسوية البنكية وأوامر الشراء والمخزون: الأدوار كاملة النطاق (مسؤول النظام، الإدارة العليا، المكتب الرئيسي، المحاسب الرئيسي)<br />
                • تفعيل الضريبة ونسبتها، إدارة المستخدمين والفروع، إدارة التطبيقات: أدوار الإدارة فقط (مسؤول النظام، الإدارة العليا)<br />
                • الاعتماد النهائي للإغلاقات: أصحاب صفة «معتمِد» — والقيود التلقائية لا يعدّلها أحد: تصحيح المصدر يصحّح قيده<br />
                • مدير الفرع والكاشير: إدخال إغلاقات فرعهم فقط، وإضافة الشركاء عبر «طلب اعتماد» يقرّه المركز
              </div>
            </div>
          </div>
        );
      })()}

      {bEdit && <BranchForm b={bEdit} say={say} onSave={saveBranch} onClose={() => setBEdit(null)} />}
      {uEdit && <UserForm u={uEdit} org={org} onSave={saveUser} onClose={() => setUEdit(null)} />}
    </div>
  );
}

function BranchForm({ b, say, onSave, onClose }) {
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
      <Field label="شعار الفرع (يظهر في تقارير هذا الفرع)">
        <PhotoField value={f.logoUrl} onChange={v => set('logoUrl', v)} say={say} />
      </Field>
    </Modal>
  );
}

function UserForm({ u, org, onSave, onClose }) {
  const [resetMsg, setResetMsg] = useState('');
  const [f, setF] = useState(u);
  const [bioMsg, setBioMsg] = useState('');
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
        <Field label="البريد الإلكتروني"><input className="inp" type="email" style={{ direction: 'ltr', textAlign: 'right' }} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" /></Field>
      </div>
      <Field label="الدور والصلاحية">
        <select className="sel" value={f.role} onChange={e => set('role', e.target.value)}>
          {Object.entries(ROLES).filter(([k, v]) => !v.legacy || k === f.role).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
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
      <Field label={u.name ? 'كلمة سر جديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة السر'}>
        <input className="inp" type="password" value={f.newPass || ''} placeholder={u.name ? 'بدون تغيير' : '٦ أحرف على الأقل'}
          onChange={e => set('newPass', e.target.value)} />
        {u.passHash && !f.newPass && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>للحساب كلمة سر محفوظة — لن تتغير ما لم تكتب واحدة جديدة.</div>}
        {authApi.enabled && (
          <div style={{ fontSize: 10.5, color: 'var(--sky)', marginTop: 6, lineHeight: 1.8 }}>
            المصادقة السحابية مفعّلة: كلمة السر هنا تُنشئ حساب دخول المستخدم <b>الجديد</b>. لتغيير كلمة سر مستخدم قائم:
            <button type="button" className="btn sm gh" style={{ marginInlineStart: 6 }}
              onClick={async () => {
                if (!f.email) { setResetMsg('اكتب البريد أولاً'); return; }
                setResetMsg('...');
                try { await authApi.resetPass(f.email); setResetMsg('أُرسل رابط التعيين إلى ' + f.email); }
                catch { setResetMsg('تعذّر الإرسال — تأكد من صحة البريد ووجود حساب مصادقة له'); }
              }}>إرسال رابط تعيين كلمة السر</button>
            {resetMsg && <div style={{ marginTop: 4, color: resetMsg.startsWith('أُرسل') ? 'var(--mint)' : 'var(--amber)' }}>{resetMsg}</div>}
          </div>
        )}
      </Field>
      <Field label="رقم سري للدخول السريع (اختياري — 4 إلى 6 أرقام)">
        <input className="inp" inputMode="numeric" style={{ direction: 'ltr', textAlign: 'right', letterSpacing: 4 }} value={f.newPin || ''}
          placeholder={f.pinHash ? 'محفوظ — اكتب رقماً جديداً لتغييره' : 'يمكّن الدخول السريع بالرقم'}
          onChange={e => set('newPin', e.target.value.replace(/\D/g, '').slice(0, 6))} />
        {f.pinHash && !f.newPin && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>لهذا الحساب رقم سري محفوظ للدخول السريع.</div>}
      </Field>

      <div className="card" style={{ background: 'var(--ink)', padding: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Fingerprint size={14} color="var(--brass)" />البصمة الحيوية لهذا الجهاز
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.6 }}>
              تسجّل بصمة/وجه هذا الجهاز (Touch ID / Face ID / Windows Hello) لدخول أسرع.
            </div>
          </div>
          {f.bioCredId ? (
            <div className="row">
              <span className="badge b-mint"><Check size={11} />مُفعّلة</span>
              <button type="button" className="btn sm gh" onClick={() => set('bioCredId', undefined)}>
                <Trash2 size={12} color="#D9544D" />إلغاء
              </button>
            </div>
          ) : (
            <button type="button" className="btn sm" disabled={bioMsg === 'busy'}
              onClick={async () => {
                if (!webauthnSupported()) { setBioMsg('unsupported'); return; }
                if (!f.email) { setBioMsg('needmail'); return; }
                setBioMsg('busy');
                try { const id = await bioEnroll({ ...f, id: f.id }); set('bioCredId', id); setBioMsg('done'); }
                catch { setBioMsg('fail'); }
              }}>
              {bioMsg === 'busy' ? <RefreshCw size={12} className="spin" /> : <ScanFace size={13} />}تفعيل البصمة
            </button>
          )}
        </div>
        {bioMsg === 'unsupported' && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 8 }}>هذا الجهاز/المتصفح لا يدعم البصمة الحيوية.</div>}
        {bioMsg === 'needmail' && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 8 }}>أدخل البريد الإلكتروني أولاً.</div>}
        {bioMsg === 'fail' && <div style={{ fontSize: 10.5, color: 'var(--rose)', marginTop: 8 }}>تعذّر التسجيل — تأكد من إعداد البصمة على الجهاز.</div>}
        {bioMsg === 'done' && <div style={{ fontSize: 10.5, color: 'var(--mint)', marginTop: 8 }}>تم — احفظ الحساب لاعتماد البصمة.</div>}
      </div>
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

  const receiptImgs = [];
  if (c.cardReceiptImage) receiptImgs.push({ t: 'إثبات الشبكة / التحويل', u: c.cardReceiptImage });
  (c.expenses || []).forEach(e => { if (e.receiptImage) receiptImgs.push({ t: (e.categoryName || 'مصروف') + (e.beneficiaryName ? ' — ' + e.beneficiaryName : ''), u: e.receiptImage }); });
  if (c.sessionPhoto) receiptImgs.push({ t: 'توثيق المسؤول', u: c.sessionPhoto });
  const imgsBlock = receiptImgs.length ? `
    <div class="sec-h">صور الفواتير والمرفقات (${receiptImgs.length})</div>
    <div class="imgs">${receiptImgs.map(im => `<div class="img-c"><img src="${im.u}"><div class="img-t">${im.t}</div></div>`).join('')}</div>` : '';

  return `<div class="page">
    <div class="head">
      <div class="co">
        ${headLogo ? `<img class="logo" src="${headLogo}">` : ''}
        <div>
          <div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div>
        </div>
      </div>
      <div class="doc-title">تقرير الإغلاق اليومي الرسمي</div>
      <div class="doc-sub">فرع ${c.branchName} · ${arDate(c.date)}</div>
      <div class="doc-sub dim">تاريخ التصدير: ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
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
    <div class="foot dim">تم تصدير هذا التقرير آلياً من منصة إغلاق الفروع · ${co.name || ''}</div>
  </div>`;
}

const A4_CSS = `
  @page { size: A4; margin: 12mm }
  * { box-sizing: border-box }
  body { font-family: 'IBM Plex Sans Arabic','Readex Pro',Tahoma,sans-serif; color: #1a1a1a; margin: 0; font-size: 11px; background: #fff }
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
  .banner-id { font-family: 'IBM Plex Mono',ui-monospace,monospace; color: #E0C074; font-size: 12px; font-weight: 700; direction: ltr; text-align: left }
  .banner-sub { font-size: 9px; color: #A2968A; margin-top: 3px }
  .banner-l { text-align: end; font-size: 10px; color: #D9CFC0; display: flex; flex-direction: column; gap: 3px; align-items: flex-end }
  .banner-l b { color: #fff }
  .banner-badge { background: rgba(224,164,88,.22); color: #E0A458; padding: 2px 9px; border-radius: 10px; font-size: 9px; font-weight: 700 }
  table.t .subhead td { background: #f2edfa; color: #6b4fa0; font-weight: 700; font-size: 9.5px; padding: 5px 9px }
`;

function printClosingA4(c, org) {
  const w = window.open('', '_blank', 'width=880,height=1000');
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
  <title>إيصال إغلاق ${c.branchName}</title><style>
  @page{size:${PG}mm auto;margin:3mm}
  body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;width:${W}mm;margin:0 auto;color:#000;font-size:11px}
  h1{font-size:14px;text-align:center;margin:0 0 2px}
  .c{text-align:center;font-size:9.5px;color:#333}
  .sep{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 0;vertical-align:top}
  td.v{text-align:left;font-family:'IBM Plex Mono',monospace;white-space:nowrap}
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
  <div class="c" style="margin-top:8px">${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=420,height=760');
  if (!w) return false;
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
  return true;
}

/* ================= الموردون والالتزامات الشهرية ================= */
function Suppliers({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const [tab, setTab] = useState('inv');
  const [pay, setPay] = useState(null);
  const [amt, setAmt] = useState(0);
  const [newInv, setNewInv] = useState(null);        // نموذج فاتورة توريد (م٤)
  const [poF, setPoF] = useState(null);              // نموذج أمر شراء
  const [recv, setRecv] = useState(null);            // نموذج استلام أمر
  const ids = myBranches.map(b => b.id);
  const invoices = (ops.invoices || []).filter(i => ids.includes(i.branchId))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const fixed = (ops.fixedExpenses || []).filter(f => ids.includes(f.branchId));
  const suppliers = org.suppliers || [];
  const canPay = ROLES[me.role]?.scope !== 'own';

  // سدادات الفروع المرتبطة بالفواتير (من الإغلاقات المرحّلة/المعتمدة) — تُحتسب دون تعديل الفاتورة فلا ازدواج
  const branchPaid = (invId) => sum(
    (ops.closings || []).filter(c => c.status === 'submitted' || c.status === 'approved')
      .flatMap(c => (c.supplierPayments || []).filter(pm => pm.invoiceId === invId)), payTotal);
  const invPaid = (i) => (i.paidAmount || 0) + branchPaid(i.id);
  const invRem = (i) => i.amount - invPaid(i);

  const outstanding = sum(invoices, invRem);
  const overdue = invoices.filter(i => invRem(i) > 0 && i.dueDate < today());

  // ===== م٤: أوامر الشراء والفواتير =====
  const pos = (ops.purchaseOrders || []).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
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
    const br = org.branches.find(b => b.id === f.branchId);
    const rec = {
      id: uid('inv'), supplierId: sp.id, supplierName: sp.name,
      branchId: f.branchId || '', branchName: br ? br.name : 'المركز الرئيسي',
      invoiceNo: f.invoiceNo.trim() || ('INV-' + today().replace(/-/g, '').slice(2) + '-' + String((ops.invoices || []).length + 1).padStart(3, '0')),
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
      .map(l => ({ desc: l.desc.trim(), itemId: l.itemId || '', qty: Number(l.qty), price: Number(l.price) || 0, received: 0 }));
    if (!lines.length) return say('أضف بنداً واحداً على الأقل (وصف وكمية)', 'no');
    const rec = { id: uid('po'), poNo: nextPoNo(), supplierId: sp.id, supplierName: sp.name,
      branchId: f.branchId || '', note: f.note || '', lines, status: 'open', by: me.name, at: nowISO(), date: today() };
    await commit(d => ({ ...d, purchaseOrders: [rec, ...(d.purchaseOrders || [])] }), {
      actionType: 'create', targetType: 'purchase_order', targetId: rec.id,
      title: 'أنشأ أمر شراء', details: rec.poNo + ' · ' + sp.name + ' · ' + money(poTotal(rec))
    });
    setPoF(null); say('أُنشئ أمر الشراء ' + rec.poNo + ' ✓');
  };

  const saveRecv = async () => {
    const f = recv; const p2 = f.po;
    const takes = p2.lines.map((l, i) => Math.min(Math.max(Number(f.qtys[i]) || 0, 0), (l.qty || 0) - (l.received || 0)));
    if (!takes.some(q => q > 0)) return say('أدخل كمية مستلمة لبند واحد على الأقل', 'no');
    const moves = p2.lines.map((l, i) => (takes[i] > 0 && l.itemId) ? {
      id: uid('sm'), date: today(), itemId: l.itemId, kind: 'purchase', qty: takes[i],
      note: 'استلام ' + p2.poNo + ' — ' + l.desc, ref: p2.poNo, by: me.name, at: nowISO()
    } : null).filter(Boolean);
    await commit(d => ({
      ...d,
      stockMoves: [...moves, ...(d.stockMoves || [])],
      purchaseOrders: (d.purchaseOrders || []).map(x => {
        if (x.id !== p2.id) return x;
        const lines = x.lines.map((l, i) => ({ ...l, received: (l.received || 0) + takes[i] }));
        return { ...x, lines, status: lines.every(l => l.received >= l.qty) ? 'received' : 'partial' };
      })
    }), {
      actionType: 'update', targetType: 'purchase_order', targetId: p2.id,
      title: 'سجّل استلام أمر شراء', details: p2.poNo + ' · ' + takes.filter(q => q > 0).length + ' بند' + (moves.length ? ' · غُذّي المخزون' : '')
    });
    // تحديث تكلفة الأصناف المرتبطة بآخر سعر شراء
    const costUp = p2.lines.map((l, i) => (takes[i] > 0 && l.itemId && l.price > 0) ? { id: l.itemId, cost: l.price } : null).filter(Boolean);
    if (costUp.length) await commitOrg(d => ({
      ...d, items: (d.items || []).map(it => { const u = costUp.find(c => c.id === it.id); return u ? { ...it, cost: u.cost } : it; })
    }), { actionType: 'update', targetType: 'stock_item', targetId: p2.id, title: 'حدّث تكلفة أصناف بآخر شراء', details: p2.poNo });
    setRecv(null); say('سُجّل الاستلام' + (moves.length ? ' وغُذّي المخزون تلقائياً ✓' : ' ✓'));
  };

  const settle = async () => {
    const inv = pay; const v = Math.min(amt, invRem(inv));
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
        <button className={'btn sm' + (tab === 'po' ? ' pri' : ' gh')} onClick={() => setTab('po')}>
          <ClipboardCheck size={14} />أوامر الشراء
        </button>
        {canPay && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }}
          onClick={() => setNewInv({ supplierId: suppliers[0]?.id || '', invoiceNo: '', amount: '', taxable: true, date: today(), dueDate: today(), branchId: '' })}>
          <Plus size={14} />فاتورة توريد جديدة</button>}
      </div>

      {tab === 'inv' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الفاتورة</th><th>المورد</th><th>الفرع</th><th>الاستحقاق</th><th>المهلة</th>
                <th>القيمة</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {invoices.map(i => {
                  const bp = branchPaid(i.id);
                  const rem = invRem(i);
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
                      <td className="num" style={{ fontSize: 11 }}>{i.invoiceNo}</td>
                      <td style={{ fontSize: 12 }}>{i.supplierName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{i.branchName}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap', color: late ? 'var(--rose)' : 'inherit' }}>{arDate(i.dueDate)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: mahla.c, fontSize: 11.5, fontWeight: 600 }}>{mahla.t}</td>
                      <td className="num">{money(i.amount)}</td>
                      <td className="num" style={{ color: 'var(--mint)' }}>{money(invPaid(i))}
                        {bp > 0 && <div style={{ fontSize: 9, color: 'var(--faint)' }}>منه من الفروع {money(bp)}</div>}</td>
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
            {canPay && <button className="btn sm pri" onClick={() => setPoF({ supplierId: suppliers[0]?.id || '', branchId: '', note: '', lines: [{ desc: '', itemId: '', qty: '', price: '' }] })}><Plus size={14} />أمر شراء جديد</button>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الأمر</th><th>المورد</th><th style={{ textAlign: 'end' }}>القيمة</th><th>الاستلام</th><th>الفاتورة</th><th /></tr></thead>
              <tbody>
                {pos.map(p2 => {
                  const tot = poTotal(p2);
                  const inv = (ops.invoices || []).find(i => i.id === p2.invoiceId);
                  return (
                    <tr key={p2.id}>
                      <td><span className="num" style={{ fontSize: 11.5 }}>{p2.poNo}</span><div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{p2.date} · {p2.by}</div></td>
                      <td style={{ fontSize: 12.5 }}>{p2.supplierName}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{(p2.lines || []).length} بند{p2.note ? ' · ' + p2.note : ''}</div></td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(tot)}</td>
                      <td>{p2.status === 'received' ? <span className="badge b-mint">مستلم كاملاً ✓</span>
                        : p2.status === 'partial' ? <span className="badge b-amber">جزئي</span>
                        : <span className="badge b-sky">بانتظار التوريد</span>}</td>
                      <td>{inv ? <span className="badge b-mint">مفوترة · {inv.invoiceNo}</span> : <span className="badge b-dim">لم تُفوتر</span>}</td>
                      <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                        {canPay && p2.status !== 'received' && <button className="btn sm" onClick={() => setRecv({ po: p2, qtys: p2.lines.map(l => String((l.qty || 0) - (l.received || 0))) })}>تسجيل استلام</button>}
                        {canPay && !inv && <button className="btn sm gh" onClick={() => setNewInv({ supplierId: p2.supplierId, invoiceNo: '', amount: String(tot), taxable: true, date: today(), dueDate: today(), branchId: p2.branchId || '', poId: p2.id })}>إنشاء فاتورة</button>}
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
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, itemId: e.target.value } : x) }))}>
                <option value="">بلا ربط مخزون</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
              </select>
              <input className="inp n" style={{ width: 90 }} inputMode="decimal" placeholder="الكمية" value={l.qty}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="سعر الوحدة" value={l.price}
                onChange={e => setPoF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              {poF.lines.length > 1 && <button className="btn sm gh" onClick={() => setPoF(f => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}><X size={13} /></button>}
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setPoF(f => ({ ...f, lines: [...f.lines, { desc: '', itemId: '', qty: '', price: '' }] }))}><Plus size={13} />بند إضافي</button>
            <span className="badge b-brass">قيمة الأمر: {money(sum(poF.lines || [], l => (Number(l.qty) || 0) * (Number(l.price) || 0)))}</span>
          </div>
        </Modal>
      )}

      {recv && (
        <Modal title={'تسجيل استلام — ' + recv.po.poNo} icon={Truck} onClose={() => setRecv(null)}
          foot={<><button className="btn gh" onClick={() => setRecv(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveRecv}><Check size={14} />تأكيد الاستلام</button></>}>
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
              </div>
            );
          })}
          <div className="note">البنود المربوطة بأصناف تُضاف كمياتها للمخزون فوراً، وتتحدّث تكلفة الصنف بآخر سعر شراء.</div>
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
        </Modal>
      )}
    </div>
  );
}

/* ================= دفتر الشركاء: طباعة كشف حساب A4 ================= */
function printPartnerStatement(p, org) {
  const w = window.open('', '_blank', 'width=900,height=1000');
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
  <style>*{font-family:'Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:28px;color:#1a1a1a}
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
  <div class="ft">كشف حساب صادر من منصة الإغلاق اليومي — ${co.name || ''} · ${arDate(today())}</div></body></html>`);
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
  pay: { t: 'سداد', c: 'var(--mint)' }
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

/* ================= م٤: المخزون والمنتجات — أصناف، حركات، جرد، وصفات ================= */
const MOVE_KINDS = {
  purchase: { ar: 'توريد شراء', sign: 1, c: 'b-mint' },
  in: { ar: 'توريد يدوي', sign: 1, c: 'b-mint' },
  out: { ar: 'صرف للتشغيل', sign: -1, c: 'b-sky' },
  waste: { ar: 'هدر/إتلاف', sign: -1, c: 'b-rose' },
  adjust: { ar: 'تسوية جرد', sign: 1, c: 'b-amber' }
};
function Inventory({ org, ops, me, commit, commitOrg, say, invIntent }) {
  const [view, setView] = useState('items');        // items | moves | count | recipes
  const [itemF, setItemF] = useState(null);         // نموذج صنف
  const [moveF, setMoveF] = useState(null);         // نموذج حركة
  const [prodF, setProdF] = useState(null);         // نموذج وصفة
  const [countRows, setCountRows] = useState({});   // العدّ الفعلي أثناء الجرد
  useEffect(() => { if (invIntent && invIntent.v) setView(invIntent.v); }, [invIntent && invIntent.ts]);

  const canW = ROLES[me?.role]?.scope === 'all';
  const items = org.items || [];
  const products = org.products || [];
  const moves = ops.stockMoves || [];
  const taxCfg = org.taxCfg || {};
  const netOf = (p) => taxCfg.enabled ? Math.round(p / (1 + (Number(taxCfg.rate) || 15) / 100) * 100) / 100 : p;

  const bal = useMemo(() => {
    const m = {};
    moves.forEach(mv => { m[mv.itemId] = (m[mv.itemId] || 0) + (mv.qty || 0); });
    return m;
  }, [moves]);
  const balOf = (id) => Math.round((bal[id] || 0) * 1000) / 1000;
  const stockValue = sum(items, it => balOf(it.id) * (it.cost || 0));
  const lowItems = items.filter(it => (it.minQty || 0) > 0 && balOf(it.id) <= it.minQty);
  const stateOf = (it) => {
    const b = balOf(it.id), mn = it.minQty || 0;
    if (mn > 0 && b <= mn) return ['b-rose', 'اطلب الآن'];
    if (mn > 0 && b <= mn * 1.3) return ['b-amber', 'قارب الحد'];
    return ['b-mint', 'جيد'];
  };
  const itemName = (id) => (items.find(x => x.id === id) || {}).name || '—';

  const saveItem = async () => {
    const f = itemF;
    if (!f.name.trim()) return say('أدخل اسم الصنف', 'no');
    const rec = { id: f.id || uid('it'), name: f.name.trim(), unit: f.unit.trim() || 'وحدة', cost: Number(f.cost) || 0, minQty: Number(f.minQty) || 0, isActive: true };
    await commitOrg(d => ({ ...d, items: f.id ? (d.items || []).map(x => x.id === f.id ? rec : x) : [...(d.items || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'stock_item', targetId: rec.id,
      title: f.id ? 'عدّل صنف مخزون' : 'أضاف صنف مخزون', details: rec.name + ' · ' + money(rec.cost) + '/' + rec.unit
    });
    setItemF(null); say('حُفظ الصنف ✓');
  };

  const saveMove = async () => {
    const f = moveF; const it = items.find(x => x.id === f.itemId);
    const q = Number(f.qty) || 0;
    if (!it) return say('اختر الصنف', 'no');
    if (q <= 0) return say('أدخل كمية صحيحة', 'no');
    const sign = MOVE_KINDS[f.kind]?.sign || 1;
    const rec = { id: uid('sm'), date: today(), itemId: it.id, kind: f.kind, qty: sign * q, note: f.note || '', by: me.name, at: nowISO() };
    await commit(d => ({ ...d, stockMoves: [rec, ...(d.stockMoves || [])] }), {
      actionType: 'create', targetType: 'stock_move', targetId: rec.id,
      title: 'سجّل حركة مخزون — ' + (MOVE_KINDS[f.kind]?.ar || ''), details: it.name + ' · ' + q + ' ' + it.unit + (f.note ? ' · ' + f.note : '')
    });
    setMoveF(null); say('سُجّلت الحركة ✓');
  };

  const approveCount = async () => {
    const diffs = items.map(it => {
      const actual = countRows[it.id];
      if (actual === undefined || actual === '') return null;
      const d = Math.round((Number(actual) - balOf(it.id)) * 1000) / 1000;
      return Math.abs(d) > 0.0005 ? { it, d } : null;
    }).filter(Boolean);
    if (!diffs.length) return say('لا فروقات — الأرصدة مطابقة للعدّ', 'no');
    const recs = diffs.map(x => ({
      id: uid('sm'), date: today(), itemId: x.it.id, kind: 'adjust', qty: x.d,
      note: 'جرد ' + arDate(today()) + (x.d < 0 ? ' — عجز' : ' — زيادة'), by: me.name, at: nowISO()
    }));
    await commit(d => ({ ...d, stockMoves: [...recs, ...(d.stockMoves || [])] }), {
      actionType: 'create', targetType: 'stocktake', targetId: 'count-' + today(),
      title: 'اعتمد جردًا للمخزون', details: diffs.length + ' صنف بفروقات · ' + diffs.map(x => x.it.name + ' (' + (x.d > 0 ? '+' : '') + x.d + ')').join('، ').slice(0, 140)
    });
    setCountRows({}); say('اعتُمد الجرد وسُجّلت التسويات ✓');
  };

  const prodCost = (p) => sum(p.parts || [], pt => (Number(pt.qty) || 0) * ((items.find(x => x.id === pt.itemId) || {}).cost || 0));
  const saveProd = async () => {
    const f = prodF;
    if (!f.name.trim()) return say('أدخل اسم المنتج', 'no');
    const parts = (f.parts || []).filter(pt => pt.itemId && Number(pt.qty) > 0).map(pt => ({ itemId: pt.itemId, qty: Number(pt.qty) }));
    const rec = { id: f.id || uid('pr'), name: f.name.trim(), sellPrice: Number(f.sellPrice) || 0, parts };
    await commitOrg(d => ({ ...d, products: f.id ? (d.products || []).map(x => x.id === f.id ? rec : x) : [...(d.products || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'product', targetId: rec.id,
      title: f.id ? 'عدّل وصفة منتج' : 'أضاف منتجًا بوصفته', details: rec.name + ' · تكلفة ' + money(prodCost(rec))
    });
    setProdF(null); say('حُفظ المنتج ✓');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        <Kpi label="قيمة المخزون (بآخر تكلفة)" value={money(stockValue)} sub={items.length + ' صنفاً'} icon={HardDrive} color="#C8A24A" />
        <Kpi label="أصناف تحت حد الطلب" value={String(lowItems.length)} sub={lowItems.map(i => i.name).join('، ').slice(0, 40) || 'لا شيء — ممتاز'} icon={AlertTriangle} color={lowItems.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="حركات المخزون" value={String(moves.length)} sub="توريد · صرف · هدر · جرد" icon={ArrowLeftRight} color="#5B93C4" />
        <Kpi label="منتجات بوصفات" value={String(products.length)} sub="تكلفة وهامش لكل منتج" icon={Store} color="#9B7BB8" />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (view === 'items' ? ' pri' : ' gh')} onClick={() => setView('items')}><HardDrive size={14} />الأصناف والأرصدة</button>
        <button className={'btn sm' + (view === 'moves' ? ' pri' : ' gh')} onClick={() => setView('moves')}><ArrowLeftRight size={14} />الحركات</button>
        <button className={'btn sm' + (view === 'count' ? ' pri' : ' gh')} onClick={() => setView('count')}><ClipboardCheck size={14} />الجرد</button>
        <button className={'btn sm' + (view === 'recipes' ? ' pri' : ' gh')} onClick={() => setView('recipes')}><Store size={14} />الوصفات والتكلفة</button>
        {canW && view === 'items' && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setItemF({ name: '', unit: 'كغ', cost: '', minQty: '' })}><Plus size={14} />صنف جديد</button>}
        {canW && view === 'moves' && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setMoveF({ kind: 'in', itemId: items[0]?.id || '', qty: '', note: '' })}><Plus size={14} />حركة جديدة</button>}
        {canW && view === 'recipes' && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setProdF({ name: '', sellPrice: '', parts: [{ itemId: items[0]?.id || '', qty: '' }] })}><Plus size={14} />منتج جديد</button>}
      </div>

      {view === 'items' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الصنف</th><th>الوحدة</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'end' }}>القيمة</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {items.map(it => {
                  const [cls, txt] = stateOf(it); const b = balOf(it.id);
                  return (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{it.name}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{it.unit}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(it.cost)}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b < 0 ? 'var(--rose)' : 'var(--txt)' }}>{b}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(b * (it.cost || 0))}</td>
                      <td><span className={'badge ' + cls}>{txt}</span>{(it.minQty || 0) > 0 && <div style={{ fontSize: 9, color: 'var(--faint)' }}>الحد: <span className="num">{it.minQty}</span></div>}</td>
                      <td>{canW && <button className="btn sm gh" onClick={() => setItemF({ ...it })}>تعديل</button>}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={7}><div className="empty">لا أصناف بعد — أضف أصناف مخزونك (أرز، لحم، زيت…) ليبدأ التتبع.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'moves' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>الصنف</th><th>النوع</th><th style={{ textAlign: 'end' }}>الكمية</th><th>البيان</th><th>بواسطة</th></tr></thead>
              <tbody>
                {moves.slice(0, 120).map(mv => (
                  <tr key={mv.id}>
                    <td className="num" style={{ fontSize: 11 }}>{mv.date}</td>
                    <td style={{ fontSize: 12.5 }}>{itemName(mv.itemId)}</td>
                    <td><span className={'badge ' + (MOVE_KINDS[mv.kind]?.c || 'b-dim')}>{MOVE_KINDS[mv.kind]?.ar || mv.kind}</span></td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: mv.qty < 0 ? 'var(--rose)' : 'var(--mint)' }}>{mv.qty > 0 ? '+' + mv.qty : mv.qty}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{mv.note || mv.ref || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--faint)' }}>{mv.by || '—'}</td>
                  </tr>
                ))}
                {moves.length === 0 && <tr><td colSpan={6}><div className="empty">لا حركات بعد — التوريد من أوامر الشراء يظهر هنا تلقائياً.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'count' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><ClipboardCheck size={15} color="var(--brass)" />جرد المخزون — أدخل العدّ الفعلي واعتمد</div>
            {canW && <button className="btn pri sm" onClick={approveCount}><Check size={14} />اعتماد الجرد وتسجيل الفروقات</button>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الصنف</th><th style={{ textAlign: 'end' }}>الرصيد الدفتري</th><th style={{ width: 130 }}>العدّ الفعلي</th><th style={{ textAlign: 'end' }}>الفرق</th></tr></thead>
              <tbody>
                {items.map(it => {
                  const b = balOf(it.id);
                  const a = countRows[it.id];
                  const d = a === undefined || a === '' ? null : Math.round((Number(a) - b) * 1000) / 1000;
                  return (
                    <tr key={it.id}>
                      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{it.name} <span style={{ color: 'var(--faint)', fontSize: 10 }}>({it.unit})</span></td>
                      <td className="num" style={{ textAlign: 'end' }}>{b}</td>
                      <td><input className="inp n" inputMode="decimal" placeholder={String(b)} value={a === undefined ? '' : a}
                        disabled={!canW}
                        onChange={e => setCountRows(r => ({ ...r, [it.id]: e.target.value.replace(/[^\d.-]/g, '') }))} /></td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: d === null ? 'var(--faint)' : d < 0 ? 'var(--rose)' : d > 0 ? 'var(--mint)' : 'var(--faint)' }}>
                        {d === null ? '—' : d === 0 ? 'مطابق ✓' : (d > 0 ? '+' + d : d)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={4}><div className="empty">أضف أصنافاً أولاً.</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 10 }}>الفروقات تُسجَّل حركات «تسوية جرد» موثقة باسمك وتاريخها — وتظهر في سجل التدقيق.</div>
        </div>
      )}

      {view === 'recipes' && (
        <div className="grid g2">
          {products.map(p => {
            const cost = prodCost(p); const net = netOf(p.sellPrice || 0);
            const margin = net > 0 ? Math.round((net - cost) / net * 1000) / 10 : 0;
            return (
              <div key={p.id} className="card">
                <div className="card-h">
                  <div className="card-t"><Store size={15} color="var(--brass)" />{p.name}</div>
                  {canW && <button className="btn sm gh" onClick={() => setProdF({ ...p, parts: (p.parts || []).map(x => ({ ...x })) })}>تعديل</button>}
                </div>
                <table className="tb" style={{ fontSize: 12 }}>
                  <tbody>
                    {(p.parts || []).map((pt, i) => {
                      const it = items.find(x => x.id === pt.itemId) || {};
                      return <tr key={i}><td>{it.name || '؟'}</td><td className="num" style={{ textAlign: 'end' }}>{pt.qty} {it.unit || ''}</td><td className="num" style={{ textAlign: 'end' }}>{money(pt.qty * (it.cost || 0))}</td></tr>;
                    })}
                    <tr style={{ fontWeight: 800 }}><td>تكلفة المنتج</td><td /><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(cost)}</td></tr>
                  </tbody>
                </table>
                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="badge b-brass">البيع {money(p.sellPrice)}{taxCfg.enabled ? ' شامل' : ''}</span>
                  {taxCfg.enabled && <span className="badge b-dim">الصافي {money(net)}</span>}
                  <span className={'badge ' + (margin >= 50 ? 'b-mint' : margin >= 30 ? 'b-amber' : 'b-rose')}>هامش {margin}%</span>
                </div>
              </div>
            );
          })}
          {products.length === 0 && <div className="card"><div className="empty">أضف منتجاً بوصفته (مكوناته من الأصناف) لترى تكلفته الحقيقية وهامشه.</div></div>}
        </div>
      )}

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>حدود هذه المرحلة (بشفافية):</b> لا خصم تلقائي للمخزون مع البيع —
          النظام يسجّل إجماليات المبيعات لا أصنافها، فالاستهلاك يُسجَّل «صرفًا للتشغيل» أو عبر الجرد الدوري.
          التكلفة المعروضة بآخر سعر شراء، وتتحدّث تلقائيًا عند استلام أوامر الشراء.
          التقييم المحاسبي للمخزون (رسملة المشتريات وتكلفة المبيعات) قرار محاسبي يُبنى في مرحلة لاحقة —
          حاليًا تبقى المشتريات مصروفًا كما هي (طريقة الجرد الدوري المتعارفة للمطاعم).
        </div>
      </div>

      {itemF && (
        <Modal title={itemF.id ? 'تعديل صنف' : 'صنف مخزون جديد'} icon={HardDrive} onClose={() => setItemF(null)}
          foot={<><button className="btn gh" onClick={() => setItemF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveItem}><Check size={14} />حفظ الصنف</button></>}>
          <Field label="اسم الصنف"><input className="inp" value={itemF.name} placeholder="أرز بسمتي، لحم غنم…" onChange={e => setItemF(f => ({ ...f, name: e.target.value }))} /></Field>
          <div className="grid g3">
            <Field label="الوحدة"><input className="inp" value={itemF.unit} placeholder="كغ · كيس · علبة" onChange={e => setItemF(f => ({ ...f, unit: e.target.value }))} /></Field>
            <Field label="التكلفة/الوحدة"><input className="inp n" inputMode="decimal" value={itemF.cost} onChange={e => setItemF(f => ({ ...f, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="حد الطلب الأدنى"><input className="inp n" inputMode="decimal" value={itemF.minQty} onChange={e => setItemF(f => ({ ...f, minQty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          </div>
        </Modal>
      )}

      {moveF && (
        <Modal title="حركة مخزون جديدة" icon={ArrowLeftRight} onClose={() => setMoveF(null)}
          foot={<><button className="btn gh" onClick={() => setMoveF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveMove}><Check size={14} />تسجيل الحركة</button></>}>
          <div className="grid g2">
            <Field label="نوع الحركة">
              <select className="sel" value={moveF.kind} onChange={e => setMoveF(f => ({ ...f, kind: e.target.value }))}>
                <option value="in">توريد يدوي (+)</option>
                <option value="out">صرف للتشغيل (−)</option>
                <option value="waste">هدر/إتلاف (−)</option>
              </select>
            </Field>
            <Field label="الصنف">
              <select className="sel" value={moveF.itemId} onChange={e => setMoveF(f => ({ ...f, itemId: e.target.value }))}>
                {items.map(it => <option key={it.id} value={it.id}>{it.name} — رصيد {balOf(it.id)} {it.unit}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid g2">
            <Field label="الكمية"><input className="inp n" inputMode="decimal" value={moveF.qty} onChange={e => setMoveF(f => ({ ...f, qty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="البيان (اختياري)"><input className="inp" value={moveF.note} placeholder="صرف للمطبخ · تالف بالتبريد…" onChange={e => setMoveF(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}

      {prodF && (
        <Modal title={prodF.id ? 'تعديل منتج ووصفته' : 'منتج جديد بوصفته'} icon={Store} onClose={() => setProdF(null)} wide
          foot={<><button className="btn gh" onClick={() => setProdF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveProd}><Check size={14} />حفظ المنتج</button></>}>
          <div className="grid g2">
            <Field label="اسم المنتج"><input className="inp" value={prodF.name} placeholder="مندي لحم — وجبة" onChange={e => setProdF(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label={'سعر البيع' + ((org.taxCfg || {}).enabled ? ' (شامل الضريبة)' : '')}>
              <input className="inp n" inputMode="decimal" value={prodF.sellPrice} onChange={e => setProdF(f => ({ ...f, sellPrice: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          </div>
          <div className="lbl" style={{ margin: '4px 0 6px' }}>المكوّنات (من أصناف المخزون)</div>
          {(prodF.parts || []).map((pt, i) => (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <select className="sel" style={{ flex: 2, minWidth: 170 }} value={pt.itemId}
                onChange={e => setProdF(f => ({ ...f, parts: f.parts.map((x, k) => k === i ? { ...x, itemId: e.target.value } : x) }))}>
                <option value="">— اختر الصنف —</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name} ({money(it.cost)}/{it.unit})</option>)}
              </select>
              <input className="inp n" style={{ flex: 1, minWidth: 100 }} inputMode="decimal" placeholder="الكمية" value={pt.qty}
                onChange={e => setProdF(f => ({ ...f, parts: f.parts.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              {prodF.parts.length > 1 && <button className="btn sm gh" onClick={() => setProdF(f => ({ ...f, parts: f.parts.filter((_, k) => k !== i) }))}><X size={13} /></button>}
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setProdF(f => ({ ...f, parts: [...(f.parts || []), { itemId: '', qty: '' }] }))}><Plus size={13} />مكوّن إضافي</button>
            <span className="badge b-brass">التكلفة الحالية: {money(prodCost({ parts: (prodF.parts || []).filter(x => x.itemId) }))}</span>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= مركز تطبيقات ERP — بوابة وحدات النظام (v7.6) ================= */
function AppsStrip({ me, setTab, openAcctView, openInvView }) {
  // شريط ERP Home: المفضلة وآخر المستخدَم — يظهر أعلى لوحة المؤشرات
  const u = appUseGet(me.id);
  const can = (a) => a && appCanSee(me.role, a) && !a.soon;
  const favs = (u.fav || []).map(id => REG_IX[id]).filter(can).slice(0, 5);
  const recs = Object.entries(u.rec || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([id]) => REG_IX[id]).filter(can).filter(a => !favs.includes(a)).slice(0, 3);
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

function AppsCenter({ org, me, commitOrg, say, setTab, openAcctView, openInvView }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('all');          // all | fav | rec
  const [manage, setManage] = useState(false);
  const [bump, setBump] = useState(0);              // لإعادة الرسم بعد تعديل المفضلة
  const canAdmin = !!ROLES[me.role]?.admin;
  const cfg = org.appsCfg || {};
  const hidden = cfg.hidden || [];
  const ordOf = (a) => (cfg.order && cfg.order[a.id] != null) ? cfg.order[a.id] : REG_APPS.indexOf(REG_IX[a.id]);
  const u = appUseGet(me.id);
  const isFav = (id) => (u.fav || []).includes(id);
  const toggleFav = (id) => {
    const v = appUseGet(me.id); v.fav = v.fav || [];
    v.fav = v.fav.includes(id) ? v.fav.filter(x => x !== id) : [...v.fav, id];
    appUseSet(me.id, v); setBump(b => b + 1);
  };
  const lastUsed = (id) => {
    const r = (u.rec || {})[id]; if (!r) return null;
    const d = Math.round((Date.now() - r.at) / 864e5);
    return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : 'قبل ' + d + ' يوم';
  };

  // الرؤية: صلاحيات الأدوار الحالية نفسها + إخفاءات المشرف
  const mine = REG_APPS.filter(a => appCanSee(me.role, a) && (manage || !hidden.includes(a.id)));
  const qq = q.trim();
  const match = (a) => !qq || (a.ar + ' ' + a.en + ' ' + a.d + ' ' + (a.kw || []).join(' ')).includes(qq);
  const inMode = (a) => mode === 'fav' ? isFav(a.id) : mode === 'rec' ? !!(u.rec || {})[a.id] : true;
  const shown = mine.filter(match).filter(inMode).sort((a, b) => ordOf(a) - ordOf(b));
  const activeCount = mine.filter(a => !a.soon).length;
  const favApps = mine.filter(a => isFav(a.id) && !a.soon);
  const recApps = Object.entries(u.rec || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([id]) => REG_IX[id]).filter(a => a && mine.includes(a)).slice(0, 6);

  const saveCfg = async (next, title, details) => {
    await commitOrg(d => ({ ...d, appsCfg: next }), {
      actionType: 'update', targetType: 'apps_center', targetId: 'appsCfg', title, details
    });
  };
  const toggleHidden = (id) => {
    const h = hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id];
    saveCfg({ ...cfg, hidden: h }, hidden.includes(id) ? 'أظهر تطبيقاً في مركز التطبيقات' : 'أخفى تطبيقاً من مركز التطبيقات', REG_IX[id]?.ar || id);
  };
  const move = (id, dir) => {
    const list = REG_APPS.filter(x => x.cat === REG_IX[id].cat).sort((a, b) => ordOf(a) - ordOf(b));
    const i = list.findIndex(x => x.id === id); const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const order = { ...(cfg.order || {}) };
    list.forEach((x, k) => { order[x.id] = REG_APPS.indexOf(REG_IX[x.id]); });
    const tmp = order[list[i].id]; order[list[i].id] = order[list[j].id]; order[list[j].id] = tmp;
    saveCfg({ ...cfg, order }, 'أعاد ترتيب تطبيقات المركز', REG_IX[id]?.ar || id);
  };

  const Card = ({ a }) => {
    const used = lastUsed(a.id);
    return (
      <div className={'appc' + (a.soon ? ' soon' : '')}>
        {!a.soon && (
          <button className={'appc-star' + (isFav(a.id) ? ' on' : '')} title={isFav(a.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            onClick={() => toggleFav(a.id)}>{isFav(a.id) ? '★' : '☆'}</button>
        )}
        <div className="appc-top">
          <div className="appc-ic"><a.icon size={19} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="appc-n">{a.ar}</div>
            <div className="appc-e">{a.en}</div>
          </div>
        </div>
        <div className="appc-d">{a.d}</div>
        <div className="appc-f">
          {a.soon
            ? <span className="badge b-amber">قريباً · المرحلة {a.soon}</span>
            : <span className="badge b-mint">نشط</span>}
          {!a.soon && a.fns?.length > 0 && <span className="badge b-dim">{a.fns.length} وظائف</span>}
          {used && <span className="badge b-dim" style={{ opacity: .8 }}>آخر استخدام: {used}</span>}
        </div>
        {a.soon
          ? <button className="btn sm gh" disabled style={{ justifyContent: 'center' }}>ضمن خطة التطوير</button>
          : <button className="btn sm pri" style={{ justifyContent: 'center' }} onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}>فتح التطبيق</button>}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* الرأس: بحث ذكي + مرشحات + إدارة + هوية المستخدم */}
      <div className="card" style={{ paddingBottom: 12 }}>
        <div className="apps-hd">
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', insetInlineStart: 11, top: 12, color: 'var(--faint)' }} />
            <input className="inp" style={{ paddingInlineStart: 32 }} placeholder="ابحث عن تطبيق أو وظيفة… (جرّب: فاتورة، ضريبة، راتب)"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className={'btn sm' + (mode === 'all' ? ' pri' : ' gh')} onClick={() => setMode('all')}>الكل</button>
          <button className={'btn sm' + (mode === 'fav' ? ' pri' : ' gh')} onClick={() => setMode('fav')}>⭐ المفضلة</button>
          <button className={'btn sm' + (mode === 'rec' ? ' pri' : ' gh')} onClick={() => setMode('rec')}><Clock size={13} />الأخيرة</button>
          {canAdmin && <button className={'btn sm' + (manage ? ' pri' : '')} onClick={() => setManage(m => !m)}><Settings size={13} />إدارة التطبيقات</button>}
          <span className="badge b-brass" style={{ marginInlineStart: 'auto' }}>{me.name} · {ROLES[me.role]?.ar?.split(' — ')[0] || me.role}</span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span className="badge b-mint">{activeCount} تطبيقاً نشطاً لدورك</span>
          {mine.filter(a => a.soon).length > 0 && <span className="badge b-amber">{mine.filter(a => a.soon).length} ضمن خطة التطوير</span>}
          {mine.filter(a => a.soon).length === 0 && <span className="badge b-mint">خطة المراحل مكتملة ✓</span>}
          <span className="badge b-sky">محرك محاسبي مركزي واحد — كل التطبيقات تُقيّد فيه</span>
        </div>
        {manage && (
          <div className="note" style={{ marginTop: 10 }}>
            وضع الإدارة: أخفِ أو أظهر أو رتّب التطبيقات — الإخفاء هنا لا يعطّل الشاشة نفسها من القائمة الجانبية ولا يمس أي صلاحية.
          </div>
        )}
      </div>

      {/* المفضلة والأخيرة أعلى المركز */}
      {mode === 'all' && !qq && (favApps.length > 0 || recApps.length > 0) && (
        <div className="card" style={{ padding: 12 }}>
          {favApps.length > 0 && (
            <div className="appstrip" style={{ marginBottom: recApps.length ? 8 : 0 }}>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>⭐ المفضلة:</span>
              {favApps.map(a => <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}><span className="st">★</span>{a.ar}</button>)}
            </div>
          )}
          {recApps.length > 0 && (
            <div className="appstrip">
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>الأخيرة:</span>
              {recApps.map(a => <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}><Clock size={11} />{a.ar}{(u.rec || {})[a.id]?.count > 1 && <span style={{ fontSize: 9, color: 'var(--faint)' }}>×{(u.rec || {})[a.id].count}</span>}</button>)}
            </div>
          )}
        </div>
      )}

      {/* الشبكة بالتصنيفات */}
      {REG_CATS.map(c => {
        const list = shown.filter(a => a.cat === c.id);
        if (!list.length) return null;
        return (
          <div key={c.id}>
            <div className="appcat">
              <c.icon size={17} color="var(--brass)" />
              <span className="t">{c.ar}</span>
              <span className="c">{c.en} · {list.filter(a => !a.soon).length} نشط{list.some(a => a.soon) ? ' + ' + list.filter(a => a.soon).length + ' قادم' : ''}</span>
            </div>
            <div className="appgrid">
              {list.map(a => manage ? (
                <div key={a.id} className={'appc' + (hidden.includes(a.id) ? ' soon' : '')}>
                  <div className="appc-top">
                    <div className="appc-ic"><a.icon size={19} /></div>
                    <div><div className="appc-n">{a.ar}</div><div className="appc-e">{a.en}</div></div>
                  </div>
                  <div className="appc-f" style={{ marginTop: 'auto' }}>
                    <button className={'btn sm ' + (hidden.includes(a.id) ? 'ok' : 'gh')} onClick={() => toggleHidden(a.id)}>
                      {hidden.includes(a.id) ? 'إظهار' : 'إخفاء'}</button>
                    <button className="btn sm gh" onClick={() => move(a.id, -1)}>▲</button>
                    <button className="btn sm gh" onClick={() => move(a.id, 1)}>▼</button>
                    {hidden.includes(a.id) && <span className="badge b-rose">مخفي</span>}
                  </div>
                </div>
              ) : <Card key={a.id} a={a} />)}
            </div>
          </div>
        );
      })}
      {shown.length === 0 && (
        <div className="card"><div className="empty">لا نتائج لبحثك — جرّب كلمة أخرى مثل «فاتورة» أو «قيد» أو «راتب».</div></div>
      )}

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>معمارية المركز:</b> كل بطاقة تفتح وحدة فعلية تعمل الآن — لا صفحات وهمية.
          التطبيقات كلها تتشارك نفس المستخدمين والفروع ودليل الحسابات والشركاء (طبقة تكامل واحدة)،
          وكل عملية مالية فيها تصب تلقائيًا في المحرك المحاسبي المركزي: عملية ← قيد ← أستاذ ← ميزان ← قوائم.
          بطاقات «قريباً» هي خطة التطوير المعتمدة (م٣ الضريبة، م٤ المشتريات والمخزون، م٥ الأصول والتسوية) وتظهر لأدوار المركز فقط.
        </div>
      </div>
    </div>
  );
}

/* ================= شاشة المحاسبة — م١+م٢: دليل، قيود، ميزان، قوائم ================= */
function Accounting({ org, ops, me, commit, commitOrg, say, setTab, acctIntent }) {
  const [view, setView] = useState('jr');           // jr قيود · coa دليل · tb ميزان · fs قوائم
  const [open, setOpen] = useState({});             // القيود المفتوحة التفاصيل
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('');           // فلتر شهر للقيود
  const [from, setFrom] = useState('');             // فترة الميزان/القوائم
  const [to, setTo] = useState('');
  const [bf, setBf] = useState('');                 // فلتر الفرع: '' الكل · central مركزي · bId
  const [jm, setJm] = useState(null);               // نموذج القيد اليدوي
  const [astF, setAstF] = useState(null);           // نموذج أصل ثابت
  const [brF, setBrF] = useState({ date: today(), stmt: '', note: '' }); // نموذج تسوية بنكية

  // فتح شاشة محددة قادمة من مركز التطبيقات (دليل/ميزان/قوائم…)
  useEffect(() => { if (acctIntent && acctIntent.v) setView(acctIntent.v); }, [acctIntent && acctIntent.ts]);

  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const canPost = ROLES[me?.role]?.scope === 'all';

  const entries = A.entries.filter(e =>
    (!month || (e.date || '').startsWith(month)) &&
    (!q.trim() || (e.title + ' ' + e.no + ' ' + (e.src || '')).includes(q.trim()))
  );
  const kinds = ['asset', 'liab', 'equity', 'rev', 'exp'];
  const srcBadge = (s) => s === 'إغلاق وردية' ? 'b-mint'
    : s === 'كشف الرواتب' ? 'b-sky'
    : s === 'قيد يدوي' || s === 'قيد افتتاحي' ? 'b-violet'
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
  const fsEntries = A.entries.filter(e => inPeriod(e, from, to));      // قائمة الدخل بالفترة
  const fsAgg = aggOf(fsEntries);
  const bsEntries = A.entries.filter(e => inPeriod(e, '', to));        // المركز المالي تراكمي حتى تاريخ
  const bsAgg = aggOf(bsEntries);
  const balOf = (a, m) => {
    const x = m[a.code] || { debit: 0, credit: 0 };
    return (a.kind === 'asset' || a.kind === 'exp') ? x.debit - x.credit : x.credit - x.debit;
  };
  const revP = sum(A.accounts.filter(a => a.kind === 'rev'), a => balOf(a, fsAgg));
  const expP = sum(A.accounts.filter(a => a.kind === 'exp'), a => balOf(a, fsAgg));
  const netP = Math.round((revP - expP) * 100) / 100;
  const bsAssets = sum(A.accounts.filter(a => a.kind === 'asset'), a => balOf(a, bsAgg));
  const bsLiab = sum(A.accounts.filter(a => a.kind === 'liab'), a => balOf(a, bsAgg));
  const bsEquity = sum(A.accounts.filter(a => a.kind === 'equity'), a => balOf(a, bsAgg));
  const bsProfit = Math.round((sum(A.accounts.filter(a => a.kind === 'rev'), a => balOf(a, bsAgg))
    - sum(A.accounts.filter(a => a.kind === 'exp'), a => balOf(a, bsAgg))) * 100) / 100;
  const bsOk = Math.abs(bsAssets - (bsLiab + bsEquity + bsProfit)) < 0.01;

  // ===== م٣: الضريبة =====
  const taxCfg = org.taxCfg || {};
  const taxOn = !!taxCfg.enabled;
  const taxRate = Number(taxCfg.rate) || 15;
  const canTax = !!ROLES[me?.role]?.admin;
  const vsum = { out: 0, inn: 0, netSales: 0, netPurch: 0 };
  fsEntries.forEach(e => { if (e.vat) { vsum.out += e.vat.out; vsum.inn += e.vat.inn; vsum.netSales += e.vat.netSales; vsum.netPurch += e.vat.netPurch; } });
  const vatDue = Math.round((vsum.out - vsum.inn) * 100) / 100;
  const setQuarter = () => {
    const d = new Date(); const qs = Math.floor(d.getMonth() / 3) * 3;
    const f = new Date(d.getFullYear(), qs, 1), t = new Date(d.getFullYear(), qs + 3, 0);
    setFrom(f.toISOString().slice(0, 10)); setTo(t.toISOString().slice(0, 10));
  };
  const saveTax = async (next, title, details) => {
    await commitOrg(d => ({ ...d, taxCfg: next }), {
      actionType: 'update', targetType: 'tax_settings', targetId: 'taxCfg', title, details
    });
  };

  // ===== م٥: الأصول الثابتة =====
  const saveAst = async () => {
    const f = astF;
    if (!f.name.trim()) return say('أدخل اسم الأصل', 'no');
    const cost = Number(f.cost) || 0;
    if (cost <= 0) return say('أدخل تكلفة الأصل', 'no');
    if (!(Number(f.lifeYears) > 0)) return say('أدخل العمر الإنتاجي بالسنوات', 'no');
    const rec = { id: f.id || uid('as'), name: f.name.trim(), cost, buyDate: f.buyDate || today(), lifeYears: Number(f.lifeYears), fund: f.fund || 'none', note: f.note || '' };
    await commitOrg(d => ({ ...d, assets: f.id ? (d.assets || []).map(x => x.id === f.id ? rec : x) : [...(d.assets || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'fixed_asset', targetId: rec.id,
      title: f.id ? 'عدّل أصلاً ثابتاً (أُعيد اشتقاق إهلاكه)' : 'سجّل أصلاً ثابتاً',
      details: rec.name + ' · ' + money(cost) + ' · ' + rec.lifeYears + ' سنة'
    });
    setAstF(null); say('حُفظ الأصل — قيود الشراء والإهلاك تولّدت تلقائياً ✓');
  };

  // ===== م٥: التسوية البنكية =====
  const bankBookAt = (d) => {
    let v = 0;
    A.entries.forEach(e => { if (!d || (e.date || '') <= d) e.lines.forEach(l => { if (l.code === '1201') v += l.debit - l.credit; }); });
    return Math.round(v * 100) / 100;
  };
  const bankMoves = A.entries
    .filter(e => e.lines.some(l => l.code === '1201'))
    .slice(0, 60)
    .map(e => ({ ...e, bankD: sum(e.lines.filter(l => l.code === '1201'), l => l.debit), bankC: sum(e.lines.filter(l => l.code === '1201'), l => l.credit) }));
  const saveBankRec = async () => {
    const stmt = Number(brF.stmt) || 0;
    const book = bankBookAt(brF.date);
    const rec = { id: uid('br'), date: brF.date || today(), stmtBalance: stmt, bookBalance: book,
      diff: Math.round((stmt - book) * 100) / 100, note: brF.note || '', by: me?.name || '', at: nowISO() };
    await commit(d => ({ ...d, bankRecs: [rec, ...(d.bankRecs || [])] }), {
      actionType: 'create', targetType: 'bank_rec', targetId: rec.id,
      title: 'وثّق تسوية بنكية', details: rec.date + ' · كشف ' + money(stmt) + ' · دفتر ' + money(book) + ' · فرق ' + money(rec.diff)
    });
    setBrF({ date: today(), stmt: '', note: '' }); say('وُثّقت التسوية — عالج الفرق بقيد يدوي إن لزم ✓');
  };
  const lastRec = (ops.bankRecs || [])[0];

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

  // ===== v8.0: طباعة القوائم المالية A4 =====
  const printFS = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
    const co = org.company || {};
    const period = (from || to) ? ('الفترة: ' + (from || 'البداية') + ' ← ' + (to || today())) : 'كامل المدة حتى ' + arDate(today());
    const rowsOf = (kind, agg) => A.accounts.filter(a => a.kind === kind && agg[a.code])
      .map(a => `<tr><td>${a.name}</td><td class="n">${money(balOf(a, agg))}</td></tr>`).join('');
    const bsRows = (kinds2) => A.accounts.filter(a => kinds2.includes(a.kind) && bsAgg[a.code] && Math.abs(balOf(a, bsAgg)) > 0.004)
      .map(a => `<tr><td>${a.name}</td><td class="n">${balOf(a, bsAgg) < 0 ? '(' + money(-balOf(a, bsAgg)) + ')' : money(balOf(a, bsAgg))}</td></tr>`).join('');
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>القوائم المالية — ${co.name || ''}</title>
    <style>*{font-family:'Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:26px;color:#1a1a1a;font-size:12.5px}
    .h{display:flex;justify-content:space-between;border-bottom:2px solid #8C6F2C;padding-bottom:10px;margin-bottom:14px}
    .co{font-size:19px;font-weight:800;color:#5a4a1e}.sub{font-size:11px;color:#666;margin-top:2px}
    h2{font-size:15px;margin:14px 0 8px;color:#5a4a1e}table{width:100%;border-collapse:collapse;margin-bottom:8px}
    td{padding:6px 8px;border:1px solid #e6ddc8}.n{text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
    .tot td{background:#f5f0e4;font-weight:800;border-top:2px solid #8C6F2C}
    .ft{margin-top:14px;font-size:10px;color:#888;text-align:center}.grid2{display:flex;gap:16px}.grid2>div{flex:1}</style></head><body>
    <div class="h"><div><div class="co">${co.name || 'الشركة'}</div><div class="sub">${co.taxNumber ? 'الرقم الضريبي: ' + co.taxNumber : ''}</div></div>
    <div style="text-align:left"><div style="font-size:17px;font-weight:800">القوائم المالية</div><div class="sub">${period}</div></div></div>
    <div class="grid2"><div>
    <h2>قائمة الدخل</h2><table>
    ${rowsOf('rev', fsAgg)}<tr class="tot"><td>إجمالي الإيرادات</td><td class="n">${money(revP)}</td></tr>
    ${rowsOf('exp', fsAgg)}<tr class="tot"><td>إجمالي المصروفات</td><td class="n">(${money(expP)})</td></tr>
    <tr class="tot"><td>${netP >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</td><td class="n">${money(netP)}</td></tr></table>
    </div><div>
    <h2>قائمة المركز المالي</h2><table>
    <tr class="tot"><td colspan="2">الأصول</td></tr>${bsRows(['asset'])}
    <tr class="tot"><td>إجمالي الأصول</td><td class="n">${money(bsAssets)}</td></tr>
    <tr class="tot"><td colspan="2">الخصوم وحقوق الملكية</td></tr>${bsRows(['liab', 'equity'])}
    <tr><td>أرباح الفترة المتراكمة</td><td class="n">${money(bsProfit)}</td></tr>
    <tr class="tot"><td>الإجمالي ${bsOk ? '(يطابق الأصول ✓)' : ''}</td><td class="n">${money(bsLiab + bsEquity + bsProfit)}</td></tr></table>
    </div></div>
    ${taxOn ? '<div class="sub">الأرقام صافية — ضريبة القيمة المضافة مفصولة في حسابَي المدخلات والمخرجات.</div>' : '<div class="sub">الأرقام إجمالية شاملة الضريبة.</div>'}
    <div class="ft">صادر من منصة الإغلاق اليومي — ${arDate(today())} · القيود مشتقة تلقائيًا ومتوازنة (مدين = دائن)</div></body></html>`);
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
    if (!jmOk) return say('القيد غير مكتمل — اختر الحسابات وتأكد أن مجموع المدين يساوي الدائن', 'no');
    const rec = {
      id: uid('jm'), date: jm.date || today(), title: jm.title.trim() || (jm.opening ? 'قيد افتتاحي' : 'قيد يدوي'),
      opening: !!jm.opening, by: me?.name || '', createdAt: nowISO(),
      lines: jm.lines.filter(l => l.code && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0)
        .map(l => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
    };
    await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), {
      actionType: 'create', targetType: 'journal_entry', targetId: rec.id,
      title: rec.opening ? 'أضاف قيدًا افتتاحيًا' : 'أضاف قيدًا محاسبيًا يدويًا',
      details: rec.title + ' · ' + money(sum(rec.lines, l => l.debit)) + ' ر.س'
    });
    setJm(null); say('سُجّل القيد ✓ — التصحيح لاحقًا يكون بقيد عكسي لا بالحذف');
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
      {(from || to || bf) && <button className="btn sm gh" onClick={() => { setFrom(''); setTo(''); setBf(''); }}>إظهار الكل</button>}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        <Kpi label="القيود المسجّلة" value={String(A.entries.length)} sub="تلقائية من عملياتك + يدوية المحاسب" icon={FileText} color="#4FB286" />
        <Kpi label={A.balanced ? 'كل القيود متوازنة ✓' : 'يوجد قيد غير متوازن!'} value={money(A.totalDebit)}
          sub="إجمالي المدين = إجمالي الدائن" icon={Scale} color={A.balanced ? '#C8A24A' : '#D9544D'} />
        <Kpi label="صافي نتيجة الفترة المعروضة" value={money(netP)} sub={netP >= 0 ? 'ربح' : 'خسارة'} icon={TrendingUp} color={netP >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="حسابات نشطة" value={String(A.accounts.filter(a => a.active).length) + ' / ' + A.accounts.length}
          sub="من دليل الحسابات" icon={Landmark} color="#5B93C4" />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (view === 'jr' ? ' pri' : ' gh')} onClick={() => setView('jr')}><FileText size={14} />القيود اليومية</button>
        <button className={'btn sm' + (view === 'coa' ? ' pri' : ' gh')} onClick={() => setView('coa')}><Landmark size={14} />دليل الحسابات</button>
        <button className={'btn sm' + (view === 'tb' ? ' pri' : ' gh')} onClick={() => setView('tb')}><Scale size={14} />ميزان المراجعة</button>
        <button className={'btn sm' + (view === 'fs' ? ' pri' : ' gh')} onClick={() => setView('fs')}><FileBarChart size={14} />القوائم المالية</button>
        <button className={'btn sm' + (view === 'cc' ? ' pri' : ' gh')} onClick={() => setView('cc')}><BarChart3 size={14} />مراكز التكلفة</button>
        <button className={'btn sm' + (view === 'vat' ? ' pri' : ' gh')} onClick={() => setView('vat')}><Receipt size={14} />الضريبة</button>
        <button className={'btn sm' + (view === 'ast' ? ' pri' : ' gh')} onClick={() => setView('ast')}><Building2 size={14} />الأصول</button>
        <button className={'btn sm' + (view === 'bank' ? ' pri' : ' gh')} onClick={() => setView('bank')}><Landmark size={14} />التسوية البنكية</button>
        {canPost && <button className="btn sm" style={{ marginInlineStart: 'auto' }} onClick={newJm}><Plus size={14} />قيد يدوي / افتتاحي</button>}
      </div>

      {view === 'jr' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><FileText size={15} color="var(--brass)" />القيود اليومية — اضغط أي قيد لتفاصيله</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
                      <td className="num" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{e.date}</td>
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

      {view === 'coa' && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><Landmark size={15} color="var(--brass)" />دليل الحسابات — أرصدة حيّة، وذمّة مستقلة لكل تطبيق توصيل</div>
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
                          {a.link && <div style={{ fontSize: 9.5, color: 'var(--sky)' }}>مرتبط: {a.link}</div>}</td>
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
            {periodBar}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الرمز</th><th>الحساب</th><th style={{ textAlign: 'end' }}>مدين الفترة</th><th style={{ textAlign: 'end' }}>دائن الفترة</th><th style={{ textAlign: 'end' }}>الرصيد</th></tr></thead>
              <tbody>
                {A.accounts.filter(a => tbAgg[a.code]).map(a => {
                  const x = tbAgg[a.code];
                  const b = (a.kind === 'asset' || a.kind === 'exp') ? x.debit - x.credit : x.credit - x.debit;
                  return (
                    <tr key={a.code}>
                      <td>{codeChip(a.code)}</td>
                      <td style={{ fontSize: 12.5 }}>{a.name}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{x.debit ? money(x.debit) : '—'}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{x.credit ? money(x.credit) : '—'}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b < 0 ? 'var(--rose)' : 'var(--txt)' }}>{fmtBal(b)}</td>
                    </tr>
                  );
                })}
                {tbEntries.length === 0 && <tr><td colSpan={5}><div className="empty">لا حركة في هذه الفترة/الفرع.</div></td></tr>}
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td colSpan={2}>إجمالي الفترة {Math.abs(tbD - tbC) < 0.01 ? '— متوازن ✓' : '— غير متوازن!'}</td>
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

      {view === 'fs' && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-h">
              <div className="card-t"><TrendingUp size={15} color="var(--mint)" />قائمة الدخل {from || to ? '(الفترة المحددة)' : '(كامل المدة)'}</div>
              <button className="btn sm" onClick={printFS}><Printer size={13} />طباعة القوائم A4</button>
            </div>
            {periodBar}
            <div className="tw" style={{ marginTop: 10 }}>
              <table className="tb">
                <tbody>
                  {A.accounts.filter(a => a.kind === 'rev' && fsAgg[a.code]).map(a => (
                    <tr key={a.code}><td>{a.name}</td><td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{money(balOf(a, fsAgg))}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}><td>إجمالي الإيرادات</td><td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{money(revP)}</td></tr>
                  {A.accounts.filter(a => a.kind === 'exp' && fsAgg[a.code]).map(a => (
                    <tr key={a.code}><td style={{ color: 'var(--dim)' }}>{a.name}</td><td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>({money(balOf(a, fsAgg))})</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}><td>إجمالي المصروفات</td><td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>({money(expP)})</td></tr>
                  <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                    <td>{netP >= 0 ? 'صافي الربح' : 'صافي الخسارة'}{revP > 0 && <span className="badge b-dim" style={{ marginInlineStart: 8 }}>هامش {Math.round(netP / revP * 1000) / 10}%</span>}</td>
                    <td className="num" style={{ textAlign: 'end', color: netP >= 0 ? 'var(--mint)' : 'var(--rose)', fontSize: 15 }}>{money(netP)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>{taxOn ? 'الإيرادات والمصروفات صافية — الضريبة مفصولة في حسابَي المدخلات (1501) والمخرجات (2301).' : 'الأرقام إجمالية شاملة الضريبة — فعّل الاحتساب من شاشة الضريبة لفصلها.'}</div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><Landmark size={15} color="var(--brass)" />قائمة المركز المالي {to ? 'حتى ' + to : '(حتى اليوم)'}</div>
            <div className="tw">
              <table className="tb">
                <tbody>
                  <tr><td colSpan={2} style={{ fontWeight: 800, color: 'var(--brass-l)' }}>الأصول</td></tr>
                  {A.accounts.filter(a => a.kind === 'asset' && bsAgg[a.code] && Math.abs(balOf(a, bsAgg)) > 0.004).map(a => (
                    <tr key={a.code}><td style={{ color: 'var(--dim)' }}>{a.name}</td><td className="num" style={{ textAlign: 'end' }}>{fmtBal(balOf(a, bsAgg))}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}><td>إجمالي الأصول</td><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(bsAssets)}</td></tr>
                  <tr><td colSpan={2} style={{ fontWeight: 800, color: 'var(--brass-l)', paddingTop: 12 }}>الخصوم وحقوق الملكية</td></tr>
                  {A.accounts.filter(a => (a.kind === 'liab' || a.kind === 'equity') && bsAgg[a.code] && Math.abs(balOf(a, bsAgg)) > 0.004).map(a => (
                    <tr key={a.code}><td style={{ color: 'var(--dim)' }}>{a.name}</td><td className="num" style={{ textAlign: 'end' }}>{fmtBal(balOf(a, bsAgg))}</td></tr>
                  ))}
                  <tr><td style={{ color: 'var(--dim)' }}>أرباح الفترة المتراكمة (تلقائي)</td><td className="num" style={{ textAlign: 'end', color: bsProfit >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{fmtBal(bsProfit)}</td></tr>
                  <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                    <td>الإجمالي {bsOk ? '— يطابق الأصول ✓' : '— لا يطابق!'}</td>
                    <td className="num" style={{ textAlign: 'end', color: bsOk ? 'var(--brass-l)' : 'var(--rose)' }}>{money(bsLiab + bsEquity + bsProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>الأرصدة الافتتاحية (رأس المال، أرصدة سابقة) تُدخل من زر «قيد يدوي / افتتاحي» مقابل حساب 3101.</div>
          </div>
        </div>
      )}

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
            <div className="card-t" style={{ marginBottom: 10 }}><BarChart3 size={15} color="var(--brass)" />مراكز التكلفة — أرقام مباشرة من القيود الموسومة بالفرع</div>
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
              توزيع هذه المصروفات على الفروع بنِسَب تحميل تحددها أنت — متاح كخطوة تالية متى رغبت، ولا نفترض نسبًا من عندنا.
            </div>
          </div>
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
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><FileText size={15} color="var(--brass)" />مسودة الإقرار — بصيغة نموذج الهيئة</div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>المبلغ الصافي</th><th style={{ textAlign: 'end' }}>الضريبة {taxRate}%</th></tr></thead>
                  <tbody>
                    <tr><td>المبيعات الخاضعة للنسبة الأساسية</td><td className="num" style={{ textAlign: 'end' }}>{money(vsum.netSales)}</td><td className="num" style={{ textAlign: 'end' }}>{money(vsum.out)}</td></tr>
                    <tr><td>المشتريات الخاضعة للنسبة الأساسية</td><td className="num" style={{ textAlign: 'end' }}>{money(vsum.netPurch)}</td><td className="num" style={{ textAlign: 'end' }}>{money(vsum.inn)}</td></tr>
                    <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                      <td>صافي الضريبة {vatDue >= 0 ? 'المستحقة' : '(رصيد دائن لصالحك)'}</td><td />
                      <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)', fontSize: 14 }}>{money(vatDue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                ⚠️ <b>بشفافية:</b> هذه مسودة تساعدك أنت ومحاسبك على تعبئة الإقرار في بوابة الهيئة — وليست تقديمًا رسميًا.
                الفوترة الإلكترونية المعتمدة (منصة فاتورة) تتطلب ربطًا رسميًا منفصلًا.
                فواتير التوريد الجديدة تُفصل ضريبتها عبر حقل «خاضعة للضريبة» عند إدخالها؛ الفواتير القديمة المسجلة قبل الحقل تبقى إجمالية.
              </div>
            </div>
          </>}
          {!taxOn && <div className="card"><div className="empty">فعّل الاحتساب أعلاه لتظهر مؤشرات الضريبة ومسودة الإقرار من قيودك مباشرة.</div></div>}
        </div>
      )}

      {view === 'ast' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="grid g3" style={{ flex: 1, minWidth: 280 }}>
              <Kpi label="تكلفة الأصول" value={money(sum(A.assetRows, a => a.cost))} sub={A.assetRows.length + ' أصلاً مسجلاً'} icon={Building2} color="#C8A24A" />
              <Kpi label="مجمّع الإهلاك" value={money(sum(A.assetRows, a => a.accum))} sub="قسط ثابت شهري تلقائي" icon={TrendingDown} color="#E0A458" />
              <Kpi label="القيمة الدفترية" value={money(sum(A.assetRows, a => a.book))} sub="التكلفة ناقص المجمّع" icon={Scale} color="#4FB286" />
            </div>
            {canPost && <button className="btn pri" style={{ alignSelf: 'flex-start' }} onClick={() => setAstF({ name: '', cost: '', buyDate: today(), lifeYears: '5', fund: '1201', note: '' })}><Plus size={14} />أصل جديد</button>}
          </div>
          <div className="card">
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الأصل</th><th>الشراء</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>القسط الشهري</th><th style={{ textAlign: 'end' }}>المجمّع</th><th style={{ textAlign: 'end' }}>الدفترية</th><th>الحالة</th><th /></tr></thead>
                <tbody>
                  {A.assetRows.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{a.name}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{a.lifeYears} سنة · {a.fund === 'none' ? 'بلا قيد شراء (مسجل سابقاً)' : 'التمويل: ' + ((({ '1101': 'الخزينة', '1201': 'البنك', '3101': 'افتتاحي' })[a.fund]) || '')}</div></td>
                      <td className="num" style={{ fontSize: 11 }}>{a.buyDate}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(a.cost)}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(a.monthly)}</td>
                      <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{money(a.accum)}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(a.book)}</td>
                      <td>{a.done ? <span className="badge b-dim">مُهلك بالكامل</span> : <span className="badge b-mint">قيد الإهلاك · {a.monthsDone}/{a.nM} شهراً</span>}</td>
                      <td>{canPost && <button className="btn sm gh" onClick={() => setAstF({ ...a, cost: String(a.cost), lifeYears: String(a.lifeYears) })}>تعديل</button>}</td>
                    </tr>
                  ))}
                  {A.assetRows.length === 0 && <tr><td colSpan={8}><div className="empty">سجّل أصولك الثابتة (معدات المطبخ، الأثاث، السيارات…) لتتولد قيود شرائها وإهلاكها تلقائياً.</div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 10 }}>الإهلاك قسط ثابت يبدأ من الشهر التالي للشراء ويتوقف باكتمال العمر — قيد مجمّع واحد شهرياً في اليومية. تعديل الأصل يعيد اشتقاق إهلاكه كاملاً (القيود محسوبة لا مخزنة). بيع أو استبعاد الأصول: بقيد يدوي حالياً.</div>
          </div>
        </div>
      )}

      {view === 'bank' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid g3">
            <Kpi label="رصيد البنك بالدفاتر (1201)" value={money(bankBookAt(''))} sub="الشبكة والمدفوعات البنكية — تجميعي" icon={Landmark} color="#C8A24A" />
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
                <thead><tr><th>التاريخ</th><th style={{ textAlign: 'end' }}>كشف البنك</th><th style={{ textAlign: 'end' }}>الدفتر</th><th style={{ textAlign: 'end' }}>الفرق</th><th>ملاحظة</th><th>بواسطة</th></tr></thead>
                <tbody>{(ops.bankRecs || []).map(r => (
                  <tr key={r.id}>
                    <td className="num" style={{ fontSize: 11 }}>{r.date}</td>
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
            <div className="card-t" style={{ marginBottom: 8 }}><ArrowLeftRight size={15} color="var(--brass)" />حركات حساب البنك (أحدث 60)</div>
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

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>حدود المرحلة الحالية (بشفافية):</b> {taxOn ? 'الضريبة مفعّلة (' + taxRate + '%) — المبيعات والمصروفات والفواتير الموسومة «خاضعة» مفصولة تلقائيًا.' : 'المبالغ إجمالية كما سُجّلت — فصل الضريبة متاح من شاشة الضريبة متى فعّلته.'}
          كل تطبيق توصيل له ذمّة مستقلة وتُفصل عمولته تلقائيًا بنسبته المعرّفة في «الفروع والمستخدمون ← تطبيقات التوصيل»؛ وعند استلام مستحقات تطبيق في البنك سجّلها بقيد يدوي (مدين البنك / دائن ذمّة التطبيق).
          المدفوعات البنكية تتجمع في حساب واحد (1201) وتُطابقه شاشة «التسوية البنكية» مع كشفك الفعلي.
          بطاقات «إيجارات وفواتير الفروع» الثابتة لا تولّد قيودًا (سدادها الفعلي يدخل من مصروفات الورديات) تفاديًا للازدواج.
          القيود لا تُحذف — التصحيح بقيد عكسي، حفاظًا على سلامة السجل أمام أي مراجع.
        </div>
      </div>

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

function Partners({ org, ops, me, commit, commitOrg, say }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [addP, setAddP] = useState(null);
  const [tx, setTx] = useState(null);
  const canEdit = ROLES[me.role]?.scope !== 'own';
  // كتابة سجل الرئيسي (مع المصادقة السحابية) للمدراء فقط
  const canWriteOrgP = !(typeof window !== 'undefined' && window.__forceOrgReadonly) && (!authApi.enabled || !!ROLES[me.role]?.admin);
  const pendReqs = ops.partnerRequests || [];

  const partners = useMemo(() => buildPartners(org, ops), [org, ops]);
  const cur = partners.find(p => p.key === openKey);

  // ترسيخ الأكواد على البطاقات القديمة مرة واحدة — حتى لا تتغير الأرقام بعد أي حذف مستقبلي
  useEffect(() => {
    if (!commitOrg || !canEdit || !canWriteOrgP) return;
    const missing = (org.suppliers || []).some(s => !s.code) || (org.employees || []).some(e => !e.code) || (org.partners || []).some(pt => !pt.code);
    if (!missing) return;
    const codeMap = new Map(partners.map(p => [p.key, p.code]));
    commitOrg(d => ({
      ...d,
      suppliers: (d.suppliers || []).map(s => s.code ? s : { ...s, code: codeMap.get('sup:' + s.id) }),
      employees: (d.employees || []).map(e => e.code ? e : { ...e, code: codeMap.get('emp:' + e.id) }),
      partners: (d.partners || []).map(pt => pt.code ? pt : { ...pt, code: codeMap.get(pt.key || ('cust:' + pt.id)) })
    }), { actionType: 'update', targetType: 'user_account', targetId: 'partner-codes', title: 'تثبيت أرقام الشركاء', details: 'ترسيخ الترقيم التلقائي على بطاقات الشركاء' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let cr = 0, dr = 0, cCust = 0, cSupp = 0, cEmp = 0;
  partners.forEach(p => {
    if (p.balance > 0) cr += p.balance; else dr += -p.balance;
    if (p.type === 'customer') cCust++; else if (p.type === 'supplier') cSupp++; else cEmp++;
  });
  const net = cr - dr;
  const list = partners.filter(p => (filter === 'all' || p.type === filter) && (!q || (p.name || '').includes(q)));

  // اعتماد/رفض طلبات الإضافة الواردة من الفروع
  const approveReq = async (r) => {
    const id = uid('pt');
    const t = r.type === 'supplier' ? 'supplier' : r.type === 'employee' ? 'employee' : (r.type || 'customer');
    const code = nextPartnerCode(partners, t);
    let key, mut;
    if (t === 'supplier') { key = 'sup:' + id; mut = d => ({ ...d, suppliers: [...(d.suppliers || []), { id, code, name: r.name, category: r.cat || '', phone: r.phone || '', vatNo: '', terms: 0 }] }); }
    else if (t === 'employee') { key = 'emp:' + id; mut = d => ({ ...d, employees: [...(d.employees || []), { id, code, name: r.name, jobTitle: r.cat || '', phone: r.phone || '', baseSalary: 0, housingAllowance: 0, transportAllowance: 0, branchId: r.branchId || '', isActive: true }] }); }
    else { key = 'cust:' + id; mut = d => ({ ...d, partners: [...(d.partners || []), { id, key, code, name: r.name, type: t, cat: r.cat || '', phone: r.phone || '', tax: '', terms: 0 }] }); }
    const ok = await commitOrg(mut, { actionType: 'create', targetType: 'user_account', targetId: id, title: 'اعتمد طلب إضافة شريك', details: `${r.name} · ${code} · طلب من ${r.requestedBy || '—'}` });
    if (!ok) return;
    const openAmt = Number((r.opening || '').toString().replace(/,/g, '')) || 0;
    await commit(d => ({
      ...d,
      partnerRequests: (d.partnerRequests || []).filter(x => x.id !== r.id),
      ...(openAmt > 0 ? { ledgerEntries: [{ id: uid('le'), partnerKey: key, date: today(), desc: 'رصيد افتتاحي', src: 'open', ...(r.openingSide === 'debit' ? { debit: openAmt, credit: 0 } : { credit: openAmt, debit: 0 }) }, ...(d.ledgerEntries || [])] } : {})
    }), { actionType: 'update', targetType: 'user_account', targetId: r.id, title: 'إغلاق طلب إضافة شريك', details: r.name });
    say('اعتُمد الشريك ' + code + ' ✓');
  };
  const rejectReq = async (r) => {
    await commit(d => ({ ...d, partnerRequests: (d.partnerRequests || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: r.id, title: 'رفض طلب إضافة شريك', details: r.name });
    say('رُفض الطلب');
  };

  const saveCustomer = async () => {
    const c = addP;
    if (!c.name?.trim()) return say('اكتب اسم الشريك', 'no');
    if (!canWriteOrgP) {
      // دور غير إداري (كالمكتب الرئيسي المقيّد): يُرسل طلب اعتماد بدل كتابة تُرفض
      const req = {
        id: uid('pr'), name: c.name.trim(), type: c.type || 'customer', cat: c.cat || '', phone: c.phone || '',
        opening: c.opening || '', openingSide: c.openingSide || 'debit',
        requestedBy: me.name, branchId: '', branchName: '', at: nowISO()
      };
      const okReq = await commit(d => ({ ...d, partnerRequests: [req, ...(d.partnerRequests || [])] }), {
        actionType: 'create', targetType: 'user_account', targetId: req.id,
        title: 'طلب إضافة شريك للرئيسي', details: req.name + ' · بانتظار اعتماد الإدارة'
      });
      if (okReq) { say('أُرسل طلب اعتماد «' + req.name + '» لمسؤول النظام ✓'); setAddP(null); }
      return;
    }
    const id = uid('pt'); const key = 'cust:' + id;
    const code = nextPartnerCode(partners, c.type || 'customer');
    const rec = { id, key, code, name: c.name.trim(), type: c.type || 'customer', cat: c.cat || '', phone: c.phone || '', tax: c.tax || '', terms: Number(c.terms) || 0 };
    await commitOrg(d => ({ ...d, partners: [...(d.partners || []), rec] }),
      { actionType: 'create', targetType: 'user_account', targetId: id, title: 'أضاف شريكاً لدفتر الشركاء', details: rec.name + ' — ' + (PT_TYPE[rec.type]?.ar || '') });
    const openAmt = Number((c.opening || '').toString().replace(/,/g, '')) || 0;
    if (openAmt > 0) {
      const side = c.openingSide === 'debit' ? { debit: openAmt, credit: 0 } : { credit: openAmt, debit: 0 };
      await commit(d => ({ ...d, ledgerEntries: [{ id: uid('le'), partnerKey: key, date: today(), desc: 'رصيد افتتاحي', src: 'open', ...side }, ...(d.ledgerEntries || [])] }),
        { actionType: 'create', targetType: 'daily_closing', targetId: key, title: 'رصيد افتتاحي لشريك', details: rec.name });
    }
    say('تمت إضافة الشريك ✓'); setAddP(null);
  };

  const addEntry = async () => {
    const amt = Math.abs(Number((tx.amount || '').toString().replace(/,/g, ''))) || 0;
    if (amt <= 0) return say('أدخل مبلغاً صحيحاً', 'no');
    const side = tx.side === 'debit' ? { debit: amt, credit: 0 } : { credit: amt, debit: 0 };
    const entry = { id: uid('le'), partnerKey: cur.key, date: tx.date || today(), desc: tx.desc?.trim() || 'حركة يدوية', src: 'manual', ...side };
    await commit(d => ({ ...d, ledgerEntries: [entry, ...(d.ledgerEntries || [])] }),
      { actionType: 'create', targetType: 'daily_closing', targetId: cur.key, title: 'حركة يدوية في كشف حساب', details: `${cur.name} · ${tx.side === 'debit' ? 'مدين' : 'دائن'} ${money(amt)}` });
    say('تم تسجيل الحركة ✓'); setTx(null);
  };

  const delEntry = async (entryId) => {
    await commit(d => ({ ...d, ledgerEntries: (d.ledgerEntries || []).filter(e => e.id !== entryId) }),
      { actionType: 'delete', targetType: 'daily_closing', targetId: cur.key, title: 'حذف حركة يدوية', details: cur.name });
    say('حُذفت الحركة');
  };

  // ===== كشف حساب شريك =====
  if (cur) {
    let run = 0, sdr = 0, scr = 0;
    const rows = cur.txns.map((t, i) => {
      run += (t.credit || 0) - (t.debit || 0); sdr += t.debit || 0; scr += t.credit || 0;
      const src = PT_SRC[t.src] || PT_SRC.manual;
      const rbCol = Math.abs(run) < 0.005 ? 'var(--faint)' : (run > 0 ? 'var(--rose)' : 'var(--mint)');
      return (
        <tr key={i}>
          <td className="num" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{t.date}</td>
          <td style={{ fontSize: 12.5 }}>{t.desc}
            <div style={{ fontSize: 10, color: src.c, marginTop: 3 }}>● {src.t}{t.ref ? ' · ' + t.ref : ''}</div></td>
          <td className="num" style={{ textAlign: 'end' }}>{t.debit ? money(t.debit) : '—'}</td>
          <td className="num" style={{ textAlign: 'end' }}>{t.credit ? money(t.credit) : '—'}</td>
          <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: rbCol }}>{Math.abs(run) < 0.005 ? '0.00' : money(Math.abs(run))}</td>
          <td style={{ textAlign: 'center' }}>{(t.src === 'manual' || t.src === 'open') && canEdit
            ? <button className="btn sm gh" onClick={() => delEntry(t.entryId)} title="حذف"><Trash2 size={12} color="#D9544D" /></button>
            : <span style={{ fontSize: 9, color: 'var(--faint)' }} title="حركة تلقائية — تُصحَّح من مصدرها">🔒</span>}</td>
        </tr>
      );
    });
    const bal = scr - sdr;
    return (
      <div className="grid" style={{ gap: 14 }}>
        <button className="btn gh" style={{ alignSelf: 'flex-start' }} onClick={() => { setOpenKey(null); setTx(null); }}>
          <ChevronRight size={15} />رجوع إلى دفتر الشركاء</button>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, alignItems: 'center' }}>
          <div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="card-t" style={{ fontSize: 20 }}>{cur.name}</span><PartnerChip type={cur.type} />
              <span className="badge b-dim num" style={{ fontSize: 10, color: 'var(--brass)' }}>{cur.code}</span>
              {cur.linked && <span className="badge b-mint" style={{ fontSize: 10 }}>◍ مرتبط بالفروع</span>}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span className="badge b-dim">{cur.cat || '—'}</span>
              {cur.phone && <span className="badge b-dim">الجوال <span className="num">{cur.phone}</span></span>}
              {cur.tax && <span className="badge b-dim">ضريبي/هوية {cur.tax}</span>}
              {cur.terms ? <span className="badge b-dim">مهلة <span className="num">{cur.terms}</span> يوم</span> : null}
            </div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>الرصيد الحالي</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, margin: '4px 0', color: Math.abs(bal) < 0.005 ? 'var(--faint)' : (bal > 0 ? 'var(--rose)' : 'var(--mint)') }}>{money(Math.abs(bal))}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{Math.abs(bal) < 0.005 ? 'الحساب مسدّد' : (bal > 0 ? 'دائن — مستحق للطرف علينا' : 'مدين — مستحق لنا على الطرف')}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {canEdit && <button className="btn pri" onClick={() => setTx({ side: 'debit', date: today(), amount: '', desc: '' })}><Plus size={14} />إضافة حركة يدوية</button>}
          <button className="btn" onClick={() => printPartnerStatement(cur, org)}><Printer size={14} />طباعة كشف الحساب</button>
        </div>

        {tx && (
          <div className="card" style={{ border: '1px dashed var(--brass-d)', background: 'var(--ink3)' }}>
            <div className="grid g4" style={{ alignItems: 'end', gap: 10 }}>
              <Field label="التاريخ"><input className="inp" type="date" value={tx.date} onChange={e => setTx({ ...tx, date: e.target.value })} /></Field>
              <Field label="البيان" style={{ gridColumn: 'span 2' }}><input className="inp" value={tx.desc} placeholder="مثال: دفعة سداد نقدية" onChange={e => setTx({ ...tx, desc: e.target.value })} /></Field>
              <Field label="النوع"><select className="sel" value={tx.side} onChange={e => setTx({ ...tx, side: e.target.value })}>
                <option value="debit">مدين (سداد/تخفيض ما علينا)</option>
                <option value="credit">دائن (فاتورة/زيادة ما علينا)</option></select></Field>
              <Field label="المبلغ"><MoneyField value={tx.amount} onChange={v => setTx({ ...tx, amount: v })} /></Field>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn pri" onClick={addEntry}><Check size={14} />حفظ الحركة</button>
                <button className="btn gh" onClick={() => setTx(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th><th style={{ textAlign: 'end' }}>الرصيد</th><th></th></tr></thead>
              <tbody>{rows.length ? rows : <tr><td colSpan={6}><div className="empty">لا حركات على هذا الحساب بعد.</div></td></tr>}</tbody>
              <tfoot><tr style={{ background: 'var(--ink3)', fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '11px 14px' }}>الإجماليات</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(sdr)}</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(scr)}</td>
                <td className="num" style={{ textAlign: 'end', color: bal > 0 ? 'var(--rose)' : bal < 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(Math.abs(bal))}</td>
                <td></td></tr></tfoot>
            </table>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.7 }}>الحركات المعلَّمة 🔒 مصدرها فواتير/إغلاقات/سلف — تُصحَّح من مصدرها للحفاظ على تطابق التدقيق. الحركات اليدوية فقط قابلة للحذف من هنا.</div>
      </div>
    );
  }

  // ===== قائمة الشركاء =====
  return (
    <div className="grid" style={{ gap: 14 }}>
      {canWriteOrgP && pendReqs.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(200,162,74,.45)' }}>
          <div className="card-t" style={{ marginBottom: 10 }}><Bell size={15} color="var(--brass)" />طلبات إضافة شركاء بانتظار اعتمادك ({pendReqs.length})</div>
          <div className="grid" style={{ gap: 8 }}>
            {pendReqs.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '9px 12px', background: 'var(--ink)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name} <PartnerChip type={r.type === 'supplier' ? 'supplier' : r.type === 'employee' ? 'employee' : 'customer'} /></div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>
                    {r.cat ? r.cat + ' · ' : ''}طلب من {r.requestedBy || '—'}{r.branchName ? ' — ' + r.branchName : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button className="btn sm pri" onClick={() => approveReq(r)}><Check size={13} />اعتماد</button>
                  <button className="btn sm gh" onClick={() => rejectReq(r)}><X size={13} color="#D9544D" />رفض</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid g4">
        <Kpi label="إجمالي دائن (علينا)" value={money(cr)} sub="مستحق للموردين والموظفين" icon={TrendingUp} color="#D9544D" />
        <Kpi label="إجمالي مدين (لنا)" value={money(dr)} sub="مستحق من العملاء والسلف" icon={TrendingDown} color="#4FB286" />
        <Kpi label="صافي المركز" value={money(Math.abs(net))} sub={net >= 0 ? 'صافي التزام علينا' : 'صافي مستحق لنا'} icon={ArrowLeftRight} color="#C8A24A" />
        <Kpi label="عدد الشركاء" value={String(partners.length)} sub={`${cCust} عميل · ${cSupp} مورد · ${cEmp} موظف`} icon={Users} color="#5B93C4" />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'الكل', partners.length], ['customer', 'العملاء', cCust], ['supplier', 'الموردون', cSupp], ['employee', 'الموظفون', cEmp]].map(([k, lbl, n]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' pri' : ' gh')} onClick={() => setFilter(k)}>{lbl} <span className="num" style={{ opacity: .7 }}>{n}</span></button>
        ))}
        <div style={{ marginInlineStart: 'auto', position: 'relative' }}>
          <input className="inp" style={{ width: 210, paddingInlineStart: 32 }} value={q} placeholder="ابحث باسم الشريك…" onChange={e => setQ(e.target.value)} />
          <Search size={14} style={{ position: 'absolute', insetInlineStart: 10, top: 11, color: 'var(--faint)' }} />
        </div>
        {canEdit && <button className="btn sm" onClick={() => setAddP({ type: 'customer', openingSide: 'debit' })}><Plus size={14} />إضافة شريك</button>}
      </div>

      <div className="card">
        <div className="tw">
          <table className="tb cards">
            <thead><tr><th>الشريك</th><th>النوع</th><th>الجوال</th><th>الربط بالفروع</th><th>الرصيد</th><th></th></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.key} style={{ cursor: 'pointer' }} onClick={() => setOpenKey(p.key)}>
                  <td data-label="الشريك"><div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}><span className="num" style={{ color: 'var(--brass)' }}>{p.code}</span> · {p.cat}</div></td>
                  <td data-label="النوع"><PartnerChip type={p.type} /></td>
                  <td data-label="الجوال" className="num" style={{ fontSize: 12, color: 'var(--dim)' }}>{p.phone || '—'}</td>
                  <td data-label="الربط">{p.linked ? <span className="badge b-mint" style={{ fontSize: 10 }}>◍ مرتبط</span> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                  <td data-label="الرصيد" className="num"><BalCell bal={p.balance} /></td>
                  <td style={{ textAlign: 'end', color: 'var(--faint)', fontSize: 11.5 }}>كشف الحساب ←</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6}><div className="empty">لا شركاء مطابقون.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {addP && (
        <Modal title="إضافة شريك جديد" icon={Users} onClose={() => setAddP(null)}
          foot={<><button className="btn pri" onClick={saveCustomer}><Check size={14} />حفظ الشريك</button>
            <button className="btn gh" onClick={() => setAddP(null)}>إلغاء</button></>}>
          <Field label="نوع الشريك">
            <select className="sel" value={addP.type} onChange={e => setAddP({ ...addP, type: e.target.value })}>
              <option value="customer">عميل (يدين لنا عادةً)</option>
              <option value="supplier">مورد</option>
              <option value="employee">موظف</option>
            </select>
          </Field>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 8, marginTop: -4 }}>الموردون والموظفون يظهرون تلقائياً من وحداتهم؛ أضِف هنا العملاء أو أي شريك غير مسجّل.</div>
          <Field label="الاسم"><input className="inp" value={addP.name || ''} onChange={e => setAddP({ ...addP, name: e.target.value })} placeholder="اسم الشريك أو الجهة" /></Field>
          <div className="grid g2">
            <Field label="التصنيف"><input className="inp" value={addP.cat || ''} onChange={e => setAddP({ ...addP, cat: e.target.value })} placeholder="مثال: عميل جملة" /></Field>
            <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={addP.phone || ''} onChange={e => setAddP({ ...addP, phone: e.target.value })} /></Field>
            <Field label="الرقم الضريبي/الهوية"><input className="inp" value={addP.tax || ''} onChange={e => setAddP({ ...addP, tax: e.target.value })} /></Field>
            <Field label="مهلة السداد (يوم)"><input className="inp" inputMode="numeric" value={addP.terms || ''} onChange={e => setAddP({ ...addP, terms: e.target.value })} /></Field>
          </div>
          <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 6 }}>
            <div className="lbl">رصيد افتتاحي (اختياري)</div>
            <div className="grid g2">
              <Field label="الجهة"><select className="sel" value={addP.openingSide} onChange={e => setAddP({ ...addP, openingSide: e.target.value })}>
                <option value="debit">مدين — الطرف مدين لنا</option>
                <option value="credit">دائن — نحن مدينون للطرف</option></select></Field>
              <Field label="المبلغ"><MoneyField value={addP.opening || ''} onChange={v => setAddP({ ...addP, opening: v })} /></Field>
            </div>
          </div>
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
    const win = scoped.closings.filter(c => countedClosing(c) && c.date >= fs);
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
    const endpoint = import.meta.env && import.meta.env.VITE_AI_ENDPOINT;
    const directKey = import.meta.env && import.meta.env.VITE_ANTHROPIC_KEY;
    try {
      let result;
      if (endpoint) {
        // وسيط خادم آمن (الأفضل)
        const r = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ digest })
        });
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'failed');
        result = data.result;
      } else if (directKey) {
        // اتصال مباشر بواجهة Anthropic (مفتاح مضمّن وقت البناء)
        const prompt = `أنت مدير مالي (CFO) لمجموعة مطاعم سعودية. حلّل البيانات التالية وأجب بالعربية الفصحى المهنية.

البيانات: ${JSON.stringify(digest)}

أعد كائن JSON فقط دون أي نص أو علامات markdown، بهذا الشكل تماماً:
{
 "الملخص_التنفيذي": "فقرة من 3 جمل",
 "اتجاهات_المبيعات_والمصروفات": "فقرة تحليلية",
 "توصيات_خفض_التكلفة": ["توصية 1","توصية 2","توصية 3"],
 "مخاطر_النقدية": ["مخاطرة 1","مخاطرة 2"],
 "تقييم_الفروع": [{"الفرع":"الاسم","الدرجة":85,"الحالة":"ممتاز","التعليق":"جملة"}]
}
الحالة واحدة من: ممتاز، جيد جداً، متوسط، تحت الملاحظة.`;
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': directKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5', max_tokens: 1400,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message || 'failed');
        const txt = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
        const clean = txt.replace(/```json|```/g, '').trim();
        result = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      } else {
        throw new Error('no-endpoint');
      }
      setRes(result);
      say('اكتمل التحليل المالي الذكي');
    } catch (e) {
      if (e.message === 'no-endpoint') {
        setErr('المركز المالي الذكي غير مفعّل. لتفعيله: أضف سرّ VITE_ANTHROPIC_KEY في إعدادات المستودع (Actions Secrets) ثم أعد النشر. بقية وحدات المنصة تعمل كاملة.');
      } else {
        setErr('تعذّر إتمام التحليل: ' + (e.message || 'خطأ غير معروف') + '. تحقق من صحة المفتاح والرصيد.');
      }
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
  const [hist, setHist] = useState({ closings: [] });
  const [working, setWorking] = useState(false);
  const [c, setC] = useState(() => ({ ...(org.company || {}) }));
  const fileRef = useRef();
  const set = (k, v) => setC(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const h = await cloud.get(KEYS.hist, { closings: [] });
      setHist(h && Array.isArray(h.closings) ? h : { closings: [] });
    })();
  }, []);

  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
  const oldOnes = (ops.closings || []).filter(x => x.date < cutoff);

  const archiveOld = async () => {
    if (oldOnes.length === 0) return say('لا توجد إغلاقات أقدم من 90 يوماً', 'no');
    setWorking(true);
    try {
      const cur = await cloud.get(KEYS.hist, { closings: [] });
      const prev = (cur && Array.isArray(cur.closings)) ? cur.closings : [];
      const ids = oldOnes.map(x => x.id);
      const okStore = await cloud.set(KEYS.hist, { closings: [...oldOnes, ...prev].slice(0, 800), updatedAt: nowISO() });
      if (!okStore) { setWorking(false); return say('تعذّر حفظ الأرشيف — أعد المحاولة', 'no'); }
      await commit(d => ({
        ...d,
        closings: (d.closings || []).filter(x => x.date >= cutoff),
        transfers: (d.transfers || []).filter(t => !ids.includes(t.closingId))
      }), {
        actionType: 'update', targetType: 'system_settings', targetId: 'archive',
        title: 'أرشف إغلاقات قديمة', details: `${oldOnes.length} إغلاق أقدم من ${cutoff}`
      });
      const after = await cloud.get(KEYS.hist, { closings: [] });
      setHist(after && Array.isArray(after.closings) ? after : { closings: [] });
      say(`تمت أرشفة ${oldOnes.length} إغلاق — بيانات التشغيل أصبحت أخف`);
    } catch { say('تعذّرت الأرشفة — أعد المحاولة', 'no'); }
    setWorking(false);
  };

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
    ['الفروع', (org.branches || []).length], ['المستخدمون', (org.users || []).length],
    ['الموظفون', (org.employees || []).length], ['الإغلاقات', (ops.closings || []).length],
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
          <Field label="البريد الإلكتروني"><input className="inp" type="email" style={{ direction: 'ltr', textAlign: 'right' }} value={c.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        </div>
        <Field label="العنوان"><input className="inp" value={c.address} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="شعار المنشأة (يظهر في الإيصالات)">
          <PhotoField value={c.logoUrl} onChange={v => set('logoUrl', v)} say={say} />
        </Field>
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
  const isGM = ROLES[me.role]?.scope === 'all';

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const status = (b) => {
    const [h, m] = (b.shiftEndTime || '02:00').split(':').map(Number);
    const dl = new Date(now); dl.setHours(h, m, 0, 0);
    // الورديات التي تنتهي بعد منتصف الليل تخص يوم العمل السابق
    if (h < 6 && now.getHours() >= 6) dl.setDate(dl.getDate() + 1);
    const mins = Math.round((dl - now) / 60000);
    const workDay = h < 6 ? new Date(dl.getTime() - 86400000).toISOString().slice(0, 10) : dl.toISOString().slice(0, 10);
    const done = (ops.closings || []).some(c => c.branchId === b.id && c.date === workDay && countedClosing(c));
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
  const [branchFilter, setBranchFilter] = useState('all');
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
  const mine = (items || []).filter(i => ids.includes(i.branchId));
  const list = mine.filter(i => (filter === 'all' || i.category === filter)
    && (branchFilter === 'all' || i.branchId === branchFilter));
  const totalKb = sum(mine, i => i.fileSizeKb || 0);

  // تجميع حسب الفرع ثم اليوم (الأحدث أولاً)
  const grouped = (() => {
    const byBranch = {};
    list.forEach(it => {
      const bk = it.branchId || 'x';
      (byBranch[bk] = byBranch[bk] || { name: it.branchName, days: {} });
      const dk = it.uploadDate || '—';
      (byBranch[bk].days[dk] = byBranch[bk].days[dk] || []).push(it);
    });
    return Object.entries(byBranch).map(([bid, v]) => ({
      bid, name: v.name,
      days: Object.entries(v.days).sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, arr]) => ({ date, arr }))
    })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-t"><ImageIcon size={15} color="var(--brass)" />أرشيف الإيصالات والمستندات</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 5 }}>
              {mine.length} مستند · <span className="num">{(totalKb / 1024).toFixed(2)}</span> ميجابايت — تُضغط الصور تلقائياً قبل الحفظ.
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
        <div className="row" style={{ marginBottom: 8 }}>
          <button className={'btn sm' + (filter === 'all' ? ' pri' : ' gh')} onClick={() => setFilter('all')}>كل التصنيفات</button>
          {FILE_CATS.map(c => (
            <button key={c.id} className={'btn sm' + (filter === c.id ? ' pri' : ' gh')} onClick={() => setFilter(c.id)}>{c.ar}</button>
          ))}
        </div>
        {myBranches.length > 1 && (
          <div className="row">
            <button className={'btn sm' + (branchFilter === 'all' ? ' pri' : ' gh')} onClick={() => setBranchFilter('all')}>كل الفروع</button>
            {myBranches.map(b => (
              <button key={b.id} className={'btn sm' + (branchFilter === b.id ? ' pri' : ' gh')} onClick={() => setBranchFilter(b.id)}>{b.name}</button>
            ))}
          </div>
        )}
      </div>

      {items === null && <div className="card"><div className="empty">جارٍ تحميل الأرشيف…</div></div>}
      {items !== null && list.length === 0 && (
        <div className="card"><div className="empty">
          لا مستندات في هذا التصنيف. التقط صورة إيصال أو ارفعها لتُحفظ في أرشيف فروعك.
        </div></div>
      )}

      {grouped.map(g => (
        <div key={g.bid} className="card">
          <div className="card-t" style={{ marginBottom: 12 }}>
            <Store size={15} color="var(--brass)" />{g.name}
            <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>
              {sum(g.days, d => d.arr.length)} مستند
            </span>
          </div>
          {g.days.map(day => (
            <div key={day.date} style={{ marginBottom: 14 }}>
              <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                <CalendarDays size={13} color="var(--faint)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{arDate(day.date)}</span>
                <span className="badge b-dim">{day.arr.length}</span>
                <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
              </div>
              <div className="grid g4">
                {day.arr.map(it => (
                  <div key={it.id} className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--ink)' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={it.fileUrl} alt={it.title} onClick={() => setPreview(it)}
                        style={{ width: '100%', height: 120, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                      {it.source === 'closing' && (
                        <span className="badge b-mint" style={{ position: 'absolute', top: 6, insetInlineEnd: 6, fontSize: 9 }}>
                          <ClipboardCheck size={9} />إغلاق
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {it.title}
                      </div>
                      <div className="row" style={{ gap: 5 }}>
                        <span className="badge b-brass" style={{ fontSize: 9 }}>{it.categoryLabelAr || FILE_CATS.find(c => c.id === it.category)?.ar}</span>
                        {it.amount > 0 && <span className="badge b-dim" style={{ fontSize: 9 }}><span className="num">{money(it.amount)}</span></span>}
                      </div>
                      <div className="row" style={{ marginTop: 8, gap: 4 }}>
                        <button className="btn sm gh" onClick={() => setPreview(it)}><Eye size={11} /></button>
                        {it.source !== 'closing' && <button className="btn sm gh" onClick={() => del(it)}><Trash2 size={11} color="#D9544D" /></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

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

  const vatOut = grossRevenue * 15 / 115;
  const vatIn = sum(byCat.filter(x => x.taxable), x => x.v) * 15 / 115;
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

  const w = window.open('', '_blank', 'width=880,height=1000');
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
      <div class="co">${logo ? `<img class="logo" src="${logo}">` : ''}
        <div><div class="co-n">${co.name || 'المنشأة'}</div>
        <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div></div>
      </div>
      <div class="doc-title">قائمة الدخل (${meta.periodType})</div>
      <div class="doc-sub">${meta.scopeLabel} · ${meta.periodLabel}</div>
      <div class="doc-sub dim">عدد الإغلاقات: ${d.n} · تاريخ التصدير: ${new Date().toLocaleString('ar-SA-u-nu-latn')}</div>
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
function FinancialReports({ org, ops, myBranches, scoped, say }) {
  const [period, setPeriod] = useState('monthly');
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(today().slice(0, 4));
  const [bid, setBid] = useState('all');

  const branches = myBranches.filter(b => bid === 'all' || b.id === bid);
  const ids = branches.map(b => b.id);

  const range = period === 'daily' ? { from: day, to: day, label: arDate(day), type: 'يومية' }
    : period === 'monthly' ? { from: month + '-01', to: month + '-31', label: month, type: 'شهرية' }
    : { from: year + '-01-01', to: year + '-12-31', label: year, type: 'سنوية' };

  const data = useMemo(() => computeIncome(org, ops, scoped.closings, ids, range.from, range.to),
    [org, ops, scoped, ids.join(), range.from, range.to]);

  const m = (n) => money(n);
  const scopeLabel = bid === 'all' ? 'كل الفروع' : (branches[0]?.name || '');
  const branchLogo = bid !== 'all' ? branches[0]?.logoUrl : '';

  const doPrint = () => printIncomeA4(org, data, {
    periodType: range.type, periodLabel: range.label, scopeLabel, branchLogo
  });

  const exportCsv = () => {
    const rows = [
      ['قائمة الدخل', range.type, range.label, scopeLabel],
      ['مبيعات نقدية', data.R.cash], ['مبيعات الشبكة', data.R.card], ['تحويل بنكي', data.R.bank],
      ['تطبيقات التوصيل', data.R.del], ['إجمالي الإيراد', data.grossRevenue],
      ['عمولات التطبيقات', -data.commissions], ['صافي الإيراد', data.netRevenue],
      ...data.byCat.map(x => ['مصروف: ' + x.n, -x.v]),
      ['الالتزامات الثابتة', -data.fixedTotal], ['الرواتب غير المصروفة', -data.payrollRemaining],
      ['إجمالي التكاليف', -data.totalCost], ['الربح التشغيلي', data.operatingProfit],
      ['ض.ق.م المستحقة', -data.vatDue], ['صافي الربح بعد الضريبة', data.netAfterVat],
      ['فروقات الصندوق', data.cashVariance]
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `قائمة-الدخل-${range.type}-${range.label}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل قائمة الدخل');
  };

  const exportXlsx = () => {
    const rows = [
      ['مبيعات نقدية', +data.R.cash.toFixed(2)], ['مبيعات الشبكة', +data.R.card.toFixed(2)], ['تحويل بنكي', +data.R.bank.toFixed(2)],
      ['تطبيقات التوصيل', +data.R.del.toFixed(2)], ['إجمالي الإيراد', +data.grossRevenue.toFixed(2)],
      ['عمولات التطبيقات', -+data.commissions.toFixed(2)], ['صافي الإيراد', +data.netRevenue.toFixed(2)],
      ...data.byCat.map(x => ['مصروف: ' + x.n, -+x.v.toFixed(2)]),
      ['الالتزامات الثابتة', -+data.fixedTotal.toFixed(2)], ['الرواتب غير المصروفة', -+data.payrollRemaining.toFixed(2)],
      ['إجمالي التكاليف', -+data.totalCost.toFixed(2)], ['الربح التشغيلي', +data.operatingProfit.toFixed(2)],
      ['ض.ق.م المستحقة', -+data.vatDue.toFixed(2)], ['فروقات الصندوق', +data.cashVariance.toFixed(2)]
    ];
    exportExcel(`قائمة-الدخل-${range.type}-${range.label}`, `قائمة الدخل — ${range.label}`, ['البند', 'المبلغ (ر.س)'], rows, {
      meta: [`${org.company.name || ''} · الرقم الضريبي: ${org.company.taxNumber || '—'}`, `النطاق: ${scopeLabel} · الفترة: ${range.label}`],
      totals: ['صافي الربح بعد الضريبة', +data.netAfterVat.toFixed(2)]
    });
    say('تم تنزيل قائمة الدخل بصيغة Excel');
  };

  const exportVatDeclaration = () => {
    const m = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
    const co = org.company || {};
    // مبيعات خاضعة = الإيراد الإجمالي (شامل الضريبة) → الأساس بدون ضريبة
    const salesBase = data.grossRevenue - data.vatOut;
    const purchBase = sum(data.byCat.filter(x => x.taxable), x => x.v) - data.vatIn;
    const w = window.open('', '_blank', 'width=850,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>إقرار ضريبة القيمة المضافة - ${range.label}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
        body{padding:32px;color:#222}
        .head{text-align:center;border-bottom:3px solid #C8A24A;padding-bottom:16px;margin-bottom:8px}
        .co-n{font-size:19px;font-weight:bold;color:#8C6F2C}
        .co-m{font-size:12px;color:#666;margin-top:4px}
        .title{text-align:center;font-size:17px;font-weight:bold;margin:18px 0 4px}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:22px}
        table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
        th{background:#241F1B;color:#fff;padding:10px;text-align:right}
        td{border:1px solid #ddd;padding:10px 12px}
        td.n{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}
        .sec{background:#F6F2E9;font-weight:bold;color:#8C6F2C}
        .due{background:#C8A24A;color:#1a1410;font-weight:bold;font-size:15px}
        .note{font-size:11px;color:#888;margin-top:20px;line-height:1.7}
        .sign{display:flex;justify-content:space-between;margin-top:44px;gap:40px}
        .sign div{flex:1;text-align:center;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="head">
        <div class="co-n">${co.name || 'المنشأة'}</div>
        <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div>
      </div>
      <div class="title">إقرار ضريبة القيمة المضافة</div>
      <div class="sub">الفترة الضريبية: ${range.label} · ${scopeLabel}</div>

      <table>
        <thead><tr><th style="width:60%">البيان</th><th class="n">الأساس (ر.س)</th><th class="n">الضريبة (ر.س)</th></tr></thead>
        <tbody>
          <tr class="sec"><td colspan="3">المبيعات (ضريبة المخرجات)</td></tr>
          <tr><td>المبيعات الخاضعة للنسبة الأساسية 15%</td><td class="n">${m(salesBase)}</td><td class="n">${m(data.vatOut)}</td></tr>
          <tr><td><b>إجمالي ضريبة المخرجات</b></td><td class="n"></td><td class="n"><b>${m(data.vatOut)}</b></td></tr>

          <tr class="sec"><td colspan="3">المشتريات (ضريبة المدخلات)</td></tr>
          <tr><td>المشتريات الخاضعة القابلة للخصم</td><td class="n">${m(purchBase)}</td><td class="n">${m(data.vatIn)}</td></tr>
          <tr><td><b>إجمالي ضريبة المدخلات القابلة للخصم</b></td><td class="n"></td><td class="n"><b>${m(data.vatIn)}</b></td></tr>

          <tr class="due"><td>صافي الضريبة المستحقة للهيئة</td><td class="n"></td><td class="n">${m(data.vatDue)}</td></tr>
        </tbody>
      </table>

      <div class="note">
        • هذا الإقرار استرشادي أُنشئ آلياً من بيانات المنصة، ولا يُغني عن الإقرار الرسمي المعتمد من محاسب قانوني عبر بوابة هيئة الزكاة والضريبة والجمارك.<br>
        • النسبة المطبّقة 15% وفق الطريقة الحسابية 15/115 على المبالغ الشاملة للضريبة.<br>
        • تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}
      </div>
      <div class="sign"><div>المحاسب</div><div>المدير المالي</div><div>اعتماد الإدارة</div></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const L = ({ k, v, c, bold, ind, sub }) => (
    <div className="row" style={{
      justifyContent: 'space-between', padding: '9px 0',
      borderBottom: '1px solid rgba(51,44,38,.45)', paddingInlineStart: ind ? 18 : 0,
      background: sub ? 'rgba(200,162,74,.05)' : 'transparent'
    }}>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 600 : 400, color: ind ? 'var(--dim)' : 'var(--txt)' }}>{k}</span>
      <span className="num" style={{ fontSize: bold ? 14 : 12.5, fontWeight: bold ? 700 : 500, color: c }}>{money(v)}</span>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className={'btn sm' + (period === 'daily' ? ' pri' : ' gh')} onClick={() => setPeriod('daily')}>يومي</button>
          <button className={'btn sm' + (period === 'monthly' ? ' pri' : ' gh')} onClick={() => setPeriod('monthly')}>شهري</button>
          <button className={'btn sm' + (period === 'yearly' ? ' pri' : ' gh')} onClick={() => setPeriod('yearly')}>سنوي</button>
        </div>
        <div className="row">
          {period === 'daily' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">اليوم</label>
            <input type="date" className="inp" value={day} onChange={e => setDay(e.target.value)} /></div>}
          {period === 'monthly' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الشهر</label>
            <input type="month" className="inp" value={month} onChange={e => setMonth(e.target.value)} /></div>}
          {period === 'yearly' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">السنة</label>
            <select className="sel" value={year} onChange={e => setYear(e.target.value)}>
              {[0, 1, 2, 3].map(i => { const y = String(Number(today().slice(0, 4)) - i); return <option key={y} value={y}>{y}</option>; })}
            </select></div>}
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الفرع</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">كل الفروع</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn pri" onClick={doPrint}><FileText size={14} />طباعة قائمة الدخل (PDF)</button>
          <button className="btn" onClick={exportCsv}><Download size={14} />تصدير CSV</button>
          <button className="btn ok" onClick={exportXlsx}><FileBarChart size={14} />تصدير Excel</button>
          <button className="btn" onClick={exportVatDeclaration}><Receipt size={14} />إقرار ض.ق.م</button>
        </div>
      </div>

      <div className="grid g3">
        <Kpi label="صافي الإيراد" value={money(data.netRevenue)} sub={`${data.n} إغلاق`} icon={TrendingUp} color="#C8A24A" />
        <Kpi label="إجمالي التكاليف" value={money(data.totalCost)} icon={TrendingDown} color="#D9544D" />
        <Kpi label="صافي الربح بعد الضريبة" value={money(data.netAfterVat)} icon={Wallet} color={data.netAfterVat >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />قائمة الدخل {range.type} — {range.label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 10 }}>{scopeLabel}</div>
        <L k="المبيعات النقدية" v={data.R.cash} c="var(--brass)" ind />
        <L k="مبيعات الشبكة (مدى/POS)" v={data.R.card} c="var(--brass)" ind />
        <L k="تحويل بنكي مباشر" v={data.R.bank} c="var(--brass)" ind />
        <L k="مبيعات تطبيقات التوصيل" v={data.R.del} c="var(--brass)" ind />
        <L k="إجمالي الإيرادات" v={data.grossRevenue} bold sub />
        <L k="عمولات منصات التوصيل" v={-data.commissions} c="var(--rose)" ind />
        <L k="صافي الإيرادات" v={data.netRevenue} c="var(--brass)" bold sub />
        {data.byCat.map(x => <L key={x.id} k={x.n} v={-x.v} c="var(--rose)" ind />)}
        <L k="الالتزامات الثابتة" v={-data.fixedTotal} c="var(--rose)" ind />
        <L k="الرواتب غير المصروفة بالفروع" v={-data.payrollRemaining} c="var(--rose)" ind />
        <L k="إجمالي التكاليف" v={-data.totalCost} c="var(--rose)" bold sub />
        <L k="الربح التشغيلي" v={data.operatingProfit} c={data.operatingProfit >= 0 ? 'var(--mint)' : 'var(--rose)'} bold />
        <L k="ضريبة القيمة المضافة المستحقة" v={-data.vatDue} c="var(--amber)" ind />
        <div style={{ marginTop: 8, padding: '14px 16px', background: data.netAfterVat >= 0 ? 'rgba(79,178,134,.12)' : 'rgba(217,84,77,.12)', borderRadius: 12, border: '1px solid ' + (data.netAfterVat >= 0 ? 'rgba(79,178,134,.4)' : 'rgba(217,84,77,.4)') }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>صافي الربح بعد الضريبة</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 700, color: data.netAfterVat >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(data.netAfterVat)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--ink)' }}>
        <div className="card-t" style={{ marginBottom: 10, fontSize: 12.5 }}>مؤشرات ضريبية ورقابية</div>
        <L k="ض.ق.م على المبيعات (مُخرجة)" v={data.vatOut} />
        <L k="ض.ق.م على المشتريات (مُدخلة)" v={data.vatIn} />
        <L k="صافي الضريبة المستحقة للهيئة" v={data.vatDue} c="var(--amber)" bold />
        <L k="إجمالي فروقات الصندوق للفترة" v={data.cashVariance} c={data.cashVariance < 0 ? 'var(--rose)' : 'var(--faint)'} />
      </div>
    </div>
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
