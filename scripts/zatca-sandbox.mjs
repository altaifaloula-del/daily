/**
 * التحقق الرسمي على بيئة المطورين لدى الهيئة (developer-portal) — يحتاج اتصالًا بالشبكة:
 *   npm run zatca:sandbox
 * يُنشئ مفاتيح وCSR جديدة، ويطلب شهادة امتثال (الرمز المؤقت الثابت لبيئة المطورين 123345)، ثم يفحص 11 مستندًا
 * (الأنواع الستة + كسور، خصم، صفري، معفى، كمية عشرية)، ثم شهادة الإنتاج وإبلاغ مبسّطة واعتماد ضريبية.
 * لا يمسّ بيانات حقيقية ولا يحتاج حساب المنشأة.
 */
import crypto from 'node:crypto';
import { generateEgsKeys, buildCsr } from '../zatca/csr.js';
import { signInvoice, FIRST_PIH } from '../zatca/invoice.js';
import { complianceCsid, complianceCheck, productionCsid, reportInvoice, clearInvoice, certFromToken } from '../zatca/api.js';

const ENV = 'sandbox', VAT = '399999999900003';
const seller = { name: 'مطاعم عم قاسم & شركاه', vat: VAT, idValue: '1010010000', idScheme: 'CRN', address: { street: 'طريق الملك فهد', building: '1234', plot: '1234', district: 'العليا', city: 'الرياض', postal: '12345' } };
const buyer = { name: 'شركة التموين <المتحدة>', vat: '399999999800003', address: { street: 'شارع التحلية', building: '5678', plot: '5678', district: 'السليمانية', city: 'الرياض', postal: '12245' } };
let fails = 0;
const show = (lbl, r, okSet) => { const v = r.json && r.json.validationResults; const st = r.json ? (r.json.reportingStatus || r.json.clearanceStatus || r.json.dispositionMessage) : r.text;
  const msgs = v ? [...(v.errorMessages || []), ...(v.warningMessages || [])] : [];
  const good = r.ok && okSet.includes(st) && !msgs.length; if (!good) fails++;
  console.log((good ? '✓ ' : '✗ ') + lbl + ' — ' + r.status + ' ' + st + (v ? ' ' + v.status : ''));
  msgs.forEach(m => console.log('    ' + m.type + ' ' + m.code + ' | ' + m.message)); };

const k = generateEgsKeys();
const csr = buildCsr({ env: ENV, commonName: 'TST-886431145-' + VAT, orgUnit: 'Olaya Branch', orgName: 'Mizan Test', egsSerial: '1-Mizan|2-POS|3-' + crypto.randomUUID(), vat: VAT, invoiceTypes: '1100', address: 'RRRD2929', industry: 'Restaurants' }, k.privateKeyPem);
const C = await complianceCsid(ENV, csr, '123345'); show('شهادة الامتثال', C, ['ISSUED']);
if (!C.ok) process.exit(1);
const cauth = { token: C.json.binarySecurityToken, secret: C.json.secret }, ccert = certFromToken(C.json.binarySecurityToken);
const now = new Date(), date = now.toISOString().slice(0, 10), time = now.toISOString().slice(11, 19);
let pih = FIRST_PIH, icv = 0;
const mk = (kind, doc, lines) => ({ kind, doc, id: 'SBX-' + (++icv), uuid: crypto.randomUUID(), issueDate: date, issueTime: time, icv, pih, seller, buyer: kind === 'standard' ? buyer : null, lines, payment: 'card', reason: 'إرجاع صنف', refId: 'SBX-1' });
const L = [{ name: 'برجر لحم دبل', qty: 2, price: 20 }, { name: 'عصير برتقال', qty: 1, price: 10.43 }];
const cases = [
  ['ضريبية', 'standard', 'invoice', L], ['إشعار دائن ضريبي', 'standard', 'credit', L], ['إشعار مدين ضريبي', 'standard', 'debit', L],
  ['مبسّطة', 'simplified', 'invoice', L], ['إشعار دائن مبسّط', 'simplified', 'credit', L], ['إشعار مدين مبسّط', 'simplified', 'debit', L],
  ['كسور', 'simplified', 'invoice', [{ name: 'ماء', qty: 3, price: 3.33 }, { name: 'خبز', qty: 7, price: 1.17 }]],
  ['خصم على البند', 'standard', 'invoice', [{ name: 'وجبة عائلية', qty: 2, price: 120, discount: 15.5 }]],
  ['صفري + خاضع', 'standard', 'invoice', [{ name: 'وجبة', qty: 1, price: 50 }, { name: 'تصدير', qty: 1, price: 100, vatRate: 0, vatCategory: 'Z', exemptCode: 'VATEX-SA-32', exemptReason: 'Export of goods' }]],
  ['معفى', 'simplified', 'invoice', [{ name: 'خدمة مالية', qty: 1, price: 200, vatRate: 0, vatCategory: 'E', exemptCode: 'VATEX-SA-29', exemptReason: 'Financial services mentioned in Article 29 of the VAT Regulations' }]],
  ['كمية عشرية', 'simplified', 'invoice', [{ name: 'لحم بالكيلو', qty: 1.25, price: 79.9, unit: 'KGM' }]]
];
for (const [lbl, kind, doc, lines] of cases) { const s = signInvoice(mk(kind, doc, lines), ccert, k.privateKeyPem); show('امتثال: ' + lbl, await complianceCheck(ENV, cauth, s), ['REPORTED', 'CLEARED']); pih = s.hash; }
const P = await productionCsid(ENV, cauth, C.json.requestID); show('شهادة الإنتاج', P, ['ISSUED']);
if (P.ok) {
  const pauth = { token: P.json.binarySecurityToken, secret: P.json.secret }, pcert = certFromToken(P.json.binarySecurityToken);
  const s1 = signInvoice(mk('simplified', 'invoice', [{ name: 'برجر', qty: 1, price: 20 }]), pcert, k.privateKeyPem); show('إبلاغ فاتورة مبسّطة', await reportInvoice(ENV, pauth, s1), ['REPORTED']); pih = s1.hash;
  const s2 = signInvoice(mk('standard', 'invoice', [{ name: 'تموين', qty: 10, price: 45 }]), pcert, k.privateKeyPem); show('اعتماد فاتورة ضريبية', await clearInvoice(ENV, pauth, s2), ['CLEARED']);
}
console.log(fails ? `\n✗ ${fails} فحص لم يجتز` : '\n✓ كل الفحوص اجتازت أداة الهيئة بلا أخطاء ولا تحذيرات');
process.exit(fails ? 1 : 0);
