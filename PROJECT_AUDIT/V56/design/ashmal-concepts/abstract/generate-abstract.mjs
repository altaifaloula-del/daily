import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const S = process.argv[2], OUT = process.argv[3], ROOT = process.argv[4];
const req = createRequire(path.join(S, 'brandtool/node_modules/x.js'));
const fk = req('fontkit'); const f = (p, n) => fs.readFileSync(path.join(S, 'brandtool/node_modules/@fontsource', p, 'files', n));
const AR = fk.create(f('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-700-normal.woff')), EN = fk.create(f('manrope', 'manrope-latin-800-normal.woff'));
const C = { navy: '#10294A', gold: '#D9A83E', white: '#FFFFFF', deep: '#091A30', black: '#000' };
const AF = ['ccmp','isol','init','medi','fina','rlig','calt','liga','kern','mark','mkmk'];
function tp(font, s, size, track = 0, feats) { const r = font.layout(s, feats), sc = size / font.unitsPerEm; let x = 0, d = '', t = 1e9, b = -1e9;
  r.glyphs.forEach((g, i) => { const p = r.positions[i]; d += g.path.scale(sc, -sc).translate(x + p.xOffset * sc, -p.yOffset * sc).toSVG();
    const bb = g.bbox; if (isFinite(bb.minY)) { t = Math.min(t, -bb.maxY * sc); b = Math.max(b, -bb.minY * sc); } x += p.xAdvance * sc + (i < r.glyphs.length - 1 ? track * size : 0); });
  return { d: d.replace(/-?\d+\.\d+/g, n => String(+(+n).toFixed(2))), w: x, top: t, bottom: b }; }
const P = (a) => a.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');
const mir = (a) => a.map(([x, y]) => [100 - x, y]).reverse();

const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/* ---------- A: «المربع المكتمل» — أربع وحدات تدور حول نواة ذهبية وتكتمل في مربع واحد ---------- */
function c1() { const g = 2.5, k = 14;
  const top = [[10 + k, 10 + g], [62 - g, 10 + g], [62 - g, 38 - g], [10 + g, 38 - g], [10 + g, 10 + k]];
  const right = [[62 + g, 10 + g], [90 - k, 10 + g], [90 - g, 10 + k], [90 - g, 62 - g], [62 + g, 62 - g]];
  const bottom = [[38 + g, 62 + g], [90 - g, 62 + g], [90 - g, 90 - k], [90 - k, 90 - g], [38 + g, 90 - g]];
  const left = [[10 + g, 38 + g], [38 - g, 38 + g], [38 - g, 90 - g], [10 + k, 90 - g], [10 + g, 90 - k]];
  return [{ c: 'o', p: top }, { c: 'o', p: right }, { c: 'o', p: bottom }, { c: 'o', p: left }, { c: 'i', p: R(38 + g, 38 + g, 62 - g, 62 - g) }]; }
/* ---------- B: «المحور» — إطار مثمّن من أربعة أقسام حول قلب ذهبي ---------- */
function c2() { const ci = 24 - 14 * 0.4142, g = 3;
  const q = [[50 - g, 8], [32, 8], [8, 32], [8, 50 - g], [22, 50 - g], [22, 22 + ci], [22 + ci, 22], [50 - g, 22]];
  const mx = (p) => p.map(([x, y]) => [100 - x, y]).reverse(), my = (p) => p.map(([x, y]) => [x, 100 - y]).reverse();
  return [{ c: 'o', p: q }, { c: 'o', p: mx(q) }, { c: 'o', p: my(q) }, { c: 'o', p: my(mx(q)) }, { c: 'i', p: [[50, 31], [69, 50], [50, 69], [31, 50]] }]; }
/* ---------- C: «لوحة الوحدات» — شبكة وحدات بأحجام مختلفة تبني منصة واحدة ---------- */
function c3() { const g = 5, u = (80 - 2 * g) / 3, X = (i) => 10 + i * (u + g), k = 12;
  const big = [[X(0) + k, X(0)], [X(1) + u, X(0)], [X(1) + u, X(1) + u], [X(0), X(1) + u], [X(0), X(0) + k]];
  const wide = [[X(1), X(2)], [X(2) + u, X(2)], [X(2) + u, X(2) + u - k], [X(2) + u - k, X(2) + u], [X(1), X(2) + u]];
  return [{ c: 'o', p: big }, { c: 'i', p: R(X(2), X(0), X(2) + u, X(0) + u) }, { c: 'o', p: R(X(2), X(1), X(2) + u, X(1) + u) }, { c: 'o', p: R(X(0), X(2), X(0) + u, X(2) + u) }, { c: 'o', p: wide }]; }
/* ---------- D: «الطبقات» — منصة من طبقات متراكبة، الذهبية في القمة ---------- */
function c4() { const top = [[50, 12], [88, 31], [50, 50], [12, 31]];
  const band = (dy) => [[12, 31 + dy], [50, 50 + dy], [88, 31 + dy], [88, 41 + dy], [50, 60 + dy], [12, 41 + dy]];
  return [{ c: 'i', p: top }, { c: 'o', p: band(16) }, { c: 'o', p: band(32) }]; }
const CONCEPTS = [
  ['1', 'المربع المكتمل', 'أربع وحدات تدور حول نواة ذهبية وتكتمل في مربع واحد: كل أقسام المنشأة في كيان واحد متكامل', c1],
  ['2', 'المحور', 'إطار مثمّن من أربعة أقسام (المالية، المبيعات، المخزون، الموارد) يحيط بقلب ذهبي: البيانات الموحدة', c2],
  ['3', 'لوحة الوحدات', 'شبكة وحدات بأحجام مختلفة تشكّل لوحة واحدة: بناء المنصة نفسه (وحدات + لوحات تحكم)', c3],
  ['4', 'الطبقات', 'منصة من طبقات متراكبة تعلوها طبقة ذهبية: البنية والتشغيل والقرار', c4],
];
const sym = (sh, col, dx = 0, dy = 0, s = 1) => `<g transform="translate(${dx} ${dy}) scale(${s})">` + sh.map(e => { const fill = e.c === 'o' ? col.o : col.i;
  return e.d ? `<path d="${e.d}" fill="${fill}" fill-rule="evenodd"/>` : `<polygon points="${P(e.p)}" fill="${fill}"/>`; }).join('') + '</g>';
const arH = tp(AR, 'أشمل', 54, 0, AF), enH = tp(EN, 'ASHMAL', 17, 0.24, ['kern']);
const arV = tp(AR, 'أشمل', 64, 0, AF), enV = tp(EN, 'ASHMAL', 24, 0.2, ['kern']);
function horiz(sh, col, clear = 20) { const hx = 124, bw = Math.max(arH.w, enH.w), g = 9, bh = arH.bottom - arH.top + g + enH.bottom - enH.top, b0 = 50 - bh / 2;
  const W = hx + bw + 2 * clear, H = 100 + 2 * clear;
  return { W, H, body: `<g transform="translate(${clear} ${clear})">${sym(sh, col)}<path d="${arH.d}" transform="translate(${hx + (bw - arH.w) / 2} ${b0 - arH.top})" fill="${col.t}"/><path d="${enH.d}" transform="translate(${hx + (bw - enH.w) / 2} ${b0 + arH.bottom - arH.top + g - enH.top})" fill="${col.t}"/></g>` }; }
function stack(sh, col, clear = 20) { const w = Math.max(100, arV.w, enV.w), ay = 116 - arV.top, ey = ay + arV.bottom + 14 - enV.top, h = ey + enV.bottom;
  return { W: w + 2 * clear, H: h + 2 * clear, body: `<g transform="translate(${clear} ${clear})">${sym(sh, col, (w - 100) / 2)}<path d="${arV.d}" transform="translate(${(w - arV.w) / 2} ${ay})" fill="${col.t}"/><path d="${enV.d}" transform="translate(${(w - enV.w) / 2} ${ey})" fill="${col.t}"/></g>` }; }
const svg = (L, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W.toFixed(1)} ${L.H.toFixed(1)}" role="img" aria-label="ASHMAL — أشمل"><title>ASHMAL — أشمل</title>${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${L.body}</svg>`;
const PRI = { o: C.navy, i: C.gold, t: C.navy }, REV = { o: C.white, i: C.gold, t: C.white }, BLK = { o: C.black, i: C.black, t: C.black };
const icon = (sh, r = 112) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${r}" fill="${C.navy}"/>${sym(sh, REV, 102.4, 102.4, 3.072)}</svg>`;
const fav = (sh) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${C.navy}"/>${sym(sh, REV, 6, 6, 0.52)}</svg>`;
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(path.join(ROOT, 'x.js'))('playwright');
const b = await chromium.launch(); const pg = await b.newPage({ deviceScaleFactor: 2 });
const shot = async (html, w, h, file) => { await pg.setViewportSize({ width: w, height: h }); await pg.setContent(html); await pg.waitForTimeout(60); await pg.screenshot({ path: path.join(OUT, file), fullPage: true }); };
const css = `*{box-sizing:border-box} body{margin:0;font-family:system-ui;background:#F3F5F8;color:#10294A} .h{font:700 22px system-ui;margin:0 0 4px} .s{font:14px system-ui;color:#4A5A70;margin:0 0 18px}
 .row{display:flex;gap:18px;align-items:center;margin-bottom:18px;flex-wrap:wrap} .card{background:#fff;border:1px solid #DDE3EA;border-radius:14px;padding:18px;display:flex;align-items:center;justify-content:center}
 .dark{background:#10294A;border-color:#10294A} .deep{background:#091A30;border-color:#091A30} .lab{font:12px system-ui;color:#6B7A8F;text-align:center;margin-top:6px} svg{display:block}`;
const sheetCompare = []; 
for (const [id, name, desc, fn] of CONCEPTS) { const sh = fn();
  const H = horiz(sh, PRI), HR = horiz(sh, REV), V = stack(sh, PRI), HB = horiz(sh, BLK);
  for (const [k, L, bg] of [['horizontal-primary', H], ['horizontal-reverse', HR, C.navy], ['stacked-primary', V], ['horizontal-black', HB]]) fs.writeFileSync(path.join(OUT, `ashmal-a${id}-${k}.svg`), svg(L, bg));
  fs.writeFileSync(path.join(OUT, `ashmal-a${id}-symbol.svg`), svg({ W: 140, H: 140, body: `<g transform="translate(20 20)">${sym(sh, PRI)}</g>` }));
  fs.writeFileSync(path.join(OUT, `ashmal-a${id}-app-icon.svg`), icon(sh));
  const sz = (s) => `<div><div class="card" style="width:${Math.max(s, 40) + 20}px;height:${Math.max(s, 40) + 20}px;padding:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100">${sym(sh, PRI)}</svg></div><div class="lab">${s}px</div></div>`;
  const html = `<html dir="rtl"><head><style>${css}</style></head><body style="padding:28px;width:1180px">
   <p class="h">النموذج ${id} — «${name}»</p><p class="s">${desc}</p>
   <div class="row"><div class="card" style="width:560px;height:200px"><svg width="520" viewBox="0 0 ${H.W} ${H.H}">${H.body}</svg></div>
     <div class="card dark" style="width:560px;height:200px"><svg width="520" viewBox="0 0 ${HR.W} ${HR.H}">${HR.body}</svg></div></div>
   <div class="row"><div class="card" style="width:300px;height:300px"><svg width="250" viewBox="0 0 ${V.W} ${V.H}">${V.body}</svg></div>
     <div class="card" style="width:300px;height:300px;padding:0;background:none;border:0"><svg width="240" height="240" viewBox="0 0 512 512">${icon(sh).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg></div>
     <div class="card" style="width:400px;height:300px;flex-direction:column;gap:14px"><svg width="360" viewBox="0 0 ${HB.W} ${HB.H}">${HB.body}</svg>
       <div style="display:flex;gap:12px;align-items:center">${[64, 32, 16].map(s => `<svg width="${s}" height="${s}" viewBox="0 0 64 64">${fav(sh).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`).join('')}<span class="lab">أيقونة المتصفح 64/32/16</span></div></div></div>
   <div class="row">${[200, 96, 64, 32, 16].map(sz).join('')}</div></body></html>`;
  await shot(html, 1240, 900, `ashmal-abstract-${id}.png`);
  sheetCompare.push(`<div class="card" style="flex-direction:column;width:540px;height:250px;gap:6px"><svg width="470" viewBox="0 0 ${H.W} ${H.H}">${H.body}</svg><div class="lab" style="font-size:15px;color:#10294A"><b>${id}</b> — ${name}</div></div>`);
}
await shot(`<html dir="rtl"><head><style>${css}</style></head><body style="padding:28px;width:1180px"><p class="h">أشمل — ASHMAL · نماذج الرمز المجرد (غير مرتبطة بحرف)</p><p class="s">كحلي #10294A · ذهبي #D9A83E · IBM Plex Sans Arabic + Manrope (مسارات) · مسطح هندسي بزوايا 45°</p><div class="row">${sheetCompare.join('')}</div></body></html>`, 1180, 700, "ashmal-abstract-compare.png");
await b.close(); console.log('ok');
