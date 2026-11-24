// v53.5 — يبني نسخة خادم من محرك المحاسبة (App.jsx) لموصل Claude (MCP): ملف ESM واحد في dist-engine/engine.mjs
// يُشغَّل في مرحلة بناء Docker (esbuild متاح ضمن اعتماديات التطوير) — الخادم يستورده عند أول طلب للموصل
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MCP_ENGINE_EXPORTS = ['ctlScan', 'CTL_OPEN', 'finAnalyze', 'MCP_KINDS', 'mcpPlanJournal', 'mcpPlanReclass', 'mcpPlanExp', 'buildAccounting', 'acctActivity', 'glLedger', 'isLayout', 'invCls', 'INV_CLS', 'invPayments', 'APP_VER'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// v53.9: على Render يُثبَّت esbuild وحده في .esb/ (بدل كل اعتماديات التطوير الثقيلة التي أفشلت البناء) — وإلا من node_modules
async function esbuild() {
  const local = path.join(root, '.esb', 'node_modules', 'esbuild', 'lib', 'main.js');
  const m = fs.existsSync(local) ? await import(pathToFileURL(local).href) : await import('esbuild');
  return m.build ? m : m.default;
}

export async function buildMcpEngine(outfile = path.join(root, 'dist-engine', 'engine.mjs')) {
  const { build } = await esbuild();
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const entry = path.join(path.dirname(outfile), 'entry-' + process.pid + '.jsx');
  fs.writeFileSync(entry, 'export { ' + MCP_ENGINE_EXPORTS.join(', ') + " } from '" + path.join(root, 'App.jsx').replace(/\\/g, '/') + "';\n");
  try {
    await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error', minify: true,
      loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic',
      external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*', 'jsbarcode'] });
  } finally { try { fs.unlinkSync(entry); } catch { } }
  return outfile;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const f = await buildMcpEngine(); console.log('✓ محرك الموصل:', path.relative(root, f), Math.round(fs.statSync(f).size / 1024) + 'KB');
}
