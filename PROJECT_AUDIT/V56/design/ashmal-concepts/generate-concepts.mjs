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

/* ---------- المفهوم 1: «الحاضن» — A كحلي يحتضن نواة ذهبية ---------- */
function c1() { const k = 32 / 76; // ميل الساق
  const outer = [[44, 12], [56, 12], [88, 88], [70, 88], [50, 88 - 20 / k], [30, 88], [12, 88]];
  const ga = 88 - 13 / k; const core = [[50, ga], [63, 88], [37, 88]];
  return [{ c: 'o', p: outer }, { c: 'i', p: core }]; }
/* ---------- المفهوم 2: «الإحاطة» — ألف وهمزة داخل إطار مثمن ---------- */
function oct(a, b, ch) { return [[a + ch, a], [b - ch, a], [b, a + ch], [b, b - ch], [b - ch, b], [a + ch, b], [a, b - ch], [a, b - ch], [a, a + ch]].filter((v, i, s) => i === 0 || v + '' !== s[i - 1] + ''); }
function c2() { const o = oct(8, 92, 22), i = oct(21, 79, 22 - 13 * 0.4142);
  const ring = 'M' + o.map(([x, y]) => x + ' ' + y).join(' L') + ' Z M' + i.map(([x, y]) => +x.toFixed(2) + ' ' + +y.toFixed(2)).join(' L') + ' Z';
  const alef = [[43, 76], [57, 76], [57, 44], [50, 37], [43, 44]];   // ألف بقمة مشطوفة 45°
  const hamza = [[50, 22], [57, 29], [50, 36 - 3], [43, 29]].map(([x, y]) => [x, y - 2]);
  return [{ c: 'o', d: ring }, { c: 'o', p: alef }, { c: 'i', p: [[50, 20], [56.5, 26.5], [50, 33], [43.5, 26.5]] }]; }
/* ---------- المفهوم 3: «الوحدات المجتمعة» — A من أربع وحدات منفصلة ---------- */
function c3() { const s = 0.34, x = (base, y) => base + s * (88 - y);
  const leg = [[12, 88], [30, 88], [x(30, 34), 34], [x(12, 34), 34]];
  const bar = [[x(30, 60) + 6, 60], [100 - x(30, 60) - 6, 60], [100 - x(30, 72) - 6, 72], [x(30, 72) + 6, 72]];
  const top = [[50, 6], [60, 16], [50, 26], [40, 16]];
  return [{ c: 'o', p: leg }, { c: 'o', p: mir(leg) }, { c: 'i', p: bar }, { c: 'i', p: top }]; }
/* ---------- المفهوم 4: «السقف الجامع» — قمة A ذهبية فوق ساقين كحليين بشطف 45° (امتداد لغة الرمز المعتمد) ---------- */
function c4() { const leg = [[10, 88], [28, 88], [28, 52], [10, 34]];          // ساق بشطف 45° للخارج كالرمز السابق
  const roof = [[50, 10], [92, 52], [92, 52], [74, 52], [50, 28], [26, 52], [8, 52]].filter((v, i, s) => i === 0 || v + '' !== s[i - 1] + '');
  const roofG = [[50, 12], [86, 48], [72, 48], [50, 26], [28, 48], [14, 48]];
  const legA = [[14, 88], [30, 88], [30, 60], [14, 60]];
  const core = [[50, 40], [62, 52], [62, 88], [38, 88], [38, 52]];
  return [{ c: 'i', p: roofG }, { c: 'o', p: legA }, { c: 'o', p: mir(legA) }, { c: 'o', p: core }]; }
const CONCEPTS = [
  ['1', 'الحاضن', 'حرف A كحلي يحتضن نواة ذهبية: المنصة تحيط بأعمال المنشأة كلها', c1],
  ['2', 'الإحاطة', 'ألف وهمزة «أ» داخل إطار مثمّن بزوايا 45°: الإحاطة الشاملة', c2],
  ['3', 'الوحدات المجتمعة', 'A من أربع وحدات منفصلة تجتمع في حرف واحد: وحدات المنصة في نظام واحد', c3],
  ['4', 'السقف الجامع', 'سقف ذهبي واحد يجمع ثلاث كتل كحلية: مظلة واحدة لكل الأقسام', c4],
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
  for (const [k, L, bg] of [['horizontal-primary', H], ['horizontal-reverse', HR, C.navy], ['stacked-primary', V], ['horizontal-black', HB]]) fs.writeFileSync(path.join(OUT, `ashmal-c${id}-${k}.svg`), svg(L, bg));
  fs.writeFileSync(path.join(OUT, `ashmal-c${id}-symbol.svg`), svg({ W: 140, H: 140, body: `<g transform="translate(20 20)">${sym(sh, PRI)}</g>` }));
  fs.writeFileSync(path.join(OUT, `ashmal-c${id}-app-icon.svg`), icon(sh));
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
  await shot(html, 1240, 900, `ashmal-concept-${id}.png`);
  sheetCompare.push(`<div class="card" style="flex-direction:column;width:540px;height:250px;gap:6px"><svg width="470" viewBox="0 0 ${H.W} ${H.H}">${H.body}</svg><div class="lab" style="font-size:15px;color:#10294A"><b>${id}</b> — ${name}</div></div>`);
}
await shot(`<html dir="rtl"><head><style>${css}</style></head><body style="padding:28px;width:1140px"><p class="h">أشمل — ASHMAL · نماذج الرمز</p><p class="s">كحلي #10294A · ذهبي #D9A83E · IBM Plex Sans Arabic + Manrope (مسارات) · مسطح هندسي بزوايا 45°</p><div class="row">${sheetCompare.join('')}</div></body></html>`, 1200, 700, 'ashmal-compare.png');
await b.close(); console.log('ok');
