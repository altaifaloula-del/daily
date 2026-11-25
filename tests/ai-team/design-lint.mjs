#!/usr/bin/env node
/**
 * فحص جودة التصميم الثابت (جزء من بوابة التصميم — لا يغني عن المراجعة البصرية).
 * حرج: سلامة ملفات الهوية المعتمدة (بصمة SHA-256)، قيم الألوان الرسمية، صلاحية SVG.
 * غير حرج (تحذير): ألوان hex خارج لوحة الهوية في الملفات المتغيرة عن main.
 * الاستعمال: node tests/ai-team/design-lint.mjs [--json] [--root DIR]
 * رمز الخروج: 0 نجاح، 1 فشل حرج.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const ROOT = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'brand-baseline.json'), 'utf8'));

export const OFFICIAL = { '--mithqal-navy': '#10294A', '--mithqal-gold': '#D9A83E', '--mithqal-deep-navy': '#091A30', '--mithqal-tech-blue': '#2671B9', '--mithqal-white': '#FFFFFF', '--mithqal-soft-gray': '#F3F5F8' };
// اللوحة المسموحة: الهوية + جدول تحويل المطبوعات (DESIGN_SYSTEM v50.4) + أبيض/أسود
const PALETTE = new Set(['#10294A', '#D9A83E', '#091A30', '#2671B9', '#FFFFFF', '#F3F5F8', '#E9EDF3', '#CBD3DF', '#DDE2EA', '#FBF4E4', '#000000', '#FFF', '#000'].map(s => s.toUpperCase()));

export function lint(root = ROOT, base = BASE) {
  const critical = [], warnings = [];
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
  for (const [f, h] of Object.entries(base.files)) {
    if (!fs.existsSync(path.join(root, f))) critical.push(`ملف هوية مفقود: ${f}`);
    else if (sha(f) !== h) critical.push(`ملف هوية معتمد تغيّر دون موافقة: ${f}`);
  }
  const tokFile = path.join(root, 'brand/mithqal-brand-tokens.css');
  if (fs.existsSync(tokFile)) {
    const css = fs.readFileSync(tokFile, 'utf8');
    for (const [k, v] of Object.entries(OFFICIAL)) {
      const m = css.match(new RegExp(k + '\\s*:\\s*(#[0-9A-Fa-f]{3,8})'));
      if (!m || m[1].toUpperCase() !== v) critical.push(`رمز اللون ${k} ليس ${v}`);
    }
  }
  const svgs = [];
  const walk = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, n.name); if (n.isDirectory()) walk(p); else if (n.name.endsWith('.svg')) svgs.push(p); } };
  for (const d of ['public', 'brand', 'PROJECT_AUDIT']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  for (const p of svgs) {
    const s = fs.readFileSync(p, 'utf8'); const rel = path.relative(root, p);
    if (!/viewBox=/.test(s)) critical.push(`SVG بلا viewBox: ${rel}`);
    if (/<script|on[a-z]+=\s*["']/i.test(s)) critical.push(`SVG يحتوي نصًا برمجيًا: ${rel}`);
    if (/(xlink:)?href=["']https?:/i.test(s)) critical.push(`SVG يحمّل موردًا خارجيًا: ${rel}`);
  }
  let changed = [];
  try { changed = execFileSync('git', ['-C', root, 'diff', '--name-only', 'main...HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(f => /\.(jsx?|css)$/.test(f) && !f.startsWith('tests/')); } catch { }
  for (const f of changed) {
    if (!fs.existsSync(path.join(root, f))) continue;
    const hex = [...new Set((fs.readFileSync(path.join(root, f), 'utf8').match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) || []).map(h => h.toUpperCase()))];
    const off = hex.filter(h => !PALETTE.has(h));
    if (off.length) warnings.push(`${f}: ألوان خارج لوحة الهوية ${off.slice(0, 8).join(' ')}${off.length > 8 ? ' …' : ''}`);
  }
  return { ok: critical.length === 0, critical, warnings, svgCount: svgs.length, changedChecked: changed.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = lint();
  if (args.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    console.log(`design-lint: ${r.ok ? 'نجح' : 'فشل'} — SVG مفحوصة: ${r.svgCount}، ملفات متغيرة مفحوصة: ${r.changedChecked}`);
    r.critical.forEach(x => console.log('  ✗ حرج: ' + x));
    r.warnings.forEach(x => console.log('  ! تحذير: ' + x));
  }
  process.exit(r.ok ? 0 : 1);
}
