import fs from 'node:fs';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { buildEngine } from '/home/claude/daily/tests/build-engine.mjs';
const E = await buildEngine();
const logo = 'data:image/png;base64,' + fs.readFileSync('/home/claude/daily/public/mithqal-192.png').toString('base64');
const org = { company: { name: 'مطاعم الطائف الأولى', taxNumber: '300123456700003', address: 'الطائف — حي النسيم', logoUrl: logo } };
const meta = { user: 'مجاهد', source: 'مِثقال v50.0', at: '2026-11-19T10:30:00Z' };
const S = [
  { id: 'list', template: 'list', title: 'سجل فواتير الموردين', sub: 'من 2026-11-01 إلى 2026-11-30', meta, filters: [['الفرع', 'كل الفروع'], ['الحالة', 'الكل']],
    columns: [{ key: 'd', label: 'التاريخ', type: 'date' }, { key: 'no', label: 'رقم الفاتورة' }, { key: 's', label: 'المورد' }, { key: 'net', label: 'الصافي', type: 'money', total: 'sum' }, { key: 'vat', label: 'الضريبة', type: 'money', total: 'sum' }, { key: 't', label: 'الإجمالي', type: 'money', total: 'sum' }],
    rows: Array.from({ length: 46 }, (_, i) => { const n = 400 + (i * 137) % 2600; return { d: '2026-11-' + String(1 + (i % 28)).padStart(2, '0'), no: 'INV-' + (1040 + i), s: ['مؤسسة اللحوم الطازجة', 'شركة الخضار', 'مخبز الأمل', 'مياه نقية'][i % 4], net: n, vat: Math.round(n * 15) / 100, t: Math.round(n * 115) / 100 }; }) },
  { id: 'statement', template: 'statement', title: 'قائمة الدخل', sub: 'للفترة من 2026-10-01 إلى 2026-10-31', meta,
    columns: [{ key: 'n', label: 'البند' }, { key: 'cur', label: 'الفترة الحالية', type: 'money', total: 'sum' }, { key: 'prev', label: 'الفترة السابقة', type: 'money', total: 'sum' }],
    groups: [{ label: 'الإيرادات', rows: [{ n: 'مبيعات الصالة', cur: 182400, prev: 171200 }, { n: 'مبيعات التوصيل', cur: 64300, prev: 58900 }] },
      { label: 'تكلفة المبيعات', rows: [{ n: 'تكلفة المواد', cur: -79800, prev: -75100 }, { n: 'الهدر', cur: -2100, prev: -2650 }] },
      { label: 'المصروفات التشغيلية', rows: [{ n: 'الرواتب', cur: -61000, prev: -60500 }, { n: 'الإيجار', cur: -18000, prev: -18000 }, { n: 'الكهرباء والماء', cur: -7200, prev: -6900 }] }],
    totalLabel: 'صافي الربح', notes: ['المبالغ بين قوسين تُطرح.'] },
  { id: 'ledger', template: 'ledger', title: 'دفتر الأستاذ — 1101 الخزينة الرئيسية', sub: 'من 2026-11-01 إلى 2026-11-30', meta, filters: [['الفرع', 'كل الفروع والمركز']],
    kpis: [{ label: 'رصيد أول المدة', value: '25,000.00' }, { label: 'مدين الفترة', value: '84,500.00' }, { label: 'دائن الفترة', value: '71,250.00' }, { label: 'رصيد آخر المدة', value: '38,250.00' }],
    columns: [{ key: 'd', label: 'التاريخ', type: 'date' }, { key: 'no', label: 'القيد' }, { key: 't', label: 'البيان' }, { key: 'dr', label: 'مدين', type: 'money', total: 'sum' }, { key: 'cr', label: 'دائن', type: 'money', total: 'sum' }, { key: 'b', label: 'الرصيد', type: 'money' }],
    rows: (() => { let b = 25000; const r = [{ t: 'رصيد أول المدة', b, _bold: true }]; [['إيداع مبيعات طيبة', 12500, 0], ['سداد مورد اللحوم', 0, 8400], ['إيداع مبيعات النسيم', 9800, 0], ['صرف رواتب', 0, 30500], ['إيداع مبيعات كيلو 14', 11200, 0], ['إيجار الفرع', 0, 18000], ['تمويل من الشريك', 51000, 0], ['مصروفات صيانة', 0, 14350]].forEach(([t, dr, cr], i) => { b += dr - cr; r.push({ d: '2026-11-' + String(3 + i * 3).padStart(2, '0'), no: 'JE-' + (220 + i), t, dr: dr || null, cr: cr || null, b }); }); return r; })() },
  { id: 'summary', template: 'summary', title: 'ملخص مبيعات الفروع', sub: 'نوفمبر 2026', meta, kpis: [{ label: 'صافي المبيعات', value: '246,700.00' }, { label: 'عدد الفواتير', value: '8,412' }, { label: 'متوسط الفاتورة', value: '29.33' }, { label: 'نمو عن الشهر السابق', value: '6.4%' }],
    columns: [{ key: 'b', label: 'الفرع' }, { key: 'n', label: 'الفواتير', type: 'int', total: 'sum' }, { key: 's', label: 'المبيعات', type: 'money', total: 'sum' }, { key: 'p', label: 'الحصة', type: 'pct' }],
    rows: [{ b: 'طيبة', n: 2810, s: 84100, p: 34.1 }, { b: 'النسيم', n: 2390, s: 70200, p: 28.5 }, { b: 'كيلو 14', n: 1820, s: 52300, p: 21.2 }, { b: 'الأجواد', n: 1392, s: 40100, p: 16.3 }] },
  { id: 'document', template: 'document', title: 'سند صرف رقم PV-000214', sub: 'التاريخ 2026-11-18', meta,
    filters: [['المستفيد', 'مؤسسة اللحوم الطازجة'], ['طريقة الدفع', 'تحويل بنكي — الراجحي']],
    columns: [{ key: 'd', label: 'البيان' }, { key: 'a', label: 'المبلغ', type: 'money', total: 'sum' }],
    rows: [{ d: 'سداد فاتورة INV-1043', a: 3450 }, { d: 'سداد فاتورة INV-1051', a: 2875.5 }], notes: ['المبلغ كتابةً: ستة آلاف وثلاثمائة وخمسة وعشرون ريالًا وخمسون هللة فقط.'], signatures: ['المحاسب', 'المدير المالي', 'المستلم'] },
  { id: 'matrix', template: 'matrix', orientation: 'landscape', title: 'المبيعات الشهرية حسب الفرع', sub: 'يناير — يونيو 2026', meta,
    columns: [{ key: 'b', label: 'الفرع' }, ...['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'].map((m, i) => ({ key: 'm' + i, label: m, type: 'money', total: 'sum' })), { key: 't', label: 'الإجمالي', type: 'money', total: 'sum' }],
    rows: ['طيبة', 'النسيم', 'كيلو 14', 'الأجواد'].map((b, k) => { const r = { b }; let t = 0; for (let i = 0; i < 6; i++) { const v = 52000 + k * 9000 + i * 1700 - k * i * 300; r['m' + i] = v; t += v; } r.t = t; return r; }) }];
const out = '/home/claude/g2/out'; fs.mkdirSync(out, { recursive: true });
const br = await chromium.launch(); const pg = await br.newPage();
for (const s of S) { await pg.setContent(E.rptHtml(org, s), { waitUntil: 'load' }); await pg.pdf({ path: out + '/' + s.id + '.pdf', preferCSSPageSize: true, printBackground: true });
  await pg.setViewportSize({ width: s.orientation === 'landscape' ? 1200 : 860, height: 1100 }); await pg.screenshot({ path: out + '/' + s.id + '.png', fullPage: false }); }
// Excel للقائمة المالية (بصيغ)
fs.writeFileSync(out + '/statement.xlsx', Buffer.from(await E.makeRptXlsx(org, S[1]).arrayBuffer()));
await br.close(); console.log('ok');
