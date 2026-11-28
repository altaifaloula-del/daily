/**
 * المرحلة H (v56.59) — التزامن على محاكي Firestore الحقيقي (يعمل ضمن npm run test:rules؛ ويتخطى نفسه بلا محاكٍ مع ذكر السبب):
 * الكتابة المشروطة fsWriteIf في storage.js (أساس كل حفظ مشترك بين الأجهزة: مستند الفرع، الولاء والكوبونات، المنشأة) تحت كتابات متزامنة حقيقية
 * بالقواعد نفسها (firestore.rules أو RULES_FILE): جهازان قرآ النسخة نفسها ⇒ تُقبل كتابة واحدة والأخرى «conflict» ولا تُفسد المستند،
 * بما فيه المستند الكبير متعدد الأجزاء (الأجزاء تُكتب قبل المعاملة). الدالة نفسها من storage.js دون نسخ — تُصدَّر للاختبار وقت التجميع فقط.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const EMU = !!process.env.FIRESTORE_EMULATOR_HOST;
const skip = EMU ? false : 'لم يُشغَّل: يتطلب محاكي Firestore (npm run test:rules)';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// أجزاء المستند القديمة تُفرَّغ بعد 60 ثانية (fsBlankLater) — لا تُبقي عملية الاختبار حيّة بعد انتهائه
const _st = globalThis.setTimeout; globalThis.setTimeout = (fn, ms, ...a) => { const t = _st(fn, ms, ...a); if (ms >= 60000 && t && t.unref) t.unref(); return t; };

let env, S, sdk;
const U = { cash: 'cash@test.com', mgr: 'mgr@test.com', acct: 'acct@test.com' };
before(async () => {
  if (!EMU) return;
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  sdk = await import('firebase/firestore');
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'cc-tenant-test' : 'cc-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await sdk.setDoc(sdk.doc(d, 'platform', 'admins'), { emails: ['owner@test.com'] });
    await sdk.setDoc(sdk.doc(d, 'members', U.cash), { email: U.cash, active: true, role: 'cashier', branchId: 'b1' });
    await sdk.setDoc(sdk.doc(d, 'members', U.mgr), { email: U.mgr, active: true, role: 'branch_manager', branchId: 'b1' });
    await sdk.setDoc(sdk.doc(d, 'members', U.acct), { email: U.acct, active: true, role: 'accountant', scope: 'all' }); });
  const cache = path.join(root, 'tests', '.cache'); fs.mkdirSync(cache, { recursive: true });
  const out = path.join(cache, 'storage-emu-' + process.pid + '-' + Math.random().toString(36).slice(2, 8) + '.mjs');
  const plugin = { name: 'expose', setup(b) { b.onLoad({ filter: /[\\/]storage\.js$/ }, async (a) => ({ contents: fs.readFileSync(a.path, 'utf8') + '\nexport { fsWriteIf, fsReadTx, fsWrite, stampOf, docId };\n', loader: 'js' })); } };
  await build({ entryPoints: [path.join(root, 'storage.js')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', define: { 'import.meta.env': '{}' }, plugins: [plugin], external: ['firebase/*'] });
  try { S = await import(out); } finally { try { fs.unlinkSync(out); } catch { } }
});
after(async () => { if (env) await env.cleanup(); });

const dev = (k) => ({ db: env.authenticatedContext('u-' + k, { email: U[k] }).firestore(), ...sdk });
const head = async (f, key) => { const s = await sdk.getDoc(sdk.doc(f.db, 'platform', S.docId(key))); return s.exists() ? s.data() : null; };

test('مستند الفرع: جهازان قرآ النسخة نفسها ثم كتبا معًا ⇒ تُقبل واحدة و«conflict» للأخرى، والمستند = الفائز كاملًا', { skip }, async () => {
  const key = 'rms8:br_b1', A = dev('cash'), B = dev('mgr');
  await S.fsWrite(A, key, { closings: [{ id: 'c0', amt: 1 }] });
  const st = S.stampOf(await head(A, key)); assert.ok(st);
  const rs = await Promise.allSettled([S.fsWriteIf(A, key, { closings: [{ id: 'c0' }, { id: 'from-cash' }] }, st), S.fsWriteIf(B, key, { closings: [{ id: 'c0' }, { id: 'from-mgr' }] }, st)]);
  assert.deepEqual(rs.map(r => r.status).sort(), ['fulfilled', 'rejected']);
  const lost = rs.find(r => r.status === 'rejected'); assert.equal(lost.reason.code, 'conflict');
  const won = rs[0].status === 'fulfilled' ? 'from-cash' : 'from-mgr';
  assert.deepEqual((await S.fsReadTx(A, key)).closings.map(c => c.id), ['c0', won]);
  // الخاسر يعيد القراءة ويدمج ثم يكتب بالبصمة الجديدة ⇒ يُقبل والتعديلان معًا
  const loser = won === 'from-cash' ? B : A, cur = await S.fsReadTx(loser, key);
  await S.fsWriteIf(loser, key, { closings: [...cur.closings, { id: won === 'from-cash' ? 'from-mgr' : 'from-cash' }] }, S.stampOf(await head(loser, key)));
  assert.deepEqual((await S.fsReadTx(A, key)).closings.map(c => c.id).sort(), ['c0', 'from-cash', 'from-mgr']);
});

test('الإنشاء المتزامن (لا مستند بعد): ثلاثة أجهزة تنشئ الكوبونات في اللحظة نفسها ⇒ تُقبل واحدة فقط', { skip }, async () => {
  const key = 'rms8:loy', D = [dev('cash'), dev('mgr'), dev('acct')];
  const rs = await Promise.allSettled(D.map((f, i) => S.fsWriteIf(f, key, { members: {}, tx: [], cpn: { welcome: [{ id: 'po_' + i }] } }, null)));
  assert.equal(rs.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(rs.map(r => r.status)));
  rs.filter(r => r.status === 'rejected').forEach(r => assert.equal(r.reason.code, 'conflict'));
  assert.equal((await S.fsReadTx(D[0], key)).cpn.welcome.length, 1, 'استخدام واحد');
});

test('المستند الكبير متعدد الأجزاء (≈ 2.4MB): كتابتان متزامنتان ⇒ الرأس يشير لنسخة واحدة كاملة سليمة، ولا خلط بين أجزاء النسختين', { skip }, async () => {
  const key = 'rms8:br_b1', A = dev('cash'), B = dev('mgr');
  const big = (tag) => ({ posOrders: Array.from({ length: 6000 }, (_, i) => ({ id: tag + '_' + i, no: 'ف-' + i, note: 'فاتورة تجريبية '.repeat(12) + tag })) });
  assert.ok(JSON.stringify(big('x')).length > 1.2e6);
  const st = S.stampOf(await head(A, key));
  const rs = await Promise.allSettled([S.fsWriteIf(A, key, big('A'), st), S.fsWriteIf(B, key, big('B'), st)]);
  assert.deepEqual(rs.map(r => r.status).sort(), ['fulfilled', 'rejected']); assert.equal(rs.find(r => r.status === 'rejected').reason.code, 'conflict');
  const h = await head(A, key); assert.ok(h.parts > 1, 'أجزاء ' + h.parts);
  const v = await S.fsReadTx(B, key); const tags = new Set(v.posOrders.map(o => o.id.split('_')[0]));
  assert.equal(v.posOrders.length, 6000); assert.equal(tags.size, 1, 'نسخة واحدة: ' + [...tags].join(',')); assert.equal([...tags][0], rs[0].status === 'fulfilled' ? 'A' : 'B');
});
