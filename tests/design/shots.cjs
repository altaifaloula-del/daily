// v56.0 — لقطات قبل/بعد للتصميم: يهيّئ المنصة محليًا (وضع التخزين المحلي) ثم يلتقط الشاشات الأساسية.
// الاستعمال: node tests/design/shots.cjs <baseUrl> <outDir>
const { chromium, devices } = require('playwright');
const fs = require('fs'); const path = require('path');
const [base, out] = [process.argv[2] || 'http://localhost:4173/', process.argv[3] || 'shots'];
fs.mkdirSync(out, { recursive: true });
const errs = [];
async function boot(ctx) {
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(base); await p.waitForTimeout(2500);
  if (await p.locator('text=تهيئة المنصة لأول مرة').count()) {
    const inp = p.locator('input');
    await inp.nth(0).fill('مطاعم الواحة'); await inp.nth(1).fill('300000000000003'); await inp.nth(2).fill('مالك المنشأة');
    await inp.nth(3).fill('owner@oasis.test'); await inp.nth(4).fill('Owner#2026pass'); await inp.nth(5).fill('Owner#2026pass');
    await p.click('button:has-text("إنشاء المنصة")'); await p.waitForTimeout(3000);
  }
  return p;
}
async function snap(p, name) { await p.waitForTimeout(900); await p.screenshot({ path: path.join(out, name + '.png') }); }
async function go(p, label) {
  for (const sel of ['nav >> text=' + label, `button:has-text("${label}")`, `a:has-text("${label}")`, `text=${label}`]) {
    const l = p.locator(sel); const n = await l.count();
    for (let i = 0; i < n; i++) { const el = l.nth(i); if (await el.isVisible().catch(() => false)) { try { await el.click({ timeout: 3000 }); await p.waitForTimeout(1300); return true; } catch { } } }
  }
  return false;
}
(async () => {
  const b = await chromium.launch();
  for (const [dev, opt] of [['desktop', { viewport: { width: 1366, height: 860 } }], ['mobile', devices['iPhone 13']], ['tablet', { viewport: { width: 900, height: 1180 } }]]) {
    const ctx = await b.newContext(opt); const p = await boot(ctx);
    await snap(p, dev + '-01-home');
    if (dev === 'desktop') {
      for (const [lbl, n] of [['المحاسبة', '02-accounting'], ['نقطة البيع', '03-pos'], ['التقارير', '04-reports'], ['الإعدادات', '05-settings']]) { if (await go(p, lbl)) await snap(p, dev + '-' + n); }
      if (await go(p, 'بيانات الشركة والنسخ الاحتياطي')) { const c = p.locator('[data-tenant-branding]'); if (await c.count()) { await c.scrollIntoViewIfNeeded(); await snap(p, dev + '-07-tenant-branding'); } else await snap(p, dev + '-07-company'); }
      await p.evaluate(() => { try { localStorage.setItem('rms8:mode', 'dark'); } catch {} }); await p.reload(); await p.waitForTimeout(2500); await snap(p, dev + '-06-home-dark');
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'errors.json'), JSON.stringify(errs, null, 1)); console.log('errors:', errs.length);
})();
