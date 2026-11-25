/**
 * v56.0 (إعادة التسمية) — هندسة رمز «مُكتسَب — Muktasab» (المصدر الوحيد): يستعملها مكوّن الواجهة BrandSymbol ومولّد الملفات scripts/brand-build.mjs.
 * قرار المالك 2026-11-25: رمز «البوصلة» (يحل محل رمز M الهندسي لمثقال). المواصفة: PROJECT_AUDIT/V56/design/MUKTASAB_REBRAND_V56.md
 * شبكة 100×100، المركز (50,50):
 *  • أربعة رؤوس رئيسية مثلثية طول كل منها R من المركز وعرض قاعدتها 2W: الشمالي ذهبي (inner)، والجنوبي والشرقي والغربي كحلية (outer).
 *  • أربعة رؤوس قطرية صغيرة (minor) طولها r وعرضها 2w، بشفافية 55% من لون الرؤوس الكحلية.
 *  • مركز مفرّغ (hole) نصف قطره h — يُرسم قناعًا حتى يبقى شفافًا على أي خلفية.
 */
export const MQ_GEOM = Object.freeze({ c: 50, R: 47, W: 9.5, r: 30, w: 6, h: 5.5, minorOpacity: 0.55 });
const r2 = (v) => +v.toFixed(2);
export function mqSymbolShapes(g = MQ_GEOM) {
  const c = g.c;
  const N = [[c, c - g.R], [c + g.W, c], [c - g.W, c]];
  const S = [[c, c + g.R], [c - g.W, c], [c + g.W, c]];
  const E = [[c + g.R, c], [c, c - g.W], [c, c + g.W]];
  const Wt = [[c - g.R, c], [c, c + g.W], [c, c - g.W]];
  const diag = (deg) => { const t = deg * Math.PI / 180, p = t + Math.PI / 2;
    return [[r2(c + g.r * Math.cos(t)), r2(c + g.r * Math.sin(t))], [r2(c + g.w * Math.cos(p)), r2(c + g.w * Math.sin(p))], [r2(c - g.w * Math.cos(p)), r2(c - g.w * Math.sin(p))]]; };
  return { outer: [S, E, Wt], inner: [N], minor: [-45, 45, 135, 225].map(diag), hole: { cx: c, cy: c, r: g.h }, minorOpacity: g.minorOpacity };
}
export const mqPoints = (p) => p.map(([x, y]) => x + ',' + y).join(' ');
