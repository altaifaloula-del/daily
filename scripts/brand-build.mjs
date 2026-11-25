#!/usr/bin/env node
/**
 * v56.0 (إعادة التسمية) — مولّد ملفات هوية «مُكتسَب — Muktasab» (رمز البوصلة، قرار المالك 2026-11-25؛ كان مولّد MITHQAL ERP في v56.0).
 * مصدر واحد للحقيقة: هندسة الرمز أدناه (شبكة 100×100) + حروف الاسم محوّلة لمسارات من الخطوط الرسمية.
 * يُنتج: SVG نظيفة (بلا نص حي ولا تدرجات ولا ظلال)، PDF متجهية، PNG شفافة، Favicon (ICO+SVG)، أيقونات التطبيق، والتوكنات.
 *
 * الاعتماديات (لا تُضاف لاعتماديات المشروع — تُثبَّت مؤقتًا عند إعادة التوليد فقط):
 *   npm i --no-save fontkit@2.0.4 @fontsource/ibm-plex-sans-arabic@5.2.6 @fontsource/manrope@5.2.6
 *   (Playwright/Chromium موجود في اعتماديات التطوير — يُستعمل للـ PNG والـ PDF)
 * التشغيل: node scripts/brand-build.mjs [--fonts <مجلد node_modules فيه الحزم أعلاه>]
 * الناتج محفوظ في المستودع؛ لا يلزم تشغيل السكربت في البناء أو النشر.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argFonts = process.argv.indexOf('--fonts') > 0 ? path.resolve(process.argv[process.argv.indexOf('--fonts') + 1]) : path.join(root, 'node_modules');
const req = createRequire(path.join(argFonts, 'x.js'));

/* ======================= الألوان الرسمية ======================= */
export const BRAND = { navy: '#10294A', gold: '#D9A83E', deepNavy: '#091A30', blue: '#2671B9', lightGray: '#F3F5F8', white: '#FFFFFF', black: '#000000' };

/* ======================= هندسة الرمز (LOGO_GEOMETRY_SPEC_V56) =======================
   شبكة 100×100، محور رأسي x=50. ساقان كحليتان (كتلتان) بشطف علوي 45° يميل نحو الداخل،
   وذراعان ذهبيان موازيان للشطف بفراغ ثابت، يلتقيان على المحور في مركز الرمز (زاويتان متلاقيتان). */
import { MQ_GEOM, mqSymbolShapes } from '../brand-geom.js';
export const GEOM = MQ_GEOM;
export const symbolShapes = mqSymbolShapes;
const pts = (p, dx = 0, dy = 0, s = 1) => p.map(([x, y]) => (+(dx + x * s).toFixed(3)) + ',' + (+(dy + y * s).toFixed(3))).join(' ');
/** الرمز كعناصر SVG — c = { outer, inner } — البوصلة: رؤوس قطرية خفيفة + ثلاثة رؤوس بلون outer + الرأس الشمالي بلون inner، ومركز مفرّغ بقناع */
export function symbolSvg(c, dx = 0, dy = 0, s = 1) {
  const S = symbolShapes(), id = 'mk-hole'   /* معرّف ثابت: كل ملف SVG يحمل رمزًا واحدًا، فتبقى الملفات متطابقة بين التوليدات */, h = S.hole;
  return `<g transform="translate(${+dx.toFixed(3)} ${+dy.toFixed(3)}) scale(${+s.toFixed(4)})"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="#000"/></mask></defs><g mask="url(#${id})">`
    + S.minor.map(p => `<polygon points="${pts(p)}" fill="${c.outer}" fill-opacity="${S.minorOpacity}"/>`).join('')
    + S.outer.map(p => `<polygon points="${pts(p)}" fill="${c.outer}"/>`).join('')
    + S.inner.map(p => `<polygon points="${pts(p)}" fill="${c.inner}"/>`).join('') + '</g></g>';
}

/* ======================= الحروف كمسارات ======================= */
function loadFonts() {
  const fk = req('fontkit');
  const file = (pkg, f) => fs.readFileSync(path.join(argFonts, '@fontsource', pkg, 'files', f));
  return { fk, ar: fk.create(file('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-700-normal.woff')),
    en: fk.create(file('manrope', 'manrope-latin-800-normal.woff')), arFile: file('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-700-normal.woff2'), enFile: file('manrope', 'manrope-latin-800-normal.woff2') };
}
/** نص → مسار SVG بارتفاع حرف معطى (size = حجم الخط بوحدات الشبكة)، مع تباعد إضافي (track بوحدات em) */
function textPath(font, str, size, track = 0, feats) {
  const run = font.layout(str, feats);
  const sc = size / font.unitsPerEm; let x = 0, d = '', minY = Infinity, maxY = -Infinity;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const p = g.path.scale(sc, -sc).translate(x + pos.xOffset * sc, -pos.yOffset * sc);
    d += p.toSVG();
    const bb = g.bbox; if (isFinite(bb.minY)) { minY = Math.min(minY, -bb.maxY * sc); maxY = Math.max(maxY, -bb.minY * sc); }
    x += pos.xAdvance * sc + (i < run.glyphs.length - 1 ? track * size : 0);
  });
  return { d, w: x, top: minY, bottom: maxY };
}
const round = (d) => d.replace(/-?\d+\.\d+/g, n => String(+(+n).toFixed(2)));

/* ======================= التكوينات ======================= */
const AR_FEATS = ['ccmp', 'isol', 'init', 'medi', 'fina', 'rlig', 'calt', 'liga', 'kern', 'mark', 'mkmk'];
function lockups(F) {
  const ar = textPath(F.ar, 'مكتسب', 62, 0, AR_FEATS);
  const en = textPath(F.en, 'MUKTASAB', 25, 0.16, ['kern']);
  const clear = 20;   // مساحة الحماية = 20% من عرض الرمز (الرمز 100)
  // أفقي: الرمز ثم كتلة الاسم — أحجام من حدود الحروف المقاسة لا تقديرًا: العربي أعلى، فراغ ثابت، الإنجليزي أسفل؛ الكتلة متمركزة على الرمز
  const arH = textPath(F.ar, 'مكتسب', 50, 0, AR_FEATS), enH = textPath(F.en, 'MUKTASAB', 17, 0.2, ['kern']);
  const hx = 100 + 24, blockW = Math.max(arH.w, enH.w), hGap = 9;
  const bh = (arH.bottom - arH.top) + hGap + (enH.bottom - enH.top), b0 = 50 - bh / 2;
  const arY = b0 - arH.top, enY = b0 + (arH.bottom - arH.top) + hGap - enH.top;
  const H = { w: hx + blockW, h: 100, parts: (c) => symbolSvg(c, 0, 0) + `<path d="${round(arH.d)}" transform="translate(${(hx + (blockW - arH.w) / 2).toFixed(2)} ${arY.toFixed(2)})" fill="${c.text}"/>`
    + `<path d="${round(enH.d)}" transform="translate(${(hx + (blockW - enH.w) / 2).toFixed(2)} ${enY.toFixed(2)})" fill="${c.text2 || c.text}"/>` };
  // رأسي: الرمز في الأعلى، ثم العربي، ثم الإنجليزي — كلها على المحور
  const vw = Math.max(100, ar.w, en.w), arV = 100 + 16 - ar.top, enV = arV + ar.bottom + 14 - en.top;
  const V = { w: vw, h: enV + en.bottom, parts: (c) => symbolSvg(c, (vw - 100) / 2, 0) + `<path d="${round(ar.d)}" transform="translate(${((vw - ar.w) / 2).toFixed(2)} ${arV.toFixed(2)})" fill="${c.text}"/>`
    + `<path d="${round(en.d)}" transform="translate(${((vw - en.w) / 2).toFixed(2)} ${enV.toFixed(2)})" fill="${c.text2 || c.text}"/>` };
  const S = { w: 100, h: 100, parts: (c) => symbolSvg(c) };
  return { clear, horizontal: H, stacked: V, symbol: S };
}
const svgDoc = (L, c, clear, bg) => {
  const w = L.w + 2 * clear, h = L.h + 2 * clear;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${+w.toFixed(2)} ${+h.toFixed(2)}" width="${Math.round(w * 4)}" height="${Math.round(h * 4)}" role="img" aria-label="Muktasab — مكتسب">`
    + `<title>Muktasab — مكتسب</title>${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}<g transform="translate(${clear} ${clear})">${L.parts(c)}</g></svg>\n`;
};

/* ======================= النسخ اللونية ======================= */
export const VARIANTS = {
  primary: { outer: BRAND.navy, inner: BRAND.gold, text: BRAND.navy, text2: BRAND.navy },
  navy: { outer: BRAND.navy, inner: BRAND.navy, text: BRAND.navy },
  white: { outer: BRAND.white, inner: BRAND.white, text: BRAND.white },
  reverse: { outer: BRAND.white, inner: BRAND.gold, text: BRAND.white, text2: BRAND.white },   // للخلفيات الداكنة (الذهبي يبقى عنصرًا مميزًا)
  black: { outer: BRAND.black, inner: BRAND.black, text: BRAND.black },
  gold: { outer: BRAND.gold, inner: BRAND.gold, text: BRAND.gold },
};
/** أيقونة التطبيق: مربع كحلي (حواف حسب المنصة) والرمز المعكوس داخل منطقة آمنة 60% */
const appIcon = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><title>Muktasab</title>`
  + `<rect width="512" height="512" rx="${radius}" fill="${BRAND.navy}"/>${symbolSvg(VARIANTS.reverse, 102.4, 102.4, 3.072)}</svg>\n`;
const faviconSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><title>Muktasab</title>`
  + `<rect width="64" height="64" rx="12" fill="${BRAND.navy}"/>${symbolSvg(VARIANTS.reverse, 6, 6, 0.52)}</svg>\n`;

/** ICO بصور PNG مضمنة (مدعوم في كل المتصفحات الحديثة) */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length; pngs.forEach(([s, b], i) => { const o = 6 + 16 * i; head.writeUInt8(s >= 256 ? 0 : s, o); head.writeUInt8(s >= 256 ? 0 : s, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(b.length, o + 8); head.writeUInt32LE(off, o + 12); off += b.length; });
  return Buffer.concat([head, ...pngs.map(p => p[1])]);
}

async function main() {
  const F = loadFonts(); const L = lockups(F);
  const out = (rel, data) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return f; };
  const B = 'brand/logo', made = [];
  const plan = [
    ['primary', 'horizontal', 'primary'], ['primary', 'stacked', 'primary'], ['primary', 'symbol', 'primary'],
    ['horizontal', 'horizontal', 'primary'], ['horizontal', 'horizontal', 'reverse'],
    ['stacked', 'stacked', 'primary'], ['stacked', 'stacked', 'reverse'],
    ['symbol', 'symbol', 'primary'], ['symbol', 'symbol', 'reverse'],
    ['monochrome', 'horizontal', 'navy'], ['monochrome', 'stacked', 'navy'], ['monochrome', 'symbol', 'navy'],
    ['monochrome', 'horizontal', 'black'], ['monochrome', 'stacked', 'black'], ['monochrome', 'symbol', 'black'],
    ['monochrome', 'horizontal', 'gold'], ['monochrome', 'symbol', 'gold'],
    ['white', 'horizontal', 'white'], ['white', 'stacked', 'white'], ['white', 'symbol', 'white'],
  ];
  const files = {};
  for (const [dir, kind, v] of plan) { const name = `muktasab-${kind}-${v}`; const svg = svgDoc(L[kind], VARIANTS[v], L.clear); made.push(out(`${B}/${dir}/${name}.svg`, svg)); files[`${dir}/${name}`] = svg; }
  made.push(out(`${B}/app-icon/muktasab-app-icon.svg`, appIcon(112)), out(`${B}/app-icon/muktasab-app-icon-maskable.svg`, appIcon(0)), out(`${B}/favicon/muktasab-favicon.svg`, faviconSvg()));

  // الخطوط الرسمية (OFL) للاستعمال في التصميم — نفس ملفات الحزم
  out('brand/fonts/IBMPlexSansArabic-Bold.woff2', F.arFile); out('brand/fonts/Manrope-ExtraBold.woff2', F.enFile);
  out('brand/fonts/README.md', '# الخطوط الرسمية\n- IBM Plex Sans Arabic (العربية) — SIL Open Font License 1.1 — IBM\n- Manrope (الإنجليزية) — SIL Open Font License 1.1 — Mikhail Sharanda\n- MizanNum (الأرقام في الواجهة) = Inter latin بنطاق الأرقام فقط — `public/fonts/inter-latin.woff2` — OFL 1.1\n\nحروف الشعار في ملفات `brand/logo` محوّلة إلى مسارات؛ لا يلزم تثبيت الخطوط لعرضها.\nملفات الخط هنا (woff2 للأوزان المستعملة في الشعار) من حزم `@fontsource` المنشورة على npm.\n');

  // التوكنات
  const tokens = { color: { navy: BRAND.navy, gold: BRAND.gold, deepNavy: BRAND.deepNavy, blue: BRAND.blue, lightGray: BRAND.lightGray, white: BRAND.white },
    font: { arabic: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui, sans-serif", latin: "Manrope, 'Segoe UI', system-ui, sans-serif", numeric: "'MizanNum', 'IBM Plex Mono', ui-monospace, monospace" },
    logo: { geometry: GEOM, clearSpacePct: 20, minSizePx: { symbol: 16, horizontal: 96, stacked: 64 } } };
  out('brand/tokens/muktasab-tokens.json', JSON.stringify(tokens, null, 2) + '\n');
  const css = ':root {\n' + Object.entries({ navy: BRAND.navy, gold: BRAND.gold, 'deep-navy': BRAND.deepNavy, 'tech-blue': BRAND.blue, white: BRAND.white, 'soft-gray': BRAND.lightGray })
    .map(([k, v]) => `  --mithqal-${k}: ${v};`).join('\n') + '\n}\n';
  out('brand/tokens/muktasab-tokens.css', css); out('brand/mithqal-brand-tokens.css', css);

  // نسخ الواجهة (المستعملة في التطبيق)
  out('public/brand/mithqal-symbol.svg', files['symbol/muktasab-symbol-primary']);
  out('public/brand/mithqal-symbol-reverse.svg', files['symbol/muktasab-symbol-reverse']);
  out('public/brand/mithqal-logo-horizontal-bilingual.svg', files['horizontal/muktasab-horizontal-primary']);
  out('public/brand/mithqal-logo-horizontal-reverse.svg', files['horizontal/muktasab-horizontal-reverse']);
  out('public/brand/mithqal-logo-stacked.svg', files['stacked/muktasab-stacked-primary']);
  out('public/brand/mithqal-app-icon.svg', appIcon(112)); out('public/icon.svg', appIcon(112)); out('public/brand/mithqal-favicon.svg', faviconSvg());

  // PNG وPDF عبر Chromium (متجه حقيقي في PDF)
  const { chromium } = createRequire(path.join(root, 'x.js'))('playwright');
  const b = await chromium.launch(); const p = await b.newPage();
  const png = async (svg, w, h, file) => { await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/ width="[^"]*" height="[^"]*"/, ` width="${w}" height="${h}"`)}</body></html>`);
    const buf = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } }); if (file) out(file, buf); return buf; };
  const dims = (svg) => { const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); return [+m[1], +m[2]]; };
  for (const [k, svg] of Object.entries(files)) { const [w, h] = dims(svg); const sc = 2048 / Math.max(w, h); await png(svg, Math.round(w * sc), Math.round(h * sc), `${B}/${k}.png`); }
  for (const k of ['primary/muktasab-horizontal-primary', 'primary/muktasab-stacked-primary', 'primary/muktasab-symbol-primary', 'monochrome/muktasab-horizontal-black', 'white/muktasab-horizontal-white']) {
    const svg = files[k]; const [w, h] = dims(svg); const mm = 0.75;   // 1 وحدة = 0.75 مم
    await p.setContent(`<html><head><style>@page{size:${(w * mm).toFixed(1)}mm ${(h * mm).toFixed(1)}mm;margin:0}html,body{margin:0}</style></head><body${k.startsWith('white') ? ' style="background:#10294A"' : ''}>${svg.replace(/ width="[^"]*" height="[^"]*"/, ` width="${(w * mm).toFixed(1)}mm" height="${(h * mm).toFixed(1)}mm"`)}</body></html>`);
    out(`${B}/${k}.pdf`, await p.pdf({ width: (w * mm).toFixed(1) + 'mm', height: (h * mm).toFixed(1) + 'mm', printBackground: k.startsWith('white'), pageRanges: '1' }));
  }
  // أيقونات التطبيق والمتصفح
  const icon = appIcon(112), mask = appIcon(0), fav = faviconSvg();
  for (const [s, f] of [[512, 'public/mithqal-512.png'], [192, 'public/mithqal-192.png'], [180, 'public/mithqal-apple-180.png'], [192, 'public/icon-192.png'], [512, 'public/icon-512.png'], [180, 'public/apple-touch-icon.png'], [1024, `${B}/app-icon/muktasab-app-icon-1024.png`], [512, `${B}/app-icon/muktasab-app-icon-512.png`]]) await png(icon, s, s, f);
  for (const [s, f] of [[512, 'public/mithqal-maskable-512.png'], [192, 'public/mithqal-maskable-192.png'], [512, `${B}/app-icon/muktasab-app-icon-maskable-512.png`]]) await png(mask, s, s, f);
  const icoPngs = []; for (const s of [16, 32, 48]) { const buf = await png(fav, s, s, `${B}/favicon/muktasab-favicon-${s}.png`); icoPngs.push([s, buf]); }
  // شارة إشعارات الدفع (أحادية بيضاء على شفاف كما تتطلب أنظمة التشغيل)
  await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${symbolSvg(VARIANTS.white, 0, 0, 1)}</svg>`, 96, 96, 'public/mithqal-badge-96.png');
  out('public/favicon.ico', ico(icoPngs)); out(`${B}/favicon/favicon.ico`, ico(icoPngs));
  await b.close();
  console.log('✓ brand assets:', made.length, 'SVG + PNG/PDF/ICO →', B);
}
if (import.meta.url === 'file://' + process.argv[1]) main().catch(e => { console.error(e.message.includes('fontkit') ? 'ثبّت أدوات التوليد أولًا (انظر رأس الملف): ' + e.message : e); process.exit(1); });
