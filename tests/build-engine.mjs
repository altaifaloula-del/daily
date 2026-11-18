// يبني نسخة من App.jsx للاختبار في Node: يضيف تصديرًا لدوال المحرك المحاسبي الداخلية ويجمّعها بـ esbuild.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'tests', '.cache');
export const ENGINE_EXPORTS = ['projList', 'projectPL', 'projNextCode', 'CV_KIND', 'fefoPick', 'lotsFor', 'expiryLots', 'posReturnCalc', 'posReturnable', 'posRefundOptions', 'posReturnLoyDed', 'jeLive', 'jeOwner', 'canApproveJe', 'gosiNewSched', 'gosiNewAuto', 'payrollRowsOf', 'otRateOf', 'otFromAttendance', 'stockShortages', 'computeSmartAlerts', 'applyCashVoucher', 'cvNextNo', 'partyOpenDocs', 'assignVouchers', 'voucherList', 'syncSaleMoves', 'saleDayUse', 'saleUse', 'saleRecipeItems', 'itemLedger', 'closeAlertEvents', 'closeAlertsCfg', 'closeAlertFor', 'cutoutPixels', 'prepWasteStats', 'normDigits', 'normScan', 'posPaper', 'posReceiptHtml', 'posShiftHtml', 'prepBatchState', 'prepShelfH', 'BR_PURCHASERS', 'poWhOf', 'syncPoInbox', 'INV_BILLERS', 'buildAccounting', 'buildPartners', 'stockByWh', 'stockCosting', 'itemAvgCosts', 'siStamp', 'siVerify', 'siRem', 'sha256Hex',
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
  'staffingPlan', 'ROLES', 'rolePost', 'sigDigest', 'sigVerify', 'profitDays', 'profitMissing', 'menuEngineering', 'savingsOpps', 'savingsTrack', 'savingsMeasure', 'cardStmtLines', 'cardRecon', 'cardSettlePlan', 'fsStatus', 'fsInRange', 'cashCountStatus', 'ccOpenShifts', 'maintStatus', 'archivePlan', 'archKey', 'detectStmtMap', 'parseXlsxGrid', 'recipeRaw', 'recipeCost', 'prepUnitCost', 'usageReport', 'prepMix', 'prepPlan', 'recipeKcal', 'productKcal', 'dataFootprint', 'kcalPerUnit', 'ibanStatus', 'ibanApply', 'ibanNorm', 'IBAN_APPROVERS', 'verifyBackup', 'mzbkDecrypt', 'isMzbk', 'clrData', 'clrRecord', 'clrSigRef', 'clrDiff', 'clrCompare', 'clrOn', 'dirOf', 'clrMerge', 'clrRead', 'prodNeeds', 'prodCheck', 'prodMoves', 'prepItemOf', 'posTables', 'kdsOn', 'openTab', 'tabSum', 'tableStates', 'kdsLive', 'kdsTicket', 'posTrim', 'ppvReport', 'invTurnover',
  // v39.4 — استيراد نقاط البيع ومطابقتها
  'piHour', 'piCutoff', 'posRecon', 'salesDays', 'importDraftClosing'];

export async function buildEngine() {
  fs.mkdirSync(cache, { recursive: true });
  // v38.3: النواة تصدّر دوال المحرك نفسها (والتطبيقات في mods/ تستورد منها) — نبني من الملف الأصلي مباشرة
  const src = "export { " + ENGINE_EXPORTS.join(', ') + " } from '../../App.jsx';\n"
    + "export { integrityChecks, groupErrors } from '../../mods/admin/SystemMaintenance.jsx';\n";   // v38.5 صيانة النظام
  // v45.9: ملف لكل عملية — ملفا اختبار يعملان معًا (node --test) كانا يكتبان الملف نفسه فيستورد أحدهما نسخة ناقصة
  const tag = process.pid + '-' + Math.random().toString(36).slice(2, 8);
  const entry = path.join(cache, 'AppEngine-' + tag + '.jsx');
  fs.writeFileSync(entry, src);
  const out = path.join(cache, 'engine-' + tag + '.mjs');
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*'] });
  try { return await import(out); }
  finally { for (const f of [entry, out]) { try { fs.unlinkSync(f); } catch { } } }
}
