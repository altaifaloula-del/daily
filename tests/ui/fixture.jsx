/**
 * مُركِّب شاشات المنصّة لاختبارات الواجهة (يُجمَّع بـ esbuild ويُفتح في Chromium).
 *   #<route>        — عرض ثابت لكل مركز/قسم/تطبيق (فحص الانهيار والتجاوز والأرقام)
 *   #live/<comp>/<who>/<view> — عرض حيّ بحالة قابلة للتغيير: window.cur (البيانات) · window.as(who) · window.lastSay
 */
import React from 'react'; import { createRoot } from 'react-dom/client';
import * as M from '../.cache/AppUI.jsx'; import { CSS } from '../../styles.js';
const iso = (d) => d.toISOString().slice(0, 10); const dA = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return iso(x); };
const m = iso(new Date()).slice(0, 7);
const B = [{ id: 'b1', name: 'عم قاسم طيبة', isActive: true, defaultFloat: 300, shiftEndTime: '23:30' }, { id: 'b2', name: 'عم قاسم النسيم', isActive: true, defaultFloat: 300 }, { id: 'b3', name: 'العليا', isActive: true }];
const org = { ...M.emptyOrg({ name: 'شركة الطيف الأولى التجارية', taxNumber: '300000000000003' }), branches: B, taxCfg: { enabled: true, rate: 15 },
  employees: [{ id: 'e1', name: 'أحمد علي', branchId: 'b1', jobTitle: 'كاشير', baseSalary: 3000, housingAllowance: 750, transportAllowance: 300, hireDate: '2024-03-01', nationality: 'سعودي', iban: 'SA0380000000608010167519', idNumber: '1010101010', status: 'active' },
    { id: 'e2', name: 'سالم محمد الحربي', branchId: 'b2', jobTitle: 'طباخ رئيسي', baseSalary: 4000, housingAllowance: 1000, transportAllowance: 400, hireDate: '2023-01-15', nationality: 'مصري', status: 'active' },
    { id: 'e3', name: 'خالد عمر', branchId: 'b3', jobTitle: 'مدير فرع', baseSalary: 6500, housingAllowance: 1500, transportAllowance: 500, hireDate: '2022-06-10', status: 'active' }],
  partners: [{ id: 's1', name: 'مؤسسة اللحوم الطازجة للتجارة', type: 'supplier', vatNo: '300111222300003', phone: '0500000000' }, { id: 's2', name: 'شركة الخضار', type: 'supplier' }, { id: 'c1', name: 'شركة التموين المتحدة', type: 'customer' }],
  suppliers: [{ id: 's1', name: 'مؤسسة اللحوم الطازجة للتجارة' }, { id: 's2', name: 'شركة الخضار' }],
  products: [{ id: 'p1', name: 'برجر لحم دبل', sellPrice: 23, cat: 'وجبات', parts: [] }, { id: 'p2', name: 'بطاطس', sellPrice: 8, cat: 'وجبات', parts: [] }, { id: 'p3', name: 'عصير برتقال طازج', sellPrice: 12, cat: 'مشروبات', parts: [] }],
  users: [{ id: 'u1', name: 'مجاهد', email: 'own@x.sa', role: 'system_admin' }, { id: 'u2', name: 'أحمد علي', email: 'c@x.sa', role: 'cashier', branchId: 'b1' }] };
const cl = (id, b, k, rev, v, st) => ({ id, branchId: b, branchName: B.find(x => x.id === b).name, date: dA(k), status: st || 'approved', totalRevenue: rev, cashSales: rev * .6, networkSales: rev * .3, deliverySales: [{ appId: 'jahez', amount: rev * .1 }], expenses: [{ id: 'x' + id, categoryId: 'c1', categoryName: 'مشتريات خضار', amount: 120, isTaxable: true, paymentMethod: 'cash' }], totalExpenses: 120, variance: v, actualCashCount: 1000, expectedCashInSafe: 1000 - v, createdBy: 'أحمد علي', transferredToMainTreasury: 500, supplierPayments: [] });
const ops0 = { ...M.emptyOps(),
  closings: [cl('c1', 'b1', 1, 9420, -70, 'submitted'), cl('c2', 'b2', 1, 8115.5, 0), cl('c3', 'b3', 2, 7324.5, -12), cl('c4', 'b1', 8, 9000, 0), cl('c5', 'b2', 30, 8000, 5)],
  invoices: [{ id: 'v1', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', amount: 4830, taxable: true, date: dA(10), dueDate: dA(3), invoiceNo: 'INV-1021', branchId: 'b1' }, { id: 'v2', supplierId: 's2', supplierName: 'شركة الخضار', amount: 920, date: dA(2), dueDate: dA(-5), invoiceNo: '7781', branchId: 'b2' }],
  advances: [{ id: 'a1', employeeId: 'e1', employeeName: 'أحمد علي', branchId: 'b1', month: m, date: dA(3), type: 'advance', amount: 500, reason: 'سلفة' }],
  posShifts: [{ id: 's1', openedBy: 'أحمد علي', branchId: 'b1', date: dA(1), status: 'closed', diff: -15, total: 2400, n: 96, expected: 500, counted: 485 }],
  attendanceEvents: [{ id: 'ev1', employeeId: 'e1', type: 'in', at: dA(1) + 'T08:00:00' }, { id: 'ev2', employeeId: 'e1', type: 'out', at: dA(1) + 'T18:30:00' }],
  transfers: [{ id: 't1', closingId: 'c2', date: dA(1), branchId: 'b2', branchName: 'عم قاسم النسيم', amount: 500, status: 'pending', referenceNo: 'TR-1' }],
  notifications: [], purchaseOrders: [{ id: 'po1', poNo: 'PO-0001', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', status: 'pending', at: dA(1), lines: [] }] };

// بيانات المخزون والمستودعات للتدفقات الحية (هدر، جرد أعمى، أسعار)
const td = iso(new Date());
org.warehouses = [{ id: 'wh-main', name: 'المستودع الرئيسي', kind: 'main', accCode: '160101', active: true }, { id: 'wh-b1', name: 'مستودع طيبة', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102', active: true }];
org.items = [{ id: 'i1', name: 'لحم غنم', unit: 'كجم', cost: 40, isActive: true }, { id: 'i2', name: 'طماطم', unit: 'كجم', cost: 4, isActive: true }];
org.purchaseCfg = { perpetualFrom: '2020-01' };
org.products = [...org.products, { id: 'p9', name: 'مندي لحم', sellPrice: 60, parts: [{ itemId: 'i1', qty: 0.41, yield: 82 }, { itemId: 'i2', qty: 0.1 }] }];
const ops = { ...ops0,
  whMoves: [{ id: 'o1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'in', qty: 50, unitCost: 40, date: '2026-01-01', at: '2026-01-01T00:00:00' }, { id: 'o2', whId: 'wh-b1', branchId: 'b1', itemId: 'i2', kind: 'in', qty: 100, unitCost: 4, date: '2026-01-01', at: '2026-01-01T00:00:01' }],
  closings: [...ops0.closings, { id: 'ctd', branchId: 'b1', branchName: B[0].name, date: td, status: 'submitted', totalRevenue: 1000, expenses: [] }] };
window.routes = [...Object.entries(M.HUBS).flatMap(([h, c]) => c.views.map(v => 'hub/' + h + '/' + v.id)), ...M.ACCT_SECTIONS.map(s => 'acct/' + s.v),
  ...['Launcher', 'PosApp', 'Inventory', 'Partners', 'SalesHub', 'QrFeedback', 'AppsCenter', 'BranchWarehouse', 'Admin', 'AuditView'].map(c => 'comp/' + c)];
const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
const dark = location.hash.includes('dark');
document.body.innerHTML = '<div class="rms mode-' + (dark ? 'dark' : 'light') + ' thm-mizan"><div class="page"><div class="page-inner" id=r></div></div></div>';
const ME = { admin: { id: 'u1', name: 'مجاهد', role: 'system_admin' }, ho: { id: 'u5', name: 'سارة', role: 'head_office' }, bm: { id: 'u3', name: 'خالد', role: 'branch_manager', branchId: 'b1' },
  bm2: { id: 'u4', name: 'سعد', role: 'branch_manager', branchId: 'b1' }, ctl: { id: 'u9', name: 'ريم', role: 'cost_controller' } };
const [kind, a, b, c] = decodeURIComponent(location.hash.slice(1)).replace('&dark', '').split('/');
const base = { org, myBranches: B, branches: B, commitOrg: async () => true, say: (x) => { window.lastSay = x; }, setTab: () => {}, theme: 'mizan', online: [], pulse: {}, openAcctView: () => {}, openInvView: () => {} };
class EB extends React.Component { constructor(p) { super(p); this.state = { e: null }; } componentDidCatch(e) { window.__crash = String(e && e.message); this.setState({ e }); } render() { return this.state.e ? React.createElement('div', { id: 'crash' }, 'CRASH: ' + this.state.e.message) : this.props.children; } }
function Live() {
  const [o, setO] = React.useState(ops); window.cur = o; const [who, setWho] = React.useState(b || 'admin'); window.as = setWho;
  const commit = async (fn) => { try { const nx = fn(JSON.parse(JSON.stringify(o))); setO(nx); return true; } catch (e) { window.lastErr = e.message; return false; } };
  const P = { ...base, ops: o, scoped: o, me: ME[who], commit, invIntent: c ? { v: c, ts: 1 } : null, acctIntent: null };
  return React.createElement(M[a], { key: who, ...P, ...(a === 'Hub' ? { hubId: c.split(':')[0], view: c.split(':')[1] } : {}) });
}
let el;
if (kind === 'live') el = React.createElement(Live);
else { const P = { ...base, ops, scoped: ops, me: ME.admin, commit: async () => true, acctIntent: kind === 'acct' ? { v: a, ts: 1 } : null, invIntent: null };
  el = kind === 'hub' ? React.createElement(M.Hub, { ...P, hubId: a, view: b }) : kind === 'acct' ? React.createElement(M.Accounting, P) : React.createElement(M[a], P); }
createRoot(document.getElementById('r')).render(React.createElement(EB, null, el));
