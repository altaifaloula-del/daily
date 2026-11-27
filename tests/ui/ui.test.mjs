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
  assert.deepEqual(await p.locator('.ob-menu .ob-mi').allInnerTexts(), ['الوصفات والتكلفة', 'قائمة التحضير اليومية', 'أوامر الإنتاج', 'هندسة القائمة']);
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

test('v41.5 الجرد النقدي المفاجئ: بالفئات مقابل المتوقع، الفرق يتطلب تفسيرًا ويُنشئ إجراءً، ولا يجرد حافظ النقد نفسه', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/closehub:cashcount'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => window.setOps(o => ({ ...o, posShifts: [], cashCounts: [] }))); await p.waitForTimeout(200);
  await p.locator('.me-row:has-text("عم قاسم طيبة") button:has-text("جرد الآن")').click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="حافظ النقد"]', 'مجاهد'); await p.fill('input[aria-label="المتوقع"]', '1000'); await p.fill('input[aria-label="مرجع المتوقع"]', 'X-77'); await p.fill('input[aria-label="فئة 500"]', '2');
  await p.click('button:has-text("حفظ المحضر")'); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.lastSay), /لا يجرد حافظ النقد نفسه/);
  await p.fill('input[aria-label="حافظ النقد"]', 'أحمد علي'); await p.click('button:has-text("حفظ المحضر")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.cashCounts.map(c => [c.holder, c.expected, c.counted, c.variance, c.ref, c.by])), [['أحمد علي', 1000, 1000, 0, 'X-77', 'مجاهد']]);
  await p.locator('.me-row:has-text("عم قاسم طيبة") button:has-text("جرد الآن")').click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="حافظ النقد"]', 'أحمد علي'); await p.fill('input[aria-label="المتوقع"]', '1000'); await p.fill('input[aria-label="مرجع المتوقع"]', 'X-78'); await p.fill('input[aria-label="فئة 500"]', '1'); await p.fill('input[aria-label="فئة 200"]', '2');
  assert.match(await p.locator('#r').innerText(), /عجز[\s\S]*-100\.00|−100\.00|-100/);
  await p.click('button:has-text("حفظ المحضر")'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.cur.cashCounts.length), 1, 'الفرق بلا تفسير لا يُحفظ');
  await p.fill('input[aria-label="التفسير"]', 'سُلّمت 100 لمندوب التوصيل دون سند'); await p.click('button:has-text("حفظ المحضر")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => [window.cur.cashCounts[0].variance, (window.cur.actions || []).filter(a => (a.srcKey || '').startsWith('cc|')).length]), [-100, 1], 'إجراء متابعة للفرق');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.6 صيانة المعدات: بلاغ عطل من الفرع، وإغلاقه بتكلفة أثناء الضمان يتطلب سببًا', async () => {
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/bm/closehub:maint'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  const wt = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  await p.evaluate((wt) => { window.setOrg(g => ({ ...g, equipment: [{ id: 'q1', branchId: 'b1', name: 'قلاية البروستد', warrantyTo: wt, pmDays: 90 }] })); window.setOps(o => ({ ...o, maintLogs: [] })); }, wt); await p.waitForTimeout(300);
  await p.click('button:has-text("بلاغ عطل")'); await p.fill('input[aria-label="الوصف"]', 'الحرارة لا ترتفع فوق 120'); await p.click('.card button:has-text("حفظ")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.maintLogs.map(l => [l.equipId, l.type, l.status, l.by])), [['q1', 'breakdown', 'open', 'خالد']]);
  assert.match(await p.locator('#r').innerText(), /عطل مفتوح منذ/);
  await p.locator('.me-row button:has-text("إغلاق")').first().click(); await p.waitForTimeout(150);
  await p.fill('input[aria-label="ما أُصلح"]', 'تغيير الثرموستات'); await p.fill('input[aria-label="تكلفة الإصلاح"]', '450');
  await p.click('button:has-text("إغلاق البلاغ")'); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.lastSay), /تحت الضمان/, 'الدفع أثناء الضمان يتطلب سببًا');
  await p.fill('input[aria-label="سبب الدفع"]', 'سوء استخدام — لا يغطيه الضمان'); await p.click('button:has-text("إغلاق البلاغ")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.maintLogs.map(l => [l.status, l.cost, !!l.wnote])), [['done', 450, true]]);
  assert.match(await p.locator('#r').innerText(), /دُفع أثناء الضمان[\s\S]*450/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.7 أرشفة فواتير نقطة البيع: الأشهر المقفلة الأقدم من 12 شهرًا فقط، تُكتب للأرشيف وتُتحقق ثم تُزال، وتبقى للعرض', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => { const y = new Date().getFullYear() - 2; window.setOrg(g => ({ ...g, periodLocks: { ...(g.periodLocks || {}), lockedThrough: (y + 1) + '-06' } }));
    window.setOps(o => ({ ...o, archLog: [], posOrders: [{ id: 'old1', no: 'ف1-01', branchId: 'b1', date: y + '-03-04', at: y + '-03-04T12:00', total: 55, vat: 7.17, status: 'paid' }, { id: 'old2', branchId: 'b1', date: y + '-09-09', total: 20, status: 'paid' },
      { id: 'new1', branchId: 'b1', date: new Date().toISOString().slice(0, 10), total: 9, status: 'paid' }] })); }); await p.waitForTimeout(300);
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('.card:has-text("أرشفة فواتير نقطة البيع القديمة")');
  await card.locator('button:has-text("أرشفة 2 فاتورة")').click(); await p.waitForTimeout(800);
  assert.deepEqual(await p.evaluate(() => window.cur.posOrders.map(o => o.id)), ['new1'], 'أُزيلت القديمة المقفلة فقط');
  assert.deepEqual(await p.evaluate(() => window.cur.archLog.map(l => [l.branchId, l.n])), [['b1', 2]]);
  await card.locator('button:has-text("عرض")').first().click(); await p.waitForTimeout(600);
  assert.match(await p.locator('.mz-docv').innerText(), /أرشيف فواتير نقطة البيع/);
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

test('v41.8 فحص النسخة الليلية المشفّرة: يُطلب المفتاح داخل المنصة، الخاطئ يُرفض، والصحيح يفك ويثبت التوازن', async () => {
  const { encrypt, composeLogical } = await import('../../scripts/backup-lib.mjs');
  const ctx = await browser.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  const org = await p.evaluate(() => window.curOrg);
  const L = composeLogical({ rms8_org: org, rms8_br_b1: { closings: [] } });
  const enc = encrypt(Buffer.from(JSON.stringify({ logical: L, platform: {}, raw: {} })), 'night-key-for-test');
  await p.locator('button:has-text("بيانات الشركة والنسخ الاحتياطي")').first().click(); await p.waitForTimeout(500);
  const inp = p.locator('input[type=file][accept*=".enc"]');
  await inp.setInputFiles({ name: 'mizan-backup-2026-11-14.enc', mimeType: 'application/octet-stream', buffer: enc }); await p.waitForTimeout(300);
  const arm = p.locator('[data-enc-arm]');
  assert.match(await arm.innerText(), /نسخة مشفّرة/);
  await p.locator('input[aria-label="مفتاح النسخ"]').fill('wrong-key-0000'); await p.click('button:has-text("فك وفحص")'); await p.waitForTimeout(1500);
  assert.match(await arm.innerText(), /غير صحيح/);
  assert.equal(await p.locator('input[aria-label="مفتاح النسخ"]').inputValue(), '', 'يُمسح المفتاح الخاطئ');
  await p.locator('input[aria-label="مفتاح النسخ"]').fill('night-key-for-test'); await p.click('button:has-text("فك وفحص")'); await p.waitForTimeout(1500);
  const txt = await p.locator('#r').innerText();
  assert.match(txt, /النسخة سليمة وقابلة للاستعادة/); assert.match(txt, /متوازنة/); assert.match(txt, /تنزيل النسخة مفكوكة/);
  assert.equal(await p.locator('[data-enc-arm]').count(), 0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v41.9/v46.9 الإغلاقات سجلات مستقلة: مفعّلة افتراضيًا (قرار المالك)، يوقفها المدير ويعيدها، والقراءة لا تُفعَّل قبل مطابقة', async () => {
  const ctx = await browser.newContext(devices['iPad (gen 7)']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('[data-clr]');
  assert.match(await card.innerText(), /النسخ مفعّل/, 'v46.9: مفعّل افتراضيًا');
  await card.locator('button:has-text("إيقاف النسخ")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => (window.curOrg.closingRecords || {}).on), false);
  assert.match(await card.innerText(), /غير مفعّل/);
  assert.equal(await card.locator('button:has-text("ترحيل الإغلاقات الحالية")').count(), 0, 'لا ترحيل والنسخ متوقف');
  await card.locator('button:has-text("تفعيل النسخ")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.closingRecords || {}).on), true);
  assert.match(await card.innerText(), /النسخ مفعّل/);
  assert.equal(await card.locator('button:has-text("ترحيل الإغلاقات الحالية")').count(), 1);
  assert.equal(await card.locator('button:has-text("القراءة من السجلات المحمية")').isDisabled(), true, 'v42.2: لا قراءة من السجلات قبل مطابقة كاملة');
  await card.locator('button:has-text("مطابقة")').click(); await p.waitForTimeout(400);
  assert.match(await p.evaluate(() => window.lastSay || ''), /Firestore فقط/, 'خارج Firestore رسالة واضحة لا انهيار');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  await card.locator('button:has-text("إيقاف النسخ")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.closingRecords || {}).on), false, 'الإيقاف متاح للتراجع');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.0 القيود اليدوية سجلات مستقلة: مُطفأة افتراضيًا، يفعّلها المدير ويوقفها، والمطابقة خارج Firestore لا تنهار', async () => {
  const ctx = await browser.newContext(devices['iPad (gen 7)']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('[data-fjrec]');
  assert.match(await card.innerText(), /غير مفعّل/, 'مُطفأ افتراضيًا');
  await card.locator('[data-fjtoggle]').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.finRecords || {}).on), true);
  assert.match(await card.innerText(), /النسخ مفعّل/);
  await card.locator('[data-fjcheck]').click(); await p.waitForTimeout(400);
  assert.match(await p.evaluate(() => window.lastSay || ''), /Firestore فقط/);
  await card.locator('[data-fjtoggle]').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.finRecords || {}).on), false, 'الإيقاف متاح للتراجع');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.1 MQ-021 الحارس المركزي: الهدر أو أي حركة تُنقص الرصيد دون الصفر تُرفض، والنقرة المزدوجة على حفظ السند لا تكرره', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'live/Inventory/admin/moves');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, warehouses: [], items: [{ id: 'mt', name: 'لحم', unit: 'كجم', cost: 40 }] }));
    window.setOps(o => ({ ...o, whMoves: [], whTransfers: [], stockMoves: [{ id: 'p1', date: '2026-09-01', at: '2026-09-01T10:00', itemId: 'mt', kind: 'purchase', qty: 4, unitCost: 40 }] }));
  }); await p.waitForTimeout(300);
  await p.locator('button:has-text("حركة جديدة")').click(); await p.waitForTimeout(200);
  await p.selectOption('.modal select >> nth=0', 'waste');
  await p.fill('.modal input.inp.n', '9'); await p.click('.modal button:has-text("تسجيل الحركة")'); await p.waitForTimeout(300);
  assert.match(await p.evaluate(() => window.lastSay || ''), /الرصيد غير كافٍ|تتجاوز الرصيد/);
  assert.equal(await p.evaluate(() => window.cur.stockMoves.length), 1, 'لم تُسجَّل الحركة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v42.0 المخزون: «صرف للتشغيل» لا يتجاوز الرصيد (بلا استثناء)، وشاشة الدوران وفروق الأسعار على الجوال', async () => {
  const { p, errs, ctx } = await open({ ...devices['iPhone 13'] }, 'live/Inventory/admin/moves');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, warehouses: [], items: [{ id: 'mt', name: 'لحم', unit: 'كجم', cost: 40 }] }));
    window.setOps(o => ({ ...o, whMoves: [], whTransfers: [], stockMoves: [
      { id: 'p1', date: '2026-09-01', at: '2026-09-01T10:00', itemId: 'mt', kind: 'purchase', qty: 10, unitCost: 40 },
      { id: 'p2', date: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), itemId: 'mt', kind: 'purchase', qty: 5, unitCost: 46 }] }));
  }); await p.waitForTimeout(300);
  await p.locator('button:has-text("حركة جديدة")').click(); await p.waitForTimeout(200);
  await p.selectOption('.modal select >> nth=0', 'out');
  await p.fill('.modal input.inp.n', '16'); await p.click('.modal button:has-text("تسجيل الحركة")'); await p.waitForTimeout(250);
  assert.match(await p.evaluate(() => window.lastSay || ''), /تتجاوز الرصيد[\s\S]*المتاح 15/);
  assert.equal(await p.evaluate(() => window.cur.stockMoves.length), 2, 'لم تُسجَّل الحركة');
  await p.fill('.modal input.inp.n', '6'); await p.click('.modal button:has-text("تسجيل الحركة")'); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => window.cur.stockMoves.filter(m => m.kind === 'out').map(m => m.qty).join()), '-6', 'ضمن الرصيد تُسجَّل');
  await p.goto(base + 'live/Inventory/admin/turnover'); await p.reload(); await p.waitForTimeout(600); await settle(p);
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, warehouses: [], items: [{ id: 'mt', name: 'لحم', unit: 'كجم', cost: 40 }] }));
    const t = new Date().toISOString().slice(0, 10);
    window.setOps(o => ({ ...o, whMoves: [], whTransfers: [], stockMoves: [
      { id: 'p1', date: '2026-09-01', at: '2026-09-01T10:00', itemId: 'mt', kind: 'purchase', qty: 10, unitCost: 40 },
      { id: 'p2', date: t, at: t + 'T10:00', itemId: 'mt', kind: 'purchase', qty: 5, unitCost: 46 }, { id: 'o1', date: t, itemId: 'mt', kind: 'out', qty: -6 }] }));
  }); await p.waitForTimeout(400);
  const card = p.locator('[data-turnppv]');
  assert.match(await card.innerText(), /معدل الدوران[\s\S]*لحم/);
  await card.locator('button:has-text("فروق أسعار الشراء")').click(); await p.waitForTimeout(200);
  assert.match(await card.innerText(), /لحم[\s\S]*\+15%[\s\S]*\+30\.00|\+15%[\s\S]*30/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true, 'بلا تمرير أفقي');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v42.8 أوامر الإنتاج: إنشاء الأمر، منع الإكمال عند النقص، ثم الإكمال يصرف الخامات ويُدخل الناتج', async () => {
  const { p, errs, ctx } = await open({ ...devices['iPhone 13'] }, 'live/Inventory/admin/production');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, warehouses: [], items: [{ id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }, { id: 'oi', name: 'زيت', unit: 'لتر', cost: 8 }, { id: 'pp_sauce', name: 'ثومية', unit: 'كجم', type: 'stock', prepId: 'sauce' }],
      preps: [{ id: 'sauce', name: 'ثومية', unit: 'كجم', batch: 5, stocked: true, parts: [{ itemId: 'ga', qty: 1, yield: 80 }, { itemId: 'oi', qty: 4 }] }] }));
    window.setOps(o => ({ ...o, prodOrders: [], whMoves: [], whTransfers: [], stockMoves: [{ id: 'a', date: '2026-11-01', at: '2026-11-01T08:00', itemId: 'ga', kind: 'purchase', qty: 3, unitCost: 10 }, { id: 'b', date: '2026-11-01', at: '2026-11-01T08:00', itemId: 'oi', kind: 'purchase', qty: 10, unitCost: 8 }] }));
  }); await p.waitForTimeout(400);
  await p.click('button:has-text("أمر إنتاج جديد")'); await p.waitForTimeout(200);
  await p.fill('input[aria-label="الكمية المخططة"]', '20'); await p.waitForTimeout(200);
  assert.match(await p.locator('.modal').innerText(), /ينقص[\s\S]*الرصيد الحالي لا يكفي/, 'النقص ظاهر قبل الإنشاء');
  await p.click('.modal button:has-text("إنشاء الأمر")'); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => window.cur.prodOrders.length), 1);
  await p.click('button:has-text("تسجيل الإنتاج")'); await p.waitForTimeout(200);
  assert.equal(await p.locator('.modal button:has-text("تأكيد الإنتاج")').isDisabled(), true, 'الإكمال ممنوع مع النقص');
  await p.fill('input[aria-label="الكمية المنتجة فعلًا"]', '10'); await p.waitForTimeout(200);
  assert.match(await p.locator('.modal').innerText(), /تكلفة الدفعة[\s\S]*89\.00/);
  await p.click('.modal button:has-text("تأكيد الإنتاج")'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ st: window.cur.prodOrders[0].status, made: window.cur.prodOrders[0].made, kinds: window.cur.stockMoves.filter(m => m.prodId).map(m => m.kind + ':' + m.itemId + ':' + m.qty).sort() }));
  assert.deepEqual(r, { st: 'done', made: 10, kinds: ['prod_in:pp_sauce:10', 'prod_out:ga:-2.5', 'prod_out:oi:-8'] });
  assert.match(await p.locator('[data-prod]').innerText(), /منجز[\s\S]*50%|50%[\s\S]*منجز/, 'الإنجاز = الفعلي ÷ المخطط');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v42.8 بطاقة التحضيرة: «تُخزَّن صنفًا» تُنشئ صنفًا مخزنيًا مرتبطًا مرة واحدة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/recipes');
  await p.evaluate(() => window.setOrg(g => ({ ...g, items: [{ id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }], preps: [{ id: 'sauce', name: 'ثومية', unit: 'كجم', batch: 5, parts: [{ itemId: 'ga', qty: 1 }] }] }))); await p.waitForTimeout(300);
  await p.locator('.me-row:has-text("ثومية") button:has-text("تعديل")').click(); await p.waitForTimeout(150);
  await p.locator('.modal label:has-text("تُخزَّن صنفًا") input').check();
  await p.click('.modal button:has-text("حفظ")'); await p.waitForTimeout(300);
  let it = await p.evaluate(() => window.curOrg.items.filter(i => i.prepId === 'sauce'));
  assert.deepEqual(it.map(i => [i.id, i.name, i.unit, i.type, i.cost]), [['pp_sauce', 'ثومية', 'كجم', 'stock', 2]]);
  await p.locator('.me-row:has-text("ثومية") button:has-text("تعديل")').click(); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("حفظ")'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.items.filter(i => i.prepId === 'sauce').length), 1, 'لا تكرار عند الحفظ مرة أخرى');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v42.9 الطاولات والحساب المفتوح وشاشة المطبخ: جولتان للطاولة، تذاكر المطبخ، ثم الدفع يغلق الحساب', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], tables: { b1: 4 }, kds: true, autoPrint: false },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }, { id: 'h', name: 'حمص', sellPrice: 18, cat: 'مقبلات' }] }));
    window.setOps(o => ({ ...o, posTabs: [], kdsTickets: [], posOrders: [] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.click('.pos-seg button:has-text("محلي")');
  await p.selectOption('select[aria-label="الطاولة"]', '2');
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.locator('.pos-tile:has-text("كبسة")').click(); await p.locator('.pos-tile:has-text("حمص")').click();
  await p.click('button:has-text("إرسال للمطبخ")'); await p.waitForTimeout(300);
  await p.selectOption('select[aria-label="الطاولة"]', '2');
  await p.locator('.pos-tile:has-text("حمص")').click(); await p.click('button:has-text("إرسال للمطبخ")'); await p.waitForTimeout(300);
  let r = await p.evaluate(() => ({ tabs: window.cur.posTabs.map(t => [t.table, t.status, t.rounds.length]), k: window.cur.kdsTickets.map(k => [k.table, k.status, k.lines.map(l => l.name + l.qty).join()]) }));
  assert.deepEqual(r, { tabs: [['2', 'open', 2]], k: [['2', 'new', 'كبسة2,حمص1'], ['2', 'new', 'حمص1']] });
  assert.equal(await p.evaluate(() => JSON.stringify(window.cur.kdsTickets).includes('price')), false, 'المطبخ لا يرى الأسعار');
  // شاشة المطبخ
  await p.click('.pos-tabs button:has-text("المطبخ")'); await p.waitForTimeout(200);
  await p.locator('[data-kds] .pos-ticket').first().locator('button').click(); await p.waitForTimeout(250);
  assert.deepEqual(await p.evaluate(() => window.cur.kdsTickets.map(k => k.status)), ['prep', 'new']);
  // الطاولات ← الدفع
  await p.click('.pos-tabs button:has-text("الطاولات")'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-tables] .pos-tbl.busy').innerText(), /2[\s\S]*152\.00/, '2×58 + 2×18 = 152');
  await p.click('[data-tables] .pos-tbl.busy'); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("الدفع")'); await p.waitForTimeout(250);
  assert.match(await p.locator('.pos-cart').innerText(), /دفع حساب الطاولة/);
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ tab: window.cur.posTabs[0].status, orderNo: !!window.cur.posTabs[0].orderNo, kN: window.cur.kdsTickets.length }));
  assert.deepEqual(r, { tab: 'paid', orderNo: true, kN: 2 }, 'الدفع يغلق الحساب ولا يكرر تذكرة المطبخ');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-005 الصالات: إعدادها بالنطاقات (مع رفض التداخل)، الطاولات مجمّعة حسب الصالة، والفاتورة تحمل صالتها', async () => {
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosSettings/admin');
    await p.evaluate(() => window.setOrg(g => ({ ...g, posCfg: { ...(g.posCfg || {}), branches: ['b1'], tables: { b1: 8 } } }))); await p.waitForTimeout(200);
    await p.evaluate(() => window.as('ctl')); await p.waitForTimeout(150); await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300);   // إعادة تركيب الشاشة بالإعداد الجديد
    const ed = p.locator('[data-areaed]').first();
    await ed.locator('button:has-text("+ صالة")').click(); await ed.locator('button:has-text("+ صالة")').click();
    const nm = ed.locator('input[aria-label="اسم الصالة"]'), fr = ed.locator('input[aria-label="من طاولة"]'), to = ed.locator('input[aria-label="إلى طاولة"]');
    await nm.nth(0).fill('الرئيسية'); await fr.nth(0).fill('1'); await to.nth(0).fill('5');
    await nm.nth(1).fill('العائلات'); await fr.nth(1).fill('5'); await to.nth(1).fill('8');
    await p.locator('.card button.pri', { hasText: /^حفظ$/ }).click(); await p.waitForTimeout(250);
    assert.match(await p.evaluate(() => window.lastSay || ''), /متداخلتان/);
    await fr.nth(1).fill('6'); await p.locator('.card button.pri', { hasText: /^حفظ$/ }).click(); await p.waitForTimeout(250);
    assert.deepEqual(await p.evaluate(() => window.curOrg.posCfg.areas.b1.map(a => [a.name, a.from, a.to])), [['الرئيسية', 1, 5], ['العائلات', 6, 8]]);
    assert.deepEqual(errs, []); await ctx.close(); }
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], tables: { b1: 8 }, areas: { b1: [{ id: 'am', name: 'الرئيسية', from: 1, to: 5 }, { id: 'af', name: 'العائلات', from: 6, to: 8 }] }, autoPrint: false },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posTabs: [], kdsTickets: [], posOrders: [] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.click('.pos-tabs button:has-text("الطاولات")'); await p.waitForTimeout(200);
  assert.deepEqual(await p.locator('[data-area]').evaluateAll(els => els.map(e => [e.getAttribute('data-area'), e.querySelectorAll('.pos-tbl').length])), [['الرئيسية', 5], ['العائلات', 3]]);
  await p.click('[data-areas] button:has-text("العائلات")'); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-area]').count(), 1, 'منتقي الصالة');
  await p.click('[data-area="العائلات"] .pos-tbl >> nth=1'); await p.waitForTimeout(200);
  await p.locator('.pos-tile:has-text("كبسة")').click();
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(500);
  assert.deepEqual(await p.evaluate(() => window.cur.posOrders.map(o => [o.table, o.areaId, o.areaName])), [['7', 'af', 'العائلات']]);
  await p.click('.pos-tabs button:has-text("الطاولات")'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-areasales]').innerText(), /العائلات[\s\S]*58\.00/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-006 التوصيل: إضافة سائق، طلب توصيل بعنوانه، إسناده ثم «تم التوصيل»، والعهدة النقدية وتسويتها', async () => {
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosSettings/admin');
    await p.click('[data-drivers] button:has-text("+ سائق")');
    await p.fill('input[aria-label="اسم السائق"]', 'أحمد'); await p.fill('input[aria-label="جوال السائق"]', '0551112222');
    await p.locator('.card button.pri', { hasText: /^حفظ$/ }).click(); await p.waitForTimeout(250);
    assert.deepEqual(await p.evaluate(() => window.curOrg.posCfg.drivers.map(d => [d.name, d.phone, d.active])), [['أحمد', '0551112222', true]]);
    assert.deepEqual(errs, []); await ctx.close(); }
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false, drivers: [{ id: 'd1', name: 'أحمد', active: true }] },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [], posDeliveries: [] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.click('.pos-seg button:has-text("توصيل")');
  await p.fill('input[aria-label="عنوان التوصيل"]', 'حي النسيم، شارع 5'); await p.fill('input[aria-label="جوال التوصيل"]', '0500000000');
  await p.locator('.pos-tile:has-text("كبسة")').click();
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(600);
  assert.deepEqual(await p.evaluate(() => window.cur.posDeliveries.map(x => [x.st, x.addr, x.phone, x.cash])), [['new', 'حي النسيم، شارع 5', '0500000000', 58]]);
  await p.click('.pos-tabs button:has-text("التوصيل")'); await p.waitForTimeout(200);
  const no = await p.evaluate(() => window.cur.posDeliveries[0].no);
  await p.selectOption('select[aria-label="سائق ' + no + '"]', 'd1'); await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-dlvcol="out"] [data-dlv]').count(), 1);
  await p.click('[data-dlvcol="out"] button:has-text("تم التوصيل")'); await p.waitForTimeout(300);
  assert.match(await p.locator('[data-dlvsum]').innerText(), /أحمد[\s\S]*58\.00/);
  await p.click('[data-dlvsum] button:has-text("استلام النقد")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.posDeliveries.map(x => [x.st, x.driverName, !!x.settledAt])), [['done', 'أحمد', true]]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-024 طلب عروض الأسعار: إنشاء لموردَين، إدخال العروض، المقارنة، والترسية الأفضل لكل صنف إلى أوامر شراء', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/purchasing:rfq');
  await p.evaluate(() => window.setOps(o => ({ ...o, rfqs: [], purchaseOrders: [] }))); await p.waitForTimeout(300);
  await p.click('[data-rfq] button:has-text("طلب جديد")'); await p.waitForTimeout(200);
  await p.fill('input[aria-label="موضوع الطلب"]', 'لحوم وخضار');
  await p.fill('input[aria-label="وصف 1"]', 'لحم غنم'); await p.fill('input[aria-label="كمية 1"]', '20');
  await p.click('.modal button:has-text("صنف")'); await p.fill('input[aria-label="وصف 2"]', 'طماطم'); await p.fill('input[aria-label="كمية 2"]', '50');
  await p.check('input[aria-label="مورد مؤسسة اللحوم الطازجة للتجارة"]');
  await p.click('.modal button:has-text("إنشاء الطلب")'); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.lastSay || ''), /موردَين على الأقل/);
  await p.check('input[aria-label="مورد شركة الخضار"]'); await p.click('.modal button:has-text("إنشاء الطلب")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.rfqs.map(r => [r.no, r.lines.length, r.suppliers.length, r.status])), [['RFQ-0001', 2, 2, 'open']]);
  await p.click('[data-quote="مؤسسة اللحوم الطازجة للتجارة"]'); await p.waitForTimeout(150);
  await p.fill('input[aria-label="سعر لحم غنم"]', '60'); await p.fill('input[aria-label="سعر طماطم"]', '5'); await p.click('.modal button:has-text("حفظ العرض")'); await p.waitForTimeout(250);
  await p.click('[data-quote="شركة الخضار"]'); await p.waitForTimeout(150);
  await p.fill('input[aria-label="سعر لحم غنم"]', '65'); await p.fill('input[aria-label="سعر طماطم"]', '3.5'); await p.fill('input[aria-label="مدة التوريد"]', '1'); await p.click('.modal button:has-text("حفظ العرض")'); await p.waitForTimeout(250);
  assert.match(await p.locator('[data-rfqview]').innerText(), /الأفضل لكل صنف: 1,375\.00[\s\S]*يوفر 75\.00/, '20×60 + 50×3.5 = 1375؛ أفضل كامل 1450');
  await p.click('[data-rfqview] button:has-text("ترسية الأفضل لكل صنف")'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({ rfq: window.cur.rfqs[0].status, pos: window.cur.purchaseOrders.map(x => [x.supplierName, x.lines.map(l => l.desc + ':' + l.qty + '×' + l.price).join()]) }));
  assert.deepEqual(r, { rfq: 'awarded', pos: [['مؤسسة اللحوم الطازجة للتجارة', 'لحم غنم:20×60'], ['شركة الخضار', 'طماطم:50×3.5']] });
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-037 ربحية الأصناف والفروع: من فواتير نقطة البيع، حسب الصنف والفرع والتفصيل، والإيراد بلا تكلفة معروفة يُذكر ولا يدخل الهامش', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/admin/analytics:profitmx');
  await p.evaluate(() => {
    const t = new Date().toISOString().slice(0, 10);
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 10 }], products: [{ id: 'K', name: 'كبسة', sellPrice: 40, parts: [{ itemId: 'i1', qty: 1 }] }, { id: 'S', name: 'شاي', sellPrice: 5, parts: [] }] }));
    window.setOps(o => ({ ...o, stockMoves: [], whMoves: [], posOrders: [
      { id: 'a', branchId: 'b1', date: t, status: 'paid', net: 85, lines: [{ productId: 'K', name: 'كبسة', qty: 2, price: 40 }, { productId: 'S', name: 'شاي', qty: 1, price: 5 }] },
      { id: 'b', branchId: 'b2', date: t, status: 'paid', net: 40, lines: [{ productId: 'K', name: 'كبسة', qty: 1, price: 40 }] }] }));
  }); await p.waitForTimeout(400);
  assert.match(await p.locator('[data-pmx]').innerText(), /الإيراد الصافي[\s\S]*125\.00[\s\S]*مجمل الربح[\s\S]*90\.00/, 'كبسة 3 × (40 − 10) = 90؛ الشاي بلا تكلفة');
  assert.match(await p.locator('[data-pmxtable]').innerText(), /كبسة[\s\S]*120\.00[\s\S]*30\.00[\s\S]*90\.00[\s\S]*75%/);
  await p.click('[data-pmx] button:has-text("حسب الفرع")'); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-pmxtable] tbody tr').count(), 2);
  await p.click('[data-pmx] button:has-text("صنف × فرع × فترة")'); await p.waitForTimeout(150);
  assert.match(await p.locator('[data-pmxtable]').innerText(), /شاي[\s\S]*غير معروفة/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-013 مواقع التخزين: إدخال موقع الصنف لكل مستودع، حفظه، وظهوره في قائمة الأصناف', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/admin/items');
  await p.waitForTimeout(300);
  const first = await p.evaluate(() => window.curOrg.items.filter(i => i.isActive !== false && (i.type || 'stock') === 'stock')[0]);
  await p.locator('tr', { hasText: first.name }).first().locator('button', { hasText: 'تعديل' }).click(); await p.waitForTimeout(150);
  await p.locator('[data-bins] input').first().fill('C-12');
  await p.locator('button', { hasText: 'حفظ الصنف' }).click(); await p.waitForTimeout(250);
  const it = await p.evaluate((id) => window.curOrg.items.find(x => x.id === id), first.id);
  assert.equal(Object.values(it.bins || {})[0], 'C-12');
  assert.match(await p.locator('tr', { hasText: first.name }).first().innerText(), /C-12/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.2 MQ-011 صلاحيات نقطة البيع: الكاشير لا يتجاوز حد الخصم ولا يلغي ولا يُرجع، ومدير الفرع يتجاوز الحد', async () => {
  const setup = async (p) => { await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false, maxDiscPct: 10, returns: true }, products: [{ id: 'k', name: 'كبسة', sellPrice: 100, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [] })); }); await p.waitForTimeout(400);
    const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); } };
  const sell = async (p, amt) => { await p.locator('.pos-tile:has-text("كبسة")').click();
    await p.click('button:has-text("+ خصم")'); await p.locator('.pos-cart input.inp.n').first().fill(String(amt)); await p.fill('.pos-cart input[placeholder="إلزامي"]', 'عميل دائم');
    await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(500); };
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/cs'); await setup(p);
    await sell(p, 20);
    assert.match(await p.evaluate(() => window.lastSay || ''), /يتجاوز الحد المسموح للكاشير \(10%\)/);
    assert.equal(await p.evaluate(() => window.cur.posOrders.length), 0, 'لم تُسجَّل');
    await p.evaluate(() => window.setOps(o => ({ ...o, posOrders: [{ id: 'x1', no: 'ف1-1', branchId: 'b1', date: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), status: 'paid', total: 100, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 100 }], payments: [{ m: 'cash', amount: 100 }] }] })));
    await p.keyboard.press('Escape'); await p.waitForTimeout(200); if (await p.locator('.modal').count()) { await p.locator('.modal button:has-text("إلغاء")').first().click().catch(() => {}); await p.waitForTimeout(200); }
    await p.click('.pos-tabs button:has-text("الفواتير")'); await p.waitForTimeout(250);
    assert.equal(await p.locator('button:has-text("إلغاء")').filter({ hasText: /^إلغاء$/ }).count(), 0, 'لا زر إلغاء للكاشير');
    assert.equal(await p.locator('button:has-text("مرتجع")').count(), 0, 'لا زر مرتجع للكاشير');
    assert.deepEqual(errs, []); await ctx.close(); }
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm'); await setup(p);
    await sell(p, 20);
    assert.deepEqual(await p.evaluate(() => window.cur.posOrders.map(o => [o.total, o.manualDisc])), [[80, 20]], 'المدير يتجاوز الحد');
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v49.3 سياسة تكلفة المخزون: المتوسط المرجّح افتراضي وموصى، مقارنة الطريقتين، واعتماد FIFO بتأكيد المدير', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/admin/items');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, warehouses: [], costCfg: undefined, items: [{ id: 'z', name: 'زيت', unit: 'لتر', type: 'stock', cost: 10 }] }));
    window.setOps(o => ({ ...o, whMoves: [], whTransfers: [], stockMoves: [
      { id: 'a', itemId: 'z', kind: 'in', qty: 10, unitCost: 10, date: '2026-11-01', at: '2026-11-01T08:00:00Z' },
      { id: 'b', itemId: 'z', kind: 'in', qty: 10, unitCost: 12, date: '2026-11-02', at: '2026-11-02T08:00:00Z' },
      { id: 'c', itemId: 'z', kind: 'out', qty: -15, date: '2026-11-03', at: '2026-11-03T08:00:00Z' }] }));
  }); await p.waitForTimeout(400);
  const card = p.locator('[data-costpolicy]');
  assert.match(await card.innerText(), /الحالية: المتوسط المرجّح[\s\S]*الافتراضي · موصى به/);
  assert.equal(await card.locator('input[aria-label="المتوسط المرجّح"]').isChecked(), true);
  await card.locator('[data-costcmp]').click(); await p.waitForTimeout(150);
  await card.locator('input[aria-label="مقارنة من"]').fill('2026-11-01'); await card.locator('input[aria-label="مقارنة إلى"]').fill('2026-11-30'); await p.waitForTimeout(200);
  assert.match(await card.locator('[data-costcmptable]').innerText(), /المتوسط 55\.00 · FIFO 60\.00[\s\S]*المتوسط 165\.00 · FIFO 160\.00/);
  await card.locator('input[aria-label="الوارد أولًا يصرف أولًا (FIFO)"]').check();
  await card.locator('button:has-text("اعتماد")').click(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.costCfg.method), 'fifo');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.4 المرحلة 03: من ميزان المراجعة إلى دفتر الأستاذ برصيد جارٍ ثم إلى القيد، وحركة الحسابات متوازنة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/tb');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [
    { id: 'g1', date: '2026-10-05', title: 'تمويل أول', status: 'posted', lines: [{ code: '1101', debit: 1000, credit: 0 }, { code: '3101', debit: 0, credit: 1000 }] },
    { id: 'g2', date: '2026-11-05', title: 'سحب نقدي', status: 'posted', lines: [{ code: '3101', debit: 300, credit: 0 }, { code: '1101', debit: 0, credit: 300 }] }] })));
  await p.waitForTimeout(400);
  await p.locator('[data-tbgl="1101"]').click(); await p.waitForTimeout(300);
  const gl = p.locator('[data-gl]');
  assert.equal(await p.locator('select[aria-label="الحساب"]').inputValue(), '1101');
  const txt = await gl.innerText();
  assert.match(txt, /تمويل أول[\s\S]*سحب نقدي/);
  await gl.locator('[data-rptrow]', { hasText: 'سحب نقدي' }).click(); await p.waitForTimeout(300);
  assert.match(await p.locator('.mz-docv, .modal').last().innerText(), /سحب نقدي/, 'فتح القيد من الدفتر');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const cl = p.locator('.mz-docv button:has-text("إغلاق"), .modal button:has-text("إغلاق")'); if (await cl.count()) { await cl.first().click(); await p.waitForTimeout(150); }
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/actmv');
    await p.waitForTimeout(400);
    assert.match(await p.locator('[data-actmv]').innerText(), /متوازن ✓/);
    await p.locator('[data-actmv] [data-rptrow]').first().click(); await p.waitForTimeout(250);
    assert.equal(await p.locator('[data-gl]').count(), 1, 'اسم الحساب يفتح دفتره');
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v49.4 MQ-048 طرق الإهلاك: القسط الثابت افتراضي وموصى، اختيار المتناقص مع القيمة المتبقية ومعاينة إهلاك السنوات', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/ast');
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'أصل جديد' }).first().click(); await p.waitForTimeout(200);
  const m = p.locator('.modal');
  await m.locator('input[placeholder^="فرن مطبخ"]').fill('فرن');
  await m.locator('.inp.n').first().fill('12000');
  assert.equal(await m.locator('input[aria-label="القسط الثابت"]').isChecked(), true);
  assert.match(await m.locator('[data-depm]').innerText(), /القسط الثابت[\s\S]*الافتراضي · موصى به/);
  await m.locator('input[aria-label="القيمة المتبقية"]').fill('2000');
  await m.locator('input[aria-label="القسط المتناقص (المضاعف)"]').check();
  assert.match(await m.locator('[data-depprev]').innerText(), /س1:/);
  await m.locator('button:has-text("حفظ الأصل")').click(); await p.waitForTimeout(300);
  const a = await p.evaluate(() => (window.curOrg.assets || []).find(x => x.name === 'فرن'));
  assert.deepEqual([a.depMethod, a.salvage, a.cost], ['ddb', 2000, 12000]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.5 MQ-059 مسارات الاعتماد: تهيئة مستويين للقيود، المحاسب يعتمد الأول فيبقى معلّقًا، والمالك يعتمد الأخير فيُرحَّل', async () => {
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
    await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(400);
    const c = p.locator('[data-wf]'); await c.locator('button:has-text("تهيئة")').click();
    const je = c.locator('[data-wfdoc="je"]');
    await je.locator('button:has-text("مستوى")').click(); await je.locator('button:has-text("مستوى")').click();
    await je.locator('input[aria-label="اسم المستوى 1"]').fill('المحاسبة'); await je.locator('input[aria-label="حد المستوى 1"]').fill('0');
    await je.locator('input[aria-label^="دور محاسب"][aria-label$=" 1"]').first().check();
    await je.locator('input[aria-label="اسم المستوى 2"]').fill('المالك'); await je.locator('input[aria-label="حد المستوى 2"]').fill('1000');
    await je.locator('input[aria-label^="دور الإدارة العليا"][aria-label$=" 2"]').first().check();
    await c.locator('button:has-text("حفظ المسارات")').click(); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => window.curOrg.wf.je.tiers.map(t => [t.label, t.min, t.roles.length > 0])), [['المحاسبة', 0, true], ['المالك', 1000, true]]);
    assert.deepEqual(errs, []); await ctx.close(); }
  const seed = async (p) => { await p.evaluate(() => {
    window.setOrg(g => ({ ...g, wf: { je: { tiers: [{ id: 'a', min: 0, roles: ['accountant'], label: 'المحاسبة' }, { id: 'b', min: 1000, roles: ['general_management'], label: 'المالك' }] } } }));
    if (!(window.cur.journalManual || []).some(j => j.id === 'wj')) window.setOps(o => ({ ...o, journalManual: [{ id: 'wj', date: new Date().toISOString().slice(0, 10), title: 'قيد كبير', by: 'سعد', byId: 'zz', createdAt: new Date().toISOString(), status: 'pending', lines: [{ code: '1101', debit: 5000, credit: 0 }, { code: '3101', debit: 0, credit: 5000 }] }] })); }); await p.waitForTimeout(400); };
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/acc/jr'); await seed(p);
  await p.click('button:has-text("قيود بانتظار الاعتماد (1)")'); await p.waitForTimeout(250);
  assert.match(await p.locator('[data-wfstep]').first().innerText(), /المستوى 1\/2: المحاسبة/);
  await p.locator('button:has-text("اعتماد وترحيل")').first().click(); await p.waitForTimeout(300);
  let j = await p.evaluate(() => window.cur.journalManual.find(x => x.id === 'wj'));
  assert.deepEqual([j.status, j.approvals.map(a => a.label)], ['pending', ['المحاسبة']], 'المستوى الأول فقط — لم يُرحَّل');
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(400);
  if (!(await p.locator('[data-wfstep]').count())) { await p.click('button:has-text("قيود بانتظار الاعتماد (1)")'); await p.waitForTimeout(250); }
  assert.match(await p.locator('[data-wfstep]').first().innerText(), /المستوى 2\/2: المالك/);
  await p.locator('button:has-text("اعتماد وترحيل")').first().click(); await p.waitForTimeout(300);
  j = await p.evaluate(() => window.cur.journalManual.find(x => x.id === 'wj'));
  assert.deepEqual([j.status, j.approvals.length], ['posted', 2]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v50.0 المرحلة 05 الجدول الموحد: فرز وإخفاء عمود وبحث وعرض محفوظ، ومخرجات Excel وCSV والطباعة بالقالب الموحد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/actmv');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [
    { id: 'r1', date: '2026-10-05', title: 'تمويل', status: 'posted', lines: [{ code: '1101', debit: 1000, credit: 0 }, { code: '3101', debit: 0, credit: 1000 }] },
    { id: 'r2', date: '2026-10-06', title: 'إيداع', status: 'posted', lines: [{ code: '1201', debit: 400, credit: 0 }, { code: '1101', debit: 0, credit: 400 }] }] })));
  await p.waitForTimeout(400);
  const T = p.locator('[data-rpttable="actmv"]');
  const debits = async () => (await T.locator('[data-rptrow] td:nth-child(4)').allInnerTexts()).map(x => Number(x.replace(/[^\d.]/g, '')) || 0);
  const sorted = (a, d) => a.every((v, i) => !i || (d > 0 ? a[i - 1] <= v : a[i - 1] >= v));
  await T.locator('th', { hasText: /^مدين/ }).click(); await p.waitForTimeout(100);
  assert.ok(sorted(await debits(), 1), 'تصاعدي'); await T.locator('th', { hasText: /^مدين/ }).click(); await p.waitForTimeout(100);
  assert.ok(sorted(await debits(), -1), 'تنازلي');
  await T.locator('[data-rptcols]').click(); await T.locator('input[aria-label="عمود رصيد أول المدة"]').uncheck();
  assert.equal(await T.locator('th', { hasText: 'رصيد أول المدة' }).count(), 0, 'إخفاء العمود');
  await T.locator('input[aria-label="بحث في التقرير"]').fill('1201'); await p.waitForTimeout(100);
  assert.equal(await T.locator('[data-rptrow]').count(), 1);
  await p.evaluate(() => { window.prompt = () => 'بنوك فقط'; });
  await T.locator('[data-rptsave]').click(); await p.waitForTimeout(150);
  assert.match(await T.locator('select[aria-label="العروض المحفوظة"]').innerText(), /بنوك فقط/);
  const [dl1] = await Promise.all([p.waitForEvent('download'), T.locator('[data-rptxlsx]').click()]);
  const fs = await import('node:fs'); const xb = fs.readFileSync(await dl1.path()).toString('latin1');
  assert.ok(xb.startsWith('PK') && /<f>SUM\(/.test(xb) && /ySplit/.test(xb), 'ملف Excel حقيقي بمجاميع بصيغ ورأس مجمّد');
  const [dl2] = await Promise.all([p.waitForEvent('download'), T.locator('[data-rptcsv]').click()]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8');
  assert.match(csv, /^\uFEFF/); assert.match(csv, /1201/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v50.1 المرحلة 06 «مهامي» على الرئيسية: القيد المعلّق يظهر لمحاسب آخر ويفتح دفتر اليومية، والكاشير لا يرى المالية', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/MyWork/acc');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [{ id: 'mw', date: new Date().toISOString().slice(0, 10), title: 'قيد للتجربة', by: 'سعد', byId: 'zz', status: 'pending', lines: [{ code: '1101', debit: 250, credit: 0 }, { code: '3101', debit: 0, credit: 250 }] }] })));
  await p.waitForTimeout(400);
  const W = p.locator('[data-mywork]');
  assert.match(await W.innerText(), /مهامي[\s\S]*بند ينتظرك/);
  await W.locator('[data-mywork-item]', { hasText: 'قيد للتجربة' }).click(); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.__nav || ''), /acct/, 'البند يفتح المحاسبة (دفتر اليومية)');
  await p.evaluate(() => window.as('cs')); await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-mywork-cat="fin"]').count(), 0, 'الكاشير لا يرى المالية');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.0 الواجهة الإنجليزية: الاتجاه LTR وترجمة الإطار (التطبيقات، رأس المركز، شريط الأقسام) والعربية افتراضيًا', async () => {
  // افتراضيًا: عربي RTL
  { const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'comp/Launcher');
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.rms')).direction), 'rtl');
    assert.match(await p.locator('.lh').innerText(), /كل التطبيقات/); assert.deepEqual(errs, []); await ctx.close(); }
  const ctxOpt = { viewport: { width: 1280, height: 900 } };
  const ctx = await browser.newContext(ctxOpt); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'comp/Launcher'); await p.waitForTimeout(400); await settle(p);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.rms')).direction), 'ltr');
  const lh = await p.locator('.lh').innerText();
  assert.match(lh, /All apps/); assert.match(lh, /Good (morning|evening)/);
  assert.ok(await p.locator('.lh-nm', { hasText: 'Point of Sale' }).count() > 0 || await p.locator('.lh-nm', { hasText: /POS|Sales/ }).count() > 0, 'أسماء التطبيقات بالإنجليزية');
  assert.equal(await p.getAttribute('.lh-search input', 'placeholder'), 'Search apps or sections… (try: break-even, payroll, cash flow)');
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'hub/analytics/exec'); await p.waitForTimeout(400); await settle(p);
  const hd = await p.locator('.card').first().innerText();
  assert.match(hd, /Analytics & Performance/); assert.match(hd, /Dashboards/);
  // القائمة المنسدلة تُفتح باتجاه LTR وبعناوين إنجليزية
  await p.locator('.ob-it', { hasText: 'Dashboards' }).first().click(); await p.waitForTimeout(150);
  assert.equal(await p.getAttribute('.ob-layer', 'dir'), 'ltr');
  assert.match(await p.locator('.ob-menu').innerText(), /Executive Dashboard/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.1 نقطة البيع بالإنجليزية: الواجهة مترجمة، أسماء الأصناف (بيانات) كما هي، والبيع يعمل دون أخطاء', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(base + 'live/PosApp/bm'); await p.waitForTimeout(400); await settle(p);
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [] })); }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("Open shift")'); if (await ob.count()) { await ob.first().click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.waitForTimeout(200);
  const txt = await p.locator('#r').innerText();
  assert.match(txt, /Sell/); assert.match(txt, /Invoices/); assert.match(txt, /Total/); assert.match(txt, /كبسة/, 'اسم الصنف بيانات لا يُترجم');
  assert.doesNotMatch(txt, /الإجمالي|الفواتير|الورديات والتقارير/, 'لا نصوص واجهة عربية متبقية في الأساسيات');
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.waitForTimeout(200);   // تحديث عُقد مترجمة لا يكسر React
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.2 الإغلاق والاعتماد بالإنجليزية: النموذج وقائمة الاعتماد مترجمان، واسم الفرع (بيانات) كما هو', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = [];
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/ClosingForm/bm'); await p.waitForTimeout(800); await settle(p);
  let t = await p.locator('body').innerText();
  for (const w of ['New shift closing', 'Cash & sales', 'Opening float', 'Pre-posting audit checks', 'Post to finance', 'Save as draft']) assert.ok(t.includes(w), w);
  assert.doesNotMatch(t, /العهدة الافتتاحية|حفظ كمسودة|فحوص المدقق/);
  assert.equal(await p.locator('textarea[placeholder^="One amount"], input[placeholder^="One amount"]').count() > 0, true, 'placeholder مترجم');
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Hub/admin/closehub:approve'); await p.waitForTimeout(800); await settle(p);
  t = await p.locator('body').innerText();
  for (const w of ['Awaiting financial audit', 'Approve audit', 'Return', 'Recorded by']) assert.ok(t.includes(w), w);
  assert.match(t, /\d{2} Nov 2026|\d{2} [A-Z][a-z]{2} \d{4}/, 'التواريخ بالإنجليزية'); assert.match(t, /عم قاسم/, 'اسم الفرع بيانات لا يُترجم');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.3 المخزون بالإنجليزية: الشاشات ونافذة الصنف الجديد مترجمة، وأسماء الأصناف كما هي', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = []; const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Inventory/admin/items'); await p.waitForTimeout(800); await settle(p);
  let t = await p.locator('body').innerText();
  for (const w of ['Stock value (last cost)', 'Items below reorder level', 'New item', 'Average cost']) assert.ok(t.includes(w), w);
  assert.match(t, /لحم غنم/, 'اسم الصنف بيانات');
  await p.locator('button', { hasText: 'New item' }).first().click(); await p.waitForTimeout(400);
  t = await p.locator('body').innerText();
  for (const w of ['Item name', 'Minimum reorder level', 'Save item']) assert.ok(t.includes(w), w);
  assert.doesNotMatch(t, /اسم الصنف|حفظ الصنف|حد الطلب الأدنى/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.4 المحاسبة والمالية بالإنجليزية: القوائم والإقرار مترجمة، وأرقام القيود بصيغة JV، وأسماء الفروع كما هي', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = [];
  for (const [r, words] of [['acct/fs', ['Income statement', 'Net sales', 'Balance sheet', 'Total current assets']], ['acct/vat', ['VAT setup', 'Output VAT (on your sales)', 'Net VAT payable']], ['acct/tb', ['Trial balance', 'Period debit']]]) {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + r); await p.waitForTimeout(800); await settle(p);
    const t = await p.locator('body').innerText();
    for (const w of words) assert.ok(t.includes(w), r + ': ' + w);
    await p.close();
  }
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'hub/finhub/acct'); await p.waitForTimeout(800); await settle(p);
  const t = await p.locator('body').innerText();
  assert.match(t, /JV-\d{4}/); assert.match(t, /Shift revenue — /); assert.match(t, /عم قاسم/, 'اسم الفرع بيانات');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.5 مسار الفحص: استلام ← فحص بشخص آخر ← مخزون ← تحويل لفاتورة (ضمن التسامح وفوقه) + فاتورة خدمات ببنود', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, purchaseCfg: { ...(g.purchaseCfg || {}), inspect: true, invVarPct: 2 }, expenseCats: [{ id: 'c1', n: 'صيانة وتشغيل' }], suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) }));
    window.setOps(o => ({ ...o, invoices: [], stockMoves: [], purchaseOrders: [{ id: 'po1', poNo: 'PO-0001', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', status: 'open', date: '2026-11-10', at: '2026-11-10T08:00:00Z', by: 'مجاهد', lines: [{ itemId: 'i1', desc: 'لحم غنم', qty: 10, price: 40, factor: 1 }] }] }));
  }); await p.waitForTimeout(300);
  const toPo = async () => { await p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await p.waitForTimeout(200); };
  await toPo();
  // 1) الاستلام: بانتظار الفحص — لا مخزون ولا فاتورة
  await p.locator('button', { hasText: 'تسجيل استلام' }).first().click(); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-grnnote]').count(), 1, 'تنبيه مسار الفحص في نافذة الاستلام');
  await p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await p.waitForTimeout(300);
  let r = await p.evaluate(() => { const po = window.cur.purchaseOrders[0]; return { g: (po.grns || []).map(g => [g.status, g.by]), inQc: po.lines[0].inQc, mv: (window.cur.stockMoves || []).length + (window.cur.whMoves || []).filter(m => m.grnRef).length, inv: window.cur.invoices.length }; });
  assert.deepEqual(r, { g: [['qc', 'سارة']], inQc: 10, mv: 0, inv: 0 });
  // 2) المستلم نفسه لا يفحص
  await p.locator('[data-qc]').first().click(); await p.locator('[data-qcsave]').click(); await p.waitForTimeout(200);
  assert.match(await say(p), /غير من سجّل الاستلام/);
  assert.equal(await p.evaluate(() => window.cur.purchaseOrders[0].grns[0].status), 'qc');
  // 3) شخص آخر يفحص: 8 مقبول و2 مرفوض بسبب
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300); await toPo();
  await p.locator('[data-qc]').first().click(); await p.fill('input[aria-label="المقبول 1"]', '8');
  await p.locator('[data-qcsave]').click(); await p.waitForTimeout(150); assert.match(await say(p), /سبب الرفض/, 'المرفوض بلا سبب يُرفض');
  await p.fill('input[placeholder="سبب الرفض (إلزامي)"]', 'تالف'); await p.locator('[data-qcsave]').click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const po = window.cur.purchaseOrders[0]; const m = [...(window.cur.stockMoves || []), ...(window.cur.whMoves || [])].filter(x => x.grnRef); return { st: po.status, rec: po.lines[0].received, inQc: po.lines[0].inQc, g: po.grns[0].status, rej: po.grns[0].qc.lines[0].rej, mv: m.map(x => [x.qty, x.unitCost]) }; });
  assert.deepEqual(r, { st: 'partial', rec: 8, inQc: 0, g: 'done', rej: 2, mv: [[8, 40]] }, 'المقبول وحده دخل المخزون بسعر الأمر، والمرفوض يبقى مطلوبًا');
  // 4) تحويل لفاتورة ضمن التسامح (40.5 = +1.25%)
  await p.locator('[data-cv]').click(); await p.waitForTimeout(150);
  await p.locator('.modal [data-pm="credit"]').click(); await p.locator('[data-cvsave]').click(); await p.waitForTimeout(150); assert.match(await say(p), /رقم فاتورة المورد/, 'رقم فاتورة المورد إلزامي');
  await p.fill('.modal input.inp >> nth=0', 'F-100'); await p.fill('input[aria-label="سعر الفاتورة 1"]', '40.5');
  assert.equal(await p.getAttribute('[data-var]', 'data-var'), '1.25');
  await p.locator('.modal [data-pm="credit"]').click(); await p.locator('[data-cvsave]').click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => window.cur.invoices.map(i => [i.invoiceNo, i.amount, i.vatAmt, (i.grnRefs || []).length, i.lines[0].net]));
  assert.deepEqual(r, [['F-100', 372.6, 48.6, 1, 324]]);
  // 5) استلام المتبقي وفحصه، ثم فاتورة فوق التسامح (45 = +12.5%) تنتظر اعتماد شخص آخر
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(300); await toPo();
  await p.locator('button', { hasText: 'تسجيل استلام' }).first().click(); await p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300); await toPo();
  await p.locator('[data-qc]').first().click(); await p.locator('[data-qcsave]').click(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.cur.purchaseOrders[0].status), 'received');
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(300); await toPo();
  assert.equal(await p.locator('[data-cv]').count(), 0, 'v44.0: المكتب الرئيسي لا يحوّل لفاتورة — المحاسب ومدير النظام فقط');
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300); await toPo();
  await p.locator('[data-cv]').click(); await p.fill('.modal input.inp >> nth=0', 'F-101'); await p.fill('input[aria-label="سعر الفاتورة 1"]', '45');
  await p.locator('.modal [data-pm="credit"]').click(); await p.locator('[data-cvsave]').click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ inv: window.cur.invoices.length, pv: window.cur.purchaseOrders[0].pinv && [window.cur.purchaseOrders[0].pinv.invoiceNo, window.cur.purchaseOrders[0].pinv.varPct] }));
  assert.deepEqual(r, { inv: 1, pv: ['F-101', 12.5] }, 'فوق التسامح لا تُقيَّد قبل الاعتماد');
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(300); await toPo();
  await p.locator('button', { hasText: 'اعتماد الفرق' }).click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ nos: window.cur.invoices.map(i => i.invoiceNo).sort(), held: !!window.cur.purchaseOrders[0].pinv, bill: window.cur.purchaseOrders[0].grns.every(g => !!g.invoiceId) }));
  assert.deepEqual(r, { nos: ['F-100', 'F-101'], held: false, bill: true });
  // 6) فاتورة خدمات ومصروفات ببندين على حسابين
  await p.locator('button', { hasText: 'فواتير الموردين الآجلة' }).first().click(); await p.waitForTimeout(200);
  await p.locator('[data-svc]').click(); await p.waitForTimeout(200);
  await p.fill('[data-svcline] >> nth=0 >> input >> nth=0', 'صيانة مكيف');
  const opt = await p.locator('select[aria-label="حساب البند 1"] option').nth(1).getAttribute('value');
  await p.selectOption('select[aria-label="حساب البند 1"]', opt); await p.fill('input[aria-label="مبلغ البند 1"]', '600');
  await p.locator('button', { hasText: 'بند آخر' }).click();
  await p.fill('[data-svcline] >> nth=1 >> input >> nth=0', 'رسوم'); await p.selectOption('select[aria-label="حساب البند 2"]', opt); await p.fill('input[aria-label="مبلغ البند 2"]', '100');
  await p.locator('[data-svcline] >> nth=1 >> input[type=checkbox]').uncheck();
  await p.locator('.modal [data-pm="credit"]').click(); await p.locator('[data-svcsave]').click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const i = window.cur.invoices.find(x => x.kind === 'svc'); return i && [i.amount, i.vatAmt, i.expLines.map(l => [l.net, l.vat])]; });
  assert.deepEqual(r, [790, 90, [[600, 90], [100, 0]]]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.6 التحليل والتقارير بالإنجليزية: اللوحات والتعادل والتوقع والتدفق النقدي مترجمة', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = [];
  for (const [r, words] of [['hub/analytics/exec', ["Today's sales", 'Quick alerts']], ['hub/analytics/breakeven', ['Break-even (monthly)', 'Prime cost']], ['hub/analytics/forecast', ['Next week']], ['hub/reporting/cashflow', ['Forecast cash flow — 13 weeks', 'Week 1']]]) {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + r); await p.waitForTimeout(800); await settle(p);
    const t = await p.locator('body').innerText();
    for (const w of words) assert.ok(t.includes(w), r + ': ' + w);
    assert.doesNotMatch(t, /Net ربح|Margin ربح/, 'لا ترجمة جزئية');
    await p.close();
  }
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.7 الموارد البشرية بالإنجليزية: الرواتب والإضافي والسياسات والتدريب مترجمة، وأسماء الموظفين كما هي', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = [];
  for (const [r, words] of [['hub/hr/payroll', ['Total earnings (basic + allowances)', 'Net payable', 'WPS file']], ['hub/hr/overtime', ['Overtime hours', 'Formulas (Labor Law article 107)']], ['hub/hr/hrpolicy', ['General work policies', 'Sunday', 'Save policies']], ['hub/hr/training', ['Record training/certificate', 'Health certificate (food handler)']]]) {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + r); await p.waitForTimeout(800); await settle(p);
    const t = await p.locator('body').innerText();
    for (const w of words) assert.ok(t.includes(w), r + ': ' + w);
    assert.doesNotMatch(t, /Net [؀-ۿ]+ \d|Payroll Run · [؀-ۿ]/, 'لا ترجمة جزئية');
    await p.close();
  }
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.8 الإدارة والتطبيقات وبقية الشاشات بالإنجليزية: شاشة التطبيقات وتلميحاتها ومركز التطبيقات والإدارة والمستندات', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const errs = [];
  for (const [r, words] of [['comp/AppsCenter', ['Open app', 'Center architecture:']], ['comp/Admin', ['Users & permissions', 'System maintenance']], ['hub/docshub/docs', ['New document', 'Total documents']], ['hub/closehub/maint', ['Fault report', 'Equipment register']], ['comp/AuditView', ['Platform action log']]]) {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + r); await p.waitForTimeout(800); await settle(p);
    const t = await p.locator('body').innerText();
    for (const w of words) assert.ok(t.includes(w), r + ': ' + w);
    await p.close();
  }
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'comp/Launcher'); await p.waitForTimeout(800); await settle(p);
  const titles = await p.evaluate(() => [...document.querySelectorAll('[title]')].map(e => e.getAttribute('title')).filter(t => /اسحبه|أقسام/.test(t)));
  assert.deepEqual(titles, [], 'تلميحات التطبيقات مترجمة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v43.9 تعدد العملات: فاتورة توريد بالدولار تُحفظ بالريال وعملتها، وسدادها بسعر آخر يُظهر فرق الصرف', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, purchaseCfg: { ...(g.purchaseCfg || {}), fx: true } })); window.setOps(o => ({ ...o, invoices: [] })); }); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'فاتورة توريد جديدة' }).click(); await p.waitForTimeout(200);
  await p.selectOption('select[aria-label="عملة الفاتورة"]', 'USD');
  await p.locator('.modal label:has-text("خاضعة لضريبة") input').uncheck();
  await p.selectOption('select[aria-label="صنف البند 1"]', 'i1'); await p.fill('input[aria-label="كمية البند 1"]', '100'); await p.fill('input[aria-label="سعر البند 1"]', '10'); await p.fill('input[aria-label="سعر الصرف"]', '3.75');
  assert.match(await p.locator('[data-fxsar]').innerText(), /3,750\.00/);
  await p.locator('.modal [data-pm="credit"]').click(); await p.locator('button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(300);
  let r = await p.evaluate(() => window.cur.invoices.map(i => [i.amount, i.cur, i.fxRate, i.fcAmount]));
  assert.deepEqual(r, [[3750, 'USD', 3.75, 1000]]);
  assert.match(await p.locator('[data-fxamt]').first().innerText(), /1,000\.00 USD @ 3\.75/);
  await p.locator('button', { hasText: 'سداد' }).first().click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="مبلغ السداد بالعملة"]', '400'); await p.fill('input[aria-label="سعر صرف السداد"]', '3.8');
  assert.equal(await p.getAttribute('[data-fxdiff]', 'data-fxdiff'), '20');
  await p.locator('button', { hasText: 'تسجيل السداد' }).click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const i = window.cur.invoices[0]; return [i.paidAmount, i.payments.map(x => [x.amount, x.fc, x.rate, x.paid])]; });
  assert.deepEqual(r, [1500, [[1500, 400, 3.8, 1520]]]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v44.0 المطابقة الثلاثية: الاستلام الكامل برقم فاتورة المورد يتحوّل تلقائيًا، والجزئي يبقى للمحاسب ومدير النظام', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  const PO = (id, no, qty) => ({ id, poNo: no, supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', status: 'open', date: '2026-11-10', at: '2026-11-10T08:00:0' + no.slice(-1) + 'Z', by: 'مجاهد', lines: [{ itemId: 'i1', desc: 'لحم غنم', qty, price: 40, factor: 1 }] });
  await p.evaluate((pos) => { window.setOrg(g => ({ ...g, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) })); window.setOps(o => ({ ...o, invoices: [], stockMoves: [], purchaseOrders: pos })); }, [PO('a', 'PO-0001', 10), PO('b', 'PO-0002', 10)]); await p.waitForTimeout(300);
  const toPo = async () => { await p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await p.waitForTimeout(200); };
  await toPo();
  const row = (no) => p.locator('tr', { hasText: no });
  // (أ) مطابق: كامل الكمية + رقم فاتورة المورد ⇒ فاتورة تلقائية بسعر الأمر
  await row('PO-0001').locator('button', { hasText: 'تسجيل استلام' }).click(); await p.fill('input[aria-label="رقم فاتورة المورد"]', 'SUP-501'); await p.fill('input[aria-label="مبلغ فاتورة المورد"]', '460');
  await p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await p.waitForTimeout(300);
  let r = await p.evaluate(() => ({ inv: window.cur.invoices.map(i => [i.invoiceNo, i.poId]), g: (window.cur.purchaseOrders.find(x => x.id === 'a').grns || []).length }));
  assert.deepEqual(r, { inv: [['SUP-501', 'a']], g: 0 });
  // (ب) جزئي ⇒ لا فاتورة؛ «مستلم لم يُفوتر» بقيد وسيط، والتحويل لا يظهر للمكتب الرئيسي
  await row('PO-0002').locator('button', { hasText: 'تسجيل استلام' }).click(); await p.fill('.modal input[placeholder="المستلم الآن"]', '6'); await p.fill('input[aria-label="رقم فاتورة المورد"]', 'SUP-502');
  await p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await p.waitForTimeout(300);
  assert.match(await say(p), /غير مطابق آليًا \(استلام جزئي\)/);
  r = await p.evaluate(() => { const po = window.cur.purchaseOrders.find(x => x.id === 'b'); return { inv: window.cur.invoices.length, g: po.grns.map(g => [g.status, g.direct, g.supInvNo]), mv: (window.cur.stockMoves || []).filter(m => m.grnRef).map(m => m.qty) }; });
  assert.deepEqual(r, { inv: 1, g: [['done', true, 'SUP-502']], mv: [6] });
  assert.equal(await row('PO-0002').locator('[data-cv]').count(), 0, 'المكتب الرئيسي لا يحوّل');
  const po2 = await p.evaluate(() => window.cur.purchaseOrders.find(x => x.id === 'b')); const mv = await p.evaluate(() => window.cur.stockMoves);
  await ctx.close();
  // المحاسب: قائمة «مستلم لم يُفوتر» داخل المحاسبة — يحوّلها برقم فاتورة المورد من الاستلام
  const o2 = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Accounting/acc/unbilled');
  await o2.p.evaluate(([po, mv]) => { window.setOrg(g => ({ ...g, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) })); window.setOps(o => ({ ...o, invoices: [], stockMoves: mv, purchaseOrders: [po] })); }, [po2, mv]); await o2.p.waitForTimeout(300);
  assert.equal(await o2.p.locator('[data-unbilled] tbody tr').count(), 1);
  await o2.p.locator('[data-unbilled] [data-cv]').click(); await o2.p.waitForTimeout(150);
  assert.equal(await o2.p.locator('.modal input.inp').first().inputValue(), 'SUP-502', 'رقم فاتورة المورد من الاستلام');
  await o2.p.locator('.modal [data-pm="credit"]').click(); await o2.p.locator('[data-cvsave]').click(); await o2.p.waitForTimeout(300);
  r = await o2.p.evaluate(() => window.cur.invoices.map(i => [i.invoiceNo, i.amount]));
  assert.deepEqual(r, [['SUP-502', 276]], '6 × 40 + 15%');
  assert.match(await o2.p.locator('[data-unbilled]').innerText(), /لا استلامات غير مفوترة/);
  assert.deepEqual([...errs, ...o2.errs], []); await o2.ctx.close();
});

test('v44.1 الأصناف والمطابقة: التصنيف إلزامي ورمز تسلسلي وباركود فريد، وبنود الأمر من الأصناف، والمطابقة للمبلغ، والرقم الضريبي للفاتورة الضريبية، وفاتورة يدوية ببنود', async () => {
  // (1) الأصناف
  let { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Inventory/admin/items');
  await p.locator('button', { hasText: 'صنف جديد' }).click(); await p.waitForTimeout(150);
  await p.locator('.modal input.inp').nth(2).fill('أكياس تغليف');
  await p.locator('button', { hasText: 'حفظ الصنف' }).click(); await p.waitForTimeout(150);
  assert.match(await say(p), /اختر تصنيف الصنف/, 'التصنيف إلزامي');
  await p.locator('[data-itype="consumable"]').click(); await p.fill('input[aria-label="الباركود"]', '6281000000017');
  await p.locator('button', { hasText: 'حفظ الصنف' }).click(); await p.waitForTimeout(250);
  let r = await p.evaluate(() => window.curOrg.items.map(i => [i.code, i.name, i.type || 'stock', i.barcode || '']));
  assert.deepEqual(r, [['ITM-0001', 'لحم غنم', 'stock', ''], ['ITM-0002', 'طماطم', 'stock', ''], ['ITM-0003', 'أكياس تغليف', 'consumable', '6281000000017']], 'الأصناف القديمة أخذت رموزها بترتيبها');
  await p.locator('button', { hasText: 'صنف جديد' }).click(); await p.locator('[data-itype="stock"]').click(); await p.locator('.modal input.inp').nth(2).fill('ملح');
  await p.fill('input[aria-label="الباركود"]', '6281000000017'); await p.locator('button', { hasText: 'حفظ الصنف' }).click(); await p.waitForTimeout(150);
  assert.match(await say(p), /مستخدم للصنف «أكياس تغليف»/, 'الباركود فريد');
  const items = await p.evaluate(() => window.curOrg.items); await ctx.close();
  // (2) المشتريات
  ({ p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers'));
  await p.evaluate((items) => { window.setOrg(g => ({ ...g, items, suppliers: [{ id: 's1', name: 'مؤسسة اللحوم الطازجة للتجارة' }] })); window.setOps(o => ({ ...o, invoices: [], stockMoves: [], whMoves: [], purchaseOrders: [{ id: 'a', poNo: 'PO-0001', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', status: 'open', date: '2026-11-10', at: '2026-11-10T08:00:00Z', by: 'مجاهد', lines: [{ itemId: 'i1', desc: 'لحم غنم', qty: 10, price: 40, factor: 1 }] }] })); }, items); await p.waitForTimeout(300);
  // الاستلام الكامل برقم ومبلغ صحيحين لكن المورد بلا رقم ضريبي ⇒ غير مطابق
  await p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await p.waitForTimeout(150);
  await p.locator('button', { hasText: 'تسجيل استلام' }).click(); await p.fill('input[aria-label="رقم فاتورة المورد"]', 'S-1'); await p.fill('input[aria-label="مبلغ فاتورة المورد"]', '459');
  assert.equal(await p.getAttribute('[data-amtmatch]', 'data-amtmatch'), 'no');
  await p.fill('input[aria-label="مبلغ فاتورة المورد"]', '460'); assert.equal(await p.getAttribute('[data-amtmatch]', 'data-amtmatch'), 'yes');
  await p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await p.waitForTimeout(300);
  assert.match(await say(p), /غير مطابق آليًا \(المورد بلا رقم ضريبي\)/);
  assert.equal(await p.evaluate(() => window.cur.invoices.length), 0);
  // بند أمر شراء بلا صنف مرفوض، والقائمة مرتّبة بالرمز
  await p.locator('button', { hasText: 'أمر شراء جديد' }).click(); await p.waitForTimeout(150);
  const opts = await p.locator('select[aria-label="صنف البند 1"] option').allInnerTexts();
  assert.deepEqual(opts.slice(1).map(x => x.split(' · ')[0]), ['ITM-0001', 'ITM-0002', 'ITM-0003']);
  await p.locator('.modal input[placeholder="الكمية"]').first().fill('5'); await p.locator('.modal button', { hasText: 'إنشاء الأمر' }).click().catch(() => {}); await p.waitForTimeout(150);
  assert.match(await say(p), /اختر الصنف لكل بند/);
  await p.keyboard.press('Escape'); await p.locator('.modal button', { hasText: 'إلغاء' }).first().click().catch(() => {});
  // (3) فاتورة توريد يدوية ببنود: مخزني يدخل المخزون واستهلاكي مصروف، والضريبية تطلب الرقم الضريبي
  await p.locator('button', { hasText: 'فواتير الموردين الآجلة' }).first().click(); await p.waitForTimeout(150);
  await p.locator('button', { hasText: 'فاتورة توريد جديدة' }).click(); await p.waitForTimeout(150);
  await p.selectOption('select[aria-label="صنف البند 1"]', 'i1'); await p.fill('input[aria-label="كمية البند 1"]', '5'); await p.fill('input[aria-label="سعر البند 1"]', '40');
  await p.locator('.modal button', { hasText: 'بند آخر' }).click();
  const cons = items.find(i => i.type === 'consumable').id;
  await p.locator('input[aria-label="صنف البند 2 — بحث"]').fill('6281000000017'); await p.waitForTimeout(100);
  assert.equal(await p.locator('select[aria-label="صنف البند 2"]').inputValue(), cons, 'المسح بالباركود يختار الصنف');
  await p.fill('input[aria-label="كمية البند 2"]', '10'); await p.fill('input[aria-label="سعر البند 2"]', '2');
  await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(200);
  assert.match(await say(p), /اختر طريقة الدفع/, 'v44.2: طريقة الدفع إلزامية');
  await p.locator('.modal [data-pm="credit"]').click();
  await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(200);
  assert.match(await say(p), /الرقم الضريبي للمورد/, 'الفاتورة الضريبية تطلب رقم المورد');
  await p.fill('input[aria-label="الرقم الضريبي للمورد"]', '300000000000003');
  await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const i = window.cur.invoices[0]; return { amt: i.amount, vat: i.vatAmt, ls: i.lines.map(l => [l.qty, l.net, l.stock]), mv: [...(window.cur.stockMoves || []), ...(window.cur.whMoves || [])].filter(m => m.invoiceId === i.id).map(m => [m.itemId, m.qty]), vatNo: window.curOrg.suppliers[0].vatNo }; });
  assert.deepEqual(r, { amt: 253, vat: 33, ls: [[5, 200, true], [10, 20, false]], mv: [['i1', 5]], vatNo: '300000000000003' });
  assert.deepEqual(errs, []); await ctx.close();
});

test('v44.2 فاتورة المورد: ملاحظة تحت كل صنف، وطريقة الدفع إلزامية، والدفع الفوري (جزئي بتحويل/كامل بشيك برقمه) يُسجَّل دفعةً وقيدًا', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) })); window.setOps(o => ({ ...o, invoices: [], stockMoves: [], whMoves: [] })); }); await p.waitForTimeout(300);
  const newInv = async (qty, pm) => {
    await p.locator('button', { hasText: 'فاتورة توريد جديدة' }).click(); await p.waitForTimeout(150);
    await p.selectOption('select[aria-label="صنف البند 1"]', 'i1'); await p.fill('input[aria-label="كمية البند 1"]', String(qty)); await p.fill('input[aria-label="سعر البند 1"]', '40');
    await p.fill('input[aria-label="ملاحظة البند 1"]', 'مبرد — فحص الحرارة عند الاستلام');
    await pm(); await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(300);
  };
  // تحويل بنكي جزئي: 10 × 40 = 400 + 60 = 460 — يُدفع 300 والباقي آجل
  await newInv(10, async () => { await p.locator('.modal [data-pm="bank"]').click(); await p.fill('input[aria-label="المبلغ المدفوع"]', '300'); await p.fill('input[aria-label="مرجع الدفع"]', 'TRX-77'); });
  let r = await p.evaluate(() => { const i = window.cur.invoices[0]; return [i.pm, i.amount, i.paidAmount, i.payments.map(x => [x.amount, x.fund, x.pm, x.ref]), i.lines[0].note]; });
  assert.deepEqual(r, ['bank', 460, 300, [[300, '1201', 'bank', 'TRX-77']], 'مبرد — فحص الحرارة عند الاستلام']);
  // شيك بلا رقم مرفوض، ثم كامل بالشيك
  await newInv(5, async () => { await p.locator('.modal [data-pm="cheque"]').click(); });
  assert.match(await say(p), /رقم الشيك/);
  await p.fill('input[aria-label="مرجع الدفع"]', 'CHQ-1001'); await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const i = window.cur.invoices[0]; return [i.pm, i.amount, i.paidAmount, i.payments[0].ref]; });
  assert.deepEqual(r, ['cheque', 230, 230, 'CHQ-1001']);
  // نقدًا من الخزينة كاملًا
  await newInv(1, async () => { await p.locator('.modal [data-pm="cash"]').click(); });
  r = await p.evaluate(() => { const i = window.cur.invoices[0]; return [i.pm, i.paidAmount, i.payments[0].fund]; });
  assert.deepEqual(r, ['cash', 46, '1101']);
  // ملاحظة بند أمر الشراء تُحفظ
  await p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await p.waitForTimeout(150);
  await p.locator('button', { hasText: 'أمر شراء جديد' }).click(); await p.waitForTimeout(150);
  await p.selectOption('select[aria-label="صنف البند 1"]', 'i2'); await p.locator('.modal input[placeholder="الكمية"]').first().fill('3'); await p.locator('.modal input[placeholder="سعر الوحدة"]').first().fill('4');
  await p.fill('input[aria-label="ملاحظة بند الأمر 1"]', 'طازج فقط');
  await p.locator('.modal button', { hasText: 'إنشاء الأمر' }).click(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.cur.purchaseOrders[0].lines[0].note), 'طازج فقط');
  assert.deepEqual(errs, []); await ctx.close();
});


test('v44.3 طلب شراء الفرع ← أمر شراء لمستودع الفرع ← استلام مدير الفرع مباشرة ← ترحيل تلقائي بفاتورة المطابق؛ وكل حسابات الدليل في فاتورة الخدمات', async () => {
  // (1) مدير الفرع: طلب شراء
  const b = await open({ viewport: { width: 1300, height: 1000 } }, 'live/BranchWarehouse/bm');
  await b.p.evaluate(() => window.setOps(o => ({ ...o, purchaseReqs: [], poInbox: [], poReceipts: [], whMoves: [] })));
  await b.p.locator('button', { hasText: 'طلب شراء' }).first().click(); await b.p.waitForTimeout(150);
  await b.p.selectOption('select[aria-label="صنف الطلب 1"]', 'i1'); let r;
  await b.p.fill('input[aria-label="كمية الطلب 1"]', '8');
  await b.p.locator('button', { hasText: 'إرسال طلب الشراء' }).click(); await b.p.waitForTimeout(200);
  const req = await b.p.evaluate(() => window.cur.purchaseReqs[0]);
  assert.equal(req && req.status, 'pending', 'أُنشئ الطلب: ' + (await say(b.p)));
  assert.deepEqual([req.branchId, req.whId, req.lines.map(l => l.qty)], ['b1', 'wh-b1', [8]]);
  await b.ctx.close();
  // (2) المركز: يحوّله لأمر شراء موجّه لمستودع الفرع (المستودع مقفل على مستودع الطلب)
  const c = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  await c.p.evaluate((rq) => { window.setOrg(g => ({ ...g, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) })); window.setOps(o => ({ ...o, invoices: [], stockMoves: [], purchaseOrders: [], purchaseReqs: [rq], poInbox: [], poReceipts: [] })); }, req); await c.p.waitForTimeout(250);
  await c.p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await c.p.waitForTimeout(200);
  await c.p.locator('[data-req2po]').click(); await c.p.waitForTimeout(150);
  assert.equal(await c.p.locator('select[aria-label="مستودع الأمر"]').inputValue(), 'wh-b1'); assert.equal(await c.p.locator('select[aria-label="مستودع الأمر"]').isDisabled(), true);
  await c.p.locator('.modal input[placeholder="سعر الوحدة"]').first().fill('40');
  await c.p.locator('button', { hasText: 'إنشاء الأمر' }).click(); await c.p.waitForTimeout(250);
  r = await c.p.evaluate(() => ({ po: window.cur.purchaseOrders.map(x => [x.whId, x.branchId, x.status, x.reqNo]), rq: window.cur.purchaseReqs[0].status, ib: window.cur.poInbox.map(x => [x.branchId, x.poNo, x.lines[0].qty]) }));
  assert.deepEqual(r.po, [['wh-b1', 'b1', 'open', req.no]]); assert.equal(r.rq, 'converted'); assert.equal(r.ib.length, 1, 'نسخة الأمر في مستند الفرع');
  assert.match(await c.p.locator('tr', { hasText: r.ib[0][1] }).innerText(), /إلى: مستودع طيبة/);
  const after = await c.p.evaluate(() => window.cur); await c.ctx.close();
  // (3) مدير الفرع: يستلم الأمر مباشرة في مستودعه (يرى نسخة الأمر فقط)
  const b2 = await open({ viewport: { width: 1300, height: 1000 } }, 'live/BranchWarehouse/bm');
  await b2.p.evaluate((o2) => window.setOps(o => ({ ...o, poInbox: o2.poInbox, purchaseReqs: o2.purchaseReqs, poReceipts: [], whMoves: [] })), after); await b2.p.waitForTimeout(200);
  await b2.p.locator('button', { hasText: 'استلام أوامر الشراء' }).click(); await b2.p.waitForTimeout(150);
  await b2.p.locator('[data-brrecv]').click(); await b2.p.waitForTimeout(150);
  await b2.p.fill('input[aria-label="رقم فاتورة المورد"]', 'SUP-900'); await b2.p.fill('input[aria-label="مبلغ فاتورة المورد"]', '368');
  await b2.p.locator('button', { hasText: 'تأكيد الاستلام' }).click(); await b2.p.waitForTimeout(250);
  r = await b2.p.evaluate(() => ({ rc: window.cur.poReceipts.map(x => [x.status, x.supInvNo, x.lines[0].qty]), mv: window.cur.whMoves.map(m => [m.whId, m.qty, m.unitCost, !!m.grnRef]) }));
  assert.deepEqual(r, { rc: [['pending', 'SUP-900', 8]], mv: [['wh-b1', 8, undefined, true]] }, 'دخل مستودع الفرع فورًا — بلا سعر لدى الفرع');
  assert.equal(JSON.stringify(after.poInbox).includes('price'), false, 'نسخة الأمر في الفرع كميات فقط');
  // v56.6: رقم سند الاستلام عشوائي (GRN-…-S40 مثلًا) فيُحذف قبل فحص السعر — كان الاختبار يفشل عشوائيًا حين يحوي الرقم «40»
  assert.doesNotMatch((await b2.p.locator('[data-brpo]').innerText()).replace(/GRN-[A-Za-z0-9-]+/g, ''), /40|ر\.س/, 'لا أسعار في شاشة الفرع');
  assert.match(await b2.p.locator('[data-brpo]').innerText(), /لا أوامر شراء قيد التوريد/, 'المتبقي يُخصم منه الاستلام المعلّق');
  const brOps = await b2.p.evaluate(() => ({ poReceipts: window.cur.poReceipts, whMoves: window.cur.whMoves }));
  await b2.ctx.close();
  // (4) المركز: يُرحَّل تلقائيًا — مطابق كليًا ⇒ فاتورة المورد بسعر الأمر، والأمر مستلم كاملاً
  const c2 = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  await c2.p.evaluate(([o2, br]) => { window.setOrg(g => ({ ...g, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })) })); window.setOps(o => ({ ...o, ...o2, ...br })); }, [after, brOps]); await c2.p.waitForTimeout(600);
  r = await c2.p.evaluate(() => ({ inv: window.cur.invoices.map(i => [i.invoiceNo, i.amount, i.auto, (i.grnRefs || []).length]), po: window.cur.purchaseOrders[0].status, rc: window.cur.poReceipts.map(x => [x.status, x.result]), ib: window.cur.poInbox.length, uc: window.cur.whMoves.map(m => m.unitCost) }));
  assert.deepEqual(r, { inv: [['SUP-900', 368, 'match', 1]], po: 'received', rc: [['posted', 'matched']], ib: 0, uc: [40] }, 'التكلفة بسعر الأمر عند الترحيل');
  // (5) فاتورة الخدمات: كل حسابات الدليل مجمّعة بالنوع عدا 2101
  await c2.p.locator('button', { hasText: 'فواتير الموردين الآجلة' }).first().click(); await c2.p.waitForTimeout(200);
  await c2.p.locator('[data-svc]').click(); await c2.p.waitForTimeout(200);
  r = await c2.p.evaluate(() => { const sel = document.querySelector('select[aria-label="حساب البند 1"]'); const v = [...sel.querySelectorAll('option')].map(o => o.value).filter(Boolean);
    return { groups: [...sel.querySelectorAll('optgroup')].map(g => g.label), has: ['1101', '1501', '4101', '5198'].map(c => v.includes(c)), ap: v.includes('2101'), sorted: v.join() === [...v].sort().join() }; });
  assert.deepEqual(r, { groups: ['الأصول', 'الالتزامات', 'حقوق الملكية', 'الإيرادات', 'المصروفات'], has: [true, true, true, true], ap: false, sorted: true });
  await c2.ctx.close();
  assert.deepEqual([...b.errs, ...c.errs, ...b2.errs, ...c2.errs], []);
});

test('v44.3 متابعة المخزون: الإجمالي لكل مستودع (عمود لكل فرع) في الرئيسي، واختيار أي فرع لأرصدته وحركته', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/ho/wh');
  await p.evaluate(() => window.setOps(o => ({ ...o, whTransfers: [], stockMoves: [{ id: 's1', itemId: 'i1', kind: 'purchase', qty: 50, date: '2026-11-10', by: 'سارة' }],
    whMoves: [{ id: 'w1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 12, date: '2026-11-12', by: 'خالد' }, { id: 'w2', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'out', qty: -5, date: '2026-11-13', by: 'خالد' }] })));
  await p.waitForTimeout(300);
  const row = await p.evaluate(() => { const t = document.querySelector('[data-whall]'); const hs = [...t.querySelectorAll('thead th')].map(x => x.textContent); const tr = [...t.querySelectorAll('tbody tr')].find(x => x.textContent.includes('لحم غنم'));
    const c = [...tr.querySelectorAll('td')].map(x => x.textContent); return { b1: c[hs.indexOf('مستودع طيبة')], main: c[hs.indexOf('المستودع الرئيسي')], tot: c[hs.indexOf('الإجمالي')] }; });
  assert.deepEqual(row, { b1: '7', main: '50', tot: '57' });
  await p.selectOption('select[aria-label="مخزون المستودع"]', 'wh-b1'); await p.waitForTimeout(200);
  const mv = await p.locator('[data-whmoves] tbody tr').allInnerTexts();
  assert.equal(mv.length, 2); assert.match(mv[0], /صرف للتشغيل[\s\S]*-5/); assert.match(mv[1], /توريد شراء[\s\S]*\+12/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v44.3 (ث34) طلب الشراء واستلام أوامر الشراء لمدير الفرع وحده — لا يظهران لغيره في «مستودع الفرع»', async () => {
  for (const who of ['ho', 'ctl', 'admin']) {
    const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 900 } }, 'live/BranchWarehouse/' + who);
    await p.waitForTimeout(200);
    assert.equal(await p.locator('button', { hasText: 'استلام أوامر الشراء' }).count(), 0, who);
    assert.equal(await p.locator('button', { hasText: /^طلب شراء$/ }).count(), 0, who);
    assert.deepEqual(errs, []); await ctx.close();
  }
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 900 } }, 'live/BranchWarehouse/bm');
  assert.equal(await p.locator('button', { hasText: 'استلام أوامر الشراء' }).count(), 1, 'مدير الفرع');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v44.5 التحضير اليومي بالباركود: تسجيل دفعة وطباعة ملصق 50×30 بتاريخي الإنتاج والانتهاء، ومسح القارئ للحالة والاستخدام والإتلاف', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/bm/closehub:prepdaily');
  await p.evaluate(() => {
    window.__labels = []; window.open = () => ({ document: { write: (h) => window.__labels.push(h), close() {} } });
    window.setOrg(g => ({ ...g, preps: [{ id: 'pr1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 24 }, { id: 'pr2', name: 'تتبيلة شاورما', unit: 'كجم' }] }));
    window.setOps(o => ({ ...o, prepBatches: [
      { id: 'old', code: 'PEXPIRED1', branchId: 'b1', prepId: 'pr1', name: 'صلصة ثوم', unit: 'كجم', qty: 2, madeAt: '2026-01-01T08:00:00Z', expAt: '2026-01-02T08:00:00Z', status: 'shelf', by: 'خالد' },
      { id: 'oth', code: 'POTHERBR1', branchId: 'b2', prepId: 'pr1', name: 'صلصة ثوم', unit: 'كجم', qty: 1, madeAt: '2026-01-01T08:00:00Z', expAt: '2026-01-02T08:00:00Z', status: 'shelf', by: 'س' }] }));
  });
  await p.waitForTimeout(300);
  // بلا مدة صلاحية ⇒ مرفوض
  await p.selectOption('select[aria-label="التحضيرة"]', 'pr2'); await p.fill('input[aria-label="الكمية المحضّرة"]', '3'); await p.locator('[data-pbsave]').click(); await p.waitForTimeout(150);
  assert.match(await say(p), /مدة صلاحية «تتبيلة شاورما» غير محددة/);
  // تسجيل وطباعة ملصقين
  await p.selectOption('select[aria-label="التحضيرة"]', 'pr1'); await p.fill('input[aria-label="الكمية المحضّرة"]', '5'); await p.fill('input[aria-label="عدد الملصقات"]', '2');
  await p.locator('[data-pbsave]').click(); await p.waitForTimeout(200);
  // المعاينة قبل الطباعة: الانتهاء = الإنتاج + 24 س، ولا يُمدَّد بعد المدة
  const mk0 = await p.inputValue('input[aria-label="تاريخ الإنتاج"]'), ex0 = await p.inputValue('input[aria-label="تاريخ الانتهاء"]');
  assert.equal(Date.parse(ex0) - Date.parse(mk0), 24 * 3600000);
  await p.fill('input[aria-label="تاريخ الانتهاء"]', new Date(Date.parse(ex0) + 3 * 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  await p.locator('[data-pbprintok]').click(); await p.waitForTimeout(150);
  assert.match(await say(p), /يتجاوز مدة صلاحية التحضيرة/);
  await p.fill('input[aria-label="تاريخ الانتهاء"]', ex0);
  assert.equal(await p.evaluate(() => window.cur.prepBatches.length), 2, 'لا يُسجَّل قبل التأكيد');
  await p.locator('[data-pbprintok]').click(); await p.waitForTimeout(600);
  const b = await p.evaluate(() => window.cur.prepBatches.find(x => x.id !== 'old' && x.id !== 'oth'));
  assert.equal(b.qty, 5); assert.equal(b.branchId, 'b1'); assert.equal(Date.parse(b.expAt) - Date.parse(b.madeAt), 24 * 3600000, 'الانتهاء = الإنتاج + 24 ساعة');
  const lab = await p.evaluate(() => window.__labels[0] || '');
  assert.equal((lab.match(/class="lb"/g) || []).length, 2, 'ملصقان'); assert.match(lab, /size:50mm 30mm/); assert.match(lab, /<svg/); assert.ok(lab.includes(b.code)); assert.match(lab, /إنتاج:[\s\S]*انتهاء:/); assert.match(lab, /أعدّه: <b>خالد<\/b>/, 'اسم المُعِد على الملصق');
  // إعادة الطباعة بلا تاريخ الإنتاج (خيار الإظهار)
  await p.locator('[data-pbrow="' + b.code + '"] [data-pbprint]').click(); await p.waitForTimeout(150);
  await p.uncheck('input[aria-label="طباعة تاريخ الإنتاج"]'); await p.locator('[data-pbprintok]').click(); await p.waitForTimeout(600);
  const lab2 = await p.evaluate(() => window.__labels[window.__labels.length - 1]);
  assert.doesNotMatch(lab2, /إنتاج:/); assert.match(lab2, /انتهاء:/); assert.equal((lab2.match(/class="lb"/g) || []).length, 1);
  // مقاسات متعددة: الافتراضي 50×30 ويُتذكّر الأخير، و100×50، وورقة A4 بـ 24 ملصقًا
  await p.locator('[data-pbrow="' + b.code + '"] [data-pbprint]').click(); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('select[aria-label="مقاس الملصق"]'), '50x30');
  await p.selectOption('select[aria-label="مقاس الملصق"]', '100x50'); await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-lbpreview="100x50"] iframe').count(), 1, 'معاينة حيّة بالمقاس');
  await p.locator('[data-pbprintok]').click(); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.__labels[window.__labels.length - 1]), /size:100mm 50mm/);
  await p.locator('[data-pbrow="' + b.code + '"] [data-pbprint]').click(); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('select[aria-label="مقاس الملصق"]'), '100x50', 'يُتذكّر آخر مقاس');
  await p.selectOption('select[aria-label="مقاس الملصق"]', 'a4'); await p.fill('input[aria-label="عدد ملصقات المعاينة"]', '24'); await p.locator('[data-pbprintok]').click(); await p.waitForTimeout(500);
  const a4 = await p.evaluate(() => window.__labels[window.__labels.length - 1]);
  assert.match(a4, /size:A4/); assert.match(a4, /class="sheet"/); assert.equal((a4.match(/class="lb"/g) || []).length, 24);
  // المسح بالقارئ (الرمز ثم Enter) ⇒ الحالة ثم الاستخدام
  // v44.8: الكتابة البطيئة ⇒ «إدخال يدوي»، وكتابة القارئ السريعة ثم Enter ⇒ «قارئ باركود» — ويُسجَّل مع الاستخدام
  await p.locator('input[aria-label="مسح ملصق التحضير"]').pressSequentially(b.code, { delay: 120 }); await p.press('input[aria-label="مسح ملصق التحضير"]', 'Enter'); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-pbvia="hit"]').innerText(), 'إدخال يدوي');
  assert.equal(await p.locator('[data-pbvia="hit"] svg.lucide-pen-line').count(), 1, 'أيقونة القلم لليدوي');
  await p.locator('input[aria-label="مسح ملصق التحضير"]').pressSequentially(b.code.toLowerCase(), { delay: 4 }); await p.press('input[aria-label="مسح ملصق التحضير"]', 'Enter'); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-pbvia="hit"]').innerText(), 'قارئ باركود');
  assert.equal(await p.locator('[data-pbvia="hit"] svg.lucide-qr-code').count(), 1, 'أيقونة QR للقارئ');
  assert.equal(await p.locator('[data-pbhit="ok"] [data-pbst]').getAttribute('data-pbst'), 'ok');
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'مسح ملصق التحضير', 'التركيز يبقى على حقل المسح');
  await p.locator('[data-pbhit="ok"] [data-pbuse]').click(); await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate((id) => { const x = window.cur.prepBatches.find(y => y.id === id); return [x.status, x.usedVia]; }, b.id), ['used', 'scan']);
  // v44.9: اسم الماسح ووقته وطريقته على الدفعة، واسم المُعِد في نتيجة المسح
  assert.deepEqual(await p.evaluate((id) => (window.cur.prepBatches.find(y => y.id === id).scans || []).map(e => [e.by, e.via]), b.id), [['خالد', 'scan'], ['خالد', 'manual']]);
  assert.equal(await p.locator('[data-pbhit="ok"] [data-pbby]').innerText(), 'خالد');
  assert.equal(await p.locator('[data-pbscans] [data-pbvia="log"]').count(), 2);
  // المنتهي: لا استخدام، والإتلاف بسببه
  await p.fill('input[aria-label="مسح ملصق التحضير"]', 'PEXPIRED1'); await p.press('input[aria-label="مسح ملصق التحضير"]', 'Enter'); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-pbhit="ok"] [data-pbst]').getAttribute('data-pbst'), 'expired');
  assert.equal(await p.locator('[data-pbhit="ok"] [data-pbuse]').count(), 0, 'المنتهي لا يُستخدم');
  await p.locator('[data-pbhit="ok"] [data-pbdisc]').click(); await p.waitForTimeout(150);
  assert.equal(await p.locator('select[aria-label="سبب الإتلاف"]').inputValue(), 'expired');
  await p.locator('[data-pbdiscsave]').click(); await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(() => { const x = window.cur.prepBatches.find(y => y.id === 'old'); return [x.status, x.reason, x.discardVia]; }), ['discarded', 'expired', 'manual'], 'اللصق/الكتابة السريعة بلا مفاتيح ⇒ يدوي');
  // ملصق فرع آخر وملصق مجهول
  await p.fill('input[aria-label="مسح ملصق التحضير"]', 'POTHERBR1'); await p.press('input[aria-label="مسح ملصق التحضير"]', 'Enter'); await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-pbhit="other"]').count(), 1);
  await p.fill('input[aria-label="مسح ملصق التحضير"]', 'XYZ'); await p.press('input[aria-label="مسح ملصق التحضير"]', 'Enter'); await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-pbhit="miss"]').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v44.7 عرض ورق الإيصال: إعداد عام 58 مم يُحفظ في إعدادات نقطة البيع، وتخصيص الجهاز على الجهاز فقط', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosSettings/admin');
  await p.waitForTimeout(300);
  assert.equal(await p.inputValue('select[aria-label="عرض ورق الإيصال"]'), '80', 'الافتراضي 80');
  assert.equal(await p.inputValue('select[aria-label="عرض الورق لهذا الجهاز"]'), '', 'مثل الإعداد العام');
  await p.selectOption('select[aria-label="عرض ورق الإيصال"]', '58'); await p.selectOption('select[aria-label="عرض الورق لهذا الجهاز"]', '80');
  await p.locator('.card button.pri', { hasText: /^حفظ$/ }).click(); await p.waitForTimeout(250);
  const r = await p.evaluate(() => ({ org: (window.curOrg.posCfg || {}).paper, dev: localStorage.getItem('rms8:posPaper') }));
  assert.deepEqual(r, { org: '58', dev: '80' });
  await p.selectOption('select[aria-label="عرض الورق لهذا الجهاز"]', ''); await p.locator('.card button.pri', { hasText: /^حفظ$/ }).click(); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => localStorage.getItem('rms8:posPaper')), null, 'العودة للإعداد العام');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v45.0 جرد رف التحضير بالمسح: الموجود والمفقود والمنتهي وغير المتوقع، ويُحفظ في السجل', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/bm/closehub:prepdaily');
  await p.evaluate(() => { const now = Date.now(), H = 3600000, iso = (t) => new Date(t).toISOString();
    const B = (id, code, st, exp, br) => ({ id, code, branchId: br || 'b1', prepId: 'pr1', name: 'صلصة ثوم', unit: 'كجم', qty: 1, madeAt: iso(now - 30 * H), expAt: iso(now + exp * H), status: st || 'shelf', by: 'سعد' });
    window.setOrg(g => ({ ...g, preps: [{ id: 'pr1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 48 }] }));
    window.setOps(o => ({ ...o, prepCounts: [], prepBatches: [B('a', 'PA0001', 'shelf', 10), B('b', 'PB0002', 'shelf', 10), B('c', 'PC0003', 'shelf', -2), B('d', 'PD0004', 'used', 10), B('e', 'PE0005', 'shelf', 10, 'b2')] })); });
  await p.waitForTimeout(300);
  await p.locator('[data-cntstart]').click(); await p.waitForTimeout(100);
  const inp = 'input[aria-label="مسح ملصق التحضير"]';
  for (const c of ['PA0001', 'PC0003', 'PD0004', 'PE0005', 'ZZ9999']) { await p.locator(inp).pressSequentially(c, { delay: 4 }); await p.press(inp, 'Enter'); await p.waitForTimeout(80); }
  await p.locator(inp).pressSequentially('PA0001', { delay: 4 }); await p.press(inp, 'Enter'); await p.waitForTimeout(80);
  assert.match(await say(p), /مُسح من قبل/);
  const n = async (k) => p.locator('[data-cntn="' + k + '"]').innerText();
  assert.match(await n('found'), /موجود 2 من 3/); assert.match(await n('missing'), /1/); assert.match(await n('expired'), /1/); assert.match(await n('extra'), /3/);
  assert.equal(await p.locator('[data-pbhit]').count(), 0, 'وضع الجرد لا يفتح بطاقة الدفعة');
  await p.locator('[data-cntdone]').click(); await p.waitForTimeout(200);
  const r = await p.evaluate(() => window.cur.prepCounts[0]);
  assert.deepEqual([r.found.sort(), r.missing, r.expired, r.extra.map(x => x.why).sort(), r.shelf, r.viaScan], [['PA0001', 'PC0003'], ['PB0002'], ['PC0003'], ['other', 'unknown', 'used'], 3, 5]);
  assert.equal(await p.locator('[data-cnthist] tbody tr').count(), 1);
  assert.equal(await p.evaluate(() => window.cur.prepBatches.find(x => x.id === 'a').status), 'shelf', 'الجرد لا يغيّر حالة الدفعات');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v45.1 باركود غير معروف: المركز يضيف الصنف من بند أمر الشراء ويُختار فورًا، والفرع يرى «اطلب من المركز»', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await p.waitForTimeout(200);
  await p.locator('button', { hasText: 'أمر شراء جديد' }).click(); await p.waitForTimeout(200);
  const n0 = await p.evaluate(() => window.curOrg.items.length);
  await p.locator('input[aria-label="صنف البند 1 — بحث"]').pressSequentially('6281000123456', { delay: 5 }); await p.waitForTimeout(150);
  await p.locator('[data-itemadd]').click(); await p.waitForTimeout(150);
  assert.equal(await p.inputValue('input[aria-label="باركود الصنف الجديد"]'), '6281000123456', 'الباركود الممسوح مكتوب مسبقًا');
  await p.fill('input[aria-label="اسم الصنف الجديد"]', 'زيت زيتون'); await p.selectOption('select[aria-label="وحدة الصنف الجديد"]', 'لتر');
  await p.locator('[data-itemaddsave]').click(); await p.waitForTimeout(150);
  assert.match(await say(p), /اختر تصنيف الصنف/, 'التصنيف إلزامي');
  await p.locator('[data-qtype="stock"]').click(); await p.locator('[data-itemaddsave]').click(); await p.waitForTimeout(300);
  const it = await p.evaluate(() => window.curOrg.items[window.curOrg.items.length - 1]);
  assert.deepEqual([it.name, it.unit, it.type, it.barcode, /^ITM-\d{4}$/.test(it.code)], ['زيت زيتون', 'لتر', 'stock', '6281000123456', true]);
  assert.equal(await p.evaluate(() => window.curOrg.items.length), n0 + 1);
  assert.equal(await p.inputValue('select[aria-label="صنف البند 1"]'), it.id, 'اختير الصنف الجديد في البند');
  // باركود مكرر ⇒ مرفوض
  await p.locator('button', { hasText: 'بند إضافي' }).click(); await p.waitForTimeout(100);
  await p.locator('input[aria-label="صنف البند 2 — بحث"]').pressSequentially('9999999999', { delay: 5 }); await p.locator('[data-itemadd]').click(); await p.waitForTimeout(100);
  await p.fill('input[aria-label="باركود الصنف الجديد"]', '6281000123456'); await p.fill('input[aria-label="اسم الصنف الجديد"]', 'مكرر'); await p.selectOption('select[aria-label="وحدة الصنف الجديد"]', 'حبة'); await p.locator('[data-qtype="consumable"]').click(); await p.locator('[data-itemaddsave]').click(); await p.waitForTimeout(150);
  assert.match(await say(p), /مستخدم للصنف «زيت زيتون»/);
  assert.deepEqual(errs, []); await ctx.close();
  // الفرع: لا إضافة — تنبيه فقط
  const b = await open({ viewport: { width: 1300, height: 900 } }, 'live/BranchWarehouse/bm');
  await b.p.locator('button', { hasText: 'طلب شراء' }).first().click(); await b.p.waitForTimeout(150);
  await b.p.locator('input[aria-label="صنف الطلب 1 — بحث"]').pressSequentially('6281000999999', { delay: 5 }); await b.p.waitForTimeout(150);
  assert.equal(await b.p.locator('[data-itemadd]').count(), 0); assert.equal(await b.p.locator('[data-itemaddhint]').count(), 1);
  assert.deepEqual(b.errs, []); await b.ctx.close();
});

test('v45.2 المسح بالأرقام العربية أو بلوحة مفاتيح عربية: ملصق التحضير يُقرأ، والباركود يختار الصنف', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/bm/closehub:prepdaily');
  await p.evaluate(() => { const now = Date.now(), H = 3600000, iso = (t) => new Date(t).toISOString();
    window.setOrg(g => ({ ...g, preps: [{ id: 'pr1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 24 }] }));
    window.setOps(o => ({ ...o, prepBatches: [{ id: 'a', code: 'PMB7Q2K4XZ', branchId: 'b1', prepId: 'pr1', name: 'صلصة ثوم', unit: 'كجم', qty: 1, madeAt: iso(now - H), expAt: iso(now + 20 * H), status: 'shelf', by: 'سعد' }] })); });
  await p.waitForTimeout(300);
  const inp = 'input[aria-label="مسح ملصق التحضير"]';
  for (const typed of ['حةلا٧ض٢ن٤ءئ', '؛\'لآ7َ2،4ْ~']) {
    await p.locator(inp).pressSequentially(typed, { delay: 4 }); await p.press(inp, 'Enter'); await p.waitForTimeout(150);
    assert.equal(await p.locator('[data-pbhit="ok"]').count(), 1, 'قُرئ: ' + typed);
    assert.match(await p.locator('[data-pbhit="ok"]').innerText(), /PMB7Q2K4XZ/);
  }
  assert.deepEqual(errs, []); await ctx.close();
  // الباركود بالأرقام العربية في بند أمر الشراء يختار الصنف تلقائيًا
  const c = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/purchasing:suppliers');
  await c.p.evaluate(() => window.setOrg(g => ({ ...g, items: (g.items || []).map((x, i) => i === 0 ? { ...x, barcode: '6281000123456' } : x) })));
  await c.p.waitForTimeout(200);
  await c.p.locator('button', { hasText: 'أوامر الشراء' }).first().click(); await c.p.waitForTimeout(150);
  await c.p.locator('button', { hasText: 'أمر شراء جديد' }).click(); await c.p.waitForTimeout(150);
  await c.p.locator('input[aria-label="صنف البند 1 — بحث"]').pressSequentially('٦٢٨١٠٠٠١٢٣٤٥٦', { delay: 4 }); await c.p.waitForTimeout(150);
  const id0 = await c.p.evaluate(() => window.curOrg.items[0].id);
  assert.equal(await c.p.inputValue('select[aria-label="صنف البند 1"]'), id0);
  assert.equal(await c.p.inputValue('input[aria-label="صنف البند 1 — بحث"]'), '', 'مُسح الحقل بعد الاختيار');
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

test('v45.3 تقرير هدر التحضير: الفرع يرى الكميات والنسب بلا قيمة، والمركز يرى كل الفروع والقيمة', async () => {
  const seed = () => { const now = Date.now(), H = 3600000, iso = (t) => new Date(t).toISOString();
    const B = (id, br, qty, ex) => ({ id, code: id, branchId: br, prepId: 'pr1', name: 'صلصة ثوم', unit: 'كجم', qty, madeAt: iso(now - 2 * H), expAt: iso(now + 20 * H), status: 'shelf', by: 'سعد', ...(ex || {}) });
    window.setOps(o => ({ ...o, prepBatches: [B('a', 'b1', 4), B('b', 'b1', 1, { status: 'discarded', discardAt: iso(now - H), reason: 'expired' }), B('c', 'b2', 2, { status: 'discarded', discardAt: iso(now - H), reason: 'storage' })] })); };
  const b = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/bm/closehub:prepdaily');
  await b.p.evaluate(() => window.setOrg(g => ({ ...g, preps: [{ id: 'pr1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 24 }] }))); await b.p.evaluate(seed); await b.p.waitForTimeout(200);
  await b.p.locator('[data-ptab="waste"]').click(); await b.p.waitForTimeout(200);
  assert.match(await b.p.locator('[data-pwr-row="صلصة ثوم"]').innerText(), /5[\s\S]*1[\s\S]*20%[\s\S]*منتهي الصلاحية/);
  assert.equal(await b.p.locator('[data-pwrbr]').count(), 0, 'الفرع لا يرى جدول الفروع');
  assert.doesNotMatch(await b.p.locator('[data-pwrrows] thead').innerText(), /القيمة/);
  assert.deepEqual(b.errs, []); await b.ctx.close();
  const c = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/ho/closehub:prepdaily');
  await c.p.evaluate(() => window.setOrg(g => ({ ...g, preps: [{ id: 'pr1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 24, batch: 2, parts: [{ itemId: (g.items || [])[0].id, qty: 1 }] }] }))); await c.p.evaluate(seed); await c.p.waitForTimeout(200);
  await c.p.locator('[data-ptab="waste"]').click(); await c.p.waitForTimeout(250);
  assert.equal(await c.p.locator('[data-pwrbr] tbody tr').count(), 2, 'كل الفروع');
  assert.match(await c.p.locator('[data-pwrrows] thead').innerText(), /القيمة/);
  assert.match(await c.p.locator('[data-pwr-row="صلصة ثوم"]').innerText(), /3[\s\S]*2[\s\S]*%/);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

test('v45.4 صورة المنتج: تُرفع في نموذج المنتج (مصغّرة) وتظهر على زر نقطة البيع، ويمكن إخفاؤها من الإعدادات', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Inventory/admin/recipes');
  // صورة اختبار 600×400 تُولَّد في المتصفح
  // منتج (دائرة بنية) على خلفية فاتحة فيها ضوضاء خفيفة
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#ece9e4'; g.fillRect(0, 0, 600, 400);
    for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect((i * 37) % 600, (i * 53) % 400, 2, 2); }
    g.fillStyle = '#8a4b1f'; g.beginPath(); g.arc(300, 210, 120, 0, 7); g.fill(); return c.toDataURL('image/png').split(',')[1]; });
  await p.locator('.card:has-text("مندي لحم") button', { hasText: 'تعديل' }).first().click(); await p.waitForTimeout(200);
  await p.setInputFiles('input[aria-label="صورة المنتج"]', { name: 'm.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await p.waitForTimeout(400);
  assert.equal(await p.locator('[data-prodimg] img').count(), 1, 'معاينة');
  await p.locator('button', { hasText: 'حفظ المنتج' }).click(); await p.waitForTimeout(300);
  const img = await p.evaluate(() => (window.curOrg.products.find(x => x.name.includes('مندي لحم')) || {}).img || '');
  assert.match(img, /^data:image\/(webp|png);base64,/, 'بلا خلفية ⇒ صيغة شفافة'); assert.ok(img.length < 60000, 'خفيفة: ' + img.length);
  const px = await p.evaluate((u) => new Promise(r => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    r([i.width, i.height, g.getImageData(3, 3, 1, 1).data[3], g.getImageData(120, 120, 1, 1).data[3]]); }; i.src = u; }), img);
  assert.deepEqual(px, [240, 240, 0, 255], 'مربّعة 240 · الزاوية شفافة · المنتج في الوسط معتم');
  // إيقاف الخيار ⇒ الصورة كما هي (JPEG بخلفيتها)
  await p.locator('.card:has-text("مندي لحم") button', { hasText: 'تعديل' }).first().click(); await p.waitForTimeout(200);
  await p.uncheck('input[aria-label="إزالة الخلفية والضوضاء"]');
  await p.setInputFiles('input[aria-label="صورة المنتج"]', { name: 'm.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await p.waitForTimeout(400);
  assert.match(await p.getAttribute('[data-prodimg-prev]', 'src'), /^data:image\/jpeg/);
  await p.locator('button', { hasText: 'إلغاء' }).last().click(); await p.waitForTimeout(150);
  assert.deepEqual(errs, []); await ctx.close();
  // نقطة البيع: الصورة على الزر، وتختفي عند إيقافها
  const o = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await o.p.evaluate((img) => { window.setOrg(g => ({ ...g, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي', img }, { id: 'h', name: 'حمص', sellPrice: 18, cat: 'مقبلات' }] })); window.setOps(x => ({ ...x, posOrders: [] })); }, img);
  await o.p.waitForTimeout(400);
  const ob = o.p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await o.p.waitForTimeout(400); }
  assert.equal(await o.p.locator('.pos-tile:has-text("كبسة") img.pos-tile-img.cut').count(), 1, 'مقصوصة ⇒ بلا خلفية على الزر');
  assert.equal(await o.p.locator('.pos-tile:has-text("حمص") img').count(), 0, 'بلا صورة ⇒ كما هو');
  await o.p.locator('.pos-tile:has-text("كبسة")').click(); await o.p.waitForTimeout(150);
  assert.equal(await o.p.locator('.pos-tile.on:has-text("كبسة")').count(), 1, 'الإضافة للسلة تعمل');
  await o.p.evaluate(() => window.setOrg(g => ({ ...g, posCfg: { ...g.posCfg, noImg: true } }))); await o.p.waitForTimeout(200);
  assert.equal(await o.p.locator('.pos-tile img').count(), 0, 'مخفية من الإعدادات');
  assert.deepEqual(o.errs, []); await o.ctx.close();
});

test('v45.6 «طباعة الشاشة»: أي شاشة بلا زر طباعة تُطبع A4 — الجداول والقيم تبقى، والأزرار تُحذف، والحقول تُطبع قيمها نصًا', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Inventory/ho/wh');
  await p.evaluate(() => window.setOps(o => ({ ...o, stockMoves: [{ id: 's1', itemId: 'i1', kind: 'purchase', qty: 50, date: '2026-11-10', by: 'سارة' }], whMoves: [], whTransfers: [] })));
  await p.waitForTimeout(300);
  await p.selectOption('select[aria-label="مخزون المستودع"]', 'wh-b1'); await p.waitForTimeout(150);
  const ok = await p.evaluate(() => window.__M.printScreen(window.curOrg, document.querySelector('#r'), 'المستودعات'));
  assert.equal(ok, true); await p.waitForTimeout(500);
  const doc = await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || '');
  assert.match(doc, /<title>المستودعات<\/title>/);
  assert.match(doc, /<table/); assert.match(doc, /المستودع الرئيسي/);
  assert.doesNotMatch(doc, /<button/, 'لا أزرار'); assert.doesNotMatch(doc, /<select/, 'لا قوائم');
  assert.match(doc, /class="ps-val">مستودع طيبة</, 'قيمة القائمة المختارة نصًا');
  assert.match(doc, /صادر من/, 'ترويسة وتذييل A4');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v45.7 إغلاق الوردية: تقرير Z يظهر في عارض المستندات بزر «طباعة / PDF» (لا طباعة تلقائية تحجبها الأجهزة)', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] })); window.setOps(o => ({ ...o, posOrders: [], posShifts: [] })); });
  await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('button', { hasText: /^الوردية$/ }).first().click(); await p.waitForTimeout(200);
  await p.locator('.card input').first().fill('0'); await p.waitForTimeout(100);
  await p.locator('button', { hasText: 'إغلاق الوردية وطباعة التقرير' }).click(); await p.waitForTimeout(700);
  assert.equal(await p.locator('.mz-docv').count(), 1, 'عارض المستندات ظهر');
  assert.equal(await p.locator('.mz-docv button', { hasText: 'طباعة / PDF' }).count(), 1);
  const doc = await p.evaluate(() => document.querySelector('.mz-docv iframe').srcdoc);
  assert.match(doc, /size:80mm auto/); assert.match(doc, /\(Z\)|Z\)/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v45.8 ملخصات الإغلاق: الإعداد يُفعَّل للمدير، والوردية المغلقة والفرق النقدي يظهران في مركز التنبيهات مع مشاركة واتساب — ومدير الفرع لا تصله', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/SystemPanel/admin');
  await p.waitForSelector('[data-closealerts]', { timeout: 8000 });
  await p.locator('[data-closealerts] button', { hasText: 'تفعيل' }).click(); await p.waitForTimeout(200);
  const cfg = await p.evaluate(() => window.curOrg.closeAlerts);
  assert.equal(cfg.on, true); assert.deepEqual(cfg.roles, ['system_admin', 'general_management', 'finance_department', 'accountant']);
  assert.equal(cfg.shift && cfg.variance && cfg.daily, true);
  await ctx.close();

  const r = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Notifications/admin');
  await r.p.evaluate(() => { window.setOrg(g => ({ ...g, closeAlerts: { on: true, varMax: 10 } }));
    const at = new Date().toISOString();
    window.setOps(o => ({ ...o, posOrders: [], posShifts: [
      { id: 'sh1', branchId: 'b1', devName: 'الكاشير 1', status: 'closed', closedAt: at, closedBy: 'أحمد', openingCash: 300, expected: 1300, counted: 1275, diff: -25, n: 14, total: 2140 },
      { id: 'sh2', branchId: 'b2', devName: 'الكاشير 2', status: 'closed', closedAt: at, closedBy: 'سالم', openingCash: 300, expected: 900, counted: 905, diff: 5, n: 8, total: 980 }] })); });
  await r.p.waitForSelector('[data-zsum]', { timeout: 8000 });
  const txt = await r.p.locator('[data-zsum]').innerText();
  assert.match(txt, /إغلاق وردية — عم قاسم طيبة/); assert.match(txt, /إغلاق وردية — عم قاسم النسيم/);
  assert.match(txt, /عجز نقدي 25\.00 ر\.س — عم قاسم طيبة/, 'فرق فوق الحد يُنبَّه فوريًا');
  assert.doesNotMatch(txt, /زيادة نقدية 5/, 'الفرق دون الحد لا يُنبَّه منفردًا');
  await r.p.evaluate(() => { window.__wa = []; window.open = (u) => { window.__wa.push(u); return null; }; });
  await r.p.locator('[data-zsum] button[data-wa]').first().click();
  const u = await r.p.evaluate(() => window.__wa[0]);
  assert.match(u, /^https:\/\/wa\.me\/\?text=/); const t = decodeURIComponent(u.split('text=')[1]);
  assert.match(t, /المبيعات/); assert.match(t, /معدود/);
  await r.p.evaluate(() => window.as('bm')); await r.p.waitForTimeout(300);
  assert.equal(await r.p.locator('[data-zsum]').count(), 0, 'مدير الفرع ليس ضمن المستلمين');
  await r.p.evaluate(() => window.as('acc')); await r.p.waitForTimeout(300);
  assert.equal(await r.p.locator('[data-zsum]').count(), 1, 'المحاسب ضمن المستلمين');
  assert.deepEqual([...errs, ...r.errs], []); await r.ctx.close();
});

test('v46.0 وحدة الصنف إلزامية في فاتورة الشراء: صنف بلا وحدة معتمدة يُطلب تحديدها وتُحفظ في بطاقته، والشراء بالجرام لصنف بالكيلو يُحوَّل للمخزون', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, suppliers: (g.suppliers || []).map(x => ({ ...x, vatNo: '300000000000003' })),
    items: [...(g.items || []), { id: 'ux', name: 'زعفران', unit: 'وحدة', cost: 5, isActive: true, type: 'stock' }] })); window.setOps(o => ({ ...o, invoices: [], stockMoves: [], whMoves: [] })); });
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'فاتورة توريد جديدة' }).click(); await p.waitForTimeout(150);
  await p.selectOption('select[aria-label="صنف البند 1"]', 'ux'); await p.waitForTimeout(100);
  assert.equal(await p.locator('.modal [data-uomfix]').count(), 1, 'يُطلب تحديد وحدة الصنف');
  await p.fill('input[aria-label="كمية البند 1"]', '500'); await p.fill('input[aria-label="سعر البند 1"]', '0.05');
  await p.locator('.modal [data-pm="credit"]').click();
  await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(200);
  assert.match(await say(p), /حدد وحدة الصنف «زعفران»/);
  await p.selectOption('select[aria-label="وحدة الصنف للبند 1"]', 'كيلو'); await p.waitForTimeout(100);
  const opts = await p.locator('select[aria-label="وحدة البند 1"] option').allInnerTexts();
  assert.deepEqual(opts.map(x => x.split(' (')[0]), ['كيلو', 'جرام', 'طن'], 'وحدات الوزن فقط');
  await p.selectOption('select[aria-label="وحدة البند 1"]', 'جرام');
  await p.locator('.modal button', { hasText: 'تسجيل الفاتورة' }).click(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const i = window.cur.invoices[0]; const l = i.lines[0]; const mv = [...(window.cur.stockMoves || []), ...(window.cur.whMoves || [])].find(m => m.invoiceId === i.id);
    return { amt: i.amount, l: [l.qty, l.unitCost, l.net, l.uomName, l.uomQty], mv: [mv.qty, mv.unitCost], unit: window.curOrg.items.find(x => x.id === 'ux').unit }; });
  assert.deepEqual(r, { amt: 25, l: [0.5, 50, 25, 'جرام', 500], mv: [0.5, 50], unit: 'كيلو' });
  // بطاقة الصنف: الوحدة من القائمة إلزامية
  const u = await p.evaluate(() => [window.__M.uomOf('كجم').ar, window.__M.uomOf('مل').ar, window.__M.uomOf('وحدة'), window.__M.uomConv('جالون', 'لتر')]);
  assert.deepEqual(u, ['كيلو', 'ملليلتر', null, 3.78541]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v46.2 الأصناف: بحث وتصفية، و«الحذف» أرشفة دائمًا (لا حذف نهائي) مع الاستعادة، وكرت حركة الصنف بالشراء والتحويل والمبيعات', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Inventory/admin/items');
  const td = new Date().toISOString().slice(0, 10);
  await p.evaluate((td) => { window.setOrg(g => ({ ...g, items: [...(g.items || []), { id: 'nx', name: 'بهارات تجربة', unit: 'كيلو', cost: 3, isActive: true, type: 'stock', code: 'ITM-0099' }] }));
    window.setOps(o => ({ ...o, stockMoves: [{ id: 'sm1', itemId: 'i1', kind: 'purchase', qty: 20, unitCost: 40, date: td, at: td + 'T08:00:00', ref: 'INV-7', by: 'سارة' }],
      whTransfers: [{ id: 't1', no: 'TR-0001', kind: '', status: 'received', fromWh: 'wh-main', toWh: 'wh-b1', sentDate: td, receivedDate: td, lines: [{ itemId: 'i1', qtySent: 8, qtyRecv: 8 }] }],
      posOrders: [{ id: 'po1', branchId: 'b1', date: td, status: 'paid', total: 120, lines: [{ productId: 'p9', qty: 2 }] }] })); }, td);
  await p.waitForTimeout(300);
  await p.fill('input[aria-label="بحث الأصناف"]', 'بهارات'); await p.waitForTimeout(100);
  assert.equal(await p.locator('table.tb tbody tr').count(), 1, 'البحث بالاسم');
  await p.fill('input[aria-label="بحث الأصناف"]', ''); await p.waitForTimeout(100);
  // «الحذف» = أرشفة حتى لصنف بلا أثر
  await p.locator('tr', { hasText: 'بهارات تجربة' }).locator('button', { hasText: 'تعديل' }).click(); await p.waitForTimeout(150);
  assert.match(await p.locator('[data-itemdel]').innerText(), /أرشفة الصنف/);
  await p.locator('[data-itemdel]').click(); await p.waitForTimeout(200);
  const nx = await p.evaluate(() => window.curOrg.items.find(x => x.id === 'nx'));
  assert.equal(nx && nx.isActive, false, 'أُرشف ولم يُحذف'); assert.ok(nx.archivedAt);
  assert.equal(await p.locator('tr', { hasText: 'بهارات تجربة' }).count(), 0, 'يختفي من النشطة');
  await p.selectOption('select[aria-label="حالة الصنف"]', 'off'); await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-itemoff]').count(), 1);
  await p.locator('tr', { hasText: 'بهارات تجربة' }).locator('button', { hasText: 'تعديل' }).click(); await p.waitForTimeout(150);
  await p.locator('[data-itemreact]').click(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.curOrg.items.find(x => x.id === 'nx').isActive), true, 'استُعيد');
  await p.selectOption('select[aria-label="حالة الصنف"]', 'active'); await p.waitForTimeout(100);
  // كرت الحركة: افتتاحي من الحركات السابقة، شراء وتحويل صادر/وارد، ومبيعات نظرية
  await p.locator('tr', { hasText: 'لحم غنم' }).locator('[data-itemledger]').click(); await p.waitForTimeout(250);
  const kinds = await p.locator('[data-ledger] tbody tr td:nth-child(2)').allInnerTexts();
  assert.deepEqual(kinds.sort(), ['تحويل صادر', 'تحويل وارد', 'توريد شراء'].sort());
  const sum = await p.locator('[data-ledgersum]').innerText();
  assert.match(sum, /رصيد افتتاحي\s*50/); assert.match(sum, /رصيد ختامي\s*70/);
  await p.selectOption('select[aria-label="مستودع الحركة"]', 'wh-b1'); await p.waitForTimeout(150);
  assert.deepEqual(await p.locator('[data-ledger] tbody tr td:nth-child(2)').allInnerTexts(), ['تحويل وارد'], 'تصفية بالمستودع');
  assert.match(await p.locator('[data-ledgersum]').innerText(), /رصيد ختامي\s*58/);
  const sales = await p.locator('[data-ledgersales] tbody tr').first().innerText();
  assert.match(sales, /\t2\t1$/, 'استهلاك نظري: 2 × 0.41 ÷ 82% = 1');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v46.3 خصم المبيعات من المخزون مفعّل: صرف مادة داخلة في الوصفات يدويًا ممنوع (تُخصم بالبيع)، والهدر مسموح، وكرت الحركة يوضح ذلك', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/BranchWarehouse/bm');
  const td = new Date().toISOString().slice(0, 10);
  await p.evaluate((td) => window.setOrg(g => ({ ...g, purchaseCfg: { ...(g.purchaseCfg || {}), perpetualFrom: td.slice(0, 7), saleDeductFrom: td } })), td);
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click(); await p.waitForTimeout(150);
  await p.locator('.card select').first().selectOption('i1'); await p.locator('.card input[placeholder="الكمية"]').first().fill('2');
  await p.locator('button', { hasText: /^تسجيل صرف/ }).first().click(); await p.waitForTimeout(250);
  assert.match(await say(p), /يُخصم تلقائيًا مع كل فاتورة بيع — لا يُصرف يدويًا/);
  assert.equal(await p.evaluate(() => (window.cur.whMoves || []).filter(m => m.kind === 'out' && m.itemId === 'i1' && String(m.at || m.date).slice(0, 10) === new Date().toISOString().slice(0, 10)).length), 0);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v46.4 تقرير الصنف: تصفية بنوع الحركة، والحالات المعلّقة (تحويل مطلوب، أمر شراء مفتوح، هدر بانتظار الاعتماد)، والتصدير إلى Excel', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Inventory/admin/items');
  const td = new Date().toISOString().slice(0, 10);
  await p.evaluate((td) => window.setOps(o => ({ ...o, stockMoves: [{ id: 'sm1', itemId: 'i1', kind: 'purchase', qty: 20, unitCost: 40, date: td, at: td + 'T08:00:00', ref: 'INV-7' }, { id: 'sm2', itemId: 'i1', kind: 'waste', qty: -2, date: td, at: td + 'T09:00:00' }],
    whTransfers: [{ id: 't2', no: 'REQ-9', kind: '', status: 'requested', fromWh: 'wh-main', toWh: 'wh-b1', requestedAt: td, lines: [{ itemId: 'i1', qtyReq: 5 }] }],
    purchaseOrders: [{ id: 'po9', poNo: 'PO-0009', status: 'open', supplierName: 'مورد', date: td, lines: [{ itemId: 'i1', qty: 12, received: 4 }] }],
    wasteRequests: [{ id: 'wr1', status: 'pending', whId: 'wh-main', at: td + 'T10:00:00', by: 'خالد', lines: [{ itemId: 'i1', qty: 3 }] }] })), td);
  await p.waitForTimeout(300);
  await p.locator('tr', { hasText: 'لحم غنم' }).locator('[data-itemledger]').click(); await p.waitForTimeout(250);
  await p.selectOption('select[aria-label="نوع الحركة"]', 'waste'); await p.waitForTimeout(100);
  assert.deepEqual(await p.locator('[data-ledger] tbody tr td:nth-child(2)').allInnerTexts(), ['هدر/إتلاف']);
  const pend = await p.locator('[data-ledgerpending] tbody').innerText();
  assert.match(pend, /تحويل[\s\S]*مطلوب[\s\S]*5/); assert.match(pend, /أمر شراء[\s\S]*مفتوح[\s\S]*8/); assert.match(pend, /هدر[\s\S]*بانتظار الاعتماد[\s\S]*3/);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('[data-ledgerxlsx]').click()]);
  const fp = await dl.path(); const head = (await import('node:fs')).readFileSync(fp).subarray(0, 2).toString(); assert.equal(head, 'PK', 'ملف Excel (xlsx)');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v46.5 السندات المخزنية: سند توريد متعدد البنود برقم تسلسلي، ورصيد افتتاحي لمستودع فرع، والتسوية تطلب السبب، والصرف لا يتجاوز الرصيد، والطباعة، ونقطة جرد لأي مستودع', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/admin/vouchers');
  await p.waitForSelector('[data-vouchers]', { timeout: 8000 });
  const newV = async (t, wh) => { await p.locator('[data-newvoucher]').click(); await p.waitForTimeout(150); await p.locator(`[data-vtype="${t}"]`).click(); if (wh) await p.selectOption('select[aria-label="مستودع السند"]', wh); };
  // توريد ببندين
  await newV('rcv', 'wh-main');
  await p.selectOption('select[aria-label="صنف السند 1"]', 'i1'); await p.fill('input[aria-label="كمية السند 1"]', '10'); await p.fill('input[aria-label="تكلفة السند 1"]', '42');
  await p.locator('.modal button', { hasText: 'بند آخر' }).click();
  await p.selectOption('select[aria-label="صنف السند 2"]', 'i2'); await p.fill('input[aria-label="كمية السند 2"]', '30'); await p.fill('input[aria-label="تكلفة السند 2"]', '4');
  await p.locator('[data-vsave]').click(); await p.waitForTimeout(300);
  let r = await p.evaluate(() => window.cur.stockMoves.filter(m => m.kind === 'in' && m.vno).map(m => [m.itemId, m.qty, m.unitCost, m.vno, m.whId]));
  assert.deepEqual(r.sort(), [['i1', 10, 42, 'RCV-M-00001', 'wh-main'], ['i2', 30, 4, 'RCV-M-00001', 'wh-main']]);
  assert.match(await p.locator('[data-vlist] tbody').innerText(), /RCV-M-00001[\s\S]*سند توريد/);
  // رصيد افتتاحي لمستودع الفرع
  await newV('opn', 'wh-b1'); await p.selectOption('select[aria-label="صنف السند 1"]', 'i2'); await p.fill('input[aria-label="كمية السند 1"]', '7'); await p.fill('input[aria-label="تكلفة السند 1"]', '4');
  await p.locator('[data-vsave]').click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => window.cur.whMoves.filter(m => m.opening).map(m => [m.whId, m.branchId, m.qty, !!/^OPN-/.test(m.vno)]));
  assert.deepEqual(r, [['wh-b1', 'b1', 7, true]]);
  // تسوية بلا سبب ⇒ مرفوض · صرف فوق الرصيد ⇒ مرفوض
  await newV('adj', 'wh-main'); await p.selectOption('select[aria-label="صنف السند 1"]', 'i1'); await p.fill('input[aria-label="كمية السند 1"]', '1');
  await p.locator('[data-vsave]').click(); await p.waitForTimeout(150); assert.match(await say(p), /سبب التسوية/);
  await p.locator('[data-vtype="iss"]').click(); await p.fill('input[aria-label="كمية السند 1"]', '9999');
  await p.locator('[data-vsave]').click(); await p.waitForTimeout(150); assert.match(await say(p), /تتجاوز رصيد المستودع/);
  await p.keyboard.press('Escape'); await p.locator('.modal button', { hasText: 'إلغاء' }).first().click().catch(() => {}); await p.waitForTimeout(150);
  // الطباعة في عارض المستندات
  await p.locator('tr', { hasText: 'RCV-M-00001' }).locator('[data-vprint]').click(); await p.waitForTimeout(400);
  const doc = await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || '');
  assert.match(doc, /سند توريد/); assert.match(doc, /RCV-M-00001/); assert.match(doc, /أمين المستودع/);
  assert.deepEqual(errs, []); await ctx.close();
  // نقطة جرد لأي مستودع
  const c = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/admin/count');
  await c.p.waitForSelector('[data-countwh]', { timeout: 8000 });
  await c.p.selectOption('select[aria-label="مستودع الجرد"]', 'wh-b1'); await c.p.waitForTimeout(200);
  assert.match(await c.p.locator('#r').innerText(), /مستودع طيبة/);
  assert.deepEqual(c.errs, []); await c.ctx.close();
});

test('v46.6 سندات القبض والصرف: صرف لمورد موزَّع على فاتورته والباقي على الحساب برقم PV وطباعة بالتفقيط، وسند قبض على حساب من الدليل، وربط عميل بمورد وكشف موحّد ومقاصّة، واستيراد جهات اتصال من vCard', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, partners: [...(g.partners || []), { id: 'cx', key: 'cust:cx', name: 'مؤسسة التموين', type: 'customer' }] }));
    window.setOps(o => ({ ...o, cashVouchers: [], invoices: [{ id: 'iv1', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', amount: 800, date: '2026-11-01', invoiceNo: 'S-77', paidAmount: 0 }],
      salesInvoices: [{ id: 'sx', no: 'INV-9', kind: 'invoice', terms: 'credit', customerKey: 'cust:cx', buyer: { name: 'مؤسسة التموين' }, date: '2026-11-02', net: 300, vat: 0, total: 300, receipts: [] }] })); });
  await p.waitForTimeout(300);
  await p.locator('[data-tabcv]').click(); await p.waitForTimeout(200);
  // سند صرف لمورد
  await p.locator('[data-newcv="pv"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-cvpt="sup"]').click(); await p.selectOption('select[aria-label="جهة السند"]', 'sup:s1');
  await p.locator('[data-cvpm="bank"]').click(); await p.fill('input[aria-label="مبلغ السند"]', '1000'); await p.fill('input[aria-label="بيان السند"]', 'دفعة شهر نوفمبر');
  await p.locator('[data-cvauto]').click(); await p.waitForTimeout(100);
  assert.equal(await p.inputValue('input[aria-label="توزيع S-77"]'), '800');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(500);
  let r = await p.evaluate(() => ({ v: window.cur.cashVouchers.map(v => [v.no, v.kind, v.amount, v.fund, (v.alloc || []).length]), pay: (window.cur.invoices[0].payments || []).map(x => [x.amount, x.cv]) }));
  assert.deepEqual(r, { v: [['PV-000001', 'pv', 1000, '1201', 1]], pay: [[800, 'PV-000001']] });
  const doc = await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || '');
  assert.match(doc, /سند صرف/); assert.match(doc, /PV-000001/); assert.match(doc, /ألف/, 'التفقيط');
  await p.locator('.mz-docv button', { hasText: 'إغلاق' }).click().catch(() => {}); await p.waitForTimeout(150);
  // سند قبض على حساب من الدليل
  await p.locator('[data-newcv="rv"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-cvpt="acc"]').click(); const acc = await p.evaluate(() => Array.from(document.querySelectorAll('select[aria-label="حساب السند"] option')).map(o => o.value).find(v => /^4/.test(v)));
  await p.selectOption('select[aria-label="حساب السند"]', acc); await p.fill('input[aria-label="مبلغ السند"]', '250');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(400);
  r = await p.evaluate(() => window.cur.cashVouchers.map(v => [v.no, v.fund, (v.party || {}).t]));
  assert.deepEqual(r[0], ['RV-000001', '1101', 'acc']);
  assert.deepEqual(errs, []); await ctx.close();

  // ربط العميل بالمورد + كشف موحّد + استيراد vCard
  const q = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Partners/admin');
  await q.p.evaluate(() => window.setOrg(g => ({ ...g, partners: [...(g.partners || []), { id: 'cx', key: 'cust:cx', name: 'مؤسسة التموين', type: 'customer' }] }))); await q.p.waitForTimeout(300);
  await q.p.locator('tr', { hasText: 'مؤسسة التموين' }).first().locator('td').first().click(); await q.p.waitForTimeout(400);
  await q.p.selectOption('select[aria-label="ربط الجهة"]', 'sup:s1'); await q.p.waitForTimeout(300);
  r = await q.p.evaluate(() => [window.curOrg.partners.find(x => x.id === 'cx').linkKey, window.curOrg.suppliers.find(x => x.id === 's1').linkKey]);
  assert.deepEqual(r, ['sup:s1', 'cust:cx']);
  assert.equal(await q.p.locator('[data-mergedstmt]').count(), 1);
  await q.p.locator('button', { hasText: 'رجوع إلى جهات الاتصال' }).click(); await q.p.waitForTimeout(200);
  await q.p.locator('[data-cimp]').click(); await q.p.waitForTimeout(150);
  const vcf = 'BEGIN:VCARD\nVERSION:3.0\nFN:مطبخ الوليمة\nTEL;TYPE=CELL:+966 50 111 2222\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nN:الحربي;سالم;;;\nTEL:0555000111\nEMAIL:s@x.sa\nEND:VCARD\n';
  await q.p.setInputFiles('[data-cimpfile]', { name: 'contacts.vcf', mimeType: 'text/vcard', buffer: Buffer.from(vcf, 'utf8') }); await q.p.waitForTimeout(300);
  assert.equal(await q.p.locator('[data-cimprows] tbody tr').count(), 2);
  await q.p.locator('[data-cimpsave]').click(); await q.p.waitForTimeout(300);
  r = await q.p.evaluate(() => window.curOrg.partners.filter(x => ['مطبخ الوليمة', 'سالم الحربي'].includes(x.name)).map(x => [x.name, x.phone, x.type]).sort());
  assert.deepEqual(r, [['سالم الحربي', '0555000111', 'customer'], ['مطبخ الوليمة', '+966501112222', 'customer']]);
  assert.deepEqual(q.errs, []); await q.ctx.close();
});

test('v46.7 نواقص المخزون: شاشة الأصناف تعرض المادة النافدة بالسالب بعد خصم المبيعات، ومركز التنبيهات ينبّه بنفادها', async () => {
  const td = new Date().toISOString().slice(0, 10);
  const setup = (td) => { window.setOrg(g => ({ ...g, purchaseCfg: { ...(g.purchaseCfg || {}), perpetualFrom: td.slice(0, 7), saleDeductFrom: td } }));
    window.setOps(o => ({ ...o, whMoves: [...(o.whMoves || []), { id: 'sl_x', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'sale', qty: -70, date: td, auto: true }] })); };
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Inventory/admin/items');
  await p.evaluate(setup, td); await p.waitForTimeout(400);
  const t = await p.locator('[data-shortages]').innerText();
  assert.match(t, /نواقص المخزون/); assert.match(t, /لحم غنم[\s\S]*-20[\s\S]*سالب/);
  assert.deepEqual(errs, []); await ctx.close();
  const n = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Notifications/admin');
  await n.p.evaluate(setup, td); await n.p.waitForTimeout(400);
  assert.match(await n.p.locator('body').innerText(), /نفاد مواد في مستودع طيبة/);
  assert.deepEqual(n.errs, []); await n.ctx.close();
});

test('v46.8 «تعديل كمسودة» لإغلاق قديم تنقصه الفئات النقدية والمصروفات: النموذج يفتح دون انهيار ولا تتغير القيم', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'live/Hub/admin/closehub:closing');
  await p.evaluate(() => { const o = window.cur; window.setOps({ ...o, closings: o.closings.map(c => c.id === 'c2' ? (({ denominationDetails, expenses, ...x }) => x)(c) : c) }); });
  await p.waitForTimeout(200);
  const btns = p.locator('button', { hasText: 'تعديل كمسودة' }); assert.ok(await btns.count() > 0, 'زر التعديل ظاهر للإدارة');
  for (let i = 0; i < await btns.count(); i++) {
    await btns.nth(i).click(); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__crash || ''), '', 'لا انهيار');
    assert.ok(await p.getByText('تعديل إغلاق وردية').count() > 0, 'النموذج مفتوح');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    if (await p.getByText('تعديل إغلاق وردية').count()) await p.reload().then(() => settle(p));
  }
  assert.deepEqual(errs, []);
  await ctx.close();
});

test('v46.8 مرتجع نقطة البيع: معطّل افتراضيًا؛ عند تفعيله يرجع مدير الفرع طبقًا هدرًا بسببه ويُرد نقدًا من الدرج', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posTabs: [], kdsTickets: [], posOrders: [], closings: o.closings.filter(c => c.branchId !== 'b1') }));   // يوم مفتوح بلا إغلاق مرحّل
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.locator('.pos-tile:has-text("كبسة")').click();
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(600);
  await p.click('.pos-tabs button:has-text("الفواتير")'); await p.waitForTimeout(300);
  assert.equal(await p.locator('table button:has-text("مرتجع")').count(), 0, 'المرتجع معطّل افتراضيًا');
  await p.evaluate(() => window.setOrg(g => ({ ...g, posCfg: { ...g.posCfg, returns: true } }))); await p.waitForTimeout(300);
  await p.locator('table button:has-text("مرتجع")').first().click(); await p.waitForTimeout(250);
  assert.match(await p.locator('.modal').innerText(), /تُسجَّل هدرًا/);
  await p.fill('input[aria-label="كمية مرتجع كبسة"]', '3'); await p.locator('.modal button:has-text("حفظ")').last().click(); await p.waitForTimeout(250);
  assert.match(await p.evaluate(() => window.lastSay || ''), /أكبر من المتبقي/, 'لا يُرجع أكثر من المباع');
  await p.fill('input[aria-label="كمية مرتجع كبسة"]', '1');
  await p.locator('.modal select').first().selectOption('prep');
  await p.locator('.modal select').nth(1).selectOption('cash');
  await p.locator('.modal button:has-text("حفظ")').last().click(); await p.waitForTimeout(500);
  const say1 = await p.evaluate(() => window.lastSay || ''); assert.match(say1, /سُجّل المرتجع/, 'رسالة الحفظ: ' + say1);
  const r = await p.evaluate(() => { const x = window.cur.posOrders.find(o => o.kind === 'return'); return x && { total: x.total, pay: x.payments.map(y => y.m + y.amount).join(), reason: x.reason, lines: x.lines.length, ret: x.retLines.map(l => l.name + l.qty).join(), ref: !!x.refNo, by: x.by }; });
  assert.deepEqual({ ...r, by: undefined }, { total: -58, pay: 'cash-58', reason: 'prep', lines: 0, ret: 'كبسة1', ref: true, by: undefined });
  const txt = await p.locator('.card').last().innerText();
  assert.match(txt, /مرتجع عن/); assert.match(txt, /مرتجعات 1/); assert.match(txt, /1 فاتورة/, 'المرتجع لا يُعد فاتورة');
  // الصنف الثاني فقط متبقٍ للإرجاع
  await p.locator('table button:has-text("مرتجع")').first().click(); await p.waitForTimeout(200);
  assert.match(await p.locator('.modal tbody tr').first().innerText(), /2\s+1/, 'المباع 2 والمتبقي 1');
  // بعد ترحيل إغلاق اليوم: لا مرتجع عليه
  await p.evaluate(() => window.setOps(o => ({ ...o, closings: [...o.closings, { id: 'cx', branchId: 'b1', date: o.posOrders[0].date, status: 'submitted' }] }))); await p.waitForTimeout(200);
  await p.fill('input[aria-label="كمية مرتجع كبسة"]', '1'); await p.locator('.modal button:has-text("حفظ")').last().click(); await p.waitForTimeout(250);
  assert.match(await p.evaluate(() => window.lastSay || ''), /إغلاق اليوم مُرحّل/);
  assert.equal(await p.evaluate(() => window.cur.posOrders.filter(o => o.kind === 'return').length), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v46.9 مرتجع نقطة البيع يخصم نقاط الولاء بنسبته ويظهر الخصم في النافذة وعلى الإشعار', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false, returns: true }, products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }] }));
    const d = new Date(); const td = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const bd = d.getHours() < 6 ? (() => { const y = new Date(d); y.setDate(y.getDate() - 1); return y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0'); })() : td;
    window.setOps(o => ({ ...o, posTabs: [], closings: o.closings.filter(c => c.branchId !== 'b1'),
      posOrders: [{ id: 'po1', no: 'ف1-T-0001', branchId: 'b1', date: bd, at: new Date().toISOString(), by: 'كاشير', channel: 'takeaway', lines: [{ productId: 'k', name: 'كبسة', qty: 2, price: 58 }], gross: 116, disc: 0, total: 116, vat: 15.13, net: 100.87, rate: 15, payments: [{ m: 'card', amount: 116 }], change: 0, status: 'paid', loyalty: { phone: '0551234567', name: 'سالم', earned: 10, redeemed: 0 } }] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.click('.pos-tabs button:has-text("الفواتير")'); await p.waitForTimeout(300);
  await p.locator('table button:has-text("مرتجع")').first().click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="كمية مرتجع كبسة"]', '1'); await p.waitForTimeout(150);
  assert.match(await p.locator('.modal').innerText(), /يُخصم 5 نقطة ولاء/, '10 نقاط × (58 المتبقي ÷ 116) = 5 تبقى ⇒ يُخصم 5');
  assert.match(await p.locator('.modal select').nth(1).innerText(), /شبكة \(طريقة الدفع الأصلية\)[\s\S]*نقدي/, 'الطريقة الأصلية أولًا والنقد خيار');
  await p.locator('.modal button:has-text("حفظ")').last().click(); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.lastSay || ''), /خُصم 5 نقطة ولاء/);
  const r = await p.evaluate(() => { const x = window.cur.posOrders.find(o => o.kind === 'return'); return [x.loyalty, x.payments[0].m, x.total]; });
  assert.deepEqual(r, [{ phone: '0551234567', ded: 5 }, 'card', -58], 'رُدّ على الشبكة (الأصلية)');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.1 اعتماد القيد اليدوي: قيد المحاسب ينتظر ولا يدخل الدفاتر ولا يعتمده بنفسه؛ المالك يعتمده فيُرحَّل', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'live/Accounting/acc/jr');
  await p.click('button:has-text("قيد يدوي / افتتاحي")'); await p.waitForTimeout(300);
  await p.fill('.modal input[placeholder^="مثال: استلام"]', 'تسوية اختبار');
  await p.locator('.modal select.jm-acc').nth(0).selectOption('5901'); await p.locator('.modal input.jm-d').nth(0).fill('250');
  await p.locator('.modal select.jm-acc').nth(1).selectOption('1201'); await p.locator('.modal input.jm-c').nth(1).fill('250');
  await p.click('.modal button:has-text("تسجيل القيد")'); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.lastSay || ''), /أُرسل القيد للاعتماد/);
  assert.deepEqual(await p.evaluate(() => window.cur.journalManual.filter(j => j.title === 'تسوية اختبار').map(j => [j.status, j.by])), [['pending', 'منى']]);
  await p.click('button:has-text("قيود بانتظار الاعتماد (1)")'); await p.waitForTimeout(250);
  assert.equal(await p.locator('[data-je-pending] button:has-text("اعتماد وترحيل")').count(), 0, 'لا يعتمد قيده بنفسه');
  assert.match(await p.locator('[data-je-pending]').innerText(), /بانتظار اعتماد محاسب آخر أو المالك/);
  const ops = await p.evaluate(() => window.cur); await ctx.close();
  // المالك (مسؤول النظام) يعتمد
  const o2 = await open({ viewport: { width: 1280, height: 900 } }, 'live/Accounting/admin/jr');
  await o2.p.evaluate((ops) => window.setOps(ops), ops); await o2.p.waitForTimeout(300);
  await o2.p.click('button:has-text("قيود بانتظار الاعتماد (1)")'); await o2.p.waitForTimeout(250);
  await o2.p.locator('[data-je-pending] button:has-text("اعتماد وترحيل")').click(); await o2.p.waitForTimeout(400);
  assert.match(await o2.p.evaluate(() => window.lastSay || ''), /اعتُمد القيد/);
  assert.deepEqual(await o2.p.evaluate(() => window.cur.journalManual.filter(j => j.title === 'تسوية اختبار').map(j => [j.status, j.approvedBy])), [['posted', 'مجاهد']]);
  assert.equal(await o2.p.locator('button:has-text("قيود بانتظار الاعتماد")').count(), 0, 'لا قيود معلّقة بعد الاعتماد');
  assert.deepEqual(errs, []); assert.deepEqual(o2.errs, []); await o2.ctx.close();
});

test('v47.2 عكس القيد اليدوي: قيد بأطراف معكوسة بتاريخ اليوم، مرة واحدة، ويصفّر أثر القيد الأصلي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'live/Accounting/admin/jr');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [{ id: 'jx1', date: o.closings[0].date, title: 'قيد خاطئ للعكس', by: 'منى', status: 'posted', lines: [{ code: '5901', debit: 300, credit: 0 }, { code: '1201', debit: 0, credit: 300 }] }] })));
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="بحث في القيود…"]', 'قيد خاطئ للعكس'); await p.waitForTimeout(200);
  await p.locator('td', { hasText: 'قيد خاطئ للعكس' }).first().click(); await p.waitForTimeout(250);
  await p.click('button:has-text("↺ عكس القيد")'); await p.waitForTimeout(400);
  assert.match(await p.evaluate(() => window.lastSay || ''), /سُجّل القيد العكسي/, 'المالك: مباشر');
  const r = await p.evaluate(() => window.cur.journalManual.filter(j => j.reverses === 'jx1').map(j => [j.status, j.title, j.lines.map(l => l.code + ':' + l.debit + '/' + l.credit).join(',')]));
  assert.deepEqual(r, [['posted', 'عكس: قيد خاطئ للعكس', '5901:0/300,1201:300/0']]);
  await p.locator('td', { hasText: 'قيد خاطئ للعكس' }).first().click(); await p.waitForTimeout(150);
  if (!(await p.locator('text=معكوس').count())) { await p.locator('td', { hasText: 'قيد خاطئ للعكس' }).first().click(); await p.waitForTimeout(150); }
  assert.ok(await p.locator('text=معكوس').count() > 0, 'يُعلَّم «معكوس»'); assert.equal(await p.locator('button:has-text("↺ عكس القيد")').count(), 0, 'لا يُعكس مرتين');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v49.0 BUG-01-04: إلغاء الإقفال الضريبي المرحّل بقيد عكسي بتاريخه — القيد الأصلي يبقى، والفترة تُتاح للإقفال من جديد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 1000 } }, 'live/Accounting/admin/vat');
  p.on('dialog', d => d.accept());
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [{ id: 'vcx', date: '2026-09-30', title: 'إقفال الفترة الضريبية اختبار', by: 'مجاهد', createdAt: '2026-10-01T08:00:00Z', src: 'vat-close',
    vatClose: { from: '2026-07-01', to: '2026-09-30', out: 150, inn: 50, net: 100, rate: 15 }, lines: [{ code: '2301', debit: 150, credit: 0 }, { code: '1501', debit: 0, credit: 50 }, { code: '2302', debit: 0, credit: 100 }] }] })));
  await p.waitForTimeout(400);
  await p.locator('button:has-text("إلغاء الإقفال")').first().click(); await p.waitForTimeout(400);
  assert.match(await p.evaluate(() => window.lastSay || ''), /بقيد عكسي/);
  const r = await p.evaluate(() => window.cur.journalManual.map(j => [j.id === 'vcx' ? 'orig' : j.vatUndo, j.status || '', j.date, j.lines.map(l => l.code + ':' + l.debit + '/' + l.credit).join(',')]));
  assert.deepEqual(r.sort(), [['orig', '', '2026-09-30', '2301:150/0,1501:0/50,2302:0/100'], ['vcx', 'posted', '2026-09-30', '2301:0/150,1501:50/0,2302:100/0']].sort(), 'لا حذف — قيد عكسي مرحّل بتاريخ الإقفال');
  assert.equal(await p.locator('button:has-text("إلغاء الإقفال")').count(), 0, 'الإقفال الملغى لا يظهر في القائمة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.3 سند التحويل: من الخزينة إلى البنك برقم TV، يمنع الحساب نفسه، ويُطبع بالطرفين', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  await p.evaluate(() => window.setOps(o => ({ ...o, cashVouchers: [] }))); await p.waitForTimeout(200);
  await p.locator('[data-tabcv]').click(); await p.waitForTimeout(200);
  await p.locator('[data-newcv="tv"]').click(); await p.waitForTimeout(150);
  await p.fill('input[aria-label="مبلغ السند"]', '700'); await p.selectOption('select[aria-label="إلى حساب"]', '1101');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => window.lastSay || ''), 'اختر حسابين مختلفين للتحويل');
  await p.selectOption('select[aria-label="إلى حساب"]', '1201'); await p.fill('input[aria-label="بيان السند"]', 'إيداع نقدية الأسبوع');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(500);
  const r = await p.evaluate(() => window.cur.cashVouchers.map(v => [v.no, v.kind, v.amount, v.fund, v.toFund]));
  assert.deepEqual(r, [['TV-000001', 'tv', 700, '1101', '1201']]);
  const doc = await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || '');
  assert.match(doc, /من حساب/); assert.match(doc, /الخزينة \(نقدًا\)/); assert.match(doc, /البنك التجميعي/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.3 الإشعار المدين: زيادة على فاتورة آجلة ترفع المتبقي وتُرقَّم في السلسلة وتُحصَّل', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/SalesHub/admin');
  await p.evaluate(() => window.setOrg(g => ({ ...g, partners: [...(g.partners || []), { id: 'cx', key: 'cust:cx', name: 'مؤسسة التموين', type: 'customer' }] }))); await p.waitForTimeout(150);
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: [] }))); await p.waitForTimeout(150);
  // فاتورة آجلة عبر المحرك نفسه (الختم والبصمة)
  await p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: [{ id: 'sx', no: 'فاتورة-2026-00001', seq: 1, icv: 1, pih: '0', hash: 'h', kind: 'invoice', type: 'simplified', terms: 'credit', customerKey: 'cust:cx', buyer: { name: 'مؤسسة التموين' }, date: '2026-11-02', lines: [{ desc: 'وجبات', qty: 2, price: 100, vatRate: 15, net: 200, vat: 30 }], net: 200, vat: 30, total: 230, dueDate: '2026-12-02', receipts: [] }] }))); await p.waitForTimeout(250);
  await p.locator('[data-dn]').first().click(); await p.waitForTimeout(200);
  await p.locator('[data-dn-save]').click(); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.lastSay || ''), 'اكتب سبب الإشعار المدين');
  await p.fill('input[aria-label="سبب الإشعار المدين"]', 'رسوم توصيل'); await p.fill('input[aria-label="مبلغ الزيادة قبل الضريبة"]', '40');
  assert.match(await p.locator('[data-dn-total]').innerText(), /46/);
  await p.locator('[data-dn-save]').click(); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.lastSay || ''), /إشعار مدين/);
  assert.match(await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || ''), /إشعار مدين ضريبي مبسّط[\s\S]*عن الفاتورة/);
  await p.click('.mz-docv button:has-text("إغلاق")'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => window.cur.salesInvoices.filter(x => x.kind === 'debit').map(x => [x.no, x.refId, x.total, x.terms, x.icv]));
  assert.deepEqual(r, [['إشعار مدين-2026-00001', 'sx', 46, 'credit', 2]]);
  await p.click('button:has-text("إشعارات مدينة")'); await p.waitForTimeout(200);
  assert.equal(await p.locator('tbody tr', { hasText: 'إشعار مدين عن فاتورة-2026-00001' }).count(), 1);
  assert.equal(await p.locator('tbody tr', { hasText: 'إشعار مدين' }).locator('button:has-text("تحصيل")').count(), 1, 'يُحصَّل كمستند آجل');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.3 FEFO في صرف الفرع: يقترح الدفعة الأقرب انتهاءً، ينبّه للمنتهية، ويحفظ الدفعات المصروفة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/BranchWarehouse/bm');
  await p.evaluate(() => window.setOps(o => ({ ...o, whMoves: [...o.whMoves.filter(m => m.itemId !== 'i2'),
    { id: 'L1', whId: 'wh-b1', branchId: 'b1', itemId: 'i2', kind: 'in', qty: 4, unitCost: 4, batch: 'A1', expiry: '2020-01-01', date: '2019-12-01', at: '2019-12-01T00:00:00' },
    { id: 'L2', whId: 'wh-b1', branchId: 'b1', itemId: 'i2', kind: 'in', qty: 10, unitCost: 4, batch: 'B2', expiry: '2099-06-01', date: '2026-01-02', at: '2026-01-02T00:00:00' }] }))); await p.waitForTimeout(250);
  await p.getByRole('button', { name: 'صرف وهدر' }).first().click(); await p.waitForTimeout(150);
  await p.click('button:has-text("صرف للمطبخ")'); await p.waitForTimeout(100);
  await p.locator('.card select').first().selectOption('i2'); await p.locator('.card input[placeholder="الكمية"]').first().fill('6'); await p.waitForTimeout(150);
  const hint = await p.locator('[data-fefo]').first().innerText();
  assert.match(hint, /دفعة A1/); assert.match(hint, /دفعة B2/); assert.match(hint, /منتهية الصلاحية/);
  assert.ok(hint.indexOf('A1') < hint.indexOf('B2'), 'الأقرب انتهاءً أولًا');
  await p.click('button:has-text("تسجيل صرف للمطبخ")'); await p.waitForTimeout(400);
  const m = await p.evaluate(() => window.cur.whMoves.find(x => x.kind === 'out' && x.itemId === 'i2'));
  assert.deepEqual(m.lots, [{ batch: 'A1', expiry: '2020-01-01', qty: 4 }, { batch: 'B2', expiry: '2099-06-01', qty: 2 }]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.4 الإشعار المدين للمشتريات وخصم السداد المكتسب: يخفضان المتبقي وضريبة المدخلات، وإشعار المورد بالزيادة يُسجَّل', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => window.setOps(o => ({ ...o, closings: [], invoices: [{ id: 'q1', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', amount: 1150, vatAmt: 150, taxable: true, accCode: '5198', date: '2026-11-01', dueDate: '2099-12-01', invoiceNo: 'SUP-500', branchId: 'b1', paidAmount: 0 }] })));
  await p.waitForTimeout(300);
  await p.locator('[data-pdn]').first().click(); await p.waitForTimeout(150);
  await p.locator('.modal button', { hasText: 'فرق سعر' }).click(); await p.fill('input[aria-label="مبلغ إشعار المورد"]', '100');
  assert.match(await p.locator('[data-pdn-total]').innerText(), /115/);
  await p.locator('[data-pdn-save]').click(); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.lastSay || ''), /صدر الإشعار المدين PDN-/);
  assert.match(await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || ''), /إشعار دائن ضريبي/);
  await p.click('.mz-docv button:has-text("إغلاق")'); await p.waitForTimeout(200);
  let r = await p.evaluate(() => window.cur.invoices.filter(i => i.debitNote).map(i => [i.amount, i.vatAmt, i.appliesTo, i.accCode]));
  assert.deepEqual(r, [[-115, -15, 'q1', '5198']]);
  // إشعار مدين من المورد (زيادة)
  await p.locator('tr', { hasText: 'SUP-500' }).locator('[data-pdn]').click(); await p.waitForTimeout(150);
  await p.locator('[data-pdndir="inc"]').click(); await p.fill('input[aria-label="سبب إشعار المورد"]', 'رسوم نقل'); await p.fill('input[aria-label="مبلغ إشعار المورد"]', '20');
  await p.locator('[data-pdn-save]').click(); await p.waitForTimeout(400);
  r = await p.evaluate(() => window.cur.invoices.filter(i => i.supDebit).map(i => [i.amount, i.vatAmt, i.appliesTo]));
  assert.deepEqual(r, [[23, 3, 'q1']]);
  // سداد الباقي (1035) بخصم مكتسب 57.5 شامل الضريبة
  await p.locator('tr', { hasText: 'SUP-500' }).locator('button', { hasText: /^سداد$/ }).click(); await p.waitForTimeout(150);
  await p.fill('input[aria-label="خصم مكتسب"]', '57.5'); await p.waitForTimeout(100);
  assert.match(await p.locator('[data-discnote]').innerText(), /7\.50/);
  await p.locator('.modal button', { hasText: 'تسجيل السداد' }).click(); await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ d: window.cur.invoices.filter(i => i.disc).map(i => [i.amount, i.vatAmt, i.accCode]), paid: window.cur.invoices.find(i => i.id === 'q1').paidAmount }));
  assert.deepEqual(r, { d: [[-57.5, -7.5, '4202']], paid: 977.5 });
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.4 الخصم الممنوح عند التحصيل: إشعار دائن ضريبي تلقائي مرتبط بالفاتورة ويقفل المتبقي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/SalesHub/admin');
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: [{ id: 'sx', no: 'فاتورة-2026-00001', seq: 1, icv: 1, pih: '0', hash: 'h', kind: 'invoice', type: 'simplified', terms: 'credit', customerKey: 'cust:cx', buyer: { name: 'مؤسسة التموين' }, date: '2026-11-02', lines: [{ desc: 'وجبات', qty: 10, price: 100, vatRate: 15, net: 1000, vat: 150 }], net: 1000, vat: 150, total: 1150, dueDate: '2099-12-02', receipts: [] }] }))); await p.waitForTimeout(250);
  await p.locator('tr', { hasText: 'فاتورة-2026-00001' }).locator('button', { hasText: 'تحصيل' }).click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="خصم ممنوح"]', '57.5'); await p.waitForTimeout(100);
  assert.match(await p.locator('[data-rcdisc]').innerText(), /7\.50/);
  await p.locator('.modal button', { hasText: 'تسجيل التحصيل' }).click(); await p.waitForTimeout(500);
  assert.match(await p.evaluate(() => window.lastSay || ''), /خصم ممنوح 57\.50 بإشعار دائن إشعار-2026-00001/);
  const r = await p.evaluate(() => ({ rc: window.cur.salesInvoices[0].receipts.map(x => x.amount), cn: window.cur.salesInvoices.filter(x => x.kind === 'credit').map(x => [x.disc, x.net, x.vat, x.total, x.refId]) }));
  assert.deepEqual(r, { rc: [1092.5], cn: [[true, 50, 7.5, 57.5, 'sx']] });
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.4 المشاريع: إضافة مشروع، قيد يدوي بمشروع ومركز تكلفة، وظهور ربحيته', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Accounting/admin/prj');
  await p.fill('input[aria-label="اسم المشروع"]', 'تموين حفل'); await p.locator('[data-prjadd]').click(); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.curOrg.projects.map(x => [x.code, x.name, x.active])), [['PRJ-001', 'تموين حفل', true]]);
  const pid = await p.evaluate(() => window.curOrg.projects[0].id);
  await p.click('button:has-text("قيد يدوي / افتتاحي")'); await p.waitForTimeout(300);
  await p.fill('.modal input[placeholder^="مثال: استلام"]', 'مصروف حفل');
  await p.selectOption('select[aria-label="فرع القيد"]', 'b1'); await p.selectOption('select[aria-label="مشروع القيد"]', pid);
  await p.locator('.modal select.jm-acc').nth(0).selectOption('5901'); await p.locator('.modal input.jm-d').nth(0).fill('400');
  await p.locator('.modal select.jm-acc').nth(1).selectOption('1201'); await p.locator('.modal input.jm-c').nth(1).fill('400');
  await p.click('.modal button:has-text("تسجيل القيد")'); await p.waitForTimeout(500);
  assert.deepEqual(await p.evaluate(() => window.cur.journalManual.filter(j => j.title === 'مصروف حفل').map(j => [j.branchId, j.projectId === window.curOrg.projects[0].id])), [['b1', true]]);
  const row = await p.locator('[data-prjtable] tr', { hasText: 'تموين حفل' }).innerText();
  assert.match(row, /400/); assert.match(row, /-400|−400/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.5 استعراض المستند: النقر على رقم القيد أو الفاتورة أو السند يفتح نافذته', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/SalesHub/admin');
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: [{ id: 'sx', no: 'فاتورة-2026-00007', seq: 7, icv: 7, pih: '0', hash: 'h', kind: 'invoice', type: 'simplified', terms: 'credit', customerKey: 'cust:cx', buyer: { name: 'مؤسسة التموين' }, date: '2026-11-02', lines: [{ desc: 'وجبات غداء', qty: 2, price: 100, vatRate: 15, net: 200, vat: 30 }], net: 200, vat: 30, total: 230, dueDate: '2099-12-02', receipts: [{ id: 'r9', date: '2026-11-03', amount: 30, fund: '1201' }] }] }))); await p.waitForTimeout(250);
  await p.locator('[data-doclink]', { hasText: 'فاتورة-2026-00007' }).click(); await p.waitForTimeout(250);
  const t = await p.locator('[data-peek]').innerText();
  assert.match(t, /وجبات غداء/); assert.match(t, /مؤسسة التموين/); assert.match(t, /المتبقي/);
  assert.equal(await p.locator('[data-peek-je]').count(), 2, 'قيد الفاتورة وقيد التحصيل');
  assert.match(await p.locator('[data-peek-je]').first().innerText(), /1380/);
  await p.locator('[data-peek-print]').click(); await p.waitForTimeout(300);
  assert.match(await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || ''), /فاتورة-2026-00007/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.5 استعراض القيد من دفتر اليومية', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Accounting/admin/jr');
  const first = p.locator('[data-doclink]').first(); const no = (await first.innerText()).trim();
  await first.click(); await p.waitForTimeout(250);
  assert.match(await p.locator('.modal-h, .modal').first().innerText(), new RegExp('قيد ' + no.replace(/[-/]/g, '.')));
  assert.ok(await p.locator('[data-peek-je] tbody tr').count() >= 3, 'سطور القيد والإجمالي');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.5 البحث بالصوت: زر ميكروفون في حقول البحث يملأ الحقل بالكلام ويطبّق التصفية', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  await ctx.addInitScript(() => { window.webkitSpeechRecognition = class { constructor() { window.__rec = this; } start() { setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: 'فاتورة-٢٠٢٦-٠٠٠٠٩.' }]] }); this.onend && this.onend(); }, 60); } stop() { this.onend && this.onend(); } }; window.SpeechRecognition = window.webkitSpeechRecognition; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/SalesHub/admin'); await p.waitForTimeout(400); await settle(p);
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(300);
  await p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: ['00008', '00009'].map((n, k) => ({ id: 'v' + k, no: 'فاتورة-2026-' + n, seq: k + 1, icv: k + 1, pih: '0', hash: 'h', kind: 'invoice', type: 'simplified', terms: 'cash', fund: '1201', buyer: { name: 'نقدي' }, date: '2026-11-02', lines: [], net: 100, vat: 15, total: 115, receipts: [] })) }))); await p.waitForTimeout(1700);
  assert.ok(await p.locator('[data-voicebtn]').count() >= 1, 'زر الميكروفون ظاهر');
  await p.locator('[data-voicebtn]').first().click(); await p.waitForTimeout(400);
  assert.equal(await p.locator('input[placeholder^="ابحث بالرقم"]').inputValue(), 'فاتورة-2026-00009', 'أرقام عربية حُوّلت وأُزيلت النقطة');
  assert.equal(await p.locator('tbody tr', { hasText: 'فاتورة-2026-00008' }).count(), 0, 'التصفية طُبّقت');
  assert.equal(await p.locator('tbody tr', { hasText: 'فاتورة-2026-00009' }).count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.6 البحث بالصوت: إعادة محاولة تلقائية إن انتهت الجلسة فورًا، ونص مسموع حيّ، وأرقام بالكلمات', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  await ctx.addInitScript(() => { window.__n = 0; class R { constructor() { window.__n++; this.k = window.__n; } start() { const me = this;
      if (me.k === 1) setTimeout(() => me.onend && me.onend(), 50);   // الجلسة الأولى تنتهي فورًا بلا كلام (سلوك iOS)
      else { setTimeout(() => me.onresult && me.onresult({ results: [Object.assign([{ transcript: 'ابحث عن فاتورة ألفين وستة وعشرين' }], { isFinal: false })] }), 80); }
    } stop() { this.onend && this.onend(); } }
    window.webkitSpeechRecognition = R; window.SpeechRecognition = R; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/SalesHub/admin'); await p.waitForTimeout(400); await settle(p);
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(1700);
  await p.locator('[data-voicebtn]').first().click(); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => window.__n), 2, 'أُعيدت الجلسة مرة');
  assert.match(await p.locator('[data-voicetoast]').innerText(), /«فاتورة 2026»/);
  assert.equal(await p.locator('input[placeholder^="ابحث بالرقم"]').inputValue(), 'فاتورة 2026');
  await p.waitForTimeout(1600);
  assert.equal(await p.locator('[data-voicebtn].on').count(), 0, 'توقف تلقائيًا بعد الصمت');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.7 البحث بالصوت على آيفون: جلسة مفردة غير مستمرة، بلا إعادة خارج اللمسة، والنتيجة تُملأ', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(() => { window.__s = []; class R { start() { const me = this; window.__s.push(me.continuous);
      if (window.__s.length === 1) setTimeout(() => me.onend && me.onend(), 50);
      else setTimeout(() => { me.onresult && me.onresult({ results: [Object.assign([{ transcript: 'شركة الخضار' }], { isFinal: true })] }); me.onend && me.onend(); }, 80); }
    stop() { this.onend && this.onend(); } abort() {} }
    window.webkitSpeechRecognition = R; window.SpeechRecognition = R; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/SalesHub/admin'); await p.waitForTimeout(400); await settle(p);
  await p.locator('button:has-text("فواتير المبيعات")').first().click(); await p.waitForTimeout(1700);
  await p.locator('[data-voicebtn]').first().click(); await p.waitForTimeout(400);
  assert.deepEqual(await p.evaluate(() => window.__s), [false], 'غير مستمرة، ولا إعادة تلقائية');
  assert.match(await p.locator('[data-voicetoast]').innerText(), /ميكروفون لوحة المفاتيح/);
  await p.waitForTimeout(300); await p.locator('[data-voicebtn]').first().click(); await p.waitForTimeout(400);
  assert.equal(await p.locator('input[placeholder^="ابحث بالرقم"]').inputValue(), 'شركة الخضار');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.8 القيد: ترتيب السطور بالسحب والأسهم، قيد دوري يُنشأ مستحقه بضغطة، ونسخة مطابقة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Accounting/admin/jr');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [], jeRecurring: [] }))); await p.waitForTimeout(200);
  await p.click('button:has-text("قيد يدوي / افتتاحي")'); await p.waitForTimeout(300);
  await p.fill('.modal input[placeholder^="مثال: استلام"]', 'إيجار شهري');
  await p.locator('.modal select.jm-acc').nth(0).selectOption('1201'); await p.locator('.modal input.jm-c').nth(0).fill('3000');
  await p.locator('.modal select.jm-acc').nth(1).selectOption('5901'); await p.locator('.modal input.jm-d').nth(1).fill('3000');
  // السحب: السطر الثاني (المصروف) إلى الأول
  const g = p.locator('[data-rowgrp="jm"][data-rowi="1"] .rg-h'), t = p.locator('[data-rowgrp="jm"][data-rowi="0"]');
  const gb = await g.boundingBox(), tb2 = await t.boundingBox();
  await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down(); await p.mouse.move(tb2.x + 300, tb2.y + 5, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  assert.equal(await p.locator('.modal select.jm-acc').nth(0).inputValue(), '5901', 'المصروف صار أولًا');
  await p.locator('[data-rowgrp="jm"][data-rowi="0"] button[aria-label$="لأسفل"]').click(); await p.waitForTimeout(100);
  assert.equal(await p.locator('.modal select.jm-acc').nth(0).inputValue(), '1201', 'والسهم يعيده');
  await p.locator('[data-rowgrp="jm"][data-rowi="0"] button[aria-label$="لأسفل"]').click(); await p.waitForTimeout(100);
  await p.fill('.modal input[type="date"]', '2026-08-01');
  await p.check('input[aria-label="قيد دوري"]'); await p.selectOption('select[aria-label="دورية القيد"]', 'm');
  await p.click('.modal button:has-text("تسجيل القيد")'); await p.waitForTimeout(500);
  let r = await p.evaluate(() => ({ jm: window.cur.journalManual.map(j => [j.date, j.lines[0].code]), tp: window.cur.jeRecurring.map(t => [t.every, t.next]) }));
  assert.deepEqual(r, { jm: [['2026-08-01', '5901']], tp: [['m', '2026-09-01']] });
  await p.locator('[data-recdue]').click(); await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ n: window.cur.journalManual.filter(j => j.recurId).length, next: window.cur.jeRecurring[0].next }));
  assert.ok(r.n >= 4, 'أُنشئت الأشهر المستحقة حتى اليوم'); assert.ok(r.next > new Date().toISOString().slice(0, 7), 'تقدّم الموعد القادم');
  assert.equal(await p.locator('[data-recdue]').count(), 0);
  // نسخة مطابقة من القيد
  await p.locator('tbody tr', { hasText: 'إيجار شهري' }).first().locator('td').nth(2).click(); await p.waitForTimeout(200);
  await p.locator('[data-copyje]').first().click(); await p.waitForTimeout(250);
  assert.match(await p.locator('.modal input[placeholder^="مثال: استلام"]').inputValue(), /إيجار شهري/);
  assert.equal(await p.locator('.modal input.jm-d').first().inputValue(), '3000');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v47.8 الفواتير: نسخة مطابقة لفاتورة مورد وتكرار آخر فاتورة له، ونسخ فاتورة مبيعات، وترتيب البنود', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => window.setOps(o => ({ ...o, invoices: [{ id: 'q1', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', amount: 460, vatAmt: 60, taxable: true, date: '2026-11-01', dueDate: '2026-11-31', invoiceNo: 'SUP-77', branchId: 'b1', paidAmount: 0,
    lines: [{ itemId: 'i1', desc: 'صنف', qty: 5, unitCost: 40, net: 200 }, { itemId: 'i2', desc: 'صنف 2', qty: 4, unitCost: 50, net: 200, note: 'مبرد' }] }] }))); await p.waitForTimeout(300);
  await p.locator('tr', { hasText: 'SUP-77' }).locator('[data-copyinv]').click(); await p.waitForTimeout(250);
  assert.equal(await p.locator('[data-invline]').count(), 2); assert.equal(await p.locator('input[aria-label="كمية البند 1"]').inputValue(), '5');
  assert.equal(await p.locator('input[aria-label="سعر البند 2"]').inputValue(), '50'); assert.equal(await p.locator('[data-copyhint]').count(), 1);
  await p.locator('[data-rowgrp="inv"][data-rowi="1"] button[aria-label$="لأعلى"]').click(); await p.waitForTimeout(100);
  assert.equal(await p.locator('input[aria-label="سعر البند 1"]').inputValue(), '50', 'رُتّبت البنود');
  await p.locator('.modal button', { hasText: 'إلغاء' }).click(); await p.waitForTimeout(150);
  await p.locator('button', { hasText: 'فاتورة توريد جديدة' }).click(); await p.waitForTimeout(200);
  await p.locator('.modal select').first().selectOption('s1'); await p.waitForTimeout(100);
  await p.locator('[data-replast]').click(); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-invline]').count(), 2, 'كُرّرت آخر فاتورة للمورد');
  await ctx.close();
  const S = await open({ viewport: { width: 1300, height: 1100 } }, 'live/SalesHub/admin');
  await S.p.locator('button:has-text("فواتير المبيعات")').first().click(); await S.p.waitForTimeout(300);
  await S.p.evaluate(() => window.setOps(o => ({ ...o, salesInvoices: [{ id: 'sx', no: 'فاتورة-2026-00003', seq: 3, icv: 3, pih: '0', hash: 'h', kind: 'invoice', type: 'simplified', terms: 'cash', fund: '1201', buyer: { name: 'زبون' }, date: '2026-11-02', lines: [{ desc: 'وجبة أ', qty: 2, price: 50, vatRate: 15, net: 100, vat: 15 }, { desc: 'وجبة ب', qty: 1, price: 30, vatRate: 15, net: 30, vat: 4.5 }], net: 130, vat: 19.5, total: 149.5, receipts: [] }] }))); await S.p.waitForTimeout(250);
  await S.p.locator('[data-copysi]').click(); await S.p.waitForTimeout(250);
  assert.equal(await S.p.locator('[data-rowgrp="si"]').count(), 2); assert.equal(await S.p.locator('[data-rowgrp="si"][data-rowi="0"] input').first().inputValue(), 'وجبة أ');
  assert.deepEqual([...errs, ...S.errs], []); await S.ctx.close();
});

// ═══ v48.0 SMART POS GROWTH — المرحلتان C وD ═══
const spgOrders = (td) => { const d = (k) => { const x = new Date(td + 'T12:00:00'); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
  const o = (id, ph, nm, k, tot, br) => ({ id, no: id, branchId: br, date: d(k), at: d(k) + 'T12:00:00', total: tot, vat: 0, net: tot, status: 'paid', lines: [{ productId: 'p1', name: 'برجر', qty: 1, price: tot }], loyalty: { phone: ph, name: nm } });
  return [o('g1', '511111111', 'أحمد الحربي', 3, 2000, 'b1'), o('g2', '522222222', 'احمد الحربي', 5, 50, 'b1'), o('g3', '533333333', 'منى', 2, 80, 'b2'), o('g4', '511111111', 'أحمد الحربي', 10, 120, 'b1')]; };

test('v48.0 التسويق والنمو: لوحة من بيانات فعلية، ملف عميل، موافقة بسجل، إعدادات للمعتمد فقط، ودمج يدوي معتمد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); window.setOps(o => ({ ...o, mktConsents: [], mktMerges: [], posOrders: window.__spg(td.toISOString().slice(0, 10)) })); });
  await p.waitForTimeout(400);
  const k = await p.locator('[data-mktkpis]').innerText(); assert.match(k, /2,250\.00|2250/); assert.match(k, /العملاء النشطون/);
  assert.match(await p.locator('[data-mktkpis]').innerText(), /تُفعَّل في مرحلة لاحقة/, 'لا أرقام مختلقة للمراحل القادمة');
  await p.click('[data-mktv="crm"]'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-crmtable] tbody tr').count(), 3);
  await p.locator('[data-crmrow="511111111"]').click(); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-crmprofile]').innerText(), /كبار العملاء/);
  await p.selectOption('select[aria-label="قناة الموافقة"]', 'whatsapp'); await p.click('[data-consent-save]'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.cur.mktConsents.map(c => [c.phone, c.status, c.ch])), [['511111111', 'in', 'whatsapp']]);
  assert.equal(await p.locator('[data-consent-hist] tr').count(), 1);
  await p.locator('.modal button[aria-label="إغلاق"], .modal .x, .modal-h button').first().click().catch(() => {}); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('[data-mktv="gov"]'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-dupe]').count(), 1, 'احتمال تكرار بالاسم');
  await p.click('[data-merge]'); await p.waitForTimeout(150); await p.click('[data-merge-save]'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => (window.cur.mktMerges || []).length), 0, 'لا دمج بلا سبب');
  await p.fill('input[aria-label="سبب الدمج"]', 'تحقق هاتفي'); await p.click('[data-merge-save]'); await p.waitForTimeout(400);
  assert.deepEqual(await p.evaluate(() => window.cur.mktMerges.map(m => [m.from, m.to])), [['522222222', '511111111']]);
  await p.click('[data-mktv="crm"]'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-crmtable] tbody tr').count(), 2, 'بعد الدمج');
  await p.click('[data-mktv="cfg"]'); await p.waitForTimeout(150);
  await p.fill('input[aria-label="VIP: حد صافي المشتريات (ر.س)"]', '5000'); await p.click('[data-mktcfg-save]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.mkt.seg.vipSpend), 5000);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v48.0 التسويق والنمو: مدير الفرع يرى عملاء فرعه فقط، ولا يعدّل الإعدادات ولا يدمج', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/MktGrowth/bm');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); window.setOps(o => ({ ...o, mktConsents: [], mktMerges: [], posOrders: window.__spg(td.toISOString().slice(0, 10)) })); });
  await p.waitForTimeout(400);
  await p.click('[data-mktv="crm"]'); await p.waitForTimeout(200);
  const rows = await p.locator('[data-crmtable] tbody tr').allInnerTexts();
  assert.equal(rows.length, 2); assert.ok(!rows.join(' ').includes('533333333'), 'عميل الفرع الآخر محجوب');
  await p.click('[data-mktv="gov"]'); await p.waitForTimeout(150); assert.equal(await p.locator('[data-merge]').count(), 0);
  await p.click('[data-mktv="cfg"]'); await p.waitForTimeout(150); assert.equal(await p.locator('[data-mktcfg-save]').count(), 0);
  assert.deepEqual(errs, []); await ctx.close();
});

// ═══ v48.1 SMART POS GROWTH — المرحلة E ═══
test('v48.1 نقطة البيع: كوبون محدود لكل عميل يُحجز ذرّيًا مع البيع، ويُرفض للعميل نفسه مرة ثانية برسالة واضحة، والإلغاء يحرّره', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false }, loyaltyCfg: { enabled: true, earnPer: 10, ptValue: 0.5, minRedeem: 20, maxRedeemPct: 50 },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 50, cat: 'رئيسي' }], posPromos: [{ id: 'cp', name: 'ترحيب', type: 'pct', value: 20, scope: 'all', code: 'HELLO', perCust: 1, maxUses: 5, active: true }] }));
    window.setOps(o => ({ ...o, posTabs: [], posOrders: [], closings: o.closings.filter(c => c.branchId !== 'b1') }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  const sell = async () => {
    await p.locator('.pos-tile:has-text("كبسة")').click();
    if (!(await p.locator('input[aria-label="جوال العميل"]').count())) await p.click('button:has-text("+ عميل ولاء")');
    await p.fill('input[aria-label="جوال العميل"]', '0551112222');
    if (!(await p.locator('input[aria-label="رمز الكوبون"]').count())) await p.click('button:has-text("+ كوبون")');
    await p.fill('input[aria-label="رمز الكوبون"]', 'hello'); await p.waitForTimeout(700);
  };
  await sell();
  assert.match(await p.locator('.pos-cart').innerText(), /الكوبون فعّال/);
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(700);
  let r = await p.evaluate(() => (window.cur.posOrders.length ? window.cur.posOrders : []).map(o => [o.coupon, o.couponLtd, o.total]));
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]').map(o => [o.coupon, o.couponLtd, o.total]));
  assert.deepEqual([...r, ...q].slice(0, 1), [['hello', true, 40]], 'خصم 20% من 50');
  await sell();
  assert.match(await p.locator('.pos-cart').innerText(), /استخدمه هذا العميل من قبل/);
  assert.doesNotMatch(await p.locator('.pos-cart').innerText(), /الكوبون فعّال/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v48.1 العروض: هامش سالب يُمنع، وخصم فوق الحد من غير المعتمد ينتظر الاعتماد ثم يعتمده المالك', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, mkt: { approveDiscPct: 20 }, items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }],
    products: [{ id: 'p1', name: 'برجر', sellPrice: 23, cat: 'رئيسي', parts: [{ itemId: 'm', qty: 0.25 }] }],
    posPromos: [{ id: 'z', name: 'كبير', type: 'pct', value: 30, scope: 'all', code: 'BIG', active: true, pending: true, pendPct: 30, pendBy: 'خالد' }] })));
  await p.waitForTimeout(300);
  await p.click('[data-mktv="cpn"]'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-cpntable]').innerText(), /بانتظار الاعتماد/);
  await p.locator('[data-cpn="BIG"] button:has-text("اعتماد")').click(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.curOrg.posPromos[0].pending), false);
  await ctx.close();
  // محرر العروض: هامش سالب
  const P = await open({ viewport: { width: 1300, height: 1100 } }, 'live/PosApp/admin');
  await P.p.evaluate(() => window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false }, mkt: { approveDiscPct: 20 }, items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }],
    products: [{ id: 'p1', name: 'برجر', sellPrice: 23, cat: 'رئيسي', parts: [{ itemId: 'm', qty: 0.25 }] }], posPromos: [] }))); await P.p.waitForTimeout(300);
  const ob2 = P.p.locator('button:has-text("فتح الوردية")'); if (await ob2.count()) { await ob2.click(); await P.p.waitForTimeout(400); }
  await P.p.selectOption('select[aria-label="المزيد"]', 'promos'); await P.p.waitForTimeout(300);
  await P.p.locator('button:has-text("عرض جديد")').first().click(); await P.p.waitForTimeout(200);
  await P.p.locator('.modal input').first().fill('خصم كبير'); await P.p.locator('.modal input.inp.n').first().fill('60'); await P.p.waitForTimeout(200);
  assert.match(await P.p.locator('[data-promomargin]').innerText(), /هامش سالب: برجر/);
  await P.p.locator('.modal button:has-text("حفظ العرض")').click(); await P.p.waitForTimeout(300);
  assert.match(await P.p.evaluate(() => window.lastSay || ''), /سالبًا/); assert.equal(await P.p.evaluate(() => (window.curOrg.posPromos || []).length), 0);
  assert.deepEqual([...errs, ...P.errs], []); await P.ctx.close();
});

test('v48.1 الولاء المتقدم: إعداد المستويات والجوائز، ترحيل مكافأة عيد الميلاد مرة واحدة، واستبدال جائزة بكوبون شخصي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); const iso = td.toISOString().slice(0, 10); const mm = iso.slice(5, 7);
    window.setOrg(g => ({ ...g, loyaltyCfg: { enabled: true, earnPer: 10, ptValue: 0.5 }, products: [{ id: 'p1', name: 'قهوة', sellPrice: 12 }], posPromos: [] }));
    window.setOps(o => ({ ...o, mktProfiles: [{ id: 'x', phone: '511111111', bday: mm + '-01', at: iso }], mktReferrals: [], mktConsents: [], mktMerges: [],
      posOrders: [{ id: 'g1', no: 'g1', branchId: 'b1', date: iso, at: iso + 'T10:00:00', total: 1500, status: 'paid', lines: [], loyalty: { phone: '511111111', name: 'سعد' } }] }));
    localStorage.setItem('__loyseed', '1'); });
  await p.evaluate(async () => { const { cloud, KEYS } = window.__storage || {}; }).catch(() => {});
  await p.waitForTimeout(300);
  await p.click('[data-mktv="loy"]'); await p.waitForTimeout(250);
  await p.fill('input[aria-label="نقاط عيد الميلاد"]', '40');
  await p.fill('input[aria-label="اسم الجائزة"]', 'قهوة مجانية'); await p.selectOption('select[aria-label="منتج الجائزة"]', 'p1'); await p.fill('input[aria-label="نقاط الجائزة"]', '30');
  await p.click('[data-addreward]'); await p.click('[data-loycfg-save]'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => [window.curOrg.mkt.loy.bdayPts, window.curOrg.mkt.loy.rewards.map(r => [r.name, r.pts])]), [40, [['قهوة مجانية', 30]]]);
  assert.match(await p.locator('[data-loydue]').innerText(), /أعياد ميلاد: 1/);
  await p.click('[data-loyrun]'); await p.waitForTimeout(500);
  assert.match(await p.locator('[data-loydue]').innerText(), /أعياد ميلاد: 0/, 'لا تتكرر');
  await p.click('[data-mktv="crm"]'); await p.waitForTimeout(200);
  await p.locator('[data-crmrow="511111111"]').click(); await p.waitForTimeout(200);
  await p.selectOption('select[aria-label="جائزة الولاء"]', { label: 'قهوة مجانية — 30 نقطة' }); await p.click('[data-redeem]'); await p.waitForTimeout(500);
  const c = await p.evaluate(() => window.curOrg.posPromos.map(x => [x.custPhone, x.maxUses, x.items, x.value]));
  assert.deepEqual(c, [['511111111', 1, ['p1'], 100]]); assert.match(await p.evaluate(() => window.lastSay || ''), /صدرت الجائزة بكوبون RW/);
  // v52.6 فحص سلامة النقاط: عيد الميلاد والجائزة لهما مصدر معروف → سليم
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); if (await p.locator('.mask').count()) await p.locator('.mask button[aria-label="إغلاق"]').first().click().catch(() => {});
  await p.click('[data-mktv="loy"]'); await p.waitForSelector('[data-loyaudit]');
  assert.match(await p.locator('[data-loyaudit]').innerText(), /سليم ✓/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v50.2 المرحلة 06: حزمة الترجمة الكاملة تُحمَّل في الوضع الإنجليزي — «مهامي» ومجموعات المحاسبة الخمس بالإنجليزية', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } }); await ctx.addInitScript(() => { try { localStorage.setItem('rms8:lang', 'en'); } catch { } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/MyWork/acc'); await p.waitForTimeout(500); await settle(p);
  await p.waitForFunction(() => /My work/.test(document.querySelector('[data-mywork]')?.innerText || ''), null, { timeout: 15000 });
  const t = await p.locator('[data-mywork]').innerText();
  assert.match(t, /My work/); assert.match(t, /items waiting for you/); assert.match(t, /Finance & Suppliers/);
  await p.close(); const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(base + 'acct/jr'); await p2.waitForTimeout(1200); await settle(p2);
  await p2.waitForFunction(() => /Daily operations/.test(document.body.innerText), null, { timeout: 15000 });
  const b = await p2.evaluate(() => document.body.innerText);
  for (const g of ['Daily operations', 'Books', 'Reports', 'Closing & Tax', 'Setup & Tools']) assert.match(b, new RegExp(g.replace('&', '&')), g);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v50.2 الواجهة العربية لا تحمّل حزمة الترجمة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'acct/jr');
  const b = await p.evaluate(() => document.body.innerText);
  assert.match(b, /العمليات اليومية/); assert.match(b, /الإقفال والضريبة/);
  assert.equal(await p.evaluate(() => performance.getEntriesByType('resource').some(r => /i18n-en|index-.*\.js/.test(r.name) && /i18n/.test(r.name))), false);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v50.3→v56.0 (إعادة التسمية) الهوية الرسمية: رمز البوصلة لمُكتسَب (قرار المالك 2026-11-25) والشعار الثنائي بنص حيّ (عربي/إنجليزي)', async () => {
  for (const lang of ['ar', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript((l) => { try { localStorage.setItem('rms8:lang', l); } catch { } }, lang);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'comp/BrandLockup'); await p.waitForTimeout(800); await settle(p);
    const r = await p.evaluate(() => { const sv = document.querySelector('svg[data-mq-symbol]'); const lk = document.querySelector('[data-mq-lockup]');
      return { v: sv && sv.dataset.mqSymbol, d: sv ? [...sv.querySelectorAll('polygon')].map(x => x.getAttribute('points')) : [], paths: sv ? sv.querySelectorAll('path').length : -1,
        c: sv ? [...sv.querySelectorAll('polygon')].map(x => getComputedStyle(x).fill) : [], t: lk ? lk.innerText.replace(/\s+/g, ' ') : '' }; });
    assert.equal(r.v, 'light');
    // v56.0 (إعادة التسمية): الهندسة الموحّدة brand-geom.js — أربعة رؤوس قطرية خفيفة، ثم الجنوبي والشرقي والغربي (كحلي)، ثم الشمالي (ذهبي)
    assert.deepEqual(r.d.slice(4), ['50,97 40.5,50 59.5,50', '97,50 50,40.5 50,59.5', '3,50 50,59.5 50,40.5', '50,3 59.5,50 40.5,50'], 'مضلعات الرمز مطابقة للحزمة');
    assert.equal(r.d.length, 8, 'أربعة رؤوس قطرية + أربعة رئيسية');
    assert.equal(r.paths, 0, 'بلا مسارات خطية');
    assert.deepEqual(r.c, [...Array(7).fill('rgb(16, 41, 74)'), 'rgb(217, 168, 62)'], 'ألوان الحزمة #10294A و#D9A83E (الشمال ذهبي)');
    assert.match(r.t, /MUKTASAB/); assert.match(r.t, /مكتسب/, 'الاسم العربي يبقى عربيًا في الوضعين');
    assert.deepEqual(errs, []); await ctx.close();
  }
});

test('v51.3 الاشتراك والمنشأة: بطاقة عرض فقط في إعدادات النظام — الطيف «المؤسسات» نشط بكل الخصائص', async () => {
  for (const lang of ['ar', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript((l) => { try { localStorage.setItem('rms8:lang', l); } catch { } }, lang);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'comp/SystemPanel'); await p.waitForSelector('.mq-sub-card', { timeout: 15000 }); await settle(p);
    const t = (await p.locator('.mq-sub-card').innerText()).replace(/\s+/g, ' ');
    if (lang === 'ar') { assert.match(t, /الاشتراك والمنشأة/); assert.match(t, /المنشأة الرئيسية/); assert.match(t, /المؤسسات/); assert.match(t, /نشط/); assert.match(t, /✓ التحليل بالذكاء الاصطناعي/); assert.match(t, /✓ الفوترة الإلكترونية/); assert.match(t, /بلا حد/); }
    else { assert.match(t, /Subscription & organization/); assert.match(t, /Enterprise/); assert.match(t, /Active/); assert.match(t, /unlimited/); }
    assert.equal(await p.locator('.mq-sub-card input, .mq-sub-card select, .mq-sub-card button').count(), 0, 'عرض فقط — لا يُعدَّل من داخل المنشأة');
    assert.equal(await p.locator('.mq-sub-ro').count(), 0, 'لا شريط «للقراءة فقط» للطيف');
    assert.deepEqual(errs, []); await ctx.close();
  }
});

test('v51.4 الفواتير والدفع لمنشأة مشتركة: الأسعار شاملة الضريبة، وسائل الدفع، التحويل البنكي، وطباعة الفاتورة الضريبية', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const INV = { no: 'MQ-2026-000001', seq: 1, issuedAt: '2026-11-19T10:00:00.000Z', tenant: 'c2', plan: 'pro', period: 'monthly', start: '2026-11-19', end: '2026-12-18', net: 19900, vat: 2985, total: 22885, currency: 'SAR', status: 'paid', method: 'mada', paidAt: '2026-11-19T10:05:00.000Z',
    seller: { name: 'مُكتسَب لتقنية المعلومات', vatNo: '311111111100003', crNo: '1010000000', address: 'الرياض' }, buyer: { name: 'مطعم تجريبي', vatNo: '300000000000003', address: 'الدمام' }, payments: [] };
  const calls = [];
  await p.route('http://zatca.test/api/billing/**', async (route) => { const u = new URL(route.request().url()); calls.push(route.request().method() + ' ' + u.pathname + ' ' + (route.request().postData() || ''));
    const J = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.endsWith('/summary')) return J({ enabled: true, plan: 'pro', prices: { monthly: 19900, yearly: 199000 }, sub: { paidThrough: '2026-12-18', state: 'active' }, invoices: [{ ...INV, payments: undefined }],
      methods: ['mada', 'card', 'applepay', 'stcpay', 'bank'], bank: { iban: 'SA0380000000608010167519', name: 'الراجحي', holder: 'مُكتسَب لتقنية المعلومات' }, seller: { name: INV.seller.name, vatNo: INV.seller.vatNo } });
    if (u.pathname.endsWith('/checkout')) return J({ no: 'MQ-2026-000002', total: 228850, bank: { iban: 'SA0380000000608010167519', name: 'الراجحي', holder: 'مُكتسَب لتقنية المعلومات' }, reference: 'MQ-2026-000002' });
    if (u.pathname.includes('/invoice/')) return J(INV);
    return J({}); });
  await p.goto(base + 'subcard'); await p.waitForSelector('.mq-bill', { timeout: 15000 }); await settle(p);
  const t = (await p.locator('.mq-sub-card').innerText()).replace(/\s+/g, ' ');
  assert.match(t, /الفواتير والدفع/); assert.match(t, /مدفوع حتى 2026-12-18/); assert.match(t, /شهري: 228\.85 ر\.س/); assert.match(t, /سنوي: 2288\.50 ر\.س/);
  assert.match(t, /199\.00 ر\.س \+ ضريبة 15% 29\.85 = 228\.85 ر\.س/); assert.match(t, /مدى، فيزا \/ ماستركارد، Apple Pay، STC Pay/); assert.match(t, /MQ-2026-000001/); assert.match(t, /مدفوعة/);
  assert.match(t, /المتقدمة/); assert.match(t, /2 \/ 5/);
  await p.click('input[name="mq-period"] >> nth=1'); await p.click('button:has-text("تحويل بنكي")'); await p.waitForSelector('.mq-bank');
  const bk = (await p.locator('.mq-bank').innerText()).replace(/\s+/g, ' ');
  assert.match(bk, /SA0380000000608010167519/); assert.match(bk, /MQ-2026-000002/); assert.match(bk, /مُكتسَب لتقنية المعلومات/);
  assert.ok(calls.some(c => c.startsWith('POST /api/billing/checkout') && c.includes('"period":"yearly"') && c.includes('"method":"bank"')), calls.join('\n'));
  await p.click('button[title="طباعة الفاتورة"]'); await p.waitForSelector('.mz-docv iframe', { timeout: 8000 }); await p.waitForTimeout(400);
  const html = await p.evaluate(() => document.querySelector('.mz-docv iframe').srcdoc);
  assert.match(html, /فاتورة ضريبية/); assert.doesNotMatch(html, /فاتورة ضريبية مبسطة/, 'مشترٍ برقم ضريبي ⇒ فاتورة ضريبية');
  assert.match(html, /311111111100003/); assert.match(html, /300000000000003/); assert.match(html, /228\.85/); assert.match(html, /29\.85/); assert.match(html, /<svg/, 'رمز QR');
  assert.match(html, /2026-11-19 — 2026-12-18/); assert.match(html, /لتقنية المعلومات/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v51.5 لوحة مُكتسَب: المنشآت والتوصيات والمفاتيح، تأكيد التحويل، وقبول طلب تسجيل يعرض أمر التهيئة', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept(d.type() === 'prompt' ? (/مرجع/.test(d.message()) ? 'TRX-77' : /المبلغ/.test(d.message()) ? '228.85' : /معرّف/.test(d.message()) ? 'burger-house' : '14') : undefined));
  const posts = []; let confirmed = false;
  await p.route('http://zatca.test/api/provider/**', async (route) => { const u = new URL(route.request().url()), m = route.request().method(); if (m === 'POST') posts.push(u.pathname + ' ' + route.request().postData());
    const J = (b, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.endsWith('/tenants')) return J({ tenants: [{ id: 'c2', name: 'مطعم س', projectId: 'mithqal-c2', plan: 'pro', registryPlan: 'pro', state: 'overdue', recommend: 'readonly', paidThrough: '2026-11-01', keys: { web: true, zatca: true, ops: false } },
      { id: 'c9', name: 'جديدة', projectId: 'mithqal-c9', plan: '', state: 'unconfigured', recommend: 'active', keys: { web: false, zatca: false, ops: false } }] });
    if (u.pathname.endsWith('/signups')) return J({ signups: [{ id: 'S00001', seq: 1, company: 'Burger House', contact: 'أحمد علي', email: 'own@bh.sa', phone: '0501234567', plan: 'pro', branches: 3, status: 'new', at: '2026-11-19T08:00:00Z' }] });
    if (u.pathname.endsWith('/invoices')) return J({ invoices: [{ no: 'MQ-2026-000005', start: '2026-11-19', end: '2026-12-18', total: 22885, status: confirmed ? 'paid' : 'pending_transfer' }] });
    if (u.pathname.endsWith('/invoice/confirm')) { confirmed = true; return J({ ok: true, status: 'paid', end: '2026-12-18' }); }
    if (u.pathname.endsWith('/status')) return J({ error: 'لا حساب خدمة تشغيلي لهذه المنشأة (saEnv) — نفّذ الأمر يدويًا', cmd: 'node scripts/tenant-provision.mjs status --id c2 --set readonly' }, 409);
    if (u.pathname.endsWith('/signups/decide')) return J({ ok: true, cmd: 'node scripts/tenant-provision.mjs plan --id burger-house --name "Burger House" --plan pro --owner own@bh.sa' });
    return J({}); });
  await p.goto(base + 'provider'); await p.waitForSelector('.mq-prov table', { timeout: 15000 }); await settle(p);
  const t = (await p.locator('.mq-prov').innerText()).replace(/\s+/g, ' ');
  assert.match(t, /مطعم س/); assert.match(t, /متأخر/); assert.match(t, /للقراءة فقط/); assert.match(t, /غير مهيأة على الخادم/); assert.match(t, /✕ ops/); assert.match(t, /Burger House/); assert.match(t, /own@bh\.sa/);
  await p.click('tr:has-text("مطعم س") button:has-text("للقراءة فقط")'); await p.waitForSelector('.mq-prov-cmd');
  assert.match(await p.locator('.mq-prov-cmd').innerText(), /tenant-provision\.mjs status --id c2 --set readonly/, 'بلا حساب خدمة: الأمر اليدوي');
  await p.click('tr:has-text("مطعم س") button:has-text("الفواتير")'); await p.click('button:has-text("تأكيد التحويل")'); await p.waitForTimeout(500);
  assert.ok(posts.some(x => x.startsWith('/api/provider/invoice/confirm') && x.includes('"ref":"TRX-77"') && x.includes('"amount":"228.85"')), posts.join('\n'));
  await p.click('tr:has-text("Burger House") button:has-text("قبول")'); await p.waitForTimeout(400);
  assert.match(await p.locator('.mq-prov-cmd').innerText(), /plan --id burger-house --name "Burger House" --plan pro --owner own@bh\.sa/);
  assert.ok(posts.some(x => x.startsWith('/api/provider/signups/decide') && x.includes('"tenantId":"burger-house"') && x.includes('"status":"approved"')));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v51.5 التسجيل العام: نموذج عربي مستقل، الحقل المخفي يُرسل فارغًا، ورسالة الاستلام', async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let sent = null;
  await p.route('http://zatca.test/api/signup', async (route) => { sent = JSON.parse(route.request().postData()); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'S00042' }) }); });
  await p.goto(base + 'signup'); await p.waitForSelector('.mq-signup form', { timeout: 15000 });
  const ins = p.locator('.mq-signup form input:not([type=radio]):not([name=website])');
  await ins.nth(0).fill('مطعم الوادي'); await ins.nth(1).fill('أحمد علي'); await ins.nth(2).fill('0501234567'); await ins.nth(3).fill('own@wadi.sa');
  await ins.nth(0).press('End'); await p.keyboard.type('ي'); await p.keyboard.type('ة'); assert.equal(await ins.nth(0).inputValue(), 'مطعم الواديية', 'الكتابة المتتابعة لا تفقد المؤشر');
  await p.click('label:has-text("المؤسسات")');
  const hb = await p.locator('input[name=website]').boundingBox(); assert.ok(!hb || hb.width <= 1, 'الحقل المخفي لا يظهر');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'لا تمرير أفقي على الجوال');
  await p.click('button[type=submit]'); await p.waitForSelector('.mq-signup-ok');
  assert.match(await p.locator('.mq-signup-ok').innerText(), /S00042/);
  assert.equal(sent.company, 'مطعم الواديية'); assert.equal(sent.plan, 'enterprise'); assert.equal(sent.website, ''); assert.equal(sent.email, 'own@wadi.sa');
  assert.equal(await p.evaluate(() => document.querySelector('.mq-signup').getAttribute('dir')), 'rtl');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v51.6 طباعة تقرير الإغلاق PDF: المستند وحده بلا شريط العارض، وبلا صفحة بيضاء — من الزر ومن طباعة المتصفح', async () => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'comp/Launcher'); await p.waitForTimeout(1200);
  const open = () => p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; };
    window.__M.printClosingA4({ id: 'c1', branchId: 'b1', branchName: 'طيبة', date: '2026-11-18', status: 'approved', totalRevenue: 9420, cashSales: 5000, cardSales: 3000, deliverySales: [], expenses: [{ id: 'x', categoryName: 'خضار', amount: 120, paymentMethod: 'cash' }], totalExpenses: 120, variance: 0, actualCashCount: 1000, expectedCashInSafe: 1000, createdBy: 'أحمد علي' },
      { company: { name: 'شركة الطيف الأولى' }, branches: [{ id: 'b1', name: 'طيبة' }] }); });
  const state = () => p.evaluate(() => { const h = document.getElementById('mz-print'), r = h && (h.shadowRoot || h);
    const kids = r ? [...r.querySelectorAll('.page > *')] : [];
    return { docv: getComputedStyle(document.querySelector('.mz-docv')).display, host: h ? getComputedStyle(h).display : 'none', text: r ? r.textContent : '',
      minOpacity: kids.length ? Math.min(...kids.map(k => Number(getComputedStyle(k).opacity))) : -1, anim: kids.length ? getComputedStyle(kids[0]).animationName : '' }; });
  // ١) زر «طباعة / PDF» في العارض
  await open(); await p.waitForSelector('.mz-docv'); await p.click('.mz-docv button:has-text("طباعة")'); await p.waitForTimeout(450);
  await p.emulateMedia({ media: 'print' }); let s = await state();
  assert.equal(s.docv, 'none', 'شريط العارض (إغلاق/Excel/PDF) لا يُطبع'); assert.equal(s.host, 'block');
  assert.match(s.text, /تقرير الإغلاق اليومي الرسمي/); assert.match(s.text, /9,420\.00/); assert.match(s.text, /أحمد علي/, 'المسؤول لا يظهر undefined');
  assert.equal(s.minOpacity, 1, 'لا حركة ظهور من أنماط المنصة (كانت تطبع صفحة بيضاء)'); assert.equal(s.anim, 'none');
  assert.equal(await p.evaluate(() => window.__printed), 1);
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await p.locator('#mz-print').count(), 0, 'التنظيف بعد الطباعة');
  // ٢) طباعة المتصفح نفسه (Ctrl+P / مشاركة ← طباعة) والعارض مفتوح
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await p.emulateMedia({ media: 'print' }); s = await state();
  assert.equal(s.docv, 'none'); assert.equal(s.host, 'block'); assert.match(s.text, /تقرير الإغلاق اليومي الرسمي/); assert.equal(s.minOpacity, 1);
  await p.emulateMedia({ media: 'screen' });
  assert.deepEqual(errs, []); await ctx.close();
});

test('v51.8 التنقل بين أقسام التطبيق: السابق / التالي / رجوع — في المخزون والمحاسبة', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'comp/Inventory'); await p.waitForSelector('.secpager', { timeout: 15000 }); await settle(p);
  // v56.16: الموضع بعد اسم القسم الحالي («الاسم · 2 / 9»)
  const pos = async () => { const t = (await p.locator('.secpager .sp-pos').first().innerText()).trim(); assert.ok(/^.+ · \d+ \/ \d+$/.test(t), 'اسم القسم ظاهر: ' + t); return t.split(' · ').pop(); };
  const p0 = await pos(); assert.match(p0, /^1 \/ \d+$/); const n = Number(p0.split('/')[1]);
  assert.equal(await p.locator('.secpager .sp-prev').first().isDisabled(), true, 'لا سابق للقسم الأول');
  assert.equal(await p.locator('.secpager .sp-back').count(), 0, 'لا رجوع قبل أي تنقل');
  await p.click('.secpager .sp-next'); await settle(p); assert.equal(await pos(), '2 / ' + n);
  await p.click('.secpager .sp-next'); await settle(p); assert.equal(await pos(), '3 / ' + n);
  await p.click('.secpager .sp-prev'); await settle(p); assert.equal(await pos(), '2 / ' + n);
  await p.click('.secpager .sp-back'); await settle(p); assert.equal(await pos(), '3 / ' + n, 'رجوع = القسم الذي كنت فيه قبله');
  for (let i = 3; i < n; i++) { await p.click('.secpager .sp-next'); await settle(p); }
  assert.equal(await pos(), n + ' / ' + n); assert.equal(await p.locator('.secpager .sp-next').first().isDisabled(), true, 'لا تالٍ للأخير');
  await ctx.close();
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(base + 'acct/jr'); await q.waitForSelector('.secpager', { timeout: 15000 }); await settle(q);
  const a0 = (await q.locator('.secpager .sp-pos').innerText()).trim(); await q.click('.secpager .sp-next'); await settle(q);
  const a1 = (await q.locator('.secpager .sp-pos').innerText()).trim(); assert.notEqual(a0, a1, 'المحاسبة: التالي ينقل القسم');
  await q.click('.secpager .sp-back'); await settle(q); assert.equal((await q.locator('.secpager .sp-pos').innerText()).trim(), a0);
  assert.deepEqual(errs, []); await c2.close();
});

test('v51.9 صلاحيات التعديل لكل مستخدم: المسؤول يمنح محاسبًا «إدخال بلا تعديل» تعديل القيود لآخر 30 يومًا ويمنع عنه الفواتير', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/AppPermsPanel/admin');
  await p.evaluate(() => window.setOrg(o => ({ ...o, users: [...o.users, { id: 'u7', name: 'محاسب الإدخال', email: 'acc@x.sa', role: 'accountant' }] })));
  await p.waitForTimeout(300);
  await p.selectOption('select.sel >> nth=0', 'u7'); await p.waitForSelector('.mq-editperms [data-perm="je"]');
  const t0 = (await p.locator('.mq-editperms').innerText()).replace(/\s+/g, ' '); assert.match(t0, /يُدخل بلا تعديل/); assert.match(t0, /حسب الدور \(لا يعدّل\)/);
  await p.selectOption('.mq-editperms [data-perm="je"] select', 'allow');
  await p.fill('.mq-editperms [data-perm="je"] input.inp', '30');
  await p.selectOption('.mq-editperms [data-perm="inv"] select', 'deny');
  assert.equal(await p.locator('.mq-editperms [data-perm="inv"] input').count(), 0, 'الممنوع بلا خيارات حصر');
  await p.click('.mq-editperms button:has-text("حفظ صلاحيات التعديل")'); await p.waitForTimeout(400);
  const u = await p.evaluate(() => window.curOrg.users.find(x => x.id === 'u7'));
  assert.deepEqual(u.editPerms, { je: { mode: 'allow', days: 30 }, inv: { mode: 'deny' } });
  // صاحب الدور الذي لا يُدخل: لا تُمنح له صلاحية
  await p.selectOption('select.sel >> nth=0', 'u2'); await p.waitForTimeout(200);
  assert.match(await p.locator('.mq-editperms').innerText(), /لا تُمنح له صلاحية تعديل/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v51.9 تعديل القيود: المعلّق يُستبدل، والمرحّل يُصحَّح بعكس + قيد جديد — وزر التعديل لا يظهر لمن لا يملكه', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/admin/jr');
  const L = (a, b) => [{ code: '5201', debit: a, credit: 0 }, { code: '1101', debit: 0, credit: b }];
  await p.evaluate((ls) => window.setOps(o => ({ ...o, journalManual: [
    { id: 'jp1', date: new Date().toISOString().slice(0, 10), title: 'إيجار معلّق', by: 'منى', byId: 'u7', createdAt: new Date().toISOString(), status: 'pending', lines: ls[0] },
    { id: 'jq1', date: new Date().toISOString().slice(0, 10), title: 'كهرباء مرحّل', by: 'مجاهد', byId: 'u1', createdAt: new Date().toISOString(), status: 'posted', approvedBy: 'مجاهد', lines: ls[1] }] })), [L(100, 100), L(80, 80)]);
  await p.waitForTimeout(400); await settle(p);
  await p.click('button:has-text("قيود بانتظار الاعتماد")'); await p.waitForSelector('[data-je-pending="jp1"] [data-editje]');
  await p.click('[data-je-pending="jp1"] [data-editje]'); await p.waitForSelector('text=تعديل قيد بانتظار الاعتماد');
  const nums = p.locator('.modal input[inputmode="decimal"]');
  await nums.nth(0).fill('150'); await nums.nth(3).fill('150');
  await p.click('button:has-text("تسجيل القيد")'); await p.waitForTimeout(400);
  let jm = await p.evaluate(() => window.cur.journalManual);
  assert.ok(!jm.some(x => x.id === 'jp1'), 'المعلّق الأصلي استُبدل'); const nw = jm.find(x => x.replaces === 'jp1'); assert.ok(nw); assert.equal(nw.lines[0].debit, 150);
  assert.match(await p.evaluate(() => window.lastSay), /عُدّل القيد/);
  // المرحّل: عكس + مصحّح، والأصل باقٍ
  await p.click('tr:has-text("كهرباء مرحّل")'); await p.waitForTimeout(300);
  const btn = p.locator('[data-editje]').first(); assert.equal(await btn.count(), 1, 'زر تعديل للمرحّل');
  { await btn.click(); await p.waitForSelector('text=تصحيح قيد مرحّل');
    await nums.nth(0).fill('90'); await nums.nth(3).fill('90'); await p.click('button:has-text("تسجيل القيد")'); await p.waitForTimeout(400);
    jm = await p.evaluate(() => window.cur.journalManual);
    assert.ok(jm.some(x => x.id === 'jq1'), 'المرحّل لا يُمسح'); assert.ok(jm.some(x => x.reverses === 'jq1'), 'قيد عكسي'); assert.equal(jm.find(x => x.replaces === 'jq1').lines[0].debit, 90); }
  assert.deepEqual(errs, []); await ctx.close();
  const o2 = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/acc/jr');
  await o2.p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [{ id: 'jp9', date: new Date().toISOString().slice(0, 10), title: 'x', by: 'منى', byId: 'u7', createdAt: new Date().toISOString(), status: 'pending', lines: [{ code: '5201', debit: 5 }, { code: '1101', credit: 5 }] }] })));
  await o2.p.waitForTimeout(400); await o2.p.click('button:has-text("قيود بانتظار الاعتماد")').catch(() => {}); await o2.p.waitForTimeout(300);
  assert.equal(await o2.p.locator('[data-editje]').count(), 0, 'محاسب «إدخال بلا تعديل» بلا منح — لا زر تعديل'); await o2.ctx.close();
});

test('v52.0 الأتمتة: إعداداتها في بيانات الشركة، وأوامر الشراء المقترحة تُفتح في نموذج الأمر للمراجعة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/SystemPanel/admin');
  await p.waitForSelector('.mq-auto'); const t = (await p.locator('.mq-auto').innerText()).replace(/\s+/g, ' ');
  assert.match(t, /القيود الدورية المستحقة/); assert.match(t, /استحقاق رواتب الشهر السابق/); assert.match(t, /أوامر شراء مقترحة/); assert.match(t, /تذكير الإقرار الضريبي/); assert.match(t, /تذكير الإقفال الشهري/);
  await p.fill('.mq-auto input[aria-label="payrollDay"]', '3'); await p.fill('.mq-auto input[aria-label="payrollDay"]', '3');
  await p.locator('.mq-auto label:has-text("أوامر شراء مقترحة") input').uncheck();
  await p.click('.mq-auto button:has-text("حفظ إعدادات الأتمتة")'); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(() => window.curOrg.autoCfg), { recurring: true, payroll: true, payrollDay: 3, poSuggest: false, vatRemindDays: 7, lockAfterDays: 10 });
  await ctx.close();
  const o2 = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Hub/admin/purchasing:suppliers');
  await o2.p.evaluate(() => { window.setOrg(o => ({ ...o, items: o.items.map(i => i.id === 'i1' ? { ...i, minQty: 60 } : i) }));
    window.setOps(o => ({ ...o, purchaseOrders: [...(o.purchaseOrders || []), { id: 'pr1', poNo: 'PO-0009', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', status: 'received', date: '2026-10-01', whId: 'wh-b1', lines: [{ itemId: 'i1', desc: 'لحم غنم', qty: 10, price: 41, received: 10 }] }] })); });
  await o2.p.waitForTimeout(400); await o2.p.click('button:has-text("أوامر الشراء")').catch(() => {}); await o2.p.waitForSelector('.mq-posugg', { timeout: 8000 });
  const s = (await o2.p.locator('.mq-posugg').innerText()).replace(/\s+/g, ' '); assert.match(s, /مؤسسة اللحوم الطازجة/); assert.match(s, /لحم غنم 70/, 'حتى ضعف الحد: 120 − 50');
  await o2.p.click('.mq-posugg button:has-text("مراجعة وإنشاء الأمر")'); await o2.p.waitForSelector('text=أمر شراء جديد');
  assert.ok(await o2.p.locator('.modal input[value="70"]').count() >= 1, 'النموذج معبأ بالكمية المقترحة');
  assert.deepEqual([...errs, ...o2.errs], []); await o2.ctx.close();
});

test('v52.1 الحملات: إنشاء حملة تربط كوبونًا بشريحة، والنتائج من الطلبات الفعلية، والكوبون لا يُربط بحملتين', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); const d = td.toISOString().slice(0, 10);
    window.setOrg(g => ({ ...g, posPromos: [{ id: 'cw', name: 'عودة', type: 'pct', value: 10, scope: 'all', code: 'BACK10', active: true }] }));
    window.setOps(o => ({ ...o, mktCampaigns: [], posOrders: [{ id: 'o1', date: d, branchId: 'b1', coupon: 'BACK10', total: 90, lines: [{ promoId: 'cw', disc: 10 }], loyalty: { phone: '0511111111' } }] })); });
  await p.waitForTimeout(300); await p.click('[data-mktv="cmp"]'); await p.waitForSelector('[data-cmp]');
  await p.click('[data-cmp] button:has-text("حملة جديدة")');
  await p.fill('.modal input[aria-label="اسم الحملة"]', 'استرجاع العملاء'); await p.fill('.modal input[aria-label="الميزانية"]', '20');
  await p.locator('.modal label:has-text("BACK10") input').check();
  await p.click('.modal button:has-text("إطلاق الحملة")'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => window.cur.mktCampaigns[0]);
  assert.equal(c.no, 'CMP-0001'); assert.equal(c.status, 'active'); assert.deepEqual(c.promoIds, ['cw']);
  assert.equal(await p.evaluate(() => window.curOrg.posPromos[0].campaignId), c.id, 'الكوبون مرتبط بالحملة');
  const s = (await p.locator('[data-camp="CMP-0001"] [data-campstats]').innerText()).replace(/\s+/g, ' ');
  assert.match(s, /الاستخدام: 1/); assert.match(s, /90\.00/); assert.match(s, /التكلفة لكل طلب: 30\.00/);
  await p.click('[data-cmp] button:has-text("حملة جديدة")');
  assert.equal(await p.locator('.modal label:has-text("BACK10") input').isDisabled(), true, 'لا يُربط بحملتين قائمتين');
  await p.click('.modal button:has-text("إلغاء")');
  await p.click('[data-camp="CMP-0001"] button:has-text("إنهاء")'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.cur.mktCampaigns[0].status), 'ended');
  await p.click('[data-mktv="cpn"]'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-cpntable]').innerText(), /حملة CMP-0001/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v52.2 التوصيات عند الدفع: «مقترح مع الطلب» من سلال الفرع، الإضافة بنقرة والإخفاء يُحفظان مع الفاتورة، والنتائج في التسويق', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    // تاريخ قبل يومين: يوم العمل في نقطة البيع قد يكون أمس بعد منتصف الليل، فلا نربط الاختبار بالساعة
    const td = new Date(Date.now() - 2 * 864e5); td.setHours(12); const d = td.toISOString().slice(0, 10);
    const hist = []; for (let i = 0; i < 6; i++) hist.push({ id: 'h' + i, date: d, branchId: 'b1', status: 'paid', total: 53, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }, { productId: 'l', name: 'لبن', qty: 1, price: 3 }, ...(i < 4 ? [{ productId: 's', name: 'سلطة', qty: 1, price: 8 }] : [])] });
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 50, cat: 'رئيسي' }, { id: 'l', name: 'لبن', sellPrice: 3, cat: 'مشروبات' }, { id: 's', name: 'سلطة', sellPrice: 8, cat: 'مقبلات' }] }));
    window.setOps(o => ({ ...o, posTabs: [], posOrders: hist, closings: o.closings.filter(c => c.branchId !== 'b1') }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.waitForSelector('[data-recs]');
  const t = await p.locator('[data-recs]').innerText(); assert.match(t, /مقترح مع الطلب/); assert.match(t, /لبن/); assert.match(t, /سلطة/); assert.match(t, /كبسة.+100%/);
  await p.click('[data-rec="l"] button:has-text("لبن")'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-rec="l"]').count(), 0, 'لا يُقترح ما في السلة');
  await p.click('[data-rec="s"] button[aria-label="إخفاء سلطة"]'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-recs]').count(), 0);
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(700);
  const all = await p.evaluate(() => [...window.cur.posOrders, ...JSON.parse(localStorage.getItem('mizan:posQueue') || '[]')]);
  const o = all.find(x => !String(x.id).startsWith('h')); assert.ok(o, 'الفاتورة محفوظة');
  assert.deepEqual(o.recShown.slice().sort(), ['l', 's']); assert.deepEqual(o.recDismissed, ['s']);
  assert.deepEqual(o.lines.map(l => [l.productId, l.rec || '']), [['k', ''], ['l', 'co']]); assert.equal(o.total, 53, 'التوصية لا تغيّر السعر');
  assert.deepEqual(errs, []); await ctx.close();
  const M = await open({ viewport: { width: 1300, height: 1100 } }, 'live/MktGrowth/admin');
  await M.p.evaluate((o) => { window.setOps(x => ({ ...x, posOrders: [{ ...o, pending: undefined }] })); }, o); await M.p.waitForTimeout(300);
  await M.p.click('[data-mktv="rec"]'); await M.p.waitForSelector('[data-recview]');
  const s = (await M.p.locator('[data-recstats]').innerText()).replace(/\s+/g, ' ');
  assert.match(s, /مرات العرض: 2/); assert.match(s, /القبول: 1/); assert.match(s, /نسبة القبول: 50%/); assert.match(s, /أُخفيت: 1/); assert.match(s, /3\.00/);
  await M.p.locator('[data-reccfg] input[aria-label="تفعيل التوصيات"]').uncheck(); await M.p.fill('[data-reccfg] input[aria-label="عدد الاقتراحات"]', '2');
  await M.p.click('[data-reccfg-save]'); await M.p.waitForTimeout(300);
  assert.deepEqual(await M.p.evaluate(() => window.curOrg.mkt.recs), { on: false, days: 60, minPair: 3, minConf: 15, max: 2 });
  assert.deepEqual(M.errs, []); await M.ctx.close();
});

test('v52.4 تقارير الفروع والربحية: المبيعات والنمو والخصومات والهامش التقديري لكل فرع، والتفاصيل، وExcel', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); const d = td.toISOString().slice(0, 10);
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }], products: [{ id: 'k', name: 'كبسة', sellPrice: 46, parts: [{ itemId: 'm', qty: 0.5 }] }] }));
    window.setOps(o => ({ ...o, posOrders: [{ id: 'o1', date: d, at: new Date().toISOString(), branchId: 'b1', channel: 'takeaway', total: 92, net: 80, manualDisc: 0, lines: [{ productId: 'k', name: 'كبسة', qty: 2, price: 46 }] }] })); });
  await p.waitForTimeout(300); await p.click('[data-mktv="brr"]'); await p.waitForSelector('[data-brrtable]');
  const row = (await p.locator('[data-brrow="b1"]').innerText()).replace(/\s+/g, ' ');
  assert.match(row, /92\.00/); assert.match(row, /50%/, 'هامش الوصفات: (80 − 40) ÷ 80');
  assert.match(await p.locator('[data-brrkpis]').innerText(), /92\.00/);
  await p.click('[data-brrow="b1"] button:has-text("تفاصيل")'); await p.waitForSelector('[data-brrdet]');
  assert.match(await p.locator('[data-brrdet]').innerText(), /كبسة: 2/);
  const [dlf] = await Promise.all([p.waitForEvent('download'), p.click('[data-brr] button:has-text("Excel")')]);
  assert.equal((await import('node:fs')).readFileSync(await dlf.path()).subarray(0, 2).toString(), 'PK', 'ملف Excel (xlsx)');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v52.5 المساعد الذكي: يرسل ملخصًا بلا بيانات شخصية ويعرض الإجابة والإجراءات المقترحة — وإعدادات التواصل والقوالب دون إرسال', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); const d = td.toISOString().slice(0, 10);
    window.setOps(o => ({ ...o, posOrders: [{ id: 'o1', date: d, at: new Date().toISOString(), branchId: 'b1', total: 92, net: 80, lines: [{ productId: 'k', name: 'كبسة', qty: 2, price: 46 }], loyalty: { phone: '0559998877', name: 'عميل سري' } }] })); });
  let sent = null;
  await p.route('http://zatca.test/api/ai/growth', r => { sent = JSON.parse(r.request().postData()); r.fulfill({ json: { result: { answer: 'فرع طيبة يقود المبيعات.', points: ['92 ريال في الفترة'], actions: [{ title: 'أطلق حملة استرجاع', why: 'العملاء المعرّضون للانقطاع', where: 'التسويق والنمو ← الحملات' }], caveats: ['البيانات قليلة'] } } }); });
  await p.waitForTimeout(300); await p.click('[data-mktv="ai"]'); await p.waitForSelector('[data-ai]');
  await p.locator('[data-aipreset]').first().click(); await p.waitForSelector('[data-aians]');
  assert.ok(sent && sent.digest && sent.question); const s = JSON.stringify(sent);
  assert.ok(!/559998877|عميل سري/.test(s), 'لا جوال ولا اسم عميل فيما يُرسل');
  const a = (await p.locator('[data-aians]').innerText()).replace(/\s+/g, ' ');
  assert.match(a, /فرع طيبة يقود المبيعات/); assert.match(a, /أطلق حملة استرجاع/); assert.match(a, /التسويق والنمو ← الحملات/); assert.match(a, /البيانات قليلة/);
  // إعدادات التواصل
  await p.click('[data-mktv="com"]'); await p.waitForSelector('[data-com]');
  assert.match(await p.locator('[data-comoff]').innerText(), /غير مفعّل/);
  await p.selectOption('[data-comcfg] select[aria-label="المزوّد"]', 'unifonic'); await p.fill('[data-comcfg] input[aria-label="اسم المرسل"]', 'ALTAIF');
  await p.locator('[data-comcfg] input[aria-label="قناة رسائل SMS"]').check(); await p.click('[data-comsave]'); await p.waitForTimeout(300);
  let c = await p.evaluate(() => window.curOrg.mkt.comms); assert.equal(c.provider, 'unifonic'); assert.equal(c.senderName, 'ALTAIF'); assert.equal(c.channels.sms, true); assert.equal('sendingEnabled' in c, false);
  await p.click('[data-comtpl] button:has-text("قالب جديد")');
  await p.fill('.modal input[aria-label="اسم القالب"]', 'تذكير النقاط'); await p.selectOption('.modal select[aria-label="القناة"]', 'sms');
  await p.fill('.modal textarea[aria-label="نص القالب"]', 'أهلًا {name}، رصيدك {points} نقطة في {company}');
  assert.match(await p.locator('[data-tplprev]').innerText(), /أهلًا سارة، رصيدك 120 نقطة/); assert.match(await p.locator('[data-smsparts]').innerText(), /رسالة SMS/);
  await p.click('.modal button:has-text("حفظ القالب")'); await p.waitForTimeout(300);
  c = await p.evaluate(() => window.curOrg.mkt.comms); assert.deepEqual(c.templates.map(t => [t.name, t.ch]), [['تذكير النقاط', 'sms']]);
  await p.click('[data-comtpl] button:has-text("قالب جديد")'); await p.fill('.modal input[aria-label="اسم القالب"]', 'خطأ'); await p.fill('.modal textarea[aria-label="نص القالب"]', 'مرحبا {foo} يا عميل');
  await p.click('.modal button:has-text("حفظ القالب")'); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.lastSay || ''), /متغير غير معروف/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v52.7 فصل فواتير نقطة البيع شهريًا (G3-A): فحص الحالة، الفصل مع التحقق، والتراجع — من صيانة النظام', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.evaluate(() => { const os = [{ id: 'p1', branchId: 'b1', date: '2026-10-05', total: 20, lines: [] }, { id: 'p2', branchId: 'b1', date: '2026-11-03', total: 30, lines: [] }, { id: 'p3', branchId: 'b1', date: '2026-11-04', total: 40, lines: [] }];
    localStorage.setItem('rms8:br_b1', JSON.stringify({ posOrders: os, closings: [], rev: 2 }));
    window.setOps(o => ({ ...o, posOrders: os })); });
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForSelector('[data-possplit]');
  await p.click('[data-possplit] button:has-text("فحص الحالة")'); await p.waitForSelector('[data-posbr="b1"] .badge');
  assert.match(await p.locator('[data-posbr="b1"]').innerText(), /مستند واحد/);
  await p.click('[data-posbr="b1"] button:has-text("فصل شهريًا")'); await p.waitForTimeout(600);
  const s = await p.evaluate(() => ({ br: JSON.parse(localStorage.getItem('rms8:br_b1')), oct: JSON.parse(localStorage.getItem('rms8:pos_b1_202610')), nov: JSON.parse(localStorage.getItem('rms8:pos_b1_202611')) }));
  assert.deepEqual(s.br.posMonths, ['202610', '202611']); assert.deepEqual(s.br.posOrders, []); assert.equal(s.oct.orders.length, 1); assert.equal(s.nov.orders.length, 2);
  assert.match(await p.locator('[data-posbr="b1"]').innerText(), /مفصول شهريًا/); assert.match(await p.evaluate(() => window.lastSay || ''), /3 فاتورة في 2 شهر/);
  await p.click('[data-posbr="b1"] button:has-text("تراجع")'); await p.waitForTimeout(600);
  const u = await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:br_b1')));
  assert.equal(u.posOrders.length, 3); assert.equal('posMonths' in u, false); assert.match(await p.locator('[data-posbr="b1"]').innerText(), /مستند واحد/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v52.8 صور الإغلاق: الاعتماد النهائي ينقلها لأرشيف المستندات ويزيلها من ملف الفرع (قرار المالك)', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/closehub:approve');
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(600);
  await p.evaluate((img) => { localStorage.removeItem('rms8:bf_b1');
    window.setOps(o => ({ ...o, closings: [{ id: 'cg1', branchId: 'b1', branchName: 'فرع عم قاسم طيبة', date: '2026-11-15', status: 'approved', gmApprovalStatus: 'pending', managerName: 'عبدالجليل', createdAt: '2026-11-15T20:00:00Z',
      totalRevenue: 100, totalExpenses: 0, variance: 0, transferredToMainTreasury: 100, sessionPhoto: img, sessionPhotos: [img], cardReceiptImage: img.replace(/A+$/, m => 'B'.repeat(m.length)), expenses: [] }] })); }, img);
  await p.waitForTimeout(400);
  await p.locator('button:has-text("اعتماد نهائي")').first().click(); await p.waitForTimeout(800);
  const c = await p.evaluate(() => window.cur.closings.find(x => x.id === 'cg1'));
  assert.equal(c.gmApprovalStatus, 'approved'); assert.equal(c.imagesPruned, true); assert.equal(c.sessionPhoto, ''); assert.equal(c.cardReceiptImage, ''); assert.deepEqual(c.sessionPhotos, []);
  const bf = await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:bf_b1') || '{"items":[]}'));
  assert.ok(bf.items.filter(x => x.closingId === 'cg1').length >= 2, 'نُسخت الصور للأرشيف قبل الإزالة: ' + JSON.stringify(await p.evaluate(() => Object.keys(localStorage).filter(k => /bf/.test(k)).map(k => [k, localStorage.getItem(k).length]))));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.0 مجالات النشاط: تفعيل الخيار وتحديد مجال الفرع، ونقطة البيع تعرض منتجات مجال الفرع والمشتركة فقط', async () => {
  const A = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Admin/admin');
  await A.p.waitForSelector('[data-domcard]');
  await A.p.locator('[data-domcard] input[aria-label="إظهار حسب المجال"]').check(); await A.p.waitForTimeout(300);
  assert.equal(await A.p.evaluate(() => window.curOrg.domainCfg.on), true);
  await A.p.locator('button:text-is("تعديل")').first().click(); await A.p.waitForSelector('.modal [data-domchips]');
  await A.p.click('.modal [data-domchips] button:has-text("مقهى")'); await A.p.click('.modal button:has-text("حفظ الفرع")'); await A.p.waitForTimeout(400);
  assert.deepEqual(await A.p.evaluate(() => window.curOrg.branches[0].domains), ['مقهى']);
  assert.match(await A.p.locator('[data-brdom]').first().innerText(), /مقهى/);
  assert.deepEqual(A.errs, []); await A.ctx.close();
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, domainCfg: { on: true }, posCfg: { branches: ['b1'], autoPrint: false }, branches: g.branches.map(b => b.id === 'b1' ? { ...b, domains: ['مقهى'] } : b),
    products: [{ id: 'c', name: 'قهوة عربية', sellPrice: 8, cat: 'مشروبات', domains: ['مقهى'] }, { id: 'm', name: 'مندي لحم', sellPrice: 45, cat: 'رئيسي', domains: ['مطعم'] }, { id: 'w', name: 'ماء', sellPrice: 2, cat: 'مشروبات' }] }));
    window.setOps(o => ({ ...o, posTabs: [], closings: o.closings.filter(c => c.branchId !== 'b1') })); });
  await p.waitForTimeout(400); const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.waitForSelector('.pos-tile');
  const tiles = await p.locator('.pos-tile').allInnerTexts(); const t = tiles.join(' | ');
  assert.match(t, /قهوة عربية/); assert.match(t, /ماء/); assert.doesNotMatch(t, /مندي لحم/);
  await p.evaluate(() => window.setOrg(g => ({ ...g, domainCfg: { on: false } }))); await p.waitForTimeout(300);
  assert.match((await p.locator('.pos-tile').allInnerTexts()).join(' | '), /مندي لحم/, 'الخيار متوقف = كل المنتجات');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.0 فئات المنتجات: إضافة فئة بمجالها من الفروع، والمنتج في الفئة يرث المجال في نقطة البيع، وفئة الصنف وتصفيتها', async () => {
  const A = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await A.p.waitForSelector('[data-catscard]'); await A.p.click('[data-catscard] button:has-text("إدارة الفئات")');
  await A.p.click('[data-catscard] button:has-text("فئة جديدة")'); await A.p.fill('[data-catedit] input[aria-label="اسم الفئة"]', 'مشروبات ساخنة');
  await A.p.selectOption('[data-catedit] select[aria-label="تخص"]', 'prod'); await A.p.click('[data-catedit] [data-domchips] button:has-text("مقهى")');
  await A.p.click('[data-catedit] button:has-text("حفظ الفئة")'); await A.p.waitForTimeout(300);
  assert.deepEqual(await A.p.evaluate(() => window.curOrg.catList.map(c => [c.name, c.for, c.domains])), [['مشروبات ساخنة', 'prod', ['مقهى']]]);
  assert.deepEqual(A.errs, []); await A.ctx.close();
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, domainCfg: { on: true }, catList: [{ id: 'c1', name: 'مشروبات ساخنة', for: 'prod', domains: ['مقهى'] }], posCfg: { branches: ['b1'], autoPrint: false },
    branches: g.branches.map(b => b.id === 'b1' ? { ...b, domains: ['مطعم'] } : b),
    products: [{ id: 'c', name: 'لاتيه', sellPrice: 14, cat: 'مشروبات ساخنة' }, { id: 'm', name: 'مندي دجاج', sellPrice: 30, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posTabs: [], closings: o.closings.filter(c => c.branchId !== 'b1') })); });
  await p.waitForTimeout(400); const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.waitForSelector('.pos-tile'); const t = (await p.locator('.pos-tile').allInnerTexts()).join(' | ');
  assert.match(t, /مندي دجاج/); assert.doesNotMatch(t, /لاتيه/, 'فرع المطعم لا يرى فئة المقهى');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.1 استيراد فواتير المصروفات من Excel/CSV: التعرّف والمعاينة وحفظ الصالح فقط مع مورد جديد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, suppliers: [{ id: 'sE', name: 'شركة الكهرباء', vatNo: '300000000000003' }] })));
  await p.waitForTimeout(300); await p.click('[data-xiopen]'); await p.waitForSelector('.modal input[aria-label="ملف الكشف"]', { state: 'attached' });
  const csv = 'التاريخ,المورد,الرقم الضريبي,رقم الفاتورة,البيان,الحساب,المبلغ قبل الضريبة,الضريبة,طريقة الدفع\n2026-11-01,شركة الكهرباء,,E-77,كهرباء,5198,1000,150,آجل\n2026-11-02,مغسلة النور,,W-1,غسيل,5198,200,0,نقدي\n2026-11-03,مورد بلا رقم,,X-1,شيء,5198,100,15,آجل\n';
  await p.setInputFiles('.modal input[aria-label="ملف الكشف"]', { name: 'كشف.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await p.waitForSelector('[data-xisum]');
  const s = (await p.locator('[data-xisum]').innerText()).replace(/\s+/g, ' ');
  assert.match(s, /صالحة: 2/); assert.match(s, /بها ملاحظة: 1/); assert.match(s, /1,350\.00/); assert.match(s, /موردون جدد: 1/);
  assert.match(await p.locator('[data-xirow="4"]').innerText(), /رقم ضريبي/);
  await p.click('[data-xisave]'); await p.waitForTimeout(700);
  const inv = await p.evaluate(() => window.cur.invoices.filter(i => i.importBatch).map(i => [i.invoiceNo, i.kind, i.amount, i.paidAmount, i.expLines[0].accCode]));
  assert.deepEqual(inv.sort(), [['E-77', 'svc', 1150, 0, '5198'], ['W-1', 'svc', 200, 200, '5198']].sort());
  assert.ok(await p.evaluate(() => window.curOrg.suppliers.some(s => s.name === 'مغسلة النور')));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.3 رقم القيد الثابت للفواتير والرقم الموحد للدفعة: الترقيم والعرض والبحث', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => window.setOps(o => ({ ...o, invoices: [
    { id: 'pj1', kind: 'svc', supplierId: 's1', supplierName: 'مورد أ', invoiceNo: 'A-1', amount: 100, vatAmt: 0, date: '2026-02-02', dueDate: '2026-12-30', branchId: '', importBatch: 'xbZ', importLine: 2 },
    { id: 'pj2', kind: 'svc', supplierId: 's1', supplierName: 'مورد أ', invoiceNo: 'A-2', amount: 50, vatAmt: 0, date: '2026-02-01', dueDate: '2026-12-30', branchId: '' }] })));
  await p.waitForSelector('[data-pjfill]');
  assert.match(await p.locator('[data-pjmiss]').innerText(), /2 فاتورة بلا رقم قيد ثابت/);
  await p.click('[data-pjfill]'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => window.cur.invoices.map(i => [i.id, i.jeNo, i.importNo || '']).sort());
  assert.deepEqual(r, [['pj1', 'PJ-000002', 'IMP-0001'], ['pj2', 'PJ-000001', '']]);
  assert.equal(await p.locator('[data-pjmiss]').count(), 0);
  const jn = await p.locator('[data-jeno]').allInnerTexts(); assert.ok(jn.some(t => /PJ-000002/.test(t) && /IMP-0001/.test(t)));
  await p.fill('input[placeholder^="بحث برقم الفاتورة"]', 'IMP-0001'); await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-jeno]').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.4 تفنيد المشتريات من المصروفات: عمود التصنيف، تطبيق تصنيف ملف مستورد سابقًا، وتصفية القائمة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Hub/admin/purchasing:suppliers');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, customAccounts: [...(g.customAccounts || []), { code: '5134', name: 'مواد البناء', kind: 'exp' }, { code: '5111', name: 'مواد تنظيف', kind: 'exp' }], suppliers: [{ id: 'sM', name: 'مكين', vatNo: '311135091100003' }] }));
    window.setOps(o => ({ ...o, invoices: [
      { id: 'q1', kind: 'svc', supplierId: 'sM', supplierName: 'مكين', invoiceNo: 'F1', amount: 230, vatAmt: 30, date: '2026-01-02', dueDate: '2026-12-30', branchId: '', expLines: [{ accCode: '5134', net: 200, vat: 30 }], importBatch: 'xb1' },
      { id: 'q2', kind: 'svc', supplierId: 'sM', supplierName: 'مكين', invoiceNo: 'F2', amount: 115, vatAmt: 15, date: '2026-01-03', dueDate: '2026-12-30', branchId: '', expLines: [{ accCode: '5111', net: 100, vat: 15 }], importBatch: 'xb1' }] })); });
  await p.waitForTimeout(300); await p.click('[data-xiopen]'); await p.waitForSelector('.modal input[aria-label="ملف الكشف"]', { state: 'attached' });
  const csv = 'رقم القيد,التاريخ,المورد,الرقم الضريبي,رقم فاتورة المورد,البيان,التصنيف,رمز حساب المدين,قبل الضريبة,ضريبة المدخلات,الإجمالي\nPUR-1,2026-01-02,مكين,311135091100003,F1,x,مصروف,5134,200,30,230\nPUR-2,2026-01-03,مكين,311135091100003,F2,x,منتجات (مخزون),5111,100,15,115\n';
  await p.setInputFiles('.modal input[aria-label="ملف الكشف"]', { name: 'كشف.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await p.waitForSelector('[data-xiclsnote]');
  assert.match(await p.locator('[data-ximap]').innerText(), /التصنيف/);
  assert.match(await p.locator('[data-xiclsnote]').innerText(), /5134 مصروفات.*5111 مشتريات|5111 مشتريات.*5134 مصروفات/);
  await p.click('[data-xiapplycls]'); await p.waitForTimeout(600);
  assert.deepEqual(await p.evaluate(() => window.curOrg.accCls), { 5134: 'exp', 5111: 'pur' });
  await p.locator('.modal button:has-text("إلغاء")').click(); await p.waitForTimeout(300);
  await p.click('[data-cf="pur"]'); await p.waitForTimeout(200);
  let t = (await p.locator('table.tb tbody').first().innerText()); assert.match(t, /F2/); assert.doesNotMatch(t, /F1/);
  await p.click('[data-cf="exp"]'); await p.waitForTimeout(200);
  t = (await p.locator('table.tb tbody').first().innerText()); assert.match(t, /F1/); assert.doesNotMatch(t, /F2/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.5 ربط Claude: إنشاء رابط يظهر مرة واحدة، قائمة الروابط، الإلغاء، وتنبيه حساب الخدمة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Admin/admin');
  let links = []; const posts = [];
  await p.route('http://zatca.test/api/mcp/**', async (route) => { const u = new URL(route.request().url()), m = route.request().method();
    if (m === 'GET') return route.fulfill({ json: { links } });
    const b = JSON.parse(route.request().postData() || '{}'); posts.push(u.pathname + ' ' + JSON.stringify(b));
    if (u.pathname.endsWith('/revoke')) { links = links.map(l => l.id === b.id ? { ...l, active: false } : l); return route.fulfill({ json: { ok: true } }); }
    links = [{ id: 'h1', label: b.label, email: 'own@x.sa', createdAt: '2026-11-23T08:00:00Z', active: true, calls: 0, hint: 'Zx9Q' }];
    return route.fulfill({ json: { id: 'h1', label: b.label, url: 'https://mithqal.onrender.com/mcp/mq_default_' + 'A'.repeat(39) + 'Zx9Q' } }); });
  await p.click('[data-tab-claude]'); await p.waitForSelector('[data-claudelink]');
  assert.match(await p.locator('[data-mcplinks]').innerText(), /لا روابط بعد/);
  await p.fill('input[aria-label="اسم الرابط"]', 'جوالي'); await p.click('[data-mcpnew]'); await p.waitForSelector('[data-mcpfresh]');
  assert.match(await p.locator('input[aria-label="رابط الربط"]').inputValue(), /\/mcp\/mq_default_.+Zx9Q$/);
  assert.match(await p.locator('[data-mcplinks]').innerText(), /جوالي[\s\S]*نشط/);
  await p.click('[data-mcprevoke]'); await p.waitForTimeout(400);
  assert.match(await p.locator('[data-mcplinks]').innerText(), /ملغى/); assert.equal(await p.locator('[data-mcpfresh]').count(), 0);
  assert.deepEqual(posts, ['/api/mcp/links {"label":"جوالي","branches":[]}', '/api/mcp/links/revoke {"id":"h1"}']);
  await p.unroute('http://zatca.test/api/mcp/**');
  await p.route('http://zatca.test/api/mcp/**', r => r.fulfill({ status: 409, json: { error: 'لم يُضبط حساب الخدمة', code: 'no-sa' } }));
  await p.click('[data-tab-claude]'); await p.click('button:has-text("صيانة النظام")'); await p.click('[data-tab-claude]'); await p.waitForSelector('[data-mcpnosa]');
  assert.deepEqual(errs.filter(e => !/409|Failed to load resource/.test(e)), []); await ctx.close();
});

test('v53.7 مقترحات Claude: اعتماد قيد وإعادة تصنيف بالحفظ العادي، والرفض بسبب', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.evaluate(() => window.setOps(o => ({ ...o, invoices: [{ id: 'rc1', kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: 'R-1', amount: 115, vatAmt: 15, date: '2026-10-02', dueDate: '2026-12-30', branchId: '', jeNo: 'PJ-000009', expLines: [{ accCode: '5198', net: 100, vat: 15 }] }, ...(o.invoices || [])] })));
  const P = [
    { id: 'mp-20261123-aaaaaaaaaa', kind: 'journal', status: 'pending', title: 'إيجار أكتوبر', reason: 'عقد', by: 'own@x.sa', createdAt: '2026-11-23T10:00:00Z',
      payload: { date: '2026-10-31', title: 'إيجار أكتوبر', lines: [{ code: '5198', debit: 500, credit: 0 }, { code: '1101', debit: 0, credit: 500 }] }, summary: { date: '2026-10-31', branch: 'المركز الرئيسي', total: 500, lines: [] } },
    { id: 'mp-20261123-bbbbbbbbbb', kind: 'reclass', status: 'pending', title: 'إعادة تصنيف 1 فاتورة', by: 'own@x.sa', createdAt: '2026-11-23T10:01:00Z',
      payload: { changes: [{ id: 'rc1', from: '5198', to: '5199' }] }, summary: { count: 1, total: 115, groups: [{ from: '5198', to: '5199', count: 1, total: 115 }] } },
    { id: 'mp-20261123-cccccccccc', kind: 'journal', status: 'pending', title: 'قيد مرفوض', by: 'own@x.sa', createdAt: '2026-11-23T10:02:00Z', payload: { date: '2026-10-31', title: 'x', lines: [] }, summary: { total: 1 } }];
  const decided = [];
  await p.route('http://zatca.test/api/mcp/**', async (route) => { const u = new URL(route.request().url());
    if (u.pathname.endsWith('/links')) return route.fulfill({ json: { links: [] } });
    if (u.pathname.endsWith('/proposals')) return route.fulfill({ json: { proposals: P } });
    const b = JSON.parse(route.request().postData()); decided.push(b.id + ' ' + b.decision); const x = P.find(q => q.id === b.id); x.status = b.decision; x.note = b.note; return route.fulfill({ json: { ok: true } }); });
  await p.evaluate(() => { window.prompt = () => 'لا حاجة له'; });
  await p.click('[data-tab-claude]'); await p.waitForSelector('[data-mcppend]');
  assert.match(await p.locator('[data-mcppend]').innerText(), /3 بانتظار/);
  await p.locator('[data-mcpprop="journal"] [data-mcpapprove]').first().click(); await p.waitForTimeout(600);
  const jm = await p.evaluate(() => (window.cur.journalManual || []).find(j => j.mcpProposal === 'mp-20261123-aaaaaaaaaa'));
  assert.ok(jm, 'القيد حُفظ'); assert.equal(jm.status, 'posted'); assert.match(jm.title, /^Claude: إيجار أكتوبر/);
  await p.locator('[data-mcpprop="reclass"] [data-mcpapprove]').click(); await p.waitForTimeout(600);
  const inv = await p.evaluate(() => window.cur.invoices.find(i => i.id === 'rc1'));
  assert.equal(inv.expLines[0].accCode, '5199'); assert.equal(inv.reclass[0].via, 'claude'); assert.equal(inv.reclass[0].from, '5198');
  await p.locator('[data-mcpprop="journal"] [data-mcpreject]').click(); await p.waitForTimeout(500);
  assert.deepEqual(decided, ['mp-20261123-aaaaaaaaaa applied', 'mp-20261123-bbbbbbbbbb applied', 'mp-20261123-cccccccccc rejected']);
  assert.equal(P[2].note, 'لا حاجة له'); assert.equal(await p.locator('[data-mcppend]').count(), 0);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v53.9 قائمة الدخل في مركز التقارير: من الدفاتر تلقائيًا حين لا إغلاقات، وفتح قيود الحساب، والاستعراض بالمؤشر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Hub/admin/reporting:reports');
  await p.evaluate(() => window.setOps(o => ({ ...o, closings: [], invoices: [{ id: 'gp1', kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: 'G-1', amount: 1150, vatAmt: 150, taxable: true, date: '2025-03-02', dueDate: '2025-03-02', branchId: '', jeNo: 'PJ-000077', expLines: [{ accCode: '5198', net: 1000, vat: 150 }] }] })));
  await p.locator('button:has-text("قائمة الدخل (يومي/شهري/سنوي)")').click();
  await p.locator('button:text-is("سنوي")').click(); await p.selectOption('select.sel:has(option[value="2025"]):visible', '2025'); await p.waitForTimeout(400);
  await p.waitForSelector('[data-glpnl]'); assert.equal(await p.locator('[data-pnlauto]').count(), 1);
  assert.match(await p.locator('[data-glpnl]').innerText(), /1,000\.00/); assert.equal(await p.locator('[data-nosales]').count(), 1);
  await p.locator('[data-doclink]:has-text("5198")').hover(); await p.waitForSelector('[data-peek]', { timeout: 3000 });
  assert.match(await p.locator('.modal').innerText(), /قيود الحساب 5198 \(1\)/);
  await p.keyboard.press('Escape'); await p.locator('.modal button:has-text("إغلاق")').click().catch(() => {});
  await p.click('[data-src="closing"]'); assert.equal(await p.locator('[data-glpnl]').count(), 0);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.0 التحليل المالي المتقدم: اكتمال البيانات، نسب متتبَّعة بمعادلتها، ورفض النسبة عند نقص البيانات', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1400 } }, 'live/Hub/admin/analytics:finintel');
  const J = (id, date, lines, extra = {}) => ({ id, date, title: id, status: 'posted', lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })), ...extra });
  await p.evaluate((jm) => window.setOps(o => ({ ...o, closings: [], invoices: [], salesInvoices: [], journalManual: jm })), [
    J('open', '2023-12-31', [['1101', 100000, 0], ['3101', 0, 100000]], { opening: true }), J('sale', '2024-02-10', [['1101', 50000, 0], ['4101', 0, 50000]]),
    J('purch', '2024-02-11', [['5198', 20000, 0], ['2101', 0, 20000]]), J('sal', '2024-02-12', [['5201', 10000, 0], ['1101', 0, 10000]])]);
  await p.waitForSelector('[data-finintel]');
  await p.fill('input[aria-label="من"]', '2024-01-01'); await p.fill('input[aria-label="إلى"]', '2024-03-31'); await p.waitForTimeout(400);
  assert.equal(await p.locator('[data-faqc="sales:1"]').count(), 1);
  assert.equal((await p.locator('[data-ratio="gm"] [data-val]').innerText()).trim(), '60%');
  await p.locator('[data-ratio="gm"] [data-why]').click();
  assert.match(await p.locator('[data-ratiox="gm"]').innerText(), /مجمل الربح ÷ صافي المبيعات[\s\S]*2024-01-01/);
  await p.fill('input[aria-label="من"]', '2024-06-01'); await p.fill('input[aria-label="إلى"]', '2024-06-30'); await p.waitForTimeout(400);
  assert.equal(await p.locator('[data-faqc="sales:0"]').count(), 1);
  assert.match(await p.locator('[data-ratio="gm"]').innerText(), /بيانات ناقصة/); assert.equal((await p.locator('[data-ratio="gm"] [data-val]').innerText()).trim(), '—');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.1 سجل حالات الرقابة: الفحص يكتشف ويسجّل دون تكرار، الإسناد، دورة الحياة، وإعادة التحقق', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1400 } }, 'live/Hub/admin/analytics:cases');
  const inv = (id, x) => ({ id, kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: id, amount: 115, vatAmt: 15, taxable: true, date: '2024-02-01', dueDate: '2024-02-01', expLines: [{ accCode: '5198', net: 100, vat: 15 }], ...x });
  await p.evaluate((L) => { window.setOrg(g => ({ ...g, suppliers: [{ id: 's1', name: 'مكين', vatNo: '311135091100003' }] })); window.setOps(o => ({ ...o, closings: [], ctlCases: [], journalManual: [], invoices: L })); },
    [inv('A1'), inv('A1b', { invoiceNo: 'A1' })]);
  await p.waitForSelector('[data-ctlsync]'); await p.waitForTimeout(300);
  await p.click('[data-ctlsync]'); await p.waitForTimeout(600);
  let cs = await p.evaluate(() => window.cur.ctlCases); const dup = cs.find(c => c.cat === 'dup_invoice'); assert.ok(dup); assert.match(dup.no, /^CASE-/);
  const n1 = cs.length; await p.click('[data-ctlsync]'); await p.waitForTimeout(500); assert.equal((await p.evaluate(() => window.cur.ctlCases)).length, n1, 'لا تكرار');
  await p.locator('[data-case="dup_invoice"]').click(); await p.fill('[data-casex] input[aria-label="المسؤول"]', 'المحاسب'); await p.click('[data-caseassign]'); await p.waitForTimeout(400);
  cs = await p.evaluate(() => window.cur.ctlCases); assert.equal(cs.find(c => c.cat === 'dup_invoice').status, 'assigned'); assert.equal(cs.find(c => c.cat === 'dup_invoice').owner, 'المحاسب');
  await p.click('[data-casemove="review"]'); await p.waitForTimeout(300);
  await p.fill('[data-casex] input[aria-label="ملاحظة القرار"]', 'أُصدر إشعار دائن'); await p.click('[data-casemove="resolved"]'); await p.waitForTimeout(300);
  await p.evaluate(() => window.setOps(o => ({ ...o, invoices: o.invoices.filter(i => i.id !== 'A1b') }))); await p.waitForTimeout(300);
  await p.click('[data-ctlsync]'); await p.waitForTimeout(500);
  cs = await p.evaluate(() => window.cur.ctlCases); const d2 = cs.find(c => c.cat === 'dup_invoice'); assert.equal(d2.status, 'verified'); assert.equal(d2.verify.result, 'pass');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.2 التوصيات المالية: توصية بدليل وطريقة حساب، تبنّيها إجراءً بلا تكرار، والمتوقع منفصل عن الفعلي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1400 } }, 'live/Hub/admin/analytics:recs');
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
  await p.evaluate((L) => { window.setOrg(g => ({ ...g, suppliers: [{ id: 's1', name: 'مكين', vatNo: '311135091100003' }] })); window.setOps(o => ({ ...o, actions: [], journalManual: [], invoices: L })); },
    [{ id: 'r1', kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: 'R1', amount: 90000, vatAmt: 0, date: d(5), dueDate: d(5), expLines: [{ accCode: '5198', net: 90000, vat: 0 }] }]);
  await p.waitForSelector('[data-rec="supplier_concentration"]');
  assert.match(await p.locator('[data-rec="supplier_concentration"]').innerText(), /مكين[\s\S]*الدليل[\s\S]*الأثر المتوقع[\s\S]*تقدير لا نتيجة/);
  await p.click('[data-rec="supplier_concentration"] [data-recadopt]'); await p.waitForTimeout(500);
  const acts = await p.evaluate(() => window.cur.actions); assert.equal(acts.length, 1); assert.equal(acts[0].src, 'rec'); assert.equal(acts[0].approval, 'approved'); assert.ok(acts[0].expected.amount > 0);
  assert.equal(await p.locator('[data-rec="supplier_concentration"] [data-recadopted]').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
  const B = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Hub/admin/analytics:actions');
  await B.p.evaluate((A) => window.setOps(o => ({ ...o, actions: A })), acts); await B.p.waitForSelector('[data-actrec]');
  assert.match(await B.p.locator('[data-actrec]').innerText(), /معتمدة[\s\S]*المتوقع[\s\S]*الفعلي: بعد الإنجاز/);
  assert.deepEqual(B.errs, []); await B.ctx.close();
});

test('v54.3 لوحة المدير المالي: درجات بمنهجيتها، تنقيب الفرع ← الحساب ← القيود، والتوقع بمنهجية معلنة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1600 } }, 'live/Hub/admin/analytics:cfo');
  const J = (id, date, lines, extra = {}) => ({ id, date, title: id, status: 'posted', lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })), ...extra });
  const bid = await p.evaluate(() => ((window.curOrg.branches || [])[0] || {}).id);
  await p.evaluate((jm) => window.setOps(o => ({ ...o, closings: [], invoices: [], ctlCases: [], actions: [], journalManual: jm })), [
    J('open', '2023-12-31', [['1101', 50000, 0], ['3101', 0, 50000]], { opening: true }), J('s1', '2024-03-10', [['1101', 20000, 0], ['4101', 0, 20000]], { branchId: bid }), J('c1', '2024-03-11', [['5198', 8000, 0], ['1101', 0, 8000]], { branchId: bid })]);
  await p.waitForSelector('[data-cfodash]'); await p.fill('input[aria-label="من"]', '2024-01-01'); await p.fill('input[aria-label="إلى"]', '2024-12-31'); await p.waitForTimeout(500);
  await p.locator('[data-score="profit"] button').click(); assert.match(await p.locator('[data-scorewhy]').innerText(), /هامش صافي الربح/);
  await p.click('[data-br="' + bid + '"]'); await p.waitForSelector('[data-cfoacc]'); assert.match(await p.locator('[data-cfoacc]').innerText(), /4101[\s\S]*5198/);
  await p.locator('[data-cfoacc] [data-doclink]:has-text("5198")').click(); await p.waitForSelector('[data-peek]'); assert.match(await p.locator('.modal').innerText(), /قيود الحساب 5198/);
  assert.match(await p.locator('[data-cfofc]').innerText(), /ليس نتيجة مؤكدة[\s\S]*المنهجية/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.4 مكتبة المراجع: رفع نص بحقول الإصدار والنفاذ، بحث بالاستشهاد بالصفحة والحجية والتوثيق', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1400 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const docs = [{ id: 'rf-1', title: 'IFRS 15 الإيراد', cat: 'ifrs', authority: 'official', family: 'IFRS 15', version: '2024', effFrom: '2018-01-01', pages: 3, status: 'active', verified: false }];
  const posts = [];
  await ctx.route('http://zatca.test/api/refs**', async (r) => { const u = new URL(r.request().url()), m = r.request().method(); const J = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (m === 'POST') posts.push(u.pathname + ' ' + r.request().postData());
    if (u.pathname.endsWith('/search')) return J({ note: 'نتائج من المراجع المرفوعة فقط', hits: [{ doc: 'rf-1', title: 'IFRS 15 الإيراد', family: 'IFRS 15', version: '2024', authority: 'official', authorityLabel: 'متطلب رسمي', verified: false, status: 'active', page: 2, para: 3, score: 4, excerpt: 'تعترف المنشأة بالإيراد عند الوفاء بالتزام الأداء' }] });
    if (u.pathname.endsWith('/upload')) return J({ job: 'j1' });
    if (u.pathname.includes('/job/')) return J({ state: 'done', pages: 1 });
    if (u.pathname.endsWith('/update')) { docs[0].verified = true; return J({ ok: true }); }
    return J({ docs, cats: { ifrs: 'معايير IFRS', policy: 'سياسة داخلية' }, auth: { official: 'متطلب رسمي', internal: 'سياسة داخلية' } }); });
  await p.goto(base + 'live/Hub/admin/analytics:refs'); await settle(p); await p.waitForSelector('[data-reflib]');
  assert.match(await p.locator('[data-reflist]').innerText(), /IFRS 15 الإيراد[\s\S]*غير موثّق/);
  await p.fill('input[aria-label="بحث المراجع"]', 'الاعتراف بالإيراد'); await p.click('[data-refsearch]'); await p.waitForSelector('[data-refhit]');
  const h = await p.locator('[data-refhit]').innerText(); assert.match(h, /ص 2 · مقطع 3/); assert.match(h, /متطلب رسمي/); assert.match(h, /غير موثّق/); assert.match(h, /التزام الأداء/);
  await p.setInputFiles('input[aria-label="ملف المرجع"]', { name: 'policy.txt', mimeType: 'text/plain', buffer: Buffer.from('سياسة الاعتراف بالإيراد\n\nفقرة ثانية') });
  await p.fill('input[aria-label="العنوان"]', 'سياسة الإيراد'); await p.selectOption('select[aria-label="حجية الرفع"]', 'internal');
  await p.click('[data-refupload]'); await p.waitForFunction(() => /أُضيف المرجع/.test(window.lastSay || ''), null, { timeout: 10000 });
  const up = posts.find(x => x.startsWith('/api/refs/upload')); assert.ok(up && /"authority":"internal"/.test(up) && /فقرة ثانية/.test(up) && /"page":1/.test(up), up);
  await p.click('[data-refverify]'); await p.waitForFunction(() => /حُدّث/.test(window.lastSay || ''));
  assert.ok(posts.some(x => x.startsWith('/api/refs/update') && /"verify":true/.test(x)));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.5 وكيل المراجعة: تحليل الحالة بالسند والحجية والثقة، حفظه في الحالة، والقيد التصحيحي مقترح بانتظار الاعتماد', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1500 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const posts = [];
  await ctx.route('http://zatca.test/api/**', async (r) => { const u = new URL(r.request().url()); const J = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) }); posts.push(u.pathname + ' ' + (r.request().postData() || ''));
    if (u.pathname === '/api/refs/review') { const c = JSON.parse(r.request().postData()).cases[0]; return J({ findings: [{ caseKey: c.key, caseNo: c.no, issue: c.title, category: c.cat, severity: c.sev, evidence: c.evidence, impact: 15, basis: 'requirement', basisLabel: 'متطلب رسمي (من نص مرفوع موثّق)',
      citations: [{ doc: 'd1', title: 'دليل الضريبة', version: '2024', page: 4, para: 2, quote: 'بنسبة 15% من قيمة التوريد', authorityLabel: 'متطلب رسمي منشور', verified: true }], analysis: 'الفاتورة مسجلة مرتين', correction: { text: 'عكس الفاتورة المكررة', lines: [{ code: '2101', debit: 115, credit: 0 }, { code: '5198', debit: 0, credit: 115 }], total: 115 },
      confidence: 'medium', approval: 'required', at: '2026-11-24T10:00', model: 'claude-haiku-5-5', dropped: ['عبارة غير موجودة حرفيًا'] }] }); }
    if (u.pathname === '/api/mcp/proposals/review') return J({ proposal_id: 'mp-20261124-abc', status: 'pending' });
    return J({}); });
  await p.goto(base + 'live/Hub/admin/analytics:cases'); await settle(p);
  await p.evaluate(() => window.setOps(o => ({ ...o, ctlCases: [{ id: 'c1', no: 'CASE-000001', key: 'dup_invoice|A1', cat: 'dup_invoice', sev: 'high', status: 'new', title: 'فاتورة مكررة A1', evidence: 'A1 مرتين', fix: 'احذف المكرر', impact: 115, due: '2026-12-01', detectedAt: '2026-11-20', history: [] }] })));
  await p.waitForSelector('[data-case="dup_invoice"]'); await p.locator('[data-case="dup_invoice"]').click(); await p.waitForSelector('[data-casereview]');
  assert.match(await p.locator('[data-casereview]').innerText(), /لم تُراجع بعد/);
  await p.click('[data-casereviewrun]'); await p.waitForSelector('[data-revcites]');
  const t = await p.locator('[data-casereview]').innerText(); assert.match(t, /بنسبة 15% من قيمة التوريد[\s\S]*دليل الضريبة[\s\S]*ص 4/); assert.match(t, /متطلب رسمي/); assert.match(t, /متوسطة/); assert.match(t, /مطلوب اعتماد بشري/); assert.match(t, /أُسقط من الرد/);
  const cs = await p.evaluate(() => window.cur.ctlCases); assert.equal(cs[0].review.basis, 'requirement'); assert.match(cs[0].history.slice(-1)[0].note, /مراجعة بالمراجع/);
  await p.click('[data-revpropose]'); await p.waitForFunction(() => /بانتظار اعتماد/.test(window.lastSay || ''));
  assert.ok(posts.some(x => x.startsWith('/api/mcp/proposals/review') && /"caseNo":"CASE-000001"/.test(x) && /"2101"/.test(x)));
  assert.equal((await p.evaluate(() => window.cur.ctlCases))[0].review.proposal, 'mp-20261124-abc');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.6 الحوكمة: رابط Claude مقيّد بفرع، وسجل الذكاء الاصطناعي لمسؤول النظام', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let links = []; const posts = [];
  await ctx.route('http://zatca.test/api/**', async (r) => { const u = new URL(r.request().url()), m = r.request().method(); const J = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/api/ai/log') return J({ kinds: { mcp: 'موصل Claude', review: 'وكيل المراجعة' }, log: [{ id: '1', at: '2026-11-24T09:00:00Z', by: 'own@x.sa', kind: 'review', name: 'refs_review', ok: true, ms: 1200, detail: '3 حالة' }, { id: '2', at: '2026-11-24T08:00:00Z', by: 'own@x.sa', kind: 'mcp', name: 'trial_balance', ok: false, status: 500, ms: 40, detail: 'مهلة' }] });
    if (u.pathname === '/api/mcp/links' && m === 'POST') { const b = JSON.parse(r.request().postData()); posts.push(b); links = [{ id: 'h1', label: b.label, email: 'own@x.sa', active: true, calls: 0, hint: 'Q', branches: b.branches }]; return J({ id: 'h1', label: b.label, url: 'https://m/mcp/mq_default_x', branches: b.branches }); }
    if (u.pathname === '/api/mcp/links') return J({ links }); return J({ proposals: [] }); });
  await p.goto(base + 'live/Admin/admin'); await settle(p); await p.click('[data-tab-claude]'); await p.waitForSelector('[data-claudelink]');
  const bn = await p.evaluate(() => ((window.curOrg.branches || [])[0] || {})); await p.locator('[data-mcpscope] label', { hasText: bn.name }).locator('input').check();
  assert.match(await p.locator('[data-mcpscope]').innerText(), /مقيّد بالفروع المحددة/);
  await p.fill('input[aria-label="اسم الرابط"]', 'فرع واحد'); await p.click('[data-mcpnew]'); await p.waitForSelector('[data-mcpfresh]');
  assert.deepEqual(posts[0].branches, [bn.id]); assert.match(await p.locator('[data-mcplinks]').innerText(), new RegExp(bn.name));
  await p.waitForSelector('[data-ailogrow]'); const t = await p.locator('[data-ailog]').innerText(); assert.match(t, /وكيل المراجعة[\s\S]*refs_review[\s\S]*نجح/); assert.match(t, /فشل 500/);
  await p.selectOption('select[aria-label="نوع السجل"]', 'mcp'); assert.equal(await p.locator('[data-ailogrow]').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v54.8 نفاد رصيد Anthropic يظهر برسالة عربية واضحة في وكيل المراجعة', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1300 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('http://zatca.test/api/refs/review', r => r.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'رصيد Anthropic غير كافٍ — اشحنه من console.anthropic.com ← Plans & Billing ثم أعد المحاولة', code: 'no-credit' }) }));
  await p.goto(base + 'live/Hub/admin/analytics:cases'); await settle(p);
  await p.evaluate(() => window.setOps(o => ({ ...o, ctlCases: [{ id: 'c1', no: 'CASE-000001', key: 'k1', cat: 'dup_invoice', sev: 'high', status: 'new', title: 'مكررة', evidence: 'x', fix: 'y', impact: 1, due: '2026-12-01', detectedAt: '2026-11-20', history: [] }] })));
  await p.locator('[data-case="dup_invoice"]').click(); await p.click('[data-casereviewrun]');
  await p.waitForFunction(() => /رصيد Anthropic غير كافٍ/.test(window.lastSay || '')); assert.ok(!(await p.evaluate(() => window.cur.ctlCases[0].review)), 'لا نتيجة محفوظة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v55.0 الرئيسية «التطبيقات أولًا»: شريط علوي، أرقام اليوم، شارات المهام، ولوحة «مهامي» الجانبية', async () => {
  for (const [dev, opt] of [['لوحي', { viewport: { width: 1280, height: 860 } }], ['جوال', devices['iPhone 13']]]) {
    const { p, errs, ctx } = await open(opt, 'comp/Launcher');
    await p.waitForSelector('.lh-top'); assert.equal(await p.locator('[data-mywork]').count(), 0, 'لا بطاقة مهام كبيرة على الرئيسية');
    const topY = await p.locator('.lh-top').evaluate(e => e.getBoundingClientRect().bottom); const gridY = await p.locator('.lh-grid').last().evaluate(e => e.getBoundingClientRect().top);
    assert.ok(gridY < (dev === 'لوحي' ? 860 : 844), dev + ': التطبيقات تظهر في أول شاشة (' + Math.round(gridY) + ')'); assert.ok(gridY > topY);
    const tdy = await p.locator('[data-hometoday]').evaluate(e => e.getBoundingClientRect().top); assert.ok(tdy > gridY, 'ملخص اليوم بعد التطبيقات');
    const n = Number(await p.locator('[data-mywork-n]').innerText());
    await p.click('[data-tasksbtn]'); await p.waitForSelector('.lh-drawer [data-mywork-drawer]');
    assert.match(await p.locator('.lh-drawer').innerText(), /مهامي/);
    if (n > 0) assert.ok(await p.locator('.lh-drawer [data-mywork-item]').count() > 0);
    await p.click('.lh-drawer button[aria-label="إغلاق"]'); assert.equal(await p.locator('.lh-drawer').count(), 0);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(over <= 2, dev + ' تجاوز أفقي ' + over);
    assert.deepEqual(errs, []); await ctx.close();
  }
});

test('v56.0 GAP-018 العمل دون اتصال ثم المزامنة: فواتير بترقيم وسلسلة بصمة على الجهاز، تبقى بعد إعادة فتح الصفحة، وتُرفع مرة واحدة بلا تكرار', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/cs');
  await p.evaluate(() => {
    localStorage.removeItem('mizan:posQueue'); localStorage.removeItem('mizan:posShiftLocal');
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 100, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [], posShifts: [] }));
  }); await p.waitForTimeout(400);
  // انقطاع فعلي: المتصفح دون شبكة، والسحابة لا تقبل الحفظ
  await ctx.setOffline(true); await p.evaluate(() => { window.__cloudDown = true; });
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  const sell = async () => { await p.locator('.pos-tile:has-text("كبسة")').click(); await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
    await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(500); };
  await sell(); await sell(); await sell();
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]'));
  assert.equal(q.length, 3, 'ثلاث فواتير في طابور الجهاز');
  assert.equal(await p.evaluate(() => window.cur.posOrders.length), 0, 'لم يصل شيء للسحابة');
  assert.ok(await p.evaluate(() => window.__downTries > 0), 'حاول الرفع وفشل بصدق');
  assert.deepEqual(q.map(o => o.icv), [q[0].icv, q[0].icv + 1, q[0].icv + 2], 'عدّاد الفواتير متسلسل');
  assert.equal(q[1].pih, q[0].hash); assert.equal(q[2].pih, q[1].hash, 'كل فاتورة تحمل بصمة سابقتها');
  assert.equal(new Set(q.map(o => o.no)).size, 3, 'أرقام فريدة');
  // إعادة فتح التطبيق والسحابة ما زالت غير متاحة: الطابور باقٍ على الجهاز
  await ctx.setOffline(false); await ctx.addInitScript(() => { window.__cloudDown = true; });
  await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 100, cat: 'رئيسي' }] })); }); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]').length), 3, 'الطابور بعد إعادة الفتح');
  // تعارض: الفاتورة الأولى وصلت السحابة سابقًا وضاع الرد (أو رفعها تبويب آخر) — لا تُكرَّر
  await p.evaluate((first) => { window.setOps(o => ({ ...o, posOrders: [first], posShifts: [] })); }, q[0]); await p.waitForTimeout(200);
  await p.evaluate(() => { window.__cloudDown = false; window.dispatchEvent(new Event('online')); });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]').length === 0, null, { timeout: 8000 });
  const ids = await p.evaluate(() => window.cur.posOrders.map(o => o.id));
  assert.equal(ids.length, 3, 'ثلاث فواتير بالضبط'); assert.deepEqual(new Set(ids), new Set(q.map(o => o.id)), 'نفس الفواتير');
  assert.equal(await p.evaluate(() => window.cur.posOrders.reduce((s, o) => s + o.total, 0)), 300, 'المجموع 3 × 100');
  assert.ok(await p.evaluate(() => (window.cur.posShifts || []).length >= 1), 'الوردية المحلية رُفعت');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.0 GAP-007 تعليق فاتورة السفري واستدعاؤها: بلا رقم فاتورة قبل الدفع، تبقى بعد إعادة الفتح، وتُستدعى ثم تُدفع', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/cs');
  const setup = async () => { await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 100, cat: 'رئيسي' }, { id: 'm', name: 'مندي', sellPrice: 80, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [] })); }); await p.waitForTimeout(400);
    const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); } };
  await p.evaluate(() => { localStorage.removeItem('mizan:posHold:b1'); localStorage.removeItem('mizan:posQueue'); }); await setup();
  await p.locator('.pos-tile:has-text("كبسة")').click(); await p.locator('.pos-tile:has-text("كبسة")').click(); await p.locator('.pos-tile:has-text("مندي")').click();
  await p.click('[data-hold]'); await p.waitForTimeout(250);
  assert.match(await say(p), /عُلّق الطلب/);
  const held = await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posHold:b1') || '[]'));
  assert.equal(held.length, 1); assert.equal(held[0].cart.reduce((a, l) => a + l.qty, 0), 3);
  assert.equal(await p.evaluate(() => window.cur.posOrders.length), 0, 'لا فاتورة');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]').length), 0, 'لا رقم ولا عدّاد مستهلك');
  // عميل آخر يُخدم أثناء التعليق
  await p.locator('.pos-tile:has-text("مندي")').click(); await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(500);
  // إعادة فتح الصفحة: المعلّق باقٍ على الجهاز
  await p.reload(); await p.waitForTimeout(500); await settle(p); await setup();
  await p.click('[data-holdlist]'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-holds]').innerText(), /3 صنف/);
  // السعر تغيّر بعد التعليق: يُستدعى بالسعر الحالي
  await p.evaluate(() => window.setOrg(g => ({ ...g, products: g.products.map(x => x.id === 'k' ? { ...x, sellPrice: 110 } : x) }))); await p.waitForTimeout(250);
  await p.click('[data-holds] button:has-text("استدعاء")'); await p.waitForTimeout(300);
  assert.match(await say(p), /استُدعي الطلب[\s\S]*حُدّث سعر: كبسة/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posHold:b1') || '[]').length), 0, 'خرج من المعلّقة');
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")'); await p.waitForTimeout(600);
  const tot = await p.evaluate(() => window.cur.posOrders.map(o => o.total).sort((a, b) => a - b));
  assert.deepEqual(tot, [300], 'المعلّق دُفع بالسعر الحالي: 2×110 + 80 (سحابة الاختبار تبدأ فارغة بعد إعادة الفتح)');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.2 POS الدفعة 1 (B2): نقرتان على «تأكيد» مع كوبون محدود (انتظار حجز الكوبون) تُنشئان فاتورة واحدة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    localStorage.removeItem('mizan:posQueue');
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, loyaltyCfg: { enabled: true, earnPer: 10, ptValue: 0.5, minRedeem: 20, maxRedeemPct: 50 },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 50, cat: 'رئيسي' }], posPromos: [{ id: 'cp2', name: 'نقرتان', type: 'pct', value: 10, scope: 'all', code: 'TWICE', maxUses: 50, active: true }] }));
    window.setOps(o => ({ ...o, posTabs: [], posOrders: [], closings: o.closings.filter(c => c.branchId !== 'b1') }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click();
  if (!(await p.locator('input[aria-label="رمز الكوبون"]').count())) await p.click('button:has-text("+ كوبون")');
  await p.fill('input[aria-label="رمز الكوبون"]', 'twice'); await p.waitForTimeout(700);
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
  await p.locator('.modal').getByRole('button', { name: 'تأكيد', exact: true }).dblclick(); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => [...(window.cur.posOrders || []), ...JSON.parse(localStorage.getItem('mizan:posQueue') || '[]')].filter((o, i, a) => a.findIndex(x => x.id === o.id) === i).length);
  assert.equal(n, 1, 'فاتورة واحدة رغم النقرتين');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.2 POS الدفعة 1 (B4): مسح ترقيم الجهاز لا يكرر رقم الفاتورة ولا يكسر سلسلة البصمات', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/cs');
  await p.evaluate(() => {
    localStorage.removeItem('mizan:posQueue'); localStorage.removeItem('mizan:posShiftLocal');
    window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, products: [{ id: 'k', name: 'كبسة', sellPrice: 100, cat: 'رئيسي' }] }));
    window.setOps(o => ({ ...o, posOrders: [], posShifts: [] }));
  }); await p.waitForTimeout(400);
  await ctx.setOffline(true); await p.evaluate(() => { window.__cloudDown = true; });   // الفواتير تبقى في طابور الجهاز للفحص
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  const sell = async () => { await p.locator('.pos-tile:has-text("كبسة")').click(); await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200);
    await p.locator('.modal').getByRole('button', { name: 'تأكيد', exact: true }).click(); await p.waitForTimeout(600); };
  await sell();
  // فقد ترقيم الجهاز (مسح جزئي للتخزين): الرقم التالي يُستكمل من الفواتير المعروفة
  await p.evaluate(() => { Object.keys(localStorage).filter(k => /posSeq|posHash/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await sell();
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem('mizan:posQueue') || '[]'));
  assert.equal(q.length, 2); assert.notEqual(q[1].no, q[0].no, 'رقم فاتورة غير مكرر');
  assert.equal(q[1].icv, q[0].icv + 1, 'العدّاد يكمل'); assert.equal(q[1].pih, q[0].hash, 'السلسلة لا تنكسر');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.0 هوية المنشأة: رفع شعار شفاف، الألوان والاسمان والتذييل، معاينة حيّة بالمحرك نفسه، حفظ بسجل تدقيق، عرض فقط لغير المسؤول، واستعادة الافتراضي', async () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mNk+M9QzwAEjDAGNzYAAA2nAf9ex9uYAAAAAElFTkSuQmCC', 'base64');
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/TenantBranding/admin');
    const card = p.locator('[data-tenant-branding]');
    assert.match(await card.innerText(), /هوية المنصة \(MUKTASAB\) ثابتة/);
    await card.locator('[data-tb="nameAr"]').fill('مطاعم الواحة'); await card.locator('[data-tb="nameEn"]').fill('Oasis Restaurants');
    await card.locator('[data-tb-file="logo"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(300);
    assert.match(await card.locator('[data-tb-logo="logo"] img').getAttribute('src'), /^data:image\/png;base64,/, 'الشعار PNG (الشفافية محفوظة)');
    await card.locator('[data-tb-file="logoAlt"]').setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: PNG }); await p.waitForTimeout(200);
    assert.match(await say(p), /PNG أو JPG أو WebP أو SVG/, 'صيغة مرفوضة');
    await card.locator('[data-tb-color="primary"]').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '#0b6e4f'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await card.locator('[data-tb="footer"]').fill('شكرًا لتعاملكم مع الواحة'); await p.waitForTimeout(300);
    const pv = await card.locator('[data-tb-preview]').getAttribute('srcdoc');
    assert.ok(pv.includes('مطاعم الواحة') && pv.includes('Oasis Restaurants') && pv.includes('--tb-p:#0B6E4F') && pv.includes('شكرًا لتعاملكم مع الواحة'), 'المعاينة من المحرك بهوية المنشأة');
    assert.doesNotMatch(pv, /#10294A/i, 'لا ألوان المنصة في مستند المنشأة');
    await card.locator('button:has-text("English")').click(); await p.waitForTimeout(250);
    assert.match(await card.locator('[data-tb-preview]').getAttribute('srcdoc'), /dir="ltr"[\s\S]*Oasis Restaurants/);
    await card.locator('[data-tb-save]').click(); await p.waitForTimeout(300);
    const b = await p.evaluate(() => window.curOrg.branding);
    assert.equal(b.nameEn, 'Oasis Restaurants'); assert.equal(b.colors.primary, '#0B6E4F'); assert.match(b.logo, /^data:image\/png/); assert.equal(b.logoAlt, '');
    assert.equal((await p.evaluate(() => window.__orgLog || [])).filter(l => l.targetType === 'tenant_branding').length, 1, 'قيد تدقيق');
    await card.locator('[data-tb-reset]').click(); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.curOrg.branding), undefined, 'عادت للافتراضي');
    assert.deepEqual(errs, []); await ctx.close(); }
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/TenantBranding/acc');
    assert.equal(await p.locator('[data-tb-readonly]').count(), 1, 'المحاسب للعرض فقط');
    assert.equal(await p.locator('[data-tb-save]').count(), 0); assert.equal(await p.locator('[data-tb="nameAr"]').isDisabled(), true);
    assert.deepEqual(errs, []); await ctx.close(); }
});

// ===== v56.5 — تجربة الدخول الفاخرة: كل التفاعلات مربوطة بدالة الدخول نفسها، بلا تجاوز للمصادقة =====
const SHOTS = path.join(cache, 'shots'); const shot = async (p, n) => { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.jpg'), type: 'jpeg', quality: 72, fullPage: true }); };
const gateState = (p) => p.evaluate(() => ({ calls: (window.__gate || {}).calls || [], mfa: (window.__gate || {}).mfaCalls || [],
  err: document.querySelector('.mq-err')?.innerText || '', btn: document.querySelector('.mq-btn')?.innerText || '', note: document.querySelector('.mq-note')?.innerText || '',
  // dir = الاتجاه المعروض فعلًا لا السمة
  dir: getComputedStyle(document.querySelector('.mq-card') || document.body).direction, over: document.documentElement.scrollWidth - window.innerWidth,
  card: (() => { const r = document.querySelector('.mq-card')?.getBoundingClientRect(); return r ? { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) } : null; })(),
  cover: Math.round(document.querySelector('.gate-cover')?.getBoundingClientRect().width || 0), vw: window.innerWidth }));
/** البطاقة كاملة داخل الشاشة (لا قص خفي خلف overflow) وآخر زر يصل إليه المستخدم */
const fitsGate = async (p, label) => { const s = await gateState(p);
  assert.ok(s.card && s.card.l >= 0 && s.card.r <= s.vw + 1, label + ': البطاقة خارج الشاشة ' + JSON.stringify(s.card) + ' عرض ' + s.vw);
  // تمرير حقيقي بعجلة الفأرة فوق البطاقة (لا scrollIntoView البرمجي) حتى يظهر زر الإعداد الأول
  const vh = await p.evaluate(() => window.innerHeight); const c = await p.locator('.mq-card').boundingBox();
  await p.mouse.move(Math.max(5, c.x + 10), Math.min(vh - 5, Math.max(5, c.y + 10)));
  let b; for (let k = 0; k < 12; k++) { b = await p.locator('.mq-setup').boundingBox(); if (b && b.y >= 0 && b.y + b.height <= vh + 1) break; await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }
  assert.ok(b && b.y >= 0 && b.y + b.height <= vh + 1, label + ': زر الإعداد الأول لا يُبلغ بالتمرير ' + JSON.stringify(b));
  // الخلفية تغطي البطاقة حتى نهاية منطقة التمرير (لا شريط فارغ أسفلها)
  const g = await p.evaluate(() => { const root = document.querySelector('.mq-root'); const t = root.scrollTop, r0 = root.getBoundingClientRect().top; const y = (q) => Math.round(document.querySelector(q).getBoundingClientRect().bottom - r0 + t);
    return { gate: y('.mq-login'), card: y('.mq-card'), scroll: root.scrollHeight }; });
  assert.ok(g.gate >= g.card && g.gate >= g.scroll - 2, label + ': الخلفية لا تغطي الصفحة ' + JSON.stringify(g));
  await p.evaluate(() => { document.querySelector('.mq-root').scrollTop = 0; }); return s; };

test('v56.5 الدخول: التحقق من المدخلات، كلمة سر خاطئة، إظهار/إخفاء، تذكّرني، نسيت كلمة السر، نجاح حقيقي فقط', { timeout: 120000 }, async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1440, height: 900 } }, 'gate');
  await p.waitForSelector('#mq-email'); await shot(p, 'login-desktop-ar');
  const cover0 = (await fitsGate(p, 'سطح المكتب')).cover; assert.ok(cover0 > 500, 'الغلاف ' + cover0);
  // فارغ ⇒ رسالة واضحة دون استدعاء الدخول
  await p.click('.mq-btn'); let s = await gateState(p);
  assert.match(s.err, /اكتب بريدك الإلكتروني/); assert.equal(s.calls.length, 0, 'لا استدعاء بلا بيانات');
  // بريد بصيغة خاطئة ⇒ تلميح عند مغادرة الحقل
  await p.fill('#mq-email', 'bad@'); await p.click('#mq-pass');
  assert.equal(await p.getAttribute('#mq-email', 'aria-invalid'), 'true');
  assert.ok(await p.isVisible('#mq-email-h'));
  // إظهار/إخفاء كلمة السر
  await p.fill('#mq-pass', 'Wrong999');
  assert.equal(await p.getAttribute('#mq-pass', 'type'), 'password');
  await p.click('.mq-eye'); assert.equal(await p.getAttribute('#mq-pass', 'type'), 'text'); assert.equal(await p.getAttribute('.mq-eye', 'aria-pressed'), 'true');
  await p.click('.mq-eye'); assert.equal(await p.getAttribute('#mq-pass', 'type'), 'password');
  // كلمة سر خاطئة ⇒ دالة الدخول تُستدعى مرة واحدة والخطأ يظهر ولا نجاح
  await p.fill('#mq-email', 'own@x.sa');
  const t0 = await p.evaluate(() => performance.now()); await p.click('.mq-btn');
  await p.waitForSelector('.mq-err'); s = await gateState(p);
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].email, 'own@x.sa'); assert.equal(s.calls[0].pass, 'Wrong999');
  assert.ok(s.calls[0].t - t0 < 150, 'الحركة لا تؤخر الدخول: ' + Math.round(s.calls[0].t - t0) + 'ms');
  assert.match(s.err, /كلمة السر غير صحيحة/); assert.doesNotMatch(s.btn, /تم الدخول/);
  await p.waitForTimeout(700); await shot(p, 'login-error-ar');
  assert.ok(Math.abs((await fitsGate(p, 'بعد الخطأ')).cover - cover0) <= 2, 'ظهور الخطأ لا يغيّر التخطيط');
  // Enter يرسل النموذج
  await p.fill('#mq-pass', 'Wrong888'); await p.press('#mq-pass', 'Enter'); await p.waitForTimeout(300);
  assert.equal((await gateState(p)).calls.length, 2);
  // تذكّرني: الإلغاء يمسح البريد المحفوظ ولا يُحفظ لاحقًا
  await p.evaluate(() => localStorage.setItem('rms8:lastEmail', 'own@x.sa'));
  await p.click('.mq-check input');
  assert.deepEqual(await p.evaluate(() => [localStorage.getItem('rms8:noRemember'), localStorage.getItem('rms8:lastEmail')]), ['1', null]);
  await p.click('.mq-check input'); assert.equal(await p.evaluate(() => localStorage.getItem('rms8:noRemember')), null);
  // نسيت كلمة السر: رسالة محايدة لا تكشف وجود البريد
  await p.click('.mq-link'); await p.waitForSelector('.mq-note'); assert.match((await gateState(p)).note, /إن كان البريد مسجّلًا/);
  // كلمة السر الصحيحة ⇒ نجاح من دالة الدخول نفسها + علامة الترحيب
  await p.fill('#mq-pass', 'Right1234'); await p.click('.mq-btn');
  await p.waitForFunction(() => /تم الدخول/.test(document.querySelector('.mq-btn')?.innerText || ''));
  s = await gateState(p); assert.equal(s.calls.at(-1).pass, 'Right1234');
  assert.ok(await p.evaluate(() => Number(sessionStorage.getItem('mq:welcome')) > 0));
  await shot(p, 'login-success-ar');
  // لا كلمة سر في التخزين المحلي
  assert.ok(!(await p.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).includes('Right1234'));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.5 الدخول: التحقق بخطوتين يُرسل تلقائيًا ولا ينجح إلا بالرمز الصحيح، وإشعار انتهاء الجلسة', { timeout: 60000 }, async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'gate/mfa/expired');
  assert.match(await p.innerText('.mq-notice'), /انتهت جلستك/);
  await p.fill('#mq-email', 'own@x.sa'); await p.fill('#mq-pass', 'Right1234'); await p.click('.mq-btn');
  await p.waitForSelector('#mq-otp'); await shot(p, 'login-mfa-ar');
  await p.fill('#mq-otp', '111111'); await p.waitForSelector('.mq-err');
  assert.equal(await p.inputValue('#mq-otp'), '', 'الحقل يُفرَّغ بعد رمز خاطئ');
  await p.fill('#mq-otp', '123456'); await p.waitForFunction(() => /تم التحقق/.test(document.querySelector('.mq-btn')?.innerText || ''));
  assert.deepEqual((await gateState(p)).mfa, ['111111', '123456']);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.5 الدخول: الجوال بلا تجاوز وأهداف لمس ≥ 44px، والإنجليزية LTR مع زر اللغة، وتقليل الحركة', { timeout: 90000 }, async () => {
  const m = await open(devices['iPhone 13'], 'gate');
  let s = await fitsGate(m.p, 'الجوال'); assert.ok(s.over <= 2, 'تجاوز أفقي ' + s.over);
  const sizes = await m.p.evaluate(() => ['.mq-input', '.mq-btn', '.mq-eye', '.mq-lang'].map(q => Math.round(document.querySelector(q).getBoundingClientRect().height)));
  sizes.forEach((h, i) => assert.ok(h >= 34 && (i === 3 || h >= 42), 'ارتفاع ' + ['الحقل', 'الزر', 'العين', 'اللغة'][i] + ' ' + h));
  await shot(m.p, 'login-mobile-ar');
  // زر اللغة ⇒ LTR وترجمة
  await m.p.click('.mq-lang'); await m.p.waitForTimeout(400);
  s = await gateState(m.p); assert.equal(s.dir, 'ltr');
  assert.match(await m.p.innerText('label[for="mq-email"]'), /Email/i);
  assert.ok(s.over <= 2); await fitsGate(m.p, 'الجوال EN'); await shot(m.p, 'login-mobile-en');
  assert.deepEqual(m.errs, []); await m.ctx.close();
  // تقليل الحركة: لا حركة على البطاقة ولا لوحة جسيمات تُرسم
  const r = await open({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, 'gate');
  const anim = await r.p.evaluate(() => [getComputedStyle(document.querySelector('.mq-pane')).animationName, getComputedStyle(document.querySelector('.mq-login .bhead-logo')).animationName]);
  assert.deepEqual(anim, ['none', 'none']);
  assert.deepEqual(r.errs, []); await r.ctx.close();
  // سطح المكتب بالإنجليزية للصورة المرجعية
  const d = await open({ viewport: { width: 1440, height: 900 } }, 'gate'); assert.equal((await gateState(d.p)).dir, 'rtl');
  await d.p.click('.mq-lang'); await d.p.waitForTimeout(400); assert.equal((await gateState(d.p)).dir, 'ltr');
  // الحقل والزر يبدآن من اليسار في الإنجليزية
  const x = await d.p.evaluate(() => { const c = document.querySelector('.mq-card').getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(document.querySelector('label[for="mq-email"]')); const l = rg.getBoundingClientRect(); return [Math.round(l.left - c.left), Math.round(c.right - l.right)]; });
  assert.ok(x[0] < x[1], 'نص تسمية البريد على اليسار في الإنجليزية ' + x);
  await shot(d.p, 'login-desktop-en'); await d.ctx.close();
});

test('v56.7 C4 التطابق التام بالهللات: معطّل افتراضيًا، يكشف القيد قبل التفعيل، ويفعّله المدير ويوقفه', async () => {
  const ctx = await browser.newContext(devices['iPad (gen 7)']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [...(o.journalManual || []),
    { id: 'jh', date: '2026-03-06', title: 'قيد بكسر', lines: [{ code: '5901', debit: 10.005, credit: 0 }, { code: '1201', debit: 0, credit: 10 }] }] })));
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('[data-finstrict]');
  assert.match(await card.innerText(), /غير مفعّل/);
  assert.match(await card.innerText(), /لا يتطابق بالهللة/, 'الأثر ظاهر قبل التفعيل');
  assert.match(await card.innerText(), /قيد بكسر/);
  await card.scrollIntoViewIfNeeded(); await shot(p, 'finstrict-off');
  await card.locator('button:has-text("تفعيل التطابق التام")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.finStrict || {}).on), true);
  assert.match(await card.innerText(), /مفعّل/);
  await card.locator('button:has-text("إيقاف التطابق التام")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.finStrict || {}).on), false, 'الإيقاف متاح للتراجع');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('عائد التسويق: ربط الحملة بحساب مصروف خاص بها يعرض التكلفة الفعلية والعائد على المبيعات المنسوبة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { const td = new Date(); td.setHours(12); const d = td.toISOString().slice(0, 10);
    window.setOrg(g => ({ ...g, posPromos: [{ id: 'cw', name: 'عودة', type: 'pct', value: 10, scope: 'all', code: 'BACK10', active: true }] }));
    window.setOps(o => ({ ...o, posOrders: [{ id: 'o1', date: d, branchId: 'b1', coupon: 'BACK10', total: 230, vat: 30, net: 200, lines: [{ promoId: 'cw', disc: 10 }] }],
      journalManual: [...(o.journalManual || []), { id: 'jm1', date: d, title: 'إعلانات', lines: [{ code: '5901', debit: 100, credit: 0 }, { code: '1201', debit: 0, credit: 100 }] }],
      mktCampaigns: [{ id: 'k1', no: 'CMP-0001', name: 'حملة الشتاء', segment: 'all', promoIds: ['cw'], branches: [], from: d, to: d, budget: 0, status: 'active', createdAt: '2026-11-01' }] })); });
  await p.waitForTimeout(300); await p.click('[data-mktv="cmp"]'); await p.waitForSelector('[data-cmp]');
  const roi = p.locator('[data-camp="CMP-0001"] [data-camproi]');
  assert.match(await roi.innerText(), /اربط حساب مصروف/);
  await roi.locator('select').selectOption('5901'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.cur.mktCampaigns[0].acc), '5901');
  const s = (await roi.innerText()).replace(/\s+/g, ' ');
  assert.match(s, /التكلفة الفعلية: 100\.00/); assert.match(s, /بلا ضريبة: 200\.00/); assert.match(s, /العائد: 100%/);
  await p.locator('[data-camp="CMP-0001"]').scrollIntoViewIfNeeded(); await shot(p, 'mkt-roi');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.9 D1 دفتر القيود المخزّن: معطّل افتراضيًا، يفعّله المدير، والمطابقة خارج Firestore لا تنهار، والإيقاف متاح', async () => {
  const ctx = await browser.newContext(devices['iPad (gen 7)']); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'live/Admin/admin'); await p.reload(); await p.waitForTimeout(500); await settle(p);
  await p.locator('button:has-text("صيانة")').first().click(); await p.waitForTimeout(500);
  const card = p.locator('[data-ledger]');
  assert.match(await card.innerText(), /غير مفعّل/);
  assert.match(await card.innerText(), /JV-2026-000001/);
  assert.equal(await card.locator('button:has-text("مطابقة")').count(), 0, 'لا مطابقة قبل التفعيل');
  // v56.11 (D3): المجموعات الست بالترتيب المعتمد، والأولى فقط مفعّلة افتراضيًا
  const gr = await card.locator('[data-ledger-groups]').innerText();
  assert.match(gr, /✓ 1\. الإغلاقات اليومية/); assert.match(gr, /○ 2\. فواتير الموردين/); assert.match(gr, /○ 6\. القيود اليدوية/);
  await card.scrollIntoViewIfNeeded(); await shot(p, 'ledger-card');
  await card.locator('button:has-text("تفعيل")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.ledger || {}).on), true);
  assert.match(await card.innerText(), /القراءة من المحرك/);
  await card.locator('button:has-text("مطابقة")').click(); await p.waitForTimeout(400);
  assert.match(await p.evaluate(() => window.lastSay || ''), /Firestore فقط/);
  await card.locator('button:has-text("إيقاف")').click(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!(window.curOrg.ledger || {}).on), false);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.13 الإجازات: لوحة «مهامي» فوق الشريط العلوي، وتتبع الإجازة بعد الاعتماد، وتوقيع الطلب، ومباشرة العمل من الفرع باعتماد المركز', async () => {
  // 1) اللوحة الجانبية تُرسم على مستوى الصفحة (كانت داخل طبقة الرئيسية فيغطّي الشريط العلوي رأسها)
  { const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 860 } }, 'comp/Launcher');
    await p.click('[data-tasksbtn]'); await p.waitForSelector('.lh-drawer [data-mywork-drawer]');
    assert.equal(await p.locator('.lh-drawer').evaluate(e => e.parentElement === document.body), true, 'اللوحة ابنة مباشرة للصفحة');
    assert.equal(await p.locator('.lh .lh-drawer').count(), 0);
    assert.deepEqual(errs, []); await ctx.close(); }
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/hr:leaves');
  const D = await p.evaluate(() => { const iso = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; return { from: iso(-10), to: iso(-6), td: iso(0) }; });
  await p.evaluate((D) => { window.setOrg(g => ({ ...g, hrPolicies: { ...(g.hrPolicies || {}), leaveFlow: true } }));
    window.setOps(o => ({ ...o, hrSignDocs: [], leaveRequests: [{ id: 'lvX', employeeId: 'e1', employeeName: 'أحمد علي', branchId: 'b1', branchName: 'عم قاسم طيبة', type: 'annual', from: D.from, to: D.to, days: 5, status: 'approved', requestedBy: 'خالد', at: D.from + 'T08:00', decidedBy: 'سارة', decidedAt: D.from + 'T09:00' }] })); }, D);
  await p.waitForTimeout(300);
  // 2) الإجازة المعتمدة تُعرض وتُتبَّع: المراحل ومن اعتمد، والمباشرة غير المسجّلة تظهر متأخرة
  await p.getByRole('button', { name: 'معتمدة', exact: true }).click();
  await p.locator('[data-lvview]').first().click(); await p.waitForSelector('[data-lvdetail]');
  const det = await p.locator('[data-lvtrack]').innerText(); assert.match(det, /الاعتماد/); assert.match(det, /سارة/); assert.match(det, /مباشرة العمل \(متوقعة/);
  assert.equal(await p.locator('[data-lvprint]').count(), 1);
  await p.getByRole('button', { name: 'إغلاق', exact: true }).last().click(); await p.waitForSelector('[data-lvdetail]', { state: 'detached' });
  // 3) مدير الفرع يسجّل المباشرة المتأخرة — السبب إلزامي — ويُصدَر إقرار مباشرة يوقّعه الموظف
  await p.evaluate(() => window.as('bm')); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'معتمدة', exact: true }).click();
  await p.locator('[data-lvret]').first().click();
  assert.match(await p.locator('[data-lvret-plan]').innerText(), /متأخرة 5 يوم/);
  await p.click('[data-lvret-save]'); await p.waitForFunction(() => /سبب التأخر/.test(window.lastSay || ''));
  await p.getByLabel('ملاحظة المباشرة').fill('ظرف عائلي'); await p.click('[data-lvret-save]');
  await p.waitForFunction(() => (window.cur.leaveRequests[0].ret || {}).status === 'pending');
  const r1 = await p.evaluate(() => ({ ret: window.cur.leaveRequests[0].ret, sd: window.cur.hrSignDocs.map(d => d.docType + ':' + d.status) }));
  assert.equal(r1.ret.lateDays, 5); assert.equal(r1.ret.date, D.td); assert.deepEqual(r1.sd, ['leave_return:pending']);
  assert.equal(await p.locator('[data-lvret-ok]').count(), 0, 'مدير الفرع لا يعتمد المباشرة');
  // 4) المركز يعتمد المباشرة ⇒ أيام التأخر تُخصم من الرصيد
  await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'معتمدة', exact: true }).click();
  p.once('dialog', d => d.accept());
  await p.locator('[data-lvret-ok]').first().click();
  await p.waitForFunction(() => window.cur.leaveRequests[0].ret.status === 'approved');
  assert.match(await p.locator('[data-lvret-st]').first().innerText(), /باشر .* تأخر 5/);
  // 5) طلب جديد مع تفعيل الدورة ⇒ إقرار «طلب إجازة» بانتظار توقيع الموظف
  await p.getByRole('button', { name: 'طلب إجازة' }).first().click();
  await p.getByRole('button', { name: 'إرسال للاعتماد' }).click();
  await p.waitForFunction(() => window.cur.hrSignDocs.some(d => d.docType === 'leave'));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.14 D4 الميزان من الدفتر المخزّن: بلا تفعيل لا لافتة، ومع التفعيل خارج Firestore لافتة صريحة والأرقام من المحرك', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/tb');
  await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-flsrc]').count(), 0, 'القراءة غير مفعّلة ⇒ لا لافتة');
  await p.evaluate(() => window.setOrg(g => ({ ...g, ledger: { on: true, read: true, lvl: 6 } }))); await p.waitForTimeout(500);
  const t = await p.locator('[data-flsrc]').innerText();
  assert.match(t, /تعذّر تحميل الدفتر \(خارج Firestore\) — الأرقام من المحرك|الفترة تبدأ قبل 2026-01-01/);
  assert.ok(await p.locator('text=ميزان المراجعة').count() > 0);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.16 أقسام المحاسبة ظاهرة (بلاغ المالك): صف بأقسام المجموعة الحالية، والقسم الحالي مسمّى، ولا مبدّل عرض مكرر — تابلت وجوال', async () => {
  for (const [vp, tag] of [[{ width: 1190, height: 782 }, 'tablet'], [{ width: 390, height: 844 }, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(tag === 'mobile' ? { isMobile: true, hasTouch: true } : {}) }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'acct/jr'); await p.waitForSelector('.ob-sub', { timeout: 15000 }); await settle(p);
    const sub = p.locator('.ob-sub').first();
    assert.equal((await sub.locator('.ob-si.on').innerText()).trim(), 'القيود اليومية', tag + ': القسم الحالي مميّز في الصف');
    assert.ok(await sub.locator('.ob-si').count() >= 3, tag + ': أقسام المجموعة ظاهرة بلا فتح قائمة');
    assert.match(await sub.locator('.sp-cur').innerText(), /القيود اليومية/, tag + ': السابق/التالي باسم القسم');
    assert.equal(await p.locator('.ob .acct-mode').count(), 0, tag + ': لا مبدّل عرض مكرر داخل المحاسبة');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2, tag + ': بلا تجاوز أفقي');
    await shot(p, 'acct-nav-' + tag);
    const second = (await sub.locator('.ob-si').nth(1).innerText()).trim();
    await sub.locator('.ob-si').nth(1).click(); await settle(p);
    assert.equal((await p.locator('.ob-sub .ob-si.on').innerText()).trim(), second, tag + ': النقر ينقل القسم');
    await p.locator('.ob-it', { hasText: 'التقارير' }).first().click(); await p.waitForTimeout(150);
    await p.locator('.ob-mi').first().click(); await settle(p);
    assert.ok(await p.locator('.ob-sub .ob-si.on').count() === 1, tag + ': بعد الانتقال لمجموعة أخرى يظهر صفها');
    assert.deepEqual(errs, []); await ctx.close();
  }
});

test('v56.17 GROWTH 2: بطاقة السجلات المحمية للموافقات والولاء — معطّلة افتراضيًا، والتفعيل يُسجَّل، والموافقة الجديدة تبقى في المصدر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-grr]');
  assert.match(await p.locator('[data-grr]').innerText(), /غير مفعّل/);
  await p.click('[data-grr-toggle]');   // النوافذ تُقبل تلقائيًا في هذه البيئة
  await p.waitForFunction(() => window.curOrg.growthRecords && window.curOrg.growthRecords.on === true);
  assert.match(await p.locator('[data-grr]').innerText(), /النسخ مفعّل/);
  await p.click('[data-grr-check]'); await p.waitForFunction(() => /Firestore فقط/.test(window.lastSay || ''));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.18 POS 6a: بطاقة قيد الإيراد من فواتير نقطة البيع — معطّلة افتراضيًا، والتفعيل بتاريخ بدء، وفحص المطابقة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-posgl]');
  assert.match(await p.locator('[data-posgl]').innerText(), /غير مفعّل/);
  await p.getByLabel('تاريخ بدء قيد نقطة البيع').fill('2026-11-01');
  await p.click('[data-posgl-toggle]');   // النوافذ تُقبل تلقائيًا في هذه البيئة
  await p.waitForFunction(() => window.curOrg.posGl && (window.curOrg.posGl.ranges || [])[0] && window.curOrg.posGl.ranges[0].from === '2026-11-01' && !window.curOrg.posGl.ranges[0].to);
  await p.click('[data-posgl-check]'); await p.waitForSelector('[data-posgl-rep]');
  assert.match(await p.locator('[data-posgl-rep]').innerText(), /إغلاقات في النطاق/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.19 FINANCE E1: قائمة التغيرات في حقوق الملكية — الصفوف السبعة، ومطابقة المركز المالي، وتصدير Excel', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/eqs');
  await p.waitForSelector('[data-eqs-table]');
  assert.equal(await p.locator('[data-eqs-row]').count(), 7);
  assert.match(await p.locator('[data-eqs-tie]').innerText(), /مطابق للمركز المالي ✓/);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-eqs-xl]')]); const fp = await dl.path(); assert.ok(fp && (await import('node:fs')).statSync(fp).size > 1000, 'ملف Excel فعلي');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.20 FINANCE E2: قائمة مهام الإقفال — الفحوص الآلية، وفصل المهام في الاعتماد، والتفعيل يمنع القفل قبل الاكتمال', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Accounting/admin/lock');
  await p.waitForSelector('[data-closelist]');
  assert.ok(await p.locator('[data-cl-auto]').count() >= 5); assert.equal(await p.locator('[data-cl-task]').count(), 5);
  await p.click('[data-cl-toggle]'); await p.waitForFunction(() => window.curOrg.closeList && window.curOrg.closeList.on === true);
  await p.click('button:has-text("قفل الفترات")'); await p.waitForFunction(() => /لا قفل قبل اكتمال قائمة الإقفال/.test(window.lastSay || ''));
  await p.locator('[data-cl-done]').first().click(); await p.waitForFunction(() => (window.cur.closeTasks || []).length === 1);
  await p.locator('[data-cl-ap]').first().click(); await p.waitForFunction(() => /غير من أنجزها/.test(window.lastSay || ''), null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => !!window.cur.closeTasks[0].apAt), false, 'المنفّذ لا يعتمد مهمته');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.21 FINANCE E3: فروق الصرف غير المحققة — سعر الإقفال، المعاينة، والتفعيل يولّد قيد 5804/2109', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Accounting/admin/lock');
  await p.evaluate(() => { window.setOps(o => ({ ...o, invoices: [...(o.invoices || []), { id: 'fxi', supplierId: 's1', supplierName: 'مورد أوروبي', date: '2020-01-10', amount: 40000, cur: 'EUR', fxRate: 4, fcAmount: 10000 }] })); });
  const inp = p.locator('input[type="month"]').first(); await inp.fill('2020-01');
  await p.waitForSelector('[data-fxreval]');
  await p.evaluate(() => { window.prompt = () => '4.1'; }); await p.click('[data-fx-rate="EUR"]');   // المعالج العام يقبل النوافذ بقيمتها الافتراضية
  await p.waitForFunction(() => ((window.curOrg.fxReval || {}).rates || {})['2020-01'] && window.curOrg.fxReval.rates['2020-01'].EUR === 4.1);
  assert.match(await p.locator('[data-fx-rows]').innerText(), /1,000\.00/);
  await p.click('[data-fx-toggle]'); await p.waitForFunction(() => window.curOrg.fxReval.on === true);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.22 FINANCE G1: الصورة المالية في لوحة المدير المالي — النقد والربحية والتكاليف بالفرع والضريبة، والتنقيب إلى الحساب', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1600 } }, 'live/Hub/admin/analytics:cfo');
  await p.waitForSelector('[data-finpic]');
  for (const k of ['cash', 'profit', 'costs', 'tax']) assert.equal(await p.locator('[data-fp="' + k + '"]').count(), 1, k);
  assert.match(await p.locator('[data-fp="cash"]').innerText(), /صافي السيولة/);
  assert.match(await p.locator('[data-fp="profit"]').innerText(), /مقابل/);
  assert.ok(await p.locator('[data-fp="tax"] a, [data-fp="tax"] button').count() >= 2, 'روابط الحسابات للتنقيب');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.23 G2: شريط التحكم في المحاسبة — معطّل افتراضيًا، والتفعيل يُظهر مسار الموقع والإجراءات، والتنقل يحدّث القسم الحالي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1190, height: 782 } }, 'live/Accounting/admin/jr');
  await p.waitForSelector('.ob-sub');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: false } }))); await p.waitForTimeout(300);   // v56.38: افتراضي — الإيقاف الصريح يعيد الشكل السابق
  assert.equal(await p.locator('[data-ctlbar]').count(), 0, 'الإيقاف الصريح — الشريط السابق كما هو');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
  await p.waitForSelector('[data-ctlbar]');
  assert.match(await p.locator('[data-ctlbar]').innerText(), /المحاسبة/);
  assert.equal((await p.locator('[data-ctlbar-cur]').innerText()).trim(), 'القيود اليومية');
  assert.ok(await p.locator('[data-ctlbar-act] button:has-text("قيد يدوي")').count() === 1, 'الإجراء الأساسي في سطر التحكم');
  assert.equal(await p.locator('.ob button:has-text("قيد يدوي")').count(), 0, 'لا تكرار في شريط المجموعات');
  await p.locator('.ob-sub .ob-si').nth(1).click();
  const cur = (await p.locator('.ob-sub .ob-si.on').innerText()).trim();
  assert.equal((await p.locator('[data-ctlbar-cur]').innerText()).trim(), cur);
  assert.equal(await p.locator('.ob-sub .ob-si[aria-current="page"]').count(), 1);
  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(await p.locator('.obp-app').isVisible(), false, 'الجوال: اسم القسم فقط');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'بلا تمرير أفقي للصفحة');
  assert.ok(await p.evaluate(() => document.querySelector('.ob-sub').getBoundingClientRect().height) < 70, 'المرقّم سطر واحد على الجوال');
  assert.deepEqual(errs, []); await ctx.close();
  // أهداف اللمس 44px على أجهزة اللمس (مراجعة التصميم المستقلة)
  { const { p, errs, ctx } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'live/Accounting/admin/jr');
    await p.waitForSelector('.ob-sub'); await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } }))); await p.waitForSelector('[data-ctlbar]');
    const hs = await p.evaluate(() => [...document.querySelectorAll('[data-ctlbar-act] .btn, .ob-sub.ctl2 .btn, .ob-sub.ctl2 .ob-si')].map(b => Math.round(b.getBoundingClientRect().height)));
    assert.ok(hs.length > 0 && hs.every(h => h >= 44), 'أهداف لمس ≥ 44px: ' + hs.join(','));
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.24 G2 المرحلة 2: مرشحات التقارير في شريط التحكم — مرة واحدة، تعمل، وعلى الجوال خلف «تصفية (n)»', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1190, height: 782 } }, 'live/Accounting/admin/tb');
  await p.waitForSelector('.ob-sub');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: false } }))); await p.waitForTimeout(300);   // v56.38: افتراضي — الإيقاف الصريح يعيد الشكل السابق
  assert.equal(await p.locator('[data-ctlbar-tools]').count(), 0, 'الإيقاف الصريح');
  const inCard0 = await p.locator('.card input[type="date"]').count(); assert.ok(inCard0 >= 2, 'المرشح داخل البطاقة بلا تفعيل');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
  await p.waitForSelector('[data-ctlbar-tools]');
  assert.equal(await p.locator('[data-ctlbar-tools] input[type="date"]').count(), 2, 'الفترة في الشريط');
  assert.equal(await p.locator('.card input[type="date"]').count(), 0, 'لا تكرار داخل البطاقة');
  await p.locator('[data-ctlbar-tools] button:has-text("هذه السنة")').click();
  assert.match(await p.locator('[data-ctlbar-ftog]').innerText(), /\(1\)/);
  await p.locator('[data-ctlbar-tools] select').selectOption('central');
  assert.match(await p.locator('[data-ctlbar-ftog]').innerText(), /\(2\)/);
  // قسم بلا مرشح فترة: لا مكان مرشحات
  await p.locator('.ob-sub .ob-si', { hasText: 'دليل الحسابات' }).click();
  assert.equal(await p.locator('[data-ctlbar-tools]').count(), 0);
  await p.locator('.ob-sub .ob-si', { hasText: 'ميزان المراجعة' }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(await p.locator('[data-ctlbar-tools]').isVisible(), false, 'الجوال: المرشحات مطوية');
  await p.click('[data-ctlbar-ftog]');
  assert.equal(await p.locator('[data-ctlbar-tools]').isVisible(), true);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'بلا تمرير أفقي');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.25 G2 المرحلة 3: شريط التحكم في بقية التطبيقات (المخزون ومراكز التطبيقات) — معطّل افتراضيًا، والتفعيل يُظهر المسار وصف الأقسام', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1190, height: 782 } }, 'live/Inventory/admin/items');
  await p.waitForSelector('.ob');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: false } }))); await p.waitForTimeout(300);   // v56.38: افتراضي — الإيقاف الصريح يعيد الشكل السابق
  assert.equal(await p.locator('[data-ctlbar]').count(), 0, 'الإيقاف الصريح');
  const pagers0 = await p.locator('.secpager').count();
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
  await p.waitForSelector('[data-ctlbar]');
  assert.match(await p.locator('[data-ctlbar] .obp-app').first().innerText(), /المخزون/);
  const cur = (await p.locator('[data-ctlbar-cur]').first().innerText()).trim(); assert.ok(cur.length > 0, 'اسم القسم الحالي');
  assert.equal(await p.locator('.ob-sub .secpager').count() >= 1, true, 'السابق/التالي في نهاية صف الأقسام');
  assert.ok(await p.locator('.secpager').count() <= pagers0, 'لا مرقّم مكرر');
  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'بلا تمرير أفقي');
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1190, height: 782 } }, 'live/Hub/admin/hr:leaves');
    await p.waitForSelector('.ob'); await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
    await p.waitForSelector('[data-ctlbar]');
    assert.ok(await p.locator('[data-ctlbar]').count() >= 1);
    assert.deepEqual(errs, []); await ctx.close(); }
  // المحاسبة داخل مركز المالية: شريط واحد (شريط المحاسبة) لا شريطان متراكبان (مراجعة التصميم المستقلة)
  { const { p, errs, ctx } = await open({ viewport: { width: 1190, height: 782 } }, 'live/Hub/admin/finhub:acct');
    await p.waitForSelector('.ob'); await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
    await p.waitForSelector('[data-ctlbar]'); await p.waitForTimeout(200);
    assert.equal(await p.locator('[data-ctlbar]').count(), 1, 'مسار موقع واحد');
    assert.match(await p.locator('[data-ctlbar]').innerText(), /المحاسبة/);
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.26 G2 التنقيب الموحّد: مبلغ في القوائم المالية ← قيود الحساب ← المستند المصدر ← رجوع (مع شريط التحكم فقط)', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/admin/fs');
  await p.waitForSelector('.is-tb');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: false } }))); await p.waitForTimeout(300);   // v56.38: افتراضي — الإيقاف الصريح يعيد الشكل السابق
  assert.equal(await p.locator('[data-drill]').count(), 0, 'مع الإيقاف الصريح لا روابط تنقيب');
  await p.evaluate(() => window.setOrg(o => ({ ...o, ctlBar: { on: true } })));
  await p.waitForSelector('[data-drill]');
  assert.ok(await p.locator('[data-drill]').count() >= 4, 'بنود قائمة الدخل والمركز المالي');
  const negOk = await p.evaluate(() => [...document.querySelectorAll('.is-tb .neg [data-drill]')].every(x => getComputedStyle(x.closest('.doclink')).color === getComputedStyle(x.closest('.neg')).color));
  assert.ok(negOk, 'السالب يبقى أحمر في رابط التنقيب');
  const codes = await p.locator('[data-drill]').evaluateAll(xs => xs.map(x => x.getAttribute('data-drill')));
  const c = codes.includes('2101') ? '2101' : codes[0];
  await p.locator('[data-drill="' + c + '"]').first().click();
  await p.waitForSelector('[data-peek]');
  assert.match(await p.locator('.modal, [role="dialog"]').last().innerText(), new RegExp('قيود الحساب ' + c));
  assert.ok(await p.locator('[data-peek-je]').count() >= 1, 'قيود الحساب');
  assert.ok(await p.locator('[data-peek-doc]').count() >= 1, 'رابط المستند المصدر');
  {
    await p.locator('[data-peek-doc]').first().click();
    await p.waitForSelector('[data-peek-back]');
    await p.click('[data-peek-back]');
    await p.waitForFunction((c) => [...document.querySelectorAll('[data-peek-je]')].length >= 1 && document.body.innerText.includes('قيود الحساب ' + c), c);
  }
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.27 FINANCE E4: بُعد القسم — معطّل افتراضيًا، التفعيل وإضافة قسم، القسم على سطر القيد اليدوي، والتقرير يطابق الإجمالي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Accounting/admin/cc');
  await p.waitForSelector('[data-dept]');
  assert.match(await p.locator('[data-dept]').innerText(), /غير مفعّل/);
  assert.equal(await p.locator('[data-dept-table]').count(), 0);
  await p.click('[data-dept-toggle]'); await p.waitForFunction(() => window.curOrg.costDepts && window.curOrg.costDepts.on === true);
  await p.getByLabel('اسم القسم').fill('المطبخ'); await p.click('[data-dept-add]');
  await p.waitForFunction(() => (window.curOrg.costDepts.list || []).some(d => d.name === 'المطبخ'));
  await p.waitForSelector('[data-dept-table]');
  assert.ok(await p.locator('[data-dept-row]').count() >= 3, 'المطبخ + مشترك + بلا قسم');
  assert.match(await p.locator("[data-dept-total]").innerText(), /إجمالي المصروفات التشغيلية والأخرى/);
  // القسم على سطر القيد اليدوي
  await p.locator('.ob-it', { hasText: 'العمليات اليومية' }).first().click(); await p.locator('.ob-mi', { hasText: 'القيود اليومية' }).first().click();
  await p.locator('button:has-text("قيد يدوي")').first().click();
  await p.waitForSelector('[data-jm-dept]');
  assert.ok(await p.locator('[data-jm-dept]').count() >= 2, 'قسم لكل سطر');
  assert.match(await p.locator('[data-jm-dept]').first().innerText(), /المطبخ/); assert.match(await p.locator('[data-jm-dept]').first().innerText(), /مشترك/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.27 E4: عكس قيد يدوي يحمل الفرع والمشروع والقسم من الأصل (مراجعة رئيس المحاسبين)', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1280, height: 900 } }, 'live/Accounting/admin/jr');
  await p.evaluate(() => window.setOps(o => ({ ...o, journalManual: [{ id: 'jd1', date: o.closings[0].date, title: 'قيد بقسم للعكس', by: 'منى', status: 'posted', branchId: 'b1', lines: [{ code: '5901', debit: 300, credit: 0, deptId: 'dk' }, { code: '1201', debit: 0, credit: 300 }] }] })));
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="بحث في القيود…"]', 'قيد بقسم للعكس'); await p.waitForTimeout(200);
  await p.locator('td', { hasText: 'قيد بقسم للعكس' }).first().click(); await p.waitForTimeout(250);
  await p.click('button:has-text("↺ عكس القيد")'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => window.cur.journalManual.filter(j => j.reverses === 'jd1').map(j => [j.branchId || '', j.lines.map(l => l.code + ':' + (l.deptId || '')).join(',')]));
  assert.deepEqual(r, [['b1', '5901:dk,1201:']]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.28 E4: قسم سند الصرف على حساب مصروف — يظهر بالتفعيل للمصروف فقط، ويُحفظ على السند', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, costDepts: { on: true, list: [{ id: 'dk', name: 'المطبخ' }] } })); window.setOps(o => ({ ...o, cashVouchers: [] })); });
  await p.waitForTimeout(300);
  await p.locator('[data-tabcv]').click(); await p.waitForTimeout(200);
  await p.locator('[data-newcv="pv"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-cvpt="acc"]').click();
  const exp = await p.evaluate(() => Array.from(document.querySelectorAll('select[aria-label="حساب السند"] option')).map(o => o.value).find(v => /^5199$/.test(v)) || Array.from(document.querySelectorAll('select[aria-label="حساب السند"] option')).map(o => o.value).find(v => /^5/.test(v)));
  const nonExp = await p.evaluate(() => Array.from(document.querySelectorAll('select[aria-label="حساب السند"] option')).map(o => o.value).find(v => /^1[2-4]/.test(v)));
  if (nonExp) { await p.selectOption('select[aria-label="حساب السند"]', nonExp); assert.equal(await p.locator('[data-cv-dept]').count(), 0, 'غير المصروف بلا قسم'); }
  await p.selectOption('select[aria-label="حساب السند"]', exp);
  await p.waitForSelector('[data-cv-dept]'); await p.selectOption('[data-cv-dept]', 'dk');
  await p.fill('input[aria-label="مبلغ السند"]', '90'); await p.fill('input[aria-label="بيان السند"]', 'صيانة');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(500);
  assert.deepEqual(await p.evaluate(() => window.cur.cashVouchers.map(v => [v.kind, v.deptId || ''])), [['pv', 'dk']]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.29 أوامر الصرف: بلا تفعيل كما كان؛ بالتفعيل البنود الثلاثة غائبة، والمعلّق لا يُخصم ويعتمده غير منشئه، وبطاقة الإعداد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  await p.locator('button:has-text("أوامر الصرف")').first().click(); await p.locator('button:has-text("أمر صرف جديد")').click();
  let opts = await p.locator('.modal select.sel').first().locator('option').allInnerTexts();
  assert.ok(opts.includes('سداد موردين'), 'بلا تفعيل كما كان');
  await p.locator('.modal button:has-text("إلغاء")').click();
  const td = await p.evaluate(() => new Date().toISOString().slice(0, 10));
  await p.evaluate((td) => { window.setOrg(o => ({ ...o, dsRoute: { ranges: [{ from: td }] } }));
    window.setOps(o => ({ ...o, transfers: [...(o.transfers || []), { id: 'tin', date: td, status: 'received', amount: 5000, branchName: 'العليا', referenceNo: 'T1' }],
      disbursements: [{ id: 'dp1', date: td, category: 'صيانة وتشغيل', amount: 200, beneficiary: 'ورشة', method: 'cash', by: 'محاسب آخر', byId: 'someone-else', status: 'pending' }] })); }, td);
  await p.waitForTimeout(250);
  await p.locator('button:has-text("أمر صرف جديد")').click();
  opts = await p.locator('.modal select.sel').first().locator('option').allInnerTexts();
  for (const c of ['سداد موردين', 'ضريبة القيمة المضافة', 'صرف رواتب']) assert.ok(!opts.includes(c), c);
  assert.ok(await p.locator('[data-ds-hint]').count() === 1);
  // تاريخ يسبق بداية الضوابط مرفوض (التحقق المستقل)
  await p.locator('.modal input[type="date"]').first().fill('2020-01-05');
  await p.locator('.modal input.inp.n').first().fill('50'); await p.locator('.modal input[placeholder="اسم الجهة أو المورد"]').fill('ورشة');
  await p.click('[data-ds-save]'); await p.waitForFunction(() => /يسبق بداية ضوابط أوامر الصرف/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => window.cur.disbursements.length), 1, 'لم يُحفظ');
  await p.locator('.modal button:has-text("إلغاء")').click();
  assert.ok(await p.locator('[data-ds-pending]').count() === 1, 'المعلّق ظاهر بشارته');
  await p.click('[data-ds-ok]'); await p.waitForFunction(() => (window.cur.disbursements.find(x => x.id === 'dp1') || {}).status === 'posted');
  // لا يُعاد اعتماد غير المعلّق
  await p.evaluate(() => window.setOps(o => ({ ...o, disbursements: [...o.disbursements, { id: 'dp2', date: o.disbursements[0].date, category: 'صيانة وتشغيل', amount: 10, beneficiary: 'س', method: 'cash', by: 'آخر', byId: 'x2', status: 'pending' }] })));
  await p.waitForTimeout(200);
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
    await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-dsroute]');
    assert.match(await p.locator('[data-dsroute]').innerText(), /غير مفعّلة/);
    await p.click('[data-dsroute-toggle]'); await p.waitForFunction(() => (((window.curOrg.dsRoute || {}).ranges) || []).length === 1);
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.30 أوامر الصرف حسب بنودها: المالك يختار حساب البند، والأمر الجديد يُثبَّت عليه حسابه', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.evaluate(() => window.setOrg(o => ({ ...o, customAccounts: [...(o.customAccounts || []), { code: '5610', name: 'مصروف الإيجار', kind: 'exp' }] })));
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-dsmap]');
  await p.selectOption('[data-dsmap-item="إيجارات الفروع"]', '5610');
  await p.waitForFunction(() => ((window.curOrg.dsRoute || {}).map || {})['إيجارات الفروع'] === '5610');
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
    const td = await p.evaluate(() => new Date().toISOString().slice(0, 10));
    await p.evaluate((td) => { window.setOrg(o => ({ ...o, customAccounts: [...(o.customAccounts || []), { code: '5610', name: 'مصروف الإيجار', kind: 'exp' }], dsRoute: { ranges: [{ from: td }], map: { 'إيجارات الفروع': '5610' } } }));
      window.setOps(o => ({ ...o, transfers: [...(o.transfers || []), { id: 'tin', date: td, status: 'received', amount: 9000, branchName: 'العليا', referenceNo: 'T1' }], disbursements: [] })); }, td);
    await p.waitForTimeout(250);
    await p.locator('button:has-text("أوامر الصرف")').first().click(); await p.locator('button:has-text("أمر صرف جديد")').click();
    await p.locator('.modal select.sel').first().selectOption('إيجارات الفروع');
    assert.match(await p.locator('[data-ds-acc]').innerText(), /5610/);
    await p.locator('.modal input.inp.n').first().fill('3000'); await p.locator('.modal input[placeholder="اسم الجهة أو المورد"]').fill('مالك العقار');
    await p.click('[data-ds-save]'); await p.waitForFunction(() => (window.cur.disbursements || []).length === 1);
    assert.deepEqual(await p.evaluate(() => window.cur.disbursements.map(x => [x.category, x.acc || ''])), [['إيجارات الفروع', '5610']]);
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.31 أوامر الصرف (قرارات المجلس): البنك للتحويل، تاريخ الاعتماد ووسم المالك، والمعلّق يحجز الرصيد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  const td = await p.evaluate(() => new Date().toISOString().slice(0, 10));
  await p.evaluate((td) => { window.setOrg(o => ({ ...o, dsRoute: { ranges: [{ from: td }] } }));
    window.setOps(o => ({ ...o, transfers: [...(o.transfers || []), { id: 'tin', date: td, status: 'received', amount: 1000, branchName: 'العليا', referenceNo: 'T1' }],
      disbursements: [{ id: 'pp', date: td, category: 'صيانة وتشغيل', amount: 700, beneficiary: 'ورشة', method: 'cash', by: 'آخر', byId: 'x9', status: 'pending' }] })); }, td);
  await p.waitForTimeout(250);
  await p.locator('button:has-text("أوامر الصرف")').first().click();
  assert.match(await p.locator('body').innerText(), /المتاح بعد المعلّق/);
  await p.locator('button:has-text("أمر صرف جديد")').click();
  // نقدًا يتجاوز المتاح (1000 − 700 المعلّق) ⇒ مرفوض
  await p.locator('.modal select.sel').nth(1).selectOption('cash');
  await p.locator('.modal input.inp.n').first().fill('500'); await p.locator('.modal input[placeholder="اسم الجهة أو المورد"]').fill('مورد خدمات');
  await p.click('[data-ds-save]'); await p.waitForFunction(() => /يتجاوز رصيد الخزينة المتاح/.test(window.lastSay || ''));
  // تحويل بنكي ⇒ البنك، والمالك يرحّل مباشرة بوسم وتاريخ اعتماد
  await p.locator('.modal select.sel').nth(1).selectOption('bank_transfer'); await p.waitForSelector('[data-ds-bank]');
  await p.click('[data-ds-save]'); await p.waitForFunction(() => (window.cur.disbursements || []).length === 2);
  const r = await p.evaluate(() => window.cur.disbursements.filter(x => x.id !== 'pp').map(x => [x.fundAcc || '', x.status, !!x.selfPosted, !!x.postDate]));
  assert.deepEqual(r, [['1201', 'posted', true, true]]);
  assert.ok(await p.locator('[data-ds-self]').count() >= 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.32 اعتماد سندات الصرف: المعلّق بلا أثر ويعتمده غير منشئه فيُسدَّد، وسند المالك مباشر بوسم، وبطاقة الإعداد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  const td = await p.evaluate(() => new Date().toISOString().slice(0, 10));
  await p.evaluate((td) => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, cvAppr: { ranges: [{ from: td }] } }));
    window.setOps(o => ({ ...o, invoices: [{ id: 'iv9', supplierId: 's1', supplierName: 'مؤسسة اللحوم الطازجة للتجارة', amount: 800, date: td, invoiceNo: 'S-99', paidAmount: 0 }],
      cashVouchers: [{ id: 'cvp', no: 'PV-000077', kind: 'pv', date: td, amount: 300, fund: '1101', pm: 'cash', party: { t: 'sup', key: 'sup:s1', name: 'مؤسسة اللحوم الطازجة للتجارة' }, alloc: [{ id: 'iv9', no: 'S-99', amount: 300 }], by: 'محاسب آخر', byId: 'z1', at: td + 'T09:00:00Z', status: 'pending' }] })); }, td);
  await p.waitForTimeout(300);
  await p.locator('[data-tabcv]').click(); await p.waitForSelector('[data-cv-pending]');
  assert.equal(await p.evaluate(() => (window.cur.invoices[0].payments || []).length), 0, 'المعلّق بلا سداد');
  await p.click('[data-cv-ok]'); await p.waitForFunction(() => (window.cur.cashVouchers.find(v => v.id === 'cvp') || {}).status === 'posted');
  assert.equal(await p.evaluate(() => (window.cur.invoices[0].payments || []).length), 1, 'سُدّدت الفاتورة عند الاعتماد');
  // سند المالك مباشر بوسم
  await p.locator('[data-newcv="pv"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-cvpt="sup"]').click(); await p.selectOption('select[aria-label="جهة السند"]', 'sup:s1');
  await p.fill('input[aria-label="مبلغ السند"]', '50'); await p.fill('input[aria-label="بيان السند"]', 'دفعة');
  await p.locator('[data-cvsave]').click(); await p.waitForTimeout(500);
  assert.ok(await p.evaluate(() => window.cur.cashVouchers.some(v => v.selfPosted && v.status === 'posted')));
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
    await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-cvappr]');
    await p.click('[data-cvappr-toggle]'); await p.waitForFunction(() => (((window.curOrg.cvAppr || {}).ranges) || []).length === 1);
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.33 جاهزية 6a: معاينة رصيد النقاط القائم، وتفعيل قيد الولاء للإغلاق غير المطابق', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-posgl-open]');
  await p.click('[data-posgl-openprev]'); await p.waitForSelector('[data-posgl-openres]');
  assert.match(await p.locator('[data-posgl-openres]').innerText(), /نقطة ×/);
  await p.click("[data-posgl-mistoggle]"); await p.waitForFunction(() => (((window.curOrg.posGl || {}).misLoyRanges) || []).some(r => r.from && !r.to));
  assert.match(await p.locator('[data-posgl-mis]').innerText(), /مفعّل من/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.34 ولاء 6ب: تسوية الولاء الشهرية — معاينة وإنشاء القيد مرة لكل شهر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.evaluate(() => window.setOrg(o => ({ ...o, posGl: { ...(o.posGl || {}), ranges: [{ from: '2026-01-01' }] } })));
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-loymonth]');
  await p.click('[data-loymonth-prev]'); await p.waitForSelector('[data-loymonth-res]');
  assert.match(await p.locator('[data-loymonth-res]').innerText(), /منتهية/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.35 ضوابط التسويق: تصدير الكل للمالك وحده بسبب، والتراجع عن دمج يمس النقاط يصبح طلبًا', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { try { localStorage.setItem('rms8:loy', JSON.stringify({ members: {}, tx: [{ id: 'm1:i', phone: '511111111', pts: 30, at: new Date().toISOString() }] })); } catch { } });
  await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => { const td = new Date(); td.setHours(12); window.setOrg(o => ({ ...o, mktCtl: { on: true } }));
    window.setOps(o => ({ ...o, mktConsents: [], mktMerges: [{ id: 'm1', from: '522222222', to: '511111111', pts: 30, reason: 'تحقق', by: 'آخر', byId: 'z', at: td.toISOString() }], posOrders: window.__spg(td.toISOString().slice(0, 10)) })); });
  await p.waitForTimeout(400);
  await p.click('[data-mktv="seg"]'); await p.waitForTimeout(200);
  assert.ok(await p.locator('[data-seg-expall]').count() > 0, 'المالك يرى «تصدير الكل»');
  await p.click('[data-mktv="gov"]'); await p.waitForTimeout(200);
  assert.match(await p.locator('[data-unmerge]').first().innerText(), /طلب تراجع/);
  await p.evaluate(() => { window.prompt = () => 'خطأ في الدمج'; }); await p.locator('[data-unmerge]').first().click();
  await p.waitForFunction(() => (window.cur.mktMerges || []).some(x => x.undoReq === 'm1'));
  assert.equal(await p.evaluate(() => window.cur.mktMerges.some(x => x.undoOf === 'm1')), false, 'لم يُنفَّذ قبل الاعتماد');
  assert.ok(await p.locator('[data-unmerge-req]').count() === 1);
  assert.equal(await p.locator('[data-unmerge-ok]').count(), 0, 'صاحب الطلب لا يعتمده');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.36 الحماية على الخادم لسجلات الدمج: تظهر في بطاقة السجلات المحمية حين تُفعَّل ضوابط التسويق مع النسخ فقط', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-grr]');
  await p.evaluate(() => window.setOrg(o => ({ ...o, growthRecords: { on: true } }))); await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-grr-mkm]').count(), 0, 'بلا ضوابط التسويق لا سجلات دمج');
  await p.evaluate(() => window.setOrg(o => ({ ...o, mktCtl: { on: true } }))); await p.waitForTimeout(300);
  assert.match(await p.locator('[data-grr-mkm]').innerText(), /صاحب طلب التراجع/);
  await p.click('[data-grr-check]'); await p.waitForFunction(() => /Firestore فقط/.test(window.lastSay || ''));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.37 فصل أسماء عملاء الولاء: تفعيل ← معاينة ← نقل ← حذف من المشترك، والأسماء تبقى ظاهرة للمركز', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  const b = await p.evaluate(() => (window.curOrg.branches || [])[0].id);
  await p.evaluate((b) => { localStorage.setItem('rms8:loy', JSON.stringify({ members: { '511111111': { name: 'سارة الاختبار', since: '2026-01-01' }, '522222222': { name: 'منى المركز' } },
    tx: [{ id: 't1:e', phone: '511111111', name: 'سارة الاختبار', pts: 12, br: b, at: '2026-01-01T10:00:00Z' }, { id: 'la1', phone: '522222222', pts: 4, br: '', at: '2026-01-02T10:00:00Z' }] })); }, b);
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-lypii]');
  assert.match(await p.locator('[data-lypii]').innerText(), /غير مفعّل/);
  await p.click('[data-lypii-toggle]'); await p.waitForFunction(() => window.curOrg.loyPii && window.curOrg.loyPii.on === true);
  await p.click('[data-lypii-prev]'); await p.waitForSelector('[data-lypii-plan]');
  assert.match(await p.locator('[data-lypii-plan]').innerText(), /أسماء أعضاء 2 · أسماء في الحركات 1 · تُنقل 2 إلى 2/);
  await p.click('[data-lypii-copybtn]'); await p.waitForSelector('[data-lypii-copy]');
  assert.match(await p.locator('[data-lypii-copy]').innerText(), /مكتمل/);
  const names = await p.evaluate((b) => [JSON.parse(localStorage.getItem('rms8:lyb_' + b)).names, JSON.parse(localStorage.getItem('rms8:lyc')).names], b);
  assert.deepEqual(names, [{ '511111111': 'سارة الاختبار' }, { '522222222': 'منى المركز' }]);
  await p.click('[data-lypii-strip]'); await p.waitForFunction(() => window.curOrg.loyPii && !!window.curOrg.loyPii.strippedAt);
  const L = await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:loy')));
  assert.equal(JSON.stringify(L).includes('سارة'), false, 'لا اسم في المشترك'); assert.deepEqual(L.tx.map(t => t.pts), [12, 4], 'النقاط كما هي');
  await p.waitForSelector('[data-lypii-plan]'); assert.match(await p.locator('[data-lypii-plan]').innerText(), /بلا أسماء/);
  await p.click('[data-lypii-toggle]'); await p.waitForFunction(() => /لا يُوقف الفصل/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => window.curOrg.loyPii.on), true, 'لا إيقاف بعد الحذف');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.37 نقطة البيع مع فصل الأسماء: النقاط في الدفتر المشترك بلا اسم، والاسم في سجل الفرع ويظهر للكاشير', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, loyPii: { on: true }, taxCfg: { enabled: false }, posCfg: { branches: ['b1'], autoPrint: false }, loyaltyCfg: { enabled: true, earnPer: 10, ptValue: 0.5, minRedeem: 20, maxRedeemPct: 50 },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 50, cat: 'رئيسي' }], posPromos: [] }));
    window.setOps(o => ({ ...o, posTabs: [], posOrders: [], closings: o.closings.filter(c => c.branchId !== 'b1') }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click();
  if (!(await p.locator('input[aria-label="جوال العميل"]').count())) await p.click('button:has-text("+ عميل ولاء")');
  await p.fill('input[aria-label="جوال العميل"]', '0553334444'); await p.waitForTimeout(500);
  await p.fill('input[placeholder="اسم العميل (جديد)"]', 'ريم الفرع');
  await p.click('.pos-cart button:has-text("نقدي")'); await p.waitForTimeout(200); await p.click('.modal button:has-text("تأكيد")');
  await p.waitForFunction(() => { try { return (JSON.parse(localStorage.getItem('rms8:loy') || '{}').tx || []).length > 0 && !!localStorage.getItem('rms8:lyb_b1'); } catch { return false; } }, null, { timeout: 15000 });
  const L = await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:loy'))), N = await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:lyb_b1')).names);
  assert.equal(JSON.stringify(L).includes('ريم'), false, 'لا اسم في المشترك'); assert.ok(L.tx.some(t => t.pts > 0), 'النقاط مكسوبة');
  const ph = L.tx[0].phone; assert.equal(N[ph], 'ريم الفرع');
  await p.locator('.pos-tile:has-text("كبسة")').click();
  if (!(await p.locator('input[aria-label="جوال العميل"]').count())) await p.click('button:has-text("+ عميل ولاء")');
  await p.fill('input[aria-label="جوال العميل"]', '0553334444'); await p.waitForTimeout(900);
  assert.match(await p.locator('.pos-cart').innerText(), /ريم الفرع/, 'الكاشير يرى اسم عميل فرعه');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.37 (مراجعة الأمن): أسماء نطاق المستخدم وحده — المحمّل لمستخدم مركزي لا يظهر لكاشير الفرع، وطابور الأسماء لا يضيع اسمًا', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/Admin/admin');
  await p.evaluate(() => window.setOrg(o => ({ ...o, loyPii: { on: true } }))); await p.waitForTimeout(200);
  const r = await p.evaluate(async () => {
    const M = window.__M;
    localStorage.setItem('rms8:loy', JSON.stringify({ members: { '511': { since: '1' }, '522': { since: '1' } }, tx: [{ id: 'a', phone: '511', pts: 1, br: 'b1' }, { id: 'b', phone: '522', pts: 1, br: 'b2' }] }));
    localStorage.setItem('rms8:lyb_b1', JSON.stringify({ names: { '511': 'عميل ب1' } })); localStorage.setItem('rms8:lyb_b2', JSON.stringify({ names: { '522': 'عميل ب2' } }));
    const all = await M.loyGet(['b1', 'b2'], true); const br = await M.loyGet(['b1'], false);
    const out = { all: [all.members['511'].name, all.members['522'].name], br: [br.members['511'].name, br.members['522'].name || ''] };
    return out;
  });
  assert.deepEqual(r.all, ['عميل ب1', 'عميل ب2']); assert.deepEqual(r.br, ['عميل ب1', ''], 'فرع ب1 لا يرى اسم ب2 حتى بعد تحميل المركز');
  const q = await p.evaluate(async () => {
    const M = window.__M; localStorage.setItem('mizan:lynQ', JSON.stringify([{ qid: 'q1', br: 'b1', names: { '533': 'من الطابور' } }]));
    await M.loyGet(['b1'], false); return [localStorage.getItem('mizan:lynQ'), JSON.parse(localStorage.getItem('rms8:lyb_b1')).names['533']];
  });
  assert.deepEqual(q, [null, 'من الطابور'], 'الطابور يُفرَّغ بعد الحفظ');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.39 مصدر الدمج على الخادم: يُكتب السجل المحمي أولًا — تعذّره يوقف التراجع قبل أي أثر على النقاط أو المصدر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { try { localStorage.setItem('rms8:loy', JSON.stringify({ members: {}, tx: [{ id: 'm1:i', phone: '511111111', pts: 30, at: new Date().toISOString() }] })); } catch { } });
  await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => { const td = new Date(); td.setHours(12); window.setOrg(o => ({ ...o, growthRecords: { on: true }, mktCtl: { on: true }, mkmSrc: { on: true } }));
    window.setOps(o => ({ ...o, mktConsents: [], mktMerges: [{ id: 'm1', from: '522222222', to: '511111111', pts: 0, reason: 'تحقق', by: 'آخر', byId: 'z', at: td.toISOString() }], posOrders: window.__spg(td.toISOString().slice(0, 10)) })); });
  await p.waitForTimeout(400);
  await p.click('[data-mktv="gov"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { window.prompt = () => 'خطأ في الدمج'; }); await p.locator('[data-unmerge]').first().click();
  await p.waitForFunction(() => /Firestore فقط/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => window.cur.mktMerges.length), 1, 'لم يُكتب شيء في المصدر');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('rms8:loy')).tx.length), 1, 'لم تتحرك النقاط');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.40 الدفعة 7 (E6): مخصص الخسائر الائتمانية — الإعداد، التكوين بدليل، الاعتماد لغير المنشئ، ثم الشطب على الفاتورة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Accounting/acc/arage');
  await p.evaluate(() => {
    window.setOrg(o => ({ ...o, partners: [...(o.partners || []), { id: 'c9', type: 'customer', name: 'شركة العميل', key: 'cust:c9', terms: 30 }],
      customAccounts: [...(o.customAccounts || []), { code: '1389', name: 'مخصص الخسائر الائتمانية', kind: 'asset' }, { code: '5805', name: 'مصروف الخسائر الائتمانية', kind: 'exp' }],
      ecl: { on: true, expAcc: '5805', allowAcc: '1389' } }));
    window.setOps(o => ({ ...o, salesInvoices: [{ id: 'si9', no: 'S-9', kind: 'invoice', terms: 'credit', customerKey: 'cust:c9', date: '2026-06-01', dueDate: '2026-07-01', net: 1000, vat: 0, total: 1000, receipts: [], buyer: { name: 'شركة العميل' } }] }));
  });
  await p.waitForSelector('[data-ecl]'); assert.ok(await p.locator('[data-ar-bydue]').count() === 1, 'الأعمار من الاستحقاق');
  await p.locator('[data-ecl-row="cust:c9"] [data-ecl-prov]').click();
  await p.getByLabel('مبلغ المخصص').fill('600'); await p.getByLabel('سبب المخصص').fill('متأخر 5 أشهر ورفض السداد');
  await p.click('[data-ecl-save]'); await p.waitForFunction(() => (window.cur.eclDocs || []).length === 1);
  assert.equal(await p.locator('[data-ecl-wait]').count(), 1, 'المنشئ لا يعتمد');
  assert.equal(await p.evaluate(() => window.cur.eclDocs[0].status), 'pending');
  await p.evaluate(() => window.as('admin')); await p.waitForSelector('[data-ecl-ok]'); await p.click('[data-ecl-ok]');
  await p.waitForFunction(() => window.cur.eclDocs[0].status === 'approved');
  assert.deepEqual(await p.evaluate(() => [window.cur.eclDocs[0].expAcc, window.cur.eclDocs[0].allowAcc]), ['5805', '1389']);
  await p.locator('[data-ecl-row="cust:c9"] [data-ecl-wo]').click();
  await p.getByLabel('الفاتورة المشطوبة').selectOption('si9'); await p.getByLabel('مبلغ المخصص').fill('400'); await p.getByLabel('سبب المخصص').fill('إفلاس العميل');
  await p.click('[data-ecl-save]'); await p.waitForFunction(() => (window.cur.eclDocs || []).length === 2);
  await p.evaluate(() => window.as('acc')); await p.waitForSelector('[data-ecl-ok]'); await p.click('[data-ecl-ok]');
  await p.waitForFunction(() => window.cur.eclDocs[1].status === 'approved');
  assert.match(await p.locator('[data-ecl-row="cust:c9"]').innerText(), /600\.00[\s\S]*200\.00/, 'الذمة 600 والمخصص 200');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.41 الدفعة 6 (E5): الموازنة بالإصدارات — مسودة ← تعديل ← رفع ← اعتماد من غير المُعدّ، والانحراف من الإصدار الساري', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/acc/bud');
  const yr = await p.evaluate(() => String(new Date().getFullYear()));
  await p.evaluate(() => window.setOrg(o => ({ ...o, budgetV: { on: true } }))); await p.waitForSelector('[data-budv]');
  await p.click('[data-budv-new]'); await p.waitForFunction(() => (window.cur.budgets || []).length === 1);
  await p.click('[data-budv-edit]'); await p.waitForSelector('[data-budv-editor]');
  const m = await p.evaluate(() => new Date().getMonth()); const MN = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const inp = p.locator('[data-budv-editor] input[aria-label$=" ' + MN[m] + '"]').first(); await inp.fill('1234');
  await p.click('[data-budv-save]'); await p.waitForFunction(() => (window.cur.budgets[0].lines || []).length === 1);
  await p.click('[data-budv-submit]'); await p.waitForFunction(() => window.cur.budgets[0].status === 'submitted');
  assert.equal(await p.locator('[data-budv-wait]').count(), 1, 'المحاسب لا يعتمد');
  await p.evaluate(() => window.as('admin')); await p.waitForSelector('[data-budv-ok]'); await p.click('[data-budv-ok]');
  await p.waitForFunction(() => window.cur.budgets[0].status === 'approved');
  assert.match(await p.locator('[data-budv]').innerText(), /الإصدار 1 المعتمد/); assert.match(await p.locator('[data-budv-table]').innerText(), /1,234\.00/);
  assert.equal(await p.evaluate(() => window.cur.budgets[0].year), yr);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.41 الدفعة 6 (T4): المصروف المدفوع مقدمًا — إنشاء ثم اعتماد غير المنشئ، والقيود في الدفتر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/acc/ast');
  await p.evaluate(() => window.setOrg(o => ({ ...o, prepaid: { on: true }, customAccounts: [...(o.customAccounts || []), { code: '1450', name: 'إيجار مدفوع مقدمًا', kind: 'asset' }] })));
  await p.waitForSelector('[data-prepaid]'); await p.click('[data-pp-new]');
  await p.getByLabel('وصف المدفوع مقدمًا').fill('إيجار سنة'); await p.getByLabel('مبلغ المدفوع مقدمًا').fill('12000');
  await p.getByLabel('حساب المدفوع مقدمًا').selectOption('1450');
  const exp = await p.evaluate(() => [...document.querySelectorAll('select[aria-label="حساب المصروف"] option')].map(o => o.value).find(v => /^5/.test(v)));
  await p.getByLabel('حساب المصروف').selectOption(exp);
  if (await p.locator('select[aria-label="فرع المدفوع مقدمًا"]').count()) await p.getByLabel('فرع المدفوع مقدمًا').selectOption('b1');   // إيجار كل فرع منفصل
  await p.click('[data-pp-save]'); await p.waitForFunction(() => (window.cur.prepaids || []).length === 1);
  assert.equal(await p.locator('[data-pp-wait]').count(), 1);
  await p.evaluate(() => window.as('admin')); await p.waitForSelector('[data-pp-ok]'); await p.click('[data-pp-ok]');
  await p.waitForFunction(() => window.cur.prepaids[0].status === 'approved');
  assert.match(await p.locator('[data-prepaid]').innerText(), /PP-0001[\s\S]*12,000\.00[\s\S]*معتمد/);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.42 الدفعة 8 (U3): خريطة أقسام مصروفات الوردية — الاقتراح والحفظ بتاريخ بدء، و«يحدده المحاسب» يظهر للمحاسب ليحدد القسم', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/admin/cc');
  const td = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await p.evaluate(() => window.setOrg(o => ({ ...o, costDepts: { on: true, list: [{ id: 'k', name: 'المطبخ' }, { id: 'h', name: 'الصالة' }] } })));
  await p.waitForSelector('[data-deptmap]'); await p.click('[data-deptmap-edit]'); await p.waitForSelector('[data-deptmap-editor]');
  await p.click('[data-deptmap-save]'); await p.waitForFunction(() => ((window.curOrg.costDepts || {}).catMaps || []).length === 1);
  const cat = await p.evaluate(() => { const m = window.curOrg.costDepts.catMaps[0].map; return Object.keys(m).find(k => m[k] === 'pick'); });
  assert.ok(cat, 'الصيانة أو الكهرباء «يحدده المحاسب»');
  await p.evaluate(({ td, cat }) => window.setOps(o => ({ ...o, closings: [...(o.closings || []), { id: 'cz', branchId: 'b1', branchName: 'العليا', date: td, status: 'approved', cash: 0, card: 0, totalRevenue: 0, expenses: [{ id: 'z1', categoryId: cat, categoryName: 'صيانة', amount: 75, paymentMethod: 'cash' }] }] })), { td, cat });
  await p.waitForSelector('[data-deptmap-item="cz:z1"]');
  await p.getByLabel('قسم المصروف cz:z1').selectOption('k'); await p.click('[data-deptmap-item="cz:z1"] [data-deptmap-pick]');
  await p.waitForFunction(() => (window.cur.expDeptPicks || []).some(x => x.key === 'cz:z1' && x.deptId === 'k'));
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.43 الدفعة 10 (E8): هبوط قيمة أصل — إنشاء بمستند، اعتماد غير المنشئ، واختبار المؤشرات السنوي', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/acc/ast');
  await p.evaluate(() => window.setOrg(o => ({ ...o, impair: { on: true, lossAcc: '5806', accAcc: '1792' },
    customAccounts: [...(o.customAccounts || []), { code: '1792', name: 'مجمع خسائر الهبوط', kind: 'asset' }, { code: '5806', name: 'خسارة هبوط قيمة الأصول', kind: 'exp' }],
    assets: [...(o.assets || []), { id: 'az', name: 'فرن الاختبار', cost: 12000, buyDate: '2025-01-10', lifeYears: 5, fund: '1201', branchId: 'b1' }] })));
  await p.waitForSelector('[data-imp-row="az"]'); await p.locator('[data-imp-row="az"] [data-imp-new]').click();
  await p.getByLabel('مبلغ الهبوط').fill('1000'); await p.getByLabel('سبب الهبوط').fill('تلف جزئي — تقرير فني');
  await p.click('[data-imp-save]'); await p.waitForFunction(() => (window.cur.impairDocs || []).length === 1);
  assert.equal(await p.locator('[data-imp-wait]').count(), 1);
  await p.evaluate(() => window.as('admin')); await p.waitForSelector('[data-imp-ok]'); await p.click('[data-imp-ok]');
  await p.waitForFunction(() => window.cur.impairDocs[0].status === 'approved');
  assert.match(await p.locator('[data-imp-row="az"]').innerText(), /1,000\.00/);
  await p.click('[data-imt-new]'); await p.getByLabel('ملاحظات الاختبار').fill('لا فروع خاسرة ولا إغلاقات'); await p.click('[data-imt-save]');
  await p.waitForFunction(() => (window.cur.impairTests || []).length === 1);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.44 الدفعة 9 (H1): غياب بلا أجر — يظهر لمُعدّ الرواتب بأيام الشهر، ولا يظهر لفرع آخر', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/hr:leaves');
  const D = await p.evaluate(() => { const iso = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; const t = new Date(); return { from: iso(-30), to: iso(-25), ret: t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(Math.min(t.getDate(), 28)).padStart(2, '0') }; });
  await p.evaluate((D) => { window.setOrg(g => ({ ...g, lateRet: { unpaid: true } }));
    window.setOps(o => ({ ...o, leaveRequests: [{ id: 'lvU', employeeId: 'e1', employeeName: 'أحمد علي', branchId: 'b1', branchName: 'عم قاسم طيبة', type: 'annual', from: D.from, to: D.to, days: 5, status: 'approved',
      ret: { date: D.ret, kind: 'late', lateDays: 20, lateBal: 2, unpaidDays: 18, status: 'approved' } }] })); }, D);
  await p.waitForSelector('[data-lr-unpaid]'); assert.match(await p.locator('[data-lr-unpaid]').innerText(), /أحمد علي · هذا الشهر \d+ يوم \(الإجمالي 18\)/);
  assert.match(await p.locator('[data-lr-unpaid]').innerText(), /المادة 80/);
  await p.evaluate(() => window.setOps(o => ({ ...o, leaveRequests: o.leaveRequests.map(r => ({ ...r, branchId: 'b-other' })) })));
  await p.evaluate(() => window.as('bm')); await p.waitForTimeout(400);
  assert.equal(await p.locator('[data-lr-unpaid]').count(), 0, 'مدير فرع آخر لا يرى');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.45 الدفعة 11 (T1/T7): تسجيل تسليم النقد قبل الاعتماد ثم الاعتماد اللاحق، وبطاقتا الإعداد والمراجعة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  const td = await p.evaluate(() => new Date().toISOString().slice(0, 10));
  await p.evaluate((td) => { window.setOrg(o => ({ ...o, dsRoute: { ranges: [{ from: td }] }, dsPre: { ranges: [{ from: td }] } }));
    window.setOps(o => ({ ...o, transfers: [...(o.transfers || []), { id: 'tin', date: td, status: 'received', amount: 5000, branchName: 'العليا', referenceNo: 'T1' }],
      disbursements: [{ id: 'dh1', date: td, category: 'صيانة وتشغيل', amount: 200, beneficiary: 'ورشة', method: 'cash', by: 'محاسب آخر', byId: 'someone-else', status: 'pending' }] })); }, td);
  await p.locator('button:has-text("أوامر الصرف")').first().click(); await p.waitForSelector('[data-ds-hand]');
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept(d.type() === 'prompt' ? td : undefined).catch(() => {}));
  await p.click('[data-ds-hand]'); await p.waitForFunction((td) => (window.cur.disbursements.find(x => x.id === 'dh1') || {}).cashAt === td, td);
  assert.equal(await p.locator('[data-ds-handed]').count(), 1);
  assert.equal(await p.locator('[data-ds-ok]').count(), 0, 'من سجّل التسليم لا يعتمد (فصل المهام)');
  await p.evaluate(() => window.setOps(o => ({ ...o, disbursements: o.disbursements.map(x => x.id === 'dh1' ? { ...x, cashBy: 'أمين الخزينة', cashById: 'treasurer-x' } : x) })));
  await p.waitForSelector('[data-ds-ok]');
  await p.click('[data-ds-ok]'); await p.waitForFunction(() => (window.cur.disbursements.find(x => x.id === 'dh1') || {}).status === 'posted');
  const x = await p.evaluate(() => window.cur.disbursements.find(x => x.id === 'dh1'));
  assert.equal(x.lateAppr, true); assert.equal(x.postDate, td);
  assert.equal(await p.locator('[data-ds-late]').count(), 1);
  // نموذج الأمر الجديد: خيار «سُلِّم النقد فعلًا» وتنبيه المواد الخام
  await p.locator('button:has-text("أمر صرف جديد")').click();
  assert.equal(await p.locator('[data-ds-pre-chk]').count(), 0, 'المالك يرحّل مباشرة — لا خيار تسليم له');
  assert.equal(await p.locator('[data-ds-raw]').count(), 1);
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
    await p.evaluate(() => window.setOps(o => ({ ...o, disbursements: [{ id: 'old1', date: '2026-01-10', category: 'سداد موردين', amount: 1000, beneficiary: 'مورد', method: 'cash', by: 'أ' }] })));
    await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-dspre]');
    await p.click('[data-dspre-toggle]'); await p.waitForFunction(() => /ضوابط أوامر الصرف/.test(window.lastSay || ''));
    assert.equal(await p.evaluate(() => ((window.curOrg.dsPre || {}).ranges || []).length), 0, 'لا يُفعَّل قبل ضوابط أوامر الصرف');
    assert.equal(await p.locator('[data-dsmap-raw]').count(), 1);
    await p.click('[data-dsdup-open]'); await p.waitForSelector('[data-dsdup-row="old1"]');
    await p.selectOption('[data-dsdup-row="old1"] [data-dsdup-dr]', '1101'); await p.selectOption('[data-dsdup-row="old1"] [data-dsdup-cr]', '5901'); await p.click('[data-dsdup-row="old1"] [data-dsdup-fix]');
    await p.waitForFunction(() => (window.cur.journalManual || []).some(j => j.dsDup === 'old1'));
    const j = await p.evaluate(() => window.cur.journalManual.find(j => j.dsDup === 'old1'));
    assert.deepEqual(j.lines.map(l => l.code + ':' + l.debit + '/' + l.credit), ['1101:1000/0', '5901:0/1000']);
    await p.waitForSelector('[data-dsdup-fixed]');
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.46 الدفعة 12 (P9): «آجل» في الكاشير للعميل المؤهل فقط، والتفويض من الخادم شرط — بلا خادم لا تصدر فاتورة', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false },
      products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي' }],
      partners: [...(g.partners || []).filter(x => !['pc1', 'pc2'].includes(x.id)), { id: 'pc1', key: 'cust:pc1', type: 'customer', name: 'شركة مؤهلة', posCredit: true, creditLimit: 5000, terms: 30 },
        { id: 'pc2', key: 'cust:pc2', type: 'customer', name: 'شركة مسجلة', posCredit: true, creditLimit: 5000, tax: '300000000000003' }] }));
    window.setOps(o => ({ ...o, posTabs: [], kdsTickets: [], posOrders: [] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click();
  assert.equal(await p.locator('[data-credit]').count(), 0, 'بلا تفعيل لا آجل');
  await p.evaluate(() => window.setOrg(g => ({ ...g, posCfg: { ...g.posCfg, credit: true } }))); await p.waitForTimeout(300);
  await p.click('[data-credit]'); await p.waitForSelector('select[aria-label="عميل الآجل"]');
  const opts = await p.locator('select[aria-label="عميل الآجل"] option').allInnerTexts();
  assert.ok(opts.includes('شركة مؤهلة')); assert.ok(!opts.includes('شركة مسجلة'), 'ذو الرقم الضريبي يُحال إلى فواتير المبيعات');
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForFunction(() => /اختر عميلًا مؤهلًا/.test(window.lastSay || ''));
  await p.selectOption('select[aria-label="عميل الآجل"]', 'cust:pc1');
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForFunction(() => /البيع الآجل:/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => (window.cur.posOrders || []).length), 0, 'بلا تفويض الخادم لا تصدر فاتورة');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.47 (E7): سند صرف لمورد غير مقيم — نوع الاستقطاع المؤكَّد إلزامي، والسند يحمل الإجمالي والاستقطاع، وبطاقة الإعداد', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1100 } }, 'live/Hub/admin/finhub:treasury');
  await p.evaluate(() => { window.setOrg(g => ({ ...g, taxCfg: { enabled: false }, wht: { on: true, types: [{ id: 'wt1', name: 'خدمات فنية (تجريبي)', rate: 5, ok: true }, { id: 'wt2', name: 'نوع غير مؤكَّد', rate: 15, ok: false }] },
    suppliers: (g.suppliers || []).map(s => s.id === 's1' ? { ...s, nonResident: true, country: 'دولة تجريبية' } : s) })); window.setOps(o => ({ ...o, cashVouchers: [], invoices: [] })); });
  await p.waitForTimeout(300);
  await p.locator('[data-tabcv]').click(); await p.waitForTimeout(200);
  await p.locator('[data-newcv="pv"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-cvpt="sup"]').click(); await p.selectOption('select[aria-label="جهة السند"]', 'sup:s1');
  await p.locator('[data-cvpm="bank"]').click(); await p.fill('input[aria-label="مبلغ السند"]', '10000'); await p.fill('input[aria-label="بيان السند"]', 'خدمة تجريبية');
  await p.waitForSelector('[data-cv-whtbox]');
  assert.deepEqual(await p.locator('[data-cv-whttype] option').evaluateAll(os => os.map(o => o.value)), ['', 'wt1'], 'المؤكَّد فقط');
  await p.locator('[data-cvsave]').click(); await p.waitForFunction(() => /اختر نوع ضريبة الاستقطاع/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => (window.cur.cashVouchers || []).length), 0);
  await p.selectOption('[data-cv-whttype]', 'wt1');
  assert.match(await p.locator('[data-cv-whtcalc]').innerText(), /9,500/);
  await p.locator('[data-cvsave]').click(); await p.waitForFunction(() => (window.cur.cashVouchers || []).length === 1);
  const v = await p.evaluate(() => { const v = window.cur.cashVouchers[0]; return [v.no, v.amount, v.fund, v.whtType, v.whtRate, v.whtAmt, v.whtCountry]; });
  assert.deepEqual(v, ['PV-000001', 10000, '1201', 'wt1', 5, 500, 'دولة تجريبية']);
  await p.waitForFunction(() => /PV-000001/.test((document.querySelector('.mz-docv iframe') || {}).srcdoc || ''));
  const doc = await p.evaluate(() => (document.querySelector('.mz-docv iframe') || {}).srcdoc || '');
  assert.match(doc, /المبلغ الإجمالي/); assert.match(doc, /ضريبة الاستقطاع/); assert.match(doc, /الصافي المدفوع/); assert.match(doc, /9,500/);
  await p.locator('.mz-docv button', { hasText: 'إغلاق' }).click().catch(() => {}); await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-cv-wht]').count(), 1, 'القائمة تُظهر الاستقطاع والصافي');
  assert.deepEqual(errs, []); await ctx.close();
  { const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
    await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-whtcard]');
    assert.equal(await p.locator('[data-wht-types]').count(), 0, 'بلا تفعيل ولا أنواع: لا جدول');
    p.removeAllListeners('dialog'); p.on('dialog', d => d.accept().catch(() => {}));
    await p.click('[data-wht-toggle]'); await p.waitForFunction(() => (window.curOrg.wht || {}).on === true);
    await p.click('[data-wht-add]'); await p.fill('[data-wht-types] input[aria-label="اسم نوع الاستقطاع"]', 'نوع تجريبي'); await p.fill('[data-wht-types] input[aria-label="نسبة نوع الاستقطاع"]', '5');
    await p.click('[data-wht-save]'); await p.waitForFunction(() => ((window.curOrg.wht || {}).types || []).length === 1);
    assert.deepEqual(await p.evaluate(() => window.curOrg.wht.types.map(t => [t.name, t.rate, t.ok])), [['نوع تجريبي', 5, false]], 'لا يؤكَّد إلا بوسم صريح');
    assert.deepEqual(errs, []); await ctx.close(); }
});

test('v56.47 (P4): قائمة أسعار التطبيق في الكاشير — الدفع بتطبيق له أسعار يُمنع بقائمة «المطعم»، واختيار القائمة يعيد التسعير ويُحفظ على الطلب', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1000 } }, 'live/PosApp/bm');
  await p.evaluate(() => {
    window.setOrg(g => ({ ...g, taxCfg: { enabled: true, rate: 15 }, posCfg: { branches: ['b1'], autoPrint: false }, deliveryApps: [{ id: 'jahez', n: 'جاهز', c: 0 }, { id: 'toyou', n: 'تويو', c: 0 }],
      products: [{ id: 'k', name: 'كبسة', sellPrice: 58, cat: 'رئيسي', appPrices: { jahez: 65 } }] }));
    window.setOps(o => ({ ...o, posTabs: [], kdsTickets: [], posOrders: [] }));
  }); await p.waitForTimeout(400);
  const ob = p.locator('button:has-text("فتح الوردية")'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(400); }
  await p.locator('.pos-tile:has-text("كبسة")').click();
  assert.equal(await p.locator('[data-pricelist]').count(), 0, 'بلا تفعيل لا منتقي');
  await p.evaluate(() => window.setOrg(g => ({ ...g, posCfg: { ...g.posCfg, appPrices: true } }))); await p.waitForTimeout(300);
  await p.waitForSelector('[data-pricelist]');
  assert.deepEqual(await p.locator('select[aria-label="قائمة الأسعار"] option').allInnerTexts(), ['المطعم', 'جاهز'], 'التطبيق ذو الأسعار فقط');
  await p.locator('button:has-text("تطبيق توصيل")').click(); await p.waitForSelector('.modal');
  await p.click('.modal button:has-text("تأكيد")'); await p.waitForFunction(() => /أسعار خاصة/.test(window.lastSay || ''));
  assert.equal(await p.evaluate(() => (window.cur.posOrders || []).length + (JSON.parse(localStorage.getItem('mizan:posQueue') || '[]')).length), 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.selectOption('select[aria-label="قائمة الأسعار"]', 'jahez'); await p.waitForTimeout(200);
  assert.ok(await p.locator('.pos-line:has-text("كبسة")').innerText().then(t => /65/.test(t)), 'السطر بسعر التطبيق');
  await p.locator('button:has-text("تطبيق توصيل")').click(); await p.waitForSelector('.modal');
  await p.click('.modal button:has-text("تأكيد")');
  await p.waitForFunction(() => (window.cur.posOrders || []).length === 1, null, { timeout: 15000 });
  const o = await p.evaluate(() => { const o = window.cur.posOrders[0]; return [o.priceList, o.lines[0].price, o.total, o.payments[0].m, o.payments[0].appId]; });
  assert.deepEqual(o, ['jahez', 65, 65, 'app', 'jahez']);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.47 النقاط اليدوية: التفعيل ثم الإيقاف يحفظ سجل النطاق ولا يمحوه', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-loyman-toggle]');
  await p.click('[data-loyman-toggle]'); await p.waitForFunction(() => (((window.curOrg.posGl || {}).manLoyRanges) || []).length === 1);
  await p.click('[data-loyman-toggle]'); await p.waitForFunction(() => !!((((window.curOrg.posGl || {}).manLoyRanges) || [])[0] || {}).to);
  assert.equal(await p.evaluate(() => window.curOrg.posGl.manLoyRanges.length), 1, 'الإيقاف يغلق النطاق ولا يحذفه');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.48 توزيع الإهلاك على الفروع: التفعيل يُنشئ نطاقًا من الشهر الجاري، والإيقاف يغلقه ولا يمحوه', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/Admin/admin');
  await p.click('button:has-text("صيانة النظام")'); await p.waitForSelector('[data-depbr-toggle]');
  assert.match(await p.locator('[data-depbr-st]').innerText(), /غير مفعّل/, 'معطّل افتراضيًا');
  assert.match(await p.locator('[data-depbr-hint]').innerText(), /مركز التكلفة/);
  await p.click('[data-depbr-toggle]'); await p.waitForFunction(() => (((window.curOrg.depBranch || {}).ranges) || []).length === 1);
  const r = await p.evaluate(() => window.curOrg.depBranch.ranges[0]); const d = new Date();
  assert.equal(r.from, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), 'من الشهر الجاري'); assert.equal(r.to, undefined);
  await p.click('[data-depbr-toggle]'); await p.waitForFunction(() => !!((((window.curOrg.depBranch || {}).ranges) || [])[0] || {}).to);
  assert.equal(await p.evaluate(() => window.curOrg.depBranch.ranges.length), 1, 'الإيقاف يغلق النطاق ولا يحذفه');
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.48 نقل الأصل بين مراكز التكلفة (قرار المالك): مع التوزيع يُحفظ سجل يبدأ النقل فيه من الشهر الجاري', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1200 } }, 'live/Accounting/acc/ast');
  const cur = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
  await p.evaluate((cur) => window.setOrg(o => ({ ...o, depBranch: { ranges: [{ from: cur, at: 'x' }] },
    assets: [...(o.assets || []), { id: 'aq', name: 'فرن النقل', cost: 12000, buyDate: '2025-01-10', lifeYears: 5, fund: '1201', branchId: 'b1' }] })), cur);
  await p.evaluate(() => window.as('admin'));   // التعديل لمن يملكه
  const row = p.locator('tr:has-text("فرن النقل"):has(button:has-text("تعديل"))').first(); await row.waitFor(); await row.locator('button:has-text("تعديل")').click();
  await p.selectOption('select[aria-label="فرع الأصل"]', ''); await p.click('.modal button:has-text("حفظ الأصل")');
  await p.waitForFunction(() => !!((window.curOrg.assets || []).find(a => a.id === 'aq') || {}).brHist);
  assert.deepEqual(await p.evaluate(() => window.curOrg.assets.find(a => a.id === 'aq').brHist), [{ from: '2025-01', branchId: 'b1' }, { from: cur, branchId: '' }]);
  assert.deepEqual(errs, []); await ctx.close();
});

test('v56.50 الرسائل: مفتاح مسار الإرسال لمسؤول النظام، دفعة من قالب بجمهور مقنّع، لا يعتمدها منشئها، يعتمدها المدير العام، وإرسال تجريبي عبر الخادم', async () => {
  const { p, errs, ctx } = await open({ viewport: { width: 1300, height: 1300 } }, 'live/MktGrowth/admin');
  await p.evaluate(() => { localStorage.setItem('rms8:loy', JSON.stringify({ members: { '501111111': { name: 'سارة' } }, tx: [{ id: 'x:e', phone: '501111111', pts: 40, at: '2026-01-01T10:00:00Z' }] }));
    window.setOrg(o => ({ ...o, mkt: { ...(o.mkt || {}), comms: { channels: { sms: true }, templates: [{ id: 't1', name: 'عرض الشتاء', ch: 'sms', body: 'أهلًا {name}، رصيدك {points} نقطة' }] } } }));
    window.setOps(o => ({ ...o, commsJobs: [], mktConsents: [{ id: 'c1', phone: '501111111', status: 'in', ch: 'all', src: 'نقطة البيع', by: 'x', at: '2026-01-01T10:00:00Z' },
      { id: 'c2', phone: '502222222', status: 'in', ch: 'all', src: 'نقطة البيع', by: 'x', at: '2026-01-01T10:00:00Z' }, { id: 'c3', phone: '502222222', status: 'out', ch: 'all', src: 'نقطة البيع', by: 'x', at: '2026-02-01T10:00:00Z' }] })); });
  await p.evaluate(() => window.as('ho')); await p.waitForTimeout(100); await p.evaluate(() => window.as('admin')); await p.waitForTimeout(300);   // إعادة تحميل الولاء
  // المفتاح: معطّل افتراضيًا، ومسؤول النظام يفعّله، وحفظ الإعدادات لا يمسّه
  await p.click('[data-mktv="com"]'); await p.waitForSelector('[data-comsend]');
  assert.match(await p.locator('[data-comsend-st]').innerText(), /غير مفعّل/);
  await p.click('[data-comsend-toggle]'); await p.waitForFunction(() => window.curOrg.mkt.comms.sendOn === true);
  await p.click('[data-comsave]'); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => window.curOrg.mkt.comms.sendOn), true, 'حفظ الإعدادات يُبقي المفتاح');
  // دفعة جديدة: الجمهور الموافقون فقط والأرقام مقنّعة
  await p.click('[data-mktv="msg"]'); await p.waitForSelector('[data-cms]');
  assert.match(await p.locator('[data-cmsoff]').innerText(), /لا تُرسل أي رسالة فعلًا/); assert.match(await p.locator('[data-cmsoff]').innerText(), /اسم مرسل مسجّل/);
  await p.click('[data-cmsnew]'); await p.waitForSelector('[data-cmsaud]');
  assert.equal(await p.locator('[data-cmsn]').innerText(), '1');
  const aud = await p.locator('[data-cmsaud]').innerText(); assert.match(aud, /50•••••11/); assert.ok(!/501111111|502222222/.test(aud), 'لا رقم كامل في الواجهة'); assert.match(aud, /طلبوا الإيقاف 1/);
  await p.click('[data-cmssave]'); await p.waitForFunction(() => (window.cur.commsJobs || []).length === 1);
  let j = await p.evaluate(() => window.cur.commsJobs[0]); assert.deepEqual([j.status, j.kind, j.ch, j.est.n, j.byId], ['draft', 'campaign', 'sms', 1, 'u1']);
  await p.click('[data-cmssubmit]'); await p.waitForFunction(() => window.cur.commsJobs[0].status === 'pending');
  assert.equal(await p.locator('[data-cmsapprove]').count(), 0, 'المنشئ لا يرى الاعتماد'); assert.match(await p.locator('[data-cmswait]').innerText(), /لا يعتمد المنشئ/);
  // المدير العام يعتمد ثم يرسل تجريبيًا — الخادم يتلقى معرّف الدفعة وحده
  await p.evaluate(() => window.as('gm')); await p.waitForTimeout(300); await p.click('[data-mktv="msg"]'); await p.waitForSelector('[data-cmsapprove]');
  await p.click('[data-cmsapprove]'); await p.waitForFunction(() => window.cur.commsJobs[0].status === 'approved');
  j = await p.evaluate(() => window.cur.commsJobs[0]); assert.deepEqual([j.approvedBy, j.approvedById], ['فهد', 'u6']);
  let sent = null;
  await p.route('http://zatca.test/api/comms/send', r => { sent = JSON.parse(r.request().postData()); r.fulfill({ json: { result: { n: 1, ok: 1, fail: 0, parts: 1, dry: true, adapter: 'dryrun', at: new Date().toISOString() }, sample: [{ m: '50•••••11', parts: 1 }] } }); });
  await p.click('[data-cmssend]'); await p.waitForFunction(() => window.cur.commsJobs[0].status === 'sent');
  assert.deepEqual(sent, { jobId: j.id }, 'لا قائمة مستلمين من المتصفح');
  j = await p.evaluate(() => window.cur.commsJobs[0]); assert.equal(j.result.dry, true); assert.equal(j.sentBy, 'فهد');
  assert.match(await p.locator('[data-cmsres]').innerText(), /تجريبي/);
  assert.deepEqual(errs, []); await ctx.close();
});
