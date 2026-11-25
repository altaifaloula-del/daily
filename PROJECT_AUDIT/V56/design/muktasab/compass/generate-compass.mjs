import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const [S, OUT, ROOT] = process.argv.slice(2);
const req = createRequire(path.join(S, 'brandtool/node_modules/x.js')); const fk = req('fontkit');
const f = (p, n) => fs.readFileSync(path.join(S, 'brandtool/node_modules/@fontsource', p, 'files', n));
const AR = fk.create(f('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-700-normal.woff')), EN = fk.create(f('manrope', 'manrope-latin-800-normal.woff'));
const AF = ['ccmp','isol','init','medi','fina','rlig','calt','liga','kern','mark','mkmk'];
function tp(font, s, size, track = 0, feats) { const r = font.layout(s, feats), sc = size / font.unitsPerEm; let x = 0, d = '', t = 1e9, b = -1e9;
  r.glyphs.forEach((g, i) => { const p = r.positions[i]; d += g.path.scale(sc, -sc).translate(x + p.xOffset * sc, -p.yOffset * sc).toSVG(); const bb = g.bbox; if (isFinite(bb.minY)) { t = Math.min(t, -bb.maxY * sc); b = Math.max(b, -bb.minY * sc); } x += p.xAdvance * sc + (i < r.glyphs.length - 1 ? track * size : 0); });
  return { d: d.replace(/-?\d+\.\d+/g, n => String(+(+n).toFixed(2))), w: x, top: t, bottom: b }; }
let MID = 0;
// البوصلة: أربعة رؤوس (الشمالي ذهبي) + أربعة رؤوس قطرية صغيرة، ومركز مفرّغ (قناع) حتى يبقى شفافًا على أي خلفية
const sym = (c, dx = 0, dy = 0, s = 1) => { const id = 'cm' + (++MID);
  const N = [[50, 3], [59.5, 50], [40.5, 50]], So = [[50, 97], [40.5, 50], [59.5, 50]], E = [[97, 50], [50, 40.5], [50, 59.5]], W = [[3, 50], [50, 59.5], [50, 40.5]];
  const d = (a) => { const t = a * Math.PI / 180, r = 30, w = 6; const tip = [50 + r * Math.cos(t), 50 + r * Math.sin(t)], l = [50 + w * Math.cos(t + Math.PI / 2), 50 + w * Math.sin(t + Math.PI / 2)], rr = [50 + w * Math.cos(t - Math.PI / 2), 50 + w * Math.sin(t - Math.PI / 2)]; return [tip, l, rr].map(p => p.map(v => +v.toFixed(2))); };
  const P = a => a.map(p => p.join(',')).join(' ');
  return `<g transform="translate(${dx} ${dy}) scale(${s})"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="5.5" fill="#000"/></mask></defs><g mask="url(#${id})">`
    + [-45, 45, 135, 225].map(a => `<polygon points="${P(d(a))}" fill="${c.o}" opacity=".55"/>`).join('')
    + [So, E, W].map(p => `<polygon points="${P(p)}" fill="${c.o}"/>`).join('') + `<polygon points="${P(N)}" fill="${c.i}"/></g></g>`; };
const C = { navy: '#10294A', gold: '#D9A83E', white: '#FFFFFF', black: '#000000' };
const arH = tp(AR, 'مكتسب', 54, 0, AF), enH = tp(EN, 'MUKTASAB', 16, 0.24, ['kern']);
const arV = tp(AR, 'مكتسب', 64, 0, AF), enV = tp(EN, 'MUKTASAB', 22, 0.22, ['kern']);
const tlA = tp(AR, 'منصة الأعمال الذكية', 15, 0, AF), tlE = tp(EN, 'SMART BUSINESS PLATFORM', 9.5, 0.12, ['kern']);
function horiz(c, tag = false, clear = 20) { const hx = 124, bw = Math.max(arH.w, enH.w, tag ? Math.max(tlA.w, tlE.w) : 0), g = 9;
  let h = arH.bottom - arH.top + g + enH.bottom - enH.top; if (tag) h += 14 + (tlA.bottom - tlA.top) + 6 + (tlE.bottom - tlE.top);
  const b0 = 50 - h / 2, ay = b0 - arH.top, ey = b0 + arH.bottom - arH.top + g - enH.top; let body = sym(c) + `<path d="${arH.d}" transform="translate(${hx + (bw - arH.w) / 2} ${ay})" fill="${c.t}"/><path d="${enH.d}" transform="translate(${hx + (bw - enH.w) / 2} ${ey})" fill="${c.t}"/>`;
  if (tag) { const ly = ey + enH.bottom + 7; body += `<rect x="${hx}" y="${ly}" width="${bw}" height="0.8" fill="${c.t}" opacity=".45"/>`;
    const ty = ly + 7 - tlA.top, ty2 = ty + tlA.bottom + 6 - tlE.top; body += `<path d="${tlA.d}" transform="translate(${hx + (bw - tlA.w) / 2} ${ty})" fill="${c.t2}"/><path d="${tlE.d}" transform="translate(${hx + (bw - tlE.w) / 2} ${ty2})" fill="${c.t2}"/>`; }
  return { W: hx + bw + 2 * clear, H: Math.max(100, h) + 2 * clear, body: `<g transform="translate(${clear} ${clear + Math.max(0, (h - 100) / 2)})">${body}</g>` }; }
function stack(c, clear = 20) { const w = Math.max(100, arV.w, enV.w), ay = 116 - arV.top, ey = ay + arV.bottom + 14 - enV.top;
  return { W: w + 2 * clear, H: ey + enV.bottom + 2 * clear, body: `<g transform="translate(${clear} ${clear})">${sym(c, (w - 100) / 2)}<path d="${arV.d}" transform="translate(${(w - arV.w) / 2} ${ay})" fill="${c.t}"/><path d="${enV.d}" transform="translate(${(w - enV.w) / 2} ${ey})" fill="${c.t}"/></g>` }; }
const svg = (L, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W.toFixed(1)} ${L.H.toFixed(1)}" role="img" aria-label="Muktasab — مكتسب"><title>Muktasab — مكتسب</title>${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${L.body}</svg>`;
const PRI = { o: C.navy, i: C.gold, t: C.navy, t2: '#4A5A70' }, REV = { o: C.white, i: C.gold, t: C.white, t2: '#C9D3E2' }, BLK = { o: C.black, i: C.black, t: C.black, t2: C.black };
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${C.navy}"/>${sym(REV, 86, 86, 3.4)}</svg>`;
fs.mkdirSync(OUT, { recursive: true });
const files = { 'muktasab-horizontal-primary': [horiz(PRI)], 'muktasab-horizontal-reverse': [horiz(REV), C.navy], 'muktasab-horizontal-tagline': [horiz(PRI, true)], 'muktasab-stacked-primary': [stack(PRI)], 'muktasab-horizontal-black': [horiz(BLK)] };
for (const [k, [L, bg]] of Object.entries(files)) fs.writeFileSync(path.join(OUT, k + '.svg'), svg(L, bg));
fs.writeFileSync(path.join(OUT, 'muktasab-app-icon.svg'), icon);
const inner = s => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const { chromium } = createRequire(path.join(ROOT, 'x.js'))('playwright');
const b = await chromium.launch(); const pg = await b.newPage({ deviceScaleFactor: 2 });
const card = (L, bg, w) => `<div class="c" style="background:${bg || '#fff'}"><svg width="${w}" viewBox="0 0 ${L.W} ${L.H}">${L.body}</svg></div>`;
const H = horiz(PRI), HR = horiz(REV), HT = horiz(PRI, true), V = stack(PRI), HB = horiz(BLK);
const html = `<html dir="rtl"><head><style>*{box-sizing:border-box}body{margin:0;padding:30px;width:1240px;background:#F3F5F8;font-family:system-ui;color:#10294A}
h1{font-size:26px;margin:0 0 4px}p{margin:0 0 20px;color:#4A5A70}.g{display:grid;grid-template-columns:1fr 1fr;gap:16px}.c{border:1px solid #DDE3EA;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:26px;min-height:200px}
.r{display:flex;gap:16px;align-items:center;margin-top:16px}.l{font-size:13px;color:#6B7A8F}</style></head><body>
<h1>مُكتسَب — شعار البوصلة</h1><p>البوصلة: الاتجاه الشمالي ذهبي، ومركز مفرّغ، والرؤوس القطرية خفيفة (حروف محوّلة لمسارات من IBM Plex Sans Arabic وManrope)</p>
<div class="g">${card(H, '#fff', 500)}${card(HR, C.navy, 500)}${card(HT, '#fff', 520)}${card(V, '#fff', 230)}</div>
<div class="r"><div class="c" style="min-height:0;padding:0;border:0;background:none"><svg width="150" height="150" viewBox="0 0 512 512">${inner(icon)}</svg></div>
${[64, 32, 16].map(s => `<svg width="${s}" height="${s}" viewBox="0 0 512 512">${inner(icon)}</svg>`).join('')}<span class="l">أيقونة التطبيق · 64 · 32 · 16</span>
<div class="c" style="min-height:0;flex:1">${`<svg width="380" viewBox="0 0 ${HB.W} ${HB.H}">${HB.body}</svg>`}</div></div></body></html>`;
await pg.setViewportSize({ width: 1300, height: 900 }); await pg.setContent(html); await pg.waitForTimeout(100); await pg.screenshot({ path: path.join(OUT, 'muktasab-compass-sheet.png'), fullPage: true });
await b.close(); console.log('ok');
