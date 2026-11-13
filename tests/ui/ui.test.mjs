/**
 * اختبارات الواجهة (v38.2) — تُشغَّل آليًا قبل كل نشر؛ أي انهيار شاشة أو تجاوز عرض الجوال أو رقم هندي أو خلل في تدفق رقابي يوقف النشر.
 *   ١) كل الشاشات (المراكز + أقسام المحاسبة + التطبيقات) على iPhone 13 والحاسوب: لا انهيار، لا أخطاء، لا تجاوز أفقي، لا أرقام هندية.
 *   ٢) تدفقات الرقابة: إدخال الأرقام العربية، ضبط الهدر، الجرد الأعمى، معامل الناتج، تنبيه سعر الشراء، دور مراقب التكاليف.
 * التشغيل: npm run test:ui
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import { chromium, devices } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = path.join(root, 'tests', '.cache');
const AR_DIGITS = /[٠-٩۰-۹٪-٬]/;

let server, browser, base;
before(async () => {
  fs.mkdirSync(cache, { recursive: true });
  // v38.3: يُبنى بـ Vite وبإعدادات المنصة نفسها (تقسيم الحزم والتحميل الكسول) — يختبر الشكل المنشور فعلًا
  const out = path.join(cache, 'ui');
  await viteBuild({ configFile: path.join(root, 'vite.config.js'), root, base: './', logLevel: 'error', define: { 'import.meta.env.VITE_ZATCA_ENDPOINT': JSON.stringify('http://zatca.test') },
    build: { outDir: out, emptyOutDir: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: path.join(root, 'tests', 'ui', 'fixture.html') } } });
  server = http.createServer((q, r) => { const f = path.join(cache, 'ui', decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\//, ''));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); r.end(d); }); });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  base = 'http://127.0.0.1:' + server.address().port + '/tests/ui/fixture.html#';
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

const open = async (ctxOpt, hash) => {
  const ctx = await browser.newContext(ctxOpt); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(base + hash); await p.waitForTimeout(400); await settle(p);
  return { p, errs, ctx };
};
// انتظار انتهاء تحميل التطبيقات الكسولة (مؤشر «جارٍ تحميل التطبيق…»)
const settle = async (p) => { await p.waitForFunction(() => !document.querySelector('.mod-loading'), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(150); };
const say = (p) => p.evaluate(() => window.lastSay);
const cur = (p, fn) => p.evaluate(fn);

test('كل الشاشات: بلا انهيار ولا أخطاء ولا تجاوز لعرض الجوال ولا أرقام هندية', { timeout: 600000, skip: !!process.env.UI_QUICK }, async () => {
  const { p: p0, ctx: c0 } = await open({}, 'comp/Launcher');
  const routes = await p0.evaluate(() => window.routes); await c0.close();
  assert.ok(routes.length >= 70, 'عدد الشاشات ' + routes.length);
  const bad = [];
  for (const [dev, opt] of [['جوال', devices['iPhone 13']], ['حاسوب', { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await browser.newContext(opt);
    for (const r of routes) {
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120))); p.on('dialog', d => d.dismiss().catch(() => {}));
      await p.goto(base + r); await p.waitForTimeout(300); await settle(p);
      const m = await p.evaluate(() => ({ crash: document.getElementById('crash')?.innerText || '', over: document.documentElement.scrollWidth - window.innerWidth,
        ar: (document.body.innerText.match(/.{0,20}[٠-٩۰-۹٪-٬].{0,10}/) || [''])[0] }));
      if (m.crash) bad.push(dev + ' ' + r + ' — ' + m.crash.slice(0, 120));
      if (errs.length) bad.push(dev + ' ' + r + ' — خطأ: ' + errs[0]);
      if (dev === 'جوال' && m.over > 2) bad.push(dev + ' ' + r + ' — تجاوز أفقي ' + m.over + 'px');
      if (m.ar) bad.push(dev + ' ' + r + ' — رقم هندي: «' + m.ar + '»');
      await p.close();
    }
    await ctx.close();
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('إدخال الأرقام: الأرقام العربية والفاصلة «٫» تُحوَّل، والنقطة لا تتكرر، والتفقيط يظهر', async () => {
  const { p, errs, ctx } = await open(devices['iPhone 13'], 'live/BranchWarehouse/bm');
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click();
  const q = p.locator('.card input[placeholder="الكمية"]').first();
  await q.focus(); await p.keyboard.type('١٢٫٥');
  assert.equal(await q.inputValue(), '12.5');
  await q.fill(''); await q.focus(); await p.keyboard.type('1.2.3');
  assert.equal(await q.inputValue(), '1.23');
  await q.fill(''); await q.focus(); await p.keyboard.type('١٥٠٠٠');
  await p.waitForTimeout(150);
  const tip = await p.evaluate(() => { const t = document.querySelector('.num-tip'); return t && getComputedStyle(t).display !== 'none' ? t.innerText : ''; });
  assert.match(tip, /15,000/); assert.match(tip, /خمسة عشر ألفًا/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('ضبط الهدر: سبب إلزامي، صورة فوق الحد، وفوق حد الاعتماد معلّق لا يُخصم حتى يعتمده شخص آخر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/BranchWarehouse/bm');
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click();
  await p.click('button:has-text("هدر/إتلاف")');
  const fill = async (item, qty) => { await p.locator('.card select').first().selectOption(item); await p.locator('.card input[placeholder="الكمية"]').first().fill(String(qty)); };
  const submit = async () => { await p.click('button:has-text("تسجيل هدر/إتلاف")'); await p.waitForTimeout(250); return say(p); };
  await fill('i2', 5);
  assert.equal(await submit(), 'اختر سبب الهدر');
  await p.click('button:has-text("خطأ تحضير")');
  assert.equal(await submit(), 'سُجّل الهدر ✓');                                   // 5 × 4 = 20 < حد الصورة
  await fill('i1', 3); await p.click('button:has-text("تلف بالتخزين/التبريد")');
  assert.match(await submit(), /أرفق صورة التالف/);                                 // 3 × 40 = 120 ≥ 50
  await p.setInputFiles('.wst-box input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await p.waitForTimeout(400);
  assert.equal(await submit(), 'سُجّل الهدر ✓');
  await fill('i1', 10); await p.click('button:has-text("منتهي الصلاحية")');
  await p.setInputFiles('.wst-box input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await p.waitForTimeout(400);
  assert.match(await submit(), /أُرسل الهدر للاعتماد/);                             // 400 ≥ 300
  let s = await cur(p, () => ({ w: window.cur.whMoves.filter(m => m.kind === 'waste').length, r: window.cur.wasteRequests.map(r => r.status) }));
  assert.deepEqual(s, { w: 2, r: ['pending'] }, 'المعلّق لا يُنشئ حركة');
  assert.equal(await p.locator('.wst-pend button:has-text("اعتماد")').count(), 0, 'مدير الفرع لا يعتمد');
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click();
  await p.click('.wst-pend button:has-text("اعتماد")'); await p.waitForTimeout(300);
  assert.equal(await say(p), 'اعتُمد الهدر ورُحّل ✓');
  s = await cur(p, () => ({ w: window.cur.whMoves.filter(m => m.kind === 'waste').map(m => m.wasteVal).sort((a, b) => a - b), r: window.cur.wasteRequests[0].status, by: window.cur.wasteRequests[0].decidedBy }));
  assert.deepEqual(s, { w: [20, 120, 400], r: 'approved', by: 'سارة' });
  assert.deepEqual(errs, []); await ctx.close();
});

test('الجرد الأعمى: لا رصيد للعادّ، إعادة عدّ خارج التسامح، ولا يعتمد العادّ جرده', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/BranchWarehouse/bm');
  assert.equal(await p.locator('.tb thead th:has-text("الرصيد")').count(), 0, 'تبويب الأرصدة بلا كميات لموظف الفرع');
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click(); await p.locator('.card select').first().selectOption('i1');
  assert.equal(await p.locator('text=المتاح').count(), 0, 'لا «المتاح» في نموذج الصرف');
  await p.getByRole('button', { name: 'الجرد', exact: true }).first().click(); await p.waitForTimeout(200);
  await p.click('button:has-text("جرد كامل")');
  assert.equal(await p.locator('.tb thead').first().innerText().then(x => x.includes('الدفتري')), false, 'العمود الدفتري مخفي');
  const ins = p.locator('.tb tbody input'); await ins.nth(0).fill('45'); await ins.nth(1).fill('99.5');
  await p.click('button:has-text("تسليم العدّ للاعتماد")'); await p.waitForTimeout(300);
  assert.match(await say(p), /خارج التسامح/);
  await p.locator('.tb tbody input').first().fill('46'); await p.click('button:has-text("تسليم إعادة العدّ")'); await p.waitForTimeout(300);
  assert.equal(await p.locator('button:has-text("اعتماد وتسجيل التسويات")').count(), 0, 'العادّ لا يرى زر الاعتماد');
  await p.evaluate(() => window.as('bm2')); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'الجرد', exact: true }).first().click(); await p.waitForTimeout(200);
  await p.click('button:has-text("اعتماد وتسجيل التسويات")'); await p.waitForTimeout(300);
  const adj = await cur(p, () => window.cur.whMoves.filter(m => m.kind === 'adjust').map(m => [m.itemId, m.qty, m.approvedBy]).sort());
  assert.deepEqual(adj, [['i1', -4, 'سعد'], ['i2', -0.5, 'سعد']]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('معامل الناتج: تكلفة الوصفة على الكمية الخام (0.41 كجم بناتج 82% = 0.5 كجم × 40 = 20)', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/recipes');
  const card = (await p.locator('.card:has-text("مندي لحم")').last().innerText()).replace(/\s+/g, ' ');
  assert.match(card, /ناتج 82% · يُصرف 0.5 كجم/);
  assert.match(card, /تكلفة المنتج 20.40/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('مراقب التكاليف: يعتمد ويراقب بلا إضافة أو تعديل', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/ctl/waste');
  assert.equal(await p.locator('.card:has-text("ضوابط الهدر") button:has-text("تعديل")').count(), 0, 'لا يعدّل الحدود');
  await p.evaluate(() => window.as('ctl')); await p.waitForTimeout(200);
  assert.equal(await p.locator('button:has-text("صنف جديد")').count(), 0);
  await ctx.close();
  const w = await open({ viewport: { width: 1300, height: 1300 } }, 'live/BranchWarehouse/ctl');
  const nav = await w.p.locator('.card').first().innerText();
  await w.p.getByRole('button', { name: 'الجرد', exact: true }).first().click(); await w.p.waitForTimeout(200);
  assert.equal(await w.p.locator('button:has-text("تسليم العدّ للاعتماد")').count(), 0, 'المراقب لا يعدّ');
  errs.push(...w.errs); await w.ctx.close();
  assert.ok(!nav.includes('طلب من الرئيسي') && nav.includes('الجرد'), 'أقسام المستودع للمراقب: الأرصدة والهدر والجرد فقط');
  assert.deepEqual(errs, []);
});

test('الفوترة الإلكترونية: بيانات المنشأة ثم تسجيل جهاز فرع بالرمز المؤقت — والرمز لا يُخزَّن', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let sent = null;
  await p.route('http://zatca.test/api/zatca/config', r => r.fulfill({ json: { vault: true, envs: ['sandbox', 'simulation'], canOnboard: true } }));
  await p.route('http://zatca.test/api/zatca/onboard', r => { sent = JSON.parse(r.request().postData()); r.fulfill({ json: { ok: true,
    steps: ['المفاتيح وطلب الشهادة', 'شهادة الامتثال', 'امتثال: فاتورة ضريبية', 'امتثال: إشعار دائن ضريبي', 'امتثال: إشعار مدين ضريبي', 'امتثال: فاتورة مبسّطة', 'امتثال: إشعار دائن مبسّط', 'امتثال: إشعار مدين مبسّط', 'شهادة الإنتاج'].map(k => ({ k, ok: true, detail: 'PASS' })),
    egs: { env: 'simulation', egsId: 'b1', vault: 'v1.aaa.bbb.ccc', cert: { serial: '123456789012', issuer: 'CN=TEST', validTo: 'Jan  9 09:19:30 2029 GMT' }, icv: 0, pih: 'X' } } }); });
  await p.goto(base + 'live/Accounting/admin/einv'); await p.waitForTimeout(400); await settle(p);
  assert.match(await p.locator('.card:has-text("بيانات المنشأة في الفاتورة")').innerText(), /ناقص قبل التسجيل/);
  assert.equal(await p.locator('button:has-text("تسجيل الجهاز")').first().isDisabled(), true, 'لا تسجيل قبل اكتمال البيانات');
  await p.click('.card:has-text("بيانات المنشأة في الفاتورة") button:has-text("تعديل")');
  const fl = async (lbl, v) => p.locator(`.fld:has(.lbl:text-is("${lbl}")) input`).fill(v);
  await fl('السجل التجاري', '1010010000'); await fl('رقم المبنى', '1234'); await fl('الشارع', 'طريق الملك فهد'); await fl('الحي', 'العليا'); await fl('المدينة', 'الرياض'); await fl('الرمز البريدي', '12345');
  await p.click('button:has-text("حفظ")'); await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(() => window.curOrg.einvCfg.address), { building: '1234', street: 'طريق الملك فهد', district: 'العليا', city: 'الرياض', postal: '12345' });
  await p.locator('button:has-text("تسجيل الجهاز")').first().click();
  await p.locator('.einv-otp').focus(); await p.keyboard.type('١٢٣٤٥٦');   // أرقام عربية من لوحة الجوال
  await p.click('.modal button:has-text("تسجيل")'); await p.waitForTimeout(400);
  assert.equal(sent.otp, '123456'); assert.equal(sent.env, 'simulation'); assert.equal(sent.seller.crn, '1010010000'); assert.equal(sent.branch.id, 'b1');
  assert.equal(await p.locator('.einv-step.ok').count(), 9);
  const saved = await p.evaluate(() => window.curOrg.zatcaEgs.b1.simulation);
  assert.equal(saved.vault, 'v1.aaa.bbb.ccc'); assert.equal(saved.cert.serial, '123456789012');
  assert.ok(!JSON.stringify(await p.evaluate(() => window.curOrg)).includes('123456"'), 'الرمز المؤقت لا يُحفظ في بيانات المنشأة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('صيانة النظام: حالة الخدمات وفحوص السلامة وسجل الأخطاء تظهر بلا أعطال', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Admin/admin'); await p.waitForTimeout(400); await settle(p);
  await p.click('button:has-text("صيانة النظام")'); await p.waitForTimeout(300); await settle(p);
  const txt = await p.locator('#r').innerText();
  for (const s of ['حالة الخدمات', 'فحوص سلامة البيانات', 'توازن القيود وميزان المراجعة', 'أرصدة مخزون سالبة', 'سجل أخطاء الأجهزة']) assert.ok(txt.includes(s), 'يظهر: ' + s);
  assert.ok(await p.locator('.mt-check').count() >= 7);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'بلا تجاوز عرض على الجوال');
  assert.deepEqual(errs, []); await ctx.close();
});

test('الأنماط الشاذة: الشاشة تظهر في مركز التحليل وتعرض النتائج أو «لا أنماط» بلا أعطال', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'hub/analytics/anomaly'); await p.waitForTimeout(400); await settle(p);
  const txt = await p.locator('#r').innerText();
  assert.ok(txt.includes('ما خرج عن النمط المعتاد'), 'عنوان الشاشة'); assert.ok(txt.includes('كيف يُحسب؟'));
  assert.ok(txt.includes('لا أنماط شاذة') || (await p.locator('.an-item').count()) > 0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('الإجراءات والتوصيات: إنشاء ← بدء ← إنجاز بملاحظة إلزامية، وفريق الفرع يرى إجراءات فرعه فقط', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/analytics:actions'); await p.waitForTimeout(400); await settle(p);
  const mk = async (title, branchLabel) => { await p.click('button:has-text("إجراء جديد")'); await p.waitForTimeout(200);
    await p.locator('.fld:has(.lbl:text-is("العنوان")) input').fill(title);
    await p.locator('.fld:has(.lbl:text-is("الفرع")) select').selectOption({ label: branchLabel });
    await p.locator('.fld:has(.lbl:text-is("المسؤول")) select').selectOption({ label: 'أحمد علي' });
    await p.locator('.fld:has(.lbl:text-is("الموعد")) input').fill('2020-01-01');
    await p.click('.modal button:has-text("إنشاء")'); await p.waitForTimeout(250); };
  await mk('مراجعة جدول المطبخ', 'عم قاسم طيبة'); await mk('صيانة ثلاجة', 'العليا');
  assert.equal(await p.locator('.act-item').count(), 2);
  assert.equal(await p.locator('.act-item.late').count(), 2, 'الموعد الماضي ← متأخر');
  const first = p.locator('.act-item:has-text("مراجعة جدول المطبخ")');
  await first.locator('button:has-text("بدء التنفيذ")').click(); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(200);
  await first.locator('button:has-text("إنجاز")').click(); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(150);
  assert.match(await p.evaluate(() => window.lastSay), /اكتب ما الذي نُفّذ/);
  await p.locator('.modal textarea').fill('أُعيد توزيع الورديات'); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(250);
  const s = await p.evaluate(() => window.cur.actions.map(a => [a.title, a.status, a.assignee, a.branchId, (a.notes || []).map(n => n.text).join('|'), !!a.doneAt]));
  assert.deepEqual(s.find(x => x[0] === 'مراجعة جدول المطبخ'), ['مراجعة جدول المطبخ', 'done', 'أحمد علي', 'b1', 'أُعيد توزيع الورديات', true]);
  assert.equal(await p.locator('.act-item').count(), 1, 'المنجز يخرج من «الجارية»');
  // فريق فرع طيبة: يرى إجراء فرعه فقط في «الإغلاق اليومي ← إجراءات الفرع»
  await p.evaluate(() => { window.as('bm'); window.hub('closehub:myactions'); }); await p.waitForTimeout(400); await settle(p);
  assert.ok((await p.locator('#r').innerText()).includes('إجراءات الفرع'), 'القسم في مركز الإغلاق');
  assert.equal(await p.locator('.act-item').count(), 0, 'إجراء العليا ليس لفرعه، وإجراء فرعه منجز');
  await p.click('button:has-text("الكل")'); await p.waitForTimeout(150);
  assert.deepEqual(await p.locator('.act-item b').first().innerText(), 'مراجعة جدول المطبخ');
  assert.equal(await p.locator('.act-item').count(), 1, 'يرى إجراء فرعه فقط');
  assert.deepEqual(errs, []); await ctx.close();
});

test('توقع المبيعات: الشاشة في مركز التحليل وفي «الإغلاق اليومي» لفريق الفرع، بلا أعطال ولا تجاوز للجوال', async () => {
  for (const h of ['hub/analytics/forecast', 'live/Hub/bm/closehub:myforecast']) {
    const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + h); await p.waitForTimeout(400); await settle(p);
    const txt = await p.locator('#r').innerText();
    assert.ok(txt.includes('المبيعات المتوقعة') && txt.includes('كيف يُحسب؟'), h);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, h);
    assert.deepEqual(errs, [], h); await ctx.close();
  }
});

test('التدفق النقدي المتوقع: يُعرض على الجوال، تتفتح الأسابيع، والالتزام المجدول يغيّر المعاينة ويُحفظ', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/reporting:cashflow'); await p.waitForTimeout(500); await settle(p);
  const txt = await p.locator('#r').innerText();
  assert.ok(txt.includes('التدفق النقدي المتوقع') && txt.includes('النقد الآن') && txt.includes('المنهج'), 'الشاشة');
  assert.equal(await p.locator('.cf-wk').count(), 13);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'لا تجاوز للجوال');
  await p.locator('.cf-wh').first().click(); await p.waitForTimeout(150);
  assert.ok(await p.locator('.cf-wb').count() === 1, 'تفاصيل الأسبوع');
  const before = await p.locator('#r').innerText();
  await p.click('button:has-text("الإعداد")'); await p.waitForTimeout(150);
  await p.click('button:has-text("إضافة التزام")'); await p.waitForTimeout(100);
  const row = p.locator('.cf-srow').first();
  await row.locator('input').nth(0).fill('إيجار العليا'); await row.locator('input').nth(1).fill('25000'); await p.waitForTimeout(200);
  assert.notEqual(await p.locator('#r').innerText(), before, 'المعاينة تتغير قبل الحفظ');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'نموذج الالتزام على الجوال');
  await p.click('.card button:has-text("حفظ")'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => (window.curOrg.cashflowCfg || {}).sched || []);
  assert.deepEqual(s.map(x => [x.label, x.amount, x.every]), [['إيجار العليا', 25000, 'monthly']]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('الشراء من التوقع: الاقتراح بوحدة الشراء، التعديل اليدوي، والأمر فوق حد الاعتماد ينتظر الاعتماد', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/purchasing:reorder'); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => {
    const d0 = new Date(); const day = (k) => { const d = new Date(d0); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
    window.setOrg(g => ({ ...g, warehouses: [], purchaseCfg: { approvalLimit: 100 }, suppliers: [...(g.suppliers || []), { id: 'spx', name: 'مورد الدواجن' }],
      items: [...(g.items || []), { id: 'ix', name: 'دجاج اختبار', unit: 'كجم', purchaseUnit: 'كرتون', purchaseFactor: 10, minQty: 5 }] }));
    window.setOps(o => ({ ...o, closings: [...(o.closings || []), ...Array.from({ length: 35 }, (_, k) => ({ id: 'tx' + k, branchId: 'b1', branchName: 'العليا', date: day(k), status: 'approved', totalRevenue: 5000 }))],
      stockMoves: [...(o.stockMoves || []), { id: 'tin', itemId: 'ix', qty: 60, kind: 'in', date: day(40) }, ...Array.from({ length: 28 }, (_, k) => ({ id: 'tout' + k, itemId: 'ix', qty: -2, kind: 'out', date: day(k) }))],
      purchaseOrders: [...(o.purchaseOrders || []), { id: 'pox', poNo: 'PO-0900', status: 'received', supplierId: 'spx', supplierName: 'مورد الدواجن', date: day(40), lines: [{ itemId: 'ix', qty: 6, factor: 10, received: 6, price: 150 }] }] }));
  });
  await p.waitForTimeout(400);
  const row = p.locator('.pp-row:has-text("دجاج اختبار")');
  assert.equal(await row.count(), 1, 'الصنف يظهر في الاقتراح');
  assert.ok((await row.innerText()).includes('مورد الدواجن'), 'المورد من آخر شراء مستلم');
  const inp = row.locator('.pp-q input'); assert.ok(Number(await inp.inputValue()) >= 1, 'كمية مقترحة بالكرتون');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'لا تجاوز للجوال');
  await inp.fill('3'); await p.waitForTimeout(100);
  await p.click('.pp-go button:has-text("إنشاء")'); await p.waitForTimeout(300);
  const po = await p.evaluate(() => window.cur.purchaseOrders.find(x => x.fromPlan));
  assert.equal(po.supplierName, 'مورد الدواجن');
  assert.deepEqual(po.lines.map(l => [l.itemId, l.qty, l.factor, l.price]), [['ix', 3, 10, 150]]);
  assert.equal(po.status, 'pending', '450 > حد الاعتماد 100');
  assert.match(await p.evaluate(() => window.lastSay), /بانتظار الاعتماد/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('التنبيهات المهمة: عقد إيجار بدفعاته يظهر في المواعيد، والتقارير الضريبية والمشتريات تعمل على الجوال', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const noOverflow = async (h) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, h);
  await p.goto(base + 'live/Hub/admin/docshub:docs'); await p.waitForTimeout(500); await settle(p);
  assert.ok((await p.locator('#r').innerText()).includes('المواعيد والتنبيهات المهمة'));
  await p.click('button:has-text("وثيقة جديدة")'); await p.waitForTimeout(150);
  const m = p.locator('.modal'); await m.locator('select').first().selectOption('lease');
  const d = new Date(); d.setDate(d.getDate() + 5); const soon = d.toISOString().slice(0, 10); d.setFullYear(d.getFullYear() + 2); const end = d.toISOString().slice(0, 10);
  await m.locator('input[type="date"]').nth(1).fill(end);
  await m.locator('.lbl:has-text("بيانات العقد") + .grid input').nth(0).fill('مؤسسة العقار');
  await m.locator('.lbl:has-text("بيانات العقد") + .grid input').nth(1).fill('25000');
  await m.locator('.lbl:has-text("بيانات العقد") + .grid select').selectOption('quarterly');
  await m.locator('.lbl:has-text("بيانات العقد") + .grid input[type="date"]').fill(soon);
  await p.waitForTimeout(100); assert.match(await m.innerText(), /دفعة بإجمالي/);
  await noOverflow('نموذج العقد');
  await m.locator('button:has-text("حفظ")').click(); await p.waitForTimeout(300);
  const L = await p.evaluate(() => window.curOrg.documents.find(x => x.type === 'lease'));
  assert.deepEqual([L.landlord, L.rent, L.payEvery, L.firstPay], ['مؤسسة العقار', 25000, 'quarterly', soon]);
  const it = p.locator('.cmp-it:has-text("دفعة إيجار")'); assert.ok(await it.count() >= 1, 'الدفعة في المواعيد');
  assert.match(await it.first().innerText(), /تنبيه/, 'خلال 7 أيام = تنبيه');
  await noOverflow('المواعيد');
  // سجلات الضريبة
  await p.goto(base + 'live/Accounting/admin/vatreg'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  assert.ok((await p.locator('#r').innerText()).includes('ملخص الإقرار'), 'سجلات الضريبة');
  await p.click('button:has-text("سجل المشتريات")'); await p.waitForTimeout(150); await noOverflow('سجل المشتريات');
  // مشتريات الموردين
  await p.goto(base + 'live/Hub/admin/purchasing:suprep'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  const t = await p.locator('#r').innerText(); assert.ok(t.includes('المشتريات بطرق الدفع') && t.includes('آجل'), 'تقرير المشتريات');
  await p.click('button:has-text("هذه السنة")'); await p.waitForTimeout(150); await noOverflow('تقرير المشتريات');
  assert.deepEqual(errs, []); await ctx.close();
});

test('تخطيط العمالة من التوقع: الشاشة على الجوال والإعداد يُحفظ', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/hr:staffplan'); await p.waitForTimeout(500); await settle(p);
  const t = await p.locator('#r').innerText(); assert.ok(t.includes('ساعات مقترحة') && t.includes('كيف يُحسب؟'), 'الشاشة');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'لا تجاوز للجوال');
  await p.click('button:has-text("الإعداد")'); await p.waitForTimeout(100);
  await p.locator('.card input').first().fill('22'); await p.click('.card button:has-text("حفظ")'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.laborCfg.targetPct), 22);
  assert.ok((await p.locator('#r').innerText()).includes('الهدف 22%'));
  assert.deepEqual(errs, []); await ctx.close();
});

test('رفع مبيعات نقاط البيع: ربط الفرع رغم «فرغ»، يوم العمل بعد منتصف الليل، الملغاة، المطابقة مع الإغلاق، والحفظ', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/SalesHub/admin'); await p.waitForTimeout(500); await settle(p);
  await p.click('button:has-text("استيراد نقاط البيع")'); await p.waitForTimeout(400);
  const csv = ['تاريخ,رقم الفاتورة,اسم العميل,الفرع,حالة الدفع,طريقة الدفع,الإجمالي الكلي,المدفوع',
    '2026-03-01 06:10:00,1,عميل نقدي,فرغ النسيم,مدفوع,نقدا,100,100', '2026-03-01 21:00:00,2,عميل نقدي,فرغ النسيم,مدفوع,شبكة,200,200',
    '2026-03-02 00:30:00,3,عميل نقدي,فرغ النسيم,مدفوع,شبكة,50,50', '2026-03-02 07:00:00,4,عميل نقدي,فرغ النسيم,ملغاة,نقدا,999,999',
    '2026-03-02 09:00:00,5,عميل نقدي,فرغ النسيم,مدفوع,نقدا,70,70', '2026-03-03 00:20:00,6,عميل نقدي,فرغ النسيم,مدفوع,نقدا,5,5', '2026-03-03 06:30:00,7,عميل نقدي,فرغ النسيم,مدفوع,نقدا,9,9'].join('\n');
  await p.setInputFiles('input[type="file"]', { name: 'pos-invoices.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + csv) }); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => { const l = [...document.querySelectorAll('select')].find(s => s.closest('div') && s.closest('div').textContent.includes('فرغ النسيم') && [...s.options].some(o => o.textContent.includes('النسيم'))); return l ? l.selectedOptions[0].textContent : ''; }), 'عم قاسم النسيم', 'الفرع رُبط رغم «فرغ»');
  assert.match(await p.locator('#r').innerText(), /تبدأ وردية الصباح 06:00/);
  await p.click('button:has-text("التجميع والمطابقة")'); await p.waitForTimeout(300);
  const t = await p.locator('#r').innerText();
  assert.match(t, /فاتورة بعد منتصف الليل نُسبت ليومها/); assert.match(t, /1 ملغاة\/مرتجعة استُبعدت/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'لا تجاوز للجوال');
  assert.match(await p.locator('#r').innerText(), /سيُحفظ 2 يوم\/فرع/); assert.match(await p.locator('#r').innerText(), /1 يوم جزئي لن يُحفظ/);
  await p.click('button:has-text("حفظ الاستيراد")'); await p.waitForTimeout(400);
  assert.match(await p.locator('#r').innerText(), /حُفظ الاستيراد: 2 يوم\/فرع/, 'تأكيد ظاهر بعد الحفظ');
  const pi = await p.evaluate(() => window.cur.posImports.filter(x => x.file === 'pos-invoices.csv').map(x => [x.date, x.n, x.total, x.cash, x.card]).sort());
  assert.deepEqual(pi, [['2026-03-01', 3, 350, 100, 250], ['2026-03-02', 2, 75, 75, 0]], 'اليوم الأول كامل مع فاتورة 00:30، والثالث جزئي لم يُحفظ');
  // v39.5: مسودات إغلاق للأيام المستوردة بلا إغلاق، وظهورها في تحليل المبيعات
  await p.click('button:has-text("إغلاق مسودة")'); await p.waitForTimeout(400);
  const dr = await p.evaluate(() => window.cur.closings.filter(c => c.posImportId && c.status === 'draft').map(c => [c.date, c.totalRevenue, c.cashSales, c.cardSales]).sort());
  assert.deepEqual(dr, [['2026-03-01', 350, 100, 250], ['2026-03-02', 75, 75, 0]]);
  assert.equal(await p.locator('button:has-text("إغلاق مسودة")').count(), 0, 'لا يتكرر الإنشاء');
  await p.click('button:has-text("تحليل المبيعات")'); await p.waitForTimeout(300);
  assert.match(await p.locator('#r').innerText(), /2 يوم من استيراد نقاط البيع/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('ربحية الفروع اليومية: موقوفة حتى يُكمل المالك كل الخيارات، ثم تعمل؛ والفرع لا يراها', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/analytics:profit'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  assert.match(await p.locator('#r').innerText(), /اللوحة موقوفة — أكمل/);
  assert.equal(await p.locator('input[type="checkbox"]:near(:text("تفعيل لوحة الربحية"))').first().isDisabled(), true, 'لا تفعيل قبل الاكتمال');
  const sels = p.locator('.card select.sel');
  await sels.nth(0).selectOption('purchases'); await sels.nth(1).selectOption('payroll'); await sels.nth(2).selectOption('calendar'); await sels.nth(3).selectOption('none');
  await p.locator('.pf-chip:has-text("مشتريات مواد خام") input').check();
  await p.locator('label:has-text("تفعيل لوحة الربحية") input').check();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'الإعداد على الجوال');
  await p.click('.card button:has-text("حفظ")'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => window.curOrg.profitCfg);
  assert.deepEqual([c.enabled, c.foodBasis, c.laborBasis, c.alloc, c.cardFee, c.foodCats], [true, 'purchases', 'payroll', 'calendar', 'none', ['ec1']]);
  await p.click('button:has-text("هذا الشهر")'); await p.waitForTimeout(300);
  assert.ok(await p.locator('.pf-br').count() >= 1, 'بطاقات الفروع');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'اللوحة على الجوال');
  await p.evaluate(() => { window.as('bm'); }); await p.waitForTimeout(300);
  assert.match(await p.locator('#r').innerText(), /للإدارة المركزية فقط|لا توجد أقسام متاحة لصلاحيتك/, 'الفرع لا يصل للربحية');
  assert.deepEqual(errs, []); await ctx.close();
});
