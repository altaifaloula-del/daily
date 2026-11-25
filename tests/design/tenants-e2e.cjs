// v56.0 — قبول هوية المنشآت على الإطار الحقيقي للتطبيق (وضع التخزين المحلي): منشأتان في سياقي متصفح معزولين.
// الاستعمال: node tests/design/tenants-e2e.cjs <baseUrl> <outDir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const assert = require('assert');
const [base, out] = [process.argv[2] || 'http://localhost:4173/', process.argv[3] || 'e2e'];
fs.mkdirSync(out, { recursive: true });
const svgLogo = (c) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" rx="14" fill="${c}"/><circle cx="30" cy="30" r="12" fill="#fff"/></svg>`);
async function tenant(b, T) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(base); await p.waitForTimeout(2500);
  const inp = p.locator('input');
  await inp.nth(0).fill(T.co); await inp.nth(1).fill('300000000000003'); await inp.nth(2).fill('المالك'); await inp.nth(3).fill(T.mail); await inp.nth(4).fill('Owner#2026pass'); await inp.nth(5).fill('Owner#2026pass');
  await p.click('button:has-text("إنشاء المنصة")'); await p.waitForTimeout(3000);
  await p.locator('text=الإعدادات').first().click(); await p.waitForTimeout(1200);
  await p.locator('text=بيانات الشركة والنسخ الاحتياطي').first().click(); await p.waitForTimeout(1200);
  const card = p.locator('[data-tenant-branding]');
  await card.locator('[data-tb="nameAr"]').fill(T.ar); await card.locator('[data-tb="nameEn"]').fill(T.en);
  await card.locator('[data-tb-file="logo"]').setInputFiles({ name: 'l.svg', mimeType: 'image/svg+xml', buffer: svgLogo(T.color) }); await p.waitForTimeout(300);
  await card.locator('[data-tb-save]').click(); await p.waitForTimeout(1500);
  const chip = p.locator('[data-tenant-chip]');
  const r = { name: (await chip.innerText()).trim(), logo: await chip.locator('img').getAttribute('src'), mq: await p.locator('[data-mq-symbol]').first().evaluate(e => e.outerHTML), errs };
  await p.screenshot({ path: path.join(out, 'tenant-' + T.id + '.png') }); await ctx.close(); return r;
}
(async () => {
  const b = await chromium.launch();
  const A = await tenant(b, { id: 'A', co: 'مطاعم الواحة', ar: 'مطاعم الواحة', en: 'Oasis', mail: 'a@oasis.test', color: '#0B6E4F' });
  const B = await tenant(b, { id: 'B', co: 'مخابز السنبلة', ar: 'مخابز السنبلة', en: 'Sunbula', mail: 'b@sunbula.test', color: '#7A1F5C' });
  await b.close();
  const res = [];
  const check = (n, f) => { try { f(); res.push('PASS ' + n); } catch (e) { res.push('FAIL ' + n + ' — ' + e.message); } };
  check('1 رمز MUKTASAB مطابق حرفيًا في المنشأتين', () => assert.equal(A.mq, B.mq));
  check('2-3 كل منشأة ترى اسمها في الشريط', () => { assert.equal(A.name, 'مطاعم الواحة'); assert.equal(B.name, 'مخابز السنبلة'); });
  check('3 كل منشأة ترى شعارها', () => { assert.ok(Buffer.from(A.logo.split(',')[1], 'base64').toString().includes('#0B6E4F')); assert.ok(Buffer.from(B.logo.split(',')[1], 'base64').toString().includes('#7A1F5C')); });
  check('4 لا تداخل بين المنشأتين', () => { assert.notEqual(A.logo, B.logo); assert.ok(!B.name.includes('الواحة')); });
  check('بلا أخطاء تشغيل', () => { assert.deepEqual(A.errs, []); assert.deepEqual(B.errs, []); });
  fs.writeFileSync(path.join(out, 'result.txt'), res.join('\n') + '\n'); console.log(res.join('\n'));
  process.exit(res.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
