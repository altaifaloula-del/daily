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
  await viteBuild({ configFile: path.join(root, 'vite.config.js'), root, base: './', logLevel: 'error',
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
