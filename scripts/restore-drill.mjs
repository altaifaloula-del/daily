// v49.1 — MQ-171: تمرين الاستعادة الموثّق. لا يكتب على الإنتاج أبدًا.
//   BACKUP_FILE=… BACKUP_KEY=… node scripts/restore-drill.mjs
//   مع FIRESTORE_EMULATOR_HOST (داخل firebase emulators:exec): يستعيد النسخة كاملة في المحاكي ثم يقرأها ويقارنها بصمةً ببصمة.
// الخطوات: فك التشفير ⇒ فحص المحرك وتوازن الدفاتر ⇒ مطابقة السجلات المحمية ⇒ تفكيك المستندات ⇒ (استعادة في المحاكي) ⇒ إعادة التجميع ⇒ مقارنة البصمات.
import fs from 'node:fs';
import { decrypt, assemble, composeLogical, decodeFields } from './backup-lib.mjs';
import { disassemble, fingerprint, diffPrints, reconcileProtected } from './restore-lib.mjs';
import { buildEngine } from '../tests/build-engine.mjs';

const file = process.env.BACKUP_FILE, pass = process.env.BACKUP_KEY, emu = process.env.FIRESTORE_EMULATOR_HOST, pid = process.env.PROJECT_ID || 'restore-drill';
const fail = (m) => { console.error('::error::' + m); process.exit(1); };
if (!file || !fs.existsSync(file)) fail('ملف النسخة غير موجود: ' + file);
if (!emu && process.env.REQUIRE_EMULATOR) fail('لا محاكي — التمرين لا يكتب على قاعدة حقيقية');
if (emu && /googleapis\.com/.test(emu)) fail('العنوان ليس محاكيًا');
const t0 = Date.now(), log = [];
const step = (m) => { log.push(m); console.log('✓ ' + m); };

const pl = JSON.parse(decrypt(fs.readFileSync(file), pass).toString('utf8')); step('فك التشفير (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
const E = await buildEngine();
const V = E.verifyBackup(pl.logical); if (!V.ok) fail('النسخة لم تجتز الفحص: ' + V.err); if (!V.balanced) fail('الدفاتر غير متوازنة');
step('فحص المحرك: ' + V.counts.closings + ' إغلاق · ' + V.counts.entries + ' قيد · الدفاتر متوازنة');
const P = reconcileProtected(E, pl.logical, pl.raw || {});
Object.entries(P).forEach(([k, r]) => console.log((r.ok ? '  ✓ ' : '  ⚠ ') + k + ': ناقص ' + r.missing + ' · مختلف ' + r.differ + ' · زائد ' + r.extra));
step('مطابقة السجلات المحمية: ' + (Object.values(P).every(r => r.ok) ? 'سليمة' : 'فيها فروق (انظر أعلاه)'));

const before = fingerprint(pl.logical);
const docs = disassemble(pl.platform || {});
let back;
if (emu) {
  const base = 'http://' + emu + '/v1/projects/' + pid + '/databases/(default)/documents';
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };   // المحاكي: صلاحية المالك تتجاوز القواعد
  const enc = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
    : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  const put = async (col, id, data) => { const r = await fetch(base + '/' + col + '/' + encodeURIComponent(id), { method: 'PATCH', headers: H, body: JSON.stringify({ fields: enc(data).mapValue.fields }) }); if (!r.ok) fail('كتابة ' + col + '/' + id + ': ' + r.status); };
  for (const [id, d] of Object.entries(docs)) await put('platform', id, d);
  for (const [col, m] of Object.entries(pl.raw || {})) for (const [id, d] of Object.entries(m)) await put(col, id, d);
  step('الاستعادة في المحاكي: ' + Object.keys(docs).length + ' مستند منصة + ' + Object.values(pl.raw || {}).reduce((a, m) => a + Object.keys(m).length, 0) + ' سجل');
  const read = {}; let tok = '';
  do { const r = await (await fetch(base + '/platform?pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''), { headers: H })).json();
    (r.documents || []).forEach(d => { read[d.name.split('/').pop()] = decodeFields(d.fields || {}); }); tok = r.nextPageToken || ''; } while (tok);
  back = read;
} else back = docs;
const A = assemble(back); if (A.errors.length) fail('إعادة التجميع: ' + A.errors.map(e => e.id + ' ' + e.err).join('، '));
const after = fingerprint(composeLogical(A.values));
const d = diffPrints(before, after); if (d.length) fail('البيانات بعد الاستعادة تختلف عن النسخة: ' + d.join('، '));
const V2 = E.verifyBackup(composeLogical(A.values)); if (!V2.ok || !V2.balanced || JSON.stringify(V2.counts) !== JSON.stringify(V.counts)) fail('أرقام المحرك بعد الاستعادة تختلف');
step('المقارنة: الإعدادات و' + Object.keys(after.ops).length + ' مجموعة متطابقة بصمةً ببصمة، والأعداد والتوازن كما هي');
const summary = { at: new Date().toISOString(), mode: emu ? 'emulator' : 'offline', seconds: Math.round((Date.now() - t0) / 1000), counts: V.counts, protected: P, steps: log };
fs.writeFileSync(process.env.OUT || 'restore-drill.json', JSON.stringify(summary, null, 2));
console.log('✓ تمرين الاستعادة ناجح خلال ' + summary.seconds + ' ث');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### تمرين الاستعادة ✓\n\n' + log.map(x => '- ' + x).join('\n') + '\n');
