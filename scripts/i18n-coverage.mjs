/* v50.2 — قياس تغطية الترجمة الإنجليزية: node scripts/i18n-coverage.mjs $PWD [ملف] — النصوص المتعمَّد بقاؤها عربية (المطبوعات الرسمية، كلمات البحث، مرادفات الوحدات) في scripts/i18n-skip.txt */
import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2], want = process.argv[3]; const I = await import(path.join(root, 'i18n.js')); const { trWord, EN, EN_RX } = I;
for (const f of fs.readdirSync(path.join(root, 'i18n-en')).filter(f => /^b.*\.js$/.test(f)).sort()) { const m = await import(path.join(root, 'i18n-en', f)); Object.assign(EN, m.default || {}); if (m.RX) EN_RX.unshift(...m.RX); if (m.RX_END) EN_RX.push(...m.RX_END); }
const files = ['App.jsx', ...fs.readdirSync(path.join(root, 'mods'), { recursive: true }).filter(f => f.endsWith('.jsx')).map(f => 'mods/' + f)];
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const S = new Map();
for (const f of files) { const s = strip(fs.readFileSync(path.join(root, f), 'utf8'));
  const re = />([^<>{}\n]*[\u0600-\u06FF][^<>{}\n]*)</g, re2 = /(['"])((?:(?!\1)[^\\\n])*[\u0600-\u06FF](?:(?!\1)[^\\\n])*)\1/g; let m;
  while ((m = re.exec(s))) { const t = m[1].trim(); if (t && !/[<>=]/.test(t)) S.has(t) || S.set(t, f); }
  while ((m = re2.exec(s))) { const t = m[2].trim(); if (t && t.length < 220 && !/<\/?[a-z]/i.test(t) && !/\$\{/.test(t)) S.has(t) || S.set(t, f); } }
const SKIP = new Set(fs.existsSync(path.join(root, 'scripts', 'i18n-skip.txt')) ? fs.readFileSync(path.join(root, 'scripts', 'i18n-skip.txt'), 'utf8').split('\n').map(x => x.trim()).filter(Boolean) : []);
const noise = (t) => /' \+|\+ '|_xe\(|money\(|[{}]|=>|\? '|\.replace\(|escH\(|^\)|^0(\.\d+)? \?/.test(t) || SKIP.has(t) || !/[\u0600-\u06FF]{2}/.test(t);
for (const k of [...S.keys()]) if (noise(k)) S.delete(k);
let ok = 0; const miss = [];
for (const [t, f] of S) { if (trWord(t) != null) ok++; else miss.push([t, f]); }
const byFile = {}; miss.forEach(([t, f]) => byFile[f] = (byFile[f] || 0) + 1);
console.log('total', S.size, 'translated', ok, 'cov', (ok / S.size).toFixed(3), 'missing', miss.length);
if (want) { const L = miss.filter(([t, f]) => f === want).map(x => x[0]); fs.writeFileSync(path.join(process.env.TMPDIR || '/tmp', 'i18n-todo.json'), JSON.stringify(L, null, 0)); console.log(want, L.length); }
else console.log(Object.entries(byFile).sort((a, b) => b[1] - a[1]).map(x => x.join(' ')).join('\n'));
