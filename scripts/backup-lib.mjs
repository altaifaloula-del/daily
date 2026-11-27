// v41.8 — مكتبة النسخ الاحتياطي الليلي (نقية وقابلة للاختبار دون شبكة)
//  • decodeValue: قيمة Firestore REST ⇒ قيمة JS
//  • assemble: يعيد تجميع مستندات rms8_* المقسّمة (رأس {parts, ver, value} + أجزاء {chunk}) ويكشف الجزء المفقود أو JSON التالف
//  • composeLogical: نسخة منطقية بصيغة المنصة نفسها {meta, org, ops, hist} — يفحصها «فحص نسخة» داخل المنصة
//  • encrypt/decrypt: AES-256-GCM بمفتاح PBKDF2-SHA256 (210000 دورة) — الصيغة نفسها يفكّها المتصفح بـ WebCrypto
//    الملف: 'MZBK1' (5 بايت) + ملح 16 + متجه 12 + (نص مشفّر ‖ وسم 16)
import crypto from 'node:crypto';

export const MAGIC = 'MZBK1', ITER = 210000;

export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
export const decodeFields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, decodeValue(v)]));

const CHUNK_RE = /^(.+)__(?:([a-z0-9]{4,20})_)?(\d{1,3})$/;
/** docs: { id: data } لمجموعة platform ⇒ { values: { baseId: object }, raw: { id: data }, errors: [{id, err}] } */
export function assemble(docs) {
  const values = {}, errors = [];
  const heads = Object.keys(docs).filter(id => !CHUNK_RE.test(id));
  for (const id of heads) {
    const d = docs[id] || {};
    if (!id.startsWith('rms8_')) { values[id] = d; continue; }   // مستندات تحكم (admins/security/release) كما هي
    const parts = d.parts || 1;
    if (!Number.isInteger(parts) || parts < 1 || parts > 500) { errors.push({ id, err: 'parts=' + d.parts }); continue; }
    let text;
    if (parts === 1) text = d.value;
    else {
      const cs = [];
      for (let i = 0; i < parts; i++) { const c = docs[id + '__' + (d.ver ? d.ver + '_' : '') + i]; if (!c || typeof c.chunk !== 'string') { errors.push({ id, err: 'جزء مفقود ' + i }); cs.length = 0; break; } cs.push(c.chunk); }
      if (!cs.length) continue; text = cs.join('');
    }
    if (typeof text !== 'string' || !text) { values[id] = undefined; continue; }
    try { values[id] = JSON.parse(text); } catch { errors.push({ id, err: 'JSON تالف' }); }
  }
  return { values, errors };
}

/** النسخة المنطقية بصيغة «النسخ الاحتياطي» في المنصة: ops = المركزي + كل مستندات الفروع مدموجة */
export function composeLogical(values, meta = {}) {
  const org = values.rms8_org || null, core = values.rms8_core || {}, ops = {};
  const merge = (src) => Object.entries(src || {}).forEach(([k, v]) => { if (Array.isArray(v)) ops[k] = [...(ops[k] || []), ...v]; });
  merge(core);
  Object.keys(values).filter(k => /^rms8_br_/.test(k)).sort().forEach(k => merge(values[k]));
  // v52.7 (G3-A): فواتير نقطة البيع الشهرية لكل فرع تُضم إلى posOrders (بلا تكرار مع ما بقي في مستند الفرع)
  const seenPos = new Set((ops.posOrders || []).map(o => o && o.id));
  Object.keys(values).filter(k => /^rms8_pos_.+_[0-9]{6}$/.test(k)).sort().forEach(k => ((values[k] || {}).orders || []).forEach(o => { if (o && !seenPos.has(o.id)) { seenPos.add(o.id); (ops.posOrders = ops.posOrders || []).push(o); } }));
  const branchesDocs = Object.keys(values).filter(k => /^rms8_br_/.test(k)).length;
  // v56.37: أسماء عملاء الولاء المفصولة (سجل لكل فرع + سجل المركز) — تُحفظ كما هي
  const lynKs = Object.keys(values).filter(k => /^rms8_lyb_/.test(k) || k === 'rms8_lyc').sort(); const lyn = lynKs.length ? Object.fromEntries(lynKs.map(k => [k, values[k] || null])) : null;
  return { meta: { app: 'rms8', kind: 'nightly', exportedAt: new Date().toISOString(), by: 'النسخ الليلي (GitHub Actions)', branchesDocs, ...meta }, org, ops, hist: values.rms8_hist || null, loy: values.rms8_loy || null, ...(lyn ? { loyNames: lyn } : {}) };
}

export function encrypt(buf, pass) {
  if (!pass || String(pass).length < 12) throw new Error('مفتاح النسخ قصير — 12 حرفًا على الأقل');
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(Buffer.from(String(pass), 'utf8'), salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv); const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from(MAGIC), salt, iv, ct, c.getAuthTag()]);
}
export function decrypt(file, pass) {
  const b = Buffer.from(file); if (b.slice(0, 5).toString() !== MAGIC) throw new Error('ليس ملف نسخة ميزان مشفّرًا');
  const salt = b.slice(5, 21), iv = b.slice(21, 33), body = b.slice(33, b.length - 16), tag = b.slice(b.length - 16);
  const key = crypto.pbkdf2Sync(Buffer.from(String(pass), 'utf8'), salt, ITER, 32, 'sha256');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}
