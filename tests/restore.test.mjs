// v49.1 — MQ-171: تمرين الاستعادة دون شبكة — النسخة المشفّرة ⇒ فك ⇒ تفكيك ⇒ إعادة تجميع ⇒ مطابقة بصمةً ببصمة،
// ومطابقة السجلات المحمية الموجودة في النسخة مع البيانات (تكشف العبث والنقص)، ثم تشغيل سكربت التمرين نفسه على ملف حقيقي الصيغة.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assemble, composeLogical, encrypt } from '../scripts/backup-lib.mjs';
import { disassemble, fingerprint, diffPrints, reconcileProtected } from '../scripts/restore-lib.mjs';
import { buildEngine } from './build-engine.mjs';

const E = await buildEngine();
const org = { branches: [{ id: 'b1', name: 'فرع ١' }], users: [{ id: 'u1' }], suppliers: [{ id: 's1', name: 'مورد' }], items: [], assets: [] };
const jm = { id: 'jm1', date: '2026-11-10', title: 'قيد', by: 'منى', status: 'posted', lines: [{ code: '1101', debit: 100, credit: 0 }, { code: '4101', debit: 0, credit: 100 }] };
const inv = { id: 'inv1', supplierId: 's1', invoiceNo: 'A1', date: '2026-11-09', amount: 115, vatAmt: 15, paidAmount: 0 };
const values = { rms8_org: org, rms8_core: { journalManual: [jm], invoices: [inv], cashVouchers: [], salesInvoices: [], notes: 'x'.repeat(5000) },
  rms8_br_b1: { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-01', status: 'approved', cash: 100, card: 0, sales: 100 }] }, admins: { emails: ['o@x.com'] } };
const rec = (x) => { const { id, ...r } = { id: x.id, ...E.fjRecord(x) }; return r; };

test('التفكيك ثم التجميع يعيد المستندات كما هي — مستند كبير يُقسَّم أجزاءً، ومستندات التحكم كما هي', () => {
  const D = disassemble(values, 1000);
  assert.ok(Object.keys(D).some(k => k.startsWith('rms8_core__r')), 'المستند الكبير مقسّم');
  assert.deepEqual(D.admins, values.admins);
  const A = assemble(D); assert.deepEqual(A.errors, []);
  assert.deepEqual(diffPrints(fingerprint(composeLogical(values)), fingerprint(composeLogical(A.values))), []);
  const broken = { ...D }; delete broken[Object.keys(D).find(k => k.startsWith('rms8_core__r'))];
  assert.ok(assemble(broken).errors.length > 0, 'جزء مفقود يُكشف');
});

test('البصمة تكشف أي اختلاف بعد الاستعادة: سجل ناقص أو رقم مُعدَّل', () => {
  const a = fingerprint(composeLogical(values));
  const v2 = { ...values, rms8_core: { ...values.rms8_core, journalManual: [{ ...jm, lines: [{ code: '1101', debit: 101, credit: 0 }, { code: '4101', debit: 0, credit: 101 }] }] } };
  assert.deepEqual(diffPrints(a, fingerprint(composeLogical(v2))), ['journalManual (1 ⇢ 1)']);
  const v3 = { ...values, rms8_br_b1: { closings: [] } };
  assert.deepEqual(diffPrints(a, fingerprint(composeLogical(v3))), ['closings (1 ⇢ 0)']);
});

test('مطابقة السجلات المحمية في النسخة: سليمة، ثم تكشف القيد المعدَّل والفاتورة الناقصة', () => {
  const L = composeLogical(values);
  const raw = { fin_journal: { jm1: rec(jm) }, fin_docs: { pi_inv1: E.fdRecord('pi', inv) } };
  const ok = reconcileProtected(E, L, raw);
  assert.equal(ok.journal.ok, true); assert.equal(ok.docs_pi.ok, true); assert.equal(ok.docs_si.ok, true);
  const bad = reconcileProtected(E, { ...L, ops: { ...L.ops, journalManual: [{ ...jm, title: 'معدَّل' }] } }, { ...raw, fin_docs: {} });
  assert.deepEqual([bad.journal.differ, bad.docs_pi.missing], [1, 1]);
});

test('سكربت التمرين على ملف مشفّر بصيغة النسخة الليلية: ينجح ويكتب ملخصًا، ويرفض المفتاح الخاطئ', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-')), f = path.join(dir, 'b.enc'), out = path.join(dir, 's.json');
  const logical = composeLogical(values);
  fs.writeFileSync(f, encrypt(Buffer.from(JSON.stringify({ logical, platform: values, raw: { fin_journal: { jm1: rec(jm) } } })), 'مفتاح-تمرين-طويل'));
  const env = { ...process.env, BACKUP_FILE: f, BACKUP_KEY: 'مفتاح-تمرين-طويل', OUT: out, FIRESTORE_EMULATOR_HOST: '' };
  const o = execFileSync('node', ['scripts/restore-drill.mjs'], { env, encoding: 'utf8' });
  assert.match(o, /تمرين الاستعادة ناجح/);
  const S = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(S.mode, 'offline'); assert.equal(S.protected.journal.ok, true); assert.equal(S.counts.closings, 1);
  assert.throws(() => execFileSync('node', ['scripts/restore-drill.mjs'], { env: { ...env, BACKUP_KEY: 'مفتاح-خاطئ-طويل-جدًا' }, encoding: 'utf8', stdio: 'pipe' }));
});
