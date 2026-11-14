// يبني نسخة من App.jsx للاختبار في Node: يضيف تصديرًا لدوال المحرك المحاسبي الداخلية ويجمّعها بـ esbuild.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'tests', '.cache');
export const ENGINE_EXPORTS = ['buildAccounting', 'buildPartners', 'stockByWh', 'stockCosting', 'itemAvgCosts', 'siStamp', 'siVerify', 'siRem', 'sha256Hex',
  'eosCumAt', 'eosEntitledAmt', 'eosFullAmt', 'eosYears', 'leaveBalance', 'leaveDeductPlan', 'lvDays', 'customerAging', 'fmtNA', 'naErr', 'countSchedule', 'monthLedger', 'snapMonths', 'parseMt940', 'posTotals', 'posDaySummary', 'posCashNet', 'piDetect', 'piAggregate', 'salesDaySource', 'PAY_GUESS', 'findDupInvoices', 'invNoNorm', 'promoActive', 'promoLineDisc', 'posPriceCart', 'loyEarn', 'loyBal', 'loyRedeemMax', 'normPhone', 'posOrdersStats',
  // v38.2 — ضوابط المخزون وإدخال الأرقام
  'tafqeet', 'partGross', 'partYield', 'wasteCfg', 'wasteDaily', 'wasteRows', 'countCfgOf', 'aItemsOf',
  // v38.6 — الأنماط الشاذة
  'detectAnomalies',
  // v38.7 — سجل الإجراءات
  'actionMetric', 'actionEffect', 'actionFromAnomaly', 'anomKey',
  // v38.8 — توقع المبيعات
  'forecastSales',
  // v38.9 — التدفق النقدي المرتبط بالتوقع
  'cashForecast', 'vatStatus',
  // v39.0 — الشراء من التوقع
  'purchasePlan',
  // v39.1 — التنبيهات المهمة والتقارير
  'complianceItems', 'leaseSchedule', 'vatRegister', 'supplierPurchReport',
  // v39.2 — تخطيط العمالة
  'staffingPlan', 'ROLES', 'rolePost', 'sigDigest', 'sigVerify', 'profitDays', 'profitMissing', 'menuEngineering', 'savingsOpps', 'savingsTrack', 'savingsMeasure', 'cardStmtLines', 'cardRecon', 'detectStmtMap', 'parseXlsxGrid', 'recipeRaw', 'recipeCost', 'prepUnitCost', 'usageReport',
  // v39.4 — استيراد نقاط البيع ومطابقتها
  'piHour', 'piCutoff', 'posRecon', 'salesDays', 'importDraftClosing'];

export async function buildEngine() {
  fs.mkdirSync(cache, { recursive: true });
  // v38.3: النواة تصدّر دوال المحرك نفسها (والتطبيقات في mods/ تستورد منها) — نبني من الملف الأصلي مباشرة
  const src = "export { " + ENGINE_EXPORTS.join(', ') + " } from '../../App.jsx';\n"
    + "export { integrityChecks, groupErrors } from '../../mods/admin/SystemMaintenance.jsx';\n";   // v38.5 صيانة النظام
  const entry = path.join(cache, 'AppEngine.jsx');
  fs.writeFileSync(entry, src);
  const out = path.join(cache, 'engine.mjs');
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*'] });
  return import(out + '?t=' + Date.now());
}
