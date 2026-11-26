// يبني نسخة من App.jsx للاختبار في Node: يضيف تصديرًا لدوال المحرك المحاسبي الداخلية ويجمّعها بـ esbuild.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'tests', '.cache');
export const ENGINE_EXPORTS = ['mkcRecord', 'lytRecord', 'lytDocId', 'mkcDiff', 'mkcCompare', 'lytCompare', 'signDeclaration', 'lvReturnPlan', 'lvTrack', 'leaveSignDoc', 'mktUnmergeBlock', 'splitOps', 'composeOps', 'outOfScopeRecords', 'rwPendSplit', 'rwUndoTx', 'MKT_BR_CV', 'mktBrOn', 'mktRecBranch', 'mktMergesLive', 'promoEligible', 'couponWhy', 'promoDiscPct', 'promoMarginCheck', 'loyX', 'loyTier', 'loyEarnX', 'loyExpiring', 'loyPeriodicTx', 'mktProfiles', 'rewardCoupon', 'mktCfg', 'mktCanApprove', 'mktAlias', 'mktConsentOf', 'mktCanContact', 'crmBuild', 'crmSegment', 'crmDupes', 'mktKpis', 'moveIdx', 'recurNext', 'recurDue', 'recurApply', 'INV_CLS', 'XI_CLS', 'accClsOf', 'invCls', 'isLayout', 'cfoDash', 'finRecs', 'CTL_CAT', 'CTL_SEV', 'REC_PRI', 'REC_DEPT', 'HUBS', 'HUB_BASE', 'hubTabs', 'HR_TABS', 'appOfTab', 'appTaskBadges', 'homeKpis', 'isLateWork', 'recRealized', 'newAction', 'CTL_ST', 'CTL_FLOW', 'ctlScan', 'caseSync', 'caseMove', 'FA_RATIOS', 'faSnap', 'faQuality', 'finAnalyze', 'MCP_KINDS', 'mcpPlanJournal', 'mcpPlanReclass', 'mcpApplyReclass', 'mcpPlanExp', 'periodLocked', 'lockedLedgerChanged', 'yearEndDates', 'yearEndNext', 'pjNumber', 'pjStamp', 'pjBackfill', 'pjMissing', 'xiDetect', 'xiPlan', 'xiRecords', 'xiNum', 'XI_TEMPLATE', 'catListOf', 'catsFor', 'catOf', 'recDomains', 'domCfgOf', 'domOk', 'domFilter', 'userBrIds', 'DOMAIN_DEF', 'posYmOf', 'posSplitOn', 'posSplitDoc', 'posJoin', 'brRead', 'brWrite', 'posSplitBranch', 'posUnsplitBranch', 'posKey', 'loyAudit', 'LOY_AUDIT_WHY', 'growthDigest', 'aiGrowthClean', 'AI_GROWTH_PRESETS', 'commsCfgOf', 'commsRender', 'smsParts', 'commsQuiet', 'commsTplErr', 'COMMS_VARS', 'brReport', 'BRR_CH', 'dtLocal', 'arTime', 'recCfgOf', 'recIndex', 'recFor', 'recStats', 'REC_DEF', 'campNextNo', 'campStatusOf', 'campStats', 'campSpend', 'CAMP_ST', 'autoCfgOf', 'payrollAccrualApply', 'poSuggestions', 'autoAlerts', 'prevMonthOf', 'canEditRec', 'editPermOf', 'EDIT_KINDS', 'voiceNorm', 'projList', 'projectPL', 'projNextCode', 'CV_KIND', 'fefoPick', 'lotsFor', 'expiryLots', 'posReturnCalc', 'posReturnable', 'posHoldPut', 'posHoldRecall', 'POS_HOLD_MAX', 'posRefundOptions', 'posReturnLoyDed', 'jeLive', 'jeOwner', 'canApproveJe', 'gosiNewSched', 'gosiNewAuto', 'payrollRowsOf', 'payFactor', 'otRateOf', 'otFromAttendance', 'stockShortages', 'computeSmartAlerts', 'applyCashVoucher', 'cvNextNo', 'partyOpenDocs', 'assignVouchers', 'voucherList', 'syncSaleMoves', 'saleDayUse', 'saleUse', 'saleRecipeItems', 'itemLedger', 'closeAlertEvents', 'closeAlertsCfg', 'closeAlertFor', 'cutoutPixels', 'prepWasteStats', 'normDigits', 'normScan', 'posPaper', 'posReceiptHtml', 'posShiftHtml', 'prepBatchState', 'prepShelfH', 'BR_PURCHASERS', 'poWhOf', 'syncPoInbox', 'INV_BILLERS', 'buildAccounting', 'buildPartners', 'stockByWh', 'stockCosting', 'itemAvgCosts', 'siStamp', 'siVerify', 'siRem', 'sha256Hex',
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
  'staffingPlan', 'ROLES', 'rolePost', 'sigDigest', 'sigVerify', 'profitDays', 'profitMissing', 'menuEngineering', 'savingsOpps', 'savingsTrack', 'savingsMeasure', 'cardStmtLines', 'cardRecon', 'cardSettlePlan', 'fsStatus', 'fsInRange', 'cashCountStatus', 'ccOpenShifts', 'maintStatus', 'archivePlan', 'archKey', 'detectStmtMap', 'parseXlsxGrid', 'recipeRaw', 'recipeCost', 'prepUnitCost', 'usageReport', 'prepMix', 'prepPlan', 'recipeKcal', 'productKcal', 'dataFootprint', 'kcalPerUnit', 'ibanStatus', 'ibanApply', 'ibanNorm', 'IBAN_APPROVERS', 'verifyBackup', 'mzbkDecrypt', 'isMzbk', 'clrData', 'clrRecord', 'clrKeyId', 'tbNorm', 'tenantBrand', 'tbCss', 'tbHeadHtml', 'TB_NEUTRAL', 'rptPivot', 'rptTpl', 'salesInvoiceHtml', 'gsearch', 'gsNorm', 'kbAction', 'tnRemember', 'tnHref', 'tnOkId', 'roleDash', 'roleDashList', 'roleDashDefault', 'RD_DEF', 'clrSigRef', 'clrDiff', 'clrCompare', 'clrOn', 'fjData', 'fjStatus', 'fjRecord', 'fjDiff', 'fjCompare', 'fjOn', 'fpLockedTo', 'fpOn', 'fjLegacyRecord', 'jeAutoSt', 'fdDate', 'fdData', 'fdProg', 'fdPaid', 'fdRecord', 'fdDiff', 'fdCompare', 'vatCloseLive', 'costMethod', 'costCompare', 'glLedger', 'acctActivity', 'myWorkGroups', 'ACCT_GROUPS', 'ACCT_SECTIONS', 'MZ_LOGO_HTML', 'rptShell', 'rptFlat', 'rptTotals', 'rptHtml', 'makeXlsx', 'rptXlsxRows', 'makeRptXlsx', 'rptCsv', 'depMethod', 'deprSchedule', 'wfTiers', 'wfRequired', 'poNeedsAppr', 'wfState', 'wfCanAct', 'wfApprove', 'negStockChanges', 'negStockMsg', 'posAreas', 'tableArea', 'areasErr', 'salesByArea', 'posDrivers', 'dlvNeeded', 'dlvRecord', 'dlvMove', 'dlvSummary', 'rfqNextNo', 'rfqCompare', 'rfqToPOs', 'pmPeriod', 'profitMatrix', 'itemBin', 'binSort', 'binOrder', 'dedupeSameId', 'findRecentDups', 'findDupClosings', 'clDayKey', 'dirOf', 'clrMerge', 'clrRead', 'prodNeeds', 'prodCheck', 'prodMoves', 'prepItemOf', 'posTables', 'kdsOn', 'openTab', 'tabSum', 'tableStates', 'kdsLive', 'kdsTicket', 'posTrim', 'ppvReport', 'invTurnover',
  // v39.4 — استيراد نقاط البيع ومطابقتها
  'piHour', 'piCutoff', 'posRecon', 'salesDays', 'importDraftClosing',
  // v56.2 — MUKTASAB POS الدفعة 1 (حراس الإلغاء والترقيم وحساب الطاولة)
  'posVoidBlock', 'posSeqSeed', 'posChainSeed', 'posNextNo', 'posTabCuts', 'posReturnHtml',
  // v56.4 — الدفعة 2a: سجلات فواتير نقطة البيع
  'posrOn', 'posrData', 'posrVoidData', 'posrRecord', 'posrDiff', 'posrCompare',
  // v56.7 — C4 التطابق التام بالهللات
  'toHal', 'isHal', 'finStrictOn',
  // v56.9 — D1 دفتر القيود المخزّن
  'FL_START', 'flOn', 'flKey', 'flNo', 'flLines', 'flRecord', 'flScope', 'flCompare', 'flOpening',
  'FL_GROUPS', 'flLvl', 'flGroupOf', 'flUnclassified', 'flReversalOf'];

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
