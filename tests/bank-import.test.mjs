/**
 * المرحلة H (v56.59) — اختبارات تكامل كشوف البنوك (بيانات اصطناعية، بلا أي اتصال خارجي):
 * الصيغ المدعومة في الكود: MT940 (parseMt940)، CSV بفواصل مختلفة (parseCsvGrid)، Excel (parseXlsxGrid — يُبنى ملف xlsx هنا بـ makeXlsx)،
 * اكتشاف الأعمدة بالعربية والإنجليزية (detectStmtMap)، الأرقام والتواريخ (stNum / stDate)، ومطابقة الشبكة ورسومها (cardStmtLines / cardRecon / cardSettlePlan).
 * كل الأرقام وأرقام الأجهزة والحسابات وهمية.
 *
 * ملاحظة: «المطابقة الشاملة» لكشف البنك مقابل القيود (stRun/stLines/stFull في mods/acct/Accounting.jsx:723-814) مكتوبة داخل مكوّن الواجهة،
 * فلا تُختبر هنا آليًا — مرفوعة في docs/testing/PHASE_H_REPORT.md (فجوة BANK-H-07).
 * الاختبارات الموسومة todo توثّق أخطاء مكتشفة لم تُصلح بعد (BANK-H-xx) — تُشغَّل ولا تُسقط المجموعة، وتصبح عادية عند الإصلاح.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

/* ===== MT940 ===== */
const MT = [
  ':20:STMT-SYN-01', ':25:SA0000000000000000000001', ':28C:00001/001', ':60F:C261031SAR10000,00',
  ':61:2611011101C2000,00NTRFNONREF//1552164702164274', ':86:نقاط بيع - دائنة التاجر مدى',
  ':61:2611011101D18,40NCHGNONREF//1552164702164274', ':86:نقاط بيع - مدين التاجر عمولة مدى',
  ':61:2611021102D5000,00NTRFRENT//X1', ':86:تحويل ايجار', 'فرع تجريبي - نوفمبر',
  ':61:2611031103RD25,00NCHG//X2', ':86:عكس رسوم خدمة',
  ':61:2611041104RC100,00NTRF//X3', ':86:Reversal of incoming transfer',
  ':61:2611051105C1234,5NTRF//X4', ':86:Incoming transfer customer',
  ':62F:C261130SAR8141,10', '-}'].join('\r\n');

test('MT940: الإشارات (C/D/RC/RD)، تاريخ القيد الاختياري، الفاصلة العشرية، البيان متعدد الأسطر، والحساب والرصيدان — الافتتاحي + الحركات = الختامي', () => {
  const r = E.parseMt940(MT);
  assert.equal(r.account, 'SA0000000000000000000001');
  assert.deepEqual(r.lines.map(l => [l.date, l.amount]), [['2026-11-01', 2000], ['2026-11-01', -18.4], ['2026-11-02', -5000], ['2026-11-03', 25], ['2026-11-04', -100], ['2026-11-05', 1234.5]]);
  assert.equal(r.lines[2].desc, 'تحويل ايجار فرع تجريبي - نوفمبر', 'البيان :86: متعدد الأسطر يُضم');
  assert.equal(r.lines[0].ref, 'NONREF//1552164702164274');
  assert.deepEqual([r.open, r.close], [{ date: '2026-10-31', cur: 'SAR', amount: 10000 }, { date: '2026-11-30', cur: 'SAR', amount: 8141.1 }]);
  const tot = Math.round((r.open.amount + r.lines.reduce((a, l) => a + l.amount, 0)) * 100) / 100;
  assert.equal(tot, r.close.amount, 'الافتتاحي + الحركات = الختامي');
  // نهاية سطر LF فقط، ورصيد مرحلي :60M:/:62M:، وسنة بخانتين ≥ 80 ⇒ 19xx، ورصيد افتتاحي مدين
  const r2 = E.parseMt940([':25:ACC-2', ':60M:D991231SAR50,00', ':61:991231D10,00NMSC//Y', ':86:fee', ':62M:D991231SAR60,00'].join('\n'));
  assert.deepEqual([r2.open.amount, r2.close.amount, r2.lines[0].date, r2.lines[0].amount], [-50, -60, '1999-12-31', -10]);
});

test('MT940: ما ليس MT940 أو بلا حركات ⇒ null (فيُقرأ CSV)، وسطر :61: غير مفهوم يُتجاوز دون كسر الباقي', () => {
  assert.equal(E.parseMt940(''), null); assert.equal(E.parseMt940(null), null);
  assert.equal(E.parseMt940('Date,Amount\n2026-01-01,5'), null);
  assert.equal(E.parseMt940(':20:X\n:60F:C261031SAR0,00\n:62F:C261130SAR0,00'), null, 'لا :61:');
  const r = E.parseMt940(':60F:C261031SAR0,00\n:61:BAD-LINE\n:61:2611011101C5,00NTRF//Z\n:86:ok\n:62F:C261130SAR5,00');
  assert.deepEqual(r.lines.map(l => [l.date, l.amount, l.desc]), [['2026-11-01', 5, 'ok']]);
});

/* ===== CSV ===== */
test('CSV: الفاصلة، والفاصلة المنقوطة، وTab، وBOM، والاقتباس بفواصل وعلامات مزدوجة، وCRLF، وتجاهل الأسطر الفارغة', () => {
  assert.deepEqual(E.parseCsvGrid('\uFEFFالتاريخ,البيان,دائن\r\n2026-11-01,"إيداع, فرع 1",1500\r\n\r\n2026-11-02,"قال ""مرحبا""",20\n'),
    [['التاريخ', 'البيان', 'دائن'], ['2026-11-01', 'إيداع, فرع 1', '1500'], ['2026-11-02', 'قال "مرحبا"', '20']]);
  assert.deepEqual(E.parseCsvGrid('Date;Amount;Desc\n05/11/2026;1.234,50;x'), [['Date', 'Amount', 'Desc'], ['05/11/2026', '1.234,50', 'x']], 'المنقوطة تُكتشف من السطر الأول');
  assert.deepEqual(E.parseCsvGrid('Date\tAmount\n2026-11-01\t-250'), [['Date', 'Amount'], ['2026-11-01', '-250']]);
  assert.deepEqual(E.parseCsvGrid('a,b\n"x\ny",2'), [['a', 'b'], ['x\ny', '2']], 'سطر جديد داخل خلية مقتبسة');
});

/* ===== الأعمدة ===== */
test('اكتشاف الأعمدة: عناوين عربية وإنجليزية، مدين/دائن منفصلان أو مبلغ بإشارة، وصف العنوان بعد أسطر عنوان الكشف، وما لا يُعرف ⇒ null', () => {
  const m = (h, pre = []) => E.detectStmtMap([...pre, h, ['x']]);
  assert.deepEqual(m(['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد']), { date: 0, credit: 3, debit: 2, amount: -1, desc: 1, start: 1 });
  assert.deepEqual(m(['تاريخ العملية', 'تفاصيل', 'سحب', 'إيداع']), { date: 0, credit: 3, debit: 2, amount: -1, desc: 1, start: 1 });
  assert.deepEqual(m(['Transaction Date', 'Description', 'Debit', 'Credit', 'Balance']), { date: 0, credit: 3, debit: 2, amount: -1, desc: 1, start: 1 });
  assert.deepEqual(m(['Date', 'Details', 'Withdrawals', 'Deposits']), { date: 0, credit: 3, debit: 2, amount: -1, desc: 1, start: 1 });
  assert.deepEqual(m(['Posting Date', 'Narration', 'Amount (SAR)']), { date: 0, credit: -1, debit: -1, amount: 2, desc: 1, start: 1 }, 'مبلغ واحد بإشارة');
  assert.equal(m(['التاريخ', 'البيان', 'المبلغ'], [['كشف حساب تجريبي'], ['الفترة: نوفمبر'], []]).start, 4, 'العنوان في السطر الرابع ⇒ البيانات من الخامس');
  assert.equal(m(['Date', 'Description']), null, 'لا عمود مبالغ');
  assert.equal(E.detectStmtMap([...Array.from({ length: 12 }, () => ['عنوان']), ['التاريخ', 'المبلغ']]), null, 'يُبحث في أول 12 سطرًا فقط');
});

/* ===== الأرقام والتواريخ ===== */
test('الأرقام: فواصل الآلاف، الأرقام العربية الهندية وفاصل الآلاف العربي، الأقواس والسالب اللاحق، رموز العملة، والفارغ صفر', () => {
  const cases = [['1,234.50', 1234.5], ['(1,000.00)', -1000], ['1500-', -1500], ['-250', -250], ['SAR 1,500.00', 1500], ['1,500.00 ر.س', 1500], ['SR 75', 75],
    ['٥٠٠', 500], ['١٬٢٣٤', 1234], [' 12 ', 12], ['', 0], [null, 0], ['-', 0], ['abc', 0], [42, 42]];
  for (const [v, x] of cases) assert.equal(E.stNum(v), x, JSON.stringify(v));
});

test('التواريخ: ISO، يوم/شهر/سنة (السائد في الكشوف السعودية)، الأرقام العربية، رقم إكسل التسلسلي، والتاريخ مع الوقت؛ وغير المدعوم ⇒ فارغ فيُتجاوز السطر', () => {
  const cases = [['2026-11-05', '2026-11-05'], ['2026/11/5', '2026-11-05'], ['05/11/2026', '2026-11-05'], ['5-11-2026', '2026-11-05'], ['٠٥/١١/٢٠٢٦', '2026-11-05'],
    ['2026-11-05T10:20:00', '2026-11-05'], ['05/11/2026 10:20', '2026-11-05'], [46331, '2026-11-05'], ['46331', '2026-11-05'],
    ['05-Nov-2026', ''], ['05.11.2026', ''], ['5/11/26', ''], ['', ''], [null, '']];
  for (const [v, x] of cases) assert.equal(E.stDate(v), x, JSON.stringify(v));
  assert.equal(E.stAddDays('2026-11-28', 5), '2026-12-03'); assert.equal(E.stAddDays('2026-03-01', -1), '2026-02-28');
});

/* ===== Excel ===== */
test('Excel: كشف xlsx بعناوين عربية يُقرأ ويكتشف أعمدته، والأرقام والتواريخ النصية تُفهم', async () => {
  const rows = [['كشف حساب تجريبي'], ['التاريخ', 'البيان', 'مدين', 'دائن'], ['2026-11-01', 'إيداع نقدي', '', '1,500.00'], ['2026-11-02', 'رسوم خدمات بنكية', '25', '']];
  const buf = await E.makeXlsx([{ name: 'كشف', rows }]);
  const ab = buf instanceof ArrayBuffer ? buf : (buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : await new Response(buf).arrayBuffer());
  const grid = await E.parseXlsxGrid(ab);
  const map = E.detectStmtMap(grid); assert.ok(map, 'الأعمدة تُكتشف');
  assert.deepEqual([map.date, map.desc, map.debit, map.credit, map.start], [0, 1, 2, 3, 2]);
  const got = grid.slice(map.start).map(g => [E.stDate(g[map.date]), E.stNum(g[map.credit]) - E.stNum(g[map.debit])]);
  assert.deepEqual(got, [['2026-11-01', 1500], ['2026-11-02', -25]]);
});

/* ===== الشبكة: مدى/فيزا/ماستر ورسومها ===== */
const ENG = [['Bank statement — synthetic'], ['Posting Date', 'Time', 'Description', 'Terminal', 'Card', 'Amount (SAR)', 'Balance'],
  ['05/11/2026', '01:10:00', 'POS merchant settlement', '1234567890124274', 'MADA', '2,000.00', ''],
  ['05/11/2026', '01:10:00', 'POS merchant fee commission', '1234567890124274', 'MADA', '(18.40)', ''],
  ['05/11/2026', '23:00:00', 'Merchant sales VISA', '1234567890124274', 'VISA', '971.25', ''],
  ['05/11/2026', '09:00:00', 'Salary transfer WPS', '', '', '-5,000.00', ''],
  ['06/11/2026', '01:00:00', 'POS merchant settlement', '1234567890128888', 'mada', '500', ''],
  ['06/11/2026', '01:00:00', 'POS merchant settlement', '1234567890128888', 'mada', '500', '']];
const ORG = { branches: [{ id: 'b1', name: 'فرع أ' }, { id: 'b2', name: 'فرع ب' }], taxCfg: { enabled: true, rate: 15 }, cardTerminals: [{ tid: '4274', branchId: 'b1' }, { tid: '8888', branchId: 'b2' }],
  profitCfg: { cardRates: { mada: 0.8, visa: 2.5 } } };
const OPS = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-04', status: 'approved', cardSales: 3000, totalRevenue: 3000 }, { id: 'c2', branchId: 'b2', date: '2026-11-05', status: 'approved', cardSales: 500, totalRevenue: 500 }] };

test('الشبكة (كشف إنجليزي بمبلغ واحد بإشارة وأقواس): التسوية والعمولة بأنواعها، الجهاز من رقمه الطويل، والوقت؛ وراتب WPS لا يدخل', () => {
  const map = E.detectStmtMap(ENG); assert.deepEqual([map.date, map.amount, map.desc, map.start], [0, 5, 2, 2]);
  const L = E.cardStmtLines(ENG, map);
  assert.deepEqual(L.map(l => [l.date, l.kind, l.type, l.tid, l.credit, l.debit, l.time]), [
    ['2026-11-05', 'settle', 'mada', '4274', 2000, 0, '01:10:00'], ['2026-11-05', 'fee', 'mada', '4274', 0, 18.4, '01:10:00'], ['2026-11-05', 'settle', 'visa', '4274', 971.25, 0, '23:00:00'],
    ['2026-11-06', 'settle', 'mada', '8888', 500, 0, '01:00:00'], ['2026-11-06', 'settle', 'mada', '8888', 500, 0, '01:00:00']]);
});

test('الشبكة: الإجمالي = مدى + فيزا ÷ (1 − 2.5% × 1.15) بفارق يوم، وعمولة مدى الفعلية 0.92% = العقد 0.8% شاملة الضريبة؛ والسطر المكرر في الكشف يظهر فرقًا لا يُطابَق صامتًا', () => {
  const L = E.cardStmtLines(ENG, E.detectStmtMap(ENG));
  const M = E.cardRecon(ORG, OPS, L, { from: '2026-11-04', to: '2026-11-05' });
  const b1 = M.branches.find(b => b.id === 'b1'), b2 = M.branches.find(b => b.id === 'b2');
  assert.deepEqual([b1.lag, b1.exp, b1.bank, b1.diff, b1.ok], [1, 3000, 3000, 0, true], '2000 + 971.25 ÷ 0.97125 = 3000');
  assert.deepEqual([b1.mada.gross, b1.mada.fee, b1.mada.eff, b1.mada.expEff, b1.vm.gross, b1.vm.fee], [2000, 18.4, 0.92, 0.92, 1000, 28.75]);
  // فرع ب: إغلاق 500 وإيداعان متطابقان 500 + 500 في اليوم التالي — لا اختيار تلقائي «لإخفاء» المكرر: يبقى فرق 500 وغير متطابق
  assert.equal(b2.ok, false); assert.equal(Math.abs(b2.diff), 500);
  assert.deepEqual([M.tot.madaFee, M.tot.vmFee, M.tot.feeVat], [18.4, 28.75, 6.15], 'ضريبة الرسوم = (18.40 + 28.75) × 15 ÷ 115');
});

test('تسوية الوسيط من الكشف: العمولة بلا ضريبة + ضريبة المدخلات ⇐ البنك؛ بلا ضريبة مفعّلة تُقيَّد العمولة كاملة؛ الفترة المقفلة واليوم بلا إغلاق لا يُرحَّلان', () => {
  const L = E.cardStmtLines(ENG, E.detectStmtMap(ENG));
  const P = E.cardSettlePlan(ORG, OPS, L, { lags: { b1: 1, b2: 1 } });
  assert.deepEqual(P.rows.map(r => [r.ref, r.status, r.gross, r.net, r.fee, r.feeEx, r.vat]), [['crs|b1|2026-11-05', 'ready', 3000, 2952.85, 47.15, 41, 6.15]]);
  assert.deepEqual(P.rows[0].lines, [{ code: '5303', debit: 41, credit: 0 }, { code: '1501', debit: 6.15, credit: 0 }, { code: '1201', debit: 0, credit: 47.15 }]);
  const noVat = E.cardSettlePlan({ ...ORG, taxCfg: { enabled: false } }, OPS, L, { lags: { b1: 1 } }).rows[0];
  assert.deepEqual(noVat.lines, [{ code: '5303', debit: 47.15, credit: 0 }, { code: '1201', debit: 0, credit: 47.15 }]);
  const locked = E.cardSettlePlan({ ...ORG, periodLocks: { lockedThrough: '2026-11' } }, OPS, L, { lags: { b1: 1 } }).rows[0];
  assert.equal(locked.status, 'locked');
  const noClose = E.cardSettlePlan(ORG, { closings: [] }, L, { lags: { b1: 1 } }).rows[0];
  assert.equal(noClose.status, 'noclose');
  // مع الوسيط: البنك يستلم الصافي والوسيط يُقفل بالإجمالي، والقيد متوازن بالهللة
  const clr = E.cardSettlePlan({ ...ORG, posClearing: { enabled: true, from: '2026-11' } }, OPS, L, { lags: { b1: 1 } }).rows[0];
  const dr = clr.lines.reduce((a, l) => a + l.debit, 0), cr = clr.lines.reduce((a, l) => a + l.credit, 0);
  assert.equal(Math.round(dr * 100), Math.round(cr * 100)); assert.equal(cr, 3000);
});

test('MT940 ⇐ جدول الواجهة نفسه ⇐ أسطر الشبكة: حركة مدى وعمولتها من :86: ورقم الجهاز من المرجع', () => {
  const mt = E.parseMt940(MT);
  // التحويل نفسه في mods/acct/CardRecon.jsx:19 وmods/acct/Accounting.jsx:707
  const grid = [['التاريخ', 'البيان', 'مدين', 'دائن', 'المرجع'], ...mt.lines.map(l => [l.date, l.desc, l.amount < 0 ? -l.amount : '', l.amount > 0 ? l.amount : '', l.ref])];
  const L = E.cardStmtLines(grid, E.detectStmtMap(grid));
  assert.deepEqual(L.map(l => [l.kind, l.type, l.tid, l.credit, l.debit]), [['settle', 'mada', '4274', 2000, 0], ['fee', 'mada', '4274', 0, 18.4]], 'الإيجار والتحويلات لا تدخل');
});

/* ===== أخطاء مكتشفة في المرحلة H — لم تُصلح بعد (تُشغَّل كـ todo) ===== */
test('BANK-H-01: فاصل الكسور العربي «٫» يُقرأ كسرًا لا يُحذف (١٬٢٣٤٫٥٠ = 1234.50)', { todo: 'خطأ مفتوح — App.jsx:977 stNum يحذف ما بعد ٫ فيُقرأ 1234' }, () => {
  assert.equal(E.stNum('١٬٢٣٤٫٥٠'), 1234.5);
});
test('BANK-H-02: علامة الطرح الطباعية «−» (U+2212) سالبة لا صفر', { todo: 'خطأ مفتوح — App.jsx:972 stNum يعيد 0 فيُسقط السطر صامتًا' }, () => {
  assert.equal(E.stNum('−250.00'), -250);
});
test('BANK-H-03: لاحقة DR/CR في عمود المبلغ الواحد تحدد الإشارة', { todo: 'خطأ مفتوح — App.jsx:972 stNum يتجاهل DR فيُقرأ السحب إيداعًا' }, () => {
  assert.equal(E.stNum('1,500.00 DR'), -1500); assert.equal(E.stNum('1,500.00 CR'), 1500);
});
test('BANK-H-04: تاريخ بشهر أو يوم مستحيل يُرفض لا يُقبل نصًا (11/25/2026 الأمريكي، 2026-13-40، الهجري 1447/05/14)', { todo: 'خطأ مفتوح — App.jsx:1010 stDate لا يتحقق من الشهر واليوم؛ والهجري يحتاج قرار المالك' }, () => {
  assert.equal(E.stDate('11/25/2026'), ''); assert.equal(E.stDate('2026-13-40'), ''); assert.equal(E.stDate('1447/05/14'), '');
});
test('BANK-H-05: سطر عنوان قبل رأس CSV لا يحدد الفاصل خطأً', { todo: 'خطأ مفتوح — App.jsx:1024 parseCsvGrid يحدد الفاصل من السطر الأول وحده' }, () => {
  assert.deepEqual(E.parseCsvGrid('كشف حساب, نوفمبر\nالتاريخ;المبلغ\n2026-01-01;5').slice(1), [['التاريخ', 'المبلغ'], ['2026-01-01', '5']]);
});
test('BANK-H-06: عنوان «Narrative» يُعرف عمود بيان، و«Last Updated» لا يُحسب عمود تاريخ', { todo: 'خطأ مفتوح — App.jsx:1131 detectStmtMap بالمطابقة الجزئية' }, () => {
  const m = E.detectStmtMap([['Last Updated', 'Date', 'Narrative', 'Credit'], ['x']]);
  assert.deepEqual([m.date, m.desc], [1, 2]);
});
