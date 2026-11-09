/**
 * الفاتورة الإلكترونية — المرحلة الثانية (الربط والتكامل) وفق مواصفات هيئة الزكاة والضريبة والجمارك
 *   • UBL 2.1 بالعناصر وترتيبها كما يطلبها مخطط الهيئة، مكتوبة بلا مسافات بين العناصر (شكلها القانوني C14N هو نفسها)
 *     فتجزئة الفاتورة = SHA-256 للنص بعد حذف UBLExtensions وcac:Signature ومرجع QR — بلا محلل XML ولا مكتبات.
 *   • ختم التشفير: توقيع ECDSA-secp256k1 لتجزئة الفاتورة، وXAdES (SignedProperties) بتجزئة شكله القانوني الحصري.
 *   • رمز QR بالوسوم 1–9 (المبسّطة) أو 1–8.
 *   • السلسلة: كل فاتورة تحمل عدّادها (ICV) وتجزئة الفاتورة السابقة (PIH) للجهاز نفسه.
 */
import crypto from 'node:crypto';
import { readTlv } from './der.js';

const NS = {
  inv: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  sig: 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
  sac: 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
  sbc: 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#'
};
/** تجزئة «الفاتورة السابقة» لأول فاتورة في سلسلة الجهاز: base64(hex(SHA256("0"))) */
export const FIRST_PIH = Buffer.from(crypto.createHash('sha256').update('0').digest('hex')).toString('base64');
export const TYPE_CODE = { invoice: '388', credit: '381', debit: '383' };
export const PAY_CODE = { cash: '10', card: '48', transfer: '30', credit: '30', other: '1' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
const escA = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
// السمات بترتيب الشكل القانوني (C14N): أبجدي بنقاط الترميز — schemeAgencyID قبل schemeID
const at = (attrs) => attrs ? Object.keys(attrs).sort((x, y) => x < y ? -1 : x > y ? 1 : 0).map(k => ` ${k}="${escA(attrs[k])}"`).join('') : '';
const el = (tag, text, attrs) => `<${tag}${at(attrs)}>${esc(text)}</${tag}>`;
const wrap = (tag, inner, attrs) => `<${tag}${at(attrs)}>${inner}</${tag}>`;
// تقريب نصف للأعلى بلا أخطاء الفاصلة العائمة (33.675 ← 33.68 لا 33.67)
const r2 = (n) => { const v = Number(n) || 0; const s = Math.sign(v) || 1; return s * Math.round(Number((Math.abs(v) * 100).toPrecision(12))) / 100; };
const a2 = (n) => r2(n).toFixed(2);
const amt = (tag, n) => el(tag, a2(n), { currencyID: 'SAR' });

function address(a = {}) {
  return wrap('cac:PostalAddress',
    (a.street ? el('cbc:StreetName', a.street) : '') + (a.additionalStreet ? el('cbc:AdditionalStreetName', a.additionalStreet) : '') +
    (a.building ? el('cbc:BuildingNumber', a.building) : '') + (a.plot ? el('cbc:PlotIdentification', a.plot) : '') +
    (a.district ? el('cbc:CitySubdivisionName', a.district) : '') + (a.city ? el('cbc:CityName', a.city) : '') +
    (a.postal ? el('cbc:PostalZone', a.postal) : '') + (a.region ? el('cbc:CountrySubentity', a.region) : '') +
    wrap('cac:Country', el('cbc:IdentificationCode', a.country || 'SA')));
}
function party(p = {}) {
  return wrap('cac:Party',
    (p.idValue ? wrap('cac:PartyIdentification', el('cbc:ID', p.idValue, { schemeID: p.idScheme || 'CRN' })) : '') +
    address(p.address) +
    (p.vat ? wrap('cac:PartyTaxScheme', el('cbc:CompanyID', p.vat) + wrap('cac:TaxScheme', el('cbc:ID', 'VAT'))) : wrap('cac:PartyTaxScheme', wrap('cac:TaxScheme', el('cbc:ID', 'VAT')))) +
    wrap('cac:PartyLegalEntity', el('cbc:RegistrationName', p.name || '')));
}

/** الحسابات وفق قواعد الهيئة: صافي البند مقرّب لمنزلتين، وضريبة كل فئة = وعاؤها × النسبة */
export function computeTotals(lines) {
  const L = lines.map((l, i) => {
    const qty = Number(l.qty) || 0, price = Number(l.price) || 0, disc = r2(l.discount || 0), rate = l.vatRate == null ? 15 : Number(l.vatRate);
    const net = r2(qty * price - disc), vat = r2(net * rate / 100);
    return { ...l, i: i + 1, qty, price, disc, rate, cat: l.vatCategory || (rate > 0 ? 'S' : 'Z'), net, vat, gross: r2(net + vat) };
  });
  const cats = {};
  L.forEach(l => { const k = l.cat + '|' + l.rate; const c = cats[k] = cats[k] || { cat: l.cat, rate: l.rate, taxable: 0, reason: l.exemptReason, reasonCode: l.exemptCode }; c.taxable = r2(c.taxable + l.net); });
  Object.values(cats).forEach(c => { c.vat = r2(c.taxable * c.rate / 100); });
  const net = r2(L.reduce((s, l) => s + l.net, 0)), vat = r2(Object.values(cats).reduce((s, c) => s + c.vat, 0));
  return { lines: L, cats: Object.values(cats), net, vat, total: r2(net + vat) };
}

/**
 * يبني أجزاء الفاتورة (بلا توقيع) ويحسب تجزئتها.
 * d: { kind: 'simplified'|'standard', doc: 'invoice'|'credit'|'debit', id, uuid, issueDate 'YYYY-MM-DD', issueTime 'HH:mm:ss',
 *      icv, pih, seller{name,vat,idValue,idScheme,address}, buyer{...}, lines[{name,qty,price,discount,vatRate}], payment, reason, refId, deliveryDate }
 */
export function buildInvoice(d) {
  const T = computeTotals(d.lines || []);
  const std = d.kind === 'standard';
  const docType = TYPE_CODE[d.doc || 'invoice'];
  const pre =
    el('cbc:ProfileID', 'reporting:1.0') + el('cbc:ID', d.id) + el('cbc:UUID', d.uuid) + el('cbc:IssueDate', d.issueDate) + el('cbc:IssueTime', d.issueTime) +
    el('cbc:InvoiceTypeCode', docType, { name: std ? '0100000' : '0200000' }) +
    (d.note ? el('cbc:Note', d.note, { languageID: 'ar' }) : '') +
    el('cbc:DocumentCurrencyCode', 'SAR') + el('cbc:TaxCurrencyCode', 'SAR') +
    (d.doc && d.doc !== 'invoice' ? wrap('cac:BillingReference', wrap('cac:InvoiceDocumentReference', el('cbc:ID', d.refId || ''))) : '') +
    wrap('cac:AdditionalDocumentReference', el('cbc:ID', 'ICV') + el('cbc:UUID', String(d.icv))) +
    wrap('cac:AdditionalDocumentReference', el('cbc:ID', 'PIH') + wrap('cac:Attachment', el('cbc:EmbeddedDocumentBinaryObject', d.pih || FIRST_PIH, { mimeCode: 'text/plain' })));
  const sigRef = wrap('cac:Signature', el('cbc:ID', 'urn:oasis:names:specification:ubl:signature:Invoice') + el('cbc:SignatureMethod', 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'));
  const catXml = (c) => el('cbc:ID', c.cat, { schemeID: 'UN/ECE 5305', schemeAgencyID: '6' }) + el('cbc:Percent', a2(c.rate)) +
    (c.cat !== 'S' && c.reasonCode ? el('cbc:TaxExemptionReasonCode', c.reasonCode) + el('cbc:TaxExemptionReason', c.reason || '') : '') +
    wrap('cac:TaxScheme', el('cbc:ID', 'VAT', { schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }));
  const rest =
    wrap('cac:AccountingSupplierParty', party(d.seller)) +
    wrap('cac:AccountingCustomerParty', std || (d.buyer && d.buyer.name) ? party(d.buyer) : '') +
    (std ? wrap('cac:Delivery', el('cbc:ActualDeliveryDate', d.deliveryDate || d.issueDate)) : '') +
    wrap('cac:PaymentMeans', el('cbc:PaymentMeansCode', PAY_CODE[d.payment] || PAY_CODE.cash) + (d.doc && d.doc !== 'invoice' ? el('cbc:InstructionNote', d.reason || '') : '')) +
    wrap('cac:TaxTotal', amt('cbc:TaxAmount', T.vat)) +
    wrap('cac:TaxTotal', amt('cbc:TaxAmount', T.vat) + T.cats.map(c => wrap('cac:TaxSubtotal', amt('cbc:TaxableAmount', c.taxable) + amt('cbc:TaxAmount', c.vat) +
      wrap('cac:TaxCategory', catXml(c)))).join('')) +
    wrap('cac:LegalMonetaryTotal', amt('cbc:LineExtensionAmount', T.net) + amt('cbc:TaxExclusiveAmount', T.net) + amt('cbc:TaxInclusiveAmount', T.total) +
      amt('cbc:AllowanceTotalAmount', 0) + amt('cbc:PrepaidAmount', 0) + amt('cbc:PayableAmount', T.total)) +
    T.lines.map(l => wrap('cac:InvoiceLine',
      el('cbc:ID', String(l.i)) + el('cbc:InvoicedQuantity', String(l.qty), { unitCode: l.unit || 'PCE' }) + amt('cbc:LineExtensionAmount', l.net) +
      (l.disc ? wrap('cac:AllowanceCharge', el('cbc:ChargeIndicator', 'false') + el('cbc:AllowanceChargeReasonCode', '95') + el('cbc:AllowanceChargeReason', 'Discount') + amt('cbc:Amount', l.disc)) : '') +
      wrap('cac:TaxTotal', amt('cbc:TaxAmount', l.vat) + amt('cbc:RoundingAmount', l.gross)) +
      wrap('cac:Item', el('cbc:Name', l.name) + wrap('cac:ClassifiedTaxCategory', el('cbc:ID', l.cat) + el('cbc:Percent', a2(l.rate)) + wrap('cac:TaxScheme', el('cbc:ID', 'VAT')))) +
      wrap('cac:Price', el('cbc:PriceAmount', (Number(l.price) || 0).toFixed(2), { currencyID: 'SAR' })))).join('');
  const rootOpen = `<Invoice xmlns="${NS.inv}" xmlns:cac="${NS.cac}" xmlns:cbc="${NS.cbc}" xmlns:ext="${NS.ext}">`;
  // الشكل القانوني (C14N 1.1) بعد التحويلات الثلاث = الجذر + ما عدا التوقيع والملحقات وQR — النص نفسه لأنه مكتوب بالشكل القانوني
  const pure = rootOpen + pre + rest + '</Invoice>';
  const hash = crypto.createHash('sha256').update(pure, 'utf8').digest('base64');
  return { parts: { rootOpen, pre, sigRef, rest }, hash, totals: T, std };
}

/** معلومات الشهادة: التجزئة والمُصدِر والرقم التسلسلي والمفتاح العام وتوقيع الشهادة */
export function certInfo(certB64) {
  const b64 = String(certB64).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  const x = new crypto.X509Certificate(der);
  const top = readTlv(der, 0); let p = top.start + top.hdr;
  const tbs = readTlv(der, p); p = tbs.end; const alg = readTlv(der, p); p = alg.end; const sigBits = readTlv(der, p);
  return {
    b64, hash: Buffer.from(crypto.createHash('sha256').update(b64).digest('hex')).toString('base64'),
    issuer: x.issuer.split('\n').reverse().join(', '), serial: BigInt('0x' + x.serialNumber).toString(10),
    publicKey: x.publicKey.export({ type: 'spki', format: 'der' }), certSignature: sigBits.body.subarray(1), validTo: x.validTo
  };
}

function tlvQr(values) {
  return Buffer.concat(values.map((v, i) => { const b = Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'); if (b.length > 255) throw new Error('QR tag ' + (i + 1) + ' too long'); return Buffer.concat([Buffer.from([i + 1, b.length]), b]); })).toString('base64');
}

const signedProps = (t, ci, forHash) => {
  const ds = forHash ? ` xmlns:ds="${NS.ds}"` : '';
  return `<xades:SignedProperties${forHash ? ` xmlns:xades="${NS.xades}"` : ''} Id="xadesSignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>${t}</xades:SigningTime><xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod${ds} Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"${forHash ? '/>' : '></ds:DigestMethod>'}<ds:DigestValue${ds}>${ci.hash}</ds:DigestValue></xades:CertDigest><xades:IssuerSerial><ds:X509IssuerName${ds}>${esc(ci.issuer)}</ds:X509IssuerName><ds:X509SerialNumber${ds}>${ci.serial}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`;
};

/**
 * يوقّع الفاتورة ويعيد النص النهائي وتجزئتها ورمز QR.
 * @param d بيانات الفاتورة (انظر buildInvoice) · certB64 الشهادة · privateKeyPem المفتاح الخاص للجهاز · signingTime (اختياري)
 */
export function signInvoice(d, certB64, privateKeyPem, signingTime) {
  const B = buildInvoice(d);
  const ci = certInfo(certB64);
  const signature = crypto.sign('sha256', Buffer.from(B.hash, 'base64'), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  const t = signingTime || new Date().toISOString().slice(0, 19);
  const spHash = Buffer.from(crypto.createHash('sha256').update(signedProps(t, ci, true), 'utf8').digest('hex')).toString('base64');
  const xp = (x) => `<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>${x}</ds:XPath></ds:Transform>`;
  const ext = `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI><ext:ExtensionContent><sig:UBLDocumentSignatures xmlns:sig="${NS.sig}" xmlns:sac="${NS.sac}" xmlns:sbc="${NS.sbc}"><sac:SignatureInformation><cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID><sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID><ds:Signature xmlns:ds="${NS.ds}" Id="signature"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"></ds:SignatureMethod><ds:Reference Id="invoiceSignedData" URI=""><ds:Transforms>${xp('not(//ancestor-or-self::ext:UBLExtensions)')}${xp('not(//ancestor-or-self::cac:Signature)')}${xp("not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])")}<ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod><ds:DigestValue>${B.hash}</ds:DigestValue></ds:Reference><ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod><ds:DigestValue>${spHash}</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>${signature}</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${ci.b64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo><ds:Object><xades:QualifyingProperties xmlns:xades="${NS.xades}" Target="signature">${signedProps(t, ci, false)}</xades:QualifyingProperties></ds:Object></ds:Signature></sac:SignatureInformation></sig:UBLDocumentSignatures></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>`;
  const qrVals = [d.seller.name, d.seller.vat, d.issueDate + 'T' + d.issueTime, a2(B.totals.total), a2(B.totals.vat), B.hash, Buffer.from(signature), ci.publicKey];
  if (!B.std) qrVals.push(ci.certSignature);
  const qr = tlvQr(qrVals);
  const qrRef = wrap('cac:AdditionalDocumentReference', el('cbc:ID', 'QR') + wrap('cac:Attachment', el('cbc:EmbeddedDocumentBinaryObject', qr, { mimeCode: 'text/plain' })));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' + B.parts.rootOpen + ext + B.parts.pre + qrRef + B.parts.sigRef + B.parts.rest + '</Invoice>';
  return { xml, hash: B.hash, uuid: d.uuid, qr, signature, totals: B.totals };
}
