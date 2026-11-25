/**
 * سيناريوهات معروفة النتائج (Expected Results) — محسوبة يدويًا قبل كتابة المحرك، بأرقام وهمية.
 * كل خطأ متعمد (mutation) يحدد الفحص الذي يجب أن يكتشفه.
 */
const A = (code, kind, extra = {}) => ({ code, kind, ...extra });
export const ACCOUNTS = [
  A('1000', 'asset', { postable: false, name: 'الأصول (رئيسي)' }),
  A('1101', 'asset', { name: 'صندوق الفرع' }), A('1201', 'asset', { name: 'البنك' }),
  A('1380', 'asset', { name: 'ذمم العملاء', control: 'AR' }), A('1501', 'asset', { name: 'ضريبة المدخلات' }),
  A('1601', 'asset', { name: 'المخزون' }), A('1701', 'asset', { name: 'المعدات' }), A('1702', 'asset', { name: 'مجمع الإهلاك' }),
  A('2101', 'liability', { name: 'ذمم الموردين', control: 'AP' }), A('2301', 'liability', { name: 'ضريبة المخرجات' }),
  A('3101', 'equity', { name: 'رأس المال' }),
  A('4101', 'revenue', { name: 'المبيعات' }),
  A('5101', 'expense', { name: 'تكلفة المبيعات' }), A('5201', 'expense', { name: 'الإيجار' }), A('5301', 'expense', { name: 'الإهلاك' }),
];
const L = (acc, dr, cr, party) => ({ acc, dr, cr, ...(party ? { party } : {}) });
const E = (id, date, source, lines, x = {}) => ({ id, date, tenant: 't1', status: 'posted', source: source ? { type: source[0], id: source[1] } : undefined, postedAt: date + 'T10:00:00Z', lines, ...x });

export function baseLedger() {
  return {
    tenant: 't1', baseCurrency: 'SAR', accounts: ACCOUNTS.map(a => ({ ...a })),
    entries: [
      E('e1', '2026-01-01', ['capital', 'c1'], [L('1201', 100000, 0), L('3101', 0, 100000)]),
      E('e2', '2026-01-05', ['inv', 'p1'], [L('1701', 10000, 0), L('1501', 1500, 0), L('2101', 0, 11500, 's1')]),
      E('e3', '2026-01-10', ['closing', 'd1'], [L('1101', 1150, 0), L('4101', 0, 1000), L('2301', 0, 150)]),
      E('e4', '2026-01-12', ['sinv', 's1'], [L('1380', 2300, 0, 'c1'), L('4101', 0, 2000), L('2301', 0, 300)]),
      E('e5', '2026-01-15', ['inv', 'p2'], [L('1601', 600, 0), L('1501', 90, 0), L('2101', 0, 690, 's2')]),
      E('e6', '2026-01-20', ['issue', 'x1'], [L('5101', 276, 0), L('1601', 0, 276)]),
      E('e7', '2026-01-31', ['pay', 'r1'], [L('5201', 3000, 0), L('1201', 0, 3000)]),
      E('e8', '2026-01-31', ['dep', '2026-01'], [L('5301', 166.67, 0), L('1702', 0, 166.67)]),
      E('e9', '2026-02-02', ['pay', 'v1'], [L('2101', 5000, 0, 's1'), L('1201', 0, 5000)]),
      E('e10', '2026-02-03', ['pay', 'draft1'], [L('5201', 999, 0), L('1101', 0, 999)], { status: 'draft' }),
      E('e11', '2026-02-03', ['pay', 'r2'], [L('5201', 500, 0), L('1101', 0, 500)]),
      E('e12', '2026-02-04', ['reversal', 'e11'], [L('1101', 500, 0), L('5201', 0, 500)], { reversalOf: 'e11' }),
      E('e13', '2026-02-05', ['pay', 'void1'], [L('5201', 777, 0), L('1201', 0, 777)], { status: 'void' }),
    ],
  };
}

/** النتائج المتوقعة المحسوبة يدويًا للدفتر الأساسي */
export const EXPECTED = {
  balances: { 1101: 1150, 1201: 92000, 1380: 2300, 1501: 1590, 1601: 324, 1701: 10000, 1702: -166.67, 2101: -7190, 2301: -450, 3101: -100000, 4101: -3000, 5101: 276, 5201: 3000, 5301: 166.67 },
  totalDr: 110806.67, // مجموع الأرصدة المدينة = مجموع الدائنة
  subledger: { 2101: { s1: -6500, s2: -690 }, 1380: { c1: 2300 } },
  statements: { revenue: 3000, expenses: 3442.67, netIncome: -442.67, assets: 107197.33, liabilities: 7640, equity: 100000 },
  entries: [
    { source: { type: 'closing', id: 'd1' }, lines: [L('1101', 1150, 0), L('4101', 0, 1000), L('2301', 0, 150)] },
    { source: { type: 'sinv', id: 's1' }, lines: [L('1380', 2300, 0), L('4101', 0, 2000), L('2301', 0, 300)] },
  ],
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const ent = (lg, id) => lg.entries.find(e => e.id === id);

/** أخطاء متعمدة: كل واحد يجب أن يكتشفه الفحص المحدد. */
export const MUTATIONS = [
  { name: 'قيد غير متوازن', expect: 'balance.entry', apply: (lg) => { ent(lg, 'e3').lines[1].cr = 999; } },
  { name: 'ترحيل مكرر لنفس الإغلاق', expect: 'posting.duplicate-source', apply: (lg) => { lg.entries.push({ ...clone(ent(lg, 'e3')), id: 'e3b' }); } },
  { name: 'رقم قيد مكرر', expect: 'posting.duplicate-id', apply: (lg) => { lg.entries.push({ ...clone(ent(lg, 'e7')), source: { type: 'pay', id: 'zz' } }); } },
  { name: 'عكس لا يطابق الأصل', expect: 'reversal.mirror', apply: (lg) => { const e = ent(lg, 'e12'); e.lines[0].dr = 400; e.lines[1].cr = 400; } },
  { name: 'عكس القيد مرتين', expect: 'reversal.double', apply: (lg) => { lg.entries.push({ ...clone(ent(lg, 'e12')), id: 'e12b' }); } },
  { name: 'عكس لقيد غير موجود', expect: 'reversal.orphan', apply: (lg) => { ent(lg, 'e12').reversalOf = 'nope'; } },
  { name: 'عكس لقيد ملغى', expect: 'reversal.orphan', apply: (lg) => { lg.entries.push({ id: 'e14', date: '2026-02-06', tenant: 't1', status: 'posted', reversalOf: 'e13', lines: [{ acc: '1201', dr: 777, cr: 0 }, { acc: '5201', dr: 0, cr: 777 }] }); } },
  { name: 'ترحيل في فترة مقفلة', expect: 'period.locked', apply: (lg) => { lg.lockedThru = '2026-01-31'; lg.lockedAt = '2026-02-01T00:00:00Z'; lg.entries.push({ id: 'late', date: '2026-01-20', tenant: 't1', status: 'posted', postedAt: '2026-02-10T09:00:00Z', source: { type: 'pay', id: 'late' }, lines: [{ acc: '5201', dr: 50, cr: 0 }, { acc: '1101', dr: 0, cr: 50 }] }); } },
  { name: 'تحويل عملة خاطئ', expect: 'fx.conversion', apply: (lg) => { lg.entries.push({ id: 'fx1', date: '2026-02-07', tenant: 't1', status: 'posted', currency: 'USD', rate: 3.75, source: { type: 'inv', id: 'fx1' }, lines: [{ acc: '5201', dr: 370, cr: 0, fc: 100 }, { acc: '2101', dr: 0, cr: 370, fc: 100, party: 's3' }] }); } },
  { name: 'عملة أجنبية بلا سعر', expect: 'fx.rate', apply: (lg) => { lg.entries.push({ id: 'fx2', date: '2026-02-07', tenant: 't1', status: 'posted', currency: 'USD', source: { type: 'inv', id: 'fx2' }, lines: [{ acc: '5201', dr: 375, cr: 0, fc: 100 }, { acc: '2101', dr: 0, cr: 375, fc: 100, party: 's3' }] }); } },
  { name: 'كسر بثلاث خانات', expect: 'rounding.precision', apply: (lg) => { const e = ent(lg, 'e8'); e.lines[0].dr = 166.665; e.lines[1].cr = 166.665; } },
  { name: 'قيد منشأة أخرى', expect: 'tenant.isolation', apply: (lg) => { ent(lg, 'e7').tenant = 't2'; } },
  { name: 'حساب غير موجود', expect: 'posting.account-missing', apply: (lg) => { ent(lg, 'e7').lines[0].acc = '5999'; } },
  { name: 'ترحيل على حساب رئيسي', expect: 'posting.non-postable', apply: (lg) => { ent(lg, 'e1').lines[0].acc = '1000'; } },
  { name: 'سطر ذمم بلا طرف', expect: 'subledger.party', apply: (lg) => { delete ent(lg, 'e5').lines[2].party; } },
];

/** أخطاء في المخرجات المعلنة من النظام المختبَر (الدفتر سليم لكن التقرير خاطئ) */
export const REPORT_MUTATIONS = [
  { name: 'رصيد حساب معلن خاطئ', expect: 'balance.account', reported: () => ({ balances: { ...EXPECTED.balances, 1201: 92100 } }) },
  { name: 'حساب غائب عن الميزان', expect: 'gl-vs-tb', reported: () => ({ tb: Object.entries(EXPECTED.balances).filter(([a]) => a !== '1601').map(([acc, v]) => ({ acc, dr: v > 0 ? v : 0, cr: v < 0 ? -v : 0 })) }) },
  { name: 'رصيد مورد خاطئ', expect: 'subledger.match', reported: () => ({ subledger: { 2101: { s1: -6000, s2: -690 } } }) },
  { name: 'صافي ربح خاطئ', expect: 'statements.netIncome', reported: () => ({ statements: { ...EXPECTED.statements, netIncome: 442.67 } }) },
];
