// تشفير أسرار جهاز الإصدار (المفتاح الخاص + بيانات الشهادات) بـ AES-256-GCM بمفتاح لا يملكه إلا الخادم (ZATCA_ENC_KEY)
// النص المشفّر يُحفظ في بيانات المنشأة؛ المتصفح يراه ولا يستطيع فكّه، والخادم وحده يفكّه عند التوقيع.
import crypto from 'node:crypto';
const keyOf = (secret) => crypto.createHash('sha256').update('mizan-zatca-v1|' + String(secret)).digest();
export const vaultReady = () => String(process.env.ZATCA_ENC_KEY || '').trim().length >= 32;
export function seal(obj, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(process.env.ZATCA_ENC_KEY), iv);
  c.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 'v1.' + iv.toString('base64') + '.' + c.getAuthTag().toString('base64') + '.' + ct.toString('base64');
}
export function open(sealed, aad) {
  const [v, iv, tag, ct] = String(sealed || '').split('.'); if (v !== 'v1') throw new Error('bad-vault');
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(process.env.ZATCA_ENC_KEY), Buffer.from(iv, 'base64'));
  d.setAAD(Buffer.from(String(aad))); d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'));
}
