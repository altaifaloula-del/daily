// مفاتيح جهاز الإصدار (EGS) وطلب الشهادة (CSR) وفق مواصفات هيئة الزكاة والضريبة والجمارك
// المنحنى secp256k1، والتوقيع ECDSA-SHA256، وامتدادا: اسم القالب (1.3.6.1.4.1.311.20.2) وsubjectAltName/dirName
import crypto from 'node:crypto';
import { seq, set, oid, utf8, printable, int0, octet, bitstr, ctx } from './der.js';

export const CERT_TEMPLATE = { sandbox: 'TSTZATCA-Code-Signing', simulation: 'PREZATCA-Code-Signing', production: 'ZATCA-Code-Signing' };

export function generateEgsKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  return { privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), publicKeyDer: publicKey.export({ type: 'spki', format: 'der' }) };
}
const rdn = (o, v) => set(seq(oid(o), v));
const pem = (label, der) => `-----BEGIN ${label}-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;

/**
 * @param {object} p
 *  env: sandbox|simulation|production · commonName · orgUnit (الفرع أو الرقم الموحد العشري للمجموعة) · orgName
 *  egsSerial: '1-Mizan|2-POS|3-<معرّف الجهاز>' · vat (15 رقمًا يبدأ وينتهي بـ3) · invoiceTypes: '1100' (ضريبية+مبسطة) · address · industry
 */
export function buildCsr(p, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const spki = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
  const subject = seq(rdn('2.5.4.6', printable('SA')), rdn('2.5.4.11', utf8(p.orgUnit)), rdn('2.5.4.10', utf8(p.orgName)), rdn('2.5.4.3', utf8(p.commonName)));
  const dirName = seq(rdn('2.5.4.4', utf8(p.egsSerial)), rdn('0.9.2342.19200300.100.1.1', utf8(p.vat)), rdn('2.5.4.12', utf8(p.invoiceTypes || '1100')),
    rdn('2.5.4.26', utf8(p.address)), rdn('2.5.4.15', utf8(p.industry)));
  const extTemplate = seq(oid('1.3.6.1.4.1.311.20.2'), octet(utf8(CERT_TEMPLATE[p.env || 'sandbox'])));
  const extSan = seq(oid('2.5.29.17'), octet(seq(ctx(4, dirName))));
  const attrs = ctx(0, seq(oid('1.2.840.113549.1.9.14'), set(seq(extTemplate, extSan))));
  const cri = seq(int0(), subject, spki, attrs);
  const sig = crypto.sign('sha256', cri, key);
  const der = seq(cri, seq(oid('1.2.840.10045.4.3.2')), bitstr(sig));
  return pem('CERTIFICATE REQUEST', der);
}
