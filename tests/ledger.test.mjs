/**
 * v56.9 — MUKTASAB FINANCE D1: دفتر القيود المخزّن (docs/finance/03-PHASE-D-LEDGER-DESIGN.md).
 * المفتاح والرقم والبصمة حتمية؛ النطاق قيود الإغلاقات المعتمدة من 2026-01-01؛ المطابقة تكشف الناقص والمختلف والزائد وغير المتطابق بالهللة.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let E = null, why = '';
try { const { buildEngine } = await import('./build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (npm ci): ' + String(e.message || e).split('\n')[0]; }
const run = (name, fn) => test(name, { skip: E ? false : why }, fn);

const org = () => ({ company: { name: 'ت' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], taxCfg: { enabled: true, rate: 15 } });
const cl = (id, date, status, tot = 1150) => ({ id, branchId: 'b1', branchName: 'فرع', date, status, totalRevenue: tot, cashSales: tot, cardSales: 0, deliverySales: [], expenses: [], totalExpenses: 0,
  variance: 0, actualCashCount: tot, expectedCashInSafe: tot, transferredToMainTreasury: 0, supplierPayments: [] });

run('المفتاح والرقم: حتميان وآمنان لمعرّف المستند', () => {
  assert.equal(E.flKey('rev:c1'), 'rev_c1_v1'); assert.equal(E.flKey('rev:c1', 2), 'rev_c1_v2');
  assert.match(E.flKey('a/b c#d'), /^[A-Za-z0-9_-]+$/);
  assert.equal(E.flNo(2026, 1), 'JV-2026-000001'); assert.equal(E.flNo(2026, 123456), 'JV-2026-123456'); assert.equal(E.flNo(2027, 1234567), 'JV-2027-1234567');
  assert.equal(E.FL_START, '2026-01-01'); assert.equal(E.flOn({}), false); assert.equal(E.flOn({ ledger: { on: true } }), true);
});

run('السجل: السطور بالهللات، المجموعان متساويان، والبصمة تتغير بتغير المبلغ فقط', () => {
  const A = E.buildAccounting(org(), { closings: [cl('c1', '2026-03-10', 'approved')] });
  const e = A.entries.find(x => x.id === 'rev:c1'); const R = E.flRecord(e);
  assert.equal(R.src, 'rev:c1'); assert.equal(R.date, '2026-03-10'); assert.equal(R.ver, 1);
  assert.equal(R.drH, 115000); assert.equal(R.crH, 115000);
  const codes = JSON.parse(R.lines).map(l => l[0]); assert.ok(codes.includes('4101') && codes.includes('2301') && codes.some(c => c.startsWith('11')), codes.join(','));
  assert.match(R.digest, /^[0-9a-f]{64}$/);
  assert.equal(E.flRecord(e).digest, R.digest, 'حتمية');
  const B = E.buildAccounting(org(), { closings: [cl('c1', '2026-03-10', 'approved', 1150.01)] });
  assert.notEqual(E.flRecord(B.entries.find(x => x.id === 'rev:c1')).digest, R.digest, 'هللة واحدة تغيّر البصمة');
});

run('النطاق: الإغلاقات المعتمدة فقط ومن 2026-01-01 — لا المرفوعة ولا المسودة ولا ما قبل البداية', () => {
  const ops = { closings: [cl('a', '2026-03-10', 'approved'), cl('s', '2026-03-11', 'submitted'), cl('d', '2026-03-12', 'draft'), cl('o', '2025-12-31', 'approved')],
    journalManual: [{ id: 'j', date: '2026-03-06', title: 'يدوي', lines: [{ code: '5901', debit: 25, credit: 0 }, { code: '1201', debit: 0, credit: 25 }] }] };
  const S = E.flScope(ops, E.buildAccounting(org(), ops));
  assert.deepEqual([...new Set(S.filter(e => !e.opening).map(e => e.ref))], ['a']);
});

run('المطابقة: ناقص · مختلف · زائد · غير متطابق بالهللة، والمعكوس لا يُعدّ', () => {
  const ops = { closings: [cl('a', '2026-03-10', 'approved'), cl('b', '2026-03-11', 'approved')] };
  const S = E.flScope(ops, E.buildAccounting(org(), ops));
  const rec = (e, x = {}) => ({ ...E.flRecord(e), status: 'posted', ...x });
  const ea = S.find(e => e.id === 'rev:a'), eb = S.find(e => e.id === 'rev:b');
  let C = E.flCompare(S, []); assert.equal(C.missing.length, 2); assert.equal(C.ok, false);
  C = E.flCompare(S, [rec(ea), rec(eb)]); assert.equal(C.ok, true); assert.equal(C.recs, 2);
  C = E.flCompare(S, [rec(ea), rec(eb, { digest: 'f'.repeat(64) })]); assert.deepEqual(C.differ.map(e => e.id), ['rev:b']);
  C = E.flCompare(S, [rec(ea), rec(eb), { src: 'rev:gone', status: 'posted', digest: 'a'.repeat(64), no: 'JV-2026-000009' }]); assert.equal(C.extra.length, 1);
  C = E.flCompare(S, [rec(ea), rec(eb, { status: 'reversed' })]); assert.deepEqual(C.missing.map(e => e.id), ['rev:b'], 'المعكوس ليس قيدًا قائمًا');
  const odd = { ...ea, id: 'x:1', lines: [{ code: '5901', debit: 10.01, credit: 0 }, { code: '1201', debit: 0, credit: 10 }] };
  C = E.flCompare([odd], []); assert.equal(C.bad.length, 1); assert.equal(C.missing.length, 0, 'غير المتوازن بالهللة لا يُعرض للترحيل');
});

run('D2 القيد الافتتاحي: أرصدة ما قبل 2026 بالهللات، والإيرادات والمصروفات صافيًا إلى الأرباح المبقاة 3201، وأول القيود', () => {
  const ops = { closings: [cl('o', '2025-12-20', 'approved'), cl('a', '2026-03-10', 'approved')],
    journalManual: [{ id: 'j', date: '2025-12-28', title: 'مصروف', lines: [{ code: '5901', debit: 200, credit: 0 }, { code: '1201', debit: 0, credit: 200 }] }] };
  const A = E.buildAccounting(org(), ops); const op = E.flOpening(A);
  assert.equal(op.id, 'open:2026'); assert.equal(op.date, '2026-01-01'); assert.equal(op.opening, true);
  const by = Object.fromEntries(op.lines.map(l => [l.code, Math.round((l.debit - l.credit) * 100)]));
  assert.equal(by['3201'], -80000, 'صافي ربح 2025 = إيراد 1000 − مصروف 200، دائنًا في الأرباح المبقاة');
  assert.equal(by['2301'], -15000, 'ضريبة المخرجات خصم يبقى بحسابه');
  assert.equal(by['4101'], undefined); assert.equal(by['5901'], undefined, 'لا حسابات نتيجة في الافتتاحي');
  const R = E.flRecord(op); assert.equal(R.drH, R.crH); assert.ok(R.drH > 0);
  const S = E.flScope(ops, A); assert.equal(S[0].id, 'open:2026', 'أول النطاق');
  assert.equal(S.filter(e => String(e.date) < '2026-01-01').length, 0, 'لا قيد من 2025 بنفسه');
  assert.equal(E.flOpening(E.buildAccounting(org(), { closings: [cl('a', '2026-03-10', 'approved')] })), null, 'لا حركة قبل البداية ⇒ لا افتتاحي');
});

run('D2 الأرصدة الافتتاحية من الإعداد: بتاريخ 2026 تدخل النطاق كما هي، وبتاريخ 2025 تذوب في القيد الافتتاحي', () => {
  const ob = (asOf) => ({ ...org(), openingBalances: { enabled: true, asOf, lines: [{ code: '1201', debit: 5000, credit: 0 }] } });
  const A1 = E.buildAccounting(ob('2026-01-01'), { closings: [] });
  assert.deepEqual(E.flScope({ closings: [] }, A1).map(e => e.id), ['opening']);
  const A2 = E.buildAccounting(ob('2025-12-31'), { closings: [] });
  const S2 = E.flScope({ closings: [] }, A2); assert.deepEqual(S2.map(e => e.id), ['open:2026']);
  const by = Object.fromEntries(S2[0].lines.map(l => [l.code, Math.round((l.debit - l.credit) * 100)]));
  assert.equal(by['1201'], 500000); assert.equal(by['3101'], -500000);
});

run('D3 المجموعات بترتيب المالك: البادئة تحدد المجموعة، والمستوى بين 1 و6', () => {
  assert.deepEqual(E.FL_GROUPS.map(g => g.id), ['closings', 'ap', 'payroll', 'stock', 'assets', 'close']);
  assert.equal(E.flGroupOf('rev:c1'), 0); assert.equal(E.flGroupOf('inv:p1'), 1); assert.equal(E.flGroupOf('sal-acc:2026-03'), 2);
  assert.equal(E.flGroupOf('stk-open'), 3); assert.equal(E.flGroupOf('dep:2026-03'), 4); assert.equal(E.flGroupOf('yearend-2026-12-31'), 5); assert.equal(E.flGroupOf('man:j1'), 5);
  assert.equal(E.flGroupOf('غريب:1'), null);
  assert.equal(E.flLvl({}), 1); assert.equal(E.flLvl({ ledger: { lvl: 3 } }), 3); assert.equal(E.flLvl({ ledger: { lvl: 99 } }), 6); assert.equal(E.flLvl({ ledger: { lvl: 0 } }), 1);
});

run('D3 النطاق يتسع بالمستوى: الفاتورة من المستوى 2، والإغلاق غير المعتمد لا يدخل أبدًا، ولا قيد غير مصنّف في المحرك', () => {
  const o = { ...org(), suppliers: [{ id: 's1', name: 'مورد' }] };
  const inv = { id: 'p1', kind: 'svc', supplierId: 's1', supplierName: 'مورد', branchId: 'b1', amount: 115, vatAmt: 15, taxable: true, date: '2026-03-10', paidAmount: 0,
    expLines: [{ desc: 'صيانة', accCode: '5101', net: 100, vat: 15 }] };
  const ops = { closings: [cl('a', '2026-03-10', 'approved'), cl('s', '2026-03-11', 'submitted')], invoices: [inv],
    journalManual: [{ id: 'j', date: '2026-03-06', title: 'يدوي', lines: [{ code: '5901', debit: 25, credit: 0 }, { code: '1201', debit: 0, credit: 25 }] }] };
  const A = E.buildAccounting(o, ops);
  const ids = (l) => E.flScope(ops, A, l).map(e => e.id);
  assert.ok(ids(1).includes('rev:a')); assert.ok(!ids(1).includes('inv:p1'));
  assert.ok(ids(2).includes('inv:p1')); assert.ok(!ids(5).includes('man:j')); assert.ok(ids(6).includes('man:j'));
  assert.ok(!ids(6).includes('rev:s'), 'المرفوع بانتظار التدقيق لا يُرحَّل');
  assert.deepEqual(E.flUnclassified(A).map(e => e.id), [], 'كل مصادر المحرك مصنّفة');
});

run('D3 القيد العكسي: من السطور المخزّنة نفسها معكوسة، متوازن، يشير للأصل، وبتاريخه وإصداره', () => {
  const A = E.buildAccounting(org(), { closings: [cl('a', '2026-03-10', 'approved')] });
  const e = A.entries.find(x => x.id === 'rev:a'); const r = { ...E.flRecord(e), id: 'rev_a_v1', no: 'JV-2026-000007', status: 'posted' };
  const X = E.flReversalOf(r);
  assert.equal(X.reversalOf, 'rev_a_v1'); assert.equal(X.date, r.date); assert.equal(X.ver, 1); assert.equal(X.src, 'rev:a');
  assert.equal(X.drH, r.crH); assert.equal(X.crH, r.drH); assert.equal(X.drH, X.crH);
  const L = JSON.parse(r.lines), Lx = JSON.parse(X.lines);
  L.forEach((l, i) => { assert.equal(Lx[i][0], l[0]); assert.equal(Lx[i][1], l[2]); assert.equal(Lx[i][2], l[1]); });
  assert.notEqual(X.digest, r.digest); assert.match(X.title, /عكس JV-2026-000007/);
  const C = E.flCompare([e], [{ ...r, digest: 'f'.repeat(64) }]); assert.equal(C.pairs.length, 1); assert.equal(C.pairs[0].r.id, 'rev_a_v1');
  const after = E.flCompare([e], [{ ...r, status: 'reversed' }, { ...X, id: 'rev_a_v1r', status: 'posted' }, { ...E.flRecord(e, 2), id: 'rev_a_v2', status: 'posted' }]);
  assert.equal(after.ok, true, 'بعد التصحيح: الإصدار 2 هو القائم، والعكس والأصل خارج المقارنة');
});

run('D4 القراءة من الدفتر: تُفعَّل فقط مع المجموعات الست، والميزان من السجلات = ميزان المحرك (حركة 2026 وأرصدة المركز المالي)', () => {
  assert.equal(E.flReadOn({ ledger: { on: true, read: true, lvl: 5 } }), false, 'قبل ضم المجموعات الست');
  assert.equal(E.flReadOn({ ledger: { on: false, read: true, lvl: 6 } }), false);
  assert.equal(E.flReadOn({ ledger: { on: true, read: true, lvl: 6 } }), true);
  const o = { ...org(), suppliers: [{ id: 's1', name: 'مورد' }] };
  const inv = { id: 'p1', kind: 'svc', supplierId: 's1', supplierName: 'مورد', branchId: 'b1', amount: 115, vatAmt: 15, taxable: true, date: '2026-03-12', paidAmount: 0,
    expLines: [{ desc: 'صيانة', accCode: '5101', net: 100, vat: 15 }] };
  const ops = { closings: [cl('o', '2025-12-20', 'approved'), cl('a', '2026-03-10', 'approved'), cl('s', '2026-03-11', 'submitted')], invoices: [inv],
    journalManual: [{ id: 'j', date: '2026-03-06', title: 'يدوي', lines: [{ code: '5901', debit: 25, credit: 0 }, { code: '1201', debit: 0, credit: 25 }] }] };
  const A = E.buildAccounting(o, ops); const S = E.flScope(ops, A, 6);
  const recs = S.map((e, i) => ({ ...E.flRecord(e), id: E.flKey(e.id), no: E.flNo(2026, i + 1), status: 'posted' }));
  const LE = E.flEntriesOf(recs);
  assert.equal(LE.find(e => e.src === 'open:2026').date, '2025-12-31', 'الافتتاحي في رصيد أول المدة');
  assert.ok(LE.every(e => e.fromLedger && e.lines.length));
  const eng = E.acctActivity({ ...A, entries: A.entries.filter(e => !(e.ref === 's')) }, { from: '2026-01-01', to: '2026-12-31' });
  const led = E.acctActivity({ ...A, entries: LE }, { from: '2026-01-01', to: '2026-12-31' });
  const mv = (T) => Object.fromEntries(T.rows.filter(r => r.debit || r.credit).map(r => [r.code, [r.debit, r.credit]]));
  assert.deepEqual(mv(led), mv(eng), 'حركة الفترة متطابقة حسابًا حسابًا');
  const bsClose = (T) => Object.fromEntries(T.rows.filter(r => r.kind === 'asset' || r.kind === 'liab').map(r => [r.code, r.close]));
  assert.deepEqual(bsClose(led), bsClose(eng), 'أرصدة الأصول والخصوم الختامية متطابقة');
  assert.equal(led.balanced, true);
  assert.deepEqual(E.flBalDiff(S, LE, '2026-12-31'), [], 'لا فرق');
  const tampered = LE.map(e => e.src === 'rev:a' ? { ...e, lines: e.lines.map(l => l.code === '4101' ? { ...l, credit: l.credit - 1 } : l) } : e);
  assert.deepEqual(E.flBalDiff(S, tampered, '2026-12-31').map(d => d.code), ['4101'], 'أي عبث يظهر في التنبيه');
  const withRev = [...recs.map(r => r.src === 'rev:a' ? { ...r, status: 'reversed' } : r),
    { ...E.flReversalOf(recs.find(r => r.src === 'rev:a')), id: 'x_r', no: 'JV-2026-000090', status: 'posted' },
    { ...recs.find(r => r.src === 'rev:a'), id: 'rev_a_v2', no: 'JV-2026-000091', ver: 2 }];
  assert.deepEqual(E.flBalDiff(S, E.flEntriesOf(withRev), '2026-12-31'), [], 'الأصل المعكوس وعكسه يتقابلان');
});
