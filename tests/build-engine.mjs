// يبني نسخة من App.jsx للاختبار في Node: يضيف تصديرًا لدوال المحرك المحاسبي الداخلية ويجمّعها بـ esbuild.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'tests', '.cache');
export const ENGINE_EXPORTS = ['buildAccounting', 'buildPartners', 'stockByWh', 'stockCosting', 'itemAvgCosts', 'siStamp', 'siVerify', 'siRem', 'sha256Hex',
  'eosCumAt', 'eosEntitledAmt', 'eosFullAmt', 'eosYears', 'leaveBalance', 'leaveDeductPlan', 'lvDays', 'customerAging', 'fmtNA', 'naErr', 'countSchedule', 'monthLedger', 'snapMonths', 'parseMt940', 'posTotals', 'posDaySummary', 'posCashNet'];

export async function buildEngine() {
  fs.mkdirSync(cache, { recursive: true });
  let src = fs.readFileSync(path.join(root, 'App.jsx'), 'utf8')
    .replace("from './styles';", "from '../../styles.js';")
    .replace("from './storage';", "from '../../storage.js';");
  src += '\nexport { ' + ENGINE_EXPORTS.join(', ') + ' };\n';
  const entry = path.join(cache, 'AppEngine.jsx');
  fs.writeFileSync(entry, src);
  const out = path.join(cache, 'engine.mjs');
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*'] });
  return import(out + '?t=' + Date.now());
}
