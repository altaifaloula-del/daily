// تشفير أسرار جهاز الإصدار (المفتاح الخاص + بيانات الشهادات) بـ AES-256-GCM بمفتاح لا يملكه إلا الخادم
// النص المشفّر يُحفظ في بيانات المنشأة؛ المتصفح يراه ولا يستطيع فكّه، والخادم وحده يفكّه عند التوقيع.
// v51.2 (S3): مفتاح لكل منشأة { secret, tenant }. الطيف (default) = ZATCA_ENC_KEY واشتقاقه القديم نفسه — أجهزته المسجّلة تبقى تُفك.
// غير الطيف: الاشتقاق يتضمن معرّف المنشأة، فلا يُفك جهاز منشأة بمفتاح منشأة أخرى حتى لو تشابه السر خطأً.
import crypto from 'node:crypto';
const pick = (v) => (v && typeof v === 'object') ? { secret: String(v.secret || ''), tenant: v.tenant || 'default' } : { secret: String(process.env.ZATCA_ENC_KEY || ''), tenant: 'default' };
const keyOf = (v) => { const { secret, tenant } = pick(v); return crypto.createHash('sha256').update((tenant === 'default' ? 'mizan-zatca-v1|' : 'mithqal-zatca-v2|' + tenant + '|') + secret).digest(); };
export const vaultReady = (v) => pick(v).secret.trim().length >= 32;
/* v56.0 (BUG-012): بصمة المفتاح (ليست سرًا: تجزئة أحادية للمفتاح المشتق) — تُلحق بكل حزمة مشفّرة وتُعرض في /api/zatca/config.
   إن أُعيد إنشاء الخدمة بمفتاح جديد تظهر البصمة مختلفة فورًا ويُرفض الفك برسالة صريحة «vault-key-mismatch» بدل فشل غامض،
   ويمكن تثبيت البصمة المتوقعة في ZATCA_KEY_ID فيحذّر الخادم عند الإقلاع إن تغيّر المفتاح. */
export const keyId = (v) => vaultReady(v) ? crypto.createHash('sha256').update('mithqal-kid|').update(keyOf(v)).digest('hex').slice(0, 16) : '';
/** فحص الإقلاع: { ok, kid, expected, why } — why: missing | short | mismatch */
export function vaultCheck(v, expected) {
  const s = pick(v).secret.trim(), kid = keyId(v), exp = String(expected || '').trim().toLowerCase();
  if (!s) return { ok: false, kid, expected: exp, why: 'missing' };
  if (s.length < 32) return { ok: false, kid, expected: exp, why: 'short' };
  if (exp && exp !== kid) return { ok: false, kid, expected: exp, why: 'mismatch' };
  return { ok: true, kid, expected: exp };
}
export function seal(obj, aad, v) {
  if (!vaultReady(v)) throw new Error('vault-not-ready');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(v), iv);
  c.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 'v1.' + iv.toString('base64') + '.' + c.getAuthTag().toString('base64') + '.' + ct.toString('base64') + '.' + keyId(v);
}
/** بصمة المفتاح الذي شُفّرت به الحزمة ('' للحزم القديمة قبل v56.0) */
export const sealedKeyId = (sealed) => String(String(sealed || '').split('.')[4] || '');
export function open(sealed, aad, v) {
  const [ver, iv, tag, ct, kid] = String(sealed || '').split('.'); if (ver !== 'v1') throw new Error('bad-vault');
  if (kid && kid !== keyId(v)) { const e = new Error('vault-key-mismatch'); e.code = 'vault-key-mismatch'; e.sealedKid = kid; e.serverKid = keyId(v); throw e; }
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(v), Buffer.from(iv, 'base64'));
  d.setAAD(Buffer.from(String(aad))); d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'));
}
