// v56.0 — قبول البنود المتبقية على الإطار الحقيقي (وضع التخزين المحلي): البحث العام، الاختصارات، لوحة الدور، محدد المنشأة.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const assert = require('assert');
const [base, out] = [process.argv[2] || 'http://localhost:4173/', process.argv[3] || 'e2e'];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(base); await p.waitForTimeout(2500);
  const inp = p.locator('input');
  await inp.nth(0).fill('مطاعم الواحة'); await inp.nth(1).fill('300000000000003'); await inp.nth(2).fill('المالك'); await inp.nth(3).fill('o@oasis.test'); await inp.nth(4).fill('Owner#2026pass'); await inp.nth(5).fill('Owner#2026pass');
  await p.click('button:has-text("إنشاء المنصة")'); await p.waitForTimeout(3500);
  const res = []; const check = async (n, f) => { try { await f(); res.push('PASS ' + n); } catch (e) { res.push('FAIL ' + n + ' — ' + String(e.message).slice(0, 160)); } };
  await check('لوحة الدور في الرئيسية (مسؤول النظام ⇒ الإدارة العليا) بمؤشرات ومقارنة واتجاه', async () => {
    await p.keyboard.press('Alt+KeyH'); await p.waitForTimeout(1200);   // التهيئة الأولى تفتح الإعدادات
    const d = p.locator('[data-roledash]'); await d.waitFor({ timeout: 8000 }); assert.equal(await d.getAttribute('data-roledash'), 'exec');
    assert.ok(await p.locator('[data-rd-kpi]').count() >= 4); assert.equal(await p.locator('[data-rd-trend] .rd-bar').count(), 6);
    const opts = await p.locator('[data-roledash-pick] option').count(); assert.equal(opts, 9, 'المالك يرى اللوحات التسع');
    await p.screenshot({ path: path.join(out, 'shell-roledash.png') });
    await p.selectOption('[data-roledash-pick]', 'hr'); await p.waitForTimeout(400); assert.equal(await d.getAttribute('data-roledash'), 'hr');
  });
  await check('Ctrl+K يفتح البحث العام، ويجد شاشة ويفتحها بـ Enter', async () => {
    await p.keyboard.press('Control+k'); await p.locator('[data-gs-input]').waitFor({ timeout: 4000 });
    await p.locator('[data-gs-input]').fill('المحاسبة'); await p.waitForTimeout(300);
    assert.ok(await p.locator('[data-gs-kind="screen"]').count() >= 1);
    await p.screenshot({ path: path.join(out, 'shell-search.png') });
    await p.keyboard.press('Enter'); await p.waitForTimeout(1200); assert.equal(await p.locator('[data-gsearch]').count(), 0, 'أُغلقت النافذة');
    assert.match(await p.locator('.toptitle').innerText(), /المالية والمحاسبة|المحاسبة/);
  });
  await check('«؟» تعرض قائمة الاختصارات، وEsc يغلق', async () => {
    await p.locator('body').click({ position: { x: 600, y: 500 } }).catch(() => {}); await p.keyboard.press('Shift+Slash'); await p.locator('[data-kbhelp]').waitFor({ timeout: 4000 });
    await p.screenshot({ path: path.join(out, 'shell-shortcuts.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); assert.equal(await p.locator('[data-kbhelp]').count(), 0);
  });
  await check('Alt+H الرئيسية · Alt+D الوضع الداكن', async () => {
    await p.keyboard.press('Alt+KeyH'); await p.waitForTimeout(800); assert.equal((await p.locator('.toptitle').innerText()).trim(), 'الرئيسية');
    await p.keyboard.press('Alt+KeyD'); await p.waitForTimeout(500); assert.ok(await p.locator('.rms.mode-dark').count() >= 1, 'داكن');
    await p.screenshot({ path: path.join(out, 'shell-dark-home.png') });
    await p.keyboard.press('Alt+KeyD'); await p.waitForTimeout(300);
  });
  await check('الكتابة في حقل لا تُطلق الاختصارات', async () => {
    await p.keyboard.press('Control+k'); await p.locator('[data-gs-input]').fill('/?'); await p.waitForTimeout(200);
    assert.equal(await p.locator('[data-gs-input]').inputValue(), '/?'); assert.equal(await p.locator('[data-kbhelp]').count(), 0); await p.keyboard.press('Escape');
  });
  await check('محدد المنشأة: القائمة تعرض المنشأة الحالية، ورمز غير صالح لا يُرسل', async () => {
    await p.locator('[data-tenant-chip]').click(); await p.locator('[data-tenant-menu]').waitFor({ timeout: 3000 });
    assert.match(await p.locator('[data-tenant-menu]').innerText(), /مطاعم الواحة[\s\S]*default/);
    await p.locator('[data-tenant-code]').fill('../x'); assert.equal(await p.locator('[data-tenant-menu] form button').isDisabled(), true);
    await p.screenshot({ path: path.join(out, 'shell-tenant-switcher.png') });
    const list = await p.evaluate(() => JSON.parse(localStorage.getItem('mq:tenants') || '[]')); assert.equal(list[0].id, 'default');
  });
  await check('بلا أخطاء تشغيل', async () => assert.deepEqual(errs, []));
  await b.close(); fs.writeFileSync(path.join(out, 'shell-result.txt'), res.join('\n') + '\n'); console.log(res.join('\n'));
  process.exit(res.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
