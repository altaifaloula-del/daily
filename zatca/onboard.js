/**
 * تسجيل جهاز إصدار (EGS) لفرع لدى منصة «فاتورة»:
 *   مفاتيح جديدة ← CSR ← شهادة الامتثال بالرمز المؤقت ← 6 فحوص امتثال ببيانات المنشأة ← شهادة الإنتاج
 * يعيد خطوات مقروءة + حزمة أسرار مشفّرة (لا يعود المفتاح الخاص ولا كلمات السر مكشوفة أبدًا).
 */
import crypto from 'node:crypto';
import { generateEgsKeys, buildCsr } from './csr.js';
import { signInvoice, FIRST_PIH, certInfo } from './invoice.js';
import { complianceCsid, complianceCheck, productionCsid, certFromToken } from './api.js';
import { seal } from './vault.js';

const ENVS = ['sandbox', 'simulation', 'production'];
const vatOk = (v) => /^3\d{13}3$/.test(String(v || ''));
/** يتحقق من بيانات المنشأة المطلوبة في الفاتورة (العنوان الوطني والسجل والرقم الضريبي) */
export function sellerProblems(s = {}) {
  const a = s.address || {}, p = [];
  if (!String(s.name || '').trim()) p.push('الاسم المسجّل للمنشأة');
  if (!vatOk(s.vat)) p.push('الرقم الضريبي (15 رقمًا يبدأ وينتهي بـ3)');
  if (!/^\d{10}$/.test(String(s.crn || ''))) p.push('السجل التجاري (10 أرقام)');
  if (!/^\d{4}$/.test(String(a.building || ''))) p.push('رقم المبنى (4 أرقام)');
  if (!String(a.street || '').trim()) p.push('اسم الشارع');
  if (!String(a.district || '').trim()) p.push('الحي');
  if (!String(a.city || '').trim()) p.push('المدينة');
  if (!/^\d{5}$/.test(String(a.postal || ''))) p.push('الرمز البريدي (5 أرقام)');
  if (a.plot && !/^\d{4}$/.test(String(a.plot))) p.push('الرقم الإضافي (4 أرقام)');
  return p;
}
const statusOf = (r) => r.json ? (r.json.reportingStatus || r.json.clearanceStatus || r.json.dispositionMessage || '') : '';
const msgsOf = (r) => { const v = r.json && r.json.validationResults; const e = (r.json && r.json.errors) || [];
  return [...(v ? [...(v.errorMessages || []), ...(v.warningMessages || [])] : []), ...(Array.isArray(e) ? e : [])].map(m => ({ type: m.type || 'ERROR', code: m.code || '', message: m.message || String(m) })).slice(0, 8); };

/**
 * @param {{env:string, otp:string, seller:object, branch:{id:string,name:string}, industry?:string}} p
 */
export async function onboardEgs(p) {
  const env = ENVS.includes(p.env) ? p.env : 'simulation';
  const steps = []; const step = (k, ok, detail, msgs) => { steps.push({ k, ok, detail: detail || '', msgs: msgs || [] }); return ok; };
  const s = { ...p.seller, address: { ...(p.seller && p.seller.address) } };
  const bad = sellerProblems(s);
  if (bad.length) return { ok: false, steps: [{ k: 'بيانات المنشأة', ok: false, detail: 'ناقصة: ' + bad.join('، ') }] };
  if (!/^\d{6}$/.test(String(p.otp || ''))) return { ok: false, steps: [{ k: 'الرمز المؤقت', ok: false, detail: 'الرمز 6 أرقام من بوابة «فاتورة»' }] };
  const branch = p.branch || {}; const egsId = String(branch.id || '').replace(/[^\w-]/g, '').slice(0, 40) || crypto.randomUUID();

  // 1) المفاتيح وطلب الشهادة
  const k = generateEgsKeys();
  const csr = buildCsr({ env, commonName: 'MZN-' + egsId + '-' + s.vat, orgUnit: String(branch.name || 'Branch').slice(0, 60), orgName: String(s.name).slice(0, 60),
    egsSerial: '1-Mizan|2-POS|3-' + egsId, vat: s.vat, invoiceTypes: '1100', address: [s.address.building, s.address.street, s.address.city].filter(Boolean).join(' ').slice(0, 60),
    industry: String(p.industry || s.industry || 'Restaurants').slice(0, 60) }, k.privateKeyPem);
  step('المفاتيح وطلب الشهادة', true, 'secp256k1 · ' + egsId);

  // 2) شهادة الامتثال بالرمز المؤقت
  const C = await complianceCsid(env, csr, p.otp);
  if (!step('شهادة الامتثال', C.ok && statusOf(C) === 'ISSUED', C.ok ? statusOf(C) : 'HTTP ' + C.status, msgsOf(C)) ) return { ok: false, steps };
  const cauth = { token: C.json.binarySecurityToken, secret: C.json.secret }, ccert = certFromToken(C.json.binarySecurityToken);

  // 3) فحوص الامتثال الستة ببيانات المنشأة (الأنواع التي يصدرها الجهاز: ضريبية ومبسّطة)
  const seller = { name: s.name, vat: s.vat, idValue: s.crn, idScheme: 'CRN', address: s.address };
  const buyer = { name: 'Compliance Test Buyer', vat: '399999999800003', address: { street: 'Test Street', building: '1111', plot: '2222', district: 'Test District', city: 'Riyadh', postal: '12345' } };
  const now = new Date(), date = now.toISOString().slice(0, 10), time = now.toISOString().slice(11, 19);
  let pih = FIRST_PIH, icv = 0, allOk = true;
  const L = [{ name: 'Compliance item', qty: 1, price: 100 }];
  for (const [lbl, kind, doc] of [['فاتورة ضريبية', 'standard', 'invoice'], ['إشعار دائن ضريبي', 'standard', 'credit'], ['إشعار مدين ضريبي', 'standard', 'debit'],
    ['فاتورة مبسّطة', 'simplified', 'invoice'], ['إشعار دائن مبسّط', 'simplified', 'credit'], ['إشعار مدين مبسّط', 'simplified', 'debit']]) {
    icv++;
    const inv = signInvoice({ kind, doc, id: 'CMP-' + icv, uuid: crypto.randomUUID(), issueDate: date, issueTime: time, icv, pih, seller, buyer: kind === 'standard' ? buyer : null, lines: L, payment: 'cash', reason: 'Compliance check', refId: 'CMP-1' }, ccert, k.privateKeyPem);
    const r = await complianceCheck(env, cauth, inv); const st = statusOf(r);
    const ok = r.ok && (st === 'REPORTED' || st === 'CLEARED');
    allOk = step('امتثال: ' + lbl, ok, st || ('HTTP ' + r.status), msgsOf(r)) && allOk;
    pih = inv.hash;
  }
  if (!allOk) return { ok: false, steps };

  // 4) شهادة الإنتاج
  const P = await productionCsid(env, cauth, C.json.requestID);
  if (!step('شهادة الإنتاج', P.ok && statusOf(P) === 'ISSUED', P.ok ? statusOf(P) : 'HTTP ' + P.status, msgsOf(P))) return { ok: false, steps };
  const pcert = certFromToken(P.json.binarySecurityToken); const ci = certInfo(pcert);
  const vault = seal({ privateKeyPem: k.privateKeyPem, production: { token: P.json.binarySecurityToken, secret: P.json.secret }, compliance: { token: C.json.binarySecurityToken, secret: C.json.secret, requestID: C.json.requestID } },
    'egs|' + env + '|' + egsId);
  return { ok: true, steps, egs: { env, egsId, vault, cert: { serial: ci.serial, issuer: ci.issuer, validTo: ci.validTo }, icv: 0, pih: FIRST_PIH } };
}
