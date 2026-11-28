/**
 * v56.61 — إصلاحات كشوف البنوك (BANK-H-04/05/06/07/08) وسرعة كشوف الجهات (PERF-H-02) وتاريخ الإغلاق غير النصي في buildAccounting.
 * كل الأرقام والأسماء وأرقام الأجهزة والحسابات وهمية ومولّدة. لا اتصال خارجي.
 * اختبارات التطابق (قديم ⇔ جديد) تحتفظ بالتنفيذ القديم هنا حرفيًا للمقارنة:
 *  - buildPartnersOld: نسخة v56.60 من App.jsx كما هي (قبل الفهرسة).
 *  - stRunOld/stLinesOld/stFullOld/recStmtOld: منطق mods/acct/Accounting.jsx في v56.60 كما هو، مع تمرير متغيرات الشاشة معاملات.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
import { scaleData } from './fixtures/scale-data.mjs';
const E = await buildEngine();
const ms = (f) => { const a = performance.now(); f(); return performance.now() - a; };

/* ===================== BANK-H-01..03: الأرقام ===================== */
test('stNum (v56.61): الكسر العربي «٫» وفاصل الآلاف «٬»، علامات الطرح الطباعية، DR/CR سابقة ولاحقة وبحروف صغيرة، والقديم كما هو', () => {
  const cases = [['١٬٢٣٤٫٥٠', 1234.5], ['٠٫٧٥', 0.75], ['12٫5', 12.5], ['−250.00', -250], ['‒ 40', -40], ['–1,000', -1000], ['—75', -75], ['－5', -5], ['300−', -300],
    ['1,500.00 DR', -1500], ['1,500.00 CR', 1500], ['DR 200', -200], ['CR 200', 200], ['1500dr', -1500], ['Cr. 75', 75], ['75 Dr.', -75], ['SAR 1,200.00 DR', -1200], ['(50.00) DR', -50],
    // لا تغيير على ما كان يعمل
    ['1,234.50', 1234.5], ['(1,000.00)', -1000], ['1500-', -1500], ['-250', -250], ['SR 75', 75], ['١٬٢٣٤', 1234], ['', 0], [null, 0], ['-', 0], ['−', 0], ['DR', 0], ['abc', 0], [42, 42]];
  for (const [v, x] of cases) assert.equal(E.stNum(v), x, JSON.stringify(v));
});

/* ===================== BANK-H-04: التواريخ (قرار المالك: ميلادي فقط) ===================== */
test('stDate (v56.61): التحقق بالتقويم (فبراير والكبيسة و31 أبريل)، الهجري يُرفض، وترتيب شهر/يوم/سنة عند طلبه فقط', () => {
  const cases = [['2026-02-29', ''], ['2028-02-29', '2028-02-29'], ['31/04/2026', ''], ['30/04/2026', '2026-04-30'], ['00/05/2026', ''], ['05/00/2026', ''], ['2026-00-10', ''],
    ['1447/05/14', ''], ['14/05/1447', ''], ['1446-09-01', ''], ['1899-12-31', ''], ['1900-01-01', '1900-01-01'], ['11/25/2026', ''], ['05/11/2026', '2026-11-05']];
  for (const [v, x] of cases) assert.equal(E.stDate(v), x, JSON.stringify(v));
  assert.equal(E.stDate('11/25/2026', 'mdy'), '2026-11-25'); assert.equal(E.stDate('05/11/2026', 'mdy'), '2026-05-11'); assert.equal(E.stDate('25/11/2026', 'mdy'), '');
  assert.equal(E.stDate('2026-11-05', 'mdy'), '2026-11-05', 'ISO لا يتأثر بالترتيب'); assert.equal(E.stDate(46331, 'mdy'), '2026-11-05');
});

test('stDateScan: يوم أكبر من 12 في الخانة الثانية في أي سطر ⇒ شهر/يوم/سنة لكل الملف؛ في الأولى ⇒ يوم/شهر؛ لا حاسم ⇒ الافتراضي مع تنبيه؛ الخلط ⇒ الافتراضي مع تنبيه', () => {
  const H = ['Date', 'Description', 'Amount'], map = E.detectStmtMap([H, ['x']]);
  const mdy = [H, ['11/05/2026', 'a', '10'], ['11/25/2026', 'b', '20'], ['12/01/2026', 'c', '30']];
  const s1 = E.stDateScan(mdy, map);
  assert.deepEqual([s1.order, s1.ambiguous, s1.mixed, s1.bad.length], ['mdy', false, false, 0]);
  assert.deepEqual(E.stLinesOf(mdy, { ...map, order: s1.order }).map(l => l.date), ['2026-11-05', '2026-11-25', '2026-12-01'], 'كل السطور بالترتيب نفسه');
  assert.match(E.stDateNotes(s1).map(n => n.msg).join(' '), /شهر\/يوم\/سنة/);
  const dmy = [H, ['05/11/2026', 'a', '10'], ['25/11/2026', 'b', '20']];
  const s2 = E.stDateScan(dmy, map); assert.deepEqual([s2.order, s2.ambiguous, s2.bad.length, E.stDateNotes(s2).length], ['dmy', false, 0, 0], 'الحاسم يوم/شهر ⇒ بلا تنبيه');
  const amb = [H, ['05/11/2026', 'a', '10'], ['06/11/2026', 'b', '20'], ['07/07/2026', 'c', '5']];
  const s3 = E.stDateScan(amb, map); assert.deepEqual([s3.order, s3.ambiguous], ['dmy', true]);
  const n3 = E.stDateNotes(s3); assert.equal(n3.length, 1); assert.equal(n3[0].kind, 'ambiguous'); assert.match(n3[0].msg, /يوم\/شهر\/سنة/);
  const same = [H, ['07/07/2026', 'a', '10'], ['2026-11-05', 'b', '1']]; assert.equal(E.stDateScan(same, map).ambiguous, false, 'اليوم = الشهر أو ISO ليس غامضًا');
  const mix = [H, ['25/11/2026', 'a', '10'], ['11/25/2026', 'b', '20']];
  const s4 = E.stDateScan(mix, map); assert.deepEqual([s4.order, s4.mixed, s4.bad.map(b => b.row)], ['dmy', true, [3]]);
  assert.deepEqual(E.stDateNotes(s4).map(n => n.kind), ['bad', 'mixed']);
});

test('stDateScan: السطر بتاريخ هجري أو مستحيل يُرفض برقمه ورسالة المالك نصًا، وسطر العنوان أو الإجمالي بلا مبلغ ولا شكل تاريخ لا يُعد خطأ', () => {
  const g = [['كشف حساب تجريبي'], ['التاريخ', 'البيان', 'مدين', 'دائن'], ['2026-11-01', 'إيداع', '', '100'], ['1447/05/14', 'هجري', '', '50'], ['2026-13-40', 'مستحيل', '20', ''],
    ['الإجمالي', '', '20', '150'], ['', 'سطر وصف بلا تاريخ', '', ''], ['ملاحظة', 'نص', '', ''], ['31/02/2026', 'فبراير', '', '']];
  const map = E.detectStmtMap(g); assert.equal(map.start, 2);
  const sc = E.stDateScan(g, map);
  assert.deepEqual(sc.bad, [{ row: 4, value: '1447/05/14' }, { row: 5, value: '2026-13-40' }, { row: 6, value: 'الإجمالي' }, { row: 9, value: '31/02/2026' }]);
  assert.equal(E.ST_DATE_BAD, 'التاريخ غير صالح أو هجري — الكشوف بالتاريخ الميلادي فقط');
  const msg = E.stDateNotes(sc)[0].msg;
  assert.ok(msg.includes('السطر 4 («1447/05/14»)') && msg.includes('السطر 5') && msg.includes(E.ST_DATE_BAD), msg);
  assert.deepEqual(E.stLinesOf(g, map).map(l => [l.date, l.amount]), [['2026-11-01', 100]], 'المرفوض لا يدخل المطابقة');
  const many = [['Date', 'Amount'], ...Array.from({ length: 12 }, (_, i) => ['1447/0' + (1 + (i % 9)) + '/10', '5'])];
  assert.match(E.stDateNotes(E.stDateScan(many, E.detectStmtMap(many)))[0].msg, /و4 سطرًا آخر/);
  assert.deepEqual(E.stDateScan(null, null).bad, []); assert.deepEqual(E.stDateNotes(null), []);
});

/* ===================== BANK-H-05: الفاصل ===================== */
test('csvDelim/parseCsvGrid: الفاصل من عدة أسطر — عنوان بفواصل فوق بيانات بالمنقوطة أو Tab، والفاصلة داخل الاقتباس لا تُعد، والسطر الواحد كما كان', () => {
  assert.equal(E.csvDelim('كشف حساب, نوفمبر, 2026\nالتاريخ;البيان;المبلغ\n2026-11-01;إيداع;1.234,50\n2026-11-02;سحب;-20'), ';');
  assert.equal(E.csvDelim('Statement, synthetic\nDate\tDesc\tAmount\n2026-11-01\ta, b\t5\n2026-11-02\tc\t6'), '\t');
  assert.equal(E.csvDelim('Date;Desc;Amount\n2026-11-01;"a, b, c, d";5\n2026-11-02;"x, y";6'), ';', 'الفواصل داخل الاقتباس لا تُعد');
  assert.equal(E.csvDelim('a;b;c'), ';'); assert.equal(E.csvDelim('a,b;c'), ','); assert.equal(E.csvDelim('a\tb,c'), ','); assert.equal(E.csvDelim(''), ',');
  assert.deepEqual(E.parseCsvGrid('Statement, synthetic\r\nDate\tAmount\r\n2026-11-01\t5\r\n'), [['Statement, synthetic'], ['Date', 'Amount'], ['2026-11-01', '5']]);
});

/* ===================== BANK-H-06: الأعمدة ===================== */
test('detectStmtMap: مطابقة بالكلمة بعد التطبيع — «Last Updated» و«Updated By» ليسا تاريخًا، «Narrative» بيان، الجمع والتعريف العربي يُعرفان', () => {
  const m = (h) => E.detectStmtMap([h, ['x']]);
  assert.deepEqual(m(['Last Updated', 'Value Date', 'Narrative', 'Deposits', 'Withdrawals']), { date: 1, credit: 3, debit: 4, amount: -1, desc: 2, start: 1 });
  assert.deepEqual(m(['تاريخ القيد', 'الوصف', 'المبالغ المدينة', 'الإيداعات']), { date: 0, credit: 3, debit: 2, amount: -1, desc: 1, start: 1 }, '«المدينة» ⇒ مدين و«الإيداعات» ⇒ إيداع بعد نزع التعريف والتاء والجمع');
  assert.equal(m(['Updated By', 'Amount']), null, 'لا عمود تاريخ');
  assert.deepEqual(m(['DATE', 'DEBITS', 'CREDITS', 'DETAILS']), { date: 0, credit: 2, debit: 1, amount: -1, desc: 3, start: 1 });
  assert.deepEqual(m(['Txn_Date', 'Credit Amount']), { date: 0, credit: 1, debit: -1, amount: 1, desc: -1, start: 1 });
  assert.deepEqual(E.stHdrWords('الإيداعات (ر.س)'), ['ايداع', 'ر', 'س']);
});

/* ===================== BANK-H-08: التسوية التلقائية لا تُرحَّل إن تجاوز المُسوّى مبيعات الإغلاق (قرار المالك «يمنع الترحيل حتى تُراجع») ===================== */
const ENG = [['Bank statement — synthetic'], ['Posting Date', 'Time', 'Description', 'Terminal', 'Card', 'Amount (SAR)'],
  ['05/11/2026', '01:10:00', 'POS merchant settlement', '1234567890124274', 'MADA', '2,000.00'],
  ['05/11/2026', '01:10:00', 'POS merchant fee commission', '1234567890124274', 'MADA', '(18.40)'],
  ['05/11/2026', '23:00:00', 'Merchant sales VISA', '1234567890124274', 'VISA', '971.25'],
  ['06/11/2026', '01:00:00', 'POS merchant settlement', '1234567890128888', 'mada', '500'],
  ['06/11/2026', '01:00:00', 'POS merchant settlement', '1234567890128888', 'mada', '500']];
const ORG = { branches: [{ id: 'b1', name: 'فرع أ' }, { id: 'b2', name: 'فرع ب' }], taxCfg: { enabled: true, rate: 15 }, cardTerminals: [{ tid: '4274', branchId: 'b1' }, { tid: '8888', branchId: 'b2' }],
  profitCfg: { cardRates: { mada: 0.8, visa: 2.5 } }, posClearing: { enabled: true, from: '2026-11' } };
const OPS = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-04', status: 'approved', cardSales: 3000, totalRevenue: 3000 }, { id: 'c2', branchId: 'b2', date: '2026-11-05', status: 'approved', cardSales: 500, totalRevenue: 500 }] };
const LAGS = { lags: { b1: 1, b2: 1 } };

test('BANK-H-08: سطر تسوية مكرر (إغلاق 500 ⇐ مُسوّى 1,000) ⇒ «over» لا يُرحَّل، مع الفرق والسطر المشتبه برقمه؛ والمتطابق جاهز كما كان', () => {
  const L = E.cardStmtLines(ENG, E.detectStmtMap(ENG));
  assert.deepEqual(L.map(l => l.row), [3, 4, 5, 6, 7], 'رقم السطر في الملف');
  const P = E.cardSettlePlan(ORG, OPS, L, LAGS);
  const r1 = P.rows.find(r => r.branchId === 'b1'), r2 = P.rows.find(r => r.branchId === 'b2');
  assert.deepEqual([r1.status, r1.gross, r1.sales, r1.over, r1.suspects.length], ['ready', 3000, 3000, 0, 0], 'المتطابق لم يتغير');
  assert.deepEqual([r2.status, r2.gross, r2.sales, r2.over], ['over', 1000, 500, 500]);
  assert.deepEqual(r2.suspects.map(s => [s.row, s.credit, s.dupOf]), [[7, 500, '#6']], 'المكرر هو السطر 7 (نسخة السطر 6)');
  assert.deepEqual(r2.stmtLines.map(s => s.row), [6, 7]);
  assert.deepEqual(P.ready.map(r => r.ref), ['crs|b1|2026-11-05'], 'المتجاوز ليس ضمن القيود الجاهزة');
  assert.deepEqual(E.CRS_ST.over, ['b-rose', 'يتجاوز مبيعات الإغلاق — يحتاج مراجعة']);
  // الإغلاق غير المعتمد يبقى «بانتظار الاعتماد» (الأسبق)، ولا إغلاق يبقى «لا إغلاق»، والمرحّل «مُرحّل»
  assert.equal(E.cardSettlePlan(ORG, { closings: OPS.closings.map(c => c.id === 'c2' ? { ...c, status: 'submitted' } : c) }, L, LAGS).rows.find(r => r.branchId === 'b2').status, 'pending');
  assert.equal(E.cardSettlePlan(ORG, { closings: [OPS.closings[0]] }, L, LAGS).rows.find(r => r.branchId === 'b2').status, 'noclose');
  assert.equal(E.cardSettlePlan(ORG, { ...OPS, journalManual: [{ id: 'j', ref: 'crs|b2|2026-11-06', lines: [] }] }, L, LAGS).rows.find(r => r.branchId === 'b2').status, 'done');
});

test('BANK-H-08: استبعاد السطر المكرر ⇒ جاهز بالإجمالي الصحيح؛ أو التأكيد بعد المراجعة (من ومتى) ⇒ جاهز ويُحمل التأكيد، ويسقط التأكيد إن تغير الإجمالي', () => {
  const L = E.cardStmtLines(ENG, E.detectStmtMap(ENG)).map(l => ({ ...l, src: 'كشف.xlsx' }));
  const r0 = E.cardSettlePlan(ORG, OPS, L, LAGS).rows.find(r => r.branchId === 'b2');
  assert.equal(r0.suspects[0].key, 'كشف.xlsx#7'); assert.equal(E.crLineKey(L[4], 4), 'كشف.xlsx#7'); assert.equal(E.crLineKey({ tid: '1' }, 3), '#i3');
  const ex = E.cardSettlePlan(ORG, OPS, L, { ...LAGS, exclude: [r0.suspects[0].key] }).rows.find(r => r.branchId === 'b2');
  assert.deepEqual([ex.status, ex.gross, ex.over, ex.suspects.length], ['ready', 500, 0, 0]);
  const dr = ex.lines.reduce((a, l) => a + l.debit, 0), cr = ex.lines.reduce((a, l) => a + l.credit, 0);
  assert.equal(Math.round(dr * 100), Math.round(cr * 100)); assert.equal(cr, 500, 'الوسيط يُقفل بمبيعات الإغلاق لا بالضعف');
  const cf = { 'crs|b2|2026-11-06': { by: 'محاسب تجريبي', at: '2026-11-28T10:00:00.000Z', gross: 1000 } };
  const ok = E.cardSettlePlan(ORG, OPS, L, { ...LAGS, confirm: cf }).rows.find(r => r.branchId === 'b2');
  assert.deepEqual([ok.status, ok.confirmed], ['ready', { by: 'محاسب تجريبي', at: '2026-11-28T10:00:00.000Z', gross: 1000, sales: 500, over: 500 }]);
  const stale = E.cardSettlePlan(ORG, OPS, L, { ...LAGS, confirm: { 'crs|b2|2026-11-06': { ...cf['crs|b2|2026-11-06'], gross: 900 } } }).rows.find(r => r.branchId === 'b2');
  assert.equal(stale.status, 'over', 'التأكيد على إجمالي آخر لا يسري'); assert.equal(stale.confirmed, undefined);
  const noBy = E.cardSettlePlan(ORG, OPS, L, { ...LAGS, confirm: { 'crs|b2|2026-11-06': { gross: 1000 } } }).rows.find(r => r.branchId === 'b2');
  assert.equal(noBy.status, 'over', 'التأكيد بلا اسم من أكّد لا يُقبل');
  assert.equal(E.cardSettlePlan(ORG, OPS, L, { ...LAGS, confirm: cf }).rows.find(r => r.branchId === 'b1').confirmed, undefined, 'لا تأكيد على يوم غير متجاوز');
});

test('BANK-H-08: التجاوز بلا تكرار حرفي (مبيعات شبكة مسجّلة أقل) يمنع الترحيل أيضًا ويعرض سطور اليوم للمراجعة؛ والهللة الواحدة تقريب لا تجاوز؛ وبلا وسيط كذلك', () => {
  const L = E.cardStmtLines(ENG, E.detectStmtMap(ENG));
  const low = { closings: OPS.closings.map(c => c.id === 'c1' ? { ...c, cardSales: 2900 } : c) };
  const r = E.cardSettlePlan(ORG, low, L, LAGS).rows.find(x => x.branchId === 'b1');
  assert.deepEqual([r.status, r.over, r.suspects.length, r.stmtLines.map(s => s.row)], ['over', 100, 0, [3, 5]]);
  const cent = { closings: OPS.closings.map(c => c.id === 'c1' ? { ...c, cardSales: 2999.99 } : c) };
  assert.equal(E.cardSettlePlan(ORG, cent, L, LAGS).rows.find(x => x.branchId === 'b1').status, 'over', 'هللة كاملة تجاوز');
  const two = { closings: [...OPS.closings, { id: 'c3', branchId: 'b2', date: '2026-11-05', status: 'approved', cardSales: 500, totalRevenue: 500 }] };
  assert.equal(E.cardSettlePlan(ORG, two, L, LAGS).rows.find(x => x.branchId === 'b2').status, 'ready', 'إغلاقان في اليوم نفسه ⇒ المبيعات مجموعهما');
  assert.equal(E.cardSettlePlan({ ...ORG, posClearing: {} }, low, L, LAGS).rows.find(x => x.branchId === 'b1').status, 'over', 'بلا وسيط: قيد العمولة لا يُرحَّل أيضًا حتى المراجعة');
});

/* ===================== BANK-H-07: المطابقة الشاملة ومذكرة التسوية في المحرك — تطابق مع منطق الشاشة القديم ===================== */
// منطق mods/acct/Accounting.jsx في v56.60 حرفيًا (stRun / stLines / stFull / recStmt)، ومتغيرات الشاشة (org, ops, stF, stMonth, brAcc, A, stmtEnd) معاملات
const { stDate, stNum, stAddDays, bankOfBranch, sum, monthEnd } = E;
function stRunOld(org, ops, stF, stMonth, brAcc) {
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
    const mEnd = stAddDays(nm.toISOString().slice(0, 10), 6);
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
    return res;
}
const stLinesOld = (stF) => {
    const { grid, map } = stF; const out = [];
    for (let r = map.start; r < grid.length; r++) { const g = grid[r] || []; const d = stDate(g[map.date]); if (!d) continue;
      let a = 0; const cr = map.credit >= 0 ? stNum(g[map.credit]) : 0, dr = map.debit >= 0 ? stNum(g[map.debit]) : 0;
      if (cr > 0) a = cr; else if (dr > 0) a = -dr; else if (map.amount >= 0) a = stNum(g[map.amount]);
      if (!a) continue; out.push({ i: r, date: d, amount: Math.round(a * 100) / 100, desc: String(g[map.desc] ?? '').slice(0, 80) }); }
    return out;
};
const bankBookAtOld = (A, brAcc, d) => {
    let v = 0;
    A.entries.forEach(e => { if (!d || (e.date || '') <= d) e.lines.forEach(l => { if (l.code === brAcc) v += l.debit - l.credit; }); });
    return Math.round(v * 100) / 100;
};
function stFullOld(A, stF, stMonth, brAcc) {
    const mStart = stMonth + '-01', mEnd = monthEnd(stMonth);
    const bank = stLinesOld(stF).filter(x => x.date >= mStart && x.date <= mEnd).map(x => ({ ...x, used: false }));
    const lo = stAddDays(mStart, -5), hi = stAddDays(mEnd, 5);
    const book = A.entries.filter(e => (e.date || '') >= lo && (e.date || '') <= hi && e.lines.some(l => l.code === brAcc))
      .map(e => ({ id: e.id, date: e.date, title: e.title, amount: Math.round(sum(e.lines.filter(l => l.code === brAcc), l => l.debit - l.credit) * 100) / 100, used: false }))
      .filter(b => Math.abs(b.amount) > 0.004);
    const dd = (a, b) => Math.abs((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);
    const matched = [];
    bank.forEach(x => { let best = null; book.forEach(b => { if (b.used || Math.abs(b.amount - x.amount) > 0.009 || dd(b.date, x.date) > 5) return; if (!best || dd(b.date, x.date) < dd(best.date, x.date)) best = b; });
      if (best) { best.used = true; x.used = true; matched.push({ bank: x, book: best }); } });
    const bankUn = bank.filter(x => !x.used), bookUn = book.filter(b => !b.used && b.date >= mStart && b.date <= mEnd);
    const bookEnd = bankBookAtOld(A, brAcc, mEnd);
    const r2x = (n) => Math.round(n * 100) / 100;
    const expStmt = r2x(bookEnd + sum(bankUn, x => x.amount) - sum(bookUn, b => b.amount));
    return { month: stMonth, bank: bank.length, matched, bankUn, bookUn, bookEnd, expStmt };
}
const recStmtOld = (M, stF, stmtEnd) => { if (!M) return null; const r2x = (n) => Math.round(n * 100) / 100;
    const mt = stF && stF.mt940 && stF.mt940.close && stF.mt940.close.date.slice(0, 7) === M.month ? stF.mt940.close.amount : null;
    const bank = stmtEnd !== '' ? Number(stmtEnd) || 0 : mt;
    const dit = r2x(sum(M.bookUn.filter(b => b.amount > 0), b => b.amount)), oc = r2x(-sum(M.bookUn.filter(b => b.amount < 0), b => b.amount));
    const bin = r2x(sum(M.bankUn.filter(x => x.amount > 0), x => x.amount)), bout = r2x(-sum(M.bankUn.filter(x => x.amount < 0), x => x.amount));
    const adjBank = bank == null ? null : r2x(bank + dit - oc), adjBook = r2x(M.bookEnd + bin - bout);
    return { bank, src: stmtEnd !== '' ? 'مُدخل' : mt != null ? 'MT940' : '', dit, oc, bin, bout, adjBank, adjBook, diff: adjBank == null ? null : r2x(adjBank - adjBook) }; };

// كشف اصطناعي: إيداعات شبكة بفارق 0–5 أيام، مكررة، خارج الشهر، سحوبات ورسوم، صفوف فارغة وعناوين، وأعمدة دائن/مدين أو مبلغ واحد
function fixture(seed) {
  const org = { branches: [{ id: 'b1', name: 'فرع 1' }, { id: 'b2', name: 'فرع 2', bankName: 'بنك تجريبي', bankIban: 'SA00' }, { id: 'b3', name: 'فرع 3' }], taxCfg: { enabled: true, rate: 15 } };
  const closings = []; const grid = [['كشف تجريبي'], ['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد']];
  for (let d = 1; d <= 30; d++) {
    const day = '2026-11-' + String(d).padStart(2, '0'), st = (d + seed) % 9 === 0 ? 'draft' : (d % 4 ? 'approved' : 'submitted'), tot = { '1201': 0, b2: 0 };
    for (const b of ['b1', 'b2', 'b3']) { const card = Math.round(((d * 37 + seed * 11 + b.charCodeAt(1) * 5) % 900 + 100) * 100) / 100;
      closings.push({ id: 'c' + b + d, branchId: b, date: day, status: st, cardSales: card, totalRevenue: card * 2, cashSales: card, expenses: [] }); tot[b === 'b2' ? 'b2' : '1201'] += card; }
    // b1 وb3 على البنك التجميعي (مجموعهما يوميًا)، وb2 على بنكه
    for (const k of ['1201', 'b2']) { const card = Math.round(tot[k] * 100) / 100;
      if ((d + seed) % 7 !== 0) { const lag = (d + seed + (k === 'b2' ? 2 : 0)) % 6; const dd = E.stAddDays(day, lag); grid.push([dd.slice(8) + '/' + dd.slice(5, 7) + '/' + dd.slice(0, 4), 'نقاط بيع ' + k, '', (d + seed) % 11 === 0 ? (card + 1).toFixed(2) : card.toLocaleString('en-US', { minimumFractionDigits: 2 }), '']); }
      if (d % 10 === 0) grid.push([day, 'إيداع مكرر', '', String(card), '']); }
  }
  for (let k = 0; k < 15; k++) grid.push(['2026-11-' + String(1 + k * 2).padStart(2, '0'), k % 3 ? 'سداد مورد' : 'رسوم بنكية', String(50 + k * 13 + seed), '', '']);
  grid.push(['', 'سطر فارغ التاريخ', '', '10', ''], ['2026-12-03', 'إيداع الشهر التالي', '', '420.5', ''], ['2026-10-30', 'إيداع الشهر السابق', '', '77', ''], ['الإجمالي', '', '999', '999', '']);
  const ops = { closings, journalManual: Array.from({ length: 12 }, (_, k) => ({ id: 'jm' + k, date: '2026-11-' + String(2 + k * 2).padStart(2, '0'), title: 'قيد بنك ' + k, status: 'posted',
    lines: k % 2 ? [{ code: '5901', debit: 50 + k * 13 + seed, credit: 0 }, { code: '1201', debit: 0, credit: 50 + k * 13 + seed }] : [{ code: '1201', debit: 300 + k, credit: 0 }, { code: '3101', debit: 0, credit: 300 + k }] })) };
  return { org, ops, grid };
}

test('BANK-H-07: stNetMatch / stLinesOf / stFullMatch / stRecMemo = منطق الشاشة القديم حرفيًا على كشوف اصطناعية متعددة (بنكان، أشهر، مدين/دائن أو مبلغ واحد)', () => {
  let n = 0;
  for (let seed = 0; seed < 6; seed++) {
    const { org, ops, grid } = fixture(seed); const A = E.buildAccounting(org, ops);
    const map1 = E.detectStmtMap(grid); assert.ok(map1);
    const g2 = grid.map((r, i) => i < 2 ? (i === 1 ? ['التاريخ', 'البيان', 'المبلغ'] : r) : [r[0], r[1], r[3] ? r[3] : r[2] ? '-' + r[2] : '']);
    const map2 = E.detectStmtMap(g2); assert.equal(map2.amount, 2);
    for (const [g, map] of [[grid, map1], [g2, map2]]) for (const month of ['2026-11', '2026-12', '2026-10']) for (const bank of ['1201', E.bankOfBranch(org, 'b2')]) {
      const stF = { grid: g, map };
      assert.deepEqual(E.stNetMatch(org, ops, g, map, month, bank), stRunOld(org, ops, stF, month, bank), 'stNetMatch ' + seed + ' ' + month + ' ' + bank);
      const L = E.stLinesOf(g, map); assert.deepEqual(L, stLinesOld(stF));
      const M = E.stFullMatch(A.entries, L, month, bank), M0 = stFullOld(A, stF, month, bank);
      assert.deepEqual(M, M0, 'stFullMatch ' + seed + ' ' + month + ' ' + bank);
      assert.equal(E.stBookAt(A.entries, bank, '2026-11-15'), bankBookAtOld(A, bank, '2026-11-15')); assert.equal(E.stBookAt(A.entries, bank, ''), bankBookAtOld(A, bank, ''));
      const mt = { close: { date: month + '-28', amount: 12345.67 } };
      for (const [end, stx] of [['', null], ['', { mt940: mt }], ['5000', { mt940: mt }], ['abc', null], ['0', null]]) assert.deepEqual(E.stRecMemo(M, end, stx && stx.mt940), recStmtOld(M0, stx, end));
      n++;
    }
  }
  assert.equal(n, 72);
  assert.equal(E.stRecMemo(null, ''), null);
  // سلوك معروف: إيداعات الشبكة تُطابَق بنافذة 0–4 أيام، وكل الحركات ±5 أيام
  const { org, ops, grid } = fixture(1); const R = E.stNetMatch(org, ops, grid, E.detectStmtMap(grid), '2026-11', '1201');
  assert.ok(R.matched.length > 10 && R.sysUn.length > 0 && R.bankUn.length > 0, JSON.stringify([R.matched.length, R.sysUn.length, R.bankUn.length]));
  assert.equal(R.diff, Math.round((R.sysTotal - R.bankTotal) * 100) / 100);
});

test('BANK-H-07 + BANK-H-04: ترتيب شهر/يوم في الكشف كله يصل للمطابقة عبر map.order، وبدونه يبقى السلوك القديم', () => {
  const org = { branches: [{ id: 'b1', name: 'فرع 1' }] };
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-05', status: 'approved', cardSales: 100 }, { id: 'c2', branchId: 'b1', date: '2026-11-20', status: 'approved', cardSales: 200 }] };
  const g = [['Date', 'Description', 'Credit'], ['11/06/2026', 'pos', '100'], ['11/21/2026', 'pos', '200']];
  const map = E.detectStmtMap(g), sc = E.stDateScan(g, map); assert.equal(sc.order, 'mdy');
  const R = E.stNetMatch(org, ops, g, { ...map, order: sc.order }, '2026-11', '1201');
  assert.deepEqual([R.matchedTotal, R.diff], [300, 0]);
  const R0 = E.stNetMatch(org, ops, g, map, '2026-11', '1201');
  assert.deepEqual([R0.matchedTotal, R0.depCount], [0, 0], 'بلا ترتيب: 11/06 = 11 يونيو خارج الشهر، و11/21 مرفوض');
});

/* ===================== ملاحظة المراجع: تاريخ إغلاق ليس نصًا ===================== */
test('buildAccounting: تاريخ إغلاق رقمي أو كائن أو Date لا يكسر الحساب — Date صالح ⇒ يومه، وغيره ⇒ كالإغلاق بلا تاريخ؛ والنصوص لا تُمس', () => {
  const { org, ops } = scaleData({ branches: 2, days: 10, orders: 200, invoices: 20, assets: 2, employees: 3, suppliers: 2, customers: 3, salesInvoices: 5 });
  const base = E.buildAccounting(org, ops);
  const blank = E.buildAccounting(org, { ...ops, closings: ops.closings.map((c, i) => i === 3 ? { ...c, date: '' } : c) });
  for (const bad of [20251225, { y: 2025 }, ['2025-12-25'], true, new Date('invalid')]) {
    const A = E.buildAccounting(org, { ...ops, closings: ops.closings.map((c, i) => i === 3 ? { ...c, date: bad } : c) });
    assert.equal(A.balanced, true); assert.equal(JSON.stringify(A.entries), JSON.stringify(blank.entries), 'مثل الإغلاق بلا تاريخ: ' + String(bad));
  }
  const d = ops.closings[3].date, dt = new Date(d + 'T00:00:00');
  const A2 = E.buildAccounting(org, { ...ops, closings: ops.closings.map((c, i) => i === 3 ? { ...c, date: dt } : c) });
  assert.equal(JSON.stringify(A2.entries), JSON.stringify(base.entries), 'Date ⇒ يومه المحلي');
  assert.equal(E.acctCloseDate('2025-01-01'), '2025-01-01'); assert.equal(E.acctCloseDate(null), null); assert.equal(E.acctCloseDate(undefined), undefined); assert.equal(E.acctCloseDate(5), '');
  assert.equal(E.acctSafeOps(ops), ops, 'بيانات سليمة ⇒ الكائن نفسه بلا نسخ');
});

/* ===================== PERF-H-02: buildPartners بالفهرسة — مطابق حرفيًا للتنفيذ القديم ===================== */
// التنفيذ القديم (v56.60) كما هو — مساعداته من المحرك نفسه
const { posArCustMap, cvLive, cvPosSplit, cvPosAllocOk, payTotal, payLabel, today, invPayments, contactOf, arDocs, posArDayKeys, posCreditAmt, posArCust, eclLive, eclR2, PAY_ADD_TYPES, posCreditOn, PT_TYPE, partnerCode } = E;
function buildPartnersOld(org, ops) {
  const parts = [];
  const led = ops.ledgerEntries || [];
  // v46.6 — سندات القبض والصرف والمقاصّة في كشوف الجهات (الموزَّع على فواتير يظهر مع الفاتورة نفسها)
  let PM0 = null; const PM = () => PM0 || (PM0 = posArCustMap(ops));   // v56.46: يُبنى فقط إن وُجد تخصيص pos:
  const cvFor = (key) => { const t = [];
    (ops.cashVouchers || []).forEach(v => { const a = Number(v.amount) || 0; if (!(a > 0) || !cvLive(v)) return; const d = String(v.date || '').slice(0, 10);   // v56.32: المعلّق لا يظهر في الكشف
      if (v.kind === 'ov') { if (v.supKey === key) t.push({ date: d, desc: 'مقاصّة مع حساب العميل ' + v.no, ref: v.no, src: 'cv', debit: a, credit: 0 }); if (v.custKey === key) t.push({ date: d, desc: 'مقاصّة مع حساب المورد ' + v.no, ref: v.no, src: 'cv', debit: 0, credit: a }); return; }
      const p = v.party || {}; if (p.key !== key) return;
      const hasPos = (v.alloc || []).some(x => x && /^pos:/.test(String(x.id || ''))); const PS = hasPos ? cvPosSplit(PM(), v) : { ok: 0, bad: 0 };
      const rest = Math.round((a - (v.alloc || []).reduce((s2, x) => s2 + (Number(x.amount) || 0), 0) + PS.bad) * 100) / 100;   // v56.46: تخصيص pos: لغير عميله يبقى على الحساب
      // v56.46: التخصيص لمستند ذمة الكاشير (pos:) يبقى على السند — سطر لكل تخصيص يُخصم من مستنده في الأعمار
      if (hasPos && p.t === 'cust' && v.kind === 'rv') (v.alloc || []).forEach(x => { const xa = Math.round((Number(x && x.amount) || 0) * 100) / 100; if (cvPosAllocOk(PM(), v, x) && xa > 0) t.push({ date: d, desc: 'سند قبض ' + v.no + ' عن ' + (x.no || x.id), ref: v.no, src: 'cv', debit: 0, credit: xa, sid: x.id }); });
      if (p.t === 'emp') { if (v.kind === 'pv' && v.empPurpose === 'advance') return; t.push({ date: d, desc: (v.kind === 'rv' ? 'سند قبض ' : 'سند صرف — عهدة ') + v.no, ref: v.no, src: 'cv', debit: v.kind === 'pv' ? a : 0, credit: v.kind === 'rv' ? a : 0 }); return; }
      if (!(rest > 0.004)) return;
      t.push({ date: d, desc: (v.kind === 'rv' ? 'سند قبض ' : 'سند صرف ') + v.no + ' — على الحساب', ref: v.no, src: 'cv', debit: v.kind === 'pv' ? rest : 0, credit: v.kind === 'rv' ? rest : 0 }); });
    return t; };
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
        : { date: d, desc: 'فاتورة توريد ' + (i.invoiceNo || ''), ref: i.invoiceNo || '', src: 'inv', debit: 0, credit: i.amount || 0, due: (i.dueDate || '').slice(0, 10) });
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
    txns.push(...ledFor(key)); { const cv = cvFor(key); txns.push(...cv); if (cv.length) linked = true; }
    parts.push({ key, id: sp.id, ...contactOf(sp), linkKey: sp.linkKey || '', name: sp.name, type: 'supplier', cat: sp.category || 'مورد', phone: sp.phone || '', tax: sp.vatNo || '', address: sp.address || '', taxable: !!sp.taxable, terms: sp.terms || 0, linked, txns, storedCode: sp.code });
  });

  // v56.46: مستندات ذمم الكاشير المرحّلة والمرتجعات إلى الحساب المرحّلة (بلا فواتير آجلة: قائمتان فارغتان)
  const AR = arDocs(ops, org); const posAr = AR === (ops.salesInvoices || []) ? [] : AR.filter(x => x.kind === 'posar');
  const posRet = (() => { const P = ops.posOrders || []; if (!P.some(r => r && r.kind === 'return' && (r.payments || []).some(q => q && q.m === 'credit'))) return [];
    const ks = posArDayKeys(ops); return P.filter(r => r && r.kind === 'return' && r.status !== 'void' && ks.has(r.branchId + '|' + r.date) && posCreditAmt(r) < -0.004); })();
  // v31.0: حركات العميل من سجل فواتير المبيعات (الآجلة فقط: الفاتورة مدين، التحصيل والإشعار الدائن دائن)
  const siFor = (key) => { const t = [];
    posAr.filter(x => x.customerKey === key).forEach(x => t.push({ date: x.date, desc: 'فاتورة نقطة بيع آجلة ' + x.no, ref: x.no, src: 'pos', debit: x.total, credit: 0, due: x.dueDate, sid: x.id }));
    posRet.filter(r => posArCust(r).key === key).forEach(r => t.push({ date: r.date, desc: 'مرتجع إلى الحساب ' + (r.no || '') + (r.refNo ? ' (عن ' + r.refNo + ')' : ''), ref: r.no || '', src: 'pos', debit: 0, credit: -posCreditAmt(r), sid: 'pos:' + r.refId }));
    (ops.salesInvoices || []).filter(x => x.customerKey === key && !x.inClosing).forEach(x => {
      if (x.kind === 'credit') { if (x.terms === 'credit') t.push({ date: x.date, desc: 'إشعار دائن ' + x.no, ref: x.no, src: 'si', debit: 0, credit: x.total }); return; }
      if (x.terms !== 'credit') return;
      t.push({ date: x.date, desc: (x.kind === 'debit' ? 'إشعار مدين ' : 'فاتورة مبيعات ') + x.no, ref: x.no, src: 'si', debit: x.total, credit: 0, due: x.dueDate, sid: x.id });
      (x.receipts || []).forEach(r => t.push({ date: r.date, desc: 'تحصيل عن ' + x.no, ref: x.no, src: 'si', debit: 0, credit: Number(r.amount) || 0 }));
    });
    (ops.eclDocs || []).filter(d => eclLive(d) && (d.kind === 'wo' || d.kind === 'rec') && d.customerKey === key).forEach(d => t.push(d.kind === 'wo'
      ? { date: d.date, desc: 'شطب دين معدوم ' + (d.no || ''), ref: d.no || '', src: 'ecl', debit: 0, credit: eclR2(d.amount), sid: d.siId }   // v56.40: يُخصم من فاتورته في الأعمار
      : { date: d.date, desc: 'استرداد دين مشطوب ' + (d.no || ''), ref: d.no || '', src: 'ecl', debit: eclR2(d.amount), credit: 0, due: (AR.find(y => y.id === d.siId) || {}).dueDate || d.date }));   // يُعمَّر بتاريخ استحقاق فاتورته
    return t; };

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
    txns.push(...ledFor(key)); { const cv = cvFor(key); txns.push(...cv); if (cv.length) linked = true; }
    parts.push({ key, id: em.id, email: em.email || '', branchId: em.branchId || '', name: em.name, type: 'employee', cat: em.jobTitle || em.title || 'موظف', phone: em.phone || '', tax: em.nationalId || em.iqamaNo || '', terms: 0, linked, txns, storedCode: em.code });
  });

  // العملاء والشركاء اليدويون — حركات يدوية فقط
  (org.partners || []).forEach(pt => {
    const key = pt.key || ('cust:' + pt.id);
    const ce = [...closeFor(key), ...siFor(key)], pp = payFor(key), cv = cvFor(key);
    parts.push({ key, id: pt.id, ...contactOf(pt), ...(pt.posCredit && posCreditOn(org) ? { posCredit: true } : {}), linkKey: pt.linkKey || '', name: pt.name, type: pt.type || 'customer', cat: pt.cat || 'عميل', phone: pt.phone || '', tax: pt.tax || '', address: pt.address || '', taxable: !!pt.taxable, terms: pt.terms || 0, linked: (ce.length + pp.length + cv.length) > 0, custom: true, txns: [...ce, ...pp, ...cv, ...ledFor(key)], storedCode: pt.code });
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

// بيانات بشروط مطابقة صعبة: مفتاح مخصص للمورد، رقم مورد فارغ، بند يطابق بالمفتاح ورقم المورد معًا، مفاتيح غير معرّفة، مقاصّة لنفس الجهة طرفين،
// تخصيص سند لذمة نقطة بيع لعميلها ولغيره، فواتير داخل الإغلاق، شطب واسترداد، مرتجع إلى الحساب، سلف بأنواع، سداد مركزي، شركاء فرع مكررون
function trickyData(k = 1) {
  const org = { posCredit: { enabled: true }, branches: [{ id: 'b1', name: 'فرع 1' }, { id: 'b2', name: 'فرع 2' }],
    suppliers: [{ id: 's1', name: 'مورد 1', key: 'sup:custom1', code: 'مورد-007' }, { id: 's2', name: 'مورد 2' }, { id: '', name: 'مورد بلا رقم' }, { id: 's1', name: 'مورد مكرر الرقم' }, { id: 's3', name: 'مورد 3', category: 'خدمات', taxable: true, terms: 30, mobile2: '05', na: { city: 'مدينة' } }],
    employees: [{ id: 'e1', name: 'موظف 1', code: 'موظف-002' }, { id: 'e2', name: 'موظف 2', branchId: 'b2' }],
    partners: [{ id: 'c1', name: 'عميل 1', posCredit: true }, { id: 'c2', name: 'عميل 2', key: 'cust:k2', type: 'customer' }, { id: 'c3', name: 'شريك', type: 'other' }, { id: 'c1', name: 'عميل مكرر' }] };
  const closings = [];
  for (let i = 0; i < 40 * k; i++) {
    const b = i % 2 ? 'b1' : 'b2', d = '2026-' + String(1 + (i % 11)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0');
    closings.push({ id: 'cl' + i, branchId: b, branchName: 'فرع', date: d, status: ['approved', 'submitted', 'draft', 'rejected'][i % 4],
      expenses: [{ categoryName: 'مشتريات', amount: 10 + i, paymentMethod: i % 3 ? 'deferred' : 'cash', partnerKey: 'sup:custom1', supplierId: 's1' },
        { amount: 5 + i, paymentMethod: ['card', 'cheque', 'bank_transfer', 'x'][i % 4], supplierId: 's2' }, { amount: 7, partnerKey: 'emp:e1' }, { amount: 0, partnerKey: 'cust:c1' },
        { amount: 3, partnerKey: i % 5 ? 'cust:k2' : undefined }, { amount: 2, supplierId: '' }, { amount: 4, partnerKey: 'sup:s2', supplierId: 's3' }],
      supplierPayments: [{ partnerKey: 'sup:s2', amount: 20 + i, method: 'cash', reference: i % 2 ? 'R' + i : '' }, { supplierId: 's1', splits: [{ method: 'cash', amount: 5 }, { method: 'bank', amount: 6 }] },
        { partnerKey: 'emp:e2', amount: 3 }, { partnerKey: undefined, amount: 1 }, { supplierId: 's3', partnerKey: 'sup:custom1', amount: 2 }] });
  }
  const invoices = []; for (let i = 0; i < 60 * k; i++) invoices.push({ id: 'i' + i, supplierId: ['s1', 's2', 's3', '', undefined][i % 5], invoiceNo: 'INV-' + i, amount: i % 9 ? 100 + i : -(20 + i), date: i % 7 ? '2026-03-' + String(1 + (i % 27)).padStart(2, '0') : '', createdAt: '2026-04-01T10:00:00Z', dueDate: '2026-05-01',
    paidAmount: i % 3 ? 40 : 0, ...(i % 4 ? { payments: [{ id: 'p' + i, amount: 10, date: '2026-04-0' + (1 + (i % 8)), fund: '1201' }] } : {}) });
  const cashVouchers = []; for (let i = 0; i < 50 * k; i++) {
    const kind = ['rv', 'pv', 'ov', 'rv', 'pv'][i % 5];
    cashVouchers.push({ id: 'v' + i, no: 'سند-' + i, kind, amount: i % 13 ? 50 + i : 0, date: '2026-06-' + String(1 + (i % 28)).padStart(2, '0'), status: i % 11 ? 'posted' : 'pending',
      party: [{ key: 'cust:c1', t: 'cust' }, { key: 'sup:custom1', t: 'sup' }, { key: 'emp:e1', t: 'emp' }, { key: 'cust:k2', t: 'cust' }, {}][i % 5],
      ...(kind === 'ov' ? { supKey: i % 2 ? 'sup:s2' : 'cust:k2', custKey: 'cust:k2' } : {}), empPurpose: i % 2 ? 'advance' : '',
      alloc: i % 3 ? [{ id: 'pos:po' + (i % 4), no: 'ف', amount: 10 }, { id: 'si' + i, amount: 5 }] : [] });
  }
  const posOrders = []; for (let i = 0; i < 30 * k; i++) { const c = closings[i % closings.length];
    posOrders.push({ id: 'po' + i, no: 'ف-' + i, branchId: c.branchId, date: c.date, status: i % 7 ? 'paid' : 'void', kind: i % 6 === 5 ? 'return' : 'sale', refId: 'po' + (i - 1), refNo: 'ف-' + (i - 1),
      payments: [{ m: 'credit', amount: i % 6 === 5 ? -(15 + i) : 30 + i, custKey: ['cust:c1', 'cust:k2', 'cust:none'][i % 3], custName: 'عميل' }], ...(i % 4 ? { ar: { key: i % 8 ? 'cust:c1' : '', dueDate: '2026-09-01' } } : {}) }); }
  const salesInvoices = []; for (let i = 0; i < 40 * k; i++) salesInvoices.push({ id: 'si' + i, no: 'INV-S-' + i, kind: ['invoice', 'credit', 'debit', 'invoice'][i % 4], terms: i % 5 ? 'credit' : 'cash', customerKey: ['cust:c1', 'cust:k2', 'cust:c3', undefined][i % 4],
    date: '2026-07-' + String(1 + (i % 28)).padStart(2, '0'), dueDate: '2026-08-15', total: 100 + i, inClosing: i % 9 === 0, receipts: i % 2 ? [{ date: '2026-07-20', amount: 30 }, { date: '2026-07-21', amount: '5' }] : [] });
  const eclDocs = []; for (let i = 0; i < 10 * k; i++) eclDocs.push({ id: 'ecl' + i, no: 'E' + i, kind: ['wo', 'rec', 'prov', 'wo'][i % 4], status: i % 5 ? 'approved' : 'void', customerKey: ['cust:c1', 'cust:k2'][i % 2], siId: i % 3 ? 'si' + i : 'pos:po' + i, amount: 10 + i, date: '2026-08-0' + (1 + (i % 8)) });
  const ledgerEntries = []; for (let i = 0; i < 30 * k; i++) ledgerEntries.push({ id: 'le' + i, partnerKey: ['sup:custom1', 'emp:e1', 'cust:c1', 'cust:k2', undefined, 'brp:1'][i % 6], date: '2026-02-0' + (1 + (i % 8)), debit: i % 2 ? 10 : 0, credit: i % 2 ? 0 : 12, ...(i % 3 ? { desc: 'يدوي', ref: 'r' + i, src: 'x' } : {}) });
  const advances = []; for (let i = 0; i < 20 * k; i++) advances.push({ id: 'ad' + i, employeeId: ['e1', 'e2', 'e3'][i % 3], type: ['advance', 'salary_draw', 'deduction', 'bonus', 'penalty'][i % 5], amount: 100 + i, date: '2026-05-10', month: '2026-05', reason: i % 2 ? 'سبب' : '' });
  const closingInvPays = []; for (let i = 0; i < 12 * k; i++) closingInvPays.push({ supplierId: ['s1', 's2', ''][i % 3], amount: 9 + i, date: '2026-04-05', ...(i % 2 ? { mizanId: 'mz' + i, payType: 'تحويل', bankRef: 'B' + i } : { refId: 'cl' + i }) });
  const branchPartners = [{ key: 'brp:1', id: 'bp1', name: 'شريك فرع', branchId: 'b1', branchName: 'فرع 1' }, { key: 'cust:k2', id: 'bp2', name: 'مكرر مع المركزي' }, { id: 'bp3', name: 'بلا مفتاح', type: 'supplier', code: 'مورد-001' }];
  return { org, ops: { closings, invoices, cashVouchers, posOrders, salesInvoices, eclDocs, ledgerEntries, advances, closingInvPays, branchPartners } };
}

test('PERF-H-02: buildPartners المفهرس = القديم بايتًا ببايت على شروط المطابقة الصعبة (المفتاح أو رقم المورد، مفاتيح غير معرّفة، مقاصّة، ذمم نقطة البيع، الشطب)', () => {
  for (const k of [1, 3]) {
    const { org, ops } = trickyData(k);
    const NEW = JSON.stringify(E.buildPartners(org, ops)), OLD = JSON.stringify(buildPartnersOld(org, ops));
    assert.equal(NEW, OLD);
    const P = JSON.parse(NEW); assert.ok(P.length >= 12 && P.reduce((a, p) => a + p.txns.length, 0) > 300 * k, 'البيانات تمرّن الشروط فعلًا: ' + P.reduce((a, p) => a + p.txns.length, 0));
    assert.ok(P.some(p => p.txns.some(t => t.src === 'pos')) && P.some(p => p.txns.some(t => t.src === 'ecl')) && P.some(p => p.txns.some(t => t.src === 'cv' && /مقاصّة/.test(t.desc))), 'ذمم نقطة البيع والشطب والمقاصّة حاضرة');
  }
  // جزئيات: بلا جهات، بلا مستندات، ومجموعات فارغة
  for (const [org, ops] of [[{}, {}], [{ suppliers: [{ id: 's1', name: 'x' }] }, {}], [{ partners: [{ id: 'c1', name: 'y' }] }, { cashVouchers: [], posOrders: [] }]])
    assert.equal(JSON.stringify(E.buildPartners(org, ops)), JSON.stringify(buildPartnersOld(org, ops)));
});

test('PERF-H-02: المطابقة الحرفية على بيانات الحجم (300 مورد × 50 ألف فاتورة، 1,000 عميل × 5 آلاف فاتورة، 500 موظف بسلف)', () => {
  const { org, ops } = scaleData({ orders: 2000 });
  let NEW, OLD; const tNew = ms(() => { NEW = JSON.stringify(E.buildPartners(org, ops)); }), tOld = ms(() => { OLD = JSON.stringify(buildPartnersOld(org, ops)); });
  assert.equal(NEW, OLD);
  console.log('# PERF-H-02 scale: new ' + Math.round(tNew) + 'ms · old ' + Math.round(tOld) + 'ms');
});

test('PERF-H-02 (انحدار): 4,000 عميل × 80 ألف فاتورة مبيعات (+300 مورد × 20 ألف فاتورة) أقل بكثير من ثانية — كان ≈ 3.1 ث في v56.60', () => {
  const { org, ops } = scaleData({ branches: 4, days: 365, orders: 0, invoices: 20000, assets: 0, employees: 50, suppliers: 300, customers: 4000, salesInvoices: 80000 });
  let P; const t = Math.min(ms(() => { P = E.buildPartners(org, ops); }), ms(() => { P = E.buildPartners(org, ops); }));
  assert.equal(P.filter(p => p.type === 'customer').length, 4000); assert.equal(P.reduce((a, p) => a + p.txns.filter(x => x.src === 'si').length, 0) > 80000, true);
  console.log('# PERF-H-02 4000x80k: ' + Math.round(t) + 'ms');
  assert.ok(t < 1000, 'buildPartners استغرق ' + Math.round(t) + 'ms');
  // عيّنة مطابقة على البيانات نفسها
  const sub = { ...org, partners: org.partners.slice(0, 50), suppliers: org.suppliers.slice(0, 10), employees: org.employees.slice(0, 5) };
  assert.equal(JSON.stringify(E.buildPartners(sub, ops)), JSON.stringify(buildPartnersOld(sub, ops)));
});
