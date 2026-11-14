// v41.8 — اختبارات النسخ الاحتياطي الليلي (دون شبكة): فك قيم Firestore، تجميع الأجزاء وكشف التلف،
// الدمج المنطقي المتوافق مع verifyBackup، والتشفير ذهابًا وإيابًا — بما فيه فك ملف Node بـ WebCrypto كما يفعل المتصفح.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeValue, decodeFields, assemble, composeLogical, encrypt, decrypt } from '../scripts/backup-lib.mjs';
import { buildEngine } from './build-engine.mjs';

const E = await buildEngine();
const S = (s) => ({ stringValue: s });

test('decodeValue: كل أنواع قيم Firestore REST', () => {
  assert.equal(decodeValue(S('x')), 'x');
  assert.equal(decodeValue({ integerValue: '42' }), 42);
  assert.equal(decodeValue({ doubleValue: 1.5 }), 1.5);
  assert.equal(decodeValue({ booleanValue: true }), true);
  assert.equal(decodeValue({ nullValue: null }), null);
  assert.equal(decodeValue({ timestampValue: '2026-11-14T00:00:00Z' }), '2026-11-14T00:00:00Z');
  assert.deepEqual(decodeValue({ arrayValue: { values: [S('a'), { integerValue: '2' }] } }), ['a', 2]);
  assert.deepEqual(decodeValue({ arrayValue: {} }), []);
  assert.deepEqual(decodeFields({ m: { mapValue: { fields: { k: S('v'), n: { mapValue: {} } } } } }), { m: { k: 'v', n: {} } });
});

const org = { branches: [{ id: 'b1', name: 'فرع ١' }], users: [{ id: 'u1' }], suppliers: [], items: [], assets: [] };
const core = { journals: [], closings: [] };
const br = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-01', status: 'approved', cash: 100, card: 0, sales: 100 }] };

test('assemble: مستند جزء واحد، ومقسّم بإصدار، ومقسّم قديم بلا إصدار', () => {
  const big = JSON.stringify(br), half = Math.ceil(big.length / 2);
  const core2 = JSON.stringify(core), h2 = Math.ceil(core2.length / 2);
  const docs = {
    rms8_org: { parts: 1, value: JSON.stringify(org) },
    rms8_br_b1: { parts: 2, ver: 'ab12cd', value: '' }, 'rms8_br_b1__ab12cd_0': { chunk: big.slice(0, half) }, 'rms8_br_b1__ab12cd_1': { chunk: big.slice(half) },
    rms8_core: { parts: 2 }, rms8_core__0: { chunk: core2.slice(0, h2) }, rms8_core__1: { chunk: core2.slice(h2) },
    security: { mfa: true }
  };
  const A = assemble(docs);
  assert.deepEqual(A.errors, []);
  assert.deepEqual(A.values.rms8_org, org);
  assert.deepEqual(A.values.rms8_br_b1, br);
  assert.deepEqual(A.values.rms8_core, core);
  assert.deepEqual(A.values.security, { mfa: true });
  assert.ok(!('rms8_core__0' in A.values), 'الأجزاء لا تظهر كمستندات');
});

test('assemble: يكشف الجزء المفقود وJSON التالف — ولا يُخفيهما', () => {
  const A = assemble({ rms8_core: { parts: 3, ver: 'v0001' }, rms8_core__v0001_0: { chunk: '{"a"' }, rms8_core__v0001_2: { chunk: '}' },
    rms8_org: { parts: 1, value: '{bad' } });
  assert.equal(A.errors.length, 2);
  assert.match(A.errors.find(e => e.id === 'rms8_core').err, /مفقود 1/);
  assert.match(A.errors.find(e => e.id === 'rms8_org').err, /تالف/);
});

test('composeLogical: يدمج المركزي وكل الفروع، ويجتاز verifyBackup بمحرك المنصة', () => {
  const L = composeLogical({ rms8_org: org, rms8_core: { closings: [{ id: 'c0', branchId: 'b1', date: '2026-10-01', status: 'approved', cash: 50, card: 0, sales: 50 }] }, rms8_br_b1: br, rms8_br_b2: { closings: [] } });
  assert.equal(L.ops.closings.length, 2);
  assert.equal(L.meta.branchesDocs, 2);
  const V = E.verifyBackup(L);
  assert.equal(V.ok, true); assert.equal(V.balanced, true); assert.equal(V.counts.closings, 2);
  assert.equal(E.verifyBackup(composeLogical({})).ok, false, 'نسخة بلا منشأة لا تمر');
});

test('encrypt/decrypt: ذهاب وإياب، ومفتاح خاطئ أو ملف معدَّل يفشل، ومفتاح قصير مرفوض', () => {
  const pass = 'correct horse battery', plain = Buffer.from(JSON.stringify({ logical: { a: 'عربي ✓' } }));
  const enc = encrypt(plain, pass);
  assert.equal(enc.slice(0, 5).toString(), 'MZBK1');
  assert.ok(!enc.includes(Buffer.from('عربي')), 'لا نص صريح في الملف');
  assert.deepEqual(decrypt(enc, pass), plain);
  assert.throws(() => decrypt(enc, 'wrong passphrase!!'));
  const bad = Buffer.from(enc); bad[40] ^= 1; assert.throws(() => decrypt(bad, pass));
  assert.throws(() => encrypt(plain, 'short'), /قصير/);
  assert.notDeepEqual(encrypt(plain, pass), encrypt(plain, pass), 'ملح ومتجه عشوائيان في كل مرة');
});

test('المتصفح (WebCrypto) يفك ملف الخادم ويرفض المفتاح الخاطئ', async () => {
  const pass = 'nightly-passphrase-2026';
  const L = composeLogical({ rms8_org: org, rms8_br_b1: br });
  const enc = encrypt(Buffer.from(JSON.stringify({ logical: L, platform: {}, raw: {} })), pass);
  const ab = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.length);
  assert.equal(E.isMzbk(ab), true);
  assert.equal(E.isMzbk(new TextEncoder().encode('{"org":{}}').buffer), false);
  const d = await E.mzbkDecrypt(ab, pass);
  assert.equal(E.verifyBackup(d.logical).ok, true);
  await assert.rejects(() => E.mzbkDecrypt(ab, 'nope-nope-nope'), /غير صحيح/);
});

test('المسار الليلي: أسرار فقط، حذف الاعتماد دائمًا، لا نسخة غير مشفّرة', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/nightly-backup.yml', import.meta.url), 'utf8');
  assert.match(y, /cron: '17 0 \* \* \*'/);
  assert.match(y, /BACKUP_KEY: \$\{\{ secrets\.BACKUP_KEY \}\}/);
  assert.match(y, /if: always\(\)\s+run: rm -f "\$RUNNER_TEMP\/sa\.json"/);
  assert.match(y, /permissions:\s+contents: read/);
  const s = fs.readFileSync(new URL('../scripts/nightly-backup.mjs', import.meta.url), 'utf8');
  assert.ok(!/writeFileSync\([^)]*JSON\.stringify\(\{ logical/.test(s), 'لا يُكتب المحتوى غير مشفّر');
  assert.match(s, /process\.exit\(1\)/);
});
