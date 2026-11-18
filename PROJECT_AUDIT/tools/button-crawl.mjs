/**
 * زاحف الأزرار — تدقيق وظيفي آلي لكل زر في كل شاشة (MITHQAL Functional Audit).
 * يفتح كل شاشة بالبيانات الحية من tests/ui/fixture.jsx (دور مسؤول النظام، حاسوب)، ويضغط كل زر ظاهر في صفحة جديدة معزولة،
 * ثم يسجّل الأثر: تغيّر البيانات، طباعة/تنزيل/نافذة، تغيّر الواجهة، رسالة، أو لا أثر، أو خطأ/انهيار.
 * المتطلب: بناء tests/.cache/ui (يُنشئه npm run test:ui). التشغيل: node PROJECT_AUDIT/tools/button-crawl.mjs [ملف-الإخراج.json]
 */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.join(root, 'tests', '.cache', 'ui');
const out = process.argv[2] || path.join(root, 'PROJECT_AUDIT', 'FUNCTIONAL_AUDIT', 'button-crawl.json');
const MAX_BTN = +process.env.MAX_BTN || 60, WORKERS = +process.env.WORKERS || 6;
const server = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\//, ''));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); r.end(d); }); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + server.address().port + '/tests/ui/fixture.html#';
const browser = await chromium.launch();
const live = (r) => { const [k, a, b] = r.split('/'); return k === 'hub' ? 'live/Hub/admin/' + a + ':' + b : k === 'acct' ? 'live/Accounting/admin/' + a : 'live/' + a + '/admin'; };
const HOOK = () => { try { localStorage.clear(); sessionStorage.clear(); } catch { } window.__fx = []; window.print = () => window.__fx.push('print'); const o = window.open; window.open = (...x) => { window.__fx.push('open'); return { document: { write() { }, close() { } }, focus() { }, print() { window.__fx.push('print'); }, close() { } }; };
  const u = URL.createObjectURL; URL.createObjectURL = (b) => { window.__fx.push('blob'); return u.call(URL, b); }; };
const snap = (p) => p.evaluate(() => { const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  return { cur: h(JSON.stringify(window.cur || {})), org: h(JSON.stringify(window.curOrg || {})), ui: h(document.body.innerText), modal: document.querySelectorAll('.modal,.mbg,[role=dialog]').length, say: window.lastSay || '', fx: (window.__fx || []).join(','), nav: window.__nav || '', crash: window.__crash || '' }; });
const settle = async (p) => { await p.waitForFunction(() => !document.querySelector('.mod-loading'), null, { timeout: 15000 }).catch(() => { }); await p.waitForTimeout(250); };
const listBtns = (p) => p.evaluate((max) => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).slice(0, max)
  .map((b, i, all) => { const t = (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60); const title = b.title || b.getAttribute('aria-label') || '';
    const k = all.slice(0, i).filter(x => (x.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60) === t && (x.title || x.getAttribute('aria-label') || '') === title).length; return { i, k, t, title, dis: b.disabled }; }), MAX_BTN);
const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p0 = await ctx0.newPage(); await p0.goto(base + 'comp/Launcher'); await p0.waitForTimeout(400);
const routes = await p0.evaluate(() => window.routes); await ctx0.close();
const results = []; let next = 0;
async function worker() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); await ctx.addInitScript(HOOK);
  while (next < routes.length) {
    const r = routes[next++]; const h = live(r); const rec = { route: r, hash: h, buttons: [], openErr: [] };
    const p = await ctx.newPage(); p.on('pageerror', e => rec.openErr.push(e.message.slice(0, 160))); p.on('dialog', d => d.accept().catch(() => { }));
    await p.goto(base + h); await settle(p); const s0 = await snap(p); rec.crash = s0.crash; const btns = await listBtns(p); await p.close();
    for (const b of btns) {
      if (b.dis) { rec.buttons.push({ ...b, res: 'DISABLED' }); continue; }
      const q = await ctx.newPage(); const errs = []; let dl = 0; q.on('pageerror', e => errs.push(e.message.slice(0, 160))); q.on('dialog', d => d.accept().catch(() => { })); q.on('download', () => dl++);
      await q.goto(base + h); await settle(q); const a = await snap(q);
      // الزر نفسه بنصّه وترتيبه بين المتشابهين (لا بالفهرس العام الذي يتغير إن تغيّر ترتيب الصفحة)
      const ok = await q.evaluate(({ t, title, k }) => { const m = [...document.querySelectorAll('button')].filter(x => x.offsetParent !== null && (x.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60) === t && (x.title || x.getAttribute('aria-label') || '') === title);
        const el = m[k]; if (!el) return false; el.setAttribute('data-crawl', '1'); return true; }, b);
      try { if (!ok) throw new Error('الزر غير موجود عند إعادة الفتح'); await q.locator('[data-crawl="1"]').click({ timeout: 3000 }); } catch (e) { rec.buttons.push({ ...b, res: 'UNCLICKABLE', note: e.message.split('\n')[0].slice(0, 100) }); await q.close(); continue; }
      await q.waitForTimeout(350); await settle(q); const z = await snap(q);
      const res = (errs.length || (z.crash && !a.crash)) ? 'ERROR' : (z.cur !== a.cur || z.org !== a.org) ? 'DATA' : (dl || z.fx !== a.fx) ? 'OUTPUT' : (z.nav !== a.nav) ? 'NAV' : (z.ui !== a.ui || z.modal !== a.modal || z.say !== a.say) ? 'UI' : 'NO_EFFECT';
      rec.buttons.push({ ...b, res, say: z.say !== a.say ? z.say.slice(0, 120) : '', fx: z.fx !== a.fx ? z.fx : '', nav: z.nav !== a.nav ? z.nav : '', err: errs[0] || (z.crash !== a.crash ? z.crash : '') });
      await q.close();
    }
    results.push(rec); process.stdout.write('.');
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close(); server.close();
results.sort((x, y) => routes.indexOf(x.route) - routes.indexOf(y.route));
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(results, null, 1));
const all = results.flatMap(r => r.buttons); const by = {}; all.forEach(b => { by[b.res] = (by[b.res] || 0) + 1; });
console.log('\nroutes', results.length, 'buttons', all.length, JSON.stringify(by));
