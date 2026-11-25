Muktasab — مُكتسَب — Brand Asset Pack (v56.0 rebrand)
=============================================
Symbol: compass (gold north point, navy points, light diagonals, hollow centre) — owner decision 2026-11-25; replaces the MITHQAL M mark.
File names in brand/logo are muktasab-*; files in public/ keep their legacy mithqal-* paths (internal references only).
Source of truth: brand-geom.js (symbol geometry) + scripts/brand-build.mjs (generator).
Regenerate: see header of scripts/brand-build.mjs. Never edit generated files by hand.

brand/
  logo/primary/      primary lockups (horizontal, stacked, symbol) — SVG + PNG 2048 + vector PDF
  logo/horizontal/   horizontal lockup: primary (light bg) + reverse (dark bg)
  logo/stacked/      stacked lockup: primary + reverse
  logo/symbol/       symbol only: primary + reverse
  logo/monochrome/   navy, black (1-color print), gold (special use)
  logo/white/        all-white for dark/photo backgrounds
  logo/favicon/      favicon.svg, favicon.ico (16/32/48), PNG 16/32/48
  logo/app-icon/     app icon (rounded + maskable) SVG + PNG 512/1024
  fonts/             IBM Plex Sans Arabic Bold, Manrope ExtraBold (OFL 1.1)
  tokens/            muktasab-tokens.css / .json (CSS variable names keep the legacy --mithqal-* prefix) (colors, fonts, logo rules)
  guidelines/        usage guide (see PROJECT_AUDIT/V56/design/MUKTASAB_REBRAND_V56.md)
  applications/      applied examples (screens, icons)

Colors: Navy #10294A · Gold #D9A83E · Deep Navy #091A30 · Blue #2671B9 · Light Gray #F3F5F8 · White #FFFFFF
All logo files: flat fills only, letters converted to outlines, no gradients/shadows/effects.
Clear space: 20% of symbol width on every side. Minimum size: symbol 16px, horizontal 96px wide, stacked 64px wide.
Muktasab is the fixed platform brand — tenants cannot replace or recolor it (see TENANT_BRANDING_SPEC_V56.md).
Trademark: compass symbols are common — distinctiveness comes from the combined mark (gold north point + name); clearance search before commercial registration is the owner's responsibility.
