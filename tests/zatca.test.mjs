/**
 * اختبارات الفاتورة الإلكترونية — المرحلة الثانية (بلا اتصال بالشبكة)
 * التحقق الرسمي على بيئة الهيئة: npm run zatca:sandbox
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { generateEgsKeys, buildCsr } from '../zatca/csr.js';
import { signInvoice, buildInvoice, computeTotals, certInfo, FIRST_PIH } from '../zatca/invoice.js';
import { readTlv } from '../zatca/der.js';

const CERT = JSON.parse(fs.readFileSync(new URL('./fixtures/zatca-sandbox-cert.json', import.meta.url), 'utf8')).certificate;
const seller = { name: 'مطاعم عم قاسم & شركاه', vat: '399999999900003', idValue: '1010010000', address: { street: 'طريق الملك فهد', building: '1234', plot: '1234', district: 'العليا', city: 'الرياض', postal: '12345' } };
const base = (x = {}) => ({ kind: 'simplified', doc: 'invoice', id: 'T-1', uuid: '3cf5ee18-ee25-44ea-a444-2c37ba7f28be', issueDate: '2026-11-09', issueTime: '10:15:00', icv: 1, pih: FIRST_PIH, seller, lines: [{ name: 'برجر', qty: 2, price: 20 }, { name: 'عصير', qty: 1, price: 10.43 }], ...x });
const qrTags = (b64) => { const b = Buffer.from(b64, 'base64'); const o = {}; for (let i = 0; i < b.length;) { const t = b[i], l = b[i + 1]; o[t] = b.subarray(i + 2, i + 2 + l); i += 2 + l; } return o; };

test('CSR: توقيعه صحيح وفيه قالب الشهادة وبيانات الجهاز', () => {
  const k = generateEgsKeys();
  const pem = buildCsr({ env: 'sandbox', commonName: 'TST-1', orgUnit: 'Branch', orgName: 'Org', egsSerial: '1-Mizan|2-POS|3-x', vat: '399999999900003', invoiceTypes: '1100', address: 'RRRD2929', industry: 'Food' }, k.privateKeyPem);
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
  const top = readTlv(der, 0), cri = readTlv(der, top.start + top.hdr), alg = readTlv(der, cri.end), sig = readTlv(der, alg.end);
  const pub = crypto.createPublicKey({ key: k.publicKeyDer, format: 'der', type: 'spki' });
  assert.equal(crypto.verify('sha256', der.subarray(cri.start, cri.end), pub, sig.body.subarray(1)), true);
  const s = der.toString('latin1'); assert.ok(s.includes('TSTZATCA-Code-Signing')); assert.ok(s.includes('399999999900003'));
});

test('الحسابات: تقريب البند ثم ضريبة الفئة = الوعاء × النسبة', () => {
  const T = computeTotals([{ name: 'ماء', qty: 3, price: 3.33 }, { name: 'خبز', qty: 7, price: 1.17 }, { name: 'تصدير', qty: 1, price: 100, vatRate: 0, vatCategory: 'Z' }]);
  assert.deepEqual([T.net, T.vat, T.total], [118.18, 2.73, 120.91]);
  const D = computeTotals([{ name: 'وجبة', qty: 2, price: 120, discount: 15.5 }]);
  assert.deepEqual([D.net, D.vat, D.total], [224.5, 33.68, 258.18]);
});

test('التجزئة: SHA-256 للفاتورة بعد حذف التوقيع والملحقات وQR — ومستقلة عن وقت التوقيع', () => {
  const k = generateEgsKeys();
  const a = signInvoice(base(), CERT, k.privateKeyPem, '2026-11-09T10:15:00'), b = signInvoice(base(), CERT, k.privateKeyPem, '2026-11-09T11:00:00');
  assert.equal(a.hash, b.hash);
  const pure = a.xml.replace('<?xml version="1.0" encoding="UTF-8"?>', '').replace(/<ext:UBLExtensions>.*<\/ext:UBLExtensions>/, '')
    .replace(/<cac:AdditionalDocumentReference><cbc:ID>QR<\/cbc:ID>.*?<\/cac:AdditionalDocumentReference>/, '').replace(/<cac:Signature>.*?<\/cac:Signature>/, '');
  assert.equal(crypto.createHash('sha256').update(pure).digest('base64'), a.hash);
  assert.notEqual(signInvoice(base({ icv: 2 }), CERT, k.privateKeyPem).hash, a.hash, 'العدّاد جزء من التجزئة');
});

test('التوقيع: ECDSA لتجزئة الفاتورة يتحقق بالمفتاح العام للجهاز', () => {
  const k = generateEgsKeys(); const s = signInvoice(base(), CERT, k.privateKeyPem);
  const pub = crypto.createPublicKey({ key: k.publicKeyDer, format: 'der', type: 'spki' });
  assert.equal(crypto.verify('sha256', Buffer.from(s.hash, 'base64'), pub, Buffer.from(s.signature, 'base64')), true);
});

test('رمز QR: 9 وسوم للمبسّطة و8 للضريبية بالقيم الصحيحة', () => {
  const k = generateEgsKeys(); const ci = certInfo(CERT);
  const s = signInvoice(base(), CERT, k.privateKeyPem); const q = qrTags(s.qr);
  assert.equal(Object.keys(q).length, 9);
  assert.equal(q[1].toString(), seller.name); assert.equal(q[2].toString(), '399999999900003'); assert.equal(q[3].toString(), '2026-11-09T10:15:00');
  assert.equal(q[4].toString(), '57.99'); assert.equal(q[5].toString(), '7.56'); assert.equal(q[6].toString(), s.hash); assert.equal(q[7].toString(), s.signature);
  assert.deepEqual(q[8], ci.publicKey); assert.deepEqual(q[9], ci.certSignature);
  const st = signInvoice(base({ kind: 'standard', buyer: { name: 'م', vat: '399999999800003', address: seller.address } }), CERT, k.privateKeyPem);
  assert.equal(Object.keys(qrTags(st.qr)).length, 8);
});

test('البنية: ترتيب العناصر، ورموز الأنواع، والإشعار الدائن يحمل المرجع والسبب', () => {
  const k = generateEgsKeys();
  const x = signInvoice(base({ kind: 'standard', doc: 'credit', refId: 'INV-9', reason: 'إرجاع', buyer: { name: 'م', vat: '399999999800003', address: seller.address } }), CERT, k.privateKeyPem).xml;
  assert.match(x, /<cbc:InvoiceTypeCode name="0100000">381<\/cbc:InvoiceTypeCode>/);
  assert.match(x, /<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>INV-9<\/cbc:ID>/);
  assert.match(x, /<cbc:InstructionNote>إرجاع<\/cbc:InstructionNote>/);
  const order = ['ext:UBLExtensions', 'cbc:ProfileID', 'cbc:ID', 'cbc:UUID', 'cbc:IssueDate', 'cbc:IssueTime', 'cbc:InvoiceTypeCode', 'cbc:DocumentCurrencyCode', 'cac:BillingReference', 'cac:AdditionalDocumentReference', 'cac:Signature', 'cac:AccountingSupplierParty', 'cac:AccountingCustomerParty', 'cac:Delivery', 'cac:PaymentMeans', 'cac:TaxTotal', 'cac:LegalMonetaryTotal', 'cac:InvoiceLine'];
  const body = x.slice(x.indexOf('</ext:UBLExtensions>'));   // العناصر المباشرة بعد ملحق التوقيع
  const pos = order.map(t => t === 'ext:UBLExtensions' ? x.indexOf('<ext:UBLExtensions>') : (body.indexOf('<' + t + '>') >= 0 ? body.indexOf('<' + t + '>') : body.indexOf('<' + t + ' ')) + x.indexOf('</ext:UBLExtensions>'));
  assert.ok(pos.every(p => p >= 0), 'كل العناصر موجودة');
  assert.deepEqual(pos.slice().sort((a, b) => a - b), pos, 'ترتيب العناصر وفق المخطط');
  assert.match(x, /<cbc:ID schemeAgencyID="6" schemeID="UN\/ECE 5305">S<\/cbc:ID>/, 'السمات بالترتيب القانوني');
  assert.ok(x.includes('مطاعم عم قاسم &amp; شركاه'), 'ترميز الرموز الخاصة');
});

test('خزنة الأسرار: AES-256-GCM يُفك بمفتاح الخادم فقط ولحزمة الجهاز نفسه فقط', async () => {
  process.env.ZATCA_ENC_KEY = crypto.randomBytes(32).toString('base64');
  const { seal, open, vaultReady } = await import('../zatca/vault.js');
  assert.equal(vaultReady(), true);
  const s = seal({ privateKeyPem: 'SECRET-PEM', production: { token: 't', secret: 's' } }, 'egs|simulation|b1');
  assert.ok(!s.includes('SECRET'), 'لا نص مكشوف');
  assert.deepEqual(open(s, 'egs|simulation|b1').privateKeyPem, 'SECRET-PEM');
  assert.throws(() => open(s, 'egs|simulation|b2'), 'حزمة فرع لا تُفك باسم فرع آخر');
  const k0 = process.env.ZATCA_ENC_KEY; process.env.ZATCA_ENC_KEY = crypto.randomBytes(32).toString('base64');
  assert.throws(() => open(s, 'egs|simulation|b1'), 'مفتاح خادم مختلف لا يفك');
  process.env.ZATCA_ENC_KEY = k0;
});
