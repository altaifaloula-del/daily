// v56.0 — المراجعة البصرية الشاملة: لقطة لكل مسار في التطبيق (حاسوب فاتح، جوال فاتح، حاسوب داكن) + أوراق تجميع للمراجعة.
// الاستعمال: node tests/design/sweep.mjs <outDir>
import { build as viteBuild } from 'vite'; import { chromium, devices } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), out = path.resolve(process.argv[2] || 'sweep');
const cache = path.join(root, 'tests', '.cache', 'sweep'); fs.mkdirSync(out, { recursive: true });
await viteBuild({ configFile: path.join(root, 'vite.config.js'), root, base: './', logLevel: 'error', build: { outDir: cache, emptyOutDir: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: path.join(root, 'tests', 'ui', 'fixture.html') } } });
const server = http.createServer((q, r) => { const f = path.join(cache, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\//, '')); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); r.end(d); }); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const base = 'http://127.0.0.1:' + server.address().port + '/tests/ui/fixture.html#';
const b = await chromium.launch();
const c0 = await b.newContext(); const p0 = await c0.newPage(); await p0.goto(base + 'comp/Launcher'); await p0.waitForTimeout(800);
const routes = (await p0.evaluate(() => window.routes)).filter(r => !process.argv[3] || r.includes(process.argv[3])); await c0.close();
const issues = [], shots = { desk: [], mob: [], dark: [] };
for (const [dev, opt, dark] of [['desk', { viewport: { width: 1280, height: 860 } }, false], ['mob', devices['iPhone 13'], false], ['dark', { viewport: { width: 1280, height: 860 } }, true]]) {
  const ctx = await b.newContext(opt);
  for (const r of routes) {
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 140))); p.on('dialog', d => d.dismiss().catch(() => {}));
    await p.goto(base + r + (dark ? '&dark' : '') + '&rp');   // الثيم الافتراضي الفعلي للمنصة await p.waitForTimeout(700);
    await p.waitForFunction(() => !document.querySelector('.mod-loading'), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(250);
    const m = await p.evaluate(() => ({ crash: document.getElementById('crash')?.innerText || '', over: document.documentElement.scrollWidth - window.innerWidth, txt: document.body.innerText.length,
      lowContrast: [...document.querySelectorAll('h1,h2,h3,.card-t,.btn,td,th,label')].slice(0, 400).filter(el => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || !el.offsetWidth) return false;
        let c = cs.color.match(/[\d.]+/g).map(Number); if (/^color\(srgb/.test(cs.color)) c = c.map((t, i) => i < 3 ? t * 255 : t); let n = el, bg = null; while (n) { const x = getComputedStyle(n).backgroundColor; let v = x.match(/[\d.]+/g); if (v && /^color\(srgb/.test(x)) v = v.map((t, i) => i < 3 ? String(+t * 255) : t);   /* color-mix ⇒ color(srgb 0–1) */ if (v && (v.length < 4 || +v[3] > 0.5)) { bg = v.map(Number); break; } n = n.parentElement; }
        if (!bg) bg = [255, 255, 255]; const L = (a) => { const s = a.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
        const l1 = L(c), l2 = L(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) < 3; }).map(el => el.tagName + ':' + (el.innerText || '').trim().slice(0, 30)).slice(0, 5) }));
    const f = dev + '__' + r.replace(/[^a-z0-9]+/gi, '_') + '.png'; await p.screenshot({ path: path.join(out, f) }); shots[dev].push([r, f]);
    if (m.crash || errs.length || m.over > 2 || m.txt < 40 || m.lowContrast.length) issues.push({ dev, r, crash: m.crash, errs, over: m.over, empty: m.txt < 40, lowContrast: m.lowContrast });
    await p.close();
  }
  await ctx.close();
}
// أوراق التجميع (24 لقطة مصغّرة لكل ورقة)
const pg = await b.newPage({ viewport: { width: 1800, height: 1200 } });
for (const [dev, L] of Object.entries(shots)) for (let i = 0; i < L.length; i += 24) {
  const html = '<body style="margin:6px;font:11px sans-serif;display:grid;grid-template-columns:repeat(6,1fr);gap:6px">' + L.slice(i, i + 24).map(([r, f]) =>
    `<figure style="margin:0;border:1px solid #ccc"><img src="data:image/png;base64,${fs.readFileSync(path.join(out, f)).toString('base64')}" style="width:100%;display:block"><figcaption style="padding:2px 4px">${r}</figcaption></figure>`).join('') + '</body>';
  await pg.setContent(html); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(out, `SHEET-${dev}-${String(i / 24 + 1).padStart(2, '0')}.png`), fullPage: true });
}
await b.close(); server.close();
fs.writeFileSync(path.join(out, 'issues.json'), JSON.stringify(issues, null, 1));
console.log('routes', routes.length, '× 3 =', routes.length * 3, 'shots · issues', issues.length);
