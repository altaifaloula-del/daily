/**
 * v56.0 — اختبارات قبول هوية المنشآت (أمر التصميم v56.0، القسم الثاني عشر) على المحرك الحقيقي.
 * منشأتان بهويتين مختلفتين ⇒ كل مستند يحمل هوية منشأته وحدها، ولا تُفرض هوية MUKTASAB، والأرقام لا تتغير.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const PNG_A = 'data:image/png;base64,' + Buffer.from('tenant-A-logo').toString('base64');
const PNG_B = 'data:image/png;base64,' + Buffer.from('tenant-B-logo').toString('base64');
const PNG_BR = 'data:image/png;base64,' + Buffer.from('branch-logo').toString('base64');
const orgA = { company: { name: 'مطاعم الواحة', taxNumber: '300000000000003', address: 'الرياض' }, branches: [{ id: 'b1', name: 'العليا', logoUrl: PNG_BR }, { id: 'b2', name: 'النخيل' }],
  branding: { nameAr: 'مطاعم الواحة', nameEn: 'Oasis Restaurants', logo: PNG_A, colors: { primary: '#0B6E4F', accent: '#C08A2E', heading: '#073B2A', text: '#1A1A1A' }, footer: 'شكرًا لتعاملكم مع الواحة', footerEn: 'Thank you — Oasis' } };
const orgB = { company: { name: 'مخابز السنبلة', taxNumber: '311111111111113' }, branches: [{ id: 'x1', name: 'الملز' }],
  branding: { nameAr: 'مخابز السنبلة', nameEn: 'Sunbula Bakeries', logo: PNG_B, colors: { primary: '#7A1F5C' }, footer: 'السنبلة — طازج يوميًا' } };
const spec = (x = {}) => ({ id: 't', title: 'قائمة الدخل', lang: 'ar', columns: [{ key: 'n', label: 'البند', en: 'Line' }, { key: 'v', label: 'المبلغ', en: 'Amount', type: 'money', total: 'sum' }],
  rows: [{ n: 'إيراد', v: 1000 }, { n: 'مصروف', v: -300 }], meta: { user: 'م', at: '2026-04-01T09:00:00Z' }, ...x });

test('tbNorm: يعقّم كل الحقول — ألوان HEX فقط، صور https/data:image فقط بحد حجم، نصوص بلا وسوم', () => {
  const n = E.tbNorm({ nameAr: '<script>x</script>مطعم', colors: { primary: 'red', accent: '#abcdef', heading: '#12345' }, logo: 'javascript:alert(1)', logoAlt: 'data:text/html;base64,AAAA',
    logoDoc: 'https://cdn.example.com/l.png" onerror="x', print: { paper: 'B5', mono: 'yes' }, invoiceTpl: 'evil', extra: { a: 1 } });
  assert.equal(n.nameAr, 'scriptx/scriptمطعم'); assert.deepEqual(n.colors, { accent: '#ABCDEF' });
  assert.equal(n.logo, ''); assert.equal(n.logoAlt, ''); assert.equal(n.logoDoc, '');
  assert.deepEqual(n.print, { paper: 'A4', mono: false, showLogo: true, showContact: true }); assert.equal(n.invoiceTpl, 'classic'); assert.equal(n.extra, undefined);
  assert.equal(E.tbNorm({ logo: 'data:image/png;base64,' + 'A'.repeat(500000) }).logo, '', 'فوق الحد');
  assert.equal(E.tbNorm({ logo: PNG_A }).logo, PNG_A);
});

test('tenantBrand: توافق رجعي مع بيانات الشركة، وشعار الفرع يغلب في مستندات الفرع، والاسم حسب اللغة', () => {
  const old = E.tenantBrand({ company: { name: 'شركة قديمة', logoUrl: PNG_A, taxNumber: '3001' } });
  assert.equal(old.name, 'شركة قديمة'); assert.equal(old.logoDoc, PNG_A); assert.equal(old.vat, '3001'); assert.deepEqual(old.colors, { ...E.TB_NEUTRAL }); assert.equal(old.custom, false);
  assert.equal(E.tenantBrand(orgA, { branchId: 'b1' }).logoDoc, PNG_BR, 'شعار فرع العليا');
  assert.equal(E.tenantBrand(orgA, { branchId: 'b2' }).logoDoc, PNG_A, 'فرع بلا شعار ⇒ شعار المنشأة');
  assert.equal(E.tenantBrand(orgA, { lang: 'en' }).name, 'Oasis Restaurants'); assert.equal(E.tenantBrand(orgA, { lang: 'en' }).altName, 'مطاعم الواحة');
  assert.equal(E.tenantBrand(orgA).footer, 'شكرًا لتعاملكم مع الواحة'); assert.equal(E.tenantBrand(orgA, { lang: 'en' }).footer, 'Thank you — Oasis');
});

test('قبول 2–5: منشأتان بهويتين — كل تقرير يحمل شعار منشأته واسمها وألوانها وتذييلها فقط', () => {
  const a = E.rptHtml(orgA, spec()), b = E.rptHtml(orgB, spec());
  assert.ok(a.includes(PNG_A) && !a.includes(PNG_B), 'شعار الواحة فقط'); assert.ok(b.includes(PNG_B) && !b.includes(PNG_A), 'شعار السنبلة فقط');
  assert.ok(a.includes('مطاعم الواحة') && !a.includes('السنبلة')); assert.ok(b.includes('مخابز السنبلة') && !b.includes('الواحة'));
  assert.match(a, /--tb-p:#0B6E4F/); assert.match(b, /--tb-p:#7A1F5C/);
  assert.ok(a.includes('شكرًا لتعاملكم مع الواحة') && !b.includes('شكرًا لتعاملكم'));
  // تغيير هوية الأولى لا يمس الثانية (لا حالة مشتركة)
  const a2 = E.rptHtml({ ...orgA, branding: { ...orgA.branding, colors: { primary: '#000000' } } }, spec());
  assert.match(a2, /--tb-p:#000000/); assert.equal(E.rptHtml(orgB, spec()), b);
});

test('قبول: لا تُفرض ألوان MUKTASAB على مستندات المنشأة (تقرير أو مستند) — ولا يظهر شعار المنصة فيها', () => {
  for (const html of [E.rptHtml(orgA, spec()), E.rptHtml({ company: { name: 'بلا هوية' } }, spec())]) {
    assert.doesNotMatch(html, /#10294A|#091A30/i, 'لا كحلي MUKTASAB'); assert.doesNotMatch(html, /data-mq-symbol|mithqal-symbol/, 'لا رمز المنصة');
  }
  const shell = E.rptShell ? E.rptShell(orgA, 'سند', '', '<p>x</p>') : null;
  if (shell) { assert.doesNotMatch(shell, /#10294A/i); assert.ok(shell.includes(PNG_A)); }
});

test('قبول 5–7: الأرقام لا تتغير مع الهوية — الإجمالي نفسه في HTML وExcel وCSV لكل منشأة', () => {
  const T = E.rptTotals(spec()); assert.equal(T.v, 700);
  for (const o of [orgA, orgB, {}]) { const h = E.rptHtml(o, spec()); assert.ok(h.includes('700.00'), 'الإجمالي المطبوع'); }
  const X = E.rptXlsxRows(orgA, spec()); assert.equal(X.rows[0][0].v, 'مطاعم الواحة', 'Excel باسم المنشأة');
  const XB = E.rptXlsxRows(orgB, spec({ lang: 'en' })); assert.equal(XB.rows[0][0].v, 'Sunbula Bakeries');
  const last = X.rows[X.rows.length - 1]; assert.equal(last[1].v, 700); assert.match(last[1].f, /^SUM\(/, 'صيغة Excel حقيقية');
  assert.ok(E.rptCsv(spec()).includes('1000') && E.rptCsv(spec()).includes('-300'), 'CSV بالقيم الخام');
});

test('قبول 9–10: العربية RTL والإنجليزية LTR بهوية المنشأة، والطباعة الأحادية تحوّل الألوان والشعار للرمادي', () => {
  const ar = E.rptHtml(orgA, spec()), en = E.rptHtml(orgA, spec({ lang: 'en' }));
  assert.match(ar, /dir="rtl"/); assert.match(en, /dir="ltr"/); assert.match(en, /Oasis Restaurants/); assert.match(en, /Page/);
  const mono = E.rptHtml({ ...orgA, branding: { ...orgA.branding, print: { mono: true } } }, spec());
  assert.match(mono, /--tb-p:#222222/); assert.match(mono, /filter:grayscale\(1\)/); assert.doesNotMatch(mono, /--tb-p:#0B6E4F/);
  assert.match(E.rptHtml(orgA, spec({ mono: true })), /--tb-p:#222222/, 'الأحادي لكل طباعة على حدة');
  assert.match(E.rptHtml({ ...orgA, branding: { ...orgA.branding, print: { paper: 'Letter' } } }, spec()), /size:Letter portrait/);
});

test('القوالب الستة بمعرّفاتها القائمة وأسمائها البديلة — وكلها بالأرقام نفسها', () => {
  for (const [t, k] of [['list', 'list'], ['statement', 'statement'], ['financial', 'statement'], ['ledger', 'ledger'], ['summary', 'summary'], ['document', 'document'], ['official', 'document'], ['matrix', 'matrix'], ['pivot', 'matrix'], ['bogus', 'list']]) {
    const h = E.rptHtml(orgA, spec({ template: t })); assert.match(h, new RegExp('data-template="' + k + '"'), t); assert.ok(h.includes('700.00'), t + ' الإجمالي');
  }
  const led = E.rptHtml(orgA, spec({ template: 'ledger', opening: 50, closing: 750 }));
  assert.match(led, /الرصيد الافتتاحي[\s\S]*50\.00/); assert.match(led, /الرصيد الختامي[\s\S]*750\.00/);
  const doc = E.rptHtml(orgA, spec({ template: 'document' })); assert.match(doc, /أعدّه[\s\S]*اعتمده[\s\S]*الختم/);
  const sum = E.rptHtml(orgA, spec({ template: 'summary', kpis: [{ label: 'الإيراد', value: '1,000', delta: '+12%' }, { label: 'الربح', value: '700', delta: '-3%' }] }));
  assert.match(sum, /class="up">\+12%/); assert.match(sum, /class="dn">-3%/);
});

test('الجدول المحوري: مجموع القيم المعطاة لكل فرع×شهر مع إجماليات الصف والعمود — عرض فقط بلا حساب محاسبي', () => {
  const rows = [{ br: 'العليا', m: '2026-01', v: 100 }, { br: 'العليا', m: '2026-02', v: 50 }, { br: 'النخيل', m: '2026-01', v: 30 }, { br: 'العليا', m: '2026-01', v: 20 }];
  const P = E.rptPivot({ rows, pivot: { row: 'br', col: 'm', val: 'v', rowLabel: 'الفرع' } });
  assert.deepEqual(P.columns.map(c => c.label), ['الفرع', '2026-01', '2026-02', 'الإجمالي']);
  assert.deepEqual(P.rows.map(r => [r._r, r._c0, r._c1, r._t]), [['العليا', 120, 50, 170], ['النخيل', 30, 0, 30]]);
  assert.equal(E.rptTotals(P)._t, 200, 'الإجمالي العام = مجموع القيم');
  const h = E.rptHtml(orgA, { title: 'مبيعات', template: 'pivot', rows, pivot: { row: 'br', col: 'm', val: 'v', rowLabel: 'الفرع' } });
  assert.match(h, /data-template="matrix"/); assert.ok(h.includes('200.00'));
});

test('الدليل العام لأجهزة الفروع يحمل هوية المنشأة المعقّمة — بلا أسرار', () => {
  const d = E.dirOf({ ...orgA, branding: { ...orgA.branding, logo: 'javascript:x', secret: 'k' }, employees: [{ id: 'e', baseSalary: 9000 }] });
  assert.equal(d.branding.nameEn, 'Oasis Restaurants'); assert.equal(d.branding.logo, ''); assert.equal(d.branding.secret, undefined);
  assert.ok(!JSON.stringify(d).includes('9000'));
});

test('ثبات هوية المنصة: الرمز في الواجهة من الهندسة الموحّدة، ولا إعداد منشأة يغيّره', async () => {
  const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const bs = src.slice(src.indexOf('const BrandSymbol = '), src.indexOf('const BRAND_MARK'));
  assert.doesNotMatch(bs, /org\b|branding|tenant/i, 'BrandSymbol لا يقرأ بيانات المنشأة');
  const { mqSymbolShapes } = await import('../brand-geom.js');
  assert.equal(mqSymbolShapes().outer.length, 3); assert.equal(mqSymbolShapes().inner.length, 1); assert.equal(mqSymbolShapes().minor.length, 4);   // v56.0 (إعادة التسمية) البوصلة
});

const INV = { id: 'si1', kind: 'invoice', type: 'simplified', no: 'INV-2026-00001', date: '2026-04-02', time: '10:30', branchId: 'b1', icv: 7, hash: 'a'.repeat(64),
  lines: [{ desc: 'وجبة', qty: 2, price: 50, net: 100, vatRate: 15, vat: 15 }], net: 100, vat: 15, total: 115, buyer: { name: 'عميل' } };

test('قوالب الفاتورة الثلاثة: classic/modern/compact حسب إعداد المنشأة — والأرقام والرمز الضريبي نفسها', () => {
  const html = (tpl) => E.salesInvoiceHtml({ ...orgA, branding: { ...orgA.branding, invoiceTpl: tpl } }, INV);
  for (const t of ['classic', 'modern', 'compact']) {
    const h = html(t); assert.match(h, new RegExp('data-inv-tpl="' + t + '"')); assert.match(h, /115\.00/); assert.match(h, /INV-2026-00001/); assert.match(h, /<svg/, 'رمز QR');
  }
  assert.match(html('bogus'), /data-inv-tpl="classic"/, 'قيمة غير معروفة ⇒ الكلاسيكي');
  assert.match(html('modern'), /\.inv-modern \.h\{background:var\(--tb-p\)/);
  assert.doesNotMatch(html('modern'), /#10294A/i, 'لا ألوان المنصة في فاتورة المنشأة');
});

test('هوية الفرع: لون الفرع يغلب في مستنداته وفواتيره فقط، والقيمة غير الصالحة تُتجاهل', () => {
  const o = { ...orgA, branches: [{ id: 'b1', name: 'العليا', brandColor: '#aa3300' }, { id: 'b2', name: 'النخيل', brandColor: 'red' }] };
  assert.equal(E.tenantBrand(o, { branchId: 'b1' }).colors.primary, '#AA3300');
  assert.equal(E.tenantBrand(o, { branchId: 'b2' }).colors.primary, '#0B6E4F', 'غير صالح ⇒ لون المنشأة');
  assert.equal(E.tenantBrand(o).colors.primary, '#0B6E4F', 'بلا فرع ⇒ لون المنشأة');
  assert.match(E.salesInvoiceHtml(o, INV), /--tb-p:#AA3300/, 'فاتورة فرع العليا بلونه');
  assert.match(E.rptHtml(o, spec({ meta: { branchId: 'b1', user: 'م', at: '2026-04-01T09:00:00Z' } })), /--tb-p:#AA3300/);
  assert.equal(E.dirOf(o).branches.find(b => b.id === 'b2').brandColor, '', 'الدليل يحمل اللون المعقّم');
});

test('الجدول المحوري التفاعلي: ناتج rptPivot جدول عادي لا يُحوَّل ثانية عند الطباعة، وتبديل الصفوف والأعمدة يحفظ الإجمالي', () => {
  const rows = [{ br: 'العليا', m: '2026-01', v: 100 }, { br: 'النخيل', m: '2026-02', v: 30 }, { br: 'العليا', m: '2026-02', v: 20 }];
  const P = E.rptPivot({ title: 'x', template: 'pivot', rows, pivot: { row: 'br', col: 'm', val: 'v', rowLabel: 'الفرع' } });
  assert.equal(P.pivot, undefined); assert.equal(P.template, 'matrix');
  const h = E.rptHtml(orgA, P); assert.ok(h.includes('150.00'), 'طباعة الناتج المحوري كما هو');
  const S = E.rptPivot({ title: 'x', template: 'pivot', rows, pivot: { row: 'm', col: 'br', val: 'v' } });
  assert.deepEqual(S.columns.map(c => c.label).slice(1, 3), ['العليا', 'النخيل']); assert.equal(E.rptTotals(S)._t, E.rptTotals(P)._t);
});
