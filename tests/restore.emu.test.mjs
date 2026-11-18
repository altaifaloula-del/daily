// v49.1 — MQ-171: تمرين الاستعادة الكامل داخل محاكي Firestore (يعمل ضمن npm run test:rules فقط):
// نسخة مشفّرة ⇒ كتابة كل المستندات والسجلات المحمية في المحاكي ⇒ قراءتها ⇒ مطابقة البصمات والأرقام.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { composeLogical, encrypt } from '../scripts/backup-lib.mjs';

test('تمرين الاستعادة في المحاكي: الاستعادة ثم القراءة ثم المطابقة بصمةً ببصمة', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  const big = Array.from({ length: 4000 }, (_, i) => ({ id: 'm' + i, itemId: 'i1', qty: 1, kind: 'in', whId: 'wh-main', note: 'حركة ' + i }));
  const values = { rms8_org: { branches: [{ id: 'b1', name: 'فرع' }], users: [], suppliers: [], items: [], assets: [] },
    rms8_core: { stockMoves: big, journalManual: [] }, rms8_br_b1: { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-01', status: 'approved', cash: 100, card: 0, sales: 100 }] } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-emu-')), f = path.join(dir, 'b.enc'), out = path.join(dir, 's.json');
  fs.writeFileSync(f, encrypt(Buffer.from(JSON.stringify({ logical: composeLogical(values), platform: values, raw: {} })), 'مفتاح-تمرين-طويل'));
  const o = execFileSync('node', ['scripts/restore-drill.mjs'], { env: { ...process.env, BACKUP_FILE: f, BACKUP_KEY: 'مفتاح-تمرين-طويل', OUT: out, REQUIRE_EMULATOR: '1', PROJECT_ID: 'restore-drill-test' }, encoding: 'utf8' });
  assert.match(o, /الاستعادة في المحاكي/); assert.match(o, /تمرين الاستعادة ناجح/);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).mode, 'emulator');
});
