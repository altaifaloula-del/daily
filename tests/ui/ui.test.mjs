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

test('v40.7 الوصفات الفرعية: تحضيرة تُنشأ ثم تُستخدم مكوّنًا في منتج فتدخل تكلفتها، ولا تُحذف وهي مستخدمة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/recipes');
  await p.click('button:has-text("تحضيرة جديدة")'); await p.waitForTimeout(150);
  await p.fill('input[placeholder^="صلصة ثوم"]', 'صلصة طماطم'); await p.fill('.modal input[placeholder="5"]', '2');
  await p.selectOption('select[aria-label="المكوّن 1"]', 'i2'); await p.fill('input[aria-label="كمية المكوّن 1"]', '3');
  assert.match(await p.locator('.modal').innerText(), /تكلفة الدفعة 12\.00 · 6\.00\/كجم/);
  await p.click('button:has-text("حفظ التحضيرة")'); await p.waitForTimeout(300);
  const pr = await p.evaluate(() => window.curOrg.preps);
  assert.deepEqual(pr.map(x => [x.name, x.batch, x.unit, x.parts]), [['صلصة طماطم', 2, 'كجم', [{ itemId: 'i2', qty: 3 }]]]);
  await p.locator('.card:has-text("مندي لحم")').last().locator('button:has-text("تعديل")').click(); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("مكوّن إضافي")');
  await p.selectOption('select[aria-label="المكوّن 3"]', 'p:' + pr[0].id); await p.fill('input[aria-label="كمية المكوّن 3"]', '0.05');
  await p.click('button:has-text("حفظ المنتج")'); await p.waitForTimeout(300);
  const card = (await p.locator('.card:has-text("مندي لحم")').last().innerText()).replace(/\s+/g, ' ');
  assert.match(card, /تحضيرة ?صلصة طماطم/); assert.match(card, /تكلفة المنتج 20.70/, '20.40 + 0.05 كجم × 6');
  assert.match(await p.locator('#r').innerText(), /تُستخدم في: مندي لحم/);
  await p.locator('.me-row:has-text("صلصة طماطم") button:has-text("تعديل")').click(); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("حذف")'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.curOrg.preps.length), 1, 'لا تُحذف وهي مستخدمة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v40.8 قائمة التحضير: احتياج التحضيرات من التوقع والمزيج، والمتبقي المُدخل يُطرح ويُحدّث الداخلية', async () => {
  const { p, errs, ctx } = await open({ ...devices['iPhone 13'] }, 'live/Inventory/admin/prep');
  await p.evaluate(() => {
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, items: [...g.items, { id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }, { id: 'oi', name: 'زيت', unit: 'لتر', cost: 8 }, { id: 'sp', name: 'بهارات', unit: 'كجم', cost: 30 }],
      preps: [{ id: 'sauce', name: 'ثومية', unit: 'كجم', batch: 5, parts: [{ itemId: 'ga', qty: 1, yield: 80 }, { itemId: 'oi', qty: 4 }] }, { id: 'mar', name: 'تتبيلة', unit: 'كجم', batch: 2.5, parts: [{ prepId: 'sauce', qty: 2 }, { itemId: 'sp', qty: 0.5 }] }],
      products: [{ id: 'P', name: 'شاورما', sellPrice: 20, parts: [{ prepId: 'mar', qty: 0.2 }] }, { id: 'Q', name: 'بروستد', sellPrice: 25, parts: [{ prepId: 'sauce', qty: 0.05 }] }] }));
    window.setOps(o => ({ ...o, closings: [...(o.closings || []).filter(c => c.branchId !== 'b1'), ...Array.from({ length: 63 }, (_, k) => ({ id: 'pc' + k, branchId: 'b1', branchName: 'طيبة', date: d(k), status: 'approved', totalRevenue: 1000 }))],
      productSales: [{ id: 'ps', branchId: 'b1', from: d(6), to: d(0), lines: [{ productId: 'P', qty: 70 }, { productId: 'Q', qty: 140 }] }] }));
  }); await p.waitForTimeout(500);
  await p.selectOption('select[aria-label="الفرع"]', 'b1'); await p.waitForTimeout(300);
  const row = (n) => p.locator('.pl-row', { has: p.locator('b', { hasText: new RegExp('^' + n + '$') }) });
  assert.match(await row('تتبيلة').innerText(), /الاحتياج 2 كجم[\s\S]*2 كجم/);
  await p.fill('input[aria-label="المتبقي من تتبيلة"]', '0.5'); await p.waitForTimeout(300);
  assert.match(await row('تتبيلة').innerText(), /1\.5 كجم[\s\S]*0\.6 دفعة/);
  assert.match(await row('ثومية').innerText(), /الاحتياج 2\.2 كجم[\s\S]*ثوم 0\.55 كجم · زيت 1\.76 لتر/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'على الجوال بلا تمرير أفقي');
  assert.equal(await p.locator('button:has-text("طباعة للمطبخ")').isEnabled(), true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v40.9 الآيبان: تغيير آيبان الموظف لا يُكتب مباشرة بل يصير طلبًا، والطالب لا يعتمده، وشخص آخر يعتمد ثم يُطبَّق', async () => {
  const NEW = 'SA' + '4'.repeat(22);
  let { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Hub/admin/hr:payroll');
  await p.locator('tr:has-text("أحمد علي") button:has-text("تعديل الراتب")').first().click(); await p.waitForTimeout(150);
  await p.fill('input[placeholder^="SA00"]', NEW); await p.click('.modal button:has-text("حفظ")'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.curOrg.employees.find(e => e.id === 'e1').iban), 'SA0380000000608010167519', 'لا يُكتب مباشرة');
  assert.deepEqual(await p.evaluate(() => (window.curOrg.ibanReqs || []).map(r => [r.ent, r.iban, r.oldIban, r.by])), [['emp:e1', 'SA' + '4'.repeat(22), 'SA0380000000608010167519', 'مجاهد']]);
  assert.match(await p.evaluate(() => window.lastSay && (window.lastSay.msg || window.lastSay)), /أُرسل للاعتماد/);
  await ctx.close();
  ({ p, errs, ctx } = await open({ ...devices['iPhone 13'] }, 'live/Hub/admin/finhub:ibanctl'));
  await p.evaluate((NEW) => { window.setOrg(g => ({ ...g, ibanReqs: [{ id: 'r1', ent: 'emp:e1', name: 'أحمد علي', iban: NEW, oldIban: g.employees[0].iban, sigSubmit: '', by: 'مجاهد', at: '2026-11-14T10:00:00' }] })); }, NEW); await p.waitForTimeout(400);
  assert.match(await p.locator('#r').innerText(), /بانتظار شخص آخر/, 'الطالب لا يرى زر الاعتماد');
  assert.equal(await p.locator('.me-row button:has-text("اعتماد")').count(), 0);
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(300);
  await p.locator('.me-row button:has-text("اعتماد")').click(); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.curOrg.ibanReqs.map(r => [r.localDecision, r.localBy])), [['approve', 'سارة']]);
  assert.match(await p.locator('#r').innerText(), /معتمد — بانتظار التطبيق/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'على الجوال بلا تمرير أفقي');
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300);
  await p.click('button:has-text("تطبيق القرارات")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => [window.curOrg.employees.find(e => e.id === 'e1').iban, (window.curOrg.ibanReqs || []).length]), [NEW, 0]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.0 شريط القوائم بنمط أودو: عناوين رئيسية، القائمة تفتح بأقسامها، الاختيار ينقل ويغلق، ولا تخرج عن الشاشة على الجوال', async () => {
  const { p, errs, ctx } = await open({ ...devices['iPhone 13'] }, 'live/Inventory/admin/items');
  assert.deepEqual(await p.locator('.ob > .ob-wrap > .ob-it, .ob > .ob-it').allInnerTexts(), ['المخزون', 'المطبخ والوصفات', 'الرقابة']);
  assert.equal((await p.locator('.ob-it.on').innerText()).trim(), 'المخزون', 'العنوان النشط');
  await p.click('.ob-it:has-text("المطبخ والوصفات")'); await p.waitForTimeout(150);
  assert.deepEqual(await p.locator('.ob-menu .ob-mi').allInnerTexts(), ['الوصفات والتكلفة', 'قائمة التحضير اليومية', 'هندسة القائمة']);
  const box = await p.locator('.ob-menu').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390 + 1, 'القائمة داخل الشاشة'); assert.equal(await p.evaluate(() => { const m = document.querySelector('.ob-menu'), r = m.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + 30).closest('.ob-menu') === m; }), true, 'القائمة فوق المحتوى لا تحته');
  await p.click('.ob-mi:has-text("قائمة التحضير اليومية")'); await p.waitForTimeout(250);
  assert.equal(await p.locator('.ob-menu').count(), 0, 'تُغلق بعد الاختيار');
  assert.match(await p.locator('#r').innerText(), /قائمة التحضير اليومية/); assert.equal((await p.locator('.ob-it.on').innerText()).trim(), 'المطبخ والوصفات');
  await p.click('.ob-it:has-text("الرقابة")'); await p.waitForTimeout(100); await p.mouse.click(5, 600); await p.waitForTimeout(100);
  assert.equal(await p.locator('.ob-menu').count(), 0, 'النقر خارجها يغلقها');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'بلا تمرير أفقي');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.1 السعرات: تُدخل للصنف لكل 100 غ، والطبق «ناقص» حتى تكتمل مكوّناته، ثم يُحسب بالكمية الخام', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/items');
  await p.locator('tr:has-text("لحم غنم") button:has-text("تعديل")').first().click(); await p.waitForTimeout(150);
  await p.fill('input[aria-label="السعرات الحرارية"]', '250'); await p.click('.modal button:has-text("حفظ")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.curOrg.items.find(i => i.id === 'i1').kcal), { basis: '100', v: 250 });
  await p.click('.ob-it:has-text("المطبخ والوصفات")'); await p.click('.ob-mi:has-text("الوصفات والتكلفة")'); await p.waitForTimeout(300);
  const card = () => p.locator('.card:has-text("مندي لحم")').last().innerText();
  assert.match(await card(), /السعرات ناقصة: طماطم/, 'لا رقم جزئي');
  await p.evaluate(() => window.setOrg(g => ({ ...g, items: g.items.map(i => i.id === 'i2' ? { ...i, kcal: { basis: '100', v: 18 } } : i) }))); await p.waitForTimeout(300);
  assert.match(await card(), /1268 سعرة/, 'لحم 0.5 كجم خام × 2500 + طماطم 0.1 × 180');
  assert.equal(await p.locator('button:has-text("بطاقة السعرات")').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.2 حجم البيانات ونموها في صيانة النظام: جدول المجموعات بالحجم والنمو، بلا تمرير أفقي للصفحة على الجوال', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => { const d = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
    window.setOps(o => ({ ...o, posOrders: Array.from({ length: 120 }, (_, k) => ({ id: 'fo' + k, branchId: 'b1', date: d(k), total: 50, lines: [{ productId: 'p1', qty: 1 }] })) })); }); await p.waitForTimeout(300);
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('.card:has-text("حجم البيانات ونموها")');
  assert.match(await card.innerText(), /فواتير نقطة البيع[\s\S]*120/);
  assert.match(await card.innerText(), /ينمو .* شهريًا/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'الجدول يتمرر داخل بطاقته لا الصفحة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.3 التسوية التلقائية للوسيط: تُرحَّل قيود الأيام المعتمد إغلاقها فقط، ولا تتكرر', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/finhub:cardrec'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, cardTerminals: [{ tid: '4274', branchId: 'b1' }], profitCfg: { cardRates: { mada: 0.8, visa: 2.5, mc: 2.5 } }, posClearing: { enabled: true, from: '2026-09' } }));
    window.setOps(o => ({ ...o, journalManual: [], closings: [...(o.closings || []).filter(c => !String(c.date || '').startsWith('2026-10')), { id: 'cr1', branchId: 'b1', branchName: 'طيبة', date: '2026-10-01', status: 'approved', cardSales: 2218.43, totalRevenue: 3000 }, { id: 'cr2', branchId: 'b1', branchName: 'طيبة', date: '2026-10-02', status: 'submitted', cardSales: 1000, totalRevenue: 1500 }] }));
  }); await p.waitForTimeout(300);
  const csv = ['التاريخ,الوقت,البيان,الجهاز,نوع البطاقة,دائن,مدين',
    '2026-10-02,00:57:05,نقاط بيع - دائنة التاجر,1552164702164274,مدى,1708,0', '2026-10-02,00:57:05,نقاط بيع - مدين التاجر عمولة,1552164702164274,مدى,0,15.76',
    '2026-10-02,22:10:34,عمليات التجار مبيعات شبكة,1552164702164274,فيزا,333.08,0', '2026-10-02,22:10:34,عمليات التجار مبيعات شبكة,1552164702164274,ماستركارد,162.67,0',
    '2026-10-03,01:00:00,نقاط بيع - دائنة التاجر,1552164702164274,مدى,1000,0', '2026-10-03,01:00:00,نقاط بيع - مدين التاجر عمولة,1552164702164274,مدى,0,9.22'].join('\n');
  await p.locator('input[type="month"]').fill('2026-10');
  await p.setInputFiles('input[type="file"]', { name: 'stmt.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + csv) }); await p.waitForTimeout(500);
  const card = p.locator('.card:has-text("التسوية التلقائية للوسيط")');
  assert.match(await card.innerText(), /جاهز للترحيل[\s\S]*بانتظار اعتماد الإغلاق/);
  await card.locator('button:has-text("ترحيل القيود الجاهزة (1)")').click(); await p.waitForTimeout(400);
  const j = await p.evaluate(() => window.cur.journalManual.map(x => [x.ref, x.lines.map(l => [l.code, l.debit, l.credit])]));
  assert.deepEqual(j, [['crs|b1|2026-10-02', [['1201', 2187.99, 0], ['5303', 26.46, 0], ['1501', 3.97, 0], ['1801', 0, 2218.42]]]]);
  assert.match(await card.innerText(), /مُرحّل/); assert.equal(await card.locator('button:has-text("ترحيل القيود الجاهزة")').count(), 0, 'لا يتكرر');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.3 تصدير أي تقرير مطبوع: Excel وCSV من جداول التقرير نفسه في العارض', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/recipes');
  await p.click('button:has-text("بطاقة السعرات")'); await p.waitForTimeout(600);
  const [dc] = await Promise.all([p.waitForEvent('download'), p.click('.mz-docv button:has-text("CSV")')]);
  const txt = fs.readFileSync(await dc.path(), 'utf8');
  // اسم الملف عربي (عنوان التقرير) — Chromium بلا واجهة في بيئة الاختبار يستبدل الأسماء العربية بـ«download»، فنتحقق من المحتوى
  assert.ok(txt.startsWith('﻿'), 'BOM ليقرأ Excel العربية'); assert.match(txt, /الصنف,السعر,السعرات الحرارية,المصدر/); assert.match(txt, /مندي لحم,60,/);
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('.mz-docv button:has-text("Excel")')]);
  const xb = fs.readFileSync(await dx.path()); assert.equal(xb.slice(0, 2).toString(), 'PK', 'ملف xlsx (zip)'); assert.ok(xb.length > 1000);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.4 سجل سلامة الغذاء: الفرع يسجّل الحرارة، وخارج المدى يتطلب إجراءً تصحيحيًا، والالتزام يظهر', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/bm/closehub:fsafety'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => window.setOrg(g => ({ ...g, fsCfg: { perDay: 2 }, fsUnits: [{ id: 'u1', branchId: 'b1', name: 'ثلاجة الخضار', kind: 'fridge', min: 0, max: 5 }, { id: 'u2', branchId: 'b1', name: 'فريزر اللحوم', kind: 'freezer', min: -40, max: -18 }] }))); await p.waitForTimeout(300);
  await p.fill('input[aria-label="حرارة ثلاجة الخضار"]', '3'); await p.locator('.fs-row:has-text("ثلاجة الخضار") button:has-text("تسجيل")').click(); await p.waitForTimeout(250);
  await p.fill('input[aria-label="حرارة فريزر اللحوم"]', '-9'); await p.locator('.fs-row:has-text("فريزر اللحوم") button:has-text("تسجيل")').click(); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => (window.cur.fsLogs || []).length), 1, 'خارج المدى بلا إجراء لا يُسجَّل');
  await p.fill('input[aria-label="إجراء فريزر اللحوم"]', 'نُقلت اللحوم لفريزر الاحتياط وطُلب فني'); await p.locator('.fs-row:has-text("فريزر اللحوم") button:has-text("تسجيل")').click(); await p.waitForTimeout(250);
  assert.deepEqual(await p.evaluate(() => window.cur.fsLogs.map(l => [l.unitId, l.temp, l.ok, l.by, !!l.action]).sort()), [['u1', 3, true, 'خالد', false], ['u2', -9, false, 'خالد', true]]);
  assert.match(await p.locator('#r').innerText(), /قراءات خارج المدى[\s\S]*فريزر اللحوم/);
  assert.match(await p.locator('#r').innerText(), /2 من 28 قراءة/, 'الالتزام: 2 من 2×2×7');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  await p.click('button:has-text("السجل للتفتيش")'); await p.waitForTimeout(500);
  assert.equal(await p.locator('.mz-docv button:has-text("Excel")').count(), 1, 'السجل يُصدَّر');
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
  await p.locator('.ob-it.on').click(); await p.waitForTimeout(150);   // v41.0: القسم داخل قائمة «الفرع» في شريط القوائم
  assert.equal((await p.locator('.ob-mi.on').innerText()).trim(), 'إجراءات الفرع', 'القسم في مركز الإغلاق');
  await p.locator('.ob-mi.on').click(); await p.waitForTimeout(150);
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

test('v40.3 هندسة القائمة: التصنيف الرباعي، التحويل لإجراء دون تكرار، تعديل العتبة، والفرع لا يراها', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/analytics:menu'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  await p.evaluate(() => {
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, items: [...(g.items || []), { id: 'mi1', name: 'دجاج', unit: 'كجم', cost: 10 }],
      products: [['mA', 30], ['mB', 15], ['mC', 40], ['mD', 12]].map(([id, price]) => ({ id, name: 'صنف ' + id, sellPrice: price, parts: [{ itemId: 'mi1', qty: 1 }] })).concat([{ id: 'mE', name: 'بلا وصفة', sellPrice: 20, parts: [] }]) }));
    window.setOps(o => ({ ...o, productSales: [{ id: 'mps', branchId: 'b1', from: d(20), to: d(10), lines: [{ productId: 'mA', qty: 100 }, { productId: 'mB', qty: 100 }, { productId: 'mC', qty: 10 }, { productId: 'mD', qty: 10 }, { productId: 'mE', qty: 50 }] }] }));
  }); await p.waitForTimeout(400);
  const txt = await p.locator('#r').innerText();
  assert.match(txt, /أصناف محلّلة/); assert.match(txt, /بلا وصفة — التكلفة غير معروفة/);
  assert.match(await p.locator('.me-qc').nth(0).innerText(), /نجم\s*1/);
  assert.equal(await p.locator('.me-mx circle').count(), 4, 'نقطة لكل صنف محلّل');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'على الجوال بلا تمرير أفقي');
  await p.locator('.me-qc').nth(3).click(); await p.waitForTimeout(150);   // ضعيف
  assert.equal(await p.locator('.me-list').first().locator('.me-row').count(), 1);
  await p.locator('.me-row button:has-text("إجراء")').click(); await p.waitForTimeout(300);
  const a = await p.evaluate(() => window.cur.actions.filter(x => x.src === 'menu').map(x => [x.srcKey, x.title]));
  assert.deepEqual(a, [['menu|mD|dog', 'هندسة القائمة: ضعيف — صنف mD']]);
  assert.equal(await p.locator('.me-row button:has-text("إجراء")').count(), 0, 'لا يتكرر الإجراء'); assert.match(await p.locator('.me-row').first().innerText(), /له إجراء/);
  await p.click('button:has-text("المنهج")'); await p.locator('.card input.inp.n').first().fill('200'); await p.click('.card button:has-text("حفظ")'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.menuCfg.popPct), 200);
  assert.match(await p.locator('.me-qc').nth(0).innerText(), /نجم\s*0/, 'العتبة 200% تُسقط A من النجوم');
  await p.evaluate(() => { window.as('bm'); }); await p.waitForTimeout(300);
  assert.match(await p.locator('#r').innerText(), /للإدارة المركزية|لا توجد أقسام متاحة لصلاحيتك/, 'الفرع لا يصل لهندسة القائمة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v40.4 خطة التوفير: فرص مقاسة، النسبة إلزامية بلا افتراض، الإضافة للخطة دون تكرار، والفرع لا يراها', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/analytics:savings'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  await p.evaluate(() => {
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
    window.setOps(o => ({ ...o, stockMoves: [...(o.stockMoves || []), { id: 'sw1', kind: 'waste', branchId: 'b1', itemId: 'svI', qty: -2, wasteVal: 300, date: d(5) }],
      purchaseOrders: [...(o.purchaseOrders || []), ...[[40, 9], [8, 11]].map(([k, pr], i) => ({ id: 'spo' + i, poNo: 'SP' + i, date: d(k), supplierId: 's' + i, supplierName: i ? 'مورد ب' : 'مورد أ', status: 'received', lines: [{ itemId: 'svI', desc: 'دجاج', qty: 100, received: 100, price: pr }] }))] }));
  }); await p.waitForTimeout(400);
  const txt = await p.locator('#r').innerText();
  assert.match(txt, /الهدر المسجّل/); assert.match(txt, /فرق سعر الشراء/);
  const row = p.locator('.sv-row', { hasText: 'فرق سعر الشراء' });
  assert.match(await row.innerText(), /200\.00/, '(11−9)×100 في الفترة');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'على الجوال بلا تمرير أفقي');
  await row.locator('button:has-text("للخطة")').click(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => (window.cur.actions || []).filter(a => a.src === 'saving').length), 0, 'بلا نسبة لا يُضاف');
  await row.locator('input').fill('50'); await row.locator('button:has-text("للخطة")').click(); await p.waitForTimeout(300);
  const a = await p.evaluate(() => window.cur.actions.filter(x => x.src === 'saving').map(x => [x.srcKey, x.saving.pct, x.saving.ref]));
  assert.deepEqual(a, [['saving|price|svI', 50, 9]]);
  assert.match(await row.innerText(), /في الخطة/); assert.equal(await row.locator('button').count(), 0, 'لا يتكرر');
  await p.click('button:has-text("الخطة (1)")'); await p.waitForTimeout(200);
  assert.match(await p.locator('#r').innerText(), /يُقاس من/, 'أقل من 7 أيام: لا ادعاء توفير');
  await p.evaluate(() => { window.as('bm'); }); await p.waitForTimeout(300);
  assert.match(await p.locator('#r').innerText(), /للإدارة المركزية|لا توجد أقسام متاحة لصلاحيتك/, 'الفرع لا يصل لخطة التوفير');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v40.6 مطابقة الشبكة: رفع الكشف، إسناد الجهاز لفرعه، ثم التطابق بعد إعادة إجمالي فيزا/ماستركارد', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/finhub:cardrec'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, cardTerminals: [], profitCfg: { cardRates: { mada: 0.8, visa: 2.5, mc: 2.5 } } }));
    window.setOps(o => ({ ...o, closings: [...(o.closings || []).filter(c => !String(c.date || '').startsWith('2026-10')), { id: 'cr1', branchId: 'b1', branchName: 'طيبة', date: '2026-10-01', status: 'approved', cardSales: 2218.43, totalRevenue: 3000 }, { id: 'cr2', branchId: 'b1', branchName: 'طيبة', date: '2026-10-02', status: 'approved', cardSales: 1000, totalRevenue: 1500 }] }));
  }); await p.waitForTimeout(300);
  const csv = ['التاريخ,الوقت,البيان,الجهاز,نوع البطاقة,دائن,مدين',
    '2026-10-02,00:57:05,نقاط بيع - دائنة التاجر,1552164702164274,مدى,1708,0', '2026-10-02,00:57:05,نقاط بيع - مدين التاجر عمولة,1552164702164274,مدى,0,15.76',
    '2026-10-02,22:10:34,عمليات التجار مبيعات شبكة,1552164702164274,فيزا,333.08,0', '2026-10-02,22:10:34,عمليات التجار مبيعات شبكة,1552164702164274,ماستركارد,162.67,0',
    '2026-10-03,01:00:00,نقاط بيع - دائنة التاجر,1552164702164274,مدى,1000,0', '2026-10-03,01:00:00,نقاط بيع - مدين التاجر عمولة,1552164702164274,مدى,0,9.22',
    '2026-10-02,10:00:00,سداد فاتورة كهرباء,,,0,800'].join('\n');
  await p.locator('input[type="month"]').fill('2026-10');
  await p.setInputFiles('input[type="file"]', { name: 'stmt.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + csv) }); await p.waitForTimeout(500);
  let txt = await p.locator('#r').innerText();
  assert.match(txt, /أجهزة غير مسندة لفرع \(4274\)/); assert.match(txt, /لا جهاز مسند/);
  await p.locator('select[aria-label="فرع الجهاز 4274"]').selectOption('b1'); await p.waitForTimeout(400);
  assert.deepEqual(await p.evaluate(() => window.curOrg.cardTerminals), [{ tid: '4274', branchId: 'b1' }]);
  txt = await p.locator('#r').innerText();
  assert.match(txt, /متطابق/); assert.match(txt, /الإيداع بعد يوم/); assert.match(txt, /0\.922%/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'على الجوال بلا تمرير أفقي');
  await p.click('button:has-text("اعتماد المطابقة")'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => (window.cur.cardRecons || []).map(x => [x.from, x.to, x.tot.diff, x.branches[0].ok]));
  assert.deepEqual(r, [['2026-10-01', '2026-10-31', 0, true]]);
  assert.equal(await p.evaluate(() => JSON.stringify(window.cur.cardRecons).includes('1552164702164274')), false, 'الكشف نفسه لا يُحفظ');
  await p.evaluate(() => { window.as('bm'); }); await p.waitForTimeout(300);
  assert.doesNotMatch(await p.locator('#r').innerText(), /اعتماد المطابقة/, 'الفرع لا يصل');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v40.2 الإغلاق: تقسيم الشبكة إلى مدى/فيزا/ماستركارد — الاختلاف عن إجمالي الجهاز يمنع الترحيل، والمطابق يُحفظ', async () => {
  const ctx = await browser.newContext(devices['iPad (gen 7)']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/ClosingForm/bm'); await p.reload(); await p.waitForTimeout(800); await settle(p);
  const fld = (lbl) => lbl === 'مبيعات الشبكة — إجمالي الجهاز' ? p.locator('.fld:has(label:has-text("إجمالي الجهاز")) textarea, .fld:has(label:has-text("إجمالي الجهاز")) input').first()
    : p.locator('.card-split .fld').nth({ 'مدى': 0, 'فيزا': 1, 'ماستركارد': 2 }[lbl]).locator('input');
  await p.locator('text=الشبكة والتحويل').first().click(); await p.waitForTimeout(150);
  await fld('مبيعات الشبكة — إجمالي الجهاز').fill('1000'); await fld('مبيعات الشبكة — إجمالي الجهاز').blur();
  await fld('مدى').fill('600'); await fld('مدى').blur(); await fld('فيزا').fill('300'); await fld('فيزا').blur(); await fld('ماستركارد').fill('50'); await fld('ماستركارد').blur();
  await p.waitForTimeout(150);
  assert.match(await p.locator('.cs-chk').innerText(), /≠ إجمالي الجهاز/);
  assert.ok(await p.locator('.eaudit-i.block:has-text("تقسيم الشبكة")').count() >= 1, 'مانع في فحص الإغلاق');
  await fld('ماستركارد').fill('100'); await fld('ماستركارد').blur(); await p.waitForTimeout(150);
  assert.match(await p.locator('.cs-chk').innerText(), /✓ المجموع/);
  await p.click('button:has-text("حفظ كمسودة")'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => (window.cur.closings || []).find(x => x.cardSplit));
  assert.deepEqual(c && c.cardSplit, { mada: 600, visa: 300, mc: 100 });
  assert.deepEqual(errs, []); await ctx.close();
});
